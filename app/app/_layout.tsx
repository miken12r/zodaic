import { useEffect, useState } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { supabase } from '@/lib/supabase'
import { Session } from '@supabase/supabase-js'
import { View, ActivityIndicator } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { isProfileComplete } from '@/lib/profileFields'
import { onProfileCompleted } from '@/lib/profileStatus'

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  // null = not yet known for this session. Incomplete profiles (missing username,
  // display name, or birth date) are routed to /setup before anything else.
  const [profileComplete, setProfileComplete] = useState<boolean | null>(null)
  const router = useRouter()
  const segments = useSegments()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    const userId = session?.user.id
    if (!userId) { setProfileComplete(null); return }
    let cancelled = false
    supabase.from('profiles').select('username, display_name, birth_date').eq('id', userId).single()
      .then(({ data }) => { if (!cancelled) setProfileComplete(isProfileComplete(data)) })
    return () => { cancelled = true }
  }, [session?.user.id])

  useEffect(() => onProfileCompleted(() => setProfileComplete(true)), [])

  useEffect(() => {
    if (loading) return
    const inAuthGroup = segments[0] === '(auth)'
    const inTabsGroup = segments[0] === '(tabs)'
    const inModal = segments[0] === 'article'
    const inSetup = segments[0] === 'setup'
    if (!session) {
      if (!inAuthGroup) router.replace('/(auth)/sign-in')
      return
    }
    if (profileComplete === null) return
    if (!profileComplete) {
      if (!inSetup) router.replace('/setup')
    } else if (inAuthGroup || inSetup || (!inTabsGroup && !inModal)) {
      router.replace('/(tabs)/home')
    }
  }, [session, loading, profileComplete, segments, router])

  if (loading || (session && profileComplete === null)) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0d0d1a' }}>
        <ActivityIndicator color="#9b59b6" />
      </View>
    )
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="setup" options={{ gestureEnabled: false }} />
        <Stack.Screen name="article" options={{ presentation: 'modal' }} />
      </Stack>
      <StatusBar style="light" />
    </GestureHandlerRootView>
  )
}
