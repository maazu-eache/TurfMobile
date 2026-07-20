import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView, Image, TextInput, RefreshControl } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../../theme/theme';
import { fetchMyMatches, updateLiveMatchScore } from '../matchSlice';
import { fetchMyTeams, fetchOpponentTeams, fetchFollowingTeams } from '../../team/teamSlice';
import { fetchTournaments } from '../../tournament/tournamentSlice';
import { getImageUrl, BASE_URL } from '../../../api/axios';
import io from 'socket.io-client';
import moment from 'moment';

const TOP_TABS = ['Matches', 'Tournaments', 'Teams'];
const MATCH_SUB_TABS = ['My', 'Played', 'Network'];
const TEAM_SUB_TABS = ['My', 'Opponents', 'Following'];
const TOURNAMENT_SUB_TABS = ['My', 'Participate', 'Network'];

const MyCricketScreen = ({ route }) => {
  const [activeTopTab, setActiveTopTab] = useState('Matches');
  const [activeSubTab, setActiveSubTab] = useState('My');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const dispatch = useDispatch();
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const socketRef = useRef(null);
  const myMatchesRef = useRef([]);

  useEffect(() => {
    if (route?.params?.tab) {
      setActiveTopTab(route.params.tab);
      setActiveSubTab('My'); // reset sub-tab
      navigation.setParams({ tab: undefined });
    }
  }, [route?.params?.tab, navigation]);
  const insets = useSafeAreaInsets();

  const { myMatches } = useSelector(state => state.match);
  const { myTeams, opponentTeams, followingTeams } = useSelector(state => state.team);
  const { tournaments } = useSelector(state => state.tournament);
  const { user } = useSelector(state => state.auth);

  useEffect(() => {
    let intervalId;
    
    if (isFocused) {
      if (activeTopTab === 'Matches') {
        dispatch(fetchMyMatches({ status: activeSubTab === 'Played' ? 'completed' : 'active', filterType: activeSubTab.toLowerCase(), limit: 20 }));
        
        socketRef.current = io(BASE_URL, {
          transports: ['websocket'],
          autoConnect: true,
          reconnection: true,
          reconnectionAttempts: Infinity,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          timeout: 20000,
        });

        socketRef.current.on('connect', () => {
          console.log('⚡ [Socket MyCricket] Connected, ID:', socketRef.current.id);
          // Re-join all matches
          if (myMatchesRef.current && myMatchesRef.current.length > 0) {
            myMatchesRef.current.forEach(m => {
              if (m.status === 'in_progress' || m.status === 'toss_done' || m.status === 'innings_break') {
                socketRef.current.emit('join_match', { matchId: m._id });
                console.log(`⚡ [Socket MyCricket] Joined/Re-joined room match:${m._id}`);
              }
            });
          }
        });

        socketRef.current.on('joined', (data) => {
          console.log('⚡ [Socket MyCricket] Confirmed joined room successfully:', data);
        });

        socketRef.current.on('disconnect', (reason) => {
          console.log('⚡ [Socket MyCricket] Disconnected from server. Reason:', reason);
        });

        socketRef.current.on('connect_error', (error) => {
          console.error('⚡ [Socket MyCricket] Connection error:', error.message);
        });
        
        // Listen to score updates instantly!
        socketRef.current.on('score_update', (data) => {
          console.log('⚡ [Socket MyCricket] Score update received:', data?.matchId);
          if (data && data.matchId && data.score) {
            dispatch(updateLiveMatchScore({
              matchId: data.matchId,
              score: data.score,
              battingTeam: data.battingTeam,
              match: data.match
            }));
            console.log('⚡ [Socket MyCricket] MyCricket UI updated via Redux updateLiveMatchScore');
          }
        });
        
        // Setup polling every 30 seconds for non-socket updates
        intervalId = setInterval(() => {
          dispatch(fetchMyMatches({ status: activeSubTab === 'Played' ? 'completed' : 'active', filterType: activeSubTab.toLowerCase(), limit: 20 }));
        }, 30000);
      }
      if (activeTopTab === 'Teams') {
        dispatch(fetchMyTeams());
        dispatch(fetchOpponentTeams());
        dispatch(fetchFollowingTeams());
      }
      if (activeTopTab === 'Tournaments') {
        const params = { limit: 20 };
        if (activeSubTab === 'My') params.filterType = 'my';
        else if (activeSubTab === 'Participate') params.filterType = 'participate';
        dispatch(fetchTournaments(params));
      }
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
      if (socketRef.current) {
        socketRef.current.off('connect');
        socketRef.current.off('joined');
        socketRef.current.off('disconnect');
        socketRef.current.off('connect_error');
        socketRef.current.off('score_update');
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [isFocused, activeTopTab, activeSubTab, dispatch]);

  // Join match rooms when myMatches changes
  useEffect(() => {
    myMatchesRef.current = myMatches || [];
    if (isFocused && activeTopTab === 'Matches' && activeSubTab !== 'Played' && myMatches?.length > 0 && socketRef.current) {
      myMatches.forEach(m => {
        if (m.status === 'in_progress' || m.status === 'toss_done' || m.status === 'innings_break') {
          socketRef.current.emit('join_match', { matchId: m._id });
          console.log(`⚡ [Socket MyCricket] Joined room match:${m._id} (via myMatches update)`);
        }
      });
      return () => {
        if (socketRef.current) {
          myMatches.forEach(m => {
            socketRef.current.emit('leave_match', { matchId: m._id });
            console.log(`⚡ [Socket MyCricket] Left room match:${m._id} (via cleanup)`);
          });
        }
      };
    }
  }, [isFocused, activeTopTab, activeSubTab, myMatches]);

  // Handle Tab changes
  const handleTopTabChange = (tab) => {
    setActiveTopTab(tab);
    if (tab === 'Matches') setActiveSubTab('My');
    if (tab === 'Teams') setActiveSubTab('My');
    if (tab === 'Tournaments') setActiveSubTab('My');
  };

  const handleFollowTournament = async (tournamentId, isFollowing) => {
    try {
      if (isFollowing) {
        await api.post(`/tournaments/${tournamentId}/unfollow`);
      } else {
        await api.post(`/tournaments/${tournamentId}/follow`);
      }
      // Refresh tournaments
      const params = { limit: 20 };
      if (activeSubTab === 'My') params.filterType = 'my';
      else if (activeSubTab === 'Participate') params.filterType = 'participate';
      dispatch(fetchTournaments(params));
    } catch (e) {
      console.log('Error following/unfollowing tournament', e);
    }
  };

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    if (activeTopTab === 'Matches') {
      dispatch(fetchMyMatches({ status: activeSubTab === 'Played' ? 'completed' : 'active', filterType: activeSubTab.toLowerCase(), limit: 20 }));
    } else if (activeTopTab === 'Tournaments') {
      const params = { limit: 20 };
      if (activeSubTab === 'My') params.filterType = 'my';
      else if (activeSubTab === 'Participate') params.filterType = 'participate';
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
    <View style={{ paddingTop: insets.top }}>
      <View style={styles.topTabBar}>
        {TOP_TABS.map(tab => (
          <TouchableOpacity key={tab} onPress={() => handleTopTabChange(tab)} style={[styles.topTabBtn, activeTopTab === tab && styles.topTabBtnActive]}>
            <Text style={[styles.topTabBtnText, activeTopTab === tab && styles.topTabBtnTextActive]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderSubTabBar = (tabs) => (
    <View style={styles.subTabBarContainer}>
      {tabs.map(tab => (
        <TouchableOpacity key={tab} onPress={() => setActiveSubTab(tab)} style={[styles.subTabBtn, activeSubTab === tab && styles.subTabBtnActive]}>
          <Text style={[styles.subTabBtnText, activeSubTab === tab && styles.subTabBtnTextActive]}>{tab}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderMatchCard = ({ item }) => (
    <TouchableOpacity style={styles.cardContainer} activeOpacity={0.9} onPress={() => navigation.navigate('MatchSummary', { matchId: item._id })}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardFormatText} numberOfLines={1}>
          {item.tournament ? item.tournament.name : 'Individual Match'} • {item.ground || item.venueDetails || 'Ground'}, {item.city || 'City'}
        </Text>
        <View style={[styles.resultBadge, { backgroundColor: ['in_progress', 'toss_done', 'innings_break', 'super_over'].includes(item.status) ? Colors.error : Colors.surface }]}>
          <Text style={[styles.resultBadgeText, { color: ['in_progress', 'toss_done', 'innings_break', 'super_over'].includes(item.status) ? Colors.white : Colors.textSecondary }]}>
            {['in_progress', 'toss_done', 'innings_break', 'super_over'].includes(item.status) ? 'LIVE' : item.status === 'scheduled' ? 'Upcoming' : 'Result'}
          </Text>
        </View>
      </View>
      
      <Text style={styles.cardSubText}>{item.stage ? `${item.stage} | ` : ''}{item.format === 'test' ? 'Test' : item.format === 't20' ? 'T20' : item.format === 'odi' ? 'ODI' : item.format || 'Custom'} | {moment(item.scheduledAt || item.createdAt).format('DD MMM YYYY, h:mm a')} | {item.overs} Ov.</Text>
      
      <View style={styles.teamScoreRow}>
        <Text style={[styles.teamNameText, item.status === 'completed' && (item.result?.winner === item.teamA?._id || item.result?.winner?._id === item.teamA?._id) && { color: Colors.primary, fontFamily: Typography.fontFamily.bold }]} numberOfLines={1}>{item.teamA?.name}</Text>
        <Text style={styles.scoreText}>
          {item.teamAScore?.runs || 0}/{item.teamAScore?.wickets || 0} <Text style={styles.overText}>({item.teamAScore?.overs || '0.0'} Ov)</Text>
        </Text>
      </View>
      <View style={styles.teamScoreRow}>
        <Text style={[styles.teamNameText, item.status === 'completed' && (item.result?.winner === item.teamB?._id || item.result?.winner?._id === item.teamB?._id) && { color: Colors.primary, fontFamily: Typography.fontFamily.bold }]} numberOfLines={1}>{item.teamB?.name}</Text>
        <Text style={styles.scoreText}>
          {item.teamBScore?.runs || 0}/{item.teamBScore?.wickets || 0} <Text style={styles.overText}>({item.teamBScore?.overs || '0.0'} Ov)</Text>
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
        <Text style={[styles.matchStatusText, { color: Colors.textSecondary, fontSize: 12, marginTop: 4 }]}>
          {item.result.summary}
        </Text>
      ) : item.toss?.winner && item.status !== 'scheduled' ? (
        <Text style={[styles.matchStatusText, { color: Colors.textSecondary, fontSize: 12, marginTop: 4 }]}>
          {item.toss.winner.name || (item.toss.winner?.toString() === item.teamA?._id?.toString() ? item.teamA?.name : item.teamB?.name)} won the toss and elected to {item.toss.choice}
        </Text>
      ) : null}
      

    </TouchableOpacity>
  );

  const renderTournamentCard = ({ item }) => (
    <TouchableOpacity style={styles.tournamentCard} activeOpacity={0.9} onPress={() => navigation.navigate('TournamentDetail', { tournamentId: item._id })}>
      <View style={styles.tournamentImageContainer}>
        {item.banner ? (
          <Image source={{ uri: getImageUrl(item.banner) }} style={styles.tournamentImage} />
        ) : (
          <View style={[styles.tournamentImage, { backgroundColor: Colors.primaryAlpha20, justifyContent: 'center', alignItems: 'center' }]}>
            <Icon name="trophy" size={40} color={Colors.primary} />
          </View>
        )}
        <View style={styles.tournamentStatusBadge}><Text style={styles.tournamentStatusText}>{
          item.status === 'draft' ? 'Draft' : 
          item.status === 'upcoming' ? 'Upcoming' : 
          item.status === 'ongoing' ? 'Live' : 
          item.status === 'completed' ? 'Completed' : 'Past'
        }</Text></View>
        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={styles.tournamentGradient}>
          <Text style={styles.tournamentTitle}>{item.name}</Text>
        </LinearGradient>
      </View>
      <View style={styles.tournamentFooter}>
        <View style={{ flex: 1 }}>
          <Text style={styles.tournamentDate}>
            {item.startDate ? `Starts: ${moment(item.startDate).format('DD MMM, YYYY')}` : 'Date TBD'}
            {item.endDate ? ` to ${moment(item.endDate).format('DD MMM, YYYY')}` : ''}
          </Text>
          <Text style={styles.tournamentCity}>{item.city || 'City'}</Text>
        </View>
        <TouchableOpacity 
          onPress={(e) => { 
            e.stopPropagation(); 
            handleFollowTournament(item._id, item.followers?.includes(user?._id)); 
          }}
          style={{ padding: 8, paddingRight: 0 }}
        >
          <Text style={{ color: Colors.primary, fontWeight: 'bold' }}>
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
      <TouchableOpacity style={styles.teamCard} onPress={() => navigation.navigate('TeamDetail', { id: item._id })}>
        <View style={styles.teamLogoContainer}>
          {item.logo ? (
            <Image source={{ uri: getImageUrl(item.logo) }} style={styles.teamLogo} />
          ) : (
            <View style={[styles.teamLogo, { backgroundColor: Colors.primaryAlpha20, justifyContent: 'center', alignItems: 'center' }]}>
              <Text style={{color: Colors.primary, fontWeight: 'bold'}}>{item.name.substring(0, 2).toUpperCase()}</Text>
            </View>
          )}
          {item.isVerified && <View style={styles.verifiedBadge}><Icon name="check-decagram" size={16} color={Colors.accent} /></View>}
        </View>
        <View style={styles.teamInfo}>
          <Text style={styles.teamNameText2} numberOfLines={1}>{item.name}</Text>
          <View style={styles.teamMetaRow}>
            <Icon name="map-marker" size={14} color={Colors.textTertiary} />
            <Text style={styles.teamMetaText}>{item.city || 'Location'}</Text>
            <Text style={styles.teamMetaDot}>•</Text>
            <Icon name="alpha-c-circle" size={14} color={Colors.textTertiary} />
            <Text style={styles.teamMetaText}>{captainName || 'Captain'}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderContent = () => {
    if (activeTopTab === 'Matches') {
      return (
        <>
          <View style={styles.actionHeader}>
            <Text style={styles.actionTitle}>Want to start a match?</Text>
            <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('MatchSetup')}>
              <Text style={styles.actionBtnText}>Start</Text>
            </TouchableOpacity>
          </View>
          {renderSubTabBar(MATCH_SUB_TABS)}
          <FlatList
            data={myMatches}
            keyExtractor={i => i._id}
            renderItem={renderMatchCard}
            contentContainerStyle={styles.listContainer}
            ListEmptyComponent={<Text style={styles.emptyText}>No matches found</Text>}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} tintColor={Colors.primary} />}
          />
        </>
      );
    } else if (activeTopTab === 'Tournaments') {
      return (
        <>
          <View style={styles.actionHeader}>
            <Text style={styles.actionTitle}>Want to host a tournament?</Text>
            <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('TournamentCreate')}>
              <Text style={styles.actionBtnText}>Register</Text>
            </TouchableOpacity>
          </View>
          {renderSubTabBar(TOURNAMENT_SUB_TABS)}
          <FlatList
            data={tournaments}
            keyExtractor={i => i._id}
            renderItem={renderTournamentCard}
            contentContainerStyle={styles.listContainer}
            ListEmptyComponent={<Text style={styles.emptyText}>No tournaments found</Text>}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} tintColor={Colors.primary} />}
          />
        </>
      );
    } else if (activeTopTab === 'Teams') {
      return (
        <>
          <View style={styles.actionHeader}>
            <Text style={styles.actionTitle}>Want to create a new team?</Text>
            <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('TeamCreate')}>
              <Text style={styles.actionBtnText}>Create</Text>
            </TouchableOpacity>
          </View>
          {renderSubTabBar(TEAM_SUB_TABS)}
          <View style={styles.searchContainer}>
            <Icon name="magnify" size={20} color={Colors.textTertiary} style={styles.searchIcon} />
            <TextInput 
              style={styles.searchInput}
              placeholder="Quick search"
              placeholderTextColor={Colors.textTertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
          <FlatList
            data={(
              activeSubTab === 'My' ? myTeams :
              activeSubTab === 'Opponents' ? opponentTeams :
              followingTeams || []
            ).filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase()))}
            keyExtractor={i => i._id}
            renderItem={renderTeamCard}
            contentContainerStyle={styles.listContainer}
            ListEmptyComponent={<Text style={styles.emptyText}>No teams found</Text>}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} tintColor={Colors.primary} />}
          />
        </>
      );
    } else {
      return (
        <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
          <Text style={styles.emptyText}>Coming Soon</Text>
        </View>
      );
    }
  };

  return (
    <View style={styles.safe}>
      {renderTopTabBar()}
      <View style={styles.mainContainer}>
        {renderContent()}
      </View>
    </View>
  );
};

