import React, { useMemo, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Image, Modal, Platform } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { launchImageLibrary } from 'react-native-image-picker';
import { useSelector } from 'react-redux';
import { useTheme, Typography, Spacing, BorderRadius } from '../../../theme/theme';
import api, { getImageUrl } from '../../../api/axios';
import DateTimePicker from '@react-native-community/datetimepicker';
import { showCustomAlert } from '../../../components/CustomAlert';
import LocationAutocomplete from '../../../components/LocationAutocomplete';

const STEPS = ['Basic Info', 'Format & Rules'];

const FORMAT_OPTIONS = ['Round Robin', 'League', 'Knockout'];
const BALL_OPTIONS = ['Tennis', 'Leather', 'Other'];
const GROUND_OPTIONS = ['Open Ground', 'Indoor', 'Box Cricket', 'Other'];
const TEAMS_OPTIONS = ['2', '4', '6', '8', '10', '12', '16', '24', '32'];
const PLAYERS_OPTIONS = ['5', '6', '7', '8', '9', '10', '11', '15'];
const OVERS_OPTIONS = ['3', '5', '8', '10', '12', '15', '20', '50'];
const WICKETS_OPTIONS = ['10', '11', '15', '20'];

const CustomNumberDropdown = ({ label, value, options, onChangeText }) => {
  const { colors, shadows, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, shadows, isDark), [colors, shadows, isDark]);
  const [visible, setVisible] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  return (
    <>
      <View 
        style={[
          styles.numberInputWrapper,
          isFocused && { borderColor: colors.primary }
        ]}
      >
        <TextInput
          style={[styles.input, { flex: 1, borderWidth: 0, backgroundColor: 'transparent', height: '100%', paddingVertical: 0 }]}
          keyboardType="numeric"
          placeholderTextColor={colors.textTertiary}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
        />
        <TouchableOpacity 
          onPress={() => setVisible(true)} 
          style={styles.dropdownTrigger}
          activeOpacity={0.8}
        >
          <Icon name="chevron-down" size={16} color={colors.textTertiary} />
        </TouchableOpacity>
      </View>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setVisible(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select {label}</Text>
            <ScrollView style={{ maxHeight: 300 }} keyboardShouldPersistTaps="handled">
              {options.map(opt => (
                <TouchableOpacity key={opt} style={styles.modalOption} onPress={() => { onChangeText(opt); setVisible(false); }}>
                  <Text style={[styles.modalOptionText, value === opt && { color: colors.primary }]}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

const CustomDropdown = ({ label, value, options, onSelect }) => {
  const { colors, shadows, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, shadows, isDark), [colors, shadows, isDark]);
  const [visible, setVisible] = useState(false);
  return (
    <>
      <TouchableOpacity onPress={() => setVisible(true)} style={styles.input} activeOpacity={0.8}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: value ? colors.textPrimary : colors.textTertiary, fontFamily: Typography.fontFamily.medium }}>
            {value || `Select ${label}`}
          </Text>
          <Icon name="chevron-down" size={16} color={colors.textTertiary} />
        </View>
      </TouchableOpacity>
      <Modal visible={visible} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setVisible(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select {label}</Text>
            {options.map(opt => (
              <TouchableOpacity key={opt} style={styles.modalOption} onPress={() => { onSelect(opt); setVisible(false); }}>
                <Text style={[styles.modalOptionText, value === opt && { color: colors.primary }]}>{opt}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

const TournamentCreateScreen = ({ navigation }) => {
  const { colors, shadows, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const safeTop = Math.max(insets?.top || 0, Platform.OS === 'ios' ? 44 : 0);
  const safeBottom = Math.max(insets?.bottom || 0, Platform.OS === 'ios' ? 24 : 0);
  const styles = useMemo(() => createStyles(colors, shadows, isDark), [colors, shadows, isDark]);


  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dateObj, setDateObj] = useState(new Date());
  const [rulesList, setRulesList] = useState([]);
  const [newRule, setNewRule] = useState('');
  const [form, setForm] = useState({
    name: '',
    description: '',
    banner: null,
    city: '',
    groundName: '',
    locationObj: null,
    startDate: '',
    tournamentType: 'Standard',
    format: 'League',
    ballType: 'Tennis',
    overs: '10',
    wickets: '10',
    maxTeams: '999',
    playersPerTeam: '11',
    groundType: 'Open Ground',
    entryFee: '0',
    registrationStartDate: '',
    registrationEndDate: '',
    auctionDate: '',
    auctionTime: '',
    coOrganizers: [],
    scorers: [],
    rules: '',
  });

  const { user } = useSelector((state) => state.auth);

  const [multiLookupType, setMultiLookupType] = useState(null); // 'coOrganizers' or 'scorers'
  const [multiLookupMobile, setMultiLookupMobile] = useState('');
  const [datePickerMode, setDatePickerMode] = useState('date'); // 'date' or 'time'
  const [platformFeePercent, setPlatformFeePercent] = useState(10);

  useEffect(() => {
    api.get('/admin/public-settings').then(res => {
      if (res.data?.data?.auctionPlatformFeePercent !== undefined) {
        setPlatformFeePercent(res.data.data.auctionPlatformFeePercent);
      }
    }).catch(console.error);
  }, []);

  const handleBannerSelect = () => {
    launchImageLibrary({ mediaType: 'photo', quality: 0.8 }, (response) => {
      if (response.didCancel) return;
      if (response.errorMessage) {
        showCustomAlert('Error', response.errorMessage);
        return;
      }
      if (response.assets && response.assets.length > 0) {
        const selected = response.assets[0];
        if (selected.fileSize && selected.fileSize > 3 * 1024 * 1024) {
          showCustomAlert('File Too Large', 'Please select a banner image smaller than 3MB.');
          return;
        }
        setForm(f => ({ ...f, banner: selected }));
      }
    });
  };

  const handleAddRule = () => {
    if (newRule.trim()) {
      setRulesList([...rulesList, newRule.trim()]);
      setNewRule('');
    }
  };

  const handleRemoveRule = (index) => {
    setRulesList(rulesList.filter((_, i) => i !== index));
  };

  const handleMultiLookup = async () => {
    if (multiLookupMobile.length < 10) {
      showCustomAlert('Error', 'Enter a valid 10-digit mobile number');
      return;
    }
    setLoading(true);
    try {
      const res = await api.get(`/users/lookup/${multiLookupMobile}`);
      if (res.data?.data?.exists && res.data?.data?.user) {
        const u = res.data.data.user;
        if (multiLookupType === 'coOrganizers') {
          if (form.coOrganizers.length >= 1) {
            showCustomAlert('Limit Reached', 'Only one co-organizer is allowed for this tournament.');
            setLoading(false);
            return;
          }
          if (!form.coOrganizers.some(o => o._id === u._id)) {
             setForm(f => ({ ...f, coOrganizers: [u] }));
          }
        }
        setMultiLookupMobile('');
      } else {
        showCustomAlert('Not Found', 'No user found with this mobile number');
      }
    } catch(e) {
      showCustomAlert('Error', 'Failed to lookup user');
    } finally {
      setLoading(false);
    }
  };

  const removeMultiUser = (type, index) => {
    setForm(f => {
      const newArr = [...f[type]];
      newArr.splice(index, 1);
      return { ...f, [type]: newArr };
    });
  };

  const [datePickerTarget, setDatePickerTarget] = useState('startDate');

  const openDatePicker = (target, mode = 'date') => {
    setDatePickerTarget(target);
    setDatePickerMode(mode);

    let currentVal = new Date();
    const valStr = form[target];
    if (valStr) {
      if (mode === 'time') {
        const parts = valStr.split(':');
        if (parts.length === 2) {
          currentVal.setHours(parseInt(parts[0], 10), parseInt(parts[1], 10), 0, 0);
        }
      } else {
        const parts = valStr.split('/');
        if (parts.length === 3) {
          const parsed = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
          if (!isNaN(parsed.getTime())) {
            currentVal = parsed;
          }
        }
      }
    }
    setDateObj(currentVal);
    setShowDatePicker(true);
  };

  const applySelectedDate = (selectedDate) => {
    if (!selectedDate) return;
    setDateObj(selectedDate);
    if (datePickerMode === 'time') {
      const hh = String(selectedDate.getHours()).padStart(2, '0');
      const mm = String(selectedDate.getMinutes()).padStart(2, '0');
      setForm(f => ({ ...f, [datePickerTarget]: `${hh}:${mm}` }));
    } else {
      const day = String(selectedDate.getDate()).padStart(2, '0');
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const year = selectedDate.getFullYear();
      const dateStr = `${day}/${month}/${year}`;
      setForm(f => ({ ...f, [datePickerTarget]: dateStr }));
    }
  };

  const onDateChange = (event, selectedDate) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
      if (selectedDate && event.type !== 'dismissed') {
        applySelectedDate(selectedDate);
      }
    } else {
      if (selectedDate) {
        setDateObj(selectedDate);
      }
    }
  };

  const handleNext = () => {
    if (step === 0) {
      if (!form.name || !form.city || !form.startDate) {
        showCustomAlert('Error', 'Please fill name, city, and start date');
        return;
      }
      if (!form.locationObj) {
        showCustomAlert('Error', 'Please select a valid city from the suggestions');
        return;
      }
      setStep(1);
    } else {
      if (!form.format || !form.ballType || !form.groundType || !form.overs || !form.wickets || !form.entryFee) {
        showCustomAlert('Error', 'Please fill all the required fields (Overs, Wickets, Entry Fee)');
        return;
      }
      if (form.tournamentType === 'Auction') {
        if (!form.registrationStartDate || !form.registrationEndDate || !form.auctionDate) {
          showCustomAlert('Error', 'Please select mandatory Registration Start Date, End Date, and Auction Date');
          return;
        }
        
        const parseDate = (d) => {
          if (!d) return null;
          const parts = d.split('/');
          if (parts.length === 3) return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
          return new Date(d);
        };
        
        const regEnd = parseDate(form.registrationEndDate);
        const aucDate = parseDate(form.auctionDate);
        
        if (aucDate <= regEnd) {
          showCustomAlert('Error', 'Auction date must be at least one day after the registration closes');
          return;
        }
      }
      submitTournament();
    }
  };

  const submitTournament = async () => {
    setLoading(true);
    try {
      const formatDate = (dateStr) => {
        if (!dateStr) return null;
        if (dateStr.includes('/')) {
          const parts = dateStr.split('/');
          if (parts.length === 3) {
            return `${parts[2]}-${parts[1]}-${parts[0]}`;
          }
        }
        return dateStr;
      };

      let finalStartDate = formatDate(form.startDate);
      let finalRegStartDate = formatDate(form.registrationStartDate);
      let finalRegEndDate = formatDate(form.registrationEndDate);
      let finalAuctionDate = formatDate(form.auctionDate);

      const payload = new FormData();
      Object.keys(form).forEach(key => {
        if (key === 'banner') {
          if (form.banner) {
            payload.append('banner', {
              uri: form.banner.uri,
              type: form.banner.type || 'image/jpeg',
              name: form.banner.fileName || 'banner.jpg'
            });
          }
        } else if (key === 'locationObj') {
          if (form.locationObj) {
            payload.append('locationObj[name]', form.locationObj.name);
            payload.append('locationObj[latitude]', form.locationObj.latitude);
            payload.append('locationObj[longitude]', form.locationObj.longitude);
            payload.append('latitude', form.locationObj.latitude);
            payload.append('longitude', form.locationObj.longitude);
          }
        } else if (key === 'overs' || key === 'wickets') {
          payload.append(key, parseInt(form[key]));
        } else if (key === 'entryFee') {
          payload.append(key, parseFloat(form[key]));
        } else if (key === 'startDate') {
          payload.append('startDate', finalStartDate);
        } else if (key === 'registrationStartDate' && finalRegStartDate) {
          payload.append('registrationStartDate', finalRegStartDate);
        } else if (key === 'registrationEndDate' && finalRegEndDate) {
          payload.append('registrationEndDate', finalRegEndDate);
        } else if (key === 'auctionDate' && finalAuctionDate) {
          payload.append('auctionDate', finalAuctionDate);
        } else if (key === 'auctionTime' && form.auctionTime) {
          payload.append('auctionTime', form.auctionTime);
        } else if (key === 'coOrganizers' && form.coOrganizers.length > 0) {
          payload.append('coOrganizers', JSON.stringify(form.coOrganizers.map(o => o._id)));
        } else if (key === 'scorers' && form.scorers.length > 0) {
          payload.append('scorers', JSON.stringify(form.scorers.map(s => s._id)));
        } else if (key === 'rules') {
          const finalRules = [...rulesList];
          if (newRule.trim()) {
            finalRules.push(newRule.trim());
          }
          payload.append('rules', finalRules.join('\n'));
        } else if (form[key] !== null && form[key] !== undefined && form[key] !== '' && key !== 'coOrganizers' && key !== 'scorers') {
          payload.append(key, form[key]);
        }
      });
      // no organizer field to append, backend uses req.userId automatically
      
      await api.post('/tournaments', payload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      showCustomAlert('Success', 'Tournament created successfully!');
      navigation.goBack();
    } catch (error) {
      showCustomAlert('Error', error.response?.data?.message || 'Failed to create tournament');
    } finally {
      setLoading(false);
    }
  };

  const offWhite = colors.textTertiary;
  const bowlerQuota = form.overs && !isNaN(parseInt(form.overs)) ? Math.ceil(parseInt(form.overs) / 5) : 0;

  return (
    <View style={[styles.container, { paddingTop: safeTop, paddingBottom: Math.max(safeBottom, 12) }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => step === 0 ? navigation.goBack() : setStep(0)}>
          <Icon name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Tournament</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAwareScrollView enableOnAndroid={true} extraScrollHeight={20} enableResetScrollToCoords={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.formContainer}>
        <View style={styles.stepper}>
          {STEPS.map((s, idx) => (
            <View key={idx} style={styles.stepItem}>
              <View style={[styles.stepCircle, step >= idx && styles.stepCircleActive]}>
                <Text style={[styles.stepNumber, step >= idx && styles.stepNumberActive]}>{idx + 1}</Text>
              </View>
              <Text style={[styles.stepText, step >= idx && styles.stepTextActive]}>{s}</Text>
            </View>
          ))}
        </View>

        <View style={styles.typeToggle}>
          <TouchableOpacity disabled={step > 0} onPress={() => setForm({ ...form, tournamentType: 'Standard' })} style={[styles.typeBtn, form.tournamentType === 'Standard' && styles.typeBtnActive, step > 0 && { opacity: 0.5 }]}>
            <Text style={[styles.typeBtnText, form.tournamentType === 'Standard' && styles.typeBtnTextActive]}>Standard</Text>
          </TouchableOpacity>
          <TouchableOpacity disabled={step > 0} onPress={() => setForm({ ...form, tournamentType: 'Auction' })} style={[styles.typeBtn, form.tournamentType === 'Auction' && styles.typeBtnActive, step > 0 && { opacity: 0.5 }]}>
            <Text style={[styles.typeBtnText, form.tournamentType === 'Auction' && styles.typeBtnTextActive]}>Auction</Text>
          </TouchableOpacity>
        </View>

        {form.tournamentType === 'Auction' && (
          <View style={{ paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, backgroundColor: 'rgba(255, 179, 0, 0.1)', borderRadius: 8, marginBottom: Spacing.sm }}>
            <Text style={{ color: colors.warning, fontSize: 12, fontFamily: Typography.fontFamily.medium, textAlign: 'center' }}>
              ⚡ Auction Mode: Players will register & undergo live bidding by team owners!
            </Text>
          </View>
        )}

          {step === 0 ? (
            <>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Tournament Banner</Text>
                <TouchableOpacity onPress={handleBannerSelect} style={styles.bannerContainer}>
                  {form.banner ? (
                    <Image source={{ uri: form.banner.uri }} style={styles.bannerImage} />
                  ) : (
                    <View style={styles.bannerPlaceholder}>
                      <Icon name="image" size={32} color={offWhite} />
                      <Text style={styles.bannerText}>Tap to upload banner</Text>
                    </View>
                  )}
                </TouchableOpacity>
                <Text style={{ color: colors.primary, fontSize: 12, marginTop: 6, fontFamily: Typography.fontFamily.medium }}>
                  Note: Maximum image size allowed is under 3 MB.
                </Text>
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Tournament Name *</Text>
                <TextInput style={styles.input} placeholderTextColor={offWhite} value={form.name} onChangeText={(t) => setForm({ ...form, name: t })} placeholder="Enter name" />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Description</Text>
                <TextInput style={[styles.input, { height: 80, textAlignVertical: 'top' }]} placeholderTextColor={offWhite} multiline value={form.description} onChangeText={(t) => setForm({ ...form, description: t })} placeholder="About tournament..." />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Organizer</Text>
                <View style={styles.organizerProfile}>
                  <Image source={{ uri: user?.photo ? getImageUrl(user.photo) : 'https://via.placeholder.com/40' }} style={styles.organizerAvatar} />
                  <Text style={styles.organizerNameText}>{user?.name || 'You'}</Text>
                  <Icon name="check-circle" size={16} color={colors.primary} style={{ marginLeft: 'auto' }} />
                </View>
                <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4 }}>You will be the primary organizer.</Text>
              </View>
              <View style={[styles.inputGroup, { zIndex: 10 }]}>
                <Text style={styles.label}>City *</Text>
                <LocationAutocomplete
                  value={form.city}
                  onChangeText={(t) => setForm({ ...form, city: t })}
                  onSelectLocation={(loc) => {
                    setForm({ ...form, city: loc ? loc.name : '', locationObj: loc });
                  }}
                  placeholder="Search city..."
                  variant="outlined"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Ground Name</Text>
                <TextInput style={styles.input} placeholderTextColor={offWhite} value={form.groundName} onChangeText={(t) => setForm({ ...form, groundName: t })} placeholder="Enter ground name" />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Start Date *</Text>
                <TouchableOpacity onPress={() => openDatePicker('startDate', 'date')} activeOpacity={0.8}>
                  <View pointerEvents="none">
                    <TextInput style={styles.input} placeholderTextColor={offWhite} value={form.startDate} editable={false} placeholder="DD/MM/YYYY" />
                  </View>
                </TouchableOpacity>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Co-Organizers (Optional)</Text>
                {form.coOrganizers.length === 0 && (
                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                    <TextInput style={[styles.input, { flex: 1, marginBottom: 0 }]} keyboardType="phone-pad" placeholderTextColor={offWhite} value={multiLookupType === 'coOrganizers' ? multiLookupMobile : ''} onFocus={() => setMultiLookupType('coOrganizers')} onChangeText={setMultiLookupMobile} placeholder="Enter mobile number" />
                    <TouchableOpacity style={styles.lookupBtn} onPress={handleMultiLookup}><Text style={styles.lookupBtnText}>Add</Text></TouchableOpacity>
                  </View>
                )}
                {form.coOrganizers.map((o, idx) => (
                  <View key={idx} style={styles.organizerProfile}>
                    <Image source={{ uri: o.photo ? getImageUrl(o.photo) : 'https://via.placeholder.com/40' }} style={styles.organizerAvatar} />
                    <Text style={styles.organizerNameText}>{o.name}</Text>
                    <TouchableOpacity onPress={() => removeMultiUser('coOrganizers', idx)} style={{ marginLeft: 'auto' }}><Icon name="x" size={16} color={colors.error} /></TouchableOpacity>
                  </View>
                ))}
              </View>


            </>
          ) : (
            <>
              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 10 }]}>
                  <Text style={styles.label}>Format</Text>
                  <CustomDropdown label="Format" value={form.format} options={FORMAT_OPTIONS} onSelect={(val) => setForm({...form, format: val})} />
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Ball Type</Text>
                  <CustomDropdown label="Ball Type" value={form.ballType} options={BALL_OPTIONS} onSelect={(val) => setForm({...form, ballType: val})} />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Ground Type</Text>
                <CustomDropdown label="Ground Type" value={form.groundType} options={GROUND_OPTIONS} onSelect={(val) => setForm({...form, groundType: val})} />
              </View>

              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 10 }]}>
                  <Text style={styles.label}>Overs</Text>
                  <CustomNumberDropdown label="Overs" value={form.overs} options={OVERS_OPTIONS} onChangeText={(val) => setForm({...form, overs: val})} />
                  {bowlerQuota > 0 && <Text style={styles.infoText}>Max overs / bowler: {bowlerQuota}</Text>}
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Wickets / Match</Text>
                  <CustomNumberDropdown label="Wickets" value={form.wickets} options={WICKETS_OPTIONS} onChangeText={(val) => setForm({...form, wickets: val})} />
                </View>
              </View>


              <View style={styles.inputGroup}>
                <Text style={styles.label}>{form.tournamentType === 'Auction' ? 'Player Registration Fee (₹)' : 'Team Registration Fee (₹)'}</Text>
                <TextInput style={styles.input} keyboardType="numeric" placeholderTextColor={offWhite} value={form.entryFee} onChangeText={(t) => setForm({ ...form, entryFee: t.replace(/[^0-9]/g, '') })} placeholder="₹ 0" />
                {form.tournamentType === 'Auction' && (
                  <Text style={{ color: colors.primary, fontSize: 12, marginTop: 6, fontFamily: Typography.fontFamily.medium }}>
                    Note: A {platformFeePercent}% platform fee will be deducted for each registration made through the platform.
                  </Text>
                )}
              </View>

              {form.tournamentType === 'Auction' && (
                <>
                  <View style={styles.row}>
                    <View style={[styles.inputGroup, { flex: 1, marginRight: 10 }]}>
                      <Text style={styles.label}>Reg Start Date *</Text>
                      <TouchableOpacity onPress={() => openDatePicker('registrationStartDate', 'date')} activeOpacity={0.8}>
                        <View pointerEvents="none">
                          <TextInput style={styles.input} placeholderTextColor={offWhite} value={form.registrationStartDate} editable={false} placeholder="DD/MM/YYYY" />
                        </View>
                      </TouchableOpacity>
                    </View>
                    <View style={[styles.inputGroup, { flex: 1 }]}>
                      <Text style={styles.label}>Reg End Date *</Text>
                      <TouchableOpacity onPress={() => openDatePicker('registrationEndDate', 'date')} activeOpacity={0.8}>
                        <View pointerEvents="none">
                          <TextInput style={styles.input} placeholderTextColor={offWhite} value={form.registrationEndDate} editable={false} placeholder="DD/MM/YYYY" />
                        </View>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.row}>
                    <View style={[styles.inputGroup, { flex: 1, marginRight: 10 }]}>
                      <Text style={styles.label}>Auction Date</Text>
                      <TouchableOpacity onPress={() => openDatePicker('auctionDate', 'date')} activeOpacity={0.8}>
                        <View pointerEvents="none">
                          <TextInput style={styles.input} placeholderTextColor={offWhite} value={form.auctionDate} editable={false} placeholder="DD/MM/YYYY" />
                        </View>
                      </TouchableOpacity>
                    </View>
                    <View style={[styles.inputGroup, { flex: 1 }]}>
                      <Text style={styles.label}>Auction Time (Optional)</Text>
                      <TouchableOpacity onPress={() => openDatePicker('auctionTime', 'time')} activeOpacity={0.8}>
                        <View pointerEvents="none">
                          <TextInput 
                            style={styles.input} 
                            placeholderTextColor={offWhite} 
                            value={form.auctionTime ? (() => {
                              const [h, m] = form.auctionTime.split(':');
                              const hours = parseInt(h, 10);
                              const ampm = hours >= 12 ? 'PM' : 'AM';
                              const formattedHours = hours % 12 || 12;
                              return `${String(formattedHours).padStart(2, '0')}:${m} ${ampm}`;
                            })() : ''} 
                            editable={false} 
                            placeholder="hh:mm A" 
                          />
                        </View>
                      </TouchableOpacity>
                    </View>
                  </View>
                </>
              )}

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Rules (Add point by point)</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md }}>
                  <TextInput 
                    style={[styles.input, { flex: 1, marginBottom: 0 }]} 
                    value={newRule} 
                    onChangeText={setNewRule} 
                    placeholder="Enter a rule..." 
                    placeholderTextColor={offWhite}
                    onSubmitEditing={handleAddRule}
                    returnKeyType="done"
                  />
                  <TouchableOpacity onPress={handleAddRule} style={{ backgroundColor: colors.primary, width: 44, height: 44, borderRadius: BorderRadius.md, justifyContent: 'center', alignItems: 'center' }}>
                    <Icon name="plus" size={20} color={colors.white} />
                  </TouchableOpacity>
                </View>
                
                {rulesList.map((rule, idx) => (
                  <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, padding: Spacing.md, borderRadius: BorderRadius.md, marginBottom: Spacing.sm }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary, marginRight: Spacing.sm }} />
                    <Text style={{ flex: 1, color: colors.textPrimary, fontFamily: Typography.fontFamily.medium, fontSize: 14 }}>{rule}</Text>
                    <TouchableOpacity onPress={() => handleRemoveRule(idx)} style={{ padding: 4 }}>
                      <Icon name="x" size={16} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </>
          )}
        </KeyboardAwareScrollView>
      

      <View style={styles.footer}>
        <TouchableOpacity style={styles.primaryBtn} onPress={handleNext} disabled={loading}>
          {loading ? (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <ActivityIndicator color={colors.white} style={{ marginRight: 8 }} />
              <Text style={styles.primaryBtnText}>{step === 0 ? 'Processing...' : 'Creating...'}</Text>
            </View>
          ) : (
            <Text style={styles.primaryBtnText}>{step === 0 ? 'Next' : 'Create Tournament'}</Text>
          )}
        </TouchableOpacity>
      </View>

      {showDatePicker && (
        Platform.OS === 'ios' ? (
          <Modal transparent animationType="fade" visible={showDatePicker}>
            <TouchableOpacity 
              style={styles.dateModalOverlay} 
              activeOpacity={1} 
              onPress={() => setShowDatePicker(false)}
            >
              <View style={styles.dateModalContainer}>
                <View style={styles.dateModalHeader}>
                  <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                    <Text style={styles.dateModalCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <Text style={styles.dateModalTitle}>
                    {datePickerMode === 'time' ? 'Select Time' : 'Select Date'}
                  </Text>
                  <TouchableOpacity onPress={() => { applySelectedDate(dateObj); setShowDatePicker(false); }}>
                    <Text style={styles.dateModalDoneText}>Done</Text>
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={dateObj}
                  mode={datePickerMode}
                  display="spinner"
                  themeVariant={isDark ? 'dark' : 'light'}
                  textColor={isDark ? '#FFFFFF' : '#000000'}
                  accentColor={colors.primary}
                  style={{ height: 216, width: '100%', backgroundColor: isDark ? colors.background : '#FFFFFF' }}
                  onChange={onDateChange}
                  minimumDate={
                    datePickerMode === 'date' 
                      ? (form.tournamentType === 'Auction' && (datePickerTarget === 'registrationStartDate' || datePickerTarget === 'registrationEndDate')
                          ? undefined 
                          : new Date(new Date().setHours(0,0,0,0))
                        )
                      : undefined
                  }
                />
              </View>
            </TouchableOpacity>
          </Modal>
        ) : (
          <DateTimePicker
            value={dateObj}
            mode={datePickerMode}
            display="default"
            onChange={onDateChange}
            minimumDate={
              datePickerMode === 'date' 
                ? (form.tournamentType === 'Auction' && (datePickerTarget === 'registrationStartDate' || datePickerTarget === 'registrationEndDate')
                    ? undefined 
                    : new Date(new Date().setHours(0,0,0,0))
                  )
                : undefined
            }
          />
        )
      )}
    </View>
  );
};

