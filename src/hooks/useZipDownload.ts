import { useState, useRef, useCallback } from "react";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import type { Chapter } from "./useChapters";

type Page = Tables<"pages">;

export function useZipDownload() {
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentFile, setCurrentFile] = useState(0);
  const [totalFiles, setTotalFiles] = useState(0);
  const cancelledRef = useRef(false);

  const cancel = useCallback(() => { cancelledRef.current = true; }, []);

  const getAudioUrl = (page: Page, mode: "audiobook" | "audiodesc") =>
    mode === "audiobook" ? page.audiobook_audio_url : page.audiodesc_audio_url;

  const filterPages = (pages: Page[], mode: "audiobook" | "audiodesc", start?: number, end?: number) =>
    pages.filter(p => {
      const url = getAudioUrl(p, mode);
      if (!url) return false;
      if (start != null && end != null) return p.page_number >= start && p.page_number <= end;
      return true;
    });

  const buildZip = async (pagesWithAudio: Page[], mode: "audiobook" | "audiodesc", subfolder?: string) => {
    const zip = new JSZip();
    setTotalFiles(pagesWithAudio.length);
    setCurrentFile(0);

    for (let i = 0; i < pagesWithAudio.length; i++) {
      if (cancelledRef.current) return null;
      const page = pagesWithAudio[i];
      const url = getAudioUrl(page, mode)!;
      const res = await fetch(url);
      const blob = await res.blob();
      const name = `pagina_${String(page.page_number).padStart(3, "0")}.mp3`;
      const path = subfolder ? `${subfolder}/${name}` : name;
      zip.file(path, blob);
      setCurrentFile(i + 1);
      setProgress(Math.round(((i + 1) / pagesWithAudio.length) * 100));
    }
    return zip.generateAsync({ type: "blob" });
  };

  const downloadChapter = useCallback(async (
    pages: Page[], projectName: string, chapterName: string, mode: "audiobook" | "audiodesc",
    startPage: number, endPage: number
  ) => {
    const filtered = filterPages(pages, mode, startPage, endPage);
    if (!filtered.length) { toast.error("Nenhum áudio gerado neste capítulo ainda"); return; }
    cancelledRef.current = false;
    setDownloading(true); setProgress(0);
    try {
      const blob = await buildZip(filtered, mode);
      if (blob) saveAs(blob, `${projectName}_${chapterName}.zip`);
    } catch (e) { toast.error("Erro ao criar ZIP"); }
    setDownloading(false);
  }, []);

  const downloadFullBook = useCallback(async (
    pages: Page[], projectName: string, mode: "audiobook" | "audiodesc", chapters?: Chapter[]
  ) => {
    const filtered = filterPages(pages, mode);
    if (!filtered.length) { toast.error("Nenhum áudio gerado ainda"); return; }
    cancelledRef.current = false;
    setDownloading(true); setProgress(0);
    try {
      let blob: Blob | null;
      if (chapters && chapters.length > 0) {
        const zip = new JSZip();
        let done = 0;
        const total = filtered.length;
        setTotalFiles(total);
        for (const ch of chapters) {
          const chPages = filtered.filter(p => p.page_number >= ch.startPage && p.page_number <= ch.endPage);
          for (const page of chPages) {
            if (cancelledRef.current) { setDownloading(false); return; }
            const url = getAudioUrl(page, mode)!;
            const res = await fetch(url);
            const b = await res.blob();
            zip.file(`${ch.name}/pagina_${String(page.page_number).padStart(3, "0")}.mp3`, b);
            done++;
            setCurrentFile(done);
            setProgress(Math.round((done / total) * 100));
          }
        }
        // pages not in any chapter
        const chPageNums = new Set(chapters.flatMap(c => filtered.filter(p => p.page_number >= c.startPage && p.page_number <= c.endPage).map(p => p.page_number)));
        for (const page of filtered) {
          if (chPageNums.has(page.page_number)) continue;
          if (cancelledRef.current) { setDownloading(false); return; }
          const url = getAudioUrl(page, mode)!;
          const res = await fetch(url);
          const b = await res.blob();
          zip.file(`pagina_${String(page.page_number).padStart(3, "0")}.mp3`, b);
          done++;
          setCurrentFile(done);
          setProgress(Math.round((done / total) * 100));
        }
        blob = await zip.generateAsync({ type: "blob" });
      } else {
        blob = await buildZip(filtered, mode);
      }
      const suffix = mode === "audiobook" ? "audiobook_completo" : "audiodesc_completa";
      if (blob) saveAs(blob, `${projectName}_${suffix}.zip`);
    } catch { toast.error("Erro ao criar ZIP"); }
    setDownloading(false);
  }, []);

  return { downloading, progress, currentFile, totalFiles, cancel, downloadChapter, downloadFullBook };
}
