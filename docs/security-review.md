# Security review (Phase 11)

This is a working checklist against the master plan's security section, not a substitute for
an actual audit. Items marked **[NEEDS HUMAN]** cannot be completed by code alone.

## Row Level Security coverage

Every table in `public` has RLS enabled with at least one policy — enforced by
`supabase/tests/database/010_extensions_and_schema.test.sql`, which fails CI if a table is
added without it. Table-by-table:

| Table | Policies | pgTAP coverage |
|---|---|---|
| `profiles` | select (any authenticated), update (own, column-limited) | `020_profiles_rls.test.sql`: cross-user update blocked |
| `user_settings` | select/update (own only) | `020_profiles_rls.test.sql`: cross-user select returns nothing |
| `follows` | select (accepted or party), insert (self, not blocked), update (followee only), delete (either party) | `030_activities_rls.test.sql`: follow/accept flow |
| `blocks` | select/insert/delete (blocker only) | `030_activities_rls.test.sql`: block hides activity |
| `activities` | select via `can_view_activity()`, update (owner, column-limited), delete (owner) | `030_activities_rls.test.sql`: followers-only visibility, block override |
| `activity_streams` | no policy grants access — reachable only via `get_activity_streams()` | Structural only; **[NEEDS HUMAN]** add a test asserting the privacy window is honored for a non-owner |
| `internal.activity_routes` | no policy grants access; outside `public` so PostgREST can't reach it regardless | Structural only |
| `activity_photos` | select via `can_view_activity()`, insert/delete (owner) | `040_remaining_tables_rls.test.sql`: owner insert/delete, non-owner insert blocked, follower can view |
| `privacy_zones` | all (owner only) | `040_remaining_tables_rls.test.sql`: owner CRUD, cross-user select returns nothing |
| `best_efforts` | select via `can_view_activity()` | `040_remaining_tables_rls.test.sql`: follower can see, blocked user cannot, direct client insert rejected |
| `kudos` | select via `can_view_activity()`, insert (self, viewable, not own activity), delete (own) | `030_activities_rls.test.sql`: idempotent insert, self-kudos blocked |
| `comments` | select via `can_view_activity()`, insert (self, not blocked by activity owner), update (own, body only), delete (own or activity owner) | `040_remaining_tables_rls.test.sql`: follower insert, own-body edit, column-privilege limit, blocked insert rejected, block removes visibility of a user's own prior comment, owner moderate-delete |
| `notifications` | select/update (recipient only, update limited to `read_at`) | `040_remaining_tables_rls.test.sql`: recipient-only select, `read_at`-only update, column-privilege limit |
| `push_tokens` | all (owner only) | `040_remaining_tables_rls.test.sql`: cross-user select returns nothing |
| `reports` | insert (self), select (own) | `040_remaining_tables_rls.test.sql`: cross-user select returns nothing |

All tables flagged above as previously uncovered now have pgTAP coverage in
`040_remaining_tables_rls.test.sql`, including the blocking-removes-visibility interaction for
`comments` and `best_efforts` (blocking hides a user's entire prior interaction history on an
activity, not just future writes — confirmed against `can_view_activity()`'s intended
semantics, not a gap).

## Function security

- Every `SECURITY DEFINER` function sets `search_path = ''` and uses fully-qualified names
  (`public.foo`, `extensions.bar`) — grep the migrations for `security definer` to re-verify
  after any future change; a missing `set search_path` on a SECURITY DEFINER function is a
  classic privilege-escalation bug in Postgres.
- `EXECUTE` is revoked from `public`/`anon` on every function and re-granted only to
  `authenticated` (or nobody, for service-role-only functions like `upsert_processed_activity`
  and the `pgmq_*` wrappers).

## Storage

- `avatars`: public read, owner-scoped write, 2MB limit, image MIME types only.
- `activity-raw`: private, owner-scoped write, **no read policy at all** for
  `authenticated`/`anon` — only the service role (which bypasses RLS) reads it back. 5MB limit.
- `activity-photos`: private, read mirrors `can_view_activity()` via the path's embedded
  activity ID, owner-scoped write/delete, 10MB limit, image MIME types only.

## Rate limits

Comments (30/min), follows (20/min), and reports (5/min) are capped by database triggers
(`20260101000027_rate_limits.sql`), so no client code path can bypass them. Upload rate
limiting (20 activities/day) is enforced in `ingest-activity` itself, not the database, since an
upload is a Storage write plus a function call rather than a single table insert.

## What's **[NEEDS HUMAN]**

- Run the Supabase security and performance advisors against a real project once one exists —
  this repo's migrations were validated against a bare Postgres instance, which doesn't run
  Supabase's own linters.
- Rotate the Supabase service-role key and the Expo push access token at least once on staging
  before launch, to rehearse the runbook the master plan calls for. Write down the actual steps
  once you've done it once (this file intentionally doesn't invent a runbook it hasn't tested).
- Confirm the `anon` role truly has no table access on your live project (a `revoke all ... from
  anon` per table is in every migration, but double-check the live project's default grants
  match, since Supabase's own default privileges can differ by project template/version).
- Decide the account age minimum (16 recommended in the master plan) and implement whatever age
  gate that requires in onboarding — not yet built.
