import { createClient } from 'jsr:@supabase/supabase-js@2'

const SIGNS = [
  { id: 1, slug: 'catalyst', name: 'The Catalyst', traditional: 'Aries', traits: 'breaking news, startups, viral trends, disruptive ideas, product launches' },
  { id: 2, slug: 'archive', name: 'The Archive', traditional: 'Taurus', traits: 'encyclopedias, reference, documentation, libraries, established institutions' },
  { id: 3, slug: 'stream', name: 'The Stream', traditional: 'Gemini', traits: 'social media, messaging, commentary, forums, live updates' },
  { id: 4, slug: 'sanctuary', name: 'The Sanctuary', traditional: 'Cancer', traits: 'wellness, community support, mental health, parenting, care' },
  { id: 5, slug: 'spotlight', name: 'The Spotlight', traditional: 'Leo', traits: 'entertainment, celebrity, streaming, fan culture, creative portfolios' },
  { id: 6, slug: 'analyst', name: 'The Analyst', traditional: 'Virgo', traits: 'data, research, analytics, technical docs, fact-checking, precision' },
  { id: 7, slug: 'forum', name: 'The Forum', traditional: 'Libra', traits: 'debate, reviews, op-eds, marketplaces, competing perspectives' },
  { id: 8, slug: 'depths', name: 'The Depths', traditional: 'Scorpio', traits: 'investigative journalism, security research, whistleblowing, long-form' },
  { id: 9, slug: 'explorer', name: 'The Explorer', traditional: 'Sagittarius', traits: 'education, travel, philosophy, online courses, cultural discovery' },
  { id: 10, slug: 'enterprise', name: 'The Enterprise', traditional: 'Capricorn', traits: 'business, finance, B2B, productivity, professional networks' },
  { id: 11, slug: 'network', name: 'The Network', traditional: 'Aquarius', traits: 'open source, tech communities, decentralized, innovation, collective projects' },
  { id: 12, slug: 'dream', name: 'The Dream', traditional: 'Pisces', traits: 'art, music, film, spirituality, creative fiction, poetry' },
]

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, content-type',
      },
    })
  }

  try {
    const { url } = await req.json()
    console.log('Classifying URL:', url)

    if (!url) {
      return new Response(JSON.stringify({ error: 'url is required' }), { status: 400 })
    }

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) {
      console.error('ANTHROPIC_API_KEY is not set')
      return new Response(JSON.stringify({ error: 'API key not configured' }), { status: 500 })
    }

    const signsDescription = SIGNS.map(s =>
      `${s.id}. ${s.name} (${s.traditional}): ${s.traits}`
    ).join('\n')

    const prompt = `You are ZodAIc, a system that classifies websites and online content into one of 12 digital zodiac signs.

The 12 ZodAIc signs are:
${signsDescription}

Analyze this URL: ${url}

Classification priority:
1. If this is a specific article or page (not a homepage), classify by the CONTENT of that specific piece — the topic, angle, and framing suggested by the URL path and your knowledge of it — not by the outlet's general identity.
2. Use the publishing outlet as a secondary signal for editorial tone and framing (e.g. an investigative piece on a tabloid vs. a broadsheet may differ).
3. If this is a homepage or domain root, classify the site's overall identity and purpose.

Respond with valid JSON only, no other text:
{
  "title": "short descriptive title for this specific content",
  "description": "2-3 sentences on what this content is about and why it fits this sign",
  "zodaic_sign_id": <number 1-12>,
  "classification_confidence": <float 0.0-1.0>,
  "characteristics": ["trait1", "trait2", "trait3"]
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
    console.log('Anthropic response received')

    const rawText = anthropicData.content[0].text
    const responseText = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
    const classification = JSON.parse(responseText)
    console.log('Classification:', classification)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data, error } = await supabase
      .from('content_items')
      .upsert({ url, ...classification }, { onConflict: 'url' })
      .select()
      .single()

    if (error) {
      console.error('Supabase error:', error)
      throw error
    }

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
