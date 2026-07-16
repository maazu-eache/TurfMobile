import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, ImageBackground, Image } from 'react-native';
import { useSelector } from 'react-redux';
import LinearGradient from 'react-native-linear-gradient';
import { Colors, Typography, Spacing } from '../../../theme/theme';

const { width, height } = Dimensions.get('window');

const SplashScreen = ({ navigation }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const { isAuthenticated, user } = useSelector((state) => state.auth);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, tension: 50, friction: 7, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <ImageBackground 
      source={require('../../../../GreetingScreen.png')} 
      style={styles.backgroundImage}
      resizeMode="cover"
    >
      <LinearGradient
        colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.6)', 'rgba(0,0,0,0.9)']}
        style={styles.gradientOverlay}
      >
        <View style={styles.container}>
          <Animated.View style={[styles.logoContainer, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
            <Image 
              source={require('../../../../Rough_Turf.png')} 
              style={styles.logoImage} 
              resizeMode="contain" 
            />
            <Text style={styles.logoText}>
              Rough <Text style={styles.logoTextTurf}>Turf</Text>
            </Text>
            <Text style={styles.tagline}>Book. Play. Score.</Text>
          </Animated.View>

          <Animated.View style={[styles.greetingCard, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <Text style={styles.greetingTitle}>
              {isAuthenticated && user ? `Welcome back,` : 'Welcome to'}
            </Text>
            <Text style={styles.greetingName}>
              {isAuthenticated && user ? user.name : 'RoughTurf!'}
            </Text>
            <Text style={styles.greetingSubtext}>
              {isAuthenticated && user ? 'Ready for your next match?' : 'The best turf booking experience.'}
            </Text>
          </Animated.View>

          <Animated.View style={[styles.footer, { opacity: fadeAnim }]}>
            <View style={styles.loader}>
              {[0, 1, 2].map((i) => (
                <LoaderDot key={i} delay={i * 200} />
              ))}
            </View>
          </Animated.View>
        </View>
      </LinearGradient>
    </ImageBackground>
  );
};

const LoaderDot = ({ delay }) => {
  const anim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.3, duration: 400, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View style={[styles.dot, { opacity: anim, transform: [{ scale: anim }] }]} />
  );
};

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
    width: width,
    height: height,
  },
  gradientOverlay: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  container: {
    flex: 1,
    alignItems: 'center',
    paddingTop: height * 0.15,
  },
  logoContainer: {
    alignItems: 'center',
  },
  logoImage: {
    width: 90,
    height: 90,
    marginBottom: Spacing.sm,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 15,
    elevation: 10,
  },
  logoText: {
    fontSize: 42,
    fontFamily: Typography.fontFamily.extraBold,
    color: '#FFFFFF',
    letterSpacing: -1,
    fontWeight: '800',
    fontStyle: 'italic',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
  },
  logoTextTurf: {
    color: Colors.primary,
  },
  tagline: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.primary,
    letterSpacing: 4,
    textTransform: 'uppercase',
    marginTop: Spacing.xs,
    fontWeight: '700',
  },
  greetingCard: {
    marginTop: height * 0.1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderRadius: 24,
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing['2xl'],
    alignItems: 'center',
    width: width * 0.85,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 5,
  },
  greetingTitle: {
    fontSize: Typography.fontSize.md,
    fontFamily: Typography.fontFamily.medium,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: Spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  greetingName: {
    fontSize: Typography.fontSize['2xl'],
    fontFamily: Typography.fontFamily.bold,
    color: '#FFFFFF',
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  greetingSubtext: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.primary,
    textAlign: 'center',
    opacity: 0.9,
  },
  footer: {
    position: 'absolute',
    bottom: height * 0.08,
  },
  loader: {
    flexDirection: 'row',
    gap: 12,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 5,
    elevation: 5,
  },
});

export default SplashScreen;
