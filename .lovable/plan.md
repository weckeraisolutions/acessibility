

# Generate Audio — Edge Function + Frontend Integration

## Overview
Create `generate-audio` edge function that uses Gemini TTS API to convert page text to speech, upload to Storage, and update the database. Wire up the "Gerar Áudio" button in `AudioPageCard` with loading states, player, download, approve, and regenerate functionality.

## 1. Edge Function: `supabase/functions/generate-audio/index.ts`

- POST endpoint accepting `{ page_id, project_id, page_number, text, voice, global_style, page_style, mode, plan, gemini_api_key }`
- Validation: reject empty text, `PÁGINA_SEM_NARRAÇÃO`, `PÁGINA_SEM_AUDIODESCRIÇÃO`, and text >8000 chars
- Model selection: `gemini-2.5-pro-preview-tts` for enterprise, `gemini-2.5-flash-preview-tts` otherwise
- `prepareText()` — same cleaning as extract-text (acronyms, law numbers, brackets)
- Build TTS prompt with voice style instructions in Portuguese
- Call Gemini TTS API with `responseModalities: ["AUDIO"]` and `speechConfig.voiceConfig`
- Decode base64 audio response to `Uint8Array`
- Estimate duration: `(wordCount / 130) * 60`
- Upload to `audiobook-audios` or `audiodesc-audios` bucket at `{project_id}/pag_XXX.mp3` with `upsert: true`
- Create signed URL (private buckets) for the audio file
- Update `pages` table with audio URL, status `audio_generated`, duration, voice, and style
- Return `{ success, audio_url, duration_seconds, page_id }`
- Error handling: `empty_text`, `text_too_long`, `invalid_api_key`, `rate_limit`, `api_error`
- CORS headers on all responses

## 2. Frontend: Update `AudioPageCard.tsx`

- Wire "Gerar Áudio" button to call `generate-audio` edge function via `supabase.functions.invoke()`
- Pass voice (page override or global), style, mode, project_id, page_number, plan (from project or default "free"), and gemini_api_key
- Show `Loader2` spinner during generation
- On success: update local state with audio URL, show `<audio controls>` player
- Show "⬇ Download MP3" button: fetch audio URL → create blob → trigger download as `pagina_XXX_audiobook.mp3`
- Show "✅ Aprovar" button: update status to `approved` via `onUpdate`
- Show "🔁 Regerar com ajuste" button: expand an input for additional style instructions, call generate-audio again with the new `page_style`
- All three buttons already have placeholders — just wire them up

## 3. Files to Create
- `supabase/functions/generate-audio/index.ts`

## 4. Files to Modify
- `src/components/editor/AudioPageCard.tsx` — wire generate/download/approve/regenerate logic

## 5. Deploy & Test
- Deploy edge function
- Test with curl

