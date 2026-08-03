import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated, Dimensions, Alert, Modal, TextInput, Image, ImageBackground, FlatList, BackHandler, Share, ActivityIndicator } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from '../../../components/SolidGradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useDispatch, useSelector } from 'react-redux';
import { scoreBall, undoBall, fetchLiveState, addMatchScorer, setInitialPlayers, setLiveState } from '../matchSlice';
import api, { BASE_URL, getImageUrl } from '../../../api/axios';
import socketService from '../../../services/socketService';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../../theme/theme';
import { showCustomAlert } from '../../../components/CustomAlert';
import GoldenSpinner from '../../../components/GoldenSpinner';
import SharePreviewModal from '../../tournament/components/SharePreviewModal';
import { MatchSummaryPoster } from '../../tournament/components/PosterTemplates';



const { width } = Dimensions.get('window');
const SCREEN_WIDTH = Dimensions.get('window').width;

const globalAlwaysSkipWagonWheel = {};

const LiveScorerScreen = ({ navigation, route }) => {
  const matchIdRaw = route.params?.matchId || route.params?.id || route.params?.match?._id || route.params?.match;
  const cleanMatchId = socketService.cleanId(matchIdRaw);
  const matchId = cleanMatchId;
  const dispatch = useDispatch();
  const { liveState, isLoading } = useSelector((state) => state.match);
  const [isFinishing, setIsFinishing] = useState(false);

  // Scoring Modal/Drawer states
  const [showExtrasPanel, setShowExtrasPanel] = useState(null);
  const [extraWicketToggle, setExtraWicketToggle] = useState(false);
  const [pendingExtraOpts, setPendingExtraOpts] = useState(null);
  const [pendingExtraScore, setPendingExtraScore] = useState(0);
  const [advWicketRuns, setAdvWicketRuns] = useState(0);
  const [showWicketPanel, setShowWicketPanel] = useState(false);
  const [showFiveSevenModal, setShowFiveSevenModal] = useState(false);
  const [fiveSevenRuns, setFiveSevenRuns] = useState(5);

  // Wagon Wheel states
  const [showWagonWheelModal, setShowWagonWheelModal] = useState(false);
  const [wagonWheelData, setWagonWheelData] = useState(null); // { angle, distance, color }
  const [alwaysSkipWagonWheel, setAlwaysSkipWagonWheelState] = useState(globalAlwaysSkipWagonWheel[cleanMatchId] || false);

  const setAlwaysSkipWagonWheel = (val) => {
    globalAlwaysSkipWagonWheel[cleanMatchId] = val;
    setAlwaysSkipWagonWheelState(val);
  };
  
  const [pendingScoreOptions, setPendingScoreOptions] = useState(null);
  const [pendingRuns, setPendingRuns] = useState(0);

  // Scorer Modal
  const [showAddScorerModal, setShowAddScorerModal] = useState(false);
  const [newScorerMobile, setNewScorerMobile] = useState('');
  const [scorerSearchResult, setScorerSearchResult] = useState(null);
  const [isScorerSearching, setIsScorerSearching] = useState(false);

  const handleSearchScorer = async (mobArg) => {
    const searchMob = typeof mobArg === 'string' && mobArg.length === 10 ? mobArg : newScorerMobile;
    if (!searchMob || searchMob.length < 10) return;
    setIsScorerSearching(true);
    setScorerSearchResult(null);
    try {
      const res = await api.get(`/users/lookup/${searchMob}`);
      setScorerSearchResult(res.data.data);
    } catch (e) {
      showCustomAlert('Error', 'Failed to search player');
    } finally {
      setIsScorerSearching(false);
    }
  };

  const [scorerTab, setScorerTab] = useState('teamA'); // 'teamA' | 'teamB' | 'search'
  const [scorerAddingId, setScorerAddingId] = useState(null); // tracks loading per player
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showPenaltyModal, setShowPenaltyModal] = useState(false);
  const [penaltyRuns, setPenaltyRuns] = useState('5');
  const [penaltyTeam, setPenaltyTeam] = useState('batting');
  const [showReviseModal, setShowReviseModal] = useState(false);
  const [revisedOvers, setRevisedOvers] = useState('');
  const [revisedTarget, setRevisedTarget] = useState('');
  const [showAbandonModal, setShowAbandonModal] = useState(false);
  const [abandonReason, setAbandonReason] = useState('');
  const [showStrikeModal, setShowStrikeModal] = useState(false);

  // Current User
  const currentUser = useSelector(state => state.auth.user);

  // Wicket flow state
  const [wicketType, setWicketType] = useState(null);
  const [showInningsModal, setShowInningsModal] = useState(false);


  // Advanced Wicket State
  const [showAdvancedWicketModal, setShowAdvancedWicketModal] = useState(false);
  const [advWicketType, setAdvWicketType] = useState(null);
  const [dismissedBatter, setDismissedBatter] = useState(null);
  const [primaryFielder, setPrimaryFielder] = useState(null);
  const [secondaryFielder, setSecondaryFielder] = useState(null);
  const [fielderSelectionMode, setFielderSelectionMode] = useState(null);

  // Track visual position of batters (left vs right)
  const [leftBatterId, setLeftBatterId] = useState(liveState?.striker?._id || liveState?.striker || null);
  const [rightBatterId, setRightBatterId] = useState(liveState?.nonStriker?._id || liveState?.nonStriker || null);

  // Navigation lock — prevents duplicate navigation calls when liveState fires rapidly
  const navLockRef = useRef(false);

  // Scoring lock — prevents multiple rapid taps on scoring buttons
  const [isScoring, setIsScoring] = useState(false);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const scoringLockRef = useRef(false);

  // Socket.io for Realtime updates
  const lastScoredAtRef = useRef(0); // timestamp of last ball scored — used to debounce socket overwrites

  useEffect(() => {
    if (!cleanMatchId) return;

    socketService.remoteLog('LiveScorerScreen', `Joined Match Room: match_${cleanMatchId}`);
    socketService.joinMatch(cleanMatchId);

    const handleScoreUpdate = (data) => {
      if (!data || !data.match) {
        socketService.remoteLog('LiveScorerScreen', 'Socket Score Update Ignored: No match data');
        return;
      }

      const updateMatchId = socketService.cleanId(data?.match?._id || data?.matchId || data);
      const activeCleanId = socketService.cleanId(cleanMatchId);
      if (activeCleanId && updateMatchId && activeCleanId !== updateMatchId) return;

      // Skip socket updates for 1.5 seconds after we score to protect our optimistic UI
      const msSinceScore = Date.now() - lastScoredAtRef.current;
      if (msSinceScore < 1500) {
        socketService.remoteLog('LiveScorerScreen', 'Socket Update Skipped (optimistic state active)');
        return;
      }

      // If user has already selected a bowler for the new over, ignore lagging over-completion socket events
      if (liveState?.bowler && !liveState?.needsBowler && data?.needsBowler && !data?.bowler) {
        socketService.remoteLog('LiveScorerScreen', 'Socket Update Ignored: Stale over-completion event');
        return;
      }

      const runs = data?.score?.runs ?? data?.teamAScore?.runs ?? 0;
      const wickets = data?.score?.wickets ?? data?.teamAScore?.wickets ?? 0;
      const overs = data?.score?.overs ?? data?.teamAScore?.overs ?? '0.0';

      socketService.remoteLog('LiveScorerScreen', `Socket Score Update Received | Score: ${runs}/${wickets} (${overs} Ov)`, { matchId: updateMatchId });
      dispatch(setLiveState(data));
    };

    const unsubscribeScore = socketService.onScoreUpdate(handleScoreUpdate);
    dispatch(fetchLiveState(cleanMatchId));

    const unsubscribeFocus = navigation.addListener('focus', () => {
      console.log(`⚡ [Frontend Scorer] Re-joining Match Room on focus: match_${cleanMatchId}`);
      socketService.joinMatch(cleanMatchId);
      if (!route.params?.skipFocusFetch) {
        dispatch(fetchLiveState(cleanMatchId));
      } else {
        navigation.setParams({ skipFocusFetch: false });
      }
    });

    return () => {
      unsubscribeFocus();
      unsubscribeScore();
      socketService.leaveMatch(cleanMatchId);
    };
  }, [dispatch, cleanMatchId, navigation]);

  // Reset nav lock every time this screen comes into focus (e.g. after returning from player selection)
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (route.params?.skipAutoBowler) {
        navLockRef.current = true;
        navigation.setParams({ skipAutoBowler: false });
      } else {
        navLockRef.current = false;
      }
    });
    return unsubscribe;
  }, [navigation, route.params?.skipAutoBowler]);

  // Self-correcting reset: release nav lock when active bowler/batters are successfully set
  useEffect(() => {
    if (liveState && !liveState.needsBowler && liveState.bowler && liveState.striker && liveState.nonStriker) {
      navLockRef.current = false;
    }
  }, [liveState?.needsBowler, liveState?.bowler, liveState?.striker, liveState?.nonStriker]);

  useEffect(() => {
    if (route.params?.isAmbiguousStrike) {
      setShowStrikeModal(true);
      navigation.setParams({ isAmbiguousStrike: false });
    }
  }, [route.params?.isAmbiguousStrike]);

  useEffect(() => {
    if (route.params?.initialAction && typeof handleSettingsAction === 'function') {
      // Defer execution slightly to ensure LiveScorerScreen is mounted
      setTimeout(() => {
        handleSettingsAction(route.params.initialAction);
      }, 500);
    }
  }, [route.params?.initialAction]);


  const handleBackPress = () => {
    navigation.navigate('MatchSummary', { matchId });
    return true;
  };

  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      handleBackPress
    );

    return () => backHandler.remove();
  }, [navigation]);

  const creatorId = typeof liveState?.match?.creator === 'object' ? liveState?.match?.creator?._id : liveState?.match?.creator;
  const isCreator = String(creatorId) === String(currentUser?._id);

  const isMatchActive = useMemo(
    () => !['completed', 'abandoned'].includes(liveState?.match?.status),
    [liveState?.match?.status]
  );

  const isScorer = useMemo(() => {
    const creator = typeof liveState?.match?.creator === 'object'
      ? liveState?.match?.creator?._id
      : liveState?.match?.creator;
    const creatorMatch = String(creator) === String(currentUser?._id);
    const scorerMatch = liveState?.match?.scorers?.some(s => {
      const sId = typeof s === 'object' ? s?._id : s;
      return String(sId) === String(currentUser?._id);
    });
    
    // Check tournament organizers/scorers
    const t = liveState?.match?.tournament;
    let tournamentScorer = false;
    if (t) {
      const isOrganizer = typeof t.organizer === 'object' ? String(t.organizer?._id) === String(currentUser?._id) : String(t.organizer) === String(currentUser?._id);
      const isCoOrganizer = t.coOrganizers?.some(c => (typeof c === 'object' ? String(c?._id) : String(c)) === String(currentUser?._id));
      const isTScorer = t.scorers?.some(s => (typeof s === 'object' ? String(s?._id) : String(s)) === String(currentUser?._id));
      tournamentScorer = isOrganizer || isCoOrganizer || isTScorer;
    }

    return (creatorMatch || scorerMatch || tournamentScorer) && (!['completed', 'abandoned'].includes(liveState?.match?.status) || isFinishing);
  }, [liveState?.match?.creator, liveState?.match?.scorers, liveState?.match?.status, liveState?.match?.tournament, currentUser?._id, isFinishing]);

  const getLocalMatchSummary = (completedReason) => {
    if (match?.result?.summary) return match.result.summary;
    if (!liveState || !match) return '';
    const teamAScore = liveState.teamAScore || { runs: 0, wickets: 0 };
    const teamBScore = liveState.teamBScore || { runs: 0, wickets: 0 };

    const normalizeId = (id) => typeof id === 'object' && id !== null ? (id._id || id).toString() : (id || '').toString();
    const teamAId = normalizeId(match.teamA._id);
    const teamBId = normalizeId(match.teamB._id);
    const maxWickets = match.wickets || 10;
    const dlsSuffix = liveState.isDlsTarget ? ' (DLS Method)' : '';
    const fallbackStr = `Reason: ${completedReason === 'all_out' ? 'All Out' : completedReason === 'overs_completed' ? 'Overs Completed' : completedReason === 'target_achieved' ? 'Target Achieved' : 'Completed'}`;

    const inningsList = liveState.innings || [];
    const isSuperOver = liveState.inningsNumber >= 3;

    // For Super Over: use innings 3 & 4 batting order and their actual scores
    if (isSuperOver) {
      const soInn1 = inningsList.find(i => i.inningsNumber === 3);
      const soInn2 = inningsList.find(i => i.inningsNumber === 4);
      if (!soInn1) return fallbackStr;

      const soFirstTeamId = normalizeId(soInn1.battingTeam);
      const soFirstTeamName = soFirstTeamId === teamAId ? match.teamA.name : match.teamB.name;
      const soSecondTeamName = soFirstTeamId === teamAId ? match.teamB.name : match.teamA.name;
      const soFirstScore = soInn1.totalRuns || 0;
      const soSecondScore = soInn2 ? (soInn2.totalRuns || 0) : (
        // If inn4 not saved yet, use live score of whichever team is currently batting
        soFirstTeamId === teamAId ? teamBScore.runs : teamAScore.runs
      );
      const soSecondWickets = soInn2 ? (soInn2.totalWickets || 0) : (
        soFirstTeamId === teamAId ? teamBScore.wickets : teamAScore.wickets
      );

      const soTarget = liveState.target || (soFirstScore + 1);
      if (soSecondScore >= soTarget) {
        const margin = maxWickets - soSecondWickets;
        return `${soSecondTeamName} won by ${margin} wicket${margin !== 1 ? 's' : ''} (Super Over)`;
      } else if (soSecondScore === soTarget - 1) {
        return 'Match Tied (Super Over)';
      } else {
        const margin = soTarget - 1 - soSecondScore;
        return `${soFirstTeamName} won by ${margin} run${margin !== 1 ? 's' : ''} (Super Over)`;
      }
    }

    // Normal match: use toss to determine who batted first
    let firstInningsBattingTeamId = null;
    if (match.toss && match.toss.winner) {
      const winnerId = typeof match.toss.winner === 'object' ? match.toss.winner._id : match.toss.winner;
      if (match.toss.choice === 'bat') {
        firstInningsBattingTeamId = winnerId;
      } else {
        firstInningsBattingTeamId = winnerId.toString() === teamAId ? match.teamB._id : match.teamA._id;
      }
    } else {
      const firstInnings = inningsList.find(i => i.inningsNumber === 1);
      if (firstInnings) firstInningsBattingTeamId = firstInnings.battingTeam;
    }

    if (!firstInningsBattingTeamId) return fallbackStr;

    const firstBattedId = normalizeId(firstInningsBattingTeamId);
    const teamABattedFirst = firstBattedId === teamAId;

    const scoreFirst = teamABattedFirst ? teamAScore : teamBScore;
    const scoreSecond = teamABattedFirst ? teamBScore : teamAScore;
    const firstTeamName = teamABattedFirst ? match.teamA.name : match.teamB.name;
    const secondTeamName = teamABattedFirst ? match.teamB.name : match.teamA.name;

    const target = liveState.target || (scoreFirst.runs + 1);

    if (scoreSecond.runs >= target) {
      const margin = maxWickets - scoreSecond.wickets;
      return `${secondTeamName} won by ${margin} wicket${margin !== 1 ? 's' : ''}${dlsSuffix}`;
    } else if (scoreSecond.runs === target - 1) {
      return `Match Tied${dlsSuffix}`;
    } else {
      const margin = target - 1 - scoreSecond.runs;
      return `${firstTeamName} won by ${margin} run${margin !== 1 ? 's' : ''}${dlsSuffix}`;
    }
  };

  useEffect(() => {
    if (!liveState) return;
    // Prevent rapid repeated navigations
    if (navLockRef.current) return;

    const { isInningsComplete, isMatchComplete } = liveState;

    // 1. Innings break — navigate to player selection ONLY if players haven't been set yet.
    //    If striker + nonStriker + bowler are already set, scoring has started and we should
    //    NOT re-navigate even if match.status hasn't flipped to 'in_progress' in DB yet
    //    (race window between set_players socket and buildLiveState DB re-fetch).
    if (liveState.match?.status === 'innings_break') {
      const allPlayersSet = liveState.striker && liveState.nonStriker && liveState.bowler;
      if (isScorer && !allPlayersSet) {
        navLockRef.current = true;
        navigation.navigate('MatchPlayerSelection', { matchId });
      }
    } else if (liveState.match?.status === 'in_progress') {
      // 2. Innings/Match complete — stay on live screen, show End Innings / Match Complete UI.
      //    DO NOT navigate to batter selection or bowler selection.
      if (isInningsComplete || isMatchComplete) {
        return;
      }

      const needsBatter = (!liveState.striker || !liveState.nonStriker);
      const hasOneBatter = liveState.striker || liveState.nonStriker;
      const isSingleWicketValid = liveState.match?.isSingleWicketBatting && hasOneBatter;

      if (needsBatter && !isSingleWicketValid) {
        if (isScorer) {
          navLockRef.current = true;
          const lastBall = liveState.ballEvent;
          let isAmbiguousStrike = false;
          if (lastBall && lastBall.wicket) {
            const wType = lastBall.wicket.type;
            if (['run_out', 'cheating', 'obstructing_field', 'retired_hurt', 'retired_out'].includes(wType)) {
              isAmbiguousStrike = true;
            }
          }
          setTimeout(() => {
            navigation.navigate('MatchPlayerSelection', { matchId, isAmbiguousStrike });
          }, 50);
        }
      } else if (liveState.needsBowler && !liveState.bowler && !needsBatter && liveState.score?.overs === '0.0') {
        if (isScorer) {
          navLockRef.current = true;
          setTimeout(() => {
            navigation.navigate('SelectBowler', { matchId });
          }, 50);
        }
      }
    }
  }, [liveState?.match?.status, liveState?.striker, liveState?.nonStriker, liveState?.needsBowler, liveState?.bowler, liveState?.isInningsComplete, liveState?.isMatchComplete, isScorer, matchId, navigation]);

  const submitPenaltyRuns = async () => {
    try {
      await api.post(`/matches/${matchId}/penalty`, {
        runs: Number(penaltyRuns),
        team: penaltyTeam // 'batting' or 'fielding'
      });
      setShowPenaltyModal(false);
      dispatch(fetchLiveState(matchId));
      showCustomAlert('Success', `${penaltyRuns} penalty runs added`);
    } catch (e) {
      showCustomAlert('Error', 'Failed to add penalty runs');
    }
  };

  const submitReviseMatch = async () => {
    try {
      await api.post(`/matches/${matchId}/revise`, {
        revisedOvers: Number(revisedOvers)
      });
      setShowReviseModal(false);
      dispatch(fetchLiveState(matchId));
      showCustomAlert('Success', 'Match revised successfully');
    } catch (e) {
      showCustomAlert('Error', 'Failed to revise match');
    }
  };

  if (!liveState) {
    return <View style={styles.container}><Text style={styles.loading}>Loading match...</Text></View>;
  }

  const {
    score,
    match,
    striker,
    strikerStats,
    nonStriker,
    nonStrikerStats,
    bowler,
    previousBowler,
    bowlerStats,
    currentOverBalls,
    requiredRunRate,
    toWin,
    ballsRemaining,
    dlsParScore,
    isDlsTarget,
    isInningsComplete,
    isMatchComplete,
    completedReason
  } = liveState;
  const needsBatter = !striker || !nonStriker;
  const isSingleWicketValid = match?.isSingleWicketBatting && (striker || nonStriker);
  const batterNeeded = needsBatter && !isSingleWicketValid;

  useEffect(() => {
    if (!striker && !nonStriker) {
      setLeftBatterId(null);
      setRightBatterId(null);
      return;
    }

    const sId = striker?._id || striker;
    const nsId = nonStriker?._id || nonStriker;

    if (!leftBatterId && !rightBatterId) {
      setLeftBatterId(sId);
      setRightBatterId(nsId);
    } else {
      const activeIds = [sId, nsId].filter(Boolean);
      const isLeftOnField = activeIds.includes(leftBatterId);
      const isRightOnField = activeIds.includes(rightBatterId);

      if (!isLeftOnField && isRightOnField) {
        // Left batter left the field (dismissed), replace with new batter
        const newBatterId = activeIds.find(id => id !== rightBatterId);
        setLeftBatterId(newBatterId);
      } else if (isLeftOnField && !isRightOnField) {
        // Right batter left the field, replace with new batter
        const newBatterId = activeIds.find(id => id !== leftBatterId);
        setRightBatterId(newBatterId);
      } else if (!isLeftOnField && !isRightOnField) {
        // Both left (e.g. innings transition or both new), reset
        setLeftBatterId(sId);
        setRightBatterId(nsId);
      }
    }
  }, [striker, nonStriker, leftBatterId, rightBatterId]);

  const handleWicketSelect = (type) => {
    const extraOpts = pendingExtraOpts || {};
    const baseScore = pendingExtraScore || 0;
    const finalOpts = { ...extraOpts, isWicket: true, wicketType: type };

    if (['bowled', 'lbw', 'hit_wicket', 'timed_out'].includes(type)) {
      handleScore(baseScore, finalOpts);
      setShowWicketPanel(false);
      setPendingExtraOpts(null);
      setPendingExtraScore(0);
    } else if (type === 'caught_and_bowled') {
      finalOpts.fielderId = liveState.bowler?._id;
      handleScore(baseScore, finalOpts);
      setShowWicketPanel(false);
      setPendingExtraOpts(null);
      setPendingExtraScore(0);
    } else {
      setAdvWicketType(type);
      setDismissedBatter(liveState.striker?._id);

      // Prefill wicket keeper for stumped
      if (type === 'stumped') {
        const match = liveState.match;
        const isTeamABatting = String(liveState.battingTeam?._id || liveState.battingTeam) === String(match.teamA?._id || match.teamA);
        const wk = isTeamABatting ? match.wicketKeeper?.teamB : match.wicketKeeper?.teamA;
        setPrimaryFielder(wk || null);
      } else {
        setPrimaryFielder(null);
      }

      setSecondaryFielder(null);
      setShowWicketPanel(false);
      setShowAdvancedWicketModal(true);
    }
  };

  const submitAdvancedWicket = () => {
    if (advWicketType === 'run_out' && (!dismissedBatter || !primaryFielder)) {
      return showCustomAlert('Error', 'Please select dismissed batter and primary fielder');
    }
    if (['caught', 'stumped'].includes(advWicketType) && !primaryFielder) {
      return showCustomAlert('Error', 'Please select the fielder');
    }
    if (['obstructing_field', 'cheating', 'retired_hurt', 'retired_out'].includes(advWicketType) && !dismissedBatter) {
      return showCustomAlert('Error', 'Please select the dismissed batter');
    }

    const extraOpts = pendingExtraOpts || {};
    // If it's an extra, we already captured baseScore. If it's a normal run out, use advWicketRuns.
    const baseScore = pendingExtraOpts ? pendingExtraScore : advWicketRuns;

    handleScore(baseScore, {
      ...extraOpts,
      isWicket: true,
      wicketType: advWicketType,
      dismissedBatsmanId: dismissedBatter,
      fielderId: primaryFielder,
      fielder2Id: secondaryFielder,
    });
    setShowAdvancedWicketModal(false);
    setPendingExtraOpts(null);
    setPendingExtraScore(0);
  };

  const handleAddScorer = async () => {
    if (!scorerSearchResult?.exists) {
      showCustomAlert('Error', 'Please search for a valid user first');
      return;
    }
    if (!newScorerMobile) {
      showCustomAlert('Error', 'Please enter a mobile number');
      return;
    }
    const res = await dispatch(addMatchScorer({ matchId, mobile: newScorerMobile }));
    if (addMatchScorer.fulfilled.match(res)) {
      showCustomAlert('Success', 'Scorer added successfully');
      setShowAddScorerModal(false);
      setNewScorerMobile('');
    } else {
      showCustomAlert('Error', res.payload);
    }
  };

  const handleAddScorerFromPlayer = async (player) => {
    const mobile = player?.userId?.mobile || player?.mobile;
    if (!mobile) {
      showCustomAlert('Error', 'This player has no mobile number on record.');
      return;
    }
    setScorerAddingId(player._id || player.userId?._id);
    try {
      const res = await dispatch(addMatchScorer({ matchId, mobile }));
      if (addMatchScorer.fulfilled.match(res)) {
        showCustomAlert('Success', `${player.name || player.userId?.name || 'Player'} added as scorer!`);
        dispatch(fetchLiveState(matchId));
      } else {
        showCustomAlert('Error', res.payload || 'Could not add scorer');
      }
    } finally {
      setScorerAddingId(null);
    }
  };

  const executeSettingsAction = async (action, extraParam) => {
    try {
      if (action === 'end_innings' || action === 'declare_innings') {
        setIsFinishing(true);
        const reason = action === 'declare_innings' ? 'declared' : (liveState?.completedReason || 'overs_completed');
        await api.put(`/matches/${matchId}/end-innings`, { reason });
        const res = await dispatch(fetchLiveState(matchId)).unwrap();

        if (isMatchComplete || res?.isMatchComplete) {
          showCustomAlert('Success', 'Match completed successfully');
          navigation.reset({
            index: 1,
            routes: [
              { name: 'MyCricketMain' },
              { name: 'MatchSummary', params: { matchId } }
            ]
          });
        } else {
          setIsFinishing(false);
          showCustomAlert('Success', 'Innings completed');
        }
      } else if (action === 'abandon') {
        setIsFinishing(true);
        await api.put(`/matches/${matchId}/abandon`, { reason: extraParam });
        dispatch(fetchLiveState(matchId));
        showCustomAlert('Success', 'Match abandoned');
        navigation.reset({
          index: 0,
          routes: [{ name: 'MyCricketMain' }]
        });
      } else if (action === 'declare_dls') {
        setIsFinishing(true);
        await api.put(`/matches/${matchId}/declare-dls`);
        const res = await dispatch(fetchLiveState(matchId)).unwrap();
        showCustomAlert('Success', res?.completedReason ? 'Match ended (DLS Method)' : 'Match ended (DLS Method)');
        navigation.reset({
          index: 1,
          routes: [
            { name: 'MyCricketMain' },
            { name: 'MatchSummary', params: { matchId } }
          ]
        });
      } else if (action === 'toggle_single_wicket') {
        const newValue = !match?.isSingleWicketBatting;
        await api.put(`/matches/${matchId}/settings`, { isSingleWicketBatting: newValue });
        dispatch(fetchLiveState(matchId));
        showCustomAlert('Success', `Single Wicket Batting ${newValue ? 'Enabled' : 'Disabled'}`);
      } else if (action === 'view_scoreboard') {
        navigation.navigate('MatchSummary', { matchId: match._id, initialTab: 'Scorecard' });
      } else if (action === 'add_scorer') {
        setShowAddScorerModal(true);
      } else if (action === 'super_over') {
        await api.post(`/matches/${matchId}/super-over`);
        dispatch(fetchLiveState(matchId));
        showCustomAlert('Success', 'Super Over started!');
      }
    } catch (e) {
      setIsFinishing(false);
      showCustomAlert('Error', e.response?.data?.message || 'Failed to update settings');
    }
  };

  const handleRotateStrikePress = (tappedBatterId = null, tappedStats = null) => {
    if (!isScorer) return;
    if (!striker || !nonStriker) return;

    const options = [
      {
        text: 'One Short',
        onPress: () => performStrikeSwap('One Short'),
      },
      {
        text: 'Overthrow',
        onPress: () => performStrikeSwap('Overthrow'),
      },
      {
        text: 'Manual Swap',
        onPress: () => performStrikeSwap('Manual Swap'),
      },
    ];

    if (tappedBatterId && tappedStats && tappedStats.balls === 0) {
      const isStriker = (tappedBatterId === striker?._id || tappedBatterId === striker);
      const tappedPlayer = isStriker ? striker : nonStriker;
      if (tappedPlayer) {
        options.unshift({
          text: `Change Batter (${tappedPlayer.name || 'Unknown'})`,
          style: 'destructive',
          onPress: () => {
            showCustomAlert(
              'Change Batter',
              `Are you sure you want to change ${tappedPlayer.name || 'this batter'}?`,
              [
                { text: 'Cancel', style: 'cancel' },
                { 
                  text: 'Change', 
                  style: 'destructive', 
                  onPress: () => {
                    const payload = { matchId };
                    if (isStriker) payload.striker = null;
                    else payload.nonStriker = null;
                    
                    socketService.getSocket()?.emit('set_players', payload);
                    
                    if (liveState) {
                      dispatch(setLiveState({
                        ...liveState,
                        striker: isStriker ? null : striker,
                        nonStriker: isStriker ? nonStriker : null
                      }));
                    }
                  }
                }
              ]
            );
          }
        });
      }
    }

    options.push({
      text: 'Cancel',
      style: 'cancel',
    });

    showCustomAlert(
      'Batting Action',
      'Select action:',
      options
    );
  };

  const performStrikeSwap = async (reason) => {
    if (!striker || !nonStriker) return;

    // Instant 0ms Optimistic UI Update
    if (liveState) {
      dispatch(setLiveState({
        ...liveState,
        striker: nonStriker,
        strikerStats: nonStrikerStats,
        nonStriker: striker,
        nonStrikerStats: strikerStats,
      }));
    }

    try {
      await api.post(`/matches/${matchId}/set-players`, {
        striker: nonStriker._id || nonStriker,
        nonStriker: striker._id || striker,
        bowler: bowler?._id || bowler,
      });
    } catch (e) {
      dispatch(fetchLiveState(matchId));
      showCustomAlert('Error', e.response?.data?.message || 'Failed to change strike');
    }
  };

  const handleSelectStrike = async (selectedPlayerId) => {
    setShowStrikeModal(false);
    const currentStrikerId = striker?._id || striker;
    if (selectedPlayerId !== currentStrikerId && striker && nonStriker) {
      // Instant 0ms Optimistic UI Update
      if (liveState) {
        dispatch(setLiveState({
          ...liveState,
          striker: nonStriker,
          strikerStats: nonStrikerStats,
          nonStriker: striker,
          nonStrikerStats: strikerStats,
        }));
      }

      try {
        await api.post(`/matches/${matchId}/set-players`, {
          striker: nonStriker?._id || nonStriker,
          nonStriker: striker?._id || striker,
          bowler: bowler?._id || bowler,
        });
      } catch (e) {
        dispatch(fetchLiveState(matchId));
        showCustomAlert('Error', e.response?.data?.message || 'Failed to change strike');
      }
    }
  };

  const handleSettingsAction = async (action) => {
    if (!action) return;
    
    // Check if initialAction triggered this
    if (route.params?.initialAction) {
      navigation.setParams({ initialAction: null });
    }

    setShowSettingsModal(false);
    
    if (action === 'view_scoreboard') {
      navigation.navigate('MatchSummary', { matchId, initialTab: 'Scorecard' });
    } else if (action === 'add_scorer') {
      setShowAddScorerModal(true);
    } else if (action === 'toggle_single_wicket') {
      try {
        await api.put(`/matches/${matchId}/settings`, {
          isSingleWicketBatting: !match.isSingleWicketBatting
        });
        dispatch(fetchLiveState(matchId));
      } catch (err) {
        showCustomAlert('Error', 'Failed to toggle single wicket batting');
      }
    } else if (action === 'add_penalty_runs') {
      setShowPenaltyModal(true);
    } else if (action === 'revise_overs') {
      setRevisedOvers(String(match?.overs || ''));
      setRevisedTarget('');
      setShowReviseModal(true);
    } else if (action === 'retired_hurt') {
      const sName = liveState?.striker?.name || 'Striker';
      const nsName = liveState?.nonStriker?.name || 'Non-Striker';
      showCustomAlert(
        'Retired Hurt',
        'Who is retiring hurt?',
        [
          { text: sName, onPress: () => handleScore(0, { isWicket: true, wicketType: 'retired_hurt', dismissedBatsmanId: liveState?.striker?._id }) },
          { text: nsName, onPress: () => handleScore(0, { isWicket: true, wicketType: 'retired_hurt', dismissedBatsmanId: liveState?.nonStriker?._id }) },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
    } else if (action === 'declare_innings') {
      showCustomAlert(
        'Declare Innings',
        'Are you sure you want to declare this innings?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Declare', style: 'destructive', onPress: () => executeSettingsAction('declare_innings') }
        ]
      );
    } else if (action === 'end_innings') {
      showCustomAlert(
        'End Innings Manually',
        'Are you sure you want to end this innings manually?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'End Innings', style: 'destructive', onPress: () => executeSettingsAction('end_innings') }
        ]
      );
    } else if (action === 'declare_dls') {
      const minDlsBalls = Math.min(30, Math.ceil((match?.overs || 20) / 4) * 6);
      const minDlsOvers = minDlsBalls / 6;
      let winText = `Are you sure you want to end the match now and declare a winner using the DLS method? (Requires min ${minDlsOvers} overs bowled)`;
      if (liveState?.dlsParScore !== null && liveState?.dlsParScore !== undefined && liveState?.score?.runs !== undefined) {
        const battingTeamName = liveState.battingTeam === match.teamA._id ? match.teamA.name : match.teamB.name;
        const fieldingTeamName = liveState.battingTeam === match.teamA._id ? match.teamB.name : match.teamA.name;
        
        let expectedWinner = '';
        if (liveState.score.runs > liveState.dlsParScore) {
          expectedWinner = `${battingTeamName} will win.`;
        } else if (liveState.score.runs < liveState.dlsParScore) {
          expectedWinner = `${fieldingTeamName} will win.`;
        } else {
          expectedWinner = 'The match will be tied.';
        }
        winText = `Current DLS Par is ${liveState.dlsParScore}. ${expectedWinner}\n\nAre you sure you want to declare this result? (Requires min ${minDlsOvers} overs)`;
      }

      showCustomAlert(
        'Declare Winner (DLS)',
        winText,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Declare Winner', style: 'destructive', onPress: () => executeSettingsAction('declare_dls') }
        ]
      );
    } else if (action === 'abandon') {
      setAbandonReason('');
      setShowAbandonModal(true);
    } else if (action === 'toggle_single_wicket') {
      const isEnabled = liveState?.match?.isSingleWicketBatting;
      showCustomAlert(
        'Toggle Single Wicket',
        `Are you sure you want to ${isEnabled ? 'disable' : 'enable'} single wicket batting?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: isEnabled ? 'Disable' : 'Enable', onPress: () => executeSettingsAction('toggle_single_wicket') }
        ]
      );
    } else if (action === 'retired_hurt') {
      const sName = liveState?.striker?.name || 'Striker';
      const nsName = liveState?.nonStriker?.name || 'Non-Striker';
      showCustomAlert(
        'Retired Hurt',
        'Who is retiring hurt?',
        [
          { text: sName, onPress: () => handleScore(0, { isWicket: true, wicketType: 'retired_hurt', dismissedBatsmanId: liveState?.striker?._id }) },
          { text: nsName, onPress: () => handleScore(0, { isWicket: true, wicketType: 'retired_hurt', dismissedBatsmanId: liveState?.nonStriker?._id }) },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
    } else {
      executeSettingsAction(action);
    }
  };

  const submitAbandon = async () => {
    if (!abandonReason) return showCustomAlert('Error', 'Please enter a reason');
    try {
      await api.put(`/matches/${matchId}/abandon`, { reason: abandonReason });
      setShowAbandonModal(false);
      dispatch(fetchLiveState(matchId));
      showCustomAlert('Success', 'Match abandoned');
      navigation.goBack();
    } catch (e) {
      showCustomAlert('Error', 'Failed to abandon match');
    }
  };

  const handleUndoBall = () => {
    if (scoringLockRef.current) return;
    const currentBalls = liveState?.currentOverBalls || [];
    const isNewOverWithNoBalls = currentBalls.length === 0 && liveState?.bowler && !liveState?.needsBowler;

    const isFirstOverOfInnings = parseFloat(liveState?.score?.overs || 0) === 0;
    const alertTitle = isNewOverWithNoBalls ? "Unselect Bowler" : "Undo Ball";
    const alertMsg = isNewOverWithNoBalls 
      ? (isFirstOverOfInnings
          ? "No balls bowled in this match yet. Do you want to unselect the opening bowler?"
          : "No balls bowled in this over yet. Unselect current bowler and return to previous over?") 
      : "Are you sure you want to undo the last ball?";
    const confirmBtnText = isNewOverWithNoBalls ? "Unselect Bowler" : "Undo";

    showCustomAlert(
      alertTitle,
      alertMsg,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: confirmBtnText,
          style: "destructive",
          onPress: async () => {
            if (scoringLockRef.current) return;
            scoringLockRef.current = true;

            const socket = socketService.getSocket();

            if (isNewOverWithNoBalls) {
              try {
                navLockRef.current = true;
                socket.emit('change_bowler', { matchId, bowlerId: null });
                dispatch(setLiveState({
                  ...liveState,
                  bowler: null,
                  needsBowler: true
                }));
              } catch (err) {
                console.log('Error unsetting bowler:', err);
              } finally {
                scoringLockRef.current = false;
              }
              return;
            }

            if (liveState) {
              let deductedRuns = 0;
              let isWicket = false;
              let poppedBalls = currentBalls;

              if (currentBalls.length > 0) {
                const lastOverBall = currentBalls[currentBalls.length - 1];
                poppedBalls = currentBalls.slice(0, currentBalls.length - 1);
                deductedRuns = lastOverBall.runs || 0;
                isWicket = lastOverBall.type === 'wicket' || lastOverBall.display === 'W';
              }
              
              let newOvers = parseFloat(liveState.score?.overs || 0);
              if (currentBalls.length > 0) {
                const lastOverBall = currentBalls[currentBalls.length - 1];
                if (lastOverBall.type !== 'wide' && lastOverBall.type !== 'noball') {
                  let overWhole = Math.floor(newOvers);
                  let overBalls = Math.round((newOvers - overWhole) * 10);
                  overBalls--;
                  if (overBalls < 0) {
                    overWhole = Math.max(0, overWhole - 1);
                    overBalls = 5;
                  }
                  newOvers = overWhole + (overBalls / 10);
                }
              }

              dispatch(setLiveState({
                ...liveState,
                score: {
                  ...liveState.score,
                  runs: Math.max(0, (liveState.score?.runs || 0) - deductedRuns),
                  wickets: Math.max(0, (liveState.score?.wickets || 0) - (isWicket ? 1 : 0)),
                  overs: newOvers.toFixed(1)
                },
                currentOverBalls: poppedBalls
              }));
            }
            
            socket.emit('undo_ball', { matchId });
            setTimeout(() => {
              scoringLockRef.current = false;
            }, 50);
          }
        }
      ]
    );
  };

  const handleScore = async (runs, options = {}) => {
    if (!liveState?.match) return;
    // Prevent multiple rapid taps — ignore if a scoring action is already in progress
    if (scoringLockRef.current) return;
    scoringLockRef.current = true;

    // Wagon Wheel Interception Logic: trigger for 1, 2, 3, 4, 6 runs on normal deliveries
    const isExtra = options.isWide || options.isNoBall || options.isBye || options.isLegBye;
    const isWagonWheelEligible = [1, 2, 3, 4, 6].includes(runs) && !isExtra;

    if (isWagonWheelEligible && !options.wagonWheelResolved && !alwaysSkipWagonWheel) {
      setWagonWheelData(null); // reset previous selection
      setPendingRuns(runs);
      setPendingScoreOptions(options);
      setShowWagonWheelModal(true);
      scoringLockRef.current = false; // release lock — modal handles submission
      return;
    }
    
    if (options.isWicket && !options.singleWicketResolved) {
      const currentWickets = liveState.score?.wickets || 0;
      const matchWickets = match.wickets || 10;
      
      if (currentWickets + 1 === matchWickets - 1 && !match.isSingleWicketBatting) {
        showCustomAlert(
          'Last Wicket Alert',
          'This is the second-to-last wicket. Do you want to enable Single Wicket Batting for the remaining batsman, or declare All Out?',
          [
            { text: 'Bring New Batsman', style: 'cancel', onPress: () => handleScore(runs, { ...options, singleWicketResolved: true }) },
            { text: 'All Out', style: 'destructive', onPress: async () => {
                try {
                  const payload = {
                    batsmanRuns: runs,
                    batsmanId: liveState.striker?._id || liveState.striker,
                    nonStrikerId: liveState.nonStriker?._id || liveState.nonStriker,
                    bowlerId: liveState.bowler?._id || liveState.bowler,
                    isWide: options.isWide || false,
                    isNoBall: options.isNoBall || false,
                    isBye: options.isBye || false,
                    isLegBye: options.isLegBye || false,
                    isWicket: options.isWicket || false,
                    wicketType: options.wicketType || null,
                    dismissedBatsmanId: options.dismissedBatsmanId || null,
                    fielderId: options.fielderId || null,
                    fielder2Id: options.fielder2Id || null,
                    extraRuns: options.extraRuns || 0,
                    runReason: options.runReason || null,
                    wagonWheel: options.wagonWheel || null,
                  };
                  await dispatch(scoreBall({ matchId, ballData: payload })).unwrap();
                  await api.put(`/matches/${matchId}/end-innings`, { reason: 'declared' });
                  dispatch(fetchLiveState(matchId));
                } catch (e) {
                  showCustomAlert('Error', 'Could not record all out');
                } finally {
                  scoringLockRef.current = false;
                }
            }},
            { text: 'Single Wicket Batting', onPress: async () => {
                await api.put(`/matches/${matchId}/settings`, { isSingleWicketBatting: true });
                handleScore(runs, { ...options, singleWicketResolved: true });
            }}
          ]
        );
        scoringLockRef.current = false; // release — alert dialog takes over
        return;
      }
    }

    try {
      const payload = {
        batsmanRuns: runs,
        batsmanId: liveState.striker?._id || liveState.striker,
        nonStrikerId: liveState.nonStriker?._id || liveState.nonStriker,
        bowlerId: liveState.bowler?._id || liveState.bowler,
        isWide: options.isWide || false,
        isNoBall: options.isNoBall || false,
        isBye: options.isBye || false,
        isLegBye: options.isLegBye || false,
        isWicket: options.isWicket || false,
        wicketType: options.wicketType || null,
        dismissedBatsmanId: options.dismissedBatsmanId || null,
        fielderId: options.fielderId || null,
        fielder2Id: options.fielder2Id || null,
        extraRuns: options.extraRuns || 0,
        runReason: options.runReason || null,
        wagonWheel: options.wagonWheel || null,
      };

      socketService.remoteLog('LiveScorerScreen', 'Score Submitted', payload);

      // Optimistic UI Update (Instant 0ms Scorer Feedback)
      if (liveState) {
        const addedRuns = runs + (options.extraRuns || 0) + ((options.isWide || options.isNoBall) ? 1 : 0);
        const currentRuns = liveState.score?.runs || 0;
        const currentWickets = (liveState.score?.wickets || 0) + (options.isWicket ? 1 : 0);
        
        let currentOvers = parseFloat(liveState.score?.overs || 0);

        // Optimistic ball creation
        const optimisticBallType = options.isWicket ? 'wicket' : options.isWide ? 'wide' : options.isNoBall ? 'noball' : options.isBye ? 'bye' : options.isLegBye ? 'legbye' : 'normal';
        let optimisticBallDisplay = runs === 0 ? '.' : runs.toString();
        if (options.isWicket) optimisticBallDisplay = 'W';
        else if (options.isWide) optimisticBallDisplay = (runs + 1) + 'Wd';
        else if (options.isNoBall) optimisticBallDisplay = (runs + 1) + 'Nb';
        else if (options.isBye) optimisticBallDisplay = runs + 'B';
        else if (options.isLegBye) optimisticBallDisplay = runs + 'Lb';

        const optimisticBall = {
          runs: runs + (options.extraRuns || 0) + ((options.isWide || options.isNoBall) ? 1 : 0),
          type: optimisticBallType,
          display: optimisticBallDisplay
        };
        const newCurrentOverBalls = [...(liveState.currentOverBalls || []), optimisticBall];

        let isOptimisticOverComplete = false;
        if (!options.isWide && !options.isNoBall) {
          let overWhole = Math.floor(currentOvers);
          let overBalls = Math.round((currentOvers - overWhole) * 10);
          overBalls++;
          if (overBalls >= 6) {
             overWhole++;
             overBalls = 0;
             isOptimisticOverComplete = true;
          }
          currentOvers = overWhole + (overBalls / 10);
        }

        // 1. Optimistic stats updates FIRST
        let newStrikerStats = { ...(liveState.strikerStats || { runs: 0, balls: 0, fours: 0, sixes: 0 }) };
        let newBowlerStats = { ...(liveState.bowlerStats || { balls: 0, runs: 0, wickets: 0 }) };
        
        if (!options.isWide && !options.isNoBall && !options.isBye && !options.isLegBye) {
           newStrikerStats.runs = (newStrikerStats.runs || 0) + runs;
           newStrikerStats.balls = (newStrikerStats.balls || 0) + 1;
           if (runs === 4) newStrikerStats.fours = (newStrikerStats.fours || 0) + 1;
           if (runs === 6) newStrikerStats.sixes = (newStrikerStats.sixes || 0) + 1;
        } else if (!options.isWide) {
           newStrikerStats.balls = (newStrikerStats.balls || 0) + 1;
        }

        if (!options.isWide && !options.isNoBall) {
           newBowlerStats.balls = (newBowlerStats.balls || 0) + 1;
        }
        newBowlerStats.runs = (newBowlerStats.runs || 0) + runs + (options.extraRuns || 0) + ((options.isWide || options.isNoBall) ? 1 : 0);
        if (options.isWicket && options.wicketType !== 'run_out' && options.wicketType !== 'retired_hurt') {
           newBowlerStats.wickets = (newBowlerStats.wickets || 0) + 1;
        }

        // 2. Strike rotation calculation SECOND
        const creditedToBatsman = !options.isWide && !options.isBye && !options.isLegBye ? runs : 0;
        const shouldRotateStrike = !options.isWide && !options.isNoBall && (creditedToBatsman % 2 === 1);
        
        let nextStriker = liveState.striker;
        let nextStrikerStats = newStrikerStats;
        let nextNonStriker = liveState.nonStriker;
        let nextNonStrikerStats = liveState.nonStrikerStats || { runs: 0, balls: 0, fours: 0, sixes: 0 };

        if (shouldRotateStrike) {
          nextStriker = liveState.nonStriker;
          nextStrikerStats = liveState.nonStrikerStats || { runs: 0, balls: 0, fours: 0, sixes: 0 };
          nextNonStriker = liveState.striker;
          nextNonStrikerStats = newStrikerStats;
        }

        if (isOptimisticOverComplete) {
          // On over complete, rotate strike again for next over
          const tempS = nextStriker;
          const tempSStats = nextStrikerStats;
          nextStriker = nextNonStriker;
          nextStrikerStats = nextNonStrikerStats;
          nextNonStriker = tempS;
          nextNonStrikerStats = tempSStats;
        }

        // Optimistically clear the dismissed batsman immediately
        if (options.isWicket) {
          const dismissedId = options.dismissedBatsmanId || liveState.striker?._id || liveState.striker;
          if (String(nextStriker?._id || nextStriker) === String(dismissedId)) {
            nextStriker = null;
            nextStrikerStats = null;
          } else if (String(nextNonStriker?._id || nextNonStriker) === String(dismissedId)) {
            nextNonStriker = null;
            nextNonStrikerStats = null;
          }
        }

        const optimisticState = {
          ...liveState,
          score: {
            ...liveState.score,
            runs: currentRuns + addedRuns,
            wickets: currentWickets,
            overs: currentOvers.toFixed(1)
          },
          currentOverBalls: newCurrentOverBalls,
          striker: nextStriker,
          strikerStats: nextStrikerStats,
          nonStriker: nextNonStriker,
          nonStrikerStats: nextNonStrikerStats,
          bowlerStats: newBowlerStats,
          ...(isOptimisticOverComplete ? {
            needsBowler: true,
            previousBowler: liveState.bowler,
          } : {})
        };
        dispatch(setLiveState(optimisticState));
      }

      // Emit via Socket.IO instead of slow HTTP API call
      lastScoredAtRef.current = Date.now(); // stamp so socket knows we just scored
      const socket = socketService.getSocket();
      socket.emit('ball_event', { matchId: cleanMatchId, ballData: payload });

      // Release scoring lock quickly to keep UI responsive
      setTimeout(() => {
        scoringLockRef.current = false;
        setIsScoring(false);
      }, 50);
    } catch (e) {
      showCustomAlert('Error', e.message);
      scoringLockRef.current = false;
    }
  };

  const renderOverTimeline = () => {
    return (
      <View style={styles.overTimeline}>
        <Text style={styles.overTimelineLabel}>This Over:</Text>
        <KeyboardAwareScrollView enableOnAndroid={true} extraScrollHeight={20} keyboardShouldPersistTaps="handled" horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.timelineScroll}>
          {currentOverBalls?.map((ball, i) => {
            const isWicket = ball.type === 'wicket' || ball.display === 'W';
            const isFour = ball.runs === 4;
            const isSix = ball.runs === 6;
            const isZero = ball.runs === 0 && !isWicket;

            return (
              <View key={i} style={[
                styles.ballCircle,
                isWicket && styles.ballWicket,
                isFour && { backgroundColor: '#4CAF50', borderColor: '#4CAF50' },
                isSix && { backgroundColor: '#2196F3', borderColor: '#2196F3' },
                isZero && { backgroundColor: Colors.surfaceVariant, borderColor: Colors.border }
              ]}>
                <Text style={[styles.ballText, (isWicket || isFour || isSix) && { color: '#FFF' }, isZero && { color: Colors.textSecondary }]}>{ball.display}</Text>
              </View>
            );
          })}
        </KeyboardAwareScrollView>
      </View>
    );
  };

  const handleShare = () => {
    setShareModalVisible(true);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {isScoring && (
        <View style={[StyleSheet.absoluteFill, { zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' }]}>
           <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      )}
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBackPress} style={styles.headerBackBtn}>
          <Icon name="arrow-left" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>Match Score</Text>
          <View style={styles.headerLiveBadge}>
            <View style={styles.headerLiveDot} />
            <Text style={styles.headerLiveText}>LIVE</Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={handleShare} style={styles.headerActionBtn}>
            <Icon name="share-variant" size={20} color={Colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowSettingsModal(true)} style={[styles.headerActionBtn, { backgroundColor: Colors.primaryAlpha20 }]}>
            <Icon name="cog" size={20} color={Colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <KeyboardAwareScrollView enableOnAndroid={true} extraScrollHeight={20} keyboardShouldPersistTaps="handled" style={styles.content} showsVerticalScrollIndicator={false}>
        {/* ── Score Board ── */}
        {useMemo(() => (
          <View style={styles.scoreBoard}>
            {/* Team Names Row */}
            <View style={styles.teamsRow}>
              <Text
                style={[styles.teamLabel, liveState?.battingTeam === match?.teamA?._id && styles.teamLabelActive]}
                numberOfLines={1}
              >
                {match?.teamA?.name}
              </Text>
              <View style={styles.vsChip}>
                <Text style={styles.vsText}>VS</Text>
              </View>
              <Text
                style={[styles.teamLabel, styles.teamLabelRight, liveState?.battingTeam === match?.teamB?._id && styles.teamLabelActive]}
                numberOfLines={1}
              >
                {match?.teamB?.name}
              </Text>
            </View>
  
            {/* Divider */}
            <View style={styles.scoreBoardDivider} />
  
            {/* Main Score */}
            <View style={styles.mainScore}>
              <Text style={styles.runs}>{score?.runs || 0}</Text>
              <View style={styles.scoreRight}>
                <Text style={styles.wickets}>/{score?.wickets || 0}</Text>
                <Text style={styles.oversText}>{score?.overs || '0.0'} / {liveState?.inningsNumber >= 3 ? 1 : match?.overs} ov</Text>
              </View>
            </View>
  
            {/* Innings 1: CRR */}
            {liveState?.inningsNumber % 2 !== 0 ? (
              <View style={styles.statsPill}>
                <Text style={styles.statsPillText}>
                  {(() => {
                    const overStr = String(score?.overs || '0.0');
                    const [o, b] = overStr.split('.');
                    const totalBalls = parseInt(o || 0) * 6 + parseInt(b || 0);
                    const crr = totalBalls > 0 ? ((score?.runs || 0) / totalBalls) * 6 : 0;
                    return `CRR  ${crr.toFixed(2)}`;
                  })()}
                </Text>
              </View>
            ) : null}
  
            {/* Innings 2: Chase banner */}
            {liveState?.inningsNumber % 2 === 0 && requiredRunRate ? (
              <View style={styles.chaseBanner}>
                {toWin <= 0 ? (
                  <Text style={styles.chaseMainText}>Target Reached</Text>
                ) : (
                  <Text style={styles.chaseMainText}>
                    Need{' '}
                    <Text style={styles.chaseHighlight}>{toWin}</Text>
                    {' '}runs from{' '}
                    <Text style={styles.chaseHighlight}>{ballsRemaining}</Text>
                    {' '}balls
                    {isDlsTarget ? <Text style={styles.dlsTag}> · DLS</Text> : null}
                  </Text>
                )}
                <Text style={styles.chaseSubText}>
                  Target {(score?.runs || 0) + toWin}{toWin > 0 ? `   ·   RRR ${requiredRunRate}` : ''}
                </Text>
                {dlsParScore !== null && dlsParScore > 0 ? (() => {
                  const isAhead = score?.runs > dlsParScore;
                  const isBehind = score?.runs < dlsParScore;
                  const battingTeamName = liveState.battingTeam === match.teamA._id ? match.teamA.name : match.teamB.name;
                  const fieldingTeamName = liveState.battingTeam === match.teamA._id ? match.teamB.name : match.teamA.name;
                  const safeTeam = isAhead ? battingTeamName : (isBehind ? fieldingTeamName : 'None');

                  return (
                    <View style={[styles.dlsParRow, { backgroundColor: isAhead ? 'rgba(34,197,94,0.12)' : isBehind ? 'rgba(239,68,68,0.12)' : 'rgba(148,163,184,0.12)' }]}>
                      <Text style={styles.dlsParLabel}>DLS Par Score: </Text>
                      <Text style={styles.dlsParValue}>{dlsParScore}</Text>
                      <Text style={[styles.dlsParStatus, { color: isAhead ? '#22c55e' : isBehind ? '#ef4444' : Colors.textSecondary }]}>
                        {isAhead ? `  ✓ Ahead (${safeTeam} is safe)` : isBehind ? `  ✗ Behind (${safeTeam} is safe)` : '  = On Par'}
                      </Text>
                    </View>
                  );
                })() : null}
              </View>
            ) : null}
          </View>
        ), [match, liveState?.battingTeam, liveState?.inningsNumber, score?.runs, score?.wickets, score?.overs, requiredRunRate, toWin, ballsRemaining, isDlsTarget, dlsParScore])}

        {/* ── Players Context ── */}
        <View style={styles.playersGrid}>
          {(() => {
            const sId = striker?._id || striker;
            const nsId = nonStriker?._id || nonStriker;

            const leftPlayer = (leftBatterId === sId) ? striker : (leftBatterId === nsId) ? nonStriker : null;
            const leftPlayerStats = (leftBatterId === sId) ? strikerStats : (leftBatterId === nsId) ? nonStrikerStats : null;
            const isLeftStriker = leftBatterId && leftBatterId === sId;

            const rightPlayer = (rightBatterId === sId) ? striker : (rightBatterId === nsId) ? nonStriker : null;
            const rightPlayerStats = (rightBatterId === sId) ? strikerStats : (rightBatterId === nsId) ? nonStrikerStats : null;
            const isRightStriker = rightBatterId && rightBatterId === sId;

            return (
              <View style={{ width: '100%' }}>
                <View style={styles.playersGridHeader}>
                  <Icon name="cricket" size={12} color={Colors.textTertiary} />
                  <Text style={styles.playersGridHeaderText}>Batting</Text>
                </View>
                <View style={[styles.playerRowBordered, { borderBottomWidth: 0, padding: 0 }]}>
                  {leftBatterId ? (
                  <TouchableOpacity
                    style={[
                      styles.playerStatsCol,
                      isLeftStriker && styles.strikerHighlightCol,
                      !rightBatterId && { borderTopRightRadius: 8, borderBottomRightRadius: 8, borderTopLeftRadius: 8, borderBottomLeftRadius: 8, borderRightWidth: 0 }
                    ]}
                    onPress={() => handleRotateStrikePress(leftBatterId, leftPlayerStats)}
                    disabled={!isScorer}
                  >
                    <View style={styles.playerNameRow}>
                      {isLeftStriker ? <Icon key="left-striker-bat-icon" name="cricket" size={13} color={Colors.primary} style={{ marginRight: 3 }} /> : null}
                      <Text key="left-striker-name-text" style={[
                        styles.playerName,
                        isLeftStriker && styles.strikerName,
                      ]} numberOfLines={1}>
                        {leftPlayer?.name || 'Striker'}
                      </Text>
                      {leftPlayerStats?.balls === 0 && (
                        <Icon name="account-switch" size={14} color={Colors.primary} style={{ marginLeft: 6, opacity: 0.8 }} />
                      )}
                    </View>
                    <Text style={[
                      styles.playerScore,
                      isLeftStriker && { color: Colors.primary }
                    ]}>
                      {leftPlayerStats?.runs || 0}<Text style={styles.playerScoreBalls}>({leftPlayerStats?.balls || 0})</Text>
                    </Text>
                  </TouchableOpacity>
                  ) : null}

                  {leftBatterId && rightBatterId ? <View style={styles.playerStatsColDivider} /> : null}

                  {rightBatterId ? (
                  <TouchableOpacity
                    style={[
                      styles.playerStatsCol,
                      isRightStriker && styles.strikerHighlightCol,
                      isRightStriker && { borderTopRightRadius: 8, borderBottomRightRadius: 8, borderTopLeftRadius: 0, borderBottomLeftRadius: 0 },
                      !leftBatterId && { borderTopRightRadius: 8, borderBottomRightRadius: 8, borderTopLeftRadius: 8, borderBottomLeftRadius: 8, borderLeftWidth: 0 }
                    ]}
                    onPress={() => handleRotateStrikePress(rightBatterId, rightPlayerStats)}
                    disabled={!isScorer}
                  >
                    <View style={styles.playerNameRow}>
                      {isRightStriker ? <Icon key="right-striker-bat-icon" name="cricket" size={13} color={Colors.primary} style={{ marginRight: 3 }} /> : null}
                      <Text key="right-striker-name-text" style={[
                        styles.playerName,
                        isRightStriker && styles.strikerName,
                      ]} numberOfLines={1}>
                        {rightPlayer?.name || 'Non-Striker'}
                      </Text>
                      {rightPlayerStats?.balls === 0 && (
                        <Icon name="account-switch" size={14} color={Colors.primary} style={{ marginLeft: 6, opacity: 0.8 }} />
                      )}
                    </View>
                    <Text style={[
                      styles.playerScore,
                      isRightStriker && { color: Colors.primary }
                    ]}>
                      {rightPlayerStats?.runs || 0}<Text style={styles.playerScoreBalls}>({rightPlayerStats?.balls || 0})</Text>
                    </Text>
                  </TouchableOpacity>
                  ) : null}
                </View>

                <View style={styles.playerRowDividerLine} />

                {/* Bowling Table */}
                <View style={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4 }}>
                  {/* Column Headers */}
                  <View style={styles.bowlingTableHeader}>
                    <Text style={[styles.bowlingTableHeaderCell, { flex: 1, textAlign: 'left' }]}>Bowler</Text>
                    <Text style={styles.bowlingTableHeaderCell}>W-R</Text>
                    <Text style={styles.bowlingTableHeaderCell}>Overs</Text>
                    <Text style={styles.bowlingTableHeaderCell}>Econ</Text>
                    {isScorer && (!currentOverBalls || currentOverBalls.length === 0) ? <View style={{ width: 16 }} /> : null}
                  </View>
                  {/* Bowler Data Row */}
                  {(() => {
                    const displayBowler = bowler || previousBowler || liveState?.previousBowler;
                    return (
                      <TouchableOpacity
                        style={styles.bowlingTableRow}
                        onPress={() => isScorer && navigation.navigate('SelectBowler', { matchId })}
                        disabled={!isScorer || (currentOverBalls && currentOverBalls.length > 0)}
                      >
                        <Text style={[styles.bowlingTableName, { flex: 1 }]} numberOfLines={1}>
                          {displayBowler?.name || 'Select Bowler'}
                        </Text>
                        <Text style={styles.bowlingTableCell}>
                          {bowlerStats?.wickets || 0}-{bowlerStats?.runs || 0}
                        </Text>
                        <Text style={styles.bowlingTableCell}>
                          {bowlerStats ? `${bowlerStats.overs}.${bowlerStats.balls}` : '0.0'}
                        </Text>
                        <Text style={styles.bowlingTableCell}>
                          {(() => {
                            if (!bowlerStats) return '0.00';
                            const balls = (bowlerStats.overs * 6) + (bowlerStats.balls || 0);
                            return balls > 0 ? ((bowlerStats.runs / balls) * 6).toFixed(2) : '0.00';
                          })()}
                        </Text>
                        {isScorer && (!currentOverBalls || currentOverBalls.length === 0) ? <Icon name="chevron-right" size={16} color={Colors.textTertiary} /> : null}
                      </TouchableOpacity>
                    );
                  })()}
                </View>
              </View>
            );
          })()}
        </View>

        {renderOverTimeline()}

        {!isScorer ? (
          <View style={styles.readOnlyContainer}>
            <Icon name="shield-lock-outline" size={32} color={Colors.textTertiary} />
            <Text style={styles.readOnlyText}>You are viewing this match as a spectator.</Text>
            <TouchableOpacity style={styles.actionBtnPrimary} onPress={() => navigation.navigate('MatchSummary', { matchId: match._id, initialTab: 'Scorecard' })}>
              <Text style={[styles.actionBtnText, styles.textDark]}>Full Scorecard</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </KeyboardAwareScrollView>

      {isScorer ? (
        <>
          {/* Scoring Keypad */}
          {isInningsComplete || isMatchComplete ? (
            <View style={[styles.keypad, { padding: Spacing.lg }]}>
              <Text style={styles.inningsCompleteTitle}>
                {isMatchComplete ? 'Match Complete' : 'Innings Complete'}
              </Text>
              <Text style={styles.inningsCompleteSubtitle}>
                {isMatchComplete ? getLocalMatchSummary(completedReason) : `Reason: ${completedReason === 'all_out' ? 'All Out' : completedReason === 'overs_completed' ? 'Overs Completed' : completedReason === 'target_achieved' ? 'Target Achieved' : 'Completed'}`}
              </Text>

              {isMatchComplete && getLocalMatchSummary(completedReason).startsWith('Match Tied') ? (
                <View style={{ gap: Spacing.sm }}>
                  <Text style={styles.tiedText}>Scores are Tied!</Text>
                  <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
                    <TouchableOpacity
                      style={[styles.keypadActionBtn, styles.keypadActionBtnSecondary, { flex: 1, height: 44 }]}
                      onPress={() => {
                        showCustomAlert(
                          "Undo Last Ball",
                          "Are you sure you want to undo?",
                          [
                            { text: "Cancel", style: "cancel" },
                            { text: "Undo", style: "destructive", onPress: () => dispatch(undoBall(matchId)) }
                          ]
                        );
                      }}
                    >
                      <Text style={styles.keypadActionBtnSecondaryText}>UNDO BALL</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.keypadActionBtn, { flex: 1, height: 44, backgroundColor: Colors.error }]}
                      onPress={() => executeSettingsAction('end_innings')}
                    >
                      <Text style={styles.keypadActionBtnText}>END (DRAW)</Text>
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity
                    style={[styles.keypadActionBtn, { backgroundColor: Colors.accent, height: 50 }]}
                    onPress={() => executeSettingsAction('super_over')}
                  >
                    <Text style={[styles.keypadActionBtnText, { fontSize: 16 }]}>⚡ SUPER OVER</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
                  <TouchableOpacity
                    style={[styles.keypadActionBtn, styles.keypadActionBtnSecondary, { flex: 1, height: 50 }]}
                    onPress={() => {
                      showCustomAlert(
                        "Undo Ball",
                        "Are you sure you want to undo the last ball?",
                        [
                          { text: "Cancel", style: "cancel" },
                          { text: "Undo", style: "destructive", onPress: () => dispatch(undoBall(matchId)) }
                        ]
                      );
                    }}
                  >
                    <Text style={styles.keypadActionBtnSecondaryText}>UNDO LAST</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.keypadActionBtn, { flex: 1, height: 50, backgroundColor: Colors.accent }]}
                    onPress={() => {
                      showCustomAlert(
                        isMatchComplete ? "End Match" : "End Innings",
                        isMatchComplete ? "Are you sure you want to complete this match?" : "Are you sure you want to complete this innings?",
                        [
                          { text: "Cancel", style: "cancel" },
                          { text: isMatchComplete ? "End Match" : "End Innings", onPress: () => executeSettingsAction('end_innings') }
                        ]
                      );
                    }}
                  >
                    <Text style={styles.keypadActionBtnText}>
                      {isMatchComplete ? 'END MATCH' : 'END INNINGS'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ) : (liveState?.needsBowler || !bowler) && !batterNeeded ? (
            <View style={styles.needsBowlerCard}>
              <View style={styles.needsBowlerIconRow}>
                <Icon name="cricket" size={28} color={Colors.primary} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.needsBowlerTitle}>Over Completed</Text>
                  <Text style={styles.needsBowlerSub}>Select bowler for next over or undo previous ball</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 10, width: '100%' }}>
                <TouchableOpacity
                  style={[styles.keypadActionBtnSecondary, { flex: 1, height: 48, borderRadius: 8, justifyContent: 'center', alignItems: 'center' }]}
                  onPress={handleUndoBall}
                  activeOpacity={0.8}
                >
                  <Text style={styles.keypadActionBtnSecondaryText}>UNDO LAST</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.selectBowlerBtnAction, { flex: 2, height: 48 }]}
                  onPress={() => navigation.navigate('SelectBowler', { matchId })}
                  activeOpacity={0.8}
                >
                  <Icon name="account-plus" size={20} color="#000" />
                  <Text style={styles.selectBowlerBtnActionText}>SELECT BOWLER</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.keypad}>
              {/* Row 1: 0 1 2 3 UNDO */}
              <View style={styles.keypadRow}>
                {[0, 1, 2, 3].map(n => (
                  <TouchableOpacity key={n} style={styles.scoreBtn} onPress={() => handleScore(n)} activeOpacity={0.7}>
                    <Text style={styles.scoreBtnText}>{n}</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity style={styles.scoreBtnUndo} onPress={handleUndoBall} activeOpacity={0.7}>
                  <Text style={styles.scoreBtnUndoText}>UNDO</Text>
                </TouchableOpacity>
              </View>

              {/* Row 2: 4 6 5/7 OUT */}
              <View style={styles.keypadRow}>
                <TouchableOpacity style={[styles.scoreBtn, styles.scoreBtnFour]} onPress={() => handleScore(4)} activeOpacity={0.7}>
                  <Text style={[styles.scoreBtnText, styles.scoreBtnBoundaryText]}>4</Text>
                  <Text style={[styles.scoreBtnSubText, { color: '#fff' }]}>FOUR</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.scoreBtn, styles.scoreBtnSix]} onPress={() => handleScore(6)} activeOpacity={0.7}>
                  <Text style={[styles.scoreBtnText, styles.scoreBtnBoundaryText]}>6</Text>
                  <Text style={[styles.scoreBtnSubText, { color: '#fff' }]}>SIX</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.scoreBtn, styles.scoreBtnMore]} onPress={() => setShowFiveSevenModal(true)} activeOpacity={0.7}>
                  <Text style={[styles.scoreBtnText, { color: Colors.textPrimary }]}>5/7</Text>
                  <Text style={[styles.scoreBtnSubText]}>MORE</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.scoreBtn, styles.scoreBtnWicket]} onPress={() => setShowWicketPanel(true)} activeOpacity={0.7}>
                  <Text style={[styles.scoreBtnText, { color: '#fff', fontSize: 22 }]}>OUT</Text>
                </TouchableOpacity>
              </View>

              {/* Row 3: extras */}
              <View style={styles.keypadRow}>
                {[
                  { label: 'WD', action: () => { setExtraWicketToggle(false); setShowExtrasPanel({ type: 'wide' }); } },
                  { label: 'NB', action: () => { setExtraWicketToggle(false); setShowExtrasPanel({ type: 'noBall' }); } },
                  { label: 'BYE', action: () => { setExtraWicketToggle(false); setShowExtrasPanel({ type: 'bye' }); } },
                  { label: 'LB', action: () => { setExtraWicketToggle(false); setShowExtrasPanel({ type: 'legBye' }); } },
                ].map(({ label, action }) => (
                  <TouchableOpacity key={label} style={styles.scoreBtnExtra} onPress={action} activeOpacity={0.7}>
                    <Text style={styles.scoreBtnExtraText}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </>
      ) : null}


      {/* Add / Change Scorer Modal */}
      {showAddScorerModal ? (
        <Modal visible={true} transparent animationType="slide" onRequestClose={() => setShowAddScorerModal(false)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
            <View style={{ backgroundColor: Colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '85%', paddingBottom: 30 }}>
              {/* Header */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: Colors.border }}>
                <Text style={{ fontSize: 18, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary }}>Add / Change Scorer</Text>
                <TouchableOpacity onPress={() => { setShowAddScorerModal(false); setNewScorerMobile(''); }}>
                  <Icon name="close" size={24} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Tab Bar */}
              <View style={{ flexDirection: 'row', marginHorizontal: 16, marginTop: 14, backgroundColor: Colors.surface, borderRadius: 10, padding: 3 }}>
                {[
                  { key: 'teamA', label: match?.teamA?.name || 'Team A' },
                  { key: 'teamB', label: match?.teamB?.name || 'Team B' },
                  { key: 'search', label: '🔍 Search' },
                ].map(tab => (
                  <TouchableOpacity
                    key={tab.key}
                    onPress={() => setScorerTab(tab.key)}
                    style={[
                      { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
                      scorerTab === tab.key && { backgroundColor: Colors.primary },
                    ]}
                  >
                    <Text
                      numberOfLines={1}
                      style={{
                        fontSize: 11,
                        fontFamily: Typography.fontFamily.semiBold,
                        color: scorerTab === tab.key ? '#000' : Colors.textSecondary,
                      }}
                    >
                      {tab.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Tab Content */}
              {scorerTab === 'search' ? (
                <View style={{ padding: 16 }}>
                  <Text style={{ color: Colors.textSecondary, marginBottom: 10, fontSize: 13 }}>Enter mobile number to search and add scorer:</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: Colors.border }}>
                    <Icon name="phone-outline" size={20} color={Colors.textTertiary} />
                    <TextInput
                      style={{ flex: 1, color: Colors.textPrimary, fontSize: 15, paddingVertical: 12, marginLeft: 8 }}
                      placeholder="10-digit mobile number"
                      placeholderTextColor={Colors.textTertiary}
                      keyboardType="phone-pad"
                      value={newScorerMobile}
                      onChangeText={(val) => {
                        if (val === newScorerMobile) return;
                        setNewScorerMobile(val);
                        setScorerSearchResult(null);
                        if (val.length === 10) {
                          handleSearchScorer(val);
                        }
                      }}
                      maxLength={10}
                    />
                    {isScorerSearching && <ActivityIndicator color={Colors.primary} size="small" />}
                  </View>

                  {scorerSearchResult && scorerSearchResult.exists && (
                    <View style={{ marginTop: 16, backgroundColor: Colors.surfaceVariant, padding: 12, borderRadius: 12, flexDirection: 'row', alignItems: 'center' }}>
                      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primaryAlpha20, justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                        <Text style={{ color: Colors.primary, fontFamily: Typography.fontFamily.bold, fontSize: 16 }}>
                          {(scorerSearchResult.user?.name || 'U').charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: Colors.textPrimary, fontFamily: Typography.fontFamily.semiBold, fontSize: 15 }}>
                          {scorerSearchResult.user?.name || 'Registered User'}
                        </Text>
                        <Text style={{ color: Colors.textSecondary, fontSize: 12 }}>Registered User</Text>
                      </View>
                    </View>
                  )}

                  {scorerSearchResult && !scorerSearchResult.exists && (
                    <Text style={{ color: Colors.error, fontSize: 13, marginTop: 12, textAlign: 'center' }}>
                      User not found. Please enter a registered user's number.
                    </Text>
                  )}

                  <TouchableOpacity
                    style={[
                      styles.modalBtnAdd, 
                      { marginTop: 16, width: '100%', borderRadius: 10, height: 48, justifyContent: 'center', alignItems: 'center', opacity: (scorerSearchResult && scorerSearchResult.exists && !isLoading) ? 1 : 0.5 }
                    ]}
                    onPress={handleAddScorer}
                    disabled={!scorerSearchResult?.exists || isLoading}
                  >
                    <Text style={[styles.modalBtnTextAdd, { fontSize: 15 }]}>{isLoading ? 'Adding...' : 'Add Scorer'}</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <FlatList
                  data={(() => {
                    const squad = scorerTab === 'teamA'
                      ? (match?.playingXI?.teamA || [])
                      : (match?.playingXI?.teamB || []);
                    // Exclude already-assigned scorers
                    const existingScorers = (match?.scorers || []).map(s => {
                      const id = typeof s === 'object' ? (s._id || s.userId?._id) : s;
                      return String(id);
                    });
                    return squad.filter(p => {
                      const userIdStr = String(p.userId?._id || p.userId || '');
                      const playerIdStr = String(p._id || '');
                      return !existingScorers.includes(userIdStr) && !existingScorers.includes(playerIdStr);
                    });
                  })()}
                  keyExtractor={item => String(item._id || item.userId?._id || Math.random())}
                  contentContainerStyle={{ padding: 16, gap: 10 }}
                  showsVerticalScrollIndicator={false}
                  ListEmptyComponent={() => (
                    <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                      <Icon name="account-group-outline" size={48} color={Colors.textTertiary} />
                      <Text style={{ color: Colors.textTertiary, marginTop: 10, fontSize: 14 }}>No players available</Text>
                      <Text style={{ color: Colors.textTertiary, fontSize: 12, marginTop: 4 }}>All players may already be scorers</Text>
                    </View>
                  )}
                  renderItem={({ item }) => {
                    const name = item.name || item.userId?.name || 'Unknown';
                    const role = item.playingRole || item.userId?.role || '';
                    const photo = item.photo || item.userId?.photo;
                    const pid = item._id || item.userId?._id;
                    const isAdding = scorerAddingId === pid;
                    return (
                      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: Colors.border }}>
                        {/* Avatar */}
                        {photo ? (
                          <Image source={{ uri: getImageUrl(photo) }} style={{ width: 44, height: 44, borderRadius: 22, marginRight: 12 }} />
                        ) : (
                          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primaryAlpha20, justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                            <Text style={{ color: Colors.primary, fontFamily: Typography.fontFamily.bold, fontSize: 18 }}>{name.charAt(0).toUpperCase()}</Text>
                          </View>
                        )}
                        {/* Name & Role */}
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: Colors.textPrimary, fontFamily: Typography.fontFamily.semiBold, fontSize: 15 }}>{name}</Text>
                          {role ? <Text style={{ color: Colors.textSecondary, fontSize: 11, marginTop: 2 }}>{role}</Text> : null}
                        </View>
                        {/* Add Button */}
                        <TouchableOpacity
                          onPress={() => handleAddScorerFromPlayer(item)}
                          disabled={isAdding}
                          style={{
                            backgroundColor: isAdding ? Colors.border : Colors.primary,
                            paddingHorizontal: 14,
                            paddingVertical: 8,
                            borderRadius: 8,
                          }}
                        >
                          {isAdding
                            ? <Icon name="loading" size={16} color={Colors.textSecondary} />
                            : <Text style={{ color: '#000', fontFamily: Typography.fontFamily.bold, fontSize: 12 }}>Add</Text>
                          }
                        </TouchableOpacity>
                      </View>
                    );
                  }}
                />
              )}
            </View>
          </View>
        </Modal>
      ) : null}

      {/* Extras Panel (Bottom Sheet) */}
      {showExtrasPanel ? (
        <View style={styles.bottomSheetOverlay}>
          <View style={styles.bottomSheet}>
            <View style={styles.bsHeader}>
              <Text style={styles.bsTitle}>
                {showExtrasPanel.type === 'wide' ? 'Wide Runs' :
                  showExtrasPanel.type === 'noBall' ? 'No Ball Runs' :
                    showExtrasPanel.type === 'bye' ? 'Bye Runs' : 'Leg Bye Runs'}
              </Text>
              <TouchableOpacity onPress={() => setShowExtrasPanel(null)}><Icon name="close" size={24} color="#FFF" /></TouchableOpacity>
            </View>
            
            {/* Wicket Toggle for WD/NB */}
            {(showExtrasPanel.type === 'wide' || showExtrasPanel.type === 'noBall') && (
              <TouchableOpacity 
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: extraWicketToggle ? '#f4433620' : Colors.surfaceVariant, padding: 12, borderRadius: 8, marginBottom: 16, borderWidth: 1, borderColor: extraWicketToggle ? '#f44336' : 'transparent' }}
                onPress={() => setExtraWicketToggle(!extraWicketToggle)}
              >
                <Text style={{ color: extraWicketToggle ? '#f44336' : Colors.textPrimary, fontFamily: Typography.fontFamily.semiBold }}>Wicket on this delivery?</Text>
                <View style={[styles.checkbox, extraWicketToggle && { backgroundColor: '#f44336', borderColor: '#f44336' }]}>
                  {extraWicketToggle && <Icon name="check" size={14} color="#FFF" />}
                </View>
              </TouchableOpacity>
            )}

            <Text style={{ color: Colors.textSecondary, marginBottom: 12 }}>Select additional runs scored:</Text>
            <View style={styles.bsGrid}>
              {[0, 1, 2, 3, 4, 5, 6].map((runs) => {
                const actualRuns = (showExtrasPanel.type === 'bye' || showExtrasPanel.type === 'legBye')
                  ? runs + 1
                  : runs;

                return (
                  <TouchableOpacity key={runs} style={[styles.bsBtn, { width: '31%', marginBottom: 8 }]} onPress={() => {
                    const opts = {};
                    let scoreValue = 0;

                    if (showExtrasPanel.type === 'wide') {
                      opts.isWide = true;
                      opts.extraRuns = actualRuns;
                    } else if (showExtrasPanel.type === 'noBall') {
                      opts.isNoBall = true;
                      opts.extraRuns = 0;
                      scoreValue = actualRuns; // No ball runs are scored off the bat by batsman
                    } else if (showExtrasPanel.type === 'bye') {
                      opts.isBye = true;
                      opts.extraRuns = actualRuns;
                    } else if (showExtrasPanel.type === 'legBye') {
                      opts.isLegBye = true;
                      opts.extraRuns = actualRuns;
                    }

                    if (extraWicketToggle && (showExtrasPanel.type === 'wide' || showExtrasPanel.type === 'noBall')) {
                      setPendingExtraOpts(opts);
                      setPendingExtraScore(scoreValue);
                      setShowExtrasPanel(null);
                      setExtraWicketToggle(false);
                      setShowWicketPanel(true);
                    } else {
                      handleScore(scoreValue, opts);
                      setShowExtrasPanel(null);
                    }
                  }}>
                    <Text style={styles.bsBtnText}>
                      {actualRuns} Runs
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      ) : null}

      {/* Wicket Panel */}
      {showWicketPanel ? (
        <View style={styles.bottomSheetOverlay}>
          <View style={styles.bottomSheet}>
            <View style={styles.bsHeader}>
              <Text style={styles.bsTitle}>Wicket</Text>
              <TouchableOpacity onPress={() => {
                setShowWicketPanel(false);
                setPendingExtraOpts(null);
                setPendingExtraScore(0);
              }}><Icon name="close" size={24} color="#FFF" /></TouchableOpacity>
            </View>
            <View style={styles.bsGrid}>
              {(() => {
                let availableWickets = ['bowled', 'caught', 'caught_and_bowled', 'lbw', 'run_out', 'stumped', 'hit_wicket', 'obstructing_field', 'cheating'];
                if (pendingExtraOpts?.isWide) availableWickets = ['stumped', 'run_out', 'hit_wicket', 'obstructing_field', 'cheating'];
                if (pendingExtraOpts?.isNoBall) availableWickets = ['run_out', 'obstructing_field', 'cheating'];
                
                return availableWickets.map((type) => (
                  <TouchableOpacity key={type} style={[styles.bsBtn, styles.bsBtnDanger]} onPress={() => handleWicketSelect(type)}>
                    <Text style={[styles.bsBtnText, { fontSize: 13 }]}>{type.replace(/_/g, ' ').toUpperCase()}</Text>
                  </TouchableOpacity>
                ));
              })()}
            </View>
          </View>
        </View>
      ) : null}

      {/* Advanced Wicket Modal */}
      {showAdvancedWicketModal ? (
        <Modal visible={true} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, fielderSelectionMode ? { height: '80%' } : { maxHeight: '80%' }]}>
              {fielderSelectionMode ? (
                <View style={{ flex: 1, width: '100%' }}>
                  <View style={[styles.bsHeader, { paddingHorizontal: 0, marginBottom: 15, alignItems: 'center' }]}>
                    <TouchableOpacity onPress={() => setFielderSelectionMode(null)}><Icon name="arrow-left" size={24} color={Colors.textPrimary} /></TouchableOpacity>
                    <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.modalTitle, { flex: 1, textAlign: 'center', marginHorizontal: 10, marginBottom: 0 }]}>Select {fielderSelectionMode === 'primary' ? 'Primary Fielder' : 'Secondary Fielder'}</Text>
                    <View style={{ width: 24 }} />
                  </View>
                  <FlatList
                    data={(() => {
                      const batId = String(liveState?.battingTeam?._id || liveState?.battingTeam || '');
                      const tAId = String(liveState?.match?.teamA?._id || liveState?.match?.teamA || '');
                      const isTeamABatting = batId === tAId;
                      return (isTeamABatting ? liveState?.match?.playingXI?.teamB : liveState?.match?.playingXI?.teamA) || [];
                    })()}
                    keyExtractor={item => item._id}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ gap: 10, paddingBottom: 20 }}
                    ListHeaderComponent={() => {
                      if (fielderSelectionMode === 'secondary') {
                        return (
                          <TouchableOpacity
                            style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, marginBottom: 10 }}
                            onPress={() => { setSecondaryFielder(null); setFielderSelectionMode(null); }}
                          >
                            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.border, justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                              <Icon name="close" size={20} color={Colors.textSecondary} />
                            </View>
                            <Text style={{ color: Colors.textPrimary, fontSize: 16 }}>None</Text>
                          </TouchableOpacity>
                        );
                      }
                      return null;
                    }}
                    renderItem={({ item }) => {
                      if (fielderSelectionMode === 'secondary' && item._id === primaryFielder) return null;
                      return (
                        <TouchableOpacity
                          style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: Colors.border }}
                          onPress={() => {
                            if (fielderSelectionMode === 'primary') setPrimaryFielder(item._id);
                            if (fielderSelectionMode === 'secondary') setSecondaryFielder(item._id);
                            setFielderSelectionMode(null);
                          }}
                        >
                          {item.photo ? (
                            <Image source={{ uri: getImageUrl(item.photo) }} style={{ width: 40, height: 40, borderRadius: 20, marginRight: 12 }} />
                          ) : (
                            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                              <Text style={{ color: '#000', fontWeight: 'bold' }}>{item.name.charAt(0).toUpperCase()}</Text>
                            </View>
                          )}
                          <Text style={{ color: Colors.textPrimary, fontSize: 16 }}>{item.name}</Text>
                        </TouchableOpacity>
                      );
                    }}
                  />
                </View>
              ) : (
                <>
                  <View style={styles.bsHeader}>
                    <Text style={styles.modalTitle}>{advWicketType?.replace(/_/g, ' ').toUpperCase()}</Text>
                    <TouchableOpacity onPress={() => setShowAdvancedWicketModal(false)}><Icon name="close" size={24} color={Colors.textPrimary} /></TouchableOpacity>
                  </View>
                  <KeyboardAwareScrollView enableOnAndroid={true} extraScrollHeight={20} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} style={{ width: '100%' }}>

                    {/* Dismissed Batter Selection (For Run Out, Obstructing, Cheating, Retired) */}
                    {['run_out', 'obstructing_field', 'cheating', 'retired_hurt', 'retired_out'].includes(advWicketType) && (
                      <View style={{ marginBottom: 20 }}>
                        <Text style={{ color: Colors.textSecondary, marginBottom: 10 }}>Who got out?</Text>
                        <View style={{ flexDirection: 'row', gap: 10 }}>
                          {[liveState.striker, liveState.nonStriker].filter(Boolean).map(b => (
                            <TouchableOpacity
                              key={b._id}
                              style={[styles.bsBtn, dismissedBatter === b._id ? { backgroundColor: Colors.primary } : { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, flex: 1 }]}
                              onPress={() => setDismissedBatter(b._id)}
                            >
                              <Text style={[styles.bsBtnText, dismissedBatter === b._id ? { color: '#000' } : { color: Colors.textPrimary }]}>{b.name}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    )}

                    {/* Fielder Selection (For Caught, Stumped, Run Out) */}
                    {['caught', 'stumped', 'run_out'].includes(advWicketType) && (
                      <View style={{ marginBottom: 20 }}>
                        <Text style={{ color: Colors.textSecondary, marginBottom: 10 }}>
                          {advWicketType === 'run_out' ? 'Primary Fielder (Assisted by)' : advWicketType === 'stumped' ? 'Stumped by' : 'Catcher'}
                        </Text>
                        {(() => {
                          const _batId = String(liveState?.battingTeam?._id || liveState?.battingTeam || '');
                          const _tAId = String(liveState?.match?.teamA?._id || liveState?.match?.teamA || '');
                          const isTeamABatting = _batId === _tAId;
                          const fieldingSquad = (isTeamABatting ? liveState?.match?.playingXI?.teamB : liveState?.match?.playingXI?.teamA) || [];
                          const selected = fieldingSquad.find(f => String(f._id) === String(primaryFielder));
                          return (
                            <TouchableOpacity
                              style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: Colors.border }}
                              onPress={() => setFielderSelectionMode('primary')}
                            >
                              {selected ? (
                                selected.photo ? (
                                  <Image source={{ uri: getImageUrl(selected.photo) }} style={{ width: 40, height: 40, borderRadius: 20, marginRight: 12 }} />
                                ) : (
                                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                                    <Text style={{ color: '#000', fontWeight: 'bold' }}>{selected.name.charAt(0).toUpperCase()}</Text>
                                  </View>
                                )
                              ) : (
                                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.border, justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                                  <Icon name="account" size={20} color={Colors.textSecondary} />
                                </View>
                              )}
                              <View style={{ flex: 1 }}>
                                <Text style={{ color: Colors.textPrimary, fontSize: 16 }}>{selected ? selected.name : 'Tap to Select Fielder'}</Text>
                              </View>
                              <Icon name="chevron-down" size={20} color={Colors.textTertiary} />
                            </TouchableOpacity>
                          );
                        })()}
                      </View>
                    )}

                    {/* Secondary Fielder (For Run Out) */}
                    {advWicketType === 'run_out' && (
                      <View style={{ marginBottom: 20 }}>
                        <Text style={{ color: Colors.textSecondary, marginBottom: 10 }}>Secondary Fielder (Optional)</Text>
                        {(() => {
                          const _batId2 = String(liveState?.battingTeam?._id || liveState?.battingTeam || '');
                          const _tAId2 = String(liveState?.match?.teamA?._id || liveState?.match?.teamA || '');
                          const isTeamABatting = _batId2 === _tAId2;
                          const fieldingSquad = (isTeamABatting ? liveState?.match?.playingXI?.teamB : liveState?.match?.playingXI?.teamA) || [];
                          const selected = fieldingSquad.find(f => String(f._id) === String(secondaryFielder));
                          return (
                            <TouchableOpacity
                              style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: Colors.border }}
                              onPress={() => setFielderSelectionMode('secondary')}
                            >
                              {selected ? (
                                selected.photo ? (
                                  <Image source={{ uri: getImageUrl(selected.photo) }} style={{ width: 40, height: 40, borderRadius: 20, marginRight: 12 }} />
                                ) : (
                                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                                    <Text style={{ color: '#000', fontWeight: 'bold' }}>{selected.name.charAt(0).toUpperCase()}</Text>
                                  </View>
                                )
                              ) : (
                                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.border, justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                                  <Icon name="account-off" size={20} color={Colors.textSecondary} />
                                </View>
                              )}
                              <View style={{ flex: 1 }}>
                                <Text style={{ color: Colors.textPrimary, fontSize: 16 }}>{selected ? selected.name : 'None (Tap to Select)'}</Text>
                              </View>
                              <Icon name="chevron-down" size={20} color={Colors.textTertiary} />
                            </TouchableOpacity>
                          );
                        })()}
                      </View>
                    )}

                    {/* Runs completed on Run Out */}
                    {advWicketType === 'run_out' && !pendingExtraOpts && (
                      <View style={{ marginBottom: 20 }}>
                        <Text style={{ color: Colors.textSecondary, marginBottom: 10 }}>Runs completed before Run Out</Text>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                          {[0, 1, 2, 3, 4, 5].map(runs => (
                            <TouchableOpacity 
                              key={runs}
                              style={[{ flex: 1, paddingVertical: 12, backgroundColor: Colors.surfaceVariant, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: 'transparent' }, advWicketRuns === runs && { backgroundColor: Colors.primary, borderColor: Colors.primary }]}
                              onPress={() => setAdvWicketRuns(runs)}
                            >
                              <Text style={[{ color: Colors.textPrimary, fontSize: 16, fontFamily: Typography.fontFamily.semiBold }, advWicketRuns === runs && { color: '#000' }]}>{runs}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    )}

                    <TouchableOpacity style={styles.modalBtnAdd} onPress={submitAdvancedWicket}>
                      <Text style={styles.modalBtnTextAdd}>Save Wicket</Text>
                    </TouchableOpacity>
                  </KeyboardAwareScrollView>
                </>
              )}
            </View>
          </View>
        </Modal>
      ) : null}

      {/* Settings Modal (Right Sidebar) */}
      {showSettingsModal ? (
        <Modal visible={true} transparent animationType="fade">
          <TouchableOpacity 
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', flexDirection: 'row', justifyContent: 'flex-end' }}
            activeOpacity={1} 
            onPress={() => setShowSettingsModal(false)}
          >
            <TouchableOpacity 
              activeOpacity={1} 
              style={{ width: '75%', backgroundColor: Colors.background, height: '100%', padding: 20, paddingTop: 60, elevation: 5, shadowColor: '#000', shadowOffset: { width: -2, height: 0 }, shadowOpacity: 0.25, shadowRadius: 5 }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <Text style={{ fontSize: 20, color: Colors.textPrimary, fontFamily: Typography.fontFamily.bold }}>Match Settings</Text>
                <TouchableOpacity onPress={() => setShowSettingsModal(false)}><Icon name="close" size={24} color={Colors.textSecondary} /></TouchableOpacity>
              </View>
              <KeyboardAwareScrollView enableOnAndroid={true} extraScrollHeight={20} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <View style={{ gap: 12 }}>
                  <TouchableOpacity style={[styles.bsBtn, { width: '100%', height: 50, backgroundColor: Colors.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', paddingHorizontal: 16 }]} onPress={() => handleSettingsAction('view_scoreboard')}>
                    <Icon name="clipboard-text-outline" size={20} color={Colors.primary} style={{ marginRight: 12 }} />
                    <Text style={[styles.bsBtnText, { color: Colors.primary }]}>View Full Scorecard</Text>
                  </TouchableOpacity>
                  {isCreator && isMatchActive ? (
                    <TouchableOpacity style={[styles.bsBtn, { width: '100%', height: 50, backgroundColor: Colors.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', paddingHorizontal: 16 }]} onPress={() => handleSettingsAction('add_scorer')}>
                      <Icon name="account-plus-outline" size={20} color={Colors.textPrimary} style={{ marginRight: 12 }} />
                      <Text style={[styles.bsBtnText, { color: Colors.textPrimary }]}>Add / Change Scorer</Text>
                    </TouchableOpacity>
                  ) : null}
                  {isCreator && isMatchActive ? (
                    <TouchableOpacity style={[styles.bsBtn, { width: '100%', height: 50, backgroundColor: Colors.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', paddingHorizontal: 16 }]} onPress={() => handleSettingsAction('toggle_single_wicket')}>
                      <Icon name="account-outline" size={20} color={Colors.textPrimary} style={{ marginRight: 12 }} />
                      <Text style={[styles.bsBtnText, { color: Colors.textPrimary }]}>{match?.isSingleWicketBatting ? 'Disable' : 'Enable'} Single Wicket Batting</Text>
                    </TouchableOpacity>
                  ) : null}
                  
                  <View style={{ height: 1, backgroundColor: Colors.border, marginVertical: 8 }} />
                  
                  {(isCreator || isScorer) && isMatchActive ? (
                    <>
                      <TouchableOpacity style={[styles.bsBtn, { width: '100%', height: 50, backgroundColor: Colors.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', paddingHorizontal: 16 }]} onPress={() => handleSettingsAction('add_penalty_runs')}>
                        <Icon name="plus-circle-outline" size={20} color={Colors.textPrimary} style={{ marginRight: 12 }} />
                        <Text style={[styles.bsBtnText, { color: Colors.textPrimary }]}>Add Penalty Runs</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.bsBtn, { width: '100%', height: 50, backgroundColor: Colors.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', paddingHorizontal: 16 }]} onPress={() => handleSettingsAction('retired_hurt')}>
                        <Icon name="medical-bag" size={20} color={Colors.textPrimary} style={{ marginRight: 12 }} />
                        <Text style={[styles.bsBtnText, { color: Colors.textPrimary }]}>Retired Hurt</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.bsBtn, { width: '100%', height: 50, backgroundColor: Colors.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', paddingHorizontal: 16 }]} onPress={() => handleSettingsAction('declare_innings')}>
                        <Icon name="flag-outline" size={20} color={Colors.textPrimary} style={{ marginRight: 12 }} />
                        <Text style={[styles.bsBtnText, { color: Colors.textPrimary }]}>Declare Innings</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.bsBtn, { width: '100%', height: 50, backgroundColor: Colors.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', paddingHorizontal: 16 }]} onPress={() => handleSettingsAction('end_innings')}>
                        <Icon name="stop-circle-outline" size={20} color={Colors.textPrimary} style={{ marginRight: 12 }} />
                        <Text style={[styles.bsBtnText, { color: Colors.textPrimary }]}>End Innings Manually</Text>
                      </TouchableOpacity>

                      {/* ── Between / 2nd Innings Settings ─────────────── */}
                      {liveState?.inningsNumber >= 2 && (
                        <>
                          <View style={{ height: 1, backgroundColor: Colors.border, marginVertical: 8 }} />
                          <Text style={{ fontSize: 11, color: Colors.textTertiary, fontFamily: Typography.fontFamily.semiBold, marginBottom: 4, paddingHorizontal: 4, textTransform: 'uppercase', letterSpacing: 0.8 }}>2nd Innings Settings</Text>

                          <TouchableOpacity style={[styles.bsBtn, { width: '100%', height: 50, backgroundColor: Colors.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', paddingHorizontal: 16 }]} onPress={() => handleSettingsAction('revise_overs')}>
                            <Icon name="weather-lightning-rainy" size={20} color='#29B6F6' style={{ marginRight: 12 }} />
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.bsBtnText, { color: Colors.textPrimary }]}>Revised Target (Rain / DLS)</Text>
                              <Text style={{ fontSize: 10, color: Colors.textTertiary, marginTop: 1 }}>Reduce overs & set new target</Text>
                            </View>
                          </TouchableOpacity>

                          <TouchableOpacity style={[styles.bsBtn, { width: '100%', height: 50, backgroundColor: Colors.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', paddingHorizontal: 16 }]} onPress={() => handleSettingsAction('declare_dls')}>
                            <Icon name="scale-balance" size={20} color={Colors.info} style={{ marginRight: 12 }} />
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.bsBtnText, { color: Colors.info }]}>Declare Winner via DLS</Text>
                              <Text style={{ fontSize: 10, color: Colors.textTertiary, marginTop: 1 }}>End match now using DLS method</Text>
                            </View>
                          </TouchableOpacity>

                          <TouchableOpacity style={[styles.bsBtn, styles.bsBtnDanger, { width: '100%', height: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', paddingHorizontal: 16, borderWidth: 1, borderColor: `${Colors.error}40` }]} onPress={() => handleSettingsAction('abandon')}>
                            <Icon name="cancel" size={20} color={Colors.error} style={{ marginRight: 12 }} />
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.bsBtnText, { color: Colors.error }]}>Abandon Match</Text>
                              <Text style={{ fontSize: 10, color: `${Colors.error}99`, marginTop: 1 }}>Irreversible — match will be void</Text>
                            </View>
                          </TouchableOpacity>
                        </>
                      )}

                      {/* Abandon always accessible in 1st innings too */}
                      {liveState?.inningsNumber < 2 && (
                        <TouchableOpacity style={[styles.bsBtn, styles.bsBtnDanger, { width: '100%', height: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', paddingHorizontal: 16 }]} onPress={() => handleSettingsAction('abandon')}>
                          <Icon name="cancel" size={20} color={Colors.error} style={{ marginRight: 12 }} />
                          <Text style={[styles.bsBtnText, { color: Colors.error }]}>Abandon Match</Text>
                        </TouchableOpacity>
                      )}
                    </>
                  ) : null}
                </View>
              </KeyboardAwareScrollView>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      ) : null}

      {/* Penalty Modal */}
      {showPenaltyModal ? (
        <Modal visible={true} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Penalty Runs</Text>
              <Text style={styles.modalSub}>Add runs without counting a ball.</Text>
              
              <Text style={{ color: Colors.textSecondary, marginBottom: 8 }}>Award Penalty to:</Text>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
                <TouchableOpacity style={[styles.bsBtn, { flex: 1 }, penaltyTeam === 'batting' ? { backgroundColor: Colors.primary } : { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border }]} onPress={() => setPenaltyTeam('batting')}>
                  <Text style={[styles.bsBtnText, penaltyTeam === 'batting' ? { color: '#000' } : { color: Colors.textPrimary }]}>Batting Team</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.bsBtn, { flex: 1 }, penaltyTeam === 'fielding' ? { backgroundColor: Colors.primary } : { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border }]} onPress={() => setPenaltyTeam('fielding')}>
                  <Text style={[styles.bsBtnText, penaltyTeam === 'fielding' ? { color: '#000' } : { color: Colors.textPrimary }]}>Fielding Team</Text>
                </TouchableOpacity>
              </View>

              <Text style={{ color: Colors.textSecondary, marginBottom: 8 }}>Penalty Runs:</Text>
              <TextInput
                style={styles.modalInput}
                keyboardType="numeric"
                value={penaltyRuns}
                onChangeText={setPenaltyRuns}
              />

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setShowPenaltyModal(false)}>
                  <Text style={styles.modalBtnTextCancel}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalBtnAdd} onPress={submitPenaltyRuns}>
                  <Text style={styles.modalBtnTextAdd}>Add</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}

      {/* Revise Match Modal (Rain/DLS) */}
      {showReviseModal ? (
        <Modal visible={true} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Revise Match</Text>
              <Text style={styles.modalSub}>Reduce overs due to rain or other interruptions.</Text>
              
              <Text style={{ color: Colors.textSecondary, marginBottom: 8 }}>Revised Total Overs:</Text>
              <TextInput
                style={styles.modalInput}
                keyboardType="numeric"
                value={revisedOvers}
                onChangeText={setRevisedOvers}
              />

              {liveState?.inningsNumber === 2 && (
                <>
                  <Text style={{ color: Colors.textTertiary, fontSize: 12, marginTop: 10 }}>Note: The revised target will be automatically calculated using the DLS method.</Text>
                </>
              )}

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setShowReviseModal(false)}>
                  <Text style={styles.modalBtnTextCancel}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalBtnAdd} onPress={submitReviseMatch}>
                  <Text style={styles.modalBtnTextAdd}>Save Revision</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}

      {/* Abandon Match Modal */}
      {showAbandonModal ? (
        <Modal visible={true} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Abandon Match</Text>
              <Text style={styles.modalSub}>Are you sure you want to abandon this match? This action cannot be undone.</Text>
              
              <Text style={{ color: Colors.textSecondary, marginBottom: 8, marginTop: 10 }}>Reason for abandoning:</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                {['Rain', 'Bad Light', 'Pitch Unplayable', 'Other'].map(r => {
                  const presets = ['Rain', 'Bad Light', 'Pitch Unplayable'];
                  const isPresetSelected = presets.includes(abandonReason);
                  const isOtherSelected = !isPresetSelected && abandonReason !== '';
                  const isSelected = r === 'Other' ? isOtherSelected : abandonReason === r;

                  return (
                    <TouchableOpacity
                      key={r}
                      style={{ 
                        backgroundColor: isSelected ? Colors.primary : Colors.surface, 
                        paddingVertical: 8, 
                        paddingHorizontal: 12, 
                        borderRadius: 16, 
                        borderWidth: 1, 
                        borderColor: isSelected ? Colors.primary : Colors.border 
                      }}
                      onPress={() => setAbandonReason(r === 'Other' ? 'Custom Reason' : r)}
                    >
                      <Text style={{ color: isSelected ? '#000' : Colors.textPrimary, fontSize: 12 }}>{r}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {(!['Rain', 'Bad Light', 'Pitch Unplayable'].includes(abandonReason)) && (
                <TextInput
                  style={[styles.modalInput, { height: 80 }]}
                  placeholder="Type custom reason here"
                  placeholderTextColor={Colors.textTertiary}
                  value={abandonReason === 'Custom Reason' ? '' : abandonReason}
                  onChangeText={setAbandonReason}
                  multiline
                />
              )}

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setShowAbandonModal(false)}>
                  <Text style={styles.modalBtnTextCancel}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalBtnAdd, { backgroundColor: Colors.error }]} onPress={submitAbandon}>
                  <Text style={[styles.modalBtnTextAdd, { color: '#FFF' }]}>Abandon Match</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}



      {/* Wagon Wheel Modal */}
      {showWagonWheelModal ? (
        <Modal visible={true} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Wagon Wheel</Text>
              <Text style={styles.modalSub}>Tap the ground to indicate where the {pendingRuns} run{pendingRuns > 1 ? 's were' : ' was'} hit.</Text>

              <View style={{ alignItems: 'center', marginBottom: 20 }}>
                <TouchableOpacity
                  activeOpacity={1}
                  onPress={(evt) => {
                    const { locationX, locationY } = evt.nativeEvent;
                    const isTurf = match.pitchType === 'Box Cricket' || match.groundType === 'Box Cricket' || match.groundType === 'Indoor';
                    const W = isTurf ? 220 : 300;
                    const H = isTurf ? 360 : 300;
                    const CX = W / 2;
                    const CY = H / 2;
                    const CY_ACTUAL = CY - (isTurf ? 60 : 40); // Move to top (start) of the pitch

                    const dx = locationX - CX;
                    const dy = locationY - CY_ACTUAL;
                    let distance = Math.sqrt(dx * dx + dy * dy);

                    let maxDist = 150;
                    if (distance > 0) {
                      const maxDx = dx > 0 ? (W - CX) : CX;
                      const maxDy = dy > 0 ? (H - CY_ACTUAL) : CY_ACTUAL;
                      const scaleX = Math.abs(maxDx / (dx === 0 ? 0.001 : dx));
                      const scaleY = Math.abs(maxDy / (dy === 0 ? 0.001 : dy));
                      maxDist = distance * Math.min(scaleX, scaleY);
                    }

                    if (pendingRuns === 4 || pendingRuns === 6) {
                      distance = maxDist; // Boundaries always reach the edge
                    } else {
                      distance = Math.min(distance, maxDist); // Cap at edge for 1s, 2s, 3s
                    }

                    let angle = Math.atan2(dy, dx) * (180 / Math.PI);

                    let color = '#FFF';
                    if (pendingRuns === 2) color = '#FFEB3B';
                    else if (pendingRuns === 3) color = '#2196F3';
                    else if (pendingRuns === 4) color = '#4CAF50';
                    else if (pendingRuns === 6) color = '#F44336';

                    setWagonWheelData({ angle, distance, color });
                  }}
                >
                  {(() => {
                    const isTurf = match.pitchType === 'Box Cricket' || match.groundType === 'Box Cricket' || match.groundType === 'Indoor';
                    const W = isTurf ? 220 : 300;
                    const H = isTurf ? 360 : 300;
                    const CX = W / 2;
                    const CY = H / 2;
                    const CY_ACTUAL = CY - (isTurf ? 60 : 40);
                    return (
                      <ImageBackground
                        source={isTurf ? require('../../../turf.png') : require('../../../ground.png')}
                        style={{ width: W, height: H, overflow: 'hidden', borderRadius: isTurf ? 16 : 150 }}
                        resizeMode="cover"
                      >
                        {/* Pitch Center */}
                        <View pointerEvents="none" style={{ position: 'absolute', left: CX - 4, top: CY_ACTUAL - 4, width: 8, height: 8, borderRadius: 4, backgroundColor: 'red' }} />

                        {/* Field Labels (Inverted) */}
                        <Text pointerEvents="none" style={{ position: 'absolute', top: 10, left: CX - 30, width: 60, textAlign: 'center', color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: 'bold' }}>BEHIND</Text>
                        <Text pointerEvents="none" style={{ position: 'absolute', bottom: 10, left: CX - 40, width: 80, textAlign: 'center', color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: 'bold' }}>STRAIGHT</Text>
                        <Text pointerEvents="none" style={{ position: 'absolute', right: 10, top: CY_ACTUAL - 8, color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: 'bold' }}>LEG</Text>
                        <Text pointerEvents="none" style={{ position: 'absolute', left: 10, top: CY_ACTUAL - 8, color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: 'bold' }}>OFF</Text>

                        {wagonWheelData ? (
                          <View style={{
                            position: 'absolute',
                            left: CX - wagonWheelData.distance / 2,
                            top: CY_ACTUAL - 2,
                            width: wagonWheelData.distance,
                            height: 4,
                            backgroundColor: wagonWheelData.color,
                            transform: [
                              { rotate: `${wagonWheelData.angle}deg` },
                              { translateX: wagonWheelData.distance / 2 }
                            ]
                          }} />
                        ) : null}
                      </ImageBackground>
                    );
                  })()}
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20, paddingHorizontal: 10 }}
                onPress={() => setAlwaysSkipWagonWheel(!alwaysSkipWagonWheel)}
              >
                <Icon name={alwaysSkipWagonWheel ? 'checkbox-marked' : 'checkbox-blank-outline'} size={24} color={Colors.primary} />
                <Text style={{ marginLeft: 10, color: Colors.textSecondary, fontSize: 14 }}>Don't show this again for this match</Text>
              </TouchableOpacity>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalBtnCancel}
                  onPress={() => {
                    setShowWagonWheelModal(false);
                    const optionsWithWheel = { ...pendingScoreOptions, wagonWheelResolved: true };
                    handleScore(pendingRuns, optionsWithWheel);
                    setWagonWheelData(null);
                  }}
                >
                  <Text style={styles.modalBtnTextCancel}>Skip</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalBtnAdd, !wagonWheelData && { opacity: 0.5 }]}
                  disabled={!wagonWheelData}
                  onPress={() => {
                    setShowWagonWheelModal(false);
                    const optionsWithWheel = { ...pendingScoreOptions, wagonWheel: wagonWheelData, wagonWheelResolved: true };
                    handleScore(pendingRuns, optionsWithWheel);
                    setWagonWheelData(null);
                  }}
                >
                  <Text style={styles.modalBtnTextAdd}>Save & Score</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}

      {/* 5 / 7 Runs Modal */}
      {showFiveSevenModal ? (
        <Modal visible={true} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Extra Runs</Text>

              <View style={{ marginBottom: 20 }}>
                <Text style={{ color: Colors.textSecondary, marginBottom: 10 }}>Select Runs</Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity
                    style={[styles.bsBtn, fiveSevenRuns === 5 ? { backgroundColor: Colors.primary } : { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border }]}
                    onPress={() => setFiveSevenRuns(5)}
                  >
                    <Text style={[styles.bsBtnText, fiveSevenRuns === 5 ? { color: '#000' } : { color: Colors.textPrimary }]}>5 Runs</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.bsBtn, fiveSevenRuns === 7 ? { backgroundColor: Colors.primary } : { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border }]}
                    onPress={() => setFiveSevenRuns(7)}
                  >
                    <Text style={[styles.bsBtnText, fiveSevenRuns === 7 ? { color: '#000' } : { color: Colors.textPrimary }]}>7 Runs</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={{ marginBottom: 20 }}>
                <Text style={{ color: Colors.textSecondary, marginBottom: 10 }}>Reason</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                  {['Overthrow', 'Running', 'Penalty'].map((reason) => (
                    <TouchableOpacity
                      key={reason}
                      style={[styles.bsBtn, { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 16 }]}
                      onPress={() => {
                        setShowFiveSevenModal(false);
                        handleScore(fiveSevenRuns, { runReason: reason });
                      }}
                    >
                      <Text style={[styles.bsBtnText, { color: Colors.textPrimary }]}>{reason}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setShowFiveSevenModal(false)}>
                  <Text style={styles.modalBtnTextCancel}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}

      {/* Strike Selection Modal */}
      {showStrikeModal ? (
        <Modal visible={true} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { height: 'auto', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <Text style={{ fontSize: 20, color: Colors.textPrimary, fontWeight: 'bold' }}>Who is on strike?</Text>
                <TouchableOpacity onPress={() => setShowStrikeModal(false)}>
                  <Icon name="close" size={24} color={Colors.textPrimary} />
                </TouchableOpacity>
              </View>
              <View style={{ flexDirection: 'row', gap: 16 }}>
                <TouchableOpacity
                  style={{ flex: 1, backgroundColor: Colors.surface, padding: 20, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: Colors.border }}
                  onPress={() => handleSelectStrike(striker?._id || striker)}
                >
                  {striker?.photo ? (
                    <Image key="strike-photo-1" source={{ uri: getImageUrl(striker.photo) }} style={{ width: 70, height: 70, borderRadius: 35, marginBottom: 12 }} />
                  ) : (
                    <View key="strike-avatar-1" style={{ width: 70, height: 70, borderRadius: 35, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
                      <Text style={{ color: '#000', fontWeight: 'bold', fontSize: 24 }}>{striker?.name?.charAt(0)?.toUpperCase()}</Text>
                    </View>
                  )}
                  <Text style={{ color: Colors.textPrimary, fontSize: 16, textAlign: 'center', fontWeight: '500' }} numberOfLines={2}>{striker?.name}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={{ flex: 1, backgroundColor: Colors.surface, padding: 20, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: Colors.border }}
                  onPress={() => handleSelectStrike(nonStriker?._id || nonStriker)}
                >
                  {nonStriker?.photo ? (
                    <Image key="strike-photo-2" source={{ uri: getImageUrl(nonStriker.photo) }} style={{ width: 70, height: 70, borderRadius: 35, marginBottom: 12 }} />
                  ) : (
                    <View key="strike-avatar-2" style={{ width: 70, height: 70, borderRadius: 35, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
                      <Text style={{ color: '#000', fontWeight: 'bold', fontSize: 24 }}>{nonStriker?.name?.charAt(0)?.toUpperCase()}</Text>
                    </View>
                  )}
                  <Text style={{ color: Colors.textPrimary, fontSize: 16, textAlign: 'center', fontWeight: '500' }} numberOfLines={2}>{nonStriker?.name}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}

      {/* Share Preview Modal */}
      <SharePreviewModal
        visible={shareModalVisible}
        onClose={() => setShareModalVisible(false)}
        title={`${match?.teamA?.name || 'Team A'} vs ${match?.teamB?.name || 'Team B'}`}
        shareUrl={`https://scoreverse.maazibrahimoo0.workers.dev/match/${cleanMatchId}`}
      >
        <MatchSummaryPoster liveState={liveState} />
      </SharePreviewModal>

    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  playerChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    marginRight: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  playerChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  playerChipText: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  playerChipTextActive: {
    color: '#000',
    fontWeight: 'bold',
  },

  // ── Layout ──
  container: { flex: 1, backgroundColor: Colors.background },
  loading: { color: Colors.textPrimary, textAlign: 'center', marginTop: 100 },
  content: { flex: 1 },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.backgroundCard,
  },
  headerBackBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.07)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 15,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.textPrimary,
    flexShrink: 1,
  },
  headerLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(244, 67, 54, 0.15)',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 3,
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(244, 67, 54, 0.3)',
  },
  headerLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.error,
  },
  headerLiveText: {
    fontSize: 10,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.error,
    letterSpacing: 0.5,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.07)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },

  // ── Score Board ──
  scoreBoard: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  teamsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 4,
    gap: 6,
  },
  teamLabel: {
    flex: 1,
    fontSize: 12,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.textTertiary,
    textAlign: 'right',
    letterSpacing: 0.3,
  },
  teamLabelRight: {
    textAlign: 'left',
  },
  teamLabelActive: {
    color: Colors.textPrimary,
    fontSize: 13,
  },
  vsChip: {
    backgroundColor: Colors.border,
    borderRadius: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  vsText: {
    fontSize: 9,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.textTertiary,
    letterSpacing: 1.5,
  },
  scoreBoardDivider: {
    width: 30,
    height: 1,
    backgroundColor: Colors.border,
    marginBottom: 4,
  },
  mainScore: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  scoreRight: {
    marginLeft: 4,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  runs: {
    fontSize: 52,
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.bold,
    lineHeight: 56,
    letterSpacing: -1.5,
  },
  slash: {
    fontSize: 0,
  },
  wickets: {
    fontSize: 22,
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.semiBold,
    lineHeight: 26,
  },
  oversText: {
    color: Colors.textTertiary,
    fontSize: 12,
    fontFamily: Typography.fontFamily.regular,
    lineHeight: 16,
    marginTop: 2,
  },
  statsPill: {
    marginTop: 6,
    backgroundColor: Colors.backgroundSecondary || Colors.surface,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statsPillText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontFamily: Typography.fontFamily.semiBold,
    letterSpacing: 0.4,
  },
  chaseBanner: {
    marginTop: 6,
    width: '100%',
    backgroundColor: Colors.primaryAlpha20 || 'rgba(154,188,47,0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.primary + '40',
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  chaseMainText: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontFamily: Typography.fontFamily.semiBold,
    textAlign: 'center',
    marginBottom: 1,
  },
  chaseHighlight: {
    color: Colors.primary,
    fontFamily: Typography.fontFamily.bold,
    fontSize: 15,
  },
  dlsTag: {
    color: Colors.textTertiary,
    fontSize: 11,
    fontFamily: Typography.fontFamily.regular,
  },
  chaseSubText: {
    color: Colors.textTertiary,
    fontSize: 10.5,
    fontFamily: Typography.fontFamily.regular,
    textAlign: 'center',
    letterSpacing: 0.2,
    marginBottom: 3,
  },
  dlsParRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 1,
  },
  dlsParLabel: {
    color: Colors.textTertiary,
    fontSize: 11,
    fontFamily: Typography.fontFamily.regular,
  },
  dlsParValue: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontFamily: Typography.fontFamily.bold,
  },
  dlsParStatus: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.semiBold,
  },
  tossText: {
    color: Colors.textTertiary,
    fontSize: 12,
    fontFamily: Typography.fontFamily.regular,
    textAlign: 'center',
  },
  crrRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 5,
  },
  crrText: {
    color: Colors.primary,
    fontSize: 12,
    fontFamily: Typography.fontFamily.semiBold,
  },
  chaseText: {
    color: Colors.primary,
    fontSize: 12,
    fontFamily: Typography.fontFamily.bold,
    textAlign: 'center',
    marginTop: 4,
  },

  // ── Over Timeline ──
  overTimeline: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    marginTop: Spacing.sm,
  },
  overTimelineLabel: {
    color: Colors.textTertiary,
    marginBottom: 8,
    fontFamily: Typography.fontFamily.bold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  timelineScroll: { gap: 7, paddingRight: 20 },
  ballCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.backgroundCard,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  ballWicket: { backgroundColor: Colors.error, borderColor: Colors.error },
  ballBoundary: { backgroundColor: '#FFC107', borderColor: '#FFC107' },
  ballText: {
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.bold,
    fontSize: 13,
  },

  // ── Players Grid ──
  playersGrid: {
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  playersGridHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
  },
  playersGridHeaderText: {
    fontSize: 10,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  playerRowBordered: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  playerStatsCol: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 6,
  },
  playerStatsColDivider: {
    width: 1,
    backgroundColor: Colors.borderLight,
    height: '100%',
  },
  strikerHighlightCol: {
    backgroundColor: 'rgba(154, 188, 47, 0.10)',
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
  },
  playerRowDividerLine: {
    height: 1,
    backgroundColor: Colors.borderLight,
    width: '100%',
  },
  playerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
  },
  playerName: {
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.medium,
    fontSize: 13,
    maxWidth: 100,
  },
  strikerName: { color: Colors.textPrimary, fontFamily: Typography.fontFamily.bold },
  playerScore: {
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.bold,
    fontSize: 15,
  },
  playerScoreBalls: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontFamily: Typography.fontFamily.regular,
  },
  bowlerOverText: {
    color: Colors.textTertiary,
    fontFamily: Typography.fontFamily.regular,
    fontSize: 12,
  },
  bowlerStatsText: {
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.medium,
    fontSize: 13,
  },
  bowlingTableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 5,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    marginBottom: 2,
  },
  bowlingTableHeaderCell: {
    width: 52,
    fontSize: 10,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    textAlign: 'right',
  },
  bowlingTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
  },
  bowlingTableName: {
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: 14,
  },
  bowlingTableCell: {
    width: 52,
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.medium,
    fontSize: 13,
    textAlign: 'right',
  },

  // ── Keypad ──
  keypad: {
    backgroundColor: Colors.backgroundCard,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  keypadRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  scoreBtn: {
    flex: 1,
    height: 78,
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  scoreBtnFour: {
    backgroundColor: 'rgba(76, 175, 80, 0.18)',
    borderColor: 'rgba(76, 175, 80, 0.4)',
  },
  scoreBtnSix: {
    backgroundColor: 'rgba(33, 150, 243, 0.18)',
    borderColor: 'rgba(33, 150, 243, 0.4)',
  },
  scoreBtnMore: {
    backgroundColor: Colors.card,
    borderColor: Colors.border,
  },
  scoreBtnWicket: {
    backgroundColor: Colors.error,
    borderColor: Colors.error,
    flex: 1,
  },
  scoreBtnBoundaryText: {
    color: '#fff',
    fontFamily: Typography.fontFamily.bold,
  },
  scoreBtnText: {
    color: Colors.textPrimary,
    fontSize: 28,
    fontFamily: Typography.fontFamily.semiBold,
  },
  scoreBtnSubText: {
    color: Colors.textTertiary,
    fontSize: 10,
    fontFamily: Typography.fontFamily.bold,
    marginTop: -2,
    letterSpacing: 0.5,
  },
  scoreBtnUndo: {
    flex: 1,
    height: 78,
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
  },
  scoreBtnUndoText: {
    color: Colors.textTertiary,
    fontSize: 13,
    fontFamily: Typography.fontFamily.bold,
    letterSpacing: 0.5,
  },
  scoreBtnExtra: {
    flex: 1,
    height: 62,
    backgroundColor: Colors.primaryAlpha10,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.primaryAlpha30,
  },
  scoreBtnExtraText: {
    color: Colors.primary,
    fontSize: 15,
    fontFamily: Typography.fontFamily.bold,
    letterSpacing: 0.3,
  },
  // Legacy secondary style (used in end-innings panel)
  scoreBtnSecondary: {
    flex: 1,
    height: 60,
    backgroundColor: 'transparent',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreBtnTextSecondary: {
    color: Colors.primary,
    fontSize: 14,
    fontFamily: Typography.fontFamily.bold,
  },
  // Innings complete action buttons
  keypadActionBtn: {
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
  },
  keypadActionBtnSecondary: {
    backgroundColor: Colors.surfaceVariant,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  keypadActionBtnText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: Typography.fontFamily.bold,
    letterSpacing: 0.3,
  },
  keypadActionBtnSecondaryText: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontFamily: Typography.fontFamily.bold,
  },
  inningsCompleteTitle: {
    fontSize: 18,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 4,
  },
  inningsCompleteSubtitle: {
    fontSize: 13,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.base,
    fontStyle: 'italic',
  },
  tiedText: {
    fontSize: 16,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.warning,
    textAlign: 'center',
    marginBottom: 4,
  },
  textDark: { color: '#FFF' },

  readOnlyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    backgroundColor: Colors.surfaceVariant,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.xl,
    marginHorizontal: Spacing.md,
  },
  readOnlyText: {
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.medium,
    marginTop: 12,
    marginBottom: 20,
    textAlign: 'center',
  },

  // ── Modals ──
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: Colors.backgroundElevated, borderRadius: BorderRadius.lg, padding: 24, width: '100%' },
  modalTitle: { fontSize: 20, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary, marginBottom: 8 },
  modalSub: { fontSize: 14, fontFamily: Typography.fontFamily.medium, color: Colors.textSecondary, marginBottom: 20 },
  modalInput: { height: 50, borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.md, paddingHorizontal: 16, color: Colors.textPrimary, fontFamily: Typography.fontFamily.medium, fontSize: 16, marginBottom: 24 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  modalBtnCancel: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: BorderRadius.sm, backgroundColor: Colors.surfaceVariant },
  modalBtnTextCancel: { color: Colors.textPrimary, fontFamily: Typography.fontFamily.semiBold },
  modalBtnAdd: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: BorderRadius.sm, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  modalBtnTextAdd: { color: Colors.background || '#000000', fontFamily: Typography.fontFamily.bold },

  bottomSheetOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  bottomSheet: { backgroundColor: Colors.backgroundModal, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.xl },
  bsHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.lg },
  bsTitle: { color: '#FFF', fontSize: 20, fontFamily: Typography.fontFamily.bold },
  bsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  bsBtn: { width: '48%', height: 50, backgroundColor: Colors.surfaceVariant, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  bsBtnDanger: { backgroundColor: 'rgba(244,67,54,0.1)' },
  bsBtnText: { color: '#FFF', fontFamily: Typography.fontFamily.medium },

  // action button shared
  actionBtnPrimary: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginTop: Spacing.sm,
    alignSelf: 'center',
  },
  actionBtnText: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: 14,
    color: '#fff',
  },

  needsBowlerCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    gap: Spacing.md,
    marginVertical: Spacing.sm,
  },
  needsBowlerIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  needsBowlerTitle: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontFamily: Typography.fontFamily.bold,
  },
  needsBowlerSub: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontFamily: Typography.fontFamily.regular,
  },
  selectBowlerBtnAction: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: 50,
    borderRadius: BorderRadius.md,
    gap: 8,
  },
  selectBowlerBtnActionText: {
    color: '#000000',
    fontSize: 15,
    fontFamily: Typography.fontFamily.bold,
  },
});

export default LiveScorerScreen;
