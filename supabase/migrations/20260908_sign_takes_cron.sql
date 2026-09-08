-- Schedules generate-sign-takes-batch every 30 minutes. The batch cap
-- (BATCH_GENERATION_LIMIT in the function itself) is what actually bounds Anthropic
-- spend; this cadence just determines how quickly the Takes tab fills in.
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
  '*/30 * * * *',
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/generate-sign-takes-batch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
