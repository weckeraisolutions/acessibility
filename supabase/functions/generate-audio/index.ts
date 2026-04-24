import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { decode as base64Decode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function prepareText(text: string): string {
  return text
    .replace(/\[.*?\]/g, "")
    .replace(/\n{2,}/g, "\n")
    .replace(/\bIBGE\b/g, "I-B-G-E")
    .replace(/\bBNCC\b/g, "B-N-C-C")
    .replace(/\bONU\b/g, "O-N-U")
    .replace(/\bMEC\b/g, "M-E-C")
    .replace(/\bUSA\b/g, "U-S-A")
    .replace(/\bEUA\b/g, "E-U-A")
    .replace(/\b10\.639\/2003\b/g, "Lei dez mil seiscentos e trinta e nove de dois mil e três")
    .replace(/\b11\.645\/2008\b/g, "Lei onze mil seiscentos e quarenta e cinco de dois mil e oito")
    .trim();
}

function respond(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const GEMINI_REQUEST_TIMEOUT_MS = 55000;
const GEMINI_CHUNK_CHAR_LIMIT = 800;
const GEMINI_PCM_SAMPLE_RATE = 24000;
const GEMINI_PCM_CHANNELS = 1;
const GEMINI_PCM_BITS_PER_SAMPLE = 16;

function splitTextForTts(text: string, maxChars = GEMINI_CHUNK_CHAR_LIMIT): string[] {
  const normalized = text.trim();
  if (!normalized) return [];

  const paragraphs = normalized.split(/\n+/).map((part) => part.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = "";

  const pushCurrent = () => {
    if (current.trim()) {
      chunks.push(current.trim());
      current = "";
    }
  };

  const appendPiece = (piece: string) => {
    const trimmed = piece.trim();
    if (!trimmed) return;

    if (!current) {
      current = trimmed;
      return;
    }

    const candidate = `${current}\n${trimmed}`;
    if (candidate.length <= maxChars) {
      current = candidate;
      return;
    }

    pushCurrent();
    current = trimmed;
  };

  for (const paragraph of paragraphs) {
    if (paragraph.length <= maxChars) {
      appendPiece(paragraph);
      continue;
    }

    const sentences = paragraph.split(/(?<=[.!?])\s+/).map((part) => part.trim()).filter(Boolean);
    const parts = sentences.length ? sentences : [paragraph];
    let local = "";

    for (const part of parts) {
      if (part.length > maxChars) {
        const words = part.split(/\s+/).filter(Boolean);
        let wordChunk = "";

        for (const word of words) {
          const candidate = wordChunk ? `${wordChunk} ${word}` : word;
          if (candidate.length > maxChars && wordChunk) {
            appendPiece(wordChunk);
            wordChunk = word;
          } else {
            wordChunk = candidate;
          }
        }

        if (wordChunk) appendPiece(wordChunk);
        continue;
      }

      const candidate = local ? `${local} ${part}` : part;
      if (candidate.length <= maxChars) {
        local = candidate;
      } else {
        if (local) appendPiece(local);
        local = part;
      }
    }

    if (local) appendPiece(local);
  }

  pushCurrent();
  return chunks.length ? chunks : [normalized];
}

function wrapPcmAsWav(pcmBytes: Uint8Array): Uint8Array {
  const byteRate = GEMINI_PCM_SAMPLE_RATE * GEMINI_PCM_CHANNELS * (GEMINI_PCM_BITS_PER_SAMPLE / 8);
  const blockAlign = GEMINI_PCM_CHANNELS * (GEMINI_PCM_BITS_PER_SAMPLE / 8);
  const dataSize = pcmBytes.length;
  const header = new ArrayBuffer(44);
  const view = new DataView(header);

  view.setUint32(0, 0x52494646, false); // RIFF
  view.setUint32(4, 36 + dataSize, true);
  view.setUint32(8, 0x57415645, false); // WAVE
  view.setUint32(12, 0x666d7420, false); // fmt 
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, GEMINI_PCM_CHANNELS, true);
  view.setUint32(24, GEMINI_PCM_SAMPLE_RATE, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, GEMINI_PCM_BITS_PER_SAMPLE, true);
  view.setUint32(36, 0x64617461, false); // data
  view.setUint32(40, dataSize, true);

  const wavBytes = new Uint8Array(44 + dataSize);
  wavBytes.set(new Uint8Array(header), 0);
  wavBytes.set(pcmBytes, 44);
  return wavBytes;
}

function extractWavData(wavBytes: Uint8Array): Uint8Array {
  if (wavBytes.length < 44) return wavBytes;

  const view = new DataView(wavBytes.buffer, wavBytes.byteOffset, wavBytes.byteLength);
  if (view.getUint32(0, false) !== 0x52494646 || view.getUint32(8, false) !== 0x57415645) {
    return wavBytes;
  }

  let offset = 12;
  while (offset + 8 <= wavBytes.length) {
    const chunkId = view.getUint32(offset, false);
    const chunkSize = view.getUint32(offset + 4, true);

    if (chunkId === 0x64617461) {
      const dataStart = offset + 8;
      const dataEnd = Math.min(dataStart + chunkSize, wavBytes.length);
      return wavBytes.slice(dataStart, dataEnd);
    }

    offset += 8 + chunkSize + (chunkSize % 2);
  }

  return wavBytes.slice(44);
}

async function requestGeminiChunk(
  chunkText: string,
  voice: string,
  styleApplied: string,
  geminiApiKey: string,
): Promise<{ audioBytes: Uint8Array; mimeType: string }> {
  const ttsPrompt = `Você é um narrador profissional de audiobooks educativos brasileiros.
Mantenha exatamente estas características em toda a narração, sem variação:
- Tom de voz: ${styleApplied}
- Ritmo: constante e uniforme do início ao fim, sem acelerar ou desacelerar
- Entonação: neutra e estável, sem dramatizar
- Volume: uniforme durante toda a narração
- Sotaque: português do Brasil nativo, sem variação regional
- Pausas: apenas nas pontuações do texto, sem pausas adicionais
- Este é um trecho de um audiobook maior — manter o mesmo timbre e cadência que seria usado em todo o livro

Narrar 100% do texto sem omitir nenhuma palavra. Siglas pronunciadas letra por letra conforme indicado no texto. Nomes indígenas e africanos com clareza e respeito.

TEXTO PARA NARRAR:

${chunkText}`;

  const model = "gemini-2.5-pro-preview-tts";
  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GEMINI_REQUEST_TIMEOUT_MS);

  let geminiResponse: Response;
  try {
    geminiResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text: ttsPrompt }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
        },
      }),
    });
  } catch (e) {
    clearTimeout(timeoutId);
    if (e instanceof DOMException && e.name === "AbortError") {
      throw { status: 504, error: "timeout", message: "A geração de áudio excedeu o tempo limite. Tente novamente." };
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!geminiResponse.ok) {
    const status = geminiResponse.status;
    const errText = await geminiResponse.text();
    console.error("Gemini TTS error:", status, errText);
    if (status === 400 || status === 403) throw { status: 400, error: "invalid_api_key", message: "Chave da API Gemini inválida" };
    if (status === 429) throw { status: 429, error: "rate_limit", message: "Limite de requisições atingido" };
    throw { status: 500, error: "api_error", message: errText };
  }

  const geminiData = await geminiResponse.json();
  const audioPart = geminiData?.candidates?.[0]?.content?.parts?.[0]?.inlineData;
  if (!audioPart?.data) throw { status: 500, error: "api_error", message: "Nenhum áudio retornado pela API" };

  return {
    audioBytes: base64Decode(audioPart.data),
    mimeType: audioPart.mimeType || "audio/wav",
  };
}