// Assuming LinearGradient is used, need to import it. Will mock it with a view if it fails, but we should import LinearGradient.
import LinearGradient from 'react-native-linear-gradient';

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  topTabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    paddingHorizontal: 16,
  },
  topTabBtn: {
    paddingVertical: 14,
    marginRight: 20,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  topTabBtnActive: {
    borderBottomColor: Colors.primary,
  },
  topTabBtnText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.medium,
  },
  topTabBtnTextActive: {
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.semiBold,
  },
  mainContainer: { flex: 1 },
  actionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.background,
  },
  actionTitle: {
    fontSize: 14,
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.medium,
  },
  actionBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  actionBtnText: {
    color: '#000', // Text color for the primary button which is light green
    fontSize: 13,
    fontFamily: Typography.fontFamily.semiBold,
  },
  subTabBarContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.backgroundCard,
    marginHorizontal: 16,
    borderRadius: 6,
    padding: 2,
    marginBottom: 8,
  },
  subTabBtn: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 4,
  },
  subTabBtnActive: {
    backgroundColor: Colors.primaryAlpha20,
    elevation: 0,
  },
  subTabBtnText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.medium,
  },
  subTabBtnTextActive: {
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.semiBold,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    paddingHorizontal: 10,
  },
  searchIcon: { marginRight: 6 },
  searchInput: {
    flex: 1,
    height: 36,
    color: Colors.textPrimary,
    fontSize: 13,
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  emptyText: {
    textAlign: 'center',
    color: Colors.textTertiary,
    marginTop: 40,
    fontSize: 14,
  },
  
  /* MATCH CARD */
  cardContainer: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardFormatText: {
    fontSize: 13,
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.semiBold,
  },
  resultBadge: {
    backgroundColor: Colors.border,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  resultBadgeText: {
    color: Colors.textPrimary,
    fontSize: 11,
    fontFamily: Typography.fontFamily.semiBold,
  },
  cardSubText: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginBottom: 12,
  },
  teamScoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  teamNameText: {
    fontSize: 15,
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.medium,
    flex: 1,
  },
  scoreText: {
    fontSize: 15,
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.bold,
  },
  overText: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontFamily: Typography.fontFamily.regular,
  },
  matchStatusText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.medium,
    marginTop: 8,
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    paddingTop: 12,
    gap: 16,
  },
  footerLink: {
    color: Colors.primary,
    fontSize: 13,
    fontFamily: Typography.fontFamily.medium,
  },

  /* TOURNAMENT CARD */
  tournamentCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.borderLight,
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
    backgroundColor: '#F59E0B',
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
  tournamentGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    justifyContent: 'flex-end',
    padding: 12,
  },
  tournamentTitle: {
    color: '#FFF',
    fontSize: 16,
    fontFamily: Typography.fontFamily.bold,
  },
  tournamentFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  tournamentDate: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  tournamentCity: {
    fontSize: 12,
    color: Colors.textTertiary,
  },
  followBtnText: {
    color: Colors.primary,
    fontSize: 14,
    fontFamily: Typography.fontFamily.semiBold,
  },

  /* TEAM CARD */
  teamCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  teamLogoContainer: {
    position: 'relative',
    marginRight: 12,
  },
  teamLogo: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 0,
    right: -4,
    backgroundColor: Colors.backgroundCard,
    borderRadius: 10,
  },
  teamInfo: { flex: 1 },
  teamNameText2: {
    fontSize: 15,
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.semiBold,
    marginBottom: 4,
  },
  teamMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  teamMetaText: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginLeft: 4,
  },
  teamMetaDot: {
    color: Colors.textTertiary,
    marginHorizontal: 6,
    fontSize: 12,
  }
});

export default MyCricketScreen;
