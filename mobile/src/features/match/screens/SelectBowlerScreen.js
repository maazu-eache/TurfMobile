import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, Image, BackHandler } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors, Typography, BorderRadius, Spacing } from '../../../theme/theme';
import api, { getImageUrl } from '../../../api/axios';
import { showCustomAlert } from '../../../components/CustomAlert';
import { useDispatch, useSelector } from 'react-redux';
import { setLiveState } from '../matchSlice';
import socketService from '../../../services/socketService';
// Removed imageUtils import

const SelectBowlerScreen = ({ route, navigation }) => {
  const { matchId } = route.params;
  const dispatch = useDispatch();
  
  const { liveState } = useSelector((state) => state.match);
  const match = liveState?.match;
  const score = liveState?.score;

  const [fullSquad, setFullSquad] = useState([]);
  const [fullOppositionSquad, setFullOppositionSquad] = useState([]);
  const [loading, setLoading] = useState(false);
  const [scorecards, setScorecards] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const loadedOnceRef = useRef(false);

  useEffect(() => {
    const backAction = () => {
      navigation.navigate('LiveScorer', { matchId, skipAutoBowler: true });
      return true;
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction
    );

    return () => backHandler.remove();
  }, [navigation, matchId]);

  // derive squads reactively from Redux liveState
  const currentInnings = match?.innings?.[match?.currentInnings - 1];
  const batTeamStr = String(currentInnings?.battingTeam?._id || currentInnings?.battingTeam || '');
  const teamAStr = String(match?.teamA?._id || match?.teamA || '');
  const isTeamABatting = batTeamStr === teamAStr;

  const squad = useMemo(() => {
    const XI = isTeamABatting ? (match?.playingXI?.teamB || []) : (match?.playingXI?.teamA || []);
    return XI.filter(Boolean);
  }, [match?.playingXI, isTeamABatting]);

  const oppositionSquad = useMemo(() => {
    const XI = isTeamABatting ? (match?.playingXI?.teamA || []) : (match?.playingXI?.teamB || []);
    return XI.filter(Boolean);
  }, [match?.playingXI, isTeamABatting]);

  useEffect(() => {
    if (match && !loadedOnceRef.current) {
      loadedOnceRef.current = true;
      loadFullRosterData();
      fetchScorecards();
    }
  }, [match?._id]);

  const fetchScorecards = async () => {
    try {
      const res = await api.get(`/matches/${match._id}/scorecard`);
      setScorecards(res.data.data || []);
    } catch (e) {
      console.log('Error fetching scorecards', e);
    }
  };

  const loadFullRosterData = async () => {
    try {
      const bowlTeamId = isTeamABatting ? match.teamB._id : match.teamA._id;
      const batTeamId = isTeamABatting ? match.teamA._id : match.teamB._id;
      
      const [bowlRes, batRes] = await Promise.all([
        api.get(`/teams/${bowlTeamId}`),
        api.get(`/teams/${batTeamId}`)
      ]);
      
      const bowlPlayers = bowlRes.data.data.players.map(p => p.player);
      const batPlayers = batRes.data.data.players.map(p => p.player);
      
      setFullSquad(bowlPlayers.filter(Boolean));
      setFullOppositionSquad(batPlayers.filter(Boolean));
    } catch (e) {
      console.log('Error loading roster:', e);
    }
  };

  const selectionLockRef = useRef(false);

  const handleSelect = (bowlerId) => {
    if (selectionLockRef.current) return;
    selectionLockRef.current = true;
    try {
      const selectedBowlerObj = squad.find(p => String(p._id || p) === String(bowlerId)) || fullSquad.find(p => String(p._id || p) === String(bowlerId)) || bowlerId;

      if (liveState) {
        dispatch(setLiveState({
          ...liveState,
          bowler: selectedBowlerObj,
          needsBowler: false,
          currentOverBalls: []
        }));
      }

      // Instant 0ms navigation to LiveScorerScreen
      navigation.navigate('LiveScorer', { matchId: match._id, skipFocusFetch: true });

      // Emit via Socket.IO instead of slow HTTP API call
      const socket = socketService.getSocket();
      socket.emit('change_bowler', { matchId: match._id, bowlerId });

      setTimeout(() => {
        selectionLockRef.current = false;
      }, 50);
    } catch (e) {
      selectionLockRef.current = false;
      showCustomAlert('Error', 'Failed to select bowler');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {submitting && (
        <View style={[StyleSheet.absoluteFill, { zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' }]}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      )}
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.navigate('LiveScorer', { matchId, skipAutoBowler: true })}>
          <Icon name="arrow-left" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Select Bowler</Text>
        <View style={{ width: 28 }} />
      </View>

      <View style={styles.scoreContainer}>
        <Text style={styles.scoreText}>{score?.runs}/{score?.wickets} <Text style={styles.oversText}>({score?.overs} Ov)</Text></Text>
        {match?.currentInnings === 2 && liveState?.toWin && liveState?.ballsRemaining ? (
          <Text style={{ marginTop: 4, color: Colors.primary, fontFamily: Typography.fontFamily.semiBold }}>
            Need {liveState.toWin} runs from {liveState.ballsRemaining} balls
          </Text>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={squad}
          keyExtractor={item => item._id}
          renderItem={({ item }) => {
            const currentScorecard = scorecards.find(sc => sc.inningsNumber === match?.currentInnings);
            let isQuotaCompleted = false;
            let bowledOvers = 0;
            if (currentScorecard) {
              const bowlerStat = currentScorecard.bowling.find(b => String(b.player?._id || b.player) === String(item._id || item));
              if (bowlerStat) {
                bowledOvers = bowlerStat.overs;
                if (bowlerStat.overs >= match.bowlerQuota) {
                  isQuotaCompleted = true;
                }
              }
            }

            const prevBowlerId = String(liveState?.previousBowler?._id || liveState?.previousBowler || '');
            const itemId = String(item._id || item);
            const isPreviousBowler = prevBowlerId !== '' && prevBowlerId === itemId;

            // Check if there are ANY other bowlers in the squad who are eligible (not quota completed)
            const otherEligibleBowlers = squad.filter(p => {
              const pId = String(p._id || p);
              if (pId === itemId) return false;
              if (currentScorecard) {
                const bStat = currentScorecard.bowling.find(b => String(b.player?._id || b.player) === pId);
                if (bStat && bStat.overs >= match.bowlerQuota) return false;
              }
              return true;
            });

            // Only block previous bowler if there is at least one other eligible bowler available
            const isPreviousBowlerBlocked = isPreviousBowler && otherEligibleBowlers.length > 0;
            const isDisabled = isQuotaCompleted || isPreviousBowlerBlocked;

            const photoUrl = item.photo || item.userId?.photo;

            return (
              <TouchableOpacity 
                style={[styles.playerItem, isDisabled && { opacity: 0.5 }]} 
                onPress={() => !isDisabled && handleSelect(item._id)}
                disabled={isDisabled}
              >
                {photoUrl ? (
                  <Image source={{ uri: getImageUrl(photoUrl) }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
                  </View>
                )}
                
                <View style={{ flex: 1 }}>
                  <Text style={styles.playerName}>{item.name}</Text>
                  {isQuotaCompleted ? (
                    <Text style={{ color: Colors.error, fontSize: 12 }}>Quota Completed ({bowledOvers} Ov)</Text>
                  ) : isPreviousBowlerBlocked ? (
                    <Text style={{ color: Colors.error, fontSize: 12 }}>Bowled previous over</Text>
                  ) : (
                    <Text style={{ color: Colors.textSecondary, fontSize: 12 }}>Bowled: {bowledOvers} Ov • Remaining: {match.bowlerQuota - bowledOvers} Ov</Text>
                  )}
                </View>
                {!isDisabled && (
                  <Icon name="chevron-right" size={24} color={Colors.primary} />
                )}
              </TouchableOpacity>
            );
          }}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<Text style={styles.emptyText}>No players in squad.</Text>}
        />
      )}
      
      <View style={styles.footer}>
        <TouchableOpacity 
          style={styles.addBtn} 
          onPress={() => {
            const _bTeam = String(match?.innings?.[match?.currentInnings - 1]?.battingTeam?._id || match?.innings?.[match?.currentInnings - 1]?.battingTeam || '');
            const _aTeam = String(match?.teamA?._id || match?.teamA || '');
            const isTeamABatting = _bTeam === _aTeam;
            const teamId = isTeamABatting ? match?.teamB?._id : match?.teamA?._id;
            const playingXI = isTeamABatting ? match?.playingXI?.teamB : match?.playingXI?.teamA;
            navigation.navigate('AddPlayer', { 
              teamId,
              matchId,
              roster: fullSquad,
              oppositionRoster: fullOppositionSquad,
              squad: playingXI || [],
              onPlayerAdded: async (newPlayer) => {
                try {
                  const currentTeamA_XI = match?.playingXI?.teamA?.map(p => p._id || p) || [];
                  const currentTeamB_XI = match?.playingXI?.teamB?.map(p => p._id || p) || [];
                  
                  if (isTeamABatting) {
                    currentTeamB_XI.push(newPlayer._id);
                  } else {
                    currentTeamA_XI.push(newPlayer._id);
                  }
                  
                  await api.post(`/matches/${matchId}/playing-xi`, {
                    teamA: currentTeamA_XI,
                    teamB: currentTeamB_XI
                  });
                  
                  const res = await api.get(`/matches/${matchId}/live`);
                  dispatch(setLiveState(res.data.data));
                  
                  // Reload list
                  loadFullRosterData();
                } catch (e) {
                  console.log('Error adding player to playing XI', e);
                }
              }
            });
          }}
        >
          <Icon name="plus" size={20} color={Colors.primary} />
          <Text style={styles.addBtnText}>Add Player</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: 18,
    color: Colors.textPrimary,
  },
  scoreContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  scoreText: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: 24,
    color: Colors.primary,
  },
  oversText: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: 14,
    color: Colors.textSecondary,
  },
  loadingContainer: {
    padding: Spacing.xl,
    alignItems: 'center',
  },
  listContent: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  playerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.surfaceVariant,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  avatarText: {
    fontFamily: Typography.fontFamily.bold,
    color: Colors.primary,
    fontSize: 18,
  },
  playerName: {
    flex: 1,
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: 16,
    color: Colors.textPrimary,
  },
  emptyText: {
    textAlign: 'center',
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.medium,
    marginTop: Spacing.lg,
  },
  footer: {
    padding: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.md,
    backgroundColor: Colors.surfaceVariant,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
  },
  addBtnText: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: 16,
    color: Colors.primary,
    marginLeft: 8,
  },
});

export default SelectBowlerScreen;
