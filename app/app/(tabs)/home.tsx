import { useState, useCallback, useRef } from 'react'
import { View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl, TouchableOpacity, Image, Modal, ScrollView } from 'react-native'
import { Swipeable } from 'react-native-gesture-handler'
import SignDetailModal from '@/components/SignDetailModal'
import UserProfileSheet from '@/components/UserProfileSheet'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from '@/lib/supabase'
import { fetchHoroscope, generateHoroscope, fetchHomeFeed, fetchTrendingFeed, FeedItem, PortAilsResult } from '@/lib/api'
import { SIGN_BY_ID, ZODAIC_SIGNS } from '@/constants/signs'
import { useFocusEffect, useRouter } from 'expo-router'

const CACHE_TTL_MS = 12 * 60 * 60 * 1000
const FEED_CACHE_TTL_MS = 5 * 60 * 1000
const DISMISSED_KEY = 'home_dismissed_v1'
const DISMISSED_TTL_MS = 7 * 24 * 60 * 60 * 1000

type DismissedEntry = { id: string; reason: 'read' | 'not_interested'; signId: number; ts: number }

async function loadDismissed(): Promise<Set<string>> {
  const raw = await AsyncStorage.getItem(DISMISSED_KEY)
  if (!raw) return new Set()
  const entries: DismissedEntry[] = JSON.parse(raw)
  const fresh = entries.filter((e) => Date.now() - e.ts < DISMISSED_TTL_MS)
  return new Set(fresh.map((e) => e.id))
}

async function saveDismissed(id: string, reason: 'read' | 'not_interested', signId: number) {
  const raw = await AsyncStorage.getItem(DISMISSED_KEY)
  const entries: DismissedEntry[] = raw ? JSON.parse(raw) : []
  const updated = entries
    .filter((e) => e.id !== id && Date.now() - e.ts < DISMISSED_TTL_MS)
    .concat({ id, reason, signId, ts: Date.now() })
  await AsyncStorage.setItem(DISMISSED_KEY, JSON.stringify(updated))
}

let feedCache: { items: FeedItem[]; signId: number | null; ts: number } | null = null

const ELEMENT_MAP: Record<number, string> = {
  1: 'fire', 2: 'earth', 3: 'air', 4: 'water',
  5: 'fire', 6: 'earth', 7: 'air', 8: 'water',
  9: 'fire', 10: 'earth', 11: 'air', 12: 'water',
}
const COMPATIBLE: Record<string, string[]> = {
  fire: ['fire', 'air'], earth: ['earth', 'water'],
  air: ['air', 'fire'], water: ['water', 'earth'],
}
function elementalScore(userSignId: number, otherSignId: number): number {
  const userEl = ELEMENT_MAP[userSignId]
  const otherEl = ELEMENT_MAP[otherSignId]
  if (!userEl || !otherEl) return 50
  if (userEl === otherEl) return 85
  if (COMPATIBLE[userEl]?.includes(otherEl)) return 70
  return 35
}

const LABEL_COLORS: Record<string, string> = {
  Excellent: '#2ecc71', Good: '#9b59b6', Neutral: '#888', Challenging: '#e67e22', Avoid: '#e74c3c',
}
function scoreToLabel(score: number): string {
  if (score >= 80) return 'Excellent'
  if (score >= 65) return 'Good'
  if (score >= 50) return 'Neutral'
  if (score >= 40) return 'Challenging'
  return 'Avoid'
}

async function getPortailsCache(key: string): Promise<PortAilsResult | null> {
  const raw = await AsyncStorage.getItem(key)
  if (!raw) return null
  const { data, timestamp } = JSON.parse(raw)
  if (Date.now() - timestamp > CACHE_TTL_MS) return null
  return data as PortAilsResult
}