async function generateWithGemini(
  text: string, voice: string, styleApplied: string, geminiApiKey: string
): Promise<{ audioBytes: Uint8Array; mimeType: string }> {
  const prepared = prepareText(text);
  const chunks = splitTextForTts(prepared);

  const results: Array<{ audioBytes: Uint8Array; mimeType: string }> = [];
  for (let i = 0; i < chunks.length; i += 3) {
    const batch = chunks.slice(i, i + 3);
    const batchResults = await Promise.all(
      batch.map((chunkText) => requestGeminiChunk(chunkText, voice, styleApplied, geminiApiKey)),
    );
    results.push(...batchResults);
  }

  if (results.length === 1) {
    const only = results[0];
    if (only.mimeType.includes("L16") || only.mimeType.includes("pcm")) {
      return { audioBytes: wrapPcmAsWav(only.audioBytes), mimeType: "audio/wav" };
    }
    return only;
  }

  const pcmParts = results.map(({ audioBytes, mimeType }) => {
    if (mimeType.includes("L16") || mimeType.includes("pcm")) return audioBytes;
    if (mimeType.includes("wav")) return extractWavData(audioBytes);
    throw { status: 500, error: "api_error", message: "Formato de áudio Gemini não suportado para montagem em múltiplas partes" };
  });

  const totalLength = pcmParts.reduce((sum, part) => sum + part.length, 0);
  const mergedPcm = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of pcmParts) {
    mergedPcm.set(part, offset);
    offset += part.length;
  }

  return { audioBytes: wrapPcmAsWav(mergedPcm), mimeType: "audio/wav" };
}

