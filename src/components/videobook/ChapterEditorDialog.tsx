import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import PageGridSelector from "./PageGridSelector";
import type { Tables } from "@/integrations/supabase/types";
import type { ChapterRow } from "@/hooks/useChapters";

type Page = Tables<"pages">;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pages: Page[];
  editing?: ChapterRow | null;
  onSubmit: (data: { title: string; start_page: number; end_page: number }) => Promise<void> | void;
}

const ChapterEditorDialog = ({ open, onOpenChange, pages, editing, onSubmit }: Props) => {
  const [title, setTitle] = useState("");
  const [start, setStart] = useState(1);
  const [end, setEnd] = useState(1);

  const total = pages.length;

  useEffect(() => {
    if (open) {
      setTitle(editing?.title ?? `Capítulo ${editing ? "" : ""}`.trim() || "Capítulo");
      setStart(editing?.start_page ?? 1);
      setEnd(editing?.end_page ?? Math.min(total, 1));
    }
  }, [open, editing, total]);

  const handleSingleChapter = () => {
    setTitle("Capítulo Único");
    setStart(1);
    setEnd(total);
  };

  const handleSave = async () => {
    await onSubmit({ title: title.trim() || "Sem título", start_page: start, end_page: end });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar capítulo" : "Novo capítulo"}</DialogTitle>
          <DialogDescription>Defina título e intervalo de páginas. Capítulos não podem se sobrepor.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="chapter-title">Título do capítulo</Label>
            <Input id="chapter-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Capítulo 1 — Raízes do Saber" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Página inicial</Label>
              <Input type="number" min={1} max={total} value={start} onChange={(e) => setStart(Math.max(1, Math.min(total, parseInt(e.target.value) || 1)))} />
            </div>
            <div>
              <Label>Página final</Label>
              <Input type="number" min={1} max={total} value={end} onChange={(e) => setEnd(Math.max(1, Math.min(total, parseInt(e.target.value) || 1)))} />
            </div>
          </div>

          {!editing && (
            <Button type="button" variant="outline" size="sm" onClick={handleSingleChapter}>
              Capítulo Único (todas as {total} páginas)
            </Button>
          )}

          <div>
            <Label className="text-xs text-muted-foreground">Selecione clicando em duas páginas (início e fim):</Label>
            <PageGridSelector pages={pages} startPage={start} endPage={end} onChange={(s, e) => { setStart(s); setEnd(e); }} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!title.trim() || start > end}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ChapterEditorDialog;