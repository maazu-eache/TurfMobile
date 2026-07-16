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

const IMG_BAT   = require('../../../../batting.jpeg');
const IMG_BOWL  = require('../../../../bowling.jpeg');

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
            {/* Outer shadow ring */}
            <LinearGradient
              colors={['#FFE066', '#FFB800', '#A06800']}
              style={styles.coinShadowRing}
            />
            {/* Main coin body */}
            <LinearGradient
              colors={['#FFE34F', '#FFC200', '#E69500', '#B87100']}
              style={styles.coin}
            >
              {/* Shine overlay */}
              <LinearGradient
                colors={['rgba(255,255,255,0.55)', 'rgba(255,255,255,0)']}
                start={{ x: 0.1, y: 0 }}
                end={{ x: 0.9, y: 0.6 }}
                style={styles.coinShine}
              />
              {/* Inner embossed ring */}
              <View style={styles.coinRing}>
                <View style={styles.coinCenter}>
                  <Text style={styles.coinText}>{coinResult[0]}</Text>
                  <Text style={styles.coinSubText}>{coinResult === 'Heads' ? '★' : '✦'}</Text>
                </View>
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
                <Image source={{ uri: getImageUrl(match.teamA.logo) }} style={styles.teamLogoFull} resizeMode="cover" />
              ) : (
                <View style={styles.logoPlaceholder}>
                  <Text style={styles.logoPlaceholderText}>
                    {match.teamA?.name?.substring(0, 1).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.teamLabelBar}>
                <Text
                  style={[styles.optionText, tossWinnerId === match.teamA?._id && styles.optionTextSelected]}
                  numberOfLines={1}
                >
                  {match.teamA?.name || 'Team A'}
                </Text>
              </View>
              {tossWinnerId === match.teamA?._id && (
                <View style={styles.selectedCheck}>
                  <Icon name="check-circle" size={18} color={Colors.primary} />
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.optionCard, tossWinnerId === match.teamB?._id && styles.optionCardSelected]}
              onPress={() => setTossWinnerId(match.teamB?._id)}
            >
              {match.teamB?.logo ? (
                <Image source={{ uri: getImageUrl(match.teamB.logo) }} style={styles.teamLogoFull} resizeMode="cover" />
              ) : (
                <View style={styles.logoPlaceholder}>
                  <Text style={styles.logoPlaceholderText}>
                    {match.teamB?.name?.substring(0, 1).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.teamLabelBar}>
                <Text
                  style={[styles.optionText, tossWinnerId === match.teamB?._id && styles.optionTextSelected]}
                  numberOfLines={1}
                >
                  {match.teamB?.name || 'Team B'}
                </Text>
              </View>
              {tossWinnerId === match.teamB?._id && (
                <View style={styles.selectedCheck}>
                  <Icon name="check-circle" size={18} color={Colors.primary} />
                </View>
              )}
            </TouchableOpacity>
          </View>

          {tossWinnerId && (
            <Animated.View style={styles.decisionContainer}>
              <Text style={[styles.sectionTitle, { marginTop: Spacing.lg }]}>Winner decided to</Text>
              <View style={styles.optionsRow}>
                <TouchableOpacity
                  style={[styles.decisionCard, tossDecision === 'bat' && styles.decisionCardSelected]}
                  onPress={() => setTossDecision('bat')}
                  activeOpacity={0.85}
                >
                  <Image source={IMG_BAT} style={styles.decisionImage} resizeMode="cover" />
                  <View style={styles.decisionLabelBar}>
                    <Text style={[styles.decisionText, tossDecision === 'bat' && styles.decisionTextSelected]}>
                      Bat First
                    </Text>
                  </View>
                  {tossDecision === 'bat' && (
                    <View style={styles.decisionCheckBadge}>
                      <Icon name="check-circle" size={20} color={Colors.primary} />
                    </View>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.decisionCard, tossDecision === 'bowl' && styles.decisionCardSelected]}
                  onPress={() => setTossDecision('bowl')}
                  activeOpacity={0.85}
                >
                  <Image source={IMG_BOWL} style={styles.decisionImage} resizeMode="cover" />
                  <View style={styles.decisionLabelBar}>
                    <Text style={[styles.decisionText, tossDecision === 'bowl' && styles.decisionTextSelected]}>
                      Bowl First
                    </Text>
                  </View>
                  {tossDecision === 'bowl' && (
                    <View style={styles.decisionCheckBadge}>
                      <Icon name="check-circle" size={20} color={Colors.primary} />
                    </View>
                  )}
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
  coinShadowRing: {
    position: 'absolute',
    width: 136,
    height: 136,
    borderRadius: 68,
    top: -8,
    left: -8,
    opacity: 0.35,
  },
  coinContainer: {
    width: 120,
    height: 120,
    elevation: 16,
    shadowColor: '#D4A017',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
  },
  coin: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: '#FFF3AA',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  coinShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 60,
  },
  coinRing: {
    width: 98,
    height: 98,
    borderRadius: 49,
    borderWidth: 3,
    borderColor: 'rgba(255,200,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coinCenter: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: 'rgba(160,100,0,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coinText: {
    fontSize: 38,
    fontFamily: Typography.fontFamily.bold,
    color: '#FFF',
    textShadowColor: 'rgba(120,60,0,0.7)',
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 4,
    lineHeight: 42,
  },
  coinSubText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.75)',
    marginTop: -4,
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
    height: 120,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.backgroundElevated || '#0A1F35',
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    position: 'relative',
  },
  optionCardSelected: {
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  teamLogoFull: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
  },
  teamLabelBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingVertical: 6,
    alignItems: 'center',
  },
  selectedCheck: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 12,
  },
  teamLogoSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginBottom: 8,
  },
  logoPlaceholder: {
    width: '100%',
    height: '70%',
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
  },
  logoPlaceholderText: {
    color: Colors.primary,
    fontFamily: Typography.fontFamily.bold,
    fontSize: 28,
  },
  optionText: {
    fontSize: 13,
    fontFamily: Typography.fontFamily.medium,
    color: '#fff',
    textAlign: 'center',
    width: '100%',
    paddingHorizontal: 4,
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
    height: 130,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    backgroundColor: Colors.backgroundElevated || '#0A1F35',
    borderWidth: 2,
    borderColor: Colors.border,
    position: 'relative',
  },
  decisionCardSelected: {
    borderColor: Colors.primary,
  },
  decisionImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
  },
  decisionLabelBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingVertical: 7,
    alignItems: 'center',
  },
  decisionCheckBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  decisionText: {
    fontSize: 14,
    fontFamily: Typography.fontFamily.semiBold,
    color: '#fff',
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
