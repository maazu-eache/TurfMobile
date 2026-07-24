import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, FlatList, Image, KeyboardAvoidingView, Platform } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { Colors, Typography, Spacing, BorderRadius } from '../../../theme/theme';
import api, { getImageUrl } from '../../../api/axios';
import { showCustomAlert } from '../../../components/CustomAlert';
import { launchImageLibrary } from 'react-native-image-picker';
import LocationAutocomplete from '../../../components/LocationAutocomplete';

const TABS = ['Search', 'My Teams', 'Opponents', 'Following'];

const AddTeamModal = ({ visible, onClose, tournamentId, onRefresh, registeredTeams = [] }) => {
  const [activeTab, setActiveTab] = useState('Search');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  
  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  
  const user = useSelector(state => state.auth?.user);
  const [fetchingPlayer, setFetchingPlayer] = useState(false);
  const [playerFoundMsg, setPlayerFoundMsg] = useState('');
  const [playerProfile, setPlayerProfile] = useState(null);

  // Ghost Form State
  const [showGhostForm, setShowGhostForm] = useState(false);
  const [ghostForm, setGhostForm] = useState({ teamName: '', captainName: '', captainMobile: '', city: '', state: '', logo: '' });

  // List States
  const [myTeams, setMyTeams] = useState([]);
  const [opponents, setOpponents] = useState([]);
  const [following, setFollowing] = useState([]);

  useEffect(() => {
    if (visible) {
      if (activeTab === 'My Teams' && myTeams.length === 0) fetchMyTeams();
      if (activeTab === 'Opponents' && opponents.length === 0) fetchOpponents();
      if (activeTab === 'Following' && following.length === 0) fetchFollowing();
    }
  }, [visible, activeTab]);

  useEffect(() => {
    if (!visible) {
      setSearchQuery('');
      setSearchResults([]);
      setGhostForm({ teamName: '', captainName: '', captainMobile: '', city: '', state: '', logo: '' });
      setPlayerFoundMsg('');
      setPlayerProfile(null);
      setShowGhostForm(false);
      setActiveTab('Search');
    }
  }, [visible]);

  useEffect(() => {
    let isMounted = true;
    const checkMobile = async () => {
      if (ghostForm.captainMobile && ghostForm.captainMobile.length === 10) {
        setFetchingPlayer(true);
        try {
          const res = await api.get(`/players/lookup/${ghostForm.captainMobile}`);
          if (res.data?.data?.exists && isMounted) {
            setGhostForm(prev => ({ ...prev, captainName: res.data.data.player.name }));
            setPlayerProfile(res.data.data.player);
            setPlayerFoundMsg('Profile found and name auto-filled.');
          } else if (isMounted) {
            setPlayerFoundMsg('');
            setPlayerProfile(null);
          }
        } catch (e) {
          if (isMounted) {
            setPlayerFoundMsg('');
            setPlayerProfile(null);
          }
        } finally {
          if (isMounted) setFetchingPlayer(false);
        }
      } else {
        if (isMounted) {
          setPlayerFoundMsg('');
          setPlayerProfile(null);
        }
      }
    };
    
    const timeout = setTimeout(checkMobile, 500);
    return () => {
      isMounted = false;
      clearTimeout(timeout);
    };
  }, [ghostForm.captainMobile]);

  const searchTeams = async () => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    setShowGhostForm(false);
    try {
      const res = await api.get(`/teams/search?q=${searchQuery}`);
      setSearchResults(res.data.data);
    } catch (e) {
      showCustomAlert('Error', 'Failed to search teams');
    } finally {
      setLoading(false);
    }
  };

  const fetchMyTeams = async () => {
    setLoading(true);
    try {
      const res = await api.get('/teams/my/teams');
      setMyTeams(res.data.data);
    } catch (e) {
      showCustomAlert('Error', 'Failed to load My Teams');
    } finally {
      setLoading(false);
    }
  };

  const fetchOpponents = async () => {
    setLoading(true);
    try {
      const res = await api.get('/teams/my/opponent-teams');
      setOpponents(res.data.data);
    } catch (e) {
      showCustomAlert('Error', 'Failed to load Opponents');
    } finally {
      setLoading(false);
    }
  };

  const fetchFollowing = async () => {
    setLoading(true);
    try {
      const res = await api.get('/teams/my/following-teams');
      setFollowing(res.data.data);
    } catch (e) {
      showCustomAlert('Error', 'Failed to load Following Teams');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterTeam = async (teamId) => {
    setActionLoading(true);
    try {
      await api.post(`/tournaments/${tournamentId}/register`, { teamId });
      showCustomAlert('Success', 'Team registered successfully!');
      onRefresh();
      onClose();
    } catch (e) {
      showCustomAlert('Error', e.response?.data?.message || 'Failed to register team');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateGhostTeam = async () => {
    if (!ghostForm.teamName || !ghostForm.captainMobile) {
      showCustomAlert('Error', 'Team Name and Captain Mobile are required.');
      return;
    }
    setActionLoading(true);
    try {
      const formData = new FormData();
      formData.append('teamName', ghostForm.teamName);
      formData.append('captainMobile', ghostForm.captainMobile);
      formData.append('captainName', ghostForm.captainName);
      formData.append('city', ghostForm.city);
      formData.append('state', ghostForm.state);
      if (ghostForm.logo && ghostForm.logo.uri) {
        formData.append('logo', {
          uri: ghostForm.logo.uri,
          type: ghostForm.logo.type || 'image/jpeg',
          name: ghostForm.logo.fileName || 'logo.jpg'
        });
      }

      await api.post(`/tournaments/${tournamentId}/add-ghost-team`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      showCustomAlert('Success', 'Ghost team created and registered!');
      onRefresh();
      onClose();
      setShowGhostForm(false);
      setGhostForm({ teamName: '', captainName: '', captainMobile: '', city: '', state: '', logo: '' });
      setPlayerFoundMsg('');
      setPlayerProfile(null);
    } catch (e) {
      showCustomAlert('Error', e.response?.data?.message || 'Failed to create ghost team');
    } finally {
      setActionLoading(false);
    }
  };

  const renderTeamCard = ({ item }) => {
    const isAdded = registeredTeams.some(rt => rt.team?._id === item._id || rt.team === item._id);
    return (
      <View style={styles.teamCard}>
        <Image source={{ uri: item.logo ? getImageUrl(item.logo) : 'https://via.placeholder.com/50' }} style={styles.teamLogo} />
        <View style={{ flex: 1 }}>
          <Text style={styles.teamNameText}>{item.name}</Text>
          <Text style={styles.teamSub}>{item.city || 'No City'} | Capt: {item.captain?.name || 'N/A'}</Text>
        </View>
        {isAdded ? (
          <View style={[styles.smallActionBtn, { backgroundColor: Colors.border }]}>
            <Text style={[styles.smallActionBtnText, { color: Colors.textSecondary }]}>Added</Text>
          </View>
        ) : (
          <TouchableOpacity style={styles.smallActionBtn} onPress={() => handleRegisterTeam(item._id)} disabled={actionLoading}>
            <Text style={styles.smallActionBtnText}>Add</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const getListData = () => {
    if (activeTab === 'My Teams') return myTeams;
    if (activeTab === 'Opponents') return opponents;
    if (activeTab === 'Following') return following;
    return searchResults;
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBg}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Team</Text>
            <TouchableOpacity onPress={onClose}>
              <Icon name="x" size={24} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
          
          {/* Top Tabs */}
          <View style={styles.tabsWrapper}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScroll} keyboardShouldPersistTaps="handled">
              {TABS.map(tab => (
                <TouchableOpacity 
                  key={tab} 
                  style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
                  onPress={() => { setActiveTab(tab); setShowGhostForm(false); }}
                >
                  <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Search Tab Specifics */}
          {activeTab === 'Search' && !showGhostForm && (
            <View style={styles.searchRow}>
              <TextInput 
                style={styles.searchInput}
                placeholder="Search by Mobile or Team Name"
                placeholderTextColor={Colors.textTertiary}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              <TouchableOpacity style={styles.searchBtn} onPress={searchTeams}>
                <Icon name="search" size={20} color={Colors.white} />
              </TouchableOpacity>
            </View>
          )}

          {loading ? (
            <ActivityIndicator color={Colors.primary} style={{ marginTop: 20 }} />
          ) : (
            <>
              {activeTab === 'Search' && showGhostForm ? (
                <ScrollView keyboardShouldPersistTaps="handled" style={{ marginTop: Spacing.md, paddingHorizontal: Spacing.md }}>
                  <Text style={styles.label}>Team Name *</Text>
                  <TextInput style={styles.input} placeholderTextColor={Colors.textTertiary} value={ghostForm.teamName} onChangeText={t => setGhostForm({...ghostForm, teamName: t})} placeholder="New Team Name" />
                  
                  <Text style={styles.label}>Captain Mobile *</Text>
                  <TextInput style={styles.input} keyboardType="phone-pad" placeholderTextColor={Colors.textTertiary} value={ghostForm.captainMobile} onChangeText={t => setGhostForm({...ghostForm, captainMobile: t})} placeholder="e.g. 9876543210" />
                  
                  {fetchingPlayer && <ActivityIndicator size="small" color={Colors.primary} style={{ alignSelf: 'flex-start', marginTop: Spacing.xs }} />}
                  {playerFoundMsg ? <Text style={{ color: Colors.primary, fontSize: 12, marginTop: Spacing.xs }}>{playerFoundMsg}</Text> : null}
                  
                  <TouchableOpacity 
                    style={{ marginTop: Spacing.sm, marginBottom: Spacing.sm, alignSelf: 'flex-start' }} 
                    onPress={() => {
                      setGhostForm({ ...ghostForm, captainName: user?.name || '', captainMobile: user?.mobile || '' });
                      setPlayerProfile({ name: user?.name, photo: user?.photo });
                    }}
                  >
                    <Text style={{ color: Colors.primary, fontFamily: Typography.fontFamily.medium }}>+ Add Myself as Captain</Text>
                  </TouchableOpacity>

                  {playerProfile && (
                    <View style={[styles.teamCard, { marginTop: 0 }]}>
                      <Image source={{ uri: playerProfile.photo ? getImageUrl(playerProfile.photo) : 'https://via.placeholder.com/50' }} style={styles.teamLogo} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.teamNameText}>{playerProfile.name || 'Unknown'}</Text>
                        <Text style={styles.teamSub}>Captain Profile</Text>
                      </View>
                    </View>
                  )}

                  <Text style={styles.label}>Captain Name</Text>
                  <TextInput style={styles.input} placeholderTextColor={Colors.textTertiary} value={ghostForm.captainName} onChangeText={t => setGhostForm({...ghostForm, captainName: t})} placeholder="Captain's Name" />
                  
                  <Text style={styles.label}>City</Text>
                  <LocationAutocomplete
                    value={ghostForm.city}
                    onChangeText={t => setGhostForm({...ghostForm, city: t})}
                    onSelectLocation={(loc) => {
                      setGhostForm(prev => ({ ...prev, city: loc.name, state: loc.state || prev.state }));
                    }}
                  />
                  
                  <Text style={styles.label}>State</Text>
                  <TextInput style={styles.input} placeholderTextColor={Colors.textTertiary} value={ghostForm.state} onChangeText={t => setGhostForm({...ghostForm, state: t})} placeholder="State" />
                  
                  <Text style={styles.label}>Logo</Text>
                  <TouchableOpacity 
                    style={[styles.input, { alignItems: 'center', justifyContent: 'center', padding: Spacing.lg, borderStyle: 'dashed', backgroundColor: Colors.background }]}
                    onPress={async () => {
                      const res = await launchImageLibrary({ mediaType: 'photo', quality: 0.8 });
                      if (res.assets?.length > 0) {
                        const selected = res.assets[0];
                        if (selected.fileSize && selected.fileSize > 1 * 1024 * 1024) {
                          showCustomAlert('File Too Large', 'Please select an image smaller than 1MB.');
                          return;
                        }
                        setGhostForm(prev => ({ ...prev, logo: selected }));
                      }
                    }}
                  >
                    {ghostForm.logo && ghostForm.logo.uri ? (
                      <Image source={{ uri: ghostForm.logo.uri }} style={{ width: 60, height: 60, borderRadius: 30 }} />
                    ) : (
                      <Text style={{ color: Colors.textTertiary, fontFamily: Typography.fontFamily.medium }}>Tap to select team logo</Text>
                    )}
                  </TouchableOpacity>
                  <Text style={{ color: Colors.primary, fontSize: 12, marginTop: 4, fontFamily: Typography.fontFamily.medium }}>
                    Note: Maximum image size allowed is under 1 MB.
                  </Text>

                  <View style={{ flexDirection: 'row', marginTop: Spacing.lg, paddingBottom: 40 }}>
                    <TouchableOpacity style={[styles.actionBtn, { flex: 1, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, marginRight: Spacing.sm }]} onPress={() => setShowGhostForm(false)}>
                      <Text style={[styles.actionBtnText, { color: Colors.textSecondary }]}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionBtn, { flex: 1 }]} onPress={handleCreateGhostTeam} disabled={actionLoading}>
                      {actionLoading ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.actionBtnText}>Create Team</Text>}
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              ) : (
                <FlatList
                  data={getListData()}
                  keyExtractor={item => item._id}
                  style={{ flex: 1, marginTop: Spacing.sm, paddingHorizontal: Spacing.md }}
                  ListEmptyComponent={
                    <View style={styles.emptySearch}>
                      <Text style={styles.emptyText}>
                        {activeTab === 'Search' ? (searchQuery ? 'No teams found.' : 'Search for a team to add.') : `No ${activeTab.toLowerCase()} found.`}
                      </Text>
                      {activeTab === 'Search' ? (
                        <TouchableOpacity style={styles.createGhostBtn} onPress={() => setShowGhostForm(true)}>
                          <Text style={styles.createGhostBtnText}>Create New Team</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  }
                  renderItem={renderTeamCard}
                />
              )}
            </>
          )}

        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContainer: { backgroundColor: Colors.background, borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl, height: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.lg, paddingBottom: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalTitle: { fontSize: 20, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary },
  
  tabsWrapper: { borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.backgroundElevated },
  tabsScroll: { padding: Spacing.md },
  tabBtn: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: 20, marginRight: Spacing.sm, backgroundColor: Colors.background },
  tabBtnActive: { backgroundColor: Colors.primary },
  tabText: { color: Colors.textSecondary, fontFamily: Typography.fontFamily.medium },
  tabTextActive: { color: Colors.white },

  searchRow: { flexDirection: 'row', padding: Spacing.md, paddingBottom: 0 },
  searchInput: { flex: 1, backgroundColor: Colors.backgroundElevated, color: Colors.textPrimary, paddingHorizontal: Spacing.md, height: 44, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border },
  searchBtn: { width: 44, height: 44, backgroundColor: Colors.primary, borderRadius: BorderRadius.md, justifyContent: 'center', alignItems: 'center', marginLeft: Spacing.sm },
  
  emptySearch: { alignItems: 'center', marginTop: Spacing.xl },
  emptyText: { color: Colors.textSecondary, fontFamily: Typography.fontFamily.medium, marginBottom: Spacing.md },
  createGhostBtn: { padding: Spacing.sm, backgroundColor: 'rgba(46, 204, 113, 0.1)', borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.primary },
  createGhostBtnText: { color: Colors.primary, fontFamily: Typography.fontFamily.bold },
  
  teamCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.backgroundElevated, padding: Spacing.md, borderRadius: BorderRadius.lg, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  teamLogo: { width: 50, height: 50, borderRadius: 25, marginRight: Spacing.md, backgroundColor: '#ddd' },
  teamNameText: { fontSize: 16, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary },
  teamSub: { fontSize: 13, color: Colors.textSecondary },
  smallActionBtn: { backgroundColor: Colors.primary, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md },
  smallActionBtnText: { color: Colors.white, fontFamily: Typography.fontFamily.bold, fontSize: 13 },
  
  label: { color: Colors.textSecondary, fontFamily: Typography.fontFamily.medium, marginBottom: Spacing.xs, marginTop: Spacing.sm },
  input: { backgroundColor: Colors.backgroundElevated, color: Colors.textPrimary, padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border },
  actionBtn: { paddingVertical: Spacing.md, borderRadius: BorderRadius.lg, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primary },
  actionBtnText: { color: Colors.white, fontFamily: Typography.fontFamily.bold, fontSize: 16 }
});

export default AddTeamModal;
