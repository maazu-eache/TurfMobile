import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import React, { useState, useEffect, useRef } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation, useRoute } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { fetchLiveState, setInitialPlayers, addMatchScorer } from '../matchSlice';
import api, { getImageUrl } from '../../../api/axios';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../../theme/theme';
import { showCustomAlert } from '../../../components/CustomAlert';

const MatchPlayerSelectionScreen = () => {
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
  const [battingSquad, setBattingSquad] = useState([]);
  const [bowlingSquad, setBowlingSquad] = useState([]);
  const [battingTeamRoster, setBattingTeamRoster] = useState([]);
  const [bowlingTeamRoster, setBowlingTeamRoster] = useState([]);

  const [isSavingSquad, setIsSavingSquad] = useState(false);

  // Scorecard for validations
  const [scorecards, setScorecards] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (isNavigatingRef.current) return;
    dispatch(fetchLiveState(matchId));
  }, [dispatch, matchId]);

  // Load team rosters and sync squads when liveState is ready
  useEffect(() => {
    if (isNavigatingRef.current) return;
    if (liveState && liveState.match && liveState.match._id === matchId) {
      const match = liveState.match;
      const batTeamId = liveState.battingTeam;

      const isTeamABatting = batTeamId === match.teamA._id;
      const batTeam = isTeamABatting ? match.teamA : match.teamB;
      const bowlTeam = isTeamABatting ? match.teamB : match.teamA;

      setBattingSquad(isTeamABatting ? match.playingXI.teamA : match.playingXI.teamB);
      setBowlingSquad(isTeamABatting ? match.playingXI.teamB : match.playingXI.teamA);

      // Fetch full rosters if not already loaded
      if (battingTeamRoster.length === 0) {
        fetchTeam(batTeam._id, setBattingTeamRoster);
      }
      if (bowlingTeamRoster.length === 0) {
        fetchTeam(bowlTeam._id, setBowlingTeamRoster);
      }

      if (liveState.striker && !selectedStriker) {
        const str = (isTeamABatting ? match.playingXI.teamA : match.playingXI.teamB).find(p => p._id === liveState.striker._id) || liveState.striker;
        setSelectedStriker(str);
      }
      if (liveState.nonStriker && !selectedNonStriker) {
        const nStr = (isTeamABatting ? match.playingXI.teamA : match.playingXI.teamB).find(p => p._id === liveState.nonStriker._id) || liveState.nonStriker;
        setSelectedNonStriker(nStr);
      }
      if (liveState.bowler && !selectedBowler) {
        const bwlr = (isTeamABatting ? match.playingXI.teamB : match.playingXI.teamA).find(p => p._id === liveState.bowler._id) || liveState.bowler;
        setSelectedBowler(bwlr);
      }

      // Fetch scorecards for validations if not loaded
      if (scorecards.length === 0) {
        fetchScorecards();
      }
    }
  }, [liveState, selectedStriker, selectedNonStriker, selectedBowler, battingTeamRoster.length, bowlingTeamRoster.length, scorecards.length]);

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
      const payload = {
        matchId,
        striker: selectedStriker._id,
        nonStriker: selectedNonStriker._id,
      };
      if (!isMidInnings && selectedBowler) {
        payload.bowler = selectedBowler._id;
      }

      await dispatch(setInitialPlayers(payload)).unwrap();

      navigation.navigate('LiveScorer', { matchId, isAmbiguousStrike });
    } catch (e) {
      isNavigatingRef.current = false;
      showCustomAlert('Error', e?.message || e?.response?.data?.message || 'Failed to start scoring. Please try again.');
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
    const isMember = currentSquad.some(p => p._id === player._id);

    if (isMember) {
      const newSquad = currentSquad.filter(p => p._id !== player._id);
      if (isBatting) setBattingSquad(newSquad);
      else setBowlingSquad(newSquad);
    } else {
      const isInOtherSquad = otherSquad.some(p => p._id === player._id);
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
        showCustomAlert('Success', 'Match abandoned');
        navigation.goBack();
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



  if (isLoading || !liveState || !liveState.match) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </SafeAreaView>
    );
  }

  const match = liveState.match;
  const isTeamABatting = liveState.battingTeam === match.teamA._id;
  const batTeam = isTeamABatting ? match.teamA : match.teamB;
  const bowlTeam = isTeamABatting ? match.teamB : match.teamA;

  const renderPlayerSelectionCard = (title, selectedPlayer, mode, disabled = false) => (
    <View style={[styles.selectionWrapper, disabled && { opacity: 0.5 }]}>
      <Text style={styles.selectionCardTitle}>{title}</Text>
      <TouchableOpacity
        style={styles.selectionCard}
        onPress={() => openSelection(mode)}
        disabled={disabled}
      >
        {selectedPlayer ? (
          selectedPlayer.photo ? (
            <Image key="photo" source={{ uri: getImageUrl(selectedPlayer.photo) }} style={styles.selectionCardImage} />
          ) : (
            <View key="avatar" style={styles.selectionAvatarPlaceholder}>
              <Text style={styles.selectionAvatarText}>{selectedPlayer.name.charAt(0).toUpperCase()}</Text>
            </View>
          )
        ) : (
          <View key="empty" style={styles.selectionAvatarPlaceholderEmpty}>
            <Icon name="plus" size={24} color={Colors.textSecondary} />
          </View>
        )}
      </TouchableOpacity>
      <Text style={styles.selectionPlayerName} numberOfLines={2}>
        {selectedPlayer ? selectedPlayer.name : 'Tap to Select'}
      </Text>
    </View>
  );


  const creatorId = typeof liveState?.match?.creator === 'object' ? liveState?.match?.creator?._id : liveState?.match?.creator;
  const isCreator = String(creatorId) === String(user?._id);
  const isMatchActive = !['completed', 'abandoned'].includes(liveState?.match?.status);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="chevron-left" size={28} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Select Initial Players</Text>
        <TouchableOpacity onPress={() => setShowSettingsModal(true)} style={styles.headerActionBtn}>
          <Icon name="cog" size={24} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <KeyboardAwareScrollView enableOnAndroid={true} extraScrollHeight={20} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        {liveState?.inningsNumber === 2 && liveState?.target ? (
          <View style={styles.targetBanner}>
            <View style={styles.targetCol}>
              <Text style={styles.targetLabel}>Target</Text>
              <Text style={styles.targetValue}>{liveState.target}</Text>
            </View>
            <View style={styles.targetDivider} />
            <View style={styles.targetCol}>
              <Text style={styles.targetLabel}>RRR</Text>
              <Text style={styles.targetValue}>{liveState.requiredRunRate || '0.00'}</Text>
            </View>
          </View>
        ) : null}

        {liveState?.inningsNumber === 2 && liveState?.target ? (
          <Text style={[styles.subtitle, { color: Colors.primary, fontWeight: 'bold' }]}>
            {batTeam?.name} need {liveState.toWin} runs from {liveState.ballsRemaining} balls to win.
          </Text>
        ) : (
          <Text style={styles.subtitle}>
            {liveState?.match?.status === 'in_progress' 
              ? 'Select the new batter(s) to continue.' 
              : 'Choose your initial batters and bowler to begin scoring.'}
          </Text>
        )}

        <Text style={styles.sectionHeader}>{batTeam?.name} Batters</Text>
        <View style={styles.selectionContainerCard}>
          <View style={styles.selectionRow}>
            {renderPlayerSelectionCard('Striker', selectedStriker, 'striker', !!liveState?.striker)}
            <View style={styles.selectionVerticalDivider} />
            {renderPlayerSelectionCard('Non-Striker', selectedNonStriker, 'nonStriker', !!liveState?.nonStriker)}
          </View>
        </View>

        {liveState?.match?.status !== 'in_progress' && (
          <>
            <Text style={styles.sectionHeader}>{bowlTeam?.name} Bowler</Text>
            <View style={styles.selectionContainerCard}>
              <View style={[styles.selectionRow, { justifyContent: 'center' }]}>
                {renderPlayerSelectionCard('Bowler', selectedBowler, 'bowler', !!liveState?.bowler)}
              </View>
            </View>
          </>
        )}

        {/* Scorer Profile */}
        <Text style={styles.sectionHeader}>Match Scorer</Text>
        <View style={styles.card}>
          <View style={styles.scorerRow}>
            {user?.photo ? (
              <Image source={{ uri: getImageUrl(user.photo) }} style={styles.scorerAvatar} />
            ) : (
              <View style={[styles.scorerAvatar, { backgroundColor: Colors.primaryAlpha20, justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={{ color: Colors.primary, fontWeight: 'bold' }}>{user?.name?.charAt(0).toUpperCase() || 'S'}</Text>
              </View>
            )}
            <View style={styles.scorerInfo}>
              <Text style={styles.scorerName}>{user?.name || 'Scorer'}</Text>
              <Text style={styles.scorerRole}>Official Scorer</Text>
            </View>
            <View style={styles.verifiedBadgeLarge}>
              <Icon name="check-decagram" size={20} color={Colors.accent} />
            </View>
          </View>
        </View>

      </KeyboardAwareScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.startBtn} onPress={handleStartScoring}>
          <Text style={styles.startBtnText}>
            {liveState?.match?.status === 'in_progress' ? 'Save & Continue' : 'Start Scoring'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* SQUAD MODAL */}
      {showSquadModal ? (
        <Modal visible={true} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <SafeAreaView style={styles.modalContent} edges={['top', 'bottom']}>
              <View style={styles.pullHandle} />
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select from Squad</Text>
                <TouchableOpacity onPress={() => setShowSquadModal(false)}>
                  <Icon name="close" size={24} color={Colors.textPrimary} />
                </TouchableOpacity>
              </View>

              {/* Search Input */}
              <View style={styles.searchBarContainer}>
                <Icon name="magnify" size={20} color={Colors.textTertiary} style={{ marginRight: 8 }} />
                <TextInput
                  placeholder="Search player..."
                  placeholderTextColor={Colors.textTertiary}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  style={styles.searchInput}
                />
                {searchQuery ? (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <Icon name="close-circle" size={18} color={Colors.textTertiary} />
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
                        const isDismissed = fow.some(f => f.batsman === p._id);
                        if (isDismissed) {
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
                          {p.photo ? (
                            <Image source={{ uri: getImageUrl(p.photo) }} style={{ width: '100%', height: '100%', borderRadius: 18 }} />
                          ) : (
                            <Text style={styles.avatarTextSm}>{p.name.charAt(0).toUpperCase()}</Text>
                          )}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.modalListText}>{p.name}</Text>
                          {isDisabled ? <Text style={{ fontSize: 12, color: Colors.error }}>{disabledReason}</Text> : null}
                        </View>
                        {!isDisabled ? (
                          <Icon name="chevron-right" size={20} color={Colors.textTertiary} />
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
                <Icon name="pencil" size={20} color={Colors.primary} />
                <Text style={styles.editSquadBtnText}>Edit Squad / Add Player</Text>
              </TouchableOpacity>
            </SafeAreaView>
          </View>
        </Modal>
      ) : null}

      {/* EDIT SQUAD MODAL */}
      {showEditSquadModal ? (
        <Modal visible={true} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <SafeAreaView style={styles.modalContentFull} edges={['top', 'bottom']}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Edit Playing XI</Text>
                <TouchableOpacity onPress={() => setShowEditSquadModal(false)}>
                  <Icon name="close" size={24} color={Colors.textPrimary} />
                </TouchableOpacity>
              </View>
              <Text style={styles.instructionText}>Check the players you want in the playing XI.</Text>

              <KeyboardAwareScrollView enableOnAndroid={true} extraScrollHeight={20} keyboardShouldPersistTaps="handled" style={styles.modalList}>
                {(activeSelectionMode === 'bowler' ? bowlingTeamRoster : battingTeamRoster).map((p, idx) => {
                  const currentSquad = activeSelectionMode === 'bowler' ? bowlingSquad : battingSquad;
                  const isSelected = currentSquad.some(s => s._id === p._id);
                  return (
                    <TouchableOpacity
                      key={p._id + '_' + idx}
                      style={styles.rosterListItem}
                      onPress={() => toggleSquadMember(p)}
                    >
                      <Icon
                        name={isSelected ? "checkbox-marked" : "checkbox-blank-outline"}
                        size={24}
                        color={isSelected ? Colors.primary : Colors.textTertiary}
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
                      onPlayerAdded: (newPlayer) => {
                        const isBattingLocal = activeSelectionMode === 'striker' || activeSelectionMode === 'nonStriker';
                        if (isBattingLocal) {
                          setBattingTeamRoster(prev => prev.some(p => p._id === newPlayer._id) ? prev : [...prev, newPlayer]);
                          setBattingSquad(prev => prev.some(p => p._id === newPlayer._id) ? prev : [...prev, newPlayer]);
                        } else {
                          setBowlingTeamRoster(prev => prev.some(p => p._id === newPlayer._id) ? prev : [...prev, newPlayer]);
                          setBowlingSquad(prev => prev.some(p => p._id === newPlayer._id) ? prev : [...prev, newPlayer]);
                        }
                      }
                    });
                  }}
                >
                  <Icon name="plus" size={20} color={Colors.textSecondary} />
                  <Text style={styles.addNewBtnText}>Add New Player to Team</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.saveBtn} onPress={saveSquads} disabled={isSavingSquad}>
                  {isSavingSquad ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Squad</Text>}
                </TouchableOpacity>
              </View>
            </SafeAreaView>
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
                  {isCreator && isMatchActive ? (
                    <TouchableOpacity style={[styles.bsBtn, { width: '100%', height: 50, backgroundColor: Colors.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', paddingHorizontal: 16 }]} onPress={() => handleSettingsAction('add_scorer')}>
                      <Icon name="account-plus-outline" size={20} color={Colors.textPrimary} style={{ marginRight: 12 }} />
                      <Text style={[styles.bsBtnText, { color: Colors.textPrimary }]}>Add / Change Scorer</Text>
                    </TouchableOpacity>
                  ) : null}

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
                    </>
                  )}

                  <View style={{ height: 1, backgroundColor: Colors.border, marginVertical: 8 }} />

                  {isCreator && isMatchActive ? (
                    <TouchableOpacity style={[styles.bsBtn, styles.bsBtnDanger, { width: '100%', height: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', paddingHorizontal: 16, borderWidth: 1, borderColor: `${Colors.error}40` }]} onPress={() => handleSettingsAction('abandon')}>
                      <Icon name="cancel" size={20} color={Colors.error} style={{ marginRight: 12 }} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.bsBtnText, { color: Colors.error }]}>Abandon Match</Text>
                        <Text style={{ fontSize: 10, color: `${Colors.error}99`, marginTop: 1 }}>Irreversible — match will be void</Text>
                      </View>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </KeyboardAwareScrollView>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
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
      {/* Revise Match Modal (Rain/DLS) */}
      {showReviseModal ? (
        <Modal visible={true} transparent animationType="fade">
          <View style={styles.settingsModalOverlay}>
            <View style={styles.settingsModalContent}>
              <Text style={styles.settingsModalTitle}>Revise Match</Text>
              <Text style={styles.settingsModalSub}>Reduce overs due to rain or other interruptions.</Text>
              
              <Text style={{ color: Colors.textSecondary, marginBottom: 8 }}>Revised Total Overs:</Text>
              <TextInput
                style={styles.settingsModalInput}
                keyboardType="numeric"
                value={revisedOvers}
                onChangeText={setRevisedOvers}
              />

              {liveState?.inningsNumber === 2 && (
                <>
                  <Text style={{ color: Colors.textTertiary, fontSize: 12, marginTop: 10 }}>Note: The revised target will be automatically calculated using the DLS method.</Text>
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
              
              <Text style={{ color: Colors.textSecondary, marginBottom: 8, marginTop: 10 }}>Reason for abandoning:</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                {['Rain', 'Bad Light', 'Pitch Unplayable', 'Other'].map(r => (
                  <TouchableOpacity
                    key={r}
                    style={{ backgroundColor: abandonReason === r ? Colors.primary : Colors.surface, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1, borderColor: abandonReason === r ? Colors.primary : Colors.border }}
                    onPress={() => setAbandonReason(r)}
                  >
                    <Text style={{ color: abandonReason === r ? '#000' : Colors.textPrimary, fontSize: 12 }}>{r}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput
                style={[styles.settingsModalInput, { height: 80 }]}
                placeholder="Type custom reason here (Optional)"
                placeholderTextColor={Colors.textTertiary}
                value={abandonReason}
                onChangeText={setAbandonReason}
                multiline
              />

              <View style={styles.settingsModalActions}>
                <TouchableOpacity style={styles.settingsModalBtnCancel} onPress={() => setShowAbandonModal(false)}>
                  <Text style={styles.settingsModalBtnTextCancel}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.settingsModalBtnAdd, { backgroundColor: Colors.error }]} onPress={submitAbandon}>
                  <Text style={[styles.settingsModalBtnTextAdd, { color: '#FFF' }]}>Abandon Match</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
</SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  backBtn: { padding: 4 },
  headerTitle: {
    fontSize: 18,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.textPrimary,
  },
  content: { padding: Spacing.base },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: Spacing.xl,
    textAlign: 'center',
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
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderLeftWidth: 4,
    borderLeftColor: Colors.accent,
  },
  scorerTitle: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.textTertiary,
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
    color: Colors.textPrimary,
  },
  scorerRole: {
    fontSize: 13,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  verifiedBadgeLarge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionHeader: {
    fontSize: 14,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sectionHeaderTeam: {
    color: Colors.textTertiary,
    fontSize: 12,
  },
  card: {
    backgroundColor: Colors.surfaceVariant,
    borderRadius: BorderRadius.md,
    padding: Spacing.base,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardTitle: {
    fontSize: 16,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  teamSubtext: {
    fontSize: 14,
    color: Colors.textTertiary,
    fontFamily: Typography.fontFamily.regular,
  },
  selectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
    backgroundColor: Colors.background,
  },
  selectBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 15,
    color: Colors.textTertiary,
  },
  avatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  avatarText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: 'bold',
  },
  selectedPlayerName: {
    fontSize: 16,
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.medium,
  },
  footer: {
    padding: Spacing.base,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    backgroundColor: Colors.surface,
  },
  startBtn: {
    backgroundColor: Colors.primary,
    padding: 16,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  startBtnText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: Typography.fontFamily.bold,
  },
  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.surface,
    padding: Spacing.base,
    height: '100%',
  },
  modalContentFull: {
    backgroundColor: Colors.surface,
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
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.textPrimary,
  },
  instructionText: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
  },
  modalList: {
    flex: 1,
  },
  modalListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.base,
    backgroundColor: Colors.surfaceVariant,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  rosterListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.base,
    backgroundColor: Colors.surfaceVariant,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  avatarPlaceholderSm: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.borderLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarTextSm: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: 'bold',
  },
  modalListText: {
    fontSize: 16,
    color: Colors.textPrimary,
  },
  emptyText: {
    textAlign: 'center',
    color: Colors.textTertiary,
    marginTop: 20,
  },
  editSquadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.base,
    backgroundColor: Colors.primaryAlpha10,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.primaryAlpha20,
    marginTop: Spacing.base,
  },
  editSquadBtnText: {
    marginLeft: 8,
    color: Colors.primary,
    fontSize: 16,
    fontFamily: Typography.fontFamily.medium,
  },
  editSquadFooter: {
    marginTop: Spacing.base,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
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
    borderColor: Colors.borderLight,
  },
  addNewBtnText: {
    marginLeft: 8,
    color: Colors.textSecondary,
    fontSize: 15,
  },
  saveBtn: {
    backgroundColor: Colors.primary,
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
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
    color: Colors.textPrimary,
    fontSize: 16,
  },
  foundPlayerCard: {
    padding: Spacing.md,
    backgroundColor: Colors.surfaceVariant,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  foundText: {
    fontSize: 12,
    color: Colors.primary,
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
  targetBanner: {
    flexDirection: 'row',
    backgroundColor: Colors.primaryAlpha20,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.primaryAlpha20,
  },
  targetCol: {
    flex: 1,
    alignItems: 'center',
  },
  targetDivider: {
    width: 1,
    height: '100%',
    backgroundColor: Colors.primaryAlpha20,
  },
  targetLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  targetValue: {
    fontSize: 20,
    color: Colors.primary,
    fontFamily: Typography.fontFamily.bold,
  },
  selectionContainerCard: {
    backgroundColor: Colors.surfaceVariant,
    borderRadius: BorderRadius.md,
    padding: Spacing.base,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  selectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  selectionWrapper: {
    alignItems: 'center',
    flex: 1,
  },
  selectionCardTitle: {
    fontSize: 10,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  selectionCard: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  selectionCardImage: {
    width: '100%',
    height: '100%',
  },
  selectionAvatarPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.primaryAlpha20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectionAvatarText: {
    color: Colors.primary,
    fontSize: 20,
    fontFamily: Typography.fontFamily.bold,
  },
  selectionAvatarPlaceholderEmpty: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectionPlayerName: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.textPrimary,
    marginTop: 8,
    textAlign: 'center',
    width: '100%',
  },
  selectionVerticalDivider: {
    width: 1,
    height: 70,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginHorizontal: Spacing.xs,
  },
  settingsModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  settingsModalContent: { backgroundColor: Colors.backgroundElevated, borderRadius: BorderRadius.lg, padding: 24, width: '100%' },
  settingsModalTitle: { fontSize: 20, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary, marginBottom: 8 },
  settingsModalSub: { fontSize: 14, fontFamily: Typography.fontFamily.medium, color: Colors.textSecondary, marginBottom: 20 },
  settingsModalInput: { height: 50, borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.md, paddingHorizontal: 16, color: Colors.textPrimary, fontFamily: Typography.fontFamily.medium, fontSize: 16, marginBottom: 24 },
  settingsModalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  settingsModalBtnCancel: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: BorderRadius.sm, backgroundColor: Colors.surfaceVariant },
  settingsModalBtnTextCancel: { color: Colors.textPrimary, fontFamily: Typography.fontFamily.semiBold },
  settingsModalBtnAdd: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: BorderRadius.sm, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  settingsModalBtnTextAdd: { color: Colors.background || '#000000', fontFamily: Typography.fontFamily.bold },

  bottomSheetOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  bottomSheet: { backgroundColor: Colors.backgroundModal, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.xl },
  bsHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.lg },
  bsTitle: { color: '#FFF', fontSize: 20, fontFamily: Typography.fontFamily.bold },
  bsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  bsBtn: { width: '48%', height: 50, backgroundColor: Colors.surfaceVariant, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  bsBtnDanger: { backgroundColor: 'rgba(244,67,54,0.1)' },
  bsBtnText: { color: '#FFF', fontFamily: Typography.fontFamily.medium },
  pullHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: Spacing.sm,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceVariant,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 14,
    paddingVertical: Spacing.xs,
    height: 40,
  }
});

export default MatchPlayerSelectionScreen;
