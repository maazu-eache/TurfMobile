import React, { useMemo, useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image, TouchableOpacity,
  Modal, Pressable, Dimensions, ActivityIndicator,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useTheme, Typography, Spacing, BorderRadius } from '../../../theme/theme';
import { getImageUrl } from '../../../api/axios';
import api from '../../../api/axios';
import Icon from 'react-native-vector-icons/Feather';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const TABS = ['Batters', 'Bowlers', 'Fielders', 'MVP'];
const RANK_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32'];

const TournamentLeaderboard = ({ tournament, onShare }) => {
  const { colors, shadows, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, shadows, isDark), [colors, shadows, isDark]);
  const [activeTab, setActiveTab] = useState('Batters');
  const [previewPlayer, setPreviewPlayer] = useState(null);
  const [careerStats, setCareerStats] = useState(null);
  const [careerLoading, setCareerLoading] = useState(false);
  const navigation = useNavigation();

  // Fetch career stats when a player is previewed
  useEffect(() => {
    const playerId = previewPlayer?.player?._id;
    if (!playerId) { setCareerStats(null); return; }
    let cancelled = false;
    setCareerStats(null);
    setCareerLoading(true);
    api.get(`/players/${playerId}`)
      .then(res => {
        if (!cancelled) {
          const p = res.data?.data || res.data;
          setCareerStats(p || null);
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setCareerLoading(false); });
    return () => { cancelled = true; };
  }, [previewPlayer?.player?._id]);

  if (!tournament?.leaderboard) {
    return (
      <View style={styles.emptyContainer}>
        <MCIcon name="trophy-outline" size={52} color={colors.textTertiary} />
        <Text style={styles.emptyTitle}>No leaderboard yet</Text>
        <Text style={styles.emptyText}>Stats will appear once matches are played.</Text>
      </View>
    );
  }

  const getPhotoUrl = (photo) => {
    if (!photo) return null;
    if (photo.startsWith('http')) return photo;
    return getImageUrl(photo);
  };

  const getTabIcon = (tab) => {
    switch (tab) {
      case 'Batters': return 'cricket';
      case 'Bowlers': return 'cricket';
      case 'Fielders': return 'hand-front-right';
      case 'MVP': return 'star';
      default: return 'account';
    }
  };

  const getActiveData = () => {
    switch (activeTab) {
      case 'Batters':
        return (tournament.leaderboard.mostRuns || []).filter(item => parseFloat(item.runs || 0) > 0);
      case 'Bowlers':
        return (tournament.leaderboard.mostWickets || []).filter(item => {
          const wkts = parseFloat(item.wickets || 0);
          const overs = parseFloat(item.overs || item.oversBowled || item.bowling?.overs || 0);
          return wkts > 0 || (wkts === 0 && overs > 0);
        });
      case 'Fielders':
        return (tournament.leaderboard.bestFielders || []).filter(item => parseFloat(item.dismissals || 0) > 0);
      case 'MVP':
        return (tournament.mvpLeaderboard || []).filter(item => parseFloat(item.totalMvp || 0) > 1);
      default:
        return [];
    }
  };

  const getPrimaryValue = (item) => {
    switch (activeTab) {
      case 'Batters': return { value: item.runs || 0, unit: 'Runs' };
      case 'Bowlers': return { value: item.wickets || 0, unit: 'Wkts' };
      case 'Fielders': return { value: item.dismissals || 0, unit: 'Dis' };
      case 'MVP': return { value: item.totalMvp || 0, unit: 'Pts' };
      default: return { value: 0, unit: '' };
    }
  };

  const getStatPills = (item) => {
    switch (activeTab) {
      case 'Batters':
        return [
          { label: 'Avg', value: item.average || '0' },
          { label: 'HS', value: item.highestScore || '0' },
        ];
      case 'Bowlers':
        return [
          { label: 'Eco', value: item.economy || '0' },
          { label: 'Best', value: item.bestBowling || '-' },
        ];
      case 'Fielders':
        return [
          { label: 'Ct', value: item.catches || '0' },
          { label: 'RO', value: item.runOuts || '0' },
        ];
      case 'MVP':
        return [
          { label: 'M', value: item.matches || '0' },
          { label: 'POM', value: item.pomCount || '0' },
        ];
      default:
        return [];
    }
  };

  const getPlayerTeam = (player, item) => {
    if (item.team?.name) return item.team;
    if (!tournament) return {};
    const playerId = String(player._id || player.id || '');
    if (!playerId) return {};
    const lists = [
      tournament.leaderboard?.mostRuns || [],
      tournament.leaderboard?.mostWickets || [],
      tournament.leaderboard?.bestFielders || [],
      tournament.leaderboard?.mostSixes || [],
      tournament.leaderboard?.mostFours || [],
      tournament.leaderboard?.mvp || []
    ];
    for (const list of lists) {
      const found = list.find(x => String(x.player?._id || x.player?.id || x.player) === playerId);
      if (found?.team?.name) return found.team;
    }
    return {};
  };

  const openPreview = (player, item) => {
    const team = getPlayerTeam(player, item);
    const photoUrl = player.photo || player.userId?.photo;
    setPreviewPlayer({ player, team, photoUrl, stat: getPrimaryValue(item) });
  };

  const renderTopThree = (players) => {
    if (!players || players.length === 0) return null;
    const top = players.slice(0, Math.min(3, players.length));
    const podiumOrder = top.length >= 3 ? [top[1], top[0], top[2]] : top.length === 2 ? [top[1], top[0]] : [top[0]];

    return (
      <View style={styles.podiumWrapper}>
        {podiumOrder.map((item, podIdx) => {
          if (!item) return null;
          const realIdx = players.indexOf(item);
          const player = item.player || {};
          const team = getPlayerTeam(player, item);
          const stat = getPrimaryValue(item);
          const pills = getStatPills(item);
          const isFirst = realIdx === 0;
          const rankColor = RANK_COLORS[realIdx] || colors.primary;
          const photoUrl = player.photo || player.userId?.photo;

          return (
            <TouchableOpacity
              key={player._id || podIdx}
              style={[styles.podiumItem, isFirst && styles.podiumFirst]}
              onPress={() => openPreview(player, item)}
              activeOpacity={0.85}
            >
              <View style={[styles.podiumAvatarWrap, { borderColor: rankColor }]}>
                {photoUrl && getPhotoUrl(photoUrl) ? (
                  <Image source={{ uri: getPhotoUrl(photoUrl) }} style={styles.podiumAvatar} />
                ) : (
                  <View style={[styles.podiumAvatar, { backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center' }]}>
                    <Text style={[styles.podiumAvatarLetter, { color: rankColor }]}>
                      {(player.name || 'U').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={[styles.podiumRankBadge, { backgroundColor: rankColor }]}>
                  <Text style={styles.podiumRankText}>{realIdx + 1}</Text>
                </View>
              </View>
              {isFirst && <MCIcon name="crown" size={18} color={RANK_COLORS[0]} style={{ marginBottom: 4 }} />}
              <Text style={[styles.podiumName, isFirst && { fontSize: 14 }]} numberOfLines={1}>{player.name || 'Unknown'}</Text>
              <Text style={styles.podiumTeam} numberOfLines={1}>{team.name || '-'}</Text>
              <View style={[styles.podiumStat, { borderColor: rankColor }]}>
                <Text style={[styles.podiumStatValue, { color: rankColor }]}>{stat.value}</Text>
                <Text style={styles.podiumStatUnit}>{stat.unit}</Text>
              </View>
              {pills.length > 0 && (
                <View style={[styles.pillRow, { justifyContent: 'center', marginTop: 6, gap: 4 }]}>
                  {pills.map((pill, pi) => (
                    <View key={pi} style={[styles.pill, { paddingHorizontal: 4, paddingVertical: 1 }]}>
                      <Text style={[styles.pillLabel, { fontSize: 8 }]}>{pill.label}</Text>
                      <Text style={[styles.pillValue, { fontSize: 8 }]}>{pill.value}</Text>
                    </View>
                  ))}
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  const renderRestList = (players) => {
    if (!players || players.length <= 3) return null;
    return players.slice(3).map((item, index) => {
      const realIdx = index + 3;
      const player = item.player || {};
      const team = getPlayerTeam(player, item);
      const stat = getPrimaryValue(item);
      const pills = getStatPills(item);
      const photoUrl = player.photo || player.userId?.photo;

      return (
        <TouchableOpacity
          key={player._id || realIdx}
          style={styles.listCard}
          onPress={() => openPreview(player, item)}
          activeOpacity={0.85}
        >
          <Text style={styles.listRank}>#{realIdx + 1}</Text>
          {photoUrl && getPhotoUrl(photoUrl) ? (
            <Image source={{ uri: getPhotoUrl(photoUrl) }} style={styles.listAvatar} />
          ) : (
            <View style={[styles.listAvatar, styles.listAvatarFallback]}>
              <Text style={styles.listAvatarLetter}>{(player.name || 'U').charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.listName} numberOfLines={1}>{player.name || 'Unknown'}</Text>
            <Text style={styles.listTeam} numberOfLines={1}>{team.name || '-'}</Text>
            {pills.length > 0 && (
              <View style={styles.pillRow}>
                {pills.map((pill, pi) => (
                  <View key={pi} style={styles.pill}>
                    <Text style={styles.pillLabel}>{pill.label}</Text>
                    <Text style={styles.pillValue}>{pill.value}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
          <View style={styles.listStatBox}>
            <Text style={styles.listStatValue}>{stat.value}</Text>
            <Text style={styles.listStatUnit}>{stat.unit}</Text>
          </View>
        </TouchableOpacity>
      );
    });
  };

  const data = getActiveData();

  return (
    <View style={styles.container}>
      {/* Sub-tabs */}
      <View style={styles.tabBar}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tabItem, activeTab === tab && styles.tabItemActive]}
            onPress={() => setActiveTab(tab)}
          >
            <MCIcon
              name={getTabIcon(tab)}
              size={15}
              color={activeTab === tab ? colors.primary : colors.textTertiary}
              style={{ marginBottom: 2 }}
            />
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {onShare && (
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: Spacing.md, paddingTop: 12, paddingBottom: 16 }}>
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(154,188,47,0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 }}
            onPress={() => {
              let shareType = 'runs';
              if (activeTab === 'Bowlers') shareType = 'wickets';
              if (activeTab === 'Fielders') shareType = 'catches';
              if (activeTab === 'MVP') shareType = 'mvp';
              const resolvedData = getActiveData().slice(0, 10).map(item => {
                const player = item.player || {};
                const team = getPlayerTeam(player, item);
                return { ...item, team };
              });
              onShare({ type: 'leaderboard', data: { type: shareType, data: resolvedData } });
            }}
          >
            <Icon name="share-2" size={14} color={colors.primary} style={{ marginRight: 6 }} />
            <Text style={{ color: colors.primary, fontFamily: Typography.fontFamily.bold, fontSize: 12 }}>Share {activeTab}</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {data.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MCIcon name="trophy-outline" size={40} color={colors.textTertiary} />
            <Text style={styles.emptyText}>No {activeTab} data yet</Text>
          </View>
        ) : (
          <>
            {renderTopThree(data)}
            {data.length > 3 && (
              <Text style={styles.restHeader}>Ranking</Text>
            )}
            {renderRestList(data)}
          </>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Player Preview Modal */}
      <Modal
        visible={!!previewPlayer}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setPreviewPlayer(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setPreviewPlayer(null)}>
          <Pressable style={styles.previewCard} onPress={() => {}}>
            {/* Full-width cover image */}
            <View style={styles.coverImageContainer}>
              {previewPlayer?.photoUrl && getPhotoUrl(previewPlayer.photoUrl) ? (
                <Image
                  source={{ uri: getPhotoUrl(previewPlayer.photoUrl) }}
                  style={styles.coverImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={[styles.coverImage, styles.coverImageFallback]}>
                  <MCIcon name="account-circle" size={100} color="rgba(255,255,255,0.2)" />
                </View>
              )}
              {/* Black gradient over image bottom for name */}
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.75)', 'rgba(0,0,0,0.98)']}
                style={styles.coverGradient}
              >
                <View style={styles.coverNameRow}>
                  <Text style={styles.coverName}>{previewPlayer?.player?.name || 'Unknown'}</Text>
                  {previewPlayer?.team?.name ? (
                    <Text style={styles.coverTeam}>{previewPlayer.team.name}</Text>
                  ) : null}
                </View>
              </LinearGradient>

              {/* Close button */}
              <TouchableOpacity style={styles.closeBtn} onPress={() => setPreviewPlayer(null)}>
                <MCIcon name="close" size={20} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Overall Career Stats */}
            <View style={styles.lbCareerRow}>
              {careerLoading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                [{
                  label: 'Matches', value: careerStats?.career?.matches ?? '-'
                }, {
                  label: 'Runs', value: careerStats?.batting?.runs ?? '-'
                }, {
                  label: 'Wickets', value: careerStats?.bowling?.wickets ?? '-'
                }].map((s, i) => (
                  <View key={i} style={[styles.lbCareerPill, i < 2 && { borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.08)' }]}>
                    <Text style={styles.lbCareerValue}>{s.value}</Text>
                    <Text style={styles.lbCareerLabel}>{s.label}</Text>
                  </View>
                ))
              )}
            </View>

            {/* View Profile Button */}
            {previewPlayer?.player?._id && (
              <TouchableOpacity
                style={styles.viewProfileBtn}
                activeOpacity={0.85}
                onPress={() => {
                  setPreviewPlayer(null);
                  navigation.navigate('PlayerDetail', { id: previewPlayer.player._id });
                }}
              >
                <MCIcon name="account-arrow-right" size={18} color="#000" style={{ marginRight: 6 }} />
                <Text style={styles.viewProfileBtnText}>View Full Profile</Text>
              </TouchableOpacity>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const createStyles = (colors, shadows, isDark) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  /* Sub-tabs */
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 2.5,
    borderBottomColor: 'transparent',
  },
  tabItemActive: { borderBottomColor: colors.primary },
  tabText: { color: colors.textTertiary, fontFamily: Typography.fontFamily.medium, fontSize: 11, letterSpacing: 0.2 },
  tabTextActive: { color: colors.primary, fontFamily: Typography.fontFamily.bold, fontSize: 11 },

  scrollContent: { paddingBottom: 20 },

  /* Podium */
  podiumWrapper: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingTop: 24,
    paddingHorizontal: 8,
    paddingBottom: 16,
    gap: 8,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: 12,
  },
  podiumItem: {
    flex: 1,
    alignItems: 'center',
    paddingBottom: 8,
  },
  podiumFirst: { marginBottom: 16 },
  podiumAvatarWrap: {
    position: 'relative',
    borderWidth: 2.5,
    borderRadius: 32,
    padding: 2,
    marginBottom: 6,
  },
  podiumAvatar: { width: 54, height: 54, borderRadius: 27 },
  podiumAvatarLetter: { fontSize: 22, fontFamily: Typography.fontFamily.bold },
  podiumRankBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.background,
  },
  podiumRankText: { fontSize: 9, color: colors.background, fontFamily: Typography.fontFamily.bold },
  podiumName: { fontSize: 12, color: colors.textPrimary, fontFamily: Typography.fontFamily.bold, textAlign: 'center' },
  podiumTeam: { fontSize: 10, color: colors.textTertiary, fontFamily: Typography.fontFamily.medium, textAlign: 'center', marginBottom: 6 },
  podiumStat: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 3,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 3,
  },
  podiumStatValue: { fontSize: 14, fontFamily: Typography.fontFamily.bold },
  podiumStatUnit: { fontSize: 10, color: colors.textSecondary, fontFamily: Typography.fontFamily.medium },

  /* Ranking list (4th onwards) */
  restHeader: {
    fontSize: 12,
    color: colors.textTertiary,
    fontFamily: Typography.fontFamily.semiBold,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  listCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    marginHorizontal: 12,
    marginBottom: 8,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  listRank: { width: 26, fontSize: 13, color: colors.textTertiary, fontFamily: Typography.fontFamily.bold, textAlign: 'center' },
  listAvatar: { width: 42, height: 42, borderRadius: 21 },
  listAvatarFallback: { backgroundColor: colors.primaryAlpha20, justifyContent: 'center', alignItems: 'center' },
  listAvatarLetter: { fontSize: 17, fontFamily: Typography.fontFamily.bold, color: colors.primary },
  listName: { fontSize: 14, color: colors.textPrimary, fontFamily: Typography.fontFamily.bold },
  listTeam: { fontSize: 11, color: colors.textTertiary, fontFamily: Typography.fontFamily.medium, marginBottom: 4 },

  /* Stat pills */
  pillRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  pill: { flexDirection: 'row', gap: 3, backgroundColor: colors.background, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  pillLabel: { fontSize: 10, color: colors.textTertiary, fontFamily: Typography.fontFamily.medium },
  pillValue: { fontSize: 10, color: colors.textSecondary, fontFamily: Typography.fontFamily.bold },

  listStatBox: { alignItems: 'flex-end' },
  listStatValue: { fontSize: 18, fontFamily: Typography.fontFamily.bold, color: colors.primary },
  listStatUnit: { fontSize: 10, color: colors.textSecondary, fontFamily: Typography.fontFamily.medium },

  /* Empty */
  emptyContainer: { padding: 40, alignItems: 'center', gap: 10 },
  emptyTitle: { fontSize: 16, color: colors.textPrimary, fontFamily: Typography.fontFamily.bold, marginTop: 4 },
  emptyText: { color: colors.textTertiary, fontFamily: Typography.fontFamily.medium, fontSize: 13, textAlign: 'center' },

  /* Player Preview Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  previewCard: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 20,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: isDark ? 0.5 : 0.15,
    shadowRadius: 20,
  },
  coverImageContainer: {
    width: '100%',
    height: SCREEN_HEIGHT * 0.38,
    position: 'relative',
    backgroundColor: colors.surfaceVariant,
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverImageFallback: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  coverGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '60%',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  coverNameRow: {
    gap: 2,
  },
  coverName: {
    fontSize: 26,
    fontFamily: Typography.fontFamily.bold,
    color: '#fff',
    letterSpacing: 0.4,
  },
  coverTeam: {
    fontSize: 13,
    fontFamily: Typography.fontFamily.medium,
    color: 'rgba(255,255,255,0.85)',
  },
  closeBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: colors.surfaceVariant,
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    backgroundColor: isDark ? 'rgba(255,212,0,0.12)' : 'rgba(212,160,0,0.12)',
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,212,0,0.35)' : 'rgba(212,160,0,0.35)',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  statPillValue: {
    fontSize: 28,
    fontFamily: Typography.fontFamily.bold,
    color: isDark ? '#FFD400' : colors.primaryDark,
  },
  statPillUnit: {
    fontSize: 14,
    fontFamily: Typography.fontFamily.medium,
    color: colors.textSecondary,
  },
  viewProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: isDark ? '#FFD400' : colors.primaryDark,
    marginHorizontal: 16,
    marginBottom: 16,
    marginTop: 4,
    borderRadius: 12,
    paddingVertical: 14,
  },
  viewProfileBtnText: {
    fontSize: 15,
    fontFamily: Typography.fontFamily.bold,
    color: isDark ? '#000' : '#FFF',
    letterSpacing: 0.3,
  },
  lbCareerRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  lbCareerPill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  lbCareerValue: {
    fontSize: 22,
    fontFamily: Typography.fontFamily.bold,
    color: isDark ? '#FFD400' : colors.primaryDark,
  },
  lbCareerLabel: {
    fontSize: 11,
    fontFamily: Typography.fontFamily.medium,
    color: colors.textSecondary,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
});

export default TournamentLeaderboard;
