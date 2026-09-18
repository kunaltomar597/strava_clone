create function public.is_username_available(check_username extensions.citext)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1 from public.profiles where username = check_username
  );
$$;

revoke all on function public.is_username_available(extensions.citext) from public;
grant execute on function public.is_username_available(extensions.citext) to authenticated;
