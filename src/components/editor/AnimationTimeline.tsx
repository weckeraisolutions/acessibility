import { useRef, useState, useEffect, useCallback } from "react";
import { Region, REGION_COLORS } from "./animation-types";
import { Button } from "@/components/ui/button";
import { Play, Square } from "lucide-react";

interface AnimationTimelineProps {
  regions: Region[];
  selectedId: string | null;
  totalDuration: number;
  audioUrl: string | null;
  onSelect: (id: string | null) => void;
  onTimestampChange: (id: string, timestamp_start: number) => void;
}

const AnimationTimeline = ({
  regions, selectedId, totalDuration, audioUrl, onSelect, onTimestampChange,
}: AnimationTimelineProps) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrent] = useState(0);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const rafRef = useRef<number>(0);
  const duration = totalDuration || 1;

  const updateTime = useCallback(() => {
    if (audioRef.current) {
      setCurrent(audioRef.current.currentTime);
    }
    if (playing) rafRef.current = requestAnimationFrame(updateTime);
  }, [playing]);

  useEffect(() => {
    if (playing) {
      rafRef.current = requestAnimationFrame(updateTime);
    }
    return () => cancelAnimationFrame(rafRef.current);
  }, [playing, updateTime]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play();
      setPlaying(true);
    }
  };

  const handleTrackClick = (e: React.MouseEvent) => {
    if (draggingId) return;
    const track = trackRef.current;
    if (!track || !audioRef.current) return;
    const rect = track.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audioRef.current.currentTime = pct * duration;
    setCurrent(pct * duration);
  };

  const handleMarkerDown = (e: React.MouseEvent, regionId: string) => {
    e.stopPropagation();
    setDraggingId(regionId);
    onSelect(regionId);

    const handleMove = (ev: MouseEvent) => {
      const track = trackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
      onTimestampChange(regionId, parseFloat((pct * duration).toFixed(1)));
    };
    const handleUp = () => {
      setDraggingId(null);
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleUp);
    };
    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleUp);
  };

  return (
    <div className="border-t bg-muted/50 px-4 py-3 space-y-2">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={togglePlay} disabled={!audioUrl} className="h-7 w-7 p-0">
          {playing ? <Square className="h-3 w-3" /> : <Play className="h-3 w-3" />}
        </Button>
        <span className="text-xs text-muted-foreground tabular-nums">
          {currentTime.toFixed(1)}s / {duration.toFixed(1)}s
        </span>
      </div>

      <div
        ref={trackRef}
        className="relative h-10 bg-background rounded border cursor-pointer"
        onClick={handleTrackClick}
      >
        {/* Playhead */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-destructive z-20 pointer-events-none"
          style={{ left: `${(currentTime / duration) * 100}%` }}
        />

        {/* Region markers */}
        {regions.map((r) => {
          const left = (r.timestamp_start / duration) * 100;
          const width = Math.max(((r.timestamp_end - r.timestamp_start) / duration) * 100, 1);
          const color = REGION_COLORS[r.type] || "#6B7280";
          return (
            <div
              key={r.id}
              className={`absolute top-1 bottom-1 rounded-sm cursor-grab active:cursor-grabbing z-10 ${
                r.id === selectedId ? "ring-2 ring-white" : ""
              }`}
              style={{
                left: `${left}%`,
                width: `${width}%`,
                backgroundColor: color + "88",
                minWidth: 6,
              }}
              onMouseDown={(e) => handleMarkerDown(e, r.id)}
              title={r.label}
            />
          );
        })}
      </div>

      {audioUrl && <audio ref={audioRef} src={audioUrl} onEnded={() => setPlaying(false)} />}
    </div>
  );
};

export default AnimationTimeline;
