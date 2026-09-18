-- Called only by the ingest-activity Edge Function (service role), which
-- has already run packages/core's processActivity() and is handing us its
-- exact output as jsonb. Writes the activity, streams, internal route and
-- best efforts in one transaction; re-running with the same activity ID
-- (a reprocess, or a retried upload) updates every row in place.
create function public.upsert_processed_activity(payload jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_activity_id uuid := (payload ->> 'activityId')::uuid;
  v_user_id uuid := (payload ->> 'userId')::uuid;
  v_stats jsonb := payload -> 'stats';
  v_streams jsonb := payload -> 'streams';
  v_start_latlng extensions.geography;
  v_end_latlng extensions.geography;
  v_route_geom extensions.geography;
begin
  if payload -> 'startLatLng' is not null and payload -> 'startLatLng' <> 'null'::jsonb then
    v_start_latlng := extensions.st_setsrid(
      extensions.st_makepoint(
        (payload -> 'startLatLng' ->> 'lng')::double precision,
        (payload -> 'startLatLng' ->> 'lat')::double precision
      ),
      4326
    )::extensions.geography;
  end if;

  if payload -> 'endLatLng' is not null and payload -> 'endLatLng' <> 'null'::jsonb then
    v_end_latlng := extensions.st_setsrid(
      extensions.st_makepoint(
        (payload -> 'endLatLng' ->> 'lng')::double precision,
        (payload -> 'endLatLng' ->> 'lat')::double precision
      ),
      4326
    )::extensions.geography;
  end if;

  insert into public.activities (
    id, user_id, sport_type, name, description, visibility, map_visibility, status,
    processing_version, source, started_at, start_timezone,
    elapsed_time_s, moving_time_s, distance_m,
    elevation_gain_m, elev_high_m, elev_low_m, avg_speed_mps, max_speed_mps, calories,
    summary_polyline, start_latlng, end_latlng,
    min_lat, min_lng, max_lat, max_lng,
    splits_metric, splits_imperial, client_meta
  ) values (
    v_activity_id, v_user_id, (payload ->> 'sport')::public.sport_type, payload ->> 'name', payload ->> 'description',
    coalesce((payload ->> 'visibility')::public.visibility, 'followers'),
    coalesce((payload ->> 'mapVisibility')::public.map_visibility, 'hide_start_end'),
    'ready', 1, (payload ->> 'source')::public.activity_source,
    (payload ->> 'startedAt')::timestamptz, payload ->> 'startTimezone',
    (v_stats ->> 'elapsedTimeS')::numeric::int,
    (v_stats ->> 'movingTimeS')::numeric::int,
    (v_stats ->> 'distanceM')::double precision,
    (v_stats ->> 'elevationGainM')::real,
    (v_stats ->> 'elevHighM')::real,
    (v_stats ->> 'elevLowM')::real,
    (v_stats ->> 'avgSpeedMps')::real,
    (v_stats ->> 'maxSpeedMps')::real,
    (v_stats ->> 'calories')::real,
    payload ->> 'summaryPolyline',
    v_start_latlng,
    v_end_latlng,
    (payload -> 'boundingBox' ->> 'minLat')::double precision,
    (payload -> 'boundingBox' ->> 'minLng')::double precision,
    (payload -> 'boundingBox' ->> 'maxLat')::double precision,
    (payload -> 'boundingBox' ->> 'maxLng')::double precision,
    payload -> 'splitsMetric',
    payload -> 'splitsImperial',
    coalesce(payload -> 'clientMeta', '{}'::jsonb)
  )
  on conflict (id) do update set
    sport_type = excluded.sport_type,
    name = excluded.name,
    description = excluded.description,
    status = 'ready',
    processing_version = public.activities.processing_version + 1,
    started_at = excluded.started_at,
    start_timezone = excluded.start_timezone,
    elapsed_time_s = excluded.elapsed_time_s,
    moving_time_s = excluded.moving_time_s,
    distance_m = excluded.distance_m,
    elevation_gain_m = excluded.elevation_gain_m,
    elev_high_m = excluded.elev_high_m,
    elev_low_m = excluded.elev_low_m,
    avg_speed_mps = excluded.avg_speed_mps,
    max_speed_mps = excluded.max_speed_mps,
    calories = excluded.calories,
    summary_polyline = excluded.summary_polyline,
    start_latlng = excluded.start_latlng,
    end_latlng = excluded.end_latlng,
    min_lat = excluded.min_lat,
    min_lng = excluded.min_lng,
    max_lat = excluded.max_lat,
    max_lng = excluded.max_lng,
    splits_metric = excluded.splits_metric,
    splits_imperial = excluded.splits_imperial,
    client_meta = excluded.client_meta;

  insert into public.activity_streams (
    activity_id, point_count, time_s, lat_e7, lng_e7, altitude_m, distance_m, speed_mps,
    heartrate, cadence, moving, visible_from_idx, visible_to_idx
  )
  values (
    v_activity_id,
    (v_streams ->> 'pointCount')::int,
    array(select jsonb_array_elements_text(v_streams -> 'timeS'))::int[],
    array(select jsonb_array_elements_text(v_streams -> 'latE7'))::int[],
    array(select jsonb_array_elements_text(v_streams -> 'lngE7'))::int[],
    array(select jsonb_array_elements_text(v_streams -> 'altitudeM'))::real[],
    array(select jsonb_array_elements_text(v_streams -> 'distanceM'))::real[],
    array(select jsonb_array_elements_text(v_streams -> 'speedMps'))::real[],
    array(select jsonb_array_elements_text(v_streams -> 'heartrate'))::smallint[],
    array(select jsonb_array_elements_text(v_streams -> 'cadence'))::smallint[],
    array(select jsonb_array_elements_text(v_streams -> 'moving'))::boolean[],
    (payload ->> 'visibleFromIdx')::int,
    (payload ->> 'visibleToIdx')::int
  )
  on conflict (activity_id) do update set
    point_count = excluded.point_count,
    time_s = excluded.time_s,
    lat_e7 = excluded.lat_e7,
    lng_e7 = excluded.lng_e7,
    altitude_m = excluded.altitude_m,
    distance_m = excluded.distance_m,
    speed_mps = excluded.speed_mps,
    heartrate = excluded.heartrate,
    cadence = excluded.cadence,
    moving = excluded.moving,
    visible_from_idx = excluded.visible_from_idx,
    visible_to_idx = excluded.visible_to_idx;

  if jsonb_array_length(v_streams -> 'latE7') >= 2 then
    v_route_geom := extensions.st_setsrid(
      extensions.st_makeline(
        array(
          select extensions.st_makepoint(pair.lng::double precision / 1e7, pair.lat::double precision / 1e7)
          from unnest(
            array(select jsonb_array_elements_text(v_streams -> 'lngE7'))::bigint[],
            array(select jsonb_array_elements_text(v_streams -> 'latE7'))::bigint[]
          ) as pair (lng, lat)
        )
      ),
      4326
    )::extensions.geography;

    insert into internal.activity_routes (activity_id, geom)
    values (v_activity_id, v_route_geom)
    on conflict (activity_id) do update set geom = excluded.geom;
  end if;

  delete from public.best_efforts where activity_id = v_activity_id;

  insert into public.best_efforts (activity_id, user_id, effort_key, elapsed_time_s, start_idx, end_idx)
  select
    v_activity_id,
    v_user_id,
    (e ->> 'effortKey')::public.effort_key,
    round((e ->> 'elapsedTimeS')::numeric)::int,
    (e ->> 'startIdx')::int,
    (e ->> 'endIdx')::int
  from jsonb_array_elements(coalesce(payload -> 'bestEfforts', '[]'::jsonb)) as e;
end;
$$;

-- Only the service role calls this (from the ingest-activity Edge
-- Function); it is never reachable through PostgREST for authenticated
-- or anon.
revoke all on function public.upsert_processed_activity(jsonb) from public, anon, authenticated;
