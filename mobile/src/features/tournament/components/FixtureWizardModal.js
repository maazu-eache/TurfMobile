import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Platform } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import moment from 'moment';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme, Typography, Spacing, BorderRadius } from '../../../theme/theme';
import api from '../../../api/axios';
import { showCustomAlert } from '../../../components/CustomAlert';

const formatDateIndian = (date) => {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

const formatTimeString = (date) => {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
  
  // 2-Team Series State & No-Group Mode State
  const [seriesCount, setSeriesCount] = useState('3');
  const [firstMatchDate, setFirstMatchDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  
  // DateTime Picker Tracking
  const [activeGroupIndex, setActiveGroupIndex] = useState(null);
  const [pickerMode, setPickerMode] = useState('date'); // 'date' or 'time'

  // Preview match reschedule state
  const [editingPreviewIdx, setEditingPreviewIdx] = useState(null);
  const [editingPreviewDateText, setEditingPreviewDateText] = useState('');
  const [showPreviewRescheduleModal, setShowPreviewRescheduleModal] = useState(false);

  const handleOpenPreviewReschedule = (indexInArray) => {
    setEditingPreviewIdx(indexInArray);
    const m = previewMatches[indexInArray];
    const existingDate = m?.scheduledAt ? new Date(m.scheduledAt) : new Date();
    setEditingPreviewDateText(moment(existingDate).format('YYYY-MM-DD HH:mm'));
    setShowPreviewRescheduleModal(true);
  };

  const handleSavePreviewReschedule = () => {
    if (editingPreviewIdx === null || !editingPreviewDateText) return;
    const cleanText = editingPreviewDateText.trim().replace('T', ' ');
    const parsed = new Date(cleanText);
    if (isNaN(parsed.getTime())) {
      showCustomAlert('Invalid Date', 'Please enter a valid date in YYYY-MM-DD HH:mm format');
      return;
    }
    setPreviewMatches(prev => {
      const updated = [...prev];
      updated[editingPreviewIdx] = {
        ...updated[editingPreviewIdx],
        scheduledAt: parsed.toISOString()
      };
      return updated;
    });
    setShowPreviewRescheduleModal(false);
    setEditingPreviewIdx(null);
  };

  const registeredTeamsCount = useMemo(() => {
    return tournament?.registeredTeams?.filter(rt => rt.team != null)?.length || 0;
  }, [tournament]);

  const isTwoTeams = registeredTeamsCount === 2;

  // Dynamically calculate total league matches
  const totalCalculatedMatches = useMemo(() => {
    if (registeredTeamsCount < 2) return 0;
    if (isTwoTeams) {
      return Math.max(1, parseInt(seriesCount) || 1);
    }
    if (groupMode && tournament?.groups?.length > 0) {
      let total = 0;
      tournament.groups.forEach(g => {
        const k = g.teams?.length || 0;
        if (k === 2) {
          total += Math.max(1, parseInt(seriesCount) || 1);
        } else if (k > 2) {
          total += (k * (k - 1)) / 2;
        }
      });
      return total;
    }
    const n = registeredTeamsCount;
    return (n * (n - 1)) / 2;
  }, [registeredTeamsCount, isTwoTeams, seriesCount, groupMode, tournament?.groups]);

  useEffect(() => {
    if (visible && tournament) {
      setIsPreviewMode(false);
      setPreviewMatches([]);
      const hasGroups = tournament.groups && tournament.groups.length > 0;
      setGroupMode(hasGroups);
      if (hasGroups) {
        const initSchedule = tournament.groups.map((g, index) => {
          const date = new Date(tournament.startDate || new Date());
          date.setDate(date.getDate() + index);
          date.setHours(9, 0, 0, 0);
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
    if (registeredTeamsCount < 2) {
      showCustomAlert('Error', 'At least 2 registered teams are required to generate fixtures.');
      return;
    }
    try {
      setLoading(true);
      const payload = {
        groupMode,
        seriesCount: parseInt(seriesCount) || 1,
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
        seriesCount: parseInt(seriesCount) || 1,
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
      showCustomAlert('Success', 'League fixtures confirmed and scheduled successfully!');
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
                {/* Stats & Summary Banner */}
                <View style={styles.statsCard}>
                  <View style={styles.statBox}>
                    <Text style={styles.statNum}>{registeredTeamsCount}</Text>
                    <Text style={styles.statLabel}>Registered Teams</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statBox}>
                    <Text style={styles.statNum}>{totalCalculatedMatches}</Text>
                    <Text style={styles.statLabel}>League Matches</Text>
                  </View>
                </View>

                <Text style={styles.wizardIntro}>
                  {isTwoTeams
                    ? "2 teams detected. Specify how many matches to schedule between them."
                    : groupMode 
                    ? "Groups detected! Configure when each group should start playing. Matches are calculated automatically."
                    : "Round-Robin format. Matches are automatically calculated based on team count."}
                </Text>
                
                <View style={styles.infoBox}>
                  <Icon name="info" size={16} color={colors.primary} style={{ marginRight: 8, marginTop: 2 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.infoText}>
                      Matches will be automatically spaced based on {tournament?.overs || 5} overs ({tournament?.groundType || 'Open Ground'}) format.
                    </Text>
                    <Text style={[styles.infoText, { marginTop: 4, color: colors.textSecondary }]}>
                      This wizard creates League Matches only (no Knockout matches required).
                    </Text>
                  </View>
                </View>

                {isTwoTeams ? (
                  <View style={{ marginTop: Spacing.lg }}>
                    <Text style={styles.label}>How many matches to schedule?</Text>
                    <TextInput 
                      style={styles.input} 
                      keyboardType="numeric" 
                      value={seriesCount} 
                      onChangeText={setSeriesCount}
                      placeholder="e.g. 3 for Best of 3"
                      placeholderTextColor={colors.textTertiary}
                    />
                    <Text style={{ fontSize: 11, color: colors.textTertiary, marginTop: 4 }}>
                      E.g. Enter 3 to schedule Match 1, 2, and 3 between the 2 teams.
                    </Text>

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
                            {formatTimeString(firstMatchDate)}
                          </Text>
                          <Icon name="clock" size={16} color={colors.primary} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ) : groupMode ? (
                  <View style={{ marginTop: Spacing.md }}>
                    <Text style={styles.sectionTitle}>Group Order & Start Times</Text>
                    {groupSchedule.map((gs, index) => {
                      const groupObj = tournament?.groups?.find(g => g.name === gs.groupName);
                      const gTeamCount = groupObj?.teams?.length || 0;
                      const gMatchCount = gTeamCount === 2 ? Math.max(1, parseInt(seriesCount) || 1) : (gTeamCount * (gTeamCount - 1)) / 2;
                      return (
                        <View key={index} style={styles.groupRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.groupName}>{gs.groupName}</Text>
                            <Text style={{ fontSize: 11, color: colors.textTertiary }}>
                              {gTeamCount} teams → {gMatchCount} matches
                            </Text>
                          </View>
                          
                          <View style={styles.groupRowPickers}>
                            <TouchableOpacity style={styles.compactPickerBtn} onPress={() => openPicker('date', index)}>
                              <Text style={styles.compactPickerText}>{formatDateIndian(gs.startTime)}</Text>
                              <Icon name="calendar" size={14} color={colors.primary} />
                            </TouchableOpacity>
                            
                            <TouchableOpacity style={styles.compactPickerBtn} onPress={() => openPicker('time', index)}>
                              <Text style={styles.compactPickerText}>
                                {formatTimeString(gs.startTime)}
                              </Text>
                              <Icon name="clock" size={14} color={colors.primary} />
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                ) : (
                  <View style={{ marginTop: Spacing.lg }}>
                    <Text style={styles.label}>Start Time for First Match</Text>
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
                            {formatTimeString(firstMatchDate)}
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
                            {formatDateIndian(match.scheduledAt)} at {formatTimeString(match.scheduledAt)}
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
                        {formatDateIndian(match.scheduledAt)} at {formatTimeString(match.scheduledAt)}
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
                <TouchableOpacity style={[styles.actionBtn, { flex: 1, backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border, marginRight: 6 }]} onPress={() => setIsPreviewMode(false)}>
                  <Text style={[styles.actionBtnText, { color: colors.textSecondary, fontSize: 13 }]}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.actionBtn,
                    { flex: 1.3, backgroundColor: isDark ? 'rgba(255,204,0,0.15)' : 'rgba(230,184,0,0.15)', borderWidth: 1, borderColor: colors.primary, marginRight: 6 }
                  ]}
                  onPress={handleGenerate}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color={colors.primary} size="small" />
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <MCIcon name="shuffle-variant" size={16} color={isDark ? colors.primary : '#8B6E00'} style={{ marginRight: 4 }} />
                      <Text style={[styles.actionBtnText, { color: isDark ? colors.primary : '#8B6E00', fontSize: 13 }]}>Reschedule</Text>
                    </View>
                  )}
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, { flex: 1 }]} onPress={handleConfirm} disabled={loading}>
                  {loading ? <ActivityIndicator color="#000000" size="small" /> : <Text style={styles.actionBtnText}>Confirm</Text>}
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
  
  statsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.lg,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statBox: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 22, fontFamily: Typography.fontFamily.bold, color: colors.primary },
  statLabel: { fontSize: 11, color: colors.textSecondary, fontFamily: Typography.fontFamily.medium, marginTop: 2 },
  statDivider: { width: 1, height: 32, backgroundColor: colors.border, marginHorizontal: 8 },

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