const createStyles = (colors, shadows, isDark) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { fontSize: 20, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary },
  stepper: { flexDirection: 'row', justifyContent: 'center', paddingTop: Spacing.lg, paddingBottom: Spacing.md },
  stepItem: { alignItems: 'center', marginHorizontal: Spacing.lg },
  stepCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  stepCircleActive: { backgroundColor: colors.primary },
  stepNumber: { color: colors.textSecondary, fontFamily: Typography.fontFamily.bold },
  stepNumberActive: { color: colors.textOnPrimary || '#000000' },
  stepText: { fontSize: 12, color: colors.textSecondary, fontFamily: Typography.fontFamily.medium },
  stepTextActive: { color: isDark ? colors.primary : '#A37B00' },
  
  typeToggle: { flexDirection: 'row', marginHorizontal: Spacing.lg, marginBottom: Spacing.md, backgroundColor: isDark ? colors.surface : '#F0F2F5', borderRadius: BorderRadius.lg, padding: 4, borderWidth: 1, borderColor: colors.border },
  typeBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: BorderRadius.md },
  typeBtnActive: { backgroundColor: colors.primary },
  typeBtnText: { color: colors.textSecondary, fontFamily: Typography.fontFamily.medium },
  typeBtnTextActive: { color: colors.textOnPrimary || '#000000', fontFamily: Typography.fontFamily.bold },

  checkboxContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.sm },
  checkboxActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkboxLabel: { color: colors.textPrimary, fontFamily: Typography.fontFamily.medium, fontSize: 14, flex: 1 },

  comingSoon: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
  comingSoonText: { color: colors.textPrimary, fontFamily: Typography.fontFamily.bold, fontSize: 18, marginTop: Spacing.lg },

  formContainer: { padding: Spacing.lg },
  inputGroup: { marginBottom: Spacing.md },
  label: { fontSize: 14, color: colors.textSecondary, marginBottom: 8, fontFamily: Typography.fontFamily.medium },
  input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, height: 50, color: colors.textPrimary, fontFamily: Typography.fontFamily.medium, justifyContent: 'center' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  infoText: { color: isDark ? colors.primary : '#A37B00', fontSize: 12, marginTop: 4, fontFamily: Typography.fontFamily.medium },
  
  footer: { padding: Spacing.lg, borderTopWidth: 1, borderTopColor: colors.border },
  primaryBtn: { backgroundColor: colors.primary, height: 52, borderRadius: BorderRadius.lg, justifyContent: 'center', alignItems: 'center' },
  primaryBtnText: { color: colors.textOnPrimary || '#000000', fontSize: 16, fontFamily: Typography.fontFamily.bold },
  
  organizerProfile: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, padding: Spacing.sm, borderRadius: BorderRadius.md, marginTop: Spacing.sm, borderWidth: 1, borderColor: colors.border },
  organizerAvatar: { width: 32, height: 32, borderRadius: 16, marginRight: Spacing.sm, backgroundColor: isDark ? '#444' : '#DDD' },
  organizerNameText: { color: colors.textPrimary, fontFamily: Typography.fontFamily.bold, fontSize: 14 },

  bannerContainer: { height: 150, backgroundColor: colors.surface, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  bannerPlaceholder: { alignItems: 'center' },
  bannerImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  bannerText: { color: colors.textSecondary, marginTop: Spacing.sm, fontFamily: Typography.fontFamily.medium, fontSize: 14 },

  lookupBtn: { backgroundColor: colors.primary, height: 50, paddingHorizontal: 20, borderRadius: BorderRadius.md, justifyContent: 'center', alignItems: 'center' },
  lookupBtnText: { color: colors.textOnPrimary || '#000000', fontFamily: Typography.fontFamily.bold },

  dateModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  dateModalContainer: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 30,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dateModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dateModalTitle: {
    fontSize: 16,
    fontFamily: Typography.fontFamily.bold,
    color: colors.textPrimary,
  },
  dateModalCancelText: {
    fontSize: 15,
    fontFamily: Typography.fontFamily.medium,
    color: colors.textSecondary,
  },
  dateModalDoneText: {
    fontSize: 15,
    fontFamily: Typography.fontFamily.bold,
    color: colors.primary,
  },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '80%', backgroundColor: colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.lg, maxHeight: '80%' },
  modalTitle: { fontSize: 18, color: colors.textPrimary, fontFamily: Typography.fontFamily.bold, marginBottom: Spacing.md },
  modalOption: { paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalOptionText: { fontSize: 16, color: colors.textPrimary, fontFamily: Typography.fontFamily.medium },
  numberInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: BorderRadius.md,
    height: 50,
  },
  dropdownTrigger: {
    paddingHorizontal: Spacing.md,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
  },
});

export default TournamentCreateScreen;
