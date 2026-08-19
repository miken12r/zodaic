import { useState, useEffect, useCallback, useRef } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView, Alert } from 'react-native'
import SignDetailModal from '@/components/SignDetailModal'
import UserProfileSheet from '@/components/UserProfileSheet'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { classifyContent, createShare, fetchTopUrlsForSign, fetchContentItem, fetchUsers, followUser, unfollowUser } from '@/lib/api'
import { ContentItem } from '@/types'
import { SIGN_BY_ID } from '@/constants/signs'
import { supabase } from '@/lib/supabase'
import { useFocusEffect, useLocalSearchParams, useRouter, useNavigation } from 'expo-router'

const HISTORY_KEY = 'discover_history'
const MAX_HISTORY = 20

export default function DiscoverScreen() {
  const { signId, contentId } = useLocalSearchParams<{ signId?: string; contentId?: string }>()
  const router = useRouter()

  function handleReadArticle() {
    if (!result) return
    const sign = SIGN_BY_ID[result.zodaic_sign_id]
    router.push({
      pathname: '/article',
      params: {
        url: result.url,
        contentId: result.id,
        signId: String(result.zodaic_sign_id),
        title: result.title ?? '',
        confidence: String(result.classification_confidence),
      },
    })
  }
  const filteredSignId = signId ? parseInt(signId) : null
  const filteredSign = filteredSignId ? SIGN_BY_ID[filteredSignId] : null

  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [result, setResult] = useState<ContentItem | null>(null)
  const [shared, setShared] = useState(false)
  const [history, setHistory] = useState<ContentItem[]>([])
  const [filteredUrls, setFilteredUrls] = useState<ContentItem[]>([])
  const [filteredLoading, setFilteredLoading] = useState(false)
  const [selectedSignId, setSelectedSignId] = useState<number | null>(null)
  const [people, setPeople] = useState<{ id: string; username: string; display_name: string | null; primary_zodaic_sign_id: number | null; isFollowing: boolean }[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const scrollRef = useRef<ScrollView>(null)

  useFocusEffect(useCallback(() => {
    AsyncStorage.getItem(HISTORY_KEY).then((raw) => {
      if (raw) setHistory(JSON.parse(raw))
    })
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      setCurrentUserId(user.id)
      fetchUsers(user.id).then(setPeople)
    })
    if (contentId) {
      fetchContentItem(contentId).then((item) => {
        if (item) {
          setResult(item)
          setUrl(item.url)
          setShared(false)
          scrollRef.current?.scrollTo({ y: 0, animated: false })
        }
      })
    }
    if (filteredSignId) {
      setFilteredLoading(true)
      fetchTopUrlsForSign(filteredSignId).then((data) => {
        setFilteredUrls(Array.isArray(data) ? data as ContentItem[] : [])
        setFilteredLoading(false)
      }).catch(() => {
        setFilteredUrls([])
        setFilteredLoading(false)
      })
    } else {
      setFilteredUrls([])
    }
  }, [filteredSignId]))

  async function addToHistory(item: ContentItem) {
    const filtered = history.filter((h) => h.url !== item.url)
    const updated = [item, ...filtered].slice(0, MAX_HISTORY)
    setHistory(updated)
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(updated))
  }

  async function handleClassify(classifyUrl?: string) {
    const target = (classifyUrl ?? url).trim()
    if (!target) return
    setLoading(true)
    setResult(null)
    setShared(false)
    try {
      const item = await classifyContent(target)
      setResult(item)
      await addToHistory(item)
    } catch (e) {
      Alert.alert('Error', 'Could not classify this URL. Please try another.')
    } finally {
      setLoading(false)
    }
  }

  async function handleShare() {
    if (!result) return
    setSharing(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not logged in')
      await createShare(user.id, 'sign_reading', result.id, `${result.title} is ${sign?.name} energy.`)
      setShared(true)
    } catch (e) {
      Alert.alert('Error', 'Could not share this reading.')
    } finally {
      setSharing(false)
    }
  }

  async function handleFollowToggle(person: typeof people[0]) {
    if (!currentUserId) return
    setTogglingId(person.id)
    try {
      if (person.isFollowing) {
        await unfollowUser(currentUserId, person.id)
      } else {
        await followUser(currentUserId, person.id)
      }
      setPeople((prev) => prev.map((p) => p.id === person.id ? { ...p, isFollowing: !p.isFollowing } : p))
    } finally {
      setTogglingId(null)
    }
  }

  function handleHistoryTap(item: ContentItem) {
    setUrl(item.url)
    setResult(item)
    setShared(false)
    scrollRef.current?.scrollTo({ y: 0, animated: true })
  }

  const sign = result ? SIGN_BY_ID[result.zodaic_sign_id] : null

  return (
    <>
    <SignDetailModal signId={selectedSignId} onClose={() => setSelectedSignId(null)} />
    <ScrollView ref={scrollRef} style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Discover</Text>
      <Text style={styles.subtitle}>Enter any URL to reveal its ZodAIc sign.</Text>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="https://..."
          placeholderTextColor="#555"
          value={url}
          onChangeText={setUrl}
          autoCapitalize="none"
          keyboardType="url"
          returnKeyType="go"
          onSubmitEditing={() => handleClassify()}
        />
        <TouchableOpacity style={styles.button} onPress={() => handleClassify()} disabled={loading}>
          <Text style={styles.buttonText}>↗</Text>
        </TouchableOpacity>
      </View>

      {loading && (
        <View style={styles.loadingCard}>
          <ActivityIndicator color="#9b59b6" size="large" />
          <Text style={styles.loadingText}>Reading the digital stars...</Text>
        </View>
      )}

      {result && sign && (
        <View style={[styles.resultCard, { borderColor: sign.color }]}>
          <Text style={styles.resultTitle}>{result.title}</Text>
          <Text style={styles.resultUrl} numberOfLines={1}>{result.url}</Text>

          <View style={styles.divider} />

          <TouchableOpacity onPress={() => setSelectedSignId(sign.id)}>
            <Text style={styles.signSymbol}>{sign.symbol}</Text>
            <Text style={[styles.signName, { color: sign.color }]}>{sign.name} ›</Text>
          </TouchableOpacity>
          <Text style={styles.signAnalog}>Digital {sign.traditional_analog}</Text>
          <Text style={styles.signTagline}>{sign.tagline}</Text>

          <View style={styles.divider} />

          {result.description && (
            <Text style={styles.description}>{result.description}</Text>
          )}

          <View style={styles.confidence}>
            <Text style={styles.confidenceLabel}>Classification confidence</Text>
            <Text style={[styles.confidenceValue, { color: sign.color }]}>
              {Math.round(result.classification_confidence * 100)}%
            </Text>
          </View>

          <View style={styles.traits}>
            {(result.characteristics ?? []).map((c) => (
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

      {filteredSign && (
        <View style={styles.filteredSection}>
          <View style={styles.filteredHeader}>
            <Text style={[styles.filteredTitle, { color: filteredSign.color }]}>
              {filteredSign.symbol} {filteredSign.name} · Top Sites
            </Text>
            <TouchableOpacity onPress={() => router.setParams({ signId: '' })}>
              <Text style={styles.clearFilter}>✕ Clear</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.filteredSubtitle}>Classified at 70%+ confidence</Text>
          {filteredLoading ? (
            <ActivityIndicator color="#9b59b6" style={{ marginTop: 16 }} />
          ) : filteredUrls.length === 0 ? (
            <Text style={styles.filteredEmpty}>No high-confidence sites found for this sign yet. Classify more URLs!</Text>
          ) : (
            filteredUrls.map((item) => (
              <TouchableOpacity key={item.id} style={styles.filteredItem} onPress={() => { setUrl(item.url); setResult(item); setShared(false); scrollRef.current?.scrollTo({ y: 0, animated: true }) }}>
                <View style={styles.filteredItemText}>
                  <Text style={styles.filteredItemTitle} numberOfLines={1}>{item.title}</Text>
                  <Text style={styles.filteredItemUrl} numberOfLines={1}>{item.url}</Text>
                </View>
                <Text style={[styles.filteredConfidence, { color: filteredSign.color }]}>
                  {Math.round(item.classification_confidence * 100)}%
                </Text>
              </TouchableOpacity>
            ))
          )}
        </View>
      )}

      {history.length > 0 && (
        <View style={styles.historySection}>
          <Text style={styles.historyTitle}>Recent</Text>
          {history.map((item) => {
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
      {people.length > 0 && (
        <View style={styles.peopleSection}>
          <Text style={styles.peopleTitle}>People</Text>
          {people.map((person) => {
            const sign = person.primary_zodaic_sign_id ? SIGN_BY_ID[person.primary_zodaic_sign_id] : null
            return (
              <View key={person.id} style={styles.personRow}>
                <TouchableOpacity style={styles.personInfo} onPress={() => setSelectedUserId(person.id)}>
                  <Text style={styles.personAvatar}>{sign?.symbol ?? '☽'}</Text>
                  <View>
                    <Text style={styles.personName}>{person.display_name ?? person.username}</Text>
                    {sign && <Text style={[styles.personSign, { color: sign.color }]}>{sign.name}</Text>}
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.followButton, person.isFollowing && styles.followingButton]}
                  onPress={() => handleFollowToggle(person)}
                  disabled={togglingId === person.id}
                >
                  <Text style={[styles.followButtonText, person.isFollowing && styles.followingButtonText]}>
                    {togglingId === person.id ? '...' : person.isFollowing ? 'Following' : 'Follow'}
                  </Text>
                </TouchableOpacity>
              </View>
            )
          })}
        </View>
      )}
    </ScrollView>
    {currentUserId && (
      <UserProfileSheet
        userId={selectedUserId}
        currentUserId={currentUserId}
        onClose={() => setSelectedUserId(null)}
      />
    )}
    </>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0d1a' },
  content: { padding: 24, paddingTop: 60 },
  title: { fontSize: 28, fontWeight: '800', color: '#fff', marginBottom: 6 },
  subtitle: { color: '#888', fontSize: 15, marginBottom: 24 },
  inputRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  input: {
    flex: 1,
    backgroundColor: '#1a1a2e',
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
    backgroundColor: '#1a1a2e',
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
  filteredSection: { marginBottom: 24 },
  filteredHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  filteredTitle: { fontSize: 16, fontWeight: '800' },
  clearFilter: { color: '#555', fontSize: 13 },
  filteredSubtitle: { color: '#555', fontSize: 12, marginBottom: 12 },
  filteredEmpty: { color: '#555', fontSize: 14, fontStyle: 'italic', textAlign: 'center', paddingVertical: 16 },
  filteredItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a2e', borderRadius: 12, padding: 12, marginBottom: 8 },
  filteredItemText: { flex: 1 },
  filteredItemTitle: { color: '#ddd', fontSize: 14, fontWeight: '600' },
  filteredItemUrl: { color: '#555', fontSize: 11, marginTop: 2 },
  filteredConfidence: { fontSize: 13, fontWeight: '800', marginLeft: 8 },
  historySection: { marginTop: 8 },
  historyTitle: { color: '#9b59b6', fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
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
  peopleSection: { marginTop: 8 },
  peopleTitle: { color: '#9b59b6', fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
  personRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a2e', borderRadius: 12, padding: 12, marginBottom: 8, gap: 10 },
  personInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  personAvatar: { fontSize: 28 },
  personName: { color: '#ddd', fontSize: 14, fontWeight: '600' },
  personSign: { fontSize: 11, fontWeight: '700', marginTop: 2 },
  followButton: { backgroundColor: '#9b59b6', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6 },
  followingButton: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#9b59b6' },
  followButtonText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  followingButtonText: { color: '#9b59b6' },
})
