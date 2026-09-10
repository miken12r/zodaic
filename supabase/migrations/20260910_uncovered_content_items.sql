-- Explicit NOT EXISTS query for generate-sign-takes-batch, exposed as an RPC.
-- Replaces a PostgREST embedded-resource "sign_takes!left(id) + is.null" filter that
-- looked correct but wasn't: filtering an embed's column filters which rows appear
-- *inside* the embedded array, not whether the parent row has zero matches at all —
-- since real ids are never null, the embedded array was always empty regardless of
-- whether a match existed, so the "uncovered" filter silently matched everything.
-- A plain NOT EXISTS has no such ambiguity.
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
    and not exists (
      select 1 from sign_takes st where st.content_item_id = ci.id
    )
  order by ci.classified_at asc
  limit result_limit;
$$;
