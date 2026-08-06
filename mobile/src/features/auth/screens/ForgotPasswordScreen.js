import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Keyboard } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useDispatch, useSelector } from 'react-redux';
import { forgotPassword, verifyResetOtp, resetPassword, clearError } from '../authSlice';
import { Colors, Typography } from '../../../theme/theme';
import { showCustomAlert } from '../../../components/CustomAlert';

const ForgotPasswordScreen = ({ navigation }) => {
  const [phase, setPhase] = useState(1); // 1 = Email, 2 = OTP, 3 = New Password
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [focusedInput, setFocusedInput] = useState(null);

  const dispatch = useDispatch();
  const { isLoading, error } = useSelector((state) => state.auth);
  const insets = useSafeAreaInsets();

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
    
    const result = await dispatch(forgotPassword(email.trim().toLowerCase()));
    if (forgotPassword.fulfilled.match(result)) {
      setPhase(2);
      showCustomAlert('Success', 'An OTP has been sent to your email.');
    } else {
      showCustomAlert('Error', result.payload || 'Failed to send reset email');
    }
  };

  const handleVerifyOTP = async () => {
    if (!otp.trim()) return showCustomAlert('Error', 'Please enter the 6-digit OTP');
    Keyboard.dismiss();
    dispatch(clearError());

    const result = await dispatch(verifyResetOtp({
      email: email.trim().toLowerCase(),
      otp: otp.trim()
    }));

    if (verifyResetOtp.fulfilled.match(result)) {
      setPhase(3);
    } else {
      showCustomAlert('Error', result.payload || 'Invalid or expired OTP');
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword) return showCustomAlert('Error', 'Please enter a new password');
    if (newPassword !== confirmPassword) return showCustomAlert('Error', 'Passwords do not match');
    
    Keyboard.dismiss();
    dispatch(clearError());

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
        <Icon name={icon} size={22} color={isFocused ? '#FFD400' : 'rgba(255,255,255,0.4)'} style={styles.inputIcon} />
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor="rgba(255,255,255,0.4)"
          value={value}
          onChangeText={setValue}
          onFocus={() => setFocusedInput(id)}
          onBlur={() => setFocusedInput(null)}
          selectionColor="#FFD400"
          secureTextEntry={isPasswordType ? secureTextEntry : false}
          {...options}
        />
        {isPasswordType && (
          <TouchableOpacity 
            onPress={() => isPasswordField ? setShowNewPassword(!showNewPassword) : setShowConfirmPassword(!showConfirmPassword)} 
            style={styles.eyeIcon}
          >
            <Icon name={secureTextEntry ? "eye-outline" : "eye-off-outline"} size={22} color="rgba(255,255,255,0.4)" />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <KeyboardAwareScrollView 
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 20 }]}
      >
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => phase === 2 ? setPhase(1) : navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
            <Icon name="chevron-left" size={28} color="#FFF" />
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
              
              <TouchableOpacity style={styles.actionBtn} onPress={handleSendOTP} disabled={isLoading}>
                {isLoading ? <ActivityIndicator color="#000" /> : <Text style={styles.actionBtnText}>Send OTP</Text>}
              </TouchableOpacity>
            </>
          )}

          {phase === 2 && (
            <>
              {renderInput('otp', 'message-processing-outline', '6-digit OTP', otp, setOtp, { keyboardType: 'number-pad', maxLength: 6 })}
              {error ? <Text style={styles.error}>{error}</Text> : null}
              
              <TouchableOpacity style={styles.actionBtn} onPress={handleVerifyOTP} disabled={isLoading}>
                {isLoading ? <ActivityIndicator color="#000" /> : <Text style={styles.actionBtnText}>Verify OTP</Text>}
              </TouchableOpacity>
            </>
          )}

          {phase === 3 && (
            <>
              {renderInput('newPassword', 'lock-outline', 'New Password', newPassword, setNewPassword)}
              <View style={{ height: 16 }} />
              {renderInput('confirmPassword', 'lock-check-outline', 'Confirm New Password', confirmPassword, setConfirmPassword)}
              
              {error ? <Text style={styles.error}>{error}</Text> : null}
              
              <TouchableOpacity style={styles.actionBtn} onPress={handleResetPassword} disabled={isLoading}>
                {isLoading ? <ActivityIndicator color="#000" /> : <Text style={styles.actionBtnText}>Reset Password</Text>}
              </TouchableOpacity>
            </>
          )}
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 40 },
  topBar: { flexDirection: 'row', alignItems: 'center', marginBottom: 30 },
  backBtn: { 
    width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(23, 23, 23, 0.8)', 
    justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerTextContainer: { alignItems: 'center', marginBottom: 36 },
  title: { fontSize: 32, fontFamily: Typography.fontFamily.bold, color: '#FFFFFF' },
  subtitle: { fontSize: 16, fontFamily: Typography.fontFamily.regular, color: '#A0A0A0', textAlign: 'center', marginTop: 8 },
  authCard: {
    backgroundColor: 'rgba(23, 23, 23, 0.4)', borderRadius: 32, padding: 24,
    borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  inputContainer: {
    flexDirection: 'row', alignItems: 'center', height: 60, borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.4)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 16,
  },
  inputFocused: { borderColor: '#FFD400', backgroundColor: 'rgba(26, 26, 26, 0.8)' },
  inputIcon: { marginRight: 12 },
  eyeIcon: { padding: 4 },
  input: { flex: 1, color: '#FFFFFF', fontFamily: Typography.fontFamily.medium, fontSize: 16 },
  error: { color: Colors.error, fontFamily: Typography.fontFamily.medium, fontSize: 13, marginTop: 12, textAlign: 'center' },
  actionBtn: {
    height: 60, borderRadius: 20, backgroundColor: '#FFD400', justifyContent: 'center', alignItems: 'center', marginTop: 24,
  },
  actionBtnText: { fontSize: 18, fontFamily: Typography.fontFamily.bold, color: '#000000' },
});

export default ForgotPasswordScreen;
