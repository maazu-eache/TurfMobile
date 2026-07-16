import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  Alert,
  TextInput,
  Modal,
  Platform,
  ActivityIndicator,
  RefreshControl,
  ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useDispatch } from 'react-redux';
import Icon from 'react-native-vector-icons/Feather';
import LinearGradient from 'react-native-linear-gradient';
import { Colors, Typography } from '../../../theme/theme';
import { addPlayerToTeam, getLastSquad, fetchMyTeams, fetchOpponentTeams, lookupPlayerByMobile, fetchTeamById } from '../../team/teamSlice';
import { getImageUrl } from '../../../api/axios';
import { showCustomAlert } from '../../../components/CustomAlert';

const SquadSelectionScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const dispatch = useDispatch();

  const {
    team,
    roster: initialRoster = [],
    selectedXI: initialSelectedXI = [],
    captain: initialCaptain = null,
    wk: initialWk = null,
    selectingFor,
    opposingXI = []
  } = route.params;

  const [roster, setRoster] = useState(initialRoster);
  const [selectedXI, setSelectedXI] = useState(initialSelectedXI);
  const [captain, setCaptain] = useState(initialCaptain);
  const [wk, setWk] = useState(initialWk);
  
  // Add Player Modal State
  const [isAddPlayerModalVisible, setAddPlayerModalVisible] = useState(false);
  const [mobileNumber, setMobileNumber] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [isAddingPlayer, setIsAddingPlayer] = useState(false);
  const [isFetchingLastSquad, setIsFetchingLastSquad] = useState(false);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupResult, setLookupResult] = useState(null); // Will hold player object if found
  const [refreshing, setRefreshing] = useState(false);
  const [pendingPlayers, setPendingPlayers] = useState([]);
  const [isBulkAdding, setIsBulkAdding] = useState(false);

  // Auto-lookup player when mobile number hits 10 digits
  React.useEffect(() => {
    const checkPlayer = async () => {
      if (mobileNumber.trim().length === 10) {
        setIsLookingUp(true);
        setLookupResult(null);
        try {
          const result = await dispatch(lookupPlayerByMobile(mobileNumber.trim())).unwrap();
          if (result && result.exists && result.player && result.player.name) {
            // Auto-add to pending list
            setPendingPlayers(prev => {
              const isAlreadyPending = prev.some(p => p.mobile === mobileNumber.trim());
              if (isAlreadyPending) {
                showCustomAlert('Notice', 'Player is already in the pending list');
                return prev;
              }
              return [...prev, {
                mobile: mobileNumber.trim(),
                name: result.player.name,
                photo: result.player.photo,
                isRegistered: true
              }];
            });
            // Clear inputs for the next player
            setMobileNumber('');
            setPlayerName('');
            setLookupResult(null);
          }
        } catch (error) {
          // Not registered, leave lookupResult as null so they can type name
        } finally {
          setIsLookingUp(false);
        }
      } else {
        setLookupResult(null); // Reset if they delete digits
      }
    };
    checkPlayer();
  }, [mobileNumber, dispatch]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      // Re-fetch the team from the backend to get any newly registered players
      const fetchedTeam = await dispatch(fetchTeamById(team._id)).unwrap();
      
      // Update roster and apply sorting immediately
      let latestRoster = fetchedTeam?.players || roster;
      const newRoster = [...latestRoster].sort((a, b) => {
        const aSelected = selectedXI.includes(a.player?._id);
        const bSelected = selectedXI.includes(b.player?._id);
        if (aSelected && !bSelected) return -1;
        if (!aSelected && bSelected) return 1;
        return 0;
      });
      setRoster(newRoster);
    } catch (error) {
      // Fallback to just sorting the local state if fetch fails
      handleSortSelected();
    } finally {
      setRefreshing(false);
    }
  };

  const handleSortSelected = () => {
    setRoster(prev => {
      const newRoster = [...prev];
      return newRoster.sort((a, b) => {
        const aSelected = selectedXI.includes(a.player?._id);
        const bSelected = selectedXI.includes(b.player?._id);
        if (aSelected && !bSelected) return -1;
        if (!aSelected && bSelected) return 1;
        return 0;
      });
    });
  };

  const togglePlayerXI = (playerId) => {
    if (selectedXI.includes(playerId)) {
      setSelectedXI((prev) => prev.filter((id) => id !== playerId));
      if (captain === playerId) setCaptain(null);
      if (wk === playerId) setWk(null);
    } else {
      if (opposingXI.includes(playerId)) {
        showCustomAlert('Cannot Select Player', 'This player is already in the opposing squad. A player cannot play for both teams.');
      } else {
        setSelectedXI((prev) => [...prev, playerId]);
        if (!captain) setCaptain(playerId);
      }
    }
  };

  const handleDone = () => {
    if (route.params?.onDone) {
      route.params.onDone(selectedXI, captain, wk, selectingFor);
    }
    navigation.goBack();
  };

  // Auto-refresh roster on mount to prevent stale data from previous screens
  React.useEffect(() => {
    onRefresh();
  }, []);

  const handleQueuePlayer = () => {
    if (!mobileNumber.trim()) {
      return showCustomAlert('Error', 'Please enter a mobile number');
    }
    if (mobileNumber.trim().length !== 10) {
      return showCustomAlert('Error', 'Mobile number must be 10 digits');
    }
    if (!playerName.trim()) {
      return showCustomAlert('Error', 'Please provide a player name');
    }
    
    // Check if already in pending list
    const isAlreadyPending = pendingPlayers.some(p => p.mobile === mobileNumber.trim());
    if (isAlreadyPending) {
       return showCustomAlert('Error', 'This player is already in the pending list');
    }
    
    setPendingPlayers(prev => [...prev, {
      mobile: mobileNumber.trim(),
      name: playerName.trim(),
      photo: null,
      isRegistered: false
    }]);
    
    setMobileNumber('');
    setPlayerName('');
    setLookupResult(null);
  };

  const handleBulkSubmit = async () => {
    if (pendingPlayers.length === 0) return;
    
    setIsBulkAdding(true);
    let successCount = 0;
    let skippedPlayers = [];
    
    try {
      for (const player of pendingPlayers) {
        try {
          await dispatch(addPlayerToTeam({
            teamId: team._id,
            mobile: player.mobile,
            name: player.name
          })).unwrap();
          successCount++;
        } catch (err) {
          if (typeof err === 'string' && err.toLowerCase().includes('already in this team')) {
            skippedPlayers.push(player.name);
          } else {
            // Log or ignore non-critical errors so the rest can process
            console.warn(`Failed to add ${player.name}:`, err);
          }
        }
      }
      
      let alertMsg = `Successfully added ${successCount} player(s) to the team.`;
      if (skippedPlayers.length > 0) {
        alertMsg += `\n\nSkipped: ${skippedPlayers.join(', ')} (Already in team).`;
      }
      showCustomAlert('Done', alertMsg);
      
      setPendingPlayers([]);
      setAddPlayerModalVisible(false);
      await onRefresh();
      
      dispatch(fetchMyTeams());
      dispatch(fetchOpponentTeams());
    } finally {
      setIsBulkAdding(false);
    }
  };

  const handleSameSquad = async () => {
    setIsFetchingLastSquad(true);
    try {
      const lastSquad = await dispatch(getLastSquad(team._id)).unwrap();
      if (lastSquad && lastSquad.length > 0) {
        // Filter out players who are in opposing XI
        const validSquad = lastSquad.filter(id => !opposingXI.includes(id));
        setSelectedXI(validSquad);
        if (validSquad.length > 0 && !validSquad.includes(captain)) {
           setCaptain(validSquad[0]);
        }
        if (lastSquad.length !== validSquad.length) {
          showCustomAlert('Notice', 'Some players from the last squad were excluded because they are in the opposing team.');
        }
      } else {
        showCustomAlert('Info', 'No past match squad found for this team.');
      }
    } catch (error) {
      showCustomAlert('Error', error || 'Failed to fetch last squad');
    } finally {
      setIsFetchingLastSquad(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            Playing Squad ({team?.name})
          </Text>
        </View>
        <TouchableOpacity onPress={handleDone}>
          <LinearGradient
            colors={Colors.primaryGradient || [Colors.primary, Colors.primaryLight]}
            style={styles.doneIconCircle}
          >
            <Icon name="check" size={20} color={Colors.background} />
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <View style={styles.selectedCountBanner}>
        <Text style={styles.selectedCountText}>
          Selected Players: <Text style={styles.greenText}>{selectedXI.length}</Text>
        </Text>
        {selectedXI.length > 0 && (
          <TouchableOpacity style={styles.sortButton} onPress={handleSortSelected}>
            <Icon name="arrow-up-circle" size={16} color={Colors.primary} />
            <Text style={styles.sortButtonText}>Sort to Top</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.actionButtonsRow}>
        <TouchableOpacity style={styles.actionButton} onPress={() => setAddPlayerModalVisible(true)}>
          <Icon name="user-plus" size={16} color={Colors.primary} />
          <Text style={styles.actionButtonText}>Add Player</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.actionButton} onPress={handleSameSquad} disabled={isFetchingLastSquad}>
          {isFetchingLastSquad ? (
             <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
             <>
               <Icon name="users" size={16} color={Colors.primary} />
               <Text style={styles.actionButtonText}>Same Squad</Text>
             </>
          )}
        </TouchableOpacity>
      </View>

      <FlatList
        data={roster}
        keyExtractor={(item) => item.player?._id || Math.random().toString()}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
        renderItem={({ item }) => {
          const p = item.player;
          if (!p) return null;
          const isSelected = selectedXI.includes(p._id);
          const isCaptain = captain === p._id;
          
          return (
            <TouchableOpacity style={styles.playerItemRow} onPress={() => togglePlayerXI(p._id)}>
              <View style={styles.playerAvatar}>
                {p.photo || p.userId?.photo ? (
                  <Image source={{ uri: getImageUrl(p.photo || p.userId?.photo) }} style={{ width: '100%', height: '100%' }} />
                ) : (
                  <Text style={styles.avatarText}>{p.name?.charAt(0).toUpperCase()}</Text>
                )}
              </View>
              <View style={styles.playerInfo}>
                <Text style={styles.playerName}>{p.name}</Text>
                <Text style={styles.playerRole}>{item.role || 'Player'}</Text>
              </View>

              {isSelected && (
                <View style={styles.badgesContainer}>
                  <TouchableOpacity 
                    style={[styles.roleBadge, isCaptain && styles.roleBadgeActive]}
                    onPress={() => setCaptain(p._id)}
                  >
                    <Text style={[styles.roleBadgeText, isCaptain && styles.roleBadgeTextActive]}>C</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[styles.roleBadge, wk === p._id && styles.roleBadgeActive]}
                    onPress={() => setWk(p._id)}
                  >
                    <Text style={[styles.roleBadgeText, wk === p._id && styles.roleBadgeTextActive]}>WK</Text>
                  </TouchableOpacity>
                </View>
              )}

              <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                {isSelected && <Icon name="check" size={14} color={Colors.background} />}
              </View>
            </TouchableOpacity>
          );
        }}
      />

      {/* Add Player Modal */}
      <Modal
        visible={isAddPlayerModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setAddPlayerModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.addPlayerModalContent}>
            <Text style={styles.modalTitle}>Add Player</Text>
            <Text style={styles.modalSubtitle}>Search by mobile number. If unregistered, provide a name to create a temporary player.</Text>
            
            <TextInput
              style={styles.input}
              placeholder="Mobile Number (e.g., 9876543210)"
              placeholderTextColor={Colors.textTertiary}
              keyboardType="phone-pad"
              value={mobileNumber}
              onChangeText={setMobileNumber}
            />
            
            {isLookingUp ? (
              <View style={styles.lookupContainer}>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={styles.lookupText}>Finding player...</Text>
              </View>
            ) : mobileNumber.trim().length === 10 ? (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0 }]}
                  placeholder="Player Name (if new)"
                  placeholderTextColor={Colors.textTertiary}
                  value={playerName}
                  onChangeText={setPlayerName}
                  onSubmitEditing={handleQueuePlayer}
                />
                <TouchableOpacity 
                  style={{ backgroundColor: Colors.primary, padding: 14, borderRadius: 8, marginLeft: 10, justifyContent: 'center', alignItems: 'center' }}
                  onPress={handleQueuePlayer}
                >
                  <Icon name="plus" size={20} color={Colors.background} />
                </TouchableOpacity>
              </View>
            ) : null}

            {pendingPlayers.length > 0 && (
               <View style={{ marginTop: 20, width: '100%' }}>
                  <Text style={{ color: Colors.textSecondary, marginBottom: 8, fontFamily: Typography.fontFamily.semiBold }}>Pending List ({pendingPlayers.length})</Text>
                  <KeyboardAwareScrollView enableOnAndroid={true} extraScrollHeight={20} keyboardShouldPersistTaps="handled" style={{ maxHeight: 160 }} showsVerticalScrollIndicator={false}>
                     {pendingPlayers.map((p, idx) => (
                        <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.surface, padding: 10, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: Colors.borderLight }}>
                           <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                             {p.photo ? (
                               <Image source={{ uri: getImageUrl(p.photo) }} style={{ width: 32, height: 32, borderRadius: 16, marginRight: 10 }} />
                             ) : (
                               <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.primaryAlpha20, justifyContent: 'center', alignItems: 'center', marginRight: 10 }}>
                                 <Text style={{ color: Colors.primary, fontSize: 12, fontFamily: Typography.fontFamily.bold }}>{p.name.charAt(0).toUpperCase()}</Text>
                               </View>
                             )}
                             <View>
                               <Text style={{ color: Colors.textPrimary, fontSize: 14, fontFamily: Typography.fontFamily.medium }}>{p.name}</Text>
                               <Text style={{ color: Colors.textTertiary, fontSize: 12 }}>{p.mobile}</Text>
                             </View>
                           </View>
                           <TouchableOpacity onPress={() => setPendingPlayers(prev => prev.filter((_, i) => i !== idx))} style={{ padding: 4 }}>
                             <Icon name="x" size={20} color={Colors.error} />
                           </TouchableOpacity>
                        </View>
                     ))}
                  </KeyboardAwareScrollView>
               </View>
            )}

            <View style={[styles.modalButtons, { marginTop: 24 }]}>
              <TouchableOpacity 
                style={styles.modalCancelButton} 
                onPress={() => {
                  setAddPlayerModalVisible(false);
                  setPendingPlayers([]);
                  setMobileNumber('');
                  setPlayerName('');
                  setLookupResult(null);
                }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalAddButton, { opacity: pendingPlayers.length === 0 ? 0.5 : 1 }]} 
                onPress={handleBulkSubmit}
                disabled={isBulkAdding || pendingPlayers.length === 0}
              >
                {isBulkAdding ? (
                  <ActivityIndicator color={Colors.background} size="small" />
                ) : (
                  <Text style={styles.modalAddText}>
                    Submit to Team
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
};

export default SquadSelectionScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    paddingBottom: 15,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  backButton: {
    padding: 5,
  },
  headerTitleContainer: {
    flex: 1,
    marginLeft: 15,
  },
  headerTitle: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.fontSize.lg,
    color: Colors.textPrimary,
  },
  doneIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedCountBanner: {
    backgroundColor: Colors.surface,
    paddingVertical: 12,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  selectedCountText: {
    fontFamily: Typography.fontFamily.medium,
    color: Colors.textSecondary,
    fontSize: 14,
  },
  greenText: {
    color: Colors.primary,
    fontFamily: Typography.fontFamily.bold,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryAlpha20 || 'rgba(154, 188, 47, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  sortButtonText: {
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.primary,
    fontSize: 12,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  actionButtonText: {
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.primary,
    fontSize: 14,
  },
  playerItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  playerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surfaceDark,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  avatarText: {
    fontFamily: Typography.fontFamily.bold,
    color: Colors.primary,
    fontSize: 18,
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.textPrimary,
    fontSize: 16,
  },
  playerRole: {
    fontFamily: Typography.fontFamily.regular,
    color: Colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  badgesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    marginRight: 6,
  },
  roleBadgeActive: {
    backgroundColor: Colors.primaryAlpha20 || 'rgba(154, 188, 47, 0.2)',
    borderColor: Colors.primary,
  },
  roleBadgeText: {
    fontFamily: Typography.fontFamily.bold,
    color: Colors.textSecondary,
    fontSize: 10,
  },
  roleBadgeTextActive: {
    color: Colors.primary,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.borderLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  addPlayerModalContent: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  modalTitle: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: 20,
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  modalSubtitle: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 20,
  },
  input: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: 8,
    padding: 12,
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.regular,
    fontSize: 15,
    marginBottom: 16,
  },
  lookupContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 12,
  },
  lookupText: {
    fontFamily: Typography.fontFamily.medium,
    color: Colors.textSecondary,
    marginLeft: 8,
    fontSize: 13,
  },
  foundPlayerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.successLight || 'rgba(46, 213, 115, 0.15)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.success || '#2ED573',
  },
  foundPlayerText: {
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.success || '#2ED573',
    marginLeft: 8,
    fontSize: 14,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 8,
  },
  modalCancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  modalCancelText: {
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.textSecondary,
    fontSize: 15,
  },
  modalAddButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  modalAddText: {
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.background,
    fontSize: 15,
  }
});
