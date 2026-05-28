-- Tags + item_tags
create type public.tag_source as enum ('ai', 'user');

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);
create index tags_user_idx on public.tags (user_id);

create table public.item_tags (
  item_id uuid not null references public.items(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  source public.tag_source not null default 'ai',
  created_at timestamptz not null default now(),
  primary key (item_id, tag_id)
);

alter table public.tags enable row level security;
alter table public.item_tags enable row level security;

create policy "tags_select_own" on public.tags for select using (user_id = auth.uid());
create policy "tags_insert_own" on public.tags for insert with check (user_id = auth.uid());
create policy "tags_update_own" on public.tags for update using (user_id = auth.uid());
create policy "tags_delete_own" on public.tags for delete using (user_id = auth.uid());

create policy "item_tags_select_own" on public.item_tags
  for select using (
    exists (select 1 from public.items i where i.id = item_id and i.user_id = auth.uid())
  );
create policy "item_tags_insert_own" on public.item_tags
  for insert with check (
    exists (select 1 from public.items i where i.id = item_id and i.user_id = auth.uid())
  );
create policy "item_tags_delete_own" on public.item_tags
  for delete using (
    exists (select 1 from public.items i where i.id = item_id and i.user_id = auth.uid())
  );
