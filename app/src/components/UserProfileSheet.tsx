import { useState, useEffect } from 'react'
import { Modal, View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView, Dimensions } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { fetchUserProfile, followUser, unfollowUser, fetchUserShares, getShareRoute, ResolvedShare } from '@/lib/api'
import { SIGN_BY_ID } from '@/constants/signs'
import ShareCard from '@/components/ShareCard'

const SCREEN_HEIGHT = Dimensions.get('window').height

interface Props {
  userId: string | null
  currentUserId: string
  onClose: () => void
}

export default function UserProfileSheet({ userId, currentUserId, onClose }: Props) {
  const [profile, setProfile] = useState<{
    id: string; username: string; display_name: string | null
    primary_zodaic_sign_id: number | null; isFollowing: boolean
    followers: number; following: number
  } | null>(null)
  const [loading, setLoading] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [shares, setShares] = useState<ResolvedShare[]>([])
  const [sharesLoading, setSharesLoading] = useState(false)
  const router = useRouter()
  const insets = useSafeAreaInsets()

  useEffect(() => {
    if (!userId) { setProfile(null); setShares([]); return }
    setLoading(true)
    setSharesLoading(true)
    fetchUserProfile(userId, currentUserId).then((p) => {
      setProfile(p)
      setLoading(false)
    })
    fetchUserShares(userId).then((s) => {
      setShares(s)
      setSharesLoading(false)
    })
  }, [userId, currentUserId])

  async function handleFollowToggle() {
    if (!profile) return
    setToggling(true)
    try {
      if (profile.isFollowing) {
        await unfollowUser(currentUserId, profile.id)
        setProfile((p) => p ? { ...p, isFollowing: false, followers: p.followers - 1 } : p)
      } else {
        await followUser(currentUserId, profile.id)
        setProfile((p) => p ? { ...p, isFollowing: true, followers: p.followers + 1 } : p)
      }
    } finally {
      setToggling(false)
    }
  }

  const sign = profile?.primary_zodaic_sign_id ? SIGN_BY_ID[profile.primary_zodaic_sign_id] : null

  return (
    <Modal visible={!!userId} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} onPress={() => {}}>
          <View style={[styles.sheet, { maxHeight: SCREEN_HEIGHT - insets.top - 40 }, sign ? { borderTopColor: sign.color } : {}]}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>

            {loading || !profile ? (
              <ActivityIndicator color="#9b59b6" style={{ marginVertical: 32 }} />
            ) : (
              <>
                <View style={styles.userRow}>
                  {sign ? (
                    <Text style={styles.avatar}>{sign.symbol}</Text>
                  ) : (
                    <View style={styles.avatarPlaceholder} />
                  )}
                  <View style={styles.userInfo}>
                    <Text style={styles.displayName}>{profile.display_name ?? profile.username}</Text>
                    {profile.display_name && <Text style={styles.username}>@{profile.username}</Text>}
                    {sign && (
                      <Text style={[styles.signLabel, { color: sign.color }]}>{sign.name}</Text>
                    )}
                  </View>
                </View>

                <View style={styles.countsRow}>
                  <View style={styles.countItem}>
                    <Text style={styles.countNumber}>{profile.followers}</Text>
                    <Text style={styles.countLabel}>Followers</Text>
                  </View>
                  <View style={styles.countDivider} />
                  <View style={styles.countItem}>
                    <Text style={styles.countNumber}>{profile.following}</Text>
                    <Text style={styles.countLabel}>Following</Text>
                  </View>
                </View>

                {profile.id !== currentUserId && (
                  <TouchableOpacity
                    style={[styles.followButton, profile.isFollowing && styles.followingButton]}
                    onPress={handleFollowToggle}
                    disabled={toggling}
                  >
                    <Text style={[styles.followButtonText, profile.isFollowing && styles.followingButtonText]}>
                      {toggling ? '...' : profile.isFollowing ? 'Following' : 'Follow'}
                    </Text>
                  </TouchableOpacity>
                )}

                <View style={styles.sharesSection}>
                  <Text style={styles.sharesSectionTitle}>Shared</Text>
                  {sharesLoading ? (
                    <ActivityIndicator color="#9b59b6" style={{ marginVertical: 16 }} />
                  ) : shares.length === 0 ? (
                    <Text style={styles.sharesEmpty}>Hasn't shared anything yet.</Text>
                  ) : (
                    <ScrollView style={{ maxHeight: SCREEN_HEIGHT - insets.top - 420 }} showsVerticalScrollIndicator={false}>
                      {shares.map((item) => (
                        <ShareCard
                          key={item.id}
                          share={item}
                          showAuthor={false}
                          onPress={() => {
                            const route = getShareRoute(item)
                            if (!route) return
                            onClose()
                            router.push(route as any)
                          }}
                        />
                      ))}
                    </ScrollView>
                  )}
                </View>
              </>
            )}
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
    padding: 24, paddingBottom: 48, borderTopWidth: 3, borderTopColor: '#9b59b6',
  },
  closeButton: { alignSelf: 'flex-end', padding: 4, marginBottom: 8 },
  closeText: { color: '#555', fontSize: 18 },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 20 },
  avatar: { fontSize: 48 },
  avatarPlaceholder: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#2a2a3e' },
  userInfo: { flex: 1 },
  displayName: { color: '#fff', fontSize: 20, fontWeight: '800', marginBottom: 2 },
  username: { color: '#666', fontSize: 13, marginBottom: 4 },
  signLabel: { fontSize: 13, fontWeight: '700' },
  countsRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0d0d1a', borderRadius: 16, padding: 16, marginBottom: 20 },
  countItem: { flex: 1, alignItems: 'center' },
  countNumber: { color: '#fff', fontSize: 22, fontWeight: '800' },
  countLabel: { color: '#555', fontSize: 12, marginTop: 2 },
  countDivider: { width: 1, height: 32, backgroundColor: '#2a2a3e' },
  followButton: { backgroundColor: '#9b59b6', borderRadius: 12, padding: 14, alignItems: 'center' },
  followingButton: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#9b59b6' },
  followButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  followingButtonText: { color: '#9b59b6' },
  sharesSection: { marginTop: 24 },
  sharesSectionTitle: { color: '#888', fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  sharesEmpty: { color: '#555', fontSize: 13, paddingVertical: 8 },
})
