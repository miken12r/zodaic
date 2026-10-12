import { ComponentType } from 'react'
import { View, Text, TouchableOpacity, ScrollView, ScrollViewProps, StyleSheet } from 'react-native'
import { ZODAIC_SIGNS, dropThe } from '@/constants/signs'
import { PERSONA_BY_SIGN_ID } from '@/constants/personas'

interface Props {
  selectedId: number | null
  onSelect: (signId: number) => void
  // The user's own sign: marked "you" and placed right after leadingIds.
  userSignId?: number | null
  // Signs to show first (e.g. the article's own voice). The row scrolls and only
  // ~5 chips fit on screen, so anything relevant must lead or it goes unseen.
  leadingIds?: number[]
  // Sheets with gesture-handler gestures pass RNGH's ScrollView so horizontal
  // drags aren't stolen; plain screens/modals use React Native's.
  ScrollComponent?: ComponentType<ScrollViewProps>
}

// Horizontal row of the 12 persona voices, used by "Ask another voice" on the
// article screen and "Ask a voice" in Sites.
export default function VoicePicker({ selectedId, onSelect, userSignId, leadingIds = [], ScrollComponent = ScrollView }: Props) {
  const lead = [...leadingIds, ...(userSignId ? [userSignId] : [])]
  const ordered = [
    ...lead.filter((id, i) => lead.indexOf(id) === i).map((id) => ZODAIC_SIGNS.find((s) => s.id === id)!).filter(Boolean),
    ...ZODAIC_SIGNS.filter((s) => !lead.includes(s.id)),
  ]

  return (
    <ScrollComponent horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} keyboardShouldPersistTaps="handled">
      {ordered.map((s) => {
        const p = PERSONA_BY_SIGN_ID[s.id]
        const selected = s.id === selectedId
        return (
          <TouchableOpacity
            key={s.id}
            style={[styles.chip, selected && { borderColor: s.color, backgroundColor: s.color + '22' }]}
            onPress={() => onSelect(s.id)}
          >
            <Text style={styles.avatar}>{p?.avatar ?? s.symbol}</Text>
            <Text style={[styles.name, selected && { color: s.color }]} numberOfLines={1}>{p?.displayName ?? dropThe(s.name)}</Text>
            {s.id === userSignId ? <Text style={styles.youTag}>you</Text> : <View style={styles.youSpacer} />}
          </TouchableOpacity>
        )
      })}
    </ScrollComponent>
  )
}

const styles = StyleSheet.create({
  row: { gap: 8, paddingBottom: 4 },
  chip: { alignItems: 'center', width: 64, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: '#2a2a3e' },
  avatar: { fontSize: 22 },
  name: { color: '#888', fontSize: 11, fontWeight: '600', marginTop: 4 },
  youTag: { color: '#9b59b6', fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 },
  youSpacer: { height: 13 },
})
