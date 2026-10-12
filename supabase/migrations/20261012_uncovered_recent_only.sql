-- Limit generate-sign-takes-batch to recent articles (classified in the last 3
-- days). It works oldest-first, 15 per run, with no age limit — so any bulk
-- removal of takes (e.g. deleting pre-fix lampoon takes on tragic stories,
-- 2026-10-12) would make it regenerate a backlog of stale stories for hours,
-- delaying takes for new articles and flooding the Takes tab (sorted by take
-- creation time) with old news. Older articles still get takes on demand when
-- someone opens them (generate-sign-take).
create or replace function get_uncovered_content_items(result_limit int)
returns table (
  id uuid,
  title text,
  description text,
  characteristics jsonb,
  zodaic_sign_id int
)
language sql
stable
as $$
  select ci.id, ci.title, ci.description, ci.characteristics, ci.zodaic_sign_id
  from content_items ci
  where ci.zodaic_sign_id is not null
    and ci.classified_at > now() - interval '3 days'
    and not exists (
      select 1 from sign_takes st where st.content_item_id = ci.id
    )
  order by ci.classified_at asc
  limit result_limit;
$$;
