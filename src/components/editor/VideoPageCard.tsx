import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Crosshair, Pencil, Loader2 } from "lucide-react";
import { Tables } from "@/integrations/supabase/types";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

type Page = Tables<"pages">;

interface VideoPageCardProps {
  page: Page;
  bookType: string;
  onUpdate: (pageId: string, fields: Partial<Page>) => void;
  onDetectSingle: (page: Page, bookType: string, onUpdate: (pageId: string, fields: Partial<Page>) => void) => Promise<boolean>;
}

const TRANSITIONS = ["fade", "slide_left", "slide_right", "flip", "cut"];
const TRANSITION_LABELS: Record<string, string> = {
  fade: "Fade",
  slide_left: "Slide esquerda",
  slide_right: "Slide direita",
  flip: "Virar página",
  cut: "Corte direto",
};

function getVideoStatus(page: Page) {
  if (page.video_status === "exported") return { label: "✅ Exportado", color: "bg-green-500" };
  if (page.video_status === "configured") return { label: "⚙️ Configurado", color: "bg-blue-500" };
  if (page.video_status === "regions_detected") return { label: "🎯 Regiões detectadas", color: "bg-orange-500" };
  if (page.video_regions) return { label: "🎯 Regiões detectadas", color: "bg-orange-500" };
  return { label: "○ Pendente", color: "bg-muted-foreground/40" };
}

const VideoPageCard = ({ page, bookType, onUpdate, onDetectSingle }: VideoPageCardProps) => {
  const status = getVideoStatus(page);
  const { toast } = useToast();
  const [detecting, setDetecting] = useState(false);
  const placeholderAction = () => toast({ title: "Em breve", description: "Funcionalidade será implementada." });

  const handleDetect = async () => {
    setDetecting(true);
    await onDetectSingle(page, bookType, onUpdate);
    setDetecting(false);
  };

  const regionsCount = (page.video_regions as any)?.regions?.length || 0;

  return (
    <Card className="overflow-hidden">
      <div className="relative bg-muted aspect-[16/9] flex items-center justify-center">
        {page.image_url ? (
          <img src={page.image_url} alt={`Página ${page.page_number}`} className="w-full h-full object-contain" />
        ) : (
          <span className="text-muted-foreground text-sm">Sem imagem</span>
        )}
        <Badge className={`absolute top-2 right-2 text-[10px] ${status.color} text-white border-0`}>
          {status.label}
        </Badge>
        <span className="absolute bottom-2 left-2 text-xs bg-background/80 rounded px-1.5 py-0.5">
          Página {page.page_number}
        </span>
        {regionsCount > 0 && (
          <span className="absolute bottom-2 right-2 text-xs bg-background/80 rounded px-1.5 py-0.5">
            {regionsCount} regiões
          </span>
        )}
      </div>
      <CardContent className="p-3 space-y-3">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={handleDetect} disabled={detecting}>
            {detecting ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Crosshair className="h-3 w-3 mr-1" />}
            {detecting ? "Detectando..." : "Detectar regiões"}
          </Button>
          <Button variant="outline" size="sm" className="flex-1" onClick={placeholderAction}>
            <Pencil className="h-3 w-3 mr-1" /> Editar animações
          </Button>
        </div>
        <div>
          <Label className="text-xs">Transição de saída:</Label>
          <Select
            value={page.video_transition || "fade"}
            onValueChange={(v) => onUpdate(page.id, { video_transition: v })}
          >
            <SelectTrigger className="mt-1 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TRANSITIONS.map((t) => (
                <SelectItem key={t} value={t}>{TRANSITION_LABELS[t]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
};

export default VideoPageCard;
