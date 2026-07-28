import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Image, FlatList, Share, Modal, TextInput, RefreshControl, StatusBar, ToastAndroid, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import moment from 'moment';
import { Colors, Typography, Spacing, BorderRadius } from '../../../theme/theme';
import api, { getImageUrl, BASE_URL } from '../../../api/axios';
import { useSelector } from 'react-redux';
import socketService from '../../../services/socketService';
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
import { TournamentSummaryPoster, FixturePoster, PointsTablePoster, LeaderboardPoster, FullSchedulePoster } from '../components/PosterTemplates';

const TABS = [
  'Overview', 'Matches', 'Auction', 'Teams', 'Points Table',
  'Leaderboard', 'Statistics'
];

const TournamentDetailScreen = ({ route, navigation }) => {
  const { tournamentId } = route.params;
  const [tournament, setTournament] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('Overview');
  const [matchSubTab, setMatchSubTab] = useState('Live'); // Live, Upcoming, Past
  const [selectedTeamFilter, setSelectedTeamFilter] = useState('');
  const { user } = useSelector(state => state.auth);

  // Modals state
  const [showAddTeamModal, setShowAddTeamModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showGhostForm, setShowGhostForm] = useState(false);
  const [ghostForm, setGhostForm] = useState({ teamName: '', captainName: '', captainMobile: '', city: '' });
  const [actionLoading, setActionLoading] = useState(false);
  const [showSettingsSidebar, setShowSettingsSidebar] = useState(false);
  const [showFixturePreview, setShowFixturePreview] = useState(false);
  const [shareData, setShareData] = useState(null);
  const [showTeamShareModal, setShowTeamShareModal] = useState(false);

  const [auctionDetails, setAuctionDetails] = useState(null);
  const [isAuctionRegistered, setIsAuctionRegistered] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [myTeams, setMyTeams] = useState([]);

  // New Management Modals
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showWizardModal, setShowWizardModal] = useState(false);
  const [roleType, setRoleType] = useState('coOrganizers');
  const [showEditDetailsModal, setShowEditDetailsModal] = useState(false);
  const [showStartMatchModal, setShowStartMatchModal] = useState(false);

  const matchesRef = useRef([]);

  useEffect(() => {
    if (route.params?.action === 'join-team') {
      setShowRegisterModal(true);
      navigation.setParams({ action: undefined });
    }
  }, [route.params?.action, navigation]);

  useEffect(() => {
    matchesRef.current = tournament?.matches || [];
  }, [tournament?.matches]);

  useFocusEffect(
    useCallback(() => {
      fetchDashboard();
      fetchAuctionData();
    }, [fetchAuctionData])
  );

  useEffect(() => {
    let unsubscribeScore;
    if (tournament?.matches && tournament.matches.length > 0) {
      tournament.matches.forEach(m => {
        if (m.status === 'in_progress' || m.status === 'toss_done' || m.status === 'innings_break') {
          const cleanId = socketService.cleanId(m._id || m.id);
          socketService.joinMatch(cleanId);
          socketService.remoteLog('TournamentDetailScreen', `Joined tournament match room: match_${cleanId}`);
        }
      });

      unsubscribeScore = socketService.onScoreUpdate((data) => {
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
                if (data.match) {
                  newM.status = data.match.status;
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
    }

    return () => {
      if (unsubscribeScore) unsubscribeScore();
      if (tournament?.matches && tournament.matches.length > 0) {
        tournament.matches.forEach(m => {
          socketService.leaveMatch(m._id || m.id);
        });
      }
    };
  }, [tournament?.matches]);

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
              } else {
                setIsAuctionRegistered(false);
              }
            } catch (e) {
              setIsAuctionRegistered(false);
            }
          }
        }
      } catch (err) {
        console.log('Error fetching auction details', err);
      }
    }
  }, [activeTab, tournamentId]);

  useFocusEffect(
    useCallback(() => {
      fetchAuctionData();
      fetchDashboard();
    }, [fetchAuctionData, tournamentId])
  );

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

  const handleGenerateFixtures = () => {
    if (!tournament?.registeredTeams || tournament.registeredTeams.length < 2) {
      showCustomAlert('Error', 'Not enough teams to generate fixtures.');
      return;
    }
    setShowWizardModal(true);
  };

  const confirmGenerateFixtures = async () => {
    try {
      setLoading(true);
      await api.post(`/tournaments/${tournamentId}/generate-fixtures`);
      await fetchDashboard();
      setShowFixturePreview(false);
      showCustomAlert('Success', 'Fixtures generated successfully!');
    } catch (e) {
      console.log('Error generating fixtures', e);
      showCustomAlert('Error', e.response?.data?.message || 'Failed to generate fixtures');
      setLoading(false);
    }
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
  const isScorer = tournament?.scorers?.some(s => (s._id || s) === user?._id);
  const canStartMatch = isOrganizer || isScorer;

  const handleShareTournament = async () => {
    setShareData({ type: 'tournament', data: tournament });
  };

  const handleShareJoinLink = async () => {
    try {
      await Share.share({
        message: `Join ${tournament.name} on SportVerse! Click the link to register your team: https://sportverse.maazibrahimoo0.workers.dev/tournament/${tournamentId}?action=join-team`,
      });
    } catch (error) {
      console.log('Error sharing', error);
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
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <MCIcon name="cricket" size={48} color={Colors.primary} style={{ marginBottom: 16, opacity: 0.6 }} />
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={{ color: Colors.textSecondary, marginTop: 12, fontFamily: Typography.fontFamily.medium, fontSize: 14 }}>Loading tournament...</Text>
      </SafeAreaView>
    );
  }

  // --- TAB RENDERERS ---

  const InfoRow = ({ iconName, iconLib, label, value }) => (
    <View style={styles.infoRow}>
      <View style={styles.infoIconWrap}>
        {iconLib === 'mc'
          ? <MCIcon name={iconName} size={16} color={Colors.primary} />
          : <Icon name={iconName} size={15} color={Colors.primary} />}
      </View>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );

  const renderOverview = () => (
    <KeyboardAwareScrollView enableOnAndroid={true} extraScrollHeight={20} keyboardShouldPersistTaps="handled" style={styles.tabContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} tintColor={Colors.primary} />}>

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

      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <MCIcon name="format-list-bulleted" size={18} color={Colors.primary} />
          <Text style={styles.sectionTitle}>Format & Settings</Text>
        </View>
        <InfoRow iconLib="mc" iconName="trophy-variant" label="Type" value={tournament.tournamentType || 'Standard'} />
        <InfoRow iconLib="mc" iconName="cricket" label="Format" value={tournament.format?.toUpperCase() || 'Custom'} />
        <InfoRow iconLib="mc" iconName="circle-outline" label="Ball Type" value={tournament.ballType || '-'} />
        <InfoRow iconLib="mc" iconName="grass" label="Ground Type" value={tournament.groundType || '-'} />
        <InfoRow iconLib="mc" iconName="account-group" label="Players/Team" value={String(tournament.playersPerTeam || '-')} />
      </View>

      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <Icon name="map-pin" size={16} color={Colors.primary} />
          <Text style={styles.sectionTitle}>Logistics</Text>
        </View>
        <InfoRow iconLib="feather" iconName="calendar" label="Start Date" value={moment.utc(tournament.startDate).format('DD MMM YYYY')} />
        <InfoRow iconLib="feather" iconName="map-pin" label="City" value={tournament.city || '-'} />
        {tournament.groundName ? <InfoRow iconLib="mc" iconName="stadium" label="Ground" value={tournament.groundName} /> : null}
      </View>

      {tournament.rules ? (
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Icon name="file-text" size={16} color={Colors.primary} />
            <Text style={styles.sectionTitle}>Rules</Text>
          </View>
          <Text style={[styles.bodyText, { marginTop: 8, lineHeight: 22 }]}>{tournament.rules}</Text>
        </View>
      ) : null}

      {tournament.organizer && (
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Icon name="user" size={16} color={Colors.primary} />
            <Text style={styles.sectionTitle}>Organizer</Text>
          </View>
          <View style={styles.organizerRow}>
            <Image source={{ uri: tournament.organizer.photo ? getImageUrl(tournament.organizer.photo) : 'https://via.placeholder.com/50' }} style={styles.organizerAvatar} />
            <View style={{ flex: 1 }}>
              <Text style={styles.teamName}>{tournament.organizer.name}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                <Icon name="phone" size={12} color={Colors.textTertiary} />
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
        {/* Team count header */}
        <View style={styles.teamHeaderStrip}>
          <View style={styles.teamCountBox}>
            <Text style={styles.teamCountNum}>{teamCount}</Text>
            <Text style={styles.teamCountLabel}>Registered</Text>
          </View>
          <View style={styles.teamCountDivider} />
          <View style={styles.teamCountBox}>
            <Text style={[styles.teamCountNum, { color: spotsLeft === 0 ? Colors.error : Colors.success }]}>{spotsLeft}</Text>
            <Text style={styles.teamCountLabel}>Spots Left</Text>
          </View>
          <View style={styles.teamCountDivider} />
          <View style={styles.teamCountBox}>
            <Text style={styles.teamCountNum}>{maxTeams}</Text>
            <Text style={styles.teamCountLabel}>Max Teams</Text>
          </View>
        </View>

        {isOrganizer && (
          <View style={styles.actionGrid}>
            <TouchableOpacity
              style={[styles.actionGridBtn, !hasTournamentStarted && { opacity: 0.5 }]}
              onPress={() => {
                if (!hasTournamentStarted) {
                  showCustomAlert('Tournament Not Started', 'Fixtures can only be generated after the tournament starts.');
                  return;
                }
                handleGenerateFixtures();
              }}
              disabled={loading}
            >
              <View style={[styles.actionGridIcon, !hasTournamentStarted && { backgroundColor: 'rgba(255,255,255,0.05)' }]}>
                <Icon name={hasTournamentStarted ? "calendar" : "lock"} size={20} color={hasTournamentStarted ? Colors.primary : Colors.textTertiary} />
              </View>
              <Text style={styles.actionGridText}>Fixtures</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionGridBtn} onPress={() => setShowGroupModal(true)}>
              <View style={styles.actionGridIcon}>
                <MCIcon name="layers-triple" size={20} color={Colors.primary} />
              </View>
              <Text style={styles.actionGridText}>Groups</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionGridBtn} onPress={() => setShowAddTeamModal(true)}>
              <View style={styles.actionGridIcon}>
                <Icon name="user-plus" size={20} color={Colors.primary} />
              </View>
              <Text style={styles.actionGridText}>Add Team</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionGridBtn} onPress={handleShareJoinLink}>
              <View style={styles.actionGridIcon}>
                <Icon name="link" size={20} color={Colors.primary} />
              </View>
              <Text style={styles.actionGridText}>Invite</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* {!isOrganizer && (
          <View style={styles.actionGrid}>
            <TouchableOpacity style={styles.actionGridBtn} onPress={() => setShowRegisterModal(true)}>
              <View style={styles.actionGridIcon}>
                <Icon name="user-plus" size={20} color={Colors.primary} />
              </View>
              <Text style={styles.actionGridText}>Register Team</Text>
            </TouchableOpacity>
          </View>
        )} */}

        <FlatList
          data={tournament.registeredTeams}
          keyExtractor={(item, index) => item?.team?._id || item?._id || index.toString()}
          contentContainerStyle={[styles.tabContent, { paddingTop: 8 }]}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingVertical: 40 }}>
              <MCIcon name="account-group-outline" size={48} color={Colors.textTertiary} />
              <Text style={[styles.emptyText, { marginTop: 12 }]}>No teams registered yet.</Text>
            </View>
          }
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} tintColor={Colors.primary} />}
          renderItem={({ item, index }) => {
            if (!item?.team) return null;
            return (
              <TouchableOpacity
                style={styles.teamCard}
                onPress={() => navigation.navigate('TeamDetail', { id: item.team._id })}
                activeOpacity={0.75}
              >
                <Text style={styles.teamRankText}>#{index + 1}</Text>
                <Image
                  source={{ uri: item.team.logo ? getImageUrl(item.team.logo) : 'https://via.placeholder.com/50' }}
                  style={styles.teamLogo}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.teamName}>{item.team.name}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2, gap: 4 }}>
                    <Icon name="map-pin" size={11} color={Colors.textTertiary} />
                    <Text style={styles.teamSub}>{item.team.city || 'Unknown City'}</Text>
                  </View>
                </View>
                {isOrganizer ? (
                  <TouchableOpacity
                    style={styles.removeTeamBtn}
                    onPress={() => handleRemoveTeam(item.team._id, item.team.name)}
                    disabled={actionLoading}
                  >
                    <Icon name="trash-2" size={15} color={Colors.error} />
                  </TouchableOpacity>
                ) : (
                  <Icon name="chevron-right" size={17} color={Colors.textTertiary} />
                )}
              </TouchableOpacity>
            );
          }}
        />
      </View>
    );
  };

  const renderMatches = () => {
    let filteredMatches = [];
    if (matchSubTab === 'Upcoming') {
      filteredMatches = (tournament.matches?.filter(m => m.status === 'scheduled') || [])
        .sort((a, b) => new Date(a.scheduledAt || a.createdAt) - new Date(b.scheduledAt || b.createdAt));
    } else if (matchSubTab === 'Live') {
      filteredMatches = tournament.matches?.filter(m => ['toss_done', 'in_progress', 'innings_break', 'super_over'].includes(m.status)) || [];
    } else if (matchSubTab === 'Past') {
      filteredMatches = (tournament.matches?.filter(m => ['completed', 'abandoned', 'no_result'].includes(m.status)) || [])
        .sort((a, b) => new Date(b.completedAt || b.updatedAt) - new Date(a.completedAt || a.updatedAt));
    }

    if (selectedTeamFilter) {
      filteredMatches = filteredMatches.filter(m => m.teamA?._id === selectedTeamFilter || m.teamB?._id === selectedTeamFilter || m.teamA === selectedTeamFilter || m.teamB === selectedTeamFilter);
    }

    return (
      <View style={{ flex: 1 }}>
        {isOrganizer && (
          <View style={{ paddingHorizontal: Spacing.md, paddingTop: Spacing.md, paddingBottom: 0, flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity
              style={[styles.startMatchBtn, { flex: 1, backgroundColor: Colors.backgroundElevated, borderWidth: 1, borderColor: Colors.primary }, (tournament.matches?.some(m => m.status !== 'scheduled') || tournament.status === 'completed') && { opacity: 0.5, borderColor: Colors.border }]}
              onPress={() => {
                if (tournament.status === 'completed') {
                  showCustomAlert('Completed', 'Tournament has already finished.');
                } else if (tournament.matches?.some(m => m.status !== 'scheduled')) {
                  showCustomAlert('Locked', 'Fixtures cannot be generated after matches have started.');
                } else {
                  handleGenerateFixtures();
                }
              }}
              disabled={tournament.matches?.some(m => m.status !== 'scheduled') || tournament.status === 'completed'}
            >
              <MCIcon name="calendar-refresh" size={18} color={(tournament.matches?.some(m => m.status !== 'scheduled') || tournament.status === 'completed') ? Colors.textSecondary : Colors.primary} style={{ marginRight: 8 }} />
              <Text style={[styles.startMatchBtnText, { color: (tournament.matches?.some(m => m.status !== 'scheduled') || tournament.status === 'completed') ? Colors.textSecondary : Colors.primary }]}>
                Fixtures
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.startMatchBtn, { flex: 1 }, tournament.status === 'completed' && { opacity: 0.6 }]}
              onPress={() => setShowStartMatchModal(true)}
              disabled={tournament.status === 'completed'}
            >
              <MCIcon name="play-circle" size={18} color='#011528' style={{ marginRight: 8 }} />
              <Text style={styles.startMatchBtnText}>
                {tournament.status === 'completed' ? 'Completed' : 'Start Match'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: Spacing.md, marginTop: 12, marginBottom: 8 }}>
          <Text style={{ fontSize: 15, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary }}>Fixtures & Schedule</Text>
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 5, paddingHorizontal: 12, borderRadius: 14, backgroundColor: 'rgba(154,188,47,0.15)' }}
            onPress={() => setShowTeamShareModal(true)}
          >
            <Icon name="share-2" size={13} color={Colors.primary} style={{ marginRight: 4 }} />
            <Text style={{ color: Colors.primary, fontFamily: Typography.fontFamily.bold, fontSize: 12 }}>Share Schedule</Text>
          </TouchableOpacity>
        </View>

        <View style={{ flexDirection: 'row', marginHorizontal: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border, marginBottom: 12 }}>
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
                      <Text style={[styles.liveCountText, matchSubTab === 'Live' && { color: '#011528' }]}>{liveCount}</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Removed Team Filter */}
        <FlatList
          data={filteredMatches}
          keyExtractor={item => item._id}
          contentContainerStyle={styles.tabContent}
          ListEmptyComponent={<Text style={styles.emptyText}>No {matchSubTab.toLowerCase()} matches found.</Text>}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} tintColor={Colors.primary} />}
          renderItem={({ item }) => {
            const isLive = ['in_progress', 'toss_done', 'innings_break', 'super_over'].includes(item.status);
            const isCompleted = item.status === 'completed';
            const isATeamWinner = isCompleted && (item.result?.winner === item.teamA?._id || item.result?.winner?._id === item.teamA?._id);
            const isBTeamWinner = isCompleted && (item.result?.winner === item.teamB?._id || item.result?.winner?._id === item.teamB?._id);
            const accentColor = isLive ? Colors.error : isCompleted ? Colors.primary : Colors.border;
            return (
              <TouchableOpacity style={[styles.cardContainer, { borderLeftColor: accentColor }]} activeOpacity={0.85} onPress={() => navigation.navigate('MatchSummary', { matchId: item._id })}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    {item.stage ? <Text style={styles.stagePill}>{item.stage}</Text> : null}
                    <Text style={styles.cardSubText} numberOfLines={1}>
                      {item.format?.toUpperCase() || 'Custom'}  •  {moment(item.scheduledAt || item.createdAt).format('DD MMM, hh:mm A')}  •  {item.overs} Ov
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
                      <Icon name="share-2" size={16} color={Colors.primary} />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.vsContainer}>
                  <View style={styles.teamScoreRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                      {isATeamWinner && <MCIcon name="crown" size={14} color={Colors.primary} style={{ marginRight: 4 }} />}
                      <Text style={[styles.teamNameText, isATeamWinner && styles.winnerTeamText]} numberOfLines={1}>{item.teamA?.name || 'TBD'}</Text>
                    </View>
                    <Text style={[styles.scoreText, isATeamWinner && { color: Colors.primary }]}>
                      {item.teamAScore?.runs || 0}/{item.teamAScore?.wickets || 0} <Text style={styles.overText}>({item.teamAScore?.overs || '0.0'})</Text>
                    </Text>
                  </View>
                  <View style={styles.vsDivider} />
                  <View style={styles.teamScoreRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                      {isBTeamWinner && <MCIcon name="crown" size={14} color={Colors.primary} style={{ marginRight: 4 }} />}
                      <Text style={[styles.teamNameText, isBTeamWinner && styles.winnerTeamText]} numberOfLines={1}>{item.teamB?.name || 'TBD'}</Text>
                    </View>
                    <Text style={[styles.scoreText, isBTeamWinner && { color: Colors.primary }]}>
                      {item.teamBScore?.runs || 0}/{item.teamBScore?.wickets || 0} <Text style={styles.overText}>({item.teamBScore?.overs || '0.0'})</Text>
                    </Text>
                  </View>
                </View>

                {(item.result?.summary || (item.toss?.winner && item.status !== 'scheduled')) ? (
                  <View style={styles.matchResultFooter}>
                    <Icon name={isCompleted ? 'award' : 'info'} size={12} color={Colors.primary} />
                    <Text style={styles.matchResultText} numberOfLines={1}>
                      {item.result?.summary || `${item.toss?.winner?.name || ''} won toss, elected to ${item.toss?.choice}`}
                    </Text>
                  </View>
                ) : item.status === 'scheduled' ? (
                  <View style={styles.matchResultFooter}>
                    <Icon name="clock" size={12} color={Colors.textTertiary} />
                    <Text style={[styles.matchResultText, { color: Colors.textTertiary }]}>
                      {moment(item.scheduledAt || item.createdAt).format('ddd, DD MMM YYYY [at] hh:mm A')}
                    </Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          }}
        />
      </View>
    );
  };

  const renderPointsTable = () => {
    const hasGroups = tournament.pointsTable?.some(row => row.groupName);

    if (hasGroups) {
      const grouped = tournament.pointsTable.reduce((acc, row) => {
        const g = row.groupName || 'Other';
        if (!acc[g]) acc[g] = [];
        acc[g].push(row);
        return acc;
      }, {});

      return (
        <KeyboardAwareScrollView enableOnAndroid={true} extraScrollHeight={20} keyboardShouldPersistTaps="handled" style={styles.tabContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} tintColor={Colors.primary} />}>
          {Object.entries(grouped).map(([groupName, rows], gIdx) => (
            <View key={gIdx} style={[styles.table, { marginBottom: Spacing.lg }]}>
              <View style={[styles.tableRowHeader, { backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border, justifyContent: 'space-between' }]}>
                <Text style={[styles.sectionTitle, { marginBottom: 0, padding: Spacing.sm }]}>{groupName}</Text>
                <TouchableOpacity onPress={() => setShareData({ type: 'pointsTable', data: { table: rows, groupName } })} style={{ padding: 8 }}>
                  <Icon name="share-2" size={16} color={Colors.primary} />
                </TouchableOpacity>
              </View>
              <View style={styles.tableRowHeader}>
                <Text style={[styles.tableCell, { flex: 2 }]}>Team</Text>
                <Text style={styles.tableCell}>P</Text>
                <Text style={styles.tableCell}>W</Text>
                <Text style={styles.tableCell}>L</Text>
                <Text style={styles.tableCell}>NR</Text>
                <Text style={styles.tableCell}>Pts</Text>
                <Text style={styles.tableCell}>NRR</Text>
              </View>
              {rows.map((row, idx) => (
                <View key={idx} style={[styles.tableRow, idx % 2 === 0 && styles.tableRowAlt]}>
                  <View style={[styles.tableCellFlex2, { flexDirection: 'row', alignItems: 'center' }]}>
                    {idx === 0 && <MCIcon name="trophy" size={12} color={Colors.warning} style={{ marginRight: 4 }} />}
                    <Text style={[styles.tableCell, { flex: 1, textAlign: 'left' }]} numberOfLines={1}>
                      {row.team?.name}{row.qualified ? ' ✓' : ''}{row.eliminated ? ' ✗' : ''}
                    </Text>
                  </View>
                  <Text style={styles.tableCell}>{row.played}</Text>
                  <Text style={[styles.tableCell, { color: Colors.success }]}>{row.won}</Text>
                  <Text style={[styles.tableCell, { color: Colors.error }]}>{row.lost}</Text>
                  <Text style={styles.tableCell}>{row.noResult}</Text>
                  <Text style={[styles.tableCell, { color: Colors.primary, fontFamily: Typography.fontFamily.bold }]}>{row.points}</Text>
                  <Text style={[styles.tableCell, { color: row.netRunRate >= 0 ? Colors.success : Colors.error }]}>{row.netRunRate?.toFixed(2)}</Text>
                </View>
              ))}
            </View>
          ))}
        </KeyboardAwareScrollView>
      );
    }

    return (
      <KeyboardAwareScrollView enableOnAndroid={true} extraScrollHeight={20} keyboardShouldPersistTaps="handled" style={styles.tabContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} tintColor={Colors.primary} />}>
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 12, paddingHorizontal: Spacing.md }}>
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(154,188,47,0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 }}
            onPress={() => setShareData({ type: 'pointsTable', data: { table: tournament.pointsTable } })}
          >
            <Icon name="share-2" size={14} color={Colors.primary} style={{ marginRight: 6 }} />
            <Text style={{ color: Colors.primary, fontFamily: Typography.fontFamily.bold, fontSize: 12 }}>Share Standings</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.table}>
          <View style={styles.tableRowHeader}>
            <Text style={[styles.tableCell, { flex: 2 }]}>Team</Text>
            <Text style={styles.tableCell}>P</Text>
            <Text style={styles.tableCell}>W</Text>
            <Text style={styles.tableCell}>L</Text>
            <Text style={styles.tableCell}>NR</Text>
            <Text style={styles.tableCell}>Pts</Text>
            <Text style={styles.tableCell}>NRR</Text>
          </View>
          {tournament.pointsTable?.map((row, idx) => (
            <View key={idx} style={[styles.tableRow, idx % 2 === 0 && styles.tableRowAlt]}>
              <View style={[styles.tableCellFlex2, { flexDirection: 'row', alignItems: 'center' }]}>
                {idx === 0 && <MCIcon name="trophy" size={12} color={Colors.warning} style={{ marginRight: 4 }} />}
                <Text style={[styles.tableCell, { flex: 1, textAlign: 'left' }]} numberOfLines={1}>
                  {row.team?.name}{row.qualified ? ' ✓' : ''}{row.eliminated ? ' ✗' : ''}
                </Text>
              </View>
              <Text style={styles.tableCell}>{row.played}</Text>
              <Text style={[styles.tableCell, { color: Colors.success }]}>{row.won}</Text>
              <Text style={[styles.tableCell, { color: Colors.error }]}>{row.lost}</Text>
              <Text style={styles.tableCell}>{row.noResult}</Text>
              <Text style={[styles.tableCell, { color: Colors.primary, fontFamily: Typography.fontFamily.bold }]}>{row.points}</Text>
              <Text style={[styles.tableCell, { color: row.netRunRate >= 0 ? Colors.success : Colors.error }]}>{row.netRunRate?.toFixed(2)}</Text>
            </View>
          ))}
        </View>
      </KeyboardAwareScrollView>
    );
  };

  const renderPlaceholder = (tabName) => (
    <View style={styles.placeholderContainer}>
      <Icon name="clock" size={40} color={Colors.textTertiary} />
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
    const regEndPassed = !regEndDate || new Date() >= new Date(regEndDate);
    const auctionDateReached = !auctionDate || new Date() >= new Date(auctionDate);

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
            tintColor={Colors.primary}
          />
        }
      >
        {/* Hero Header */}
        <View style={auctionStyles.heroCard}>
          <View style={auctionStyles.heroIconRow}>
            <View style={auctionStyles.heroIconBg}>
              <MCIcon name="gavel" size={28} color={Colors.primary} />
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
                { color: auctionDetails?.status === 'completed' ? '#4ADE80' : auctionDateReached ? Colors.warning : '#818CF8' }
              ]}>
                {auctionDetails?.status === 'completed' ? '✓ COMPLETED' : auctionDateReached ? '🔴 LIVE READY' : '⏳ UPCOMING'}
              </Text>
            </View>
          </View>
        </View>

        {/* Date Info Cards */}
        <View style={auctionStyles.dateRow}>
          <View style={auctionStyles.dateCard}>
            <MCIcon name="calendar-clock" size={18} color={regEndPassed ? '#4ADE80' : Colors.warning} />
            <Text style={auctionStyles.dateLabel}>Reg. Closes</Text>
            <Text style={auctionStyles.dateValue}>{formatDate(regEndDate)}</Text>
            {regCountdown && <Text style={auctionStyles.dateSub}>{regCountdown}</Text>}
            {regEndPassed && <Text style={[auctionStyles.dateSub, { color: '#4ADE80' }]}>✓ Closed</Text>}
          </View>
          <View style={auctionStyles.dateCard}>
            <MCIcon name="gavel" size={18} color={auctionDateReached ? Colors.warning : Colors.primary} />
            <Text style={auctionStyles.dateLabel}>Auction Day</Text>
            <Text style={auctionStyles.dateValue}>{formatDate(auctionDate)}</Text>
            {auctionCountdown && <Text style={auctionStyles.dateSub}>{auctionCountdown}</Text>}
            {!auctionCountdown && auctionDateReached && auctionDate && (
              <Text style={[auctionStyles.dateSub, { color: auctionDetails?.status === 'completed' ? '#4ADE80' : Colors.warning }]}>
                {auctionDetails?.status === 'completed' ? '✓ Completed' : (moment(auctionDate).isSame(moment(), 'day') ? '🔥 Today!' : 'Date Passed')}
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
              <MCIcon name="chevron-right" size={22} color={Colors.textTertiary} />
            </TouchableOpacity>

            <View style={auctionStyles.divider} />

            <TouchableOpacity
              style={[
                auctionStyles.actionRow,
                !regEndPassed && { opacity: 0.55 }
              ]}
              onPress={() => {
                if (!regEndPassed) {
                  showCustomAlert('Not Available', 'Registration is still open. Create Sets will be available once the registration date has passed.');
                } else {
                  navigation.navigate('AuctionCreateSets', { tournamentId: tournament._id, mode: 'sets' });
                }
              }}
            >
              <View style={[auctionStyles.actionIcon, { backgroundColor: regEndPassed ? 'rgba(74,222,128,0.12)' : 'rgba(255,255,255,0.05)' }]}>
                <MCIcon name="cards-outline" size={20} color={regEndPassed ? '#4ADE80' : Colors.textTertiary} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={auctionStyles.actionTitle}>Create & Manage Sets</Text>
                <Text style={auctionStyles.actionSub}>
                  {regEndPassed ? 'Split players into auction sets' : 'Available after registration closes'}
                </Text>
              </View>
              {regEndPassed
                ? <MCIcon name="chevron-right" size={22} color={Colors.textTertiary} />
                : <MCIcon name="lock-outline" size={18} color={Colors.textTertiary} />}
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
                    <MCIcon name="broadcast" size={20} color={auctionDetails?.hasSets ? Colors.warning : Colors.textTertiary} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[auctionStyles.actionTitle, { color: auctionDetails?.hasSets ? Colors.warning : Colors.textPrimary }]}>
                      {auctionDetails?.status === 'in_progress' ? 'Resume / Close Live Auction' : 'Launch Live Auction'}
                    </Text>
                    <Text style={auctionStyles.actionSub}>
                      {auctionDetails?.hasSets
                        ? (auctionDetails?.status === 'in_progress' ? 'Enter dashboard to resume or close auction' : 'Start bidding session now')
                        : 'Create sets first'}
                    </Text>
                  </View>
                  {auctionDetails?.hasSets ? (
                    <MCIcon name="chevron-right" size={22} color={Colors.warning} />
                  ) : (
                    <MCIcon name="lock-outline" size={18} color={Colors.textTertiary} />
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
              onPress={() => navigation.navigate('AuctionCreateSets', { tournamentId: tournament._id, mode: 'registrations', isReadOnly: true, showFinanceForOrganizer: true })}
            >
              <View style={[auctionStyles.actionIcon, { backgroundColor: 'rgba(56,189,248,0.12)' }]}>
                <MCIcon name="format-list-bulleted" size={20} color="#38BDF8" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={auctionStyles.actionTitle}>View Auctioned Players</Text>
                <Text style={auctionStyles.actionSub}>List of users and finance (Read-only)</Text>
              </View>
              <MCIcon name="chevron-right" size={22} color={Colors.textTertiary} />
            </TouchableOpacity>
          </View>
        )}

        {/* Team Owner Section */}
        {isTeamCaptainOrOwner && (
          <View style={auctionStyles.sectionCard}>
            <Text style={auctionStyles.sectionTitle}>Team Owner</Text>
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
                <MCIcon name="shield-crown" size={20} color={Colors.warning} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={auctionStyles.actionTitle}>My Team Dashboard</Text>
                <Text style={auctionStyles.actionSub}>View bids, purse & squad</Text>
              </View>
              <MCIcon name="chevron-right" size={22} color={Colors.textTertiary} />
            </TouchableOpacity>

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
              <MCIcon name="chevron-right" size={22} color={Colors.textTertiary} />
            </TouchableOpacity>
          </View>
        )}

        {/* Viewer / Player Section */}
    {!(isOrganizer && auctionDetails?.status === 'completed') && (
          auctionDetails?.status === 'completed' ? (
          <View style={auctionStyles.sectionCard}>
            <Text style={auctionStyles.sectionTitle}>Auction Status</Text>
            <View style={auctionStyles.actionRow}>
              <View style={[auctionStyles.actionIcon, { backgroundColor: 'rgba(74,222,128,0.12)' }]}>
                <MCIcon name="check-decagram" size={20} color="#4ADE80" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={auctionStyles.actionTitle}>Auction is Over</Text>
                <Text style={auctionStyles.actionSub}>The bidding process has concluded.</Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={auctionStyles.sectionCard}>
            <Text style={auctionStyles.sectionTitle}>Player</Text>
            <TouchableOpacity
              style={[auctionStyles.actionRow, !isAuctionRegistered && regEndPassed && { opacity: 0.6 }]}
              onPress={() => navigation.navigate('AuctionRegistration', { tournamentId: tournament._id })}
              disabled={!isAuctionRegistered && regEndPassed}
            >
              <View style={[
                auctionStyles.actionIcon,
                { backgroundColor: isAuctionRegistered ? 'rgba(74,222,128,0.12)' : (!isAuctionRegistered && regEndPassed ? 'rgba(239,68,68,0.12)' : 'rgba(99,102,241,0.12)') }
              ]}>
                <MCIcon
                  name={isAuctionRegistered ? 'check-circle' : (!isAuctionRegistered && regEndPassed ? 'close-circle' : 'account-plus')}
                  size={20}
                  color={isAuctionRegistered ? '#4ADE80' : (!isAuctionRegistered && regEndPassed ? '#EF4444' : '#818CF8')}
                />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={auctionStyles.actionTitle}>
                  {isAuctionRegistered ? 'You Are Registered' : (regEndPassed ? 'Registration Closed' : 'Register for Auction')}
                </Text>
                <Text style={auctionStyles.actionSub}>
                  {isAuctionRegistered ? 'Tap to view your registration' : (regEndPassed ? 'The deadline has passed' : 'Join the player pool')}
                </Text>
              </View>
              <MCIcon name="chevron-right" size={22} color={Colors.textTertiary} />
            </TouchableOpacity>

            {!isOrganizer && auctionDateReached && (
              <>
                <View style={auctionStyles.divider} />
                <TouchableOpacity
                  style={auctionStyles.actionRow}
                  onPress={() => navigation.navigate('AuctionLivePublic', { auctionId: auctionDetails?._id })}
                >
                  <View style={[auctionStyles.actionIcon, { backgroundColor: 'rgba(234,179,8,0.1)' }]}>
                    <MCIcon name="eye" size={20} color={Colors.warning} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={auctionStyles.actionTitle}>Watch Live Auction</Text>
                    <Text style={auctionStyles.actionSub}>View bids in real-time</Text>
                  </View>
                  <MCIcon name="chevron-right" size={22} color={Colors.textTertiary} />
                </TouchableOpacity>
              </>
            )}
          </View>
        )
        )}
      </ScrollView>
    );
  };

  const hasTournamentStarted = tournament?.startDate ? new Date() >= new Date(tournament.startDate) : true;

  const renderLockedModule = (tabName) => (
    <View style={styles.placeholderContainer}>
      <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center', marginBottom: 20 }}>
        <MCIcon name="lock" size={36} color={Colors.textTertiary} />
      </View>
      <Text style={{ fontSize: 18, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary, marginBottom: 8 }}>{tabName} Locked</Text>
      <Text style={styles.emptyText}>This section will unlock once the tournament starts on {tournament?.startDate ? moment.utc(tournament.startDate).format('DD MMM YYYY') : 'the start date'}.</Text>
    </View>
  );

  const renderActiveTabContent = () => {
    switch (activeTab) {
      case 'Overview': return renderOverview();
      case 'Teams': return renderTeams();
      case 'Auction': return renderAuction();
      case 'Matches': return hasTournamentStarted ? renderMatches() : renderLockedModule('Matches');
      case 'Points Table': return hasTournamentStarted ? renderPointsTable() : renderLockedModule('Points Table');
      case 'Leaderboard': return hasTournamentStarted ? <TournamentLeaderboard tournament={tournament} onShare={setShareData} /> : renderLockedModule('Leaderboard');
      case 'Statistics': return hasTournamentStarted ? <TournamentStatistics tournament={tournament} /> : renderLockedModule('Statistics');
      default: return renderPlaceholder(activeTab);
    }
  };

  const isFollowing = tournament.followers?.includes(user?._id);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.secondary} />
      {/* Modern Header: Blurred Bottom Info Area */}
      <View style={styles.bannerWrapper}>
        <Image
          source={{ uri: tournament.banner ? getImageUrl(tournament.banner) : 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=600&auto=format&fit=crop' }}
          style={styles.banner}
          resizeMode="cover"
        />
        <View style={styles.headerTopBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Icon name="arrow-left" size={20} color={Colors.white} />
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
          <TouchableOpacity onPress={handleShareTournament} style={styles.menuBtn}>
            <Icon name="share-2" size={20} color={Colors.white} />
          </TouchableOpacity>
          {isOrganizer && (
            <TouchableOpacity onPress={() => setShowSettingsSidebar(true)} style={styles.menuBtn}>
              <Icon name="more-vertical" size={20} color={Colors.white} />
            </TouchableOpacity>
          )}
        </View>

        {/* Blurred Info Overlay Trick */}
        <View style={styles.blurredInfoContainer}>
          <Image
            source={{ uri: tournament.banner ? getImageUrl(tournament.banner) : 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=600&auto=format&fit=crop' }}
            style={styles.blurredBannerImage}
            resizeMode="cover"
            blurRadius={35}
          />
          {/* Very light dark tint so white text is readable over bright images, no solid colors */}
          <View style={styles.blurredInfoTint} />

          <View style={styles.headerInfoContent}>
            <Text style={styles.headerTitle} numberOfLines={2}>{tournament.name}</Text>

            {/* Status row */}
            <View style={styles.headerBadgeRow}>
              <View style={styles.statusBadge}>
                <View style={[styles.statusDot, {
                  backgroundColor: tournament.status === 'ongoing' ? Colors.error
                    : tournament.status === 'upcoming' ? Colors.warning
                      : tournament.status === 'completed' ? Colors.success
                        : Colors.primary
                }]} />
                <Text style={styles.statusLabel}>
                  {tournament.status === 'ongoing' ? 'Live'
                    : tournament.status === 'upcoming' ? 'Upcoming'
                      : tournament.status === 'completed' ? 'Completed'
                        : tournament.status}
                </Text>
              </View>
              {isOrganizer && (
                <View style={styles.organizerChip}>
                  <Icon name="shield" size={11} color={Colors.white} />
                  <Text style={styles.organizerChipText}>Organizer</Text>
                </View>
              )}
              <Text style={styles.headerMetaText}>{tournament.overs} Ov  •  {tournament.city}</Text>
              <Text style={styles.headerMetaText}>{tournament.registeredTeams?.length || 0}/{tournament.maxTeams} Teams</Text>
            </View>

            {/* Full-width follow button inside info panel */}
            {!isOrganizer && (
              <TouchableOpacity
                onPress={handleFollowTournament}
                style={[styles.fullWidthFollowBtn, isFollowing && styles.fullWidthFollowBtnActive]}
              >
                <Icon name={isFollowing ? "check" : "user-plus"}
                  size={15} color={isFollowing ? Colors.white : Colors.backgroundElevated} />
                <Text style={[styles.fullWidthFollowText, isFollowing && { color: Colors.white }]}>
                  {isFollowing ? 'Following' : 'Follow'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* Underline-style tabs */}
      <View style={styles.tabsWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScroll}>
          {(() => {
            const isOrganizer = tournament?.organizer?._id === user?._id || tournament?.organizer === user?._id;
            const userTeam = tournament?.teams?.find(
              (t) => t.captain === user?._id || t.owner === user?._id
            );
            const isTeamOwnerOrCaptain = !!userTeam;

            // Hide Auction tab once matches have been played (tournament started)
            const hasMatchesPlayed = (tournament?.matches || []).some(m =>
              ['in_progress', 'toss_done', 'innings_break', 'super_over', 'completed', 'abandoned'].includes(m.status)
            );
            const isAuctionTournament = tournament?.tournamentType === 'Auction';

            let visibleTabs = TABS.filter(tab => {
              if (tab === 'Auction') {
                // Show Auction tab only for Auction tournaments that haven't started playing yet
                return isAuctionTournament && !hasMatchesPlayed;
              }
              return true;
            });

            const auctionDate = tournament?.auctionDate || tournament?.auctionDetails?.auctionDate;
            const auctionDateReached = auctionDate && new Date() >= new Date(auctionDate);

            if (isAuctionTournament && !isOrganizer && !isTeamOwnerOrCaptain) {
              // Public spectators of Auction tournaments see only Overview + Auction (if not started) 
              // UNLESS the auction date has passed, then show all tabs.
              if (!auctionDateReached) {
                visibleTabs = ['Overview', ...(hasMatchesPlayed ? [] : ['Auction'])];
              }
            }

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
                <Icon name="x" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={myTeams}
              keyExtractor={item => item._id}
              style={{ flex: 1, marginTop: Spacing.md }}
              ListEmptyComponent={<Text style={styles.emptyText}>You do not have any teams. Create one first!</Text>}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.teamCard} onPress={() => handleRegisterTeam(item._id)} disabled={actionLoading}>
                  <Image source={{ uri: item.logo ? getImageUrl(item.logo) : 'https://via.placeholder.com/50' }} style={styles.teamLogo} />
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
                    navigation.navigate('TeamCreate');
                  }}
                >
                  <Icon name="plus" size={24} color={Colors.primary} />
                  <Text style={[styles.teamName, { color: Colors.primary, marginLeft: 8 }]}>Create New Team</Text>
                </TouchableOpacity>
              }
            />
          </View>
        </View>
      </Modal>

      {/* Settings Sidebar Modal */}
      <Modal visible={showSettingsSidebar} animationType="fade" transparent>
        <TouchableOpacity style={styles.sidebarOverlay} activeOpacity={1} onPress={() => setShowSettingsSidebar(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.sidebarContent}>
            <Text style={styles.sidebarTitle}>Settings</Text>

            <TouchableOpacity style={styles.sidebarOption} onPress={() => { setShowSettingsSidebar(false); handleShareTournament(); }}>
              <Icon name="share-2" size={20} color={Colors.textPrimary} style={styles.sidebarIcon} />
              <Text style={styles.sidebarOptionText}>Share Tournament</Text>
            </TouchableOpacity>

            {isOrganizer && (
              <TouchableOpacity style={styles.sidebarOption} onPress={() => { setShowSettingsSidebar(false); setShowEditDetailsModal(true); }}>
                <Icon name="settings" size={20} color={Colors.textPrimary} style={styles.sidebarIcon} />
                <Text style={styles.sidebarOptionText}>Edit Tournament Details</Text>
              </TouchableOpacity>
            )}

            {isMainOrganizer && (
              <>
                <TouchableOpacity style={styles.sidebarOption} onPress={() => { setShowSettingsSidebar(false); setRoleType('coOrganizers'); setShowRoleModal(true); }}>
                  <Icon name="users" size={20} color={Colors.textPrimary} style={styles.sidebarIcon} />
                  <Text style={styles.sidebarOptionText}>Manage Organizers</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.sidebarOption} onPress={() => { setShowSettingsSidebar(false); setRoleType('scorers'); setShowRoleModal(true); }}>
                  <Icon name="edit-3" size={20} color={Colors.textPrimary} style={styles.sidebarIcon} />
                  <Text style={styles.sidebarOptionText}>Manage Scorers</Text>
                </TouchableOpacity>
              </>
            )}

          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Fixture Preview Modal */}
      <Modal visible={showFixturePreview} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Fixture Preview</Text>
              <TouchableOpacity onPress={() => setShowFixturePreview(false)}>
                <Icon name="x" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.bodyText, { marginBottom: Spacing.md }]}>
              {tournament?.format?.toLowerCase() === 'knockout'
                ? 'Note: Actual pairings will be randomized upon generation.'
                : 'Note: Teams will be randomized into groups upon generation.'}
            </Text>

            <View style={{ flex: 1, backgroundColor: Colors.backgroundElevated, borderRadius: BorderRadius.md, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border }}>
              <KeyboardAwareScrollView enableOnAndroid={true} extraScrollHeight={20} keyboardShouldPersistTaps="handled">
                <Text style={[styles.bodyText, { color: Colors.textPrimary, lineHeight: 22 }]}>
                  {generatePreviewText()}
                </Text>
              </KeyboardAwareScrollView>
            </View>

            <View style={{ flexDirection: 'row', marginTop: Spacing.lg }}>
              <TouchableOpacity style={[styles.actionBtn, { flex: 1, backgroundColor: Colors.backgroundElevated, borderWidth: 1, borderColor: Colors.border, marginRight: Spacing.sm }]} onPress={() => setShowFixturePreview(false)}>
                <Text style={[styles.actionBtnText, { color: Colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, { flex: 1 }]} onPress={confirmGenerateFixtures} disabled={loading}>
                {loading ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.actionBtnText}>Confirm & Generate</Text>}
              </TouchableOpacity>
            </View>
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
                <Icon name="x" size={24} color={Colors.textSecondary} />
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
                      <Icon name="calendar" size={18} color={Colors.primary} />
                    </View>
                  ) : (
                    <Image source={{ uri: item.logo ? getImageUrl(item.logo) : 'https://via.placeholder.com/40' }} style={{ width: 40, height: 40, borderRadius: 20, marginRight: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }} />
                  )}
                  <Text style={[styles.bodyText, { color: Colors.textPrimary, fontFamily: Typography.fontFamily.bold, fontSize: 15 }]}>
                    {item.name}
                  </Text>
                  <View style={{ flex: 1, alignItems: 'flex-end' }}>
                    <Icon name="chevron-right" size={20} color={Colors.textSecondary} />
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
        title={shareData?.type === 'tournament' ? tournament?.name : shareData?.type === 'fixture' ? 'Match Fixture' : shareData?.type === 'fullSchedule' ? 'Match Schedule' : shareData?.type === 'pointsTable' ? 'Points Table' : 'Leaderboard'}
        shareUrl={`https://sportverse.maazibrahimoo0.workers.dev/tournament/${tournamentId}`}
      >
        {shareData?.type === 'tournament' && <TournamentSummaryPoster tournament={shareData.data} />}
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
        {shareData?.type === 'leaderboard' && <LeaderboardPoster type={shareData.data.type} data={shareData.data.data} tournamentName={tournament?.name} tournamentBanner={tournament?.banner} />}
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

    </SafeAreaView>
  );
};

