import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Image, Modal, FlatList, Platform, ToastAndroid
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchPlayerById, followPlayer, fetchMyPlayer,
  fetchPlayerAchievements, fetchPlayerBallTypes, fetchMatchHistory,
} from '../playerSlice';
import { Colors, Typography, BorderRadius, Shadows } from '../../../theme/theme';
import { showCustomAlert } from '../../../components/CustomAlert';
import Icon from 'react-native-vector-icons/Ionicons';
import { getImageUrl } from '../../../api/axios';
import api from '../../../api/axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getPlayerTags } from '../../../utils/playerTags';

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
};

const BallColors = { Tennis: '#10B981', 'Hard Tennis': '#F59E0B', Leather: '#EF4444', Other: '#8B5CF6' };

const PlayerDetailScreen = ({ navigation, route }) => {
  const { id } = route.params || {};
  const dispatch = useDispatch();

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

  useEffect(() => {
    const fetchAll = async () => {
      if (!id) return;
      setLocalLoading(true);
      try {
        const key = 'SportVerse_ViewedPlayers';
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

  const handleRemoveFollower = async (followerId) => {
    try { await api.delete(`/players/${id}/followers/${followerId}`); setSocialList(prev => prev.filter(p => p._id !== followerId)); dispatch(fetchPlayerById({ id, trackView: false })); }
    catch (err) { showCustomAlert('Error', err.response?.data?.message || 'Failed to remove follower'); }
  };

  const handleUnfollowFromList = async (followingId) => {
    try { await api.delete(`/players/${id}/following/${followingId}`); setSocialList(prev => prev.filter(p => p._id !== followingId)); dispatch(fetchPlayerById({ id, trackView: false })); }
    catch (err) { showCustomAlert('Error', err.response?.data?.message || 'Failed to unfollow'); }
  };

  if (localLoading) {
    return (<SafeAreaView style={styles.centeredState}><ActivityIndicator size="large" color={Colors.primary} /><Text style={styles.loadingText}>Loading profile…</Text></SafeAreaView>);
  }
  if (!viewedPlayer || viewedPlayer._id !== id) {
    return (<SafeAreaView style={styles.centeredState}><Icon name="alert-circle-outline" size={52} color={Colors.error} /><Text style={styles.errorText}>Player profile not found</Text><TouchableOpacity style={styles.goBackBtn} onPress={() => navigation.goBack()}><Text style={styles.goBackBtnText}>Go Back</Text></TouchableOpacity></SafeAreaView>);
  }

  const viewedPlayerUserId = viewedPlayer.userId?._id || viewedPlayer.userId;
  const isOwnProfile = (myProfile && myProfile._id === viewedPlayer._id) || (viewedPlayerUserId && user && viewedPlayerUserId === user._id);
  const isFollowing = myProfile?.following?.includes(viewedPlayer._id);
  const photoUrl = viewedPlayer.photo || viewedPlayer.userId?.photo || null;

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
      <View style={styles.sectionIconWrap}><Icon name={icon} size={15} color={Colors.primary} /></View>
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
          <View style={styles.filterIconWrap}><Icon name="filter-outline" size={12} color={Colors.primary} /></View>
          <Text style={styles.filterHeaderText}>FILTER BY BALL TYPE</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScrollContent}>
          <TouchableOpacity style={[styles.filterPill, ballTypeFilter === 'Overall' && styles.filterPillActive]} onPress={() => setBallTypeFilter('Overall')} activeOpacity={0.75}>
            <Icon name="globe-outline" size={13} color={ballTypeFilter === 'Overall' ? '#fff' : Colors.textSecondary} style={{ marginRight: 5 }} />
            <Text style={[styles.filterPillText, ballTypeFilter === 'Overall' && styles.filterPillTextActive]}>All</Text>
          </TouchableOpacity>
          {availableBallTypes.map(bt => {
            const isActive = ballTypeFilter === bt;
            const pillColor = BallColors[bt] || Colors.primary;
            return (
              <TouchableOpacity key={bt} style={[styles.filterPill, isActive && { backgroundColor: pillColor, borderColor: pillColor }]} onPress={() => setBallTypeFilter(bt)} activeOpacity={0.75}>
                <View style={[styles.filterPillDot, { backgroundColor: isActive ? '#fff' : pillColor }]} />
                <Text style={[styles.filterPillText, isActive && styles.filterPillTextActive]}>{bt}</Text>
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
      <SectionHeader icon="trophy-outline" label="Career" />
      <View style={styles.card}>
        <View style={styles.statsGrid}>
          <StatPill value={career.matches || 0} label="Matches" />
          <StatPill value={career.wins || 0} label="Wins" highlight />
          <StatPill value={career.losses || 0} label="Losses" />
          <StatPill value={winPct} label="Win %" highlight />
        </View>
      </View>
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
          <StatPill value={bowling.runs || 0} label="Runs" />
          <StatPill value={bowling.bestWickets || 0} label="Best" highlight />
          <StatPill value={bowling.maidens || 0} label="Maidens" />
        </View>
      </View>
      <SectionHeader icon="shield-checkmark-outline" label="Fielding" />
      <View style={styles.card}>
        <View style={styles.statsGrid}>
          <StatPill value={fielding.catches || 0} label="Catches" />
          <StatPill value={fielding.runOuts || 0} label="Run Outs" />
          <StatPill value={fielding.stumpings || 0} label="Stumpings" />
          <StatPill value={career.playerOfMatchAwards || 0} label="POTM" highlight />
        </View>
      </View>
    </>
  );

  const renderMatchesTab = () => {
    if (matchesLoading) return <View style={styles.tabCenteredEmpty}><ActivityIndicator color={Colors.primary} size="large" /></View>;
    if (!matchHistory || matchHistory.length === 0) return (
      <View style={styles.tabCenteredEmpty}>
        <Icon name="baseball-outline" size={52} color={Colors.textTertiary} />
        <Text style={styles.emptyText}>No match history yet</Text>
      </View>
    );
    return (
      <>
        <BallTypeFilter />
        {[...matchHistory].reverse().map((match, idx) => (
          <TouchableOpacity key={idx} style={styles.matchCard} activeOpacity={0.8}
            onPress={() => { if (match.matchId) navigation.navigate('MatchSummary', { matchId: match.matchId }); }}>
            <View style={styles.matchCardLeft}>
              <View style={styles.matchBallTypeBadge}>
                <Text style={styles.matchBallTypeBadgeText}>{match.ballType || 'N/A'}</Text>
              </View>
              <Text style={styles.matchDate}>{match.date ? new Date(match.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}</Text>
            </View>
            <View style={styles.matchCardCenter}>
              {match.runs !== null ? (
                <>
                  <Text style={styles.matchRunsValue}>{match.runs}{match.isNotOut ? '*' : ''}</Text>
                  <Text style={styles.matchRunsLabel}>{match.balls || 0} balls · {match.fours || 0}×4s · {match.sixes || 0}×6s</Text>
                </>
              ) : <Text style={styles.matchDNB}>Did Not Bat</Text>}
            </View>
            <Icon name="chevron-forward" size={16} color={Colors.textTertiary} />
          </TouchableOpacity>
        ))}
      </>
    );
  };

  const renderTeamsTab = () => {
    if (teamsLoading) return <View style={styles.tabCenteredEmpty}><ActivityIndicator color={Colors.primary} size="large" /></View>;
    const teams = playerTeams.length > 0 ? playerTeams : (viewedPlayer.teams || []);
    if (!teams || teams.length === 0) return (
      <View style={styles.tabCenteredEmpty}>
        <Icon name="people-outline" size={52} color={Colors.textTertiary} />
        <Text style={styles.emptyText}>Not part of any team yet</Text>
      </View>
    );
    return teams.map((team, idx) => (
      <TouchableOpacity key={team._id || idx} style={styles.teamCard} activeOpacity={0.8}
        onPress={() => { if (team._id) navigation.navigate('TeamDetail', { id: team._id }); }}>
        {team.logo ? (
          <Image source={{ uri: getImageUrl(team.logo) }} style={styles.teamLogo} />
        ) : (
          <View style={styles.teamLogoFallback}><Icon name="shield-outline" size={22} color={Colors.primary} /></View>
        )}
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={styles.teamName}>{team.name || 'Unknown Team'}</Text>
          {team.category && <Text style={styles.teamCategory}>{team.category}</Text>}
        </View>
        <Icon name="chevron-forward" size={16} color={Colors.textTertiary} />
      </TouchableOpacity>
    ));
  };

  const renderAchievementsTab = () => {
    if (!achievements || achievements.length === 0) return (
      <View style={styles.tabCenteredEmpty}>
        <Icon name="trophy-outline" size={52} color={Colors.textTertiary} />
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
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Icon name="arrow-back" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>{viewedPlayer.name}</Text>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Hero Card */}
        <View style={styles.heroCard}>
          <View style={styles.avatarRing}>
            {photoUrl ? (<Image source={{ uri: getImageUrl(photoUrl) }} style={styles.avatar} />) : (
              <View style={styles.avatarFallback}><Text style={styles.avatarFallbackLetter}>{viewedPlayer.name ? viewedPlayer.name.charAt(0).toUpperCase() : '?'}</Text></View>
            )}
          </View>
          <Text style={styles.heroName}>{viewedPlayer.name}</Text>
          <View style={styles.rolePill}>
            <Icon name="baseball-outline" size={12} color={Colors.primary} />
            <Text style={styles.roleText}>{viewedPlayer.playingRole || 'Cricket Player'}</Text>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8, justifyContent: 'center' }}>
            {getPlayerTags(viewedPlayer).map((tag, tIdx) => (
              <TouchableOpacity key={tIdx} onPress={() => setSelectedTagDefinition(tag)}
                style={{ backgroundColor: tag.type === 'batting' ? 'rgba(243,156,18,0.1)' : 'rgba(142,68,173,0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: tag.type === 'batting' ? 'rgba(243,156,18,0.3)' : 'rgba(142,68,173,0.3)' }}>
                <Text style={{ fontFamily: Typography.fontFamily.semiBold, color: tag.type === 'batting' ? '#F39C12' : '#8E44AD', fontSize: 11 }}>{tag.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {(viewedPlayer.city || viewedPlayer.state) && (
            <View style={styles.locationRow}>
              <Icon name="location-outline" size={13} color={Colors.textSecondary} />
              <Text style={styles.locationText}>{[viewedPlayer.city, viewedPlayer.state].filter(Boolean).join(', ')}</Text>
            </View>
          )}
          <View style={styles.socialRow}>
            <TouchableOpacity style={styles.socialItem} onPress={() => loadSocialList('followers')}>
              <Text style={styles.socialCount}>{viewedPlayer.followers?.length || 0}</Text>
              <Text style={styles.socialLabel}>Followers</Text>
            </TouchableOpacity>
            <View style={styles.socialSep} />
            <TouchableOpacity style={styles.socialItem} onPress={() => loadSocialList('following')}>
              <Text style={styles.socialCount}>{viewedPlayer.following?.length || 0}</Text>
              <Text style={styles.socialLabel}>Following</Text>
            </TouchableOpacity>
            <View style={styles.socialSep} />
            <View style={styles.socialItem}>
              <Text style={styles.socialCount}>{viewedPlayer.profileViews || 0}</Text>
              <Text style={styles.socialLabel}>Views</Text>
            </View>
          </View>
          {!isOwnProfile && (
            <TouchableOpacity style={[styles.followBtn, isFollowing && styles.followingBtn]} onPress={handleFollowToggle} activeOpacity={0.8}>
              <Icon name={isFollowing ? 'checkmark-circle' : 'person-add-outline'} size={15} color={isFollowing ? Colors.textSecondary : '#fff'} style={{ marginRight: 6 }} />
              <Text style={[styles.followBtnText, isFollowing && styles.followingBtnText]}>{isFollowing ? 'Following' : 'Follow'}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Tab Bar */}
        <View style={styles.tabBar}>
          {TABS.map(tab => (
            <TouchableOpacity key={tab.key} style={[styles.tabItem, activeTab === tab.key && styles.tabItemActive]} onPress={() => setActiveTab(tab.key)} activeOpacity={0.8}>
              <Icon name={tab.icon} size={16} color={activeTab === tab.key ? Colors.primary : Colors.textTertiary} />
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
              <TouchableOpacity onPress={() => setSocialModalVisible(false)} style={styles.modalCloseBtn}><Icon name="close" size={20} color={Colors.textSecondary} /></TouchableOpacity>
            </View>
            {socialLoading ? (
              <ActivityIndicator size="large" color={Colors.primary} style={{ marginVertical: 48 }} />
            ) : socialList.length === 0 ? (
              <View style={styles.emptyWrap}><Icon name="people-outline" size={52} color={Colors.textTertiary} /><Text style={styles.emptyText}>No users yet</Text></View>
            ) : (
              <FlatList data={socialList} keyExtractor={item => item._id} contentContainerStyle={{ paddingBottom: 40 }}
                renderItem={({ item }) => {
                  const itemPhoto = item.photo || item.userId?.photo;
                  return (
                    <View style={styles.socialListItem}>
                      <TouchableOpacity style={styles.socialListLeft} onPress={() => { setSocialModalVisible(false); navigation.push('PlayerDetail', { id: item._id }); }}>
                        {itemPhoto ? (<Image source={{ uri: getImageUrl(itemPhoto) }} style={styles.listAvatar} />) : (<View style={styles.listAvatarFallback}><Icon name="person" size={18} color={Colors.primary} /></View>)}
                        <View style={{ flex: 1 }}><Text style={styles.listName}>{item.name}</Text><Text style={styles.listRole}>{item.playingRole || 'Cricket Player'}</Text></View>
                      </TouchableOpacity>
                      {isOwnProfile && (
                        <TouchableOpacity style={styles.listActionBtn} onPress={() => { socialType === 'followers' ? handleRemoveFollower(item._id) : handleUnfollowFromList(item._id); }}>
                          <Text style={styles.listActionText}>{socialType === 'followers' ? 'Remove' : 'Unfollow'}</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                }}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* Tag Modal */}
      <Modal visible={!!selectedTagDefinition} transparent animationType="fade" onRequestClose={() => setSelectedTagDefinition(null)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setSelectedTagDefinition(null)}>
          <View style={[styles.modalSheet, { width: '80%', alignItems: 'center', alignSelf: 'center', marginBottom: 'auto', marginTop: 'auto', borderRadius: 20 }]}>
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.primaryAlpha20, justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
              <Icon name="pricetag" size={24} color={Colors.primary} />
            </View>
            <Text style={{ fontSize: 18, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary, marginBottom: 8, textAlign: 'center' }}>{selectedTagDefinition?.name}</Text>
            <Text style={{ fontSize: 14, fontFamily: Typography.fontFamily.regular, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 }}>{selectedTagDefinition?.desc}</Text>
            <TouchableOpacity style={{ marginTop: 24, paddingVertical: 10, paddingHorizontal: 24, backgroundColor: Colors.primary, borderRadius: BorderRadius.md }} onPress={() => setSelectedTagDefinition(null)}>
              <Text style={{ color: Colors.background, fontFamily: Typography.fontFamily.bold }}>Got It</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centeredState: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background, paddingHorizontal: 32 },
  loadingText: { marginTop: 14, fontSize: 14, color: Colors.textSecondary, fontFamily: Typography.fontFamily.medium },
  errorText: { marginTop: 14, fontSize: 16, color: Colors.textSecondary, fontFamily: Typography.fontFamily.medium, marginBottom: 24, textAlign: 'center' },
  goBackBtn: { backgroundColor: Colors.primary, borderRadius: BorderRadius.xl, paddingHorizontal: 28, paddingVertical: 13 },
  goBackBtnText: { color: '#fff', fontFamily: Typography.fontFamily.bold, fontSize: 15 },
  headerSafe: { backgroundColor: Colors.backgroundCard, borderBottomWidth: 1, borderBottomColor: Colors.border },
  header: { flexDirection: 'row', alignItems: 'center', height: 52, paddingHorizontal: 12 },
  headerBtn: { position: 'absolute', left: 12, zIndex: 10, width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  headerTitle: { flex: 1, fontSize: 17, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary, textAlign: 'center', includeFontPadding: false, lineHeight: 52 },
  scrollContent: { paddingBottom: 20 },
  heroCard: { backgroundColor: Colors.backgroundCard, alignItems: 'center', paddingTop: 32, paddingBottom: 24, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: Colors.border },
  avatarRing: { width: 96, height: 96, borderRadius: 48, borderWidth: 3, borderColor: Colors.primary, backgroundColor: Colors.backgroundElevated, overflow: 'hidden', marginBottom: 16 },
  avatar: { width: '100%', height: '100%' },
  avatarFallback: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.backgroundElevated },
  avatarFallbackLetter: { color: Colors.textPrimary, fontFamily: Typography.fontFamily.bold, fontSize: 36 },
  heroName: { fontSize: 22, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary, letterSpacing: 0.3 },
  rolePill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.primaryAlpha10, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, marginTop: 8, borderWidth: 1, borderColor: Colors.primaryAlpha20 },
  roleText: { fontSize: 12, fontFamily: Typography.fontFamily.semiBold, color: Colors.primary },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  locationText: { fontSize: 12, fontFamily: Typography.fontFamily.regular, color: Colors.textSecondary },
  socialRow: { flexDirection: 'row', alignItems: 'center', marginTop: 20, marginBottom: 4, width: '100%', backgroundColor: Colors.backgroundElevated, borderRadius: BorderRadius.xl, paddingVertical: 14, borderWidth: 1, borderColor: Colors.border },
  socialItem: { flex: 1, alignItems: 'center' },
  socialCount: { fontSize: 18, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary },
  socialLabel: { fontSize: 11, fontFamily: Typography.fontFamily.medium, color: Colors.textSecondary, marginTop: 2 },
  socialSep: { width: 1, height: 28, backgroundColor: Colors.border },
  followBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.primary, borderRadius: BorderRadius.xl, paddingHorizontal: 28, paddingVertical: 11, marginTop: 16 },
  followingBtn: { backgroundColor: Colors.primaryAlpha10, borderWidth: 1, borderColor: Colors.primaryAlpha20 },
  followBtnText: { color: '#000', fontSize: 14, fontFamily: Typography.fontFamily.bold },
  followingBtnText: { color: Colors.primary },
  tabBar: { flexDirection: 'row', backgroundColor: Colors.backgroundCard, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tabItem: { flex: 1, alignItems: 'center', paddingVertical: 12, gap: 3, borderBottomWidth: 2.5, borderBottomColor: 'transparent' },
  tabItemActive: { borderBottomColor: Colors.primary },
  tabLabel: { fontSize: 10, fontFamily: Typography.fontFamily.semiBold, color: Colors.textTertiary },
  tabLabelActive: { color: Colors.primary },
  filterSection: { marginHorizontal: 16, marginTop: 16, marginBottom: 8, backgroundColor: Colors.backgroundElevated, borderRadius: BorderRadius.xl, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden', paddingTop: 12, paddingBottom: 4 },
  filterHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, marginBottom: 10 },
  filterIconWrap: { width: 20, height: 20, borderRadius: 6, backgroundColor: Colors.primaryAlpha10, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.primaryAlpha20 },
  filterHeaderText: { fontSize: 10, fontFamily: Typography.fontFamily.bold, color: Colors.textTertiary, letterSpacing: 1.2 },
  filterScrollContent: { paddingHorizontal: 12, paddingBottom: 12, gap: 8, alignItems: 'center' },
  filterPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 24, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.backgroundCard },
  filterPillActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterPillDot: { width: 7, height: 7, borderRadius: 4, marginRight: 6 },
  filterPillText: { fontSize: 12, fontFamily: Typography.fontFamily.semiBold, color: Colors.textSecondary },
  filterPillTextActive: { color: '#fff' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, marginBottom: 10, marginTop: 16 },
  sectionIconWrap: { width: 26, height: 26, borderRadius: 8, backgroundColor: Colors.primaryAlpha10, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.primaryAlpha20 },
  sectionTitle: { fontSize: 13, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary, textTransform: 'uppercase', letterSpacing: 1 },
  card: { backgroundColor: Colors.backgroundCard, borderRadius: BorderRadius.xl, padding: 16, marginHorizontal: 16, marginBottom: 16, borderWidth: 1, borderColor: Colors.border, ...Shadows.sm },
  cardDivider: { height: 1, backgroundColor: Colors.border, marginVertical: 14 },
  statsGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  statPill: { flex: 1, alignItems: 'center', backgroundColor: Colors.backgroundElevated, borderRadius: 10, paddingVertical: 10, marginHorizontal: 3, borderWidth: 1, borderColor: Colors.border },
  statPillVal: { fontSize: 16, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary },
  statPillValHL: { color: Colors.primary },
  statPillLbl: { fontSize: 10, fontFamily: Typography.fontFamily.medium, color: Colors.textTertiary, marginTop: 3, textAlign: 'center' },
  infoGrid: { gap: 8 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  infoLabel: { fontSize: 13, fontFamily: Typography.fontFamily.regular, color: Colors.textSecondary },
  infoValuePill: { backgroundColor: Colors.backgroundElevated, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: Colors.border },
  infoValue: { fontSize: 12, fontFamily: Typography.fontFamily.semiBold, color: Colors.textPrimary },
  matchCard: { marginHorizontal: 16, marginBottom: 10, padding: 14, backgroundColor: Colors.backgroundCard, borderRadius: BorderRadius.xl, borderWidth: 1, borderColor: Colors.border, flexDirection: 'row', alignItems: 'center', ...Shadows.sm },
  matchCardLeft: { marginRight: 12, alignItems: 'flex-start', minWidth: 80 },
  matchBallTypeBadge: { backgroundColor: Colors.primaryAlpha10, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: Colors.primaryAlpha20, marginBottom: 5 },
  matchBallTypeBadgeText: { fontSize: 10, fontFamily: Typography.fontFamily.bold, color: Colors.primary },
  matchDate: { fontSize: 11, fontFamily: Typography.fontFamily.regular, color: Colors.textTertiary },
  matchCardCenter: { flex: 1 },
  matchRunsValue: { fontSize: 22, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary },
  matchRunsLabel: { fontSize: 11, fontFamily: Typography.fontFamily.regular, color: Colors.textSecondary, marginTop: 2 },
  matchDNB: { fontSize: 14, fontFamily: Typography.fontFamily.medium, color: Colors.textTertiary, fontStyle: 'italic' },
  teamCard: { marginHorizontal: 16, marginBottom: 10, padding: 16, backgroundColor: Colors.backgroundCard, borderRadius: BorderRadius.xl, borderWidth: 1, borderColor: Colors.border, flexDirection: 'row', alignItems: 'center', ...Shadows.sm },
  teamLogo: { width: 46, height: 46, borderRadius: 23 },
  teamLogoFallback: { width: 46, height: 46, borderRadius: 23, backgroundColor: Colors.primaryAlpha10, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.primaryAlpha20 },
  teamName: { fontSize: 15, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary },
  teamCategory: { fontSize: 12, fontFamily: Typography.fontFamily.regular, color: Colors.textSecondary, marginTop: 2 },
  achievementCard: { marginHorizontal: 16, marginBottom: 10, padding: 16, backgroundColor: Colors.backgroundCard, borderRadius: BorderRadius.xl, borderWidth: 1, borderColor: Colors.border, flexDirection: 'row', alignItems: 'flex-start', ...Shadows.sm },
  achievementIconWrap: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1, flexShrink: 0 },
  achievementTitle: { fontSize: 15, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary, marginBottom: 3 },
  achievementSub: { fontSize: 12, fontFamily: Typography.fontFamily.regular, color: Colors.textSecondary, marginTop: 2 },
  achievementDate: { fontSize: 11, fontFamily: Typography.fontFamily.regular, color: Colors.textTertiary, marginTop: 5 },
  achievementBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, marginLeft: 8, flexShrink: 0, marginTop: 2 },
  achievementBadgeText: { fontSize: 10, fontFamily: Typography.fontFamily.semiBold },
  tabCenteredEmpty: { alignItems: 'center', paddingVertical: 64 },
  emptyText: { marginTop: 14, fontSize: 14, color: Colors.textTertiary, fontFamily: Typography.fontFamily.medium },
  emptySubText: { marginTop: 6, fontSize: 12, color: Colors.textTertiary, fontFamily: Typography.fontFamily.regular },
  emptyWrap: { alignItems: 'center', paddingVertical: 48 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: Colors.backgroundCard, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 36, maxHeight: '85%', borderTopWidth: 1, borderColor: Colors.border },
  modalHandle: { width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 18 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary },
  modalCount: { color: Colors.textSecondary, fontFamily: Typography.fontFamily.regular },
  modalCloseBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.backgroundElevated, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border },
  socialListItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  socialListLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
  listAvatar: { width: 44, height: 44, borderRadius: 22 },
  listAvatarFallback: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primaryAlpha10, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.primaryAlpha20 },
  listName: { fontSize: 15, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary },
  listRole: { fontSize: 12, fontFamily: Typography.fontFamily.regular, color: Colors.textSecondary, marginTop: 1 },
  listActionBtn: { borderRadius: 8, borderWidth: 1, borderColor: Colors.errorLight, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: 'rgba(244,67,54,0.06)' },
  listActionText: { fontSize: 12, fontFamily: Typography.fontFamily.semiBold, color: Colors.error },
});

export default PlayerDetailScreen;
