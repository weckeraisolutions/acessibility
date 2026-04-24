import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type Page = Tables<"pages"> & { image_hd_url?: string | null };

const HD_THRESHOLD = 2000;

function probeImageWidth(url: string): Promise<number> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img.naturalWidth || 0);
    img.onerror = () => resolve(0);
    img.src = url;
  });
}

export function useHighResPages() {
  const [preparing, setPreparing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, message: "" });

  const ensureHighResForChapter = useCallback(async (
    projectId: string,
    chapterId: string,
    pages: Page[],
    startPage: number,
    endPage: number,
  ) => {
    const subset = pages.filter(p => p.page_number >= startPage && p.page_number <= endPage);
    if (subset.length === 0) return { skipped: true };

    setPreparing(true);
    setProgress({ current: 0, total: subset.length, message: "Verificando resolução..." });

    let needsRework = false;
    for (let i = 0; i < subset.length; i++) {
      const p = subset[i];
      if (p.image_hd_url) continue;
      const url = p.image_url;
      if (!url) continue;
      const w = await probeImageWidth(url);
      setProgress({ current: i + 1, total: subset.length, message: `Verificando página ${i + 1}/${subset.length}` });
      if (w < HD_THRESHOLD) { needsRework = true; break; }
    }

    if (!needsRework) {
      setPreparing(false);
      return { skipped: true };
    }

    setProgress({ current: 0, total: subset.length, message: "Reprocessando páginas em alta resolução..." });

    try {
      const { data, error } = await supabase.functions.invoke("reprocess-pages-highres", {
        body: { project_id: projectId, chapter_id: chapterId },
      });
      if (error) throw error;
      setProgress({ current: subset.length, total: subset.length, message: "Páginas HD prontas!" });
      return { skipped: false, data };
    } finally {
      setPreparing(false);
    }
  }, []);

  return { preparing, progress, ensureHighResForChapter };
}