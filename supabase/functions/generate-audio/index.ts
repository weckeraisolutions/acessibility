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

async function generateWithGemini(
  text: string, voice: string, styleApplied: string, geminiApiKey: string
): Promise<{ audioBytes: Uint8Array; mimeType: string }> {
  const ttsPrompt = `Você é narrador profissional de audiobooks em português do Brasil.

IDIOMA: português do Brasil nativo em pronúncia, entonação e ritmo.

ESTILO: ${styleApplied}

REGRAS: narrar 100% do texto sem omitir nenhuma palavra. Pronúncia completamente nativa brasileira. Nomes indígenas e africanos com clareza e respeito. Siglas pronunciadas letra por letra conforme indicado no texto. Ritmo constante conforme estilo definido.

TEXTO:

${prepareText(text)}`;

  const model = "gemini-2.5-pro-preview-tts";
  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 140000);

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

  const rawMime = audioPart.mimeType || "audio/wav";
  const pcmBytes = base64Decode(audioPart.data);

  // If Gemini returns raw PCM (L16), wrap with WAV header so browsers can play it
  if (rawMime.includes("L16") || rawMime.includes("pcm")) {
    const sampleRate = 24000;
    const numChannels = 1;
    const bitsPerSample = 16;
    const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
    const blockAlign = numChannels * (bitsPerSample / 8);
    const dataSize = pcmBytes.length;
    const header = new ArrayBuffer(44);
    const view = new DataView(header);
    // RIFF header
    view.setUint32(0, 0x52494646, false); // "RIFF"
    view.setUint32(4, 36 + dataSize, true);
    view.setUint32(8, 0x57415645, false); // "WAVE"
    // fmt chunk
    view.setUint32(12, 0x666d7420, false); // "fmt "
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    // data chunk
    view.setUint32(36, 0x64617461, false); // "data"
    view.setUint32(40, dataSize, true);

    const wavBytes = new Uint8Array(44 + dataSize);
    wavBytes.set(new Uint8Array(header), 0);
    wavBytes.set(pcmBytes, 44);
    return { audioBytes: wavBytes, mimeType: "audio/wav" };
  }

  return { audioBytes: pcmBytes, mimeType: rawMime };
}

async function generateWithElevenLabs(
  text: string, voiceId: string, modelId: string, apiKey: string
): Promise<{ audioBytes: Uint8Array; mimeType: string }> {
  const prepared = prepareText(text);

  const chunks: string[] = [];
  if (prepared.length > 9500) {
    const paragraphs = prepared.split(/\n+/);
    let current = "";
    for (const p of paragraphs) {
      if ((current + "\n" + p).length > 9000 && current) {
        chunks.push(current.trim());
        current = p;
      } else {
        current += (current ? "\n" : "") + p;
      }
    }
    if (current.trim()) chunks.push(current.trim());
  } else {
    chunks.push(prepared);
  }

  const audioBuffers: Uint8Array[] = [];

  for (const chunk of chunks) {
    let lastError: string | null = null;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 140000);

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
          {
            method: "POST",
            headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
            signal: controller.signal,
            body: JSON.stringify({
              text: chunk,
              model_id: modelId || "eleven_multilingual_v2",
              voice_settings: { stability: 0.75, similarity_boost: 0.85, style: 0.5, use_speaker_boost: true },
            }),
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
      use_elevenlabs, elevenlabs_voice_id, elevenlabs_model,
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
      const result = await generateWithElevenLabs(text, elevenlabs_voice_id, elevenlabs_model, elApiKey);
      audioBytes = result.audioBytes;
      mimeType = result.mimeType;
      engine = "elevenlabs";
    } else {
      const gemini_api_key = Deno.env.get("GEMINI_API_KEY");
      if (!voice || !gemini_api_key) {
        return respond({ success: false, error: "missing_fields", message: "Voice e GEMINI_API_KEY são obrigatórios" }, 400);
      }
      const result = await generateWithGemini(text, voice, styleApplied, gemini_api_key);
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
    const filePath = `${project_id}/pag_${pageNum}.${ext}`;

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
