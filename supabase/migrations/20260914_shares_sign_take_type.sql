-- Adds 'sign_take' as a shareable content_type so Hot Takes can be shared to
-- the in-app feed, alongside the existing horoscope/content_affinity/sign_reading
-- types. content_id for this type points at sign_takes.id, not content_items.id
-- (see fetchHomeFeed in src/lib/api.ts for the resulting join branching).
alter table public.shares drop constraint shares_content_type_check;
alter table public.shares add constraint shares_content_type_check
  check (content_type in ('horoscope', 'content_affinity', 'sign_reading', 'sign_take'));
