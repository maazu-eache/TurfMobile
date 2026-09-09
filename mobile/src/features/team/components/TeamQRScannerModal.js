import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Easing,
  Animated,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useCodeScanner,
} from 'react-native-vision-camera';
import { launchImageLibrary } from 'react-native-image-picker';
import RNQRGenerator from 'rn-qr-generator';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme, Typography } from '../../../theme/theme';
import { showCustomAlert } from '../../../components/CustomAlert';

const TeamQRScannerModal = ({ visible, onClose, onScannedTeamId }) => {
  const { colors } = useTheme();
  const [isGalleryDecoding, setIsGalleryDecoding] = useState(false);
  const [scanLineAnim] = useState(new Animated.Value(0));
  const scannedRef = useRef(false); // prevent double-fire

  // ─── VisionCamera v4 hooks ─────────────────────────────────────────────────
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  // ──────────────────────────────────────────────────────────────────────────

  // Request camera permission when modal opens
  useEffect(() => {
    if (!visible) {
      scannedRef.current = false;
      return;
    }
    if (!hasPermission) {
      requestPermission().then((granted) => {
        if (!granted) {
          showCustomAlert(
            'Camera Permission Denied',
            'Camera access was denied. You can upload a QR image from your gallery or grant Camera permission in Settings.',
          );
        }
      });
    }
  }, [visible, hasPermission, requestPermission]);

  // Scan-line animation (runs while modal is visible)
  useEffect(() => {
    if (visible) {
      scannedRef.current = false;
      scanLineAnim.setValue(0);
      const anim = Animated.loop(
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
        ]),
      );
      anim.start();
      return () => anim.stop();
    }
  }, [visible, scanLineAnim]);

  // ─── QR code processing ────────────────────────────────────────────────────
  const handleProcessCode = useCallback(
    (scannedString) => {
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
    },
    [onScannedTeamId, onClose],
  );

  // ─── Native camera code scanner (VisionCamera v4 built-in) ────────────────
  const codeScanner = useCodeScanner({
    codeTypes: ['qr'],
    onCodeScanned: (codes) => {
      // Guard: only fire once per modal open
      if (scannedRef.current) return;
      const first = codes.find((c) => c.value);
      if (first?.value) {
        scannedRef.current = true;
        handleProcessCode(first.value);
      }
    },
  });

  // ─── Gallery QR decode (rn-qr-generator) ──────────────────────────────────
  const handlePickFromGallery = async () => {
    try {
      const res = await launchImageLibrary({
        mediaType: 'photo',
        selectionLimit: 1,
        includeBase64: false,
      });

      if (res.didCancel) return;
      if (res.errorCode) {
        showCustomAlert('Gallery Error', res.errorMessage || 'Could not open photo gallery.');
        return;
      }

      const asset = res.assets?.[0];
      if (!asset?.uri) return;

      setIsGalleryDecoding(true);

      try {
        // Use rn-qr-generator to decode QR from image file URI natively
        const response = await RNQRGenerator.detect({ uri: asset.uri });
        const { values } = response;

        if (!values || values.length === 0) {
          throw new Error('no_result');
        }

        setIsGalleryDecoding(false);
        // Use the first detected QR value
        handleProcessCode(values[0]);
      } catch (err) {
        setIsGalleryDecoding(false);
        if (err?.message !== 'no_result') {
          console.warn('[QRScanner] Gallery decode error:', err?.message);
        }
        showCustomAlert(
          'No QR Code Found',
          "We couldn't detect a QR code in that image. Please select a clear Team QR image.",
        );
      }
    } catch (err) {
      setIsGalleryDecoding(false);
      console.log('Error launching image library:', err);
    }
  };

  if (!visible) return null;

  const translateY = scanLineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 200],
  });

  // Whether the actual Camera component can be rendered
  const canShowCamera = hasPermission && device != null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <SafeAreaView style={styles.overlay}>
        {/* Header Bar */}
        <View style={[styles.headerBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
            <Icon name="arrow-left" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
            Scan Team QR Code
          </Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.cameraContainer}>
          {/* Viewfinder / Live Camera */}
          <View style={styles.viewfinderWrap}>
            <View style={[styles.scannerBox, { borderColor: colors.primary }]}>
              {/* Corner Accents — rendered above the camera feed via zIndex */}
              <View style={[styles.cornerTL, { borderColor: colors.primary }]} />
              <View style={[styles.cornerTR, { borderColor: colors.primary }]} />
              <View style={[styles.cornerBL, { borderColor: colors.primary }]} />
              <View style={[styles.cornerBR, { borderColor: colors.primary }]} />

              {canShowCamera ? (
                <>
                  {/* ✅ Real camera feed with built-in QR scanning */}
                  <Camera
                    style={StyleSheet.absoluteFill}
                    device={device}
                    isActive={visible}
                    codeScanner={codeScanner}
                  />
                  {/* Animated laser line overlay */}
                  <Animated.View
                    style={[
                      styles.scanLine,
                      {
                        backgroundColor: colors.primary,
                        transform: [{ translateY }],
                      },
                    ]}
                  />
                </>
              ) : (
                /* Placeholder while permission not yet granted / device loading */
                <View style={styles.cameraPlaceholder}>
                  {!hasPermission ? (
                    <>
                      <Icon name="camera-off" size={40} color={colors.textSecondary} />
                      <Text style={[styles.placeholderText, { color: colors.textSecondary }]}>
                        Camera permission required
                      </Text>
                      <TouchableOpacity
                        style={[styles.permissionBtn, { backgroundColor: colors.primary }]}
                        onPress={() => {
                          requestPermission().then((granted) => {
                            if (!granted) Linking.openSettings();
                          });
                        }}
                      >
                        <Text style={styles.permissionBtnText}>Allow Camera</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      <ActivityIndicator size="large" color={colors.primary} />
                      <Text style={[styles.placeholderText, { color: colors.textSecondary }]}>
                        Starting camera…
                      </Text>
                    </>
                  )}
                </View>
              )}
            </View>

            <Text style={styles.viewfinderHint}>
              Align the Team QR code within the frame to automatically select team
            </Text>
          </View>

          {/* Quick Actions Bottom Card */}
          <View style={[styles.bottomCard, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
            <Text style={[styles.bottomCardTitle, { color: colors.textPrimary }]}>Having trouble scanning?</Text>
            <Text style={[styles.bottomCardDesc, { color: colors.textSecondary }]}>
              You can also upload a Team QR photo from your gallery.
            </Text>
            <TouchableOpacity
              style={[styles.galleryBtn, { backgroundColor: colors.surfaceVariant, borderColor: colors.border }]}
              onPress={handlePickFromGallery}
              disabled={isGalleryDecoding}
              activeOpacity={0.8}
            >
              {isGalleryDecoding ? (
                <ActivityIndicator size="small" color={colors.textPrimary} style={{ marginRight: 8 }} />
              ) : (
                <Icon name="image-outline" size={20} color={colors.textPrimary} style={{ marginRight: 8 }} />
              )}
              <Text style={[styles.galleryBtnText, { color: colors.textPrimary }]}>
                {isGalleryDecoding ? 'Reading…' : 'Upload Photo'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
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
  cameraPlaceholder: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  placeholderText: {
    fontSize: 13,
    fontFamily: Typography.fontFamily.medium,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  permissionBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 4,
  },
  permissionBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: Typography.fontFamily.semiBold,
  },
  scanLine: {
    width: '100%',
    height: 3,
    position: 'absolute',
    top: 0,
    zIndex: 5,
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
    zIndex: 10,
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
    zIndex: 10,
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
    zIndex: 10,
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
    zIndex: 10,
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
  galleryBtn: {
    width: '100%',
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  galleryBtnText: {
    fontSize: 14,
    fontFamily: Typography.fontFamily.semiBold,
  },
});

export default TeamQRScannerModal;
