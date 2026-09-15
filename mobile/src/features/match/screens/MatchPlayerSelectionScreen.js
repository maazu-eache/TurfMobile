import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
  TextInput,
  Image,
  Alert,
  FlatList,
  RefreshControl,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation, useRoute } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { fetchLiveState, setInitialPlayers, addMatchScorer, setLiveState } from '../matchSlice';
import socketService from '../../../services/socketService';
import api, { getImageUrl } from '../../../api/axios';
import { useTheme, Typography, Spacing, BorderRadius } from '../../../theme/theme';
import { showCustomAlert } from '../../../components/CustomAlert';

const MatchPlayerSelectionScreen = () => {
  const { colors, shadows, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const safeTop = Math.max(insets?.top || 0, Platform.OS === 'ios' ? 44 : 0);
  const safeBottom = Math.max(insets?.bottom || 0, Platform.OS === 'ios' ? 24 : 0);
  const styles = useMemo(() => createStyles(colors, shadows, isDark, safeTop, safeBottom), [colors, shadows, isDark, safeTop, safeBottom]);
  const route = useRoute();
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const { matchId, isAmbiguousStrike } = route.params;

  const { liveState, isLoading } = useSelector(state => state.match);
  const { user } = useSelector(state => state.auth);
  const isNavigatingRef = useRef(false);

  const [selectedStriker, setSelectedStriker] = useState(null);
  const [selectedNonStriker, setSelectedNonStriker] = useState(null);
  const [selectedBowler, setSelectedBowler] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Modal states
  const [activeSelectionMode, setActiveSelectionMode] = useState(null); // 'striker', 'nonStriker', 'bowler'
  const [showSquadModal, setShowSquadModal] = useState(false);
  const [showEditSquadModal, setShowEditSquadModal] = useState(false);

  // Settings & Scorer states
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showAddScorerModal, setShowAddScorerModal] = useState(false);
  const [newScorerMobile, setNewScorerMobile] = useState('');
  const [scorerSearchResult, setScorerSearchResult] = useState(null);
  const [isScorerSearching, setIsScorerSearching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

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

  const [scorerTab, setScorerTab] = useState('teamA');
  const [scorerAddingId, setScorerAddingId] = useState(null);

  const [showReviseModal, setShowReviseModal] = useState(false);
  const [revisedOvers, setRevisedOvers] = useState('');
  const [revisedTarget, setRevisedTarget] = useState('');

  const [showAbandonModal, setShowAbandonModal] = useState(false);
  const [abandonReason, setAbandonReason] = useState('');

  // Data states
  const [battingTeamRoster, setBattingTeamRoster] = useState([]);
  const [bowlingTeamRoster, setBowlingTeamRoster] = useState([]);

  const [isSavingSquad, setIsSavingSquad] = useState(false);

  // Scorecard for validations
  const [scorecards, setScorecards] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  const initializedRef = useRef(false);

  const batTeamId = String(liveState?.battingTeam?._id || liveState?.battingTeam || '');
  const teamAId = String(liveState?.match?.teamA?._id || liveState?.match?.teamA || '');
  const isTeamABatting = batTeamId === teamAId;

  const [battingSquad, setBattingSquad] = useState([]);
  const [bowlingSquad, setBowlingSquad] = useState([]);

  useEffect(() => {
    if (liveState?.match && !showEditSquadModal) {
      const XI_A = isTeamABatting ? liveState.match.playingXI?.teamA : liveState.match.playingXI?.teamB;
      const XI_B = isTeamABatting ? liveState.match.playingXI?.teamB : liveState.match.playingXI?.teamA;
      setBattingSquad((XI_A || []).filter(Boolean));
      setBowlingSquad((XI_B || []).filter(Boolean));
    }
  }, [liveState?.match?.playingXI, isTeamABatting, showEditSquadModal]);

  useEffect(() => {
    // Fetch live state if missing or for a different match (e.g. after clearing old state)
    if (!liveState || !liveState.match || String(liveState.match._id) !== String(matchId)) {
      dispatch(fetchLiveState(matchId));
    }
  }, [matchId, dispatch, liveState]);

  // Load team rosters and sync squads when liveState is ready
  useEffect(() => {
    if (isNavigatingRef.current) return;
    if (!liveState || !liveState.match) return;
    if (String(liveState.match._id) !== String(matchId)) return;

    const match = liveState.match;
    const batTeam = isTeamABatting ? match.teamA : match.teamB;
    const bowlTeam = isTeamABatting ? match.teamB : match.teamA;

    // Fetch full rosters only once
    if (battingTeamRoster.length === 0 && batTeam?._id) {
      fetchTeam(batTeam._id, setBattingTeamRoster);
    }
    if (bowlingTeamRoster.length === 0 && bowlTeam?._id) {
      fetchTeam(bowlTeam._id, setBowlingTeamRoster);
    }

    // Reactively sync selected players with liveState ONLY ONCE on initial load
    if (!initializedRef.current) {
      initializedRef.current = true;
      setSelectedStriker(liveState.striker || null);
      setSelectedNonStriker(liveState.nonStriker || null);
      setSelectedBowler(liveState.bowler || null);
    }

    // Fetch scorecards for validations if not loaded
    if (scorecards.length === 0) {
      fetchScorecards();
    }
  }, [liveState?.striker?._id, liveState?.nonStriker?._id, liveState?.bowler?._id, liveState?.match?.currentInnings, isTeamABatting]);

  const fetchScorecards = async () => {
    try {
      const res = await api.get(`/matches/${matchId}/scorecard`);
      setScorecards(res.data.data || []);
    } catch (e) {
      console.log('Error fetching scorecards', e);
    }
  };

  const fetchTeam = async (teamId, setRoster) => {
    try {
      const res = await api.get(`/teams/${teamId}`);
      setRoster(res.data.data.players.map(p => p.player));
    } catch (e) {
      console.log('Error fetching team', e);
    }
  };

  const onRefreshModal = async () => {
    setRefreshing(true);
    const activeTeamId = getActiveTeamId();
    if (activeTeamId) {
      const isBatting = activeSelectionMode === 'striker' || activeSelectionMode === 'nonStriker';
      if (isBatting) {
        await fetchTeam(activeTeamId, setBattingTeamRoster);
      } else {
        await fetchTeam(activeTeamId, setBowlingTeamRoster);
      }
    }
    setRefreshing(false);
  };

  const getActiveTeamId = () => {
    if (!liveState || !liveState.match) return null;
    const match = liveState.match;
    const isBatting = activeSelectionMode === 'striker' || activeSelectionMode === 'nonStriker';
    const isTeamABatting = liveState.battingTeam === match.teamA._id;

    if (isBatting) {
      return isTeamABatting ? match.teamA._id : match.teamB._id;
    } else {
      return isTeamABatting ? match.teamB._id : match.teamA._id;
    }
  };

  const handleStartScoring = async () => {
    const isSingleWicket = liveState?.match?.isSingleWicketBatting;
    const isMidInnings = liveState?.match?.status === 'in_progress';

    // If mid-innings, we only pick batters. If new innings, we need all three.
    if (!selectedStriker || (!selectedNonStriker && !isSingleWicket)) {
      return showCustomAlert('Error', 'Please select Striker and Non-Striker');
    }
    if (!isMidInnings && !selectedBowler) {
      return showCustomAlert('Error', 'Please select a Bowler');
    }
    if (!isSingleWicket && selectedStriker._id === selectedNonStriker?._id) {
      return showCustomAlert('Error', 'Striker and Non-Striker cannot be the same');
    }

    try {
      isNavigatingRef.current = true;
      setSubmitting(true);
      const payload = {
        matchId,
        striker: selectedStriker._id,
        nonStriker: selectedNonStriker._id,
      };
      if (!isMidInnings && selectedBowler) {
        payload.bowler = selectedBowler._id;
      }

      if (liveState) {
        dispatch(setLiveState({
          ...liveState,
          striker: selectedStriker,
          nonStriker: selectedNonStriker,
          bowler: selectedBowler || liveState.bowler,
          needsBowler: !selectedBowler && !isMidInnings ? false : liveState.needsBowler
        }));
      }

      const socket = socketService.getSocket();
      socket.emit('set_players', {
        matchId,
        striker: selectedStriker._id,
        nonStriker: selectedNonStriker?._id,
        bowler: selectedBowler?._id
      });

      setSubmitting(false);
      navigation.navigate('LiveScorer', { matchId, isAmbiguousStrike, skipFocusFetch: true });
    } catch (e) {
      setSubmitting(false);
      isNavigatingRef.current = false;
      showCustomAlert('Error', e?.message || 'Failed to start scoring.');
    }
  };

  const handleUndoLastBall = () => {
    showCustomAlert(
      'Undo Last Ball',
      'Are you sure you want to undo the last ball? This will take you back to the previous innings.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Undo',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/matches/${matchId}/ball`);
              await dispatch(fetchLiveState(matchId)).unwrap();
              navigation.navigate('LiveScorer', { matchId });
            } catch (error) {
              console.log('Error undoing ball:', error);
              showCustomAlert('Error', error.response?.data?.message || 'Failed to undo last ball');
            }
          }
        }
      ]
    );
  };

  const openSelection = (mode) => {
    setActiveSelectionMode(mode);
    setSearchQuery('');
    setShowSquadModal(true);
  };

  const handleSelectSquadPlayer = (player) => {
    if (activeSelectionMode === 'striker') setSelectedStriker(player);
    else if (activeSelectionMode === 'nonStriker') setSelectedNonStriker(player);
    else if (activeSelectionMode === 'bowler') setSelectedBowler(player);
    setShowSquadModal(false);
  };

  const toggleSquadMember = (player) => {
    const isBatting = activeSelectionMode === 'striker' || activeSelectionMode === 'nonStriker';
    const currentSquad = isBatting ? battingSquad : bowlingSquad;
    const otherSquad = isBatting ? bowlingSquad : battingSquad;
    const isMember = currentSquad.some(p => String(p._id || p) === String(player._id || player));

    if (isMember) {
      const newSquad = currentSquad.filter(p => String(p._id || p) !== String(player._id || player));
      if (isBatting) setBattingSquad(newSquad);
      else setBowlingSquad(newSquad);
    } else {
      const isInOtherSquad = otherSquad.some(p => String(p._id || p) === String(player._id || player));
      if (isInOtherSquad) {
        const match = liveState?.match;
        const isTeamABatting = liveState?.battingTeam === match?.teamA?._id;
        const otherTeamName = isBatting
          ? (isTeamABatting ? match?.teamB?.name : match?.teamA?.name)
          : (isTeamABatting ? match?.teamA?.name : match?.teamB?.name);

        showCustomAlert('Cannot Select Player', `This player is already in the playing squad for ${otherTeamName || 'the other team'}. A player cannot play for both teams.`);
      } else {
        const newSquad = [...currentSquad, player];
        if (isBatting) setBattingSquad(newSquad);
        else setBowlingSquad(newSquad);
      }
    }
  };

  const saveSquads = async () => {
    setIsSavingSquad(true);
    try {
      const match = liveState.match;
      const isTeamABatting = liveState.battingTeam === match.teamA._id;

      const teamA_Squad = isTeamABatting ? battingSquad.map(p => p._id) : bowlingSquad.map(p => p._id);
      const teamB_Squad = isTeamABatting ? bowlingSquad.map(p => p._id) : battingSquad.map(p => p._id);

      await api.post(`/matches/${matchId}/playing-xi`, {
        teamA: teamA_Squad,
        teamB: teamB_Squad,
      });
      // Refresh live state
      dispatch(fetchLiveState(matchId));
      setShowEditSquadModal(false);
    } catch (e) {
      showCustomAlert('Error', 'Failed to update squad');
    } finally {
      setIsSavingSquad(false);
    }
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

  const submitAbandon = async () => {
    if (!abandonReason) return showCustomAlert('Error', 'Please enter a reason');
    executeSettingsAction('abandon', abandonReason);
    setShowAbandonModal(false);
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

  const executeSettingsAction = async (action, extraParam) => {
    try {
      if (action === 'abandon') {
        await api.put(`/matches/${matchId}/abandon`, { reason: extraParam });
        dispatch(fetchLiveState(matchId));
        // Use replace so the back stack is cleared — user lands on MatchSummary
        // and cannot navigate back into the live scorer or player selection.
        navigation.replace('MatchSummary', { matchId });
      } else if (action === 'declare_dls') {
        await api.put(`/matches/${matchId}/declare-dls`);
        const res = await dispatch(fetchLiveState(matchId)).unwrap();
        showCustomAlert('Success', res?.completedReason ? 'Match ended (DLS Method)' : 'Match ended (DLS Method)');
        navigation.replace('MatchSummary', { matchId });
      }
    } catch (e) {
      showCustomAlert('Error', e.response?.data?.message || 'Failed to update settings');
    }
  };

  const handleSettingsAction = async (action) => {
    setShowSettingsModal(false);

    if (action === 'add_scorer') {
      setShowAddScorerModal(true);
    } else if (action === 'revise_overs') {
      setRevisedOvers(String(match?.overs || ''));
      setRevisedTarget('');
      setShowReviseModal(true);
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
    } else {
      executeSettingsAction(action);
    }
  };



  if (!liveState || !liveState.match) {
    return (
      <View style={[styles.centerContainer, { paddingTop: safeTop }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const match = liveState.match;
  const batTeam = isTeamABatting ? match.teamA : match.teamB;
  const bowlTeam = isTeamABatting ? match.teamB : match.teamA;

  const renderPlayerSelectionCard = (title, selectedPlayer, mode, disabled = false) => {
    const isBowler = mode === 'bowler';
    const accentColor = isBowler ? '#F59E0B' : colors.primary;
    const ringColor = selectedPlayer ? accentColor : colors.border;
    // Resolve photo from multiple possible paths
    const photoUrl = selectedPlayer
      ? (selectedPlayer.photo || selectedPlayer.userId?.photo || selectedPlayer.avatar || null)
      : null;

    return (
      <View style={[styles.selectionWrapper, disabled && { opacity: 0.55 }]}>
        <TouchableOpacity
          style={[styles.selectionCard, { borderColor: ringColor }]}
          onPress={() => openSelection(mode)}
          disabled={disabled}
          activeOpacity={0.75}
        >
          {/* Outer glow ring when selected */}
          {selectedPlayer && (
            <View style={[styles.selectionRing, { borderColor: accentColor + '40' }]} />
          )}
          {selectedPlayer ? (
            photoUrl ? (
              <Image
                key="photo"
                source={{ uri: getImageUrl(photoUrl) }}
                style={styles.selectionCardImage}
                resizeMode="cover"
              />
            ) : (
              <View key="avatar" style={[styles.selectionAvatarPlaceholder, { backgroundColor: accentColor + '25' }]}>
                <Text style={[styles.selectionAvatarText, { color: accentColor }]}>{selectedPlayer.name.charAt(0).toUpperCase()}</Text>
              </View>
            )
          ) : (
            <View key="empty" style={styles.selectionAvatarPlaceholderEmpty}>
              <Icon name="plus-circle-outline" size={32} color={colors.textTertiary} />
            </View>
          )}
          {/* Role badge */}
        </TouchableOpacity>
        <Text style={[styles.selectionCardTitle, { color: accentColor }]}>{title}</Text>
        <Text style={styles.selectionPlayerName} numberOfLines={1}>
          {selectedPlayer ? selectedPlayer.name : 'Tap to pick'}
        </Text>
        {selectedPlayer && (
          <View style={[styles.changeHint, { borderColor: accentColor + '40' }]}>
            <Text style={[styles.changeHintText, { color: accentColor }]}>Change</Text>
          </View>
        )}
      </View>
    );
  };



  const creatorId = typeof liveState?.match?.creator === 'object' ? liveState?.match?.creator?._id : liveState?.match?.creator;
  const isCreator = String(creatorId) === String(user?._id);
  const isMatchActive = !['completed', 'abandoned'].includes(liveState?.match?.status);

  return (
    <View style={[styles.safe, { paddingTop: safeTop }]}>
      {submitting && (
        <View style={[StyleSheet.absoluteFill, { zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' }]}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      )}

      {/* Premium Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="chevron-left" size={28} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.headerTitle}>
            {liveState?.match?.status === 'in_progress' ? 'New Batter' : 'Player Selection'}
          </Text>
          <Text style={styles.headerSubtitle}>
            Innings {liveState?.inningsNumber || 1}
          </Text>
        </View>
        <TouchableOpacity onPress={() => setShowSettingsModal(true)} style={styles.headerActionBtn}>
          <Icon name="cog" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <KeyboardAwareScrollView enableOnAndroid={true} extraScrollHeight={20} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>

        {/* Target Banner for 2nd Innings */}
        {liveState?.inningsNumber === 2 && liveState?.target ? (
          <View style={styles.targetCard}>
            {/* Header sub-row: Match situation pill & context */}
            <View style={styles.targetCardHeader}>
              <View style={styles.targetBadgeLive}>
                <View style={styles.targetLiveDot} />
                <Text style={styles.targetBadgeText}>2ND INNINGS CHASE</Text>
              </View>
              {liveState?.isDlsTarget ? (
                <View style={styles.targetDlsBadge}>
                  <Icon name="weather-lightning-rainy" size={12} color="#0284C7" style={{ marginRight: 4 }} />
                  <Text style={styles.targetDlsText}>DLS REVISED</Text>
                </View>
              ) : (
                <Text style={styles.targetTeamChaseText} numberOfLines={1}>
                  {batTeam?.name ? `${batTeam.name} Chase` : 'Chase Equation'}
                </Text>
              )}
            </View>

            {/* Metrics Row */}
            <View style={styles.targetMetricsRow}>
              {/* Target */}
              <View style={styles.targetMetricCol}>
                <View style={[styles.targetIconPill, { backgroundColor: 'rgba(239, 68, 68, 0.08)' }]}>
                  <Icon name="target" size={12} color="#EF4444" style={{ marginRight: 4 }} />
                  <Text style={[styles.targetMetricLabel, { color: '#EF4444' }]}>TARGET</Text>
                </View>
                <Text style={styles.targetBigNum}>{liveState.target}</Text>
              </View>

              <View style={styles.targetMetricDivider} />

              {/* RRR */}
              <View style={styles.targetMetricCol}>
                <View style={[styles.targetIconPill, { backgroundColor: 'rgba(245, 158, 11, 0.08)' }]}>
                  <Icon name="flash" size={12} color="#F59E0B" style={{ marginRight: 4 }} />
                  <Text style={[styles.targetMetricLabel, { color: '#F59E0B' }]}>REQ. RATE</Text>
                </View>
                <Text style={styles.targetBigNum}>{liveState.requiredRunRate || '0.00'}</Text>
              </View>

              <View style={styles.targetMetricDivider} />

              {/* Need */}
              <View style={[styles.targetMetricCol, { flex: 1.3 }]}>
                <View style={[styles.targetIconPill, { backgroundColor: 'rgba(59, 130, 246, 0.08)' }]}>
                  <Icon name="flag-checkered" size={12} color="#3B82F6" style={{ marginRight: 4 }} />
                  <Text style={[styles.targetMetricLabel, { color: '#3B82F6' }]}>EQUATION</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 1 }}>
                  <Text style={[styles.targetBigNum, { color: '#2563EB' }]}>{liveState.toWin}</Text>
                  <Text style={styles.targetEquationSub}> off </Text>
                  <Text style={styles.targetBigNum}>{liveState.ballsRemaining}</Text>
                  <Text style={styles.targetEquationSub}>b</Text>
                </View>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.contextBanner}>
            <Icon name={liveState?.match?.status === 'in_progress' ? 'account-switch' : 'flag-checkered'} size={18} color={colors.primary} />
            <Text style={styles.contextBannerText}>
              {liveState?.match?.status === 'in_progress'
                ? 'Select the new batter(s) to continue scoring.'
                : 'Choose your opening batters and opening bowler.'}
            </Text>
          </View>
        )}

        {/* BATTERS SECTION */}
        <View style={styles.sectionLabelRow}>
          <View style={[styles.sectionDot, { backgroundColor: colors.primary }]} />
          <Text style={styles.sectionHeader}>BATTERS</Text>
          <Text style={styles.sectionTeamName}>{batTeam?.name}</Text>
        </View>
        <View style={styles.selectionContainerCard}>
          <View style={styles.selectionRow}>
            {renderPlayerSelectionCard('Striker', selectedStriker, 'striker', !!liveState?.striker)}
            <View style={styles.selectionVerticalDivider} />
            {renderPlayerSelectionCard('Non-Striker', selectedNonStriker, 'nonStriker', !!liveState?.nonStriker)}
          </View>
        </View>

        {/* BOWLER SECTION */}
        {liveState?.match?.status !== 'in_progress' && (
          <>
            <View style={styles.sectionLabelRow}>
              <View style={[styles.sectionDot, { backgroundColor: '#F59E0B' }]} />
              <Text style={[styles.sectionHeader, { color: '#F59E0B' }]}>BOWLER</Text>
              <Text style={styles.sectionTeamName}>{bowlTeam?.name}</Text>
            </View>
            <View style={styles.selectionContainerCard}>
              <View style={[styles.selectionRow, { justifyContent: 'center' }]}>
                {renderPlayerSelectionCard('Opening Bowler', selectedBowler, 'bowler', !!liveState?.bowler)}
              </View>
            </View>
          </>
        )}

      </KeyboardAwareScrollView>

      {/* Premium Footer with Score */}
      <View style={styles.footer}>
        {liveState?.score ? (
          <View style={styles.scoreFooterBanner}>
            <View style={styles.scoreFooterLeft}>
              <Icon name="cricket" size={14} color={colors.primary} style={{ marginRight: 6 }} />
              <Text style={styles.scoreFooterTeam} numberOfLines={1}>{batTeam?.name || 'Batting Team'}</Text>
            </View>
            <Text style={styles.scoreFooterScore}>
              {liveState.score.runs}/{liveState.score.wickets}
              <Text style={styles.scoreFooterOvers}> ({liveState.score.overs} ov)</Text>
            </Text>
          </View>
        ) : null}
        <TouchableOpacity style={styles.startBtn} onPress={handleStartScoring}>
          <Icon name={liveState?.match?.status === 'in_progress' ? 'check-circle' : 'play-circle'} size={20} color="#000" style={{ marginRight: 8 }} />
          <Text style={styles.startBtnText}>
            {liveState?.match?.status === 'in_progress' ? 'Save & Continue' : 'Start Scoring'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* SQUAD MODAL */}
      {showSquadModal ? (
        <Modal visible={true} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.pullHandle} />
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select from Squad</Text>
                <TouchableOpacity onPress={() => setShowSquadModal(false)}>
                  <Icon name="close" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>

              {/* Search Input */}
              <View style={styles.searchBarContainer}>
                <Icon name="magnify" size={20} color={colors.textTertiary} style={{ marginRight: 8 }} />
                <TextInput
                  placeholder="Search player..."
                  placeholderTextColor={colors.textTertiary}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  style={styles.searchInput}
                />
                {searchQuery ? (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <Icon name="close-circle" size={18} color={colors.textTertiary} />
                  </TouchableOpacity>
                ) : null}
              </View>

              <KeyboardAwareScrollView enableOnAndroid={true} extraScrollHeight={20} keyboardShouldPersistTaps="handled" style={styles.modalList} contentContainerStyle={{ paddingBottom: Spacing.md }}>
                {(activeSelectionMode === 'bowler' ? bowlingSquad : battingSquad)
                  .filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map((p, idx) => {
                    // Determine if player should be disabled
                    let isDisabled = false;
                    let disabledReason = '';

                    const currentInnings = liveState?.match?.currentInnings || 1;
                    const currentScorecard = scorecards.find(sc => sc.inningsNumber === currentInnings);

                    if (activeSelectionMode === 'striker' || activeSelectionMode === 'nonStriker') {
                      // Cannot select if already the OTHER selected batter
                      const isAlreadyOtherBatter = (activeSelectionMode === 'striker' && selectedNonStriker?._id === p._id) ||
                        (activeSelectionMode === 'nonStriker' && selectedStriker?._id === p._id);
                      if (isAlreadyOtherBatter) {
                        isDisabled = true;
                        disabledReason = 'Already batting';
                      } else {
                        // Check if dismissed
                        const fow = liveState?.match?.innings?.[currentInnings - 1]?.fallOfWickets || [];
                        const isDismissed = fow.some(f => String(f.batsman) === String(p._id) || String(f.batsman?._id) === String(p._id));

                        // Optimistic check: if they have batted but are no longer active striker or non-striker
                        let isNoLongerActive = false;
                        if (currentScorecard) {
                          const batterStat = currentScorecard.batting.find(b => String(b.player?._id || b.player) === String(p._id));
                          if (batterStat) {
                            const isCurrentlyStriker = String(selectedStriker?._id || selectedStriker) === String(p._id);
                            const isCurrentlyNonStriker = String(selectedNonStriker?._id || selectedNonStriker) === String(p._id);
                            if (!isCurrentlyStriker && !isCurrentlyNonStriker) {
                              isNoLongerActive = true;
                            }
                          }
                        }

                        if (isDismissed || isNoLongerActive) {
                          isDisabled = true;
                          disabledReason = 'Dismissed';
                        }
                      }
                    } else if (activeSelectionMode === 'bowler') {
                      // Check quota
                      if (currentScorecard) {
                        const bowlerStat = currentScorecard.bowling.find(b => b.player?._id === p._id || b.player === p._id);
                        if (bowlerStat) {
                          const quota = liveState?.match?.bowlerQuota || Math.ceil(liveState?.match?.overs / 5) || 1;
                          if (bowlerStat.overs >= quota) {
                            isDisabled = true;
                            disabledReason = 'Quota exhausted';
                          }
                        }
                      }
                    }

                    let playerStatsStr = '';
                    if (currentScorecard) {
                      if (activeSelectionMode === 'striker' || activeSelectionMode === 'nonStriker') {
                        const batterStat = currentScorecard.batting.find(b => b.player?._id === p._id || b.player === p._id);
                        if (batterStat) {
                          playerStatsStr = `${batterStat.runs} (${batterStat.balls})`;
                        }
                      } else if (activeSelectionMode === 'bowler') {
                        const bowlerStat = currentScorecard.bowling.find(b => b.player?._id === p._id || b.player === p._id);
                        if (bowlerStat) {
                          playerStatsStr = `${bowlerStat.wickets}-${bowlerStat.runs} in ${bowlerStat.overs} ${bowlerStat.overs === 1 ? 'over' : 'overs'}`;
                        }
                      }
                    }

                    return (
                      <TouchableOpacity
                        key={p._id + '_' + idx}
                        style={[styles.modalListItem, isDisabled && { opacity: 0.5 }]}
                        onPress={() => {
                          if (isDisabled) return showCustomAlert('Info', `Cannot select player: ${disabledReason}`);
                          handleSelectSquadPlayer(p);
                        }}
                      >
                        <View style={styles.avatarPlaceholderSm}>
                          {(p.photo || p.userId?.photo || p.avatar) ? (
                            <Image
                              source={{ uri: getImageUrl(p.photo || p.userId?.photo || p.avatar) }}
                              style={{ width: '100%', height: '100%', borderRadius: 21 }}
                              resizeMode="cover"
                            />
                          ) : (
                            <Text style={styles.avatarTextSm}>{p.name.charAt(0).toUpperCase()}</Text>
                          )}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.modalListText}>{p.name}</Text>
                          {!!playerStatsStr && (
                            <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                              {playerStatsStr}
                            </Text>
                          )}
                          {isDisabled ? <Text style={{ fontSize: 12, color: colors.error, marginTop: 2 }}>{disabledReason}</Text> : null}
                        </View>
                        {!isDisabled ? (
                          <Icon name="chevron-right" size={20} color={colors.textTertiary} />
                        ) : null}
                      </TouchableOpacity>
                    );
                  })}
                {(activeSelectionMode === 'bowler' ? bowlingSquad : battingSquad).length === 0 ? (
                  <Text style={styles.emptyText}>Squad is empty.</Text>
                ) : null}
              </KeyboardAwareScrollView>
              <TouchableOpacity
                style={styles.editSquadBtn}
                onPress={() => {
                  setShowSquadModal(false);
                  setShowEditSquadModal(true);
                }}
              >
                <Icon name="pencil" size={20} color={colors.primary} />
                <Text style={styles.editSquadBtnText}>Edit Squad / Add Player</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      ) : null}

      {/* EDIT SQUAD MODAL */}
      {showEditSquadModal ? (
        <Modal visible={true} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContentFull}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Edit Playing XI</Text>
                <TouchableOpacity onPress={() => setShowEditSquadModal(false)}>
                  <Icon name="close" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>
              <Text style={styles.instructionText}>Check the players you want in the playing XI. Pull down to refresh.</Text>

              <KeyboardAwareScrollView
                enableOnAndroid={true}
                extraScrollHeight={20}
                keyboardShouldPersistTaps="handled"
                style={styles.modalList}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefreshModal} colors={[colors.primary]} tintColor={colors.primary} />}
              >
                {(activeSelectionMode === 'bowler' ? bowlingTeamRoster : battingTeamRoster).map((p, idx) => {
                  const currentSquad = activeSelectionMode === 'bowler' ? bowlingSquad : battingSquad;
                  const isSelected = currentSquad.some(s => String(s._id || s) === String(p._id || p));
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
              </KeyboardAwareScrollView>

              <View style={styles.editSquadFooter}>
                <TouchableOpacity
                  style={styles.addNewBtn}
                  onPress={() => {
                    setShowEditSquadModal(false);
                    const teamId = getActiveTeamId();
                    const isBatting = activeSelectionMode === 'striker' || activeSelectionMode === 'nonStriker';
                    const roster = isBatting ? battingTeamRoster : bowlingTeamRoster;
                    const oppositionRoster = isBatting ? bowlingTeamRoster : battingTeamRoster;
                    const squad = isBatting ? battingSquad : bowlingSquad;

                    navigation.navigate('AddPlayer', {
                      teamId,
                      matchId,
                      roster,
                      oppositionRoster,
                      squad,
                      onClose: () => setShowEditSquadModal(true),
                      onPlayerAdded: async (newPlayer) => {
                        const isBattingLocal = activeSelectionMode === 'striker' || activeSelectionMode === 'nonStriker';
                        try {
                          const currentTeamA_XI = match?.playingXI?.teamA?.map(p => p._id || p) || [];
                          const currentTeamB_XI = match?.playingXI?.teamB?.map(p => p._id || p) || [];

                          const isTeamABattingLocal = liveState.battingTeam === match.teamA._id;
                          if (isBattingLocal) {
                            if (isTeamABattingLocal) {
                              currentTeamA_XI.push(newPlayer._id);
                            } else {
                              currentTeamB_XI.push(newPlayer._id);
                            }
                          } else {
                            if (isTeamABattingLocal) {
                              currentTeamB_XI.push(newPlayer._id);
                            } else {
                              currentTeamA_XI.push(newPlayer._id);
                            }
                          }

                          await api.post(`/matches/${matchId}/playing-xi`, {
                            teamA: currentTeamA_XI,
                            teamB: currentTeamB_XI
                          });

                          // Reload roster synchronously for immediate UI update
                          const activeTeamId = getActiveTeamId();
                          if (isBattingLocal) {
                            setBattingTeamRoster(prev => {
                              const exists = prev.some(p => p._id === newPlayer._id);
                              return exists ? prev : [...prev, newPlayer];
                            });
                            setBattingSquad(prev => {
                              const exists = prev.some(p => p._id === newPlayer._id);
                              return exists ? prev : [...prev, newPlayer];
                            });
                            fetchTeam(activeTeamId, setBattingTeamRoster);
                          } else {
                            setBowlingTeamRoster(prev => {
                              const exists = prev.some(p => p._id === newPlayer._id);
                              return exists ? prev : [...prev, newPlayer];
                            });
                            setBowlingSquad(prev => {
                              const exists = prev.some(p => p._id === newPlayer._id);
                              return exists ? prev : [...prev, newPlayer];
                            });
                            fetchTeam(activeTeamId, setBowlingTeamRoster);
                          }

                          // Refresh live state
                          const res = await api.get(`/matches/${matchId}/live`);
                          dispatch(setLiveState(res.data.data));

                          // Instantly reopen modal
                          setShowEditSquadModal(true);
                        } catch (e) {
                          console.log('Error adding player to playing XI:', e);
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
            </View>
          </View>
        </Modal>
      ) : null}



      {/* Settings Modal (Right Sidebar) */}
      {showSettingsModal ? (
        <Modal visible={true} transparent animationType="fade" onRequestClose={() => setShowSettingsModal(false)}>
          <TouchableOpacity
            style={styles.sidebarBackdrop}
            activeOpacity={1}
            onPress={() => setShowSettingsModal(false)}
          >
            <TouchableOpacity
              activeOpacity={1}
              style={styles.sidebarSheet}
            >
              {/* Sidebar Header */}
              <View style={styles.sidebarHeader}>
                <View style={styles.sidebarHeaderLeft}>
                  <View style={styles.sidebarHeaderIconBadge}>
                    <Icon name="cog" size={20} color={colors.primary} />
                  </View>
                  <View>
                    <Text style={styles.sidebarHeaderTitle}>Match Controls</Text>
                    <Text style={styles.sidebarHeaderSub}>Innings {liveState?.inningsNumber || 1} Settings</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.sidebarCloseBtn}
                  onPress={() => setShowSettingsModal(false)}
                  activeOpacity={0.7}
                >
                  <Icon name="close" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <View style={styles.sidebarHairline} />

              <KeyboardAwareScrollView
                enableOnAndroid={true}
                extraScrollHeight={20}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: Math.max(safeBottom, 20) }}
              >
                {/* MATCH MANAGEMENT SECTION */}
                <Text style={styles.sidebarSectionTitle}>Match Management</Text>

                {isCreator && isMatchActive ? (
                  <TouchableOpacity
                    style={styles.sidebarCard}
                    activeOpacity={0.7}
                    onPress={() => handleSettingsAction('add_scorer')}
                  >
                    <View style={[styles.sidebarCardIconBox, { backgroundColor: 'rgba(59, 130, 246, 0.12)' }]}>
                      <Icon name="account-plus-outline" size={20} color="#3B82F6" />
                    </View>
                    <View style={styles.sidebarCardBody}>
                      <Text style={styles.sidebarCardTitle}>Add / Change Scorer</Text>
                      <Text style={styles.sidebarCardDesc}>Delegate match scoring permissions</Text>
                    </View>
                    <Icon name="chevron-right" size={18} color={colors.textTertiary} />
                  </TouchableOpacity>
                ) : null}

                {/* 2ND INNINGS SETTINGS */}
                {liveState?.inningsNumber >= 2 && (
                  <>
                    <Text style={[styles.sidebarSectionTitle, { marginTop: 16 }]}>2nd Innings Rain / Rules</Text>

                    <TouchableOpacity
                      style={styles.sidebarCard}
                      activeOpacity={0.7}
                      onPress={() => handleSettingsAction('revise_overs')}
                    >
                      <View style={[styles.sidebarCardIconBox, { backgroundColor: 'rgba(14, 165, 233, 0.12)' }]}>
                        <Icon name="weather-lightning-rainy" size={20} color="#0EA5E9" />
                      </View>
                      <View style={styles.sidebarCardBody}>
                        <Text style={styles.sidebarCardTitle}>Revised Target (Rain / DLS)</Text>
                        <Text style={styles.sidebarCardDesc}>Reduce total overs & recalculate target</Text>
                      </View>
                      <Icon name="chevron-right" size={18} color={colors.textTertiary} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.sidebarCard}
                      activeOpacity={0.7}
                      onPress={() => handleSettingsAction('declare_dls')}
                    >
                      <View style={[styles.sidebarCardIconBox, { backgroundColor: 'rgba(139, 92, 246, 0.12)' }]}>
                        <Icon name="scale-balance" size={20} color="#8B5CF6" />
                      </View>
                      <View style={styles.sidebarCardBody}>
                        <Text style={styles.sidebarCardTitle}>Declare Winner via DLS</Text>
                        <Text style={styles.sidebarCardDesc}>Conclude match using official DLS method</Text>
                      </View>
                      <Icon name="chevron-right" size={18} color={colors.textTertiary} />
                    </TouchableOpacity>
                  </>
                )}

                {/* CRITICAL ACTIONS SECTION */}
                {isCreator && isMatchActive ? (
                  <>
                    <Text style={[styles.sidebarSectionTitle, { marginTop: 20 }]}>Danger Zone</Text>

                    <TouchableOpacity
                      style={styles.sidebarDangerCard}
                      activeOpacity={0.7}
                      onPress={() => handleSettingsAction('abandon')}
                    >
                      <View style={styles.sidebarDangerIconBox}>
                        <Icon name="cancel" size={20} color={colors.error} />
                      </View>
                      <View style={styles.sidebarCardBody}>
                        <Text style={styles.sidebarDangerTitle}>Abandon Match</Text>
                        <Text style={styles.sidebarDangerDesc}>Irreversible — match will be void</Text>
                      </View>
                      <Icon name="alert-circle-outline" size={18} color={colors.error} />
                    </TouchableOpacity>
                  </>
                ) : null}
              </KeyboardAwareScrollView>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      ) : null}

      {/* Add / Change Scorer Modal */}
      {showAddScorerModal ? (
        <Modal visible={true} transparent animationType="slide" onRequestClose={() => setShowAddScorerModal(false)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
            <View style={{ backgroundColor: colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '85%', paddingBottom: 30 }}>
              {/* Header */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <Text style={{ fontSize: 18, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary }}>Add / Change Scorer</Text>
                <TouchableOpacity onPress={() => { setShowAddScorerModal(false); setNewScorerMobile(''); }}>
                  <Icon name="close" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Tab Bar */}
              <View style={{ flexDirection: 'row', marginHorizontal: 16, marginTop: 14, backgroundColor: colors.surface, borderRadius: 10, padding: 3 }}>
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
                      scorerTab === tab.key && { backgroundColor: colors.primary },
                    ]}
                  >
                    <Text
                      numberOfLines={1}
                      style={{
                        fontSize: 11,
                        fontFamily: Typography.fontFamily.semiBold,
                        color: scorerTab === tab.key ? '#000' : colors.textSecondary,
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
                  <Text style={{ color: colors.textSecondary, marginBottom: 10, fontSize: 13 }}>Enter mobile number to search and add scorer:</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.border }}>
                    <Icon name="phone-outline" size={20} color={colors.textTertiary} />
                    <TextInput
                      style={{ flex: 1, color: colors.textPrimary, fontSize: 15, paddingVertical: 12, marginLeft: 8 }}
                      placeholder="10-digit mobile number"
                      placeholderTextColor={colors.textTertiary}
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
                    {isScorerSearching && <ActivityIndicator color={colors.primary} size="small" />}
                  </View>

                  {scorerSearchResult && scorerSearchResult.exists && (
                    <View style={{ marginTop: 16, backgroundColor: colors.surfaceVariant, padding: 12, borderRadius: 12, flexDirection: 'row', alignItems: 'center' }}>
                      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primaryAlpha20, justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                        <Text style={{ color: colors.primary, fontFamily: Typography.fontFamily.bold, fontSize: 16 }}>
                          {(scorerSearchResult.user?.name || 'U').charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.textPrimary, fontFamily: Typography.fontFamily.semiBold, fontSize: 15 }}>
                          {scorerSearchResult.user?.name || 'Registered User'}
                        </Text>
                        <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Registered User</Text>
                      </View>
                    </View>
                  )}

                  {scorerSearchResult && !scorerSearchResult.exists && (
                    <Text style={{ color: colors.error, fontSize: 13, marginTop: 12, textAlign: 'center' }}>
                      User not found. Please enter a registered user's number.
                    </Text>
                  )}

                  <TouchableOpacity
                    style={[
                      styles.settingsModalBtnAdd,
                      { marginTop: 16, width: '100%', borderRadius: 10, height: 48, justifyContent: 'center', alignItems: 'center', opacity: (scorerSearchResult && scorerSearchResult.exists && !isLoading) ? 1 : 0.5 }
                    ]}
                    onPress={handleAddScorer}
                    disabled={!scorerSearchResult?.exists || isLoading}
                  >
                    <Text style={[styles.settingsModalBtnTextAdd, { fontSize: 15 }]}>{isLoading ? 'Adding...' : 'Add Scorer'}</Text>
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
                  initialNumToRender={10}
                  maxToRenderPerBatch={10}
                  windowSize={5}
                  removeClippedSubviews={Platform.OS === 'android'}
                  contentContainerStyle={{ padding: 16, gap: 10 }}
                  showsVerticalScrollIndicator={false}
                  ListEmptyComponent={() => (
                    <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                      <Icon name="account-group-outline" size={48} color={colors.textTertiary} />
                      <Text style={{ color: colors.textTertiary, marginTop: 10, fontSize: 14 }}>No players available</Text>
                      <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 4 }}>All players may already be scorers</Text>
                    </View>
                  )}
                  renderItem={({ item }) => {
                    const name = item.name || item.userId?.name || 'Unknown';
                    const role = item.playingRole || item.userId?.role || '';
                    const photo = item.photo || item.userId?.photo;
                    const pid = item._id || item.userId?._id;
                    const isAdding = scorerAddingId === pid;
                    return (
                      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: colors.border }}>
                        {/* Avatar */}
                        {photo ? (
                          <Image source={{ uri: getImageUrl(photo) }} style={{ width: 44, height: 44, borderRadius: 22, marginRight: 12 }} />
                        ) : (
                          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primaryAlpha20, justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                            <Text style={{ color: colors.primary, fontFamily: Typography.fontFamily.bold, fontSize: 18 }}>{name.charAt(0).toUpperCase()}</Text>
                          </View>
                        )}
                        {/* Name & Role */}
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: colors.textPrimary, fontFamily: Typography.fontFamily.semiBold, fontSize: 15 }}>{name}</Text>
                          {role ? <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 2 }}>{role}</Text> : null}
                        </View>
                        {/* Add Button */}
                        <TouchableOpacity
                          onPress={() => handleAddScorerFromPlayer(item)}
                          disabled={isAdding}
                          style={{
                            backgroundColor: isAdding ? colors.border : colors.primary,
                            paddingHorizontal: 14,
                            paddingVertical: 8,
                            borderRadius: 8,
                          }}
                        >
                          {isAdding
                            ? <Icon name="loading" size={16} color={colors.textSecondary} />
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
      {/* Revise Match Modal (Rain/DLS) */}
      {showReviseModal ? (
        <Modal visible={true} transparent animationType="fade">
          <View style={styles.settingsModalOverlay}>
            <View style={styles.settingsModalContent}>
              <Text style={styles.settingsModalTitle}>Revise Match</Text>
              <Text style={styles.settingsModalSub}>Reduce overs due to rain or other interruptions.</Text>

              <Text style={{ color: colors.textSecondary, marginBottom: 8 }}>Revised Total Overs:</Text>
              <TextInput
                style={styles.settingsModalInput}
                keyboardType="numeric"
                value={revisedOvers}
                onChangeText={setRevisedOvers}
              />

              {liveState?.inningsNumber === 2 && (
                <>
                  <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 10 }}>Note: The revised target will be automatically calculated using the DLS method.</Text>
                </>
              )}

              <View style={styles.settingsModalActions}>
                <TouchableOpacity style={styles.settingsModalBtnCancel} onPress={() => setShowReviseModal(false)}>
                  <Text style={styles.settingsModalBtnTextCancel}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.settingsModalBtnAdd} onPress={submitReviseMatch}>
                  <Text style={styles.settingsModalBtnTextAdd}>Save Revision</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
      {/* Abandon Match Modal */}
      {showAbandonModal ? (
        <Modal visible={true} transparent animationType="fade">
          <View style={styles.settingsModalOverlay}>
            <View style={styles.settingsModalContent}>
              <Text style={styles.settingsModalTitle}>Abandon Match</Text>
              <Text style={styles.settingsModalSub}>Are you sure you want to abandon this match? This action cannot be undone.</Text>

              <Text style={{ color: colors.textSecondary, marginBottom: 8, marginTop: 10 }}>Reason for abandoning:</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                {['Rain', 'Bad Light', 'Pitch Unplayable', 'Other'].map(r => (
                  <TouchableOpacity
                    key={r}
                    style={{ backgroundColor: abandonReason === r ? colors.primary : colors.surface, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1, borderColor: abandonReason === r ? colors.primary : colors.border }}
                    onPress={() => setAbandonReason(r)}
                  >
                    <Text style={{ color: abandonReason === r ? '#000' : colors.textPrimary, fontSize: 12 }}>{r}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput
                style={[styles.settingsModalInput, { height: 80 }]}
                placeholder="Type custom reason here (Optional)"
                placeholderTextColor={colors.textTertiary}
                value={abandonReason}
                onChangeText={setAbandonReason}
                multiline
              />

              <View style={styles.settingsModalActions}>
                <TouchableOpacity style={styles.settingsModalBtnCancel} onPress={() => setShowAbandonModal(false)}>
                  <Text style={styles.settingsModalBtnTextCancel}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.settingsModalBtnAdd, { backgroundColor: colors.error }]} onPress={submitAbandon}>
                  <Text style={[styles.settingsModalBtnTextAdd, { color: '#FFF' }]}>Abandon Match</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
};

const createStyles = (colors, shadows, isDark, safeTop = 0, safeBottom = 0) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background, overflow: 'hidden' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    backgroundColor: colors.surface,
  },
  backBtn: { padding: 4 },
  headerTitle: {
    fontSize: 17,
    fontFamily: Typography.fontFamily.bold,
    color: colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.medium,
    color: colors.textSecondary,
    marginTop: 1,
  },
  content: { padding: Spacing.base, paddingBottom: Spacing.xl, flexGrow: 1 },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: Spacing.xl,
    textAlign: 'center',
  },
  contextBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryAlpha10,
    borderRadius: BorderRadius.sm,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: Spacing.lg,
    gap: 10,
  },
  contextBannerText: {
    flex: 1,
    fontSize: 13,
    fontFamily: Typography.fontFamily.medium,
    color: colors.textSecondary,
  },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    gap: 8,
  },
  sectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sectionTeamName: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.medium,
    color: colors.textTertiary,
    marginLeft: 'auto',
  },
  cardsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  cardHalf: {
    flex: 1,
  },
  scorerCard: {
    backgroundColor: colors.surface,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderLeftWidth: 4,
    borderLeftColor: colors.accent,
  },
  scorerTitle: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.bold,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.md,
  },
  scorerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scorerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  scorerInfo: {
    flex: 1,
  },
  scorerName: {
    fontSize: 16,
    fontFamily: Typography.fontFamily.bold,
    color: colors.textPrimary,
  },
  scorerRole: {
    fontSize: 13,
    fontFamily: Typography.fontFamily.medium,
    color: colors.textSecondary,
    marginTop: 2,
  },
  verifiedBadgeLarge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionHeader: {
    fontSize: 11,
    fontFamily: Typography.fontFamily.bold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  sectionHeaderTeam: {
    color: colors.textTertiary,
    fontSize: 12,
  },
  card: {
    backgroundColor: colors.surfaceVariant,
    borderRadius: BorderRadius.md,
    padding: Spacing.base,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: {
    fontSize: 16,
    fontFamily: Typography.fontFamily.medium,
    color: colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  teamSubtext: {
    fontSize: 14,
    color: colors.textTertiary,
    fontFamily: Typography.fontFamily.regular,
  },
  selectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
    backgroundColor: colors.background,
  },
  selectBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 15,
    color: colors.textTertiary,
  },
  avatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  avatarText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: 'bold',
  },
  selectedPlayerName: {
    fontSize: 16,
    color: colors.textPrimary,
    fontFamily: Typography.fontFamily.medium,
  },
  scoreFooterBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.primaryAlpha10,
    borderRadius: BorderRadius.sm,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.primaryAlpha20,
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
  footer: {
    padding: Spacing.base,
    paddingBottom: Math.max(safeBottom, Spacing.base),
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    backgroundColor: colors.surface,
  },
  startBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  startBtnText: {
    color: '#000',
    fontSize: 16,
    fontFamily: Typography.fontFamily.bold,
  },
  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.surface,
    paddingHorizontal: Spacing.base,
    paddingTop: safeTop + 8,
    paddingBottom: Math.max(safeBottom, 16),
    flex: 1,
  },
  modalContentFull: {
    backgroundColor: colors.surface,
    paddingHorizontal: Spacing.base,
    paddingTop: safeTop + 8,
    paddingBottom: Math.max(safeBottom, 16),
    flex: 1,
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
  modalListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: Spacing.base,
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.md,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.borderLight,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
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
    width: 42,
    height: 42,
    borderRadius: 21,
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
  emptyText: {
    textAlign: 'center',
    color: colors.textTertiary,
    marginTop: 20,
  },
  editSquadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.base,
    backgroundColor: colors.primaryAlpha10,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: colors.primaryAlpha20,
    marginTop: Spacing.sm,
    marginBottom: Math.max(safeBottom, 12),
  },
  editSquadBtnText: {
    marginLeft: 8,
    color: colors.primary,
    fontSize: 16,
    fontFamily: Typography.fontFamily.medium,
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
    color: '#fff',
    fontSize: 16,
    fontFamily: Typography.fontFamily.semiBold,
  },
  inputGroup: {
    marginBottom: Spacing.base,
  },
  label: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
    color: colors.textPrimary,
    fontSize: 16,
  },
  foundPlayerCard: {
    padding: Spacing.md,
    backgroundColor: colors.surfaceVariant,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  foundText: {
    fontSize: 12,
    color: colors.primary,
    fontFamily: Typography.fontFamily.bold,
    marginBottom: Spacing.sm,
  },
  verifiedBadgeLarge: {
    backgroundColor: '#fff',
    borderRadius: 12,
    position: 'absolute',
    right: 15,
    top: 15,
  },
  targetCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
    shadowColor: '#000',
    shadowOpacity: isDark ? 0.25 : 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  targetCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
  },
  targetBadgeLive: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    gap: 5,
  },
  targetLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EF4444',
  },
  targetBadgeText: {
    fontSize: 10,
    fontFamily: Typography.fontFamily.bold,
    color: '#EF4444',
    letterSpacing: 0.8,
  },
  targetTeamChaseText: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.semiBold,
    color: colors.textSecondary,
  },
  targetDlsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(2, 132, 199, 0.1)',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
  },
  targetDlsText: {
    fontSize: 10,
    fontFamily: Typography.fontFamily.bold,
    color: '#0284C7',
    letterSpacing: 0.5,
  },
  targetMetricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  targetMetricCol: {
    flex: 1,
    alignItems: 'center',
  },
  targetIconPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 6,
    marginBottom: 4,
  },
  targetMetricLabel: {
    fontSize: 10,
    fontFamily: Typography.fontFamily.bold,
    letterSpacing: 0.5,
  },
  targetBigNum: {
    fontSize: 22,
    fontFamily: Typography.fontFamily.bold,
    color: colors.textPrimary,
  },
  targetEquationSub: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.medium,
    color: colors.textSecondary,
    paddingHorizontal: 1,
  },
  targetMetricDivider: {
    width: 1,
    height: 38,
    backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
  },

  // ── Sidebar Styles ──
  sidebarBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  sidebarSheet: {
    width: '84%',
    maxWidth: 360,
    backgroundColor: colors.surface,
    height: '100%',
    borderTopLeftRadius: 24,
    borderBottomLeftRadius: 24,
    paddingTop: Math.max(safeTop, 20) + 12,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: -6, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 12,
  },
  sidebarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sidebarHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sidebarHeaderIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: `${colors.primary}20`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sidebarHeaderTitle: {
    fontSize: 18,
    color: colors.textPrimary,
    fontFamily: Typography.fontFamily.bold,
  },
  sidebarHeaderSub: {
    fontSize: 11,
    color: colors.textTertiary,
    fontFamily: Typography.fontFamily.medium,
    marginTop: 1,
  },
  sidebarCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sidebarHairline: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 14,
  },
  sidebarSectionTitle: {
    fontSize: 11,
    color: colors.textTertiary,
    fontFamily: Typography.fontFamily.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  sidebarCard: {
    backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
    borderRadius: BorderRadius.md || 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
  },
  sidebarCardIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sidebarCardBody: {
    flex: 1,
    paddingHorizontal: 12,
  },
  sidebarCardTitle: {
    fontSize: 14,
    fontFamily: Typography.fontFamily.semiBold,
    color: colors.textPrimary,
  },
  sidebarCardDesc: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  sidebarDangerCard: {
    backgroundColor: 'rgba(239, 68, 68, 0.06)',
    borderRadius: BorderRadius.md || 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    marginBottom: 10,
  },
  sidebarDangerIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sidebarDangerTitle: {
    fontSize: 14,
    fontFamily: Typography.fontFamily.semiBold,
    color: colors.error,
  },
  sidebarDangerDesc: {
    fontSize: 11,
    color: 'rgba(239, 68, 68, 0.75)',
    marginTop: 2,
  },
  selectionContainerCard: {
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.base,
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  selectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-start',
  },
  selectionWrapper: {
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: 4,
  },
  selectionCardTitle: {
    fontSize: 11,
    fontFamily: Typography.fontFamily.bold,
    marginTop: 10,
    textTransform: 'uppercase',
    textAlign: 'center',
    letterSpacing: 0.8,
  },
  selectionCard: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.surfaceVariant,
    borderWidth: 2.5,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  selectionRing: {
    position: 'absolute',
    top: -6,
    left: -6,
    right: -6,
    bottom: -6,
    borderRadius: 50,
    borderWidth: 3,
    zIndex: -1,
  },
  roleBadge: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#121212', // Matches match background
  },
  selectionCardImage: {
    width: '100%',
    height: '100%',
  },
  selectionAvatarPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectionAvatarText: {
    fontSize: 28,
    fontFamily: Typography.fontFamily.bold,
  },
  selectionAvatarPlaceholderEmpty: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectionPlayerName: {
    fontSize: 13,
    fontFamily: Typography.fontFamily.semiBold,
    color: colors.textPrimary,
    marginTop: 4,
    textAlign: 'center',
    width: '100%',
  },
  changeHint: {
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  changeHintText: {
    fontSize: 10,
    fontFamily: Typography.fontFamily.medium,
  },
  selectionVerticalDivider: {
    width: 1,
    backgroundColor: colors.border,
    alignSelf: 'stretch',
    marginHorizontal: 4,
    marginVertical: 16,
  },
  settingsModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  settingsModalContent: { backgroundColor: colors.surface, borderRadius: BorderRadius.lg, padding: 24, width: '100%' },
  settingsModalTitle: { fontSize: 20, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary, marginBottom: 8 },
  settingsModalSub: { fontSize: 14, fontFamily: Typography.fontFamily.medium, color: colors.textSecondary, marginBottom: 20 },
  settingsModalInput: { height: 50, borderWidth: 1, borderColor: colors.border, borderRadius: BorderRadius.md, paddingHorizontal: 16, color: colors.textPrimary, fontFamily: Typography.fontFamily.medium, fontSize: 16, marginBottom: 24 },
  settingsModalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  settingsModalBtnCancel: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: BorderRadius.sm, backgroundColor: colors.surfaceVariant },
  settingsModalBtnTextCancel: { color: colors.textPrimary, fontFamily: Typography.fontFamily.semiBold },
  settingsModalBtnAdd: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: BorderRadius.sm, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  settingsModalBtnTextAdd: { color: colors.background || '#000000', fontFamily: Typography.fontFamily.bold },

  bottomSheetOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  bottomSheet: { backgroundColor: colors.backgroundModal, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.xl, maxHeight: '85%' },
  bsHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.lg },
  bsTitle: { color: '#FFF', fontSize: 20, fontFamily: Typography.fontFamily.bold },
  bsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  bsBtn: { width: '48%', height: 50, backgroundColor: colors.surfaceVariant, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  bsBtnDanger: { backgroundColor: 'rgba(244,67,54,0.1)' },
  bsBtnText: { color: '#FFF', fontFamily: Typography.fontFamily.medium },
  pullHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: Spacing.sm,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceVariant,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 14,
    paddingVertical: Spacing.xs,
    height: 40,
  }
});

export default MatchPlayerSelectionScreen;
