-- ZodAIc Initial Schema

-- Profiles (extends Supabase auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique,
  birth_date date,
  traditional_sign text,
  primary_zodaic_sign_id int,
  created_at timestamptz default now()
);
alter table public.profiles enable row level security;
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);

-- Auto-create profile on sign-up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$ language plpgsql security definer;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ZodAIc Signs (seeded, read-only for users)
create table public.zodaic_signs (
  id serial primary key,
  name text not null,
  slug text unique not null,
  traditional_analog text not null,
  tagline text,
  description text,
  characteristics jsonb default '[]',
  element text check (element in ('fire', 'earth', 'air', 'water')),
  symbol text,
  color text,
  created_at timestamptz default now()
);
alter table public.zodaic_signs enable row level security;
create policy "Anyone can read signs" on public.zodaic_signs for select using (true);

-- Seed the 12 ZodAIc signs
insert into public.zodaic_signs (name, slug, traditional_analog, tagline, description, characteristics, element, symbol, color) values
  ('The Catalyst', 'catalyst', 'Aries', 'First. Loudest. Always moving.', 'Pioneering content that ignites movements — breaking news, startups, viral trends, and disruptive ideas that arrive before the world is ready.', '["breaking news","startups","viral trends","product launches","manifestos"]', 'fire', '⚡', '#FF4136'),
  ('The Archive', 'archive', 'Taurus', 'Built to last. Worth trusting.', 'Enduring, authoritative content — encyclopedias, reference sites, established institutions, and repositories whose value only grows with time.', '["encyclopedias","documentation","reference","libraries","historical records"]', 'earth', '📚', '#2ECC40'),
  ('The Stream', 'stream', 'Gemini', 'Always talking. Always changing.', 'Fast-moving, conversational content — social feeds, messaging platforms, commentary, and threads that exist in the moment and evolve by the hour.', '["social media","messaging","forums","commentary","live updates"]', 'air', '🌊', '#7FDBFF'),
  ('The Sanctuary', 'sanctuary', 'Cancer', 'Where people come to heal and belong.', 'Nurturing, community-driven content — support groups, wellness platforms, parenting communities, and spaces built around care and shared vulnerability.', '["wellness","community support","mental health","parenting","forums"]', 'water', '🌙', '#B10DC9'),
  ('The Spotlight', 'spotlight', 'Leo', 'See me. Watch me. Love me.', 'Entertainment, celebrity, and creative expression — platforms built for performance, fandom, and the kind of content that demands an audience.', '["entertainment","celebrity","streaming","fan culture","creative portfolios"]', 'fire', '⭐', '#FF851B'),
  ('The Analyst', 'analyst', 'Virgo', 'Precise. Detailed. Always right.', 'Data-driven, methodical content — research papers, analytics tools, technical documentation, and platforms that value accuracy above all else.', '["data","research","analytics","technical docs","fact-checking"]', 'earth', '🔬', '#01FF70'),
  ('The Forum', 'forum', 'Libra', 'Every side. Every voice. You decide.', 'Balanced debate and marketplace-of-ideas content — op-eds, discussion boards, review platforms, and sites where competing perspectives coexist.', '["debate","reviews","op-eds","marketplaces","polling"]', 'air', '⚖️', '#F012BE'),
  ('The Depths', 'depths', 'Scorpio', 'Dig deeper. The surface lies.', 'Investigative, layered content — long-form journalism, whistleblower platforms, security research, and anything that rewards those willing to look further.', '["investigative journalism","security research","whistleblowing","deep dives","archives"]', 'water', '🔭', '#85144b'),
  ('The Explorer', 'explorer', 'Sagittarius', 'Knowledge is the only destination.', 'Expansive, curiosity-driven content — online courses, travel platforms, philosophy, and anything that expands your world beyond the familiar.', '["education","travel","philosophy","online courses","cultural discovery"]', 'fire', '🧭', '#FF4136'),
  ('The Enterprise', 'enterprise', 'Capricorn', 'Results over everything.', 'Professional, business-oriented content — finance platforms, B2B tools, productivity suites, and professional networks where ROI is the language.', '["business","finance","B2B tools","productivity","professional networks"]', 'earth', '🏛️', '#AAAAAA'),
  ('The Network', 'network', 'Aquarius', 'Open. Connected. Ahead of its time.', 'Innovation and collective intelligence content — open source, tech communities, decentralized platforms, and anything built by the many for the many.', '["open source","tech communities","decentralized","innovation","collective projects"]', 'air', '🕸️', '#0074D9'),
  ('The Dream', 'dream', 'Pisces', 'Where imagination lives.', 'Art, music, film, and spiritual content — platforms that dissolve the boundary between creator and dreamer, and exist to move you.', '["art","music","film","spirituality","creative fiction","poetry"]', 'water', '🌌', '#001F3F');

-- Content items (classified URLs)
create table public.content_items (
  id uuid default gen_random_uuid() primary key,
  url text not null,
  title text,
  description text,
  zodaic_sign_id int references public.zodaic_signs(id),
  classification_confidence float default 0,
  characteristics jsonb default '[]',
  classified_at timestamptz default now(),
  created_at timestamptz default now()
);
create unique index content_items_url_idx on public.content_items (url);
alter table public.content_items enable row level security;
create policy "Anyone can read content items" on public.content_items for select using (true);
create policy "Service role can insert content items" on public.content_items for insert with check (true);

-- Horoscopes
create table public.horoscopes (
  id uuid default gen_random_uuid() primary key,
  zodaic_sign_id int references public.zodaic_signs(id),
  period text check (period in ('weekly', 'monthly')),
  period_start date not null,
  period_end date not null,
  content text not null,
  themes jsonb default '[]',
  generated_at timestamptz default now()
);
alter table public.horoscopes enable row level security;
create policy "Anyone can read horoscopes" on public.horoscopes for select using (true);

-- User sign affinities
create table public.user_sign_affinities (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  zodaic_sign_id int references public.zodaic_signs(id),
  affinity_score float check (affinity_score >= 0 and affinity_score <= 1),
  calculated_at timestamptz default now(),
  unique(user_id, zodaic_sign_id)
);
alter table public.user_sign_affinities enable row level security;
create policy "Users can read own affinities" on public.user_sign_affinities for select using (auth.uid() = user_id);

-- Social: follows
create table public.follows (
  follower_id uuid references public.profiles(id) on delete cascade,
  following_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (follower_id, following_id)
);
alter table public.follows enable row level security;
create policy "Users manage own follows" on public.follows for all using (auth.uid() = follower_id);
create policy "Anyone can see follows" on public.follows for select using (true);

-- Social: shares
create table public.shares (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  content_type text check (content_type in ('horoscope', 'content_affinity', 'sign_reading')),
  content_id uuid not null,
  message text,
  created_at timestamptz default now()
);
alter table public.shares enable row level security;
create policy "Users can create shares" on public.shares for insert with check (auth.uid() = user_id);
create policy "Anyone can read shares" on public.shares for select using (true);
create policy "Users can delete own shares" on public.shares for delete using (auth.uid() = user_id);
