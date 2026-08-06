import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, ActivityIndicator, Modal, FlatList, Dimensions, Image, ImageBackground, StatusBar, Animated as RNAnimated, Easing, Alert, RefreshControl, Share, TextInput, BackHandler } from 'react-native';
import LinearGradient from '../../../components/SolidGradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { fetchLiveState, setLiveState, addMatchScorer } from '../matchSlice';
import api, { BASE_URL, getImageUrl } from '../../../api/axios';
import socketService from '../../../services/socketService';
import { Colors, Typography, BorderRadius, Spacing, Shadows } from '../../../theme/theme';
import moment from 'moment';
import { getPlayerTags } from '../../../utils/playerTags';
import ConfettiCannon from 'react-native-confetti-cannon';
import { showCustomAlert } from '../../../components/CustomAlert';
import SharePreviewModal from '../../tournament/components/SharePreviewModal';
import { MatchSummaryPoster } from '../../tournament/components/PosterTemplates';
import PartnershipsView from '../components/PartnershipsView';

const SCREEN_WIDTH = Dimensions.get('window').width;

const MvpPlayerRow = ({ player, idx, isPom, isTop, item }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={{ borderBottomWidth: 0.5, borderBottomColor: Colors.border, paddingVertical: 12 }}>
      <TouchableOpacity
        onPress={() => setExpanded(!expanded)}
        style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 }}
        activeOpacity={0.7}
      >
        <Text style={{ width: 28, fontSize: 13, fontWeight: 'bold', color: Colors.textSecondary, textAlign: 'center' }}>{idx + 1}</Text>

        <View style={styles.avatarPlaceholderSm}>
          {player.photo ? (
            <Image source={{ uri: getImageUrl(player.photo) }} style={{ width: '100%', height: '100%', borderRadius: 18 }} />
          ) : (
            <Text style={styles.avatarTextSm}>{player.name?.charAt(0).toUpperCase()}</Text>
          )}
        </View>

        <View style={{ flex: 1, marginLeft: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
            <Text style={{ color: Colors.textPrimary, fontWeight: 'bold', fontSize: 14 }}>{player.name}</Text>
            {isPom && (
              <View style={{ backgroundColor: '#eab308', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 }}>
                <Text style={{ color: '#000', fontSize: 9, fontWeight: 'bold' }}>POM</Text>
              </View>
            )}
            {isTop && !isPom && (
              <View style={{ backgroundColor: Colors.primaryAlpha20, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 }}>
                <Text style={{ color: Colors.primary, fontSize: 9, fontWeight: 'bold' }}>TOP MVP</Text>
              </View>
            )}
          </View>
          <Text style={{ color: Colors.textTertiary, fontSize: 11, marginTop: 2 }}>{player.playingRole || 'Player'}</Text>
        </View>

        <View style={{ alignItems: 'flex-end', marginRight: 8 }}>
          <Text style={{ color: Colors.primary, fontWeight: 'bold', fontSize: 16 }}>{item.totalMvp.toFixed(2)}</Text>
          <Text style={{ color: Colors.textTertiary, fontSize: 9 }}>PTS</Text>
        </View>

        <Icon name={expanded ? "chevron-up" : "chevron-down"} size={20} color={Colors.textTertiary} />
      </TouchableOpacity>

      {expanded && (
        <View style={{ marginTop: 12, marginLeft: 38, marginRight: 8, backgroundColor: 'rgba(255, 255, 255, 0.05)', padding: 12, borderRadius: 8, gap: 8 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: Colors.textSecondary, fontSize: 12 }}>🏏 Batting MVP</Text>
            <Text style={{ color: Colors.textPrimary, fontWeight: 'bold', fontSize: 12 }}>{item.battingMvp.toFixed(2)}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: Colors.textSecondary, fontSize: 12 }}>🥎 Bowling MVP</Text>
            <Text style={{ color: Colors.textPrimary, fontWeight: 'bold', fontSize: 12 }}>{item.bowlingMvp.toFixed(2)}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: Colors.textSecondary, fontSize: 12 }}>🧤 Fielding MVP</Text>
            <Text style={{ color: Colors.textPrimary, fontWeight: 'bold', fontSize: 12 }}>{item.fieldingMvp.toFixed(2)}</Text>
          </View>
        </View>
      )}
    </View>
  );
};

