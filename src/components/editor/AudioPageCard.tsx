import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { RotateCw, Play, Download, Check, RefreshCw, Loader2, Square, Plus, Package, X } from "lucide-react";
import { Tables } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { VOICES } from "@/constants/voices";
import { ElevenLabsVoice } from "@/constants/elevenlabs-voices";
import { useDebounce } from "@/hooks/useDebounce";
import { useToast } from "@/hooks/use-toast";
import { useTextExtractor } from "@/hooks/useTextExtractor";
import { TtsEngine } from "@/components/editor/GlobalConfigPanel";
import { usePageNarrations } from "@/hooks/usePageNarrations";
import NarrationBlock from "@/components/editor/NarrationBlock";
import JSZip from "jszip";
import { saveAs } from "file-saver";

type Page = Tables<"pages">;
type Project = Tables<"projects">;

interface AudioPageCardProps {
  page: Page;
  mode: "audiobook" | "audiodesc";
  globalVoice: string;
  project: Project;
  onUpdate: (pageId: string, fields: Partial<Page>) => void;
  ttsEngine: TtsEngine;
  onTtsEngineChange?: (engine: TtsEngine) => void;
  canUseElevenlabs?: boolean;
  elevenlabsVoices: ElevenLabsVoice[];
  selectedElevenlabsVoice: string;
  plan?: string;
  globalNarrationSpeed?: string;
  pageNarrationSpeed?: string | null;
  onPageNarrationSpeedChange?: (v: string | null) => void;
  /** When true, hides the page image header (used inside UnifiedPageCard which renders the image once). */
  hideImage?: boolean;
  /** Optional title shown above the text area when hideImage is true (e.g. "🔊 Narração"). */
  sectionTitle?: string;
}

function getStatus(page: Page, mode: "audiobook" | "audiodesc") {
  const status = mode === "audiobook" ? page.audiobook_status : page.audiodesc_status;
  const audio = mode === "audiobook" ? page.audiobook_audio_url : page.audiodesc_audio_url;
  const text = mode === "audiobook" ? page.audiobook_text : page.audiodesc_text;
  if (status === "approved") return { label: "✅ Aprovado", color: "bg-green-500" };
  if (status === "no_content") return { label: "⬜ Sem conteúdo", color: "bg-muted-foreground/40" };
  if (status === "audio_generated" || audio) return { label: "🔊 Áudio gerado", color: "bg-orange-500" };
  if (text) return { label: "📝 Texto extraído", color: "bg-blue-500" };
  return { label: "○ Pendente", color: "bg-muted-foreground/40" };
}

