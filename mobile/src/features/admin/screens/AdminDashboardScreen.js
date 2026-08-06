import React, { useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Modal, TextInput, Image, ScrollView, Animated, Dimensions, Platform } from 'react-native';
import FinanceView from './FinanceView';
import SupportAdminView from './SupportAdminView';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SIDEBAR_WIDTH = 110;
import LinearGradient from '../../../components/SolidGradient';
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
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

const AdminDashboardScreen = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState('owners');
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
      closeSidebar();
      navigation.navigate('UserManager');
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
  const [owners, setOwners] = useState([]);
  const [users, setUsers] = useState([]);
  const [turfs, setTurfs] = useState([]);
  const [waitlist, setWaitlist] = useState([]);
  const [refunds, setRefunds] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [openTickets, setOpenTickets] = useState(0);
  const [deletionRequestsCount, setDeletionRequestsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
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
        const selected = response.assets[0];
        if (selected.fileSize && selected.fileSize > 3 * 1024 * 1024) {
          showCustomAlert('File Too Large', 'Please select an image smaller than 3MB.');
          return;
        }
        setBannerImage(selected);
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
      const [ownersRes, usersRes, turfsRes, waitlistRes, refundsRes, settlementsRes, ticketsRes, deletionReqsRes] = await Promise.allSettled([
        api.get('/admin/owners?limit=100'),
        api.get('/admin/users?limit=100'),
        api.get('/admin/turfs?limit=100'),
        api.get('/contact/waitlist?limit=100'),
        api.get('/admin/refunds?limit=100'),
        api.get('/admin/settlements?limit=100'),
        api.get('/admin/support?status=open'),
        api.get('/admin/deletion-requests')
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

      if (deletionReqsRes && deletionReqsRes.status === 'fulfilled') {
        setDeletionRequestsCount(deletionReqsRes.value.data?.data?.length || 0);
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
            <View style={[styles.avatar, { backgroundColor: Colors.surfaceVariant }]}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
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
              'PERMANENT USER DELETION',
              `⚠️ WARNING: THIS ACTION CANNOT BE RESTORED OR UNDONE!\n\nAre you sure you want to permanently delete user "${item.name || 'User'}"?\n\nThis will purge ALL bookings, wallet balance, stats, player profile, owner turfs, and team captaincy records. ZERO data will remain.`,
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'PERMANENTLY DELETE', style: 'destructive', onPress: () => handleDeleteUser(item._id) }
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
            <View style={[styles.avatar, { backgroundColor: Colors.surfaceVariant }]}>
              <Icon name="soccer-field" size={22} color={Colors.primary} />
            </View>
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

  
  const handleProcessRefund = (item) => {
    showCustomAlert(
      'Confirm Refund',
      `Are you sure you want to process a refund of ₹${item.refundAmount} to ${item.user?.name || 'the user'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Process',
          onPress: async () => {
            try {
              await api.post(`/admin/refunds/${item._id}/process`);
              showCustomAlert('Success', 'Refund processed successfully');
              fetchData();
            } catch (err) {
              showCustomAlert('Error', err.response?.data?.message || 'Failed to process refund');
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

  const handleLogout = () => {
    showCustomAlert("Confirm Logout", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Logout", style: "destructive", onPress: () => {
        dispatch(logout());
      }}
    ]);
  };

  const pendingRefunds = refunds.filter(r => r.status === 'pending').length;
  const pendingSettlements = settlements.filter(s => s.status === 'pending').length;
  const totalAlerts = pendingRefunds + pendingSettlements + openTickets + deletionRequestsCount;

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

  const SearchBar = () => (
    <View style={styles.searchBar}>
      <Icon name="magnify" size={18} color={Colors.textTertiary} />
      <TextInput
        style={styles.searchInput}
        placeholder="Search by name or email..."
        placeholderTextColor={Colors.textTertiary}
        value={searchQuery}
        onChangeText={setSearchQuery}
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="while-editing"
      />
      {searchQuery.length > 0 && (
        <TouchableOpacity onPress={() => setSearchQuery('')}>
          <Icon name="close-circle" size={17} color={Colors.textTertiary} />
        </TouchableOpacity>
      )}
    </View>
  );

  const SidebarItem = ({ tab, icon, label, badge }) => {
    const isActive = activeTab === tab;
    return (
      <TouchableOpacity
        style={[styles.sidebarItem, isActive && styles.sidebarItemActive]}
        onPress={() => handleTabSelect(tab)}
        activeOpacity={0.75}
      >
        <Icon name={icon} size={21} color={isActive ? Colors.primary : Colors.textTertiary} />
        <Text style={[styles.sidebarText, isActive && styles.sidebarTextActive]} numberOfLines={1}>{label}</Text>
        {badge > 0 && (
          <View style={styles.sidebarBadge}><Text style={styles.sidebarBadgeText}>{badge}</Text></View>
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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <TouchableOpacity
              onPress={openSidebar}
              style={styles.hamburgerBtn}
              activeOpacity={0.75}
            >
              <Icon name="menu" size={22} color={Colors.textPrimary} />
              {totalAlerts > 0 && (
                <View style={styles.hamburgerBadge}>
                  <Text style={styles.hamburgerBadgeText}>{totalAlerts}</Text>
                </View>
              )}
            </TouchableOpacity>
            <View style={styles.headerTitleBlock}>
              <View style={styles.adminBadge}>
                <Icon name="shield-crown" size={13} color={Colors.primary} />
                <Text style={styles.adminBadgeText}>ADMIN</Text>
              </View>
              <Text style={styles.headerTitle}>Dashboard</Text>
            </View>
          </View>

          <View style={styles.headerActions}>
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
          <TouchableOpacity style={styles.statBox} onPress={() => navigation.navigate('UserManager')} activeOpacity={0.8}>
            <View style={[styles.statGrad, { backgroundColor: Colors.surface }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Icon name="account-group" size={20} color={Colors.primary} />
                {deletionRequestsCount > 0 && (
                  <View style={{ backgroundColor: Colors.error, width: 8, height: 8, borderRadius: 4 }} />
                )}
              </View>
              <Text style={styles.statValue}>{owners.length + users.length}</Text>
              <Text style={styles.statLabel}>Total Users</Text>
            </View>
          </TouchableOpacity>
          <View style={styles.statBox}>
            <View style={[styles.statGrad, { backgroundColor: Colors.surface }]}>
              <Icon name="briefcase-account" size={20} color="#5B8DEF" />
              <Text style={[styles.statValue, { color: '#5B8DEF' }]}>{owners.length}</Text>
              <Text style={styles.statLabel}>Owners</Text>
            </View>
          </View>
          <View style={styles.statBox}>
            <View style={[styles.statGrad, { backgroundColor: Colors.surface }]}>
              <Icon name="soccer-field" size={20} color="#2ED573" />
              <Text style={[styles.statValue, { color: '#2ED573' }]}>{turfs.length}</Text>
              <Text style={styles.statLabel}>Turfs</Text>
            </View>
          </View>
        </View>
      </View>
      
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
            <Text style={{ color: Colors.textSecondary, fontSize: 12, textAlign: 'center', marginTop: 8 }}>Max 3 MB</Text>

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

      {/* Main Content */}
      <View style={styles.contentArea}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : activeTab === 'owners' ? (
          <>
            <SearchBar />
            <FlatList data={filteredOwners} keyExtractor={item => item._id} renderItem={renderOwnerCard}
              contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled"
              ListEmptyComponent={<Text style={styles.emptyText}>{q ? 'No results found.' : 'No owners found.'}</Text>} />
          </>
        ) : activeTab === 'turfs' ? (
          <>
            <SearchBar />
            <FlatList data={filteredTurfs} keyExtractor={item => item._id} renderItem={renderTurfCard}
              contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled"
              ListEmptyComponent={<Text style={styles.emptyText}>{q ? 'No results found.' : 'No turfs found.'}</Text>} />
          </>
        ) : activeTab === 'users' ? (
          <>
            <SearchBar />
            <FlatList data={filteredUsers} keyExtractor={item => item._id} renderItem={renderUserCard}
              contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled"
              ListEmptyComponent={<Text style={styles.emptyText}>{q ? 'No results found.' : 'No users found.'}</Text>} />
          </>
        ) : activeTab === 'refunds' ? (
          <>
            <SearchBar />
            <FlatList data={filteredRefunds} keyExtractor={item => item._id} renderItem={renderRefundCard}
              contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled"
              ListEmptyComponent={<Text style={styles.emptyText}>{q ? 'No results found.' : 'No refunds found.'}</Text>} />
          </>
        ) : activeTab === 'waitlist' ? (
          <>
            <SearchBar />
            <FlatList data={filteredWaitlist} keyExtractor={item => item._id} renderItem={renderWaitlistCard}
              contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled"
              ListEmptyComponent={<Text style={styles.emptyText}>{q ? 'No results found.' : 'No waitlist entries found.'}</Text>} />
          </>
        ) : activeTab === 'settlements_requests' ? (
          loadingSettlements ? (
            <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>
          ) : (
            <>
              <SearchBar />
              <FlatList
                data={filteredSettlementReqs}
                keyExtractor={item => item._id}
                renderItem={renderSettlementRequest}
                contentContainerStyle={styles.list}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={<Text style={styles.emptyText}>{q ? 'No results found.' : 'No withdrawal requests found.'}</Text>}
              />
            </>
          )
        ) : activeTab === 'settlements_turf' ? (
          loadingSettlements ? (
            <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>
          ) : (
            <>
              <SearchBar />
              <FlatList
                data={filteredTurfWallets}
                keyExtractor={item => item._id}
                renderItem={renderWalletCard}
                contentContainerStyle={styles.list}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={<Text style={styles.emptyText}>{q ? 'No results found.' : 'No turf owner wallets found.'}</Text>}
              />
            </>
          )
        ) : activeTab === 'settlements_org' ? (
          loadingSettlements ? (
            <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>
          ) : (
            <>
              <SearchBar />
              <FlatList
                data={filteredOrgWallets}
                keyExtractor={item => item._id}
                renderItem={renderWalletCard}
                contentContainerStyle={styles.list}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={<Text style={styles.emptyText}>{q ? 'No results found.' : 'No organizer wallets found.'}</Text>}
              />
            </>
          )
        ) : activeTab === 'finance' ? (
          <FinanceView navigation={navigation} />
        ) : activeTab === 'support' ? (
          <SupportAdminView navigation={navigation} onStatusChanged={fetchData} />
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
        <View style={styles.sidebarHeader}>
          <Icon name="shield-crown" size={18} color={Colors.primary} />
          <Text style={styles.sidebarHeaderText}>Menu</Text>
        </View>
        <ScrollView showsVerticalScrollIndicator={false}>
          <SidebarItem tab="turfs" icon="soccer-field" label="Turfs"
            badge={turfs.filter(t => t.pendingPlatformFee > 0 && t.pendingPaymentId).length} />
          <SidebarItem tab="owners" icon="briefcase-account" label="Owners" badge={0} />
          <SidebarItem tab="users" icon="account-group" label="Users" badge={0} />
          <SidebarItem tab="user_manager" icon="account-remove-outline" label="Deletion Requests" badge={deletionRequestsCount} />
          <SidebarItem tab="waitlist" icon="clipboard-list-outline" label="Waitlist" badge={0} />

          <View style={styles.sidebarDivider} />
          <Text style={styles.sidebarSectionLabel}>REFUNDS</Text>
          <SidebarItem tab="refunds" icon="cash-refund" label="Refunds" badge={pendingRefunds} />

          <View style={styles.sidebarDivider} />
          <Text style={styles.sidebarSectionLabel}>SUPPORT</Text>
          <SidebarItem tab="support" icon="ticket-account" label="Support Tickets" badge={openTickets} />
          
          <View style={styles.sidebarDivider} />
          <Text style={styles.sidebarSectionLabel}>FINANCE</Text>
          <SidebarItem tab="finance" icon="finance" label="Finance Dashboard" badge={0} />

          <View style={styles.sidebarDivider} />
          <Text style={styles.sidebarSectionLabel}>SETTLEMENTS</Text>
          <SidebarItem tab="settlements_requests" icon="bank-transfer-out" label="Withdraw Req." badge={pendingSettlements} />
          <SidebarItem tab="settlements_turf" icon="stadium-variant" label="Turf Wallets" badge={0} />
          <SidebarItem tab="settlements_org" icon="account-tie-hat" label="Organizers" badge={0} />
        </ScrollView>
      </Animated.View>
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

  // ── Layout ──────────────────────────────────────────────────────────────
  contentArea: { flex: 1, backgroundColor: Colors.background },
  hamburgerBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.border,
    justifyContent: 'center', alignItems: 'center',
  },
  hamburgerBadge: {
    position: 'absolute', top: -4, right: -4,
    backgroundColor: Colors.error, borderRadius: 9,
    paddingHorizontal: 4, minWidth: 18, height: 18,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: Colors.background,
  },
  hamburgerBadgeText: { color: '#FFF', fontSize: 8, fontFamily: Typography.fontFamily.bold },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: Spacing.md, marginTop: Spacing.md, marginBottom: 4,
    backgroundColor: Colors.surface, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  searchInput: {
    flex: 1, fontSize: 13, color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.regular, padding: 0,
  },
  sidebarOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 99,
  },
  sidebar: {
    position: 'absolute', top: 0, bottom: 0, left: 0,
    width: SIDEBAR_WIDTH,
    backgroundColor: Colors.backgroundCard,
    borderRightWidth: 1, borderRightColor: Colors.border,
    zIndex: 100,
    paddingTop: 52,
    elevation: 16,
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 16, shadowOffset: { width: 4, height: 0 },
  },
  sidebarHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    marginBottom: 6,
  },
  sidebarHeaderText: { fontSize: 14, fontFamily: Typography.fontFamily.bold, color: Colors.primary },
  sidebarItem: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 13, paddingHorizontal: 6,
    borderLeftWidth: 3, borderLeftColor: 'transparent',
    position: 'relative',
  },
  sidebarItemActive: { borderLeftColor: Colors.primary, backgroundColor: Colors.primaryAlpha20 },
  sidebarText: { fontSize: 9, fontFamily: Typography.fontFamily.medium, color: Colors.textTertiary, marginTop: 4, textAlign: 'center' },
  sidebarTextActive: { color: Colors.primary, fontFamily: Typography.fontFamily.bold },
  sidebarBadge: {
    position: 'absolute', top: 6, right: 10,
    backgroundColor: Colors.error, borderRadius: 10,
    paddingHorizontal: 4, paddingVertical: 1, minWidth: 18, alignItems: 'center',
  },
  sidebarBadgeText: { color: '#FFF', fontSize: 8, fontFamily: Typography.fontFamily.bold },
  sidebarDivider: { height: 1, backgroundColor: Colors.border, marginVertical: 6, marginHorizontal: 10 },
  sidebarSectionLabel: {
    fontSize: 8, fontFamily: Typography.fontFamily.bold,
    color: Colors.textTertiary, letterSpacing: 0.8,
    paddingHorizontal: 14, paddingVertical: 4,
    textTransform: 'uppercase',
  },

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
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center' },
  modalCard: { width: '90%', maxWidth: 400, backgroundColor: Colors.backgroundCard, borderRadius: BorderRadius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border },
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

