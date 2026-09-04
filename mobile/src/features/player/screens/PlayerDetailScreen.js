import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Image, Modal, FlatList, Platform, ToastAndroid, Dimensions,
  RefreshControl, TextInput, KeyboardAvoidingView
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchPlayerById, followPlayer, fetchMyPlayer,
  fetchPlayerAchievements, fetchPlayerBallTypes, fetchMatchHistory,
} from '../playerSlice';
import SharePreviewModal from '../../tournament/components/SharePreviewModal';
import { PlayerProfilePoster } from '../../tournament/components/PosterTemplates';
import { useTheme, Typography, BorderRadius, Spacing } from '../../../theme/theme';
import { showCustomAlert } from '../../../components/CustomAlert';
import Icon from 'react-native-vector-icons/Ionicons';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { getImageUrl } from '../../../api/axios';
import api from '../../../api/axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getPlayerTags } from '../../../utils/playerTags';
const SPORTVERSE_LOGO = require('../../../../Bat.png');
const BallTypeImages = {
  'Tennis': require('../../../../Tennis.jpeg'),
  'Leather': require('../../../../Leather.jpeg'),
  'Rubber': require('../../../../Others.jpeg'),
  'Tape Ball': require('../../../../Others.jpeg'),
  'Other': require('../../../../Others.jpeg'),
  'Others': require('../../../../Others.jpeg'),
};

const TABS = [
  { key: 'stats',         label: 'Stats',        icon: 'stats-chart-outline' },
  { key: 'matches',       label: 'Matches',       icon: 'baseball-outline'    },
  { key: 'teams',         label: 'Teams',         icon: 'people-outline'      },
  { key: 'achievements',  label: 'Awards',        icon: 'trophy-outline'      },
];

const ACH_CFG = {
  player_of_match:       { icon: 'trophy',    color: '#F59E0B', label: 'Player of the Match'       },
  player_of_tournament:  { icon: 'ribbon',    color: '#6366F1', label: 'Player of the Tournament'  },
  century:               { icon: 'star',      color: '#3B82F6', label: 'Century'                   },
  half_century:          { icon: 'star-half', color: '#10B981', label: 'Half Century'              },
  five_wicket_haul:      { icon: 'flame',     color: '#EF4444', label: '5 Wicket Haul'             },
  hat_trick:             { icon: 'flash',     color: '#F97316', label: 'Hat Trick'                 },
  tournament_winner:     { icon: 'medal',     color: '#EC4899', label: 'Tournament Winner'         },
  milestone_100_matches: { icon: 'diamond',   color: '#8B5CF6', label: '100 Matches'               },
  milestone_100_runs:    { icon: 'trophy',    color: '#F59E0B', label: 'Runs'                      },
  milestone_500_runs:    { icon: 'trophy',    color: '#F59E0B', label: 'Runs'                      },
  milestone_1000_runs:   { icon: 'trophy',    color: '#F59E0B', label: 'Runs'                      },
  milestone_2000_runs:   { icon: 'trophy',    color: '#F59E0B', label: 'Runs'                      },
  milestone_3000_runs:   { icon: 'trophy',    color: '#F59E0B', label: 'Runs'                      },
  milestone_4000_runs:   { icon: 'trophy',    color: '#F59E0B', label: 'Runs'                      },
  milestone_5000_runs:   { icon: 'trophy',    color: '#F59E0B', label: 'Runs'                      },
  milestone_10000_runs:  { icon: 'trophy',    color: '#F59E0B', label: 'Runs'                      },
  milestone_50_wickets:  { icon: 'trophy',    color: '#EC4899', label: 'Wickets'                   },
};

const BallColors = { Tennis: '#10B981', 'Hard Tennis': '#F59E0B', Leather: '#EF4444', Other: '#8B5CF6' };

