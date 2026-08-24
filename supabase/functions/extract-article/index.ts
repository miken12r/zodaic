import { Readability } from 'npm:@mozilla/readability@0.5.0'
import { parseHTML } from 'npm:linkedom@0.18.9'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' },
    })
  }

  try {
    const { url } = await req.json()
    if (!url) {
      return new Response(JSON.stringify({ error: 'url is required' }), { status: 400 })
    }

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) {
      return new Response(JSON.stringify({ error: `Fetch failed: ${res.status}` }), { status: 422 })
    }

    const html = await res.text()
    const { document } = parseHTML(html)

    // Set base URL so relative links resolve correctly
    const base = document.createElement('base')
    base.setAttribute('href', url)
    document.head?.prepend(base)

    const reader = new Readability(document)
    const article = reader.parse()

    if (!article) {
      return new Response(JSON.stringify({ error: 'Could not extract article content' }), { status: 422 })
    }

    return new Response(
      JSON.stringify({
        title: article.title ?? '',
        byline: article.byline ?? '',
        site_name: article.siteName ?? '',
        content: article.content ?? '',
        excerpt: article.excerpt ?? '',
      }),
      { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    )
  } catch (err) {
    console.error('extract-article error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  }
})
