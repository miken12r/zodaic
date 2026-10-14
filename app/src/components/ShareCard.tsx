import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native'
import { ResolvedShare } from '@/lib/api'
import { SIGN_BY_ID } from '@/constants/signs'
import { PERSONA_BY_SIGN_ID } from '@/constants/personas'

type ShareWithProfile = ResolvedShare & {
  profile?: { display_name: string | null; username: string; primary_zodaic_sign_id?: number | null } | null
}

interface Props {
  share: ShareWithProfile
  onPress?: () => void
  onPressSign?: (signId: number) => void
  onPressUser?: (userId: string) => void
  showAuthor?: boolean
}

function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (mins < 60) return `${Math.max(1, mins)}m`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.round(hours / 24)}d`
}

// A shared story looks like the story itself — the same image card as the News
// feed — under a "<sharer> shared" attribution line (the repost pattern), so
// shares stay scannable by their pictures instead of becoming text-only blocks.
// Used by Home's feed, a user's profile sheet, and Networking's My Feed.
export default function ShareCard({ share, onPress, onPressSign, onPressUser, showAuthor = true }: Props) {
  const contentItem = share.content_item
  const sign = contentItem ? SIGN_BY_ID[contentItem.zodaic_sign_id] : null
  const isTake = share.content_type === 'sign_take' && !!share.sign_take
  const persona = sign ? PERSONA_BY_SIGN_ID[sign.id] : undefined
  const sharerSign = share.profile?.primary_zodaic_sign_id ? SIGN_BY_ID[share.profile.primary_zodaic_sign_id] : null
  const sharerName = share.profile?.display_name ?? share.profile?.username ?? 'Someone'

  // Article shares carry an auto-generated "<title> is <sign> energy." message that
  // only repeats the title — show the message only when it says something else.
  const autoMessage = contentItem && sign ? `${contentItem.title} is ${sign.name} energy.` : null
  const message = share.message && share.message !== autoMessage ? share.message : null

  const title = isTake && share.sign_take ? share.sign_take.headline : contentItem?.title
  const body = isTake && share.sign_take ? share.sign_take.blurb : contentItem?.description

  return (
    <View style={styles.wrapper}>
      <View style={styles.attribution}>
        {showAuthor ? (
          <TouchableOpacity style={styles.attributionUser} onPress={() => share.user_id && onPressUser?.(share.user_id)}>
            <Text style={styles.attributionAvatar}>{sharerSign?.symbol ?? '↻'}</Text>
            <Text style={styles.attributionName}>{sharerName}</Text>
          </TouchableOpacity>
        ) : null}
        <Text style={styles.attributionLabel}>
          {showAuthor ? 'shared' : 'Shared'}
          {isTake && persona ? ` ${persona.displayName}'s take` : ''} · {timeAgo(share.created_at)}
        </Text>
      </View>
      {message ? <Text style={styles.message}>“{message}”</Text> : null}

      {contentItem ? (
        <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
          {contentItem.image_url ? (
            <Image source={{ uri: contentItem.image_url }} style={styles.image} resizeMode="cover" />
          ) : (
            <View style={[styles.imagePlaceholder, { backgroundColor: (sign?.color ?? '#9b59b6') + '22' }]}>
              <Text style={styles.imageEmoji}>{isTake && persona ? persona.avatar : sign?.symbol}</Text>
            </View>
          )}
          <View style={styles.content}>
            {sign && (
              <TouchableOpacity style={styles.signBadge} onPress={() => onPressSign?.(sign.id)}>
                <Text style={[styles.signText, { color: sign.color }]}>
                  {isTake && persona ? `${persona.avatar} ${persona.displayName} · ${sign.name}` : `${sign.symbol} ${sign.name}`} ›
                </Text>
              </TouchableOpacity>
            )}
            <Text style={styles.title} numberOfLines={2}>{title}</Text>
            {body ? <Text style={styles.description} numberOfLines={2}>{body}</Text> : null}
          </View>
        </TouchableOpacity>
      ) : (
        // Shares with no article behind them (e.g. horoscopes) have only text.
        <View style={styles.textCard}>
          <Text style={styles.title}>{share.message ?? 'Shared a reading'}</Text>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 10 },
  attribution: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6, marginLeft: 4, flexWrap: 'wrap' },
  attributionUser: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  attributionAvatar: { fontSize: 14 },
  attributionName: { color: '#9b59b6', fontWeight: '700', fontSize: 13 },
  attributionLabel: { color: '#666', fontSize: 13 },
  message: { color: '#bbb', fontSize: 13, fontStyle: 'italic', lineHeight: 18, marginBottom: 6, marginLeft: 4 },
  // Same shape as the News feed's card, plus a purple left edge marking it as shared.
  card: {
    backgroundColor: '#1a1a2e', borderRadius: 16, flexDirection: 'row', overflow: 'hidden',
    borderLeftWidth: 3, borderLeftColor: '#9b59b6',
  },
  image: { width: 90, height: 90 },
  imagePlaceholder: { width: 90, height: 90, justifyContent: 'center', alignItems: 'center' },
  imageEmoji: { fontSize: 28 },
  content: { flex: 1, padding: 12 },
  signBadge: { marginBottom: 4 },
  signText: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  title: { color: '#fff', fontSize: 14, fontWeight: '700', lineHeight: 20, marginBottom: 4 },
  description: { color: '#888', fontSize: 12, lineHeight: 17 },
  textCard: { backgroundColor: '#1a1a2e', borderRadius: 16, padding: 14, borderLeftWidth: 3, borderLeftColor: '#9b59b6' },
})
