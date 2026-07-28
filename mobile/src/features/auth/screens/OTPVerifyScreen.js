import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  Platform, ActivityIndicator,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import LinearGradient from '../../../components/SolidGradient';
import { useDispatch, useSelector } from 'react-redux';
import { verifyOTP, sendOTP } from '../authSlice';
import { Colors, Typography, Spacing, BorderRadius } from '../../../theme/theme';
import { showCustomAlert } from '../../../components/CustomAlert';
import NotificationService from '../../../services/NotificationService';


const OTP_LENGTH = 6;
const RESEND_COUNTDOWN = 60;

const OTPVerifyScreen = ({ navigation, route }) => {
  const { email, role } = route.params;
  const [otp, setOtp] = useState(Array(OTP_LENGTH).fill(''));
  const [countdown, setCountdown] = useState(RESEND_COUNTDOWN);
  const refs = useRef([]);
  const dispatch = useDispatch();
  const { isLoading, error } = useSelector((state) => state.auth);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const handleChange = (text, index) => {
    const newOtp = [...otp];
    newOtp[index] = text.slice(-1);
    setOtp(newOtp);
    if (text && index < OTP_LENGTH - 1) refs.current[index + 1]?.focus();
    if (newOtp.every((d) => d !== '')) handleVerify(newOtp.join(''));
  };

  const handleKeyPress = ({ nativeEvent: { key } }, index) => {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async (code) => {
    const fcmToken = await NotificationService.getFCMToken();
    const result = await dispatch(verifyOTP({ email, otp: code, role, fcmToken }));
    if (verifyOTP.rejected.match(result)) {
      showCustomAlert('Invalid OTP', result.payload);
      setOtp(Array(OTP_LENGTH).fill(''));
      refs.current[0]?.focus();
    }
  };

  const handleResend = async () => {
    if (countdown > 0) return;
    await dispatch(sendOTP({ email }));
    setCountdown(RESEND_COUNTDOWN);
    setOtp(Array(OTP_LENGTH).fill(''));
    refs.current[0]?.focus();
  };

  const maskedEmail = email.replace(/(.{2})(.*)(?=@)/, (_, a, b) => a + '*'.repeat(b.length));

  return (
    <LinearGradient colors={Colors.gradients.dark} style={styles.container}>
      <KeyboardAwareScrollView enableOnAndroid={true} extraScrollHeight={20} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.innerContent} style={styles.inner}>
        {/* Back */}
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.emailIcon}>📧</Text>
          <Text style={styles.title}>Verify your email</Text>
          <Text style={styles.subtitle}>
            We sent a 6-digit code to{'\n'}<Text style={styles.email}>{maskedEmail}</Text>
          </Text>
        </View>

        {/* OTP Inputs */}
        <View style={styles.otpRow}>
          {Array(OTP_LENGTH).fill(0).map((_, i) => (
            <TextInput
              key={i}
              ref={(r) => (refs.current[i] = r)}
              style={[styles.otpInput, otp[i] && styles.otpInputFilled]}
              maxLength={1}
              keyboardType="number-pad"
              value={otp[i]}
              onChangeText={(text) => handleChange(text, i)}
              onKeyPress={(e) => handleKeyPress(e, i)}
              selectTextOnFocus
              textContentType="oneTimeCode"
              autoComplete="sms-otp"
            />
          ))}
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        <View style={styles.loaderContainer}>
          {isLoading && <ActivityIndicator color={Colors.primary} size="large" />}
        </View>

        {/* Resend */}
        <TouchableOpacity onPress={handleResend} disabled={countdown > 0}>
          <Text style={[styles.resend, countdown > 0 && styles.resendDisabled]}>
            {countdown > 0 ? `Resend OTP in ${countdown}s` : 'Resend OTP'}
          </Text>
        </TouchableOpacity>
      </KeyboardAwareScrollView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1 },
  innerContent: { flexGrow: 1, justifyContent: 'center', padding: Spacing['2xl'] },
  back: { position: 'absolute', top: 60, left: Spacing['2xl'] },
  backText: { color: Colors.primary, fontFamily: Typography.fontFamily.medium, fontSize: Typography.fontSize.md },
  header: { alignItems: 'center', marginBottom: Spacing['3xl'] },
  emailIcon: { fontSize: 56, marginBottom: Spacing.base },
  title: {
    fontSize: Typography.fontSize['3xl'],
    fontFamily: Typography.fontFamily.extraBold,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: Typography.fontSize.base,
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.regular,
    textAlign: 'center',
    lineHeight: 22,
  },
  email: { color: Colors.primary, fontFamily: Typography.fontFamily.semiBold },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing['2xl'],
  },
  otpInput: {
    width: 48,
    height: 60,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.backgroundElevated,
    borderWidth: 1.5,
    borderColor: Colors.border,
    textAlign: 'center',
    fontSize: Typography.fontSize['2xl'],
    fontFamily: Typography.fontFamily.bold,
    color: Colors.textPrimary,
  },
  otpInputFilled: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryAlpha10,
  },
  error: {
    color: Colors.error,
    textAlign: 'center',
    fontFamily: Typography.fontFamily.medium,
    marginBottom: Spacing.base,
  },
  loaderContainer: {
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.base,
  },
  resend: {
    textAlign: 'center',
    color: Colors.primary,
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.base,
  },
  resendDisabled: { color: Colors.textTertiary },
});

export default OTPVerifyScreen;
