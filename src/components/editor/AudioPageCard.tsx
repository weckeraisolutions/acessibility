import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RotateCw, Play, Download, Check, RefreshCw } from "lucide-react";
import { Tables } from "@/integrations/supabase/types";
import { VOICES } from "@/constants/voices";
import { useDebounce } from "@/hooks/useDebounce";
import { useToast } from "@/hooks/use-toast";

type Page = Tables<"pages">;

interface AudioPageCardProps {
  page: Page;
  mode: "audiobook" | "audiodesc";
  globalVoice: string;
  onUpdate: (pageId: string, fields: Partial<Page>) => void;
}

function getStatus(page: Page, mode: "audiobook" | "audiodesc") {
  const status = mode === "audiobook" ? page.audiobook_status : page.audiodesc_status;
  const text = mode === "audiobook" ? page.audiobook_text : page.audiodesc_text;
  const audio = mode === "audiobook" ? page.audiobook_audio_url : page.audiodesc_audio_url;
  if (status === "approved") return { label: "✅ Aprovado", color: "bg-green-500" };
  if (audio) return { label: "🔊 Áudio gerado", color: "bg-orange-500" };
  if (text) return { label: "📝 Texto extraído", color: "bg-blue-500" };
  return { label: "○ Pendente", color: "bg-muted-foreground/40" };
}

const AudioPageCard = ({ page, mode, globalVoice, onUpdate }: AudioPageCardProps) => {
  const text = mode === "audiobook" ? page.audiobook_text : page.audiodesc_text;
  const audioUrl = mode === "audiobook" ? page.audiobook_audio_url : page.audiodesc_audio_url;
  const pageVoice = mode === "audiobook" ? page.audiobook_voice : page.audiodesc_voice;
  const pageStyle = mode === "audiobook" ? page.audiobook_style : page.audiodesc_style;
  const status = getStatus(page, mode);
  const { toast } = useToast();

  const [localText, setLocalText] = useState(text || "");
  const [localStyle, setLocalStyle] = useState(pageStyle || "");

  useEffect(() => { setLocalText(text || ""); }, [text]);
  useEffect(() => { setLocalStyle(pageStyle || ""); }, [pageStyle]);

  const textField = mode === "audiobook" ? "audiobook_text" : "audiodesc_text";
  const styleField = mode === "audiobook" ? "audiobook_style" : "audiodesc_style";
  const voiceField = mode === "audiobook" ? "audiobook_voice" : "audiodesc_voice";
  const statusField = mode === "audiobook" ? "audiobook_status" : "audiodesc_status";

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

  const placeholderAction = () => toast({ title: "Em breve", description: "Funcionalidade será implementada." });

  const currentVoice = pageVoice || globalVoice;
  const isCustomVoice = !!pageVoice && pageVoice !== globalVoice;

  return (
    <Card className="overflow-hidden">
      {/* Image + status */}
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
        {/* Text */}
        <div>
          <Textarea
            rows={8}
            value={localText}
            onChange={(e) => handleTextChange(e.target.value)}
            placeholder="Texto ainda não extraído. Clique em Extrair para processar."
          />
          <Button variant="outline" size="sm" className="mt-1 w-full" onClick={placeholderAction}>
            <RotateCw className="h-3 w-3 mr-1" /> Extrair esta página
          </Button>
        </div>

        {/* Voice */}
        <div>
          <div className="flex items-center gap-2">
            <Label className="text-xs">Voz:</Label>
            {isCustomVoice && <Badge variant="secondary" className="text-[10px]">✏️ Personalizada</Badge>}
          </div>
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
        </div>

        {/* Style */}
        <div>
          <Label className="text-xs">Estilo:</Label>
          <Input
            value={localStyle}
            onChange={(e) => handleStyleChange(e.target.value)}
            placeholder="Herda configuração global se vazio"
            className="mt-1 h-8 text-xs"
          />
        </div>

        {/* Audio actions */}
        <div className="space-y-2">
          <Button
            size="sm"
            className="w-full"
            disabled={!localText.trim()}
            onClick={placeholderAction}
          >
            <Play className="h-3 w-3 mr-1" /> Gerar Áudio
          </Button>

          {audioUrl && (
            <>
              <audio controls src={audioUrl} className="w-full h-8" />
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" asChild>
                  <a href={audioUrl} download><Download className="h-3 w-3 mr-1" /> MP3</a>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => onUpdate(page.id, { [statusField]: "approved" })}
                >
                  <Check className="h-3 w-3 mr-1" /> Aprovar
                </Button>
              </div>
              <Button variant="ghost" size="sm" className="w-full" onClick={placeholderAction}>
                <RefreshCw className="h-3 w-3 mr-1" /> Regerar com ajuste
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default AudioPageCard;
