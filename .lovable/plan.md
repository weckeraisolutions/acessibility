

# ZIP Downloads with JSZip

## Overview
Install `jszip` and `file-saver`, then implement chapter-based and full-book ZIP downloads in `ExportFooter`, plus a progress overlay dialog.

## Dependencies
- `npm install jszip file-saver @types/file-saver`

## New Files

### `src/hooks/useZipDownload.ts`
Hook encapsulating ZIP creation logic:
- State: `downloading`, `progress` (0-100), `currentFile`, `totalFiles`, `cancelled`
- `downloadChapter(pages, projectName, chapterName, mode)`: filters pages with audio URLs for the given mode, fetches each audio blob, adds to JSZip, triggers `saveAs`
- `downloadFullBook(pages, projectName, mode, chapters?)`: all pages with audio, optionally organized in subfolders by chapter
- `cancel()`: sets cancelled flag to abort loop
- Progress updated after each file fetch
- Toast on empty selection ("Nenhum audio gerado neste capitulo")

### `src/hooks/useChapters.ts`
Hook for chapter management with localStorage persistence:
- State: `chapters` array of `{ id, name, startPage, endPage }`
- `addChapter(name, start, end)`, `removeChapter(id)`
- Load/save from `localStorage` keyed by `chapters_{projectId}`
- Always includes implicit "Livro inteiro" option (not stored)

## Modified Files

### `src/components/editor/ExportFooter.tsx`
Complete rewrite:
- Props: add `pages`, `projectName`, `projectId` (in addition to existing `activeTab`, `totalPages`)
- Use `useChapters(projectId)` for chapter config
- Use `useZipDownload()` for download actions
- UI sections:
  1. **Chapter config**: input for name + start/end page numbers + "Adicionar" button, list of chapters with remove buttons
  2. **Chapter select**: dropdown with "Livro inteiro" + configured chapters
  3. **"Baixar selecao (ZIP)"**: downloads audio for selected chapter range in current mode (audiobook/audiodesc based on `activeTab`)
  4. **"Baixar livro inteiro (ZIP)"**: downloads all audio for current mode
  5. **Videobook button**: placeholder (kept as-is)
- Progress overlay: Dialog with progress bar, "Preparando download... X de Y arquivos", Cancel button

### `src/pages/ProjectDetail.tsx`
- Pass `pages`, `project.name`, `project.id` to `ExportFooter`

### `src/components/editor/AudioPageCard.tsx`
- Download button already works (uses fetch + blob + createElement approach) — no changes needed

## Technical Details
- JSZip: `const zip = new JSZip(); zip.file(name, blob); zip.generateAsync({type: 'blob'})` 
- file-saver: `saveAs(blob, filename)`
- Audio URL field: `audiobook_audio_url` or `audiodesc_audio_url` based on active tab mode
- ZIP filenames: `{projectName}_{chapterName}.zip` or `{projectName}_audiobook_completo.zip`
- Cancel: check `cancelledRef.current` before each fetch in loop