const AnalysisDropdown = ({ value, options, onSelect, placeholder }) => {
  const [visible, setVisible] = useState(false);
  const selectedOpt = options.find(o => o.value === value) || options.find(o => o.value?._id && value?._id && o.value._id === value._id);

  return (
    <View style={{ flex: 1, marginHorizontal: 4 }}>
      <TouchableOpacity
        style={{ backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.borderLight, borderRadius: 8, padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
        onPress={() => setVisible(true)}
      >
        <Text style={{ color: selectedOpt ? Colors.textPrimary : Colors.textSecondary, fontFamily: Typography.fontFamily.regular, fontSize: 13 }} numberOfLines={1}>
          {selectedOpt ? selectedOpt.label : placeholder}
        </Text>
        <Icon name="chevron-down" size={20} color={Colors.textSecondary} />
      </TouchableOpacity>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }} activeOpacity={1} onPress={() => setVisible(false)}>
          <View style={{ backgroundColor: Colors.surface, width: '100%', borderRadius: 12, padding: 16, maxHeight: 300 }}>
            <ScrollView>
              {options.map((opt, idx) => {
                const isSelected = value === opt.value || (value?._id && opt.value?._id && value._id === opt.value._id);
                return (
                  <TouchableOpacity key={idx} style={{ paddingVertical: 12, borderBottomWidth: idx < options.length - 1 ? 1 : 0, borderBottomColor: Colors.borderLight }} onPress={() => { onSelect(opt.value); setVisible(false); }}>
                    <Text style={{ color: isSelected ? Colors.primary : Colors.textPrimary, fontFamily: isSelected ? Typography.fontFamily.bold : Typography.fontFamily.regular, fontSize: 16 }}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const MatchSummaryScreen = ({ navigation, route }) => {
  const matchIdRaw = route.params?.matchId || route.params?.id || route.params?.match?._id || route.params?.match;
  const cleanMatchId = socketService.cleanId(matchIdRaw);
  const matchId = cleanMatchId;

  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();
  const reduxLiveState = useSelector((state) => state.match.liveState);
  const [matchData, setMatchData] = useState(null);
  const liveState = matchData || (reduxLiveState && String(reduxLiveState.match?._id || reduxLiveState.matchId || '').trim() === String(cleanMatchId).trim() ? reduxLiveState : null);
  const currentUser = useSelector((state) => state.auth.user);
  const [activeTab, setActiveTab] = useState(route.params?.initialTab || 'Summary');
  const [selectedPlayerPreview, setSelectedPlayerPreview] = useState(null);
  const [selectedTagDefinition, setSelectedTagDefinition] = useState(null);
  const [expandedInnings, setExpandedInnings] = useState({});

  const toggleInnings = (index) => {
    setExpandedInnings(prev => ({ ...prev, [index]: prev[index] === false ? true : false }));
  };

  const [commentary, setCommentary] = useState([]);
  const [loadingCommentary, setLoadingCommentary] = useState(false);
  const [scorecards, setScorecards] = useState([]);
  const [loadingScorecards, setLoadingScorecards] = useState(false);
  const [leaderboardFilter, setLeaderboardFilter] = useState('Batting');
  const [leaderboardTab, setLeaderboardTab] = useState('MVP');
  const [commentaryFilter, setCommentaryFilter] = useState('ALL');
  const [analysisFilter, setAnalysisFilter] = useState('ALL');
  const [partnershipFilter, setPartnershipFilter] = useState('ALL');
  const [declareResultModalVisible, setDeclareResultModalVisible] = useState(false);
  const [declareConfirmation, setDeclareConfirmation] = useState(null);
  const [selectedAnalysisBatter, setSelectedAnalysisBatter] = useState(null);
  const [expandedBalls, setExpandedBalls] = useState({});

  const handleBackPress = useCallback(() => {
    const state = navigation.getState();
    if (state && state.routes) {
      const routes = state.routes;
      if (routes.length >= 2) {
        const prevRoute = routes[routes.length - 2];
        if (prevRoute.name === 'LiveScorer' || prevRoute.name === 'MatchPlayerSelection') {
          navigation.navigate('My Cricket', { screen: 'MyCricketMain' });
          return true;
        }
      }
    }

    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('My Cricket', { screen: 'MyCricketMain' });
    }
    return true;
  }, [navigation]);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
    return () => backHandler.remove();
  }, [handleBackPress]);

  const toggleBallExpand = (ballId) => {
    setExpandedBalls(prev => ({ ...prev, [ballId]: !prev[ballId] }));
  };

  const [refreshing, setRefreshing] = useState(false);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showAddScorerModal, setShowAddScorerModal] = useState(false);
  const [showDeclareResultModal, setShowDeclareResultModal] = useState(false);
  const [showAbandonModal, setShowAbandonModal] = useState(false);
  const [newScorerMobile, setNewScorerMobile] = useState('');
  const [abandonReason, setAbandonReason] = useState('');
  const [resultType, setResultType] = useState('walkover');
  const [winnerTeamId, setWinnerTeamId] = useState(null);

  const fetchScorecards = useCallback(async (silent = false) => {
    if (!cleanMatchId) return;
    if (!silent) setLoadingScorecards(true);
    try {
      const res = await api.get(`/matches/${cleanMatchId}/scorecard`);
      setScorecards(res.data?.data || []);
    } catch (e) {
      console.log('Error fetching scorecards', e);
    } finally {
      if (!silent) setLoadingScorecards(false);
    }
  }, [cleanMatchId]);

  const handleShare = () => {
    setShareModalVisible(true);
  };


  const fetchCommentary = useCallback(async (silent = false) => {
    if (!cleanMatchId) return;
    if (!silent) setLoadingCommentary(true);
    try {
      const res = await api.get(`/matches/${cleanMatchId}/commentary`);
      setCommentary(Array.isArray(res.data?.data) ? res.data.data : res.data?.data?.commentary || []);
    } catch (e) {
      console.log('Error fetching commentary', e);
    } finally {
      if (!silent) setLoadingCommentary(false);
    }
  }, [cleanMatchId]);

  const fetchLocalLiveState = useCallback(async () => {
    if (!cleanMatchId) return;
    try {
      const res = await api.get(`/matches/${cleanMatchId}/live`);
      if (res.data?.data) {
        setMatchData(res.data.data);
        dispatch(setLiveState(res.data.data));
      }
    } catch (e) {
      console.log('Error fetching match live state:', e);
    }
  }, [cleanMatchId, dispatch]);

  const onRefresh = async () => {
    if (!cleanMatchId) return;
    setRefreshing(true);
    try {
      await Promise.all([
        fetchLocalLiveState(),
        fetchCommentary(),
        fetchScorecards(),
      ]);
    } catch (e) {
      console.log('Error refreshing match summary:', e);
    } finally {
      setRefreshing(false);
    }
  };

  const getRefreshControl = () => (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      colors={[Colors.primary]}
      tintColor={Colors.primary}
    />
  );

  const [celebration, setCelebration] = useState(null);
  const celebrationAnim = React.useRef(new RNAnimated.Value(0)).current;
  const lastBallRef = React.useRef(null);

  const triggerCelebration = (type, text, color) => {
    setCelebration({ type, text, color });
    celebrationAnim.setValue(0);
    RNAnimated.spring(celebrationAnim, {
      toValue: 1,
      friction: 4,
      tension: 60,
      useNativeDriver: true,
    }).start();

    setTimeout(() => {
      RNAnimated.timing(celebrationAnim, {
        toValue: 0,
        duration: 300,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start(() => setCelebration(null));
    }, 2800);
  };

  useEffect(() => {
    if (!cleanMatchId) return;

    socketService.remoteLog('MatchSummaryScreen', `Joined Match Room: match_${cleanMatchId}`);
    socketService.joinMatch(cleanMatchId);

    const handleScoreUpdate = (data) => {
      const updateMatchId = socketService.cleanId(data?.match?._id || data?.matchId || data);
      const activeCleanId = socketService.cleanId(cleanMatchId);
      if (activeCleanId && updateMatchId && activeCleanId !== updateMatchId) {
        socketService.remoteLog('MatchSummaryScreen', `Ignored update for different match. Expected: ${activeCleanId}, Received: ${updateMatchId}`);
        return; // Ignore updates for other matches
      }

      const runs = data?.score?.runs ?? data?.teamAScore?.runs ?? 0;
      const wickets = data?.score?.wickets ?? data?.teamAScore?.wickets ?? 0;
      const overs = data?.score?.overs ?? data?.teamAScore?.overs ?? '0.0';

      socketService.remoteLog('MatchSummaryScreen', `Live Update Received | Score: ${runs}/${wickets} (${overs} Ov)`, { matchId: updateMatchId });
      setMatchData(data);
      dispatch(setLiveState(data));
      socketService.remoteLog('MatchSummaryScreen', 'State & UI Updated via setMatchData');

      // Real-time synchronization for sub-tabs
      if (data?.fullCommentary) {
        setCommentary(data.fullCommentary);
      } else if (data?.recentCommentary?.length > 0) {
        setCommentary(prev => {
          const merged = [...data.recentCommentary];
          prev.forEach(p => {
            if (!merged.find(m => m._id === p._id)) {
              merged.push(p);
            }
          });
          return merged;
        });
      }
      if (data?.scorecards) {
        setScorecards(data.scorecards);
      } else {
        fetchScorecards(true);
      }

      // Trigger Celebration Logic (Instantly using ballEvent)
      if (data?.ballEvent) {
        const latestBall = data.ballEvent;
        const ballId = latestBall._id || latestBall.timestamp || JSON.stringify(latestBall);
        if (ballId !== lastBallRef.current) {
          lastBallRef.current = ballId;

          if (data.isMatchComplete || data.match?.status === 'completed') {
            const winnerName = getWinnerTeamName(data.match || liveState?.match, data.result || data.match?.result);
            triggerCelebration('won', `${winnerName}\nWON!`, Colors.warning);
          } else if (latestBall.isWicket || latestBall.wicketType) {
            triggerCelebration('wicket', 'W', Colors.error);
          } else if (latestBall.batsmanRuns === 6) {
            triggerCelebration('six', '6', Colors.primary);
          } else if (latestBall.batsmanRuns === 4) {
            triggerCelebration('four', '4', Colors.primary);
          }
        }
      } else if (data?.recentCommentary?.length > 0) {
        const latestBall = data.recentCommentary[0];
        if (latestBall._id && latestBall._id !== lastBallRef.current) {
          lastBallRef.current = latestBall._id;

          if (data.isMatchComplete || data.match?.status === 'completed') {
            const winnerName = getWinnerTeamName(data.match || liveState?.match, data.result || data.match?.result);
            triggerCelebration('won', `${winnerName}\nWON!`, Colors.warning);
          } else if (latestBall.isWicket) {
            triggerCelebration('wicket', 'W', Colors.error);
          } else if (latestBall.batsmanRuns === 6) {
            triggerCelebration('six', '6', Colors.primary);
          } else if (latestBall.batsmanRuns === 4) {
            triggerCelebration('four', '4', Colors.primary);
          }
        }
      }
    };

    const unsubscribeScore = socketService.onScoreUpdate(handleScoreUpdate);
    fetchLocalLiveState();

    const unsubscribeFocus = navigation.addListener('focus', () => {
      console.log(`⚡ [Frontend Viewer] Reconnected & Resubscribed | Room Rejoined: match_${cleanMatchId}`);
      socketService.joinMatch(cleanMatchId);
      fetchLocalLiveState();
      fetchCommentary();
      fetchScorecards();
    });

    return () => {
      unsubscribeFocus();
      unsubscribeScore();
      socketService.leaveMatch(cleanMatchId);
    };
  }, [dispatch, cleanMatchId, navigation, fetchCommentary, fetchScorecards, fetchLocalLiveState]);

  useEffect(() => {
    if (!cleanMatchId) return;
    if (activeTab === 'Comms' || activeTab === 'Analysis') {
      fetchCommentary();
    }
    if (activeTab === 'Scorecard' || activeTab === 'Analysis' || activeTab === 'Partnerships') {
      fetchScorecards();
    }
  }, [activeTab, cleanMatchId, fetchCommentary, fetchScorecards]);

  const isMatchComplete = liveState?.match?.status === 'completed';
  const isAwardCalculationPending = isMatchComplete && (!liveState?.match?.playerOfMatch || !liveState?.match?.result);

  useEffect(() => {
    let interval;
    if (isAwardCalculationPending) {
      interval = setInterval(() => {
        fetchLocalLiveState();
        fetchScorecards(true);
      }, 3000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isAwardCalculationPending, fetchLocalLiveState, fetchScorecards]);

  const isCurrentMatchLoaded = liveState && String(liveState.match?._id || liveState.matchId || '').trim() === String(cleanMatchId).trim();

  if (!isCurrentMatchLoaded) {
    socketService.remoteLog('MatchSummaryScreen', `Loading condition met: isCurrentMatchLoaded=${isCurrentMatchLoaded}, cleanMatchId=${cleanMatchId}, liveStateMatchId=${liveState?.match?._id || liveState?.matchId}`);
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background }]}>
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginBottom: 16 }} />
        <Text style={{ color: Colors.textPrimary, fontFamily: Typography.fontFamily.semiBold, fontSize: 18 }}>
          Loading Match Summary...
        </Text>
        <Text style={{ color: Colors.textSecondary, fontFamily: Typography.fontFamily.medium, fontSize: 14, marginTop: 8 }}>
          Fetching statistics and details
        </Text>
      </View>
    );
  }

  // Removing isAwardCalculationPending blocker so UI can render the normal match summary
  // while polling for player of the match.

  if (!liveState || !liveState.match) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Match data not found</Text>
        <TouchableOpacity onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('My Cricket', { screen: 'MyCricketMain' })} style={{ marginTop: 20 }}>
          <Text style={{ color: Colors.primary }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { match, score, striker, strikerStats, nonStriker, nonStrikerStats, bowler, previousBowler, bowlerStats } = liveState;

  const teamA = match.teamA?.name || 'Team A';
  const teamB = match.teamB?.name || 'Team B';
  const dateStr = match.scheduledAt ? moment(match.scheduledAt).format('DD MMM YYYY, hh:mm A') : moment(match.createdAt).format('DD MMM YYYY, hh:mm A');
  const formatStr = `${match.format} • ${match.overs} Overs`;

  const creatorId = typeof match.creator === 'object' ? match.creator?._id : match.creator;
  const isCreator = String(creatorId) === String(currentUser?._id);
  const tournamentOrganizerId = match.tournament?.organizer?._id || match.tournament?.organizer;
  const isTournamentOrganizer = String(tournamentOrganizerId) === String(currentUser?._id);
  const isTournamentCoOrganizer = match.tournament?.coOrganizers?.some(s => String(s?._id || s) === String(currentUser?._id));
  const isTournamentScorer = match.tournament?.scorers?.some(s => String(s?._id || s) === String(currentUser?._id));

  const isScorer = isCreator || isTournamentOrganizer || isTournamentCoOrganizer || isTournamentScorer || match.scorers?.some(s => {
    const sId = typeof s === 'object' ? s?._id : s;
    return String(sId) === String(currentUser?._id);
  });

  const runs = score?.runs || 0;
  const wickets = score?.wickets || 0;
  const overs = score?.overs || '0.0';

  const getTossWinnerName = () => {
    if (!match.toss?.winner) return '';
    if (match.toss.winner === match.teamA?._id) return match.teamA?.name;
    if (match.toss.winner === match.teamB?._id) return match.teamB?.name;
    return match.toss.winner.name || 'A Team';
  };

  const getShotPosition = (angle, isIndoor) => {
    if (angle === null || angle === undefined) return '';

    // Rotate angle by 180 degrees to match the inverted UI where DOWN is STRAIGHT
    let adjustedAngle = angle + 180;
    if (adjustedAngle > 180) adjustedAngle -= 360;

    if (isIndoor) {
      if (adjustedAngle >= -135 && adjustedAngle < -45) return 'V (Straight)';
      if ((adjustedAngle >= -180 && adjustedAngle < -135) || (adjustedAngle >= 135 && adjustedAngle <= 180)) return 'Leg Side';
      if (adjustedAngle >= -45 && adjustedAngle < 45) return 'Off Side';
      if (adjustedAngle >= 45 && adjustedAngle < 135) return 'Behind Wickets';
      return '';
    } else {
      // More precise Open Ground positions
      if (adjustedAngle >= -105 && adjustedAngle < -75) return 'Straight Down the Ground';
      if (adjustedAngle >= -75 && adjustedAngle < -30) return 'Long Off / Extra Cover';
      if (adjustedAngle >= -30 && adjustedAngle < 15) return 'Point / Cover';
      if (adjustedAngle >= 15 && adjustedAngle < 50) return 'Backward Point / Short Third Man';
      if (adjustedAngle >= 50 && adjustedAngle < 80) return 'Third Man';
      if (adjustedAngle >= 80 && adjustedAngle < 100) return 'Fine Leg / Behind Wickets';
      if (adjustedAngle >= 100 && adjustedAngle < 135) return 'Deep Fine Leg / Backward Square Leg';
      if (adjustedAngle >= 135 && adjustedAngle < 165) return 'Square Leg';
      if ((adjustedAngle >= 165 && adjustedAngle <= 180) || (adjustedAngle >= -180 && adjustedAngle < -165)) return 'Mid Wicket';
      if (adjustedAngle >= -165 && adjustedAngle < -135) return 'Cow Corner / Deep Mid Wicket';
      if (adjustedAngle >= -135 && adjustedAngle < -105) return 'Long On / Mid On';
      return '';
    }
  };

  const confirmDeclareResult = (resultType, teamId, teamName) => {
    let title = '';
    let message = '';

    if (resultType === 'walkover') {
      title = 'Confirm Walkover';
      message = `Are you sure you want to declare a walkover to ${teamName}? They will be awarded 2 points.`;
    } else if (resultType === 'tie') {
      title = 'Confirm Match Drawn';
      message = 'Are you sure you want to declare this match as drawn? Both teams will receive 1 point.';
    } else if (resultType === 'abandoned') {
      title = 'Confirm Abandon Match';
      message = 'Are you sure you want to abandon this match? Both teams will receive 1 point.';
    }

    setDeclareConfirmation({ visible: true, title, message, resultType, teamId });
  };

  const executeDeclareResult = () => {
    if (declareConfirmation) {
      handleDeclareResult(declareConfirmation.resultType, declareConfirmation.teamId);
      setDeclareConfirmation(null);
    }
  };

  const handleDeclareResult = async (resultType, winnerTeamId = null) => {
    try {
      setDeclareResultModalVisible(false);
      const res = await api.put(`/matches/${matchId}/declare-result`, { resultType, winnerTeamId });
      if (res.data.success) {
        showCustomAlert('Success', 'Match result has been declared.');
        dispatch(fetchLiveState(matchId));
      }
    } catch (e) {
      console.log('Error declaring result', e);
      showCustomAlert('Error', e.response?.data?.message || 'Failed to declare result');
    }
  };

  const handleContinue = async () => {
    if (match.status === 'scheduled') {
      navigation.navigate('My Cricket', { screen: 'MatchSetup', params: { matchId: match._id, matchData: match, tournamentDetails: match.tournament } });
    } else if (match.status === 'toss_done') {
      try {
        await api.post(`/matches/${match._id}/start-innings`, { inningsNumber: 1 });
      } catch (e) { } // ignore if already started
      navigation.navigate('My Cricket', { screen: 'LiveScorer', params: { matchId: match._id } });
    } else {
      navigation.navigate('My Cricket', { screen: 'LiveScorer', params: { matchId: match._id } });
    }
  };

  const renderTabHeader = () => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsRow}>
      {['Info', 'Summary', 'Scorecard', 'Comms', 'Squads', 'Analysis', 'Partnerships', 'Leaderboard'].map(tab => (
        <TouchableOpacity key={tab} onPress={() => setActiveTab(tab)} style={styles.tabItem}>
          {activeTab === tab && <View style={styles.tabActivePill} />}
          <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const renderMatchDetails = () => (
    <ScrollView contentContainerStyle={styles.content} refreshControl={getRefreshControl()}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Info</Text>
        <View style={styles.infoRow}><Text style={styles.infoLabel}>Match</Text><Text style={styles.infoValue}>{teamA} vs {teamB}</Text></View>
        {match.tournament && match.tournament.name && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Tournament</Text>
            <TouchableOpacity onPress={() => navigation.navigate('TournamentDetail', { tournamentId: match.tournament._id })}>
              <Text style={[styles.infoValue, { color: Colors.primary }]}>
                {match.tournament.name}
              </Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={styles.infoRow}><Text style={styles.infoLabel}>Date</Text><Text style={styles.infoValue}>{dateStr}</Text></View>
        <View style={styles.infoRow}><Text style={styles.infoLabel}>Toss</Text><Text style={styles.infoValue}>{match.toss?.winner ? `${getTossWinnerName()} opt to ${match.toss.choice}` : 'Not done yet'}</Text></View>
        <View style={styles.infoRow}><Text style={styles.infoLabel}>Format</Text><Text style={styles.infoValue}>{formatStr}</Text></View>
        <View style={styles.infoRow}><Text style={styles.infoLabel}>Ball Type</Text><Text style={styles.infoValue}>{match.ballType}</Text></View>
        <View style={styles.infoRow}><Text style={styles.infoLabel}>Pitch Type</Text><Text style={styles.infoValue}>{match.pitchType}</Text></View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Venue</Text>
        <View style={styles.infoRow}><Text style={styles.infoLabel}>Ground</Text><Text style={styles.infoValue}>{match.venue?.name || match.ground || 'N/A'}</Text></View>
        <View style={styles.infoRow}><Text style={styles.infoLabel}>City</Text><Text style={styles.infoValue}>{match.venue?.city || match.city || 'N/A'}</Text></View>
      </View>
    </ScrollView>
  );

  const renderSummary = () => {
    if (match.status === 'abandoned') {
      return (
        <ScrollView contentContainerStyle={styles.content} refreshControl={getRefreshControl()}>
          <View style={[styles.section, { alignItems: 'center', paddingVertical: 48 }]}>
            <Icon name="alert-circle" size={56} color={Colors.error || '#D32F2F'} style={{ marginBottom: 16 }} />
            <Text style={{ color: Colors.error || '#D32F2F', fontFamily: Typography.fontFamily.bold, fontSize: 20, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 1 }}>
              Match Abandoned
            </Text>
            <Text style={{ color: Colors.textPrimary, fontFamily: Typography.fontFamily.semiBold, fontSize: 16, textAlign: 'center', marginTop: 12 }}>
              {teamA} vs {teamB}
            </Text>
          </View>
        </ScrollView>
      );
    }

    const getPlayerPhotoUrl = (p) => {
      if (!p) return null;
      const photo = p.photo || p.user?.photo || p.userId?.photo || p.avatar || p.profileImage || p.image || p.user?.avatar;
      return photo ? getImageUrl(photo) : null;
    };

    const isTeamABatting = match.battingTeam?.toString() === match.teamA?._id?.toString() || liveState?.battingTeam?.toString() === match.teamA?._id?.toString();
    const currentBattingName = isTeamABatting ? teamA : teamB;

    // Calculate best performers
    let bestBatter = null;
    let bestBowler = null;
    let mvp = null;
    let topBatters = [];
    let topBowlers = [];
    let fighterOfTheMatch = null;
    let fighterStats = null;

    if (match.status === 'completed' && scorecards?.length > 0) {
      const allBatters = scorecards.flatMap(sc => {
        const tName = sc.battingTeam?.name || (sc.battingTeam === match.teamA?._id ? match.teamA?.name : match.teamB?.name);
        return sc.batting.map(b => ({ ...b, teamName: tName }));
      }).filter(b => b.player);

      if (allBatters.length > 0) {
        topBatters = [...allBatters].sort((a, b) => b.runs - a.runs).slice(0, 2);
        bestBatter = topBatters[0];
      }

      const allBowlers = scorecards.flatMap(sc => {
        const tName = sc.bowlingTeam?.name || (sc.bowlingTeam === match.teamA?._id ? match.teamA?.name : match.teamB?.name);
        return sc.bowling.map(b => ({ ...b, teamName: tName }));
      }).filter(b => b.player);

      if (allBowlers.length > 0) {
        topBowlers = [...allBowlers].sort((a, b) => {
          if (b.wickets !== a.wickets) return b.wickets - a.wickets;
          return a.economy - b.economy;
        }).slice(0, 2);
        bestBowler = topBowlers[0];
      }

      if (match.result?.winner) {
        const losingTeamId = match.result.winner === match.teamA?._id ? match.teamB?._id : match.teamA?._id;
        const losingTeamName = match.result.winner === match.teamA?._id ? match.teamB?.name : match.teamA?.name;

        const losingBatters = scorecards.find(sc => sc.battingTeam?._id === losingTeamId || sc.battingTeam === losingTeamId)?.batting?.filter(b => b.player) || [];
        const losingBowlers = scorecards.find(sc => sc.bowlingTeam?._id === losingTeamId || sc.bowlingTeam === losingTeamId)?.bowling?.filter(b => b.player) || [];

        const bestLosingBatter = losingBatters.length > 0 ? [...losingBatters].sort((a, b) => b.runs - a.runs)[0] : null;
        const bestLosingBowler = losingBowlers.length > 0 ? [...losingBowlers].sort((a, b) => {
          if (b.wickets !== a.wickets) return b.wickets - a.wickets;
          return a.economy - b.economy;
        })[0] : null;

        if (bestLosingBatter && bestLosingBowler) {
          if (bestLosingBowler.wickets >= 3) {
            fighterOfTheMatch = bestLosingBowler.player;
            fighterStats = { type: 'bowler', data: bestLosingBowler, teamName: losingTeamName };
          } else {
            fighterOfTheMatch = bestLosingBatter.player;
            fighterStats = { type: 'batter', data: bestLosingBatter, teamName: losingTeamName };
          }
        } else if (bestLosingBatter) {
          fighterOfTheMatch = bestLosingBatter.player;
          fighterStats = { type: 'batter', data: bestLosingBatter, teamName: losingTeamName };
        } else if (bestLosingBowler) {
          fighterOfTheMatch = bestLosingBowler.player;
          fighterStats = { type: 'bowler', data: bestLosingBowler, teamName: losingTeamName };
        }
      }

      if (match.playerOfMatch) {
        if (typeof match.playerOfMatch === 'object' && match.playerOfMatch.name) {
          mvp = match.playerOfMatch;
        } else {
          const mvpId = String(typeof match.playerOfMatch === 'object' ? match.playerOfMatch._id : match.playerOfMatch);
          const allXI = [...(match.playingXI?.teamA || []), ...(match.playingXI?.teamB || [])];
          mvp = allXI.find(p => String(p._id || p) === mvpId);

          if (!mvp) {
            const scorecardPlayers = scorecards.flatMap(sc => [
              ...(sc.batting || []).map(b => b.player),
              ...(sc.bowling || []).map(b => b.player)
            ]).filter(Boolean);
            mvp = scorecardPlayers.find(p => String(p._id || p) === mvpId);
          }
        }
      }

      if (!mvp) {
        // Fallback: Pick highest performer from winning team
        if (match.result?.winner) {
          const winningTeamId = String(match.result.winner._id || match.result.winner);
          const winningBatters = scorecards.find(sc => String(sc.battingTeam?._id || sc.battingTeam) === winningTeamId)?.batting?.filter(b => b.player) || [];
          const winningBowlers = scorecards.find(sc => String(sc.bowlingTeam?._id || sc.bowlingTeam) === winningTeamId)?.bowling?.filter(b => b.player) || [];

          const topWinningBatter = winningBatters.length > 0 ? [...winningBatters].sort((a, b) => b.runs - a.runs)[0] : null;
          const topWinningBowler = winningBowlers.length > 0 ? [...winningBowlers].sort((a, b) => b.wickets - a.wickets)[0] : null;

          if (topWinningBowler && topWinningBowler.wickets >= 2) {
            mvp = topWinningBowler.player;
          } else if (topWinningBatter) {
            mvp = topWinningBatter.player;
          }
        }
        if (!mvp) {
          mvp = bestBatter?.player || bestBowler?.player;
        }
      }
    }

    // ─── Premium performer card (2-col grid) ────────────────────────────────
    const renderPerformerCard = (title, titleIcon, accentColor, player, statsText, subText, isNotOut = false) => {
      return (
        <TouchableOpacity
          activeOpacity={0.82}
          onPress={() => setSelectedPlayerPreview(player)}
          style={{
            width: '48.5%',
            marginBottom: 10,
            borderRadius: 16,
            overflow: 'hidden',
            backgroundColor: Colors.backgroundCard,
            borderWidth: 1,
            borderColor: `${accentColor}28`,
            elevation: 6,
            shadowColor: accentColor,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.2,
            shadowRadius: 8,
          }}
        >
          <View style={{ height: 120, backgroundColor: Colors.backgroundElevated }}>
            {getPlayerPhotoUrl(player) ? (
              <Image source={{ uri: getPlayerPhotoUrl(player) }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
            ) : (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.surfaceVariant }}>
                <Icon name="account" size={48} color={accentColor} />
              </View>
            )}
            <LinearGradient colors={['transparent', Colors.backgroundCard]} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 55 }} />
          </View>
          <View style={{ padding: 10, paddingTop: 7 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 }}>
              <Icon name={titleIcon} size={10} color={accentColor} />
              <Text style={{ color: accentColor, fontFamily: Typography.fontFamily.bold, fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.8 }}>{title}</Text>
            </View>
            <Text style={{ color: '#FFF', fontFamily: Typography.fontFamily.bold, fontSize: 13 }} numberOfLines={1}>
              {player?.name}{isNotOut ? ' *' : ''}
            </Text>
            <Text style={{ color: Colors.textSecondary, fontSize: 10, marginTop: 1 }} numberOfLines={1}>{subText}</Text>
            <View style={{ height: 1, backgroundColor: `${accentColor}28`, marginVertical: 6 }} />
            <Text style={{ color: accentColor, fontFamily: Typography.fontFamily.bold, fontSize: 14 }}>{statsText}</Text>
          </View>
        </TouchableOpacity>
      );
    };

    return (
      <ScrollView contentContainerStyle={styles.content} refreshControl={getRefreshControl()}>
        {match.status === 'completed' ? (
          <View>
            {/* Header Section (Scores & Result) */}
            <View style={[styles.section, { paddingBottom: 16, paddingTop: 16 }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  {scorecards?.map((sc, idx) => {
                    const teamName = sc.battingTeam?.name || (sc.battingTeam === match.teamA?._id ? match.teamA?.name : match.teamB?.name);
                    return (
                      <View key={idx} style={{ marginBottom: 12 }}>
                        <Text style={{ color: Colors.textSecondary, fontFamily: Typography.fontFamily.semiBold, fontSize: 14, marginBottom: 4 }}>
                          {teamName}
                        </Text>
                        <Text style={{ color: Colors.textPrimary, fontFamily: Typography.fontFamily.bold, fontSize: 22 }}>
                          {sc.total?.runs || 0}/{sc.total?.wickets || 0} <Text style={{ color: Colors.textSecondary, fontSize: 14, fontWeight: 'normal' }}>({sc.total?.overs || '0.0'} Ov)</Text>
                        </Text>
                      </View>
                    );
                  })}
                </View>

                <View style={{ alignItems: 'flex-end', marginLeft: 16 }}>
                  <View style={{ backgroundColor: Colors.surfaceDark, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 16 }}>
                    <Text style={{ color: '#FFF', fontSize: 12, fontWeight: 'bold' }}>Result</Text>
                  </View>
                </View>
              </View>

              {match.result?.summary && (
                <Text style={{ color: Colors.primary, fontFamily: Typography.fontFamily.bold, fontSize: 14, marginTop: 8 }}>
                  {match.result.summary}
                </Text>
              )}

              {/* Views & Live Viewers Row */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, borderTopWidth: 0.5, borderTopColor: Colors.border, paddingTop: 8, gap: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Icon name="eye-outline" size={14} color={Colors.textTertiary} />
                  <Text style={{ color: Colors.textSecondary, fontSize: 11 }}>{liveState?.views || match?.views || 0} Views</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#ff4d4d' }} />
                  <Text style={{ color: '#ff4d4d', fontSize: 11, fontWeight: 'bold' }}>{liveState?.liveViewers || 0} Live Viewers</Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', marginTop: 16 }}>
                <TouchableOpacity
                  style={{ flex: 1, backgroundColor: Colors.primaryAlpha20, paddingVertical: 12, borderRadius: 8, alignItems: 'center' }}
                  onPress={() => setActiveTab('Leaderboard')}
                >
                  <Text style={{ color: Colors.primary, fontFamily: Typography.fontFamily.semiBold, fontSize: 14 }}>Leaderboard</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* ══════════ HEROES OF THE MATCH ══════════ */}
            {(bestBatter || bestBowler || mvp) && (
              <View style={{ marginBottom: 8 }}>
                {/* Section header */}
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, marginBottom: 14, gap: 8 }}>
                  <LinearGradient colors={[Colors.warning, '#FF5722']} style={{ width: 3, height: 18, borderRadius: 2 }} />
                  <Text style={{ color: '#FFF', fontFamily: Typography.fontFamily.bold, fontSize: 15, letterSpacing: 0.2 }}>Heroes of the Match</Text>
                  <Icon name="trophy" size={15} color={Colors.warning} style={{ marginLeft: 2 }} />
                </View>

                {/* ── PLAYER OF THE MATCH ── Cinematic big card */}
                {mvp && (() => {
                  let mvpBattingStats = null;
                  let mvpBowlingStats = null;
                  if (scorecards?.length > 0) {
                    const mvpIdStr = String(mvp._id || mvp.id || mvp);
                    const allBatting = scorecards.flatMap(sc => sc.batting || []);
                    const allBowling = scorecards.flatMap(sc => sc.bowling || []);
                    mvpBattingStats = allBatting.find(b => String(b.player?._id || b.player?.id || b.player) === mvpIdStr);
                    mvpBowlingStats = allBowling.find(b => String(b.player?._id || b.player?.id || b.player) === mvpIdStr);
                  }
                  if (!mvpBattingStats && bestBatter && String(bestBatter.player?._id || bestBatter.player) === String(mvp._id || mvp)) {
                    mvpBattingStats = bestBatter;
                  }
                  if (!mvpBowlingStats && bestBowler && String(bestBowler.player?._id || bestBowler.player) === String(mvp._id || mvp)) {
                    mvpBowlingStats = bestBowler;
                  }

                  const mvpPhoto = getPlayerPhotoUrl(mvp);
                  return (
                    <TouchableOpacity
                      onPress={() => setSelectedPlayerPreview(mvp)}
                      activeOpacity={0.92}
                      style={{
                        marginHorizontal: Spacing.md,
                        marginBottom: 12,
                        borderRadius: 22,
                        overflow: 'hidden',
                        elevation: 10,
                        shadowColor: Colors.warning,
                        shadowOffset: { width: 0, height: 6 },
                        shadowOpacity: 0.35,
                        shadowRadius: 14,
                      }}
                    >
                      <View style={{ height: 310, backgroundColor: Colors.backgroundElevated }}>
                        {mvpPhoto ? (
                          <Image source={{ uri: mvpPhoto }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                        ) : (
                          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.surfaceVariant }}>
                            <Icon name="account" size={90} color={Colors.warning} />
                          </View>
                        )}
                        {/* Gold badge strip at top */}
                        <LinearGradient colors={['rgba(0,0,0,0.75)', 'transparent']} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 58, justifyContent: 'center', paddingHorizontal: 16 }}>
                          <LinearGradient colors={[Colors.warning, '#FF9800']} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, paddingVertical: 5, borderRadius: 20, alignSelf: 'flex-start' }}>
                            <Icon name="star" size={11} color="#000" />
                            <Text style={{ color: '#000', fontFamily: Typography.fontFamily.bold, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 }}>Player of the Match</Text>
                          </LinearGradient>
                        </LinearGradient>

                        {/* Bottom info overlay */}
                        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.75)', 'rgba(0,0,0,1)']} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 220, justifyContent: 'flex-end', padding: 18 }}>
                          <Text style={{ color: '#FFF', fontFamily: Typography.fontFamily.bold, fontSize: 28, lineHeight: 32, letterSpacing: -0.3, textShadowColor: 'rgba(0, 0, 0, 1)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6 }}>{mvp.name}</Text>
                          <Text style={{ color: 'rgba(255,255,255,0.75)', fontFamily: Typography.fontFamily.medium, fontSize: 12, marginTop: 2, marginBottom: 14, textShadowColor: 'rgba(0, 0, 0, 1)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 }}>
                            {mvp.team?.name || (mvp._id && match.playingXI?.teamA?.some(p => p._id === mvp._id) ? match.teamA?.name : match.teamB?.name) || ''}
                          </Text>
                          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                            {mvpBattingStats && (mvpBattingStats.runs > 0 || mvpBattingStats.balls > 0) && (
                              <View style={{ backgroundColor: 'rgba(0,0,0,0.85)', borderWidth: 1, borderColor: `${Colors.primary}88`, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8 }}>
                                <Text style={{ color: Colors.primary, fontFamily: Typography.fontFamily.bold, fontSize: 16 }}>
                                  {mvpBattingStats.runs}<Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>({mvpBattingStats.balls})</Text>
                                </Text>
                                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10, marginTop: 1 }}>
                                  {mvpBattingStats.fours || 0}×4s · {mvpBattingStats.sixes || 0}×6s
                                </Text>
                              </View>
                            )}
                            {mvpBowlingStats && (mvpBowlingStats.overs > 0 || mvpBowlingStats.wickets > 0) && (
                              <View style={{ backgroundColor: 'rgba(0,0,0,0.85)', borderWidth: 1, borderColor: `${Colors.info}88`, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8 }}>
                                <Text style={{ color: Colors.info, fontFamily: Typography.fontFamily.bold, fontSize: 16 }}>
                                  {mvpBowlingStats.wickets}<Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>/{mvpBowlingStats.runs}</Text>
                                </Text>
                                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10, marginTop: 1 }}>
                                  {mvpBowlingStats.overs} ov
                                </Text>
                              </View>
                            )}
                          </View>
                        </LinearGradient>
                      </View>
                    </TouchableOpacity>
                  );
                })()}

                {/* ── FIGHTER OF THE MATCH ── Landscape banner */}
                {fighterOfTheMatch && fighterOfTheMatch._id !== mvp?._id && (
                  <TouchableOpacity
                    onPress={() => setSelectedPlayerPreview(fighterOfTheMatch)}
                    activeOpacity={0.85}
                    style={{
                      marginHorizontal: Spacing.md,
                      marginBottom: 12,
                      borderRadius: 18,
                      overflow: 'hidden',
                      elevation: 6,
                      shadowColor: '#FF4081',
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.25,
                      shadowRadius: 10,
                      flexDirection: 'row',
                      backgroundColor: Colors.backgroundCard,
                      borderWidth: 1,
                      borderColor: 'rgba(255,64,129,0.20)',
                      height: 120,
                    }}
                  >
                    <View style={{ width: 120, height: '100%', backgroundColor: Colors.backgroundElevated }}>
                      {getPlayerPhotoUrl(fighterOfTheMatch) ? (
                        <Image source={{ uri: getPlayerPhotoUrl(fighterOfTheMatch) }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                      ) : (
                        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.surfaceVariant }}>
                          <Icon name="account" size={54} color="#FF4081" />
                        </View>
                      )}
                      <LinearGradient colors={['transparent', Colors.backgroundCard]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 44 }} />
                    </View>
                    <View style={{ flex: 1, paddingHorizontal: 14, paddingVertical: 12, justifyContent: 'space-between' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                        <Icon name="lightning-bolt" size={12} color="#FF4081" />
                        <Text style={{ color: '#FF4081', fontFamily: Typography.fontFamily.bold, fontSize: 9, textTransform: 'uppercase', letterSpacing: 1.2 }}>Fighter of the Match</Text>
                      </View>
                      <View>
                        <Text style={{ color: '#FFF', fontFamily: Typography.fontFamily.bold, fontSize: 18, letterSpacing: -0.2 }} numberOfLines={1}>{fighterOfTheMatch?.name}</Text>
                        <Text style={{ color: Colors.textSecondary, fontSize: 11, marginTop: 1 }} numberOfLines={1}>{fighterStats?.teamName}</Text>
                      </View>
                      <View style={{ alignSelf: 'flex-start', backgroundColor: 'rgba(255,64,129,0.10)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(255,64,129,0.28)' }}>
                        <Text style={{ color: '#FF4081', fontFamily: Typography.fontFamily.bold, fontSize: 13 }}>
                          {fighterStats?.type === 'batter' ? `${fighterStats.data.runs}(${fighterStats.data.balls})` : `${fighterStats?.data.wickets}/${fighterStats?.data.runs}`}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                )}

                {/* ── TOP PERFORMERS ── 2-col grid */}
                {(topBatters.length > 0 || topBowlers.length > 0) && (
                  <View style={{ paddingHorizontal: Spacing.md }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10, marginTop: 4 }}>
                      <Icon name="chart-bar" size={12} color={Colors.textSecondary} />
                      <Text style={{ color: Colors.textSecondary, fontFamily: Typography.fontFamily.semiBold, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 }}>Top Performers</Text>
                    </View>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                      {topBatters.map((batter, index) => (
                        <React.Fragment key={`batter-${index}`}>
                          {renderPerformerCard('Top Batter', 'cricket', Colors.primary, batter.player, `${batter.runs}(${batter.balls})`, batter.teamName, batter.isNotOut)}
                        </React.Fragment>
                      ))}
                      {topBowlers.map((bowler, index) => (
                        <React.Fragment key={`bowler-${index}`}>
                          {renderPerformerCard('Top Bowler', 'bowling', Colors.info, bowler.player, `${bowler.wickets}/${bowler.runs}`, bowler.teamName)}
                        </React.Fragment>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            )}
          </View>
        ) : (
          <>
            {/* Score Card */}
            <View style={styles.section}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                <Text style={{ fontSize: 16, fontFamily: Typography.fontFamily.semiBold }}>
                  <Text style={{ color: isTeamABatting ? '#FFF' : Colors.textSecondary }}>{match?.teamA?.name}</Text>
                  <Text style={{ color: Colors.textSecondary }}> vs </Text>
                  <Text style={{ color: !isTeamABatting ? '#FFF' : Colors.textSecondary }}>{match?.teamB?.name}</Text>
                </Text>
                {(match?.isSuperOver || match?.status === 'super_over' || liveState?.isSuperOver) && (
                  <View style={{ marginLeft: 8, backgroundColor: Colors.error, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                    <Text style={{ color: '#FFF', fontSize: 10, fontWeight: 'bold' }}>SUPER OVER</Text>
                  </View>
                )}
              </View>
              {match.status !== 'scheduled' && match.status !== 'toss_done' && (
                <>
                  <View style={styles.mainScoreRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                      <Text style={styles.scoreNumber}>{runs}/{wickets}</Text>
                      <Text style={styles.oversNumber}>({overs} Ov)</Text>
                    </View>
                    <View style={{ flex: 1 }} />
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.crrText}>CRR: {score?.runRate || '0.00'}</Text>
                      {liveState?.requiredRunRate && (
                        <Text style={[styles.crrText, { marginTop: 2 }]}>RRR: {liveState.requiredRunRate}</Text>
                      )}
                    </View>
                  </View>
                </>
              )}

              {(liveState?.inningsNumber === 2 || liveState?.inningsNumber === 4) && liveState?.target && (
                <View style={{ marginTop: 8, padding: 8, backgroundColor: Colors.primaryAlpha20, borderRadius: 6 }}>
                  <Text style={{ color: Colors.primary, fontWeight: 'bold' }}>
                    Target: {liveState.target}
                  </Text>
                  <Text style={{ color: Colors.textSecondary, fontSize: 12, marginTop: 2 }}>
                    {liveState.toWin <= 0 ? 'Target Reached' : `${currentBattingName} needs ${liveState.toWin} runs in ${liveState.ballsRemaining} balls`}
                  </Text>
                  {liveState.dlsParScore !== undefined && liveState.dlsParScore !== null && liveState.dlsParScore > 0 && (() => {
                    const isAhead = runs > liveState.dlsParScore;
                    const isBehind = runs < liveState.dlsParScore;
                    const bowlingTeamName = isTeamABatting ? match?.teamB?.name : match?.teamA?.name;
                    const safeTeam = isAhead ? currentBattingName : (isBehind ? bowlingTeamName : 'None');

                    return (
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, backgroundColor: isAhead ? 'rgba(34,197,94,0.12)' : isBehind ? 'rgba(239,68,68,0.12)' : 'rgba(148,163,184,0.12)', paddingHorizontal: 8, paddingVertical: 6, borderRadius: 4, alignSelf: 'flex-start' }}>
                        <Text style={{ color: Colors.textTertiary, fontSize: 11, fontFamily: Typography.fontFamily.medium }}>DLS Par: </Text>
                        <Text style={{ color: Colors.textPrimary, fontSize: 12, fontFamily: Typography.fontFamily.bold }}>{liveState.dlsParScore}</Text>
                        <Text style={{ fontSize: 11, fontFamily: Typography.fontFamily.semiBold, color: isAhead ? '#22c55e' : isBehind ? '#ef4444' : Colors.textSecondary }}>
                          {isAhead ? `  ✓ Ahead (${safeTeam} is safe)` : isBehind ? `  ✗ Behind (${safeTeam} is safe)` : '  = On Par'}
                        </Text>
                      </View>
                    );
                  })()}
                </View>
              )}

              {/* Views & Live Viewers Row */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, borderTopWidth: 0.5, borderTopColor: Colors.border, paddingTop: 8, gap: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Icon name="eye-outline" size={14} color={Colors.textTertiary} />
                  <Text style={{ color: Colors.textSecondary, fontSize: 11 }}>{liveState?.views || match?.views || 0} Views</Text>
                </View>
                {match?.status === 'in_progress' && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#ff4d4d' }} />
                    <Text style={{ color: '#ff4d4d', fontSize: 11, fontWeight: 'bold' }}>{liveState?.liveViewers || 0} Live Viewers</Text>
                  </View>
                )}
              </View>

              {match.toss?.winner && (
                <Text style={[styles.tossTextPrimary, { marginTop: 12 }]}>Toss: {getTossWinnerName()} opt to {match.toss.choice}</Text>
              )}
              {match.status === 'scheduled' && (
                <Text style={styles.yetToStartText}>Match Yet To Start</Text>
              )}
            </View>

            {/* Conditional Rendering of Batters/Bowlers or Break Info */}
            {(match.status === 'scheduled' || match.status === 'toss_done') ? (
              <View style={[styles.section, { alignItems: 'center', paddingVertical: 40 }]}>
                <Icon name="cricket" size={48} color={Colors.primary} style={{ marginBottom: 16 }} />
                <Text style={{ color: Colors.textPrimary, fontFamily: Typography.fontFamily.bold, fontSize: 18, textAlign: 'center' }}>
                  Welcome to an exciting contest!
                </Text>
                <Text style={{ color: Colors.textSecondary, fontFamily: Typography.fontFamily.medium, fontSize: 14, textAlign: 'center', marginTop: 8 }}>
                  The pitch looks great for a game of cricket. Stay tuned as the action unfolds!
                </Text>
              </View>
            ) : match.status === 'innings_break' ? (
              <View style={styles.inningsBreakCard}>
                <LinearGradient
                  colors={['rgba(255,143,0,0.18)', 'rgba(255,143,0,0.06)']}
                  style={styles.inningsBreakGradient}
                >
                  <View style={styles.inningsBreakIconRow}>
                    <View style={styles.inningsBreakIconWrap}>
                      <Icon name="timer-sand" size={28} color={Colors.warning} />
                    </View>
                    <View style={styles.inningsBreakBadge}>
                      <Text style={styles.inningsBreakBadgeText}>INNINGS BREAK</Text>
                    </View>
                  </View>
                  <Text style={styles.inningsBreakTitle}>1st Innings Complete</Text>
                  {liveState?.target && currentBattingName ? (
                    <View style={styles.targetChaseRow}>
                      <View style={styles.targetBox}>
                        <Text style={styles.targetBoxLabel}>TARGET</Text>
                        <Text style={styles.targetBoxValue}>{liveState.target}</Text>
                      </View>
                      <View style={styles.targetChaseInfo}>
                        <Text style={styles.targetChaseTeam}>{currentBattingName}</Text>
                        <Text style={styles.targetChaseDesc}>{liveState.toWin <= 0 ? 'Target Reached' : `needs ${liveState.toWin} runs in ${liveState.ballsRemaining} balls`}</Text>
                        <Text style={styles.targetChaseRRR}>
                          Required RR: <Text style={{ color: Colors.warning, fontFamily: Typography.fontFamily.bold }}>{liveState.toWin <= 0 ? '--' : (liveState.requiredRunRate || '--')}</Text>
                        </Text>
                      </View>
                    </View>
                  ) : (
                    <Text style={styles.inningsBreakSub}>2nd innings about to begin</Text>
                  )}
                </LinearGradient>
              </View>
            ) : (
              <>
                {/* Batters Table */}
                <View style={styles.section}>
                  <View style={styles.tableHeaderRow}>
                    <Text style={[styles.tableHeaderText, { flex: 3 }]}>Batters</Text>
                    <Text style={styles.tableHeaderText}>R</Text>
                    <Text style={styles.tableHeaderText}>B</Text>
                    <Text style={styles.tableHeaderText}>4s</Text>
                    <Text style={styles.tableHeaderText}>6s</Text>
                    <Text style={[styles.tableHeaderText, { flex: 1.5, textAlign: 'right' }]}>SR</Text>
                  </View>

                  <TouchableOpacity style={styles.tableRow} onPress={() => striker && setSelectedPlayerPreview(striker)}>
                    <View style={{ flex: 3, flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={styles.playerNameActive}>{striker?.name || 'Striker'} {striker ? '*' : ''}</Text>
                    </View>
                    <Text style={styles.tableRowText}>{strikerStats?.runs || 0}</Text>
                    <Text style={styles.tableRowText}>{strikerStats?.balls || 0}</Text>
                    <Text style={styles.tableRowText}>{strikerStats?.fours || 0}</Text>
                    <Text style={styles.tableRowText}>{strikerStats?.sixes || 0}</Text>
                    <Text style={[styles.tableRowText, { flex: 1.5, textAlign: 'right' }]}>{strikerStats?.strikeRate || '0.00'}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.tableRow} onPress={() => nonStriker && setSelectedPlayerPreview(nonStriker)}>
                    <View style={{ flex: 3 }}>
                      <Text style={styles.playerNameNormal}>{nonStriker?.name || 'Non-Striker'}</Text>
                    </View>
                    <Text style={styles.tableRowText}>{nonStrikerStats?.runs || 0}</Text>
                    <Text style={styles.tableRowText}>{nonStrikerStats?.balls || 0}</Text>
                    <Text style={styles.tableRowText}>{nonStrikerStats?.fours || 0}</Text>
                    <Text style={styles.tableRowText}>{nonStrikerStats?.sixes || 0}</Text>
                    <Text style={[styles.tableRowText, { flex: 1.5, textAlign: 'right' }]}>{nonStrikerStats?.strikeRate || '0.00'}</Text>
                  </TouchableOpacity>

                  <View style={styles.partnershipRow}>
                    <Text style={styles.partnershipText}>Partnership: {strikerStats?.runs + nonStrikerStats?.runs || 0}({strikerStats?.balls + nonStrikerStats?.balls || 0})</Text>
                  </View>
                </View>

                {/* Bowlers Table */}
                <View style={styles.section}>
                  <View style={styles.tableHeaderRow}>
                    <Text style={[styles.tableHeaderText, { flex: 3 }]}>Bowlers</Text>
                    <Text style={styles.tableHeaderText}>O</Text>
                    <Text style={styles.tableHeaderText}>M</Text>
                    <Text style={styles.tableHeaderText}>R</Text>
                    <Text style={styles.tableHeaderText}>W</Text>
                    <Text style={[styles.tableHeaderText, { flex: 1.5, textAlign: 'right' }]}>ER</Text>
                  </View>

                  <TouchableOpacity style={styles.tableRow} onPress={() => (bowler || previousBowler) && setSelectedPlayerPreview(bowler || previousBowler)}>
                    <View style={{ flex: 3, flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={styles.playerNameActive}>{(bowler || previousBowler)?.name || 'Bowler'}</Text>
                    </View>
                    <Text style={styles.tableRowText}>{bowlerStats ? `${bowlerStats.overs}.${bowlerStats.balls || 0}` : '0.0'}</Text>
                    <Text style={styles.tableRowText}>{bowlerStats?.maidens || 0}</Text>
                    <Text style={styles.tableRowText}>{bowlerStats?.runs || 0}</Text>
                    <Text style={styles.tableRowText}>{bowlerStats?.wickets || 0}</Text>
                    <Text style={[styles.tableRowText, { flex: 1.5, textAlign: 'right' }]}>{bowlerStats?.economy || '0.00'}</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* Recent Commentary section at the bottom of the summary */}
            {liveState?.recentCommentary?.length > 0 && (
              <View style={[styles.section, { paddingBottom: 16, marginTop: 12 }]}>
                <Text style={[styles.sectionTitle, { marginBottom: 12 }]}>Recent Deliveries</Text>
                {liveState.recentCommentary.map((ball) => {
                  let display = `${ball.batsmanRuns}`;
                  let bgColor = Colors.borderLight;
                  let textColor = Colors.textPrimary;

                  if (ball.isWicket) {
                    display = 'W';
                    bgColor = Colors.error;
                    textColor = '#FFF';
                  } else if (ball.isWide) display = `${ball.totalRuns}Wd`;
                  else if (ball.isNoBall) display = `${ball.totalRuns}Nb`;
                  else if (ball.isLegBye) display = `${ball.totalRuns}Lb`;
                  else if (ball.isBye) display = `${ball.totalRuns}B`;
                  else if (ball.batsmanRuns === 4) {
                    bgColor = '#4CAF50';
                    textColor = '#FFF';
                  } else if (ball.batsmanRuns === 6) {
                    bgColor = '#1976D2';
                    textColor = '#FFF';
                  }

                  let text = `${ball.batsmanRuns} run(s)`;
                  if (ball.isWicket) text = ball.wicket?.type ? ball.wicket.type.replace('_', ' ') : 'Wicket!';
                  else if (ball.isWide) text = `${ball.totalRuns} Wide(s)`;
                  else if (ball.isNoBall) text = `${ball.totalRuns} No Ball(s)`;
                  else if (ball.batsmanRuns === 4) text = 'Four runs!';
                  else if (ball.batsmanRuns === 6) text = 'Six runs!';
                  else if (ball.batsmanRuns === 0) text = 'Dot ball';

                  const bowlerName = ball.bowler?.name || 'Bowler';
                  const batsmanName = ball.batsman?.name || 'Batsman';

                  return (
                    <View key={ball._id} style={{ flexDirection: 'row', marginBottom: 12, alignItems: 'flex-start' }}>
                      <View style={{ width: 40 }}>
                        <Text style={{ fontFamily: Typography.fontFamily.semiBold, color: Colors.textSecondary, fontSize: 13, marginTop: 6 }}>{ball.overNumber - 1}.{ball.ballNumber}</Text>
                      </View>
                      <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: bgColor, justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                        <Text style={{ fontFamily: Typography.fontFamily.bold, color: textColor, fontSize: 12 }}>{display}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontFamily: Typography.fontFamily.semiBold, color: Colors.textPrimary, fontSize: 14 }}>
                          {bowlerName} to {batsmanName}
                        </Text>
                        <Text style={{ fontFamily: Typography.fontFamily.regular, color: Colors.textSecondary, fontSize: 13, marginTop: 2 }}>{text}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

          </>
        )}
      </ScrollView>
    );
  };

  const renderPlayerStats = (player, role) => {
    if (!player) return null;
    const bType = match.ballType || 'Tennis';

    let baseStats = player;
    const pidStr = player._id?.toString() || player.toString();
    if (match.status === 'completed' && match.playerStatsSnapshot?.[pidStr]) {
      baseStats = match.playerStatsSnapshot[pidStr];
    }

    let statsObj = baseStats.statsByBallType?.[bType] || baseStats;

    if (role === 'Bat') {
      const batStats = statsObj.batting || {};
      const avg = (batStats.runs || 0) / Math.max(1, ((batStats.innings || 0) - (batStats.notOuts || 0)));
      const sr = batStats.balls ? (((batStats.runs || 0) / batStats.balls) * 100) : 0;
      return (
        <View style={{ flexDirection: 'row', backgroundColor: Colors.surface, padding: 8, marginVertical: 6, marginHorizontal: 16, borderRadius: 8, borderWidth: 1, borderColor: Colors.borderLight }}>
          <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.primaryAlpha20, justifyContent: 'center', alignItems: 'center', marginRight: 12, overflow: 'hidden' }}>
            {(player.photo || player.userId?.photo) ? (
              <Image source={{ uri: getImageUrl(player.photo || player.userId?.photo) }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
            ) : (
              <Text style={{ color: Colors.primary, fontWeight: 'bold' }}>{player.name?.charAt(0).toUpperCase()}</Text>
            )}
          </View>
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <Text style={{ fontSize: 12, fontWeight: 'bold', color: Colors.textPrimary }}>{player.name}</Text>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
              <Text style={{ fontSize: 10, color: Colors.textSecondary }}>M: <Text style={{ color: Colors.textPrimary, fontWeight: 'bold' }}>{Math.max(statsObj.career?.matches || 0, 1)}</Text></Text>
              <Text style={{ fontSize: 10, color: Colors.textSecondary }}>R: <Text style={{ color: Colors.textPrimary, fontWeight: 'bold' }}>{batStats.runs || 0}</Text></Text>
              <Text style={{ fontSize: 10, color: Colors.textSecondary }}>Avg: <Text style={{ color: Colors.textPrimary, fontWeight: 'bold' }}>{avg.toFixed(1)}</Text></Text>
              <Text style={{ fontSize: 10, color: Colors.textSecondary }}>SR: <Text style={{ color: Colors.textPrimary, fontWeight: 'bold' }}>{sr.toFixed(1)}</Text></Text>
            </View>
          </View>
        </View>
      );
    } else {
      const bowlStats = statsObj.bowling || {};
      const econ = bowlStats.overs ? ((bowlStats.runs || 0) / bowlStats.overs) : 0;
      return (
        <View style={{ flexDirection: 'row', backgroundColor: Colors.surface, padding: 8, marginVertical: 6, marginHorizontal: 16, borderRadius: 8, borderWidth: 1, borderColor: Colors.borderLight }}>
          <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.primaryAlpha20, justifyContent: 'center', alignItems: 'center', marginRight: 12, overflow: 'hidden' }}>
            {(player.photo || player.userId?.photo) ? (
              <Image source={{ uri: getImageUrl(player.photo || player.userId?.photo) }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
            ) : (
              <Text style={{ color: Colors.primary, fontWeight: 'bold' }}>{player.name?.charAt(0).toUpperCase()}</Text>
            )}
          </View>
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <Text style={{ fontSize: 12, fontWeight: 'bold', color: Colors.textPrimary }}>{player.name}</Text>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
              <Text style={{ fontSize: 10, color: Colors.textSecondary }}>M: <Text style={{ color: Colors.textPrimary, fontWeight: 'bold' }}>{Math.max(statsObj.career?.matches || 0, 1)}</Text></Text>
              <Text style={{ fontSize: 10, color: Colors.textSecondary }}>W: <Text style={{ color: Colors.textPrimary, fontWeight: 'bold' }}>{bowlStats.wickets || 0}</Text></Text>
              <Text style={{ fontSize: 10, color: Colors.textSecondary }}>Econ: <Text style={{ color: Colors.textPrimary, fontWeight: 'bold' }}>{econ.toFixed(1)}</Text></Text>
            </View>
          </View>
        </View>
      );
    }
  };

  const renderCommentary = () => {
    if (loadingCommentary) {
      return <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 50 }} />;
    }

    if (match.status === 'scheduled' || match.status === 'toss_done') {
      return (
        <View style={styles.centerContainer}>
          <Text style={[styles.sectionTitle, { fontSize: 20, textAlign: 'center', marginBottom: 12 }]}>Waiting for the action to begin...</Text>
          <Text style={[styles.emptyText, { fontStyle: 'italic', textAlign: 'center', paddingHorizontal: 32 }]}>
            "Cricket is a pressure game, and when it comes to an India-Pakistan match the pressure is doubled."
          </Text>
        </View>
      );
    }

    if (commentary.length === 0) {
      return <Text style={styles.emptyText}>No commentary available yet.</Text>;
    }

    let filteredCommentary = commentary;
    if (commentaryFilter !== 'ALL' && match.innings?.length > 0) {
      if (['INNINGS_1', 'INNINGS_2'].includes(commentaryFilter) || commentaryFilter.startsWith('SO_')) {
        let targetInningsNums = [];
        if (commentaryFilter === 'INNINGS_1') targetInningsNums = [1];
        else if (commentaryFilter === 'INNINGS_2') targetInningsNums = [2];
        else if (commentaryFilter.startsWith('SO_')) {
          const soIndex = parseInt(commentaryFilter.split('_')[1], 10);
          targetInningsNums = [2 + (soIndex * 2) - 1, 2 + (soIndex * 2)];
        }
        const targetInningsIds = match.innings
          .filter(i => targetInningsNums.includes(i.inningsNumber))
          .map(i => i._id.toString());
        if (targetInningsIds.length > 0) {
          filteredCommentary = commentary.filter(c => {
            const cInnId = (c.innings?._id || c.innings).toString();
            return targetInningsIds.includes(cInnId);
          });
        } else {
          filteredCommentary = [];
        }
      } else {
        if (commentaryFilter === 'Boundaries') {
          filteredCommentary = commentary.filter(c => c.batsmanRuns === 4 || c.batsmanRuns === 6);
        } else if (commentaryFilter === 'Wickets') {
          filteredCommentary = commentary.filter(c => c.isWicket);
        } else if (commentaryFilter === 'Extras') {
          filteredCommentary = commentary.filter(c => c.isWide || c.isNoBall || c.isLegBye || c.isBye);
        }
      }
    }

    const showOverSummary = ['ALL', 'INNINGS_1', 'INNINGS_2'].includes(commentaryFilter) || commentaryFilter.startsWith('SO_');
    const timelineData = [];
    let currentOverNumber = null;
    let currentInningsId = null;
    let overBalls = [];
    let overRuns = 0;
    let overWickets = 0;

    // Clone and reverse commentary so we iterate chronologically from first ball to last ball
    const chronologicalComms = [...filteredCommentary].reverse();

    let currentBowlerId = null;
    let activeBattersList = new Set();
    let isFirstBallOfInnings = true;

    chronologicalComms.forEach((item, index) => {
      const itemInningsId = (item.innings?._id || item.innings).toString();
      const bowlerId = item.bowler?._id || item.bowler;
      const batsmanId = item.batsman?._id || item.batsman;
      const nonStrikerId = item.nonStriker?._id || item.nonStriker;

      // If we transition to a new over OR a new innings, close the previous over
      if (currentOverNumber !== null && (currentOverNumber !== item.overNumber || currentInningsId !== itemInningsId)) {
        if (showOverSummary) {
          timelineData.push({
            type: 'overSummary',
            id: `over-${currentOverNumber}-${currentInningsId}-${index}`,
            overNumber: currentOverNumber,
            runs: overRuns,
            wickets: overWickets,
            balls: [...overBalls],
            bowler: overBalls[overBalls.length - 1]?.bowler,
            score: overBalls[overBalls.length - 1]?.score // Score at the end of this over
          });
        }
        overBalls = [];
        overRuns = 0;
        overWickets = 0;
      }

      // Check for Start of Innings Openers
      if (isFirstBallOfInnings || currentInningsId !== itemInningsId) {
        isFirstBallOfInnings = false;
        activeBattersList.clear();
        if (item.batsman) activeBattersList.add(batsmanId.toString());
        if (item.nonStriker) activeBattersList.add(nonStrikerId.toString());

        timelineData.push({
          type: 'infoEvent',
          id: `openers-${itemInningsId}-${index}`,
          text: `Opening Batters: ${item.batsman?.name || 'Batter'} & ${item.nonStriker?.name || 'Batter'} are in the middle.`,
          icon: 'cricket'
        });
      }

      // Check if bowler changed (new spell / bowling change)
      if (bowlerId && bowlerId.toString() !== currentBowlerId) {
        currentBowlerId = bowlerId.toString();
        timelineData.push({
          type: 'infoEvent',
          id: `bowlerchange-${bowlerId}-${index}`,
          text: `${item.bowler?.name || 'Bowler'} comes into the attack.`,
          icon: 'bowling'
        });
      }

      // Check if any new batter has entered (not in our current active batters list)
      if (batsmanId && !activeBattersList.has(batsmanId.toString())) {
        activeBattersList.add(batsmanId.toString());
        timelineData.push({
          type: 'infoEvent',
          id: `batterentry-${batsmanId}-${index}`,
          text: `New Batter: ${item.batsman?.name || 'Batter'} comes to the crease.`,
          icon: 'account'
        });
      }
      if (nonStrikerId && !activeBattersList.has(nonStrikerId.toString())) {
        activeBattersList.add(nonStrikerId.toString());
        timelineData.push({
          type: 'infoEvent',
          id: `batterentry-${nonStrikerId}-${index}`,
          text: `New Batter: ${item.nonStriker?.name || 'Batter'} comes to the crease.`,
          icon: 'account'
        });
      }

      // Clean active batters list when a wicket falls
      if (item.isWicket && item.wicket?.player) {
        activeBattersList.delete(item.wicket.player.toString());
      } else if (item.isWicket && item.dismissedBatsmanId) {
        activeBattersList.delete(item.dismissedBatsmanId.toString());
      }

      currentOverNumber = item.overNumber;
      currentInningsId = itemInningsId;

      timelineData.push({
        type: 'ball',
        id: item._id || `ball-${index}`,
        data: item
      });

      overBalls.push(item);
      overRuns += item.totalRuns || 0;
      if (item.isWicket) overWickets += 1;
    });

    // Output final over summary
    if (currentOverNumber !== null && showOverSummary && overBalls.length > 0) {
      timelineData.push({
        type: 'overSummary',
        id: `over-${currentOverNumber}-${currentInningsId}-final`,
        overNumber: currentOverNumber,
        runs: overRuns,
        wickets: overWickets,
        balls: [...overBalls],
        bowler: overBalls[overBalls.length - 1]?.bowler,
        score: overBalls[overBalls.length - 1]?.score
      });
    }

    // Now reverse the final timelineData so that the newest elements appear at the top
    timelineData.reverse();

    const renderLiveHeader = () => {
      if (match.status !== 'live' && match.status !== 'in_progress') return null;

      let crr = '0.00';
      let rrr = '0.00';
      if (liveState?.score) {
        const oversArr = String(liveState.score.overs).split('.');
        const totalBalls = parseInt(oversArr[0] || '0') * 6 + parseInt(oversArr[1] || '0');
        crr = totalBalls > 0 ? ((liveState.score.runs / totalBalls) * 6).toFixed(2) : '0.00';

        if (liveState.match?.innings?.length > 1) {
          const target = liveState.match.target;
          if (target && target > liveState.score.runs) {
            const maxBalls = liveState.match.overs * 6;
            const ballsLeft = maxBalls - totalBalls;
            if (ballsLeft > 0) {
              rrr = (((target - liveState.score.runs) / ballsLeft) * 6).toFixed(2);
            }
          }
        }
      }

      return (
        <View style={{ backgroundColor: Colors.surfaceDark, padding: 12, borderBottomWidth: 1, borderBottomColor: Colors.borderLight, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.error, elevation: 4, shadowColor: Colors.error, shadowOpacity: 0.8, shadowRadius: 6 }} />
              <Text style={{ color: '#FFF', fontFamily: Typography.fontFamily.bold, fontSize: 18 }}>
                {liveState?.score?.runs || 0}/{liveState?.score?.wickets || 0}
              </Text>
              <Text style={{ color: Colors.textSecondary, fontFamily: Typography.fontFamily.semiBold, fontSize: 14 }}>
                ({liveState?.score?.overs || '0.0'})
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ color: Colors.textSecondary, fontSize: 10 }}>CRR</Text>
              <Text style={{ color: '#FFF', fontFamily: Typography.fontFamily.semiBold, fontSize: 13 }}>{crr}</Text>
            </View>
            {rrr !== '0.00' && (
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ color: Colors.textSecondary, fontSize: 10 }}>RRR</Text>
                <Text style={{ color: '#FFF', fontFamily: Typography.fontFamily.semiBold, fontSize: 13 }}>{rrr}</Text>
              </View>
            )}
          </View>
        </View>
      );
    };

    const renderFilterChips = () => {
      const filters = ['ALL', 'INNINGS_1', 'INNINGS_2', 'Boundaries', 'Wickets', 'Extras'];
      return (
        <View style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.borderLight }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
            {filters.map(filter => {
              let label = filter;
              if (filter === 'INNINGS_1') label = '1st Innings';
              if (filter === 'INNINGS_2') label = '2nd Innings';
              if (filter === 'ALL') label = 'All Balls';

              if (filter === 'INNINGS_1' && (!match.innings || !match.innings.find(i => i.inningsNumber === 1))) return null;
              if (filter === 'INNINGS_2' && (!match.innings || !match.innings.find(i => i.inningsNumber === 2))) return null;

              const isSelected = commentaryFilter === filter;
              return (
                <TouchableOpacity
                  key={filter}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 6,
                    borderRadius: 20,
                    backgroundColor: isSelected ? Colors.primary : Colors.surface,
                    borderWidth: 1,
                    borderColor: isSelected ? Colors.primary : Colors.borderLight
                  }}
                  onPress={() => setCommentaryFilter(filter)}
                >
                  <Text style={{ color: isSelected ? '#000' : Colors.textSecondary, fontFamily: Typography.fontFamily.semiBold, fontSize: 12 }}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      );
    }

    const renderBallEvent = (ball) => {
      let outcome = `${ball.batsmanRuns}`;
      let bgColor = Colors.surfaceVariant;
      let borderColor = Colors.borderLight;
      let textColor = Colors.textPrimary;
      let glow = null;

      if (ball.isWicket) {
        outcome = 'W';
        bgColor = Colors.primary;
        borderColor = Colors.primary;
        textColor = '#000';
        glow = Colors.primary;
      } else if (ball.isWide) { outcome = `${ball.totalRuns}Wd`; }
      else if (ball.isNoBall) { outcome = `${ball.totalRuns}Nb`; }
      else if (ball.isLegBye) { outcome = `${ball.totalRuns}Lb`; }
      else if (ball.isBye) { outcome = `${ball.totalRuns}B`; }
      else if (ball.batsmanRuns === 4) {
        outcome = '4';
        bgColor = Colors.primary;
        borderColor = Colors.primary;
        textColor = '#000';
        glow = Colors.primary;
      } else if (ball.batsmanRuns === 6) {
        outcome = '6';
        bgColor = Colors.primary;
        borderColor = Colors.primary;
        textColor = '#000';
        glow = Colors.primary;
      } else if (ball.batsmanRuns > 0) {
        // default Colors.surfaceVariant
      } else {
        bgColor = Colors.surface;
      }

      const isExpanded = expandedBalls[ball._id];

      let text = `${ball.batsmanRuns} run(s)`;
      let title = '';
      if (ball.isWicket) {
        const getFirstName = (name) => name ? name.split(' ')[0] : '';
        const bowlerName = getFirstName(ball.bowler?.name);
        const fielderName = ball.wicket?.fielder ? getFirstName(ball.wicket.fielder.name) : '';
        const wType = ball.wicket?.type;
        if (wType === 'caught' || wType === 'caught_and_bowled') {
          const cBy = wType === 'caught_and_bowled' ? bowlerName : (fielderName || 'Sub');
          text = `c ${cBy} b ${bowlerName}`;
        } else if (wType === 'bowled') text = `b ${bowlerName}`;
        else if (wType === 'stumped') text = `st ${fielderName || 'WK'} b ${bowlerName}`;
        else if (wType === 'run_out') text = `run out (${fielderName})`;
        else if (wType === 'lbw') text = `lbw b ${bowlerName}`;
        else if (wType === 'hit_wicket') text = `hit wicket b ${bowlerName}`;
        else text = wType ? wType.replace('_', ' ') : 'Wicket!';
        title = 'OUT!';
      }
      else if (ball.isWide) { text = `${ball.totalRuns} Wide(s)`; title = 'WIDE'; }
      else if (ball.isNoBall) { text = `${ball.totalRuns} No Ball(s)`; title = 'NO BALL'; }
      else if (ball.isLegBye) { text = `${ball.totalRuns} Leg Bye(s)`; title = 'LEG BYE'; }
      else if (ball.isBye) { text = `${ball.totalRuns} Bye(s)`; title = 'BYE'; }
      else if (ball.batsmanRuns === 4) { text = 'Four runs!'; title = 'FOUR'; }
      else if (ball.batsmanRuns === 6) { text = 'Six runs!'; title = 'SIX'; }
      else if (ball.batsmanRuns === 0) { text = 'Dot ball'; title = 'DOT'; }
      else { title = `${ball.batsmanRuns} RUNS`; }

      const isIndoor = match.pitchType === 'Box Cricket' || match.groundType === 'Box Cricket' || match.groundType === 'Indoor';
      const shotPos = ball.wagonWheel && ball.wagonWheel.angle !== undefined ? getShotPosition(ball.wagonWheel.angle, isIndoor) : '';
      const textWithPos = shotPos && (ball.batsmanRuns > 0 || ball.isBoundary || ball.isSix) ? `${text} towards ${shotPos}` : text;
      const speed = ball.speed ? `${ball.speed} km/h` : null;

      return (
        <View style={{ flexDirection: 'row', paddingRight: 16 }}>
          <View style={{ width: 60, alignItems: 'center' }}>
            <View style={{ width: 2, flex: 1, backgroundColor: Colors.borderLight }} />
            <View style={{
              position: 'absolute', top: 20, width: 32, height: 32, borderRadius: 16,
              backgroundColor: bgColor, borderWidth: 2, borderColor: borderColor,
              justifyContent: 'center', alignItems: 'center',
              ...(glow ? { elevation: 8, shadowColor: glow, shadowOpacity: 0.8, shadowRadius: 6 } : {})
            }}>
              <Text style={{ color: textColor, fontFamily: Typography.fontFamily.bold, fontSize: 13 }}>{outcome}</Text>
            </View>
          </View>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => toggleBallExpand(ball._id)}
            style={{
              flex: 1, marginVertical: 12, borderRadius: 20,
              backgroundColor: isExpanded ? Colors.backgroundElevated : Colors.surface,
              borderWidth: 1, borderColor: isExpanded ? Colors.primary : Colors.borderLight,
              padding: 16,
              ...(isExpanded ? { elevation: 4, shadowColor: Colors.primary, shadowOpacity: 0.2, shadowRadius: 8 } : {})
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Text style={{ fontFamily: Typography.fontFamily.bold, color: Colors.textSecondary, fontSize: 12 }}>
                {ball.overNumber - 1}.{ball.ballNumber}
              </Text>
              <Text style={{ fontFamily: Typography.fontFamily.semiBold, color: isExpanded ? Colors.primary : Colors.textSecondary, fontSize: 10, letterSpacing: 0.5 }}>
                {title}
              </Text>
            </View>

            <Text style={{ fontFamily: Typography.fontFamily.regular, color: Colors.textPrimary, fontSize: 14, marginTop: 8, lineHeight: 22 }}>
              <Text
                style={{ fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary }}
                onPress={() => {
                  const bowlerId = ball.bowler?._id || ball.bowler;
                  if (bowlerId) navigation.navigate('PlayerDetail', { id: bowlerId.toString() });
                }}
              >
                {ball.bowler?.name || 'Bowler'}
              </Text>
              {' to '}
              <Text
                style={{ fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary }}
                onPress={() => {
                  const batsmanId = ball.batsman?._id || ball.batsman;
                  if (batsmanId) navigation.navigate('PlayerDetail', { id: batsmanId.toString() });
                }}
              >
                {ball.batsman?.name || 'Batter'}
              </Text>
              {`, ${textWithPos}`}
            </Text>

            {isExpanded && (
              <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: Colors.borderLight }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  {speed && (
                    <View>
                      <Text style={{ color: Colors.textSecondary, fontSize: 10, fontFamily: Typography.fontFamily.semiBold }}>SPEED</Text>
                      <Text style={{ color: Colors.textPrimary, fontSize: 13, fontFamily: Typography.fontFamily.bold }}>{speed}</Text>
                    </View>
                  )}
                  {shotPos ? (
                    <View>
                      <Text style={{ color: Colors.textSecondary, fontSize: 10, fontFamily: Typography.fontFamily.semiBold }}>SHOT</Text>
                      <Text style={{ color: Colors.textPrimary, fontSize: 13, fontFamily: Typography.fontFamily.bold }}>{shotPos}</Text>
                    </View>
                  ) : null}
                  <View>
                    <Text style={{ color: Colors.textSecondary, fontSize: 10, fontFamily: Typography.fontFamily.semiBold }}>TIME</Text>
                    <Text style={{ color: Colors.textPrimary, fontSize: 13, fontFamily: Typography.fontFamily.bold }}>
                      {moment(ball.createdAt).format('h:mm A')}
                    </Text>
                  </View>
                </View>

                {ball.score && (
                  <View style={{ flexDirection: 'row', marginTop: 12, backgroundColor: Colors.surfaceDark, borderRadius: 12, padding: 12 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: Colors.textSecondary, fontSize: 10 }}>Batter</Text>
                      <Text style={{ color: '#FFF', fontSize: 12, fontFamily: Typography.fontFamily.bold }}>
                        {ball.batsman?.name?.split(' ')[0]} {ball.score.strikerRuns}({ball.score.strikerBalls})
                      </Text>
                    </View>
                    <View style={{ flex: 1, alignItems: 'flex-end' }}>
                      <Text style={{ color: Colors.textSecondary, fontSize: 10 }}>Bowler</Text>
                      <Text style={{ color: '#FFF', fontSize: 12, fontFamily: Typography.fontFamily.bold }}>
                        {ball.bowler?.name?.split(' ')[0]} {ball.score.bowlerWickets}/{ball.score.bowlerRuns}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            )}
          </TouchableOpacity>
        </View>
      );
    };

    const renderOverSummary = (summary) => {
      const sequence = [...summary.balls].map((b, i) => {
        let outcome = `${b.batsmanRuns}`;
        if (b.isWicket) outcome = 'W';
        else if (b.isWide) outcome = `${b.totalRuns}wd`;
        else if (b.isNoBall) outcome = `${b.totalRuns}nb`;
        else if (b.isLegBye) outcome = `${b.totalRuns}lb`;
        else if (b.isBye) outcome = `${b.totalRuns}b`;
        else if (b.batsmanRuns === 0) outcome = '•';

        let clr = Colors.textSecondary;
        if (b.isWicket || b.batsmanRuns === 4 || b.batsmanRuns === 6) clr = Colors.primary;
        else if (b.batsmanRuns > 0) clr = Colors.textPrimary;

        return (
          <Text key={i} style={{ color: clr, fontFamily: Typography.fontFamily.bold, fontSize: 14 }}>
            {outcome}
          </Text>
        );
      });

      const sequenceWithDots = sequence.reduce((acc, curr, idx) => {
        if (idx === 0) return [curr];
        return [...acc, <Text key={`dot-${idx}`} style={{ color: Colors.textSecondary, marginHorizontal: 4 }}>·</Text>, curr];
      }, []);

      return (
        <View style={{ flexDirection: 'row', paddingRight: 16 }}>
          <View style={{ width: 60, alignItems: 'center' }}>
            <View style={{ width: 2, flex: 1, backgroundColor: Colors.borderLight }} />
          </View>
          <View style={{ flex: 1, marginVertical: 12, backgroundColor: Colors.surfaceVariant, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.borderLight }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary, fontSize: 14 }}>
                END OF OVER {summary.overNumber}
              </Text>
              <Text style={{ fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary, fontSize: 14 }}>
                {summary.runs} Runs {summary.wickets > 0 && <Text style={{ color: Colors.error }}> | {summary.wickets} Wkts</Text>}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', backgroundColor: Colors.surface, padding: 12, borderRadius: 12, alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ color: Colors.textSecondary, fontFamily: Typography.fontFamily.medium, fontSize: 12, marginRight: 8 }}>Over:</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }}>
                {sequenceWithDots}
              </View>
            </View>

            {summary.score && (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: Colors.textSecondary, fontFamily: Typography.fontFamily.semiBold, fontSize: 12 }}>
                  Score: <Text style={{ color: Colors.primary, fontFamily: Typography.fontFamily.bold, fontSize: 14 }}>{summary.score.runs}-{summary.score.wickets}</Text>
                </Text>
                {summary.bowler && (
                  <Text style={{ color: Colors.textSecondary, fontFamily: Typography.fontFamily.medium, fontSize: 12 }}>
                    {summary.bowler.name}: {summary.score.bowlerOvers} Ov
                  </Text>
                )}
              </View>
            )}
          </View>
        </View>
      );
    };

    return (
      <View style={{ flex: 1, backgroundColor: Colors.background }}>
        {renderFilterChips()}

        <FlatList
          data={timelineData}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 180 }}
          renderItem={({ item }) => {
            if (item.type === 'overSummary') {
              return renderOverSummary(item);
            }
            if (item.type === 'infoEvent') {
              return (
                <View style={{ flexDirection: 'row', paddingRight: 16 }}>
                  <View style={{ width: 60, alignItems: 'center' }}>
                    <View style={{ width: 2, flex: 1, backgroundColor: Colors.borderLight }} />
                    <View style={{
                      position: 'absolute', top: 12, width: 24, height: 24, borderRadius: 12,
                      backgroundColor: 'rgba(255, 212, 0, 0.1)', borderWidth: 1, borderColor: 'rgba(255, 212, 0, 0.25)',
                      justifyContent: 'center', alignItems: 'center'
                    }}>
                      <Icon name={item.icon === 'bowling' ? 'bowling' : item.icon === 'cricket' ? 'cricket' : 'account'} size={12} color={Colors.primary} />
                    </View>
                  </View>
                  <View style={{ flex: 1, marginVertical: 6, backgroundColor: Colors.surface, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: Colors.borderLight, justifyContent: 'center' }}>
                    <Text style={{ fontFamily: Typography.fontFamily.medium, color: Colors.textSecondary, fontSize: 12 }}>
                      {item.text}
                    </Text>
                  </View>
                </View>
              );
            }
            return renderBallEvent(item.data);
          }}
          ListEmptyComponent={
            <View style={{ padding: 32, alignItems: 'center' }}>
              <Text style={{ color: Colors.textSecondary }}>No events found for this filter.</Text>
            </View>
          }
        />
      </View>
    );
  };

  const renderSquads = () => {
    const teamAXI = match.playingXI?.teamA || [];
    const teamBXI = match.playingXI?.teamB || [];

    const maxLength = Math.max(teamAXI.length, teamBXI.length);
    const rows = [];
    for (let i = 0; i < maxLength; i++) {
      rows.push({
        playerA: teamAXI[i] || null,
        playerB: teamBXI[i] || null,
      });
    }

    return (
      <ScrollView contentContainerStyle={[styles.content, { paddingHorizontal: 0 }]} refreshControl={getRefreshControl()}>

        {/* Team Headers */}
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.borderLight }}>

          {/* Team A Header */}
          <TouchableOpacity
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', paddingHorizontal: 16 }}
            onPress={() => match.teamA?._id && navigation.navigate('TeamDetail', { id: match.teamA._id })}
          >
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.borderLight, justifyContent: 'center', alignItems: 'center', marginRight: 8, overflow: 'hidden' }}>
              {(match.teamA?.logo || match.teamA?.logoUrl) ? (
                <Image source={{ uri: getImageUrl(match.teamA?.logo || match.teamA?.logoUrl) }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
              ) : (
                <Text style={{ fontFamily: Typography.fontFamily.bold, color: Colors.textSecondary, fontSize: 16 }}>{match.teamA?.name?.charAt(0) || 'A'}</Text>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary, fontSize: 12 }} numberOfLines={2}>{match.teamA?.name}</Text>
            </View>
          </TouchableOpacity>

          <View style={{ width: 1, height: 30, backgroundColor: Colors.borderLight }} />

          {/* Team B Header */}
          <TouchableOpacity
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', paddingHorizontal: 16 }}
            onPress={() => match.teamB?._id && navigation.navigate('TeamDetail', { id: match.teamB._id })}
          >
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <Text style={{ fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary, fontSize: 12, textAlign: 'right' }} numberOfLines={2}>{match.teamB?.name}</Text>
            </View>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.borderLight, justifyContent: 'center', alignItems: 'center', marginLeft: 8, overflow: 'hidden' }}>
              {(match.teamB?.logo || match.teamB?.logoUrl) ? (
                <Image source={{ uri: getImageUrl(match.teamB?.logo || match.teamB?.logoUrl) }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
              ) : (
                <Text style={{ fontFamily: Typography.fontFamily.bold, color: Colors.textSecondary, fontSize: 16 }}>{match.teamB?.name?.charAt(0) || 'B'}</Text>
              )}
            </View>
          </TouchableOpacity>

        </View>

        {/* Sub Header */}
        <View style={{ backgroundColor: '#F0F0F0', paddingVertical: 4, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: Colors.borderLight }}>
          <Text style={{ fontSize: 10, fontFamily: Typography.fontFamily.bold, color: Colors.textSecondary }}>Playing Squad</Text>
        </View>

        {/* Squad Rows */}
        <View style={{ backgroundColor: Colors.surface, paddingBottom: 24 }}>
          {rows.length === 0 ? <Text style={[styles.emptyText, { marginTop: 24 }]}>Not announced</Text> : rows.map((row, idx) => (
            <View key={`row-${idx}`} style={{ flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' }}>

              {/* Player A */}
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 }}>
                {row.playerA ? (
                  <TouchableOpacity style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }} onPress={() => navigation.navigate('PlayerDetail', { id: row.playerA._id })}>
                    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.borderLight, justifyContent: 'center', alignItems: 'center', marginRight: 10, overflow: 'hidden' }}>
                      {(row.playerA.photo || row.playerA.userId?.photo) ? (
                        <Image source={{ uri: getImageUrl(row.playerA.photo || row.playerA.userId?.photo) }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                      ) : (
                        <Text style={{ fontFamily: Typography.fontFamily.bold, color: Colors.textSecondary, fontSize: 16 }}>{row.playerA.name?.charAt(0).toUpperCase()}</Text>
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary, fontSize: 13 }} numberOfLines={1}>{row.playerA.name}</Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 2, marginTop: 2 }}>
                        {getPlayerTags(row.playerA).map((tag, tIdx) => (
                          <TouchableOpacity key={tIdx} onPress={() => setSelectedTagDefinition(tag)}>
                            <Text style={{ fontFamily: Typography.fontFamily.semiBold, color: tag.type === 'batting' ? '#F39C12' : '#8E44AD', fontSize: 10 }}>
                              {tag.name}{tIdx < getPlayerTags(row.playerA).length - 1 ? <Text style={{ color: Colors.textTertiary }}> •</Text> : ''}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  </TouchableOpacity>
                ) : <View style={{ flex: 1 }} />}
              </View>

              <View style={{ width: 1, backgroundColor: '#F5F5F5' }} />

              {/* Player B */}
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 }}>
                {row.playerB ? (
                  <TouchableOpacity style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' }} onPress={() => navigation.navigate('PlayerDetail', { id: row.playerB._id })}>
                    <View style={{ flex: 1, alignItems: 'flex-end' }}>
                      <Text style={{ fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary, fontSize: 13, textAlign: 'right' }} numberOfLines={1}>{row.playerB.name}</Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 2, marginTop: 2 }}>
                        {getPlayerTags(row.playerB).map((tag, tIdx) => (
                          <TouchableOpacity key={tIdx} onPress={() => setSelectedTagDefinition(tag)}>
                            <Text style={{ fontFamily: Typography.fontFamily.semiBold, color: tag.type === 'batting' ? '#F39C12' : '#8E44AD', fontSize: 10, textAlign: 'right' }}>
                              {tag.name}{tIdx < getPlayerTags(row.playerB).length - 1 ? <Text style={{ color: Colors.textTertiary }}> •</Text> : ''}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.borderLight, justifyContent: 'center', alignItems: 'center', marginLeft: 10, overflow: 'hidden' }}>
                      {(row.playerB.photo || row.playerB.userId?.photo) ? (
                        <Image source={{ uri: getImageUrl(row.playerB.photo || row.playerB.userId?.photo) }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                      ) : (
                        <Text style={{ fontFamily: Typography.fontFamily.bold, color: Colors.textSecondary, fontSize: 16 }}>{row.playerB.name?.charAt(0).toUpperCase()}</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                ) : <View style={{ flex: 1 }} />}
              </View>

            </View>
          ))}
        </View>

      </ScrollView>
    );
  };

  const getDismissalText = (b) => {
    if (!b.dismissal) return '';
    const type = b.dismissal.type;
    const bowlerName = (b.dismissal.bowler?.name || 'Bowler').split(' ')[0];
    const fielderName = (b.dismissal.fielder?.name || 'Fielder').split(' ')[0];

    switch (type) {
      case 'bowled':
        return `b ${bowlerName}`;
      case 'caught':
        return `c ${fielderName} b ${bowlerName}`;
      case 'stumped':
        return `st ${fielderName} b ${bowlerName}`;
      case 'lbw':
        return `lbw b ${bowlerName}`;
      case 'run_out':
        return `run out (${fielderName})`;
      case 'hit_wicket':
        return `hw b ${bowlerName}`;
      case 'caught_and_bowled':
        return `c & b ${bowlerName}`;
      default:
        return type.replace('_', ' ');
    }
  };

  const renderScorecard = () => {
    if (loadingScorecards) {
      return <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 50 }} />;
    }
    let displayScorecards = [...(scorecards || [])];

    if (match.toss && match.toss.winner && displayScorecards.length < 2) {
      const winnerId = match.toss.winner._id || match.toss.winner;
      const isWinnerTeamA = winnerId === (match.teamA?._id || match.teamA);

      let team1Batting = false;
      if ((isWinnerTeamA && match.toss.choice === 'bat') || (!isWinnerTeamA && match.toss.choice === 'bowl')) {
        team1Batting = true;
      }

      const firstBattingTeam = team1Batting ? match.teamA : match.teamB;
      const secondBattingTeam = team1Batting ? match.teamB : match.teamA;
      const firstBowlingTeam = team1Batting ? match.teamB : match.teamA;
      const secondBowlingTeam = team1Batting ? match.teamA : match.teamB;

      if (displayScorecards.length === 0) {
        displayScorecards.push({
          inningsNumber: 1, battingTeam: firstBattingTeam, bowlingTeam: firstBowlingTeam,
          batting: [], bowling: [], total: { runs: 0, wickets: 0, overs: '0.0' }, extras: {}
        });
      }
      if (displayScorecards.length === 1) {
        displayScorecards.push({
          inningsNumber: 2, battingTeam: secondBattingTeam, bowlingTeam: secondBowlingTeam,
          batting: [], bowling: [], total: { runs: 0, wickets: 0, overs: '0.0' }, extras: {}
        });
      }
    }

    if (liveState && displayScorecards.length > 0) {
      const currentInningsIdx = liveState.inningsNumber ? liveState.inningsNumber - 1 : 0;
      if (displayScorecards[currentInningsIdx]) {
        const sc = displayScorecards[currentInningsIdx];
        if (liveState.striker && !sc.batting.find(b => (b.player?._id || b.player)?.toString() === liveState.striker._id?.toString())) {
          sc.batting.push({ player: liveState.striker, runs: 0, balls: 0, fours: 0, sixes: 0, strikeRate: 0, isNotOut: true });
        }
        if (liveState.nonStriker && !sc.batting.find(b => (b.player?._id || b.player)?.toString() === liveState.nonStriker._id?.toString())) {
          sc.batting.push({ player: liveState.nonStriker, runs: 0, balls: 0, fours: 0, sixes: 0, strikeRate: 0, isNotOut: true });
        }
        if (liveState.bowler && !sc.bowling.find(b => (b.player?._id || b.player)?.toString() === liveState.bowler._id?.toString())) {
          sc.bowling.push({ player: liveState.bowler, overs: 0, balls: 0, maidens: 0, runs: 0, wickets: 0, economy: 0 });
        }
      }
    }

    if (!displayScorecards || displayScorecards.length === 0) {
      return <Text style={styles.emptyText}>Scorecard not available yet.</Text>;
    }

    return (
      <ScrollView contentContainerStyle={styles.content} refreshControl={getRefreshControl()}>
        {displayScorecards.map((sc, index) => {
          const battingTeamName = sc.battingTeam?.name || (sc.battingTeam === match.teamA?._id ? match.teamA?.name : match.teamB?.name);
          const isExpanded = expandedInnings[index] !== false; // expanded by default

          return (
            <View key={index} style={{ marginBottom: 24 }}>
              <TouchableOpacity onPress={() => toggleInnings(index)} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, backgroundColor: Colors.surfaceVariant, paddingHorizontal: 16, paddingVertical: 14, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.border, ...Shadows.sm }}>
                <Text style={{ color: Colors.primary, fontFamily: Typography.fontFamily.bold, fontWeight: '900', fontSize: 14, textTransform: 'uppercase' }}>{battingTeamName} {sc.inningsNumber >= 3 ? '(Super Over)' : ''}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ color: Colors.textPrimary, fontFamily: Typography.fontFamily.semiBold, fontSize: 13 }}>
                    {sc.batting.length > 0 ? (
                      <>{sc.total?.runs || 0}/{sc.total?.wickets || 0} <Text style={{ fontSize: 11, color: Colors.textSecondary }}>({sc.total?.overs || '0.0'})</Text></>
                    ) : (
                      <Text style={{ color: Colors.textSecondary, fontSize: 13 }}>Yet to bat</Text>
                    )}
                  </Text>
                  <Icon name={isExpanded ? "chevron-up" : "chevron-down"} size={28} color={Colors.primary} />
                </View>
              </TouchableOpacity>

              {isExpanded && (
                <View>
                  <View style={[styles.section, { marginBottom: 8 }]}>
                    {/* Batting Scorecard */}
                    {sc.batting.length > 0 ? (
                      <>
                        <View style={styles.tableHeaderRow}>
                          <Text style={[styles.tableHeaderText, { flex: 3, textAlign: 'left' }]}>Batters</Text>
                          <Text style={styles.tableHeaderText}>R</Text>
                          <Text style={styles.tableHeaderText}>B</Text>
                          <Text style={styles.tableHeaderText}>4s</Text>
                          <Text style={styles.tableHeaderText}>6s</Text>
                          <Text style={[styles.tableHeaderText, { flex: 1.5, textAlign: 'right' }]}>SR</Text>
                        </View>
                        {sc.batting.map((b, idx) => (
                          <View key={idx} style={styles.tableRow}>
                            <View style={{ flex: 3 }}>
                              <TouchableOpacity onPress={() => b.player && setSelectedPlayerPreview(b.player)} activeOpacity={0.7}>
                                <Text style={b.isNotOut ? styles.playerNameActive : styles.playerNameClickable} numberOfLines={1}>
                                  {b.player?.name || 'Player'}{b.isNotOut ? ' *' : ''}
                                </Text>
                              </TouchableOpacity>
                              {!b.isNotOut && b.dismissal && (
                                <Text style={{ fontSize: 11, color: Colors.textSecondary, marginTop: 1 }} numberOfLines={1}>{getDismissalText(b)}</Text>
                              )}
                            </View>
                            <Text style={styles.tableRowText}>{b.runs}</Text>
                            <Text style={styles.tableRowText}>{b.balls}</Text>
                            <Text style={styles.tableRowText}>{b.fours}</Text>
                            <Text style={styles.tableRowText}>{b.sixes}</Text>
                            <Text style={[styles.tableRowText, { flex: 1.5, textAlign: 'right' }]}>{b.strikeRate}</Text>
                          </View>
                        ))}

                        {/* Extras Details */}
                        <View style={[styles.tableRow, { borderBottomWidth: 0, marginTop: 8 }]}>
                          <Text style={{ flex: 3, color: Colors.textSecondary }}>Extras</Text>
                          <Text style={{ flex: 4, color: Colors.textSecondary, fontSize: 12 }}>
                            (W {sc.extras?.wides || 0}, NB {sc.extras?.noBalls || 0}, B {sc.extras?.byes || 0}, LB {sc.extras?.legByes || 0}, P {sc.extras?.penalties || 0})
                          </Text>
                          <Text style={{ flex: 1, textAlign: 'right', fontWeight: 'bold', color: Colors.textPrimary }}>
                            {(sc.extras?.wides || 0) + (sc.extras?.noBalls || 0) + (sc.extras?.byes || 0) + (sc.extras?.legByes || 0) + (sc.extras?.penalties || 0)}
                          </Text>
                        </View>
                        <View style={[styles.tableRow, { borderBottomWidth: 0 }]}>
                          <Text style={{ flex: 3, color: Colors.textSecondary, fontWeight: 'bold' }}>Total</Text>
                          <Text style={{ flex: 2, textAlign: 'right', fontWeight: 'bold', color: Colors.textPrimary }}>
                            {sc.total?.runs || 0}/{sc.total?.wickets || 0} ({sc.total?.overs || '0.0'} Ov)
                          </Text>
                        </View>

                        {/* Did Not Bat */}
                        {(() => {
                          const battingTeamIdStr = (sc.battingTeam?._id || sc.battingTeam)?.toString();
                          const teamAIdStr = (match.teamA?._id || match.teamA)?.toString();
                          const playingXI = battingTeamIdStr === teamAIdStr ? match.playingXI?.teamA : match.playingXI?.teamB;
                          if (!playingXI) return null;
                          const battedIds = sc.batting.map(b => b.player?._id?.toString() || b.player?.toString());
                          const dnb = playingXI.filter(p => !battedIds.includes(p._id?.toString()));
                          if (dnb.length === 0) return null;
                          return (
                            <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.borderLight }}>
                              <Text style={{ color: Colors.textTertiary, fontSize: 10, fontFamily: Typography.fontFamily.bold, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 }}>Did Not Bat</Text>
                              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                                {dnb.map((p, idx) => (
                                  <TouchableOpacity
                                    key={idx}
                                    onPress={() => setSelectedPlayerPreview(p)}
                                    activeOpacity={0.7}
                                    style={styles.dnbChip}
                                  >
                                    <Text style={styles.dnbChipText}>{p.name}</Text>
                                    {idx < dnb.length - 1 && <Text style={styles.dnbComma}>,</Text>}
                                  </TouchableOpacity>
                                ))}
                              </View>
                            </View>
                          );
                        })()}

                        {/* Fall of Wickets */}
                        {(() => {
                          const inn = match.innings?.find(i => i.inningsNumber === sc.inningsNumber);
                          if (!inn || !inn.fallOfWickets || inn.fallOfWickets.length === 0) return null;
                          return (
                            <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: Colors.borderLight }}>
                              <Text style={{ color: Colors.textSecondary, fontSize: 12, fontFamily: Typography.fontFamily.bold, marginBottom: 4 }}>Fall of Wickets</Text>
                              <Text style={{ color: Colors.textPrimary, fontSize: 13, lineHeight: 20 }}>
                                {inn.fallOfWickets.map(fow => {
                                  const playerName = fow.batsman?.name || sc.batting.find(b => (b.player?._id || b.player)?.toString() === (fow.batsman?._id || fow.batsman)?.toString())?.player?.name || 'Player';
                                  return `${fow.runs}-${fow.wicket} (${playerName}, ${fow.over} Ov)`;
                                }).join(', ')}
                              </Text>
                            </View>
                          );
                        })()}

                      </>
                    ) : (
                      <View style={{ paddingVertical: 12 }}>
                        <Text style={{ color: Colors.textSecondary, fontFamily: Typography.fontFamily.medium, fontSize: 14, marginBottom: 8 }}>Yet to bat</Text>
                        {(() => {
                          const battingTeamIdStr = (sc.battingTeam?._id || sc.battingTeam)?.toString();
                          const teamAIdStr = (match.teamA?._id || match.teamA)?.toString();
                          const playingXI = battingTeamIdStr === teamAIdStr ? match.playingXI?.teamA : match.playingXI?.teamB;
                          if (!playingXI) return null;
                          return (
                            <View style={{ marginTop: 4 }}>
                              {playingXI.map((p, idx) => (
                                <TouchableOpacity key={idx} onPress={() => setSelectedPlayerPreview(p)} style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' }}>
                                  <Text style={styles.playerNameNormal}>{p.name}</Text>
                                </TouchableOpacity>
                              ))}
                            </View>
                          );
                        })()}
                      </View>
                    )}
                  </View>

                  {/* Bowling Scorecard */}
                  {sc.bowling.length > 0 && (
                    <View style={styles.section}>
                      <View style={styles.tableHeaderRow}>
                        <Text style={[styles.tableHeaderText, { flex: 3, textAlign: 'left' }]}>Bowlers</Text>
                        <Text style={styles.tableHeaderText}>O</Text>
                        <Text style={styles.tableHeaderText}>M</Text>
                        <Text style={styles.tableHeaderText}>R</Text>
                        <Text style={styles.tableHeaderText}>W</Text>
                        <Text style={[styles.tableHeaderText, { flex: 1.5, textAlign: 'right' }]}>ER</Text>
                      </View>
                      {sc.bowling.map((b, idx) => (
                        <View key={idx} style={styles.tableRow}>
                          <View style={{ flex: 3 }}>
                            <TouchableOpacity onPress={() => b.player && setSelectedPlayerPreview(b.player)} activeOpacity={0.7}>
                              <Text style={styles.playerNameClickable} numberOfLines={1}>{b.player?.name || 'Player'}</Text>
                            </TouchableOpacity>
                          </View>
                          <Text style={styles.tableRowText}>{b.overs}.{b.balls}</Text>
                          <Text style={styles.tableRowText}>{b.maidens}</Text>
                          <Text style={styles.tableRowText}>{b.runs}</Text>
                          <Text style={b.wickets > 0 ? [styles.tableRowText, { color: Colors.primary, fontFamily: Typography.fontFamily.bold }] : styles.tableRowText}>{b.wickets}</Text>
                          <Text style={[styles.tableRowText, { flex: 1.5, textAlign: 'right' }]}>{b.economy}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    );
  };
  const renderPartnerships = () => {
    return (
      <PartnershipsView
        match={match}
        scorecards={scorecards}
        commentary={commentary}
        refreshControl={getRefreshControl()}
      />
    );
  };

  const renderAnalysis = () => {
    if (loadingCommentary || loadingScorecards) {
      return <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 50 }} />;
    }
    if (!commentary || commentary.length === 0) {
      return <Text style={styles.emptyText}>Not enough data for analysis yet.</Text>;
    }

    const isIndoor = match.pitchType === 'Box Cricket' || match.groundType === 'Box Cricket' || match.groundType === 'Indoor';
    const bgImage = isIndoor ? require('../../../turf.png') : require('../../../ground.png');

    let targetTeamId = null;
    if (analysisFilter === 'A') targetTeamId = match.teamA?._id;
    if (analysisFilter === 'B') targetTeamId = match.teamB?._id;

    const analysisBalls = commentary.filter(ball => {
      if (analysisFilter === 'ALL') return true;
      const ballInningsId = (ball.innings?._id || ball.innings).toString();
      const inn = match.innings?.find(i => i._id.toString() === ballInningsId);
      if (inn) {
        const batTeamId = (inn.battingTeam?._id || inn.battingTeam).toString();
        return batTeamId === targetTeamId?.toString();
      }
      return false;
    });

    const finalBalls = selectedAnalysisBatter
      ? analysisBalls.filter(b => (b.batsman?._id || b.batsman).toString() === selectedAnalysisBatter._id.toString())
      : analysisBalls;

    let totalRuns = 0;
    let dotBalls = 0;
    let fours = 0;
    let sixes = 0;
    let extras = 0;
    const wagonWheelPoints = [];

    finalBalls.forEach(ball => {
      totalRuns += ball.totalRuns || 0;
      if (ball.extraRuns > 0) extras += ball.extraRuns;
      if (ball.batsmanRuns === 0 && ball.extraRuns === 0 && !ball.isWicket) dotBalls++;
      if (ball.batsmanRuns === 4 || ball.isBoundary) fours++;
      if (ball.batsmanRuns === 6 || ball.isSix) sixes++;

      if (ball.wagonWheel && ball.wagonWheel.angle !== undefined) {
        wagonWheelPoints.push(ball.wagonWheel);
      }
    });

    const totalValidBalls = finalBalls.filter(b => !b.isWide && !b.isNoBall).length;

    const battersMap = {};
    analysisBalls.forEach(b => {
      if (b.batsman && b.batsman._id) {
        battersMap[b.batsman._id] = b.batsman;
      }
    });
    const battersList = Object.values(battersMap);

    return (
      <ScrollView contentContainerStyle={styles.content} refreshControl={getRefreshControl()}>

        {/* Dropdown Filters */}
        <View style={{ flexDirection: 'row', marginBottom: 16, marginHorizontal: -4 }}>
          <AnalysisDropdown
            value={analysisFilter}
            options={[
              { label: 'All Teams', value: 'ALL' },
              { label: match.teamA?.shortName || match.teamA?.name || 'Team A', value: 'A' },
              { label: match.teamB?.shortName || match.teamB?.name || 'Team B', value: 'B' }
            ]}
            onSelect={(val) => { setAnalysisFilter(val); setSelectedAnalysisBatter(null); }}
            placeholder="Select Team"
          />
          <AnalysisDropdown
            value={selectedAnalysisBatter}
            options={[
              { label: 'All Batters', value: null },
              ...battersList.map(b => ({ label: b.name, value: b }))
            ]}
            onSelect={(val) => setSelectedAnalysisBatter(val)}
            placeholder="Select Batter"
          />
        </View>

        {/* Stats Summary */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 24 }}>
          <View style={{ width: '48%', backgroundColor: Colors.surface, padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: Colors.borderLight, alignItems: 'center' }}>
            <Text style={{ color: Colors.textSecondary, fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase' }}>Total Runs</Text>
            <Text style={{ color: Colors.textPrimary, fontSize: 24, fontWeight: 'bold', marginTop: 4 }}>{totalRuns}</Text>
          </View>
          <View style={{ width: '48%', backgroundColor: Colors.surface, padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: Colors.borderLight, alignItems: 'center' }}>
            <Text style={{ color: Colors.textSecondary, fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase' }}>Dot Balls</Text>
            <Text style={{ color: Colors.textPrimary, fontSize: 24, fontWeight: 'bold', marginTop: 4 }}>{dotBalls} <Text style={{ fontSize: 14, color: Colors.textSecondary, fontWeight: 'normal' }}>({totalValidBalls ? Math.round((dotBalls / totalValidBalls) * 100) : 0}%)</Text></Text>
          </View>
          <View style={{ width: '48%', backgroundColor: Colors.surface, padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: Colors.borderLight, alignItems: 'center' }}>
            <Text style={{ color: Colors.textSecondary, fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase' }}>Boundaries</Text>
            <Text style={{ color: Colors.textPrimary, fontSize: 24, fontWeight: 'bold', marginTop: 4 }}>{fours}x4 <Text style={{ fontSize: 20 }}>/</Text> {sixes}x6</Text>
          </View>
          <View style={{ width: '48%', backgroundColor: Colors.surface, padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: Colors.borderLight, alignItems: 'center' }}>
            <Text style={{ color: Colors.textSecondary, fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase' }}>Extras</Text>
            <Text style={{ color: Colors.textPrimary, fontSize: 24, fontWeight: 'bold', marginTop: 4 }}>{extras}</Text>
          </View>
        </View>

        {/* Wagon Wheel */}
        <View style={[styles.section, { alignItems: 'center', paddingVertical: 24 }]}>
          <Text style={[styles.sectionTitle, { marginBottom: 20 }]}>Wagon Wheel</Text>
          {(() => {
            const W = isIndoor ? 220 : 300;
            const H = isIndoor ? 360 : 300;
            const CX = W / 2;
            const CY = H / 2;
            const CY_ACTUAL = CY - (isIndoor ? 60 : 40);
            return (
              <View style={{ width: W, height: H, borderRadius: isIndoor ? 16 : 150, overflow: 'hidden', backgroundColor: '#4CAF50' }}>
                <ImageBackground
                  source={bgImage}
                  style={{ width: W, height: H }}
                  resizeMode="cover"
                >
                  {/* Pitch Center */}
                  <View style={{ position: 'absolute', left: CX - 4, top: CY_ACTUAL - 4, width: 8, height: 8, borderRadius: 4, backgroundColor: 'red' }} />

                  {/* Field Labels */}
                  <Text style={{ position: 'absolute', top: 10, left: CX - 30, width: 60, textAlign: 'center', color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: 'bold' }}>BEHIND</Text>
                  <Text style={{ position: 'absolute', bottom: 10, left: CX - 40, width: 80, textAlign: 'center', color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: 'bold' }}>STRAIGHT</Text>
                  <Text style={{ position: 'absolute', right: 10, top: CY_ACTUAL - 8, color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: 'bold' }}>LEG</Text>
                  <Text style={{ position: 'absolute', left: 10, top: CY_ACTUAL - 8, color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: 'bold' }}>OFF</Text>

                  {wagonWheelPoints.map((point, idx) => (
                    <View key={idx} style={{
                      position: 'absolute',
                      left: CX - point.distance,
                      top: CY_ACTUAL - 2,
                      width: point.distance * 2,
                      height: 4,
                      justifyContent: 'center',
                      alignItems: 'flex-end',
                      transform: [
                        { rotate: `${point.angle}deg` }
                      ]
                    }}>
                      <View style={{ width: point.distance, height: 4, backgroundColor: point.color || '#FFF' }} />
                    </View>
                  ))}
                </ImageBackground>
              </View>
            );
          })()}
          {wagonWheelPoints.length === 0 && (
            <Text style={{ color: Colors.textSecondary, marginTop: 16, fontStyle: 'italic' }}>No wagon wheel data recorded.</Text>
          )}
        </View>

      </ScrollView>
    );
  };

  const renderLeaderboard = () => {
    if (loadingScorecards) {
      return <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 50 }} />;
    }
    if (!scorecards || scorecards.length === 0) {
      return <Text style={styles.emptyText}>No scorecard data yet.</Text>;
    }

    // ── Build player stat maps ──────────────────────────────────────────────
    const battersMap = {};  // pid → batter stats
    const bowlersMap = {};  // pid → bowler stats
    const fieldersMap = {};  // pid → fielding stats

    scorecards.forEach(sc => {
      const battingTeamName = sc.battingTeam?.name || (sc.battingTeam === match.teamA?._id ? match.teamA?.name : match.teamB?.name);
      const bowlingTeamName = sc.bowlingTeam?.name || (sc.bowlingTeam === match.teamA?._id ? match.teamA?.name : match.teamB?.name);

      sc.batting.forEach(b => {
        if (!b.player) return;
        const pid = b.player._id?.toString();
        if (!battersMap[pid]) battersMap[pid] = {
          id: pid, name: b.player.name, photo: b.player.photo || b.player.userId?.photo,
          teamName: battingTeamName, runs: 0, balls: 0, fours: 0, sixes: 0, isNotOut: false,
        };
        battersMap[pid].runs += b.runs || 0;
        battersMap[pid].balls += b.balls || 0;
        battersMap[pid].fours += b.fours || 0;
        battersMap[pid].sixes += b.sixes || 0;
        if (b.isNotOut) battersMap[pid].isNotOut = true;

        // fielder from dismissal
        if (b.dismissal?.fielder) {
          const fid = (b.dismissal.fielder._id || b.dismissal.fielder)?.toString();
          const fname = b.dismissal.fielder.name || 'Fielder';
          if (!fieldersMap[fid]) fieldersMap[fid] = {
            id: fid, name: fname, photo: null,
            teamName: bowlingTeamName, catches: 0, stumpings: 0, runOuts: 0,
          };
          const dtype = b.dismissal.type;
          if (dtype === 'caught' || dtype === 'caught_and_bowled') fieldersMap[fid].catches += 1;
          else if (dtype === 'stumped') fieldersMap[fid].stumpings += 1;
          else if (dtype === 'run_out') fieldersMap[fid].runOuts += 1;
        }
      });

      sc.bowling.forEach(b => {
        if (!b.player) return;
        const pid = b.player._id?.toString();
        if (!bowlersMap[pid]) bowlersMap[pid] = {
          id: pid, name: b.player.name, photo: b.player.photo || b.player.userId?.photo,
          teamName: bowlingTeamName,
          overs: 0, balls: 0, maidens: 0, runs: 0, wickets: 0,
        };
        bowlersMap[pid].overs += b.overs || 0;
        bowlersMap[pid].balls += b.balls || 0;
        bowlersMap[pid].maidens += b.maidens || 0;
        bowlersMap[pid].runs += b.runs || 0;
        bowlersMap[pid].wickets += b.wickets || 0;
      });
    });

    const batters = Object.values(battersMap).sort((a, b) => b.runs - a.runs);
    const bowlers = Object.values(bowlersMap).sort((a, b) => b.wickets - a.wickets || a.runs - b.runs);
    const fielders = Object.values(fieldersMap).sort((a, b) =>
      (b.catches + b.stumpings + b.runOuts) - (a.catches + a.stumpings + a.runOuts)
    ).filter(f => (f.catches + f.stumpings + f.runOuts) > 0);

    // MVP: combine all players
    const allMap = {};
    [...batters, ...bowlers, ...fielders].forEach(p => {
      if (!allMap[p.id]) allMap[p.id] = {
        ...p, mvpRuns: 0, mvpFours: 0, mvpSixes: 0,
        mvpWickets: 0, mvpCatches: 0, mvpStumpings: 0, mvpRunOuts: 0,
      };
    });
    batters.forEach(p => { allMap[p.id].mvpRuns = p.runs; allMap[p.id].mvpFours = p.fours; allMap[p.id].mvpSixes = p.sixes; });
    bowlers.forEach(p => { allMap[p.id].mvpWickets = p.wickets; });
    fielders.forEach(p => { allMap[p.id].mvpCatches = p.catches; allMap[p.id].mvpStumpings = p.stumpings; allMap[p.id].mvpRunOuts = p.runOuts; });
    const mvpList = Object.values(allMap).map(p => {
      let points = 0;
      if (match?.mvpBreakdown) {
        const pid = String(p.id || p._id);
        if (typeof match.mvpBreakdown.get === 'function') {
          const breakdown = match.mvpBreakdown.get(pid);
          if (breakdown) points = breakdown.totalMvp || 0;
        } else if (match.mvpBreakdown[pid]) {
          points = match.mvpBreakdown[pid].totalMvp || match.mvpBreakdown[pid].total || 0;
        }
      }
      if (!points) {
        points = parseFloat(((
          (p.mvpRuns * 1) + (p.mvpSixes * 2) + (p.mvpFours * 0.5) +
          (p.mvpWickets * 20) + (p.mvpCatches * 10) + (p.mvpStumpings * 12) + (p.mvpRunOuts * 8)
        ) / 10).toFixed(3));
      }
      return {
        ...p,
        points: points.toFixed(3),
      };
    }).filter(p => parseFloat(p.points) > 0).sort((a, b) => parseFloat(b.points) - parseFloat(a.points));

    // ── Top awards ──────────────────────────────────────────────────────────
    const topBatter = batters[0];
    const topBowler = bowlers[0];
    const topFielder = fielders[0];
    const topMVP = mvpList[0];

    const renderAwardCard = (icon, iconColor, label, player, stat, statLabel) => {
      if (!player) return null;
      return (
        <TouchableOpacity
          style={styles.awardCard}
          onPress={() => setSelectedPlayerPreview({ _id: player.id, name: player.name })}
          activeOpacity={0.8}
        >
          <View style={[styles.awardIconWrap, { backgroundColor: iconColor + '22' }]}>
            <Icon name={icon} size={20} color={iconColor} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.awardLabel}>{label}</Text>
            <Text style={styles.awardPlayerName} numberOfLines={1}>{player.name}</Text>
            <Text style={styles.awardTeam} numberOfLines={1}>{player.teamName}</Text>
          </View>
          <View style={styles.awardStatBox}>
            <Text style={[styles.awardStatValue, { color: iconColor }]}>{stat}</Text>
            <Text style={styles.awardStatLabel}>{statLabel}</Text>
          </View>
        </TouchableOpacity>
      );
    };

    // ── Avatar helper ───────────────────────────────────────────────────────
    const PlayerAvatar = ({ player }) => (
      <View style={styles.lbAvatar}>
        {player.photo ? (
          <Image source={{ uri: getImageUrl(player.photo) }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        ) : (
          <Text style={styles.lbAvatarText}>{player.name.charAt(0).toUpperCase()}</Text>
        )}
      </View>
    );

    // ── Render tabs content ─────────────────────────────────────────────────
    const renderBattingTab = () => (
      <View style={styles.section}>
        <View style={[styles.tableHeaderRow, { marginBottom: 0 }]}>
          <Text style={[styles.tableHeaderText, { flex: 3, textAlign: 'left' }]}>Batter</Text>
          <Text style={styles.tableHeaderText}>Runs</Text>
          <Text style={[styles.tableHeaderText, { flex: 1.5, textAlign: 'right' }]}>Points</Text>
        </View>
        {batters.length === 0 ? (
          <Text style={styles.emptyText}>No batting data</Text>
        ) : batters.map((p, idx) => {
          const pts = ((p.runs * 1 + p.sixes * 2 + p.fours * 0.5) / 10).toFixed(3);
          return (
            <TouchableOpacity
              key={'batting_' + idx}
              style={[styles.lbSimpleRow, idx === batters.length - 1 && { borderBottomWidth: 0 }]}
              onPress={() => setSelectedPlayerPreview({ _id: p.id, name: p.name })}
              activeOpacity={0.7}
            >
              <Text style={styles.lbRankSm}>{String(idx + 1)}</Text>
              <Text style={styles.lbSimpleName} numberOfLines={1}>
                {p.name + (p.isNotOut ? ' *' : '')}
              </Text>
              <Text style={styles.lbSimpleStat}>{String(p.runs)}</Text>
              <Text style={styles.lbSimplePoints}>{pts}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );

    const renderBowlingTab = () => (
      <View style={styles.section}>
        <View style={[styles.tableHeaderRow, { marginBottom: 0 }]}>
          <Text style={[styles.tableHeaderText, { flex: 3, textAlign: 'left' }]}>Bowler</Text>
          <Text style={styles.tableHeaderText}>Wkts</Text>
          <Text style={[styles.tableHeaderText, { flex: 1.5, textAlign: 'right' }]}>Points</Text>
        </View>
        {bowlers.length === 0 ? (
          <Text style={styles.emptyText}>No bowling data</Text>
        ) : bowlers.map((p, idx) => {
          const pts = ((p.wickets * 20) / 10).toFixed(3);
          return (
            <TouchableOpacity
              key={'bowling_' + idx}
              style={[styles.lbSimpleRow, idx === bowlers.length - 1 && { borderBottomWidth: 0 }]}
              onPress={() => setSelectedPlayerPreview({ _id: p.id, name: p.name })}
              activeOpacity={0.7}
            >
              <Text style={styles.lbRankSm}>{String(idx + 1)}</Text>
              <Text style={styles.lbSimpleName} numberOfLines={1}>{p.name}</Text>
              <Text style={[styles.lbSimpleStat, p.wickets > 0 && { color: Colors.primary, fontFamily: Typography.fontFamily.bold }]}>
                {String(p.wickets)}
              </Text>
              <Text style={styles.lbSimplePoints}>{pts}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );

    const renderFieldingTab = () => (
      <View style={styles.section}>
        <View style={[styles.tableHeaderRow, { marginBottom: 0 }]}>
          <Text style={[styles.tableHeaderText, { flex: 3, textAlign: 'left' }]}>Fielder</Text>
          <Text style={styles.tableHeaderText}>Ct</Text>
          <Text style={[styles.tableHeaderText, { flex: 1.5, textAlign: 'right' }]}>Points</Text>
        </View>
        {fielders.length === 0 ? (
          <Text style={styles.emptyText}>No fielding dismissals recorded</Text>
        ) : fielders.map((p, idx) => {
          const pts = ((p.catches * 10 + p.stumpings * 12 + p.runOuts * 8) / 10).toFixed(3);
          return (
            <TouchableOpacity
              key={'fielding_' + idx}
              style={[styles.lbSimpleRow, idx === fielders.length - 1 && { borderBottomWidth: 0 }]}
              onPress={() => setSelectedPlayerPreview({ _id: p.id, name: p.name })}
              activeOpacity={0.7}
            >
              <Text style={styles.lbRankSm}>{String(idx + 1)}</Text>
              <Text style={styles.lbSimpleName} numberOfLines={1}>{p.name}</Text>
              <Text style={styles.lbSimpleStat}>{String(p.catches)}</Text>
              <Text style={styles.lbSimplePoints}>{pts}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );

    const renderMVPTab = () => (
      <View style={styles.section}>
        <View style={[styles.tableHeaderRow, { marginBottom: 0 }]}>
          <Text style={[styles.tableHeaderText, { flex: 0.4 }]}>#</Text>
          <Text style={[styles.tableHeaderText, { flex: 3, textAlign: 'left' }]}>Player</Text>
          <Text style={[styles.tableHeaderText, { flex: 1.5, textAlign: 'right' }]}>Points</Text>
        </View>
        {mvpList.length === 0 ? (
          <Text style={styles.emptyText}>No data available</Text>
        ) : mvpList.map((p, idx) => (
          <TouchableOpacity
            key={'mvp_' + idx}
            style={[styles.lbSimpleRow, idx === mvpList.length - 1 && { borderBottomWidth: 0 }]}
            onPress={() => setSelectedPlayerPreview({ _id: p.id, name: p.name })}
            activeOpacity={0.7}
          >
            <Text style={[
              styles.lbRankSm,
              { flex: 0.4 },
              idx < 3 && { color: ['#FFD700', '#C0C0C0', '#CD7F32'][idx], fontFamily: Typography.fontFamily.bold },
            ]}>{String(idx + 1)}</Text>
            <Text style={[styles.lbSimpleName, { flex: 3 }]} numberOfLines={1}>{p.name}</Text>
            <Text style={styles.lbSimplePoints}>{p.points}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );

    return (
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 32 }]} refreshControl={getRefreshControl()}>

        {/* Awards strip */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🏆 Match Awards</Text>
          {renderAwardCard('cricket', Colors.primary, 'Top Batter', topBatter, topBatter ? `${topBatter.runs}(${topBatter.balls})` : '--', 'Runs')}
          {renderAwardCard('bowling', Colors.info || '#2196F3', 'Top Bowler', topBowler, topBowler ? `${topBowler.wickets}/${topBowler.runs}` : '--', 'Wkts')}
          {renderAwardCard('hand-extended', Colors.success, 'Top Fielder', topFielder, topFielder ? `${topFielder.catches + topFielder.stumpings + topFielder.runOuts}` : '--', 'Dismissals')}
          {renderAwardCard('star-circle', '#FFD700', 'MVP', topMVP, topMVP ? topMVP.points : '--', 'Points')}
        </View>

        {/* Sub-tab bar */}
        <View style={styles.lbFilterRow}>
          {['Batting', 'Bowling', 'Fielding', 'MVP'].map(tab => (
            <TouchableOpacity
              key={tab}
              style={[styles.lbFilterBtn, leaderboardFilter === tab && styles.lbFilterBtnActive]}
              onPress={() => setLeaderboardFilter(tab)}
            >
              <Text style={[styles.lbFilterText, leaderboardFilter === tab && styles.lbFilterTextActive]}>{tab}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab content */}
        {leaderboardFilter === 'Batting' && renderBattingTab()}
        {leaderboardFilter === 'Bowling' && renderBowlingTab()}
        {leaderboardFilter === 'Fielding' && renderFieldingTab()}
        {leaderboardFilter === 'MVP' && renderMVPTab()}

      </ScrollView>
    );
  };

  // const renderMvp = () => {
  //   const mvpData = match?.mvpBreakdown || {};
  //   const teamA_players = match?.playingXI?.teamA || [];
  //   const teamB_players = match?.playingXI?.teamB || [];
  //   const allPlayers = [...teamA_players, ...teamB_players];

  //   const playersWithMvp = allPlayers.map(p => {
  //     const pid = p._id || p;
  //     let stats = { battingMvp: 0, bowlingMvp: 0, fieldingMvp: 0, totalMvp: 0 };
  //     if (match?.mvpBreakdown) {
  //       if (typeof match.mvpBreakdown.get === 'function') {
  //         const breakdown = match.mvpBreakdown.get(String(pid));
  //         if (breakdown) stats = breakdown;
  //       } else if (match.mvpBreakdown[String(pid)]) {
  //         stats = match.mvpBreakdown[String(pid)];
  //       }
  //     }
  //     return {
  //       player: p,
  //       ...stats
  //     };
  //   }).sort((a, b) => b.totalMvp - a.totalMvp);

  //   return (
  //     <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 32 }]} refreshControl={getRefreshControl()}>
  //       <View style={styles.section}>
  //         <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
  //           <Text style={styles.sectionTitle}>🏆 MVP Leaderboard</Text>
  //           {match?.playerOfMatch && (
  //             <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#eab308', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, gap: 4 }}>
  //               <Icon name="trophy" size={14} color="#000" />
  //               <Text style={{ color: '#000', fontSize: 11, fontWeight: 'bold' }}>POM Awarded</Text>
  //             </View>
  //           )}
  //         </View>

  //         {playersWithMvp.length === 0 ? (
  //           <Text style={styles.emptyText}>No MVP data available yet.</Text>
  //         ) : (
  //           playersWithMvp.map((item, idx) => {
  //             const p = item.player;
  //             const isPom = match?.playerOfMatch && String(match.playerOfMatch._id || match.playerOfMatch) === String(p._id);
  //             const isTop = idx === 0;

  //             return (
  //               <MvpPlayerRow
  //                 key={p._id || idx}
  //                 player={p}
  //                 idx={idx}
  //                 isPom={isPom}
  //                 isTop={isTop}
  //                 item={item}
  //               />
  //             );
  //           })
  //         )}
  //       </View>
  //     </ScrollView>
  //   );
  // };

  const executeAddScorer = async () => {
    if (!newScorerMobile) {
      showCustomAlert('Error', 'Please enter a mobile number');
      return;
    }
    const res = await dispatch(addMatchScorer({ matchId: cleanMatchId, mobile: newScorerMobile }));
    if (addMatchScorer.fulfilled.match(res)) {
      showCustomAlert('Success', 'Scorer added successfully');
      setShowAddScorerModal(false);
      setNewScorerMobile('');
      dispatch(fetchLiveState(cleanMatchId));
    } else {
      showCustomAlert('Error', res.payload || 'Failed to add scorer');
    }
  };

  const submitMatchResult = async () => {
    if (resultType === 'walkover' && !winnerTeamId) {
      showCustomAlert('Error', 'Please select a winning team');
      return;
    }
    try {
      await api.put(`/matches/${cleanMatchId}/declare-result`, {
        resultType,
        winnerTeamId: resultType === 'walkover' ? winnerTeamId : undefined
      });
      showCustomAlert('Success', 'Match result declared successfully');
      setShowDeclareResultModal(false);
      dispatch(fetchLiveState(cleanMatchId));
    } catch (error) {
      showCustomAlert('Error', error.response?.data?.message || 'Failed to declare result');
    }
  };

  const executeAbandonMatch = async () => {
    if (!abandonReason) {
      showCustomAlert('Error', 'Please enter a reason for abandoning the match');
      return;
    }
    try {
      await api.put(`/matches/${cleanMatchId}/abandon`, { reason: abandonReason });
      showCustomAlert('Success', 'Match abandoned successfully');
      setShowAbandonModal(false);
      dispatch(fetchLiveState(cleanMatchId));
    } catch (error) {
      showCustomAlert('Error', error.response?.data?.message || 'Failed to abandon match');
    }
  };


  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />

      {/* ── Modern Header ── */}
      <View style={[styles.headerPrimary, { paddingTop: insets.top + 4 }]}>
        <View style={styles.headerTop}>
          <TouchableOpacity style={styles.headerBackBtn} onPress={handleBackPress} activeOpacity={0.7}>
            <Icon name="arrow-left" size={20} color="#fff" />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={styles.headerTeamVs} numberOfLines={1}>
              {match.teamA?.shortName || match.teamA?.name || 'Team A'} vs {match.teamB?.shortName || match.teamB?.name || 'Team B'}
            </Text>
            {match.status === 'scheduled' && match.scheduledAt ? (
              <Text style={styles.headerVsText} numberOfLines={1}>
                {new Date(match.scheduledAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })} • {match.tournament?.name || 'Match'}
              </Text>
            ) : match.status === 'completed' ? (
              <View style={styles.statusBadgeCompleted}>
                <Icon name="check-circle" size={10} color="#fff" style={{ marginRight: 4 }} />
                <Text style={styles.statusBadgeText}>Completed</Text>
              </View>
            ) : (match.status === 'super_over' || match.isSuperOver || liveState?.isSuperOver) ? (
              <View style={[styles.statusBadgeLive, { backgroundColor: '#7B1FA2', borderWidth: 1, borderColor: '#FFD54F', paddingHorizontal: 8 }]}>
                <Icon name="flash" size={11} color="#FFD54F" style={{ marginRight: 3 }} />
                <Text style={[styles.statusBadgeText, { color: '#FFD54F', fontWeight: 'bold' }]}>SUPER OVER</Text>
              </View>
            ) : match.status === 'in_progress' ? (
              <View style={styles.statusBadgeLive}>
                <View style={styles.liveDot} />
                <Text style={styles.statusBadgeText}>LIVE</Text>
              </View>
            ) : null}
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {isScorer && (
              <TouchableOpacity style={{ padding: 8 }} onPress={() => setShowSettingsModal(true)}>
                <Icon name="cog" size={20} color="#fff" />
              </TouchableOpacity>
            )}
            <TouchableOpacity style={{ padding: 8 }} onPress={handleShare}>
              <Icon name="share-variant" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Tab Bar */}
        <View style={styles.tabBarWrapper}>
          {renderTabHeader()}
        </View>
      </View>

      {/* Content */}
      <View style={styles.tabContentContainer}>
        {activeTab === 'Info' && renderMatchDetails()}
        {activeTab === 'Summary' && renderSummary()}
        {activeTab === 'Scorecard' && renderScorecard()}
        {activeTab === 'Comms' && renderCommentary()}
        {activeTab === 'Squads' && renderSquads()}
        {activeTab === 'Analysis' && renderAnalysis()}
        {activeTab === 'Partnerships' && renderPartnerships()}
        {activeTab === 'Leaderboard' && renderLeaderboard()}
        {/* {activeTab === 'MVP' && renderMvp()} */}
      </View>

      {/* Floating Action Bar */}
      {isScorer && match.status !== 'completed' && match.status !== 'abandoned' && match.status !== 'no_result' && (
        <View style={{
          position: 'absolute',
          bottom: insets.bottom + 16,
          left: 16,
          right: 16,
          backgroundColor: 'rgba(28, 28, 30, 0.85)',
          borderRadius: 24,
          padding: 12,
          borderWidth: 1,
          borderColor: 'rgba(255, 255, 255, 0.1)',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.5,
          shadowRadius: 16,
          elevation: 10,
        }}>
          <TouchableOpacity
            style={{
              backgroundColor: Colors.primary,
              borderRadius: 16,
              paddingVertical: 14,
              flexDirection: 'row',
              justifyContent: 'center',
              alignItems: 'center',
              shadowColor: Colors.primary,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.4,
              shadowRadius: 8,
              elevation: 6
            }}
            onPress={handleContinue}
            activeOpacity={0.85}
          >
            <Icon
              name={match.status === 'scheduled' ? 'cricket' : 'play-circle'}
              size={20}
              color="#000"
              style={{ marginRight: 8 }}
            />
            <Text style={{ color: '#000', fontFamily: Typography.fontFamily.bold, fontSize: 16 }}>
              {match.status === 'scheduled' ? 'Start Match' : 'Continue Scoring'}
            </Text>
          </TouchableOpacity>
          {match.status === 'scheduled' && (
            <TouchableOpacity
              style={{ marginTop: 12, paddingVertical: 8, alignItems: 'center' }}
              onPress={() => setDeclareResultModalVisible(true)}
            >
              <Text style={{ color: Colors.primary, fontFamily: Typography.fontFamily.semiBold }}>Declare Result (Walkover / Abandon)</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Declare Result Modal */}
      <Modal visible={declareResultModalVisible} transparent animationType="slide" onRequestClose={() => setDeclareResultModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { padding: 0 }]}>
            <View style={{ padding: 20, borderBottomWidth: 1, borderBottomColor: Colors.borderLight }}>
              <Text style={{ fontSize: 18, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary, textAlign: 'center' }}>Declare Result</Text>
            </View>
            <ScrollView style={{ maxHeight: 300, width: '100%' }}>
              <TouchableOpacity style={styles.declareResultOption} onPress={() => confirmDeclareResult('walkover', match.teamA?._id, match.teamA?.name)}>
                <Icon name="flag-checkered" size={20} color={Colors.textSecondary} style={{ marginRight: 10 }} />
                <Text style={styles.declareResultOptionText}>Walkover to {match.teamA?.name}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.declareResultOption} onPress={() => confirmDeclareResult('walkover', match.teamB?._id, match.teamB?.name)}>
                <Icon name="flag-checkered" size={20} color={Colors.textSecondary} style={{ marginRight: 10 }} />
                <Text style={styles.declareResultOptionText}>Walkover to {match.teamB?.name}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.declareResultOption} onPress={() => confirmDeclareResult('tie')}>
                <Icon name="handshake-outline" size={20} color={Colors.textSecondary} style={{ marginRight: 10 }} />
                <Text style={styles.declareResultOptionText}>Match Drawn (Tie)</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.declareResultOption, { borderBottomWidth: 0 }]} onPress={() => confirmDeclareResult('abandoned')}>
                <Icon name="close-octagon-outline" size={20} color={Colors.textSecondary} style={{ marginRight: 10 }} />
                <Text style={styles.declareResultOptionText}>Abandon Match</Text>
              </TouchableOpacity>
            </ScrollView>
            <View style={{ padding: 16, width: '100%', borderTopWidth: 1, borderTopColor: Colors.borderLight }}>
              <TouchableOpacity
                style={{ paddingVertical: 12, borderRadius: 8, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center' }}
                onPress={() => setDeclareResultModalVisible(false)}
              >
                <Text style={{ color: Colors.textSecondary, fontFamily: Typography.fontFamily.bold, fontSize: 16 }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Confirmation Modal */}
      <Modal visible={!!declareConfirmation?.visible} transparent animationType="fade" onRequestClose={() => setDeclareConfirmation(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { padding: 24 }]}>
            <Text style={{ fontSize: 20, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary, marginBottom: 12, textAlign: 'center' }}>
              {declareConfirmation?.title}
            </Text>
            <Text style={{ fontSize: 16, fontFamily: Typography.fontFamily.regular, color: Colors.textSecondary, textAlign: 'center', marginBottom: 24, lineHeight: 22 }}>
              {declareConfirmation?.message}
            </Text>
            <View style={{ flexDirection: 'row', width: '100%', gap: 12 }}>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: 14, borderRadius: 8, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center' }}
                onPress={() => setDeclareConfirmation(null)}
              >
                <Text style={{ color: Colors.textSecondary, fontFamily: Typography.fontFamily.bold, fontSize: 16 }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: 14, borderRadius: 8, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' }}
                onPress={executeDeclareResult}
              >
                <Text style={{ color: Colors.background, fontFamily: Typography.fontFamily.bold, fontSize: 16 }}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Match Settings Modal (Bottom Sheet) ── */}
      <Modal visible={showSettingsModal} animationType="slide" transparent>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowSettingsModal(false)}>
          <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' }}>
            <TouchableOpacity activeOpacity={1}>
              <View style={{
                backgroundColor: Colors.surfaceVariant,
                borderTopLeftRadius: 24, borderTopRightRadius: 24,
                paddingBottom: 32, overflow: 'hidden',
                borderTopWidth: 1, borderColor: Colors.border,
              }}>
                {/* Handle + Header */}
                <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 8 }}>
                  <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border }} />
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 16 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: `${Colors.primary}22`, alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name="cog" size={16} color={Colors.primary} />
                    </View>
                    <Text style={{ fontSize: 18, color: Colors.textPrimary, fontFamily: Typography.fontFamily.bold }}>Match Settings</Text>
                  </View>
                  <TouchableOpacity
                    style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' }}
                    onPress={() => setShowSettingsModal(false)}
                  >
                    <Icon name="close" size={16} color={Colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                {/* Divider */}
                <View style={{ height: 1, backgroundColor: Colors.border, marginHorizontal: 20, marginBottom: 16 }} />

                {/* Options */}
                <View style={{ paddingHorizontal: 16, gap: 10 }}>
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row', alignItems: 'center',
                      backgroundColor: Colors.surface, borderRadius: 14,
                      padding: 16, borderWidth: 1, borderColor: Colors.border,
                    }}
                    activeOpacity={0.7}
                    onPress={() => { setShowSettingsModal(false); setShowAddScorerModal(true); }}
                  >
                    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: `${Colors.primary}18`, alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                      <Icon name="account-plus" size={20} color={Colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: Colors.textPrimary, fontSize: 16, fontFamily: Typography.fontFamily.semiBold }}>Add Scorer</Text>
                      <Text style={{ color: Colors.textTertiary, fontSize: 12, fontFamily: Typography.fontFamily.regular, marginTop: 2 }}>Assign someone to score this match</Text>
                    </View>
                    <Icon name="chevron-right" size={18} color={Colors.textTertiary} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={{
                      flexDirection: 'row', alignItems: 'center',
                      backgroundColor: Colors.surface, borderRadius: 14,
                      padding: 16, borderWidth: 1, borderColor: Colors.border,
                    }}
                    activeOpacity={0.7}
                    onPress={() => { setShowSettingsModal(false); setShowDeclareResultModal(true); }}
                  >
                    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#D4AF3718', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                      <Icon name="trophy" size={20} color="#D4AF37" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: Colors.textPrimary, fontSize: 16, fontFamily: Typography.fontFamily.semiBold }}>Declare Result</Text>
                      <Text style={{ color: Colors.textTertiary, fontSize: 12, fontFamily: Typography.fontFamily.regular, marginTop: 2 }}>Declare winner, tie or walkover</Text>
                    </View>
                    <Icon name="chevron-right" size={18} color={Colors.textTertiary} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={{
                      flexDirection: 'row', alignItems: 'center',
                      backgroundColor: `${Colors.error}0D`, borderRadius: 14,
                      padding: 16, borderWidth: 1, borderColor: `${Colors.error}30`,
                    }}
                    activeOpacity={0.7}
                    onPress={() => { setShowSettingsModal(false); setShowAbandonModal(true); }}
                  >
                    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: `${Colors.error}20`, alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                      <Icon name="cancel" size={20} color={Colors.error} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: Colors.error, fontSize: 16, fontFamily: Typography.fontFamily.semiBold }}>Abandon Match</Text>
                      <Text style={{ color: `${Colors.error}88`, fontSize: 12, fontFamily: Typography.fontFamily.regular, marginTop: 2 }}>Cancel match due to unforeseen reasons</Text>
                    </View>
                    <Icon name="chevron-right" size={18} color={`${Colors.error}60`} />
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Add Scorer Modal ── */}
      <Modal visible={showAddScorerModal} animationType="fade" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <View style={{
            backgroundColor: Colors.surfaceVariant, borderRadius: 20,
            width: '100%', padding: 24,
            borderWidth: 1, borderColor: Colors.border,
          }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
              <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: `${Colors.primary}18`, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                <Icon name="account-plus" size={18} color={Colors.primary} />
              </View>
              <Text style={{ flex: 1, fontSize: 18, color: Colors.textPrimary, fontFamily: Typography.fontFamily.bold }}>Add Scorer</Text>
              <TouchableOpacity
                style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' }}
                onPress={() => setShowAddScorerModal(false)}
              >
                <Icon name="close" size={16} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Current scorers */}
            {match.scorers?.length > 0 && (
              <View style={{ marginBottom: 18 }}>
                <Text style={{ color: Colors.textSecondary, marginBottom: 10, fontSize: 12, fontFamily: Typography.fontFamily.semiBold, letterSpacing: 0.8, textTransform: 'uppercase' }}>Current Scorers</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {match.scorers.map((s, idx) => (
                    <View key={idx} style={{
                      flexDirection: 'row', alignItems: 'center', gap: 6,
                      backgroundColor: `${Colors.primary}14`,
                      paddingHorizontal: 12, paddingVertical: 7,
                      borderRadius: 20, borderWidth: 1, borderColor: `${Colors.primary}30`,
                    }}>
                      <Icon name="account-check" size={13} color={Colors.primary} />
                      <Text style={{ color: Colors.primary, fontSize: 13, fontFamily: Typography.fontFamily.medium }}>{s.name || s.mobile || 'Unknown'}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Divider */}
            <View style={{ height: 1, backgroundColor: Colors.border, marginBottom: 16 }} />

            {/* Input */}
            <Text style={{ color: Colors.textSecondary, marginBottom: 8, fontSize: 12, fontFamily: Typography.fontFamily.semiBold, letterSpacing: 0.8, textTransform: 'uppercase' }}>Mobile Number</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, paddingHorizontal: 14, marginBottom: 20 }}>
              <Icon name="phone" size={18} color={Colors.textTertiary} style={{ marginRight: 10 }} />
              <TextInput
                style={{ flex: 1, padding: 12, color: Colors.textPrimary, fontSize: 16, fontFamily: Typography.fontFamily.medium }}
                placeholder="10-digit mobile number"
                placeholderTextColor={Colors.textTertiary}
                keyboardType="numeric"
                maxLength={10}
                value={newScorerMobile}
                onChangeText={setNewScorerMobile}
              />
              {newScorerMobile.length === 10 && (
                <Icon name="check-circle" size={18} color="#4CAF50" />
              )}
            </View>

            {/* CTA */}
            <TouchableOpacity
              style={{
                backgroundColor: Colors.primary, paddingVertical: 15,
                borderRadius: 12, alignItems: 'center', flexDirection: 'row',
                justifyContent: 'center', gap: 8,
              }}
              onPress={executeAddScorer}
              activeOpacity={0.8}
            >
              <Icon name="account-plus" size={18} color={Colors.background} />
              <Text style={{ color: Colors.background, fontFamily: Typography.fontFamily.bold, fontSize: 15 }}>Add Scorer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Declare Result Modal ── */}
      <Modal visible={showDeclareResultModal} animationType="fade" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <View style={{
            backgroundColor: Colors.surfaceVariant, borderRadius: 20,
            width: '100%', padding: 24,
            borderWidth: 1, borderColor: Colors.border,
          }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
              <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#D4AF3718', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                <Icon name="trophy" size={18} color="#D4AF37" />
              </View>
              <Text style={{ flex: 1, fontSize: 18, color: Colors.textPrimary, fontFamily: Typography.fontFamily.bold }}>Declare Result</Text>
              <TouchableOpacity
                style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' }}
                onPress={() => setShowDeclareResultModal(false)}
              >
                <Icon name="close" size={16} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Result type toggle */}
            <Text style={{ color: Colors.textSecondary, marginBottom: 10, fontSize: 12, fontFamily: Typography.fontFamily.semiBold, letterSpacing: 0.8, textTransform: 'uppercase' }}>Result Type</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
              <TouchableOpacity
                style={{
                  flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center',
                  borderWidth: 1.5,
                  borderColor: resultType === 'walkover' ? Colors.primary : Colors.border,
                  backgroundColor: resultType === 'walkover' ? `${Colors.primary}18` : Colors.surface,
                }}
                onPress={() => setResultType('walkover')}
                activeOpacity={0.7}
              >
                {resultType === 'walkover' && <Icon name="check-circle" size={14} color={Colors.primary} style={{ marginBottom: 4 }} />}
                <Text style={{ color: resultType === 'walkover' ? Colors.primary : Colors.textSecondary, fontFamily: Typography.fontFamily.bold, fontSize: 13 }}>🏆 Winner</Text>
                <Text style={{ color: resultType === 'walkover' ? `${Colors.primary}99` : Colors.textTertiary, fontFamily: Typography.fontFamily.regular, fontSize: 11, marginTop: 2 }}>Walkover</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center',
                  borderWidth: 1.5,
                  borderColor: resultType === 'tie' ? Colors.primary : Colors.border,
                  backgroundColor: resultType === 'tie' ? `${Colors.primary}18` : Colors.surface,
                }}
                onPress={() => { setResultType('tie'); setWinnerTeamId(null); }}
                activeOpacity={0.7}
              >
                {resultType === 'tie' && <Icon name="check-circle" size={14} color={Colors.primary} style={{ marginBottom: 4 }} />}
                <Text style={{ color: resultType === 'tie' ? Colors.primary : Colors.textSecondary, fontFamily: Typography.fontFamily.bold, fontSize: 13 }}>🤝 Tie</Text>
                <Text style={{ color: resultType === 'tie' ? `${Colors.primary}99` : Colors.textTertiary, fontFamily: Typography.fontFamily.regular, fontSize: 11, marginTop: 2 }}>Draw</Text>
              </TouchableOpacity>
            </View>

            {/* Team selector */}
            {resultType === 'walkover' && (
              <View style={{ marginBottom: 20 }}>
                <Text style={{ color: Colors.textSecondary, marginBottom: 10, fontSize: 12, fontFamily: Typography.fontFamily.semiBold, letterSpacing: 0.8, textTransform: 'uppercase' }}>Select Winning Team</Text>
                <View style={{ gap: 10 }}>
                  {[{ team: match.teamA, id: match.teamA?._id }, { team: match.teamB, id: match.teamB?._id }].map(({ team, id }) => {
                    const selected = winnerTeamId === id;
                    return (
                      <TouchableOpacity
                        key={id}
                        style={{
                          flexDirection: 'row', alignItems: 'center',
                          paddingVertical: 14, paddingHorizontal: 16,
                          borderRadius: 12, borderWidth: 1.5,
                          borderColor: selected ? Colors.primary : Colors.border,
                          backgroundColor: selected ? `${Colors.primary}14` : Colors.surface,
                        }}
                        onPress={() => setWinnerTeamId(id)}
                        activeOpacity={0.7}
                      >
                        <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: selected ? `${Colors.primary}30` : Colors.background, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                          <Text style={{ fontSize: 15, fontFamily: Typography.fontFamily.bold, color: selected ? Colors.primary : Colors.textSecondary }}>{team?.shortName?.charAt(0) || team?.name?.charAt(0) || '?'}</Text>
                        </View>
                        <Text style={{ flex: 1, color: selected ? Colors.primary : Colors.textPrimary, fontFamily: selected ? Typography.fontFamily.bold : Typography.fontFamily.medium, fontSize: 15 }}>{team?.name}</Text>
                        {selected && <Icon name="check-circle" size={20} color={Colors.primary} />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Divider */}
            <View style={{ height: 1, backgroundColor: Colors.border, marginBottom: 16 }} />

            {/* CTA */}
            <TouchableOpacity
              style={{
                backgroundColor: Colors.primary, paddingVertical: 15,
                borderRadius: 12, alignItems: 'center', flexDirection: 'row',
                justifyContent: 'center', gap: 8,
              }}
              onPress={submitMatchResult}
              activeOpacity={0.8}
            >
              <Icon name="check" size={18} color={Colors.background} />
              <Text style={{ color: Colors.background, fontFamily: Typography.fontFamily.bold, fontSize: 15 }}>Confirm Result</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Abandon Match Modal ── */}
      <Modal visible={showAbandonModal} animationType="fade" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <View style={{
            backgroundColor: Colors.surfaceVariant, borderRadius: 20,
            width: '100%', padding: 24,
            borderWidth: 1, borderColor: `${Colors.error}30`,
          }}>
            {/* Warning icon */}
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: `${Colors.error}18`, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                <Icon name="alert" size={26} color={Colors.error} />
              </View>
              <Text style={{ fontSize: 18, color: Colors.error, fontFamily: Typography.fontFamily.bold }}>Abandon Match</Text>
              <Text style={{ fontSize: 13, color: Colors.textTertiary, fontFamily: Typography.fontFamily.regular, marginTop: 4, textAlign: 'center' }}>This action cannot be undone</Text>
            </View>

            {/* Divider */}
            <View style={{ height: 1, backgroundColor: `${Colors.error}25`, marginBottom: 16 }} />

            {/* Input */}
            <Text style={{ color: Colors.textSecondary, marginBottom: 8, fontSize: 12, fontFamily: Typography.fontFamily.semiBold, letterSpacing: 0.8, textTransform: 'uppercase' }}>Reason</Text>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: `${Colors.error}40`, borderRadius: 12, paddingHorizontal: 14, paddingTop: 4, marginBottom: 20 }}>
              <Icon name="text" size={16} color={Colors.textTertiary} style={{ marginTop: 14, marginRight: 10 }} />
              <TextInput
                style={{ flex: 1, paddingVertical: 12, color: Colors.textPrimary, fontSize: 15, fontFamily: Typography.fontFamily.medium }}
                placeholder="e.g. Rain, Bad Light, Player Injury"
                placeholderTextColor={Colors.textTertiary}
                value={abandonReason}
                onChangeText={setAbandonReason}
                multiline
              />
            </View>

            {/* Buttons row */}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border }}
                onPress={() => setShowAbandonModal(false)}
                activeOpacity={0.7}
              >
                <Text style={{ color: Colors.textPrimary, fontFamily: Typography.fontFamily.semiBold, fontSize: 15 }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1.5, paddingVertical: 14, borderRadius: 12, alignItems: 'center', backgroundColor: Colors.error, flexDirection: 'row', justifyContent: 'center', gap: 8 }}
                onPress={executeAbandonMatch}
                activeOpacity={0.8}
              >
                <Icon name="cancel" size={16} color="#fff" />
                <Text style={{ color: '#fff', fontFamily: Typography.fontFamily.bold, fontSize: 15 }}>Abandon</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Player Preview Modal */}
      {selectedPlayerPreview && (
        <Modal visible transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={[styles.modalAvatar, { overflow: 'hidden' }]}>
                {(selectedPlayerPreview.photo || selectedPlayerPreview.userId?.photo) ? (
                  <Image source={{ uri: getImageUrl(selectedPlayerPreview.photo || selectedPlayerPreview.userId?.photo) }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                ) : (
                  <Text style={styles.modalAvatarText}>{selectedPlayerPreview.name?.charAt(0).toUpperCase()}</Text>
                )}
              </View>
              <Text style={styles.modalPlayerName}>{selectedPlayerPreview.name}</Text>

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setSelectedPlayerPreview(null)}>
                  <Text style={styles.modalBtnTextCancel}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalBtnView} onPress={() => {
                  const pId = selectedPlayerPreview._id;
                  setSelectedPlayerPreview(null);
                  if (pId) navigation.navigate('PlayerDetail', { id: pId });
                }}>
                  <Text style={styles.modalBtnTextView}>View Profile</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Share Preview Modal */}
      <SharePreviewModal
        visible={shareModalVisible}
        onClose={() => setShareModalVisible(false)}
        title={`${liveState?.match?.teamA?.name || 'Team A'} vs ${liveState?.match?.teamB?.name || 'Team B'}`}
        shareUrl={`https://scoreverse.maazibrahimoo0.workers.dev/match/${cleanMatchId}`}
      >
        <MatchSummaryPoster liveState={liveState} />
      </SharePreviewModal>

      {/* Tag Definition Modal */}
      <Modal visible={!!selectedTagDefinition} transparent={true} animationType="fade" onRequestClose={() => setSelectedTagDefinition(null)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setSelectedTagDefinition(null)}>
          <View style={[styles.modalContent, { width: '70%', alignItems: 'center' }]}>
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.primaryAlpha20, justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
              <Icon name="tag" size={24} color={Colors.primary} />
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

      {/* Celebration Overlay */}
      {celebration && (
        <View style={[StyleSheet.absoluteFill, { zIndex: 9999, elevation: 999 }]} pointerEvents="none">
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
            <RNAnimated.Text style={{
              fontSize: celebration.type === 'won' ? 44 : 140,
              fontFamily: Typography.fontFamily.bold,
              color: celebration.color,
              textAlign: 'center',
              textShadowColor: 'rgba(0,0,0,0.8)',
              textShadowOffset: { width: 0, height: 6 },
              textShadowRadius: 15,
              transform: [{ scale: celebrationAnim }],
              paddingHorizontal: 20,
            }}>
              {celebration.text}
            </RNAnimated.Text>

            {celebration.type === 'won' && (
              <ConfettiCannon count={150} origin={{ x: SCREEN_WIDTH / 2, y: -20 }} fadeOut={true} fallSpeed={2500} colors={['#FFD700', '#FF8C00', '#FF1493', '#00BFFF', '#32CD32']} />
            )}
            {(celebration.type === 'six' || celebration.type === 'four') && (
              <ConfettiCannon count={80} origin={{ x: SCREEN_WIDTH / 2, y: -20 }} fadeOut={true} fallSpeed={3000} colors={['#FFF', celebration.color, '#FFD700']} />
            )}
          </View>
        </View>
      )}

    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  errorText: { color: Colors.textSecondary, fontFamily: Typography.fontFamily.medium, fontSize: 16 },

  // ── Header ──────────────────────────────────────────────────────────────────
  headerPrimary: {
    backgroundColor: Colors.primary,
    ...Shadows.lg,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  headerTeamVs: {
    fontSize: 15,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.background,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  headerVsText: {
    fontFamily: Typography.fontFamily.regular,
    color: 'rgba(0,0,0,0.65)',
    fontSize: 13,
  },

  // Status badges
  statusBadgeLive: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D32F2F',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 99,
    marginTop: 4,
    gap: 4,
  },
  statusBadgeCompleted: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.30)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 99,
    marginTop: 4,
    gap: 4,
  },
  statusBadgeBreak: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.warning,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 99,
    marginTop: 4,
    gap: 4,
  },
  statusBadgeText: {
    fontSize: 10,
    fontFamily: Typography.fontFamily.bold,
    color: '#fff',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FF5252',
    // pulsing would need Animated API
  },

  // ── Tab Bar ──────────────────────────────────────────────────────────────────
  tabBarWrapper: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.15)',
    marginTop: 4,
  },
  tabsRow: {
    paddingHorizontal: 12,
    paddingTop: 2,
    paddingBottom: 0,
    gap: 4,
    alignItems: 'center',
  },
  tabItem: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 10,
    alignItems: 'center',
    position: 'relative',
  },
  tabText: {
    color: 'rgba(0,0,0,0.55)',
    fontSize: 13,
    fontFamily: Typography.fontFamily.semiBold,
    letterSpacing: 0.2,
  },
  tabTextActive: {
    color: Colors.background,
    fontFamily: Typography.fontFamily.bold,
    opacity: 1,
  },
  tabActivePill: {
    position: 'absolute',
    bottom: 0,
    left: 8,
    right: 8,
    height: 3,
    borderRadius: 2,
    backgroundColor: Colors.background,
  },

  // ── Content ──────────────────────────────────────────────────────────────────
  tabContentContainer: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.base, paddingBottom: 100 },

  section: {
    backgroundColor: Colors.surfaceVariant,
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.sm,
  },
  sectionTitle: {
    color: Colors.primary,
    fontFamily: Typography.fontFamily.bold,
    fontSize: 11,
    marginBottom: 14,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },

  infoRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    alignItems: 'center',
  },
  infoLabel: { flex: 1, color: Colors.textSecondary, fontFamily: Typography.fontFamily.medium, fontSize: 13 },
  infoValue: { flex: 2, color: Colors.textPrimary, fontFamily: Typography.fontFamily.semiBold, fontSize: 13, textAlign: 'right' },

  battingTeamName: { color: Colors.textSecondary, fontFamily: Typography.fontFamily.bold, fontSize: 14, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 },
  mainScoreRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 12 },
  scoreNumber: { color: Colors.textPrimary, fontFamily: Typography.fontFamily.bold, fontSize: 38 },
  oversNumber: { color: Colors.textTertiary, fontFamily: Typography.fontFamily.medium, fontSize: 16, marginLeft: 10 },
  crrText: { color: Colors.textSecondary, fontFamily: Typography.fontFamily.semiBold, fontSize: 13 },
  tossTextPrimary: { color: Colors.primary, fontFamily: Typography.fontFamily.medium, fontSize: 13 },
  yetToStartText: { color: Colors.warning, fontFamily: Typography.fontFamily.bold, fontSize: 14, marginTop: 8 },

  tableHeaderRow: { flexDirection: 'row', paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: Colors.borderLight, marginBottom: 4 },
  tableHeaderText: { flex: 1, color: Colors.textTertiary, fontSize: 11, fontFamily: Typography.fontFamily.bold, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.5 },
  tableRow: { flexDirection: 'row', paddingVertical: 12, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  playerNameActive: { color: Colors.primary, fontSize: 14, fontFamily: Typography.fontFamily.semiBold },
  playerNameNormal: { color: Colors.textPrimary, fontSize: 14, fontFamily: Typography.fontFamily.medium },
  playerNameClickable: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontFamily: Typography.fontFamily.medium,
    // textDecorationLine: 'underline',
    textDecorationColor: 'rgba(255,255,255,0.2)',
  },
  tableRowText: { flex: 1, color: Colors.textSecondary, fontSize: 13, fontFamily: Typography.fontFamily.semiBold, textAlign: 'center' },

  // Did Not Bat chips
  dnbChip: { flexDirection: 'row', alignItems: 'center' },
  dnbChipText: { color: Colors.textSecondary, fontSize: 13, fontFamily: Typography.fontFamily.medium, textDecorationColor: 'rgba(255,255,255,0.15)' },
  dnbComma: { color: Colors.textTertiary, fontSize: 13, marginRight: 4, marginLeft: 1 },

  // Innings Break Card
  inningsBreakCard: { borderRadius: BorderRadius.lg, overflow: 'hidden', marginBottom: 12, borderWidth: 1, borderColor: Colors.warning + '50' },
  inningsBreakGradient: { padding: 20 },
  inningsBreakIconRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  inningsBreakIconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,143,0,0.15)', justifyContent: 'center', alignItems: 'center' },
  inningsBreakBadge: { backgroundColor: Colors.warning, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 99 },
  inningsBreakBadgeText: { color: '#fff', fontSize: 10, fontFamily: Typography.fontFamily.bold, letterSpacing: 1, textTransform: 'uppercase' },
  inningsBreakTitle: { color: Colors.textPrimary, fontFamily: Typography.fontFamily.bold, fontSize: 16, marginBottom: 12 },
  inningsBreakSub: { color: Colors.textSecondary, fontFamily: Typography.fontFamily.medium, fontSize: 13, marginTop: 4 },
  targetChaseRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 4 },
  targetBox: { backgroundColor: Colors.warning, borderRadius: BorderRadius.md, paddingHorizontal: 16, paddingVertical: 10, alignItems: 'center', minWidth: 70 },
  targetBoxLabel: { color: 'rgba(0,0,0,0.7)', fontSize: 9, fontFamily: Typography.fontFamily.bold, letterSpacing: 1, textTransform: 'uppercase' },
  targetBoxValue: { color: Colors.background, fontSize: 26, fontFamily: Typography.fontFamily.bold, lineHeight: 30 },
  targetChaseInfo: { flex: 1 },
  targetChaseTeam: { color: Colors.textPrimary, fontFamily: Typography.fontFamily.bold, fontSize: 14, marginBottom: 2 },
  targetChaseDesc: { color: Colors.textSecondary, fontFamily: Typography.fontFamily.medium, fontSize: 12, marginBottom: 2 },
  targetChaseRRR: { color: Colors.textTertiary, fontFamily: Typography.fontFamily.medium, fontSize: 12 },

  // Leaderboard
  awardCard: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.borderLight, gap: 12 },
  awardIconWrap: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  awardLabel: { fontSize: 10, fontFamily: Typography.fontFamily.bold, color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 },
  awardPlayerName: { fontSize: 14, fontFamily: Typography.fontFamily.semiBold, color: Colors.textPrimary },
  awardTeam: { fontSize: 11, fontFamily: Typography.fontFamily.regular, color: Colors.textTertiary, marginTop: 1 },
  awardStatBox: { alignItems: 'flex-end' },
  awardStatValue: { fontSize: 18, fontFamily: Typography.fontFamily.bold, color: Colors.primary },
  awardStatLabel: { fontSize: 10, color: Colors.textTertiary, fontFamily: Typography.fontFamily.regular, marginTop: 1 },

  lbFilterRow: { flexDirection: 'row', marginBottom: 12, backgroundColor: Colors.surfaceVariant, borderRadius: BorderRadius.md, padding: 3, borderWidth: 1, borderColor: Colors.border },
  lbFilterBtn: { flex: 1, paddingVertical: 7, alignItems: 'center', borderRadius: BorderRadius.sm },
  lbFilterBtnActive: { backgroundColor: Colors.primary },
  lbFilterText: { fontSize: 12, fontFamily: Typography.fontFamily.semiBold, color: Colors.textSecondary },
  lbFilterTextActive: { color: Colors.background, fontFamily: Typography.fontFamily.bold },

  lbRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.borderLight, gap: 10 },
  lbRank: { width: 24, fontSize: 14, fontFamily: Typography.fontFamily.bold, color: Colors.textTertiary, textAlign: 'center' },
  lbRankSm: { width: 18, fontSize: 11, fontFamily: Typography.fontFamily.medium, color: Colors.textTertiary, textAlign: 'center' },
  lbSimpleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: Colors.borderLight, gap: 8 },
  lbSimpleName: { flex: 3, fontSize: 14, fontFamily: Typography.fontFamily.medium, color: Colors.primary, textDecorationColor: 'rgba(255,255,255,0.15)' },
  lbSimpleStat: { width: 40, fontSize: 14, fontFamily: Typography.fontFamily.semiBold, color: Colors.textSecondary, textAlign: 'center' },
  lbSimplePoints: { flex: 1.5, fontSize: 14, fontFamily: Typography.fontFamily.bold, color: Colors.primary, textAlign: 'right' },
  lbAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center', overflow: 'hidden', borderWidth: 1, borderColor: Colors.border },
  lbAvatarText: { color: Colors.textSecondary, fontFamily: Typography.fontFamily.bold, fontSize: 16 },
  lbName: { fontSize: 13, fontFamily: Typography.fontFamily.semiBold, color: Colors.textPrimary },
  lbTeam: { fontSize: 11, fontFamily: Typography.fontFamily.regular, color: Colors.textTertiary, marginTop: 1 },
  lbPoints: { fontSize: 16, fontFamily: Typography.fontFamily.bold, color: Colors.primary },
  lbPointsLabel: { fontSize: 10, color: Colors.textTertiary, fontFamily: Typography.fontFamily.regular, textAlign: 'right' },

  partnershipRow: { paddingTop: 10, marginTop: 2 },
  partnershipText: { color: Colors.textTertiary, fontSize: 12, fontFamily: Typography.fontFamily.medium },

  commentaryItem: { flexDirection: 'row', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  commentaryBadge: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center', marginRight: 12, backgroundColor: Colors.surfaceVariant },
  commentaryBadgeText: { color: Colors.textPrimary, fontSize: 14, fontFamily: Typography.fontFamily.bold },
  commentaryOver: { color: Colors.textTertiary, fontSize: 12, fontFamily: Typography.fontFamily.medium, marginBottom: 2 },
  commentaryDesc: { color: Colors.textSecondary, fontSize: 14, fontFamily: Typography.fontFamily.regular },
  commentaryAction: { color: Colors.textPrimary, fontFamily: Typography.fontFamily.bold },

  squadPlayerName: { color: Colors.textPrimary, fontSize: 14, fontFamily: Typography.fontFamily.medium, paddingVertical: 6 },
  emptyText: { color: Colors.textTertiary, fontFamily: Typography.fontFamily.medium, fontSize: 14, textAlign: 'center', marginTop: 20 },

  // ── Footer ───────────────────────────────────────────────────────────────────
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: Colors.surfaceVariant,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  continueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.primary,
    ...Shadows.glow,
  },
  continueBtnText: {
    color: Colors.background,
    fontFamily: Typography.fontFamily.bold,
    fontSize: 16,
    letterSpacing: 0.3,
  },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: BorderRadius.md, backgroundColor: Colors.surfaceVariant, justifyContent: 'center', alignItems: 'center' },
  cancelBtnText: { color: Colors.textPrimary, fontFamily: Typography.fontFamily.bold, fontSize: 16 },
  spectatorBtn: { flex: 2, paddingVertical: 14, borderRadius: BorderRadius.md, backgroundColor: Colors.secondary, justifyContent: 'center', alignItems: 'center' },
  spectatorBtnText: { color: '#FFF', fontFamily: Typography.fontFamily.bold, fontSize: 16 },

  // ── Modals ───────────────────────────────────────────────────────────────────
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: Colors.surfaceVariant, borderRadius: BorderRadius.xl, padding: 24, width: '80%', alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  declareResultOption: { flexDirection: 'row', justifyContent: 'flex-start', paddingVertical: 16, paddingHorizontal: 24, borderBottomWidth: 1, borderBottomColor: Colors.borderLight, alignItems: 'center', width: '100%' },
  declareResultOptionText: { fontSize: 16, fontFamily: Typography.fontFamily.medium, color: Colors.textPrimary },
  modalAvatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center', marginBottom: 16, borderWidth: 2, borderColor: Colors.primary },
  modalAvatarText: { color: Colors.primary, fontSize: 32, fontFamily: Typography.fontFamily.bold },
  modalPlayerName: { color: Colors.textPrimary, fontSize: 20, fontFamily: Typography.fontFamily.bold, marginBottom: 24, textAlign: 'center' },
  modalActions: { flexDirection: 'row', width: '100%', gap: 12 },
  modalBtnCancel: { flex: 1, paddingVertical: 13, borderRadius: BorderRadius.md, backgroundColor: Colors.surface, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  modalBtnTextCancel: { color: Colors.textPrimary, fontFamily: Typography.fontFamily.semiBold, fontSize: 14 },
  modalBtnView: { flex: 1, paddingVertical: 13, borderRadius: BorderRadius.md, backgroundColor: Colors.primary, alignItems: 'center' },
  modalBtnTextView: { color: Colors.background, fontFamily: Typography.fontFamily.bold, fontSize: 14 },
});

export default MatchSummaryScreen;
