create function public.get_home_feed(before_ts timestamptz default null, before_id uuid default null, result_limit int default 20)
returns table (
  id uuid,
  user_id uuid,
  username extensions.citext,
  display_name text,
  avatar_path text,
  sport_type public.sport_type,
  name text,
  started_at timestamptz,
  distance_m double precision,
  elapsed_time_s int,
  moving_time_s int,
  elevation_gain_m real,
  summary_polyline text,
  min_lat double precision,
  min_lng double precision,
  max_lat double precision,
  max_lng double precision,
  kudos_count int,
  comment_count int,
  has_kudoed boolean,
  photo_paths text[]
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    a.id,
    a.user_id,
    p.username,
    p.display_name,
    p.avatar_path,
    a.sport_type,
    a.name,
    a.started_at,
    a.distance_m,
    a.elapsed_time_s,
    a.moving_time_s,
    a.elevation_gain_m,
    a.summary_polyline,
    a.min_lat,
    a.min_lng,
    a.max_lat,
    a.max_lng,
    a.kudos_count,
    a.comment_count,
    exists(
      select 1 from public.kudos k where k.activity_id = a.id and k.user_id = (select auth.uid())
    ) as has_kudoed,
    coalesce(
      (
        select array_agg(ph.storage_path order by ph.sort_order)
        from (
          select storage_path, sort_order
          from public.activity_photos
          where activity_id = a.id
          order by sort_order
          limit 3
        ) ph
      ),
      array[]::text[]
    ) as photo_paths
  from public.activities a
  join public.profiles p on p.id = a.user_id
  where a.status = 'ready'
    and not public.is_blocked((select auth.uid()), a.user_id)
    and (
      a.user_id = (select auth.uid())
      or (
        a.visibility in ('everyone', 'followers')
        and exists (
          select 1 from public.follows f
          where f.follower_id = (select auth.uid())
            and f.followee_id = a.user_id
            and f.status = 'accepted'
        )
      )
    )
    and (
      before_ts is null
      or before_id is null
      or (a.started_at, a.id) < (before_ts, before_id)
    )
  order by a.started_at desc, a.id desc
  limit least(coalesce(result_limit, 20), 50);
$$;

revoke all on function public.get_home_feed(timestamptz, uuid, int) from public;
grant execute on function public.get_home_feed(timestamptz, uuid, int) to authenticated;
