import { useEffect, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { deleteAccount } from '@/lib/api'
import { SIGN_BY_ID } from '@/constants/signs'
import {
  DATE_FORMAT, toDisplayDate, toISODate, getZodaicSignId,
  validateUsername, validateDisplayName, validateBirthDate, profileSaveErrorMessage,
} from '@/lib/profileFields'
import { notifyProfileCompleted } from '@/lib/profileStatus'

// First-run setup: username, display name, and birth date are required before
// using the app (the root layout routes incomplete profiles here). Nothing is
// verified beyond format. Sign out / delete account stay reachable because a
// user who never finishes setup can't get to the Profile tab.
export default function SetupScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [errors, setErrors] = useState({ username: '', displayName: '', birthDate: '' })
  const [saving, setSaving] = useState(false)

  // Prefill anything already saved (e.g. a username from an older build).
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data } = await supabase.from('profiles').select('username, display_name, birth_date').eq('id', user.id).single()
      if (!data) return
      setUsername(data.username ?? '')
      setDisplayName(data.display_name ?? '')
      setBirthDate(toDisplayDate(data.birth_date ?? ''))
    })
  }, [])

  const previewSignId = validateBirthDate(birthDate) ? null : getZodaicSignId(toISODate(birthDate.trim()))
  const previewSign = previewSignId ? SIGN_BY_ID[previewSignId] : null

  async function save() {
    const next = {
      username: validateUsername(username),
      displayName: validateDisplayName(displayName),
      birthDate: validateBirthDate(birthDate),
    }
    setErrors(next)
    if (next.username || next.displayName || next.birthDate) return

    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }
    const isoDate = toISODate(birthDate.trim())
    const { error } = await supabase.from('profiles').upsert({
      id: user.id,
      username,
      display_name: displayName.trim(),
      birth_date: isoDate,
      primary_zodaic_sign_id: getZodaicSignId(isoDate),
    })
    setSaving(false)
    if (error) {
      if (error.code === '23505') setErrors((e) => ({ ...e, username: profileSaveErrorMessage(error) }))
      else Alert.alert('Error', profileSaveErrorMessage(error))
      return
    }
    notifyProfileCompleted()
    router.replace('/(tabs)/home')
  }

  function confirmDelete() {
    Alert.alert(
      'Delete Account',
      'This permanently deletes your account. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive', onPress: async () => {
            try { await deleteAccount() } catch { Alert.alert('Error', 'Could not delete your account. Please try again.') }
          },
        },
      ]
    )
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 24 }]} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Set up your profile</Text>
        <Text style={styles.subtitle}>Three quick things so friends can find you and the voices know your sign.</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Username</Text>
          <TextInput
            style={[styles.input, errors.username ? styles.inputError : {}]}
            value={username}
            onChangeText={(v) => { setUsername(v); if (errors.username) setErrors((e) => ({ ...e, username: validateUsername(v) })) }}
            placeholder="your_username"
            placeholderTextColor="#555"
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={30}
          />
          {errors.username ? <Text style={styles.fieldError}>{errors.username}</Text> : <Text style={styles.hint}>Unique handle others use to find you.</Text>}

          <Text style={styles.label}>Display Name</Text>
          <TextInput
            style={[styles.input, errors.displayName ? styles.inputError : {}]}
            value={displayName}
            onChangeText={(v) => { setDisplayName(v); if (errors.displayName) setErrors((e) => ({ ...e, displayName: validateDisplayName(v) })) }}
            placeholder="Your Name"
            placeholderTextColor="#555"
            maxLength={50}
          />
          {errors.displayName ? <Text style={styles.fieldError}>{errors.displayName}</Text> : <Text style={styles.hint}>Shown on your shares and profile.</Text>}

          <Text style={styles.label}>Birth Date</Text>
          <TextInput
            style={[styles.input, errors.birthDate ? styles.inputError : {}]}
            value={birthDate}
            onChangeText={(v) => { setBirthDate(v); if (errors.birthDate) setErrors((e) => ({ ...e, birthDate: validateBirthDate(v) })) }}
            placeholder={DATE_FORMAT}
            placeholderTextColor="#555"
            keyboardType="numbers-and-punctuation"
          />
          {errors.birthDate
            ? <Text style={styles.fieldError}>{errors.birthDate}</Text>
            : <Text style={styles.hint}>Enter as {DATE_FORMAT}. Sets your digital sign; never shown to others.</Text>}

          {previewSign && (
            <Text style={[styles.signPreview, { color: previewSign.color }]}>
              {previewSign.symbol} You're {previewSign.name} · Digital {previewSign.traditional_analog} {previewSign.traditional_glyph}
            </Text>
          )}

          <TouchableOpacity style={[styles.saveButton, saving && styles.saveButtonDisabled]} onPress={save} disabled={saving}>
            <Text style={styles.saveButtonText}>{saving ? 'Saving…' : 'Continue'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <TouchableOpacity onPress={() => supabase.auth.signOut()}>
            <Text style={styles.footerLink}>Sign out</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={confirmDelete}>
            <Text style={[styles.footerLink, styles.deleteLink]}>Delete account</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0d0d1a' },
  content: { padding: 24, paddingBottom: 40 },
  title: { color: '#fff', fontSize: 26, fontWeight: '800', marginBottom: 8 },
  subtitle: { color: '#888', fontSize: 15, lineHeight: 22, marginBottom: 24 },
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
  inputError: { borderColor: '#e74c3c' },
  hint: { color: '#555', fontSize: 12, marginTop: -12, marginBottom: 16 },
  fieldError: { color: '#e74c3c', fontSize: 12, marginTop: -12, marginBottom: 16 },
  signPreview: { fontSize: 14, fontWeight: '700', marginBottom: 16 },
  saveButton: { backgroundColor: '#9b59b6', borderRadius: 12, padding: 14, alignItems: 'center' },
  saveButtonDisabled: { opacity: 0.4 },
  saveButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  footer: { flexDirection: 'row', justifyContent: 'center', gap: 32, marginTop: 8 },
  footerLink: { color: '#888', fontSize: 14, fontWeight: '600' },
  deleteLink: { color: '#e74c3c' },
})
