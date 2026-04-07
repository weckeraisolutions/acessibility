

# Correção Completa — Audiobook & Audiodescrição

## Problemas Identificados

### Problema 1: Timeout em páginas com muito conteúdo
- **Causa**: `extract-text` edge function uses `btoa()` with string concatenation for large images — can be slow but main issue is no timeout on the Gemini API call. The Supabase edge function has a ~60s limit; large images + long prompts can exceed this.
- **Fix**: Add `AbortController` with 55s timeout to the Gemini fetch call. Also add a `signal` parameter. The current approach (edge function downloads image by URL) is already correct — no base64 from frontend.

### Problema 2: Geração de áudio não funciona
- **Causa**: Looking at `generate-audio`, the implementation looks correct — reads `GEMINI_API_KEY` from env, uses service role for upload. The issue is likely that `supabase.functions.invoke` returns errors in a way that's swallowed. Need to check error handling and ensure the function is deployed. Also, the `btoa()`-based base64 decoding of audio on line 76 (`Uint8Array.from(atob(audioPart.data), (c) => c.charCodeAt(0))`) can fail for large audio — should use proper base64 decoding.
- **Fix**: Use `decode` from Deno's base64 module instead of `atob()` for binary data. Add timeout to Gemini TTS call. Improve frontend error messages.

### Problema 3: ElevenLabs bloqueado
- **Causa**: `ProjectDetail.tsx` line 32: `canUseElevenlabs = !!(profile?.elevenlabs_default_voice_id)` — requires user to have configured a default voice in Settings. Should instead check if the ElevenLabs service is available (API key exists on server).
- **Fix**: Change availability check to call `get-elevenlabs-voices` on mount and use result to determine availability. Remove plan-based restriction. Make voice selector work for ElevenLabs in both global panel and per-page cards.

## Implementation Plan

### 1. Fix `extract-text` Edge Function
- Add `AbortController` with 55s timeout to Gemini API call
- Use Deno's `encode`/base64 properly for large images
- Improve error responses with distinct error codes

### 2. Fix `generate-audio` Edge Function  
- Replace `atob()` with Deno's `decode` from `std/encoding/base64.ts` for audio binary
- Add 55s timeout to Gemini TTS call
- Add 55s timeout to ElevenLabs call
- Handle `403` from ElevenLabs as "credits exhausted" with specific message

### 3. Fix ElevenLabs Availability in Frontend
- **`ProjectDetail.tsx`**: Remove `canUseElevenlabs = !!(profile?.elevenlabs_default_voice_id)`. Instead, add a `useEffect` that calls `get-elevenlabs-voices` on mount. If it returns voices successfully, set `canUseElevenlabs = true`.
- **`GlobalConfigPanel.tsx`**: Accept `elevenlabsVoices` prop. When ElevenLabs is selected, show these voices in the voice selector (not disabled). Allow changing the voice.
- **`AudioPageCard.tsx`**: Accept `ttsEngine` prop. When `elevenlabs`, show ElevenLabs voices and pass `use_elevenlabs: true` to generate-audio. Allow per-page voice override for ElevenLabs voices too.
- Remove dependency on `profile.elevenlabs_default_voice_id` for availability — the key is on the server.

### 4. Better Frontend Error Handling
- In `useTextExtractor.ts`: Parse error response from edge function and show specific toast messages
- In `AudioPageCard.tsx`: Show specific error messages for each failure type (invalid key, rate limit, credits exhausted, timeout)

## Files to Modify
- `supabase/functions/extract-text/index.ts` — add timeout
- `supabase/functions/generate-audio/index.ts` — fix base64 decoding, add timeout, improve ElevenLabs error handling
- `src/pages/ProjectDetail.tsx` — fix ElevenLabs availability check, pass voices/engine down
- `src/components/editor/GlobalConfigPanel.tsx` — accept ElevenLabs voices, enable voice selection
- `src/components/editor/AudioPageCard.tsx` — accept ttsEngine, show correct voices per engine
- `src/hooks/useTextExtractor.ts` — better error messages in toasts

## Files NOT Modified
- Edge functions `get-elevenlabs-voices` and `preview-elevenlabs-voice` — already correct
- Videobook components — explicitly excluded

