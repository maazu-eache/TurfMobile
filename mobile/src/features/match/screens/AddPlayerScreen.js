import React, { useMemo, useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme, Typography, Spacing, BorderRadius } from '../../../theme/theme';
import api from '../../../api/axios';
import { showCustomAlert } from '../../../components/CustomAlert';

const AddPlayerScreen = ({ route, navigation }) => {
  const { colors, shadows, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const safeTop = Math.max(insets?.top || 0, Platform.OS === 'ios' ? 44 : 0);
  const styles = useMemo(() => createStyles(colors, shadows, isDark), [colors, shadows, isDark]);
  const { teamId, onPlayerAdded, onClose, roster = [], oppositionRoster = [], squad = [] } = route.params || {};

  const [mobile, setMobile] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  
  const [searchResult, setSearchResult] = useState(null);
  const [isSearching, setIsSearching] = useState(false);

  const scrollRef = useRef(null);
  const nameInputRef = useRef(null);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (onClose) {
        onClose();
      }
    });
    return unsubscribe;
  }, [navigation, onClose]);

  useEffect(() => {
    if (searchResult && !searchResult.exists) {
      const timer = setTimeout(() => {
        scrollRef.current?.scrollToEnd?.({ animated: true });
        nameInputRef.current?.focus();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [searchResult]);

  const nonSquadPlayers = roster.filter(p => !squad.some(s => s._id === p._id));

  const handleSearchPlayer = async (mobArg) => {
    const searchMob = typeof mobArg === 'string' && mobArg.length === 10 ? mobArg : mobile;
    if (!searchMob || searchMob.length < 10) {
      return showCustomAlert('Error', 'Please enter a valid 10-digit mobile number');
    }
    setIsSearching(true);
    setSearchResult(null);
    try {
      const res = await api.get(`/players/lookup/${searchMob}`);
      setSearchResult(res.data.data);
      if (res.data.data.exists) {
        setName(res.data.data.player.name || '');
      }
    } catch (e) {
      showCustomAlert('Error', 'Failed to search player');
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddPlayer = async () => {
    if (!mobile || mobile.length < 10) {
      showCustomAlert('Error', 'Please enter a valid 10-digit mobile number.');
      return;
    }

    if (!searchResult?.exists && !name.trim()) {
      showCustomAlert('Error', 'Please enter the player\'s name.');
      return;
    }

    if (searchResult?.exists && searchResult.player) {
      if (oppositionRoster.some(p => p._id === searchResult.player._id)) {
        showCustomAlert('Error', 'Player is already present in the opposition team.');
        return;
      }
      
      const existingPlayer = roster.find(p => p._id === searchResult.player._id);
      if (existingPlayer) {
        if (onPlayerAdded) onPlayerAdded(existingPlayer);
        navigation.goBack();
        return;
      }
    }

    setLoading(true);
    try {
    const payload = {
      mobile,
      role: 'player',
      matchId: route.params?.matchId
    };
    if (!searchResult?.exists) {
      payload.name = name.trim();
    }

      const res = await api.post(`/teams/${teamId}/players`, payload);
      const newPlayer = res.data.data.player;
      
      showCustomAlert('Success', 'Player added successfully', [
        { text: 'OK', onPress: () => {
          if (onPlayerAdded) {
            onPlayerAdded(newPlayer);
          }
          navigation.goBack();
        }}
      ]);
    } catch (e) {
      showCustomAlert('Error', e.response?.data?.message || 'Failed to add player');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: safeTop }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="chevron-left" size={28} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Player</Text>
        <View style={{ width: 28 }} />
      </View>

      <KeyboardAwareScrollView 
        ref={scrollRef}
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        enableOnAndroid={true} 
        extraScrollHeight={Platform.OS === 'ios' ? 100 : 140} 
        keyboardShouldPersistTaps="handled"
        enableResetScrollToCoords={false}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.label}>Mobile Number</Text>
        <View style={styles.inputContainer}>
          <Icon name="phone-outline" size={20} color={colors.textTertiary} style={{ marginRight: Spacing.sm }} />
          <TextInput
            style={styles.textInputStyle}
            placeholder="10-digit mobile number"
            placeholderTextColor={colors.textTertiary}
            keyboardType="phone-pad"
            value={mobile}
            onChangeText={(val) => {
              if (val === mobile) return;
              setMobile(val);
              setSearchResult(null);
              if (val.length === 10) {
                handleSearchPlayer(val);
              }
            }}
            maxLength={10}
          />
          {isSearching && (
            <View style={{ paddingHorizontal: Spacing.md }}>
              <ActivityIndicator color={colors.primary} size="small" />
            </View>
          )}
        </View>

        {searchResult && searchResult.exists && (
          <View style={styles.foundPlayerCard}>
            <View style={styles.foundHeader}>
              <Icon name="check-decagram" size={16} color={colors.accent} style={{ marginRight: 6 }} />
              <Text style={styles.foundText}>Player Found!</Text>
            </View>
            <View style={styles.profileRow}>
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>{searchResult.player.name.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.selectedPlayerName}>{searchResult.player.name}</Text>
                <Text style={styles.playerSubtext}>Registered User</Text>
              </View>
            </View>
          </View>
        )}

        {searchResult && !searchResult.exists && (
          <View style={{ marginTop: Spacing.lg }}>
            <Text style={styles.label}>Player Name</Text>
            <View style={[styles.singleInputContainer, styles.singleInputContainerFocused]}>
              <Icon name="account-outline" size={20} color={colors.primary} style={{ marginRight: Spacing.sm }} />
              <TextInput
                ref={nameInputRef}
                style={styles.textInputStyle}
                placeholder="Full Name"
                placeholderTextColor={colors.textTertiary}
                value={name}
                onChangeText={setName}
                returnKeyType="done"
                onSubmitEditing={handleAddPlayer}
                blurOnSubmit={false}
              />
            </View>
            <Text style={styles.helperText}>
              User not registered. Enter name to add as a temporary player.
            </Text>
          </View>
        )}

        {(!searchResult && !mobile) && (
          <View style={{ marginTop: Spacing.xl }}>
            <Text style={styles.label}>Players in Team (Not in Playing XI)</Text>
            {nonSquadPlayers.length > 0 ? (
              nonSquadPlayers.map((p, idx) => (
                <TouchableOpacity
                  key={p._id + '_' + idx}
                  style={styles.rosterPlayerCard}
                  onPress={() => {
                    if (onPlayerAdded) onPlayerAdded(p);
                    navigation.goBack();
                  }}
                >
                  <View style={styles.avatarPlaceholderSm}>
                    <Text style={styles.avatarTextSm}>{p.name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalListText}>{p.name}</Text>
                  </View>
                  <Icon name="plus-circle-outline" size={20} color={colors.primary} />
                </TouchableOpacity>
              ))
            ) : (
              <Text style={styles.helperText}>No one in the team to select.</Text>
            )}
          </View>
        )}
        <View style={{ height: 24 }} />
      </KeyboardAwareScrollView>

      <View style={styles.footer}>
        <TouchableOpacity 
          style={[styles.addBtn, (!searchResult && !mobile) && styles.addBtnDisabled]} 
          onPress={handleAddPlayer} 
          disabled={loading || (!searchResult && !mobile)}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.addBtnText}>Add Player</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const createStyles = (colors, shadows, isDark) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, overflow: 'hidden' },
  scrollView: { flex: 1 },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1, 
    borderBottomColor: colors.borderLight 
  },
  backBtn: { padding: 4 },
  headerTitle: { fontFamily: Typography.fontFamily.semiBold, fontSize: 18, color: colors.textPrimary },
  content: { padding: Spacing.base, flexGrow: 1 },
  label: { 
    fontFamily: Typography.fontFamily.bold, 
    fontSize: 12, 
    color: colors.textSecondary, 
    marginBottom: Spacing.xs, 
    marginTop: Spacing.base,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceVariant,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: BorderRadius.md,
    paddingLeft: Spacing.sm,
    height: 52,
    overflow: 'hidden',
  },
  singleInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceVariant,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.sm,
    height: 52,
  },
  singleInputContainerFocused: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(255,204,0,0.05)',
  },
  textInputStyle: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 15,
    fontFamily: Typography.fontFamily.regular,
    paddingVertical: 0,
  },
  fetchBtn: { 
    backgroundColor: colors.accent, 
    flexDirection: 'row',
    height: '100%',
    paddingHorizontal: Spacing.lg, 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  fetchBtnText: { color: '#fff', fontFamily: Typography.fontFamily.bold, fontSize: 14 },
  helperText: { fontFamily: Typography.fontFamily.regular, fontSize: 12, color: colors.textTertiary, marginTop: Spacing.sm, fontStyle: 'italic' },
  footer: {
    padding: Spacing.base,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    backgroundColor: colors.surface,
  },
  addBtn: { backgroundColor: colors.primary, padding: 16, borderRadius: BorderRadius.md, alignItems: 'center' },
  addBtnDisabled: { opacity: 0.5 },
  addBtnText: { fontFamily: Typography.fontFamily.bold, fontSize: 16, color: '#000' },
  foundPlayerCard: { 
    backgroundColor: colors.primaryAlpha10, 
    padding: Spacing.base, 
    borderRadius: BorderRadius.md, 
    marginTop: Spacing.lg, 
    borderWidth: 1, 
    borderColor: colors.primaryAlpha20 
  },
  foundHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  foundText: { color: colors.primary, fontFamily: Typography.fontFamily.bold, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarPlaceholder: { 
    width: 44, 
    height: 44, 
    borderRadius: 22, 
    backgroundColor: colors.primaryAlpha20, 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginRight: Spacing.base 
  },
  avatarText: {
    color: colors.primary,
    fontFamily: Typography.fontFamily.bold,
    fontSize: 18,
  },
  selectedPlayerName: { fontFamily: Typography.fontFamily.semiBold, fontSize: 16, color: colors.textPrimary },
  playerSubtext: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  rosterPlayerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  avatarPlaceholderSm: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  avatarTextSm: {
    color: colors.textSecondary,
    fontFamily: Typography.fontFamily.bold,
    fontSize: 14,
  },
  modalListText: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: 14,
    color: colors.textPrimary,
  }
});

export default AddPlayerScreen;