const AudioPageCard = ({ page, mode, globalVoice, project, onUpdate, ttsEngine, onTtsEngineChange, canUseElevenlabs = true, elevenlabsVoices, selectedElevenlabsVoice, plan, globalNarrationSpeed = "educativo", pageNarrationSpeed = null, onPageNarrationSpeedChange, hideImage = false, sectionTitle }: AudioPageCardProps) => {
  const text = mode === "audiobook" ? page.audiobook_text : page.audiodesc_text;
  const audioUrl = mode === "audiobook" ? page.audiobook_audio_url : page.audiodesc_audio_url;
  const pageVoice = mode === "audiobook" ? page.audiobook_voice : page.audiodesc_voice;
  const pageStyle = mode === "audiobook" ? page.audiobook_style : page.audiodesc_style;
  const currentStatus = mode === "audiobook" ? page.audiobook_status : page.audiodesc_status;
  const status = getStatus(page, mode);
  const { toast } = useToast();
  const extractor = useTextExtractor();

  const isElevenlabs = ttsEngine === "elevenlabs";

  const [localText, setLocalText] = useState(text || "");
  const [localStyle, setLocalStyle] = useState(pageStyle || "");
  const [extracting, setExtracting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showRegen, setShowRegen] = useState(false);
  const [regenStyle, setRegenStyle] = useState("");
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const prevAudioUrlRef = useRef<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);

  // Múltiplas narrações (apenas audiobook)
  const isAudiobook = mode === "audiobook";
  const { narrations, add, addMany, update, remove } = usePageNarrations(
    isAudiobook ? page.id : undefined,
    isAudiobook ? project.id : undefined,
  );
  const [characterSuggestion, setCharacterSuggestion] = useState<Array<{ label: string; text: string }> | null>(null);
  const [zipping, setZipping] = useState(false);

  const handlePreviewVoice = useCallback((voiceId: string, previewUrl?: string) => {
    if (!previewUrl) return;
    if (playingVoiceId === voiceId && previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
      setPlayingVoiceId(null);
      return;
    }
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
    }
    const audio = new Audio(previewUrl);
    audio.onended = () => { setPlayingVoiceId(null); previewAudioRef.current = null; };
    audio.play().catch(() => {});
    previewAudioRef.current = audio;
    setPlayingVoiceId(voiceId);
  }, [playingVoiceId]);

  useEffect(() => { setLocalText(text || ""); }, [text]);
  useEffect(() => { setLocalStyle(pageStyle || ""); }, [pageStyle]);

  // Fetch audio as blob for playback — with correct MIME type
  useEffect(() => {
    if (!audioUrl || audioUrl === prevAudioUrlRef.current) return;
    prevAudioUrlRef.current = audioUrl;

    let cancelled = false;
    setLoadingAudio(true);

    fetch(audioUrl)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch audio");
        return res.arrayBuffer();
      })
      .then((buffer) => {
        if (cancelled) return;
        // Determine correct MIME type from URL extension
        const mime = audioUrl.includes(".mp3") ? "audio/mpeg"
          : audioUrl.includes(".ogg") ? "audio/ogg"
          : "audio/wav";
        const blob = new Blob([buffer], { type: mime });
        setBlobUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return URL.createObjectURL(blob);
        });
      })
      .catch((err) => {
        console.error("Audio fetch error:", err);
        if (!cancelled) setBlobUrl(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingAudio(false);
      });

    return () => { cancelled = true; };
  }, [audioUrl]);

  // Force audio element to load when blobUrl changes
  useEffect(() => {
    if (blobUrl && audioRef.current) {
      audioRef.current.load();
    }
  }, [blobUrl]);

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, []);

  const textField = mode === "audiobook" ? "audiobook_text" : "audiodesc_text";
  const styleField = mode === "audiobook" ? "audiobook_style" : "audiodesc_style";
  const voiceField = mode === "audiobook" ? "audiobook_voice" : "audiodesc_voice";
  const statusField = mode === "audiobook" ? "audiobook_status" : "audiodesc_status";
  const audioUrlField = mode === "audiobook" ? "audiobook_audio_url" : "audiodesc_audio_url";
  const durationField = mode === "audiobook" ? "audiobook_audio_duration_seconds" : "audiodesc_audio_duration_seconds";

  const debouncedSaveText = useDebounce((val: string) => {
    onUpdate(page.id, { [textField]: val || null });
  }, 2000);

  const debouncedSaveStyle = useDebounce((val: string) => {
    onUpdate(page.id, { [styleField]: val || null });
  }, 2000);

  const handleTextChange = (val: string) => {
    setLocalText(val);
    debouncedSaveText(val);
  };

  const handleStyleChange = (val: string) => {
    setLocalStyle(val);
    debouncedSaveStyle(val);
  };

  const handleExtractSingle = async () => {
    setExtracting(true);
    try {
      // Chamada direta para capturar has_characters / suggested_blocks no audiobook
      const { data, error } = await supabase.functions.invoke("extract-text", {
        body: {
          page_id: page.id,
          image_url: page.image_url,
          mode,
          book_type: project.book_type,
          global_style: (mode === "audiobook" ? project.audiobook_global_style : project.audiodesc_global_style) || "",
          page_style: (mode === "audiobook" ? page.audiobook_style : page.audiodesc_style) || "",
          narration_text: mode === "audiodesc" ? (page.audiobook_text || "") : "",
        },
      });
      if (error || !data?.success) {
        toast({ title: "Erro", description: data?.message || "Falha ao extrair texto.", variant: "destructive" });
        return;
      }
      const tField = mode === "audiobook" ? "audiobook_text" : "audiodesc_text";
      const sField = mode === "audiobook" ? "audiobook_status" : "audiodesc_status";
      onUpdate(page.id, { [tField]: data.text, [sField]: data.no_content ? "no_content" : "extracted" });
      toast({ title: "Texto extraído", description: `Página ${page.page_number} processada.` });
      if (isAudiobook && data.has_characters && Array.isArray(data.suggested_blocks) && data.suggested_blocks.length > 1) {
        setCharacterSuggestion(data.suggested_blocks);
      }
    } catch {
      toast({ title: "Erro", description: "Falha ao extrair texto.", variant: "destructive" });
    } finally {
      setExtracting(false);
    }
  };

  const applyCharacterSuggestion = async () => {
    if (!characterSuggestion || characterSuggestion.length === 0) return;
    // Primeiro bloco vira "Narração principal" (atualiza o texto da página)
    const [first, ...rest] = characterSuggestion;
    const tField = mode === "audiobook" ? "audiobook_text" : "audiodesc_text";
    setLocalText(first.text);
    onUpdate(page.id, { [tField]: first.text });
    if (rest.length) {
      await addMany(rest.map((b) => ({ label: b.label, text: b.text })));
    }
    setCharacterSuggestion(null);
    toast({ title: "Narrações criadas", description: `${rest.length} bloco(s) adicionado(s).` });
  };

  const handleAddNarration = async () => {
    await add({ label: `Narração ${narrations.length + 2}` });
  };

  const handleDownloadAllZip = async () => {
    const blocks = narrations.filter((n) => n.audio_url);
    const hasMain = !!audioUrl;
    if (!hasMain && blocks.length === 0) {
      toast({ title: "Nada a baixar", description: "Gere ao menos um áudio nesta página." });
      return;
    }
    setZipping(true);
    try {
      const zip = new JSZip();
      const pageNum = String(page.page_number).padStart(3, "0");
      if (hasMain) {
        const r = await fetch(audioUrl!);
        zip.file(`pagina_${pageNum}_01_narracao_principal.mp3`, await r.blob());
      }
      let idx = hasMain ? 2 : 1;
      for (const n of blocks) {
        const r = await fetch(n.audio_url!);
        const safe = n.label.toLowerCase().replace(/[^a-z0-9]+/g, "_");
        zip.file(`pagina_${pageNum}_${String(idx).padStart(2, "0")}_${safe}.mp3`, await r.blob());
        idx++;
      }
      const blob = await zip.generateAsync({ type: "blob" });
      saveAs(blob, `pagina_${pageNum}_blocos.zip`);
    } catch {
      toast({ title: "Erro", description: "Falha ao criar ZIP.", variant: "destructive" });
    } finally {
      setZipping(false);
    }
  };

  // Valid Gemini voice names
  const GEMINI_VOICES = VOICES.map(v => v.value);
  const isGeminiVoice = (v: string | null) => v && GEMINI_VOICES.includes(v);

  // For Gemini: only use pageVoice if it's a valid Gemini voice name
  const currentVoice = (pageVoice && isGeminiVoice(pageVoice)) ? pageVoice : globalVoice;
  const isCustomVoice = !!pageVoice && isGeminiVoice(pageVoice) && pageVoice !== globalVoice;

  // For ElevenLabs: per-page voice or fallback to global
  const currentElevenlabsVoice = (pageVoice && !isGeminiVoice(pageVoice)) ? pageVoice : selectedElevenlabsVoice;
  const isCustomElevenlabsVoice = !!pageVoice && !isGeminiVoice(pageVoice) && pageVoice !== selectedElevenlabsVoice;

  const handleElevenlabsVoiceSelect = (voiceId: string) => {
    // If selecting the same as global, clear per-page override
    const value = voiceId === selectedElevenlabsVoice ? null : voiceId;
    onUpdate(page.id, { [voiceField]: value });
  };

  const globalStyle = mode === "audiobook" ? project.audiobook_global_style : project.audiodesc_global_style;

  const handleGenerateAudio = async (extraStyle?: string) => {
    if (!localText.trim()) {
      toast({ title: "Texto necessário", description: "Extraia o texto desta página primeiro.", variant: "destructive" });
      return;
    }

    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-audio", {
        body: {
          page_id: page.id,
          project_id: project.id,
          page_number: page.page_number,
          text: localText,
          voice: currentVoice,
          global_style: globalStyle || "",
          page_style: extraStyle || localStyle || "",
          mode,
          plan: plan || "free",
          use_elevenlabs: isElevenlabs,
          elevenlabs_voice_id: currentElevenlabsVoice,
          elevenlabs_model: "eleven_multilingual_v2",
          narration_speed: pageNarrationSpeed || globalNarrationSpeed,
        },
      });

      if (error) {
        let msg = "Falha na geração de áudio.";
        try {
          const parsed = typeof error === "string" ? JSON.parse(error) : error;
          msg = parsed?.message || parsed?.context?.message || msg;
        } catch { msg = error.message || msg; }
        toast({ title: "Erro", description: msg, variant: "destructive" });
        return;
      }

      if (!data?.success) {
        const errorMap: Record<string, string> = {
          timeout: "A geração excedeu o tempo limite. Tente novamente.",
          rate_limit: "Limite de requisições atingido. Aguarde alguns segundos.",
          invalid_api_key: "Chave da API inválida. Verifique os Secrets.",
          elevenlabs_credits: "Créditos do ElevenLabs esgotados. Atualize a API Key.",
          empty_text: "Texto vazio ou sem conteúdo narrável.",
        };
        const msg = errorMap[data?.error] || data?.message || "Erro desconhecido na geração.";
        toast({ title: "Erro", description: msg, variant: "destructive" });
        return;
      }

      // Reset ref to force re-fetch of new audio
      prevAudioUrlRef.current = null;

      // Save the correct voice based on engine used
      const savedVoice = isElevenlabs ? currentElevenlabsVoice : currentVoice;
      onUpdate(page.id, {
        [audioUrlField]: data.audio_url,
        [statusField]: "audio_generated",
        [durationField]: data.duration_seconds,
        [voiceField]: savedVoice,
        [styleField]: extraStyle || localStyle || null,
      });

      toast({ title: "Áudio gerado", description: `Página ${page.page_number} — ${data.duration_seconds}s (${data.engine})` });
      setShowRegen(false);
      setRegenStyle("");
    } catch (e) {
      toast({ title: "Erro", description: "Falha na comunicação com o servidor.", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async () => {
    if (!audioUrl) return;
    try {
      const res = await fetch(audioUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const pageNum = String(page.page_number).padStart(3, "0");
      const ext = audioUrl.includes(".wav") ? "wav" : "mp3";
      a.download = `pagina_${pageNum}_${mode}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Erro", description: "Falha ao baixar o áudio.", variant: "destructive" });
    }
  };

  const handleApprove = () => {
    onUpdate(page.id, { [statusField]: "approved" });
    toast({ title: "Aprovado", description: `Página ${page.page_number} aprovada.` });
  };

  const handleRegenConfirmed = () => {
    handleGenerateAudio(regenStyle);
  };

  const isApproved = currentStatus === "approved";

  return (
    <Card className="overflow-hidden">
      {!hideImage && (
        <div className="relative bg-muted aspect-[3/4] flex items-center justify-center">
        {(page.thumbnail_url || page.image_url) ? (
          <img src={page.thumbnail_url || page.image_url || ""} alt={`Página ${page.page_number}`} className="w-full h-full object-contain" />
        ) : (
          <span className="text-muted-foreground text-sm">Sem imagem</span>
        )}
        <Badge className={`absolute top-2 right-2 text-[10px] ${status.color} text-white border-0`}>
          {status.label}
        </Badge>
        <span className="absolute bottom-2 left-2 text-xs bg-background/80 rounded px-1.5 py-0.5">
          Página {page.page_number}
        </span>
        </div>
      )}

      <CardContent className="p-3 space-y-3">
        {hideImage && (
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-2xl">
              {sectionTitle || (mode === "audiobook" ? "🔊 Narração" : "🖼️ Audiodescrição")}
            </h4>
            <Badge className={`text-[10px] ${status.color} text-white border-0`}>{status.label}</Badge>
          </div>
        )}
        <div>
          {isAudiobook && narrations.length > 0 && (
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1 block">
              Narração principal
            </Label>
          )}
          <Textarea
            rows={8}
            value={localText}
            onChange={(e) => handleTextChange(e.target.value)}
            placeholder="Texto ainda não extraído. Clique em Extrair para processar."
          />
          <Button variant="outline" size="sm" className="mt-1 w-full" onClick={handleExtractSingle} disabled={extracting}>
            {extracting ? (
              <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Extraindo...</>
            ) : (
              <><RotateCw className="h-3 w-3 mr-1" /> Extrair esta página</>
            )}
          </Button>
          {isAudiobook && characterSuggestion && (
            <div className="mt-2 rounded-md border border-primary/30 bg-primary/5 p-2 text-xs space-y-2">
              <div className="flex items-start gap-1">
                <span>💬</span>
                <span className="flex-1">Esta página pode conter falas de personagens. Deseja separar em narrações individuais?</span>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => setCharacterSuggestion(null)}
                  aria-label="Fechar"
                ><X className="h-3 w-3" /></button>
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="h-7 text-xs flex-1" onClick={applyCharacterSuggestion}>
                  Separar automaticamente
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setCharacterSuggestion(null)}>
                  Ignorar
                </Button>
              </div>
            </div>
          )}
        </div>

        {onTtsEngineChange && (
          <div>
            <Label className="text-xs">Motor de Voz (TTS):</Label>
            <Select value={ttsEngine} onValueChange={(v) => onTtsEngineChange(v as TtsEngine)}>
              <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="gemini">🤖 Google Gemini TTS</SelectItem>
                <SelectItem value="elevenlabs" disabled={!canUseElevenlabs}>
                  ✨ ElevenLabs {!canUseElevenlabs && "(indisponível)"}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        <div>
          <div className="flex items-center gap-2">
            <Label className="text-xs">Voz:</Label>
            {isElevenlabs && isCustomElevenlabsVoice && <Badge variant="secondary" className="text-[10px]">✏️ Personalizada</Badge>}
            {isElevenlabs && !isCustomElevenlabsVoice && <Badge variant="secondary" className="text-[10px]">✨ ElevenLabs</Badge>}
            {!isElevenlabs && isCustomVoice && <Badge variant="secondary" className="text-[10px]">✏️ Personalizada</Badge>}
          </div>
          {isElevenlabs ? (
            <div className="mt-1 border rounded-md p-1 space-y-0.5 max-h-32 overflow-y-auto">
              {elevenlabsVoices.map((v) => (
                <div
                  key={v.voice_id}
                  className={`flex items-center gap-1.5 px-1.5 py-1 rounded text-xs cursor-pointer transition-colors ${currentElevenlabsVoice === v.voice_id ? "bg-primary/10 font-medium" : "hover:bg-accent"}`}
                  onClick={() => handleElevenlabsVoiceSelect(v.voice_id)}
                >
                  {v.preview_url && (
                    <button
                      type="button"
                      className="shrink-0 h-5 w-5 flex items-center justify-center rounded-full border hover:bg-accent"
                      onClick={(e) => { e.stopPropagation(); handlePreviewVoice(v.voice_id, v.preview_url); }}
                    >
                      {playingVoiceId === v.voice_id ? <Square className="h-2.5 w-2.5" /> : <Play className="h-2.5 w-2.5" />}
                    </button>
                  )}
                  <span className="truncate">{v.name}</span>
                  {currentElevenlabsVoice === v.voice_id && <Badge variant="secondary" className="ml-auto text-[8px] shrink-0">✓</Badge>}
                </div>
              ))}
            </div>
          ) : (
            <Select
              value={currentVoice}
              onValueChange={(v) => onUpdate(page.id, { [voiceField]: v === globalVoice ? null : v })}
            >
              <SelectTrigger className="mt-1 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VOICES.map((v) => (
                  <SelectItem key={v.value} value={v.value}>{v.label} — {v.description}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div>
          <Label className="text-xs">Estilo:</Label>
          <Input
            value={localStyle}
            onChange={(e) => handleStyleChange(e.target.value)}
            placeholder="Herda configuração global se vazio"
            className="mt-1 h-8 text-xs"
          />
        </div>

        {isElevenlabs && (
          <div>
            <div className="flex items-center gap-2">
              <Label className="text-xs">Velocidade:</Label>
              {pageNarrationSpeed && <Badge variant="secondary" className="text-[10px]">✏️ Personalizada</Badge>}
            </div>
            <Select
              value={pageNarrationSpeed || globalNarrationSpeed}
              onValueChange={(v) => onPageNarrationSpeedChange?.(v === globalNarrationSpeed ? null : v)}
            >
              <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pausada">🐢 Pausada</SelectItem>
                <SelectItem value="educativo">📚 Ritmo educativo</SelectItem>
                <SelectItem value="fluente">⚡ Fluente</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-2">
          <Button size="sm" className="w-full" disabled={!localText.trim() || generating} onClick={() => handleGenerateAudio()}>
            {generating ? (
              <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Gerando...</>
            ) : (
              <><Play className="h-3 w-3 mr-1" /> Gerar Áudio</>
            )}
          </Button>

          {(blobUrl || loadingAudio) && (
            <>
              {loadingAudio ? (
                <div className="flex items-center justify-center h-8 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" /> Carregando áudio...
                </div>
              ) : (
                <audio ref={audioRef} controls className="w-full h-8">
                  <source src={blobUrl!} type={audioUrl?.includes(".mp3") ? "audio/mpeg" : "audio/wav"} />
                </audio>
              )}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={handleDownload}>
                  <Download className="h-3 w-3 mr-1" /> Download
                </Button>
                <Button variant="outline" size="sm" className="flex-1" onClick={handleApprove}>
                  <Check className="h-3 w-3 mr-1" /> Aprovar
                </Button>
              </div>
              {!showRegen ? (
                <Button variant="ghost" size="sm" className="w-full" onClick={() => setShowRegen(true)}>
                  <RefreshCw className="h-3 w-3 mr-1" /> Regerar com ajuste
                </Button>
              ) : (
                <div className="space-y-1">
                  <Input
                    value={regenStyle}
                    onChange={(e) => setRegenStyle(e.target.value)}
                    placeholder="Ex: mais lento, tom grave..."
                    className="h-8 text-xs"
                  />
                  <div className="flex gap-2">
                    {isApproved ? (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" className="flex-1" disabled={generating || !regenStyle.trim()}>
                            {generating ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                            Regerar
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Regerar áudio aprovado?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta página já está aprovada. Deseja regerar o áudio e remover a aprovação?
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={handleRegenConfirmed}>Sim, regerar</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    ) : (
                      <Button size="sm" className="flex-1" onClick={handleRegenConfirmed} disabled={generating || !regenStyle.trim()}>
                        {generating ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                        Regerar
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => { setShowRegen(false); setRegenStyle(""); }}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {isAudiobook && (
          <div className="space-y-2 pt-2 border-t">
            {narrations.map((n) => (
              <NarrationBlock
                key={n.id}
                narration={n}
                page={page}
                project={project}
                ttsEngine={ttsEngine}
                globalVoice={globalVoice}
                elevenlabsVoices={elevenlabsVoices}
                selectedElevenlabsVoice={selectedElevenlabsVoice}
                globalNarrationSpeed={globalNarrationSpeed}
                plan={plan}
                onUpdate={update}
                onRemove={remove}
              />
            ))}
            <Button variant="outline" size="sm" className="w-full" onClick={handleAddNarration}>
              <Plus className="h-3 w-3 mr-1" /> Adicionar narração
            </Button>
            {(narrations.some((n) => n.audio_url) || (narrations.length > 0 && audioUrl)) && (
              <Button variant="ghost" size="sm" className="w-full" onClick={handleDownloadAllZip} disabled={zipping}>
                {zipping ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Package className="h-3 w-3 mr-1" />}
                Baixar todos os blocos como ZIP
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AudioPageCard;
