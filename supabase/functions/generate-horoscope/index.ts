import { createClient } from 'jsr:@supabase/supabase-js@2'
import { getOrCreateHoroscope } from '../_shared/horoscope.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' } })
  }

  try {
    const { zodaic_sign_id, period = 'weekly' } = await req.json()
    console.log('Getting horoscope for sign:', zodaic_sign_id, 'period:', period)

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) {
      console.error('ANTHROPIC_API_KEY is not set')
      return new Response(JSON.stringify({ error: 'API key not configured' }), { status: 500 })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const horoscope = await getOrCreateHoroscope(supabase, apiKey, zodaic_sign_id, period)
    return new Response(JSON.stringify(horoscope), {
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
