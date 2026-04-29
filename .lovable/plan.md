
# Diagnóstico — Velocidade inconsistente em textos longos (ElevenLabs)

## Como o loop funciona hoje (`generateWithElevenLabs`, linhas 339–495)

1. Texto recebe normalização agressiva (`normalizeForElevenLabs`).
2. Divisão em chunks com `MAX_CHUNK = 1800` caracteres (linha 350), por parágrafo e fallback por sentença. **Boa estratégia.**
3. `skipContext = narrationSpeed !== "fluente"` (linha 376) — significa que **`pausada` e `educativo` JÁ não recebem `previous_text`/`next_text`**. Apenas `fluente` carrega contexto cruzado.
4. `prefix = rhythmPrefix(narrationSpeed)` (linha 400) retorna:
   - `"... "` para `pausada`
   - `". "` para `educativo`
   - `""` para `fluente`
5. Loop por chunk (linha 404):
   - **`bodyObj` (incluindo `voice_settings` com `speed`) é reconstruído a cada iteração**, mas sempre com a mesma constante `speed` recebida como parâmetro. Não há mutação observável.
   - Log `[ElevenLabs] chunk X/Y voice_settings: {...}` confirma o objeto a cada chamada.
   - `chunk = prefix + chunks[ci]` — **o prefixo de ritmo é aplicado em TODOS os chunks**.

## Causa raiz identificada — assinatura clássica confirmada

O sintoma "início/meio fluido, fim pausado" tem **uma única explicação técnica consistente** com este código:

**O parâmetro `speed` no `voice_settings` do ElevenLabs Multilingual v2 é tratado como um *target* de ritmo, não como um time-stretch determinístico aplicado a todo o áudio.** O modelo precisa de "tempo" (caracteres processados) para convergir do ritmo natural inferido do texto até o ritmo solicitado. Em chunks de 1800 caracteres com `speed=0.80`:

- O modelo começa cada chunk em ritmo próximo ao "natural" (~1.0).
- Conforme processa, vai desacelerando em direção ao alvo 0.80.
- **Em chunks curtos (texto único < 1800), ele praticamente não tem tempo de convergir e o áudio sai inteiro num ritmo médio** — por isso textos curtos parecem "respeitar" o preset (na verdade soam consistentes, ainda que não exatamente 0.80).
- **Em texto longo dividido**, cada chunk reinicia esse processo de convergência. O usuário ouve: chunk 1 começa fluido → desacelera → corta → chunk 2 começa fluido de novo → desacelera → … → último chunk finalmente soa pausado porque o ouvido já está calibrado e o final não tem "próximo chunk" para mascarar.

A descrição do usuário ("a maior parte fluida, só o final pausado") bate exatamente com esse padrão de **convergência intra-chunk não-resetada na percepção, mas resetada na geração**.

### Por que NÃO é bug de mutação de variável
- `speed` é parâmetro `const` da função, nunca reatribuído.
- `voice_settings.speed: speed` (linha 420) referencia o mesmo valor em todas as iterações.
- O log `[ElevenLabs] chunk X/Y` na linha 426 já existe e, conforme os logs do usuário (`speed: 0.8` no log atual), confirma que o valor enviado **está correto em cada chunk**.

### Por que NÃO é `previous_text`
Já está desativado para `pausada` (`skipContext = true` quando ≠ `fluente`, linha 376). O bug ocorre mesmo sem `previous_text`.

### Hipótese secundária a validar
O `prefix = "... "` aplicado em **todos** os chunks pode estar tendo efeito **decrescente** (modelo "se acostuma" com a sinalização). Mais importante: chunks de 1800 chars são curtos demais para o modelo convergir ao ritmo alvo de forma audível.

## Divergências do enunciado vs. código real

