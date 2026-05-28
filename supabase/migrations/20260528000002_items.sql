-- Items: one row per saved URL
create type public.content_type as enum ('article', 'youtube', 'pdf', 'image', 'generic');
create type public.item_status as enum ('pending', 'extracting', 'ready', 'failed', 'archived');

create table public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  original_url text not null,
  canonical_url text not null,
  type public.content_type not null default 'generic',
  title text,
  author text,
  published_at timestamptz,
  hero_image_url text,
  read_time_minutes int,
  status public.item_status not null default 'pending',
  error_message text,
  is_paywalled boolean not null default false,
  source_domain text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  deleted_at timestamptz
);

create unique index items_user_canonical_idx on public.items (user_id, canonical_url) where deleted_at is null;
create index items_user_created_idx on public.items (user_id, created_at desc) where deleted_at is null;
create index items_user_status_idx on public.items (user_id, status) where deleted_at is null;

create trigger items_set_updated_at
  before update on public.items
  for each row execute function public.set_updated_at();

alter table public.items enable row level security;

create policy "items_select_own" on public.items
  for select using (user_id = auth.uid());
create policy "items_insert_own" on public.items
  for insert with check (user_id = auth.uid());
create policy "items_update_own" on public.items
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "items_delete_own" on public.items
  for delete using (user_id = auth.uid());
