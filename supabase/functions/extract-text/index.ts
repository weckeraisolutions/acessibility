import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { callGeminiWithFailover, validateGeminiKeysConfigured, isBothKeysFailed } from "../_shared/gemini-keys.ts";
import { normalizeText } from "../_shared/text-utils.ts";
import { getAuthedUser, userOwnsPage, isAllowedFetchUrl } from "../_shared/auth.ts";

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

// cleanText is now provided by the shared normalizeText utility.
// Kept as a local alias for readability at call sites.
const cleanText = normalizeText;

/**
 * Removes AI classification labels and markdown artifacts that must never
 * appear in the final narration text. Runs after cleanText on every response,
 * for both audiobook and audiodesc modes.
 *
 * Strips:
 * - Leading classification labels output by the model (RELEVANTE, DECORATIVA, etc.)
 * - Common AI response prefixes (RESPOSTA:, AUDIODESCRIÇÃO:, NARRAÇÃO:, TEXTO:)
 * - Fenced code blocks (```text … ```)
 * - Resulting blank lines at start/end
 */
function sanitizeNarrationText(text: string): string {
  // Labels that Gemini may emit as a standalone first line
  const LABEL_PATTERN = /^(RELEVANTE|DECORATIVA|RESPOSTA|AUDIODESCRIÇÃO|AUDIODESCRIÇÃO|NARRAÇÃO|TEXTO|RESULTADO|DESCRIÇÃO|CLASSIFICAÇÃO)\s*:?\s*\n+/i;

  let t = text;

  // Remove fenced code blocks (```lang … ```)
  t = t.replace(/^```[^\n]*\n([\s\S]*?)```\s*$/gm, "$1");

  // Remove any standalone label line at the very start (loop handles edge
  // cases where the model emits the label twice or with trailing colon)
  for (let i = 0; i < 5; i++) {
    const before = t;
    t = t.replace(LABEL_PATTERN, "");
    if (t === before) break;
  }

  // Also strip if the label appears on the first line without a newline
  // after it (e.g. model returned "RELEVANTE " then the description inline)
  t = t.replace(/^(RELEVANTE|DECORATIVA)\s+/i, "");

  return t.trim();
}

/**
 * Heurística simples para detectar falas de personagens no texto extraído.
 * Retorna blocos sugeridos { label, text } na ordem em que aparecem.
 * Não altera o texto original; apenas sugere uma separação.
 */
