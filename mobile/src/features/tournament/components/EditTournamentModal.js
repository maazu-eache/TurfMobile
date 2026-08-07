import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Modal, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { Colors, Typography, Spacing, BorderRadius } from '../../../theme/theme';
import Icon from 'react-native-vector-icons/Feather';
import { showCustomAlert } from '../../../components/CustomAlert';
import api from '../../../api/axios';

import LocationAutocomplete from '../../../components/LocationAutocomplete';

const TEAMS_OPTIONS = ['2', '4', '6', '8', '10', '12', '16', '24', '32', '36', '40', '44','48'];
const PLAYERS_OPTIONS = ['5', '6', '7', '8', '9', '10', '11', '15'];
const OVERS_OPTIONS = ['3', '5', '8', '10', '12', '15', '20','25','30','35','40','50'];
const RULE_SUGGESTIONS = ['75 speed limit', 'No throwing / jerk bowling', 'Max 1 bouncer per over', 'Rubber ball rules apply', 'Tennis ball rules apply', 'No LBW', 'Super over for tie', 'Free hit for no-ball'];

const CustomDropdown = ({ label, value, options, onSelect }) => {
  const [visible, setVisible] = useState(false);
  return (
    <>
      <TouchableOpacity onPress={() => setVisible(true)} style={styles.input} activeOpacity={0.8}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: value ? Colors.textPrimary : Colors.textTertiary, fontFamily: Typography.fontFamily.medium }}>
            {value || `Select ${label}`}
          </Text>
          <Icon name="chevron-down" size={16} color={Colors.textTertiary} />
        </View>
      </TouchableOpacity>
      <Modal visible={visible} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setVisible(false)}>
          <View style={styles.dropdownModalContent}>
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

