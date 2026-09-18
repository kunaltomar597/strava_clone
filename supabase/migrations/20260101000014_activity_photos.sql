create table public.activity_photos (
  id uuid primary key,
  activity_id uuid not null references public.activities (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  storage_path text not null unique,
  width int not null,
  height int not null,
  blurhash text not null,
  caption text,
  taken_at timestamptz,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  constraint activity_photos_caption_length check (caption is null or char_length(caption) <= 500)
);

create index activity_photos_activity_idx on public.activity_photos (activity_id, sort_order);

alter table public.activity_photos enable row level security;

create policy "activity_photos_select"
  on public.activity_photos
  for select
  to authenticated
  using (public.can_view_activity(activity_id));

create policy "activity_photos_insert_own"
  on public.activity_photos
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.activities a
      where a.id = activity_id and a.user_id = (select auth.uid())
    )
  );

create policy "activity_photos_delete_own"
  on public.activity_photos
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.activity_photos from anon;

-- Counter maintained by trigger, matching activities.kudos_count/comment_count.
create function public.activity_photos_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.activities set photo_count = photo_count + 1 where id = new.activity_id;
  return new;
end;
$$;

create trigger activity_photos_after_insert
  after insert on public.activity_photos
  for each row
  execute function public.activity_photos_after_insert();

create function public.activity_photos_after_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.activities set photo_count = greatest(photo_count - 1, 0) where id = old.activity_id;
  return old;
end;
$$;

create trigger activity_photos_after_delete
  after delete on public.activity_photos
  for each row
  execute function public.activity_photos_after_delete();
