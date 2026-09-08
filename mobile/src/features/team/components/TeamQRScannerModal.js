import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  PermissionsAndroid,
  Easing,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { request, PERMISSIONS, RESULTS } from 'react-native-permissions';
import { launchImageLibrary } from 'react-native-image-picker';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme, Typography } from '../../../theme/theme';
import LinearGradient from '../../../components/SolidGradient';
import { showCustomAlert } from '../../../components/CustomAlert';

const TeamQRScannerModal = ({ visible, onClose, onScannedTeamId }) => {
  const { colors, isDark } = useTheme();
  const [manualCode, setManualCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mode, setMode] = useState('camera'); // 'camera' | 'manual'
  const [cameraUnavailable, setCameraUnavailable] = useState(false);
  const [scanLineAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    const checkAndRequestCameraPermission = async () => {
      try {
        if (Platform.OS === 'android') {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.CAMERA,
            {
              title: 'Camera Permission Required',
              message: 'ScoreVerse needs camera access to scan Team QR codes during match creation.',
              buttonPositive: 'Allow',
              buttonNegative: 'Cancel',
            }
          );
          if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
            setCameraUnavailable(true);
            setMode('manual');
          } else {
            setCameraUnavailable(false);
          }
        } else if (Platform.OS === 'ios') {
          const result = await request(PERMISSIONS.IOS.CAMERA);
          if (result === RESULTS.UNAVAILABLE) {
            setCameraUnavailable(true);
            setMode('manual');
          } else if (result !== RESULTS.GRANTED && result !== RESULTS.LIMITED) {
            setCameraUnavailable(true);
            setMode('manual');
          } else {
            setCameraUnavailable(false);
          }
        }
      } catch (err) {
        console.log('Error requesting camera permission:', err);
      }
    };

    if (visible) {
      if (mode === 'camera') {
        checkAndRequestCameraPermission();
        scanLineAnim.setValue(0);
        Animated.loop(
          Animated.sequence([
            Animated.timing(scanLineAnim, {
              toValue: 1,
              duration: 2000,
              easing: Easing.linear,
              useNativeDriver: true,
            }),
            Animated.timing(scanLineAnim, {
              toValue: 0,
              duration: 2000,
              easing: Easing.linear,
              useNativeDriver: true,
            }),
          ])
        ).start();
      }
    }
  }, [visible, mode, scanLineAnim]);

  const handleProcessCode = (scannedString) => {
    if (!scannedString || !scannedString.trim()) return;

    let teamId = scannedString.trim();
    // Parse SCOREVERSE_TEAM:id format if applicable
    if (teamId.startsWith('SCOREVERSE_TEAM:')) {
      teamId = teamId.replace('SCOREVERSE_TEAM:', '').trim();
    } else if (teamId.includes('/team/')) {
      const parts = teamId.split('/team/');
      teamId = parts[parts.length - 1].trim();
    }

    if (!teamId) {
      showCustomAlert('Invalid QR Code', 'The scanned QR code is not a valid Team QR code.');
      return;
    }

    onScannedTeamId(teamId);
    onClose();
  };

  const handleManualSubmit = () => {
    if (!manualCode.trim()) {
      showCustomAlert('Enter Team Code', 'Please enter a valid Team Code or ID.');
      return;
    }
    handleProcessCode(manualCode);
  };

  const handlePickFromGallery = async () => {
    try {
      const res = await launchImageLibrary({
        mediaType: 'photo',
        selectionLimit: 1,
      });
      if (res.didCancel) return;
      if (res.errorCode) {
        showCustomAlert('Gallery Error', res.errorMessage || 'Could not open photo gallery.');
        return;
      }
      setMode('manual');
      showCustomAlert('Image Selected', 'Please enter or paste the Team Code shown on your QR image.');
    } catch (err) {
      console.log('Error launching image library:', err);
    }
  };

  if (!visible) return null;

  const translateY = scanLineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 200],
  });

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <SafeAreaView style={styles.overlay}>
        {/* Header Bar */}
        <View style={[styles.headerBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
            <Icon name="arrow-left" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
            {mode === 'camera' ? 'Scan Team QR Code' : 'Enter Team Code'}
          </Text>
          <TouchableOpacity
            onPress={() => setMode(mode === 'camera' ? 'manual' : 'camera')}
            style={[styles.modeToggleBtn, { backgroundColor: colors.primaryAlpha10 }]}
            activeOpacity={0.8}
          >
            <Icon name={mode === 'camera' ? 'keyboard' : 'camera'} size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {mode === 'camera' ? (
          <View style={styles.cameraContainer}>
            {/* Viewfinder Target Container */}
            <View style={styles.viewfinderWrap}>
              <View style={[styles.scannerBox, { borderColor: colors.primary }]}>
                {/* Corner Accents */}
                <View style={[styles.cornerTL, { borderColor: colors.primary }]} />
                <View style={[styles.cornerTR, { borderColor: colors.primary }]} />
                <View style={[styles.cornerBL, { borderColor: colors.primary }]} />
                <View style={[styles.cornerBR, { borderColor: colors.primary }]} />

                {/* Animated Laser Scanning Line */}
                <Animated.View
                  style={[
                    styles.scanLine,
                    {
                      backgroundColor: colors.primary,
                      transform: [{ translateY }],
                    },
                  ]}
                />
              </View>

              <Text style={styles.viewfinderHint}>
                Align the Team QR code within the frame to automatically select team
              </Text>
            </View>

            {/* Quick Actions Bottom Container */}
            <View style={[styles.bottomCard, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
              <Text style={[styles.bottomCardTitle, { color: colors.textPrimary }]}>Having trouble scanning?</Text>
              <Text style={[styles.bottomCardDesc, { color: colors.textSecondary }]}>
                You can also enter the Team Code or Team ID manually.
              </Text>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                <TouchableOpacity
                  style={[styles.manualSwitchBtn, { flex: 1, backgroundColor: colors.primaryAlpha10, borderColor: colors.primary }]}
                  onPress={() => setMode('manual')}
                  activeOpacity={0.8}
                >
                  <Icon name="keyboard-outline" size={18} color={colors.primary} style={{ marginRight: 6 }} />
                  <Text style={[styles.manualSwitchBtnText, { color: colors.primary }]}>Enter Code</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.manualSwitchBtn, { flex: 1, backgroundColor: colors.surfaceVariant, borderColor: colors.border }]}
                  onPress={handlePickFromGallery}
                  activeOpacity={0.8}
                >
                  <Icon name="image-outline" size={18} color={colors.textPrimary} style={{ marginRight: 6 }} />
                  <Text style={[styles.manualSwitchBtnText, { color: colors.textPrimary }]}>Upload Photo</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : (
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={[styles.manualContainer, { backgroundColor: colors.background }]}>
              <View style={[styles.manualCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={[styles.iconWrap, { backgroundColor: colors.primaryAlpha10 }]}>
                  <Icon name="shield-account-outline" size={32} color={colors.primary} />
                </View>

                <Text style={[styles.manualTitle, { color: colors.textPrimary }]}>Enter Team Code or ID</Text>
                <Text style={[styles.manualSubtitle, { color: colors.textSecondary }]}>
                  Found on the Team QR Modal or Team Share Link.
                </Text>

                <View style={[styles.inputContainer, { backgroundColor: isDark ? colors.background : colors.surfaceVariant, borderColor: colors.border }]}>
                  <Icon name="pound" size={20} color={colors.primary} style={{ marginRight: 10 }} />
                  <TextInput
                    style={[styles.textInput, { color: colors.textPrimary }]}
                    placeholder="e.g. 64f8a129b0..."
                    placeholderTextColor={colors.textTertiary}
                    value={manualCode}
                    onChangeText={setManualCode}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  {manualCode.length > 0 && (
                    <TouchableOpacity onPress={() => setManualCode('')}>
                      <Icon name="close-circle" size={18} color={colors.textTertiary} />
                    </TouchableOpacity>
                  )}
                </View>

                <TouchableOpacity
                  style={{ width: '100%' }}
                  onPress={handleManualSubmit}
                  disabled={isSubmitting}
                  activeOpacity={0.8}
                >
                  <LinearGradient colors={[colors.primary, colors.primaryDark || colors.primary]} style={styles.submitBtn}>
                    {isSubmitting ? (
                      <ActivityIndicator color={colors.textOnPrimary} size="small" />
                    ) : (
                      <>
                        <Icon name="check-circle-outline" size={20} color={colors.textOnPrimary} style={{ marginRight: 8 }} />
                        <Text style={styles.submitBtnText}>Select Team</Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        )}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: '#000000',
  },
  headerBar: {
    height: 60,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
  },
  closeBtn: {
    padding: 6,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: Typography.fontFamily.bold,
  },
  modeToggleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraContainer: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  viewfinderWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  scannerBox: {
    width: 250,
    height: 250,
    borderRadius: 16,
    borderWidth: 1,
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  scanLine: {
    width: '100%',
    height: 3,
    position: 'absolute',
    top: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 4,
  },
  cornerTL: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 24,
    height: 24,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 12,
  },
  cornerTR: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 24,
    height: 24,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 12,
  },
  cornerBL: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: 24,
    height: 24,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 12,
  },
  cornerBR: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 12,
  },
  viewfinderHint: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: Typography.fontFamily.medium,
    textAlign: 'center',
    marginTop: 24,
    opacity: 0.8,
    paddingHorizontal: 20,
    lineHeight: 18,
  },
  bottomCard: {
    width: '100%',
    padding: 24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    alignItems: 'center',
  },
  bottomCardTitle: {
    fontSize: 16,
    fontFamily: Typography.fontFamily.bold,
    marginBottom: 4,
  },
  bottomCardDesc: {
    fontSize: 13,
    fontFamily: Typography.fontFamily.regular,
    marginBottom: 16,
    textAlign: 'center',
  },
  manualSwitchBtn: {
    width: '100%',
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  manualSwitchBtnText: {
    fontSize: 14,
    fontFamily: Typography.fontFamily.semiBold,
  },
  manualContainer: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  manualCard: {
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  manualTitle: {
    fontSize: 18,
    fontFamily: Typography.fontFamily.bold,
    marginBottom: 6,
  },
  manualSubtitle: {
    fontSize: 13,
    fontFamily: Typography.fontFamily.regular,
    textAlign: 'center',
    marginBottom: 20,
  },
  inputContainer: {
    width: '100%',
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    marginBottom: 20,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: Typography.fontFamily.regular,
  },
  submitBtn: {
    width: '100%',
    height: 50,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: Typography.fontFamily.bold,
  },
});

export default TeamQRScannerModal;
