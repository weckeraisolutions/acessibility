import { useState, useRef, useCallback } from "react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import type { ChapterRow } from "./useChapters";

type Page = Tables<"pages"> & { image_hd_url?: string | null };

export interface ChapterExportProgress {
  phase: number;
  totalPhases: number;
  phaseLabel: string;
  percent: number;
  currentPage: number;
  totalPages: number;
  etaSec: number;
  partialBytes?: number;
}

function loadImg(url: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const i = new Image();
    i.crossOrigin = "anonymous";
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = url;
  });
}

function slugify(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 50) || "capitulo";
}

export function useChapterVideoExport() {
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState<ChapterExportProgress | null>(null);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const cancelledRef = useRef(false);
  const startTimeRef = useRef(0);
  const ffmpegRef = useRef<FFmpeg | null>(null);

  const update = (phase: number, totalPhases: number, phaseLabel: string, percent: number, currentPage = 0, totalPages = 0) => {
    const elapsed = (Date.now() - startTimeRef.current) / 1000;
    const overall = ((phase - 1) / totalPhases + percent / 100 / totalPhases) * 100;
    const etaSec = overall > 0 ? (elapsed / overall) * (100 - overall) : 0;
    setProgress({ phase, totalPhases, phaseLabel, percent: Math.round(percent), currentPage, totalPages, etaSec });
  };

  const exportChapter = useCallback(async (
    chapter: ChapterRow,
    pages: Page[],
    projectName: string,
    options: {
      resolution: "1080p" | "4k";
      layout: "single" | "double";
      interpreterMode: "vlibras" | "human_video" | "none";
      interpreterVideoUrl?: string | null;
      flipbookContainer?: HTMLElement | null;
    },
  ) => {
    cancelledRef.current = false;
    setExporting(true);
    setResultBlob(null);
    startTimeRef.current = Date.now();

    const W = options.resolution === "4k" ? 3840 : 1920;
    const H = options.resolution === "4k" ? 2160 : 1080;
    const FPS = 30;
    const FLIP_OFFSET = 0.3;

    const eligible = pages
      .filter(p => p.page_number >= chapter.start_page && p.page_number <= chapter.end_page)
      .filter(p => (p.image_hd_url || p.image_url) && p.audiobook_audio_url && p.audiobook_audio_duration_seconds && p.audiobook_audio_duration_seconds > 0)
      .sort((a, b) => a.page_number - b.page_number);

    if (eligible.length === 0) {
      setExporting(false);
      throw new Error("Nenhuma página elegível (precisa de imagem + áudio gerado).");
    }

    try {
      // Phase 1: init ffmpeg + measure durations via ffprobe-like approach (we already have audio_duration in DB)
      update(1, 4, "Inicializando engine de vídeo", 0);
      const ffmpeg = new FFmpeg();
      ffmpegRef.current = ffmpeg;
      const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm";
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
      });
      update(1, 4, "Inicializando engine de vídeo", 100);

      // Phase 2: render frames
      const canvas = document.createElement("canvas");
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext("2d")!;

      // Compute layout regions: 70% flipbook | 30% interpreter
      const flipW = Math.floor(W * 0.7);
      const interpW = W - flipW;

      // Load interpreter video element if needed
      let interpVideo: HTMLVideoElement | null = null;
      if (options.interpreterMode === "human_video" && options.interpreterVideoUrl) {
        interpVideo = document.createElement("video");
        interpVideo.crossOrigin = "anonymous";
        interpVideo.muted = true;
        const url = options.interpreterVideoUrl.startsWith("http")
          ? options.interpreterVideoUrl
          : (await supabase.storage.from("interpreter-videos").createSignedUrl(options.interpreterVideoUrl, 3600)).data?.signedUrl;
        if (url) {
          interpVideo.src = url;
          await new Promise((res) => { interpVideo!.onloadedmetadata = () => res(null); interpVideo!.onerror = () => res(null); });
        }
      }

      let globalFrame = 0;
      const audioFiles: string[] = [];

      for (let i = 0; i < eligible.length; i++) {
        if (cancelledRef.current) throw new Error("Cancelado");
        const page = eligible[i];
        const dur = Number(page.audiobook_audio_duration_seconds);
        const img = await loadImg(page.image_hd_url || page.image_url!);

        const totalFrames = Math.ceil(dur * FPS);
        for (let f = 0; f < totalFrames; f++) {
          if (cancelledRef.current) throw new Error("Cancelado");

          // Background
          ctx.fillStyle = "#0a0a0a";
          ctx.fillRect(0, 0, W, H);

          // Flipbook region (left): center the page image with letterbox
          const ratio = img.width / img.height;
          const targetH = H * 0.92;
          const targetW = Math.min(flipW * 0.95, targetH * ratio);
          const finalH = targetW / ratio;
          const dx = (flipW - targetW) / 2;
          const dy = (H - finalH) / 2;
          ctx.drawImage(img, dx, dy, targetW, finalH);

          // Interpreter region (right)
          if (options.interpreterMode === "human_video" && interpVideo) {
            const tAbs = (i === 0 ? 0 : eligible.slice(0, i).reduce((s, p) => s + Number(p.audiobook_audio_duration_seconds), 0)) + (f / FPS);
            try {
              if (Math.abs(interpVideo.currentTime - tAbs) > 0.1) interpVideo.currentTime = Math.min(tAbs, interpVideo.duration || tAbs);
              await new Promise((r) => setTimeout(r, 5));
              const vR = interpVideo.videoWidth / interpVideo.videoHeight || 9 / 16;
              const vH = H * 0.9;
              const vW = Math.min(interpW * 0.95, vH * vR);
              const vDx = flipW + (interpW - vW) / 2;
              const vDy = (H - vH * (interpW * 0.95 < vH * vR ? interpW * 0.95 / (vH * vR) : 1)) / 2;
              ctx.drawImage(interpVideo, vDx, vDy, vW, (vW / vR));
            } catch { /* ignore frame draw error */ }
          } else if (options.interpreterMode === "vlibras") {
            // Placeholder: draw a neutral panel — full DOM capture per frame would be too slow.
            ctx.fillStyle = "#1a1a1a";
            ctx.fillRect(flipW, 0, interpW, H);
            ctx.fillStyle = "#888";
            ctx.font = "24px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText("VLibras", flipW + interpW / 2, H / 2);
          }
          // else "none" — leave bg

          const blob = await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), "image/jpeg", 0.9));
          const data = new Uint8Array(await blob.arrayBuffer());
          await ffmpeg.writeFile(`f_${String(globalFrame).padStart(6, "0")}.jpg`, data);
          globalFrame++;

          if (f % 15 === 0) {
            update(2, 4, "Renderizando frames", ((i + f / totalFrames) / eligible.length) * 100, i + 1, eligible.length);
          }
        }

        // Save audio
        const audioName = `a_${i}.mp3`;
        const audioData = await fetchFile(page.audiobook_audio_url!);
        await ffmpeg.writeFile(audioName, audioData);
        audioFiles.push(audioName);

        update(2, 4, "Renderizando frames", ((i + 1) / eligible.length) * 100, i + 1, eligible.length);
      }

      // Phase 3: concat audio
      update(3, 4, "Concatenando áudio do capítulo", 0);
      const concatList = audioFiles.map(f => `file '${f}'`).join("\n");
      await ffmpeg.writeFile("audiolist.txt", new TextEncoder().encode(concatList));
      await ffmpeg.exec(["-f", "concat", "-safe", "0", "-i", "audiolist.txt", "-c", "copy", "audio_total.mp3"]);
      update(3, 4, "Concatenando áudio do capítulo", 100);

      // Phase 4: encode
      update(4, 4, "Encoding final (H.264)", 0);
      ffmpeg.on("progress", (e: any) => {
        if (e?.progress != null) update(4, 4, "Encoding final (H.264)", Math.min(99, Math.round(e.progress * 100)));
      });
      await ffmpeg.exec([
        "-r", String(FPS),
        "-i", "f_%06d.jpg",
        "-i", "audio_total.mp3",
        "-c:v", "libx264",
        "-preset", "medium",
        "-crf", "20",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-b:a", "192k",
        "-movflags", "+faststart",
        "-shortest",
        "out.mp4",
      ]);
      update(4, 4, "Encoding final (H.264)", 100);

      const outputData = await ffmpeg.readFile("out.mp4");
      const videoBlob = new Blob([outputData as unknown as BlobPart], { type: "video/mp4" });
      setResultBlob(videoBlob);

      // Upload
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const fname = `${slugify(projectName)}_${slugify(chapter.title)}_${options.resolution}.mp4`;
          const path = `${session.user.id}/${chapter.project_id}/${fname}`;
          await supabase.storage.from("videobook-final").upload(path, videoBlob, { upsert: true, contentType: "video/mp4" });
          const { data: urlData } = await supabase.storage.from("videobook-final").createSignedUrl(path, 60 * 60 * 24 * 30);
          await supabase.from("chapters" as any).update({
            videobook_url: urlData?.signedUrl || path,
            videobook_status: "ready",
            videobook_resolution: options.resolution,
            videobook_layout: options.layout,
          } as any).eq("id", chapter.id);
        }
      } catch (e) {
        console.warn("[chapter export] upload failed", e);
      }

      return videoBlob;
    } catch (e: any) {
      if (e.message !== "Cancelado") {
        try {
          await supabase.from("chapters" as any).update({ videobook_status: "error" } as any).eq("id", chapter.id);
        } catch {}
      }
      throw e;
    } finally {
      setExporting(false);
    }
  }, []);

  const cancel = useCallback(() => { cancelledRef.current = true; }, []);
  const downloadResult = useCallback((filename = "videobook.mp4") => {
    if (!resultBlob) return;
    const url = URL.createObjectURL(resultBlob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }, [resultBlob]);

  return { exporting, progress, resultBlob, exportChapter, cancel, downloadResult };
}