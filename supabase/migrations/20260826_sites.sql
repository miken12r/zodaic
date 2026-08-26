-- Sites directory
create table public.sites (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  url text not null,
  description text,
  zodaic_sign_id int references public.zodaic_signs(id),
  is_curated boolean default true,
  created_at timestamptz default now()
);
create unique index sites_url_idx on public.sites (url);
alter table public.sites enable row level security;
create policy "Anyone can read sites" on public.sites for select using (true);

-- User site follows
create table public.user_site_follows (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade,
  site_id uuid references public.sites(id) on delete cascade,
  created_at timestamptz default now(),
  unique(user_id, site_id)
);
alter table public.user_site_follows enable row level security;
create policy "Users can read own site follows" on public.user_site_follows for select using (auth.uid() = user_id);
create policy "Users can follow sites" on public.user_site_follows for insert with check (auth.uid() = user_id);
create policy "Users can unfollow sites" on public.user_site_follows for delete using (auth.uid() = user_id);

-- Seed: 4 sites per sign
insert into public.sites (name, url, description, zodaic_sign_id) values
  -- The Catalyst (1) — breaking news, startups, disruptive
  ('TechCrunch', 'https://techcrunch.com', 'Breaking news on startups, technology, and venture capital.', 1),
  ('Product Hunt', 'https://producthunt.com', 'Discover the latest products launched by makers every day.', 1),
  ('The Verge', 'https://theverge.com', 'Technology news covering gadgets, science, and culture.', 1),
  ('Fast Company', 'https://fastcompany.com', 'Business media focused on innovation and creativity.', 1),

  -- The Archive (2) — reference, documentation, established
  ('Wikipedia', 'https://wikipedia.org', 'The free encyclopedia anyone can edit, covering virtually everything.', 2),
  ('Internet Archive', 'https://archive.org', 'Digital library of websites, books, audio, and video.', 2),
  ('Stack Overflow', 'https://stackoverflow.com', 'The largest community for developers to learn and share knowledge.', 2),
  ('Britannica', 'https://britannica.com', 'Authoritative encyclopedia with expertly curated articles.', 2),

  -- The Stream (3) — social, commentary, live
  ('Reddit', 'https://reddit.com', 'The front page of the internet — communities for every interest.', 3),
  ('Hacker News', 'https://news.ycombinator.com', 'Social news site focused on computer science and entrepreneurship.', 3),
  ('Substack', 'https://substack.com', 'Independent writers publishing newsletters and podcasts.', 3),
  ('Mastodon', 'https://mastodon.social', 'Decentralized social network — federated, open, and community-run.', 3),

  -- The Sanctuary (4) — wellness, community, care
  ('Psychology Today', 'https://psychologytoday.com', 'Mental health resources, therapist finder, and expert articles.', 4),
  ('Headspace', 'https://headspace.com', 'Guided meditation and mindfulness for everyday life.', 4),
  ('The Mighty', 'https://themighty.com', 'Community platform for people facing health challenges.', 4),
  ('Verywell Mind', 'https://verywellmind.com', 'Trusted mental health and psychology information.', 4),

  -- The Spotlight (5) — entertainment, celebrity, creative
  ('IMDb', 'https://imdb.com', 'The definitive database of movies, TV shows, and the people who make them.', 5),
  ('Variety', 'https://variety.com', 'Entertainment industry news, reviews, and box office data.', 5),
  ('Pitchfork', 'https://pitchfork.com', 'Music criticism, news, and reviews with an independent voice.', 5),
  ('Letterboxd', 'https://letterboxd.com', 'Social film diary — log, rate, and review movies.', 5),

  -- The Analyst (6) — data, research, fact-checking
  ('FiveThirtyEight', 'https://fivethirtyeight.com', 'Data-driven journalism covering politics, sports, and science.', 6),
  ('Towards Data Science', 'https://towardsdatascience.com', 'Sharing concepts and ideas in data science and machine learning.', 6),
  ('Wirecutter', 'https://nytimes.com/wirecutter', 'Rigorous product reviews and buying guides backed by testing.', 6),
  ('Snopes', 'https://snopes.com', 'The definitive fact-checking resource for rumors and misinformation.', 6),

  -- The Forum (7) — debate, reviews, perspectives
  ('Metacritic', 'https://metacritic.com', 'Aggregated reviews of movies, games, music, and TV.', 7),
  ('Goodreads', 'https://goodreads.com', 'Social cataloging site for book recommendations and reviews.', 7),
  ('Quora', 'https://quora.com', 'Question-and-answer platform across every topic imaginable.', 7),
  ('Yelp', 'https://yelp.com', 'Crowdsourced local business reviews and recommendations.', 7),

  -- The Depths (8) — investigative, long-form, revelatory
  ('ProPublica', 'https://propublica.org', 'Nonprofit investigative journalism in the public interest.', 8),
  ('The Intercept', 'https://theintercept.com', 'Fearless investigative journalism on power, politics, and national security.', 8),
  ('Bellingcat', 'https://bellingcat.com', 'Open-source intelligence investigations and research collective.', 8),
  ('Longreads', 'https://longreads.com', 'Curated long-form articles and essays from across the web.', 8),

  -- The Explorer (9) — education, travel, discovery
  ('Khan Academy', 'https://khanacademy.org', 'Free world-class education for anyone, anywhere.', 9),
  ('Coursera', 'https://coursera.org', 'Online courses and degrees from top universities worldwide.', 9),
  ('National Geographic', 'https://nationalgeographic.com', 'Science, exploration, nature, and culture from around the world.', 9),
  ('The Marginalian', 'https://themarginalian.org', 'Long-running blog on art, science, literature, and philosophy.', 9),

  -- The Enterprise (10) — business, finance, professional
  ('Bloomberg', 'https://bloomberg.com', 'Global business and financial news, data, and analysis.', 10),
  ('Forbes', 'https://forbes.com', 'Business news, investing, technology, and lifestyle.', 10),
  ('Harvard Business Review', 'https://hbr.org', 'Management ideas and best practices for business leaders.', 10),
  ('LinkedIn', 'https://linkedin.com', 'Professional networking and career development platform.', 10),

  -- The Network (11) — open source, tech community, collective
  ('GitHub', 'https://github.com', 'Where the world builds software — open source and collaboration.', 11),
  ('DEV Community', 'https://dev.to', 'Community of software developers sharing and learning together.', 11),
  ('Mozilla', 'https://mozilla.org', 'Non-profit building an open, accessible internet for all.', 11),
  ('Ars Technica', 'https://arstechnica.com', 'In-depth technology journalism and analysis.', 11),

  -- The Dream (12) — art, music, film, spirituality
  ('The Paris Review', 'https://theparisreview.org', 'Literary magazine with celebrated author interviews and fiction.', 12),
  ('Bandcamp', 'https://bandcamp.com', 'Platform for independent musicians to share and sell music.', 12),
  ('Vimeo', 'https://vimeo.com', 'High-quality video hosting for creators and filmmakers.', 12),
  ('Criterion', 'https://criterion.com', 'Collection of important classic and contemporary cinema.', 12);
