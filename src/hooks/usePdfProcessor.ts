import { useState, useEffect, useRef } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { useToast } from "@/hooks/use-toast";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

type Project = Tables<"projects">;
type Page = Tables<"pages">;

interface PdfProcessorState {
  processing: boolean;
  progress: number;
  currentPage: number;
  totalPages: number;
  error: string | null;
}

function padNum(n: number, len = 3) {
  return String(n).padStart(len, "0");
}

async function renderPageToBlob(
  pdfDoc: pdfjsLib.PDFDocumentProxy,
  pageNum: number,
  scale: number
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
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Canvas toBlob failed"))), "image/png");
  });
  canvas.width = 0;
  canvas.height = 0;
  return blob;
}

export function usePdfProcessor(
  project: Project | null,
  pages: Page[],
  refetch: () => Promise<void>
) {
  const [state, setState] = useState<PdfProcessorState>({
    processing: false,
    progress: 0,
    currentPage: 0,
    totalPages: 0,
    error: null,
  });
  const startedRef = useRef(false);
  const { toast } = useToast();

  const shouldProcess =
    project &&
    project.processing_status === "pending" &&
    pages.length === 0 &&
    !!project.pdf_url;

  useEffect(() => {
    if (!shouldProcess || startedRef.current) return;
    startedRef.current = true;
    processProject();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldProcess]);

  async function processProject() {
    if (!project || !project.pdf_url) return;
    setState((s) => ({ ...s, processing: true, error: null, progress: 0 }));

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      const currentUserId = userData?.user?.id;
      if (userError || !currentUserId) throw new Error("Sessão expirada. Entre novamente e tente processar o PDF.");
      if (currentUserId !== project.user_id) throw new Error("Este projeto pertence a outro usuário autenticado.");

      await supabase.from("projects").update({ processing_status: "pending" }).eq("id", project.id);

      // 1. Download PDF
      const { data: signedData, error: signedError } = await supabase.storage
        .from("pdfs")
        .createSignedUrl(project.pdf_url, 3600);
      if (signedError || !signedData?.signedUrl) throw new Error("Não foi possível acessar o PDF.");

      const response = await fetch(signedData.signedUrl);
      if (!response.ok) throw new Error("Falha ao baixar o PDF.");
      const arrayBuffer = await response.arrayBuffer();

      // 2. Load PDF
      let pdfDoc: pdfjsLib.PDFDocumentProxy;
      try {
        pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      } catch (err: unknown) {
        if (err && typeof err === 'object' && 'name' in err && err.name === "PasswordException") {
          throw new Error("PASSWORD_PROTECTED");
        }
        throw new Error("PDF inválido ou corrompido.");
      }

      const numPages = pdfDoc.numPages;
      setState((s) => ({ ...s, totalPages: numPages }));

      // 3. Update total_pages
      await supabase.from("projects").update({ total_pages: numPages }).eq("id", project.id);

      // 4. Process in batches of 5
      const BATCH = 5;
      let processed = 0;
      let succeeded = 0;

      for (let start = 1; start <= numPages; start += BATCH) {
        const end = Math.min(start + BATCH - 1, numPages);
        const batch = Array.from({ length: end - start + 1 }, (_, i) => start + i);

        await Promise.all(
          batch.map(async (pageNum) => {
            try {
              const imageBlob = await renderPageToBlob(pdfDoc, pageNum, 150 / 72);
              const thumbBlob = await renderPageToBlob(pdfDoc, pageNum, 1.0);

              const imagePath = `${currentUserId}/${project.id}/pag_${padNum(pageNum)}.png`;
              const thumbPath = `${currentUserId}/${project.id}/thumb_${padNum(pageNum)}.png`;

              const [imgUp, thumbUp] = await Promise.all([
                supabase.storage.from("page-images").upload(imagePath, imageBlob, { contentType: "image/png", upsert: true }),
                supabase.storage.from("page-thumbnails").upload(thumbPath, thumbBlob, { contentType: "image/png", upsert: true }),
              ]);

              if (imgUp.error) throw imgUp.error;
              if (thumbUp.error) throw thumbUp.error;

              await supabase.from("pages").insert({
                project_id: project.id,
                page_number: pageNum,
                image_url: imagePath,
                thumbnail_url: thumbPath,
              });
              succeeded++;
            } catch (pageErr) {
              console.error(`Erro na página ${pageNum}:`, pageErr);
              toast({ title: `Erro na página ${pageNum}`, description: "Continuando com as demais.", variant: "destructive" });
            } finally {
              processed++;
              setState((s) => ({
                ...s,
                currentPage: processed,
                progress: Math.round((processed / numPages) * 100),
              }));
            }
          })
        );
      }

      // 5. Mark ready (or failed if nothing got through)
      if (succeeded === 0) {
        await supabase.from("projects").update({ processing_status: "failed" }).eq("id", project.id);
        await refetch();
        setState((s) => ({
          ...s,
          processing: false,
          error: "Nenhuma página foi processada. Verifique se o PDF está válido e tente novamente.",
        }));
        return;
      }
      await supabase.from("projects").update({ processing_status: "ready" }).eq("id", project.id);
      await refetch();
      setState((s) => ({ ...s, processing: false }));
    } catch (err: unknown) {
      const msg =
        err instanceof Error && err.message === "PASSWORD_PROTECTED"
          ? "Este PDF está protegido por senha. Remova a senha e tente novamente."
          : (err instanceof Error ? err.message : "Erro ao processar o PDF.");
      setState((s) => ({ ...s, processing: false, error: msg }));
    }
  }

  const retry = () => {
    startedRef.current = false;
    setState({ processing: false, progress: 0, currentPage: 0, totalPages: 0, error: null });
    // Re-trigger by resetting ref; the effect will fire again
    setTimeout(() => {
      startedRef.current = false;
      processProject();
    }, 100);
  };

  return { ...state, retry };
}
