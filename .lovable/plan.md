

# PDF Processing & Page Rendering

## Overview
Implement client-side PDF processing using `pdfjs-dist` when a project is loaded at `/projeto/:id`. The PDF is downloaded from Supabase Storage, each page is rendered to canvas, uploaded as PNG images (full + thumbnail), and inserted into the `pages` table. A processing screen with real progress is shown during this pipeline.

## New Files

### `src/hooks/usePdfProcessor.ts`
Custom hook that encapsulates the entire PDF processing pipeline:
- **Inputs**: `project` object, `pages` array, `refetch` callback
- **State**: `processing`, `progress` (0-100), `currentPage`, `totalPages`, `error`
- **Logic**:
  1. On mount, check if `processing_status === 'pending'` AND `pages.length === 0` AND `pdf_url` exists → trigger processing
  2. If `processing_status === 'ready'` or pages exist → skip
  3. Download PDF: fetch signed URL from `supabase.storage.from('pdfs').createSignedUrl(project.pdf_url, 3600)`, then `fetch()` the URL
  4. Load with `pdfjs-dist`: `getDocument({ data: arrayBuffer })`
  5. Update `total_pages` on the project in Supabase
  6. Process pages in **batches of 5** using a chunked Promise.all loop
  7. For each page:
     - Render at 150 DPI (scale = 150/72 ≈ 2.08) to canvas → PNG blob
     - Render at 72 DPI (scale = 1.0) for thumbnail → PNG blob
     - Upload full image to `page-images/{project_id}/pag_XXX.png`
     - Upload thumbnail to `page-thumbnails/{project_id}/thumb_XXX.png`
     - Get public URLs from the public buckets
     - Insert row into `pages` table with `project_id`, `page_number`, `image_url`, `thumbnail_url`
     - Free canvas memory (`canvas.width = 0`)
     - Update progress state
  8. On completion: update `processing_status = 'ready'`, call `refetch()`
  9. Error handling: password-protected PDFs detected via pdfjs error, invalid PDFs show error message, individual page failures are skipped with toast

### `src/components/editor/ProcessingScreen.tsx`
Processing overlay component:
- Props: `progress`, `currentPage`, `totalPages`, `error`, `onRetry`
- Animated spinner icon
- Title "Processando seu livro..."
- Real progress bar with percentage
- Dynamic text: "Processando página X de Y"
- Subtitle: "Não feche esta aba durante o processamento"
- Error state: show error message + "Tentar novamente" button
- Special message for password-protected PDFs

## Modified Files

### `package.json`
- Add `pdfjs-dist` dependency

### `src/pages/ProjectDetail.tsx`
- Import and use `usePdfProcessor(project, pages, refetch)`
- Replace the static "Processando PDF..." screen (lines 51-58) with `<ProcessingScreen>` component that shows real progress
- Condition: if `processing` is true OR (`processing_status === 'pending'` AND no pages), show ProcessingScreen
- Pass `refetch` from `useProjectEditor` to trigger re-render after processing completes

### `src/components/editor/AudioPageCard.tsx`
- Update image rendering: use `thumbnail_url` for the card preview (smaller/faster) instead of `image_url`
- Keep `image_url` available for full-size viewing if needed later

### `src/hooks/useProjectEditor.ts`
- Expose `setProject` or `setPages` so the processor can update local state without full refetch (optional optimization)

## Technical Details

- **pdfjs-dist worker**: Configure `GlobalWorkerOptions.workerSrc` to CDN URL matching the installed version
- **Storage paths**: `page-images/{project_id}/pag_001.png` (public bucket), `page-thumbnails/{project_id}/thumb_001.png` (public bucket)
- **Public URLs**: Use `supabase.storage.from('page-images').getPublicUrl(path)` since buckets are public
- **Batch processing**: Process 5 pages concurrently per batch to balance speed and memory
- **Canvas cleanup**: Set `canvas.width = 0; canvas.height = 0` after each page to free memory
- **PDF download**: Use `createSignedUrl` since `pdfs` bucket is private

## Implementation Order
1. Install `pdfjs-dist`, create `usePdfProcessor` hook
2. Create `ProcessingScreen` component
3. Update `ProjectDetail.tsx` to wire everything together
4. Update `AudioPageCard` to use thumbnails

