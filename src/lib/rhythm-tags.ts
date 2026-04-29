/**
 * Client-side mirror of the Edge Function `applyRhythmTags`.
 * Used by the preview modal so users see exactly the same processed text
 * the backend will send to ElevenLabs.
 *
 * Keep in sync with: supabase/functions/generate-audio/index.ts
 */

export type RhythmPreset = "pausada" | "educativo" | "fluente";

export interface RhythmCounts {
  paragraph: number;
  heading: number;
  ellipsis: number;
  longSentence: number;
  total: number;
}

const RHYTHM_TABLE: Record<RhythmPreset, { paragraph: string; heading: string; ellipsis: string; longSentence: string }> = {
  pausada:   { paragraph: '<break time="1.2s" />', heading: '<break time="0.8s" />', ellipsis: '<break time="1.5s" />', longSentence: '<break time="0.3s" />' },
  educativo: { paragraph: '<break time="0.8s" />', heading: '<break time="0.5s" />', ellipsis: '<break time="1.0s" />', longSentence: '<break time="0.3s" />' },
  fluente:   { paragraph: '<break time="0.4s" />', heading: '<break time="0.3s" />', ellipsis: '<break time="0.6s" />', longSentence: '<break time="0.3s" />' },
};

export function applyRhythmTags(
  text: string,
  preset: string,
): { text: string; counts: RhythmCounts } {
  const key = (["pausada", "educativo", "fluente"].includes(preset) ? preset : "educativo") as RhythmPreset;
  const tags = RHYTHM_TABLE[key];
  const counts: RhythmCounts = { paragraph: 0, heading: 0, ellipsis: 0, longSentence: 0, total: 0 };

  let out = text.replace(/(\.{3,}|…)/g, () => {
    counts.ellipsis++;
    return ` ${tags.ellipsis} `;
  });

  const lines = out.split(/\n/);
  const processedLines: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const nextBlank = i + 1 < lines.length && lines[i + 1].trim() === "";
    const isAllCaps = trimmed.length >= 3 &&
      /^[A-ZÀ-Ý0-9\s\-:.,!?()]+$/.test(trimmed) &&
      /[A-ZÀ-Ý]/.test(trimmed) &&
      !/[a-zà-ÿ]/.test(trimmed);
    const isColonHeading = trimmed.endsWith(":") && nextBlank && trimmed.length <= 80;
    if ((isAllCaps || isColonHeading) && trimmed.length > 0) {
      processedLines.push(`${line} ${tags.heading}`);
      counts.heading++;
    } else {
      processedLines.push(line);
    }
  }
  out = processedLines.join("\n");

  out = out.replace(/\n{2,}/g, () => {
    counts.paragraph++;
    return `\n\n${tags.paragraph}\n\n`;
  });

  const sentenceParts = out.split(/(?<=[.!?])\s+/);
  const enriched = sentenceParts.map((sentence) => {
    const cleaned = sentence.replace(/<break[^>]*\/>/g, "").trim();
    if (!cleaned || cleaned.includes(",")) return sentence;
    const words = cleaned.split(/\s+/);
    if (words.length <= 25) return sentence;
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

  counts.total = counts.paragraph + counts.heading + counts.ellipsis + counts.longSentence;
  return { text: out, counts };
}

/** Render text fragments highlighting <break> tags for the preview modal. */
export function splitForHighlight(text: string): Array<{ kind: "text" | "tag"; value: string }> {
  const parts: Array<{ kind: "text" | "tag"; value: string }> = [];
  const regex = /<break[^>]*\/>/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) parts.push({ kind: "text", value: text.slice(last, m.index) });
    parts.push({ kind: "tag", value: m[0] });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ kind: "text", value: text.slice(last) });
  return parts;
}