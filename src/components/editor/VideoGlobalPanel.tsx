import { useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { ChevronDown, Crosshair, Play, Download, AlertTriangle, Loader2, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Tables } from "@/integrations/supabase/types";

type Page = Tables<"pages">;

interface VideoGlobalPanelProps {
  visualStyle: string;
  transition: string;
  outputFormat: string;
  onVisualStyleChange: (v: string) => void;
  onTransitionChange: (v: string) => void;
  onOutputFormatChange: (v: string) => void;
  detecting: boolean;
  detectCurrentPage: number;
  detectTotalPages: number;
  onDetectAll: () => void;
  onCancelDetect: () => void;
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

const VideoGlobalPanel = ({
  visualStyle, transition, outputFormat,
  onVisualStyleChange, onTransitionChange, onOutputFormatChange,
  detecting, detectCurrentPage, detectTotalPages, onDetectAll, onCancelDetect,
}: VideoGlobalPanelProps) => {
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

        {detecting ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                Detectando regiões: página {detectCurrentPage} de {detectTotalPages}
              </span>
              <span>{Math.round((detectCurrentPage / detectTotalPages) * 100)}%</span>
            </div>
            <Progress value={(detectCurrentPage / detectTotalPages) * 100} />
            <Button variant="outline" size="sm" onClick={onCancelDetect}>
              <X className="h-3 w-3 mr-1" /> Cancelar
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={onDetectAll}>
              <Crosshair className="h-4 w-4 mr-1" /> Detectar regiões em todas
            </Button>
            <Button variant="outline" onClick={placeholder}>
              <Play className="h-4 w-4 mr-1" /> Preview do Videobook
            </Button>
            <Button onClick={placeholder}>
              <Download className="h-4 w-4 mr-1" /> Exportar Videobook MP4
            </Button>
          </div>
        )}

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
