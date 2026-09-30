import { useState, useRef, useEffect } from 'react'
import { View, Text, StyleSheet, ActionSheetIOS, Alert } from 'react-native'
import * as Clipboard from 'expo-clipboard'
import * as Sharing from 'expo-sharing'
import { captureRef } from 'react-native-view-shot'
import { createShare } from '@/lib/api'
import { supabase } from '@/lib/supabase'
import { ZodaicSign, SignPersona } from '@/types'

export interface ShareableContent {
  id?: string
  headline: string
  body: string
  url: string
}

type SharingState = { content: ShareableContent; sign?: ZodaicSign; persona?: SignPersona } | null

// Shared "share this" mechanics — used by Hot Takes (tab + article sheet) and the
// article screen's Lens sheet, so the action-sheet/copy/image-capture logic exists
// once. `id` is optional: when present (Hot Takes, which have their own sign_takes
// row), the menu offers "Share to Feed" too; when absent (Lens, which is just text
// on the article, not its own entity), that option is omitted.
export function useSignTakeSharing() {
  const [sharing, setSharing] = useState<SharingState>(null)
  const cardRef = useRef<View>(null)

  useEffect(() => {
    if (!sharing) return
    const t = setTimeout(async () => {
      try {
        const uri = await captureRef(cardRef, { format: 'png', quality: 0.9 })
        await Sharing.shareAsync(uri, { mimeType: 'image/png' })
      } catch (e) {
        Alert.alert('Error', 'Could not create the share image.')
      } finally {
        setSharing(null)
      }
    }, 50)
    return () => clearTimeout(t)
  }, [sharing])

  async function shareToFeed(content: ShareableContent) {
    if (!content.id) return
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not logged in')
      await createShare(user.id, 'sign_take', content.id)
      Alert.alert('Shared', 'This is now on your feed.')
    } catch {
      Alert.alert('Error', 'Could not share this.')
    }
  }

  async function copyText(content: ShareableContent, sign?: ZodaicSign, persona?: SignPersona) {
    const text = `${content.headline}\n\n${content.body}\n\n${content.url}\n\n— ${persona?.displayName ?? sign?.name}, via ZodAIc`
    await Clipboard.setStringAsync(text)
    Alert.alert('Copied', 'Paste it anywhere — Messages, notes, wherever.')
  }

  function presentShareOptions(content: ShareableContent, sign?: ZodaicSign, persona?: SignPersona) {
    const actions: { label: string; onPress: () => void }[] = []
    if (content.id) actions.push({ label: 'Share to Feed', onPress: () => shareToFeed(content) })
    actions.push({ label: 'Copy Text', onPress: () => copyText(content, sign, persona) })
    actions.push({ label: 'Share Image', onPress: () => setSharing({ content, sign, persona }) })

    ActionSheetIOS.showActionSheetWithOptions(
      { options: [...actions.map((a) => a.label), 'Cancel'], cancelButtonIndex: actions.length },
      (index) => {
        if (index < actions.length) actions[index].onPress()
      }
    )
  }

  const captureView = sharing ? (
    <View style={styles.captureWrapper} pointerEvents="none">
      <View
        ref={cardRef}
        collapsable={false}
        style={[styles.shareCardImage, { borderColor: sharing.sign?.color ?? '#9b59b6' }]}
      >
        <Text style={styles.shareCardAvatar}>{sharing.persona?.avatar ?? sharing.sign?.symbol}</Text>
        <Text style={[styles.shareCardPersona, { color: sharing.sign?.color ?? '#9b59b6' }]}>
          {sharing.persona?.displayName ?? sharing.sign?.name}
        </Text>
        <Text style={styles.shareCardHeadline}>{sharing.content.headline}</Text>
        <Text style={styles.shareCardBlurb}>{sharing.content.body}</Text>
        <View style={styles.shareCardFooter}>
          <Text style={styles.shareCardFooterText}>ZodAIc · your horoscope has opinions</Text>
          <Text style={styles.shareCardFooterUrl} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
            {sharing.content.url}
          </Text>
        </View>
      </View>
    </View>
  ) : null

  return { presentShareOptions, captureView }
}

const styles = StyleSheet.create({
  captureWrapper: { position: 'absolute', top: -9999, left: 0, width: 340 },
  shareCardImage: {
    width: 340, backgroundColor: '#1a1a2e', borderRadius: 20, borderWidth: 3, padding: 24,
  },
  shareCardAvatar: { fontSize: 40, marginBottom: 8 },
  shareCardPersona: { fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 14 },
  shareCardHeadline: { color: '#fff', fontSize: 21, fontWeight: '800', lineHeight: 28, marginBottom: 12 },
  shareCardBlurb: { color: '#ccc', fontSize: 15, lineHeight: 22, marginBottom: 20 },
  shareCardFooter: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.15)', paddingTop: 12, gap: 4 },
  shareCardFooterText: { color: '#888', fontSize: 12, fontWeight: '700' },
  shareCardFooterUrl: { color: '#666', fontSize: 11 },
})
