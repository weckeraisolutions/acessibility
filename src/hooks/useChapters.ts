import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

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
    // Load from Supabase
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
            if (Array.isArray(parsed)) setChapters(parsed);
          } catch { setChapters([]); }
        }
      });
  }, [projectId]);

  const persist = useCallback((updated: Chapter[]) => {
    setChapters(updated);
    if (projectId) {
      supabase
        .from("projects")
        .update({ chapters_config: updated as any })
        .eq("id", projectId)
        .then();
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
