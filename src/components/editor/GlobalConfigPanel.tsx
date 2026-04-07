import { useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ChevronDown, Zap, Sparkles } from "lucide-react";
import { VOICES } from "@/constants/voices";
import { ELEVENLABS_VOICES } from "@/constants/elevenlabs-voices";
import { useToast } from "@/hooks/use-toast";
import { useTextExtractor } from "@/hooks/useTextExtractor";
import { Tables } from "@/integrations/supabase/types";

type Page = Tables<"pages">;
type Project = Tables<"projects">;

export type TtsEngine = "gemini" | "elevenlabs";

interface GlobalConfigPanelProps {
  mode: "audiobook" | "audiodesc";
  style: string;
  voice: string;
  onStyleChange: (v: string) => void;
  onVoiceChange: (v: string) => void;
  pages: Page[];
  project: Project;
  onPageUpdate: (pageId: string, fields: Partial<Page>) => void;
  useElevenlabs?: boolean;
  elevenlabsVoiceId?: string;
  ttsEngine: TtsEngine;
  onTtsEngineChange: (engine: TtsEngine) => void;
  canUseElevenlabs: boolean;
}

const placeholders: Record<string, string> = {
  audiobook: "Ex: Ritmo fluido e contínuo, dicção clara e precisa, adequada para o público deste livro",
  audiodesc: "Ex: Objetivo e preciso, do geral para o específico, verbos no presente",
};

const GlobalConfigPanel = ({
  mode, style, voice, onStyleChange, onVoiceChange,
  pages, project, onPageUpdate,
  useElevenlabs, elevenlabsVoiceId,
  ttsEngine, onTtsEngineChange, canUseElevenlabs,
}: GlobalConfigPanelProps) => {
  const [open, setOpen] = useState(true);
  const { toast } = useToast();
  const extractor = useTextExtractor();

  const handleStartExtraction = async () => {
    const results = await extractor.extractAll(pages, mode, project, onPageUpdate);
    toast({
      title: "Extração concluída",
      description: `${results.extracted} extraídas, ${results.noContent} sem conteúdo, ${results.errors} com erro`,
    });
  };

  const isElevenlabs = ttsEngine === "elevenlabs";

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border rounded-lg bg-card mb-4">
      <CollapsibleTrigger className="flex items-center justify-between w-full p-4 hover:bg-accent/50 rounded-t-lg">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">⚙️ Configuração Global — {mode === "audiobook" ? "Audiobook" : "Audiodescrição"}</span>
          {isElevenlabs && <Badge className="bg-amber-500 text-white border-0 text-[10px]"><Sparkles className="h-3 w-3 mr-1" /> ElevenLabs</Badge>}
        </div>
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </CollapsibleTrigger>
      <CollapsibleContent className="p-4 pt-0 space-y-4">
        {/* TTS Engine Selector */}
        <div>
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Motor de Voz (TTS)</Label>
          <Select value={ttsEngine} onValueChange={(v) => onTtsEngineChange(v as TtsEngine)}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="gemini">🤖 Google Gemini TTS</SelectItem>
              <SelectItem value="elevenlabs" disabled={!canUseElevenlabs}>
                ✨ ElevenLabs {!canUseElevenlabs && "(configure a API Key)"}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Estilo de Narração Global</Label>
          <Textarea
            rows={3}
            value={style}
            onChange={(e) => onStyleChange(e.target.value)}
            placeholder={placeholders[mode]}
            className="mt-1"
          />
        </div>
        <div>
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Voz Padrão Global</Label>
          {isElevenlabs ? (
            <Select value={elevenlabsVoiceId || ""} disabled>
              <SelectTrigger className="mt-1"><SelectValue placeholder={ELEVENLABS_VOICES.find(v => v.voice_id === elevenlabsVoiceId)?.name || "Voz ElevenLabs"} /></SelectTrigger>
              <SelectContent>
                {ELEVENLABS_VOICES.map((v) => (
                  <SelectItem key={v.voice_id} value={v.voice_id}>{v.name} — {v.description}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Select value={voice} onValueChange={onVoiceChange}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {VOICES.map((v) => (
                  <SelectItem key={v.value} value={v.value}>{v.label} — {v.description}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {extractor.extracting ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Extraindo página {extractor.currentPage} de {extractor.totalPages}...</span>
              <span>{Math.round((extractor.currentPage / extractor.totalPages) * 100)}%</span>
            </div>
            <Progress value={(extractor.currentPage / extractor.totalPages) * 100} />
          </div>
        ) : (
          <Button variant="default" onClick={handleStartExtraction}>
            <Zap className="h-4 w-4 mr-1" /> Extrair todos os textos
          </Button>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
};

export default GlobalConfigPanel;
