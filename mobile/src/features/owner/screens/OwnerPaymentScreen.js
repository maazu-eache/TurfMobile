import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, StatusBar } from 'react-native';
import LinearGradient from '../../../components/SolidGradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useDispatch, useSelector } from 'react-redux';
import { payOwnerFee, logout } from '../../auth/authSlice';
import { Typography, Spacing, BorderRadius } from '../../../theme/theme';
import { useTheme } from '../../../theme/ThemeContext';

const OwnerPaymentScreen = () => {
  const dispatch = useDispatch();
  const { colors, isDark, shadows } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark, shadows), [colors, isDark, shadows]);

  const { user } = useSelector((state) => state.auth);
  const [isProcessing, setIsProcessing] = useState(false);

  const handlePayment = async () => {
    setIsProcessing(true);
    try {
      await dispatch(payOwnerFee()).unwrap();
    } catch (error) {
      console.error('Payment failed', error);
      setIsProcessing(false);
    }
  };

  const handleLogout = () => {
    dispatch(logout());
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <LinearGradient colors={colors.primaryGradient || ['#FFCC00', '#E6B800']} style={styles.header}>
        <View style={styles.iconContainer}>
          <Icon name="shield-star" size={48} color="#000" />
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
          activeOpacity={0.85}
        >
          {isProcessing ? (
            <ActivityIndicator color="#000" />
          ) : (
            <>
              <Icon name="lock" size={20} color="#000" />
              <Text style={styles.payBtnText}>Pay ₹1000 Securely</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn} activeOpacity={0.7}>
          <Text style={styles.logoutText}>Cancel & Logout</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const createStyles = (colors, isDark, shadows) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
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
    backgroundColor: 'rgba(0,0,0,0.15)',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  title: { fontSize: Typography.fontSize['2xl'], fontFamily: Typography.fontFamily.bold, color: '#000', textAlign: 'center' },
  subtitle: { fontSize: Typography.fontSize.md, fontFamily: Typography.fontFamily.medium, color: 'rgba(0,0,0,0.7)', marginTop: 4 },
  
  content: { flex: 1, padding: Spacing.xl, paddingTop: Spacing['2xl'] },
  instruction: { fontSize: Typography.fontSize.md, fontFamily: Typography.fontFamily.regular, color: colors.textSecondary, textAlign: 'center', marginBottom: Spacing['2xl'], lineHeight: 24 },
  
  receiptCard: {
    backgroundColor: colors.surface,
    padding: Spacing.xl,
    borderRadius: BorderRadius.xl,
    borderWidth: 1, borderColor: colors.border,
    marginBottom: Spacing['2xl'],
    ...shadows.small,
  },
  receiptRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.md },
  receiptLabel: { fontSize: Typography.fontSize.md, fontFamily: Typography.fontFamily.medium, color: colors.textSecondary },
  receiptValue: { fontSize: Typography.fontSize.md, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: Spacing.sm, marginBottom: Spacing.md },
  totalLabel: { fontSize: Typography.fontSize.lg, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary },
  totalValue: { fontSize: Typography.fontSize.xl, fontFamily: Typography.fontFamily.bold, color: isDark ? colors.primary : colors.primaryDark },
  
  payBtn: {
    backgroundColor: colors.primary,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 16, borderRadius: BorderRadius.full, gap: 12,
    ...shadows.medium,
  },
  payBtnText: { color: '#000', fontFamily: Typography.fontFamily.bold, fontSize: Typography.fontSize.lg },
  
  logoutBtn: { marginTop: Spacing.xl, padding: Spacing.md, alignItems: 'center' },
  logoutText: { color: colors.textTertiary, fontFamily: Typography.fontFamily.medium, fontSize: Typography.fontSize.md },
});

export default OwnerPaymentScreen;
