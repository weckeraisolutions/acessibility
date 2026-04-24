
# Correções: Narração ElevenLabs + Videobook (layout/estabilidade)

Quatro correções pontuais sem alterar o pipeline geral. Tudo client-side + 1 ajuste na edge function `generate-audio`.

## 1. Ritmo ElevenLabs aplicado em 100% da narração

**Causa:** chunks longos (até 9500 caracteres) + uso de `previous_text`/`next_text` entre chunks fazem o modelo perder a referência prosódica do `voice_settings.speed` no início e só "estabilizar" no fim. Além disso, `stability: 0.85` deixa margem para o modelo derivar.

**Correção em `supabase/functions/generate-audio/index.ts` (`generateWithElevenLabs`):**
- Reduzir limite de chunk de **9500 → 3500 caracteres** (split por parágrafo, depois por sentença se necessário). Chunks menores = `voice_settings.speed` aplicado consistentemente do início ao fim de cada chunk.
- Mapear `narration_speed` (novo parâmetro recebido do frontend) → `speed` numérico determinístico:
  - `pausada` → `0.85`
  - `educativo` → `0.95`
  - `fluente` → `1.05`
- Aumentar `stability: 0.85 → 0.92` para travar a entrega do ritmo.
- **Remover** `previous_text` e `next_text` quando `narration_speed === "pausada"` (contexto de chunk anterior contamina o ritmo lento — modelo "acelera" para combinar). Manter para `educativo`/`fluente`.
- Aceitar `narration_speed` no body do handler HTTP e propagar para `generateWithElevenLabs`.

**Ajuste em `src/components/editor/NarrationBlock.tsx` e `AudioPageCard.tsx`:**
- Já enviam `narration_speed` — apenas garantir que vai sempre presente (default `"educativo"`).

## 2. Áudio não atualiza após regerar com nova voz/motor

**Causa:** O `audio_url` retornado mantém o mesmo path (sobrescrito com `upsert: true`), então o `<audio>` e o `fetch()` do blob retornam a versão cacheada pelo browser/CDN.

**Correções:**
- **`supabase/functions/generate-audio/index.ts`**: ao gerar a signed URL, anexar `&v=${Date.now()}` no retorno (`audio_url`) — força nova URL única a cada geração mesmo com mesmo path no Storage.
- **`src/components/editor/NarrationBlock.tsx`**:
  - No `useEffect` que busca o blob: trocar `prevAudioRef.current === narration.audio_url` por comparação ignorando query string, mas **sempre** refazer fetch quando a URL muda (já feito; o problema é o cache HTTP).
  - Adicionar `cache: "no-store"` no `fetch(narration.audio_url)`.
  - Adicionar `key={narration.audio_url}` no elemento `<audio>` para forçar remount.
- **`src/components/editor/AudioPageCard.tsx`**: mesmo tratamento — `cache: "no-store"` no fetch do blob principal e `key` no `<audio>`.

## 3. Videobook: deslocar flipbook para a esquerda (75% / 25%)

**Estado atual em `src/components/videobook/ChapterEditorView.tsx`:** `lg:grid-cols-10` com player em `col-span-7` (70%) e intérprete em `col-span-3` (30%).

**Correção:** Manter 70/30 mas garantir que o flipbook **interno** ao player respeite o espaço:
- Em `VideobookPlayer.tsx`, o cálculo `pageW = layout === "double" ? Math.floor(w / 2) : w` usa `containerRef.current.clientWidth` — está correto, mas o container atualmente não limita largura do flipbook ao layout `single`, fazendo a página única ocupar 100% e empurrar visualmente o painel.
- Ajuste: em layout `single`, limitar `pageW` a `Math.min(w, 600)` e centralizar com `mx-auto` — assim o flipbook fica visualmente alinhado à esquerda dentro do seu próprio container e o painel à direita ganha respiro real.
- Adicionar `padding-right` no container do player (`pr-4`) e `padding-left` no painel (`pl-2`) para separação visual.

## 4. Toggle de layout (1↔2 páginas) trava o módulo

**Causa raiz no `VideobookPlayer.tsx`:** o `useEffect` de inicialização do `PageFlip` depende de `[layout, sortedPages.length]`. Ao alternar layout:
1. `pf.destroy()` é chamado, mas a instância anterior ainda tem listeners ativos (`flip` event) que disparam `setCurrentIdx` em uma instância destruída.
2. `loadFromImages(imgs)` é chamado **síncronamente** com 31 imagens HD (~10–30MB cada) → bloqueia a main thread por vários segundos.
3. O áudio continua tocando e o evento `ended` tenta chamar `flipRef.current.flipNext()` em referência stale.

**Correções em `src/components/videobook/VideobookPlayer.tsx`:**
- Antes do `pf.destroy()`: pausar áudio (`audioRef.current?.pause(); setPlaying(false);`).
- Adicionar estado `reinitializing: boolean` — durante a troca, mostrar overlay "Reorganizando layout..." e desabilitar todos os controles (play, prev, next, toggle).
- Envolver a re-criação em `setTimeout(() => { ... }, 50)` para liberar a main thread entre destroy e load.
- Trocar dependência do effect para `[layout]` apenas (remover `sortedPages.length` que recriava sem necessidade) e usar `imgsKey` (string concatenada de URLs) num ref para detectar mudança real de páginas.
- No handler `flip`: validar `if (flipRef.current !== pf) return;` (ignora eventos de instâncias antigas).
- No `onEnd` do áudio: validar `if (!flipRef.current || reinitializing) return;`.
- Pré-carregar imagens HD via `Promise.all(imgs.map(loadImg))` **antes** de chamar `loadFromImages` para evitar repaints em cascata.

## O que NÃO muda

- Pipeline de upload, extração, fragmentação Gemini, geração de capítulos.
- Schema do banco, RLS, buckets.
- `useChapterVideoExport`, `VideobookExportDialog`, `InterpreterPanel`.
- Demais hooks e componentes do módulo Audiobook/AD.

## Ordem de implementação

1. `supabase/functions/generate-audio/index.ts` — chunks 3500, mapear speed, condicional de `previous_text`, query `&v=` na signed URL.
2. `NarrationBlock.tsx` + `AudioPageCard.tsx` — `cache: "no-store"` + `key={audio_url}`.
3. `VideobookPlayer.tsx` — pausa antes do destroy, `reinitializing` state, setTimeout entre destroy/load, guards nos handlers, pré-carregamento de imagens, ajuste de `pageW` em single.
4. `ChapterEditorView.tsx` — `pr-4` no player, `pl-2` no painel.
