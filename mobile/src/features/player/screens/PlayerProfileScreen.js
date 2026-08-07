import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import React, { useEffect, useState, useCallback } from 'react';
import LocationAutocomplete from '../../../components/LocationAutocomplete';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput,
  ActivityIndicator, Modal, Platform, SafeAreaView, StatusBar,
  FlatList, Image, Dimensions,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { fetchMyPlayer, updatePlayerProfile, fetchMatchHistory } from '../playerSlice';
import { Colors, Typography } from '../../../theme/theme';
import { showCustomAlert } from '../../../components/CustomAlert';
import DateTimePicker from '@react-native-community/datetimepicker';
import Icon from 'react-native-vector-icons/Ionicons';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import api, { getImageUrl } from '../../../api/axios';
import LinearGradient from '../../../components/SolidGradient';

const OUTDOOR_GROUND = require('../../../ground.png');
const INDOOR_GROUND = require('../../../turf.png');

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const ROLES = ['Batsman', 'Bowler', 'All Rounder', 'Wicket Keeper', 'Wicket Keeper Batsman'];
const BATTING_STYLES = ['Right Hand', 'Left Hand'];
const BATTING_ORDERS = ['Top Order', 'Middle Order', 'Lower Order', 'Tailender'];
const BOWLING_STYLES = ['Right Arm Fast', 'Right Arm Medium', 'Right Arm Off Spin', 'Right Arm Leg Spin', 'Left Arm Fast', 'Left Arm Medium', 'Left Arm Orthodox', 'Left Arm Wrist Spin', 'None'];
const GENDERS = ['Male', 'Female', 'Other'];
const BALL_TYPES = ['Overall', 'Tennis', 'Leather', 'Other'];
const STAT_TABS = ['Statistics', 'Matches', 'Analytics', 'Achievements', 'Awards'];

