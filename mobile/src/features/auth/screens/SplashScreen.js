import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, ImageBackground, Image } from 'react-native';
import { useSelector } from 'react-redux';
import { Colors, Typography, Spacing } from '../../../theme/theme';

const { width, height } = Dimensions.get('window');

const SplashScreen = ({ navigation }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const { isAuthenticated, user } = useSelector((state) => state.auth);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, tension: 80, friction: 6, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <ImageBackground 
      source={require('../../../../GreetingScreen.png')} 
      style={styles.backgroundImage}
      resizeMode="cover"
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
          <Text style={styles.greetingText}>
            {isAuthenticated && user ? `Welcome back, ${user.name}!` : 'Welcome to RoughTurf!'}
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
    </ImageBackground>
  );
};

const LoaderDot = ({ delay }) => {
  const anim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.3, duration: 500, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View style={[styles.dot, { opacity: anim }]} />
  );
};

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
    width: width,
    height: height,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    paddingTop: height * 0.12, // Push logo to top
  },
  logoContainer: {
    alignItems: 'center',
  },
  logoImage: {
    width: 80,
    height: 80,
    marginBottom: Spacing.sm,
  },
  logoText: {
    fontSize: 38,
    fontFamily: Typography.fontFamily.extraBold,
    color: '#FFFFFF',
    letterSpacing: -1,
    fontWeight: '700',
    fontStyle: 'italic'
  },
  logoTextTurf: {
    fontSize: 38,
    fontFamily: Typography.fontFamily.extraBold,
    color: Colors.primary,
    letterSpacing: -1,
    fontWeight: '700',
    fontStyle: 'italic'
  },
  tagline: {
    fontSize: Typography.fontSize.md,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.primary,
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginTop: Spacing.sm,
    fontWeight: '600',
    fontStyle: 'italic'
  },
  greetingText: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.textSecondary,
    marginTop: Spacing.xl,
    textAlign: 'center',
    paddingHorizontal: Spacing.xl,
    fontWeight: '600',
    fontStyle: 'italic'
  },
  footer: {
    position: 'absolute',
    bottom: 50, // Moved down to be below the characters
  },
  loader: {
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
});

export default SplashScreen;
