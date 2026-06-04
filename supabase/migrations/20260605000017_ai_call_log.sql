-- ai_call_log: per-call token telemetry for the AI layer.
-- Captures Anthropic's cache_creation / cache_read counters so the impact of
-- prompt caching is measurable directly. Single-user app, but kept user-scoped
-- + RLS for future-proofing.

create table public.ai_call_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  call text not null,                       -- "summary" | "insights" | "chat" | "query_rewrite" | ...
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cache_creation_tokens integer not null default 0,
  cache_read_tokens integer not null default 0,
  item_id uuid references public.items(id) on delete set null,
  created_at timestamptz not null default now()
);

create index ai_call_log_user_created_idx on public.ai_call_log (user_id, created_at desc);
create index ai_call_log_call_idx on public.ai_call_log (call, created_at desc);

alter table public.ai_call_log enable row level security;

create policy "ai_call_log_select_own" on public.ai_call_log
  for select using (user_id = auth.uid());
