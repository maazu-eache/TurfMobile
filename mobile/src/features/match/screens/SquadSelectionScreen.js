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
import LinearGradient from '../../../components/SolidGradient';
import { useTheme, Typography, Spacing, BorderRadius } from '../../../theme/theme';
import { addPlayerToTeam, getLastSquad, fetchMyTeams, fetchOpponentTeams, lookupPlayerByMobile, fetchTeamById } from '../../team/teamSlice';
import { getImageUrl } from '../../../api/axios';
import { showCustomAlert } from '../../../components/CustomAlert';

const SquadSelectionScreen = () => {
  const { colors, shadows, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, shadows, isDark), [colors, shadows, isDark]);
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
    opposingXI = [],
    matchId,
    tournamentId
  } = route.params;

  // Normalize: selectedXI may contain full populated Player objects (from API) or plain string IDs.
  // Always store as plain string IDs so .includes() comparisons work correctly.
  const normalizeIds = (arr) =>
    (arr || []).map((item) => (typeof item === 'object' && item !== null ? String(item._id) : String(item)));

  const [roster, setRoster] = useState(initialRoster);
  const [selectedXI, setSelectedXI] = useState(() => normalizeIds(initialSelectedXI));
  const [captain, setCaptain] = useState(
    initialCaptain && typeof initialCaptain === 'object' ? String(initialCaptain._id) : (initialCaptain ? String(initialCaptain) : null)
  );
  const [wk, setWk] = useState(
    initialWk && typeof initialWk === 'object' ? String(initialWk._id) : (initialWk ? String(initialWk) : null)
  );

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
        const aSelected = selectedXI.includes(String(a.player?._id));
        const bSelected = selectedXI.includes(String(b.player?._id));
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
        const aSelected = selectedXI.includes(String(a.player?._id));
        const bSelected = selectedXI.includes(String(b.player?._id));
        if (aSelected && !bSelected) return -1;
        if (!aSelected && bSelected) return 1;
        return 0;
      });
    });
  };

  const togglePlayerXI = (playerId) => {
    const pid = String(playerId);
    if (selectedXI.includes(pid)) {
      setSelectedXI((prev) => prev.filter((id) => id !== pid));
      if (captain === pid) setCaptain(null);
      if (wk === pid) setWk(null);
    } else {
      const opposingNormalized = (opposingXI || []).map(id => String(typeof id === 'object' ? id._id : id));
      if (opposingNormalized.includes(pid)) {
        showCustomAlert('Cannot Select Player', 'This player is already in the opposing squad. A player cannot play for both teams.');
      } else {
        setSelectedXI((prev) => [...prev, pid]);
        // Do NOT auto-assign captain — user must explicitly tap C badge
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
            name: player.name,
            matchId,
            tournamentId
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
            colors={colors.primaryGradient || [colors.primary, colors.primaryLight]}
            style={styles.doneIconCircle}
          >
            <Icon name="check" size={20} color={colors.background} />
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <View style={styles.selectedCountBanner}>
        <Text style={styles.selectedCountText}>
          Selected Players: <Text style={styles.greenText}>{selectedXI.length}</Text>
        </Text>
        {selectedXI.length > 0 && (
          <TouchableOpacity style={styles.sortButton} onPress={handleSortSelected}>
            <Icon name="arrow-up-circle" size={16} color={colors.primary} />
            <Text style={styles.sortButtonText}>Sort to Top</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.actionButtonsRow}>
        <TouchableOpacity style={styles.actionButton} onPress={() => setAddPlayerModalVisible(true)}>
          <Icon name="user-plus" size={16} color={colors.primary} />
          <Text style={styles.actionButtonText}>Add Player</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={handleSameSquad} disabled={isFetchingLastSquad}>
          {isFetchingLastSquad ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <>
              <Icon name="users" size={16} color={colors.primary} />
              <Text style={styles.actionButtonText}>Same Squad</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <FlatList
        data={roster}
        keyExtractor={(item) => item.player?._id || Math.random().toString()}
        initialNumToRender={12}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={Platform.OS === 'android'}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        renderItem={({ item }) => {
          const p = item.player;
          if (!p) return null;
          const pid = String(p._id);
          const isSelected = selectedXI.includes(pid);
          const isCaptain = captain === pid;

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
                {isSelected && <Icon name="check" size={14} color={colors.background} />}
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
              placeholderTextColor={colors.textTertiary}
              keyboardType="phone-pad"
              value={mobileNumber}
              onChangeText={setMobileNumber}
            />

            {isLookingUp ? (
              <View style={styles.lookupContainer}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.lookupText}>Finding player...</Text>
              </View>
            ) : mobileNumber.trim().length === 10 ? (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0 }]}
                  placeholder="Player Name (if new)"
                  placeholderTextColor={colors.textTertiary}
                  value={playerName}
                  onChangeText={setPlayerName}
                  onSubmitEditing={handleQueuePlayer}
                />
                <TouchableOpacity
                  style={{ backgroundColor: colors.primary, padding: 14, borderRadius: 8, marginLeft: 10, justifyContent: 'center', alignItems: 'center' }}
                  onPress={handleQueuePlayer}
                >
                  <Icon name="plus" size={20} color={colors.background} />
                </TouchableOpacity>
              </View>
            ) : null}

            {pendingPlayers.length > 0 && (
              <View style={{ marginTop: 20, width: '100%' }}>
                <Text style={{ color: colors.textSecondary, marginBottom: 8, fontFamily: Typography.fontFamily.semiBold }}>Pending List ({pendingPlayers.length})</Text>
                <KeyboardAwareScrollView enableOnAndroid={true} extraScrollHeight={20} keyboardShouldPersistTaps="handled" style={{ maxHeight: 160 }} showsVerticalScrollIndicator={false}>
                  {pendingPlayers.map((p, idx) => (
                    <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, padding: 10, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: colors.borderLight }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        {p.photo ? (
                          <Image source={{ uri: getImageUrl(p.photo) }} style={{ width: 32, height: 32, borderRadius: 16, marginRight: 10 }} />
                        ) : (
                          <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primaryAlpha20, justifyContent: 'center', alignItems: 'center', marginRight: 10 }}>
                            <Text style={{ color: colors.primary, fontSize: 12, fontFamily: Typography.fontFamily.bold }}>{p.name.charAt(0).toUpperCase()}</Text>
                          </View>
                        )}
                        <View>
                          <Text style={{ color: colors.textPrimary, fontSize: 14, fontFamily: Typography.fontFamily.medium }}>{p.name}</Text>
                          <Text style={{ color: colors.textTertiary, fontSize: 12 }}>{p.mobile}</Text>
                        </View>
                      </View>
                      <TouchableOpacity onPress={() => setPendingPlayers(prev => prev.filter((_, i) => i !== idx))} style={{ padding: 4 }}>
                        <Icon name="x" size={20} color={colors.error} />
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
                  <ActivityIndicator color={colors.background} size="small" />
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

const createStyles = (colors, shadows, isDark) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    paddingBottom: 15,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
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
    color: colors.textPrimary,
  },
  doneIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedCountBanner: {
    backgroundColor: colors.surface,
    paddingVertical: 12,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  selectedCountText: {
    fontFamily: Typography.fontFamily.medium,
    color: colors.textSecondary,
    fontSize: 14,
  },
  greenText: {
    color: colors.primary,
    fontFamily: Typography.fontFamily.bold,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryAlpha20 || 'rgba(154, 188, 47, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  sortButtonText: {
    fontFamily: Typography.fontFamily.semiBold,
    color: colors.primary,
    fontSize: 12,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  actionButtonText: {
    fontFamily: Typography.fontFamily.semiBold,
    color: colors.primary,
    fontSize: 14,
  },
  playerItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  playerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceDark,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  avatarText: {
    fontFamily: Typography.fontFamily.bold,
    color: colors.primary,
    fontSize: 18,
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    fontFamily: Typography.fontFamily.semiBold,
    color: colors.textPrimary,
    fontSize: 16,
  },
  playerRole: {
    fontFamily: Typography.fontFamily.regular,
    color: colors.textSecondary,
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
    borderColor: colors.borderLight,
    marginRight: 6,
  },
  roleBadgeActive: {
    backgroundColor: colors.primaryAlpha20 || 'rgba(154, 188, 47, 0.2)',
    borderColor: colors.primary,
  },
  roleBadgeText: {
    fontFamily: Typography.fontFamily.bold,
    color: colors.textSecondary,
    fontSize: 10,
  },
  roleBadgeTextActive: {
    color: colors.primary,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.borderLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  addPlayerModalContent: {
    backgroundColor: colors.surface,
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
    color: colors.textPrimary,
    marginBottom: 8,
  },
  modalSubtitle: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 20,
  },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 8,
    padding: 12,
    color: colors.textPrimary,
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
    color: colors.textSecondary,
    marginLeft: 8,
    fontSize: 13,
  },
  foundPlayerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.successLight || 'rgba(46, 213, 115, 0.15)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.success || '#2ED573',
  },
  foundPlayerText: {
    fontFamily: Typography.fontFamily.semiBold,
    color: colors.success || '#2ED573',
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
    color: colors.textSecondary,
    fontSize: 15,
  },
  modalAddButton: {
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  modalAddText: {
    fontFamily: Typography.fontFamily.semiBold,
    color: colors.background,
    fontSize: 15,
  }
});
