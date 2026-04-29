import { useState, useRef, useCallback } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronDown, Zap, Sparkles, Play, Square, ShieldCheck } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { VOICES } from "@/constants/voices";
import { ElevenLabsVoice } from "@/constants/elevenlabs-voices";
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
  ttsEngine: TtsEngine;
  onTtsEngineChange: (engine: TtsEngine) => void;
  canUseElevenlabs: boolean;
  elevenlabsVoices: ElevenLabsVoice[];
  selectedElevenlabsVoice: string;
  onElevenlabsVoiceChange: (voiceId: string) => void;
  narrationSpeed: string;
  onNarrationSpeedChange: (v: string) => void;
  userPlan?: string;
  enableDualValidation?: boolean;
  onEnableDualValidationChange?: (v: boolean) => void;
}

const placeholders: Record<string, string> = {
  audiobook: "Ex: Ritmo fluido e contínuo, dicção clara e precisa, adequada para o público deste livro",
  audiodesc: "Ex: Objetivo e preciso, do geral para o específico, verbos no presente",
};

const GlobalConfigPanel = ({
  mode, style, voice, onStyleChange, onVoiceChange,
  pages, project, onPageUpdate,
  ttsEngine, onTtsEngineChange, canUseElevenlabs,
  elevenlabsVoices, selectedElevenlabsVoice, onElevenlabsVoiceChange,
  narrationSpeed, onNarrationSpeedChange,
  userPlan, enableDualValidation, onEnableDualValidationChange,
}: GlobalConfigPanelProps) => {
  const [open, setOpen] = useState(true);
  const { toast } = useToast();
  const extractor = useTextExtractor();
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);

  const handlePreviewVoice = useCallback((voiceId: string, previewUrl?: string) => {
    if (!previewUrl) return;
    if (playingVoiceId === voiceId && previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
      setPlayingVoiceId(null);
      return;
    }
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
    }
    const audio = new Audio(previewUrl);
    audio.onended = () => { setPlayingVoiceId(null); previewAudioRef.current = null; };
    audio.play().catch(() => {});
    previewAudioRef.current = audio;
    setPlayingVoiceId(voiceId);
  }, [playingVoiceId]);

  const handleStartExtraction = async () => {
    const results = await extractor.extractAll(pages, mode, project, onPageUpdate);
    toast({
      title: "Extração concluída",
      description: `${results.extracted} extraídas, ${results.noContent} sem conteúdo, ${results.errors} com erro`,
    });
  };

  const isElevenlabs = ttsEngine === "elevenlabs";
  const isEnterprise = (userPlan || "").toLowerCase() === "enterprise";
  const showDualValidation = mode === "audiodesc";

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
                ✨ ElevenLabs {!canUseElevenlabs && "(API Key não configurada)"}
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
            <ScrollArea className="mt-1 max-h-48 border rounded-md">
              <div className="p-1 space-y-0.5">
                {elevenlabsVoices.map((v) => (
                  <div
                    key={v.voice_id}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-sm transition-colors ${selectedElevenlabsVoice === v.voice_id ? "bg-primary/10 font-medium" : "hover:bg-accent"}`}
                    onClick={() => onElevenlabsVoiceChange(v.voice_id)}
                  >
                    {v.preview_url && (
                      <button
                        type="button"
                        className="shrink-0 h-6 w-6 flex items-center justify-center rounded-full border hover:bg-accent"
                        onClick={(e) => { e.stopPropagation(); handlePreviewVoice(v.voice_id, v.preview_url); }}
                      >
                        {playingVoiceId === v.voice_id ? <Square className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                      </button>
                    )}
                    <span className="truncate">{v.name} — {v.description}</span>
                    {selectedElevenlabsVoice === v.voice_id && <Badge variant="secondary" className="ml-auto text-[9px] shrink-0">selecionada</Badge>}
                  </div>
                ))}
              </div>
            </ScrollArea>
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

        {isElevenlabs && (
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Velocidade de Narração</Label>
            <Select value={narrationSpeed} onValueChange={onNarrationSpeedChange}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pausada">🐢 Pausada — ideal para conteúdo complexo</SelectItem>
                <SelectItem value="educativo">📚 Ritmo educativo — padrão recomendado</SelectItem>
                <SelectItem value="fluente">⚡ Fluente — narração contínua</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

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

        {showDualValidation && (
          <div className="rounded-lg border border-border/60 bg-muted/30 p-3 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
                  <Label className="text-sm font-semibold">Validação Dupla por IA</Label>
                  <Badge className="bg-amber-500 text-white border-0 text-[10px]">Exclusivo Enterprise</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Toda audiodescrição passa por auditoria automática com GPT-4o, garantindo conformidade
                  com ABNT NBR 16452, Lei 13.146/2015 e manual IBC. Inclui correção automática de
                  violações detectadas.
                </p>
                <p className="text-[10px] text-muted-foreground/80 mt-1">≈ R$0,03 por página validada</p>
              </div>
              <div className="shrink-0 pt-1">
                {isEnterprise ? (
                  <Switch
                    checked={!!enableDualValidation}
                    onCheckedChange={(v) => onEnableDualValidationChange?.(v)}
                  />
                ) : (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-block">
                          <Switch checked={false} disabled />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>Disponível no plano Enterprise</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            </div>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
};

export default GlobalConfigPanel;
