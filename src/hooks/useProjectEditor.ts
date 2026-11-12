import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { useToast } from "@/hooks/use-toast";
import { createPrivateStorageUrl, fileReference, fileId } from "@/lib/storage";

type Project = Tables<"projects">;
type Page = Tables<"pages">;
const pageFiles = ["image_url", "thumbnail_url", "image_hd_url", "audiobook_audio_url", "audiodesc_audio_url"] as const;
async function displayPage<T extends Partial<Page>>(page: T): Promise<T> {
  const display = { ...page };
  await Promise.all(pageFiles.map(async key => {
    if (display[key]) display[key] = await createPrivateStorageUrl("file", display[key]);
  }));
  return display;
}
function persistentFields<T extends object>(fields: T): T {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => {
    if (key.endsWith("_url") && typeof value === "string" && value) {
      const ref = fileReference(value);
      fileId(ref); // Refuse to save an unknown signed or external URL.
      return [key, ref];
    }
    return [key, value];
  })) as T;
}

export function useProjectEditor(projectId: string | undefined) {
  const [project, setProject] = useState<Project | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingSaves, setPendingSaves] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const generation = useRef(0);
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    const request = ++generation.current;
    if (!projectId) { setLoading(false); return; }
    setLoading(true);
    setLoadError(null);
    setProject(null);
    setPages([]);
    try {
      const [projRes, pagesRes] = await Promise.all([
        supabase.from("projects").select("*").eq("id", projectId).single(),
        supabase.from("pages").select("*").eq("project_id", projectId).order("page_number"),
      ]);
      if (projRes.error) throw new Error(projRes.error.code === "PGRST116" ? "Acesso negado ou projeto não encontrado." : "Não foi possível carregar o projeto. Verifique sua conexão.");
      if (pagesRes.error) throw new Error("Não foi possível carregar as páginas. Tente novamente.");
      const secured = await Promise.all((pagesRes.data || []).map(displayPage));
      if (request !== generation.current) return;
      setProject(projRes.data);
      setPages(secured);
    } catch (error) {
      if (request === generation.current) setLoadError(error instanceof Error ? error.message : "Não foi possível carregar.");
    } finally { if (request === generation.current) setLoading(false); }
  }, [projectId]);

  useEffect(() => {
    void fetchData();
    const invalidate = () => { generation.current++; };
    return invalidate;
  }, [fetchData]);

  const updateProject = useCallback(async (fields: Partial<Project>) => {
    if (!projectId) return;
    setPendingSaves(n => n + 1);
    try {
      const persistent = persistentFields(fields);
      const { error } = await supabase.from("projects").update(persistent).eq("id", projectId);
      if (error) throw error;
      setProject(prev => prev ? { ...prev, ...persistent } : prev);
    } catch (error) {
      toast({ title: "Erro ao salvar", description: error instanceof Error ? error.message : "Tente novamente.", variant: "destructive" });
    } finally { setPendingSaves(n => n - 1); }
  }, [projectId, toast]);

  const updatePage = useCallback(async (pageId: string, fields: Partial<Page>) => {
    setPendingSaves(n => n + 1);
    try {
      const persistent = persistentFields(fields);
      const { error } = await supabase.from("pages").update(persistent).eq("id", pageId).eq("project_id", projectId!);
      if (error) throw error;
      const display = await displayPage(persistent);
      setPages(prev => prev.map(p => p.id === pageId ? { ...p, ...display } : p));
    } catch (error) {
      toast({ title: "Erro ao salvar página", description: error instanceof Error ? error.message : "Tente novamente.", variant: "destructive" });
    } finally { setPendingSaves(n => n - 1); }
  }, [projectId, toast]);

  return { project, pages, loading, loadError, saving: pendingSaves > 0, updateProject, updatePage, refetch: fetchData };
}
