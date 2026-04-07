import { useRef, useEffect, useCallback, useState } from "react";
import { Region, REGION_COLORS } from "./animation-types";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

interface AnimationCanvasProps {
  imageUrl: string;
  regions: Region[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onUpdateRegion: (id: string, fields: Partial<Region>) => void;
  onAddRegion: (region: Region) => void;
  drawingMode: boolean;
  onDrawingModeChange: (v: boolean) => void;
}

const HANDLE_SIZE = 8;

type DragState = {
  type: "move" | "resize";
  regionId: string;
  startMouseX: number;
  startMouseY: number;
  startRegion: { x: number; y: number; width: number; height: number };
  handle?: string;
} | {
  type: "draw";
  startX: number;
  startY: number;
} | null;

function getHandleAtPoint(
  mx: number, my: number, r: Region, cw: number, ch: number
): string | null {
  const rx = r.x * cw, ry = r.y * ch, rw = r.width * cw, rh = r.height * ch;
  const h = HANDLE_SIZE;
  const handles: Record<string, [number, number]> = {
    nw: [rx, ry], n: [rx + rw / 2, ry], ne: [rx + rw, ry],
    w: [rx, ry + rh / 2], e: [rx + rw, ry + rh / 2],
    sw: [rx, ry + rh], s: [rx + rw / 2, ry + rh], se: [rx + rw, ry + rh],
  };
  for (const [name, [hx, hy]] of Object.entries(handles)) {
    if (Math.abs(mx - hx) <= h && Math.abs(my - hy) <= h) return name;
  }
  return null;
}

function isInsideRegion(mx: number, my: number, r: Region, cw: number, ch: number) {
  const rx = r.x * cw, ry = r.y * ch, rw = r.width * cw, rh = r.height * ch;
  return mx >= rx && mx <= rx + rw && my >= ry && my <= ry + rh;
}

const AnimationCanvas = ({
  imageUrl, regions, selectedId, onSelect, onUpdateRegion, onAddRegion,
  drawingMode, onDrawingModeChange,
}: AnimationCanvasProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<DragState>(null);
  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 });
  const [drawRect, setDrawRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => {
      const img = imgRef.current;
      if (img && img.naturalWidth) {
        const cw = container.clientWidth;
        const ch = (img.naturalHeight / img.naturalWidth) * cw;
        setCanvasSize({ w: cw, h: ch });
      }
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  const handleImageLoad = useCallback(() => {
    const container = containerRef.current;
    const img = imgRef.current;
    if (!container || !img) return;
    const cw = container.clientWidth;
    const ch = (img.naturalHeight / img.naturalWidth) * cw;
    setCanvasSize({ w: cw, h: ch });
  }, []);

  // Draw regions
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || canvasSize.w === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasSize.w * dpr;
    canvas.height = canvasSize.h * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, canvasSize.w, canvasSize.h);

    // Draw current drawing rect
    if (drawRect) {
      ctx.fillStyle = "rgba(59, 130, 246, 0.2)";
      ctx.strokeStyle = "#3B82F6";
      ctx.lineWidth = 2;
      ctx.fillRect(drawRect.x, drawRect.y, drawRect.w, drawRect.h);
      ctx.strokeRect(drawRect.x, drawRect.y, drawRect.w, drawRect.h);
    }

    for (const r of regions) {
      const color = REGION_COLORS[r.type] || "#6B7280";
      const rx = r.x * canvasSize.w;
      const ry = r.y * canvasSize.h;
      const rw = r.width * canvasSize.w;
      const rh = r.height * canvasSize.h;
      const isSelected = r.id === selectedId;

      ctx.fillStyle = color + "33";
      ctx.fillRect(rx, ry, rw, rh);

      ctx.strokeStyle = isSelected ? "#ffffff" : color;
      ctx.lineWidth = isSelected ? 3 : 2;
      ctx.setLineDash(isSelected ? [6, 3] : []);
      ctx.strokeRect(rx, ry, rw, rh);
      ctx.setLineDash([]);

      // Label
      ctx.font = "bold 11px sans-serif";
      const textWidth = ctx.measureText(r.label).width;
      ctx.fillStyle = color + "CC";
      ctx.fillRect(rx, ry - 18, textWidth + 8, 18);
      ctx.fillStyle = "#ffffff";
      ctx.fillText(r.label, rx + 4, ry - 5);

      // Handles for selected
      if (isSelected) {
        const handles = [
          [rx, ry], [rx + rw / 2, ry], [rx + rw, ry],
          [rx, ry + rh / 2], [rx + rw, ry + rh / 2],
          [rx, ry + rh], [rx + rw / 2, ry + rh], [rx + rw, ry + rh],
        ];
        for (const [hx, hy] of handles) {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(hx - 4, hy - 4, 8, 8);
          ctx.strokeStyle = color;
          ctx.lineWidth = 1;
          ctx.strokeRect(hx - 4, hy - 4, 8, 8);
        }
      }
    }
  }, [regions, selectedId, canvasSize, drawRect]);

  const getCanvasCoords = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { mx: 0, my: 0 };
    const rect = canvas.getBoundingClientRect();
    return { mx: e.clientX - rect.left, my: e.clientY - rect.top };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const { mx, my } = getCanvasCoords(e);

    if (drawingMode) {
      dragRef.current = { type: "draw", startX: mx, startY: my };
      setDrawRect({ x: mx, y: my, w: 0, h: 0 });
      return;
    }

    // Check selected region handles first
    if (selectedId) {
      const selRegion = regions.find((r) => r.id === selectedId);
      if (selRegion) {
        const handle = getHandleAtPoint(mx, my, selRegion, canvasSize.w, canvasSize.h);
        if (handle) {
          dragRef.current = {
            type: "resize", regionId: selectedId, startMouseX: mx, startMouseY: my,
            startRegion: { x: selRegion.x, y: selRegion.y, width: selRegion.width, height: selRegion.height },
            handle,
          };
          return;
        }
      }
    }

    // Check click on any region (reverse order for z-index)
    for (let i = regions.length - 1; i >= 0; i--) {
      const r = regions[i];
      if (isInsideRegion(mx, my, r, canvasSize.w, canvasSize.h)) {
        onSelect(r.id);
        dragRef.current = {
          type: "move", regionId: r.id, startMouseX: mx, startMouseY: my,
          startRegion: { x: r.x, y: r.y, width: r.width, height: r.height },
        };
        return;
      }
    }
    onSelect(null);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const { mx, my } = getCanvasCoords(e);
    const drag = dragRef.current;
    if (!drag) {
      // Update cursor
      if (drawingMode) {
        if (canvasRef.current) canvasRef.current.style.cursor = "crosshair";
        return;
      }
      if (selectedId) {
        const selRegion = regions.find((r) => r.id === selectedId);
        if (selRegion) {
          const handle = getHandleAtPoint(mx, my, selRegion, canvasSize.w, canvasSize.h);
          if (handle) {
            const cursors: Record<string, string> = {
              nw: "nwse-resize", se: "nwse-resize", ne: "nesw-resize", sw: "nesw-resize",
              n: "ns-resize", s: "ns-resize", e: "ew-resize", w: "ew-resize",
            };
            if (canvasRef.current) canvasRef.current.style.cursor = cursors[handle] || "default";
            return;
          }
        }
      }
      for (let i = regions.length - 1; i >= 0; i--) {
        if (isInsideRegion(mx, my, regions[i], canvasSize.w, canvasSize.h)) {
          if (canvasRef.current) canvasRef.current.style.cursor = "move";
          return;
        }
      }
      if (canvasRef.current) canvasRef.current.style.cursor = "default";
      return;
    }

    if (drag.type === "draw") {
      const x = Math.min(drag.startX, mx);
      const y = Math.min(drag.startY, my);
      const w = Math.abs(mx - drag.startX);
      const h = Math.abs(my - drag.startY);
      setDrawRect({ x, y, w, h });
      return;
    }

    const dx = (mx - drag.startMouseX) / canvasSize.w;
    const dy = (my - drag.startMouseY) / canvasSize.h;

    if (drag.type === "move") {
      const newX = Math.max(0, Math.min(1 - drag.startRegion.width, drag.startRegion.x + dx));
      const newY = Math.max(0, Math.min(1 - drag.startRegion.height, drag.startRegion.y + dy));
      onUpdateRegion(drag.regionId, { x: newX, y: newY });
    } else if (drag.type === "resize" && drag.handle) {
      const s = drag.startRegion;
      let { x, y, width, height } = s;
      const h = drag.handle;
      if (h.includes("e")) { width = Math.max(0.02, s.width + dx); }
      if (h.includes("w")) { x = s.x + dx; width = Math.max(0.02, s.width - dx); }
      if (h.includes("s")) { height = Math.max(0.02, s.height + dy); }
      if (h.includes("n")) { y = s.y + dy; height = Math.max(0.02, s.height - dy); }
      x = Math.max(0, Math.min(1, x));
      y = Math.max(0, Math.min(1, y));
      width = Math.min(width, 1 - x);
      height = Math.min(height, 1 - y);
      onUpdateRegion(drag.regionId, { x, y, width, height });
    }
  };

  const handleMouseUp = () => {
    const drag = dragRef.current;
    if (drag?.type === "draw" && drawRect && drawRect.w > 5 && drawRect.h > 5) {
      const newRegion: Region = {
        id: `region_${Date.now()}`,
        label: "Nova região",
        type: "illustration",
        x: drawRect.x / canvasSize.w,
        y: drawRect.y / canvasSize.h,
        width: drawRect.w / canvasSize.w,
        height: drawRect.h / canvasSize.h,
        animation_suggestion: "none",
        priority: regions.length + 1,
        text_trigger: "",
        timestamp_start: 0,
        timestamp_end: 0,
      };
      onAddRegion(newRegion);
      onDrawingModeChange(false);
    }
    dragRef.current = null;
    setDrawRect(null);
  };

  return (
    <div ref={containerRef} className="relative w-full overflow-hidden bg-muted rounded-lg">
      <img
        ref={imgRef}
        src={imageUrl}
        alt="Página"
        onLoad={handleImageLoad}
        className="w-full block"
        draggable={false}
      />
      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0"
        style={{ width: canvasSize.w, height: canvasSize.h }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
      <Button
        variant={drawingMode ? "default" : "outline"}
        size="sm"
        className="absolute top-2 left-2 z-10"
        onClick={() => onDrawingModeChange(!drawingMode)}
      >
        <Plus className="h-4 w-4 mr-1" />
        {drawingMode ? "Desenhando..." : "Desenhar região"}
      </Button>
    </div>
  );
};

export default AnimationCanvas;
