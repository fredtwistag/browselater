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
