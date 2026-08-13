import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, ActivityIndicator, Image } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import Icon from 'react-native-vector-icons/Feather';
import { Colors, Typography, Spacing, BorderRadius } from '../../../theme/theme';
import api, { getImageUrl } from '../../../api/axios';
import { showCustomAlert } from '../../../components/CustomAlert';

const RoleManagementModal = ({ visible, onClose, tournament, onRefresh }) => {
  const [loading, setLoading] = useState(false);
  const [mobileToSearch, setMobileToSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState(null);
  const [coOrganizer, setCoOrganizer] = useState(null);

  useEffect(() => {
    if (visible && tournament) {
      const coOrgs = tournament.coOrganizers || [];
      setCoOrganizer(coOrgs.length > 0 ? coOrgs[0] : null);
      setSearchResults(null);
      setMobileToSearch('');
    }
  }, [visible, tournament]);

  const handleSearch = async () => {
    if (!mobileToSearch || mobileToSearch.length < 10) {
      showCustomAlert('Error', 'Please enter a valid 10-digit mobile number');
      return;
    }
    try {
      setSearching(true);
      const res = await api.get(`/users/lookup/${mobileToSearch}`);
      const payload = res.data?.data || res.data;
      if (payload?.exists && payload?.user) {
        setSearchResults(payload.user);
      } else {
        showCustomAlert('Not Found', 'No user found with this mobile number');
        setSearchResults(null);
      }
    } catch (e) {
      showCustomAlert('Error', 'Failed to search for user');
    } finally {
      setSearching(false);
    }
  };

  const handleSelectCoOrganizer = () => {
    if (!searchResults) return;
    setCoOrganizer(searchResults);
    setSearchResults(null);
    setMobileToSearch('');
  };

  const handleRemoveCoOrganizer = () => {
    setCoOrganizer(null);
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      const payload = {
        coOrganizers: coOrganizer ? [coOrganizer._id || coOrganizer.id || coOrganizer] : []
      };
      
      await api.put(`/tournaments/${tournament._id}/roles`, payload);
      showCustomAlert('Success', 'Co-Organizer updated successfully');
      if (onRefresh) await onRefresh();
      onClose();
    } catch (e) {
      showCustomAlert('Error', e.response?.data?.message || 'Failed to save co-organizer');
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
            <Text style={styles.modalTitle}>Manage Co-Organizer</Text>
            <TouchableOpacity onPress={onClose}>
              <Icon name="x" size={24} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <KeyboardAwareScrollView enableOnAndroid extraScrollHeight={20} keyboardShouldPersistTaps="handled" style={{ flex: 1, marginTop: Spacing.sm }}>
            {!coOrganizer && (
              <>
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
                    {searchResults.photo ? (
                      <Image source={{ uri: getImageUrl(searchResults.photo) }} style={styles.userPhoto} />
                    ) : (
                      <View style={styles.userPhotoPlaceholder}>
                        <Icon name="user" size={20} color={Colors.primary} />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.userName}>{searchResults.name}</Text>
                    </View>
                    <TouchableOpacity style={styles.addBtn} onPress={handleSelectCoOrganizer}>
                      <Text style={styles.addBtnText}>Select</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}

            <Text style={styles.subTitle}>Current Co-Organizer (Max 1)</Text>
            
            {coOrganizer ? (
              <View style={styles.userCard}>
                {coOrganizer.photo ? (
                  <Image source={{ uri: getImageUrl(coOrganizer.photo) }} style={styles.userPhoto} />
                ) : (
                  <View style={styles.userPhotoPlaceholder}>
                    <Icon name="user" size={20} color={Colors.primary} />
                  </View>
                )}
                <Text style={[styles.userName, { flex: 1 }]}>{coOrganizer.name || coOrganizer.mobile || 'User'}</Text>
                <TouchableOpacity onPress={handleRemoveCoOrganizer} style={{ padding: Spacing.xs }}>
                  <Icon name="trash-2" size={20} color={Colors.error} />
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={styles.emptyText}>No co-organizer added yet.</Text>
            )}
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
  userPhotoPlaceholder: { width: 40, height: 40, borderRadius: 20, marginRight: Spacing.md, backgroundColor: 'rgba(46, 204, 113, 0.15)', justifyContent: 'center', alignItems: 'center' },
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
