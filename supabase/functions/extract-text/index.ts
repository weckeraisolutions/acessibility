import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function cleanText(text: string): string {
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

function getPrompt(
  mode: string,
  bookType: string,
  globalStyle: string,
  pageStyle: string
): string {
  const styleNote =
    pageStyle || globalStyle
      ? `\n\nESTILO ADICIONAL: ${pageStyle || globalStyle}`
      : "";

  if (mode === "audiobook") {
    return `Você é especialista em acessibilidade editorial brasileira com domínio das normas NBR 15599, Lei 13.146/2015 e Decreto 5.296/2004. Analise esta imagem de página de livro e extraia o texto para narração em audiobook.

TIPO DE LIVRO: ${bookType}

EXTRAIR OBRIGATORIAMENTE:
- Todo texto corrido principal sem omitir nenhuma palavra ou frase
- Títulos, subtítulos e seções em qualquer hierarquia
- Conteúdo completo de boxes, caixas de destaque, quadros e tabelas com texto
- Glossários: escrever termo e definição na mesma linha sem separação visual
- Balões de fala de personagens: formatar SEMPRE como "Nome diz: texto da fala"
- Poemas, músicas e versos na íntegra mantendo estrutura de versos separados por quebra de linha simples
- Instruções de atividades práticas completas
- Notas de rodapé e notas explicativas
- Créditos, fontes e referências textuais
- Epígrafes, citações e epigramas
- Texto presente em mapas, gráficos e legendas quando houver texto escrito

NÃO EXTRAIR:
- Descrições de ilustrações, fotografias ou artes visuais (recurso separado)
- Gabaritos, respostas marcadas, alternativas corretas indicadas visualmente
- Texto "Resposta pessoal", "Espera-se que o estudante" ou equivalentes
- Alternativas de questões de múltipla escolha e seus enunciados
- Elementos decorativos sem informação semântica
- Número de página isolado sem contexto

FORMATO DE SAÍDA OBRIGATÓRIO:
- Texto corrido e contínuo
- Sem linhas em branco entre parágrafos — usar apenas uma quebra de linha simples entre trechos
- Sem colchetes, sem marcadores como [Título] ou [Box], sem rótulos de tipo
- Balões sempre: Nome diz: texto da fala
- Fórmulas matemáticas ou científicas: substituir por [Fórmula — consultar versão acessível]
- Se absolutamente nenhum texto narrável existe nesta página: retornar apenas a palavra PÁGINA_SEM_NARRAÇÃO${styleNote}`;
  }

  return `Você é especialista em audiodescrição para publicações editoriais brasileiras com domínio das normas ABNT NBR 15599 e Guia para Produções Audiovisuais Acessíveis do MEC. Analise esta imagem de página de livro e produza a audiodescrição dos elementos visuais.

TIPO DE LIVRO: ${bookType}

DESCREVER OBRIGATORIAMENTE:
- Ilustrações: personagens (aparência física visível, expressão facial, postura, ação, vestimenta, posição), cenário, cores dominantes, composição geral
- Fotografias: sujeito principal, contexto, enquadramento, plano fotográfico
- Mapas: título, regiões destacadas ou coloridas, legenda, elementos geográficos relevantes
- Gráficos e infográficos: tipo, título, eixos e unidades, valores principais, tendência
- Tabelas: estrutura, cabeçalhos, dados relevantes
- Ícones e símbolos com significado funcional
- Elementos decorativos com significado cultural, histórico ou pedagógico

REGRAS OBRIGATÓRIAS:
- Objetivo e imparcial — descrever o visível, não interpretar
- Do geral para o específico
- Verbos no presente do indicativo
- Características físicas visíveis sem julgamento de valor
- Mencionar posições relevantes (à esquerda, no centro, ao fundo)
- Mencionar cores quando relevantes para compreensão

FORMATO:
- Texto corrido e contínuo
- Sem linhas em branco entre parágrafos
- Sem colchetes ou marcadores de tipo
- Se não há elementos visuais relevantes: retornar apenas PÁGINA_SEM_AUDIODESCRIÇÃO${styleNote}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      page_id,
      image_url,
      mode,
      book_type,
      global_style,
      page_style,
    } = await req.json();

    const gemini_api_key = Deno.env.get("GEMINI_API_KEY");

    // Validate required fields
    if (!page_id || !image_url || !mode) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "missing_fields",
          message: "Campos obrigatórios: page_id, image_url, mode",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!gemini_api_key) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "api_key_missing",
          message: "GEMINI_API_KEY não configurada no servidor",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Download image and convert to base64
    const imgResponse = await fetch(image_url);
    if (!imgResponse.ok) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "image_download_failed",
          message: "Não foi possível baixar a imagem da página",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const imgBuffer = await imgResponse.arrayBuffer();
    const imgBase64 = btoa(
      new Uint8Array(imgBuffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
    );

    // Build prompt
    const prompt = getPrompt(mode, book_type || "general", global_style || "", page_style || "");

    // Call Gemini Vision API
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${gemini_api_key}`;
    const geminiResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { inlineData: { mimeType: "image/png", data: imgBase64 } },
              { text: prompt },
            ],
          },
        ],
      }),
    });

    if (!geminiResponse.ok) {
      const status = geminiResponse.status;
      const errText = await geminiResponse.text();
      console.error("Gemini error:", status, errText);

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
    const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const cleanedText = cleanText(rawText);

    const noContent =
      cleanedText === "PÁGINA_SEM_NARRAÇÃO" || cleanedText === "PÁGINA_SEM_AUDIODESCRIÇÃO";

    // Update pages table
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const textField = mode === "audiobook" ? "audiobook_text" : "audiodesc_text";
    const statusField = mode === "audiobook" ? "audiobook_status" : "audiodesc_status";

    const { error: updateError } = await supabase
      .from("pages")
      .update({
        [textField]: cleanedText,
        [statusField]: noContent ? "no_content" : "extracted",
        updated_at: new Date().toISOString(),
      })
      .eq("id", page_id);

    if (updateError) {
      console.error("DB update error:", updateError);
    }

    return new Response(
      JSON.stringify({ success: true, text: cleanedText, no_content: noContent, page_id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("extract-text error:", e);
    return new Response(
      JSON.stringify({ success: false, error: "api_error", message: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
