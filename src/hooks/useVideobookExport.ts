import { useState, useRef, useCallback } from "react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type Page = Tables<"pages">;

interface Region {
  id: string;
  label: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  animation_suggestion: string;
  timestamp_start: number;
  timestamp_end: number;
}

interface ExportProgress {
  phase: number;
  totalPhases: number;
  phaseLabel: string;
  percent: number;
  currentPage: number;
  totalPages: number;
  estimatedRemaining: string;
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

function renderFrame(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  regions: Region[],
  currentTime: number,
  pageAnimation: string,
  canvasW: number,
  canvasH: number,
  audioDuration: number
) {
  ctx.clearRect(0, 0, canvasW, canvasH);
  ctx.save();

  // Page base animation
  const pageProgress = audioDuration > 0 ? currentTime / audioDuration : 0;
  const ep = easeInOut(Math.min(1, pageProgress));
  let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;

  switch (pageAnimation) {
    case "ken_burns": {
      const scale = 1 + 0.1 * ep;
      const dx = img.naturalWidth * 0.05 * ep;
      const dy = img.naturalHeight * 0.05 * ep;
      sx = dx; sy = dy;
      sw = img.naturalWidth / scale; sh = img.naturalHeight / scale;
      break;
    }
    case "zoom_in": {
      const scale = 1 + 0.15 * ep;
      const cx = img.naturalWidth / 2, cy = img.naturalHeight / 2;
      sw = img.naturalWidth / scale; sh = img.naturalHeight / scale;
      sx = cx - sw / 2; sy = cy - sh / 2;
      break;
    }
    case "zoom_out": {
      const scale = 1.15 - 0.15 * ep;
      const cx = img.naturalWidth / 2, cy = img.naturalHeight / 2;
      sw = img.naturalWidth / scale; sh = img.naturalHeight / scale;
      sx = cx - sw / 2; sy = cy - sh / 2;
      break;
    }
    case "pan_right":
      sx = img.naturalWidth * 0.05 * ep;
      break;
    case "pan_left":
      sx = -img.naturalWidth * 0.05 * ep;
      break;
  }

  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvasW, canvasH);
  ctx.restore();

