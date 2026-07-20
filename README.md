# KuboVerse — leitor de Manhwa/Mangá/Manhua

Leitor de manhwas, mangás e manhuas traduzidos em português,
agregando dados/capítulos da MangaDex (fonte principal) e do MangaLivre
(fonte secundária: só manhwa e mangá shonen). Site pensado para um
público infantil/geral: conteúdo adulto é filtrado ativamente em toda
a cadeia de importação (ver `lib/mangadex.ts` e `lib/mangalivre.ts`).

## Stack

- Next.js 15 (App Router), React 19, TypeScript
- Tailwind CSS
- Supabase (Postgres + Auth) para contas, favoritos, histórico de
  leitura e comentários — com Row Level Security em todas as tabelas
- Zod para validação de entrada (formulários, payloads de API)

## Pré-requisitos

- Node.js 20+
- Uma conta/projeto no [supabase.com](https://supabase.com) (ou o
  Supabase CLI, para rodar tudo localmente)

## Configuração local

1. `npm install`
2. Copie `.env.example` para `.env.local` e preencha as variáveis (ver
   comentários em cada uma):
   - `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` — do
     painel do seu projeto Supabase (Project Settings → API).
   - `SUPABASE_SERVICE_ROLE_KEY` — opcional nesta etapa; nunca expor ao
     cliente.
   - `NEXT_PUBLIC_SITE_URL` — em dev pode deixar
     `http://localhost:3000`.
3. Aplique as migrations em `supabase/migrations/` no seu projeto
   Supabase (via `supabase db push` com o CLI, ou colando o SQL de cada
   arquivo, em ordem, no SQL Editor do painel).
4. Se for usar login com Google, configure o provedor em
   Authentication → Providers no painel do Supabase, com as
   credenciais OAuth do Google Cloud, e cadastre
   `<sua-url>/auth/callback` como Redirect URI autorizado tanto no
   Google Cloud quanto em Authentication → URL Configuration do
   Supabase.
5. `npm run dev` e acesse `http://localhost:3000`.

## Scripts

- `npm run dev` — servidor de desenvolvimento
- `npm run build` — build de produção
- `npm run start` — serve o build de produção
- `npm run lint` — ESLint

## Deploy (ex.: Vercel)

1. Suba o repositório para GitHub/GitLab.
2. Em vercel.com, "Add New Project" → importe o repositório (framework
   Next.js é detectado automaticamente).
3. Configure as variáveis de ambiente do passo 2 acima no painel do
   projeto na Vercel (Settings → Environment Variables) — **incluindo**
   `NEXT_PUBLIC_SITE_URL` apontando para o domínio final de produção
   (ex.: `https://giganime.com.br`). Isso é usado para montar os links
   de confirmação de e-mail/recuperação de senha/OAuth do lado do
   servidor sem depender do cabeçalho `Host` da requisição — ver
   `services/auth.ts`.
4. No painel do Supabase, em Authentication → URL Configuration,
   adicione a URL de produção em "Site URL" e "Redirect URLs"
   (`<sua-url>/auth/callback`).
5. Deploy. O cache do catálogo (`revalidate`) e o BFF (`/api/catalogo`,
   `/api/busca`) funcionam automaticamente na infraestrutura da Vercel.

## Moderação e curadoria de conteúdo

- Toda obra importada passa por filtros de classificação de conteúdo,
  tags e regex de título/sinopse — ver `lib/mangadex.ts` e
  `lib/mangalivre.ts`. Do MangaLivre entram só manhwa e mangá shonen.
  A política é "fail-closed": na dúvida, a obra é excluída.
- Comentários de usuários passam por moderação básica (conteúdo sexual,
  palavrão, links, spam) em `lib/moderacao.ts`, e podem ser denunciados
  pela comunidade (`services/comments.ts`).
- Há um limite de requisições básico (rate limiting em memória) nas
  rotas de API públicas, configurado em `middleware.ts` — ver
  ressalvas sobre múltiplas instâncias/serverless em `lib/rateLimit.ts`.

## Estrutura

- `app/` — rotas (App Router): páginas, Route Handlers, metadata
  (`sitemap.ts`, `robots.ts`, `icon.tsx`)
- `lib/` — acesso a dados externos (MangaDex/MangaLivre), validação,
  moderação, rate limiting
- `services/` — Server Actions que falam com o Supabase (auth,
  favoritos, histórico, comentários, perfil)
- `components/` — componentes de UI
- `supabase/migrations/` — schema do banco (aplicar em ordem)
