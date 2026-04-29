## Resumo

Adicionar uma camada opcional de **auditoria automática de audiodescrições** com OpenAI GPT-4o, exclusiva do plano Enterprise, controlada por toggle por projeto. Quando ativa, toda audiodescrição gerada pelo Gemini passa por uma segunda IA que verifica conformidade com ABNT NBR 16452:2016, Lei 13.146/2015 e manual IBC. Se aprovada, mantém o texto. Se reprovada, substitui por uma versão corrigida e mostra badge na UI.

## 1. Migration de banco

**Tabela `projects`:**
- `enable_dual_validation` boolean NOT NULL default false

**Tabela `pages`:**
- `audiodesc_validated` boolean NOT NULL default false
- `audiodesc_validation_score` integer null
- `audiodesc_validation_violations` jsonb null
- `audiodesc_text_original` text null

## 2. Secret OpenAI

Solicitar `OPENAI_API_KEY` via `add_secret` (chave do dashboard OpenAI, formato `sk-...`). Se ausente quando validação for solicitada, propagar erro estruturado `openai_key_missing` sem bloquear o fluxo principal.

## 3. Nova Edge Function `validate-audiodesc`

`supabase/functions/validate-audiodesc/index.ts` — função pública (verify_jwt = false, chamada server-to-server via Service Role) que:

- Recebe `{ text, book_type, page_id }`.
- Lê `OPENAI_API_KEY`. Se ausente: retorna 500 `{ error: "openai_key_missing" }`.
- Chama `https://api.openai.com/v1/chat/completions` com:
  - `model: "gpt-4o"`
  - `temperature: 0.2`
  - `max_tokens: 2000`
  - `response_format: { type: "json_object" }`
  - Prompt de sistema completo com critérios de auditoria (tempo verbal, objetividade, raça/etnia conforme IBC, proporcionalidade, estrutura, posicionamento, não reprodução de texto) e fórmula do score detalhada na especificação.
- Timeout de 45s via `AbortController`.
- Tratamento de erros:
  - 429 → `openai_rate_limit`
  - 401/403 → `openai_invalid_key`
  - AbortError → `openai_timeout`
  - JSON inválido → `openai_parse_error`
- Resposta: `{ success: true, aprovado, score, violacoes, texto_corrigido }` ou `{ success: false, error }`.
- Logs permanentes `[VALIDATION]` com `page_id`, `text_length`, `score`, `aprovado`, `violations_count`, `result`, `elapsed_ms` (sem expor a chave).

Adicionar bloco em `supabase/config.toml` para `verify_jwt = false`.

## 4. Integração em `extract-text/index.ts`

Após `cleanText` e antes do `update` em `pages`, **somente quando `mode === "audiodesc"` e `!noContent`**:

1. Buscar do banco (uma query): `projects.enable_dual_validation` + `profiles.plan` (via `projects.user_id`).
2. Se `plan === "enterprise" && enable_dual_validation === true`:
   - Chamar internamente `validate-audiodesc` via `fetch` para `${SUPABASE_URL}/functions/v1/validate-audiodesc` com header `Authorization: Bearer ${SERVICE_ROLE_KEY}`.
   - Resultado **aprovado**: salvar `audiodesc_text = cleanedText`, `audiodesc_text_original = cleanedText`, `audiodesc_validated = true`, `audiodesc_validation_score = score`, `audiodesc_validation_violations = []`.
   - Resultado **reprovado**: salvar `audiodesc_text = texto_corrigido`, `audiodesc_text_original = cleanedText`, `audiodesc_validated = true`, `audiodesc_validation_score = score`, `audiodesc_validation_violations = violacoes`.
   - **Falha** (timeout/parse/key inválida): salvar `audiodesc_text = cleanedText`, `audiodesc_validated = false`, logar erro mas retornar `success: true` ao cliente — nunca bloquear.
3. Caso contrário (plano não-Enterprise ou toggle off): comportamento atual inalterado (custo zero — sem chamada à OpenAI).

Resposta da função inclui novos campos opcionais: `validated`, `score`, `violations`, `was_corrected` para a UI atualizar imediatamente.

## 5. Frontend

### 5.1 Toggle no `GlobalConfigPanel.tsx`

Nova seção "Validação Dupla por IA" (apenas visível no `mode === "audiodesc"`):
- `<Switch>` conectado a `project.enable_dual_validation` via `updateProject`.
- Label, descrição e badge "Exclusivo Enterprise".
- Texto de custo aproximado "≈ R$0,03 por página validada".
- Para usuários não-Enterprise: switch `disabled` + `<Tooltip>` "Disponível no plano Enterprise".

A propriedade `userPlan` deve ser propagada de `useProjectEditor`/`AuthContext` (já lê profile) até `GlobalConfigPanel` via prop nova.

### 5.2 Hook `useTextExtractor.ts`

Atualizar para repassar os novos campos `validated`, `score`, `violations`, `was_corrected`, `text_original` ao `onPageUpdate`, escrevendo nos novos campos da tabela `pages`.

### 5.3 Badge no `UnifiedPageCard.tsx`

Quando `audiodesc_validated === true`, exibir, ao lado do texto da audiodescrição:
- Sem `audiodesc_text_original` ou `original === text`: badge **verde** ✓ "Validado por IA — Score N/100".
- Com `audiodesc_text_original` diferente: badge **azul** ✓ "Validado e ajustado por IA — Score N/100".
- Tooltip explicativo conforme spec.

Ao clicar no badge: novo `<Dialog>` `ValidationReportDialog` mostrando:
- Lista de violações (`regra`, `trecho`, `explicacao`).
- Tabs/lado a lado "Texto original" vs "Texto ajustado".

## 6. Não alterar

Prompts Gemini, fluxo audiobook, módulo Videobook, geração de áudio (Gemini TTS / ElevenLabs), landing page, autenticação, rotação de chaves Gemini, lógica de chunks.

## Detalhes técnicos

**Chamada interna server-to-server** (extract-text → validate-audiodesc):

```ts
const valResp = await fetch(`${supabaseUrl}/functions/v1/validate-audiodesc`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${serviceRoleKey}`,
  },
  body: JSON.stringify({ text: cleanedText, book_type, page_id }),
});
```

Envolvido em `try/catch` com timeout próprio de 50s. Qualquer falha cai no caminho "salvar texto original sem validação".

**Detecção do plano**: query única em `extract-text` antes da validação:
```sql
select p.enable_dual_validation, pr.plan
from projects p join profiles pr on pr.id = p.user_id
where p.id = (select project_id from pages where id = $page_id)
```

## Validação pós-implementação

1. Build limpo (`tsc --noEmit` automático).
2. Migration aplicada e tipos regenerados.
3. Deploy de `extract-text` e `validate-audiodesc`.
4. Teste 1 — Enterprise + toggle ON: gerar audiodesc; ver logs `[VALIDATION]` + badge na UI.
5. Teste 2 — Enterprise + toggle OFF: gerar audiodesc; logs sem `[VALIDATION]` (custo zero).
6. Teste 3 — Free/Pro/Creator: toggle desabilitado; nunca chama validação.
7. Teste 4 — `OPENAI_API_KEY` ausente/ inválida: sistema devolve texto original com `audiodesc_validated = false`, sem erro ao usuário.

## Pergunta antes de implementar

A `OPENAI_API_KEY` ainda não existe nos Secrets. Posso solicitá-la via `add_secret` antes de começar a implementação, ou você prefere que eu crie toda a estrutura primeiro (migration, edge function, UI) e a chave seja adicionada por último?
