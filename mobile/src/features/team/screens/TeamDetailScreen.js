import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  Image, ScrollView, ActivityIndicator, Animated,
  Dimensions, Modal, TextInput, ToastAndroid, Platform, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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

const { width: SCREEN_W } = Dimensions.get('window');

const DETAIL_TABS = [
  { id: 'players', label: 'Players', icon: 'account-multiple' },
  { id: 'matches', label: 'Matches', icon: 'cricket' },
  { id: 'stats', label: 'Stats', icon: 'chart-bar' },
  { id: 'leaderboard', label: 'Leaderboard', icon: 'podium' },
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
  const { selectedTeam, teamStats, isLoading, statsLoading } = useSelector(s => s.team);
  const { user } = useSelector(s => s.auth);

  const [activeTab, setActiveTab] = useState('players');
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

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        dispatch(fetchTeamById(id)).unwrap(),
        dispatch(fetchTeamStats(id)).unwrap()
      ]);
    } catch (e) {}
    setRefreshing(false);
  };

  useEffect(() => {
    if (id) {
      dispatch(fetchTeamById(id));
    }
    return () => { dispatch(clearSelectedTeam()); };
  }, [id, dispatch]);

  // Fetch stats when stats/leaderboard/analytics tab selected
  useEffect(() => {
    if (['stats', 'leaderboard', 'analytics', 'matches'].includes(activeTab) && id && !teamStats) {
      dispatch(fetchTeamStats(id));
    }
  }, [activeTab, id, teamStats, dispatch]);

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

  // ── Tab contents ──────────────────────────────────────────────────────────

  const renderPlayersTab = () => (
    <View style={{ flex: 1, position: 'relative' }}>
      <KeyboardAwareScrollView 
        enableOnAndroid={true} extraScrollHeight={20} keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.tabContent, canManageRoster && { paddingTop: 8 }]} showsVerticalScrollIndicator={false}
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

              {/* Action buttons — ONLY captain/admin can manage roster */}
              {canManageRoster && !isMe && (
                <View style={styles.playerActions}>
                  <TouchableOpacity
                    style={styles.actionIconBtn}
                    onPress={(e) => { e.stopPropagation?.(); setSelectedPlayerToEdit(member); setRoleModalVisible(true); }}
                  >
                    <Icon name="account-edit" size={15} color={Colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionIconBtn, styles.actionIconBtnDanger]}
                    onPress={(e) => { e.stopPropagation?.(); handleRemovePlayer(member); }}
                  >
                    <Icon name="account-remove" size={15} color={Colors.error} />
                  </TouchableOpacity>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
        {canManageRoster && <View style={{ height: 100 }} />}
      </KeyboardAwareScrollView>

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
      <KeyboardAwareScrollView 
        enableOnAndroid={true} extraScrollHeight={20} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}
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
      </KeyboardAwareScrollView>
    );
  };

  const renderStatsTab = () => {
    if (statsLoading && !teamStats) return <LoadingState />;
    const s = selectedTeam?.stats || {};
    const winPct = s.matches > 0 ? ((s.wins / s.matches) * 100).toFixed(1) : '0.0';
    const lossPct = s.matches > 0 ? ((s.losses / s.matches) * 100).toFixed(1) : '0.0';
    const formats = teamStats?.formatBreakdown || {};

    return (
      <KeyboardAwareScrollView 
        enableOnAndroid={true} extraScrollHeight={20} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} tintColor={Colors.primary} />}
      >
        {/* Win/Loss overview */}
        <View style={styles.statsCard}>
          <Text style={styles.statsCardTitle}>Match Overview</Text>
          <View style={styles.statsGrid}>
            <BigStat label="Played" value={s.matches || 0} />
            <BigStat label="Won" value={s.wins || 0} primary />
            <BigStat label="Lost" value={s.losses || 0} danger />
            <BigStat label="NR" value={s.noResults || 0} />
          </View>
          {/* Win rate bar */}
          <View style={styles.winRateWrap}>
            <View style={styles.winRateBarBg}>
              <Animated.View style={[styles.winRateBarFill, { width: `${winPct}%` }]} />
            </View>
            <View style={styles.winRateLabels}>
              <Text style={{ color: Colors.success, fontSize: 11, fontFamily: Typography.fontFamily.bold }}>{winPct}% Win Rate</Text>
              <Text style={{ color: Colors.error, fontSize: 11, fontFamily: Typography.fontFamily.bold }}>{lossPct}% Loss Rate</Text>
            </View>
          </View>
        </View>



        {/* Format Breakdown */}
        {Object.keys(formats).length > 0 && (
          <View style={styles.statsCard}>
            <Text style={styles.statsCardTitle}>Format Breakdown</Text>
            {Object.entries(formats).map(([fmt, data]) => (
              <View key={fmt} style={styles.formatRow}>
                <View style={styles.formatTag}><Text style={styles.formatTagText}>{fmt}</Text></View>
                <View style={styles.formatBarWrap}>
                  <View style={styles.formatBarBg}>
                    <View style={[styles.formatBarFill, {
                      width: data.matches > 0 ? `${(data.wins / data.matches) * 100}%` : '0%'
                    }]} />
                  </View>
                </View>
                <Text style={styles.formatStat}>{data.wins}W / {data.matches - data.wins}L</Text>
              </View>
            ))}
          </View>
        )}
      </KeyboardAwareScrollView>
    );
  };

  const renderLeaderboardTab = () => {
    if (statsLoading && !teamStats) return <LoadingState />;
    const topBat = teamStats?.topScorers || [];
    const topBowl = teamStats?.topWicketTakers || [];
    const topField = teamStats?.topFielders || [];

    return (
      <KeyboardAwareScrollView 
        enableOnAndroid={true} extraScrollHeight={20} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}
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
            {topBat.length === 0 ? <EmptyState icon="cricket" label="No batting data yet" small /> : topBat.map((p, i) => (
              <View key={p.player?._id || i} style={styles.lbRow}>
                <View style={[styles.lbRank, i < 3 && styles.lbRankTop]}>
                  <Text style={[styles.lbRankText, i < 3 && { color: '#FFD700' }]}>{i + 1}</Text>
                </View>
                <View style={styles.lbAvatar}>
                  {p.player?.photo
                    ? <Image source={{ uri: getImageUrl(p.player.photo) }} style={styles.lbAvatarImg} />
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
              </View>
            ))}
          </View>
        )}

        {activeLeaderboardTab === 'bowlers' && (
          <View style={styles.lbSection}>
            <View style={styles.lbSectionHeader}>
              <Icon name="baseball" size={16} color={Colors.primary} />
              <Text style={styles.lbSectionTitle}>Top Wicket Takers</Text>
            </View>
            {topBowl.length === 0 ? <EmptyState icon="baseball" label="No bowling data yet" small /> : topBowl.map((p, i) => (
              <View key={p.player?._id || i} style={styles.lbRow}>
                <View style={[styles.lbRank, i < 3 && styles.lbRankTop]}>
                  <Text style={[styles.lbRankText, i < 3 && { color: '#FFD700' }]}>{i + 1}</Text>
                </View>
                <View style={styles.lbAvatar}>
                  {p.player?.photo
                    ? <Image source={{ uri: getImageUrl(p.player.photo) }} style={styles.lbAvatarImg} />
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
              </View>
            ))}
          </View>
        )}

        {activeLeaderboardTab === 'fielders' && (
          <View style={styles.lbSection}>
            <View style={styles.lbSectionHeader}>
              <Icon name="hand-back-right" size={16} color={Colors.primary} />
              <Text style={styles.lbSectionTitle}>Top Fielders</Text>
            </View>
            {topField.length === 0 ? <EmptyState icon="hand-back-right" label="No fielding data yet" small /> : topField.map((p, i) => (
              <View key={p.player?._id || i} style={styles.lbRow}>
                <View style={[styles.lbRank, i < 3 && styles.lbRankTop]}>
                  <Text style={[styles.lbRankText, i < 3 && { color: '#FFD700' }]}>{i + 1}</Text>
                </View>
                <View style={styles.lbAvatar}>
                  {p.player?.photo
                    ? <Image source={{ uri: getImageUrl(p.player.photo) }} style={styles.lbAvatarImg} />
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
              </View>
            ))}
          </View>
        )}
      </KeyboardAwareScrollView>
    );
  };

  const renderAchievementsTab = () => {
    const s = selectedTeam?.stats || {};
    return (
      <KeyboardAwareScrollView 
        enableOnAndroid={true} extraScrollHeight={20} keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.tabContent, { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }]} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} tintColor={Colors.primary} />}
      >
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
      </KeyboardAwareScrollView>
    );
  };

  const renderAnalyticsTab = () => {
    if (statsLoading && !teamStats) return <LoadingState />;
    const recent = teamStats?.recentMatches || [];
    const s = selectedTeam?.stats || {};
    const winPct = s.matches > 0 ? parseFloat(((s.wins / s.matches) * 100).toFixed(1)) : 0;
    const lossPct = s.matches > 0 ? parseFloat(((s.losses / s.matches) * 100).toFixed(1)) : 0;
    const nrPct = Math.max(0, 100 - winPct - lossPct);

    return (
      <KeyboardAwareScrollView 
        enableOnAndroid={true} extraScrollHeight={20} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} tintColor={Colors.primary} />}
      >
        {/* Donut-style result breakdown */}
        <View style={styles.analyticsCard}>
          <Text style={styles.statsCardTitle}>Result Breakdown</Text>
          <View style={styles.resultBreakdownRow}>
            <ResultBlock pct={winPct} label="Wins" color={Colors.success} />
            <ResultBlock pct={lossPct} label="Losses" color={Colors.error} />
            <ResultBlock pct={nrPct} label="No Result" color={Colors.textTertiary} />
          </View>
        </View>

        {/* Win trend — last 5 matches as W/L dots */}
        <View style={styles.analyticsCard}>
          <Text style={styles.statsCardTitle}>Recent Form (Last {Math.min(recent.length, 5)})</Text>
          <View style={styles.formRow}>
            {recent.slice(0, 5).map((m, i) => (
              <View key={i} style={[
                styles.formDot,
                m.result === 'W' ? styles.formDotWin : m.result === 'L' ? styles.formDotLoss : styles.formDotNR
              ]}>
                <Text style={styles.formDotText}>{m.result || 'NR'}</Text>
              </View>
            ))}
            {recent.length === 0 && <Text style={styles.noDataText}>No matches yet</Text>}
          </View>
        </View>

        {/* Format bar chart */}
        {teamStats?.formatBreakdown && Object.keys(teamStats.formatBreakdown).length > 0 && (
          <View style={styles.analyticsCard}>
            <Text style={styles.statsCardTitle}>Matches by Format</Text>
            <View style={styles.barChartWrap}>
              {Object.entries(teamStats.formatBreakdown).map(([fmt, data]) => {
                const maxMatches = Math.max(...Object.values(teamStats.formatBreakdown).map(d => d.matches));
                const barH = maxMatches > 0 ? Math.max((data.matches / maxMatches) * 100, 8) : 8;
                return (
                  <View key={fmt} style={styles.barColumn}>
                    <Text style={styles.barValue}>{data.matches}</Text>
                    <View style={styles.barBg}>
                      <LinearGradient colors={Colors.primaryGradient} style={[styles.barFill, { height: `${barH}%` }]} />
                    </View>
                    <Text style={styles.barLabel}>{fmt}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}


      </KeyboardAwareScrollView>
    );
  };

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'players': return renderPlayersTab();
      case 'matches': return renderMatchesTab();
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
            {isManager && (
              <>
                <TouchableOpacity style={styles.navBtn} onPress={openEditModal}>
                  <Icon name="pencil" size={20} color={Colors.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.navBtn} onPress={handleDeleteTeam}>
                  <Icon name="delete-outline" size={20} color={Colors.error} />
                </TouchableOpacity>
              </>
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
                  <Icon name="shield" size={40} color={Colors.primary} />
                </LinearGradient>
              )
            }
            {winPct !== '—' && (
              <View style={styles.winPctBadge}>
                <Text style={styles.winPctText}>{winPct}%</Text>
              </View>
            )}
          </View>
          <View style={styles.teamMeta}>
            <Text style={styles.teamNameLarge} numberOfLines={1}>{team?.name || 'Team'}</Text>
            {team?.city && (
              <View style={styles.teamCityRow}>
                <Icon name="map-marker" size={12} color={Colors.primary} />
                <Text style={styles.teamCity}>{team.city}{team.state ? `, ${team.state}` : ''}</Text>
              </View>
            )}
            <View style={styles.teamQuickStats}>
              <QuickStat label="Players" value={team?.players?.length || 0} icon="account-multiple" />
              <QuickStat label="Matches" value={team?.stats?.matches || 0} icon="cricket" />
              <QuickStat label="Wins" value={team?.stats?.wins || 0} icon="trophy" primary />
            </View>
          </View>
        </View>

        {/* Follow button row */}
        <View style={styles.headerBtnsRow}>
          <TouchableOpacity
            style={[styles.followBigBtn, team?.isFollowing && styles.followBigBtnActive]}
            onPress={handleFollow}
          >
            <Icon name={team?.isFollowing ? 'bell' : 'bell-outline'} size={15} color={team?.isFollowing ? '#000' : Colors.primary} />
            <Text style={[styles.followBigBtnText, team?.isFollowing && { color: '#000' }]}>
              {team?.isFollowing ? 'Following' : 'Follow'} {team?.followerCount ? `· ${team.followerCount}` : ''}
            </Text>
          </TouchableOpacity>
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
        <View style={styles.modalOverlay}>
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
        </View>
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
        <View style={styles.modalOverlay}>
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
        </View>
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

  teamIdentity: { flexDirection: 'row', gap: 14, marginBottom: 12, alignItems: 'flex-start' },
  teamLogoWrap: { position: 'relative' },
  teamLogo: { width: 80, height: 80, borderRadius: 40, borderWidth: 3, borderColor: Colors.primaryAlpha30 },
  teamLogoFb: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Colors.primaryAlpha30 },
  winPctBadge: {
    position: 'absolute', bottom: -4, right: -4,
    backgroundColor: Colors.primary, borderRadius: 10,
    paddingHorizontal: 5, paddingVertical: 1,
  },
  winPctText: { color: '#000', fontFamily: Typography.fontFamily.bold, fontSize: 9 },
  teamMeta: { flex: 1 },
  teamNameLarge: { color: '#fff', fontFamily: Typography.fontFamily.bold, fontSize: 20, marginBottom: 4 },
  teamCityRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  teamCity: { color: Colors.textSecondary, fontFamily: Typography.fontFamily.medium, fontSize: 12 },
  teamQuickStats: { flexDirection: 'row', gap: 8 },
  quickStat: { alignItems: 'center', backgroundColor: Colors.backgroundCard, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  quickStatVal: { color: '#fff', fontFamily: Typography.fontFamily.bold, fontSize: 13 },
  quickStatLabel: { color: Colors.textTertiary, fontFamily: Typography.fontFamily.regular, fontSize: 9 },

  headerBtnsRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  inviteCodeWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.backgroundCard, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    flex: 1,
  },
  inviteCodeText: { color: Colors.textSecondary, fontFamily: Typography.fontFamily.bold, fontSize: 12, letterSpacing: 1 },
  followBigBtn: {
    flex: 1, justifyContent: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: Colors.primaryAlpha30,
    backgroundColor: Colors.primaryAlpha10,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8,
  },
  followBigBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  followBigBtnText: { color: Colors.primary, fontFamily: Typography.fontFamily.bold, fontSize: 12 },

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
  tabContent: { padding: 14, paddingBottom: 30, gap: 10 },

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
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: Colors.primaryAlpha10, borderWidth: 1, borderColor: Colors.primaryAlpha30,
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
  achCard: {
    width: (SCREEN_W - 14 * 2 - 12) / 2, backgroundColor: Colors.backgroundCard,
    borderRadius: 14, padding: 14, alignItems: 'center', gap: 6,
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

export default TeamDetailScreen;
