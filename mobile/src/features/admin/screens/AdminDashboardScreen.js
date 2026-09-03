import React, { useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Modal, TextInput, Image, ScrollView, Animated, Dimensions, Platform, Switch } from 'react-native';
import FinanceView from './FinanceView';
import SupportAdminView from './SupportAdminView';
import UgcReportsAdminView from './UgcReportsAdminView';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SIDEBAR_WIDTH = 220;

import LinearGradient from '../../../components/SolidGradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { showCustomAlert } from '../../../components/CustomAlert';
import api, { getImageUrl } from '../../../api/axios';
import { launchImageLibrary } from 'react-native-image-picker';
import { formatISTDateSpelled } from '../../../utils/dateFormatter';
import AppUpdateBanner from '../../../components/common/AppUpdateBanner';
import { Colors, Typography, Spacing, BorderRadius } from '../../../theme/theme';
import moment from 'moment';
import { useDispatch } from 'react-redux';
import { logout } from '../../auth/authSlice';
import { navigate, reset } from '../../../navigation/navigationRef';
import { useFocusEffect } from '@react-navigation/native';
import NotificationBell from '../../../components/NotificationBell';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useTheme } from '../../../theme/ThemeContext';

const AdminSearchBar = React.memo(({ searchQuery, setSearchQuery, colors, styles }) => (
  <View style={styles.searchBar}>
    <Icon name="magnify" size={18} color={colors.textTertiary} />
    <TextInput
      style={styles.searchInput}
      placeholder="Search by name or email..."
      placeholderTextColor={colors.textTertiary}
      value={searchQuery}
      onChangeText={setSearchQuery}
      autoCapitalize="none"
      autoCorrect={false}
      clearButtonMode="while-editing"
    />
    {searchQuery.length > 0 && (
      <TouchableOpacity onPress={() => setSearchQuery('')}>
        <Icon name="close-circle" size={17} color={colors.textTertiary} />
      </TouchableOpacity>
    )}
  </View>
));

