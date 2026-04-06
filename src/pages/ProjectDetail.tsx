import { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";
import { useProjectEditor } from "@/hooks/useProjectEditor";
import { usePdfProcessor } from "@/hooks/usePdfProcessor";
import { useIsMobile } from "@/hooks/use-mobile";
import EditorHeader from "@/components/editor/EditorHeader";
import GlobalConfigPanel from "@/components/editor/GlobalConfigPanel";
import VideoGlobalPanel from "@/components/editor/VideoGlobalPanel";
import PageNavigator from "@/components/editor/PageNavigator";
import AudioPageCard from "@/components/editor/AudioPageCard";
import VideoPageCard from "@/components/editor/VideoPageCard";
import ExportFooter from "@/components/editor/ExportFooter";
import ProcessingScreen from "@/components/editor/ProcessingScreen";

const ProjectDetail = () => {
  const { id } = useParams();
  const { project, pages, loading, saving, updateProject, updatePage, refetch } = useProjectEditor(id);
  const processor = usePdfProcessor(project, pages, refetch);
  const [activeTab, setActiveTab] = useState("audiobook");
  const [pairIndex, setPairIndex] = useState(0);
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const isMobile = useIsMobile();

  const perPage = isMobile ? 1 : 2;
  const pairs = useMemo(() => {
    const result = [];
    for (let i = 0; i < pages.length; i += perPage) {
      result.push(pages.slice(i, i + perPage));
    }
    return result.length ? result : [[]];
  }, [pages, perPage]);

  const totalPairs = pairs.length;
  const currentPages = pairs[Math.min(pairIndex, totalPairs - 1)] || [];

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Projeto não encontrado.</p>
      </div>
    );
  }

  if (processor.processing || processor.error || (project.processing_status === "pending" && pages.length === 0)) {
    return (
      <ProcessingScreen
        progress={processor.progress}
        currentPage={processor.currentPage}
        totalPages={processor.totalPages}
        error={processor.error}
        onRetry={processor.retry}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <EditorHeader
        projectName={project.name}
        pages={pages}
        saving={saving}
        activeTab={activeTab}
        onNameChange={(name) => updateProject({ name })}
      />

      <div className="container flex-1 py-4">
        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setPairIndex(0); }}>
          <TabsList className="mb-4">
            <TabsTrigger value="audiobook">📖 Audiobook</TabsTrigger>
            <TabsTrigger value="audiodesc">🖼️ Audiodescrição</TabsTrigger>
            <TabsTrigger value="videobook">🎬 Videobook</TabsTrigger>
          </TabsList>

          {/* Audiobook */}
          <TabsContent value="audiobook">
            <GlobalConfigPanel
              mode="audiobook"
              style={project.audiobook_global_style || ""}
              voice={project.audiobook_global_voice || "Zephyr"}
              onStyleChange={(v) => updateProject({ audiobook_global_style: v || null })}
              onVoiceChange={(v) => updateProject({ audiobook_global_voice: v })}
              pages={pages}
              project={project}
              onPageUpdate={updatePage}
              apiKey={geminiApiKey}
              onApiKeyChange={setGeminiApiKey}
            />
            <PageNavigator
              currentPair={pairIndex}
              totalPairs={totalPairs}
              onPrev={() => setPairIndex((i) => Math.max(0, i - 1))}
              onNext={() => setPairIndex((i) => Math.min(totalPairs - 1, i + 1))}
            />
            <div className={`grid gap-4 ${isMobile ? "grid-cols-1" : "grid-cols-2"}`}>
              {currentPages.map((page) => (
                <AudioPageCard
                  key={page.id}
                  page={page}
                  mode="audiobook"
                  globalVoice={project.audiobook_global_voice || "Zephyr"}
                  project={project}
                  apiKey={geminiApiKey}
                  onUpdate={updatePage}
                />
              ))}
            </div>
          </TabsContent>

          {/* Audiodescrição */}
          <TabsContent value="audiodesc">
            <GlobalConfigPanel
              mode="audiodesc"
              style={project.audiodesc_global_style || ""}
              voice={project.audiodesc_global_voice || "Kore"}
              onStyleChange={(v) => updateProject({ audiodesc_global_style: v || null })}
              onVoiceChange={(v) => updateProject({ audiodesc_global_voice: v })}
              pages={pages}
              project={project}
              onPageUpdate={updatePage}
              apiKey={geminiApiKey}
              onApiKeyChange={setGeminiApiKey}
            />
            <PageNavigator
              currentPair={pairIndex}
              totalPairs={totalPairs}
              onPrev={() => setPairIndex((i) => Math.max(0, i - 1))}
              onNext={() => setPairIndex((i) => Math.min(totalPairs - 1, i + 1))}
            />
            <div className={`grid gap-4 ${isMobile ? "grid-cols-1" : "grid-cols-2"}`}>
              {currentPages.map((page) => (
                <AudioPageCard
                  key={page.id}
                  page={page}
                  mode="audiodesc"
                  globalVoice={project.audiodesc_global_voice || "Kore"}
                  project={project}
                  apiKey={geminiApiKey}
                  onUpdate={updatePage}
                />
              ))}
            </div>
          </TabsContent>

          {/* Videobook */}
          <TabsContent value="videobook">
            <VideoGlobalPanel
              visualStyle={project.videobook_global_visual_style || ""}
              transition={project.videobook_global_transition || "fade"}
              outputFormat={project.videobook_output_format || "16:9"}
              onVisualStyleChange={(v) => updateProject({ videobook_global_visual_style: v || null })}
              onTransitionChange={(v) => updateProject({ videobook_global_transition: v })}
              onOutputFormatChange={(v) => updateProject({ videobook_output_format: v })}
            />
            <PageNavigator
              currentPair={pairIndex}
              totalPairs={totalPairs}
              onPrev={() => setPairIndex((i) => Math.max(0, i - 1))}
              onNext={() => setPairIndex((i) => Math.min(totalPairs - 1, i + 1))}
            />
            <div className={`grid gap-4 ${isMobile ? "grid-cols-1" : "grid-cols-2"}`}>
              {currentPages.map((page) => (
                <VideoPageCard key={page.id} page={page} onUpdate={updatePage} />
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <ExportFooter activeTab={activeTab} totalPages={pages.length} />
    </div>
  );
};

export default ProjectDetail;
