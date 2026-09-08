import { createClient } from 'jsr:@supabase/supabase-js@2'
import { getOrGenerateSignTake } from '../_shared/generateSignTake.ts'

// Tunable cost cap — max Claude calls per batch run. Raise/lower this to trade
// Takes-tab freshness against Anthropic spend. Start conservative; retune once real
// ingestion volume from fetch-news is observed.
const BATCH_GENERATION_LIMIT = 15

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' },
    })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')!

    // Candidates: classified content_items with no sign_takes row yet, freshest first.
    // This exclusion-list approach re-lists every existing sign_takes.content_item_id on
    // every run — fine at current volume, worth switching to a left-join view if
    // sign_takes grows large.
    const { data: existingTakes } = await supabase.from('sign_takes').select('content_item_id')
    const excludeIds = (existingTakes ?? []).map((r) => r.content_item_id)

    let query = supabase
      .from('content_items')
      .select('id, title, description, characteristics, zodaic_sign_id')
      .not('zodaic_sign_id', 'is', null)
      .order('classified_at', { ascending: false })
      .limit(BATCH_GENERATION_LIMIT)

    if (excludeIds.length > 0) {
      query = query.not('id', 'in', `(${excludeIds.join(',')})`)
    }

    const { data: candidates, error } = await query
    if (error) throw error

    let generated = 0
    let errors = 0

    for (const item of candidates ?? []) {
      try {
        await getOrGenerateSignTake(
          supabase,
          anthropicKey,
          {
            content_id: item.id,
            zodaic_sign_id: item.zodaic_sign_id,
            title: item.title,
            description: item.description,
            characteristics: item.characteristics,
          },
          'batch'
        )
        generated++
      } catch (e) {
        console.error('sign-take generation failed for', item.id, e)
        errors++
      }
      await new Promise((r) => setTimeout(r, 300))
    }

    return new Response(JSON.stringify({ generated, errors, candidates: (candidates ?? []).length }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  } catch (err) {
    console.error('generate-sign-takes-batch error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  }
})
