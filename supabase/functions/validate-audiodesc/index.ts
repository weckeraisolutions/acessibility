import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function respond(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const SYSTEM_PROMPT = `Você é um auditor especialista em audiodescrição editorial brasileira, com domínio técnico das normas ABNT NBR 16452:2016, Lei nº 13.146/2015 (LBI), Lei nº 10.436/2002, manual do Instituto Benjamin Constant (IBC) e Guia para Produções Audiovisuais Acessíveis do Ministério da Cultura.

Sua função é AUDITAR audiodescrições já produzidas e identificar violações às normas. Você NUNCA produz audiodescrições novas — apenas audita as existentes.

Receba uma audiodescrição e retorne APENAS um JSON válido com a seguinte estrutura, sem nenhum texto adicional:

{
  "aprovado": boolean,
  "score": número de 0 a 100,
  "violacoes": [
    {
      "regra": "nome da regra violada",
      "trecho": "trecho problemático",
      "explicacao": "por que viola a regra"
    }
  ],
  "texto_corrigido": "texto reescrito corrigindo as violações OU null se aprovado"
}

CRITÉRIOS DE AUDITORIA:

1. TEMPO VERBAL: Toda descrição deve estar no presente do indicativo. Verbos no gerúndio ("está correndo"), pretérito ou futuro são VIOLAÇÃO.

2. OBJETIVIDADE: A descrição não pode conter julgamentos, interpretações, intenções dos personagens ou opiniões. Adjetivos avaliativos ("belo", "triste", "bonito") sem base visual concreta são VIOLAÇÃO.

3. RAÇA E ETNIA (manual IBC): Personagens negros DEVEM ser descritos como "homem negro", "mulher negra", "menino negro" — NUNCA como "homem de pele escura", "moreno", "pardo" sem contexto. Personagens indígenas DEVEM ser descritos como "indígena", "homem indígena", com referência à etnia se visível. Brancos DEVEM ser descritos como "homem branco", "mulher branca". Omitir a raça quando ela é visualmente identificável é VIOLAÇÃO.

4. PROPORCIONALIDADE: A profundidade da descrição deve ser proporcional à função da imagem. Capas: máximo 120 palavras, sem detalhar objetos secundários. Páginas pedagógicas: 150-250 palavras com detalhe completo. Excesso ou falta de detalhamento é VIOLAÇÃO.

5. ESTRUTURA: Descrição deve seguir do geral para o específico. Começar pelo detalhe é VIOLAÇÃO.

6. POSICIONAMENTO: Usar termos como "à esquerda", "à direita", "ao centro", "em primeiro plano". Posicionamento ausente em cenas com múltiplos personagens é VIOLAÇÃO leve.

7. REPRODUÇÃO DE TEXTO: A audiodescrição NÃO deve reproduzir texto escrito presente na imagem (isso é função do audiobook). Reproduzir balões de fala, títulos ou parágrafos de texto na audiodescrição é VIOLAÇÃO.

CÁLCULO DO SCORE:
- Sem violações: 100
- Cada violação leve (estrutura, posicionamento): -5
- Cada violação média (proporcionalidade, objetividade): -10
- Cada violação grave (raça/etnia, tempo verbal, reprodução de texto): -20
- Score < 70 → aprovado: false
- Score >= 70 sem violações graves → aprovado: true

SE REPROVADO: gerar \`texto_corrigido\` que mantém TODA a informação visual relevante do original, mas reescreve corrigindo todas as violações identificadas. NÃO reduzir conteúdo — apenas corrigir a forma.

SE APROVADO: \`texto_corrigido\` deve ser null.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startedAt = Date.now();

  try {
    const { text, book_type, page_id } = await req.json();

    if (!text || typeof text !== "string") {
      return respond({ success: false, error: "missing_fields", message: "Campo obrigatório: text" }, 400);
    }

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) {
      console.error("[VALIDATION] OPENAI_API_KEY não configurada");
      return respond({
        success: false,
        error: "openai_key_missing",
        message: "OPENAI_API_KEY não configurada. Validação dupla indisponível.",
      }, 500);
    }

    console.log(`[VALIDATION] page_id=${page_id} received text_length=${text.length} book_type=${book_type || "general"}`);

    const userPrompt = `Tipo de livro: ${book_type || "general"}\n\nAudiodescrição a auditar:\n"""\n${text}\n"""`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);

    let openaiResp: Response;
    try {
      openaiResp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openaiKey}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: "gpt-4o",
          temperature: 0.2,
          max_tokens: 2000,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ],
        }),
      });
    } catch (e) {
      clearTimeout(timeoutId);
      if (e instanceof DOMException && e.name === "AbortError") {
        console.error(`[VALIDATION] page_id=${page_id} result=fallback elapsed_ms=${Date.now() - startedAt} reason=timeout`);
        return respond({ success: false, error: "openai_timeout", message: "Validação OpenAI excedeu o tempo limite." }, 504);
      }
      console.error(`[VALIDATION] page_id=${page_id} fetch error`, e);
      return respond({ success: false, error: "openai_network", message: e instanceof Error ? e.message : "Network error" }, 502);
    }
    clearTimeout(timeoutId);

    if (!openaiResp.ok) {
      const errText = await openaiResp.text();
      console.error(`[VALIDATION] page_id=${page_id} openai_error status=${openaiResp.status} body=${errText.slice(0, 300)}`);
      if (openaiResp.status === 429) {
        return respond({ success: false, error: "openai_rate_limit", message: "Limite de requisições OpenAI atingido." }, 429);
      }
      if (openaiResp.status === 401 || openaiResp.status === 403) {
        return respond({ success: false, error: "openai_invalid_key", message: "Chave OpenAI inválida ou sem permissão." }, 401);
      }
      return respond({ success: false, error: "openai_api_error", message: `Erro OpenAI: ${openaiResp.status}` }, 500);
    }

    const openaiData = await openaiResp.json();
    const content = openaiData?.choices?.[0]?.message?.content;
    if (!content || typeof content !== "string") {
      console.error(`[VALIDATION] page_id=${page_id} empty_content`);
      return respond({ success: false, error: "openai_parse_error", message: "Resposta OpenAI vazia." }, 500);
    }

    let parsed: { aprovado: boolean; score: number; violacoes: Array<{ regra: string; trecho: string; explicacao: string }>; texto_corrigido: string | null };
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      console.error(`[VALIDATION] page_id=${page_id} json_parse_failed content=${content.slice(0, 300)}`);
      return respond({ success: false, error: "openai_parse_error", message: "JSON inválido na resposta OpenAI." }, 500);
    }

    const aprovado = !!parsed.aprovado;
    const score = typeof parsed.score === "number" ? Math.max(0, Math.min(100, Math.round(parsed.score))) : 0;
    const violacoes = Array.isArray(parsed.violacoes) ? parsed.violacoes : [];
    const texto_corrigido = aprovado ? null : (typeof parsed.texto_corrigido === "string" && parsed.texto_corrigido.trim() ? parsed.texto_corrigido.trim() : null);

    const result = aprovado ? "approved" : (texto_corrigido ? "corrected" : "fallback");
    console.log(`[VALIDATION] page_id=${page_id} gpt4o_response score=${score} aprovado=${aprovado} violations_count=${violacoes.length}`);
    console.log(`[VALIDATION] page_id=${page_id} result=${result} elapsed_ms=${Date.now() - startedAt}`);

    return respond({
      success: true,
      aprovado,
      score,
      violacoes,
      texto_corrigido,
    });
  } catch (e) {
    console.error(`[VALIDATION] unexpected error elapsed_ms=${Date.now() - startedAt}`, e);
    return respond({ success: false, error: "internal_error", message: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
