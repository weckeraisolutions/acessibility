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
  item: number;
  lineBreak: number;
  total: number;
}

// Keep in sync with: supabase/functions/generate-audio/index.ts
// See RHYTHM_TABLE comment there for ElevenLabs artefact constraints.
const RHYTHM_TABLE: Record<RhythmPreset, {
  paragraph: string; heading: string; ellipsis: string; longSentence: string;
  item: string; lineBreak: string;
}> = {
  pausada:   {
    paragraph:    '<break time="0.6s" />',  // was 1.2s
    heading:      '<break time="0.4s" />',  // was 0.8s
    ellipsis:     '<break time="0.8s" />',  // was 1.5s
    longSentence: '<break time="0.4s" />',
    item:         '<break time="0.5s" />',
    lineBreak:    '<break time="0.5s" />',
  },
  educativo: {
    paragraph:    '<break time="0.4s" />',  // was 0.8s
    heading:      '<break time="0.3s" />',  // was 0.5s
    ellipsis:     '<break time="0.6s" />',  // was 1.0s
    longSentence: '<break time="0.3s" />',
    item:         '<break time="0.3s" />',
    lineBreak:    '<break time="0.3s" />',
  },
  fluente:   {
    paragraph:    '<break time="0.2s" />',  // was 0.4s
    heading:      '<break time="0.2s" />',  // was 0.3s
    ellipsis:     '<break time="0.4s" />',  // was 0.6s
    longSentence: '<break time="0.2s" />',
    item:         '<break time="0.2s" />',
    lineBreak:    '<break time="0.2s" />',
  },
};