  // Region animations
  for (const r of regions) {
    if (currentTime < r.timestamp_start || currentTime > r.timestamp_end) continue;
    const progress = easeInOut((currentTime - r.timestamp_start) / Math.max(0.01, r.timestamp_end - r.timestamp_start));
    const rx = r.x * canvasW, ry = r.y * canvasH;
    const rw = r.width * canvasW, rh = r.height * canvasH;

    ctx.save();
    switch (r.animation_suggestion) {
      case "spotlight": {
        ctx.fillStyle = `rgba(0,0,0,${0.6 * progress})`;
        ctx.fillRect(0, 0, canvasW, canvasH);
        ctx.globalCompositeOperation = "destination-out";
        ctx.beginPath();
        ctx.ellipse(rx + rw / 2, ry + rh / 2, rw / 2 + 10, rh / 2 + 10, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = "source-over";
        // Redraw region area clearly
        ctx.drawImage(img, r.x * img.naturalWidth, r.y * img.naturalHeight, r.width * img.naturalWidth, r.height * img.naturalHeight, rx, ry, rw, rh);
        break;
      }
      case "pulse_border": {
        const opacity = Math.sin(currentTime * 4) * 0.5 + 0.5;
        ctx.strokeStyle = `rgba(255,255,255,${opacity})`;
        ctx.lineWidth = 3;
        ctx.strokeRect(rx, ry, rw, rh);
        break;
      }
      case "zoom_in": {
        const scale = 1 + 0.15 * progress;
        const cx = rx + rw / 2, cy = ry + rh / 2;
        ctx.strokeStyle = `rgba(255,255,255,${0.4 * progress})`;
        ctx.lineWidth = 2;
        ctx.strokeRect(cx - (rw * scale) / 2, cy - (rh * scale) / 2, rw * scale, rh * scale);
        break;
      }
      case "fade_in": {
        ctx.fillStyle = `rgba(255,255,200,${0.15 * (1 - progress)})`;
        ctx.fillRect(rx, ry, rw, rh);
        break;
      }
      default:
        break;
    }
    ctx.restore();
  }
}

function renderTransition(
  ctx: CanvasRenderingContext2D,
  imgOut: HTMLImageElement,
  imgIn: HTMLImageElement,
  progress: number,
  type: string,
  canvasW: number,
  canvasH: number
) {
  ctx.clearRect(0, 0, canvasW, canvasH);
  const ep = easeInOut(progress);

  switch (type) {
    case "fade":
      ctx.globalAlpha = 1 - ep;
      ctx.drawImage(imgOut, 0, 0, canvasW, canvasH);
      ctx.globalAlpha = ep;
      ctx.drawImage(imgIn, 0, 0, canvasW, canvasH);
      ctx.globalAlpha = 1;
      break;
    case "slide_left":
      ctx.drawImage(imgOut, -canvasW * ep, 0, canvasW, canvasH);
      ctx.drawImage(imgIn, canvasW * (1 - ep), 0, canvasW, canvasH);
      break;
    case "slide_right":
      ctx.drawImage(imgOut, canvasW * ep, 0, canvasW, canvasH);
      ctx.drawImage(imgIn, -canvasW * (1 - ep), 0, canvasW, canvasH);
      break;
    case "page_flip":
      if (ep < 0.5) {
        const scaleX = 1 - ep * 2;
        ctx.save();
        ctx.translate(canvasW / 2, 0);
        ctx.scale(scaleX, 1);
        ctx.translate(-canvasW / 2, 0);
        ctx.drawImage(imgOut, 0, 0, canvasW, canvasH);
        ctx.restore();
      } else {
        const scaleX = (ep - 0.5) * 2;
        ctx.save();
        ctx.translate(canvasW / 2, 0);
        ctx.scale(scaleX, 1);
        ctx.translate(-canvasW / 2, 0);
        ctx.drawImage(imgIn, 0, 0, canvasW, canvasH);
        ctx.restore();
      }
      break;
    case "cut":
    default:
      ctx.drawImage(ep < 0.5 ? imgOut : imgIn, 0, 0, canvasW, canvasH);
      break;
  }
}

async function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

export function useVideobookExport() {
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const cancelledRef = useRef(false);
  const ffmpegRef = useRef<FFmpeg | null>(null);
  const startTimeRef = useRef(0);

  const updateProgress = (phase: number, phaseLabel: string, percent: number, currentPage: number, totalPages: number) => {
    const elapsed = (Date.now() - startTimeRef.current) / 1000;
    const totalPercent = ((phase - 1) / 3 + percent / 100 / 3) * 100;
    const remaining = totalPercent > 0 ? (elapsed / totalPercent) * (100 - totalPercent) : 0;
    const mins = Math.floor(remaining / 60);
    const secs = Math.floor(remaining % 60);
    setProgress({
      phase, totalPhases: 3, phaseLabel, percent: Math.round(percent),
      currentPage, totalPages,
      estimatedRemaining: `~${mins}m ${secs}s restantes`,
    });
  };

  const exportVideobook = useCallback(async (
    pages: Page[],
    projectId: string,
    projectName: string,
    resolution: "720p" | "1080p" = "720p"
  ) => {
    cancelledRef.current = false;
    setExporting(true);
    setResultBlob(null);
    startTimeRef.current = Date.now();

    const canvasW = resolution === "1080p" ? 1920 : 1280;
    const canvasH = resolution === "1080p" ? 1080 : 720;
    const FPS = 30;
    const TRANSITION_DURATION = 0.5;

    const eligible = pages
      .filter(p => p.image_url && p.audiobook_audio_url && p.audiobook_audio_duration_seconds && p.audiobook_audio_duration_seconds > 0)
      .sort((a, b) => a.page_number - b.page_number);

    if (eligible.length === 0) {
      setExporting(false);
      throw new Error("Nenhuma página com imagem e áudio para exportar.");
    }

    try {
      // Init ffmpeg
      const ffmpeg = new FFmpeg();
      ffmpegRef.current = ffmpeg;

      const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm";
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
      });

      const canvas = document.createElement("canvas");
      canvas.width = canvasW;
      canvas.height = canvasH;
      const ctx = canvas.getContext("2d")!;

      let globalFrameIndex = 0;
      const audioFiles: string[] = [];

      // Phase 1: Render frames
      for (let pi = 0; pi < eligible.length; pi++) {
        if (cancelledRef.current) throw new Error("Cancelado");
        const page = eligible[pi];
        const img = await loadImage(page.image_url!);
        const audioDuration = page.audiobook_audio_duration_seconds!;

        // Parse regions
        let regions: Region[] = [];
        let pageBaseAnimation = "static";
        let transition = "fade";
        try {
          const vr = typeof page.video_regions === "string" ? JSON.parse(page.video_regions as string) : page.video_regions;
          if (vr) {
            regions = vr.regions || [];
            pageBaseAnimation = vr.page_base_animation || "static";
            transition = vr.suggested_transition || page.video_transition || "fade";
          }
        } catch {}

        const totalFrames = Math.ceil(audioDuration * FPS);

        for (let f = 0; f < totalFrames; f++) {
          if (cancelledRef.current) throw new Error("Cancelado");
          const currentTime = f / FPS;
          renderFrame(ctx, img, regions, currentTime, pageBaseAnimation, canvasW, canvasH, audioDuration);

          const blob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), "image/png"));
          const data = new Uint8Array(await blob.arrayBuffer());
          const frameName = `frame_${String(globalFrameIndex).padStart(6, "0")}.png`;
          await ffmpeg.writeFile(frameName, data);
          globalFrameIndex++;

          if (f % 10 === 0) {
            updateProgress(1, "Renderizando frames", ((pi + f / totalFrames) / eligible.length) * 100, pi + 1, eligible.length);
          }
        }

