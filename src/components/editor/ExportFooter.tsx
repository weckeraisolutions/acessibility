import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Download, Plus, X, Loader2 } from "lucide-react";
import { useChapters } from "@/hooks/useChapters";
import { useZipDownload } from "@/hooks/useZipDownload";
import VideobookExportDialog from "./VideobookExportDialog";
import type { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";

type Page = Tables<"pages">;

interface ExportFooterProps {
  activeTab: string;
  totalPages: number;
  pages: Page[];
  projectName: string;
  projectId: string;
}

const ExportFooter = ({ activeTab, totalPages, pages, projectName, projectId }: ExportFooterProps) => {
  const { chapters, addChapter, removeChapter } = useChapters(projectId);
  const zip = useZipDownload();
  const [videobookExportOpen, setVideobookExportOpen] = useState(false);

  const [selectedChapter, setSelectedChapter] = useState("all");
  const [newName, setNewName] = useState("");
  const [newStart, setNewStart] = useState(1);
  const [newEnd, setNewEnd] = useState(totalPages);
  const [showConfig, setShowConfig] = useState(false);

  // For backward compatibility: legacy tabs ("audiobook"/"audiodesc") still work.
  // The new "unified" tab exports BOTH narration and audio description.
  const mode = activeTab === "audiodesc" ? "audiodesc" as const : "audiobook" as const;
  const isUnified = activeTab === "unified";

  const handleAddChapter = () => {
    if (!newName.trim()) { toast.error("Informe o nome do capítulo"); return; }
    if (newStart < 1 || newEnd > totalPages || newStart > newEnd) { toast.error("Intervalo inválido"); return; }
    addChapter(newName.trim(), newStart, newEnd);
    setNewName("");
  };

  const handleDownloadSelection = () => {
    if (selectedChapter === "all") {
      if (isUnified) {
        zip.downloadFullBook(pages, `${projectName}_narracao`, "audiobook", chapters.length ? chapters : undefined);
        zip.downloadFullBook(pages, `${projectName}_audiodescricao`, "audiodesc", chapters.length ? chapters : undefined);
      } else {
        zip.downloadFullBook(pages, projectName, mode, chapters.length ? chapters : undefined);
      }
    } else {
      const ch = chapters.find(c => c.id === selectedChapter);
      if (ch) {
        if (isUnified) {
          zip.downloadChapter(pages, `${projectName}_narracao`, ch.name, "audiobook", ch.startPage, ch.endPage);
          zip.downloadChapter(pages, `${projectName}_audiodescricao`, ch.name, "audiodesc", ch.startPage, ch.endPage);
        } else {
          zip.downloadChapter(pages, projectName, ch.name, mode, ch.startPage, ch.endPage);
        }
      }
    }
  };

  const handleDownloadFull = () => {
    if (isUnified) {
      zip.downloadFullBook(pages, `${projectName}_narracao`, "audiobook", chapters.length ? chapters : undefined);
      zip.downloadFullBook(pages, `${projectName}_audiodescricao`, "audiodesc", chapters.length ? chapters : undefined);
    } else {
      zip.downloadFullBook(pages, projectName, mode, chapters.length ? chapters : undefined);
    }
  };

  return (
    <>
      <footer className="border-t bg-card py-4">
        <div className="container flex flex-wrap items-center gap-4">
          {/* Chapter select */}
          <div className="flex items-center gap-2">
            <Label className="text-xs whitespace-nowrap">Capítulo:</Label>
            <Select value={selectedChapter} onValueChange={setSelectedChapter}>
              <SelectTrigger className="w-52 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Livro inteiro</SelectItem>
                {chapters.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} (págs {c.startPage}–{c.endPage})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowConfig(!showConfig)}>
              <Plus className="h-3 w-3" />
            </Button>
          </div>

          <Button variant="outline" size="sm" onClick={handleDownloadSelection} disabled={zip.downloading}>
            <Download className="h-3 w-3 mr-1" /> Baixar seleção (ZIP)
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownloadFull} disabled={zip.downloading}>
            <Download className="h-3 w-3 mr-1" /> Baixar livro inteiro (ZIP)
          </Button>
          {activeTab === "videobook" && (
            <Button size="sm" onClick={() => setVideobookExportOpen(true)}>
              <Download className="h-3 w-3 mr-1" /> Baixar Videobook Completo (MP4)
            </Button>
          )}
        </div>

        {/* Chapter config */}
        {showConfig && (
          <div className="container mt-3 border-t pt-3">
            <div className="flex flex-wrap items-end gap-2 mb-2">
              <div>
                <Label className="text-xs">Nome</Label>
                <Input className="h-8 w-40 text-xs" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Capítulo 1" />
              </div>
              <div>
                <Label className="text-xs">De</Label>
                <Input className="h-8 w-16 text-xs" type="number" min={1} max={totalPages} value={newStart} onChange={e => setNewStart(Number(e.target.value))} />
              </div>
              <div>
                <Label className="text-xs">Até</Label>
                <Input className="h-8 w-16 text-xs" type="number" min={1} max={totalPages} value={newEnd} onChange={e => setNewEnd(Number(e.target.value))} />
              </div>
              <Button size="sm" variant="secondary" onClick={handleAddChapter}>
                <Plus className="h-3 w-3 mr-1" /> Adicionar
              </Button>
            </div>
            {chapters.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {chapters.map(c => (
                  <div key={c.id} className="flex items-center gap-1 bg-muted rounded px-2 py-1 text-xs">
                    {c.name} ({c.startPage}–{c.endPage})
                    <button onClick={() => removeChapter(c.id)} className="ml-1 text-muted-foreground hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </footer>

      {/* Progress dialog */}
      <Dialog open={zip.downloading} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md" onPointerDownOutside={e => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Preparando download...</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Progress value={zip.progress} className="h-3" />
            <p className="text-sm text-muted-foreground text-center">
              {zip.currentFile} de {zip.totalFiles} arquivos
            </p>
            <Button variant="destructive" size="sm" className="w-full" onClick={zip.cancel}>
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <VideobookExportDialog
        open={videobookExportOpen}
        onOpenChange={setVideobookExportOpen}
        pages={pages}
        projectId={projectId}
        projectName={projectName}
      />
    </>
  );
};

export default ExportFooter;
