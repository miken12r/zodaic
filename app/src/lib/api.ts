import { supabase } from './supabase'
import { ContentItem, Horoscope, UserSignAffinity, Share } from '@/types'

// Classify a URL into a ZodAIc sign via Supabase Edge Function
export async function classifyContent(url: string): Promise<ContentItem> {
  const { data, error } = await supabase.functions.invoke('classify-content', {
    body: { url },
  })
  if (error) throw error
  return data as ContentItem
}

// Generate a horoscope for a sign via Supabase Edge Function
export async function generateHoroscope(
  zodaicSignId: number,
  period: 'weekly' | 'monthly'
): Promise<Horoscope> {
  const { data, error } = await supabase.functions.invoke('generate-horoscope', {
    body: { zodaic_sign_id: zodaicSignId, period },
  })
  if (error) throw error
  return data as Horoscope
}

// Fetch the current horoscope for a sign
export async function fetchHoroscope(
  zodaicSignId: number,
  period: 'weekly' | 'monthly' = 'weekly'
): Promise<Horoscope | null> {
  const today = new Date().toISOString().split('T')[0]
  const { data, error } = await supabase
    .from('horoscopes')
    .select('*, zodaic_sign:zodaic_signs(*)')
    .eq('zodaic_sign_id', zodaicSignId)
    .eq('period', period)
    .lte('period_start', today)
    .gte('period_end', today)
    .single()

  if (error) return null
  return data as Horoscope
}

// Fetch user's affinity scores for all signs
export async function fetchUserAffinities(userId: string): Promise<UserSignAffinity[]> {
  const { data, error } = await supabase
    .from('user_sign_affinities')
    .select('*, zodaic_sign:zodaic_signs(*)')
    .eq('user_id', userId)
    .order('affinity_score', { ascending: false })

  if (error) throw error
  return data as UserSignAffinity[]
}

// Fetch social feed (shares from followed users)
export async function fetchFeed(userId: string): Promise<Share[]> {
  // First get the list of followed user IDs
  const { data: follows } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', userId)

  if (!follows || follows.length === 0) return []

  const followingIds = follows.map((f) => f.following_id)

  const { data, error } = await supabase
    .from('shares')
    .select('*')
    .in('user_id', followingIds)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) throw error
  if (!data || data.length === 0) return []

  const userIds = [...new Set(data.map((s) => s.user_id))]
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, display_name')
    .in('id', userIds)

  const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]))
  return data.map((s) => ({ ...s, profile: profileMap[s.user_id] ?? null })) as Share[]
}

export interface PortAilsCompatibility {
  sign_id: number
  score: number
  label: string
  reasoning: string
  example: { title: string; url: string } | null
}

export interface PortAilsResult {
  compatibility: PortAilsCompatibility[]
  best_advice: string
  avoid_advice: string
}

// Generate PortAils compatibility reading
export async function generatePortails(
  zodaicSignId: number,
  horoscopeContent: string,
  horoscopeThemes: string[]
): Promise<PortAilsResult> {
  const { data, error } = await supabase.functions.invoke('generate-portails', {
    body: { zodaic_sign_id: zodaicSignId, horoscope_content: horoscopeContent, horoscope_themes: horoscopeThemes },
  })
  if (error) throw error
  return data as PortAilsResult
}

const ELEMENT_MAP: Record<number, string> = {
  1: 'fire', 2: 'earth', 3: 'air', 4: 'water',
  5: 'fire', 6: 'earth', 7: 'air', 8: 'water',
  9: 'fire', 10: 'earth', 11: 'air', 12: 'water',
}
const COMPATIBLE: Record<string, string[]> = {
  fire: ['fire', 'air'], earth: ['earth', 'water'],
  air: ['air', 'fire'], water: ['water', 'earth'],
}

function elementalScore(userSignId: number, itemSignId: number): number {
  const userEl = ELEMENT_MAP[userSignId]
  const itemEl = ELEMENT_MAP[itemSignId]
  if (!userEl || !itemEl) return 50
  if (userEl === itemEl) return 85
  if (COMPATIBLE[userEl]?.includes(itemEl)) return 70
  return 35
}

export type FeedItem =
  | { type: 'news'; item: ContentItem; score: number }
  | { type: 'share'; share: Share & { content_item?: ContentItem }; score: number }

