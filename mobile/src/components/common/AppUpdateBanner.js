import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Linking, Platform, Animated,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme, Colors, Typography } from '../../theme/theme';
import api from '../../api/axios';
import pkg from '../../../package.json';

const CURRENT_APP_VERSION = pkg.version || '1.21';

const isVersionOlder = (current, latest) => {
  if (!current || !latest) return false;
  const c = current.split('.').map(Number);
  const l = latest.split('.').map(Number);
  for (let i = 0; i < Math.max(c.length, l.length); i++) {
    if ((c[i] || 0) < (l[i] || 0)) return true;
    if ((c[i] || 0) > (l[i] || 0)) return false;
  }
  return false;
};

const AppUpdateBanner = () => {
  const { colors, isDark } = useTheme();
  const [isVisible, setIsVisible] = useState(false);
  const [updateInfo, setUpdateInfo] = useState({ forceUpdateRequired: false, storeUrl: '' });

  const shimmerX = useRef(new Animated.Value(-300)).current;

  useEffect(() => { checkAppVersion(); }, []);

  useEffect(() => {
    if (!isVisible) return;
    // Subtle shimmer sweep
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerX, { toValue: 400, duration: 2200, useNativeDriver: true }),
        Animated.timing(shimmerX, { toValue: -300, duration: 0, useNativeDriver: true }),
        Animated.delay(3000),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [isVisible]);

  const checkAppVersion = async () => {
    try {
      const response = await api.get('/admin/public-settings');
      if (response.data?.data) {
        const settings = response.data.data;
        const latestVersion = Platform.OS === 'ios'
          ? settings.latestIOSVersion
          : settings.latestAndroidVersion;
        if (isVersionOlder(CURRENT_APP_VERSION, latestVersion)) {
          setUpdateInfo({
            forceUpdateRequired: settings.forceUpdateRequired,
            storeUrl: Platform.OS === 'ios' ? settings.iosStoreUrl : settings.androidStoreUrl,
          });
          setIsVisible(true);
        }
      }
    } catch (e) { console.log('Version check failed:', e); }
  };

  const handleUpdate = () => {
    if (updateInfo.storeUrl) Linking.openURL(updateInfo.storeUrl).catch(() => {});
  };

  if (!isVisible) return null;

  const bg = isDark ? '#111111' : '#FFFFFF';
  const borderCol = isDark ? 'rgba(255,204,0,0.22)' : 'rgba(200,160,0,0.20)';

  return (
    <View style={[styles.card, { backgroundColor: bg, borderColor: borderCol }]}>

      {/* Shimmer sweep */}
      <Animated.View
        pointerEvents="none"
        style={[styles.shimmer, { transform: [{ translateX: shimmerX }] }]}
      />

      {/* Left gold accent */}
      <View style={styles.accent} />

      {/* Content */}
      <View style={styles.content}>
        {/* Top row: label + version */}
        <View style={styles.topRow}>
          <View style={styles.tag}>
            <Text style={styles.tagTxt}>UPDATE</Text>
          </View>
          <Text style={[styles.versionLabel, { color: colors.textTertiary }]}>
            v{CURRENT_APP_VERSION}
          </Text>
        </View>

        {/* Headline */}
        <Text style={[styles.headline, { color: colors.textPrimary }]}>
          New version available
        </Text>
        <Text style={[styles.sub, { color: colors.textSecondary }]}>
          Performance improvements and new features are ready for you.
        </Text>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.updateBtn} onPress={handleUpdate} activeOpacity={0.82}>
            <Text style={styles.updateBtnTxt}>Update</Text>
            <Icon name="arrow-right" size={15} color="#000" />
          </TouchableOpacity>

          {!updateInfo.forceUpdateRequired && (
            <TouchableOpacity onPress={() => setIsVisible(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={[styles.laterTxt, { color: colors.textTertiary }]}>Not now</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Right icon */}
      <View style={styles.iconSide}>
        <View style={[styles.iconCircle, { backgroundColor: isDark ? 'rgba(255,204,0,0.10)' : 'rgba(255,204,0,0.12)' }]}>
          <Icon name="arrow-up-circle-outline" size={26} color={Colors.primary} />
        </View>
      </View>

    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 120,
    backgroundColor: 'rgba(255,255,255,0.06)',
    transform: [{ skewX: '-20deg' }],
  },
  accent: {
    width: 3,
    alignSelf: 'stretch',
    backgroundColor: Colors.primary,
  },
  content: {
    flex: 1,
    paddingVertical: 14,
    paddingLeft: 14,
    paddingRight: 8,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  tag: {
    backgroundColor: Colors.primary,
    borderRadius: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  tagTxt: {
    fontSize: 9,
    fontFamily: Typography.fontFamily.bold,
    color: '#000',
    letterSpacing: 1.4,
  },
  versionLabel: {
    fontSize: 11,
    fontFamily: Typography.fontFamily.regular,
  },
  headline: {
    fontSize: 15,
    fontFamily: Typography.fontFamily.bold,
    marginBottom: 3,
    letterSpacing: -0.2,
  },
  sub: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.regular,
    lineHeight: 17,
    marginBottom: 12,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  updateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  updateBtnTxt: {
    fontSize: 13,
    fontFamily: Typography.fontFamily.bold,
    color: '#000',
  },
  laterTxt: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.regular,
  },
  iconSide: {
    paddingRight: 14,
    paddingLeft: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default AppUpdateBanner;
