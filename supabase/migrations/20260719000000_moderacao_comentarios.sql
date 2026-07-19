-- Etapa 5 — Moderação de comentários.
-- Aplicar com: npx supabase db push (depois de `supabase link`).
--
-- Antes desta migração, comentários públicos não tinham NENHUM mecanismo
-- de denúncia/fila de moderação — só o próprio autor podia editar/excluir
-- o que escreveu (ver comments_update_proprio/comments_delete_proprio em
-- 20260715225100_politicas_rls.sql). Isso é um risco relevante num site
-- para crianças: um comentário passa pelo filtro de palavras no momento do
-- envio (ver lib/moderacao.ts), mas esse filtro nunca é 100% — sem uma
-- forma de a própria comunidade sinalizar algo que passou batido, não
-- havia rede de segurança nenhuma depois da publicação.
--
-- `denuncias_count` é mantido pela trigger abaixo (não recalculado a cada
-- leitura) para que ocultar automaticamente comentários muito denunciados
-- (ver LIMITE_DENUNCIAS_PARA_OCULTAR em services/comments.ts) seja uma
-- comparação simples de coluna, sem contar linhas de comment_reports em
-- toda listagem de comentários.
alter table public.comments
  add column if not exists denuncias_count integer not null default 0;

create table if not exists public.comment_reports (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.comments (id) on delete cascade,
  reporter_id uuid not null references auth.users (id) on delete cascade,
  criado_em timestamptz not null default now(),
  -- Uma denúncia por pessoa por comentário — evita que um usuário sozinho
  -- infle a contagem repetindo a mesma denúncia várias vezes.
  unique (comment_id, reporter_id)
);

comment on table public.comment_reports is 'Denúncias de comentários feitas por usuários — cada denúncia incrementa comments.denuncias_count via trigger.';

create index if not exists comment_reports_comment_id_idx on public.comment_reports (comment_id);

create or replace function public.incrementar_denuncias_do_comentario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.comments
  set denuncias_count = denuncias_count + 1
  where id = new.comment_id;
  return new;
end;
$$;

drop trigger if exists ao_denunciar_comentario on public.comment_reports;
create trigger ao_denunciar_comentario
  after insert on public.comment_reports
  for each row execute function public.incrementar_denuncias_do_comentario();

-- Simétrico ao incremento acima: se alguém desfizer a própria denúncia
-- (comment_reports_delete_proprio), a contagem tem que voltar a refletir
-- a realidade — sem isto, um comentário podia ficar oculto para sempre
-- mesmo depois de todas as denúncias serem desfeitas.
create or replace function public.decrementar_denuncias_do_comentario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.comments
  set denuncias_count = greatest(0, denuncias_count - 1)
  where id = old.comment_id;
  return old;
end;
$$;

drop trigger if exists ao_desfazer_denuncia on public.comment_reports;
create trigger ao_desfazer_denuncia
  after delete on public.comment_reports
  for each row execute function public.decrementar_denuncias_do_comentario();

alter table public.comment_reports enable row level security;

-- Qualquer autenticado pode denunciar (a restrição de "uma vez por
-- pessoa" já vem do unique acima); ninguém pode denunciar em nome de
-- outra pessoa.
create policy "comment_reports_insert_proprio"
  on public.comment_reports
  for insert
  to authenticated
  with check (auth.uid() = reporter_id);

-- Um usuário só precisa ver as próprias denúncias (para não mostrar de
-- novo o botão "Denunciar" num comentário que ele já denunciou).
create policy "comment_reports_select_proprio"
  on public.comment_reports
  for select
  to authenticated
  using (auth.uid() = reporter_id);

-- Permite "desfazer" a própria denúncia.
create policy "comment_reports_delete_proprio"
  on public.comment_reports
  for delete
  to authenticated
  using (auth.uid() = reporter_id);
