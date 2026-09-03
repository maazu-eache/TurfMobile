import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Keyboard, StatusBar } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useDispatch, useSelector } from 'react-redux';
import { forgotPassword, verifyResetOtp, resetPassword, clearError } from '../authSlice';
import { useTheme, Colors, Typography, Spacing, BorderRadius } from '../../../theme/theme';
import { showCustomAlert } from '../../../components/CustomAlert';

const ForgotPasswordScreen = ({ navigation }) => {
  const { colors, shadows, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, shadows, isDark), [colors, shadows, isDark]);
  const [phase, setPhase] = useState(1); // 1 = Email, 2 = OTP, 3 = New Password
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [focusedInput, setFocusedInput] = useState(null);
  const [localLoading, setLocalLoading] = useState(false);

  const dispatch = useDispatch();
  const { isLoading, error } = useSelector((state) => state.auth);
  const insets = useSafeAreaInsets();
  const isSubmitting = isLoading || localLoading;

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        dispatch(clearError());
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, dispatch]);

  const handleSendOTP = async () => {
    if (!email.trim()) return showCustomAlert('Error', 'Please enter your email address');
    Keyboard.dismiss();
    dispatch(clearError());
    setLocalLoading(true);
    
    try {
      const result = await dispatch(forgotPassword(email.trim().toLowerCase()));
      if (forgotPassword.fulfilled.match(result)) {
        setPhase(2);
        showCustomAlert('Success', 'An OTP has been sent to your email.');
      } else {
        showCustomAlert('Error', result.payload || 'Failed to send reset email');
      }
    } finally {
      setLocalLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otp.trim()) return showCustomAlert('Error', 'Please enter the 6-digit OTP');
    Keyboard.dismiss();
    dispatch(clearError());
    setLocalLoading(true);

    try {
      const result = await dispatch(verifyResetOtp({
        email: email.trim().toLowerCase(),
        otp: otp.trim()
      }));

      if (verifyResetOtp.fulfilled.match(result)) {
        setPhase(3);
      } else {
        showCustomAlert('Error', result.payload || 'Invalid or expired OTP');
      }
    } finally {
      setLocalLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword) return showCustomAlert('Error', 'Please enter a new password');
    if (newPassword !== confirmPassword) return showCustomAlert('Error', 'Passwords do not match');
    
    Keyboard.dismiss();
    dispatch(clearError());
    setLocalLoading(true);

    try {
      const result = await dispatch(resetPassword({
        email: email.trim().toLowerCase(),
        otp: otp.trim(),
        newPassword
      }));

      if (resetPassword.fulfilled.match(result)) {
        showCustomAlert('Success', 'Password reset successfully! Please log in with your new password.');
        navigation.navigate('Login');
      } else {
        showCustomAlert('Error', result.payload || 'Failed to reset password');
      }
    } finally {
      setLocalLoading(false);
    }
  };

  const renderInput = (id, icon, placeholder, value, setValue, options = {}) => {
    const isFocused = focusedInput === id;
    const isPasswordField = id === 'newPassword';
    const isConfirmPasswordField = id === 'confirmPassword';
    const isPasswordType = isPasswordField || isConfirmPasswordField;
    
    let secureTextEntry = false;
    if (isPasswordField) secureTextEntry = !showNewPassword;
    if (isConfirmPasswordField) secureTextEntry = !showConfirmPassword;

    return (
      <View style={[styles.inputContainer, isFocused && styles.inputFocused]}>
        <Icon 
          name={icon} 
          size={22} 
          color={isFocused ? (isDark ? Colors.primary : colors.primaryDark) : colors.textTertiary} 
          style={styles.inputIcon} 
        />
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={colors.textTertiary}
          value={value}
          onChangeText={setValue}
          onFocus={() => setFocusedInput(id)}
          onBlur={() => setFocusedInput(null)}
          selectionColor={Colors.primary}
          secureTextEntry={isPasswordType ? secureTextEntry : false}
          {...options}
        />
        {isPasswordType && (
          <TouchableOpacity 
            onPress={() => isPasswordField ? setShowNewPassword(!showNewPassword) : setShowConfirmPassword(!showConfirmPassword)} 
            style={styles.eyeIcon}
            activeOpacity={0.7}
          >
            <Icon name={secureTextEntry ? "eye-outline" : "eye-off-outline"} size={22} color={colors.textTertiary} />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      <KeyboardAwareScrollView 
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 20 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => phase === 2 ? setPhase(1) : navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
            <Icon name="chevron-left" size={28} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <View style={styles.headerTextContainer}>
          <Text style={styles.title}>
            {phase === 1 ? 'Forgot Password' : phase === 2 ? 'Verify OTP' : 'Reset Password'}
          </Text>
          <Text style={styles.subtitle}>
            {phase === 1 ? 'Enter your email to receive a reset OTP' : phase === 2 ? 'Enter the OTP sent to your email' : 'Enter your new password'}
          </Text>
        </View>

        <View style={styles.authCard}>
          {phase === 1 && (
            <>
              {renderInput('email', 'email-outline', 'Email Address', email, setEmail, { keyboardType: 'email-address', autoCapitalize: 'none' })}
              {error ? <Text style={styles.error}>{error}</Text> : null}
              
              <TouchableOpacity style={styles.actionBtn} onPress={handleSendOTP} disabled={isSubmitting} activeOpacity={0.85}>
                {isSubmitting ? <ActivityIndicator size="small" color="#000000" /> : <Text style={styles.actionBtnText}>Send OTP</Text>}
              </TouchableOpacity>
            </>
          )}

          {phase === 2 && (
            <>
              {renderInput('otp', 'message-processing-outline', '6-digit OTP', otp, setOtp, { keyboardType: 'number-pad', maxLength: 6 })}
              {error ? <Text style={styles.error}>{error}</Text> : null}
              
              <TouchableOpacity style={styles.actionBtn} onPress={handleVerifyOTP} disabled={isSubmitting} activeOpacity={0.85}>
                {isSubmitting ? <ActivityIndicator size="small" color="#000000" /> : <Text style={styles.actionBtnText}>Verify OTP</Text>}
              </TouchableOpacity>
            </>
          )}

          {phase === 3 && (
            <>
              {renderInput('newPassword', 'lock-outline', 'New Password', newPassword, setNewPassword)}
              <View style={{ height: 16 }} />
              {renderInput('confirmPassword', 'lock-check-outline', 'Confirm New Password', confirmPassword, setConfirmPassword)}
              
              {error ? <Text style={styles.error}>{error}</Text> : null}
              
              <TouchableOpacity style={styles.actionBtn} onPress={handleResetPassword} disabled={isSubmitting} activeOpacity={0.85}>
                {isSubmitting ? <ActivityIndicator size="small" color="#000000" /> : <Text style={styles.actionBtnText}>Reset Password</Text>}
              </TouchableOpacity>
            </>
          )}
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
};

const createStyles = (colors, shadows, isDark) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 40 },
  topBar: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  backBtn: { 
    width: 44, height: 44, borderRadius: 22, 
    backgroundColor: isDark ? colors.surface : colors.surfaceVariant, 
    justifyContent: 'center', alignItems: 'center', 
    borderWidth: 1, borderColor: colors.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: isDark ? 0.3 : 0.06, shadowRadius: 4, elevation: 2,
  },
  headerTextContainer: { alignItems: 'center', marginBottom: 28 },
  title: { fontSize: 28, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary },
  subtitle: { fontSize: 14, fontFamily: Typography.fontFamily.regular, color: colors.textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  authCard: {
    backgroundColor: colors.surface, 
    borderRadius: 24, 
    padding: 24,
    borderWidth: 1, 
    borderColor: colors.border,
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: isDark ? 0.4 : 0.08, 
    shadowRadius: 12, 
    elevation: 4,
  },
  inputContainer: {
    flexDirection: 'row', alignItems: 'center', height: 56, borderRadius: 16,
    backgroundColor: isDark ? colors.background : colors.surfaceVariant, 
    borderWidth: 1, 
    borderColor: colors.border,
    paddingHorizontal: 16,
  },
  inputFocused: { 
    borderColor: Colors.primary, 
    backgroundColor: isDark ? colors.backgroundElevated : colors.surface,
  },
  inputIcon: { marginRight: 12 },
  eyeIcon: { padding: 4 },
  input: { flex: 1, color: colors.textPrimary, fontFamily: Typography.fontFamily.medium, fontSize: 15 },
  error: { color: colors.error, fontFamily: Typography.fontFamily.medium, fontSize: 13, marginTop: 12, textAlign: 'center' },
  actionBtn: {
    height: 54, borderRadius: 16, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', marginTop: 24,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 4,
  },
  actionBtnText: { fontSize: 16, fontFamily: Typography.fontFamily.bold, color: '#000000' },
});

export default ForgotPasswordScreen;
