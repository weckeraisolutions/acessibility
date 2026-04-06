

# Extract Text — Edge Function + Frontend Integration

## Overview
Create `extract-text` edge function that uses Gemini Vision API to extract text/audiodescription from page images, then wire up the "Extrair todos os textos" button and per-page "Extrair esta página" button in the frontend with sequential processing, retry logic, and real-time status updates.

## 1. Edge Function: `supabase/functions/extract-text/index.ts`

- POST endpoint accepting `{ page_id, image_url, mode, book_type, global_style, page_style, gemini_api_key }`
- Input validation with manual checks (return 400 on missing fields)
- Download image from `image_url`, convert to base64
- Select prompt based on `mode` (audiobook vs audiodesc) — full prompts as specified
- Call Gemini Vision API: `POST https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key={gemini_api_key}`
- Extract text from response, apply `cleanText()` function (acronym expansion, law number conversion, bracket removal)
- Check for no-content markers (`PÁGINA_SEM_NARRAÇÃO` / `PÁGINA_SEM_AUDIODESCRIÇÃO`)
- Update `pages` table via Supabase service role client with extracted text and status
- Return `{ success, text, no_content, page_id }` or error with appropriate codes
- CORS headers on all responses

## 2. API Key: User provides Gemini API key
- The edge function receives it per-request in the body (`gemini_api_key`)
- Frontend stores it in a state variable (prompted via dialog before batch extraction)
- No server-side secret needed for Gemini key

## 3. Frontend: `useTextExtractor` hook (`src/hooks/useTextExtractor.ts`)
- State: `extracting`, `currentPage`, `totalPages`, `results` (extracted/no_content/error counts)
- `extractAll(pages, mode, project)`: iterates pages sequentially, calls edge function for each
- Retry with exponential backoff on 429: wait 2s, 4s, then skip after 3 attempts
- Updates page state in real-time via `onPageUpdate` callback
- `extractSingle(page, mode, project)`: extract one page
- Returns progress and summary

## 4. Frontend: Gemini API Key Dialog
- Small dialog/popover in `GlobalConfigPanel` that asks for the Gemini API key before starting batch extraction
- Store in component state (not persisted) — user enters once per session
- Link to Google AI Studio for key generation

## 5. Update `GlobalConfigPanel.tsx`
- Add props: `pages`, `project`, `onPageUpdate`
- Replace placeholder toast on "Extrair todos os textos" with actual extraction logic
- Show progress bar during extraction: "Extraindo página X de Y..."
- Show summary toast on completion

## 6. Update `AudioPageCard.tsx`
- Wire "Extrair esta página" button to call `extract-text` for single page
- Accept `project` prop for book_type and global_style
- Show loading state on button during extraction

## 7. Update `ProjectDetail.tsx`
- Pass `project` and `pages` + `updatePage` to `GlobalConfigPanel`
- Ensure page status updates propagate to badges in header

## Files to Create
- `supabase/functions/extract-text/index.ts`
- `src/hooks/useTextExtractor.ts`

## Files to Modify
- `src/components/editor/GlobalConfigPanel.tsx` — add extraction UI + props
- `src/components/editor/AudioPageCard.tsx` — wire single-page extraction + accept project prop
- `src/pages/ProjectDetail.tsx` — pass new props down

## Deploy
- Deploy edge function via `supabase--deploy_edge_functions`
- Test with `supabase--curl_edge_functions`

