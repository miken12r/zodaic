import { createClient } from 'jsr:@supabase/supabase-js@2'

const SIGNS: Record<number, { name: string; traits: string }> = {
  1:  { name: 'The Catalyst',   traits: 'breaking news, startups, viral trends, disruptive ideas, urgency, first-mover energy' },
  2:  { name: 'The Archive',    traits: 'authority, permanence, depth, trust, institutional knowledge, deliberate pace' },
  3:  { name: 'The Stream',     traits: 'real-time conversation, reactive, opinionated, fragmented, fast-moving, social energy' },
  4:  { name: 'The Sanctuary',  traits: 'care, vulnerability, community, emotional resonance, shared experience, belonging' },
  5:  { name: 'The Spotlight',  traits: 'performance, celebrity, audience, spectacle, entertainment, personal brand' },
  6:  { name: 'The Analyst',    traits: 'precision, data, methodology, skepticism, evidence, step-by-step rigor' },
  7:  { name: 'The Forum',      traits: 'multiple perspectives, debate, fairness, competing viewpoints, weighing evidence' },
  8:  { name: 'The Depths',     traits: 'investigation, hidden layers, systemic critique, long-form, revelation, intensity' },
  9:  { name: 'The Explorer',   traits: 'curiosity, education, discovery, broadening horizons, philosophy, cultural journey' },
  10: { name: 'The Enterprise', traits: 'ROI, outcomes, professional tone, ambition, strategic framing, results-focus' },
  11: { name: 'The Network',    traits: 'collective intelligence, open systems, innovation, community-built, decentralized' },
  12: { name: 'The Dream',      traits: 'imagination, emotion, metaphor, beauty, spiritual undertone, creative vision' },
}

function extractText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 8000)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' },
    })
  }

  try {
    const { content_id, url, zodaic_sign_id, title, description, characteristics } = await req.json()

    if (!content_id || !url || !zodaic_sign_id) {
      return new Response(JSON.stringify({ error: 'content_id, url, and zodaic_sign_id are required' }), { status: 400 })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Return cached lens if available
    const { data: existing } = await supabase
      .from('content_items')
      .select('lens_text')
      .eq('id', content_id)
      .single()

    if (existing?.lens_text) {
      let parsed: any = null
      try { parsed = JSON.parse(existing.lens_text) } catch {}
      if (parsed?.intro && parsed?.bullets) {
        return new Response(JSON.stringify({ lens_text: parsed }), {
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        })
      }
    }

    const sign = SIGNS[zodaic_sign_id]
    if (!sign) {
      return new Response(JSON.stringify({ error: 'Invalid zodaic_sign_id' }), { status: 400 })
    }

    // Try to fetch article text; fall back gracefully
    let articleText = ''
    try {
      const articleRes = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ZodAIc/1.0)' },
        signal: AbortSignal.timeout(8000),
      })
      if (articleRes.ok) {
        const html = await articleRes.text()
        articleText = extractText(html)
      }
    } catch (e) {
      console.log('Article fetch failed, using metadata only:', e)
    }

    const contentSection = articleText
      ? `Article text (extracted):\n${articleText}`
      : `Article metadata:\nTitle: ${title ?? ''}\nDescription: ${description ?? ''}`

    const prompt = `You are ZodAIc, a digital zodiac reading companion.

The article below has been classified as "${sign.name}" — a sign associated with: ${sign.traits}.

${contentSection}

Known characteristics from classification: ${Array.isArray(characteristics) ? characteristics.join(', ') : characteristics ?? ''}

Write a ZodAIc lens reading that helps the reader notice the ${sign.name} energy in how this article is written, framed, or treated — not just what it's about. Focus on tone, angle, rhetorical choices, and what the author emphasizes or omits. Be specific to this article's content, not generic. Do not mention the sign name directly.

Respond with valid JSON only:
{
  "intro": "1-2 sentence framing of the overall energy of this piece",
  "bullets": ["specific thing to notice #1", "specific thing to notice #2", "specific thing to notice #3"]
}`

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')!
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`Anthropic error: ${err}`)
    }

    const anthropicData = await response.json()
    const rawText = anthropicData.content[0].text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
    const lens = JSON.parse(rawText)

    // Cache as JSON string in DB
    await supabase
      .from('content_items')
      .update({ lens_text: JSON.stringify(lens) })
      .eq('id', content_id)

    // Return the parsed object directly — no double-encoding
    return new Response(JSON.stringify({ lens_text: lens }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  } catch (err) {
    console.error('generate-lens error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  }
})
