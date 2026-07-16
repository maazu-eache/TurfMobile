import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Image, Modal } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { launchImageLibrary } from 'react-native-image-picker';
import { Colors, Typography, Spacing, BorderRadius } from '../../../theme/theme';
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



const CustomDropdown = ({ label, value, options, onSelect }) => {
  const [visible, setVisible] = useState(false);
  return (
    <>
      <TouchableOpacity onPress={() => setVisible(true)} style={styles.input} activeOpacity={0.8}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: value ? Colors.textPrimary : 'rgba(255,255,255,0.5)', fontFamily: Typography.fontFamily.medium }}>
            {value || `Select ${label}`}
          </Text>
          <Icon name="chevron-down" size={16} color="rgba(255,255,255,0.5)" />
        </View>
      </TouchableOpacity>
      <Modal visible={visible} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setVisible(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select {label}</Text>
            {options.map(opt => (
              <TouchableOpacity key={opt} style={styles.modalOption} onPress={() => { onSelect(opt); setVisible(false); }}>
                <Text style={[styles.modalOptionText, value === opt && { color: Colors.primary }]}>{opt}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

const TournamentCreateScreen = ({ navigation }) => {
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
    organizerId: '',
    organizerName: '',
    organizerPhoto: '',
    organizerMobile: '',
    startDate: '',
    tournamentType: 'Standard',
    format: 'League',
    ballType: 'Tennis',
    overs: '10',
    wickets: '10',
    maxTeams: '16',
    playersPerTeam: '11',
    groundType: 'Open Ground',
    entryFee: '0',
    rules: '',
  });

  const handleBannerSelect = () => {
    launchImageLibrary({ mediaType: 'photo', quality: 0.8 }, (response) => {
      if (response.didCancel) return;
      if (response.errorMessage) {
        showCustomAlert('Error', response.errorMessage);
        return;
      }
      if (response.assets && response.assets.length > 0) {
        setForm(f => ({ ...f, banner: response.assets[0] }));
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

  const handleMobileChange = async (mobile) => {
    setForm(f => ({ ...f, organizerMobile: mobile }));
    if (mobile.length >= 10) {
      try {
        const res = await api.get(`/users/lookup/${mobile}`);
        if (res.data && res.data.data && res.data.data.exists && res.data.data.user) {
          setForm(f => ({ 
            ...f, 
            organizerId: res.data.data.user._id,
            organizerName: res.data.data.user.name,
            organizerPhoto: res.data.data.user.photo || ''
          }));
        } else {
          setForm(f => ({ ...f, organizerId: '', organizerName: '', organizerPhoto: '' }));
        }
      } catch(e) {
         setForm(f => ({ ...f, organizerId: '', organizerName: '', organizerPhoto: '' }));
      }
    } else {
      setForm(f => ({ ...f, organizerId: '', organizerName: '', organizerPhoto: '' }));
    }
  };

  const onDateChange = (event, selectedDate) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setDateObj(selectedDate);
      const day = String(selectedDate.getDate()).padStart(2, '0');
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const year = selectedDate.getFullYear();
      setForm({ ...form, startDate: `${day}/${month}/${year}` });
    }
  };

  const handleNext = () => {
    if (form.tournamentType === 'Auction') return;

    if (step === 0) {
      if (!form.name || !form.organizerMobile || !form.city || !form.startDate) {
        showCustomAlert('Error', 'Please fill name, organiser, city, and date');
        return;
      }
      setStep(1);
    } else {
      submitTournament();
    }
  };

  const submitTournament = async () => {
    setLoading(true);
    try {
      let finalStartDate = form.startDate;
      if (finalStartDate && finalStartDate.includes('/')) {
        const parts = finalStartDate.split('/');
        if (parts.length === 3) {
          finalStartDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
      }

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
        } else if (key === 'overs' || key === 'wickets' || key === 'maxTeams' || key === 'playersPerTeam') {
          payload.append(key, parseInt(form[key]));
        } else if (key === 'entryFee') {
          payload.append(key, parseFloat(form[key]));
        } else if (key === 'startDate') {
          payload.append('startDate', finalStartDate);
        } else if (key === 'rules') {
          payload.append('rules', rulesList.join('\n'));
        } else if (form[key] !== null && form[key] !== undefined && form[key] !== '') {
          payload.append(key, form[key]);
        }
      });
      
      if (form.organizerId) {
        payload.append('organizer', form.organizerId);
      }
      
      await api.post('/tournaments', payload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      showCustomAlert('Success', 'Tournament created successfully!', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      showCustomAlert('Error', error.response?.data?.message || 'Failed to create tournament');
    } finally {
      setLoading(false);
    }
  };

  const offWhite = 'rgba(255, 255, 255, 0.5)';
  const bowlerQuota = form.overs && !isNaN(parseInt(form.overs)) ? Math.ceil(parseInt(form.overs) / 5) : 0;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => step === 0 ? navigation.goBack() : setStep(0)}>
          <Icon name="arrow-left" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Tournament</Text>
        <View style={{ width: 24 }} />
      </View>

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
        <TouchableOpacity onPress={() => setForm({ ...form, tournamentType: 'Standard' })} style={[styles.typeBtn, form.tournamentType === 'Standard' && styles.typeBtnActive]}>
          <Text style={[styles.typeBtnText, form.tournamentType === 'Standard' && styles.typeBtnTextActive]}>Standard</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setForm({ ...form, tournamentType: 'Auction' })} style={[styles.typeBtn, form.tournamentType === 'Auction' && styles.typeBtnActive]}>
          <Text style={[styles.typeBtnText, form.tournamentType === 'Auction' && styles.typeBtnTextActive]}>Auction</Text>
        </TouchableOpacity>
      </View>

      {form.tournamentType === 'Auction' ? (
        <View style={styles.comingSoon}>
          <Icon name="clock" size={64} color={Colors.primary} />
          <Text style={styles.comingSoonText}>Auction Mode is Coming Soon!</Text>
        </View>
      ) : (
        <KeyboardAwareScrollView enableOnAndroid={true} extraScrollHeight={20} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.formContainer}>
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
                <Text style={styles.label}>Organizer Mobile Number</Text>
                <TextInput style={styles.input} keyboardType="phone-pad" placeholderTextColor={offWhite} value={form.organizerMobile} onChangeText={handleMobileChange} placeholder="Enter mobile number" />
                {form.organizerId ? (
                  <View style={styles.organizerProfile}>
                    <Image source={{ uri: form.organizerPhoto ? getImageUrl(form.organizerPhoto) : 'https://via.placeholder.com/40' }} style={styles.organizerAvatar} />
                    <Text style={styles.organizerNameText}>{form.organizerName}</Text>
                    <Icon name="check-circle" size={16} color={Colors.primary} style={{ marginLeft: 'auto' }} />
                  </View>
                ) : form.organizerMobile.length >= 10 ? (
                  <View style={{ marginTop: Spacing.md }}>
                    <Text style={styles.label}>Organizer Name (New Profile)</Text>
                    <TextInput style={styles.input} placeholderTextColor={offWhite} value={form.organizerName} onChangeText={(t) => setForm({ ...form, organizerName: t })} placeholder="Enter Organizer Name" />
                  </View>
                ) : null}
              </View>
              <View style={[styles.inputGroup, { zIndex: 10 }]}>
                <Text style={styles.label}>City *</Text>
                <LocationAutocomplete
                  value={form.city}
                  onChangeText={(t) => setForm({ ...form, city: t })}
                  onSelectLocation={(loc) => {
                    setForm({ ...form, city: loc.name, locationObj: loc });
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
                <TouchableOpacity onPress={() => setShowDatePicker(true)} activeOpacity={0.8}>
                  <View pointerEvents="none">
                    <TextInput style={styles.input} placeholderTextColor={offWhite} value={form.startDate} editable={false} placeholder="DD/MM/YYYY" />
                  </View>
                </TouchableOpacity>
                {showDatePicker && (
                  <DateTimePicker
                    value={dateObj}
                    mode="date"
                    display="default"
                    onChange={onDateChange}
                    minimumDate={new Date()}
                  />
                )}
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
                  <TextInput style={styles.input} keyboardType="numeric" placeholderTextColor={offWhite} value={form.overs} onChangeText={(t) => setForm({ ...form, overs: t })} />
                  {bowlerQuota > 0 && <Text style={styles.infoText}>Max overs / bowler: {bowlerQuota}</Text>}
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Wickets / Match</Text>
                  <TextInput style={styles.input} keyboardType="numeric" placeholderTextColor={offWhite} value={form.wickets} onChangeText={(t) => setForm({ ...form, wickets: t })} />
                </View>
              </View>
              
              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 10 }]}>
                  <Text style={styles.label}>Max Teams</Text>
                  <CustomDropdown label="Max Teams" value={form.maxTeams} options={TEAMS_OPTIONS} onSelect={(val) => setForm({...form, maxTeams: val})} />
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Players per Team</Text>
                  <CustomDropdown label="Players per Team" value={form.playersPerTeam} options={PLAYERS_OPTIONS} onSelect={(val) => setForm({...form, playersPerTeam: val})} />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Registration Fee</Text>
                <TextInput style={styles.input} keyboardType="numeric" placeholderTextColor={offWhite} value={form.entryFee} onChangeText={(t) => setForm({ ...form, entryFee: t })} placeholder="₹ 0" />
              </View>

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
                  <TouchableOpacity onPress={handleAddRule} style={{ backgroundColor: Colors.primary, width: 44, height: 44, borderRadius: BorderRadius.md, justifyContent: 'center', alignItems: 'center' }}>
                    <Icon name="plus" size={20} color={Colors.white} />
                  </TouchableOpacity>
                </View>
                
                {rulesList.map((rule, idx) => (
                  <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.backgroundElevated, padding: Spacing.md, borderRadius: BorderRadius.md, marginBottom: Spacing.sm }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.primary, marginRight: Spacing.sm }} />
                    <Text style={{ flex: 1, color: Colors.textPrimary, fontFamily: Typography.fontFamily.medium, fontSize: 14 }}>{rule}</Text>
                    <TouchableOpacity onPress={() => handleRemoveRule(idx)} style={{ padding: 4 }}>
                      <Icon name="x" size={16} color={Colors.error} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </>
          )}
        </KeyboardAwareScrollView>
      )}

      <View style={styles.footer}>
        <TouchableOpacity style={[styles.primaryBtn, form.tournamentType === 'Auction' && { backgroundColor: Colors.surface }]} onPress={handleNext} disabled={loading || form.tournamentType === 'Auction'}>
          {loading ? <ActivityIndicator color={Colors.white} /> : <Text style={[styles.primaryBtnText, form.tournamentType === 'Auction' && { color: Colors.textSecondary }]}>{step === 0 ? 'Next' : 'Create Tournament'}</Text>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerTitle: { fontSize: 20, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary },
  stepper: { flexDirection: 'row', justifyContent: 'center', paddingTop: Spacing.lg, paddingBottom: Spacing.md },
  stepItem: { alignItems: 'center', marginHorizontal: Spacing.lg },
  stepCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.backgroundElevated, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  stepCircleActive: { backgroundColor: Colors.primary },
  stepNumber: { color: Colors.textSecondary, fontFamily: Typography.fontFamily.bold },
  stepNumberActive: { color: Colors.white },
  stepText: { fontSize: 12, color: Colors.textSecondary, fontFamily: Typography.fontFamily.medium },
  stepTextActive: { color: Colors.primary },
  
  typeToggle: { flexDirection: 'row', marginHorizontal: Spacing.lg, marginBottom: Spacing.md, backgroundColor: Colors.backgroundElevated, borderRadius: BorderRadius.lg, padding: 4 },
  typeBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: BorderRadius.md },
  typeBtnActive: { backgroundColor: Colors.primary },
  typeBtnText: { color: Colors.textSecondary, fontFamily: Typography.fontFamily.medium },
  typeBtnTextActive: { color: Colors.white, fontFamily: Typography.fontFamily.bold },

  checkboxContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.backgroundElevated, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.sm },
  checkboxActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  checkboxLabel: { color: Colors.textPrimary, fontFamily: Typography.fontFamily.medium, fontSize: 14, flex: 1 },

  comingSoon: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
  comingSoonText: { color: Colors.textPrimary, fontFamily: Typography.fontFamily.bold, fontSize: 18, marginTop: Spacing.lg },

  formContainer: { padding: Spacing.lg },
  inputGroup: { marginBottom: Spacing.md },
  label: { fontSize: 14, color: Colors.textSecondary, marginBottom: 8, fontFamily: Typography.fontFamily.medium },
  input: { backgroundColor: Colors.backgroundElevated, borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, height: 50, color: Colors.textPrimary, fontFamily: Typography.fontFamily.medium, justifyContent: 'center' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  infoText: { color: Colors.primary, fontSize: 12, marginTop: 4, fontFamily: Typography.fontFamily.medium },
  
  footer: { padding: Spacing.lg, borderTopWidth: 1, borderTopColor: Colors.border },
  primaryBtn: { backgroundColor: Colors.primary, height: 52, borderRadius: BorderRadius.lg, justifyContent: 'center', alignItems: 'center' },
  primaryBtnText: { color: Colors.white, fontSize: 16, fontFamily: Typography.fontFamily.bold },
  
  organizerProfile: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.backgroundElevated, padding: Spacing.sm, borderRadius: BorderRadius.md, marginTop: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  organizerAvatar: { width: 32, height: 32, borderRadius: 16, marginRight: Spacing.sm, backgroundColor: '#444' },
  organizerNameText: { color: Colors.textPrimary, fontFamily: Typography.fontFamily.bold, fontSize: 14 },

  bannerContainer: { height: 150, backgroundColor: Colors.backgroundElevated, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  bannerPlaceholder: { alignItems: 'center' },
  bannerImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  bannerText: { color: Colors.textSecondary, marginTop: Spacing.sm, fontFamily: Typography.fontFamily.medium, fontSize: 14 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '80%', backgroundColor: Colors.backgroundElevated, borderRadius: BorderRadius.lg, padding: Spacing.lg, maxHeight: '80%' },
  modalTitle: { fontSize: 18, color: Colors.textPrimary, fontFamily: Typography.fontFamily.bold, marginBottom: Spacing.md },
  modalOption: { paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalOptionText: { fontSize: 16, color: Colors.textPrimary, fontFamily: Typography.fontFamily.medium },
});

export default TournamentCreateScreen;