const CustomNumberDropdown = ({ label, value, options, onChangeText }) => {
  const [visible, setVisible] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  return (
    <>
      <View 
        style={[
          styles.numberInputWrapper,
          isFocused && { borderColor: Colors.primary }
        ]}
      >
        <TextInput
          style={[styles.input, { flex: 1, borderWidth: 0, backgroundColor: 'transparent', height: '100%', paddingVertical: 0 }]}
          keyboardType="numeric"
          placeholderTextColor={Colors.textTertiary}
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
          <Icon name="chevron-down" size={16} color={Colors.textTertiary} />
        </TouchableOpacity>
      </View>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setVisible(false)}>
          <View style={styles.dropdownModalContent}>
            <Text style={styles.modalTitle}>Select {label}</Text>
            <ScrollView style={{ maxHeight: 300 }} keyboardShouldPersistTaps="handled">
              {options.map(opt => (
                <TouchableOpacity key={opt} style={styles.modalOption} onPress={() => { onChangeText(opt); setVisible(false); }}>
                  <Text style={[styles.modalOptionText, value === opt && { color: Colors.primary }]}>{opt}</Text>
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
  const [form, setForm] = useState({
    name: '',
    description: '',
    city: '',
    groundName: '',
    maxTeams: '',
    overs: '',
    playersPerTeam: '',
    entryFee: ''
  });
  
  const [rules, setRules] = useState([]);
  const [newRule, setNewRule] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [platformFeePercent, setPlatformFeePercent] = useState(10);

  useEffect(() => {
    if (tournament && visible) {
      setForm({
        name: tournament.name || '',
        description: tournament.description || '',
        city: tournament.city || '',
        groundName: tournament.groundName || '',
        maxTeams: tournament.maxTeams?.toString() || '',
        overs: tournament.overs?.toString() || '',
        playersPerTeam: tournament.playersPerTeam?.toString() || '',
        entryFee: tournament.entryFee?.toString() || ''
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
  
  const handleAddRule = () => {
    if (newRule.trim()) {
      setRules([...rules, newRule.trim()]);
      setNewRule('');
    }
  };

  const handleAddSuggestedRule = (suggestion) => {
    if (!rules.includes(suggestion)) {
      setRules(prev => [...prev, suggestion]);
    }
  };

  const handleRemoveRule = (index) => {
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
        name: form.name,
        description: form.description,
        city: form.city,
        groundName: form.groundName,
        overs: parseInt(form.overs) || undefined,
        entryFee: parseInt(form.entryFee) || 0,
        rules: finalRules.join('\n')
      };

      await api.put(`/tournaments/${tournament._id}`, payload);
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

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalBg}>
        <KeyboardAvoidingView 
          style={styles.modalContainer} 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Edit Details</Text>
            <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
              <Icon name="x" size={24} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
          
          <KeyboardAwareScrollView enableOnAndroid={true} extraScrollHeight={20} keyboardShouldPersistTaps="handled" style={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Tournament Name *</Text>
              <TextInput style={styles.input} value={form.name} onChangeText={t => handleChange('name', t)} placeholderTextColor={Colors.textTertiary} />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Description</Text>
              <TextInput style={[styles.input, { height: 80, textAlignVertical: 'top' }]} value={form.description} onChangeText={t => handleChange('description', t)} multiline placeholderTextColor={Colors.textTertiary} />
            </View>

            <View style={{ flexDirection: 'row', gap: Spacing.md }}>
              <View style={[styles.inputGroup, { flex: 1, zIndex: 10 }]}>
                <Text style={styles.label}>City</Text>
                <LocationAutocomplete
                  value={form.city}
                  onChangeText={t => handleChange('city', t)}
                  onSelectLocation={loc => handleChange('city', loc ? loc.name : '')}
                  placeholder="Search city..."
                  variant="outlined"
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.label}>Ground Name</Text>
                <TextInput style={styles.input} value={form.groundName} onChangeText={t => handleChange('groundName', t)} placeholderTextColor={Colors.textTertiary} />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Overs</Text>
              <CustomNumberDropdown label="Overs" value={form.overs} options={OVERS_OPTIONS} onChangeText={t => handleChange('overs', t)} />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Entry Fee (₹)</Text>
              <TextInput style={styles.input} value={form.entryFee} onChangeText={t => handleChange('entryFee', t)} keyboardType="number-pad" placeholderTextColor={Colors.textTertiary} />
              <Text style={{ color: Colors.primary, fontSize: 12, marginTop: 6, fontFamily: Typography.fontFamily.medium }}>
                Note: A {platformFeePercent}% platform fee will be deducted for each registration made through the platform.
              </Text>
            </View>
            
            {/* Rules Section */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Rules (Add point by point)</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm }}>
                <TextInput 
                  style={[styles.input, { flex: 1, marginBottom: 0 }]} 
                  value={newRule} 
                  onChangeText={setNewRule} 
                  placeholder="Enter a rule..." 
                  placeholderTextColor={Colors.textTertiary}
                  onSubmitEditing={handleAddRule}
                  returnKeyType="done"
                />
                <TouchableOpacity onPress={handleAddRule} style={styles.addRuleBtn}>
                  <Icon name="plus" size={20} color={Colors.white} />
                </TouchableOpacity>
              </View>

              {/* Rule Suggestions */}
              <View style={{ marginBottom: Spacing.md }}>
                <Text style={{ color: Colors.textTertiary, fontSize: 11, fontFamily: Typography.fontFamily.medium, marginBottom: 6 }}>
                  Quick Suggestions (Tap to add):
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {RULE_SUGGESTIONS.map((suggestion) => {
                    const isAdded = rules.includes(suggestion);
                    return (
                      <TouchableOpacity
                        key={suggestion}
                        style={{
                          paddingHorizontal: 10,
                          paddingVertical: 5,
                          borderRadius: 14,
                          backgroundColor: isAdded ? 'rgba(46, 204, 113, 0.15)' : Colors.backgroundElevated,
                          borderWidth: 1,
                          borderColor: isAdded ? Colors.primary : Colors.border,
                        }}
                        onPress={() => handleAddSuggestedRule(suggestion)}
                        disabled={isAdded}
                      >
                        <Text style={{ color: isAdded ? Colors.primary : Colors.textSecondary, fontSize: 11, fontFamily: Typography.fontFamily.medium }}>
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
                    <Icon name="x" size={16} color={Colors.error} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
            
            <View style={{ height: 40 }} />
          </KeyboardAwareScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, marginRight: Spacing.sm }]} onPress={onClose}>
              <Text style={[styles.saveBtnText, { color: Colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.saveBtn, loading && { opacity: 0.7 }]} onPress={handleSave} disabled={loading}>
              {loading ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.saveBtnText}>Save Details</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContainer: { backgroundColor: Colors.background, borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl, height: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalTitle: { fontSize: 20, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary },
  scrollContent: { padding: Spacing.lg },
  inputGroup: { marginBottom: Spacing.md },
  label: { fontSize: 13, fontFamily: Typography.fontFamily.medium, color: Colors.textSecondary, marginBottom: Spacing.xs },
  input: { backgroundColor: Colors.backgroundElevated, color: Colors.textPrimary, padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border, fontFamily: Typography.fontFamily.medium },
  footer: { flexDirection: 'row', padding: Spacing.lg, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.background },
  saveBtn: { flex: 1, backgroundColor: Colors.primary, paddingVertical: Spacing.md, borderRadius: BorderRadius.md, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { color: Colors.white, fontFamily: Typography.fontFamily.bold, fontSize: 16 },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  dropdownModalContent: { backgroundColor: Colors.background, width: '80%', borderRadius: BorderRadius.md, padding: Spacing.lg, maxHeight: '80%' },
  modalOption: { paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalOptionText: { color: Colors.textPrimary, fontSize: 16, fontFamily: Typography.fontFamily.medium },
  
  addRuleBtn: { backgroundColor: Colors.primary, width: 44, height: 44, borderRadius: BorderRadius.md, justifyContent: 'center', alignItems: 'center' },
  ruleItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.backgroundElevated, padding: Spacing.md, borderRadius: BorderRadius.md, marginBottom: Spacing.sm },
  ruleDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.primary, marginRight: Spacing.sm },
  ruleText: { flex: 1, color: Colors.textPrimary, fontFamily: Typography.fontFamily.medium, fontSize: 14 },
  numberInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    height: 50,
  },
  dropdownTrigger: {
    paddingHorizontal: Spacing.md,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderLeftWidth: 1,
    borderLeftColor: Colors.border,
  },
});

export default EditTournamentModal;
