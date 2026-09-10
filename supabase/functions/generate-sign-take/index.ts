import { createClient } from 'jsr:@supabase/supabase-js@2'
import { getOrGenerateSignTake } from '../_shared/generateSignTake.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' },
    })
  }

  try {
    const { content_id, zodaic_sign_id } = await req.json()

    if (!content_id || !zodaic_sign_id) {
      return new Response(JSON.stringify({ error: 'content_id and zodaic_sign_id are required' }), { status: 400 })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: item, error } = await supabase
      .from('content_items')
      .select('title, description, characteristics')
      .eq('id', content_id)
      .single()

    if (error || !item) {
      return new Response(JSON.stringify({ error: 'content item not found' }), { status: 404 })
    }

    const result = await getOrGenerateSignTake(
      supabase,
      Deno.env.get('ANTHROPIC_API_KEY')!,
      {
        content_id,
        zodaic_sign_id,
        title: item.title,
        description: item.description,
        characteristics: item.characteristics,
      },
      'on_demand'
    )

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  } catch (err) {
    console.error('generate-sign-take error:', err)
    const message = err instanceof Error ? err.message : JSON.stringify(err)
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  }
})
