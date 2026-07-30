import React, { memo, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Animated,
  TouchableWithoutFeedback,
  Dimensions,
  Platform,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH * 0.85;

/**
 * PlayerProfileCard - Premium 2026 SportVerse Mobile UI Component
 * Designed with floating player avatar, yellow SportVerse theme,
 * dynamic badges, equal stats columns, and smooth press scale animations.
 */
const PlayerProfileCard = ({
  image,
  playerName,
  role,
  team,
  country,
  isCaptain = false,
  matches = 0,
  runs = 0,
  backgroundColor = '#FFCC00',
  onPress,
}) => {
  // Scale animation value for press interaction
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
      speed: 20,
      bounciness: 4,
    }).start();
  }, [scaleAnim]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 4,
    }).start();
  }, [scaleAnim]);

  const handlePress = useCallback(() => {
    if (onPress) {
      onPress();
    }
  }, [onPress]);

  // Format numbers with commas (e.g. 12,450)
  const formattedRuns = useMemo(() => {
    return (runs || 0).toLocaleString();
  }, [runs]);

  const formattedMatches = useMemo(() => {
    return (matches || 0).toLocaleString();
  }, [matches]);

  // Subtitle text: Team
  const subtitleText = useMemo(() => {
    return team || '';
  }, [team]);

  // Dynamic badge list filter
  const badges = useMemo(() => {
    const list = [];
    if (role) {
      list.push({
        id: 'role',
        label: role,
        iconName: 'cricket',
        isMci: true,
      });
    }
    if (isCaptain) {
      list.push({
        id: 'captain',
        label: 'Captain',
        iconName: 'star',
        isMci: false,
      });
    }
    if (country) {
      list.push({
        id: 'country',
        label: country,
        iconName: 'globe-outline',
        isMci: false,
      });
    }
    return list;
  }, [role, isCaptain, country]);

  return (
    <View style={styles.outerContainer}>
      <TouchableWithoutFeedback
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
      >
        <Animated.View
          style={[
            styles.cardContainer,
            { backgroundColor },
            { transform: [{ scale: scaleAnim }] },
          ]}
        >
          {/* Floating Image Wrapper */}
          <View style={[
            styles.imageFloatingWrapper,
            typeof image !== 'string' && { backgroundColor: '#000000' }
          ]}>
            <Image
              source={typeof image === 'string' ? { uri: image } : image}
              style={styles.playerImage}
              resizeMode="cover"
            />
          </View>

          {/* Right Side Content */}
          <View style={styles.rightContentSection}>
            <Text style={styles.playerName} numberOfLines={1}>
              {playerName}
            </Text>
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitleText}
            </Text>

            <View style={styles.statsRow}>
              <View style={styles.badgeRow}>
                {badges.slice(0, 1).map((b) => (
                  <View key={b.id} style={styles.badgePill}>
                    {b.isMci ? (
                      <Icon
                        name={b.iconName}
                        size={10}
                        color="#1A1A1A"
                        style={styles.badgeIcon}
                      />
                    ) : (
                      <Ionicons
                        name={b.iconName}
                        size={10}
                        color={b.id === 'captain' ? '#E6A100' : '#1A1A1A'}
                        style={styles.badgeIcon}
                      />
                    )}
                    <Text style={styles.badgeText} numberOfLines={1}>
                      {b.label}
                    </Text>
                  </View>
                ))}
              </View>

              <View style={styles.miniStatsDivider} />

              <View style={styles.miniStatsContainer}>
                <Text style={styles.miniStatText}>
                  <Text style={styles.miniStatLabel}>M:</Text> {formattedMatches}
                </Text>
                <Text style={styles.miniStatText}>
                  <Text style={styles.miniStatLabel}>R:</Text> {formattedRuns}
                </Text>
              </View>
            </View>
          </View>
        </Animated.View>
      </TouchableWithoutFeedback>
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    paddingLeft: 12,
    paddingRight: 6,
    paddingVertical: 8,
  },
  cardContainer: {
    width: 260,
    borderRadius: 16,
    paddingLeft: 10,
    paddingRight: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    // Soft Premium Drop Shadow
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  imageFloatingWrapper: {
    width: 60,
    height: 60,
    borderRadius: 14,
    marginRight: 12,
    backgroundColor: '#FFFFFF',
    // Elevation shadow for floating image
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 6,
  },
  playerImage: {
    width: 60,
    height: 60,
    borderRadius: 14,
  },
  rightContentSection: {
    flex: 1,
    justifyContent: 'center',
  },
  playerName: {
    fontSize: 15,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
    fontWeight: '800',
    color: '#1A1A1A',
    marginBottom: 2,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#555555',
    marginBottom: 6,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  badgeIcon: {
    marginRight: 3,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  miniStatsDivider: {
    width: 1,
    height: 14,
    backgroundColor: 'rgba(0,0,0,0.15)',
    marginHorizontal: 8,
  },
  miniStatsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  miniStatText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  miniStatLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#555555',
  },
});

export default memo(PlayerProfileCard);
