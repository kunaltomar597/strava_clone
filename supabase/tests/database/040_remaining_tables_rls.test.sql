-- Run with: supabase test db
-- Closes the pgTAP coverage gaps flagged in docs/security-review.md:
-- privacy_zones, activity_photos, comments, notifications, push_tokens,
-- reports, and best_efforts.
begin;
select plan(26);

insert into auth.users (id, email)
values
  ('11111111-1111-1111-1111-111111111111', 'alice@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'bob@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'carol@example.com');

-- Alice follows Bob (public profile, so auto-accepted).
insert into public.follows (follower_id, followee_id) values
  ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');

insert into public.activities (id, user_id, sport_type, name, source, started_at, start_timezone, visibility, status)
values (
  'a2222222-2222-2222-2222-222222222222',
  '22222222-2222-2222-2222-222222222222',
  'run', 'Bob''s run', 'ios', now(), 'America/New_York', 'followers', 'ready'
);

-- ============================= privacy_zones =============================
select set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text, true);
set local role authenticated;
insert into public.privacy_zones (user_id, label, center, radius_m)
values ('11111111-1111-1111-1111-111111111111', 'Home', extensions.st_setsrid(extensions.st_makepoint(-73.9, 40.7), 4326)::extensions.geography, 300);
reset role;

select is(
  (select count(*)::int from public.privacy_zones where user_id = '11111111-1111-1111-1111-111111111111'),
  1,
  'alice can see her own privacy zone as postgres/service role'
);

select set_config('request.jwt.claims', json_build_object('sub', '22222222-2222-2222-2222-222222222222', 'role', 'authenticated')::text, true);
set local role authenticated;
create temporary table _bob_sees_alice_zone as
  select count(*)::int as n from public.privacy_zones where user_id = '11111111-1111-1111-1111-111111111111';
reset role;

select is((select n from _bob_sees_alice_zone), 0, 'bob cannot see alice''s privacy zone');

select set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text, true);
set local role authenticated;
delete from public.privacy_zones where user_id = '11111111-1111-1111-1111-111111111111';
reset role;

select is(
  (select count(*)::int from public.privacy_zones where user_id = '11111111-1111-1111-1111-111111111111'),
  0,
  'alice can delete her own privacy zone'
);

-- ============================= activity_photos ============================
select set_config('request.jwt.claims', json_build_object('sub', '22222222-2222-2222-2222-222222222222', 'role', 'authenticated')::text, true);
set local role authenticated;
insert into public.activity_photos (id, activity_id, user_id, storage_path, width, height, blurhash)
values ('b1111111-1111-1111-1111-111111111111', 'a2222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222/a2222222-2222-2222-2222-222222222222/p1.jpg', 800, 600, 'LKO2?U%2Tw=w]~RBVZRi};RPxuwH');
reset role;

select is(
  (select count(*)::int from public.activity_photos where activity_id = 'a2222222-2222-2222-2222-222222222222'),
  1,
  'bob can add a photo to his own activity'
);

select set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text, true);
set local role authenticated;
create temporary table _alice_photo_insert_result (ok boolean);
do $$
begin
  insert into public.activity_photos (id, activity_id, user_id, storage_path, width, height, blurhash)
  values ('b2222222-2222-2222-2222-222222222222', 'a2222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111/a2222222-2222-2222-2222-222222222222/p2.jpg', 800, 600, 'LKO2?U%2Tw=w]~RBVZRi};RPxuwH');
  insert into _alice_photo_insert_result values (true);
exception when others then
  insert into _alice_photo_insert_result values (false);
end;
$$;

select is(
  (select count(*)::int from public.activity_photos where activity_id = 'a2222222-2222-2222-2222-222222222222'),
  1,
  'alice (a follower, not the owner) cannot add a photo to bob''s activity'
);

select is((select ok from _alice_photo_insert_result), false, 'the blocked photo insert reported failure');

create temporary table _alice_sees_bob_photo as
  select count(*)::int as n from public.activity_photos where activity_id = 'a2222222-2222-2222-2222-222222222222';
reset role;

select is((select n from _alice_sees_bob_photo), 1, 'alice can see bob''s photo since she can view the activity');

select set_config('request.jwt.claims', json_build_object('sub', '22222222-2222-2222-2222-222222222222', 'role', 'authenticated')::text, true);
set local role authenticated;
delete from public.activity_photos where id = 'b1111111-1111-1111-1111-111111111111';
reset role;

