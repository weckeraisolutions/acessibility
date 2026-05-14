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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Plus, MoreVertical, FolderOpen, BookOpen, Settings } from "lucide-react";
import SEO from "@/components/SEO";

interface ProjectWithProgress {
  id: string;
  name: string;
  book_type: string;
  total_pages: number;
  created_at: string;
  processing_status: string;
  audiobook_approved: number;
  audiodesc_approved: number;
  video_configured: number;
}

const bookTypeLabels: Record<string, string> = {
  general: "Geral",
  didactic: "Didático",
  literary: "Literário",
  technical: "Técnico",
  children: "Infantil",
};

function getProjectStatus(p: ProjectWithProgress) {
  if (p.processing_status === "pending") return { label: "Processando", variant: "secondary" as const };
  const total = p.total_pages || 1;
  const abPct = (p.audiobook_approved / total) * 100;
  const adPct = (p.audiodesc_approved / total) * 100;
  if (abPct >= 100 && adPct >= 100) return { label: "Completo", variant: "default" as const };
  if (abPct >= 100) return { label: "Audiobook pronto", variant: "secondary" as const };
  return { label: "Em andamento", variant: "outline" as const };
}

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
  const [projects, setProjects] = useState<ProjectWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameName, setRenameName] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchProjects = async () => {
    // Fetch projects
    const { data: projectsData } = await supabase
      .from("projects")
      .select("id, name, book_type, total_pages, created_at, processing_status")
      .order("created_at", { ascending: false });

    if (!projectsData) { setProjects([]); setLoading(false); return; }

    // Fetch page stats for all projects
    const projectIds = projectsData.map(p => p.id);
    const { data: pagesData } = await supabase
      .from("pages")
      .select("project_id, audiobook_status, audiodesc_status, video_status")
      .in("project_id", projectIds);

    const statsMap = new Map<string, { ab: number; ad: number; vc: number }>();
    for (const page of (pagesData || [])) {
      const s = statsMap.get(page.project_id) || { ab: 0, ad: 0, vc: 0 };
      if (page.audiobook_status === "approved") s.ab++;
      if (page.audiodesc_status === "approved") s.ad++;
      if (page.video_status === "configured" || page.video_status === "regions_detected" || page.video_status === "exported") s.vc++;
      statsMap.set(page.project_id, s);
    }

    setProjects(projectsData.map(p => {
      const s = statsMap.get(p.id) || { ab: 0, ad: 0, vc: 0 };
      return {
        ...p,
        audiobook_approved: s.ab,
        audiodesc_approved: s.ad,
        video_configured: s.vc,
      };
    }));
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
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/configuracoes")}>
              <Settings className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={signOut}>Sair</Button>
          </div>
        </div>
      </header>

      <main className="container py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Meus Projetos</h1>
          <Button onClick={() => navigate("/projeto/novo")}>
            <Plus className="h-4 w-4 mr-1" /> Novo Projeto
          </Button>
        </div>

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
            {projects.map((project) => {
              const total = project.total_pages || 1;
              const abPct = Math.round((project.audiobook_approved / total) * 100);
              const adPct = Math.round((project.audiodesc_approved / total) * 100);
              const vcPct = Math.round((project.video_configured / total) * 100);
              const status = getProjectStatus(project);

              return (
                <Card key={project.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="flex flex-row items-start justify-between pb-2">
                    <div className="space-y-1">
                      <CardTitle className="text-base">{project.name}</CardTitle>
                      <div className="flex gap-1">
                        <Badge variant="outline" className="text-xs">
                          {bookTypeLabels[project.book_type] || project.book_type}
                        </Badge>
                        <Badge variant={status.variant} className="text-xs">
                          {status.label}
                        </Badge>
                      </div>
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
                        <div className="flex justify-between text-xs"><span>Audiobook</span><span>{abPct}%</span></div>
                        <Progress value={abPct} className="h-1.5" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs"><span>Audiodescrição</span><span>{adPct}%</span></div>
                        <Progress value={adPct} className="h-1.5" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs"><span>Videobook</span><span>{vcPct}%</span></div>
                        <Progress value={vcPct} className="h-1.5" />
                      </div>
                    </div>
                    <Button className="w-full" size="sm" onClick={() => navigate(`/projeto/${project.id}`)}>
                      <FolderOpen className="h-4 w-4 mr-1" /> Abrir
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
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

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Projeto</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Todos os dados e arquivos serão excluídos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteId(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Dashboard;
