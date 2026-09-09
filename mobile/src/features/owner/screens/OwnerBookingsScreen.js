import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Modal,
  TextInput,
  ScrollView,
  Dimensions,
  StatusBar,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Typography } from '../../../theme/theme';
import { useTheme } from '../../../theme/ThemeContext';
import api, { getImageUrl } from '../../../api/axios';
import { formatISTDate, formatISTTime } from '../../../utils/dateFormatter';
import moment from 'moment';
import {
  confirmBookingPayment,
  rejectBookingPayment,
  approveCancellation,
  rejectCancellation,
  fetchOwnerDashboard,
} from '../ownerSlice';
import { showCustomAlert } from '../../../components/CustomAlert';

const TABS = [
  { id: 'All', label: 'All', icon: 'format-list-bulleted' },
  { id: 'Confirmed', label: 'Confirmed', icon: 'check-circle' },
  { id: 'Completed', label: 'Completed', icon: 'checkbox-marked-circle' },
  { id: 'Cancel Req', label: 'Cancel Req', icon: 'alert-circle' },
  { id: 'Cancelled', label: 'Cancelled', icon: 'close-circle' },
];

const OwnerBookingsScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark, shadows } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark, shadows), [colors, isDark, shadows]);

  const { dashboard } = useSelector((state) => state.owner);
  const turfs = dashboard?.owner?.turfs || [];
  const pendingCancellationsCount = dashboard?.stats?.pendingCancellationsCount || 0;
  
  const dispatch = useDispatch();
  const [selectedTurf, setSelectedTurf] = useState('all');
  const [bookings, setBookings] = useState([]);
  const [turfModalVisible, setTurfModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  const [verifyModalVisible, setVerifyModalVisible] = useState(false);
  const [verifyingBooking, setVerifyingBooking] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [verifying, setVerifying] = useState(false);

  const [rejectCancelModalVisible, setRejectCancelModalVisible] = useState(false);
  const [rejectCancelReason, setRejectCancelReason] = useState('');
  const [cancelRejecting, setCancelRejecting] = useState(false);
  const [actionBooking, setActionBooking] = useState(null);
  const [approvingBookingId, setApprovingBookingId] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(moment().startOf('month'));

  const [cancellationRefundPercent, setCancellationRefundPercent] = useState(80);
  const [cancellationPlatformPercent, setCancellationPlatformPercent] = useState(5);

  // Pagination state
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const topTabsRef = useRef(null);

  useEffect(() => {
    if (route.params?.turfId) {
      setSelectedTurf(route.params.turfId);
    }
  }, [route.params?.turfId]);

  useEffect(() => {
    api.get('/admin/public-settings').then(res => {
      if (res.data?.data) {
        if (res.data.data.cancellationRefundPercent !== undefined) setCancellationRefundPercent(res.data.data.cancellationRefundPercent);
        if (res.data.data.cancellationPlatformPercent !== undefined) setCancellationPlatformPercent(res.data.data.cancellationPlatformPercent);
      }
    }).catch(console.error);
  }, []);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (selectedTurf) {
        fetchBookings(1, true);
      }
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, dateFilter, statusFilter, selectedTurf]);

  const fetchBookings = async (pageNum = 1, showLoader = true) => {
    if (showLoader && pageNum === 1) setLoading(true);
    if (pageNum > 1) setLoadingMore(true);

    try {
      let url = `/bookings/owner?page=${pageNum}&limit=10`;
      if (selectedTurf && selectedTurf !== 'all') {
        url += `&turfId=${selectedTurf}`;
      }
      if (searchQuery) url += `&search=${encodeURIComponent(searchQuery)}`;
      if (dateFilter) {
        const parts = dateFilter.split('/');
        if (parts.length === 3) {
           url += `&date=${parts[2]}-${parts[1]}-${parts[0]}`;
        }
      }
      if (statusFilter !== 'All') {
        const matchTarget = (statusFilter === 'Cancellation Requested' || statusFilter === 'Cancel Req') ? 'cancellation_requested' : statusFilter.toLowerCase();
        url += `&status=${matchTarget}`;
      }

      const res = await api.get(url);
      const newBookings = res.data.data;

      if (pageNum === 1) {
        setBookings(newBookings);
      } else {
        setBookings(prev => {
          const existingIds = new Set(prev.map(b => b._id));
          const uniqueNew = newBookings.filter(b => !existingIds.has(b._id));
          return [...prev, ...uniqueNew];
        });
      }

      setHasMore(newBookings.length >= 10);
      setPage(pageNum);
    } catch (err) {
      console.error('Error fetching bookings:', err);
    } finally {
      if (showLoader && pageNum === 1) setLoading(false);
      if (pageNum > 1) setLoadingMore(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchBookings(1, false);
  };

  const getStatusConfig = (status) => {
    switch (status) {
      case 'confirmed': return { color: colors.primary || '#FFCC00', label: 'CONFIRMED', icon: 'check-circle' };
      case 'pending': return { color: colors.warning || '#F59E0B', label: 'PENDING', icon: 'clock-outline' };
      case 'cancellation_requested': return { color: '#FF5722', label: 'CANCEL REQ.', icon: 'alert-circle' };
      case 'cancelled': return { color: colors.error || '#EF4444', label: 'CANCELLED', icon: 'close-circle' };
      case 'completed': return { color: '#2196F3', label: 'COMPLETED', icon: 'checkbox-marked-circle' };
      default: return { color: colors.textSecondary, label: (status || 'UNKNOWN').toUpperCase(), icon: 'information' };
    }
  };

  const handleVerify = (booking) => {
    setVerifyingBooking(booking);
    setRejectReason('');
    setVerifyModalVisible(true);
  };

  const submitVerify = async (isApprove) => {
    if (!isApprove && !rejectReason.trim()) {
      return showCustomAlert('Error', 'Please provide a rejection reason');
    }
    setVerifying(true);
    try {
      if (isApprove) {
        const res = await dispatch(confirmBookingPayment(verifyingBooking._id));
        if (confirmBookingPayment.fulfilled.match(res)) {
          showCustomAlert('Success', 'Payment approved and booking confirmed!');
          fetchBookings();
          dispatch(fetchOwnerDashboard());
        } else {
          showCustomAlert('Error', res.payload);
        }
      } else {
        const res = await dispatch(rejectBookingPayment({ bookingId: verifyingBooking._id, reason: rejectReason }));
        if (rejectBookingPayment.fulfilled.match(res)) {
          showCustomAlert('Success', 'Payment rejected and booking cancelled.');
          fetchBookings();
          dispatch(fetchOwnerDashboard());
        } else {
          showCustomAlert('Error', res.payload);
        }
      }
      setVerifyModalVisible(false);
    } finally {
      setVerifying(false);
    }
  };

  const handleApproveCancel = (booking) => {
    const isOnline = booking.payment && ['qr_upi', 'wallet', 'razorpay', 'phonepe'].includes(booking.payment.method);
    const amount = booking.totalAmount || booking.finalAmount;
    const refundAmount = Math.round(amount * (cancellationRefundPercent / 100));
    const platformFee = Math.round(amount * (cancellationPlatformPercent / 100));
    const deductionAmount = refundAmount + platformFee;
    
    const message = isOnline
      ? `Approving this cancellation will deduct ₹${deductionAmount} from your wallet and refund the user automatically. Proceed?`
      : 'Have you refunded the money to the user via UPI? Approving this will free up the turf slots.';
    const confirmText = isOnline ? 'Yes, Approve' : 'Yes, Refunded';

    showCustomAlert('Approve Cancellation', message, [
      { text: 'Not Yet', style: 'cancel' },
      { text: confirmText, onPress: async () => {
        setApprovingBookingId(booking._id);
        const res = await dispatch(approveCancellation(booking._id));
        if (approveCancellation.fulfilled.match(res)) {
          showCustomAlert('Success', 'Cancellation approved successfully.');
          fetchBookings();
          dispatch(fetchOwnerDashboard());
        } else {
          showCustomAlert('Error', res.payload || 'Failed to approve cancellation');
        }
        setApprovingBookingId(null);
      }}
    ]);
  };

  const handleRejectCancel = (booking) => {
    setActionBooking(booking);
    setRejectCancelReason('');
    setRejectCancelModalVisible(true);
  };

  const submitRejectCancel = async () => {
    if (!rejectCancelReason.trim()) {
      return showCustomAlert('Error', 'Please provide a rejection reason');
    }
    setCancelRejecting(true);
    try {
      const res = await dispatch(rejectCancellation({ bookingId: actionBooking._id, reason: rejectCancelReason }));
      if (rejectCancellation.fulfilled.match(res)) {
        showCustomAlert('Success', 'Cancellation rejected. The booking is restored to confirmed status.');
        fetchBookings();
        dispatch(fetchOwnerDashboard());
      } else {
        showCustomAlert('Error', res.payload || 'Failed to reject cancellation');
      }
      setRejectCancelModalVisible(false);
    } finally {
      setCancelRejecting(false);
    }
  };

  const renderBookingCard = ({ item }) => {
    const slots = item.slotsSnapshot || [];
    const dateStr = slots[0]?.date ? formatISTDate(slots[0].date) : 'N/A';
    const statusCfg = getStatusConfig(item.status);
    
    return (
      <View style={[styles.bookingCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {/* Accent Bar */}
        <View style={[styles.cardAccentBar, { backgroundColor: statusCfg.color }]} />

        <View style={styles.cardContentContainer}>
          {/* Card Header: User Info & Status */}
          <View style={styles.cardHeader}>
            <View style={styles.userInfo}>
              {item.user?.photo ? (
                <Image source={{ uri: getImageUrl(item.user.photo) }} style={styles.userAvatar} />
              ) : (
                <View style={[styles.userAvatarPlaceholder, { backgroundColor: isDark ? colors.background : colors.surfaceVariant }]}>
                  <Text style={[styles.avatarInitial, { color: colors.primary }]}>
                    {item.user?.name?.[0]?.toUpperCase() || 'U'}
                  </Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={[styles.userName, { color: colors.textPrimary }]} numberOfLines={1}>
                  {item.user?.name || 'Unknown User'}
                </Text>
                <Text style={[styles.bookingId, { color: colors.textTertiary }]}>
                  ID: #{item.bookingRef || 'N/A'}
                </Text>
              </View>
            </View>

            <View style={[styles.statusBadge, { borderColor: `${statusCfg.color}40`, backgroundColor: `${statusCfg.color}15` }]}>
              <Icon name={statusCfg.icon} size={12} color={statusCfg.color} style={{ marginRight: 4 }} />
              <Text style={[styles.statusText, { color: statusCfg.color }]}>
                {statusCfg.label}
              </Text>
            </View>
          </View>

          {/* Schedule Info Box */}
          <View style={[styles.scheduleBox, { backgroundColor: isDark ? colors.background : colors.surfaceVariant, borderColor: colors.border }]}>
            <View style={styles.detailRow}>
              <Icon name="calendar-month-outline" size={15} color={colors.primary} style={{ marginRight: 6 }} />
              <Text style={[styles.detailText, { color: colors.textPrimary }]}>{dateStr}</Text>
            </View>
            
            <View style={styles.slotsRow}>
              <Icon name="clock-outline" size={15} color={colors.primary} style={{ marginRight: 6, marginTop: 2 }} />
              <View style={styles.slotsList}>
                {slots.map((slot, idx) => (
                  <View key={idx} style={[styles.slotPill, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Text style={[styles.slotPillText, { color: colors.textPrimary }]}>
                      {formatISTTime(slot.startTime)} – {formatISTTime(slot.endTime)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </View>

          {/* Card Footer: Payment Info & Actions */}
          <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
            <View>
              <Text style={[styles.footerLabel, { color: colors.textSecondary }]}>Total Amount</Text>
              <Text style={[styles.amountText, { color: colors.primary }]}>₹{item.totalAmount || item.finalAmount}</Text>
            </View>

            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[styles.footerLabel, { color: colors.textSecondary }]}>Payment Mode</Text>
              <Text style={[styles.paymentMethod, { color: colors.textPrimary }]}>
                {(() => {
                  if (!item.payment) return 'Offline / Walk-in';
                  if (['qr_upi', 'wallet', 'razorpay', 'phonepe'].includes(item.payment.method)) {
                    if (item.payment.status === 'screenshot_uploaded') return 'Pending Verification';
                    return 'Online (Paid via App)';
                  }
                  return 'Offline / Pay at Turf';
                })()}
              </Text>
            </View>
          </View>

          {/* Action Row */}
          {item.payment?.status === 'screenshot_uploaded' && item.status !== 'cancellation_requested' && (
            <TouchableOpacity 
              style={[styles.verifyBtn, { backgroundColor: colors.primary }]} 
              onPress={() => handleVerify(item)}
              activeOpacity={0.8}
            >
              <Icon name="file-document-outline" size={15} color="#000" style={{ marginRight: 4 }} />
              <Text style={styles.verifyBtnText}>Verify Payment Screenshot</Text>
            </TouchableOpacity>
          )}

          {item.status === 'cancellation_requested' && (
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              <TouchableOpacity 
                style={[styles.actionBtn, { flex: 1, backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.error }]} 
                onPress={() => handleRejectCancel(item)}
                activeOpacity={0.8}
              >
                <Text style={[styles.actionBtnText, { color: colors.error }]}>Reject Request</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.actionBtn, { flex: 1, backgroundColor: '#FF5722' }]} 
                onPress={() => handleApproveCancel(item)}
                disabled={approvingBookingId === item._id}
                activeOpacity={0.8}
              >
                {approvingBookingId === item._id ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <Text style={[styles.actionBtnText, { color: '#FFF' }]}>Approve Refund</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity 
            style={[styles.reportIssueBtn, { borderTopColor: colors.border }]}
            onPress={() => navigation.navigate('CreateTicketScreen', { bookingId: item.bookingRef })}
            activeOpacity={0.75}
          >
            <Icon name="alert-circle-outline" size={14} color={colors.textSecondary} style={{ marginRight: 4 }} />
            <Text style={[styles.reportIssueText, { color: colors.textSecondary }]}>Report Issue</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.surface} />
      
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: insets.top + 16, backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>All Bookings</Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
            {bookings.length} booking{bookings.length !== 1 ? 's' : ''} shown
          </Text>
        </View>
        {turfs.length > 1 ? (
          <TouchableOpacity 
            style={[styles.headerDropdown, { backgroundColor: isDark ? colors.background : colors.surfaceVariant, borderColor: colors.border }]} 
            onPress={() => setTurfModalVisible(true)}
            activeOpacity={0.8}
          >
            <Text style={[styles.headerDropdownText, { color: colors.primary }]} numberOfLines={1}>
              {selectedTurf === 'all' ? 'All Turfs' : (turfs.find(t => t._id === selectedTurf)?.name || 'Select Ground')}
            </Text>
            <Icon name="chevron-down" size={18} color={colors.primary} />
          </TouchableOpacity>
        ) : (
          turfs.length === 1 && (
            <View style={[styles.singleTurfBadge, { backgroundColor: colors.primaryAlpha10, borderColor: colors.primary }]}>
              <Icon name="soccer-field" size={14} color={colors.primary} style={{ marginRight: 4 }} />
              <Text style={[styles.singleTurfText, { color: colors.primary }]}>
                {turfs[0].name}
              </Text>
            </View>
          )
        )}
      </View>

      {/* ── Search and Filter Inputs ────────────────────────────────────── */}
      <View style={[styles.filterContainer, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={[styles.searchInputContainer, { backgroundColor: isDark ? colors.background : colors.surfaceVariant, borderColor: colors.border }]}>
          <Icon name="magnify" size={18} color={colors.textTertiary} />
          <TextInput
            style={[styles.searchInput, { color: colors.textPrimary }]}
            placeholder="Search Name or ID..."
            placeholderTextColor={colors.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Icon name="close-circle" size={16} color={colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity 
          style={[styles.dateInputContainer, { backgroundColor: isDark ? colors.background : colors.surfaceVariant, borderColor: colors.border }]} 
          onPress={() => setShowCalendar(true)}
          activeOpacity={0.8}
        >
          <Icon name="calendar-month-outline" size={18} color={colors.primary} />
          <Text style={[styles.dateInputText, { color: dateFilter ? colors.textPrimary : colors.textTertiary }]} numberOfLines={1}>
            {dateFilter || 'DD/MM/YYYY'}
          </Text>
          {dateFilter.length > 0 && (
            <TouchableOpacity onPress={(e) => { e.stopPropagation(); setDateFilter(''); }}>
              <Icon name="close-circle" size={16} color={colors.textTertiary} />
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Tabs Bar ────────────────────────────────────────────────────── */}
      <View style={[styles.tabsWrapper, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <ScrollView 
          ref={topTabsRef}
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsContainer}
        >
          {TABS.map((tab) => {
            const isActive = statusFilter === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                style={[styles.tabButton, isActive && [styles.tabButtonActive, { borderBottomColor: colors.primary }]]}
                onPress={() => setStatusFilter(tab.id)}
                activeOpacity={0.8}
              >
                <Icon 
                  name={tab.icon} 
                  size={15} 
                  color={isActive ? colors.primary : colors.textSecondary} 
                  style={{ marginRight: 5 }} 
                />
                <Text style={[styles.tabText, { color: colors.textSecondary }, isActive && [styles.tabTextActive, { color: colors.primary }]]}>
                  {tab.label}
                </Text>
                {tab.id === 'Cancel Req' && pendingCancellationsCount > 0 && (
                  <View style={[styles.tabBadge, { backgroundColor: colors.error }]}>
                    <Text style={styles.tabBadgeText}>{pendingCancellationsCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── Bookings List ───────────────────────────────────────────────── */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={(item) => item._id}
          renderItem={renderBookingCard}
          contentContainerStyle={styles.listContainer}
          refreshing={refreshing}
          onRefresh={onRefresh}
          onEndReached={() => {
            if (hasMore && !loadingMore && !loading) {
              fetchBookings(page + 1, false);
            }
          }}
          onEndReachedThreshold={0.5}
          ListFooterComponent={() => (
            loadingMore ? (
              <View style={{ paddingVertical: 16, alignItems: 'center' }}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : null
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={[styles.emptyIconCircle, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.surfaceVariant }]}>
                <Icon name="text-box-remove-outline" size={44} color={colors.primary} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No Bookings Found</Text>
              <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
                {searchQuery || dateFilter || statusFilter !== 'All'
                  ? 'Try clearing your filters or search query.'
                  : 'No bookings have been made yet.'}
              </Text>
            </View>
          }
        />
      )}

      {/* ── Turf Selector Modal ────────────────────────────────────────────── */}
      <Modal visible={turfModalVisible} transparent animationType="fade" onRequestClose={() => setTurfModalVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setTurfModalVisible(false)}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Select Ground</Text>
            <TouchableOpacity 
              style={[styles.turfOption, selectedTurf === 'all' && [styles.turfOptionActive, { backgroundColor: colors.primaryAlpha10 }]]}
              onPress={() => { setSelectedTurf('all'); setTurfModalVisible(false); }}
            >
              <Text style={[styles.turfOptionText, { color: colors.textSecondary }, selectedTurf === 'all' && [styles.turfOptionTextActive, { color: colors.primary }]]}>
                All Turfs
              </Text>
              {selectedTurf === 'all' && <Icon name="check" size={20} color={colors.primary} />}
            </TouchableOpacity>
            {turfs.map(t => (
              <TouchableOpacity 
                key={t._id}
                style={[styles.turfOption, selectedTurf === t._id && [styles.turfOptionActive, { backgroundColor: colors.primaryAlpha10 }]]}
                onPress={() => { setSelectedTurf(t._id); setTurfModalVisible(false); }}
              >
                <Text style={[styles.turfOptionText, { color: colors.textSecondary }, selectedTurf === t._id && [styles.turfOptionTextActive, { color: colors.primary }]]}>
                  {t.name}
                </Text>
                {selectedTurf === t._id && <Icon name="check" size={20} color={colors.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Payment Verification Modal ──────────────────────────────────── */}
      <Modal visible={verifyModalVisible} transparent animationType="slide" onRequestClose={() => setVerifyModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Verify Screenshot</Text>
              <TouchableOpacity onPress={() => setVerifyModalVisible(false)}>
                <Icon name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.modalSubTitle, { color: colors.textSecondary }]}>
              User uploaded a payment screenshot for Ref: #{verifyingBooking?.bookingRef}
            </Text>

            <ScrollView style={{ maxHeight: 350 }}>
              {verifyingBooking?.payment?.screenshotUrl ? (
                <Image 
                  source={{ uri: getImageUrl(verifyingBooking.payment.screenshotUrl) }} 
                  style={styles.screenshotImage}
                  resizeMode="contain"
                />
              ) : (
                <View style={[styles.noScreenshot, { backgroundColor: colors.surfaceVariant }]}>
                  <Icon name="image-off-outline" size={40} color={colors.textTertiary} />
                  <Text style={{ color: colors.textTertiary, marginTop: 8 }}>No screenshot available</Text>
                </View>
              )}

              <Text style={{ color: colors.textPrimary, fontFamily: Typography.fontFamily.semiBold, marginBottom: 8 }}>
                Rejection Reason (if rejecting):
              </Text>
              <TextInput
                style={[styles.rejectInput, { backgroundColor: isDark ? colors.background : colors.surfaceVariant, color: colors.textPrimary, borderColor: colors.border }]}
                placeholder="e.g. Invalid UTR, Fake Screenshot..."
                placeholderTextColor={colors.textTertiary}
                value={rejectReason}
                onChangeText={setRejectReason}
              />
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[styles.modalBtn, styles.rejectBtn, { borderColor: colors.error }]} 
                onPress={() => submitVerify(false)}
                disabled={verifying}
              >
                <Text style={styles.rejectBtnText}>Reject Payment</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalBtn, styles.approveBtn, { backgroundColor: colors.primary }]} 
                onPress={() => submitVerify(true)}
                disabled={verifying}
              >
                {verifying ? (
                  <ActivityIndicator color="#000" size="small" />
                ) : (
                  <Text style={styles.approveBtnText}>Approve & Confirm</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Reject Cancellation Modal ───────────────────────────────────── */}
      <Modal visible={rejectCancelModalVisible} transparent animationType="slide" onRequestClose={() => setRejectCancelModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Reject Cancellation</Text>
              <TouchableOpacity onPress={() => setRejectCancelModalVisible(false)}>
                <Icon name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.modalSubTitle, { color: colors.textSecondary }]}>
              Please state why you are rejecting the cancellation for Ref: #{actionBooking?.bookingRef}
            </Text>

            <TextInput
              style={[styles.rejectInput, { backgroundColor: isDark ? colors.background : colors.surfaceVariant, color: colors.textPrimary, borderColor: colors.border }]}
              placeholder="e.g. Request made too close to match time..."
              placeholderTextColor={colors.textTertiary}
              value={rejectCancelReason}
              onChangeText={setRejectCancelReason}
              multiline
              numberOfLines={3}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[styles.modalBtn, { backgroundColor: colors.surfaceVariant, borderWidth: 1, borderColor: colors.border }]} 
                onPress={() => setRejectCancelModalVisible(false)}
              >
                <Text style={{ color: colors.textPrimary, fontFamily: Typography.fontFamily.bold }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalBtn, { backgroundColor: colors.error }]} 
                onPress={submitRejectCancel}
                disabled={cancelRejecting}
              >
                {cancelRejecting ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <Text style={{ color: '#FFF', fontFamily: Typography.fontFamily.bold }}>Reject Cancellation</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Custom Calendar Picker Overlay ──────────────────────────────── */}
      {showCalendar && (
        <View style={styles.calendarOverlay}>
          <View style={[styles.calendarContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.calendarHeader}>
              <TouchableOpacity onPress={() => setCalendarMonth(moment(calendarMonth).subtract(1, 'month'))}>
                <Icon name="chevron-left" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
              <Text style={[styles.calendarTitle, { color: colors.textPrimary }]}>{calendarMonth.format('MMMM YYYY')}</Text>
              <TouchableOpacity onPress={() => setCalendarMonth(moment(calendarMonth).add(1, 'month'))}>
                <Icon name="chevron-right" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <View style={styles.calendarGrid}>
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                <Text key={i} style={[styles.dayOfWeek, { color: colors.textSecondary }]}>{d}</Text>
              ))}

              {(() => {
                const daysInMonth = calendarMonth.daysInMonth();
                const startDay = moment(calendarMonth).startOf('month').day();
                const days = [];

                for (let i = 0; i < startDay; i++) {
                  days.push(<View key={`empty-${i}`} style={styles.calDay} />);
                }

                for (let i = 1; i <= daysInMonth; i++) {
                  const dayObj = moment(calendarMonth).date(i);
                  const formattedStr = dayObj.format('DD/MM/YYYY');
                  const isSelected = dateFilter === formattedStr;

                  days.push(
                    <TouchableOpacity
                      key={`day-${i}`}
                      style={[styles.calDay, isSelected && [styles.calDaySel, { backgroundColor: colors.primary }]]}
                      onPress={() => {
                        setDateFilter(formattedStr);
                        setShowCalendar(false);
                      }}
                    >
                      <Text style={[styles.calDayText, { color: colors.textPrimary }, isSelected && { color: '#000', fontFamily: Typography.fontFamily.bold }]}>
                        {i}
                      </Text>
                    </TouchableOpacity>
                  );
                }

                return days;
              })()}
            </View>

            <TouchableOpacity style={[styles.closeModalBtn, { backgroundColor: colors.surfaceVariant }]} onPress={() => setShowCalendar(false)}>
              <Text style={[styles.closeModalText, { color: colors.textPrimary }]}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

const createStyles = (colors, isDark, shadows) => StyleSheet.create({
  container: { flex: 1 },
  header: { 
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 22, fontFamily: Typography.fontFamily.bold },
  headerSubtitle: { fontSize: 12, fontFamily: Typography.fontFamily.regular, marginTop: 2 },
  headerDropdown: { 
    flexDirection: 'row', alignItems: 'center', 
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, maxWidth: '55%' 
  },
  headerDropdownText: { fontSize: 13, fontFamily: Typography.fontFamily.bold, marginRight: 4, maxWidth: '85%' },
  singleTurfBadge: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1
  },
  singleTurfText: { fontSize: 12, fontFamily: Typography.fontFamily.bold },

  filterContainer: { 
    flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingVertical: 12, 
    borderBottomWidth: 1,
  },
  searchInputContainer: { 
    flex: 1, flexDirection: 'row', alignItems: 'center', 
    borderRadius: 12, paddingHorizontal: 12, height: 44, borderWidth: 1 
  },
  dateInputContainer: { 
    flex: 1, flexDirection: 'row', alignItems: 'center', 
    borderRadius: 12, paddingHorizontal: 12, height: 44, borderWidth: 1 
  },
  searchInput: { flex: 1, fontFamily: Typography.fontFamily.regular, marginLeft: 8, fontSize: 13 },
  dateInputText: { flex: 1, fontFamily: Typography.fontFamily.medium, marginLeft: 8, fontSize: 13 },

  tabsWrapper: {
    borderBottomWidth: 1,
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 8,
  },
  tabButton: {
    paddingHorizontal: 16,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    flexDirection: 'row',
  },
  tabButtonActive: {},
  tabText: {
    fontSize: 13,
    fontFamily: Typography.fontFamily.medium,
  },
  tabTextActive: {
    fontFamily: Typography.fontFamily.bold,
  },
  tabBadge: {
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 5,
    paddingHorizontal: 5,
  },
  tabBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontFamily: Typography.fontFamily.bold,
  },

  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40 },
  listContainer: { padding: 16, paddingBottom: 100 },
  
  bookingCard: { 
    borderRadius: 16, 
    borderWidth: 1, 
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  cardAccentBar: {
    height: 4,
    width: '100%',
  },
  cardContentContainer: {
    padding: 16,
  },
  cardHeader: { 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', 
    marginBottom: 12,
  },
  userInfo: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 },
  userAvatar: { width: 42, height: 42, borderRadius: 21, marginRight: 12 },
  userAvatarPlaceholder: { width: 42, height: 42, borderRadius: 21, marginRight: 12, justifyContent: 'center', alignItems: 'center' },
  avatarInitial: { fontSize: 18, fontFamily: Typography.fontFamily.bold },
  userName: { fontFamily: Typography.fontFamily.bold, fontSize: 16 },
  bookingId: { fontFamily: Typography.fontFamily.regular, fontSize: 12, marginTop: 1 },
  
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  statusText: { fontSize: 10, fontFamily: Typography.fontFamily.bold },

  scheduleBox: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
  },
  detailRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  detailText: { fontFamily: Typography.fontFamily.semiBold, fontSize: 13 },
  
  slotsRow: { flexDirection: 'row', alignItems: 'flex-start' },
  slotsList: { flexDirection: 'row', flexWrap: 'wrap', flex: 1, gap: 6 },
  slotPill: { 
    paddingHorizontal: 9, paddingVertical: 4, 
    borderRadius: 8, borderWidth: 1 
  },
  slotPillText: {
    fontSize: 12, fontFamily: Typography.fontFamily.medium,
  },

  cardFooter: { 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', 
    borderTopWidth: 1, paddingTop: 12, marginBottom: 8,
  },
  footerLabel: { fontFamily: Typography.fontFamily.regular, fontSize: 11, marginBottom: 2 },
  amountText: { fontFamily: Typography.fontFamily.bold, fontSize: 18 },
  paymentMethod: { fontFamily: Typography.fontFamily.bold, fontSize: 13 },
  
  verifyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 10, marginTop: 8 },
  verifyBtnText: { color: '#000', fontFamily: Typography.fontFamily.bold, fontSize: 13 },

  actionBtn: { paddingVertical: 9, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  actionBtnText: { fontSize: 13, fontFamily: Typography.fontFamily.bold },
  
  reportIssueBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingTop: 10, marginTop: 4, borderTopWidth: 1 },
  reportIssueText: { fontFamily: Typography.fontFamily.semiBold, fontSize: 12 },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 20 },
  modalContent: { borderRadius: 16, padding: 20, maxHeight: '85%', borderWidth: 1 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 20, fontFamily: Typography.fontFamily.bold },
  modalSubTitle: { fontFamily: Typography.fontFamily.medium, fontSize: 13, marginBottom: 16 },
  screenshotImage: { width: '100%', height: 300, borderRadius: 12, backgroundColor: '#000', marginBottom: 16 },
  noScreenshot: { width: '100%', height: 200, justifyContent: 'center', alignItems: 'center', borderRadius: 12, marginBottom: 16 },
  rejectInput: { 
    padding: 12, borderRadius: 10, fontFamily: Typography.fontFamily.regular, 
    marginBottom: 20, borderWidth: 1, fontSize: 14,
  },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  rejectBtn: { backgroundColor: 'transparent', borderWidth: 1 },
  rejectBtnText: { color: colors.error, fontFamily: Typography.fontFamily.bold, fontSize: 14 },
  approveBtn: {},
  approveBtnText: { color: '#000', fontFamily: Typography.fontFamily.bold, fontSize: 14 },
  
  calendarOverlay: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', zIndex: 100 },
  calendarContent: { width: '88%', borderRadius: 20, padding: 20, borderWidth: 1 },
  calendarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  calendarTitle: { fontSize: 16, fontFamily: Typography.fontFamily.bold },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayOfWeek: { width: '14.28%', textAlign: 'center', marginBottom: 12, fontFamily: Typography.fontFamily.bold, fontSize: 12 },
  calDay: { width: '14.28%', aspectRatio: 1, justifyContent: 'center', alignItems: 'center', marginBottom: 4, borderRadius: 20 },
  calDaySel: {},
  calDayText: { fontFamily: Typography.fontFamily.medium, fontSize: 13 },
  closeModalBtn: { marginTop: 16, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  closeModalText: { fontFamily: Typography.fontFamily.bold, fontSize: 14 },

  turfOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 12, borderBottomWidth: 1 },
  turfOptionActive: { borderRadius: 10 },
  turfOptionText: { fontFamily: Typography.fontFamily.medium, fontSize: 15 },
  turfOptionTextActive: { fontFamily: Typography.fontFamily.bold },

  emptyContainer: { alignItems: 'center', justifyContent: 'center', padding: 32, marginTop: 40 },
  emptyIconCircle: { width: 88, height: 88, borderRadius: 44, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontFamily: Typography.fontFamily.bold, marginBottom: 6 },
  emptySub: { fontSize: 13, fontFamily: Typography.fontFamily.regular, textAlign: 'center', lineHeight: 18 },
});

export default OwnerBookingsScreen;
