import { createClient } from 'jsr:@supabase/supabase-js@2'
import { getOrGenerateSignTake } from '../_shared/generateSignTake.ts'

// Tunable cost cap — max Claude calls per batch run. Raise/lower this to trade
// Takes-tab freshness against Anthropic spend. fetch-news classifies 7-22 articles/hour
// (observed 2026-09-08); at the cron schedule's 3 runs/hour (see the 20260908
// sign_takes_cron migration), 15/run gives headroom over that peak without raising the
// per-run cap. Idle runs cost nothing — no uncovered candidates means no Claude calls.
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

    // Candidates: classified content_items with no sign_takes row yet, OLDEST first.
    // Oldest-first (not newest-first) matters once ingestion outpaces
    // BATCH_GENERATION_LIMIT in a given run: newest-first would let a steady stream of
    // fresh articles permanently starve out an older backlog, since the freshest N
    // always win the slots. Oldest-first guarantees the backlog drains in order instead.
    //
    // This exclusion-list approach re-lists every existing sign_takes.content_item_id on
    // every run — fine at current volume, worth switching to a left-join view if
    // sign_takes grows large.
    const { data: existingTakes } = await supabase.from('sign_takes').select('content_item_id')
    const excludeIds = (existingTakes ?? []).map((r) => r.content_item_id)

    let query = supabase
      .from('content_items')
      .select('id, title, description, characteristics, zodaic_sign_id')
      .not('zodaic_sign_id', 'is', null)
      .order('classified_at', { ascending: true })
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
