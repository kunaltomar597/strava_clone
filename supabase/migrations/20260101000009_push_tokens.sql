create table public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  token text not null unique,
  platform text not null check (platform in ('ios', 'android')),
  app_version text,
  last_seen_at timestamptz not null default now(),
  disabled_at timestamptz,
  created_at timestamptz not null default now()
);

create index push_tokens_user_idx on public.push_tokens (user_id) where disabled_at is null;

alter table public.push_tokens enable row level security;

create policy "push_tokens_select_own"
  on public.push_tokens
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "push_tokens_insert_own"
  on public.push_tokens
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "push_tokens_update_own"
  on public.push_tokens
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "push_tokens_delete_own"
  on public.push_tokens
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.push_tokens from anon;
