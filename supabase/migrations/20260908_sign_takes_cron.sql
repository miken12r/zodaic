-- Schedules generate-sign-takes-batch every 20 minutes (3x/hour), run against a
-- 15/run cap. fetch-news classifies 7-22 articles/hour (observed), so 3 runs/hour
-- gives headroom over peak hours without raising the per-run cap — idle runs cost
-- nothing (no uncovered candidates means no Claude calls), so this doesn't spend
-- more than the actual ingestion volume warrants.
--
-- IMPORTANT — one-time manual step before this migration will work:
-- the service role key is never committed here. Run this once in the Supabase SQL
-- editor first (not part of this migration, and not tracked in git):
--   select vault.create_secret('<your-service-role-key>', 'service_role_key');
-- Replace <PROJECT_REF> below with this project's actual ref before applying.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'generate-sign-takes-batch',
  '*/20 * * * *',
  $$
  select net.http_post(
    url := 'https://uesoqoaucvdqtvvmselp.supabase.co/functions/v1/generate-sign-takes-batch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
