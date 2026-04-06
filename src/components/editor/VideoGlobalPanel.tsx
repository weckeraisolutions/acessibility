import { useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ChevronDown, Crosshair, Play, Download, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface VideoGlobalPanelProps {
  visualStyle: string;
  transition: string;
  outputFormat: string;
  onVisualStyleChange: (v: string) => void;
  onTransitionChange: (v: string) => void;
  onOutputFormatChange: (v: string) => void;
}

const TRANSITIONS = [
  { value: "fade", label: "Fade" },
  { value: "slide_left", label: "Slide esquerda" },
  { value: "slide_right", label: "Slide direita" },
  { value: "flip", label: "Virar página" },
  { value: "cut", label: "Corte direto" },
];

const FORMATS = [
  { value: "16:9_single", label: "Uma página 16:9" },
  { value: "16:9_double", label: "Duas páginas 16:9" },
  { value: "centered", label: "Página centralizada com bordas" },
];

const VideoGlobalPanel = ({ visualStyle, transition, outputFormat, onVisualStyleChange, onTransitionChange, onOutputFormatChange }: VideoGlobalPanelProps) => {
  const [open, setOpen] = useState(true);
  const { toast } = useToast();
  const placeholder = () => toast({ title: "Em breve", description: "Funcionalidade será implementada." });

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border rounded-lg bg-card mb-4">
      <CollapsibleTrigger className="flex items-center justify-between w-full p-4 hover:bg-accent/50 rounded-t-lg">
        <span className="font-semibold text-sm">🎬 Configuração Global — Videobook</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </CollapsibleTrigger>
      <CollapsibleContent className="p-4 pt-0 space-y-4">
        <div>
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Estilo Visual Global</Label>
          <Textarea
            rows={3}
            value={visualStyle}
            onChange={(e) => onVisualStyleChange(e.target.value)}
            placeholder="Ex: Câmera suave com zoom gradual, transições elegantes, foco nos personagens durante falas"
            className="mt-1"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Transição Padrão</Label>
            <Select value={transition} onValueChange={onTransitionChange}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TRANSITIONS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Formato do Vídeo</Label>
            <Select value={outputFormat} onValueChange={onOutputFormatChange}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {FORMATS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={placeholder}><Crosshair className="h-4 w-4 mr-1" /> Detectar regiões em todas</Button>
          <Button variant="outline" onClick={placeholder}><Play className="h-4 w-4 mr-1" /> Preview do Videobook</Button>
          <Button onClick={placeholder}><Download className="h-4 w-4 mr-1" /> Exportar Videobook MP4</Button>
        </div>
        <Alert className="bg-accent/50 border-accent">
          <AlertTriangle className="h-4 w-4 text-accent-foreground" />
          <AlertDescription className="text-accent-foreground text-xs">
            A exportação pode levar entre 5 e 40 minutos. Mantenha esta aba aberta.
          </AlertDescription>
        </Alert>
      </CollapsibleContent>
    </Collapsible>
  );
};

export default VideoGlobalPanel;
