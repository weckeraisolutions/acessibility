import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tables } from "@/integrations/supabase/types";
import { ElevenLabsVoice } from "@/constants/elevenlabs-voices";
import { TtsEngine } from "@/components/editor/GlobalConfigPanel";
import AudioPageCard from "@/components/editor/AudioPageCard";

type Page = Tables<"pages">;
type Project = Tables<"projects">;

interface UnifiedPageCardProps {
  page: Page;
  project: Project;
  onUpdate: (pageId: string, fields: Partial<Page>) => void;
  narrationTtsEngine: TtsEngine;
  audiodescTtsEngine: TtsEngine;
  onNarrationTtsEngineChange: (engine: TtsEngine) => void;
  onAudiodescTtsEngineChange: (engine: TtsEngine) => void;
  canUseElevenlabs: boolean;
  elevenlabsVoices: ElevenLabsVoice[];
  selectedElevenlabsVoice: string;
  plan?: string;
  globalNarrationSpeed: string;
  pageNarrationSpeed: string | null;
  onPageNarrationSpeedChange: (v: string | null) => void;
}

/**
 * Renders a single page with BOTH narration (audiobook) and audio description (audiodesc)
 * stacked vertically. Reuses the existing AudioPageCard logic — no duplicated APIs or state.
 * The page image is rendered once at the top, shared by both sections.
 */
const UnifiedPageCard = ({
  page,
  project,
  onUpdate,
  narrationTtsEngine,
  audiodescTtsEngine,
  onNarrationTtsEngineChange,
  onAudiodescTtsEngineChange,
  canUseElevenlabs,
  elevenlabsVoices,
  selectedElevenlabsVoice,
  plan,
  globalNarrationSpeed,
  pageNarrationSpeed,
  onPageNarrationSpeedChange,
}: UnifiedPageCardProps) => {
  const audiobookStatus = page.audiobook_status;
  const audiodescStatus = page.audiodesc_status;

  return (
    <div className="space-y-2">
      {/* Shared image header */}
      <Card className="overflow-hidden">
        <div className="relative bg-muted aspect-[3/4] flex items-center justify-center">
          {(page.thumbnail_url || page.image_url) ? (
            <img
              src={page.thumbnail_url || page.image_url || ""}
              alt={`Página ${page.page_number}`}
              className="w-full h-full object-contain"
            />
          ) : (
            <span className="text-muted-foreground text-sm">Sem imagem</span>
          )}
          <span className="absolute bottom-2 left-2 text-xs bg-background/80 rounded px-1.5 py-0.5">
            Página {page.page_number}
          </span>
          <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
            <Badge className="text-[10px] bg-primary/80 text-white border-0">
              🔊 {audiobookStatus === "approved" ? "✅" : audiobookStatus === "audio_generated" ? "🎵" : "○"}
            </Badge>
            <Badge className="text-[10px] bg-secondary text-secondary-foreground border-0">
              🖼️ {audiodescStatus === "approved" ? "✅" : audiodescStatus === "audio_generated" ? "🎵" : "○"}
            </Badge>
          </div>
        </div>
      </Card>

      {/* Narration block */}
      <AudioPageCard
        page={page}
        mode="audiobook"
        globalVoice={project.audiobook_global_voice || "Zephyr"}
        project={project}
        onUpdate={onUpdate}
        ttsEngine={narrationTtsEngine}
        onTtsEngineChange={onNarrationTtsEngineChange}
        canUseElevenlabs={canUseElevenlabs}
        elevenlabsVoices={elevenlabsVoices}
        selectedElevenlabsVoice={selectedElevenlabsVoice}
        plan={plan}
        globalNarrationSpeed={globalNarrationSpeed}
        pageNarrationSpeed={pageNarrationSpeed}
        onPageNarrationSpeedChange={onPageNarrationSpeedChange}
        hideImage
        sectionTitle="🔊 Narração"
      />

      {/* Audio description block */}
      <AudioPageCard
        page={page}
        mode="audiodesc"
        globalVoice={project.audiodesc_global_voice || "Kore"}
        project={project}
        onUpdate={onUpdate}
        ttsEngine={audiodescTtsEngine}
        onTtsEngineChange={onAudiodescTtsEngineChange}
        canUseElevenlabs={canUseElevenlabs}
        elevenlabsVoices={elevenlabsVoices}
        selectedElevenlabsVoice={selectedElevenlabsVoice}
        plan={plan}
        globalNarrationSpeed={globalNarrationSpeed}
        pageNarrationSpeed={pageNarrationSpeed}
        onPageNarrationSpeedChange={onPageNarrationSpeedChange}
        hideImage
        sectionTitle="🖼️ Audiodescrição"
      />
    </div>
  );
};

export default UnifiedPageCard;