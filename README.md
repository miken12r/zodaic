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
│   │       ├── takes.tsx            # Hot Takes — persona-voiced headline/blurb feed
│   │       └── profile.tsx          # Birth date → sign, follow counts, feed settings
│   ├── assets/                      # icon.png, splash.png, adaptive-icon.png — placeholders, swap for real branding
│   └── src/
│       ├── components/              # SignDetailModal, UserProfileSheet, FeedSettings
│       ├── constants/
│       │   ├── signs.ts             # The 12 ZodAIc signs (identity: name/color/symbol)
│       │   └── personas.ts          # Character-sheet data (voice/displayName/avatar) each sign's Hot Takes draw on
│       ├── lib/
│       │   ├── supabase.ts          # Supabase client
│       │   ├── api.ts               # API calls
│       │   └── signTakes.ts         # Hot Takes data layer — kept separate from api.ts, see Key Decisions
│       └── types/index.ts           # TypeScript types
└── supabase/
    ├── migrations/                  # Database schema (run in order — see Setup)
    └── functions/
        ├── _shared/                 # personas.ts (Deno mirror of the client's) + generateSignTake.ts (shared Claude-call core)
        ├── classify-content/        # Claude-powered URL → sign classifier
        ├── generate-horoscope/      # Claude-powered weekly/monthly horoscope generator
        ├── generate-portails/       # Compatibility reading across all 12 signs
        ├── generate-lens/           # "Read through [sign] eyes" article summary
        ├── extract-article/         # Readability-based extraction for reader mode
        ├── fetch-news/              # Hourly news ingestion (NewsAPI + Claude haiku), pg_cron-scheduled
        ├── generate-sign-take/      # On-demand Hot Takes generation (cache-or-generate-then-persist)
        └── generate-sign-takes-batch/ # Batch Hot Takes generation, pg_cron-scheduled every 20 min
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
   - `20260908_sign_takes.sql`
   - `20260908_sign_takes_cron.sql` — before running this one, store the service role
     key in Vault (`select vault.create_secret('<your-service-role-key>', 'service_role_key');`)
     and replace `<PROJECT_REF>` in the file with this project's actual ref; see the
     comment at the top of the file
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
supabase functions deploy generate-sign-take
supabase functions deploy generate-sign-takes-batch
```

`fetch-news` is scheduled hourly via `pg_cron`, confirmed live on the project
(`0 * * * *`) — this schedule is **not** tracked in any migration, only configured
directly on the hosted project, so it won't be reproduced by re-running this repo's
migrations alone. `generate-sign-takes-batch` runs every 20 minutes via the
`20260908_sign_takes_cron.sql` migration (properly tracked, unlike `fetch-news`'s);
its cadence and cap were sized against `fetch-news`'s observed output of 7-22
articles/hour — see the comment above `BATCH_GENERATION_LIMIT` in
`generate-sign-takes-batch/index.ts` if that volume changes significantly.

To generate a batch of Hot Takes on demand (rather than waiting for the cron), invoke
`generate-sign-takes-batch` directly:
```bash
curl -X POST "https://<PROJECT_REF>.supabase.co/functions/v1/generate-sign-takes-batch" \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" -H "Content-Type: application/json" -d '{}'
```

### 6. Build and run the development client

This project uses a custom [EAS development client](https://docs.expo.dev/development/introduction/) instead of Expo Go. Expo Go only ever supports the latest SDK version, so relying on it means the app can stop launching on your device the moment Expo ships a new SDK — a dev client we control lets us upgrade on our own schedule instead.

**One-time setup** (per developer, per device — requires an Apple Developer Program membership, or access under the `ai-for-society` org's):

```bash
cd ~/Projects/zodaic/app
npx eas login                                        # your Expo/EAS account — ask to be added to the ai-for-society org
npx eas device:create                                # registers your device for provisioning
npx eas build --profile development --platform ios   # builds the dev client in the cloud
```

Open the build page EAS gives you on your iOS device and tap Install.

**Day-to-day:**

```bash
cd ~/Projects/zodaic/app
npx expo start --dev-client
```

Scan the printed QR code with your device's camera — it opens in the installed dev client instead of Expo Go.

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
- **Custom EAS dev client over Expo Go** — Expo Go only supports the latest SDK, so it broke device testing outright the first time Expo shipped a new one. A dev client we control costs an Apple Developer Program membership and some build setup, but decouples us from Apple's/Expo's release schedule
- **Hot Takes built as its own module, not folded into Home** — the Takes tab may become the new home screen after UI iteration, so its table, edge functions, and client data layer (`signTakes.ts`, deliberately not added to `api.ts`) are kept separate from `home.tsx`'s code so it can be lifted out or promoted later without untangling
- **Shared generation core for Hot Takes** — both the on-demand and batch edge functions call one `_shared/generateSignTake.ts` rather than each duplicating the Claude call, specifically to avoid repeating this codebase's existing pattern of drifting duplicate sign-trait copies across `classify-content`/`fetch-news`/`generate-lens`. Persona data itself still has two sources of truth (client `constants/personas.ts`, edge `_shared/personas.ts`) since edge functions can't import the client's path-aliased file — kept in sync by hand, not automated
