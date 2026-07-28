import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Platform } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import Icon from 'react-native-vector-icons/Feather';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Colors, Typography, Spacing, BorderRadius } from '../../../theme/theme';
import api from '../../../api/axios';
import { showCustomAlert } from '../../../components/CustomAlert';

const FixtureWizardModal = ({ visible, onClose, tournament, onRefresh }) => {
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
          // Time mode
          const currentDate = new Date(updated[activeGroupIndex].startTime);
          currentDate.setHours(selectedDate.getHours(), selectedDate.getMinutes());
          updated[activeGroupIndex].startTime = currentDate;
          setGroupSchedule(updated);
        }
      } else {
        // No group mode
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
          teamA: m.teamA._id,
          teamB: m.teamB._id,
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
              <Icon name="x" size={24} color={Colors.textSecondary} />
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
                  <Icon name="info" size={16} color={Colors.primary} style={{ marginRight: 8, marginTop: 2 }} />
                  <Text style={styles.infoText}>
                    Based on your {tournament?.overs || 5} overs ({tournament?.groundType || 'Open Ground'}) format, matches will be automatically spaced out.
                  </Text>
                </View>
                
                <View style={[styles.infoBox, { borderColor: Colors.warning, backgroundColor: 'rgba(243, 156, 18, 0.1)', marginTop: Spacing.sm }]}>
                  <Icon name="alert-triangle" size={16} color={Colors.warning} style={{ marginRight: 8, marginTop: 2 }} />
                  <Text style={[styles.infoText, { color: Colors.warning }]}>
                    This wizard ONLY schedules League Matches. Knockout matches (Quarter-Finals, etc.) must be handled manually using "Start a Match".
                  </Text>
                </View>

                {groupMode ? (
              <View style={{ marginTop: Spacing.lg }}>
                <Text style={styles.sectionTitle}>Group Order & Start Times</Text>
                {groupSchedule.map((gs, index) => (
                  <View key={index} style={styles.groupCard}>
                    <Text style={styles.groupName}>{gs.groupName}</Text>
                    
                    <View style={styles.pickerRow}>
                      <View style={{ flex: 1, marginRight: Spacing.sm }}>
                        <Text style={styles.label}>Start Date</Text>
                        <TouchableOpacity style={styles.pickerBtn} onPress={() => openPicker('date', index)}>
                          <Text style={styles.pickerText}>{gs.startTime.toLocaleDateString()}</Text>
                          <Icon name="calendar" size={16} color={Colors.primary} />
                        </TouchableOpacity>
                      </View>
                      
                      <View style={{ flex: 1 }}>
                        <Text style={styles.label}>Start Time</Text>
                        <TouchableOpacity style={styles.pickerBtn} onPress={() => openPicker('time', index)}>
                          <Text style={styles.pickerText}>
                            {gs.startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </Text>
                          <Icon name="clock" size={16} color={Colors.primary} />
                        </TouchableOpacity>
                      </View>
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
                      <Text style={styles.pickerText}>{firstMatchDate.toLocaleDateString()}</Text>
                      <Icon name="calendar" size={16} color={Colors.primary} />
                    </TouchableOpacity>
                  </View>
                  
                  <View style={{ flex: 1 }}>
                    <TouchableOpacity style={styles.pickerBtn} onPress={() => openPicker('time')}>
                      <Text style={styles.pickerText}>
                        {firstMatchDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                      <Icon name="clock" size={16} color={Colors.primary} />
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
                <Text style={{ color: Colors.textSecondary, marginBottom: Spacing.md, fontSize: 13 }}>
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
                      <Text style={[styles.sectionTitle, { fontSize: 14, color: Colors.primary }]}>{groupName}</Text>
                      {matches.map((match, idx) => (
                        <View key={idx} style={styles.previewCard}>
                          <Text style={styles.previewDate}>
                            {new Date(match.scheduledAt).toLocaleDateString([], { month: 'short', day: 'numeric', weekday: 'short' })} at {new Date(match.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </Text>
                          <View style={styles.previewTeams}>
                            <Text style={styles.previewTeamText} numberOfLines={1}>{match.teamA?.name || 'TBA'}</Text>
                            <Text style={{ color: Colors.textSecondary, fontFamily: Typography.fontFamily.bold, marginHorizontal: 8 }}>vs</Text>
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
                        <Text style={{ color: Colors.textSecondary, fontFamily: Typography.fontFamily.bold, marginHorizontal: 8 }}>vs</Text>
                        <Text style={styles.previewTeamText} numberOfLines={1}>{match.teamB?.name || 'TBA'}</Text>
                      </View>
                    </View>
                  ))
                )}
                <View style={{ height: 60 }} />
              </View>
            )}
          </KeyboardAwareScrollView>

          <View style={styles.footer}>
            {!isPreviewMode ? (
              <>
                <TouchableOpacity style={[styles.actionBtn, { flex: 1, backgroundColor: 'transparent', borderWidth: 1, borderColor: Colors.border, marginRight: Spacing.sm }]} onPress={onClose}>
                  <Text style={[styles.actionBtnText, { color: Colors.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, { flex: 1 }]} onPress={handleGenerate} disabled={loading}>
                  {loading ? <ActivityIndicator color="#011528" /> : <Text style={styles.actionBtnText}>Generate</Text>}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity style={[styles.actionBtn, { flex: 1, backgroundColor: 'transparent', borderWidth: 1, borderColor: Colors.border, marginRight: Spacing.sm, paddingHorizontal: 5 }]} onPress={() => setIsPreviewMode(false)} disabled={loading}>
                  <Text style={[styles.actionBtnText, { color: Colors.textSecondary, fontSize: 13 }]}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, { flex: 1, backgroundColor: Colors.primaryAlpha10, borderWidth: 1, borderColor: Colors.primaryAlpha20, marginRight: Spacing.sm, paddingHorizontal: 5 }]} onPress={handleGenerate} disabled={loading}>
                  {loading ? <ActivityIndicator color={Colors.primary} /> : <Text style={[styles.actionBtnText, { color: Colors.primary, fontSize: 13 }]}>Regenerate</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, { flex: 1, paddingHorizontal: 5 }]} onPress={handleConfirm} disabled={loading}>
                  {loading ? <ActivityIndicator color="#011528" /> : <Text style={[styles.actionBtnText, { fontSize: 13 }]}>Confirm</Text>}
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

const styles = StyleSheet.create({
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContainer: { backgroundColor: Colors.background, borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl, height: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.lg, paddingBottom: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalTitle: { fontSize: 20, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary },
  wizardIntro: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20, marginBottom: Spacing.md },
  infoBox: { flexDirection: 'row', backgroundColor: 'rgba(46, 204, 113, 0.1)', padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.primary },
  infoText: { flex: 1, fontSize: 13, color: Colors.primary, lineHeight: 18 },
  sectionTitle: { fontSize: 16, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary, marginBottom: Spacing.md },
  
  groupCard: { backgroundColor: Colors.backgroundElevated, padding: Spacing.md, borderRadius: BorderRadius.lg, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  groupName: { fontSize: 16, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary, marginBottom: Spacing.sm },
  
  label: { color: Colors.textSecondary, fontFamily: Typography.fontFamily.medium, fontSize: 13, marginBottom: Spacing.xs },
  input: { backgroundColor: Colors.backgroundElevated, color: Colors.textPrimary, padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border },
  
  pickerRow: { flexDirection: 'row', alignItems: 'center' },
  pickerBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.backgroundElevated, padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border },
  pickerText: { color: Colors.textPrimary, fontFamily: Typography.fontFamily.medium },

  footer: { flexDirection: 'row', padding: Spacing.md, paddingBottom: Spacing.xl, borderTopWidth: 1, borderTopColor: Colors.border },
  actionBtn: { paddingVertical: 14, borderRadius: BorderRadius.xl, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primary },
  actionBtnText: { color: '#011528', fontFamily: Typography.fontFamily.bold, fontSize: 16 },
  
  previewCard: { backgroundColor: Colors.backgroundElevated, padding: Spacing.md, borderRadius: BorderRadius.md, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  previewDate: { color: Colors.primary, fontFamily: Typography.fontFamily.semiBold, fontSize: 12, marginBottom: Spacing.xs },
  previewTeams: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  previewTeamText: { flex: 1, color: Colors.textPrimary, fontFamily: Typography.fontFamily.bold, fontSize: 14, textAlign: 'center' }
});

export default FixtureWizardModal;
