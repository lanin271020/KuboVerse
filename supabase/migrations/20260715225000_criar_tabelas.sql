-- Etapa 4 — Banco de dados: profiles, favorites, reading_history, comments.
-- Aplicar com: npx supabase db push (depois de `supabase link`).

create extension if not exists pgcrypto;

-- Mantém "atualizado_em" sincronizado automaticamente em qualquer UPDATE.
create or replace function public.definir_atualizado_em()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

-- profiles ------------------------------------------------------------------
-- Dados públicos de perfil. Ficam separados de auth.users (que é gerenciado
-- pelo Supabase e não deve ser referenciado diretamente pela aplicação).
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text,
  avatar_url text,
  criado_em timestamptz not null default now()
);

comment on table public.profiles is 'Dados públicos de perfil de cada usuário autenticado.';

-- Cria automaticamente uma linha em profiles a cada novo cadastro (e-mail/senha
-- ou OAuth), copiando nome/avatar do metadata que o Supabase Auth já guarda.
create or replace function public.lidar_com_novo_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nome, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nome', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function public.lidar_com_novo_usuario();

-- favorites -------------------------------------------------------------
create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  manga_id text not null,
  titulo text not null,
  capa text,
  data_adicionado timestamptz not null default now(),
  unique (user_id, manga_id)
);

comment on table public.favorites is 'Obras favoritadas por cada usuário (manga_id referencia MangaDex/MangaLivre).';

create index if not exists favorites_user_id_idx on public.favorites (user_id);

-- reading_history ---------------------------------------------------------
-- Uma linha por (usuário, obra): sempre a última posição de leitura, não um
-- histórico completo de cada capítulo já lido. É essa linha que alimenta a
-- seção "Continuar lendo".
create table if not exists public.reading_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  manga_id text not null,
  capitulo_id text not null,
  pagina_atual integer not null default 0 check (pagina_atual >= 0),
  atualizado_em timestamptz not null default now(),
  unique (user_id, manga_id)
);

comment on table public.reading_history is 'Última posição de leitura de cada usuário por obra.';

create index if not exists reading_history_user_id_idx on public.reading_history (user_id);
create index if not exists reading_history_continuar_lendo_idx
  on public.reading_history (user_id, atualizado_em desc);

drop trigger if exists definir_atualizado_em_reading_history on public.reading_history;
create trigger definir_atualizado_em_reading_history
  before update on public.reading_history
  for each row execute function public.definir_atualizado_em();

-- comments ----------------------------------------------------------------
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  manga_id text not null,
  chapter_id text not null,
  comentario text not null check (char_length(comentario) between 1 and 2000),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

comment on table public.comments is 'Comentários de usuários, relacionados a um capítulo específico.';

create index if not exists comments_chapter_id_idx on public.comments (chapter_id, criado_em desc);
create index if not exists comments_user_id_idx on public.comments (user_id);

drop trigger if exists definir_atualizado_em_comments on public.comments;
create trigger definir_atualizado_em_comments
  before update on public.comments
  for each row execute function public.definir_atualizado_em();
