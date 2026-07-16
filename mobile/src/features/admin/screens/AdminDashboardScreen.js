import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Modal, TextInput, Image, ScrollView } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { showCustomAlert } from '../../../components/CustomAlert';
import api, { getImageUrl } from '../../../api/axios';
import { launchImageLibrary } from 'react-native-image-picker';
import { formatISTDateSpelled } from '../../../utils/dateFormatter';
import { Colors, Typography, Spacing, BorderRadius } from '../../../theme/theme';
import moment from 'moment';
import { useDispatch } from 'react-redux';
import { logout } from '../../auth/authSlice';
import { navigate, reset } from '../../../navigation/navigationRef';
import { useFocusEffect } from '@react-navigation/native';
import NotificationBell from '../../../components/NotificationBell';

const AdminDashboardScreen = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState('owners'); // 'owners' or 'users'
  const [owners, setOwners] = useState([]);
  const [users, setUsers] = useState([]);
  const [turfs, setTurfs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [upiId, setUpiId] = useState('');
  const [bannerImage, setBannerImage] = useState(null);
  
  const [verifyModalVisible, setVerifyModalVisible] = useState(false);
  const [selectedVerificationPayment, setSelectedVerificationPayment] = useState(null);

  const dispatch = useDispatch();

  useFocusEffect(
    useCallback(() => {
      fetchData();
      fetchSettings();
    }, [])
  );

  const fetchSettings = async () => {
    try {
      const res = await api.get('/admin/settings');
      if (res.data.data?.upiId) setUpiId(res.data.data.upiId);
      if (res.data.data?.bannerUrl) setBannerImage({ uri: getImageUrl(res.data.data.bannerUrl), isExisting: true });
    } catch (err) {
      console.log('Failed to fetch admin settings', err);
    }
  };

  const handleSelectBanner = () => {
    launchImageLibrary({ mediaType: 'photo', quality: 0.8 }, (response) => {
      if (!response.didCancel && response.assets && response.assets.length > 0) {
        setBannerImage(response.assets[0]);
      }
    });
  };

  const saveSettings = async () => {
    try {
      const formData = new FormData();
      if (upiId) formData.append('upiId', upiId);
      if (bannerImage && !bannerImage.isExisting) {
        formData.append('banner', {
          uri: bannerImage.uri,
          type: bannerImage.type || 'image/jpeg',
          name: bannerImage.fileName || 'banner.jpg',
        });
      }

      await api.put('/admin/settings', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setShowSettings(false);
      showCustomAlert('Success', 'Platform settings updated successfully');
      fetchSettings();
    } catch (err) {
      showCustomAlert('Error', 'Failed to save settings');
    }
  };

  const handleToggleStatus = async (turfId) => {
    try {
      await api.put(`/admin/turfs/${turfId}/toggle-status`);
      fetchData();
    } catch (err) {
      showCustomAlert('Error', 'Failed to toggle status');
    }
  };

  const handleVerifySettlement = async (paymentId) => {
    try {
      await api.post(`/admin/payments/${paymentId}/verify`);
      showCustomAlert('Success', 'Payment verified and Turf activated (if suspended)!');
      setVerifyModalVisible(false);
      setSelectedVerificationPayment(null);
      fetchData();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Unknown error';
      showCustomAlert('Error', `Failed to verify payment: ${msg}`);
      console.log('Verify Error:', err.response?.data || err);
    }
  };

  const handleDeleteUser = async (userId) => {
    try {
      await api.delete(`/admin/users/${userId}`);
      showCustomAlert('Success', 'User and their bookings deleted successfully');
      fetchData();
    } catch (err) {
      showCustomAlert('Error', 'Failed to delete user');
    }
  };

  const handleDeleteTurf = async (turfId) => {
    try {
      await api.delete(`/admin/turfs/${turfId}`);
      showCustomAlert('Success', 'Turf and all its data deleted completely');
      fetchData();
    } catch (err) {
      showCustomAlert('Error', 'Failed to delete turf');
    }
  };

  const handleRejectDeletion = async (turfId) => {
    try {
      await api.put(`/admin/turfs/${turfId}/reject-deletion`);
      showCustomAlert('Success', 'Deletion request rejected');
      fetchData();
    } catch (err) {
      showCustomAlert('Error', 'Failed to reject deletion request');
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const ownersRes = await api.get('/admin/owners?limit=100');
      const usersRes = await api.get('/admin/users?limit=100');
      const turfsRes = await api.get('/admin/turfs?limit=100');
      
      setOwners(ownersRes.data.data || []);
      setUsers(usersRes.data.data || []);
      setTurfs(turfsRes.data.data || []);
    } catch (err) {
      console.error('Failed to fetch admin data', err);
    } finally {
      setLoading(false);
    }
  };

  const renderOwnerCard = ({ item }) => {
    const joinedDate = formatISTDateSpelled(item.userId?.createdAt || item.createdAt);
    const ownerName = item.businessName || item.userId?.name || 'Unknown Owner';
    const initials = ownerName.charAt(0).toUpperCase();

    return (
      <View style={styles.card}>
        <LinearGradient colors={['rgba(27,74,27,0.4)', 'transparent']} style={styles.cardGradBg}>
          <View style={styles.cardHeader}>
            <View style={styles.avatarWrap}>
              <LinearGradient colors={['#1a4a1a', '#0f2b0f']} style={styles.avatar}>
                <Text style={styles.avatarText}>{initials}</Text>
              </LinearGradient>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{ownerName}</Text>
              <Text style={styles.cardSubtitle} numberOfLines={1}>{item.userId?.email}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.joinedLabel}>JOINED</Text>
              <Text style={styles.joinedDate}>{joinedDate}</Text>
            </View>
          </View>
        </LinearGradient>
        
        {item.turfs && item.turfs.length > 0 ? (
          <View style={styles.turfsList}>
            <Text style={styles.sectionHeader}>Registered Turfs ({item.turfs.length})</Text>
            {item.turfs.map(turf => (
              <View key={turf._id} style={styles.turfItem}>
                <Icon name="soccer-field" size={14} color={Colors.primary} />
                <Text style={styles.turfName} numberOfLines={1}>{turf.name}</Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.noTurfs}>
            <Icon name="map-marker-off-outline" size={16} color={Colors.textTertiary} />
            <Text style={styles.noTurfsText}>No turfs registered yet.</Text>
          </View>
        )}
      </View>
    );
  };

  const renderUserCard = ({ item }) => {
    const joinedDate = formatISTDateSpelled(item.createdAt);
    const initials = (item.name || '?').charAt(0).toUpperCase();
    const isOwner = item.role === 'owner';
    
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.avatarWrap}>
            <LinearGradient colors={isOwner ? ['#1a2a4a', '#0a1528'] : ['#2a1a2a', '#150a15']} style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </LinearGradient>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{item.name || 'Unknown User'}</Text>
            <Text style={styles.cardSubtitle} numberOfLines={1}>{item.email}</Text>
          </View>
          <View>
            <View style={[styles.roleBadge, { backgroundColor: isOwner ? Colors.primaryAlpha20 : 'rgba(156,39,176,0.15)' }]}>
              <Icon name={isOwner ? 'briefcase' : 'account'} size={10} color={isOwner ? Colors.primary : '#9C27B0'} />
              <Text style={[styles.roleText, { color: isOwner ? Colors.primary : '#9C27B0' }]}>
                {item.role?.toUpperCase()}
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.cardFooter}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Icon name="calendar-outline" size={12} color={Colors.textTertiary} />
            <Text style={styles.joinedLabel}>Joined {joinedDate}</Text>
          </View>
          <TouchableOpacity onPress={() => {
            showCustomAlert(
              'Delete User',
              'Are you sure you want to delete this user and ALL their bookings? This cannot be undone.',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => handleDeleteUser(item._id) }
              ]
            );
          }} style={styles.deleteBtn}>
            <Icon name="trash-can-outline" size={14} color={Colors.error} />
            <Text style={styles.deleteUserText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderTurfCard = ({ item }) => {
    const statusColor = item.status === 'active' ? Colors.primary : item.status === 'suspended' ? Colors.error : '#FF9800';
    const statusBg = item.status === 'active' ? Colors.primaryAlpha20 : item.status === 'suspended' ? 'rgba(244,67,54,0.15)' : 'rgba(255,152,0,0.15)';
    return (
      <View style={styles.card}>
        <View style={[styles.turfStatusAccent, { backgroundColor: statusColor }]} />
        <View style={styles.cardHeader}>
          <View style={styles.avatarWrap}>
            <LinearGradient colors={['#1a3a1a', '#0f200f']} style={styles.avatar}>
              <Icon name="soccer-field" size={22} color={Colors.primary} />
            </LinearGradient>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{item.name}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
              <Icon name="map-marker-outline" size={12} color={Colors.textTertiary} />
              <Text style={styles.cardSubtitle}>{item.city}</Text>
              {item.pricing?.weekdayDay > 0 && (
                <>
                  <Text style={{ color: Colors.border }}>·</Text>
                  <Text style={[styles.cardSubtitle, { color: Colors.primary }]}>₹{item.pricing.weekdayDay}/hr</Text>
                </>
              )}
            </View>
          </View>
          <View style={[styles.roleBadge, { backgroundColor: statusBg }]}>
            <Icon name={item.status === 'active' ? 'check-circle' : item.status === 'suspended' ? 'alert-circle' : 'clock-outline'} size={10} color={statusColor} />
            <Text style={[styles.roleText, { color: statusColor }]}>{item.status.toUpperCase()}</Text>
          </View>
        </View>

        <View style={styles.turfMeta}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Icon name="account-tie" size={12} color={Colors.textTertiary} />
            <Text style={styles.turfMetaText}>{item.owner?.businessName || item.owner?.userId?.name || 'Owner'}</Text>
          </View>
        </View>

        <View style={[styles.cardFooter, { paddingTop: 0 }]}>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {item.deletionRequested && (
              <>
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: Colors.surfaceVariant }]} onPress={() => {
                  showCustomAlert('Reject Deletion', 'Reject the deletion request for this turf?', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Reject', onPress: () => handleRejectDeletion(item._id) }
                  ]);
                }}>
                  <Icon name="cancel" size={12} color={Colors.textPrimary} />
                  <Text style={[styles.actionBtnText, { color: Colors.textPrimary }]}>Reject Del.</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: 'rgba(244,67,54,0.15)', borderColor: Colors.error }]} onPress={() => {
                  showCustomAlert('Approve Deletion', 'Permanently delete this turf, its slots, and bookings?', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: () => handleDeleteTurf(item._id) }
                  ]);
                }}>
                  <Icon name="trash-can-outline" size={12} color={Colors.error} />
                  <Text style={[styles.actionBtnText, { color: Colors.error }]}>Approve Del.</Text>
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: item.status === 'active' ? 'rgba(255,71,87,0.12)' : Colors.primaryAlpha20, borderColor: item.status === 'active' ? '#FF4757' : Colors.primary }]} onPress={() => {
              const actionName = item.status === 'active' ? 'Suspend' : 'Activate';
              showCustomAlert(`Confirm ${actionName}`, `Are you sure you want to ${actionName.toLowerCase()} this turf?`, [
                { text: 'Cancel', style: 'cancel' },
                { text: actionName, onPress: () => handleToggleStatus(item._id) }
              ]);
            }}>
              <Icon name={item.status === 'active' ? 'pause-circle-outline' : 'play-circle-outline'} size={12} color={item.status === 'active' ? '#FF4757' : Colors.primary} />
              <Text style={[styles.actionBtnText, { color: item.status === 'active' ? '#FF4757' : Colors.primary }]}>
                {item.status === 'active' ? 'Suspend' : 'Activate'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const handleLogout = () => {
    showCustomAlert("Confirm Logout", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Logout", style: "destructive", onPress: () => {
        dispatch(logout());
        setTimeout(() => {
          reset('Customer');
        }, 100);
      }}
    ]);
  };

  return (
    <View style={styles.container}>
      {/* ── Premium Header ──────────────────────────────── */}
      <LinearGradient
        colors={['#0d2b0d', '#0a1f0a', Colors.background]}
        style={styles.header}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      >
        {/* Top row: title + actions */}
        <View style={styles.headerTop}>
          <View style={styles.headerTitleBlock}>
            <View style={styles.adminBadge}>
              <Icon name="shield-crown" size={13} color={Colors.primary} />
              <Text style={styles.adminBadgeText}>ADMIN</Text>
            </View>
            <Text style={styles.headerTitle}>Dashboard</Text>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={() => navigation.navigate('AdminSettlements')}
              style={styles.headerActionBtn}
              activeOpacity={0.8}
            >
              <Icon name="bank-transfer" size={19} color={Colors.primary} />
              <Text style={styles.headerActionLabel}>Settle</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setShowSettings(true)}
              style={styles.headerActionBtn}
              activeOpacity={0.8}
            >
              <Icon name="tune-variant" size={19} color={Colors.textSecondary} />
              <Text style={[styles.headerActionLabel, { color: Colors.textSecondary }]}>Config</Text>
            </TouchableOpacity>

            <NotificationBell onPress={() => navigation.navigate('Notifications')} />

            <TouchableOpacity
              onPress={handleLogout}
              style={[styles.headerActionBtn, { backgroundColor: 'rgba(255,71,87,0.12)', borderColor: 'rgba(255,71,87,0.25)' }]}
              activeOpacity={0.8}
            >
              <Icon name="logout" size={19} color="#FF4757" />
              <Text style={[styles.headerActionLabel, { color: '#FF4757' }]}>Logout</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Divider */}
        <View style={styles.headerDivider} />

        {/* Stats Row */}
        <View style={styles.statsContainer}>
          <View style={styles.statBox}>
            <LinearGradient colors={[Colors.primaryAlpha20, 'transparent']} style={styles.statGrad}>
              <Icon name="account-group" size={20} color={Colors.primary} />
              <Text style={styles.statValue}>{owners.length + users.length}</Text>
              <Text style={styles.statLabel}>Total Users</Text>
            </LinearGradient>
          </View>
          <View style={styles.statBox}>
            <LinearGradient colors={['rgba(91,141,239,0.18)', 'transparent']} style={styles.statGrad}>
              <Icon name="briefcase-account" size={20} color="#5B8DEF" />
              <Text style={[styles.statValue, { color: '#5B8DEF' }]}>{owners.length}</Text>
              <Text style={styles.statLabel}>Owners</Text>
            </LinearGradient>
          </View>
          <View style={styles.statBox}>
            <LinearGradient colors={['rgba(46,213,115,0.18)', 'transparent']} style={styles.statGrad}>
              <Icon name="soccer-field" size={20} color="#2ED573" />
              <Text style={[styles.statValue, { color: '#2ED573' }]}>{turfs.length}</Text>
              <Text style={styles.statLabel}>Turfs</Text>
            </LinearGradient>
          </View>
        </View>
      </LinearGradient>
      
      {/* Settings Modal */}
      <Modal visible={showSettings} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <KeyboardAwareScrollView style={styles.modalContent} keyboardShouldPersistTaps="handled">
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg }}>
              <Text style={styles.modalTitle}>Platform Settings</Text>
              <TouchableOpacity onPress={() => setShowSettings(false)}><Icon name="close" size={24} color={Colors.textPrimary}/></TouchableOpacity>
            </View>
            <Text style={styles.inputLabel}>Admin UPI ID (For receiving platform fees)</Text>
            <TextInput
              style={styles.input}
              value={upiId}
              onChangeText={setUpiId}
              placeholder="e.g. admin@upi"
              placeholderTextColor={Colors.textTertiary}
            />

            <Text style={[styles.inputLabel, { marginTop: Spacing.lg }]}>Platform Banner Image</Text>
            <TouchableOpacity style={styles.bannerUploadBtn} onPress={handleSelectBanner}>
              {bannerImage ? (
                <Image source={{ uri: bannerImage.uri }} style={styles.bannerPreview} resizeMode="cover" />
              ) : (
                <View style={{ alignItems: 'center' }}>
                  <Icon name="image-plus" size={32} color={Colors.primary} />
                  <Text style={styles.bannerUploadText}>Select Banner Image</Text>
                </View>
              )}
            </TouchableOpacity>

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: Colors.surfaceVariant }]} onPress={() => setShowSettings(false)}>
                <Text style={[styles.modalBtnText, { color: Colors.textPrimary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: Colors.primary }]} onPress={saveSettings}>
                <Text style={[styles.modalBtnText, { color: Colors.background }]}>Save</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAwareScrollView>
          </View>
      </Modal>

      {/* Verify Payment Modal */}
      <Modal visible={verifyModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <KeyboardAwareScrollView style={styles.modalContent} keyboardShouldPersistTaps="handled">
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md }}>
              <Text style={styles.modalTitle}>Verify Payment</Text>
              <TouchableOpacity onPress={() => setVerifyModalVisible(false)}><Icon name="close" size={24} color={Colors.textPrimary}/></TouchableOpacity>
            </View>
            <Text style={[styles.inputLabel, { marginBottom: Spacing.lg }]}>Turf: {selectedVerificationPayment?.turfName}</Text>
            
            {selectedVerificationPayment?.proof ? (
              <Image source={{ uri: getImageUrl(selectedVerificationPayment.proof) }} style={{ width: '100%', height: 300, borderRadius: BorderRadius.md, backgroundColor: '#000', marginBottom: Spacing.lg }} resizeMode="contain" />
            ) : (
              <View style={{ width: '100%', height: 200, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: BorderRadius.md, marginBottom: Spacing.lg }}>
                <Text style={{ color: Colors.textTertiary }}>No screenshot available</Text>
              </View>
            )}

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 10 }}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: Colors.surfaceVariant }]} onPress={() => setVerifyModalVisible(false)}>
                <Text style={[styles.modalBtnText, { color: Colors.textPrimary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: Colors.primary }]} onPress={() => handleVerifySettlement(selectedVerificationPayment.id)}>
                <Text style={[styles.modalBtnText, { color: Colors.background }]}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAwareScrollView>
          </View>
      </Modal>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'owners' && styles.tabActive]}
          onPress={() => setActiveTab('owners')}
        >
          <Text style={[styles.tabText, activeTab === 'owners' && styles.tabTextActive]}>Owners ({owners.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'turfs' && styles.tabActive]}
          onPress={() => setActiveTab('turfs')}
        >
          <View style={{flexDirection: 'row', alignItems: 'center'}}>
            <Text style={[styles.tabText, activeTab === 'turfs' && styles.tabTextActive]}>Turfs ({turfs.length})</Text>
            {turfs.filter(t => t.pendingPlatformFee > 0 && t.pendingPaymentId).length > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{turfs.filter(t => t.pendingPlatformFee > 0 && t.pendingPaymentId).length}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'users' && styles.tabActive]}
          onPress={() => setActiveTab('users')}
        >
          <Text style={[styles.tabText, activeTab === 'users' && styles.tabTextActive]}>Users ({users.length})</Text>
        </TouchableOpacity>
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : activeTab === 'owners' ? (
        <FlatList
          data={owners}
          keyExtractor={item => item._id}
          renderItem={renderOwnerCard}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.emptyText}>No owners found.</Text>}
        />
      ) : activeTab === 'turfs' ? (
        <FlatList
          data={turfs}
          keyExtractor={item => item._id}
          renderItem={renderTurfCard}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.emptyText}>No turfs found.</Text>}
        />
      ) : (
        <FlatList
          data={users}
          keyExtractor={item => item._id}
          renderItem={renderUserCard}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.emptyText}>No users found.</Text>}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  // ── Header ──────────────────────────────────────────────────────────────
  header: {
    paddingTop: 52, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  headerTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  headerTitleBlock: { gap: 4 },
  adminBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
    backgroundColor: Colors.primaryAlpha20, paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 8, borderWidth: 1, borderColor: Colors.primaryAlpha30,
  },
  adminBadgeText: { fontSize: 10, fontFamily: Typography.fontFamily.bold, color: Colors.primary, letterSpacing: 1.2 },
  headerTitle: { fontSize: 26, fontFamily: Typography.fontFamily.extraBold, color: Colors.textPrimary },

  // Header action buttons (icon + label)
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 4 },
  headerActionBtn: {
    alignItems: 'center', gap: 3, paddingHorizontal: 10, paddingVertical: 7,
    backgroundColor: Colors.surface, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border,
    minWidth: 52,
  },
  headerActionLabel: { fontSize: 9, fontFamily: Typography.fontFamily.bold, color: Colors.primary, letterSpacing: 0.3 },

  headerDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.07)', marginVertical: Spacing.md },

  // ── Stats ──────────────────────────────────────────────────────────────
  statsContainer: { flexDirection: 'row', gap: 10 },
  statBox: { flex: 1, borderRadius: BorderRadius.lg, overflow: 'hidden', borderWidth: 1, borderColor: Colors.border },
  statGrad: { alignItems: 'center', paddingVertical: Spacing.md, paddingHorizontal: 4, gap: 4 },
  statValue: { fontSize: 22, fontFamily: Typography.fontFamily.extraBold, color: Colors.primary },
  statLabel: { fontSize: 9, fontFamily: Typography.fontFamily.bold, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },

  // ── Tabs ──────────────────────────────────────────────────────────────
  tabsContainer: { flexDirection: 'row', paddingHorizontal: Spacing.lg, backgroundColor: Colors.backgroundCard, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tab: { flex: 1, paddingVertical: Spacing.md, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: Colors.primary },
  tabText: { color: Colors.textTertiary, fontFamily: Typography.fontFamily.medium, fontSize: 13 },
  tabTextActive: { color: Colors.primary, fontFamily: Typography.fontFamily.bold },
  badge: { backgroundColor: Colors.error, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2, marginLeft: 6 },
  badgeText: { color: '#FFF', fontSize: 10, fontFamily: Typography.fontFamily.bold },

  list: { padding: Spacing.md, paddingBottom: 100 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: Colors.textSecondary, textAlign: 'center', marginTop: Spacing.xl, fontFamily: Typography.fontFamily.medium },

  // ── Cards ──────────────────────────────────────────────────────────────
  card: { backgroundColor: Colors.backgroundCard, borderRadius: BorderRadius.xl, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.md, overflow: 'hidden' },
  cardGradBg: { },
  turfStatusAccent: { height: 3, width: '100%' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, gap: 12 },
  avatarWrap: { borderRadius: 25, overflow: 'hidden' },
  avatar: { width: 46, height: 46, borderRadius: 23, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 18, fontFamily: Typography.fontFamily.extraBold, color: '#fff' },
  cardTitle: { fontSize: 15, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary },
  cardSubtitle: { fontSize: 12, color: Colors.textTertiary, fontFamily: Typography.fontFamily.regular, marginTop: 2 },

  joinedLabel: { fontSize: 10, color: Colors.textTertiary, fontFamily: Typography.fontFamily.bold, textTransform: 'uppercase' },
  joinedDate: { fontSize: 12, color: Colors.textPrimary, fontFamily: Typography.fontFamily.bold, marginTop: 2 },

  roleBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  roleText: { fontSize: 10, fontFamily: Typography.fontFamily.bold },

  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.md, paddingBottom: Spacing.md },
  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7,
    backgroundColor: 'rgba(255,71,87,0.1)',
    borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,71,87,0.25)',
  },
  deleteUserText: { color: '#FF4757', fontFamily: Typography.fontFamily.bold, fontSize: 12 },

  turfsList: { backgroundColor: Colors.backgroundElevated, paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.sm },
  sectionHeader: { fontSize: 10, fontFamily: Typography.fontFamily.bold, color: Colors.textTertiary, marginBottom: Spacing.sm, textTransform: 'uppercase', letterSpacing: 0.5 },
  turfItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, paddingHorizontal: Spacing.sm, paddingVertical: 8, borderRadius: BorderRadius.md, marginBottom: 4, gap: 8, borderWidth: 1, borderColor: Colors.border },
  turfName: { flex: 1, fontSize: 13, color: Colors.textPrimary, fontFamily: Typography.fontFamily.medium },
  turfMeta: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm },
  turfMetaText: { fontSize: 12, color: Colors.textTertiary, fontFamily: Typography.fontFamily.regular },
  turfPrice: { fontSize: 14, color: Colors.primary, fontFamily: Typography.fontFamily.bold },

  noTurfs: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.backgroundElevated, padding: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border },
  noTurfsText: { color: Colors.textTertiary, fontFamily: Typography.fontFamily.regular, fontSize: 12, fontStyle: 'italic' },

  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, backgroundColor: Colors.surfaceVariant, borderWidth: 1, borderColor: Colors.border },
  actionBtnText: { color: Colors.textPrimary, fontFamily: Typography.fontFamily.bold, fontSize: 12 },

  // ── Modals ──────────────────────────────────────────────────────────────
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '90%', backgroundColor: Colors.backgroundCard, borderRadius: BorderRadius.xl, padding: Spacing.xl },
  modalTitle: { fontSize: 18, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary, marginBottom: Spacing.lg },
  inputLabel: { fontSize: 13, color: Colors.textSecondary, fontFamily: Typography.fontFamily.medium, marginBottom: 8 },
  input: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.md, padding: 12, color: Colors.textPrimary, fontFamily: Typography.fontFamily.medium },
  modalBtn: { flex: 1, padding: 14, borderRadius: BorderRadius.md, alignItems: 'center' },
  modalBtnText: { fontFamily: Typography.fontFamily.bold, fontSize: 14 },

  bannerUploadBtn: { height: 120, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.md, justifyContent: 'center', alignItems: 'center', borderStyle: 'dashed', overflow: 'hidden' },
  bannerPreview: { width: '100%', height: '100%' },
  bannerUploadText: { color: Colors.primary, fontFamily: Typography.fontFamily.medium, marginTop: 8 },
});

export default AdminDashboardScreen;

