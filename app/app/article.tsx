import { useState, useEffect, useRef } from 'react'
import { View, Text, Image, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Modal, ScrollView } from 'react-native'
import { WebView } from 'react-native-webview'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { SIGN_BY_ID } from '@/constants/signs'
import { createShare, generateLens, extractArticle } from '@/lib/api'
import { supabase } from '@/lib/supabase'
import SignDetailModal from '@/components/SignDetailModal'
import { loadFeedSettings, saveFeedSettings } from '@/components/FeedSettings'

type ReaderContent = {
  title: string
  byline: string
  site_name: string
  blocks: ReaderBlock[]
}

type ReaderBlock =
  | { type: 'h1' | 'h2' | 'h3' | 'p' | 'blockquote'; text: string }
  | { type: 'image'; src: string; alt: string }
  | { type: 'divider' }

const AD_IMAGE_PATTERNS = ['doubleclick', 'googlesyndication', 'adserver', 'tracking', 'pixel', 'beacon', 'analytics', '1x1', 'spacer', 'ad.', '/ads/']

function isAdImage(src: string): boolean {
  const lower = src.toLowerCase()
  return AD_IMAGE_PATTERNS.some((p) => lower.includes(p))
}

function decodeEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
}

function innerText(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim())
}

function parseReaderContent(article: { title: string; byline: string; site_name: string; content: string }): ReaderContent {
  const html = article.content
  const positioned: Array<{ pos: number; block: ReaderBlock }> = []

  // Extract images in document order
  const imgPattern = /<img[^>]+>/gi
  let imgMatch
  while ((imgMatch = imgPattern.exec(html)) !== null) {
    const srcMatch = /src=["']([^"']+)["']/.exec(imgMatch[0])
    const altMatch = /alt=["']([^"']*)["']/.exec(imgMatch[0])
    if (srcMatch && !isAdImage(srcMatch[1])) {
      positioned.push({ pos: imgMatch.index, block: { type: 'image', src: srcMatch[1], alt: altMatch?.[1] ?? '' } })
    }
  }

  // Extract text blocks in document order
  const tagPattern = /<(h[1-6]|p|blockquote|li)[^>]*>([\s\S]*?)<\/\1>/gi
  let match
  while ((match = tagPattern.exec(html)) !== null) {
    const tag = match[1].toLowerCase()
    const text = innerText(match[2])
    if (!text) continue
    let block: ReaderBlock
    if (tag === 'h1') block = { type: 'h1', text }
    else if (tag === 'h2' || tag === 'h3') block = { type: 'h2', text }
    else if (tag === 'h4' || tag === 'h5' || tag === 'h6') block = { type: 'h3', text }
    else if (tag === 'blockquote') block = { type: 'blockquote', text }
    else block = { type: 'p', text }
    positioned.push({ pos: match.index, block })
  }

  positioned.sort((a, b) => a.pos - b.pos)

  return {
    title: article.title,
    byline: article.byline,
    site_name: article.site_name,
    blocks: positioned.map((p) => p.block),
  }
}

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
  const [lensText, setLensText] = useState<{ intro: string; bullets: string[] } | null>(null)
  const [lensLoading, setLensLoading] = useState(false)
  const lensRef = useRef<boolean>(false)
  const [readerMode, setReaderMode] = useState(false)
  const [readerContent, setReaderContent] = useState<ReaderContent | null>(null)
  const [readerLoading, setReaderLoading] = useState(false)

  // Load sticky reader mode preference on mount
  useEffect(() => {
    loadFeedSettings().then((s) => { if (s.readerMode) activateReaderMode() })
  }, [])

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
          lensRef.current = true
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
      const result = await generateLens({
        content_id: contentId as string,
        url: url as string,
        zodaic_sign_id: parseInt(signId as string),
        title: title as string | undefined,
        characteristics: parsed,
      })
      lensRef.current = true
      setLensText(result)
    } catch {
      Alert.alert('Error', 'Could not generate lens. Try again.')
      setLensVisible(false)
    } finally {
      setLensLoading(false)
    }
  }

  async function activateReaderMode() {
    if (readerContent) { setReaderMode(true); return }
    setReaderLoading(true)
    try {
      const article = await extractArticle(url as string)
      setReaderContent(parseReaderContent(article))
      setReaderMode(true)
    } catch {
      Alert.alert('Reader Mode', 'Could not extract this article. It may require a subscription or block automated access.')
    } finally {
      setReaderLoading(false)
    }
  }

  async function toggleReaderMode() {
    const settings = await loadFeedSettings()
    if (readerMode) {
      setReaderMode(false)
      await saveFeedSettings({ ...settings, readerMode: false })
    } else {
      await saveFeedSettings({ ...settings, readerMode: true })
      await activateReaderMode()
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
          style={[styles.readerButton, readerMode && { backgroundColor: sign?.color ?? '#9b59b6' }]}
          onPress={toggleReaderMode}
          disabled={readerLoading}
        >
          <Text style={[styles.readerButtonText, readerMode && styles.readerButtonTextActive]}>
            {readerLoading ? '…' : 'Aa'}
          </Text>
        </TouchableOpacity>

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

      {/* WebView / Reader Mode */}
      {url ? (
        readerMode && readerContent ? (
          <ScrollView style={styles.readerScroll} contentContainerStyle={styles.readerContent}>
            {readerContent.site_name ? <Text style={styles.readerSite}>{readerContent.site_name}</Text> : null}
            <Text style={styles.readerTitle}>{readerContent.title}</Text>
            {readerContent.byline ? <Text style={styles.readerByline}>{readerContent.byline}</Text> : null}
            {readerContent.blocks.map((block, i) => {
              if (block.type === 'divider') return <View key={i} style={styles.readerDivider} />
              if (block.type === 'image') return (
                <Image
                  key={i}
                  source={{ uri: block.src }}
                  style={styles.readerImage}
                  resizeMode="cover"
                  accessibilityLabel={block.alt}
                />
              )
              if (block.type === 'h1') return <Text key={i} style={styles.readerH1}>{block.text}</Text>
              if (block.type === 'h2') return <Text key={i} style={styles.readerH2}>{block.text}</Text>
              if (block.type === 'h3') return <Text key={i} style={styles.readerH3}>{block.text}</Text>
              if (block.type === 'blockquote') return <View key={i} style={[styles.readerBlockquote, { borderLeftColor: sign?.color ?? '#9b59b6' }]}><Text style={styles.readerBlockquoteText}>{block.text}</Text></View>
              return <Text key={i} style={styles.readerParagraph}>{block.text}</Text>
            })}
          </ScrollView>
        ) : (
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
        )
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
                  <Text style={styles.lensIntro}>{lensText.intro}</Text>
                  <View style={styles.lensBullets}>
                    {lensText.bullets.map((b, i) => (
                      <View key={i} style={styles.lensBulletRow}>
                        <Text style={[styles.lensBulletDot, { color: sign?.color ?? '#9b59b6' }]}>•</Text>
                        <Text style={styles.lensBulletText}>{b}</Text>
                      </View>
                    ))}
                  </View>
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
  readerButton: {
    borderRadius: 20, width: 36, height: 36,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#2a2a3e',
  },
  readerButtonText: { color: '#555', fontSize: 13, fontWeight: '800' },
  readerButtonTextActive: { color: '#fff' },
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
  readerScroll: { flex: 1, backgroundColor: '#0d0d1a' },
  readerContent: { padding: 20, paddingBottom: 60 },
  readerSite: { color: '#555', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
  readerTitle: { color: '#fff', fontSize: 24, fontWeight: '800', lineHeight: 32, marginBottom: 10 },
  readerByline: { color: '#666', fontSize: 13, marginBottom: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#1a1a2e' },
  readerH1: { color: '#fff', fontSize: 22, fontWeight: '800', lineHeight: 30, marginTop: 24, marginBottom: 10 },
  readerH2: { color: '#fff', fontSize: 19, fontWeight: '700', lineHeight: 26, marginTop: 20, marginBottom: 8 },
  readerH3: { color: '#eee', fontSize: 16, fontWeight: '700', lineHeight: 24, marginTop: 16, marginBottom: 6 },
  readerParagraph: { color: '#ccc', fontSize: 17, lineHeight: 28, marginBottom: 16 },
  readerBlockquote: { borderLeftWidth: 3, paddingLeft: 14, marginVertical: 16 },
  readerBlockquoteText: { color: '#aaa', fontSize: 16, lineHeight: 26, fontStyle: 'italic' },
  readerImage: { width: '100%', height: 220, borderRadius: 10, marginVertical: 16, backgroundColor: '#1a1a2e' },
  readerDivider: { height: 1, backgroundColor: '#1a1a2e', marginVertical: 20 },
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
  lensIntro: { color: '#ddd', fontSize: 15, lineHeight: 24, marginBottom: 16 },
  lensBullets: { gap: 12 },
  lensBulletRow: { flexDirection: 'row', gap: 10 },
  lensBulletDot: { fontSize: 16, lineHeight: 24, fontWeight: '800' },
  lensBulletText: { flex: 1, color: '#bbb', fontSize: 14, lineHeight: 22 },
  lensDoneButton: { borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 24 },
  lensDoneText: { color: '#fff', fontWeight: '700', fontSize: 15 },
})
