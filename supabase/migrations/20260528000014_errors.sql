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
