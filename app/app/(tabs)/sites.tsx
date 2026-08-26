import { useState, useCallback } from 'react'
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Linking } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { fetchSites, followSite, unfollowSite, Site } from '@/lib/api'
import { SIGN_BY_ID, ZODAIC_SIGNS } from '@/constants/signs'
import SignDetailModal from '@/components/SignDetailModal'

export default function SitesScreen() {
  const [userId, setUserId] = useState<string | null>(null)
  const [sites, setSites] = useState<Site[]>([])
  const [loading, setLoading] = useState(true)
  const [filterSignId, setFilterSignId] = useState<number | null>(null)
  const [showFollowing, setShowFollowing] = useState(false)
  const [selectedSignId, setSelectedSignId] = useState<number | null>(null)
  const router = useRouter()

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

  const displayed = showFollowing ? sites.filter((s) => s.is_following) : sites

  const renderHeader = () => (
    <>
      <Text style={styles.title}>Sites</Text>

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
      <FlatList
        style={styles.container}
        contentContainerStyle={styles.list}
        data={displayed}
        keyExtractor={(s) => s.id}
        ListHeaderComponent={renderHeader}
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
      <SignDetailModal signId={selectedSignId} onClose={() => setSelectedSignId(null)} />
    </>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0d1a' },
  list: { padding: 16, paddingTop: 60, paddingBottom: 32 },
  center: { flex: 1, backgroundColor: '#0d0d1a', justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 28, fontWeight: '800', color: '#fff', marginBottom: 16 },
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
})