function preprocessTextForPTBR(text: string): string {
  return text
    .replace(/(\d+(?:,\d+)?)\s*%/g, (_, n) => `${n} por cento`)
    .replace(/R\$\s*([\d.,]+)/g, (_, n) => `${n} reais`)
    .replace(/\.\.\./g, '…')
    .replace(/\s—\s/g, ', ')
    .trim();
}

function deriveProjectSeed(projectId: string): number {
  return Math.abs(projectId.split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % 4294967295;
}

async function generateWithElevenLabs(
  text: string, voiceId: string, modelId: string, apiKey: string,
  projectId?: string, pageNumber?: number, mode?: string, speed: number = 0.92,
  narrationSpeed?: string,
): Promise<{ audioBytes: Uint8Array; mimeType: string }> {
  const prepared = preprocessTextForPTBR(prepareText(text));

  const chunks: string[] = [];
  // Smaller chunks (~3500 chars) ensure voice_settings.speed is applied
  // consistently across the entire narration (not just the final lines).
  const MAX_CHUNK = 3500;
  if (prepared.length > MAX_CHUNK) {
    const paragraphs = prepared.split(/\n+/);
    let current = "";
    const flush = () => { if (current.trim()) { chunks.push(current.trim()); current = ""; } };
    for (const p of paragraphs) {
      if (p.length > MAX_CHUNK) {
        flush();
        const sentences = p.split(/(?<=[.!?])\s+/);
        for (const s of sentences) {
          if ((current + " " + s).length > MAX_CHUNK && current) flush();
          current += (current ? " " : "") + s;
        }
        continue;
      }
      if ((current + "\n" + p).length > MAX_CHUNK && current) flush();
      current += (current ? "\n" : "") + p;
    }
    flush();
  } else {
    chunks.push(prepared);
  }

  // Skip cross-context for "pausada" — context biases the model toward
  // matching the previous chunk's pace, breaking the slow rhythm.
  const skipContext = narrationSpeed === "pausada";

  // Fetch previous page text for prosodic continuity (only if not pausada)
  let previousText: string | undefined;
  if (!skipContext && projectId && pageNumber && pageNumber > 1) {
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, serviceRoleKey);
      const textField = mode === "audiodesc" ? "audiodesc_text" : "audiobook_text";
      const { data: prevPage } = await supabase
        .from("pages")
        .select(textField)
        .eq("project_id", projectId)
        .eq("page_number", pageNumber - 1)
        .single();
      const prevText = prevPage?.[textField];
      if (prevText && typeof prevText === "string" && prevText.length > 0) {
        previousText = prevText.slice(-200);
      }
    } catch { /* ignore - just omit previous_text */ }
  }

  const seed = projectId ? deriveProjectSeed(projectId) : undefined;

  const audioBuffers: Uint8Array[] = [];

  for (let ci = 0; ci < chunks.length; ci++) {
    const chunk = chunks[ci];
    let lastError: string | null = null;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 140000);

    const bodyObj: Record<string, unknown> = {
      text: chunk,
      model_id: "eleven_multilingual_v2",
      language_code: "pt",
      voice_settings: {
        stability: 0.92,
        similarity_boost: 0.90,
        style: 0.20,
        use_speaker_boost: true,
        speed: speed,
      },
    };
    if (seed !== undefined) bodyObj.seed = seed;

    // [TEMP] Verificação do parâmetro speed enviado ao ElevenLabs
    console.log(
      `[ElevenLabs] chunk ${ci + 1}/${chunks.length} voice_settings:`,
      JSON.stringify((bodyObj as { voice_settings: unknown }).voice_settings),
    );

    if (!skipContext) {
      // For first chunk, use previous page context; for subsequent chunks, use previous chunk text
      if (ci === 0 && previousText) {
        bodyObj.previous_text = previousText;
      } else if (ci > 0) {
        bodyObj.previous_text = chunks[ci - 1].slice(-200);
      }
      // For non-last chunks, provide next chunk context
      if (ci < chunks.length - 1) {
        bodyObj.next_text = chunks[ci + 1].slice(0, 200);
      }
    }

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
          {
            method: "POST",
            headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
            signal: controller.signal,
            body: JSON.stringify(bodyObj),
          }
        );

        if (res.ok) {
          const buf = new Uint8Array(await res.arrayBuffer());
          audioBuffers.push(buf);
          lastError = null;
          break;
        }

        const status = res.status;
        const errText = await res.text();
        lastError = errText;

        if (status === 401 || status === 403 || status === 402) {
          clearTimeout(timeoutId);
          const isPaymentRequired = errText.includes("payment_required") || errText.includes("paid_plan_required");
          throw {
            status: 402,
            error: "elevenlabs_credits",
            message: isPaymentRequired
              ? "O plano gratuito do ElevenLabs não permite uso de vozes via API. Atualize para um plano pago do ElevenLabs e substitua a API Key nos Secrets."
              : "Créditos do ElevenLabs esgotados ou chave inválida. Atualize a API Key nos Secrets.",
          };
        }
        if (status === 429) {
          await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
          continue;
        }
        clearTimeout(timeoutId);
        throw { status: 500, error: "elevenlabs_error", message: errText };
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") {
          clearTimeout(timeoutId);
          throw { status: 504, error: "timeout", message: "Timeout na geração ElevenLabs" };
        }
        if ((e as any)?.error) throw e;
        lastError = e instanceof Error ? e.message : "Unknown error";
      }
    }
    clearTimeout(timeoutId);
    if (lastError) throw { status: 500, error: "elevenlabs_error", message: lastError };
  }

  const totalLength = audioBuffers.reduce((sum, b) => sum + b.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const buf of audioBuffers) {
    result.set(buf, offset);
    offset += buf.length;
  }

  return { audioBytes: result, mimeType: "audio/mpeg" };
}