function detectCharacterBlocks(text: string): { hasCharacters: boolean; blocks: Array<{ label: string; text: string }> } {
  if (!text || text.length < 20) return { hasCharacters: false, blocks: [] };

  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  // Padrão "Nome diz:" / "Nome:"  (Nome com 1ª maiúscula, até 30 chars)
  const sayRegex = /^([A-ZÁÉÍÓÚÂÊÔÃÕÇ][\wÀ-ÿ\- ]{1,28})\s+diz\s*:\s*(.+)$/;
  const colonRegex = /^([A-ZÁÉÍÓÚÂÊÔÃÕÇ][\wÀ-ÿ\- ]{1,28})\s*:\s*(.+)$/;
  // Linha começando por travessão (— ou --) indica fala
  const dashRegex = /^[—–-]{1,2}\s*(.+)$/;
  // Aspas envolvendo trecho com pelo menos 3 palavras
  const quoteRegex = /["“][^"”]{8,}["”]/;

  type Block = { label: string; text: string };
  const blocks: Block[] = [];
  let narratorBuf: string[] = [];
  let charCounter = 0;
  let dashCounter = 0;

  const flushNarrator = () => {
    if (narratorBuf.length) {
      blocks.push({ label: "Narrador", text: narratorBuf.join(" ").trim() });
      narratorBuf = [];
    }
  };

  for (const line of lines) {
    let m = line.match(sayRegex) || line.match(colonRegex);
    if (m) {
      flushNarrator();
      charCounter++;
      blocks.push({ label: m[1].trim(), text: m[2].trim() });
      continue;
    }
    m = line.match(dashRegex);
    if (m) {
      flushNarrator();
      dashCounter++;
      blocks.push({ label: `Personagem ${dashCounter}`, text: m[1].trim() });
      continue;
    }
    narratorBuf.push(line);
  }
  flushNarrator();

  const namedChars = blocks.filter((b) => b.label !== "Narrador").length;
  const hasQuotes = quoteRegex.test(text);
  // Só consideramos "tem personagens" se houver pelo menos 2 falas detectadas
  // ou padrão "Nome:" claro, evitando falsos positivos com hífens em listas.
  const hasCharacters = namedChars >= 2 || (charCounter >= 1 && hasQuotes);

  return { hasCharacters, blocks: hasCharacters ? blocks : [] };
}

function getPrompt(
  mode: string,
  bookType: string,
  globalStyle: string,
  pageStyle: string,
  narrationText: string = ""
): string {
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
Gabaritos e indicação visual de alternativa correta (ex: letra circulada, marca de "certo", "gabarito: A")
Texto instrucional como "Resposta pessoal", "Espera-se que o estudante" ou equivalentes
Elementos decorativos sem informação semântica
Número de página isolado sem contexto

REGRA 4 — FORMATO DE SAÍDA OBRIGATÓRIO:
Texto corrido e contínuo
Separar parágrafos distintos e blocos de conteúdo diferentes (ex: texto principal, box lateral, legenda) com UMA linha em branco entre eles (linha vazia)
Usar apenas uma quebra de linha simples (sem linha em branco) para: versos de poemas, falas de personagens em sequência, itens de lista, alternativas de questão
Sem colchetes, sem marcadores como [Título] ou [Box], sem rótulos de tipo
Balões sempre no formato: Nome diz: texto da fala
Fórmulas matemáticas ou científicas: substituir por: Fórmula — consultar versão acessível
Se absolutamente nenhum texto narrável existir nesta página: retornar apenas a palavra PÁGINA_SEM_NARRAÇÃO

REGRA 5 — FORMATAÇÃO DE NUMERAÇÃO:
Quando o texto extraído contiver itens numerados que representam tópicos, seções ou conteúdos informativos (ex: "6 VIDA COLETIVA E APRENDIZAGEM", "7 BRINCADEIRAS E PRÁTICAS CORPORAIS"), formatar SEMPRE como: número + ponto + espaço + texto. Exemplo: "6. VIDA COLETIVA E APRENDIZAGEM". Nunca apenas o número sem ponto.

REGRA 6 — FORMATAÇÃO DE QUESTÕES E ATIVIDADES:
Quando o texto extraído contiver itens numerados que representam questões, perguntas ou atividades (identificáveis por verbos como "escreva", "responda", "explique", "calcule", "complete", "observe", ou pela presença de campos de resposta), formatar SEMPRE como: a palavra "Questão" + espaço + número + dois-pontos + espaço + texto da questão. Exemplo: "Questão 7: O que você acredita que aconteceria...".
Itens com letras (A, B, C) dentro de uma questão devem ser formatados como: letra + parêntese + espaço + texto. Exemplo: "A) Escreva o número 295...". Manter este padrão sem prefixo adicional.${styleNote}`;
  }

  const narrationBlock = narrationText && narrationText.trim() && narrationText.trim() !== "PÁGINA_SEM_NARRAÇÃO"
    ? `\n\nTEXTO JÁ NARRADO NESTA PÁGINA (NÃO REPETIR NA AUDIODESCRIÇÃO):\n"""\n${narrationText.trim()}\n"""\n\nREGRA DE NÃO-REDUNDÂNCIA (OBRIGATÓRIA): A audiodescrição é COMPLEMENTAR à narração. Não repetir informações textuais já narradas — se o texto menciona um título, uma instrução, uma pergunta, um dado de gráfico ou um nome, não reproduzir essas informações na audiodescrição.\n\nEXCEÇÃO OBRIGATÓRIA — PESSOAS: A descrição física de pessoas presentes na imagem (posição na página, aparência, traço físico, gesto, expressão, vestimenta) é SEMPRE informação visual nova que o audiobook textual não fornece. O texto narra O QUE dizem ou fazem os personagens, mas nunca COMO eles aparecem visualmente. Se houver pessoa real ou personagem com valor visual específico na imagem: descrever sua aparência é OBRIGATÓRIO, independentemente do que o texto já narrou. NUNCA retornar PÁGINA_SEM_AUDIODESCRIÇÃO pelo motivo de uma pessoa na imagem.\n\nRETORNAR PÁGINA_SEM_AUDIODESCRIÇÃO somente se: (1) não há pessoas na imagem E (2) todos os dados visuais relevantes já estão completamente cobertos pelo texto narrado.`
    : "";

  return `ETAPA 1 — CLASSIFICAÇÃO DA IMAGEM:

Antes de gerar qualquer descrição, analise criteriosamente esta imagem e classifique-a em uma das duas categorias:

RELEVANTE — Descrever normalmente conforme as regras de redação abaixo:
• Fotografias ou ilustrações de pessoas reais com gesto, postura ou expressão observável (estudante, professor, personagem com ação identificável)
• Ilustrações que explicam um conceito pedagógico
• Mapas, gráficos, tabelas e infográficos com dados visuais
• Imagens que alteram ou complementam o sentido do texto de forma que o texto sozinho não transmite
• Personagens em cenas com valor narrativo ou didático específico para esta página

DECORATIVA — Retornar apenas PÁGINA_SEM_AUDIODESCRIÇÃO, sem gerar descrição:
• Bordas, fundos, texturas e padrões geométricos decorativos
• Ícones funcionais junto a texto já narrado (ex: ícone de lápis ao lado de "Atividade", lâmpada ao lado de "Dica")
• Marcadores de lista, bullets e elementos de layout editorial
• Foto genérica de pessoa usada como decoração sem posição/gesto/expressão com valor informativo
• Elementos repetidos em todas as páginas (cabeçalho, rodapé, marcadores de seção)
• Ilustrações puramente estéticas sem informação adicional ao texto

ATENÇÃO: Quando a página tiver UMA pessoa real com postura/gesto observável + vários elementos decorativos → classificar como RELEVANTE e descrever APENAS a pessoa (ignorar os decorativos).

Critério de decisão: "Esta imagem contém informação visual que o leitor com deficiência visual PRECISA para compreender o conteúdo desta página?"
• Se SIM → classificar como RELEVANTE e prosseguir com ETAPA 2
• Se NÃO → classificar como DECORATIVA e retornar: PÁGINA_SEM_AUDIODESCRIÇÃO

ETAPA 2 — REDAÇÃO DA AUDIODESCRIÇÃO (apenas para imagens RELEVANTES):

Você é especialista em audiodescrição editorial brasileira (Manual GPEAD/IBC, ABNT NBR 16452:2016, Lei 13.146/2015 – LBI, Decreto 5.296/2004). Sua tarefa é produzir uma audiodescrição CLARA, FLUENTE e CINEMATOGRÁFICA — capaz de fazer o ouvinte VISUALIZAR a cena com precisão, sem excessos e sem ressecar a descrição.

HIERARQUIA DE PRIORIDADE OBRIGATÓRIA — descrever nesta ordem, parando quando o limite de palavras for atingido:
1. PESSOAS (fotografias reais ou personagens ilustrados com ação) — SEMPRE primeiro, com prioridade absoluta
2. DADOS VISUAIS (mapas, gráficos, tabelas, infográficos com conteúdo pedagógico)
3. OBJETOS PEDAGÓGICOS indispensáveis à compreensão da atividade
4. Todo o restante → IGNORAR completamente

ELEMENTOS PROIBIDOS NA DESCRIÇÃO (nunca incluir, mesmo em páginas RELEVANTES):
• Marcadores de lista, bullets, bolinhas, setas de item — IGNORAR sempre
• Linhas decorativas (onduladas, pontilhadas, separadoras) — IGNORAR sempre
• Padrões geométricos, texturas, fundos e elementos de design editorial — IGNORAR sempre
• Ícones funcionais junto a texto (lâmpada = "dica", lápis = "atividade") — IGNORAR sempre
• Caixas de diálogo e balões cujo conteúdo textual já é narrado pelo audiobook — IGNORAR sempre
• Elementos de layout (rodapé, cabeçalho, logo, número de página) — IGNORAR sempre
• Bordas, sombras, gradientes e efeitos visuais decorativos — IGNORAR sempre
• Qualquer elemento gráfico que seja parte do DESIGN da página, não do CONTEÚDO

ESTILO DE REDAÇÃO OBRIGATÓRIO — siga este padrão de referência:

❌ EVITAR (telegráfico, seco, sem orientação espacial):
"Em um corredor escolar, com armários, a Professora Jaciara tem cabelos trançados e veste jaleco. Ao lado, o Professor Benedito usa suéter."

✅ MODELO CORRETO (ambientação + posicionamento + traço físico essencial + ação/expressão pedagógica):
"Em um ambiente escolar, duas pessoas estão lado a lado em frente a armários. À esquerda, a professora Jaciara, com cabelos longos trançados, veste jaleco e sorri. À direita, o professor Benedito, de estatura alta, usa suéter e também sorri."

REGRA 1 — ESTRUTURA NARRATIVA (do geral para o particular):
1) Frase de ambientação: localiza o cenário e indica QUANTOS elementos/pessoas há e em que disposição (lado a lado, ao centro, ao redor de uma mesa, etc.).
2) Apresentação de cada elemento/personagem com ORIENTAÇÃO ESPACIAL explícita ("à esquerda", "à direita", "ao centro", "no primeiro plano", "ao fundo").
3) Para cada personagem: nome (se conhecido pelo contexto/narração) + UM traço físico relevante + vestimenta funcional + ação ou expressão observável.

