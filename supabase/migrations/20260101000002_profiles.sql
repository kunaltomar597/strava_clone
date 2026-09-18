create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username extensions.citext not null unique,
  display_name text not null,
  avatar_path text,
  bio text,
  city text,
  region text,
  country_code text,
  is_private boolean not null default false,
  followers_count integer not null default 0,
  following_count integer not null default 0,
  activity_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_length check (char_length(username::text) between 3 and 30),
  constraint profiles_username_format check (username::text ~ '^[a-z0-9_.]+$'),
  constraint profiles_display_name_length check (char_length(display_name) between 1 and 60),
  constraint profiles_bio_length check (bio is null or char_length(bio) <= 280),
  constraint profiles_counters_nonnegative check (
    followers_count >= 0 and following_count >= 0 and activity_count >= 0
  )
);

comment on table public.profiles is 'One public profile per auth user, created by handle_new_user on sign-up.';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row
  execute function extensions.moddatetime(updated_at);

-- Trigram indexes power search_users() (Phase 6); a plain unique index on
-- username already exists implicitly from the column constraint above.
create index profiles_username_trgm_idx on public.profiles using gin (username extensions.gin_trgm_ops);
create index profiles_display_name_trgm_idx on public.profiles using gin (display_name extensions.gin_trgm_ops);

alter table public.profiles enable row level security;

-- Every signed-in user can read every profile. Fine-grained visibility of
-- an individual's *activities* is enforced separately by can_view_activity()
-- in Phase 5 — a profile's existence and headline info is not itself private.
create policy "profiles_select_authenticated"
  on public.profiles
  for select
  to authenticated
  using (true);

create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Column-level grants: counters are maintained only by triggers (added in
-- later phases alongside follows/activities), never client-writable.
revoke update on public.profiles from authenticated;
grant update (username, display_name, avatar_path, bio, city, region, country_code, is_private)
  on public.profiles to authenticated;

revoke all on public.profiles from anon;
