-- User notes per item (PRD §6.1 "My notes"). Autosaved markdown.
alter table public.items add column user_notes text not null default '';
