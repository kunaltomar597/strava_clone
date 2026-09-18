create table public.user_settings (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  measurement_system public.measurement_system not null default 'metric',
  default_visibility public.visibility not null default 'followers',
  default_map_visibility public.map_visibility not null default 'hide_start_end',
  birth_date date,
  weight_kg numeric(5, 2) check (weight_kg is null or weight_kg between 20 and 400),
  max_heart_rate smallint check (max_heart_rate is null or max_heart_rate between 60 and 250),
  push_kudos boolean not null default true,
  push_comments boolean not null default true,
  push_follows boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.user_settings is 'Private per-user settings; never readable by anyone but the owner.';

create trigger user_settings_set_updated_at
  before update on public.user_settings
  for each row
  execute function extensions.moddatetime(updated_at);

alter table public.user_settings enable row level security;

create policy "user_settings_select_own"
  on public.user_settings
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "user_settings_update_own"
  on public.user_settings
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.user_settings from anon;
