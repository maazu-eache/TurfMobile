import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, Animated, Easing, Keyboard, Platform
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useDispatch, useSelector } from 'react-redux';
import { verifyOTP, sendOTP } from '../authSlice';
import { showCustomAlert } from '../../../components/CustomAlert';
import NotificationService from '../../../services/NotificationService';
import { Typography } from '../../../theme/theme'; // Just for fonts if needed

const OTP_LENGTH = 6;
const RESEND_COUNTDOWN = 60;

const OTPVerifyScreen = ({ navigation, route }) => {
  const { email, role } = route.params;
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();
  
  const [otp, setOtp] = useState(Array(OTP_LENGTH).fill(''));
  const [countdown, setCountdown] = useState(RESEND_COUNTDOWN);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const { isLoading } = useSelector((state) => state.auth);
  const refs = useRef([]);

  // Animations
  const heroAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const btnScale = useRef(new Animated.Value(1)).current;
  const particles = useRef([...Array(4)].map(() => new Animated.Value(0))).current;

  // Box animations
  const boxScales = useRef([...Array(OTP_LENGTH)].map(() => new Animated.Value(1))).current;

  useEffect(() => {
    // Floating Hero Animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(heroAnim, { toValue: -8, duration: 2500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(heroAnim, { toValue: 0, duration: 2500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();

    // Subtle Rotation
    Animated.loop(
      Animated.sequence([
        Animated.timing(rotateAnim, { toValue: 1, duration: 4000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(rotateAnim, { toValue: -1, duration: 8000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(rotateAnim, { toValue: 0, duration: 4000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();

    // Floating Particles
    particles.forEach((p, i) => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(p, { toValue: 1, duration: 3000 + i * 500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(p, { toValue: 0, duration: 3000 + i * 500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      ).start();
    });
  }, []);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const animateBoxFocus = (index) => {
    Animated.spring(boxScales[index], {
      toValue: 1.05,
      friction: 5,
      useNativeDriver: true,
    }).start();
  };

  const animateBoxBlur = (index) => {
    Animated.spring(boxScales[index], {
      toValue: 1,
      friction: 5,
      useNativeDriver: true,
    }).start();
  };

  const animateBoxPop = (index) => {
    Animated.sequence([
      Animated.timing(boxScales[index], { toValue: 1.15, duration: 100, useNativeDriver: true }),
      Animated.timing(boxScales[index], { toValue: 1, duration: 150, useNativeDriver: true }),
    ]).start();
  };

  const handleChange = (text, index) => {
    const newOtp = [...otp];
    newOtp[index] = text.slice(-1);
    setOtp(newOtp);

    if (text) animateBoxPop(index);

    if (text && index < OTP_LENGTH - 1) {
      refs.current[index + 1]?.focus();
      setFocusedIndex(index + 1);
    } else if (text && index === OTP_LENGTH - 1) {
      Keyboard.dismiss();
    }
  };

  const handleKeyPress = ({ nativeEvent: { key } }, index) => {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      refs.current[index - 1]?.focus();
      setFocusedIndex(index - 1);
    }
  };

  const handleVerify = async () => {
    const code = otp.join('');
    if (code.length !== OTP_LENGTH) {
      return showCustomAlert('Incomplete', 'Please enter the 6-digit OTP code.');
    }
    const fcmToken = await NotificationService.getFCMToken();
    const result = await dispatch(verifyOTP({ email, otp: code, role, fcmToken }));
    if (verifyOTP.rejected.match(result)) {
      showCustomAlert('Invalid OTP', result.payload);
      setOtp(Array(OTP_LENGTH).fill(''));
      refs.current[0]?.focus();
      setFocusedIndex(0);
    }
  };

  const handleResend = async () => {
    if (countdown > 0) return;
    await dispatch(sendOTP({ email }));
    setCountdown(RESEND_COUNTDOWN);
    setOtp(Array(OTP_LENGTH).fill(''));
    refs.current[0]?.focus();
    setFocusedIndex(0);
  };

  const animateBtnPressIn = () => {
    Animated.spring(btnScale, { toValue: 0.96, useNativeDriver: true }).start();
  };
  const animateBtnPressOut = () => {
    Animated.spring(btnScale, { toValue: 1, friction: 3, tension: 40, useNativeDriver: true }).start();
  };

  const maskedEmail = email.replace(/(.{2})(.*)(?=@)/, (_, a, b) => a + '*'.repeat(b.length));

  return (
    <View style={styles.container}>
      {/* Background Radial Glow */}
      <View style={styles.radialGlow} />

      <KeyboardAwareScrollView 
        enableOnAndroid={true} 
        extraScrollHeight={30} 
        keyboardShouldPersistTaps="handled" 
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 20 }]}
      >
        {/* Top Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
            <Icon name="chevron-left" size={28} color="#FFF" />
          </TouchableOpacity>
        </View>

        {/* 3D Hero Icon */}
        <View style={styles.heroContainer}>
          {particles.map((p, i) => {
             const angle = (i * Math.PI * 2) / particles.length;
             return (
               <Animated.View key={i} style={[
                 styles.particle,
                 { 
                   transform: [
                     { translateX: p.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(angle) * 30] }) },
                     { translateY: p.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(angle) * 30] }) },
                     { scale: p.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.2] }) }
                   ],
                   opacity: p.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0] })
                 }
               ]} />
             );
          })}
          
          <Animated.View style={[styles.icon3DWrapper, { 
            transform: [
              { translateY: heroAnim },
              { rotateZ: rotateAnim.interpolate({ inputRange: [-1, 1], outputRange: ['-3deg', '3deg'] }) }
            ] 
          }]}>
            <View style={styles.icon3DGlass}>
              <Icon name="email-lock" size={48} color="#FFD400" />
            </View>
          </Animated.View>
        </View>

        {/* Header Text */}
        <View style={styles.headerTextContainer}>
          <Text style={styles.title}>Verify Your Email</Text>
          <Text style={styles.subtitle}>
            Enter the 6-digit verification code sent to{'\n'}
            <Text style={styles.emailHighlight}>{maskedEmail}</Text>
          </Text>
        </View>

        {/* OTP Input Boxes */}
        <View style={styles.otpRow}>
          {Array(OTP_LENGTH).fill(0).map((_, i) => {
            const isFocused = focusedIndex === i;
            return (
              <Animated.View 
                key={i} 
                style={[
                  styles.otpBoxContainer,
                  isFocused && styles.otpBoxFocused,
                  otp[i] !== '' && styles.otpBoxFilled,
                  { transform: [{ scale: boxScales[i] }] }
                ]}
              >
                <TextInput
                  ref={(r) => (refs.current[i] = r)}
                  style={styles.otpInput}
                  maxLength={1}
                  keyboardType="number-pad"
                  value={otp[i]}
                  onChangeText={(text) => handleChange(text, i)}
                  onKeyPress={(e) => handleKeyPress(e, i)}
                  onFocus={() => { setFocusedIndex(i); animateBoxFocus(i); }}
                  onBlur={() => { animateBoxBlur(i); }}
                  selectTextOnFocus
                  textContentType="oneTimeCode"
                  autoComplete="sms-otp"
                />
              </Animated.View>
            )
          })}
        </View>

        {/* Verify Button */}
        <Animated.View style={{ transform: [{ scale: btnScale }], marginTop: 30 }}>
          <TouchableOpacity 
            style={[styles.verifyBtn, isLoading && styles.verifyBtnDisabled]}
            activeOpacity={1}
            onPressIn={animateBtnPressIn}
            onPressOut={animateBtnPressOut}
            onPress={handleVerify}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#000" size="small" />
            ) : (
              <Text style={styles.verifyBtnText}>Verify Code</Text>
            )}
          </TouchableOpacity>
        </Animated.View>

        {/* Resend Section */}
        <View style={styles.resendContainer}>
          <Text style={styles.resendPrefix}>Didn't receive the code? </Text>
          <TouchableOpacity onPress={handleResend} disabled={countdown > 0}>
            <Text style={[styles.resendText, countdown > 0 && styles.resendDisabled]}>
              {countdown > 0 ? `Resend in 00:${countdown.toString().padStart(2, '0')}` : 'Resend Code'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Security Info Card */}
        <View style={styles.securityCard}>
          <View style={styles.securityIconBox}>
            <Icon name="shield-check" size={24} color="#FFD400" />
          </View>
          <View style={styles.securityTextContent}>
            <Text style={styles.securityTitle}>Secure Verification</Text>
            <Text style={styles.securityDesc}>Your verification code expires in 10 minutes.{'\n'}Never share your OTP with anyone.</Text>
          </View>
        </View>

      </KeyboardAwareScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  radialGlow: {
    position: 'absolute', top: '10%', left: '15%', right: '15%', height: 300,
    backgroundColor: '#FFD400', borderRadius: 200, opacity: 0.08, filter: 'blur(60px)',
  },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 40 },
  
  topBar: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#171717', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#2A2A2A' },
  
  heroContainer: { alignItems: 'center', justifyContent: 'center', height: 160, marginVertical: 10, position: 'relative' },
  icon3DWrapper: {
    shadowColor: '#FFD400', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 10,
  },
  icon3DGlass: {
    width: 96, height: 96, borderRadius: 48, backgroundColor: '#171717', borderWidth: 1, borderColor: '#333',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.6, shadowRadius: 15, elevation: 8,
  },
  particle: {
    position: 'absolute', width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(255, 212, 0, 0.4)', blurRadius: 4,
  },

  headerTextContainer: { alignItems: 'center', marginBottom: 36 },
  title: { fontSize: 32, fontFamily: Typography.fontFamily.bold, color: '#FFFFFF', marginBottom: 12 },
  subtitle: { fontSize: 14, fontFamily: Typography.fontFamily.medium, color: '#A0A0A0', textAlign: 'center', lineHeight: 22 },
  emailHighlight: { color: '#FFD400', fontFamily: Typography.fontFamily.bold },

  otpRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  otpBoxContainer: {
    width: 50, height: 62, borderRadius: 18, backgroundColor: '#171717', borderWidth: 1.5, borderColor: '#2A2A2A',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 6, elevation: 4,
  },
  otpBoxFocused: {
    borderColor: '#FFD400', backgroundColor: '#1A1A1A',
    shadowColor: '#FFD400', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 8,
  },
  otpBoxFilled: { borderColor: '#444' },
  otpInput: {
    width: '100%', height: '100%', textAlign: 'center', fontSize: 24, fontFamily: Typography.fontFamily.bold, color: '#FFFFFF', padding: 0,
  },

  verifyBtn: {
    height: 56, borderRadius: 18, backgroundColor: '#FFD400', justifyContent: 'center', alignItems: 'center',
    shadowColor: '#FFD400', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 15, elevation: 8,
  },
  verifyBtnDisabled: { backgroundColor: '#333', shadowOpacity: 0 },
  verifyBtnText: { fontSize: 16, fontFamily: Typography.fontFamily.bold, color: '#000000' },

  resendContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 24 },
  resendPrefix: { fontSize: 14, fontFamily: Typography.fontFamily.medium, color: '#A0A0A0' },
  resendText: { fontSize: 14, fontFamily: Typography.fontFamily.bold, color: '#FFD400' },
  resendDisabled: { color: '#555' },

  securityCard: {
    marginTop: 60, flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: '#171717', borderRadius: 18, padding: 16,
    borderWidth: 1, borderColor: '#333',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 5,
  },
  securityIconBox: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255, 212, 0, 0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  securityTextContent: { flex: 1 },
  securityTitle: { fontSize: 14, fontFamily: Typography.fontFamily.bold, color: '#FFFFFF', marginBottom: 4 },
  securityDesc: { fontSize: 12, fontFamily: Typography.fontFamily.medium, color: '#A0A0A0', lineHeight: 18 },
});

export default OTPVerifyScreen;
