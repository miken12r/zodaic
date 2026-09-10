import { useState, useCallback, useEffect } from 'react'
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Linking, Modal, TextInput, Alert } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from '@/lib/supabase'
import { fetchSites, followSite, unfollowSite, classifyContent, createShare, Site } from '@/lib/api'
import { ContentItem } from '@/types'
import { SIGN_BY_ID, ZODAIC_SIGNS } from '@/constants/signs'
import SignDetailModal from '@/components/SignDetailModal'

const HISTORY_KEY = 'sites_classify_history'
const MAX_HISTORY = 20

export default function SitesScreen() {
  const [userId, setUserId] = useState<string | null>(null)
  const [sites, setSites] = useState<Site[]>([])
  const [loading, setLoading] = useState(true)
  const [filterSignId, setFilterSignId] = useState<number | null>(null)
  const [showFollowing, setShowFollowing] = useState(false)
  const [selectedSignId, setSelectedSignId] = useState<number | null>(null)
  const [classifyModalVisible, setClassifyModalVisible] = useState(false)
  const [classifyUrl, setClassifyUrl] = useState('')
  const [classifyLoading, setClassifyLoading] = useState(false)
  const [classifyResult, setClassifyResult] = useState<ContentItem | null>(null)
  const [sharing, setSharing] = useState(false)
  const [shared, setShared] = useState(false)
  const [classifyHistory, setClassifyHistory] = useState<ContentItem[]>([])
  const router = useRouter()

  useEffect(() => {
    AsyncStorage.getItem(HISTORY_KEY).then((raw) => {
      if (raw) setClassifyHistory(JSON.parse(raw))
    })
  }, [])

  useFocusEffect(useCallback(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      setUserId(user.id)
      const data = await fetchSites(user.id, filterSignId ?? undefined)
      setSites(data)
      setLoading(false)
    })
  }, [filterSignId]))

  async function handleFollow(site: Site) {
    if (!userId) return
    const next = !site.is_following
    setSites((prev) => prev.map((s) => s.id === site.id ? { ...s, is_following: next } : s))
    try {
      if (next) await followSite(userId, site.id)
      else await unfollowSite(userId, site.id)
    } catch {
      setSites((prev) => prev.map((s) => s.id === site.id ? { ...s, is_following: !next } : s))
    }
  }

  function handleSitePress(site: Site) {
    router.push({
      pathname: '/article',
      params: { url: site.url, signId: String(site.zodaic_sign_id), title: site.name },
    })
  }

  async function addToClassifyHistory(item: ContentItem) {
    const filtered = classifyHistory.filter((h) => h.url !== item.url)
    const updated = [item, ...filtered].slice(0, MAX_HISTORY)
    setClassifyHistory(updated)
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(updated))
  }

  async function handleClassify() {
    const target = classifyUrl.trim()
    if (!target) return
    setClassifyLoading(true)
    setClassifyResult(null)
    setShared(false)
    try {
      const item = await classifyContent(target)
      setClassifyResult(item)
      await addToClassifyHistory(item)
    } catch (e) {
      Alert.alert('Error', 'Could not classify this URL. Please try another.')
    } finally {
      setClassifyLoading(false)
    }
  }

  async function handleShare() {
    if (!classifyResult) return
    setSharing(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not logged in')
      await createShare(user.id, 'sign_reading', classifyResult.id, `${classifyResult.title} is ${classifySign?.name} energy.`)
      setShared(true)
    } catch (e) {
      Alert.alert('Error', 'Could not share this reading.')
    } finally {
      setSharing(false)
    }
  }

  function handleReadArticle() {
    if (!classifyResult) return
    setClassifyModalVisible(false)
    router.push({
      pathname: '/article',
      params: {
        url: classifyResult.url,
        contentId: classifyResult.id,
        signId: String(classifyResult.zodaic_sign_id),
        title: classifyResult.title ?? '',
        confidence: String(classifyResult.classification_confidence),
        characteristics: JSON.stringify(classifyResult.characteristics ?? []),
      },
    })
  }

  function handleHistoryTap(item: ContentItem) {
    setClassifyUrl(item.url)
    setClassifyResult(item)
    setShared(false)
  }

  const classifySign = classifyResult ? SIGN_BY_ID[classifyResult.zodaic_sign_id] : null

  const displayed = showFollowing ? sites.filter((s) => s.is_following) : sites

  const renderFixedHeader = () => (
    <>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Sites</Text>
        <TouchableOpacity style={styles.addButton} onPress={() => setClassifyModalVisible(true)}>
          <Text style={styles.addButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Sign filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.signScroll} contentContainerStyle={styles.signScrollContent}>
        <TouchableOpacity
          style={[styles.signPill, !filterSignId && styles.signPillActive]}
          onPress={() => setFilterSignId(null)}
        >
          <Text style={[styles.signPillText, !filterSignId && styles.signPillTextActive]}>All</Text>
        </TouchableOpacity>
        {ZODAIC_SIGNS.map((sign) => (
          <TouchableOpacity
            key={sign.id}
            style={[styles.signPill, filterSignId === sign.id && { backgroundColor: sign.color + '33', borderColor: sign.color }]}
            onPress={() => setFilterSignId(filterSignId === sign.id ? null : sign.id)}
          >
            <Text style={styles.signPillEmoji}>{sign.symbol}</Text>
            <Text style={[styles.signPillText, filterSignId === sign.id && { color: sign.color }]}>
              {sign.name.replace('The ', '')}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Following toggle */}
      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[styles.toggleButton, !showFollowing && styles.toggleButtonActive]}
          onPress={() => setShowFollowing(false)}
        >
          <Text style={[styles.toggleText, !showFollowing && styles.toggleTextActive]}>All Sites</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleButton, showFollowing && styles.toggleButtonActive]}
          onPress={() => setShowFollowing(true)}
        >
          <Text style={[styles.toggleText, showFollowing && styles.toggleTextActive]}>Following</Text>
        </TouchableOpacity>
      </View>
    </>
  )

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
        <View style={styles.fixedHeader}>{renderFixedHeader()}</View>
        <FlatList
        style={styles.container}
        contentContainerStyle={styles.list}
        data={displayed}
        keyExtractor={(s) => s.id}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              {showFollowing ? 'You haven\'t followed any sites yet.' : 'No sites found.'}
            </Text>
          </View>
        }
        renderItem={({ item: site }) => {
          const sign = SIGN_BY_ID[site.zodaic_sign_id]
          return (
            <TouchableOpacity style={styles.card} onPress={() => handleSitePress(site)} activeOpacity={0.8}>
              <View style={styles.cardHeader}>
                <TouchableOpacity style={styles.signBadge} onPress={() => setSelectedSignId(site.zodaic_sign_id)}>
                  <Text style={[styles.signBadgeText, { color: sign?.color }]}>{sign?.symbol} {sign?.name} ›</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.followButton, site.is_following && styles.followButtonActive]}
                  onPress={() => handleFollow(site)}
                >
                  <Text style={[styles.followButtonText, site.is_following && styles.followButtonTextActive]}>
                    {site.is_following ? 'Following' : 'Follow'}
                  </Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.siteName}>{site.name}</Text>
              <Text style={styles.siteUrl} numberOfLines={1}>{site.url.replace(/^https?:\/\/(www\.)?/, '')}</Text>
              {site.description ? <Text style={styles.siteDesc} numberOfLines={2}>{site.description}</Text> : null}
            </TouchableOpacity>
          )
        }}
        />
      </View>

      <Modal visible={classifyModalVisible} transparent animationType="slide" onRequestClose={() => setClassifyModalVisible(false)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setClassifyModalVisible(false)}>
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <View style={styles.modalSheet}>
              <View style={styles.modalHeaderRow}>
                <Text style={styles.modalTitle}>Classify a Site</Text>
                <TouchableOpacity onPress={() => setClassifyModalVisible(false)}>
                  <Text style={styles.closeButtonText}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView contentContainerStyle={styles.modalScrollContent}>
                <Text style={styles.subtitle}>Enter any URL to reveal its ZodAIc sign.</Text>
                <View style={styles.inputRow}>
                  <TextInput
                    style={styles.input}
                    placeholder="https://..."
                    placeholderTextColor="#555"
                    value={classifyUrl}
                    onChangeText={setClassifyUrl}
                    autoCapitalize="none"
                    keyboardType="url"
                    returnKeyType="go"
                    onSubmitEditing={handleClassify}
                  />
                  <TouchableOpacity style={styles.button} onPress={handleClassify} disabled={classifyLoading}>
                    <Text style={styles.buttonText}>↗</Text>
                  </TouchableOpacity>
                </View>

                {classifyLoading && (
                  <View style={styles.loadingCard}>
                    <ActivityIndicator color="#9b59b6" size="large" />
                    <Text style={styles.loadingText}>Reading the digital stars...</Text>
                  </View>
                )}

                {classifyResult && classifySign && (
                  <View style={[styles.resultCard, { borderColor: classifySign.color }]}>
                    <Text style={styles.resultTitle}>{classifyResult.title}</Text>
                    <Text style={styles.resultUrl} numberOfLines={1}>{classifyResult.url}</Text>

                    <View style={styles.divider} />

                    <TouchableOpacity onPress={() => setSelectedSignId(classifySign.id)}>
                      <Text style={styles.signSymbol}>{classifySign.symbol}</Text>
                      <Text style={[styles.signName, { color: classifySign.color }]}>{classifySign.name} ›</Text>
                    </TouchableOpacity>
                    <Text style={styles.signAnalog}>Digital {classifySign.traditional_analog}</Text>
                    <Text style={styles.signTagline}>{classifySign.tagline}</Text>

                    <View style={styles.divider} />

                    {classifyResult.description && (
                      <Text style={styles.description}>{classifyResult.description}</Text>
                    )}

                    <View style={styles.confidence}>
                      <Text style={styles.confidenceLabel}>Classification confidence</Text>
                      <Text style={[styles.confidenceValue, { color: classifySign.color }]}>
                        {Math.round(classifyResult.classification_confidence * 100)}%
                      </Text>
                    </View>

                    <View style={styles.traits}>
                      {(classifyResult.characteristics ?? []).map((c) => (
                        <View key={c} style={styles.trait}>
                          <Text style={styles.traitText}>{c}</Text>
                        </View>
                      ))}
                    </View>

                    <TouchableOpacity style={styles.readButton} onPress={handleReadArticle}>
                      <Text style={styles.readButtonText}>Read Article →</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.shareButton, shared && styles.shareButtonDone]}
                      onPress={handleShare}
                      disabled={sharing || shared}
                    >
                      <Text style={styles.shareButtonText}>
                        {shared ? 'Shared to Feed ✓' : sharing ? 'Sharing...' : 'Share to Feed'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {classifyHistory.length > 0 && (
                  <View style={styles.historySection}>
                    <Text style={styles.historyTitle}>Recent</Text>
                    {classifyHistory.map((item) => {
                      const s = SIGN_BY_ID[item.zodaic_sign_id]
                      return (
                        <TouchableOpacity key={item.id} style={styles.historyItem} onPress={() => handleHistoryTap(item)}>
                          <Text style={styles.historySymbol}>{s?.symbol}</Text>
                          <View style={styles.historyText}>
                            <Text style={styles.historyName} numberOfLines={1}>{item.title}</Text>
                            <Text style={styles.historyUrl} numberOfLines={1}>{item.url}</Text>
                          </View>
                          <TouchableOpacity onPress={(e) => { e.stopPropagation(); if (s) setSelectedSignId(s.id) }}>
                            <Text style={[styles.historySign, { color: s?.color }]}>{s?.name} ›</Text>
                          </TouchableOpacity>
                        </TouchableOpacity>
                      )
                    })}
                  </View>
                )}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <SignDetailModal signId={selectedSignId} onClose={() => setSelectedSignId(null)} />
    </>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0d0d1a' },
  fixedHeader: { paddingHorizontal: 16, paddingTop: 60, backgroundColor: '#0d0d1a' },
  container: { flex: 1, backgroundColor: '#0d0d1a' },
  list: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32 },
  center: { flex: 1, backgroundColor: '#0d0d1a', justifyContent: 'center', alignItems: 'center' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 28, fontWeight: '800', color: '#fff' },
  addButton: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#9b59b6', justifyContent: 'center', alignItems: 'center',
  },
  addButtonText: { color: '#fff', fontSize: 20, fontWeight: '700', marginTop: -2 },
  signScroll: { marginHorizontal: -16, marginBottom: 12 },
  signScrollContent: { paddingHorizontal: 16, gap: 8 },
  signPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    borderWidth: 1, borderColor: '#2a2a3e', backgroundColor: '#1a1a2e',
  },
  signPillActive: { backgroundColor: '#2a1a3e', borderColor: '#9b59b6' },
  signPillEmoji: { fontSize: 13 },
  signPillText: { color: '#888', fontSize: 12, fontWeight: '600' },
  signPillTextActive: { color: '#9b59b6' },
  toggleRow: { flexDirection: 'row', backgroundColor: '#1a1a2e', borderRadius: 12, padding: 4, marginBottom: 16 },
  toggleButton: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10 },
  toggleButtonActive: { backgroundColor: '#9b59b6' },
  toggleText: { color: '#555', fontSize: 13, fontWeight: '700' },
  toggleTextActive: { color: '#fff' },
  card: {
    backgroundColor: '#1a1a2e', borderRadius: 16, padding: 16, marginBottom: 10,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  signBadge: {},
  signBadgeText: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  followButton: {
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5,
    borderWidth: 1, borderColor: '#9b59b6',
  },
  followButtonActive: { backgroundColor: '#9b59b6' },
  followButtonText: { color: '#9b59b6', fontSize: 12, fontWeight: '700' },
  followButtonTextActive: { color: '#fff' },
  siteName: { color: '#fff', fontSize: 17, fontWeight: '800', marginBottom: 2 },
  siteUrl: { color: '#555', fontSize: 12, marginBottom: 6 },
  siteDesc: { color: '#888', fontSize: 13, lineHeight: 19 },
  empty: { padding: 40, alignItems: 'center' },
  emptyText: { color: '#555', fontSize: 14, textAlign: 'center' },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#1a1a2e', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40, maxHeight: '85%',
  },
  modalHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  closeButtonText: { color: '#555', fontSize: 18, fontWeight: '700', padding: 4 },
  modalScrollContent: { paddingBottom: 8 },
  subtitle: { color: '#888', fontSize: 15, marginBottom: 20 },
  inputRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  input: {
    flex: 1,
    backgroundColor: '#0d0d1a',
    color: '#fff',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#2a2a3e',
  },
  button: {
    backgroundColor: '#9b59b6',
    borderRadius: 12,
    width: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: 22, fontWeight: '700' },
  loadingCard: { alignItems: 'center', padding: 40, gap: 16 },
  loadingText: { color: '#9b59b6', fontSize: 15 },
  resultCard: {
    backgroundColor: '#0d0d1a',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    marginBottom: 24,
  },
  resultTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 4 },
  resultUrl: { color: '#666', fontSize: 12, marginBottom: 16 },
  divider: { height: 1, backgroundColor: '#2a2a3e', marginVertical: 16 },
  signSymbol: { fontSize: 40, textAlign: 'center', marginBottom: 8 },
  signName: { fontSize: 22, fontWeight: '800', textAlign: 'center', marginBottom: 4 },
  signAnalog: { color: '#888', fontSize: 13, textAlign: 'center', marginBottom: 6 },
  signTagline: { color: '#ccc', fontSize: 14, fontStyle: 'italic', textAlign: 'center' },
  description: { color: '#bbb', fontSize: 14, lineHeight: 22, marginBottom: 16 },
  confidence: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  confidenceLabel: { color: '#666', fontSize: 13 },
  confidenceValue: { fontSize: 16, fontWeight: '700' },
  traits: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  trait: { backgroundColor: '#2a1a3e', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  traitText: { color: '#9b59b6', fontSize: 12 },
  readButton: { borderWidth: 1, borderColor: '#9b59b6', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 8 },
  readButtonText: { color: '#9b59b6', fontWeight: '700', fontSize: 15 },
  shareButton: { backgroundColor: '#9b59b6', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 8 },
  shareButtonDone: { backgroundColor: '#2a1a3e' },
  shareButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  historySection: { marginTop: 8 },
  historyTitle: { color: '#9b59b6', fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0d0d1a',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    gap: 10,
  },
  historySymbol: { fontSize: 22 },
  historyText: { flex: 1 },
  historyName: { color: '#ddd', fontSize: 14, fontWeight: '600' },
  historyUrl: { color: '#555', fontSize: 11, marginTop: 2 },
  historySign: { fontSize: 11, fontWeight: '700' },
})
