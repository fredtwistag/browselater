-- Extracted content (raw text, HTML snapshot, transcript JSON, file keys)
create table public.item_content (
  item_id uuid primary key references public.items(id) on delete cascade,
  raw_text text,
  html_snapshot_key text,           -- storage key for the saved HTML snapshot
  transcript_json jsonb,            -- YouTube transcript [{ start, dur, text }, ...]
  pdf_storage_key text,
  image_storage_key text,
  updated_at timestamptz not null default now()
);

create trigger item_content_set_updated_at
  before update on public.item_content
  for each row execute function public.set_updated_at();

alter table public.item_content enable row level security;

-- Tie RLS to items.user_id
create policy "item_content_select_own" on public.item_content
  for select using (
    exists (select 1 from public.items i where i.id = item_id and i.user_id = auth.uid())
  );
create policy "item_content_insert_own" on public.item_content
  for insert with check (
    exists (select 1 from public.items i where i.id = item_id and i.user_id = auth.uid())
  );
create policy "item_content_update_own" on public.item_content
  for update using (
    exists (select 1 from public.items i where i.id = item_id and i.user_id = auth.uid())
  );
create policy "item_content_delete_own" on public.item_content
  for delete using (
    exists (select 1 from public.items i where i.id = item_id and i.user_id = auth.uid())
  );

-- Full-text search column on raw_text (English config)
alter table public.item_content add column tsv tsvector
  generated always as (to_tsvector('english', coalesce(raw_text, ''))) stored;
create index item_content_tsv_idx on public.item_content using gin (tsv);
