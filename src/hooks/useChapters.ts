import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// ===== Legacy localStorage-style chapters (kept for ExportFooter / useZipDownload) =====
export interface Chapter {
  id: string;
  name: string;
  startPage: number;
  endPage: number;
}

export function useChapters(projectId: string | undefined) {
  const [chapters, setChapters] = useState<Chapter[]>([]);

  useEffect(() => {
    if (!projectId) return;
    supabase
      .from("projects")
      .select("chapters_config")
      .eq("id", projectId)
      .single()
      .then(({ data }) => {
        if (data?.chapters_config) {
          try {
            const parsed = typeof data.chapters_config === "string"
              ? JSON.parse(data.chapters_config)
              : data.chapters_config;
            if (Array.isArray(parsed)) setChapters(parsed as Chapter[]);
          } catch { setChapters([]); }
        }
      });
  }, [projectId]);

  const persist = useCallback((updated: Chapter[]) => {
    setChapters(updated);
    if (projectId) {
      supabase.from("projects").update({ chapters_config: updated as any }).eq("id", projectId).then();
    }
  }, [projectId]);

  const addChapter = useCallback((name: string, startPage: number, endPage: number) => {
    persist([...chapters, { id: crypto.randomUUID(), name, startPage, endPage }]);
  }, [chapters, persist]);

  const removeChapter = useCallback((id: string) => {
    persist(chapters.filter(c => c.id !== id));
  }, [chapters, persist]);

  return { chapters, addChapter, removeChapter };
}

// ===== New chapters table (Videobook module) =====
export interface ChapterRow {
  id: string;
  project_id: string;
  title: string;
  start_page: number;
  end_page: number;
  order: number;
  interpreter_mode: "vlibras" | "human_video" | "none";
  interpreter_video_url: string | null;
  videobook_url: string | null;
  videobook_status: "draft" | "processing" | "ready" | "error";
  videobook_resolution: string | null;
  videobook_layout: "single" | "double" | null;
  created_at: string;
  updated_at: string;
}

export function useChaptersDB(projectId: string | undefined) {
  const [chapters, setChapters] = useState<ChapterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchChapters = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("chapters" as any)
      .select("*")
      .eq("project_id", projectId)
      .order("order", { ascending: true });
    if (error) {
      toast({ title: "Erro ao carregar capítulos", description: error.message, variant: "destructive" });
    } else {
      setChapters((data as any) || []);
    }
    setLoading(false);
  }, [projectId, toast]);

  useEffect(() => { fetchChapters(); }, [fetchChapters]);

  const overlaps = (start: number, end: number, excludeId?: string) =>
    chapters.some(c => c.id !== excludeId && start <= c.end_page && end >= c.start_page);

  const createChapter = useCallback(async (input: { title: string; start_page: number; end_page: number; order?: number; }) => {
    if (!projectId) return null;
    if (input.start_page > input.end_page) {
      toast({ title: "Intervalo inválido", description: "Página inicial deve ser ≤ página final", variant: "destructive" });
      return null;
    }
    if (overlaps(input.start_page, input.end_page)) {
      toast({ title: "Sobreposição", description: "Esse intervalo de páginas conflita com outro capítulo.", variant: "destructive" });
      return null;
    }
    const order = input.order ?? chapters.length;
    const { data, error } = await supabase
      .from("chapters" as any)
      .insert({ project_id: projectId, title: input.title, start_page: input.start_page, end_page: input.end_page, order } as any)
      .select()
      .single();
    if (error) {
      toast({ title: "Erro ao criar capítulo", description: error.message, variant: "destructive" });
      return null;
    }
    setChapters(prev => [...prev, data as any].sort((a, b) => a.order - b.order));
    return data as any as ChapterRow;
  }, [projectId, chapters, toast]);

  const updateChapter = useCallback(async (id: string, patch: Partial<ChapterRow>) => {
    if (patch.start_page !== undefined && patch.end_page !== undefined) {
      if (overlaps(patch.start_page, patch.end_page, id)) {
        toast({ title: "Sobreposição", description: "Esse intervalo de páginas conflita com outro capítulo.", variant: "destructive" });
        return;
      }
    }
    const { error } = await supabase.from("chapters" as any).update(patch as any).eq("id", id);
    if (error) {
      toast({ title: "Erro ao atualizar capítulo", description: error.message, variant: "destructive" });
      return;
    }
    setChapters(prev => prev.map(c => c.id === id ? { ...c, ...patch } as ChapterRow : c));
  }, [toast, chapters]);

  const deleteChapter = useCallback(async (id: string) => {
    const { error } = await supabase.from("chapters" as any).delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao remover capítulo", description: error.message, variant: "destructive" });
      return;
    }
    setChapters(prev => prev.filter(c => c.id !== id));
  }, [toast]);

  return { chapters, loading, createChapter, updateChapter, deleteChapter, refetch: fetchChapters };
}