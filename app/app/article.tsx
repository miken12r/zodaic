import { useState, useEffect, useRef } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Modal, ScrollView } from 'react-native'
import { WebView } from 'react-native-webview'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { SIGN_BY_ID } from '@/constants/signs'
import { createShare, generateLens } from '@/lib/api'
import { supabase } from '@/lib/supabase'
import SignDetailModal from '@/components/SignDetailModal'

export default function ArticleScreen() {
  const { url, contentId, signId, title, confidence, characteristics } = useLocalSearchParams<{
    url: string
    contentId: string
    signId: string
    title: string
    confidence: string
    characteristics: string
  }>()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [webLoading, setWebLoading] = useState(true)
  const [sharing, setSharing] = useState(false)
  const [shared, setShared] = useState(false)
  const [signModalVisible, setSignModalVisible] = useState(false)
  const [lensVisible, setLensVisible] = useState(false)
  const [lensText, setLensText] = useState<string | null>(null)
  const [lensLoading, setLensLoading] = useState(false)
  const lensRef = useRef<string | null>(null)

  const sign = signId ? SIGN_BY_ID[parseInt(signId)] : null
  const confidencePct = confidence ? Math.round(parseFloat(confidence) * 100) : null

  // Start fetching the lens in the background as soon as the screen mounts
  useEffect(() => {
    if (!contentId || !url || !signId) return
    let cancelled = false
    async function prefetch() {
      try {
        const parsed = characteristics ? JSON.parse(characteristics as string) : []
        const text = await generateLens({
          content_id: contentId as string,
          url: url as string,
          zodaic_sign_id: parseInt(signId as string),
          title: title as string | undefined,
          characteristics: parsed,
        })
        if (!cancelled) {
          lensRef.current = text
          setLensText(text)
        }
      } catch {
        // silent — user can retry by tapping the button
      }
    }
    prefetch()
    return () => { cancelled = true }
  }, [contentId])

  async function handleLensOpen() {
    setLensVisible(true)
    if (lensRef.current) return
    setLensLoading(true)
    try {
      const parsed = characteristics ? JSON.parse(characteristics as string) : []
      const text = await generateLens({
        content_id: contentId as string,
        url: url as string,
        zodaic_sign_id: parseInt(signId as string),
        title: title as string | undefined,
        characteristics: parsed,
      })
      lensRef.current = text
      setLensText(text)
    } catch {
      Alert.alert('Error', 'Could not generate lens. Try again.')
      setLensVisible(false)
    } finally {
      setLensLoading(false)
    }
  }

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

      {/* Article title + lens button */}
      {title ? (
        <View style={styles.titleBar}>
          <Text style={styles.titleText} numberOfLines={2}>{title}</Text>
          {sign && contentId && (
            <TouchableOpacity style={[styles.lensButton, { borderColor: sign.color }]} onPress={handleLensOpen}>
              <Text style={styles.lensButtonSymbol}>{sign.symbol}</Text>
              <Text style={[styles.lensButtonText, { color: sign.color }]}>Read through {sign.name} eyes</Text>
            </TouchableOpacity>
          )}
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

      <Modal visible={lensVisible} transparent animationType="slide" onRequestClose={() => setLensVisible(false)}>
        <TouchableOpacity style={styles.lensBackdrop} activeOpacity={1} onPress={() => setLensVisible(false)}>
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <View style={[styles.lensSheet, sign ? { borderTopColor: sign.color } : {}]}>
              <View style={styles.lensSheetHeader}>
                <Text style={styles.lensSheetSymbol}>{sign?.symbol}</Text>
                <Text style={[styles.lensSheetTitle, { color: sign?.color ?? '#9b59b6' }]}>
                  Reading through {sign?.name} eyes
                </Text>
              </View>
              {lensLoading || !lensText ? (
                <View style={styles.lensSpinner}>
                  <ActivityIndicator color={sign?.color ?? '#9b59b6'} />
                  <Text style={styles.lensSpinnerText}>Generating your lens reading…</Text>
                </View>
              ) : (
                <ScrollView>
                  <Text style={styles.lensBody}>{lensText}</Text>
                </ScrollView>
              )}
              <TouchableOpacity
                style={[styles.lensDoneButton, { backgroundColor: sign?.color ?? '#9b59b6' }]}
                onPress={() => setLensVisible(false)}
              >
                <Text style={styles.lensDoneText}>Done</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
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
  lensButton: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 10, paddingVertical: 7, paddingHorizontal: 12,
    borderRadius: 20, borderWidth: 1, alignSelf: 'flex-start',
  },
  lensButtonSymbol: { fontSize: 14 },
  lensButtonText: { fontSize: 12, fontWeight: '700' },
  lensBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  lensSheet: {
    backgroundColor: '#1a1a2e', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 48, borderTopWidth: 3,
  },
  lensSheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  lensSheetSymbol: { fontSize: 28 },
  lensSheetTitle: { fontSize: 16, fontWeight: '800', flexShrink: 1 },
  lensSpinner: { alignItems: 'center', paddingVertical: 32, gap: 12 },
  lensSpinnerText: { color: '#555', fontSize: 13 },
  lensBody: { color: '#ddd', fontSize: 15, lineHeight: 26 },
  lensDoneButton: { borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 24 },
  lensDoneText: { color: '#fff', fontWeight: '700', fontSize: 15 },
})
