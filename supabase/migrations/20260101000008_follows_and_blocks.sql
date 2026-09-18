create table public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  followee_id uuid not null references public.profiles (id) on delete cascade,
  status public.follow_status not null default 'accepted',
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  primary key (follower_id, followee_id),
  constraint follows_no_self_follow check (follower_id <> followee_id)
);

create index follows_followee_status_idx on public.follows (followee_id, status);
create index follows_follower_status_idx on public.follows (follower_id, status);

create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint blocks_no_self_block check (blocker_id <> blocked_id)
);

alter table public.follows enable row level security;
alter table public.blocks enable row level security;

-- ---------- Helper functions (STABLE, SECURITY DEFINER, empty search_path) ----------

create function public.is_blocked(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = a and blocked_id = b)
       or (blocker_id = b and blocked_id = a)
  );
$$;
revoke all on function public.is_blocked(uuid, uuid) from public;
grant execute on function public.is_blocked(uuid, uuid) to authenticated;

create function public.is_follower(viewer uuid, owner uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.follows
    where follower_id = viewer and followee_id = owner and status = 'accepted'
  );
$$;
revoke all on function public.is_follower(uuid, uuid) from public;
grant execute on function public.is_follower(uuid, uuid) to authenticated;

-- ---------- follows: status-on-insert, counters, notifications ----------

create function public.follows_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  followee_is_private boolean;
begin
  select is_private into followee_is_private from public.profiles where id = new.followee_id;
  if followee_is_private then
    new.status := 'pending';
    new.accepted_at := null;
  else
    new.status := 'accepted';
    new.accepted_at := now();
  end if;
  return new;
end;
$$;

create trigger follows_before_insert
  before insert on public.follows
  for each row
  execute function public.follows_before_insert();

create function public.follows_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'accepted' then
    update public.profiles set following_count = following_count + 1 where id = new.follower_id;
    update public.profiles set followers_count = followers_count + 1 where id = new.followee_id;
    insert into public.notifications (recipient_id, actor_id, type)
      values (new.followee_id, new.follower_id, 'follow');
  else
    insert into public.notifications (recipient_id, actor_id, type)
      values (new.followee_id, new.follower_id, 'follow_request');
  end if;
  return new;
end;
$$;

create trigger follows_after_insert
  after insert on public.follows
  for each row
  execute function public.follows_after_insert();

create function public.follows_after_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'pending' and new.status = 'accepted' then
    update public.profiles set following_count = following_count + 1 where id = new.follower_id;
    update public.profiles set followers_count = followers_count + 1 where id = new.followee_id;
    insert into public.notifications (recipient_id, actor_id, type)
      values (new.follower_id, new.followee_id, 'follow_accepted');
  end if;
  return new;
end;
$$;

create trigger follows_after_update
  after update on public.follows
  for each row
  execute function public.follows_after_update();

create function public.follows_before_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'pending' and new.status = 'accepted' then
    new.accepted_at := now();
  end if;
  return new;
end;
$$;

create trigger follows_before_update
  before update on public.follows
  for each row
  execute function public.follows_before_update();

create function public.follows_after_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'accepted' then
    update public.profiles set following_count = greatest(following_count - 1, 0) where id = old.follower_id;
    update public.profiles set followers_count = greatest(followers_count - 1, 0) where id = old.followee_id;
  end if;
  return old;
end;
$$;

create trigger follows_after_delete
  after delete on public.follows
  for each row
  execute function public.follows_after_delete();

-- ---------- blocks: delete any existing follow edge in both directions ----------

create function public.blocks_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.follows
  where (follower_id = new.blocker_id and followee_id = new.blocked_id)
     or (follower_id = new.blocked_id and followee_id = new.blocker_id);
  return new;
end;
$$;

create trigger blocks_after_insert
  after insert on public.blocks
  for each row
  execute function public.blocks_after_insert();

-- ---------- RLS ----------

create policy "follows_select"
  on public.follows
  for select
  to authenticated
  using (
    status = 'accepted'
    or follower_id = (select auth.uid())
    or followee_id = (select auth.uid())
  );

create policy "follows_insert_as_self"
  on public.follows
  for insert
  to authenticated
  with check (
    follower_id = (select auth.uid())
    and not public.is_blocked(follower_id, followee_id)
  );

-- Only the followee accepts a pending request; column grants below stop
-- anyone from writing anything but `status`.
create policy "follows_update_as_followee"
  on public.follows
  for update
  to authenticated
  using (followee_id = (select auth.uid()))
  with check (followee_id = (select auth.uid()));

revoke update on public.follows from authenticated;
grant update (status) on public.follows to authenticated;

create policy "follows_delete_either_side"
  on public.follows
  for delete
  to authenticated
  using (follower_id = (select auth.uid()) or followee_id = (select auth.uid()));

revoke all on public.follows from anon;

create policy "blocks_select_own"
  on public.blocks
  for select
  to authenticated
  using (blocker_id = (select auth.uid()));

create policy "blocks_insert_own"
  on public.blocks
  for insert
  to authenticated
  with check (blocker_id = (select auth.uid()));

create policy "blocks_delete_own"
  on public.blocks
  for delete
  to authenticated
  using (blocker_id = (select auth.uid()));

revoke all on public.blocks from anon;