export async function fetchHomeFeed(
  userId: string,
  primarySignId: number,
  compatibilityScores?: Record<number, number>
): Promise<FeedItem[]> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const [{ data: newsItems }, followData] = await Promise.all([
    supabase
      .from('content_items')
      .select('*')
      .eq('source', 'news')
      .gte('classified_at', since)
      .order('classified_at', { ascending: false })
      .limit(50),
    supabase.from('follows').select('following_id').eq('follower_id', userId),
  ])

  const followingIds = (followData.data ?? []).map((f) => f.following_id)
  let shareItems: (Share & { content_item?: ContentItem })[] = []

  if (followingIds.length > 0) {
    const { data: shares } = await supabase
      .from('shares')
      .select('*')
      .in('user_id', followingIds)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(20)

    if (shares && shares.length > 0) {
      const contentIds = shares.map((s) => s.content_id)
      const { data: contentItems } = await supabase
        .from('content_items')
        .select('*')
        .in('id', contentIds)

      const profileIds = [...new Set(shares.map((s) => s.user_id))]
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, display_name')
        .in('id', profileIds)

      const contentMap = Object.fromEntries((contentItems ?? []).map((c) => [c.id, c]))
      const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]))
      shareItems = shares.map((s) => ({
        ...s,
        content_item: contentMap[s.content_id],
        profile: profileMap[s.user_id] ?? null,
      }))
    }
  }

  const getScore = (signId: number) =>
    compatibilityScores?.[signId] ?? elementalScore(primarySignId, signId)

  const newsFeed: FeedItem[] = (newsItems ?? []).map((item) => ({
    type: 'news',
    item: item as ContentItem,
    score: getScore(item.zodaic_sign_id),
  }))

  const shareFeed: FeedItem[] = shareItems.map((share) => ({
    type: 'share',
    share,
    score: share.content_item ? getScore(share.content_item.zodaic_sign_id) + 10 : 50,
  }))

  return [...newsFeed, ...shareFeed].sort((a, b) => b.score - a.score)
}

// Fetch a single content item by ID
export async function fetchContentItem(id: string): Promise<ContentItem | null> {
  const { data, error } = await supabase
    .from('content_items')
    .select('*')
    .eq('id', id)
    .single()
  if (error) return null
  return data as ContentItem
}

// Fetch top URLs for a sign with high confidence
export async function fetchTopUrlsForSign(signId: number, minConfidence = 0.70, limit = 10) {
  const { data, error } = await supabase
    .from('content_items')
    .select('id, url, title, description, classification_confidence, zodaic_sign_id')
    .eq('zodaic_sign_id', signId)
    .gte('classification_confidence', minConfidence)
    .order('classification_confidence', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data
}

// Fetch follower/following counts for a user
export async function fetchFollowCounts(userId: string): Promise<{ followers: number; following: number }> {
  const [{ count: followers }, { count: following }] = await Promise.all([
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', userId),
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId),
  ])
  return { followers: followers ?? 0, following: following ?? 0 }
}

// Fetch a single user's profile with follow status relative to currentUserId
export async function fetchUserProfile(
  targetUserId: string,
  currentUserId: string
): Promise<{ id: string; username: string; display_name: string | null; primary_zodaic_sign_id: number | null; isFollowing: boolean; followers: number; following: number } | null> {
  const [{ data: profile }, { data: follows }, followCounts] = await Promise.all([
    supabase.from('profiles').select('id, username, display_name, primary_zodaic_sign_id').eq('id', targetUserId).single(),
    supabase.from('follows').select('following_id').eq('follower_id', currentUserId).eq('following_id', targetUserId),
    fetchFollowCounts(targetUserId),
  ])
  if (!profile) return null
  return { ...profile, isFollowing: (follows ?? []).length > 0, ...followCounts }
}

// Fetch all users except current user, with follow status
export async function fetchUsers(currentUserId: string): Promise<{ id: string; username: string; display_name: string | null; primary_zodaic_sign_id: number | null; isFollowing: boolean }[]> {
  const [{ data: profiles }, { data: follows }] = await Promise.all([
    supabase.from('profiles').select('id, username, display_name, primary_zodaic_sign_id').neq('id', currentUserId),
    supabase.from('follows').select('following_id').eq('follower_id', currentUserId),
  ])

  const followingSet = new Set((follows ?? []).map((f) => f.following_id))
  return (profiles ?? []).map((p) => ({ ...p, isFollowing: followingSet.has(p.id) }))
}

// Follow a user
export async function followUser(followerId: string, followingId: string): Promise<void> {
  const { error } = await supabase.from('follows').insert({ follower_id: followerId, following_id: followingId })
  if (error) throw error
}

// Unfollow a user
export async function unfollowUser(followerId: string, followingId: string): Promise<void> {
  const { error } = await supabase.from('follows').delete().eq('follower_id', followerId).eq('following_id', followingId)
  if (error) throw error
}

// Share a horoscope or content affinity
export async function createShare(
  userId: string,
  contentType: Share['content_type'],
  contentId: string,
  message?: string
): Promise<Share> {
  const { data, error } = await supabase
    .from('shares')
    .insert({ user_id: userId, content_type: contentType, content_id: contentId, message })
    .select()
    .single()

  if (error) throw error
  return data as Share
}
