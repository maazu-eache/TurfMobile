import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  FlatList,
  Image,
  Platform,
  Dimensions,
  Switch,
  Alert,
} from 'react-native';
import LinearGradient from '../../../components/SolidGradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useDispatch, useSelector } from 'react-redux';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createMatch, clearLiveState } from '../matchSlice';
import { fetchMyTeams, fetchOpponentTeams, fetchFollowingTeams, createTeam } from '../../team/teamSlice';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../../theme/theme';
import LocationAutocomplete from '../../../components/LocationAutocomplete';
import { showCustomAlert } from '../../../components/CustomAlert';
import { getImageUrl } from '../../../api/axios';
import api from '../../../api/axios';

const IMG_TENNIS  = require('../../../../Tennis.jpeg');
const IMG_LEATHER = require('../../../../Leather.jpeg');
const IMG_OTHER   = require('../../../../Others.jpeg');

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const MATCH_FORMATS = ['LIMITED OVERS', 'BOX CRICKET', 'PAIR CRICKET'];
const PITCH_TYPES = ['ROUGH', 'CEMENT', 'TURF', 'ASTROTURF', 'MATTING'];
const GROUND_TYPES = ['Open Ground', 'Indoor', 'Box Cricket', 'Other'];

const MatchSetupScreen = ({ navigation, route }) => {
  const dispatch = useDispatch();
  const { isLoading: isMatchLoading } = useSelector((state) => state.match);
  const { myTeams, opponentTeams, followingTeams, isLoading: isTeamLoading } = useSelector((state) => state.team);
  const { isAuthenticated } = useSelector((state) => state.auth);

  const tournamentDetails = route.params?.tournamentDetails || null;
  const tournamentId = route.params?.tournamentId || null;
  const matchStage = route.params?.stage || null;
  const matchData = route.params?.matchData || null;
  const existingMatchId = route.params?.matchId || matchData?._id || null;

  const [teamA, setTeamA] = useState(null);
  const [teamB, setTeamB] = useState(null);

  const [playingXIA, setPlayingXIA] = useState([]);
  const [playingXIB, setPlayingXIB] = useState([]);
  const [captainA, setCaptainA] = useState(null);
  const [captainB, setCaptainB] = useState(null);
  const [wkA, setWkA] = useState(null);
  const [wkB, setWkB] = useState(null);

  // Match setup details matching CricHeroes fields
  const [format, setFormat] = useState('LIMITED OVERS');
  const [overs, setOvers] = useState(tournamentDetails?.overs ? tournamentDetails.overs.toString() : '5');
  const [wickets, setWickets] = useState(tournamentDetails?.playersPerTeam ? (tournamentDetails.playersPerTeam - 1).toString() : '10');
  const [bowlerQuota, setBowlerQuota] = useState('1');
  const [city, setCity] = useState(tournamentDetails?.city || '');
  const [cityObj, setCityObj] = useState(tournamentDetails?.locationObj || null);
  const [ground, setGround] = useState(tournamentDetails?.groundName || '');
  const [matchDate, setMatchDate] = useState(() => {
    const d = new Date();
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) + ' ' + d.toTimeString().substring(0, 5);
  });
  
  const [ballType, setBallType] = useState(tournamentDetails?.ballType || 'Tennis');
  const [wagonWheel, setWagonWheel] = useState(true);
  const [pitchType, setPitchType] = useState('TURF');
  const [groundType, setGroundType] = useState(tournamentDetails?.groundType || 'Open Ground');

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState('date');
  const [tempDate, setTempDate] = useState(matchData?.scheduledAt ? new Date(matchData.scheduledAt) : new Date());

  // Auto-fill match details if editing existing match
  useEffect(() => {
    if (matchData) {
      if (matchData.format) setFormat(matchData.format);
      if (matchData.overs) setOvers(matchData.overs.toString());
      if (matchData.wickets) setWickets(matchData.wickets.toString());
      if (matchData.bowlerQuota) setBowlerQuota(matchData.bowlerQuota.toString());
      if (matchData.city) setCity(matchData.city);
      if (matchData.ground) setGround(matchData.ground);
      if (matchData.ballType) setBallType(matchData.ballType);
      if (matchData.pitchType) setPitchType(matchData.pitchType);
      if (matchData.groundType) setGroundType(matchData.groundType);
      if (matchData.wagonWheelEnabled !== undefined) setWagonWheel(matchData.wagonWheelEnabled);

      if (matchData.teamA) setTeamA(typeof matchData.teamA === 'object' ? matchData.teamA : { _id: matchData.teamA });
      if (matchData.teamB) setTeamB(typeof matchData.teamB === 'object' ? matchData.teamB : { _id: matchData.teamB });

      // Only restore playing XI if the match has already progressed past scheduling.
      // For a scheduled match being freshly set up, always start with an empty squad
      // so the user manually picks their playing XI.
      const isEditingInProgress = matchData.status && matchData.status !== 'scheduled';
      if (isEditingInProgress && matchData.playingXI) {
        const normalizeIdArr = (arr) =>
          (arr || []).map((item) => (typeof item === 'object' && item !== null ? String(item._id) : String(item)));
        if (matchData.playingXI.teamA?.length) setPlayingXIA(normalizeIdArr(matchData.playingXI.teamA));
        if (matchData.playingXI.teamB?.length) setPlayingXIB(normalizeIdArr(matchData.playingXI.teamB));
      }
      if (matchData.captain) {
        if (matchData.captain.teamA) setCaptainA(typeof matchData.captain.teamA === 'object' ? String(matchData.captain.teamA._id) : String(matchData.captain.teamA));
        if (matchData.captain.teamB) setCaptainB(typeof matchData.captain.teamB === 'object' ? String(matchData.captain.teamB._id) : String(matchData.captain.teamB));
      }
      if (matchData.wicketKeeper) {
        if (matchData.wicketKeeper.teamA) setWkA(typeof matchData.wicketKeeper.teamA === 'object' ? String(matchData.wicketKeeper.teamA._id) : String(matchData.wicketKeeper.teamA));
        if (matchData.wicketKeeper.teamB) setWkB(typeof matchData.wicketKeeper.teamB === 'object' ? String(matchData.wicketKeeper.teamB._id) : String(matchData.wicketKeeper.teamB));
      }
    }
  }, [matchData]);

  useEffect(() => {
    dispatch(fetchMyTeams());
    dispatch(fetchOpponentTeams());
    dispatch(fetchFollowingTeams());
  }, [dispatch]);

  useEffect(() => {
    const o = parseInt(overs, 10);
    if (!isNaN(o) && o > 0) {
      setBowlerQuota(Math.ceil(o / 5).toString());
    }
  }, [overs]);

  const openXIModal = (teamTag) => {
    if (teamTag === 'A' && !teamA) return showCustomAlert('Info', 'Select Team A first');
    if (teamTag === 'B' && !teamB) return showCustomAlert('Info', 'Select Team B first');
    
    const team = teamTag === 'A' ? teamA : teamB;
    const roster = teamTag === 'A' ? teamA.players : teamB.players;
    const selectedXI = teamTag === 'A' ? playingXIA : playingXIB;
    const captain = teamTag === 'A' ? captainA : captainB;
    const wk = teamTag === 'A' ? wkA : wkB;
    const opposingXI = teamTag === 'A' ? playingXIB : playingXIA;
    
    navigation.navigate('SquadSelection', {
      team,
      roster,
      selectedXI,
      captain,
      wk,
      selectingFor: teamTag,
      opposingXI,
      matchId: existingMatchId,
      tournamentId,
      onDone: (updatedXI, updatedCaptain, updatedWk, tTag) => {
        if (tTag === 'A') {
          setPlayingXIA(updatedXI);
          setCaptainA(updatedCaptain);
          setWkA(updatedWk);
        } else {
          setPlayingXIB(updatedXI);
          setCaptainB(updatedCaptain);
          setWkB(updatedWk);
        }
      }
    });
  };

  // --- OTP Verification State ---
  const [otpModalVisible, setOtpModalVisible] = useState(false);
  const [verificationPlayerId, setVerificationPlayerId] = useState(null);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState(null); // 'toss' or 'schedule'

  const user = useSelector(state => state.auth.user);

  const executeMatchSetup = async (actionType) => {
    if (existingMatchId) {
      // Just set playing XI and update match details for an already scheduled match
      try {
        await api.post(`/matches/${existingMatchId}/playing-xi`, {
          teamA: playingXIA,
          teamB: playingXIB,
          captain: { teamA: captainA, teamB: captainB },
          wicketKeeper: { teamA: wkA, teamB: wkB },
          overs: parseInt(overs, 10),
          wickets: parseInt(wickets, 10),
          bowlerQuota: parseInt(bowlerQuota, 10) || Math.ceil(parseInt(overs, 10) / 5),
          format,
          ballType,
          pitchType,
          groundType,
          wagonWheelEnabled: wagonWheel,
          city,
          ground,
          scheduledAt: tempDate.toISOString()
        });
        dispatch(clearLiveState()); 
        if (actionType === 'toss') navigation.replace('Toss', { matchId: existingMatchId });
        else navigation.navigate('MyCricketMain');
      } catch (err) {
        showCustomAlert('Error', err.response?.data?.message || 'Failed to update match details');
      }
      return;
    }

    const payload = {
      teamA: teamA._id,
      teamB: teamB._id,
      overs: parseInt(overs, 10),
      wickets: parseInt(wickets, 10),
      bowlerQuota: parseInt(bowlerQuota, 10) || Math.ceil(parseInt(overs, 10) / 5),
      format,
      ballType,
      pitchType,
      groundType,
      wagonWheelEnabled: wagonWheel,
      venueDetails: ground || 'Unknown Ground',
      city,
      ground,
      locationObj: cityObj ? { name: cityObj.name, latitude: cityObj.latitude, longitude: cityObj.longitude } : null,
      scheduledAt: tempDate.toISOString(),
      playingXI: {
        teamA: playingXIA,
        teamB: playingXIB,
      },
      captain: {
        teamA: captainA,
        teamB: captainB,
      },
      wicketKeeper: {
        teamA: wkA,
        teamB: wkB,
      },
      tournament: tournamentId,
      stage: matchStage,
    };

    const res = await dispatch(createMatch(payload));
    if (createMatch.fulfilled.match(res)) {
      if (actionType === 'toss') navigation.replace('Toss', { matchId: res.payload._id });
      else navigation.navigate('MyCricketMain');
    } else {
      showCustomAlert('Match Setup Failed', res.payload);
    }
  };

  const handleStartMatch = async () => {
    if (!isAuthenticated) return navigation.navigate('AuthModal', { screen: 'Login' });
    if (!teamA || !teamB) return showCustomAlert('Error', 'Please select both teams');
    if (!overs || parseInt(overs, 10) <= 0) return showCustomAlert('Error', 'Valid overs required');
    if (!wickets || parseInt(wickets, 10) <= 0) return showCustomAlert('Error', 'Valid wickets required');
    if (!city?.trim() || !ground?.trim() || !groundType?.trim() || !pitchType?.trim()) {
      return showCustomAlert('Error', 'City, Ground Name, Ground Type, and Pitch Type are required.');
    }

    if (teamA._id === teamB._id) {
      return showCustomAlert('Error', 'Team A and Team B cannot be the same team.');
    }

    const commonPlayers = playingXIA.filter(id => playingXIB.includes(id));
    if (commonPlayers.length > 0) {
      return showCustomAlert('Validation Error', 'A player cannot be in both teams\' playing XI.');
    }

    // Require OTP if creating a new individual match (not tournament, not existing match)
    if (!tournamentId && !existingMatchId) {
      setPendingAction('toss');
      setOtpModalVisible(true);
      return;
    }
    
    executeMatchSetup('toss');
  };

  const handleScheduleMatch = async () => {
    if (!isAuthenticated) return navigation.navigate('AuthModal', { screen: 'Login' });
    if (!teamA || !teamB) return showCustomAlert('Error', 'Please select both teams');
    if (!overs || parseInt(overs, 10) <= 0) return showCustomAlert('Error', 'Valid overs required');
    if (!wickets || parseInt(wickets, 10) <= 0) return showCustomAlert('Error', 'Valid wickets required');
    if (!city?.trim() || !ground?.trim() || !groundType?.trim() || !pitchType?.trim()) {
      return showCustomAlert('Error', 'City, Ground Name, Ground Type, and Pitch Type are required.');
    }

    if (teamA._id === teamB._id) {
      return showCustomAlert('Error', 'Team A and Team B cannot be the same team.');
    }

    const commonPlayers = playingXIA.filter(id => playingXIB.includes(id));
    if (commonPlayers.length > 0) {
      return showCustomAlert('Validation Error', 'A player cannot be in both teams\' playing XI.');
    }

    // Require OTP if creating a new individual match
    if (!tournamentId && !existingMatchId) {
      setPendingAction('schedule');
      setOtpModalVisible(true);
      return;
    }

    executeMatchSetup('schedule');
  };

  const sendOTP = async () => {
    if (!verificationPlayerId) return showCustomAlert('Error', 'Please select a player');
    setOtpLoading(true);
    try {
      await api.post('/matches/send-otp', { playerId: verificationPlayerId });
      setOtpSent(true);
      showCustomAlert('OTP Sent', 'An OTP has been sent to the selected player\'s email.');
    } catch (err) {
      showCustomAlert('Error', err.response?.data?.message || 'Failed to send OTP');
    } finally {
      setOtpLoading(false);
    }
  };

  const verifyOTP = async () => {
    if (!otpCode || otpCode.length !== 6) return showCustomAlert('Error', 'Enter a valid 6-digit OTP');
    setOtpLoading(true);
    try {
      await api.post('/matches/verify-otp', { playerId: verificationPlayerId, otpCode: otpCode });
      setOtpModalVisible(false);
      executeMatchSetup(pendingAction);
    } catch (err) {
      showCustomAlert('Error', err.response?.data?.message || 'Invalid or expired OTP');
    } finally {
      setOtpLoading(false);
    }
  };

  // executeMatchSetup handles the API calls now

  const handleScheduleClick = () => {
    setDatePickerMode('date');
    setShowDatePicker(true);
  };

  const onDateChange = (event, selectedDate) => {
    const currentDate = selectedDate || tempDate;
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (event.type === 'set') {
      if (datePickerMode === 'date') {
        setTempDate(currentDate);
        setDatePickerMode('time');
        if (Platform.OS === 'android') {
          setTimeout(() => setShowDatePicker(true), 100);
        }
      } else {
        setTempDate(currentDate);
        const formattedDate = currentDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) + ' ' + currentDate.toTimeString().substring(0, 5);
        setMatchDate(formattedDate);
        if (Platform.OS === 'ios') setShowDatePicker(false);
      }
    } else if (event.type === 'dismissed') {
      if (Platform.OS === 'ios') setShowDatePicker(false);
    }
  };

  // Old handleScheduleMatch removed.

  const renderChip = (label, selected, onPress) => (
    <TouchableOpacity
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={onPress}
      key={label}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );

  const BALL_OPTIONS = [
    { label: 'Tennis',  value: 'Tennis',  img: IMG_TENNIS  },
    { label: 'Leather', value: 'Leather', img: IMG_LEATHER },
    { label: 'Other',   value: 'Other',   img: IMG_OTHER   },
  ];

  const renderBallOption = ({ label, value, img }) => {
    const isSelected = ballType === value;
    return (
      <TouchableOpacity
        key={value}
        style={styles.ballOption}
        onPress={() => setBallType(value)}
        activeOpacity={0.8}
      >
        {/* Outer ring — no overflow:hidden so border + badge stay visible */}
        <View style={[styles.ballRing, isSelected && styles.ballRingSelected]}>
          {/* Inner clip circle for the image */}
          <View style={styles.ballCircle}>
            <Image source={img} style={styles.ballImage} resizeMode="cover" />
          </View>
          {/* Check badge in top-right */}
          {isSelected && (
            <View style={styles.ballCheckedBadge}>
              <Icon name="check-circle" size={18} color={Colors.primary} />
            </View>
          )}
        </View>
        <Text style={[styles.ballLabel, isSelected && styles.ballLabelSelected]}>{label}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="chevron-left" size={28} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Start A Match</Text>
        <TouchableOpacity style={styles.settingsBtn}>
          {/* <Icon name="cog-outline" size={24} color={Colors.textPrimary} /> */}
        </TouchableOpacity>
      </View>

      <KeyboardAwareScrollView enableOnAndroid={true} extraScrollHeight={20} keyboardShouldPersistTaps="handled" style={{ flex: 1 }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.matchupContainer}>
          <View style={styles.teamsRow}>
            <View style={styles.teamCol}>
              <TouchableOpacity
                style={[styles.teamCircleSlot, teamA && styles.teamCircleSlotSelected]}
                onPress={() => {
                  navigation.navigate('MatchTeamSelection', {
                    selectingFor: 'A',
                    teamA,
                    teamB,
                    tournamentDetails,
                    matchStage,
                    activeTab: tournamentDetails ? 'Tournament' : 'My Teams',
                    onSelectTeam: (team) => {
                      // Clear previous squad data for this team
                      setPlayingXIA([]);
                      setCaptainA(null);
                      setWkA(null);
                      setTeamA(team);

                      // Automatically jump to Squad Selection after returning from Team Selection
                      setTimeout(() => {
                        navigation.navigate('SquadSelection', {
                          team,
                          roster: team.players || [],
                          selectedXI: [],
                          captain: null,
                          wk: null,
                          selectingFor: 'A',
                          opposingXI: playingXIB,
                          matchId: existingMatchId,
                          tournamentId,
                          onDone: (updatedXI, updatedCaptain, updatedWk, tTag) => {
                            if (tTag === 'A') {
                              setTeamA(team);
                              setPlayingXIA(updatedXI);
                              setCaptainA(updatedCaptain);
                              setWkA(updatedWk);
                            }
                          }
                        });
                      }, 300);
                    }
                  });
                }}
              >
                {teamA ? (
                  teamA.logo ? (
                    <Image source={{ uri: getImageUrl(teamA.logo) }} style={styles.teamLogoImg} />
                  ) : (
                    <Image source={require('../../../../SportVerse.png')} style={styles.teamLogoImg} resizeMode="contain" />
                  )
                ) : (
                  <Icon name="plus" size={32} color={Colors.primary} />
                )}
              </TouchableOpacity>
              <Text style={styles.teamSelectionName} numberOfLines={1}>
                {teamA ? teamA.name : 'Select Team A'}
              </Text>
              {teamA && (
                <TouchableOpacity style={styles.squadBadge} onPress={() => openXIModal('A')}>
                  <Text style={styles.squadBadgeText}>Squad ({playingXIA.length})</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.vsBadgeContainer}>
              <View style={styles.vsCircle}>
                <Text style={styles.vsCircleText}>VS</Text>
              </View>
            </View>

            <View style={styles.teamCol}>
              <TouchableOpacity
                style={[styles.teamCircleSlot, teamB && styles.teamCircleSlotSelected]}
                onPress={() => {
                  navigation.navigate('MatchTeamSelection', {
                    selectingFor: 'B',
                    teamA,
                    teamB,
                    tournamentDetails,
                    matchStage,
                    activeTab: tournamentDetails ? 'Tournament' : 'Opponents',
                    onSelectTeam: (team) => {
                      // Clear previous squad data for this team
                      setPlayingXIB([]);
                      setCaptainB(null);
                      setWkB(null);
                      setTeamB(team);

                      // Automatically jump to Squad Selection after returning from Team Selection
                      setTimeout(() => {
                        navigation.navigate('SquadSelection', {
                          team,
                          roster: team.players || [],
                          selectedXI: [],
                          captain: null,
                          wk: null,
                          selectingFor: 'B',
                          opposingXI: playingXIA,
                          matchId: existingMatchId,
                          tournamentId,
                          onDone: (updatedXI, updatedCaptain, updatedWk, tTag) => {
                            if (tTag === 'B') {
                              setTeamB(team);
                              setPlayingXIB(updatedXI);
                              setCaptainB(updatedCaptain);
                              setWkB(updatedWk);
                            }
                          }
                        });
                      }, 300);
                    }
                  });
                }}
              >
                {teamB ? (
                  teamB.logo ? (
                    <Image source={{ uri: getImageUrl(teamB.logo) }} style={styles.teamLogoImg} />
                  ) : (
                    <Image source={require('../../../../SportVerse.png')} style={styles.teamLogoImg} resizeMode="contain" />
                  )
                ) : (
                  <Icon name="plus" size={32} color={Colors.primary} />
                )}
              </TouchableOpacity>
              <Text style={styles.teamSelectionName} numberOfLines={1}>
                {teamB ? teamB.name : 'Select Team B'}
              </Text>
              {teamB && (
                <TouchableOpacity style={styles.squadBadge} onPress={() => openXIModal('B')}>
                  <Text style={styles.squadBadgeText}>Squad ({playingXIB.length})</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        <View style={styles.formContainer}>
          <View style={styles.inputGroup}>
            <Text style={styles.fieldLabel}>Match Type</Text>
            <View style={styles.chipsContainer}>
              {MATCH_FORMATS.map((f) => renderChip(f, format === f, () => setFormat(f)))}
            </View>
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.fieldLabel}>No. of Overs*</Text>
              <TextInput
                style={styles.underlineInput}
                keyboardType="numeric"
                value={overs}
                onChangeText={setOvers}
                maxLength={2}
                placeholder="5"
                placeholderTextColor={Colors.textTertiary}
              />
            </View>
            <View style={[styles.inputGroup, { flex: 1, marginHorizontal: 8 }]}>
              <Text style={styles.fieldLabel}>Wickets*</Text>
              <TextInput
                style={styles.underlineInput}
                keyboardType="numeric"
                value={wickets}
                onChangeText={setWickets}
                maxLength={2}
                placeholder="10"
                placeholderTextColor={Colors.textTertiary}
              />
            </View>
            <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.fieldLabel}>Overs/bowler</Text>
              <TextInput
                style={styles.underlineInput}
                keyboardType="numeric"
                value={bowlerQuota}
                onChangeText={setBowlerQuota}
                maxLength={2}
                placeholder="1"
                placeholderTextColor={Colors.textTertiary}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.fieldLabel}>City / Town*</Text>
            <LocationAutocomplete
              value={city}
              onChangeText={setCity}
              onSelectLocation={(loc) => {
                setCity(loc ? loc.name : '');
                setCityObj(loc || null);
              }}
              placeholder="Search city..."
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.fieldLabel}>Ground*</Text>
            <TextInput
              style={styles.underlineInput}
              value={ground}
              onChangeText={setGround}
              placeholder="e.g. Shivaji Park Ground"
              placeholderTextColor={Colors.textTertiary}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.fieldLabel}>Date and Time</Text>
            <TouchableOpacity onPress={handleScheduleClick}>
              <View style={[styles.underlineInput, { justifyContent: 'center', paddingVertical: 12 }]}>
                <Text style={{ color: Colors.textPrimary, fontSize: 16 }}>
                  {matchDate || 'Select Date & Time'}
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.fieldLabel}>Ball Type</Text>
            <View style={styles.ballsRow}>
              {BALL_OPTIONS.map(renderBallOption)}
            </View>
          </View>

          <View style={styles.toggleRow}>
            <View>
              <Text style={styles.toggleTitle}>Wagon Wheel</Text>
              <Text style={styles.toggleSubtitle}>Show Wagon Wheel for 1s, 2s and 3s</Text>
            </View>
            <Switch
              value={wagonWheel}
              onValueChange={setWagonWheel}
              trackColor={{ false: '#4A5568', true: Colors.primary }}
              thumbColor={wagonWheel ? '#FFF' : '#A0AAB5'}
            />
          </View>
          <View style={[styles.inputGroup, { marginTop: Spacing.md }]}>
            <Text style={styles.fieldLabel}>Ground Type</Text>
            <View style={styles.chipsContainer}>
              {GROUND_TYPES.map((g) => renderChip(g, groundType === g, () => setGroundType(g)))}
            </View>
          </View>

          <View style={[styles.inputGroup, { marginTop: Spacing.md }]}>
            <Text style={styles.fieldLabel}>Pitch Type</Text>
            <View style={styles.chipsContainer}>
              {PITCH_TYPES.map((p) => renderChip(p, pitchType === p, () => setPitchType(p)))}
            </View>
          </View>
        </View>
      </KeyboardAwareScrollView>

      <View style={styles.stickyBottomBar}>
        {!existingMatchId && (
          <TouchableOpacity style={styles.scheduleBtn} onPress={handleScheduleMatch} disabled={isMatchLoading}>
            <Text style={styles.scheduleBtnText}>Schedule Match</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.nextBtn} onPress={handleStartMatch} disabled={isMatchLoading}>
          {isMatchLoading ? (
            <ActivityIndicator color={Colors.background} size="small" />
          ) : (
            <Text style={styles.nextBtnText}>{existingMatchId ? 'Start Match' : 'Next (Toss)'}</Text>
          )}
        </TouchableOpacity>
      </View>

      {showDatePicker && (
        <DateTimePicker
          value={tempDate}
          mode={datePickerMode}
          is24Hour={false}
          display="default"
          onChange={onDateChange}
        />
      )}

      <Modal visible={otpModalVisible} transparent={true} animationType="fade" onRequestClose={() => setOtpModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Match Verification</Text>
            {!otpSent ? (
              <>
                <Text style={styles.modalSubtitle}>Select a registered player to receive an OTP.</Text>
                
                <View style={{ maxHeight: 350, marginBottom: Spacing.md }}>
                  <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
                    {/* Team A Players */}
                    {teamA && (teamA.players || []).filter(p => p && p.player && p.player.isClaimed && p.player._id !== user?._id).length > 0 && (
                      <View style={{ marginBottom: Spacing.md }}>
                        <View style={{ backgroundColor: Colors.borderLight, padding: 8, borderRadius: 6, marginBottom: 8 }}>
                          <Text style={{ color: '#fff', fontFamily: Typography.fontFamily.bold, fontSize: 13 }}>{teamA.name}</Text>
                        </View>
                        {(teamA.players || []).filter(p => p && p.player && p.player.isClaimed && p.player._id !== user?._id).map((p, index) => {
                          const photoUrl = p.player.photo || p.player.userId?.photo;
                          return (
                            <TouchableOpacity
                              key={`${p.player._id}-A-${index}`}
                              style={[styles.playerSelectRow, { paddingVertical: 10, borderBottomWidth: 0 }]}
                              onPress={() => setVerificationPlayerId(p.player._id)}
                            >
                              <Icon name={verificationPlayerId === p.player._id ? "radiobox-marked" : "radiobox-blank"} size={22} color={Colors.primary} style={{ marginRight: 12 }} />
                              {photoUrl ? (
                                <Image source={{ uri: getImageUrl(photoUrl) }} style={{ width: 36, height: 36, borderRadius: 18, marginRight: 12 }} />
                              ) : (
                                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.backgroundElevated, marginRight: 12, alignItems: 'center', justifyContent: 'center' }}>
                                  <Icon name="account" size={20} color={Colors.textSecondary} />
                                </View>
                              )}
                              <Text style={styles.playerSelectName}>{p.player.name}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}

                    {/* Team B Players */}
                    {teamB && (teamB.players || []).filter(p => p && p.player && p.player.isClaimed && p.player._id !== user?._id).length > 0 && (
                      <View style={{ marginBottom: Spacing.md }}>
                        <View style={{ backgroundColor: Colors.borderLight, padding: 8, borderRadius: 6, marginBottom: 8 }}>
                          <Text style={{ color: '#fff', fontFamily: Typography.fontFamily.bold, fontSize: 13 }}>{teamB.name}</Text>
                        </View>
                        {(teamB.players || []).filter(p => p && p.player && p.player.isClaimed && p.player._id !== user?._id).map((p, index) => {
                          const photoUrl = p.player.photo || p.player.userId?.photo;
                          return (
                            <TouchableOpacity
                              key={`${p.player._id}-B-${index}`}
                              style={[styles.playerSelectRow, { paddingVertical: 10, borderBottomWidth: 0 }]}
                              onPress={() => setVerificationPlayerId(p.player._id)}
                            >
                              <Icon name={verificationPlayerId === p.player._id ? "radiobox-marked" : "radiobox-blank"} size={22} color={Colors.primary} style={{ marginRight: 12 }} />
                              {photoUrl ? (
                                <Image source={{ uri: getImageUrl(photoUrl) }} style={{ width: 36, height: 36, borderRadius: 18, marginRight: 12 }} />
                              ) : (
                                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.backgroundElevated, marginRight: 12, alignItems: 'center', justifyContent: 'center' }}>
                                  <Icon name="account" size={20} color={Colors.textSecondary} />
                                </View>
                              )}
                              <Text style={styles.playerSelectName}>{p.player.name}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}

                    {[
                      ...(teamA?.players || []),
                      ...(teamB?.players || [])
                    ].filter(p => p && p.player && p.player.isClaimed && p.player._id !== user?._id).length === 0 && (
                      <Text style={{ color: Colors.textSecondary, textAlign: 'center', marginVertical: 10 }}>No registered players found in these teams to send an OTP to.</Text>
                    )}
                  </ScrollView>
                </View>

                <TouchableOpacity style={styles.sendOtpBtn} onPress={sendOTP} disabled={otpLoading}>
                  {otpLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.sendOtpBtnText}>Send OTP</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => { setOtpModalVisible(false); setVerificationPlayerId(null); }}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.modalSubtitle}>Enter the 6-digit OTP sent to the player.</Text>
                
                <TextInput
                  style={[styles.input, { textAlign: 'center', fontSize: 20, letterSpacing: 4, color: '#fff' }]}
                  placeholder="------"
                  placeholderTextColor={Colors.textTertiary}
                  value={otpCode}
                  onChangeText={setOtpCode}
                  keyboardType="number-pad"
                  maxLength={6}
                />

                <TouchableOpacity style={styles.sendOtpBtn} onPress={verifyOTP} disabled={otpLoading}>
                  {otpLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.sendOtpBtnText}>Verify Match</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => { setOtpModalVisible(false); setOtpSent(false); setOtpCode(''); setVerificationPlayerId(null); }}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
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
  settingsBtn: { padding: 4 },
  headerTitle: {
    fontSize: 18,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.textPrimary,
  },
  content: {
    paddingBottom: 60,
  },
  matchupContainer: {
    backgroundColor: Colors.backgroundElevated,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  teamsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  teamCol: {
    flex: 2,
    alignItems: 'center',
  },
  vsBadgeContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamCircleSlot: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  teamCircleSlotSelected: {
    borderColor: Colors.primary,
    borderStyle: 'solid',
    backgroundColor: Colors.backgroundCard,
  },
  teamLogoImg: {
    width: 76,
    height: 76,
    borderRadius: 38,
  },
  teamSelectionName: {
    fontSize: 13,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.textPrimary,
    textAlign: 'center',
    width: (SCREEN_WIDTH - 60) / 2.5,
    marginBottom: 4,
  },
  squadBadge: {
    backgroundColor: Colors.primary,
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 14,
    marginTop: 4,
  },
  squadBadgeText: {
    fontSize: 11,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.background || '#000000',
  },
  vsCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vsCircleText: {
    fontSize: 11,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.textSecondary,
  },
  formContainer: {
    padding: Spacing.base,
  },
  inputGroup: {
    marginBottom: Spacing.lg,
  },
  fieldLabel: {
    fontSize: 13,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  underlineInput: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    color: Colors.textPrimary,
    fontSize: 15,
    fontFamily: Typography.fontFamily.medium,
    paddingVertical: Platform.OS === 'ios' ? 8 : 4,
    backgroundColor: 'transparent',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  chipSelected: {
    backgroundColor: Colors.primaryAlpha10,
    borderColor: Colors.primary,
    borderWidth: 1.5,
  },
  chipText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontFamily: Typography.fontFamily.medium,
  },
  chipTextSelected: {
    color: Colors.primary,
    fontFamily: Typography.fontFamily.bold,
  },
  ballsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    marginTop: 6,
  },
  ballOption: {
    alignItems: 'center',
    marginHorizontal: 8,
  },
  /* Outer ring — no overflow:hidden so border + badge are never clipped */
  ballRing: {
    width: 56,
    height: 56,
    borderRadius: 28,
    padding: 3,
    borderWidth: 3,
    borderColor: 'transparent',
    position: 'relative',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  ballRingSelected: {
    borderColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 8,
  },
  /* Inner image clip circle */
  ballCircle: {
    width: '100%',
    height: '100%',
    borderRadius: 25,
    overflow: 'hidden',
  },
  ballImage: {
    width: '100%',
    height: '100%',
  },
  /* Check badge sits outside the clip circle */
  ballCheckedBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 1,
  },
  ballLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.medium,
    marginTop: 6,
  },
  ballLabelSelected: {
    color: Colors.primary,
    fontFamily: Typography.fontFamily.bold,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  toggleTitle: {
    fontSize: 14,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.textPrimary,
  },
  toggleSubtitle: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  stickyBottomBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    backgroundColor: Colors.background,
  },
  scheduleBtn: {
    flex: 1,
    backgroundColor: Colors.backgroundElevated,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scheduleBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontFamily: Typography.fontFamily.bold,
  },
  nextBtn: {
    flex: 1.2,
    backgroundColor: Colors.primary,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextBtnText: {
    color: Colors.background || '#000000',
    fontSize: 15,
    fontFamily: Typography.fontFamily.bold,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  modalContent: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 16,
    padding: Spacing.xl,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: Typography.fontFamily.bold,
    color: '#fff',
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.textSecondary,
    marginBottom: Spacing.lg,
    textAlign: 'center',
  },
  playerSelectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  playerSelectName: {
    fontSize: 16,
    fontFamily: Typography.fontFamily.medium,
    color: '#fff',
    flex: 1,
  },
  sendOtpBtn: {
    backgroundColor: Colors.primary,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
  sendOtpBtnText: {
    color: Colors.background,
    fontFamily: Typography.fontFamily.bold,
    fontSize: 16,
  },
  cancelBtn: {
    marginTop: Spacing.md,
    padding: 10,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.medium,
    fontSize: 14,
  },
});

export default MatchSetupScreen;
