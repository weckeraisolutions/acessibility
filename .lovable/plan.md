

# Accessibility — Acessibilidade Editorial com IA

## Visão Geral
Aplicação SaaS para acessibilidade editorial com IA. Três páginas iniciais: autenticação, dashboard e criação de projeto. Backend com Supabase (auth, banco, storage).

## Identidade Visual
- Paleta: azul profundo #1E3A5F, azul médio #2E86C1, branco, cinza claro #F4F6F8, verde #27AE60, laranja #E67E22
- Tipografia Inter, tema claro, estilo corporativo-moderno
- Logo com ícone de acessibilidade + ondas de áudio + texto "Accessibility"

## Páginas

### 1. /auth — Autenticação (página inicial)
- Layout centralizado com logo no topo
- Tabs "Entrar" / "Cadastrar"
- Login: email, senha, botão "Entrar", botão "Entrar com Google" (outline), link "Esqueci minha senha"
- Cadastro: nome, email, senha, confirmar senha, botão "Cadastrar"
- Redireciona para /dashboard após login

### 2. /dashboard — Painel principal (protegida)
- Header fixo: logo à esquerda, nome do usuário + badge do plano + botão "Sair" à direita
- Título "Meus Projetos" + botão "+ Novo Projeto"
- Filtros por tipo: Todos / Audiobook / Audiodescrição / Videobook
- Grid responsivo de cards (3/2/1 colunas) com nome, tipo (badge), data, total de páginas, barras de progresso (Audiobook/Audiodescrição/Videobook %), ações "Abrir" + dropdown (Renomear/Excluir)
- Estado vazio com ilustração e call-to-action

### 3. /projeto/novo — Criar projeto (protegida)
- Header com "← Voltar" + título "Novo Projeto"
- Formulário centralizado (max 600px): nome do projeto, título do livro, tipo do livro (select), dropzone para PDF (drag-and-drop, máx 100MB)
- Upload para bucket `pdfs` no caminho `{user_id}/{project_id}/original.pdf`
- Botão "Criar Projeto" com loading/progress state
- Redireciona para /projeto/:id após criação

### 4. /projeto/:id — Página placeholder
- Placeholder simples para receber o redirecionamento pós-criação

## Banco de Dados Supabase

### Tabelas
- **profiles**: id, name, email, plan, stripe fields, pages_used_month, timestamps
- **projects**: id, user_id, name, book_title, book_type, pdf_url, total_pages, processing_status, configurações globais de audiobook/audiodesc/videobook, timestamps
- **pages**: id, project_id, page_number, URLs de imagem/áudio/vídeo, textos, status por módulo, configurações de vídeo (JSONB), timestamps, UNIQUE(project_id, page_number)

### RLS
- profiles: usuário lê/edita apenas seu perfil
- projects: CRUD restrito ao próprio user_id
- pages: acesso apenas a páginas de projetos do usuário

### Trigger
- Ao criar usuário no Auth → inserir automaticamente em profiles com name e email

## Storage Supabase
- Buckets: `pdfs` (privado), `page-images` (público), `page-thumbnails` (público), `audiobook-audios` (privado), `audiodesc-audios` (privado), `videobook-final` (privado)
- RLS nos buckets privados: acesso apenas ao próprio user_id path

## Componentes Compartilhados
- Logo component (ícone acessibilidade + ondas + texto)
- ProtectedRoute (redireciona para /auth se não autenticado)
- AuthContext com hook useAuth
- Header do dashboard reutilizável

