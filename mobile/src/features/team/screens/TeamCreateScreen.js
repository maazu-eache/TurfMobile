import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import React, { useState, useMemo } from 'react';
import LocationAutocomplete from '../../../components/LocationAutocomplete';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator, Switch, ScrollView, Image, KeyboardAvoidingView, Platform, StatusBar,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { useDispatch } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createTeam, addPlayerToTeam } from '../teamSlice';
import { useTheme, Typography, BorderRadius } from '../../../theme/theme';
import Icon from 'react-native-vector-icons/Ionicons';
import { getImageUrl } from '../../../api/axios';
import api from '../../../api/axios';
import { showCustomAlert } from '../../../components/CustomAlert';

// ─── InputField defined OUTSIDE component to prevent re-mount on keystroke ───
const InputField = ({ label, value, onChangeText, placeholder, error, keyboardType = 'default', icon, fieldStyles, colors }) => (
  <View style={fieldStyles.wrapper}>
    <Text style={fieldStyles.label}>{label} <Text style={fieldStyles.required}>*</Text></Text>
    <View style={fieldStyles.inputRow}>
      {icon && (
        <View style={fieldStyles.iconBox}>
          <Icon name={icon} size={18} color={colors.textTertiary} />
        </View>
      )}
      <TextInput
        style={[fieldStyles.input, icon && fieldStyles.inputWithIcon, error && fieldStyles.inputError]}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        autoCapitalize={keyboardType === 'phone-pad' ? 'none' : 'words'}
      />
    </View>
    {error ? <Text style={fieldStyles.errorText}>{error}</Text> : null}
  </View>
);

