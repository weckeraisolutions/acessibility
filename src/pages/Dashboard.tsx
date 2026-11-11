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
import { Plus, MoreVertical, FolderOpen, BookOpen, Settings, AudioLines, Eye } from "lucide-react";
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
    <div className="app-shell">
      <SEO
        title="Dashboard — Accessibility"
        description="Gerencie seus projetos de audiobooks, audiodescrições e videobooks acessíveis."
        path="/dashboard"
        noindex
      />
      {/* Header */}
      <header className="app-topbar">
        <div className="studio-container flex h-[72px] items-center justify-between">
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

      <main className="studio-container py-10">
        <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div><span className="app-eyebrow">Estúdio editorial</span><h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">Meus projetos</h1><p className="mt-2 text-sm text-muted-foreground">Acompanhe produção, pendências e próxima ação de cada livro.</p></div>
          <Button className="min-h-11 rounded-full px-5" onClick={() => navigate("/projeto/novo")}>
            <Plus className="h-4 w-4 mr-1" /> Novo Projeto
          </Button>
        </div>

        <div className="mb-8 grid gap-3 sm:grid-cols-3">
          {[
            [BookOpen, "Projetos", projects.length],
            [AudioLines, "Em produção", projects.filter((p) => getProjectStatus(p).label !== "Completo").length],
            [Eye, "Concluídos", projects.filter((p) => getProjectStatus(p).label === "Completo").length],
          ].map(([Icon, label, value]) => { const MetricIcon = Icon as typeof BookOpen; return <div key={label as string} className="app-panel flex items-center gap-4 p-5"><span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary"><MetricIcon size={20} /></span><div><span className="text-sm text-muted-foreground">{label as string}</span><strong className="block text-2xl font-semibold">{value as number}</strong></div></div>; })}
        </div>

        <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="Filtrar projetos">
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
          <div className="app-panel flex flex-col items-center justify-center px-6 py-20 text-center">
            <span className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary"><BookOpen className="h-7 w-7" /></span>
            <h2 className="mb-2 text-xl font-semibold">Seu estúdio está pronto</h2>
            <p className="mb-6 max-w-md text-muted-foreground">Crie o primeiro projeto e envie um PDF para iniciar a produção editorial acessível.</p>
            <Button className="min-h-11 rounded-full px-5" onClick={() => navigate("/projeto/novo")}>
              <Plus className="h-4 w-4 mr-1" /> Novo Projeto
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {projects.map((project) => {
              const total = project.total_pages || 1;
              const abPct = Math.round((project.audiobook_approved / total) * 100);
              const adPct = Math.round((project.audiodesc_approved / total) * 100);
              const vcPct = Math.round((project.video_configured / total) * 100);
              const status = getProjectStatus(project);

              return (
                <Card key={project.id} className="app-panel overflow-hidden border-white/10 transition hover:-translate-y-0.5 hover:border-white/20">
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
                  <CardContent className="space-y-4">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{new Date(project.created_at).toLocaleDateString("pt-BR")}</span>
                      <span>{project.total_pages} páginas</span>
                    </div>
                    <div className="space-y-3 rounded-2xl border border-white/10 bg-black/15 p-4">
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
                    <Button className="min-h-11 w-full rounded-full" size="sm" onClick={() => navigate(`/projeto/${project.id}`)}>
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
