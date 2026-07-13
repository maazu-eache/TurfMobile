import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Image, Modal, TextInput } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSelector, useDispatch } from 'react-redux';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors, Typography, Spacing, BorderRadius } from '../../../theme/theme';
import api, { getImageUrl } from '../../../api/axios';
import { formatISTDate, formatISTTime } from '../../../utils/dateFormatter';
import moment from 'moment';
import { confirmBookingPayment, rejectBookingPayment, approveCancellation, fetchOwnerDashboard } from '../ownerSlice';
import { showCustomAlert } from '../../../components/CustomAlert';
import { ScrollView } from 'react-native-gesture-handler';

const OwnerBookingsScreen = ({ navigation, route }) => {
  const { dashboard } = useSelector((state) => state.owner);
  const turfs = dashboard?.owner?.turfs || [];
  
  const dispatch = useDispatch();
  const [selectedTurf, setSelectedTurf] = useState(turfs[0]?._id || null);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  const [verifyModalVisible, setVerifyModalVisible] = useState(false);
  const [verifyingBooking, setVerifyingBooking] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [verifying, setVerifying] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(moment().startOf('month'));

  // Pagination state
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    if (route.params?.turfId) {
      setSelectedTurf(route.params.turfId);
    }
  }, [route.params?.turfId]);

  useFocusEffect(
    useCallback(() => {
      let interval;
      if (selectedTurf) {
        interval = setInterval(() => {
          if (page === 1) {
            fetchBookings(1, false);
          }
        }, 10000); // 10 seconds polling for live updates on page 1
      }
      return () => {
        if (interval) clearInterval(interval);
      };
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
      let url = `/bookings/owner?turfId=${selectedTurf}&page=${pageNum}&limit=10`;
      if (searchQuery) url += `&search=${encodeURIComponent(searchQuery)}`;
      if (dateFilter) {
        const parts = dateFilter.split('/');
        if (parts.length === 3) {
           url += `&date=${parts[2]}-${parts[1]}-${parts[0]}`;
        }
      }
      if (statusFilter !== 'All') {
        const matchTarget = statusFilter === 'Cancellation Requested' ? 'cancellation_requested' : statusFilter.toLowerCase();
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
      case 'confirmed': return Colors.primary;
      case 'pending': return '#FF9800';
      case 'cancellation_requested': return '#FF5722';
      case 'cancelled': return Colors.error;
      case 'completed': return '#2196F3';
      default: return Colors.textSecondary;
    }
  };

  // Filter logic moved to backend, bookings state already holds the paginated filtered results

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
    showCustomAlert('Approve Cancellation', 'Have you refunded the money to the user via UPI? Approving this will free up the turf slots.', [
      { text: 'Not Yet', style: 'cancel' },
      { text: 'Yes, Refunded', onPress: async () => {
        setVerifying(true);
        const res = await dispatch(approveCancellation(booking._id));
        if (approveCancellation.fulfilled.match(res)) {
          showCustomAlert('Success', 'Cancellation approved successfully.');
          fetchBookings();
          dispatch(fetchOwnerDashboard());
        } else {
          showCustomAlert('Error', res.payload || 'Failed to approve cancellation');
        }
        setVerifying(false);
      }}
    ]);
  };

  const renderBookingCard = ({ item }) => {
    const slots = item.slotsSnapshot || [];
    const dateStr = slots[0]?.date ? formatISTDate(slots[0].date) : 'N/A';
    
    return (
      <View style={styles.bookingCard}>
        <View style={styles.cardHeader}>
          <View style={styles.userInfo}>
            {item.user?.photo ? (
              <Image source={{ uri: getImageUrl(item.user.photo) }} style={styles.userAvatar} />
            ) : (
              <View style={styles.userAvatarPlaceholder}>
                <Icon name="account" size={24} color={Colors.textTertiary} />
              </View>
            )}
            <View>
              <Text style={styles.userName}>{item.user?.name || 'Unknown User'}</Text>
              <Text style={styles.bookingId}>ID: {item.bookingRef}</Text>
            </View>
          </View>
          <View style={[styles.statusBadge, { borderColor: getStatusColor(item.status) }]}>
            <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
              {item.status?.toUpperCase() || 'UNKNOWN'}
            </Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.detailRow}>
            <Icon name="calendar" size={16} color={Colors.primary} />
            <Text style={styles.detailText}>{dateStr}</Text>
          </View>
          
          <View style={styles.slotsRow}>
            <Icon name="clock-outline" size={16} color={Colors.primary} style={{marginTop: 2}} />
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
              <TouchableOpacity style={[styles.verifyBtn, { backgroundColor: '#FF5722' }]} onPress={() => handleApproveCancel(item)}>
                <Text style={[styles.verifyBtnText, { color: '#FFF' }]}>Approve Refund</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>All Bookings</Text>
      </View>

      {/* Turf Selector */}
      {turfs.length > 0 && (
        <View style={styles.turfSelector}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={turfs}
            keyExtractor={t => t._id}
            contentContainerStyle={{ paddingHorizontal: Spacing.xl }}
            renderItem={({ item: t }) => (
              <TouchableOpacity 
                style={[styles.turfChip, selectedTurf === t._id && styles.turfChipActive]}
                onPress={() => setSelectedTurf(t._id)}
              >
                <Text style={[styles.turfChipText, selectedTurf === t._id && styles.turfChipTextActive]}>{t.name}</Text>
                {t.pendingActionsCount > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{t.pendingActionsCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {/* Filters */}
      <View style={styles.filterContainer}>
        <View style={styles.searchInputContainer}>
          <Icon name="magnify" size={20} color={Colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search Name or ID..."
            placeholderTextColor={Colors.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        <View style={styles.dateInputContainer}>
          <Icon name="calendar" size={20} color={Colors.textTertiary} />
          <TouchableOpacity 
            style={{flex: 1, paddingLeft: Spacing.sm, justifyContent: 'center'}}
            onPress={() => setShowCalendar(true)}
          >
            <Text style={{ color: dateFilter ? Colors.textPrimary : Colors.textTertiary, fontFamily: Typography.fontFamily.regular, fontSize: 12 }}>
              {dateFilter ? dateFilter : 'DD/MM/YYYY'}
            </Text>
          </TouchableOpacity>
          {dateFilter ? (
            <TouchableOpacity onPress={() => setDateFilter('')}>
              <Icon name="close" size={16} color={Colors.textTertiary} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
      <View style={styles.statusFilterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statusScroll}>
          {['All', 'Pending', 'Confirmed', 'Completed', 'Cancelled', 'Cancellation Requested'].map(status => (
            <TouchableOpacity 
              key={status} 
              style={[styles.statusFilterChip, statusFilter === status && styles.statusFilterChipActive]}
              onPress={() => setStatusFilter(status)}
            >
              <Text style={[styles.statusFilterText, statusFilter === status && styles.statusFilterTextActive]}>{status}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Bookings List */}
      {loading && !refreshing && page === 1 ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : bookings.length === 0 ? (
        <View style={styles.centerContainer}>
          <Icon name="calendar-blank" size={64} color={Colors.textTertiary} />
          <Text style={styles.emptyText}>No bookings match your search.</Text>
        </View>
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={(item) => item._id}
          renderItem={renderBookingCard}
          contentContainerStyle={styles.listContainer}
          refreshing={refreshing}
          onRefresh={onRefresh}
          showsVerticalScrollIndicator={false}
          onEndReached={() => {
            if (hasMore && !loadingMore && !loading) {
              fetchBookings(page + 1, false);
            }
          }}
          onEndReachedThreshold={0.5}
          ListFooterComponent={() => loadingMore ? (
            <ActivityIndicator size="small" color={Colors.primary} style={{ margin: 20 }} />
          ) : null}
        />
      )}

      {/* Verification Modal */}
      <Modal visible={verifyModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Verify Payment</Text>
              <TouchableOpacity onPress={() => setVerifyModalVisible(false)}><Icon name="close" size={24} color={Colors.textPrimary}/></TouchableOpacity>
            </View>
            <Text style={styles.modalSubTitle}>Review the screenshot below to confirm the payment.</Text>
            
            {verifyingBooking?.payment?.qrScreenshot ? (
              <Image source={{uri: getImageUrl(verifyingBooking.payment.qrScreenshot)}} style={styles.screenshotImage} resizeMode="contain" />
            ) : (
              <View style={styles.noScreenshot}><Text style={{color: Colors.textTertiary}}>No screenshot available</Text></View>
            )}

            <TextInput
              style={styles.rejectInput}
              placeholder="Reason (if rejecting)"
              placeholderTextColor={Colors.textTertiary}
              value={rejectReason}
              onChangeText={setRejectReason}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[styles.modalBtn, styles.rejectBtn]} 
                onPress={() => submitVerify(false)} 
                disabled={verifying}
              >
                <Text style={styles.rejectBtnText}>Reject</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalBtn, styles.approveBtn]} 
                onPress={() => submitVerify(true)} 
                disabled={verifying}
              >
                {verifying ? <ActivityIndicator color="#000" size="small" /> : <Text style={styles.approveBtnText}>Approve</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Custom JS Calendar Modal */}
      {showCalendar && (
        <View style={styles.calendarOverlay}>
          <View style={styles.calendarContent}>
            <View style={styles.calendarHeader}>
              <TouchableOpacity onPress={() => setCalendarMonth(moment(calendarMonth).subtract(1, 'month'))}>
                <Icon name="chevron-left" size={30} color={Colors.textPrimary} />
              </TouchableOpacity>
              <Text style={styles.calendarTitle}>{calendarMonth.format('MMMM YYYY')}</Text>
              <TouchableOpacity onPress={() => setCalendarMonth(moment(calendarMonth).add(1, 'month'))}>
                <Icon name="chevron-right" size={30} color={Colors.textPrimary} />
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
                  grid.push(
                    <TouchableOpacity 
                      key={`day-${i}`} 
                      style={[styles.calDay, isSel && styles.calDaySel]}
                      onPress={() => {
                        setDateFilter(dStr);
                        setShowCalendar(false);
                      }}
                    >
                      <Text style={[styles.calDayText, isSel && {color: '#000'}]}>{i}</Text>
                    </TouchableOpacity>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { 
    paddingHorizontal: Spacing.xl, paddingTop: 60, paddingBottom: Spacing.lg,
    backgroundColor: Colors.backgroundCard, borderBottomWidth: 1, borderBottomColor: Colors.border
  },
  headerTitle: { fontSize: 24, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary },
  
  turfSelector: { paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.backgroundCard },
  turfChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.backgroundElevated, marginRight: 8, borderWidth: 1, borderColor: Colors.border },
  turfChipActive: { backgroundColor: Colors.primaryAlpha20, borderColor: Colors.primary },
  turfChipText: { color: Colors.textSecondary, fontFamily: Typography.fontFamily.medium },
  turfChipTextActive: { color: Colors.primary, fontFamily: Typography.fontFamily.bold },
  badge: {
    backgroundColor: Colors.error,
    borderRadius: 10, paddingHorizontal: 6, height: 20, justifyContent: 'center', alignItems: 'center'
  },
  badgeText: { color: '#FFF', fontSize: 10, fontFamily: Typography.fontFamily.bold },

  filterContainer: { flexDirection: 'row', gap: 12, padding: Spacing.xl, paddingTop: Spacing.md, paddingBottom: Spacing.sm, backgroundColor: Colors.backgroundElevated },
  statusFilterContainer: { paddingBottom: Spacing.md, backgroundColor: Colors.backgroundElevated, borderBottomWidth: 1, borderBottomColor: Colors.border },
  statusScroll: { paddingHorizontal: Spacing.xl, gap: 8 },
  statusFilterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  statusFilterChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  statusFilterText: { fontSize: 12, color: Colors.textSecondary, fontFamily: Typography.fontFamily.medium },
  statusFilterTextActive: { color: '#000', fontFamily: Typography.fontFamily.bold },
  searchInputContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.backgroundElevated, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.sm, height: 40, borderWidth: 1, borderColor: Colors.border, marginRight: Spacing.sm },
  dateInputContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.backgroundElevated, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.sm, height: 40, borderWidth: 1, borderColor: Colors.border },
  searchInput: { flex: 1, color: Colors.textPrimary, fontFamily: Typography.fontFamily.regular, marginLeft: Spacing.sm, fontSize: 12 },

  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: Colors.textSecondary, fontFamily: Typography.fontFamily.medium, marginTop: Spacing.md, fontSize: 16 },

  listContainer: { padding: Spacing.lg, paddingBottom: 100 },
  
  bookingCard: { 
    backgroundColor: Colors.backgroundCard, borderRadius: BorderRadius.lg, 
    borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.lg,
    overflow: 'hidden'
  },
  cardHeader: { 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', 
    padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border 
  },
  userInfo: { flexDirection: 'row', alignItems: 'center' },
  userAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: Spacing.md },
  userAvatarPlaceholder: { width: 40, height: 40, borderRadius: 20, marginRight: Spacing.md, backgroundColor: Colors.backgroundElevated, justifyContent: 'center', alignItems: 'center' },
  userName: { color: Colors.textPrimary, fontFamily: Typography.fontFamily.bold, fontSize: 16 },
  bookingId: { color: Colors.textTertiary, fontFamily: Typography.fontFamily.regular, fontSize: 12 },
  
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, borderWidth: 1 },
  statusText: { fontSize: 10, fontFamily: Typography.fontFamily.bold },

  cardBody: { padding: Spacing.md },
  detailRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm },
  detailText: { color: Colors.textSecondary, fontFamily: Typography.fontFamily.medium, marginLeft: Spacing.sm, fontSize: 14 },
  
  slotsRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: Spacing.xs },
  slotsList: { flexDirection: 'row', flexWrap: 'wrap', marginLeft: Spacing.sm, flex: 1, gap: 6 },
  slotPill: { backgroundColor: Colors.backgroundElevated, paddingHorizontal: 8, paddingVertical: 4, borderRadius: BorderRadius.sm, color: Colors.textPrimary, fontFamily: Typography.fontFamily.medium, fontSize: 12, borderWidth: 1, borderColor: Colors.border },

  cardFooter: { 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', 
    padding: Spacing.md, backgroundColor: Colors.backgroundElevated 
  },
  footerLabel: { color: Colors.textTertiary, fontFamily: Typography.fontFamily.medium, fontSize: 12, marginBottom: 2 },
  amountText: { color: Colors.primary, fontFamily: Typography.fontFamily.bold, fontSize: 18 },
  paymentMethod: { color: Colors.textSecondary, fontFamily: Typography.fontFamily.bold, fontSize: 14 },
  
  verifyBtn: { backgroundColor: Colors.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, marginTop: 8 },
  verifyBtnText: { color: '#000', fontFamily: Typography.fontFamily.bold, fontSize: 12 },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: Spacing.xl },
  modalContent: { backgroundColor: Colors.backgroundCard, borderRadius: BorderRadius.lg, padding: Spacing.xl, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  modalTitle: { fontSize: 20, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary },
  modalSubTitle: { color: Colors.textSecondary, fontFamily: Typography.fontFamily.medium, marginBottom: Spacing.lg },
  screenshotImage: { width: '100%', height: 300, borderRadius: BorderRadius.md, backgroundColor: '#000', marginBottom: Spacing.lg },
  noScreenshot: { width: '100%', height: 200, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.backgroundElevated, borderRadius: BorderRadius.md, marginBottom: Spacing.lg },
  rejectInput: { backgroundColor: Colors.backgroundElevated, color: Colors.textPrimary, padding: Spacing.md, borderRadius: BorderRadius.md, fontFamily: Typography.fontFamily.regular, marginBottom: Spacing.xl, borderWidth: 1, borderColor: Colors.border },
  modalActions: { flexDirection: 'row', gap: Spacing.md },
  modalBtn: { flex: 1, padding: Spacing.md, borderRadius: BorderRadius.md, alignItems: 'center' },
  rejectBtn: { backgroundColor: 'transparent', borderWidth: 1, borderColor: Colors.error },
  rejectBtnText: { color: Colors.error, fontFamily: Typography.fontFamily.bold },
  approveBtn: { backgroundColor: Colors.primary },
  approveBtnText: { color: '#000', fontFamily: Typography.fontFamily.bold },
  
  calendarOverlay: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', zIndex: 100 },
  calendarContent: { width: '85%', backgroundColor: Colors.surface, borderRadius: BorderRadius.xl, padding: Spacing.xl, borderWidth: 1, borderColor: Colors.border },
  calendarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
  calendarTitle: { fontSize: Typography.fontSize.lg, color: Colors.textPrimary, fontFamily: Typography.fontFamily.bold },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayOfWeek: { width: '14.28%', textAlign: 'center', color: Colors.textSecondary, marginBottom: Spacing.md, fontFamily: Typography.fontFamily.bold },
  calDay: { width: '14.28%', aspectRatio: 1, justifyContent: 'center', alignItems: 'center', marginBottom: 4, borderRadius: 20 },
  calDaySel: { backgroundColor: Colors.primary },
  calDayText: { color: Colors.textPrimary, fontFamily: Typography.fontFamily.medium },
  closeModalBtn: { marginTop: Spacing.lg, padding: 12, backgroundColor: Colors.surfaceVariant, borderRadius: BorderRadius.md, alignItems: 'center' },
  closeModalText: { color: Colors.textPrimary, fontFamily: Typography.fontFamily.bold },
});

export default OwnerBookingsScreen;
