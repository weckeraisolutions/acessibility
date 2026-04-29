## Diagnóstico confirmado

Inspeção de `supabase/functions/generate-audio/index.ts` (linhas 328–600) confirma os três pontos do bug:

1. **`VOICE_SETTINGS` (linhas 486–492)** está com `stability: 1.0`, `style: 0.0`, `use_speaker_boost: false`. Conforme documentação ElevenLabs, `stability` ≥ 0.7 satura o modelo Multilingual v2 e neutraliza o efeito do parâmetro `speed` — explicação coerente com o sintoma "speed só converge no último chunk".
2. **`normalizeForElevenLabs` (linhas 328–335)** colapsa todo `\s*\n+\s*` em espaço único na linha 331, removendo a respiração ao redor das tags `<break .../>` injetadas por `applyRhythmTags`.
3. **Bloco `if (!skipContext)` (linhas 573–584)** alimenta `previous_text` com os últimos 200 chars do chunk anterior e `next_text` com os primeiros 200 do próximo, fazendo o modelo herdar a prosódia do chunk anterior em vez de obedecer ao `voice_settings`. O `previous_text` inicial (página anterior, linhas 532–550) é aplicado apenas no `ci === 0` e é aceitável manter.

Observação importante: hoje `skipContext = narrationSpeed !== "fluente"` (linha 529), então em `pausada`/`educativo` o bloco já está desativado. A correção solicitada remove o bloco inteiro, eliminando o `previous_text/next_text` cruzado **também para `fluente`**, que é exatamente o comportamento pedido pelo usuário.

## Correções a aplicar

Apenas em `supabase/functions/generate-audio/index.ts`:

### 1. Ajustar `VOICE_SETTINGS` (linhas 486–492)
```ts
const VOICE_SETTINGS = Object.freeze({
  stability: 0.5,
  similarity_boost: 0.85,
  style: 0.15,
  use_speaker_boost: true,
  speed: SPEED_LOCKED,
});
```

### 2. Preservar respiração ao redor das tags `<break>` em `normalizeForElevenLabs` (linha 331 + nova linha)
Após `t = t.replace(/\s*\n+\s*/g, " ");` adicionar:
```ts
t = t.replace(/\s*<break([^>]*)\/>\s*/g, " <break$1 /> ");
```
Reforça que cada tag fica cercada por espaço explícito após o colapso de quebras de linha. A linha de colapso de espaços múltiplos (`/\s{2,}/g → " "`) que vem depois é compatível porque a tag é tratada como token literal pelo regex de espaços.

### 3. Remover o bloco de `previous_text`/`next_text` cruzado entre chunks (linhas 573–584)
Apagar inteiramente:
```ts
if (!skipContext) {
  if (ci === 0 && previousText) { bodyObj.previous_text = previousText; }
  else if (ci > 0) { bodyObj.previous_text = chunks[ci - 1].slice(-200); }
  if (ci < chunks.length - 1) { bodyObj.next_text = chunks[ci + 1].slice(0, 200); }
}
```
Substituir por: aplicar `previous_text` apenas no primeiro chunk com base na página anterior, sem `next_text` e sem cadeia entre chunks:
```ts
if (ci === 0 && previousText) {
  bodyObj.previous_text = previousText;
}
```
Manter intactos a lógica de fetch de `previousText` (linhas 532–550) e a flag `skipContext` (que continua governando se o `previousText` da página anterior é buscado — comportamento atual preservado para `fluente` e desativado para `pausada`/`educativo`).

### 4. Logs `[AUDIO-DEBUG-CHUNK]` (linhas 591–597)
Mantidos sem alteração — já reportam `voice_settings` completo, `has_previous_text`, `previous_text_length`, `has_next_text`, `next_text_length`, exatamente o que se precisa para validar.

## Não tocar
`applyRhythmTags`, `resolveSpeed`, `RHYTHM_TABLE`, `MAX_CHUNK = 4500`, lógica de chunking por parágrafo/sentença, prefixo `rhythmPrefix`, fluxo Gemini, audiodescrição, retry/timeout, frontend.

## Validação após implementação
Deploy da edge function e teste com texto ≥ 6.000 chars + preset "pausada". Inspeção dos logs `[AUDIO-DEBUG-CHUNK]` deve mostrar em **todos** os chunks:
- `voice_settings={"stability":0.5,"similarity_boost":0.85,"style":0.15,"use_speaker_boost":true,"speed":0.85}`
- `has_next_text=false`
- `has_previous_text=false` (exceto possivelmente o chunk 1, se houver página anterior e preset for `fluente`)

Reportar o output dos logs ao usuário para confirmação auditiva final.