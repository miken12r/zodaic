import { useState, useRef } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Keyboard, KeyboardAvoidingView, Platform } from 'react-native'
import { supabase } from '@/lib/supabase'

export default function SignInScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in')
  const [confirmEmail, setConfirmEmail] = useState('')
  const emailRef = useRef('')
  const passwordRef = useRef('')
  const confirmEmailRef = useRef('')

  // Email isn't verified (Supabase auto-confirms sign-ups), so a mistyped address
  // becomes a real, empty account the moment it's submitted — this happened
  // repeatedly with the App Review demo email. Sign-up therefore asks for the
  // email twice and shows it back before creating anything, and a failed sign-in
  // points at typos rather than at "Sign up".
  async function handleAuth() {
    Keyboard.dismiss()
    const currentEmail = emailRef.current.trim()
    const currentPassword = passwordRef.current
    if (!currentEmail || !currentPassword) {
      Alert.alert('Missing fields', 'Please enter your email and password.')
      return
    }
    if (mode === 'sign-in') {
      await run(() => supabase.auth.signInWithPassword({ email: currentEmail, password: currentPassword }))
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(currentEmail)) {
      Alert.alert('Check your email', "That doesn't look like a complete email address.")
      return
    }
    if (currentEmail.toLowerCase() !== confirmEmailRef.current.trim().toLowerCase()) {
      Alert.alert('Emails don\'t match', 'Please type the same email address in both fields.')
      return
    }
    Alert.alert(
      'Create your account?',
      `Your account will use:\n\n${currentEmail}\n\nMake sure it's spelled right — it's how you'll sign in.`,
      [
        { text: 'Edit', style: 'cancel' },
        { text: 'Create', onPress: () => run(() => supabase.auth.signUp({ email: currentEmail, password: currentPassword })) },
      ]
    )
  }

  async function run(request: () => Promise<{ error: { message: string; code?: string } | null }>) {
    setLoading(true)
    try {
      const { error } = await request()
      if (!error) return
      if (mode === 'sign-in' && (error.code === 'invalid_credentials' || /invalid login credentials/i.test(error.message))) {
        Alert.alert('Couldn\'t sign in', 'No account matches that email and password. Check the email for typos and try again.')
      } else {
        Alert.alert('Error', error.message)
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Something went wrong. Check your connection.')
    } finally {
      setLoading(false)
    }
  }

  function switchMode() {
    setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')
    setConfirmEmail('')
    confirmEmailRef.current = ''
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#0d0d1a' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.container}>
      <Text style={styles.logo}>ZodAIc</Text>
      <Text style={styles.tagline}>Find your place in the digital cosmos.</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#666"
        value={email}
        onChangeText={(t) => { setEmail(t); emailRef.current = t }}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType={mode === 'sign-in' ? 'username' : 'emailAddress'}
      />
      {mode === 'sign-up' && (
        <TextInput
          style={styles.input}
          placeholder="Confirm email"
          placeholderTextColor="#666"
          value={confirmEmail}
          onChangeText={(t) => { setConfirmEmail(t); confirmEmailRef.current = t }}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          // Must be typed, not autofilled, or it can't catch a typo.
          textContentType="none"
          autoComplete="off"
        />
      )}
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor="#666"
        value={password}
        onChangeText={(t) => { setPassword(t); passwordRef.current = t }}
        secureTextEntry
      />

      <TouchableOpacity style={styles.button} onPress={handleAuth} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? '...' : mode === 'sign-in' ? 'Sign In' : 'Create Account'}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={switchMode}>
        <Text style={styles.switchText}>
          {mode === 'sign-in' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
        </Text>
      </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0d1a', justifyContent: 'center', padding: 32 },
  logo: { fontSize: 48, fontWeight: '800', color: '#9b59b6', textAlign: 'center', marginBottom: 8 },
  tagline: { color: '#888', textAlign: 'center', marginBottom: 48, fontSize: 15 },
  input: {
    backgroundColor: '#1a1a2e',
    color: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#2a2a3e',
  },
  button: {
    backgroundColor: '#9b59b6',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  switchText: { color: '#9b59b6', textAlign: 'center', fontSize: 14 },
})
