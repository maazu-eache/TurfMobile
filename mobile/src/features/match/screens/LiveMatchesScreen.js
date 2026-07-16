import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, SafeAreaView } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { fetchMyMatches } from '../matchSlice';
import { Colors, Typography } from '../../../theme/theme';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import moment from 'moment';

const TABS = [
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'live', label: 'Live' },
  { id: 'completed', label: 'Completed' },
];

const LiveMatchesScreen = () => {
  const [activeTab, setActiveTab] = useState('live');
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const { myMatches, isLoading } = useSelector(state => state.match);

  useEffect(() => {
    if (isFocused) {
      loadMatches();
    }
  }, [isFocused, activeTab]);

  const loadMatches = () => {
    dispatch(fetchMyMatches({ status: activeTab, limit: 20 }));
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'live':
      case 'in_progress':
      case 'innings_break': return Colors.success;
      case 'scheduled': return Colors.warning;
      case 'completed': return Colors.primary;
      default: return Colors.textTertiary;
    }
  };

  const getLatestScore = (inningsArray) => {
    if (!inningsArray || inningsArray.length === 0) return null;
    const latest = inningsArray[inningsArray.length - 1];
    return `${latest.totalRuns}/${latest.totalWickets} (${latest.totalOvers}.${latest.totalBalls % 6})`;
  };

  const renderMatchCard = ({ item }) => {
    const scoreStr = getLatestScore(item.innings);
    return (
      <TouchableOpacity 
        style={styles.matchCard}
        onPress={() => {
          navigation.navigate('MatchSummary', { matchId: item._id });
        }}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.formatText} numberOfLines={1}>
            {item.tournament ? item.tournament.name : 'Individual Match'} • {item.ground || item.venueDetails || 'Ground'}, {item.city || 'City'}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
            <Text style={styles.statusText}>
              {item.status === 'in_progress' ? 'LIVE' : item.status.replace('_', ' ').toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={styles.teamsContainer}>
          <View style={styles.teamRow}>
            <Text style={styles.teamName} numberOfLines={1}>{item.teamA?.name || 'Team A'}</Text>
          </View>
          <View style={styles.vsContainer}>
            <Text style={styles.vsText}>V</Text>
          </View>
          <View style={styles.teamRow}>
            <Text style={[styles.teamName, {textAlign: 'right'}]} numberOfLines={1}>{item.teamB?.name || 'Team B'}</Text>
          </View>
        </View>

        {(item.status === 'in_progress' || item.status === 'completed' || item.status === 'innings_break') && scoreStr && (
          <View style={styles.scoreRow}>
            <Text style={styles.scoreText}>{scoreStr}</Text>
          </View>
        )}

        {item.toss?.winner && item.status !== 'scheduled' && (
          <View style={styles.tossRow}>
            <Text style={styles.tossText}>
              {item.toss.winner.name || (item.toss.winner?.toString() === item.teamA?._id?.toString() ? item.teamA?.name : item.teamB?.name)} won the toss and elected to {item.toss.choice}
            </Text>
          </View>
        )}

        <View style={styles.cardFooter}>
          <Icon name="calendar-clock" size={16} color={Colors.textTertiary} />
          <Text style={styles.dateText}>
            {item.status === 'scheduled' 
              ? `SCHEDULED AT ${moment(item.scheduledAt || item.createdAt).format('DD MMM, hh:mm A').toUpperCase()}` 
              : item.status.replace('_', ' ').toUpperCase()}
          </Text>
          <Text style={styles.venueText} numberOfLines={1}>
            {item.turf?.name ? ` • ${item.turf.name}` : ''}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Matches</Text>
      </View>

      <View style={styles.tabsContainer}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tabButton, activeTab === tab.id && styles.activeTabButton]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Text style={[styles.tabText, activeTab === tab.id && styles.activeTabText]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={myMatches}
        keyExtractor={item => item._id}
        renderItem={renderMatchCard}
        contentContainerStyle={styles.listContainer}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={loadMatches} tintColor={Colors.primary} />}
        ListEmptyComponent={
          !isLoading && (
            <View style={styles.emptyContainer}>
              <Icon name="cricket" size={64} color={Colors.border} />
              <Text style={styles.emptyText}>No {activeTab} matches found</Text>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: 20, paddingVertical: 15, backgroundColor: Colors.surface },
  headerTitle: { fontSize: 24, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary },
  tabsContainer: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tabButton: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 20, marginHorizontal: 4, backgroundColor: Colors.background },
  activeTabButton: { backgroundColor: Colors.primary },
  tabText: { fontFamily: Typography.fontFamily.medium, color: Colors.textSecondary, fontSize: 14 },
  activeTabText: { color: Colors.surface, fontFamily: Typography.fontFamily.bold },
  listContainer: { padding: 16, flexGrow: 1 },
  matchCard: { backgroundColor: Colors.surface, borderRadius: 12, padding: 16, marginBottom: 16, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  formatText: { fontSize: 12, fontFamily: Typography.fontFamily.semiBold, color: Colors.textSecondary },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  statusText: { fontSize: 10, fontFamily: Typography.fontFamily.bold, color: '#fff' },
  teamsContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  teamRow: { flex: 1 },
  teamName: { fontSize: 16, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary },
  vsContainer: { width: 30, height: 30, borderRadius: 15, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center', marginHorizontal: 10 },
  vsText: { fontSize: 12, fontFamily: Typography.fontFamily.bold, color: Colors.textTertiary },
  scoreRow: { alignItems: 'center', marginBottom: 12 },
  scoreText: { fontSize: 24, fontFamily: Typography.fontFamily.extraBold, color: Colors.primary },
  tossRow: { alignItems: 'center', marginBottom: 12, paddingHorizontal: 10 },
  tossText: { fontSize: 12, fontFamily: Typography.fontFamily.medium, color: Colors.textSecondary, fontStyle: 'italic', textAlign: 'center' },
  cardFooter: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 12 },
  dateText: { fontSize: 12, color: Colors.textTertiary, fontFamily: Typography.fontFamily.regular, marginLeft: 6 },
  venueText: { fontSize: 12, color: Colors.textTertiary, fontFamily: Typography.fontFamily.regular, flex: 1 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 60 },
  emptyText: { fontSize: 16, color: Colors.textTertiary, fontFamily: Typography.fontFamily.medium, marginTop: 16 },
});

export default LiveMatchesScreen;
