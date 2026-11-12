-- Pre-generates every sign's daily Webstrology reading at 12:00 UTC: 5am Mountain
-- Standard Time (6am during daylight saving time), so readings are ready before
-- US mornings. One request per sign, so each runs as its own edge function
-- invocation instead of 12 Claude calls inside one function's time limit.
-- generate-portails is idempotent per sign per day, so a retry or an app request
-- racing this job doesn't regenerate an existing reading.
--
-- Uses the service_role_key Vault secret created for 20260908_sign_takes_cron.sql.

select cron.schedule(
  'generate-webstrology-daily',
  '0 12 * * *',
  $$
  select net.http_post(
    url := 'https://uesoqoaucvdqtvvmselp.supabase.co/functions/v1/generate-portails',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := jsonb_build_object('zodaic_sign_id', s.id)
  )
  from generate_series(1, 12) as s(id);
  $$
);
