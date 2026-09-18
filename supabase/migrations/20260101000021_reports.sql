create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  target_type public.report_target_type not null,
  target_id uuid not null,
  reason text not null,
  details text,
  status public.report_status not null default 'open',
  created_at timestamptz not null default now(),
  constraint reports_reason_length check (char_length(reason) between 1 and 100),
  constraint reports_details_length check (details is null or char_length(details) <= 2000)
);

create index reports_status_idx on public.reports (status, created_at);

comment on table public.reports is 'Insert-only for users; reviewed via the Supabase dashboard, per Apple 1.2''s user-generated-content requirements.';

alter table public.reports enable row level security;

create policy "reports_insert_as_self"
  on public.reports
  for insert
  to authenticated
  with check (reporter_id = (select auth.uid()));

create policy "reports_select_own"
  on public.reports
  for select
  to authenticated
  using (reporter_id = (select auth.uid()));

revoke all on public.reports from anon;
