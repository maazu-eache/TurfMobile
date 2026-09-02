import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  Image, ScrollView, ActivityIndicator, Animated,
  Dimensions, Modal, TextInput, ToastAndroid, Platform, RefreshControl,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from '../../../components/SolidGradient';
import { launchImageLibrary } from 'react-native-image-picker';
import { useDispatch, useSelector } from 'react-redux';
import { showCustomAlert } from '../../../components/CustomAlert';
import {
  fetchTeamById, fetchTeamStats, toggleFollowTeam, fetchFollowingTeams,
  addPlayerToTeam, updatePlayerRole, deleteTeam,
  updateTeam, leaveTeam, removePlayerFromTeam, clearSelectedTeam,
} from '../teamSlice';
import { Colors, Typography, Spacing, Shadows, BorderRadius } from '../../../theme/theme';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { getImageUrl } from '../../../api/axios';
import api from '../../../api/axios';
import LocationAutocomplete from '../../../components/LocationAutocomplete';
import { LineChart, BarChart, PieChart, ProgressChart } from 'react-native-chart-kit';


const { width: SCREEN_W } = Dimensions.get('window');

const DETAIL_TABS = [
  { id: 'players', label: 'Players', icon: 'account-multiple' },
  { id: 'matches', label: 'Matches', icon: 'cricket' },
  { id: 'stats', label: 'Stats', icon: 'chart-bar' },
  { id: 'leaderboard', label: 'Leaderboard', icon: 'podium' },
  { id: 'trophies', label: 'Trophies', icon: 'trophy' },
  { id: 'achievements', label: 'Achievements', icon: 'star-circle' },
  { id: 'analytics', label: 'Analytics', icon: 'trending-up' },
];

const ROLE_OPTIONS = ['player', 'captain', 'vice_captain', 'wicket_keeper', 'admin'];
const ROLE_LABELS = { player: 'Player', captain: 'Captain', vice_captain: 'Vice Captain', wicket_keeper: 'Wicket Keeper', admin: 'Admin' };
const ROLE_ICONS = { player: 'account', captain: 'crown', vice_captain: 'star-half-full', wicket_keeper: 'handball', admin: 'shield-crown' };

const ACHIEVEMENTS = [
  { id: 'first_win', icon: 'trophy', label: 'First Win', desc: 'Win your first match', target: 1, key: 'wins' },
  { id: 'ten_wins', icon: 'trophy-variant', label: '10 Wins', desc: 'Win 10 matches', target: 10, key: 'wins' },
  { id: 'fifty_wins', icon: 'trophy-award', label: 'Half Century', desc: 'Win 50 matches', target: 50, key: 'wins' },
  { id: 'century_wins', icon: 'trophy-outline', label: 'Century of Wins', desc: 'Win 100 matches', target: 100, key: 'wins' },
  { id: 'first_match', icon: 'cricket', label: 'The Beginning', desc: 'Play your first match', target: 1, key: 'matches' },
  { id: 'ten_matches', icon: 'cricket', label: 'Veterans', desc: 'Play 10 matches', target: 10, key: 'matches' },
  { id: 'fifty_match', icon: 'medal', label: 'Match Masters', desc: 'Play 50 matches', target: 50, key: 'matches' },
  { id: 'century_match', icon: 'medal-outline', label: 'Centurions', desc: 'Play 100 matches', target: 100, key: 'matches' },
  { id: 'tour_played', icon: 'tournament', label: 'Tournament Ready', desc: 'Play in a tournament', target: 1, key: 'tournamentsPlayed' },
  { id: 'five_tours', icon: 'tournament', label: 'Tour Regulars', desc: 'Play 5 tournaments', target: 5, key: 'tournamentsPlayed' },
  { id: 'tour_won', icon: 'crown', label: 'Champions', desc: 'Win a tournament', target: 1, key: 'tournamentsWon' },
  { id: 'five_tour_wins', icon: 'crown-outline', label: 'Dynasty', desc: 'Win 5 tournaments', target: 5, key: 'tournamentsWon' },
  { id: 'fifty_wickets', icon: 'baseball', label: 'Wicket Takers', desc: 'Take 50 wickets', target: 50, key: 'totalWickets' },
  { id: 'five_hundred_runs', icon: 'fire', label: 'Run Machine', desc: 'Score 500 runs', target: 500, key: 'totalRuns' },
];

