import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getAuthedUser } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FALLBACK_VOICES = [
  { voice_id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel", description: "Calorosa e clara", preview_url: "", group: "Narração — Feminino PT-BR" },
  { voice_id: "EXAVITQu4vr4xnSDxMaL", name: "Bella", description: "Suave e expressiva", preview_url: "", group: "Narração — Feminino PT-BR" },
  { voice_id: "MF3mGyEYCl7XYWbV9V6O", name: "Elli", description: "Jovem e energética", preview_url: "", group: "Narração — Feminino PT-BR" },
  { voice_id: "pNInz6obpgDQGcFmaJgB", name: "Adam", description: "Grave e profissional", preview_url: "", group: "Narração — Masculino PT-BR" },
  { voice_id: "ErXwobaYiN019PkySvjV", name: "Antoni", description: "Clara e versátil", preview_url: "", group: "Narração — Masculino PT-BR" },
  { voice_id: "TxGEqnHWrfWFTfGW9XjX", name: "Josh", description: "Jovem e dinâmica", preview_url: "", group: "Narração — Masculino PT-BR" },
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const user = await getAuthedUser(req);
    if (!user) {
      return new Response(
        JSON.stringify({ success: false, error: "unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = Deno.env.get("ELEVENLABS_API_KEY");
    if (!apiKey) {
      console.error("[ElevenLabs] ELEVENLABS_API_KEY não configurada nos Secrets");
      return new Response(
        JSON.stringify({
          success: false,
          error: "missing_api_key",
          message: "ELEVENLABS_API_KEY não está configurada nos Secrets do backend.",
          voices: FALLBACK_VOICES,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const collectionId = Deno.env.get("ELEVENLABS_COLLECTION_ID") ?? "EeX6rO9BE2F5Evmmr9sB";
    // Paginate through ALL voices in the collection (ElevenLabs returns up to 100 per page)
    const allVoices: Record<string, unknown>[] = [];
    let nextPageToken: string | null = null;
    let pageCount = 0;
    do {
      const params = new URLSearchParams({
        collection_id: collectionId,
        page_size: "100",
      });
      if (nextPageToken) params.set("next_page_token", nextPageToken);
      const url = `https://api.elevenlabs.io/v2/voices?${params.toString()}`;
      console.log("[ElevenLabs] Request URL:", url);

      const res = await fetch(url, { headers: { "xi-api-key": apiKey } });
      if (!res.ok) {
        const errorBody = await res.text();
        console.error("[ElevenLabs] Erro HTTP", res.status, errorBody);
        if (allVoices.length === 0) {
          return new Response(
            JSON.stringify({
              success: false,
              error: "elevenlabs_api_error",
              status: res.status,
              message: `Não foi possível carregar as vozes da sua conta ElevenLabs (HTTP ${res.status}). Verifique se a ELEVENLABS_API_KEY nos Secrets é a chave atual da sua conta com permissão voices_read.`,
              details: errorBody,
              voices: FALLBACK_VOICES,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        break;
      }
      const data = await res.json();
      const batch = data.voices || [];
      allVoices.push(...batch);
      nextPageToken = data.has_more && data.next_page_token ? data.next_page_token : null;
      pageCount++;
      if (pageCount >= 10) break; // safety cap (~1000 voices)
    } while (nextPageToken);
    console.log("[ElevenLabs] Total paginado:", allVoices.length, "em", pageCount, "página(s)");

    if (allVoices.length === 0) {
      console.warn("[ElevenLabs] API retornou 0 vozes na coleção", collectionId);
      return new Response(
        JSON.stringify({
          success: true,
          warning: "Coleção vazia — usando vozes padrão.",
          voices: FALLBACK_VOICES,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Deduplicate by voice_id and sort alphabetically by name
    const seen = new Set<string>();
    const voices = allVoices
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((v: any) => {
        if (!v?.voice_id || seen.has(v.voice_id)) return false;
        seen.add(v.voice_id);
        return true;
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((v: any) => ({
        voice_id: v.voice_id,
        name: v.name,
        description: v.description ?? `${v.labels?.age || ""} ${v.labels?.gender || ""} — ${v.labels?.use_case || ""}`.trim(),
        preview_url: v.preview_url ?? "",
        group: "Coleção ElevenLabs",
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

    console.log("[ElevenLabs] Vozes carregadas:", voices.length, "— Amostra:", JSON.stringify(voices.slice(0, 3)));

    return new Response(
      JSON.stringify({ success: true, voices }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[ElevenLabs] Exceção não tratada:", e);
    const errMsg = e instanceof Error ? e.message : String(e);
    return new Response(
      JSON.stringify({
        success: false,
        error: "unexpected_error",
        message: `Erro inesperado ao buscar vozes: ${errMsg}`,
        voices: FALLBACK_VOICES,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
