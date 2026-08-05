import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, SafeAreaView, Modal } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { Colors, Typography, Spacing, BorderRadius } from '../../../theme/theme';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { formatISTDateFull, formatISTTime } from '../../../utils/dateFormatter';
import api, { getImageUrl } from '../../../api/axios';
import moment from 'moment';
import { cancelBooking } from '../bookingSlice';
import { showCustomAlert } from '../../../components/CustomAlert';


const BookingDetailScreen = ({ navigation, route }) => {
  const { bookingId } = route.params;
  const dispatch = useDispatch();
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const booking = useSelector((state) => 
    state.booking.bookings.find(b => b._id === bookingId)
  );

  if (!booking) {
    return (
      <View style={styles.errorContainer}>
        <Icon name="alert-circle-outline" size={60} color={Colors.error} />
        <Text style={styles.errorTitle}>Booking Not Found</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const turf = booking.turf || {};
  let imageUrl = getImageUrl(turf.coverImage) || 'https://via.placeholder.com/400';

  const slots = booking.slotsSnapshot || [];
  const dateStr = slots[0]?.date ? formatISTDateFull(slots[0].date) : 'Unknown Date';
  
  const getStatusColor = (status) => {
    switch (status) {
      case 'confirmed': return Colors.success;
      case 'pending': return Colors.warning;
      case 'cancellation_requested': return '#FF5722';
      case 'cancelled': return Colors.error;
      default: return Colors.textSecondary;
    }
  };

  const handleCancel = () => {
    setShowPolicyModal(true);
  };

  const handleConfirmCancel = async () => {
    setShowPolicyModal(false);
    const isPaid = booking.status === 'confirmed';
    const res = await dispatch(cancelBooking({ id: booking._id, reason: 'User requested' }));
    if (cancelBooking.fulfilled.match(res)) {
      showCustomAlert(isPaid ? 'Cancellation Requested' : 'Cancelled', 
        isPaid ? 'The owner has been notified to process your refund.' : 'Your booking has been cancelled.');
    } else {
      showCustomAlert('Error', res.payload || 'Could not cancel booking. Ensure it is > 2 hours before start time.');
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
        
        {/* Header Image section */}
        <View style={styles.imageContainer}>
          <Image source={{ uri: imageUrl }} style={styles.headerImage} />
          <View style={styles.overlay} />
          
          <SafeAreaView style={styles.headerButtons}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconButton}>
              <Icon name="chevron-left" size={28} color="#FFF" />
            </TouchableOpacity>
          </SafeAreaView>

          <View style={styles.headerContent}>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(booking.status) }]}>
              <Text style={styles.statusText}>{booking.status.replace(/_/g, ' ').toUpperCase()}</Text>
            </View>
            <Text style={styles.turfName}>{turf.name || 'Turf Name'}</Text>
            <Text style={styles.turfAddress}>
              <Icon name="map-marker" size={14} color="#FFF" /> {turf.address}
            </Text>
          </View>
        </View>

        {/* Content Section */}
        <View style={styles.detailsContainer}>
          
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Booking Information</Text>
            
            <View style={styles.infoRow}>
              <Icon name="calendar-month-outline" size={22} color={Colors.primary} />
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoLabel}>Date</Text>
                <Text style={styles.infoValue}>{dateStr}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <Icon name="clock-outline" size={22} color={Colors.primary} />
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoLabel}>Time Slots ({slots.length})</Text>
                {slots.map((s, idx) => (
                  <Text key={idx} style={styles.infoValue}>
                    {formatISTTime(s.startTime)} - {formatISTTime(s.endTime)}
                  </Text>
                ))}
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <Icon name="ticket-outline" size={22} color={Colors.primary} />
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoLabel}>Booking ID</Text>
                <Text style={styles.infoValue}>{booking.bookingRef || booking._id.substring(0, 8).toUpperCase()}</Text>
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Payment Details</Text>
            <View style={styles.paymentRow}>
              <Text style={styles.paymentText}>Total Amount</Text>
              <Text style={styles.paymentText}>₹{booking.totalAmount}</Text>
            </View>
            {booking.discountAmount ? (
              <View style={styles.paymentRow}>
                <Text style={styles.paymentText}>Discount</Text>
                <Text style={styles.paymentHighlight}>-₹{booking.discountAmount}</Text>
              </View>
            ) : null}
            <View style={styles.paymentRow}>
              <Text style={styles.paymentText}>Platform Fee</Text>
              <Text style={styles.paymentText}>₹{booking.finalAmount - (booking.totalAmount - (booking.discountAmount || 0))}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.paymentRow}>
              <Text style={styles.paymentTotalText}>Final Paid</Text>
              <Text style={styles.paymentTotalAmount}>₹{booking.finalAmount}</Text>
            </View>
          </View>

          {['pending', 'confirmed'].includes(booking.status) && (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {(() => {
                let showCancel = true;
                if (booking.status === 'confirmed') {
                  const slotsArr = booking.slotsSnapshot?.length > 0 ? booking.slotsSnapshot : booking.slots;
                  if (slotsArr && slotsArr.length > 0) {
                    const earliestSlot = slotsArr.reduce((prev, curr) => {
                      const prevTime = new Date(`${prev.date.split('T')[0]}T${prev.startTime}:00+05:30`);
                      const currTime = new Date(`${curr.date.split('T')[0]}T${curr.startTime}:00+05:30`);
                      return prevTime < currTime ? prev : curr;
                    });
                    
                    const slotDateStr = `${earliestSlot.date.split('T')[0]}T${earliestSlot.startTime}:00+05:30`;
                    const slotDate = new Date(slotDateStr);
                    
                    const msDiff = slotDate.getTime() - Date.now();
                    if (msDiff <= 2 * 60 * 60 * 1000) showCancel = false;
                  }
                }
                return showCancel ? (
                  <TouchableOpacity style={[styles.cancelBtn, { flex: 1 }]} onPress={handleCancel}>
                    <Text style={styles.cancelBtnText}>
                      {booking.status === 'confirmed' ? 'Request Cancellation' : 'Cancel Booking'}
                    </Text>
                  </TouchableOpacity>
                ) : null;
              })()}
              <TouchableOpacity 
                style={[styles.cancelBtn, { flex: 1, backgroundColor: Colors.surfaceVariant, borderColor: Colors.border }]} 
                onPress={() => navigation.navigate('CreateTicketScreen', { bookingId: booking.bookingRef })}
              >
                <Text style={[styles.cancelBtnText, { color: Colors.textSecondary }]}>Report Issue</Text>
              </TouchableOpacity>
            </View>
          )}

          {booking.status === 'cancellation_requested' && (
            <View style={styles.infoAlert}>
              <Icon name="clock-alert-outline" size={28} color="#FF9800" />
              <View style={styles.infoAlertContent}>
                <Text style={styles.infoAlertTitle}>Cancellation Requested</Text>
                <Text style={styles.infoAlertDesc}>Awaiting owner refund processing.</Text>
              </View>
            </View>
          )}

        </View>
      </ScrollView>

      {/* ── Cancellation Policy Bottom Sheet ── */}
      <Modal
        visible={showPolicyModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPolicyModal(false)}
      >
        <View style={styles.policyModalOverlay}>
          <TouchableOpacity style={styles.policyModalBackdrop} activeOpacity={1} onPress={() => setShowPolicyModal(false)} />
          <View style={styles.policyModalContent}>
            <View style={styles.policyModalHeader}>
              <Icon name="information-outline" size={24} color={Colors.primary} />
              <Text style={styles.policyModalTitle}>Request Cancellation</Text>
            </View>
            <Text style={styles.policyModalText}>
              {booking.status === 'confirmed'
                ? 'You have already paid for this booking. Cancellations are only allowed > 2 hours before the start time. A 70% refund of the slot price will be requested. The 5% platform fee is non-refundable. Do you want to proceed?'
                : 'Are you sure you want to cancel this booking? Cancellations are only allowed > 2 hours before the start time.'}
            </Text>
            <View style={styles.policyModalActions}>
              <TouchableOpacity style={styles.policyModalCancelBtn} onPress={() => setShowPolicyModal(false)}>
                <Text style={styles.policyModalCancelText}>No</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.policyModalConfirmBtn, { backgroundColor: '#4A1C1C' }]} 
                onPress={handleConfirmCancel}
              >
                <Text style={[styles.policyModalConfirmText, { color: '#FF5722' }]}>Yes, Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  errorTitle: { fontSize: 20, color: Colors.textPrimary, fontFamily: Typography.fontFamily.bold, marginTop: Spacing.md },
  backBtn: { marginTop: Spacing.xl, padding: Spacing.md, backgroundColor: Colors.surface, borderRadius: BorderRadius.md },
  backBtnText: { color: Colors.primary, fontFamily: Typography.fontFamily.bold },
  
  imageContainer: { width: '100%', height: 300, position: 'relative' },
  headerImage: { width: '100%', height: '100%' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  headerButtons: { position: 'absolute', top: 40, left: 0, right: 0, flexDirection: 'row', paddingHorizontal: Spacing.md },
  iconButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  headerContent: { position: 'absolute', bottom: Spacing.xl, left: Spacing.lg, right: Spacing.lg },
  statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, marginBottom: Spacing.md },
  statusText: { color: '#FFF', fontSize: 12, fontFamily: Typography.fontFamily.bold },
  turfName: { fontSize: 28, fontFamily: Typography.fontFamily.bold, color: '#FFF', marginBottom: 4 },
  turfAddress: { fontSize: 14, fontFamily: Typography.fontFamily.medium, color: '#E0E0E0' },
  
  detailsContainer: { padding: Spacing.lg, marginTop: -20, backgroundColor: Colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  card: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.lg, marginBottom: Spacing.lg, borderWidth: 1, borderColor: Colors.border },
  sectionTitle: { fontSize: 16, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary, marginBottom: Spacing.lg },
  
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: Spacing.sm },
  infoTextContainer: { marginLeft: Spacing.md, flex: 1 },
  infoLabel: { fontSize: 12, color: Colors.textSecondary, fontFamily: Typography.fontFamily.medium, marginBottom: 2 },
  infoValue: { fontSize: 15, color: Colors.textPrimary, fontFamily: Typography.fontFamily.bold, marginBottom: 4 },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.md },
  
  paymentRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.md },
  paymentText: { fontSize: 14, color: Colors.textSecondary, fontFamily: Typography.fontFamily.medium },
  paymentHighlight: { fontSize: 14, color: Colors.success, fontFamily: Typography.fontFamily.bold },
  paymentTotalText: { fontSize: 16, color: Colors.textPrimary, fontFamily: Typography.fontFamily.bold },
  paymentTotalAmount: { fontSize: 22, color: Colors.primary, fontFamily: Typography.fontFamily.bold },

  cancelBtn: { padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.error, alignItems: 'center', marginVertical: Spacing.lg },
  cancelBtnText: { color: Colors.error, fontFamily: Typography.fontFamily.bold, fontSize: 16 },

  infoAlert: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 152, 0, 0.1)', padding: Spacing.lg, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: 'rgba(255, 152, 0, 0.3)', marginVertical: Spacing.lg },
  infoAlertContent: { marginLeft: Spacing.md, flex: 1 },
  infoAlertTitle: { color: '#FF9800', fontFamily: Typography.fontFamily.bold, fontSize: 16, marginBottom: 2 },
  infoAlertDesc: { color: 'rgba(255,255,255,0.7)', fontFamily: Typography.fontFamily.medium, fontSize: 13 },

  /* ── Policy Modal Styles ── */
  policyModalOverlay: { flex: 1, justifyContent: 'flex-end' },
  policyModalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.7)' },
  policyModalContent: { backgroundColor: '#1A1A1A', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  policyModalHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  policyModalTitle: { fontSize: 20, fontFamily: Typography.fontFamily.bold, color: '#FFF', marginLeft: 12 },
  policyModalText: { fontSize: 14, color: 'rgba(255,255,255,0.7)', fontFamily: Typography.fontFamily.regular, marginBottom: 12, lineHeight: 22 },
  policyModalActions: { flexDirection: 'row', gap: 12, marginTop: 24 },
  policyModalCancelBtn: { flex: 1, padding: 16, borderRadius: 12, backgroundColor: '#2A2A2A', alignItems: 'center' },
  policyModalCancelText: { color: '#FFF', fontFamily: Typography.fontFamily.bold, fontSize: 16 },
  policyModalConfirmBtn: { flex: 2, padding: 16, borderRadius: 12, backgroundColor: Colors.primary, alignItems: 'center' },
  policyModalConfirmText: { color: '#000', fontFamily: Typography.fontFamily.bold, fontSize: 16 },
});

export default BookingDetailScreen;
