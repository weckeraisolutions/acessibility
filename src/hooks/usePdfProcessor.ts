import { fetchStoredFile, uploadFile, deleteFile } from "@/lib/storage";
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
  page.cleanup();
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

    let pdfDoc: pdfjsLib.PDFDocumentProxy | null = null;
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      const currentUserId = userData?.user?.id;
      if (userError || !currentUserId) throw new Error("Sessão expirada. Entre novamente e tente processar o PDF.");
      if (currentUserId !== project.user_id) throw new Error("Este projeto pertence a outro usuário autenticado.");

      const { error: pendingError } = await supabase.from("projects").update({ processing_status: "pending" }).eq("id", project.id);
      if (pendingError) throw pendingError;

      // 1. Download PDF
      const response = await fetchStoredFile(project.pdf_url);
      if (!response.ok) throw new Error("Falha ao baixar o PDF.");
      const arrayBuffer = await response.arrayBuffer();

      // 2. Load PDF
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
      const { error: totalError } = await supabase.from("projects").update({ total_pages: numPages }).eq("id", project.id);
      if (totalError) throw totalError;

      // 4. Process in batches of 5
      const BATCH = 5;
      let processed = 0;
      let succeeded = 0;
      const { data: existing, error: existingError } = await supabase.from("pages").select("page_number").eq("project_id", project.id);
      if (existingError) throw existingError;
      const existingNumbers = new Set((existing || []).map(p => p.page_number));

      for (let start = 1; start <= numPages; start += BATCH) {
        const end = Math.min(start + BATCH - 1, numPages);
        const batch = Array.from({ length: end - start + 1 }, (_, i) => start + i);

        await Promise.all(
          batch.map(async (pageNum) => {
            try {
              if (existingNumbers.has(pageNum)) { succeeded++; return; }
              const imageBlob = await renderPageToBlob(pdfDoc, pageNum, 150 / 72);
              const thumbBlob = await renderPageToBlob(pdfDoc, pageNum, 1.0);

              const refs: string[] = [];
              try {
                const imagePath = await uploadFile(imageBlob, { project_id: project.id, kind: "page-image", file_name: `pag_${padNum(pageNum)}.png` });
                refs.push(imagePath);
                const thumbPath = await uploadFile(thumbBlob, { project_id: project.id, kind: "page-thumbnail", file_name: `thumb_${padNum(pageNum)}.png` });
                refs.push(thumbPath);
                const { error } = await supabase.from("pages").insert({
                  project_id: project.id, page_number: pageNum, image_url: imagePath, thumbnail_url: thumbPath,
                });
                if (error) throw error;
                succeeded++;
              } catch (error) {
                await Promise.allSettled(refs.map(deleteFile));
                throw error;
              }
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
      if (succeeded !== numPages) {
        await supabase.from("projects").update({ processing_status: "failed" }).eq("id", project.id);
        await refetch();
        setState((s) => ({
          ...s,
          processing: false,
          error: "Algumas páginas não foram processadas. Tente novamente para completar as páginas restantes.",
        }));
        return;
      }
      const { error: readyError } = await supabase.from("projects").update({ processing_status: "ready" }).eq("id", project.id);
      if (readyError) throw readyError;
      await refetch();
      setState((s) => ({ ...s, processing: false }));
    } catch (err: unknown) {
      const msg =
        err instanceof Error && err.message === "PASSWORD_PROTECTED"
          ? "Este PDF está protegido por senha. Remova a senha e tente novamente."
          : (err instanceof Error ? err.message : "Erro ao processar o PDF.");
      setState((s) => ({ ...s, processing: false, error: msg }));
    } finally {
      if (pdfDoc) await pdfDoc.destroy();
    }
  }

  const retry = () => {
    startedRef.current = true;
    setState({ processing: false, progress: 0, currentPage: 0, totalPages: 0, error: null });
    void processProject();
  };

  return { ...state, retry };
}
