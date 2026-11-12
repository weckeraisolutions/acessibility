import { uploadFile, deleteProject } from "@/lib/storage";
import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Upload, FileText, X } from "lucide-react";

const bookTypes = [
  { value: "general", label: "Geral" },
  { value: "didactic", label: "Didático" },
  { value: "literary", label: "Literário" },
  { value: "technical", label: "Técnico" },
  { value: "children", label: "Infantil" },
];

function deriveProjectName(fileName: string): string {
  return fileName
    .replace(/\.pdf$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const NewProject = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [bookType, setBookType] = useState("general");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback((f: File) => {
    if (f.type !== "application/pdf") {
      toast({ title: "Formato inválido", description: "Apenas arquivos PDF são aceitos.", variant: "destructive" });
      return;
    }
    if (f.size > 100 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande", description: "Limite de 100MB.", variant: "destructive" });
      return;
    }
    setFile(f);
  }, [toast]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  }, [handleFile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !file) return;

    setUploading(true);
    setUploadProgress(0);
    let createdId: string | null = null;
    try {
      const projectName = deriveProjectName(file.name);
      const { data: project, error } = await supabase.from("projects").insert({
        user_id: user.id, name: projectName, book_title: projectName, book_type: bookType,
      }).select("id").single();
      if (error || !project) throw error || new Error("Não foi possível criar o projeto.");
      createdId = project.id;
      setUploadProgress(25);
      const ref = await uploadFile(file, { project_id: project.id, kind: "pdf", file_name: file.name });
      setUploadProgress(75);
      const { error: saveError } = await supabase.from("projects").update({ pdf_url: ref }).eq("id", project.id);
      if (saveError) throw saveError;
      setUploadProgress(100);
      toast({ title: "Projeto criado com sucesso!" });
      navigate(`/projeto/${project.id}`);
    } catch (error) {
      let cleanupFailed = false;
      if (createdId) await deleteProject(createdId).catch(() => { cleanupFailed = true; });
      toast({ title: "Não foi possível criar o projeto", description:
        (error instanceof Error ? error.message : "Tente novamente.") +
        (cleanupFailed ? " O projeto incompleto permanece no painel. Exclua-o para limpar os arquivos." : ""),
        variant: "destructive" });
    } finally { setUploading(false); }
  };

  const canSubmit = !!file && !uploading;

  return (
    <div className="app-shell">
      <header className="app-topbar">
        <div className="studio-container flex h-[72px] items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <span className="text-lg font-semibold">Novo Projeto</span>
        </div>
      </header>

      <main className="studio-container py-10 md:py-16">
        <div className="mx-auto mb-8 max-w-[720px]"><span className="app-eyebrow">Novo projeto</span><h1 className="mt-2 text-3xl font-semibold tracking-tight">Comece pelo livro</h1><p className="mt-2 text-muted-foreground">Envie o PDF e confirme o tipo de conteúdo. O sistema prepara a estrutura para revisão.</p></div>
        <form onSubmit={handleSubmit} className="app-panel mx-auto max-w-[720px] space-y-7 p-6 md:p-8">
          <div className="space-y-2">
            <Label htmlFor="book-type">Tipo do livro</Label>
            <Select value={bookType} onValueChange={setBookType} disabled={uploading}>
              <SelectTrigger id="book-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                {bookTypes.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Dropzone */}
          <div className="space-y-2">
            <Label htmlFor="file-input">Arquivo PDF *</Label>
            <div
              className={`relative min-h-64 rounded-2xl border border-dashed p-8 text-center transition-colors cursor-pointer flex items-center justify-center ${
                dragOver ? "border-primary bg-primary/5" : "border-input hover:border-primary/50"
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
            >
              <input
                id="file-input"
                type="file"
                accept=".pdf"
                aria-label="Selecionar arquivo PDF"
                disabled={uploading}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0 focus:opacity-100 focus:bg-background focus:p-8"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
              {file ? (
                <div className="flex items-center justify-center gap-3">
                  <FileText className="h-8 w-8 text-primary" />
                  <div className="text-left">
                    <p className="break-all text-sm font-medium">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="relative z-10 h-11 w-11 shrink-0"
                    aria-label="Remover arquivo selecionado"
                    disabled={uploading}
                    onClick={(e) => { e.stopPropagation(); setFile(null); const input = document.getElementById("file-input") as HTMLInputElement; input.value = ""; }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary"><Upload className="h-6 w-6" /></span>
                  <p className="font-medium">Arraste seu PDF aqui</p>
                  <p className="text-sm text-muted-foreground">ou clique para selecionar o arquivo</p>
                  <p className="text-xs text-muted-foreground">Máximo 100 MB · o nome do projeto será extraído do arquivo</p>
                </div>
              )}
            </div>
          </div>

          {uploading && (
            <div className="space-y-2" role="status" aria-live="polite">
              <Progress value={uploadProgress} aria-label="Etapas do envio" />
              <p className="text-sm text-center text-muted-foreground">Concluindo etapas do envio. Mantenha esta página aberta.</p>
            </div>
          )}

          <Button type="submit" className="min-h-12 w-full rounded-full" disabled={!canSubmit}>
            {uploading ? "Criando projeto..." : "Criar Projeto"}
          </Button>
        </form>
      </main>
    </div>
  );
};

export default NewProject;
