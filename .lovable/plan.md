

# Refinamento Completo do Módulo Videobook (Flipbook + Capítulos + Libras)

Reformulação do módulo Videobook em um fluxo autocontido: capítulos → reprocessamento HD → flipbook interativo com áudio sincronizado → painel de Libras → exportação MP4 H.264 por capítulo. Todo o pipeline de upload, extração e geração de áudio permanece intacto.

## Visão geral do fluxo

```text
[Aba Videobook]
   │
   ▼
1. Definir Capítulos (lista + intervalo de páginas + interpreter_mode)
   │
   ▼
2. Selecionar capítulo → checa resolução das imagens
   │       └── < 2000px? chama reprocess-pages-highres (300dpi → page-images-hd)
   ▼
3. Editor do Capítulo
   ┌─────────────────────────┬───────────────────┐
   │  Flipbook (StPageFlip)  │  Painel Libras    │
   │  + áudio sincronizado   │  (VLibras / vídeo │
   │  + 1 ou 2 páginas       │   humano / vazio) │
   └─────────────────────────┴───────────────────┘
   │
   ▼
4. Gerar Vídeo (FFmpeg.wasm)
   - ffprobe duração de cada MP3 → mapa de viradas
   - captura canvas 30fps + composição esquerda/direita
   - concat MP3 + encode H.264 (Full HD ou 4K)
   - upload videobook-final/{user}/{project}/{chapter}_{res}.mp4
```

## Mudanças no banco

**Nova tabela `chapters`**
- `id uuid PK`, `project_id uuid` (FK projects), `title text`
- `start_page int`, `end_page int`, `order int`
- `interpreter_mode text` (`vlibras` | `human_video` | `none`)
- `interpreter_video_url text` (path no bucket interpreter-videos)
- `videobook_url text`, `videobook_status text` default `'draft'`
- `videobook_resolution text`, `videobook_layout text` (`single` | `double`)
- `created_at`, `updated_at`
- RLS: SELECT/INSERT/UPDATE/DELETE permitidos quando `EXISTS project com user_id = auth.uid()`
- Índice em `(project_id, "order")`
- Validação de sobreposição via trigger `BEFORE INSERT/UPDATE` que rejeita se `[start_page,end_page]` intersectar outro capítulo do mesmo projeto

**Coluna nova em `pages`**
- `image_hd_url text NULL` — URL da imagem em alta resolução (preenchida sob demanda)

**Novos buckets de Storage**
- `page-images-hd` (público) — imagens 300dpi
- `interpreter-videos` (privado) — vídeos do intérprete humano
- Políticas: usuário só lê/escreve em pasta `{user_id}/...`

A tabela `projects.videobook_url` permanece (legado/compat), mas o vídeo passa a viver em `chapters.videobook_url`.

## Edge Functions (novas)

**`reprocess-pages-highres`** (`supabase/functions/reprocess-pages-highres/index.ts`)
- Input: `{ project_id, chapter_id }`
- Baixa o PDF do bucket `pdfs`, renderiza apenas as páginas `start_page..end_page` em 300dpi usando `pdfjs-dist` em Deno (mesma estratégia do worker client) ou via `pdf-lib` + render canvas-server.
- Faz upload em `page-images-hd/{user_id}/{project_id}/pag_NNN.png` e atualiza `pages.image_hd_url`.
- Retorna progresso em streaming (SSE) ou polling de uma tabela auxiliar.
- Skip automático se a imagem atual já tiver largura ≥ 2000px (verificado client-side antes de chamar).

## Componentes / Hooks novos

**Hooks**
- `src/hooks/useChapters.ts` (CRUD: list/create/update/delete + validação de sobreposição local antes de persistir)
- `src/hooks/useHighResPages.ts` (verifica largura via `Image()` natural, dispara edge function, mostra progresso)
- `src/hooks/useFlipbookPlayback.ts` (controla play/pause, página atual, ouve `audio.ended` para virar; calcula mapa `pageId → duration` via `<audio>.duration` ou ffprobe)
- `src/hooks/useChapterVideoExport.ts` (substitui o uso atual de `useVideobookExport` para capítulos; reaproveita helpers `loadImage`, `easeInOut`, init FFmpeg do hook existente)

