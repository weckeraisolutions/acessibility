import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RotateCw, Play, Download, Check, RefreshCw, Loader2 } from "lucide-react";
import { Tables } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { VOICES } from "@/constants/voices";
import { ELEVENLABS_VOICES } from "@/constants/elevenlabs-voices";
import { useDebounce } from "@/hooks/useDebounce";
import { useToast } from "@/hooks/use-toast";
import { useTextExtractor } from "@/hooks/useTextExtractor";

type Page = Tables<"pages">;
type Project = Tables<"projects">;

interface AudioPageCardProps {
  page: Page;
  mode: "audiobook" | "audiodesc";
  globalVoice: string;
  project: Project;
  apiKey: string;
  onUpdate: (pageId: string, fields: Partial<Page>) => void;
  useElevenlabs?: boolean;
  elevenlabsVoiceId?: string;
  elevenlabsModel?: string;
  plan?: string;
}

function getStatus(page: Page, mode: "audiobook" | "audiodesc") {
  const status = mode === "audiobook" ? page.audiobook_status : page.audiodesc_status;
  const audio = mode === "audiobook" ? page.audiobook_audio_url : page.audiodesc_audio_url;
  const text = mode === "audiobook" ? page.audiobook_text : page.audiodesc_text;
  if (status === "approved") return { label: "✅ Aprovado", color: "bg-green-500" };
  if (status === "no_content") return { label: "⬜ Sem conteúdo", color: "bg-muted-foreground/40" };
  if (status === "audio_generated" || audio) return { label: "🔊 Áudio gerado", color: "bg-orange-500" };
  if (text) return { label: "📝 Texto extraído", color: "bg-blue-500" };
  return { label: "○ Pendente", color: "bg-muted-foreground/40" };
}

