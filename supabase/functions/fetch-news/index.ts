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

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}

function wordOverlap(a: string, b: string): number {
  const setA = new Set(a.toLowerCase().split(/\s+/).filter(w => w.length > 3))
  const setB = new Set(b.toLowerCase().split(/\s+/).filter(w => w.length > 3))
  if (setA.size === 0 || setB.size === 0) return 0
  const intersection = [...setA].filter(w => setB.has(w)).length
  return intersection / Math.min(setA.size, setB.size)
}

async function classifyArticle(
  apiKey: string,
  title: string,
  description: string,
  url: string
): Promise<{ zodaic_sign_id: number; classification_confidence: number; characteristics: string[]; zodaic_description: string } | null> {
  const signsDescription = SIGNS.map(s => `${s.id}. ${s.name} (${s.traditional}): ${s.traits}`).join('\n')

  const prompt = `You are ZodAIc, classifying news articles into digital zodiac signs.

The 12 ZodAIc signs:
${signsDescription}

Article title: ${title}
Article description: ${description || 'N/A'}
Article URL: ${url}

Classify this article into exactly one ZodAIc sign based on its content and source.

Respond with valid JSON only, no other text:
{
  "zodaic_sign_id": <number 1-12>,
  "classification_confidence": <float 0.0-1.0>,
  "characteristics": ["trait1", "trait2", "trait3"],
  "description": "1-2 sentence description of why this article fits this sign"
}`

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!response.ok) return null

  const data = await response.json()
  const rawText = data.content[0].text
  const text = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
  const parsed = JSON.parse(text)
  return {
    zodaic_sign_id: parsed.zodaic_sign_id,
    classification_confidence: parsed.classification_confidence,
    characteristics: parsed.characteristics,
    zodaic_description: parsed.description,
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS })
  }

  try {
    const newsApiKey = Deno.env.get('NEWSAPI_KEY')
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!newsApiKey || !anthropicKey) {
      return new Response(JSON.stringify({ error: 'Missing API keys' }), { status: 500, headers: CORS_HEADERS })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Fetch top headlines from NewsAPI
    console.log('Fetching news from NewsAPI...')
    const newsUrl = `https://newsapi.org/v2/top-headlines?language=en&pageSize=50&apiKey=${newsApiKey}`
    const newsResponse = await fetch(newsUrl)
    if (!newsResponse.ok) {
      const err = await newsResponse.text()
      console.error('NewsAPI error:', err)
      return new Response(JSON.stringify({ error: 'NewsAPI error', detail: err }), { status: 500, headers: CORS_HEADERS })
    }

    const newsData = await newsResponse.json()
    const articles = (newsData.articles ?? []).filter((a: any) => a.url && a.title && !a.title.includes('[Removed]'))
    console.log(`Fetched ${articles.length} articles`)

    // Load existing recent content_items for deduplication
    const { data: existingItems } = await supabase
      .from('content_items')
      .select('url, title, zodaic_sign_id')
      .eq('source', 'news')
      .gte('published_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

    const existingUrls = new Set((existingItems ?? []).map((i: any) => i.url))

    // Process articles
    let classified = 0
    let skipped = 0

    for (const article of articles) {
      // Skip if URL already exists
      if (existingUrls.has(article.url)) {
        skipped++
        continue
      }

      // Classify the article
      const result = await classifyArticle(anthropicKey, article.title, article.description, article.url)
      if (!result) {
        skipped++
        continue
      }

      // Deduplicate: same sign + high headline overlap with recent items
      const sameSignItems = (existingItems ?? []).filter((i: any) => i.zodaic_sign_id === result.zodaic_sign_id)
      const isDuplicate = sameSignItems.some((i: any) => wordOverlap(article.title, i.title ?? '') >= 0.6)
      if (isDuplicate) {
        skipped++
        continue
      }

      // Insert into content_items
      const { error } = await supabase.from('content_items').upsert({
        url: article.url,
        title: article.title,
        description: result.zodaic_description,
        image_url: article.urlToImage ?? null,
        source: 'news',
        published_at: article.publishedAt ?? new Date().toISOString(),
        zodaic_sign_id: result.zodaic_sign_id,
        classification_confidence: result.classification_confidence,
        characteristics: result.characteristics,
      }, { onConflict: 'url' })

      if (!error) {
        existingItems?.push({ url: article.url, title: article.title, zodaic_sign_id: result.zodaic_sign_id })
        existingUrls.add(article.url)
        classified++
      }

      // Small delay to avoid rate limits
      await new Promise(r => setTimeout(r, 300))
    }

    console.log(`Done: ${classified} classified, ${skipped} skipped`)
    return new Response(JSON.stringify({ classified, skipped }), {
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    })
  } catch (err) {
    console.error('Unhandled error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    })
  }
})
