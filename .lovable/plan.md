## Objetivo

Implementar rotação híbrida (round-robin + failover automático) entre `GEMINI_API_KEY` e `GEMINI_API_KEY2` em todas as Edge Functions que consomem a API Gemini, de forma centralizada e segura (sem expor valores das chaves nos logs).

## Arquivos afetados

- **Novo:** `supabase/functions/_shared/gemini-keys.ts`
- **Editar:** `supabase/functions/extract-text/index.ts`
- **Editar:** `supabase/functions/generate-audio/index.ts`
- **Editar:** `supabase/functions/detect-video-regions/index.ts`

## Detalhes técnicos

### 1) `_shared/gemini-keys.ts` (novo módulo)

Exports:

- `getGeminiKeys(): string[]` — lê `GEMINI_API_KEY` e `GEMINI_API_KEY2`, filtra `undefined`/strings vazias/whitespace.
- `validateGeminiKeysConfigured(): { ok: boolean; message?: string }` — `ok=false` se array vazio.
- `getNextGeminiKeyIndex(): number` — round-robin via variável de módulo `roundRobinIndex` (persiste enquanto a instância da Edge Function viver). Incrementa e retorna `index % keys.length`.
- `callGeminiWithFailover(callFn: (apiKey: string, keyIndex: number) => Promise<Response>): Promise<Response>`:
  1. Lê `keys = getGeminiKeys()`.
  2. Calcula `startIdx = getNextGeminiKeyIndex()`.
  3. Tenta `callFn(keys[startIdx], startIdx)`. Considera erro recuperável quando: status `429`, `500`, `502`, `503`, `504`, **ou** `fetch` lançou (rede). Em qualquer outro caso, retorna a `Response` (mesmo erro 4xx) sem failover.
  4. Se houver `keys.length > 1` e erro for recuperável, tenta a próxima chave (`(startIdx + 1) % keys.length`).
  5. Se ambas falharem, **lança** um objeto estruturado `{ both_keys_failed: true, last_status, last_error_text, last_response? }`. Se houver apenas 1 chave configurada, repassa o erro normal sem flag.
- Logs `[GEMINI-KEYS]` em todos os caminhos:
  - `attempt key_index=N status=XYZ`
  - `attempt key_index=N status=429 - failing over to key_index=M`
  - `attempt key_index=M status=200 - success after failover`
  - `both keys failed last_status=XYZ last_error=...`
  - Nunca logar valor das chaves; apenas o índice.

### 2) `extract-text/index.ts`

- Import: `import { callGeminiWithFailover, validateGeminiKeysConfigured } from "../_shared/gemini-keys.ts";`
- Remover leitura única de `Deno.env.get("GEMINI_API_KEY")` e respectiva validação (linhas ~229 e ~235-237).
- Logo após validar `page_id/image_url/mode`, chamar `validateGeminiKeysConfigured()` e retornar 500 com `"Nenhuma chave Gemini configurada"` caso falhe.
- Encapsular o bloco de `fetch` da Gemini Vision (linhas ~263-291) dentro de `callGeminiWithFailover(async (apiKey, idx) => { ... return geminiResponse; })`. O `AbortController`/timeout permanece dentro do callback.
- Se a chamada lançar `both_keys_failed`, devolver 429 ao usuário apenas se `last_status === 429`; caso contrário devolver erro genérico 500.
- Tratamento de status 400/403/429/outros (linhas ~293-305) permanece igual, mas atuando sobre a `Response` final retornada pelo helper.

### 3) `generate-audio/index.ts`

- Import do helper.
- **`requestGeminiChunk` (linhas 194-271):** alterar assinatura para receber `keyIndex` injetado pelo helper. Mover a montagem de `geminiUrl` para dentro do callback e retornar a `Response` em vez de já consumir/parsear. Reformular como duas etapas:
  1. Função interna `doFetch(apiKey)` que faz só o `fetch` (com timeout). Usada como callback do helper.
  2. Após `callGeminiWithFailover`, validar `geminiResponse.ok` e fazer todo o parsing/erro existente.
  - Manter a mensagem de quota excedida (linhas 250-258), porém **só retornada ao usuário se ambas as chaves falharam com 429** (detectado via flag `both_keys_failed` + `last_status === 429`).
- **`generateWithGemini` (linha 273):** remover parâmetro `geminiApiKey`; cada `requestGeminiChunk` invoca o helper internamente.
- **Handler principal (linha ~737-746):** remover `Deno.env.get("GEMINI_API_KEY")` e validação. No início da branch Gemini, chamar `validateGeminiKeysConfigured()` e retornar 500 se falhar. Atualizar chamada para `generateWithGemini(text, geminiVoice, styleApplied)`.

### 4) `detect-video-regions/index.ts`

- Import do helper.
- Remover leitura/validação de `GEMINI_API_KEY` (linhas ~75-80) e substituir por `validateGeminiKeysConfigured()`.
- Encapsular o `fetch` para `gemini-2.5-flash` (atualmente bloco que monta `geminiUrl` e chama `fetch`) dentro de `callGeminiWithFailover`.
- Manter o bloco `if (status === 429)` existente, mas só retornar 429 ao cliente quando `both_keys_failed && last_status === 429`.

### 5) Compatibilidade parcial

`getGeminiKeys()` filtra entradas vazias, então com apenas `GEMINI_API_KEY` configurada o sistema opera normalmente sem failover (helper detecta `keys.length === 1` e simplesmente propaga o erro original).

### 6) Pontos não alterados

- Lógica de prompts (audiobook, audiodesc, TTS).
- `applyRhythmTags`, `resolveSpeed`, `RHYTHM_TABLE`, chunking ElevenLabs.
- `AbortController` / timeouts permanecem dentro dos callbacks.
- Frontend, banco de dados, demais Edge Functions.

## Validação pós-implementação

1. Build limpo (`tsc --noEmit` automático).
2. Deploy das 3 funções via `supabase--deploy_edge_functions`.
3. Solicitar ao usuário: gerar 4 áudios Gemini consecutivos + 1 extração de audiodescrição.
4. Inspecionar logs com `supabase--edge_function_logs` filtrando `[GEMINI-KEYS]` e confirmar alternância `key_index=0 → 1 → 0 → 1` e ausência de valores de chave nos logs.
5. Reportar trecho dos logs ao usuário para confirmação final.