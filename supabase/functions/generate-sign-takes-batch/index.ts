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

    // Candidates: classified content_items with no sign_takes row yet, OLDEST first,
    // via the get_uncovered_content_items() SQL function (plain NOT EXISTS — see its
    // migration for why this isn't a PostgREST embedded-resource filter or a
    // client-built exclusion list; both were tried and both were silently wrong at
    // this table's size). Oldest-first matters once ingestion outpaces
    // BATCH_GENERATION_LIMIT in a given run: newest-first would let a steady stream of
    // fresh articles permanently starve out an older backlog, since the freshest N
    // always win the slots. Oldest-first guarantees the backlog drains in order instead.
    const { data: candidates, error } = await supabase
      .rpc('get_uncovered_content_items', { result_limit: BATCH_GENERATION_LIMIT })
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
    const message = err instanceof Error ? err.message : JSON.stringify(err)
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  }
})
