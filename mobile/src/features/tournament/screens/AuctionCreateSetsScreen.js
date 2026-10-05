import React, { useMemo, useState, useEffect, useCallback } from 'react';
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
  Platform,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import SkeletonPlaceholder from 'react-native-skeleton-placeholder';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { launchImageLibrary } from 'react-native-image-picker';
import { useTheme, Typography, Spacing, BorderRadius } from '../../../theme/theme';
import auctionService from '../../../services/auctionService';
import api, { getImageUrl } from '../../../api/axios';

import { showCustomAlert } from '../../../components/CustomAlert';
import AuctionFinanceTab from '../components/AuctionFinanceTab';

const ROLES = ['All Rounder', 'Batsman', 'Bowler', 'Wicket Keeper'];
const BATTING_STYLES = ['Right Handed', 'Left Handed'];
const BOWLING_STYLES = ['Right Arm Medium', 'Right Arm Fast', 'Left Arm Medium', 'Left Arm Fast', 'Spin'];

const AuctionCreateSetsScreen = ({ route, navigation }) => {
  const { colors, shadows, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const safeTop = Math.max(insets?.top || 0, Platform.OS === 'ios' ? 44 : 0);
  const safeBottom = Math.max(insets?.bottom || 0, Platform.OS === 'ios' ? 24 : 0);
  const styles = useMemo(() => createStyles(colors, shadows, isDark), [colors, shadows, isDark]);
  const { auctionId: routeAuctionId, tournamentId, isReadOnly, showFinanceForOrganizer } = route.params || {};
  const [targetAuctionId, setTargetAuctionId] = useState(routeAuctionId);

  const mode = route.params?.mode || 'registrations';
  const [activeTab, setActiveTab] = useState(mode === 'sets' ? 'create_sets' : 'registered'); // 'registered' | 'create_sets' | 'sets' | 'finance'
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [registrations, setRegistrations] = useState([]);
  const [sets, setSets] = useState([]);
  const [auctionProfile, setAuctionProfile] = useState(null);

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
    amountPaid: '',
  });

  // Create Sets Controls
  const [numSets, setNumSets] = useState(5);
  const [playersPerSet, setPlayersPerSet] = useState(5);
  const [basePrice, setBasePrice] = useState('500');
  const [teamPurse, setTeamPurse] = useState('10000');
  const [strategy, setStrategy] = useState('mixture');
  const [showSetPlayersModal, setShowSetPlayersModal] = useState(false);
  const [selectedSetPlayers, setSelectedSetPlayers] = useState([]);

  // Custom / Player-Wise Sets State
  const [creationMode, setCreationMode] = useState('custom'); // 'custom' | 'auto'
  const [customSets, setCustomSets] = useState([]);
  const [activeSetIdForSelection, setActiveSetIdForSelection] = useState(null);
  const [showPlayerSelectionModal, setShowPlayerSelectionModal] = useState(false);
  const [playerSearchQuery, setPlayerSearchQuery] = useState('');
  const [playerRoleFilter, setPlayerRoleFilter] = useState('All');

  useEffect(() => {
    loadData();
  }, [tournamentId, routeAuctionId]);

  const loadData = async () => {
    setLoading(true);
    try {
      let activeId = targetAuctionId;
      if (tournamentId) {
        const detailsRes = await auctionService.getAuctionDetails(tournamentId);
        if (detailsRes.data && detailsRes.data._id) {
          activeId = detailsRes.data._id;
          setTargetAuctionId(activeId);
          setAuctionProfile(detailsRes.data);
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
            const mapBattingStyle = (style) => {
              if (style === 'Right Hand') return 'Right Handed';
              if (style === 'Left Hand') return 'Left Handed';
              return style;
            };
            const mappedBatting = mapBattingStyle(u.battingStyle);
            setPlayerForm(f => ({
              ...f,
              fullName: u.name || f.fullName,
              role: userRole && ROLES.includes(userRole) ? userRole : f.role,
              battingStyle: mappedBatting && BATTING_STYLES.includes(mappedBatting) ? mappedBatting : f.battingStyle,
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

    let activeId = targetAuctionId || auctionProfile?._id || routeAuctionId || tournamentId;

    if (!activeId) {
      showCustomAlert('Error', 'Auction or Tournament ID is missing');
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
      if (playerForm.amountPaid !== '') {
        data.append('amountPaid', playerForm.amountPaid);
      }

      const photoVal = playerForm.photo;
      const photoUri = typeof photoVal === 'string' ? photoVal : photoVal?.uri;

      if (photoUri && (photoUri.startsWith('http://') || photoUri.startsWith('https://'))) {
        data.append('photo', photoUri);
      } else if (photoVal?.uri) {
        data.append('photo', {
          uri: photoVal.uri,
          type: photoVal.type || 'image/jpeg',
          name: photoVal.fileName || `player_${Date.now()}.jpg`,
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
        amountPaid: '',
      });
      setPhoneInput('');
      loadData();
    } catch (err) {
      showCustomAlert('Error', err.response?.data?.message || err.message || 'Failed to add player');
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

    const tTeams = auctionProfile?.tournament?.teams || [];
    const tRegTeams = auctionProfile?.tournament?.registeredTeams || [];
    const totalTeams = tTeams.length + tRegTeams.length;

    if (totalTeams === 0) {
      showCustomAlert('Teams Required', 'Teams must be added to the tournament before creating auction sets and purse.');
      return;
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

  const handleConfirmRemovePlayer = (item) => {
    showCustomAlert(
      'Remove Player',
      `Are you sure you want to remove ${item.fullName} from this auction?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => handleRemovePlayer(item._id)
        }
      ]
    );
  };

  const handleRemovePlayer = async (regId) => {
    let activeId = targetAuctionId || auctionProfile?._id || routeAuctionId || tournamentId;
    if (!activeId) return;
    try {
      setLoading(true);
      await auctionService.removePlayer(activeId, regId);
      showCustomAlert('Removed', 'Player removed from auction successfully');
      await loadData();
    } catch (err) {
      showCustomAlert('Error', err.response?.data?.message || 'Failed to remove player');
    } finally {
      setLoading(false);
    }
  };

  const handleAddCustomSet = () => {
    const nextIdx = customSets.length + 1;
    const defaultNames = ['Grade A Players', 'Grade B Players', 'Grade C Players', 'Grade D Players', 'Grade E Players'];
    const defaultPrices = ['5000', '2500', '1000', '500', '250'];
    const nextName = defaultNames[nextIdx - 1] || `Grade ${String.fromCharCode(64 + nextIdx)} Players`;
    const nextPrice = defaultPrices[nextIdx - 1] || '500';
    setCustomSets(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        setName: nextName,
        basePrice: nextPrice,
        playerIds: []
      }
    ]);
  };

  const handleRemoveCustomSet = (setId) => {
    setCustomSets(prev => prev.filter(s => s.id !== setId));
  };

  const handleUpdateCustomSet = (setId, field, val) => {
    setCustomSets(prev => prev.map(s => s.id === setId ? { ...s, [field]: val } : s));
  };

  const handleOpenPlayerSelection = (setId) => {
    setActiveSetIdForSelection(setId);
    setPlayerSearchQuery('');
    setPlayerRoleFilter('All');
    setShowPlayerSelectionModal(true);
  };

  const handleTogglePlayerInSet = (playerId) => {
    if (!activeSetIdForSelection) return;
    setCustomSets(prev => {
      return prev.map(s => {
        if (s.id === activeSetIdForSelection) {
          const exists = s.playerIds.includes(playerId);
          return {
            ...s,
            playerIds: exists ? s.playerIds.filter(id => id !== playerId) : [...s.playerIds, playerId]
          };
        } else {
          // If already in another set, remove it from that set
          return {
            ...s,
            playerIds: s.playerIds.filter(id => id !== playerId)
          };
        }
      });
    });
  };

  const handleQuickRemovePlayerFromSet = (setId, playerId) => {
    setCustomSets(prev => prev.map(s => {
      if (s.id === setId) {
        return { ...s, playerIds: s.playerIds.filter(id => id !== playerId) };
      }
      return s;
    }));
  };

  const handleSaveCustomSets = async () => {
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

    const tTeams = auctionProfile?.tournament?.teams || [];
    const tRegTeams = auctionProfile?.tournament?.registeredTeams || [];
    const totalTeams = tTeams.length + tRegTeams.length;

    if (totalTeams === 0) {
      showCustomAlert('Teams Required', 'Teams must be added to the tournament before creating auction sets and purse.');
      return;
    }

    if (registrations.length === 0) {
      showCustomAlert('No Players', 'There are no registered players to create sets.');
      return;
    }

    if (customSets.length === 0) {
      showCustomAlert('No Sets Created', 'Please click "+ CREATE FIRST SET" to define at least one set.');
      return;
    }

    const totalSelected = customSets.reduce((sum, s) => sum + s.playerIds.length, 0);
    if (totalSelected === 0) {
      showCustomAlert('No Players Selected', 'Please select at least one player in a set.');
      return;
    }

    const emptySets = customSets.filter(s => s.playerIds.length === 0);
    if (emptySets.length > 0) {
      showCustomAlert(
        'Empty Sets Found',
        `Some sets have no players selected (${emptySets.map(s => s.setName).join(', ')}). Please select players or remove empty sets.`
      );
      return;
    }

    setLoading(true);
    try {
      const setsPayload = customSets.map(s => ({
        setName: s.setName?.trim() || 'Set',
        basePrice: Number(s.basePrice) || 0,
        playerIds: s.playerIds
      }));
      await auctionService.createCustomSets(activeId, setsPayload, Number(teamPurse) || 0);
      await loadData();
      showCustomAlert('Success', 'Custom sets created successfully!');
      setActiveTab('sets');
    } catch (err) {
      showCustomAlert('Error', err.response?.data?.message || 'Failed to create custom sets');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingBottom: Math.max(safeBottom, 8) }]}>
      {/* Compact Top Header */}
      <View style={[styles.header, { paddingTop: safeTop + 6 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 4 }}>
          <Icon name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={styles.headerTitle}>
            {mode === 'sets' ? 'Create & Manage Sets' : 'Manage Registrations'}
          </Text>
        </View>
        <TouchableOpacity onPress={onRefresh} style={{ padding: 4 }}>
          <Icon name="refresh" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Top Segment Control */}
      <View style={styles.tabRow}>
        {!isReadOnly && mode === 'registrations' && (
          <>
            <TouchableOpacity style={[styles.tabBtn, activeTab === 'registered' && styles.tabBtnActive]} onPress={() => setActiveTab('registered')}>
              <Icon name="account-group" size={14} color={activeTab === 'registered' ? colors.primary : colors.textTertiary} style={{ marginRight: 4 }} />
              <Text style={[styles.tabText, activeTab === 'registered' && styles.tabTextActive]}>Players ({registrations.length})</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.tabBtn, activeTab === 'finance' && styles.tabBtnActive]} onPress={() => setActiveTab('finance')}>
              <Icon name="cash-multiple" size={14} color={activeTab === 'finance' ? colors.primary : colors.textTertiary} style={{ marginRight: 4 }} />
              <Text style={[styles.tabText, activeTab === 'finance' && styles.tabTextActive]}>Finance</Text>
            </TouchableOpacity>
          </>
        )}

        {!isReadOnly && mode === 'sets' && (
          <>
            <TouchableOpacity style={[styles.tabBtn, activeTab === 'create_sets' && styles.tabBtnActive]} onPress={() => setActiveTab('create_sets')}>
              <Icon name="cards-outline" size={14} color={activeTab === 'create_sets' ? colors.primary : colors.textTertiary} style={{ marginRight: 4 }} />
              <Text style={[styles.tabText, activeTab === 'create_sets' && styles.tabTextActive]}>Create Sets</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.tabBtn, activeTab === 'sets' && styles.tabBtnActive]} onPress={() => setActiveTab('sets')}>
              <Icon name="view-list" size={14} color={activeTab === 'sets' ? colors.primary : colors.textTertiary} style={{ marginRight: 4 }} />
              <Text style={[styles.tabText, activeTab === 'sets' && styles.tabTextActive]}>Sets ({sets.length})</Text>
            </TouchableOpacity>
          </>
        )}

        {isReadOnly && (
          <>
            <TouchableOpacity style={[styles.tabBtn, activeTab === 'registered' && styles.tabBtnActive]} onPress={() => setActiveTab('registered')}>
              <Icon name="account-group" size={14} color={activeTab === 'registered' ? colors.primary : colors.textTertiary} style={{ marginRight: 4 }} />
              <Text style={[styles.tabText, activeTab === 'registered' && styles.tabTextActive]}>Players ({registrations.length})</Text>
            </TouchableOpacity>
            
            {showFinanceForOrganizer ? (
              <TouchableOpacity style={[styles.tabBtn, activeTab === 'finance' && styles.tabBtnActive]} onPress={() => setActiveTab('finance')}>
                <Icon name="cash-multiple" size={14} color={activeTab === 'finance' ? colors.primary : colors.textTertiary} style={{ marginRight: 4 }} />
                <Text style={[styles.tabText, activeTab === 'finance' && styles.tabTextActive]}>Finance</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={[styles.tabBtn, activeTab === 'sets' && styles.tabBtnActive]} onPress={() => setActiveTab('sets')}>
                <Icon name="view-list" size={14} color={activeTab === 'sets' ? colors.primary : colors.textTertiary} style={{ marginRight: 4 }} />
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
              <Icon name="account-plus" size={18} color={colors.white} />
              <Text style={styles.addBtnText}>ADD PLAYER MANUALLY</Text>
            </TouchableOpacity>
          )}

          <FlatList
            data={registrations}
            keyExtractor={(item) => item._id}
            contentContainerStyle={{ paddingHorizontal: Spacing.md, paddingBottom: 100, paddingTop: Spacing.md }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
            renderItem={({ item, index }) => (
              <View style={styles.playerCard}>
                <View style={styles.playerIndex}>
                  <Text style={styles.playerIndexText}>{index + 1}</Text>
                </View>
                {item.photo ? (
                  <Image source={{ uri: getImageUrl(item.photo) }} style={styles.avatarImg} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Icon name="account" size={22} color={colors.primary} />
                  </View>
                )}
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.playerName}>{item.fullName}</Text>
                  <Text style={styles.playerRole}>{item.role}</Text>
                  <Text style={styles.playerSub}>{item.battingStyle || 'Right Handed'} | {item.bowlingStyle || 'Medium'}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', justifyContent: 'center', gap: 6 }}>
                  <View style={styles.paidChip}>
                    <Icon name={item.registrationType === 'offline' ? 'cash' : 'credit-card-outline'} size={12} color="#4ADE80" style={{ marginRight: 4 }} />
                    <Text style={styles.paidText}>
                      {item.registrationType === 'offline' ? 'Offline' : 'Online'} • ₹{item.registrationFee || 0}
                    </Text>
                  </View>
                  {!isReadOnly && item.soldStatus !== 'sold' && (
                    <TouchableOpacity
                      style={styles.removePlayerBtn}
                      onPress={() => handleConfirmRemovePlayer(item)}
                      disabled={loading}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Icon name="trash-can-outline" size={13} color="#EF4444" />
                      {/* <Text style={styles.removePlayerText}></Text> */}
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}
            ListEmptyComponent={
              loading ? (
                <View>
                  {[1, 2, 3, 4, 5].map(i => (
                    <View key={i} style={styles.playerCard}>
                      <SkeletonPlaceholder backgroundColor={colors.surface} highlightColor="#2A2A2A">
                        <SkeletonPlaceholder.Item flexDirection="row" alignItems="center">
                          <SkeletonPlaceholder.Item width={26} height={26} borderRadius={13} marginRight={6} />
                          <SkeletonPlaceholder.Item width={44} height={44} borderRadius={22} />
                          <SkeletonPlaceholder.Item flex={1} marginLeft={10}>
                            <SkeletonPlaceholder.Item width={120} height={16} borderRadius={4} />
                            <SkeletonPlaceholder.Item width={80} height={12} borderRadius={4} marginTop={6} />
                            <SkeletonPlaceholder.Item width={100} height={10} borderRadius={4} marginTop={6} />
                          </SkeletonPlaceholder.Item>
                          <SkeletonPlaceholder.Item width={40} height={20} borderRadius={10} />
                        </SkeletonPlaceholder.Item>
                      </SkeletonPlaceholder>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.emptyBox}>
                  <Icon name="account-group-outline" size={56} color={colors.textTertiary} />
                  <Text style={styles.emptyTitle}>No Players Yet</Text>
                  <Text style={styles.emptyText}>Add players manually or ask them to register.</Text>
                </View>
              )
            }
          />
        </View>
      )}

      {/* Tab 2: Create Sets Controls */}
      {activeTab === 'create_sets' && (
        <KeyboardAwareScrollView
          enableOnAndroid={true}
          extraScrollHeight={Platform.OS === 'ios' ? 40 : 25}
          keyboardShouldPersistTaps="handled"
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: Spacing.md, paddingBottom: 60 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          {/* Mode Switcher */}
          <View style={styles.modeToggleRow}>
            <TouchableOpacity
              style={[styles.modeToggleBtn, creationMode === 'custom' && styles.modeToggleBtnActive]}
              onPress={() => setCreationMode('custom')}
            >
              <Icon name="account-star" size={16} color={creationMode === 'custom' ? '#000' : colors.textTertiary} style={{ marginRight: 6 }} />
              <Text style={[styles.modeToggleText, creationMode === 'custom' && styles.modeToggleTextActive]}>Manual / Grade Sets</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeToggleBtn, creationMode === 'auto' && styles.modeToggleBtnActive]}
              onPress={() => setCreationMode('auto')}
            >
              <Icon name="auto-fix" size={16} color={creationMode === 'auto' ? '#000' : colors.textTertiary} style={{ marginRight: 6 }} />
              <Text style={[styles.modeToggleText, creationMode === 'auto' && styles.modeToggleTextActive]}>Auto Generator</Text>
            </TouchableOpacity>
          </View>

          {creationMode === 'custom' ? (
            /* ─────────────────────────────────────────────────────────────
               CUSTOM / PLAYER-WISE SET CREATION (Grade A, Grade B, etc.)
               ───────────────────────────────────────────────────────────── */
            <View>
              {/* Custom Sets Stats Banner */}
              {(() => {
                const totalAssigned = customSets.reduce((sum, s) => sum + s.playerIds.length, 0);
                const totalUnassigned = Math.max(0, registrations.length - totalAssigned);
                return (
                  <View style={styles.statsBanner}>
                    <View style={styles.statsBannerItem}>
                      <Icon name="account-group" size={20} color={colors.primary} />
                      <Text style={styles.statsBannerNum}>{registrations.length}</Text>
                      <Text style={styles.statsBannerLbl}>Total Players</Text>
                    </View>
                    <View style={styles.statsBannerDivider} />
                    <View style={styles.statsBannerItem}>
                      <Icon name="account-check" size={20} color="#4ADE80" />
                      <Text style={[styles.statsBannerNum, { color: '#4ADE80' }]}>{totalAssigned}</Text>
                      <Text style={styles.statsBannerLbl}>Assigned</Text>
                    </View>
                    <View style={styles.statsBannerDivider} />
                    <View style={styles.statsBannerItem}>
                      <Icon name="account-clock" size={20} color={totalUnassigned > 0 ? '#F59E0B' : colors.textTertiary} />
                      <Text style={[styles.statsBannerNum, { color: totalUnassigned > 0 ? '#F59E0B' : colors.textTertiary }]}>{totalUnassigned}</Text>
                      <Text style={styles.statsBannerLbl}>Unassigned</Text>
                    </View>
                  </View>
                );
              })()}

              <Text style={styles.customSectionTitle}>Define Sets & Assign Players</Text>
              <Text style={styles.customSectionSub}>Assign players to each set (e.g. Grade A, Grade B) and set base points.</Text>

              {/* Set Cards or Empty State */}
              {customSets.length === 0 ? (
                <View style={styles.noCustomSetsCard}>
                  <View style={styles.noCustomSetsIconWrap}>
                    <Icon name="shape-plus" size={34} color={colors.primary} />
                  </View>
                  <Text style={styles.noCustomSetsTitle}>No Sets Created</Text>
                  <Text style={styles.noCustomSetsSub}>
                    Sets must be created by the organiser. Click below to add your first set, specify base points, and select players.
                  </Text>
                  <TouchableOpacity style={styles.addFirstSetBtn} onPress={handleAddCustomSet} activeOpacity={0.8}>
                    <Icon name="plus" size={18} color="#000" style={{ marginRight: 6 }} />
                    <Text style={styles.addFirstSetBtnText}>CREATE FIRST SET</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  {customSets.map((set, sIdx) => {
                    const setPlayerObjs = registrations.filter(r => set.playerIds.includes(r._id));
                    const presetNames = ['Grade A Players', 'Grade B Players', 'Grade C Players', 'Marquee Players', 'Emerging Players'];
                    const presetPrices = ['5000', '2500', '1000', '500'];

                    return (
                      <View key={set.id} style={styles.customSetCard}>
                        {/* Header */}
                        <View style={styles.customSetHeader}>
                          <View style={styles.customSetBadge}>
                            <Text style={styles.customSetBadgeText}>SET {sIdx + 1}</Text>
                          </View>
                          <View style={{ flex: 1, marginLeft: 10 }}>
                            <Text style={styles.customSetNameHeading} numberOfLines={1}>{set.setName || `Set ${sIdx + 1}`}</Text>
                          </View>
                          <TouchableOpacity
                            style={styles.deleteSetBtn}
                            onPress={() => handleRemoveCustomSet(set.id)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Icon name="trash-can-outline" size={18} color="#EF4444" />
                          </TouchableOpacity>
                        </View>

                        {/* Set Name Input */}
                        <Text style={styles.customFieldLabel}>Set Name</Text>
                        <TextInput
                          style={styles.customInput}
                          placeholder="e.g. Grade A Players"
                          placeholderTextColor={colors.textTertiary}
                          value={set.setName}
                          onChangeText={(val) => handleUpdateCustomSet(set.id, 'setName', val)}
                        />
                        {/* Preset Name Pills */}
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 6 }}>
                          {presetNames.map(pName => (
                            <TouchableOpacity
                              key={pName}
                              style={[styles.presetPill, set.setName === pName && styles.presetPillActive]}
                              onPress={() => handleUpdateCustomSet(set.id, 'setName', pName)}
                            >
                              <Text style={[styles.presetPillText, set.setName === pName && styles.presetPillTextActive]}>{pName}</Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>

                        {/* Base Points Input */}
                        <View style={{ marginTop: 10 }}>
                          <Text style={styles.customFieldLabel}>Base Points for this Set (Pts)</Text>
                          <View style={styles.customPriceRow}>
                            <View style={styles.customPriceIcon}>
                              <Icon name="currency-inr" size={16} color={colors.primary} />
                            </View>
                            <TextInput
                              style={styles.customPriceInput}
                              placeholder="e.g. 5000"
                              placeholderTextColor={colors.textTertiary}
                              keyboardType="number-pad"
                              value={String(set.basePrice || '')}
                              onChangeText={(val) => handleUpdateCustomSet(set.id, 'basePrice', val)}
                            />
                          </View>
                          {/* Preset Price Pills */}
                          <View style={{ flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                            {presetPrices.map(priceVal => (
                              <TouchableOpacity
                                key={priceVal}
                                style={[styles.presetPill, String(set.basePrice) === priceVal && styles.presetPillActive]}
                                onPress={() => handleUpdateCustomSet(set.id, 'basePrice', priceVal)}
                              >
                                <Text style={[styles.presetPillText, String(set.basePrice) === priceVal && styles.presetPillTextActive]}>{priceVal} Pts</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </View>

                        {/* Player Selection Section */}
                        <View style={{ marginTop: 14 }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <Text style={styles.customFieldLabel}>
                              Assigned Players ({set.playerIds.length})
                            </Text>
                          </View>

                          <TouchableOpacity
                            style={styles.selectPlayersBtn}
                            onPress={() => handleOpenPlayerSelection(set.id)}
                          >
                            <Icon name="account-multiple-plus" size={18} color={colors.primary} style={{ marginRight: 8 }} />
                            <Text style={styles.selectPlayersBtnText}>
                              {set.playerIds.length === 0 ? 'Select Players for this Set' : `Edit Selected Players (${set.playerIds.length})`}
                            </Text>
                            <Icon name="chevron-right" size={18} color={colors.textTertiary} />
                          </TouchableOpacity>

                          {/* Chips preview of selected players */}
                          {setPlayerObjs.length > 0 && (
                            <View style={styles.playerChipsContainer}>
                              {setPlayerObjs.map(p => (
                                <View key={p._id} style={styles.playerChip}>
                                  {p.photo ? (
                                    <Image source={{ uri: getImageUrl(p.photo) }} style={styles.playerChipAvatar} />
                                  ) : (
                                    <View style={styles.playerChipAvatarPlaceholder}>
                                      <Text style={styles.playerChipInitials}>{(p.fullName || 'P').charAt(0).toUpperCase()}</Text>
                                    </View>
                                  )}
                                  <Text style={styles.playerChipName} numberOfLines={1}>{p.fullName}</Text>
                                  <TouchableOpacity
                                    onPress={() => handleQuickRemovePlayerFromSet(set.id, p._id)}
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    style={{ marginLeft: 4 }}
                                  >
                                    <Icon name="close-circle" size={14} color={colors.textTertiary} />
                                  </TouchableOpacity>
                                </View>
                              ))}
                            </View>
                          )}
                        </View>
                      </View>
                    );
                  })}

                  {/* Add Set Button */}
                  <TouchableOpacity style={styles.addSetBtn} onPress={handleAddCustomSet} activeOpacity={0.8}>
                    <Icon name="plus-circle-outline" size={20} color={colors.primary} style={{ marginRight: 8 }} />
                    <Text style={styles.addSetBtnText}>+ ADD ANOTHER SET</Text>
                  </TouchableOpacity>
                </>
              )}

              {/* Team Purse Card */}
              <View style={[styles.configSection, { marginTop: 14 }]}>
                <View style={styles.configSectionHeader}>
                  <View style={[styles.configStepBadge, { backgroundColor: '#F59E0B22', borderColor: '#F59E0B55' }]}>
                    <Icon name="wallet" size={14} color="#F59E0B" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.configSectionTitle}>Team Purse Budget</Text>
                    <Text style={styles.configSectionSub}>Total bidding purse allocated to each team</Text>
                  </View>
                </View>
                <View style={styles.customPriceRow}>
                  <View style={[styles.customPriceIcon, { backgroundColor: '#F59E0B22' }]}>
                    <Icon name="wallet" size={16} color="#F59E0B" />
                  </View>
                  <TextInput
                    style={styles.customPriceInput}
                    placeholder="e.g. 50000"
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="number-pad"
                    value={teamPurse}
                    onChangeText={setTeamPurse}
                  />
                  <Text style={{ color: colors.textTertiary, fontSize: 13, fontFamily: Typography.fontFamily.semiBold, marginRight: 8 }}>Pts</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                  {['25000', '50000', '100000', '200000'].map(purseVal => (
                    <TouchableOpacity
                      key={purseVal}
                      style={[styles.presetPill, String(teamPurse) === purseVal && styles.presetPillActive]}
                      onPress={() => setTeamPurse(purseVal)}
                    >
                      <Text style={[styles.presetPillText, String(teamPurse) === purseVal && styles.presetPillTextActive]}>{Number(purseVal).toLocaleString('en-IN')} Pts</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Save Custom Sets Button */}
              <TouchableOpacity style={[styles.generateBtn, { marginTop: 16 }]} onPress={handleSaveCustomSets} disabled={loading}>
                {loading ? <ActivityIndicator color="#000" /> : (
                  <>
                    <Icon name="check-all" size={20} color="#000" style={{ marginRight: 8 }} />
                    <Text style={styles.generateBtnText}>SAVE & CREATE CUSTOM SETS</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            /* ─────────────────────────────────────────────────────────────
               AUTO GENERATOR MODE (Mixture or Role-wise)
               ───────────────────────────────────────────────────────────── */
            <View>
              {/* Stats Banner */}
              <View style={styles.statsBanner}>
                <View style={styles.statsBannerItem}>
                  <Icon name="account-group" size={20} color={colors.primary} />
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
                    <View style={[styles.strategyIconBox, strategy === 'mixture' && { backgroundColor: colors.primary + '22' }]}>
                      <Icon name="shuffle-variant" size={22} color={strategy === 'mixture' ? colors.primary : colors.textTertiary} />
                    </View>
                    <Text style={[styles.strategyTitle, strategy === 'mixture' && { color: colors.primary }]}>Random Mixture</Text>
                    <Text style={styles.strategyDesc}>Players are shuffled{`\n`}and grouped randomly</Text>
                    {strategy === 'mixture' && (
                      <View style={styles.strategyCheck}>
                        <Icon name="check-circle" size={16} color={colors.primary} />
                      </View>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.strategyCard, strategy === 'role_wise' && styles.strategyCardActive]}
                    onPress={() => setStrategy('role_wise')}
                  >
                    <View style={[styles.strategyIconBox, strategy === 'role_wise' && { backgroundColor: '#818CF822' }]}>
                      <Icon name="account-group" size={22} color={strategy === 'role_wise' ? '#818CF8' : colors.textTertiary} />
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
                      <Icon name="currency-inr" size={16} color={colors.primary} />
                    </View>
                    <Text style={styles.financialLabel}>Base Price (Pts)</Text>
                    <TextInput
                      style={styles.financialInput}
                      placeholder="e.g. 1000"
                      placeholderTextColor={colors.textTertiary}
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
                      placeholderTextColor={colors.textTertiary}
                      keyboardType="number-pad"
                      value={teamPurse}
                      onChangeText={setTeamPurse}
                    />
                  </View>
                </View>
              </View>

              {/* Summary + Generate */}
              <View style={styles.generateSummaryBox}>
                <Icon name="information-outline" size={14} color={colors.textTertiary} style={{ marginRight: 6 }} />
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
            </View>
          )}
        </KeyboardAwareScrollView>
      )}

      {/* Tab 3: Sets Overview */}
      {activeTab === 'sets' && (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: Spacing.md, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          {sets.length === 0 ? (
            <View style={styles.emptyBox}>
              <Icon name="cards-outline" size={64} color={colors.textTertiary} />
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
                        ? <Icon name="lock-outline" size={18} color={colors.textTertiary} style={{ marginLeft: 8 }} />
                        : <Icon name="chevron-right" size={18} color={colors.textTertiary} style={{ marginLeft: 8 }} />
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
                                  : colors.primary
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
                <Icon name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <KeyboardAwareScrollView
              enableOnAndroid={true}
              extraScrollHeight={Platform.OS === 'ios' ? 40 : 25}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingVertical: 10 }}
            >
              <View style={{ marginBottom: 15 }}>
                <Text style={styles.label}>Player Mobile Number *</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    placeholder="Enter 10-digit mobile"
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="phone-pad"
                    value={phoneInput}
                    onChangeText={setPhoneInput}
                    maxLength={10}
                  />
                  <View style={styles.lookupBtn}>
                    {lookingUp ? <ActivityIndicator color="#000" size="small" /> : <Icon name="check-circle" color={phoneInput.length === 10 ? '#000' : 'rgba(0,0,0,0.3)'} size={20} />}
                  </View>
                </View>
                {lookupMessage ? <Text style={{ color: colors.primary, fontSize: 12, marginTop: 8, fontFamily: Typography.fontFamily.medium }}>{lookupMessage}</Text> : null}
              </View>

              {/* Player Photo */}
              <View style={{ alignItems: 'center', marginVertical: 10 }}>
                <TouchableOpacity onPress={handlePickPhoto} style={styles.photoBox}>
                  {playerForm.photo ? (
                    <Image source={playerForm.photo} style={styles.photoImg} />
                  ) : (
                    <View style={{ alignItems: 'center' }}>
                      <Icon name="camera-plus" size={28} color={colors.primary} />
                      <Text style={{ color: colors.textSecondary, fontSize: 10, marginTop: 4 }}>Add Photo</Text>
                    </View>
                  )}
                </TouchableOpacity>
                <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 8 }}>Max 3 MB</Text>
              </View>

              <Text style={styles.label}>Full Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter player name"
                placeholderTextColor={colors.textTertiary}
                value={playerForm.fullName}
                onChangeText={(t) => setPlayerForm({ ...playerForm, fullName: t })}
              />

              <Text style={styles.label}>Amount Received (₹)</Text>
              <TextInput
                style={styles.input}
                placeholder={`Default: ₹${auctionProfile?.registrationFee || 0}`}
                placeholderTextColor={colors.textTertiary}
                keyboardType="numeric"
                value={playerForm.amountPaid}
                onChangeText={(t) => setPlayerForm({ ...playerForm, amountPaid: t })}
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
            </KeyboardAwareScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal: Select Players for Custom Set */}
      <Modal
        visible={showPlayerSelectionModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPlayerSelectionModal(false)}
      >
        <View style={styles.playerSelectModalOverlay}>
          <View style={styles.playerSelectModalCard}>
            <View style={styles.modalSheetHandle} />
            {(() => {
              const currentSet = customSets.find(s => s.id === activeSetIdForSelection);
              const selectedCount = currentSet?.playerIds?.length || 0;

              const filteredPlayers = registrations.filter(r => {
                const matchesRole = playerRoleFilter === 'All' || r.role === playerRoleFilter;
                const matchesQuery = !playerSearchQuery || r.fullName?.toLowerCase().includes(playerSearchQuery.toLowerCase()) || r.mobileNumber?.includes(playerSearchQuery);
                return matchesRole && matchesQuery;
              });

              return (
                <View style={{ flex: 1 }}>
                  <View style={styles.modalHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.modalTitle} numberOfLines={1}>Select Players for {currentSet?.setName || 'Set'}</Text>
                      <Text style={{ fontSize: 12, color: colors.primary, fontFamily: Typography.fontFamily.semiBold, marginTop: 2 }}>
                        {selectedCount} players selected
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => setShowPlayerSelectionModal(false)}>
                      <Icon name="close" size={24} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>

                  {/* Search Bar */}
                  <View style={styles.playerSearchRow}>
                    <Icon name="magnify" size={18} color={colors.textTertiary} style={{ marginRight: 8 }} />
                    <TextInput
                      style={styles.playerSearchInput}
                      placeholder="Search player by name..."
                      placeholderTextColor={colors.textTertiary}
                      value={playerSearchQuery}
                      onChangeText={setPlayerSearchQuery}
                    />
                    {playerSearchQuery ? (
                      <TouchableOpacity onPress={() => setPlayerSearchQuery('')}>
                        <Icon name="close-circle" size={16} color={colors.textTertiary} />
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  {/* Role Filter Chips */}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 38, marginBottom: 10 }}>
                    {['All', ...ROLES].map(r => (
                      <TouchableOpacity
                        key={r}
                        style={[styles.roleFilterChip, playerRoleFilter === r && styles.roleFilterChipActive]}
                        onPress={() => setPlayerRoleFilter(r)}
                      >
                        <Text style={[styles.roleFilterChipText, playerRoleFilter === r && styles.roleFilterChipTextActive]}>{r}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  {/* Player List */}
                  <FlatList
                    data={filteredPlayers}
                    keyExtractor={(item) => item._id}
                    contentContainerStyle={{ paddingBottom: 20 }}
                    ListEmptyComponent={
                      <View style={{ alignItems: 'center', paddingVertical: 30 }}>
                        <Icon name="account-search-outline" size={40} color={colors.textTertiary} />
                        <Text style={{ color: colors.textTertiary, fontSize: 13, marginTop: 8 }}>No players match your search.</Text>
                      </View>
                    }
                    renderItem={({ item }) => {
                      const isSelectedInActiveSet = currentSet?.playerIds?.includes(item._id);
                      // Check if selected in ANOTHER set
                      const otherSet = customSets.find(s => s.id !== activeSetIdForSelection && s.playerIds.includes(item._id));

                      return (
                        <TouchableOpacity
                          style={[styles.pickerPlayerCard, isSelectedInActiveSet && styles.pickerPlayerCardSelected]}
                          onPress={() => handleTogglePlayerInSet(item._id)}
                          activeOpacity={0.7}
                        >
                          {/* Checkbox Icon */}
                          <View style={[styles.pickerCheckbox, isSelectedInActiveSet && styles.pickerCheckboxActive]}>
                            {isSelectedInActiveSet && <Icon name="check" size={14} color="#000" />}
                          </View>

                          {/* Avatar */}
                          {item.photo ? (
                            <Image source={{ uri: getImageUrl(item.photo) }} style={styles.pickerAvatar} />
                          ) : (
                            <View style={styles.pickerAvatarPlaceholder}>
                              <Text style={styles.pickerAvatarInitials}>{(item.fullName || 'P').charAt(0).toUpperCase()}</Text>
                            </View>
                          )}

                          {/* Info */}
                          <View style={{ flex: 1, marginLeft: 10 }}>
                            <Text style={styles.pickerPlayerName}>{item.fullName}</Text>
                            <Text style={styles.pickerPlayerSub}>{item.role} • {item.battingStyle || 'Right Handed'}</Text>
                          </View>

                          {/* Badge if in other set */}
                          {otherSet && !isSelectedInActiveSet && (
                            <View style={styles.otherSetBadge}>
                              <Text style={styles.otherSetBadgeText}>In {otherSet.setName}</Text>
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    }}
                  />

                  {/* Done Button */}
                  <TouchableOpacity
                    style={styles.doneBtn}
                    onPress={() => setShowPlayerSelectionModal(false)}
                  >
                    <Text style={styles.doneBtnText}>DONE ({selectedCount} SELECTED)</Text>
                  </TouchableOpacity>
                </View>
              );
            })()}
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
                <Icon name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ paddingVertical: 10 }}>
              {selectedSetPlayers.length === 0 ? (
                <Text style={{ textAlign: 'center', color: colors.textTertiary, padding: 20 }}>No players in this set.</Text>
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
                        <Icon name="account" size={24} color={colors.textTertiary} />
                      </View>
                    )}
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.playerName}>{p.fullName || p.player?.name}</Text>
                      <Text style={styles.playerRole}>{p.role}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ fontSize: 10, color: colors.textTertiary }}>Base Price</Text>
                      <Text style={{ fontFamily: Typography.fontFamily.bold, color: colors.primary }}>{p.basePrice || 0} Pts</Text>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const createStyles = (colors, shadows, isDark) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: 15, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary },

  // Tab bar — flat horizontal, not scrollable
  tabRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
  tabBtnActive: { borderBottomColor: colors.primary },
  tabText: { color: colors.textTertiary, fontSize: 12, fontFamily: Typography.fontFamily.medium },
  tabTextActive: { color: colors.primary, fontFamily: Typography.fontFamily.bold },

  addBtn: {
    backgroundColor: colors.primary,
    marginHorizontal: Spacing.md,
    marginVertical: 10,
    padding: 12,
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  addBtnText: { color: colors.white, fontFamily: Typography.fontFamily.bold, fontSize: 12 },

  playerCard: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: Spacing.md,
    borderRadius: 12,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  playerIndex: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  playerIndexText: { color: colors.textTertiary, fontSize: 11, fontFamily: Typography.fontFamily.bold },
  avatarImg: { width: 44, height: 44, borderRadius: 22 },
  avatarPlaceholder: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center' },
  playerName: { color: colors.textPrimary, fontFamily: Typography.fontFamily.bold, fontSize: 14 },
  playerRole: { color: colors.primary, fontSize: 12, marginTop: 2 },
  playerSub: { color: colors.textTertiary, fontSize: 11, marginTop: 2 },
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
    backgroundColor: colors.surface,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  statsBannerItem: { flex: 1, alignItems: 'center', paddingVertical: 16, gap: 4 },
  statsBannerNum: { fontSize: 24, fontFamily: Typography.fontFamily.bold, color: colors.primary, marginTop: 4 },
  statsBannerLbl: { fontSize: 10, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5 },
  statsBannerDivider: { width: 1, backgroundColor: colors.border, marginVertical: 12 },

  // ── Create Sets: Section Card ──
  configSection: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 12,
  },
  configSectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 12 },
  configStepBadge: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.primary + '22',
    borderWidth: 1.5,
    borderColor: colors.primary + '55',
    justifyContent: 'center', alignItems: 'center',
  },
  configStepNum: { color: colors.primary, fontSize: 13, fontFamily: Typography.fontFamily.bold },
  configSectionTitle: { color: colors.textPrimary, fontSize: 14, fontFamily: Typography.fontFamily.bold },
  configSectionSub: { color: colors.textTertiary, fontSize: 11, marginTop: 2 },

  // ── Strategy Cards ──
  strategyRow: { flexDirection: 'row', gap: 10 },
  strategyCard: {
    flex: 1, padding: 14, borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1.5, borderColor: colors.border,
    alignItems: 'center', position: 'relative',
  },
  strategyCardActive: { borderColor: colors.primary, backgroundColor: colors.primary + '0A' },
  strategyIconBox: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.surface,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 8,
  },
  strategyTitle: { color: colors.textSecondary, fontSize: 13, fontFamily: Typography.fontFamily.bold, textAlign: 'center' },
  strategyDesc: { color: colors.textTertiary, fontSize: 10, textAlign: 'center', marginTop: 4, lineHeight: 15 },
  strategyCheck: {
    position: 'absolute', top: 8, right: 8,
    backgroundColor: colors.primary + '22',
    borderRadius: 10, padding: 2,
    borderWidth: 1, borderColor: colors.primary + '44',
  },

  // ── Counter ──
  counterRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  counterBtn: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: colors.surface,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  counterBtnText: { color: colors.textPrimary, fontSize: 24, fontFamily: Typography.fontFamily.bold },
  counterValBox: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    height: 54, backgroundColor: colors.primary + '0D',
    borderRadius: 12, borderWidth: 1.5, borderColor: colors.primary + '44',
  },
  counterVal: { color: colors.primary, fontSize: 26, fontFamily: Typography.fontFamily.bold, textAlign: 'center', width: '100%', padding: 0, margin: 0 },

  // ── Financial Row ──
  financialRow: { flexDirection: 'row', gap: 10 },
  financialField: {
    flex: 1, backgroundColor: colors.surface,
    borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 12,
  },
  financialIcon: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 8,
  },
  financialLabel: { color: colors.textTertiary, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  financialInput: {
    color: colors.textPrimary, fontSize: 18,
    fontFamily: Typography.fontFamily.bold,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    paddingBottom: 4,
  },

  // ── Generate Button ──
  generateSummaryBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 10, padding: 10,
    marginBottom: 12, borderWidth: 1, borderColor: colors.border,
  },
  generateSummaryText: { color: colors.textTertiary, fontSize: 12, flex: 1 },
  generateBtn: {
    backgroundColor: colors.primary,
    height: 54, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center', flexDirection: 'row',
  },
  generateBtnText: { color: '#000', fontFamily: Typography.fontFamily.bold, fontSize: 15 },

  // Legacy compat
  card: { backgroundColor: colors.surface, padding: Spacing.lg, borderRadius: 16, borderWidth: 1, borderColor: colors.border },
  cardTitle: { color: colors.textPrimary, fontSize: 16, fontFamily: Typography.fontFamily.bold, marginBottom: Spacing.md },
  controlLabel: { color: colors.textSecondary, fontSize: 13, marginTop: Spacing.md, marginBottom: 10 },
  hintText: { color: colors.textTertiary, fontSize: 12, marginVertical: Spacing.lg, lineHeight: 18 },
  primaryBtn: { backgroundColor: colors.primary, height: 50, borderRadius: 12, justifyContent: 'center', alignItems: 'center', flexDirection: 'row' },
  primaryBtnText: { color: colors.white, fontFamily: Typography.fontFamily.bold, fontSize: 14 },

  // ── Sets Tab ──
  setsHeader: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 14, borderWidth: 1, borderColor: colors.border,
    marginBottom: 14, overflow: 'hidden',
  },
  setsHeaderStat: { flex: 1, alignItems: 'center', paddingVertical: 14 },
  setsHeaderNum: { fontSize: 20, fontFamily: Typography.fontFamily.bold, color: colors.primary },
  setsHeaderLbl: { fontSize: 10, color: colors.textTertiary, marginTop: 2, textTransform: 'uppercase' },

  setCard: {
    backgroundColor: colors.surface,
    borderRadius: 14, marginBottom: 10,
    borderWidth: 1, borderColor: colors.border,
    overflow: 'hidden',
  },
  setCardInner: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  setNumCircle: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5,
  },
  setNumText: { fontSize: 15, fontFamily: Typography.fontFamily.bold },
  setCardName: { color: colors.textPrimary, fontFamily: Typography.fontFamily.bold, fontSize: 14 },
  setCardSub: { color: colors.textTertiary, fontSize: 11, marginTop: 2 },
  setProgressBg: { height: 4, backgroundColor: colors.surface, borderRadius: 2, marginTop: 8 },
  setProgressFill: { height: 4, borderRadius: 2 },
  setStatusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 10, borderWidth: 1,
  },
  setStatusText: { fontSize: 10, fontFamily: Typography.fontFamily.semiBold },
  setPlayersList: { borderTopWidth: 1, borderTopColor: colors.border, padding: 10, backgroundColor: colors.surface },
  miniPlayerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5, gap: 8 },
  miniIdx: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center' },
  miniIdxText: { color: colors.textTertiary, fontSize: 10, fontFamily: Typography.fontFamily.bold },
  miniPlayerName: { color: colors.textPrimary, fontSize: 12, fontFamily: Typography.fontFamily.medium, flex: 1 },
  miniRoleTag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  miniRoleText: { fontSize: 10, fontFamily: Typography.fontFamily.semiBold },
  morePlayersText: { color: colors.primary, fontSize: 11, textAlign: 'center', marginTop: 6, opacity: 0.8 },

  // ── Legacy compat for sets ──
  setContainer: { backgroundColor: colors.surface, borderRadius: 12, marginBottom: Spacing.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  setCardHeader: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md },
  setIndexCircle: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(99,102,241,0.15)', justifyContent: 'center', alignItems: 'center' },
  setIndexText: { color: '#818CF8', fontSize: 13, fontFamily: Typography.fontFamily.bold },
  setName: { color: colors.textPrimary, fontFamily: Typography.fontFamily.bold, fontSize: 14 },
  setSub: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  statusChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginRight: 4 },
  statusText: { fontSize: 10, fontFamily: Typography.fontFamily.bold },
  miniPlayerIdx: { color: colors.textTertiary, fontSize: 11, width: 20, textAlign: 'right' },
  miniPlayerRole: { color: colors.textSecondary, fontSize: 11 },

  emptyBox: { alignItems: 'center', justifyContent: 'center', padding: Spacing.xl, marginTop: 30 },
  emptyTitle: { color: colors.textPrimary, fontFamily: Typography.fontFamily.bold, fontSize: 16, marginTop: Spacing.md },
  emptyText: { color: colors.textTertiary, marginTop: 6, fontSize: 13, textAlign: 'center' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: Spacing.lg, maxHeight: '85%', borderWidth: 1, borderColor: colors.border },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  modalTitle: { fontSize: 18, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary },

  label: {
    color: isDark ? colors.textTertiary : colors.textSecondary,
    fontSize: 11,
    fontFamily: Typography.fontFamily.bold,
    letterSpacing: 0.6,
    marginBottom: 6,
    marginTop: 14,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 46,
    color: colors.textPrimary,
    fontFamily: Typography.fontFamily.medium,
  },
  lookupBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
    shadowColor: colors.primary,
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  photoBox: { width: 70, height: 70, borderRadius: 35, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.background, borderWidth: 1.5, borderColor: colors.border, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  photoImg: { width: 70, height: 70, borderRadius: 35 },
  chipGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : colors.background,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.45,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
  chipText: { color: colors.textSecondary, fontSize: 12, fontFamily: Typography.fontFamily.medium },
  chipTextActive: { color: '#000', fontFamily: Typography.fontFamily.bold, fontSize: 12 },
  submitBtn: {
    backgroundColor: colors.primary,
    height: 52,
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    shadowColor: colors.primary,
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  submitBtnText: { color: '#000', fontFamily: Typography.fontFamily.bold, fontSize: 15, letterSpacing: 0.4 },

  // ── Remove Player ──
  removePlayerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    gap: 4,
  },
  removePlayerText: {
    color: '#EF4444',
    fontSize: 11,
    fontFamily: Typography.fontFamily.semiBold,
  },

  // ── Mode Switcher ──
  modeToggleRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modeToggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
  },
  modeToggleBtnActive: {
    backgroundColor: colors.primary,
  },
  modeToggleText: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.semiBold,
    color: colors.textTertiary,
  },
  modeToggleTextActive: {
    color: '#000',
    fontFamily: Typography.fontFamily.bold,
  },

  // ── Custom Sets Styles ──
  customSectionTitle: {
    fontSize: 15,
    fontFamily: Typography.fontFamily.bold,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  customSectionSub: {
    fontSize: 12,
    color: colors.textTertiary,
    marginBottom: 14,
  },
  customSetCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 14,
  },
  customSetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  customSetBadge: {
    backgroundColor: colors.primary + '22',
    borderWidth: 1,
    borderColor: colors.primary + '55',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  customSetBadgeText: {
    color: colors.primary,
    fontSize: 11,
    fontFamily: Typography.fontFamily.bold,
    letterSpacing: 0.5,
  },
  customSetNameHeading: {
    fontSize: 14,
    fontFamily: Typography.fontFamily.bold,
    color: colors.textPrimary,
  },
  deleteSetBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  customFieldLabel: {
    fontSize: 11,
    fontFamily: Typography.fontFamily.semiBold,
    color: colors.textSecondary,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  customInput: {
    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.textPrimary,
    fontSize: 14,
    fontFamily: Typography.fontFamily.medium,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  presetPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginRight: 6,
  },
  presetPillActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '18',
  },
  presetPillText: {
    fontSize: 11,
    color: colors.textTertiary,
    fontFamily: Typography.fontFamily.medium,
  },
  presetPillTextActive: {
    color: colors.primary,
    fontFamily: Typography.fontFamily.bold,
  },
  customPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
  },
  customPriceIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary + '18',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  customPriceInput: {
    flex: 1,
    color: colors.primary,
    fontSize: 16,
    fontFamily: Typography.fontFamily.bold,
    paddingVertical: 10,
  },
  selectPlayersBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  selectPlayersBtnText: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 13,
    fontFamily: Typography.fontFamily.semiBold,
  },
  playerChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  playerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)',
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  playerChipAvatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
    marginRight: 5,
  },
  playerChipAvatarPlaceholder: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primary + '22',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 5,
  },
  playerChipInitials: {
    fontSize: 9,
    fontFamily: Typography.fontFamily.bold,
    color: colors.primary,
  },
  playerChipName: {
    fontSize: 11,
    color: colors.textPrimary,
    fontFamily: Typography.fontFamily.medium,
    maxWidth: 100,
  },
  addSetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.primary + '88',
    borderRadius: 14,
    paddingVertical: 14,
    marginVertical: 4,
  },
  addSetBtnText: {
    color: colors.primary,
    fontSize: 13,
    fontFamily: Typography.fontFamily.bold,
    letterSpacing: 0.5,
  },

  // ── No Custom Sets Empty State ──
  noCustomSetsCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: isDark ? 'rgba(255,255,255,0.08)' : colors.border,
    borderStyle: 'dashed',
    paddingVertical: 32,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginVertical: 12,
  },
  noCustomSetsIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: `${colors.primary}18`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  noCustomSetsTitle: {
    fontSize: 17,
    fontFamily: Typography.fontFamily.bold,
    color: colors.textPrimary,
    marginBottom: 6,
  },
  noCustomSetsSub: {
    fontSize: 13,
    color: colors.textTertiary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
    paddingHorizontal: 12,
  },
  addFirstSetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  addFirstSetBtnText: {
    color: '#000',
    fontFamily: Typography.fontFamily.bold,
    fontSize: 13,
    letterSpacing: 0.5,
  },

  // ── Player Selection Modal Styles ──
  playerSelectModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  playerSelectModalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 24,
    height: '85%',
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 20,
  },
  modalSheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignSelf: 'center',
    marginBottom: 12,
  },
  playerSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  playerSearchInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 13,
    paddingVertical: 8,
  },
  roleFilterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 6,
  },
  roleFilterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  roleFilterChipText: {
    fontSize: 11,
    color: colors.textTertiary,
    fontFamily: Typography.fontFamily.medium,
  },
  roleFilterChipTextActive: {
    color: '#000',
    fontFamily: Typography.fontFamily.bold,
  },
  pickerPlayerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginBottom: 6,
  },
  pickerPlayerCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '0D',
  },
  pickerCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  pickerCheckboxActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  pickerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    resizeMode: 'contain',
    backgroundColor: '#0a0f1d',
  },
  pickerAvatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerAvatarInitials: {
    fontSize: 14,
    fontFamily: Typography.fontFamily.bold,
    color: colors.primary,
  },
  pickerPlayerName: {
    fontSize: 13,
    fontFamily: Typography.fontFamily.bold,
    color: colors.textPrimary,
  },
  pickerPlayerSub: {
    fontSize: 11,
    color: colors.textTertiary,
    marginTop: 1,
  },
  otherSetBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  otherSetBadgeText: {
    color: '#F59E0B',
    fontSize: 10,
    fontFamily: Typography.fontFamily.semiBold,
  },
  doneBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  doneBtnText: {
    color: '#000',
    fontFamily: Typography.fontFamily.bold,
    fontSize: 14,
    letterSpacing: 0.5,
  },
});

export default AuctionCreateSetsScreen;
