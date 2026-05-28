-- AI outputs per item, versioned. PRD §6.4 — re-runs preserve history.
create type public.context_key as enum (
  'personal',
  'family',
  'wealth',
  'health',
  'twistag.ops',
  'twistag.sales',
  'twistag.devex',
  'twistag.innovation',
  'twistag.marketing'
);

create table public.item_ai (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id) on delete cascade,
  version int not null default 1,
  at_a_glance_md text,
  summary_md text,
  takeaways_md text,
  primary_context public.context_key,
  model text,
  created_at timestamptz not null default now(),
  unique (item_id, version)
);

create index item_ai_item_version_idx on public.item_ai (item_id, version desc);

alter table public.item_ai enable row level security;

create policy "item_ai_select_own" on public.item_ai
  for select using (
    exists (select 1 from public.items i where i.id = item_id and i.user_id = auth.uid())
  );
create policy "item_ai_insert_own" on public.item_ai
  for insert with check (
    exists (select 1 from public.items i where i.id = item_id and i.user_id = auth.uid())
  );
create policy "item_ai_update_own" on public.item_ai
  for update using (
    exists (select 1 from public.items i where i.id = item_id and i.user_id = auth.uid())
  );
create policy "item_ai_delete_own" on public.item_ai
  for delete using (
    exists (select 1 from public.items i where i.id = item_id and i.user_id = auth.uid())
  );