**Componentes**
- `src/components/videobook/ChapterListPanel.tsx` — grid de capítulos + botão "+ Definir Capítulos"
- `src/components/videobook/ChapterEditorDialog.tsx` — formulário título + range de páginas + atalho "Capítulo Único"
- `src/components/videobook/PageGridSelector.tsx` — grid de cards de páginas para selecionar intervalo
- `src/components/videobook/HighResPreparationDialog.tsx` — barra de progresso do reprocessamento
- `src/components/videobook/VideobookPlayer.tsx` — wrapper do `page-flip` (StPageFlip) + áudio + controles (play/pause, prev/next, fullscreen, toggle 1/2 páginas, barra de progresso do capítulo)
- `src/components/videobook/InterpreterPanel.tsx` — 3 abas: VLibras (`@djpfs/react-vlibras`), upload MP4 humano (com validação de duração ≈ duração do capítulo), "Sem intérprete"
- `src/components/videobook/ChapterEditorView.tsx` — layout 70/30 com Player + InterpreterPanel
- `src/components/videobook/VideobookExportDialog.tsx` — modal nova versão: seleção Full HD/4K, layout 1/2 páginas, barra de progresso detalhada, preview e download

## Mudanças de UI na aba Videobook (`src/pages/ProjectDetail.tsx`)

A aba `videobook` atual é substituída por:

1. **Estado vazio**: card "Nenhum capítulo definido" + CTA "+ Definir Capítulos".
2. **Lista de capítulos**: grid de cards (`title`, `N páginas`, status badge, botão "Abrir editor", botão "Editar capítulo"). Botão flutuante "+ Novo Capítulo".
3. **Editor de capítulo** (rota interna ou modal full-screen): renderiza `ChapterEditorView`.
4. **Modal de exportação** acionado por "Gerar Videobook" dentro do editor.

Os componentes legados `VideoGlobalPanel`, `VideoPageCard`, `useVideoRegionDetector`, `useVideobookExport`, `VideobookExportDialog` antigos permanecem no repo mas deixam de ser montados (mantidos para compat caso reativados — sem quebrar build).

## Pipeline de exportação por capítulo (FFmpeg.wasm)

1. **Pré-cálculo**: para cada página do capítulo, baixa o MP3 de `audiobook_audio_url`, escreve em FS virtual e roda `ffprobe` (`-i in.mp3 -show_entries format=duration`) → constrói `{ pageId: durationSec }`. Soma = duração total do capítulo.
2. **Captura de frames**: instancia `StPageFlip` num `<canvas>` headless (mesma config do player). Em loop a 30fps:
   - tempo `t` cresce; quando `t ≥ accumulatedDuration[i] - 0.3` → dispara `flipNext()` para a próxima página.
   - `canvas.toBlob('image/png')` → grava `frame_NNNNNN.png` no FS do FFmpeg.
   - Compõe **frame final** num segundo canvas com layout `[Flipbook | Interpreter]` (70/30): se `vlibras` → captura do widget DOM via `html2canvas`; se `human_video` → desenha `<video>` no instante `t`; se `none` → fundo neutro.
3. **Áudio**: concat dos MP3s na ordem do capítulo (`-f concat`), gera `audio_chapter.mp3`.
4. **Encode**: `libx264 -preset medium -crf 20 -pix_fmt yuv420p` em 1920×1080 ou 3840×2160; `-c:a aac -b:a 192k`; `-movflags +faststart`. Aviso ao usuário de 30–60min para 4K.
5. **Upload**: `videobook-final/{user_id}/{project_id}/{chapter_slug}_{res}.mp4`, atualiza `chapters.videobook_url` + `videobook_status='ready'`.
6. **Progresso detalhado**: hook expõe `{ phase, currentPage, totalPages, percent, etaSec, partialBytes }` consumido pelo modal.

## Dependências

- `npm install page-flip` (StPageFlip)
- Reaproveita `@ffmpeg/ffmpeg`, `@ffmpeg/util`, `pdfjs-dist`, `@djpfs/react-vlibras`, `html2canvas` (verificar se já existe — caso contrário adicionar para captura do VLibras).

## O que NÃO muda

- `usePdfProcessor`, `useTextExtractor`, `useProjectEditor`
- Edge Functions: `extract-text`, `generate-audio`, `get-elevenlabs-voices`, `preview-elevenlabs-voice`, `detect-video-regions`
- Tabelas `pages`, `projects`, `profiles`, `page_narrations` (apenas adição de `pages.image_hd_url`)
- Aba "Narração + AD" e seus componentes
- Landing page, Auth, Dashboard, sistema de planos

## Ordem de implementação (incremental)

1. Migração DB: tabela `chapters` + trigger de sobreposição + coluna `pages.image_hd_url` + buckets.
2. `useChapters` + `ChapterListPanel` + `ChapterEditorDialog` + integração na aba.
3. Edge function `reprocess-pages-highres` + `useHighResPages` + dialog de progresso.
4. `VideobookPlayer` com `page-flip` + áudio sincronizado + controles.
5. `InterpreterPanel` (3 modos) + persistência em `chapters.interpreter_mode/url`.
6. `useChapterVideoExport` + `VideobookExportDialog` novo + upload + status.
7. QA visual + testes de sincronização áudio/virada e composição do frame final.

