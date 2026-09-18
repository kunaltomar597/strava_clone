create table public.activities (
  id uuid primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  sport_type public.sport_type not null,
  name text not null,
  description text,
  visibility public.visibility not null default 'followers',
  map_visibility public.map_visibility not null default 'hide_start_end',
  status public.activity_status not null default 'processing',
  processing_version int not null default 1,
  source public.activity_source not null,
  started_at timestamptz not null,
  start_timezone text not null,
  elapsed_time_s int not null default 0,
  moving_time_s int not null default 0,
  distance_m double precision not null default 0,
  elevation_gain_m real,
  elev_high_m real,
  elev_low_m real,
  avg_speed_mps real,
  max_speed_mps real,
  avg_heartrate real,
  max_heartrate real,
  avg_cadence real,
  calories real,
  summary_polyline text,
  start_latlng extensions.geography(point, 4326),
  end_latlng extensions.geography(point, 4326),
  min_lat double precision,
  min_lng double precision,
  max_lat double precision,
  max_lng double precision,
  splits_metric jsonb,
  splits_imperial jsonb,
  -- No FK yet: `gear` doesn't exist until the post-v1 gear-tracking feature.
  gear_id uuid,
  kudos_count int not null default 0,
  comment_count int not null default 0,
  photo_count int not null default 0,
  client_meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint activities_name_length check (char_length(name) between 1 and 120),
  constraint activities_description_length check (description is null or char_length(description) <= 2000),
  constraint activities_distance_nonnegative check (distance_m >= 0),
  constraint activities_time_nonnegative check (elapsed_time_s >= 0 and moving_time_s >= 0),
  constraint activities_moving_le_elapsed check (moving_time_s <= elapsed_time_s),
  constraint activities_counters_nonnegative check (kudos_count >= 0 and comment_count >= 0 and photo_count >= 0)
);

comment on table public.activities is
  'Metadata + summary stats + privacy-trimmed map line. Rows are written only by upsert_processed_activity(), called by the ingest-activity Edge Function; owners may then update a small set of editable columns directly.';

create trigger activities_set_updated_at
  before update on public.activities
  for each row
  execute function extensions.moddatetime(updated_at);

create index activities_user_started_idx on public.activities (user_id, started_at desc, id);
create index activities_public_started_idx on public.activities (started_at desc) where visibility = 'everyone';

alter table public.activities enable row level security;

create function public.can_view_activity(activity_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    case
      when a.user_id = (select auth.uid()) then true
      when public.is_blocked((select auth.uid()), a.user_id) then false
      when a.visibility = 'everyone' then (not p.is_private or public.is_follower((select auth.uid()), a.user_id))
      when a.visibility = 'followers' then public.is_follower((select auth.uid()), a.user_id)
      else false
    end
  from public.activities a
  join public.profiles p on p.id = a.user_id
  where a.id = activity_id;
$$;

revoke all on function public.can_view_activity(uuid) from public;
grant execute on function public.can_view_activity(uuid) to authenticated;

create policy "activities_select"
  on public.activities
  for select
  to authenticated
  using (public.can_view_activity(id));

create policy "activities_update_own"
  on public.activities
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke update on public.activities from authenticated;
grant update (name, description, sport_type, visibility, map_visibility, gear_id) on public.activities to authenticated;

create policy "activities_delete_own"
  on public.activities
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- No insert policy for `authenticated`: activity rows are created only by
-- upsert_processed_activity(), run by the ingest-activity Edge Function
-- under the service role, which bypasses RLS entirely.
revoke all on public.activities from anon;
