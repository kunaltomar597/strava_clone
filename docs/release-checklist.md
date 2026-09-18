# Release checklist

Tracks the master plan's phase-by-phase "done when" criteria against what's actually in this
repo. **[CODE]** items are things more code could still finish. **[HUMAN]** items need an
account, a purchase, a physical device, or a business decision — no amount of further coding
closes them.

## Phase 0 — Foundations
- [x] pnpm monorepo, TypeScript strict, ESLint, Prettier, CI (typecheck/lint/test/Deno
      typecheck/`supabase test db`).
- [x] `packages/core` scaffolded with Vitest and three GPX fixtures.
- [x] `hello` Edge Function proves `packages/core` runs server-side.
- [ ] **[HUMAN]** Open accounts: Apple Developer Program, Google Play Console, Expo/EAS,
      Supabase (staging + production projects), Mapbox, Sentry, a Transistor trial.
- [ ] **[HUMAN]** Real app name/bundle ID decision (currently the placeholder `com.stride.app` /
      "Stride" throughout — a deliberate placeholder per the master plan, not an oversight).
- [ ] **[HUMAN]** A development build on two real phones — no simulator/device was available
      while building this, so the app has never actually been run.

## Phase 1 — Authentication and profiles
- [x] Apple/Google/email-OTP sign-in code paths, encrypted session storage, protected routing,
      onboarding (username claim + units), delete-account.
- [ ] **[HUMAN]** Configure the real providers in Supabase Auth (Apple Services ID, Google
      OAuth client), and `GoogleSignin.configure({ webClientId })` at startup once you have one.
- [ ] **[HUMAN]** Verify all three sign-in methods against a real Supabase project on a device.

## Phase 2 — App shell, design system, maps
- [x] Design tokens, core components (Button, Card, StatBlock, Avatar, TextField, EmptyState),
      native tabs.
- [ ] **[CODE]** No `@rnmapbox/maps` `<MapView>` yet — the Maps tab is a permission-primer
      placeholder (see its own doc comment). Wiring in a real map needs a Mapbox token to test
      against.
- [ ] **[HUMAN]** Mapbox account + public token (`EXPO_PUBLIC_MAPBOX_TOKEN`).

## Phase 3 — Recording engine and activity math
- [x] `packages/core`'s full pipeline (filter, Kalman smooth, auto-pause, elevation, splits,
      best efforts, polyline, privacy trimming), tested against synthetic fixtures.
- [x] `LocationSource` interface, `ReplaySource`, `ExpoLocationSource`, the state machine, local
      SQLite persistence, Record UI.
- [ ] **[HUMAN]** Field-test on a real device — nothing here has run outside `tsc`/`vitest`.

## Phase 4 — Background hardening
- [ ] **[CODE/HUMAN]** This phase is almost entirely device-dependent: the iOS background mode
      is declared in `app.config.ts`, but the "never let iOS auto-pause", vendor battery-manager
      guide, and gap-recovery UX all need real-device iteration to get right. Budget real time
      for this phase specifically — it's the master plan's own stated highest-risk area.
- [ ] **[HUMAN]** The full field-test matrix (60 min locked, incoming call, tunnel, airplane
      mode, swipe-away, force-quit, reboot mid-run) on multiple real devices, including one
      aggressive-battery-management vendor (Xiaomi/Oppo/etc).

## Phase 5 — Upload, ingest, activity detail
- [x] Schema (activities/streams/routes/photos/privacy_zones), RLS, `upsert_processed_activity`,
      `ingest-activity` Edge Function, outbox upload flow, activity detail screen with comments.
- [ ] **[CODE]** No pace/elevation charts with scrubbing yet (Victory Native) — splits are
      computed server-side (`splits_metric`/`splits_imperial` on `activities`) but not yet
      rendered as a chart in the app.
- [ ] **[HUMAN]** Verify an activity recorded in airplane mode actually syncs once back online,
      on a real device.

## Phase 6 — Social graph
- [x] Follows (with private-profile approval), blocks, reports, search, other-profile screen.
- [x] pgTAP coverage for the follow/block/visibility interaction.

## Phase 7 — Home feed, kudos, comments
- [x] `get_home_feed`, FlashList feed, optimistic kudos, comment thread, pull-to-refresh,
      infinite scroll.
- [ ] **[CODE]** No offline persisted-query cache wired up yet (TanStack Query's default
      in-memory cache only) — the master plan calls for MMKV persistence so the feed is
      readable offline.
- [ ] **[HUMAN]** Load-test the feed query against a seeded dataset of realistic size once a
      real project exists; the query plan was designed against the index but not measured.

## Phase 8 — Notifications
- [x] Queue schema (pgmq), `process-jobs` + `send-push` Edge Functions, pg_cron schedule,
      in-app list, realtime unread badge, push token registration.
- [ ] **[HUMAN]** This is the one migration not validated against a real Postgres instance in
      this dev environment (pgmq/pg_cron aren't apt-installable, no Docker available) — CI's
      `test-database` job covers it, but confirm it once against your own project too.
- [ ] **[HUMAN]** Verify actual push delivery end-to-end (needs a real device + APNs/FCM
      credentials configured in your EAS/Expo project).

## Phase 9 — Progress and records
- [x] `get_profile_totals`, You tab totals, best-efforts + PR detection/notification triggers.
- [ ] **[CODE]** No dedicated best-efforts/PR list screen yet — PRs are detected and notified,
      but there's nowhere in the app to browse your personal records list.

## Phase 10 — Native polish
- [x] Audio split cues (expo-speech), opt-in keep-screen-on, accessibility labels on stats.
- [ ] **[CODE/HUMAN]** No Live Activity / Dynamic Island (needs an Expo config plugin + a real
      device to see it), no Android persistent live-stats notification, no custom app icon or
      splash screen (still Expo's default template assets).

## Phase 11 — Hardening and release
- [x] `docs/security-review.md` (RLS coverage table, function security, storage/rate-limit
      review), draft `docs/privacy-policy-draft.md` and `docs/terms-of-service-draft.md`.
- [ ] **[HUMAN]** Have a lawyer finalize the privacy policy and terms; every `[NEEDS HUMAN]`
      marker in those two files needs an actual decision.
- [ ] **[HUMAN]** App Store privacy labels and Play Data Safety form — draft these from
      `docs/privacy-policy-draft.md` once it's finalized.
- [ ] **[HUMAN]** Foreground-service declaration + demo video for Google Play.
- [ ] **[HUMAN]** Buy the Transistor Software license; implement `TransistorSource` for real
      (currently a documented stub — see its file).
- [ ] **[HUMAN]** TestFlight / Play internal testing, the 12-tester/14-day closed test Google
      requires for new personal accounts, staged rollout.
- [ ] **[HUMAN]** A support email and a public account-deletion web page (Google Play requires
      the latter even though in-app deletion also exists).

## What would most derail an actual launch attempt

In rough order of risk, per the master plan's own "Risks" section:
1. **Phase 4 (background hardening)** — the biggest unknown, and entirely device-dependent.
2. **The Google Play 14-day closed test** — a hard calendar constraint; start it early.
3. **Mapbox Static Images billing** — `FeedMapThumbnail` already isolates this behind one
   component specifically so a switch to on-device rendering doesn't ripple, if cost becomes a
   problem at scale.
4. **The Transistor SDK not being purchased yet** — `ExpoLocationSource` is a real fallback, not
   a placeholder, but its own doc comment is explicit about the background-reliability gap it
   doesn't close.