const PlayerDetailScreen = ({ navigation, route }) => {
  const { colors, shadows, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, shadows, isDark), [colors, shadows, isDark]);
  const { id } = route.params || {};
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();

  const { viewedPlayer, myProfile, achievements, availableBallTypes, matchHistory, isLoading } =
    useSelector(state => state.player);
  const { user } = useSelector(state => state.auth);

  const [activeTab, setActiveTab] = useState('stats');
  const [socialModalVisible, setSocialModalVisible] = useState(false);
  const [socialType, setSocialType] = useState('followers');
  const [socialList, setSocialList] = useState([]);
  const [socialLoading, setSocialLoading] = useState(false);
  const [selectedTagDefinition, setSelectedTagDefinition] = useState(null);
  const [ballTypeFilter, setBallTypeFilter] = useState('Overall');
  const [playerTeams, setPlayerTeams] = useState([]);
  const [teamsLoading, setTeamsLoading] = useState(false);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [localLoading, setLocalLoading] = useState(true);
  const [imgErrors, setImgErrors] = useState({});
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // UGC Block & Report States
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('inappropriate_name');
  const [reportDetails, setReportDetails] = useState('');
  const [reportLoading, setReportLoading] = useState(false);

  const viewedUserId = viewedPlayer?.userId?._id || viewedPlayer?.userId;
  const currentUserId = user?._id;
  const isSelf = currentUserId && viewedUserId && currentUserId.toString() === viewedUserId.toString();

  const handleBlockUser = () => {
    setShowMenuModal(false);
    showCustomAlert(
      "Block Player",
      `Are you sure you want to block ${viewedPlayer.name}? You will no longer see their stats, matches, or teams.`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Block", 
          style: "destructive",
          onPress: async () => {
            try {
              const targetUserId = viewedPlayer.userId?._id || viewedPlayer.userId;
              await api.post(`/users/block/${targetUserId}`);
              showCustomAlert(
                "Success", 
                "User blocked successfully", 
                [{ text: "OK", onPress: () => navigation.goBack() }]
              );
            } catch (err) {
              showCustomAlert("Error", err.response?.data?.message || "Failed to block user");
            }
          }
        }
      ]
    );
  };

  const handleReportUser = async () => {
    if (!reportReason) {
      showCustomAlert("Error", "Please select a reason for reporting");
      return;
    }
    setReportLoading(true);
    try {
      const targetUserId = viewedPlayer.userId?._id || viewedPlayer.userId;
      await api.post('/ugc/report', {
        contentType: 'player',
        contentId: viewedPlayer._id,
        reason: reportReason,
        details: reportDetails
      });
      setReportLoading(false);
      setShowReportModal(false);
      setReportDetails('');
      showCustomAlert("Report Submitted", "Thank you for reporting. Our team will review this profile within 24 hours.");
    } catch (err) {
      setReportLoading(false);
      showCustomAlert("Error", err.response?.data?.message || "Failed to submit report");
    }
  };

  const handleRefresh = useCallback(async () => {
    if (!id) return;
    setRefreshing(true);
    try {
      const promises = [
        dispatch(fetchPlayerById({ id, trackView: false })),
        dispatch(fetchPlayerAchievements(id)),
        dispatch(fetchPlayerBallTypes(id))
      ];
      if (activeTab === 'matches') {
        promises.push(dispatch(fetchMatchHistory({ playerId: id, ballType: ballTypeFilter !== 'Overall' ? ballTypeFilter : undefined })));
      } else if (activeTab === 'teams') {
        promises.push(api.get(`/players/${id}`).then(res => setPlayerTeams(res.data.data?.teams || [])));
      }
      await Promise.all(promises);
    } catch (e) {
      console.log(e);
    } finally {
      setRefreshing(false);
    }
  }, [id, activeTab, ballTypeFilter, dispatch]);

  useFocusEffect(
    useCallback(() => {
      if (id && viewedPlayer && viewedPlayer._id !== id) {
        setLocalLoading(true);
        Promise.all([
          dispatch(fetchPlayerById({ id, trackView: false })),
          dispatch(fetchPlayerAchievements(id)),
          dispatch(fetchPlayerBallTypes(id))
        ]).finally(() => setLocalLoading(false));
      }
    }, [id, viewedPlayer?._id, dispatch])
  );

  useEffect(() => {
    const fetchAll = async () => {
      if (!id) return;
      setLocalLoading(true);
      try {
        const key = 'ScoreVerse_ViewedPlayers';
        const viewedStr = await AsyncStorage.getItem(key);
        let viewedList = viewedStr ? JSON.parse(viewedStr) : [];
        const hasViewed = viewedList.includes(id);
        if (!hasViewed) {
          viewedList.push(id);
          await AsyncStorage.setItem(key, JSON.stringify(viewedList));
          await dispatch(fetchPlayerById({ id, trackView: true }));
        } else {
          await dispatch(fetchPlayerById({ id, trackView: false }));
        }
        dispatch(fetchPlayerAchievements(id));
        dispatch(fetchPlayerBallTypes(id));
      } catch {
        await dispatch(fetchPlayerById({ id, trackView: false }));
        dispatch(fetchPlayerAchievements(id));
        dispatch(fetchPlayerBallTypes(id));
      } finally {
        setLocalLoading(false);
      }
    };
    fetchAll();
  }, [id, dispatch]);

  useEffect(() => { if (!myProfile) dispatch(fetchMyPlayer()); }, [dispatch, myProfile]);

  useEffect(() => {
    if (activeTab === 'matches' && id) {
      setMatchesLoading(true);
      dispatch(fetchMatchHistory({
        playerId: id,
        ballType: ballTypeFilter !== 'Overall' ? ballTypeFilter : undefined,
      })).finally(() => setMatchesLoading(false));
    }
  }, [activeTab, id, ballTypeFilter, dispatch]);

  useEffect(() => {
    if (activeTab === 'teams' && id) {
      setTeamsLoading(true);
      api.get(`/players/${id}`)
        .then(res => setPlayerTeams(res.data.data?.teams || []))
        .catch(() => setPlayerTeams([]))
        .finally(() => setTeamsLoading(false));
    }
  }, [activeTab, id]);

  const loadSocialList = async (type) => {
    setSocialType(type); setSocialModalVisible(true); setSocialLoading(true);
    try { const res = await api.get(`/players/${id}/${type}`); setSocialList(res.data.data || []); }
    catch { setSocialList([]); }
    finally { setSocialLoading(false); }
  };

  const handleFollowToggle = async () => {
    if (!myProfile) return showCustomAlert('Sign In Required', 'Please create a cricket profile to follow players.');
    try {
      const res = await dispatch(followPlayer(id)).unwrap();
      const msg = res.following ? `You are now following ${viewedPlayer?.name || 'this player'}` : `Unfollowed ${viewedPlayer?.name || 'player'}`;
      if (Platform.OS === 'android') ToastAndroid.show(msg, ToastAndroid.SHORT);
      else showCustomAlert(res.following ? 'Following' : 'Unfollowed', msg);
      dispatch(fetchPlayerById({ id, trackView: false }));
      dispatch(fetchMyPlayer());
    } catch (err) { showCustomAlert('Error', err || 'Failed to update follow status'); }
  };

  const handleRemoveFollower = (followerId, followerName) => {
    showCustomAlert(
      'Remove Follower',
      `Remove ${followerName || 'this player'} from your followers?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/players/${id}/followers/${followerId}`);
              setSocialList(prev => prev.filter(p => p._id !== followerId));
              dispatch(fetchPlayerById({ id, trackView: false }));
            } catch (err) {
              showCustomAlert('Error', err.response?.data?.message || 'Failed to remove follower');
            }
          },
        },
      ]
    );
  };

  const handleUnfollowFromList = (followingId, followingName) => {
    showCustomAlert(
      'Unfollow',
      `Unfollow ${followingName || 'this player'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unfollow',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/players/${id}/following/${followingId}`);
              setSocialList(prev => prev.filter(p => p._id !== followingId));
              dispatch(fetchPlayerById({ id, trackView: false }));
            } catch (err) {
              showCustomAlert('Error', err.response?.data?.message || 'Failed to unfollow');
            }
          },
        },
      ]
    );
  };

  if (localLoading) {
    return (<SafeAreaView style={styles.centeredState}><ActivityIndicator size="large" color={colors.primary} /><Text style={styles.loadingText}>Loading profile…</Text></SafeAreaView>);
  }
  if (!viewedPlayer || viewedPlayer._id !== id) {
    return (<SafeAreaView style={styles.centeredState}><Icon name="alert-circle-outline" size={52} color={colors.error} /><Text style={styles.errorText}>Player profile not found</Text><TouchableOpacity style={styles.goBackBtn} onPress={() => navigation.goBack()}><Text style={styles.goBackBtnText}>Go Back</Text></TouchableOpacity></SafeAreaView>);
  }

  const viewedPlayerUserId = viewedPlayer.userId?._id || viewedPlayer.userId;
  const isOwnProfile = (myProfile && myProfile._id === viewedPlayer._id) || (viewedPlayerUserId && user && viewedPlayerUserId === user._id);
  const isFollowing = myProfile?.following?.includes(viewedPlayer._id);
  const photoUrl = viewedPlayer.photo || viewedPlayer.userId?.photo || null;

  const handleSharePress = () => {
    setShareModalVisible(true);
  };

  let career = viewedPlayer.career || {};
  let batting = viewedPlayer.batting || {};
  let bowling = viewedPlayer.bowling || {};
  let fielding = viewedPlayer.fielding || {};

  if (ballTypeFilter !== 'Overall' && viewedPlayer.statsByBallType?.[ballTypeFilter]) {
    career   = viewedPlayer.statsByBallType[ballTypeFilter].career   || {};
    batting  = viewedPlayer.statsByBallType[ballTypeFilter].batting  || {};
    bowling  = viewedPlayer.statsByBallType[ballTypeFilter].bowling  || {};
    fielding = viewedPlayer.statsByBallType[ballTypeFilter].fielding || {};
  }

  let displayBattingAverage = viewedPlayer.battingAverage || 0;
  let displayStrikeRate     = viewedPlayer.strikeRate     || 0;
  let displayBowlingAverage = viewedPlayer.bowlingAverage || '—';
  let displayEconomy        = viewedPlayer.economy        || 0;

  if (ballTypeFilter !== 'Overall') {
    const dismissals = (batting.innings || 0) - (batting.notOuts || 0);
    displayBattingAverage = dismissals === 0 ? ((batting.runs || 0) === 0 ? 0 : '∞') : ((batting.runs || 0) / dismissals).toFixed(2);
    displayStrikeRate = !batting?.balls ? 0 : (((batting.runs || 0) / batting.balls) * 100).toFixed(2);
    displayBowlingAverage = !bowling?.wickets ? '—' : ((bowling.runs || 0) / bowling.wickets).toFixed(2);
    const overs = (bowling.overs || 0) + (bowling.balls || 0) / 6;
    displayEconomy = overs === 0 ? 0 : ((bowling.runs || 0) / overs).toFixed(2);
  }

  const winPct = career.matches ? `${Math.round((career.wins / career.matches) * 100)}%` : '0%';

  const StatPill = ({ value, label, highlight }) => (
    <View style={styles.statPill}>
      <Text style={[styles.statPillVal, highlight && styles.statPillValHL]}>{value}</Text>
      <Text style={styles.statPillLbl}>{label}</Text>
    </View>
  );

  const SectionHeader = ({ icon, label }) => (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionIconWrap}><Icon name={icon} size={15} color={colors.primary} /></View>
      <Text style={styles.sectionTitle}>{label}</Text>
    </View>
  );

  const InfoRow = ({ label, value }) => (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <View style={styles.infoValuePill}><Text style={styles.infoValue}>{value}</Text></View>
    </View>
  );

  const BallTypeFilter = () => (
    availableBallTypes && availableBallTypes.length > 0 ? (
      <View style={styles.filterSection}>
        <View style={styles.filterHeaderRow}>
          <View style={styles.filterIconWrap}><Icon name="filter-outline" size={12} color={colors.primary} /></View>
          <Text style={styles.filterHeaderText}>FILTER BY BALL TYPE</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScrollContent}>
          <TouchableOpacity style={[styles.filterPillCircular, ballTypeFilter === 'Overall' && styles.filterPillCircularActive, { opacity: ballTypeFilter === 'Overall' ? 1 : 0.45 }]} onPress={() => setBallTypeFilter('Overall')} activeOpacity={0.75}>
            <Icon name="globe-outline" size={20} color={ballTypeFilter === 'Overall' ? colors.primary : colors.textSecondary} />
          </TouchableOpacity>
          {availableBallTypes.map(bt => {
            const isActive = ballTypeFilter === bt;
            return (
              <TouchableOpacity key={bt} style={[styles.filterPillCircular, isActive && styles.filterPillCircularActive, { opacity: isActive ? 1 : 0.45 }]} onPress={() => setBallTypeFilter(bt)} activeOpacity={0.75}>
                <Image 
                  source={BallTypeImages[bt] || BallTypeImages['Other']} 
                  style={styles.filterPillCircularImage} 
                />
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    ) : null
  );

  const renderStatsTab = () => (
    <>
      <BallTypeFilter />
      <SectionHeader icon="stats-chart-outline" label="Batting" />
      <View style={styles.card}>
        <View style={styles.infoGrid}>
          <InfoRow label="Style" value={viewedPlayer.battingStyle || 'Right Hand'} />
          <InfoRow label="Order" value={viewedPlayer.battingOrder || 'Middle Order'} />
        </View>
        <View style={styles.cardDivider} />
        <View style={styles.statsGrid}>
          <StatPill value={batting.innings || 0} label="Innings" />
          <StatPill value={batting.runs || 0} label="Runs" highlight />
          <StatPill value={displayBattingAverage} label="Average" />
          <StatPill value={displayStrikeRate} label="S/R" />
        </View>
        <View style={[styles.statsGrid, { marginTop: 10 }]}>
          <StatPill value={batting.fours || 0} label="4s" />
          <StatPill value={batting.sixes || 0} label="6s" highlight />
          <StatPill value={batting.highestScore || 0} label="Highest" />
          <StatPill value={batting.notOuts || 0} label="N.O." />
        </View>
      </View>
      <SectionHeader icon="podium-outline" label="Bowling" />
      <View style={styles.card}>
        <View style={styles.infoGrid}><InfoRow label="Style" value={viewedPlayer.bowlingStyle || 'Right Arm Fast'} /></View>
        <View style={styles.cardDivider} />
        <View style={styles.statsGrid}>
          <StatPill value={bowling.innings || 0} label="Innings" />
          <StatPill value={bowling.wickets || 0} label="Wickets" highlight />
          <StatPill value={displayEconomy} label="Economy" />
          <StatPill value={displayBowlingAverage} label="Average" />
        </View>
        <View style={[styles.statsGrid, { marginTop: 10 }]}>
          <StatPill value={bowling.overs || 0} label="Overs" />
          {/* <StatPill value={bowling.runs || 0} label="Runs" /> */}
          <StatPill value={bowling.bestWickets ? `${bowling.bestWickets}/${bowling.bestRuns === 999 ? 0 : (bowling.bestRuns || 0)}` : '0/0'} label="Best" highlight />
          <StatPill value={bowling.threeWicketHauls || 0} label="3W" />
          <StatPill value={bowling.fiveWicketHauls || 0} label="5W" />
          <StatPill value={bowling.maidens || 0} label="Maidens" />
        </View>
      </View>
      <SectionHeader icon="shield-checkmark-outline" label="Fielding" />
      <View style={styles.card}>
        <View style={styles.statsGrid}>
          <StatPill value={fielding.catches || 0} label="Catches" />
          <StatPill value={fielding.runOuts || 0} label="Run Outs" />
          <StatPill value={fielding.stumpings || 0} label="Stumpings" />
          <StatPill value={fielding.caughtBehind || fielding.caughtBehinds || 0} label="Caught Behind" />
        </View>
      </View>
    </>
  );

  const renderMatchesTab = () => {
    if (matchesLoading) return <View style={styles.tabCenteredEmpty}><ActivityIndicator color={colors.primary} size="large" /></View>;
    if (!matchHistory || matchHistory.length === 0) return (
      <View style={styles.tabCenteredEmpty}>
        <Icon name="baseball-outline" size={52} color={colors.textTertiary} />
        <Text style={styles.emptyText}>No match history yet</Text>
      </View>
    );
    return (
      <>
        <BallTypeFilter />
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
                    {teamAName} <Text style={{ color: colors.primary, fontFamily: Typography.fontFamily.bold }}>vs</Text> {teamBName}
                  </Text>
                </View>

                {/* Center row: Score/Stats + Live/Date Indicator */}
                <View style={styles.matchCardBody}>
                  <View style={{ flex: 1 }}>
                    {/* Batting Stats */}
                    {match.runs !== null && (
                      <View>
                        <Text style={styles.matchRunsValue}>{match.runs}{match.isNotOut ? '*' : ''} <Text style={{ fontSize: 13, color: colors.textSecondary, fontFamily: Typography.fontFamily.regular }}>runs</Text></Text>
                        <Text style={styles.matchRunsLabel}>{match.balls || 0} balls · {match.fours || 0}×4s · {match.sixes || 0}×6s</Text>
                      </View>
                    )}

                    {/* Spacer if both are present */}
                    {match.runs !== null && match.bowling && (
                      <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginVertical: 8 }} />
                    )}

                    {/* Bowling Stats */}
                    {match.bowling ? (
                      <View>
                        <Text style={styles.matchRunsValue}>
                          {match.bowling.wickets}-{match.bowling.runs}{' '}
                          <Text style={{ fontSize: 13, color: colors.textSecondary, fontFamily: Typography.fontFamily.regular }}>
                            ({match.bowling.overs}.{match.bowling.balls} ov)
                          </Text>
                        </Text>
                        <Text style={styles.matchRunsLabel}>
                          {match.bowling.maidens || 0} mdns · econ {(match.bowling.economy || 0).toFixed(2)}
                        </Text>
                      </View>
                    ) : (
                      match.runs === null && <Text style={styles.matchDNB}>Did Not Bat or Bowl</Text>
                    )}
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
                  <Text style={[styles.matchStatusText, isLive && { color: colors.primary }]} numberOfLines={1}>
                    {statusText}
                  </Text>
                </View>
              </View>
              <Icon name="chevron-forward" size={16} color={colors.textTertiary} style={{ marginLeft: 8 }} />
            </TouchableOpacity>
          );
        })}
      </>
    );
  };

  const renderTeamsTab = () => {
    if (teamsLoading) return <View style={styles.tabCenteredEmpty}><ActivityIndicator color={colors.primary} size="large" /></View>;
    const teams = playerTeams.length > 0 ? playerTeams : (viewedPlayer.teams || []);
    if (!teams || teams.length === 0) return (
      <View style={styles.tabCenteredEmpty}>
        <Icon name="people-outline" size={52} color={colors.textTertiary} />
        <Text style={styles.emptyText}>Not part of any team yet</Text>
      </View>
    );
    return teams.map((team, idx) => (
      <TouchableOpacity key={team._id || idx} style={styles.teamCard} activeOpacity={0.8}
        onPress={() => { if (team._id) navigation.navigate('TeamDetail', { id: team._id }); }}>
        {team.logo ? (
          <Image source={{ uri: getImageUrl(team.logo) }} style={styles.teamLogo} />
        ) : (
          <View style={styles.teamLogoFallback}>
            <Text style={styles.teamLogoInitial}>
              {(team.name || 'T').trim().charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={styles.teamName}>{team.name || 'Unknown Team'}</Text>
          {team.category && <Text style={styles.teamCategory}>{team.category}</Text>}
        </View>
        <Icon name="chevron-forward" size={16} color={colors.textTertiary} />
      </TouchableOpacity>
    ));
  };

  const renderAchievementsTab = () => {
    if (!achievements || achievements.length === 0) return (
      <View style={styles.tabCenteredEmpty}>
        <Icon name="trophy-outline" size={52} color={colors.textTertiary} />
        <Text style={styles.emptyText}>No achievements yet</Text>
        <Text style={styles.emptySubText}>Keep playing to earn awards!</Text>
      </View>
    );
    return achievements.map((ach, idx) => {
      const cfg = ACH_CFG[ach.type] || { icon: 'star', color: '#F59E0B', label: ach.type };
      const teamAName = ach.match?.teamA?.name;
      const teamBName = ach.match?.teamB?.name;
      const matchLabel = teamAName && teamBName ? `${teamAName} vs ${teamBName}` : null;
      const tournamentLabel = ach.tournament?.name;
      return (
        <View key={idx} style={styles.achievementCard}>
          <View style={[styles.achievementIconWrap, { backgroundColor: `${cfg.color}18`, borderColor: `${cfg.color}35` }]}>
            <Icon name={cfg.icon} size={26} color={cfg.color} />
          </View>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={styles.achievementTitle}>{ach.title || cfg.label}</Text>
            {matchLabel && <Text style={styles.achievementSub}> in {matchLabel}</Text>}
            {tournamentLabel && <Text style={styles.achievementSub}>🏆 {tournamentLabel}</Text>}
            <Text style={styles.achievementDate}>{ach.awardedAt ? new Date(ach.awardedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}</Text>
          </View>
          <View style={[styles.achievementBadge, { backgroundColor: `${cfg.color}18` }]}>
            <Text style={[styles.achievementBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
        </View>
      );
    });
  };

  return (
    <View style={styles.container}>
      {/* Transparent back nav overlaid on banner */}
      <View style={[styles.navBarAbsolute, { paddingTop: insets.top }]} pointerEvents="box-none">
        <View style={styles.navBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.navBackBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Icon name="arrow-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <TouchableOpacity style={styles.navShareBtn} onPress={handleSharePress} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Icon name="share-social-outline" size={20} color="#FFFFFF" />
            </TouchableOpacity>
            {!isOwnProfile && (
              <TouchableOpacity style={styles.navShareBtn} onPress={() => setShowMenuModal(true)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Icon name="ellipsis-vertical" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} colors={[colors.primary]} />
        }
      >
        {/* ── HERO BANNER — full-bleed profile photo with gradient overlay ── */}
        <View style={styles.heroBanner}>
          {/* Background image — fills entire banner */}
          {photoUrl ? (
            <Image
              source={{ uri: getImageUrl(photoUrl) }}
              style={styles.heroBgImage}
              resizeMode="cover"
            />
          ) : (
            <Image
              source={SPORTVERSE_LOGO}
              style={styles.heroBgImageFallback}
              resizeMode="cover"
            />
          )}

          {/* Gradient + overlay content sits on top via zIndex */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.15)', 'rgba(0,0,0,0.80)', 'rgba(0,0,0,0.97)']}
            locations={[0, 0.3, 0.68, 1]}
            style={styles.heroBannerGradient}
            pointerEvents="box-none"
          >

            {/* ── bottom content block ── */}
            <View style={styles.heroOverlayContent}>
              {/* Name */}
              <Text style={styles.heroName}>{viewedPlayer.name}</Text>

              {/* Clean Meta Info Row (Role • Batting Style • Bowling Style) */}
              <View style={styles.heroMetaRow}>
                <View style={styles.heroMetaItem}>
                  <MCIcon name="cricket" size={13} color={colors.primary} style={{ marginRight: 4 }} />
                  <Text style={styles.heroRoleHighlight}>{viewedPlayer.playingRole || 'Cricket Player'}</Text>
                </View>
                {viewedPlayer.battingStyle ? (
                  <>
                    <Text style={styles.heroMetaDot}>•</Text>
                    <Text style={styles.heroMetaText}>{viewedPlayer.battingStyle}</Text>
                  </>
                ) : null}
                {viewedPlayer.bowlingStyle && viewedPlayer.bowlingStyle !== 'None' ? (
                  <>
                    <Text style={styles.heroMetaDot}>•</Text>
                    <Text style={styles.heroMetaText}>{viewedPlayer.bowlingStyle}</Text>
                  </>
                ) : null}
              </View>

              {/* Special Player Badges / Tags (Non-Pill Sleek Badges) */}
              {(() => {
                const tags = getPlayerTags(viewedPlayer);
                if (!tags || tags.length === 0) return null;
                return (
                  <View style={styles.heroTagsRow}>
                    {tags.map((tag, tIdx) => (
                      <TouchableOpacity
                        key={tIdx}
                        onPress={() => setSelectedTagDefinition(tag)}
                        activeOpacity={0.7}
                        style={styles.heroTagBadge}
                      >
                        <MCIcon
                          name={tag.type === 'batting' ? 'lightning-bolt' : 'fire'}
                          size={12}
                          color={colors.primary}
                          style={{ marginRight: 4 }}
                        />
                        <Text style={styles.heroTagBadgeText}>{tag.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                );
              })()}

              {/* Location + Follow row */}
              <View style={styles.heroBottomRow}>
                {(() => {
                  const city = viewedPlayer.city || viewedPlayer.userId?.city || viewedPlayer.location;
                  const state = viewedPlayer.state || viewedPlayer.userId?.state;
                  const locStr = [city, state].filter(Boolean).join(', ');
                  return (
                    <View style={styles.heroLocationRow}>
                      <MCIcon name="map-marker" size={13} color={colors.primary} style={{ marginRight: 4 }} />
                      <Text style={styles.heroLocationText}>{locStr || 'Location not set'}</Text>
                    </View>
                  );
                })()}

                {!isOwnProfile && (
                  <TouchableOpacity
                    style={[styles.heroFollowBtn, isFollowing && styles.heroFollowingBtn]}
                    onPress={handleFollowToggle}
                    activeOpacity={0.8}
                  >
                    <Icon
                      name={isFollowing ? 'checkmark-circle' : 'person-add-outline'}
                      size={14}
                      color={isFollowing ? colors.primary : '#000'}
                      style={{ marginRight: 5 }}
                    />
                    <Text style={[styles.heroFollowBtnText, isFollowing && styles.heroFollowingBtnText]}>
                      {isFollowing ? 'Following' : 'Follow'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* ── CAREER STATS STRIP ── */}
        <View style={styles.statsStrip}>
          <TouchableOpacity style={styles.statsStripItem} onPress={() => loadSocialList('followers')}>
            <Text style={styles.statsStripValue}>{viewedPlayer.followers?.length || 0}</Text>
            <Text style={styles.statsStripLabel}>Followers</Text>
          </TouchableOpacity>
          <View style={styles.statsStripDivider} />
          <View style={styles.statsStripItem}>
            <Text style={styles.statsStripValue}>{career.matches || 0}</Text>
            <Text style={styles.statsStripLabel}>Matches</Text>
          </View>
          <View style={styles.statsStripDivider} />
          <View style={styles.statsStripItem}>
            <Text style={styles.statsStripValue}>{career.batting?.runs || batting.runs || 0}</Text>
            <Text style={styles.statsStripLabel}>Runs</Text>
          </View>
          <View style={styles.statsStripDivider} />
          <View style={styles.statsStripItem}>
            <Text style={styles.statsStripValue}>{career.bowling?.wickets || bowling.wickets || 0}</Text>
            <Text style={styles.statsStripLabel}>Wickets</Text>
          </View>
          <View style={styles.statsStripDivider} />
          <TouchableOpacity style={styles.statsStripItem} onPress={() => loadSocialList('following')}>
            <Text style={styles.statsStripValue}>{viewedPlayer.following?.length || 0}</Text>
            <Text style={styles.statsStripLabel}>Following</Text>
          </TouchableOpacity>
        </View>

        {/* Tab Bar */}
        <View style={styles.tabBar}>
          {TABS.map(tab => (
            <TouchableOpacity key={tab.key} style={[styles.tabItem, activeTab === tab.key && styles.tabItemActive]} onPress={() => setActiveTab(tab.key)} activeOpacity={0.8}>
              <Icon name={tab.icon} size={16} color={activeTab === tab.key ? colors.primary : colors.textTertiary} />
              <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab Content */}
        <View style={{ paddingTop: 8 }}>
          {activeTab === 'stats'        && renderStatsTab()}
          {activeTab === 'matches'      && renderMatchesTab()}
          {activeTab === 'teams'        && renderTeamsTab()}
          {activeTab === 'achievements' && renderAchievementsTab()}
        </View>
        <View style={{ height: 48 }} />
      </ScrollView>

      {/* Social Modal */}
      <Modal visible={socialModalVisible} animationType="slide" transparent onRequestClose={() => setSocialModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{socialType === 'followers' ? 'Followers' : 'Following'}<Text style={styles.modalCount}> ({socialList.length})</Text></Text>
              <TouchableOpacity onPress={() => setSocialModalVisible(false)} style={styles.modalCloseBtn}><Icon name="close" size={20} color={colors.textSecondary} /></TouchableOpacity>
            </View>
            {socialLoading ? (
              <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: 48 }} />
            ) : socialList.length === 0 ? (
              <View style={styles.emptyWrap}><Icon name="people-outline" size={52} color={colors.textTertiary} /><Text style={styles.emptyText}>No users yet</Text></View>
            ) : (
              <FlatList data={socialList} keyExtractor={item => item._id}
                contentContainerStyle={{ paddingBottom: 24 }}
                renderItem={({ item }) => {
                  // Try all possible image sources
                  const itemPhoto = item.photo || item.userId?.profilePicture || item.userId?.photo;
                  const hasError = imgErrors[item._id];
                  const imageUrl = getImageUrl(itemPhoto);
                  return (
                    <View style={styles.socialListItem}>
                      <TouchableOpacity style={styles.socialListLeft} onPress={() => { setSocialModalVisible(false); navigation.push('PlayerDetail', { id: item._id }); }}>
                        {imageUrl && !hasError ? (
                          <Image 
                            source={{ uri: imageUrl }} 
                            style={styles.listAvatar} 
                            onError={() => setImgErrors(prev => ({ ...prev, [item._id]: true }))} 
                          />
                        ) : (
                          <View style={styles.listAvatarFallback}>
                            <Text style={{ fontSize: 16, fontFamily: Typography.fontFamily.bold, color: colors.primary }}>
                              {(item.name || '?').charAt(0).toUpperCase()}
                            </Text>
                          </View>
                        )}
                        <View style={{ flex: 1 }}>
                          <Text style={styles.listName}>{item.name}</Text>
                          <Text style={styles.listRole}>{item.playingRole || 'Cricket Player'}</Text>
                        </View>
                      </TouchableOpacity>
                      {isOwnProfile && (
                        <TouchableOpacity
                          style={styles.listActionBtn}
                          onPress={() => socialType === 'followers'
                            ? handleRemoveFollower(item._id, item.name)
                            : handleUnfollowFromList(item._id, item.name)
                          }
                        >
                          <Text style={styles.listActionText}>{socialType === 'followers' ? 'Remove' : 'Unfollow'}</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                }}
              />
            )}
            {/* SafeAreaView bottom — ensures nav bar doesn't cut off the list */}
            <SafeAreaView edges={['bottom']} />
          </View>
        </View>
      </Modal>

      {/* Tag Modal */}
      <Modal visible={!!selectedTagDefinition} transparent animationType="fade" onRequestClose={() => setSelectedTagDefinition(null)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setSelectedTagDefinition(null)}>
          <View style={[styles.modalSheet, { width: '80%', alignItems: 'center', alignSelf: 'center', marginBottom: 'auto', marginTop: 'auto', borderRadius: 20 }]}>
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primaryAlpha20, justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
              <Icon name="pricetag" size={24} color={colors.primary} />
            </View>
            <Text style={{ fontSize: 18, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary, marginBottom: 8, textAlign: 'center' }}>{selectedTagDefinition?.name}</Text>
            <Text style={{ fontSize: 14, fontFamily: Typography.fontFamily.regular, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 }}>{selectedTagDefinition?.desc}</Text>
            <TouchableOpacity style={{ marginTop: 24, paddingVertical: 10, paddingHorizontal: 24, backgroundColor: colors.primary, borderRadius: BorderRadius.md }} onPress={() => setSelectedTagDefinition(null)}>
              <Text style={{ color: colors.background, fontFamily: Typography.fontFamily.bold }}>Got It</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Fullscreen Image Modal */}
      <Modal visible={imageModalVisible} transparent animationType="fade" onRequestClose={() => setImageModalVisible(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center' }}>
          <TouchableOpacity style={{ position: 'absolute', top: 50, right: 20, zIndex: 10, padding: 10 }} onPress={() => setImageModalVisible(false)}>
            <Icon name="close" size={28} color="#fff" />
          </TouchableOpacity>
          <Image 
            source={{ uri: photoUrl ? getImageUrl(photoUrl) : 'https://via.placeholder.com/400' }} 
            style={{ 
              width: 280, 
              height: 280, 
              borderRadius: 140, 
              borderWidth: 4, 
              borderColor: colors.primary, 
              resizeMode: 'cover' 
            }} 
          />
        </View>
      </Modal>

      {/* Menu Modal (Block/Report options) */}
      <Modal visible={showMenuModal} animationType="slide" transparent onRequestClose={() => setShowMenuModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowMenuModal(false)}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Actions</Text>
              <TouchableOpacity onPress={() => setShowMenuModal(false)} style={styles.modalCloseBtn}><Icon name="close" size={20} color={colors.textSecondary} /></TouchableOpacity>
            </View>
            <View style={{ paddingVertical: 12, gap: 12 }}>
              <TouchableOpacity 
                style={{ flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border }} 
                onPress={() => { setShowMenuModal(false); setShowReportModal(true); }}
              >
                <Icon name="flag-outline" size={20} color={colors.primary} style={{ marginRight: 12 }} />
                <Text style={{ fontSize: 16, color: colors.textPrimary, fontFamily: Typography.fontFamily.semiBold }}>Report Player</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={{ flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: 'rgba(244,67,54,0.06)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(244,67,54,0.15)' }} 
                onPress={handleBlockUser}
              >
                <Icon name="ban" size={20} color={colors.error} style={{ marginRight: 12 }} />
                <Text style={{ fontSize: 16, color: colors.error, fontFamily: Typography.fontFamily.semiBold }}>Block Player</Text>
              </TouchableOpacity>
            </View>
            <SafeAreaView edges={['bottom']} />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Report Modal */}
      <Modal visible={showReportModal} animationType="slide" transparent onRequestClose={() => setShowReportModal(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalSheet, { maxHeight: '90%', paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Report Profile</Text>
              <TouchableOpacity onPress={() => setShowReportModal(false)} style={styles.modalCloseBtn}><Icon name="close" size={20} color={colors.textSecondary} /></TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={{ fontSize: 14, color: colors.textSecondary, fontFamily: Typography.fontFamily.regular, marginBottom: 16, lineHeight: 22 }}>
                Please select a reason for reporting this profile. Our team will review the account and take appropriate action.
              </Text>
              
              <View style={{ gap: 8, marginBottom: 20 }}>
                {[
                  { key: 'inappropriate_name', label: 'Inappropriate Profile Name' },
                  { key: 'offensive_photo', label: 'Offensive Profile Photo' },
                  { key: 'harassment', label: 'Harassment or Abuse' },
                  { key: 'spam', label: 'Spam or Fake Profile' },
                  { key: 'other', label: 'Other Reason' }
                ].map(item => {
                  const isSelected = reportReason === item.key;
                  return (
                    <TouchableOpacity 
                      key={item.key}
                      style={{ 
                        flexDirection: 'row', alignItems: 'center', padding: 14, 
                        backgroundColor: isSelected ? 'rgba(255,204,0,0.1)' : colors.surface,
                        borderRadius: 12, borderWidth: 1, borderColor: isSelected ? colors.primary : colors.border
                      }}
                      onPress={() => setReportReason(item.key)}
                    >
                      <View style={{ 
                        width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: isSelected ? colors.primary : colors.textTertiary,
                        justifyContent: 'center', alignItems: 'center', marginRight: 12
                      }}>
                        {isSelected && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary }} />}
                      </View>
                      <Text style={{ fontSize: 15, color: colors.textPrimary, fontFamily: isSelected ? Typography.fontFamily.semiBold : Typography.fontFamily.regular }}>
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={{ fontSize: 13, color: colors.textSecondary, fontFamily: Typography.fontFamily.semiBold, marginBottom: 8, marginLeft: 4 }}>
                Additional Details (Optional)
              </Text>
              <View style={{ 
                height: 80, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border,
                paddingHorizontal: 12, marginBottom: 24
              }}>
                <TextInput
                  style={{ flex: 1, color: '#FFF', fontSize: 14, textAlignVertical: 'top', paddingTop: 8 }}
                  placeholder="Explain why you are flagging this profile..."
                  placeholderTextColor={colors.textTertiary}
                  value={reportDetails}
                  onChangeText={setReportDetails}
                  multiline
                  numberOfLines={3}
                />
              </View>

              <TouchableOpacity 
                style={{ 
                  height: 48, borderRadius: 12, backgroundColor: colors.primary, 
                  justifyContent: 'center', alignItems: 'center', flexDirection: 'row'
                }}
                onPress={handleReportUser}
                disabled={reportLoading}
              >
                {reportLoading ? (
                  <ActivityIndicator color={colors.background} size="small" />
                ) : (
                  <Text style={{ color: colors.background, fontSize: 16, fontFamily: Typography.fontFamily.bold }}>Submit Report</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── SHARE PREVIEW MODAL ── */}
      <SharePreviewModal
        visible={shareModalVisible}
        onClose={() => setShareModalVisible(false)}
        title={viewedPlayer?.name}
        shareUrl={`https://www.scoreverse.in/player/${viewedPlayer?._id}`}
      >
        <PlayerProfilePoster
          player={viewedPlayer}
          career={career}
          batting={batting}
          bowling={bowling}
        />
      </SharePreviewModal>
    </View>
  );
};

const createStyles = (colors, shadows, isDark) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centeredState: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background, paddingHorizontal: 32 },
  loadingText: { marginTop: 14, fontSize: 14, color: colors.textSecondary, fontFamily: Typography.fontFamily.medium },
  errorText: { marginTop: 14, fontSize: 16, color: colors.textSecondary, fontFamily: Typography.fontFamily.medium, marginBottom: 24, textAlign: 'center' },
  goBackBtn: { backgroundColor: colors.primary, borderRadius: BorderRadius.xl, paddingHorizontal: 28, paddingVertical: 13 },
  goBackBtnText: { color: '#000', fontFamily: Typography.fontFamily.bold, fontSize: 15 },

  // ── Floating nav bar over banner ──────────────────────────────────────────
  navBarAbsolute: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20 },
  navBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, height: 52 },
  navBackBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.55)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  navShareBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.55)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },

  scrollContent: { paddingBottom: 20 },

  // ── Hero Banner — full-bleed photo + gradient ─────────────────────────────
  heroBanner: {
    width: '100%',
    height: Dimensions.get('window').height * 0.35,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#111',
  },
  heroBgImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    zIndex: 0,
  },
  // Fallback image: anchor to top so the bottom is cropped by overflow:hidden
  heroBgImageFallback: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    // Intentionally taller than the banner so the bottom gets cropped
    height: '140%',
    width: '100%',
    zIndex: 0,
  },
  heroBgFallback: {
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBgFallbackLetter: {
    fontSize: 80,
    fontFamily: Typography.fontFamily.bold,
    color: colors.primary,
    opacity: 0.4,
  },
  heroBannerGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  heroOverlayContent: {
    position: 'absolute',
    bottom: 20,
    left: 18,
    right: 18,
    zIndex: 2,
  },
  heroPoweredBy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  heroPoweredByText: {
    fontSize: 10,
    fontFamily: Typography.fontFamily.medium,
    color: 'rgba(255,204,0,0.6)',
    letterSpacing: 0.5,
  },
  heroBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  heroFollowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 7,
  },
  heroFollowingBtn: {
    backgroundColor: 'rgba(255,204,0,0.12)',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  heroFollowBtnText: {
    fontSize: 13,
    fontFamily: Typography.fontFamily.bold,
    color: '#000',
  },
  heroFollowingBtnText: { color: colors.primary },

  // ── Name / Role ───────────────────────────────────────────────────────────
  heroName: {
    fontSize: 26,
    fontFamily: Typography.fontFamily.bold,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 0.3,
    textAlign: 'left',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  heroMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 6,
    gap: 6,
  },
  heroMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroRoleHighlight: {
    fontSize: 13,
    fontFamily: Typography.fontFamily.bold,
    color: colors.primary,
    letterSpacing: 0.2,
  },
  heroMetaDot: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.4)',
  },
  heroMetaText: {
    fontSize: 13,
    fontFamily: Typography.fontFamily.medium,
    color: '#E0E0E0',
  },
  heroTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 7,
  },
  heroTagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 204, 0, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 204, 0, 0.35)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  heroTagBadgeText: {
    fontSize: 11,
    fontFamily: Typography.fontFamily.bold,
    color: colors.primary,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  heroLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroLocationText: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.medium,
    color: 'rgba(255, 255, 255, 0.75)',
  },
  heroFollowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  heroFollowingBtn: {
    backgroundColor: 'rgba(255,204,0,0.12)',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  heroFollowBtnText: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.bold,
    color: '#000',
  },
  heroFollowingBtnText: { color: colors.primary },

  // ── Stats strip ──────────────────────────────────────────────────────────
  statsStrip: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 14,
  },
  statsStripItem: { flex: 1, alignItems: 'center' },
  statsStripValue: { fontSize: 17, fontFamily: Typography.fontFamily.bold, color: colors.primary },
  statsStripLabel: { fontSize: 10, fontFamily: Typography.fontFamily.medium, color: colors.textTertiary, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  statsStripDivider: { width: 1, height: 32, backgroundColor: colors.border, alignSelf: 'center' },

  // ── Follow button ─────────────────────────────────────────────────────────
  followBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.primary, borderRadius: 20,
    paddingVertical: 9, paddingHorizontal: 24,
    alignSelf: 'center', minWidth: 130,
  },
  followingBtn: { backgroundColor: 'rgba(255,204,0,0.08)', borderWidth: 1.5, borderColor: colors.primary },
  followBtnText: { color: '#000', fontSize: 14, fontFamily: Typography.fontFamily.bold },
  followingBtnText: { color: colors.primary },

  // ── Tab bar ───────────────────────────────────────────────────────────────
  tabBar: { flexDirection: 'row', backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  tabItem: { flex: 1, alignItems: 'center', paddingVertical: 12, gap: 3, borderBottomWidth: 2.5, borderBottomColor: 'transparent' },
  tabItemActive: { borderBottomColor: colors.primary },
  tabLabel: { fontSize: 10, fontFamily: Typography.fontFamily.semiBold, color: colors.textTertiary },
  tabLabelActive: { color: colors.primary },

  // ── Ball type filter ──────────────────────────────────────────────────────
  filterSection: { marginHorizontal: 16, marginTop: 16, marginBottom: 8, backgroundColor: colors.surface, borderRadius: BorderRadius.xl, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', paddingTop: 12, paddingBottom: 4 },
  filterHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, marginBottom: 10 },
  filterIconWrap: { width: 20, height: 20, borderRadius: 6, backgroundColor: colors.primaryAlpha10, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.primaryAlpha20 },
  filterHeaderText: { fontSize: 10, fontFamily: Typography.fontFamily.bold, color: colors.textTertiary, letterSpacing: 1.2 },
  filterScrollContent: { paddingHorizontal: 12, paddingBottom: 12, gap: 8, alignItems: 'center' },
  filterPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 24, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface },
  filterPillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterPillCircular: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  filterPillCircularActive: {
    borderColor: colors.primary,
  },
  filterPillCircularImage: {
    width: '100%',
    height: '100%',
  },

  // ── Section headers ───────────────────────────────────────────────────────
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, marginBottom: 10, marginTop: 16 },
  sectionIconWrap: { width: 26, height: 26, borderRadius: 8, backgroundColor: colors.primaryAlpha10, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.primaryAlpha20 },
  sectionTitle: { fontSize: 13, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary, textTransform: 'uppercase', letterSpacing: 1 },

  // ── Cards ─────────────────────────────────────────────────────────────────
  card: { backgroundColor: colors.surface, borderRadius: BorderRadius.xl, padding: 16, marginHorizontal: 16, marginBottom: 16, borderWidth: 1, borderColor: colors.border, ...shadows.sm },
  cardDivider: { height: 1, backgroundColor: colors.border, marginVertical: 14 },
  statsGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  statPill: { flex: 1, alignItems: 'center', backgroundColor: colors.surface, borderRadius: 10, paddingVertical: 10, marginHorizontal: 3, borderWidth: 1, borderColor: colors.border },
  statPillVal: { fontSize: 16, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary },
  statPillValHL: { color: colors.primary },
  statPillLbl: { fontSize: 10, fontFamily: Typography.fontFamily.medium, color: colors.textTertiary, marginTop: 3, textAlign: 'center' },
  infoGrid: { gap: 8 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  infoLabel: { fontSize: 13, fontFamily: Typography.fontFamily.regular, color: colors.textSecondary },
  infoValuePill: { backgroundColor: colors.surface, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: colors.border },
  infoValue: { fontSize: 12, fontFamily: Typography.fontFamily.semiBold, color: colors.textPrimary },

  // ── Match cards ───────────────────────────────────────────────────────────
  matchCard: { marginHorizontal: 16, marginBottom: 10, padding: 14, backgroundColor: colors.surface, borderRadius: BorderRadius.xl, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', ...shadows.sm },
  matchCardLive: { borderColor: colors.primaryAlpha30, shadowColor: colors.primary, shadowOpacity: 0.15, shadowRadius: 8 },
  matchCardLeft: { marginRight: 12, alignItems: 'flex-start', minWidth: 80 },
  matchBallTypeBadge: { backgroundColor: colors.primaryAlpha10, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: colors.primaryAlpha20, marginBottom: 5 },
  matchBallTypeBadgeText: { fontSize: 10, fontFamily: Typography.fontFamily.bold, color: colors.primary },
  liveBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 71, 87, 0.15)', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: 'rgba(255, 71, 87, 0.3)' },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FF4757', marginRight: 5 },
  liveText: { color: '#FF4757', fontSize: 9, fontFamily: Typography.fontFamily.bold, letterSpacing: 0.5 },
  matchDate: { fontSize: 11, fontFamily: Typography.fontFamily.regular, color: colors.textTertiary },
  matchCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)', paddingBottom: 8, marginBottom: 10 },
  matchTeamsText: { fontSize: 13, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary },
  matchCardBody: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  matchCardFooter: { flexDirection: 'row', alignItems: 'center', gap: 6, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', paddingTop: 8 },
  matchStatusText: { fontSize: 11, fontFamily: Typography.fontFamily.medium, color: colors.textSecondary, flex: 1 },
  matchCardCenter: { flex: 1 },
  matchRunsValue: { fontSize: 22, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary },
  matchRunsLabel: { fontSize: 11, fontFamily: Typography.fontFamily.regular, color: colors.textSecondary, marginTop: 2 },
  matchDNB: { fontSize: 14, fontFamily: Typography.fontFamily.medium, color: colors.textTertiary, fontStyle: 'italic' },

  // ── Team cards ────────────────────────────────────────────────────────────
  teamCard: { marginHorizontal: 16, marginBottom: 10, padding: 16, backgroundColor: colors.surface, borderRadius: BorderRadius.xl, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', ...shadows.sm },
  teamLogo: { width: 46, height: 46, borderRadius: 23 },
  teamLogoFallback: { 
    width: 46, 
    height: 46, 
    borderRadius: 23, 
    backgroundColor: isDark ? 'rgba(255,204,0,0.15)' : '#FFF9DB', 
    alignItems: 'center', 
    justifyContent: 'center', 
    borderWidth: 1.5, 
    borderColor: isDark ? 'rgba(255,204,0,0.35)' : '#FFE066' 
  },
  teamLogoInitial: {
    fontSize: 20,
    fontFamily: Typography.fontFamily.bold,
    color: isDark ? '#FFD400' : colors.primaryDark,
  },
  teamName: { fontSize: 15, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary },
  teamCategory: { fontSize: 12, fontFamily: Typography.fontFamily.regular, color: colors.textSecondary, marginTop: 2 },

  // ── Achievement cards ─────────────────────────────────────────────────────
  achievementCard: { marginHorizontal: 16, marginBottom: 10, padding: 16, backgroundColor: colors.surface, borderRadius: BorderRadius.xl, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'flex-start', ...shadows.sm },
  achievementIconWrap: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1, flexShrink: 0, backgroundColor: 'rgba(255,204,0,0.1)', borderColor: 'rgba(255,204,0,0.25)' },
  achievementTitle: { fontSize: 15, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary, marginBottom: 3 },
  achievementSub: { fontSize: 12, fontFamily: Typography.fontFamily.regular, color: colors.textSecondary, marginTop: 2 },
  achievementDate: { fontSize: 11, fontFamily: Typography.fontFamily.regular, color: colors.textTertiary, marginTop: 5 },
  achievementBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, marginLeft: 8, flexShrink: 0, marginTop: 2, backgroundColor: 'rgba(255,204,0,0.1)', borderWidth: 1, borderColor: 'rgba(255,204,0,0.2)' },
  achievementBadgeText: { fontSize: 10, fontFamily: Typography.fontFamily.semiBold, color: colors.primary },

  // ── Empty / loading states ────────────────────────────────────────────────
  tabCenteredEmpty: { alignItems: 'center', paddingVertical: 64 },
  emptyText: { marginTop: 14, fontSize: 14, color: colors.textTertiary, fontFamily: Typography.fontFamily.medium },
  emptySubText: { marginTop: 6, fontSize: 12, color: colors.textTertiary, fontFamily: Typography.fontFamily.regular },
  emptyWrap: { alignItems: 'center', paddingVertical: 48 },

  // ── Social modal ──────────────────────────────────────────────────────────
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 36, maxHeight: '85%', borderTopWidth: 1, borderColor: colors.border },
  modalHandle: { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 18 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary },
  modalCount: { color: colors.textSecondary, fontFamily: Typography.fontFamily.regular },
  modalCloseBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  socialListItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  socialListLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
  listAvatar: { width: 44, height: 44, borderRadius: 22 },
  listAvatarFallback: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primaryAlpha10, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.primaryAlpha20 },
  listName: { fontSize: 15, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary },
  listRole: { fontSize: 12, fontFamily: Typography.fontFamily.regular, color: colors.textSecondary, marginTop: 1 },
  listActionBtn: { borderRadius: 8, borderWidth: 1, borderColor: colors.errorLight, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: 'rgba(244,67,54,0.06)' },
  listActionText: { fontSize: 12, fontFamily: Typography.fontFamily.semiBold, color: colors.error },

});

export default PlayerDetailScreen;
