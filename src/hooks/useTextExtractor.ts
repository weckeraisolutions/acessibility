import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";

type Page = Tables<"pages">;
type Project = Tables<"projects">;

interface ExtractionResults {
  extracted: number;
  noContent: number;
  errors: number;
}

interface UseTextExtractorReturn {
  extracting: boolean;
  currentPage: number;
  totalPages: number;
  results: ExtractionResults;
  extractAll: (
    pages: Page[],
    mode: "audiobook" | "audiodesc",
    project: Project,
    onPageUpdate: (pageId: string, fields: Partial<Page>) => void
  ) => Promise<ExtractionResults>;
  extractSingle: (
    page: Page,
    mode: "audiobook" | "audiodesc",
    project: Project,
    onPageUpdate: (pageId: string, fields: Partial<Page>) => void
  ) => Promise<boolean>;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function callExtractText(
  page: Page,
  mode: "audiobook" | "audiodesc",
  project: Project
) {
  const { data, error } = await supabase.functions.invoke("extract-text", {
    body: {
      page_id: page.id,
      image_url: page.image_url,
      mode,
      book_type: project.book_type || "general",
      global_style:
        mode === "audiobook"
          ? project.audiobook_global_style
          : project.audiodesc_global_style,
      page_style:
        mode === "audiobook" ? page.audiobook_style : page.audiodesc_style,
      narration_text: mode === "audiodesc" ? (page.audiobook_text || "") : "",
    },
  });

  if (error) {
    // Try to extract structured error
    try {
      const parsed = typeof error === "string" ? JSON.parse(error) : error;
      if (parsed?.context?.message) {
        const innerParsed = JSON.parse(parsed.context.message);
        throw innerParsed;
      }
    } catch (e) {
      if ((e as any)?.error) throw e;
    }
    throw error;
  }
  return data as {
    success: boolean;
    text: string;
    no_content: boolean;
    page_id: string;
    error?: string;
    message?: string;
    validated?: boolean;
    score?: number | null;
    violations?: unknown[];
    was_corrected?: boolean;
    text_original?: string | null;
  };
}

export function useTextExtractor(): UseTextExtractorReturn {
  const [extracting, setExtracting] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [results, setResults] = useState<ExtractionResults>({
    extracted: 0,
    noContent: 0,
    errors: 0,
  });

  const extractSingle = useCallback(
    async (
      page: Page,
      mode: "audiobook" | "audiodesc",
      project: Project,
      onPageUpdate: (pageId: string, fields: Partial<Page>) => void
    ): Promise<boolean> => {
      const textField = mode === "audiobook" ? "audiobook_text" : "audiodesc_text";
      const statusField = mode === "audiobook" ? "audiobook_status" : "audiodesc_status";

      try {
        const result = await callExtractText(page, mode, project);
        if (result.success) {
          const extra: Partial<Page> = {};
          if (mode === "audiodesc") {
            (extra as any).audiodesc_validated = !!result.validated;
            (extra as any).audiodesc_validation_score = result.score ?? null;
            (extra as any).audiodesc_validation_violations = (result.violations as any) ?? null;
            (extra as any).audiodesc_text_original = result.text_original ?? null;
          }
          onPageUpdate(page.id, {
            [textField]: result.text,
            [statusField]: result.no_content ? "no_content" : "extracted",
            ...extra,
          } as Partial<Page>);
          return true;
        }
        return false;
      } catch {
        return false;
      }
    },
    []
  );

  const extractAll = useCallback(
    async (
      pages: Page[],
      mode: "audiobook" | "audiodesc",
      project: Project,
      onPageUpdate: (pageId: string, fields: Partial<Page>) => void
    ): Promise<ExtractionResults> => {
      setExtracting(true);
      setTotalPages(pages.length);
      const res: ExtractionResults = { extracted: 0, noContent: 0, errors: 0 };

      const textField = mode === "audiobook" ? "audiobook_text" : "audiodesc_text";
      const statusField = mode === "audiobook" ? "audiobook_status" : "audiodesc_status";

      for (let i = 0; i < pages.length; i++) {
        setCurrentPage(i + 1);
        const page = pages[i];

        let success = false;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const result = await callExtractText(page, mode, project);
            if (result.success) {
              const extra: Partial<Page> = {};
              if (mode === "audiodesc") {
                (extra as any).audiodesc_validated = !!result.validated;
                (extra as any).audiodesc_validation_score = result.score ?? null;
                (extra as any).audiodesc_validation_violations = (result.violations as any) ?? null;
                (extra as any).audiodesc_text_original = result.text_original ?? null;
              }
              onPageUpdate(page.id, {
                [textField]: result.text,
                [statusField]: result.no_content ? "no_content" : "extracted",
                ...extra,
              } as Partial<Page>);
              if (result.no_content) res.noContent++;
              else res.extracted++;
              success = true;
              break;
            }
            if (result.error === "rate_limit" || result.error === "timeout") {
              await sleep(Math.pow(2, attempt + 1) * 1000);
              continue;
            }
            break;
          } catch (e: any) {
            const errorType = e?.error;
            if (errorType === "rate_limit" || errorType === "timeout") {
              await sleep(Math.pow(2, attempt + 1) * 1000);
              continue;
            }
            if (attempt < 2) {
              await sleep(Math.pow(2, attempt + 1) * 1000);
            }
          }
        }
        if (!success) res.errors++;
        setResults({ ...res });
      }

      setExtracting(false);
      return res;
    },
    []
  );

  return { extracting, currentPage, totalPages, results, extractAll, extractSingle };
}
