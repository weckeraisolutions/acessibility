import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// Standalone type — table not yet in generated supabase types
export interface PageNarration {
  id: string;
  page_id: string;
  project_id: string;
  position: number;
  label: string;
  text: string | null;
  voice_id: string | null;
  voice_engine: string;
  style: string | null;
  narration_speed: string | null;
  audio_url: string | null;
  audio_duration_seconds: number | null;
  status: string;
  created_at: string;
  updated_at: string;
}

// Cast helpers (table not in generated types)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tbl = () => (supabase as any).from("page_narrations");

export function usePageNarrations(pageId: string | undefined, projectId: string | undefined) {
  const [narrations, setNarrations] = useState<PageNarration[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const refetch = useCallback(async () => {
    if (!pageId) return;
    setLoading(true);
    const { data, error } = await tbl()
      .select("*")
      .eq("page_id", pageId)
      .order("position", { ascending: true });
    if (!error) setNarrations((data as PageNarration[]) || []);
    setLoading(false);
  }, [pageId]);

  useEffect(() => { refetch(); }, [refetch]);

  const add = useCallback(async (overrides?: Partial<PageNarration>) => {
    if (!pageId || !projectId) return null;
    const nextPos = (narrations[narrations.length - 1]?.position ?? 0) + 1;
    const payload = {
      page_id: pageId,
      project_id: projectId,
      position: nextPos,
      label: overrides?.label ?? `Narração ${narrations.length + 2}`,
      text: overrides?.text ?? null,
      voice_id: overrides?.voice_id ?? null,
      voice_engine: overrides?.voice_engine ?? "gemini",
      style: overrides?.style ?? null,
      narration_speed: overrides?.narration_speed ?? null,
      status: "pending",
    };
    const { data, error } = await tbl().insert(payload).select().single();
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return null;
    }
    setNarrations((prev) => [...prev, data as PageNarration]);
    return data as PageNarration;
  }, [pageId, projectId, narrations, toast]);

  const addMany = useCallback(async (items: Array<Partial<PageNarration>>) => {
    if (!pageId || !projectId) return;
    const startPos = (narrations[narrations.length - 1]?.position ?? 0) + 1;
    const rows = items.map((it, i) => ({
      page_id: pageId,
      project_id: projectId,
      position: startPos + i,
      label: it.label ?? `Narração ${i + 2}`,
      text: it.text ?? null,
      voice_id: it.voice_id ?? null,
      voice_engine: it.voice_engine ?? "gemini",
      style: it.style ?? null,
      narration_speed: it.narration_speed ?? null,
      status: "pending",
    }));
    const { data, error } = await tbl().insert(rows).select();
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    setNarrations((prev) => [...prev, ...((data as PageNarration[]) || [])]);
  }, [pageId, projectId, narrations, toast]);

  const update = useCallback(async (id: string, fields: Partial<PageNarration>) => {
    setNarrations((prev) => prev.map((n) => (n.id === id ? { ...n, ...fields } : n)));
    const { error } = await tbl().update(fields).eq("id", id);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      refetch();
    }
  }, [toast, refetch]);

  const remove = useCallback(async (id: string) => {
    setNarrations((prev) => prev.filter((n) => n.id !== id));
    const { error } = await tbl().delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
      refetch();
    }
  }, [toast, refetch]);

  return { narrations, loading, refetch, add, addMany, update, remove };
}