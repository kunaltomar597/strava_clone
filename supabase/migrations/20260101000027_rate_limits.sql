-- Per-minute caps on comments, follows and reports, enforced in the
-- database so no client code path can bypass them. Upload rate limiting
-- (per user per day) is enforced in the ingest-activity Edge Function
-- instead, since an upload is a Storage write + function call, not a
-- single table insert.
create function public.enforce_comments_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (
    select count(*) from public.comments
    where user_id = new.user_id and created_at > now() - interval '1 minute'
  ) >= 30 then
    raise exception 'Too many comments; please slow down.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger comments_rate_limit
  before insert on public.comments
  for each row
  execute function public.enforce_comments_rate_limit();

create function public.enforce_follows_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (
    select count(*) from public.follows
    where follower_id = new.follower_id and created_at > now() - interval '1 minute'
  ) >= 20 then
    raise exception 'Too many follow requests; please slow down.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger follows_rate_limit
  before insert on public.follows
  for each row
  execute function public.enforce_follows_rate_limit();

create function public.enforce_reports_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (
    select count(*) from public.reports
    where reporter_id = new.reporter_id and created_at > now() - interval '1 minute'
  ) >= 5 then
    raise exception 'Too many reports; please slow down.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger reports_rate_limit
  before insert on public.reports
  for each row
  execute function public.enforce_reports_rate_limit();
