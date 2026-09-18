-- Run with: supabase test db
-- Exercises can_view_activity() across the follow/block/visibility matrix,
-- plus kudos idempotency and the "never kudos your own activity" rule.
begin;
select plan(9);

insert into auth.users (id, email)
values
  ('11111111-1111-1111-1111-111111111111', 'alice@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'bob@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'carol@example.com');

-- Bob's activity defaults to visibility='followers'. Alice does not yet follow Bob.
insert into public.activities (id, user_id, sport_type, name, source, started_at, start_timezone)
values (
  'a1111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  'run', 'Bob''s run', 'ios', now(), 'America/New_York'
);
update public.activities set status = 'ready' where id = 'a1111111-1111-1111-1111-111111111111';

select set_config(
  'request.jwt.claims',
  json_build_object('sub', '11111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text,
  true
);
set local role authenticated;

select is(
  public.can_view_activity('a1111111-1111-1111-1111-111111111111'),
  false,
  'a non-follower cannot see a followers-only activity'
);
reset role;

-- Alice follows Bob (Bob's profile is public by default, so it's auto-accepted).
insert into public.follows (follower_id, followee_id) values
  ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');

select set_config(
  'request.jwt.claims',
  json_build_object('sub', '11111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text,
  true
);
set local role authenticated;

select is(
  public.can_view_activity('a1111111-1111-1111-1111-111111111111'),
  true,
  'an accepted follower can see a followers-only activity'
);

-- Alice can give kudos on an activity she can see, and it's idempotent by PK.
insert into public.kudos (activity_id, user_id) values ('a1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111');
select throws_ok(
  $$ insert into public.kudos (activity_id, user_id) values ('a1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111') $$,
  '23505',
  null,
  'giving kudos twice violates the primary key (idempotent by construction)'
);
reset role;

select is(
  (select kudos_count from public.activities where id = 'a1111111-1111-1111-1111-111111111111'),
  1,
  'the kudos trigger incremented activities.kudos_count exactly once'
);

-- Bob blocks Carol; Carol should lose visibility even if Bob's activity were public.
update public.activities set visibility = 'everyone' where id = 'a1111111-1111-1111-1111-111111111111';
insert into public.blocks (blocker_id, blocked_id) values
  ('22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333');

select set_config(
  'request.jwt.claims',
  json_build_object('sub', '33333333-3333-3333-3333-333333333333', 'role', 'authenticated')::text,
  true
);
set local role authenticated;

select is(
  public.can_view_activity('a1111111-1111-1111-1111-111111111111'),
  false,
  'a blocked user cannot see the activity even when visibility is everyone'
);

-- Carol cannot kudos her own... wait, Carol isn't the owner; test self-kudos separately below.
reset role;

-- Bob cannot give kudos on his own activity (blocked by the insert policy's exists() check).
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '22222222-2222-2222-2222-222222222222', 'role', 'authenticated')::text,
  true
);
set local role authenticated;

create temporary table _self_kudos_result (ok boolean);
do $$
begin
  insert into public.kudos (activity_id, user_id)
  values ('a1111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');
  insert into _self_kudos_result values (true);
exception when others then
  insert into _self_kudos_result values (false);
end;
$$;
reset role;

select is((select ok from _self_kudos_result), false, 'the owner cannot give kudos on their own activity');

-- The block also removed any follow edge between Bob and Carol (none existed, but verify the trigger runs without error).
select is(
  (select count(*)::int from public.follows where follower_id = '33333333-3333-3333-3333-333333333333' and followee_id = '22222222-2222-2222-2222-222222222222'),
  0,
  'no stray follow edge between Bob and Carol'
);

select ok(
  (select is_private is not null from public.profiles where id = '22222222-2222-2222-2222-222222222222'),
  'sanity: Bob''s profile row exists via the sign-up trigger'
);

select ok(
  (select followers_count from public.profiles where id = '22222222-2222-2222-2222-222222222222') = 1,
  'Bob''s followers_count reflects Alice''s accepted follow'
);

select * from finish();
rollback;
