import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  Platform, ActivityIndicator, Image, Animated, Easing, Keyboard, Modal, ScrollView
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useDispatch, useSelector } from 'react-redux';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { loginWithPassword, registerWithPassword, loginWithGoogle, clearError, setGuestMode, logoutLocal } from '../authSlice';
import Svg, { Path } from 'react-native-svg';
import { Colors, Typography } from '../../../theme/theme';
import { showCustomAlert } from '../../../components/CustomAlert';
import LocationAutocomplete from '../../../components/LocationAutocomplete';
import NotificationService from '../../../services/NotificationService';

const GoogleIcon = ({ size = 20 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path
      fill="#4285F4"
      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
    />
    <Path
      fill="#34A853"
      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
    />
    <Path
      fill="#FBBC05"
      d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
    />
    <Path
      fill="#EA4335"
      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
    />
  </Svg>
);

const LoginScreen = ({ navigation }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [registerRole, setRegisterRole] = useState('customer'); // 'customer' or 'owner'

  const handleSuspendedUser = () => {
    dispatch(logoutLocal());
    dispatch(setGuestMode(true));
    showCustomAlert(
      'Account Suspended',
      'Your account has been suspended by the administrator. You can browse in guest mode.'
    );
    navigation.navigate('Customer');
  };
  
  const [identifier, setIdentifier] = useState(''); // Email or Mobile for Login
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [city, setCity] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [locationObj, setLocationObj] = useState(null);
  const [focusedInput, setFocusedInput] = useState(null);
  const [activeModal, setActiveModal] = useState(null); // 'terms' | 'privacy' | null
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Google OAuth States
  const [showGoogleSignupModal, setShowGoogleSignupModal] = useState(false);
  const [googleIdToken, setGoogleIdToken] = useState('');
  const [googleEmail, setGoogleEmail] = useState('');
  const [googleName, setGoogleName] = useState('');
  const [googleMobile, setGoogleMobile] = useState('');
  const [googleCity, setGoogleCity] = useState('');
  const [googleLocationObj, setGoogleLocationObj] = useState(null);
  const [googleLoading, setGoogleLoading] = useState(false);

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
    Animated.parallel([
      Animated.timing(pageFade, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(pageSlide, { toValue: 0, duration: 800, easing: Easing.out(Easing.exp), useNativeDriver: true })
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(heroAnim, { toValue: -6, duration: 3000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(heroAnim, { toValue: 0, duration: 3000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(rotateAnim, { toValue: 1, duration: 5000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(rotateAnim, { toValue: -1, duration: 10000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(rotateAnim, { toValue: 0, duration: 5000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();

    particles.forEach((p, i) => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(p, { toValue: 1, duration: 4000 + i * 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(p, { toValue: 0, duration: 4000 + i * 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      ).start();
    });
  }, []);

  useEffect(() => {
    GoogleSignin.configure({
      webClientId: '569117113912-ipv2e2rmqtcijfcm5qf8gml3us9us659.apps.googleusercontent.com', 
      offlineAccess: true,
    });
  }, []);

  useEffect(() => {
    Animated.spring(segmentSlide, {
      toValue: registerRole === 'customer' ? 0 : 1,
      friction: 6,
      tension: 40,
      useNativeDriver: true
    }).start();
  }, [registerRole]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        dispatch(clearError());
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, dispatch]);

  const handleGoogleSignIn = async () => {
    if (!isLogin && !termsAccepted) {
      showCustomAlert('Terms & Conditions', 'Please accept the Terms of Service and Privacy Policy to register.');
      return;
    }
    try {
      setGoogleLoading(true);
      await GoogleSignin.hasPlayServices();
      try {
        // Force account picker by signing out first
        await GoogleSignin.signOut();
      } catch (e) {
        // Ignore errors if already signed out
      }
      const userInfo = await GoogleSignin.signIn();
      const idToken = userInfo.data?.idToken || userInfo.idToken;

      if (!idToken) {
        showCustomAlert('Error', 'Google ID token not found');
        setGoogleLoading(false);
        return;
      }

      setGoogleIdToken(idToken);
      const fcmToken = await NotificationService.getFCMToken().catch(() => null);

      const result = await dispatch(loginWithGoogle({
        idToken,
        fcmToken,
        role: isLogin ? undefined : registerRole
      }));

      if (loginWithGoogle.fulfilled.match(result)) {
        const payload = result.payload;
        if (payload?.signUpRequired) {
          setGoogleEmail(payload.email);
          setGoogleName(payload.name);
          setShowGoogleSignupModal(true);
        } else if (payload?.user && (payload.user.isSuspended || payload.user.isActive === false || payload.user.isDeactivated || payload.user.isDeleted)) {
          handleSuspendedUser();
        }
      } else {
        const errPayload = String(result.payload || '');
        if (errPayload.toLowerCase().includes('suspended') || errPayload.toLowerCase().includes('deactivated')) {
          handleSuspendedUser();
        } else {
          showCustomAlert('Error', result.payload || 'Google Login failed');
        }
      }
    } catch (err) {
      if (err.code === statusCodes.SIGN_IN_CANCELLED) {
        // User cancelled flow
      } else if (err.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        showCustomAlert('Error', 'Google Play services not available');
      } else {
        const errMsg = String(err.message || '');
        if (errMsg.toLowerCase().includes('suspended') || errMsg.toLowerCase().includes('deactivated')) {
          handleSuspendedUser();
        } else {
          showCustomAlert('Error', err.message || 'Google Login failed');
        }
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleGoogleSignupSubmit = async () => {
    if (!googleMobile.trim() || googleMobile.trim().length !== 10 || !/^\d+$/.test(googleMobile.trim())) {
      return showCustomAlert('Error', 'Please enter a valid 10-digit phone number');
    }
    if (!googleLocationObj || !googleCity) {
      return showCustomAlert('Error', 'Please select your location');
    }

    setGoogleLoading(true);
    const fcmToken = await NotificationService.getFCMToken().catch(() => null);

    const result = await dispatch(loginWithGoogle({
      idToken: googleIdToken,
      mobile: googleMobile.trim(),
      city: googleCity,
      locationObj: googleLocationObj,
      state: googleLocationObj?.state || '',
      fcmToken,
      role: registerRole
    }));

    setGoogleLoading(false);

    if (loginWithGoogle.fulfilled.match(result)) {
      setShowGoogleSignupModal(false);
      const payload = result.payload;
      if (payload?.user && (payload.user.isSuspended || payload.user.isActive === false || payload.user.isDeactivated || payload.user.isDeleted)) {
        handleSuspendedUser();
      }
    } else {
      const errPayload = String(result.payload || '');
      if (errPayload.toLowerCase().includes('suspended') || errPayload.toLowerCase().includes('deactivated')) {
        setShowGoogleSignupModal(false);
        handleSuspendedUser();
      } else {
        showCustomAlert('Error', result.payload || 'Google Registration failed');
      }
    }
  };

  const handleSubmit = async () => {
    Keyboard.dismiss();
    dispatch(clearError());
    
    // Fetch FCM token if available
    const fcmToken = await NotificationService.getFCMToken().catch(() => null);

    if (isLogin) {
      if (!identifier.trim()) return showCustomAlert('Error', 'Please enter your email or phone number');
      if (!password) return showCustomAlert('Error', 'Please enter your password');

      const result = await dispatch(loginWithPassword({
        identifier: identifier.trim().toLowerCase(),
        password: password.trim(),
        fcmToken
      }));
      if (loginWithPassword.fulfilled.match(result)) {
        const payload = result.payload;
        if (payload?.user && (payload.user.isSuspended || payload.user.isActive === false || payload.user.isDeactivated || payload.user.isDeleted)) {
          handleSuspendedUser();
        }
      } else if (loginWithPassword.rejected.match(result)) {
        const errPayload = String(result.payload || '');
        if (errPayload.toLowerCase().includes('suspended') || errPayload.toLowerCase().includes('deactivated')) {
          handleSuspendedUser();
        } else {
          showCustomAlert('Error', result.payload || 'Login failed');
        }
      }
    } else {
      if (!termsAccepted) return showCustomAlert('Terms & Conditions', 'Please accept the Terms of Service and Privacy Policy to register.');
      if (!name.trim()) return showCustomAlert('Error', 'Please enter your full name');
      if (!email.trim()) return showCustomAlert('Error', 'Please enter your email');
      if (!mobile.trim() || mobile.trim().length !== 10 || !/^\d+$/.test(mobile.trim())) {
        return showCustomAlert('Error', 'Please enter a valid 10-digit phone number');
      }
      if (!locationObj || !city) return showCustomAlert('Error', 'Please select your location');
      if (!password.trim()) return showCustomAlert('Error', 'Please enter a password');
      if (password.trim() !== confirmPassword.trim()) return showCustomAlert('Error', 'Passwords do not match');

      const result = await dispatch(registerWithPassword({
        email: email.trim().toLowerCase(),
        name: name.trim(),
        mobile: mobile.trim(),
        password: password.trim(),
        role: registerRole,
        city,
        locationObj,
        state: locationObj?.state || '',
        fcmToken
      }));

      if (registerWithPassword.rejected.match(result)) {
        showCustomAlert('Error', result.payload || 'Registration failed');
      }
    }
  };

  const animateBtnPressIn = () => Animated.spring(btnScale, { toValue: 0.96, useNativeDriver: true }).start();
  const animateBtnPressOut = () => Animated.spring(btnScale, { toValue: 1, friction: 3, tension: 40, useNativeDriver: true }).start();

  const renderInput = (id, icon, placeholder, value, setValue, options = {}) => {
    const isFocused = focusedInput === id;
    const isPasswordField = id === 'password';
    const isConfirmPasswordField = id === 'confirmPassword';
    const isPasswordType = isPasswordField || isConfirmPasswordField;
    
    let secureTextEntry = false;
    if (isPasswordField) secureTextEntry = !showPassword;
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
            onPress={() => isPasswordField ? setShowPassword(!showPassword) : setShowConfirmPassword(!showConfirmPassword)} 
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
      <View style={styles.radialGlow} />

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
          
          <View style={styles.topBar}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
              <Icon name="chevron-left" size={28} color="#FFF" />
            </TouchableOpacity>
          </View>

          {isLogin && (
            <View style={styles.heroContainer}>
              <Animated.View style={[styles.icon3DWrapper, { 
                transform: [
                  { translateY: heroAnim },
                  { rotateZ: rotateAnim.interpolate({ inputRange: [-1, 1], outputRange: ['-4deg', '4deg'] }) }
                ] 
              }]}>
                <View style={styles.logoGlass}>
                  <Image source={require('../../../../SportVerse.png')} style={styles.logoImage} resizeMode="contain" />
                </View>
              </Animated.View>
            </View>
          )}

          <View style={[styles.headerTextContainer, !isLogin && { marginBottom: 12, marginTop: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
            <View>
              {isLogin && <Text style={styles.title}>SCORE<Text style={styles.titleYellow}>VERSE</Text></Text>}
              {!isLogin && (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                  <Text style={[styles.title, { fontSize: 22 }]}>Registering as </Text>
                  <View style={{ backgroundColor: 'rgba(255,212,0,0.15)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginLeft: 4, borderWidth: 1, borderColor: '#FFD400' }}>
                    <Text style={{ color: '#FFD400', fontFamily: Typography.fontFamily.bold, fontSize: 10, textTransform: 'uppercase' }}>
                      {registerRole === 'owner' ? 'Turf Owner' : 'Player'}
                    </Text>
                  </View>
                </View>
              )}
              <Text style={[styles.subtitle, !isLogin && { fontSize: 13, marginTop: 4, textAlign: 'left' }]}>
                {isLogin ? 'Log in to your account' : 'Please fill in the details below'}
              </Text>
            </View>
            {!isLogin && (
              <TouchableOpacity onPress={() => setRegisterRole(registerRole === 'owner' ? 'customer' : 'owner')}>
                 <Text style={{ color: '#FFD400', fontFamily: Typography.fontFamily.semiBold, fontSize: 13, textDecorationLine: 'underline' }}>
                   {registerRole === 'owner' ? 'I\'m a Player' : 'Own a turf?'}
                 </Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.authCard}>

            {/* If Sign Up: Show Google Sign-Up at the TOP */}
            {!isLogin && (
              <>
                <TouchableOpacity 
                  style={[styles.googleBtn, { marginBottom: 16 }, googleLoading && styles.googleBtnDisabled]}
                  onPress={handleGoogleSignIn}
                  disabled={googleLoading || isLoading}
                  activeOpacity={0.85}
                >
                  {googleLoading ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <View style={styles.googleContent}>
                      <View style={styles.googleIconBadge}>
                        <GoogleIcon size={20} />
                      </View>
                      <Text style={styles.googleBtnText}>Register with Google</Text>
                    </View>
                  )}
                </TouchableOpacity>

                <View style={[styles.dividerContainer, { marginTop: 4, marginBottom: 16 }]}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>OR SIGN UP WITH EMAIL</Text>
                  <View style={styles.dividerLine} />
                </View>
              </>
            )}

            {isLogin ? (
              <>
                {renderInput('identifier', 'account-outline', 'Email or Mobile Number', identifier, setIdentifier, { autoCapitalize: 'none', autoCorrect: false })}
                <View style={{ height: 12 }} />
                {renderInput('password', 'lock-outline', 'Password', password, setPassword)}
              </>
            ) : (
              <>
                {renderInput('name', 'account-outline', 'Full Name', name, setName, { autoCapitalize: 'words' })}
                <View style={{ height: 8 }} />
                {renderInput('email', 'email-outline', 'Email Address', email, setEmail, { keyboardType: 'email-address', autoCapitalize: 'none', autoCorrect: false })}
                <View style={{ height: 8 }} />
                {renderInput('phone', 'phone-outline', 'Phone Number', mobile, setMobile, { keyboardType: 'phone-pad', maxLength: 10 })}
                <View style={{ height: 8 }} />
                
                <View style={[styles.inputContainer, { zIndex: 1000 }]}>
                  {/* <Icon name="map-marker-outline" size={22} color="rgba(255,255,255,0.4)" style={styles.inputIcon} /> */}
                  <LocationAutocomplete
                    value={city}
                    onChangeText={setCity}
                    onSelectLocation={(loc) => {
                      setCity(loc ? loc.name : '');
                      setLocationObj(loc ? { name: loc.name, latitude: loc.latitude, longitude: loc.longitude, state: loc.state } : null);
                    }}
                    placeholder="Search your city/location"
                    variant="none"
                    style={styles.input}
                  />
                </View>
                <View style={{ height: 8 }} />
                
                {renderInput('password', 'lock-outline', 'Password', password, setPassword)}
                <View style={{ height: 8 }} />
                {renderInput('confirmPassword', 'lock-check-outline', 'Confirm Password', confirmPassword, setConfirmPassword)}
                <View style={{ height: 12 }} />
                
                <TouchableOpacity 
                  style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }} 
                  onPress={() => setTermsAccepted(!termsAccepted)}
                  activeOpacity={0.8}
                >
                  <View style={{ width: 20, height: 20, borderRadius: 4, borderWidth: 1, borderColor: termsAccepted ? '#FFD400' : 'rgba(255,255,255,0.4)', backgroundColor: termsAccepted ? '#FFD400' : 'transparent', justifyContent: 'center', alignItems: 'center', marginRight: 10 }}>
                    {termsAccepted && <Icon name="check" size={14} color="#000" />}
                  </View>
                  <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', fontFamily: Typography.fontFamily.regular, flex: 1 }}>
                    I agree to the <Text style={{ color: '#FFD400', textDecorationLine: 'underline' }} onPress={() => setActiveModal('terms')}>Terms of Service</Text> and <Text style={{ color: '#FFD400', textDecorationLine: 'underline' }} onPress={() => setActiveModal('privacy')}>Privacy Policy</Text>
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {isLogin && (
              <TouchableOpacity 
                style={styles.forgotBtn}
                onPress={() => navigation.navigate('ForgotPassword')}
              >
                <Text style={styles.forgotBtnText}>Forgot Password?</Text>
              </TouchableOpacity>
            )}

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Animated.View style={{ transform: [{ scale: btnScale }], marginTop: 24 }}>
              <TouchableOpacity 
                style={[styles.verifyBtn, isLoading && styles.verifyBtnDisabled]}
                activeOpacity={1}
                onPressIn={animateBtnPressIn}
                onPressOut={animateBtnPressOut}
                onPress={handleSubmit}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#000" size="small" />
                ) : (
                  <>
                    <Text style={styles.verifyBtnText}>{isLogin ? 'Log In' : 'Sign Up'}</Text>
                    <Icon name="arrow-right" size={24} color="#000" style={{ marginLeft: 8 }} />
                  </>
                )}
              </TouchableOpacity>
            </Animated.View>

            {/* If Log In: Show Google Login at the BOTTOM */}
            {isLogin && (
              <>
                {/* Divider */}
                <View style={styles.dividerContainer}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>OR</Text>
                  <View style={styles.dividerLine} />
                </View>

                {/* Google Login Button */}
                <TouchableOpacity 
                  style={[styles.googleBtn, googleLoading && styles.googleBtnDisabled]}
                  onPress={handleGoogleSignIn}
                  disabled={googleLoading || isLoading}
                  activeOpacity={0.85}
                >
                  {googleLoading ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <View style={styles.googleContent}>
                      <View style={styles.googleIconBadge}>
                        <GoogleIcon size={20} />
                      </View>
                      <Text style={styles.googleBtnText}>Continue with Google</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </>
            )}

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

          {isLogin && (
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
          )}

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

      {/* Google Complete Profile Modal */}
      <Modal visible={showGoogleSignupModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { maxHeight: '90%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Complete Profile</Text>
              <TouchableOpacity onPress={() => setShowGoogleSignupModal(false)} style={styles.modalCloseBtn}>
                <Icon name="close" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.modalScroll}>
              <Text style={styles.modalContent}>
                We authenticated your Google account. Please enter your mobile number and city to finalize registration and sync your player profile.
              </Text>
              
              <View style={styles.googleProfileCard}>
                <Text style={styles.googleProfileName}>{googleName}</Text>
                <Text style={styles.googleProfileEmail}>{googleEmail}</Text>
              </View>

              <Text style={styles.googleInputLabel}>Mobile Number</Text>
              <View style={styles.inputContainer}>
                <Icon name="phone-outline" size={22} color="rgba(255,255,255,0.4)" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="10-digit mobile number..."
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  value={googleMobile}
                  onChangeText={(val) => setGoogleMobile(val.replace(/\D/g, ''))}
                  keyboardType="phone-pad"
                  maxLength={10}
                  selectionColor="#FFD400"
                />
              </View>
              
              <View style={{ height: 16 }} />

              <Text style={styles.googleInputLabel}>Select City</Text>
              <View style={[styles.inputContainer, { zIndex: 1000 }]}>
                <LocationAutocomplete
                  value={googleCity}
                  onChangeText={setGoogleCity}
                  onSelectLocation={(loc) => {
                    setGoogleCity(loc ? loc.name : '');
                    setGoogleLocationObj(loc ? { name: loc.name, latitude: loc.latitude, longitude: loc.longitude, state: loc.state } : null);
                  }}
                  placeholder="Search city location..."
                  variant="none"
                  style={styles.input}
                />
              </View>

              <View style={{ height: 24 }} />

              <TouchableOpacity 
                style={[styles.verifyBtn, googleLoading && styles.verifyBtnDisabled]}
                onPress={handleGoogleSignupSubmit}
                disabled={googleLoading}
              >
                {googleLoading ? (
                  <ActivityIndicator color="#000" size="small" />
                ) : (
                  <Text style={styles.verifyBtnText}>Save & Log In</Text>
                )}
              </TouchableOpacity>
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
  
  topBar: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
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
  title: { fontSize: 38, fontFamily: Typography.fontFamily.extraBold, fontWeight: '900', color: '#FFFFFF', letterSpacing: 0.5 },
  titleYellow: { color: '#FFD400', fontFamily: Typography.fontFamily.extraBold, fontWeight: '900' },
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
    flexDirection: 'row', alignItems: 'center', height: 52, borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.4)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 2,
  },
  inputFocused: {
    borderColor: '#FFD400', backgroundColor: 'rgba(26, 26, 26, 0.8)',
    shadowColor: '#FFD400', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 6,
  },
  inputIcon: { marginRight: 12 },
  eyeIcon: { padding: 4 },
  input: {
    flex: 1, color: '#FFFFFF', fontFamily: Typography.fontFamily.medium, fontSize: 16, paddingVertical: Platform.OS === 'ios' ? 16 : 12,
  },

  forgotBtn: { alignSelf: 'flex-end', marginTop: 12 },
  forgotBtnText: { color: '#FFD400', fontFamily: Typography.fontFamily.medium, fontSize: 14 },

  error: { color: Colors.error, fontFamily: Typography.fontFamily.medium, fontSize: 13, marginTop: 12, textAlign: 'center' },

  verifyBtn: {
    height: 52, borderRadius: 14, backgroundColor: '#FFD400', justifyContent: 'center', alignItems: 'center', flexDirection: 'row',
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

  dividerContainer: { flexDirection: 'row', alignItems: 'center', marginVertical: 18 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.1)' },
  dividerText: { color: 'rgba(255,255,255,0.4)', paddingHorizontal: 12, fontSize: 13, fontFamily: Typography.fontFamily.semiBold },

  googleBtn: {
    height: 52,
    borderRadius: 14,
    backgroundColor: '#1A73E8',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#1A73E8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  googleBtnDisabled: { opacity: 0.6 },
  googleContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  googleIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  googleBtnText: {
    fontSize: 15,
    fontFamily: Typography.fontFamily.semiBold,
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },

  googleProfileCard: {
    backgroundColor: 'rgba(255,255,255,0.02)', padding: 16, borderRadius: 16, borderHeight: 1, borderColor: 'rgba(255,255,255,0.06)',
    marginBottom: 20, marginTop: 10,
  },
  googleProfileName: { color: '#FFFFFF', fontSize: 15, fontFamily: Typography.fontFamily.bold },
  googleProfileEmail: { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontFamily: Typography.fontFamily.regular, marginTop: 2 },
  googleInputLabel: { color: '#FFFFFF', fontSize: 13, fontFamily: Typography.fontFamily.semiBold, marginBottom: 8, marginLeft: 4 },
});

export default LoginScreen;
