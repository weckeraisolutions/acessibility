/**
 * Shared text normalization utilities for Supabase Edge Functions.
 *
 * normalizeText — base cleaning used by BOTH extract-text and generate-audio:
 *   strips bracket annotations, collapses excess newlines, expands acronyms
 *   and Brazilian legal/numeric expressions for TTS readability.
 *
 * preprocessForTTS — extra transforms needed only at audio-generation time
 *   (%, R$, em-dash, ellipsis). Not applied at extraction time since the raw
 *   text stored in the DB should remain human-readable.
 */

export function normalizeText(text: string): string {
  return text
    // Remove annotation brackets like [Título], [Box], etc.
    .replace(/\[.*?\]/g, "")
    // Collapse multiple blank lines to a single newline
    .replace(/\n{2,}/g, "\n")
    // ── Acronyms (letter-by-letter pronunciation) ──
    .replace(/\bIBGE\b/g, "I-B-G-E")
    .replace(/\bBNCC\b/g, "B-N-C-C")
    .replace(/\bONU\b/g, "O-N-U")
    .replace(/\bMEC\b/g, "M-E-C")
    .replace(/\bUSA\b/g, "U-S-A")
    .replace(/\bEUA\b/g, "E-U-A")
    .replace(/\bCNPJ\b/g, "C-N-P-J")
    .replace(/\bCPF\b/g, "C-P-F")
    .replace(/\bCEP\b/g, "C-E-P")
    .replace(/\bPIB\b/g, "P-I-B")
    .replace(/\bIDH\b/g, "I-D-H")
    // ── Brazilian laws (full spoken form) ──
    .replace(/\b10\.639\/2003\b/g, "Lei dez mil seiscentos e trinta e nove de dois mil e três")
    .replace(/\b11\.645\/2008\b/g, "Lei onze mil seiscentos e quarenta e cinco de dois mil e oito")
    .replace(/\b13\.146\/2015\b/g, "Lei treze mil cento e quarenta e seis de dois mil e quinze")
    .replace(/\b9\.394\/1996\b/g,  "Lei nove mil trezentos e noventa e quatro de mil novecentos e noventa e seis")
    .replace(/\bDecreto\s+5\.296\/2004\b/gi, "Decreto cinco mil duzentos e noventa e seis de dois mil e quatro")
    // ── Honorifics / titles (prevent mispronunciation) ──
    .replace(/\bDr\.\s/g,  "Doutor ")
    .replace(/\bDra\.\s/g, "Doutora ")
    .replace(/\bSr\.\s/g,  "Senhor ")
    .replace(/\bSra\.\s/g, "Senhora ")
    .replace(/\bProf\.\s/g,  "Professor ")
    .replace(/\bProfa\.\s/g, "Professora ")
    // ── Common abbreviations ──
    .replace(/\bart\.\s*(\d+)/gi,  (_, n) => `artigo ${n}`)
    .replace(/\binc\.\s*(\d+)/gi,  (_, n) => `inciso ${n}`)
    .replace(/\bp\.\s*(\d+)/gi,    (_, n) => `página ${n}`)
    .replace(/\bpág\.\s*(\d+)/gi,  (_, n) => `página ${n}`)
    .replace(/\bv\.\s*(\d+)/gi,    (_, n) => `volume ${n}`)
    // Ordinals: preserve º/ª so ElevenLabs applies PT-BR normalization
    // ("1º" → "primeiro", "2ª" → "segunda"). Stripping to bare digits
    // caused ElevenLabs to read them as cardinals ("um", "dois") — wrong.
    .trim();
}

/**
 * Additional normalizations applied only during audio generation (not stored
 * in the database). Expands symbols that TTS engines misread.
 */
export function preprocessForTTS(text: string): string {
  return text
    .replace(/(\d+(?:,\d+)?)\s*%/g, (_, n) => `${n} por cento`)
    .replace(/R\$\s*([\d.,]+)/g,    (_, n) => `${n} reais`)
    .replace(/\.\.\./g, "…")
    .replace(/\s—\s/g, ", ")
    .trim();
}
