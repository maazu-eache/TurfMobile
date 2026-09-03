import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Image, Modal, TextInput, ScrollView, Dimensions, StatusBar } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useFocusEffect } from '@react-navigation/native';
import { useSelector, useDispatch } from 'react-redux';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Typography, Spacing, BorderRadius } from '../../../theme/theme';
import { useTheme } from '../../../theme/ThemeContext';
import api, { getImageUrl } from '../../../api/axios';
import { formatISTDate, formatISTTime } from '../../../utils/dateFormatter';
import moment from 'moment';
import { confirmBookingPayment, rejectBookingPayment, approveCancellation, rejectCancellation, fetchOwnerDashboard } from '../ownerSlice';
import { showCustomAlert } from '../../../components/CustomAlert';

const SCREEN_WIDTH = Dimensions.get('window').width;
const TABS = ['All', 'Confirmed', 'Completed', 'Cancel Req', 'Cancelled'];

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

  const scrollViewRef = useRef(null);
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

  useFocusEffect(
    useCallback(() => {
      // Intentionally left blank, relying on standard fetch
    }, [selectedTurf, page])
  );

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
          // Prevent duplicates if backend returns overlapping items
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
    fetchBookings();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'confirmed': return isDark ? '#FFD400' : colors.primaryDark;
      case 'pending': return colors.warning;
      case 'cancellation_requested': return '#FF5722';
      case 'cancelled': return colors.error;
      case 'completed': return '#2196F3';
      default: return colors.textSecondary;
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
    const statusColor = getStatusColor(item.status);
    
    return (
      <View style={styles.bookingCard}>
        <View style={styles.cardHeader}>
          <View style={styles.userInfo}>
            {item.user?.photo ? (
              <Image source={{ uri: getImageUrl(item.user.photo) }} style={styles.userAvatar} />
            ) : (
              <View style={styles.userAvatarPlaceholder}>
                <Icon name="account" size={24} color={colors.textTertiary} />
              </View>
            )}
            <View>
              <Text style={styles.userName}>{item.user?.name || 'Unknown User'}</Text>
              <Text style={styles.bookingId}>ID: {item.bookingRef}</Text>
            </View>
          </View>
          <View style={[styles.statusBadge, { borderColor: statusColor, backgroundColor: statusColor + '18' }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>
              {item.status === 'cancellation_requested' ? 'CANCEL REQ.' : (item.status?.toUpperCase() || 'UNKNOWN')}
            </Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.detailRow}>
            <Icon name="calendar" size={16} color={isDark ? '#FFD400' : colors.primaryDark} />
            <Text style={styles.detailText}>{dateStr}</Text>
          </View>
          
          <View style={styles.slotsRow}>
            <Icon name="clock-outline" size={16} color={isDark ? '#FFD400' : colors.primaryDark} style={{marginTop: 2}} />
            <View style={styles.slotsList}>
              {slots.map((slot, idx) => (
                <Text key={idx} style={styles.slotPill}>
                  {formatISTTime(slot.startTime)} - {formatISTTime(slot.endTime)}
                </Text>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <View>
            <Text style={styles.footerLabel}>Total Amount</Text>
            <Text style={styles.amountText}>₹{item.totalAmount || item.finalAmount}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.footerLabel}>Payment Mode</Text>
            <Text style={styles.paymentMethod}>
              {(() => {
                if (!item.payment) return 'Offline / Walk-in';
                if (['qr_upi', 'wallet', 'razorpay', 'phonepe'].includes(item.payment.method)) {
                  if (item.payment.status === 'screenshot_uploaded') return 'Pending Verification';
                  return 'Online (Paid via App)';
                }
                return 'Offline / Pay at Turf';
              })()}
            </Text>
            {item.payment?.status === 'screenshot_uploaded' && item.status !== 'cancellation_requested' && (
              <TouchableOpacity style={styles.verifyBtn} onPress={() => handleVerify(item)}>
                <Text style={styles.verifyBtnText}>Verify Screenshot</Text>
              </TouchableOpacity>
            )}
            {item.status === 'cancellation_requested' && (
              <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
                <TouchableOpacity style={[styles.verifyBtn, { backgroundColor: colors.surfaceVariant, borderWidth: 1, borderColor: colors.error }]} onPress={() => handleRejectCancel(item)}>
                  <Text style={[styles.verifyBtnText, { color: colors.error }]}>Reject</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.verifyBtn, { backgroundColor: '#FF5722' }]} 
                  onPress={() => handleApproveCancel(item)}
                  disabled={approvingBookingId === item._id}
                >
                  {approvingBookingId === item._id ? (
                    <ActivityIndicator color="#FFF" size="small" />
                  ) : (
                    <Text style={[styles.verifyBtnText, { color: '#FFF' }]}>Approve Refund</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
        
        <TouchableOpacity 
          style={styles.reportIssueBtn}
          onPress={() => navigation.navigate('CreateTicketScreen', { bookingId: item.bookingRef })}
        >
          <Text style={styles.reportIssueText}>Report Issue</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.surface} />
      
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.headerTitle}>All Bookings</Text>
        {turfs.length > 1 ? (
          <TouchableOpacity style={styles.headerDropdown} onPress={() => setTurfModalVisible(true)}>
            <Text style={styles.headerDropdownText} numberOfLines={1}>
              {selectedTurf === 'all' ? 'All Turfs' : (turfs.find(t => t._id === selectedTurf)?.name || 'Select Ground')}
            </Text>
            <Icon name="chevron-down" size={20} color={isDark ? '#FFD400' : colors.primaryDark} style={{marginLeft: 4}} />
          </TouchableOpacity>
        ) : (
          turfs.length === 1 && (
            <Text style={{ fontSize: 13, fontFamily: Typography.fontFamily.bold, color: isDark ? '#FFD400' : colors.primaryDark }}>
              {turfs[0].name}
            </Text>
          )
        )}
      </View>

      {/* ── Search and Filter Inputs ────────────────────────────────────── */}
      <View style={styles.filterContainer}>
        <View style={styles.searchInputContainer}>
          <Icon name="magnify" size={20} color={colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
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

        <TouchableOpacity style={styles.dateInputContainer} onPress={() => setShowCalendar(true)}>
          <Icon name="calendar-month" size={20} color={colors.textTertiary} />
          <Text style={[styles.searchInput, { color: dateFilter ? colors.textPrimary : colors.textTertiary, marginTop: 10 }]}>
            {dateFilter || 'DD/MM/YYYY'}
          </Text>
          {dateFilter.length > 0 && (
            <TouchableOpacity onPress={() => setDateFilter('')}>
              <Icon name="close-circle" size={16} color={colors.textTertiary} />
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Tabs Bar ────────────────────────────────────────────────────── */}
      <View style={styles.tabsWrapper}>
        <ScrollView 
          ref={topTabsRef}
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsContainer}
        >
          {TABS.map((tab) => {
            const isActive = statusFilter === tab;
            return (
              <TouchableOpacity
                key={tab}
                style={[styles.tabButton, isActive && styles.tabButtonActive]}
                onPress={() => setStatusFilter(tab)}
              >
                <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                  {tab}
                </Text>
                {tab === 'Cancel Req' && pendingCancellationsCount > 0 && (
                  <View style={styles.tabBadge}>
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
              <View style={{ paddingVertical: 20 }}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : null
          )}
          ListEmptyComponent={
            <View style={styles.centerContainer}>
              <Icon name="calendar-remove" size={48} color={colors.textTertiary} />
              <Text style={styles.emptyText}>No bookings found</Text>
            </View>
          }
        />
      )}

      {/* ── Payment Verification Modal ───────────────────────────────────── */}
      <Modal visible={verifyModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Verify Payment</Text>
              <TouchableOpacity onPress={() => setVerifyModalVisible(false)}>
                <Icon name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubTitle}>Review the payment screenshot before confirming the booking.</Text>
            
            <KeyboardAwareScrollView>
              {verifyingBooking?.payment?.screenshot ? (
                <Image 
                  source={{ uri: getImageUrl(verifyingBooking.payment.screenshot) }} 
                  style={styles.screenshotImage} 
                  resizeMode="contain" 
                />
              ) : (
                <View style={styles.noScreenshot}>
                  <Text style={{ color: colors.textTertiary, fontFamily: Typography.fontFamily.medium }}>No screenshot provided</Text>
                </View>
              )}

              <TextInput
                style={styles.rejectInput}
                placeholder="Reason for rejection (Optional if approving)..."
                placeholderTextColor={colors.textTertiary}
                value={rejectReason}
                onChangeText={setRejectReason}
              />

              <View style={styles.modalActions}>
                <TouchableOpacity 
                  style={[styles.modalBtn, styles.rejectBtn]} 
                  onPress={() => submitVerify(false)}
                  disabled={verifying}
                >
                  {verifying ? <ActivityIndicator color={colors.error} /> : <Text style={styles.rejectBtnText}>Reject Payment</Text>}
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.modalBtn, styles.approveBtn]} 
                  onPress={() => submitVerify(true)}
                  disabled={verifying}
                >
                  {verifying ? <ActivityIndicator color="#000" /> : <Text style={styles.approveBtnText}>Approve & Confirm</Text>}
                </TouchableOpacity>
              </View>
            </KeyboardAwareScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Reject Cancellation Modal ────────────────────────────────────── */}
      <Modal visible={rejectCancelModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Reject Cancellation</Text>
              <TouchableOpacity onPress={() => setRejectCancelModalVisible(false)}>
                <Icon name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubTitle}>Provide a reason to the user for rejecting their cancellation request.</Text>
            
            <TextInput
              style={[styles.rejectInput, { minHeight: 80, textAlignVertical: 'top' }]}
              placeholder="e.g. Ground is ready, cancellation policy expired..."
              placeholderTextColor={colors.textTertiary}
              value={rejectCancelReason}
              onChangeText={setRejectCancelReason}
              multiline
            />

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[styles.modalBtn, { backgroundColor: colors.surfaceVariant }]} 
                onPress={() => setRejectCancelModalVisible(false)}
              >
                <Text style={{ color: colors.textPrimary, fontFamily: Typography.fontFamily.bold }}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.modalBtn, { backgroundColor: colors.error }]} 
                onPress={submitRejectCancel}
                disabled={cancelRejecting}
              >
                {cancelRejecting ? <ActivityIndicator color="#FFF" /> : <Text style={{ color: '#FFF', fontFamily: Typography.fontFamily.bold }}>Reject Request</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Turf Selection Modal ─────────────────────────────────────────── */}
      <Modal visible={turfModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Turf</Text>
              <TouchableOpacity onPress={() => setTurfModalVisible(false)}>
                <Icon name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 300 }}>
              <TouchableOpacity 
                style={[styles.turfOption, selectedTurf === 'all' && styles.turfOptionActive]}
                onPress={() => {
                  setSelectedTurf('all');
                  setTurfModalVisible(false);
                }}
              >
                <Text style={[styles.turfOptionText, selectedTurf === 'all' && styles.turfOptionTextActive]}>
                  All Turfs
                </Text>
                {selectedTurf === 'all' && <Icon name="check-circle" size={24} color={isDark ? '#FFD400' : colors.primaryDark} />}
              </TouchableOpacity>
              {turfs.map(t => (
                <TouchableOpacity 
                  key={t._id} 
                  style={[styles.turfOption, selectedTurf === t._id && styles.turfOptionActive]}
                  onPress={() => {
                    setSelectedTurf(t._id);
                    setTurfModalVisible(false);
                  }}
                >
                  <Text style={[styles.turfOptionText, selectedTurf === t._id && styles.turfOptionTextActive]}>
                    {t.name}
                  </Text>
                  {selectedTurf === t._id && <Icon name="check-circle" size={24} color={isDark ? '#FFD400' : colors.primaryDark} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Custom Calendar Modal ────────────────────────────────────────── */}
      {showCalendar && (
        <View style={styles.calendarOverlay}>
          <View style={styles.calendarContent}>
            <View style={styles.calendarHeader}>
              <TouchableOpacity onPress={() => setCalendarMonth(moment(calendarMonth).subtract(1, 'month'))}>
                <Icon name="chevron-left" size={30} color={colors.textPrimary} />
              </TouchableOpacity>
              <Text style={styles.calendarTitle}>{calendarMonth.format('MMMM YYYY')}</Text>
              <TouchableOpacity onPress={() => setCalendarMonth(moment(calendarMonth).add(1, 'month'))}>
                <Icon name="chevron-right" size={30} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.calendarGrid}>
              {['S','M','T','W','T','F','S'].map((d, i) => (
                <Text key={i} style={styles.dayOfWeek}>{d}</Text>
              ))}
              {(() => {
                const startDay = moment(calendarMonth).startOf('month').day();
                const daysInMonth = moment(calendarMonth).daysInMonth();
                const grid = [];
                for(let i=0; i<startDay; i++) grid.push(<View key={`empty-${i}`} style={styles.calDay} />);
                for(let i=1; i<=daysInMonth; i++) {
                  const d = moment(calendarMonth).date(i);
                  const dStr = d.format('DD/MM/YYYY');
                  const isSel = dateFilter === dStr;
                  return (
                    grid.push(
                      <TouchableOpacity 
                        key={`day-${i}`} 
                        style={[styles.calDay, isSel && styles.calDaySel]}
                        onPress={() => {
                          setDateFilter(dStr);
                          setShowCalendar(false);
                        }}
                      >
                        <Text style={[styles.calDayText, isSel && { color: '#000', fontWeight: 'bold' }]}>{i}</Text>
                      </TouchableOpacity>
                    )
                  );
                }
                return grid;
              })()}
            </View>

            <TouchableOpacity style={styles.closeModalBtn} onPress={() => setShowCalendar(false)}>
              <Text style={styles.closeModalText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

const createStyles = (colors, isDark, shadows) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  filterContainer: { 
    flexDirection: 'row', gap: 12, padding: Spacing.xl, paddingTop: Spacing.md, paddingBottom: Spacing.sm, 
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.borderLight 
  },
  header: { 
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl, paddingBottom: Spacing.lg,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border
  },
  headerTitle: { fontSize: 24, fontFamily: Typography.fontFamily.extraBold, color: colors.textPrimary },
  headerDropdown: { 
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceVariant, 
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 24, borderWidth: 1, borderColor: colors.border, maxWidth: '55%' 
  },
  headerDropdownText: { fontSize: 13, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary, marginRight: 4, maxWidth: '85%' },
  
  turfOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  turfOptionActive: { backgroundColor: colors.primaryAlpha10, borderRadius: BorderRadius.md, borderBottomWidth: 0 },
  turfOptionText: { color: colors.textSecondary, fontFamily: Typography.fontFamily.medium, fontSize: 16 },
  turfOptionTextActive: { color: isDark ? '#FFD400' : colors.primaryDark, fontFamily: Typography.fontFamily.bold },

  tabsWrapper: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tabsContainer: {
    flexDirection: 'row',
  },
  tabButton: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
    flexDirection: 'row',
  },
  tabButtonActive: {
    borderBottomColor: isDark ? '#FFD400' : colors.primaryDark,
  },
  tabText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontFamily: Typography.fontFamily.medium,
  },
  tabTextActive: {
    color: isDark ? '#FFD400' : colors.primaryDark,
    fontFamily: Typography.fontFamily.bold,
  },
  tabBadge: {
    backgroundColor: colors.error,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
    paddingHorizontal: 6,
  },
  tabBadgeText: {
    color: '#FFF',
    fontSize: 11,
    fontFamily: Typography.fontFamily.bold,
  },
  searchInputContainer: { 
    flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceVariant, 
    borderRadius: BorderRadius.md, paddingHorizontal: Spacing.sm, height: 42, borderWidth: 1, borderColor: colors.border, marginRight: Spacing.sm 
  },
  dateInputContainer: { 
    flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceVariant, 
    borderRadius: BorderRadius.md, paddingHorizontal: Spacing.sm, height: 42, borderWidth: 1, borderColor: colors.border 
  },
  searchInput: { flex: 1, color: colors.textPrimary, fontFamily: Typography.fontFamily.regular, marginLeft: Spacing.sm, fontSize: 12 },

  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40 },
  emptyText: { color: colors.textSecondary, fontFamily: Typography.fontFamily.medium, marginTop: Spacing.md, fontSize: 16 },

  listContainer: { padding: Spacing.lg, paddingBottom: 100 },
  
  bookingCard: { 
    backgroundColor: colors.surface, borderRadius: BorderRadius.lg, 
    borderWidth: 1, borderColor: colors.border, marginBottom: Spacing.lg,
    overflow: 'hidden',
    ...(isDark ? {} : shadows.sm)
  },
  cardHeader: { 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', 
    padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderLight 
  },
  userInfo: { flexDirection: 'row', alignItems: 'center' },
  userAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: Spacing.md },
  userAvatarPlaceholder: { width: 40, height: 40, borderRadius: 20, marginRight: Spacing.md, backgroundColor: colors.surfaceVariant, justifyContent: 'center', alignItems: 'center' },
  userName: { color: colors.textPrimary, fontFamily: Typography.fontFamily.bold, fontSize: 16 },
  bookingId: { color: colors.textTertiary, fontFamily: Typography.fontFamily.regular, fontSize: 12 },
  
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, borderWidth: 1 },
  statusText: { fontSize: 10, fontFamily: Typography.fontFamily.bold },

  cardBody: { padding: Spacing.md },
  detailRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm },
  detailText: { color: colors.textSecondary, fontFamily: Typography.fontFamily.medium, marginLeft: Spacing.sm, fontSize: 14 },
  
  slotsRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: Spacing.xs },
  slotsList: { flexDirection: 'row', flexWrap: 'wrap', marginLeft: Spacing.sm, flex: 1, gap: 6 },
  slotPill: { 
    backgroundColor: colors.surfaceVariant, paddingHorizontal: 8, paddingVertical: 4, 
    borderRadius: BorderRadius.sm, color: colors.textPrimary, fontFamily: Typography.fontFamily.medium, 
    fontSize: 12, borderWidth: 1, borderColor: colors.border 
  },

  cardFooter: { 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', 
    padding: Spacing.md, backgroundColor: colors.surfaceVariant, borderTopWidth: 1, borderTopColor: colors.borderLight 
  },
  footerLabel: { color: colors.textTertiary, fontFamily: Typography.fontFamily.medium, fontSize: 12, marginBottom: 2 },
  amountText: { color: isDark ? '#FFD400' : colors.primaryDark, fontFamily: Typography.fontFamily.bold, fontSize: 18 },
  paymentMethod: { color: colors.textSecondary, fontFamily: Typography.fontFamily.bold, fontSize: 14 },
  
  verifyBtn: { backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, marginTop: 8 },
  verifyBtnText: { color: '#000', fontFamily: Typography.fontFamily.bold, fontSize: 12 },
  
  reportIssueBtn: { backgroundColor: colors.surface, paddingVertical: 12, alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.borderLight },
  reportIssueText: { color: colors.textSecondary, fontFamily: Typography.fontFamily.bold, fontSize: 13 },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: Spacing.xl },
  modalContent: { backgroundColor: colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.xl, maxHeight: '85%', borderWidth: 1, borderColor: colors.border },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  modalTitle: { fontSize: 20, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary },
  modalSubTitle: { color: colors.textSecondary, fontFamily: Typography.fontFamily.medium, marginBottom: Spacing.lg },
  screenshotImage: { width: '100%', height: 300, borderRadius: BorderRadius.md, backgroundColor: '#000', marginBottom: Spacing.lg },
  noScreenshot: { width: '100%', height: 200, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.surfaceVariant, borderRadius: BorderRadius.md, marginBottom: Spacing.lg },
  rejectInput: { 
    backgroundColor: colors.surfaceVariant, color: colors.textPrimary, padding: Spacing.md, 
    borderRadius: BorderRadius.md, fontFamily: Typography.fontFamily.regular, marginBottom: Spacing.xl, 
    borderWidth: 1, borderColor: colors.border 
  },
  modalActions: { flexDirection: 'row', gap: Spacing.md },
  modalBtn: { flex: 1, padding: Spacing.md, borderRadius: BorderRadius.md, alignItems: 'center' },
  rejectBtn: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.error },
  rejectBtnText: { color: colors.error, fontFamily: Typography.fontFamily.bold },
  approveBtn: { backgroundColor: colors.primary },
  approveBtnText: { color: '#000', fontFamily: Typography.fontFamily.bold },
  
  calendarOverlay: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', zIndex: 100 },
  calendarContent: { width: '85%', backgroundColor: colors.surface, borderRadius: BorderRadius.xl, padding: Spacing.xl, borderWidth: 1, borderColor: colors.border },
  calendarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
  calendarTitle: { fontSize: Typography.fontSize.lg, color: colors.textPrimary, fontFamily: Typography.fontFamily.bold },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayOfWeek: { width: '14.28%', textAlign: 'center', color: colors.textSecondary, marginBottom: Spacing.md, fontFamily: Typography.fontFamily.bold },
  calDay: { width: '14.28%', aspectRatio: 1, justifyContent: 'center', alignItems: 'center', marginBottom: 4, borderRadius: 20 },
  calDaySel: { backgroundColor: colors.primary },
  calDayText: { color: colors.textPrimary, fontFamily: Typography.fontFamily.medium },
  closeModalBtn: { marginTop: Spacing.lg, padding: 12, backgroundColor: colors.surfaceVariant, borderRadius: BorderRadius.md, alignItems: 'center' },
  closeModalText: { color: colors.textPrimary, fontFamily: Typography.fontFamily.bold },
});

export default OwnerBookingsScreen;
