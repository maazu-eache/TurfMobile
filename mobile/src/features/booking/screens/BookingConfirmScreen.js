import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useDispatch, useSelector } from 'react-redux';
import { createBooking } from '../bookingSlice';
import { Colors, Typography, Spacing, BorderRadius } from '../../../theme/theme';
import { showCustomAlert } from '../../../components/CustomAlert';
import RazorpayCheckout from 'react-native-razorpay';
import api from '../../../api/axios';
import { formatISTDateFull, formatISTTime } from '../../../utils/dateFormatter';
import ConfettiCannon from 'react-native-confetti-cannon';


const BookingConfirmScreen = ({ route, navigation }) => {
  const { turf, slots } = route.params;
  const dispatch = useDispatch();
  const { isLoading } = useSelector((state) => state.booking);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const subtotal = slots.reduce((acc, s) => acc + s.price, 0);
  const platformFee = Math.round(subtotal * 0.05); // 5% platform fee
  const total = subtotal + platformFee;

  const groupedSlots = slots.reduce((acc, slot) => {
    const dateStr = formatISTDateFull(slot.date);
    if (!acc[dateStr]) acc[dateStr] = [];
    acc[dateStr].push(slot);
    return acc;
  }, {});


  const handleConfirm = async () => {
    setIsProcessing(true);
    try {
      const payload = {
        turfId: turf._id,
        slots: slots.map(s => s._id)
      };
      
      // 1. Create Booking
      const res = await dispatch(createBooking(payload));
      if (createBooking.fulfilled.match(res)) {
        const bookingId = res.payload.booking._id;
        
        // 2. Create Razorpay Order from backend
        const orderRes = await api.post('/payments/create-order', { bookingId });
        const { order, key } = orderRes.data.data;
        
        // 3. Open Razorpay Checkout
        const options = {
          description: `Booking for ${turf.name}`,
          image: 'https://i.imgur.com/3g7nmJC.png', // Add logo URL here
          currency: order.currency,
          key: key || 'rzp_test_replace_me', // fallback
          amount: order.amount,
          name: 'RoughTurf',
          order_id: order.id,
          theme: { color: Colors.primary }
        };
        
        RazorpayCheckout.open(options).then(async (data) => {
          // 4. Verify Payment
          try {
            await api.post('/payments/verify', {
              razorpay_order_id: data.razorpay_order_id,
              razorpay_payment_id: data.razorpay_payment_id,
              razorpay_signature: data.razorpay_signature,
              bookingId
            });
            setIsProcessing(false);
            setShowConfetti(true);
            showCustomAlert('Success', 'Payment successful & Booking confirmed!');
            setTimeout(() => {
              navigation.popToTop();
              navigation.navigate('Bookings');
            }, 2500);
          } catch (verifyErr) {
            setIsProcessing(false);
            showCustomAlert('Payment Verification Failed', 'Please contact support.');
          }
        }).catch((error) => {
          setIsProcessing(false);
          // Handle cancellation or failure
          showCustomAlert('Payment Failed', `Code: ${error.code} | ${error.description}`);
        });

      } else {
        setIsProcessing(false);
        showCustomAlert('Error', res.payload || 'Booking failed');
      }
    } catch (err) {
      setIsProcessing(false);
      showCustomAlert('Error', 'Failed to initialize payment.');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Confirm Booking</Text>
        <View style={{width: 24}} />
      </View>

      <KeyboardAwareScrollView enableOnAndroid={true} extraScrollHeight={20} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        {/* Turf Info Summary */}
        <View style={styles.card}>
          <Text style={styles.turfName}>{turf.name}</Text>
          <Text style={styles.turfLoc}><Icon name="map-marker" size={14}/> {turf.city}</Text>
          <View style={styles.divider} />
          
          <Text style={styles.slotsLabel}>Selected Slots ({slots.length})</Text>
          
          {Object.entries(groupedSlots).map(([dateStr, daySlots]) => (
            <View key={dateStr} style={styles.dateGroup}>
              <View style={styles.dateHeader}>
                <Icon name="calendar-month" size={16} color={Colors.primary} />
                <Text style={styles.groupDateText}>{dateStr}</Text>
              </View>
              
              <View style={styles.chipsContainer}>
                {daySlots.map(s => (
                  <View key={s._id} style={styles.slotChip}>
                    <View style={{flexDirection: 'row', alignItems: 'center', gap: 4}}>
                      <Icon name="clock-outline" size={14} color={Colors.textSecondary} />
                      <Text style={styles.chipTime}>{formatISTTime(s.startTime)} - {formatISTTime(s.endTime)}</Text>
                    </View>
                    <Text style={styles.chipPrice}>₹{s.price}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>

        {/* Bill Details */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Bill Details</Text>
          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Subtotal</Text>
            <Text style={styles.billVal}>₹{subtotal}</Text>
          </View>
          <View style={styles.billRow}>
            <TouchableOpacity 
              style={{flexDirection: 'row', alignItems: 'center', gap: 4}}
              onPress={() => showCustomAlert('Platform Fee', 'A small fee of 5% is charged by the platform to maintain secure payments and support.')}
            >
              <Text style={styles.billLabel}>Platform Fee</Text>
              <Icon name="information-outline" size={14} color={Colors.textSecondary} />
            </TouchableOpacity>
            <Text style={styles.billVal}>₹{platformFee}</Text>
          </View>
          <View style={styles.dividerDashed} />
          <View style={styles.billRow}>
            <Text style={styles.totalLabel}>Total Payable</Text>
            <Text style={styles.totalVal}>₹{total}</Text>
          </View>
        </View>
      </KeyboardAwareScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <View>
          <Text style={styles.footerLabel}>Total Amount</Text>
          <Text style={styles.footerPrice}>₹{total}</Text>
        </View>
        <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm} disabled={isLoading || isProcessing}>
          <LinearGradient colors={Colors.gradients.primary} style={styles.confirmBtnGrad} start={{x:0, y:0}} end={{x:1, y:0}}>
            {(isLoading || isProcessing) ? <ActivityIndicator color="#000" /> : <Text style={styles.confirmBtnText}>Confirm Booking</Text>}
          </LinearGradient>
        </TouchableOpacity>
      </View>
      
      {showConfetti && (
        <ConfettiCannon
          count={200}
          origin={{x: -10, y: 0}}
          autoStart={true}
          fadeOut={true}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.xl, paddingTop: 60, backgroundColor: Colors.backgroundElevated },
  headerTitle: { fontSize: Typography.fontSize.xl, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary },
  content: { padding: Spacing.xl, gap: Spacing.lg, paddingBottom: 100 },
  card: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border },
  turfName: { fontSize: Typography.fontSize.lg, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary, marginBottom: 4 },
  turfLoc: { fontSize: Typography.fontSize.sm, fontFamily: Typography.fontFamily.regular, color: Colors.textSecondary },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.md },
  dateLabel: { fontSize: Typography.fontSize.md, color: Colors.textSecondary, marginBottom: Spacing.sm },
  dateVal: { color: Colors.textPrimary, fontFamily: Typography.fontFamily.bold },
  slotsLabel: { fontSize: Typography.fontSize.sm, color: Colors.textSecondary, marginBottom: 12, marginTop: 8, textTransform: 'uppercase', letterSpacing: 1, fontFamily: Typography.fontFamily.bold },
  
  dateGroup: { marginBottom: Spacing.md, backgroundColor: Colors.backgroundElevated, padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border },
  dateHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border, paddingBottom: 8 },
  groupDateText: { color: Colors.textPrimary, fontFamily: Typography.fontFamily.bold, fontSize: 14 },
  chipsContainer: { gap: 8 },
  slotChip: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.surface, padding: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border },
  chipTime: { color: Colors.textPrimary, fontFamily: Typography.fontFamily.medium, fontSize: 13 },
  chipPrice: { color: Colors.primary, fontFamily: Typography.fontFamily.bold, fontSize: 14 },
  
  sectionTitle: { fontSize: Typography.fontSize.md, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary, marginBottom: Spacing.md },
  dividerDashed: { height: 1, borderWidth: 1, borderColor: Colors.border, borderStyle: 'dashed', marginVertical: Spacing.md },
  couponRow: { flexDirection: 'row', gap: 12 },
  couponInput: { flex: 1, height: 48, backgroundColor: Colors.backgroundElevated, borderRadius: BorderRadius.md, paddingHorizontal: 12, color: Colors.textPrimary, borderWidth: 1, borderColor: Colors.border },
  applyBtn: { backgroundColor: Colors.surfaceVariant, paddingHorizontal: 20, justifyContent: 'center', borderRadius: BorderRadius.md },
  applyBtnText: { color: Colors.primary, fontFamily: Typography.fontFamily.bold },
  billRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  billLabel: { color: Colors.textSecondary, fontFamily: Typography.fontFamily.medium },
  billVal: { color: Colors.textPrimary, fontFamily: Typography.fontFamily.medium },
  billValDiscount: { color: Colors.primary, fontFamily: Typography.fontFamily.medium },
  totalLabel: { color: Colors.textPrimary, fontFamily: Typography.fontFamily.bold, fontSize: 16 },
  totalVal: { color: Colors.textPrimary, fontFamily: Typography.fontFamily.bold, fontSize: 20 },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: Colors.backgroundElevated, borderTopWidth: 1, borderTopColor: Colors.border, padding: Spacing.lg, paddingBottom: 30, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footerLabel: { color: Colors.textSecondary, fontSize: 12, fontFamily: Typography.fontFamily.medium },
  footerPrice: { color: Colors.textPrimary, fontSize: 24, fontFamily: Typography.fontFamily.bold },
  confirmBtn: { borderRadius: BorderRadius.lg, overflow: 'hidden', width: 160 },
  confirmBtnGrad: { paddingVertical: 14, alignItems: 'center' },
  confirmBtnText: { color: '#000', fontFamily: Typography.fontFamily.bold, fontSize: 16 },
});

export default BookingConfirmScreen;
