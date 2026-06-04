-- Honest signal of how much real content the summarizer had to work with.
-- `full` = real article/transcript/PDF body. `thin` = some content but not the full piece.
-- `title_only` = effectively only a headline + link (paywall, tweet stub, etc.).
create type public.source_quality as enum ('full', 'thin', 'title_only');

alter table public.item_ai add column source_quality public.source_quality;