1. **Limite NÃO é 10.000 chars** — é 1800 (linha 350). Código já usa chunks pequenos.
2. **`voice_settings` JÁ é construído com a mesma `speed` em cada chunk**, embora o objeto literal seja recriado (sem efeito funcional, pois `speed` é constante).
3. **`previous_text` JÁ é omitido para `pausada`/`educativo`** (linha 376). A premissa do enunciado de que ele estaria "carregando prosódia herdada" no preset pausada não se aplica.
4. **Não existe tratamento de `isLastChunk`** — todos os chunks são tratados igual.
5. **Já existe log por chunk** (linha 426), mas não inclui `chunk_index/total`, `text_length`, nem `has_previous_text`/`previous_text_length`.

## Plano de correção

### A. Logs ampliados `[AUDIO-DEBUG-CHUNK]` (permanentes)
Substituir o log atual por dois logs estruturados por chunk:
- **Antes da chamada:** `chunk_index`, `total_chunks`, `text_length`, `voice_settings` completo, `has_previous_text`, `previous_text_length`, `has_next_text`, `prefix_used`.
- **Depois da resposta:** `chunk_index`, `success`, `audio_size_bytes`, `attempt`.

### B. Capturar `speed` em constante explícita no topo da função
```ts
const SPEED_LOCKED: number = speed; // single source of truth, never reassigned
```
Usar `SPEED_LOCKED` no `voice_settings`. Não muda o comportamento atual (é defensivo + auto-documentado), mas atende explicitamente o requisito 2.2 do enunciado.

### C. Construir `voice_settings` UMA VEZ fora do loop
```ts
const VOICE_SETTINGS = Object.freeze({
  stability: 1.0,
  similarity_boost: 0.75,
  style: 0.0,
  use_speaker_boost: false,
  speed: SPEED_LOCKED,
});
```
Passar a mesma referência em todos os chunks. Garante imutabilidade real e atende requisito 2.1.

### D. Aumentar `MAX_CHUNK` para reduzir frequência de "reconvergência" do ritmo
**Esta é a correção que de fato ataca a causa raiz percebida.** Subir `MAX_CHUNK` de **1800 → 4500** caracteres. Isso:
- Dá ao modelo tempo suficiente dentro de cada chunk para estabilizar o ritmo alvo.
- Reduz o número total de chunks (textos de 8k chars caem de ~5 chunks para ~2).
- Mantém margem segura em relação ao limite real do ElevenLabs (~10k).
- Preserva a divisão por parágrafo/sentença (sem cortes no meio de frase).

### E. Reforçar prefixo de ritmo apenas no primeiro chunk
Hoje o prefixo `"... "` é aplicado em **todo** chunk. Mudar para:
- Primeiro chunk: prefixo completo (ex.: `"... "` para pausada).
- Chunks subsequentes: prefixo reduzido ou vazio, já que o ritmo deve estar estabelecido.

Decisão proposta: manter prefixo em todos por segurança, mas **adicionar** uma instrução textual mais forte no primeiro chunk (ex.: `"...  "` com pausa dupla) para "ancorar" o ritmo desde o início.

### F. `previous_text` — manter comportamento atual
Já está desativado para `pausada`/`educativo`. Nenhuma mudança necessária. Para `fluente`, manter os 200 chars atuais (consistência de prosódia é desejável e não há bug reportado nesse preset).

### G. Não tocar
Gemini, audiodescrição, voz, seed, normalização de texto, schema, storage, Videobook, landing, auth.

## Arquivos a modificar
- `supabase/functions/generate-audio/index.ts` (apenas dentro de `generateWithElevenLabs`, linhas 339–495)

## Validação pós-correção
1. Gerar áudio longo (≥8000 chars) com preset "Pausada" — verificar nos logs que todos os chunks mostram `voice_settings.speed: 0.8` e que o número de chunks caiu (~2 em vez de ~5).
2. Ouvir o áudio resultante: ritmo pausado consistente do início ao fim.
3. Repetir com "Fluente" em texto longo — confirmar ausência de regressão.
4. `tsc --noEmit` verde.

Aguardando aprovação para implementar.
