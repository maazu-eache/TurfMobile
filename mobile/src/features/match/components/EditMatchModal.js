import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  ScrollView,
  Platform,
  Switch,
  Image,
  KeyboardAvoidingView
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme, Typography, Spacing, BorderRadius } from '../../../theme/theme';
import { showCustomAlert } from '../../../components/CustomAlert';
import LocationAutocomplete from '../../../components/LocationAutocomplete';
import api from '../../../api/axios';

const IMG_TENNIS = require('../../../../Tennis.jpeg');
const IMG_LEATHER = require('../../../../Leather.jpeg');
const IMG_OTHER = require('../../../../Others.jpeg');

// Exact options matching MatchSetupScreen.js
const MATCH_FORMATS = ['LIMITED OVERS', 'BOX CRICKET', 'PAIR CRICKET'];
const PITCH_TYPES = ['ROUGH', 'CEMENT', 'TURF', 'ASTROTURF', 'MATTING'];
const GROUND_TYPES = ['Open Ground', 'Indoor', 'Box Cricket', 'Other'];
const BALL_OPTIONS = [
  { label: 'Tennis', value: 'Tennis', img: IMG_TENNIS },
  { label: 'Leather', value: 'Leather', img: IMG_LEATHER },
  { label: 'Other', value: 'Other', img: IMG_OTHER },
];

const getValidFormat = (fmt) => {
  if (!fmt) return 'LIMITED OVERS';
  const u = String(fmt).toUpperCase();
  if (MATCH_FORMATS.includes(u)) return u;
  if (u === 'BOX_CRICKET' || u === 'BOX') return 'BOX CRICKET';
  if (u === 'PAIR_CRICKET' || u === 'PAIR') return 'PAIR CRICKET';
  return 'LIMITED OVERS';
};

const getValidPitchType = (pt) => {
  if (!pt) return 'TURF';
  const u = String(pt).toUpperCase();
  if (PITCH_TYPES.includes(u)) return u;
  return 'TURF';
};

