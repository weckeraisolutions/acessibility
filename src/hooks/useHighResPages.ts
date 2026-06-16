import { useState, useCallback } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

type Page = Tables<"pages"> & { image_hd_url?: string | null };

const HD_THRESHOLD = 2000;
const HD_TARGET_SCALE = 300 / 72; // 300dpi

function probeImageWidth(url: string): Promise<number> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img.naturalWidth || 0);
    img.onerror = () => resolve(0);
    img.src = url;
  });
}

function pad(n: number, len = 4) {
  return String(n).padStart(len, "0");
}

async function renderPageToBlob(
  pdfDoc: pdfjsLib.PDFDocumentProxy,
  pageNum: number,
  scale: number,
): Promise<Blob> {
  const page = await pdfDoc.getPage(pageNum);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d")!;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png");
  });
  canvas.width = 0;
  canvas.height = 0;
  page.cleanup();
  return blob;
}

export function useHighResPages() {
  const [preparing, setPreparing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, message: "" });

  const ensureHighResForChapter = useCallback(async (
    projectId: string,
    _chapterId: string,
    pages: Page[],
    startPage: number,
    endPage: number,
  ) => {
    const subset = pages
      .filter((p) => p.page_number >= startPage && p.page_number <= endPage)
      .sort((a, b) => a.page_number - b.page_number);
    if (subset.length === 0) return { skipped: true };

    setPreparing(true);
    setProgress({ current: 0, total: subset.length, message: "Verificando resolução..." });

    // Determine which pages need HD rendering
    const needHd: Page[] = [];
    for (let i = 0; i < subset.length; i++) {
      const p = subset[i];
      setProgress({ current: i + 1, total: subset.length, message: `Verificando ${i + 1}/${subset.length}` });
      if (p.image_hd_url) continue;
      const url = p.image_url;
      if (!url) continue;
      const w = await probeImageWidth(url);
      if (w < HD_THRESHOLD) needHd.push(p);
    }

    if (needHd.length === 0) {
      setPreparing(false);
      return { skipped: true };
    }

    try {
      // Fetch project to get pdf_url
      const { data: project, error: projErr } = await supabase
        .from("projects")
        .select("pdf_url, user_id")
        .eq("id", projectId)
        .single();
      if (projErr || !project?.pdf_url) throw new Error("PDF do projeto não encontrado.");

      setProgress({ current: 0, total: needHd.length, message: "Baixando PDF original..." });

      // Get signed URL for the PDF
      const { data: signed, error: signedErr } = await supabase.storage
        .from("pdfs")
        .createSignedUrl(project.pdf_url, 3600);
      if (signedErr || !signed?.signedUrl) throw new Error("Não foi possível acessar o PDF.");

      const resp = await fetch(signed.signedUrl);
      if (!resp.ok) throw new Error("Falha ao baixar o PDF.");
      const buf = await resp.arrayBuffer();

      const pdfDoc = await pdfjsLib.getDocument({ data: buf }).promise;

      for (let i = 0; i < needHd.length; i++) {
        const p = needHd[i];
        setProgress({
          current: i + 1,
          total: needHd.length,
          message: `Renderizando página ${p.page_number} em alta resolução (${i + 1}/${needHd.length})`,
        });

        const blob = await renderPageToBlob(pdfDoc, p.page_number, HD_TARGET_SCALE);
        const path = `${project.user_id}/${projectId}/pag_${pad(p.page_number)}.png`;
        const up = await supabase.storage
          .from("page-images-hd")
          .upload(path, blob, { contentType: "image/png", upsert: true });
        if (up.error) throw new Error(`Upload falhou (pág ${p.page_number}): ${up.error.message}`);

        const { data: urlData } = supabase.storage.from("page-images-hd").getPublicUrl(path);
        const hdUrl = urlData.publicUrl;

        await supabase
          .from("pages")
          .update({ image_hd_url: hdUrl })
          .eq("project_id", projectId)
          .eq("page_number", p.page_number);
      }

      pdfDoc.destroy();
      setProgress({ current: needHd.length, total: needHd.length, message: "Páginas HD prontas!" });
      return { skipped: false, processed: needHd.length };
    } finally {
      setPreparing(false);
    }
  }, []);

  return { preparing, progress, ensureHighResForChapter };
}
