-- Run with: supabase test db
-- Structural checks: every table in `public` must have RLS enabled with at
-- least one policy (CI fails the build otherwise, per the master plan's
-- security section).
begin;
select plan(6);

select has_extension('postgis', 'postgis is installed');
select has_extension('citext', 'citext is installed');
select has_extension('pg_trgm', 'pg_trgm is installed');

select has_table('public', 'profiles', 'profiles table exists');
select has_table('public', 'user_settings', 'user_settings table exists');

select results_eq(
  $$
    select relname::text
    from pg_class
    join pg_namespace on pg_namespace.oid = pg_class.relnamespace
    where pg_namespace.nspname = 'public'
      and pg_class.relkind = 'r'
      and not pg_class.relrowsecurity
    order by relname
  $$,
  array[]::text[],
  'every table in public has row level security enabled'
);

select * from finish();
rollback;