// ─── Dropdown ────────────────────────────────────────────────────────────────
const Dropdown = ({ label, value, options, onSelect }) => {
  const [visible, setVisible] = useState(false);
  return (
    <View style={styles.fieldContainer}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity style={styles.dropdownBtn} onPress={() => setVisible(true)}>
        <Text style={[styles.dropdownBtnText, !value && { color: Colors.textSecondary }]}>{value || 'Select ' + label}</Text>
        <Icon name="chevron-down" size={20} color={Colors.textSecondary} />
      </TouchableOpacity>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setVisible(false)}>
          <View style={styles.modalContent}>
            <KeyboardAwareScrollView enableOnAndroid={true} extraScrollHeight={20} keyboardShouldPersistTaps="handled" style={{ maxHeight: 300 }}>
              {options.map(opt => (
                <TouchableOpacity key={opt} style={styles.modalItem} onPress={() => { onSelect(opt); setVisible(false); }}>
                  <Text style={[styles.modalItemText, value === opt && styles.modalItemTextActive]}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </KeyboardAwareScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

// ─── Stat Tile ───────────────────────────────────────────────────────────────
const StatTile = ({ value, label, accent, flex }) => (
  <View style={[styles.statTile, { borderColor: accent ? `${accent}30` : Colors.border }, flex ? { flex, width: 'auto' } : {}]}>
    <Text style={[styles.statTileValue, { color: accent || Colors.primary }]}>{value ?? '-'}</Text>
    <Text style={styles.statTileLabel}>{label}</Text>
  </View>
);

// ─── Section Heading ─────────────────────────────────────────────────────────
const SectionHeading = ({ icon, title, color }) => (
  <View style={styles.sectionHeading}>
    <View style={[styles.sectionHeadingBar, { backgroundColor: color || Colors.primary }]} />
    <MCIcon name={icon} size={14} color={color || Colors.primary} style={{ marginRight: 6 }} />
    <Text style={styles.sectionHeadingText}>{title}</Text>
  </View>
);

// ─── Real Wagon Wheel ─────────────────────────────────────────────────────────
// Renders actual shot lines on a cricket ground image.
// angle = 0 is straight (toward bowler end), clockwise positive.
const WW_SIZE = SCREEN_WIDTH - 32 - 28; // content padding (16*2) + card padding (14*2)
const WW_CENTER = WW_SIZE / 2;
const WW_RADIUS = WW_SIZE / 2;

const getShotColor = (shot) => {
  if (shot.isSix) return '#FF5722';      // orange-red for sixes
  if (shot.isBoundary) return '#4CAF50'; // green for fours
  if (shot.runs >= 3) return '#29B6F6';  // blue for 3
  if (shot.runs === 2) return '#AB47BC'; // purple for 2
  if (shot.runs === 1) return Colors.primary; // primary for singles
  return 'rgba(255,255,255,0.25)';        // grey for dots
};

const shotEndPoint = (angle, distance, radius) => {
  // angle in degrees, 0 = top (mid-on direction), clockwise
  const rad = ((angle - 90) * Math.PI) / 180;
  const dist = Math.min(distance / 100, 1) * (radius - 8);
  return {
    x: WW_CENTER + dist * Math.cos(rad),
    y: WW_CENTER + dist * Math.sin(rad),
  };
};

const RealWagonWheel = ({ shots, groundType, loading }) => {
  const isTurf = groundType === 'indoor';
  const groundImg = isTurf ? INDOOR_GROUND : OUTDOOR_GROUND;
  const filteredShots = shots.filter(s =>
    groundType === 'all' ? true : s.groundType === groundType
  );

  // Stats summary
  const sixCount = filteredShots.filter(s => s.isSix).length;
  const fourCount = filteredShots.filter(s => s.isBoundary).length;
  const dotCount = filteredShots.filter(s => s.runs === 0).length;
  const totalShots = filteredShots.length;

  const WW_W = isTurf ? Math.min(WW_SIZE * 0.75, 220) : WW_SIZE;
  const WW_H = isTurf ? Math.min(WW_SIZE * 1.2, 360) : WW_SIZE;
  const CX = WW_W / 2;
  const CY = WW_H / 2;
  const CY_ACTUAL = CY - (isTurf ? WW_H * (60 / 360) : WW_H * (40 / 300));

  return (
    <View style={styles.wwOuter}>
      {/* Ground image with shot lines drawn on top */}
      <View style={[styles.wwCircleWrap, { width: WW_W, height: WW_H, borderRadius: isTurf ? 16 : WW_W / 2 }]}>
        <Image source={groundImg} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: WW_W, height: WW_H }} resizeMode="cover" />
        {/* Dark overlay to make lines pop */}
        <View style={styles.wwOverlay} />

        {/* Zone labels matching LiveScorer */}
        <Text style={{ position: 'absolute', top: 20, left: CX - 30, width: 60, textAlign: 'center', color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: 'bold' }}>BEHIND</Text>
        <Text style={{ position: 'absolute', bottom: 20, left: CX - 40, width: 80, textAlign: 'center', color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: 'bold' }}>STRAIGHT</Text>
        <Text style={{ position: 'absolute', right: 20, top: CY_ACTUAL - 8, color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: 'bold' }}>LEG</Text>
        <Text style={{ position: 'absolute', left: 20, top: CY_ACTUAL - 8, color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: 'bold' }}>OFF</Text>

        {/* Center stumps dot */}
        <View style={{ position: 'absolute', left: CX - 4, top: CY_ACTUAL - 4, width: 8, height: 8, borderRadius: 4, backgroundColor: 'red' }} />

        {loading ? (
          <View style={styles.wwLoadingWrap}>
            <ActivityIndicator color={Colors.primary} size="large" />
            <Text style={styles.wwLoadingText}>Loading shots...</Text>
          </View>
        ) : filteredShots.length === 0 ? (
          <View style={styles.wwLoadingWrap}>
            <MCIcon name="cricket" size={32} color={`${Colors.primary}60`} />
            <Text style={styles.wwLoadingText}>No wagon wheel data yet</Text>
            <Text style={[styles.wwLoadingText, { fontSize: 10, marginTop: 4 }]}>Scorer must record shot direction</Text>
          </View>
        ) : (
          // Draw each shot as a line from center to edge
          filteredShots.map((shot, i) => {
            const scaleFactor = WW_W / (isTurf ? 220 : 300);
            const distance = (isTurf ? shot.distance * 1.5 : shot.distance) * scaleFactor;
            const color = getShotColor(shot);
            return (
              <View
                key={i}
                style={{
                  position: 'absolute',
                  left: CX - distance,
                  top: CY_ACTUAL - 2,
                  width: distance * 2,
                  height: 1.5,
                  justifyContent: 'center',
                  alignItems: 'flex-end',
                  transform: [{ rotate: `${shot.angle}deg` }],
                  opacity: shot.isBoundary || shot.isSix ? 0.9 : 0.65,
                }}>
                <View style={{ width: distance, height: 1.5, backgroundColor: color }} />
              </View>
            );
          })
        )}
      </View>

      {/* Legend */}
      {totalShots > 0 && (
        <View style={styles.wwLegendRow}>
          {[
            { color: '#FF5722', label: `6s (${sixCount})` },
            { color: '#4CAF50', label: `4s (${fourCount})` },
            { color: Colors.primary, label: `Singles` },
            { color: 'rgba(255,255,255,0.3)', label: `Dots (${dotCount})` },
          ].map(l => (
            <View key={l.label} style={styles.wwLegendItem}>
              <View style={[styles.wwLegendDot, { backgroundColor: l.color }]} />
              <Text style={styles.wwLegendText}>{l.label}</Text>
            </View>
          ))}
        </View>
      )}
      {totalShots > 0 && (
        <Text style={styles.wwTotalText}>{totalShots} shots recorded</Text>
      )}
    </View>
  );
};

// ─── Achievement Badge ────────────────────────────────────────────────────────
const AchievementBadge = ({ icon, color, title, desc, earned, timesEarned }) => (
  <View style={[styles.achieveBadge, !earned && { opacity: 0.45 }]}>
    <View style={[styles.achieveIconWrap, { backgroundColor: earned ? `${color}20` : 'rgba(255,255,255,0.04)' }]}>
      <MCIcon name={icon} size={26} color={earned ? color : Colors.textTertiary} />
    </View>
    <Text style={[styles.achieveTitle, !earned && { color: Colors.textTertiary }]}>{title}</Text>
    <Text style={[styles.achieveDesc, !earned && { color: Colors.textTertiary }]}>{desc}</Text>
    {earned && timesEarned > 0 && <Text style={[styles.achieveDesc, { color: Colors.primary, marginTop: 4, fontFamily: Typography.fontFamily.semiBold }]}>Awarded {timesEarned} times</Text>}
    {!earned && (
      <View style={styles.achieveLock}>
        <MCIcon name="lock" size={10} color={Colors.textTertiary} />
      </View>
    )}
  </View>
);

// ─── Award Card ───────────────────────────────────────────────────────────────
const AwardCard = ({ icon, color, title, count, matches }) => (
  <View style={[styles.awardCard, { borderColor: `${color}30` }]}>
    <LinearGradient colors={[`${color}15`, 'transparent']} style={styles.awardGradient}>
      <View style={[styles.awardIconCircle, { backgroundColor: `${color}20` }]}>
        <MCIcon name={icon} size={20} color={color} />
      </View>
      <Text style={[styles.awardCount, { color }]}>{count}</Text>
      <Text style={styles.awardTitle}>{title}</Text>
      {count > 0 && <Text style={styles.awardSub}>Awarded {count} times</Text>}
    </LinearGradient>
  </View>
);

// ─── Main Screen ──────────────────────────────────────────────────────────────
const PlayerProfileScreen = ({ navigation }) => {
  const dispatch = useDispatch();
  const { user } = useSelector(state => state.auth);
  const matchHistory = useSelector(state => state.player.matchHistory || []);
  const { myProfile, isLoading } = useSelector(state => state.player);

  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [form, setForm] = useState({
    name: '', mobile: '', email: '', location: '', dob: '',
    gender: 'Male', playingRole: 'Batsman', battingStyle: 'Right Hand',
    battingOrder: 'Top Order', bowlingStyle: 'Right Arm Fast',
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [socialModalVisible, setSocialModalVisible] = useState(false);
  const [socialType, setSocialType] = useState('followers');
  const [socialList, setSocialList] = useState([]);
  const [socialLoading, setSocialLoading] = useState(false);
  const [imgErrors, setImgErrors] = useState({});
  const [activeStatTab, setActiveStatTab] = useState('Statistics');
  const [scoringWindowOffset, setScoringWindowOffset] = useState(0); // 0 = show latest 7
  const [activeBallType, setActiveBallType] = useState('Overall');
  const [wwGroundType, setWwGroundType] = useState('outdoor'); // 'outdoor' | 'indoor'
  const [wagonWheelData, setWagonWheelData] = useState({ shots: [], totalShots: 0 });
  const [wwLoading, setWwLoading] = useState(false);

  const loadSocialList = async (type) => {
    if (!myProfile) return;
    setSocialType(type);
    setSocialModalVisible(true);
    setSocialLoading(true);
    try {
      const res = await api.get(`/players/${myProfile._id}/${type}`);
      setSocialList(res.data.data || []);
    } catch {
      showCustomAlert('Error', 'Failed to load list');
    } finally {
      setSocialLoading(false);
    }
  };

  const handleRemoveFollower = async (id) => {
    try {
      await api.delete(`/players/${myProfile._id}/followers/${id}`);
      setSocialList(prev => prev.filter(p => p._id !== id));
      dispatch(fetchMyPlayer());
    } catch (err) {
      showCustomAlert('Error', err.response?.data?.message || 'Failed to remove follower');
    }
  };

  const handleUnfollowFromList = async (id) => {
    try {
      await api.delete(`/players/${myProfile._id}/following/${id}`);
      setSocialList(prev => prev.filter(p => p._id !== id));
      dispatch(fetchMyPlayer());
    } catch (err) {
      showCustomAlert('Error', err.response?.data?.message || 'Failed to unfollow');
    }
  };

  useEffect(() => { dispatch(fetchMyPlayer()); }, [dispatch]);
  useEffect(() => {
    if (myProfile?._id) {
      dispatch(fetchMatchHistory({ playerId: myProfile._id, ballType: activeBallType }));
      setScoringWindowOffset(0);
    }
  }, [dispatch, myProfile?._id, activeBallType]);

  // Fetch wagon wheel data when Analytics tab is opened or ball filter changes
  useEffect(() => {
    const fetchWagonWheel = async () => {
      if (!myProfile?._id || activeStatTab !== 'Analytics') return;
      setWwLoading(true);
      try {
        let url = `/players/${myProfile._id}/wagon-wheel`;
        if (activeBallType !== 'Overall') {
          url += `?ballType=${activeBallType}`;
        }
        const res = await api.get(url);
        setWagonWheelData(res.data.data || { shots: [], totalShots: 0 });
      } catch (err) {
        console.error('Failed to fetch wagon wheel', err);
      } finally {
        setWwLoading(false);
      }
    };
    fetchWagonWheel();
  }, [myProfile?._id, activeStatTab, activeBallType]);

  useEffect(() => {
    if (myProfile) {
      setForm({
        name: myProfile.userId?.name || user?.name || '',
        mobile: myProfile.userId?.mobile || user?.mobile || '',
        email: myProfile.userId?.email || user?.email || '',
        location: myProfile.location || myProfile.city || user?.city || '',
        dob: myProfile.dob ? new Date(myProfile.dob).toISOString().split('T')[0] : '',
        gender: myProfile.gender || 'Male',
        playingRole: myProfile.playingRole || 'Batsman',
        battingStyle: myProfile.battingStyle || 'Right Hand',
        battingOrder: myProfile.battingOrder || 'Top Order',
        bowlingStyle: myProfile.bowlingStyle || 'Right Arm Fast',
      });
    } else if (user) {
      setForm(prev => ({ 
        ...prev, 
        name: user.name || '', 
        mobile: user.mobile || '', 
        email: user.email || '',
        location: user.city || ''
      }));
    }
  }, [myProfile, user]);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await dispatch(updatePlayerProfile(form)).unwrap();
      showCustomAlert('Success', 'Cricket profile updated successfully!');
      setIsEditModalVisible(false);
    } catch (err) {
      const msg = typeof err === 'string' ? err : (err?.message || err?.error || 'Failed to update profile');
      showCustomAlert('Error', msg);
    } finally {
      setIsSaving(false);
    }
  };

  const onDateChange = (event, selectedDate) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) setForm(prev => ({ ...prev, dob: selectedDate.toISOString().split('T')[0] }));
  };

  // ── Derive stats ──────────────────────────────────────────────────────────
  // statsByBallType is a Mongoose Map — access via .get() or plain object keys
  const getStats = (ballType) => {
    if (ballType === 'Overall') {
      return myProfile || {};
    }
    const sbt = myProfile?.statsByBallType;
    if (!sbt) return {};
    // Handle both Map (from SDK) and plain object (from JSON)
    if (typeof sbt.get === 'function') return sbt.get(ballType) || {};
    return sbt[ballType] || {};
  };

  const currentStats = getStats(activeBallType);
  const bat = currentStats.batting || {};
  const bowl = currentStats.bowling || {};
  const field = currentStats.fielding || {};
  const careerMatches = myProfile?.career?.matches || 0;

  const batAvg = bat.innings && (bat.innings - (bat.notOuts || 0)) > 0
    ? (bat.runs / (bat.innings - (bat.notOuts || 0))).toFixed(1) : '—';
  const batSR = bat.balls ? ((bat.runs / bat.balls) * 100).toFixed(1) : '—';
  const bowlOversVal = bowl.overs ? (bowl.overs + (bowl.balls || 0) / 6) : 0;
  const bowlAvg = bowl.wickets ? (bowl.runs / bowl.wickets).toFixed(1) : '—';
  const bowlEcon = bowlOversVal > 0 ? (bowl.runs / bowlOversVal).toFixed(2) : '—';
  const bowlSR = bowl.wickets && bowl.balls ? (bowl.balls / bowl.wickets).toFixed(1) : '—';
  const bowlOverDisplay = bowl.overs != null
    ? `${bowl.overs}.${bowl.balls || 0}`
    : '0.0';
  const bestFig = (bowl.bestWickets != null && bowl.bestWickets > 0) ? `${bowl.bestWickets}/${bowl.bestRuns}` : '—';

  const overallBat = getStats('Overall').batting || {};
  const overallBowl = getStats('Overall').bowling || {};

  // ── Ball Filter Strip ──────────────────────────────────────────────────────
  const BallFilter = () => (
    <KeyboardAwareScrollView enableOnAndroid={true} extraScrollHeight={20} keyboardShouldPersistTaps="handled" horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.ballFilterRow}>
      {BALL_TYPES.map(b => (
        <TouchableOpacity
          key={b}
          style={[styles.ballChip, activeBallType === b && styles.ballChipActive]}
          onPress={() => setActiveBallType(b)}
        >
          <Text style={[styles.ballChipText, activeBallType === b && styles.ballChipTextActive]}>{b}</Text>
        </TouchableOpacity>
      ))}
    </KeyboardAwareScrollView>
  );

  // ── Tab content ────────────────────────────────────────────────────────────
  const renderStatContent = () => {

    // ── STATISTICS ──────────────────────────────────────────────────────────
    if (activeStatTab === 'Statistics') {
      return (
        <View>
          <BallFilter />

          {/* Batting */}
          <View style={styles.statsCard}>
            <SectionHeading icon="cricket" title="Batting" color={Colors.primary} />
            <View style={styles.statGrid}>
              <StatTile value={bat.innings ?? 0} label="Innings" accent={Colors.primary} />
              <StatTile value={bat.runs ?? 0} label="Runs" accent={Colors.primary} />
              <StatTile value={batAvg} label="Average" accent={Colors.primary} />
              <StatTile value={batSR} label="S/R" accent={Colors.primary} />
              <StatTile value={bat.highestScore ?? '—'} label="H/S" accent={Colors.primary} />
              <StatTile value={bat.fifties ?? 0} label="50s" accent={Colors.primary} />
              <StatTile value={bat.hundreds ?? 0} label="100s" accent={Colors.primary} />
              <StatTile value={bat.fours ?? 0} label="4s" accent={Colors.primary} />
              <StatTile value={bat.sixes ?? 0} label="6s" accent={Colors.primary} />
              <StatTile value={bat.notOuts ?? 0} label="Not Outs" accent={Colors.primary} />
            </View>
          </View>

          {/* Bowling */}
          <View style={styles.statsCard}>
            <SectionHeading icon="bowling" title="Bowling" color={Colors.primary} />
            <View style={styles.statGrid}>
              <StatTile value={bowl.innings ?? 0} label="Innings" accent={Colors.primary} />
              <StatTile value={bowl.wickets ?? 0} label="Wickets" accent={Colors.primary} />
              <StatTile value={bowl.runs ?? 0} label="Runs" accent={Colors.primary} />
              {/* <StatTile value={bowlOverDisplay} label="Overs" accent={Colors.primary} /> */}
              <StatTile value={bowlAvg} label="Average" accent={Colors.primary} />
              <StatTile value={bowlEcon} label="Economy" accent={Colors.primary} />
              <StatTile value={bowlSR} label="S/R" accent={Colors.primary} />
              <StatTile value={bestFig} label="Best" accent={Colors.primary} />
              <StatTile value={bowl.threeWicketHauls ?? 0} label="3W" accent={Colors.primary} />
              <StatTile value={bowl.fiveWicketHauls ?? 0} label="5W" accent={Colors.primary} />
              <StatTile value={bowl.maidens ?? 0} label="Maidens" accent={Colors.primary} />
            </View>
          </View>

          {/* Fielding */}
          <View style={styles.statsCard}>
            <SectionHeading icon="hand-back-right" title="Fielding" color={Colors.primary} />
            <View style={styles.fieldingRow}>
              {[
                { icon: 'hand-back-right', color: Colors.primary, val: field.catches ?? 0, label: 'Catches' },
                { icon: 'run-fast', color: Colors.primary, val: field.runOuts ?? 0, label: 'Run Outs' },
                { icon: 'target', color: Colors.primary, val: field.stumpings ?? 0, label: 'Stumpings' },
                { icon: 'shield-star', color: Colors.success, val: (field.catches ?? 0) + (field.runOuts ?? 0) + (field.stumpings ?? 0), label: 'Total' },
              ].map(f => (
                <View key={f.label} style={styles.fieldingBox}>
                  <MCIcon name={f.icon} size={20} color={f.color} />
                  <Text style={[styles.fieldingVal, { color: f.color }]}>{f.val}</Text>
                  <Text style={styles.fieldingLbl}>{f.label}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      );
    }

    // ── MATCHES ─────────────────────────────────────────────────────────────
    if (activeStatTab === 'Matches') {
      if (isLoading) return <View style={styles.tabCenteredEmpty}><ActivityIndicator color={Colors.primary} size="large" /></View>;
      if (!matchHistory || matchHistory.length === 0) return (
        <View style={styles.tabCenteredEmpty}>
          <MCIcon name="baseball" size={52} color={Colors.textTertiary} />
          <Text style={styles.emptyText}>No match history yet</Text>
        </View>
      );
      return (
        <View>
          <BallFilter />
          {[...matchHistory].reverse().map((match, idx) => {
            const isLive = match.status === 'in_progress';
            const teamAName = match.teamA?.shortName || match.teamA?.name || 'Team A';
            const teamBName = match.teamB?.shortName || match.teamB?.name || 'Team B';
            const statusText = isLive 
              ? 'Match is Ongoing' 
              : (match.resultSummary || 'Match Completed');

            return (
              <TouchableOpacity key={idx} style={[styles.matchCard, isLive && styles.matchCardLive]} activeOpacity={0.8}
                onPress={() => { if (match.matchId) navigation.navigate('MatchSummary', { matchId: match.matchId }); }}>
                <View style={{ flex: 1 }}>
                  {/* Top row: Team Names + Status Indicator */}
                  <View style={styles.matchCardHeader}>
                    <Text style={styles.matchTeamsText} numberOfLines={1}>
                      {teamAName} <Text style={{ color: Colors.primary, fontFamily: Typography.fontFamily.bold }}>vs</Text> {teamBName}
                    </Text>
                  </View>

                  {/* Center row: Score/Stats + Live/Date Indicator */}
                  <View style={styles.matchCardBody}>
                    <View style={{ flex: 1 }}>
                      {match.runs !== null ? (
                        <>
                          <Text style={styles.matchRunsValue}>{match.runs}{match.isNotOut ? '*' : ''} <Text style={{ fontSize: 13, color: Colors.textSecondary, fontFamily: Typography.fontFamily.regular }}>runs</Text></Text>
                          <Text style={styles.matchRunsLabel}>{match.balls || 0} balls · {match.fours || 0}×4s · {match.sixes || 0}×6s</Text>
                        </>
                      ) : <Text style={styles.matchDNB}>Did Not Bat</Text>}
                    </View>

                    <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
                      {isLive ? (
                        <View style={styles.liveBadge}>
                          <View style={styles.liveDot} />
                          <Text style={styles.liveText}>LIVE</Text>
                        </View>
                      ) : (
                        <Text style={styles.matchDate}>{match.date ? new Date(match.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : ''}</Text>
                      )}
                    </View>
                  </View>

                  {/* Bottom row: Match Status / Result Summary */}
                  <View style={styles.matchCardFooter}>
                    <Text style={[styles.matchStatusText, isLive && { color: Colors.primary }]} numberOfLines={1}>
                      {statusText}
                    </Text>
                  </View>
                </View>
                <Icon name="chevron-forward" size={16} color={Colors.textTertiary} style={{ marginLeft: 8 }} />
              </TouchableOpacity>
            );
          })}
        </View>
      );
    }

    // ── ANALYTICS ───────────────────────────────────────────────────────────
    if (activeStatTab === 'Analytics') {
      return (
        <View>
          <BallFilter />

          <View style={styles.statsCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <View style={[styles.sectionHeading, { marginBottom: 0 }]}>
                <View style={[styles.sectionHeadingBar, { backgroundColor: Colors.primary }]} />
                <MCIcon name="chart-donut" size={14} color={Colors.primary} style={{ marginRight: 6 }} />
                <Text style={styles.sectionHeadingText}>Wagon Wheel</Text>
              </View>
              <View style={styles.wwToggleRow}>
                {['outdoor', 'indoor'].map(t => (
                  <TouchableOpacity key={t} style={[styles.wwToggleBtn, wwGroundType === t && styles.wwToggleBtnActive]} onPress={() => setWwGroundType(t)}>
                    <Text style={[styles.wwToggleText, wwGroundType === t && styles.wwToggleTextActive]}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <RealWagonWheel shots={wagonWheelData.shots || []} groundType={wwGroundType} loading={wwLoading} />
          </View>

          <View style={styles.statsCard}>
            <SectionHeading icon="chart-line" title="Scoring Pattern" color={Colors.primary} />
            {(() => {
              const WINDOW = 7;
              const total = matchHistory.length;

              // Clamp offset: 0 = latest window, positive = further back in time
              const maxOffset = Math.max(0, total - WINDOW);
              const clampedOffset = Math.min(scoringWindowOffset, maxOffset);

              // Slice window from the full sorted (oldest→newest) history
              const startIdx = Math.max(0, total - WINDOW - clampedOffset);
              const endIdx = startIdx + WINDOW;
              const window = matchHistory.slice(startIdx, Math.min(endIdx, total));

              const canGoPrev = clampedOffset < maxOffset; // older matches exist
              const canGoNext = clampedOffset > 0;         // newer matches exist

              // Compute stats for visible window only
              const battingEntries = window.filter(m => m.runs !== null);
              const windowInnings = battingEntries.length;
              const windowRuns = battingEntries.reduce((s, m) => s + (m.runs || 0), 0);
              const windowAvg = windowInnings > 0 ? Math.round(windowRuns / windowInnings) : 0;
              const windowHS = battingEntries.reduce((mx, m) => Math.max(mx, m.runs || 0), 0);

              const BAR_HEIGHT = 80;
              const BAR_CONTAINER_H = 100;
              const AVG_COLOR = '#FF9500';
              const maxVal = Math.max(windowHS, 10);
              const avgBarH = (windowAvg / maxVal) * BAR_HEIGHT;
              const avgLineY = BAR_CONTAINER_H - avgBarH;

              return (
                <View style={{ paddingHorizontal: 4, paddingTop: 8, paddingBottom: 4 }}>
                  {/* Summary stats row — dynamic for current window */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginBottom: 14 }}>
                    <View style={{ alignItems: 'center' }}>
                      <Text style={{ color: Colors.primary, fontSize: 18, fontFamily: Typography.fontFamily.bold }}>{windowHS}</Text>
                      <Text style={{ color: Colors.textSecondary, fontSize: 10 }}>High Score</Text>
                    </View>
                    <View style={{ width: 1, backgroundColor: Colors.border, height: 34 }} />
                    <View style={{ alignItems: 'center' }}>
                      <Text style={{ color: Colors.primary, fontSize: 18, fontFamily: Typography.fontFamily.bold }}>{windowAvg}</Text>
                      <Text style={{ color: Colors.textSecondary, fontSize: 10 }}>Avg/Innings</Text>
                    </View>
                    <View style={{ width: 1, backgroundColor: Colors.border, height: 34 }} />
                    <View style={{ alignItems: 'center' }}>
                      <Text style={{ color: Colors.primary, fontSize: 18, fontFamily: Typography.fontFamily.bold }}>{windowInnings}</Text>
                      <Text style={{ color: Colors.textSecondary, fontSize: 10 }}>Innings</Text>
                    </View>
                  </View>

                  {/* Nav + chart */}
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {/* Prev arrow */}
                    <TouchableOpacity
                      onPress={() => canGoPrev && setScoringWindowOffset(clampedOffset + 1)}
                      style={{ padding: 6, opacity: canGoPrev ? 1 : 0.25 }}
                    >
                      <MCIcon name="chevron-left" size={22} color={Colors.primary} />
                    </TouchableOpacity>

                    {/* Chart */}
                    <View style={{ flex: 1, height: BAR_CONTAINER_H + 18, position: 'relative' }}>
                      {/* Avg line */}
                      {windowInnings > 0 && (
                        <View style={{ position: 'absolute', top: avgLineY, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', zIndex: 10 }}>
                          <View style={{ flex: 1, height: 1, borderStyle: 'dashed', borderWidth: 1, borderColor: AVG_COLOR }} />
                          <View style={{ backgroundColor: AVG_COLOR, borderRadius: 3, paddingHorizontal: 4, paddingVertical: 1, marginLeft: 3 }}>
                            <Text style={{ color: '#000', fontSize: 8, fontFamily: Typography.fontFamily.bold }}>∅{windowAvg}</Text>
                          </View>
                        </View>
                      )}

                      {/* Bars row */}
                      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: BAR_CONTAINER_H, paddingHorizontal: 2 }}>
                        {window.map((match, i) => {
                          const isDnb = match.runs === null;
                          const score = isDnb ? 0 : (match.runs || 0);
                          const barH = isDnb ? 6 : Math.max(8, (score / maxVal) * BAR_HEIGHT);
                          const isHS = score === windowHS && score > 0;
                          return (
                            <View key={i} style={{ alignItems: 'center', flex: 1, gap: 2 }}>
                              <Text style={{ color: isHS ? Colors.primary : Colors.textSecondary, fontSize: 9, fontFamily: isHS ? Typography.fontFamily.bold : 'normal' }}>
                                {isDnb ? '—' : score}{match.isNotOut && !isDnb ? '*' : ''}
                              </Text>
                              <View style={{ width: 18, height: barH, borderRadius: 5, overflow: 'hidden' }}>
                                <LinearGradient
                                  colors={isDnb ? ['#2A2A2A', '#000000'] : isHS ? [Colors.primary, Colors.primary + 'BB'] : [Colors.primary + 'CC', Colors.primary + '44']}
                                  start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
                                  style={{ flex: 1 }}
                                />
                              </View>
                            </View>
                          );
                        })}
                        {/* Pad if fewer than WINDOW matches */}
                        {Array.from({ length: Math.max(0, WINDOW - window.length) }).map((_, i) => (
                          <View key={`pad-${i}`} style={{ flex: 1 }} />
                        ))}
                      </View>

                      {/* X-axis labels */}
                      <View style={{ flexDirection: 'row', paddingHorizontal: 2 }}>
                        {window.map((_, i) => (
                          <Text key={i} style={{ flex: 1, textAlign: 'center', color: Colors.whiteAlpha20, fontSize: 8 }}>
                            #{startIdx + i + 1}
                          </Text>
                        ))}
                        {Array.from({ length: Math.max(0, WINDOW - window.length) }).map((_, i) => (
                          <View key={`lpad-${i}`} style={{ flex: 1 }} />
                        ))}
                      </View>
                    </View>

                    {/* Next arrow */}
                    <TouchableOpacity
                      onPress={() => canGoNext && setScoringWindowOffset(clampedOffset - 1)}
                      style={{ padding: 6, opacity: canGoNext ? 1 : 0.25 }}
                    >
                      <MCIcon name="chevron-right" size={22} color={Colors.primary} />
                    </TouchableOpacity>
                  </View>

                  {/* Footer label */}
                  <Text style={{ color: Colors.dot, fontSize: 9, textAlign: 'center', marginTop: 6 }}>
                    Showing innings #{startIdx + 1}–{Math.min(startIdx + window.length, total)} of {total} · Tap ‹ › to navigate
                  </Text>
                </View>
              );
            })()}
          </View>




          <View style={styles.statsCard}>
            <SectionHeading icon="trophy-outline" title="Match Contribution" color={Colors.primary} />
            <View style={styles.statGrid}>
              <StatTile flex={1} value={myProfile?.career?.winsBattingFirst || 0} label="Batting 1st" accent={Colors.primary} />
              <StatTile flex={1} value={myProfile?.career?.winsBowlingFirst || 0} label="Bowling 1st" accent={Colors.primary} />
              <StatTile flex={1} value={careerMatches} label="Matches" accent={Colors.primary} />
              <StatTile flex={1} value={myProfile?.career?.wins ?? 0} label="Wins" accent={Colors.primary} />
            </View>
          </View>
        </View>
      );
    }

    // ── ACHIEVEMENTS ─────────────────────────────────────────────────────────
    if (activeStatTab === 'Achievements') {
      const totalRuns = overallBat.runs || 0;
      const totalWickets = overallBowl.wickets || 0;
      return (
        <View>
          <View style={styles.statsCard}>
            <SectionHeading icon="medal" title="Batting Milestones" color={Colors.primary} />
            <View style={styles.achieveGrid}>
              <AchievementBadge icon="numeric-1-circle" color={Colors.primary} title="First Run" desc="Score your first run" earned={totalRuns >= 1} />
              <AchievementBadge icon="star" color={Colors.primary} title="Hundred Runs" desc="100+ total runs" earned={totalRuns >= 100} />
              <AchievementBadge icon="star" color={Colors.primary} title="Run Machine" desc="500+ total runs" earned={totalRuns >= 500} />
              <AchievementBadge icon="star" color={Colors.primary} title="Run Accumulator" desc="1000+ total runs" earned={totalRuns >= 1000} />
              
              <AchievementBadge icon="counter" color={Colors.primary} title="Cool Thirty" desc="Score 30+ runs" earned={(overallBat.thirties || 0) > 0} timesEarned={overallBat.thirties || 0} />
              <AchievementBadge icon="counter" color={Colors.primary} title="Thirty Machine" desc="Score 10 30+ scores" earned={(overallBat.thirties || 0) >= 10} />
              
              <AchievementBadge icon="counter" color={Colors.primary} title="First Fifty" desc="Score 50+ runs" earned={(overallBat.fifties || 0) > 0} timesEarned={overallBat.fifties || 0} />
              <AchievementBadge icon="counter" color={Colors.primary} title="Half-Century Machine" desc="Score 10 50+ scores" earned={(overallBat.fifties || 0) >= 10} />
              
              <AchievementBadge icon="trophy" color={Colors.primary} title="Centurion" desc="100+ runs in an innings" earned={(overallBat.hundreds || 0) > 0} timesEarned={overallBat.hundreds || 0} />
              <AchievementBadge icon="trophy" color={Colors.primary} title="Legendary Centurion" desc="Score 10 centuries" earned={(overallBat.hundreds || 0) >= 10} />
              
              <AchievementBadge icon="flash" color={Colors.primary} title="Boundary Hitter" desc="Hit 50+ fours" earned={(overallBat.fours || 0) >= 50} timesEarned={Math.floor((overallBat.fours || 0)/50)} />
              <AchievementBadge icon="flash" color={Colors.primary} title="Boundary Machine" desc="Hit 100+ fours" earned={(overallBat.fours || 0) >= 100} />
              
              <AchievementBadge icon="fire" color={Colors.primary} title="Six Hitter" desc="Hit 50+ sixes" earned={(overallBat.sixes || 0) >= 50} />
              <AchievementBadge icon="fire" color={Colors.primary} title="Six Machine" desc="Hit 100+ sixes" earned={(overallBat.sixes || 0) >= 100} />
              
              <AchievementBadge icon="shield" color={Colors.primary} title="The Wall" desc="Stay Not Out 10+ times" earned={(overallBat.notOuts || 0) >= 10} timesEarned={overallBat.notOuts || 0} />
              <AchievementBadge icon="lightning-bolt" color={Colors.primary} title="Powerhouse" desc="Strike Rate 150+" earned={parseFloat(batSR) >= 150} />
            </View>
          </View>

          <View style={styles.statsCard}>
            <SectionHeading icon="medal-outline" title="Bowling Milestones" color={Colors.primary} />
            <View style={styles.achieveGrid}>
              <AchievementBadge icon="numeric-1-circle" color={Colors.primary} title="First Wicket" desc="Take your first wicket" earned={totalWickets >= 1} />
              <AchievementBadge icon="star" color={Colors.primary} title="First 10 Wickets" desc="Take 10+ wickets" earned={totalWickets >= 10} />
              <AchievementBadge icon="star-circle" color={Colors.primary} title="Wicket Taker" desc="Take 50+ wickets" earned={totalWickets >= 50} />
              <AchievementBadge icon="star-circle" color={Colors.primary} title="Wicket Machine" desc="Take 100+ wickets" earned={totalWickets >= 100} />
              <AchievementBadge icon="target" color={Colors.primary} title="5-Wicket Haul" desc="Take a 5-for in an innings" earned={(overallBowl.fiveWickets || 0) > 0} timesEarned={overallBowl.fiveWickets || 0} />
              <AchievementBadge icon="bowling" color={Colors.primary} title="Hat-Trick" desc="3 wickets in 3 balls" earned={false} />
              <AchievementBadge icon="chart-line" color={Colors.primary} title="Economy King" desc="Economy below 6.0" earned={parseFloat(bowlEcon) > 0 && parseFloat(bowlEcon) < 6} />

            </View>
          </View>

          <View style={styles.statsCard}>
            <SectionHeading icon="shield-star" title="General Milestones" color={Colors.primary} />
            <View style={styles.achieveGrid}>
              <AchievementBadge icon="cricket" color={Colors.primary} title="Debut" desc="Play your first match" earned={careerMatches >= 1} />
              <AchievementBadge icon="account-group" color={Colors.primary} title="Veteran" desc="Play 10+ matches" earned={careerMatches >= 10} />
              <AchievementBadge icon="crown" color={Colors.primary} title="Legend" desc="Play 50+ matches" earned={careerMatches >= 50} />
              <AchievementBadge icon="hand-back-right" color={Colors.primary} title="Safe Hands" desc="Take 5+ catches" earned={(field.catches || 0) >= 5} />
              <AchievementBadge icon="hand" color={Colors.primary} title="Magic Hands" desc="Take 10+ catches" earned={(field.catches || 0) >= 10} />
              <AchievementBadge icon="bullseye" color={Colors.primary} title="Sniper" desc="Execute 5+ Run Outs" earned={(field.runOuts || 0) >= 5} />
              <AchievementBadge icon="medal" color={Colors.primary} title="Centurion" desc="Play 100+ matches" earned={careerMatches >= 100} />

            </View>
          </View>
        </View>
      );
    }

    // ── AWARDS ───────────────────────────────────────────────────────────────
    if (activeStatTab === 'Awards') {
      const potm = myProfile?.career?.playerOfMatchAwards || 0;
      const fotm = myProfile?.career?.fighterOfMatchAwards || 0;
      const topBatter = myProfile?.career?.topBatterAwards || 0;
      const topBowler = myProfile?.career?.topBowlerAwards || 0;
      return (
        <View>
          <View style={styles.statsCard}>
            <SectionHeading icon="trophy" title="Match Awards" color={Colors.primary} />
            <View style={styles.awardsGrid}>
              <AwardCard icon="star" color={Colors.primary} title="Player of Match" count={potm} matches={careerMatches} />
              <AwardCard icon="lightning-bolt" color={Colors.primary} title="Fighter of Match" count={fotm} matches={careerMatches} />
              <AwardCard icon="cricket" color={Colors.primary} title="Top Batter" count={topBatter} matches={careerMatches} />
              <AwardCard icon="bowling" color={Colors.primary} title="Top Bowler" count={myProfile?.career?.topBowlerAwards || 0} matches={careerMatches} />
              <AwardCard icon="shield-check" color={Colors.primary} title="Best Fielder" count={myProfile?.career?.bestFielderAwards || 0} matches={careerMatches} />
              <AwardCard icon="crown" color={Colors.warning} title="MVP" count={myProfile?.career?.mvpAwards || 0} matches={careerMatches} />
            </View>
          </View>

          <View style={styles.statsCard}>
            <SectionHeading icon="podium" title="Career Bests" color={Colors.primary} />
            <View style={styles.bestPerfRow}>
              <View style={styles.bestPerfItem}>
                <Text style={styles.bestPerfLabel}>Best Batting</Text>
                <Text style={[styles.bestPerfValue, { color: Colors.primary }]}>
                  {overallBat.highestScore ? `${overallBat.highestScore}${overallBat.highestScoreNotOut ? '*' : ''}` : '—'}
                </Text>
              </View>
              <View style={styles.bestPerfDivider} />
              <View style={styles.bestPerfItem}>
                <Text style={styles.bestPerfLabel}>Best Bowling</Text>
                <Text style={[styles.bestPerfValue, { color: Colors.info }]}>{bestFig}</Text>
              </View>
              <View style={styles.bestPerfDivider} />
              <View style={styles.bestPerfItem}>
                <Text style={styles.bestPerfLabel}>Bat Strike Rate</Text>
                <Text style={[styles.bestPerfValue, { color: Colors.warning }]}>{batSR}</Text>
              </View>
            </View>
          </View>
        </View>
      );
    }
  };

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Cricket Profile</Text>
        <TouchableOpacity onPress={() => setIsEditModalVisible(true)} style={styles.editBtn}>
          <Text style={styles.editBtnText}>Edit</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAwareScrollView enableOnAndroid={true} extraScrollHeight={20} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Profile Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{form.name}</Text>
          <Text style={styles.cardSubtitle}>{form.playingRole} • {form.location || 'No Location'}</Text>

          <View style={styles.socialCountsRow}>
            <TouchableOpacity style={styles.socialCountItem} onPress={() => loadSocialList('followers')}>
              <Text style={styles.socialCountVal}>{myProfile?.followers?.length || 0}</Text>
              <Text style={styles.socialCountLbl}>Followers</Text>
            </TouchableOpacity>
            <View style={styles.socialDivider} />
            <TouchableOpacity style={styles.socialCountItem} onPress={() => loadSocialList('following')}>
              <Text style={styles.socialCountVal}>{myProfile?.following?.length || 0}</Text>
              <Text style={styles.socialCountLbl}>Following</Text>
            </TouchableOpacity>
            <View style={styles.socialDivider} />
            <View style={styles.socialCountItem}>
              <Text style={styles.socialCountVal}>{myProfile?.profileViews || 0}</Text>
              <Text style={styles.socialCountLbl}>Views</Text>
            </View>
          </View>

          <View style={styles.divider} />
          {[
            { icon: 'call-outline', label: 'Mobile', val: form.mobile },
            { icon: 'mail-outline', label: 'Email', val: form.email },
            { icon: 'calendar-outline', label: 'Date of Birth', val: form.dob ? form.dob.split('-').reverse().join('-') : '' },
            { icon: 'person-outline', label: 'Gender', val: form.gender },
          ].map(r => (
            <View key={r.label} style={styles.infoRow}>
              <View style={styles.infoRowLeft}>
                <Icon name={r.icon} size={18} color={Colors.primary} style={styles.infoIcon} />
                <Text style={styles.infoLabel}>{r.label}</Text>
              </View>
              <Text style={styles.infoValue}>{r.val || '-'}</Text>
            </View>
          ))}
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <View style={styles.infoRowLeft}>
              <MCIcon name="cricket" size={18} color={Colors.primary} style={styles.infoIcon} />
              <Text style={styles.infoLabel}>Batting</Text>
            </View>
            <Text style={styles.infoValue}>{form.battingStyle} ({form.battingOrder})</Text>
          </View>
          <View style={styles.infoRow}>
            <View style={styles.infoRowLeft}>
              <MCIcon name="bowling" size={18} color={Colors.primary} style={styles.infoIcon} />
              <Text style={styles.infoLabel}>Bowling</Text>
            </View>
            <Text style={styles.infoValue}>{form.bowlingStyle}</Text>
          </View>
        </View>

        {/* My Teams */}
        <TouchableOpacity
          style={[styles.card, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 15, marginBottom: 20 }]}
          onPress={() => navigation.navigate('TeamList')}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Icon name="people-outline" size={22} color={Colors.primary} style={{ marginRight: 10 }} />
            <Text style={{ fontSize: 15, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary }}>My Teams</Text>
          </View>
          <Icon name="chevron-forward" size={20} color={Colors.textSecondary} />
        </TouchableOpacity>

        {/* Stats & Achievements Section */}
        <View style={styles.statsSection}>
          <View style={styles.statsSectionHeader}>
            <View style={styles.statsSectionAccent} />
            <Text style={styles.statsSectionTitle}>Stats & Achievements</Text>
          </View>

          {/* Quick summary */}
          <View style={styles.quickSummaryRow}>
            {[
              { val: careerMatches, label: 'Matches', color: Colors.primary },
              { val: overallBat.runs ?? 0, label: 'Runs', color: Colors.primary },
              { val: overallBowl.wickets ?? 0, label: 'Wickets', color: Colors.primary },
              { val: (myProfile?.playingRole === 'Bowler' && bowl.bestWickets > 0) ? bestFig : ((overallBat.highestScore > 0) ? `${overallBat.highestScore}${overallBat.highestScoreNotOut ? '*' : ''}` : bestFig), label: (myProfile?.playingRole === 'Bowler' && bowl.bestWickets > 0) ? 'Best Bowl' : ((overallBat.highestScore > 0) ? 'High Score' : 'Best Bowl'), color: Colors.primary },
            ].map((s, i, arr) => (
              <View key={s.label} style={[styles.quickSummaryItem, i < arr.length - 1 && { borderRightWidth: 1, borderRightColor: Colors.border }]}>
                <Text style={[styles.quickSummaryVal, { color: s.color }]}>{s.val}</Text>
                <Text style={styles.quickSummaryLbl}>{s.label}</Text>
              </View>
            ))}
          </View>

          {/* Tab bar */}
          <KeyboardAwareScrollView enableOnAndroid={true} extraScrollHeight={20} keyboardShouldPersistTaps="handled" horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statTabsRow}>
            {STAT_TABS.map(tab => (
              <TouchableOpacity key={tab} style={styles.statTab} onPress={() => setActiveStatTab(tab)}>
                <Text style={[styles.statTabText, activeStatTab === tab && styles.statTabTextActive]}>{tab}</Text>
                {activeStatTab === tab && <View style={styles.statTabUnderline} />}
              </TouchableOpacity>
            ))}
          </KeyboardAwareScrollView>

          {renderStatContent()}
        </View>

      </KeyboardAwareScrollView>

      {/* Edit Modal */}
      <Modal visible={isEditModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setIsEditModalVisible(false)}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setIsEditModalVisible(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Edit Profile</Text>
            <TouchableOpacity onPress={handleSave} disabled={isSaving || isLoading}>
              {isSaving ? <ActivityIndicator color={Colors.primary} size="small" /> : <Text style={styles.modalSaveText}>Save</Text>}
            </TouchableOpacity>
          </View>
          <KeyboardAwareScrollView enableOnAndroid={true} extraScrollHeight={20} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Name</Text>
              <TextInput style={styles.input} value={form.name} onChangeText={t => setForm({ ...form, name: t })} />
            </View>
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Mobile</Text>
              <TextInput style={styles.input} value={form.mobile} keyboardType="phone-pad" onChangeText={t => setForm({ ...form, mobile: t })} />
            </View>
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Email</Text>
              <TextInput style={styles.input} value={form.email} keyboardType="email-address" autoCapitalize="none" onChangeText={t => setForm({ ...form, email: t })} />
            </View>
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Date of Birth</Text>
              <TouchableOpacity style={styles.dropdownBtn} onPress={() => setShowDatePicker(true)}>
                <Text style={[styles.dropdownBtnText, !form.dob && { color: Colors.textSecondary }]}>
                  {form.dob ? form.dob.split('-').reverse().join('-') : 'Select Date of Birth'}
                </Text>
                <Icon name="calendar-outline" size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
              {showDatePicker && (
                <DateTimePicker
                  value={form.dob ? new Date(form.dob) : new Date()}
                  mode="date" display="spinner" maximumDate={new Date()}
                  textColor={Colors.textPrimary} accentColor={Colors.primary}
                  onChange={onDateChange}
                />
              )}
            </View>
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Location</Text>
              <LocationAutocomplete
                value={form.location}
                onChangeText={t => setForm({ ...form, location: t })}
                onSelectLocation={(loc) => {
                  setForm({
                    ...form,
                    location: loc ? loc.name : '',
                    locationObj: loc ? { name: loc.name, latitude: loc.latitude, longitude: loc.longitude } : null
                  });
                }}
                placeholder="City or Area"
                variant="none"
                style={{ backgroundColor: Colors.surfaceVariant, borderRadius: 8, paddingHorizontal: 12, minHeight: 48, paddingVertical: 12 }}
              />
            </View>
            <Dropdown label="Gender" value={form.gender} options={GENDERS} onSelect={val => setForm({ ...form, gender: val })} />
            <Dropdown label="Role" value={form.playingRole} options={ROLES} onSelect={val => setForm({ ...form, playingRole: val })} />
            <Dropdown label="Batting Order" value={form.battingOrder} options={BATTING_ORDERS} onSelect={val => setForm({ ...form, battingOrder: val })} />
            <Dropdown label="Batting Style" value={form.battingStyle} options={BATTING_STYLES} onSelect={val => setForm({ ...form, battingStyle: val })} />
            <Dropdown label="Bowling Style" value={form.bowlingStyle} options={BOWLING_STYLES} onSelect={val => setForm({ ...form, bowlingStyle: val })} />
          </KeyboardAwareScrollView>
        </SafeAreaView>
      </Modal>

      {/* Social Modal */}
      <Modal visible={socialModalVisible} animationType="slide" transparent onRequestClose={() => setSocialModalVisible(false)}>
        <View style={styles.socialModalOverlay}>
          <View style={styles.socialModalSheet}>
            <View style={styles.socialModalHandle} />
            <View style={styles.socialModalHeader}>
              <Text style={styles.socialModalTitle}>
                {socialType === 'followers' ? 'Followers' : 'Following'} ({socialList.length})
              </Text>
              <TouchableOpacity onPress={() => setSocialModalVisible(false)}>
                <Icon name="close" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            {socialLoading ? (
              <ActivityIndicator size="large" color={Colors.primary} style={{ marginVertical: 40 }} />
            ) : socialList.length === 0 ? (
              <View style={styles.socialEmptyList}>
                <Icon name="people-outline" size={48} color={Colors.textTertiary} />
                <Text style={styles.socialEmptyText}>No users found</Text>
              </View>
            ) : (
              <FlatList
                data={socialList}
                keyExtractor={item => item._id}
                renderItem={({ item }) => {
                  const photo = item.photo || item.userId?.photo;
                  const hasError = imgErrors[item._id];
                  return (
                    <View style={styles.socialItem}>
                      <TouchableOpacity style={styles.socialItemLeft} onPress={() => { setSocialModalVisible(false); navigation.navigate('PlayerDetail', { id: item._id }); }}>
                        {photo && !hasError ? (
                          <Image 
                            source={{ uri: getImageUrl(photo) }} 
                            style={styles.socialAvatar} 
                            onError={() => setImgErrors(prev => ({ ...prev, [item._id]: true }))} 
                          />
                        ) : (
                          <View style={[styles.socialAvatar, styles.socialAvatarPlaceholder]}>
                            <Icon name="person" size={18} color={Colors.primary} />
                          </View>
                        )}
                        <View style={{ flex: 1 }}>
                          <Text style={styles.socialName}>{item.name}</Text>
                          <Text style={styles.socialRole}>{item.playingRole || 'Cricket Player'}</Text>
                        </View>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.socialActionBtn} onPress={() => socialType === 'followers' ? handleRemoveFollower(item._id) : handleUnfollowFromList(item._id)}>
                        <Text style={styles.socialActionBtnText}>{socialType === 'followers' ? 'Remove' : 'Unfollow'}</Text>
                      </TouchableOpacity>
                    </View>
                  );
                }}
                contentContainerStyle={{ paddingBottom: 40 }}
              />
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn: { padding: 5, marginLeft: -5 },
  headerTitle: { fontSize: 18, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary },
  editBtn: { padding: 5, marginRight: -5 },
  editBtnText: { color: Colors.primary, fontSize: 16, fontFamily: Typography.fontFamily.bold },
  content: { padding: 16, paddingBottom: 50 },

  // Card
  card: { backgroundColor: Colors.surface, borderRadius: 14, padding: 18, borderWidth: 1, borderColor: Colors.border, marginBottom: 14 },
  cardTitle: { fontSize: 22, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary, marginBottom: 4 },
  cardSubtitle: { fontSize: 13, fontFamily: Typography.fontFamily.medium, color: Colors.textSecondary, marginBottom: 14 },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 12 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 5 },
  infoRowLeft: { flexDirection: 'row', alignItems: 'center' },
  infoIcon: { marginRight: 10 },
  infoLabel: { fontSize: 13, fontFamily: Typography.fontFamily.medium, color: Colors.textSecondary },
  infoValue: { fontSize: 13, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary },

  // Social counts
  socialCountsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, marginBottom: 10, borderTopWidth: 1, borderBottomWidth: 1, borderColor: Colors.border, paddingVertical: 12 },
  socialCountItem: { flex: 1, alignItems: 'center' },
  socialCountVal: { fontSize: 16, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary },
  socialCountLbl: { fontSize: 11, fontFamily: Typography.fontFamily.medium, color: Colors.textSecondary, marginTop: 2 },
  socialDivider: { width: 1, height: 20, backgroundColor: Colors.border },

  // Stats section
  statsSection: { marginBottom: 30 },
  statsSectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  statsSectionAccent: { width: 3, height: 20, borderRadius: 2, backgroundColor: Colors.primary, marginRight: 8 },
  statsSectionTitle: { fontSize: 17, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary },

  // Quick summary
  quickSummaryRow: { flexDirection: 'row', backgroundColor: Colors.backgroundCard, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, marginBottom: 14, overflow: 'hidden' },
  quickSummaryItem: { flex: 1, alignItems: 'center', paddingVertical: 14 },
  quickSummaryVal: { fontSize: 18, fontFamily: Typography.fontFamily.bold },
  quickSummaryLbl: { fontSize: 10, fontFamily: Typography.fontFamily.medium, color: Colors.textSecondary, marginTop: 3 },

  // Tab bar
  statTabsRow: { paddingBottom: 4, marginBottom: 10 },
  statTab: { paddingHorizontal: 14, paddingVertical: 10, marginRight: 4, alignItems: 'center', position: 'relative' },
  statTabText: { fontSize: 13, fontFamily: Typography.fontFamily.semiBold, color: Colors.textSecondary },
  statTabTextActive: { color: Colors.primary, fontFamily: Typography.fontFamily.bold },
  statTabUnderline: { position: 'absolute', bottom: 0, left: 8, right: 8, height: 2, backgroundColor: Colors.primary, borderRadius: 1 },

  // Ball filter
  ballFilterRow: { flexDirection: 'row', paddingBottom: 12, gap: 8 },
  ballChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: Colors.backgroundCard, borderWidth: 1, borderColor: Colors.border },
  ballChipActive: { backgroundColor: Colors.primaryAlpha20, borderColor: Colors.primary },
  ballChipText: { fontSize: 12, fontFamily: Typography.fontFamily.semiBold, color: Colors.textSecondary },
  ballChipTextActive: { color: Colors.primary },

  // Stats cards
  statsCard: { backgroundColor: Colors.backgroundCard, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: Colors.border, marginBottom: 12 },

  // Section heading
  sectionHeading: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  sectionHeadingBar: { width: 3, height: 14, borderRadius: 2, marginRight: 7 },
  sectionHeadingText: { fontSize: 13, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary },

  // Stat grid
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  statTile: {
    width: (SCREEN_WIDTH - 32 - 28 - 42) / 5,
    minWidth: 52,
    paddingVertical: 9,
    paddingHorizontal: 2,
    backgroundColor: Colors.backgroundElevated,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
  },
  statTileValue: { fontSize: 14, fontFamily: Typography.fontFamily.bold },
  statTileLabel: { fontSize: 9, fontFamily: Typography.fontFamily.medium, color: Colors.textSecondary, marginTop: 3, textAlign: 'center' },

  // Fielding
  fieldingRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 6 },
  fieldingBox: { flex: 1, alignItems: 'center', paddingVertical: 12, backgroundColor: Colors.backgroundElevated, borderRadius: 12, borderWidth: 1, borderColor: Colors.border },
  fieldingVal: { fontSize: 20, fontFamily: Typography.fontFamily.bold, marginTop: 5 },
  fieldingLbl: { fontSize: 9, fontFamily: Typography.fontFamily.medium, color: Colors.textSecondary, marginTop: 2 },

  // Analytics
  analyticsPlaceholder: { alignItems: 'center', paddingVertical: 28, gap: 6 },
  analyticsPlaceholderText: { fontSize: 13, fontFamily: Typography.fontFamily.bold, color: Colors.textSecondary },
  analyticsPlaceholderSub: { fontSize: 10, color: Colors.textTertiary },

  // Wagon Wheel
  wwOuter: { alignItems: 'center', paddingVertical: 10, position: 'relative' },
  wwCircleWrap: { overflow: 'hidden', backgroundColor: '#0B231E', borderWidth: 2, borderColor: `${Colors.primary}40`, position: 'relative' },
  wwGroundImage: { width: '100%', height: '100%', position: 'absolute' },
  wwOverlay: { position: 'absolute', width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.3)' }, // dim the ground a bit
  wwZoneLabel: { position: 'absolute', fontSize: 9, color: 'rgba(255,255,255,0.7)', fontFamily: Typography.fontFamily.semiBold },
  wwCenter: { position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFF', zIndex: 10 },
  wwLoadingWrap: { alignItems: 'center', justifyContent: 'center', zIndex: 5, backgroundColor: 'rgba(0,0,0,0.5)', padding: 15, borderRadius: 12 },
  wwLoadingText: { fontSize: 12, fontFamily: Typography.fontFamily.medium, color: Colors.textSecondary, marginTop: 8 },
  wwShotLine: { position: 'absolute', height: 2, borderRadius: 1 },
  wwLegendRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12, marginTop: 16 },
  wwLegendItem: { flexDirection: 'row', alignItems: 'center' },
  wwLegendDot: { width: 8, height: 8, borderRadius: 4, marginRight: 5 },
  wwLegendText: { fontSize: 11, fontFamily: Typography.fontFamily.medium, color: Colors.textSecondary },
  wwTotalText: { fontSize: 10, color: Colors.textTertiary, marginTop: 10, fontFamily: Typography.fontFamily.regular },
  wwToggleRow: { flexDirection: 'row', backgroundColor: Colors.background, borderRadius: 6, padding: 2 },
  wwToggleBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4 },
  wwToggleBtnActive: { backgroundColor: Colors.primary },
  wwToggleText: { fontSize: 10, fontFamily: Typography.fontFamily.medium, color: Colors.textSecondary },
  wwToggleTextActive: { color: Colors.surface, fontFamily: Typography.fontFamily.bold },

  // Achievements
  achieveGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  achieveBadge: {
    width: '48%', marginBottom: 12,
    backgroundColor: Colors.backgroundElevated,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    position: 'relative',
  },
  achieveIconWrap: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  achieveTitle: { fontSize: 11, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary, textAlign: 'center', marginBottom: 3 },
  achieveDesc: { fontSize: 10, fontFamily: Typography.fontFamily.regular, color: Colors.textSecondary, textAlign: 'center', lineHeight: 13 },
  achieveLock: { position: 'absolute', top: 8, right: 8 },

  // Awards
  awardsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  awardCard: { width: '48%', marginBottom: 12, borderRadius: 14, overflow: 'hidden', borderWidth: 1 },
  awardGradient: { padding: 16, alignItems: 'center' },
  awardIconCircle: { width: 42, height: 1.52, borderRadius: 21, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  awardCount: { fontSize: 28, fontFamily: Typography.fontFamily.bold, lineHeight: 32 },
  awardTitle: { fontSize: 11, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary, textAlign: 'center', marginTop: 4 },
  awardSub: { fontSize: 10, color: Colors.textSecondary, marginTop: 2 },

  // Career bests
  bestPerfRow: { flexDirection: 'row', alignItems: 'center' },
  bestPerfItem: { flex: 1, alignItems: 'center', paddingVertical: 10 },
  bestPerfDivider: { width: 1, height: 36, backgroundColor: Colors.border },
  bestPerfLabel: { fontSize: 10, fontFamily: Typography.fontFamily.medium, color: Colors.textSecondary, marginBottom: 4 },
  bestPerfValue: { fontSize: 18, fontFamily: Typography.fontFamily.bold },

  // Edit modal
  modalContainer: { flex: 1, backgroundColor: Colors.background, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalCancelText: { color: Colors.textSecondary, fontSize: 16, fontFamily: Typography.fontFamily.medium },
  modalTitle: { fontSize: 18, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary },
  modalSaveText: { color: Colors.primary, fontSize: 16, fontFamily: Typography.fontFamily.bold },
  fieldContainer: { marginBottom: 15 },
  label: { color: Colors.textSecondary, fontSize: 14, marginBottom: 5, fontFamily: Typography.fontFamily.medium },
  input: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, padding: 12, color: Colors.textPrimary, fontFamily: Typography.fontFamily.regular },
  dropdownBtn: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dropdownBtnText: { color: Colors.textPrimary, fontFamily: Typography.fontFamily.regular, fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '80%', backgroundColor: Colors.surface, borderRadius: 10, padding: 10, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84 },
  modalItem: { paddingVertical: 15, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalItemText: { color: Colors.textPrimary, fontSize: 16, fontFamily: Typography.fontFamily.regular },
  modalItemTextActive: { color: Colors.primary, fontFamily: Typography.fontFamily.bold },

  // Social modal
  socialModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  socialModalSheet: { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 32, maxHeight: '85%', borderTopWidth: 1, borderColor: Colors.border },
  socialModalHandle: { width: 40, height: 1.5, backgroundColor: Colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  socialModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  socialModalTitle: { fontSize: 18, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary },
  socialEmptyList: { alignItems: 'center', paddingVertical: 40 },
  socialEmptyText: { marginTop: 10, fontSize: 14, color: Colors.textTertiary },
  socialItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  socialItemLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
  socialAvatar: { width: 40, height: 1.50, borderRadius: 20 },
  socialAvatarPlaceholder: { backgroundColor: Colors.primaryAlpha10, justifyContent: 'center', alignItems: 'center' },
  socialName: { fontSize: 15, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary },
  socialRole: { fontSize: 12, fontFamily: Typography.fontFamily.regular, color: Colors.textSecondary, marginTop: 1 },
  socialActionBtn: { borderRadius: 8, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, paddingVertical: 6 },
  socialActionBtnText: { fontSize: 12, fontFamily: Typography.fontFamily.semiBold, color: Colors.error },

  // Matches Tab cards and badges
  tabCenteredEmpty: { alignItems: 'center', paddingVertical: 64 },
  emptyText: { marginTop: 14, fontSize: 14, color: Colors.textTertiary, fontFamily: Typography.fontFamily.medium },
  matchCard: { marginHorizontal: 2, marginBottom: 10, padding: 14, backgroundColor: Colors.backgroundCard, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, flexDirection: 'row', alignItems: 'center' },
  matchCardLive: { borderColor: Colors.primaryAlpha40 },
  matchCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)', paddingBottom: 8, marginBottom: 10 },
  matchTeamsText: { fontSize: 13, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary },
  matchCardBody: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  matchCardFooter: { flexDirection: 'row', alignItems: 'center', gap: 6, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', paddingTop: 8 },
  matchStatusText: { fontSize: 11, fontFamily: Typography.fontFamily.medium, color: Colors.textSecondary, flex: 1 },
  matchRunsValue: { fontSize: 22, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary },
  matchRunsLabel: { fontSize: 11, fontFamily: Typography.fontFamily.regular, color: Colors.textSecondary, marginTop: 2 },
  matchDNB: { fontSize: 14, fontFamily: Typography.fontFamily.medium, color: Colors.textTertiary, fontStyle: 'italic' },
  liveBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 71, 87, 0.15)', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: 'rgba(255, 71, 87, 0.3)' },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FF4757', marginRight: 5 },
  liveText: { color: '#FF4757', fontSize: 9, fontFamily: Typography.fontFamily.bold, letterSpacing: 0.5 },
  matchDate: { fontSize: 11, fontFamily: Typography.fontFamily.regular, color: Colors.textTertiary },
  matchBallTypeBadge: { backgroundColor: Colors.primaryAlpha10, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: Colors.primaryAlpha20 },
  matchBallTypeBadgeText: { fontSize: 10, fontFamily: Typography.fontFamily.bold, color: Colors.primary },

});

export default PlayerProfileScreen;
