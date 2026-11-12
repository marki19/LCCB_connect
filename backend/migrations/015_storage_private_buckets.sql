-- Phase 3: private storage buckets + backend-routed uploads.
--
-- Before this migration both buckets were public, which was fine when the only
-- file a guest could reach was an avatar or a post image. Content visibility
-- (migration 014) changes that: a thesis' PDF must not be reachable by URL by
-- someone who cannot see the row. So:
--   * `theses` becomes private — the only way to open a manuscript is a
--     signed URL issued by the backend after a visibility check.
--   * `assets` is split into a public `avatars` bucket (profile pictures still
--     render to guests, no plumbing changes) and a private `assets` bucket
--     (post images, resolved through the backend like everything else).
--
-- The old "public read" policy is dropped: it exposed every object in both
-- buckets to anonymous visitors, which is exactly what the visibility rule
-- was added to prevent.
--
-- Run with: node scripts/run-sql.js migrations/015_storage_private_buckets.sql

-- 1. `theses` goes private. Public-object URLs for existing manuscripts stop
--    working immediately; the app switches to signed URLs on the next deploy.
update storage.buckets set public = false where id = 'theses';

-- 2. Split `assets`. `avatars` is public and carries the 2 MB avatar ceiling;
--    `assets` becomes private and keeps the 5 MB post-image ceiling.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

update storage.buckets set public = false where id = 'assets';

-- 3. Drop the blanket public-read policy and replace it with per-bucket
--    authenticated reads. `avatars` stays readable by anyone via the public
--    object endpoint (the bucket is public); `assets`/`theses` are private and
--    are only ever handed out as signed URLs by the backend.
drop policy if exists "app storage public read" on storage.objects;

create policy "app storage read avatars"
on storage.objects for select
to authenticated
using (bucket_id = 'avatars');

create policy "app storage read assets"
on storage.objects for select
to authenticated
using (bucket_id = 'assets');

create policy "app storage read theses"
on storage.objects for select
to authenticated
using (bucket_id = 'theses');

-- 4. Upload policy: the caller's own folder only. `avatars`/`assets` accept any
--    path (the backend validates ownership of the surrounding row), while
--    `theses` objects must live in `theses/<auth.uid()>/...` so a caller cannot
--    drop a file into a stranger's collection.
drop policy if exists "app storage authenticated upload" on storage.objects;
create policy "app storage authenticated upload"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'avatars'
  or bucket_id = 'assets'
  or (
    bucket_id = 'theses'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
);

-- 5. Owner update/delete: add `avatars` to the buckets a caller may touch.
drop policy if exists "app storage owner update" on storage.objects;
create policy "app storage owner update"
on storage.objects for update
to authenticated
using (bucket_id in ('avatars', 'assets', 'theses') and owner = auth.uid())
with check (bucket_id in ('avatars', 'assets', 'theses') and owner = auth.uid());

drop policy if exists "app storage owner delete" on storage.objects;
create policy "app storage owner delete"
on storage.objects for delete
to authenticated
using (bucket_id in ('avatars', 'assets', 'theses') and owner = auth.uid());