create table public.comments (
  id uuid primary key,
  activity_id uuid not null references public.activities (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  edited_at timestamptz,
  constraint comments_body_length check (char_length(body) between 1 and 1000)
);

create index comments_activity_created_idx on public.comments (activity_id, created_at);

create trigger comments_set_updated_at
  before update on public.comments
  for each row
  execute function extensions.moddatetime(updated_at);

-- `updated_at` tracks any change; `edited_at` specifically marks a body
-- edit, shown to readers as "(edited)" — set only when body actually changes.
create function public.comments_before_update()
returns trigger
language plpgsql
as $$
begin
  if new.body is distinct from old.body then
    new.edited_at := now();
  end if;
  return new;
end;
$$;

create trigger comments_before_update
  before update on public.comments
  for each row
  execute function public.comments_before_update();

alter table public.comments enable row level security;

create function public.comments_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid;
begin
  update public.activities set comment_count = comment_count + 1
    where id = new.activity_id
    returning user_id into owner_id;

  if owner_id is not null and owner_id <> new.user_id then
    insert into public.notifications (recipient_id, actor_id, type, activity_id, comment_id)
      values (owner_id, new.user_id, 'comment', new.activity_id, new.id);
  end if;

  return new;
end;
$$;

create trigger comments_after_insert
  after insert on public.comments
  for each row
  execute function public.comments_after_insert();

create function public.comments_after_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.activities set comment_count = greatest(comment_count - 1, 0) where id = old.activity_id;
  return old;
end;
$$;

create trigger comments_after_delete
  after delete on public.comments
  for each row
  execute function public.comments_after_delete();

create policy "comments_select"
  on public.comments
  for select
  to authenticated
  using (public.can_view_activity(activity_id));

create policy "comments_insert_as_self"
  on public.comments
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and public.can_view_activity(activity_id)
    and not exists (
      select 1 from public.activities a
      where a.id = activity_id and public.is_blocked((select auth.uid()), a.user_id)
    )
  );

create policy "comments_update_own"
  on public.comments
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke update on public.comments from authenticated;
grant update (body) on public.comments to authenticated;

-- Either the comment's author, or the activity's owner moderating their
-- own activity, may delete a comment.
create policy "comments_delete_own_or_activity_owner"
  on public.comments
  for delete
  to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.activities a where a.id = activity_id and a.user_id = (select auth.uid())
    )
  );

revoke all on public.comments from anon;
