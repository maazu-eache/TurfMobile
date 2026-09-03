import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Platform } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme, Typography, Spacing, BorderRadius } from '../../../theme/theme';
import api from '../../../api/axios';
import { showCustomAlert } from '../../../components/CustomAlert';

const formatDateIndian = (date) => {
  if (!date) return '';
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

const FixtureWizardModal = ({ visible, onClose, tournament, onRefresh }) => {
  const { colors, shadows, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, shadows, isDark), [colors, shadows, isDark]);
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [groupMode, setGroupMode] = useState(false);
  
  // Preview State
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [previewMatches, setPreviewMatches] = useState([]);

  // Group Mode State
  const [groupSchedule, setGroupSchedule] = useState([]);
  
  // No-Group Mode State
  const [matchesPerDay, setMatchesPerDay] = useState('5');
  const [firstMatchDate, setFirstMatchDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  
  // DateTime Picker Tracking
  const [activeGroupIndex, setActiveGroupIndex] = useState(null);
  const [pickerMode, setPickerMode] = useState('date'); // 'date' or 'time'

  useEffect(() => {
    if (visible && tournament) {
      const hasGroups = tournament.groups && tournament.groups.length > 0;
      setGroupMode(hasGroups);
      if (hasGroups) {
        // Initialize group schedule based on existing groups
        const initSchedule = tournament.groups.map((g, index) => {
          const date = new Date(tournament.startDate || new Date());
          date.setDate(date.getDate() + index); // Stagger default dates by day
          date.setHours(9, 0, 0, 0); // Default 9 AM
          return {
            groupName: g.name,
            startTime: date
          };
        });
        setGroupSchedule(initSchedule);
      }
    }
  }, [visible, tournament]);

  const handleDateChange = (event, selectedDate) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
      setShowTimePicker(false);
    }
    
    if (selectedDate) {
      if (groupMode && activeGroupIndex !== null) {
        const updated = [...groupSchedule];
        if (pickerMode === 'date') {
          const currentDate = new Date(updated[activeGroupIndex].startTime);
          selectedDate.setHours(currentDate.getHours(), currentDate.getMinutes());
          updated[activeGroupIndex].startTime = selectedDate;
          setGroupSchedule(updated);
        } else {
          const currentDate = new Date(updated[activeGroupIndex].startTime);
          currentDate.setHours(selectedDate.getHours(), selectedDate.getMinutes());
          updated[activeGroupIndex].startTime = currentDate;
          setGroupSchedule(updated);
        }
      } else {
        if (pickerMode === 'date') {
          const currentDate = new Date(firstMatchDate);
          selectedDate.setHours(currentDate.getHours(), currentDate.getMinutes());
          setFirstMatchDate(selectedDate);
        } else {
          const currentDate = new Date(firstMatchDate);
          currentDate.setHours(selectedDate.getHours(), selectedDate.getMinutes());
          setFirstMatchDate(currentDate);
        }
      }
    }
  };

  const openPicker = (mode, groupIndex = null) => {
    setPickerMode(mode);
    setActiveGroupIndex(groupIndex);
    if (mode === 'date') setShowDatePicker(true);
    if (mode === 'time') setShowTimePicker(true);
  };

  const handleGenerate = async () => {
    try {
      setLoading(true);
      const payload = {
        groupMode,
        matchesPerDay: parseInt(matchesPerDay) || 5,
        firstMatchStartTime: firstMatchDate.toISOString(),
        groupSchedule: groupSchedule.map(gs => ({
          groupName: gs.groupName,
          startTime: gs.startTime.toISOString()
        })),
        preview: true
      };

      const res = await api.post(`/tournaments/${tournament._id}/generate-fixtures`, payload);
      setPreviewMatches(res.data.data);
      setIsPreviewMode(true);
    } catch (e) {
      console.log('Error generating fixtures preview', e);
      showCustomAlert('Error', e.response?.data?.message || 'Failed to generate preview');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    try {
      setLoading(true);
      const payload = {
        groupMode,
        matchesPerDay: parseInt(matchesPerDay) || 5,
        firstMatchStartTime: firstMatchDate.toISOString(),
        groupSchedule: groupSchedule.map(gs => ({
          groupName: gs.groupName,
          startTime: gs.startTime.toISOString()
        })),
        preview: false,
        confirmedMatches: previewMatches.map(m => ({
          teamA: m.teamA?._id || m.teamA || null,
          teamB: m.teamB?._id || m.teamB || null,
          scheduledAt: m.scheduledAt
        }))
      };

      await api.post(`/tournaments/${tournament._id}/generate-fixtures`, payload);
      await onRefresh();
      showCustomAlert('Success', 'Fixtures confirmed and scheduled successfully!');
      onClose();
    } catch (e) {
      console.log('Error confirming fixtures', e);
      showCustomAlert('Error', e.response?.data?.message || 'Failed to confirm fixtures');
    } finally {
      setLoading(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalBg}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Fixture Scheduling Wizard</Text>
            <TouchableOpacity onPress={onClose}>
              <Icon name="x" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          
          <KeyboardAwareScrollView enableOnAndroid={true} extraScrollHeight={20} keyboardShouldPersistTaps="handled" style={{ flex: 1, marginTop: Spacing.md, paddingHorizontal: Spacing.md }}>
            {!isPreviewMode ? (
              <>
                <Text style={styles.wizardIntro}>
                  {groupMode 
                    ? "Groups detected! Please configure when each group should start playing. The system will automatically space out the matches."
                    : "No groups detected. All teams will play in a Round-Robin format. Please configure the daily limit and start time."}
                </Text>
                
                <View style={styles.infoBox}>
                  <Icon name="info" size={16} color={colors.primary} style={{ marginRight: 8, marginTop: 2 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.infoText}>
                      Based on your {tournament?.overs || 5} overs ({tournament?.groundType || 'Open Ground'}) format, matches will be automatically spaced out.
                    </Text>
                    <Text style={[styles.infoText, { marginTop: 6, color: colors.textSecondary }]}>
                      This wizard ONLY schedules League Matches. Knockout fixtures must be handled manually.
                    </Text>
                  </View>
                </View>

                {groupMode ? (
                  <View style={{ marginTop: Spacing.md }}>
                    <Text style={styles.sectionTitle}>Group Order & Start Times</Text>
                    {groupSchedule.map((gs, index) => (
                      <View key={index} style={styles.groupRow}>
                        <Text style={styles.groupName}>{gs.groupName}</Text>
                        
                        <View style={styles.groupRowPickers}>
                          <TouchableOpacity style={styles.compactPickerBtn} onPress={() => openPicker('date', index)}>
                            <Text style={styles.compactPickerText}>{formatDateIndian(gs.startTime)}</Text>
                            <Icon name="calendar" size={14} color={colors.primary} />
                          </TouchableOpacity>
                          
                          <TouchableOpacity style={styles.compactPickerBtn} onPress={() => openPicker('time', index)}>
                            <Text style={styles.compactPickerText}>
                              {gs.startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </Text>
                            <Icon name="clock" size={14} color={colors.primary} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                  </View>
                ) : (
                  <View style={{ marginTop: Spacing.lg }}>
                    <Text style={styles.label}>Matches Per Day</Text>
                    <TextInput 
                      style={styles.input} 
                      keyboardType="numeric" 
                      value={matchesPerDay} 
                      onChangeText={setMatchesPerDay} 
                    />

                    <Text style={[styles.label, { marginTop: Spacing.md }]}>Start Time for First Match</Text>
                    <View style={styles.pickerRow}>
                      <View style={{ flex: 1, marginRight: Spacing.sm }}>
                        <TouchableOpacity style={styles.pickerBtn} onPress={() => openPicker('date')}>
                          <Text style={styles.pickerText}>{formatDateIndian(firstMatchDate)}</Text>
                          <Icon name="calendar" size={16} color={colors.primary} />
                        </TouchableOpacity>
                      </View>
                      
                      <View style={{ flex: 1 }}>
                        <TouchableOpacity style={styles.pickerBtn} onPress={() => openPicker('time')}>
                          <Text style={styles.pickerText}>
                            {firstMatchDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </Text>
                          <Icon name="clock" size={16} color={colors.primary} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                )}

                <View style={{ height: 60 }} />
              </>
            ) : (
              <View style={{ marginTop: Spacing.md }}>
                <Text style={styles.sectionTitle}>Preview Generated Fixtures</Text>
                <Text style={{ color: colors.textSecondary, marginBottom: Spacing.md, fontSize: 13 }}>
                  Review the schedule below. If it looks good, click Confirm to finalize and overwrite any existing auto-generated league matches.
                </Text>
                {groupMode ? (
                  Object.entries(
                    previewMatches.reduce((acc, m) => {
                      const g = m.groupName || 'Other';
                      if (!acc[g]) acc[g] = [];
                      acc[g].push(m);
                      return acc;
                    }, {})
                  ).map(([groupName, matches], gIdx) => (
                    <View key={gIdx} style={{ marginBottom: Spacing.md }}>
                      <Text style={[styles.sectionTitle, { fontSize: 14, color: colors.primary }]}>{groupName}</Text>
                      {matches.map((match, idx) => (
                        <View key={idx} style={styles.previewCard}>
                          <Text style={styles.previewDate}>
                            {new Date(match.scheduledAt).toLocaleDateString([], { month: 'short', day: 'numeric', weekday: 'short' })} at {new Date(match.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </Text>
                          <View style={styles.previewTeams}>
                            <Text style={styles.previewTeamText} numberOfLines={1}>{match.teamA?.name || 'TBA'}</Text>
                            <Text style={{ color: colors.textSecondary, fontFamily: Typography.fontFamily.bold, marginHorizontal: 8 }}>vs</Text>
                            <Text style={styles.previewTeamText} numberOfLines={1}>{match.teamB?.name || 'TBA'}</Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  ))
                ) : (
                  previewMatches.map((match, idx) => (
                    <View key={idx} style={styles.previewCard}>
                      <Text style={styles.previewDate}>
                        {new Date(match.scheduledAt).toLocaleDateString([], { month: 'short', day: 'numeric', weekday: 'short' })} at {new Date(match.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                      <View style={styles.previewTeams}>
                        <Text style={styles.previewTeamText} numberOfLines={1}>{match.teamA?.name || 'TBA'}</Text>
                        <Text style={{ color: colors.textSecondary, fontFamily: Typography.fontFamily.bold, marginHorizontal: 8 }}>vs</Text>
                        <Text style={styles.previewTeamText} numberOfLines={1}>{match.teamB?.name || 'TBA'}</Text>
                      </View>
                    </View>
                  ))
                )}
                <View style={{ height: 60 }} />
              </View>
            )}
          </KeyboardAwareScrollView>

          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, Spacing.xl) }]}>
            {!isPreviewMode ? (
              <>
                <TouchableOpacity style={[styles.actionBtn, { flex: 1, backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border, marginRight: Spacing.sm }]} onPress={onClose}>
                  <Text style={[styles.actionBtnText, { color: colors.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, { flex: 1 }]} onPress={handleGenerate} disabled={loading}>
                  {loading ? <ActivityIndicator color="#000000" /> : <Text style={styles.actionBtnText}>Generate</Text>}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity style={[styles.actionBtn, { flex: 1, backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border, marginRight: Spacing.sm }]} onPress={() => setIsPreviewMode(false)}>
                  <Text style={[styles.actionBtnText, { color: colors.textSecondary }]}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, { flex: 1 }]} onPress={handleConfirm} disabled={loading}>
                  {loading ? <ActivityIndicator color="#000000" /> : <Text style={styles.actionBtnText}>Confirm</Text>}
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </View>

      {(showDatePicker || showTimePicker) && (
        <DateTimePicker
          value={groupMode && activeGroupIndex !== null ? groupSchedule[activeGroupIndex].startTime : firstMatchDate}
          mode={pickerMode}
          display="default"
          onChange={handleDateChange}
        />
      )}
    </Modal>
  );
};

const createStyles = (colors, shadows, isDark) => StyleSheet.create({
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContainer: { backgroundColor: colors.background, borderTopLeftRadius: 16, borderTopRightRadius: 16, height: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.lg, paddingBottom: Spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalTitle: { fontSize: 20, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary },
  wizardIntro: { fontSize: 13, color: colors.textSecondary, lineHeight: 18, marginBottom: Spacing.md },
  infoBox: { flexDirection: 'row', backgroundColor: colors.primaryAlpha10, padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: colors.primary },
  infoText: { fontSize: 13, color: colors.primary, lineHeight: 18 },
  sectionTitle: { fontSize: 16, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary, marginBottom: Spacing.sm },
  
  groupRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  groupName: { fontSize: 15, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary },
  groupRowPickers: { flexDirection: 'row', gap: 8 },
  compactPickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  compactPickerText: {
    color: colors.textPrimary,
    fontFamily: Typography.fontFamily.medium,
    fontSize: 12,
  },
  
  label: { color: colors.textSecondary, fontFamily: Typography.fontFamily.medium, fontSize: 13, marginBottom: Spacing.xs },
  input: { backgroundColor: colors.surface, color: colors.textPrimary, padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: colors.border },
  
  pickerRow: { flexDirection: 'row', alignItems: 'center' },
  pickerBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.surface, padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: colors.border },
  pickerText: { color: colors.textPrimary, fontFamily: Typography.fontFamily.medium },

  footer: { flexDirection: 'row', padding: Spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  actionBtn: { paddingVertical: 14, borderRadius: BorderRadius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  actionBtnText: { color: '#000000', fontFamily: Typography.fontFamily.bold, fontSize: 16 },
  
  previewCard: { backgroundColor: colors.surface, padding: Spacing.md, borderRadius: BorderRadius.md, marginBottom: Spacing.sm, borderWidth: 1, borderColor: colors.border },
  previewDate: { color: colors.primary, fontFamily: Typography.fontFamily.semiBold, fontSize: 12, marginBottom: Spacing.xs },
  previewTeams: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  previewTeamText: { flex: 1, color: colors.textPrimary, fontFamily: Typography.fontFamily.bold, fontSize: 14, textAlign: 'center' }
});

export default FixtureWizardModal;
