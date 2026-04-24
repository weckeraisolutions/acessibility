import { useState, useRef } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Upload, Hand, Video, Ban, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import VLibras from "@djpfs/react-vlibras";
import type { ChapterRow } from "@/hooks/useChapters";

interface Props {
  chapter: ChapterRow;
  expectedDurationSec: number;
  audiobookText?: string;
  onModeChange: (mode: "vlibras" | "human_video" | "none", videoUrl?: string | null) => void;
}

const InterpreterPanel = ({ chapter, expectedDurationSec, audiobookText, onModeChange }: Props) => {
  const [mode, setMode] = useState<"vlibras" | "human_video" | "none">(chapter.interpreter_mode || "none");
  const [uploading, setUploading] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(chapter.interpreter_video_url);
  const fileInput = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleTabChange = (v: string) => {
    const m = v as "vlibras" | "human_video" | "none";
    setMode(m);
    onModeChange(m, m === "human_video" ? videoUrl : null);
  };

  const handleUpload = async (file: File) => {
    if (!file.type.startsWith("video/")) {
      toast({ title: "Arquivo inválido", description: "Envie um vídeo MP4.", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      // Validate duration
      const url = URL.createObjectURL(file);
      const v = document.createElement("video");
      v.preload = "metadata";
      v.src = url;
      const dur: number = await new Promise((res) => {
        v.onloadedmetadata = () => res(v.duration);
        v.onerror = () => res(0);
      });
      URL.revokeObjectURL(url);
      const tolerance = 5; // seconds
      if (expectedDurationSec > 0 && Math.abs(dur - expectedDurationSec) > tolerance) {
        toast({
          title: "Atenção: duração diferente",
          description: `Vídeo dura ${dur.toFixed(1)}s, esperado ~${expectedDurationSec.toFixed(1)}s do capítulo.`,
        });
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Não autenticado");
      const ext = file.name.split(".").pop() || "mp4";
      const path = `${session.user.id}/${chapter.project_id}/${chapter.id}.${ext}`;
      const { error } = await supabase.storage.from("interpreter-videos").upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      setVideoUrl(path);
      onModeChange("human_video", path);
      toast({ title: "Vídeo enviado", description: "Intérprete humano configurado." });
    } catch (e: any) {
      toast({ title: "Erro no upload", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="border rounded-lg p-3 bg-card h-full flex flex-col">
      <h3 className="text-sm font-semibold mb-2 flex items-center gap-1"><Hand className="h-4 w-4" /> Intérprete de Libras</h3>
      <Tabs value={mode} onValueChange={handleTabChange} className="flex-1 flex flex-col">
        <TabsList className="grid grid-cols-3">
          <TabsTrigger value="vlibras" className="text-xs"><Hand className="h-3 w-3 mr-1" />VLibras</TabsTrigger>
          <TabsTrigger value="human_video" className="text-xs"><Video className="h-3 w-3 mr-1" />Humano</TabsTrigger>
          <TabsTrigger value="none" className="text-xs"><Ban className="h-3 w-3 mr-1" />Sem</TabsTrigger>
        </TabsList>

        <TabsContent value="vlibras" className="flex-1 mt-3">
          <div className="space-y-2 text-xs text-muted-foreground">
            <p>Avatar 3D do VLibras lerá automaticamente o texto do audiobook desta página.</p>
            <div id="vlibras-target" className="p-2 bg-muted/30 rounded text-xs max-h-32 overflow-auto">
              {audiobookText || <span className="italic">Sem texto carregado.</span>}
            </div>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <VLibras forceOnload />
          </div>
        </TabsContent>

        <TabsContent value="human_video" className="flex-1 mt-3 space-y-3">
          {videoUrl ? (
            <div className="space-y-2">
              <Label className="text-xs">Vídeo atual:</Label>
              <video src={videoUrl.startsWith("http") ? videoUrl : `https://rlsipiinlgjytlmrqbav.supabase.co/storage/v1/object/authenticated/interpreter-videos/${videoUrl}`} controls className="w-full rounded" />
            </div>
          ) : (
            <div className="border-2 border-dashed rounded-lg p-6 text-center">
              <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
              <p className="text-xs text-muted-foreground mb-2">Envie o MP4 do intérprete (~{expectedDurationSec.toFixed(0)}s)</p>
            </div>
          )}
          <input ref={fileInput} type="file" accept="video/mp4,video/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} />
          <Button size="sm" variant="outline" className="w-full" onClick={() => fileInput.current?.click()} disabled={uploading}>
            {uploading ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Enviando…</> : <><Upload className="h-3 w-3 mr-1" />{videoUrl ? "Substituir vídeo" : "Enviar vídeo"}</>}
          </Button>
        </TabsContent>

        <TabsContent value="none" className="flex-1 mt-3">
          <p className="text-xs text-muted-foreground">
            Painel direito ficará vazio no vídeo final. Você poderá editar externamente em outro software.
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default InterpreterPanel;