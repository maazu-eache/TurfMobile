import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  Platform, ActivityIndicator, Image, Animated, Easing, Keyboard, Modal, ScrollView
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useDispatch, useSelector } from 'react-redux';
import { sendOTP, clearError } from '../authSlice';
import { Colors, Typography } from '../../../theme/theme';
import { showCustomAlert } from '../../../components/CustomAlert';
import LocationAutocomplete from '../../../components/LocationAutocomplete';

const LoginScreen = ({ navigation }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [registerRole, setRegisterRole] = useState('customer'); // 'customer' or 'owner'
  
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [city, setCity] = useState('');
  const [locationObj, setLocationObj] = useState(null);
  const [focusedInput, setFocusedInput] = useState(null);
  const [activeModal, setActiveModal] = useState(null); // 'terms' | 'privacy' | null

  const dispatch = useDispatch();
  const { isLoading, error } = useSelector((state) => state.auth);
  const insets = useSafeAreaInsets();

  // Animations
  const heroAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const btnScale = useRef(new Animated.Value(1)).current;
  const particles = useRef([...Array(5)].map(() => new Animated.Value(0))).current;
  const pageFade = useRef(new Animated.Value(0)).current;
  const pageSlide = useRef(new Animated.Value(30)).current;
  
  // Segment Sliding
  const segmentSlide = useRef(new Animated.Value(0)).current; // 0 for Player, 1 for Owner

  useEffect(() => {
    // Initial Page Load Animations
    Animated.parallel([
      Animated.timing(pageFade, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(pageSlide, { toValue: 0, duration: 800, easing: Easing.out(Easing.exp), useNativeDriver: true })
    ]).start();

    // Floating Hero Animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(heroAnim, { toValue: -6, duration: 3000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(heroAnim, { toValue: 0, duration: 3000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();

    // Subtle Rotation
    Animated.loop(
      Animated.sequence([
        Animated.timing(rotateAnim, { toValue: 1, duration: 5000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(rotateAnim, { toValue: -1, duration: 10000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(rotateAnim, { toValue: 0, duration: 5000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();

    // Floating Particles
    particles.forEach((p, i) => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(p, { toValue: 1, duration: 4000 + i * 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(p, { toValue: 0, duration: 4000 + i * 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      ).start();
    });
  }, []);

  // Animate segment selector when role changes
  useEffect(() => {
    Animated.spring(segmentSlide, {
      toValue: registerRole === 'customer' ? 0 : 1,
      friction: 6,
      tension: 40,
      useNativeDriver: true
    }).start();
  }, [registerRole]);

  const handleSendOTP = async () => {
    if (!email.trim()) return showCustomAlert('Error', 'Please enter your email');
    if (!isLogin) {
      if (!name.trim()) return showCustomAlert('Error', 'Please enter your full name');
      if (!mobile.trim() || mobile.trim().length !== 10 || !/^\d+$/.test(mobile.trim())) {
        return showCustomAlert('Error', 'Please enter a valid 10-digit phone number');
      }
      if (!locationObj || !city) {
        return showCustomAlert('Error', 'Please select your location');
      }
    }
    
    Keyboard.dismiss();
    const result = await dispatch(sendOTP({ 
      email: email.trim().toLowerCase(), 
      name: name.trim(), 
      mobile: mobile.trim(), 
      isLogin,
      city,
      locationObj,
      state: locationObj?.state || ''
    }));
    if (sendOTP.fulfilled.match(result)) {
      navigation.navigate('OTPVerify', { 
        email: email.trim().toLowerCase(),
        role: !isLogin ? registerRole : null 
      });
    } else {
      showCustomAlert('Error', result.payload || 'Failed to send OTP');
    }
  };

  const animateBtnPressIn = () => Animated.spring(btnScale, { toValue: 0.96, useNativeDriver: true }).start();
  const animateBtnPressOut = () => Animated.spring(btnScale, { toValue: 1, friction: 3, tension: 40, useNativeDriver: true }).start();

  const renderInput = (id, icon, placeholder, value, setValue, options = {}) => {
    const isFocused = focusedInput === id;
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
          {...options}
        />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Background Radial Glow */}
      <View style={styles.radialGlow} />

      {/* Floating Particles */}
      {particles.map((p, i) => {
         const angle = (i * Math.PI * 2) / particles.length;
         return (
           <Animated.View key={i} style={[
             styles.particle,
             { 
               transform: [
                 { translateX: p.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(angle) * 40] }) },
                 { translateY: p.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(angle) * 60] }) },
                 { scale: p.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.4] }) }
               ],
               opacity: p.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0] })
             }
           ]} />
         );
      })}

      <KeyboardAwareScrollView 
        enableOnAndroid={true} 
        extraScrollHeight={30} 
        keyboardShouldPersistTaps="handled" 
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 20, paddingBottom: 100 }]}
      >
        <Animated.View style={{ opacity: pageFade, transform: [{ translateY: pageSlide }], flexGrow: 1 }}>
          
          {/* Top Bar */}
          <View style={styles.topBar}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
              <Icon name="chevron-left" size={28} color="#FFF" />
            </TouchableOpacity>
          </View>

          {/* Floating Logo Container */}
          <View style={[styles.heroContainer, !isLogin && { height: 80, marginBottom: 10 }]}>
            <Animated.View style={[styles.icon3DWrapper, { 
              transform: [
                { translateY: heroAnim },
                { rotateZ: rotateAnim.interpolate({ inputRange: [-1, 1], outputRange: ['-4deg', '4deg'] }) }
              ] 
            }]}>
              <View style={[styles.logoGlass, !isLogin && { width: 64, height: 64, borderRadius: 20 }]}>
                <Image source={require('../../../../SportVerse.png')} style={[styles.logoImage, !isLogin && { width: 48, height: 48, borderRadius: 14 }]} resizeMode="contain" />
              </View>
            </Animated.View>
          </View>

          {/* Title */}
          <View style={[styles.headerTextContainer, !isLogin && { marginBottom: 20 }]}>
            {isLogin && <Text style={styles.title}>SCORE <Text style={styles.titleYellow}>VERSE</Text></Text>}
            <Text style={styles.subtitle}>
              {isLogin ? 'Enter your email to log in' : 'Join ScoreVerse today'}
            </Text>
          </View>

          {/* Authentication Card Layer */}
          <View style={styles.authCard}>
            
            {!isLogin && (
              <View style={styles.segmentContainer}>
                <Animated.View style={[
                  styles.segmentHighlight,
                  {
                    transform: [{
                      translateX: segmentSlide.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, 150] // Assuming roughly half of container width
                      })
                    }]
                  }
                ]} />
                <TouchableOpacity 
                  style={styles.segmentTab} 
                  onPress={() => setRegisterRole('customer')}
                  activeOpacity={1}
                >
                  <Text style={[styles.segmentText, registerRole === 'customer' && styles.segmentTextActive]}>Player</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.segmentTab} 
                  onPress={() => setRegisterRole('owner')}
                  activeOpacity={1}
                >
                  <Text style={[styles.segmentText, registerRole === 'owner' && styles.segmentTextActive]}>Turf Owner</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Inputs */}
            {!isLogin && (
              <>
                {renderInput('name', 'account-outline', 'Full Name', name, setName, { autoCapitalize: 'words' })}
                <View style={{ height: 12 }} />
                {renderInput('phone', 'phone-outline', 'Phone Number', mobile, setMobile, { keyboardType: 'phone-pad', maxLength: 10 })}
                <View style={{ height: 12 }} />
                <View style={[styles.inputContainer, { zIndex: 1000 }]}>
                  <Icon name="map-marker-outline" size={22} color="rgba(255,255,255,0.4)" style={styles.inputIcon} />
                  <LocationAutocomplete
                    value={city}
                    onChangeText={setCity}
                    onSelectLocation={(loc) => {
                      setCity(loc.name);
                      setLocationObj({
                        name: loc.name,
                        latitude: loc.latitude,
                        longitude: loc.longitude,
                        state: loc.state
                      });
                    }}
                    placeholder="Search your city/location"
                    variant="none"
                    style={styles.input}
                  />
                </View>
                <View style={{ height: 12 }} />
              </>
            )}

            {renderInput('email', 'email-outline', 'Email Address', email, setEmail, { keyboardType: 'email-address', autoCapitalize: 'none', autoCorrect: false })}

            {error ? <Text style={styles.error}>{error}</Text> : null}

            {/* Send OTP Button */}
            <Animated.View style={{ transform: [{ scale: btnScale }], marginTop: 24 }}>
              <TouchableOpacity 
                style={[styles.verifyBtn, isLoading && styles.verifyBtnDisabled]}
                activeOpacity={1}
                onPressIn={animateBtnPressIn}
                onPressOut={animateBtnPressOut}
                onPress={handleSendOTP}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#000" size="small" />
                ) : (
                  <>
                    <Text style={styles.verifyBtnText}>Send OTP</Text>
                    <Icon name="arrow-right" size={24} color="#000" style={{ marginLeft: 8 }} />
                  </>
                )}
              </TouchableOpacity>
            </Animated.View>

            {/* Toggle Login/Sign Up */}
            <TouchableOpacity 
              style={styles.toggleButton} 
              onPress={() => {
                setIsLogin(!isLogin);
                dispatch(clearError());
              }}
              disabled={isLoading}
              activeOpacity={0.7}
            >
              <Text style={styles.toggleText}>
                {isLogin ? "Don't have an account? " : "Already have an account? "}
                <Text style={styles.toggleTextYellow}>{isLogin ? "Sign Up" : "Log In"}</Text>
              </Text>
            </TouchableOpacity>

          </View>

          {/* Terms Footer */}
          <View style={[styles.termsFooter, { marginBottom: Platform.OS === 'android' ? 80 : Math.max(insets.bottom + 40, 60) }]}>
            <Text style={styles.termsText}>By continuing, you agree to our</Text>
            <View style={styles.termsLinkContainer}>
              <TouchableOpacity onPress={() => setActiveModal('terms')} activeOpacity={0.7} hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                <Text style={styles.termsLink}>Terms of Service</Text>
              </TouchableOpacity>
              <Text style={styles.termsText}> and </Text>
              <TouchableOpacity onPress={() => setActiveModal('privacy')} activeOpacity={0.7} hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                <Text style={styles.termsLink}>Privacy Policy</Text>
              </TouchableOpacity>
            </View>
          </View>

        </Animated.View>
      </KeyboardAwareScrollView>

      {/* Terms & Privacy Modal */}
      <Modal visible={!!activeModal} animationType="fade" transparent={true} onRequestClose={() => setActiveModal(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{activeModal === 'terms' ? 'Terms of Service' : 'Privacy Policy'}</Text>
              <TouchableOpacity onPress={() => setActiveModal(null)} style={styles.modalCloseBtn}>
                <Icon name="close" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.modalScroll}>
              <Text style={styles.modalContent}>
                {activeModal === 'terms' 
                  ? 'Welcome to ScoreVerse. By accessing our app, you agree to be bound by these terms.\n\n1. Use of Service\nYou must use the application for lawful purposes only and in a way that does not infringe the rights of others.\n\n2. Booking & Cancellation\nTurf bookings are final once confirmed. Cancellation policies vary by individual turf owners. Please review the turf-specific policy before booking.\n\n3. User Conduct\nPlayers must maintain sportsmanship on and off the field. Turf owners have the right to deny entry for misconduct.\n\n4. Liability\nScoreVerse acts as a facilitator and is not liable for injuries on the field or disputes between owners and players.' 
                  : 'Your privacy is critically important to us.\n\n1. Data Collection\nWe collect personal data such as name, phone number, and email to facilitate bookings and team formations.\n\n2. Data Usage\nYour data is used to improve our services, manage bookings, and communicate updates. Turf owners receive basic contact info to verify bookings.\n\n3. Security\nWe implement standard security measures to protect your personal information against unauthorized access.\n\n4. Third Parties\nWe do not sell your personal data to third parties. We may share data with service providers to process payments securely.'}
              </Text>
            </ScrollView>
          </View>
        </View>
      </Modal>

    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  radialGlow: {
    position: 'absolute', top: '15%', left: '10%', right: '10%', height: 350,
    backgroundColor: '#FFD400', borderRadius: 200, opacity: 0.06, filter: 'blur(80px)',
  },
  particle: {
    position: 'absolute', width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255, 212, 0, 0.5)', blurRadius: 8,
  },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 40 },
  
  topBar: { flexDirection: 'row', alignItems: 'center', marginBottom: 30 },
  backBtn: { 
    width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(23, 23, 23, 0.8)', 
    justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 4,
  },
  
  heroContainer: { alignItems: 'center', justifyContent: 'center', height: 120, marginBottom: 20, position: 'relative' },
  icon3DWrapper: {
    shadowColor: '#FFD400', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 25, elevation: 10,
  },
  logoGlass: {
    width: 88, height: 88, borderRadius: 28, backgroundColor: 'rgba(23, 23, 23, 0.7)', 
    borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.6, shadowRadius: 15, elevation: 8,
  },
  logoImage: { width: 64, height: 64, borderRadius: 20 },

  headerTextContainer: { alignItems: 'center', marginBottom: 36 },
  title: { fontSize: 38, fontFamily: Typography.fontFamily.extraBold, color: '#FFFFFF', letterSpacing: 1 },
  titleYellow: { color: '#FFD400' },
  subtitle: { fontSize: 16, fontFamily: Typography.fontFamily.medium, color: '#A0A0A0', textAlign: 'center', marginTop: 8 },

  authCard: {
    backgroundColor: 'rgba(23, 23, 23, 0.4)',
    borderRadius: 32,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 5,
  },

  segmentContainer: {
    flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 22, height: 44, padding: 4, marginBottom: 24,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', position: 'relative'
  },
  segmentHighlight: {
    position: 'absolute', top: 4, left: 4, bottom: 4, width: '48%', backgroundColor: '#FFD400', borderRadius: 18,
    shadowColor: '#FFD400', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  segmentTab: { flex: 1, justifyContent: 'center', alignItems: 'center', zIndex: 2 },
  segmentText: { fontFamily: Typography.fontFamily.semiBold, color: '#FFFFFF', fontSize: 14, opacity: 0.7 },
  segmentTextActive: { color: '#000000', opacity: 1, fontFamily: Typography.fontFamily.bold },

  inputContainer: {
    flexDirection: 'row', alignItems: 'center', height: 60, borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.4)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 2,
  },
  inputFocused: {
    borderColor: '#FFD400', backgroundColor: 'rgba(26, 26, 26, 0.8)',
    shadowColor: '#FFD400', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 6,
  },
  inputIcon: { marginRight: 12 },
  input: {
    flex: 1, color: '#FFFFFF', fontFamily: Typography.fontFamily.medium, fontSize: 16, paddingVertical: Platform.OS === 'ios' ? 16 : 12,
  },

  error: { color: Colors.error, fontFamily: Typography.fontFamily.medium, fontSize: 13, marginTop: 12, textAlign: 'center' },

  verifyBtn: {
    height: 60, borderRadius: 20, backgroundColor: '#FFD400', justifyContent: 'center', alignItems: 'center', flexDirection: 'row',
    shadowColor: '#FFD400', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 15, elevation: 8,
  },
  verifyBtnDisabled: { backgroundColor: '#333', shadowOpacity: 0 },
  verifyBtnText: { fontSize: 18, fontFamily: Typography.fontFamily.bold, color: '#000000' },

  toggleButton: { marginTop: 24, alignItems: 'center' },
  toggleText: { fontSize: 14, fontFamily: Typography.fontFamily.medium, color: '#A0A0A0' },
  toggleTextYellow: { fontFamily: Typography.fontFamily.bold, color: '#FFD400' },

  termsFooter: { marginTop: 40, alignItems: 'center' },
  termsText: { textAlign: 'center', fontSize: 13, color: 'rgba(255,255,255,0.4)', fontFamily: Typography.fontFamily.regular },
  termsLinkContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  termsLink: { color: '#FFD400', fontSize: 13, fontFamily: Typography.fontFamily.medium },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContainer: { width: '100%', maxHeight: '80%', backgroundColor: '#1A1A1A', borderRadius: 24, overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  modalTitle: { fontSize: 20, fontFamily: Typography.fontFamily.bold, color: '#FFF' },
  modalCloseBtn: { padding: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 20 },
  modalScroll: { padding: 24, paddingBottom: 60 },
  modalContent: { fontSize: 14, fontFamily: Typography.fontFamily.regular, color: '#A0A0A0', lineHeight: 24 },
});

export default LoginScreen;
