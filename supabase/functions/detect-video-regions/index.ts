import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callGeminiWithFailover, validateGeminiKeysConfigured, isBothKeysFailed } from "../_shared/gemini-keys.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function estimateTimestamps(
  regions: any[],
  text: string,
  audioDuration: number
) {
  const words = text.trim().split(/\s+/);
  const totalWords = words.length;
  const wordsPerSecond = totalWords / audioDuration;

  return regions.map((region, index) => {
    let timestampStart = 0;
    if (region.text_trigger && region.text_trigger.length > 0) {
      const triggerPos = text.indexOf(region.text_trigger);
      if (triggerPos > -1) {
        const wordsBefore = text
          .substring(0, triggerPos)
          .trim()
          .split(/\s+/).length;
        timestampStart = parseFloat(
          (wordsBefore / wordsPerSecond).toFixed(2)
        );
      } else {
        timestampStart = parseFloat(
          ((audioDuration / regions.length) * index).toFixed(2)
        );
      }
    }
    const timestampEnd = parseFloat(
      Math.min(
        timestampStart + audioDuration / Math.max(regions.length, 1),
        audioDuration
      ).toFixed(2)
    );
    return { ...region, timestamp_start: timestampStart, timestamp_end: timestampEnd };
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      page_id,
      image_url,
      audiobook_text,
      audio_duration_seconds,
      book_type,
    } = await req.json();

    if (!page_id || !image_url) {
      return new Response(
        JSON.stringify({ success: false, error: "page_id and image_url are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!audiobook_text || !audio_duration_seconds) {
      return new Response(
        JSON.stringify({ success: false, error: "audiobook_text and audio_duration_seconds are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const keysCheck = validateGeminiKeysConfigured();
    if (!keysCheck.ok) {
      return new Response(
        JSON.stringify({ success: false, error: "no_gemini_keys", message: keysCheck.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Download image
    const imgResponse = await fetch(image_url);
    if (!imgResponse.ok) {
      return new Response(
        JSON.stringify({ success: false, error: "Failed to download image" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const imgBuffer = await imgResponse.arrayBuffer();
    const base64Image = btoa(
      new Uint8Array(imgBuffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
    );
    const contentType = imgResponse.headers.get("content-type") || "image/png";

    const prompt = `Analise esta imagem de página de livro e identifique todas as regiões visuais relevantes para animação de videobook educacional.

Para cada região identificada, forneça as informações no formato JSON especificado.

Tipos de região possíveis: "character" (personagem ilustrado), "highlight_box" (caixa de destaque ou box informativo), "title" (título ou subtítulo), "illustration" (ilustração ou imagem), "map" (mapa), "diagram" (diagrama ou gráfico), "decorative" (elemento decorativo relevante)

Animações possíveis: "zoom_in" (zoom suave de aproximação), "zoom_out" (zoom suave de afastamento), "ken_burns" (zoom + pan simultâneos), "pan_right" (deslizamento para direita), "pan_left" (deslizamento para esquerda), "spotlight" (destaque com escurecimento ao redor), "pulse_border" (contorno pulsante brilhante), "fade_in" (aparecimento gradual), "none" (sem animação específica)

Transições possíveis: "fade", "slide_left", "slide_right", "page_flip", "cut"

TEXTO NARRADO DESTA PÁGINA (para identificar os trechos de ativação):
${audiobook_text}

DURAÇÃO DO ÁUDIO: ${audio_duration_seconds} segundos

Tipo do livro: ${book_type || "general"}

Retornar APENAS JSON válido sem texto adicional, markdown ou explicações:
{
  "regions": [
    {
      "id": "region_1",
      "label": "nome descritivo em português",
      "type": "character",
      "x": 0.10,
      "y": 0.05,
      "width": 0.30,
      "height": 0.50,
      "animation_suggestion": "spotlight",
      "priority": 1,
      "text_trigger": "trecho exato do texto narrado que ativa esta animação"
    }
  ],
  "page_base_animation": "ken_burns",
  "suggested_transition": "fade"
}

Coordenadas x, y, width, height são valores de 0.0 a 1.0 em proporção das dimensões da imagem (0,0 = canto superior esquerdo, 1,1 = canto inferior direito).`;

    let geminiResponse: Response;
    try {
      geminiResponse = await callGeminiWithFailover(async (apiKey, _idx) => {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
        return await fetch(geminiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: prompt },
                  {
                    inline_data: {
                      mime_type: contentType,
                      data: base64Image,
                    },
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 4096,
            },
          }),
        });
      });
    } catch (e) {
      if (isBothKeysFailed(e)) {
        if (e.last_status === 429) {
          return new Response(
            JSON.stringify({ success: false, error: "rate_limit", message: "Rate limit atingido em ambas as chaves Gemini. Tente novamente em alguns segundos." }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        return new Response(
          JSON.stringify({ success: false, error: "gemini_error", message: `Erro Gemini em ambas as chaves: ${e.last_status}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw e;
    }

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text();
      console.error("Gemini error:", geminiResponse.status, errText);
      const status = geminiResponse.status;
      if (status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: "rate_limit", message: "Rate limit atingido. Tente novamente em alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ success: false, error: "gemini_error", message: `Erro Gemini: ${status}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const geminiData = await geminiResponse.json();
    let rawText =
      geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Strip markdown code fences if present
    rawText = rawText.replace(/```json\s*/gi, "").replace(/```\s*/gi, "").trim();

    let parsed: any;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      console.error("Failed to parse Gemini response:", rawText);
      return new Response(
        JSON.stringify({ success: false, error: "parse_error", message: "Não foi possível interpretar a resposta da IA." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const regions = parsed.regions || [];
    const regionsWithTimestamps = estimateTimestamps(
      regions,
      audiobook_text,
      audio_duration_seconds
    );

    const regionsObject = {
      regions: regionsWithTimestamps,
      page_base_animation: parsed.page_base_animation || "ken_burns",
      suggested_transition: parsed.suggested_transition || "fade",
    };

    // Update database
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { error: updateError } = await supabase
      .from("pages")
      .update({
        video_regions: regionsObject,
        video_status: "regions_detected",
        video_transition: parsed.suggested_transition || "fade",
      })
      .eq("id", page_id);

    if (updateError) {
      console.error("DB update error:", updateError);
      return new Response(
        JSON.stringify({ success: false, error: "db_error", message: updateError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, regions: regionsObject, page_id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("detect-video-regions error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
