import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import { PERSONA_BY_SIGN_ID } from './personas.ts'

// Shared generation core for Sign Takes — both generate-sign-take (on-demand) and
// generate-sign-takes-batch (cron) call this rather than each duplicating the Claude
// call, to avoid repeating this codebase's existing pattern of drifting duplicate
// copies of sign data across classify-content/fetch-news/generate-lens.

export interface SignTakeMeta {
  content_id: string
  zodaic_sign_id: number
  title: string
  description?: string | null
  characteristics?: string[]
}

export interface SignTakeResult {
  headline: string
  blurb: string
  cached: boolean
}

export async function getOrGenerateSignTake(
  supabase: SupabaseClient,
  anthropicApiKey: string,
  meta: SignTakeMeta,
  generationSource: 'batch' | 'on_demand'
): Promise<SignTakeResult> {
  const { data: existing } = await supabase
    .from('sign_takes')
    .select('headline, blurb')
    .eq('content_item_id', meta.content_id)
    .eq('zodaic_sign_id', meta.zodaic_sign_id)
    .maybeSingle()

  if (existing) {
    return { headline: existing.headline, blurb: existing.blurb, cached: true }
  }

  const persona = PERSONA_BY_SIGN_ID[meta.zodaic_sign_id]
  if (!persona) {
    throw new Error(`No persona for zodaic_sign_id ${meta.zodaic_sign_id}`)
  }

  const prompt = `You are writing as a character with this voice: ${persona.voice}
This character is obsessed with: ${persona.coreObsession}
Its blind spot (lean into this for comic effect — do not correct it): ${persona.blindSpot}
Its reaction temperature: ${persona.reactionTemperature}
Reference phrases in its voice (tone reference only — do not reuse verbatim): ${persona.catchphrases.join(' / ')}

A real article:
Title: ${meta.title}
Description: ${meta.description ?? 'N/A'}
Known characteristics: ${(meta.characteristics ?? []).join(', ')}

Write ONE sensationalized, lampoon-style headline and a 1-2 sentence blurb about this article, entirely in this character's voice and worldview — as if this character's own tabloid wrote it. Exaggerate its obsession and blind spot for comic effect. Do not name the character. Do not wrap the headline in quotation marks. Keep the headline under 100 characters.

Respond with valid JSON only:
{ "headline": "...", "blurb": "..." }`

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': anthropicApiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Anthropic error: ${err}`)
  }

  const anthropicData = await response.json()
  const rawText = anthropicData.content[0].text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
  const parsed = JSON.parse(rawText)

  if (!parsed.headline || !parsed.blurb) {
    throw new Error('Malformed sign-take response')
  }

  await supabase.from('sign_takes').upsert(
    {
      content_item_id: meta.content_id,
      zodaic_sign_id: meta.zodaic_sign_id,
      persona_version: persona.version,
      headline: parsed.headline,
      blurb: parsed.blurb,
      generation_source: generationSource,
      model: 'claude-haiku-4-5-20251001',
    },
    { onConflict: 'content_item_id,zodaic_sign_id' }
  )

  return { headline: parsed.headline, blurb: parsed.blurb, cached: false }
}
