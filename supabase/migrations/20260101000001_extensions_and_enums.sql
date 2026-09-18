-- Extensions used throughout the schema. `extensions` is Supabase's
-- convention schema for extension-owned objects, kept out of `public` so
-- PostgREST never exposes their internals directly.
create extension if not exists postgis with schema extensions;
create extension if not exists citext with schema extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists moddatetime with schema extensions;
-- pgmq and pg_cron are installed in the migration that first uses them
-- (Phase 8's notification queue), not upfront, so earlier phases don't
-- carry a dependency they don't need yet.

-- Holds tables that must never be reachable through the PostgREST API,
-- such as the full-resolution route geometry (see Phase 5). A schema
-- outside `public` (and not listed in `api.schemas` in config.toml) is
-- invisible to PostgREST regardless of any RLS policy.
create schema if not exists internal;

-- Enums, matching packages/contracts' zod enums 1:1.
create type public.sport_type as enum ('run', 'ride', 'walk', 'hike');
create type public.visibility as enum ('everyone', 'followers', 'only_me');
create type public.map_visibility as enum ('full', 'hide_start_end', 'hidden');
create type public.follow_status as enum ('pending', 'accepted');
create type public.activity_status as enum ('processing', 'ready', 'failed');
create type public.activity_source as enum ('ios', 'android', 'gpx_import', 'manual');
create type public.notification_type as enum (
  'kudos',
  'comment',
  'follow',
  'follow_request',
  'follow_accepted',
  'personal_record'
);
create type public.measurement_system as enum ('metric', 'imperial');
create type public.report_target_type as enum ('activity', 'comment', 'profile', 'photo');
create type public.report_status as enum ('open', 'reviewed', 'actioned');
create type public.effort_key as enum ('400m', '1k', '1mi', '5k', '10k', 'half', 'marathon');
