create table public.kudos (
  activity_id uuid not null references public.activities (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (activity_id, user_id)
);

alter table public.kudos enable row level security;

create function public.kudos_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid;
begin
  update public.activities set kudos_count = kudos_count + 1
    where id = new.activity_id
    returning user_id into owner_id;

  if owner_id is not null and owner_id <> new.user_id then
    insert into public.notifications (recipient_id, actor_id, type, activity_id)
      values (owner_id, new.user_id, 'kudos', new.activity_id);
  end if;

  return new;
end;
$$;

create trigger kudos_after_insert
  after insert on public.kudos
  for each row
  execute function public.kudos_after_insert();

create function public.kudos_after_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.activities set kudos_count = greatest(kudos_count - 1, 0) where id = old.activity_id;
  return old;
end;
$$;

create trigger kudos_after_delete
  after delete on public.kudos
  for each row
  execute function public.kudos_after_delete();

create policy "kudos_select"
  on public.kudos
  for select
  to authenticated
  using (public.can_view_activity(activity_id));

-- Idempotent by primary key, viewable-only, and never on your own activity.
create policy "kudos_insert_as_self"
  on public.kudos
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and public.can_view_activity(activity_id)
    and not exists (
      select 1 from public.activities a where a.id = activity_id and a.user_id = (select auth.uid())
    )
  );

create policy "kudos_delete_own"
  on public.kudos
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.kudos from anon;
