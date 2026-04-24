import { useEffect, useMemo, useRef, useState, useImperativeHandle, forwardRef } from "react";
import { PageFlip } from "page-flip";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, SkipBack, SkipForward, Maximize, BookOpen, Book, Loader2 } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Page = Tables<"pages"> & { image_hd_url?: string | null };

export interface VideobookPlayerHandle {
  getCurrentTime: () => number;
  getTotalDuration: () => number;
  goToPage: (i: number) => void;
  flipNext: () => void;
  getContainer: () => HTMLDivElement | null;
}

interface Props {
  pages: Page[];
  layout: "single" | "double";
  onLayoutChange?: (l: "single" | "double") => void;
  onTimeUpdate?: (t: number) => void;
  onPageChange?: (idx: number) => void;
}

const VideobookPlayer = forwardRef<VideobookPlayerHandle, Props>(({ pages, layout, onLayoutChange, onTimeUpdate, onPageChange }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const flipRef = useRef<PageFlip | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [audioTime, setAudioTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [reinitializing, setReinitializing] = useState(false);
  const accumulatedRef = useRef(0); // accumulated time of completed pages
  const lastImgsKeyRef = useRef<string>("");

  const sortedPages = useMemo(
    () => [...pages].sort((a, b) => a.page_number - b.page_number),
    [pages],
  );
  const totalDuration = useMemo(
    () => sortedPages.reduce((s, p) => s + (Number(p.audiobook_audio_duration_seconds) || 0), 0),
    [sortedPages],
  );
  const imgsKey = useMemo(
    () => sortedPages.map(p => p.image_hd_url || p.image_url || "").join("|"),
    [sortedPages],
  );

  // init flipbook
  useEffect(() => {
    if (!containerRef.current || sortedPages.length === 0) return;
    if (lastImgsKeyRef.current === imgsKey + "::" + layout) return;
    lastImgsKeyRef.current = imgsKey + "::" + layout;

    // Pause audio before destroying instance to avoid stale callbacks
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setPlaying(false);
    setReinitializing(true);

    // Destroy any previous instance immediately
    if (flipRef.current) {
      try { flipRef.current.destroy(); } catch {}
      flipRef.current = null;
    }

    const container = containerRef.current;
    const w = container.clientWidth;
    // In single layout, cap width to keep flipbook visually anchored to the left
    // and leave breathing room for the interpreter panel area.
    const pageW = layout === "double" ? Math.floor(w / 2) : Math.min(w, 600);
    const pageH = Math.floor(pageW * 1.4);

    const imgs = sortedPages.map(p => p.image_hd_url || p.image_url).filter(Boolean) as string[];

    // Preload images to avoid main-thread blocking inside loadFromImages
    const preload = (src: string) => new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = () => resolve();
      img.src = src;
    });

    let cancelled = false;
    let pf: PageFlip | null = null;

    Promise.all(imgs.map(preload)).then(() => {
      if (cancelled || !containerRef.current) return;
      // Defer to next tick to release main thread
      setTimeout(() => {
        if (cancelled || !containerRef.current) return;
        pf = new PageFlip(containerRef.current, {
      width: pageW,
      height: pageH,
      size: "stretch" as any,
      minWidth: 200,
      maxWidth: 1600,
      minHeight: 280,
      maxHeight: 2400,
      drawShadow: true,
      flippingTime: 800,
      usePortrait: layout === "single",
      autoSize: true,
      maxShadowOpacity: 0.4,
      showCover: false,
      mobileScrollSupport: false,
      swipeDistance: 30,
      clickEventForward: true,
      useMouseEvents: true,
      disableFlipByClick: false,
    } as any);
        flipRef.current = pf;
        pf.loadFromImages(imgs);
        pf.on("flip", (e: any) => {
          // Guard against stale events from destroyed instances
          if (flipRef.current !== pf) return;
          const idx = e.data as number;
          setCurrentIdx(idx);
          onPageChange?.(idx);
        });
        setReinitializing(false);
      }, 50);
    });

    return () => {
      cancelled = true;
      if (pf) {
        try { pf.destroy(); } catch {}
      }
      if (flipRef.current === pf) flipRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, imgsKey]);

  // load audio when page changes
  useEffect(() => {
    const page = sortedPages[currentIdx];
    if (!page || !audioRef.current) return;
    const nextSrc = page.audiobook_audio_url || "";
    if (nextSrc && audioRef.current.src !== nextSrc) {
      audioRef.current.src = nextSrc;
      audioRef.current.load();
      if (playing) audioRef.current.play().catch(() => {});
    }
    accumulatedRef.current = sortedPages
      .slice(0, currentIdx)
      .reduce((s, p) => s + (Number(p.audiobook_audio_duration_seconds) || 0), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIdx, sortedPages]);

  // audio listeners
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => {
      setAudioTime(a.currentTime);
      onTimeUpdate?.(accumulatedRef.current + a.currentTime);
    };
    const onMeta = () => setAudioDuration(a.duration || 0);
    const onEnd = () => {
      // auto-flip to next page
      if (flipRef.current && !reinitializing && currentIdx < sortedPages.length - 1) {
        flipRef.current.flipNext();
      } else {
        setPlaying(false);
      }
    };
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("ended", onEnd);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("ended", onEnd);
    };
  }, [currentIdx, sortedPages.length, onTimeUpdate, reinitializing]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play().then(() => setPlaying(true)).catch(() => {});
    }
  };

  const handleFullscreen = () => {
    containerRef.current?.requestFullscreen?.().catch(() => {});
  };

  useImperativeHandle(ref, () => ({
    getCurrentTime: () => accumulatedRef.current + (audioRef.current?.currentTime || 0),
    getTotalDuration: () => totalDuration,
    goToPage: (i: number) => flipRef.current?.flip(i),
    flipNext: () => flipRef.current?.flipNext(),
    getContainer: () => containerRef.current,
  }), [totalDuration]);

  const totalCurrent = accumulatedRef.current + audioTime;
  const pct = totalDuration > 0 ? (totalCurrent / totalDuration) * 100 : 0;

  return (
    <div className="flex flex-col h-full">
      <div className="relative flex-1">
        <div
          ref={containerRef}
          className="h-full bg-black/5 rounded-lg overflow-hidden mx-auto"
          style={{ minHeight: 400, maxWidth: layout === "single" ? 600 : "100%" }}
        />
        {reinitializing && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm rounded-lg z-10">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Reorganizando layout...
            </div>
          </div>
        )}
      </div>

      <audio ref={audioRef} preload="metadata" />

      <div className="mt-3 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground tabular-nums w-12">{formatTime(totalCurrent)}</span>
          <Slider value={[pct]} max={100} step={0.1} onValueChange={() => { /* seek not yet supported */ }} className="flex-1" />
          <span className="text-xs text-muted-foreground tabular-nums w-12">{formatTime(totalDuration)}</span>
        </div>
        <div className="flex items-center justify-center gap-2">
          <Button size="sm" variant="ghost" disabled={reinitializing} onClick={() => flipRef.current?.flipPrev()}>
            <SkipBack className="h-4 w-4" />
          </Button>
          <Button size="sm" disabled={reinitializing} onClick={togglePlay}>
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          <Button size="sm" variant="ghost" disabled={reinitializing} onClick={() => flipRef.current?.flipNext()}>
            <SkipForward className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground mx-2">Página {currentIdx + 1}/{sortedPages.length}</span>
          {onLayoutChange && (
            <Button
              size="sm"
              variant="outline"
              disabled={reinitializing}
              onClick={() => onLayoutChange(layout === "single" ? "double" : "single")}
              title="Alternar layout"
            >
              {layout === "single" ? <Book className="h-4 w-4" /> : <BookOpen className="h-4 w-4" />}
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={handleFullscreen}>
            <Maximize className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
});

VideobookPlayer.displayName = "VideobookPlayer";

function formatTime(sec: number): string {
  if (!isFinite(sec)) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default VideobookPlayer;