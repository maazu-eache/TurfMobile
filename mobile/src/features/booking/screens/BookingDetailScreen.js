import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, SafeAreaView } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { Colors, Typography, Spacing, BorderRadius } from '../../../theme/theme';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { formatISTDateFull, formatISTTime } from '../../../utils/dateFormatter';
import api from '../../../api/axios';
import moment from 'moment';
import { cancelBooking } from '../bookingSlice';
import { showCustomAlert } from '../../../components/CustomAlert';


const BookingDetailScreen = ({ navigation, route }) => {
  const { bookingId } = route.params;
  const dispatch = useDispatch();
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
  let imageUrl = 'https://via.placeholder.com/400';
  const serverRootUrl = api.defaults.baseURL.replace('/api', '');

  if (turf.coverImage) {
    if (turf.coverImage.startsWith('http')) imageUrl = turf.coverImage;
    else if (turf.coverImage.includes('/uploads/')) {
      const pathPart = turf.coverImage.substring(turf.coverImage.indexOf('/uploads/'));
      imageUrl = `${serverRootUrl}${pathPart}`;
    } else {
      imageUrl = `${serverRootUrl}${turf.coverImage}`;
    }
  }

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
    const isPaid = booking.status === 'confirmed';
    const message = isPaid 
      ? 'You have already paid for this booking. Cancelling will send a refund request to the turf owner. Do you want to proceed?'
      : 'Are you sure you want to cancel this booking?';

    showCustomAlert(isPaid ? 'Request Cancellation' : 'Cancel Booking', message, [
      { text: 'No', style: 'cancel' },
      { text: 'Yes, Cancel', style: 'destructive', onPress: async () => {
        const res = await dispatch(cancelBooking({ id: booking._id, reason: 'User requested' }));
        if (cancelBooking.fulfilled.match(res)) {
          showCustomAlert(isPaid ? 'Cancellation Requested' : 'Cancelled', 
            isPaid ? 'The owner has been notified to process your refund.' : 'Your booking has been cancelled.');
        } else {
          showCustomAlert('Error', res.payload || 'Could not cancel booking.');
        }
      }}
    ]);
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
              <Text style={styles.statusText}>{booking.status.toUpperCase()}</Text>
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

          {/* {['pending', 'confirmed'].includes(booking.status) && (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity style={[styles.cancelBtn, { flex: 1 }]} onPress={handleCancel}>
                <Text style={styles.cancelBtnText}>
                  {booking.status === 'confirmed' ? 'Request Cancellation' : 'Cancel Booking'}
                </Text>
              </TouchableOpacity>
              
              {booking.status === 'confirmed' && (
                <TouchableOpacity 
                  style={[styles.cancelBtn, { flex: 1, borderColor: Colors.primary, backgroundColor: 'transparent' }]} 
                  onPress={() => navigation.navigate('SlotPicker', { turf: booking.turf, isRescheduling: true, reschedulingBookingId: booking._id, oldTotalPrice: booking.totalAmount })}
                >
                  <Text style={[styles.cancelBtnText, { color: Colors.primary }]}>Reschedule</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {booking.status === 'cancellation_requested' && (
            <View style={[styles.cancelBtn, { borderColor: '#FF5722', backgroundColor: 'rgba(255, 87, 34, 0.1)' }]}>
              <Text style={[styles.cancelBtnText, { color: '#FF5722' }]}>
                Cancellation Requested. Awaiting Owner Refund.
              </Text>
            </View>
          )} */}

        </View>
      </ScrollView>
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
  cancelBtnText: { color: Colors.error, fontFamily: Typography.fontFamily.bold, fontSize: 16 }
});

export default BookingDetailScreen;
