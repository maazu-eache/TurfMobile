import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Image } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import Icon from 'react-native-vector-icons/Feather';
import { useTheme, Typography, Spacing, BorderRadius } from '../../../theme/theme';
import api, { getImageUrl } from '../../../api/axios';
import { showCustomAlert } from '../../../components/CustomAlert';

const GroupManagementModal = ({ visible, onClose, tournament, onRefresh }) => {
  const { colors, shadows, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, shadows, isDark), [colors, shadows, isDark]);
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState([]);
  
  const registeredTeams = tournament?.registeredTeams || [];
  
  useEffect(() => {
    if (visible && tournament) {
      let initialGroups = tournament.groups ? JSON.parse(JSON.stringify(tournament.groups)) : [];
      if (initialGroups.length === 0) {
        initialGroups = [{ name: 'Group A', teams: [], isSaved: false }];
      } else {
        initialGroups = initialGroups.map(g => ({ ...g, isSaved: true }));
      }
      setGroups(initialGroups);
    }
  }, [visible, tournament]);

  const handleRemoveGroup = (index) => {
    showCustomAlert(
      'Delete Group',
      `Are you sure you want to delete ${groups[index].name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          onPress: () => {
            const updated = [...groups];
            updated.splice(index, 1);
            setGroups(updated);
          }
        }
      ]
    );
  };

  const toggleTeamInGroup = (groupIndex, teamId) => {
    const updated = [...groups];
    const group = updated[groupIndex];
    
    // Check if team is already in this group
    const isTeamInGroup = group.teams.find(id => id === teamId || id._id === teamId);
    
    if (isTeamInGroup) {
      // Remove it
      group.teams = group.teams.filter(id => id !== teamId && id._id !== teamId);
      setGroups(updated);
    } else {
      // Check if team is in ANY other group
      const existingGroup = updated.find(g => g.teams.some(id => id === teamId || id._id === teamId));
      
      const doMove = () => {
        // First, remove team from all other groups
        updated.forEach(g => {
          g.teams = g.teams.filter(id => id !== teamId && id._id !== teamId);
        });
        // Add to this group
        group.teams.push(teamId);
        setGroups([...updated]);
      };

      if (existingGroup) {
        showCustomAlert(
          'Move Team',
          `This team is already assigned to ${existingGroup.name}. Do you want to move it to ${group.name}?`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Move', onPress: doMove }
          ]
        );
      } else {
        doMove();
      }
    }
  };

  const updateGroupName = (index, newName) => {
    const updated = [...groups];
    updated[index].name = newName;
    setGroups(updated);
  };

  const handleLocalSaveGroup = (gIndex) => {
    const group = groups[gIndex];
    if (group.teams.length === 0) {
      return showCustomAlert('Error', `Please select at least one team for ${group.name}.`);
    }

    const updated = [...groups];
    updated[gIndex].isSaved = true;

    // Check if there are remaining unassigned teams
    const assignedIds = new Set();
    updated.forEach(g => {
      g.teams.forEach(t => assignedIds.add(String(t?._id || t)));
    });

    const unassignedTeams = registeredTeams.filter(t => !assignedIds.has(String(t.team?._id || t.team)));

    if (unassignedTeams.length > 0) {
      const nextChar = String.fromCharCode(65 + updated.length); // e.g. 'B'
      const prevGroupTeamCount = group.teams.length;

      if (unassignedTeams.length <= prevGroupTeamCount) {
        // Auto-select remaining teams for the next group and auto-save it!
        updated.push({
          name: `Group ${nextChar}`,
          teams: unassignedTeams.map(t => t.team?._id || t.team),
          isSaved: true
        });
      } else {
        // Auto-create next group but let the user select teams (isSaved = false)
        updated.push({
          name: `Group ${nextChar}`,
          teams: [],
          isSaved: false
        });
      }
    }

    setGroups(updated);
  };

  const handleLocalEditGroup = (gIndex) => {
    const updated = [...groups];
    updated[gIndex].isSaved = false;
    updated.splice(gIndex + 1);
    setGroups(updated);
  };

  const handleSave = async () => {
    const canSubmit = groups.length > 0 && groups.every(g => g.isSaved);
    if (!canSubmit) return;

    try {
      setLoading(true);
      const payloadGroups = groups.map(g => ({
        name: g.name,
        teams: g.teams.map(t => typeof t === 'object' ? t._id : t)
      }));

      await api.put(`/tournaments/${tournament._id}/groups`, { groups: payloadGroups });
      showCustomAlert('Success', 'Groups updated successfully');
      onRefresh();
      onClose();
    } catch (e) {
      console.log('Error saving groups', e);
      showCustomAlert('Error', 'Failed to save groups');
    } finally {
      setLoading(false);
    }
  };

  if (!visible) return null;

  const canSubmit = groups.length > 0 && groups.every(g => g.isSaved);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalBg}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Manage Groups</Text>
            <TouchableOpacity onPress={onClose}>
              <Icon name="x" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          
          <KeyboardAwareScrollView enableOnAndroid={true} extraScrollHeight={20} keyboardShouldPersistTaps="handled" style={{ flex: 1, marginTop: Spacing.sm, paddingHorizontal: Spacing.lg }}>
            {groups.length === 0 && (
              <Text style={styles.emptyText}>No groups created yet. Create one to assign teams.</Text>
            )}

            {[...groups].reverse().map((group, revIndex) => {
              const gIndex = groups.length - 1 - revIndex;
              const assignedIds = new Set();
              groups.slice(0, gIndex).forEach(g => {
                g.teams.forEach(t => assignedIds.add(String(t?._id || t)));
              });

              // Filter teams: only show if selected in this group, OR if not assigned to any previous group
              const availableTeams = registeredTeams.filter(rt => {
                const teamId = rt.team._id;
                const isSelected = group.teams.some(t => t === teamId || t._id === teamId);
                return isSelected || !assignedIds.has(String(teamId));
              });

              return (
                <View key={gIndex} style={styles.groupCard}>
                  <View style={styles.groupHeader}>
                    {group.isSaved ? (
                      <Text style={[styles.groupTitleText, { color: colors.textPrimary }]}>{group.name}</Text>
                    ) : (
                      <TextInput 
                        style={styles.groupTitleInput}
                        value={group.name}
                        onChangeText={(text) => updateGroupName(gIndex, text)}
                        placeholder={`Group Name`}
                        placeholderTextColor={colors.textTertiary}
                      />
                    )}
                    {gIndex > 0 && !group.isSaved && (
                      <TouchableOpacity onPress={() => handleRemoveGroup(gIndex)} style={{ padding: 4 }}>
                        <Icon name="trash-2" size={18} color={colors.error} />
                      </TouchableOpacity>
                    )}
                  </View>
                  
                  {!group.isSaved ? (
                    <>
                      <Text style={styles.subTitle}>Select Teams for {group.name || `Group ${gIndex + 1}`}:</Text>
                      {availableTeams.map(rt => {
                        const teamId = rt.team._id;
                        const isSelected = group.teams.some(t => t === teamId || t._id === teamId);
                        
                        return (
                          <TouchableOpacity 
                            key={teamId} 
                            style={styles.teamOption} 
                            onPress={() => toggleTeamInGroup(gIndex, teamId)}
                          >
                            <Icon 
                              name={isSelected ? "check-square" : "square"} 
                              size={20} 
                              color={isSelected ? colors.primary : colors.textSecondary} 
                            />
                            <Text style={[styles.teamName, isSelected && { color: colors.primary, fontFamily: Typography.fontFamily.bold }]}>
                              {rt.team.name}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}

                      <TouchableOpacity 
                        style={[styles.localSaveBtn, group.teams.length === 0 && { opacity: 0.5 }]}
                        onPress={() => handleLocalSaveGroup(gIndex)}
                        disabled={group.teams.length === 0}
                      >
                        <Text style={styles.localSaveBtnText}>Save {group.name}</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <View style={{ marginTop: 4 }}>
                      <Text style={styles.subTitle}>Assigned Teams:</Text>
                      {group.teams.map((t, idx) => {
                        const teamObj = registeredTeams.find(rt => String(rt.team?._id || rt.team) === String(t?._id || t))?.team;
                        return (
                          <View key={idx} style={styles.assignedTeamRow}>
                            <Icon name="users" size={14} color={colors.textSecondary} style={{ marginRight: 8 }} />
                            <Text style={styles.assignedTeamName}>{teamObj?.name || 'Unknown Team'}</Text>
                          </View>
                        );
                      })}
                      <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', paddingTop: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={styles.savedTeamsCountText}>
                          {group.teams.length} team(s) assigned
                        </Text>
                        <TouchableOpacity 
                          style={styles.localEditBtn}
                          onPress={() => handleLocalEditGroup(gIndex)}
                        >
                          <Icon name="edit-2" size={12} color={colors.primary} style={{ marginRight: 4 }} />
                          <Text style={styles.localEditBtnText}>Edit</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              );
            })}
          </KeyboardAwareScrollView>

          <View style={[styles.footer, { paddingHorizontal: Spacing.lg }]}>
            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, marginRight: Spacing.sm }]} onPress={onClose}>
              <Text style={[styles.saveBtnText, { color: colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.saveBtn, !canSubmit && { backgroundColor: colors.border, opacity: 0.5 }]} 
              onPress={handleSave} 
              disabled={loading || !canSubmit}
            >
              {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveBtnText}>Save Groups</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (colors, shadows, isDark) => StyleSheet.create({
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContainer: { backgroundColor: colors.background, borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl, height: '80%', paddingVertical: Spacing.lg },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: Spacing.md, paddingHorizontal: Spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalTitle: { fontSize: 20, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary },
  emptyText: { color: colors.textTertiary, fontFamily: Typography.fontFamily.regular, textAlign: 'center', marginTop: Spacing.lg },
  groupCard: { backgroundColor: colors.surface, borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: Spacing.md, borderWidth: 1, borderColor: colors.border },
  groupHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)', paddingBottom: Spacing.xs },
  groupTitleText: { fontSize: 16, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary },
  groupTitleInput: { flex: 1, fontSize: 16, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary, padding: 0, margin: 0 },
  subTitle: { fontSize: 12, fontFamily: Typography.fontFamily.medium, color: colors.textSecondary, marginBottom: Spacing.sm, marginTop: Spacing.xs },
  teamOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  teamName: { flex: 1, fontSize: 14, fontFamily: Typography.fontFamily.medium, color: colors.textPrimary, marginLeft: Spacing.sm },
  assignedTeamRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.xs },
  assignedTeamName: { fontSize: 14, fontFamily: Typography.fontFamily.medium, color: colors.textPrimary },
  footer: { flexDirection: 'row', marginTop: Spacing.md, paddingBottom: Spacing.lg },
  saveBtn: { flex: 1, backgroundColor: colors.primary, paddingVertical: Spacing.md, borderRadius: BorderRadius.lg, alignItems: 'center' },
  saveBtnText: { color: colors.white, fontFamily: Typography.fontFamily.bold, fontSize: 16 },
  localSaveBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  localSaveBtnText: {
    color: colors.white,
    fontFamily: Typography.fontFamily.bold,
    fontSize: 14,
  },
  localEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  localEditBtnText: {
    color: colors.primary,
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: 12,
  },
  savedTeamsCountText: {
    color: colors.textSecondary,
    fontFamily: Typography.fontFamily.medium,
    fontSize: 13,
  },
});

export default GroupManagementModal;
