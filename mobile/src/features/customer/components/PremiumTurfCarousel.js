import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Animated,
  TouchableOpacity,
  Image,
} from 'react-native';
import LinearGradient from '../../../components/SolidGradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors, Typography, Shadows } from '../../../theme/theme';
import { getImageUrl } from '../../../api/axios';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH * 0.75;
const OVERLAP_AMOUNT = SCREEN_WIDTH * 0.12; 

export const PremiumTurfCarousel = ({ data, onTurfPress, onFavoriteToggle, favourites = [] }) => {
  const scrollX = useRef(new Animated.Value(0)).current;

  if (!data || data.length === 0) return null;

  const getMinPrice = (pricing) => {
    if (!pricing) return 0;
    const p = [pricing.weekdayDay, pricing.weekdayNight, pricing.weekendDay, pricing.weekendNight].filter(x => x > 0);
    return p.length ? Math.min(...p) : 0;
  };

  const renderItem = ({ item, index }) => {
    const minPrice = getMinPrice(item.pricing);
    const isFav = favourites.includes(item._id);

    const inputRange = [
      (index - 1) * CARD_WIDTH,
      index * CARD_WIDTH,
      (index + 1) * CARD_WIDTH,
    ];

    const scale = scrollX.interpolate({
      inputRange,
      outputRange: [0.90, 1.0, 0.90],
      extrapolate: 'clamp',
    });

    const opacity = scrollX.interpolate({
      inputRange,
      outputRange: [0.65, 1.0, 0.65],
      extrapolate: 'clamp',
    });

    const translateX = scrollX.interpolate({
      inputRange,
      outputRange: [-30, 0, 30],
      extrapolate: 'clamp',
    });

    const imageTranslateX = scrollX.interpolate({
      inputRange,
      outputRange: [30, 0, -30],
      extrapolate: 'clamp',
    });

    const zIndex = scrollX.interpolate({
      inputRange,
      outputRange: [0, 100, 0],
      extrapolate: 'clamp',
    });

    return (
      <View style={{ width: CARD_WIDTH }}>
        <Animated.View
          style={[
            styles.cardContainer,
            {
              transform: [
                { translateX },
                { scale }
              ],
              opacity,
              zIndex,
              elevation: zIndex,
            }
          ]}
        >
          <TouchableOpacity
            activeOpacity={0.9}
            style={styles.touchableCard}
            onPress={() => onTurfPress(item._id)}
          >
            <View style={styles.imageContainer}>
              <Animated.Image
                source={{ uri: getImageUrl(item.coverImage) }}
                style={[styles.heroImage, { transform: [{ translateX: imageTranslateX }] }]}
                resizeMode="cover"
              />
              
              <View style={styles.topOverlayRow}>
                <View style={styles.openNowPill}>
                  <View style={styles.openDot} />
                  <Text style={styles.openNowText}>OPEN NOW</Text>
                </View>
                
                {item.isTrending ? (
                  <View style={styles.trendingPill}>
                    <Icon name="fire" size={12} color="#FFC107" />
                    <Text style={styles.trendingText}>TRENDING</Text>
                  </View>
                ) : <View />}
              </View>

              <TouchableOpacity
                style={styles.favoriteBtn}
                onPress={() => onFavoriteToggle(item._id)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Icon name={isFav ? "cards-heart" : "heart-outline"} size={18} color={isFav ? "#FF4B4B" : "#FFF"} />
              </TouchableOpacity>
            </View>

            <View style={styles.solidPanel}>
              <View style={styles.solidContent}>
                <View style={styles.infoRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.groundName} numberOfLines={1}>{item.name}</Text>
                    <View style={styles.locationRow}>
                      <Icon name="map-marker" size={12} color={Colors.textSecondary} />
                      <Text style={styles.locationText} numberOfLines={1}>
                        {item.city} • {item.distance ? `${item.distance} km` : 'Near you'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.ratingBox}>
                    <Icon name="star" size={12} color="#000" />
                    <Text style={styles.ratingText}>{item.rating || '0'}</Text>
                  </View>
                </View>

                <View style={styles.bottomRow}>
                  <View>
                    <Text style={styles.startingText}>STARTING</Text>
                    <Text style={styles.priceText}>
                      ₹{minPrice}<Text style={styles.perHour}>/hr</Text>
                    </Text>
                  </View>
                  <TouchableOpacity style={styles.bookButton} onPress={() => onTurfPress(item._id)}>
                    <Text style={styles.bookButtonText}>Book Now</Text>
                    <Icon name="arrow-right" size={14} color="#000" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        </Animated.View>
      </View>
    );
  };

  return (
    <View style={styles.carouselContainer}>
      <Animated.FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={data}
        keyExtractor={(item) => item._id.toString()}
        renderItem={renderItem}
        snapToInterval={CARD_WIDTH}
        decelerationRate="fast"
        snapToAlignment="start"
        contentContainerStyle={{
          paddingLeft: (SCREEN_WIDTH - CARD_WIDTH) / 2,
          paddingRight: (SCREEN_WIDTH - CARD_WIDTH) / 2,
          paddingVertical: 20,
        }}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
      />

    </View>
  );
};

const styles = StyleSheet.create({
  carouselContainer: {
    marginVertical: 10,
  },
  cardContainer: {
    width: CARD_WIDTH,
    aspectRatio: 4 / 5,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
  },
  touchableCard: {
    flex: 1,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#0A0A0A',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  imageContainer: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: 24,
  },
  heroImage: {
    width: '120%',
    height: '100%',
    marginLeft: '-10%',
  },
  topOverlayRow: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  openNowPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  openDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2ECC71',
    marginRight: 6,
  },
  openNowText: {
    color: '#FFF',
    fontFamily: Typography.fontFamily.bold,
    fontSize: 9,
    letterSpacing: 0.5,
  },
  trendingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  trendingText: {
    color: Colors.primary,
    fontFamily: Typography.fontFamily.bold,
    fontSize: 9,
    letterSpacing: 0.5,
    marginLeft: 4,
  },
  favoriteBtn: {
    position: 'absolute',
    right: 16,
    top: 52,
    backgroundColor: 'rgba(0,0,0,0.5)',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  solidPanel: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    borderRadius: 20,
    backgroundColor: '#050505',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  solidContent: {
    padding: 16,
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  groundName: {
    color: '#FFFFFF',
    fontFamily: Typography.fontFamily.bold,
    fontSize: 18,
    marginBottom: 4,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    color: '#A0A0A0',
    fontFamily: Typography.fontFamily.medium,
    fontSize: 13,
  },
  ratingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  ratingText: {
    color: '#000',
    fontFamily: Typography.fontFamily.bold,
    fontSize: 12,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingTop: 12,
  },
  startingText: {
    color: '#A0A0A0',
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: 9,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  priceText: {
    color: '#FFF',
    fontFamily: Typography.fontFamily.bold,
    fontSize: 20,
  },
  perHour: {
    fontSize: 12,
    color: '#A0A0A0',
    fontFamily: Typography.fontFamily.medium,
  },
  bookButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    gap: 6,
  },
  bookButtonText: {
    color: '#000',
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: 14,
  }
});
