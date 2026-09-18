-- Full-resolution route geometry, simplified to ~2m tolerance. Lives
-- outside `public` (and outside config.toml's `api.schemas`), so
-- PostgREST can never expose it regardless of any RLS policy; only
-- server-side jobs (segment matching, later) read it directly.
create table internal.activity_routes (
  activity_id uuid primary key references public.activities (id) on delete cascade,
  geom extensions.geography(linestring, 4326) not null
);

create index activity_routes_geom_idx on internal.activity_routes using gist (geom);

alter table internal.activity_routes enable row level security;

create policy "activity_routes_no_direct_access"
  on internal.activity_routes
  for select
  to authenticated
  using (false);

revoke all on internal.activity_routes from anon, authenticated;
revoke all on schema internal from anon, authenticated;
