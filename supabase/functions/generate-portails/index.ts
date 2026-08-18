import { createClient } from 'jsr:@supabase/supabase-js@2'

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

function baseScore(userSignId: number, otherSignId: number): number {
  if (userSignId === otherSignId) return 0 // exclude self
  const userEl = ELEMENTS[userSignId]
  const otherEl = ELEMENTS[otherSignId]
  if (userEl === otherEl) return 85
  if (COMPATIBLE_ELEMENTS[userEl].includes(otherEl)) return 70
  return 35
}

const SIGN_NAMES: Record<number, string> = {
  1: 'The Catalyst', 2: 'The Archive', 3: 'The Stream', 4: 'The Sanctuary',
  5: 'The Spotlight', 6: 'The Analyst', 7: 'The Forum', 8: 'The Depths',
  9: 'The Explorer', 10: 'The Enterprise', 11: 'The Network', 12: 'The Dream',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' } })
  }

  try {
    const { zodaic_sign_id, horoscope_content, horoscope_themes } = await req.json()
    console.log('Generating PortAils for sign:', zodaic_sign_id)

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) return new Response(JSON.stringify({ error: 'API key not configured' }), { status: 500 })

    const otherSigns = Object.keys(SIGN_NAMES)
      .map(Number)
      .filter((id) => id !== zodaic_sign_id)

    const baseScores = otherSigns.map((id) => ({
      sign_id: id,
      sign_name: SIGN_NAMES[id],
      base_score: baseScore(zodaic_sign_id, id),
    }))

    const prompt = `You are ZodAIc, a digital oracle. Your job is to analyze a user's current horoscope and adjust sign compatibility scores based on what the horoscope reveals about their energy today.

The user's sign is: ${SIGN_NAMES[zodaic_sign_id]}

Their current weekly horoscope:
"${horoscope_content}"

Horoscope themes: ${horoscope_themes.join(', ')}

Here are the 11 other ZodAIc signs with their elemental baseline compatibility scores (0-100):
${baseScores.map((s) => `- ${s.sign_name} (id: ${s.sign_id}): base score ${s.base_score}`).join('\n')}

Instructions:
1. Read the horoscope carefully for any signals about what type of content or energy will serve the user well or poorly today. Look for explicit mentions (e.g. "seek innovation", "avoid noise") and implicit themes.
2. Adjust each sign's score by -20 to +20 based on alignment with the horoscope's energy.
3. Write a short 1-sentence reasoning for each sign explaining the adjusted score in terms of internet content.
4. Write one sentence of overall "best advice" for navigating the internet today.
5. Write one sentence of "avoid advice" for what types of content to steer clear of.

Respond with valid JSON only, no other text:
{
  "compatibility": [
    { "sign_id": <number>, "score": <0-100>, "label": "<Excellent|Good|Neutral|Challenging|Avoid>", "reasoning": "<1 sentence>" }
  ],
  "best_advice": "<sentence>",
  "avoid_advice": "<sentence>"
}`

    console.log('Calling Anthropic API...')
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('Anthropic API error:', response.status, errText)
      return new Response(JSON.stringify({ error: 'Anthropic API error', detail: errText }), { status: 500 })
    }

    const anthropicData = await response.json()
    const rawText = anthropicData.content[0].text
    const responseText = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
    const result = JSON.parse(responseText)

    // Sort by score descending
    result.compatibility.sort((a: any, b: any) => b.score - a.score)

    // Fetch top example site for each sign from content_items
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const signIds = result.compatibility.map((c: any) => c.sign_id)
    const { data: contentItems } = await supabase
      .from('content_items')
      .select('zodaic_sign_id, title, url, classification_confidence')
      .in('zodaic_sign_id', signIds)
      .gte('classification_confidence', 0.70)
      .order('classification_confidence', { ascending: false })

    const exampleBySign: Record<number, { title: string; url: string }> = {}
    for (const item of (contentItems ?? [])) {
      if (!exampleBySign[item.zodaic_sign_id]) {
        exampleBySign[item.zodaic_sign_id] = { title: item.title, url: item.url }
      }
    }

    result.compatibility = result.compatibility.map((c: any) => ({
      ...c,
      example: exampleBySign[c.sign_id] ?? null,
    }))

    console.log('PortAils generated successfully')
    return new Response(JSON.stringify(result), {
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
