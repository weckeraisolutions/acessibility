import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Play, Film } from "lucide-react";
import ChapterEditorDialog from "./ChapterEditorDialog";
import type { Tables } from "@/integrations/supabase/types";
import type { ChapterRow } from "@/hooks/useChapters";

type Page = Tables<"pages">;

interface Props {
  chapters: ChapterRow[];
  pages: Page[];
  onCreate: (data: { title: string; start_page: number; end_page: number }) => Promise<any>;
  onUpdate: (id: string, patch: Partial<ChapterRow>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onOpen: (chapter: ChapterRow) => void;
}

const statusVariant = (s: string) => {
  if (s === "ready") return "default";
  if (s === "processing") return "secondary";
  if (s === "error") return "destructive";
  return "outline";
};
const statusLabel = (s: string) => ({ draft: "Rascunho", processing: "Processando", ready: "Pronto", error: "Erro" } as any)[s] || s;

const ChapterListPanel = ({ chapters, pages, onCreate, onUpdate, onDelete, onOpen }: Props) => {
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<ChapterRow | null>(null);

  const handleNew = () => { setEditing(null); setEditorOpen(true); };
  const handleEdit = (c: ChapterRow) => { setEditing(c); setEditorOpen(true); };

  const handleSubmit = async (data: { title: string; start_page: number; end_page: number }) => {
    if (editing) {
      await onUpdate(editing.id, data);
    } else {
      await onCreate(data);
    }
  };

  if (chapters.length === 0) {
    return (
      <>
        <div className="flex flex-col items-center justify-center py-16 border-2 border-dashed border-border rounded-lg bg-muted/20">
          <Film className="h-12 w-12 text-muted-foreground mb-3" />
          <h3 className="text-lg font-semibold mb-1">Nenhum capítulo definido</h3>
          <p className="text-sm text-muted-foreground mb-4">Defina capítulos para organizar e exportar seu Videobook.</p>
          <Button onClick={handleNew}>
            <Plus className="h-4 w-4 mr-1" /> Definir Capítulos
          </Button>
        </div>
        <ChapterEditorDialog open={editorOpen} onOpenChange={setEditorOpen} pages={pages} editing={editing} onSubmit={handleSubmit} />
      </>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Capítulos do Videobook</h2>
        <Button onClick={handleNew} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Novo Capítulo
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {chapters.map(c => (
          <Card key={c.id} className="overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base leading-tight">{c.title}</CardTitle>
                <Badge variant={statusVariant(c.videobook_status)}>{statusLabel(c.videobook_status)}</Badge>
              </div>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Páginas {c.start_page}–{c.end_page} ({c.end_page - c.start_page + 1} págs)
            </CardContent>
            <CardFooter className="flex gap-2 pt-0">
              <Button size="sm" className="flex-1" onClick={() => onOpen(c)}>
                <Play className="h-4 w-4 mr-1" /> Abrir
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleEdit(c)}>
                <Edit className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onDelete(c.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      <ChapterEditorDialog open={editorOpen} onOpenChange={setEditorOpen} pages={pages} editing={editing} onSubmit={handleSubmit} />
    </div>
  );
};

export default ChapterListPanel;