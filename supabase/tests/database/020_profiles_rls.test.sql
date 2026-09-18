-- Run with: supabase test db
-- Behavioral RLS checks for profiles + user_settings, simulating two
-- signed-in users by setting request.jwt.claims and switching to the
-- `authenticated` role, the same mechanism PostgREST uses in production.
begin;
select plan(5);

insert into auth.users (id, email)
values
  ('11111111-1111-1111-1111-111111111111', 'alice@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'bob@example.com');

select is(
  (
    select count(*)::int
    from public.profiles
    where id in ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222')
  ),
  2,
  'handle_new_user created a profile for each new auth user'
);

select is(
  (
    select count(*)::int
    from public.user_settings
    where user_id in ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222')
  ),
  2,
  'handle_new_user created a settings row for each new auth user'
);

-- --- Simulate Alice's session ---
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '11111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text,
  true
);
set local role authenticated;
update public.profiles set display_name = 'Alice A.' where id = '11111111-1111-1111-1111-111111111111';
update public.profiles set display_name = 'Hacked' where id = '22222222-2222-2222-2222-222222222222';
create temporary table _bob_settings_as_alice as
  select count(*)::int as n from public.user_settings where user_id = '22222222-2222-2222-2222-222222222222';
reset role;

select is(
  (select display_name from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  'Alice A.',
  'a user can update their own profile'
);

select is(
  (select display_name from public.profiles where id = '22222222-2222-2222-2222-222222222222'),
  'New Athlete',
  'RLS blocks updating another user''s profile, so the row is unchanged'
);

select is(
  (select n from _bob_settings_as_alice),
  0,
  'RLS hides another user''s settings row entirely, even from a plain select'
);

select * from finish();
rollback;
