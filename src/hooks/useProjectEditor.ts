import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { useToast } from "@/hooks/use-toast";

type Project = Tables<"projects">;
type Page = Tables<"pages">;

export function useProjectEditor(projectId: string | undefined) {
  const [project, setProject] = useState<Project | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    const [projRes, pagesRes] = await Promise.all([
      supabase.from("projects").select("*").eq("id", projectId).single(),
      supabase.from("pages").select("*").eq("project_id", projectId).order("page_number"),
    ]);
    if (projRes.error) {
      toast({ title: "Erro ao carregar projeto", description: projRes.error.message, variant: "destructive" });
    } else {
      setProject(projRes.data);
    }
    if (!pagesRes.error) {
      setPages(pagesRes.data || []);
    }
    setLoading(false);
  }, [projectId, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const updateProject = useCallback(
    async (fields: Partial<Project>) => {
      if (!projectId) return;
      setSaving(true);
      const { error } = await supabase.from("projects").update(fields).eq("id", projectId);
      if (error) {
        toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      } else {
        setProject((prev) => (prev ? { ...prev, ...fields } : prev));
      }
      setSaving(false);
    },
    [projectId, toast]
  );

  const updatePage = useCallback(
    async (pageId: string, fields: Partial<Page>) => {
      setSaving(true);
      const { error } = await supabase.from("pages").update(fields).eq("id", pageId);
      if (error) {
        toast({ title: "Erro ao salvar página", description: error.message, variant: "destructive" });
      } else {
        setPages((prev) => prev.map((p) => (p.id === pageId ? { ...p, ...fields } : p)));
      }
      setSaving(false);
    },
    [toast]
  );

  return { project, pages, loading, saving, updateProject, updatePage, refetch: fetchData };
}
