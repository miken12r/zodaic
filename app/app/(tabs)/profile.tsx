import { useEffect, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native'
import { supabase } from '@/lib/supabase'
import { Profile, UserSignAffinity, Horoscope } from '@/types'
import { fetchUserAffinities, fetchHoroscope, generateHoroscope, fetchFollowCounts, deleteAccount } from '@/lib/api'
import { SIGN_BY_ID } from '@/constants/signs'
import FeedSettings from '@/components/FeedSettings'
import {
  DATE_FORMAT, toDisplayDate, toISODate, getZodaicSignId,
  validateUsername, validateDisplayName, validateBirthDate, profileSaveErrorMessage,
} from '@/lib/profileFields'

export default function ProfileScreen() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [usernameError, setUsernameError] = useState('')
  const [displayNameError, setDisplayNameError] = useState('')
  const [birthDateError, setBirthDateError] = useState('')
  const [affinities, setAffinities] = useState<UserSignAffinity[]>([])
  const [horoscope, setHoroscope] = useState<Horoscope | null>(null)
  const [followCounts, setFollowCounts] = useState<{ followers: number; following: number } | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const [{ data }, affinityData, counts] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        fetchUserAffinities(user.id).catch(() => []),
        fetchFollowCounts(user.id),
      ])
      setFollowCounts(counts)
      if (data) {
        setProfile(data)
        setUsername(data.username ?? '')
        setDisplayName(data.display_name ?? '')
        setBirthDate(toDisplayDate(data.birth_date ?? ''))
        if (data.primary_zodaic_sign_id) {
          let h = await fetchHoroscope(data.primary_zodaic_sign_id)
          if (!h) h = await generateHoroscope(data.primary_zodaic_sign_id, 'weekly')
          setHoroscope(h)
        }
      }
      setAffinities(affinityData.slice(0, 5))
    })
  }, [])

  function handleUsernameChange(value: string) {
    setUsername(value)
    setUsernameError(validateUsername(value))
  }

  async function saveProfile() {
    // All three fields are required (see profileFields.ts).
    const err = validateUsername(username)
    const nameErr = validateDisplayName(displayName)
    const dateErr = validateBirthDate(birthDate)
    setUsernameError(err)
    setDisplayNameError(nameErr)
    setBirthDateError(dateErr)
    if (err || nameErr || dateErr) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    const isoDate = toISODate(birthDate.trim())
    const primary_zodaic_sign_id = getZodaicSignId(isoDate)
    const { error } = await supabase.from('profiles').upsert({
      id: user.id,
      username,
      display_name: displayName.trim(),
      birth_date: isoDate,
      ...(primary_zodaic_sign_id ? { primary_zodaic_sign_id } : {}),
    })

    if (error) {
      if (error.code === '23505') setUsernameError(profileSaveErrorMessage(error))
      else Alert.alert('Error', profileSaveErrorMessage(error))
    } else {
      const { data: updated } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (updated) {
        setProfile(updated)
        setUsername(updated.username ?? '')
        setDisplayName(updated.display_name ?? '')
        setBirthDate(toDisplayDate(updated.birth_date ?? ''))
        if (updated.primary_zodaic_sign_id && updated.primary_zodaic_sign_id !== profile?.primary_zodaic_sign_id) {
          let h = await fetchHoroscope(updated.primary_zodaic_sign_id)
          if (!h) h = await generateHoroscope(updated.primary_zodaic_sign_id, 'weekly')
          setHoroscope(h)
        }
      }
      Alert.alert('Saved', 'Your profile has been updated.')
    }
    setSaving(false)
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  const [deleting, setDeleting] = useState(false)

  function confirmDeleteAccount() {
    Alert.alert(
      'Delete Account',
      'This permanently deletes your account, profile, follows, and shared posts. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: handleDeleteAccount },
      ]
    )
  }

  async function handleDeleteAccount() {
    setDeleting(true)
    try {
      await deleteAccount()
    } catch {
      Alert.alert('Error', 'Could not delete your account. Please try again.')
      setDeleting(false)
    }
  }

  const primarySign = profile?.primary_zodaic_sign_id ? SIGN_BY_ID[profile.primary_zodaic_sign_id] : null

  return (
    <View style={styles.screen}>
      <View style={styles.fixedHeader}>
        <Text style={styles.title}>Profile</Text>
        <TouchableOpacity onPress={signOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {followCounts && (
        <View style={styles.countsRow}>
          <View style={styles.countItem}>
            <Text style={styles.countNumber}>{followCounts.followers}</Text>
            <Text style={styles.countLabel}>Followers</Text>
          </View>
          <View style={styles.countDivider} />
          <View style={styles.countItem}>
            <Text style={styles.countNumber}>{followCounts.following}</Text>
            <Text style={styles.countLabel}>Following</Text>
          </View>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.label}>Username</Text>
        <TextInput
          style={[styles.input, usernameError ? styles.inputError : {}]}
          value={username}
          onChangeText={handleUsernameChange}
          placeholder="your_username"
          placeholderTextColor="#555"
          autoCapitalize="none"
          autoCorrect={false}
        />
        {usernameError ? <Text style={styles.fieldError}>{usernameError}</Text> : null}

        <Text style={styles.label}>Display Name</Text>
        <TextInput
          style={[styles.input, displayNameError ? styles.inputError : {}]}
          value={displayName}
          onChangeText={(v) => { setDisplayName(v); if (displayNameError) setDisplayNameError(validateDisplayName(v)) }}
          placeholder="Your Name"
          placeholderTextColor="#555"
          maxLength={50}
        />
        {displayNameError ? <Text style={styles.fieldError}>{displayNameError}</Text> : null}

        <Text style={styles.label}>Birth Date</Text>
        <TextInput
          style={[styles.input, birthDateError ? styles.inputError : {}]}
          value={birthDate}
          onChangeText={(v) => { setBirthDate(v); if (birthDateError) setBirthDateError(validateBirthDate(v)) }}
          placeholder={DATE_FORMAT}
          placeholderTextColor="#555"
          keyboardType="numbers-and-punctuation"
        />
        {birthDateError ? <Text style={styles.fieldError}>{birthDateError}</Text> : null}
        <Text style={styles.hint}>Enter as {DATE_FORMAT}. Used to calculate your digital zodiac sign.</Text>

        <TouchableOpacity style={[styles.saveButton, (saving || !!usernameError) && styles.saveButtonDisabled]} onPress={saveProfile} disabled={saving || !!usernameError}>
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

      <FeedSettings />

      <TouchableOpacity style={styles.deleteAccountButton} onPress={confirmDeleteAccount} disabled={deleting}>
        <Text style={styles.deleteAccountText}>{deleting ? 'Deleting…' : 'Delete Account'}</Text>
      </TouchableOpacity>
    </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0d0d1a' },
  fixedHeader: {
    paddingHorizontal: 24, paddingTop: 60, paddingBottom: 16,
    backgroundColor: '#0d0d1a',
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  container: { flex: 1, backgroundColor: '#0d0d1a' },
  content: { padding: 24, paddingTop: 8, paddingBottom: 32 },
  title: { fontSize: 28, fontWeight: '800', color: '#fff' },
  signOutText: { color: '#9b59b6', fontSize: 14, fontWeight: '600' },
  deleteAccountButton: {
    alignItems: 'center', marginTop: 32, paddingTop: 20,
    borderTopWidth: 1, borderTopColor: '#1a1a2e',
  },
  deleteAccountText: { color: '#994444', fontSize: 13, fontWeight: '600' },
  countsRow: { flexDirection: 'row', backgroundColor: '#1a1a2e', borderRadius: 16, padding: 16, marginBottom: 20 },
  countItem: { flex: 1, alignItems: 'center' },
  countNumber: { color: '#fff', fontSize: 22, fontWeight: '800' },
  countLabel: { color: '#555', fontSize: 12, marginTop: 2 },
  countDivider: { width: 1, backgroundColor: '#2a2a3e', marginVertical: 4 },
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
  saveButtonDisabled: { opacity: 0.4 },
  saveButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  inputError: { borderColor: '#e74c3c' },
  fieldError: { color: '#e74c3c', fontSize: 12, marginTop: -12, marginBottom: 16 },
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
