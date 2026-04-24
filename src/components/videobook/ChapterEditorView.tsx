import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Film } from "lucide-react";
import VideobookPlayer, { type VideobookPlayerHandle } from "./VideobookPlayer";
import InterpreterPanel from "./InterpreterPanel";
import HighResPreparationDialog from "./HighResPreparationDialog";
import VideobookExportDialog from "./VideobookExportDialog";
import { useHighResPages } from "@/hooks/useHighResPages";
import type { Tables } from "@/integrations/supabase/types";
import type { ChapterRow } from "@/hooks/useChapters";

type Page = Tables<"pages"> & { image_hd_url?: string | null };

interface Props {
  chapter: ChapterRow;
  pages: Page[];
  projectId: string;
  projectName: string;
  onBack: () => void;
  onUpdateChapter: (id: string, patch: Partial<ChapterRow>) => Promise<void>;
  onPagesRefetch?: () => void;
}

const ChapterEditorView = ({ chapter, pages, projectId, projectName, onBack, onUpdateChapter, onPagesRefetch }: Props) => {
  const playerRef = useRef<VideobookPlayerHandle>(null);
  const [layout, setLayout] = useState<"single" | "double">((chapter.videobook_layout as any) || "single");
  const [exportOpen, setExportOpen] = useState(false);
  const [currentPageIdx, setCurrentPageIdx] = useState(0);
  const hd = useHighResPages();

  const chapterPages = useMemo(
    () => pages
      .filter(p => p.page_number >= chapter.start_page && p.page_number <= chapter.end_page)
      .sort((a, b) => a.page_number - b.page_number),
    [pages, chapter.start_page, chapter.end_page],
  );

  const totalDuration = useMemo(
    () => chapterPages.reduce((s, p) => s + (Number(p.audiobook_audio_duration_seconds) || 0), 0),
    [chapterPages],
  );

  // Trigger HD prep once per chapter
  const hdRanRef = useRef<string | null>(null);
  useEffect(() => {
    if (hdRanRef.current === chapter.id) return;
    hdRanRef.current = chapter.id;
    (async () => {
      try {
        const res = await hd.ensureHighResForChapter(projectId, chapter.id, pages, chapter.start_page, chapter.end_page);
        if (res && !res.skipped) onPagesRefetch?.();
      } catch (e) {
        console.warn("HD prep failed", e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapter.id]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-1" />Voltar</Button>
          <h2 className="text-lg font-semibold">{chapter.title}</h2>
          <span className="text-xs text-muted-foreground">Páginas {chapter.start_page}–{chapter.end_page}</span>
        </div>
        <Button onClick={() => setExportOpen(true)}>
          <Film className="h-4 w-4 mr-1" /> Gerar Videobook
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-10 gap-3 min-h-[600px]">
        <div className="lg:col-span-7 border rounded-lg p-3 pr-4 bg-card min-w-0 min-h-[640px]">
          <VideobookPlayer
            ref={playerRef}
            pages={chapterPages}
            layout={layout}
            onLayoutChange={(l) => { setLayout(l); onUpdateChapter(chapter.id, { videobook_layout: l }); }}
            onPageChange={setCurrentPageIdx}
          />
        </div>
        <div className="lg:col-span-3 pl-2">
          <InterpreterPanel
            chapter={chapter}
            expectedDurationSec={totalDuration}
            audiobookText={chapterPages[currentPageIdx]?.audiobook_text || ""}
            onModeChange={(mode, videoUrl) => onUpdateChapter(chapter.id, { interpreter_mode: mode, interpreter_video_url: videoUrl ?? null })}
          />
        </div>
      </div>

      <HighResPreparationDialog open={hd.preparing} current={hd.progress.current} total={hd.progress.total} message={hd.progress.message} />

      <VideobookExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        chapter={chapter}
        pages={chapterPages}
        projectName={projectName}
        flipbookContainer={playerRef.current?.getContainer()}
      />
    </div>
  );
};

export default ChapterEditorView;