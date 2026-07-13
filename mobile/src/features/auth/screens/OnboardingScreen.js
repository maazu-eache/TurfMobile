import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Dimensions } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useDispatch } from 'react-redux';
import { setGuestMode } from '../authSlice';
import { Colors, Typography, Spacing, BorderRadius } from '../../../theme/theme';

const { width, height } = Dimensions.get('window');

const slides = [
  {
    id: '1',
    title: 'Find & Book Turfs',
    description: 'Discover the best cricket turfs around you and book them instantly with dynamic pricing.',
    icon: 'stadium',
  },
  {
    id: '2',
    title: 'Score Like a Pro',
    description: 'Use our ball-by-ball live scoring system to track every match and maintain lifelong stats.',
    icon: 'cricket',
  },
  {
    id: '3',
    title: 'Manage Tournaments',
    description: 'Create teams, host tournaments, and climb the city-wide leaderboards.',
    icon: 'trophy',
  },
];

const OnboardingScreen = ({ navigation }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const slidesRef = useRef(null);

  const viewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems[0]) {
      setCurrentIndex(viewableItems[0].index);
    }
  }).current;

  const viewConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const dispatch = useDispatch();

  const scrollToNext = () => {
    if (currentIndex < slides.length - 1) {
      slidesRef.current.scrollToIndex({ index: currentIndex + 1 });
    } else {
      dispatch(setGuestMode(true));
    }
  };

  const renderItem = ({ item }) => (
    <View style={styles.slide}>
      <View style={styles.iconContainer}>
        <LinearGradient colors={Colors.gradients.primary} style={styles.iconBg}>
          <Icon name={item.icon} size={80} color="#000" />
        </LinearGradient>
      </View>
      <View style={styles.textContainer}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.description}>{item.description}</Text>
      </View>
    </View>
  );

  return (
    <LinearGradient colors={Colors.gradients.dark} style={styles.container}>
      <View style={{ flex: 3 }}>
        <FlatList
          data={slides}
          renderItem={renderItem}
          horizontal
          showsHorizontalScrollIndicator={false}
          pagingEnabled
          bounces={false}
          keyExtractor={(item) => item.id}
          onViewableItemsChanged={viewableItemsChanged}
          viewabilityConfig={viewConfig}
          ref={slidesRef}
        />
      </View>

      <View style={styles.footer}>
        <View style={styles.pagination}>
          {slides.map((_, i) => (
            <View key={i} style={[styles.dot, currentIndex === i && styles.dotActive]} />
          ))}
        </View>

        <View style={styles.actions}>
          <TouchableOpacity onPress={() => dispatch(setGuestMode(true))}>
            <Text style={styles.skipBtn}>Skip</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.nextBtn} onPress={scrollToNext}>
            <LinearGradient colors={Colors.gradients.primary} style={styles.nextBtnGrad}>
              <Text style={styles.nextBtnText}>{currentIndex === slides.length - 1 ? 'Get Started' : 'Next'}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  slide: { width, alignItems: 'center', justifyContent: 'center', padding: Spacing['2xl'] },
  iconContainer: { flex: 0.6, justifyContent: 'center' },
  iconBg: { width: 160, height: 160, borderRadius: 80, justifyContent: 'center', alignItems: 'center', elevation: 10, shadowColor: Colors.primary, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20 },
  textContainer: { flex: 0.4, alignItems: 'center' },
  title: { fontSize: Typography.fontSize['3xl'], fontFamily: Typography.fontFamily.extraBold, color: Colors.textPrimary, marginBottom: Spacing.md, textAlign: 'center' },
  description: { fontSize: Typography.fontSize.md, fontFamily: Typography.fontFamily.regular, color: Colors.textSecondary, textAlign: 'center', lineHeight: 24, paddingHorizontal: Spacing.md },
  footer: { flex: 1, justifyContent: 'space-between', paddingHorizontal: Spacing['2xl'], paddingBottom: 60 },
  pagination: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.xl },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.surfaceVariant, marginHorizontal: 4 },
  dotActive: { width: 24, backgroundColor: Colors.primary },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  skipBtn: { color: Colors.textSecondary, fontFamily: Typography.fontFamily.bold, fontSize: 16, padding: Spacing.md },
  nextBtn: { borderRadius: BorderRadius.full, overflow: 'hidden' },
  nextBtnGrad: { paddingHorizontal: 32, paddingVertical: 14 },
  nextBtnText: { color: '#000', fontFamily: Typography.fontFamily.bold, fontSize: 16 },
});

export default OnboardingScreen;
