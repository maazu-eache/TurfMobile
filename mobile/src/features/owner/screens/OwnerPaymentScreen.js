import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useDispatch, useSelector } from 'react-redux';
import { payOwnerFee, logout } from '../../auth/authSlice';
import { Colors, Typography, Spacing, BorderRadius } from '../../../theme/theme';
import { navigate, reset } from '../../../navigation/navigationRef';

const OwnerPaymentScreen = () => {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const [isProcessing, setIsProcessing] = useState(false);

  const handlePayment = async () => {
    setIsProcessing(true);
    try {
      await dispatch(payOwnerFee()).unwrap();
      // On success, Redux state updates, RootNavigator unmounts this screen automatically!
    } catch (error) {
      console.error('Payment failed', error);
      setIsProcessing(false);
    }
  };

  const handleLogout = () => {
    dispatch(logout());
    setTimeout(() => {
      reset('Customer');
    }, 100);
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={Colors.gradients.primary} style={styles.header}>
        <View style={styles.iconContainer}>
          <Icon name="shield-star" size={48} color="#FFF" />
        </View>
        <Text style={styles.title}>Turf Owner Registration</Text>
        <Text style={styles.subtitle}>Almost there, {user?.name?.split(' ')[0] || 'Partner'}!</Text>
      </LinearGradient>

      <View style={styles.content}>
        <Text style={styles.instruction}>
          To unlock the Owner Dashboard and start listing your turfs, you need to pay a one-time setup fee.
        </Text>

        <View style={styles.receiptCard}>
          <View style={styles.receiptRow}>
            <Text style={styles.receiptLabel}>Platform Access</Text>
            <Text style={styles.receiptValue}>Lifetime</Text>
          </View>
          <View style={styles.receiptRow}>
            <Text style={styles.receiptLabel}>Registration Fee</Text>
            <Text style={styles.receiptValue}>₹1000</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.receiptRow}>
            <Text style={styles.totalLabel}>Total Amount</Text>
            <Text style={styles.totalValue}>₹1000</Text>
          </View>
        </View>

        <TouchableOpacity 
          style={styles.payBtn}
          onPress={handlePayment}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <Icon name="lock" size={20} color="#FFF" />
              <Text style={styles.payBtnText}>Pay ₹1000 Securely</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Cancel & Logout</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingTop: 80,
    paddingBottom: 40,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  iconContainer: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  title: { fontSize: Typography.fontSize['2xl'], fontFamily: Typography.fontFamily.bold, color: '#FFF', textAlign: 'center' },
  subtitle: { fontSize: Typography.fontSize.md, fontFamily: Typography.fontFamily.medium, color: 'rgba(255,255,255,0.9)', marginTop: 4 },
  
  content: { flex: 1, padding: Spacing.xl, paddingTop: Spacing['2xl'] },
  instruction: { fontSize: Typography.fontSize.md, fontFamily: Typography.fontFamily.regular, color: Colors.textSecondary, textAlign: 'center', marginBottom: Spacing['2xl'], lineHeight: 24 },
  
  receiptCard: {
    backgroundColor: Colors.surface,
    padding: Spacing.xl,
    borderRadius: BorderRadius.xl,
    borderWidth: 1, borderColor: Colors.border,
    marginBottom: Spacing['2xl']
  },
  receiptRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.md },
  receiptLabel: { fontSize: Typography.fontSize.md, fontFamily: Typography.fontFamily.medium, color: Colors.textSecondary },
  receiptValue: { fontSize: Typography.fontSize.md, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.sm, marginBottom: Spacing.md },
  totalLabel: { fontSize: Typography.fontSize.lg, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary },
  totalValue: { fontSize: Typography.fontSize.xl, fontFamily: Typography.fontFamily.bold, color: Colors.primary },
  
  payBtn: {
    backgroundColor: Colors.primary,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 16, borderRadius: BorderRadius.full, gap: 12,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4
  },
  payBtnText: { color: '#FFF', fontFamily: Typography.fontFamily.bold, fontSize: Typography.fontSize.lg },
  
  logoutBtn: { marginTop: Spacing.xl, padding: Spacing.md, alignItems: 'center' },
  logoutText: { color: Colors.textTertiary, fontFamily: Typography.fontFamily.medium, fontSize: Typography.fontSize.md },
});

export default OwnerPaymentScreen;
