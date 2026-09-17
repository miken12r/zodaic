import { useState, useRef, useEffect } from 'react'
import { View, Text, StyleSheet, ActionSheetIOS, Alert } from 'react-native'
import * as Clipboard from 'expo-clipboard'
import * as Sharing from 'expo-sharing'
import { captureRef } from 'react-native-view-shot'
import { createShare } from '@/lib/api'
import { supabase } from '@/lib/supabase'
import { ZodaicSign, SignPersona } from '@/types'

export interface ShareableTake {
  id: string
  headline: string
  blurb: string
}

type SharingState = { take: ShareableTake; sign?: ZodaicSign; persona?: SignPersona } | null

// Shared "share this take" mechanics — used by the Hot Takes tab and the article
// screen's Hot Take sheet, so the action-sheet/copy/image-capture logic exists once.
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

  async function shareToFeed(take: ShareableTake) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not logged in')
      await createShare(user.id, 'sign_take', take.id)
      Alert.alert('Shared', 'This take is now on your feed.')
    } catch {
      Alert.alert('Error', 'Could not share this take.')
    }
  }

  async function copyText(take: ShareableTake, sign?: ZodaicSign, persona?: SignPersona) {
    const text = `${take.headline}\n\n${take.blurb}\n\n— ${persona?.displayName ?? sign?.name}, via ZodAIc`
    await Clipboard.setStringAsync(text)
    Alert.alert('Copied', 'Paste it anywhere — Messages, notes, wherever.')
  }

  function presentShareOptions(take: ShareableTake, sign?: ZodaicSign, persona?: SignPersona) {
    ActionSheetIOS.showActionSheetWithOptions(
      { options: ['Share to Feed', 'Copy Text', 'Share Image', 'Cancel'], cancelButtonIndex: 3 },
      (index) => {
        if (index === 0) shareToFeed(take)
        else if (index === 1) copyText(take, sign, persona)
        else if (index === 2) setSharing({ take, sign, persona })
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
        <Text style={styles.shareCardHeadline}>{sharing.take.headline}</Text>
        <Text style={styles.shareCardBlurb}>{sharing.take.blurb}</Text>
        <View style={styles.shareCardFooter}>
          <Text style={styles.shareCardFooterText}>ZodAIc · your horoscope has opinions</Text>
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
  shareCardFooter: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.15)', paddingTop: 12 },
  shareCardFooterText: { color: '#888', fontSize: 12, fontWeight: '700' },
})
