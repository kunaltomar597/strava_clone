-- Phase 8: the push-notification queue. pgmq and pg_cron are installed
-- here, at the point they're first used, rather than upfront in migration
-- 0001. pg_net is also required (for pg_cron to call the send-push Edge
-- Function over HTTP) and ships enabled by default on hosted Supabase
-- projects and via `supabase start` locally.
--
-- pgmq and pg_cron are both non-relocatable extensions: Postgres always
-- installs them into their own fixed schema (`pgmq`, `cron`) regardless of
-- any `with schema` clause, so we don't pass one. Because `pgmq` isn't
-- among config.toml's `api.schemas`, PostgREST — and so supabase-js's
-- `.rpc()` from an Edge Function — can't call `pgmq.*` directly; the
-- `public.pgmq_*` wrapper functions below exist only to bridge that gap,
-- each locked down to nobody (Edge Functions call them with the service
-- role, which bypasses grants).
--
-- NOTE ON LOCAL VALIDATION: unlike every earlier migration in this
-- project, this one was not run against a real Postgres instance during
-- development — pgmq/pg_cron/pg_net aren't available as apt packages in
-- this sandbox and Docker isn't available either, so there was no local
-- stack to test it against. Validate it with `supabase start` +
-- `supabase db reset` before relying on it; the pgmq/pg_cron APIs used
-- below are their documented, stable public interfaces.
create extension if not exists pgmq;
create extension if not exists pg_cron;

select pgmq.create('push_notifications');

create function public.pgmq_send(queue_name text, msg jsonb)
returns bigint
language sql
security definer
set search_path = ''
as $$
  select pgmq.send(queue_name, msg);
$$;

create function public.pgmq_read(queue_name text, vt int, qty int)
returns table (msg_id bigint, message jsonb)
language sql
security definer
set search_path = ''
as $$
  select r.msg_id, r.message from pgmq.read(queue_name, vt, qty) r;
$$;

create function public.pgmq_archive(queue_name text, msg_ids bigint[])
returns void
language sql
security definer
set search_path = ''
as $$
  select pgmq.archive(queue_name, msg_ids);
$$;

revoke all on function public.pgmq_send(text, jsonb) from public, anon, authenticated;
revoke all on function public.pgmq_read(text, int, int) from public, anon, authenticated;
revoke all on function public.pgmq_archive(text, bigint[]) from public, anon, authenticated;

create function public.notifications_after_insert_enqueue_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_wants_push boolean;
begin
  select case new.type
    when 'kudos' then push_kudos
    when 'comment' then push_comments
    when 'follow' then push_follows
    when 'follow_request' then push_follows
    when 'follow_accepted' then push_follows
    else true
  end
  into v_wants_push
  from public.user_settings
  where user_id = new.recipient_id;

  if coalesce(v_wants_push, true) then
    perform pgmq.send('push_notifications', jsonb_build_object('notification_id', new.id));
  end if;

  return new;
end;
$$;

create trigger notifications_after_insert_enqueue_push
  after insert on public.notifications
  for each row
  execute function public.notifications_after_insert_enqueue_push();

-- Every 10 seconds, ask the process-jobs Edge Function to drain the queue
-- and call send-push. The function URL and service-role key are read from
-- Vault secrets (set once via `select vault.create_secret(...)`, per
-- Supabase's documented pattern for calling Edge Functions from pg_cron),
-- never hardcoded into the migration.
select
  cron.schedule(
    'process-notification-jobs',
    '10 seconds',
    $$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/process-jobs',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
      ),
      body := '{}'::jsonb
    );
    $$
  );
