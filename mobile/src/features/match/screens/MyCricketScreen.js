import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView, Image, TextInput, RefreshControl, Alert, ToastAndroid, Platform, ScrollView, Dimensions, StatusBar } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme, Typography, Spacing, BorderRadius, Shadows } from '../../../theme/theme';
import { fetchMyMatches, updateLiveMatchScore } from '../matchSlice';
import { fetchMyTeams, fetchOpponentTeams, fetchFollowingTeams } from '../../team/teamSlice';
import { fetchTournaments, toggleTournamentFollow } from '../../tournament/tournamentSlice';
import api, { getImageUrl, BASE_URL } from '../../../api/axios';
import socketService from '../../../services/socketService';
import moment from 'moment';
import SkeletonPlaceholder from 'react-native-skeleton-placeholder';
import { showCustomAlert } from '../../../components/CustomAlert';

const TOP_TABS = ['Matches', 'Tournaments', 'Teams'];
const MATCH_SUB_TABS = ['My', 'Played', 'Network', 'Near By'];
const TEAM_SUB_TABS = ['My', 'Opponents', 'Following'];
const TOURNAMENT_SUB_TABS = ['My', 'Following', 'Near By'];

const SCREEN_WIDTH = Dimensions.get('window').width;

const createStyles = (colors, shadows, isDark) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  topTabBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    ...(isDark ? {} : shadows.xs),
  },
  topTabBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  topTabBtnActive: {
    borderBottomColor: colors.primary,
  },
  topTabBtnText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontFamily: Typography.fontFamily.medium,
  },
  topTabBtnTextActive: {
    color: colors.textPrimary,
    fontFamily: Typography.fontFamily.bold,
  },
  mainContainer: { flex: 1, backgroundColor: colors.background },
  actionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.background,
  },
  actionTitle: {
    fontSize: 14,
    color: colors.textPrimary,
    fontFamily: Typography.fontFamily.medium,
  },
  actionBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    ...shadows.xs,
  },
  actionBtnText: {
    color: colors.textOnPrimary,
    fontSize: 13,
    fontFamily: Typography.fontFamily.semiBold,
  },
  subTabBarContainer: {
    flexDirection: 'row',
    backgroundColor: isDark ? colors.backgroundElevated : colors.surfaceVariant,
    marginHorizontal: 16,
    borderRadius: 8,
    padding: 3,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  subTabBtn: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: 6,
  },
  subTabBtnActive: {
    backgroundColor: colors.primary,
    ...shadows.xs,
  },
  subTabBtnText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontFamily: Typography.fontFamily.medium,
  },
  subTabBtnTextActive: {
    color: colors.textOnPrimary,
    fontFamily: Typography.fontFamily.bold,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDark ? colors.backgroundElevated : colors.surfaceVariant,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
  },
  searchIcon: { marginRight: 6 },
  searchInput: {
    flex: 1,
    height: 38,
    color: colors.textPrimary,
    fontSize: 13,
    fontFamily: Typography.fontFamily.regular,
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  emptyText: {
    textAlign: 'center',
    color: colors.textTertiary,
    marginTop: 40,
    fontSize: 14,
    fontFamily: Typography.fontFamily.medium,
  },
  
  /* MATCH CARD */
  cardContainer: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
    ...(isDark ? {} : shadows.sm),
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardFormatText: {
    fontSize: 13,
    color: colors.textPrimary,
    fontFamily: Typography.fontFamily.semiBold,
    flex: 1,
    marginRight: 8,
  },
  resultBadge: {
    backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : colors.surfaceVariant,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  resultBadgeText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontFamily: Typography.fontFamily.semiBold,
  },
  cardSubText: {
    fontSize: 12,
    color: colors.textTertiary,
    marginBottom: 12,
  },
  teamScoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  matchTeamInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 16,
  },
  matchTeamLogoSmall: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  matchTeamLogoFallbackSmall: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primaryAlpha10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  matchTeamLogoLetterSmall: {
    color: isDark ? colors.primary : colors.primaryDark,
    fontFamily: Typography.fontFamily.bold,
    fontSize: 10,
  },
  teamNameText: {
    fontSize: 15,
    color: colors.textPrimary,
    fontFamily: Typography.fontFamily.medium,
    flex: 1,
  },
  scoreText: {
    fontSize: 15,
    color: colors.textPrimary,
    fontFamily: Typography.fontFamily.bold,
  },
  overText: {
    fontSize: 12,
    color: colors.textTertiary,
    fontFamily: Typography.fontFamily.regular,
  },
  matchStatusText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontFamily: Typography.fontFamily.medium,
    marginTop: 8,
    marginBottom: 4,
  },

  /* TOURNAMENT CARD */
  tournamentCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    ...(isDark ? {} : shadows.sm),
  },
  tournamentImageContainer: {
    height: 140,
    width: '100%',
    position: 'relative',
  },
  tournamentImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  tournamentStatusBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: colors.warning,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  tournamentStatusText: {
    color: '#FFF',
    fontSize: 10,
    fontFamily: Typography.fontFamily.bold,
    textTransform: 'uppercase',
  },
  tournamentTitle: {
    fontSize: 16,
    fontFamily: Typography.fontFamily.bold,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  tournamentFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  tournamentDate: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  tournamentCity: {
    fontSize: 12,
    color: colors.textTertiary,
  },
  followBtnText: {
    color: isDark ? colors.primary : colors.primaryDark,
    fontSize: 14,
    fontFamily: Typography.fontFamily.semiBold,
  },

  /* TEAM CARD */
  teamCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
    ...(isDark ? {} : shadows.xs),
  },
  teamLogoContainer: {
    position: 'relative',
    marginRight: 12,
  },
  teamLogo: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 0,
    right: -4,
    backgroundColor: colors.surface,
    borderRadius: 10,
  },
  teamInfo: { flex: 1 },
  teamNameText2: {
    fontSize: 15,
    color: colors.textPrimary,
    fontFamily: Typography.fontFamily.semiBold,
    marginBottom: 4,
  },
  teamMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  teamMetaText: {
    fontSize: 12,
    color: colors.textTertiary,
    marginLeft: 4,
  },
  teamMetaDot: {
    color: colors.textTertiary,
    marginHorizontal: 6,
    fontSize: 12,
  }
});

