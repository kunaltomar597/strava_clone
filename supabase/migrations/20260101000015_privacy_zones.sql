create table public.privacy_zones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  label text not null,
  center extensions.geography(point, 4326) not null,
  radius_m int not null,
  created_at timestamptz not null default now(),
  constraint privacy_zones_label_length check (char_length(label) between 1 and 60),
  constraint privacy_zones_radius_range check (radius_m between 200 and 1600)
);

create index privacy_zones_user_idx on public.privacy_zones (user_id);

comment on table public.privacy_zones is
  'Read by the ingest-activity Edge Function under the service role; the trim distance is randomized per-activity (see packages/core''s privacy.ts) so repeated activities cannot triangulate the exact center.';

alter table public.privacy_zones enable row level security;

create policy "privacy_zones_all_own"
  on public.privacy_zones
  for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on public.privacy_zones from anon;
