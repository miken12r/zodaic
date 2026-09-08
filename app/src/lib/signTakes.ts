import { supabase } from './supabase'
import { ContentItem } from '@/types'

// Data layer for the Sign Takes feature — deliberately kept out of api.ts (which
// home/sites/feed/discover all already depend on) so this feature stays liftable on
// its own while its UI is still being iterated on.

export interface SignTake {
  id: string
  content_item_id: string
  zodaic_sign_id: number
  persona_version: number
  headline: string
  blurb: string
  generation_source: 'batch' | 'on_demand'
  created_at: string
  content_item?: ContentItem
}

export async function fetchSignTakes(limit = 50): Promise<SignTake[]> {
  const { data, error } = await supabase
    .from('sign_takes')
    .select('*, content_item:content_items(*)')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data ?? []) as SignTake[]
}

export async function getOrGenerateSignTake(params: {
  content_id: string
  zodaic_sign_id: number
}): Promise<{ headline: string; blurb: string; cached: boolean }> {
  const { data, error } = await supabase.functions.invoke('generate-sign-take', { body: params })
  if (error) throw error
  return data as { headline: string; blurb: string; cached: boolean }
}
