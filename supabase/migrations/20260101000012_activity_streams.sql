create table public.activity_streams (
  activity_id uuid primary key references public.activities (id) on delete cascade,
  point_count int not null,
  time_s int[] not null,
  lat_e7 int[] not null,
  lng_e7 int[] not null,
  altitude_m real[] not null,
  distance_m real[] not null,
  speed_mps real[] not null,
  heartrate smallint[],
  cadence smallint[],
  moving boolean[] not null,
  visible_from_idx int not null default 0,
  visible_to_idx int not null default -1
);

comment on table public.activity_streams is
  'Display-resolution time series. No direct reads: clients call get_activity_streams(), which applies the privacy window for non-owners.';

alter table public.activity_streams enable row level security;

-- Deliberately unreachable directly; documents intent and satisfies "every
-- RLS-enabled table has at least one policy" rather than relying on an
-- implicit zero-policy deny.
create policy "activity_streams_no_direct_access"
  on public.activity_streams
  for select
  to authenticated
  using (false);

revoke all on public.activity_streams from anon, authenticated;

create function public.get_activity_streams(p_activity_id uuid)
returns table (
  point_count int,
  time_s int[],
  lat_e7 int[],
  lng_e7 int[],
  altitude_m real[],
  distance_m real[],
  speed_mps real[],
  heartrate smallint[],
  cadence smallint[],
  moving boolean[]
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  is_owner boolean;
  from_idx int;
  to_idx int;
  total_points int;
begin
  if not public.can_view_activity(p_activity_id) then
    return;
  end if;

  select (a.user_id = (select auth.uid())) into is_owner
  from public.activities a
  where a.id = p_activity_id;

  select s.visible_from_idx, s.visible_to_idx, s.point_count
    into from_idx, to_idx, total_points
  from public.activity_streams s
  where s.activity_id = p_activity_id;

  if not found then
    return;
  end if;

  if is_owner then
    from_idx := 0;
    to_idx := total_points - 1;
  end if;

  return query
  select
    greatest(to_idx - from_idx + 1, 0),
    s.time_s[from_idx + 1 : to_idx + 1],
    s.lat_e7[from_idx + 1 : to_idx + 1],
    s.lng_e7[from_idx + 1 : to_idx + 1],
    s.altitude_m[from_idx + 1 : to_idx + 1],
    s.distance_m[from_idx + 1 : to_idx + 1],
    s.speed_mps[from_idx + 1 : to_idx + 1],
    s.heartrate[from_idx + 1 : to_idx + 1],
    s.cadence[from_idx + 1 : to_idx + 1],
    s.moving[from_idx + 1 : to_idx + 1]
  from public.activity_streams s
  where s.activity_id = p_activity_id;
end;
$$;

revoke all on function public.get_activity_streams(uuid) from public;
grant execute on function public.get_activity_streams(uuid) to authenticated;
