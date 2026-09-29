-- Restrict profile-images bucket reads to the file owner and admins.

drop policy if exists "profile images authenticated read" on storage.objects;

create policy "profile images owner admin read" on storage.objects
for select to authenticated
using (
  bucket_id = 'profile-images'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_admin()
  )
);
