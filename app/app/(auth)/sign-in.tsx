import { useState, useRef } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Keyboard, KeyboardAvoidingView, Platform } from 'react-native'
import { supabase } from '@/lib/supabase'

export default function SignInScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in')
  const emailRef = useRef('')
  const passwordRef = useRef('')

  async function handleAuth() {
    Keyboard.dismiss()
    const currentEmail = emailRef.current
    const currentPassword = passwordRef.current
    if (!currentEmail || !currentPassword) {
      Alert.alert('Missing fields', 'Please enter your email and password.')
      return
    }
    setLoading(true)
    try {
      const { error } =
        mode === 'sign-in'
          ? await supabase.auth.signInWithPassword({ email: currentEmail, password: currentPassword })
          : await supabase.auth.signUp({ email: currentEmail, password: currentPassword })

      if (error) Alert.alert('Error', error.message)
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Something went wrong. Check your connection.')
    } finally {
      setLoading(false)
    }
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
        keyboardType="email-address"
      />
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

      <TouchableOpacity onPress={() => setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')}>
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
