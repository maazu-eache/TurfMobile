import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Image,
  Animated,
  StatusBar,
  Dimensions,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from '../../../components/SolidGradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useDispatch, useSelector } from 'react-redux';
import { createBooking } from '../bookingSlice';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../../theme/theme';
import { showCustomAlert } from '../../../components/CustomAlert';
import RazorpayCheckout from 'react-native-razorpay';
import api, { getImageUrl } from '../../../api/axios';
import { formatISTDateFull, formatISTTime } from '../../../utils/dateFormatter';
import ConfettiCannon from 'react-native-confetti-cannon';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const BookingConfirmScreen = ({ route, navigation }) => {
  const insets = useSafeAreaInsets();
  const { turf, slots } = route.params;
  const dispatch = useDispatch();
  const { isLoading } = useSelector((state) => state.booking);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  
  const subtotal = slots.reduce((acc, s) => acc + s.price, 0);
  const platformFee = Math.round(subtotal * 0.05); // 5% platform fee
  const total = subtotal + platformFee;

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scrollY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);


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
          image: 'https://i.imgur.com/3g7nmJC.png',
          currency: order.currency,
          key: key || 'rzp_test_replace_me',
          amount: order.amount,
          name: 'ScoreVerse',
          order_id: order.id,
          theme: { color: '#FFD400' }
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

  // Card Parallax depth calculations on scroll
  const getCardStyle = (index) => {
    const translateY = scrollY.interpolate({
      inputRange: [0, 200],
      outputRange: [0, index * 6],
      extrapolate: 'clamp',
    });

    const scale = scrollY.interpolate({
      inputRange: [0, 200],
      outputRange: [1, 1 - index * 0.005],
      extrapolate: 'clamp',
    });

    return {
      transform: [{ translateY }, { scale }],
      zIndex: 10 + index * 10,
    };
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      {showConfetti && <ConfettiCannon count={200} origin={{x: -10, y: 0}} fallSpeed={3000} fadeOut />}
      
      {/* ── Floating Header ── */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Icon name="arrow-left" size={20} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Confirm Checkout</Text>
        <View style={{ width: 36 }} />
      </View>

      <KeyboardAwareScrollView
        enableOnAndroid={true}
        extraScrollHeight={20}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
      >
        {/* ── 1. Hero Booking Card ── */}
        <Animated.View style={[styles.walletCard, styles.heroCard, getCardStyle(0)]}>
          <Image source={{ uri: getImageUrl(turf.coverImage) }} style={styles.heroImage} />
          <View style={styles.heroGradientOverlay} />
          <View style={styles.heroInfo}>
            <View style={styles.heroHeaderRow}>
              <Text style={styles.heroName} numberOfLines={2}>{turf.name}</Text>
              <View style={styles.ratingBadge}>
                <Icon name="star" size={10} color="#000" />
                <Text style={styles.ratingValue}>{turf.rating > 0 ? turf.rating.toFixed(1) : 'New'}</Text>
              </View>
            </View>
            <View style={styles.heroLocRow}>
              <Icon name="map-marker-outline" size={13} color="rgba(255,255,255,0.6)" />
              <Text style={styles.heroLoc} numberOfLines={1}>{turf.address || turf.city}</Text>
            </View>
            <View style={styles.heroBadgeRow}>
              <View style={styles.heroBadge}>
                <Icon name="check-decagram" size={11} color="#2ED573" />
                <Text style={styles.heroBadgeText}>Verified</Text>
              </View>
              {turf.type && (
                <View style={styles.heroBadge}>
                  <Icon name="soccer-field" size={11} color="#FFD400" />
                  <Text style={styles.heroBadgeText}>{turf.type}</Text>
                </View>
              )}
            </View>
          </View>
        </Animated.View>

        {/* ── 2. Floating Booking Summary Card ── */}
        <Animated.View style={[styles.walletCard, styles.walletCardOverlap, getCardStyle(1)]}>
          <Text style={styles.cardSectionTitle}>Booking Summary</Text>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <Icon name="calendar-month" size={16} color="#FFD400" />
              <View style={styles.summaryTextCol}>
                <Text style={styles.summaryLabel}>Date</Text>
                <Text style={styles.summaryValue}>{formatISTDateFull(slots[0]?.date)}</Text>
              </View>
            </View>

            <View style={styles.summaryItem}>
              <Icon name="clock-outline" size={16} color="#FFD400" />
              <View style={styles.summaryTextCol}>
                <Text style={styles.summaryLabel}>Duration</Text>
                <Text style={styles.summaryValue}>{slots.length} Hours</Text>
              </View>
            </View>

            <View style={styles.summaryItem}>
              <Icon name="soccer" size={16} color="#FFD400" />
              <View style={styles.summaryTextCol}>
                <Text style={styles.summaryLabel}>Sport</Text>
                <Text style={styles.summaryValue}>{turf.sports?.[0] || 'Multi-sport'}</Text>
              </View>
            </View>

            <View style={styles.summaryItem}>
              <Icon name="account-group" size={16} color="#FFD400" />
              <View style={styles.summaryTextCol}>
                <Text style={styles.summaryLabel}>Capacity</Text>
                <Text style={styles.summaryValue}>{turf.size || 'Standard'}</Text>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* ── 3. Selected Slots Card ── */}
        <Animated.View style={[styles.walletCard, styles.walletCardOverlap, getCardStyle(2)]}>
          <Text style={styles.cardSectionTitle}>Selected Slots ({slots.length})</Text>
          <View style={styles.slotChipsContainer}>
            {Object.entries(groupedSlots).map(([dateStr, daySlots]) => (
              <View key={dateStr} style={styles.slotDateSection}>
                <Text style={styles.slotDateHeader}>{dateStr}</Text>
                {daySlots.map((s) => (
                  <View key={s._id} style={styles.slotFloatingChip}>
                    <View style={styles.slotChipLeft}>
                      <Icon name="clock-check-outline" size={14} color="#FFD400" />
                      <Text style={styles.slotChipTime}>
                        {formatISTTime(s.startTime)} - {formatISTTime(s.endTime)}
                      </Text>
                    </View>
                    <Text style={styles.slotChipPrice}>₹{s.price}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        </Animated.View>

        {/* ── 4. Price Breakdown Card ── */}
        <Animated.View style={[styles.walletCard, styles.walletCardOverlap, getCardStyle(3)]}>
          <Text style={styles.cardSectionTitle}>Payment Breakdown</Text>
          <View style={styles.billTable}>
            <View style={styles.billRow}>
              <Text style={styles.billLabel}>Subtotal</Text>
              <Text style={styles.billVal}>₹{subtotal}</Text>
            </View>

            <View style={styles.billRow}>
              <View style={styles.billLabelBlock}>
                <Text style={styles.billLabel}>Platform Fee</Text>
                <TouchableOpacity onPress={() => showCustomAlert('Platform Fee', '5% platform service charge to facilitate secure digital bookings.')}>
                  <Icon name="information-outline" size={12} color="rgba(255,255,255,0.4)" style={{ marginLeft: 4 }} />
                </TouchableOpacity>
              </View>
              <Text style={styles.billVal}>₹{platformFee}</Text>
            </View>

            <View style={styles.billDashedDivider} />

            <View style={styles.billTotalRow}>
              <Text style={styles.billTotalLabel}>Total Payable</Text>
              <Text style={styles.billTotalValue}>₹{total}</Text>
            </View>
          </View>
        </Animated.View>

        {/* ── 5. Secure Booking Card ── */}
        <Animated.View style={[styles.walletCard, styles.walletCardOverlap, getCardStyle(4), { marginBottom: 120 }]}>
          <View style={styles.secureFeaturesGrid}>
            <View style={styles.secureItem}>
              <Icon name="shield-check" size={14} color="#2ED573" />
              <Text style={styles.secureText}>Instant Confirmation</Text>
            </View>
            <View style={styles.secureItem}>
              <Icon name="lock" size={14} color="#2ED573" />
              <Text style={styles.secureText}>Secure Payments</Text>
            </View>
            <View style={styles.secureItem}>
              <Icon name="file-document-outline" size={14} color="#2ED573" />
              <Text style={styles.secureText}>GST Compliant Invoice</Text>
            </View>
            <View style={styles.secureItem}>
              <Icon name="map-marker-check-outline" size={14} color="#2ED573" />
              <Text style={styles.secureText}>Verified Ground Host</Text>
            </View>
          </View>
        </Animated.View>
      </KeyboardAwareScrollView>

      {/* ── Floating Sticky Bottom Payment Panel ── */}
      <View style={styles.floatingPaymentPanel}>
        <View style={styles.paymentLeft}>
          <Text style={styles.paymentTotalLabel}>Total Amount</Text>
          <Text style={styles.paymentTotalVal}>₹{total}</Text>
        </View>
        
        <TouchableOpacity
          style={styles.confirmPillBtn}
          onPress={handleConfirm}
          disabled={isLoading || isProcessing}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={['#FFD400', '#FFB700']}
            style={styles.confirmPillBtnGrad}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            {isProcessing ? (
              <ActivityIndicator color="#000" size="small" />
            ) : (
              <>
                <Icon name="lock" size={16} color="#000" style={{ marginRight: 6 }} />
                <Text style={styles.confirmBtnText}>Confirm Booking</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  content: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 160 },

  /* ── Header ── */
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 16,
    backgroundColor: '#0E0E0E',
    borderBottomWidth: 1, borderColor: '#2B2B2B',
  },
  headerBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#171717',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#2B2B2B',
  },
  headerTitle: { fontSize: 16, fontFamily: Typography.fontFamily.bold, color: '#FFF' },

  /* ── Apple Wallet Overlapping Stack Cards ── */
  walletCard: {
    backgroundColor: '#171717',
    borderRadius: 24,
    borderWidth: 1, borderColor: '#2B2B2B',
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4, shadowRadius: 12,
    elevation: 6,
  },
  walletCardOverlap: {
    marginTop: -16, // overlap layering spacing
  },
  cardSectionTitle: {
    fontSize: 13, fontFamily: Typography.fontFamily.bold,
    color: 'rgba(255,255,255,0.4)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 14,
  },

  /* ── Hero Booking Card ── */
  heroCard: {
    height: 180,
    overflow: 'hidden',
    position: 'relative',
    padding: 0,
  },
  heroImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  heroGradientOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  heroInfo: {
    position: 'absolute', bottom: 18, left: 18, right: 18,
    flexDirection: 'column', gap: 6,
  },
  heroHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  heroName: { fontSize: 18, fontFamily: Typography.fontFamily.extraBold, color: '#FFF', flex: 1 },
  ratingBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#FFD400',
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 6,
  },
  ratingValue: { color: '#000', fontFamily: Typography.fontFamily.bold, fontSize: 10 },
  heroLocRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  heroLoc: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontFamily: Typography.fontFamily.medium, flex: 1 },
  heroBadgeRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  heroBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)',
  },
  heroBadgeText: { color: '#FFF', fontSize: 9, fontFamily: Typography.fontFamily.bold },

  /* ── Booking Summary Card ── */
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 },
  summaryItem: {
    width: '48%',
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12, padding: 10,
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.05)',
  },
  summaryTextCol: { flexDirection: 'column', marginLeft: 8, flex: 1 },
  summaryLabel: { fontSize: 8, fontFamily: Typography.fontFamily.medium, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' },
  summaryValue: { fontSize: 11, fontFamily: Typography.fontFamily.bold, color: '#FFF', marginTop: 1 },

  /* ── Selected Slots Card ── */
  slotChipsContainer: { gap: 12 },
  slotDateSection: { flexDirection: 'column', gap: 6 },
  slotDateHeader: { fontSize: 11, fontFamily: Typography.fontFamily.bold, color: '#FFF', marginBottom: 4 },
  slotFloatingChip: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#1C1C1C',
    borderRadius: 14, padding: 12,
    borderWidth: 1, borderColor: '#FFD400',
    shadowColor: '#FFD400',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1, shadowRadius: 6,
    elevation: 3,
  },
  slotChipLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  slotChipTime: { color: '#FFF', fontSize: 12, fontFamily: Typography.fontFamily.bold },
  slotChipPrice: { color: '#FFD400', fontSize: 13, fontFamily: Typography.fontFamily.extraBold },

  /* ── Coupon Code Card ── */
  couponInputRow: {
    flexDirection: 'row', gap: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 14, paddingHorizontal: 12, height: 48,
    alignItems: 'center', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)',
  },
  couponTextInput: { flex: 1, color: '#FFF', fontFamily: Typography.fontFamily.medium, fontSize: 12 },
  couponApplyBtn: { paddingHorizontal: 16, height: '100%', justifyContent: 'center' },
  couponApplyText: { color: '#FFD400', fontFamily: Typography.fontFamily.bold, fontSize: 12 },
  couponRemoveBtn: { opacity: 0.8 },

  /* ── Price Breakdown Card ── */
  billTable: { flexDirection: 'column', gap: 8 },
  billRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  billLabelBlock: { flexDirection: 'row', alignItems: 'center' },
  billLabel: { fontSize: 12, fontFamily: Typography.fontFamily.medium, color: 'rgba(255,255,255,0.5)' },
  billVal: { fontSize: 12, fontFamily: Typography.fontFamily.semiBold, color: '#FFF' },
  billDashedDivider: { height: 1, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)', borderStyle: 'dashed', marginVertical: 8 },
  billTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  billTotalLabel: { fontSize: 14, fontFamily: Typography.fontFamily.bold, color: '#FFF' },
  billTotalValue: { fontSize: 20, fontFamily: Typography.fontFamily.extraBold, color: '#FFD400' },

  /* ── Secure Card ── */
  secureFeaturesGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  secureItem: {
    width: '48%',
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  secureText: { fontSize: 10, fontFamily: Typography.fontFamily.medium, color: 'rgba(255,255,255,0.6)' },

  /* ── Cancellation Policy Card ── */
  cancellationHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  cancellationTitle: { fontSize: 12, fontFamily: Typography.fontFamily.bold, color: '#FFF' },
  cancellationDesc: { fontSize: 10, fontFamily: Typography.fontFamily.regular, color: 'rgba(255,255,255,0.5)', lineHeight: 15, marginBottom: 8 },
  cancellationLink: { fontSize: 11, fontFamily: Typography.fontFamily.bold, color: '#FFD400' },

  /* ── Floating Sticky Bottom Payment Panel ── */
  floatingPaymentPanel: {
    position: 'absolute', bottom: 16, left: 16, right: 16,
    height: 72, borderRadius: 36,
    backgroundColor: 'rgba(22,22,22,0.95)',
    borderWidth: 1, borderColor: '#2B2B2B',
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5, shadowRadius: 15,
    elevation: 10,
    zIndex: 200,
  },
  paymentLeft: { flexDirection: 'column' },
  paymentTotalLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 9, fontFamily: Typography.fontFamily.medium, textTransform: 'uppercase' },
  paymentTotalVal: { color: '#FFD400', fontSize: 20, fontFamily: Typography.fontFamily.bold },
  confirmPillBtn: { borderRadius: 20, overflow: 'hidden', shadowColor: '#FFD400', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 4 },
  confirmPillBtnGrad: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 20 },
  confirmBtnText: { color: '#000', fontFamily: Typography.fontFamily.bold, fontSize: 13 },
});

export default BookingConfirmScreen;