select is(
  (select count(*)::int from public.activity_photos where activity_id = 'a2222222-2222-2222-2222-222222222222'),
  0,
  'bob can delete his own photo'
);

-- =============================== comments =================================
select set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text, true);
set local role authenticated;
insert into public.comments (id, activity_id, user_id, body)
values ('c1111111-1111-1111-1111-111111111111', 'a2222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Nice run!');
reset role;

select is(
  (select count(*)::int from public.comments where activity_id = 'a2222222-2222-2222-2222-222222222222'),
  1,
  'alice (a follower) can comment on bob''s activity'
);

-- Alice edits her own comment body while she's still a normal, unblocked follower.
select set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text, true);
set local role authenticated;
update public.comments set body = 'Edited comment' where id = 'c1111111-1111-1111-1111-111111111111';
reset role;

select is(
  (select body from public.comments where id = 'c1111111-1111-1111-1111-111111111111'),
  'Edited comment',
  'alice can edit her own comment body'
);

select set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text, true);
set local role authenticated;
select throws_ok(
  $$ update public.comments set user_id = '22222222-2222-2222-2222-222222222222' where id = 'c1111111-1111-1111-1111-111111111111' $$,
  '42501',
  null,
  'alice cannot update any comment column except body (no column privilege)'
);
reset role;

-- Bob blocks Alice; her comment insert should now be rejected, and she loses
-- visibility into the whole activity, including her own prior comment on it
-- — blocking hides the entire interaction graph, not just new writes.
insert into public.blocks (blocker_id, blocked_id) values
  ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111');

select set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text, true);
set local role authenticated;
create temporary table _blocked_comment_result (ok boolean);
do $$
begin
  insert into public.comments (id, activity_id, user_id, body)
  values ('c2222222-2222-2222-2222-222222222222', 'a2222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Second comment');
  insert into _blocked_comment_result values (true);
exception when others then
  insert into _blocked_comment_result values (false);
end;
$$;
reset role;

select is((select ok from _blocked_comment_result), false, 'a blocked user cannot comment on the blocker''s activity');

select set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text, true);
set local role authenticated;
create temporary table _alice_sees_own_comment_after_block as
  select count(*)::int as n from public.comments where id = 'c1111111-1111-1111-1111-111111111111';
update public.comments set body = 'Attempted edit after block' where id = 'c1111111-1111-1111-1111-111111111111';
reset role;

select is(
  (select n from _alice_sees_own_comment_after_block),
  0,
  'once blocked, alice can no longer see her own prior comment on bob''s activity'
);

select is(
  (select body from public.comments where id = 'c1111111-1111-1111-1111-111111111111'),
  'Edited comment',
  'alice''s post-block update matched zero rows, so the comment body is unchanged'
);

-- Bob, the activity owner (not the comment author), can moderate-delete alice's comment.
select set_config('request.jwt.claims', json_build_object('sub', '22222222-2222-2222-2222-222222222222', 'role', 'authenticated')::text, true);
set local role authenticated;
delete from public.comments where id = 'c1111111-1111-1111-1111-111111111111';
reset role;

select is(
  (select count(*)::int from public.comments where id = 'c1111111-1111-1111-1111-111111111111'),
  0,
  'the activity owner can delete a comment they didn''t write'
);

-- ============================== notifications ==============================
select ok(
  (select count(*)::int from public.notifications where recipient_id = '22222222-2222-2222-2222-222222222222') > 0,
  'bob has at least one notification (from alice''s follow/comment above)'
);

select set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text, true);
set local role authenticated;
create temporary table _alice_sees_bob_notifications as
  select count(*)::int as n from public.notifications where recipient_id = '22222222-2222-2222-2222-222222222222';
reset role;

select is((select n from _alice_sees_bob_notifications), 0, 'alice cannot see bob''s notifications');

select set_config('request.jwt.claims', json_build_object('sub', '22222222-2222-2222-2222-222222222222', 'role', 'authenticated')::text, true);
set local role authenticated;
update public.notifications set read_at = now() where recipient_id = '22222222-2222-2222-2222-222222222222';
reset role;

