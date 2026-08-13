import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Platform } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors, Spacing, Typography } from '../../theme/theme';
import api from '../../api/axios';
import pkg from '../../../package.json';

const CURRENT_APP_VERSION = pkg.version || '1.7';

const isVersionOlder = (current, latest) => {
  if (!current || !latest) return false;
  const currParts = current.split('.').map(Number);
  const latestParts = latest.split('.').map(Number);
  
  for (let i = 0; i < Math.max(currParts.length, latestParts.length); i++) {
    const c = currParts[i] || 0;
    const l = latestParts[i] || 0;
    if (c < l) return true;
    if (c > l) return false;
  }
  return false;
};

const AppUpdateBanner = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [updateInfo, setUpdateInfo] = useState({
    forceUpdateRequired: false,
    storeUrl: ''
  });

  useEffect(() => {
    checkAppVersion();
  }, []);

  const checkAppVersion = async () => {
    try {
      const response = await api.get('/admin/public-settings');
      if (response.data && response.data.data) {
        const settings = response.data.data;
        const latestVersion = Platform.OS === 'ios' ? settings.latestIOSVersion : settings.latestAndroidVersion;
        
        if (isVersionOlder(CURRENT_APP_VERSION, latestVersion)) {
          setUpdateInfo({
            forceUpdateRequired: settings.forceUpdateRequired,
            storeUrl: Platform.OS === 'ios' ? settings.iosStoreUrl : settings.androidStoreUrl
          });
          setIsVisible(true);
        }
      }
    } catch (error) {
      console.log('Failed to check app version:', error);
    }
  };

  const handleUpdate = () => {
    if (updateInfo.storeUrl) {
      Linking.openURL(updateInfo.storeUrl).catch(() => {
        console.log("Could not open store link");
      });
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <View style={styles.bannerContainer}>
      <View style={styles.contentRow}>
        <Icon name="rocket-launch" size={24} color={Colors.primary} style={styles.icon} />
        <View style={styles.textContainer}>
          <Text style={styles.title}>Update Available</Text>
          <Text style={styles.message} numberOfLines={2}>
            A new version of ScoreVerse is available.
          </Text>
        </View>
      </View>
      
      <View style={styles.actionRow}>
        {!updateInfo.forceUpdateRequired && (
          <TouchableOpacity style={styles.laterButton} onPress={handleDismiss}>
            <Text style={styles.laterButtonText}>Hide</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.updateButton} onPress={handleUpdate}>
          <Text style={styles.updateButtonText}>Update Now</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  bannerContainer: {
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    marginBottom: Spacing.md,
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.primary + '40', // slightly transparent primary color
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  icon: {
    marginRight: Spacing.sm,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    ...Typography.subtitle1,
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  message: {
    ...Typography.body2,
    color: Colors.textSecondary,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  updateButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 8,
    paddingHorizontal: Spacing.lg,
    borderRadius: 8,
    marginLeft: Spacing.md,
  },
  updateButtonText: {
    ...Typography.button,
    color: '#000000',
    fontWeight: '700',
  },
  laterButton: {
    paddingVertical: 8,
    paddingHorizontal: Spacing.md,
  },
  laterButtonText: {
    ...Typography.button,
    color: Colors.textTertiary,
  },
});

export default AppUpdateBanner;
