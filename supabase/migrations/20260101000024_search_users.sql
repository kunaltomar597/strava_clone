create function public.search_users(p_query text, result_limit int default 20)
returns table (
  id uuid,
  username extensions.citext,
  display_name text,
  avatar_path text,
  is_private boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.username, p.display_name, p.avatar_path, p.is_private
  from public.profiles p
  where (p.username ilike '%' || p_query || '%' or p.display_name ilike '%' || p_query || '%')
    and p.id <> (select auth.uid())
    and not public.is_blocked((select auth.uid()), p.id)
  order by extensions.similarity(p.username::text, p_query) desc, p.followers_count desc
  limit least(coalesce(result_limit, 20), 50);
$$;

revoke all on function public.search_users(text, int) from public;
grant execute on function public.search_users(text, int) to authenticated;