export function applyRhythmTags(
  text: string,
  preset: string,
): { text: string; counts: RhythmCounts } {
  const key = (["pausada", "educativo", "fluente"].includes(preset) ? preset : "educativo") as RhythmPreset;
  const tags = RHYTHM_TABLE[key];
  const counts: RhythmCounts = { paragraph: 0, heading: 0, ellipsis: 0, longSentence: 0, item: 0, lineBreak: 0, total: 0 };

  // 1. Ellipsis
  let out = text.replace(/(\.{3,}|…)/g, () => {
    counts.ellipsis++;
    return ` ${tags.ellipsis} `;
  });

  // 1b. ALL-CAPS dash-separated word lists on a SINGLE line.
  //     Example: "TUKANO - CANOA - MITO - CERVO" (vocabulary quiz options).
  //     Replace each " - " separator with an item break — dash is removed so
  //     ElevenLabs does not read "menos" or "hífen" between the options.
  //     Guard: line must be ALL-CAPS with NO lowercase (prevents firing on
  //     normal hyphenated phrases like "São Paulo - capital").
  //     Keep in sync with: supabase/functions/generate-audio/index.ts
  {
    const capListLines = out.split("\n");
    const capListResult: string[] = [];
    for (const capLine of capListLines) {
      const trimmed = capLine.trim();
      const isCapsDashList =
        trimmed.length >= 3 &&
        /^[A-ZÀ-Ý0-9\s\-]+$/.test(trimmed) &&
        /[A-ZÀ-Ý]/.test(trimmed) &&
        !/[a-zà-ÿ]/.test(trimmed) &&
        trimmed.includes(" - ");
      if (isCapsDashList) {
        const separatorCount = (trimmed.match(/ - /g) || []).length;
        const withBreaks = trimmed.replace(/ - /g, ` ${tags.item} `);
        capListResult.push(capLine.replace(trimmed, withBreaks));
        counts.item += separatorCount;
      } else {
        capListResult.push(capLine);
      }
    }
    out = capListResult.join("\n");
  }

  // 2. Heading detection — process line-by-line.
  //    a) ALL CAPS lines
  //    b) Lines ending with ':' and ≤100 chars — RELAXED: no longer requires
  //       a following blank line (quiz pages never have blank lines before choices)
  //    c) Lines starting with "Questão/Exercício/Atividade N"
  const lines = out.split(/\n/);
  const processedLines: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const isAllCaps = trimmed.length >= 3 &&
      /^[A-ZÀ-Ý0-9\s\-:.,!?()]+$/.test(trimmed) &&
      /[A-ZÀ-Ý]/.test(trimmed) &&
      !/[a-zà-ÿ]/.test(trimmed);
    const prevLine = i > 0 ? lines[i - 1].trim() : "";
    const prevIsShort = prevLine.length > 0 && prevLine.length < 80;
    const isColonHeading = trimmed.endsWith(":") && trimmed.length <= 100 && !prevIsShort;
    const isQuestaoHeading = /^(questão|exercício|atividade|item)\s+\d+/i.test(trimmed);
    if ((isAllCaps || isColonHeading || isQuestaoHeading) && trimmed.length > 0) {
      processedLines.push(`${line} ${tags.heading}`);
      counts.heading++;
    } else {
      processedLines.push(line);
    }
  }
  out = processedLines.join("\n");

  // 3. Inline "Questão N" embedded inside long lines (not caught by step 2
  //    because the full line is mixed content and too long to be a heading).
  out = out.replace(/([.?!"»])\s+(Questão|Exercício|Atividade)\s+(\d+)/gi, (_, punct, word, num) => {
    counts.heading++;
    return `${punct} ${tags.heading} ${word} ${num}`;
  });

  // 4. Multiple-choice item breaks — pause between lettered answer choices.
  //    Pattern: sentence-ending punctuation then "[A-E]) " (next choice starts).
  //    Primary fix for quiz pages: A) B) C) D) E) on the same line each get
  //    an explicit pause marker between them.
  out = out.replace(/([.?!])\s+([A-E])\)\s+/g, (_, punct, letter) => {
    counts.item++;
    return `${punct} ${tags.item} ${letter}) `;
  });

  // 5. Paragraph breaks (\n\n+) — MUST run before step 6 so that double-newline
  //    sequences are consumed first.
  out = out.replace(/\n{2,}/g, () => {
    counts.paragraph++;
    return `\n\n${tags.paragraph}\n\n`;
  });

  // 6. Single newline → small pause.
  //    Primary trigger: current line is ≥80 chars (long prose / quiz choice blocks).
  //    Secondary trigger: NEXT line starts with a numbered or bulleted list item —
  //    these need a pause before each item regardless of current line length.
  //    "→" arrow bullets, "•" and "*" asterisks are included; bare "- " (dialogue
  //    dash) is excluded to avoid false positives on Portuguese quoted dialogue.
  //    Keep in sync with: supabase/functions/generate-audio/index.ts
  {
    const lineArr = out.split("\n");
    const lineRes: string[] = [];
    for (let li = 0; li < lineArr.length; li++) {
      const line = lineArr[li];
      if (li === lineArr.length - 1) { lineRes.push(line); break; }
      const nextLine = lineArr[li + 1];
      const nextTrimmed = nextLine.trimStart();
      const nextIsBlank = nextTrimmed === "" || nextTrimmed.startsWith("<break");
      const nextIsListItem = /^(\d+[\.\)]\s|[•\*→]\s)/.test(nextTrimmed);
      const cleanLen = line.replace(/<break[^>]*\/>/g, "").trim().length;
      if (!nextIsBlank && (cleanLen >= 80 || nextIsListItem)) {
        counts.lineBreak++;
        lineRes.push(`${line} ${tags.lineBreak}`);
      } else {
        lineRes.push(line);
      }
    }
    out = lineRes.join("\n");
  }

  // 7. Long sentence — micro-break only for sentences >40 words with no comma.
  //    Threshold raised from 25→40: shorter sentences need no explicit break.
  //    Only coordinating conjunctions are valid cut points — prepositions and
  //    relative/subordinating words ("de", "que", "para"…) are excluded because
  //    they produce unnatural dangling segments (e.g. "...ideia de [pause] que").
  //    If no valid cut point found within ±8 words of midpoint → no break.
  const sentenceParts = out.split(/(?<=[.!?])\s+/);
  const enriched = sentenceParts.map((sentence) => {
    const cleaned = sentence.replace(/<break[^>]*\/>/g, "").trim();
    if (!cleaned || cleaned.includes(",")) return sentence;
    const words = cleaned.split(/\s+/);
    if (words.length <= 40) return sentence;
    const coordinating = new Set([
      "e", "ou", "mas", "porém", "contudo", "todavia", "entretanto",
      "pois", "portanto", "logo", "embora", "enquanto",
    ]);
    const mid = Math.floor(words.length / 2);
    let cut = -1;
    for (let off = 0; off <= 8; off++) {
      if (coordinating.has(words[mid + off]?.toLowerCase())) { cut = mid + off; break; }
      if (coordinating.has(words[mid - off]?.toLowerCase())) { cut = mid - off; break; }
    }
    if (cut === -1) return sentence;
    const left = words.slice(0, cut + 1).join(" ");
    const right = words.slice(cut + 1).join(" ");
    counts.longSentence++;
    return `${left} ${tags.longSentence} ${right}`;
  });
  out = enriched.join(" ");

  counts.total = counts.paragraph + counts.heading + counts.ellipsis + counts.longSentence + counts.item + counts.lineBreak;
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