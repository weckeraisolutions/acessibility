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

    const res = await fetch("https://api.elevenlabs.io/v1/voices", {
      headers: { "xi-api-key": apiKey },
    });

    if (!res.ok) {
      return new Response(
        JSON.stringify({ success: true, voices: FALLBACK_VOICES }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await res.json();
    const allVoices = data.voices || [];

    // Filter Portuguese voices
    const ptVoices = allVoices
      .filter((v: any) => {
        const lang = v.labels?.language || "";
        const desc = (v.description || "").toLowerCase();
        return lang === "pt" || lang === "pt-BR" || lang === "portuguese" || desc.includes("portuguese") || desc.includes("português");
      })
      .slice(0, 15)
      .map((v: any) => ({
        voice_id: v.voice_id,
        name: v.name,
        description: `${v.labels?.age || ""} ${v.labels?.gender || ""} — ${v.labels?.use_case || v.labels?.description || ""}`.trim(),
        group: "Português BR Nativo",
        preview_url: v.preview_url || null,
      }));

    const voices = ptVoices.length > 0 ? ptVoices : FALLBACK_VOICES;

    return new Response(
      JSON.stringify({ success: true, voices }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ success: true, voices: FALLBACK_VOICES }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
