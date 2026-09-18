create table public.best_efforts (
  id bigint generated always as identity primary key,
  activity_id uuid not null references public.activities (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  effort_key public.effort_key not null,
  elapsed_time_s int not null check (elapsed_time_s > 0),
  start_idx int not null,
  end_idx int not null,
  pr_rank smallint,
  unique (activity_id, effort_key)
);

create index best_efforts_user_key_time_idx on public.best_efforts (user_id, effort_key, elapsed_time_s);

alter table public.best_efforts enable row level security;

create policy "best_efforts_select"
  on public.best_efforts
  for select
  to authenticated
  using (public.can_view_activity(activity_id));

revoke all on public.best_efforts from anon, authenticated;
grant select on public.best_efforts to authenticated;