const auctionStyles = StyleSheet.create({
  heroCard: {
    backgroundColor: Colors.backgroundElevated,
    borderRadius: 16,
    padding: Spacing.lg,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
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
  heroTitle: { fontSize: 16, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary },
  heroSubtitle: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  statusBadgeText: { fontSize: 10, fontFamily: Typography.fontFamily.bold },

  dateRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  dateCard: {
    flex: 1,
    backgroundColor: Colors.backgroundElevated,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 4,
  },
  dateLabel: { fontSize: 11, color: Colors.textTertiary, marginTop: 4 },
  dateValue: { fontSize: 12, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary },
  dateSub: { fontSize: 11, color: Colors.warning, marginTop: 2 },

  sectionCard: {
    backgroundColor: Colors.backgroundElevated,
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.textTertiary,
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
  actionTitle: { fontSize: 14, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary },
  actionSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  divider: { height: 1, backgroundColor: Colors.border, marginHorizontal: Spacing.md },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  /* ---- BANNER + HEADER ---- */
  bannerWrapper: { position: 'relative', backgroundColor: Colors.background, height: 180 },
  banner: { width: '100%', height: '100%', backgroundColor: Colors.backgroundElevated },

  /* Blurred Info Container */
  blurredInfoContainer: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    overflow: 'hidden', // Crops the blurred image exactly to this container
  },
  blurredBannerImage: {
    width: '100%',
    height: 180, // Exact height of bannerWrapper
    position: 'absolute',
    bottom: 0, // Aligns it to the bottom so it perfectly overlaps the main image underneath
  },
  blurredInfoTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.65)', // Darker tint over the blur so white text pops
  },
  headerInfoContent: {
    paddingHorizontal: 16,
    paddingTop: 4, // Make text "a little low"
    paddingBottom: 16,
  },
  /* Top bar: only back button and action buttons */
  headerTopBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingTop: 12, paddingBottom: 8, zIndex: 10
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
  headerTitle: { fontSize: 24, fontWeight: '900', fontFamily: Typography.fontFamily.bold, color: Colors.white, marginBottom: 2, textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  headerMetaText: { fontSize: 13, color: 'rgba(255,255,255,0.85)', fontFamily: Typography.fontFamily.medium },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.4)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  statusDot: { width: 7, height: 7, borderRadius: 3.5 },
  statusLabel: { fontSize: 12, color: Colors.white, fontFamily: Typography.fontFamily.semiBold, letterSpacing: 0.2 },

  headerBadgeRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 4, marginBottom: 12 },
  organizerChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  organizerChipText: { fontSize: 11, color: Colors.white, fontFamily: Typography.fontFamily.semiBold },

  /* Full Width Follow Button */
  fullWidthFollowBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10, borderRadius: 12, backgroundColor: Colors.primary },
  fullWidthFollowBtnActive: { backgroundColor: Colors.error, borderWidth: 0 },
  fullWidthFollowText: { fontSize: 15, fontFamily: Typography.fontFamily.bold, color: Colors.backgroundElevated },

  followBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, borderWidth: 1, borderColor: Colors.primary, backgroundColor: 'rgba(154,188,47,0.15)' },
  followBtnActive: { borderColor: Colors.error, backgroundColor: 'rgba(244,67,54,0.15)' },
  followBtnText: { fontSize: 12, fontFamily: Typography.fontFamily.semiBold, color: Colors.primary },

  /* ---- TABS (underline style) ---- */
  tabsWrapper: { backgroundColor: Colors.backgroundElevated, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tabsScroll: { paddingHorizontal: 4 },
  tabBtn: { paddingVertical: 13, paddingHorizontal: 16, borderBottomWidth: 2.5, borderBottomColor: 'transparent' },
  tabBtnActive: { borderBottomColor: Colors.primary },
  tabText: { color: Colors.textSecondary, fontFamily: Typography.fontFamily.medium, fontSize: 13, letterSpacing: 0.2 },
  tabTextActive: { color: Colors.primary, fontFamily: Typography.fontFamily.bold, fontSize: 13 },

  /* ---- MATCH SUB TABS ---- */
  matchSubTabs: { flexDirection: 'row', marginHorizontal: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border, marginBottom: 12, marginTop: 8 },
  matchSubTab: { flex: 1, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  matchSubTabActive: { borderBottomColor: Colors.primary },
  matchSubTabText: { color: Colors.textSecondary, fontFamily: Typography.fontFamily.medium, fontSize: 13 },
  matchSubTabTextActive: { color: Colors.primary, fontFamily: Typography.fontFamily.bold, fontSize: 13 },
  liveCountBadge: { backgroundColor: Colors.error, borderRadius: 8, minWidth: 16, height: 16, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3 },
  liveCountBadgeActive: { backgroundColor: '#011528' },
  liveCountText: { fontSize: 9, color: Colors.white, fontFamily: Typography.fontFamily.bold },

  /* ---- GENERAL ---- */
  tabContent: { padding: Spacing.md },
  card: { backgroundColor: Colors.backgroundElevated, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: Colors.border },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle: { fontSize: 15, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary },
  bodyText: { color: Colors.textSecondary, fontFamily: Typography.fontFamily.regular, marginBottom: 4 },
  emptyText: { textAlign: 'center', color: Colors.textTertiary, marginTop: 40, fontFamily: Typography.fontFamily.medium },
  placeholderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },

  /* ---- OVERVIEW STATS STRIP ---- */
  statsStrip: { flexDirection: 'row', backgroundColor: Colors.backgroundElevated, borderRadius: 14, marginBottom: 12, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  statBox: { flex: 1, alignItems: 'center', paddingVertical: 14 },
  statNum: { fontSize: 18, fontFamily: Typography.fontFamily.bold, color: Colors.primary },
  statLabel: { fontSize: 11, color: Colors.textTertiary, fontFamily: Typography.fontFamily.medium, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: Colors.border, marginVertical: 10 },

  /* ---- INFO ROW ---- */
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  infoIconWrap: { width: 28, alignItems: 'center' },
  infoLabel: { flex: 1, fontSize: 13, color: Colors.textSecondary, fontFamily: Typography.fontFamily.medium, marginLeft: 4 },
  infoValue: { fontSize: 13, color: Colors.textPrimary, fontFamily: Typography.fontFamily.semiBold },

  /* ---- ORGANIZER ---- */
  organizerRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 12 },
  organizerAvatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: Colors.backgroundElevated, borderWidth: 2, borderColor: Colors.primary },
  organizerBadge: { backgroundColor: Colors.primaryAlpha20, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: Colors.primaryAlpha30 },
  organizerBadgeText: { fontSize: 11, color: Colors.primary, fontFamily: Typography.fontFamily.semiBold },

  /* ---- TEAM CARD & HEADER ---- */
  teamHeaderStrip: {
    flexDirection: 'row',
    backgroundColor: Colors.backgroundElevated,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  teamCountBox: { flex: 1, alignItems: 'center', paddingVertical: 14 },
  teamCountNum: { fontSize: 20, fontFamily: Typography.fontFamily.bold, color: Colors.primary },
  teamCountLabel: { fontSize: 11, color: Colors.textTertiary, fontFamily: Typography.fontFamily.medium, marginTop: 2 },
  teamCountDivider: { width: 1, backgroundColor: Colors.border, marginVertical: 10 },

  /* ---- ORGANIZER ACTION GRID ---- */
  actionGrid: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.backgroundElevated,
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
    backgroundColor: Colors.primaryAlpha10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.primaryAlpha20,
  },
  actionGridText: { fontSize: 11, color: Colors.textSecondary, fontFamily: Typography.fontFamily.medium },

  teamCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.backgroundElevated, paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: Colors.borderLight, gap: 10 },
  teamRankText: { width: 24, fontSize: 12, color: Colors.textTertiary, fontFamily: Typography.fontFamily.bold, textAlign: 'center' },
  teamLogo: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.backgroundElevated, borderWidth: 1.5, borderColor: Colors.border },
  teamName: { fontSize: 15, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary },
  teamSub: { fontSize: 12, color: Colors.textTertiary, fontFamily: Typography.fontFamily.medium },
  removeTeamBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.errorLight, justifyContent: 'center', alignItems: 'center' },

  /* ---- START MATCH BTN ---- */
  startMatchBtn: { flexDirection: 'row', backgroundColor: Colors.primary, paddingVertical: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  startMatchBtnText: { color: '#011528', fontFamily: Typography.fontFamily.bold, fontSize: 14 },

  /* ---- MATCH CARD ---- */
  cardContainer: {
    backgroundColor: Colors.backgroundElevated,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    borderLeftWidth: 3,
    borderLeftColor: Colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  stagePill: {
    fontSize: 10,
    color: Colors.primary,
    fontFamily: Typography.fontFamily.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  cardSubText: {
    fontSize: 11,
    color: Colors.textTertiary,
    fontFamily: Typography.fontFamily.medium,
    letterSpacing: 0.2,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.errorLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.error },
  liveBadgeText: { fontSize: 10, color: Colors.error, fontFamily: Typography.fontFamily.bold, letterSpacing: 0.5 },
  upcomingBadge: { backgroundColor: Colors.warningLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  upcomingBadgeText: { fontSize: 10, color: Colors.warning, fontFamily: Typography.fontFamily.bold, letterSpacing: 0.5 },
  resultBadge: { backgroundColor: Colors.primaryAlpha20, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  resultBadgeText: { fontSize: 10, color: Colors.primary, fontFamily: Typography.fontFamily.bold, letterSpacing: 0.5 },
  vsContainer: { marginBottom: 8 },
  teamScoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
  },
  vsDivider: { height: 1, backgroundColor: Colors.borderLight, marginVertical: 2 },
  teamNameText: {
    fontSize: 14,
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.medium,
    flex: 1,
  },
  winnerTeamText: { color: Colors.primary, fontFamily: Typography.fontFamily.bold },
  scoreText: {
    fontSize: 14,
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.bold,
  },
  overText: {
    fontSize: 11,
    color: Colors.textTertiary,
    fontFamily: Typography.fontFamily.regular,
  },
  matchResultFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  matchResultText: {
    flex: 1,
    fontSize: 12,
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.medium,
  },

  /* ---- POINTS TABLE ---- */
  table: { backgroundColor: Colors.backgroundElevated, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: Colors.border },
  tableRowHeader: { flexDirection: 'row', backgroundColor: Colors.primaryDark, paddingVertical: 10, paddingHorizontal: 8 },
  tableRow: { flexDirection: 'row', paddingVertical: 9, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: Colors.borderLight, alignItems: 'center' },
  tableRowAlt: { backgroundColor: 'rgba(255,255,255,0.02)' },
  tableCell: { flex: 1, color: Colors.textPrimary, fontFamily: Typography.fontFamily.medium, fontSize: 12, textAlign: 'center' },
  tableCellFlex2: { flex: 2 },

  /* ---- ACTIONS ---- */
  actionBtn: { flexDirection: 'row', backgroundColor: Colors.primary, paddingVertical: 10, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.md, alignItems: 'center', justifyContent: 'center' },
  actionBtnText: { color: '#011528', fontFamily: Typography.fontFamily.bold, marginLeft: 6, fontSize: 13 },
  smallActionBtn: { backgroundColor: Colors.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: BorderRadius.sm },
  smallActionBtnText: { color: '#011528', fontFamily: Typography.fontFamily.bold, fontSize: 12 },

  /* ---- MODALS ---- */
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContainer: { backgroundColor: Colors.backgroundElevated, borderTopLeftRadius: 24, borderTopRightRadius: 24, height: '80%', padding: Spacing.lg },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  modalTitle: { fontSize: 18, color: Colors.textPrimary, fontFamily: Typography.fontFamily.bold },

  searchRow: { flexDirection: 'row', alignItems: 'center' },
  searchInput: { flex: 1, backgroundColor: Colors.background, height: 48, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, color: Colors.textPrimary, fontFamily: Typography.fontFamily.medium, borderWidth: 1, borderColor: Colors.border },
  searchBtn: { backgroundColor: Colors.primary, height: 48, width: 48, borderRadius: BorderRadius.md, justifyContent: 'center', alignItems: 'center', marginLeft: Spacing.sm },

  emptySearch: { alignItems: 'center', marginTop: Spacing.xl },
  createGhostBtn: { marginTop: Spacing.lg, padding: Spacing.md, borderColor: Colors.primary, borderWidth: 1, borderRadius: BorderRadius.lg },
  createGhostBtnText: { color: Colors.primary, fontFamily: Typography.fontFamily.bold },

  label: { fontSize: 14, color: Colors.textSecondary, marginBottom: 8, marginTop: Spacing.md, fontFamily: Typography.fontFamily.medium },
  input: { backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, height: 50, color: Colors.textPrimary, fontFamily: Typography.fontFamily.medium },

  /* ---- SIDEBAR ---- */
  sidebarOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-start', alignItems: 'flex-end' },
  sidebarContent: { width: 260, backgroundColor: Colors.backgroundElevated, height: '100%', padding: Spacing.lg, paddingTop: 50, borderLeftWidth: 1, borderLeftColor: Colors.border },
  sidebarTitle: { fontSize: 18, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary, marginBottom: Spacing.lg },
  sidebarOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  sidebarIcon: { marginRight: Spacing.md },
  sidebarOptionText: { fontSize: 15, color: Colors.textPrimary, fontFamily: Typography.fontFamily.medium },

  footerContainer: { padding: Spacing.lg, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.background },
  footerBtn: { backgroundColor: Colors.primary, flexDirection: 'row', height: 52, borderRadius: BorderRadius.lg, justifyContent: 'center', alignItems: 'center' },
  footerBtnText: { color: '#011528', fontSize: 16, fontFamily: Typography.fontFamily.bold, marginLeft: 8 },
});

export default TournamentDetailScreen;
