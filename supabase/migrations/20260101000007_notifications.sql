-- Created before follows/activities/comments because their triggers write
-- notification rows. `activity_id` and `comment_id` are added without a
-- foreign key here (those tables don't exist yet) and gain one via
-- `alter table ... add constraint` in the migrations that create them.
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  actor_id uuid not null references public.profiles (id) on delete cascade,
  type public.notification_type not null,
  activity_id uuid,
  comment_id uuid,
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.notifications is
  'Inserted only by security-definer trigger functions elsewhere in the schema, never directly by clients.';

create index notifications_recipient_created_idx on public.notifications (recipient_id, created_at desc);
create index notifications_unread_idx on public.notifications (recipient_id) where read_at is null;

alter table public.notifications enable row level security;

create policy "notifications_select_own"
  on public.notifications
  for select
  to authenticated
  using ((select auth.uid()) = recipient_id);

create policy "notifications_update_own"
  on public.notifications
  for update
  to authenticated
  using ((select auth.uid()) = recipient_id)
  with check ((select auth.uid()) = recipient_id);

-- Clients may only flip read_at; every other column is trigger-authored.
revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

revoke all on public.notifications from anon;
