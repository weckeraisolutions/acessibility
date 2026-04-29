
## Auditoria — Divergências encontradas vs. descrição da tarefa

Antes do plano, registro 4 divergências do código real vs. a descrição:

1. **Não existe edge function `generate-audio-elevenlabs`.** Existe uma única `generate-audio` que trata Gemini e ElevenLabs no mesmo arquivo, alternando pelo flag `use_elevenlabs`. Toda a correção será nessa função.
2. **Não existe `pages.audiobook_speed` nem `projects.default_speed`** no schema. Velocidade hoje vive apenas em `page_narrations.narration_speed` e em estado React (`globalNarrationSpeed`, não persistido). A hierarquia descrita na tarefa precisa ser adaptada à realidade — não vou criar colunas novas para evitar tocar no banco (regra geral da tarefa proíbe).
3. **O preset usado no código é `"educativo"` (masculino), não `"educativa"`.** Vou aceitar ambos no backend para tolerância.
4. **O campo no DB é `narration_speed`**, não `speed`.

## Causas raiz confirmadas

### Bug 1 — Speed intermitente

- A função `generate-audio` converte preset→número corretamente e coloca `speed` dentro de `voice_settings` (linhas 522–524 e 391–397). **Não há bug de localização** do parâmetro.
- O bug é **silencioso e por entrada inválida**: se `narration_speed` chega como `null`, `undefined`, string vazia, ou um preset desconhecido (ex.: `"educativa"` em vez de `"educativo"`), o map retorna `undefined` e cai para `0.92` sem aviso. O usuário não sabe que a seleção foi ignorada.
- Há 2 caminhos que enviam `narration_speed`: `AudioPageCard.handleGenerateAudio` (linha 314) e `NarrationBlock.handleGenerate` (linha 122). Em narrações múltiplas recém-criadas, o campo `narration_speed` no DB nasce `null` (`usePageNarrations.ts`), e se `globalNarrationSpeed` não estiver propagado naquele momento, o backend recebe `undefined`.
- Não existem logs informando o valor cru recebido nem o valor numérico final aplicado — apenas o `voice_settings` final por chunk. Impossível diagnosticar pós-fato.

### Bug 2 — Player não atualiza

- A edge function **já adiciona cache-buster** `?v=${Date.now()}` à signed URL (linhas 569–574). Bom.
- `AudioPageCard` já tem `audioRef` + `audio.load()` quando `blobUrl` muda (linhas 152–156). Funciona.
- `NarrationBlock` **não tem `audioRef`, não chama `audio.load()`**, e depende somente de `key={narration.audio_url}` para forçar remontagem do `<audio>` (linha 245). Isso é frágil: se o navegador reusar entrada de cache do blob, ou se o blob URL for revogado em race com a remontagem, o player exibe o áudio antigo até o F5. Esta é a assimetria que causa o bug relatado.

## Correções planejadas

### A. Edge function `generate-audio` (`supabase/functions/generate-audio/index.ts`)

1. **Centralizar resolução de speed** numa única função `resolveSpeed(preset)`:
   - Aceitar variações: `pausada`, `educativo`, `educativa` (alias → `educativo`), `fluente`.
   - Se inválido/vazio → fallback `educativo` (0.92).
   - Validar range [0.7, 1.2] (clamp).
   - Retornar `{ preset: string, value: number, fallback_used: boolean }`.
2. **Logs `[AUDIO-DEBUG]` permanentes** (não remover):
   - Payload recebido (sanitizado, sem o `text` completo — só primeiros 80 chars + tamanho).
   - Origem da chamada: derivada de `skip_page_update && narration_id` ⇒ `multi-narration`; senão `page-main`.
   - `speed_preset` cru recebido.
   - `speed_numeric` resolvido + flag `fallback_used`.
   - `voice_settings` final.
3. **Garantia estrutural**: `speed` continua dentro de `voice_settings` (já está); confirmação por log a cada chunk.

### B. `NarrationBlock.tsx`

1. Adicionar `audioRef = useRef<HTMLAudioElement>(null)` e attach no `<audio ref={audioRef}>`.
2. `useEffect` que dispara em `[blobUrl, narration.updated_at]` chamando `audioRef.current.load()` e resetando `currentTime = 0`.
3. Trocar `key={narration.audio_url || ""}` por `key={`${narration.id}-${narration.updated_at}`}` para remontagem garantida quando regerado.
4. No `handleGenerate`, depois do sucesso, **resetar** `prevAudioRef.current = null` (já feito) **e** atualizar otimisticamente `updated_at: new Date().toISOString()` no `onUpdate`, para forçar a key/effect dispararem mesmo se a signed URL fosse igual.

### C. Garantir que speed da narração múltipla é enviado

Já é (linha 122 do `NarrationBlock`). Vou apenas adicionar fallback explícito: `narration.narration_speed || globalNarrationSpeed || "educativo"` para nunca enviar `null/undefined`.

### D. Tipagem auxiliar

`AudioPageCard.tsx` linha 314 passa `pageNarrationSpeed || globalNarrationSpeed` — manter, mas garantir fallback final `"educativo"` na call.

## Não-tocados (regra da tarefa)

- Schema do banco (não criar coluna `audiobook_speed` nem `default_speed`).
- Fluxo Gemini.
- Audiodescrição.
- Videobook, landing, auth, storage.
- Lógica de seed/normalização de texto da ElevenLabs (não foi pedido).

## Arquivos a modificar

- `supabase/functions/generate-audio/index.ts`
- `src/components/editor/NarrationBlock.tsx`
- `src/components/editor/AudioPageCard.tsx` (apenas a linha do fallback final do `narration_speed`)

## Verificação pós-correção

- `tsc --noEmit` para garantir build verde.
- Após deploy, reproduzir geração com preset "Pausada" em narração múltipla recém-criada e conferir nos logs da função: `[AUDIO-DEBUG] speed_preset=pausada speed_numeric=0.8 fallback_used=false`.
- Regenerar áudio em bloco de narração e confirmar que player toca a versão nova sem F5.

Aguardando aprovação para implementar.
