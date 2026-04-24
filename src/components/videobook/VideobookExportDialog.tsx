import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Download, Play, AlertTriangle } from "lucide-react";
import { useChapterVideoExport } from "@/hooks/useChapterVideoExport";
import type { Tables } from "@/integrations/supabase/types";
import type { ChapterRow } from "@/hooks/useChapters";
import { toast } from "sonner";

type Page = Tables<"pages"> & { image_hd_url?: string | null };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chapter: ChapterRow;
  pages: Page[];
  projectName: string;
  flipbookContainer?: HTMLElement | null;
}

const VideobookExportDialog = ({ open, onOpenChange, chapter, pages, projectName, flipbookContainer }: Props) => {
  const [resolution, setResolution] = useState<"1080p" | "4k">("1080p");
  const [layout, setLayout] = useState<"single" | "double">((chapter.videobook_layout as any) || "single");
  const [confirmed, setConfirmed] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const { exporting, progress, resultBlob, exportChapter, cancel, downloadResult } = useChapterVideoExport();

  useEffect(() => {
    if (resultBlob) {
      const u = URL.createObjectURL(resultBlob);
      setVideoUrl(u);
      return () => URL.revokeObjectURL(u);
    }
  }, [resultBlob]);

  const handleStart = async () => {
    setConfirmed(true);
    try {
      await exportChapter(chapter, pages, projectName, {
        resolution,
        layout,
        interpreterMode: chapter.interpreter_mode,
        interpreterVideoUrl: chapter.interpreter_video_url,
        flipbookContainer,
      });
      toast.success("Videobook exportado!");
    } catch (e: any) {
      if (e.message !== "Cancelado") toast.error("Erro: " + e.message);
    }
  };

  const handleClose = () => {
    if (exporting) return;
    setConfirmed(false);
    onOpenChange(false);
  };

  const eligible = pages.filter(p => p.page_number >= chapter.start_page && p.page_number <= chapter.end_page && (p.image_hd_url || p.image_url) && p.audiobook_audio_url);
  const overall = progress ? ((progress.phase - 1) / progress.totalPhases + progress.percent / 100 / progress.totalPhases) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg" onPointerDownOutside={(e) => exporting && e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Gerar Videobook — {chapter.title}</DialogTitle>
          <DialogDescription>{!confirmed && `${eligible.length} páginas elegíveis.`}</DialogDescription>
        </DialogHeader>

        {!confirmed && !resultBlob && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-muted-foreground">
                Renderização ocorre no navegador. Mantenha esta aba aberta. <strong>4K</strong> pode levar 30–60min.
              </p>
            </div>

            <div>
              <Label className="text-xs">Resolução</Label>
              <Select value={resolution} onValueChange={(v) => setResolution(v as "1080p" | "4k")}>
                <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1080p">Full HD (1920×1080)</SelectItem>
                  <SelectItem value="4k">4K UHD (3840×2160)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Layout do flipbook</Label>
              <Select value={layout} onValueChange={(v) => setLayout(v as any)}>
                <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">1 página por vez</SelectItem>
                  <SelectItem value="double">2 páginas (modo livro)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={handleClose}>Cancelar</Button>
              <Button onClick={handleStart} disabled={eligible.length === 0}>
                <Play className="h-4 w-4 mr-1" /> Iniciar
              </Button>
            </div>
          </div>
        )}

        {exporting && progress && (
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-sm font-medium">Fase {progress.phase}/{progress.totalPhases}: {progress.phaseLabel}</p>
              {progress.currentPage > 0 && (
                <p className="text-xs text-muted-foreground mt-1">Página {progress.currentPage}/{progress.totalPages}</p>
              )}
            </div>
            <Progress value={overall} className="h-3" />
            <p className="text-xs text-muted-foreground text-center">
              {Math.round(overall)}% total • ~{Math.ceil(progress.etaSec / 60)}min restantes
            </p>
            <Button variant="destructive" size="sm" className="w-full" onClick={cancel}>Cancelar</Button>
          </div>
        )}

        {!exporting && resultBlob && videoUrl && (
          <div className="space-y-4">
            <video src={videoUrl} controls className="w-full rounded-lg" />
            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => downloadResult(`${projectName}_${chapter.title}_${resolution}.mp4`)}>
                <Download className="h-4 w-4 mr-1" /> Baixar MP4
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