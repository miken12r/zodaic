import { useEffect, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native'
import { supabase } from '@/lib/supabase'
import { Profile, UserSignAffinity, Horoscope } from '@/types'
import { fetchUserAffinities, fetchHoroscope, generateHoroscope } from '@/lib/api'
import { SIGN_BY_ID } from '@/constants/signs'

function getZodaicSignId(birthDate: string): number | null {
  const date = new Date(birthDate)
  if (isNaN(date.getTime())) return null
  const m = date.getUTCMonth() + 1
  const d = date.getUTCDate()
  if ((m === 3 && d >= 21) || (m === 4 && d <= 19)) return 1
  if ((m === 4 && d >= 20) || (m === 5 && d <= 20)) return 2
  if ((m === 5 && d >= 21) || (m === 6 && d <= 20)) return 3
  if ((m === 6 && d >= 21) || (m === 7 && d <= 22)) return 4
  if ((m === 7 && d >= 23) || (m === 8 && d <= 22)) return 5
  if ((m === 8 && d >= 23) || (m === 9 && d <= 22)) return 6
  if ((m === 9 && d >= 23) || (m === 10 && d <= 22)) return 7
  if ((m === 10 && d >= 23) || (m === 11 && d <= 21)) return 8
  if ((m === 11 && d >= 22) || (m === 12 && d <= 21)) return 9
  if ((m === 12 && d >= 22) || (m === 1 && d <= 19)) return 10
  if ((m === 1 && d >= 20) || (m === 2 && d <= 18)) return 11
  return 12
}

export default function ProfileScreen() {
  const [userId, setUserId] = useState<string | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [affinities, setAffinities] = useState<UserSignAffinity[]>([])
  const [horoscope, setHoroscope] = useState<Horoscope | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      setUserId(user.id)
      const [{ data }, affinityData] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        fetchUserAffinities(user.id).catch(() => []),
      ])
      if (data) {
        setProfile(data)
        setUsername(data.username ?? '')
        setDisplayName(data.display_name ?? '')
        setBirthDate(data.birth_date ?? '')
        if (data.primary_zodaic_sign_id) {
          let h = await fetchHoroscope(data.primary_zodaic_sign_id)
          if (!h) h = await generateHoroscope(data.primary_zodaic_sign_id, 'weekly')
          setHoroscope(h)
        }
      }
      setAffinities(affinityData.slice(0, 5))
    })
  }, [])

  async function saveProfile() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const primary_zodaic_sign_id = birthDate ? getZodaicSignId(birthDate) : null
    const { error } = await supabase.from('profiles').upsert({
      id: user.id,
      username,
      display_name: displayName || null,
      birth_date: birthDate || null,
      ...(primary_zodaic_sign_id ? { primary_zodaic_sign_id } : {}),
    })

    if (error) Alert.alert('Error', error.message)
    else {
      if (primary_zodaic_sign_id) setProfile((p) => p ? { ...p, primary_zodaic_sign_id } : p)
      Alert.alert('Saved', 'Your profile has been updated.')
    }
    setSaving(false)
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  const primarySign = profile?.primary_zodaic_sign_id ? SIGN_BY_ID[profile.primary_zodaic_sign_id] : null

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Profile</Text>
        <TouchableOpacity onPress={signOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Username</Text>
        <TextInput
          style={styles.input}
          value={username}
          onChangeText={setUsername}
          placeholder="your_username"
          placeholderTextColor="#555"
          autoCapitalize="none"
        />

        <Text style={styles.label}>Display Name</Text>
        <TextInput
          style={styles.input}
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="Your Name"
          placeholderTextColor="#555"
        />

        <Text style={styles.label}>Birth Date</Text>
        <TextInput
          style={styles.input}
          value={birthDate}
          onChangeText={setBirthDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="#555"
        />
        <Text style={styles.hint}>Used to calculate your digital zodiac sign.</Text>

        <TouchableOpacity style={styles.saveButton} onPress={saveProfile} disabled={saving}>
          <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save Profile'}</Text>
        </TouchableOpacity>
      </View>

      {primarySign && (
        <View style={styles.cosmosSection}>
          <Text style={styles.cosmosTitle}>My Digital Cosmos</Text>

          <View style={[styles.signCard, { borderColor: primarySign.color }]}>
            <Text style={styles.signSymbol}>{primarySign.symbol}</Text>
            <Text style={[styles.signName, { color: primarySign.color }]}>{primarySign.name}</Text>
            <Text style={styles.signAnalog}>Digital {primarySign.traditional_analog}</Text>
            <Text style={styles.signTagline}>{primarySign.tagline}</Text>
          </View>

          {horoscope && (
            <View style={styles.card}>
              <Text style={styles.label}>This Week's Reading</Text>
              <Text style={styles.horoscopeText}>{horoscope.content}</Text>
              <View style={styles.themes}>
                {horoscope.themes.map((t) => (
                  <View key={t} style={styles.theme}>
                    <Text style={styles.themeText}>{t}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {affinities.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.label}>Top Affinities</Text>
              {affinities.map((a) => {
                const s = SIGN_BY_ID[a.zodaic_sign_id]
                return (
                  <View key={a.id} style={styles.affinityRow}>
                    <Text style={styles.affinitySymbol}>{s?.symbol}</Text>
                    <Text style={styles.affinityName}>{s?.name}</Text>
                    <Text style={[styles.affinityScore, { color: s?.color }]}>
                      {Math.round(a.affinity_score * 100)}%
                    </Text>
                  </View>
                )
              })}
            </View>
          )}
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0d1a' },
  content: { padding: 24, paddingTop: 60, paddingBottom: 32 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  title: { fontSize: 28, fontWeight: '800', color: '#fff' },
  signOutText: { color: '#9b59b6', fontSize: 14, fontWeight: '600' },
  card: { backgroundColor: '#1a1a2e', borderRadius: 20, padding: 20, marginBottom: 16 },
  label: { color: '#9b59b6', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  input: {
    backgroundColor: '#0d0d1a',
    color: '#fff',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2a2a3e',
  },
  hint: { color: '#555', fontSize: 12, marginTop: -12, marginBottom: 16 },
  saveButton: { backgroundColor: '#9b59b6', borderRadius: 12, padding: 14, alignItems: 'center' },
  saveButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  cosmosSection: { marginTop: 8 },
  cosmosTitle: { fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 16 },
  signCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    marginBottom: 16,
  },
  signSymbol: { fontSize: 48, marginBottom: 8 },
  signName: { fontSize: 24, fontWeight: '800', marginBottom: 4 },
  signAnalog: { color: '#888', fontSize: 13, marginBottom: 8 },
  signTagline: { color: '#ccc', fontSize: 15, fontStyle: 'italic', textAlign: 'center' },
  affinityRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  affinitySymbol: { fontSize: 20, marginRight: 10 },
  affinityName: { flex: 1, color: '#ddd', fontSize: 15 },
  affinityScore: { fontSize: 16, fontWeight: '700' },
  horoscopeText: { color: '#ddd', fontSize: 15, lineHeight: 24, marginBottom: 12 },
  themes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  theme: { backgroundColor: '#2a1a3e', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  themeText: { color: '#9b59b6', fontSize: 12 },
})
