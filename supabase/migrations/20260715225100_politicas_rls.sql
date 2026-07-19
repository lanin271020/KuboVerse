-- Etapa 4 — Row Level Security.
-- Aplicar com: npx supabase db push (depois de `supabase link`).

alter table public.profiles enable row level security;
alter table public.favorites enable row level security;
alter table public.reading_history enable row level security;
alter table public.comments enable row level security;

-- profiles --------------------------------------------------------------
-- Leitura pública: nome/avatar precisam ser exibidos junto dos comentários
-- de qualquer usuário, inclusive para visitantes não autenticados. A tabela
-- não guarda nenhum dado sensível (e-mail/senha ficam em auth.users, gerido
-- pelo Supabase). Escrita é restrita ao próprio usuário.
create policy "profiles_select_publico"
  on public.profiles
  for select
  using (true);

create policy "profiles_insert_proprio"
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = id);

create policy "profiles_update_proprio"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- favorites ---------------------------------------------------------------
-- Cada usuário só vê e gerencia seus próprios favoritos. `to authenticated`
-- é redundante com o `auth.uid() = user_id` (que já dá false para visitantes,
-- já que auth.uid() é null nesse caso), mas deixamos explícito nas quatro
-- tabelas para manter o estilo consistente e a intenção clara na leitura.
create policy "favorites_select_proprio"
  on public.favorites
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "favorites_insert_proprio"
  on public.favorites
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "favorites_delete_proprio"
  on public.favorites
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- reading_history -----------------------------------------------------------
-- Cada usuário só acessa o próprio histórico de leitura.
create policy "reading_history_select_proprio"
  on public.reading_history
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "reading_history_insert_proprio"
  on public.reading_history
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "reading_history_update_proprio"
  on public.reading_history
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "reading_history_delete_proprio"
  on public.reading_history
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- comments ------------------------------------------------------------------
-- Todos podem visualizar (inclusive visitantes); somente autenticados podem
-- criar; somente o autor pode editar ou excluir o próprio comentário.
create policy "comments_select_todos"
  on public.comments
  for select
  using (true);

create policy "comments_insert_autenticado"
  on public.comments
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "comments_update_proprio"
  on public.comments
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "comments_delete_proprio"
  on public.comments
  for delete
  to authenticated
  using (auth.uid() = user_id);
