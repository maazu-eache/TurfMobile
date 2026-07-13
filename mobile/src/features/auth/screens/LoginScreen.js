import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, Image,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useDispatch, useSelector } from 'react-redux';
import { sendOTP, clearError, setGuestMode } from '../authSlice';
import { Colors, Typography, Spacing, BorderRadius } from '../../../theme/theme';
import { showCustomAlert } from '../../../components/CustomAlert';


const LoginScreen = ({ navigation }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [registerRole, setRegisterRole] = useState('customer');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const dispatch = useDispatch();
  const { isLoading, error } = useSelector((state) => state.auth);

  const handleSendOTP = async () => {
    if (!email.trim()) return showCustomAlert('Error', 'Please enter your email');
    if (!isLogin) {
      if (!name.trim()) return showCustomAlert('Error', 'Please enter your full name');
      if (!mobile.trim() || mobile.trim().length !== 10 || !/^\d+$/.test(mobile.trim())) {
        return showCustomAlert('Error', 'Please enter a valid 10-digit phone number');
      }
    }
    
    const result = await dispatch(sendOTP({ email: email.trim().toLowerCase(), name: name.trim(), mobile: mobile.trim(), isLogin }));
    if (sendOTP.fulfilled.match(result)) {
      navigation.navigate('OTPVerify', { 
        email: email.trim().toLowerCase(),
        role: !isLogin ? registerRole : null 
      });
    } else {
      showCustomAlert('Error', result.payload || 'Failed to send OTP');
    }
  };

  return (
    <LinearGradient colors={Colors.gradients.dark} style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.inner}>
        
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={28} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={styles.glassCard}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logoCol}>
              <View style={styles.logoGlow}>
                <Image 
                  source={require('../../../../Rough_Turf.png')} 
                  style={styles.logoImageLarge} 
                  resizeMode="contain" 
                />
              </View>
              <Text style={styles.logo}>ROUGH <Text style={{ color: Colors.primary }}>TURF</Text></Text>
            </View>
            {/* <Text style={styles.title}>{isLogin ? 'Welcome Back!' : 'Create Account'}</Text> */}
            <Text style={styles.subtitle}>
              {isLogin ? 'Enter your email to log in' : 'Join RoughTurf today'}
            </Text>
          </View>

        {/* Form */}
        <View style={styles.form}>
          {!isLogin && (
            <>
              <View style={styles.roleContainer}>
                <TouchableOpacity 
                  style={[styles.roleTab, registerRole === 'customer' && styles.roleTabActive]}
                  onPress={() => setRegisterRole('customer')}
                >
                  <Text style={[styles.roleText, registerRole === 'customer' && styles.roleTextActive]}>Player</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.roleTab, registerRole === 'owner' && styles.roleTabActive]}
                  onPress={() => setRegisterRole('owner')}
                >
                  <Text style={[styles.roleText, registerRole === 'owner' && styles.roleTextActive]}>Turf Owner</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Full Name</Text>
                <View style={styles.inputWrapper}>
                  <Icon name="account-outline" size={20} color="rgba(255,255,255,0.4)" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="John Doe"
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    value={name}
                    onChangeText={setName}
                    autoCapitalize="words"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Phone Number</Text>
                <View style={styles.inputWrapper}>
                  <Icon name="phone-outline" size={20} color="rgba(255,255,255,0.4)" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="1234567890"
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    value={mobile}
                    onChangeText={setMobile}
                    keyboardType="phone-pad"
                    maxLength={10}
                  />
                </View>
              </View>
            </>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email Address</Text>
            <View style={styles.inputWrapper}>
              <Icon name="email-outline" size={20} color="rgba(255,255,255,0.4)" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="you@example.com"
                placeholderTextColor="rgba(255,255,255,0.4)"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity style={styles.button} onPress={handleSendOTP} disabled={isLoading} activeOpacity={0.8}>
            <LinearGradient colors={Colors.gradients.primary} style={styles.buttonGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              {isLoading ? (
                <ActivityIndicator color="#000" />
              ) : (
                <>
                  <Text style={styles.buttonText}>Send OTP</Text>
                  <Icon name="arrow-right" size={20} color="#000" />
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.toggleButton} 
            onPress={() => {
              setIsLogin(!isLogin);
              dispatch(clearError());
            }}
            disabled={isLoading}
          >
            <Text style={styles.toggleText}>
              {isLogin ? "Don't have an account? " : "Already have an account? "}
              <Text style={styles.toggleTextBold}>{isLogin ? "Sign up" : "Log in"}</Text>
            </Text>
          </TouchableOpacity>
        </View>
        </View>

        <Text style={styles.terms}>
          By continuing, you agree to our{' '}
          <Text style={styles.link}>Terms of Service</Text> and{' '}
          <Text style={styles.link}>Privacy Policy</Text>
        </Text>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1, justifyContent: 'center', padding: Spacing.xl },
  glassCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 32,
    padding: Spacing.xl,
    paddingVertical: Spacing['2xl'],
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  header: { marginBottom: Spacing['3xl'], alignItems: 'center' },
  logoCol: {
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  logoGlow: {
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
    marginBottom: Spacing.sm,
  },
  logoImageLarge: {
    width: 80, 
    height: 80, 
    borderRadius: 20, // To make the white background look like an app icon
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  logo: {
    fontSize: 36,
    fontFamily: Typography.fontFamily.extraBold,
    color: '#FFFFFF',
    letterSpacing: -0.5,
    fontWeight: 700,
    fontStyle:'italic'
  },
  title: {
    fontSize: Typography.fontSize['2xl'],
    fontFamily: Typography.fontFamily.extraBold,
    color: '#FFFFFF',
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: Typography.fontSize.md,
    fontFamily: Typography.fontFamily.regular,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 22,
    textAlign: 'center',
    fontStyle:'italic'
  },
  form: { gap: Spacing.base },
  roleContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    padding: 4,
    marginBottom: Spacing.sm,
  },
  roleTab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: BorderRadius.md,
  },
  roleTabActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  roleText: {
    fontFamily: Typography.fontFamily.medium,
    color: 'rgba(255,255,255,0.5)',
    fontSize: Typography.fontSize.sm,
  },
  roleTextActive: {
    color: '#FFFFFF',
    fontFamily: Typography.fontFamily.bold,
  },
  inputGroup: { gap: Spacing.xs },
  label: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.medium,
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
  },
  inputIcon: {
    marginRight: Spacing.sm,
  },
  input: {
    flex: 1,
    color: '#FFFFFF',
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.base,
    paddingVertical: Platform.OS === 'ios' ? 16 : 14,
  },
  error: {
    color: Colors.error,
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.sm,
  },
  button: {
    marginTop: Spacing.sm,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 8,
  },
  buttonGradient: {
    paddingVertical: 16,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    height: 54,
  },
  buttonText: {
    fontSize: Typography.fontSize.md,
    fontFamily: Typography.fontFamily.bold,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  toggleButton: {
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  toggleText: {
    fontSize: Typography.fontSize.md,
    fontFamily: Typography.fontFamily.regular,
    color: 'rgba(255,255,255,0.7)',
    fontWeight:700,
    fontStyle:'italic'
  },
  toggleTextBold: {
    fontFamily: Typography.fontFamily.bold,
    color: '#FFFFFF',
  },
  terms: {
    marginTop: Spacing['2xl'],
    textAlign: 'center',
    fontSize: Typography.fontSize.xs,
    color: 'rgba(255,255,255,0.5)',
    fontFamily: Typography.fontFamily.regular,
    lineHeight: 18,
  },
  link: { color: Colors.primary },
});
export default LoginScreen;
