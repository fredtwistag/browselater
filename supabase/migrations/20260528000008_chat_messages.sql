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
