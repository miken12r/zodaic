# ZodAIc

Find your place in the digital cosmos.

ZodAIc classifies websites and online content into 12 digital zodiac signs, generates AI-powered horoscopes for each sign, and helps users understand their affinity to digital content based on their own profile.

---

## Project Structure

```
zodaic/
├── app/                             # Expo React Native app (iOS first)
│   ├── app/                         # Expo Router screens
│   │   ├── index.tsx                # Redirects to sign-in
│   │   ├── article.tsx              # Article reader (WebView + native reader mode + sign "lens")
│   │   ├── (auth)/sign-in.tsx       # Auth screen
│   │   └── (tabs)/                  # Main tab screens
│   │       ├── home.tsx             # Feed ranked by sign compatibility
│   │       ├── discover.tsx         # Classify any URL + find people
│   │       ├── sites.tsx            # Browse/follow curated sites by sign
│   │       ├── feed.tsx             # PortAils — AI-generated compatibility reading
│   │       └── profile.tsx          # Birth date → sign, follow counts, feed settings
│   └── src/
│       ├── components/              # SignDetailModal, UserProfileSheet, FeedSettings
│       ├── constants/signs.ts       # The 12 ZodAIc signs
│       ├── lib/
│       │   ├── supabase.ts          # Supabase client
│       │   └── api.ts               # API calls
│       └── types/index.ts           # TypeScript types
└── supabase/
    ├── migrations/                  # Database schema (run in order — see Setup)
    └── functions/
        ├── classify-content/        # Claude-powered URL → sign classifier
        ├── generate-horoscope/      # Claude-powered weekly/monthly horoscope generator
        ├── generate-portails/       # Compatibility reading across all 12 signs
        ├── generate-lens/           # "Read through [sign] eyes" article summary
        ├── extract-article/         # Readability-based extraction for reader mode
        └── fetch-news/              # Hourly news ingestion (NewsAPI + Claude haiku), pg_cron-scheduled
```

---

## Setup

### 1. Install Node.js

```bash
# Install via nvm (recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.zshrc
nvm install --lts
```

### 2. Install Expo CLI & dependencies

```bash
cd ~/Projects/zodaic/app
npm install
npm install -g expo-cli
```

### 3. Set up Supabase

1. Go to [supabase.com](https://supabase.com) and create a new project
2. In the SQL editor, run each file in `supabase/migrations/` **in order**:
   - `20260812_initial_schema.sql`
   - `20260820_lens_text.sql`
   - `20260826_sites.sql`
3. Copy your project URL and anon key from Settings → API

### 4. Set up environment variables

```bash
cd ~/Projects/zodaic/app
cp .env.example .env
# Edit .env with your Supabase URL and anon key
```

### 5. Deploy Supabase Edge Functions

```bash
# Install Supabase CLI
npm install -g supabase

# Link to your project
supabase login
supabase link --project-ref YOUR_PROJECT_REF

# Set your Anthropic API key as a secret
supabase secrets set ANTHROPIC_API_KEY=your_anthropic_api_key

# Deploy functions
supabase functions deploy classify-content
supabase functions deploy generate-horoscope
supabase functions deploy generate-portails
supabase functions deploy generate-lens
supabase functions deploy extract-article
supabase functions deploy fetch-news
```

`fetch-news` is scheduled hourly via `pg_cron` (configured in the initial schema migration) rather than called from the app.

### 6. Run the app

```bash
cd ~/Projects/zodaic/app
npx expo start --ios
```

---

## The 12 ZodAIc Signs

| Sign | Digital Analog | Traditional |
|------|---------------|-------------|
| ⚡ The Catalyst | Breaking news, startups, viral trends | Aries |
| 📚 The Archive | Encyclopedias, reference, documentation | Taurus |
| 🌊 The Stream | Social media, messaging, commentary | Gemini |
| 🌙 The Sanctuary | Wellness, community, mental health | Cancer |
| ⭐ The Spotlight | Entertainment, celebrity, streaming | Leo |
| 🔬 The Analyst | Data, research, analytics, technical | Virgo |
| ⚖️ The Forum | Debate, reviews, op-eds, marketplaces | Libra |
| 🔭 The Depths | Investigative journalism, security research | Scorpio |
| 🧭 The Explorer | Education, travel, philosophy, courses | Sagittarius |
| 🏛️ The Enterprise | Business, finance, B2B, productivity | Capricorn |
| 🕸️ The Network | Open source, tech, decentralized | Aquarius |
| 🌌 The Dream | Art, music, film, spirituality | Pisces |

---

## Key Decisions

- **Expo over bare React Native** — faster iteration, easy iOS deployment, cross-platform path to Android
- **Supabase over custom backend** — auth, database, real-time, and edge functions in one; no server to manage
- **Claude API for classification** — LLM semantic understanding handles the nuanced task of mapping content to signs far better than rules-based approaches
- **Edge Functions over a separate API** — API keys stay server-side, latency is low, no extra infrastructure