        // Transition frames to next page
        if (pi < eligible.length - 1) {
          const nextImg = await loadImage(eligible[pi + 1].image_url!);
          const transFrames = Math.ceil(TRANSITION_DURATION * FPS);
          for (let tf = 0; tf < transFrames; tf++) {
            if (cancelledRef.current) throw new Error("Cancelado");
            renderTransition(ctx, img, nextImg, tf / transFrames, transition, canvasW, canvasH);
            const blob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), "image/png"));
            const data = new Uint8Array(await blob.arrayBuffer());
            const frameName = `frame_${String(globalFrameIndex).padStart(6, "0")}.png`;
            await ffmpeg.writeFile(frameName, data);
            globalFrameIndex++;
          }
        }

        // Fetch audio
        const audioFileName = `audio_${pi}.mp3`;
        const audioData = await fetchFile(page.audiobook_audio_url!);
        await ffmpeg.writeFile(audioFileName, audioData);
        audioFiles.push(audioFileName);

        updateProgress(1, "Renderizando frames", ((pi + 1) / eligible.length) * 100, pi + 1, eligible.length);
      }

      // Phase 2: Concat audio
      updateProgress(2, "Processando áudio", 0, 0, 0);
      if (cancelledRef.current) throw new Error("Cancelado");

      const concatList = audioFiles.map(f => `file '${f}'`).join("\n");
      await ffmpeg.writeFile("audiolist.txt", new TextEncoder().encode(concatList));
      await ffmpeg.exec(["-f", "concat", "-safe", "0", "-i", "audiolist.txt", "-c", "copy", "audio_total.mp3"]);

      updateProgress(2, "Processando áudio", 100, 0, 0);

      // Phase 3: Encode video
      updateProgress(3, "Montando vídeo final", 0, 0, 0);
      if (cancelledRef.current) throw new Error("Cancelado");

      await ffmpeg.exec([
        "-r", String(FPS),
        "-i", "frame_%06d.png",
        "-i", "audio_total.mp3",
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "22",
        "-c:a", "aac",
        "-b:a", "128k",
        "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
        "-shortest",
        "videobook_final.mp4",
      ]);

      updateProgress(3, "Montando vídeo final", 80, 0, 0);

      const outputData = await ffmpeg.readFile("videobook_final.mp4");
      const videoBlob = new Blob([new Uint8Array(outputData as ArrayBuffer)], { type: "video/mp4" });
      setResultBlob(videoBlob);

      // Upload to storage
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const filePath = `${session.user.id}/${projectId}/videobook.mp4`;
          await supabase.storage.from("videobook-final").upload(filePath, videoBlob, { upsert: true, contentType: "video/mp4" });
          const { data: urlData } = supabase.storage.from("videobook-final").getPublicUrl(filePath);
          if (urlData?.publicUrl) {
            await supabase.from("projects").update({ videobook_url: urlData.publicUrl }).eq("id", projectId);
          }
        }
      } catch (e) {
        console.warn("Upload failed, video still available locally", e);
      }

      updateProgress(3, "Concluído!", 100, 0, 0);

      // Cleanup
      canvas.width = 0;
      canvas.height = 0;
    } catch (err: any) {
      if (err.message === "Cancelado") {
        setExporting(false);
        setProgress(null);
        return;
      }
      throw err;
    } finally {
      setExporting(false);
    }
  }, []);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
  }, []);

  const downloadResult = useCallback(() => {
    if (!resultBlob) return;
    const url = URL.createObjectURL(resultBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "videobook.mp4";
    a.click();
    URL.revokeObjectURL(url);
  }, [resultBlob]);

  return { exporting, progress, resultBlob, exportVideobook, cancel, downloadResult };
}
