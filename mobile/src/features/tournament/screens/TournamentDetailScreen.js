import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Image, FlatList, Share, Modal, TextInput, RefreshControl, StatusBar, ToastAndroid, Platform, Alert, Animated, Linking } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import moment from 'moment';
import { useTheme, Typography, Spacing, BorderRadius } from '../../../theme/theme';
import LinearGradient from '../../../components/SolidGradient';
import api, { getImageUrl, BASE_URL } from '../../../api/axios';
import { useSelector } from 'react-redux';
import socketService from '../../../services/socketService';
import { WebView } from 'react-native-webview';
import { showCustomAlert } from '../../../components/CustomAlert';
import GroupManagementModal from '../components/GroupManagementModal';
import RoleManagementModal from '../components/RoleManagementModal';
import AddTeamModal from '../components/AddTeamModal';
import auctionService from '../../../services/auctionService';
import EditTournamentModal from '../components/EditTournamentModal';
import FixtureWizardModal from '../components/FixtureWizardModal';
import TournamentStartMatchModal from '../components/TournamentStartMatchModal';
import TournamentLeaderboard from '../components/TournamentLeaderboard';
import TournamentStatistics from '../components/TournamentStatistics';
import SharePreviewModal from '../components/SharePreviewModal';
import { TournamentSummaryPoster, FixturePoster, PointsTablePoster, LeaderboardPoster, FullSchedulePoster, RegistrationPoster, TeamInvitePoster } from '../components/PosterTemplates';

const TABS = [
  'Overview', 'Matches', 'Auction', 'Teams', 'Points Table',
  'Leaderboard', 'Statistics'
];

