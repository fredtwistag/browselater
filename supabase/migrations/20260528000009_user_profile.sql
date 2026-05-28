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
