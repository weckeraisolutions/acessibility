import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Logo from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

const NewProject = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [bookTitle, setBookTitle] = useState("");
  const [bookType, setBookType] = useState("general");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = (f: File) => {
    if (f.type !== "application/pdf") {
      toast({ title: "Formato inválido", description: "Apenas arquivos PDF são aceitos.", variant: "destructive" });
      return;
    }
    if (f.size > 100 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande", description: "Limite de 100MB.", variant: "destructive" });
      return;
    }
    setFile(f);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !file || !name.trim()) return;

    setUploading(true);
    setUploadProgress(10);

    // Create project first to get ID
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .insert({
        user_id: user.id,
        name: name.trim(),
        book_title: bookTitle.trim() || null,
        book_type: bookType,
      })
      .select("id")
      .single();

    if (projectError || !project) {
      toast({ title: "Erro ao criar projeto", description: projectError?.message, variant: "destructive" });
      setUploading(false);
      return;
    }

    setUploadProgress(40);

    // Upload PDF
    const filePath = `${user.id}/${project.id}/original.pdf`;
    const { error: uploadError } = await supabase.storage
      .from("pdfs")
      .upload(filePath, file);

    if (uploadError) {
      toast({ title: "Erro no upload", description: uploadError.message, variant: "destructive" });
      setUploading(false);
      return;
    }

    setUploadProgress(80);

    // Update project with pdf_url
    await supabase
      .from("projects")
      .update({ pdf_url: filePath })
      .eq("id", project.id);

    setUploadProgress(100);
    toast({ title: "Projeto criado com sucesso!" });
    navigate(`/projeto/${project.id}`);
  };

  const canSubmit = name.trim() && file && !uploading;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container flex h-16 items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <h1 className="text-lg font-semibold">Novo Projeto</h1>
        </div>
      </header>

      <main className="container py-8">
        <form onSubmit={handleSubmit} className="mx-auto max-w-[600px] space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">Nome do projeto *</Label>
            <Input id="name" placeholder="Ex: Raízes do Saber 5º Ano" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bookTitle">Título do livro</Label>
            <Input id="bookTitle" placeholder="Ex: Raízes do Saber — Conhecendo Nossas Histórias" value={bookTitle} onChange={(e) => setBookTitle(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Tipo do livro</Label>
            <Select value={bookType} onValueChange={setBookType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {bookTypes.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Dropzone */}
          <div className="space-y-2">
            <Label>Arquivo PDF *</Label>
            <div
              className={`relative rounded-lg border-2 border-dashed p-8 text-center transition-colors cursor-pointer ${
                dragOver ? "border-primary bg-primary/5" : "border-input hover:border-primary/50"
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => document.getElementById("file-input")?.click()}
            >
              <input
                id="file-input"
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
              {file ? (
                <div className="flex items-center justify-center gap-3">
                  <FileText className="h-8 w-8 text-primary" />
                  <div className="text-left">
                    <p className="text-sm font-medium">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={(e) => { e.stopPropagation(); setFile(null); }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="h-10 w-10 mx-auto text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Arraste seu PDF aqui ou clique para selecionar</p>
                  <p className="text-xs text-muted-foreground">Máximo 100MB</p>
                </div>
              )}
            </div>
          </div>

          {uploading && (
            <div className="space-y-2">
              <Progress value={uploadProgress} />
              <p className="text-sm text-center text-muted-foreground">Enviando arquivo...</p>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={!canSubmit}>
            {uploading ? "Criando projeto..." : "Criar Projeto"}
          </Button>
        </form>
      </main>
    </div>
  );
};

export default NewProject;