REGRA 2 — SEPARAÇÃO: Descrever APENAS elementos visuais. NUNCA reproduzir texto escrito presente na imagem (função da narração).

REGRA 3 — OBJETIVIDADE: Presente do indicativo. Sem opiniões, juízos de valor ou inferências subjetivas — não usar "parece", "talvez", "feliz", "triste", "bonito". Descrever apenas o que é OBSERVÁVEL ("sorri", "aponta para", "segura um livro").

REGRA 4 — ORIENTAÇÃO ESPACIAL OBRIGATÓRIA: Sempre que houver dois ou mais elementos/personagens, indicar a posição relativa de cada um ("à esquerda", "à direita", "ao centro", "atrás", "à frente"). Esta orientação é INDISPENSÁVEL — não omitir.

REGRA 5 — DETALHE FÍSICO ESSENCIAL: Incluir um traço físico distintivo por personagem (ex: "cabelos longos trançados", "estatura alta", "óculos redondos") — o suficiente para o ouvinte diferenciar e visualizar, sem virar catálogo. Vestimenta apenas se ajudar a identificar o personagem ou tiver valor pedagógico.

REGRA 6 — LIMITES MÁXIMOS DE PALAVRAS (orientativos, priorizar clareza sobre concisão extrema):
• CAPAS: título, editora e ilustração principal — MÁXIMO 50 palavras.
• CRÉDITOS, FICHA TÉCNICA, SUMÁRIO: retornar PÁGINA_SEM_AUDIODESCRIÇÃO.
• ILUSTRAÇÕES COM PERSONAGENS: ambientação + cada personagem posicionado e descrito — MÁXIMO 80 palavras.
• MAPAS E GRÁFICOS: tipo, título, estrutura visual e dados principais — MÁXIMO 80 palavras.
• TABELAS: estrutura e dados-chave — MÁXIMO 70 palavras.
• ÍCONES: função apenas — MÁXIMO 12 palavras.