const TeamDetailScreen = ({ navigation, route }) => {
  const { id } = route.params || {};
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();
  const { selectedTeam, teamStats, isLoading, statsLoading } = useSelector(s => s.team);
  const { user } = useSelector(s => s.auth);

  const [activeTab, setActiveTab] = useState('matches');
  const tabScrollRef = useRef(null);
  const indicatorAnim = useRef(new Animated.Value(0)).current;

  // Add player modal
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [mobile, setMobile] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [addRole, setAddRole] = useState('player');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookedUpPlayer, setLookedUpPlayer] = useState(null);
  const [lookupDone, setLookupDone] = useState(false);
  const [adding, setAdding] = useState(false);

  // Role modal
  const [roleModalVisible, setRoleModalVisible] = useState(false);
  const [selectedPlayerToEdit, setSelectedPlayerToEdit] = useState(null);
  const [updatingRole, setUpdatingRole] = useState(false);

  // Edit team modal
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editState, setEditState] = useState('');
  const [editLogo, setEditLogo] = useState(null);
  const [updatingTeam, setUpdatingTeam] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [activeLeaderboardTab, setActiveLeaderboardTab] = useState('batters');
  const [trendMetric, setTrendMetric] = useState('win_rate');
  const [contribType, setContribType] = useState('batting');

  // UGC Report States
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('inappropriate_name');
  const [reportDetails, setReportDetails] = useState('');
  const [reportLoading, setReportLoading] = useState(false);

  const handleReportTeam = async () => {
    if (!reportReason) {
      showCustomAlert("Error", "Please select a reason for reporting");
      return;
    }
    setReportLoading(true);
    try {
      await api.post('/ugc/report', {
        contentType: 'team',
        contentId: selectedTeam._id,
        reason: reportReason,
        details: reportDetails
      });
      setReportLoading(false);
      setShowReportModal(false);
      setReportDetails('');
      showCustomAlert("Report Submitted", "Thank you for reporting. Our team will review this team profile within 24 hours.");
    } catch (err) {
      setReportLoading(false);
      showCustomAlert("Error", err.response?.data?.message || "Failed to submit report");
    }
  };

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        dispatch(fetchTeamById(id)).unwrap(),
        dispatch(fetchTeamStats(id)).unwrap()
      ]);
    } catch (e) { }
    setRefreshing(false);
  };

  useEffect(() => {
    if (id) {
      dispatch(clearSelectedTeam());
      dispatch(fetchTeamById(id));
      dispatch(fetchTeamStats(id));
    }
    return () => { dispatch(clearSelectedTeam()); };
  }, [id, dispatch]);

  // Refetch stats when switching to stats/leaderboard/analytics tab
  useEffect(() => {
    if (['stats', 'leaderboard', 'analytics', 'matches'].includes(activeTab) && id) {
      dispatch(fetchTeamStats(id));
    }
  }, [activeTab, id, dispatch]);

  // Derived — use userId from auth for reliable identity matching
  const myPlayer = useSelector(s => s.player?.myProfile);
  const myPlayerId = myPlayer?._id?.toString();
  const myUserId = user?._id?.toString();

  // Identify current user's player entry: match via userId OR player _id
  const myMembership = selectedTeam?.players?.find(p => {
    const playerUserId = p.player?.userId?._id?.toString() || p.player?.userId?.toString();
    const playerDocId = p.player?._id?.toString();
    return playerUserId === myUserId || (myPlayerId && playerDocId === myPlayerId);
  });

  const isMeMember = !!myMembership;
  const isMeCaptain = myMembership?.role === 'captain';
  const isMeAdmin = myMembership?.role === 'admin';
  const isCreator = selectedTeam?.createdBy?.toString() === myUserId || selectedTeam?.createdBy === user?._id;
  const isMeVC = myMembership?.role === 'vice_captain';
  // isManager: can edit team details
  const isManager = isMeCaptain || isMeAdmin || isMeVC;
  // canManageRoster: can change roles / remove players
  const canManageRoster = isMeCaptain || isMeAdmin || isMeVC;

  // ── Tab switch animation ──────────────────────────────────────────────────
  const switchTab = (tabId) => {
    const idx = DETAIL_TABS.findIndex(t => t.id === tabId);
    setActiveTab(tabId);
  };

  // ── Follow ────────────────────────────────────────────────────────────────
  const handleFollow = async () => {
    try {
      const res = await dispatch(toggleFollowTeam(id)).unwrap();
      dispatch(fetchFollowingTeams());
      const msg = res.isFollowing ? `You are now following ${selectedTeam?.name || 'this team'}` : `Unfollowed ${selectedTeam?.name || 'team'}`;
      if (Platform.OS === 'android') {
        ToastAndroid.show(msg, ToastAndroid.SHORT);
      } else {
        showCustomAlert(res.isFollowing ? 'Following' : 'Unfollowed', msg);
      }
    } catch (e) { showCustomAlert('Error', e || 'Failed'); }
  };

  // ── Player lookup ─────────────────────────────────────────────────────────
  const handleLookup = async () => {
    if (mobile.trim().length < 10) { showCustomAlert('Error', 'Enter a valid mobile number'); return; }
    setLookupLoading(true); setLookedUpPlayer(null); setLookupDone(false);
    try {
      const res = await api.get(`/players/lookup/${mobile.trim()}`);
      if (res.data?.data?.exists && res.data?.data?.player) {
        setLookedUpPlayer(res.data.data.player);
      } else {
        setLookedUpPlayer(null);
      }
    } catch { setLookedUpPlayer(null); }
    finally { setLookupLoading(false); setLookupDone(true); }
  };

  useEffect(() => {
    const trimmed = mobile.trim();
    if (trimmed.length === 10) {
      handleLookup();
    } else {
      setLookedUpPlayer(null);
      setLookupDone(false);
    }
  }, [mobile]);

  const handleAddPlayer = async () => {
    setAdding(true);
    try {
      await dispatch(addPlayerToTeam({ teamId: id, mobile: mobile.trim(), name: playerName.trim(), role: addRole })).unwrap();
      setAddModalVisible(false); setMobile(''); setPlayerName(''); setAddRole('player');
      setLookedUpPlayer(null); setLookupDone(false);
      showCustomAlert('Success', 'Player added!');
      dispatch(fetchTeamById(id));
    } catch (e) { showCustomAlert('Error', typeof e === 'string' ? e : 'Failed to add player'); }
    finally { setAdding(false); }
  };

  // ── Update role ───────────────────────────────────────────────────────────
  const handleUpdateRole = async (newRole) => {
    if (!selectedPlayerToEdit) return;
    setUpdatingRole(true);
    try {
      await dispatch(updatePlayerRole({ teamId: id, playerId: selectedPlayerToEdit.player._id, role: newRole })).unwrap();
      setRoleModalVisible(false);
      showCustomAlert('Success', 'Role updated');
    } catch (e) { showCustomAlert('Error', typeof e === 'string' ? e : 'Failed'); }
    finally { setUpdatingRole(false); }
  };

  // ── Edit team ─────────────────────────────────────────────────────────────
  const openEditModal = () => {
    setEditName(selectedTeam?.name || '');
    setEditCity(selectedTeam?.city || '');
    setEditState(selectedTeam?.state || '');
    setEditLogo(null);
    setEditModalVisible(true);
  };
  const handlePickLogo = async () => {
    const r = await launchImageLibrary({ mediaType: 'photo', quality: 0.8 });
    if (r.assets?.length) {
      if (r.assets[0].fileSize && r.assets[0].fileSize > 3 * 1024 * 1024) {
        showCustomAlert('File Too Large', 'Please select an image smaller than 3MB.');
        return;
      }
      setEditLogo(r.assets[0]);
    }
  };
  const handleUpdateTeam = async () => {
    if (!editName.trim()) { showCustomAlert('Error', 'Team name required'); return; }
    setUpdatingTeam(true);
    try {
      const fd = new FormData();
      fd.append('name', editName.trim());
      fd.append('city', editCity.trim());
      fd.append('state', editState.trim());
      if (editLogo) fd.append('logo', { uri: editLogo.uri, type: editLogo.type || 'image/jpeg', name: editLogo.fileName || 'logo.jpg' });
      await dispatch(updateTeam({ teamId: id, formData: fd })).unwrap();
      setEditModalVisible(false);
      showCustomAlert('Success', 'Team updated!');
    } catch (e) { showCustomAlert('Error', typeof e === 'string' ? e : 'Failed'); }
    finally { setUpdatingTeam(false); }
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDeleteTeam = () => {
    showCustomAlert('Delete Team', `Delete "${selectedTeam?.name}" permanently?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          setDeleting(true);
          try {
            await dispatch(deleteTeam(id)).unwrap();
            navigation.goBack();
            showCustomAlert('Deleted', 'Team deleted');
          } catch (e) { showCustomAlert('Error', typeof e === 'string' ? e : 'Failed'); }
          finally { setDeleting(false); }
        }
      }
    ]);
  };

  // ── Leave ─────────────────────────────────────────────────────────────────
  const handleLeaveTeam = () => {
    if (isMeCaptain && selectedTeam?.players?.length > 1) {
      showCustomAlert('Leave Team', 'Assign another captain before leaving');
      return;
    }
    showCustomAlert('Leave Team', `Leave "${selectedTeam?.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave', style: 'destructive', onPress: async () => {
          try {
            await dispatch(leaveTeam(id)).unwrap();
            navigation.goBack();
          } catch (e) { showCustomAlert('Error', typeof e === 'string' ? e : 'Failed'); }
        }
      }
    ]);
  };

  // ── Remove player ─────────────────────────────────────────────────────────
  const handleRemovePlayer = (member) => {
    showCustomAlert('Remove Player', `Remove ${member.player?.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          try {
            await dispatch(removePlayerFromTeam({ teamId: id, playerId: member.player._id })).unwrap();
            showCustomAlert('Removed', 'Player removed');
          } catch (e) { showCustomAlert('Error', typeof e === 'string' ? e : 'Failed'); }
        }
      }
    ]);
  };

  // ── Player options menu ───────────────────────────────────────────────────
  const handlePlayerOptions = (member) => {
    showCustomAlert(
      member.player?.name || 'Player Actions',
      'Select an action to manage this player',
      [
        {
          text: 'Change Role',
          onPress: () => {
            setSelectedPlayerToEdit(member);
            setRoleModalVisible(true);
          }
        },
        {
          text: 'Remove Player',
          style: 'destructive',
          onPress: () => handleRemovePlayer(member)
        },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  // ── Tab contents ──────────────────────────────────────────────────────────

  const renderPlayersTab = () => (
    <View style={{ flex: 1, position: 'relative' }}>
      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.tabContent, canManageRoster && { paddingTop: 8 }]} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} tintColor={Colors.primary} />}
      >

        {selectedTeam?.players?.map((member, i) => {
          const p = member.player;
          if (!p) return null;
          const photo = p.photo || p.userId?.photo;

          // Reliable identity check: match via userId OR playerId
          const playerUserId = p.userId?._id?.toString() || p.userId?.toString();
          const playerDocId = p._id?.toString();
          const isMe = (myUserId && playerUserId === myUserId) ||
            (myPlayerId && playerDocId === myPlayerId);

          const isCap = member.role === 'captain';
          const isVC = member.role === 'vice_captain';
          const isWK = member.role === 'wicket_keeper';

          // Stats: show 0 instead of '—' when no innings played
          const dismissals = (p.batting?.innings || 0) - (p.batting?.notOuts || 0);
          const batAvg = dismissals > 0 ? (p.batting.runs / dismissals).toFixed(1) : '0';
          const sr = p.batting?.balls > 0 ? ((p.batting.runs / p.batting.balls) * 100).toFixed(0) : '0';

          return (
            <TouchableOpacity
              key={member._id || String(i)}
              style={[styles.playerRow, isMe && styles.playerRowMe]}
              activeOpacity={0.82}
              onPress={() => navigation.navigate('PlayerDetail', { id: p._id })}
            >
              {/* Avatar with role badge */}
              <View style={styles.playerAvatarWrap}>
                {photo
                  ? <Image source={{ uri: getImageUrl(photo) }} style={styles.playerAvatar} />
                  : (
                    <View style={[styles.playerAvatarFb, isMe && styles.playerAvatarFbMe]}>
                      <Text style={styles.playerAvatarLetter}>{p.name?.[0]?.toUpperCase() || '?'}</Text>
                    </View>
                  )
                }
                {(isCap || isVC || isWK) && (
                  <View style={[styles.roleBadge,
                  isCap && styles.roleBadgeCap,
                  isVC && styles.roleBadgeVC,
                  isWK && styles.roleBadgeWK,
                  ]}>
                    <Icon
                      name={isCap ? 'crown' : isVC ? 'star-half-full' : 'shield-star'}
                      size={8}
                      color={isCap ? '#FFD700' : isVC ? '#90CAF9' : Colors.primary}
                    />
                  </View>
                )}
              </View>

              {/* Player info */}
              <View style={styles.playerDetailsWrap}>
                {/* Name row */}
                <View style={styles.playerNameRow}>
                  <Text style={[styles.playerName, isMe && styles.playerNameMe]} numberOfLines={1}>
                    {p.name}
                    {isMe ? <Text style={styles.youBadge}> • You</Text> : ''}
                  </Text>
                </View>

                {/* Role tag + playing style */}
                <View style={styles.playerTagRow}>
                  <View style={[styles.playerRoleTag,
                  isCap && styles.playerRoleTagCap,
                  isVC && styles.playerRoleTagVC,
                  ]}>
                    <Icon
                      name={ROLE_ICONS[member.role] || 'account'}
                      size={9}
                      color={isCap ? '#FFD700' : isVC ? '#90CAF9' : Colors.textTertiary}
                    />
                    <Text style={[styles.playerRoleTagText,
                    isCap && { color: '#FFD700' },
                    isVC && { color: '#90CAF9' },
                    ]}>
                      {ROLE_LABELS[member.role] || member.role}
                    </Text>
                  </View>
                  <Text style={styles.playerStyleText} numberOfLines={1}>
                    {p.playingRole || ''}
                  </Text>
                </View>

                {/* Mini stats */}
                <View style={styles.playerMiniStats}>
                  <MiniStat label="Runs" value={p.batting?.runs ?? 0} />
                  <View style={styles.miniStatDivider} />
                  <MiniStat label="Avg" value={batAvg} />
                  <View style={styles.miniStatDivider} />
                  <MiniStat label="SR" value={sr} />
                  <View style={styles.miniStatDivider} />
                  <MiniStat label="Wkts" value={p.bowling?.wickets ?? 0} />
                </View>
              </View>

              {/* Action button — ONLY captain/admin can manage roster */}
              {canManageRoster && !isMe && (
                <TouchableOpacity
                  style={styles.actionIconBtn}
                  onPress={(e) => { e.stopPropagation?.(); handlePlayerOptions(member); }}
                >
                  <Icon name="dots-vertical" size={18} color={Colors.textSecondary} />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          );
        })}
        {canManageRoster && <View style={{ height: 100 }} />}
      </ScrollView>

      {/* Floating Add Player Button */}
      {canManageRoster && (
        <TouchableOpacity style={styles.addPlayerFloatingBtn} onPress={() => setAddModalVisible(true)}>
          <Icon name="account-plus" size={24} color="#000" />
        </TouchableOpacity>
      )}
    </View>
  );

  const renderMatchesTab = () => {
    if (statsLoading && !teamStats) return <LoadingState />;
    const recentMatches = teamStats?.recentMatches || [];
    if (!recentMatches.length) return <EmptyState icon="cricket" label="No match history yet" />;

    return (
      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled" contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} tintColor={Colors.primary} />}
      >
        {recentMatches.map((m, i) => (
          <TouchableOpacity
            key={m._id || i}
            style={styles.matchRow}
            onPress={() => navigation.navigate('MatchSummary', { id: m.matchId || m._id })}
            activeOpacity={0.85}
          >
            <View style={[styles.resultBadge, m.result === 'W' ? styles.winBadge : m.result === 'L' ? styles.lossBadge : m.result === 'LIVE' ? styles.liveBadge : styles.nrBadge]}>
              <Text style={[styles.resultBadgeText, m.result === 'LIVE' && { fontSize: 9, color: Colors.primary }]}>{m.result || 'NR'}</Text>
            </View>
            <View style={styles.matchRowInfo}>
              <View style={styles.matchRowTop}>
                <View style={styles.opponentLogoWrap}>
                  {m.opponent?.logo
                    ? <Image source={{ uri: getImageUrl(m.opponent.logo) }} style={styles.opponentLogo} />
                    : <View style={styles.opponentLogoFb}><Text style={styles.opponentLogoLetter}>{m.opponent?.name?.[0] || '?'}</Text></View>
                  }
                </View>
                <View>
                  <Text style={styles.matchVsLabel}>vs {m.opponent?.name || 'Unknown'}</Text>
                  <Text style={styles.matchFormat}>{m.format} · {m.overs} Overs</Text>
                </View>
              </View>
              {m.resultSummary ? (
                <Text style={[styles.matchResultText, m.result === 'W' ? { color: Colors.success } : m.result === 'LIVE' ? { color: Colors.primary } : { color: Colors.error }]} numberOfLines={1}>
                  {m.resultSummary}
                </Text>
              ) : null}
            </View>
            <Text style={styles.matchDate}>
              {m.completedAt ? new Date(m.completedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  };

  const renderStatsTab = () => {
    if (statsLoading && !teamStats) return <LoadingState />;
    const s = selectedTeam?.stats || {};
    const winPct = s.matches > 0 ? parseFloat(((s.wins / s.matches) * 100).toFixed(1)) : 0;
    const lossPct = s.matches > 0 ? parseFloat(((s.losses / s.matches) * 100).toFixed(1)) : 0;
    const nrPct = Math.max(0, parseFloat((100 - winPct - lossPct).toFixed(1)));
    const recent = teamStats?.recentMatches || [];
    const bat = teamStats?.battingStats || {};
    const bowl = teamStats?.bowlingStats || {};
    const records = teamStats?.teamRecords || {};
    const h2h = teamStats?.headToHead || [];
    const phases = teamStats?.phaseRunRates || {};
    const topScorers = teamStats?.topScorers || [];
    const topBowlers = teamStats?.topWicketTakers || [];

    const last10 = recent.slice(0, 5);
    const recentWins = last10.filter(m => m.result === 'W').length;

    // ── Chart config (dark theme) ─────────────────────────────
    const chartCfg = {
      backgroundColor: 'transparent',
      backgroundGradientFrom: '#161616',
      backgroundGradientTo: '#161616',
      decimalPlaces: 0,
      color: (opacity = 1) => `rgba(255,204,0,${opacity})`,
      labelColor: () => '#A0AAB5',
      propsForDots: { r: '4', strokeWidth: '2', stroke: Colors.primary },
      propsForBackgroundLines: { stroke: 'rgba(255,255,255,0.06)', strokeDasharray: '' },
    };

    // ── Line chart: recent form as run-rate-like momentum ─────
    // Use W=3, L=0, T=1, NR=1.5 as "momentum points"
    const momentumData = last10.length > 1
      ? last10.map(m => m.result === 'W' ? 3 : m.result === 'L' ? 0 : m.result === 'T' ? 1.5 : 1)
      : null;

    // ── Pie chart data (win/loss/nr) ───────────────────────────
    const hasPie = s.matches > 0;
    const pieData = hasPie
      ? [
          { name: 'Won', population: s.wins || 0, color: Colors.primary, legendFontColor: Colors.textSecondary, legendFontSize: 11 },
          { name: 'Lost', population: s.losses || 0, color: 'rgba(255,255,255,0.2)', legendFontColor: Colors.textSecondary, legendFontSize: 11 },
          ...(nrPct > 0 ? [{ name: 'NR', population: s.noResults || 0, color: 'rgba(255,255,255,0.08)', legendFontColor: Colors.textSecondary, legendFontSize: 11 }] : []),
        ]
      : null;

    // ── Bar chart: batting — fours vs sixes per 10 matches ─────
    const hasBarData = bat.fours > 0 || bat.sixes > 0;
    const barLabels = ['4s', '6s', 'Avg', 'RR×10'];
    const barValues = [
      Math.min(bat.fours || 0, 200),
      Math.min(bat.sixes || 0, 200),
      Math.min(parseFloat(bat.avgScore || 0), 200),
      Math.min(parseFloat(bat.runRate || 0) * 10, 200),
    ];
    const barMax = Math.max(...barValues, 1);

    // ── Phase data ─────────────────────────────────────────────
    const phaseArr = [
      { label: 'PP', full: 'Powerplay', val: phases.powerplay ? parseFloat(phases.powerplay) : null, color: Colors.primary },
      { label: 'MID', full: 'Middle', val: phases.middle ? parseFloat(phases.middle) : null, color: '#FFFFFF' },
      { label: 'DEATH', full: 'Death', val: phases.death ? parseFloat(phases.death) : null, color: 'rgba(255,255,255,0.6)' },
    ];
    const hasPhase = phaseArr.some(p => p.val !== null);
    const maxPhase = hasPhase ? Math.max(...phaseArr.filter(p => p.val !== null).map(p => p.val)) : 1;

    // ── Sub-components ─────────────────────────────────────────
    const SectionHeader = ({ title, sub }) => (
      <View style={stS.sectionHeader}>
        <Text style={stS.sectionTitle}>{title}</Text>
        {sub && <Text style={stS.sectionSub}>{sub}</Text>}
      </View>
    );

    const StatItem = ({ label, value, accent, highlight }) => (
      <View style={[stS.statItem, highlight && stS.statItemHighlight]}>
        <Text style={[stS.statItemValue, accent && { color: accent }]} numberOfLines={1}>{value ?? '—'}</Text>
        <Text style={stS.statItemLabel}>{label}</Text>
      </View>
    );

    const chartW = SCREEN_W - 28;

    return (
      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 8, paddingBottom: 70 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} tintColor={Colors.primary} />}
      >

        {/* ═══════════════════════════════════════════════════
            1. WIN / LOSS OVERVIEW  +  PIE CHART
        ═══════════════════════════════════════════════════ */}
        <SectionHeader title="Season Overview" />
        <View style={stS.chartCard}>
          {/* Big stats row */}
          <View style={stS.overviewRow}>
            <View style={stS.overviewStat}>
              <Text style={stS.overviewVal}>{s.matches || 0}</Text>
              <Text style={stS.overviewLabel}>Matches</Text>
            </View>
            <View style={stS.overviewDivider} />
            <View style={stS.overviewStat}>
              <Text style={[stS.overviewVal, { color: Colors.primary }]}>{s.wins || 0}</Text>
              <Text style={stS.overviewLabel}>Won</Text>
            </View>
            <View style={stS.overviewDivider} />
            <View style={stS.overviewStat}>
              <Text style={[stS.overviewVal, { color: Colors.textSecondary }]}>{s.losses || 0}</Text>
              <Text style={stS.overviewLabel}>Lost</Text>
            </View>
            <View style={stS.overviewDivider} />
            <View style={stS.overviewStat}>
              <Text style={[stS.overviewVal, { color: Colors.primary }]}>{winPct}%</Text>
              <Text style={stS.overviewLabel}>Win Rate</Text>
            </View>
          </View>

          {/* Segmented progress bar */}
          {s.matches > 0 && (
            <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
              <View style={stS.progressBg}>
                <View style={[stS.progressWin, { flex: winPct }]} />
                <View style={[stS.progressLoss, { flex: lossPct }]} />
                {nrPct > 0 && <View style={[stS.progressNR, { flex: nrPct }]} />}
              </View>
              <View style={stS.progressLabels}>
                <View style={stS.progressLegItem}>
                  <View style={[stS.progressLegDot, { backgroundColor: Colors.primary }]} />
                  <Text style={[stS.progressLegText, { color: Colors.primary }]}>Win {winPct}%</Text>
                </View>
                <View style={stS.progressLegItem}>
                  <View style={[stS.progressLegDot, { backgroundColor: 'rgba(255,255,255,0.3)' }]} />
                  <Text style={stS.progressLegText}>Loss {lossPct}%</Text>
                </View>
                {nrPct > 0 && (
                  <View style={stS.progressLegItem}>
                    <View style={[stS.progressLegDot, { backgroundColor: 'rgba(255,255,255,0.1)' }]} />
                    <Text style={stS.progressLegText}>NR {nrPct}%</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Pie Chart */}
          {hasPie && pieData && (
            <View style={stS.pieWrap}>
              <PieChart
                data={pieData}
                width={chartW - 16}
                height={160}
                chartConfig={chartCfg}
                accessor="population"
                backgroundColor="transparent"
                paddingLeft="20"
                absolute={false}
                hasLegend={true}
                center={[10, 0]}
                avoidFalseZero
              />
            </View>
          )}
        </View>


        {/* ═══════════════════════════════════════════════════
            3. BATTING PERFORMANCE — Stats Grid + Bar Chart
        ═══════════════════════════════════════════════════ */}
        {bat.totalRuns > 0 && (
          <View style={{ marginBottom: 0 }}>
            <SectionHeader title="Batting Performance" />
            <View style={stS.chartCard}>
              {/* Key stats 4-grid */}
              <View style={stS.miniGrid}>
                <View style={stS.miniGridItem}>
                  <Text style={[stS.miniGridVal, { color: Colors.primary }]}>{bat.totalRuns?.toLocaleString()}</Text>
                  <Text style={stS.miniGridLabel}>Total Runs</Text>
                </View>
                <View style={stS.miniGridItem}>
                  <Text style={stS.miniGridVal}>{bat.avgScore}</Text>
                  <Text style={stS.miniGridLabel}>Avg Score</Text>
                </View>
                <View style={stS.miniGridItem}>
                  <Text style={[stS.miniGridVal, { color: Colors.primary }]}>{bat.highestScore?.score || '—'}</Text>
                  <Text style={stS.miniGridLabel}>Highest</Text>
                </View>
                <View style={stS.miniGridItem}>
                  <Text style={[stS.miniGridVal, { color: '#FFFFFF' }]}>{bat.lowestScore?.score || '—'}</Text>
                  <Text style={stS.miniGridLabel}>Lowest</Text>
                </View>
              </View>

              {/* Horizontal divider */}
              <View style={stS.cardDivider} />

              {/* Run Rate + Boundary % + Fours + Sixes */}
              <View style={stS.miniGrid}>
                <View style={stS.miniGridItem}>
                  <Text style={[stS.miniGridVal, { color: Colors.primary }]}>{bat.runRate}</Text>
                  <Text style={stS.miniGridLabel}>Run Rate</Text>
                </View>
                <View style={stS.miniGridItem}>
                  <Text style={stS.miniGridVal}>{bat.boundaryPct}%</Text>
                  <Text style={stS.miniGridLabel}>Boundary %</Text>
                </View>
                <View style={stS.miniGridItem}>
                  <Text style={stS.miniGridVal}>{bat.fours}</Text>
                  <Text style={stS.miniGridLabel}>Fours</Text>
                </View>
                <View style={stS.miniGridItem}>
                  <Text style={[stS.miniGridVal, { color: Colors.primary }]}>{bat.sixes}</Text>
                  <Text style={stS.miniGridLabel}>Sixes</Text>
                </View>
              </View>

              {/* Bar chart — Fours vs Sixes visual */}
              {hasBarData && (
                <>
                  <View style={stS.cardDivider} />
                  <Text style={stS.chartSubLabel}>Batting Metrics</Text>
                  <BarChart
                    data={{
                      labels: ['4s', '6s', 'Avg', 'RR'],
                      datasets: [{ data: barValues }],
                    }}
                    width={chartW - 8}
                    height={175}
                    chartConfig={{
                      ...chartCfg,
                      labelColor: () => '#A0AAB5',
                      propsForLabels: { fontSize: 11, fontWeight: 'bold' },
                      barPercentage: 0.55,
                      fillShadowGradient: Colors.primary,
                      fillShadowGradientOpacity: 1,
                    }}
                    withInnerLines={false}
                    showValuesOnTopOfBars={true}
                    fromZero={true}
                    style={{ borderRadius: 10, marginLeft: -14, marginTop: 4 }}
                    withHorizontalLabels={false}
                  />
                </>
              )}
            </View>
          </View>
        )}

        {/* ═══════════════════════════════════════════════════
            4. BOWLING PERFORMANCE
        ═══════════════════════════════════════════════════ */}
        {bowl.totalWickets > 0 && (
          <View style={{ marginBottom: 0 }}>
            <SectionHeader title="Bowling Performance" />
            <View style={stS.chartCard}>
              <View style={stS.miniGrid}>
                <View style={stS.miniGridItem}>
                  <Text style={[stS.miniGridVal, { color: Colors.primary }]}>{bowl.totalWickets}</Text>
                  <Text style={stS.miniGridLabel}>Wickets</Text>
                </View>
                <View style={stS.miniGridItem}>
                  <Text style={stS.miniGridVal}>{bowl.economy}</Text>
                  <Text style={stS.miniGridLabel}>Economy</Text>
                </View>
                <View style={stS.miniGridItem}>
                  <Text style={stS.miniGridVal}>{bowl.bowlingAvg}</Text>
                  <Text style={stS.miniGridLabel}>Avg</Text>
                </View>
                <View style={stS.miniGridItem}>
                  <Text style={[stS.miniGridVal, { color: Colors.primary }]}>{bowl.bestBowling}</Text>
                  <Text style={stS.miniGridLabel}>Best</Text>
                </View>
              </View>
              {bowl.maidens > 0 && (
                <>
                  <View style={stS.cardDivider} />
                  <View style={[stS.miniGrid, { gap: 0 }]}>
                    <View style={stS.miniGridItem}>
                      <Text style={stS.miniGridVal}>{bowl.maidens}</Text>
                      <Text style={stS.miniGridLabel}>Maidens</Text>
                    </View>
                  </View>
                </>
              )}
            </View>
          </View>
        )}

        {/* ═══════════════════════════════════════════════════
            5. PHASE RUN RATE — Custom Arc/Bar visualization
        ═══════════════════════════════════════════════════ */}
        {hasPhase && (
          <View style={{ marginBottom: 0 }}>
            <SectionHeader title="Run Rate by Phase" />
            <View style={stS.chartCard}>
              <View style={stS.phaseVisRow}>
                {phaseArr.map((ph, idx) => {
                  const fillPct = ph.val !== null ? ph.val / (maxPhase * 1.2) : 0;
                  const barH = 80;
                  return (
                    <View key={ph.label} style={stS.phaseCol}>
                      <Text style={[stS.phaseRpoVal, { color: ph.color }]}>
                        {ph.val !== null ? ph.val : '—'}
                      </Text>
                      <Text style={stS.phaseRpoUnit}>rpo</Text>
                      {/* Vertical fill bar */}
                      <View style={[stS.phaseVertBg, { height: barH }]}>
                        <View style={[stS.phaseVertFill, {
                          height: ph.val !== null ? fillPct * barH : 0,
                          backgroundColor: ph.color,
                        }]} />
                      </View>
                      <View style={[stS.phaseLabelBadge, { borderColor: ph.color + '55', backgroundColor: ph.color + '18' }]}>
                        <Text style={[stS.phaseLabelBadgeText, { color: ph.color }]}>{ph.label}</Text>
                      </View>
                      <Text style={stS.phaseFullLabel}>{ph.full}</Text>
                    </View>
                  );
                })}
              </View>
              {/* ProgressChart: phase rings */}
              {phaseArr.every(p => p.val !== null) && (
                <>
                  <View style={stS.cardDivider} />
                  <ProgressChart
                    data={{
                      labels: phaseArr.map(p => p.label),
                      data: phaseArr.map(p => p.val !== null ? Math.min(p.val / 15, 1) : 0),
                    }}
                    width={chartW - 8}
                    height={120}
                    strokeWidth={10}
                    radius={28}
                    chartConfig={{
                      ...chartCfg,
                      color: (opacity = 1, index) => {
                        const cols = [Colors.primary, '#FFFFFF', 'rgba(255,255,255,0.4)'];
                        return cols[index % cols.length] || Colors.primary;
                      },
                    }}
                    hideLegend={false}
                    style={{ borderRadius: 10, marginLeft: -10, marginBottom: -8 }}
                  />
                </>
              )}
            </View>
          </View>
        )}

        {/* ═══════════════════════════════════════════════════
            6. TOP PERFORMERS
        ═══════════════════════════════════════════════════ */}
        {(topScorers.length > 0 || topBowlers.length > 0) && (
          <View style={{ marginBottom: 0 }}>
            <SectionHeader title="Top Performers" />

            {topScorers.length > 0 && (
              <View style={[stS.chartCard, { paddingHorizontal: 0, paddingVertical: 0, marginBottom: 8, overflow: 'hidden' }]}>
                <View style={stS.perfSectionBanner}>
                  <Icon name="cricket" size={12} color={Colors.primary} />
                  <Text style={stS.perfSectionLabel}>BATTING</Text>
                </View>
                {topScorers.slice(0, 3).map((p, i) => {
                  const photo = p.player?.photo || p.player?.userId?.photo;
                  return (
                    <TouchableOpacity
                      key={p.player?._id || i}
                      style={[stS.perfRow, i === topScorers.slice(0, 3).length - 1 && { borderBottomWidth: 0 }]}
                      activeOpacity={0.82}
                      onPress={() => p.player?._id && navigation.navigate('PlayerDetail', { id: p.player._id })}
                    >
                      <Text style={[stS.perfRankNum, i === 0 && { color: Colors.primary }, i === 1 && { color: '#FFFFFF' }, i === 2 && { color: 'rgba(255,255,255,0.6)' }]}>
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}
                      </Text>
                      <View style={stS.lbAvatar}>
                        {photo
                          ? <Image source={{ uri: getImageUrl(photo) }} style={styles.lbAvatarImg} />
                          : <View style={styles.lbAvatarFb}><Text style={styles.lbAvatarLetter}>{p.player?.name?.[0] || '?'}</Text></View>
                        }
                      </View>
                      <View style={stS.perfInfo}>
                        <Text style={stS.perfName} numberOfLines={1}>{p.player?.name || 'Unknown'}</Text>
                        <Text style={stS.perfMeta}>Avg {p.average} · SR {p.strikeRate}</Text>
                      </View>
                      <View style={stS.perfPrimary}>
                        <Text style={stS.perfPrimaryVal}>{p.runs}</Text>
                        <Text style={stS.perfPrimaryLabel}>runs</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {topBowlers.length > 0 && (
              <View style={[stS.chartCard, { paddingHorizontal: 0, paddingVertical: 0, overflow: 'hidden' }]}>
                <View style={stS.perfSectionBanner}>
                  <Icon name="baseball" size={12} color={Colors.primary} />
                  <Text style={stS.perfSectionLabel}>BOWLING</Text>
                </View>
                {topBowlers.slice(0, 3).map((p, i) => {
                  const photo = p.player?.photo || p.player?.userId?.photo;
                  return (
                    <TouchableOpacity
                      key={p.player?._id || i}
                      style={[stS.perfRow, i === topBowlers.slice(0, 3).length - 1 && { borderBottomWidth: 0 }]}
                      activeOpacity={0.82}
                      onPress={() => p.player?._id && navigation.navigate('PlayerDetail', { id: p.player._id })}
                    >
                      <Text style={[stS.perfRankNum]}>
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}
                      </Text>
                      <View style={stS.lbAvatar}>
                        {photo
                          ? <Image source={{ uri: getImageUrl(photo) }} style={styles.lbAvatarImg} />
                          : <View style={styles.lbAvatarFb}><Text style={styles.lbAvatarLetter}>{p.player?.name?.[0] || '?'}</Text></View>
                        }
                      </View>
                      <View style={stS.perfInfo}>
                        <Text style={stS.perfName} numberOfLines={1}>{p.player?.name || 'Unknown'}</Text>
                        <Text style={stS.perfMeta}>Econ {p.economy} · Avg {p.bowlingAvg}</Text>
                      </View>
                      <View style={stS.perfPrimary}>
                        <Text style={stS.perfPrimaryVal}>{p.wickets}</Text>
                        <Text style={stS.perfPrimaryLabel}>wkts</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* ═══════════════════════════════════════════════════
            7. TEAM RECORDS
        ═══════════════════════════════════════════════════ */}
        {(records.highestScore || records.biggestWinByRuns || records.longestWinStreak > 0) && (
          <View style={{ marginBottom: 0 }}>
            <SectionHeader title="Team Records" />
            <View style={stS.chartCard}>
              <View style={stS.recordsGrid}>
                {records.highestScore && (
                  <View style={stS.recordItem}>
                    <Icon name="arrow-up-bold" size={18} color={Colors.primary} />
                    <Text style={[stS.recordVal, { color: Colors.primary }]}>{records.highestScore.score}</Text>
                    <Text style={stS.recordLabel}>Highest Score</Text>
                    <Text style={stS.recordSub}>vs {records.highestScore.vs?.split(' ')[0]}</Text>
                  </View>
                )}
                {records.lowestScore && (
                  <View style={stS.recordItem}>
                    <Icon name="arrow-down-bold" size={18} color="rgba(255,255,255,0.6)" />
                    <Text style={[stS.recordVal, { color: '#FFFFFF' }]}>{records.lowestScore.score}</Text>
                    <Text style={stS.recordLabel}>Lowest Score</Text>
                    <Text style={stS.recordSub}>vs {records.lowestScore.vs?.split(' ')[0]}</Text>
                  </View>
                )}
                {records.biggestWinByRuns && (
                  <View style={stS.recordItem}>
                    <Icon name="trophy-outline" size={18} color={Colors.primary} />
                    <Text style={[stS.recordVal, { color: Colors.primary }]}>{records.biggestWinByRuns.margin}</Text>
                    <Text style={stS.recordLabel}>Runs Won By</Text>
                    <Text style={stS.recordSub}>vs {records.biggestWinByRuns.vs?.split(' ')[0]}</Text>
                  </View>
                )}
                {records.biggestWinByWickets && (
                  <View style={stS.recordItem}>
                    <Icon name="trophy" size={18} color={Colors.primary} />
                    <Text style={[stS.recordVal, { color: Colors.primary }]}>{records.biggestWinByWickets.margin}</Text>
                    <Text style={stS.recordLabel}>Wickets Won By</Text>
                    <Text style={stS.recordSub}>vs {records.biggestWinByWickets.vs?.split(' ')[0]}</Text>
                  </View>
                )}
                {records.highestChase && (
                  <View style={stS.recordItem}>
                    <Icon name="flag-checkered" size={18} color={Colors.primary} />
                    <Text style={[stS.recordVal, { color: Colors.primary }]}>{records.highestChase.score}</Text>
                    <Text style={stS.recordLabel}>Highest Chase</Text>
                    <Text style={stS.recordSub}>vs {records.highestChase.vs?.split(' ')[0]}</Text>
                  </View>
                )}
                {records.longestWinStreak > 0 && (
                  <View style={stS.recordItem}>
                    <Icon name="fire" size={18} color={Colors.primary} />
                    <Text style={[stS.recordVal, { color: Colors.primary }]}>{records.longestWinStreak}</Text>
                    <Text style={stS.recordLabel}>Win Streak</Text>
                    <Text style={stS.recordSub}>matches</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        )}

        {/* ═══════════════════════════════════════════════════
            8. HEAD-TO-HEAD
        ═══════════════════════════════════════════════════ */}
        {h2h.length > 0 && (
          <View style={{ marginBottom: 0 }}>
            <SectionHeader title="Head-to-Head" />
            <View style={stS.chartCard}>
              {h2h.map((h, idx) => {
                const wp = parseInt(h.winPct) || 0;
                return (
                  <View key={h.opponent?._id?.toString() || idx} style={[stS.h2hRow, idx === h2h.length - 1 && { borderBottomWidth: 0 }]}>
                    <View style={stS.h2hOpponent}>
                      {h.opponent?.logo
                        ? <Image source={{ uri: getImageUrl(h.opponent.logo) }} style={stS.h2hLogo} />
                        : <View style={stS.h2hLogoFb}><Text style={stS.h2hLogoLetter}>{h.opponent?.name?.[0] || '?'}</Text></View>
                      }
                      <Text style={stS.h2hName} numberOfLines={1}>{h.opponent?.name || '?'}</Text>
                    </View>
                    <View style={stS.h2hStats}>
                      <View style={stS.h2hBarBg}>
                        <View style={[stS.h2hBarFill, { width: `${wp}%`, backgroundColor: Colors.primary }]} />
                      </View>
                      <Text style={stS.h2hFigures}>
                        <Text style={{ color: Colors.primary }}>{h.wins}W</Text>
                        <Text style={{ color: Colors.textTertiary }}> · </Text>
                        <Text style={{ color: Colors.textSecondary }}>{h.losses}L</Text>
                        <Text style={{ color: Colors.textTertiary }}> / {h.matches}M</Text>
                      </Text>
                    </View>
                    <Text style={[stS.h2hWinPct, { color: Colors.primary }]}>{wp}%</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Empty state */}
        {!s.matches && !teamStats && (
          <View style={stS.emptyWrap}>
            <Icon name="chart-bar" size={52} color={Colors.primaryAlpha30} />
            <Text style={stS.emptyTitle}>No Stats Yet</Text>
            <Text style={stS.emptySub}>Play matches to unlock your team's analytics dashboard</Text>
          </View>
        )}
      </ScrollView>
    );
  };

  const renderLeaderboardTab = () => {
    if (statsLoading && !teamStats) return <LoadingState />;
    const topBat = teamStats?.topScorers || [];
    const topBowl = teamStats?.topWicketTakers || [];
    const topField = teamStats?.topFielders || [];

    return (
      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled" contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} tintColor={Colors.primary} />}
      >
        <View style={styles.lbTabRow}>
          {['batters', 'bowlers', 'fielders'].map(t => (
            <TouchableOpacity key={t} onPress={() => setActiveLeaderboardTab(t)} style={[styles.lbTab, activeLeaderboardTab === t && styles.lbTabActive]}>
              <Text style={[styles.lbTabText, activeLeaderboardTab === t && styles.lbTabTextActive]}>{t.charAt(0).toUpperCase() + t.slice(1)}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {activeLeaderboardTab === 'batters' && (
          <View style={styles.lbSection}>
            <View style={styles.lbSectionHeader}>
              <Icon name="cricket" size={16} color={Colors.primary} />
              <Text style={styles.lbSectionTitle}>Top Scorers</Text>
            </View>
            {topBat.length === 0 ? <EmptyState icon="cricket" label="No batting data yet" small /> : topBat.map((p, i) => {
              const photo = p.player?.photo || p.player?.userId?.photo || selectedTeam?.players?.find(m => m.player?._id?.toString() === p.player?._id?.toString())?.player?.photo || selectedTeam?.players?.find(m => m.player?._id?.toString() === p.player?._id?.toString())?.player?.userId?.photo;
              return (
                <TouchableOpacity
                  key={p.player?._id || i}
                  style={styles.lbRow}
                  activeOpacity={0.85}
                  onPress={() => p.player?._id && navigation.navigate('PlayerDetail', { id: p.player._id })}
                >
                  <View style={[styles.lbRank, i < 3 && styles.lbRankTop]}>
                    <Text style={[styles.lbRankText, i < 3 && { color: '#FFD700' }]}>{i + 1}</Text>
                  </View>
                  <View style={styles.lbAvatar}>
                    {photo
                      ? <Image source={{ uri: getImageUrl(photo) }} style={styles.lbAvatarImg} />
                      : <View style={styles.lbAvatarFb}><Text style={styles.lbAvatarLetter}>{p.player?.name?.[0] || '?'}</Text></View>
                    }
                  </View>
                  <View style={styles.lbInfo}>
                    <Text style={styles.lbName} numberOfLines={1}>{p.player?.name || 'Unknown'}</Text>
                    <Text style={styles.lbMeta}>SR: {p.strikeRate} · Avg: {p.average}</Text>
                  </View>
                  <View style={styles.lbPrimaryVal}>
                    <Text style={styles.lbPrimaryValNum}>{p.runs}</Text>
                    <Text style={styles.lbPrimaryValLabel}>runs</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {activeLeaderboardTab === 'bowlers' && (
          <View style={styles.lbSection}>
            <View style={styles.lbSectionHeader}>
              <Icon name="baseball" size={16} color={Colors.primary} />
              <Text style={styles.lbSectionTitle}>Top Wicket Takers</Text>
            </View>
            {topBowl.length === 0 ? <EmptyState icon="baseball" label="No bowling data yet" small /> : topBowl.map((p, i) => {
              const photo = p.player?.photo || p.player?.userId?.photo || selectedTeam?.players?.find(m => m.player?._id?.toString() === p.player?._id?.toString())?.player?.photo || selectedTeam?.players?.find(m => m.player?._id?.toString() === p.player?._id?.toString())?.player?.userId?.photo;
              return (
                <TouchableOpacity
                  key={p.player?._id || i}
                  style={styles.lbRow}
                  activeOpacity={0.85}
                  onPress={() => p.player?._id && navigation.navigate('PlayerDetail', { id: p.player._id })}
                >
                  <View style={[styles.lbRank, i < 3 && styles.lbRankTop]}>
                    <Text style={[styles.lbRankText, i < 3 && { color: '#FFD700' }]}>{i + 1}</Text>
                  </View>
                  <View style={styles.lbAvatar}>
                    {photo
                      ? <Image source={{ uri: getImageUrl(photo) }} style={styles.lbAvatarImg} />
                      : <View style={styles.lbAvatarFb}><Text style={styles.lbAvatarLetter}>{p.player?.name?.[0] || '?'}</Text></View>
                    }
                  </View>
                  <View style={styles.lbInfo}>
                    <Text style={styles.lbName} numberOfLines={1}>{p.player?.name || 'Unknown'}</Text>
                    <Text style={styles.lbMeta}>Econ: {p.economy} · {p.overs} Overs</Text>
                  </View>
                  <View style={styles.lbPrimaryVal}>
                    <Text style={styles.lbPrimaryValNum}>{p.wickets}</Text>
                    <Text style={styles.lbPrimaryValLabel}>wkts</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {activeLeaderboardTab === 'fielders' && (
          <View style={styles.lbSection}>
            <View style={styles.lbSectionHeader}>
              <Icon name="hand-back-right" size={16} color={Colors.primary} />
              <Text style={styles.lbSectionTitle}>Top Fielders</Text>
            </View>
            {topField.length === 0 ? <EmptyState icon="hand-back-right" label="No fielding data yet" small /> : topField.map((p, i) => {
              const photo = p.player?.photo || p.player?.userId?.photo || selectedTeam?.players?.find(m => m.player?._id?.toString() === p.player?._id?.toString())?.player?.photo || selectedTeam?.players?.find(m => m.player?._id?.toString() === p.player?._id?.toString())?.player?.userId?.photo;
              return (
                <TouchableOpacity
                  key={p.player?._id || i}
                  style={styles.lbRow}
                  activeOpacity={0.85}
                  onPress={() => p.player?._id && navigation.navigate('PlayerDetail', { id: p.player._id })}
                >
                  <View style={[styles.lbRank, i < 3 && styles.lbRankTop]}>
                    <Text style={[styles.lbRankText, i < 3 && { color: '#FFD700' }]}>{i + 1}</Text>
                  </View>
                  <View style={styles.lbAvatar}>
                    {photo
                      ? <Image source={{ uri: getImageUrl(photo) }} style={styles.lbAvatarImg} />
                      : <View style={styles.lbAvatarFb}><Text style={styles.lbAvatarLetter}>{p.player?.name?.[0] || '?'}</Text></View>
                    }
                  </View>
                  <View style={styles.lbInfo}>
                    <Text style={styles.lbName} numberOfLines={1}>{p.player?.name || 'Unknown'}</Text>
                    <Text style={styles.lbMeta}>Catches: {p.catches} · Run Outs: {p.runOuts} · Stumpings: {p.stumpings}</Text>
                  </View>
                  <View style={styles.lbPrimaryVal}>
                    <Text style={styles.lbPrimaryValNum}>{p.total}</Text>
                    <Text style={styles.lbPrimaryValLabel}>dismissals</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    );
  };

  const renderAchievementsTab = () => {
    const s = selectedTeam?.stats || {};
    return (
      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled" contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} tintColor={Colors.primary} />}
      >
        <View style={styles.achGrid}>
          {ACHIEVEMENTS.map(ach => {
            const current = s[ach.key] || 0;
            const unlocked = current >= ach.target;
            const pct = Math.min((current / ach.target) * 100, 100);

            return (
              <View key={ach.id} style={[styles.achCard, unlocked && styles.achCardUnlocked]}>
                <View style={[styles.achIconWrap, unlocked && styles.achIconWrapUnlocked]}>
                  <Icon name={ach.icon} size={28} color={unlocked ? '#FFD700' : Colors.textTertiary} />
                </View>
                <Text style={[styles.achLabel, unlocked && styles.achLabelUnlocked]}>{ach.label}</Text>
                <Text style={styles.achDesc}>{ach.desc}</Text>
                {!unlocked && (
                  <>
                    <View style={styles.achProgressBg}>
                      <View style={[styles.achProgressFill, { width: `${pct}%` }]} />
                    </View>
                    <Text style={styles.achProgress}>{current}/{ach.target}</Text>
                  </>
                )}
                {unlocked && (
                  <View style={styles.achUnlockedBadge}>
                    <Icon name="check-circle" size={12} color={Colors.primary} />
                    <Text style={styles.achUnlockedText}>Unlocked!</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>
    );
  };

  const renderAnalyticsTab = () => {
    if (statsLoading && !teamStats) return <LoadingState />;

    const totalMatches = selectedTeam?.stats?.matches || teamStats?.recentMatches?.length || 0;
    if (!totalMatches) {
      return (
        <ScrollView
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} tintColor={Colors.primary} />}
        >
          <EmptyState icon="chart-timeline-variant" label="No match has played yet" />
        </ScrollView>
      );
    }

    const perfTrend = teamStats?.performanceTrend || {
      winRate: { current: 0, previous: 0, change: 0 },
      avgScore: { current: 0, previous: 0, change: 0 },
      runRate: { current: 0, previous: 0, change: 0 },
      points: [],
    };

    const playerContrib = teamStats?.playerContribution || { batting: [], bowling: [] };
    const contribList = contribType === 'batting' ? (playerContrib.batting || []) : (playerContrib.bowling || []);

    const strengths = teamStats?.teamStrengths || [];

    const last6Obj = teamStats?.recentFormLast6 || {};
    const last6Matches = (last6Obj.matches || teamStats?.recentMatches || []).slice(0, 6);
    const last6Wins = last6Obj.wins ?? last6Matches.filter(m => m.result === 'W').length;
    const last6Losses = last6Obj.losses ?? last6Matches.filter(m => m.result === 'L').length;
    const last6WinRate = last6Obj.winRate ?? (last6Matches.length > 0 ? parseFloat(((last6Wins / last6Matches.length) * 100).toFixed(1)) : 0);

    const bFirstVsChasing = teamStats?.batFirstVsChasing || {
      batFirst: { matches: 0, wins: 0, losses: 0, winRate: 0, avgScore: 0 },
      chasing: { matches: 0, wins: 0, losses: 0, winRate: 0, avgScore: 0 },
    };

    const seasonList = teamStats?.seasonComparison || [];

    // Performance trend points & metric
    const points = perfTrend.points || [];
    const trendLabels = points.map(p => p.period);
    const trendValues = points.map(p =>
      trendMetric === 'win_rate' ? (p.winRate || 0) :
      trendMetric === 'avg_score' ? (p.avgScore || 0) : (p.runRate || 0)
    );

    const metricSummary = trendMetric === 'win_rate' ? perfTrend.winRate :
      trendMetric === 'avg_score' ? perfTrend.avgScore : perfTrend.runRate;

    const unitSuffix = trendMetric === 'win_rate' ? '%' : trendMetric === 'run_rate' ? ' rpo' : '';

    const chartW = SCREEN_W - 28;

    const SectionHeader = ({ title, sub }) => (
      <View style={stS.sectionHeader}>
        <Text style={stS.sectionTitle}>{title}</Text>
        {sub && <Text style={stS.sectionSub}>{sub}</Text>}
      </View>
    );

    return (
      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 8, paddingBottom: 80 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} tintColor={Colors.primary} />}
      >

        {/* ═══════════════════════════════════════════════════
            2. PLAYER CONTRIBUTION
        ═══════════════════════════════════════════════════ */}
        <SectionHeader title="Player Contribution" />
        <View style={stS.chartCard}>
          <View style={stS.toggleRow}>
            {[
              { id: 'batting', label: 'Batting' },
              { id: 'bowling', label: 'Bowling' },
            ].map(t => (
              <TouchableOpacity
                key={t.id}
                style={[stS.toggleBtn, contribType === t.id && stS.toggleBtnActive, { flex: 1 }]}
                onPress={() => setContribType(t.id)}
                activeOpacity={0.8}
              >
                <Text style={[stS.toggleBtnText, contribType === t.id && stS.toggleBtnTextActive]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ marginTop: 14, gap: 12 }}>
            {contribList.length > 0 ? contribList.map((item, idx) => {
              const photo = item.photo;
              const isPlayer = !!item.player?._id;
              return (
                <TouchableOpacity
                  key={item.player?._id || idx}
                  disabled={!isPlayer}
                  activeOpacity={0.8}
                  onPress={() => isPlayer && navigation.navigate('PlayerDetail', { id: item.player._id })}
                  style={stS.contribRow}
                >
                  <View style={stS.contribAvatarWrap}>
                    {photo ? (
                      <Image source={{ uri: getImageUrl(photo) }} style={stS.contribAvatarImg} />
                    ) : (
                      <View style={stS.contribAvatarFb}>
                        <Text style={stS.contribAvatarLetter}>{item.name?.[0] || '?'}</Text>
                      </View>
                    )}
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={stS.contribName} numberOfLines={1}>{item.name}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={stS.contribStat}>{item.statVal} {item.statLabel}</Text>
                        <Text style={stS.contribPct}>{item.contributionPct}%</Text>
                      </View>
                    </View>
                    <View style={stS.contribBarBg}>
                      <View style={[stS.contribBarFill, { width: `${Math.min(100, item.contributionPct)}%` }]} />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            }) : (
              <Text style={{ color: Colors.textTertiary, fontSize: 12, textAlign: 'center', marginVertical: 10 }}>
                No {contribType} contribution data available
              </Text>
            )}
          </View>
        </View>


        {/* ═══════════════════════════════════════════════════
            4. RECENT FORM — LAST 6
        ═══════════════════════════════════════════════════ */}
        <SectionHeader title="Recent Form" sub="Last 6 Matches" />
        <View style={stS.chartCard}>
          <View style={stS.last6DotsRow}>
            {last6Matches.map((m, idx) => (
              <TouchableOpacity
                key={m._id || idx}
                activeOpacity={0.8}
                onPress={() => (m.matchId || m._id) && navigation.navigate('MatchSummary', { id: m.matchId || m._id })}
                style={[
                  stS.last6Dot,
                  m.result === 'W' ? stS.last6DotWin :
                  m.result === 'L' ? stS.last6DotLoss : stS.last6DotNR
                ]}
              >
                <Text style={[stS.last6DotText, m.result === 'W' && { color: '#000000' }]}>
                  {m.result || 'NR'}
                </Text>
              </TouchableOpacity>
            ))}
            {last6Matches.length === 0 && (
              <Text style={{ color: Colors.textTertiary, fontSize: 12 }}>No matches played yet</Text>
            )}
          </View>

          <View style={stS.cardDivider} />
          <View style={stS.last6SummaryRow}>
            <View>
              <Text style={stS.last6SummaryMain}>{last6Wins} Wins · {last6Losses} Losses</Text>
              <Text style={stS.last6SummarySub}>Last {last6Matches.length} Completed Matches</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={stS.last6WinRateVal}>{last6WinRate}%</Text>
              <Text style={stS.last6SummarySub}>Win Rate</Text>
            </View>
          </View>
        </View>


        {/* ═══════════════════════════════════════════════════
            5. BATTING FIRST vs CHASING
        ═══════════════════════════════════════════════════ */}
        <SectionHeader title="Batting First vs Chasing" />
        <View style={stS.chartCard}>
          <View style={stS.versusGrid}>
            <View style={stS.versusCol}>
              <View style={stS.versusBadge}>
                <Text style={stS.versusBadgeText}>BAT FIRST</Text>
              </View>
              <View style={stS.versusMetric}>
                <Text style={stS.versusVal}>{bFirstVsChasing.batFirst.matches}</Text>
                <Text style={stS.versusLabel}>Matches</Text>
              </View>
              <View style={stS.versusMetric}>
                <Text style={[stS.versusVal, { color: Colors.primary }]}>{bFirstVsChasing.batFirst.wins}</Text>
                <Text style={stS.versusLabel}>Wins</Text>
              </View>
              <View style={stS.versusMetric}>
                <Text style={[stS.versusVal, { color: Colors.primary }]}>{bFirstVsChasing.batFirst.winRate}%</Text>
                <Text style={stS.versusLabel}>Win Rate</Text>
              </View>
              <View style={stS.versusMetric}>
                <Text style={stS.versusVal}>{bFirstVsChasing.batFirst.avgScore}</Text>
                <Text style={stS.versusLabel}>Avg Score</Text>
              </View>
            </View>

            <View style={stS.versusDivider} />

            <View style={stS.versusCol}>
              <View style={[stS.versusBadge, { backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.15)' }]}>
                <Text style={[stS.versusBadgeText, { color: Colors.textSecondary }]}>CHASING</Text>
              </View>
              <View style={stS.versusMetric}>
                <Text style={stS.versusVal}>{bFirstVsChasing.chasing.matches}</Text>
                <Text style={stS.versusLabel}>Matches</Text>
              </View>
              <View style={stS.versusMetric}>
                <Text style={[stS.versusVal, { color: Colors.primary }]}>{bFirstVsChasing.chasing.wins}</Text>
                <Text style={stS.versusLabel}>Wins</Text>
              </View>
              <View style={stS.versusMetric}>
                <Text style={[stS.versusVal, { color: Colors.primary }]}>{bFirstVsChasing.chasing.winRate}%</Text>
                <Text style={stS.versusLabel}>Win Rate</Text>
              </View>
              <View style={stS.versusMetric}>
                <Text style={stS.versusVal}>{bFirstVsChasing.chasing.avgScore}</Text>
                <Text style={stS.versusLabel}>Avg Score</Text>
              </View>
            </View>
          </View>

          <View style={stS.cardDivider} />
          <View style={{ gap: 8, marginTop: 2 }}>
            <View style={stS.versusBarRow}>
              <Text style={stS.versusBarLabel}>Bat First</Text>
              <View style={stS.versusBarBg}>
                <View style={[stS.versusBarFill, { width: `${Math.min(100, bFirstVsChasing.batFirst.winRate)}%` }]} />
              </View>
              <Text style={stS.versusBarVal}>{bFirstVsChasing.batFirst.winRate}%</Text>
            </View>
            <View style={stS.versusBarRow}>
              <Text style={stS.versusBarLabel}>Chasing</Text>
              <View style={stS.versusBarBg}>
                <View style={[stS.versusBarFill, { width: `${Math.min(100, bFirstVsChasing.chasing.winRate)}%`, backgroundColor: 'rgba(255,255,255,0.7)' }]} />
              </View>
              <Text style={stS.versusBarVal}>{bFirstVsChasing.chasing.winRate}%</Text>
            </View>
          </View>
        </View>


        {/* ═══════════════════════════════════════════════════
            6. SEASON COMPARISON
        ═══════════════════════════════════════════════════ */}
        <SectionHeader title="Season Comparison" />
        <View style={[stS.chartCard, { paddingHorizontal: 0, paddingVertical: 0, overflow: 'hidden' }]}>
          <View style={stS.seasonTableHeader}>
            <Text style={[stS.seasonTableCell, stS.seasonTableHeadText, { flex: 1.2 }]}>Season</Text>
            <Text style={[stS.seasonTableCell, stS.seasonTableHeadText]}>Matches</Text>
            <Text style={[stS.seasonTableCell, stS.seasonTableHeadText]}>Wins</Text>
            <Text style={[stS.seasonTableCell, stS.seasonTableHeadText]}>Losses</Text>
            <Text style={[stS.seasonTableCell, stS.seasonTableHeadText, { textAlign: 'right' }]}>Win %</Text>
          </View>

          {seasonList.map((sea, idx) => {
            const isLatest = idx === 0;
            return (
              <View
                key={sea.season || idx}
                style={[
                  stS.seasonTableRow,
                  isLatest && stS.seasonTableRowHighlight,
                  idx === seasonList.length - 1 && { borderBottomWidth: 0 }
                ]}
              >
                <View style={[{ flex: 1.2, flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
                  <Text style={[stS.seasonTableCellText, isLatest && { color: Colors.primary, fontFamily: Typography.fontFamily.bold }]}>
                    {sea.season}
                  </Text>
                </View>
                <Text style={stS.seasonTableCellText}>{sea.matches}</Text>
                <Text style={[stS.seasonTableCellText, { color: Colors.primary }]}>{sea.wins}</Text>
                <Text style={stS.seasonTableCellText}>{sea.losses}</Text>
                <Text style={[stS.seasonTableCellText, { textAlign: 'right', color: Colors.primary, fontFamily: Typography.fontFamily.bold }]}>
                  {sea.winPct}%
                </Text>
              </View>
            );
          })}
        </View>

      </ScrollView>
    );
  };

  // ── Trophies Tab ────────────────────────────────────────────────────────
  const renderTrophiesTab = () => {
    const trophies = team?.trophies || [];

    if (trophies.length === 0) {
      return (
        <ScrollView contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}>
          <View style={styles.emptyTrophiesWrap}>
            <LinearGradient colors={[Colors.primaryAlpha20, 'transparent']} style={styles.emptyTrophiesCircle}>
              <Icon name="trophy-broken" size={44} color={Colors.primary} />
            </LinearGradient>
            <Text style={styles.emptyTrophiesTitle}>No Trophies Yet</Text>
            <Text style={styles.emptyTrophiesSub}>
              When {team?.name || 'this team'} wins tournaments, the championship trophies and titles will be showcased here!
            </Text>
          </View>
        </ScrollView>
      );
    }

    return (
      <ScrollView contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}>
        

        <View style={styles.trophiesGrid}>
          {trophies.map((tour, idx) => (
            <View key={tour._id || idx} style={styles.trophyCardGrid}>
              <LinearGradient
                colors={['rgba(255, 204, 0, 0.2)', 'rgba(255, 204, 0, 0.03)']}
                style={styles.trophyGridIconWrap}
              >
                <Icon name="trophy" size={26} color={Colors.primary} />
              </LinearGradient>

              <View style={styles.championPillGrid}>
                <Icon name="crown" size={9} color="#000" />
                <Text style={styles.championPillText}>CHAMPIONS</Text>
              </View>

              <Text style={styles.trophyGridName} numberOfLines={2}>{tour.name}</Text>

              {tour.city ? (
                <View style={styles.trophyGridMetaItem}>
                  <Icon name="map-marker-outline" size={11} color={Colors.textTertiary} />
                  <Text style={styles.trophyGridMetaText} numberOfLines={1}>{tour.city}</Text>
                </View>
              ) : tour.endDate ? (
                <View style={styles.trophyGridMetaItem}>
                  <Icon name="calendar-month-outline" size={11} color={Colors.textTertiary} />
                  <Text style={styles.trophyGridMetaText} numberOfLines={1}>
                    {new Date(tour.endDate).getFullYear()}
                  </Text>
                </View>
              ) : null}
            </View>
          ))}
        </View>
      </ScrollView>
    );
  };

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'players': return renderPlayersTab();
      case 'matches': return renderMatchesTab();
      case 'trophies': return renderTrophiesTab();
      case 'stats': return renderStatsTab();
      case 'leaderboard': return renderLeaderboardTab();
      case 'achievements': return renderAchievementsTab();
      case 'analytics': return renderAnalyticsTab();
      default: return null;
    }
  };

  if (isLoading && !selectedTeam) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.loadingFull}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const team = selectedTeam;
  const winPct = team?.stats?.matches > 0 ? ((team.stats.wins / team.stats.matches) * 100).toFixed(0) : '—';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>

      {/* ── TEAM HEADER ── */}
      <LinearGradient colors={['#111111', Colors.background]} style={styles.teamHeader}>
        {/* Nav row */}
        <View style={styles.navRow}>
          <TouchableOpacity style={styles.navBtn} onPress={() => navigation.goBack()}>
            <Icon name="arrow-left" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={styles.navActions}>
            {isMeMember && (
              <TouchableOpacity style={styles.navBtn} onPress={handleLeaveTeam}>
                <Icon name="logout" size={20} color={Colors.error} />
              </TouchableOpacity>
            )}
            {isManager ? (
              <>
                <TouchableOpacity style={styles.navBtn} onPress={openEditModal}>
                  <Icon name="pencil" size={20} color={Colors.textSecondary} />
                </TouchableOpacity>
                {/* <TouchableOpacity style={styles.navBtn} onPress={handleDeleteTeam}>
                  <Icon name="delete-outline" size={20} color={Colors.error} />
                </TouchableOpacity> */}
              </>
            ) : (
              <TouchableOpacity style={styles.navBtn} onPress={() => setShowReportModal(true)}>
                <Icon name="flag-outline" size={20} color={Colors.primary} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Team identity */}
        <View style={styles.teamIdentity}>
          <View style={styles.teamLogoWrap}>
            {team?.logo
              ? <Image source={{ uri: getImageUrl(team.logo) }} style={styles.teamLogo} />
              : (
                <LinearGradient colors={[Colors.primaryAlpha20, Colors.primaryAlpha10]} style={styles.teamLogoFb}>
                  <Text style={{ color: Colors.primary, fontFamily: Typography.fontFamily.bold, fontSize: 32 }}>
                    {(team?.name || 'T').trim().charAt(0).toUpperCase()}
                  </Text>
                </LinearGradient>
              )
            }
          </View>
          <View style={styles.teamMeta}>
            <Text style={styles.teamNameLarge} numberOfLines={1}>{team?.name || 'Team'}</Text>
            {team?.city && (
              <View style={styles.teamCityRow}>
                <Icon name="map-marker" size={12} color={Colors.primary} />
                <Text style={styles.teamCity}>{team.city}{team.state ? `, ${team.state}` : ''}</Text>
              </View>
            )}

            {/* Follow button below location */}
            <TouchableOpacity
              style={[styles.followInlineBtn, team?.isFollowing && styles.followInlineBtnActive]}
              onPress={handleFollow}
              activeOpacity={0.8}
            >
              <Icon
                name={team?.isFollowing ? 'check' : 'plus'}
                size={12}
                color={team?.isFollowing ? Colors.primary : '#FFFFFF'}
                style={{ marginRight: 4 }}
              />
              <Text style={[styles.followInlineBtnText, team?.isFollowing && styles.followInlineBtnTextActive]}>
                {team?.isFollowing ? 'Following' : 'Follow'} {team?.followerCount ? `· ${team.followerCount}` : ''}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats summary cards - Full Width Balanced Grid */}
        <View style={styles.statsSummaryGrid}>
          <View style={styles.summaryStatCard}>
            <Icon name="account-group" size={16} color={Colors.textSecondary} style={{ marginBottom: 3 }} />
            <Text style={styles.summaryStatValue}>{team?.players?.length || 0}</Text>
            <Text style={styles.summaryStatLabel}>PLAYERS</Text>
          </View>
          <View style={styles.summaryStatCard}>
            <Icon name="cricket" size={16} color={Colors.textSecondary} style={{ marginBottom: 3 }} />
            <Text style={styles.summaryStatValue}>{team?.stats?.matches || 0}</Text>
            <Text style={styles.summaryStatLabel}>MATCHES</Text>
          </View>
          <View style={styles.summaryStatCard}>
            <Icon name="trophy" size={16} color={Colors.primary} style={{ marginBottom: 3 }} />
            <Text style={[styles.summaryStatValue, { color: Colors.primary }]}>{team?.stats?.wins || 0}</Text>
            <Text style={styles.summaryStatLabel}>WINS</Text>
          </View>
          <View style={styles.summaryStatCard}>
            <Icon name="percent" size={16} color={Colors.accent} style={{ marginBottom: 3 }} />
            <Text style={[styles.summaryStatValue, { color: Colors.accent }]}>{winPct === '—' ? '0%' : `${winPct}%`}</Text>
            <Text style={styles.summaryStatLabel}>WIN RATE</Text>
          </View>
        </View>

        {/* ── Tab Bar (horizontal scroll) ── */}
        <KeyboardAwareScrollView enableOnAndroid={true} extraScrollHeight={20} keyboardShouldPersistTaps="handled"
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.detailTabBar}
        >
          {DETAIL_TABS.map(tab => {
            const active = activeTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                style={[styles.detailTab, active && styles.detailTabActive]}
                onPress={() => switchTab(tab.id)}
                activeOpacity={0.75}
              >
                <Icon name={tab.icon} size={14} color={active ? Colors.primary : Colors.textSecondary} />
                <Text style={[styles.detailTabText, active && styles.detailTabTextActive]}>{tab.label}</Text>
              </TouchableOpacity>
            );
          })}
        </KeyboardAwareScrollView>
      </LinearGradient>

      {/* ── TAB CONTENT ── */}
      <View style={styles.contentArea}>
        {renderActiveTab()}
      </View>

      {/* ── ADD PLAYER MODAL ── */}
      <Modal visible={addModalVisible} transparent animationType="slide" onRequestClose={() => setAddModalVisible(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setAddModalVisible(false)} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Add Player</Text>
            <Text style={styles.modalSub}>Enter mobile number to search</Text>

            <View style={styles.mobileRow}>
              <View style={[styles.modalInput, { flex: 1 }]}>
                <Icon name="phone" size={16} color={Colors.textTertiary} />
                <TextInput
                  style={styles.modalInputText}
                  placeholder="Mobile number"
                  placeholderTextColor={Colors.textTertiary}
                  value={mobile}
                  onChangeText={setMobile}
                  keyboardType="phone-pad"
                />
                {lookupLoading && <ActivityIndicator size="small" color={Colors.primary} style={{ marginLeft: 10 }} />}
              </View>
            </View>

            {lookupDone && (
              lookedUpPlayer ? (
                <View style={styles.foundPlayer}>
                  <Icon name="check-circle" size={16} color={Colors.success} />
                  <Text style={styles.foundPlayerText}>Found: {lookedUpPlayer.name}</Text>
                </View>
              ) : (
                <View style={styles.modalInput}>
                  <Icon name="account" size={16} color={Colors.textTertiary} />
                  <TextInput
                    style={styles.modalInputText}
                    placeholder="Player name (new player)"
                    placeholderTextColor={Colors.textTertiary}
                    value={playerName}
                    onChangeText={setPlayerName}
                  />
                </View>
              )
            )}

            <Text style={styles.modalLabel}>Role</Text>
            <KeyboardAwareScrollView enableOnAndroid={true} extraScrollHeight={20} keyboardShouldPersistTaps="handled" horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.roleRow}>
              {ROLE_OPTIONS.map(r => (
                <TouchableOpacity
                  key={r}
                  style={[styles.roleChip, addRole === r && styles.roleChipActive]}
                  onPress={() => setAddRole(r)}
                >
                  <Icon name={ROLE_ICONS[r]} size={12} color={addRole === r ? '#000' : Colors.textSecondary} />
                  <Text style={[styles.roleChipText, addRole === r && styles.roleChipTextActive]}>{ROLE_LABELS[r]}</Text>
                </TouchableOpacity>
              ))}
            </KeyboardAwareScrollView>

            <TouchableOpacity onPress={handleAddPlayer} disabled={adding || (!lookupDone && !mobile)}>
              <LinearGradient colors={Colors.primaryGradient} style={styles.modalSubmitBtn}>
                {adding ? (
                  <>
                    <ActivityIndicator size="small" color="#000" />
                    <Text style={[styles.modalSubmitText, { marginLeft: 8 }]}>Adding...</Text>
                  </>
                ) : (
                  <>
                    <Icon name="check" size={16} color="#000" />
                    <Text style={styles.modalSubmitText}>Add Player</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
            <View style={{ height: 20 }} />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── ROLE MODAL ── */}
      <Modal visible={roleModalVisible} transparent animationType="slide" onRequestClose={() => setRoleModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setRoleModalVisible(false)} />
          <View style={[styles.modalSheet, { borderRadius: 20 }]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Change Role</Text>
            <Text style={styles.modalSub}>{selectedPlayerToEdit?.player?.name}</Text>
            {ROLE_OPTIONS.map(r => (
              <TouchableOpacity
                key={r}
                style={[styles.roleRow2, selectedPlayerToEdit?.role === r && styles.roleRow2Active]}
                onPress={() => handleUpdateRole(r)}
                disabled={updatingRole}
              >
                <Icon name={ROLE_ICONS[r]} size={18} color={selectedPlayerToEdit?.role === r ? '#000' : Colors.textSecondary} />
                <Text style={[styles.roleRow2Text, selectedPlayerToEdit?.role === r && styles.roleRow2TextActive]}>
                  {ROLE_LABELS[r]}
                </Text>
                {selectedPlayerToEdit?.role === r && <Icon name="check" size={16} color="#000" style={{ marginLeft: 'auto' }} />}
              </TouchableOpacity>
            ))}
            <View style={{ height: 24 }} />
          </View>
        </View>
      </Modal>

      {/* ── EDIT TEAM MODAL ── */}
      <Modal visible={editModalVisible} transparent animationType="slide" onRequestClose={() => setEditModalVisible(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setEditModalVisible(false)} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Edit Team</Text>

            <TouchableOpacity style={styles.logoPickerBtn} onPress={handlePickLogo}>
              {editLogo
                ? <Image source={{ uri: editLogo.uri }} style={styles.logoPickerImg} />
                : team?.logo
                  ? <Image source={{ uri: getImageUrl(team.logo) }} style={styles.logoPickerImg} />
                  : <View style={styles.logoPickerFb}><Icon name="camera" size={24} color={Colors.primary} /></View>
              }
              <View style={styles.logoPickerOverlay}><Icon name="camera-plus" size={14} color="#fff" /></View>
            </TouchableOpacity>
            <Text style={{ color: Colors.textSecondary, fontSize: 12, textAlign: 'center', marginBottom: 16 }}>Max 3 MB</Text>

            <View style={styles.modalInput}>
              <Icon name="shield" size={16} color={Colors.textTertiary} />
              <TextInput style={styles.modalInputText} placeholder="Team name" placeholderTextColor={Colors.textTertiary} value={editName} onChangeText={setEditName} />
            </View>
            <View style={{ zIndex: 100, marginBottom: 10 }}>
              <LocationAutocomplete
                value={editCity}
                onChangeText={setEditCity}
                onSelectLocation={(loc) => {
                  setEditCity(loc ? loc.name : '');
                  if (loc && loc.state) setEditState(loc.state);
                }}
                placeholder="Search City..."
                variant="outlined"
              />
            </View>
            <View style={styles.modalInput}>
              <Icon name="map" size={16} color={Colors.textTertiary} />
              <TextInput style={styles.modalInputText} placeholder="State" placeholderTextColor={Colors.textTertiary} value={editState} onChangeText={setEditState} />
            </View>

            <TouchableOpacity onPress={handleUpdateTeam} disabled={updatingTeam}>
              <LinearGradient colors={Colors.primaryGradient} style={styles.modalSubmitBtn}>
                {updatingTeam ? <ActivityIndicator size="small" color="#000" />
                  : <><Icon name="check" size={16} color="#000" /><Text style={styles.modalSubmitText}>Save Changes</Text></>}
              </LinearGradient>
            </TouchableOpacity>
            <View style={{ height: 24 }} />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Report Modal */}
      <Modal visible={showReportModal} animationType="slide" transparent onRequestClose={() => setShowReportModal(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalSheet, { maxHeight: '90%', paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={styles.modalHandle} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={styles.modalTitle}>Report Team</Text>
              <TouchableOpacity onPress={() => setShowReportModal(false)} style={{ padding: 4 }}>
                <Icon name="close" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={{ fontSize: 14, color: Colors.textSecondary, fontFamily: 'Outfit-Regular', marginBottom: 16, lineHeight: 22 }}>
                Please select a reason for reporting this team profile. Our team will review the team logo, name, and squad details and take appropriate action.
              </Text>

              <View style={{ gap: 8, marginBottom: 20 }}>
                {[
                  { key: 'inappropriate_name', label: 'Inappropriate Team Name' },
                  { key: 'offensive_photo', label: 'Offensive Team Logo' },
                  { key: 'harassment', label: 'Harassment or Abuse' },
                  { key: 'spam', label: 'Spam or Fake Team' },
                  { key: 'other', label: 'Other Reason' }
                ].map(item => {
                  const isSelected = reportReason === item.key;
                  return (
                    <TouchableOpacity
                      key={item.key}
                      style={{
                        flexDirection: 'row', alignItems: 'center', padding: 14,
                        backgroundColor: isSelected ? 'rgba(255,204,0,0.1)' : Colors.surface,
                        borderRadius: 12, borderWidth: 1, borderColor: isSelected ? Colors.primary : Colors.border
                      }}
                      onPress={() => setReportReason(item.key)}
                    >
                      <View style={{
                        width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: isSelected ? Colors.primary : Colors.textTertiary,
                        justifyContent: 'center', alignItems: 'center', marginRight: 12
                      }}>
                        {isSelected && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary }} />}
                      </View>
                      <Text style={{ fontSize: 15, color: Colors.textPrimary, fontFamily: isSelected ? 'Outfit-SemiBold' : 'Outfit-Regular' }}>
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={{ fontSize: 13, color: Colors.textSecondary, fontFamily: 'Outfit-SemiBold', marginBottom: 8, marginLeft: 4 }}>
                Additional Details (Optional)
              </Text>
              <View style={{
                height: 80, backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.border,
                paddingHorizontal: 12, marginBottom: 24
              }}>
                <TextInput
                  style={{ flex: 1, color: '#FFF', fontSize: 14, textAlignVertical: 'top', paddingTop: 8 }}
                  placeholder="Explain why you are flagging this team..."
                  placeholderTextColor={Colors.textTertiary}
                  value={reportDetails}
                  onChangeText={setReportDetails}
                  multiline
                  numberOfLines={3}
                />
              </View>

              <TouchableOpacity
                style={{
                  height: 48, borderRadius: 12, backgroundColor: Colors.primary,
                  justifyContent: 'center', alignItems: 'center', flexDirection: 'row'
                }}
                onPress={handleReportTeam}
                disabled={reportLoading}
              >
                {reportLoading ? (
                  <ActivityIndicator color={Colors.background} size="small" />
                ) : (
                  <Text style={{ color: Colors.background, fontSize: 16, fontFamily: 'Outfit-Bold' }}>Submit Report</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </SafeAreaView>
  );
};

// ── Helper components ─────────────────────────────────────────────────────────

const MiniStat = ({ label, value }) => (
  <View style={styles.miniStat}>
    <Text style={styles.miniStatVal}>{value}</Text>
    <Text style={styles.miniStatLabel}>{label}</Text>
  </View>
);

const BigStat = ({ label, value, primary, danger }) => (
  <View style={styles.bigStat}>
    <Text style={[styles.bigStatVal, primary && { color: Colors.primary }, danger && { color: Colors.error }]}>{value}</Text>
    <Text style={styles.bigStatLabel}>{label}</Text>
  </View>
);

const QuickStat = ({ label, value, icon, primary }) => (
  <View style={styles.quickStat}>
    <Icon name={icon} size={12} color={primary ? Colors.primary : Colors.textTertiary} />
    <Text style={[styles.quickStatVal, primary && { color: Colors.primary }]}>{value}</Text>
    <Text style={styles.quickStatLabel}>{label}</Text>
  </View>
);

const ResultBlock = ({ pct, label, color }) => (
  <View style={styles.resultBlock}>
    <Text style={[styles.resultBlockPct, { color }]}>{pct.toFixed(0)}%</Text>
    <View style={[styles.resultBlockBar, { backgroundColor: `${color}22` }]}>
      <View style={[styles.resultBlockFill, { backgroundColor: color, height: `${Math.max(pct, 2)}%` }]} />
    </View>
    <Text style={styles.resultBlockLabel}>{label}</Text>
  </View>
);

const LoadingState = () => (
  <View style={styles.loadingTab}>
    <ActivityIndicator size="large" color={Colors.primary} />
  </View>
);

const EmptyState = ({ icon, label, small }) => (
  <View style={[styles.emptyTab, small && { paddingVertical: 30 }]}>
    <Icon name={icon} size={small ? 28 : 40} color={Colors.primaryAlpha30} />
    <Text style={styles.emptyTabText}>{label}</Text>
  </View>
);

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  loadingFull: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },

  // Header
  teamHeader: {
    paddingHorizontal: 16,
    paddingTop: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  navBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  navActions: { flexDirection: 'row', gap: 8 },

  teamIdentity: { flexDirection: 'row', gap: 14, marginBottom: 14, alignItems: 'center' },
  teamLogoWrap: { position: 'relative' },
  teamLogo: { width: 72, height: 72, borderRadius: 36, borderWidth: 2, borderColor: Colors.primaryAlpha30 },
  teamLogoFb: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Colors.primaryAlpha30 },
  winPctBadge: {
    position: 'absolute', bottom: -4, right: -4,
    backgroundColor: Colors.primary, borderRadius: 10,
    paddingHorizontal: 5, paddingVertical: 1,
  },
  winPctText: { color: '#000', fontFamily: Typography.fontFamily.bold, fontSize: 9 },
  teamMeta: { flex: 1, justifyContent: 'center' },
  teamNameLarge: { color: '#fff', fontFamily: Typography.fontFamily.bold, fontSize: 20, marginBottom: 2 },
  teamCityRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  teamCity: { color: Colors.textSecondary, fontFamily: Typography.fontFamily.medium, fontSize: 12 },

  followInlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  followInlineBtnActive: {
    backgroundColor: 'rgba(255, 204, 0, 0.12)',
    borderColor: 'rgba(255, 204, 0, 0.4)',
  },
  followInlineBtnText: {
    color: '#FFFFFF',
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: 11,
  },
  followInlineBtnTextActive: {
    color: Colors.primary,
    fontFamily: Typography.fontFamily.bold,
  },

  // Full-width Balanced Stats Grid
  statsSummaryGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
    width: '100%',
  },
  summaryStatCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  summaryStatValue: {
    color: '#fff',
    fontFamily: Typography.fontFamily.bold,
    fontSize: 14,
    marginBottom: 1,
  },
  summaryStatLabel: {
    color: Colors.textTertiary,
    fontFamily: Typography.fontFamily.medium,
    fontSize: 9,
    letterSpacing: 0.5,
  },

  // Trophies tab
  trophiesHeaderBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 204, 0, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 204, 0, 0.25)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  trophiesBannerTitle: { color: '#fff', fontFamily: Typography.fontFamily.bold, fontSize: 15 },
  trophiesBannerSub: { color: Colors.textSecondary, fontFamily: Typography.fontFamily.regular, fontSize: 11, marginTop: 2 },
  trophyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    marginBottom: 10,
  },
  trophyIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 204, 0, 0.3)',
    marginRight: 12,
  },
  trophyInfo: { flex: 1 },
  trophyBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  championPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.primary,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  championPillText: { color: '#000', fontFamily: Typography.fontFamily.bold, fontSize: 9, letterSpacing: 0.5 },
  formatPill: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  formatPillText: { color: Colors.textSecondary, fontFamily: Typography.fontFamily.medium, fontSize: 9 },
  trophyTourName: { color: '#fff', fontFamily: Typography.fontFamily.bold, fontSize: 15, marginBottom: 4 },
  trophiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  trophyCardGrid: {
    width: (SCREEN_W - 38) / 2,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 204, 0, 0.2)',
    alignItems: 'center',
    marginBottom: 2,
  },
  trophyGridIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 204, 0, 0.3)',
    marginBottom: 8,
  },
  championPillGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.primary,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginBottom: 6,
  },
  trophyGridName: {
    color: '#fff',
    fontFamily: Typography.fontFamily.bold,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 4,
  },
  trophyGridMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  trophyGridMetaText: {
    color: Colors.textTertiary,
    fontFamily: Typography.fontFamily.regular,
    fontSize: 11,
  },
  trophyMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  trophyMetaText: { color: Colors.textTertiary, fontFamily: Typography.fontFamily.regular, fontSize: 11 },
  emptyTrophiesWrap: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 24 },
  emptyTrophiesCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.primaryAlpha30,
  },
  emptyTrophiesTitle: { color: '#fff', fontFamily: Typography.fontFamily.bold, fontSize: 18, marginBottom: 6 },
  emptyTrophiesSub: { color: Colors.textSecondary, fontFamily: Typography.fontFamily.regular, fontSize: 13, textAlign: 'center', lineHeight: 20 },

  inviteCodeWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.backgroundCard, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    flex: 1,
  },
  inviteCodeText: { color: Colors.textSecondary, fontFamily: Typography.fontFamily.bold, fontSize: 12, letterSpacing: 1 },

  // Detail Tab Bar
  detailTabBar: { gap: 20, paddingVertical: 8, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)', marginBottom: 6 },
  detailTab: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingBottom: 10,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  detailTabActive: { borderBottomColor: Colors.primary },
  detailTabText: { color: Colors.textSecondary, fontFamily: Typography.fontFamily.semiBold, fontSize: 14 },
  detailTabTextActive: { color: Colors.primary, fontFamily: Typography.fontFamily.bold, fontSize: 14 },

  contentArea: { flex: 1, backgroundColor: Colors.background },
  tabContent: { padding: 14, paddingBottom: 50, gap: 10 },

  // Players tab
  playerRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.backgroundCard, borderRadius: 14, padding: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', gap: 10,
  },
  playerRowMe: { borderColor: Colors.primaryAlpha30, backgroundColor: Colors.primaryAlpha10 },
  playerAvatarWrap: { position: 'relative' },
  playerAvatar: { width: 48, height: 48, borderRadius: 24 },
  playerAvatarFb: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.primaryAlpha10, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.primaryAlpha30 },
  playerAvatarFbMe: { borderColor: Colors.primary, backgroundColor: 'rgba(154,188,47,0.2)' },
  playerAvatarLetter: { color: Colors.primary, fontFamily: Typography.fontFamily.bold, fontSize: 18 },
  roleBadge: {
    position: 'absolute', bottom: -2, right: -2,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: '#1A2F45', borderWidth: 1.5, borderColor: Colors.backgroundCard,
    alignItems: 'center', justifyContent: 'center',
  },
  roleBadgeCap: { backgroundColor: 'rgba(255,215,0,0.2)' },
  roleBadgeVC: { backgroundColor: 'rgba(144,202,249,0.2)' },
  roleBadgeWK: { backgroundColor: Colors.primaryAlpha10 },

  playerDetailsWrap: { flex: 1, gap: 3 },
  playerNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  playerName: { color: '#fff', fontFamily: Typography.fontFamily.bold, fontSize: 13, flexShrink: 1 },
  playerNameMe: { color: Colors.primary },
  youBadge: { color: Colors.primary, fontFamily: Typography.fontFamily.medium, fontSize: 11 },

  playerTagRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  playerRoleTag: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: Colors.backgroundElevated, borderRadius: 5,
    paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  playerRoleTagCap: { borderColor: 'rgba(255,215,0,0.4)', backgroundColor: 'rgba(255,215,0,0.08)' },
  playerRoleTagVC: { borderColor: 'rgba(144,202,249,0.4)', backgroundColor: 'rgba(144,202,249,0.08)' },
  playerRoleTagText: { color: Colors.textTertiary, fontFamily: Typography.fontFamily.semiBold, fontSize: 9 },
  playerStyleText: { color: Colors.textTertiary, fontFamily: Typography.fontFamily.regular, fontSize: 10, flexShrink: 1 },

  playerMiniStats: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  miniStatDivider: { width: 1, height: 14, backgroundColor: 'rgba(255,255,255,0.1)', marginHorizontal: 6 },
  miniStat: { alignItems: 'center', minWidth: 28 },
  miniStatVal: { color: '#fff', fontFamily: Typography.fontFamily.bold, fontSize: 11 },
  miniStatLabel: { color: Colors.textTertiary, fontFamily: Typography.fontFamily.regular, fontSize: 9 },

  playerActions: { gap: 6, alignItems: 'center' },
  actionIconBtn: {
    padding: 6,
    alignItems: 'center', justifyContent: 'center',
  },
  actionIconBtnDanger: { borderColor: 'rgba(244,67,54,0.3)', backgroundColor: 'rgba(244,67,54,0.08)' },

  addPlayerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1, borderColor: Colors.primaryAlpha30, borderStyle: 'dashed',
    borderRadius: 14, paddingVertical: 14, backgroundColor: Colors.primaryAlpha10,
  },
  addPlayerBtnText: { color: Colors.primary, fontFamily: Typography.fontFamily.semiBold, fontSize: 14 },

  addPlayerFloatingBtn: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    zIndex: 10,
  },

  // Matches tab
  matchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.backgroundCard, borderRadius: 14, padding: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  resultBadge: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  winBadge: { backgroundColor: 'rgba(46,213,115,0.15)', borderWidth: 1, borderColor: Colors.success },
  lossBadge: { backgroundColor: 'rgba(244,67,54,0.15)', borderWidth: 1, borderColor: Colors.error },
  nrBadge: { backgroundColor: Colors.backgroundElevated, borderWidth: 1, borderColor: Colors.border },
  liveBadge: { backgroundColor: Colors.primaryAlpha10, borderWidth: 1, borderColor: Colors.primary },
  resultBadgeText: { color: '#fff', fontFamily: Typography.fontFamily.bold, fontSize: 11 },
  matchRowInfo: { flex: 1 },
  matchRowTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  opponentLogoWrap: {},
  opponentLogo: { width: 28, height: 28, borderRadius: 14 },
  opponentLogoFb: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.backgroundElevated, alignItems: 'center', justifyContent: 'center' },
  opponentLogoLetter: { color: Colors.primary, fontFamily: Typography.fontFamily.bold, fontSize: 11 },
  matchVsLabel: { color: '#fff', fontFamily: Typography.fontFamily.bold, fontSize: 13 },
  matchFormat: { color: Colors.textTertiary, fontFamily: Typography.fontFamily.regular, fontSize: 10 },
  matchResultText: { fontFamily: Typography.fontFamily.medium, fontSize: 11 },
  matchDate: { color: Colors.textTertiary, fontFamily: Typography.fontFamily.medium, fontSize: 10 },

  // Stats tab
  statsCard: {
    backgroundColor: Colors.backgroundCard, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  statsCardTitle: { color: '#fff', fontFamily: Typography.fontFamily.bold, fontSize: 14, marginBottom: 12 },
  statsGrid: { flexDirection: 'row', justifyContent: 'space-around' },
  bigStat: { alignItems: 'center' },
  bigStatVal: { color: '#fff', fontFamily: Typography.fontFamily.bold, fontSize: 22 },
  bigStatLabel: { color: Colors.textTertiary, fontFamily: Typography.fontFamily.regular, fontSize: 11, marginTop: 2 },

  winRateWrap: { marginTop: 12 },
  winRateBarBg: { height: 8, backgroundColor: Colors.backgroundElevated, borderRadius: 4, overflow: 'hidden', marginBottom: 6 },
  winRateBarFill: { height: '100%', backgroundColor: Colors.success, borderRadius: 4 },
  winRateLabels: { flexDirection: 'row', justifyContent: 'space-between' },

  formatRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  formatTag: { backgroundColor: Colors.primaryAlpha10, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, minWidth: 50, alignItems: 'center' },
  formatTagText: { color: Colors.primary, fontFamily: Typography.fontFamily.bold, fontSize: 10 },
  formatBarWrap: { flex: 1 },
  formatBarBg: { height: 6, backgroundColor: Colors.backgroundElevated, borderRadius: 3, overflow: 'hidden' },
  formatBarFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 3 },
  formatStat: { color: Colors.textSecondary, fontFamily: Typography.fontFamily.medium, fontSize: 11, minWidth: 60, textAlign: 'right' },
  // Leaderboard
  lbTabRow: { flexDirection: 'row', marginBottom: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  lbTab: { flex: 1, alignItems: 'center', paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  lbTabActive: { borderBottomColor: Colors.primary },
  lbTabText: { color: Colors.textSecondary, fontFamily: Typography.fontFamily.semiBold, fontSize: 13 },
  lbTabTextActive: { color: Colors.primary, fontFamily: Typography.fontFamily.bold, fontSize: 13 },
  lbSection: { marginBottom: 16 },
  lbSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  lbSectionTitle: { color: '#fff', fontFamily: Typography.fontFamily.bold, fontSize: 15 },
  lbRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.backgroundCard, borderRadius: 12, padding: 10, marginBottom: 6,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  lbRank: { width: 26, height: 26, borderRadius: 13, backgroundColor: Colors.backgroundElevated, alignItems: 'center', justifyContent: 'center' },
  lbRankTop: { backgroundColor: 'rgba(255,215,0,0.12)' },
  lbRankText: { color: Colors.textSecondary, fontFamily: Typography.fontFamily.bold, fontSize: 12 },
  lbAvatar: {},
  lbAvatarImg: { width: 36, height: 36, borderRadius: 18 },
  lbAvatarFb: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primaryAlpha10, alignItems: 'center', justifyContent: 'center' },
  lbAvatarLetter: { color: Colors.primary, fontFamily: Typography.fontFamily.bold, fontSize: 13 },
  lbInfo: { flex: 1 },
  lbName: { color: '#fff', fontFamily: Typography.fontFamily.bold, fontSize: 13 },
  lbMeta: { color: Colors.textTertiary, fontFamily: Typography.fontFamily.regular, fontSize: 10 },
  lbPrimaryVal: { alignItems: 'center' },
  lbPrimaryValNum: { color: Colors.primary, fontFamily: Typography.fontFamily.bold, fontSize: 18 },
  lbPrimaryValLabel: { color: Colors.textTertiary, fontFamily: Typography.fontFamily.regular, fontSize: 9 },

  // Achievements
  achGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  achCard: {
    width: (SCREEN_W - 14 * 2 - 10) / 2, backgroundColor: Colors.backgroundCard,
    borderRadius: 14, padding: 12, alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  achCardUnlocked: { borderColor: 'rgba(255,215,0,0.4)', backgroundColor: 'rgba(255,215,0,0.05)' },
  achIconWrap: { width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.backgroundElevated, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  achIconWrapUnlocked: { borderColor: 'rgba(255,215,0,0.4)', backgroundColor: 'rgba(255,215,0,0.1)' },
  achLabel: { color: Colors.textSecondary, fontFamily: Typography.fontFamily.bold, fontSize: 12, textAlign: 'center' },
  achLabelUnlocked: { color: '#fff' },
  achDesc: { color: Colors.textTertiary, fontFamily: Typography.fontFamily.regular, fontSize: 10, textAlign: 'center' },
  achProgressBg: { width: '100%', height: 4, backgroundColor: Colors.backgroundElevated, borderRadius: 2, overflow: 'hidden' },
  achProgressFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 2 },
  achProgress: { color: Colors.textTertiary, fontFamily: Typography.fontFamily.medium, fontSize: 10 },
  achUnlockedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primaryAlpha10, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: Colors.primaryAlpha30 },
  achUnlockedText: { color: Colors.primary, fontFamily: Typography.fontFamily.bold, fontSize: 10 },

  // Analytics
  analyticsCard: {
    backgroundColor: Colors.backgroundCard, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  resultBreakdownRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 110, marginTop: 12, paddingHorizontal: 10 },
  resultBlock: { alignItems: 'center', width: 60 },
  resultBlockPct: { fontFamily: Typography.fontFamily.bold, fontSize: 14, marginBottom: 6 },
  resultBlockBar: { width: 40, height: 70, borderRadius: 8, justifyContent: 'flex-end', overflow: 'hidden' },
  resultBlockFill: { width: '100%', borderRadius: 8 },
  resultBlockLabel: { color: Colors.textTertiary, fontFamily: Typography.fontFamily.medium, fontSize: 11, marginTop: 8 },

  formRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  formDot: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  formDotWin: { backgroundColor: 'rgba(46,213,115,0.15)', borderWidth: 1, borderColor: Colors.success },
  formDotLoss: { backgroundColor: 'rgba(244,67,54,0.15)', borderWidth: 1, borderColor: Colors.error },
  formDotNR: { backgroundColor: Colors.backgroundElevated, borderWidth: 1, borderColor: Colors.border },
  formDotText: { color: '#fff', fontFamily: Typography.fontFamily.bold, fontSize: 11 },
  noDataText: { color: Colors.textTertiary, fontFamily: Typography.fontFamily.regular, fontSize: 12, marginTop: 8 },

  barChartWrap: { flexDirection: 'row', alignItems: 'flex-end', gap: 14, height: 130, marginTop: 8, justifyContent: 'space-around' },
  barColumn: { alignItems: 'center', flex: 1 },
  barValue: { color: Colors.primary, fontFamily: Typography.fontFamily.bold, fontSize: 12, marginBottom: 4 },
  barBg: { width: '70%', height: 100, backgroundColor: Colors.backgroundElevated, borderRadius: 6, overflow: 'hidden', justifyContent: 'flex-end' },
  barFill: { width: '100%', borderRadius: 6 },
  barLabel: { color: Colors.textTertiary, fontFamily: Typography.fontFamily.medium, fontSize: 10, marginTop: 4 },

  // Empty/Loading states
  emptyTab: { alignItems: 'center', justifyContent: 'center', paddingVertical: 50, gap: 8 },
  emptyTabText: { color: Colors.textTertiary, fontFamily: Typography.fontFamily.medium, fontSize: 13 },
  loadingTab: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: Colors.backgroundCard,
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 20, paddingTop: 12,
  },
  modalHandle: { width: 38, height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalTitle: { color: '#fff', fontFamily: Typography.fontFamily.bold, fontSize: 18, marginBottom: 4 },
  modalSub: { color: Colors.textSecondary, fontFamily: Typography.fontFamily.regular, fontSize: 13, marginBottom: 14 },
  modalLabel: { color: Colors.textSecondary, fontFamily: Typography.fontFamily.semiBold, fontSize: 12, marginBottom: 8, marginTop: 4 },

  modalInput: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.background, borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 14, height: 50, marginBottom: 10,
  },
  modalInputText: { flex: 1, color: '#fff', fontFamily: Typography.fontFamily.regular, fontSize: 14, height: '100%' },

  mobileRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  lookupBtn: {
    backgroundColor: Colors.primary, borderRadius: 12,
    paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center',
  },
  lookupBtnText: { color: '#000', fontFamily: Typography.fontFamily.bold, fontSize: 13 },

  foundPlayer: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(46,213,115,0.1)', borderRadius: 10,
    borderWidth: 1, borderColor: Colors.success,
    paddingHorizontal: 14, paddingVertical: 10, marginBottom: 10,
  },
  foundPlayerText: { color: Colors.success, fontFamily: Typography.fontFamily.semiBold, fontSize: 13 },

  roleRow: { gap: 8, paddingVertical: 4, marginBottom: 14 },
  roleChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  roleChipActive: { borderColor: Colors.primary, backgroundColor: Colors.primary, ...Shadows.glow },
  roleChipText: { color: Colors.textSecondary, fontFamily: Typography.fontFamily.medium, fontSize: 12 },
  roleChipTextActive: { color: '#000', fontFamily: Typography.fontFamily.bold, fontSize: 12 },

  roleRow2: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingVertical: 14,
    borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.05)', marginBottom: 8,
  },
  roleRow2Active: { borderColor: Colors.primary, backgroundColor: Colors.primary, ...Shadows.glow },
  roleRow2Text: { color: Colors.textSecondary, fontFamily: Typography.fontFamily.medium, fontSize: 14 },
  roleRow2TextActive: { color: '#000', fontFamily: Typography.fontFamily.bold, fontSize: 14 },

  modalSubmitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 52, borderRadius: 14, marginTop: 6 },
  modalSubmitText: { color: '#000', fontFamily: Typography.fontFamily.bold, fontSize: 15 },

  logoPickerBtn: {
    width: 80, height: 80, borderRadius: 40, alignSelf: 'center',
    marginBottom: 16, position: 'relative', overflow: 'hidden',
    borderWidth: 2, borderColor: Colors.primaryAlpha30,
  },
  logoPickerImg: { width: '100%', height: '100%' },
  logoPickerFb: { flex: 1, backgroundColor: Colors.primaryAlpha10, alignItems: 'center', justifyContent: 'center' },
  logoPickerOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', paddingVertical: 4,
  },
});

// ── Stats Tab Styles ──────────────────────────────────────────────────────────
const stS = StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10, marginTop: 18,
  },
  sectionTitle: {
    fontSize: 11, fontFamily: Typography.fontFamily.bold,
    color: Colors.textTertiary, letterSpacing: 1.2, textTransform: 'uppercase',
  },
  sectionSub: {
    fontSize: 11, fontFamily: Typography.fontFamily.medium,
    color: Colors.textTertiary,
  },

  chartCard: {
    backgroundColor: Colors.surface, borderRadius: 16,
    marginBottom: 4, paddingVertical: 16, paddingHorizontal: 14, overflow: 'hidden',
  },
  cardDivider: {
    height: 1, backgroundColor: Colors.border, marginVertical: 12, marginHorizontal: -14,
  },
  chartSubLabel: {
    fontSize: 10, fontFamily: Typography.fontFamily.bold,
    color: Colors.textTertiary, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8,
  },

  overviewRow: { flexDirection: 'row', paddingVertical: 4 },
  overviewStat: { flex: 1, alignItems: 'center' },
  overviewVal: {
    fontSize: 28, fontFamily: Typography.fontFamily.bold,
    color: Colors.textPrimary, lineHeight: 32,
  },
  overviewLabel: {
    fontSize: 11, fontFamily: Typography.fontFamily.regular,
    color: Colors.textTertiary, marginTop: 2,
  },
  overviewDivider: { width: 1, backgroundColor: Colors.border, marginVertical: 6 },

  progressBg: {
    flexDirection: 'row', height: 6, borderRadius: 3, overflow: 'hidden',
    backgroundColor: Colors.surfaceVariant, marginTop: 8,
  },
  progressWin: { backgroundColor: Colors.primary, borderRadius: 3 },
  progressLoss: { backgroundColor: 'rgba(255,255,255,0.2)' },
  progressNR: { backgroundColor: 'rgba(255,255,255,0.08)' },
  progressLabels: { flexDirection: 'row', marginTop: 8, gap: 14 },
  progressLegItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  progressLegDot: { width: 8, height: 8, borderRadius: 4 },
  progressLegText: {
    fontSize: 11, fontFamily: Typography.fontFamily.medium, color: Colors.textTertiary,
  },
  pieWrap: { alignItems: 'center', marginTop: 4, marginBottom: -8 },

  miniGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  miniGridItem: {
    flex: 1, minWidth: '22%', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 4,
  },
  miniGridVal: {
    fontSize: 20, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary, lineHeight: 24,
  },
  miniGridLabel: {
    fontSize: 10, fontFamily: Typography.fontFamily.regular,
    color: Colors.textTertiary, marginTop: 2, textAlign: 'center',
  },

  formRow: { flexDirection: 'row', gap: 7, paddingBottom: 2, paddingTop: 2, marginBottom: 8 },
  formDot: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  formDotWin: { backgroundColor: Colors.primary },
  formDotLoss: { backgroundColor: 'rgba(255,255,255,0.15)' },
  formDotNR: { backgroundColor: Colors.surfaceVariant },
  formDotTie: { backgroundColor: 'rgba(255,255,255,0.3)' },
  formDotText: { fontSize: 11, fontFamily: Typography.fontFamily.bold, color: '#fff' },
  formOpponents: {
    fontSize: 10, fontFamily: Typography.fontFamily.regular, color: Colors.textTertiary, marginBottom: 4,
  },

  phaseVisRow: {
    flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', paddingVertical: 8,
  },
  phaseCol: { flex: 1, alignItems: 'center', gap: 4 },
  phaseRpoVal: { fontSize: 22, fontFamily: Typography.fontFamily.bold, lineHeight: 26 },
  phaseRpoUnit: { fontSize: 10, fontFamily: Typography.fontFamily.regular, color: Colors.textTertiary },
  phaseVertBg: {
    width: 28, borderRadius: 6, backgroundColor: Colors.surfaceVariant, justifyContent: 'flex-end', overflow: 'hidden',
  },
  phaseVertFill: { width: '100%', borderRadius: 6 },
  phaseLabelBadge: { borderRadius: 6, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2, marginTop: 4 },
  phaseLabelBadgeText: { fontSize: 9, fontFamily: Typography.fontFamily.bold, letterSpacing: 0.8 },
  phaseFullLabel: { fontSize: 9, fontFamily: Typography.fontFamily.regular, color: Colors.textTertiary },

  perfSectionBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10, backgroundColor: Colors.surfaceVariant,
  },
  perfSectionLabel: {
    fontSize: 10, fontFamily: Typography.fontFamily.bold, color: Colors.textTertiary, letterSpacing: 1.2,
  },
  perfRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 11, paddingHorizontal: 14, gap: 10,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  perfRank: { width: 22, alignItems: 'center' },
  perfRankNum: { fontSize: 16, fontFamily: Typography.fontFamily.bold, color: Colors.textTertiary },
  lbAvatar: { width: 36, height: 36, borderRadius: 18, overflow: 'hidden', backgroundColor: Colors.surfaceVariant },
  perfInfo: { flex: 1 },
  perfName: { fontSize: 13, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary },
  perfMeta: { fontSize: 11, fontFamily: Typography.fontFamily.regular, color: Colors.textTertiary, marginTop: 1 },
  perfPrimary: { alignItems: 'flex-end', minWidth: 44 },
  perfPrimaryVal: { fontSize: 20, fontFamily: Typography.fontFamily.bold, color: Colors.primary, lineHeight: 24 },
  perfPrimaryLabel: { fontSize: 10, fontFamily: Typography.fontFamily.regular, color: Colors.textTertiary },

  recordsGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  recordItem: { width: '33.33%', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 4 },
  recordVal: {
    fontSize: 22, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary, marginTop: 4, lineHeight: 26,
  },
  recordLabel: {
    fontSize: 10, fontFamily: Typography.fontFamily.bold, color: Colors.textSecondary, marginTop: 2, textAlign: 'center',
  },
  recordSub: { fontSize: 10, fontFamily: Typography.fontFamily.regular, color: Colors.textTertiary, textAlign: 'center' },

  h2hRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  h2hOpponent: { flexDirection: 'row', alignItems: 'center', gap: 8, width: 110 },
  h2hLogo: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.surfaceVariant },
  h2hLogoFb: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.primaryAlpha10, alignItems: 'center', justifyContent: 'center',
  },
  h2hLogoLetter: { fontSize: 12, fontFamily: Typography.fontFamily.bold, color: Colors.primary },
  h2hName: { fontSize: 12, fontFamily: Typography.fontFamily.medium, color: Colors.textPrimary, flex: 1 },
  h2hStats: { flex: 1, gap: 5 },
  h2hFigures: { fontSize: 11, fontFamily: Typography.fontFamily.medium, color: Colors.textSecondary },
  h2hBarBg: { height: 5, backgroundColor: Colors.surfaceVariant, borderRadius: 3, overflow: 'hidden' },
  h2hBarFill: { height: '100%', borderRadius: 3 },
  h2hWinPct: { fontSize: 13, fontFamily: Typography.fontFamily.bold, width: 38, textAlign: 'right' },

  // Legacy 2-col grid (used inside StatItem helpers)
  statsGrid2col: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statItem: {
    flex: 1, minWidth: '44%', backgroundColor: Colors.surface,
    borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14,
  },
  statItemHighlight: {
    backgroundColor: Colors.surfaceVariant, borderWidth: 1, borderColor: Colors.primaryAlpha30,
  },
  statItemValue: {
    fontSize: 22, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary, lineHeight: 26,
  },
  statItemLabel: {
    fontSize: 10, fontFamily: Typography.fontFamily.regular, color: Colors.textTertiary, marginTop: 2,
  },

  emptyWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyTitle: {
    fontSize: 16, fontFamily: Typography.fontFamily.bold, color: Colors.textSecondary, marginTop: 14,
  },
  emptySub: {
    fontSize: 12, fontFamily: Typography.fontFamily.regular,
    color: Colors.textTertiary, marginTop: 6, textAlign: 'center', paddingHorizontal: 32,
  },

  // ── Analytics Dashboard Specific Styles ──────────────────────────────────
  toggleRow: {
    flexDirection: 'row', backgroundColor: Colors.surfaceVariant, borderRadius: 10, padding: 3, gap: 4,
  },
  toggleBtn: {
    flex: 1, paddingVertical: 7, alignItems: 'center', justifyContent: 'center', borderRadius: 8,
  },
  toggleBtnActive: { backgroundColor: Colors.primary },
  toggleBtnText: { fontSize: 11, fontFamily: Typography.fontFamily.medium, color: Colors.textTertiary },
  toggleBtnTextActive: { color: '#000000', fontFamily: Typography.fontFamily.bold },

  trendSummaryRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
    paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.border, marginTop: 6,
  },
  trendSummaryItem: { alignItems: 'center', flex: 1 },
  trendSummaryVal: { fontSize: 18, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary, lineHeight: 22 },
  trendSummaryLabel: { fontSize: 10, fontFamily: Typography.fontFamily.regular, color: Colors.textTertiary, marginTop: 2 },
  trendSummaryDivider: { width: 1, height: 24, backgroundColor: Colors.border },

  contribRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  contribAvatarWrap: { width: 32, height: 32, borderRadius: 16, overflow: 'hidden', backgroundColor: Colors.surfaceVariant },
  contribAvatarImg: { width: 32, height: 32 },
  contribAvatarFb: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.primaryAlpha10, alignItems: 'center', justifyContent: 'center' },
  contribAvatarLetter: { fontSize: 12, fontFamily: Typography.fontFamily.bold, color: Colors.primary },
  contribName: { fontSize: 12, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary, maxWidth: '55%' },
  contribStat: { fontSize: 11, fontFamily: Typography.fontFamily.medium, color: Colors.textTertiary },
  contribPct: { fontSize: 12, fontFamily: Typography.fontFamily.bold, color: Colors.primary, minWidth: 32, textAlign: 'right' },
  contribBarBg: { height: 6, backgroundColor: Colors.surfaceVariant, borderRadius: 3, overflow: 'hidden' },
  contribBarFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 3 },

  strengthRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  strengthLabel: { fontSize: 12, fontFamily: Typography.fontFamily.medium, color: Colors.textSecondary, width: 95 },
  strengthBarCol: { flex: 1 },
  strengthBarBg: { height: 8, backgroundColor: Colors.surfaceVariant, borderRadius: 4, overflow: 'hidden' },
  strengthBarFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 4 },
  strengthVal: { fontSize: 13, fontFamily: Typography.fontFamily.bold, color: Colors.primary, width: 28, textAlign: 'right' },

  last6DotsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  last6Dot: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  last6DotWin: { backgroundColor: Colors.primary },
  last6DotLoss: { backgroundColor: 'rgba(255,255,255,0.15)' },
  last6DotNR: { backgroundColor: Colors.surfaceVariant },
  last6DotText: { fontSize: 13, fontFamily: Typography.fontFamily.bold, color: '#FFFFFF' },
  last6SummaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  last6SummaryMain: { fontSize: 13, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary },
  last6SummarySub: { fontSize: 10, fontFamily: Typography.fontFamily.regular, color: Colors.textTertiary, marginTop: 2 },
  last6WinRateVal: { fontSize: 18, fontFamily: Typography.fontFamily.bold, color: Colors.primary },

  versusGrid: { flexDirection: 'row', alignItems: 'center' },
  versusCol: { flex: 1, alignItems: 'center', gap: 8 },
  versusDivider: { width: 1, height: 120, backgroundColor: Colors.border },
  versusBadge: { backgroundColor: Colors.primaryAlpha10, borderWidth: 1, borderColor: Colors.primaryAlpha30, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 3, marginBottom: 4 },
  versusBadgeText: { fontSize: 10, fontFamily: Typography.fontFamily.bold, color: Colors.primary, letterSpacing: 0.5 },
  versusMetric: { alignItems: 'center' },
  versusVal: { fontSize: 16, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary },
  versusLabel: { fontSize: 10, fontFamily: Typography.fontFamily.regular, color: Colors.textTertiary },
  versusBarRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  versusBarLabel: { fontSize: 11, fontFamily: Typography.fontFamily.medium, color: Colors.textSecondary, width: 60 },
  versusBarBg: { flex: 1, height: 6, backgroundColor: Colors.surfaceVariant, borderRadius: 3, overflow: 'hidden' },
  versusBarFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 3 },
  versusBarVal: { fontSize: 11, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary, width: 44, textAlign: 'right' },

  seasonTableHeader: { flexDirection: 'row', backgroundColor: Colors.surfaceVariant, paddingHorizontal: 14, paddingVertical: 10 },
  seasonTableCell: { flex: 1 },
  seasonTableHeadText: { fontSize: 10, fontFamily: Typography.fontFamily.bold, color: Colors.textTertiary, letterSpacing: 0.5, textTransform: 'uppercase' },
  seasonTableRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  seasonTableRowHighlight: { backgroundColor: Colors.primaryAlpha10 },
  seasonTableCellText: { flex: 1, fontSize: 12, fontFamily: Typography.fontFamily.medium, color: Colors.textPrimary },
  currentSeasonPill: { backgroundColor: Colors.primary, borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 },
  currentSeasonText: { fontSize: 8, fontFamily: Typography.fontFamily.bold, color: '#000000' },
});

export default TeamDetailScreen;

