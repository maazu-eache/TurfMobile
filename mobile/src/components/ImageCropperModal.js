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
} from 'react-native';
import { captureRef } from 'react-native-view-shot';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors, Typography } from '../theme/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CROP_SIZE = SCREEN_WIDTH - 40;

const ImageCropperModal = ({ visible, imageUri, onCrop, onClose }) => {
  const [zoom, setZoom] = useState(1);
  const viewShotRef = useRef(null);

  // Animated values for smooth panning
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const lastOffset = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (visible) {
      pan.setValue({ x: 0, y: 0 });
      lastOffset.current = { x: 0, y: 0 };
      setZoom(1);
    }
  }, [visible, imageUri]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        pan.setOffset({
          x: lastOffset.current.x,
          y: lastOffset.current.y,
        });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event(
        [null, { dx: pan.x, dy: pan.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: () => {
        pan.flattenOffset();
        lastOffset.current = {
          x: pan.x._value,
          y: pan.y._value,
        };
      },
    })
  ).current;

  const handleZoomChange = (amount) => {
    setZoom((prev) => {
      const next = prev + amount;
      return Math.max(1, Math.min(next, 3.5));
    });
  };

  const handleCrop = async () => {
    if (!viewShotRef.current) return;
    try {
      const uri = await captureRef(viewShotRef.current, {
        format: 'jpeg',
        quality: 0.9,
        width: 500, // standard output size
        height: 500,
      });
      onCrop(uri);
    } catch (error) {
      console.log('Cropping failed:', error);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
              <Icon name="close" size={24} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Crop Image</Text>
            <TouchableOpacity onPress={handleCrop} style={styles.cropBtn}>
              <Text style={styles.cropBtnText}>Done</Text>
            </TouchableOpacity>
          </View>

          {/* Viewport Box */}
          <View style={styles.viewportWrapper}>
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
                    ],
                  },
                ]}
              >
                {imageUri ? (
                  <Image
                    source={{ uri: imageUri }}
                    style={styles.image}
                    resizeMode="contain"
                  />
                ) : null}
              </Animated.View>
            </View>
          </View>

          {/* Controls */}
          <View style={styles.controls}>
            <Text style={styles.tipText}>Drag to position. Zoom using the buttons below.</Text>
            <View style={styles.zoomControls}>
              <TouchableOpacity
                onPress={() => handleZoomChange(-0.25)}
                style={styles.zoomBtn}
                activeOpacity={0.7}
              >
                <Icon name="minus" size={22} color="#FFF" />
              </TouchableOpacity>
              <Text style={styles.zoomText}>{Math.round(zoom * 100)}%</Text>
              <TouchableOpacity
                onPress={() => handleZoomChange(0.25)}
                style={styles.zoomBtn}
                activeOpacity={0.7}
              >
                <Icon name="plus" size={22} color="#FFF" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '100%',
    flex: 1,
    justifyContent: 'space-between',
    paddingVertical: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    height: 50,
  },
  headerBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: Typography.fontFamily.bold,
    color: '#FFF',
  },
  cropBtn: {
    backgroundColor: Colors.primary || '#FFD400',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  cropBtnText: {
    fontSize: 14,
    fontFamily: Typography.fontFamily.bold,
    color: '#000',
  },
  viewportWrapper: {
    alignSelf: 'center',
    width: CROP_SIZE,
    height: CROP_SIZE,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  viewport: {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#000',
  },
  imageContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  controls: {
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 16,
  },
  tipText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontFamily: Typography.fontFamily.medium,
    textAlign: 'center',
  },
  zoomControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  zoomBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomText: {
    color: '#FFF',
    fontSize: 16,
    fontFamily: Typography.fontFamily.bold,
    minWidth: 60,
    textAlign: 'center',
  },
});

export default ImageCropperModal;
