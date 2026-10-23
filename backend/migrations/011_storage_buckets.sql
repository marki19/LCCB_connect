-- Create the two Storage buckets the client uploads to and the policies that
-- let signed-in users add their own files. Both buckets are public because
-- avatars/post images and thesis PDFs are rendered to guests.
--
-- Run with: node scripts/run-sql.js migrations/011_storage_buckets.sql

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('assets', 'assets', true, 10485760, array['image/png', 'image/jpeg', 'image/webp']),
  ('theses', 'theses', true, 10485760, array['application/pdf'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "app storage public read" on storage.objects;
create policy "app storage public read"
on storage.objects for select
to public
using (bucket_id in ('assets', 'theses'));

drop policy if exists "app storage authenticated upload" on storage.objects;
create policy "app storage authenticated upload"
on storage.objects for insert
to authenticated
with check (bucket_id in ('assets', 'theses'));

drop policy if exists "app storage owner update" on storage.objects;
create policy "app storage owner update"
on storage.objects for update
to authenticated
using (bucket_id in ('assets', 'theses') and owner = auth.uid())
with check (bucket_id in ('assets', 'theses') and owner = auth.uid());

drop policy if exists "app storage owner delete" on storage.objects;
create policy "app storage owner delete"
on storage.objects for delete
to authenticated
using (bucket_id in ('assets', 'theses') and owner = auth.uid());
