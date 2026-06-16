import { useState, useCallback, useMemo } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tables } from "@/integrations/supabase/types";
import { Region } from "./animation-types";
import AnimationCanvas from "./AnimationCanvas";
import AnimationRegionPanel from "./AnimationRegionPanel";
import AnimationTimeline from "./AnimationTimeline";
import { Play } from "lucide-react";

type Page = Tables<"pages">;

interface AnimationEditorDialogProps {
  page: Page;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (pageId: string, fields: Partial<Page>) => void;
}

function parseVideoRegions(page: Page): { regions: Region[]; pageBaseAnimation: string; suggestedTransition: string } {
  try {
    const data = typeof page.video_regions === "string" ? JSON.parse(page.video_regions) : page.video_regions;
    if (data && data.regions) {
      return {
        regions: data.regions as Region[],
        pageBaseAnimation: data.page_base_animation || "ken_burns",
        suggestedTransition: data.suggested_transition || "fade",
      };
    }
  } catch (e) {
    console.error("Failed to parse video regions", e);
  }
  return { regions: [], pageBaseAnimation: "ken_burns", suggestedTransition: "fade" };
}

const AnimationEditorDialog = ({ page, open, onOpenChange, onUpdate }: AnimationEditorDialogProps) => {
  const initial = useMemo(() => parseVideoRegions(page), [page]);
  const [regions, setRegions] = useState<Region[]>(initial.regions);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pageBaseAnimation, setPageBaseAnimation] = useState(initial.pageBaseAnimation);
  const [suggestedTransition, setSuggestedTransition] = useState(initial.suggestedTransition);
  const [drawingMode, setDrawingMode] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  const handleUpdateRegion = useCallback((id: string, fields: Partial<Region>) => {
    setRegions((prev) => prev.map((r) => (r.id === id ? { ...r, ...fields } : r)));
  }, []);

  const handleRemoveRegion = useCallback((id: string) => {
    setRegions((prev) => prev.filter((r) => r.id !== id));
    if (selectedId === id) setSelectedId(null);
  }, [selectedId]);

  const handleAddRegion = useCallback((region?: Region) => {
    const newRegion: Region = region || {
      id: `region_${Date.now()}`,
      label: "Nova região",
      type: "illustration",
      x: 0.1,
      y: 0.1,
      width: 0.2,
      height: 0.2,
      animation_suggestion: "none",
      priority: regions.length + 1,
      text_trigger: "",
      timestamp_start: 0,
      timestamp_end: 0,
    };
    setRegions((prev) => [...prev, newRegion]);
    setSelectedId(newRegion.id);
  }, [regions.length]);

  const handleSave = () => {
    const videoRegions = {
      regions,
      page_base_animation: pageBaseAnimation,
      suggested_transition: suggestedTransition,
    };
    onUpdate(page.id, {
      video_regions: videoRegions as unknown as Tables<"pages">["video_regions"],
      video_status: "configured",
      video_transition: suggestedTransition,
    });
    onOpenChange(false);
  };

  const handleTimestampChange = useCallback((id: string, timestamp_start: number) => {
    setRegions((prev) => prev.map((r) => {
      if (r.id !== id) return r;
      const duration = r.timestamp_end - r.timestamp_start;
      return { ...r, timestamp_start, timestamp_end: timestamp_start + duration };
    }));
  }, []);

  const totalDuration = page.audiobook_audio_duration_seconds || 30;
  const audioUrl = page.audiobook_audio_url;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-[95vw] h-[90vh] max-h-[90vh] p-0 flex flex-col">
        <DialogTitle className="sr-only">Editor de Animações</DialogTitle>
        <div className="flex items-center justify-between px-4 py-2 border-b">
          <h2 className="text-sm font-semibold">Editor de Animações — Página {page.page_number}</h2>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSave}>
              Salvar animações
            </Button>
          </div>
        </div>

        <div className="flex-1 grid grid-cols-[3fr_2fr] min-h-0 overflow-hidden">
          {/* Left: Canvas */}
          <div className="overflow-auto p-4">
            {page.image_url ? (
              <AnimationCanvas
                imageUrl={page.image_url}
                regions={regions}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onUpdateRegion={handleUpdateRegion}
                onAddRegion={handleAddRegion}
                drawingMode={drawingMode}
                onDrawingModeChange={setDrawingMode}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Sem imagem para esta página.
              </div>
            )}
          </div>

          {/* Right: Controls */}
          <div className="border-l overflow-hidden flex flex-col">
            <div className="flex-1 overflow-hidden">
              <AnimationRegionPanel
                regions={regions}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onUpdateRegion={handleUpdateRegion}
                onRemoveRegion={handleRemoveRegion}
                onAddRegion={() => handleAddRegion()}
                pageBaseAnimation={pageBaseAnimation}
                suggestedTransition={suggestedTransition}
                onBaseAnimChange={setPageBaseAnimation}
                onTransitionChange={setSuggestedTransition}
              />
            </div>
          </div>
        </div>

        {/* Timeline */}
        <AnimationTimeline
          regions={regions}
          selectedId={selectedId}
          totalDuration={totalDuration}
          audioUrl={audioUrl}
          onSelect={setSelectedId}
          onTimestampChange={handleTimestampChange}
        />
      </DialogContent>
    </Dialog>
  );
};

export default AnimationEditorDialog;
