-- Daily Webstrology readings, one per sign per day, generated server-side by
-- generate-portails (pre-generated each morning by the 20261112c cron migration,
-- or on demand if a sign's reading for today doesn't exist yet). Previously each
-- phone generated its own reading and cached it locally for 12 hours, so loads
-- waited on two Claude calls and no history was kept.
--
-- reading_date is the date in America/Denver, matching the 5am Mountain run.

create table public.webstrology_readings (
  id uuid default gen_random_uuid() primary key,
  zodaic_sign_id int not null references public.zodaic_signs(id),
  reading_date date not null,
  compatibility jsonb not null,
  best_advice text not null,
  avoid_advice text not null,
  model text,
  generated_at timestamptz not null default now()
);

create unique index webstrology_readings_sign_date_idx
  on public.webstrology_readings (zodaic_sign_id, reading_date);

alter table public.webstrology_readings enable row level security;
create policy "Anyone can read webstrology readings"
  on public.webstrology_readings for select using (true);

grant select on public.webstrology_readings to authenticated;
grant all on public.webstrology_readings to service_role;
