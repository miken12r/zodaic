import { useEffect, useState } from 'react'
import { View, Text, Switch, StyleSheet } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

export const FEED_SETTINGS_KEY = 'feed_settings_v1'

export type FeedSettingsData = {
  hidePaywalled: boolean
}

export const DEFAULT_FEED_SETTINGS: FeedSettingsData = {
  hidePaywalled: false,
}

export async function loadFeedSettings(): Promise<FeedSettingsData> {
  const raw = await AsyncStorage.getItem(FEED_SETTINGS_KEY)
  if (!raw) return DEFAULT_FEED_SETTINGS
  return { ...DEFAULT_FEED_SETTINGS, ...JSON.parse(raw) }
}

export async function saveFeedSettings(settings: FeedSettingsData): Promise<void> {
  await AsyncStorage.setItem(FEED_SETTINGS_KEY, JSON.stringify(settings))
}

// Known paywalled domains
export const PAYWALLED_DOMAINS = new Set([
  'nytimes.com', 'wsj.com', 'ft.com', 'bloomberg.com', 'theathletic.com',
  'washingtonpost.com', 'newyorker.com', 'theatlantic.com', 'economist.com',
  'thetimes.co.uk', 'telegraph.co.uk', 'hbr.org', 'wired.com',
  'foreignaffairs.com', 'barrons.com', 'businessinsider.com',
])

export function isPaywalled(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    return PAYWALLED_DOMAINS.has(host)
  } catch {
    return false
  }
}

type Props = {
  onChange?: (settings: FeedSettingsData) => void
}

export default function FeedSettings({ onChange }: Props) {
  const [settings, setSettings] = useState<FeedSettingsData>(DEFAULT_FEED_SETTINGS)

  useEffect(() => {
    loadFeedSettings().then(setSettings)
  }, [])

  async function toggle(key: keyof FeedSettingsData) {
    const updated = { ...settings, [key]: !settings[key] }
    setSettings(updated)
    await saveFeedSettings(updated)
    onChange?.(updated)
  }

  return (
    <View style={styles.card}>
      <Text style={styles.sectionLabel}>Feed Settings</Text>
      <View style={styles.row}>
        <View style={styles.rowText}>
          <Text style={styles.rowTitle}>Hide paywalled stories</Text>
          <Text style={styles.rowSubtitle}>Filters out known subscription-only sources</Text>
        </View>
        <Switch
          value={settings.hidePaywalled}
          onValueChange={() => toggle('hidePaywalled')}
          trackColor={{ false: '#2a2a3e', true: '#9b59b6' }}
          thumbColor={settings.hidePaywalled ? '#fff' : '#555'}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#1a1a2e', borderRadius: 20, padding: 20, marginBottom: 16 },
  sectionLabel: {
    color: '#9b59b6', fontSize: 12, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowText: { flex: 1, marginRight: 12 },
  rowTitle: { color: '#fff', fontSize: 15, fontWeight: '600', marginBottom: 2 },
  rowSubtitle: { color: '#555', fontSize: 12, lineHeight: 17 },
})