function getExtension(mimeType: string): string {
  if (mimeType.includes("wav")) return "wav";
  if (mimeType.includes("mpeg") || mimeType.includes("mp3")) return "mp3";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("L16") || mimeType.includes("pcm")) return "wav";
  return "wav";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      page_id, project_id, page_number, text, voice,
      global_style, page_style, mode, plan,
      use_elevenlabs, elevenlabs_voice_id, elevenlabs_model, narration_speed,
      skip_page_update, narration_id,
    } = await req.json();

    if (!page_id || !project_id || !text || !mode) {
      return respond({ success: false, error: "missing_fields", message: "Campos obrigatórios faltando" }, 400);
    }

    if (!text.trim() || text.trim() === "PÁGINA_SEM_NARRAÇÃO" || text.trim() === "PÁGINA_SEM_AUDIODESCRIÇÃO") {
      return respond({ success: false, error: "empty_text", message: "Texto vazio ou sem conteúdo narrável" }, 400);
    }

    const styleApplied = page_style?.trim() || global_style?.trim() || "Ritmo fluido e contínuo, dicção clara e precisa em português brasileiro";

    let audioBytes: Uint8Array;
    let mimeType: string;
    let engine = "gemini";

    if (use_elevenlabs) {
      const elApiKey = Deno.env.get("ELEVENLABS_API_KEY");
      if (!elApiKey) return respond({ success: false, error: "elevenlabs_credits", message: "ELEVENLABS_API_KEY não configurada no servidor" }, 500);
      const speedMap: Record<string, number> = { pausada: 0.80, educativo: 0.92, fluente: 1.00 };
      const elSpeed = (typeof narration_speed === "string" && speedMap[narration_speed]) ? speedMap[narration_speed] : 0.92;
      const result = await generateWithElevenLabs(text, elevenlabs_voice_id, elevenlabs_model, elApiKey, project_id, page_number, mode, elSpeed, narration_speed);
      audioBytes = result.audioBytes;
      mimeType = result.mimeType;
      engine = "elevenlabs";
    } else {
      const gemini_api_key = Deno.env.get("GEMINI_API_KEY");
      if (!gemini_api_key) {
        return respond({ success: false, error: "missing_fields", message: "GEMINI_API_KEY não configurada" }, 400);
      }
      // Validate voice is a valid Gemini voice name
      const validGeminiVoices = ["achernar","achird","algenib","algieba","alnilam","aoede","autonoe","callirrhoe","charon","despina","enceladus","erinome","fenrir","gacrux","iapetus","kore","laomedeia","leda","orus","puck","pulcherrima","rasalgethi","sadachbia","sadaltager","schedar","sulafat","umbriel","vindemiatrix","zephyr","zubenelgenubi"];
      const geminiVoice = (voice && validGeminiVoices.includes(voice.toLowerCase())) ? voice : "Zephyr";
      console.log(`[Gemini] Using voice: ${geminiVoice} (requested: ${voice})`);
      const result = await generateWithGemini(text, geminiVoice, styleApplied, gemini_api_key);
      audioBytes = result.audioBytes;
      mimeType = result.mimeType;
    }

    const wordCount = text.split(/\s+/).filter(Boolean).length;
    const estimatedDurationSeconds = parseFloat(((wordCount / 130) * 60).toFixed(2));

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const bucket = mode === "audiobook" ? "audiobook-audios" : "audiodesc-audios";
    const pageNum = String(page_number || 1).padStart(3, "0");
    const ext = getExtension(mimeType);
    const filePath = skip_page_update && narration_id
      ? `${project_id}/narrations/pag_${pageNum}_${narration_id}.${ext}`
      : `${project_id}/pag_${pageNum}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filePath, audioBytes, { contentType: mimeType, upsert: true });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return respond({ success: false, error: "storage_error", message: uploadError.message }, 500);
    }

    const { data: signedUrlData } = await supabase.storage
      .from(bucket)
      .createSignedUrl(filePath, 60 * 60 * 24 * 365);

    const audioUrl = signedUrlData?.signedUrl || "";

    if (!skip_page_update) {
      const audioUrlField = mode === "audiobook" ? "audiobook_audio_url" : "audiodesc_audio_url";
      const statusField = mode === "audiobook" ? "audiobook_status" : "audiodesc_status";
      const durationField = mode === "audiobook" ? "audiobook_audio_duration_seconds" : "audiodesc_audio_duration_seconds";
      const voiceDbField = mode === "audiobook" ? "audiobook_voice" : "audiodesc_voice";
      const styleDbField = mode === "audiobook" ? "audiobook_style" : "audiodesc_style";

      await supabase
        .from("pages")
        .update({
          [audioUrlField]: audioUrl,
          [statusField]: "audio_generated",
          [durationField]: estimatedDurationSeconds,
          [voiceDbField]: engine === "elevenlabs" ? elevenlabs_voice_id : voice,
          [styleDbField]: styleApplied,
          updated_at: new Date().toISOString(),
        })
        .eq("id", page_id);
    }

    return respond({
      success: true,
      audio_url: audioUrl,
      duration_seconds: estimatedDurationSeconds,
      page_id,
      engine,
    });
  } catch (e: any) {
    console.error("generate-audio error:", e);
    if (e?.error) return respond({ success: false, ...e }, e.status || 500);
    return respond({ success: false, error: "api_error", message: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
