-- Storage size limits + upload path ownership.
--
-- The client enforces per-purpose ceilings (avatar 2 MB, post image 5 MB,
-- manuscript 50 MB) before uploading; the `theses` bucket limbo of 10 MB is
-- raised to the free-plan manuscript ceiling so real PDFs pass. Thesis
-- uploads must land inside the uploader's own folder (`<user.id>/<file>`)
-- so one user cannot drop a file into a stranger's collection.
--
-- Run with: node scripts/run-sql.js migrations/012_storage_size_limits.sql

update storage.buckets
set file_size_limit = 52428800 -- 50 MB
where id = 'theses';

-- Replaces 011's "app storage authenticated upload": `assets` stays open to
-- any authenticated path (avatars/posts share it), while `theses` objects
-- must live in a first-level folder named after the authenticated user.
drop policy if exists "app storage authenticated upload" on storage.objects;
create policy "app storage authenticated upload"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'assets'
  or (
    bucket_id = 'theses'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
);
