-- BrowseLater — all migrations concatenated (PRD §9.5).
-- Paste this entire file into Supabase → SQL Editor → New query → Run.
-- Idempotent-ish: re-runs will fail on duplicate type/table creation; only run once on a fresh DB.

-- ============================================================
-- 20260528000001_extensions.sql
-- ============================================================
-- Enable extensions used across the schema
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";
create extension if not exists "vector";

-- Trigger helper: keep updated_at fresh
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- 20260528000002_items.sql
-- ============================================================
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

-- ============================================================
-- 20260528000003_item_content.sql
-- ============================================================
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

-- ============================================================
-- 20260528000004_item_ai.sql
-- ============================================================
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

-- ============================================================
-- 20260528000005_insight_cards.sql
-- ============================================================
-- Personalized insight cards (PRD §6.3)
create type public.confidence_level as enum ('low', 'medium', 'high');
create type public.insight_feedback as enum ('up', 'down');

create table public.insight_cards (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id) on delete cascade,
  version int not null default 1,
  context public.context_key not null,
  headline text not null,
  body_md text not null,
  suggested_actions_md text,
  confidence public.confidence_level not null default 'medium',
  user_feedback public.insight_feedback,
  created_at timestamptz not null default now()
);

create index insight_cards_item_version_idx on public.insight_cards (item_id, version desc);
create index insight_cards_context_idx on public.insight_cards (context);

alter table public.insight_cards enable row level security;

create policy "insight_cards_select_own" on public.insight_cards
  for select using (
    exists (select 1 from public.items i where i.id = item_id and i.user_id = auth.uid())
  );
create policy "insight_cards_insert_own" on public.insight_cards
  for insert with check (
    exists (select 1 from public.items i where i.id = item_id and i.user_id = auth.uid())
  );
create policy "insight_cards_update_own" on public.insight_cards
  for update using (
    exists (select 1 from public.items i where i.id = item_id and i.user_id = auth.uid())
  );
create policy "insight_cards_delete_own" on public.insight_cards
  for delete using (
    exists (select 1 from public.items i where i.id = item_id and i.user_id = auth.uid())
  );

-- ============================================================
-- 20260528000006_tags.sql
-- ============================================================
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

-- ============================================================
-- 20260528000007_embeddings.sql
-- ============================================================
-- pgvector embeddings, 1024-dim (Voyage voyage-3 default).
-- If you swap embedding models, adjust the dimension and re-index.
create table public.embeddings (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  chunk_index int not null,
  chunk_text text not null,
  tokens int,
  embedding vector(1024) not null,
  created_at timestamptz not null default now(),
  unique (item_id, chunk_index)
);

create index embeddings_user_idx on public.embeddings (user_id);
-- IVFFlat index for ANN cosine similarity. Tune `lists` for corpus size (PRD §9.3 chunking implies hundreds–thousands of vectors initially).
create index embeddings_ivfflat_idx on public.embeddings using ivfflat (embedding vector_cosine_ops) with (lists = 100);

alter table public.embeddings enable row level security;

create policy "embeddings_select_own" on public.embeddings
  for select using (user_id = auth.uid());
create policy "embeddings_insert_own" on public.embeddings
  for insert with check (user_id = auth.uid());
create policy "embeddings_delete_own" on public.embeddings
  for delete using (user_id = auth.uid());

-- RPC for vector search filtered by user
create or replace function public.match_embeddings(
  query_embedding vector(1024),
  match_count int default 8,
  user_id_filter uuid default null
)
returns table (
  id uuid,
  item_id uuid,
  chunk_index int,
  chunk_text text,
  similarity float
)
language sql stable
security invoker
as $$
  select
    e.id,
    e.item_id,
    e.chunk_index,
    e.chunk_text,
    1 - (e.embedding <=> query_embedding) as similarity
  from public.embeddings e
  where (user_id_filter is null or e.user_id = user_id_filter)
  order by e.embedding <=> query_embedding
  limit match_count;
$$;

-- ============================================================
-- 20260528000008_chat_messages.sql
-- ============================================================
-- Chat messages, grouped by conversation_id
create type public.chat_role as enum ('user', 'assistant', 'system');

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid not null,
  role public.chat_role not null,
  content text not null,
  sources uuid[],  -- array of item ids cited
  created_at timestamptz not null default now()
);

create index chat_messages_user_conv_idx on public.chat_messages (user_id, conversation_id, created_at);

alter table public.chat_messages enable row level security;

create policy "chat_messages_select_own" on public.chat_messages
  for select using (user_id = auth.uid());
create policy "chat_messages_insert_own" on public.chat_messages
  for insert with check (user_id = auth.uid());
create policy "chat_messages_delete_own" on public.chat_messages
  for delete using (user_id = auth.uid());

-- ============================================================
-- 20260528000009_user_profile.sql
-- ============================================================
-- Personalization profile (PRD §6.3). Versioned: keep history so old AI runs are reproducible.
-- Latest version per user = max(version).
create table public.user_profile (
  user_id uuid not null references auth.users(id) on delete cascade,
  version int not null default 1,
  profile_md text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, version)
);

create index user_profile_latest_idx on public.user_profile (user_id, version desc);

alter table public.user_profile enable row level security;

create policy "user_profile_select_own" on public.user_profile
  for select using (user_id = auth.uid());
create policy "user_profile_insert_own" on public.user_profile
  for insert with check (user_id = auth.uid());

-- Helper view: latest profile per user
create or replace view public.user_profile_latest as
  select distinct on (user_id) user_id, version, profile_md, created_at
  from public.user_profile
  order by user_id, version desc;

-- ============================================================
-- 20260528000010_events.sql
-- ============================================================
-- App events. No 3rd-party analytics (CLAUDE.md). Log to our own table.
create table public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  event_name text not null,
  payload jsonb,
  created_at timestamptz not null default now()
);

create index events_user_created_idx on public.events (user_id, created_at desc);
create index events_name_idx on public.events (event_name);

alter table public.events enable row level security;

-- Only the owning user can read their own events; inserts go via service role (server-side).
create policy "events_select_own" on public.events
  for select using (user_id = auth.uid());

-- ============================================================
-- 20260528000011_storage.sql
-- ============================================================
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

-- ============================================================
-- 20260528000012_item_notes.sql
-- ============================================================
-- User notes per item (PRD §6.1 "My notes"). Autosaved markdown.
alter table public.items add column user_notes text not null default '';

-- ============================================================
-- 20260528000013_hero_image_alt.sql
-- ============================================================
-- Hero image alt text for a11y (PRD §3.7).
-- Captured during article extraction (og:image:alt, twitter:image:alt, or hero <img> alt).
alter table public.items add column hero_image_alt text;

-- ============================================================
-- 20260528000014_errors.sql
-- ============================================================
-- Errors table for Sentry-free error reporting (PRD §3.9).
-- We capture unhandled API/Server-Action exceptions + worker failures.
create table public.errors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  source text not null,            -- e.g. "api.save", "worker.extract", "ai.summary"
  message text not null,
  stack text,
  context jsonb,
  created_at timestamptz not null default now()
);

create index errors_created_idx on public.errors (created_at desc);
create index errors_source_idx on public.errors (source);
create index errors_user_idx on public.errors (user_id, created_at desc);

alter table public.errors enable row level security;

-- Owner-only read; inserts go via the service role.
create policy "errors_select_own" on public.errors
  for select using (user_id = auth.uid() or user_id is null);

