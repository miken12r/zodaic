import { Readability } from 'npm:@mozilla/readability@0.5.0'
import { parseHTML } from 'npm:linkedom@0.18.9'

// Resolves a user-submitted URL to the page it actually points at, and pulls
// enough of that page for classification to be based on real content instead of
// guessing from the URL string. Aggregator links (e.g. apple.news) are a bare ID
// with a client-side redirect to the source story, so the URL alone says nothing.
// Every step is best-effort: if a fetch is blocked or fails, we keep whatever was
// learned so far and the caller falls back to URL-only classification.

export interface ResolvedContent {
  url: string
  title?: string
  description?: string
  siteName?: string
  text?: string
}

const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
}
const MAX_CLIENT_REDIRECTS = 3
const MAX_TEXT_CHARS = 4000

// Client-side redirects HTTP redirect-following can't see.
const CLIENT_REDIRECT_PATTERNS = [
  /redirectToUrl(?:AfterTimeout)?\(\s*["'](https?:\/\/[^"']+)["']/, // Apple News
  /<meta[^>]+http-equiv=["']?refresh["']?[^>]+content=["']\s*\d+\s*;\s*url=['"]?([^"'>\s]+)/i,
]

function normalizeUrl(input: string): string {
  const trimmed = input.trim()
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}

function findClientRedirect(html: string, baseUrl: string): string | null {
  for (const pattern of CLIENT_REDIRECT_PATTERNS) {
    const match = html.match(pattern)
    if (match) {
      try {
        const target = new URL(match[1], baseUrl).toString()
        if (/^https?:/.test(target) && target !== baseUrl) return target
      } catch { /* malformed target — ignore */ }
    }
  }
  return null
}

function meta(document: any, ...names: string[]): string | undefined {
  for (const name of names) {
    const el = document.querySelector(`meta[property="${name}"]`) ?? document.querySelector(`meta[name="${name}"]`)
    const value = el?.getAttribute('content')?.trim()
    if (value) return value
  }
  return undefined
}

function extract(html: string, url: string): Omit<ResolvedContent, 'url'> {
  const { document } = parseHTML(html)
  const found: Omit<ResolvedContent, 'url'> = {
    title: meta(document, 'og:title', 'twitter:title') ?? (document.querySelector('title')?.textContent?.trim() || undefined),
    description: meta(document, 'og:description', 'twitter:description', 'description'),
    siteName: meta(document, 'og:site_name'),
  }
  try {
    const base = document.createElement('base')
    base.setAttribute('href', url)
    document.head?.prepend(base)
    const article = new Readability(document).parse()
    const text = article?.textContent?.replace(/\s+/g, ' ').trim()
    if (text) found.text = text.slice(0, MAX_TEXT_CHARS)
    found.title ??= article?.title || undefined
    found.siteName ??= article?.siteName || undefined
  } catch { /* metadata alone is still useful */ }
  return found
}

export async function resolveContent(inputUrl: string): Promise<ResolvedContent> {
  let url = normalizeUrl(inputUrl)
  let resolved: ResolvedContent = { url }

  for (let hop = 0; hop <= MAX_CLIENT_REDIRECTS; hop++) {
    let html: string
    try {
      const res = await fetch(url, { headers: FETCH_HEADERS, redirect: 'follow', signal: AbortSignal.timeout(8000) })
      if (!res.ok || !(res.headers.get('content-type') ?? '').includes('html')) break
      url = res.url || url
      html = await res.text()
    } catch {
      break
    }

    // Keep the previous hop's metadata as a fallback — an aggregator stub page
    // often carries the real headline even when the source site blocks us.
    const page = extract(html, url)
    resolved = {
      url,
      title: page.title ?? resolved.title,
      description: page.description ?? resolved.description,
      siteName: page.siteName ?? resolved.siteName,
      text: page.text ?? resolved.text,
    }

    const next = findClientRedirect(html, url)
    if (!next) break
    url = next
    // The stub's body text is just "open in app" boilerplate; its title and
    // description are kept above in case the source page can't be fetched.
    resolved = { ...resolved, url: next, text: undefined }
  }

  return resolved
}
