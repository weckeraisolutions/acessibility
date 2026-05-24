import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Play, Download, Trash2, Pencil, Check, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/useDebounce";
import { VOICES } from "@/constants/voices";
import { ElevenLabsVoice } from "@/constants/elevenlabs-voices";
import { TtsEngine } from "@/components/editor/GlobalConfigPanel";
import RhythmPreviewDialog from "@/components/editor/RhythmPreviewDialog";
import type { PageNarration } from "@/hooks/usePageNarrations";
import type { Tables } from "@/integrations/supabase/types";

type Page = Tables<"pages">;
type Project = Tables<"projects">;

interface Props {
  narration: PageNarration;
  page: Page;
  project: Project;
  ttsEngine: TtsEngine;
  globalVoice: string;
  elevenlabsVoices: ElevenLabsVoice[];
  selectedElevenlabsVoice: string;
  globalNarrationSpeed: string;
  plan?: string;
  onUpdate: (id: string, fields: Partial<PageNarration>) => void;
  onRemove: (id: string) => void;
}

const NarrationBlock = ({
  narration, page, project, ttsEngine, globalVoice, elevenlabsVoices,
  selectedElevenlabsVoice, globalNarrationSpeed, plan, onUpdate, onRemove,
}: Props) => {
  const { toast } = useToast();
  const isElevenlabs = ttsEngine === "elevenlabs";
  const [localText, setLocalText] = useState(narration.text || "");
  const [localLabel, setLocalLabel] = useState(narration.label);
  const [editingLabel, setEditingLabel] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [showRhythmPreview, setShowRhythmPreview] = useState(false);
  const [advancedRhythm, setAdvancedRhythm] = useState(false);
  const prevAudioRef = useRef<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // blobUrlRef tracks the latest blob URL for safe cleanup on unmount.
  // The cleanup useEffect captures the ref (not the state) so it always
  // revokes the most-recently-created URL regardless of render timing.
  const blobUrlRef = useRef<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { setLocalText(narration.text || ""); }, [narration.text]);
  useEffect(() => { setLocalLabel(narration.label); }, [narration.label]);

  // Fetch audio as blob
  useEffect(() => {
    if (!narration.audio_url || narration.audio_url === prevAudioRef.current) return;
    prevAudioRef.current = narration.audio_url;
    let cancelled = false;
    fetch(narration.audio_url, { cache: "no-store" })
      .then((r) => r.arrayBuffer())
      .then((buf) => {
        if (cancelled) return;
        const mime = narration.audio_url!.includes(".mp3") ? "audio/mpeg" : "audio/wav";
        setBlobUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          const next = URL.createObjectURL(new Blob([buf], { type: mime }));
          blobUrlRef.current = next; // keep ref in sync for cleanup
          return next;
        });
      })
      .catch(() => { if (!cancelled) setBlobUrl(null); });
    return () => { cancelled = true; };
  }, [narration.audio_url]);

  // Cleanup on unmount — uses ref to capture the latest blob URL, not the
  // stale initial null from the closure if using state directly.
  useEffect(() => () => { if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current); }, []);

  // Force <audio> element to reload whenever the blob (or the narration) changes.
  // Without this the browser may keep playing the previously cached MP3 after a regen.
  useEffect(() => {
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current.load();
      } catch { /* ignore */ }
    }
  }, [blobUrl, narration.updated_at]);

  const debouncedText = useDebounce((v: string) => onUpdate(narration.id, { text: v || null }), 1500);
  const handleTextChange = (v: string) => { setLocalText(v); debouncedText(v); };

  // Auto-resize textarea to fit content — removes the need to manually drag
  // the resize handle to see all extracted text. Max 50vh to avoid infinite growth.
  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, window.innerHeight * 0.5)}px`;
  }, []);
  useEffect(() => { autoResize(); }, [localText, autoResize]);

  const saveLabel = () => {
    const trimmed = localLabel.trim() || "Narração";
    setLocalLabel(trimmed);
    onUpdate(narration.id, { label: trimmed });
    setEditingLabel(false);
  };

  const currentVoice = narration.voice_id || (isElevenlabs ? selectedElevenlabsVoice : globalVoice);
  const currentSpeed = narration.narration_speed || globalNarrationSpeed;

  const handleGenerate = async () => {
    if (!localText.trim()) {
      toast({ title: "Texto necessário", description: "Adicione um texto a este bloco.", variant: "destructive" });
      return;
    }
    setGenerating(true);
    try {
      const effectiveSpeed = currentSpeed || globalNarrationSpeed || "educativo";
      const { data, error } = await supabase.functions.invoke("generate-audio", {
        body: {
          page_id: page.id,
          project_id: project.id,
          page_number: page.page_number,
          text: localText,
          voice: !isElevenlabs ? currentVoice : globalVoice,
          global_style: project.audiobook_global_style || "",
          page_style: narration.style || "",
          mode: "audiobook",
          plan: plan || "free",
          use_elevenlabs: isElevenlabs,
          elevenlabs_voice_id: isElevenlabs ? currentVoice : selectedElevenlabsVoice,
          elevenlabs_model: "eleven_multilingual_v2",
          narration_speed: effectiveSpeed,
          // Hint to backend (ignored if not supported) — keeps DB row write here, not on `pages`.
          skip_page_update: true,
          narration_id: narration.id,
          advanced_mode: advancedRhythm,
        },
      });
      if (error || !data?.success) {
        const msg = data?.message || (error as { message?: string })?.message || "Falha na geração.";
        toast({ title: "Erro", description: msg, variant: "destructive" });
        return;
      }
      prevAudioRef.current = null;
      onUpdate(narration.id, {
        audio_url: data.audio_url,
        audio_duration_seconds: data.duration_seconds,
        status: "audio_generated",
        voice_id: currentVoice,
        voice_engine: isElevenlabs ? "elevenlabs" : "gemini",
        narration_speed: effectiveSpeed,
        // Optimistically bump updated_at so the player <audio key={...}> remounts immediately.
        updated_at: new Date().toISOString(),
      });
      toast({ title: "Áudio gerado", description: `${narration.label} — ${data.duration_seconds}s` });
    } catch {
      toast({ title: "Erro", description: "Falha de comunicação.", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async () => {
    if (!narration.audio_url) return;
    try {
      const res = await fetch(narration.audio_url);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const safe = narration.label.toLowerCase().replace(/[^a-z0-9]+/g, "_");
      a.href = url;
      a.download = `pagina_${String(page.page_number).padStart(3, "0")}_${String(narration.position).padStart(2, "0")}_${safe}.mp3`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Erro", description: "Falha ao baixar.", variant: "destructive" });
    }
  };

  return (
    <div className="border rounded-md p-2 space-y-2 bg-muted/30">
      <div className="flex items-center gap-2">
        {editingLabel ? (
          <>
            <Input
              value={localLabel}
              onChange={(e) => setLocalLabel(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") saveLabel(); }}
              className="h-7 text-xs"
              autoFocus
            />
            <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={saveLabel}>
              <Check className="h-3 w-3" />
            </Button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="flex items-center gap-1 text-xs font-medium hover:text-primary"
              onClick={() => setEditingLabel(true)}
              title="Renomear"
            >
              {localLabel}
              <Pencil className="h-2.5 w-2.5 opacity-60" />
            </button>
            <Button size="icon" variant="ghost" className="h-6 w-6 ml-auto text-destructive hover:text-destructive" onClick={() => onRemove(narration.id)}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </>
        )}
      </div>

      <Textarea
        ref={textareaRef}
        value={localText}
        onChange={(e) => handleTextChange(e.target.value)}
        placeholder="Texto desta narração..."
        className="text-xs min-h-[80px] resize-y overflow-hidden"
      />

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-[10px] text-muted-foreground">Voz</Label>
          {isElevenlabs ? (
            <Select value={currentVoice} onValueChange={(v) => onUpdate(narration.id, { voice_id: v, voice_engine: "elevenlabs" })}>
              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {elevenlabsVoices.map((v) => (
                  <SelectItem key={v.voice_id} value={v.voice_id}>{v.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Select value={currentVoice} onValueChange={(v) => onUpdate(narration.id, { voice_id: v, voice_engine: "gemini" })}>
              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {VOICES.map((v) => (<SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>))}
              </SelectContent>
            </Select>
          )}
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">Velocidade</Label>
          <Select value={currentSpeed} onValueChange={(v) => onUpdate(narration.id, { narration_speed: v })}>
            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pausada">🐢 Pausada</SelectItem>
              <SelectItem value="educativo">📚 Educativa</SelectItem>
              <SelectItem value="fluente">⚡ Fluente</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isElevenlabs && (
        <div className="flex flex-wrap gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-6 px-2 text-[10px] flex-1"
            onClick={() => setShowRhythmPreview(true)}
          >
            <Eye className="h-2.5 w-2.5 mr-1" /> Ver pausas
          </Button>
          <Button
            type="button"
            size="sm"
            variant={advancedRhythm ? "default" : "outline"}
            className="h-6 px-2 text-[10px] flex-1"
            onClick={() => setAdvancedRhythm((v) => !v)}
          >
            <Pencil className="h-2.5 w-2.5 mr-1" />
            {advancedRhythm ? "Manual ON" : "Editar manual"}
          </Button>
        </div>
      )}
      {advancedRhythm && (
        <p className="text-[9px] text-muted-foreground leading-snug">
          Use <code>{`<break time="1s" />`}</code> para pausa (0.1s a 3s).
        </p>
      )}

      <Button size="sm" className="w-full h-7 text-xs" disabled={!localText.trim() || generating} onClick={handleGenerate}>
        {generating ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Gerando...</> : <><Play className="h-3 w-3 mr-1" /> Gerar áudio</>}
      </Button>

      {blobUrl && (
        <>
          <audio
            ref={audioRef}
            key={`${narration.id}-${narration.updated_at}`}
            controls
            className="w-full h-7"
            preload="metadata"
          >
            <source src={blobUrl} type="audio/mpeg" />
          </audio>
          <Button variant="outline" size="sm" className="w-full h-7 text-xs" onClick={handleDownload}>
            <Download className="h-3 w-3 mr-1" /> Download MP3
          </Button>
        </>
      )}

      <RhythmPreviewDialog
        open={showRhythmPreview}
        onClose={() => setShowRhythmPreview(false)}
        text={localText}
        preset={currentSpeed || "educativo"}
        advancedMode={advancedRhythm}
      />
    </div>
  );
};

export default NarrationBlock;