// Prompt and scoring for daily Webstrology readings, kept free of runtime imports
// so it can be exercised outside Deno (e.g. a node check against real news)
// exactly as generate-portails uses it.
//
// Until 2026-11-12 readings were generated from the weekly horoscope alone, with
// scores pinned to element baselines ±20. For a fire sign, earth and water signs
// could never pass 55 while fire signs never fell below 65, so Best Matches never
// changed. Today's news now drives the scores (up to ±MAX_ADJUSTMENT), and
// yesterday's reading is shown to the model so it doesn't default to repeating it.

export const MAX_ADJUSTMENT = 45
const HEADLINES_PER_SIGN = 3

const ELEMENTS: Record<number, 'fire' | 'earth' | 'air' | 'water'> = {
  1: 'fire',  // Catalyst
  2: 'earth', // Archive
  3: 'air',   // Stream
  4: 'water', // Sanctuary
  5: 'fire',  // Spotlight
  6: 'earth', // Analyst
  7: 'air',   // Forum
  8: 'water', // Depths
  9: 'fire',  // Explorer
  10: 'earth',// Enterprise
  11: 'air',  // Network
  12: 'water',// Dream
}

const COMPATIBLE_ELEMENTS: Record<string, string[]> = {
  fire:  ['fire', 'air'],
  earth: ['earth', 'water'],
  air:   ['air', 'fire'],
  water: ['water', 'earth'],
}

export const SIGN_NAMES: Record<number, string> = {
  1: 'The Catalyst', 2: 'The Archive', 3: 'The Stream', 4: 'The Sanctuary',
  5: 'The Spotlight', 6: 'The Analyst', 7: 'The Forum', 8: 'The Depths',
  9: 'The Explorer', 10: 'The Enterprise', 11: 'The Network', 12: 'The Dream',
}

export function baseScore(userSignId: number, otherSignId: number): number {
  if (userSignId === otherSignId) return 0 // exclude self
  const userEl = ELEMENTS[userSignId]
  const otherEl = ELEMENTS[otherSignId]
  if (userEl === otherEl) return 85
  if (COMPATIBLE_ELEMENTS[userEl].includes(otherEl)) return 70
  return 35
}

export const otherSignIds = (signId: number) =>
  Object.keys(SIGN_NAMES).map(Number).filter((id) => id !== signId)

// Labels follow from the score so they always agree with it.
export function labelFor(score: number): string {
  if (score >= 85) return 'Excellent'
  if (score >= 70) return 'Good'
  if (score >= 50) return 'Neutral'
  if (score >= 30) return 'Challenging'
  return 'Avoid'
}

export interface NewsItem { zodaic_sign_id: number; title: string; url: string; classification_confidence: number }

export interface ReadingInput {
  signId: number
  longDate: string // e.g. "Thursday, November 12, 2026"
  horoscope: { period_start: string; period_end: string; content: string; themes: string[] }
  newsHours: number
  newsBySign: Record<number, NewsItem[]>
  yesterday?: { compatibility: { sign_id: number }[]; best_advice: string; avoid_advice: string } | null
}

export function buildWebstrologyPrompt(input: ReadingInput): string {
  const { signId, longDate, horoscope, newsHours, newsBySign, yesterday } = input
  const others = otherSignIds(signId)

  const newsLines = others.map((id) => {
    const items = newsBySign[id] ?? []
    if (items.length === 0) return `- ${SIGN_NAMES[id]} (id ${id}): no stories`
    const titles = items.slice(0, HEADLINES_PER_SIGN).map((i) => `"${i.title.slice(0, 140)}"`).join('; ')
    return `- ${SIGN_NAMES[id]} (id ${id}): ${items.length} ${items.length === 1 ? 'story' : 'stories'}, e.g. ${titles}`
  }).join('\n')

  const yesterdayBlock = yesterday
    ? `\nYesterday's reading, for comparison only: best matches were ${yesterday.compatibility.slice(0, 3).map((c) => SIGN_NAMES[c.sign_id]).join(', ')}. Seek: "${yesterday.best_advice}" Avoid: "${yesterday.avoid_advice}"\n`
    : ''

  return `You are ZodAIc, a digital oracle. Today is ${longDate}. Write today's internet guidance for a reader whose sign is ${SIGN_NAMES[signId]}: which kinds of content (the other 11 ZodAIc signs) suit them today, and which don't.

Their horoscope for this week (${horoscope.period_start} to ${horoscope.period_end}):
"${horoscope.content}"
Themes: ${horoscope.themes.join(', ')}

Today's news by sign (stories published in the last ${newsHours} hours: how many, and the top headlines):
${newsLines}

Elemental baseline scores, a weak starting point rather than the answer:
${others.map((id) => `- ${SIGN_NAMES[id]} (id ${id}): ${baseScore(signId, id)}`).join('\n')}
${yesterdayBlock}
Instructions:
1. Score each of the 11 signs from 0 to 100 for today. Start from its baseline, then let today's news and the horoscope move it substantially, by up to ${MAX_ADJUSTMENT} points either way. A sign whose stories today fit the horoscope's energy can rank first even if its element is incompatible; a usually compatible sign with thin or draining news today should fall. Rank by today's news, not yesterday's order; keep a sign where it was only if today's news genuinely puts it there.
2. Write a one-sentence reasoning for each sign in terms of today's internet content, naming a concrete story or trend from today's headlines where one fits.
3. best_advice: one sentence of at most 30 words on what to seek online today, specific to today's news rather than generic, and different from yesterday's.
4. avoid_advice: one sentence of at most 30 words on what to steer clear of today, also specific and different from yesterday's.
5. The headlines are real news. Describe them accurately and at their own level of certainty. Never name or describe a story about crime, abuse, death, disaster, war, or an allegation against a named person anywhere in this reading; if such coverage matters to the advice, refer to it only generally (e.g. "heavy crime coverage").

Respond with valid JSON only, no other text:
{
  "compatibility": [
    { "sign_id": <number>, "score": <0-100>, "reasoning": "<1 sentence>" }
  ],
  "best_advice": "<sentence>",
  "avoid_advice": "<sentence>"
}`
}

export interface ScoredSign { sign_id: number; score: number; label: string; reasoning: string }

// Keeps exactly the 11 other signs, clamps each score to its baseline ±
// MAX_ADJUSTMENT, fills any sign the model skipped with its baseline, and sorts
// best first.
export function scoreCompatibility(signId: number, modelRows: { sign_id: number; score: number; reasoning?: string }[]): ScoredSign[] {
  const others = otherSignIds(signId)
  const bySignId = new Map<number, { score: number; reasoning?: string }>()
  for (const c of modelRows ?? []) {
    if (others.includes(c.sign_id) && !bySignId.has(c.sign_id)) bySignId.set(c.sign_id, c)
  }
  return others.map((id) => {
    const base = baseScore(signId, id)
    const c = bySignId.get(id)
    const raw = typeof c?.score === 'number' ? c.score : base
    const swung = Math.min(base + MAX_ADJUSTMENT, Math.max(base - MAX_ADJUSTMENT, raw))
    const score = Math.round(Math.min(100, Math.max(0, swung)))
    return { sign_id: id, score, label: labelFor(score), reasoning: c?.reasoning ?? '' }
  }).sort((a, b) => b.score - a.score)
}
