-- avatars: owner-scoped writes, readable by everyone
drop policy if exists "avatars read" on storage.objects;
create policy "avatars read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'avatars');

drop policy if exists "avatars insert own folder" on storage.objects;
create policy "avatars insert own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars update own folder" on storage.objects;
create policy "avatars update own folder" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars delete own folder" on storage.objects;
create policy "avatars delete own folder" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- qr-files: fully owner-scoped
drop policy if exists "qr files read own folder" on storage.objects;
create policy "qr files read own folder" on storage.objects
  for select to authenticated
  using (bucket_id = 'qr-files' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "qr files insert own folder" on storage.objects;
create policy "qr files insert own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'qr-files' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "qr files update own folder" on storage.objects;
create policy "qr files update own folder" on storage.objects
  for update to authenticated
  using (bucket_id = 'qr-files' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'qr-files' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "qr files delete own folder" on storage.objects;
create policy "qr files delete own folder" on storage.objects
  for delete to authenticated
  using (bucket_id = 'qr-files' and (storage.foldername(name))[1] = auth.uid()::text);