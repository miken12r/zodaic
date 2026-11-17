-- Seek/Avoid search topics for Webstrology. Tapping a Seek or Avoid box opens
-- Sites → Ask a voice prefilled with the voice and search terms the reading names.
-- Shape: { "sign_id": <1-12>, "query": "<3-4 word news topic>" }, or null when the
-- model didn't give a usable one (and for readings generated before this column).

alter table public.webstrology_readings
  add column best_topic jsonb,
  add column avoid_topic jsonb;
