import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { decode as base64Decode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { callGeminiWithFailover, validateGeminiKeysConfigured, isBothKeysFailed } from "../_shared/gemini-keys.ts";
import { normalizeText, preprocessForTTS } from "../_shared/text-utils.ts";
import { getAuthedUser, userOwnsProject } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// prepareText is now the shared normalizeText utility.
const prepareText = normalizeText;

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

/**
 * Centralized speed resolver.
 * Single source of truth: frontend sends a STRING preset; backend converts to number.
 * Tolerant to legacy / mistyped presets. Always returns a valid number in [0.7, 1.2].
 *
 * ElevenLabs documented speed range: 0.7 (min) – 1.2 (max), default 1.0.
 * Values are intentionally spread across the range so users perceive a clear
 * difference between presets:
 *   pausada  : 0.75 → 25% slower than fluente — clearly audible
 *   educativo: 0.90 → 10% slower — measured educational pace
 *   fluente  : 1.05 → slightly above default — brisk natural flow
 *
 * Previous values (0.85 / 0.95 / 1.00) covered only 15% of the range and
 * were essentially inaudible as distinct presets.
 */
const SPEED_PRESET_MAP: Record<string, number> = {
  pausada: 0.75,
  educativo: 0.90,
  educativa: 0.90, // alias tolerated
  educational: 0.90, // alias tolerated
  fluente: 1.05,
  fluido: 1.05, // alias tolerated
};

function resolveSpeed(preset: unknown): { preset: string; value: number; fallback_used: boolean } {
  const raw = typeof preset === "string" ? preset.trim().toLowerCase() : "";
  const mapped = SPEED_PRESET_MAP[raw];
  if (typeof mapped === "number") {
    const clamped = Math.min(1.2, Math.max(0.7, mapped));
    return { preset: raw, value: clamped, fallback_used: false };
  }
  return { preset: "educativo", value: 0.90, fallback_used: true };
}

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

  let geminiResponse: Response;
  try {
    geminiResponse = await callGeminiWithFailover(async (apiKey, _idx) => {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), GEMINI_REQUEST_TIMEOUT_MS);
      try {
        return await fetch(geminiUrl, {
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
      } finally {
        clearTimeout(timeoutId);
      }
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      throw { status: 504, error: "timeout", message: "A geração de áudio excedeu o tempo limite. Tente novamente." };
    }
    if (isBothKeysFailed(e)) {
      const status = e.last_status;
      const errText = e.last_error_text || "";
      if (status === 429) {
        const isQuotaExceeded = errText.includes("RESOURCE_EXHAUSTED") || errText.includes("quota");
        throw {
          status: 429,
          error: "gemini_quota_exceeded",
          message: isQuotaExceeded
            ? "Quota diária do Gemini TTS excedida em ambas as chaves Google. Troque o motor de voz para ElevenLabs no painel acima ou aguarde ~24h para o reset."
            : "Limite de requisições do Gemini atingido em ambas as chaves. Aguarde alguns segundos e tente novamente, ou use ElevenLabs.",
        };
      }
      throw { status: 500, error: "api_error", message: `Erro Gemini em ambas as chaves: ${status} ${errText.slice(0, 200)}` };
    }
    throw e;
  }

  if (!geminiResponse.ok) {
    const status = geminiResponse.status;
    const errText = await geminiResponse.text();
    console.error("Gemini TTS error:", status, errText);
    if (status === 400 || status === 403) throw { status: 400, error: "invalid_api_key", message: "Chave da API Gemini inválida" };
    if (status === 429) {
      const isQuotaExceeded = errText.includes("RESOURCE_EXHAUSTED") || errText.includes("quota");
      throw {
        status: 429,
        error: "gemini_quota_exceeded",
        message: isQuotaExceeded
          ? "Quota diária do Gemini TTS excedida (limite gratuito de 50 áudios/dia). Troque o motor de voz para ElevenLabs no painel acima ou aguarde ~24h para o reset da cota Google."
          : "Limite de requisições do Gemini atingido. Aguarde alguns segundos e tente novamente, ou use ElevenLabs.",
      };
    }
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
  text: string, voice: string, styleApplied: string,
): Promise<{ audioBytes: Uint8Array; mimeType: string }> {
  const prepared = prepareText(text);
  const chunks = splitTextForTts(prepared);

  const results: Array<{ audioBytes: Uint8Array; mimeType: string }> = [];
  for (let i = 0; i < chunks.length; i += 3) {
    const batch = chunks.slice(i, i + 3);
    const batchResults = await Promise.all(
      batch.map((chunkText) => requestGeminiChunk(chunkText, voice, styleApplied)),
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

// preprocessTextForPTBR is now the shared preprocessForTTS utility.
const preprocessTextForPTBR = preprocessForTTS;

/**
 * Aggressive normalization for ElevenLabs only.
 * Goal: present a single coherent prosodic context so the model applies
 * voice_settings.speed uniformly from start to end. Prevents the model
 * from "resetting" cadence on every short list item / line break.
 */
function normalizeForElevenLabs(text: string): string {
  let t = text;
  t = t.replace(/([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ ]{1,30}):\s+/g, "$1 — ");
  t = t.replace(/\s*\n+\s*/g, " ");
  // Preserve breathing room around <break .../> tags so the model treats
  // them as standalone prosodic events even after whitespace collapsing.
  t = t.replace(/\s*<break([^>]*)\/>\s*/g, " <break$1 /> ");
  t = t.replace(/\s+\/\s+/g, ", ");
  t = t.replace(/\s{2,}/g, " ");
  return t.trim();
}

/**
 * Speed-appropriate warm-up text sent as `previous_text` to the ElevenLabs API.
 *
 * THE CORE PROBLEM THIS SOLVES:
 * Without `previous_text`, ElevenLabs starts every generation "cold" at its
 * default pace (~1.0) and only gradually converges to voice_settings.speed
 * over the duration of the text. For short-to-medium pages (< 4500 chars =
 * one chunk), this means the beginning sounds fluent and only the very last
 * lines reach the target cadence — exactly the symptom: "fluido no início,
 * pausado só na última linha."
 *
 * HOW THE FIX WORKS:
 * `previous_text` tells the model "this text was already spoken just before."
 * The model uses it as prosodic context: it "imagines" having generated that
 * text at voice_settings.speed, then continues the actual narration at that
 * same speed from word one. For pausada (0.75) and educativo (0.90), we send
 * a crafted warm-up paragraph, forcing the model to start at the correct
 * cadence immediately — without any audible artefact in the output audio.
 *
 * For fluente (1.05) we keep using the actual previous page text — natural
 * cross-page continuity is the desired behaviour there.
 */
const SPEED_WARMUP_TEXT: Record<string, string> = {
  pausada:
    "O conteúdo a seguir será narrado em ritmo pausado e deliberado. " +
    "Cada informação é apresentada com calma, permitindo que o ouvinte absorva " +
    "e compreenda cada detalhe antes de avançar para o próximo ponto.",
  educativo:
    "O conteúdo a seguir é narrado em ritmo educativo, moderado e preciso. " +
    "As informações são apresentadas de forma clara e organizada, " +
    "favorecendo a compreensão e o aprendizado do material.",
};

/** @deprecated No longer used — speed priming is handled via previous_text warm-up. */
function rhythmPrefix(_narrationSpeed?: string): string {
  return ""; // prefix removed: it added audible artefacts and was redundant
}

/**
 * ── Professional rhythm control via SSML-style <break> tags ──
 * Inserts explicit pause markers based on the chosen preset. The numeric
 * `speed` setting still applies on top of these tags, but the bulk of the
 * cadence comes from the explicit pauses — far more reliable than relying
 * on speed alone, which drifts across long chunks.
 *
 * Detected events:
 *   - paragraph break (\n\n)
 *   - heading (ALL-CAPS line OR line ending with ":" then blank line)
 *   - ellipsis ("..." or "…")
 *   - long sentence (>25 words without comma) → mid-sentence micro-break
 */
type RhythmPreset = "pausada" | "educativo" | "fluente";
const RHYTHM_TABLE: Record<RhythmPreset, {
  paragraph: string; heading: string; ellipsis: string; longSentence: string;
  item: string; lineBreak: string;
}> = {
  pausada:   {
    paragraph:    '<break time="1.2s" />',
    heading:      '<break time="0.8s" />',
    ellipsis:     '<break time="1.5s" />',
    longSentence: '<break time="0.4s" />',
    item:         '<break time="0.5s" />',
    lineBreak:    '<break time="0.5s" />',
  },
  educativo: {
    paragraph:    '<break time="0.8s" />',
    heading:      '<break time="0.5s" />',
    ellipsis:     '<break time="1.0s" />',
    longSentence: '<break time="0.3s" />',
    item:         '<break time="0.3s" />',
    lineBreak:    '<break time="0.3s" />',
  },
  fluente:   {
    paragraph:    '<break time="0.4s" />',
    heading:      '<break time="0.3s" />',
    ellipsis:     '<break time="0.6s" />',
    longSentence: '<break time="0.2s" />',
    item:         '<break time="0.2s" />',
    lineBreak:    '<break time="0.2s" />',
  },
};

function applyRhythmTags(
  text: string,
  preset: string,
): { text: string; counts: { paragraph: number; heading: number; ellipsis: number; longSentence: number; item: number; lineBreak: number; total: number } } {
  const key = (["pausada", "educativo", "fluente"].includes(preset) ? preset : "educativo") as RhythmPreset;
  const tags = RHYTHM_TABLE[key];
  const counts = { paragraph: 0, heading: 0, ellipsis: 0, longSentence: 0, item: 0, lineBreak: 0, total: 0 };

  // 1. Ellipsis
  let out = text.replace(/(\.{3,}|…)/g, () => {
    counts.ellipsis++;
    return ` ${tags.ellipsis} `;
  });

  // 2. Heading detection — process line-by-line, then re-join.
  //    A line is a heading when:
  //    a) ALL CAPS (≥3 chars, letters+spaces only)
  //    b) Ends with ':' and is ≤100 chars — RELAXED: no longer requires a following
  //       blank line. Quiz/list content almost never has blank lines between the
  //       question heading and the answer choices, so the old `nextBlank` guard
  //       caused every quiz heading to be silently skipped.
  //    c) Starts with "Questão/Exercício/Atividade N" (numbered question heading)
  const lines = out.split(/\n/);
  const processedLines: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const isAllCaps = trimmed.length >= 3 &&
      /^[A-ZÀ-Ý0-9\s\-:.,!?()]+$/.test(trimmed) &&
      /[A-ZÀ-Ý]/.test(trimmed) &&
      !/[a-zà-ÿ]/.test(trimmed);
    // Relaxed colon heading: any short line (≤100 chars) ending with ':'.
    // Short limit prevents very long answer-choice lines from false-firing.
    const isColonHeading = trimmed.endsWith(":") && trimmed.length <= 100;
    // Numbered question/exercise heading at the start of a line.
    const isQuestaoHeading = /^(questão|exercício|atividade|item)\s+\d+/i.test(trimmed);
    if ((isAllCaps || isColonHeading || isQuestaoHeading) && trimmed.length > 0) {
      processedLines.push(`${line} ${tags.heading}`);
      counts.heading++;
    } else {
      processedLines.push(line);
    }
  }
  out = processedLines.join("\n");

  // 3. Inline "Questão N" / "Exercício N" patterns embedded inside long lines.
  //    These are NOT caught by per-line heading detection (step 2) because the
  //    full line contains mixed content (e.g. "...D) answer. Questão 5: title…").
  //    Fires when the numbered label appears after sentence-ending punctuation.
  out = out.replace(/([.?!"»])\s+(Questão|Exercício|Atividade)\s+(\d+)/gi, (_, punct, word, num) => {
    counts.heading++;
    return `${punct} ${tags.heading} ${word} ${num}`;
  });

  // 4. Multiple-choice item breaks — insert a pause between lettered answer choices.
  //    Pattern: sentence-ending punctuation followed by "[A-E]) " (next choice).
  //    This is the primary fix for quiz pages where A) B) C) D) E) appear on a
  //    single line: each choice boundary gets an explicit pause marker.
  out = out.replace(/([.?!])\s+([A-E])\)\s+/g, (_, punct, letter) => {
    counts.item++;
    return `${punct} ${tags.item} ${letter}) `;
  });

  // 5. Paragraph breaks (\n\n+) → inject paragraph tag between blocks.
  //    Must run BEFORE the single-\n rule (step 6) so that double-newline
  //    sequences are consumed first; their component \n chars are then skipped
  //    by the (?<!\n)\n(?!\n) lookbehind/lookahead in step 6.
  out = out.replace(/\n{2,}/g, () => {
    counts.paragraph++;
    return `\n\n${tags.paragraph}\n\n`;
  });

  // 6. Single newline → small pause.
  //    Critical for quiz/list content where questions are separated by \n (not \n\n).
  //    The (?<!\n)\n(?!\n) regex correctly skips \n chars that are part of \n\n
  //    paragraph sequences already processed in step 5.
  out = out.replace(/(?<!\n)\n(?!\n)/g, () => {
    counts.lineBreak++;
    return ` ${tags.lineBreak}\n`;
  });

  // 7. Long sentence handling — split text into sentences and insert a
  //    micro-break in the middle of any sentence with >25 words and no comma.
  const sentenceParts = out.split(/(?<=[.!?])\s+/);
  const enriched = sentenceParts.map((sentence) => {
    const cleaned = sentence.replace(/<break[^>]*\/>/g, "").trim();
    if (!cleaned || cleaned.includes(",")) return sentence;
    const words = cleaned.split(/\s+/);
    if (words.length <= 25) return sentence;
    // Find a natural midpoint: prefer breaking after preposition/conjunction
    const conjunctions = new Set([
      "e", "ou", "mas", "porém", "contudo", "todavia", "entretanto",
      "que", "porque", "pois", "como", "quando", "se", "embora",
      "para", "por", "com", "sem", "sobre", "entre", "após",
      "de", "da", "do", "das", "dos", "em", "na", "no", "nas", "nos",
    ]);
    const mid = Math.floor(words.length / 2);
    let cut = mid;
    for (let off = 0; off <= 4; off++) {
      if (conjunctions.has(words[mid + off]?.toLowerCase())) { cut = mid + off; break; }
      if (conjunctions.has(words[mid - off]?.toLowerCase())) { cut = mid - off; break; }
    }
    const left = words.slice(0, cut + 1).join(" ");
    const right = words.slice(cut + 1).join(" ");
    counts.longSentence++;
    return `${left} ${tags.longSentence} ${right}`;
  });
  out = enriched.join(" ");

  counts.total = counts.paragraph + counts.heading + counts.ellipsis + counts.longSentence + counts.item + counts.lineBreak;
  return { text: out, counts };
}

function deriveProjectSeed(projectId: string): number {
  return Math.abs(projectId.split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % 4294967295;
}

async function generateWithElevenLabs(
  text: string, voiceId: string, modelId: string, apiKey: string,
  projectId?: string, pageNumber?: number, mode?: string, speed: number = 0.90,
  narrationSpeed?: string, advancedMode: boolean = false,
): Promise<{ audioBytes: Uint8Array; mimeType: string }> {
  // ── PIPELINE ORDER (critical — do not reorder) ──
  // 1. preprocessTextForPTBR: expand %, R$, em-dash — preserves \n structure
  // 2. applyRhythmTags: detects \n\n (paragraphs) and ALL-CAPS headings —
  //    MUST run before prepareText which collapses \n{2,} → \n, destroying
  //    paragraph boundary signals needed for <break> tag insertion.
  // 3. prepareText: strip [brackets], expand acronyms, collapse extra \n
  // 4. normalizeForElevenLabs: collapse all \n to spaces, protect <break> tags

  let prepared = preprocessTextForPTBR(text);

  // ── RHYTHM TAGS ──
  // Inject explicit <break> markers while paragraph/heading boundaries are
  // still intact in the text. Skipped in advanced mode (user-authored tags).
  if (advancedMode) {
    console.log(
      `[RHYTHM-DEBUG] advanced_mode=true preset=${narrationSpeed || "-"} text_length=${prepared.length} ` +
      `user_tags_in_text=${(prepared.match(/<break[^>]*\/>/g) || []).length}`,
    );
  } else {
    const before = prepared.length;
    const result = applyRhythmTags(prepared, narrationSpeed || "educativo");
    prepared = result.text;
    console.log(
      `[RHYTHM-DEBUG] preset=${narrationSpeed || "educativo"} ` +
      `tags_inserted=${result.counts.total} ` +
      `(paragraph=${result.counts.paragraph} heading=${result.counts.heading} ` +
      `ellipsis=${result.counts.ellipsis} long_sentence=${result.counts.longSentence} ` +
      `item=${result.counts.item} line_break=${result.counts.lineBreak}) ` +
      `text_length_before=${before} text_length_after=${prepared.length}`,
    );
  }

  // Now strip brackets, expand acronyms and collapse redundant \n.
  // <break .../> tags are inline tokens and survive this step untouched.
  prepared = prepareText(prepared);

  // Final pass: collapse all remaining \n to spaces, protect <break> spacing.
  prepared = normalizeForElevenLabs(prepared);

  // ── SPEED LOCK ──
  // Single source of truth for speed during the entire ElevenLabs run.
  // Captured ONCE at function entry and never mutated. All chunks reference
  // the same numeric value via the frozen VOICE_SETTINGS object below.
  const SPEED_LOCKED: number = speed;

  // ── VOICE_SETTINGS LOCK ──
  // Built ONCE outside the loop and frozen so no chunk iteration can mutate
  // it. The exact same object reference is sent in every API call.
  const VOICE_SETTINGS = Object.freeze({
    stability: 0.5,
    similarity_boost: 0.85,
    style: 0.15,
    use_speaker_boost: true,
    speed: SPEED_LOCKED,
  });

  const chunks: string[] = [];
  // Larger chunks (~4500 chars) give the ElevenLabs Multilingual v2 model
  // enough text to converge to the requested `speed` target. Chunks that
  // are too small (~1800) cause perceived rhythm drift — each chunk starts
  // at near-natural pace and only converges to the target by its end,
  // producing audio that sounds fluid in the middle and only becomes
  // pausada at the very end of the narration. 4500 keeps comfortable
  // headroom under the ~10k API limit while preserving paragraph/sentence
  // boundary cuts (we never break mid-sentence).
  const MAX_CHUNK = 4500;
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

  // ── PREVIOUS_TEXT STRATEGY ──
  // previous_text is the primary mechanism for making the model START at the
  // requested speed from the very first word, not just converge toward it.
  //
  // • pausada / educativo → use crafted warm-up text (always, every page).
  //   The model "imagines" having just narrated that paragraph at
  //   voice_settings.speed and continues the actual text at the same cadence.
  //
  // • fluente → use the last ~200 chars of the actual previous page (when
  //   available and page > 1). Natural cross-page prosodic continuity.
  //   If no previous page exists, no previous_text — model starts naturally.
  let previousText: string | undefined;

  if (narrationSpeed === "fluente") {
    // Fluente: actual previous page text for natural cross-page continuity.
    if (projectId && pageNumber && pageNumber > 1) {
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
        const prevText = (prevPage as Record<string, unknown> | null)?.[textField];
        if (prevText && typeof prevText === "string" && prevText.length > 0) {
          previousText = prevText.slice(-200);
        }
      } catch { /* ignore — model starts without previous context */ }
    }
  } else {
    // Pausada / educativo: crafted warm-up primes the model to the target
    // speed from the first word. Without this, the model starts cold at ~1.0
    // and only reaches voice_settings.speed at the very end of the generation.
    const key = narrationSpeed && narrationSpeed in SPEED_WARMUP_TEXT
      ? narrationSpeed
      : "educativo";
    previousText = SPEED_WARMUP_TEXT[key];
    console.log(`[RHYTHM-DEBUG] warm-up previous_text set for preset=${key} length=${previousText.length}`);
  }

  const seed = projectId ? deriveProjectSeed(projectId) : undefined;
  const prefix = rhythmPrefix(narrationSpeed);

  const audioBuffers: Uint8Array[] = [];

  for (let ci = 0; ci < chunks.length; ci++) {
    const chunk = prefix + chunks[ci];
    let lastError: string | null = null;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 140000);

    const bodyObj: Record<string, unknown> = {
      text: chunk,
      model_id: "eleven_multilingual_v2",
      language_code: "pt",
      // Same frozen reference in every chunk — guarantees speed immutability.
      voice_settings: VOICE_SETTINGS,
      // "auto" lets ElevenLabs apply its Brazilian-Portuguese-specific
      // normalization (numbers, abbreviations, ordinals, currency, phonetics).
      // Our preprocessors (normalizeText + preprocessForTTS) handle custom
      // expansions first (%, R$, laws, acronyms); ElevenLabs covers the rest.
      //
      // IMPORTANT: apply_text_normalization does NOT affect <break> tags.
      // SSML prosody tags are parsed BEFORE normalization runs in ElevenLabs'
      // pipeline, so they are unaffected by this setting. "off" was set
      // incorrectly to "protect" the tags — it was disabling PT-BR phonetics.
      apply_text_normalization: "auto",
      // ElevenLabs does not support language-specific text normalization for
      // 'pt' (returns language_text_normalization_not_supported). Keep this
      // disabled — the generic "auto" normalization above still applies.
      apply_language_text_normalization: false,
    };
    if (seed !== undefined) bodyObj.seed = seed;

    // Apply ONLY a single previous_text on the first chunk, sourced from
    // the previous page (when available and rhythm preset allows it).
    // No cross-chunk previous_text/next_text chaining: that biased the
    // model toward inheriting the prior chunk's prosody and broke the
    // requested voice_settings.speed target across long narrations.
    if (ci === 0 && previousText) {
      bodyObj.previous_text = previousText;
    }

    // ── PRE-CALL VALIDATION LOG (permanent) ──
    // If voice_settings.speed differs across chunks for the same run, the
    // bug is back. previous_text/next_text presence is also reported here.
    const _prev = (bodyObj as { previous_text?: string }).previous_text;
    const _next = (bodyObj as { next_text?: string }).next_text;
    console.log(
      `[AUDIO-DEBUG-CHUNK] pre-call chunk_index=${ci + 1}/${chunks.length} ` +
      `text_length=${chunk.length} prefix_used=${JSON.stringify(prefix)} ` +
      `has_previous_text=${!!_prev} previous_text_length=${_prev?.length ?? 0} ` +
      `has_next_text=${!!_next} next_text_length=${_next?.length ?? 0} ` +
      `voice_settings=${JSON.stringify(VOICE_SETTINGS)}`,
    );

    let chunkAttempt = 0;
    for (let attempt = 0; attempt < 3; attempt++) {
      chunkAttempt = attempt + 1;
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
          console.log(
            `[AUDIO-DEBUG-CHUNK] post-call chunk_index=${ci + 1}/${chunks.length} ` +
            `success=true audio_size_bytes=${buf.length} attempt=${chunkAttempt}`,
          );
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
    if (lastError) {
      console.log(
        `[AUDIO-DEBUG-CHUNK] post-call chunk_index=${ci + 1}/${chunks.length} ` +
        `success=false attempt=${chunkAttempt} error=${lastError.slice(0, 200)}`,
      );
      throw { status: 500, error: "elevenlabs_error", message: lastError };
    }
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
      skip_page_update, narration_id, advanced_mode,
    } = await req.json();

    // ---- [AUDIO-DEBUG] Permanent diagnostic logs (do not remove) ----
    const callOrigin = skip_page_update && narration_id ? "multi-narration" : "page-main";
    const textPreview = typeof text === "string"
      ? `${text.slice(0, 80).replace(/\n/g, " ")}${text.length > 80 ? "…" : ""} (len=${text.length})`
      : `(invalid type: ${typeof text})`;
    console.log(
      `[AUDIO-DEBUG] payload received: origin=${callOrigin} mode=${mode} use_elevenlabs=${!!use_elevenlabs} ` +
      `page_id=${page_id} project_id=${project_id} page_number=${page_number} narration_id=${narration_id || "-"} ` +
      `voice=${voice || "-"} elevenlabs_voice_id=${elevenlabs_voice_id || "-"} text="${textPreview}"`
    );
    console.log(`[AUDIO-DEBUG] speed_preset received (raw): ${JSON.stringify(narration_speed)}`);
    // ----------------------------------------------------------------

    if (!page_id || !project_id || !text || !mode) {
      return respond({ success: false, error: "missing_fields", message: "Campos obrigatórios faltando" }, 400);
    }

    // Auth + ownership
    const user = await getAuthedUser(req);
    if (!user) return respond({ success: false, error: "unauthorized", message: "Autenticação obrigatória." }, 401);
    const owns = await userOwnsProject(user.id, project_id);
    if (!owns) return respond({ success: false, error: "forbidden", message: "Acesso negado a este projeto." }, 403);

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
      const resolved = resolveSpeed(narration_speed);
      console.log(
        `[AUDIO-DEBUG] speed resolved: origin=${callOrigin} preset_in=${JSON.stringify(narration_speed)} ` +
        `preset_used=${resolved.preset} speed_numeric=${resolved.value} fallback_used=${resolved.fallback_used}`
      );
      const result = await generateWithElevenLabs(
        text, elevenlabs_voice_id, elevenlabs_model, elApiKey,
        project_id, page_number, mode, resolved.value, resolved.preset, !!advanced_mode,
      );
      audioBytes = result.audioBytes;
      mimeType = result.mimeType;
      engine = "elevenlabs";
    } else {
      const keysCheck = validateGeminiKeysConfigured();
      if (!keysCheck.ok) {
        return respond({ success: false, error: "missing_fields", message: keysCheck.message || "Nenhuma chave Gemini configurada" }, 500);
      }
      // Validate voice is a valid Gemini voice name
      const validGeminiVoices = ["achernar","achird","algenib","algieba","alnilam","aoede","autonoe","callirrhoe","charon","despina","enceladus","erinome","fenrir","gacrux","iapetus","kore","laomedeia","leda","orus","puck","pulcherrima","rasalgethi","sadachbia","sadaltager","schedar","sulafat","umbriel","vindemiatrix","zephyr","zubenelgenubi"];
      const geminiVoice = (voice && validGeminiVoices.includes(voice.toLowerCase())) ? voice : "Zephyr";
      console.log(`[Gemini] Using voice: ${geminiVoice} (requested: ${voice})`);
      const result = await generateWithGemini(text, geminiVoice, styleApplied);
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

    // Cache-buster: ensures clients fetch the freshly regenerated audio
    // even when the storage path is identical (upsert overwrite).
    const baseSignedUrl = signedUrlData?.signedUrl || "";
    const audioUrl = baseSignedUrl
      ? `${baseSignedUrl}${baseSignedUrl.includes("?") ? "&" : "?"}v=${Date.now()}`
      : "";

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