const MyCricketScreen = ({ route }) => {
  const { colors, shadows, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, shadows, isDark), [colors, shadows, isDark]);

  const scrollViewRef = useRef(null);
  const [activeTopTab, setActiveTopTab] = useState('Matches');
  const [activeSubTab, setActiveSubTab] = useState('My');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const dispatch = useDispatch();
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const myMatchesRef = useRef([]);

  useEffect(() => {
    if (isFocused) {
      const targetTab = route?.params?.tab || 'Matches';
      if (route?.params?.tab) {
        navigation.setParams({ tab: undefined });
      }
      setActiveTopTab(targetTab);
      setActiveSubTab('My');
      setSearchQuery('');
      
      const targetIndex = Math.max(0, TOP_TABS.indexOf(targetTab));
      const doScroll = () => {
        scrollViewRef.current?.scrollTo({ x: targetIndex * SCREEN_WIDTH, animated: false });
      };
      
      doScroll();
      const timer1 = setTimeout(doScroll, 50);
      const timer2 = setTimeout(doScroll, 150);
      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
      };
    } else {
      setActiveTopTab('Matches');
      setActiveSubTab('My');
      setSearchQuery('');
      scrollViewRef.current?.scrollTo({ x: 0, animated: false });
    }
  }, [isFocused, route?.params?.tab, navigation]);
  const insets = useSafeAreaInsets();

  const { myMatches, matches, isLoading: matchLoading } = useSelector(state => state.match);
  const { myTeams, opponentTeams, followingTeams, isLoading: teamLoading, opponentsLoading, followingLoading } = useSelector(state => state.team);
  const { tournaments, isLoading: tournamentLoading } = useSelector(state => state.tournament);
  const { user, isAuthenticated } = useSelector(state => state.auth);
  const { myProfile } = useSelector(state => state.player);

  useEffect(() => {
    if (!isAuthenticated && isFocused) {
      navigation.navigate('AuthModal', { screen: 'Login' });
    }
  }, [isAuthenticated, isFocused, navigation]);

  useEffect(() => {
    let unsubscribeScore;

    if (isFocused) {
      if (activeTopTab === 'Matches') {
        const params = { status: activeSubTab === 'Played' ? 'completed' : (activeSubTab === 'Near By' ? undefined : 'active'), filterType: activeSubTab.toLowerCase().replace(' ', ''), limit: 20 };
        if (activeSubTab === 'Near By') {
          const userCity = myProfile?.city || user?.city || (typeof myProfile?.location === 'string' ? myProfile.location : (typeof user?.location === 'string' ? user.location : (myProfile?.location?.city || user?.location?.city)));
          if (userCity) params.city = userCity;
          if (myProfile?.latitude && myProfile?.longitude) {
            params.lat = myProfile.latitude;
            params.lng = myProfile.longitude;
          }
        }
        dispatch(fetchMyMatches(params));

        unsubscribeScore = socketService.onScoreUpdate((data) => {
          socketService.remoteLog('MyCricketScreen', 'Score update event received', { matchId: data?.matchId || data?.match?._id, score: data?.score });
          const mId = data?.matchId || data?.match?._id || data?.id;
          if (mId && (data.score || data.teamAScore || data.teamBScore || data.match)) {
            dispatch(updateLiveMatchScore({
              matchId: mId,
              score: data.score,
              teamAScore: data.teamAScore,
              teamBScore: data.teamBScore,
              battingTeam: data.battingTeam,
              match: data.match,
              status: data.match?.status || data.status
            }));
            socketService.remoteLog('MyCricketScreen', 'Redux updateLiveMatchScore dispatched', { matchId: mId });
          }
        });
      }
      if (activeTopTab === 'Teams') {
        dispatch(fetchMyTeams());
        dispatch(fetchOpponentTeams());
        dispatch(fetchFollowingTeams());
      }
      if (activeTopTab === 'Tournaments') {
        const params = { limit: 20 };
        if (activeSubTab === 'My') params.filterType = 'my';
        else if (activeSubTab === 'Following') params.filterType = 'following';
        else if (activeSubTab === 'Near By') {
          if (myProfile?.city) params.city = myProfile.city;
          if (myProfile?.latitude && myProfile?.longitude) {
            params.lat = myProfile.latitude;
            params.lng = myProfile.longitude;
          }
        }
        dispatch(fetchTournaments(params));
      }
    }

    return () => {
      if (unsubscribeScore) unsubscribeScore();
    };
  }, [isFocused, activeTopTab, activeSubTab, dispatch]);

  const joinedRoomsRef = useRef(new Set());
  useEffect(() => {
    const list = (myMatches && myMatches.length > 0) ? myMatches : matches;
    myMatchesRef.current = list || [];

    if (isFocused && activeTopTab === 'Matches' && activeSubTab !== 'Played' && list?.length > 0) {
      const activeIds = new Set();
      list.forEach(m => {
        if (['in_progress', 'toss_done', 'innings_break', 'super_over'].includes(m.status)) {
          const cleanId = socketService.cleanId(m._id || m.id);
          activeIds.add(cleanId);
        }
      });

      activeIds.forEach(id => {
        if (!joinedRoomsRef.current.has(id)) {
          socketService.joinMatch(id);
          joinedRoomsRef.current.add(id);
          socketService.remoteLog('MyCricketScreen', `Joined live match room: match_${id}`);
        }
      });

      joinedRoomsRef.current.forEach(id => {
        if (!activeIds.has(id)) {
          socketService.leaveMatch(id);
          joinedRoomsRef.current.delete(id);
          socketService.remoteLog('MyCricketScreen', `Left live match room: match_${id}`);
        }
      });
    } else {
      joinedRoomsRef.current.forEach(id => {
        socketService.leaveMatch(id);
        socketService.remoteLog('MyCricketScreen', `Left live match room (unfocused): match_${id}`);
      });
      joinedRoomsRef.current.clear();
    }
  }, [isFocused, activeTopTab, activeSubTab, myMatches, matches]);

  const handleTopTabChange = (tab, scrollToTab = true) => {
    setActiveTopTab(tab);
    if (tab === 'Matches') setActiveSubTab('My');
    if (tab === 'Teams') setActiveSubTab('My');
    if (tab === 'Tournaments') setActiveSubTab('My');

    if (scrollToTab) {
      const index = TOP_TABS.indexOf(tab);
      if (index !== -1) {
        setTimeout(() => {
          scrollViewRef.current?.scrollTo({ x: index * SCREEN_WIDTH, animated: true });
        }, 50);
      }
    }
  };

  const handleScroll = (e) => {
    if (!isFocused) return;
    const x = e.nativeEvent.contentOffset.x;
    const index = Math.round(x / SCREEN_WIDTH);
    const newTab = TOP_TABS[index];
    if (newTab && newTab !== activeTopTab) {
      setActiveTopTab(newTab);
      setActiveSubTab('My');
    }
  };

  const handleFollowTournament = async (tournamentId, isFollowing) => {
    try {
      dispatch(toggleTournamentFollow({ tournamentId, userId: user?._id }));
      
      const actionStr = isFollowing ? 'Unfollowed' : 'Following';
      const msg = isFollowing ? 'You unfollowed this tournament.' : 'You are now following this tournament!';
      if (Platform.OS === 'android') ToastAndroid.show(msg, ToastAndroid.SHORT);
      else showCustomAlert(actionStr, msg);

      if (isFollowing) {
        await api.post(`/tournaments/${tournamentId}/unfollow`);
      } else {
        await api.post(`/tournaments/${tournamentId}/follow`);
      }
      
      const params = { limit: 20 };
      if (activeSubTab === 'My') params.filterType = 'my';
      else if (activeSubTab === 'Following') params.filterType = 'following';
      else if (activeSubTab === 'Near By') {
        const userCity = myProfile?.city || user?.city || (typeof myProfile?.location === 'string' ? myProfile.location : (typeof user?.location === 'string' ? user.location : (myProfile?.location?.city || user?.location?.city)));
        if (userCity) params.city = userCity;
        if (myProfile?.latitude && myProfile?.longitude) {
          params.lat = myProfile.latitude;
          params.lng = myProfile.longitude;
        }
      }
      dispatch(fetchTournaments(params));
    } catch (e) {
      console.log('Error following/unfollowing tournament', e);
      showCustomAlert('Error', e.response?.data?.message || 'Failed to follow/unfollow tournament');
    }
  };

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    if (activeTopTab === 'Matches') {
      const params = { status: activeSubTab === 'Played' ? 'completed' : (activeSubTab === 'Near By' ? undefined : 'active'), filterType: activeSubTab.toLowerCase().replace(' ', ''), limit: 20 };
      if (activeSubTab === 'Near By') {
        const userCity = myProfile?.city || user?.city || (typeof myProfile?.location === 'string' ? myProfile.location : (typeof user?.location === 'string' ? user.location : (myProfile?.location?.city || user?.location?.city)));
        if (userCity) params.city = userCity;
        if (myProfile?.latitude && myProfile?.longitude) {
          params.lat = myProfile.latitude;
          params.lng = myProfile.longitude;
        }
      }
      dispatch(fetchMyMatches(params));
    } else if (activeTopTab === 'Tournaments') {
      const params = { limit: 20 };
      if (activeSubTab === 'My') params.filterType = 'my';
      else if (activeSubTab === 'Following') params.filterType = 'following';
      else if (activeSubTab === 'Near By') {
        const userCity = myProfile?.city || user?.city || (typeof myProfile?.location === 'string' ? myProfile.location : (typeof user?.location === 'string' ? user.location : (myProfile?.location?.city || user?.location?.city)));
        if (userCity) params.city = userCity;
        if (myProfile?.latitude && myProfile?.longitude) {
          params.lat = myProfile.latitude;
          params.lng = myProfile.longitude;
        }
      }
      dispatch(fetchTournaments(params));
    } else if (activeTopTab === 'Teams') {
      dispatch(fetchMyTeams());
      dispatch(fetchOpponentTeams());
      dispatch(fetchFollowingTeams());
    }
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  }, [activeTopTab, activeSubTab, dispatch]);

  const renderTopTabBar = () => (
    <View style={{ paddingTop: insets.top, backgroundColor: colors.surface }}>
      <View style={styles.topTabBar}>
        {TOP_TABS.map(tab => (
          <TouchableOpacity key={tab} onPress={() => handleTopTabChange(tab)} style={[styles.topTabBtn, activeTopTab === tab && styles.topTabBtnActive]} activeOpacity={0.8}>
            <Text style={[styles.topTabBtnText, activeTopTab === tab && styles.topTabBtnTextActive]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderSubTabBar = (tabs) => (
    <View style={styles.subTabBarContainer}>
      {tabs.map(tab => (
        <TouchableOpacity key={tab} onPress={() => setActiveSubTab(tab)} style={[styles.subTabBtn, activeSubTab === tab && styles.subTabBtnActive]} activeOpacity={0.8}>
          <Text style={[styles.subTabBtnText, activeSubTab === tab && styles.subTabBtnTextActive]}>{tab}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderMatchCard = ({ item }) => {
    const isLive = ['in_progress', 'toss_done', 'innings_break', 'super_over'].includes(item.status);
    const isCompleted = item.status === 'completed';

    let teamABattedFirst = true;
    if (item.toss && item.toss.winner) {
      const tossWinnerId = String(item.toss.winner._id || item.toss.winner || '').trim();
      const teamAId = String(item.teamA?._id || item.teamA || '').trim();
      const teamBId = String(item.teamB?._id || item.teamB || '').trim();
      if (tossWinnerId === teamAId) {
        teamABattedFirst = (item.toss.choice === 'bat');
      } else if (tossWinnerId === teamBId) {
        teamABattedFirst = (item.toss.choice === 'bowl');
      }
    }

    const firstTeam = teamABattedFirst ? item.teamA : item.teamB;
    const firstScore = teamABattedFirst ? item.teamAScore : item.teamBScore;

    const secondTeam = teamABattedFirst ? item.teamB : item.teamA;
    const secondScore = teamABattedFirst ? item.teamBScore : item.teamAScore;

    const winnerId = String(item.result?.winner?._id || item.result?.winner || '').trim();
    const firstTeamId = String(firstTeam?._id || firstTeam || '').trim();
    const secondTeamId = String(secondTeam?._id || secondTeam || '').trim();

    const isFirstWinner = isCompleted && !!winnerId && winnerId === firstTeamId;
    const isSecondWinner = isCompleted && !!winnerId && winnerId === secondTeamId;

    return (
      <TouchableOpacity style={styles.cardContainer} activeOpacity={0.9} onPress={() => navigation.navigate('MatchSummary', { matchId: item._id })}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardFormatText} numberOfLines={1}>
            {item.tournament ? item.tournament.name : 'Individual Match'} • {item.ground || item.venueDetails || 'Ground'}, {item.city || 'City'}
          </Text>
          <View style={[styles.resultBadge, isLive && { backgroundColor: colors.error, borderColor: colors.error }]}>
            <Text style={[styles.resultBadgeText, isLive && { color: '#FFF' }]}>
              {isLive ? 'LIVE' : item.status === 'scheduled' ? 'Upcoming' : 'Result'}
            </Text>
          </View>
        </View>
        
        <Text style={styles.cardSubText}>{item.stage ? `${item.stage} | ` : ''}{item.format === 'test' ? 'Test' : item.format === 't20' ? 'T20' : item.format === 'odi' ? 'ODI' : item.format || 'Custom'} | {moment(item.createdAt).format('DD MMM YYYY, h:mm a')} | {item.overs} Ov.</Text>
        
        <View style={styles.teamScoreRow}>
          <View style={styles.matchTeamInfo}>
            {firstTeam?.logo ? (
              <Image 
                source={{ uri: getImageUrl(firstTeam.logo) }} 
                style={styles.matchTeamLogoSmall}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.matchTeamLogoFallbackSmall}>
                <Text style={styles.matchTeamLogoLetterSmall}>
                  {(firstTeam?.name || 'T').trim().charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <Text
              style={[
                styles.teamNameText,
                isFirstWinner && {
                  fontFamily: Typography.fontFamily.bold,
                  color: isDark ? colors.primary : '#B37B00',
                },
                !isFirstWinner && isCompleted && { color: colors.textSecondary, opacity: 0.75 }
              ]}
              numberOfLines={1}
            >
              {firstTeam?.name}
            </Text>
            {isFirstWinner && (
              <View style={{ backgroundColor: isDark ? 'rgba(255,204,0,0.18)' : 'rgba(230,184,0,0.15)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, flexDirection: 'row', alignItems: 'center', marginLeft: 6 }}>
                <Icon name="trophy-variant" size={12} color={isDark ? colors.primary : '#B37B00'} />
                <Text style={{ fontSize: 10, fontFamily: Typography.fontFamily.bold, color: isDark ? colors.primary : '#B37B00', marginLeft: 2 }}>W</Text>
              </View>
            )}
          </View>
          <Text style={[styles.scoreText, isFirstWinner && { color: isDark ? colors.primary : '#B37B00', fontFamily: Typography.fontFamily.bold }]}>
            {firstScore?.runs || 0}/{firstScore?.wickets || 0} <Text style={styles.overText}>({firstScore?.overs || '0.0'} Ov)</Text>
          </Text>
        </View>
        <View style={styles.teamScoreRow}>
          <View style={styles.matchTeamInfo}>
            {secondTeam?.logo ? (
              <Image 
                source={{ uri: getImageUrl(secondTeam.logo) }} 
                style={styles.matchTeamLogoSmall}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.matchTeamLogoFallbackSmall}>
                <Text style={styles.matchTeamLogoLetterSmall}>
                  {(secondTeam?.name || 'T').trim().charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <Text
              style={[
                styles.teamNameText,
                isSecondWinner && {
                  fontFamily: Typography.fontFamily.bold,
                  color: isDark ? colors.primary : '#B37B00',
                },
                !isSecondWinner && isCompleted && { color: colors.textSecondary, opacity: 0.75 }
              ]}
              numberOfLines={1}
            >
              {secondTeam?.name}
            </Text>
            {isSecondWinner && (
              <View style={{ backgroundColor: isDark ? 'rgba(255,204,0,0.18)' : 'rgba(230,184,0,0.15)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, flexDirection: 'row', alignItems: 'center', marginLeft: 6 }}>
                <Icon name="trophy-variant" size={12} color={isDark ? colors.primary : '#B37B00'} />
                <Text style={{ fontSize: 10, fontFamily: Typography.fontFamily.bold, color: isDark ? colors.primary : '#B37B00', marginLeft: 2 }}>W</Text>
              </View>
            )}
          </View>
          <Text style={[styles.scoreText, isSecondWinner && { color: isDark ? colors.primary : '#B37B00', fontFamily: Typography.fontFamily.bold }]}>
            {secondScore?.runs || 0}/{secondScore?.wickets || 0} <Text style={styles.overText}>({secondScore?.overs || '0.0'} Ov)</Text>
          </Text>
        </View>

        {item.status !== 'completed' && (
          <Text style={styles.matchStatusText}>
            {item.status === 'in_progress' 
              ? 'LIVE' 
              : item.status === 'scheduled' 
                ? `SCHEDULED AT ${moment(item.scheduledAt || item.createdAt).format('DD MMM YYYY, hh:mm A').toUpperCase()}` 
                : item.status === 'abandoned' && item.result?.summary
                  ? item.result.summary.toUpperCase()
                  : item.status.replace('_', ' ').toUpperCase()}
          </Text>
        )}

        {item.status === 'completed' && item.result?.summary ? (
          <Text style={[styles.matchStatusText, { color: colors.textSecondary, fontSize: 12, marginTop: 4 }]}>
            {item.result.summary}
          </Text>
        ) : item.toss?.winner && item.status !== 'scheduled' ? (
          <Text style={[styles.matchStatusText, { color: colors.textSecondary, fontSize: 12, marginTop: 4 }]}>
            {(item.toss.winner.name || (String(item.toss.winner) === String(item.teamA?._id) ? item.teamA?.name : item.teamB?.name))} won the toss and elected to {item.toss.choice}
          </Text>
        ) : null}
      </TouchableOpacity>
    );
  };

  const renderTournamentCard = ({ item }) => (
    <TouchableOpacity style={styles.tournamentCard} activeOpacity={0.9} onPress={() => navigation.navigate('TournamentDetail', { tournamentId: item._id })}>
      <View style={styles.tournamentImageContainer}>
        {item.banner ? (
          <Image source={{ uri: getImageUrl(item.banner) }} style={styles.tournamentImage} />
        ) : (
          <View style={[styles.tournamentImage, { backgroundColor: colors.primaryAlpha20, justifyContent: 'center', alignItems: 'center' }]}>
            <Icon name="trophy" size={40} color={colors.primary} />
          </View>
        )}
        <View style={[styles.tournamentStatusBadge, {
          backgroundColor: (item.status === 'ongoing' || item.status === 'live') ? colors.error 
            : item.status === 'completed' ? colors.success 
            : colors.warning
        }]}><Text style={styles.tournamentStatusText}>{
          item.status === 'draft' ? 'UPCOMING' : 
          item.status === 'registration_open' ? 'REG OPEN' : 
          item.status === 'registration_closed' ? 'REG CLOSED' : 
          item.status === 'ongoing' ? 'LIVE' : 
          item.status === 'completed' ? 'COMPLETED' : 
          item.status === 'cancelled' ? 'CANCELLED' : item.status.toUpperCase()
        }</Text></View>
      </View>
      <View style={styles.tournamentFooter}>
        <View style={{ flex: 1 }}>
          <Text style={styles.tournamentTitle}>{item.name}</Text>
          <Text style={styles.tournamentDate}>
            {item.startDate ? `Starts: ${moment(item.startDate).format('DD MMM, YYYY')}` : 'Date TBD'}
            {item.endDate ? ` to ${moment(item.endDate).format('DD MMM, YYYY')}` : ''}
          </Text>
          <Text style={styles.tournamentCity}>{item.city || 'City'}</Text>
        </View>
        <TouchableOpacity 
          onPress={() => { 
            handleFollowTournament(item._id, item.followers?.includes(user?._id)); 
          }}
          style={{ padding: 8, paddingRight: 0 }}
          activeOpacity={0.7}
        >
          <Text style={styles.followBtnText}>
            {item.followers?.includes(user?._id) ? 'Following' : 'Follow'}
          </Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const renderTeamCard = ({ item }) => {
    let captainName = item.captain?.name;
    if (!captainName && item.players) {
      const captainObj = item.players.find(p => p.role === 'captain');
      if (captainObj?.player?.name) {
        captainName = captainObj.player.name;
      }
    }

    return (
      <TouchableOpacity style={styles.teamCard} onPress={() => navigation.navigate('TeamDetail', { id: item._id })} activeOpacity={0.85}>
        <View style={styles.teamLogoContainer}>
          {item.logo ? (
            <Image source={{ uri: getImageUrl(item.logo) }} style={styles.teamLogo} />
          ) : (
            <View style={[styles.teamLogo, { backgroundColor: colors.primaryAlpha20, justifyContent: 'center', alignItems: 'center' }]}>
              <Text style={{ color: isDark ? colors.primary : colors.primaryDark, fontFamily: Typography.fontFamily.bold, fontSize: 18 }}>
                {(item.name || 'T').trim().charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          {item.isVerified && <View style={styles.verifiedBadge}><Icon name="check-decagram" size={16} color={colors.accent || colors.primary} /></View>}
        </View>
        <View style={styles.teamInfo}>
          <Text style={styles.teamNameText2} numberOfLines={1}>{item.name}</Text>
          <View style={styles.teamMetaRow}>
            <Icon name="map-marker" size={14} color={colors.textTertiary} />
            <Text style={styles.teamMetaText}>{item.city || 'Location'}</Text>
            <Text style={styles.teamMetaDot}>•</Text>
            <Icon name="alpha-c-circle" size={14} color={colors.textTertiary} />
            <Text style={styles.teamMetaText}>{captainName || 'Captain'}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderMatchSkeleton = () => (
    <View style={styles.cardContainer}>
      <SkeletonPlaceholder borderRadius={4} backgroundColor={isDark ? colors.backgroundElevated : colors.surfaceVariant} highlightColor={isDark ? colors.surface : colors.border}>
        <View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
            <View style={{ width: 120, height: 24, borderRadius: 4 }} />
            <View style={{ width: 60, height: 24, borderRadius: 4 }} />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
            <View style={{ width: 100, height: 16, borderRadius: 4 }} />
            <View style={{ width: 40, height: 16, borderRadius: 4 }} />
          </View>
          <View style={{ width: 120, height: 14, borderRadius: 4 }} />
        </View>
      </SkeletonPlaceholder>
    </View>
  );

  const renderTournamentSkeleton = () => (
    <View style={styles.tournamentCard}>
      <SkeletonPlaceholder borderRadius={4} backgroundColor={isDark ? colors.backgroundElevated : colors.surfaceVariant} highlightColor={isDark ? colors.surface : colors.border}>
        <View>
          <View style={{ width: '100%', height: 140 }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 12 }}>
            <View>
              <View style={{ width: 120, height: 14, borderRadius: 4, marginBottom: 8 }} />
              <View style={{ width: 80, height: 12, borderRadius: 4 }} />
            </View>
            <View style={{ width: 60, height: 20, borderRadius: 4 }} />
          </View>
        </View>
      </SkeletonPlaceholder>
    </View>
  );

  const renderTeamSkeleton = () => (
    <View style={styles.teamCard}>
      <SkeletonPlaceholder borderRadius={4} backgroundColor={isDark ? colors.backgroundElevated : colors.surfaceVariant} highlightColor={isDark ? colors.surface : colors.border}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 48, height: 48, borderRadius: 24, marginRight: 12 }} />
          <View style={{ flex: 1 }}>
            <View style={{ width: 120, height: 16, borderRadius: 4, marginBottom: 8 }} />
            <View style={{ width: 180, height: 12, borderRadius: 4 }} />
          </View>
        </View>
      </SkeletonPlaceholder>
    </View>
  );

  const renderMatchesTab = () => {
    const isListLoading = matchLoading && !refreshing;
    const matchList = (myMatches && myMatches.length > 0) ? myMatches : (matches || []);
    const sortedMatches = [...matchList].sort((a, b) => {
      const liveStatuses = ['in_progress', 'toss_done', 'innings_break', 'super_over'];
      const aLive = liveStatuses.includes(a.status);
      const bLive = liveStatuses.includes(b.status);
      if (aLive && !bLive) return -1;
      if (!aLive && bLive) return 1;

      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      return dateB - dateA;
    });

    return (
      <View style={{ width: SCREEN_WIDTH, flex: 1 }}>
        <View style={styles.actionHeader}>
          <Text style={styles.actionTitle}>Want to start a match?</Text>
          <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('MatchSetup')} activeOpacity={0.85}>
            <Text style={styles.actionBtnText}>Start</Text>
          </TouchableOpacity>
        </View>
        {renderSubTabBar(MATCH_SUB_TABS)}
        {isListLoading ? (
          <View style={styles.listContainer}>
            {[1, 2, 3].map(i => <React.Fragment key={i}>{renderMatchSkeleton()}</React.Fragment>)}
          </View>
        ) : (
          <FlatList
            data={sortedMatches}
            keyExtractor={i => i._id}
            renderItem={renderMatchCard}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={<Text style={styles.emptyText}>No matches found</Text>}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />}
          />
        )}
      </View>
    );
  };

  const renderTournamentsTab = () => {
    const isListLoading = tournamentLoading && !refreshing;
    const sortedTournaments = [...(tournaments || [])]
      .filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => {
        const aLive = ['ongoing', 'live', 'registration_open'].includes(a.status);
        const bLive = ['ongoing', 'live', 'registration_open'].includes(b.status);
        if (aLive && !bLive) return -1;
        if (!aLive && bLive) return 1;

        const dateA = new Date(a.startDate || a.createdAt || 0).getTime();
        const dateB = new Date(b.startDate || b.createdAt || 0).getTime();
        return dateB - dateA;
      });

    return (
      <View style={{ width: SCREEN_WIDTH, flex: 1 }}>
        <View style={styles.actionHeader}>
          <Text style={styles.actionTitle}>Want to host a tournament?</Text>
          <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('TournamentCreate')} activeOpacity={0.85}>
            <Text style={styles.actionBtnText}>Register</Text>
          </TouchableOpacity>
        </View>
        {renderSubTabBar(TOURNAMENT_SUB_TABS)}
        <View style={styles.searchContainer}>
          <Icon name="magnify" size={20} color={colors.textTertiary} style={styles.searchIcon} />
          <TextInput 
            style={styles.searchInput}
            placeholder="Search by name"
            placeholderTextColor={colors.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        {isListLoading ? (
          <View style={styles.listContainer}>
            {[1, 2].map(i => <React.Fragment key={i}>{renderTournamentSkeleton()}</React.Fragment>)}
          </View>
        ) : (
          <FlatList
            data={sortedTournaments}
            keyExtractor={i => i._id}
            renderItem={renderTournamentCard}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={<Text style={styles.emptyText}>No tournaments found</Text>}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />}
          />
        )}
      </View>
    );
  };

  const renderTeamsTab = () => {
    const isListLoading = (teamLoading || opponentsLoading || followingLoading) && !refreshing;
    const teamData = activeSubTab === 'My' ? myTeams : activeSubTab === 'Opponents' ? opponentTeams : followingTeams || [];
    return (
      <View style={{ width: SCREEN_WIDTH, flex: 1 }}>
        <View style={styles.actionHeader}>
          <Text style={styles.actionTitle}>Want to create a new team?</Text>
          <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('TeamCreate')} activeOpacity={0.85}>
            <Text style={styles.actionBtnText}>Create</Text>
          </TouchableOpacity>
        </View>
        {renderSubTabBar(TEAM_SUB_TABS)}
        <View style={styles.searchContainer}>
          <Icon name="magnify" size={20} color={colors.textTertiary} style={styles.searchIcon} />
          <TextInput 
            style={styles.searchInput}
            placeholder="Quick search"
            placeholderTextColor={colors.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        {isListLoading ? (
          <View style={styles.listContainer}>
            {[1, 2, 3, 4].map(i => <React.Fragment key={i}>{renderTeamSkeleton()}</React.Fragment>)}
          </View>
        ) : (
          <FlatList
            data={teamData.filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase()))}
            keyExtractor={i => i._id}
            renderItem={renderTeamCard}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={<Text style={styles.emptyText}>No teams found</Text>}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />}
          />
        )}
      </View>
    );
  };

  if (!isAuthenticated) return null;

  return (
    <View style={styles.safe}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.surface} />
      {renderTopTabBar()}
      <View style={styles.mainContainer}>
        <ScrollView
          ref={scrollViewRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleScroll}
        >
          {renderMatchesTab()}
          {renderTournamentsTab()}
          {renderTeamsTab()}
        </ScrollView>
      </View>
    </View>
  );
};

export default MyCricketScreen;
