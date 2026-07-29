# Accessibility Studio

Esteira editorial para transformar ebooks em conteúdos audiovisuais acessíveis.

## Estado do projeto

O sistema está em migração controlada do Lovable Cloud para uma infraestrutura própria, preservando o fluxo atual até a homologação do novo ambiente.

## Requisitos

- Node.js 22.18.x
- npm 10.x

O gerenciador oficial do projeto é o npm. Não use Bun, Yarn ou pnpm para instalar ou atualizar dependências.

## Configuração local

1. Copie `.env.example` para `.env.local`.
2. Preencha somente as configurações públicas do frontend.
3. Nunca coloque chaves administrativas ou Secrets de provedores em variáveis `VITE_*`.

Para homologação, use `.env.staging.local`. Esse arquivo é privado e carregado somente pelos comandos de staging.

Variáveis atuais:

```env
VITE_SUPABASE_PROJECT_ID=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_SUPABASE_URL=
```

## Instalação

```bash
npm ci
```

## Desenvolvimento

```bash
npm run dev
```

Para executar com o Supabase de homologação:

```bash
npm run dev:staging
```

## Validação

Antes de integrar uma alteração:

```bash
npm run lint
npm test
npm run build
```

Para validar o build de homologação:

```bash
npm run build:staging
```

O lint ainda possui avisos conhecidos de Fast Refresh em componentes existentes. Erros não são aceitos.

## Ambientes

- Produção: `https://acessibility.io`
- Homologação: `https://staging.acessibility.io`

Homologação e produção usarão projetos separados no Supabase e na Vercel.

## Segurança

- `.env` e `.env.local` não são versionados.
- Secrets não devem ser registrados no código, GitHub, documentação ou frontend.
- Os vídeos em `referencias/` são materiais privados e permanecem fora do Git.

## Documentação

As decisões arquiteturais e operacionais são mantidas no Vault da Wecker AI Solutions.
