import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Image } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import Icon from 'react-native-vector-icons/Feather';
import { Colors, Typography, Spacing, BorderRadius } from '../../../theme/theme';
import api from '../../../api/axios';
import { showCustomAlert } from '../../../components/CustomAlert';

const RoleManagementModal = ({ visible, onClose, tournament, onRefresh, roleType }) => {
  const [loading, setLoading] = useState(false);
  const [mobileToSearch, setMobileToSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState(null);
  const [currentUsers, setCurrentUsers] = useState([]);
  
  useEffect(() => {
    if (visible && tournament) {
      if (roleType === 'coOrganizers') {
        setCurrentUsers(tournament.coOrganizers || []);
      } else if (roleType === 'scorers') {
        setCurrentUsers(tournament.scorers || []);
      }
    }
  }, [visible, tournament, roleType]);

  const handleSearch = async () => {
    if (!mobileToSearch || mobileToSearch.length < 10) {
      showCustomAlert('Error', 'Please enter a valid mobile number');
      return;
    }
    
    try {
      setSearching(true);
      const { data } = await api.get(`/users/lookup/${mobileToSearch}`);
      if (data.exists) {
        setSearchResults(data.user);
      } else {
        showCustomAlert('Not Found', 'No user found with this mobile number');
        setSearchResults(null);
      }
    } catch (e) {
      console.log('Lookup error', e);
      showCustomAlert('Error', 'Failed to search for user');
    } finally {
      setSearching(false);
    }
  };

  const handleAddUser = () => {
    if (!searchResults) return;
    
    // Check if already in list
    const exists = currentUsers.some(u => u._id === searchResults._id);
    if (exists) {
      showCustomAlert('Error', 'User is already added to this role');
      return;
    }
    
    setCurrentUsers([...currentUsers, searchResults]);
    setSearchResults(null);
    setMobileToSearch('');
  };

  const handleRemoveUser = (userId) => {
    setCurrentUsers(currentUsers.filter(u => u._id !== userId));
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      
      const payloadIds = currentUsers.map(u => u._id);
      const payload = {};
      if (roleType === 'coOrganizers') payload.coOrganizers = payloadIds;
      if (roleType === 'scorers') payload.scorers = payloadIds;
      
      await api.put(`/tournaments/${tournament._id}/roles`, payload);
      showCustomAlert('Success', `${roleType === 'coOrganizers' ? 'Organizers' : 'Scorers'} updated successfully`);
      onRefresh();
      onClose();
    } catch (e) {
      console.log('Error saving roles', e);
      showCustomAlert('Error', 'Failed to save roles');
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
            <Text style={styles.modalTitle}>Manage {roleType === 'coOrganizers' ? 'Organizers' : 'Scorers'}</Text>
            <TouchableOpacity onPress={onClose}>
              <Icon name="x" size={24} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
          
          <KeyboardAwareScrollView enableOnAndroid={true} extraScrollHeight={20} keyboardShouldPersistTaps="handled" style={{ flex: 1, marginTop: Spacing.sm }}>
            <View style={styles.searchContainer}>
              <TextInput
                style={styles.input}
                placeholder="Enter 10-digit mobile number"
                placeholderTextColor={Colors.textTertiary}
                value={mobileToSearch}
                onChangeText={setMobileToSearch}
                keyboardType="phone-pad"
                maxLength={10}
              />
              <TouchableOpacity style={styles.searchBtn} onPress={handleSearch} disabled={searching}>
                {searching ? <ActivityIndicator size="small" color={Colors.white} /> : <Icon name="search" size={20} color={Colors.white} />}
              </TouchableOpacity>
            </View>

            {searchResults && (
              <View style={styles.resultCard}>
                <Image source={{ uri: searchResults.photo || 'https://via.placeholder.com/50' }} style={styles.userPhoto} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.userName}>{searchResults.name}</Text>
                </View>
                <TouchableOpacity style={styles.addBtn} onPress={handleAddUser}>
                  <Text style={styles.addBtnText}>Add</Text>
                </TouchableOpacity>
              </View>
            )}

            <Text style={styles.subTitle}>Current {roleType === 'coOrganizers' ? 'Organizers' : 'Scorers'}</Text>
            
            {currentUsers.length === 0 && (
              <Text style={styles.emptyText}>No users added yet.</Text>
            )}

            {currentUsers.map((user) => (
              <View key={user._id} style={styles.userCard}>
                <Image source={{ uri: user.photo || 'https://via.placeholder.com/50' }} style={styles.userPhoto} />
                <Text style={[styles.userName, { flex: 1 }]}>{user.name}</Text>
                <TouchableOpacity onPress={() => handleRemoveUser(user._id)} style={{ padding: Spacing.xs }}>
                  <Icon name="trash-2" size={20} color={Colors.error} />
                </TouchableOpacity>
              </View>
            ))}
          </KeyboardAwareScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, marginRight: Spacing.sm }]} onPress={onClose}>
              <Text style={[styles.saveBtnText, { color: Colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={loading}>
              {loading ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.saveBtnText}>Save</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContainer: { backgroundColor: Colors.background, borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl, height: '70%', padding: Spacing.lg },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalTitle: { fontSize: 20, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary },
  searchContainer: { flexDirection: 'row', marginBottom: Spacing.lg, alignItems: 'center' },
  input: { flex: 1, backgroundColor: Colors.backgroundElevated, color: Colors.textPrimary, padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border },
  searchBtn: { backgroundColor: Colors.primary, padding: Spacing.md, borderRadius: BorderRadius.md, marginLeft: Spacing.sm, height: 50, width: 50, alignItems: 'center', justifyContent: 'center' },
  resultCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.backgroundElevated, padding: Spacing.md, borderRadius: BorderRadius.md, marginBottom: Spacing.lg, borderWidth: 1, borderColor: Colors.primary },
  userPhoto: { width: 40, height: 40, borderRadius: 20, marginRight: Spacing.md },
  userName: { fontSize: 16, fontFamily: Typography.fontFamily.medium, color: Colors.textPrimary },
  addBtn: { backgroundColor: Colors.primary, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.sm },
  addBtnText: { color: Colors.white, fontFamily: Typography.fontFamily.bold },
  subTitle: { fontSize: 16, fontFamily: Typography.fontFamily.bold, color: Colors.textSecondary, marginBottom: Spacing.md },
  userCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.backgroundElevated, padding: Spacing.md, borderRadius: BorderRadius.md, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  emptyText: { color: Colors.textTertiary, fontFamily: Typography.fontFamily.regular, textAlign: 'center', marginTop: Spacing.sm },
  footer: { flexDirection: 'row', marginTop: Spacing.md, paddingBottom: Spacing.lg },
  saveBtn: { flex: 1, backgroundColor: Colors.primary, paddingVertical: Spacing.md, borderRadius: BorderRadius.lg, alignItems: 'center' },
  saveBtnText: { color: Colors.white, fontFamily: Typography.fontFamily.bold, fontSize: 16 }
});

export default RoleManagementModal;
