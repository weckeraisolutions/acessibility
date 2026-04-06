import { useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ChevronDown, Zap } from "lucide-react";
import { VOICES } from "@/constants/voices";
import { useToast } from "@/hooks/use-toast";

interface GlobalConfigPanelProps {
  mode: "audiobook" | "audiodesc";
  style: string;
  voice: string;
  onStyleChange: (v: string) => void;
  onVoiceChange: (v: string) => void;
}

const placeholders: Record<string, string> = {
  audiobook: "Ex: Ritmo fluido e contínuo, dicção clara e precisa, adequada para o público deste livro",
  audiodesc: "Ex: Objetivo e preciso, do geral para o específico, verbos no presente",
};

const GlobalConfigPanel = ({ mode, style, voice, onStyleChange, onVoiceChange }: GlobalConfigPanelProps) => {
  const [open, setOpen] = useState(true);
  const { toast } = useToast();

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border rounded-lg bg-card mb-4">
      <CollapsibleTrigger className="flex items-center justify-between w-full p-4 hover:bg-accent/50 rounded-t-lg">
        <span className="font-semibold text-sm">⚙️ Configuração Global — {mode === "audiobook" ? "Audiobook" : "Audiodescrição"}</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </CollapsibleTrigger>
      <CollapsibleContent className="p-4 pt-0 space-y-4">
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
          <Select value={voice} onValueChange={onVoiceChange}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VOICES.map((v) => (
                <SelectItem key={v.value} value={v.value}>
                  {v.label} — {v.description}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          variant="default"
          onClick={() => toast({ title: "Em breve", description: "Extração em lote será implementada." })}
        >
          <Zap className="h-4 w-4 mr-1" /> Extrair todos os textos
        </Button>
      </CollapsibleContent>
    </Collapsible>
  );
};

export default GlobalConfigPanel;