REGRA 7 — OMITIR RIGOROSAMENTE: Todos os elementos listados em "ELEMENTOS PROIBIDOS" acima. Adicionalmente: cores sem função pedagógica, elementos repetitivos entre páginas, e ícones compreendidos pelo contexto textual. Nomear cores APENAS quando forem informação indispensável (mapas temáticos, gráficos de barras coloridos com legenda, sinalização visual).

REGRA 8 — PERSONAGENS RECORRENTES: Para personagens já descritos em página anterior, apenas nomear e descrever a NOVA ação/postura/posição — não repetir a descrição física completa.

REGRA 9 — FORMATO: Texto corrido, fluente, sem quebras extras, sem colchetes, sem rótulos. Se não houver elementos visuais relevantes além de decorativos: retornar apenas PÁGINA_SEM_AUDIODESCRIÇÃO.${narrationBlock}

TIPO DE LIVRO: ${bookType}${styleNote}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { page_id, image_url, mode, book_type, global_style, page_style, narration_text } = await req.json();

    if (!page_id || !image_url || !mode) {
      return respond({ success: false, error: "missing_fields", message: "Campos obrigatórios: page_id, image_url, mode" }, 400);
    }

    // Authenticate caller and verify ownership of the page
    const user = await getAuthedUser(req);
    if (!user) return respond({ success: false, error: "unauthorized", message: "Autenticação obrigatória." }, 401);
    const ownedProjectId = await userOwnsPage(user.id, page_id);
    if (!ownedProjectId) return respond({ success: false, error: "forbidden", message: "Acesso negado a este recurso." }, 403);

    // SSRF guard: only allow images from this project's Supabase storage host
    if (!isAllowedFetchUrl(image_url)) {
      return respond({ success: false, error: "invalid_image_url", message: "URL de imagem não permitida." }, 400);
    }

    const keysCheck = validateGeminiKeysConfigured();
    if (!keysCheck.ok) {
      return respond({ success: false, error: "api_key_missing", message: keysCheck.message || "Nenhuma chave Gemini configurada" }, 500);
    }

    // Download image and convert to base64 (chunked to avoid CPU limits)
    const imgResponse = await fetch(image_url);
    if (!imgResponse.ok) {
      return respond({ success: false, error: "image_download_failed", message: "Não foi possível baixar a imagem da página" }, 400);
    }
    const imgBuffer = await imgResponse.arrayBuffer();
    const imgBytes = new Uint8Array(imgBuffer);

    // Chunked base64 encoding to avoid CPU timeout on large images
    const CHUNK = 32768;
    let imgBase64 = "";
    for (let i = 0; i < imgBytes.length; i += CHUNK) {
      imgBase64 += String.fromCharCode(...imgBytes.subarray(i, i + CHUNK));
    }
    imgBase64 = btoa(imgBase64);

    const prompt = getPrompt(
      mode,
      book_type || "general",
      global_style || "",
      page_style || "",
      mode === "audiodesc" ? (narration_text || "") : ""
    );

    // Call Gemini Vision API with 55s timeout per attempt + key rotation/failover
    let geminiResponse: Response;
    try {
      geminiResponse = await callGeminiWithFailover(async (apiKey, _idx) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 55000);
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
        try {
          return await fetch(geminiUrl, {
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
        } finally {
          clearTimeout(timeoutId);
        }
      });
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        return respond({ success: false, error: "timeout", message: "A extração demorou demais. Tente novamente — páginas complexas podem precisar de mais de uma tentativa." }, 504);
      }
      if (isBothKeysFailed(e)) {
        if (e.last_status === 429) {
          return respond({ success: false, error: "rate_limit", message: "Limite de requisições do Gemini atingido em ambas as chaves. Aguarde alguns segundos." }, 429);
        }
        return respond({ success: false, error: "api_error", message: `Erro Gemini em ambas as chaves: ${e.last_status}` }, 500);
      }
      throw e;
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
    const cleanedText = sanitizeNarrationText(cleanText(rawText));

    const noContent = cleanedText === "PÁGINA_SEM_NARRAÇÃO" || cleanedText === "PÁGINA_SEM_AUDIODESCRIÇÃO";

    // Update pages table
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const textField = mode === "audiobook" ? "audiobook_text" : "audiodesc_text";
    const statusField = mode === "audiobook" ? "audiobook_status" : "audiodesc_status";

    // Default update payload (no validation)
    const updatePayload: Record<string, unknown> = {
      [textField]: cleanedText,
      [statusField]: noContent ? "no_content" : "extracted",
      updated_at: new Date().toISOString(),
    };

    // Optional dual validation (Enterprise + audiodesc + content present)
    let validated = false;
    let validationScore: number | null = null;
    let validationViolations: unknown[] = [];
    let wasCorrected = false;
    let textOriginalForResponse: string | null = null;
    let finalText = cleanedText;

    if (mode === "audiodesc" && !noContent) {
      try {
        const { data: pageRow } = await supabase
          .from("pages")
          .select("project_id")
          .eq("id", page_id)
          .maybeSingle();
        const projectId = pageRow?.project_id;
        if (projectId) {
          const { data: projRow } = await supabase
            .from("projects")
            .select("enable_dual_validation, user_id")
            .eq("id", projectId)
            .maybeSingle();
          const enableDualValidation = !!projRow?.enable_dual_validation;
          let plan = "free";
          if (projRow?.user_id) {
            const { data: profileRow } = await supabase
              .from("profiles")
              .select("plan")
              .eq("id", projRow.user_id)
              .maybeSingle();
            plan = (profileRow?.plan || "free").toLowerCase();
          }
          if (enableDualValidation && plan === "enterprise") {
            console.log(`[VALIDATION] page_id=${page_id} dispatching to validate-audiodesc`);
            try {
              const valController = new AbortController();
              const valTimeout = setTimeout(() => valController.abort(), 50000);
              const valResp = await fetch(`${supabaseUrl}/functions/v1/validate-audiodesc`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${serviceRoleKey}`,
                },
                signal: valController.signal,
                body: JSON.stringify({ text: cleanedText, book_type: book_type || "general", page_id }),
              });
              clearTimeout(valTimeout);
              const valJson = await valResp.json().catch(() => null) as
                | { success: boolean; aprovado?: boolean; score?: number; violacoes?: unknown[]; texto_corrigido?: string | null; error?: string }
                | null;
              if (valResp.ok && valJson?.success) {
                validated = true;
                validationScore = typeof valJson.score === "number" ? valJson.score : null;
                validationViolations = Array.isArray(valJson.violacoes) ? valJson.violacoes : [];
                if (valJson.aprovado) {
                  // approved as-is
                  textOriginalForResponse = cleanedText;
                  updatePayload.audiodesc_text_original = cleanedText;
                } else if (typeof valJson.texto_corrigido === "string" && valJson.texto_corrigido.trim()) {
                  finalText = valJson.texto_corrigido.trim();
                  wasCorrected = true;
                  textOriginalForResponse = cleanedText;
                  updatePayload.audiodesc_text_original = cleanedText;
                  updatePayload[textField] = finalText;
                } else {
                  // reproved without correction → keep original
                  textOriginalForResponse = cleanedText;
                  updatePayload.audiodesc_text_original = cleanedText;
                }
                updatePayload.audiodesc_validated = true;
                updatePayload.audiodesc_validation_score = validationScore;
                updatePayload.audiodesc_validation_violations = validationViolations;
              } else {
                console.error(`[VALIDATION] page_id=${page_id} validation failed status=${valResp.status} error=${valJson?.error || "unknown"} — falling back to original text`);
                updatePayload.audiodesc_validated = false;
              }
            } catch (e) {
              console.error(`[VALIDATION] page_id=${page_id} validation request errored — fallback`, e);
              updatePayload.audiodesc_validated = false;
            }
          }
        }
      } catch (e) {
        console.error(`[VALIDATION] page_id=${page_id} pre-check failed — skipping validation`, e);
      }
    }

    const { error: updateError } = await supabase
      .from("pages")
      .update(updatePayload)
      .eq("id", page_id);

    if (updateError) {
      console.error("DB update error:", updateError);
    }

    // Detecção de personagens (apenas audiobook, e quando há texto válido)
    let has_characters = false;
    let suggested_blocks: Array<{ label: string; text: string }> = [];
    if (mode === "audiobook" && !noContent) {
      const det = detectCharacterBlocks(cleanedText);
      has_characters = det.hasCharacters;
      suggested_blocks = det.blocks;
    }

    return respond({
      success: true,
      text: finalText,
      no_content: noContent,
      page_id,
      has_characters,
      suggested_blocks,
      validated,
      score: validationScore,
      violations: validationViolations,
      was_corrected: wasCorrected,
      text_original: textOriginalForResponse,
    });
  } catch (e) {
    console.error("extract-text error:", e);
    return respond({ success: false, error: "api_error", message: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
