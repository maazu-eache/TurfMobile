import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import Icon from 'react-native-vector-icons/Feather';
import { Colors, Typography, Spacing, BorderRadius } from '../../../theme/theme';
import api from '../../../api/axios';
import { showCustomAlert } from '../../../components/CustomAlert';

const GroupManagementModal = ({ visible, onClose, tournament, onRefresh }) => {
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState([]);
  
  const registeredTeams = tournament?.registeredTeams || [];
  
  useEffect(() => {
    if (visible && tournament) {
      setGroups(tournament.groups ? JSON.parse(JSON.stringify(tournament.groups)) : []);
    }
  }, [visible, tournament]);
  
  const handleAddGroup = () => {
    const nextChar = String.fromCharCode(65 + groups.length); // 65 is 'A'
    setGroups([...groups, { name: `Group ${nextChar}`, teams: [] }]);
  };

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

  const handleSave = async () => {
    // Validations
    if (groups.length === 0) {
      return showCustomAlert('Error', 'Please create at least one group.');
    }
    
    for (let i = 0; i < groups.length; i++) {
      if (!groups[i].name.trim()) {
        return showCustomAlert('Error', `Group ${i + 1} is missing a name.`);
      }
      if (groups[i].teams.length === 0) {
        return showCustomAlert('Error', `"${groups[i].name}" has no teams. Please add teams or remove the group.`);
      }
    }

    // Check if there are any unassigned teams
    const totalAssignedTeams = groups.reduce((acc, g) => acc + g.teams.length, 0);
    if (totalAssignedTeams < registeredTeams.length) {
      showCustomAlert(
        'Unassigned Teams',
        'Some teams are not assigned to any group. Are you sure you want to save?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Save Anyway', onPress: saveToBackend }
        ]
      );
    } else {
      saveToBackend();
    }
  };

  const saveToBackend = async () => {
    try {
      setLoading(true);
      
      // Clean up the groups array to only contain ObjectIds for the teams
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

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalBg}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Manage Groups</Text>
            <TouchableOpacity onPress={onClose}>
              <Icon name="x" size={24} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <View style={[styles.addGroupContainer, { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, marginBottom: 0 }]}>
            <TouchableOpacity style={[styles.addBtn, { flex: 1, flexDirection: 'row', justifyContent: 'center' }]} onPress={handleAddGroup}>
              <Icon name="plus" size={20} color={Colors.white} style={{ marginRight: 8 }} />
              <Text style={{ color: Colors.white, fontFamily: Typography.fontFamily.bold }}>Add Next Group</Text>
            </TouchableOpacity>
          </View>
          
          <KeyboardAwareScrollView enableOnAndroid={true} extraScrollHeight={20} keyboardShouldPersistTaps="handled" style={{ flex: 1, marginTop: Spacing.sm, paddingHorizontal: Spacing.lg }}>


            {groups.length === 0 && (
              <Text style={styles.emptyText}>No groups created yet. Create one to assign teams.</Text>
            )}

            {groups.map((group, gIndex) => (
              <View key={gIndex} style={styles.groupCard}>
                <View style={styles.groupHeader}>
                  <TextInput 
                    style={styles.groupTitleInput}
                    value={group.name}
                    onChangeText={(text) => updateGroupName(gIndex, text)}
                    placeholder={`Group Name`}
                    placeholderTextColor={Colors.textTertiary}
                  />
                  <TouchableOpacity onPress={() => handleRemoveGroup(gIndex)} style={{ padding: 4 }}>
                    <Icon name="trash-2" size={18} color={Colors.error} />
                  </TouchableOpacity>
                </View>
                
                <Text style={styles.subTitle}>Select Teams for {group.name || `Group ${gIndex + 1}`}:</Text>
                
                {registeredTeams
                  .filter(rt => {
                    const teamId = rt.team._id;
                    const isSelected = group.teams.some(t => t === teamId || t._id === teamId);
                    const existingGroup = groups.find(g => g !== group && g.teams.some(id => id === teamId || id._id === teamId));
                    // Only show if it's selected in THIS group, or if it's NOT in ANY other group
                    return isSelected || !existingGroup;
                  })
                  .map(rt => {
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
                          color={isSelected ? Colors.primary : Colors.textSecondary} 
                        />
                        <Text style={[styles.teamName, isSelected && { color: Colors.primary, fontFamily: Typography.fontFamily.bold }]}>
                          {rt.team.name}
                        </Text>
                      </TouchableOpacity>
                    );
                })}
              </View>
            ))}
          </KeyboardAwareScrollView>

          <View style={[styles.footer, { paddingHorizontal: Spacing.lg }]}>
            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, marginRight: Spacing.sm }]} onPress={onClose}>
              <Text style={[styles.saveBtnText, { color: Colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={loading}>
              {loading ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.saveBtnText}>Save Groups</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContainer: { backgroundColor: Colors.background, borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl, height: '80%', paddingVertical: Spacing.lg },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: Spacing.md, paddingHorizontal: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalTitle: { fontSize: 20, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary },
  addGroupContainer: { flexDirection: 'row', marginBottom: Spacing.lg, alignItems: 'center' },
  input: { flex: 1, backgroundColor: Colors.backgroundElevated, color: Colors.textPrimary, padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border },
  addBtn: { backgroundColor: Colors.primary, padding: Spacing.md, borderRadius: BorderRadius.md, marginLeft: Spacing.sm },
  emptyText: { color: Colors.textTertiary, fontFamily: Typography.fontFamily.regular, textAlign: 'center', marginTop: Spacing.lg },
  groupCard: { backgroundColor: Colors.backgroundElevated, borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  groupHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border, paddingBottom: Spacing.xs },
  groupTitleInput: { flex: 1, fontSize: 16, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary, padding: 0, margin: 0 },
  subTitle: { fontSize: 12, fontFamily: Typography.fontFamily.medium, color: Colors.textSecondary, marginBottom: Spacing.sm, marginTop: Spacing.xs },
  teamOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  teamName: { flex: 1, fontSize: 14, fontFamily: Typography.fontFamily.medium, color: Colors.textPrimary, marginLeft: Spacing.sm },
  existingGroupTag: { fontSize: 11, fontFamily: Typography.fontFamily.regular, color: Colors.textTertiary, fontStyle: 'italic', marginLeft: Spacing.sm },
  footer: { flexDirection: 'row', marginTop: Spacing.md, paddingBottom: Spacing.lg },
  saveBtn: { flex: 1, backgroundColor: Colors.primary, paddingVertical: Spacing.md, borderRadius: BorderRadius.lg, alignItems: 'center' },
  saveBtnText: { color: Colors.white, fontFamily: Typography.fontFamily.bold, fontSize: 16 }
});

export default GroupManagementModal;
