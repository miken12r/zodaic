import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { ResolvedShare } from '@/lib/api'
import { SIGN_BY_ID } from '@/constants/signs'
import { PERSONA_BY_SIGN_ID } from '@/constants/personas'

type ShareWithProfile = ResolvedShare & {
  profile?: { display_name: string | null; username: string } | null
}

interface Props {
  share: ShareWithProfile
  onPress?: () => void
  onPressSign?: (signId: number) => void
  onPressUser?: (userId: string) => void
  showAuthor?: boolean
}

// Renders a share as either a persona-styled Hot Take card or a generic title/message
// card, depending on content_type — shared between Home's feed and a user's profile
// sheet so this branching only lives in one place.
export default function ShareCard({ share, onPress, onPressSign, onPressUser, showAuthor = true }: Props) {
  const contentItem = share.content_item
  const sign = contentItem ? SIGN_BY_ID[contentItem.zodaic_sign_id] : null
  const isTake = share.content_type === 'sign_take' && !!share.sign_take
  const persona = sign ? PERSONA_BY_SIGN_ID[sign.id] : undefined

  return (
    <TouchableOpacity style={styles.shareCard} onPress={onPress} activeOpacity={contentItem ? 0.8 : 1}>
      <View style={styles.shareHeader}>
        {showAuthor && (
          <>
            <TouchableOpacity onPress={() => share.user_id && onPressUser?.(share.user_id)}>
              <Text style={styles.shareUsername}>{share.profile?.display_name ?? share.profile?.username ?? 'Someone'}</Text>
            </TouchableOpacity>
            <Text style={styles.shareLabel}>shared</Text>
          </>
        )}
        {sign && (
          <TouchableOpacity onPress={() => onPressSign?.(sign.id)}>
            <Text style={[styles.shareSign, { color: sign.color }]}>
              {isTake ? (persona?.avatar ?? sign.symbol) : sign.symbol} {isTake ? (persona?.displayName ?? sign.name) : sign.name} ›
            </Text>
          </TouchableOpacity>
        )}
      </View>
      {isTake && share.sign_take ? (
        <>
          <Text style={styles.shareTitle} numberOfLines={2}>{share.sign_take.headline}</Text>
          <Text style={styles.shareMessage} numberOfLines={2}>{share.sign_take.blurb}</Text>
        </>
      ) : (
        <>
          {contentItem && <Text style={styles.shareTitle} numberOfLines={1}>{contentItem.title}</Text>}
          {share.message && <Text style={styles.shareMessage} numberOfLines={2}>{share.message}</Text>}
        </>
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  shareCard: {
    backgroundColor: '#1a1a2e', borderRadius: 16, padding: 14,
    marginBottom: 10, borderLeftWidth: 3, borderLeftColor: '#9b59b6',
  },
  shareHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' },
  shareUsername: { color: '#9b59b6', fontWeight: '700', fontSize: 13 },
  shareLabel: { color: '#555', fontSize: 13 },
  shareSign: { fontSize: 13, fontWeight: '700' },
  shareTitle: { color: '#ddd', fontSize: 14, fontWeight: '600', marginBottom: 4 },
  shareMessage: { color: '#888', fontSize: 13, lineHeight: 18 },
})