const createFieldStyles = (colors) => StyleSheet.create({
  wrapper: { marginTop: 14 },
  label: {
    fontSize: 11,
    fontFamily: Typography.fontFamily.semiBold,
    color: colors.textTertiary,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  required: { color: colors.error },
  inputRow: { flexDirection: 'row', alignItems: 'center' },
  iconBox: {
    position: 'absolute',
    left: 14,
    zIndex: 1,
  },
  input: {
    flex: 1,
    backgroundColor: colors.surfaceVariant,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: colors.textPrimary,
    fontFamily: Typography.fontFamily.medium,
  },
  inputWithIcon: { paddingLeft: 42 },
  inputError: { borderColor: colors.error },
  errorText: { fontSize: 12, color: colors.error, marginTop: 4, fontFamily: Typography.fontFamily.regular },
});

const getRoleColors = (colors, isDark) => ({
  player:         { bg: isDark ? 'rgba(120,120,120,0.15)' : colors.surfaceVariant, text: colors.textSecondary },
  vice_captain:   { bg: isDark ? 'rgba(33,150,243,0.15)' : '#EFF6FF',  text: '#2196F3' },
  wicket_keeper:  { bg: isDark ? 'rgba(255,143,0,0.15)' : '#FFFBEB',   text: colors.warning },
  admin:          { bg: isDark ? 'rgba(76,175,80,0.15)' : '#F0FDF4',    text: '#4CAF50' },
  captain:        { bg: colors.primaryAlpha20,     text: isDark ? colors.primary : colors.primaryDark },
});

const ROLES = ['player', 'vice_captain', 'wicket_keeper', 'admin'];
const ROLE_LABELS = { player: 'Player', vice_captain: 'Vice Captain', wicket_keeper: 'WK', admin: 'Admin' };

const createStyles = (colors, shadows, isDark) => StyleSheet.create({
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    ...(isDark ? {} : shadows.xs),
  },
  headerBtn: { width: 44 },
  backBtnCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: isDark ? colors.background : colors.surfaceVariant,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: Typography.fontFamily.bold,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  headerSub: {
    fontSize: 11,
    fontFamily: Typography.fontFamily.regular,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: 1,
  },

  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 20 },

  // Identity card (logo + fields)
  identityCard: {
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.xl,
    padding: 20,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
    ...(isDark ? {} : shadows.sm),
  },
  logoWrapper: {
    alignSelf: 'center',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: isDark ? colors.background : colors.surfaceVariant,
    borderWidth: 2,
    borderColor: colors.primaryAlpha30,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'visible',
  },
  logoPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoPreview: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  cameraRing: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
    ...(isDark ? {} : shadows.sm),
  },
  logoHint: {
    textAlign: 'center',
    fontSize: 11,
    fontFamily: Typography.fontFamily.regular,
    color: colors.textTertiary,
    marginTop: 8,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 18,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start' },

  // Generic section
  section: {
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.xl,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
    ...(isDark ? {} : shadows.sm),
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 15,
    fontFamily: Typography.fontFamily.bold,
    color: colors.textPrimary,
    flex: 1,
  },
  sectionSub: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.regular,
    color: colors.textSecondary,
    marginBottom: 14,
    lineHeight: 18,
  },
  countBubble: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  countBubbleText: {
    fontSize: 11,
    fontFamily: Typography.fontFamily.bold,
    color: colors.textOnPrimary,
  },

  // Toggle
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  toggleIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primaryAlpha10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggleLabel: {
    fontSize: 15,
    fontFamily: Typography.fontFamily.semiBold,
    color: colors.textPrimary,
  },
  toggleSub: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.regular,
    color: colors.textSecondary,
    marginTop: 2,
  },
  captainBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  captainBadgeText: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.medium,
    color: colors.success,
  },

  // Shared form
  fieldWrapper: { marginTop: 14 },
  label: {
    fontSize: 11,
    fontFamily: Typography.fontFamily.semiBold,
    color: colors.textTertiary,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  required: { color: colors.error },
  errorText: { fontSize: 12, color: colors.error, marginTop: 4, fontFamily: Typography.fontFamily.regular },

  // Lookup row
  lookupRow: { flexDirection: 'row', gap: 10 },
  lookupInput: {
    flex: 1,
    backgroundColor: colors.surfaceVariant,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: colors.textPrimary,
    fontFamily: Typography.fontFamily.medium,
  },
  inputError: { borderColor: colors.error },
  lookupBtn: {
    backgroundColor: colors.primary,
    borderRadius: BorderRadius.md,
    paddingHorizontal: 18,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 80,
  },
  lookupBtnDisabled: { backgroundColor: colors.border },
  lookupBtnText: { color: colors.textOnPrimary, fontFamily: Typography.fontFamily.bold, fontSize: 14 },

  // Profile card (admin manager)
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDark ? colors.background : colors.surfaceVariant,
    borderRadius: BorderRadius.lg,
    padding: 12,
    marginTop: 14,
    borderWidth: 1,
    borderColor: colors.success + '50',
    gap: 12,
  },
  profileAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.primaryAlpha20,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  profileAvatarImg: { width: 50, height: 50, borderRadius: 25 },
  profileName: { fontSize: 15, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary },
  profileMeta: { fontSize: 12, fontFamily: Typography.fontFamily.regular, color: colors.textSecondary, marginTop: 2 },
  captainTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primaryAlpha20,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  captainTagText: { fontSize: 11, fontFamily: Typography.fontFamily.bold, color: isDark ? colors.primary : colors.primaryDark },

  // Notice box
  noticeBox: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: colors.warningLight || 'rgba(255,143,0,0.1)',
    borderRadius: BorderRadius.md,
    padding: 10,
    marginTop: 10,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: colors.warning + '30',
  },
  noticeText: {
    flex: 1,
    fontSize: 12,
    color: colors.warning,
    fontFamily: Typography.fontFamily.regular,
    lineHeight: 18,
  },

  // Mobile search bar (squad builder)
  mobileSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDark ? colors.background : colors.surfaceVariant,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 6,
    height: 50,
  },
  mobileSearchInput: {
    flex: 1,
    paddingHorizontal: 10,
    fontSize: 15,
    color: colors.textPrimary,
    fontFamily: Typography.fontFamily.medium,
  },

  // Role chips
  roleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12, marginTop: 10 },
  roleChip: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : colors.surfaceVariant,
  },
  roleChipActive: { 
    borderColor: colors.primary, 
    backgroundColor: colors.primary,
  },
  roleChipText: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.medium,
    color: colors.textSecondary,
  },
  roleChipTextActive: {
    color: colors.textOnPrimary,
    fontFamily: Typography.fontFamily.bold,
  },

  // Found card / name input card (squad)
  foundCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDark ? colors.background : colors.surfaceVariant,
    borderRadius: BorderRadius.lg,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.success + '60',
    gap: 10,
    marginBottom: 2,
  },
  noNameCard: { marginBottom: 2 },
  nameInputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  nameInput: {
    backgroundColor: isDark ? colors.background : colors.surfaceVariant,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.textPrimary,
    fontFamily: Typography.fontFamily.medium,
  },

  foundAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryAlpha10,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  foundAvatarImg: { width: 44, height: 44, borderRadius: 22 },
  foundName: { fontSize: 14, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary },
  foundMeta: { fontSize: 12, fontFamily: Typography.fontFamily.regular, color: colors.textSecondary, marginTop: 2 },

  addPlayerBtn: {
    flexDirection: 'row',
    backgroundColor: colors.success,
    borderRadius: BorderRadius.md,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    gap: 4,
    ...(isDark ? {} : shadows.sm),
  },
  addPlayerBtnText: { color: colors.white, fontSize: 13, fontFamily: Typography.fontFamily.bold },

  // Staged list
  stagedSection: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 14,
  },
  stagedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  stagedTitle: {
    fontSize: 11,
    fontFamily: Typography.fontFamily.bold,
    color: colors.textTertiary,
    letterSpacing: 0.8,
  },
  stagedCount: {
    fontSize: 11,
    fontFamily: Typography.fontFamily.medium,
    color: colors.primary,
  },
  stagedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDark ? colors.background : colors.surfaceVariant,
    borderRadius: BorderRadius.md,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  stagedAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  stagedAvatarImg: { width: 34, height: 34, borderRadius: 17 },
  stagedName: { fontSize: 14, fontFamily: Typography.fontFamily.semiBold, color: colors.textPrimary },
  stagedMobile: { fontSize: 11, fontFamily: Typography.fontFamily.regular, color: colors.textTertiary },
  removeBtn: { padding: 4 },

  miniPill: { borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  miniPillText: { fontSize: 10, fontFamily: Typography.fontFamily.semiBold },

  // Create button
  createBtn: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    borderRadius: BorderRadius.xl,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    ...shadows.md,
  },
  createBtnDisabled: { opacity: 0.7 },
  createBtnText: {
    color: colors.textOnPrimary,
    fontSize: 16,
    fontFamily: Typography.fontFamily.bold,
    letterSpacing: 0.3,
  },
});

const TeamCreateScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();
  const { colors, shadows, isDark } = useTheme();

  const styles = useMemo(() => createStyles(colors, shadows, isDark), [colors, shadows, isDark]);
  const fieldStyles = useMemo(() => createFieldStyles(colors), [colors]);
  const ROLE_COLORS = useMemo(() => getRoleColors(colors, isDark), [colors, isDark]);

  // Form fields
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [cityObj, setCityObj] = useState(null);
  const [stateName, setStateName] = useState('');
  const [logo, setLogo] = useState(null);
  const [addMyself, setAddMyself] = useState(true);

  // Admin player (when addMyself is off)
  const [adminMobile, setAdminMobile] = useState('');
  const [adminName, setAdminName] = useState('');
  const [lookedUpPlayer, setLookedUpPlayer] = useState(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupDone, setLookupDone] = useState(false);

  // Staged players for creation
  const [stagedPlayers, setStagedPlayers] = useState([]);
  const [playerMobile, setPlayerMobile] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [playerRole, setPlayerRole] = useState('player');
  const [playerLookedUp, setPlayerLookedUp] = useState(null);
  const [playerLookupLoading, setPlayerLookupLoading] = useState(false);
  const [playerLookupDone, setPlayerLookupDone] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const validate = () => {
    const e = {};
    if (!name.trim()) e.name = 'Team name is required';
    if (!city.trim()) e.city = 'City is required';
    if (!stateName.trim()) e.state = 'State is required';
    if (!addMyself) {
      if (!adminMobile.trim()) {
        e.adminMobile = 'A player mobile number is required to manage the team';
      } else if (!lookupDone) {
        e.adminMobile = 'Tap Search to look up this mobile number first';
      } else {
        if (!lookedUpPlayer && !adminName.trim()) {
          e.adminName = 'Player name is required since no profile was found';
        }
        if (lookedUpPlayer && !lookedUpPlayer.name && !adminName.trim()) {
          e.adminName = "Please enter this player's name";
        }
      }
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handlePickImage = async () => {
    const result = await launchImageLibrary({ mediaType: 'photo', quality: 0.8 });
    if (result.assets?.length > 0) {
      const selected = result.assets[0];
      if (selected.fileSize && selected.fileSize > 3 * 1024 * 1024) {
        showCustomAlert('File Too Large', 'Please select an image smaller than 3MB.');
        return;
      }
      setLogo(selected);
    }
  };

  const handlePlayerMobileChange = async (text) => {
    setPlayerMobile(text);
    setPlayerLookedUp(null);
    setPlayerLookupDone(false);
    if (text.length === 10) {
      setPlayerLookupLoading(true);
      try {
        const res = await api.get(`/players/lookup/${text.trim()}`);
        if (res.data.data?.exists) {
          setPlayerLookedUp(res.data.data.player);
          setPlayerName(res.data.data.player.name || '');
        } else {
          setPlayerLookedUp(null);
          setPlayerName('');
        }
      } catch {
        setPlayerLookedUp(null);
        setPlayerName('');
      } finally {
        setPlayerLookupLoading(false);
        setPlayerLookupDone(true);
      }
    }
  };

  const handleStagePlayer = () => {
    const mobileNum = playerMobile.trim();
    if (!mobileNum || mobileNum.length < 10) {
      showCustomAlert('Error', 'Please enter a valid 10-digit mobile number');
      return;
    }
    const finalName = playerName.trim() || playerLookedUp?.name || '';
    if (!finalName) {
      showCustomAlert('Error', "Please enter player's name");
      return;
    }
    if (stagedPlayers.some(p => p.mobile === mobileNum)) {
      showCustomAlert('Error', `Player with mobile ${mobileNum} is already in the list`);
      return;
    }
    setStagedPlayers(prev => [...prev, {
      mobile: mobileNum,
      name: finalName,
      role: playerRole,
      photo: playerLookedUp?.photo,
    }]);
    setPlayerMobile('');
    setPlayerName('');
    setPlayerRole('player');
    setPlayerLookedUp(null);
    setPlayerLookupDone(false);
  };

  const handleLookup = async () => {
    if (!adminMobile.trim() || adminMobile.length < 10) {
      setErrors(prev => ({ ...prev, adminMobile: 'Enter a valid 10-digit mobile number' }));
      return;
    }
    setErrors(prev => ({ ...prev, adminMobile: null }));
    setLookupLoading(true);
    setLookedUpPlayer(null);
    setLookupDone(false);
    try {
      const res = await api.get(`/players/lookup/${adminMobile.trim()}`);
      setLookedUpPlayer(res.data.data?.exists ? res.data.data.player : null);
    } catch {
      setLookedUpPlayer(null);
    } finally {
      setLookupLoading(false);
      setLookupDone(true);
    }
  };

  const handleCreate = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('name', name.trim());
      formData.append('city', city.trim());
      formData.append('state', stateName.trim());
      formData.append('addMyself', String(addMyself));
      if (logo) {
        formData.append('logo', { uri: logo.uri, type: logo.type || 'image/jpeg', name: logo.fileName || 'logo.jpg' });
      }

      const res = await dispatch(createTeam(formData)).unwrap();
      const teamId = res._id;

      const playerPromises = [];
      if (!addMyself) {
        const finalName = adminName.trim() || lookedUpPlayer?.name || '';
        playerPromises.push(dispatch(addPlayerToTeam({ teamId, mobile: adminMobile.trim(), name: finalName, role: 'captain' })).unwrap());
      }
      stagedPlayers.forEach(p => {
        playerPromises.push(dispatch(addPlayerToTeam({ teamId, mobile: p.mobile, name: p.name, role: p.role })).unwrap());
      });
      if (playerPromises.length > 0) await Promise.all(playerPromises);

      const fromTournamentId = route.params?.fromTournamentId;
      if (fromTournamentId) {
        if (navigation.canGoBack()) {
          navigation.goBack();
        }
        navigation.navigate('TournamentDetail', { tournamentId: fromTournamentId, id: fromTournamentId, action: 'join-team' });
      } else {
        navigation.replace('TeamDetail', { id: teamId });
      }
    } catch (err) {
      const msg = typeof err === 'string' ? err : (err?.message || 'Failed to create team. Please try again.');
      showCustomAlert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.surface} />

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <View style={styles.backBtnCircle}>
            <Icon name="arrow-back" size={20} color={colors.textPrimary} />
          </View>
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.headerTitle}>Create Team</Text>
          <Text style={styles.headerSub}>Set up your cricket squad</Text>
        </View>
        <View style={styles.headerBtn} />
      </View>

      <KeyboardAwareScrollView enableOnAndroid={true} extraScrollHeight={20} enableResetScrollToCoords={false} keyboardShouldPersistTaps="handled" style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* ── Team Identity Card ── */}
        <View style={styles.identityCard}>
          {/* Logo Picker */}
          <TouchableOpacity onPress={handlePickImage} style={styles.logoWrapper} activeOpacity={0.8}>
            {logo ? (
              <Image source={{ uri: logo.uri }} style={styles.logoPreview} />
            ) : (
              <View style={styles.logoPlaceholder}>
                <Icon name="shield" size={44} color={colors.primary} />
              </View>
            )}
            <View style={styles.cameraRing}>
              <Icon name="camera" size={14} color={colors.textOnPrimary} />
            </View>
          </TouchableOpacity>
          <Text style={styles.logoHint}>{logo ? 'Tap to change logo (Max 3 MB)' : 'Tap to add team logo (Max 3 MB)'}</Text>
          <Text style={{ color: isDark ? colors.primary : colors.primaryDark, fontSize: 12, marginTop: 4, fontFamily: Typography.fontFamily.medium, textAlign: 'center' }}>
            Note: Maximum image size allowed is under 3 MB.
          </Text>

          <View style={styles.divider} />

          <InputField
            label="Team Name"
            value={name}
            onChangeText={setName}
            placeholder="e.g. Decolz Sports"
            error={errors.name}
            icon="shield-outline"
            fieldStyles={fieldStyles}
            colors={colors}
          />
          <View style={[styles.row, { alignItems: 'flex-start' }]}>
            <View style={[fieldStyles.wrapper, { flex: 1 }]}>
              <Text style={fieldStyles.label}>City <Text style={fieldStyles.required}>*</Text></Text>
              <LocationAutocomplete
                value={city}
                onChangeText={setCity}
                onSelectLocation={(loc) => {
                  setCity(loc ? loc.name : '');
                  setCityObj(loc || null);
                  if (loc && loc.state) setStateName(loc.state);
                }}
                placeholder="Search..."
                variant="outlined"
                error={errors.city}
                icon="location-outline"
              />
              {errors.city ? <Text style={fieldStyles.errorText}>{errors.city}</Text> : null}
            </View>
            <View style={{ width: 10 }} />
            <View style={{ flex: 1 }}>
              <InputField
                label="State"
                value={stateName}
                onChangeText={setStateName}
                placeholder="Maharashtra"
                error={errors.state}
                icon="map-outline"
                fieldStyles={fieldStyles}
                colors={colors}
              />
            </View>
          </View>
        </View>

        {/* ── Add Myself Toggle ── */}
        <View style={styles.section}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleIconWrap}>
              <Icon name="person-circle-outline" size={22} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleLabel}>Join as Captain</Text>
              <Text style={styles.toggleSub}>Add yourself to the team as captain</Text>
            </View>
            <Switch
              value={addMyself}
              onValueChange={(v) => {
                setAddMyself(v);
                setErrors({});
                setLookedUpPlayer(null);
                setLookupDone(false);
                setAdminMobile('');
                setAdminName('');
              }}
              trackColor={{ false: colors.border, true: colors.primary + 'AA' }}
              thumbColor={addMyself ? colors.primary : colors.surface}
            />
          </View>
          {addMyself && (
            <View style={styles.captainBadgeRow}>
              <Icon name="checkmark-circle" size={14} color={colors.success} />
              <Text style={styles.captainBadgeText}>You'll be added as Team Captain</Text>
            </View>
          )}
        </View>

        {/* ── Admin Player (when not adding myself) ── */}
        {!addMyself && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Icon name="person-add-outline" size={18} color={colors.primary} />
              <Text style={styles.sectionTitle}>Team Manager</Text>
            </View>
            <Text style={styles.sectionSub}>
              Since you're not joining, add a player who will manage and lead the team.
            </Text>

            <View style={styles.fieldWrapper}>
              <Text style={styles.label}>Player Mobile <Text style={styles.required}>*</Text></Text>
              <View style={styles.lookupRow}>
                <TextInput
                  style={[styles.lookupInput, errors.adminMobile && styles.inputError]}
                  placeholder="10-digit mobile number"
                  placeholderTextColor={colors.textTertiary}
                  value={adminMobile}
                  onChangeText={(t) => {
                    setAdminMobile(t);
                    setLookedUpPlayer(null);
                    setLookupDone(false);
                    setErrors(prev => ({ ...prev, adminMobile: null }));
                  }}
                  keyboardType="phone-pad"
                  maxLength={10}
                />
                <TouchableOpacity
                  style={[styles.lookupBtn, (adminMobile.length < 10 || lookupLoading) && styles.lookupBtnDisabled]}
                  onPress={handleLookup}
                  disabled={adminMobile.length < 10 || lookupLoading}
                >
                  {lookupLoading
                    ? <ActivityIndicator size="small" color={colors.textOnPrimary} />
                    : <Text style={styles.lookupBtnText}>Search</Text>}
                </TouchableOpacity>
              </View>
              {errors.adminMobile ? <Text style={styles.errorText}>{errors.adminMobile}</Text> : null}
            </View>

            {lookupDone && lookedUpPlayer && (
              <View>
                <View style={styles.profileCard}>
                  <View style={styles.profileAvatar}>
                    {lookedUpPlayer.photo
                      ? <Image source={{ uri: getImageUrl(lookedUpPlayer.photo) }} style={styles.profileAvatarImg} />
                      : <Icon name="person" size={28} color={colors.primary} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.profileName}>{adminName.trim() || lookedUpPlayer.name || '(No name set)'}</Text>
                    <Text style={styles.profileMeta}>
                      {[lookedUpPlayer.playingRole, lookedUpPlayer.battingStyle].filter(Boolean).join(' • ') || 'Cricket Player'}
                    </Text>
                  </View>
                  <View style={styles.captainTag}>
                    <Icon name="star" size={11} color={isDark ? colors.primary : colors.primaryDark} />
                    <Text style={styles.captainTagText}>Captain</Text>
                  </View>
                </View>

                {!lookedUpPlayer.name && (
                  <View>
                    <View style={styles.noticeBox}>
                      <Icon name="alert-circle-outline" size={16} color={colors.warning} />
                      <Text style={styles.noticeText}>Profile found but has no name. Please enter it.</Text>
                    </View>
                    <View style={styles.fieldWrapper}>
                      <Text style={styles.label}>Player Name <Text style={styles.required}>*</Text></Text>
                      <TextInput
                        style={[styles.lookupInput, { flex: undefined }, errors.adminName && styles.inputError]}
                        placeholder="Full name"
                        placeholderTextColor={colors.textTertiary}
                        value={adminName}
                        onChangeText={(t) => { setAdminName(t); setErrors(prev => ({ ...prev, adminName: null })); }}
                      />
                      {errors.adminName ? <Text style={styles.errorText}>{errors.adminName}</Text> : null}
                    </View>
                  </View>
                )}
              </View>
            )}

            {lookupDone && !lookedUpPlayer && (
              <View>
                <View style={[styles.noticeBox, { borderColor: colors.primary + '40', backgroundColor: colors.primaryAlpha10 }]}>
                  <Icon name="information-circle-outline" size={16} color={colors.primary} />
                  <Text style={[styles.noticeText, { color: isDark ? colors.primary : colors.primaryDark }]}>
                    No profile found. Enter their name to create a placeholder.
                  </Text>
                </View>
                <View style={styles.fieldWrapper}>
                  <Text style={styles.label}>Player Name <Text style={styles.required}>*</Text></Text>
                  <TextInput
                    style={[styles.lookupInput, { flex: undefined }, errors.adminName && styles.inputError]}
                    placeholder="Full name"
                    placeholderTextColor={colors.textTertiary}
                    value={adminName}
                    onChangeText={(t) => { setAdminName(t); setErrors(prev => ({ ...prev, adminName: null })); }}
                  />
                  {errors.adminName ? <Text style={styles.errorText}>{errors.adminName}</Text> : null}
                </View>
              </View>
            )}
          </View>
        )}

        {/* ── Squad Builder ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Icon name="people-outline" size={18} color={colors.primary} />
            <Text style={styles.sectionTitle}>Add Players to Squad</Text>
            {stagedPlayers.length > 0 && (
              <View style={styles.countBubble}>
                <Text style={styles.countBubbleText}>{stagedPlayers.length}</Text>
              </View>
            )}
          </View>
          <Text style={styles.sectionSub}>Search by mobile and stage players before creating the team.</Text>

          {/* Mobile search bar */}
          <View style={styles.mobileSearchBar}>
            <Icon name="call-outline" size={17} color={colors.textTertiary} style={{ marginLeft: 12 }} />
            <TextInput
              style={styles.mobileSearchInput}
              placeholder="Enter 10-digit mobile…"
              placeholderTextColor={colors.textTertiary}
              value={playerMobile}
              onChangeText={handlePlayerMobileChange}
              keyboardType="phone-pad"
              maxLength={10}
            />
            {playerLookupLoading && (
              <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: 12 }} />
            )}
            {!playerLookupLoading && playerMobile.length === 10 && (
              <Icon name="checkmark-circle" size={18} color={colors.success} style={{ marginRight: 12 }} />
            )}
          </View>

          {/* Role selector */}
          {playerLookupDone && (
            <View style={styles.roleRow}>
              {ROLES.map(r => (
                <TouchableOpacity
                  key={r}
                  style={[styles.roleChip, playerRole === r && { borderColor: ROLE_COLORS[r].text, backgroundColor: ROLE_COLORS[r].bg }]}
                  onPress={() => setPlayerRole(r)}
                >
                  <Text style={[styles.roleChipText, playerRole === r && { color: ROLE_COLORS[r].text }]}>
                    {ROLE_LABELS[r]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Found profile */}
          {playerLookupDone && playerLookedUp && playerLookedUp.name && (
            <View style={styles.foundCard}>
              <View style={styles.foundAvatar}>
                {playerLookedUp.photo
                  ? <Image source={{ uri: getImageUrl(playerLookedUp.photo) }} style={styles.foundAvatarImg} />
                  : <Icon name="person" size={22} color={colors.primary} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.foundName}>{playerLookedUp.name}</Text>
                <Text style={styles.foundMeta}>{playerLookedUp.playingRole || 'Cricket Player'}</Text>
              </View>
              <TouchableOpacity style={styles.addPlayerBtn} onPress={handleStagePlayer} activeOpacity={0.8}>
                <Icon name="add" size={16} color={colors.white} />
                <Text style={styles.addPlayerBtnText}>Add</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Profile exists but no name */}
          {playerLookupDone && playerLookedUp && !playerLookedUp.name && (
            <View style={styles.noNameCard}>
              <View style={styles.noticeBox}>
                <Icon name="information-circle-outline" size={15} color={colors.warning} />
                <Text style={styles.noticeText}>Profile found but has no name. Enter it below.</Text>
              </View>
              <View style={styles.nameInputRow}>
                <TextInput
                  style={[styles.nameInput, { flex: 1 }]}
                  placeholder="Full name"
                  placeholderTextColor={colors.textTertiary}
                  value={playerName}
                  onChangeText={setPlayerName}
                />
                <TouchableOpacity style={styles.addPlayerBtn} onPress={handleStagePlayer} activeOpacity={0.8}>
                  <Icon name="add" size={16} color={colors.white} />
                  <Text style={styles.addPlayerBtnText}>Add</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* No profile found */}
          {playerLookupDone && !playerLookedUp && (
            <View style={styles.noNameCard}>
              <View style={[styles.noticeBox, { backgroundColor: colors.primaryAlpha10 }]}>
                <Icon name="person-add-outline" size={15} color={colors.primary} />
                <Text style={[styles.noticeText, { color: isDark ? colors.primary : colors.primaryDark }]}>No profile found. Enter name to create one.</Text>
              </View>
              <View style={styles.nameInputRow}>
                <TextInput
                  style={[styles.nameInput, { flex: 1 }]}
                  placeholder="Full name"
                  placeholderTextColor={colors.textTertiary}
                  value={playerName}
                  onChangeText={setPlayerName}
                />
                <TouchableOpacity style={styles.addPlayerBtn} onPress={handleStagePlayer} activeOpacity={0.8}>
                  <Icon name="add" size={16} color={colors.white} />
                  <Text style={styles.addPlayerBtnText}>Add</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Staged list */}
          {stagedPlayers.length > 0 && (
            <View style={styles.stagedSection}>
              <View style={styles.stagedHeader}>
                <Text style={styles.stagedTitle}>STAGED SQUAD</Text>
                <Text style={styles.stagedCount}>{stagedPlayers.length} player{stagedPlayers.length !== 1 ? 's' : ''}</Text>
              </View>
              {stagedPlayers.map((item, idx) => {
                const rc = ROLE_COLORS[item.role] || ROLE_COLORS.player;
                return (
                  <View key={idx} style={styles.stagedItem}>
                    <View style={[styles.stagedAvatar, { backgroundColor: rc.bg }]}>
                      {item.photo
                        ? <Image source={{ uri: getImageUrl(item.photo) }} style={styles.stagedAvatarImg} />
                        : <Icon name="person" size={16} color={rc.text} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.stagedName} numberOfLines={1}>{item.name}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                        <Text style={styles.stagedMobile}>{item.mobile}</Text>
                        <View style={[styles.miniPill, { backgroundColor: rc.bg }]}>
                          <Text style={[styles.miniPillText, { color: rc.text }]}>
                            {ROLE_LABELS[item.role] || item.role}
                          </Text>
                        </View>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={styles.removeBtn}
                      onPress={() => setStagedPlayers(prev => prev.filter((_, i) => i !== idx))}
                    >
                      <Icon name="close-circle" size={20} color={colors.textTertiary} />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* ── Create Button ── */}
        <TouchableOpacity
          style={[styles.createBtn, loading && styles.createBtnDisabled]}
          onPress={handleCreate}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <>
              <ActivityIndicator color={colors.textOnPrimary} />
              <Text style={[styles.createBtnText, { marginLeft: 8 }]}>Creating...</Text>
            </>
          ) : (
            <>
              <Icon name="shield-checkmark" size={20} color={colors.textOnPrimary} style={{ marginRight: 8 }} />
              <Text style={styles.createBtnText}>Create Team</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={{ height: insets.bottom + 32 }} />
      </KeyboardAwareScrollView>
    </KeyboardAvoidingView>
  );
};

export default TeamCreateScreen;
