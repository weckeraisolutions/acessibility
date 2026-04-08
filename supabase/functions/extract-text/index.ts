import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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
    .replace(/\b10\.639\/2003\b/g, "Lei dez mil seiscentos e trinta e nove de dois mil e três")
    .replace(/\b11\.645\/2008\b/g, "Lei onze mil seiscentos e quarenta e cinco de dois mil e oito")
    .trim();
}

function getPrompt(mode: string, bookType: string, globalStyle: string, pageStyle: string): string {
  const styleNote = pageStyle || globalStyle ? `\n\nESTILO ADICIONAL: ${pageStyle || globalStyle}` : "";

  if (mode === "audiobook") {
    return `Você é um especialista em acessibilidade editorial brasileira com domínio técnico e prático das seguintes normas e leis, cujo conteúdo você deve aplicar rigorosamente nesta tarefa:

LEI Nº 13.146/2015 — LEI BRASILEIRA DE INCLUSÃO (LBI): Esta lei institui a inclusão da pessoa com deficiência e garante o direito de acesso à informação e à comunicação em igualdade de condições com as demais pessoas. O artigo 67 determina que os serviços de radiodifusão de sons e imagens devem contar com recursos de acessibilidade. O artigo 68 estabelece que o poder público deve adotar mecanismos de incentivo à produção, edição, difusão e distribuição de livros em formatos acessíveis, entre os quais o audiobook. O artigo 63 determina que é obrigatória a acessibilidade nos sítios da internet mantidos por empresas com sede no Brasil. O princípio fundamental desta lei é a equiparação de oportunidades: a pessoa com deficiência deve ter acesso ao mesmo conteúdo disponível para as demais pessoas, sem supressão, simplificação ou adaptação que reduza o conteúdo original.

DECRETO Nº 5.296/2004: Regulamenta as Leis 10.048/2000 e 10.098/2000 e estabelece normas gerais e critérios básicos para a promoção da acessibilidade. O artigo 47 determina que as empresas prestadoras de serviços de telecomunicações deverão garantir o pleno acesso às pessoas portadoras de deficiência auditiva e de fala. O decreto define acessibilidade como a condição para utilização, com segurança e autonomia, total ou assistida, dos espaços, mobiliários, equipamentos urbanos, edificações, transportes, informação e comunicação — inclusive seus sistemas e tecnologias — bem como de outros serviços e instalações abertos ao público. Para fins de audiobook, este decreto fundamenta a obrigatoriedade de que todo conteúdo textual publicado esteja disponível em formato auditivo acessível.

ABNT NBR 16452:2016 — ACESSIBILIDADE NA COMUNICAÇÃO — AUDIODESCRIÇÃO: Esta norma fornece diretrizes para a produção da audiodescrição. Embora voltada à audiodescrição, seus princípios de acessibilidade comunicacional se aplicam igualmente ao audiobook: todo conteúdo deve ser transmitido de forma completa, coerente e acessível, sem supressão de informações presentes no original. A norma estabelece que as diretrizes foram elaboradas com base nos preceitos do Desenho Universal, que visa favorecer a percepção, a compreensão e a fruição das informações para pessoas impossibilitadas de ver ou com dificuldade de compreender tais imagens. O princípio do Desenho Universal aplicado ao audiobook significa que o áudio deve conter 100% do conteúdo textual do livro impresso, sem omissões.

ABNT NBR 15599:2008 — ACESSIBILIDADE — COMUNICAÇÃO NA PRESTAÇÃO DE SERVIÇOS: Esta norma fornece diretrizes gerais para acessibilidade em comunicação na prestação de serviços. Estabelece que toda informação deve ser fornecida em formato acessível, considerando as diversas condições perceptivas, sensoriais e cognitivas dos usuários. Para o audiobook, esta norma fundamenta que a narração deve reproduzir fielmente o conteúdo original, sem simplificações que comprometam o acesso equitativo à informação.

Com base nessas normas, analise a imagem desta página de livro e extraia o texto para produção de audiobook, seguindo rigorosamente as seguintes regras:

TIPO DE LIVRO: ${bookType}

REGRA 1 — PARIDADE TOTAL COM O IMPRESSO: Narrar 100% do texto escrito presente na página. Nenhuma frase, palavra, título, legenda, nota ou informação textual pode ser omitida. A omissão de qualquer conteúdo textual viola o princípio de equiparação de oportunidades da Lei 13.146/2015.

REGRA 2 — O QUE EXTRAIR OBRIGATORIAMENTE:
Todo texto corrido principal, sem omitir nenhuma palavra ou frase
Títulos, subtítulos e seções em qualquer hierarquia tipográfica
Conteúdo completo de boxes, caixas de destaque, quadros e tabelas com texto
Glossários: escrever o termo e a definição na mesma linha, em sequência contínua
Balões de fala de personagens: formatar SEMPRE como "Nome diz: texto da fala"
Poemas, músicas e versos na íntegra, mantendo cada verso em linha separada
Instruções de atividades práticas completas, incluindo todos os passos
Notas de rodapé e notas explicativas
Créditos, fontes e referências textuais
Epígrafes, citações e epigramas
Texto presente em mapas, gráficos e legendas quando houver texto escrito

REGRA 3 — O QUE NÃO EXTRAIR:
Descrições de ilustrações, fotografias ou artes visuais — isso é audiodescrição, recurso separado e distinto do audiobook
Gabaritos, respostas marcadas, alternativas corretas indicadas visualmente
Texto "Resposta pessoal", "Espera-se que o estudante" ou equivalentes
Alternativas de questões de múltipla escolha e seus enunciados
Elementos decorativos sem informação semântica
Número de página isolado sem contexto

REGRA 4 — FORMATO DE SAÍDA OBRIGATÓRIO:
Texto corrido e contínuo
Sem linhas em branco entre parágrafos — usar apenas uma quebra de linha simples entre trechos
Sem colchetes, sem marcadores como [Título] ou [Box], sem rótulos de tipo
Balões sempre no formato: Nome diz: texto da fala
Fórmulas matemáticas ou científicas: substituir por: Fórmula — consultar versão acessível
Se absolutamente nenhum texto narrável existir nesta página: retornar apenas a palavra PÁGINA_SEM_NARRAÇÃO${styleNote}`;
  }

  return `Você é especialista em audiodescrição para publicações editoriais e materiais didáticos brasileiros, com domínio técnico das normas ABNT NBR 16452:2016, Lei nº 13.146/2015 e Guia para Produções Audiovisuais Acessíveis do Ministério da Cultura (MinC/SAv, 2016).

Analise esta imagem de página de livro e produza a audiodescrição dos elementos visuais seguindo rigorosamente todas as regras abaixo.

REGRA 1 — SEPARAÇÃO ABSOLUTA ENTRE AUDIODESCRIÇÃO E AUDIOBOOK: A audiodescrição descreve APENAS os elementos visuais — ilustrações, fotografias, gráficos, mapas, tabelas, ícones e elementos decorativos com valor informativo. O texto escrito da página NÃO é objeto da audiodescrição — ele pertence ao audiobook. Não reproduzir nenhum texto escrito presente na página.

REGRA 2 — COMO REDIGIR (conforme ABNT NBR 16452:2016): Objetivo e imparcial — descrever o que está visível, nunca interpretar, julgar ou atribuir intenções. Do geral para o específico — começar pela visão geral do elemento antes de detalhar suas partes. Tempo verbal no presente do indicativo — usar exclusivamente o presente. Evitar gerundismos — não usar formas como "está correndo", mas sim "corre". Evitar regionalismos, gírias, redundâncias e vícios de linguagem. O texto não pode expressar o ponto de vista de quem escreve a audiodescrição. Mencionar posições relevantes usando termos como à esquerda, à direita, ao centro, ao fundo, em primeiro plano. Mencionar cores quando relevantes para a compreensão do conteúdo pedagógico.

REGRA 3 — PROPORCIONALIDADE (princípio central da NBR 16452:2016): O nível de detalhe deve ser proporcional à FUNÇÃO que a imagem exerce dentro do material. Aplicar os seguintes critérios obrigatórios:

CAPAS E PÁGINAS DE IDENTIFICAÇÃO DA OBRA: A função da capa é identificar a obra. A audiodescrição deve conter: título completo, subtítulo se visível, nível e ano de ensino, nome da editora, descrição geral da ilustração principal em no máximo três frases, identificação dos personagens presentes sem detalhar cada objeto secundário que seguram ou que está ao redor deles, logotipos e selos identificados apenas pelo nome — sem descrever forma, cor e contorno detalhado de cada elemento gráfico. Elementos decorativos de borda ou fundo mencionados em no máximo uma frase apenas se carregarem significado cultural ou pedagógico relevante para a obra. COMPRIMENTO MÁXIMO PARA CAPA: 120 palavras.

PÁGINAS DE CRÉDITOS, FICHA TÉCNICA E SUMÁRIO: Não há elementos visuais a audiodescrever. Retornar PÁGINA_SEM_AUDIODESCRIÇÃO.

PÁGINAS COM ILUSTRAÇÕES DE CENAS PEDAGÓGICAS: A ilustração tem função narrativa ou didática — descrever com nível de detalhe completo: personagens com aparência, expressão, ação e posição; cenário; cores dominantes; objetos com valor pedagógico direto. COMPRIMENTO ADEQUADO: 150 a 250 palavras.

PÁGINAS COM MAPAS, GRÁFICOS, TABELAS E INFOGRÁFICOS: Esses elementos têm função informativa direta — aplicar descrição completa: tipo do elemento, título quando visível, dados principais, tendência ou conclusão visual. Cada dado omitido representa perda de acesso à informação pedagógica. COMPRIMENTO ADEQUADO: proporcional à complexidade do elemento.

PÁGINAS COM ÍCONES E ELEMENTOS FUNCIONAIS: Descrever apenas pelo que representam funcionalmente. Não descrever forma, tamanho, cor e contorno detalhado de ícones puramente decorativos.

CRITÉRIO DE CORTE OBRIGATÓRIO — aplicar antes de incluir qualquer detalhe: Pergunta de validação: "Uma pessoa com deficiência visual que ouvir este detalhe terá melhor compreensão do conteúdo ou da experiência desta página?" Se a resposta for NÃO — omitir o detalhe. Objetos secundários ao redor de personagens, conteúdo interno de telas de dispositivos, estilo tipográfico de logotipos, detalhes de lateralidade de membros e elementos puramente decorativos sem significado pedagógico devem ser omitidos por não passarem neste critério.

REGRA 4 — O QUE DESCREVER OBRIGATORIAMENTE QUANDO RELEVANTE: Ilustrações de personagens: aparência física visível, expressão facial, postura, ação que realiza, vestimenta e posição na cena. Fotografias: sujeito principal, contexto, enquadramento e cores relevantes. Mapas: título quando visível, regiões destacadas, cores usadas para diferenciar regiões, legenda presente. Gráficos e infográficos: tipo, título quando visível, eixos e unidades, valores principais, tendência geral. Tabelas: estrutura, cabeçalhos, dados relevantes. Elementos decorativos: apenas quando carregam significado cultural, histórico ou pedagógico direto.

REGRA 5 — FORMATO DE SAÍDA OBRIGATÓRIO: Texto corrido e contínuo, sem linhas em branco entre parágrafos, sem colchetes ou marcadores de tipo. Se não houver absolutamente nenhum elemento visual relevante a descrever: retornar apenas PÁGINA_SEM_AUDIODESCRIÇÃO.

TIPO DE LIVRO: ${bookType}${styleNote}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { page_id, image_url, mode, book_type, global_style, page_style } = await req.json();

    const gemini_api_key = Deno.env.get("GEMINI_API_KEY");

    if (!page_id || !image_url || !mode) {
      return respond({ success: false, error: "missing_fields", message: "Campos obrigatórios: page_id, image_url, mode" }, 400);
    }

    if (!gemini_api_key) {
      return respond({ success: false, error: "api_key_missing", message: "GEMINI_API_KEY não configurada no servidor" }, 500);
    }

    // Download image and convert to base64
    const imgResponse = await fetch(image_url);
    if (!imgResponse.ok) {
      return respond({ success: false, error: "image_download_failed", message: "Não foi possível baixar a imagem da página" }, 400);
    }
    const imgBuffer = await imgResponse.arrayBuffer();
    const imgBase64 = btoa(
      new Uint8Array(imgBuffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
    );

    const prompt = getPrompt(mode, book_type || "general", global_style || "", page_style || "");

    // Call Gemini Vision API with 55s timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 55000);

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${gemini_api_key}`;
    let geminiResponse: Response;
    try {
      geminiResponse = await fetch(geminiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{
            parts: [
              { inlineData: { mimeType: "image/png", data: imgBase64 } },
              { text: prompt },
            ],
          }],
        }),
      });
    } catch (e) {
      clearTimeout(timeoutId);
      if (e instanceof DOMException && e.name === "AbortError") {
        return respond({ success: false, error: "timeout", message: "A extração demorou demais. Tente novamente — páginas complexas podem precisar de mais de uma tentativa." }, 504);
      }
      throw e;
    } finally {
      clearTimeout(timeoutId);
    }

    if (!geminiResponse.ok) {
      const status = geminiResponse.status;
      const errText = await geminiResponse.text();
      console.error("Gemini error:", status, errText);

      if (status === 400 || status === 403) {
        return respond({ success: false, error: "invalid_api_key", message: "Chave da API Gemini inválida" }, 400);
      }
      if (status === 429) {
        return respond({ success: false, error: "rate_limit", message: "Limite de requisições do Gemini atingido. Aguarde alguns segundos." }, 429);
      }
      return respond({ success: false, error: "api_error", message: `Erro da API Gemini: ${status}` }, 500);
    }

    const geminiData = await geminiResponse.json();
    const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const cleanedText = cleanText(rawText);

    const noContent = cleanedText === "PÁGINA_SEM_NARRAÇÃO" || cleanedText === "PÁGINA_SEM_AUDIODESCRIÇÃO";

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

    return respond({ success: true, text: cleanedText, no_content: noContent, page_id });
  } catch (e) {
    console.error("extract-text error:", e);
    return respond({ success: false, error: "api_error", message: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
