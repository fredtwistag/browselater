-- items.read_at + items.starred_at — inbox read-state and star/save
-- (Phase 4: three-pane shell)

alter table items
  add column read_at timestamptz null,
  add column starred_at timestamptz null;

create index items_user_unread_idx
  on items (user_id, created_at desc)
  where deleted_at is null and archived_at is null and read_at is null;

create index items_user_starred_idx
  on items (user_id, starred_at desc)
  where deleted_at is null and starred_at is not null;
