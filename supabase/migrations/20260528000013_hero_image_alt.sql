-- Hero image alt text for a11y (PRD §3.7).
-- Captured during article extraction (og:image:alt, twitter:image:alt, or hero <img> alt).
alter table public.items add column hero_image_alt text;
