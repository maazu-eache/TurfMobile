import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Image, Modal, FlatList, StatusBar, Platform, ToastAndroid
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { fetchPlayerById, followPlayer, fetchMyPlayer } from '../playerSlice';
import { Colors, Typography, BorderRadius, Shadows } from '../../../theme/theme';
import { showCustomAlert } from '../../../components/CustomAlert';
import Icon from 'react-native-vector-icons/Ionicons';
import { getImageUrl } from '../../../api/axios';
import api from '../../../api/axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getPlayerTags } from '../../../utils/playerTags';

const PlayerDetailScreen = ({ navigation, route }) => {
  const { id } = route.params || {};
  const dispatch = useDispatch();

  const { viewedPlayer, myProfile, isLoading } = useSelector(state => state.player);
  const { user } = useSelector(state => state.auth);

  const [socialModalVisible, setSocialModalVisible] = useState(false);
  const [socialType, setSocialType] = useState('followers');
  const [socialList, setSocialList] = useState([]);
  const [socialLoading, setSocialLoading] = useState(false);
  const [selectedTagDefinition, setSelectedTagDefinition] = useState(null);

  // Track view + fetch player
  useEffect(() => {
    const fetchProfileAndTrack = async () => {
      if (!id) return;
      try {
        const key = 'RoughTurf_ViewedPlayers';
        const viewedStr = await AsyncStorage.getItem(key);
        let viewedList = viewedStr ? JSON.parse(viewedStr) : [];
        const hasViewed = viewedList.includes(id);
        if (!hasViewed) {
          viewedList.push(id);
          await AsyncStorage.setItem(key, JSON.stringify(viewedList));
          dispatch(fetchPlayerById({ id, trackView: true }));
        } else {
          dispatch(fetchPlayerById({ id, trackView: false }));
        }
      } catch {
        dispatch(fetchPlayerById({ id, trackView: false }));
      }
    };
    fetchProfileAndTrack();
  }, [id, dispatch]);

  useEffect(() => {
    if (!myProfile) dispatch(fetchMyPlayer());
  }, [dispatch, myProfile]);

  const loadSocialList = async (type) => {
    setSocialType(type);
    setSocialModalVisible(true);
    setSocialLoading(true);
    try {
      const res = await api.get(`/players/${id}/${type}`);
      setSocialList(res.data.data || []);
    } catch {
      setSocialList([]);
    } finally {
      setSocialLoading(false);
    }
  };

  const handleFollowToggle = async () => {
    if (!myProfile) return showCustomAlert('Sign In Required', 'Please create a cricket profile to follow players.');
    try {
      const res = await dispatch(followPlayer(id)).unwrap();
      const msg = res.following ? `You are now following ${viewedPlayer?.name || 'this player'}` : `Unfollowed ${viewedPlayer?.name || 'player'}`;
      if (Platform.OS === 'android') {
        ToastAndroid.show(msg, ToastAndroid.SHORT);
      } else {
        showCustomAlert(res.following ? 'Following' : 'Unfollowed', msg);
      }
      dispatch(fetchPlayerById({ id, trackView: false }));
      dispatch(fetchMyPlayer());
    } catch (err) {
      showCustomAlert('Error', err || 'Failed to update follow status');
    }
  };

  const handleRemoveFollower = async (followerId) => {
    try {
      await api.delete(`/players/${id}/followers/${followerId}`);
      setSocialList(prev => prev.filter(p => p._id !== followerId));
      dispatch(fetchPlayerById({ id, trackView: false }));
    } catch (err) {
      showCustomAlert('Error', err.response?.data?.message || 'Failed to remove follower');
    }
  };

  const handleUnfollowFromList = async (followingId) => {
    try {
      await api.delete(`/players/${id}/following/${followingId}`);
      setSocialList(prev => prev.filter(p => p._id !== followingId));
      dispatch(fetchPlayerById({ id, trackView: false }));
    } catch (err) {
      showCustomAlert('Error', err.response?.data?.message || 'Failed to unfollow');
    }
  };

  // ── Loading / error states ──────────────────────────────────────────────────
  if (isLoading && !viewedPlayer) {
    return (
      <SafeAreaView style={styles.centeredState}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading profile…</Text>
      </SafeAreaView>
    );
  }

  if (!viewedPlayer) {
    return (
      <SafeAreaView style={styles.centeredState}>
        <Icon name="alert-circle-outline" size={52} color={Colors.error} />
        <Text style={styles.errorText}>Player profile not found</Text>
        <TouchableOpacity style={styles.goBackBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.goBackBtnText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const viewedPlayerUserId = viewedPlayer.userId?._id || viewedPlayer.userId;
  const isOwnProfile =
    (myProfile && myProfile._id === viewedPlayer._id) ||
    (viewedPlayerUserId && user && viewedPlayerUserId === user._id);
  const isFollowing = myProfile?.following?.includes(viewedPlayer._id);

  const career  = viewedPlayer.career  || {};
  const batting = viewedPlayer.batting || {};
  const bowling = viewedPlayer.bowling || {};
  const fielding = viewedPlayer.fielding || {};

  const winPct = career.matches
    ? `${Math.round((career.wins / career.matches) * 100)}%`
    : '0%';

  // Resolve photo: player-specific photo first, then fall back to linked user account photo
  const photoUrl = viewedPlayer.photo || viewedPlayer.userId?.photo || null;

  // ── Render helpers ──────────────────────────────────────────────────────────
  const StatPill = ({ value, label, highlight }) => (
    <View style={styles.statPill}>
      <Text style={[styles.statPillVal, highlight && styles.statPillValHL]}>{value}</Text>
      <Text style={styles.statPillLbl}>{label}</Text>
    </View>
  );

  const SectionHeader = ({ icon, label }) => (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionIconWrap}>
        <Icon name={icon} size={15} color={Colors.primary} />
      </View>
      <Text style={styles.sectionTitle}>{label}</Text>
    </View>
  );

  const InfoRow = ({ label, value }) => (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <View style={styles.infoValuePill}>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.headerBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Icon name="arrow-back" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>{viewedPlayer.name}</Text>
        </View>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero Profile Card ─────────────────────────────────────────────── */}
        <View style={styles.heroCard}>
          {/* Avatar */}
          <View style={styles.avatarRing}>
            {photoUrl ? (
              <Image source={{ uri: getImageUrl(photoUrl) }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarFallbackLetter}>
                  {viewedPlayer.name ? viewedPlayer.name.charAt(0).toUpperCase() : '?'}
                </Text>
              </View>
            )}
          </View>

          {/* Name & role */}
          <Text style={styles.heroName}>{viewedPlayer.name}</Text>
          <View style={styles.rolePill}>
            <Icon name="baseball-outline" size={12} color={Colors.primary} />
            <Text style={styles.roleText}>
              {viewedPlayer.playingRole || 'Cricket Player'}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8, justifyContent: 'center' }}>
            {getPlayerTags(viewedPlayer).map((tag, tIdx) => (
              <TouchableOpacity 
                key={tIdx} 
                onPress={() => setSelectedTagDefinition(tag)}
                style={{ backgroundColor: tag.type === 'batting' ? 'rgba(243, 156, 18, 0.1)' : 'rgba(142, 68, 173, 0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: tag.type === 'batting' ? 'rgba(243, 156, 18, 0.3)' : 'rgba(142, 68, 173, 0.3)' }}
              >
                <Text style={{ fontFamily: Typography.fontFamily.semiBold, color: tag.type === 'batting' ? '#F39C12' : '#8E44AD', fontSize: 11 }}>{tag.name}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Location */}
          {(viewedPlayer.city || viewedPlayer.state) ? (
            <View style={styles.locationRow}>
              <Icon name="location-outline" size={13} color={Colors.textSecondary} />
              <Text style={styles.locationText}>
                {[viewedPlayer.city, viewedPlayer.state].filter(Boolean).join(', ')}
              </Text>
            </View>
          ) : null}

          {/* Social counts */}
          <View style={styles.socialRow}>
            <TouchableOpacity style={styles.socialItem} onPress={() => loadSocialList('followers')}>
              <Text style={styles.socialCount}>{viewedPlayer.followers?.length || 0}</Text>
              <Text style={styles.socialLabel}>Followers</Text>
            </TouchableOpacity>

            <View style={styles.socialSep} />

            <TouchableOpacity style={styles.socialItem} onPress={() => loadSocialList('following')}>
              <Text style={styles.socialCount}>{viewedPlayer.following?.length || 0}</Text>
              <Text style={styles.socialLabel}>Following</Text>
            </TouchableOpacity>

            <View style={styles.socialSep} />

            <View style={styles.socialItem}>
              <Text style={styles.socialCount}>{viewedPlayer.profileViews || 0}</Text>
              <Text style={styles.socialLabel}>Views</Text>
            </View>
          </View>

          {/* Follow button */}
          {!isOwnProfile && (
            <TouchableOpacity
              style={[styles.followBtn, isFollowing && styles.followingBtn]}
              onPress={handleFollowToggle}
              activeOpacity={0.8}
            >
              <Icon
                name={isFollowing ? 'checkmark-circle' : 'person-add-outline'}
                size={15}
                color={isFollowing ? Colors.textSecondary : '#fff'}
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.followBtnText, isFollowing && styles.followingBtnText]}>
                {isFollowing ? 'Following' : 'Follow'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Career Stats ──────────────────────────────────────────────────── */}
        <SectionHeader icon="trophy-outline" label="Career Stats" />
        <View style={styles.card}>
          <View style={styles.statsGrid}>
            <StatPill value={career.matches || 0} label="Matches" />
            <StatPill value={career.wins || 0} label="Wins" highlight />
            <StatPill value={career.losses || 0} label="Losses" />
            <StatPill value={winPct} label="Win %" highlight />
          </View>
        </View>

        {/* ── Batting ───────────────────────────────────────────────────────── */}
        <SectionHeader icon="stats-chart-outline" label="Batting" />
        <View style={styles.card}>
          <View style={styles.infoGrid}>
            <InfoRow label="Style" value={viewedPlayer.battingStyle || 'Right Hand'} />
            <InfoRow label="Order" value={viewedPlayer.battingOrder || 'Middle Order'} />
          </View>
          <View style={styles.cardDivider} />
          <View style={styles.statsGrid}>
            <StatPill value={batting.innings || 0} label="Innings" />
            <StatPill value={batting.runs || 0} label="Runs" highlight />
            <StatPill value={viewedPlayer.battingAverage || 0} label="Average" />
            <StatPill value={viewedPlayer.strikeRate || 0} label="S/R" />
          </View>
          <View style={[styles.statsGrid, { marginTop: 10 }]}>
            <StatPill value={batting.fours || 0} label="4s" />
            <StatPill value={batting.sixes || 0} label="6s" highlight />
            <StatPill value={batting.highestScore || 0} label="Highest" />
            <StatPill value={batting.notOuts || 0} label="N.O." />
          </View>
        </View>

        {/* ── Bowling ───────────────────────────────────────────────────────── */}
        <SectionHeader icon="podium-outline" label="Bowling" />
        <View style={styles.card}>
          <View style={styles.infoGrid}>
            <InfoRow label="Style" value={viewedPlayer.bowlingStyle || 'Right Arm Fast'} />
          </View>
          <View style={styles.cardDivider} />
          <View style={styles.statsGrid}>
            <StatPill value={bowling.innings || 0} label="Innings" />
            <StatPill value={bowling.wickets || 0} label="Wickets" highlight />
            <StatPill value={viewedPlayer.economy || 0} label="Economy" />
            <StatPill value={viewedPlayer.bowlingAverage || '—'} label="Average" />
          </View>
          <View style={[styles.statsGrid, { marginTop: 10 }]}>
            <StatPill value={bowling.overs || 0} label="Overs" />
            <StatPill value={bowling.runs || 0} label="Runs" />
            <StatPill value={bowling.bestWickets || 0} label="Best" highlight />
            <StatPill value={bowling.maidens || 0} label="Maidens" />
          </View>
        </View>

        {/* ── Fielding ──────────────────────────────────────────────────────── */}
        <SectionHeader icon="shield-checkmark-outline" label="Fielding" />
        <View style={styles.card}>
          <View style={styles.statsGrid}>
            <StatPill value={fielding.catches || 0} label="Catches" />
            <StatPill value={fielding.runOuts || 0} label="Run Outs" />
            <StatPill value={fielding.stumpings || 0} label="Stumpings" />
            <StatPill value={career.playerOfMatchAwards || 0} label="POTM" highlight />
          </View>
        </View>

        <View style={{ height: 48 }} />
      </ScrollView>

      {/* ── Social Modal ──────────────────────────────────────────────────────── */}
      <Modal
        visible={socialModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setSocialModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {socialType === 'followers' ? 'Followers' : 'Following'}
                <Text style={styles.modalCount}> ({socialList.length})</Text>
              </Text>
              <TouchableOpacity
                onPress={() => setSocialModalVisible(false)}
                style={styles.modalCloseBtn}
              >
                <Icon name="close" size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {socialLoading ? (
              <ActivityIndicator size="large" color={Colors.primary} style={{ marginVertical: 48 }} />
            ) : socialList.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Icon name="people-outline" size={52} color={Colors.textTertiary} />
                <Text style={styles.emptyText}>No users yet</Text>
              </View>
            ) : (
              <FlatList
                data={socialList}
                keyExtractor={item => item._id}
                renderItem={({ item }) => {
                  const itemPhoto = item.photo || item.userId?.photo;
                  return (
                    <View style={styles.socialListItem}>
                      <TouchableOpacity
                        style={styles.socialListLeft}
                        onPress={() => {
                          setSocialModalVisible(false);
                          navigation.push('PlayerDetail', { id: item._id });
                        }}
                      >
                        {itemPhoto ? (
                          <Image source={{ uri: getImageUrl(itemPhoto) }} style={styles.listAvatar} />
                        ) : (
                          <View style={styles.listAvatarFallback}>
                            <Icon name="person" size={18} color={Colors.primary} />
                          </View>
                        )}
                        <View style={{ flex: 1 }}>
                          <Text style={styles.listName}>{item.name}</Text>
                          <Text style={styles.listRole}>{item.playingRole || 'Cricket Player'}</Text>
                        </View>
                      </TouchableOpacity>

                      {isOwnProfile && (
                        <TouchableOpacity
                          style={styles.listActionBtn}
                          onPress={() => {
                            socialType === 'followers'
                              ? handleRemoveFollower(item._id)
                              : handleUnfollowFromList(item._id);
                          }}
                        >
                          <Text style={styles.listActionText}>
                            {socialType === 'followers' ? 'Remove' : 'Unfollow'}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                }}
                contentContainerStyle={{ paddingBottom: 40 }}
              />
            )}
          </View>
        </View>
      </Modal>
      {/* Tag Definition Modal */}
      <Modal visible={!!selectedTagDefinition} transparent={true} animationType="fade" onRequestClose={() => setSelectedTagDefinition(null)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setSelectedTagDefinition(null)}>
          <View style={[styles.modalSheet, { width: '80%', alignItems: 'center', alignSelf: 'center', marginBottom: 'auto', marginTop: 'auto', borderRadius: 20 }]}>
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.primaryAlpha20, justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
              <Icon name="pricetag" size={24} color={Colors.primary} />
            </View>
            <Text style={{ fontSize: 18, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary, marginBottom: 8, textAlign: 'center' }}>{selectedTagDefinition?.name}</Text>
            <Text style={{ fontSize: 14, fontFamily: Typography.fontFamily.regular, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 }}>
              {selectedTagDefinition?.desc}
            </Text>
            <TouchableOpacity style={{ marginTop: 24, paddingVertical: 10, paddingHorizontal: 24, backgroundColor: Colors.primary, borderRadius: BorderRadius.md }} onPress={() => setSelectedTagDefinition(null)}>
              <Text style={{ color: Colors.background, fontFamily: Typography.fontFamily.bold }}>Got It</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  centeredState: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: Colors.background, paddingHorizontal: 32,
  },
  loadingText: {
    marginTop: 14, fontSize: 14, color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.medium,
  },
  errorText: {
    marginTop: 14, fontSize: 16, color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.medium, marginBottom: 24,
    textAlign: 'center',
  },
  goBackBtn: {
    backgroundColor: Colors.primary, borderRadius: BorderRadius.xl,
    paddingHorizontal: 28, paddingVertical: 13,
  },
  goBackBtnText: { color: '#fff', fontFamily: Typography.fontFamily.bold, fontSize: 15 },

  // ── Header ──
  headerSafe: {
    backgroundColor: Colors.backgroundCard,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    paddingHorizontal: 12,
  },
  headerBtn: {
    position: 'absolute',
    left: 12,
    zIndex: 10,
    width: 44, height: 44,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: 22,
  },
  headerTitle: {
    flex: 1, fontSize: 17,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.textPrimary,
    textAlign: 'center',
    includeFontPadding: false,
    lineHeight: 52,
  },

  scrollContent: { paddingBottom: 20 },

  // ── Hero Card ──
  heroCard: {
    backgroundColor: Colors.backgroundCard,
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 24,
    paddingHorizontal: 20,
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },

  avatarRing: {
    width: 96, height: 96, borderRadius: 48,
    borderWidth: 3, borderColor: Colors.primary,
    backgroundColor: Colors.primaryAlpha10,
    overflow: 'hidden',
    marginBottom: 16,
    ...Shadows.glow,
  },
  avatar: { width: '100%', height: '100%' },
  avatarFallback: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: Colors.primaryAlpha10,
  },
  avatarFallbackLetter: {
    color: Colors.primary,
    fontFamily: Typography.fontFamily.bold,
    fontSize: 32,
  },

  heroName: {
    fontSize: 22, fontFamily: Typography.fontFamily.bold,
    color: Colors.textPrimary, letterSpacing: 0.3,
  },
  rolePill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.primaryAlpha10,
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5,
    marginTop: 8,
    borderWidth: 1, borderColor: Colors.primaryAlpha20,
  },
  roleText: {
    fontSize: 12, fontFamily: Typography.fontFamily.semiBold,
    color: Colors.primary,
  },

  locationRow: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginTop: 8,
  },
  locationText: {
    fontSize: 12, fontFamily: Typography.fontFamily.regular,
    color: Colors.textSecondary,
  },

  // Social row
  socialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 4,
    width: '100%',
    backgroundColor: Colors.backgroundElevated,
    borderRadius: BorderRadius.xl,
    paddingVertical: 14,
    borderWidth: 1, borderColor: Colors.border,
  },
  socialItem: { flex: 1, alignItems: 'center' },
  socialCount: {
    fontSize: 18, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary,
  },
  socialLabel: {
    fontSize: 11, fontFamily: Typography.fontFamily.medium,
    color: Colors.textSecondary, marginTop: 2,
  },
  socialSep: { width: 1, height: 28, backgroundColor: Colors.border },

  // Follow button
  followBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: 28, paddingVertical: 11,
    marginTop: 16,
    ...Shadows.glow,
  },
  followingBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1, borderColor: Colors.border,
  },
  followBtnText: {
    color: '#fff', fontSize: 14, fontFamily: Typography.fontFamily.bold,
  },
  followingBtnText: { color: Colors.textSecondary },

  // ── Section header ──
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, marginBottom: 10, marginTop: 4,
  },
  sectionIconWrap: {
    width: 26, height: 26, borderRadius: 8,
    backgroundColor: Colors.primaryAlpha10,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.primaryAlpha20,
  },
  sectionTitle: {
    fontSize: 13, fontFamily: Typography.fontFamily.bold,
    color: Colors.textPrimary, textTransform: 'uppercase',
    letterSpacing: 1,
  },

  // ── Card ──
  card: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.xl,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1, borderColor: Colors.border,
    ...Shadows.sm,
  },
  cardDivider: {
    height: 1, backgroundColor: Colors.border, marginVertical: 14,
  },

  // ── Stat pills ──
  statsGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  statPill: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: Colors.backgroundElevated,
    borderRadius: 10,
    paddingVertical: 10,
    marginHorizontal: 3,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statPillVal: {
    fontSize: 16,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.textPrimary,
  },
  statPillValHL: { color: Colors.primary },
  statPillLbl: {
    fontSize: 10,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.textTertiary,
    marginTop: 3,
    textAlign: 'center',
  },

  // ── Info rows ──
  infoGrid: { gap: 8 },
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 13, fontFamily: Typography.fontFamily.regular,
    color: Colors.textSecondary,
  },
  infoValuePill: {
    backgroundColor: Colors.backgroundElevated,
    borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: Colors.border,
  },
  infoValue: {
    fontSize: 12, fontFamily: Typography.fontFamily.semiBold,
    color: Colors.textPrimary,
  },

  // ── Modal ──
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: Colors.backgroundCard,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 20, paddingBottom: 36,
    maxHeight: '85%',
    borderTopWidth: 1, borderColor: Colors.border,
  },
  modalHandle: {
    width: 40, height: 4, backgroundColor: Colors.border,
    borderRadius: 2, alignSelf: 'center', marginBottom: 18,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 20,
  },
  modalTitle: { fontSize: 18, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary },
  modalCount: { color: Colors.textSecondary, fontFamily: Typography.fontFamily.regular },
  modalCloseBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.backgroundElevated,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },

  emptyWrap: { alignItems: 'center', paddingVertical: 48 },
  emptyText: {
    marginTop: 12, fontSize: 14, color: Colors.textTertiary,
    fontFamily: Typography.fontFamily.medium,
  },

  socialListItem: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  socialListLeft: {
    flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12,
  },
  listAvatar: { width: 44, height: 44, borderRadius: 22 },
  listAvatarFallback: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.primaryAlpha10,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.primaryAlpha20,
  },
  listName: { fontSize: 15, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary },
  listRole: {
    fontSize: 12, fontFamily: Typography.fontFamily.regular,
    color: Colors.textSecondary, marginTop: 1,
  },
  listActionBtn: {
    borderRadius: 8, borderWidth: 1, borderColor: Colors.errorLight,
    paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: 'rgba(244,67,54,0.06)',
  },
  listActionText: {
    fontSize: 12, fontFamily: Typography.fontFamily.semiBold,
    color: Colors.error,
  },
});

export default PlayerDetailScreen;
