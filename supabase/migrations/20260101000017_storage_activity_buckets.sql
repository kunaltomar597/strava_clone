insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('activity-raw', 'activity-raw', false, 5242880, array['application/gzip', 'application/x-gzip']),
  ('activity-photos', 'activity-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- activity-raw: {user_id}/{activity_id}.json.gz. Owners can write (and
-- overwrite, for a retried upload); only the service role ever reads it
-- back, so there is deliberately no select policy for authenticated/anon.
create policy "activity_raw_owner_insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'activity-raw'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "activity_raw_owner_update"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'activity-raw'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- activity-photos: {user_id}/{activity_id}/{photo_id}.jpg. Read access
-- mirrors can_view_activity() on the activity_id embedded in the path, so
-- a signed URL only succeeds for someone who could see the activity anyway.
create policy "activity_photos_bucket_select"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'activity-photos'
    and public.can_view_activity(((storage.foldername(name))[2])::uuid)
  );

create policy "activity_photos_bucket_insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'activity-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "activity_photos_bucket_delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'activity-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
