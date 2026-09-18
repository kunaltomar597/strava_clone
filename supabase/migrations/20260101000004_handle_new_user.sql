-- Creates a profiles + user_settings row for every new auth user. Runs as
-- SECURITY DEFINER with an empty search path and fully-qualified names, per
-- the project-wide rule that every such function pins both.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    -- Temporary, effectively-unique placeholder (20 hex chars of the new
    -- user's own UUID, well within the 30-char username limit); onboarding
    -- (Phase 1 app flow) immediately prompts the user to claim a real
    -- username via is_username_available() before they reach the rest of
    -- the app.
    'user_' || substr(replace(new.id::text, '-', ''), 1, 20),
    coalesce(new.raw_user_meta_data ->> 'full_name', 'New Athlete')
  );

  insert into public.user_settings (user_id) values (new.id);

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
