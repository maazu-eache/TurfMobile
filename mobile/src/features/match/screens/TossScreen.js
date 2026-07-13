import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Dimensions,
  ScrollView,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../../theme/theme';
import api, { getImageUrl } from '../../../api/axios';
import { showCustomAlert } from '../../../components/CustomAlert';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const TossScreen = ({ route, navigation }) => {
  const { matchId } = route.params;
  
  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [tossWinnerId, setTossWinnerId] = useState(null);
  const [tossDecision, setTossDecision] = useState(null); // 'bat' or 'bowl'
  const [saving, setSaving] = useState(false);

  // Coin Animation
  const spinValue = useRef(new Animated.Value(0)).current;
  const [isFlipping, setIsFlipping] = useState(false);
  const [coinResult, setCoinResult] = useState('Heads'); // Heads or Tails
  const [hasFlipped, setHasFlipped] = useState(false);

  useEffect(() => {
    const getMatch = async () => {
      try {
        const res = await api.get(`/matches/${matchId}`);
        setMatch(res.data.data);
      } catch (err) {
        showCustomAlert('Error', 'Could not load match details');
      } finally {
        setLoading(false);
      }
    };
    getMatch();
  }, [matchId]);

  const handleFlipCoin = () => {
    if (isFlipping) return;
    setIsFlipping(true);
    setHasFlipped(true);
    spinValue.setValue(0);

    Animated.timing(spinValue, {
      toValue: 1,
      duration: 1800,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start(() => {
      setIsFlipping(false);
      const result = Math.random() > 0.5 ? 'Heads' : 'Tails';
      setCoinResult(result);
    });
  };

  const handleSaveToss = async () => {
    if (!tossWinnerId || !tossDecision) {
      return showCustomAlert('Error', 'Please select both toss winner and their decision.');
    }
    
    setSaving(true);
    try {
      await api.put(`/matches/${matchId}/toss`, {
        winner: tossWinnerId,
        choice: tossDecision,
      });
      // Start the first innings immediately so live scoring can begin
      await api.post(`/matches/${matchId}/start-innings`, { inningsNumber: 1 });
      
      navigation.replace('MatchPlayerSelection', { matchId });
    } catch (err) {
      showCustomAlert('Error', err.response?.data?.message || 'Failed to save toss details');
    } finally {
      setSaving(false);
    }
  };

  // Interpolate for 3D spin effect
  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '1440deg'], // 4 full spins
  });

  // Interpolate for height bounce
  const coinY = spinValue.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, -120, 0],
  });

  if (loading || !match) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="chevron-left" size={28} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Match Toss</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Virtual Coin Section */}
        <View style={styles.coinSection}>
          <Animated.View
            style={[
              styles.coinContainer,
              {
                transform: [
                  { translateY: coinY },
                  { rotateY: spin },
                ],
              },
            ]}
          >
            <LinearGradient colors={['#FFD700', '#FFA500', '#B8860B']} style={styles.coin}>
              <View style={styles.coinInner}>
                <Text style={styles.coinText}>{coinResult[0]}</Text>
              </View>
            </LinearGradient>
          </Animated.View>

          <TouchableOpacity style={styles.flipBtn} onPress={handleFlipCoin} disabled={isFlipping}>
            <LinearGradient
              colors={isFlipping ? ['#4A5568', '#2D3748'] : Colors.primaryGradient || [Colors.primary, Colors.primaryLight]}
              style={styles.flipBtnGradient}
            >
              <Icon name="autorenew" size={18} color={isFlipping ? '#A0AAB5' : Colors.background} style={{ marginRight: 6 }} />
              <Text style={[styles.flipBtnText, { color: isFlipping ? '#A0AAB5' : Colors.background }]}>
                {isFlipping ? 'Spinning...' : 'Tap to Spin Coin'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          {hasFlipped && !isFlipping && (
            <View style={styles.resultBanner}>
              <Text style={styles.resultBannerText}>Lands on: <Text style={styles.greenText}>{coinResult}</Text></Text>
            </View>
          )}
        </View>

        {/* Record Toss Card */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Who won the toss?</Text>
          <View style={styles.optionsRow}>
            <TouchableOpacity
              style={[styles.optionCard, tossWinnerId === match.teamA?._id && styles.optionCardSelected]}
              onPress={() => setTossWinnerId(match.teamA?._id)}
            >
              {match.teamA?.logo ? (
                <Image source={{ uri: getImageUrl(match.teamA.logo) }} style={styles.teamLogoSmall} />
              ) : (
                <View style={styles.logoPlaceholder}>
                  <Text style={styles.logoPlaceholderText}>
                    {match.teamA?.name?.substring(0, 1).toUpperCase()}
                  </Text>
                </View>
              )}
              <Text
                style={[styles.optionText, tossWinnerId === match.teamA?._id && styles.optionTextSelected]}
                numberOfLines={1}
              >
                {match.teamA?.name || 'Team A'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.optionCard, tossWinnerId === match.teamB?._id && styles.optionCardSelected]}
              onPress={() => setTossWinnerId(match.teamB?._id)}
            >
              {match.teamB?.logo ? (
                <Image source={{ uri: getImageUrl(match.teamB.logo) }} style={styles.teamLogoSmall} />
              ) : (
                <View style={styles.logoPlaceholder}>
                  <Text style={styles.logoPlaceholderText}>
                    {match.teamB?.name?.substring(0, 1).toUpperCase()}
                  </Text>
                </View>
              )}
              <Text
                style={[styles.optionText, tossWinnerId === match.teamB?._id && styles.optionTextSelected]}
                numberOfLines={1}
              >
                {match.teamB?.name || 'Team B'}
              </Text>
            </TouchableOpacity>
          </View>

          {tossWinnerId && (
            <Animated.View style={styles.decisionContainer}>
              <Text style={[styles.sectionTitle, { marginTop: Spacing.lg }]}>Winner decided to</Text>
              <View style={styles.optionsRow}>
                <TouchableOpacity
                  style={[styles.decisionCard, tossDecision === 'bat' && styles.decisionCardSelected]}
                  onPress={() => setTossDecision('bat')}
                >
                  <Icon
                    name="cricket-bat"
                    size={28}
                    color={tossDecision === 'bat' ? Colors.primary : Colors.textSecondary}
                    style={{ marginBottom: 6 }}
                  />
                  <Text style={[styles.decisionText, tossDecision === 'bat' && styles.decisionTextSelected]}>
                    Bat First
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.decisionCard, tossDecision === 'bowl' && styles.decisionCardSelected]}
                  onPress={() => setTossDecision('bowl')}
                >
                  <Icon
                    name="baseball"
                    size={28}
                    color={tossDecision === 'bowl' ? Colors.primary : Colors.textSecondary}
                    style={{ marginBottom: 6 }}
                  />
                  <Text style={[styles.decisionText, tossDecision === 'bowl' && styles.decisionTextSelected]}>
                    Bowl First
                  </Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          )}
        </View>
      </ScrollView>

      {/* Sticky Let's Play Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.startBtn, (!tossWinnerId || !tossDecision) && styles.startBtnDisabled]}
          onPress={handleSaveToss}
          disabled={saving || !tossWinnerId || !tossDecision}
        >
          <LinearGradient
            colors={(!tossWinnerId || !tossDecision) ? ['#3E4D59', '#3E4D59'] : Colors.primaryGradient || [Colors.primary, Colors.primaryLight]}
            style={styles.startBtnGradient}
          >
            {saving ? (
              <ActivityIndicator color={Colors.background} size="small" />
            ) : (
              <>
                <Text style={[styles.startBtnText, (!tossWinnerId || !tossDecision) && { color: '#A0AAB5' }]}>Let's Play</Text>
                <Icon name="chevron-right" size={22} color={(!tossWinnerId || !tossDecision) ? '#A0AAB5' : Colors.background} style={{ marginLeft: 4 }} />
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  backBtn: { padding: 4 },
  headerTitle: {
    fontSize: 18,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.textPrimary,
  },

  content: {
    padding: Spacing.base,
    paddingBottom: 40,
  },

  // COIN SECTION
  coinSection: {
    alignItems: 'center',
    marginVertical: Spacing.xl,
  },
  coinContainer: {
    width: 100,
    height: 100,
    perspective: 1000,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
  },
  coin: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: '#D4AF37', // Gold border
    alignItems: 'center',
    justifyContent: 'center',
  },
  coinInner: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#DAA520',
    borderWidth: 2,
    borderColor: '#B8860B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coinText: {
    fontSize: 36,
    fontFamily: Typography.fontFamily.bold,
    color: '#FFF',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  flipBtn: {
    marginTop: 20,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    ...Shadows.small,
  },
  flipBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  flipBtnText: {
    fontSize: 14,
    fontFamily: Typography.fontFamily.semiBold,
  },
  resultBanner: {
    marginTop: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  resultBannerText: {
    fontSize: 14,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.textSecondary,
  },
  greenText: {
    color: Colors.primary,
    fontFamily: Typography.fontFamily.bold,
  },

  // DECISION / SETUP CARDS
  card: {
    backgroundColor: Colors.backgroundCard || '#000A15',
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.small,
  },
  sectionTitle: {
    fontSize: 15,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.textPrimary,
    marginBottom: Spacing.base,
    textAlign: 'center',
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  optionCard: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.backgroundElevated || '#0A1F35',
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionCardSelected: {
    backgroundColor: 'rgba(154, 188, 47, 0.12)',
    borderColor: Colors.primary,
  },
  teamLogoSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginBottom: 8,
  },
  logoPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  logoPlaceholderText: {
    color: Colors.primary,
    fontFamily: Typography.fontFamily.bold,
    fontSize: 14,
  },
  optionText: {
    fontSize: 14,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.textSecondary,
    textAlign: 'center',
    width: '90%',
  },
  optionTextSelected: {
    color: Colors.primary,
    fontFamily: Typography.fontFamily.bold,
  },

  decisionContainer: {
    marginTop: Spacing.sm,
  },
  decisionCard: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.backgroundElevated || '#0A1F35',
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  decisionCardSelected: {
    backgroundColor: 'rgba(154, 188, 47, 0.12)',
    borderColor: Colors.primary,
  },
  decisionText: {
    fontSize: 14,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.textSecondary,
  },
  decisionTextSelected: {
    color: Colors.primary,
    fontFamily: Typography.fontFamily.bold,
  },

  // FOOTER / BUTTON
  footer: {
    marginTop: 'auto',
    paddingTop: Spacing.base,
    paddingHorizontal: Spacing.base,
  },
  startBtn: {
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    ...Shadows.medium,
  },
  startBtnDisabled: {
    elevation: 0,
  },
  startBtnGradient: {
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  startBtnText: {
    color: Colors.background || '#011528',
    fontSize: 16,
    fontFamily: Typography.fontFamily.bold,
  },
});

export default TossScreen;
