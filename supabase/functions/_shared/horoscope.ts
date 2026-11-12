import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'

// Shared by generate-horoscope (on demand) and generate-portails (the daily
// Webstrology job), so there is one get-or-create path for a sign's horoscope.

export type HoroscopePeriod = 'weekly' | 'monthly'

export interface Horoscope {
  id: string
  zodaic_sign_id: number
  period: HoroscopePeriod
  period_start: string
  period_end: string
  content: string
  themes: string[]
}

function getPeriodDates(period: HoroscopePeriod, now = new Date()): { start: string; end: string } {
  if (period === 'weekly') {
    const start = new Date(now)
    start.setDate(now.getDate() - now.getDay())
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] }
  }
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] }
}

async function findHoroscope(supabase: SupabaseClient, signId: number, period: HoroscopePeriod, start: string) {
  const { data, error } = await supabase
    .from('horoscopes')
    .select('*')
    .eq('zodaic_sign_id', signId)
    .eq('period', period)
    .eq('period_start', start)
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data as Horoscope | null
}

export async function getOrCreateHoroscope(
  supabase: SupabaseClient,
  apiKey: string,
  signId: number,
  period: HoroscopePeriod = 'weekly'
): Promise<Horoscope> {
  const { start, end } = getPeriodDates(period)
  const existing = await findHoroscope(supabase, signId, period, start)
  if (existing) return existing

  const { data: sign, error: signError } = await supabase
    .from('zodaic_signs')
    .select('*')
    .eq('id', signId)
    .single()
  if (signError || !sign) throw new Error('Sign not found')

  // Without the previous reading, every week came out nearly identical ("The
  // digital horizon stretches wide this week, Explorer…", Aug–Nov 2026).
  const { data: previous } = await supabase
    .from('horoscopes')
    .select('content')
    .eq('zodaic_sign_id', signId)
    .eq('period', period)
    .lt('period_start', start)
    .order('period_start', { ascending: false })
    .limit(1)
    .maybeSingle()

  const prompt = `You are ZodAIc, an AI oracle that generates digital horoscopes for types of online content.

You are generating a ${period} horoscope for: ${sign.name} (the digital equivalent of ${sign.traditional_analog})

Sign description: ${sign.description}
Sign characteristics: ${JSON.stringify(sign.characteristics)}
Period: ${start} to ${end}
${previous ? `\nThe previous ${period === 'weekly' ? 'week' : 'month'}'s horoscope, for contrast. Do not reuse its opening line, imagery, examples, or advice; this period should feel distinctly different:\n"${previous.content}"\n` : ''}
Write a ${period} horoscope for this digital sign. The horoscope should:
- Feel like a real astrological reading but applied to digital content and online experiences
- Speak directly to people who resonate with this type of content
- Reference trends in the digital landscape, not the physical world
- Be insightful, poetic, and approximately 100-150 words
- Include 3-5 thematic keywords

Respond with valid JSON only, no other text:
{
  "content": "the horoscope text",
  "themes": ["theme1", "theme2", "theme3"]
}`

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 1024, messages: [{ role: 'user', content: prompt }] }),
  })
  if (!response.ok) throw new Error(`Anthropic error: ${await response.text()}`)

  const anthropicData = await response.json()
  const rawText = anthropicData.content[0].text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
  const generated = JSON.parse(rawText)

  // Two requests can race to create the same period's horoscope; the unique index
  // (20261112a migration) makes the loser's insert a no-op, and both return the
  // winner's row.
  const { error: insertError } = await supabase
    .from('horoscopes')
    .upsert(
      { zodaic_sign_id: signId, period, period_start: start, period_end: end, content: generated.content, themes: generated.themes },
      { onConflict: 'zodaic_sign_id,period,period_start', ignoreDuplicates: true }
    )
  if (insertError) throw insertError

  const stored = await findHoroscope(supabase, signId, period, start)
  if (!stored) throw new Error('Failed to store horoscope')
  return stored
}