select ok(
  (select bool_and(read_at is not null) from public.notifications where recipient_id = '22222222-2222-2222-2222-222222222222'),
  'bob can mark his own notifications read'
);

select set_config('request.jwt.claims', json_build_object('sub', '22222222-2222-2222-2222-222222222222', 'role', 'authenticated')::text, true);
set local role authenticated;
select throws_ok(
  $$ update public.notifications set type = 'kudos' where recipient_id = '22222222-2222-2222-2222-222222222222' $$,
  '42501',
  null,
  'bob cannot update any notification column except read_at'
);
reset role;

-- ================================ push_tokens ==============================
select set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text, true);
set local role authenticated;
insert into public.push_tokens (user_id, token, platform) values
  ('11111111-1111-1111-1111-111111111111', 'ExponentPushToken[alice]', 'ios');
reset role;

select set_config('request.jwt.claims', json_build_object('sub', '22222222-2222-2222-2222-222222222222', 'role', 'authenticated')::text, true);
set local role authenticated;
create temporary table _bob_sees_alice_token as
  select count(*)::int as n from public.push_tokens where user_id = '11111111-1111-1111-1111-111111111111';
reset role;

select is((select n from _bob_sees_alice_token), 0, 'bob cannot see alice''s push token');

select is(
  (select count(*)::int from public.push_tokens where user_id = '11111111-1111-1111-1111-111111111111'),
  1,
  'alice''s push token exists (checked as postgres/service role)'
);

-- =================================== reports ================================
select set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text, true);
set local role authenticated;
insert into public.reports (reporter_id, target_type, target_id, reason) values
  ('11111111-1111-1111-1111-111111111111', 'activity', 'a2222222-2222-2222-2222-222222222222', 'spam');
reset role;

select set_config('request.jwt.claims', json_build_object('sub', '22222222-2222-2222-2222-222222222222', 'role', 'authenticated')::text, true);
set local role authenticated;
create temporary table _bob_sees_alice_report as
  select count(*)::int as n from public.reports where reporter_id = '11111111-1111-1111-1111-111111111111';
reset role;

select is((select n from _bob_sees_alice_report), 0, 'bob cannot see alice''s report');

select is(
  (select count(*)::int from public.reports where reporter_id = '11111111-1111-1111-1111-111111111111'),
  1,
  'alice''s report exists (checked as postgres/service role)'
);

-- ================================ best_efforts ===============================
-- Rows are normally written only by upsert_processed_activity() under the
-- service role; inserting directly as postgres here simulates that.
insert into public.best_efforts (activity_id, user_id, effort_key, elapsed_time_s, start_idx, end_idx)
values ('a2222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', '1k', 240, 0, 100);

-- Carol follows Bob so she has a legitimate, unblocked follower view of his
-- activity (Alice, used elsewhere in this file, is blocked by Bob by this
-- point, so she's no longer a useful "a follower can see" positive case).
insert into public.follows (follower_id, followee_id) values
  ('33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222');

select set_config('request.jwt.claims', json_build_object('sub', '33333333-3333-3333-3333-333333333333', 'role', 'authenticated')::text, true);
set local role authenticated;
create temporary table _carol_sees_best_effort as
  select count(*)::int as n from public.best_efforts where activity_id = 'a2222222-2222-2222-2222-222222222222';
reset role;

select is((select n from _carol_sees_best_effort), 1, 'carol (a follower) can see bob''s best effort');

select set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text, true);
set local role authenticated;
create temporary table _alice_sees_best_effort as
  select count(*)::int as n from public.best_efforts where activity_id = 'a2222222-2222-2222-2222-222222222222';
reset role;

select is((select n from _alice_sees_best_effort), 0, 'alice (blocked by bob) cannot see bob''s best effort');

select set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text, true);
set local role authenticated;
create temporary table _alice_best_effort_insert_result (ok boolean);
do $$
begin
  insert into public.best_efforts (activity_id, user_id, effort_key, elapsed_time_s, start_idx, end_idx)
  values ('a2222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', '5k', 1200, 0, 500);
  insert into _alice_best_effort_insert_result values (true);
exception when others then
  insert into _alice_best_effort_insert_result values (false);
end;
$$;
reset role;

select is(
  (select ok from _alice_best_effort_insert_result),
  false,
  'no client can insert into best_efforts directly (service-role-only table)'
);

select * from finish();
rollback;
