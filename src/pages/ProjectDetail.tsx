import { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft } from "lucide-react";
import { useProjectEditor } from "@/hooks/useProjectEditor";
import { usePdfProcessor } from "@/hooks/usePdfProcessor";
import { useVideoRegionDetector } from "@/hooks/useVideoRegionDetector";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import EditorHeader from "@/components/editor/EditorHeader";
import GlobalConfigPanel, { type TtsEngine } from "@/components/editor/GlobalConfigPanel";
import VideoGlobalPanel from "@/components/editor/VideoGlobalPanel";
import PageNavigator from "@/components/editor/PageNavigator";
import AudioPageCard from "@/components/editor/AudioPageCard";
import VideoPageCard from "@/components/editor/VideoPageCard";
import ExportFooter from "@/components/editor/ExportFooter";
import ProcessingScreen from "@/components/editor/ProcessingScreen";
import { ElevenLabsVoice } from "@/constants/elevenlabs-voices";

const ProjectDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { project, pages, loading, saving, updateProject, updatePage, refetch } = useProjectEditor(id);
  const processor = usePdfProcessor(project, pages, refetch);
  const videoDetector = useVideoRegionDetector();
  const [activeTab, setActiveTab] = useState("audiobook");
  const [pairIndex, setPairIndex] = useState(0);
  const [ttsEngine, setTtsEngine] = useState<TtsEngine>("gemini");
  const [canUseElevenlabs, setCanUseElevenlabs] = useState(false);
  const [elevenlabsVoices, setElevenlabsVoices] = useState<ElevenLabsVoice[]>([]);
  const [selectedElevenlabsVoice, setSelectedElevenlabsVoice] = useState("");
  const isMobile = useIsMobile();

  // Check ElevenLabs availability on mount by calling the edge function
  useEffect(() => {
    supabase.functions.invoke("get-elevenlabs-voices").then(({ data }) => {
      if (data?.success && data.voices?.length > 0) {
        setCanUseElevenlabs(true);
        setElevenlabsVoices(data.voices);
        setSelectedElevenlabsVoice(data.voices[0].voice_id);
      }
    }).catch(() => {});
  }, []);

  const isElevenlabs = ttsEngine === "elevenlabs" && canUseElevenlabs;

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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "ArrowLeft") { e.preventDefault(); setPairIndex((i) => Math.max(0, i - 1)); }
      else if (e.key === "ArrowRight") { e.preventDefault(); setPairIndex((i) => Math.min(totalPairs - 1, i + 1)); }
      if ((e.ctrlKey || e.metaKey) && e.key === "s") e.preventDefault();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [totalPairs]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground text-lg">Projeto não encontrado ou sem permissão de acesso.</p>
        <Button onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar ao Dashboard
        </Button>
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
              ttsEngine={ttsEngine}
              onTtsEngineChange={setTtsEngine}
              canUseElevenlabs={canUseElevenlabs}
              elevenlabsVoices={elevenlabsVoices}
              selectedElevenlabsVoice={selectedElevenlabsVoice}
              onElevenlabsVoiceChange={setSelectedElevenlabsVoice}
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
                  onUpdate={updatePage}
                  ttsEngine={ttsEngine}
                  elevenlabsVoices={elevenlabsVoices}
                  selectedElevenlabsVoice={selectedElevenlabsVoice}
                  plan={profile?.plan}
                />
              ))}
            </div>
          </TabsContent>

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
              ttsEngine={ttsEngine}
              onTtsEngineChange={setTtsEngine}
              canUseElevenlabs={canUseElevenlabs}
              elevenlabsVoices={elevenlabsVoices}
              selectedElevenlabsVoice={selectedElevenlabsVoice}
              onElevenlabsVoiceChange={setSelectedElevenlabsVoice}
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
                  onUpdate={updatePage}
                  ttsEngine={ttsEngine}
                  elevenlabsVoices={elevenlabsVoices}
                  selectedElevenlabsVoice={selectedElevenlabsVoice}
                  plan={profile?.plan}
                />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="videobook">
            <VideoGlobalPanel
              visualStyle={project.videobook_global_visual_style || ""}
              transition={project.videobook_global_transition || "fade"}
              outputFormat={project.videobook_output_format || "16:9"}
              onVisualStyleChange={(v) => updateProject({ videobook_global_visual_style: v || null })}
              onTransitionChange={(v) => updateProject({ videobook_global_transition: v })}
              onOutputFormatChange={(v) => updateProject({ videobook_output_format: v })}
              detecting={videoDetector.detecting}
              detectCurrentPage={videoDetector.currentPage}
              detectTotalPages={videoDetector.totalPages}
              onDetectAll={() => videoDetector.detectAll(pages, project.book_type, updatePage)}
              onCancelDetect={videoDetector.cancel}
            />
            <PageNavigator
              currentPair={pairIndex}
              totalPairs={totalPairs}
              onPrev={() => setPairIndex((i) => Math.max(0, i - 1))}
              onNext={() => setPairIndex((i) => Math.min(totalPairs - 1, i + 1))}
            />
            <div className={`grid gap-4 ${isMobile ? "grid-cols-1" : "grid-cols-2"}`}>
              {currentPages.map((page) => (
                <VideoPageCard key={page.id} page={page} bookType={project.book_type} onUpdate={updatePage} onDetectSingle={videoDetector.detectSingle} />
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <ExportFooter activeTab={activeTab} totalPages={pages.length} pages={pages} projectName={project.name} projectId={project.id} />
    </div>
  );
};

export default ProjectDetail;
