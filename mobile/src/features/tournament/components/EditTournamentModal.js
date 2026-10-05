import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { launchImageLibrary } from 'react-native-image-picker';
import { useTheme, Typography, Spacing, BorderRadius } from '../../../theme/theme';
import { showCustomAlert } from '../../../components/CustomAlert';
import api, { getImageUrl } from '../../../api/axios';
import LocationAutocomplete from '../../../components/LocationAutocomplete';
import CustomDateTimePicker from '../../../components/common/CustomDateTimePicker';

const FORMAT_OPTIONS = ['League', 'Knockout', 'Round Robin', 'League + Knockout'];
const BALL_OPTIONS = ['Tennis', 'Leather', 'Rubber', 'Other'];
const GROUND_OPTIONS = ['Open Ground', 'Indoor', 'Box Cricket', 'Other'];
const TEAMS_OPTIONS = ['2', '4', '6', '8', '10', '12', '16', '24', '32', '36', '40', '44', '48', '64', '999'];
const PLAYERS_OPTIONS = ['5', '6', '7', '8', '9', '10', '11', '15'];
const OVERS_OPTIONS = ['3', '5', '8', '10', '12', '15', '20', '25', '30', '35', '40', '50'];
const WICKETS_OPTIONS = ['1', '2', '3', '5', '8', '10', '11'];
const TEAMS_PER_GROUP_OPTIONS = ['2', '3', '4', '5', '6', '8', '10'];
const RULE_SUGGESTIONS = [
  '75 speed limit',
  'No throwing / jerk bowling',
  'Max 1 bouncer per over',
  'Rubber ball rules apply',
  'Tennis ball rules apply',
  'No LBW',
  'Super over for tie',
  'Free hit for no-ball'
];
const CustomDropdown = ({ label, value, options, onSelect, styles, colors }) => {
  const [dropdownVisible, setDropdownVisible] = useState(false);
  return (
    <>
      <TouchableOpacity onPress={() => setDropdownVisible(true)} style={styles.input} activeOpacity={0.8}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: value ? colors.textPrimary : colors.textTertiary, fontFamily: Typography.fontFamily.medium, fontSize: 14 }}>
            {value || `Select ${label}`}
          </Text>
          <Icon name="chevron-down" size={16} color={colors.textTertiary} />
        </View>
      </TouchableOpacity>
      <Modal visible={dropdownVisible} transparent animationType="fade" onRequestClose={() => setDropdownVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setDropdownVisible(false)}>
          <View style={styles.dropdownModalContent}>
            <Text style={styles.modalTitle}>Select {label}</Text>
            <ScrollView style={{ maxHeight: 300 }} keyboardShouldPersistTaps="handled">
              {options.map(opt => (
                <TouchableOpacity
                  key={opt}
                  style={styles.modalOption}
                  onPress={() => {
                    onSelect(opt);
                    setDropdownVisible(false);
                  }}
                >
                  <Text style={[styles.modalOptionText, value === opt && { color: colors.primary, fontFamily: Typography.fontFamily.bold }]}>
                    {opt}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

const CustomNumberDropdown = ({ label, value, options, onChangeText, styles, colors }) => {
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  return (
    <>
      <View style={[styles.numberInputWrapper, isFocused && { borderColor: colors.primary }]}>
        <TextInput
          style={[styles.input, { flex: 1, borderWidth: 0, backgroundColor: 'transparent', height: '100%', paddingVertical: 0 }]}
          keyboardType="numeric"
          placeholderTextColor={colors.textTertiary}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
        />
        <TouchableOpacity onPress={() => setDropdownVisible(true)} style={styles.dropdownTrigger} activeOpacity={0.8}>
          <Icon name="chevron-down" size={16} color={colors.textTertiary} />
        </TouchableOpacity>
      </View>
      <Modal visible={dropdownVisible} transparent animationType="fade" onRequestClose={() => setDropdownVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setDropdownVisible(false)}>
          <View style={styles.dropdownModalContent}>
            <Text style={styles.modalTitle}>Select {label}</Text>
            <ScrollView style={{ maxHeight: 300 }} keyboardShouldPersistTaps="handled">
              {options.map(opt => (
                <TouchableOpacity
                  key={opt}
                  style={styles.modalOption}
                  onPress={() => {
                    onChangeText(opt);
                    setDropdownVisible(false);
                  }}
                >
                  <Text style={[styles.modalOptionText, value === opt && { color: colors.primary, fontFamily: Typography.fontFamily.bold }]}>
                    {opt}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

const EditTournamentModal = ({ visible, onClose, tournament, onRefresh }) => {
  const { colors, shadows, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const safeBottom = Math.max(insets?.bottom || 0, Platform.OS === 'ios' ? 24 : 16);
  const styles = useMemo(() => createStyles(colors, shadows, isDark, safeBottom), [colors, shadows, isDark, safeBottom]);

  const isAuction =
    tournament?.tournamentType === 'Auction' ||
    tournament?.isAuctionTournament === true ||
    tournament?.type === 'auction' ||
    !!tournament?.auctionDetails;

  const [form, setForm] = useState({
    name: '',
    description: '',
    banner: null,
    city: '',
    groundName: '',
    locationObj: null,
    format: 'League',
    ballType: 'Tennis',
    groundType: 'Open Ground',
    maxTeams: '',
    overs: '',
    wickets: '10',
    playersPerTeam: '11',
    teamsPerGroup: '',
    entryFee: '',
    winningPrize: '',
    runnerPrize: '',
    thirdPrize: '',
    startDate: '',
    endDate: '',
    registrationDeadline: '',
    organizerName: '',
    organizerMobile: ''
  });

  const [rules, setRules] = useState([]);
  const [newRule, setNewRule] = useState('');
  const [loading, setLoading] = useState(false);
  const [platformFeePercent, setPlatformFeePercent] = useState(10);

  // Date picker states
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerTarget, setDatePickerTarget] = useState(null);
  const [dateObj, setDateObj] = useState(new Date());

  useEffect(() => {
    if (tournament && visible) {
      const formatDate = d => {
        if (!d) return '';
        const date = new Date(d);
        if (isNaN(date.getTime())) return '';
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
      };

      setForm({
        name: tournament.name || '',
        description: tournament.description || '',
        banner: tournament.banner || null,
        city: tournament.city || '',
        groundName: tournament.groundName || '',
        locationObj: tournament.locationObj || null,
        format: tournament.format || 'League',
        ballType: tournament.ballType || 'Tennis',
        groundType: tournament.groundType || 'Open Ground',
        maxTeams: tournament.maxTeams !== undefined && tournament.maxTeams !== null ? tournament.maxTeams.toString() : '',
        overs: tournament.overs !== undefined && tournament.overs !== null ? tournament.overs.toString() : '',
        wickets: tournament.wickets !== undefined && tournament.wickets !== null ? tournament.wickets.toString() : '10',
        playersPerTeam: tournament.playersPerTeam !== undefined && tournament.playersPerTeam !== null ? tournament.playersPerTeam.toString() : '11',
        teamsPerGroup: tournament.teamsPerGroup !== undefined && tournament.teamsPerGroup !== null ? tournament.teamsPerGroup.toString() : '',
        entryFee: tournament.entryFee !== undefined && tournament.entryFee !== null ? tournament.entryFee.toString() : '',
        winningPrize: tournament.winningPrize !== undefined && tournament.winningPrize !== null ? tournament.winningPrize.toString() : '',
        runnerPrize: tournament.runnerPrize !== undefined && tournament.runnerPrize !== null ? tournament.runnerPrize.toString() : '',
        thirdPrize: tournament.thirdPrize !== undefined && tournament.thirdPrize !== null ? tournament.thirdPrize.toString() : '',
        startDate: formatDate(tournament.startDate),
        endDate: formatDate(tournament.endDate),
        registrationDeadline: formatDate(tournament.registrationDeadline),
        organizerName: tournament.organizerName || '',
        organizerMobile: tournament.organizerMobile || ''
      });

      const existingRules = tournament.rules ? tournament.rules.split('\n').filter(r => r.trim()) : [];
      setRules(existingRules);
      setNewRule('');

      // Fetch dynamic platform fee
      api.get('/admin/public-settings').then(res => {
        if (res.data?.data?.auctionPlatformFeePercent !== undefined) {
          setPlatformFeePercent(res.data.data.auctionPlatformFeePercent);
        }
      }).catch(console.error);
    }
  }, [tournament, visible]);

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleBannerSelect = () => {
    launchImageLibrary({ mediaType: 'photo', quality: 0.8 }, response => {
      if (response.didCancel) return;
      if (response.errorMessage) {
        showCustomAlert('Error', response.errorMessage);
        return;
      }
      if (response.assets && response.assets.length > 0) {
        const selected = response.assets[0];
        if (selected.fileSize && selected.fileSize > 4 * 1024 * 1024) {
          showCustomAlert('File Too Large', 'Please select a banner image smaller than 4MB.');
          return;
        }
        setForm(f => ({ ...f, banner: selected }));
      }
    });
  };

  const openDatePicker = target => {
    setDatePickerTarget(target);
    const existingVal = form[target];
    let d = new Date();
    if (existingVal) {
      if (existingVal.includes('/')) {
        const parts = existingVal.split('/');
        if (parts.length === 3) {
          const parsed = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
          if (!isNaN(parsed.getTime())) d = parsed;
        }
      } else {
        const parsed = new Date(existingVal);
        if (!isNaN(parsed.getTime())) d = parsed;
      }
    }
    setDateObj(d);
    setShowDatePicker(true);
  };

  const applySelectedDate = selectedDate => {
    if (!selectedDate || !datePickerTarget) return;
    setDateObj(selectedDate);
    const day = String(selectedDate.getDate()).padStart(2, '0');
    const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const year = selectedDate.getFullYear();
    const dateStr = `${day}/${month}/${year}`;
    setForm(f => ({ ...f, [datePickerTarget]: dateStr }));
    setShowDatePicker(false);
  };

  const parseDateToISO = dateStr => {
    if (!dateStr) return undefined;
    if (dateStr.includes('/')) {
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = parseInt(parts[2], 10);
        const d = new Date(year, month, day);
        if (!isNaN(d.getTime())) return d.toISOString();
      }
    }
    const d = new Date(dateStr);
    return !isNaN(d.getTime()) ? d.toISOString() : undefined;
  };

  const handleAddRule = () => {
    if (newRule.trim()) {
      setRules([...rules, newRule.trim()]);
      setNewRule('');
    }
  };

  const handleAddSuggestedRule = suggestion => {
    if (!rules.includes(suggestion)) {
      setRules(prev => [...prev, suggestion]);
    }
  };

  const handleRemoveRule = index => {
    setRules(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      showCustomAlert('Error', 'Tournament Name is required.');
      return;
    }

    setLoading(true);
    try {
      const finalRules = [...rules];
      if (newRule.trim()) {
        finalRules.push(newRule.trim());
      }

      const payload = {
        name: form.name.trim(),
        description: form.description,
        city: form.city,
        groundName: form.groundName,
        format: form.format,
        ballType: form.ballType,
        groundType: form.groundType,
        overs: form.overs !== '' ? parseInt(form.overs, 10) : undefined,
        wickets: form.wickets !== '' ? parseInt(form.wickets, 10) : undefined,
        playersPerTeam: form.playersPerTeam !== '' ? parseInt(form.playersPerTeam, 10) : undefined,
        maxTeams: form.maxTeams !== '' ? parseInt(form.maxTeams, 10) : undefined,
        teamsPerGroup: form.teamsPerGroup !== '' ? parseInt(form.teamsPerGroup, 10) : undefined,
        entryFee: form.entryFee !== '' ? parseInt(form.entryFee, 10) : 0,
        winningPrize: form.winningPrize !== '' ? parseInt(form.winningPrize, 10) : 0,
        runnerPrize: form.runnerPrize !== '' ? parseInt(form.runnerPrize, 10) : 0,
        thirdPrize: form.thirdPrize !== '' ? parseInt(form.thirdPrize, 10) : 0,
        startDate: parseDateToISO(form.startDate),
        endDate: parseDateToISO(form.endDate),
        registrationDeadline: parseDateToISO(form.registrationDeadline),
        organizerName: form.organizerName,
        organizerMobile: form.organizerMobile,
        rules: finalRules.join('\n')
      };

      if (form.locationObj) {
        payload.locationObj = typeof form.locationObj === 'string' ? form.locationObj : JSON.stringify(form.locationObj);
      }

      let body;
      let headers = {};
      if (form.banner && typeof form.banner === 'object' && form.banner.uri) {
        body = new FormData();
        body.append('banner', {
          uri: form.banner.uri,
          type: form.banner.type || 'image/jpeg',
          name: form.banner.fileName || 'banner.jpg'
        });
        Object.entries(payload).forEach(([k, v]) => {
          if (v !== undefined && v !== null) {
            body.append(k, String(v));
          }
        });
        headers['Content-Type'] = 'multipart/form-data';
      } else {
        body = payload;
      }

      await api.put(`/tournaments/${tournament._id}`, body, { headers });
      showCustomAlert('Success', 'Tournament details updated successfully!');
      if (onRefresh) await onRefresh();
      onClose();
    } catch (error) {
      console.log('Error updating tournament', error);
      showCustomAlert('Error', error.response?.data?.message || 'Failed to update tournament details');
    } finally {
      setLoading(false);
    }
  };

  const bannerUri = form.banner?.uri
    ? form.banner.uri
    : typeof form.banner === 'string' && form.banner
    ? getImageUrl(form.banner)
    : null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBg}>
        <KeyboardAvoidingView
          style={styles.modalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Edit Tournament</Text>
              <Text style={styles.modalSubtitle}>Update all tournament settings & details</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Icon name="x" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <KeyboardAwareScrollView
            enableOnAndroid={true}
            extraScrollHeight={30}
            keyboardShouldPersistTaps="handled"
            style={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Banner Section */}
            <View style={styles.sectionHeader}>
              <Icon name="image" size={16} color={colors.primary} />
              <Text style={styles.sectionTitle}>Tournament Banner</Text>
            </View>
            <View style={styles.bannerWrapper}>
              {bannerUri ? (
                <Image source={{ uri: bannerUri }} style={styles.bannerImage} resizeMode="cover" />
              ) : (
                <View style={styles.bannerPlaceholder}>
                  <Icon name="image" size={36} color={colors.textTertiary} />
                  <Text style={{ color: colors.textTertiary, fontSize: 13, marginTop: 6, fontFamily: Typography.fontFamily.medium }}>
                    No banner uploaded
                  </Text>
                </View>
              )}
              <TouchableOpacity style={styles.bannerUploadBtn} onPress={handleBannerSelect}>
                <Icon name="camera" size={15} color={colors.white} style={{ marginRight: 6 }} />
                <Text style={styles.bannerUploadBtnText}>{bannerUri ? 'Change Banner' : 'Upload Banner'}</Text>
              </TouchableOpacity>
            </View>

            {/* Basic Information */}
            <View style={styles.sectionHeader}>
              <Icon name="file-text" size={16} color={colors.primary} />
              <Text style={styles.sectionTitle}>Basic Information</Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Tournament Name *</Text>
              <TextInput
                style={styles.input}
                value={form.name}
                onChangeText={t => handleChange('name', t)}
                placeholder="e.g. RoughTurf Premier League"
                placeholderTextColor={colors.textTertiary}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, { height: 75, textAlignVertical: 'top' }]}
                value={form.description}
                onChangeText={t => handleChange('description', t)}
                multiline
                placeholder="About the tournament, schedule notes, rules..."
                placeholderTextColor={colors.textTertiary}
              />
            </View>

            <View style={{ flexDirection: 'row', gap: Spacing.md }}>
              <View style={[styles.inputGroup, { flex: 1, zIndex: 10 }]}>
                <Text style={styles.label}>City</Text>
                <LocationAutocomplete
                  value={form.city}
                  onChangeText={t => handleChange('city', t)}
                  onSelectLocation={loc => {
                    handleChange('city', loc ? loc.name : '');
                    if (loc) handleChange('locationObj', loc);
                  }}
                  placeholder="Search city..."
                  variant="outlined"
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.label}>Ground / Venue</Text>
                <TextInput
                  style={styles.input}
                  value={form.groundName}
                  onChangeText={t => handleChange('groundName', t)}
                  placeholder="Ground name"
                  placeholderTextColor={colors.textTertiary}
                />
              </View>
            </View>

            {/* Match Format & Configuration */}
            <View style={styles.sectionHeader}>
              <Icon name="settings" size={16} color={colors.primary} />
              <Text style={styles.sectionTitle}>Format & Rules Configuration</Text>
            </View>

            <View style={{ flexDirection: 'row', gap: Spacing.md }}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.label}>Format</Text>
                <CustomDropdown
                  label="Format"
                  value={form.format}
                  options={FORMAT_OPTIONS}
                  onSelect={val => handleChange('format', val)}
                  styles={styles}
                  colors={colors}
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.label}>Ball Type</Text>
                <CustomDropdown
                  label="Ball Type"
                  value={form.ballType}
                  options={BALL_OPTIONS}
                  onSelect={val => handleChange('ballType', val)}
                  styles={styles}
                  colors={colors}
                />
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: Spacing.md }}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.label}>Ground Type</Text>
                <CustomDropdown
                  label="Ground Type"
                  value={form.groundType}
                  options={GROUND_OPTIONS}
                  onSelect={val => handleChange('groundType', val)}
                  styles={styles}
                  colors={colors}
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.label}>Total Overs</Text>
                <CustomNumberDropdown
                  label="Overs"
                  value={form.overs}
                  options={OVERS_OPTIONS}
                  onChangeText={t => handleChange('overs', t)}
                  styles={styles}
                  colors={colors}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Wickets / Innings</Text>
              <CustomNumberDropdown
                label="Wickets"
                value={form.wickets}
                options={WICKETS_OPTIONS}
                onChangeText={t => handleChange('wickets', t)}
                styles={styles}
                colors={colors}
              />
            </View>

            {/* Dates Section */}
            <View style={styles.sectionHeader}>
              <Icon name="calendar" size={16} color={colors.primary} />
              <Text style={styles.sectionTitle}>Tournament Dates</Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Start Date</Text>
              <TouchableOpacity style={styles.datePickerBtn} onPress={() => openDatePicker('startDate')}>
                <Text style={[styles.datePickerText, !form.startDate && { color: colors.textTertiary }]}>
                  {form.startDate || 'DD/MM/YYYY'}
                </Text>
                <Icon name="calendar" size={16} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>

            {isAuction && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Registration Deadline</Text>
                <TouchableOpacity style={styles.datePickerBtn} onPress={() => openDatePicker('registrationDeadline')}>
                  <Text style={[styles.datePickerText, !form.registrationDeadline && { color: colors.textTertiary }]}>
                    {form.registrationDeadline || 'DD/MM/YYYY'}
                  </Text>
                  <Icon name="calendar" size={16} color={colors.textTertiary} />
                </TouchableOpacity>
              </View>
            )}

            {/* Entry Fee */}
            <View style={styles.sectionHeader}>
              <Icon name="credit-card" size={16} color={colors.primary} />
              <Text style={styles.sectionTitle}>Entry Fee</Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Entry Fee (₹)</Text>
              <TextInput
                style={styles.input}
                value={form.entryFee}
                onChangeText={t => handleChange('entryFee', t.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={colors.textTertiary}
              />
            </View>

            {/* Rules Section */}
            <View style={styles.sectionHeader}>
              <Icon name="check-square" size={16} color={colors.primary} />
              <Text style={styles.sectionTitle}>Rules & Regulations</Text>
            </View>

            <View style={styles.inputGroup}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm }}>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0 }]}
                  value={newRule}
                  onChangeText={setNewRule}
                  placeholder="Enter a rule..."
                  placeholderTextColor={colors.textTertiary}
                  onSubmitEditing={handleAddRule}
                  returnKeyType="done"
                />
                <TouchableOpacity onPress={handleAddRule} style={styles.addRuleBtn}>
                  <Icon name="plus" size={20} color={colors.white} />
                </TouchableOpacity>
              </View>

              {/* Rule Suggestions */}
              <View style={{ marginBottom: Spacing.md }}>
                <Text style={{ color: colors.textTertiary, fontSize: 11, fontFamily: Typography.fontFamily.medium, marginBottom: 6 }}>
                  Quick Suggestions (Tap to add):
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {RULE_SUGGESTIONS.map(suggestion => {
                    const isAdded = rules.includes(suggestion);
                    return (
                      <TouchableOpacity
                        key={suggestion}
                        style={{
                          paddingHorizontal: 10,
                          paddingVertical: 5,
                          borderRadius: 14,
                          backgroundColor: isAdded ? 'rgba(46, 204, 113, 0.15)' : colors.backgroundElevated,
                          borderWidth: 1,
                          borderColor: isAdded ? colors.primary : colors.border
                        }}
                        onPress={() => handleAddSuggestedRule(suggestion)}
                        disabled={isAdded}
                      >
                        <Text style={{ color: isAdded ? colors.primary : colors.textSecondary, fontSize: 11, fontFamily: Typography.fontFamily.medium }}>
                          {isAdded ? '✓ ' : '+ '}{suggestion}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {rules.map((rule, idx) => (
                <View key={idx} style={styles.ruleItem}>
                  <View style={styles.ruleDot} />
                  <Text style={styles.ruleText}>{rule}</Text>
                  <TouchableOpacity onPress={() => handleRemoveRule(idx)} style={{ padding: 4 }}>
                    <Icon name="x" size={16} color={colors.error} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>

            <View style={{ height: 40 }} />
          </KeyboardAwareScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.cancelBtn, { borderColor: colors.border }]}
              onPress={onClose}
              disabled={loading}
            >
              <Text style={[styles.cancelBtnText, { color: colors.textSecondary }]} numberOfLines={1}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, loading && { opacity: 0.7 }]}
              onPress={handleSave}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Icon name="check" size={18} color={colors.white} style={{ marginRight: 6 }} />
                  <Text style={styles.saveBtnText} numberOfLines={1} adjustsFontSizeToFit={true} minimumFontScale={0.85}>
                    Save Details
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>

      <CustomDateTimePicker
        visible={showDatePicker}
        mode="date"
        value={dateObj}
        onConfirm={selectedDate => applySelectedDate(selectedDate)}
        onCancel={() => setShowDatePicker(false)}
        onClose={() => setShowDatePicker(false)}
      />
    </Modal>
  );
};

const createStyles = (colors, shadows, isDark, safeBottom = 0) =>
  StyleSheet.create({
    modalBg: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.7)',
      justifyContent: 'flex-end'
    },
    modalContainer: {
      backgroundColor: colors.background,
      borderTopLeftRadius: BorderRadius.xl,
      borderTopRightRadius: BorderRadius.xl,
      height: '92%'
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border
    },
    modalTitle: {
      fontSize: 18,
      fontFamily: Typography.fontFamily.bold,
      color: colors.textPrimary
    },
    modalSubtitle: {
      fontSize: 12,
      fontFamily: Typography.fontFamily.regular,
      color: colors.textSecondary,
      marginTop: 2
    },
    closeBtn: {
      padding: 6,
      borderRadius: 20,
      backgroundColor: colors.backgroundElevated
    },
    scrollContent: {
      padding: Spacing.lg
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: Spacing.md,
      marginBottom: Spacing.sm,
      paddingBottom: 4,
      borderBottomWidth: 1,
      borderBottomColor: colors.border
    },
    sectionTitle: {
      fontSize: 14,
      fontFamily: Typography.fontFamily.bold,
      color: colors.textPrimary,
      marginLeft: 8,
      textTransform: 'uppercase',
      letterSpacing: 0.5
    },
    bannerWrapper: {
      marginBottom: Spacing.md,
      borderRadius: BorderRadius.md,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
      position: 'relative'
    },
    bannerImage: {
      width: '100%',
      height: 140,
      backgroundColor: colors.surface
    },
    bannerPlaceholder: {
      width: '100%',
      height: 120,
      backgroundColor: colors.surface,
      justifyContent: 'center',
      alignItems: 'center'
    },
    bannerUploadBtn: {
      position: 'absolute',
      bottom: 10,
      right: 10,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: BorderRadius.full
    },
    bannerUploadBtnText: {
      color: colors.white,
      fontFamily: Typography.fontFamily.bold,
      fontSize: 12
    },
    inputGroup: {
      marginBottom: Spacing.md
    },
    label: {
      fontSize: 12,
      fontFamily: Typography.fontFamily.medium,
      color: colors.textSecondary,
      marginBottom: Spacing.xs
    },
    input: {
      backgroundColor: colors.surface,
      color: colors.textPrimary,
      paddingHorizontal: Spacing.md,
      paddingVertical: 11,
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      borderColor: colors.border,
      fontFamily: Typography.fontFamily.medium,
      fontSize: 14
    },
    datePickerBtn: {
      backgroundColor: colors.surface,
      paddingHorizontal: Spacing.md,
      paddingVertical: 12,
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      borderColor: colors.border,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between'
    },
    datePickerText: {
      color: colors.textPrimary,
      fontFamily: Typography.fontFamily.medium,
      fontSize: 14
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.lg,
      paddingTop: 12,
      paddingBottom: safeBottom + 8,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.surface,
      gap: Spacing.md,
      elevation: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -3 },
      shadowOpacity: isDark ? 0.35 : 0.08,
      shadowRadius: 4,
    },
    cancelBtn: {
      flex: 1,
      minHeight: 48,
      backgroundColor: colors.surfaceVariant,
      borderWidth: 1,
      paddingVertical: 12,
      borderRadius: BorderRadius.md,
      alignItems: 'center',
      justifyContent: 'center'
    },
    cancelBtnText: {
      fontFamily: Typography.fontFamily.bold,
      fontSize: 15,
      textAlign: 'center'
    },
    saveBtn: {
      flex: 2,
      minHeight: 48,
      backgroundColor: colors.primary,
      paddingVertical: 12,
      borderRadius: BorderRadius.md,
      alignItems: 'center',
      justifyContent: 'center'
    },
    saveBtnText: {
      color: colors.white,
      fontFamily: Typography.fontFamily.bold,
      fontSize: 15,
      textAlign: 'center'
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center'
    },
    dropdownModalContent: {
      backgroundColor: colors.background,
      width: '84%',
      borderRadius: BorderRadius.md,
      padding: Spacing.lg,
      maxHeight: '80%'
    },
    modalOption: {
      paddingVertical: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border
    },
    modalOptionText: {
      color: colors.textPrimary,
      fontSize: 15,
      fontFamily: Typography.fontFamily.medium
    },
    addRuleBtn: {
      backgroundColor: colors.primary,
      width: 44,
      height: 44,
      borderRadius: BorderRadius.md,
      justifyContent: 'center',
      alignItems: 'center'
    },
    ruleItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      padding: Spacing.md,
      borderRadius: BorderRadius.md,
      marginBottom: Spacing.sm
    },
    ruleDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.primary,
      marginRight: Spacing.sm
    },
    ruleText: {
      flex: 1,
      color: colors.textPrimary,
      fontFamily: Typography.fontFamily.medium,
      fontSize: 13
    },
    numberInputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: BorderRadius.md,
      height: 46
    },
    dropdownTrigger: {
      paddingHorizontal: Spacing.md,
      height: '100%',
      justifyContent: 'center',
      alignItems: 'center',
      borderLeftWidth: 1,
      borderLeftColor: colors.border
    }
  });

export default EditTournamentModal;
