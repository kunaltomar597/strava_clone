# Stride

A Strava-style fitness tracker: Expo (React Native) + Supabase (Postgres/PostGIS) + Mapbox.
"Stride" is a placeholder name — rename before store submission (see the master plan).

Full architecture, rationale and phased build plan: the master plan document this repo was
built from (`docs/master-plan.md` if you've copied it in, otherwise see the original doc).

## Monorepo layout

```
apps/mobile        Expo app (not yet scaffolded — see "Status" below)
packages/core       Pure TypeScript activity math: filtering, Kalman smoothing, auto-pause,
                    elevation, splits, best efforts, polyline encoding, privacy-zone trimming,
                    live incremental stats. Zero dependencies — runs identically on-device
                    (Hermes) and in Edge Functions (Deno). Fully unit-tested against
                    synthetic GPX fixtures in packages/core/test/fixtures.
packages/contracts  Shared zod schemas + types for uploads, RPC parameters, and (eventually)
                    generated Supabase database types.
supabase/           Migrations, Edge Functions, and pgTAP tests.
```

## Status

This project is being built phase-by-phase per the master plan. Backend (schema, RLS,
Edge Functions) is well ahead of the mobile app, since it can be fully validated in this
environment (see "How the backend was validated" below) while the Expo app cannot be
visually tested without a device/simulator.

Done:
- **packages/core**: complete, tested (36 tests) activity-processing pipeline.
- **packages/contracts**: zod schemas for uploads, RPCs, enums.
- **Database schema**: profiles, user_settings, follows, blocks, activities, activity_streams,
  internal.activity_routes, activity_photos, privacy_zones, best_efforts, kudos, comments,
  notifications, push_tokens, reports — all with RLS policies, and pgTAP tests covering the
  trickiest cross-user visibility/kudos/block behavior.
- **RPCs**: `get_home_feed`, `get_profile_totals`, `search_users`, `upsert_processed_activity`,
  `get_activity_streams`, `is_username_available`, `can_view_activity`, `is_blocked`, `is_follower`.
- **Edge Functions**: `hello` (proves packages/core runs under Deno), `ingest-activity` (the
  full upload → validate → process → persist pipeline, wired to packages/core),
  `delete-account`, `process-jobs` + `send-push` (the notification queue).

Not yet built: the Expo app itself (navigation, screens, the recorder), and everything that
depends on real hardware/accounts — background location on a real device, EAS builds, Apple/
Google developer accounts, Mapbox tokens, the Transistor SDK license, and store submission.
Those need you to create the underlying accounts; the code side is what continues here.

## Local development

```
pnpm install
pnpm typecheck
pnpm lint
pnpm test               # packages/core's vitest suite
```

### Backend

A full local Supabase stack (`supabase start`) needs Docker, which isn't available in every
environment. Every migration and pgTAP test in this repo (except the pgmq/pg_cron queue —
see the note in `20260101000028_notification_queue.sql`) was instead validated against a
real Postgres 16 + PostGIS + pgTAP instance directly, using stand-in `auth`/`storage` schemas
that mirror Supabase's own. Once Docker/`supabase start` is available:

```
supabase start
supabase db reset       # applies every migration + seed.sql
supabase test db        # runs the pgTAP suite for real, including the queue migration
supabase functions serve
```

### Edge Functions

Edge Functions import `packages/core` and `packages/contracts` directly via
`supabase/functions/deno.json`'s import map (no build step, no publishing to npm). They also
rely on Deno's `sloppy-imports` unstable flag, since `packages/core`'s own internal imports
use the `./foo.js`-referring-to-`./foo.ts` convention TypeScript's NodeNext module resolution
requires — this is declared in that same `deno.json`. Typecheck a function directly with:

```
cd supabase/functions
deno check --config deno.json <function>/index.ts
```
