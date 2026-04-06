import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function prepareText(text: string): string {
  return text
    .replace(/\[.*?\]/g, "")
    .replace(/\n{2,}/g, "\n")
    .replace(/\bIBGE\b/g, "I-B-G-E")
    .replace(/\bBNCC\b/g, "B-N-C-C")
    .replace(/\bONU\b/g, "O-N-U")
    .replace(/\bMEC\b/g, "M-E-C")
    .replace(/\bUSA\b/g, "U-S-A")
    .replace(/\bEUA\b/g, "E-U-A")
    .replace(
      /\b10\.639\/2003\b/g,
      "Lei dez mil seiscentos e trinta e nove de dois mil e três"
    )
    .replace(
      /\b11\.645\/2008\b/g,
      "Lei onze mil seiscentos e quarenta e cinco de dois mil e oito"
    )
    .trim();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      page_id,
      project_id,
      page_number,
      text,
      voice,
      global_style,
      page_style,
      mode,
      plan,
      gemini_api_key,
    } = await req.json();

    // Validate required fields
    if (!page_id || !project_id || !text || !voice || !mode || !gemini_api_key) {
      return new Response(
        JSON.stringify({ success: false, error: "missing_fields", message: "Campos obrigatórios faltando" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Reject no-content markers
    if (
      !text.trim() ||
      text.trim() === "PÁGINA_SEM_NARRAÇÃO" ||
      text.trim() === "PÁGINA_SEM_AUDIODESCRIÇÃO"
    ) {
      return new Response(
        JSON.stringify({ success: false, error: "empty_text", message: "Texto vazio ou sem conteúdo narrável" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Text length limit
    if (text.length > 8000) {
      return new Response(
        JSON.stringify({ success: false, error: "text_too_long", message: "Texto muito longo. Reduza o conteúdo desta página e tente novamente." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Model selection
    const model = plan === "enterprise"
      ? "gemini-2.5-pro-preview-tts"
      : "gemini-2.5-flash-preview-tts";

    // Build TTS prompt
    const styleApplied =
      page_style?.trim() ||
      global_style?.trim() ||
      "Ritmo fluido e contínuo, dicção clara e precisa em português brasileiro";

    const ttsPrompt = `Você é narrador profissional de audiobooks em português do Brasil.

IDIOMA: português do Brasil nativo em pronúncia, entonação e ritmo.

ESTILO: ${styleApplied}

REGRAS: narrar 100% do texto sem omitir nenhuma palavra. Pronúncia completamente nativa brasileira. Nomes indígenas e africanos com clareza e respeito. Siglas pronunciadas letra por letra conforme indicado no texto. Ritmo constante conforme estilo definido.

TEXTO:

${prepareText(text)}`;

    // Call Gemini TTS API
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${gemini_api_key}`;
    const geminiResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: ttsPrompt }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voice },
            },
          },
        },
      }),
    });

    if (!geminiResponse.ok) {
      const status = geminiResponse.status;
      const errText = await geminiResponse.text();
      console.error("Gemini TTS error:", status, errText);

      if (status === 400 || status === 403) {
        return new Response(
          JSON.stringify({ success: false, error: "invalid_api_key", message: "Chave da API Gemini inválida" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: "rate_limit", message: "Limite de requisições atingido" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ success: false, error: "api_error", message: errText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const geminiData = await geminiResponse.json();
    const audioPart = geminiData?.candidates?.[0]?.content?.parts?.[0]?.inlineData;

    if (!audioPart?.data) {
      console.error("No audio data in response:", JSON.stringify(geminiData).slice(0, 500));
      return new Response(
        JSON.stringify({ success: false, error: "api_error", message: "Nenhum áudio retornado pela API" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Decode base64 audio
    const audioBase64 = audioPart.data;
    const audioBytes = Uint8Array.from(atob(audioBase64), (c) => c.charCodeAt(0));

    // Estimate duration
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    const estimatedDurationSeconds = parseFloat(((wordCount / 130) * 60).toFixed(2));

    // Upload to Storage
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const bucket = mode === "audiobook" ? "audiobook-audios" : "audiodesc-audios";
    const pageNum = String(page_number || 1).padStart(3, "0");
    const filePath = `${project_id}/pag_${pageNum}.mp3`;

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filePath, audioBytes, { contentType: "audio/mpeg", upsert: true });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return new Response(
        JSON.stringify({ success: false, error: "storage_error", message: uploadError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create signed URL (private bucket)
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from(bucket)
      .createSignedUrl(filePath, 60 * 60 * 24 * 365); // 1 year

    if (signedUrlError) {
      console.error("Signed URL error:", signedUrlError);
    }

    const audioUrl = signedUrlData?.signedUrl || "";

    // Update pages table
    const textField = mode === "audiobook" ? "audiobook_audio_url" : "audiodesc_audio_url";
    const statusField = mode === "audiobook" ? "audiobook_status" : "audiodesc_status";
    const durationField = mode === "audiobook" ? "audiobook_audio_duration_seconds" : "audiodesc_audio_duration_seconds";
    const voiceField = mode === "audiobook" ? "audiobook_voice" : "audiodesc_voice";
    const styleField = mode === "audiobook" ? "audiobook_style" : "audiodesc_style";

    const { error: updateError } = await supabase
      .from("pages")
      .update({
        [textField]: audioUrl,
        [statusField]: "audio_generated",
        [durationField]: estimatedDurationSeconds,
        [voiceField]: voice,
        [styleField]: styleApplied,
        updated_at: new Date().toISOString(),
      })
      .eq("id", page_id);

    if (updateError) {
      console.error("DB update error:", updateError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        audio_url: audioUrl,
        duration_seconds: estimatedDurationSeconds,
        page_id,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-audio error:", e);
    return new Response(
      JSON.stringify({ success: false, error: "api_error", message: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
