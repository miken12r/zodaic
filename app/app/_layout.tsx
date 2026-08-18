import { useEffect } from 'react'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { supabase } from '@/lib/supabase'
import { useRouter, useSegments } from 'expo-router'
import { useState } from 'react'
import { Session } from '@supabase/supabase-js'
import { View, ActivityIndicator } from 'react-native'

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
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
    if (loading) return
    const inAuthGroup = segments[0] === '(auth)'
    const inTabsGroup = segments[0] === '(tabs)'
    const inModal = segments[0] === 'article'
    if (!session && !inAuthGroup) {
      router.replace('/(auth)/sign-in')
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)/home')
    } else if (session && !inTabsGroup && !inAuthGroup && !inModal) {
      router.replace('/(tabs)/home')
    }
  }, [session, loading, segments])

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0d0d1a' }}>
        <ActivityIndicator color="#9b59b6" />
      </View>
    )
  }

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="article" options={{ presentation: 'modal' }} />
      </Stack>
      <StatusBar style="light" />
    </>
  )
}
