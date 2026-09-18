-- Returns the last `p_buckets` periods (weeks/months/years) of totals for
-- a user, oldest first — directly what the You tab's "weekly distance
-- chart" and rolling totals need, without a separate endpoint per view.
create function public.get_profile_totals(p_user_id uuid, p_period text, p_buckets int default 12)
returns table (
  bucket_start timestamptz,
  activity_count bigint,
  distance_m double precision,
  moving_time_s bigint,
  elevation_gain_m double precision
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  trunc_unit text := case p_period when 'week' then 'week' when 'month' then 'month' when 'year' then 'year' else 'week' end;
  step interval := case p_period when 'week' then interval '1 week' when 'month' then interval '1 month' when 'year' then interval '1 year' else interval '1 week' end;
begin
  return query
  with buckets as (
    select generate_series(
      date_trunc(trunc_unit, now()) - step * (greatest(p_buckets, 1) - 1),
      date_trunc(trunc_unit, now()),
      step
    ) as bucket_start
  )
  select
    b.bucket_start,
    count(a.id)::bigint,
    coalesce(sum(a.distance_m), 0),
    coalesce(sum(a.moving_time_s), 0)::bigint,
    coalesce(sum(a.elevation_gain_m), 0)::double precision
  from buckets b
  left join public.activities a
    on date_trunc(trunc_unit, a.started_at) = b.bucket_start
    and a.user_id = p_user_id
    and a.status = 'ready'
    and (a.user_id = (select auth.uid()) or public.can_view_activity(a.id))
  group by b.bucket_start
  order by b.bucket_start;
end;
$$;

revoke all on function public.get_profile_totals(uuid, text, int) from public;
grant execute on function public.get_profile_totals(uuid, text, int) to authenticated;