const AudioPageCard = ({ page, mode, globalVoice, project, apiKey, onUpdate, useElevenlabs, elevenlabsVoiceId, elevenlabsModel, plan }: AudioPageCardProps) => {
  const text = mode === "audiobook" ? page.audiobook_text : page.audiodesc_text;
  const audioUrl = mode === "audiobook" ? page.audiobook_audio_url : page.audiodesc_audio_url;
  const pageVoice = mode === "audiobook" ? page.audiobook_voice : page.audiodesc_voice;
  const pageStyle = mode === "audiobook" ? page.audiobook_style : page.audiodesc_style;
  const status = getStatus(page, mode);
  const { toast } = useToast();
  const extractor = useTextExtractor();

  const [localText, setLocalText] = useState(text || "");
  const [localStyle, setLocalStyle] = useState(pageStyle || "");
  const [extracting, setExtracting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showRegen, setShowRegen] = useState(false);
  const [regenStyle, setRegenStyle] = useState("");

  useEffect(() => { setLocalText(text || ""); }, [text]);
  useEffect(() => { setLocalStyle(pageStyle || ""); }, [pageStyle]);

  const textField = mode === "audiobook" ? "audiobook_text" : "audiodesc_text";
  const styleField = mode === "audiobook" ? "audiobook_style" : "audiodesc_style";
  const voiceField = mode === "audiobook" ? "audiobook_voice" : "audiodesc_voice";
  const statusField = mode === "audiobook" ? "audiobook_status" : "audiodesc_status";
  const audioUrlField = mode === "audiobook" ? "audiobook_audio_url" : "audiodesc_audio_url";
  const durationField = mode === "audiobook" ? "audiobook_audio_duration_seconds" : "audiodesc_audio_duration_seconds";

  const debouncedSaveText = useDebounce((val: string) => {
    onUpdate(page.id, { [textField]: val || null });
  }, 2000);

  const debouncedSaveStyle = useDebounce((val: string) => {
    onUpdate(page.id, { [styleField]: val || null });
  }, 2000);

  const handleTextChange = (val: string) => {
    setLocalText(val);
    debouncedSaveText(val);
  };

  const handleStyleChange = (val: string) => {
    setLocalStyle(val);
    debouncedSaveStyle(val);
  };

  const handleExtractSingle = async () => {
    if (!apiKey) {
      toast({ title: "Chave necessária", description: "Insira a chave da API Gemini no painel global primeiro.", variant: "destructive" });
      return;
    }
    setExtracting(true);
    const ok = await extractor.extractSingle(page, mode, project, apiKey, onUpdate);
    setExtracting(false);
    if (ok) {
      toast({ title: "Texto extraído", description: `Página ${page.page_number} processada.` });
    } else {
      toast({ title: "Erro", description: "Falha ao extrair texto desta página.", variant: "destructive" });
    }
  };

  const currentVoice = pageVoice || globalVoice;
  const isCustomVoice = !!pageVoice && pageVoice !== globalVoice;

  const globalStyle = mode === "audiobook" ? project.audiobook_global_style : project.audiodesc_global_style;

  const handleGenerateAudio = async (extraStyle?: string) => {
    if (!apiKey) {
      toast({ title: "Chave necessária", description: "Insira a chave da API Gemini no painel global primeiro.", variant: "destructive" });
      return;
    }
    if (!localText.trim()) return;

    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-audio", {
        body: {
          page_id: page.id,
          project_id: project.id,
          page_number: page.page_number,
          text: localText,
          voice: currentVoice,
          global_style: globalStyle || "",
          page_style: extraStyle || localStyle || "",
          mode,
          plan: plan || "free",
          gemini_api_key: apiKey,
          use_elevenlabs: useElevenlabs || false,
          elevenlabs_voice_id: elevenlabsVoiceId || "",
          elevenlabs_model: elevenlabsModel || "eleven_multilingual_v2",
        },
      });

      if (error || !data?.success) {
        const msg = data?.message || error?.message || "Erro ao gerar áudio";
        toast({ title: "Erro", description: msg, variant: "destructive" });
        return;
      }

      onUpdate(page.id, {
        [audioUrlField]: data.audio_url,
        [statusField]: "audio_generated",
        [durationField]: data.duration_seconds,
        [voiceField]: currentVoice,
        [styleField]: extraStyle || localStyle || null,
      });

      toast({ title: "Áudio gerado", description: `Página ${page.page_number} — ${data.duration_seconds}s` });
      setShowRegen(false);
      setRegenStyle("");
    } catch (e) {
      toast({ title: "Erro", description: "Falha na geração de áudio.", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async () => {
    if (!audioUrl) return;
    try {
      const res = await fetch(audioUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const pageNum = String(page.page_number).padStart(3, "0");
      a.download = `pagina_${pageNum}_${mode}.mp3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Erro", description: "Falha ao baixar o áudio.", variant: "destructive" });
    }
  };

  const handleApprove = () => {
    onUpdate(page.id, { [statusField]: "approved" });
    toast({ title: "Aprovado", description: `Página ${page.page_number} aprovada.` });
  };

  const handleRegen = () => {
    handleGenerateAudio(regenStyle);
  };

  return (
    <Card className="overflow-hidden">
      <div className="relative bg-muted aspect-[3/4] flex items-center justify-center">
        {(page.thumbnail_url || page.image_url) ? (
          <img src={page.thumbnail_url || page.image_url || ""} alt={`Página ${page.page_number}`} className="w-full h-full object-contain" />
        ) : (
          <span className="text-muted-foreground text-sm">Sem imagem</span>
        )}
        <Badge className={`absolute top-2 right-2 text-[10px] ${status.color} text-white border-0`}>
          {status.label}
        </Badge>
        <span className="absolute bottom-2 left-2 text-xs bg-background/80 rounded px-1.5 py-0.5">
          Página {page.page_number}
        </span>
      </div>

      <CardContent className="p-3 space-y-3">
        <div>
          <Textarea
            rows={8}
            value={localText}
            onChange={(e) => handleTextChange(e.target.value)}
            placeholder="Texto ainda não extraído. Clique em Extrair para processar."
          />
          <Button
            variant="outline"
            size="sm"
            className="mt-1 w-full"
            onClick={handleExtractSingle}
            disabled={extracting}
          >
            {extracting ? (
              <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Extraindo...</>
            ) : (
              <><RotateCw className="h-3 w-3 mr-1" /> Extrair esta página</>
            )}
          </Button>
        </div>

        <div>
          <div className="flex items-center gap-2">
            <Label className="text-xs">Voz:</Label>
            {useElevenlabs && <Badge variant="secondary" className="text-[10px]">✨ ElevenLabs</Badge>}
            {!useElevenlabs && isCustomVoice && <Badge variant="secondary" className="text-[10px]">✏️ Personalizada</Badge>}
          </div>
          {useElevenlabs ? (
            <Select
              value={elevenlabsVoiceId || ""}
              disabled
            >
              <SelectTrigger className="mt-1 h-8 text-xs">
                <SelectValue placeholder={ELEVENLABS_VOICES.find(v => v.voice_id === elevenlabsVoiceId)?.name || "Voz ElevenLabs"} />
              </SelectTrigger>
              <SelectContent>
                {ELEVENLABS_VOICES.map((v) => (
                  <SelectItem key={v.voice_id} value={v.voice_id}>{v.name} — {v.description}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Select
              value={currentVoice}
              onValueChange={(v) => onUpdate(page.id, { [voiceField]: v === globalVoice ? null : v })}
            >
              <SelectTrigger className="mt-1 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VOICES.map((v) => (
                  <SelectItem key={v.value} value={v.value}>{v.label} — {v.description}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div>
          <Label className="text-xs">Estilo:</Label>
          <Input
            value={localStyle}
            onChange={(e) => handleStyleChange(e.target.value)}
            placeholder="Herda configuração global se vazio"
            className="mt-1 h-8 text-xs"
          />
        </div>

        <div className="space-y-2">
          <Button
            size="sm"
            className="w-full"
            disabled={!localText.trim() || generating}
            onClick={() => handleGenerateAudio()}
          >
            {generating ? (
              <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Gerando...</>
            ) : (
              <><Play className="h-3 w-3 mr-1" /> Gerar Áudio</>
            )}
          </Button>

          {audioUrl && (
            <>
              <audio controls src={audioUrl} className="w-full h-8" />
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={handleDownload}>
                  <Download className="h-3 w-3 mr-1" /> MP3
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={handleApprove}
                >
                  <Check className="h-3 w-3 mr-1" /> Aprovar
                </Button>
              </div>
              {!showRegen ? (
                <Button variant="ghost" size="sm" className="w-full" onClick={() => setShowRegen(true)}>
                  <RefreshCw className="h-3 w-3 mr-1" /> Regerar com ajuste
                </Button>
              ) : (
                <div className="space-y-1">
                  <Input
                    value={regenStyle}
                    onChange={(e) => setRegenStyle(e.target.value)}
                    placeholder="Ex: mais lento, tom grave..."
                    className="h-8 text-xs"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1" onClick={handleRegen} disabled={generating || !regenStyle.trim()}>
                      {generating ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                      Regerar
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => { setShowRegen(false); setRegenStyle(""); }}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default AudioPageCard;
