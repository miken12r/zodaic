-- Log of "Ask <persona> about <topic>" requests (ask-persona edge function).
-- Exists mainly to enforce per-user and global daily limits on a feature that
-- spends money per call (Claude web search), and doubles as a record of what
-- users ask — future input for story seeding (Sticky Stories).
create table public.persona_asks (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  zodaic_sign_id int not null references public.zodaic_signs(id),
  question text not null check (char_length(question) between 1 and 200),
  -- normal: lampoon as usual; sensitive: tragedy/death etc., voices stay
  -- respectful; declined: not answered (see ask-persona for criteria)
  tone text check (tone in ('normal', 'sensitive', 'declined')),
  result_count int,
  created_at timestamptz default now()
);

create index persona_asks_user_day_idx on public.persona_asks (user_id, created_at desc);
create index persona_asks_created_idx on public.persona_asks (created_at desc);

-- Users may read their own asks; only the edge function (service role) writes.
alter table public.persona_asks enable row level security;
create policy "Users can read own asks" on public.persona_asks
  for select using (auth.uid() = user_id);