const TournamentDetailScreen = ({ route, navigation }) => {
  const { colors, shadows, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const safeTop = Math.max(insets?.top || 0, Platform.OS === 'ios' ? 44 : 0);
  const styles = useMemo(() => createStyles(colors, shadows, isDark, safeTop), [colors, shadows, isDark, safeTop]);
  const auctionStyles = useMemo(() => createAuctionStyles(colors, shadows, isDark), [colors, shadows, isDark]);
  const { tournamentId, initialTab, openRegisterModal } = route.params || {};
  const [tournament, setTournament] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState(initialTab || 'Overview');
  const [matchSubTab, setMatchSubTab] = useState('Live'); // Live, Upcoming, Past
  const [selectedTeamFilter, setSelectedTeamFilter] = useState('');
  const { user } = useSelector(state => state.auth);

  const lockAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (openRegisterModal || route.params?.action === 'join-team') {
      setShowRegisterModal(true);
      if (route.params?.action === 'join-team') {
        navigation.setParams({ action: undefined, openRegisterModal: undefined });
      }
    }
  }, [openRegisterModal, route.params?.action, navigation]);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(lockAnim, {
          toValue: 1.15,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(lockAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [lockAnim]);
  // Modals state
  const [showAddTeamModal, setShowAddTeamModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showGhostForm, setShowGhostForm] = useState(false);
  const [ghostForm, setGhostForm] = useState({ teamName: '', captainName: '', captainMobile: '', city: '' });
  const [showSettingsSidebar, setShowSettingsSidebar] = useState(false);
  const [showFixturePreview, setShowFixturePreview] = useState(false);
  const [knockoutPreviewTeams, setKnockoutPreviewTeams] = useState([]);
  const [shareData, setShareData] = useState(null);
  const [showTeamShareModal, setShowTeamShareModal] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(Boolean(openRegisterModal || route.params?.action === 'join-team'));
  const [auctionDetails, setAuctionDetails] = useState(null);

  const [isAuctionRegistered, setIsAuctionRegistered] = useState(false);

  const [myRegistrationData, setMyRegistrationData] = useState(null);
  const [ownerData, setOwnerData] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [myTeams, setMyTeams] = useState([]);

  // New Management Modals
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showWizardModal, setShowWizardModal] = useState(false);
  const [roleType, setRoleType] = useState('coOrganizers');
  const [showEditDetailsModal, setShowEditDetailsModal] = useState(false);
  const [showStartMatchModal, setShowStartMatchModal] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState(null);
  const [showScenarioModal, setShowScenarioModal] = useState(false);
  const [calculatingQualifications, setCalculatingQualifications] = useState(false);
  const [showScenarioCalculator, setShowScenarioCalculator] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [completeLoading, setCompleteLoading] = useState(false);
  const [completeWinnerId, setCompleteWinnerId] = useState('');
  const [scenarioData, setScenarioData] = useState({
    teamId: '',
    opponentId: '',
    battingFirst: true,
    firstInningsScore: '',
    targetRank: '4'
  });
  const [scenarioResult, setScenarioResult] = useState(null);
  const [scenarioLoading, setScenarioLoading] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState({});

  const matchesRef = useRef([]);

  useEffect(() => {
    matchesRef.current = tournament?.matches || [];
  }, [tournament?.matches]);

  // useFocusEffect merged below

  const joinedTournamentRoomsRef = useRef(new Set());

  // Listen for score updates once on mount
  useEffect(() => {
    const unsubscribeScore = socketService.onScoreUpdate((data) => {
      const mId = socketService.cleanId(data?.matchId || data?.match?._id || data?.id);
      socketService.remoteLog('TournamentDetailScreen', `Score update received for match: ${mId}`, { score: data?.score });
      if (data && mId && (data.score || data.teamAScore || data.teamBScore)) {
        setTournament(prev => {
          if (!prev) return prev;
          const updatedMatches = prev.matches.map(m => {
            const currentMId = socketService.cleanId(m._id || m.id);
            if (currentMId === mId) {
              const newM = { ...m };
              const bTeamId = String(data.battingTeam?._id || data.battingTeam || '').trim();
              const teamAId = String(newM.teamA?._id || newM.teamA || '').trim();
              const teamBId = String(newM.teamB?._id || newM.teamB || '').trim();

              if (bTeamId && bTeamId === teamAId) {
                newM.teamAScore = { ...newM.teamAScore, ...data.score };
              } else if (bTeamId && bTeamId === teamBId) {
                newM.teamBScore = { ...newM.teamBScore, ...data.score };
              }
              if (data.status || data.match?.status) {
                newM.status = data.status || data.match.status;
              }
              return newM;
            }
            return m;
          });
          socketService.remoteLog('TournamentDetailScreen', 'Tournament matches UI updated');
          return { ...prev, matches: updatedMatches };
        });
      }
    });

    return () => {
      if (unsubscribeScore) unsubscribeScore();
    };
  }, []);

  // Sync match rooms joining/leaving when matches list changes
  useEffect(() => {
    if (tournament?.matches && tournament.matches.length > 0) {
      const activeIds = new Set();
      tournament.matches.forEach(m => {
        if (m.status === 'in_progress' || m.status === 'toss_done' || m.status === 'innings_break') {
          const cleanId = socketService.cleanId(m._id || m.id);
          activeIds.add(cleanId);
        }
      });

      // Join new rooms
      activeIds.forEach(id => {
        if (!joinedTournamentRoomsRef.current.has(id)) {
          socketService.joinMatch(id);
          joinedTournamentRoomsRef.current.add(id);
          socketService.remoteLog('TournamentDetailScreen', `Joined tournament match room: match_${id}`);
        }
      });

      // Leave old rooms no longer in the active list
      joinedTournamentRoomsRef.current.forEach(id => {
        if (!activeIds.has(id)) {
          socketService.leaveMatch(id);
          joinedTournamentRoomsRef.current.delete(id);
          socketService.remoteLog('TournamentDetailScreen', `Left tournament match room: match_${id}`);
        }
      });
    } else {
      joinedTournamentRoomsRef.current.forEach(id => {
        socketService.leaveMatch(id);
        socketService.remoteLog('TournamentDetailScreen', `Left tournament match room (empty list): match_${id}`);
      });
      joinedTournamentRoomsRef.current.clear();
    }
  }, [tournament?.matches]);

  // Clean up all tournament rooms on unmount
  useEffect(() => {
    return () => {
      joinedTournamentRoomsRef.current.forEach(id => {
        socketService.leaveMatch(id);
      });
      joinedTournamentRoomsRef.current.clear();
    };
  }, []);

  const fetchAuctionData = useCallback(async () => {
    if (activeTab === 'Auction' && tournamentId) {
      try {
        const res = await auctionService.getAuctionDetails(tournamentId);
        if (res.data?.exists) {
          setAuctionDetails(res.data);
          if (res.data._id) {
            try {
              const regRes = await auctionService.getMyRegistration(res.data._id);
              if (regRes.data) {
                setIsAuctionRegistered(true);
                setMyRegistrationData(regRes.data);
              } else {
                setIsAuctionRegistered(false);
                setMyRegistrationData(null);
              }
            } catch (e) {
              setIsAuctionRegistered(false);
              setMyRegistrationData(null);
            }
          }
        }
      } catch (err) {
        console.log('Error fetching auction details', err);
      }
    }
  }, [activeTab, tournamentId]);

  useEffect(() => {
    if (auctionDetails?._id && tournament?.teams && user?._id) {
      const isOwner = tournament.teams.find(
        (t) => t.captain === user._id || t.owner === user._id
      );
      if (isOwner) {
        auctionService.getOwnerDashboard(auctionDetails._id)
          .then(res => setOwnerData(res.data))
          .catch(e => console.log('Error fetching owner data', e));
      }
    }
  }, [auctionDetails?._id, tournament?.teams, user?._id]);

  useFocusEffect(
    useCallback(() => {
      fetchAuctionData();
      fetchDashboard();
      fetchMyTeams();
    }, [fetchAuctionData, tournamentId])
  );

  const fetchMyTeams = async () => {
    try {
      const res = await api.get('/teams/my/teams');
      setMyTeams(res.data.data || []);
    } catch (e) {
      console.log('Error fetching user teams', e);
    }
  };



  const fetchDashboard = async () => {
    try {
      const res = await api.get(`/tournaments/${tournamentId}/dashboard`);
      setTournament(res.data.data);
    } catch (e) {
      console.log('Error fetching tournament dashboard', e);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDashboard();
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  };

  const handleRegenerateKnockoutPreview = () => {
    if (!tournament?.registeredTeams) return;
    const shuffled = [...tournament.registeredTeams].sort(() => Math.random() - 0.5);
    setKnockoutPreviewTeams(shuffled);
  };

  const handleGenerateFixtures = () => {
    if (!tournament?.registeredTeams || tournament.registeredTeams.length < 2) {
      showCustomAlert('Error', 'Not enough teams to generate fixtures.');
      return;
    }
    if (tournament.format?.toLowerCase() === 'knockout') {
      const shuffled = [...tournament.registeredTeams].sort(() => Math.random() - 0.5);
      setKnockoutPreviewTeams(shuffled);
      setShowFixturePreview(true);
    } else {
      setShowWizardModal(true);
    }
  };

  const confirmGenerateFixtures = async () => {
    try {
      setLoading(true);
      const teamIds = tournament.format?.toLowerCase() === 'knockout'
        ? knockoutPreviewTeams.map(rt => rt.team?._id || rt.team)
        : null;

      await api.post(`/tournaments/${tournamentId}/generate-fixtures`, { teamIds });
      await fetchDashboard();
      setShowFixturePreview(false);
      showCustomAlert('Success', 'Fixtures generated successfully!');
    } catch (e) {
      console.log('Error generating fixtures', e);
      showCustomAlert('Error', e.response?.data?.message || 'Failed to generate fixtures');
      setLoading(false);
    }
  };

  const renderKnockoutPreviewCards = () => {
    const cards = [];
    let matchCount = 1;
    for (let i = 0; i < knockoutPreviewTeams.length; i += 2) {
      const teamA = knockoutPreviewTeams[i]?.team;
      const teamB = knockoutPreviewTeams[i + 1]?.team;

      cards.push(
        <View key={matchCount} style={{
          backgroundColor: colors.background,
          borderRadius: 12,
          padding: 14,
          marginBottom: 10,
          borderWidth: 1,
          borderColor: colors.borderLight,
        }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)', paddingBottom: 6 }}>
            <Text style={{ fontSize: 11, color: colors.primary, fontFamily: Typography.fontFamily.bold, letterSpacing: 0.5 }}>
              MATCH {matchCount}
            </Text>
            <Text style={{ fontSize: 11, color: colors.textTertiary, fontFamily: Typography.fontFamily.medium }}>
              Knockout Round 1
            </Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 }}>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: colors.border, justifyContent: 'center', alignItems: 'center', marginBottom: 4 }}>
                <MCIcon name="cricket" size={16} color={colors.textSecondary} />
              </View>
              <Text style={{ fontSize: 13, color: colors.textPrimary, fontFamily: Typography.fontFamily.bold, textAlign: 'center' }} numberOfLines={1}>
                {teamA?.name || 'TBD'}
              </Text>
            </View>

            <View style={{ paddingHorizontal: 12, alignItems: 'center' }}>
              <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: colors.primaryAlpha10, borderWidth: 1, borderColor: colors.primaryAlpha20, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ fontSize: 9, color: colors.primary, fontFamily: Typography.fontFamily.bold }}>VS</Text>
              </View>
            </View>

            <View style={{ flex: 1, alignItems: 'center' }}>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: colors.border, justifyContent: 'center', alignItems: 'center', marginBottom: 4 }}>
                <MCIcon name="cricket" size={16} color={colors.textSecondary} />
              </View>
              <Text style={{ fontSize: 13, color: colors.textPrimary, fontFamily: Typography.fontFamily.bold, textAlign: 'center' }} numberOfLines={1}>
                {teamB?.name || 'BYE'}
              </Text>
            </View>
          </View>
        </View>
      );
      matchCount++;
    }
    return cards;
  };

  const generatePreviewText = () => {
    if (!tournament) return '';
    const teams = tournament.registeredTeams || [];
    let preview = '';

    if (tournament.format?.toLowerCase() === 'knockout') {
      let matchCount = 1;
      for (let i = 0; i < teams.length; i += 2) {
        const teamA = teams[i].team?.name || 'TBD';
        const teamB = teams[i + 1] ? teams[i + 1].team?.name : 'BYE';
        preview += `Match ${matchCount}: ${teamA} vs ${teamB}\n\n`;
        matchCount++;
      }
    } else {
      const teamsPerGroup = tournament.teamsPerGroup || teams.length;
      const numGroups = Math.ceil(teams.length / teamsPerGroup);

      let matchCount = 1;
      let teamIndex = 0;

      for (let g = 0; g < numGroups; g++) {
        const groupTeams = teams.slice(teamIndex, teamIndex + teamsPerGroup);
        teamIndex += teamsPerGroup;

        if (numGroups > 1) {
          preview += `--- Group ${String.fromCharCode(65 + g)} ---\n`;
        }
        for (let i = 0; i < groupTeams.length; i++) {
          for (let j = i + 1; j < groupTeams.length; j++) {
            const tA = groupTeams[i].team?.name || 'TBD';
            const tB = groupTeams[j].team?.name || 'TBD';
            preview += `Match ${matchCount}: ${tA} vs ${tB}\n`;
            matchCount++;
          }
        }
        preview += '\n';
      }
    }
    return preview.trim();
  };

  const isMainOrganizer = (tournament?.organizer?._id || tournament?.organizer) === user?._id;
  const isOrganizer = isMainOrganizer || tournament?.coOrganizers?.some(o => (o._id || o) === user?._id);
  const canStartMatch = isOrganizer;

  const handleShareTournament = async () => {
    setShareData({ type: 'tournament', data: tournament });
  };

  const handleShareJoinLink = async () => {
    setShareData({ type: 'teamInvite', data: tournament });
  };

  const handleCalculateQualifications = async () => {
    try {
      setCalculatingQualifications(true);
      await api.post(`/tournaments/${tournamentId}/calculate-qualifications`);
      Alert.alert('Success', 'Qualifications calculated successfully');
      fetchDashboard();
    } catch (e) {
      Alert.alert('Error', e.response?.data?.message || 'Failed to calculate qualifications');
    } finally {
      setCalculatingQualifications(false);
    }
  };

  const handleMarkTournamentCompleted = async (winnerId, runnerUpId) => {
    try {
      setCompleteLoading(true);
      await api.put(`/tournaments/${tournamentId}/complete`, { winner: winnerId || undefined, runnerUp: runnerUpId || undefined });
      await fetchDashboard();
      setShowCompleteModal(false);
      showCustomAlert('Done', 'Tournament has been marked as completed!');
    } catch (e) {
      showCustomAlert('Error', e.response?.data?.message || 'Failed to complete tournament');
    } finally {
      setCompleteLoading(false);
    }
  };

  const handleCalculateScenario = async () => {
    if (!scenarioData.teamId || !scenarioData.opponentId || !scenarioData.firstInningsScore || !scenarioData.targetRank) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }
    try {
      setScenarioLoading(true);
      const res = await api.post(`/tournaments/${tournamentId}/scenario-calculator`, scenarioData);
      setScenarioResult(res.data);
    } catch (e) {
      Alert.alert('Error', e.response?.data?.message || 'Failed to calculate scenario');
    } finally {
      setScenarioLoading(false);
    }
  };

  const searchTeams = async () => {
    if (!searchQuery) return;
    setSearching(true);
    setShowGhostForm(false);
    try {
      const res = await api.get(`/teams/search?q=${searchQuery}`);
      setSearchResults(res.data.data);
    } catch (e) {
      console.log('Search error', e);
    } finally {
      setSearching(false);
    }
  };

  const handleRegisterTeam = async (teamId) => {
    setActionLoading(true);
    try {
      await api.post(`/tournaments/${tournamentId}/register`, { teamId });
      showCustomAlert('Success', 'Team registered successfully!');
      setShowRegisterModal(false);
      setShowAddTeamModal(false);
      fetchDashboard();
    } catch (e) {
      showCustomAlert('Error', e.response?.data?.message || 'Failed to register team');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveTeam = (teamId, teamName) => {
    showCustomAlert(
      'Remove Team',
      `Are you sure you want to remove ${teamName || 'this team'} from the tournament?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          onPress: async () => {
            setActionLoading(true);
            try {
              await api.delete(`/tournaments/${tournamentId}/remove-team/${teamId}`);
              showCustomAlert('Success', 'Team removed successfully!');
              fetchDashboard();
            } catch (e) {
              showCustomAlert('Error', e.response?.data?.message || 'Failed to remove team');
            } finally {
              setActionLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleCreateGhostTeam = async () => {
    if (!ghostForm.teamName || !ghostForm.captainMobile) {
      showCustomAlert('Error', 'Team Name and Captain Mobile are required.');
      return;
    }
    setActionLoading(true);
    try {
      await api.post(`/tournaments/${tournamentId}/add-ghost-team`, ghostForm);
      showCustomAlert('Success', 'Ghost team created and registered!');
      setShowAddTeamModal(false);
      setShowGhostForm(false);
      setGhostForm({ teamName: '', captainName: '', captainMobile: '', city: '' });
      fetchDashboard();
    } catch (e) {
      showCustomAlert('Error', e.response?.data?.message || 'Failed to create ghost team');
    } finally {
      setActionLoading(false);
    }
  };

  const handleFollowTournament = async () => {
    try {
      const isFollowing = tournament.followers?.includes(user?._id);
      if (isFollowing) {
        await api.post(`/tournaments/${tournamentId}/unfollow`);
      } else {
        await api.post(`/tournaments/${tournamentId}/follow`);
      }
      const msg = isFollowing ? 'You unfollowed this tournament.' : 'You are now following this tournament!';
      const actionStr = isFollowing ? 'Unfollowed' : 'Following';

      if (Platform.OS === 'android') ToastAndroid.show(msg, ToastAndroid.SHORT);
      else showCustomAlert(actionStr, msg);

      fetchDashboard();
    } catch (e) {
      console.log('Error following/unfollowing tournament', e);
      showCustomAlert('Error', e.response?.data?.message || 'Failed to follow/unfollow tournament');
    }
  };

  if (loading || !tournament) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', paddingTop: safeTop }]}>
        <MCIcon name="cricket" size={48} color={colors.primary} style={{ marginBottom: 16, opacity: 0.6 }} />
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ color: colors.textSecondary, marginTop: 12, fontFamily: Typography.fontFamily.medium, fontSize: 14 }}>Loading tournament...</Text>
      </View>
    );
  }

  // --- TAB RENDERERS ---

  const InfoRow = ({ iconName, iconLib, label, value }) => (
    <View style={styles.infoRow}>
      <View style={styles.infoIconWrap}>
        {iconLib === 'mc'
          ? <MCIcon name={iconName} size={16} color={colors.primary} />
          : <Icon name={iconName} size={15} color={colors.primary} />}
      </View>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );

  const renderOverview = () => (
    <KeyboardAwareScrollView enableOnAndroid={true} extraScrollHeight={20} keyboardShouldPersistTaps="handled" style={styles.tabContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />}>

      {tournament.tournamentType === 'Auction' && !isOrganizer && (
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <MCIcon name="gavel" size={16} color={colors.primary} />
            <Text style={styles.sectionTitle}>Auction Registration</Text>
          </View>

          {(() => {
            const regEndDate = auctionDetails?.registrationEndDate;
            const regEndPassed = regEndDate ? moment().isAfter(moment.utc(regEndDate).endOf('day')) : false;
            const auctionDate = auctionDetails?.auctionDate;
            const auctionDateReached = !auctionDate || moment().isSameOrAfter(moment.utc(auctionDate).startOf('day'));

            if (isAuctionRegistered) {
              return (
                <TouchableOpacity
                  style={[auctionStyles.actionRow, { marginTop: 12, paddingHorizontal: 0, backgroundColor: 'transparent' }]}
                  onPress={() => navigation.navigate('AuctionRegistration', { tournamentId: tournament._id })}
                >
                  <View style={[auctionStyles.actionIcon, { backgroundColor: 'rgba(74,222,128,0.12)' }]}>
                    <MCIcon name="check-circle" size={20} color="#4ADE80" />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={auctionStyles.actionTitle}>You Are Registered</Text>
                    <Text style={auctionStyles.actionSub}>Tap to view your registration</Text>
                  </View>
                  <MCIcon name="chevron-right" size={22} color={colors.textTertiary} />
                </TouchableOpacity>
              );
            }

            if (regEndPassed) {
              if (auctionDateReached && auctionDetails?.status !== 'completed') {
                return (
                  <TouchableOpacity
                    style={{
                      backgroundColor: colors.warning,
                      paddingVertical: 14,
                      borderRadius: 12,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginTop: 12
                    }}
                    onPress={() => {
                      if (auctionDetails?._id) {
                        navigation.navigate('AuctionLivePublic', { auctionId: auctionDetails._id });
                      } else {
                        showCustomAlert('Error', 'Auction details not found.');
                      }
                    }}
                  >
                    <MCIcon name="eye" size={20} color={colors.black} />
                    <Text style={{
                      color: colors.black,
                      fontSize: 16,
                      fontFamily: Typography.fontFamily.semiBold,
                      marginLeft: 8
                    }}>Watch Live Auction</Text>
                  </TouchableOpacity>
                );
              }

              return (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, opacity: 0.7 }}>
                  <View style={[auctionStyles.actionIcon, { backgroundColor: 'rgba(239,68,68,0.12)' }]}>
                    <MCIcon name="lock" size={20} color="#EF4444" />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={auctionStyles.actionTitle}>Registration Closed</Text>
                    <Text style={auctionStyles.actionSub}>Registration ended. Tap for details.</Text>
                  </View>
                </View>
              );
            }

            return (
              <TouchableOpacity
                style={{
                  backgroundColor: colors.primary,
                  paddingVertical: 14,
                  borderRadius: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginTop: 12
                }}
                onPress={() => navigation.navigate('AuctionRegistration', { tournamentId: tournament._id })}
              >
                <MCIcon name="account-plus" size={20} color={colors.black} />
                <Text style={{
                  color: colors.black,
                  fontSize: 16,
                  fontFamily: Typography.fontFamily.semiBold,
                  marginLeft: 8
                }}>Register for Auction</Text>
              </TouchableOpacity>
            );
          })()}
        </View>
      )}

      {/* Stats Strip */}
      <View style={styles.statsStrip}>
        <View style={styles.statBox}>
          <Text style={styles.statNum}>{tournament.registeredTeams?.length || 0}</Text>
          <Text style={styles.statLabel}>Teams</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <Text style={styles.statNum}>{tournament.matches?.length || 0}</Text>
          <Text style={styles.statLabel}>Matches</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <Text style={styles.statNum}>{tournament.overs}</Text>
          <Text style={styles.statLabel}>Overs</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <Text style={styles.statNum}>₹{tournament.entryFee || 0}</Text>
          <Text style={styles.statLabel}>Entry Fee</Text>
        </View>
      </View>

      {/* Premium Champion Banner when tournament is completed */}
      {tournament.status === 'completed' && (
        <View style={{ marginHorizontal: Spacing.md, marginBottom: 16, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255, 204, 0, 0.4)' }}>
          <LinearGradient colors={['rgba(255, 204, 0, 0.15)', colors.surface, isDark ? colors.backgroundElevated : colors.surface]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 24, alignItems: 'center' }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255, 204, 0, 0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255, 204, 0, 0.3)' }}>
              <MCIcon name="trophy" size={32} color={colors.primary} style={{ textShadowColor: 'rgba(255,204,0,0.6)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8 }} />
            </View>
            <Text style={{ color: colors.textPrimary, fontFamily: Typography.fontFamily.bold, fontSize: 20, marginBottom: 4, letterSpacing: 0.5 }}>Tournament Completed!</Text>

            {tournament.winner?.name && (
              <View style={{ width: '100%', alignItems: 'center', marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border }}>
                <Text style={{ color: colors.primary, fontFamily: Typography.fontFamily.bold, fontSize: 11, textTransform: 'uppercase', letterSpacing: 3, marginBottom: 10 }}>C h a m p i o n</Text>
                <TouchableOpacity
                  onPress={() => navigation.navigate('TeamDetail', { id: tournament.winner._id || tournament.winner })}
                  style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 24, ...shadows.sm, shadowColor: colors.primary }}
                  activeOpacity={0.8}
                >
                  <Text style={{ color: '#000000', fontFamily: Typography.fontFamily.bold, fontSize: 16 }}>🏆 {tournament.winner.name}</Text>
                  <Icon name="chevron-right" size={18} color="#000000" style={{ marginLeft: 6 }} />
                </TouchableOpacity>
              </View>
            )}
            {tournament.runnerUp?.name && (
              <TouchableOpacity
                onPress={() => navigation.navigate('TeamDetail', { id: tournament.runnerUp._id || tournament.runnerUp })}
                style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', marginTop: 12 }}
                activeOpacity={0.8}
              >
                <Text style={{ color: colors.textSecondary, fontFamily: Typography.fontFamily.semiBold, fontSize: 13 }}>🥈 Runner-up: {tournament.runnerUp.name}</Text>
                <Icon name="chevron-right" size={14} color={colors.textSecondary} style={{ marginLeft: 6 }} />
              </TouchableOpacity>
            )}
          </LinearGradient>
        </View>
      )}

      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <MCIcon name="format-list-bulleted" size={18} color={colors.primary} />
          <Text style={styles.sectionTitle}>Format & Settings</Text>
        </View>
        <InfoRow iconLib="mc" iconName="trophy-variant" label="Type" value={tournament.tournamentType || 'Standard'} />
        <InfoRow iconLib="mc" iconName="cricket" label="Format" value={tournament.format?.toUpperCase() || 'Custom'} />
        <InfoRow iconLib="mc" iconName="circle-outline" label="Ball Type" value={tournament.ballType || '-'} />
        <InfoRow iconLib="mc" iconName="grass" label="Ground Type" value={tournament.groundType || '-'} />
      </View>

      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <Icon name="map-pin" size={16} color={colors.primary} />
          <Text style={styles.sectionTitle}>Logistics</Text>
        </View>
        <InfoRow iconLib="feather" iconName="calendar" label="Start Date" value={moment.utc(tournament.startDate).format('DD MMM YYYY')} />
        <InfoRow iconLib="feather" iconName="map-pin" label="City" value={tournament.city || '-'} />
        {tournament.groundName ? <InfoRow iconLib="mc" iconName="stadium" label="Ground" value={tournament.groundName} /> : null}
      </View>

      {tournament.rules ? (
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Icon name="file-text" size={16} color={colors.primary} />
            <Text style={styles.sectionTitle}>Rules</Text>
          </View>
          <Text style={[styles.bodyText, { marginTop: 8, lineHeight: 22 }]}>{tournament.rules}</Text>
        </View>
      ) : null}

      {tournament.organizer && (
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Icon name="user" size={16} color={colors.primary} />
            <Text style={styles.sectionTitle}>Organizer</Text>
          </View>
          <View style={styles.organizerRow}>
            <Image source={{ uri: tournament.organizer.photo ? getImageUrl(tournament.organizer.photo) : 'https://via.placeholder.com/50' }} style={styles.organizerAvatar} />
            <View style={{ flex: 1 }}>
              <Text style={styles.teamName}>{tournament.organizer.name}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                <Icon name="phone" size={12} color={colors.textTertiary} />
                <Text style={[styles.teamSub, { marginLeft: 4 }]}>{tournament.organizer.mobile}</Text>
              </View>
            </View>
            <View style={styles.organizerBadge}>
              <Text style={styles.organizerBadgeText}>Organizer</Text>
            </View>
          </View>
        </View>
      )}

      <View style={{ height: 40 }} />
    </KeyboardAwareScrollView>
  );

  const renderTeams = () => {
    const teamCount = tournament.registeredTeams?.length || 0;
    const maxTeams = tournament.maxTeams || 0;
    const spotsLeft = Math.max(0, maxTeams - teamCount);

    return (
      <View style={{ flex: 1 }}>
        {isOrganizer && tournament.status !== 'completed' && (
          <View style={styles.actionGrid}>
            <TouchableOpacity
              style={[
                styles.actionGridBtn,
                (teamCount <= 1 || tournament.matches?.some(m => m.status !== 'scheduled') || tournament.status === 'completed') && { opacity: 0.5 }
              ]}
              onPress={() => {
                if (teamCount <= 1) {
                  showCustomAlert('Locked', 'Add more than 1 team to generate fixtures.');
                } else if (tournament.status === 'completed') {
                  showCustomAlert('Completed', 'Tournament has already finished.');
                } else if (tournament.matches?.some(m => m.status !== 'scheduled')) {
                  showCustomAlert('Locked', 'Fixtures cannot be generated after matches have started.');
                } else {
                  handleGenerateFixtures();
                }
              }}
              disabled={loading || tournament.status === 'completed'}
            >
              <View style={[
                styles.actionGridIcon,
                (teamCount <= 1 || tournament.matches?.some(m => m.status !== 'scheduled') || tournament.status === 'completed') && { backgroundColor: 'rgba(255,255,255,0.05)' }
              ]}>
                <Icon
                  name={(teamCount <= 1 || tournament.matches?.some(m => m.status !== 'scheduled') || tournament.status === 'completed') ? "lock" : "calendar"}
                  size={20}
                  color={(teamCount <= 1 || tournament.matches?.some(m => m.status !== 'scheduled') || tournament.status === 'completed') ? colors.textTertiary : colors.primary}
                />
              </View>
              <Text style={styles.actionGridText}>Fixtures</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.actionGridBtn,
                teamCount <= 2 && { opacity: 0.5 }
              ]}
              onPress={() => {
                if (teamCount <= 2) {
                  showCustomAlert('Locked', 'Add more than 2 teams to manage groups.');
                } else {
                  setShowGroupModal(true);
                }
              }}
            >
              <View style={[
                styles.actionGridIcon,
                teamCount <= 2 && { backgroundColor: 'rgba(255,255,255,0.05)' }
              ]}>
                {teamCount <= 2 ? (
                  <Icon name="lock" size={20} color={colors.textTertiary} />
                ) : (
                  <MCIcon name="layers-triple" size={20} color={colors.primary} />
                )}
              </View>
              <Text style={styles.actionGridText}>Groups</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionGridBtn} onPress={() => setShowAddTeamModal(true)}>
              <View style={styles.actionGridIcon}>
                <Icon name="user-plus" size={20} color={colors.primary} />
              </View>
              <Text style={styles.actionGridText}>Add Team</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionGridBtn} onPress={handleShareJoinLink}>
              <View style={styles.actionGridIcon}>
                <Icon name="link" size={20} color={colors.primary} />
              </View>
              <Text style={styles.actionGridText}>Invite</Text>
            </TouchableOpacity>
          </View>
        )}

        <FlatList
          data={tournament.registeredTeams}
          keyExtractor={(item, index) => item?.team?._id || item?._id || index.toString()}
          contentContainerStyle={[styles.tabContent, { paddingTop: 8 }]}
          ListHeaderComponent={
            teamCount > 0 ? (
              <Text style={{
                fontSize: 14,
                color: colors.textSecondary,
                fontFamily: Typography.fontFamily.semiBold,
                marginHorizontal: Spacing.md,
                marginTop: Spacing.xs,
                marginBottom: Spacing.sm
              }}>
                Registered Teams ({teamCount})
              </Text>
            ) : null
          }
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingVertical: 40 }}>
              <MCIcon name="account-group-outline" size={48} color={colors.textTertiary} />
              <Text style={[styles.emptyText, { marginTop: 12 }]}>No teams registered yet.</Text>
            </View>
          }
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />}
          renderItem={({ item, index }) => {
            if (!item?.team) return null;
            return (
              <TouchableOpacity
                style={styles.teamCard}
                onPress={() => navigation.navigate('TeamDetail', { id: item.team._id })}
                activeOpacity={0.75}
              >
                <Text style={styles.teamRankText}>#{index + 1}</Text>
                {item.team.logo ? (
                  <Image
                    source={{ uri: getImageUrl(item.team.logo) }}
                    style={styles.teamLogo}
                  />
                ) : (
                  <View style={[styles.teamLogo, { backgroundColor: isDark ? 'rgba(255,204,0,0.15)' : 'rgba(230,184,0,0.12)', justifyContent: 'center', alignItems: 'center', borderColor: isDark ? 'rgba(255,204,0,0.3)' : 'rgba(230,184,0,0.4)' }]}>
                    <Text style={{ color: isDark ? colors.primary : '#8B6E00', fontFamily: Typography.fontFamily.bold, fontSize: 16 }}>
                      {(item.team.name || 'T').trim().charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.teamName}>{item.team.name}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2, gap: 4 }}>
                    <Icon name="map-pin" size={11} color={colors.textTertiary} />
                    <Text style={styles.teamSub}>{item.team.city || 'Unknown City'}</Text>
                  </View>
                </View>
                {isMainOrganizer && tournament.status !== 'completed' ? (
                  <TouchableOpacity
                    style={styles.removeTeamBtn}
                    onPress={() => handleRemoveTeam(item.team._id, item.team.name)}
                    disabled={actionLoading}
                  >
                    <Icon name="trash-2" size={15} color={colors.error} />
                  </TouchableOpacity>
                ) : (
                  <Icon name="chevron-right" size={17} color={colors.textTertiary} />
                )}
              </TouchableOpacity>
            );
          }}
        />
      </View>
    );
  };

  const renderMatches = () => {
    const isTournamentCompleted = tournament.status === 'completed';
    const liveStatuses = ['toss_done', 'in_progress', 'innings_break', 'super_over'];
    let filteredMatches = [];
    if (matchSubTab === 'Upcoming') {
      filteredMatches = (tournament.matches?.filter(m => m.status === 'scheduled') || [])
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    } else if (matchSubTab === 'Live') {
      filteredMatches = (tournament.matches?.filter(m => liveStatuses.includes(m.status)) || [])
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    } else if (matchSubTab === 'Past') {
      filteredMatches = (tournament.matches?.filter(m => ['completed', 'abandoned', 'no_result'].includes(m.status)) || [])
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    }

    if (selectedTeamFilter) {
      filteredMatches = filteredMatches.filter(m => m.teamA?._id === selectedTeamFilter || m.teamB?._id === selectedTeamFilter || m.teamA === selectedTeamFilter || m.teamB === selectedTeamFilter);
    }

    return (
      <View style={{ flex: 1 }}>
        {isOrganizer && (() => {
          const hasMatches = tournament.matches && tournament.matches.length > 0;
          const hasRemainingMatches = hasMatches && tournament.matches.some(m => !['completed', 'abandoned', 'no_result'].includes(m.status));
          const isCompleted = tournament.status === 'completed';
          const isMatchStarted = hasMatches && tournament.matches.some(m => m.status !== 'scheduled');

          if (isCompleted) return null;

          return (
            <View style={{ paddingHorizontal: Spacing.md, paddingTop: Spacing.md, paddingBottom: 0, flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                style={[
                  styles.startMatchBtn,
                  { flex: 1, backgroundColor: colors.backgroundElevated, borderWidth: 1, borderColor: colors.primary },
                  (isMatchStarted || isCompleted) && { opacity: 0.5, borderColor: colors.border }
                ]}
                onPress={() => {
                  if (isMatchStarted || isCompleted) {
                    showCustomAlert('Locked', 'Fixtures cannot be regenerated after matches have started.');
                  } else {
                    handleGenerateFixtures();
                  }
                }}
                disabled={isMatchStarted || isCompleted}
              >
                <MCIcon name="calendar-refresh" size={18} color={(isMatchStarted || isCompleted) ? colors.textSecondary : colors.primary} style={{ marginRight: 8 }} />
                <Text style={[styles.startMatchBtnText, { color: (isMatchStarted || isCompleted) ? colors.textSecondary : colors.primary }]}>
                  Fixtures
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.startMatchBtn, { flex: 1 }, isCompleted && { opacity: 0.6 }]}
                onPress={() => setShowStartMatchModal(true)}
                disabled={isCompleted}
              >
                <MCIcon name="play-circle" size={18} color='#000000' style={{ marginRight: 8 }} />
                <Text style={styles.startMatchBtnText}>
                  {isCompleted ? 'Completed' : 'Start Match'}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })()}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: Spacing.md, marginTop: 12, marginBottom: 8 }}>
          <Text style={{ fontSize: 15, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary }}>Fixtures & Schedule</Text>
          {tournament.matches && tournament.matches.some(m => m.status === 'scheduled') ? (
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 5, paddingHorizontal: 12, borderRadius: 14, backgroundColor: isDark ? 'rgba(154,188,47,0.15)' : 'rgba(230,184,0,0.15)' }}
              onPress={() => setShowTeamShareModal(true)}
            >
              <Icon name="share-2" size={13} color={isDark ? colors.primary : '#8B6E00'} style={{ marginRight: 4 }} />
              <Text style={{ color: isDark ? colors.primary : '#8B6E00', fontFamily: Typography.fontFamily.bold, fontSize: 12 }}>Share Schedule</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={{ flexDirection: 'row', marginHorizontal: Spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: 12 }}>
          {['Live', 'Upcoming', 'Past'].map(tab => {
            const liveCount = tab === 'Live' ? (tournament.matches?.filter(m => ['toss_done', 'in_progress', 'innings_break', 'super_over'].includes(m.status)) || []).length : 0;
            return (
              <TouchableOpacity
                key={tab}
                style={[styles.matchSubTab, matchSubTab === tab && styles.matchSubTabActive]}
                onPress={() => setMatchSubTab(tab)}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={[styles.matchSubTabText, matchSubTab === tab && styles.matchSubTabTextActive]}>{tab}</Text>
                  {tab === 'Live' && liveCount > 0 && (
                    <View style={[styles.liveCountBadge, matchSubTab === 'Live' && styles.liveCountBadgeActive, { marginLeft: 5 }]}>
                      <Text style={[styles.liveCountText, matchSubTab === 'Live' && { color: isDark ? '#000000' : '#FFFFFF' }]}>{liveCount}</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Tournament completed banner for non-Past tabs */}
        {isTournamentCompleted && matchSubTab !== 'Past' ? (
          <View style={{ marginHorizontal: Spacing.md, marginBottom: 16, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: isDark ? 'rgba(255, 204, 0, 0.4)' : 'rgba(255, 204, 0, 0.6)' }}>
            <LinearGradient colors={isDark ? ['rgba(255, 204, 0, 0.15)', colors.backgroundCard, colors.backgroundElevated] : ['#FFFDF0', '#FFF8D6', '#FFFDF0']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 20, alignItems: 'center' }}>
              <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255, 204, 0, 0.18)', alignItems: 'center', justifyContent: 'center', marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255, 204, 0, 0.4)' }}>
                <MCIcon name="trophy" size={28} color={isDark ? colors.primary : '#B38F00'} />
              </View>
              <Text style={{ color: colors.textPrimary, fontFamily: Typography.fontFamily.bold, fontSize: 18, marginBottom: 4, letterSpacing: 0.5 }}>Tournament Completed!</Text>

              {tournament.winner?.name && (
                <View style={{ width: '100%', alignItems: 'center', marginTop: 12, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.border }}>
                  <Text style={{ color: isDark ? colors.primary : '#997A00', fontFamily: Typography.fontFamily.bold, fontSize: 10, textTransform: 'uppercase', letterSpacing: 3, marginBottom: 8 }}>C h a m p i o n</Text>
                  <TouchableOpacity
                    onPress={() => navigation.navigate('TeamDetail', { id: tournament.winner._id || tournament.winner })}
                    style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 24, ...shadows.sm, shadowColor: colors.primary }}
                    activeOpacity={0.8}
                  >
                    <Text style={{ color: '#000000', fontFamily: Typography.fontFamily.bold, fontSize: 14 }}>🏆 {tournament.winner.name}</Text>
                    <Icon name="chevron-right" size={16} color="#000000" style={{ marginLeft: 6 }} />
                  </TouchableOpacity>
                </View>
              )}
              {tournament.runnerUp?.name && (
                <TouchableOpacity
                  onPress={() => navigation.navigate('TeamDetail', { id: tournament.runnerUp._id || tournament.runnerUp })}
                  style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: colors.border, marginTop: 10 }}
                  activeOpacity={0.8}
                >
                  <Text style={{ color: colors.textSecondary, fontFamily: Typography.fontFamily.semiBold, fontSize: 12 }}>🥈 Runner-up: {tournament.runnerUp.name}</Text>
                  <Icon name="chevron-right" size={14} color={colors.textSecondary} style={{ marginLeft: 6 }} />
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={{ marginTop: 16, paddingVertical: 10, paddingHorizontal: 24, backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)', borderRadius: 24, borderWidth: 1, borderColor: colors.border }}
                onPress={() => setMatchSubTab('Past')}
              >
                <Text style={{ color: colors.textPrimary, fontFamily: Typography.fontFamily.bold, fontSize: 13 }}>View All Results</Text>
              </TouchableOpacity>
            </LinearGradient>
          </View>
        ) : (
          <FlatList
            data={filteredMatches}
            keyExtractor={item => item._id}
            contentContainerStyle={styles.tabContent}
            ListEmptyComponent={<Text style={styles.emptyText}>No {matchSubTab.toLowerCase()} matches found.</Text>}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />}
            renderItem={({ item }) => {
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
              const firstId = String(firstTeam?._id || firstTeam || '').trim();
              const secondId = String(secondTeam?._id || secondTeam || '').trim();

              const isFirstWinner = isCompleted && !!winnerId && winnerId === firstId;
              const isSecondWinner = isCompleted && !!winnerId && winnerId === secondId;

              const accentColor = isLive ? colors.error : isCompleted ? colors.primary : colors.border;
              return (
                <TouchableOpacity style={[styles.cardContainer, { borderLeftColor: accentColor }]} activeOpacity={0.85} onPress={() => navigation.navigate('MatchSummary', { matchId: item._id })}>
                  <View style={styles.cardHeader}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      {item.stage ? <Text style={styles.stagePill}>{item.stage}</Text> : null}
                      <Text style={styles.cardSubText} numberOfLines={1}>
                        {item.format?.toUpperCase() || 'Custom'}  •  {moment(item.createdAt).format('DD MMM, hh:mm A')}  •  {item.overs} Ov
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      {isLive ? (
                        <View style={styles.liveBadge}>
                          <View style={styles.liveDot} />
                          <Text style={styles.liveBadgeText}>LIVE</Text>
                        </View>
                      ) : item.status === 'scheduled' ? (
                        <View style={styles.upcomingBadge}>
                          <Text style={styles.upcomingBadgeText}>UPCOMING</Text>
                        </View>
                      ) : (
                        <View style={styles.resultBadge}>
                          <Text style={styles.resultBadgeText}>RESULT</Text>
                        </View>
                      )}
                      <TouchableOpacity
                        style={{ marginLeft: 8, padding: 4 }}
                        onPress={() => setShareData({ type: 'fixture', data: item })}
                      >
                        <Icon name="share-2" size={16} color={colors.primary} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.vsContainer}>
                    <View style={styles.teamScoreRow}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                        {firstTeam?.logo ? (
                          <Image
                            source={{ uri: getImageUrl(firstTeam.logo) }}
                            style={{ width: 22, height: 22, borderRadius: 11, marginRight: 8 }}
                            resizeMode="cover"
                          />
                        ) : (
                          <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
                            <Text style={{ color: colors.textSecondary, fontSize: 10, fontFamily: Typography.fontFamily.bold }}>
                              {firstTeam?.name?.charAt(0).toUpperCase() || 'T'}
                            </Text>
                          </View>
                        )}
                        <Text style={[styles.teamNameText, isFirstWinner && { fontFamily: Typography.fontFamily.bold, color: isDark ? colors.primary : '#B37B00' }, !isFirstWinner && isCompleted && { color: colors.textSecondary, opacity: 0.75 }]} numberOfLines={1}>{firstTeam?.name || 'TBD'}</Text>
                        {isFirstWinner && (
                          <View style={{ backgroundColor: isDark ? 'rgba(255,204,0,0.18)' : 'rgba(230,184,0,0.15)', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 8, flexDirection: 'row', alignItems: 'center', marginLeft: 6 }}>
                            <MCIcon name="trophy-variant" size={11} color={isDark ? colors.primary : '#B37B00'} />
                            <Text style={{ fontSize: 9, fontFamily: Typography.fontFamily.bold, color: isDark ? colors.primary : '#B37B00', marginLeft: 2 }}>W</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.scoreText, isFirstWinner && { color: isDark ? colors.primary : '#B37B00', fontFamily: Typography.fontFamily.bold }]}>
                        {firstScore?.runs || 0}/{firstScore?.wickets || 0} <Text style={styles.overText}>({firstScore?.overs || '0.0'})</Text>
                      </Text>
                    </View>
                    <View style={styles.vsDivider} />
                    <View style={styles.teamScoreRow}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                        {secondTeam?.logo ? (
                          <Image
                            source={{ uri: getImageUrl(secondTeam.logo) }}
                            style={{ width: 22, height: 22, borderRadius: 11, marginRight: 8 }}
                            resizeMode="cover"
                          />
                        ) : (
                          <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
                            <Text style={{ color: colors.textSecondary, fontSize: 10, fontFamily: Typography.fontFamily.bold }}>
                              {secondTeam?.name?.charAt(0).toUpperCase() || 'T'}
                            </Text>
                          </View>
                        )}
                        <Text style={[styles.teamNameText, isSecondWinner && { fontFamily: Typography.fontFamily.bold, color: isDark ? colors.primary : '#B37B00' }, !isSecondWinner && isCompleted && { color: colors.textSecondary, opacity: 0.75 }]} numberOfLines={1}>{secondTeam?.name || 'TBD'}</Text>
                        {isSecondWinner && (
                          <View style={{ backgroundColor: isDark ? 'rgba(255,204,0,0.18)' : 'rgba(230,184,0,0.15)', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 8, flexDirection: 'row', alignItems: 'center', marginLeft: 6 }}>
                            <MCIcon name="trophy-variant" size={11} color={isDark ? colors.primary : '#B37B00'} />
                            <Text style={{ fontSize: 9, fontFamily: Typography.fontFamily.bold, color: isDark ? colors.primary : '#B37B00', marginLeft: 2 }}>W</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.scoreText, isSecondWinner && { color: isDark ? colors.primary : '#B37B00', fontFamily: Typography.fontFamily.bold }]}>
                        {secondScore?.runs || 0}/{secondScore?.wickets || 0} <Text style={styles.overText}>({secondScore?.overs || '0.0'})</Text>
                      </Text>
                    </View>
                  </View>

                  {(item.result?.summary || (item.toss?.winner && item.status !== 'scheduled')) ? (
                    <View style={styles.matchResultFooter}>
                      <Icon name={isCompleted ? 'award' : 'info'} size={12} color={colors.primary} />
                      <Text style={styles.matchResultText} numberOfLines={1}>
                        {item.result?.summary || `${item.toss?.winner?.name || ''} won toss, elected to ${item.toss?.choice}`}
                      </Text>
                    </View>
                  ) : item.status === 'scheduled' ? (
                    <View style={styles.matchResultFooter}>
                      <Icon name="clock" size={12} color={colors.textTertiary} />
                      <Text style={[styles.matchResultText, { color: colors.textTertiary }]}>
                        {moment(item.scheduledAt || item.createdAt).format('ddd, DD MMM YYYY [at] hh:mm A')}
                      </Text>
                    </View>
                  ) : null}

                  {/* Start Match button — only for organizer / scorers, on scheduled matches, and tournament not completed */}
                  {/* {(() => {
                  const getScorerId = (match) => {
                    if (match.activeScorerId) return match.activeScorerId._id || match.activeScorerId;
                    if (match.creator) return match.creator._id || match.creator;
                    if (match.organizerId) return match.organizerId._id || match.organizerId;
                    return tournament?.organizer?._id || tournament?.organizer;
                  };
                  const authorizedScorerId = getScorerId(item);
                  const isAuthorizedScorer = authorizedScorerId && String(authorizedScorerId) === String(user?._id);
                  
                  return item.status === 'scheduled' && isAuthorizedScorer && !isTournamentCompleted && (
                    <TouchableOpacity
                      style={{
                        marginTop: 10,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: colors.primary,
                        borderRadius: BorderRadius.lg,
                        paddingVertical: 9,
                      }}
                      onPress={() => navigation.navigate('MatchSetup', {
                        matchId: item._id,
                        matchData: item,
                        tournamentId: tournament._id,
                        tournamentDetails: tournament,
                        stage: item.stage,
                      })}
                    >
                      <MCIcon name="play-circle" size={16} color={colors.background} style={{ marginRight: 6 }} />
                      <Text style={{ color: colors.background, fontFamily: Typography.fontFamily.bold, fontSize: 13 }}>
                        Start Match
                      </Text>
                    </TouchableOpacity>
                  );
                })()} */}
                </TouchableOpacity>
              );
            }}
          />
        )}
      </View>
    );
  };

  const renderPointsTable = () => {
    const pointsTable = tournament.pointsTable || [];

    if (pointsTable.length === 0) {
      return (
        <KeyboardAwareScrollView enableOnAndroid={true} extraScrollHeight={20} keyboardShouldPersistTaps="handled" style={styles.tabContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />}>
          <View style={styles.emptyContainer}>
            <Icon name="users" size={48} color={colors.textTertiary} style={{ marginBottom: 12 }} />
            <Text style={styles.emptyText}>No teams registered yet</Text>
          </View>
        </KeyboardAwareScrollView>
      );
    }

    const hasGroups = pointsTable.some(row => row.groupName);

    const toggleGroupCollapse = (groupName) => {
      setCollapsedGroups(prev => ({
        ...prev,
        [groupName]: !prev[groupName]
      }));
    };

    return (
      <KeyboardAwareScrollView enableOnAndroid={true} extraScrollHeight={20} keyboardShouldPersistTaps="handled" style={styles.tabContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />}>
        {pointsTable.length > 0 && (
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16, paddingHorizontal: Spacing.md }}>
            <TouchableOpacity
              style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: isDark ? colors.primaryAlpha10 : colors.surfaceVariant, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: colors.border }}
              onPress={() => navigation.navigate("QualificationCalculator", {
                tournamentId,
                pointsTable: tournament.pointsTable,
                tournamentOvers: tournament.overs,
              })}
            >
              <Icon name="activity" size={14} color={isDark ? colors.primary : colors.primaryDark} style={{ marginRight: 6 }} />
              <Text style={{ color: isDark ? colors.primary : colors.textPrimary, fontFamily: Typography.fontFamily.bold, fontSize: 12 }}>NRR Calculator</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: isDark ? colors.primaryAlpha10 : colors.surfaceVariant, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: colors.border }}
              onPress={() => setShareData({ type: "pointsTable", data: { table: tournament.pointsTable } })}
            >
              <Icon name="share-2" size={14} color={isDark ? colors.primary : colors.primaryDark} style={{ marginRight: 6 }} />
              <Text style={{ color: isDark ? colors.primary : colors.textPrimary, fontFamily: Typography.fontFamily.bold, fontSize: 12 }}>Share Standings</Text>
            </TouchableOpacity>
          </View>
        )}

        {hasGroups ? (
          (() => {
            const grouped = pointsTable.reduce((acc, row) => {
              const g = row.groupName || 'Other';
              if (!acc[g]) acc[g] = [];
              acc[g].push(row);
              return acc;
            }, {});

            return Object.entries(grouped).map(([groupName, rows], gIdx) => {
              const isCollapsed = !!collapsedGroups[groupName];
              return (
                <View key={gIdx} style={styles.cleanTableContainer}>
                  <TouchableOpacity
                    style={styles.groupHeaderRow}
                    activeOpacity={0.8}
                    onPress={() => toggleGroupCollapse(groupName)}
                  >
                    <Text style={styles.groupHeaderTitle}>{groupName}</Text>
                    <Icon
                      name={isCollapsed ? 'chevron-down' : 'chevron-up'}
                      size={18}
                      color={colors.textSecondary}
                    />
                  </TouchableOpacity>

                  {!isCollapsed && (
                    <View style={styles.cleanTable}>
                      <View style={styles.cleanTableHeader}>
                        <Text style={[styles.tableCell, { flex: 2, textAlign: 'left', paddingLeft: 8 }]}>Team</Text>
                        <Text style={styles.tableCell}>P</Text>
                        <Text style={styles.tableCell}>W</Text>
                        <Text style={styles.tableCell}>L</Text>
                        <Text style={styles.tableCell}>NR</Text>
                        <Text style={styles.tableCell}>Pts</Text>
                        <Text style={styles.tableCell}>NRR</Text>
                      </View>
                      {rows.map((row, idx) => {
                        const scenario = tournament.qualificationScenarios?.[row.team?._id];
                        return (
                          <TouchableOpacity
                            key={idx}
                            style={styles.cleanTableRow}
                            onPress={() => {
                              if (scenario) {
                                setSelectedScenario({ ...scenario, teamName: row.team?.name });
                                setShowScenarioModal(true);
                              }
                            }}
                            activeOpacity={scenario ? 0.7 : 1}
                          >
                            <View style={[styles.tableCellFlex2, { flexDirection: 'row', alignItems: 'center', paddingLeft: 8 }]}>
                              <Text style={[styles.tableCell, { flex: 1, textAlign: 'left' }]} numberOfLines={1}>
                                {row.team?.name}
                                {row.qualified || scenario?.statusCode === 'Q' ? ' ✓' : ''}
                                {row.eliminated || scenario?.statusCode === 'E' ? ' ✗' : ''}
                              </Text>
                              {scenario && scenario.statusCode !== 'Q' && scenario.statusCode !== 'E' && (
                                <View style={{ backgroundColor: scenario.color, paddingHorizontal: 4, paddingVertical: 2, borderRadius: 4, marginLeft: 4 }}>
                                  <Text style={{ color: '#fff', fontSize: 8, fontFamily: Typography.fontFamily.bold }}>{scenario.statusCode}</Text>
                                </View>
                              )}
                            </View>
                            <Text style={styles.tableCell}>{row.played}</Text>
                            <Text style={styles.tableCell}>{row.won}</Text>
                            <Text style={styles.tableCell}>{row.lost}</Text>
                            <Text style={styles.tableCell}>{row.noResult}</Text>
                            <Text style={[styles.tableCell, { color: colors.primary, fontFamily: Typography.fontFamily.bold }]}>{row.points}</Text>
                            <Text style={[styles.tableCell, { color: row.netRunRate >= 0 ? colors.success : colors.error }]}>{row.netRunRate?.toFixed(2)}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            });
          })()
        ) : (
          <View style={styles.cleanTable}>
            <View style={styles.cleanTableHeader}>
              <Text style={[styles.tableCell, { flex: 2, textAlign: 'left', paddingLeft: 8 }]}>Team</Text>
              <Text style={styles.tableCell}>P</Text>
              <Text style={styles.tableCell}>W</Text>
              <Text style={styles.tableCell}>L</Text>
              <Text style={styles.tableCell}>NR</Text>
              <Text style={styles.tableCell}>Pts</Text>
              <Text style={styles.tableCell}>NRR</Text>
            </View>
            {pointsTable.map((row, idx) => {
              const scenario = tournament.qualificationScenarios?.[row.team?._id];
              return (
                <TouchableOpacity
                  key={idx}
                  style={styles.cleanTableRow}
                  onPress={() => {
                    if (scenario) {
                      setSelectedScenario({ ...scenario, teamName: row.team?.name });
                      setShowScenarioModal(true);
                    }
                  }}
                  activeOpacity={scenario ? 0.7 : 1}
                >
                  <View style={[styles.tableCellFlex2, { flexDirection: 'row', alignItems: 'center', paddingLeft: 8 }]}>
                    <Text style={[styles.tableCell, { flex: 1, textAlign: 'left' }]} numberOfLines={1}>
                      {row.team?.name}
                      {row.qualified || scenario?.statusCode === 'Q' ? ' ✓' : ''}
                      {row.eliminated || scenario?.statusCode === 'E' ? ' ✗' : ''}
                    </Text>
                    {scenario && scenario.statusCode !== 'Q' && scenario.statusCode !== 'E' && (
                      <View style={{ backgroundColor: scenario.color, paddingHorizontal: 4, paddingVertical: 2, borderRadius: 4, marginLeft: 4 }}>
                        <Text style={{ color: '#fff', fontSize: 8, fontFamily: Typography.fontFamily.bold }}>{scenario.statusCode}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.tableCell}>{row.played}</Text>
                  <Text style={styles.tableCell}>{row.won}</Text>
                  <Text style={styles.tableCell}>{row.lost}</Text>
                  <Text style={styles.tableCell}>{row.noResult}</Text>
                  <Text style={[styles.tableCell, { color: colors.primary, fontFamily: Typography.fontFamily.bold }]}>{row.points}</Text>
                  <Text style={[styles.tableCell, { color: row.netRunRate >= 0 ? colors.success : colors.error }]}>{row.netRunRate?.toFixed(2)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </KeyboardAwareScrollView>
    );
  };

  const renderPlaceholder = (tabName) => (
    <View style={styles.placeholderContainer}>
      <Icon name="clock" size={40} color={colors.textTertiary} />
      <Text style={styles.emptyText}>{tabName} Module coming soon.</Text>
    </View>
  );

  const renderAuction = () => {
    const isOrganizer = tournament?.organizer?._id === user?._id || tournament?.organizer === user?._id || tournament?.coOrganizers?.some(o => (o._id || o) === user?._id);
    const userTeam = tournament?.registeredTeams?.find(
      (rt) => rt.team?.owner === user?._id || rt.team?.captain?.userId === user?._id || rt.team?.captain === user?._id
    );
    const isTeamCaptainOrOwner = !!userTeam;

    const regEndDate = auctionDetails?.registrationEndDate;
    const auctionDate = auctionDetails?.auctionDate;
    const regEndPassed = regEndDate ? moment().isAfter(moment.utc(regEndDate).endOf('day')) : false;
    const isSameRegAndAuctionDate = regEndDate && auctionDate && moment.utc(regEndDate).isSame(moment.utc(auctionDate), 'day');
    const isTodayOrAfterAuctionDate = auctionDate && (moment().isSame(moment.utc(auctionDate), 'day') || moment().isAfter(moment.utc(auctionDate), 'day'));
    const canCreateSets = regEndPassed || (isSameRegAndAuctionDate && isTodayOrAfterAuctionDate);
    const auctionDateReached = !auctionDate || moment().isSameOrAfter(moment.utc(auctionDate).startOf('day'));

    const formatDate = (d) => d ? moment.utc(d).format('ddd, D MMM YYYY') : 'Not set';
    const formatCountdown = (d) => {
      if (!d) return null;
      const diff = moment(d).diff(moment());
      if (diff <= 0) return null;
      const dur = moment.duration(diff);
      const days = Math.floor(dur.asDays());
      return days > 0 ? `${days}d ${dur.hours()}h away` : `${dur.hours()}h ${dur.minutes()}m away`;
    };

    const auctionCountdown = auctionDate ? formatCountdown(auctionDate) : null;
    const regCountdown = regEndDate ? formatCountdown(regEndDate) : null;

    return (
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await fetchDashboard();
              if (activeTab === 'Auction' && tournamentId) {
                const res = await auctionService.getAuctionDetails(tournamentId);
                if (res.data?.exists) setAuctionDetails(res.data);
              }
              setRefreshing(false);
            }}
            tintColor={colors.primary}
          />
        }
      >
        {/* Hero Header */}
        <View style={auctionStyles.heroCard}>
          <View style={auctionStyles.heroIconRow}>
            <View style={auctionStyles.heroIconBg}>
              <MCIcon name="gavel" size={28} color={colors.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={auctionStyles.heroTitle}>{tournament.name}</Text>
              <Text style={auctionStyles.heroSubtitle}>
                {isOrganizer
                  ? 'Organiser Control Hub'
                  : isTeamCaptainOrOwner
                    ? `Team Captain / Owner`
                    : 'Player & Spectator Hub'}
              </Text>
            </View>
            <View style={[
              auctionStyles.statusBadge,
              { backgroundColor: auctionDetails?.status === 'completed' ? 'rgba(74,222,128,0.15)' : auctionDateReached ? 'rgba(234,179,8,0.15)' : 'rgba(99,102,241,0.15)' }
            ]}>
              <Text style={[
                auctionStyles.statusBadgeText,
                { color: auctionDetails?.status === 'completed' ? '#4ADE80' : auctionDateReached ? colors.warning : '#818CF8' }
              ]}>
                {auctionDetails?.status === 'completed' ? '✓ COMPLETED' : auctionDateReached ? '🔴 LIVE READY' : '⏳ UPCOMING'}
              </Text>
            </View>
          </View>
        </View>

        {/* Live Broadcast / Replay / Start Telecast section removed */}

        {/* Date Info Cards */}
        <View style={auctionStyles.dateRow}>
          <View style={auctionStyles.dateCard}>
            <MCIcon name="calendar-clock" size={18} color={regEndPassed ? '#4ADE80' : colors.warning} />
            <Text style={auctionStyles.dateLabel}>Reg. Closes</Text>
            <Text style={auctionStyles.dateValue}>{formatDate(regEndDate)}</Text>
            {regCountdown && <Text style={auctionStyles.dateSub}>{regCountdown}</Text>}
            {regEndPassed && <Text style={[auctionStyles.dateSub, { color: '#4ADE80' }]}>✓ Closed</Text>}
          </View>
          <View style={auctionStyles.dateCard}>
            <MCIcon name="gavel" size={18} color={auctionDateReached ? colors.warning : colors.primary} />
            <Text style={auctionStyles.dateLabel}>Auction Day</Text>
            <Text style={auctionStyles.dateValue}>{formatDate(auctionDate)}</Text>
            {auctionCountdown && <Text style={auctionStyles.dateSub}>{auctionCountdown}</Text>}
            {!auctionCountdown && auctionDateReached && auctionDate && (
              <Text style={[auctionStyles.dateSub, { color: auctionDetails?.status === 'completed' ? '#4ADE80' : colors.warning }]}>
                {auctionDetails?.status === 'completed' ? '✓ Completed' : (moment.utc(auctionDate).isSame(moment.utc(), 'day') ? 'Today!' : 'Not Started Yet')}
              </Text>
            )}
          </View>
        </View>

        {/* Organiser Section */}
        {isOrganizer && auctionDetails?.status !== 'completed' && (
          <View style={auctionStyles.sectionCard}>
            <Text style={auctionStyles.sectionTitle}>Organiser Controls</Text>

            <TouchableOpacity
              style={auctionStyles.actionRow}
              onPress={() => navigation.navigate('AuctionCreateSets', { tournamentId: tournament._id, mode: 'registrations' })}
            >
              <View style={[auctionStyles.actionIcon, { backgroundColor: 'rgba(99,102,241,0.15)' }]}>
                <MCIcon name="account-group" size={20} color="#818CF8" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={auctionStyles.actionTitle}>Manage Registrations</Text>
                <Text style={auctionStyles.actionSub}>View players & check finances</Text>
              </View>
              <MCIcon name="chevron-right" size={22} color={colors.textTertiary} />
            </TouchableOpacity>

            <View style={auctionStyles.divider} />

            <TouchableOpacity
              style={[
                auctionStyles.actionRow,
                !canCreateSets && { opacity: 0.55 }
              ]}
              onPress={() => {
                if (!canCreateSets) {
                  showCustomAlert('Not Available', 'Registration is still open. Create Sets will be available once the registration date has passed.');
                } else {
                  navigation.navigate('AuctionCreateSets', { tournamentId: tournament._id, mode: 'sets' });
                }
              }}
            >
              <View style={[auctionStyles.actionIcon, { backgroundColor: canCreateSets ? 'rgba(74,222,128,0.12)' : 'rgba(255,255,255,0.05)' }]}>
                <MCIcon name="cards-outline" size={20} color={canCreateSets ? '#4ADE80' : colors.textTertiary} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={auctionStyles.actionTitle}>Create & Manage Sets</Text>
                <Text style={auctionStyles.actionSub}>
                  {canCreateSets ? 'Split players into auction sets' : 'Available after registration closes'}
                </Text>
              </View>
              {canCreateSets
                ? <MCIcon name="chevron-right" size={22} color={colors.textTertiary} />
                : <MCIcon name="lock-outline" size={18} color={colors.textTertiary} />}
            </TouchableOpacity>

            {auctionDateReached && (
              <>
                <View style={auctionStyles.divider} />
                <TouchableOpacity
                  style={[auctionStyles.actionRow, !auctionDetails?.hasSets && { opacity: 0.55 }]}
                  onPress={() => {
                    if (!auctionDetails?.hasSets) {
                      showCustomAlert('Cannot Launch', 'Please create auction sets first before launching the live auction.');
                    } else {
                      navigation.navigate('AuctionLiveOrganiser', { auctionId: auctionDetails._id });
                    }
                  }}
                >
                  <View style={[auctionStyles.actionIcon, { backgroundColor: auctionDetails?.hasSets ? 'rgba(234,179,8,0.15)' : 'rgba(255,255,255,0.05)' }]}>
                    <MCIcon name="broadcast" size={20} color={auctionDetails?.hasSets ? colors.warning : colors.textTertiary} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[auctionStyles.actionTitle, { color: auctionDetails?.hasSets ? colors.warning : colors.textPrimary }]}>
                      {auctionDetails?.status === 'in_progress' ? 'Resume / Close Live Auction' : 'Launch Live Auction'}
                    </Text>
                    <Text style={auctionStyles.actionSub}>
                      {auctionDetails?.hasSets
                        ? (auctionDetails?.status === 'in_progress' ? 'Enter dashboard to resume or close auction' : 'Start bidding session now')
                        : 'Create sets first'}
                    </Text>
                  </View>
                  {auctionDetails?.hasSets ? (
                    <MCIcon name="chevron-right" size={22} color={colors.warning} />
                  ) : (
                    <MCIcon name="lock-outline" size={18} color={colors.textTertiary} />
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {isOrganizer && auctionDetails?.status === 'completed' && (
          <View style={auctionStyles.sectionCard}>
            <Text style={auctionStyles.sectionTitle}>Organiser (Auction Closed)</Text>
            <TouchableOpacity
              style={auctionStyles.actionRow}
              onPress={() => navigation.navigate('AuctionCreateSets', { tournamentId: tournament._id, mode: 'registrations', isReadOnly: true, showFinanceForOrganizer: isOrganizer })}
            >
              <View style={[auctionStyles.actionIcon, { backgroundColor: 'rgba(56,189,248,0.12)' }]}>
                <MCIcon name="format-list-bulleted" size={20} color="#38BDF8" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={auctionStyles.actionTitle}>View Auctioned Players</Text>
                <Text style={auctionStyles.actionSub}>List of users and finance (Read-only)</Text>
              </View>
              <MCIcon name="chevron-right" size={22} color={colors.textTertiary} />
            </TouchableOpacity>
          </View>
        )}

        {/* Team Owner Section */}
        {isTeamCaptainOrOwner && (
          <View style={auctionStyles.sectionCard}>
            <Text style={auctionStyles.sectionTitle}>Team Owner</Text>

            {auctionDetails?.status === 'completed' && ownerData ? (
              <View style={{ marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, backgroundColor: 'rgba(255,255,255,0.02)', padding: 12, borderRadius: 8 }}>
                  <View>
                    <Text style={{ color: colors.textTertiary, fontSize: 12 }}>Purse Left</Text>
                    <Text style={{ color: colors.warning, fontSize: 16, fontFamily: Typography.fontFamily.bold }}>{ownerData.purseAvailable || 0}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ color: colors.textTertiary, fontSize: 12 }}>Squad Size</Text>
                    <Text style={{ color: colors.textPrimary, fontSize: 16, fontFamily: Typography.fontFamily.bold }}>{ownerData.squad?.length || 0}</Text>
                  </View>
                </View>
                <Text style={{ color: colors.textPrimary, fontFamily: Typography.fontFamily.semiBold, marginBottom: 8 }}>Squad Contact List</Text>
                {ownerData.squad?.length > 0 ? ownerData.squad.map((p, idx) => (
                  <View key={p.playerId || idx} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.textPrimary, fontSize: 14 }}>{p.fullName}</Text>
                      <Text style={{ color: colors.textTertiary, fontSize: 12 }}>{p.role || 'Player'} • {p.soldPrice} pts</Text>
                    </View>
                    <Text style={{ color: colors.primary, fontSize: 13 }} onPress={() => { if (p.mobile) Linking.openURL(`tel:${p.mobile}`) }}>{p.mobile || 'No contact'}</Text>
                  </View>
                )) : <Text style={{ color: colors.textTertiary, fontSize: 13 }}>No players bought yet.</Text>}

                <TouchableOpacity
                  style={[auctionStyles.actionRow, { marginTop: 16 }]}
                  onPress={() => navigation.navigate('AuctionLiveTeamOwner', { tournamentId: tournament._id, auctionId: auctionDetails._id })}
                >
                  <View style={[auctionStyles.actionIcon, { backgroundColor: 'rgba(234,179,8,0.12)' }]}>
                    <MCIcon name="shield-crown" size={20} color={colors.warning} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={auctionStyles.actionTitle}>Full Team Dashboard</Text>
                    <Text style={auctionStyles.actionSub}>View bids & deep stats</Text>
                  </View>
                  <MCIcon name="chevron-right" size={22} color={colors.textTertiary} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={auctionStyles.actionRow}
                onPress={() => {
                  if (!auctionDetails?._id) {
                    showCustomAlert('Error', 'Auction details not found.');
                    return;
                  }
                  navigation.navigate('AuctionLiveTeamOwner', { tournamentId: tournament._id, auctionId: auctionDetails._id });
                }}
              >
                <View style={[auctionStyles.actionIcon, { backgroundColor: 'rgba(234,179,8,0.12)' }]}>
                  <MCIcon name="shield-crown" size={20} color={colors.warning} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={auctionStyles.actionTitle}>My Team Dashboard</Text>
                  <Text style={auctionStyles.actionSub}>View bids, purse & squad</Text>
                </View>
                <MCIcon name="chevron-right" size={22} color={colors.textTertiary} />
              </TouchableOpacity>
            )}

            <View style={auctionStyles.divider} />

            <TouchableOpacity
              style={auctionStyles.actionRow}
              onPress={() => navigation.navigate('AuctionCreateSets', { tournamentId: tournament._id, mode: 'registrations', isReadOnly: true })}
            >
              <View style={[auctionStyles.actionIcon, { backgroundColor: 'rgba(56,189,248,0.12)' }]}>
                <MCIcon name="format-list-bulleted" size={20} color="#38BDF8" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={auctionStyles.actionTitle}>Browse Players & Sets</Text>
                <Text style={auctionStyles.actionSub}>View all registered users and auction sets</Text>
              </View>
              <MCIcon name="chevron-right" size={22} color={colors.textTertiary} />
            </TouchableOpacity>
          </View>
        )}

        {/* Viewer / Player Section */}
        {!(isOrganizer && auctionDetails?.status === 'completed') && (
          <View style={auctionStyles.sectionCard}>
            <Text style={auctionStyles.sectionTitle}>{auctionDetails?.status === 'completed' ? 'Auction Status' : 'Player'}</Text>

            {auctionDetails?.status === 'completed' && myRegistrationData ? (
              <View style={{ marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, backgroundColor: 'rgba(255,255,255,0.03)', padding: 16, borderRadius: 8, borderWidth: 1, borderColor: myRegistrationData.soldStatus === 'sold' ? 'rgba(74,222,128,0.3)' : 'rgba(239,68,68,0.3)' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.textTertiary, fontSize: 13 }}>Auction Result</Text>
                    <Text style={{
                      color: myRegistrationData.soldStatus === 'sold' ? '#4ADE80' : (myRegistrationData.soldStatus === 'unsold' ? '#EF4444' : colors.textPrimary),
                      fontSize: 20,
                      fontFamily: Typography.fontFamily.bold,
                      marginTop: 4
                    }}>
                      {myRegistrationData.soldStatus === 'sold' ? 'SOLD' : (myRegistrationData.soldStatus === 'unsold' ? 'UNSOLD' : 'UNSOLD')}
                    </Text>
                  </View>
                  {myRegistrationData.soldStatus === 'sold' && (
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ color: colors.textTertiary, fontSize: 13 }}>Sold to</Text>
                      <Text style={{ color: colors.white, fontSize: 16, fontFamily: Typography.fontFamily.semiBold, marginTop: 4 }}>{myRegistrationData.soldToTeam?.name || 'A Team'}</Text>
                      <Text style={{ color: colors.warning, fontSize: 14, marginTop: 2 }}>{myRegistrationData.soldPrice} points</Text>
                    </View>
                  )}
                </View>
              </View>
            ) : null}

            {auctionDetails?.status === 'completed' ? (
              <View style={auctionStyles.actionRow}>
                <View style={[auctionStyles.actionIcon, { backgroundColor: 'rgba(74,222,128,0.12)' }]}>
                  <MCIcon name="check-decagram" size={20} color="#4ADE80" />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={auctionStyles.actionTitle}>Auction is Over</Text>
                  <Text style={auctionStyles.actionSub}>The bidding process has concluded.</Text>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                style={auctionStyles.actionRow}
                onPress={() => navigation.navigate('AuctionRegistration', { tournamentId: tournament._id })}
              >
                <View style={[
                  auctionStyles.actionIcon,
                  { backgroundColor: isAuctionRegistered ? 'rgba(74,222,128,0.12)' : (!isAuctionRegistered && regEndPassed ? 'rgba(239,68,68,0.12)' : 'rgba(99,102,241,0.12)') }
                ]}>
                  <MCIcon
                    name={isAuctionRegistered ? 'check-circle' : (!isAuctionRegistered && regEndPassed ? 'lock' : 'account-plus')}
                    size={20}
                    color={isAuctionRegistered ? '#4ADE80' : (!isAuctionRegistered && regEndPassed ? '#EF4444' : '#818CF8')}
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={auctionStyles.actionTitle}>
                    {isAuctionRegistered ? 'You Are Registered' : (regEndPassed ? 'Registration Closed' : 'Register for Auction')}
                  </Text>
                  <Text style={auctionStyles.actionSub}>
                    {isAuctionRegistered ? 'Tap to view your registration' : (regEndPassed ? 'Registration ended. Tap for details.' : 'Join the player pool')}
                  </Text>
                </View>
                <MCIcon name="chevron-right" size={22} color={colors.textTertiary} />
              </TouchableOpacity>
            )}

            {!isOrganizer && auctionDateReached && (
              <>
                <View style={auctionStyles.divider} />
                <TouchableOpacity
                  style={auctionStyles.actionRow}
                  onPress={() => navigation.navigate('AuctionLivePublic', { auctionId: auctionDetails?._id })}
                >
                  <View style={[auctionStyles.actionIcon, { backgroundColor: 'rgba(234,179,8,0.1)' }]}>
                    <MCIcon name="eye" size={20} color={colors.warning} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={auctionStyles.actionTitle}>Watch Live Auction</Text>
                    <Text style={auctionStyles.actionSub}>View bids in real-time</Text>
                  </View>
                  <MCIcon name="chevron-right" size={22} color={colors.textTertiary} />
                </TouchableOpacity>
              </>
            )}

            <View style={auctionStyles.divider} />
            <TouchableOpacity
              style={auctionStyles.actionRow}
              onPress={() => {
                setShareData({ type: 'registration', data: tournament });
              }}
            >
              <View style={[auctionStyles.actionIcon, { backgroundColor: 'rgba(56,189,248,0.12)' }]}>
                <MCIcon name="share-variant" size={20} color="#38BDF8" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={auctionStyles.actionTitle}>Share Registration Link</Text>
                <Text style={auctionStyles.actionSub}>Invite players to register</Text>
              </View>
              <MCIcon name="chevron-right" size={22} color={colors.textTertiary} />
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    );
  };

  const hasTournamentStarted = isOrganizer || (tournament?.matches && tournament.matches.length > 0) || (tournament?.startDate ? new Date() >= new Date(tournament.startDate) : true);

  const renderLockedModule = (tabName) => (
    <View style={[styles.placeholderContainer, { paddingHorizontal: 20 }]}>
      <Animated.View style={{
        width: 80, height: 80, borderRadius: 40,
        backgroundColor: colors.primaryAlpha10,
        justifyContent: 'center', alignItems: 'center',
        marginBottom: 24,
        transform: [{ scale: lockAnim }]
      }}>
        <MCIcon name="lock" size={36} color={colors.primary} />
      </Animated.View>
      <Text style={{ fontSize: 22, fontFamily: Typography.fontFamily.bold, color: colors.primary, marginBottom: 12, textAlign: 'center' }}>
        {tabName} Locked
      </Text>
      <Text style={[styles.emptyText, { color: colors.textSecondary, fontSize: 15, textAlign: 'center', lineHeight: 22 }]}>
        This section will unlock once the tournament starts on <Text style={{ color: colors.primary, fontFamily: Typography.fontFamily.semiBold }}>{tournament?.startDate ? moment.utc(tournament.startDate).format('DD MMM YYYY') : 'the start date'}</Text>.
      </Text>
    </View>
  );

  const renderActiveTabContent = () => {
    switch (activeTab) {
      case 'Overview': return renderOverview();
      case 'Teams': return renderTeams();
      case 'Auction': return renderAuction();
      case 'Matches': return renderMatches();
      case 'Points Table': return renderPointsTable();
      case 'Leaderboard': return <TournamentLeaderboard tournament={tournament} onShare={setShareData} />;
      case 'Statistics': return <TournamentStatistics tournament={tournament} />;
      default: return renderPlaceholder(activeTab);
    }
  };

  const isFollowing = tournament.followers?.includes(user?._id);

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.primaryDark} />
      {/* Modern Header: Yellow Gradient with Logo + Title */}
      <LinearGradient
        colors={colors.primaryGradient || ['#FFCC00', '#E6B800']}
        style={styles.bannerWrapper}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      >
        <View style={styles.headerTopBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Icon name="arrow-left" size={20} color="#ffffff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
          <TouchableOpacity onPress={() => navigation.navigate('CreateTicketScreen', { tournamentId: tournament._id, category: 'Tournament Dispute' })} style={styles.menuBtn}>
            <MCIcon name="alert-circle-outline" size={20} color="#ffffff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleShareTournament} style={styles.menuBtn}>
            <Icon name="share-2" size={20} color="#ffffff" />
          </TouchableOpacity>
          {isOrganizer && (
            <TouchableOpacity onPress={() => setShowSettingsSidebar(true)} style={styles.menuBtn}>
              <Icon name="more-vertical" size={20} color="#ffffff" />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.headerInfoContentContainer}>
          <View style={styles.logoAndTitleRow}>
            <Image
              source={{ uri: tournament.banner ? getImageUrl(tournament.banner) : 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=600&auto=format&fit=crop' }}
              style={styles.headerLogo}
              resizeMode="cover"
            />
            <View style={styles.headerTitleContainer}>
              <Text style={styles.headerTitle} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.8}>{tournament.name}</Text>

              {/* Badge row */}
              <View style={styles.headerBadgeRow}>
                <View style={styles.statusBadge}>
                  <View style={[styles.statusDot, {
                    backgroundColor: tournament.status === 'ongoing' ? colors.error
                      : (tournament.status === 'upcoming' || tournament.status === 'draft') ? colors.warning
                        : tournament.status === 'completed' ? colors.success
                          : colors.primary
                  }]} />
                  <Text style={styles.statusLabel}>
                    {tournament.status === 'ongoing' ? 'Live'
                      : (tournament.status === 'upcoming' || tournament.status === 'draft') ? 'Upcoming'
                        : tournament.status === 'completed' ? 'Completed'
                          : tournament.status}
                  </Text>
                </View>
                {isOrganizer ? (
                  <View style={styles.organizerChip}>
                    <Icon name="shield" size={11} color={isDark ? "#ffffff" : "#000000"} />
                    <Text style={styles.organizerChipText}>Organizer</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    onPress={handleFollowTournament}
                    style={[styles.fullWidthFollowBtn, isFollowing && styles.fullWidthFollowBtnActive, { marginTop: 0, paddingVertical: 5, paddingHorizontal: 12 }]}
                  >
                    <Icon name={isFollowing ? "check" : "user-plus"} size={11} color="#ffffff" />
                    <Text style={[styles.fullWidthFollowText, { fontSize: 11 }]}>
                      {isFollowing ? 'Following' : 'Follow'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </View>
      </LinearGradient>

      {/* Underline-style tabs */}
      <View style={styles.tabsWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScroll}>
          {(() => {
            const isOrganizer = tournament?.organizer?._id === user?._id || tournament?.organizer === user?._id || tournament?.coOrganizers?.some(o => (o._id || o) === user?._id);
            const userTeam = tournament?.teams?.find(
              (t) => t.captain === user?._id || t.owner === user?._id
            );
            const isTeamOwnerOrCaptain = !!userTeam;

            // Hide Auction tab once matches have been played (tournament started)
            // But KEEP IT VISIBLE for Auction tournaments always.
            const hasMatchesPlayed = (tournament?.matches || []).some(m =>
              ['in_progress', 'toss_done', 'innings_break', 'super_over', 'completed', 'abandoned'].includes(m.status)
            );
            const isAuctionTournament = tournament?.tournamentType === 'Auction';

            let visibleTabs = TABS.filter(tab => {
              if (tab === 'Auction') {
                return isAuctionTournament; // Always show Auction tab for Auction tournaments
              }
              return true;
            });

            const auctionDate = tournament?.auctionDate || tournament?.auctionDetails?.auctionDate;
            const auctionDateReached = auctionDate && new Date() >= new Date(auctionDate);

            return visibleTabs.map((tab) => (
              <TouchableOpacity
                key={tab}
                style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
                onPress={() => setActiveTab(tab)}
              >
                <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
              </TouchableOpacity>
            ));
          })()}
        </ScrollView>
      </View>

      <View style={{ flex: 1 }}>
        {renderActiveTabContent()}
      </View>

      {/* Sticky Footer Removed as per user request */}

      {/* Scenario Calculator Modal */}
      <Modal visible={showScenarioCalculator} animationType="slide" transparent={true} onRequestClose={() => setShowScenarioCalculator(false)}>
        <View style={styles.modalBg}>
          <KeyboardAwareScrollView contentContainerStyle={styles.modalContainer} style={{ flex: 1, width: '100%' }}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>NRR Scenario Calculator</Text>
              <TouchableOpacity onPress={() => setShowScenarioCalculator(false)}>
                <Icon name="x" size={24} color={colors.white} />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Select Your Team</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 15 }}>
              {tournament?.pointsTable?.map(pt => (
                <TouchableOpacity
                  key={pt.team._id}
                  style={[styles.scenarioTeamBtn, scenarioData.teamId === pt.team._id && styles.scenarioTeamBtnActive]}
                  onPress={() => setScenarioData({ ...scenarioData, teamId: pt.team._id })}
                >
                  <Text style={[styles.scenarioTeamBtnText, scenarioData.teamId === pt.team._id && styles.scenarioTeamBtnTextActive]}>{pt.team.shortName || pt.team.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.label}>Select Opponent Team</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 15 }}>
              {tournament?.pointsTable?.filter(pt => pt.team._id !== scenarioData.teamId).map(pt => (
                <TouchableOpacity
                  key={pt.team._id}
                  style={[styles.scenarioTeamBtn, scenarioData.opponentId === pt.team._id && styles.scenarioTeamBtnActive]}
                  onPress={() => setScenarioData({ ...scenarioData, opponentId: pt.team._id })}
                >
                  <Text style={[styles.scenarioTeamBtnText, scenarioData.opponentId === pt.team._id && styles.scenarioTeamBtnTextActive]}>{pt.team.shortName || pt.team.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.label}>Toss Choice</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 15 }}>
              <TouchableOpacity style={[styles.choiceBtn, scenarioData.battingFirst && styles.choiceBtnActive]} onPress={() => setScenarioData({ ...scenarioData, battingFirst: true })}>
                <Text style={[styles.choiceBtnText, scenarioData.battingFirst && styles.choiceBtnTextActive]}>Bat First</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.choiceBtn, !scenarioData.battingFirst && styles.choiceBtnActive]} onPress={() => setScenarioData({ ...scenarioData, battingFirst: false })}>
                <Text style={[styles.choiceBtnText, !scenarioData.battingFirst && styles.choiceBtnTextActive]}>Bowl First</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>{scenarioData.battingFirst ? 'Projected Target (Your Score)' : 'Opponent First Innings Score'}</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 150"
              placeholderTextColor={colors.textTertiary}
              keyboardType="number-pad"
              value={scenarioData.firstInningsScore}
              onChangeText={val => setScenarioData({ ...scenarioData, firstInningsScore: val })}
            />

            <Text style={styles.label}>Target Rank</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 1 or 4"
              placeholderTextColor={colors.textTertiary}
              keyboardType="number-pad"
              value={scenarioData.targetRank}
              onChangeText={val => setScenarioData({ ...scenarioData, targetRank: val })}
            />

            <TouchableOpacity style={styles.actionBtn} onPress={handleCalculateScenario} disabled={scenarioLoading}>
              {scenarioLoading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.actionBtnText}>Calculate Margin</Text>}
            </TouchableOpacity>

            {scenarioResult && (
              <View style={[styles.scenarioResultCard, { backgroundColor: scenarioResult.possible ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)' }]}>
                <Text style={[styles.scenarioResultText, { color: scenarioResult.possible ? '#22c55e' : '#ef4444' }]}>
                  {scenarioResult.message}
                </Text>
              </View>
            )}
          </KeyboardAwareScrollView>
        </View>
      </Modal>

      {/* Fixture Wizard Modal */}
      <FixtureWizardModal
        visible={showWizardModal}
        onClose={() => setShowWizardModal(false)}
        tournament={tournament}
        onRefresh={fetchDashboard}
      />

      {/* Organizer Add Team Modal */}
      <AddTeamModal
        visible={showAddTeamModal}
        onClose={() => setShowAddTeamModal(false)}
        tournamentId={tournament._id}
        onRefresh={fetchDashboard}
        registeredTeams={tournament.registeredTeams}
      />

      {/* Edit Tournament Modal */}
      <EditTournamentModal
        visible={showEditDetailsModal}
        onClose={() => setShowEditDetailsModal(false)}
        tournament={tournament}
        onRefresh={fetchDashboard}
      />

      {/* Start Match Modal */}
      <TournamentStartMatchModal
        visible={showStartMatchModal}
        onClose={() => setShowStartMatchModal(false)}
        tournament={tournament}
        onRefresh={fetchDashboard}
      />



      {/* User Register Team Modal */}
      <Modal visible={showRegisterModal} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Your Team</Text>
              <TouchableOpacity onPress={() => setShowRegisterModal(false)}>
                <Icon name="x" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={myTeams}
              keyExtractor={item => item._id}
              style={{ flex: 1, marginTop: Spacing.md }}
              ListEmptyComponent={<Text style={styles.emptyText}>You do not have any teams. Create one first!</Text>}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.teamCard} onPress={() => handleRegisterTeam(item._id)} disabled={actionLoading}>
                  {item.logo ? (
                    <Image source={{ uri: getImageUrl(item.logo) }} style={styles.teamLogo} />
                  ) : (
                    <View style={[styles.teamLogo, { backgroundColor: isDark ? 'rgba(255,204,0,0.15)' : 'rgba(230,184,0,0.12)', justifyContent: 'center', alignItems: 'center', borderColor: isDark ? 'rgba(255,204,0,0.3)' : 'rgba(230,184,0,0.4)' }]}>
                      <Text style={{ color: isDark ? colors.primary : '#8B6E00', fontFamily: Typography.fontFamily.bold, fontSize: 16 }}>
                        {(item.name || 'T').trim().charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.teamName}>{item.name}</Text>
                    <Text style={styles.teamSub}>{item.city}</Text>
                  </View>
                </TouchableOpacity>
              )}
              ListFooterComponent={
                <TouchableOpacity
                  style={[styles.teamCard, { justifyContent: 'center', alignItems: 'center', borderStyle: 'dashed', backgroundColor: 'transparent' }]}
                  onPress={() => {
                    setShowRegisterModal(false);
                    navigation.navigate('TeamCreate', { fromTournamentId: tournamentId });
                  }}
                >
                  <Icon name="plus" size={24} color={colors.primary} />
                  <Text style={[styles.teamName, { color: colors.primary, marginLeft: 8 }]}>Create New Team</Text>
                </TouchableOpacity>
              }
            />
          </View>
        </View>
      </Modal>

      {/* Settings Sidebar Modal */}
      <Modal visible={showSettingsSidebar} animationType="fade" transparent onRequestClose={() => setShowSettingsSidebar(false)}>
        <TouchableOpacity style={styles.sidebarOverlay} activeOpacity={1} onPress={() => setShowSettingsSidebar(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.sidebarContent}>
            <View style={styles.sidebarHeader}>
              <View>
                <Text style={styles.sidebarTitle}>Tournament Menu</Text>
                <Text style={styles.sidebarSubtitle} numberOfLines={1}>{tournament?.name || "Quick Actions"}</Text>
              </View>
              <TouchableOpacity style={styles.sidebarCloseBtn} onPress={() => setShowSettingsSidebar(false)}>
                <Icon name="x" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.sidebarDivider} />

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              <TouchableOpacity style={styles.sidebarCard} onPress={() => { setShowSettingsSidebar(false); handleShareTournament(); }}>
                <View style={[styles.sidebarIconBox, { backgroundColor: isDark ? "rgba(59, 130, 246, 0.15)" : "rgba(59, 130, 246, 0.1)" }]}>
                  <Icon name="share-2" size={18} color="#3B82F6" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sidebarCardTitle}>Share Tournament</Text>
                  <Text style={styles.sidebarCardDesc}>Share link or poster</Text>
                </View>
                <Icon name="chevron-right" size={16} color={colors.textTertiary} />
              </TouchableOpacity>

              {isOrganizer && (
                <TouchableOpacity style={styles.sidebarCard} onPress={() => { setShowSettingsSidebar(false); setShowEditDetailsModal(true); }}>
                  <View style={[styles.sidebarIconBox, { backgroundColor: isDark ? "rgba(245, 158, 11, 0.15)" : "rgba(245, 158, 11, 0.1)" }]}>
                    <Icon name="edit-3" size={18} color="#F59E0B" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sidebarCardTitle}>Edit Details</Text>
                    <Text style={styles.sidebarCardDesc}>Update format & rules</Text>
                  </View>
                  <Icon name="chevron-right" size={16} color={colors.textTertiary} />
                </TouchableOpacity>
              )}

              {isMainOrganizer && (
                <TouchableOpacity style={styles.sidebarCard} onPress={() => { setShowSettingsSidebar(false); setRoleType("coOrganizers"); setShowRoleModal(true); }}>
                  <View style={[styles.sidebarIconBox, { backgroundColor: isDark ? "rgba(16, 185, 129, 0.15)" : "rgba(16, 185, 129, 0.1)" }]}>
                    <Icon name="users" size={18} color="#10B981" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sidebarCardTitle}>Manage Organizers</Text>
                    <Text style={styles.sidebarCardDesc}>Add co-hosts & roles</Text>
                  </View>
                  <Icon name="chevron-right" size={16} color={colors.textTertiary} />
                </TouchableOpacity>
              )}

              {isOrganizer && tournament?.status !== "completed" && (
                <TouchableOpacity style={styles.sidebarCard} onPress={() => { setShowSettingsSidebar(false); setShowCompleteModal(true); }}>
                  <View style={[styles.sidebarIconBox, { backgroundColor: isDark ? "rgba(239, 68, 68, 0.15)" : "rgba(239, 68, 68, 0.1)" }]}>
                    <Icon name="flag" size={18} color="#EF4444" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.sidebarCardTitle, { color: "#EF4444" }]}>End Tournament</Text>
                    <Text style={styles.sidebarCardDesc}>Mark completed & set winner</Text>
                  </View>
                  <Icon name="chevron-right" size={16} color={colors.textTertiary} />
                </TouchableOpacity>
              )}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Mark Tournament as Completed Modal */}
      <Modal visible={showCompleteModal} animationType="fade" transparent>
        <View style={styles.modalBg}>
          <View style={[styles.modalContainer, { maxHeight: '75%' }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Icon name="check-circle" size={20} color="#ff6b35" style={{ marginRight: 8 }} />
                <Text style={[styles.modalTitle, { color: '#ff6b35' }]}>Mark as Completed</Text>
              </View>
              <TouchableOpacity onPress={() => setShowCompleteModal(false)}>
                <Icon name="x" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.bodyText, { marginTop: Spacing.sm, marginBottom: Spacing.md, lineHeight: 20 }]}>
              This will officially end the tournament. This action cannot be undone automatically — you may still edit the winner afterwards.
            </Text>

            {/* Optional Winner Picker */}
            {(tournament?.registeredTeams?.length > 0) && (
              <View style={{ marginBottom: Spacing.md }}>
                <Text style={{ fontSize: 13, color: colors.textSecondary, fontFamily: Typography.fontFamily.medium, marginBottom: 8 }}>Select Winner (optional):</Text>
                <ScrollView style={{ maxHeight: 180, borderWidth: 1, borderColor: colors.border, borderRadius: 8 }}>
                  <TouchableOpacity
                    style={[{ paddingVertical: 10, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: colors.border }, completeWinnerId === '' && { backgroundColor: 'rgba(154,188,47,0.1)' }]}
                    onPress={() => setCompleteWinnerId('')}
                  >
                    <Text style={{ color: completeWinnerId === '' ? colors.primary : colors.textSecondary, fontFamily: Typography.fontFamily.medium, fontSize: 13 }}>None / Skip</Text>
                  </TouchableOpacity>
                  {(tournament?.registeredTeams || []).map((rt, idx) => {
                    const team = rt?.team;
                    if (!team) return null;
                    const teamId = team._id || team;
                    const isSelected = completeWinnerId === teamId;
                    return (
                      <TouchableOpacity
                        key={idx}
                        style={[{ paddingVertical: 10, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center' }, isSelected && { backgroundColor: 'rgba(154,188,47,0.1)' }]}
                        onPress={() => setCompleteWinnerId(isSelected ? '' : teamId)}
                      >
                        {team.logo ? (
                          <Image source={{ uri: getImageUrl(team.logo) }} style={{ width: 24, height: 24, borderRadius: 12, marginRight: 10 }} />
                        ) : (
                          <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.border, marginRight: 10, justifyContent: 'center', alignItems: 'center' }}>
                            <MCIcon name="cricket" size={12} color={colors.textSecondary} />
                          </View>
                        )}
                        <Text style={{ color: isSelected ? colors.primary : colors.textPrimary, fontFamily: isSelected ? Typography.fontFamily.bold : Typography.fontFamily.regular, fontSize: 13, flex: 1 }} numberOfLines={1}>{team.name}</Text>
                        {isSelected && <Icon name="check" size={16} color={colors.primary} />}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
              <TouchableOpacity
                style={[styles.actionBtn, { flex: 1, backgroundColor: colors.backgroundElevated, borderWidth: 1, borderColor: colors.border }]}
                onPress={() => setShowCompleteModal(false)}
              >
                <Text style={[styles.actionBtnText, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, { flex: 1.5, backgroundColor: '#ff6b35' }]}
                onPress={() => handleMarkTournamentCompleted(completeWinnerId || undefined)}
                disabled={completeLoading}
              >
                {completeLoading
                  ? <ActivityIndicator color={colors.white} size="small" />
                  : <>
                    <Icon name="check-circle" size={16} color={colors.white} style={{ marginRight: 6 }} />
                    <Text style={styles.actionBtnText}>Mark Completed</Text>
                  </>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>


      <Modal visible={showFixturePreview} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Fixture Preview</Text>
              <TouchableOpacity onPress={() => setShowFixturePreview(false)}>
                <Icon name="x" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.bodyText, { marginBottom: Spacing.md }]}>
              {tournament?.format?.toLowerCase() === 'knockout'
                ? 'Review the generated knockout pairings before final confirmation.'
                : 'Note: Teams will be randomized into groups upon generation.'}
            </Text>

            <View style={{ flex: 1, backgroundColor: colors.backgroundElevated, borderRadius: BorderRadius.md, padding: Spacing.md, borderWidth: 1, borderColor: colors.border }}>
              <KeyboardAwareScrollView enableOnAndroid={true} extraScrollHeight={20} keyboardShouldPersistTaps="handled">
                {tournament?.format?.toLowerCase() === 'knockout' ? (
                  renderKnockoutPreviewCards()
                ) : (
                  <Text style={[styles.bodyText, { color: colors.textPrimary, lineHeight: 22 }]}>
                    {generatePreviewText()}
                  </Text>
                )}
              </KeyboardAwareScrollView>
            </View>

            {tournament?.format?.toLowerCase() === 'knockout' ? (
              <View style={{ flexDirection: 'row', marginTop: Spacing.lg, gap: 8 }}>
                <TouchableOpacity style={[styles.actionBtn, { flex: 1, backgroundColor: colors.backgroundElevated, borderWidth: 1, borderColor: colors.border }]} onPress={() => setShowFixturePreview(false)}>
                  <Text style={[styles.actionBtnText, { color: colors.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, { flex: 1.2, backgroundColor: 'rgba(154,188,47,0.1)' }]} onPress={handleRegenerateKnockoutPreview}>
                  <MCIcon name="shuffle-variant" size={16} color={colors.primary} style={{ marginRight: 6 }} />
                  <Text style={[styles.actionBtnText, { color: colors.primary }]}>Shuffle</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, { flex: 1.5 }]} onPress={confirmGenerateFixtures} disabled={loading}>
                  {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.actionBtnText}>Confirm</Text>}
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', marginTop: Spacing.lg }}>
                <TouchableOpacity style={[styles.actionBtn, { flex: 1, backgroundColor: colors.backgroundElevated, borderWidth: 1, borderColor: colors.border, marginRight: Spacing.sm }]} onPress={() => setShowFixturePreview(false)}>
                  <Text style={[styles.actionBtnText, { color: colors.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, { flex: 1 }]} onPress={confirmGenerateFixtures} disabled={loading}>
                  {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.actionBtnText}>Confirm & Generate</Text>}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Team Share Modal */}
      <Modal visible={showTeamShareModal} animationType="fade" transparent>
        <View style={styles.modalBg}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Share Fixtures</Text>
              <TouchableOpacity onPress={() => setShowTeamShareModal(false)}>
                <Icon name="x" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.bodyText, { marginBottom: Spacing.md, paddingHorizontal: Spacing.lg, marginTop: Spacing.md }]}>Select fixtures to share:</Text>

            <FlatList
              data={[
                { _id: 'overall', name: 'Overall Schedule' },
                ...Array.from(new Map(
                  (tournament?.matches || [])
                    .filter(m => m.status === 'scheduled')
                    .flatMap(m => [m.teamA, m.teamB])
                    .filter(t => t && t._id)
                    .map(t => [t._id, t])
                ).values())
              ]}
              keyExtractor={item => item._id}
              style={{ maxHeight: 400 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 14,
                    marginHorizontal: Spacing.lg,
                    marginBottom: 10,
                    backgroundColor: 'rgba(255,255,255,0.04)',
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.1)'
                  }}
                  activeOpacity={0.7}
                  onPress={() => {
                    setShowTeamShareModal(false);
                    if (item._id === 'overall') {
                      const upcomingMatches = (tournament?.matches || []).filter(m => m.status === 'scheduled');
                      setShareData({ type: 'fullSchedule', data: { matches: upcomingMatches } });
                    } else {
                      const tmMatches = (tournament?.matches || []).filter(m => m.status === 'scheduled' && (m.teamA?._id === item._id || m.teamB?._id === item._id));
                      setShareData({ type: 'fullSchedule', data: { matches: tmMatches } });
                    }
                  }}
                >
                  {item._id === 'overall' ? (
                    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(154,188,47,0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                      <Icon name="calendar" size={18} color={colors.primary} />
                    </View>
                  ) : (
                    <Image source={{ uri: item.logo ? getImageUrl(item.logo) : 'https://via.placeholder.com/40' }} style={{ width: 40, height: 40, borderRadius: 20, marginRight: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }} />
                  )}
                  <Text style={[styles.bodyText, { color: colors.textPrimary, fontFamily: Typography.fontFamily.bold, fontSize: 15 }]}>
                    {item.name}
                  </Text>
                  <View style={{ flex: 1, alignItems: 'flex-end' }}>
                    <Icon name="chevron-right" size={20} color={colors.textSecondary} />
                  </View>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Share Preview Modal */}
      <SharePreviewModal
        visible={!!shareData}
        onClose={() => setShareData(null)}
        title={shareData?.type === 'tournament' ? tournament?.name : shareData?.type === 'fixture' ? 'Match Fixture' : shareData?.type === 'fullSchedule' ? 'Match Schedule' : shareData?.type === 'pointsTable' ? 'Points Table' : shareData?.type === 'registration' ? 'Register for Auction' : shareData?.type === 'teamInvite' ? 'Invite Teams' : 'Leaderboard'}
        shareUrl={
          shareData?.type === 'fixture'
            ? `https://www.scoreverse.in/match/${shareData.data._id}`
            : `https://www.scoreverse.in/tournament/${tournamentId}${shareData?.type === 'registration' ? '/register' : shareData?.type === 'teamInvite' ? '?action=join-team' : ''}`
        }
      >
        {shareData?.type === 'tournament' && <TournamentSummaryPoster tournament={shareData.data} />}
        {shareData?.type === 'registration' && <RegistrationPoster tournament={shareData.data} />}
        {shareData?.type === 'teamInvite' && <TeamInvitePoster tournament={shareData.data} />}
        {shareData?.type === 'fixture' && <FixturePoster match={shareData.data} tournamentName={tournament?.name} tournamentBanner={tournament?.banner} />}
        {shareData?.type === 'fullSchedule' && (() => {
          const chunkSize = 6; // 6 matches per poster fits perfectly
          const chunks = [];
          const matches = shareData.data.matches || [];
          for (let i = 0; i < matches.length; i += chunkSize) {
            chunks.push(matches.slice(i, i + chunkSize));
          }
          return chunks.map((chunk, index) => (
            <FullSchedulePoster
              key={index}
              matches={chunk}
              tournamentName={tournament?.name}
              tournamentBanner={tournament?.banner}
              pageInfo={chunks.length > 1 ? { current: index + 1, total: chunks.length, totalMatches: matches.length } : null}
            />
          ));
        })()}
        {shareData?.type === 'pointsTable' && <PointsTablePoster pointsTable={shareData.data.table} groupName={shareData.data.groupName} tournamentName={tournament?.name} tournamentBanner={tournament?.banner} />}
        {shareData?.type === 'leaderboard' && (() => {
          const chunkSize = 10;
          const chunks = [];
          const type = shareData.data.type;
          const getValueKey = () => {
            switch (type) {
              case "runs": return "runs";
              case "wickets": return "wickets";
              case "sixes": return "sixes";
              case "fours": return "fours";
              case "strikeRate": return "strikeRate";
              case "economy": return "economy";
              case "catches": return "dismissals";
              case "mvp": return "totalMvp";
              default: return "value";
            }
          };

          let players = shareData.data.data || [];
          if (type === 'mvp') {
            const key = getValueKey();
            players = players.filter(player => {
              const val = parseFloat(player[key] || player.totalMvp || player.value || 0);
              return val > 1;
            });
          } else if (type === 'runs') {
            players = players.filter(player => {
              const val = parseFloat(player.runs || player.value || 0);
              return val > 0;
            });
          } else if (type === 'wickets') {
            players = players.filter(player => {
              const wkts = parseFloat(player.wickets || player.value || 0);
              const overs = parseFloat(player.overs || player.oversBowled || player.bowling?.overs || 0);
              return wkts > 0 || (wkts === 0 && overs > 0);
            });
          } else if (type === 'catches') {
            players = players.filter(player => {
              const val = parseFloat(player.dismissals || player.catches || player.value || 0);
              return val > 0;
            });
          } else if (type === 'sixes') {
            players = players.filter(player => {
              const val = parseFloat(player.sixes || player.value || 0);
              return val > 0;
            });
          } else if (type === 'fours') {
            players = players.filter(player => {
              const val = parseFloat(player.fours || player.value || 0);
              return val > 0;
            });
          }

          for (let i = 0; i < players.length; i += chunkSize) {
            chunks.push(players.slice(i, i + chunkSize));
          }
          return chunks.map((chunk, index) => (
            <LeaderboardPoster
              key={index}
              type={shareData.data.type}
              data={chunk}
              startIndex={index * chunkSize}
              tournamentName={tournament?.name}
              tournamentBanner={tournament?.banner}
              pageInfo={chunks.length > 1 ? { current: index + 1, total: chunks.length, totalPlayers: players.length } : null}
            />
          ));
        })()}
      </SharePreviewModal>

      <GroupManagementModal
        visible={showGroupModal}
        onClose={() => setShowGroupModal(false)}
        tournament={tournament}
        onRefresh={fetchDashboard}
      />

      <RoleManagementModal
        visible={showRoleModal}
        onClose={() => setShowRoleModal(false)}
        tournament={tournament}
        roleType={roleType}
        onRefresh={fetchDashboard}
      />

      {/* Qualification Scenario Modal */}
      <Modal visible={showScenarioModal} transparent animationType="slide" onRequestClose={() => setShowScenarioModal(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: '80%' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <View>
                <Text style={{ fontSize: 18, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary }}>
                  {selectedScenario?.teamName}
                </Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>Qualification Scenario</Text>
              </View>
              <TouchableOpacity onPress={() => setShowScenarioModal(false)}>
                <Icon name="x" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={{ backgroundColor: colors.backgroundElevated, borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: selectedScenario?.color || colors.border }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: selectedScenario?.color, marginRight: 8 }} />
                <Text style={{ fontSize: 16, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary }}>
                  {selectedScenario?.status}
                </Text>
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.borderLight }}>
                <View>
                  <Text style={{ fontSize: 11, color: colors.textTertiary }}>Max Points Possible</Text>
                  <Text style={{ fontSize: 16, fontFamily: Typography.fontFamily.bold, color: colors.primary }}>{selectedScenario?.maxPoints}</Text>
                </View>
                <View>
                  <Text style={{ fontSize: 11, color: colors.textTertiary }}>Matches Remaining</Text>
                  <Text style={{ fontSize: 16, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary }}>{selectedScenario?.matchesRemaining}</Text>
                </View>
                <View>
                  <Text style={{ fontSize: 11, color: colors.textTertiary }}>Probability</Text>
                  <Text style={{ fontSize: 16, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary }}>{selectedScenario?.probability}</Text>
                </View>
              </View>

              <View style={{ marginTop: 12 }}>
                <Text style={{ fontSize: 13, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary, marginBottom: 8 }}>Details:</Text>
                {selectedScenario?.details && selectedScenario.details.length > 0 ? (
                  selectedScenario.details.map((detail, idx) => (
                    <View key={idx} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 }}>
                      <Text style={{ color: colors.textTertiary, marginRight: 6 }}>•</Text>
                      <Text style={{ fontSize: 13, color: colors.textSecondary, flex: 1, lineHeight: 18 }}>{detail}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={{ fontSize: 13, color: colors.textSecondary }}>No additional details available.</Text>
                )}
              </View>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
};

const createAuctionStyles = (colors, shadows, isDark) => StyleSheet.create({
  heroCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: Spacing.lg,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  heroIconRow: { flexDirection: 'row', alignItems: 'center' },
  heroIconBg: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(163,230,53,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroTitle: { fontSize: 16, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary },
  heroSubtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  statusBadgeText: { fontSize: 10, fontFamily: Typography.fontFamily.bold },

  dateRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  dateCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  dateLabel: { fontSize: 11, color: colors.textTertiary, marginTop: 4 },
  dateValue: { fontSize: 12, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary },
  dateSub: { fontSize: 11, color: colors.warning, marginTop: 2 },

  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: Typography.fontFamily.bold,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: Spacing.md,
    paddingTop: 12,
    paddingBottom: 8,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionTitle: { fontSize: 14, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary },
  actionSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  divider: { height: 1, backgroundColor: colors.border, marginHorizontal: Spacing.md },
});

const createStyles = (colors, shadows, isDark, safeTop = 44) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  /* ---- BANNER + HEADER ---- */
  bannerWrapper: { position: 'relative', height: 135 + safeTop, justifyContent: 'flex-end', paddingBottom: 10 },
  headerInfoContentContainer: {
    paddingHorizontal: 16,
  },
  logoAndTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerLogo: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
  headerTitleContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  headerBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  headerBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  /* Top bar: only back button and action buttons */
  headerTopBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingTop: safeTop + 4, paddingBottom: 8, zIndex: 10
  },
  /* Title area positioned perfectly over the gradient */
  headerBottom: {
    position: 'absolute', left: 16, right: 16, bottom: 16, zIndex: 5
  },
  backBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center', alignItems: 'center',
  },
  menuBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center', alignItems: 'center', marginLeft: 10,
  },
  headerTitle: { fontSize: 18, fontWeight: '900', fontFamily: Typography.fontFamily.bold, color: isDark ? '#ffffff' : '#000000', marginBottom: 2, textShadowColor: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  headerMetaText: { fontSize: 13, color: isDark ? '#ffffff' : '#000000', fontFamily: Typography.fontFamily.medium, opacity: 0.9 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  statusDot: { width: 7, height: 7, borderRadius: 3.5 },
  statusLabel: { fontSize: 12, color: '#ffffff', fontFamily: Typography.fontFamily.semiBold, letterSpacing: 0.2 },

  headerBadgeRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 4, marginBottom: 12 },
  organizerChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.45)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  organizerChipText: { fontSize: 11, color: '#ffffff', fontFamily: Typography.fontFamily.semiBold },

  /* Full Width Follow Button */
  fullWidthFollowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#000',
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  fullWidthFollowBtnActive: {
    backgroundColor: '#111',
  },
  fullWidthFollowText: {
    fontSize: 13,
    fontFamily: Typography.fontFamily.semiBold,
    color: '#ffffff',
  },

  followBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, borderWidth: 1, borderColor: colors.primary, backgroundColor: 'rgba(154,188,47,0.15)' },
  followBtnActive: { borderColor: colors.error, backgroundColor: 'rgba(244,67,54,0.15)' },
  followBtnText: { fontSize: 12, fontFamily: Typography.fontFamily.semiBold, color: colors.primary },

  /* ---- TABS (underline style) ---- */
  tabsWrapper: { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  tabsScroll: { paddingHorizontal: 4 },
  tabBtn: { paddingVertical: 13, paddingHorizontal: 16, borderBottomWidth: 2.5, borderBottomColor: 'transparent' },
  tabBtnActive: { borderBottomColor: isDark ? colors.primary : '#E6B800' },
  tabText: { color: colors.textSecondary, fontFamily: Typography.fontFamily.medium, fontSize: 13, letterSpacing: 0.2 },
  tabTextActive: { color: isDark ? colors.primary : '#000000', fontFamily: Typography.fontFamily.bold, fontSize: 13 },

  /* ---- MATCH SUB TABS ---- */
  matchSubTabs: { flexDirection: 'row', marginHorizontal: Spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: 12, marginTop: 8 },
  matchSubTab: { flex: 1, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  matchSubTabActive: { borderBottomColor: isDark ? colors.primary : '#E6B800' },
  matchSubTabText: { color: colors.textSecondary, fontFamily: Typography.fontFamily.medium, fontSize: 13 },
  matchSubTabTextActive: { color: isDark ? colors.primary : '#000000', fontFamily: Typography.fontFamily.bold, fontSize: 13 },
  liveCountBadge: { backgroundColor: colors.error, borderRadius: 8, minWidth: 16, height: 16, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3 },
  liveCountBadgeActive: { backgroundColor: isDark ? colors.primary : '#000000' },
  liveCountText: { fontSize: 9, color: isDark ? '#000000' : '#FFFFFF', fontFamily: Typography.fontFamily.bold },

  /* ---- GENERAL ---- */
  tabContent: { padding: Spacing.md },
  card: { backgroundColor: colors.surface, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.border, ...(isDark ? {} : shadows.xs) },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle: { fontSize: 15, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary },
  bodyText: { color: colors.textSecondary, fontFamily: Typography.fontFamily.regular, marginBottom: 4 },
  emptyText: { textAlign: 'center', color: colors.textTertiary, marginTop: 40, fontFamily: Typography.fontFamily.medium },
  placeholderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },

  /* ---- OVERVIEW STATS STRIP ---- */
  statsStrip: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 14, marginBottom: 12, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', ...(isDark ? {} : shadows.xs) },
  statBox: { flex: 1, alignItems: 'center', paddingVertical: 14 },
  statNum: { fontSize: 18, fontFamily: Typography.fontFamily.bold, color: colors.primary },
  statLabel: { fontSize: 11, color: colors.textTertiary, fontFamily: Typography.fontFamily.medium, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: colors.border, marginVertical: 10 },

  /* ---- INFO ROW ---- */
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  infoIconWrap: { width: 28, alignItems: 'center' },
  infoLabel: { flex: 1, fontSize: 13, color: colors.textSecondary, fontFamily: Typography.fontFamily.medium, marginLeft: 4 },
  infoValue: { fontSize: 13, color: colors.textPrimary, fontFamily: Typography.fontFamily.semiBold },

  /* ---- ORGANIZER ---- */
  organizerRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 12 },
  organizerAvatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.backgroundElevated, borderWidth: 2, borderColor: colors.primary },
  organizerBadge: { backgroundColor: colors.primaryAlpha20, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: colors.primaryAlpha30 },
  organizerBadgeText: { fontSize: 11, color: colors.primary, fontFamily: Typography.fontFamily.semiBold },

  /* ---- TEAM CARD & HEADER ---- */
  teamHeaderStrip: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  teamCountBox: { flex: 1, alignItems: 'center', paddingVertical: 14 },
  teamCountNum: { fontSize: 20, fontFamily: Typography.fontFamily.bold, color: colors.primary },
  teamCountLabel: { fontSize: 11, color: colors.textTertiary, fontFamily: Typography.fontFamily.medium, marginTop: 2 },
  teamCountDivider: { width: 1, backgroundColor: colors.border, marginVertical: 10 },

  /* ---- ORGANIZER ACTION GRID ---- */
  actionGrid: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  actionGridBtn: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  actionGridIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.primaryAlpha10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primaryAlpha20,
  },
  actionGridText: { fontSize: 11, color: colors.textSecondary, fontFamily: Typography.fontFamily.medium },

  teamCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface, paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: colors.borderLight, gap: 10 },
  teamRankText: { width: 24, fontSize: 12, color: colors.textTertiary, fontFamily: Typography.fontFamily.bold, textAlign: 'center' },
  teamLogo: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.backgroundElevated, borderWidth: 1.5, borderColor: colors.border },
  teamName: { fontSize: 15, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary },
  teamSub: { fontSize: 12, color: colors.textTertiary, fontFamily: Typography.fontFamily.medium },
  removeTeamBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.errorLight, justifyContent: 'center', alignItems: 'center' },

  /* ---- START MATCH BTN ---- */
  startMatchBtn: { flexDirection: 'row', backgroundColor: colors.primary, paddingVertical: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  startMatchBtnText: { color: '#000000', fontFamily: Typography.fontFamily.bold, fontSize: 14 },

  /* ---- MATCH CARD ---- */
  cardContainer: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 3,
    borderLeftColor: colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  stagePill: {
    fontSize: 10,
    color: colors.primary,
    fontFamily: Typography.fontFamily.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  cardSubText: {
    fontSize: 11,
    color: colors.textTertiary,
    fontFamily: Typography.fontFamily.medium,
    letterSpacing: 0.2,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.errorLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.error },
  liveBadgeText: { fontSize: 10, color: colors.error, fontFamily: Typography.fontFamily.bold, letterSpacing: 0.5 },
  upcomingBadge: { backgroundColor: colors.warningLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  upcomingBadgeText: { fontSize: 10, color: colors.warning, fontFamily: Typography.fontFamily.bold, letterSpacing: 0.5 },
  resultBadge: { backgroundColor: colors.primaryAlpha20, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  resultBadgeText: { fontSize: 10, color: colors.primary, fontFamily: Typography.fontFamily.bold, letterSpacing: 0.5 },
  vsContainer: { marginBottom: 8 },
  teamScoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
  },
  vsDivider: { height: 1, backgroundColor: colors.borderLight, marginVertical: 2 },
  teamNameText: {
    fontSize: 14,
    color: colors.textPrimary,
    fontFamily: Typography.fontFamily.medium,
    flex: 1,
  },
  winnerTeamText: { color: colors.primary, fontFamily: Typography.fontFamily.bold },
  scoreText: {
    fontSize: 14,
    color: colors.textPrimary,
    fontFamily: Typography.fontFamily.bold,
  },
  overText: {
    fontSize: 11,
    color: colors.textTertiary,
    fontFamily: Typography.fontFamily.regular,
  },
  matchResultFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  matchResultText: {
    flex: 1,
    fontSize: 12,
    color: colors.textSecondary,
    fontFamily: Typography.fontFamily.medium,
  },

  /* ---- POINTS TABLE ---- */
  table: {
    backgroundColor: colors.surface, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  tableRowHeader: { flexDirection: 'row', backgroundColor: colors.primaryDark, paddingVertical: 10, paddingHorizontal: 8 },
  tableRow: { flexDirection: 'row', paddingVertical: 9, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: colors.borderLight, alignItems: 'center' },
  tableRowAlt: { backgroundColor: 'rgba(255,255,255,0.02)' },
  tableCell: { flex: 1, color: colors.textPrimary, fontFamily: Typography.fontFamily.medium, fontSize: 12, textAlign: 'center' },
  tableCellFlex2: { flex: 2 },
  cleanTableContainer: { marginBottom: Spacing.md },
  groupHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface, paddingVertical: 12, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: colors.border },
  groupHeaderTitle: { fontSize: 15, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary },
  cleanTable: {
    marginTop: Spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: BorderRadius.md,
    backgroundColor: colors.surface, overflow: 'hidden' },
  cleanTableHeader: { flexDirection: 'row', backgroundColor: colors.backgroundElevated, paddingVertical: 10, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  cleanTableRow: { flexDirection: 'row', paddingVertical: 11, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: colors.borderLight, alignItems: 'center', backgroundColor: colors.background },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },

  /* ---- ACTIONS ---- */
  actionBtn: { flexDirection: 'row', backgroundColor: colors.primary, paddingVertical: 10, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.md, alignItems: 'center', justifyContent: 'center' },
  actionBtnText: { color: '#000000', fontFamily: Typography.fontFamily.bold, marginLeft: 6, fontSize: 13 },
  smallActionBtn: { backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: BorderRadius.sm },
  smallActionBtnText: { color: '#000000', fontFamily: Typography.fontFamily.bold, fontSize: 12 },

  /* ---- MODALS ---- */
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContainer: {
    backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, height: '80%', padding: Spacing.lg },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  modalTitle: { fontSize: 18, color: colors.textPrimary, fontFamily: Typography.fontFamily.bold },

  searchRow: { flexDirection: 'row', alignItems: 'center' },
  searchInput: { flex: 1, backgroundColor: colors.background, height: 48, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, color: colors.textPrimary, fontFamily: Typography.fontFamily.medium, borderWidth: 1, borderColor: colors.border },
  searchBtn: { backgroundColor: colors.primary, height: 48, width: 48, borderRadius: BorderRadius.md, justifyContent: 'center', alignItems: 'center', marginLeft: Spacing.sm },

  emptySearch: { alignItems: 'center', marginTop: Spacing.xl },
  createGhostBtn: { marginTop: Spacing.lg, padding: Spacing.md, borderColor: colors.primary, borderWidth: 1, borderRadius: BorderRadius.lg },
  createGhostBtnText: { color: colors.primary, fontFamily: Typography.fontFamily.bold },

  label: { fontSize: 14, color: colors.textSecondary, marginBottom: 8, marginTop: Spacing.md, fontFamily: Typography.fontFamily.medium },
  input: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, height: 50, color: colors.textPrimary, fontFamily: Typography.fontFamily.medium },

  /* ---- SIDEBAR ---- */
  sidebarOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-start", alignItems: "flex-end" },
  sidebarContent: {
    width: 290,
    backgroundColor: colors.surface,
    height: "100%",
    paddingHorizontal: Spacing.md,
    paddingTop: 54,
    paddingBottom: 24,
    borderTopLeftRadius: 24,
    borderBottomLeftRadius: 24,
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
    ...(isDark ? {} : shadows.lg),
  },
  sidebarHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: Spacing.md,
  },
  sidebarTitle: { fontSize: 18, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary },
  sidebarSubtitle: { fontSize: 12, fontFamily: Typography.fontFamily.regular, color: colors.textTertiary, marginTop: 2, maxWidth: 190 },
  sidebarCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: isDark ? colors.surfaceVariant : colors.backgroundElevated,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  sidebarDivider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginBottom: Spacing.md,
  },
  sidebarCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.md,
    backgroundColor: isDark ? "rgba(255,255,255,0.03)" : colors.surfaceVariant,
    borderWidth: 1,
    borderColor: colors.borderLight,
    gap: 12,
  },
  sidebarIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  sidebarCardTitle: { fontSize: 14, fontFamily: Typography.fontFamily.semiBold, color: colors.textPrimary },
  sidebarCardDesc: { fontSize: 11, fontFamily: Typography.fontFamily.regular, color: colors.textTertiary, marginTop: 1 },

  footerContainer: { padding: Spacing.lg, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background },
  footerBtn: { backgroundColor: colors.primary, flexDirection: 'row', height: 52, borderRadius: BorderRadius.lg, justifyContent: 'center', alignItems: 'center' },
  footerBtnText: { color: '#000000', fontSize: 16, fontFamily: Typography.fontFamily.bold, marginLeft: 8 },

  // NRR Calculator Modal Styles
  scenarioTeamBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, marginRight: 8 },
  scenarioTeamBtnActive: { backgroundColor: 'rgba(59, 130, 246, 0.2)', borderColor: '#3b82f6' },
  scenarioTeamBtnText: { color: colors.textSecondary, fontFamily: Typography.fontFamily.medium, fontSize: 13 },
  scenarioTeamBtnTextActive: { color: '#3b82f6', fontFamily: Typography.fontFamily.bold },
  choiceBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  choiceBtnActive: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  choiceBtnText: { color: colors.textSecondary, fontFamily: Typography.fontFamily.medium },
  choiceBtnTextActive: { color: colors.white, fontFamily: Typography.fontFamily.bold },
  scenarioResultCard: { marginTop: 20, padding: 15, borderRadius: 12, alignItems: 'center' },
  scenarioResultText: { fontFamily: Typography.fontFamily.semiBold, fontSize: 15, textAlign: 'center' }
});

export default TournamentDetailScreen;