const EditMatchModal = ({ visible, onClose, match, onUpdate }) => {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const safeBottom = Math.max(insets?.bottom || 0, Platform.OS === 'ios' ? 24 : 16);
  const styles = useMemo(() => createStyles(colors, isDark, safeBottom), [colors, isDark, safeBottom]);

  const [overs, setOvers] = useState('5');
  const [bowlerQuota, setBowlerQuota] = useState('1');
  const [wickets, setWickets] = useState('10');
  const [format, setFormat] = useState('LIMITED OVERS');
  const [ballType, setBallType] = useState('Tennis');
  const [pitchType, setPitchType] = useState('TURF');
  const [groundType, setGroundType] = useState('Open Ground');
  const [city, setCity] = useState('');
  const [cityObj, setCityObj] = useState(null);
  const [ground, setGround] = useState('');
  const [wagonWheel, setWagonWheel] = useState(true);
  const [isSingleWicket, setIsSingleWicket] = useState(false);

  const [activeDropdown, setActiveDropdown] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (match && visible) {
      setOvers(match.overs ? String(match.overs) : '5');
      setBowlerQuota(match.bowlerQuota ? String(match.bowlerQuota) : '1');
      setWickets(match.wickets ? String(match.wickets) : '10');
      setFormat(getValidFormat(match.format));
      setBallType(match.ballType || 'Tennis');
      setPitchType(getValidPitchType(match.pitchType));
      setGroundType(GROUND_TYPES.includes(match.groundType) ? match.groundType : 'Open Ground');
      setCity(match.city || '');
      setCityObj(match.locationObj || null);
      setGround(match.ground || match.venueDetails || '');
      setWagonWheel(match.wagonWheelEnabled !== false);
      setIsSingleWicket(!!match.isSingleWicketBatting);
    }
  }, [match, visible]);

  const handleSave = async () => {
    const oversNum = parseInt(overs, 10);
    const quotaNum = parseInt(bowlerQuota, 10);
    const wicketsNum = parseInt(wickets, 10);

    if (isNaN(oversNum) || oversNum < 1) {
      showCustomAlert('Invalid Input', 'Overs must be at least 1.');
      return;
    }
    if (isNaN(quotaNum) || quotaNum < 1) {
      showCustomAlert('Invalid Input', 'Overs per bowler must be at least 1.');
      return;
    }
    if (quotaNum > oversNum) {
      showCustomAlert('Invalid Input', 'Overs per bowler cannot exceed total match overs.');
      return;
    }
    if (isNaN(wicketsNum) || wicketsNum < 1) {
      showCustomAlert('Invalid Input', 'Total wickets must be at least 1.');
      return;
    }
    if (!city?.trim()) {
      showCustomAlert('Required', 'Please select or enter a city.');
      return;
    }

    setLoading(true);
    try {
      const matchId = match?._id || match?.id;
      const payload = {
        overs: oversNum,
        bowlerQuota: quotaNum,
        wickets: wicketsNum,
        format,
        ballType,
        pitchType,
        groundType,
        city: city.trim(),
        ground: ground.trim(),
        wagonWheelEnabled: wagonWheel,
        isSingleWicketBatting: isSingleWicket,
      };

      if (cityObj) {
        payload.locationObj = cityObj;
      }

      const res = await api.put(`/matches/${matchId}/details`, payload);
      showCustomAlert('Success', 'Match details updated successfully.');
      if (onUpdate) {
        onUpdate(res.data?.data?.liveState || res.data?.data?.match || payload);
      }
      onClose();
    } catch (err) {
      console.log('Error updating match details:', err);
      showCustomAlert('Error', err.response?.data?.message || 'Failed to update match details');
    } finally {
      setLoading(false);
    }
  };

  const renderChip = (label, isSelected, onPress) => (
    <TouchableOpacity
      key={label}
      style={[styles.chip, isSelected && styles.chipSelected]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const renderDropdownModal = (title, options, selectedValue, onSelect) => (
    <Modal visible={activeDropdown === title} transparent animationType="fade" onRequestClose={() => setActiveDropdown(null)}>
      <TouchableOpacity style={styles.dropdownOverlay} activeOpacity={1} onPress={() => setActiveDropdown(null)}>
        <View style={styles.dropdownContent}>
          <Text style={styles.dropdownTitle}>{title}</Text>
          <ScrollView style={{ maxHeight: 280 }} keyboardShouldPersistTaps="handled">
            {options.map((opt) => (
              <TouchableOpacity
                key={opt}
                style={[styles.dropdownItem, selectedValue === opt && { backgroundColor: `${colors.primary}18` }]}
                onPress={() => {
                  onSelect(opt);
                  setActiveDropdown(null);
                }}
              >
                <Text style={[styles.dropdownItemText, selectedValue === opt && { color: colors.primary, fontFamily: Typography.fontFamily.bold }]}>
                  {opt}
                </Text>
                {selectedValue === opt && <Icon name="check" size={18} color={colors.primary} />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBg}>
        <KeyboardAvoidingView
          style={styles.modalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={styles.iconCircle}>
                <Icon name="tune-variant" size={20} color={colors.primary} />
              </View>
              <View>
                <Text style={styles.headerTitle}>Edit Match Details</Text>
                <Text style={styles.headerSub}>Update overs, rules, city & venue</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Icon name="close" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <KeyboardAwareScrollView
            style={{ flexShrink: 1 }}
            enableOnAndroid={true}
            enableAutomaticScroll={true}
            extraScrollHeight={Platform.OS === 'ios' ? 40 : 120}
            extraHeight={Platform.OS === 'ios' ? 40 : 140}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* 1. MATCH TYPE / FORMAT */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Match Type</Text>
                <TouchableOpacity
                  style={styles.dropdownTriggerMini}
                  onPress={() => setActiveDropdown('Select Match Format')}
                >
                  <Text style={styles.dropdownTriggerMiniText}>Dropdown</Text>
                  <Icon name="chevron-down" size={14} color={colors.primary} />
                </TouchableOpacity>
              </View>
              <View style={styles.chipsContainer}>
                {MATCH_FORMATS.map((f) => renderChip(f, format === f, () => setFormat(f)))}
              </View>
            </View>

            {/* 2. MATCH OVERS CONFIGURATION */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Overs & Wickets</Text>
              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.fieldLabel}>No. of Overs *</Text>
                  <TextInput
                    style={styles.underlineInput}
                    keyboardType="numeric"
                    value={overs}
                    onChangeText={(val) => {
                      setOvers(val);
                      const n = parseInt(val, 10);
                      if (!isNaN(n) && n > 0) {
                        setBowlerQuota(Math.ceil(n / 5).toString());
                      }
                    }}
                    maxLength={2}
                    placeholder="5"
                    placeholderTextColor={colors.textTertiary}
                  />
                </View>

                <View style={[styles.inputGroup, { flex: 1, marginHorizontal: 8 }]}>
                  <Text style={styles.fieldLabel}>Wickets *</Text>
                  <TextInput
                    style={styles.underlineInput}
                    keyboardType="numeric"
                    value={wickets}
                    onChangeText={setWickets}
                    maxLength={2}
                    placeholder="10"
                    placeholderTextColor={colors.textTertiary}
                  />
                </View>

                <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                  <Text style={styles.fieldLabel}>Overs/Bowler *</Text>
                  <TextInput
                    style={styles.underlineInput}
                    keyboardType="numeric"
                    value={bowlerQuota}
                    onChangeText={setBowlerQuota}
                    maxLength={2}
                    placeholder="1"
                    placeholderTextColor={colors.textTertiary}
                  />
                </View>
              </View>
            </View>

            {/* 3. LOCATION & GROUND (USING LOCATION AUTOCOMPLETE API) */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Location & Ground</Text>
              <View style={styles.inputGroup}>
                <Text style={styles.fieldLabel}>City / Town *</Text>
                <LocationAutocomplete
                  value={city}
                  onChangeText={setCity}
                  onSelectLocation={(loc) => {
                    setCity(loc ? loc.name : '');
                    setCityObj(loc || null);
                  }}
                  placeholder="Search city or area..."
                  variant="outlined"
                />
              </View>

              <View style={[styles.inputGroup, { marginTop: Spacing.sm }]}>
                <Text style={styles.fieldLabel}>Ground Name / Venue *</Text>
                <TextInput
                  style={styles.underlineInput}
                  value={ground}
                  onChangeText={setGround}
                  placeholder="e.g. Shivaji Park Ground"
                  placeholderTextColor={colors.textTertiary}
                />
              </View>
            </View>

            {/* 4. BALL TYPE WITH IMAGE SELECTION & DROPDOWN */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Ball Type</Text>
                <TouchableOpacity
                  style={styles.dropdownTriggerMini}
                  onPress={() => setActiveDropdown('Select Ball Type')}
                >
                  <Text style={styles.dropdownTriggerMiniText}>Dropdown</Text>
                  <Icon name="chevron-down" size={14} color={colors.primary} />
                </TouchableOpacity>
              </View>
              <View style={styles.ballsRow}>
                {BALL_OPTIONS.map(({ label, value, img }) => {
                  const isSelected = ballType === value;
                  return (
                    <TouchableOpacity
                      key={value}
                      style={styles.ballOption}
                      onPress={() => setBallType(value)}
                      activeOpacity={0.8}
                    >
                      <View style={[styles.ballRing, isSelected && styles.ballRingSelected]}>
                        <View style={styles.ballCircle}>
                          <Image source={img} style={styles.ballImage} resizeMode="cover" />
                        </View>
                        {isSelected && (
                          <View style={styles.ballCheckedBadge}>
                            <Icon name="check-circle" size={18} color={colors.primary} />
                          </View>
                        )}
                      </View>
                      <Text style={[styles.ballLabel, isSelected && styles.ballLabelSelected]}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* 5. GROUND TYPE */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Ground Type</Text>
                <TouchableOpacity
                  style={styles.dropdownTriggerMini}
                  onPress={() => setActiveDropdown('Select Ground Type')}
                >
                  <Text style={styles.dropdownTriggerMiniText}>Dropdown</Text>
                  <Icon name="chevron-down" size={14} color={colors.primary} />
                </TouchableOpacity>
              </View>
              <View style={styles.chipsContainer}>
                {GROUND_TYPES.map((g) => renderChip(g, groundType === g, () => setGroundType(g)))}
              </View>
            </View>

            {/* 6. PITCH TYPE */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Pitch Type</Text>
                <TouchableOpacity
                  style={styles.dropdownTriggerMini}
                  onPress={() => setActiveDropdown('Select Pitch Type')}
                >
                  <Text style={styles.dropdownTriggerMiniText}>Dropdown</Text>
                  <Icon name="chevron-down" size={14} color={colors.primary} />
                </TouchableOpacity>
              </View>
              <View style={styles.chipsContainer}>
                {PITCH_TYPES.map((p) => renderChip(p, pitchType === p, () => setPitchType(p)))}
              </View>
            </View>

            {/* 7. WAGON WHEEL & SINGLE WICKET TOGGLES */}
            <View style={styles.sectionCard}>
              <View style={styles.toggleRow}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={styles.toggleTitle}>Wagon Wheel</Text>
                  <Text style={styles.toggleSubtitle}>Show Wagon Wheel for 1s, 2s and 3s</Text>
                </View>
                <Switch
                  value={wagonWheel}
                  onValueChange={setWagonWheel}
                  trackColor={{ false: isDark ? '#333' : '#E2E8F0', true: colors.primary }}
                  thumbColor="#FFF"
                />
              </View>

              <View style={[styles.toggleRow, { marginTop: Spacing.md, paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: colors.border }]}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={styles.toggleTitle}>Single Wicket Batting</Text>
                  <Text style={styles.toggleSubtitle}>Allow lone batter to continue scoring</Text>
                </View>
                <Switch
                  value={isSingleWicket}
                  onValueChange={setIsSingleWicket}
                  trackColor={{ false: isDark ? '#333' : '#E2E8F0', true: colors.primary }}
                  thumbColor="#FFF"
                />
              </View>
            </View>
          </KeyboardAwareScrollView>

          {/* STICKY FOOTER ACTION BUTTONS - Safe for all screens & navigation bars */}
          <View style={styles.footer}>
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={onClose}
                disabled={loading}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelBtnText} numberOfLines={1}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, loading && { opacity: 0.8 }]}
                onPress={handleSave}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#000000" />
                ) : (
                  <View style={styles.saveBtnContent}>
                    <Icon name="check" size={18} color="#000000" />
                    <Text
                      style={styles.saveBtnText}
                      numberOfLines={1}
                      adjustsFontSizeToFit={true}
                      minimumFontScale={0.85}
                    >
                      Update Match Details
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>

        {/* Dropdown Modals */}
        {renderDropdownModal('Select Match Format', MATCH_FORMATS, format, setFormat)}
        {renderDropdownModal('Select Ball Type', BALL_OPTIONS.map(b => b.value), ballType, setBallType)}
        {renderDropdownModal('Select Ground Type', GROUND_TYPES, groundType, setGroundType)}
        {renderDropdownModal('Select Pitch Type', PITCH_TYPES, pitchType, setPitchType)}
      </View>
    </Modal>
  );
};

const createStyles = (colors, isDark, safeBottom = 0) =>
  StyleSheet.create({
    modalBg: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.65)',
      justifyContent: 'flex-end',
    },
    modalContainer: {
      backgroundColor: colors.background,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: '92%',
      borderTopWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.surface,
    },
    iconCircle: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: `${colors.primary}20`,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerTitle: {
      fontSize: 17,
      fontFamily: Typography.fontFamily.bold,
      color: colors.textPrimary,
    },
    headerSub: {
      fontSize: 12,
      fontFamily: Typography.fontFamily.regular,
      color: colors.textSecondary,
      marginTop: 2,
    },
    closeBtn: {
      padding: 6,
      borderRadius: 16,
      backgroundColor: colors.surfaceVariant,
    },
    scrollContent: {
      padding: 16,
      paddingBottom: 24,
      gap: 14,
    },
    sectionCard: {
      backgroundColor: colors.surface,
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: Spacing.sm,
    },
    sectionTitle: {
      fontSize: 13,
      fontFamily: Typography.fontFamily.semiBold,
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    dropdownTriggerMini: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 12,
      backgroundColor: `${colors.primary}15`,
    },
    dropdownTriggerMiniText: {
      fontSize: 11,
      fontFamily: Typography.fontFamily.medium,
      color: colors.primary,
    },
    chipsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 4,
    },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 18,
      backgroundColor: colors.surfaceVariant,
      borderWidth: 1,
      borderColor: colors.border,
    },
    chipSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    chipText: {
      color: colors.textSecondary,
      fontSize: 12,
      fontFamily: Typography.fontFamily.medium,
    },
    chipTextSelected: {
      color: '#000000',
      fontFamily: Typography.fontFamily.bold,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 4,
    },
    inputGroup: {
      marginBottom: Spacing.xs,
    },
    fieldLabel: {
      color: colors.textSecondary,
      fontSize: 12,
      fontFamily: Typography.fontFamily.medium,
      marginBottom: 6,
    },
    underlineInput: {
      backgroundColor: colors.surfaceVariant,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: BorderRadius.sm,
      color: colors.textPrimary,
      fontSize: 15,
      fontFamily: Typography.fontFamily.semiBold,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    ballsRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginTop: 8,
    },
    ballOption: {
      alignItems: 'center',
    },
    ballRing: {
      width: 58,
      height: 58,
      borderRadius: 29,
      borderWidth: 2,
      borderColor: 'transparent',
      justifyContent: 'center',
      alignItems: 'center',
      position: 'relative',
    },
    ballRingSelected: {
      borderColor: colors.primary,
    },
    ballCircle: {
      width: 50,
      height: 50,
      borderRadius: 25,
      overflow: 'hidden',
    },
    ballImage: {
      width: '100%',
      height: '100%',
    },
    ballCheckedBadge: {
      position: 'absolute',
      top: -2,
      right: -2,
      backgroundColor: colors.surface,
      borderRadius: 10,
    },
    ballLabel: {
      marginTop: 6,
      fontSize: 12,
      fontFamily: Typography.fontFamily.medium,
      color: colors.textSecondary,
    },
    ballLabelSelected: {
      color: colors.textPrimary,
      fontFamily: Typography.fontFamily.bold,
    },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    toggleTitle: {
      fontSize: 14,
      fontFamily: Typography.fontFamily.semiBold,
      color: colors.textPrimary,
    },
    toggleSubtitle: {
      fontSize: 12,
      fontFamily: Typography.fontFamily.regular,
      color: colors.textTertiary,
      marginTop: 2,
    },
    footer: {
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: safeBottom + 8,
      elevation: 10,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -3 },
      shadowOpacity: isDark ? 0.35 : 0.08,
      shadowRadius: 4,
    },
    buttonRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    cancelBtn: {
      flex: 1,
      minHeight: 48,
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: BorderRadius.md,
      backgroundColor: colors.surfaceVariant,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cancelBtnText: {
      fontSize: 14,
      fontFamily: Typography.fontFamily.semiBold,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    saveBtn: {
      flex: 2,
      minHeight: 48,
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: BorderRadius.md,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    saveBtnContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    saveBtnText: {
      fontSize: 14,
      fontFamily: Typography.fontFamily.bold,
      color: '#000000',
      textAlign: 'center',
    },
    dropdownOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    dropdownContent: {
      backgroundColor: colors.surface,
      width: '84%',
      borderRadius: BorderRadius.lg,
      padding: 18,
      borderWidth: 1,
      borderColor: colors.border,
      maxHeight: 380,
    },
    dropdownTitle: {
      fontSize: 16,
      fontFamily: Typography.fontFamily.bold,
      color: colors.textPrimary,
      marginBottom: 12,
      paddingBottom: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    dropdownItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      paddingHorizontal: 10,
      borderRadius: BorderRadius.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    dropdownItemText: {
      fontSize: 14,
      fontFamily: Typography.fontFamily.medium,
      color: colors.textPrimary,
    },
  });

export default EditMatchModal;
