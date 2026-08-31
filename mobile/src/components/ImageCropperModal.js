import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Image,
  Dimensions,
  PanResponder,
  Animated,
  StatusBar,
} from 'react-native';
import { captureRef } from 'react-native-view-shot';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors, Typography } from '../theme/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CROP_SIZE = Math.min(SCREEN_WIDTH - 48, 300);

const ImageCropperModal = ({ visible, imageUri, onCrop, onClose }) => {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [imgLayout, setImgLayout] = useState({ width: CROP_SIZE, height: CROP_SIZE });
  const viewShotRef = useRef(null);

  // Animated values for smooth panning
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const lastOffset = useRef({ x: 0, y: 0 });

  // Reset on open
  useEffect(() => {
    if (visible && imageUri) {
      pan.setValue({ x: 0, y: 0 });
      lastOffset.current = { x: 0, y: 0 };
      setZoom(1);
      setRotation(0);

      Image.getSize(
        imageUri,
        (width, height) => {
          if (width && height) {
            const aspect = width / height;
            let targetW, targetH;
            if (aspect > 1) {
              targetH = CROP_SIZE;
              targetW = CROP_SIZE * aspect;
            } else {
              targetW = CROP_SIZE;
              targetH = CROP_SIZE / aspect;
            }
            setImgLayout({ width: targetW, height: targetH });
          }
        },
        () => {
          setImgLayout({ width: CROP_SIZE, height: CROP_SIZE });
        }
      );
    }
  }, [visible, imageUri]);

  // Touch handlers for panning & pinch-to-zoom
  const initialTouchDistance = useRef(0);
  const initialTouchZoom = useRef(1);

  const getDistance = (touches) => {
    if (touches.length < 2) return 0;
    const [t1, t2] = touches;
    const dx = t1.pageX - t2.pageX;
    const dy = t1.pageY - t2.pageY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        if (evt.nativeEvent.touches.length === 2) {
          initialTouchDistance.current = getDistance(evt.nativeEvent.touches);
          initialTouchZoom.current = zoom;
        } else {
          pan.setOffset({
            x: lastOffset.current.x,
            y: lastOffset.current.y,
          });
          pan.setValue({ x: 0, y: 0 });
        }
      },
      onPanResponderMove: (evt, gestureState) => {
        if (evt.nativeEvent.touches.length === 2) {
          const currentDistance = getDistance(evt.nativeEvent.touches);
          if (initialTouchDistance.current > 0) {
            const scaleFactor = currentDistance / initialTouchDistance.current;
            const nextZoom = Math.max(1, Math.min(initialTouchZoom.current * scaleFactor, 4));
            setZoom(nextZoom);
          }
        } else if (evt.nativeEvent.touches.length === 1) {
          pan.setValue({ x: gestureState.dx, y: gestureState.dy });
        }
      },
      onPanResponderRelease: () => {
        pan.flattenOffset();
        lastOffset.current = {
          x: pan.x._value,
          y: pan.y._value,
        };
        initialTouchDistance.current = 0;
      },
    })
  ).current;

  const handleZoomChange = (delta) => {
    setZoom((prev) => Math.max(1, Math.min(+(prev + delta).toFixed(2), 4)));
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleReset = () => {
    pan.setValue({ x: 0, y: 0 });
    lastOffset.current = { x: 0, y: 0 };
    setZoom(1);
    setRotation(0);
  };

  const handleCrop = async () => {
    if (!viewShotRef.current) return;
    try {
      const uri = await captureRef(viewShotRef.current, {
        format: 'jpeg',
        quality: 0.95,
        width: 600,
        height: 600,
      });
      onCrop(uri);
    } catch (error) {
      console.log('Cropping failed:', error);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <View style={styles.overlay}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerBtn} activeOpacity={0.7}>
            <Icon name="close" size={24} color="#FFF" />
          </TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
            <Text style={styles.headerTitle}>Move & Scale</Text>
            <Text style={styles.headerSubtitle}>Fit photo inside the circle</Text>
          </View>
          <TouchableOpacity onPress={handleCrop} style={styles.doneBtn} activeOpacity={0.8}>
            <Text style={styles.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </View>

        {/* Viewport Center Area */}
        <View style={styles.centerContainer}>
          <View style={styles.viewportWrapper}>
            {/* ViewShot captures the exact square viewport */}
            <View ref={viewShotRef} style={styles.viewport} collapsable={false}>
              <Animated.View
                {...panResponder.panHandlers}
                style={[
                  styles.imageContainer,
                  {
                    transform: [
                      { translateX: pan.x },
                      { translateY: pan.y },
                      { scale: zoom },
                      { rotate: `${rotation}deg` },
                    ],
                  },
                ]}
              >
                {imageUri ? (
                  <Image
                    source={{ uri: imageUri }}
                    style={{ width: imgLayout.width, height: imgLayout.height }}
                    resizeMode="cover"
                  />
                ) : null}
              </Animated.View>
            </View>

            {/* Circular Guide Mask Overlay positioned exactly on top */}
            <View pointerEvents="none" style={styles.circleBorder}>
              <View style={styles.gridLineH1} />
              <View style={styles.gridLineH2} />
              <View style={styles.gridLineV1} />
              <View style={styles.gridLineV2} />
            </View>
          </View>
        </View>

        {/* Bottom Control Bar */}
        <View style={styles.bottomBar}>
          <Text style={styles.hintText}>Pinch or drag to reposition</Text>

          {/* Action Row */}
          <View style={styles.controlsRow}>
            <TouchableOpacity onPress={handleRotate} style={styles.toolBtn} activeOpacity={0.7}>
              <Icon name="rotate-right" size={20} color="#FFF" />
              <Text style={styles.toolBtnText}>Rotate</Text>
            </TouchableOpacity>

            <View style={styles.zoomGroup}>
              <TouchableOpacity onPress={() => handleZoomChange(-0.25)} style={styles.zoomIconBtn} activeOpacity={0.7}>
                <Icon name="minus" size={20} color="#FFF" />
              </TouchableOpacity>
              <Text style={styles.zoomLabel}>{Math.round(zoom * 100)}%</Text>
              <TouchableOpacity onPress={() => handleZoomChange(0.25)} style={styles.zoomIconBtn} activeOpacity={0.7}>
                <Icon name="plus" size={20} color="#FFF" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity onPress={handleReset} style={styles.toolBtn} activeOpacity={0.7}>
              <Icon name="restore" size={20} color="#FFF" />
              <Text style={styles.toolBtnText}>Reset</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: '#0A0C0E',
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 14,
    backgroundColor: 'rgba(0,0,0,0.85)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  headerBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: Typography.fontFamily.bold,
    color: '#FFF',
  },
  headerSubtitle: {
    fontSize: 11,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  doneBtn: {
    backgroundColor: Colors.primary || '#FFD400',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  doneBtnText: {
    fontSize: 13,
    fontFamily: Typography.fontFamily.bold,
    color: '#000',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewportWrapper: {
    width: CROP_SIZE,
    height: CROP_SIZE,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewport: {
    width: CROP_SIZE,
    height: CROP_SIZE,
    borderRadius: CROP_SIZE / 2,
    overflow: 'hidden',
    backgroundColor: '#111',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  circleBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: CROP_SIZE,
    height: CROP_SIZE,
    borderRadius: CROP_SIZE / 2,
    borderWidth: 2,
    borderColor: Colors.primary || '#FFD400',
    overflow: 'hidden',
  },
  gridLineH1: {
    position: 'absolute',
    top: CROP_SIZE / 3,
    left: 0,
    right: 0,
    height: 0.5,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  gridLineH2: {
    position: 'absolute',
    top: (CROP_SIZE / 3) * 2,
    left: 0,
    right: 0,
    height: 0.5,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  gridLineV1: {
    position: 'absolute',
    left: CROP_SIZE / 3,
    top: 0,
    bottom: 0,
    width: 0.5,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  gridLineV2: {
    position: 'absolute',
    left: (CROP_SIZE / 3) * 2,
    top: 0,
    bottom: 0,
    width: 0.5,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  bottomBar: {
    backgroundColor: 'rgba(0,0,0,0.85)',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 36,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    gap: 14,
  },
  hintText: {
    color: Colors.textTertiary,
    fontSize: 12,
    fontFamily: Typography.fontFamily.medium,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  toolBtn: {
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  toolBtnText: {
    color: '#FFF',
    fontSize: 10,
    fontFamily: Typography.fontFamily.medium,
  },
  zoomGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 24,
    paddingHorizontal: 6,
    paddingVertical: 4,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  zoomIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomLabel: {
    color: '#FFF',
    fontSize: 13,
    fontFamily: Typography.fontFamily.bold,
    minWidth: 44,
    textAlign: 'center',
  },
});

export default ImageCropperModal;
