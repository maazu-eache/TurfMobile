import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Dimensions,
  Animated,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useDispatch } from 'react-redux';
import { setGuestMode } from '../authSlice';
import { Colors, Typography, Spacing, BorderRadius } from '../../../theme/theme';

const { width } = Dimensions.get('window');

const ACCENT          = Colors.primary;          // single accent — used sparingly
const BG              = '#0B1120';               // deep navy base
const CARD            = '#131D2E';               // slightly elevated surface
const BORDER          = 'rgba(255,255,255,0.08)';
const TEXT_PRIMARY    = '#FFFFFF';
const TEXT_SECONDARY  = '#8A95A8';

const slides = [
  {
    id: '1',
    title: 'Find & Book Turfs',
    description: 'Discover top-rated cricket turfs near you and book instantly at the best price.',
    icon: 'stadium',
  },
  {
    id: '2',
    title: 'Score Like a Pro',
    description: 'Ball-by-ball live scoring system to track every match and maintain lifelong stats.',
    icon: 'cricket',
  },
  {
    id: '3',
    title: 'Manage Tournaments',
    description: 'Create teams, host tournaments, and climb the city-wide leaderboards.',
    icon: 'trophy-outline',
  },
];

/* ─── Animated pagination dots ─────────────────────────── */
const Pagination = ({ data, scrollX }) => (
  <View style={styles.pagination}>
    {data.map((_, i) => {
      const range     = [(i - 1) * width, i * width, (i + 1) * width];
      const dotWidth  = scrollX.interpolate({ inputRange: range, outputRange: [6, 22, 6], extrapolate: 'clamp' });
      const opacity   = scrollX.interpolate({ inputRange: range, outputRange: [0.3, 1, 0.3], extrapolate: 'clamp' });
      const bg        = scrollX.interpolate({ inputRange: range, outputRange: [BORDER, ACCENT, BORDER], extrapolate: 'clamp' });
      return (
        <Animated.View
          key={i}
          style={[styles.dot, { width: dotWidth, opacity, backgroundColor: bg }]}
        />
      );
    })}
  </View>
);

/* ─── Screen ────────────────────────────────────────────── */
const OnboardingScreen = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const slidesRef  = useRef(null);
  const scrollX    = useRef(new Animated.Value(0)).current;
  const dispatch   = useDispatch();

  const onViewRef  = useRef(({ viewableItems }) => {
    if (viewableItems[0]) setCurrentIndex(viewableItems[0].index);
  }).current;
  const viewConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const handleNext = () => {
    if (currentIndex < slides.length - 1) {
      slidesRef.current.scrollToIndex({ index: currentIndex + 1 });
    } else {
      dispatch(setGuestMode(true));
    }
  };

  const renderItem = ({ item }) => (
    <View style={styles.slide}>
      {/* Icon */}
      <View style={styles.iconBlock}>
        <View style={styles.iconCircle}>
          <Icon name={item.icon} size={52} color={ACCENT} />
        </View>
      </View>

      {/* Text */}
      <View style={styles.textBlock}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.description}>{item.description}</Text>
      </View>
    </View>
  );

  const isLast = currentIndex === slides.length - 1;

  return (
    <View style={styles.container}>
      {/* Slides */}
      <Animated.FlatList
        ref={slidesRef}
        data={slides}
        renderItem={renderItem}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false },
        )}
        onViewableItemsChanged={onViewRef}
        viewabilityConfig={viewConfig}
        style={{ flex: 1 }}
      />

      {/* Footer */}
      <View style={styles.footer}>
        <Pagination data={slides} scrollX={scrollX} />

        <View style={styles.actions}>
          {!isLast ? (
            <TouchableOpacity
              onPress={() => dispatch(setGuestMode(true))}
              activeOpacity={0.6}
              style={styles.skipBtn}
            >
              <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>
          ) : (
            <View />
          )}

          <TouchableOpacity
            onPress={handleNext}
            activeOpacity={0.85}
            style={[styles.primaryBtn, isLast && styles.primaryBtnWide]}
          >
            <Text style={styles.primaryBtnText}>
              {isLast ? 'Get Started' : 'Next'}
            </Text>
            <Icon name="arrow-right" size={18} color="#000" style={{ marginLeft: 6 }} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

/* ─── Styles ─────────────────────────────────────────────── */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },

  /* Slide */
  slide: {
    width,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing['2xl'],
  },

  /* Icon */
  iconBlock: {
    marginBottom: 40,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* Text */
  textBlock: {
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
  },
  title: {
    fontSize: Typography.fontSize['2xl'],
    fontFamily: Typography.fontFamily.extraBold,
    color: TEXT_PRIMARY,
    textAlign: 'center',
    marginBottom: Spacing.md,
    letterSpacing: 0.3,
  },
  description: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.regular,
    color: TEXT_SECONDARY,
    textAlign: 'center',
    lineHeight: 24,
  },

  /* Footer */
  footer: {
    paddingHorizontal: Spacing['2xl'],
    paddingBottom: 44,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    backgroundColor: BG,
  },

  /* Pagination */
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xl,
    height: 18,
  },
  dot: {
    height: 6,
    borderRadius: 3,
    marginHorizontal: 4,
  },

  /* Actions row */
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  skipBtn: {
    paddingVertical: 14,
    paddingHorizontal: Spacing.md,
  },
  skipText: {
    color: TEXT_SECONDARY,
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.base,
  },

  /* Primary button */
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ACCENT,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: BorderRadius.full,
  },
  primaryBtnWide: {
    flex: 1,
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: '#000',
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.fontSize.base,
  },
});

export default OnboardingScreen;
