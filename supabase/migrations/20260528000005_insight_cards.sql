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
