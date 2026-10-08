# ZodAIc

iOS-first Expo React Native app that classifies news/websites into 12 "digital
zodiac signs" and generates AI persona content (Hot Takes, Lens readings,
compatibility readings) via Claude. Full setup, deploy steps, and the
"Key Decisions" rationale live in `README.md` — read it before changing
architecture.

## Vision

ZodAIc is a **tool for understanding perspectives**: each persona reads the
same content through a different worldview. The 12 zodiac signs are the first
classification framework, not the point. Others (e.g. Myers-Briggs) are planned
to better qualify online content. When touching the sign model (`signs.ts`,
`personas.ts`, classification prompts, `zodaic_sign_id` columns), don't deepen
zodiac-only assumptions where a framework-agnostic shape costs little. Frame
user-facing copy around perspective-taking rather than astrology.

## Layout

- `app/` — Expo SDK 54 (New Architecture) + expo-router. Run commands from here.
- `supabase/migrations/` — schema, applied in filename order.
- `supabase/functions/` — Deno edge functions; `_shared/` holds code shared
  between them.

## Tab names ≠ file names

Tabs were renamed in the UI but not on disk. `app/app/(tabs)/_layout.tsx` is
the source of truth:

| File | Tab title |
|---|---|
| `home.tsx` | News (heading "Sign Talk") |
| `takes.tsx` | Takes (Hot Takes) |
| `sites.tsx` | Sites |
| `feed.tsx` | Webstrology (formerly PortAils) |
| `discover.tsx` | Networking (segments: People, My Feed) |
| `profile.tsx` | Profile — hidden from the tab bar (`href: null`); only reachable by tapping "Your sign: …" on News |

The project-structure section of `README.md` still uses some old names.

## Conventions

- **Supabase/API calls go in `app/src/lib/api.ts`**, except the Hot Takes data
  layer, which is deliberately kept separate in `app/src/lib/signTakes.ts`.
- **Sharing** is centralized: `attachShareContent` / `fetchUserShares` /
  `getShareRoute` in `api.ts`, card rendering in `components/ShareCard.tsx`,
  share-sheet mechanics in `hooks/useSignTakeSharing.tsx`. Reuse these rather
  than adding per-screen share logic.
- **Personas have two copies** — `app/src/constants/personas.ts` (client) and
  `supabase/functions/_shared/personas.ts` (edge). Edge functions can't import
  the client's path-aliased file, so **edit both** when changing persona data.
- **Sign-trait prompt text is duplicated** across `classify-content`,
  `fetch-news`, and `generate-lens`. Keep them consistent when changing one.
- **Claude model**: edge functions use `claude-haiku-4-5-20251001` (cheap,
  high-volume). Don't swap models without checking cost/volume (see the
  `BATCH_GENERATION_LIMIT` comment in `generate-sign-takes-batch`).
- **RLS idiom**: public-readable content tables (`sign_takes`, `shares`, …)
  allow anyone to read and only the service role to write.
- **Account deletion** relies on FK cascades from `auth.users`/`profiles`. New
  user-owned tables must `on delete cascade` from them (Apple Guideline
  5.1.1(v) requires full in-app deletion).
- Never trust a client-supplied user id in an edge function. Derive it from the
  caller's JWT, as `delete-account` does.

## Verifying changes

There is no test suite. From `app/`:

```bash
npx tsc --noEmit   # type check — should be clean
npm run lint       # expo lint
```

For UI changes, run on device with the custom dev client
(`npx expo start --dev-client`). Expo Go is not supported.

## Deploying

- Edge function: `supabase functions deploy <name>` (project is already linked).
- Migrations: add a new dated file in `supabase/migrations/`; never edit an
  applied one.
- `fetch-news`'s hourly `pg_cron` schedule exists only on the hosted project,
  not in any migration.
- Builds: `npx eas build --profile production --platform ios` then
  `npx eas submit` (build number auto-increments remotely).

## Git

- Commit and push to `main` only when explicitly asked.
- **This repo is public.** Never commit secrets, API keys, service-role keys, or
  test-account credentials.
