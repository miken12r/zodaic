import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import { getOrCreateHoroscope } from '../_shared/horoscope.ts'
import { buildWebstrologyPrompt, otherSignIds, scoreCompatibility, SIGN_NAMES, type NewsItem } from '../_shared/webstrologyPrompt.ts'

// Returns a sign's Webstrology reading for today (America/Denver), generating and
// storing it in webstrology_readings the first time it's asked for. The
// 20261112c cron migration calls this for all 12 signs at 5am Mountain, so the
// app normally just reads the stored row. Body: { zodaic_sign_id }. Older app
// builds also send horoscope_content/horoscope_themes; those are ignored, since the
// horoscope is now read server-side. Generation is once per sign per day, which
// also caps what any caller can spend.

const MODEL = 'claude-sonnet-4-6'

const denverDate = (d = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Denver' }).format(d) // YYYY-MM-DD
const denverLongDate = (d = new Date()) =>
  new Intl.DateTimeFormat('en-US', { timeZone: 'America/Denver', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(d)

const READING_COLUMNS = 'zodaic_sign_id, reading_date, compatibility, best_advice, avoid_advice, generated_at'

async function findReading(supabase: SupabaseClient, signId: number, date: string) {
  const { data, error } = await supabase
    .from('webstrology_readings')
    .select(READING_COLUMNS)
    .eq('zodaic_sign_id', signId)
    .eq('reading_date', date)
    .maybeSingle()
  if (error) throw error
  return data
}

// Recent news per sign, highest classification confidence first. Widens to 48
// hours on a thin day (GNews's free plan delays articles by 12 hours).
async function recentNews(supabase: SupabaseClient): Promise<{ hours: number; bySign: Record<number, NewsItem[]> }> {
  let bySign: Record<number, NewsItem[]> = {}
  for (const hours of [24, 48]) {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
    const { data, error } = await supabase
      .from('content_items')
      .select('zodaic_sign_id, title, url, classification_confidence')
      .eq('source', 'news')
      .gte('published_at', since)
      .order('classification_confidence', { ascending: false })
      .limit(1000)
    if (error) throw error
    bySign = {}
    for (const item of (data ?? []) as NewsItem[]) (bySign[item.zodaic_sign_id] ??= []).push(item)
    if ((data ?? []).length >= 20) return { hours, bySign }
  }
  return { hours: 48, bySign }
}

async function generateReading(supabase: SupabaseClient, apiKey: string, signId: number, today: string) {
  const horoscope = await getOrCreateHoroscope(supabase, apiKey, signId, 'weekly')
  const { hours, bySign } = await recentNews(supabase)

  const { data: yesterday } = await supabase
    .from('webstrology_readings')
    .select('compatibility, best_advice, avoid_advice')
    .eq('zodaic_sign_id', signId)
    .lt('reading_date', today)
    .order('reading_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  const prompt = buildWebstrologyPrompt({
    signId,
    longDate: denverLongDate(),
    horoscope,
    newsHours: hours,
    newsBySign: bySign,
    yesterday,
  })

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, max_tokens: 2048, messages: [{ role: 'user', content: prompt }] }),
  })
  if (!response.ok) throw new Error(`Anthropic error ${response.status}: ${await response.text()}`)

  const anthropicData = await response.json()
  const rawText = anthropicData.content[0].text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
  const result = JSON.parse(rawText)

  // Example site per sign: today's top story, or the sign's best-classified item
  // of all time if it had no news today.
  const quietSigns = otherSignIds(signId).filter((id) => !bySign[id]?.length)
  const fallbackBySign: Record<number, { title: string; url: string }> = {}
  if (quietSigns.length > 0) {
    const { data: fallbackItems } = await supabase
      .from('content_items')
      .select('zodaic_sign_id, title, url')
      .in('zodaic_sign_id', quietSigns)
      .gte('classification_confidence', 0.70)
      .order('classification_confidence', { ascending: false })
      .limit(200)
    for (const item of fallbackItems ?? []) fallbackBySign[item.zodaic_sign_id] ??= { title: item.title, url: item.url }
  }

  const compatibility = scoreCompatibility(signId, result.compatibility).map((c) => {
    const recent = bySign[c.sign_id]?.[0]
    return { ...c, example: recent ? { title: recent.title, url: recent.url } : fallbackBySign[c.sign_id] ?? null }
  })

  // A request racing the cron (or another request) for the same sign and day loses
  // to the unique index; both then return the stored winner.
  const { error: insertError } = await supabase
    .from('webstrology_readings')
    .upsert(
      { zodaic_sign_id: signId, reading_date: today, compatibility, best_advice: result.best_advice, avoid_advice: result.avoid_advice, model: MODEL },
      { onConflict: 'zodaic_sign_id,reading_date', ignoreDuplicates: true }
    )
  if (insertError) throw insertError
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' } })
  }

  try {
    const { zodaic_sign_id } = await req.json()
    const signId = Number(zodaic_sign_id)
    if (!SIGN_NAMES[signId]) {
      return new Response(JSON.stringify({ error: 'Invalid zodaic_sign_id' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      })
    }

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) return new Response(JSON.stringify({ error: 'API key not configured' }), { status: 500 })

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const today = denverDate()

    let reading = await findReading(supabase, signId, today)
    if (!reading) {
      console.log('Generating Webstrology reading for sign', signId, today)
      await generateReading(supabase, apiKey, signId, today)
      reading = await findReading(supabase, signId, today)
      if (!reading) throw new Error('Failed to store reading')
    }

    return new Response(JSON.stringify(reading), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  } catch (err) {
    console.error('Unhandled error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  }
})
