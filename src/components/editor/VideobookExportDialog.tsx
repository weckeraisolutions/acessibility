import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Download, Play, AlertTriangle } from "lucide-react";
import { useVideobookExport } from "@/hooks/useVideobookExport";
import type { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";

type Page = Tables<"pages">;

interface VideobookExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pages: Page[];
  projectId: string;
  projectName: string;
}

const VideobookExportDialog = ({ open, onOpenChange, pages, projectId, projectName }: VideobookExportDialogProps) => {
  const [resolution, setResolution] = useState<"720p" | "1080p">("720p");
  const [confirmed, setConfirmed] = useState(false);
  const { exporting, progress, resultBlob, exportVideobook, cancel, downloadResult } = useVideobookExport();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (resultBlob) {
      const url = URL.createObjectURL(resultBlob);
      setVideoUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [resultBlob]);

  const handleStart = async () => {
    setConfirmed(true);
    try {
      await exportVideobook(pages, projectId, projectName, resolution);
      toast.success("Videobook exportado com sucesso!");
    } catch (e: unknown) {
      toast.error("Erro na exportação: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  const handleClose = () => {
    if (exporting) return;
    setConfirmed(false);
    setVideoUrl(null);
    onOpenChange(false);
  };

  const eligible = pages.filter(p => p.image_url && p.audiobook_audio_url && p.audiobook_audio_duration_seconds && p.audiobook_audio_duration_seconds > 0);
  const totalPercent = progress ? ((progress.phase - 1) / progress.totalPhases + progress.percent / 100 / progress.totalPhases) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg" onPointerDownOutside={e => { if (exporting) e.preventDefault(); }}>
        <DialogHeader>
          <DialogTitle>Exportar Videobook (MP4)</DialogTitle>
          <DialogDescription>
            {!confirmed && "Gere um vídeo completo com animações e transições."}
          </DialogDescription>
        </DialogHeader>

        {!confirmed && !resultBlob && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-muted-foreground">
                Este processo ocorre no seu navegador e pode levar entre 5 e 40 minutos dependendo do número de páginas. 
                Mantenha esta aba aberta e não minimize o navegador.
              </p>
            </div>

            <div className="text-sm text-muted-foreground">
              Páginas elegíveis: <strong>{eligible.length}</strong> de {pages.length}
            </div>

            <div>
              <Label className="text-xs">Resolução</Label>
              <Select value={resolution} onValueChange={(v) => setResolution(v as "720p" | "1080p")}>
                <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="720p">720p (1280×720) — mais rápido</SelectItem>
                  <SelectItem value="1080p">1080p (1920×1080) — maior qualidade</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={handleClose}>Cancelar</Button>
              <Button onClick={handleStart} disabled={eligible.length === 0}>
                <Play className="h-4 w-4 mr-1" /> Iniciar exportação
              </Button>
            </div>
          </div>
        )}

        {exporting && progress && (
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-sm font-medium">
                Fase {progress.phase}/{progress.totalPhases}: {progress.phaseLabel}
              </p>
              {progress.currentPage > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Página {progress.currentPage} de {progress.totalPages}
                </p>
              )}
            </div>
            <Progress value={totalPercent} className="h-3" />
            <p className="text-xs text-muted-foreground text-center">
              {progress.percent}% da fase atual • {progress.estimatedRemaining}
            </p>
            <Button variant="destructive" size="sm" className="w-full" onClick={cancel}>
              Cancelar exportação
            </Button>
          </div>
        )}

        {!exporting && resultBlob && videoUrl && (
          <div className="space-y-4">
            <video ref={videoRef} src={videoUrl} controls className="w-full rounded-lg" />
            <div className="flex gap-2">
              <Button className="flex-1" onClick={downloadResult}>
                <Download className="h-4 w-4 mr-1" /> Baixar Videobook (MP4)
              </Button>
              <Button variant="outline" onClick={handleClose}>Fechar</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default VideobookExportDialog;