export default function HomeScreen() {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [primarySignId, setPrimarySignId] = useState<number | null>(null)
  const [feedItems, setFeedItems] = useState<FeedItem[]>([])
  const [compatibilityScores, setCompatibilityScores] = useState<Record<number, number>>({})
  const [filterSignIds, setFilterSignIds] = useState<Set<number>>(new Set())
  const [filterModalVisible, setFilterModalVisible] = useState(false)
  const [filterSortOrder, setFilterSortOrder] = useState<'desc' | 'asc'>('desc')
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())
  const [selectedSignId, setSelectedSignId] = useState<number | null>(null)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [explainerVisible, setExplainerVisible] = useState(false)
  const swipeableRefs = useRef<Map<string, Swipeable | null>>(new Map())
  const router = useRouter()

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setCurrentUserId(user.id)

    const { data: profile } = await supabase
      .from('profiles')
      .select('primary_zodaic_sign_id')
      .eq('id', user.id)
      .single()

    const signId = profile?.primary_zodaic_sign_id ?? null
    setPrimarySignId(signId)

    if (!signId) {
      const items = await fetchTrendingFeed()
      feedCache = { items, signId: null, ts: Date.now() }
      setFeedItems(items)
      setLoading(false)
      return
    }

    let scores: Record<number, number> = {}
    const cached = await getPortailsCache(`portails_${signId}`)
    if (cached) {
      scores = Object.fromEntries(cached.compatibility.map((c) => [c.sign_id, c.score]))
    } else {
      for (let i = 1; i <= 12; i++) {
        if (i !== signId) scores[i] = elementalScore(signId, i)
      }
      let h = await fetchHoroscope(signId)
      if (!h) h = await generateHoroscope(signId, 'weekly')
    }
    setCompatibilityScores(scores)

    const items = await fetchHomeFeed(user.id, signId, scores)
    feedCache = { items, signId, ts: Date.now() }
    setFeedItems(items)
    setLoading(false)
  }

  useFocusEffect(useCallback(() => {
    loadDismissed().then(setDismissedIds)
    const now = Date.now()
    if (feedCache && now - feedCache.ts < FEED_CACHE_TTL_MS) {
      // Cache is fresh — restore instantly and skip the fetch
      setFeedItems(feedCache.items)
      setPrimarySignId(feedCache.signId)
      setLoading(false)
      return
    }
    // Cache is stale or sign may have changed — fetch fresh
    if (!feedCache) setLoading(true)
    load()
  }, []))

  async function onRefresh() {
    feedCache = null
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  const primarySign = primarySignId ? SIGN_BY_ID[primarySignId] : null

  const filteredItems = feedItems
    .filter((item) => {
      const id = item.type === 'news' ? item.item.id : null
      if (id && dismissedIds.has(id)) return false
      if (filterSignIds.size === 0) return true
      if (item.type === 'news') return filterSignIds.has(item.item.zodaic_sign_id)
      if (item.type === 'share') return item.share.content_item ? filterSignIds.has(item.share.content_item.zodaic_sign_id) : false
      return false
    })

  function handleNewsPress(item: any) {
    router.push({
      pathname: '/article',
      params: {
        url: item.url,
        contentId: item.id,
        signId: String(item.zodaic_sign_id),
        title: item.title ?? '',
        confidence: String(item.classification_confidence),
        characteristics: JSON.stringify(item.characteristics ?? []),
      },
    })
  }

  function handleSharePress(contentId: string) {
    router.push({ pathname: '/(tabs)/discover', params: { contentId } })
  }

  async function handleDismiss(id: string, reason: 'read' | 'not_interested', signId: number) {
    swipeableRefs.current.get(id)?.close()
    setDismissedIds((prev) => new Set([...prev, id]))
    await saveDismissed(id, reason, signId)
  }

  const renderHeader = () => {
    const filterSign = filterSignIds.size === 1 ? SIGN_BY_ID[[...filterSignIds][0]] : null
    return (
      <>
        <TouchableOpacity style={styles.headerRow} onPress={() => router.push('/(tabs)/profile')}>
          <Text style={styles.headerLabel}>Your sign: </Text>
          {primarySign ? (
            <>
              <Text style={styles.headerSymbol}>{primarySign.symbol}</Text>
              <Text style={[styles.headerSignName, { color: primarySign.color }]}>{primarySign.name}</Text>
            </>
          ) : (
            <Text style={styles.headerSignName}>Set up your profile →</Text>
          )}
        </TouchableOpacity>
        <View style={styles.headerSubtitleRow}>
          <Text style={styles.headerSubtitle}>
            {primarySign ? 'Stories ranked by your sign compatibility' : 'Showing trending stories across all signs'}
          </Text>
          {primarySign && (
            <TouchableOpacity onPress={() => setExplainerVisible(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.infoIcon}>ⓘ</Text>
            </TouchableOpacity>
          )}
        </View>

        {!primarySign && (
          <TouchableOpacity style={styles.setupBanner} onPress={() => router.push('/(tabs)/profile')}>
            <Text style={styles.setupBannerTitle}>✦ Discover your digital sign</Text>
            <Text style={styles.setupBannerBody}>
              Add your birth date to unlock a personalized feed ranked by your sign's compatibility.
            </Text>
            <Text style={styles.setupBannerCta}>Set up profile →</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.filterButton} onPress={() => setFilterModalVisible(true)}>
          <Text style={styles.filterButtonText}>
            {filterSignIds.size === 0
              ? 'All Signs'
              : filterSignIds.size === 1
              ? SIGN_BY_ID[[...filterSignIds][0]]?.name
              : `${filterSignIds.size} Signs`}
          </Text>
          {filterSignIds.size > 0 && (
            <TouchableOpacity onPress={() => setFilterSignIds(new Set())} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.filterClear}>✕</Text>
            </TouchableOpacity>
          )}
          <Text style={styles.filterChevron}>▾</Text>
        </TouchableOpacity>
      </>
    )
  }

  const renderItem = ({ item }: { item: FeedItem }) => {
    if (item.type === 'news') {
      const sign = SIGN_BY_ID[item.item.zodaic_sign_id]
      const contentId = item.item.id
      const signId = item.item.zodaic_sign_id

      const renderRightActions = () => (
        <View style={styles.swipeActions}>
          <TouchableOpacity
            style={styles.swipeRead}
            onPress={() => handleDismiss(contentId, 'read', signId)}
          >
            <Text style={styles.swipeIcon}>✓</Text>
            <Text style={styles.swipeLabel}>Read</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.swipeNotInterested}
            onPress={() => handleDismiss(contentId, 'not_interested', signId)}
          >
            <Text style={styles.swipeIcon}>✕</Text>
            <Text style={styles.swipeLabel}>Not{'\n'}Interested</Text>
          </TouchableOpacity>
        </View>
      )

      return (
        <Swipeable
          ref={(ref) => swipeableRefs.current.set(contentId, ref)}
          renderRightActions={renderRightActions}
          friction={2}
          rightThreshold={40}
          overshootRight={false}
        >
          <TouchableOpacity style={styles.newsCard} onPress={() => handleNewsPress(item.item)} activeOpacity={0.8}>
            {item.item.image_url ? (
              <Image source={{ uri: item.item.image_url }} style={styles.newsImage} resizeMode="cover" />
            ) : (
              <View style={[styles.newsImagePlaceholder, { backgroundColor: (sign?.color ?? '#9b59b6') + '22' }]}>
                <Text style={styles.newsImageEmoji}>{sign?.symbol}</Text>
              </View>
            )}
            <View style={styles.newsContent}>
              <TouchableOpacity style={styles.newsSignBadge} onPress={(e) => { e.stopPropagation(); if (sign) setSelectedSignId(sign.id) }}>
                <Text style={[styles.newsSignText, { color: sign?.color }]}>{sign?.symbol} {sign?.name} ›</Text>
              </TouchableOpacity>
              <Text style={styles.newsTitle} numberOfLines={2}>{item.item.title}</Text>
              {item.item.description && (
                <Text style={styles.newsDescription} numberOfLines={2}>{item.item.description}</Text>
              )}
            </View>
          </TouchableOpacity>
        </Swipeable>
      )
    }

    if (item.type === 'share') {
      const { share } = item
      const contentItem = share.content_item
      const sign = contentItem ? SIGN_BY_ID[contentItem.zodaic_sign_id] : null
      const profile = (share as any).profile
      return (
        <TouchableOpacity
          style={styles.shareCard}
          onPress={() => contentItem && handleSharePress(contentItem.id)}
          activeOpacity={contentItem ? 0.8 : 1}
        >
          <View style={styles.shareHeader}>
            <TouchableOpacity onPress={() => share.user_id && setSelectedUserId(share.user_id)}>
              <Text style={styles.shareUsername}>{profile?.display_name ?? profile?.username ?? 'Someone'}</Text>
            </TouchableOpacity>
            <Text style={styles.shareLabel}>shared</Text>
            {sign && (
              <TouchableOpacity onPress={() => setSelectedSignId(sign.id)}>
                <Text style={[styles.shareSign, { color: sign.color }]}>{sign.symbol} {sign.name} ›</Text>
              </TouchableOpacity>
            )}
          </View>
          {contentItem && <Text style={styles.shareTitle} numberOfLines={1}>{contentItem.title}</Text>}
          {share.message && <Text style={styles.shareMessage} numberOfLines={2}>{share.message}</Text>}
        </TouchableOpacity>
      )
    }

    return null
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#9b59b6" size="large" />
        <Text style={styles.loadingText}>Aligning the digital stars...</Text>
      </View>
    )
  }

  return (
    <>
      <FlatList
        style={styles.container}
        data={filteredItems}
        keyExtractor={(item, i) => `${item.type}-${i}`}
        renderItem={renderItem}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              {primarySign
                ? 'No content for this sign yet — try another or pull to refresh.'
                : 'No trending content yet — check back soon.'}
            </Text>
          </View>
        }
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#9b59b6" />}
        contentContainerStyle={styles.list}
      />

      <SignDetailModal signId={selectedSignId} onClose={() => setSelectedSignId(null)} />
      {currentUserId && (
        <UserProfileSheet
          userId={selectedUserId}
          currentUserId={currentUserId}
          onClose={() => setSelectedUserId(null)}
        />
      )}

      <Modal visible={explainerVisible} transparent animationType="slide" onRequestClose={() => setExplainerVisible(false)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setExplainerVisible(false)}>
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <View style={[styles.explainerSheet, primarySign ? { borderTopColor: primarySign.color } : {}]}>
              <Text style={styles.explainerTitle}>How your feed works</Text>
              <Text style={styles.explainerBody}>
                Every story in your feed is classified into one of the 12 ZodAIc signs based on its content and energy.
              </Text>
              <Text style={styles.explainerBody}>
                Stories are ranked by how compatible each sign is with yours — so content that resonates with {primarySign?.name} energy rises to the top.
              </Text>
              <Text style={styles.explainerBody}>
                Tap any sign badge on a story to learn more about that sign. Use the filter to focus on specific signs.
              </Text>
              <TouchableOpacity style={[styles.explainerButton, { backgroundColor: primarySign?.color ?? '#9b59b6' }]} onPress={() => setExplainerVisible(false)}>
                <Text style={styles.explainerButtonText}>Got it</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <Modal visible={filterModalVisible} transparent animationType="slide" onRequestClose={() => setFilterModalVisible(false)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setFilterModalVisible(false)}>
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
          <View style={styles.modalSheet}>
            <View style={styles.modalTitleRow}>
              <Text style={styles.modalTitle}>Filter by Sign</Text>
              <View style={styles.modalTitleRight}>
                <TouchableOpacity style={styles.sortToggle} onPress={() => setFilterSortOrder((o) => o === 'desc' ? 'asc' : 'desc')}>
                  <Text style={styles.sortToggleText}>{filterSortOrder === 'desc' ? 'Best → Worst' : 'Worst → Best'}</Text>
                  <Text style={styles.sortToggleArrow}>{filterSortOrder === 'desc' ? '↓' : '↑'}</Text>
                </TouchableOpacity>
              </View>
            </View>
            <ScrollView>
              <TouchableOpacity
                style={[styles.modalRow, filterSignIds.size === 0 && styles.modalRowSelected]}
                onPress={() => setFilterSignIds(new Set())}
              >
                <Text style={styles.modalSymbol}>✦</Text>
                <Text style={styles.modalSignName}>All Signs</Text>
                {filterSignIds.size === 0 && <Text style={styles.modalCheck}>✓</Text>}
              </TouchableOpacity>

              {[...ZODAIC_SIGNS]
                .filter((sign) => sign.id !== primarySignId)
                .sort((a, b) => {
                  const scoreA = compatibilityScores[a.id] ?? elementalScore(primarySignId ?? 1, a.id)
                  const scoreB = compatibilityScores[b.id] ?? elementalScore(primarySignId ?? 1, b.id)
                  const scoreDiff = filterSortOrder === 'desc' ? scoreB - scoreA : scoreA - scoreB
                  if (scoreDiff !== 0) return scoreDiff
                  return a.name.replace('The ', '').localeCompare(b.name.replace('The ', ''))
                })
                .map((sign) => {
                const score = compatibilityScores[sign.id] ?? elementalScore(primarySignId ?? 1, sign.id)
                const label = scoreToLabel(score)
                const labelColor = LABEL_COLORS[label]
                const isSelected = filterSignIds.has(sign.id)
                return (
                  <TouchableOpacity
                    key={sign.id}
                    style={[styles.modalRow, isSelected && styles.modalRowSelected]}
                    onPress={() => {
                      setFilterSignIds((prev) => {
                        const next = new Set(prev)
                        if (next.has(sign.id)) next.delete(sign.id)
                        else next.add(sign.id)
                        return next
                      })
                    }}
                  >
                    <Text style={styles.modalSymbol}>{sign.symbol}</Text>
                    <Text style={[styles.modalSignName, { color: sign.color }]}>{sign.name.replace('The ', '')}</Text>
                    <View style={styles.modalScoreRow}>
                      <View style={styles.modalBarContainer}>
                        <View style={[styles.modalBar, { width: `${score}%` as any, backgroundColor: labelColor }]} />
                      </View>
                      <Text style={[styles.modalScore, { color: labelColor }]}>{score}</Text>
                    </View>
                    <TouchableOpacity onPress={() => setSelectedSignId(sign.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Text style={styles.modalInfo}>ⓘ</Text>
                    </TouchableOpacity>
                    {isSelected && <Text style={styles.modalCheck}>✓</Text>}
                  </TouchableOpacity>
                )
              })}
            </ScrollView>
            <TouchableOpacity style={styles.modalDoneButton} onPress={() => setFilterModalVisible(false)}>
              <Text style={styles.modalDoneText}>Done</Text>
            </TouchableOpacity>
          </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0d1a' },
  list: { padding: 16, paddingTop: 60, paddingBottom: 32 },
  center: { flex: 1, backgroundColor: '#0d0d1a', justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { color: '#9b59b6', fontSize: 15 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' },
  headerLabel: { fontSize: 22, fontWeight: '800', color: '#fff' },
  headerSubtitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 40, marginTop: -6 },
  headerSubtitle: { color: '#888', fontSize: 14, fontStyle: 'italic' },
  infoIcon: { color: '#555', fontSize: 15 },
  explainerSheet: {
    backgroundColor: '#1a1a2e', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 48, borderTopWidth: 3, borderTopColor: '#9b59b6',
  },
  explainerTitle: { color: '#fff', fontSize: 18, fontWeight: '800', marginBottom: 16 },
  explainerBody: { color: '#aaa', fontSize: 14, lineHeight: 22, marginBottom: 12 },
  explainerButton: { borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 8 },
  explainerButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  headerSymbol: { fontSize: 22, marginRight: 4 },
  headerSignName: { fontSize: 22, fontWeight: '800', color: '#fff' },
  setupBanner: {
    backgroundColor: '#1a1a2e', borderRadius: 16, padding: 18,
    marginBottom: 16, borderWidth: 1, borderColor: '#9b59b6',
  },
  setupBannerTitle: { color: '#9b59b6', fontSize: 14, fontWeight: '800', marginBottom: 6 },
  setupBannerBody: { color: '#888', fontSize: 13, lineHeight: 20, marginBottom: 10 },
  setupBannerCta: { color: '#9b59b6', fontSize: 13, fontWeight: '700' },
  filterButton: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#1a1a2e', borderRadius: 20, paddingHorizontal: 14,
    paddingVertical: 8, alignSelf: 'flex-start', marginBottom: 16,
    borderWidth: 1, borderColor: '#2a2a3e',
  },
  filterButtonSymbol: { fontSize: 14 },
  filterButtonText: { color: '#ccc', fontSize: 14, fontWeight: '600' },
  filterClear: { color: '#9b59b6', fontSize: 13, fontWeight: '800', marginRight: 2 },
  filterChevron: { color: '#555', fontSize: 12 },
  modalDoneButton: { backgroundColor: '#9b59b6', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 12 },
  modalDoneText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  newsCard: {
    backgroundColor: '#1a1a2e', borderRadius: 16, marginBottom: 10,
    flexDirection: 'row', overflow: 'hidden',
  },
  newsImage: { width: 90, height: 90 },
  newsImagePlaceholder: { width: 90, height: 90, justifyContent: 'center', alignItems: 'center' },
  newsImageEmoji: { fontSize: 28 },
  newsContent: { flex: 1, padding: 12 },
  newsSignBadge: { marginBottom: 4 },
  newsSignText: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  newsTitle: { color: '#fff', fontSize: 14, fontWeight: '700', lineHeight: 20, marginBottom: 4 },
  newsDescription: { color: '#888', fontSize: 12, lineHeight: 17 },
  shareCard: {
    backgroundColor: '#1a1a2e', borderRadius: 16, padding: 14,
    marginBottom: 10, borderLeftWidth: 3, borderLeftColor: '#9b59b6',
  },
  shareHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' },
  shareUsername: { color: '#9b59b6', fontWeight: '700', fontSize: 13 },
  shareLabel: { color: '#555', fontSize: 13 },
  shareSign: { fontSize: 13, fontWeight: '700' },
  shareTitle: { color: '#ddd', fontSize: 14, fontWeight: '600', marginBottom: 4 },
  shareMessage: { color: '#888', fontSize: 13, lineHeight: 18 },
  empty: { padding: 40, alignItems: 'center' },
  emptyText: { color: '#555', fontSize: 14, textAlign: 'center', lineHeight: 22 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#1a1a2e', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '80%' },
  modalTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  modalTitleRight: { alignItems: 'flex-end' },
  sortToggle: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#2a1a3e', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  sortToggleText: { color: '#9b59b6', fontSize: 12, fontWeight: '700' },
  sortToggleArrow: { color: '#9b59b6', fontSize: 12, fontWeight: '800' },
  modalRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 10, borderBottomWidth: 1, borderBottomColor: '#2a2a3e' },
  modalRowSelected: { backgroundColor: '#2a1a3e', marginHorizontal: -24, paddingHorizontal: 24 },
  modalSymbol: { fontSize: 20, width: 28 },
  modalSignName: { color: '#fff', fontSize: 15, fontWeight: '600', width: 130 },
  modalScoreRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  modalBarContainer: { flex: 1, height: 4, backgroundColor: '#2a2a3e', borderRadius: 2, overflow: 'hidden' },
  modalBar: { height: 4, borderRadius: 2 },
  modalScore: { fontSize: 12, fontWeight: '800', width: 26, textAlign: 'right' },
  modalCheck: { color: '#9b59b6', fontSize: 16, fontWeight: '800' },
  modalInfo: { color: '#444', fontSize: 16, marginLeft: 4 },
  swipeActions: { flexDirection: 'row', marginBottom: 10 },
  swipeRead: { backgroundColor: '#2ecc71', width: 80, justifyContent: 'center', alignItems: 'center', borderRadius: 0 },
  swipeNotInterested: { backgroundColor: '#e74c3c', width: 80, justifyContent: 'center', alignItems: 'center', borderTopRightRadius: 16, borderBottomRightRadius: 16 },
  swipeIcon: { color: '#fff', fontSize: 20, fontWeight: '800' },
  swipeLabel: { color: '#fff', fontSize: 10, fontWeight: '700', textAlign: 'center', marginTop: 2 },
})