const AdminDashboardScreen = ({ navigation }) => {
  const { colors, isDark, shadows, toggleTheme } = useTheme();
  const styles = React.useMemo(() => createStyles(colors, isDark, shadows), [colors, isDark, shadows]);

  const [activeTab, setActiveTab] = useState('owners');
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const sidebarAnim = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;

  const [settlementRequests, setSettlementRequests] = useState([]);
  const [settlementWallets, setSettlementWallets] = useState([]);
  const [loadingSettlements, setLoadingSettlements] = useState(false);

  const openSidebar = () => {
    setSidebarOpen(true);
    Animated.parallel([
      Animated.spring(sidebarAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 10 }),
      Animated.timing(overlayAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();
  };

  const closeSidebar = () => {
    Animated.parallel([
      Animated.spring(sidebarAnim, { toValue: -SIDEBAR_WIDTH, useNativeDriver: true, tension: 80, friction: 10 }),
      Animated.timing(overlayAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => setSidebarOpen(false));
  };

  const handleTabSelect = (tab) => {
    if (tab === 'user_manager') {
      setActiveTab('users');
      closeSidebar();
      return;
    }
    setActiveTab(tab);
    setSearchQuery('');
    closeSidebar();
    if (tab === 'settlements_requests') {
      fetchSettlements();
    } else if (tab === 'settlements_turf' || tab === 'settlements_org') {
      if (settlementWallets.length === 0) {
        fetchSettlements();
      }
    }
  };
  const [selectedImageModal, setSelectedImageModal] = useState(null);
  const [owners, setOwners] = useState([]);
  const [users, setUsers] = useState([]);
  const [turfs, setTurfs] = useState([]);
  const [waitlist, setWaitlist] = useState([]);
  const [refunds, setRefunds] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [onlineBookings, setOnlineBookings] = useState([]);
  const [offlineBookings, setOfflineBookings] = useState([]);
  const [openTickets, setOpenTickets] = useState(0);
  const [pendingUgcReports, setPendingUgcReports] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [bookingPlatformFeePercent, setBookingPlatformFeePercent] = useState('5');
  const [auctionPlatformFeePercent, setAuctionPlatformFeePercent] = useState('10');
  const [cancellationRefundPercent, setCancellationRefundPercent] = useState('70');
  const [cancellationOwnerPercent, setCancellationOwnerPercent] = useState('20');
  const [cancellationPlatformPercent, setCancellationPlatformPercent] = useState('10');
  const [latestAndroidVersion, setLatestAndroidVersion] = useState('1.7');
  const [forceUpdateRequired, setForceUpdateRequired] = useState(false);
  
  const [verifyModalVisible, setVerifyModalVisible] = useState(false);
  const [selectedVerificationPayment, setSelectedVerificationPayment] = useState(null);
  const [processingRefundId, setProcessingRefundId] = useState(null);

  // Role Change Modal state
  const [roleModalUser, setRoleModalUser] = useState(null);
  const [selectedRole, setSelectedRole] = useState('player');
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);

  const openRoleChangeModal = (user) => {
    if (user?.role === 'admin') {
      showCustomAlert('Admin Account', 'Administrator accounts cannot have their role changed.');
      return;
    }
    setRoleModalUser(user);
    setSelectedRole(user?.role === 'owner' ? 'owner' : 'player');
  };

  const handleUpdateRole = async () => {
    if (!roleModalUser || !selectedRole) return;
    if (selectedRole === roleModalUser.role) {
      setRoleModalUser(null);
      return;
    }
    setIsUpdatingRole(true);
    try {
      await api.put(`/admin/users/${roleModalUser._id}/role`, { role: selectedRole });
      showCustomAlert(
        'Role Updated',
        `Role for "${roleModalUser.name || roleModalUser.email}" updated to ${selectedRole.toUpperCase()}.\n\nThe user's active session has been logged out.`
      );
      setRoleModalUser(null);
      fetchData();
    } catch (err) {
      showCustomAlert('Error', err.response?.data?.message || 'Failed to update user role');
    } finally {
      setIsUpdatingRole(false);
    }
  };

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
      const data = res.data?.data || res.data || {};
      if (data.bookingPlatformFeePercent !== undefined && data.bookingPlatformFeePercent !== null) {
        setBookingPlatformFeePercent(data.bookingPlatformFeePercent.toString());
      }
      if (data.auctionPlatformFeePercent !== undefined && data.auctionPlatformFeePercent !== null) {
        setAuctionPlatformFeePercent(data.auctionPlatformFeePercent.toString());
      }
      if (data.cancellationRefundPercent !== undefined && data.cancellationRefundPercent !== null) {
        setCancellationRefundPercent(data.cancellationRefundPercent.toString());
      }
      if (data.cancellationOwnerPercent !== undefined && data.cancellationOwnerPercent !== null) {
        setCancellationOwnerPercent(data.cancellationOwnerPercent.toString());
      }
      if (data.cancellationPlatformPercent !== undefined && data.cancellationPlatformPercent !== null) {
        setCancellationPlatformPercent(data.cancellationPlatformPercent.toString());
      }
      if (data.latestAndroidVersion !== undefined && data.latestAndroidVersion !== null) {
        setLatestAndroidVersion(data.latestAndroidVersion);
      }
      if (data.forceUpdateRequired !== undefined && data.forceUpdateRequired !== null) {
        setForceUpdateRequired(data.forceUpdateRequired);
      }
    } catch (err) {
      console.log('Failed to fetch admin settings', err);
    }
  };

  const saveSettings = async () => {
    try {
      const formData = new FormData();
      formData.append('bookingPlatformFeePercent', bookingPlatformFeePercent);
      formData.append('auctionPlatformFeePercent', auctionPlatformFeePercent);
      formData.append('cancellationRefundPercent', cancellationRefundPercent);
      formData.append('cancellationOwnerPercent', cancellationOwnerPercent);
      formData.append('cancellationPlatformPercent', cancellationPlatformPercent);
      formData.append('latestAndroidVersion', latestAndroidVersion);
      formData.append('latestIOSVersion', latestAndroidVersion);
      formData.append('forceUpdateRequired', forceUpdateRequired.toString());
      
      const ref = Number(cancellationRefundPercent);
      const own = Number(cancellationOwnerPercent);
      const plat = Number(cancellationPlatformPercent);
      if (ref + own + plat !== 100) {
        showCustomAlert('Error', 'Cancellation percentages must equal 100%');
        return;
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

  const handleToggleSuspendUser = (user) => {
    const isSuspended = user.isDeleted || user.isSuspended || user.isDeactivated || user.isActive === false;
    const action = isSuspended ? 'Reactivate' : 'Suspend';
    const endpoint = isSuspended
      ? `/admin/users/${user._id}/reactivate`
      : `/admin/users/${user._id}/suspend`;

    showCustomAlert(
      `${action} Account`,
      `Are you sure you want to ${action.toLowerCase()} the account of "${user.name || user.email}"?\n\nThe user's data and match history will remain intact.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: action,
          style: isSuspended ? 'default' : 'destructive',
          onPress: async () => {
            try {
              await api.put(endpoint);
              showCustomAlert('Done', `User "${user.name}" has been ${action.toLowerCase()}d.`);
              fetchData();
            } catch (err) {
              showCustomAlert('Error', err.response?.data?.message || `Failed to ${action.toLowerCase()} user`);
            }
          }
        }
      ]
    );
  };

  const handleSoftDeleteUser = async (userId, userName) => {
    try {
      await api.delete(`/admin/users/${userId}`);
      showCustomAlert('Soft Deleted', `User "${userName || 'User'}" has been soft-deleted and anonymized.`);
      fetchData();
    } catch (err) {
      showCustomAlert('Error', err.response?.data?.message || 'Failed to soft delete user');
    }
  };

  const handleHardDeleteUser = async (userId, userName) => {
    try {
      await api.delete(`/admin/users/${userId}/hard-delete`);
      showCustomAlert('Permanently Deleted', `User "${userName || 'User'}" and all associated data have been completely removed from the database.`);
      fetchData();
    } catch (err) {
      showCustomAlert('Error', err.response?.data?.message || 'Failed to hard delete user');
    }
  };

  const promptDeleteUser = (user) => {
    if (user?.role === 'admin') {
      showCustomAlert('Admin Account', 'Administrator accounts cannot be deleted.');
      return;
    }

    showCustomAlert(
      'Delete User Account',
      `Choose deletion type for "${user.name || user.email}":\n\n• Soft Delete: Deactivates account, anonymizes name to "Deleted User", and preserves match history.\n\n• Hard Delete: PERMANENTLY purges the user and all associated records completely from MongoDB.`,
      [
        {
          text: 'Soft Delete (Anonymize)',
          style: 'default',
          onPress: () => handleSoftDeleteUser(user._id, user.name)
        },
        {
          text: '🔥 Hard Delete (Remove from DB)',
          style: 'destructive',
          onPress: () => {
            showCustomAlert(
              '⚠️ CONFIRM HARD DELETE',
              `Are you 100% sure you want to PERMANENTLY REMOVE "${user.name || user.email}" from the database?\n\nThis CANNOT be undone. Zero data will remain.`,
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'PERMANENTLY DELETE FROM DB',
                  style: 'destructive',
                  onPress: () => handleHardDeleteUser(user._id, user.name)
                }
              ]
            );
          }
        },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
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
      const [ownersRes, usersRes, turfsRes, waitlistRes, refundsRes, settlementsRes, ticketsRes, ugcReportsRes, onlineBookingsRes, offlineBookingsRes] = await Promise.allSettled([
        api.get('/admin/owners?limit=100'),
        api.get('/admin/users?limit=100'),
        api.get('/admin/turfs?limit=100'),
        api.get('/contact/waitlist?limit=100'),
        api.get('/admin/refunds?limit=100'),
        api.get('/admin/settlements?limit=100'),
        api.get('/admin/support?status=open'),
        api.get('/admin/ugc-reports'),
        api.get('/admin/bookings/online?limit=100'),
        api.get('/admin/bookings/offline?limit=100')
      ]);

      if (ownersRes.status === 'fulfilled') setOwners(ownersRes.value.data.data || []);
      if (usersRes.status === 'fulfilled') setUsers(usersRes.value.data.data || []);
      if (turfsRes.status === 'fulfilled') setTurfs(turfsRes.value.data.data || []);
      
      if (waitlistRes && waitlistRes.status === 'fulfilled') {
        const wData = waitlistRes.value.data;
        setWaitlist(wData?.data || wData || []);
      } else if (waitlistRes?.status === 'rejected') {
        console.log('Failed to fetch waitlist', waitlistRes.reason);
      }
      if (refundsRes && refundsRes.status === 'fulfilled') {
        setRefunds(refundsRes.value.data.data || []);
      } else if (refundsRes?.status === 'rejected') {
        console.log('Failed to fetch refunds', refundsRes.reason);
      }
      if (settlementsRes && settlementsRes.status === 'fulfilled') {
        const allSettlements = settlementsRes.value.data.data || [];
        setSettlements(allSettlements);
        setSettlementRequests(allSettlements);
      } else if (settlementsRes?.status === 'rejected') {
        console.log('Failed to fetch settlements', settlementsRes.reason);
      }
      
      if (ticketsRes && ticketsRes.status === 'fulfilled') {
        setOpenTickets(ticketsRes.value.data?.data?.length || 0);
      }

      if (ugcReportsRes && ugcReportsRes.status === 'fulfilled') {
        const reps = ugcReportsRes.value.data?.data || [];
        setPendingUgcReports(reps.filter(r => r.status === 'pending').length);
      }

      if (onlineBookingsRes && onlineBookingsRes.status === 'fulfilled') {
        setOnlineBookings(onlineBookingsRes.value.data.data || []);
      }
      if (offlineBookingsRes && offlineBookingsRes.status === 'fulfilled') {
        setOfflineBookings(offlineBookingsRes.value.data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch admin data', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSettlements = async () => {
    setLoadingSettlements(true);
    try {
      const [reqRes, walletRes] = await Promise.all([
        api.get('/admin/settlements'),
        api.get('/admin/owner-wallets'),
      ]);
      setSettlementRequests(reqRes.data?.data || []);
      setSettlementWallets(walletRes.data?.data || []);
      // also update the badge count
      setSettlements(reqRes.data?.data || []);
    } catch (err) {
      console.log('Failed to fetch settlements', err);
    } finally {
      setLoadingSettlements(false);
    }
  };

  const renderOwnerCard = ({ item }) => {
    const joinedDate = formatISTDateSpelled(item.userId?.createdAt || item.createdAt);
    const ownerName = item.businessName || item.userId?.name || 'Unknown Owner';
    const initials = ownerName.charAt(0).toUpperCase();

    return (
      <View style={styles.card}>
        <View style={styles.cardGradBg}>
          <View style={styles.cardHeader}>
            <View style={styles.avatarWrap}>
              <View style={[styles.avatar, { backgroundColor: Colors.surfaceVariant }]}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
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
        </View>
        
        {item.turfs && item.turfs.length > 0 ? (
          <View style={styles.turfsList}>
            <View style={styles.turfsListHeader}>
              <Icon name="soccer-field" size={14} color={Colors.primary} />
              <Text style={styles.sectionHeader}>Registered Turfs</Text>
              <View style={styles.turfCountBadge}>
                <Text style={styles.turfCountBadgeText}>{item.turfs.length}</Text>
              </View>
            </View>
            <View style={styles.turfItemsWrap}>
              {item.turfs.map(turf => (
                <View key={turf._id} style={styles.turfItem}>
                  <View style={styles.turfItemIcon}>
                    <Icon name="stadium-variant" size={16} color={Colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.turfName} numberOfLines={1}>{turf.name}</Text>
                    {turf.location?.city || turf.city ? (
                      <Text style={styles.turfCity} numberOfLines={1}>
                        <Icon name="map-marker" size={11} color={Colors.textTertiary} /> {turf.location?.city || turf.city}
                      </Text>
                    ) : null}
                  </View>
                  {turf.status ? (
                    <View style={[styles.turfStatusChip, turf.status === 'active' || turf.isVerified ? styles.turfStatusActive : styles.turfStatusPending]}>
                      <Text style={[styles.turfStatusText, turf.status === 'active' || turf.isVerified ? { color: Colors.success } : { color: '#FF9800' }]}>
                        {turf.status?.toUpperCase() || (turf.isVerified ? 'VERIFIED' : 'PENDING')}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ))}
            </View>
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
    const isPlayer = item.role === 'player' || !!item.player;
    const isSuspended = item.isDeleted || item.isSuspended || item.isDeactivated || item.isActive === false;
    const photo = item.photo || item.player?.photo;

    const roleBg = isOwner
      ? Colors.primaryAlpha20
      : item.role === 'admin'
      ? 'rgba(255,71,87,0.15)'
      : isPlayer
      ? 'rgba(156,39,176,0.15)'
      : 'rgba(255,255,255,0.08)';

    const roleColor = isOwner
      ? Colors.primary
      : item.role === 'admin'
      ? '#FF4757'
      : isPlayer
      ? '#BA68C8'
      : Colors.textTertiary;

    return (
      <View style={[styles.card, isSuspended && { opacity: 0.75, borderColor: 'rgba(255,71,87,0.3)' }]}>
        <View style={styles.cardHeader}>
          {photo ? (
            <TouchableOpacity
              style={styles.avatarWrap}
              activeOpacity={0.8}
              onPress={() => setSelectedImageModal({
                url: getImageUrl(photo),
                name: item.name || 'User Profile',
                subtitle: item.email || (item.role ? item.role.toUpperCase() : '')
              })}
            >
              <Image source={{ uri: getImageUrl(photo) }} style={styles.userAvatarImage} />
              {/* <View style={styles.avatarZoomBadge}>
                <Icon name="magnify-plus" size={10} color="#FFF" />
              </View> */}
            </TouchableOpacity>
          ) : (
            <View style={styles.avatarWrap}>
              <View style={[styles.avatar, { backgroundColor: Colors.surfaceVariant }]}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
            </View>
          )}

          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.cardTitle} numberOfLines={1}>{item.name || 'Unknown User'}</Text>
              {isSuspended && (
                <View style={styles.suspendedTag}>
                  <Text style={styles.suspendedTagText}>SUSPENDED</Text>
                </View>
              )}
            </View>
            <Text style={styles.cardSubtitle} numberOfLines={1}>{item.email || item.mobile || '—'}</Text>
            {item.mobile && item.email ? (
              <Text style={styles.cardSubtitlePhone} numberOfLines={1}>{item.mobile}</Text>
            ) : null}
          </View>
          <View>
            <TouchableOpacity
              onPress={() => openRoleChangeModal(item)}
              activeOpacity={0.7}
              style={[styles.roleBadge, { backgroundColor: roleBg }]}
            >
              <Icon name={isOwner ? 'briefcase' : item.role === 'admin' ? 'shield-crown' : isPlayer ? 'cricket' : 'account'} size={11} color={roleColor} />
              <Text style={[styles.roleText, { color: roleColor }]}>
                {item.role?.toUpperCase() || 'USER'}
              </Text>
              <Icon name="pencil" size={10} color={roleColor} style={{ marginLeft: 2 }} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Linked Player Profile Box */}
       

        <View style={styles.cardFooter}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Icon name="calendar-outline" size={12} color={Colors.textTertiary} />
            <Text style={styles.joinedLabel}>Joined {joinedDate}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <TouchableOpacity
              onPress={() => openRoleChangeModal(item)}
              style={styles.roleActionBtn}
              activeOpacity={0.7}
            >
              <Icon name="account-convert-outline" size={13} color="#BA68C8" />
              <Text style={styles.roleActionText}>Role</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => handleToggleSuspendUser(item)}
              style={[styles.suspendBtn, isSuspended ? styles.reactivateBtn : null]}
              activeOpacity={0.7}
            >
              <Icon
                name={isSuspended ? 'account-check-outline' : 'account-off-outline'}
                size={13}
                color={isSuspended ? Colors.success : '#FF9800'}
              />
              <Text style={[styles.suspendUserText, isSuspended ? { color: Colors.success } : { color: '#FF9800' }]}>
                {isSuspended ? 'Reactivate' : 'Suspend'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => promptDeleteUser(item)}
              style={styles.deleteBtn}
              activeOpacity={0.7}
            >
              <Icon name="trash-can-outline" size={14} color={Colors.error} />
              <Text style={styles.deleteUserText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const renderTurfCard = ({ item }) => {
    const isActive   = item.status === 'active';
    const isSuspend  = item.status === 'suspended';
    const isPending  = item.status === 'pending';
    const statusColor = isActive ? Colors.primary : isSuspend ? Colors.error : '#FF9800';
    const statusBg    = isActive ? Colors.primaryAlpha20 : isSuspend ? 'rgba(244,67,54,0.15)' : 'rgba(255,152,0,0.15)';
    const statusIcon  = isActive ? 'check-circle' : isSuspend ? 'alert-circle' : 'clock-outline';
    const statusLabel = item.status.toUpperCase();

    const priceStr = item.pricing?.weekdayDay > 0 ? `₹${item.pricing.weekdayDay}/hr` : null;
    const ownerName = item.owner?.businessName || item.owner?.userId?.name || 'Owner';
    const amenities = item.amenities || {};
    const amenityList = [
      amenities.parking       && { icon: 'car-outline',    label: 'Parking' },
      amenities.floodLights   && { icon: 'lightning-bolt', label: 'Flood Lights' },
      amenities.washroom      && { icon: 'shower',         label: 'Washroom' },
      amenities.drinkingWater && { icon: 'water-outline',  label: 'Water' },
      amenities.changingRoom  && { icon: 'door-closed',    label: 'Change Room' },
      amenities.foodAvailable && { icon: 'food-outline',   label: 'Food' },
      amenities.seating       && { icon: 'seat',           label: 'Seating' },
      amenities.firstAid      && { icon: 'medical-bag',    label: 'First Aid' },
    ].filter(Boolean);

    return (
      <View style={styles.turfCard}>
        {/* ── Cover image or placeholder ── */}
        {item.coverImage ? (
          <View style={styles.turfCoverWrap}>
            <Image
              source={{ uri: item.coverImage }}
              style={styles.turfCoverImage}
              resizeMode="cover"
            />
            <View style={styles.turfCoverOverlay} />
            {/* Status badge pinned top-right on image */}
            <View style={[styles.turfStatusPin, { backgroundColor: statusBg, borderColor: statusColor }]}>
              <Icon name={statusIcon} size={10} color={statusColor} />
              <Text style={[styles.turfStatusPinText, { color: statusColor }]}>{statusLabel}</Text>
            </View>
            {/* Turf name + price over image */}
            <View style={styles.turfCoverInfo}>
              <Text style={styles.turfCoverName} numberOfLines={1}>{item.name}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
                <Icon name="map-marker-outline" size={11} color="rgba(255,255,255,0.75)" />
                <Text style={styles.turfCoverCity}>{item.city}, {item.state}</Text>
                {priceStr && (
                  <>
                    <View style={styles.turfCoverDot} />
                    <Text style={styles.turfCoverPrice}>{priceStr}</Text>
                  </>
                )}
              </View>
            </View>
          </View>
        ) : (
          <View style={[styles.turfCoverWrap, styles.turfImagePlaceholder]}>
            <Icon name="soccer-field" size={40} color={Colors.primary} style={{ opacity: 0.35 }} />
            <View style={[styles.turfStatusPin, { backgroundColor: statusBg, borderColor: statusColor }]}>
              <Icon name={statusIcon} size={10} color={statusColor} />
              <Text style={[styles.turfStatusPinText, { color: statusColor }]}>{statusLabel}</Text>
            </View>
            <View style={styles.turfCoverInfo}>
              <Text style={styles.turfCoverName} numberOfLines={1}>{item.name}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
                <Icon name="map-marker-outline" size={11} color="rgba(255,255,255,0.75)" />
                <Text style={styles.turfCoverCity}>{item.city}, {item.state}</Text>
                {priceStr && (
                  <>
                    <View style={styles.turfCoverDot} />
                    <Text style={styles.turfCoverPrice}>{priceStr}</Text>
                  </>
                )}
              </View>
            </View>
          </View>
        )}

        {/* ── Body ── */}
        <View style={styles.turfBody}>
          {/* Owner row */}
          <View style={styles.turfInfoRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Icon name="account-tie" size={13} color={Colors.textTertiary} />
              <Text style={styles.turfOwnerText}>{ownerName}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {item.type && (
                <View style={styles.turfTypeChip}>
                  <Icon name="home-outline" size={10} color={Colors.textSecondary} />
                  <Text style={styles.turfTypeText}>{item.type}</Text>
                </View>
              )}
              {item.size && (
                <View style={styles.turfTypeChip}>
                  <Icon name="resize" size={10} color={Colors.textSecondary} />
                  <Text style={styles.turfTypeText}>{item.size}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Stats row */}
          <View style={styles.turfStatsRow}>
            <View style={styles.turfStatItem}>
              <Text style={[styles.turfStatVal, { color: Colors.primary }]}>{item.onlineBookings ?? 0}</Text>
              <Text style={styles.turfStatLabel}>Online</Text>
            </View>
            <View style={styles.turfStatDivider} />
            <View style={styles.turfStatItem}>
              <Text style={[styles.turfStatVal, { color: '#5B8DEF' }]}>{item.offlineBookings ?? 0}</Text>
              <Text style={styles.turfStatLabel}>Offline</Text>
            </View>
            <View style={styles.turfStatDivider} />
            <View style={styles.turfStatItem}>
              <Text style={styles.turfStatVal}>{item.totalBookings ?? ((item.onlineBookings ?? 0) + (item.offlineBookings ?? 0))}</Text>
              <Text style={styles.turfStatLabel}>Total</Text>
            </View>
            <View style={styles.turfStatDivider} />
            <View style={styles.turfStatItem}>
              <Text style={styles.turfStatVal}>{item.rating?.toFixed(1) ?? '—'}</Text>
              <Text style={styles.turfStatLabel}>Rating</Text>
            </View>
            {item.pendingPlatformFee > 0 && (
              <>
                <View style={styles.turfStatDivider} />
                <View style={styles.turfStatItem}>
                  <Text style={[styles.turfStatVal, { color: Colors.error }]}>₹{item.pendingPlatformFee}</Text>
                  <Text style={styles.turfStatLabel}>Fee Due</Text>
                </View>
              </>
            )}
          </View>

          {/* Amenities */}
          {amenityList.length > 0 && (
            <View style={styles.turfAmenitiesRow}>
              {amenityList.map((a, i) => (
                <View key={i} style={styles.turfAmenityChip}>
                  <Icon name={a.icon} size={10} color={Colors.primary} />
                  <Text style={styles.turfAmenityText}>{a.label}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Deletion request banner */}
          {item.deletionRequested && (
            <View style={styles.turfDeletionBanner}>
              <Icon name="alert-decagram-outline" size={13} color={Colors.error} />
              <Text style={styles.turfDeletionText}>Deletion Requested by Owner</Text>
            </View>
          )}

          {/* Action buttons */}
          <View style={styles.turfActionsRow}>
            {item.deletionRequested && (
              <>
                <TouchableOpacity
                  style={[styles.turfActionBtn, styles.turfActionBtnGhost]}
                  onPress={() => showCustomAlert(
                    'Reject Deletion',
                    'Reject the deletion request for this turf?',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Reject', onPress: () => handleRejectDeletion(item._id) }
                    ]
                  )}
                >
                  <Icon name="cancel" size={13} color={Colors.textPrimary} />
                  <Text style={[styles.turfActionBtnText, { color: Colors.textPrimary }]}>Reject Del.</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.turfActionBtn, styles.turfActionBtnDanger]}
                  onPress={() => showCustomAlert(
                    'Approve Deletion',
                    'Permanently delete this turf, its slots, and bookings?',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Delete', style: 'destructive', onPress: () => handleDeleteTurf(item._id) }
                    ]
                  )}
                >
                  <Icon name="trash-can-outline" size={13} color={Colors.error} />
                  <Text style={[styles.turfActionBtnText, { color: Colors.error }]}>Approve Del.</Text>
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity
              style={[
                styles.turfActionBtn,
                isActive ? styles.turfActionBtnDanger : styles.turfActionBtnPrimary,
              ]}
              onPress={() => {
                const actionName = isActive ? 'Suspend' : 'Activate';
                showCustomAlert(
                  `Confirm ${actionName}`,
                  `Are you sure you want to ${actionName.toLowerCase()} this turf?`,
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: actionName, onPress: () => handleToggleStatus(item._id) }
                  ]
                );
              }}
            >
              <Icon
                name={isActive ? 'pause-circle-outline' : 'play-circle-outline'}
                size={13}
                color={isActive ? Colors.error : Colors.primary}
              />
              <Text style={[styles.turfActionBtnText, { color: isActive ? Colors.error : Colors.primary }]}>
                {isActive ? 'Suspend' : 'Activate'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  
  const handleProcessRefund = (item) => {
    showCustomAlert(
      'Confirm Refund',
      `Are you sure you want to process a refund of ₹${item.refundAmount} to ${item.user?.name || 'the user'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Process',
          onPress: async () => {
            setProcessingRefundId(item._id);
            try {
              await api.post(`/admin/refunds/${item._id}/process`);
              showCustomAlert('Success', 'Refund processed successfully');
              fetchData();
            } catch (err) {
              showCustomAlert('Error', err.response?.data?.message || 'Failed to process refund');
            } finally {
              setProcessingRefundId(null);
            }
          }
        }
      ]
    );
  };

  const renderRefundCard = ({ item }) => {
    const isPending = item.status === 'pending';
    const statusColor = isPending ? '#FF9800' : '#2ED573';
    const statusBg = isPending ? 'rgba(255,152,0,0.12)' : 'rgba(46,213,115,0.12)';
    const totalAmount = item.amount || 0;
    const refundAmt = item.refundAmount || 0;
    const ownerShare = item.ownerShare || 0;
    const platformFee = item.platformFee || 0;
    const userName = item.user?.name || item.user?.email || 'Customer';
    const turfName = item.booking?.turf?.name || 'N/A';
    const bookingRef = item.booking?.bookingRef || item._id?.slice(-8).toUpperCase();

    return (
      <View style={[styles.card, { overflow: 'hidden' }]}>
        {/* Top accent bar */}
        <View style={{ height: 3, backgroundColor: statusColor }} />

        {/* Header row */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, paddingBottom: 10 }}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 }}>
              <Icon name="receipt" size={13} color={Colors.textTertiary} />
              <Text style={{ fontSize: 11, color: Colors.textTertiary, fontFamily: 'Outfit-Medium', letterSpacing: 0.5 }}>BOOKING ID</Text>
            </View>
            <Text style={{ fontSize: 14, color: Colors.textPrimary, fontFamily: 'Outfit-Bold' }}>{bookingRef}</Text>
          </View>
          <View style={[{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, backgroundColor: statusBg, borderWidth: 1, borderColor: statusColor + '55' }]}>
            <Text style={{ fontSize: 10, fontFamily: 'Outfit-Bold', color: statusColor, letterSpacing: 0.8 }}>
              {item.status?.toUpperCase() || 'PENDING'}
            </Text>
          </View>
        </View>

        {/* User & Turf row */}
        <View style={{ flexDirection: 'row', paddingHorizontal: 14, gap: 16, marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.primaryAlpha20, justifyContent: 'center', alignItems: 'center' }}>
              <Icon name="account" size={13} color={Colors.primary} />
            </View>
            <Text style={{ fontSize: 12, color: Colors.textSecondary, fontFamily: 'Outfit-Medium' }}>{userName}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(46,213,115,0.12)', justifyContent: 'center', alignItems: 'center' }}>
              <Icon name="soccer-field" size={13} color="#2ED573" />
            </View>
            <Text style={{ fontSize: 12, color: Colors.textSecondary, fontFamily: 'Outfit-Medium' }}>{turfName}</Text>
          </View>
        </View>

        {/* Amount breakdown */}
        <View style={{ marginHorizontal: 14, marginBottom: 12, backgroundColor: Colors.surface, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: Colors.border }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
            <View style={{ alignItems: 'center', flex: 1 }}>
              <Text style={{ fontSize: 10, color: Colors.textTertiary, fontFamily: 'Outfit-Medium', marginBottom: 2 }}>TOTAL PAID</Text>
              <Text style={{ fontSize: 18, color: Colors.textPrimary, fontFamily: 'Outfit-ExtraBold' }}>₹{totalAmount}</Text>
            </View>
            <View style={{ width: 1, backgroundColor: Colors.border }} />
            <View style={{ alignItems: 'center', flex: 1 }}>
              <Text style={{ fontSize: 10, color: '#2ED573', fontFamily: 'Outfit-Medium', marginBottom: 2 }}>REFUND (70%)</Text>
              <Text style={{ fontSize: 18, color: '#2ED573', fontFamily: 'Outfit-ExtraBold' }}>₹{refundAmt}</Text>
            </View>
          </View>
          <View style={{ height: 1, backgroundColor: Colors.border, marginBottom: 10 }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 9, color: Colors.textTertiary, fontFamily: 'Outfit-Medium', marginBottom: 2 }}>OWNER SHARE</Text>
              <Text style={{ fontSize: 13, color: '#FF9800', fontFamily: 'Outfit-Bold' }}>₹{ownerShare}</Text>
              <Text style={{ fontSize: 9, color: Colors.textTertiary }}>20%</Text>
            </View>
            <View style={{ width: 1, backgroundColor: Colors.border }} />
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 9, color: Colors.textTertiary, fontFamily: 'Outfit-Medium', marginBottom: 2 }}>PLATFORM FEE</Text>
              <Text style={{ fontSize: 13, color: '#5B8DEF', fontFamily: 'Outfit-Bold' }}>₹{platformFee}</Text>
              <Text style={{ fontSize: 9, color: Colors.textTertiary }}>10%</Text>
            </View>
          </View>
        </View>

        {item.status === 'pending' && (
          <TouchableOpacity
            style={{ marginHorizontal: 14, marginBottom: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 12 }}
            onPress={() => handleProcessRefund(item)}
            activeOpacity={0.8}
          >
            <Icon name="bank-transfer" size={16} color={Colors.background} />
            <Text style={{ color: Colors.background, fontFamily: 'Outfit-Bold', fontSize: 14 }}>Process Refund ₹{refundAmt}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderWaitlistCard = ({ item }) => {
    const joinedDate = formatISTDateSpelled(item.createdAt);
    const initials = (item.name || item.email || '?').charAt(0).toUpperCase();
    
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.avatarWrap}>
            <View style={[styles.avatar, { backgroundColor: Colors.surfaceVariant }]}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{item.name || 'Unknown'}</Text>
            <Text style={styles.cardSubtitle} numberOfLines={1}>{item.email}</Text>
            {item.phone && <Text style={styles.cardSubtitle}>{item.phone}</Text>}
          </View>
          <View style={{ alignItems: 'flex-end' }}>
             <View style={[styles.roleBadge, { backgroundColor: 'rgba(255,152,0,0.15)' }]}>
                <Text style={[styles.roleText, { color: '#FF9800' }]}>{item.interestedIn?.toUpperCase() || 'WAITLIST'}</Text>
             </View>
          </View>
        </View>
        <View style={[styles.cardFooter, { paddingTop: 0 }]}>
           <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
             <Icon name="calendar-outline" size={12} color={Colors.textTertiary} />
             <Text style={styles.joinedLabel}>Joined {joinedDate}</Text>
           </View>
           {item.city && (
             <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
               <Icon name="map-marker-outline" size={12} color={Colors.textTertiary} />
               <Text style={styles.joinedLabel}>{item.city}</Text>
             </View>
           )}
        </View>
      </View>
    );
  };

  const getStatusColor = (status) => {
    if (status === 'pending') return { bg: 'rgba(255,152,0,0.15)', text: '#FF9800', icon: 'clock-outline' };
    if (status === 'processed') return { bg: 'rgba(46,213,115,0.15)', text: '#2ED573', icon: 'check-circle-outline' };
    return { bg: 'rgba(255,71,87,0.15)', text: '#FF4757', icon: 'close-circle-outline' };
  };

  const [selectedSettlement, setSelectedSettlement] = useState(null);
  const [settlementActionType, setSettlementActionType] = useState(null);
  const [settlementTxRef, setSettlementTxRef] = useState('');
  const [settlementRemarks, setSettlementRemarks] = useState('');
  const [submittingSettlement, setSubmittingSettlement] = useState(false);

  const handleSettlementAction = async () => {
    if (!settlementActionType || !selectedSettlement) return;
    if (settlementActionType === 'processed' && !settlementTxRef.trim()) {
      showCustomAlert('Error', 'Transaction reference is required.'); return;
    }
    setSubmittingSettlement(true);
    try {
      await api.put(`/admin/settlements/${selectedSettlement._id}/process`, {
        status: settlementActionType, transactionRef: settlementTxRef, remarks: settlementRemarks,
      });
      showCustomAlert('Success', `Withdrawal ${settlementActionType} successfully.`);
      setSelectedSettlement(null); setSettlementActionType(null);
      setSettlementTxRef(''); setSettlementRemarks('');
      fetchSettlements();
    } catch (err) {
      showCustomAlert('Error', err.response?.data?.message || 'Action failed.');
    } finally { setSubmittingSettlement(false); }
  };

  const renderSettlementRequest = ({ item }) => {
    const statusStyle = getStatusColor(item.status);
    const ownerName = item.owner?.businessName || item.owner?.userId?.name || item.user?.name || item.userName || 'Organizer / Owner';
    const ownerContact = item.owner?.userId?.email || item.user?.email || item.user?.mobile || item.owner?.userId?.phone || '';
    const initials = ownerName.charAt(0).toUpperCase();
    const bank = item.bankDetailsSnapshot || item.owner?.bankDetails || item.user?.bankDetails || {};
    const hasBank = !!(bank.accountNumber || bank.ifsc || bank.bankName || bank.accountHolder);

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.avatar, { backgroundColor: Colors.surfaceVariant, borderRadius: 23, width: 46, height: 46, justifyContent: 'center', alignItems: 'center', marginRight: 8 }]}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{ownerName}</Text>
            {ownerContact ? <Text style={styles.cardSubtitle} numberOfLines={1}>{ownerContact}</Text> : null}
          </View>
          <View style={[styles.roleBadge, { backgroundColor: statusStyle.bg }]}>
            <Icon name={statusStyle.icon} size={11} color={statusStyle.text} />
            <Text style={[styles.roleText, { color: statusStyle.text }]}>{item.status.toUpperCase()}</Text>
          </View>
        </View>
        <View style={{ height: 1, backgroundColor: Colors.border, marginHorizontal: 16 }} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 16 }}>
          <View>
            <Text style={{ color: Colors.textTertiary, fontSize: 11, fontFamily: 'Outfit-Medium' }}>Withdrawal Amount</Text>
            <Text style={{ color: Colors.primary, fontSize: 20, fontFamily: 'Outfit-ExtraBold' }}>₹{item.amount?.toLocaleString()}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ color: Colors.textTertiary, fontSize: 11, fontFamily: 'Outfit-Medium' }}>Requested On</Text>
            <Text style={{ color: Colors.textPrimary, fontSize: 13, fontFamily: 'Outfit-Bold' }}>{moment(item.createdAt).format('DD MMM YYYY')}</Text>
            <Text style={{ color: Colors.textTertiary, fontSize: 11 }}>{moment(item.createdAt).format('hh:mm A')}</Text>
          </View>
        </View>
        {item.turf?.name && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingBottom: 10 }}>
            <Icon name="soccer-field" size={12} color={Colors.textTertiary} />
            <Text style={{ color: Colors.textTertiary, fontSize: 12 }}>{item.turf.name}</Text>
          </View>
        )}

        {/* Bank Details Snapshot Box */}
        <View style={styles.settlementBankBox}>
          <View style={styles.settlementBankHeader}>
            <Icon name="bank" size={13} color={Colors.primary} />
            <Text style={styles.settlementBankTitle}>Bank Account Details</Text>
          </View>
          {hasBank ? (
            <View style={styles.settlementBankGrid}>
              {bank.accountHolder ? (
                <View style={styles.settlementBankRow}>
                  <Text style={styles.settlementBankLabel}>A/C Holder:</Text>
                  <Text style={styles.settlementBankValue} numberOfLines={1}>{bank.accountHolder}</Text>
                </View>
              ) : null}
              {bank.bankName ? (
                <View style={styles.settlementBankRow}>
                  <Text style={styles.settlementBankLabel}>Bank Name:</Text>
                  <Text style={styles.settlementBankValue} numberOfLines={1}>{bank.bankName}</Text>
                </View>
              ) : null}
              {bank.accountNumber ? (
                <View style={styles.settlementBankRow}>
                  <Text style={styles.settlementBankLabel}>A/C Number:</Text>
                  <Text style={[styles.settlementBankValue, { color: '#FFF', fontFamily: Typography.fontFamily.bold }]} numberOfLines={1}>{bank.accountNumber}</Text>
                </View>
              ) : null}
              {bank.ifsc ? (
                <View style={styles.settlementBankRow}>
                  <Text style={styles.settlementBankLabel}>IFSC Code:</Text>
                  <Text style={[styles.settlementBankValue, { color: Colors.primary, fontFamily: Typography.fontFamily.bold }]} numberOfLines={1}>{bank.ifsc}</Text>
                </View>
              ) : null}
            </View>
          ) : (
            <Text style={{ color: Colors.textTertiary, fontSize: 11, fontStyle: 'italic' }}>No bank account details provided</Text>
          )}
        </View>

        {item.status !== 'pending' && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, margin: 12, padding: 10, backgroundColor: statusStyle.bg, borderRadius: 10 }}>
            <Icon name={item.status === 'processed' ? 'receipt' : 'information-outline'} size={13} color={statusStyle.text} />
            <Text style={{ color: statusStyle.text, fontSize: 12 }}>
              {item.status === 'processed' ? `Ref: ${item.transactionRef}` : `Reason: ${item.remarks || 'No reason'}`}
            </Text>
          </View>
        )}
        {item.status === 'pending' && (
          <View style={{ flexDirection: 'row', gap: 10, padding: 12, paddingTop: 0 }}>
            <TouchableOpacity style={[styles.actionBtn, { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(255,71,87,0.1)', borderColor: '#FF4757' }]}
              onPress={() => { setSelectedSettlement(item); setSettlementActionType('rejected'); }}>
              <Icon name="close" size={14} color="#FF4757" />
              <Text style={[styles.actionBtnText, { color: '#FF4757' }]}>Reject</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, { flex: 1, justifyContent: 'center', backgroundColor: Colors.primaryAlpha20, borderColor: Colors.primary }]}
              onPress={() => { setSelectedSettlement(item); setSettlementActionType('processed'); }}>
              <Icon name="check" size={14} color={Colors.primary} />
              <Text style={[styles.actionBtnText, { color: Colors.primary }]}>Process</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderWalletCard = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.avatar, { backgroundColor: Colors.surfaceVariant, borderRadius: 23, width: 46, height: 46, justifyContent: 'center', alignItems: 'center', marginRight: 8 }]}>
          <Text style={styles.avatarText}>{(item.businessName || 'O').charAt(0).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{item.businessName || 'Business'}</Text>
          <Text style={styles.cardSubtitle}>{item.ownerName}{item.email ? ` · ${item.email}` : ''}</Text>
        </View>
      </View>
      <View style={{ height: 1, backgroundColor: Colors.border, marginHorizontal: 16 }} />
      <View style={{ flexDirection: 'row', padding: 14, gap: 8 }}>
        {[
          { label: 'Available', value: item.wallet?.balance || 0, color: Colors.primary, icon: 'wallet' },
          { label: 'Pending', value: item.wallet?.pendingWithdrawal || 0, color: '#FF9800', icon: 'clock-outline' },
          { label: 'Total Earned', value: item.wallet?.totalEarned || 0, color: '#2ED573', icon: 'trending-up' },
        ].map((stat, i) => (
          <View key={i} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
            <Icon name={stat.icon} size={16} color={stat.color} />
            <Text style={{ color: Colors.textTertiary, fontSize: 10, fontFamily: 'Outfit-Medium' }}>{stat.label}</Text>
            <Text style={{ color: stat.color, fontSize: 14, fontFamily: 'Outfit-ExtraBold' }}>₹{stat.value.toLocaleString()}</Text>
          </View>
        ))}
      </View>
    </View>
  );

  const renderOnlineBookingCard = ({ item }) => {
    const isConfirmed = item.status === 'confirmed' || item.status === 'completed';
    const isCancelled = item.status === 'cancelled';
    const statusColor = isConfirmed ? '#2ED573' : isCancelled ? Colors.error : '#FF9800';
    const statusBg = isConfirmed ? 'rgba(46,213,115,0.12)' : isCancelled ? 'rgba(255,71,87,0.12)' : 'rgba(255,152,0,0.12)';
    const userName = item.user?.name || item.user?.email || 'Customer';
    const userPhone = item.user?.mobile || 'No phone';
    const turfName = item.turf?.name || 'Turf';
    const turfCity = item.turf?.city ? `${item.turf.city}` : '';
    const bookingRef = item.bookingRef || item._id?.slice(-8).toUpperCase();
    const dateStr = item.createdAt ? moment(item.createdAt).format('DD MMM YYYY, hh:mm A') : '';
    const slotSnap = item.slotsSnapshot?.[0];
    const slotInfo = slotSnap ? `${slotSnap.startTime} - ${slotSnap.endTime} (${moment(slotSnap.date).format('DD MMM')})` : null;

    return (
      <View style={[styles.card, { overflow: 'hidden' }]}>
        <View style={{ height: 3, backgroundColor: statusColor }} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, paddingBottom: 10 }}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <Icon name="cloud-check" size={14} color={isDark ? '#FFD400' : colors.primaryDark} />
              <Text style={{ fontSize: 11, color: colors.textTertiary, fontFamily: Typography.fontFamily.semiBold, letterSpacing: 0.5 }}>ONLINE BOOKING</Text>
            </View>
            <Text style={{ fontSize: 14, color: colors.textPrimary, fontFamily: Typography.fontFamily.bold }}>{bookingRef}</Text>
          </View>
          <View style={[{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: statusBg, borderWidth: 1, borderColor: statusColor + '55' }]}>
            <Text style={{ fontSize: 10, fontFamily: Typography.fontFamily.bold, color: statusColor, letterSpacing: 0.8 }}>
              {item.status?.toUpperCase() || 'CONFIRMED'}
            </Text>
          </View>
        </View>

        {/* Turf & User details */}
        <View style={{ paddingHorizontal: 14, gap: 8, marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(46,213,115,0.12)', justifyContent: 'center', alignItems: 'center' }}>
              <Icon name="soccer-field" size={14} color="#2ED573" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, color: colors.textPrimary, fontFamily: Typography.fontFamily.bold }}>{turfName}</Text>
              {turfCity ? <Text style={{ fontSize: 11, color: colors.textTertiary }}>{turfCity}</Text> : null}
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: isDark ? 'rgba(255,212,0,0.15)' : 'rgba(212,160,0,0.15)', justifyContent: 'center', alignItems: 'center' }}>
              <Icon name="account" size={14} color={isDark ? '#FFD400' : colors.primaryDark} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, color: colors.textPrimary, fontFamily: Typography.fontFamily.medium }}>{userName}</Text>
              <Text style={{ fontSize: 11, color: colors.textTertiary }}>{userPhone} {item.user?.email ? `• ${item.user.email}` : ''}</Text>
            </View>
          </View>
        </View>

        {/* Bottom bar with slot & price */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, backgroundColor: colors.surfaceVariant, borderTopWidth: 1, borderTopColor: colors.border }}>
          <View style={{ flex: 1 }}>
            {slotInfo ? (
              <Text style={{ fontSize: 12, color: colors.textSecondary, fontFamily: Typography.fontFamily.medium }}>
                <Icon name="clock-outline" size={12} color={isDark ? '#FFD400' : colors.primaryDark} /> {slotInfo}
              </Text>
            ) : (
              <Text style={{ fontSize: 11, color: colors.textTertiary }}>{dateStr}</Text>
            )}
          </View>
          <Text style={{ fontSize: 16, color: isDark ? '#FFD400' : colors.primaryDark, fontFamily: Typography.fontFamily.bold }}>
            ₹{item.finalAmount || item.totalAmount || 0}
          </Text>
        </View>
      </View>
    );
  };

  const renderOfflineBookingCard = ({ item }) => {
    const isPaid = item.isPaid !== false;
    const statusColor = isPaid ? '#5B8DEF' : '#FF9800';
    const statusBg = isPaid ? 'rgba(91,141,239,0.12)' : 'rgba(255,152,0,0.12)';
    const turfName = item.turf?.name || 'Turf';
    const ownerName = item.owner?.businessName || item.owner?.userId?.name || 'Turf Owner';
    const customerName = item.customerName || 'Walk-in Customer';
    const customerMobile = item.customerMobile || 'No phone';
    const dateStr = item.date ? moment(item.date).format('DD MMM YYYY') : '';
    const timeStr = `${item.startTime || ''} - ${item.endTime || ''}`;
    const reasonLabel = (item.reason || 'walk_in').replace(/_/g, ' ').toUpperCase();

    return (
      <View style={[styles.card, { overflow: 'hidden' }]}>
        <View style={{ height: 3, backgroundColor: statusColor }} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, paddingBottom: 10 }}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <Icon name="calendar-clock" size={14} color="#5B8DEF" />
              <Text style={{ fontSize: 11, color: colors.textTertiary, fontFamily: Typography.fontFamily.semiBold, letterSpacing: 0.5 }}>OFFLINE BOOKING</Text>
            </View>
            <Text style={{ fontSize: 13, color: '#5B8DEF', fontFamily: Typography.fontFamily.bold }}>{reasonLabel}</Text>
          </View>
          <View style={[{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: statusBg, borderWidth: 1, borderColor: statusColor + '55' }]}>
            <Text style={{ fontSize: 10, fontFamily: Typography.fontFamily.bold, color: statusColor, letterSpacing: 0.8 }}>
              {isPaid ? 'PAID' : 'UNPAID'}
            </Text>
          </View>
        </View>

        {/* Turf & Owner details */}
        <View style={{ paddingHorizontal: 14, gap: 8, marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(46,213,115,0.12)', justifyContent: 'center', alignItems: 'center' }}>
              <Icon name="soccer-field" size={14} color="#2ED573" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, color: colors.textPrimary, fontFamily: Typography.fontFamily.bold }}>{turfName}</Text>
              <Text style={{ fontSize: 11, color: colors.textTertiary }}>Owner: {ownerName}</Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(91,141,239,0.12)', justifyContent: 'center', alignItems: 'center' }}>
              <Icon name="account-outline" size={14} color="#5B8DEF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, color: colors.textPrimary, fontFamily: Typography.fontFamily.medium }}>{customerName}</Text>
              <Text style={{ fontSize: 11, color: colors.textTertiary }}>{customerMobile}</Text>
            </View>
          </View>
        </View>

        {/* Bottom bar with date/time & price */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, backgroundColor: colors.surfaceVariant, borderTopWidth: 1, borderTopColor: colors.border }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12, color: colors.textSecondary, fontFamily: Typography.fontFamily.medium }}>
              <Icon name="clock-outline" size={12} color="#5B8DEF" /> {dateStr} • {timeStr}
            </Text>
          </View>
          <Text style={{ fontSize: 16, color: '#5B8DEF', fontFamily: Typography.fontFamily.bold }}>
            ₹{item.amount || 0}
          </Text>
        </View>
      </View>
    );
  };

  const handleLogout = () => {
    showCustomAlert("Confirm Logout", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Logout", style: "destructive", onPress: async () => {
        setIsLoggingOut(true);
        await dispatch(logout());
        setIsLoggingOut(false);
      }}
    ]);
  };

  const pendingRefunds = refunds.filter(r => r.status === 'pending').length;
  const pendingSettlements = settlements.filter(s => s.status === 'pending').length;
  const totalAlerts = pendingRefunds + pendingSettlements + openTickets;

  // Search filter helpers
  const q = searchQuery.toLowerCase().trim();
  const filteredOwners = owners.filter(o => !q ||
    (o.businessName || '').toLowerCase().includes(q) ||
    (o.userId?.name || '').toLowerCase().includes(q) ||
    (o.userId?.email || '').toLowerCase().includes(q)
  );
  const filteredUsers = users.filter(u => !q ||
    (u.name || '').toLowerCase().includes(q) ||
    (u.email || '').toLowerCase().includes(q)
  );
  const filteredTurfs = turfs.filter(t => !q ||
    (t.name || '').toLowerCase().includes(q) ||
    (t.city || '').toLowerCase().includes(q) ||
    (t.owner?.businessName || '').toLowerCase().includes(q)
  );
  const filteredOnlineBookings = onlineBookings.filter(b => !q ||
    (b.bookingRef || '').toLowerCase().includes(q) ||
    (b.user?.name || '').toLowerCase().includes(q) ||
    (b.user?.email || '').toLowerCase().includes(q) ||
    (b.user?.mobile || '').toLowerCase().includes(q) ||
    (b.turf?.name || '').toLowerCase().includes(q) ||
    (b.turf?.city || '').toLowerCase().includes(q) ||
    (b.status || '').toLowerCase().includes(q)
  );
  const filteredOfflineBookings = offlineBookings.filter(b => !q ||
    (b.customerName || '').toLowerCase().includes(q) ||
    (b.customerMobile || '').toLowerCase().includes(q) ||
    (b.turf?.name || '').toLowerCase().includes(q) ||
    (b.reason || '').toLowerCase().includes(q) ||
    (b.owner?.businessName || '').toLowerCase().includes(q)
  );
  const filteredRefunds = refunds.filter(r => !q ||
    (r.user?.name || '').toLowerCase().includes(q) ||
    (r.user?.email || '').toLowerCase().includes(q) ||
    (r.booking?.bookingRef || '').toLowerCase().includes(q) ||
    (r.booking?.turf?.name || '').toLowerCase().includes(q)
  );
  const filteredWaitlist = waitlist.filter(w => !q ||
    (w.name || '').toLowerCase().includes(q) ||
    (w.email || '').toLowerCase().includes(q)
  );
  const filteredSettlementReqs = settlementRequests.filter(s => !q ||
    (s.owner?.businessName || '').toLowerCase().includes(q) ||
    (s.owner?.userId?.name || '').toLowerCase().includes(q) ||
    (s.owner?.userId?.email || '').toLowerCase().includes(q)
  );
  const filteredTurfWallets = settlementWallets.filter(w => w.businessName !== 'Tournament Organizer' && (!q ||
    (w.businessName || '').toLowerCase().includes(q) ||
    (w.ownerName || '').toLowerCase().includes(q) ||
    (w.email || '').toLowerCase().includes(q)
  ));
  const filteredOrgWallets = settlementWallets.filter(w => w.businessName === 'Tournament Organizer' && (!q ||
    (w.ownerName || '').toLowerCase().includes(q) ||
    (w.email || '').toLowerCase().includes(q)
  ));

  const SidebarItem = ({ tab, icon, label, badge }) => {
    const isActive = activeTab === tab;
    return (
      <TouchableOpacity
        style={[styles.sidebarItem, isActive && styles.sidebarItemActive]}
        onPress={() => handleTabSelect(tab)}
        activeOpacity={0.7}
      >
        {/* Active indicator bar */}
        <View style={[styles.sidebarActiveBar, isActive && styles.sidebarActiveBarVisible]} />

        {/* Icon */}
        <View style={[styles.sidebarIconWrap, isActive && styles.sidebarIconWrapActive]}>
          <Icon name={icon} size={18} color={isActive ? Colors.primary : Colors.textTertiary} />
        </View>

        {/* Label */}
        <Text
          style={[styles.sidebarText, isActive && styles.sidebarTextActive]}
          numberOfLines={1}
        >
          {label}
        </Text>

        {/* Badge */}
        {badge > 0 && (
          <View style={styles.sidebarBadge}>
            <Text style={styles.sidebarBadgeText}>{badge > 99 ? '99+' : badge}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* ── Premium Header ──────────────────────────────── */}
      <View style={styles.header}>
        {/* Top row: title + actions */}
        <View style={styles.headerTop}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
            <TouchableOpacity
              onPress={openSidebar}
              style={styles.hamburgerBtn}
              activeOpacity={0.75}
            >
              <Icon name="menu" size={22} color={colors.textPrimary} />
              {totalAlerts > 0 && (
                <View style={styles.hamburgerBadge}>
                  <Text style={styles.hamburgerBadgeText}>{totalAlerts}</Text>
                </View>
              )}
            </TouchableOpacity>
            <View style={styles.headerTitleBlock}>
              <View style={styles.adminBadge}>
                <Icon name="shield-crown" size={12} color={isDark ? '#FFD400' : colors.primaryDark} />
                <Text style={styles.adminBadgeText}>ADMIN</Text>
              </View>
              <Text style={styles.headerTitle} numberOfLines={1}>Dashboard</Text>
            </View>
          </View>

          <View style={styles.headerActions}>
            <NotificationBell onPress={() => navigation.navigate('Notifications')} size={20} />
            <TouchableOpacity
              onPress={toggleTheme}
              style={[styles.headerActionBtn, { backgroundColor: isDark ? 'rgba(255,212,0,0.12)' : 'rgba(91,141,239,0.12)', borderColor: isDark ? 'rgba(255,212,0,0.25)' : 'rgba(91,141,239,0.25)' }]}
              activeOpacity={0.8}
            >
              <Icon name={isDark ? "weather-sunny" : "weather-night"} size={18} color={isDark ? "#FFD400" : "#5B8DEF"} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { fetchSettings(); setShowSettings(true); }}
              style={[styles.headerActionBtn, { backgroundColor: 'rgba(255,212,0,0.12)', borderColor: 'rgba(255,212,0,0.25)' }]}
              activeOpacity={0.8}
            >
              <Icon name="cog" size={18} color="#FFD400" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleLogout}
              style={[styles.headerActionBtn, { backgroundColor: 'rgba(255,71,87,0.12)', borderColor: 'rgba(255,71,87,0.25)' }]}
              activeOpacity={0.8}
              disabled={isLoggingOut}
            >
              {isLoggingOut ? (
                <ActivityIndicator size="small" color="#FF4757" />
              ) : (
                <Icon name="logout" size={18} color="#FF4757" />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Divider */}
        <View style={styles.headerDivider} />

        {/* Stats Row */}
        <View style={styles.statsContainer}>
          <TouchableOpacity style={styles.statBox} onPress={() => { setActiveTab('users'); setSearchQuery(''); }} activeOpacity={0.8}>
            <View style={[styles.statGrad, { backgroundColor: colors.surface }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Icon name="account-group" size={20} color={isDark ? '#FFD400' : colors.primaryDark} />
              </View>
              <Text style={styles.statValue}>{owners.length + users.length}</Text>
              <Text style={styles.statLabel}>Total Users</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.statBox} onPress={() => { setActiveTab('owners'); setSearchQuery(''); }} activeOpacity={0.8}>
            <View style={[styles.statGrad, { backgroundColor: colors.surface }]}>
              <Icon name="briefcase-account" size={20} color="#5B8DEF" />
              <Text style={[styles.statValue, { color: '#5B8DEF' }]}>{owners.length}</Text>
              <Text style={styles.statLabel}>Owners</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.statBox} onPress={() => { setActiveTab('turfs'); setSearchQuery(''); }} activeOpacity={0.8}>
            <View style={[styles.statGrad, { backgroundColor: colors.surface }]}>
              <Icon name="soccer-field" size={20} color="#2ED573" />
              <Text style={[styles.statValue, { color: '#2ED573' }]}>{turfs.length}</Text>
              <Text style={styles.statLabel}>Turfs</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>
      
      <AppUpdateBanner />

      {/* Settlement Action Modal */}
      <Modal visible={!!selectedSettlement} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <KeyboardAwareScrollView keyboardShouldPersistTaps="handled" bounces={false}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md }}>
                <Text style={[styles.modalTitle, { marginBottom: 0 }]}>{settlementActionType === 'processed' ? 'Process Withdrawal' : 'Reject Withdrawal'}</Text>
                <TouchableOpacity onPress={() => setSelectedSettlement(null)} style={{ padding: 4 }}>
                  <Icon name="close" size={22} color={Colors.textPrimary}/>
                </TouchableOpacity>
              </View>
              {selectedSettlement && (
                <>
                  <View style={{ backgroundColor: Colors.surface, borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: Colors.border }}>
                    <Text style={{ color: Colors.textSecondary, fontSize: 12 }}>Requester: <Text style={{ color: Colors.textPrimary, fontFamily: 'Outfit-Bold' }}>{selectedSettlement.owner?.businessName || selectedSettlement.owner?.userId?.name || selectedSettlement.user?.name || 'Organizer / Owner'}</Text></Text>
                    <Text style={{ color: Colors.textSecondary, fontSize: 12, marginTop: 4 }}>Amount: <Text style={{ color: Colors.primary, fontFamily: 'Outfit-Bold' }}>₹{selectedSettlement.amount?.toLocaleString()}</Text></Text>
                  </View>

                  {(() => {
                    const bank = selectedSettlement.bankDetailsSnapshot || selectedSettlement.owner?.bankDetails || selectedSettlement.user?.bankDetails;
                    const upi = selectedSettlement.upiId || bank?.upiId;
                    const holder = bank?.accountHolder || bank?.accountName || selectedSettlement.owner?.userId?.name || selectedSettlement.user?.name;
                    const bankName = bank?.bankName;
                    const accNo = bank?.accountNumber;
                    const ifsc = bank?.ifsc;

                    if (!bank && !upi) {
                      return (
                        <View style={{ backgroundColor: 'rgba(255,152,0,0.1)', padding: 10, borderRadius: 10, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,152,0,0.25)' }}>
                          <Text style={{ fontSize: 12, color: '#FF9800', fontFamily: Typography.fontFamily.medium }}>⚠️ No bank details found on file</Text>
                        </View>
                      );
                    }

                    return (
                      <View style={{ backgroundColor: Colors.surface, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, marginBottom: 12 }}>
                        <Text style={{ fontSize: 10, fontFamily: Typography.fontFamily.bold, color: Colors.textTertiary, marginBottom: 6, letterSpacing: 0.5 }}>TRANSFER FUNDS TO:</Text>
                        {holder ? <Text style={{ fontSize: 12, color: Colors.textSecondary, marginBottom: 2 }}>A/C Name: <Text style={{ color: Colors.textPrimary, fontFamily: Typography.fontFamily.bold }}>{holder}</Text></Text> : null}
                        {bankName ? <Text style={{ fontSize: 12, color: Colors.textSecondary, marginBottom: 2 }}>Bank: <Text style={{ color: Colors.textPrimary, fontFamily: Typography.fontFamily.bold }}>{bankName}</Text></Text> : null}
                        {accNo ? <Text style={{ fontSize: 12, color: Colors.textSecondary, marginBottom: 2 }}>A/C No: <Text style={{ color: Colors.textPrimary, fontFamily: Typography.fontFamily.bold }}>{accNo}</Text></Text> : null}
                        {ifsc ? <Text style={{ fontSize: 12, color: Colors.textSecondary, marginBottom: 2 }}>IFSC: <Text style={{ color: Colors.textPrimary, fontFamily: Typography.fontFamily.bold }}>{ifsc}</Text></Text> : null}
                        {upi ? <Text style={{ fontSize: 12, color: Colors.textSecondary, marginBottom: 2 }}>UPI ID: <Text style={{ color: Colors.primary, fontFamily: Typography.fontFamily.bold }}>{upi}</Text></Text> : null}
                      </View>
                    );
                  })()}
                </>
              )}
              {settlementActionType === 'processed' && (
                <>
                  <Text style={styles.inputLabel}>Transaction Reference *</Text>
                  <TextInput style={[styles.input, { marginBottom: Spacing.md }]} value={settlementTxRef} onChangeText={setSettlementTxRef}
                    placeholder="e.g. UTR123456" placeholderTextColor={Colors.textTertiary} />
                </>
              )}
              <Text style={styles.inputLabel}>Remarks (optional)</Text>
              <TextInput style={[styles.input, { marginBottom: Spacing.lg }]} value={settlementRemarks} onChangeText={setSettlementRemarks}
                placeholder="Any notes..." placeholderTextColor={Colors.textTertiary} />
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity style={[styles.modalBtn, { backgroundColor: Colors.surfaceVariant }]} onPress={() => setSelectedSettlement(null)}>
                  <Text style={[styles.modalBtnText, { color: Colors.textPrimary }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalBtn, { backgroundColor: settlementActionType === 'processed' ? Colors.primary : '#FF4757' }]}
                  onPress={handleSettlementAction} disabled={submittingSettlement}>
                  <Text style={[styles.modalBtnText, { color: settlementActionType === 'processed' ? Colors.background : '#fff' }]} numberOfLines={1}>{submittingSettlement ? 'Processing...' : (settlementActionType === 'processed' ? 'Confirm Transfer' : 'Reject')}</Text>
                </TouchableOpacity>
              </View>
            </KeyboardAwareScrollView>
          </View>
        </View>
      </Modal>

      {/* Settings Modal */}
      <Modal visible={showSettings} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg }}>
              <Text style={styles.modalTitle}>Platform Settings</Text>
              <TouchableOpacity onPress={() => setShowSettings(false)}><Icon name="close" size={24} color={Colors.textPrimary}/></TouchableOpacity>
            </View>

            <Text style={[styles.inputLabel, { marginTop: Spacing.md }]}>Booking Platform Fee %</Text>
            <TextInput
              style={styles.input}
              value={bookingPlatformFeePercent}
              onChangeText={setBookingPlatformFeePercent}
              placeholder="e.g. 5"
              keyboardType="numeric"
              placeholderTextColor={Colors.textTertiary}
            />

            <Text style={[styles.inputLabel, { marginTop: Spacing.md }]}>Auction Platform Fee %</Text>
            <TextInput
              style={styles.input}
              value={auctionPlatformFeePercent}
              onChangeText={setAuctionPlatformFeePercent}
              placeholder="e.g. 10"
              keyboardType="numeric"
              placeholderTextColor={Colors.textTertiary}
            />

            <Text style={[styles.inputLabel, { marginTop: Spacing.lg, color: Colors.primary, fontSize: 16 }]}>Cancellation Breakdown (must equal 100%)</Text>
            
            <View style={{ flexDirection: 'row', gap: 10, marginTop: Spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Refund %</Text>
                <TextInput
                  style={styles.input}
                  value={cancellationRefundPercent}
                  onChangeText={setCancellationRefundPercent}
                  placeholder="70"
                  keyboardType="numeric"
                  placeholderTextColor={Colors.textTertiary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Owner %</Text>
                <TextInput
                  style={styles.input}
                  value={cancellationOwnerPercent}
                  onChangeText={setCancellationOwnerPercent}
                  placeholder="20"
                  keyboardType="numeric"
                  placeholderTextColor={Colors.textTertiary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Platform %</Text>
                <TextInput
                  style={styles.input}
                  value={cancellationPlatformPercent}
                  onChangeText={setCancellationPlatformPercent}
                  placeholder="10"
                  keyboardType="numeric"
                  placeholderTextColor={Colors.textTertiary}
                />
              </View>
            </View>

            <View style={{ marginTop: Spacing.md }}>
              <Text style={styles.inputLabel}>Required App Version (Android & iOS)</Text>
              <TextInput
                style={styles.input}
                value={latestAndroidVersion}
                onChangeText={setLatestAndroidVersion}
                placeholder="e.g. 1.8"
                placeholderTextColor={Colors.textTertiary}
              />
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.md }}>
              <Text style={styles.inputLabel}>Force Update?</Text>
              <Switch
                value={forceUpdateRequired}
                onValueChange={setForceUpdateRequired}
                trackColor={{ false: Colors.surfaceLight, true: Colors.primary }}
                thumbColor={Colors.textPrimary}
              />
            </View>

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: Colors.surfaceVariant }]} onPress={() => setShowSettings(false)}>
                <Text style={[styles.modalBtnText, { color: Colors.textPrimary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: Colors.primary }]} onPress={saveSettings}>
                <Text style={[styles.modalBtnText, { color: Colors.background }]}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
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

      {/* Main Content */}
      <View style={styles.contentArea}>
        {['owners', 'turfs', 'users', 'online_bookings', 'offline_bookings', 'refunds', 'waitlist', 'settlements_requests', 'settlements_turf', 'settlements_org'].includes(activeTab) && (
          <AdminSearchBar searchQuery={searchQuery} setSearchQuery={setSearchQuery} colors={colors} styles={styles} />
        )}
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : activeTab === 'owners' ? (
          <FlatList data={filteredOwners} keyExtractor={item => item._id} renderItem={renderOwnerCard}
            contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<Text style={styles.emptyText}>{q ? 'No results found.' : 'No owners found.'}</Text>} />
        ) : activeTab === 'turfs' ? (
          <FlatList data={filteredTurfs} keyExtractor={item => item._id} renderItem={renderTurfCard}
            contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<Text style={styles.emptyText}>{q ? 'No results found.' : 'No turfs found.'}</Text>} />
        ) : activeTab === 'users' ? (
          <FlatList data={filteredUsers} keyExtractor={item => item._id} renderItem={renderUserCard}
            contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<Text style={styles.emptyText}>{q ? 'No results found.' : 'No users found.'}</Text>} />
        ) : activeTab === 'online_bookings' ? (
          <FlatList data={filteredOnlineBookings} keyExtractor={item => item._id} renderItem={renderOnlineBookingCard}
            contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<Text style={styles.emptyText}>{q ? 'No results found.' : 'No online bookings found.'}</Text>} />
        ) : activeTab === 'offline_bookings' ? (
          <FlatList data={filteredOfflineBookings} keyExtractor={item => item._id} renderItem={renderOfflineBookingCard}
            contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<Text style={styles.emptyText}>{q ? 'No results found.' : 'No offline bookings found.'}</Text>} />
        ) : activeTab === 'refunds' ? (
          <FlatList data={filteredRefunds} keyExtractor={item => item._id} renderItem={renderRefundCard}
            contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<Text style={styles.emptyText}>{q ? 'No results found.' : 'No refunds found.'}</Text>} />
        ) : activeTab === 'waitlist' ? (
          <FlatList data={filteredWaitlist} keyExtractor={item => item._id} renderItem={renderWaitlistCard}
            contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<Text style={styles.emptyText}>{q ? 'No results found.' : 'No waitlist entries found.'}</Text>} />
        ) : activeTab === 'settlements_requests' ? (
          loadingSettlements ? (
            <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>
          ) : (
            <FlatList
              data={filteredSettlementReqs}
              keyExtractor={item => item._id}
              renderItem={renderSettlementRequest}
              contentContainerStyle={styles.list}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={<Text style={styles.emptyText}>{q ? 'No results found.' : 'No withdrawal requests found.'}</Text>}
            />
          )
        ) : activeTab === 'settlements_turf' ? (
          loadingSettlements ? (
            <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>
          ) : (
            <FlatList
              data={filteredTurfWallets}
              keyExtractor={item => item._id}
              renderItem={renderWalletCard}
              contentContainerStyle={styles.list}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={<Text style={styles.emptyText}>{q ? 'No results found.' : 'No turf owner wallets found.'}</Text>}
            />
          )
        ) : activeTab === 'settlements_org' ? (
          loadingSettlements ? (
            <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>
          ) : (
            <FlatList
              data={filteredOrgWallets}
              keyExtractor={item => item._id}
              renderItem={renderWalletCard}
              contentContainerStyle={styles.list}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={<Text style={styles.emptyText}>{q ? 'No results found.' : 'No organizer wallets found.'}</Text>}
            />
          )
        ) : activeTab === 'finance' ? (
          <FinanceView navigation={navigation} />
        ) : activeTab === 'support' ? (
          <SupportAdminView navigation={navigation} onStatusChanged={fetchData} />
        ) : activeTab === 'ugc_reports' ? (
          <UgcReportsAdminView />
        ) : null}
      </View>

      {/* Slide-in Sidebar Overlay */}
      {sidebarOpen && (
        <Animated.View style={[styles.sidebarOverlay, { opacity: overlayAnim }]} pointerEvents="auto">
          <TouchableOpacity style={{ flex: 1 }} onPress={closeSidebar} activeOpacity={1} />
        </Animated.View>
      )}

      {/* Slide-in Sidebar Drawer */}
      <Animated.View style={[styles.sidebar, { transform: [{ translateX: sidebarAnim }] }]}>

        {/* Admin identity block */}
        <View style={styles.sidebarIdentity}>
          <View style={styles.sidebarAvatarRing}>
            <Icon name="shield-crown" size={22} color={Colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.sidebarIdentityTitle}>ScoreVerse</Text>
            <Text style={styles.sidebarIdentityRole}>Admin Panel</Text>
          </View>
          <TouchableOpacity onPress={closeSidebar} style={styles.sidebarCloseBtn}>
            <Icon name="close" size={16} color={Colors.textTertiary} />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

          {/* ── MANAGEMENT ── */}
          <Text style={styles.sidebarSectionLabel}>MANAGEMENT</Text>
          <SidebarItem tab="turfs" icon="soccer-field" label="Turfs"
            badge={turfs.filter(t => (t.pendingPlatformFee > 0 && t.pendingPaymentId) || t.deletionRequested).length} />
          <SidebarItem tab="owners" icon="briefcase-account" label="Owners" badge={0} />
          <SidebarItem tab="users" icon="account-group" label="Users" badge={0} />
          <SidebarItem tab="waitlist" icon="clipboard-list-outline" label="Waitlist" badge={0} />

          {/* ── BOOKINGS ── */}
          <View style={styles.sidebarDivider} />
          <Text style={styles.sidebarSectionLabel}>BOOKINGS</Text>
          <SidebarItem tab="online_bookings" icon="calendar-check" label="Online Bookings" badge={0} />
          <SidebarItem tab="offline_bookings" icon="calendar-clock" label="Offline Bookings" badge={0} />

          {/* ── REFUNDS ── */}
          <View style={styles.sidebarDivider} />
          <Text style={styles.sidebarSectionLabel}>REFUNDS</Text>
          <SidebarItem tab="refunds" icon="cash-refund" label="Pending Refunds" badge={pendingRefunds} />

          {/* ── SUPPORT ── */}
          <View style={styles.sidebarDivider} />
          <Text style={styles.sidebarSectionLabel}>SUPPORT</Text>
          <SidebarItem tab="support" icon="ticket-account" label="Support Tickets" badge={openTickets} />
          <SidebarItem tab="ugc_reports" icon="shield-alert-outline" label="UGC Reports" badge={pendingUgcReports} />

          {/* ── FINANCE ── */}
          <View style={styles.sidebarDivider} />
          <Text style={styles.sidebarSectionLabel}>FINANCE</Text>
          <SidebarItem tab="finance" icon="finance" label="Finance Dashboard" badge={0} />

          {/* ── SETTLEMENTS ── */}
          <View style={styles.sidebarDivider} />
          <Text style={styles.sidebarSectionLabel}>SETTLEMENTS</Text>
          <SidebarItem tab="settlements_requests" icon="bank-transfer-out" label="Withdraw Requests" badge={pendingSettlements} />
          <SidebarItem tab="settlements_turf" icon="stadium-variant" label="Turf Wallets" badge={0} />
          <SidebarItem tab="settlements_org" icon="account-tie-hat" label="Organizers" badge={0} />

          {/* ── PREFERENCES ── */}
          <View style={styles.sidebarDivider} />
          <Text style={styles.sidebarSectionLabel}>PREFERENCES</Text>
          <TouchableOpacity
            style={styles.sidebarItem}
            onPress={toggleTheme}
            activeOpacity={0.7}
          >
            <View style={styles.sidebarActiveBar} />
            <View style={styles.sidebarIconWrap}>
              <Icon name={isDark ? "weather-sunny" : "weather-night"} size={18} color={isDark ? "#FFD400" : "#5B8DEF"} />
            </View>
            <Text style={[styles.sidebarText, { color: isDark ? '#FFD400' : colors.primaryDark, fontFamily: Typography.fontFamily.bold }]} numberOfLines={1}>
              {isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            </Text>
          </TouchableOpacity>

        </ScrollView>
      </Animated.View>
      {/* Processing overlay */}
      {!!processingRefundId && (
        <View style={styles.overlayLoader}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.overlayText}>Processing transaction...</Text>
        </View>
      )}

      {/* ── ROLE CHANGE MODAL ── */}
      <Modal visible={!!roleModalUser} transparent animationType="fade" onRequestClose={() => !isUpdatingRole && setRoleModalUser(null)}>
        <View style={styles.roleModalOverlay}>
          <View style={styles.roleModalCard}>
            <View style={styles.roleModalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.roleModalTitle}>Change User Role</Text>
                <Text style={styles.roleModalSubtitle} numberOfLines={1}>
                  {roleModalUser?.name || 'User'} ({roleModalUser?.email || roleModalUser?.mobile || ''})
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setRoleModalUser(null)}
                disabled={isUpdatingRole}
                style={styles.roleModalCloseBtn}
              >
                <Icon name="close" size={20} color={Colors.textTertiary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.roleModalLabel}>Select New Role:</Text>

            <View style={styles.roleOptionList}>
              {[
                { id: 'player', title: 'Player', desc: 'Can join matches, tournaments, auctions and book turfs', icon: 'cricket', color: '#BA68C8' },
                { id: 'owner', title: 'Turf Owner', desc: 'Can register and manage turfs, slots, and bookings', icon: 'briefcase', color: Colors.primary },
              ].map((r) => {
                const isSelected = selectedRole === r.id;
                return (
                  <TouchableOpacity
                    key={r.id}
                    style={[styles.roleOptionCard, isSelected && { borderColor: r.color, backgroundColor: r.color + '15' }]}
                    onPress={() => setSelectedRole(r.id)}
                    activeOpacity={0.8}
                    disabled={isUpdatingRole}
                  >
                    <View style={[styles.roleOptionIconWrap, { backgroundColor: r.color + '25' }]}>
                      <Icon name={r.icon} size={20} color={r.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.roleOptionTitle, isSelected && { color: r.color }]}>{r.title}</Text>
                      <Text style={styles.roleOptionDesc}>{r.desc}</Text>
                    </View>
                    <Icon
                      name={isSelected ? 'radiobox-marked' : 'radiobox-blank'}
                      size={20}
                      color={isSelected ? r.color : Colors.textTertiary}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.roleModalNotice}>
              <Icon name="information-outline" size={15} color="#FF9800" style={{ marginTop: 1 }} />
              <Text style={styles.roleModalNoticeText}>
                Changing the role will automatically invalidate the user's active session, force them to log out, and prompt them to log in again with updated access.
              </Text>
            </View>

            <View style={styles.roleModalActions}>
              <TouchableOpacity
                style={styles.roleModalCancelBtn}
                onPress={() => setRoleModalUser(null)}
                disabled={isUpdatingRole}
              >
                <Text style={styles.roleModalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.roleModalSaveBtn}
                onPress={handleUpdateRole}
                disabled={isUpdatingRole}
              >
                {isUpdatingRole ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <Text style={styles.roleModalSaveText}>Apply & Logout User</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── PROFILE IMAGE FULL VIEW MODAL ── */}
      <Modal visible={!!selectedImageModal} transparent animationType="fade" onRequestClose={() => setSelectedImageModal(null)}>
        <View style={styles.imageViewerOverlay}>
          <TouchableOpacity style={styles.imageViewerDismissArea} activeOpacity={1} onPress={() => setSelectedImageModal(null)} />
          <View style={styles.imageViewerCard}>
            <View style={styles.imageViewerHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.imageViewerTitle} numberOfLines={1}>{selectedImageModal?.name || 'Profile Picture'}</Text>
                {selectedImageModal?.subtitle ? (
                  <Text style={styles.imageViewerSubtitle} numberOfLines={1}>{selectedImageModal.subtitle}</Text>
                ) : null}
              </View>
              <TouchableOpacity style={styles.imageViewerCloseBtn} onPress={() => setSelectedImageModal(null)} activeOpacity={0.7}>
                <Icon name="close" size={20} color="#FFF" />
              </TouchableOpacity>
            </View>
            <View style={styles.imageViewerBody}>
              {selectedImageModal?.url ? (
                <Image
                  source={{ uri: selectedImageModal.url }}
                  style={styles.imageViewerLarge}
                  resizeMode="contain"
                />
              ) : null}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const createStyles = (colors, isDark, shadows) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  // ── Header ──────────────────────────────────────────────────────────────
  header: {
    paddingTop: 52, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitleBlock: { gap: 2, flex: 1 },
  adminBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
    backgroundColor: isDark ? 'rgba(255,212,0,0.15)' : 'rgba(212,160,0,0.15)', paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 8, borderWidth: 1, borderColor: isDark ? 'rgba(255,212,0,0.3)' : 'rgba(212,160,0,0.3)',
  },
  adminBadgeText: { fontSize: 9, fontFamily: Typography.fontFamily.bold, color: isDark ? '#FFD400' : colors.primaryDark, letterSpacing: 1.2 },
  headerTitle: { fontSize: 24, fontFamily: Typography.fontFamily.extraBold, color: colors.textPrimary },

  // Header action buttons (icon-only 36x36 buttons)
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerActionBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: colors.surfaceVariant,
    borderWidth: 1, borderColor: colors.border,
    justifyContent: 'center', alignItems: 'center',
  },
  headerActionLabel: { fontSize: 9, fontFamily: Typography.fontFamily.bold, color: isDark ? '#FFD400' : colors.primaryDark, letterSpacing: 0.3 },

  headerDivider: { height: 1, backgroundColor: colors.border, marginVertical: Spacing.md },

  // ── Stats ──────────────────────────────────────────────────────────────
  statsContainer: { flexDirection: 'row', gap: 10 },
  statBox: { flex: 1, borderRadius: BorderRadius.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  statGrad: { alignItems: 'center', paddingVertical: Spacing.md, paddingHorizontal: 4, gap: 4 },
  statValue: { fontSize: 22, fontFamily: Typography.fontFamily.extraBold, color: isDark ? '#FFD400' : colors.primaryDark },
  statLabel: { fontSize: 9, fontFamily: Typography.fontFamily.bold, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },

  // ── Layout ──────────────────────────────────────────────────────────────
  contentArea: { flex: 1, backgroundColor: colors.background },
  hamburgerBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: colors.surfaceVariant,
    borderWidth: 1, borderColor: colors.border,
    justifyContent: 'center', alignItems: 'center',
  },
  hamburgerBadge: {
    position: 'absolute', top: -4, right: -4,
    backgroundColor: Colors.error, borderRadius: 9,
    paddingHorizontal: 4, minWidth: 18, height: 18,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: colors.background,
  },
  hamburgerBadgeText: { color: '#FFF', fontSize: 8, fontFamily: Typography.fontFamily.bold },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: Spacing.md, marginTop: Spacing.md, marginBottom: 4,
    backgroundColor: colors.surface, borderRadius: 14,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  searchInput: {
    flex: 1, fontSize: 13, color: colors.textPrimary,
    fontFamily: Typography.fontFamily.regular, padding: 0,
  },
  sidebarOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 99,
  },
  sidebar: {
    position: 'absolute', top: 0, bottom: 0, left: 0,
    width: SIDEBAR_WIDTH,
    backgroundColor: colors.surface,
    borderRightWidth: 1, borderRightColor: colors.border,
    zIndex: 100,
    elevation: 20,
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 20, shadowOffset: { width: 6, height: 0 },
  },

  // ── Sidebar identity block ──────────────────────────────────────────────
  sidebarIdentity: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingTop: 54, paddingHorizontal: 16, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  sidebarAvatarRing: {
    width: 40, height: 40, borderRadius: 14,
    backgroundColor: isDark ? 'rgba(255,204,0,0.1)' : 'rgba(212,160,0,0.1)',
    borderWidth: 1, borderColor: colors.border,
    justifyContent: 'center', alignItems: 'center',
  },
  sidebarIdentityTitle: {
    fontSize: 14, fontFamily: Typography.fontFamily.extraBold,
    color: colors.textPrimary, letterSpacing: 0.3,
  },
  sidebarIdentityRole: {
    fontSize: 10, fontFamily: Typography.fontFamily.bold,
    color: isDark ? '#FFD400' : colors.primaryDark, letterSpacing: 0.8, textTransform: 'uppercase',
    marginTop: 1,
  },
  sidebarCloseBtn: {
    width: 30, height: 30, borderRadius: 8,
    backgroundColor: colors.surfaceVariant,
    borderWidth: 1, borderColor: colors.border,
    justifyContent: 'center', alignItems: 'center',
  },

  // ── Sidebar items ────────────────────────────────────────────────────────
  sidebarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 16,
    position: 'relative',
    marginHorizontal: 8,
    marginVertical: 1,
    borderRadius: 10,
  },
  sidebarItemActive: {
    backgroundColor: isDark ? 'rgba(255,204,0,0.12)' : 'rgba(212,160,0,0.12)',
  },
  sidebarActiveBar: {
    position: 'absolute',
    left: 0, top: 8, bottom: 8,
    width: 3, borderRadius: 2,
    backgroundColor: 'transparent',
  },
  sidebarActiveBarVisible: {
    backgroundColor: isDark ? '#FFD400' : colors.primaryDark,
  },
  sidebarIconWrap: {
    width: 32, height: 32, borderRadius: 9,
    backgroundColor: colors.surfaceVariant,
    justifyContent: 'center', alignItems: 'center',
  },
  sidebarIconWrapActive: {
    backgroundColor: isDark ? 'rgba(255,204,0,0.18)' : 'rgba(212,160,0,0.18)',
  },
  sidebarText: {
    flex: 1,
    fontSize: 13, fontFamily: Typography.fontFamily.medium,
    color: colors.textSecondary,
  },
  sidebarTextActive: {
    color: isDark ? '#FFD400' : colors.primaryDark,
    fontFamily: Typography.fontFamily.bold,
  },
  sidebarBadge: {
    backgroundColor: Colors.error, borderRadius: 10,
    paddingHorizontal: 6, paddingVertical: 2,
    minWidth: 20, alignItems: 'center',
  },
  sidebarBadgeText: { color: '#FFF', fontSize: 9, fontFamily: Typography.fontFamily.bold },
  sidebarDivider: {
    height: 1, backgroundColor: colors.border,
    marginVertical: 6, marginHorizontal: 16,
  },
  sidebarSectionLabel: {
    fontSize: 9, fontFamily: Typography.fontFamily.bold,
    color: colors.textTertiary, letterSpacing: 1.2,
    paddingHorizontal: 24, paddingTop: 10, paddingBottom: 4,
    textTransform: 'uppercase',
  },

  // ── Tabs ──────────────────────────────────────────────────────────────
  tabsContainer: { flexDirection: 'row', paddingHorizontal: Spacing.lg, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  tab: { flex: 1, paddingVertical: Spacing.md, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: isDark ? '#FFD400' : colors.primaryDark },
  tabText: { color: colors.textTertiary, fontFamily: Typography.fontFamily.medium, fontSize: 13 },
  tabTextActive: { color: isDark ? '#FFD400' : colors.primaryDark, fontFamily: Typography.fontFamily.bold },
  badge: { backgroundColor: Colors.error, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2, marginLeft: 6 },
  badgeText: { color: '#FFF', fontSize: 10, fontFamily: Typography.fontFamily.bold },

  list: { padding: Spacing.md, paddingBottom: 100 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: colors.textSecondary, textAlign: 'center', marginTop: Spacing.xl, fontFamily: Typography.fontFamily.medium },

  // ── Cards ──────────────────────────────────────────────────────────────
  card: { backgroundColor: colors.surface, borderRadius: BorderRadius.xl, borderWidth: 1, borderColor: colors.border, marginBottom: Spacing.md, overflow: 'hidden' },
  cardGradBg: { },
  turfStatusAccent: { height: 3, width: '100%' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, gap: 12 },
  avatarWrap: { borderRadius: 25, overflow: 'hidden' },
  avatar: { width: 46, height: 46, borderRadius: 23, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 18, fontFamily: Typography.fontFamily.extraBold, color: '#fff' },
  cardTitle: { fontSize: 15, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary },
  cardSubtitle: { fontSize: 12, color: colors.textTertiary, fontFamily: Typography.fontFamily.regular, marginTop: 2 },

  joinedLabel: { fontSize: 10, color: colors.textTertiary, fontFamily: Typography.fontFamily.bold, textTransform: 'uppercase' },
  joinedDate: { fontSize: 12, color: colors.textPrimary, fontFamily: Typography.fontFamily.bold, marginTop: 2 },

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

  // ── Turf Card ──────────────────────────────────────
  turfCard: {
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },
  turfCoverWrap: {
    width: '100%',
    height: 160,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surfaceVariant,
  },
  turfCoverImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  turfCoverOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  turfImagePlaceholder: {
    backgroundColor: colors.surfaceVariant,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  turfStatusPin: {
    position: 'absolute',
    top: 10, right: 10,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 20, borderWidth: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  turfStatusPinText: { fontSize: 10, fontFamily: Typography.fontFamily.bold },
  turfCoverInfo: {
    position: 'absolute',
    bottom: 10, left: 12, right: 80,
  },
  turfCoverName: {
    fontSize: 16,
    fontFamily: Typography.fontFamily.extraBold,
    color: '#ffffff',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  turfCoverCity: {
    fontSize: 11,
    fontFamily: Typography.fontFamily.medium,
    color: 'rgba(255,255,255,0.8)',
  },
  turfCoverDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: 'rgba(255,255,255,0.4)' },
  turfCoverPrice: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.bold,
    color: isDark ? '#FFD400' : colors.primaryDark,
  },
  turfBody: { padding: Spacing.md },
  turfInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  turfOwnerText: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.medium,
    color: colors.textSecondary,
  },
  turfTypeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: colors.surfaceVariant, paddingHorizontal: 6, paddingVertical: 3,
    borderRadius: 6, borderWidth: 1, borderColor: colors.border,
  },
  turfTypeText: { fontSize: 9, fontFamily: Typography.fontFamily.medium, color: colors.textSecondary },
  turfStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceVariant,
    borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: colors.border,
    paddingVertical: 8,
    marginBottom: Spacing.sm,
  },
  turfStatItem: { flex: 1, alignItems: 'center', gap: 2 },
  turfStatVal: { fontSize: 14, fontFamily: Typography.fontFamily.extraBold, color: colors.textPrimary },
  turfStatLabel: { fontSize: 9, fontFamily: Typography.fontFamily.bold, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.3 },
  turfStatDivider: { width: 1, height: 28, backgroundColor: colors.border },
  turfAmenitiesRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 5,
    marginBottom: Spacing.sm,
  },
  turfAmenityChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: isDark ? 'rgba(255,212,0,0.15)' : 'rgba(212,160,0,0.15)',
    borderRadius: 20, paddingHorizontal: 7, paddingVertical: 3,
  },
  turfAmenityText: { fontSize: 9, fontFamily: Typography.fontFamily.bold, color: isDark ? '#FFD400' : colors.primaryDark },
  turfDeletionBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(244,67,54,0.08)',
    borderRadius: 8, borderWidth: 1, borderColor: 'rgba(244,67,54,0.2)',
    paddingHorizontal: 10, paddingVertical: 6,
    marginBottom: Spacing.sm,
  },
  turfDeletionText: { fontSize: 12, fontFamily: Typography.fontFamily.bold, color: Colors.error },
  turfActionsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: 4,
  },
  turfActionBtn: {
    flex: 1,
    minWidth: 90,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  turfActionBtnText: { fontFamily: Typography.fontFamily.bold, fontSize: 12 },
  turfActionBtnPrimary: { backgroundColor: isDark ? 'rgba(255,212,0,0.15)' : 'rgba(212,160,0,0.15)', borderColor: isDark ? '#FFD400' : colors.primaryDark },
  turfActionBtnDanger: { backgroundColor: 'rgba(255,71,87,0.1)', borderColor: 'rgba(255,71,87,0.3)' },
  turfActionBtnGhost: { backgroundColor: colors.surfaceVariant, borderColor: colors.border },

  noTurfs: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surfaceVariant, padding: Spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  noTurfsText: { color: colors.textTertiary, fontFamily: Typography.fontFamily.regular, fontSize: 12, fontStyle: 'italic' },

  // ── Registered Turfs in Owner Card ──────────────────────────────────────
  turfsList: {
    backgroundColor: colors.surfaceVariant,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: Spacing.md,
  },
  turfsListHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.sm,
  },
  sectionHeader: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.bold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  turfCountBadge: {
    backgroundColor: isDark ? 'rgba(255,212,0,0.15)' : 'rgba(212,160,0,0.15)',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 1,
  },
  turfCountBadgeText: {
    fontSize: 10,
    fontFamily: Typography.fontFamily.extraBold,
    color: isDark ? '#FFD400' : colors.primaryDark,
  },
  turfItemsWrap: {
    gap: 8,
  },
  turfItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.md,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  turfItemIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: isDark ? 'rgba(255,212,0,0.1)' : 'rgba(212,160,0,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  turfName: {
    fontSize: 13,
    fontFamily: Typography.fontFamily.bold,
    color: colors.textPrimary,
  },
  turfCity: {
    fontSize: 11,
    fontFamily: Typography.fontFamily.regular,
    color: colors.textTertiary,
    marginTop: 2,
  },
  turfStatusChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  turfStatusActive: {
    backgroundColor: 'rgba(46,213,115,0.1)',
    borderColor: 'rgba(46,213,115,0.3)',
  },
  turfStatusPending: {
    backgroundColor: 'rgba(255,152,0,0.1)',
    borderColor: 'rgba(255,152,0,0.3)',
  },
  turfStatusText: {
    fontSize: 9,
    fontFamily: Typography.fontFamily.bold,
  },

  // ── Settlement Bank Details Card ──────────────────────────────────────
  settlementBankBox: {
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.lg,
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  settlementBankHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  settlementBankTitle: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.bold,
    color: isDark ? '#FFD400' : colors.primaryDark,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  settlementBankGrid: {
    gap: 6,
  },
  settlementBankRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settlementBankLabel: {
    fontSize: 11,
    fontFamily: Typography.fontFamily.medium,
    color: colors.textTertiary,
  },
  settlementBankValue: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.semiBold,
    color: colors.textPrimary,
  },

  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, backgroundColor: colors.surfaceVariant, borderWidth: 1, borderColor: colors.border },
  actionBtnText: { color: colors.textPrimary, fontFamily: Typography.fontFamily.bold, fontSize: 12 },

  // ── Modals ──────────────────────────────────────────────────────────────
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center' },
  modalCard: { width: '90%', maxWidth: 400, backgroundColor: colors.surface, borderRadius: BorderRadius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: colors.border },
  modalContent: { width: '90%', backgroundColor: colors.surface, borderRadius: BorderRadius.xl, padding: Spacing.xl },
  modalTitle: { fontSize: 18, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary, marginBottom: Spacing.lg },
  inputLabel: { fontSize: 13, color: colors.textSecondary, fontFamily: Typography.fontFamily.medium, marginBottom: 8 },
  input: { backgroundColor: colors.surfaceVariant, borderWidth: 1, borderColor: colors.border, borderRadius: BorderRadius.md, padding: 12, color: colors.textPrimary, fontFamily: Typography.fontFamily.medium },
  modalBtn: { flex: 1, padding: 14, borderRadius: BorderRadius.md, alignItems: 'center' },
  modalBtnText: { fontFamily: Typography.fontFamily.bold, fontSize: 14 },

  bannerUploadBtn: { height: 120, backgroundColor: colors.surfaceVariant, borderWidth: 1, borderColor: colors.border, borderRadius: BorderRadius.md, justifyContent: 'center', alignItems: 'center', borderStyle: 'dashed', overflow: 'hidden' },
  bannerPreview: { width: '100%', height: '100%' },
  bannerUploadText: { color: isDark ? '#FFD400' : colors.primaryDark, fontFamily: Typography.fontFamily.medium, marginTop: 8 },

  // ── User Management Extra Styles ──
  userAvatarImage: {
    width: 46,
    height: 46,
    borderRadius: 23,
  },
  avatarZoomBadge: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    backgroundColor: isDark ? '#FFD400' : colors.primaryDark,
    borderRadius: 10,
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
  suspendedTag: {
    backgroundColor: 'rgba(255,71,87,0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,71,87,0.3)',
  },
  suspendedTagText: {
    color: '#FF4757',
    fontSize: 9,
    fontFamily: Typography.fontFamily.bold,
  },
  cardSubtitlePhone: {
    fontSize: 11,
    color: colors.textTertiary,
    fontFamily: Typography.fontFamily.regular,
    marginTop: 1,
  },
  userPlayerBox: {
    backgroundColor: colors.surfaceVariant,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
  },
  userPlayerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  userPlayerTitle: {
    fontSize: 11,
    fontFamily: Typography.fontFamily.bold,
    color: isDark ? '#FFD400' : colors.primaryDark,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  userPlayerViewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  userPlayerViewBtnText: {
    fontSize: 11,
    fontFamily: Typography.fontFamily.bold,
    color: isDark ? '#FFD400' : colors.primaryDark,
  },
  userPlayerChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  userPlayerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  userPlayerChipText: {
    fontSize: 10,
    fontFamily: Typography.fontFamily.medium,
    color: colors.textSecondary,
  },
  suspendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: 'rgba(255,152,0,0.1)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,152,0,0.25)',
  },
  reactivateBtn: {
    backgroundColor: 'rgba(46,213,115,0.1)',
    borderColor: 'rgba(46,213,115,0.3)',
  },
  suspendUserText: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: 12,
  },

  // ── Profile Image Full View Modal ──
  imageViewerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  imageViewerDismissArea: {
    ...StyleSheet.absoluteFillObject,
  },
  imageViewerCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    zIndex: 10,
  },
  imageViewerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surfaceVariant,
  },
  imageViewerTitle: {
    fontSize: 15,
    fontFamily: Typography.fontFamily.bold,
    color: colors.textPrimary,
  },
  imageViewerSubtitle: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.regular,
    color: colors.textTertiary,
    marginTop: 2,
  },
  imageViewerCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceVariant,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerBody: {
    width: '100%',
    height: 340,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerLarge: {
    width: '100%',
    height: '100%',
  },

  overlayLoader: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
    gap: 12
  },
  overlayText: {
    color: '#ffffff',
    fontSize: 15,
    fontFamily: Typography.fontFamily.bold,
  },

  // ── Role Modal & Action Styles ──
  roleActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 7,
    backgroundColor: 'rgba(186,104,200,0.12)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(186,104,200,0.3)',
  },
  roleActionText: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: 12,
    color: '#BA68C8',
  },
  roleModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  roleModalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  roleModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  roleModalTitle: {
    fontSize: 18,
    fontFamily: Typography.fontFamily.bold,
    color: colors.textPrimary,
  },
  roleModalSubtitle: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.regular,
    color: colors.textTertiary,
    marginTop: 2,
  },
  roleModalCloseBtn: {
    padding: 4,
  },
  roleModalLabel: {
    fontSize: 13,
    fontFamily: Typography.fontFamily.bold,
    color: colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  roleOptionList: {
    gap: 10,
    marginBottom: Spacing.md,
  },
  roleOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: colors.surfaceVariant,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  roleOptionIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  roleOptionTitle: {
    fontSize: 14,
    fontFamily: Typography.fontFamily.bold,
    color: colors.textPrimary,
  },
  roleOptionDesc: {
    fontSize: 11,
    fontFamily: Typography.fontFamily.regular,
    color: colors.textTertiary,
    marginTop: 2,
  },
  roleModalNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(255,152,0,0.1)',
    borderRadius: BorderRadius.md,
    padding: 10,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,152,0,0.25)',
  },
  roleModalNoticeText: {
    flex: 1,
    fontSize: 11,
    fontFamily: Typography.fontFamily.regular,
    color: '#FF9800',
    lineHeight: 16,
  },
  roleModalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  roleModalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: BorderRadius.lg,
    backgroundColor: colors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleModalCancelText: {
    fontSize: 14,
    fontFamily: Typography.fontFamily.bold,
    color: colors.textSecondary,
  },
  roleModalSaveBtn: {
    flex: 1.6,
    paddingVertical: 12,
    borderRadius: BorderRadius.lg,
    backgroundColor: isDark ? '#FFD400' : colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleModalSaveText: {
    fontSize: 14,
    fontFamily: Typography.fontFamily.bold,
    color: isDark ? '#000' : '#FFF',
  },
});

export default AdminDashboardScreen;

