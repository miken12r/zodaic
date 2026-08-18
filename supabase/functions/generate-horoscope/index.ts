import { createClient } from 'jsr:@supabase/supabase-js@2'

function getPeriodDates(period: 'weekly' | 'monthly'): { start: string; end: string } {
  const now = new Date()
  if (period === 'weekly') {
    const day = now.getDay()
    const start = new Date(now)
    start.setDate(now.getDate() - day)
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    }
  } else {
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' } })
  }

  try {
    const { zodaic_sign_id, period = 'weekly' } = await req.json()
    console.log('Generating horoscope for sign:', zodaic_sign_id, 'period:', period)

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) {
      console.error('ANTHROPIC_API_KEY is not set')
      return new Response(JSON.stringify({ error: 'API key not configured' }), { status: 500 })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: sign, error: signError } = await supabase
      .from('zodaic_signs')
      .select('*')
      .eq('id', zodaic_sign_id)
      .single()

    if (signError || !sign) throw new Error('Sign not found')

    const { start, end } = getPeriodDates(period)

    const { data: existing } = await supabase
      .from('horoscopes')
      .select('*')
      .eq('zodaic_sign_id', zodaic_sign_id)
      .eq('period', period)
      .eq('period_start', start)
      .single()

    if (existing) {
      console.log('Returning existing horoscope')
      return new Response(JSON.stringify(existing), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      })
    }

    const prompt = `You are ZodAIc, an AI oracle that generates digital horoscopes for types of online content.

You are generating a ${period} horoscope for: ${sign.name} (the digital equivalent of ${sign.traditional_analog})

Sign description: ${sign.description}
Sign characteristics: ${JSON.stringify(sign.characteristics)}
Period: ${start} to ${end}

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
        max_tokens: 1024,
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
    const generated = JSON.parse(responseText)
    console.log('Generated horoscope themes:', generated.themes)

    const { data, error } = await supabase
      .from('horoscopes')
      .insert({
        zodaic_sign_id,
        period,
        period_start: start,
        period_end: end,
        content: generated.content,
        themes: generated.themes,
      })
      .select()
      .single()

    if (error) throw error

    return new Response(JSON.stringify(data), {
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
