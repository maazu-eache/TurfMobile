import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, Image, BackHandler, Modal, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors, Typography, BorderRadius, Spacing, useTheme } from '../../../theme/theme';
import api, { getImageUrl } from '../../../api/axios';
import { showCustomAlert } from '../../../components/CustomAlert';
import { useDispatch, useSelector } from 'react-redux';
import { setLiveState } from '../matchSlice';
import socketService from '../../../services/socketService';
// Removed imageUtils import

const SelectBowlerScreen = ({ route, navigation }) => {
  const { colors, shadows, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, shadows, isDark), [colors, shadows, isDark]);
  const { matchId } = route.params;
  const dispatch = useDispatch();
  
  const { liveState } = useSelector((state) => state.match);
  const match = liveState?.match;
  const score = liveState?.score;

  const [fullSquad, setFullSquad] = useState([]);
  const [fullOppositionSquad, setFullOppositionSquad] = useState([]);
  const [loading, setLoading] = useState(false);
  const [scorecards, setScorecards] = useState([]);
  const [commentary, setCommentary] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const [showEditSquadModal, setShowEditSquadModal] = useState(false);
  const [editingSquad, setEditingSquad] = useState([]);
  const [isSavingSquad, setIsSavingSquad] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

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
      fetchCommentary();
    }
  }, [match?._id]);

  const fetchCommentary = async () => {
    try {
      const res = await api.get(`/matches/${match._id}/commentary`);
      setCommentary(res.data.data || []);
    } catch (e) {
      console.log('Error fetching commentary', e);
    }
  };

  const bowlersOrder = useMemo(() => {
    if (!commentary || commentary.length === 0) return [];
    
    // Filter commentary to only include balls of the current innings
    const currentInningsBalls = commentary.filter(ball => {
      const ballInningsId = String(ball.innings?._id || ball.innings || '');
      const currentInningsId = String(match?.innings?.[match?.currentInnings - 1]?._id || match?.innings?.[match?.currentInnings - 1] || '');
      return ballInningsId && currentInningsId && ballInningsId === currentInningsId;
    });
    
    // Map overNumber -> bowlerId
    const overBowlersMap = {};
    currentInningsBalls.forEach(ball => {
      const oNum = ball.overNumber;
      const bId = String(ball.bowler?._id || ball.bowler || '');
      if (bId && !overBowlersMap[oNum]) {
        overBowlersMap[oNum] = bId;
      }
    });

    const sortedOvers = Object.keys(overBowlersMap)
      .map(Number)
      .sort((a, b) => a - b);
      
    return sortedOvers.map(oNum => overBowlersMap[oNum]);
  }, [commentary, match?.innings, match?.currentInnings]);

  const sortedSquad = useMemo(() => {
    const XI = isTeamABatting ? (match?.playingXI?.teamB || []) : (match?.playingXI?.teamA || []);
    const filteredXI = XI.filter(Boolean);

    // bowlersOrder is: [bowler_over_1, bowler_over_2, ..., bowler_over_N]
    // The previous bowler is bowler_over_N.
    // The bowler we want to prioritize is bowler_over_N-1.
    const priorityBowlerId = (bowlersOrder.length >= 2) 
      ? String(bowlersOrder[bowlersOrder.length - 2]) 
      : '';

    return [...filteredXI].sort((a, b) => {
      const aId = String(a._id || a);
      const bId = String(b._id || b);

      // A) Check priority bowler:
      if (priorityBowlerId) {
        if (aId === priorityBowlerId) return -1;
        if (bId === priorityBowlerId) return 1;
      }

      // B) Keep disabled bowlers at the bottom:
      const currentScorecard = scorecards.find(sc => sc.inningsNumber === match?.currentInnings);
      const getBowlerStatus = (bowlerId) => {
        let isQuotaCompleted = false;
        if (currentScorecard) {
          const bowlerStat = currentScorecard.bowling.find(b => String(b.player?._id || b.player) === bowlerId);
          if (bowlerStat && bowlerStat.overs >= match.bowlerQuota) {
            isQuotaCompleted = true;
          }
        }
        const prevBowlerId = String(liveState?.previousBowler?._id || liveState?.previousBowler || '');
        const isPreviousBowler = prevBowlerId !== '' && prevBowlerId === bowlerId;
        const otherEligibleCount = filteredXI.filter(p => {
          const pId = String(p._id || p);
          if (pId === bowlerId) return false;
          if (currentScorecard) {
            const bStat = currentScorecard.bowling.find(b => String(b.player?._id || b.player) === pId);
            if (bStat && bStat.overs >= match.bowlerQuota) return false;
          }
          return true;
        }).length;
        const isPreviousBowlerBlocked = isPreviousBowler && otherEligibleCount > 0;
        return isQuotaCompleted || isPreviousBowlerBlocked;
      };

      const aDisabled = getBowlerStatus(aId);
      const bDisabled = getBowlerStatus(bId);

      if (aDisabled && !bDisabled) return 1;
      if (!aDisabled && bDisabled) return -1;

      return 0;
    });
  }, [match?.playingXI, isTeamABatting, bowlersOrder, scorecards, match?.currentInnings, match?.bowlerQuota, liveState?.previousBowler]);

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
      console.log('Error loading roster data:', e);
    }
  };

  const onRefreshModal = async () => {
    setRefreshing(true);
    await loadFullRosterData();
    setRefreshing(false);
  };

  const toggleSquadMember = (player) => {
    const isMember = editingSquad.some(p => String(p._id || p) === String(player._id || player));
    if (isMember) {
      setEditingSquad(editingSquad.filter(p => String(p._id || p) !== String(player._id || player)));
    } else {
      const isInOtherSquad = oppositionSquad.some(p => String(p._id || p) === String(player._id || player));
      if (isInOtherSquad) {
        showCustomAlert('Cannot Select Player', `This player is already in the playing squad for the other team. A player cannot play for both teams.`);
      } else {
        setEditingSquad([...editingSquad, player]);
      }
    }
  };

  const saveSquads = async () => {
    setIsSavingSquad(true);
    try {
      const teamA_Squad = isTeamABatting ? oppositionSquad.map(p => p._id || p) : editingSquad.map(p => p._id || p);
      const teamB_Squad = isTeamABatting ? editingSquad.map(p => p._id || p) : oppositionSquad.map(p => p._id || p);
      
      await api.post(`/matches/${matchId}/playing-xi`, {
        teamA: teamA_Squad,
        teamB: teamB_Squad
      });
      
      const res = await api.get(`/matches/${matchId}/live`);
      dispatch(setLiveState(res.data.data));
      setShowEditSquadModal(false);
    } catch (e) {
      showCustomAlert('Error', 'Failed to save squad');
    } finally {
      setIsSavingSquad(false);
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
          bowlerStats: { runs: 0, balls: 0, wickets: 0, maidens: 0, overs: 0 },
          needsBowler: false,
          currentOverBalls: []
        }));
      }

      // Instant 0ms navigation to LiveScorerScreen
      navigation.navigate('LiveScorer', { matchId: match._id, skipFocusFetch: true, bowlerSelectedTime: Date.now() });

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
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      )}

      {/* Premium Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.navigate('LiveScorer', { matchId, skipAutoBowler: true })}>
          <Icon name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.headerTitle}>Select Bowler</Text>
          <Text style={styles.headerSubtitle}>{isTeamABatting ? match?.teamB?.name : match?.teamA?.name}</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={sortedSquad}
          keyExtractor={item => item._id}
          renderItem={({ item }) => {
            const currentScorecard = scorecards.find(sc => sc.inningsNumber === match?.currentInnings);
            let isQuotaCompleted = false;
            let bowledOvers = 0;
            let bowledWickets = 0;
            let bowledRuns = 0;
            if (currentScorecard) {
              const bowlerStat = currentScorecard.bowling.find(b => String(b.player?._id || b.player) === String(item._id || item));
              if (bowlerStat) {
                bowledOvers = bowlerStat.overs;
                bowledWickets = bowlerStat.wickets || 0;
                bowledRuns = bowlerStat.runs || 0;
                if (bowlerStat.overs >= match.bowlerQuota) {
                  isQuotaCompleted = true;
                }
              }
            }

            const prevBowlerId = String(liveState?.previousBowler?._id || liveState?.previousBowler || '');
            const itemId = String(item._id || item);
            const isPreviousBowler = prevBowlerId !== '' && prevBowlerId === itemId;

            const otherEligibleBowlers = squad.filter(p => {
              const pId = String(p._id || p);
              if (pId === itemId) return false;
              if (currentScorecard) {
                const bStat = currentScorecard.bowling.find(b => String(b.player?._id || b.player) === pId);
                if (bStat && bStat.overs >= match.bowlerQuota) return false;
              }
              return true;
            });

            const isPreviousBowlerBlocked = isPreviousBowler && otherEligibleBowlers.length > 0;
            const isDisabled = isQuotaCompleted || isPreviousBowlerBlocked;

            const photoUrl = item.photo || item.userId?.photo || item.avatar || null;
            const quotaMax = match.bowlerQuota || 4;
            const quotaFraction = Math.min(bowledOvers / quotaMax, 1);

            return (
              <TouchableOpacity
                style={[styles.playerItem, isDisabled && styles.playerItemDisabled]}
                onPress={() => !isDisabled && handleSelect(item._id)}
                disabled={isDisabled}
                activeOpacity={0.75}
              >
                {/* Avatar */}
                <View style={styles.avatarWrapper}>
                  {photoUrl ? (
                    <Image source={{ uri: getImageUrl(photoUrl) }} style={styles.avatar} resizeMode="cover" />
                  ) : (
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
                    </View>
                  )}
                  {isPreviousBowler && !isPreviousBowlerBlocked && (
                    <View style={styles.prevBadge}>
                      <Icon name="history" size={8} color="#fff" />
                    </View>
                  )}
                </View>

                {/* Info */}
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                    <Text style={styles.playerName} numberOfLines={1}>{item.name}</Text>
                    {bowledOvers > 0 && (
                      <View style={styles.statsBadge}>
                        <Text style={styles.statsBadgeText}>{bowledWickets}W  {bowledRuns}R</Text>
                      </View>
                    )}
                  </View>
                  {isQuotaCompleted ? (
                    <Text style={styles.statusTextError}>Quota full ({bowledOvers}/{quotaMax} ov)</Text>
                  ) : isPreviousBowlerBlocked ? (
                    <Text style={styles.statusTextError}>Bowled previous over</Text>
                  ) : (
                    <View style={styles.quotaBarRow}>
                      <View style={styles.quotaBarBg}>
                        <View style={[styles.quotaBarFill, { flex: quotaFraction }]} />
                        <View style={{ flex: 1 - quotaFraction }} />
                      </View>
                      <Text style={styles.quotaText}>{bowledOvers}/{quotaMax} ov</Text>
                    </View>
                  )}
                </View>

                {!isDisabled && (
                  <Icon name="chevron-right" size={22} color={colors.primary} />
                )}
              </TouchableOpacity>
            );
          }}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<Text style={styles.emptyText}>No players in squad.</Text>}
        />
      )}
      
      <Modal visible={showEditSquadModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <SafeAreaView style={styles.modalContentFull} edges={['top', 'bottom']}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Playing XI (Bowlers)</Text>
              <TouchableOpacity onPress={() => setShowEditSquadModal(false)}>
                <Icon name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.instructionText}>Check the players you want in the playing XI. Pull down to refresh.</Text>

            <ScrollView 
              style={styles.modalList}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefreshModal} colors={[colors.primary]} tintColor={colors.primary} />}
            >
              {fullSquad.map((p, idx) => {
                const isSelected = editingSquad.some(s => String(s._id || s) === String(p._id || p));
                return (
                  <TouchableOpacity
                    key={p._id + '_' + idx}
                    style={styles.rosterListItem}
                    onPress={() => toggleSquadMember(p)}
                  >
                    <Icon
                      name={isSelected ? "checkbox-marked" : "checkbox-blank-outline"}
                      size={24}
                      color={isSelected ? colors.primary : colors.textTertiary}
                    />
                    <View style={styles.avatarPlaceholderSm}>
                      <Text style={styles.avatarTextSm}>{p.name.charAt(0).toUpperCase()}</Text>
                    </View>
                    <Text style={styles.modalListText}>{p.name}</Text>
                  </TouchableOpacity>
                )
              })}
            </ScrollView>

            <View style={styles.editSquadFooter}>
              <TouchableOpacity
                style={styles.addNewBtn}
                onPress={() => {
                  setShowEditSquadModal(false);
                  const _bTeam = String(match?.innings?.[match?.currentInnings - 1]?.battingTeam?._id || match?.innings?.[match?.currentInnings - 1]?.battingTeam || '');
                  const _aTeam = String(match?.teamA?._id || match?.teamA || '');
                  const isTeamABattingLocal = _bTeam === _aTeam;
                  const teamId = isTeamABattingLocal ? match?.teamB?._id : match?.teamA?._id;
                  
                  navigation.navigate('AddPlayer', {
                    teamId,
                    matchId,
                    roster: fullSquad,
                    oppositionRoster: fullOppositionSquad,
                    squad: editingSquad,
                    onClose: () => setShowEditSquadModal(true),
                    onPlayerAdded: async (newPlayer) => {
                      try {
                        const teamA_Squad = isTeamABattingLocal ? oppositionSquad.map(p => p._id || p) : [...editingSquad.map(p => p._id || p), newPlayer._id];
                        const teamB_Squad = isTeamABattingLocal ? [...editingSquad.map(p => p._id || p), newPlayer._id] : oppositionSquad.map(p => p._id || p);

                        await api.post(`/matches/${matchId}/playing-xi`, {
                          teamA: teamA_Squad,
                          teamB: teamB_Squad
                        });
                        
                        const res = await api.get(`/matches/${matchId}/live`);
                        dispatch(setLiveState(res.data.data));
                        
                        setFullSquad(prev => {
                          const exists = prev.some(p => p._id === newPlayer._id);
                          return exists ? prev : [...prev, newPlayer];
                        });
                        setEditingSquad(prev => {
                          const exists = prev.some(p => p._id === newPlayer._id);
                          return exists ? prev : [...prev, newPlayer];
                        });
                        
                        loadFullRosterData();
                        setShowEditSquadModal(true);
                      } catch (e) {
                        console.log('Error adding new player:', e);
                      }
                    }
                  });
                }}
              >
                <Icon name="plus" size={20} color={colors.textSecondary} />
                <Text style={styles.addNewBtnText}>Add New Player to Team</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.saveBtn} onPress={saveSquads} disabled={isSavingSquad}>
                {isSavingSquad ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Squad</Text>}
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>
      </Modal>

      <View style={styles.footer}>
        {score ? (
          <View style={styles.scoreFooterBanner}>
            <View style={styles.scoreFooterLeft}>
              <Icon name="cricket" size={14} color={colors.primary} style={{ marginRight: 6 }} />
              <Text style={styles.scoreFooterTeam} numberOfLines={1}>
                {isTeamABatting ? match?.teamA?.name : match?.teamB?.name}
              </Text>
            </View>
            <Text style={styles.scoreFooterScore}>
              {score.runs}/{score.wickets}
              <Text style={styles.scoreFooterOvers}> ({score.overs} ov)</Text>
            </Text>
            {match?.currentInnings === 2 && liveState?.toWin && liveState?.ballsRemaining ? (
              <Text style={styles.scoreFooterNeed}>
                {'  '}Need {liveState.toWin} runs off {liveState.ballsRemaining} balls
              </Text>
            ) : null}
          </View>
        ) : null}
        <TouchableOpacity
          style={styles.editBtn}
          onPress={() => {
            setEditingSquad(squad);
            setShowEditSquadModal(true);
          }}
        >
          <Icon name="account-edit" size={20} color={colors.primary} />
          <Text style={styles.editBtnText}>Edit Squad / Add Player</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const createStyles = (colors, shadows, isDark) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  backBtn: { padding: 4 },
  headerTitle: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: 17,
    color: colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.medium,
    color: colors.textSecondary,
    marginTop: 1,
  },
  loadingContainer: {
    padding: Spacing.xl,
    alignItems: 'center',
  },
  listContent: {
    padding: Spacing.md,
    paddingBottom: 100,
  },
  playerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: Spacing.md,
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.lg,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.borderLight,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    gap: 12,
  },
  playerItemDisabled: {
    opacity: 0.45,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primaryAlpha10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.primaryAlpha20,
  },
  avatarText: {
    fontFamily: Typography.fontFamily.bold,
    color: colors.primary,
    fontSize: 20,
  },
  prevBadge: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.textSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
  playerName: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: 15,
    color: colors.textPrimary,
    flex: 1,
  },
  statsBadge: {
    backgroundColor: colors.primaryAlpha10,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
    borderWidth: 1,
    borderColor: colors.primaryAlpha20,
  },
  statsBadgeText: {
    fontSize: 11,
    fontFamily: Typography.fontFamily.bold,
    color: colors.primary,
  },
  statusTextError: {
    fontSize: 12,
    color: colors.error,
    fontFamily: Typography.fontFamily.medium,
    marginTop: 2,
  },
  quotaBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  quotaBarBg: {
    flex: 1,
    height: 4,
    backgroundColor: colors.borderLight,
    borderRadius: 2,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  quotaBarFill: {
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  quotaText: {
    fontSize: 11,
    fontFamily: Typography.fontFamily.medium,
    color: colors.textSecondary,
  },
  emptyText: {
    textAlign: 'center',
    color: colors.textSecondary,
    fontFamily: Typography.fontFamily.medium,
    marginTop: Spacing.lg,
  },
  footer: {
    padding: Spacing.md,
    paddingBottom: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  scoreFooterBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryAlpha10,
    borderRadius: BorderRadius.sm,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.primaryAlpha20,
    flexWrap: 'wrap',
    gap: 4,
  },
  scoreFooterLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  scoreFooterTeam: {
    fontSize: 13,
    fontFamily: Typography.fontFamily.semiBold,
    color: colors.textSecondary,
    flex: 1,
  },
  scoreFooterScore: {
    fontSize: 18,
    fontFamily: Typography.fontFamily.bold,
    color: colors.primary,
  },
  scoreFooterOvers: {
    fontSize: 13,
    fontFamily: Typography.fontFamily.medium,
    color: colors.textSecondary,
  },
  scoreFooterNeed: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.semiBold,
    color: colors.primary,
    width: '100%',
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.md,
    backgroundColor: colors.primaryAlpha10,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: colors.primaryAlpha20,
    gap: 8,
  },
  editBtnText: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: 15,
    color: colors.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContentFull: {
    backgroundColor: colors.surface,
    padding: Spacing.base,
    height: '100%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: Typography.fontFamily.bold,
    color: colors.textPrimary,
  },
  instructionText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: Spacing.md,
  },
  modalList: {
    flex: 1,
  },
  rosterListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: Spacing.base,
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.md,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  avatarPlaceholderSm: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryAlpha10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: colors.primaryAlpha20,
  },
  avatarTextSm: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: 'bold',
  },
  modalListText: {
    fontSize: 15,
    fontFamily: Typography.fontFamily.semiBold,
    color: colors.textPrimary,
  },
  editSquadFooter: {
    marginTop: Spacing.base,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingTop: Spacing.base,
  },
  addNewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    marginBottom: 12,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
    gap: 6,
  },
  addNewBtnText: {
    marginLeft: 8,
    color: colors.textSecondary,
    fontSize: 15,
  },
  saveBtn: {
    backgroundColor: colors.primary,
    padding: 14,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#000',
    fontSize: 16,
    fontFamily: Typography.fontFamily.bold,
  }
});

export default SelectBowlerScreen;
