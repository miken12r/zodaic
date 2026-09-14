import { useState, useCallback, useEffect, useRef } from 'react'
import { View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl, TouchableOpacity, ActionSheetIOS, Alert } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import * as Clipboard from 'expo-clipboard'
import * as Sharing from 'expo-sharing'
import { captureRef } from 'react-native-view-shot'
import { fetchSignTakes, SignTake } from '@/lib/signTakes'
import { createShare } from '@/lib/api'
import { supabase } from '@/lib/supabase'
import { SIGN_BY_ID } from '@/constants/signs'
import { PERSONA_BY_SIGN_ID } from '@/constants/personas'
import SignDetailModal from '@/components/SignDetailModal'

const CACHE_TTL_MS = 5 * 60 * 1000

let takesCache: { items: SignTake[]; ts: number } | null = null

export default function TakesScreen() {
  const [takes, setTakes] = useState<SignTake[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedSignId, setSelectedSignId] = useState<number | null>(null)
  const [sharingTake, setSharingTake] = useState<SignTake | null>(null)
  const shareCardRef = useRef<View>(null)
  const router = useRouter()

  useEffect(() => {
    if (!sharingTake) return
    const t = setTimeout(async () => {
      try {
        const uri = await captureRef(shareCardRef, { format: 'png', quality: 0.9 })
        await Sharing.shareAsync(uri, { mimeType: 'image/png' })
      } catch (e) {
        Alert.alert('Error', 'Could not create the share image.')
      } finally {
        setSharingTake(null)
      }
    }, 50)
    return () => clearTimeout(t)
  }, [sharingTake])

  async function load() {
    const items = await fetchSignTakes()
    takesCache = { items, ts: Date.now() }
    setTakes(items)
    setLoading(false)
  }

  useFocusEffect(
    useCallback(() => {
      const now = Date.now()
      if (takesCache && now - takesCache.ts < CACHE_TTL_MS) {
        setTakes(takesCache.items)
        setLoading(false)
        return
      }
      if (!takesCache) setLoading(true)
      load()
    }, [])
  )

  async function onRefresh() {
    takesCache = null
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  function handlePress(take: SignTake) {
    router.push({
      pathname: '/article',
      params: {
        url: take.content_item?.url,
        contentId: take.content_item_id,
        signId: String(take.zodaic_sign_id),
        title: take.content_item?.title ?? '',
        confidence: String(take.content_item?.classification_confidence ?? 0),
        characteristics: JSON.stringify(take.content_item?.characteristics ?? []),
      },
    })
  }

  function handleSharePress(item: SignTake) {
    ActionSheetIOS.showActionSheetWithOptions(
      { options: ['Share to Feed', 'Copy Text', 'Share Image', 'Cancel'], cancelButtonIndex: 3 },
      (index) => {
        if (index === 0) handleShareToFeed(item)
        else if (index === 1) handleCopyText(item)
        else if (index === 2) setSharingTake(item)
      }
    )
  }

  async function handleShareToFeed(item: SignTake) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not logged in')
      await createShare(user.id, 'sign_take', item.id)
      Alert.alert('Shared', 'This take is now on your feed.')
    } catch (e) {
      Alert.alert('Error', 'Could not share this take.')
    }
  }

  async function handleCopyText(item: SignTake) {
    const sign = SIGN_BY_ID[item.zodaic_sign_id]
    const persona = PERSONA_BY_SIGN_ID[item.zodaic_sign_id]
    const text = `${item.headline}\n\n${item.blurb}\n\n— ${persona?.displayName ?? sign?.name}, via ZodAIc`
    await Clipboard.setStringAsync(text)
    Alert.alert('Copied', 'Paste it anywhere — Messages, notes, wherever.')
  }

  const renderItem = ({ item }: { item: SignTake }) => {
    const sign = SIGN_BY_ID[item.zodaic_sign_id]
    const persona = PERSONA_BY_SIGN_ID[item.zodaic_sign_id]
    return (
      <TouchableOpacity style={styles.card} onPress={() => handlePress(item)} activeOpacity={0.8}>
        <View style={styles.cardHeaderRow}>
          <TouchableOpacity style={styles.signBadge} onPress={() => setSelectedSignId(item.zodaic_sign_id)}>
            <Text style={[styles.signBadgeText, { color: sign?.color }]}>{persona?.avatar ?? sign?.symbol} {persona?.displayName ?? sign?.name} ›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.shareIconButton} onPress={() => handleSharePress(item)}>
            <Text style={styles.shareIconText}>↗</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.headline}>{item.headline}</Text>
        <Text style={styles.blurb}>{item.blurb}</Text>
      </TouchableOpacity>
    )
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#9b59b6" size="large" />
      </View>
    )
  }

  return (
    <>
      <View style={styles.screen}>
        <View style={styles.fixedHeader}>
          <Text style={styles.title}>Hot Takes</Text>
          <Text style={styles.subtitle}>Every sign has an opinion. Some more than others.</Text>
        </View>
        <FlatList
          style={styles.container}
          contentContainerStyle={styles.list}
          data={takes}
          keyExtractor={(t) => t.id}
          renderItem={renderItem}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No takes yet — check back soon.</Text>
            </View>
          }
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#9b59b6" />}
        />
      </View>
      <SignDetailModal signId={selectedSignId} onClose={() => setSelectedSignId(null)} />
      {sharingTake && (
        <View style={styles.captureWrapper} pointerEvents="none">
          <View
            ref={shareCardRef}
            collapsable={false}
            style={[styles.shareCardImage, { borderColor: SIGN_BY_ID[sharingTake.zodaic_sign_id]?.color ?? '#9b59b6' }]}
          >
            <Text style={styles.shareCardAvatar}>
              {PERSONA_BY_SIGN_ID[sharingTake.zodaic_sign_id]?.avatar ?? SIGN_BY_ID[sharingTake.zodaic_sign_id]?.symbol}
            </Text>
            <Text style={[styles.shareCardPersona, { color: SIGN_BY_ID[sharingTake.zodaic_sign_id]?.color ?? '#9b59b6' }]}>
              {PERSONA_BY_SIGN_ID[sharingTake.zodaic_sign_id]?.displayName ?? SIGN_BY_ID[sharingTake.zodaic_sign_id]?.name}
            </Text>
            <Text style={styles.shareCardHeadline}>{sharingTake.headline}</Text>
            <Text style={styles.shareCardBlurb}>{sharingTake.blurb}</Text>
            <View style={styles.shareCardFooter}>
              <Text style={styles.shareCardFooterText}>ZodAIc · your horoscope has opinions</Text>
            </View>
          </View>
        </View>
      )}
    </>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0d0d1a' },
  fixedHeader: { paddingHorizontal: 16, paddingTop: 60, paddingBottom: 8, backgroundColor: '#0d0d1a' },
  container: { flex: 1, backgroundColor: '#0d0d1a' },
  list: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32 },
  center: { flex: 1, backgroundColor: '#0d0d1a', justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 28, fontWeight: '800', color: '#fff', marginBottom: 4 },
  subtitle: { color: '#888', fontSize: 14, fontStyle: 'italic' },
  card: {
    backgroundColor: '#1a1a2e', borderRadius: 16, padding: 16, marginBottom: 10,
  },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  signBadge: { alignSelf: 'flex-start', flexShrink: 1 },
  signBadgeText: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  shareIconButton: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center', marginLeft: 8,
  },
  shareIconText: { color: '#ccc', fontSize: 14, fontWeight: '700' },
  headline: { color: '#fff', fontSize: 17, fontWeight: '800', lineHeight: 23, marginBottom: 6 },
  blurb: { color: '#aaa', fontSize: 14, lineHeight: 20 },
  empty: { padding: 40, alignItems: 'center' },
  emptyText: { color: '#555', fontSize: 14, textAlign: 'center' },
  captureWrapper: { position: 'absolute', top: -9999, left: 0, width: 340 },
  shareCardImage: {
    width: 340, backgroundColor: '#1a1a2e', borderRadius: 20, borderWidth: 3, padding: 24,
  },
  shareCardAvatar: { fontSize: 40, marginBottom: 8 },
  shareCardPersona: { fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 14 },
  shareCardHeadline: { color: '#fff', fontSize: 21, fontWeight: '800', lineHeight: 28, marginBottom: 12 },
  shareCardBlurb: { color: '#ccc', fontSize: 15, lineHeight: 22, marginBottom: 20 },
  shareCardFooter: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.15)', paddingTop: 12 },
  shareCardFooterText: { color: '#888', fontSize: 12, fontWeight: '700' },
})
