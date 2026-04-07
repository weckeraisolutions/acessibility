import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FALLBACK_VOICES = [
  { voice_id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel", description: "Calorosa e clara", group: "Narração — Feminino PT-BR" },
  { voice_id: "EXAVITQu4vr4xnSDxMaL", name: "Bella", description: "Suave e expressiva", group: "Narração — Feminino PT-BR" },
  { voice_id: "MF3mGyEYCl7XYWbV9V6O", name: "Elli", description: "Jovem e energética", group: "Narração — Feminino PT-BR" },
  { voice_id: "pNInz6obpgDQGcFmaJgB", name: "Adam", description: "Grave e profissional", group: "Narração — Masculino PT-BR" },
  { voice_id: "ErXwobaYiN019PkySvjV", name: "Antoni", description: "Clara e versátil", group: "Narração — Masculino PT-BR" },
  { voice_id: "TxGEqnHWrfWFTfGW9XjX", name: "Josh", description: "Jovem e dinâmica", group: "Narração — Masculino PT-BR" },
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("ELEVENLABS_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: true, voices: FALLBACK_VOICES }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const collectionId = Deno.env.get("ELEVENLABS_COLLECTION_ID") ?? "EeX6rO9BE2F5Evmmr9sB";

    const url = `https://api.elevenlabs.io/v2/voices?collection_id=${collectionId}&page_size=100`;

    const res = await fetch(url, {
      headers: { "xi-api-key": apiKey },
    });

    console.log("ElevenLabs v2 request URL:", url);

    if (!res.ok) {
      console.error("ElevenLabs v2 voices error:", res.status, await res.text());
      return new Response(
        JSON.stringify({ success: true, voices: FALLBACK_VOICES }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await res.json();
    const allVoices = data.voices || [];

    const voices = allVoices.length > 0
      ? allVoices.map((v: any) => ({
          voice_id: v.voice_id,
          name: v.name,
          description: `${v.labels?.age || ""} ${v.labels?.gender || ""} — ${v.labels?.use_case || v.labels?.description || ""}`.trim(),
          group: "Coleção ElevenLabs",
          preview_url: v.preview_url || null,
        }))
      : FALLBACK_VOICES;

    return new Response(
      JSON.stringify({ success: true, voices }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("get-elevenlabs-voices error:", e);
    return new Response(
      JSON.stringify({ success: true, voices: FALLBACK_VOICES }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
