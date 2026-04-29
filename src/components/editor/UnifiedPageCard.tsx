import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tables } from "@/integrations/supabase/types";
import { ElevenLabsVoice } from "@/constants/elevenlabs-voices";
import { TtsEngine } from "@/components/editor/GlobalConfigPanel";
import AudioPageCard from "@/components/editor/AudioPageCard";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ShieldCheck } from "lucide-react";
import { useState } from "react";
import ValidationReportDialog from "@/components/editor/ValidationReportDialog";

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
  const [reportOpen, setReportOpen] = useState(false);
  const validated = (page as any).audiodesc_validated as boolean | undefined;
  const score = (page as any).audiodesc_validation_score as number | null | undefined;
  const violations = ((page as any).audiodesc_validation_violations as any[] | null | undefined) || [];
  const textOriginal = (page as any).audiodesc_text_original as string | null | undefined;
  const wasCorrected = !!(textOriginal && textOriginal !== page.audiodesc_text);

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
      <div className="rounded-lg border-l-4 border-l-[hsl(217_91%_60%)] bg-[hsl(217_91%_60%/0.04)] p-1.5">
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
      </div>

      {/* Audio description block */}
      <div className="rounded-lg border-l-4 border-l-[hsl(280_70%_60%)] bg-[hsl(280_70%_60%/0.04)] p-1.5">
      {validated && (
        <div className="px-1.5 pt-1.5 pb-0.5">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => setReportOpen(true)}
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border transition-opacity hover:opacity-80 ${
                    wasCorrected
                      ? "bg-blue-500/15 text-blue-600 border-blue-500/40 dark:text-blue-400"
                      : "bg-emerald-500/15 text-emerald-600 border-emerald-500/40 dark:text-emerald-400"
                  }`}
                >
                  <ShieldCheck className="h-3 w-3" />
                  {wasCorrected ? "Validado e ajustado por IA" : "Validado por IA"}
                  {typeof score === "number" && <span>— Score {score}/100</span>}
                </button>
              </TooltipTrigger>
              <TooltipContent>
                {wasCorrected
                  ? "Texto ajustado pela auditoria GPT-4o para conformidade com normas. Clique para ver violações corrigidas."
                  : "Aprovado em auditoria automática GPT-4o conforme NBR 16452:2016"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )}
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
      <ValidationReportDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        score={typeof score === "number" ? score : null}
        wasCorrected={wasCorrected}
        textOriginal={textOriginal || null}
        textFinal={page.audiodesc_text || ""}
        violations={violations}
      />
    </div>
  );
};

export default UnifiedPageCard;