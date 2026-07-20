import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, RefreshControl } from 'react-native';
import { Colors, Typography, Spacing, BorderRadius } from '../../../theme/theme';
import { getImageUrl } from '../../../api/axios';
import Icon from 'react-native-vector-icons/Feather';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';

const TABS = ['Batters', 'Bowlers', 'Fielders', 'MVP'];

const RANK_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32'];

const TournamentLeaderboard = ({ tournament }) => {
  const [activeTab, setActiveTab] = useState('Batters');

  if (!tournament?.leaderboard) {
    return (
      <View style={styles.emptyContainer}>
        <MCIcon name="trophy-outline" size={52} color={Colors.textTertiary} />
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
      case 'Batters': return tournament.leaderboard.mostRuns || [];
      case 'Bowlers': return tournament.leaderboard.mostWickets || [];
      case 'Fielders': return tournament.leaderboard.bestFielders || [];
      case 'MVP': return tournament.leaderboard.mvp || [];
      default: return [];
    }
  };

  const getPrimaryValue = (item) => {
    switch (activeTab) {
      case 'Batters': return { value: item.runs || 0, unit: 'Runs' };
      case 'Bowlers': return { value: item.wickets || 0, unit: 'Wkts' };
      case 'Fielders': return { value: item.dismissals || 0, unit: 'Dis' };
      case 'MVP': return { value: item.points || 0, unit: 'Pts' };
      default: return { value: 0, unit: '' };
    }
  };

  const getStatPills = (item) => {
    switch (activeTab) {
      case 'Batters':
        return [
          { label: 'Avg', value: item.average || '0' },
          { label: 'M', value: item.matches || '0' },
          { label: 'HS', value: item.highestScore || '0' },
        ];
      case 'Bowlers':
        return [
          { label: 'Ov', value: item.overs || '0' },
          { label: 'Eco', value: item.economy || '0' },
          { label: 'Best', value: item.bestBowling || '-' },
        ];
      case 'Fielders':
        return [
          { label: 'Ct', value: item.catches || '0' },
          { label: 'RO', value: item.runOuts || '0' },
          { label: 'St', value: item.stumpings || '0' },
        ];
      default:
        return [];
    }
  };

  const renderTopThree = (players) => {
    if (!players || players.length === 0) return null;
    const top = players.slice(0, Math.min(3, players.length));
    // Podium order: 2nd, 1st, 3rd
    const podiumOrder = top.length >= 3 ? [top[1], top[0], top[2]] : top.length === 2 ? [top[1], top[0]] : [top[0]];

    return (
      <View style={styles.podiumWrapper}>
        {podiumOrder.map((item, podIdx) => {
          if (!item) return null;
          const realIdx = players.indexOf(item);
          const player = item.player || {};
          const team = item.team || {};
          const stat = getPrimaryValue(item);
          const isFirst = realIdx === 0;
          const rankColor = RANK_COLORS[realIdx] || Colors.primary;

          return (
            <View key={player._id || podIdx} style={[styles.podiumItem, isFirst && styles.podiumFirst]}>
              <View style={[styles.podiumAvatarWrap, { borderColor: rankColor }]}>
                {player.photo && getPhotoUrl(player.photo) ? (
                  <Image source={{ uri: getPhotoUrl(player.photo) }} style={styles.podiumAvatar} />
                ) : (
                  <View style={[styles.podiumAvatar, { backgroundColor: Colors.backgroundElevated, justifyContent: 'center', alignItems: 'center' }]}>
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
            </View>
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
      const team = item.team || {};
      const stat = getPrimaryValue(item);
      const pills = getStatPills(item);

      return (
        <View key={player._id || realIdx} style={styles.listCard}>
          <Text style={styles.listRank}>#{realIdx + 1}</Text>
          {player.photo && getPhotoUrl(player.photo) ? (
            <Image source={{ uri: getPhotoUrl(player.photo) }} style={styles.listAvatar} />
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
        </View>
      );
    });
  };

  const data = getActiveData();

  return (
    <View style={styles.container}>
      {/* Sub-tabs — underline style */}
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
              color={activeTab === tab ? Colors.primary : Colors.textTertiary}
              style={{ marginBottom: 2 }}
            />
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {data.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MCIcon name="trophy-outline" size={40} color={Colors.textTertiary} />
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  /* Sub-tabs */
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.backgroundElevated,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 2.5,
    borderBottomColor: 'transparent',
  },
  tabItemActive: { borderBottomColor: Colors.primary },
  tabText: { color: Colors.textTertiary, fontFamily: Typography.fontFamily.medium, fontSize: 11, letterSpacing: 0.2 },
  tabTextActive: { color: Colors.primary, fontFamily: Typography.fontFamily.bold, fontSize: 11 },

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
    backgroundColor: Colors.backgroundElevated,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
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
    borderColor: Colors.background,
  },
  podiumRankText: { fontSize: 9, color: Colors.background, fontFamily: Typography.fontFamily.bold },
  podiumName: { fontSize: 12, color: Colors.textPrimary, fontFamily: Typography.fontFamily.bold, textAlign: 'center' },
  podiumTeam: { fontSize: 10, color: Colors.textTertiary, fontFamily: Typography.fontFamily.medium, textAlign: 'center', marginBottom: 6 },
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
  podiumStatUnit: { fontSize: 10, color: Colors.textSecondary, fontFamily: Typography.fontFamily.medium },

  /* Ranking list (4th onwards) */
  restHeader: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontFamily: Typography.fontFamily.semiBold,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  listCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundElevated,
    marginHorizontal: 12,
    marginBottom: 8,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  listRank: { width: 26, fontSize: 13, color: Colors.textTertiary, fontFamily: Typography.fontFamily.bold, textAlign: 'center' },
  listAvatar: { width: 42, height: 42, borderRadius: 21 },
  listAvatarFallback: { backgroundColor: Colors.primaryAlpha20, justifyContent: 'center', alignItems: 'center' },
  listAvatarLetter: { fontSize: 17, fontFamily: Typography.fontFamily.bold, color: Colors.primary },
  listName: { fontSize: 14, color: Colors.textPrimary, fontFamily: Typography.fontFamily.bold },
  listTeam: { fontSize: 11, color: Colors.textTertiary, fontFamily: Typography.fontFamily.medium, marginBottom: 4 },

  /* Stat pills */
  pillRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  pill: { flexDirection: 'row', gap: 3, backgroundColor: Colors.background, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  pillLabel: { fontSize: 10, color: Colors.textTertiary, fontFamily: Typography.fontFamily.medium },
  pillValue: { fontSize: 10, color: Colors.textSecondary, fontFamily: Typography.fontFamily.bold },

  listStatBox: { alignItems: 'flex-end' },
  listStatValue: { fontSize: 18, fontFamily: Typography.fontFamily.bold, color: Colors.primary },
  listStatUnit: { fontSize: 10, color: Colors.textSecondary, fontFamily: Typography.fontFamily.medium },

  /* Empty */
  emptyContainer: { padding: 40, alignItems: 'center', gap: 10 },
  emptyTitle: { fontSize: 16, color: Colors.textPrimary, fontFamily: Typography.fontFamily.bold, marginTop: 4 },
  emptyText: { color: Colors.textTertiary, fontFamily: Typography.fontFamily.medium, fontSize: 13, textAlign: 'center' },
});

export default TournamentLeaderboard;
