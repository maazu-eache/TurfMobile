import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  FlatList,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  Image,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { launchImageLibrary } from 'react-native-image-picker';
import { Colors, Spacing, Typography, BorderRadius } from '../../../theme/theme';
import auctionService from '../../../services/auctionService';
import api, { getImageUrl } from '../../../api/axios';

import { showCustomAlert } from '../../../components/CustomAlert';
import AuctionFinanceTab from '../components/AuctionFinanceTab';

const ROLES = ['All Rounder', 'Batsman', 'Bowler', 'Wicket Keeper'];
const BATTING_STYLES = ['Right Handed', 'Left Handed'];
const BOWLING_STYLES = ['Right Arm Medium', 'Right Arm Fast', 'Left Arm Medium', 'Left Arm Fast', 'Spin'];

const AuctionCreateSetsScreen = ({ route, navigation }) => {
  const { auctionId: routeAuctionId, tournamentId, isReadOnly, showFinanceForOrganizer } = route.params || {};
  const [targetAuctionId, setTargetAuctionId] = useState(routeAuctionId);

  const mode = route.params?.mode || 'registrations';
  const [activeTab, setActiveTab] = useState(mode === 'sets' ? 'create_sets' : 'registered'); // 'registered' | 'create_sets' | 'sets' | 'finance'
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [registrations, setRegistrations] = useState([]);
  const [sets, setSets] = useState([]);

  // Manual Add Player Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [phoneInput, setPhoneInput] = useState('');
  const [lookingUp, setLookingUp] = useState(false);
  const [lookupMessage, setLookupMessage] = useState('');

  const [playerForm, setPlayerForm] = useState({
    fullName: '',
    role: 'All Rounder',
    battingStyle: 'Right Handed',
    bowlingStyle: 'Right Arm Medium',
    experience: '1-3 Years',
    photo: null,
    foundUser: null,
  });

  // Create Sets Controls
  const [numSets, setNumSets] = useState(5);
  const [playersPerSet, setPlayersPerSet] = useState(24);
  const [basePrice, setBasePrice] = useState('1000');
  const [teamPurse, setTeamPurse] = useState('50000');
  const [strategy, setStrategy] = useState('mixture');
  const [showSetPlayersModal, setShowSetPlayersModal] = useState(false);
  const [selectedSetPlayers, setSelectedSetPlayers] = useState([]);

  useEffect(() => {
    loadData();
  }, [tournamentId, routeAuctionId]);

  const loadData = async () => {
    setLoading(true);
    try {
      let activeId = targetAuctionId;
      if (!activeId && tournamentId) {
        const detailsRes = await auctionService.getAuctionDetails(tournamentId);
        if (detailsRes.data && detailsRes.data._id) {
          activeId = detailsRes.data._id;
          setTargetAuctionId(activeId);
        }
      }
      if (activeId) {
        const regRes = await auctionService.getRegistrations(activeId);
        setRegistrations(regRes.data || []);

        const setsRes = await auctionService.getSets(activeId);
        setSets(setsRes.data || []);
      }
    } catch (err) {
      console.log('Error loading set data:', err);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [targetAuctionId, tournamentId]);

  useEffect(() => {
    let isMounted = true;
    const checkMobile = async () => {
      if (phoneInput && phoneInput.length === 10) {
        setLookingUp(true);
        setLookupMessage('');
        try {
          const res = await api.get(`/users/lookup/${phoneInput}`);
          if (res.data?.data?.user && isMounted) {
            const u = res.data.data.user;
            const photoUrl = u.avatar ? getImageUrl(u.avatar) : (u.photo ? getImageUrl(u.photo) : null);
            const userRole = u.playingRole || u.role;
            setPlayerForm(f => ({
              ...f,
              fullName: u.name || f.fullName,
              role: userRole && ROLES.includes(userRole) ? userRole : f.role,
              battingStyle: u.battingStyle && BATTING_STYLES.includes(u.battingStyle) ? u.battingStyle : f.battingStyle,
              bowlingStyle: u.bowlingStyle || f.bowlingStyle,
              photo: photoUrl ? { uri: photoUrl } : f.photo,
              foundUser: u,
            }));
            setLookupMessage('Player found and details auto-filled.');
          } else if (isMounted) {
            setLookupMessage('Player not found. Please fill in details manually.');
          }
        } catch (e) {
          if (isMounted) {
            setLookupMessage('Player not found. Please fill in details manually.');
          }
        } finally {
          if (isMounted) setLookingUp(false);
        }
      } else {
        if (isMounted) setLookupMessage('');
      }
    };
    
    const timeout = setTimeout(checkMobile, 500);
    return () => {
      isMounted = false;
      clearTimeout(timeout);
    };
  }, [phoneInput]);

  const handlePickPhoto = () => {
    launchImageLibrary({ mediaType: 'photo', quality: 0.8 }, (response) => {
      if (response.didCancel) return;
      if (response.errorMessage) {
        showCustomAlert('Error', response.errorMessage);
        return;
      }
      if (response.assets && response.assets.length > 0) {
        const selected = response.assets[0];
        if (selected.fileSize && selected.fileSize > 3 * 1024 * 1024) {
          showCustomAlert('File Too Large', 'Please select an image smaller than 3MB.');
          return;
        }
        setPlayerForm(f => ({ ...f, photo: selected }));
      }
    });
  };

  const handleSubmitManualPlayer = async () => {
    if (!playerForm.fullName.trim()) {
      showCustomAlert('Error', 'Please enter player full name');
      return;
    }

    const submitMobile = phoneInput;

    if (!submitMobile || submitMobile.length < 10) {
      showCustomAlert('Error', 'Please enter a valid 10-digit mobile number');
      return;
    }
    if (!playerForm.photo) {
      showCustomAlert('Error', 'Player photo is required');
      return;
    }

    let activeId = targetAuctionId;
    if (!activeId && tournamentId) {
      try {
        const detailsRes = await auctionService.getAuctionDetails(tournamentId);
        if (detailsRes.data && detailsRes.data._id) {
          activeId = detailsRes.data._id;
          setTargetAuctionId(activeId);
        }
      } catch (e) { }
    }

    if (!activeId) {
      showCustomAlert('Error', 'Auction profile not found for this tournament');
      return;
    }

    setLoading(true);
    try {
      const data = new FormData();
      data.append('fullName', playerForm.fullName.trim());
      data.append('role', playerForm.role);
      data.append('battingStyle', playerForm.battingStyle);
      data.append('bowlingStyle', playerForm.bowlingStyle);
      data.append('experience', playerForm.experience);
      data.append('mobileNumber', submitMobile);

      if (playerForm.photo?.uri) {
        data.append('photo', {
          uri: playerForm.photo.uri,
          type: playerForm.photo.type || 'image/jpeg',
          name: playerForm.photo.fileName || 'photo.jpg',
        });
      }

      await auctionService.manualRegisterPlayer(activeId, data);

      showCustomAlert('Success', `${playerForm.fullName} added successfully to auction pool!`);
      setShowAddModal(false);
      // Reset form
      setPlayerForm({
        fullName: '',
        role: 'All Rounder',
        battingStyle: 'Right Handed',
        bowlingStyle: 'Right Arm Medium',
        experience: '1-3 Years',
        photo: null,
        foundUser: null,
      });
      setPhoneInput('');
      loadData();
    } catch (err) {
      showCustomAlert('Error', err.response?.data?.message || 'Failed to add player');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSets = async () => {
    let activeId = targetAuctionId;
    if (!activeId && tournamentId) {
      try {
        const detailsRes = await auctionService.getAuctionDetails(tournamentId);
        if (detailsRes.data && detailsRes.data._id) {
          activeId = detailsRes.data._id;
          setTargetAuctionId(activeId);
        }
      } catch (e) { }
    }

    if (registrations.length === 0) {
      showCustomAlert('No Players', 'There are no registered players to create sets.');
      return;
    }
    setLoading(true);
    try {
      await auctionService.generateSets(activeId, playersPerSet, Number(basePrice) || 0, Number(teamPurse) || 0, strategy);
      await loadData();
      showCustomAlert('Success', 'Sets generated successfully!');
      setActiveTab('sets');
    } catch (err) {
      showCustomAlert('Error', err.response?.data?.message || 'Failed to generate sets');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Compact Top Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 4 }}>
          <Icon name="arrow-left" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={styles.headerTitle}>
            {mode === 'sets' ? 'Create & Manage Sets' : 'Manage Registrations'}
          </Text>
        </View>
        <TouchableOpacity onPress={onRefresh} style={{ padding: 4 }}>
          <Icon name="refresh" size={22} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Top Segment Control */}
      <View style={styles.tabRow}>
        {!isReadOnly && mode === 'registrations' && (
          <>
            <TouchableOpacity style={[styles.tabBtn, activeTab === 'registered' && styles.tabBtnActive]} onPress={() => setActiveTab('registered')}>
              <Icon name="account-group" size={14} color={activeTab === 'registered' ? Colors.primary : Colors.textTertiary} style={{ marginRight: 4 }} />
              <Text style={[styles.tabText, activeTab === 'registered' && styles.tabTextActive]}>Players ({registrations.length})</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.tabBtn, activeTab === 'finance' && styles.tabBtnActive]} onPress={() => setActiveTab('finance')}>
              <Icon name="cash-multiple" size={14} color={activeTab === 'finance' ? Colors.primary : Colors.textTertiary} style={{ marginRight: 4 }} />
              <Text style={[styles.tabText, activeTab === 'finance' && styles.tabTextActive]}>Finance</Text>
            </TouchableOpacity>
          </>
        )}

        {!isReadOnly && mode === 'sets' && (
          <>
            <TouchableOpacity style={[styles.tabBtn, activeTab === 'create_sets' && styles.tabBtnActive]} onPress={() => setActiveTab('create_sets')}>
              <Icon name="cards-outline" size={14} color={activeTab === 'create_sets' ? Colors.primary : Colors.textTertiary} style={{ marginRight: 4 }} />
              <Text style={[styles.tabText, activeTab === 'create_sets' && styles.tabTextActive]}>Create Sets</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.tabBtn, activeTab === 'sets' && styles.tabBtnActive]} onPress={() => setActiveTab('sets')}>
              <Icon name="view-list" size={14} color={activeTab === 'sets' ? Colors.primary : Colors.textTertiary} style={{ marginRight: 4 }} />
              <Text style={[styles.tabText, activeTab === 'sets' && styles.tabTextActive]}>Sets ({sets.length})</Text>
            </TouchableOpacity>
          </>
        )}

        {isReadOnly && (
          <>
            <TouchableOpacity style={[styles.tabBtn, activeTab === 'registered' && styles.tabBtnActive]} onPress={() => setActiveTab('registered')}>
              <Icon name="account-group" size={14} color={activeTab === 'registered' ? Colors.primary : Colors.textTertiary} style={{ marginRight: 4 }} />
              <Text style={[styles.tabText, activeTab === 'registered' && styles.tabTextActive]}>Players ({registrations.length})</Text>
            </TouchableOpacity>
            
            {showFinanceForOrganizer ? (
              <TouchableOpacity style={[styles.tabBtn, activeTab === 'finance' && styles.tabBtnActive]} onPress={() => setActiveTab('finance')}>
                <Icon name="cash-multiple" size={14} color={activeTab === 'finance' ? Colors.primary : Colors.textTertiary} style={{ marginRight: 4 }} />
                <Text style={[styles.tabText, activeTab === 'finance' && styles.tabTextActive]}>Finance</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={[styles.tabBtn, activeTab === 'sets' && styles.tabBtnActive]} onPress={() => setActiveTab('sets')}>
                <Icon name="view-list" size={14} color={activeTab === 'sets' ? Colors.primary : Colors.textTertiary} style={{ marginRight: 4 }} />
                <Text style={[styles.tabText, activeTab === 'sets' && styles.tabTextActive]}>Sets ({sets.length})</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>

      {/* Tab 1: Registered Players */}
      {activeTab === 'registered' && (
        <View style={{ flex: 1 }}>
          {!isReadOnly && (
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => setShowAddModal(true)}
            >
              <Icon name="account-plus" size={18} color={Colors.white} />
              <Text style={styles.addBtnText}>ADD PLAYER MANUALLY</Text>
            </TouchableOpacity>
          )}

          <FlatList
            data={registrations}
            keyExtractor={(item) => item._id}
            contentContainerStyle={{ paddingHorizontal: Spacing.md, paddingBottom: 100, paddingTop: Spacing.md }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
            renderItem={({ item, index }) => (
              <View style={styles.playerCard}>
                <View style={styles.playerIndex}>
                  <Text style={styles.playerIndexText}>{index + 1}</Text>
                </View>
                {item.photo ? (
                  <Image source={{ uri: getImageUrl(item.photo) }} style={styles.avatarImg} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Icon name="account" size={22} color={Colors.primary} />
                  </View>
                )}
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.playerName}>{item.fullName}</Text>
                  <Text style={styles.playerRole}>{item.role}</Text>
                  <Text style={styles.playerSub}>{item.battingStyle || 'Right Handed'} | {item.bowlingStyle || 'Medium'}</Text>
                </View>
                <View style={styles.paidChip}>
                  <Icon name="check-circle" size={10} color="#4ADE80" style={{ marginRight: 3 }} />
                  <Text style={styles.paidText}>OK</Text>
                </View>
              </View>
            )}
            ListEmptyComponent={
              <View style={styles.emptyBox}>
                <Icon name="account-group-outline" size={56} color={Colors.textTertiary} />
                <Text style={styles.emptyTitle}>No Players Yet</Text>
                <Text style={styles.emptyText}>Add players manually or ask them to register.</Text>
              </View>
            }
          />
        </View>
      )}

      {/* Tab 2: Create Sets Controls */}
      {activeTab === 'create_sets' && (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        >
          {/* Stats Banner */}
          <View style={styles.statsBanner}>
            <View style={styles.statsBannerItem}>
              <Icon name="account-group" size={20} color={Colors.primary} />
              <Text style={styles.statsBannerNum}>{registrations.length}</Text>
              <Text style={styles.statsBannerLbl}>Total Players</Text>
            </View>
            <View style={styles.statsBannerDivider} />
            <View style={styles.statsBannerItem}>
              <Icon name="cards" size={20} color="#818CF8" />
              <Text style={[styles.statsBannerNum, { color: '#818CF8' }]}>{Math.ceil(registrations.length / (parseInt(playersPerSet) || 1)) || 0}</Text>
              <Text style={styles.statsBannerLbl}>Sets to Create</Text>
            </View>
            <View style={styles.statsBannerDivider} />
            <View style={styles.statsBannerItem}>
              <Icon name="account-multiple" size={20} color="#F59E0B" />
              <Text style={[styles.statsBannerNum, { color: '#F59E0B' }]}>{playersPerSet || 0}</Text>
              <Text style={styles.statsBannerLbl}>Per Set</Text>
            </View>
          </View>

          {/* Strategy Card */}
          <View style={styles.configSection}>
            <View style={styles.configSectionHeader}>
              <View style={styles.configStepBadge}><Text style={styles.configStepNum}>1</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.configSectionTitle}>Set Generation Strategy</Text>
                <Text style={styles.configSectionSub}>Choose how players are distributed into sets</Text>
              </View>
            </View>
            <View style={styles.strategyRow}>
              <TouchableOpacity
                style={[styles.strategyCard, strategy === 'mixture' && styles.strategyCardActive]}
                onPress={() => setStrategy('mixture')}
              >
                <View style={[styles.strategyIconBox, strategy === 'mixture' && { backgroundColor: Colors.primary + '22' }]}>
                  <Icon name="shuffle-variant" size={22} color={strategy === 'mixture' ? Colors.primary : Colors.textTertiary} />
                </View>
                <Text style={[styles.strategyTitle, strategy === 'mixture' && { color: Colors.primary }]}>Random Mixture</Text>
                <Text style={styles.strategyDesc}>Players are shuffled{`\n`}and grouped randomly</Text>
                {strategy === 'mixture' && (
                  <View style={styles.strategyCheck}>
                    <Icon name="check-circle" size={16} color={Colors.primary} />
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.strategyCard, strategy === 'role_wise' && styles.strategyCardActive]}
                onPress={() => setStrategy('role_wise')}
              >
                <View style={[styles.strategyIconBox, strategy === 'role_wise' && { backgroundColor: '#818CF822' }]}>
                  <Icon name="account-group" size={22} color={strategy === 'role_wise' ? '#818CF8' : Colors.textTertiary} />
                </View>
                <Text style={[styles.strategyTitle, strategy === 'role_wise' && { color: '#818CF8' }]}>Role Wise</Text>
                <Text style={styles.strategyDesc}>Batsmen, Bowlers{`\n`}grouped by role</Text>
                {strategy === 'role_wise' && (
                  <View style={[styles.strategyCheck, { backgroundColor: '#818CF822', borderColor: '#818CF8' }]}>
                    <Icon name="check-circle" size={16} color="#818CF8" />
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Players Per Set Card */}
          <View style={styles.configSection}>
            <View style={styles.configSectionHeader}>
              <View style={styles.configStepBadge}><Text style={styles.configStepNum}>2</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.configSectionTitle}>Players in Each Set</Text>
                <Text style={styles.configSectionSub}>How many players per auction set?</Text>
              </View>
            </View>
            <View style={styles.counterRow}>
              <TouchableOpacity style={styles.counterBtn} onPress={() => setPlayersPerSet(Math.max(1, (parseInt(playersPerSet) || 0) - 1))}>
                <Text style={styles.counterBtnText}>−</Text>
              </TouchableOpacity>
              <View style={styles.counterValBox}>
                <TextInput
                  style={styles.counterVal}
                  keyboardType="number-pad"
                  value={String(playersPerSet)}
                  onChangeText={(val) => {
                    const num = parseInt(val.replace(/[^0-9]/g, ''), 10);
                    const maxPlayers = registrations.length > 0 ? registrations.length : 999;
                    if (!isNaN(num)) { setPlayersPerSet(Math.min(num, maxPlayers)); }
                    else if (val === '') { setPlayersPerSet(''); }
                  }}
                />
              </View>
              <TouchableOpacity style={styles.counterBtn} onPress={() => {
                const maxPlayers = registrations.length > 0 ? registrations.length : 999;
                setPlayersPerSet(Math.min(maxPlayers, (parseInt(playersPerSet) || 0) + 1));
              }}>
                <Text style={styles.counterBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Financial Config Card */}
          <View style={styles.configSection}>
            <View style={styles.configSectionHeader}>
              <View style={styles.configStepBadge}><Text style={styles.configStepNum}>3</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.configSectionTitle}>Financial Settings</Text>
                <Text style={styles.configSectionSub}>Set base price and team auction budget</Text>
              </View>
            </View>
            <View style={styles.financialRow}>
              <View style={styles.financialField}>
                <View style={styles.financialIcon}>
                  <Icon name="currency-inr" size={16} color={Colors.primary} />
                </View>
                <Text style={styles.financialLabel}>Base Price (Pts)</Text>
                <TextInput
                  style={styles.financialInput}
                  placeholder="e.g. 1000"
                  placeholderTextColor={Colors.textTertiary}
                  keyboardType="number-pad"
                  value={basePrice}
                  onChangeText={setBasePrice}
                />
              </View>
              <View style={styles.financialField}>
                <View style={[styles.financialIcon, { backgroundColor: 'rgba(245,158,11,0.12)' }]}>
                  <Icon name="wallet" size={16} color="#F59E0B" />
                </View>
                <Text style={styles.financialLabel}>Team Purse (Pts)</Text>
                <TextInput
                  style={styles.financialInput}
                  placeholder="e.g. 50000"
                  placeholderTextColor={Colors.textTertiary}
                  keyboardType="number-pad"
                  value={teamPurse}
                  onChangeText={setTeamPurse}
                />
              </View>
            </View>
          </View>

          {/* Summary + Generate */}
          <View style={styles.generateSummaryBox}>
            <Icon name="information-outline" size={14} color={Colors.textTertiary} style={{ marginRight: 6 }} />
            <Text style={styles.generateSummaryText}>
              {registrations.length} players → {Math.ceil(registrations.length / (parseInt(playersPerSet) || 1)) || 0} sets of ~{playersPerSet || 0} each
              {strategy === 'role_wise' ? ' (grouped by role)' : ' (random mix)'}
            </Text>
          </View>

          <TouchableOpacity style={styles.generateBtn} onPress={handleCreateSets} disabled={loading}>
            {loading ? <ActivityIndicator color="#000" /> : (
              <>
                <Icon name="auto-fix" size={20} color="#000" style={{ marginRight: 8 }} />
                <Text style={styles.generateBtnText}>GENERATE SETS NOW</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* Tab 3: Sets Overview */}
      {activeTab === 'sets' && (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: Spacing.md, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        >
          {sets.length === 0 ? (
            <View style={styles.emptyBox}>
              <Icon name="cards-outline" size={64} color={Colors.textTertiary} />
              <Text style={styles.emptyTitle}>No Sets Generated</Text>
              <Text style={styles.emptyText}>Go to the "Create Sets" tab{`\n`}to generate auction sets.</Text>
            </View>
          ) : (
            <>
              {/* Sets Summary Header */}
              <View style={styles.setsHeader}>
                <View style={styles.setsHeaderStat}>
                  <Text style={styles.setsHeaderNum}>{sets.length}</Text>
                  <Text style={styles.setsHeaderLbl}>Total Sets</Text>
                </View>
                <View style={styles.setsHeaderStat}>
                  <Text style={[styles.setsHeaderNum, { color: '#4ADE80' }]}>{sets.filter(s => s.status === 'completed').length}</Text>
                  <Text style={styles.setsHeaderLbl}>Completed</Text>
                </View>
                <View style={styles.setsHeaderStat}>
                  <Text style={[styles.setsHeaderNum, { color: '#F59E0B' }]}>{sets.filter(s => s.status === 'in_progress').length}</Text>
                  <Text style={styles.setsHeaderLbl}>In Progress</Text>
                </View>
                <View style={styles.setsHeaderStat}>
                  <Text style={[styles.setsHeaderNum, { color: '#818CF8' }]}>{sets.filter(s => s.status === 'not_started').length}</Text>
                  <Text style={styles.setsHeaderLbl}>Pending</Text>
                </View>
              </View>

              {sets.map((set, si) => {
                const totalPlayers = set.totalPlayersCount || set.players?.length || 0;
                const auctioned = set.auctionedCount || 0;
                const progress = totalPlayers > 0 ? (auctioned / totalPlayers) : 0;
                const statusColor = set.status === 'completed' ? '#4ADE80' : set.status === 'in_progress' ? '#F59E0B' : '#818CF8';
                const statusBg = set.status === 'completed' ? 'rgba(74,222,128,0.1)' : set.status === 'in_progress' ? 'rgba(245,158,11,0.1)' : 'rgba(129,140,248,0.1)';
                const statusIcon = set.status === 'completed' ? 'check-circle' : set.status === 'in_progress' ? 'play-circle' : 'clock-outline';
                const statusLabel = set.status === 'completed' ? 'Completed' : set.status === 'in_progress' ? 'In Progress' : 'Not Started';

                return (
                  <View key={set._id} style={styles.setCard}>
                    {/* Set Card Header */}
                    <TouchableOpacity
                      onPress={() => { setSelectedSetPlayers(set.players || []); setShowSetPlayersModal(true); }}
                      disabled={isReadOnly && set.status !== 'in_progress'}
                      style={[styles.setCardInner, isReadOnly && set.status !== 'in_progress' && { opacity: 0.6 }]}
                    >
                      {/* Left: Set Number Circle */}
                      <View style={[styles.setNumCircle, { backgroundColor: statusBg, borderColor: statusColor + '60' }]}>
                        <Text style={[styles.setNumText, { color: statusColor }]}>{si + 1}</Text>
                      </View>

                      {/* Middle: Set Info */}
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={styles.setCardName}>{set.setName}</Text>
                        <Text style={styles.setCardSub}>{totalPlayers} Players · {auctioned} Auctioned</Text>

                        {/* Progress Bar */}
                        <View style={styles.setProgressBg}>
                          <View style={[styles.setProgressFill, { width: `${Math.min(progress * 100, 100)}%`, backgroundColor: statusColor }]} />
                        </View>
                      </View>

                      {/* Right: Status Badge */}
                      <View style={[styles.setStatusBadge, { backgroundColor: statusBg, borderColor: statusColor + '40' }]}>
                        <Icon name={statusIcon} size={12} color={statusColor} />
                        <Text style={[styles.setStatusText, { color: statusColor }]}>{statusLabel}</Text>
                      </View>

                      {isReadOnly && set.status !== 'in_progress'
                        ? <Icon name="lock-outline" size={18} color={Colors.textTertiary} style={{ marginLeft: 8 }} />
                        : <Icon name="chevron-right" size={18} color={Colors.textTertiary} style={{ marginLeft: 8 }} />
                      }
                    </TouchableOpacity>

                    {/* Player List inside set (for organiser view) */}
                    {set.players && set.players.length > 0 && !(isReadOnly && set.status !== 'in_progress') && (
                      <View style={styles.setPlayersList}>
                        {set.players.slice(0, 5).map((p, idx) => (
                          <View key={p._id || `p-${idx}`} style={styles.miniPlayerRow}>
                            <View style={styles.miniIdx}><Text style={styles.miniIdxText}>{idx + 1}</Text></View>
                            <Text style={styles.miniPlayerName} numberOfLines={1}>{p.fullName}</Text>
                            <View style={[styles.miniRoleTag, {
                              backgroundColor: p.role === 'Batsman' ? 'rgba(59,130,246,0.12)'
                                : p.role === 'Bowler' ? 'rgba(239,68,68,0.12)'
                                : p.role === 'Wicket Keeper' ? 'rgba(245,158,11,0.12)'
                                : 'rgba(154,188,47,0.12)'
                            }]}>
                              <Text style={[styles.miniRoleText, {
                                color: p.role === 'Batsman' ? '#3B82F6'
                                  : p.role === 'Bowler' ? '#EF4444'
                                  : p.role === 'Wicket Keeper' ? '#F59E0B'
                                  : Colors.primary
                              }]}>{p.role}</Text>
                            </View>
                          </View>
                        ))}
                        {set.players.length > 5 && (
                          <Text style={styles.morePlayersText}>+{set.players.length - 5} more players · tap to view all</Text>
                        )}
                      </View>
                    )}
                  </View>
                );
              })}
            </>
          )}
        </ScrollView>
      )}

      {/* Tab 4: Finance */}
      {activeTab === 'finance' && (
        <AuctionFinanceTab auctionId={targetAuctionId} navigation={navigation} />
      )}

      {/* Modal: Add Player Manually */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Player Manually</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Icon name="close" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ paddingVertical: 10 }}>
              <View style={{ marginBottom: 15 }}>
                <Text style={styles.label}>Player Mobile Number *</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    placeholder="Enter 10-digit mobile"
                    placeholderTextColor={Colors.textTertiary}
                    keyboardType="phone-pad"
                    value={phoneInput}
                    onChangeText={setPhoneInput}
                    maxLength={10}
                  />
                  <View style={styles.lookupBtn}>
                    {lookingUp ? <ActivityIndicator color="#000" size="small" /> : <Icon name="check-circle" color={phoneInput.length === 10 ? '#000' : Colors.textTertiary} size={20} />}
                  </View>
                </View>
                {lookupMessage ? <Text style={{ color: Colors.primary, fontSize: 12, marginTop: 8, fontFamily: Typography.fontFamily.medium }}>{lookupMessage}</Text> : null}
              </View>

              {/* Player Photo */}
              <View style={{ alignItems: 'center', marginVertical: 10 }}>
                <TouchableOpacity onPress={handlePickPhoto} style={styles.photoBox}>
                  {playerForm.photo ? (
                    <Image source={playerForm.photo} style={styles.photoImg} />
                  ) : (
                    <View style={{ alignItems: 'center' }}>
                      <Icon name="camera-plus" size={28} color={Colors.primary} />
                      <Text style={{ color: Colors.textSecondary, fontSize: 10, marginTop: 4 }}>Add Photo</Text>
                    </View>
                  )}
                </TouchableOpacity>
                <Text style={{ color: Colors.textSecondary, fontSize: 12, marginTop: 8 }}>Max 3 MB</Text>
              </View>

              <Text style={styles.label}>Full Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter player name"
                placeholderTextColor={Colors.textTertiary}
                value={playerForm.fullName}
                onChangeText={(t) => setPlayerForm({ ...playerForm, fullName: t })}
              />

              <Text style={styles.label}>Playing Role</Text>
              <View style={styles.chipGroup}>
                {ROLES.map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={[styles.chip, playerForm.role === r && styles.chipActive]}
                    onPress={() => setPlayerForm({ ...playerForm, role: r })}
                  >
                    <Text style={[styles.chipText, playerForm.role === r && styles.chipTextActive]}>{r}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Batting Style</Text>
              <View style={styles.chipGroup}>
                {BATTING_STYLES.map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.chip, playerForm.battingStyle === s && styles.chipActive]}
                    onPress={() => setPlayerForm({ ...playerForm, battingStyle: s })}
                  >
                    <Text style={[styles.chipText, playerForm.battingStyle === s && styles.chipTextActive]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Bowling Style</Text>
              <View style={styles.chipGroup}>
                {BOWLING_STYLES.map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.chip, playerForm.bowlingStyle === s && styles.chipActive]}
                    onPress={() => setPlayerForm({ ...playerForm, bowlingStyle: s })}
                  >
                    <Text style={[styles.chipText, playerForm.bowlingStyle === s && styles.chipTextActive]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity style={styles.submitBtn} onPress={handleSubmitManualPlayer} disabled={loading}>
                {loading ? (
                  <>
                    <ActivityIndicator color="#000" />
                    <Text style={[styles.submitBtnText, { marginLeft: 8 }]}>Adding...</Text>
                  </>
                ) : (
                  <Text style={styles.submitBtnText}>ADD TO AUCTION POOL</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal: View Set Players */}
      <Modal visible={showSetPlayersModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Set Players</Text>
              <TouchableOpacity onPress={() => setShowSetPlayersModal(false)}>
                <Icon name="close" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ paddingVertical: 10 }}>
              {selectedSetPlayers.length === 0 ? (
                <Text style={{ textAlign: 'center', color: Colors.textTertiary, padding: 20 }}>No players in this set.</Text>
              ) : (
                selectedSetPlayers.map((p, idx) => (
                  <View key={p._id || idx} style={styles.playerCard}>
                    <View style={styles.playerIndex}>
                      <Text style={styles.playerIndexText}>{idx + 1}</Text>
                    </View>
                    {p.photo || p.player?.photo ? (
                      <Image source={{ uri: getImageUrl(p.photo || p.player?.photo) }} style={styles.avatarImg} />
                    ) : (
                      <View style={styles.avatarPlaceholder}>
                        <Icon name="account" size={24} color={Colors.textTertiary} />
                      </View>
                    )}
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.playerName}>{p.fullName || p.player?.name}</Text>
                      <Text style={styles.playerRole}>{p.role}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ fontSize: 10, color: Colors.textTertiary }}>Base Price</Text>
                      <Text style={{ fontFamily: Typography.fontFamily.bold, color: Colors.primary }}>{p.basePrice || 0} Pts</Text>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    backgroundColor: Colors.backgroundElevated,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: { fontSize: 15, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary },

  // Tab bar — flat horizontal, not scrollable
  tabRow: {
    flexDirection: 'row',
    backgroundColor: Colors.backgroundElevated,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',

  },
  tabBtnActive: { borderBottomColor: Colors.primary },
  tabText: { color: Colors.textTertiary, fontSize: 12, fontFamily: Typography.fontFamily.medium },
  tabTextActive: { color: Colors.primary, fontFamily: Typography.fontFamily.bold },

  addBtn: {
    backgroundColor: Colors.primary,
    marginHorizontal: Spacing.md,
    marginVertical: 10,
    padding: 12,
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  addBtnText: { color: Colors.white, fontFamily: Typography.fontFamily.bold, fontSize: 12 },

  playerCard: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundElevated,
    padding: Spacing.md,
    borderRadius: 12,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  playerIndex: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  playerIndexText: { color: Colors.textTertiary, fontSize: 11, fontFamily: Typography.fontFamily.bold },
  avatarImg: { width: 44, height: 44, borderRadius: 22 },
  avatarPlaceholder: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center' },
  playerName: { color: Colors.textPrimary, fontFamily: Typography.fontFamily.bold, fontSize: 14 },
  playerRole: { color: Colors.primary, fontSize: 12, marginTop: 2 },
  playerSub: { color: Colors.textTertiary, fontSize: 11, marginTop: 2 },
  paidChip: {
    backgroundColor: 'rgba(74, 222, 128, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  paidText: { color: '#4ADE80', fontSize: 11, fontFamily: Typography.fontFamily.bold },

  // ── Create Sets: Stats Banner ──
  statsBanner: {
    flexDirection: 'row',
    backgroundColor: Colors.backgroundElevated,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  statsBannerItem: { flex: 1, alignItems: 'center', paddingVertical: 16, gap: 4 },
  statsBannerNum: { fontSize: 24, fontFamily: Typography.fontFamily.bold, color: Colors.primary, marginTop: 4 },
  statsBannerLbl: { fontSize: 10, color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5 },
  statsBannerDivider: { width: 1, backgroundColor: Colors.border, marginVertical: 12 },

  // ── Create Sets: Section Card ──
  configSection: {
    backgroundColor: Colors.backgroundElevated,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    marginBottom: 12,
  },
  configSectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 12 },
  configStepBadge: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.primary + '22',
    borderWidth: 1.5,
    borderColor: Colors.primary + '55',
    justifyContent: 'center', alignItems: 'center',
  },
  configStepNum: { color: Colors.primary, fontSize: 13, fontFamily: Typography.fontFamily.bold },
  configSectionTitle: { color: Colors.textPrimary, fontSize: 14, fontFamily: Typography.fontFamily.bold },
  configSectionSub: { color: Colors.textTertiary, fontSize: 11, marginTop: 2 },

  // ── Strategy Cards ──
  strategyRow: { flexDirection: 'row', gap: 10 },
  strategyCard: {
    flex: 1, padding: 14, borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1.5, borderColor: Colors.border,
    alignItems: 'center', position: 'relative',
  },
  strategyCardActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + '0A' },
  strategyIconBox: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.surface,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 8,
  },
  strategyTitle: { color: Colors.textSecondary, fontSize: 13, fontFamily: Typography.fontFamily.bold, textAlign: 'center' },
  strategyDesc: { color: Colors.textTertiary, fontSize: 10, textAlign: 'center', marginTop: 4, lineHeight: 15 },
  strategyCheck: {
    position: 'absolute', top: 8, right: 8,
    backgroundColor: Colors.primary + '22',
    borderRadius: 10, padding: 2,
    borderWidth: 1, borderColor: Colors.primary + '44',
  },

  // ── Counter ──
  counterRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  counterBtn: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: Colors.surface,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  counterBtnText: { color: Colors.textPrimary, fontSize: 24, fontFamily: Typography.fontFamily.bold },
  counterValBox: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    height: 54, backgroundColor: Colors.primary + '0D',
    borderRadius: 12, borderWidth: 1.5, borderColor: Colors.primary + '44',
  },
  counterVal: { color: Colors.primary, fontSize: 26, fontFamily: Typography.fontFamily.bold, textAlign: 'center', width: '100%', padding: 0, margin: 0 },

  // ── Financial Row ──
  financialRow: { flexDirection: 'row', gap: 10 },
  financialField: {
    flex: 1, backgroundColor: Colors.surface,
    borderRadius: 12, borderWidth: 1, borderColor: Colors.border, padding: 12,
  },
  financialIcon: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: Colors.primary + '15',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 8,
  },
  financialLabel: { color: Colors.textTertiary, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  financialInput: {
    color: Colors.textPrimary, fontSize: 18,
    fontFamily: Typography.fontFamily.bold,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    paddingBottom: 4,
  },

  // ── Generate Button ──
  generateSummaryBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 10, padding: 10,
    marginBottom: 12, borderWidth: 1, borderColor: Colors.border,
  },
  generateSummaryText: { color: Colors.textTertiary, fontSize: 12, flex: 1 },
  generateBtn: {
    backgroundColor: Colors.primary,
    height: 54, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center', flexDirection: 'row',
  },
  generateBtnText: { color: '#000', fontFamily: Typography.fontFamily.bold, fontSize: 15 },

  // Legacy compat
  card: { backgroundColor: Colors.backgroundElevated, padding: Spacing.lg, borderRadius: 16, borderWidth: 1, borderColor: Colors.border },
  cardTitle: { color: Colors.textPrimary, fontSize: 16, fontFamily: Typography.fontFamily.bold, marginBottom: Spacing.md },
  controlLabel: { color: Colors.textSecondary, fontSize: 13, marginTop: Spacing.md, marginBottom: 10 },
  hintText: { color: Colors.textTertiary, fontSize: 12, marginVertical: Spacing.lg, lineHeight: 18 },
  primaryBtn: { backgroundColor: Colors.primary, height: 50, borderRadius: 12, justifyContent: 'center', alignItems: 'center', flexDirection: 'row' },
  primaryBtnText: { color: Colors.white, fontFamily: Typography.fontFamily.bold, fontSize: 14 },

  // ── Sets Tab ──
  setsHeader: {
    flexDirection: 'row',
    backgroundColor: Colors.backgroundElevated,
    borderRadius: 14, borderWidth: 1, borderColor: Colors.border,
    marginBottom: 14, overflow: 'hidden',
  },
  setsHeaderStat: { flex: 1, alignItems: 'center', paddingVertical: 14 },
  setsHeaderNum: { fontSize: 20, fontFamily: Typography.fontFamily.bold, color: Colors.primary },
  setsHeaderLbl: { fontSize: 10, color: Colors.textTertiary, marginTop: 2, textTransform: 'uppercase' },

  setCard: {
    backgroundColor: Colors.backgroundElevated,
    borderRadius: 14, marginBottom: 10,
    borderWidth: 1, borderColor: Colors.border,
    overflow: 'hidden',
  },
  setCardInner: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  setNumCircle: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5,
  },
  setNumText: { fontSize: 15, fontFamily: Typography.fontFamily.bold },
  setCardName: { color: Colors.textPrimary, fontFamily: Typography.fontFamily.bold, fontSize: 14 },
  setCardSub: { color: Colors.textTertiary, fontSize: 11, marginTop: 2 },
  setProgressBg: { height: 4, backgroundColor: Colors.surface, borderRadius: 2, marginTop: 8 },
  setProgressFill: { height: 4, borderRadius: 2 },
  setStatusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 10, borderWidth: 1,
  },
  setStatusText: { fontSize: 10, fontFamily: Typography.fontFamily.semiBold },
  setPlayersList: { borderTopWidth: 1, borderTopColor: Colors.border, padding: 10, backgroundColor: Colors.surface },
  miniPlayerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5, gap: 8 },
  miniIdx: { width: 20, height: 20, borderRadius: 10, backgroundColor: Colors.backgroundElevated, justifyContent: 'center', alignItems: 'center' },
  miniIdxText: { color: Colors.textTertiary, fontSize: 10, fontFamily: Typography.fontFamily.bold },
  miniPlayerName: { color: Colors.textPrimary, fontSize: 12, fontFamily: Typography.fontFamily.medium, flex: 1 },
  miniRoleTag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  miniRoleText: { fontSize: 10, fontFamily: Typography.fontFamily.semiBold },
  morePlayersText: { color: Colors.primary, fontSize: 11, textAlign: 'center', marginTop: 6, opacity: 0.8 },

  // ── Legacy compat for sets ──
  setContainer: { backgroundColor: Colors.backgroundElevated, borderRadius: 12, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  setCardHeader: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md },
  setIndexCircle: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(99,102,241,0.15)', justifyContent: 'center', alignItems: 'center' },
  setIndexText: { color: '#818CF8', fontSize: 13, fontFamily: Typography.fontFamily.bold },
  setName: { color: Colors.textPrimary, fontFamily: Typography.fontFamily.bold, fontSize: 14 },
  setSub: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  statusChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginRight: 4 },
  statusText: { fontSize: 10, fontFamily: Typography.fontFamily.bold },
  miniPlayerIdx: { color: Colors.textTertiary, fontSize: 11, width: 20, textAlign: 'right' },
  miniPlayerRole: { color: Colors.textSecondary, fontSize: 11 },

  emptyBox: { alignItems: 'center', justifyContent: 'center', padding: Spacing.xl, marginTop: 30 },
  emptyTitle: { color: Colors.textPrimary, fontFamily: Typography.fontFamily.bold, fontSize: 16, marginTop: Spacing.md },
  emptyText: { color: Colors.textTertiary, marginTop: 6, fontSize: 13, textAlign: 'center' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: Colors.backgroundElevated, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: Spacing.lg, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  modalTitle: { fontSize: 18, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary },

  label: {
    color: Colors.textTertiary,
    fontSize: 11,
    fontFamily: Typography.fontFamily.bold,
    letterSpacing: 0.6,
    marginBottom: 6,
    marginTop: 14,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 46,
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.medium,
  },
  lookupBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
    shadowColor: Colors.primary,
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  photoBox: { width: 70, height: 70, borderRadius: 35, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  photoImg: { width: 70, height: 70, borderRadius: 35 },
  chipGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOpacity: 0.45,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
  chipText: { color: Colors.textSecondary, fontSize: 12, fontFamily: Typography.fontFamily.medium },
  chipTextActive: { color: '#000', fontFamily: Typography.fontFamily.bold, fontSize: 12 },
  submitBtn: {
    backgroundColor: Colors.primary,
    height: 52,
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    shadowColor: Colors.primary,
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  submitBtnText: { color: '#000', fontFamily: Typography.fontFamily.bold, fontSize: 15, letterSpacing: 0.4 },
});

export default AuctionCreateSetsScreen;
