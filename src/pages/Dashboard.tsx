import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Logo from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Plus, MoreVertical, FolderOpen, BookOpen } from "lucide-react";

interface Project {
  id: string;
  name: string;
  book_type: string;
  total_pages: number;
  created_at: string;
  processing_status: string;
}

const bookTypeLabels: Record<string, string> = {
  general: "Geral",
  didactic: "Didático",
  literary: "Literário",
  technical: "Técnico",
  children: "Infantil",
};

const filterTabs = [
  { value: "all", label: "Todos" },
  { value: "audiobook", label: "Audiobook" },
  { value: "audiodesc", label: "Audiodescrição" },
  { value: "videobook", label: "Videobook" },
];

const Dashboard = () => {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameName, setRenameName] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchProjects = async () => {
    const { data } = await supabase
      .from("projects")
      .select("id, name, book_type, total_pages, created_at, processing_status")
      .order("created_at", { ascending: false });
    setProjects(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleRename = async () => {
    if (!renameId || !renameName.trim()) return;
    await supabase.from("projects").update({ name: renameName }).eq("id", renameId);
    setRenameId(null);
    fetchProjects();
    toast({ title: "Projeto renomeado" });
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await supabase.from("projects").delete().eq("id", deleteId);
    setDeleteId(null);
    fetchProjects();
    toast({ title: "Projeto excluído" });
  };

  const planLabel = profile?.plan === "free" ? "Gratuito" : profile?.plan === "pro" ? "Pro" : profile?.plan || "Gratuito";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-card">
        <div className="container flex h-16 items-center justify-between">
          <Logo size="sm" />
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">{profile?.name}</span>
            <Badge variant="secondary">{planLabel}</Badge>
            <Button variant="ghost" size="sm" onClick={signOut}>Sair</Button>
          </div>
        </div>
      </header>

      <main className="container py-8">
        {/* Title + New Project */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Meus Projetos</h1>
          <Button onClick={() => navigate("/projeto/novo")}>
            <Plus className="h-4 w-4 mr-1" /> Novo Projeto
          </Button>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-6">
          {filterTabs.map((tab) => (
            <Button
              key={tab.value}
              variant={filter === tab.value ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(tab.value)}
            >
              {tab.label}
            </Button>
          ))}
        </div>

        {/* Projects Grid */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <BookOpen className="h-16 w-16 text-muted-foreground mb-4" />
            <h2 className="text-lg font-semibold mb-2">Nenhum projeto ainda</h2>
            <p className="text-muted-foreground mb-4">Clique em + Novo Projeto para começar.</p>
            <Button onClick={() => navigate("/projeto/novo")}>
              <Plus className="h-4 w-4 mr-1" /> Novo Projeto
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <Card key={project.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-start justify-between pb-2">
                  <div className="space-y-1">
                    <CardTitle className="text-base">{project.name}</CardTitle>
                    <Badge variant="outline" className="text-xs">
                      {bookTypeLabels[project.book_type] || project.book_type}
                    </Badge>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => { setRenameId(project.id); setRenameName(project.name); }}>
                        Renomear
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(project.id)}>
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{new Date(project.created_at).toLocaleDateString("pt-BR")}</span>
                    <span>{project.total_pages} páginas</span>
                  </div>
                  <div className="space-y-2">
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs"><span>Audiobook</span><span>0%</span></div>
                      <Progress value={0} className="h-1.5" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs"><span>Audiodescrição</span><span>0%</span></div>
                      <Progress value={0} className="h-1.5" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs"><span>Videobook</span><span>0%</span></div>
                      <Progress value={0} className="h-1.5" />
                    </div>
                  </div>
                  <Button className="w-full" size="sm" onClick={() => navigate(`/projeto/${project.id}`)}>
                    <FolderOpen className="h-4 w-4 mr-1" /> Abrir
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Rename Dialog */}
      <Dialog open={!!renameId} onOpenChange={(o) => !o && setRenameId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Renomear Projeto</DialogTitle></DialogHeader>
          <Input value={renameName} onChange={(e) => setRenameName(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameId(null)}>Cancelar</Button>
            <Button onClick={handleRename}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Excluir Projeto</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Tem certeza que deseja excluir este projeto? Esta ação não pode ser desfeita.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Dashboard;
