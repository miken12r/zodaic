import { useState, useEffect } from 'react'
import { Modal, View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { fetchUserProfile, followUser, unfollowUser } from '@/lib/api'
import { SIGN_BY_ID } from '@/constants/signs'

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

  useEffect(() => {
    if (!userId) { setProfile(null); return }
    setLoading(true)
    fetchUserProfile(userId, currentUserId).then((p) => {
      setProfile(p)
      setLoading(false)
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
          <View style={[styles.sheet, sign ? { borderTopColor: sign.color } : {}]}>
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
})
