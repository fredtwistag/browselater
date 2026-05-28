-- Storage buckets for artifacts. RLS via storage.objects policies.
insert into storage.buckets (id, name, public) values
  ('html-snapshots', 'html-snapshots', false),
  ('pdfs', 'pdfs', false),
  ('images', 'images', false)
on conflict (id) do nothing;

-- Owner-only access. We store objects under prefix `{user_id}/...`.
create policy "storage_select_own"
  on storage.objects for select
  using (bucket_id in ('html-snapshots', 'pdfs', 'images')
         and (storage.foldername(name))[1] = auth.uid()::text);

create policy "storage_insert_own"
  on storage.objects for insert
  with check (bucket_id in ('html-snapshots', 'pdfs', 'images')
              and (storage.foldername(name))[1] = auth.uid()::text);

create policy "storage_update_own"
  on storage.objects for update
  using (bucket_id in ('html-snapshots', 'pdfs', 'images')
         and (storage.foldername(name))[1] = auth.uid()::text);

create policy "storage_delete_own"
  on storage.objects for delete
  using (bucket_id in ('html-snapshots', 'pdfs', 'images')
         and (storage.foldername(name))[1] = auth.uid()::text);
