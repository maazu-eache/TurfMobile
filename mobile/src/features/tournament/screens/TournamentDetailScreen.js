import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Image, FlatList, Share, Modal, TextInput } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import moment from 'moment';
import { Colors, Typography, Spacing, BorderRadius } from '../../../theme/theme';
import api, { getImageUrl, BASE_URL } from '../../../api/axios';
import { useSelector } from 'react-redux';
import io from 'socket.io-client';
import { showCustomAlert } from '../../../components/CustomAlert';
import GroupManagementModal from '../components/GroupManagementModal';
import RoleManagementModal from '../components/RoleManagementModal';
import AddTeamModal from '../components/AddTeamModal';
import EditTournamentModal from '../components/EditTournamentModal';
import FixtureWizardModal from '../components/FixtureWizardModal';
import TournamentStartMatchModal from '../components/TournamentStartMatchModal';
import TournamentLeaderboard from '../components/TournamentLeaderboard';
import TournamentStatistics from '../components/TournamentStatistics';

const TABS = [
  'Overview', 'Matches', 'Teams', 'Points Table',
  'Leaderboard', 'Statistics'
];

const TournamentDetailScreen = ({ route, navigation }) => {
  const { tournamentId } = route.params;
  const [tournament, setTournament] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Overview');
  const [matchSubTab, setMatchSubTab] = useState('Upcoming'); // Upcoming, Live, Past
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

  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [myTeams, setMyTeams] = useState([]);

  // New Management Modals
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showWizardModal, setShowWizardModal] = useState(false);
  const [roleType, setRoleType] = useState('coOrganizers');
  const [showEditDetailsModal, setShowEditDetailsModal] = useState(false);
  const [showStartMatchModal, setShowStartMatchModal] = useState(false);

  useEffect(() => {
    fetchDashboard();
  }, []);

  useEffect(() => {
    let socket;
    if (tournament?.matches && tournament.matches.length > 0) {
      socket = io(BASE_URL, { transports: ['websocket'] });
      
      tournament.matches.forEach(m => {
        if (m.status === 'in_progress' || m.status === 'toss_done' || m.status === 'innings_break') {
          socket.emit('join_match', { matchId: m._id });
        }
      });
      
      socket.on('score_update', (data) => {
        if (data && data.matchId && data.score) {
          setTournament(prev => {
            if (!prev) return prev;
            const updatedMatches = prev.matches.map(m => {
              if (m._id === data.matchId) {
                const newM = { ...m };
                if (data.battingTeam === newM.teamA?._id || data.battingTeam?._id === newM.teamA?._id) {
                  newM.teamAScore = { ...newM.teamAScore, ...data.score };
                } else if (data.battingTeam === newM.teamB?._id || data.battingTeam?._id === newM.teamB?._id) {
                  newM.teamBScore = { ...newM.teamBScore, ...data.score };
                }
                if (data.match) {
                  newM.status = data.match.status;
                }
                return newM;
              }
              return m;
            });
            return { ...prev, matches: updatedMatches };
          });
        }
      });
    }
    
    return () => {
      if (socket) {
        if (tournament?.matches) {
          tournament.matches.forEach(m => {
            socket.emit('leave_match', { matchId: m._id });
          });
        }
        socket.disconnect();
      }
    };
  }, [tournament?.matches?.length]);

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
        const teamB = teams[i+1] ? teams[i+1].team?.name : 'BYE';
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

  const isOrganizer = tournament?.organizer?._id === user?._id || tournament?.coOrganizers?.some(o => o._id === user?._id);
  const isScorer = tournament?.scorers?.some(s => s._id === user?._id);
  const canStartMatch = isOrganizer || isScorer;

  const handleShareTournament = async () => {
    try {
      await Share.share({
        message: `Check out ${tournament.name} on RoughTurf! roughturf://tournament/${tournamentId}`,
      });
    } catch (error) {
      console.log('Error sharing', error);
    }
  };

  const handleShareJoinLink = async () => {
    try {
      await Share.share({
        message: `Join ${tournament.name} on RoughTurf! Click the link to register your team: roughturf://tournament/${tournamentId}`,
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
      fetchDashboard();
    } catch (e) {
      console.log('Error following/unfollowing tournament', e);
    }
  };

  if (loading || !tournament) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </SafeAreaView>
    );
  }

  // --- TAB RENDERERS ---

  const renderOverview = () => (
    <KeyboardAwareScrollView enableOnAndroid={true} extraScrollHeight={20} keyboardShouldPersistTaps="handled" style={styles.tabContent}>
      {/* <View style={styles.card}>
        <Text style={styles.sectionTitle}>Tournament Details</Text>
        {tournament.description ? <Text style={[styles.bodyText, { marginTop: 8, fontStyle: 'italic' }]}>{tournament.description}</Text> : null}
      </View> */}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Tournament Rules</Text>
        {tournament.rules ? (
          <Text style={[styles.bodyText, { marginTop: 8, lineHeight: 22 }]}>{tournament.rules}</Text>
        ) : (
          <Text style={styles.emptyText}>No specific rules mentioned.</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Format & Settings</Text>
        <Text style={styles.bodyText}>Type: {tournament.tournamentType || 'Standard'}</Text>
        <Text style={styles.bodyText}>Format: {tournament.format}</Text>
        <Text style={styles.bodyText}>Ball Type: {tournament.ballType}</Text>
        <Text style={styles.bodyText}>Ground Type: {tournament.groundType}</Text>
        <Text style={styles.bodyText}>Matches: {tournament.overs} Overs</Text>
        <Text style={styles.bodyText}>Teams: {tournament.registeredTeams?.length || 0} / {tournament.maxTeams}</Text>
        <Text style={styles.bodyText}>Players per Team: {tournament.playersPerTeam}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Logistics</Text>
        <Text style={styles.bodyText}>Start Date: {moment(tournament.startDate).format('DD MMM YYYY')}</Text>
        <Text style={styles.bodyText}>City: {tournament.city}</Text>
        {tournament.groundName ? <Text style={styles.bodyText}>Ground Name: {tournament.groundName}</Text> : null}
        <Text style={styles.bodyText}>Entry Fee: ₹{tournament.entryFee || 0}</Text>
      </View>
      
      {tournament.organizer && (
         <View style={styles.card}>
           <Text style={styles.sectionTitle}>Organizer Info</Text>
           <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
             <Image source={{ uri: tournament.organizer.photo ? getImageUrl(tournament.organizer.photo) : 'https://via.placeholder.com/50' }} style={styles.teamLogo} />
             <View>
               <Text style={styles.teamName}>{tournament.organizer.name}</Text>
               <Text style={styles.teamSub}>{tournament.organizer.mobile}</Text>
             </View>
           </View>
         </View>
      )}

      <View style={{ height: 40 }} />
    </KeyboardAwareScrollView>
  );

  const renderTeams = () => (
    <View style={{ flex: 1 }}>
      {isOrganizer && (
        <View style={{ padding: Spacing.md, gap: Spacing.sm }}>
          <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
            <TouchableOpacity style={[styles.actionBtn, { flex: 1, flexDirection: 'row', justifyContent: 'center' }]} onPress={handleGenerateFixtures} disabled={loading}>
              <Icon name="calendar" size={18} color={Colors.white} style={{ marginRight: 6 }} />
              <Text style={styles.actionBtnText}>Fixtures</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, { flex: 1, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, flexDirection: 'row', justifyContent: 'center' }]} onPress={() => setShowGroupModal(true)}>
              <Icon name="layers" size={18} color={Colors.primary} style={{ marginRight: 6 }} />
              <Text style={[styles.actionBtnText, { color: Colors.primary }]}>Groups</Text>
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
            <TouchableOpacity style={[styles.actionBtn, { flex: 1, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, flexDirection: 'row', justifyContent: 'center' }]} onPress={() => setShowAddTeamModal(true)}>
              <Icon name="plus" size={18} color={Colors.primary} style={{ marginRight: 6 }} />
              <Text style={[styles.actionBtnText, { color: Colors.primary }]}>Add Team</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, { flex: 1, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, flexDirection: 'row', justifyContent: 'center' }]} onPress={handleShareJoinLink}>
              <Icon name="link" size={18} color={Colors.primary} style={{ marginRight: 6 }} />
              <Text style={[styles.actionBtnText, { color: Colors.primary }]}>Invite Link</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      <FlatList
        data={tournament.registeredTeams}
        keyExtractor={item => item.team._id}
        contentContainerStyle={styles.tabContent}
        ListEmptyComponent={<Text style={styles.emptyText}>No teams registered yet.</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={[styles.teamCard, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
            onPress={() => navigation.navigate('TeamDetail', { id: item.team._id })}
            activeOpacity={0.7}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <Image source={{ uri: item.team.logo ? getImageUrl(item.team.logo) : 'https://via.placeholder.com/50' }} style={styles.teamLogo} />
              <View>
                <Text style={styles.teamName}>{item.team.name}</Text>
                <Text style={styles.teamSub}>{item.team.city}</Text>
              </View>
            </View>
            {isOrganizer && (
              <TouchableOpacity 
                style={{ padding: Spacing.sm }}
                onPress={() => handleRemoveTeam(item.team._id, item.team.name)}
                disabled={actionLoading}
              >
                <Icon name="trash-2" size={20} color={Colors.error} />
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        )}
      />
    </View>
  );

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

    return (
      <View style={{ flex: 1 }}>
        {isOrganizer && (
          <View style={{ padding: Spacing.md, paddingBottom: 0 }}>
            <TouchableOpacity 
              style={{ backgroundColor: Colors.primary, paddingVertical: 10, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.md, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' }}
              onPress={() => setShowStartMatchModal(true)}
            >
              <Icon name="play-circle" size={18} color={Colors.white} style={{ marginRight: 6 }} />
              <Text style={{ color: Colors.white, fontFamily: Typography.fontFamily.bold, fontSize: 14 }}>Start a Match</Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={styles.matchSubTabs}>
          {['Upcoming', 'Live', 'Past'].map(tab => (
            <TouchableOpacity 
              key={tab} 
              style={[styles.matchSubTab, matchSubTab === tab && styles.matchSubTabActive]}
              onPress={() => setMatchSubTab(tab)}
            >
              <Text style={[styles.matchSubTabText, matchSubTab === tab && styles.matchSubTabTextActive]}>{tab}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <FlatList
          data={filteredMatches}
          keyExtractor={item => item._id}
          contentContainerStyle={styles.tabContent}
          ListEmptyComponent={<Text style={styles.emptyText}>No {matchSubTab.toLowerCase()} matches found.</Text>}
          renderItem={({ item }) => (
          <TouchableOpacity style={styles.cardContainer} activeOpacity={0.9} onPress={() => navigation.navigate('MatchSummary', { matchId: item._id })}>
            <View style={styles.cardHeader}>
              <Text style={styles.tourneyNameText} numberOfLines={1}>{tournament.name} - {item.ground || 'TBD'}</Text>
              {item.status !== 'scheduled' && (
                <View style={[styles.resultBadge, { backgroundColor: ['in_progress', 'toss_done', 'innings_break', 'super_over'].includes(item.status) ? Colors.error : Colors.surface }]}>
                  <Text style={[styles.resultBadgeText, { color: ['in_progress', 'toss_done', 'innings_break', 'super_over'].includes(item.status) ? Colors.white : Colors.textSecondary }]}>
                    {['in_progress', 'toss_done', 'innings_break', 'super_over'].includes(item.status) ? 'LIVE' : 'Result'}
                  </Text>
                </View>
              )}
            </View>
              
              <Text style={styles.cardSubText}>{item.stage ? `${item.stage} | ` : ''}{item.format === 'test' ? 'Test' : item.format === 't20' ? 'T20' : item.format === 'odi' ? 'ODI' : item.format || 'Custom'} | {moment(item.scheduledAt || item.createdAt).format('DD MMM YYYY, hh:mm A').toUpperCase()} | {item.overs} Ov.</Text>
              
              <View style={styles.teamScoreRow}>
                <Text style={[styles.teamNameText, item.status === 'completed' && (item.result?.winner === item.teamA?._id || item.result?.winner?._id === item.teamA?._id) && { color: Colors.primary, fontFamily: Typography.fontFamily.bold }]} numberOfLines={1}>{item.teamA?.name || 'TBD'}</Text>
                <Text style={styles.scoreText}>
                  {item.teamAScore?.runs || 0}/{item.teamAScore?.wickets || 0} <Text style={styles.overText}>({item.teamAScore?.overs || '0.0'} Ov)</Text>
                </Text>
              </View>
              <View style={styles.teamScoreRow}>
                <Text style={[styles.teamNameText, item.status === 'completed' && (item.result?.winner === item.teamB?._id || item.result?.winner?._id === item.teamB?._id) && { color: Colors.primary, fontFamily: Typography.fontFamily.bold }]} numberOfLines={1}>{item.teamB?.name || 'TBD'}</Text>
                <Text style={styles.scoreText}>
                  {item.teamBScore?.runs || 0}/{item.teamBScore?.wickets || 0} <Text style={styles.overText}>({item.teamBScore?.overs || '0.0'} Ov)</Text>
                </Text>
              </View>

              {item.status !== 'completed' && (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                  <Text style={styles.matchStatusText}>
                    {item.status === 'in_progress' 
                      ? 'LIVE' 
                      : item.status === 'scheduled' 
                        ? `SCHEDULED AT ${moment(item.scheduledAt || item.createdAt).format('DD MMM YYYY, hh:mm A').toUpperCase()}` 
                        : item.status === 'abandoned' && item.result?.summary
                          ? item.result.summary.toUpperCase()
                          : item.status.replace('_', ' ').toUpperCase()}
                  </Text>
                  
                  {item.status === 'scheduled' && canStartMatch && (
                    <TouchableOpacity style={{ backgroundColor: Colors.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 }} onPress={() => navigation.navigate('MatchSetup', { matchId: item._id, matchData: item, teamA: item.teamA, teamB: item.teamB })}>
                      <Text style={{ color: Colors.white, fontSize: 12, fontFamily: Typography.fontFamily.bold }}>Start Match</Text>
                    </TouchableOpacity>
                  )}
                </View>
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
          )}
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
        <KeyboardAwareScrollView enableOnAndroid={true} extraScrollHeight={20} keyboardShouldPersistTaps="handled" style={styles.tabContent}>
          {Object.entries(grouped).map(([groupName, rows], gIdx) => (
            <View key={gIdx} style={[styles.table, { marginBottom: Spacing.lg }]}>
              <View style={[styles.tableRowHeader, { backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border }]}>
                <Text style={[styles.sectionTitle, { marginBottom: 0, padding: Spacing.sm }]}>{groupName}</Text>
              </View>
              <View style={styles.tableRowHeader}>
                <Text style={[styles.tableCell, { flex: 2 }]}>Team</Text>
                <Text style={styles.tableCell}>P</Text>
                <Text style={styles.tableCell}>W</Text>
                <Text style={styles.tableCell}>L</Text>
                <Text style={styles.tableCell}>Pts</Text>
                <Text style={styles.tableCell}>NRR</Text>
              </View>
              {rows.map((row, idx) => (
                <View key={idx} style={styles.tableRow}>
                  <Text style={[styles.tableCell, { flex: 2 }]} numberOfLines={1}>
                    {row.team?.name}
                    {row.qualified ? ' (Q)' : ''}
                    {row.eliminated ? ' (E)' : ''}
                  </Text>
                  <Text style={styles.tableCell}>{row.played}</Text>
                  <Text style={styles.tableCell}>{row.won}</Text>
                  <Text style={styles.tableCell}>{row.lost}</Text>
                  <Text style={styles.tableCell}>{row.points}</Text>
                  <Text style={styles.tableCell}>{row.netRunRate?.toFixed(2)}</Text>
                </View>
              ))}
            </View>
          ))}
        </KeyboardAwareScrollView>
      );
    }

    return (
      <KeyboardAwareScrollView enableOnAndroid={true} extraScrollHeight={20} keyboardShouldPersistTaps="handled" style={styles.tabContent}>
        <View style={styles.table}>
          <View style={styles.tableRowHeader}>
            <Text style={[styles.tableCell, { flex: 2 }]}>Team</Text>
            <Text style={styles.tableCell}>P</Text>
            <Text style={styles.tableCell}>W</Text>
            <Text style={styles.tableCell}>L</Text>
            <Text style={styles.tableCell}>Pts</Text>
            <Text style={styles.tableCell}>NRR</Text>
          </View>
          {tournament.pointsTable?.map((row, idx) => (
            <View key={idx} style={styles.tableRow}>
              <Text style={[styles.tableCell, { flex: 2 }]} numberOfLines={1}>
                {row.team?.name}
                {row.qualified ? ' (Q)' : ''}
                {row.eliminated ? ' (E)' : ''}
              </Text>
              <Text style={styles.tableCell}>{row.played}</Text>
              <Text style={styles.tableCell}>{row.won}</Text>
              <Text style={styles.tableCell}>{row.lost}</Text>
              <Text style={styles.tableCell}>{row.points}</Text>
              <Text style={styles.tableCell}>{row.netRunRate?.toFixed(2)}</Text>
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

  const renderActiveTabContent = () => {
    switch (activeTab) {
      case 'Overview': return renderOverview();
      case 'Teams': return renderTeams();
      case 'Matches': return renderMatches();
      case 'Points Table': return renderPointsTable();
      case 'Leaderboard': return <TournamentLeaderboard tournament={tournament} />;
      case 'Statistics': return <TournamentStatistics tournament={tournament} />;
      default: return renderPlaceholder(activeTab);
    }
  };

  const offWhite = 'rgba(255, 255, 255, 0.5)';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={24} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{tournament.name}</Text>
        
        {!isOrganizer && (
          <TouchableOpacity onPress={handleFollowTournament} style={{ padding: 4, marginRight: 8, backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 12, borderRadius: 16 }}>
            <Text style={{ color: Colors.primary, fontWeight: 'bold', fontSize: 13 }}>
              {tournament.followers?.includes(user?._id) ? 'Following' : 'Follow'}
            </Text>
          </TouchableOpacity>
        )}

        {isOrganizer && (
          <TouchableOpacity onPress={() => setShowSettingsSidebar(true)} style={{ padding: 4 }}>
            <Icon name="more-vertical" size={24} color={Colors.white} />
          </TouchableOpacity>
        )}
      </View>

      <Image 
        source={{ uri: tournament.banner ? getImageUrl(tournament.banner) : 'https://via.placeholder.com/400x150' }} 
        style={styles.banner} 
      />

      <View style={styles.tabsWrapper}>
        <KeyboardAwareScrollView enableOnAndroid={true} extraScrollHeight={20} keyboardShouldPersistTaps="handled" horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScroll}>
          {TABS.map((tab) => (
            <TouchableOpacity 
              key={tab}
              style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
            </TouchableOpacity>
          ))}
        </KeyboardAwareScrollView>
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
              <>
                <TouchableOpacity style={styles.sidebarOption} onPress={() => { setShowSettingsSidebar(false); setShowEditDetailsModal(true); }}>
                  <Icon name="settings" size={20} color={Colors.textPrimary} style={styles.sidebarIcon} />
                  <Text style={styles.sidebarOptionText}>Edit Tournament Details</Text>
                </TouchableOpacity>

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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.primary, padding: Spacing.md, paddingHorizontal: Spacing.lg },
  backBtn: { marginRight: Spacing.md },
  headerTitle: { fontSize: 18, fontFamily: Typography.fontFamily.bold, color: Colors.white, flex: 1 },
  banner: { width: '100%', height: 120, backgroundColor: '#333' },
  tabsWrapper: { borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.backgroundElevated },
  tabsScroll: { padding: Spacing.md },
  tabBtn: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: 20, marginRight: Spacing.sm, backgroundColor: Colors.background },
  tabBtnActive: { backgroundColor: Colors.primary },
  tabText: { color: Colors.textSecondary, fontFamily: Typography.fontFamily.medium },
  tabTextActive: { color: Colors.white },
  
  matchSubTabs: { flexDirection: 'row', backgroundColor: Colors.backgroundElevated, borderRadius: 20, margin: Spacing.md, overflow: 'hidden' },
  matchSubTab: { flex: 1, paddingVertical: Spacing.sm, alignItems: 'center' },
  matchSubTabActive: { backgroundColor: Colors.primary },
  matchSubTabText: { color: Colors.textSecondary, fontFamily: Typography.fontFamily.medium, fontSize: 13 },
  matchSubTabTextActive: { color: Colors.white },

  tabContent: { padding: Spacing.lg },
  card: { backgroundColor: Colors.backgroundElevated, borderRadius: BorderRadius.lg, padding: Spacing.lg, marginBottom: Spacing.md },
  sectionTitle: { fontSize: 16, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary, marginBottom: Spacing.sm },
  bodyText: { color: Colors.textSecondary, fontFamily: Typography.fontFamily.regular, marginBottom: 4 },
  emptyText: { textAlign: 'center', color: Colors.textSecondary, marginTop: Spacing.xl, fontFamily: Typography.fontFamily.medium },
  placeholderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  teamCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.backgroundElevated, padding: Spacing.md, borderRadius: BorderRadius.lg, marginBottom: Spacing.sm },
  teamLogo: { width: 50, height: 50, borderRadius: 25, marginRight: Spacing.md, backgroundColor: '#ddd' },
  teamName: { fontSize: 16, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary },
  teamSub: { fontSize: 13, color: Colors.textSecondary },
  
  /* MATCH CARD */
  cardContainer: {
    backgroundColor: Colors.backgroundElevated,
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    elevation: 1,
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
    marginBottom: 4,
  },
  
  table: { backgroundColor: Colors.backgroundElevated, borderRadius: BorderRadius.lg, overflow: 'hidden' },
  tableRowHeader: { flexDirection: 'row', backgroundColor: Colors.primary, padding: Spacing.sm },
  tableRow: { flexDirection: 'row', padding: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tableCell: { flex: 1, color: Colors.textPrimary, fontFamily: Typography.fontFamily.medium, fontSize: 12, textAlign: 'center' },
  
  actionBtn: { flexDirection: 'row', backgroundColor: Colors.primary, paddingVertical: 10, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.md, alignItems: 'center', justifyContent: 'center' },
  actionBtnText: { color: Colors.white, fontFamily: Typography.fontFamily.bold, marginLeft: 6, fontSize: 13 },
  smallActionBtn: { backgroundColor: Colors.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: BorderRadius.sm },
  smallActionBtnText: { color: Colors.white, fontFamily: Typography.fontFamily.bold, fontSize: 12 },

  footerContainer: { padding: Spacing.lg, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.background },
  footerBtn: { backgroundColor: Colors.primary, flexDirection: 'row', height: 52, borderRadius: BorderRadius.lg, justifyContent: 'center', alignItems: 'center' },
  footerBtnText: { color: Colors.white, fontSize: 16, fontFamily: Typography.fontFamily.bold, marginLeft: 8 },

  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContainer: { backgroundColor: Colors.background, borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl, height: '80%', padding: Spacing.lg },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  modalTitle: { fontSize: 18, color: Colors.textPrimary, fontFamily: Typography.fontFamily.bold },
  
  searchRow: { flexDirection: 'row', alignItems: 'center' },
  searchInput: { flex: 1, backgroundColor: Colors.backgroundElevated, height: 48, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, color: Colors.textPrimary, fontFamily: Typography.fontFamily.medium },
  searchBtn: { backgroundColor: Colors.primary, height: 48, width: 48, borderRadius: BorderRadius.md, justifyContent: 'center', alignItems: 'center', marginLeft: Spacing.sm },
  
  emptySearch: { alignItems: 'center', marginTop: Spacing.xl },
  createGhostBtn: { marginTop: Spacing.lg, padding: Spacing.md, borderColor: Colors.primary, borderWidth: 1, borderRadius: BorderRadius.lg },
  createGhostBtnText: { color: Colors.primary, fontFamily: Typography.fontFamily.bold },
  
  label: { fontSize: 14, color: Colors.textSecondary, marginBottom: 8, marginTop: Spacing.md, fontFamily: Typography.fontFamily.medium },
  input: { backgroundColor: Colors.backgroundElevated, borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, height: 50, color: Colors.textPrimary, fontFamily: Typography.fontFamily.medium },

  sidebarOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-start', alignItems: 'flex-end' },
  sidebarContent: { width: 250, backgroundColor: Colors.backgroundElevated, height: '100%', padding: Spacing.lg, paddingTop: 50 },
  sidebarTitle: { fontSize: 18, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary, marginBottom: Spacing.lg },
  sidebarOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  sidebarIcon: { marginRight: Spacing.md },
  sidebarOptionText: { fontSize: 16, color: Colors.textPrimary, fontFamily: Typography.fontFamily.medium },
});

export default TournamentDetailScreen;
