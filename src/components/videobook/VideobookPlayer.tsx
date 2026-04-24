import { useEffect, useMemo, useRef, useState, useImperativeHandle, useCallback, forwardRef } from "react";
import HTMLFlipBook from "react-pageflip";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, SkipBack, SkipForward, Maximize, BookOpen, Book, Loader2, AlertTriangle, RefreshCw } from "lucide-react";
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

type Status = "idle" | "preloading" | "ready" | "error";

const MIN_W = 240;
const MIN_H = 320;
const MAX_W_SINGLE = 600;

function formatTime(sec: number): string {
  if (!isFinite(sec)) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function preloadImage(src: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = src;
  });
}

const VideobookPlayer = forwardRef<VideobookPlayerHandle, Props>(({ pages, layout, onLayoutChange, onTimeUpdate, onPageChange }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const flipBookRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const accumulatedRef = useRef(0);

  const [currentIdx, setCurrentIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [audioTime, setAudioTime] = useState(0);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [dims, setDims] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [reloadKey, setReloadKey] = useState(0);

  const sortedPages = useMemo(
    () => [...pages].sort((a, b) => a.page_number - b.page_number),
    [pages],
  );
  const totalDuration = useMemo(
    () => sortedPages.reduce((s, p) => s + (Number(p.audiobook_audio_duration_seconds) || 0), 0),
    [sortedPages],
  );
  const imgs = useMemo(
    () => sortedPages.map(p => p.image_hd_url || p.image_url || "").filter(Boolean),
    [sortedPages],
  );
  const imgsKey = useMemo(() => imgs.join("|"), [imgs]);

  // ---- ResizeObserver with debounce ----
  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    let timer: number | null = null;

    const measure = () => {
      const rect = el.getBoundingClientRect();
      const availableW = rect.width;
      const availableH = Math.max(rect.height, 600);
      const targetW = layout === "double"
        ? Math.max(MIN_W, Math.min(availableW, 1200))
        : Math.max(MIN_W, Math.min(availableW, MAX_W_SINGLE));
      const pageW = layout === "double" ? Math.floor(targetW / 2) : targetW;
      const pageH = Math.max(MIN_H, Math.floor(pageW * 1.4));
      setDims((prev) => (prev.w === pageW && prev.h === pageH ? prev : { w: pageW, h: pageH }));
    };

    measure();
    const ro = new ResizeObserver(() => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(measure, 150);
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      if (timer) window.clearTimeout(timer);
    };
  }, [layout]);

  // ---- Preload images ----
  useEffect(() => {
    if (imgs.length === 0) {
      setStatus("idle");
      return;
    }
    let cancelled = false;
    setStatus("preloading");
    setErrorMsg("");
    Promise.all(imgs.map(preloadImage))
      .then(() => {
        if (!cancelled) setStatus("ready");
      })
      .catch((e) => {
        if (!cancelled) {
          setStatus("error");
          setErrorMsg(e instanceof Error ? e.message : "Falha ao pré-carregar imagens");
        }
      });
    return () => { cancelled = true; };
  }, [imgsKey, reloadKey]);

  // ---- Pause audio when layout flips (re-render of flipbook) ----
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      setPlaying(false);
    }
  }, [layout]);

  // ---- Load audio when page changes ----
  useEffect(() => {
    const a = audioRef.current;
    const page = sortedPages[currentIdx];
    if (!a || !page) return;
    const nextSrc = page.audiobook_audio_url || "";
    if (nextSrc && a.src !== nextSrc) {
      a.src = nextSrc;
      a.load();
      if (playing) a.play().catch(() => {});
    }
    accumulatedRef.current = sortedPages
      .slice(0, currentIdx)
      .reduce((s, p) => s + (Number(p.audiobook_audio_duration_seconds) || 0), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIdx, sortedPages]);

  // ---- Audio listeners ----
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => {
      setAudioTime(a.currentTime);
      onTimeUpdate?.(accumulatedRef.current + a.currentTime);
    };
    const onEnd = () => {
      if (flipBookRef.current && currentIdx < sortedPages.length - 1) {
        try { flipBookRef.current.pageFlip().flipNext(); } catch (e) { console.debug("[VideobookPlayer] flipNext err", e); }
      } else {
        setPlaying(false);
      }
    };
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("ended", onEnd);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("ended", onEnd);
    };
  }, [currentIdx, sortedPages.length, onTimeUpdate]);

  const handleFlip = useCallback((e: any) => {
    const idx = typeof e?.data === "number" ? e.data : 0;
    setCurrentIdx(idx);
    onPageChange?.(idx);
  }, [onPageChange]);

  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play().then(() => setPlaying(true)).catch(() => {});
    }
  }, [playing]);

  const handleFullscreen = useCallback(() => {
    containerRef.current?.requestFullscreen?.().catch(() => {});
  }, []);

  const flipPrev = useCallback(() => {
    try { flipBookRef.current?.pageFlip?.()?.flipPrev(); } catch (e) { console.debug("[VideobookPlayer] flipPrev err", e); }
  }, []);
  const flipNext = useCallback(() => {
    try { flipBookRef.current?.pageFlip?.()?.flipNext(); } catch (e) { console.debug("[VideobookPlayer] flipNext err", e); }
  }, []);

  const retry = useCallback(() => {
    setErrorMsg("");
    setStatus("idle");
    setReloadKey((k) => k + 1);
  }, []);

  useImperativeHandle(ref, () => ({
    getCurrentTime: () => accumulatedRef.current + (audioRef.current?.currentTime || 0),
    getTotalDuration: () => totalDuration,
    goToPage: (i: number) => {
      try { flipBookRef.current?.pageFlip?.()?.flip(i); } catch (e) { console.debug("[VideobookPlayer] goToPage err", e); }
    },
    flipNext,
    getContainer: () => containerRef.current,
  }), [totalDuration, flipNext]);

  const totalCurrent = accumulatedRef.current + audioTime;
  const pct = totalDuration > 0 ? (totalCurrent / totalDuration) * 100 : 0;

  const canRender = status === "ready" && dims.w >= MIN_W && dims.h >= MIN_H && imgs.length > 0;

  // react-pageflip requires re-mount when key dimension/layout/images change.
  // Using a stable key built from those inputs avoids partial-update bugs.
  const flipBookKey = `${layout}-${dims.w}x${dims.h}-${imgsKey.length}-${reloadKey}`;

  return (
    <div className="flex flex-col h-full">
      <div ref={containerRef} className="relative flex-1 min-w-[280px]" style={{ minHeight: 600 }}>
        {/* Status overlays */}
        {status === "preloading" && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm rounded-lg z-10">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando páginas...
            </div>
          </div>
        )}
        {status === "error" && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-lg z-10 p-4">
            <div className="flex flex-col items-center gap-3 text-sm text-center max-w-xs">
              <AlertTriangle className="h-6 w-6 text-destructive" />
              <p className="text-foreground font-medium">Não foi possível carregar o flipbook</p>
              <p className="text-muted-foreground text-xs">{errorMsg || "Erro desconhecido"}</p>
              <Button size="sm" variant="outline" onClick={retry}>
                <RefreshCw className="h-3 w-3 mr-1" /> Tentar novamente
              </Button>
            </div>
          </div>
        )}

        {/* Flipbook (only mounts when dimensions are valid + status ready) */}
        {canRender && (
          <div className="flex justify-center items-start h-full">
            <HTMLFlipBook
              key={flipBookKey}
              ref={flipBookRef}
              width={dims.w}
              height={dims.h}
              size={"fixed" as any}
              minWidth={MIN_W}
              maxWidth={1600}
              minHeight={MIN_H}
              maxHeight={2400}
              drawShadow
              flippingTime={700}
              usePortrait={layout === "single"}
              startZIndex={0}
              autoSize={false}
              maxShadowOpacity={0.4}
              showCover={false}
              mobileScrollSupport={false}
              swipeDistance={30}
              clickEventForward
              useMouseEvents
              disableFlipByClick={false}
              showPageCorners
              onFlip={handleFlip}
              className=""
              style={{}}
              startPage={0}
              renderOnlyPageLengthChange={false}
            >
              {imgs.map((src, i) => (
                <div key={i} className="bg-white">
                  <img src={src} alt={`Página ${i + 1}`} className="w-full h-full object-contain block" draggable={false} />
                </div>
              ))}
            </HTMLFlipBook>
          </div>
        )}
      </div>

      <audio ref={audioRef} preload="metadata" />

      <div className="mt-3 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground tabular-nums w-12">{formatTime(totalCurrent)}</span>
          <Slider value={[pct]} max={100} step={0.1} onValueChange={() => { /* seek not implemented */ }} className="flex-1" />
          <span className="text-xs text-muted-foreground tabular-nums w-12">{formatTime(totalDuration)}</span>
        </div>
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <Button size="sm" variant="ghost" disabled={!canRender} onClick={flipPrev}>
            <SkipBack className="h-4 w-4" />
          </Button>
          <Button size="sm" disabled={!canRender} onClick={togglePlay}>
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          <Button size="sm" variant="ghost" disabled={!canRender} onClick={flipNext}>
            <SkipForward className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground mx-2">Página {currentIdx + 1}/{sortedPages.length || 1}</span>
          {onLayoutChange && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onLayoutChange(layout === "single" ? "double" : "single")}
              title="Alternar layout 1↔2 páginas"
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

export default VideobookPlayer;
