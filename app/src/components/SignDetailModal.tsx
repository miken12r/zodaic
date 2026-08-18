import { Modal, View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native'
import { SIGN_BY_ID } from '@/constants/signs'

interface Props {
  signId: number | null
  onClose: () => void
}

const ELEMENT_SYMBOLS: Record<string, string> = {
  fire: '🔥', earth: '🌍', air: '💨', water: '💧',
}

export default function SignDetailModal({ signId, onClose }: Props) {
  const sign = signId ? SIGN_BY_ID[signId] : null

  if (!sign) return null

  return (
    <Modal visible={!!signId} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} onPress={() => {}}>
          <View style={[styles.sheet, { borderTopColor: sign.color }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Header */}
              <View style={styles.header}>
                <Text style={styles.symbol}>{sign.symbol}</Text>
                <View style={styles.headerText}>
                  <Text style={[styles.name, { color: sign.color }]}>{sign.name}</Text>
                  <Text style={styles.analog}>Digital {sign.traditional_analog}</Text>
                  <View style={styles.elementRow}>
                    <Text style={styles.element}>
                      {ELEMENT_SYMBOLS[sign.element]} {sign.element.charAt(0).toUpperCase() + sign.element.slice(1)}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                  <Text style={styles.closeText}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Tagline */}
              <Text style={[styles.tagline, { color: sign.color }]}>"{sign.tagline}"</Text>

              {/* Description */}
              <Text style={styles.description}>{sign.description}</Text>

              {/* Characteristics */}
              <Text style={styles.sectionLabel}>Characteristics</Text>
              <View style={styles.traits}>
                {sign.characteristics.map((c) => (
                  <View key={c} style={[styles.trait, { borderColor: sign.color + '66' }]}>
                    <Text style={[styles.traitText, { color: sign.color }]}>{c}</Text>
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#1a1a2e', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 48, borderTopWidth: 3, maxHeight: '75%',
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 },
  symbol: { fontSize: 48, marginRight: 16 },
  headerText: { flex: 1 },
  name: { fontSize: 22, fontWeight: '800', marginBottom: 2 },
  analog: { color: '#888', fontSize: 13, marginBottom: 4 },
  elementRow: { flexDirection: 'row' },
  element: { color: '#666', fontSize: 12 },
  closeButton: { padding: 4 },
  closeText: { color: '#555', fontSize: 18 },
  tagline: { fontSize: 15, fontStyle: 'italic', marginBottom: 14, lineHeight: 22 },
  description: { color: '#bbb', fontSize: 14, lineHeight: 22, marginBottom: 20 },
  sectionLabel: { color: '#9b59b6', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
  traits: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  trait: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  traitText: { fontSize: 12, fontWeight: '600' },
})
