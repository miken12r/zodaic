import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import { WebView } from 'react-native-webview'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { SIGN_BY_ID } from '@/constants/signs'
import { createShare } from '@/lib/api'
import { supabase } from '@/lib/supabase'
import SignDetailModal from '@/components/SignDetailModal'

export default function ArticleScreen() {
  const { url, contentId, signId, title, confidence } = useLocalSearchParams<{
    url: string
    contentId: string
    signId: string
    title: string
    confidence: string
  }>()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [webLoading, setWebLoading] = useState(true)
  const [sharing, setSharing] = useState(false)
  const [shared, setShared] = useState(false)
  const [signModalVisible, setSignModalVisible] = useState(false)

  const sign = signId ? SIGN_BY_ID[parseInt(signId)] : null
  const confidencePct = confidence ? Math.round(parseFloat(confidence) * 100) : null

  async function handleShare() {
    if (!contentId) return
    setSharing(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not logged in')
      await createShare(user.id, 'sign_reading', contentId, `${title} is ${sign?.name} energy.`)
      setShared(true)
    } catch {
      Alert.alert('Error', 'Could not share this article.')
    } finally {
      setSharing(false)
    }
  }

  return (
    <>
    <SignDetailModal signId={signModalVisible ? sign?.id ?? null : null} onClose={() => setSignModalVisible(false)} />
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Sign header bar */}
      <View style={[styles.header, sign ? { borderBottomColor: sign.color } : {}]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        {sign && (
          <TouchableOpacity style={styles.signInfo} onPress={() => setSignModalVisible(true)}>
            <Text style={styles.signSymbol}>{sign.symbol}</Text>
            <View>
              <Text style={[styles.signName, { color: sign.color }]}>{sign.name} ›</Text>
              {confidencePct && (
                <Text style={styles.signConfidence}>{confidencePct}% match</Text>
              )}
            </View>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.shareButton, shared && styles.shareButtonDone]}
          onPress={handleShare}
          disabled={sharing || shared || !contentId}
        >
          <Text style={styles.shareButtonText}>
            {shared ? '✓' : sharing ? '...' : '↑'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Article title */}
      {title ? (
        <View style={styles.titleBar}>
          <Text style={styles.titleText} numberOfLines={2}>{title}</Text>
        </View>
      ) : null}

      {/* WebView */}
      {url ? (
        <>
          {webLoading && (
            <View style={styles.webLoading}>
              <ActivityIndicator color="#9b59b6" size="large" />
            </View>
          )}
          <WebView
            source={{ uri: url }}
            style={styles.webview}
            onLoadStart={() => setWebLoading(true)}
            onLoadEnd={() => setWebLoading(false)}
          />
        </>
      ) : (
        <View style={styles.noUrl}>
          <Text style={styles.noUrlText}>No URL available for this article.</Text>
        </View>
      )}
    </View>
    </>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0d1a' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 2, borderBottomColor: '#9b59b6',
    backgroundColor: '#0d0d1a',
  },
  backButton: { paddingRight: 12 },
  backText: { color: '#9b59b6', fontSize: 15, fontWeight: '600' },
  signInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  signSymbol: { fontSize: 24 },
  signName: { fontSize: 13, fontWeight: '800' },
  signConfidence: { color: '#555', fontSize: 11 },
  shareButton: {
    backgroundColor: '#9b59b6', borderRadius: 20,
    width: 36, height: 36, justifyContent: 'center', alignItems: 'center',
  },
  shareButtonDone: { backgroundColor: '#2ecc71' },
  shareButtonText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  titleBar: { backgroundColor: '#1a1a2e', paddingHorizontal: 16, paddingVertical: 10 },
  titleText: { color: '#ddd', fontSize: 13, lineHeight: 19 },
  webview: { flex: 1 },
  webLoading: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0d0d1a', zIndex: 10 },
  noUrl: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  noUrlText: { color: '#555', fontSize: 15 },
})
