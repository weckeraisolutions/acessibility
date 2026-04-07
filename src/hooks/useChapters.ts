import { useState, useEffect, useCallback } from "react";

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
    const stored = localStorage.getItem(`chapters_${projectId}`);
    if (stored) {
      try { setChapters(JSON.parse(stored)); } catch { setChapters([]); }
    }
  }, [projectId]);

  const persist = useCallback((updated: Chapter[]) => {
    setChapters(updated);
    if (projectId) localStorage.setItem(`chapters_${projectId}`, JSON.stringify(updated));
  }, [projectId]);

  const addChapter = useCallback((name: string, startPage: number, endPage: number) => {
    persist([...chapters, { id: crypto.randomUUID(), name, startPage, endPage }]);
  }, [chapters, persist]);

  const removeChapter = useCallback((id: string) => {
    persist(chapters.filter(c => c.id !== id));
  }, [chapters, persist]);

  return { chapters, addChapter, removeChapter };
}
