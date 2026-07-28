insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'expense-receipts',
  'expense-receipts',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update
set file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "receipt owners can read" on storage.objects;
create policy "receipt owners can read"
on storage.objects for select to authenticated
using (
  bucket_id = 'expense-receipts'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "receipt owners can upload" on storage.objects;
create policy "receipt owners can upload"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'expense-receipts'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "receipt owners can update" on storage.objects;
create policy "receipt owners can update"
on storage.objects for update to authenticated
using (
  bucket_id = 'expense-receipts'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'expense-receipts'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "receipt owners can delete" on storage.objects;
create policy "receipt owners can delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'expense-receipts'
  and (storage.foldername(name))[1] = auth.uid()::text
);
