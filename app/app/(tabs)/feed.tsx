import { useState, useCallback } from 'react'
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from '@/lib/supabase'
import { fetchHoroscope, generateHoroscope, generatePortails, PortAilsResult } from '@/lib/api'
import { SIGN_BY_ID } from '@/constants/signs'
import { useFocusEffect, useRouter } from 'expo-router'
import SignDetailModal from '@/components/SignDetailModal'

const CACHE_TTL_MS = 12 * 60 * 60 * 1000

async function getCached(key: string): Promise<PortAilsResult | null> {
  const raw = await AsyncStorage.getItem(key)
  if (!raw) return null
  const { data, timestamp } = JSON.parse(raw)
  if (Date.now() - timestamp > CACHE_TTL_MS) return null
  return data as PortAilsResult
}

async function setCached(key: string, data: PortAilsResult) {
  await AsyncStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }))
}

const LABEL_COLORS: Record<string, string> = {
  Excellent: '#2ecc71',
  Good: '#9b59b6',
  Neutral: '#888',
  Challenging: '#e67e22',
  Avoid: '#e74c3c',
}

export default function PortAilsScreen() {
  const [loading, setLoading] = useState(true)
  const [primarySignId, setPrimarySignId] = useState<number | null>(null)
  const [portails, setPortails] = useState<PortAilsResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedSignId, setSelectedSignId] = useState<number | null>(null)
  const router = useRouter()

  useFocusEffect(useCallback(() => {
    setLoading(true)
    setError(null)

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('primary_zodaic_sign_id')
        .eq('id', user.id)
        .single()

      if (!profile?.primary_zodaic_sign_id) {
        setError('Complete your profile to unlock PortAils.')
        setLoading(false)
        return
      }

      setPrimarySignId(profile.primary_zodaic_sign_id)

      const cacheKey = `portails_${profile.primary_zodaic_sign_id}`
      const cached = await getCached(cacheKey)
      if (cached) {
        setPortails(cached)
        setLoading(false)
        return
      }

      let h = await fetchHoroscope(profile.primary_zodaic_sign_id)
      if (!h) h = await generateHoroscope(profile.primary_zodaic_sign_id, 'weekly')

      if (!h) {
        setError('Could not load your horoscope. Try again later.')
        setLoading(false)
        return
      }

      try {
        const result = await generatePortails(profile.primary_zodaic_sign_id, h.content, h.themes)
        await setCached(cacheKey, result)
        setPortails(result)
      } catch (e) {
        setError('Could not generate your PortAils reading. Try again later.')
      }

      setLoading(false)
    })
  }, []))

  function handleSignTap(signId: number) {
    router.push({ pathname: '/(tabs)/discover', params: { signId: String(signId) } })
  }

  const primarySign = primarySignId ? SIGN_BY_ID[primarySignId] : null

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#9b59b6" size="large" />
        <Text style={styles.loadingText}>Reading the digital cosmos...</Text>
      </View>
    )
  }

  if (error || !portails) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error ?? 'Something went wrong.'}</Text>
      </View>
    )
  }

  const best = portails.compatibility.slice(0, 3)
  const worst = portails.compatibility.slice(-3).reverse()
  const all = portails.compatibility

  return (
    <>
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>PortAils</Text>
      {primarySign && (
        <Text style={styles.subtitle}>
          <Text style={{ color: primarySign.color }}>{primarySign.symbol} {primarySign.name}</Text>
          {' '}· Today's internet guidance
        </Text>
      )}

      <View style={styles.adviceCard}>
        <Text style={styles.adviceLabel}>✦ Seek</Text>
        <Text style={styles.adviceText}>{portails.best_advice}</Text>
        <View style={styles.adviseDivider} />
        <Text style={styles.adviceLabel}>✕ Avoid</Text>
        <Text style={styles.adviceText}>{portails.avoid_advice}</Text>
      </View>

      <Text style={styles.sectionTitle}>Best Matches Today</Text>
      {best.map((c) => {
        const sign = SIGN_BY_ID[c.sign_id]
        if (!sign) return null
        return (
          <TouchableOpacity key={c.sign_id} style={[styles.matchCard, { borderColor: sign.color }]} onPress={() => handleSignTap(c.sign_id)} onLongPress={() => setSelectedSignId(c.sign_id)}>
            <View style={styles.matchHeader}>
              <Text style={styles.matchSymbol}>{sign.symbol}</Text>
              <View style={styles.matchInfo}>
                <Text style={[styles.matchName, { color: sign.color }]}>{sign.name}</Text>
                <Text style={styles.matchAnalog}>Digital {sign.traditional_analog}</Text>
              </View>
              <View style={[styles.scoreBadge, { backgroundColor: LABEL_COLORS[c.label] ?? '#888' }]}>
                <Text style={styles.scoreText}>{c.score}</Text>
              </View>
            </View>
            <Text style={styles.reasoning}>{c.reasoning}</Text>
            {c.example && (
              <Text style={styles.exampleSite} numberOfLines={1}>e.g. {c.example.title}</Text>
            )}
          </TouchableOpacity>
        )
      })}

      <Text style={styles.sectionTitle}>Approach with Caution</Text>
      {worst.map((c) => {
        const sign = SIGN_BY_ID[c.sign_id]
        if (!sign) return null
        return (
          <TouchableOpacity key={c.sign_id} style={[styles.matchCard, { borderColor: '#2a2a3e' }]} onPress={() => handleSignTap(c.sign_id)} onLongPress={() => setSelectedSignId(c.sign_id)}>
            <View style={styles.matchHeader}>
              <Text style={styles.matchSymbol}>{sign.symbol}</Text>
              <View style={styles.matchInfo}>
                <Text style={styles.matchNameMuted}>{sign.name}</Text>
                <Text style={styles.matchAnalog}>Digital {sign.traditional_analog}</Text>
              </View>
              <View style={[styles.scoreBadge, { backgroundColor: LABEL_COLORS[c.label] ?? '#888' }]}>
                <Text style={styles.scoreText}>{c.score}</Text>
              </View>
            </View>
            <Text style={styles.reasoning}>{c.reasoning}</Text>
          </TouchableOpacity>
        )
      })}

      <Text style={styles.sectionTitle}>Full Compatibility Chart</Text>
      <View style={styles.chartCard}>
        {all.map((c, i) => {
          const sign = SIGN_BY_ID[c.sign_id]
          if (!sign) return null
          return (
            <TouchableOpacity key={c.sign_id} style={styles.chartRow} onPress={() => handleSignTap(c.sign_id)} onLongPress={() => setSelectedSignId(c.sign_id)}>
              <Text style={styles.chartRank}>{i + 1}</Text>
              <Text style={styles.chartSymbol}>{sign.symbol}</Text>
              <Text style={styles.chartName}>{sign.name}</Text>
              <View style={styles.chartBarContainer}>
                <View style={[styles.chartBar, { width: `${c.score}%` as any, backgroundColor: LABEL_COLORS[c.label] ?? '#888' }]} />
              </View>
              <Text style={[styles.chartScore, { color: LABEL_COLORS[c.label] ?? '#888' }]}>{c.score}</Text>
            </TouchableOpacity>
          )
        })}
      </View>
    </ScrollView>
    <SignDetailModal signId={selectedSignId} onClose={() => setSelectedSignId(null)} />
    </>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0d1a' },
  content: { padding: 24, paddingTop: 60, paddingBottom: 40 },
  center: { flex: 1, backgroundColor: '#0d0d1a', justifyContent: 'center', alignItems: 'center', padding: 32, gap: 16 },
  loadingText: { color: '#9b59b6', fontSize: 15 },
  errorText: { color: '#666', fontSize: 15, textAlign: 'center' },
  title: { fontSize: 28, fontWeight: '800', color: '#fff', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#888', marginBottom: 20 },
  adviceCard: { backgroundColor: '#1a1a2e', borderRadius: 16, padding: 18, marginBottom: 24, borderWidth: 1, borderColor: '#2a2a3e' },
  adviceLabel: { color: '#9b59b6', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  adviceText: { color: '#ddd', fontSize: 14, lineHeight: 20 },
  adviseDivider: { height: 1, backgroundColor: '#2a2a3e', marginVertical: 12 },
  sectionTitle: { color: '#9b59b6', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, marginTop: 8 },
  matchCard: { backgroundColor: '#1a1a2e', borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1 },
  matchHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  matchSymbol: { fontSize: 28, marginRight: 12 },
  matchInfo: { flex: 1 },
  matchName: { fontSize: 16, fontWeight: '700' },
  matchNameMuted: { fontSize: 16, fontWeight: '700', color: '#aaa' },
  matchAnalog: { color: '#555', fontSize: 12 },
  scoreBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, minWidth: 40, alignItems: 'center' },
  scoreText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  reasoning: { color: '#bbb', fontSize: 13, lineHeight: 19 },
  exampleSite: { color: '#555', fontSize: 11, marginTop: 6 },
  chartCard: { backgroundColor: '#1a1a2e', borderRadius: 16, padding: 16 },
  chartRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 },
  chartRank: { color: '#555', fontSize: 12, width: 18, textAlign: 'right' },
  chartSymbol: { fontSize: 16, width: 24 },
  chartName: { color: '#ccc', fontSize: 12, width: 90 },
  chartBarContainer: { flex: 1, height: 6, backgroundColor: '#2a2a3e', borderRadius: 3, overflow: 'hidden' },
  chartBar: { height: 6, borderRadius: 3 },
  chartScore: { fontSize: 12, fontWeight: '700', width: 28, textAlign: 'right' },
})
