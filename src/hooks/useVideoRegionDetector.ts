import { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { useToast } from "@/hooks/use-toast";

type Page = Tables<"pages">;

export function useVideoRegionDetector() {
  const [detecting, setDetecting] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const { toast } = useToast();
  const cancelledRef = useRef(false);

  const detectSingle = useCallback(
    async (page: Page, bookType: string, onUpdate: (pageId: string, fields: Partial<Page>) => void) => {
      if (!page.audiobook_text || !page.audiobook_audio_duration_seconds) {
        toast({
          title: "Requisitos faltando",
          description: "Esta página precisa ter texto extraído e áudio gerado antes de detectar regiões.",
          variant: "destructive",
        });
        return false;
      }

      const { data, error } = await supabase.functions.invoke("detect-video-regions", {
        body: {
          page_id: page.id,
          image_url: page.image_url,
          audiobook_text: page.audiobook_text,
          audio_duration_seconds: page.audiobook_audio_duration_seconds,
          book_type: bookType,
        },
      });

      if (error || !data?.success) {
        const msg = data?.message || error?.message || "Erro desconhecido";
        toast({ title: `Erro na página ${page.page_number}`, description: msg, variant: "destructive" });
        return false;
      }

      onUpdate(page.id, {
        video_regions: data.regions,
        video_status: "regions_detected",
        video_transition: data.regions?.suggested_transition || "fade",
      });
      return true;
    },
    [toast]
  );

  const detectAll = useCallback(
    async (
      pages: Page[],
      bookType: string,
      onUpdate: (pageId: string, fields: Partial<Page>) => void
    ) => {
      const eligible = pages.filter(
        (p) => p.audiobook_text && p.audiobook_audio_duration_seconds && p.audiobook_audio_duration_seconds > 0
      );

      if (eligible.length === 0) {
        toast({
          title: "Nenhuma página elegível",
          description: "As páginas precisam ter texto extraído e áudio gerado.",
          variant: "destructive",
        });
        return;
      }

      setDetecting(true);
      setTotalPages(eligible.length);
      setCurrentPage(0);
      cancelledRef.current = false;

      let success = 0;
      let errors = 0;

      for (let i = 0; i < eligible.length; i++) {
        if (cancelledRef.current) break;
        setCurrentPage(i + 1);
        const page = eligible[i];

        let ok = false;
        for (let attempt = 0; attempt < 3; attempt++) {
          if (cancelledRef.current) break;
          try {
            ok = await detectSingle(page, bookType, onUpdate);
            if (ok) break;
          } catch {
            // retry
          }
          if (attempt < 2) {
            await new Promise((r) => setTimeout(r, 2000 * Math.pow(2, attempt)));
          }
        }
        if (ok) success++;
        else errors++;
      }

      setDetecting(false);
      toast({
        title: "Detecção concluída",
        description: `${success} páginas detectadas, ${errors} com erro`,
      });
    },
    [detectSingle, toast]
  );

  const cancel = useCallback(() => {
    cancelledRef.current = true;
  }, []);

  return { detecting, currentPage, totalPages, detectSingle, detectAll, cancel };
}
