import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity } from 'react-native';
import { Colors, Typography, Spacing, BorderRadius } from '../../../theme/theme';
import { getImageUrl } from '../../../api/axios';

const TABS = ['Batters', 'Bowlers', 'Fielders', 'MVP'];

const TournamentLeaderboard = ({ tournament }) => {
  const [activeTab, setActiveTab] = useState('Batters');
  
  if (!tournament?.leaderboard) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No leaderboard data yet.</Text>
      </View>
    );
  }

  const getPhotoUrl = (photo) => {
    if (!photo) return null;
    if (photo.startsWith('http')) return photo;
    return getImageUrl(photo);
  };

  const renderPlayerList = (players, type) => {
    if (!players || players.length === 0) {
      return <Text style={styles.emptyText}>No data available</Text>;
    }

    return players.map((item, index) => {
      const player = item.player || {};
      const team = item.team || {};
      
      let primaryValue = '';
      let detailStats = null;

      if (type === 'Batters') {
        primaryValue = `${item.runs} Runs`;
        detailStats = (
          <View style={styles.detailRow}>
            <Text style={styles.detailText}>Avg: <Text style={styles.detailValue}>{item.average || 0}</Text></Text>
            <Text style={styles.detailText}>M: <Text style={styles.detailValue}>{item.matches || 0}</Text></Text>
            <Text style={styles.detailText}>Best: <Text style={styles.detailValue}>{item.highestScore || 0}</Text></Text>
          </View>
        );
      } else if (type === 'Bowlers') {
        primaryValue = `${item.wickets} Wkts`;
        detailStats = (
          <View style={styles.detailRow}>
            <Text style={styles.detailText}>Ov: <Text style={styles.detailValue}>{item.overs || 0}</Text></Text>
            <Text style={styles.detailText}>Eco: <Text style={styles.detailValue}>{item.economy || 0}</Text></Text>
            <Text style={styles.detailText}>Best: <Text style={styles.detailValue}>{item.bestBowling || '-'}</Text></Text>
          </View>
        );
      } else if (type === 'Fielders') {
        primaryValue = `${item.dismissals} Dis`;
        detailStats = (
          <View style={styles.detailRow}>
            <Text style={styles.detailText}>C: <Text style={styles.detailValue}>{item.catches || 0}</Text></Text>
            <Text style={styles.detailText}>RO: <Text style={styles.detailValue}>{item.runOuts || 0}</Text></Text>
            <Text style={styles.detailText}>St: <Text style={styles.detailValue}>{item.stumpings || 0}</Text></Text>
          </View>
        );
      } else if (type === 'MVP') {
        primaryValue = `${item.points} Pts`;
      }

      return (
        <View key={player._id || index} style={styles.playerCard}>
          <Text style={styles.rankText}>#{index + 1}</Text>
          {player.photo && getPhotoUrl(player.photo) ? (
            <Image source={{ uri: getPhotoUrl(player.photo) }} style={styles.playerPhoto} />
          ) : (
            <View style={[styles.playerPhoto, styles.avatarPlaceholder]}>
              <Text style={styles.avatarText}>{(player.name || 'U').charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.playerInfo}>
            <Text style={styles.playerName}>{player.name || 'Unknown'}</Text>
            <Text style={styles.teamName}>{team.name || 'Unknown Team'}</Text>
            {detailStats}
          </View>
          <View style={styles.statsContainer}>
            <Text style={styles.primaryStat}>{primaryValue}</Text>
          </View>
        </View>
      );
    });
  };

  const getActiveData = () => {
    switch (activeTab) {
      case 'Batters': return tournament.leaderboard.mostRuns;
      case 'Bowlers': return tournament.leaderboard.mostWickets;
      case 'Fielders': return tournament.leaderboard.bestFielders;
      case 'MVP': return tournament.leaderboard.mvp;
      default: return [];
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll} contentContainerStyle={styles.tabContent}>
        {TABS.map(tab => (
          <TouchableOpacity 
            key={tab} 
            style={[styles.tab, activeTab === tab && styles.activeTab]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={styles.listContainer}>
        {renderPlayerList(getActiveData(), activeTab)}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Spacing.sm,
  },
  emptyContainer: {
    padding: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.medium,
  },
  tabScroll: {
    maxHeight: 50,
    minHeight: 50,
    marginBottom: Spacing.md,
  },
  tabContent: {
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  tab: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.backgroundElevated,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  activeTab: {
    backgroundColor: Colors.primary,
  },
  tabText: {
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: 12,
  },
  activeTabText: {
    color: Colors.white,
  },
  listContainer: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  playerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundElevated,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  rankText: {
    color: Colors.textTertiary,
    fontFamily: Typography.fontFamily.bold,
    fontSize: 16,
    width: 30,
  },
  playerPhoto: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: Spacing.md,
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.bold,
    fontSize: 15,
  },
  teamName: {
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.medium,
    fontSize: 12,
  },
  statsContainer: {
    alignItems: 'flex-end',
  },
  primaryStat: {
    color: Colors.primary,
    fontFamily: Typography.fontFamily.bold,
    fontSize: 16,
  },
  secondaryStat: {
    color: Colors.textTertiary,
    fontFamily: Typography.fontFamily.regular,
    fontSize: 12,
  },
  avatarPlaceholder: {
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: Colors.white,
    fontFamily: Typography.fontFamily.bold,
    fontSize: 18,
  },
  detailRow: {
    flexDirection: 'row',
    marginTop: 4,
  },
  detailText: {
    color: Colors.textTertiary,
    fontFamily: Typography.fontFamily.regular,
    fontSize: 11,
    marginRight: 10,
  },
  detailValue: {
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.semiBold,
  }
});

export default TournamentLeaderboard;
