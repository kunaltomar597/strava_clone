# Stride

A Strava-style fitness tracker: Expo (React Native) + Supabase (Postgres/PostGIS) + Mapbox.
"Stride" is a placeholder name — rename before store submission (see the master plan).

Full architecture, rationale and phased build plan: the master plan document this repo was
built from (`docs/master-plan.md` if you've copied it in, otherwise see the original doc).

## Monorepo layout

```
apps/mobile         Expo Router app: auth, onboarding, home feed, activity detail, recorder,
                     profile. Development-build only — Expo Go cannot run this app (background
                     location, Mapbox and native config all need a dev client).
packages/core        Pure TypeScript activity math: filtering, Kalman smoothing, auto-pause,
                     elevation, splits, best efforts, polyline encoding, privacy-zone trimming,
                     live incremental stats. Zero dependencies — runs identically on-device
                     (Hermes) and in Edge Functions (Deno). Fully unit-tested against
                     synthetic GPX fixtures in packages/core/test/fixtures.
packages/contracts   Shared zod schemas + types for uploads, RPC parameters, and Supabase
                     database types.
supabase/            Migrations, Edge Functions, and pgTAP tests.
```

## Status

Built phase-by-phase per the master plan, with the backend (schema, RLS, Edge Functions) and
`packages/core` validated directly in this environment; the Expo app compiles and typechecks
cleanly but has not been run on a simulator/device (none was available while building it) —
see "What still needs a real device" below.

Done:
- **packages/core**: complete, tested (36 tests) activity-processing pipeline.
- **packages/contracts**: zod schemas for uploads, RPCs, enums, and hand-authored Supabase
  database types (see the note at the top of `database.types.ts` about regenerating these
  for real once a linked/local Supabase project is available).
- **Database schema**: profiles, user_settings, follows, blocks, activities, activity_streams,
  internal.activity_routes, activity_photos, privacy_zones, best_efforts, kudos, comments,
  notifications, push_tokens, reports — all with RLS policies, and pgTAP tests covering the
  trickiest cross-user visibility/kudos/block behavior.
- **RPCs**: `get_home_feed`, `get_profile_totals`, `search_users`, `upsert_processed_activity`,
  `get_activity_streams`, `is_username_available`, `can_view_activity`, `is_blocked`, `is_follower`.
- **Edge Functions**: `hello` (proves packages/core runs under Deno), `ingest-activity` (the
  full upload → validate → process → persist pipeline, wired to packages/core),
  `delete-account`, `process-jobs` + `send-push` (the notification queue).
- **Mobile app**: Expo Router navigation with three protected route groups (signed-out,
  onboarding, main app); native tabs (Home, Maps, Record, You); Apple/Google/email-OTP sign-in;
  encrypted session storage; the home feed with optimistic kudos and comments; activity detail;
  profile + totals; and the recording engine — a `LocationSource` interface with a real
  `ExpoLocationSource`, a deterministic `ReplaySource` for testing, a `TransistorSource` stub
  ready for the commercial SDK, the state machine from section 2 of the master plan, local
  SQLite persistence, and the upload/ingest outbox.
- **CI** (`.github/workflows/ci.yml`): lint, typecheck, `packages/core`'s tests, Edge Function
  typechecking, and — since GitHub Actions runners have Docker — the full `supabase start` /
  `db reset` / `test db` cycle, which covers the one migration this dev environment couldn't
  validate locally (see below).

### What still needs a real device or a purchased account

None of this can be done without you:
- Running the app at all — no simulator/device was available while building it. Start with
  `pnpm --filter mobile start` and a development build (`npx expo run:ios` / `run:android`,
  or an EAS development build).
- Apple/Google developer accounts, Sign in with Apple capability, Google OAuth client ID
  (`GoogleSignin.configure({ webClientId })` in a startup effect once you have one).
- A Mapbox account and public token (`EXPO_PUBLIC_MAPBOX_TOKEN`) — the Maps tab and feed map
  thumbnails no-op without one.
- The Transistor Software `react-native-background-geolocation` license (Phase 11) — until
  then, `apps/mobile/app/(app)/record.tsx` uses `ExpoLocationSource`, a real but
  background-reliability-limited fallback (see that class's doc comment).
- A real local or linked Supabase project, to regenerate `database.types.ts` for real and to
  run the `test-database` CI job / `supabase start` locally (this repo's dev environment had
  no Docker, so migrations were instead validated against a bare Postgres 16 + PostGIS + pgTAP
  instance with stand-in `auth`/`storage` schemas — see git history for that harness).

## Local development

```
pnpm install
pnpm typecheck
pnpm lint
pnpm test               # packages/core's vitest suite
```

### Mobile app

Requires `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` (from your Supabase
project's API settings) as environment variables, and optionally `EXPO_PUBLIC_MAPBOX_TOKEN`.

```
cd apps/mobile
pnpm typecheck
pnpm start               # requires a development build; Expo Go will not work
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
