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
