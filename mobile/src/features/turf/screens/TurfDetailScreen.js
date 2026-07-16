import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Modal,
  TextInput,
  Alert,
  Animated,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useDispatch, useSelector } from 'react-redux';
import { fetchTurfById, clearSelectedTurf } from '../turfSlice';
import { toggleUserFavourite, setUserFavouriteStatus } from '../../auth/authSlice';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../../theme/theme';
import api from '../../../api/axios';
import { showCustomAlert } from '../../../components/CustomAlert';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const AMENITY_ICONS = {
  parking: { icon: 'parking', label: 'Parking' },
  washroom: { icon: 'shower', label: 'Washroom' },
  drinkingWater: { icon: 'water', label: 'Drinking Water' },
  floodLights: { icon: 'lightbulb-on', label: 'Flood Lights' },
  seating: { icon: 'seat', label: 'Seating' },
  foodAvailable: { icon: 'food', label: 'Food' },
  changingRoom: { icon: 'tshirt-crew', label: 'Changing Room' },
};

const PRICING_ROWS = [
  { key: 'weekdayDay', label: 'Weekday', sub: 'Day', icon: 'white-balance-sunny' },
  { key: 'weekdayNight', label: 'Weekday', sub: 'Night', icon: 'moon-waning-crescent' },
  { key: 'weekendDay', label: 'Weekend', sub: 'Day', icon: 'white-balance-sunny' },
  { key: 'weekendNight', label: 'Weekend', sub: 'Night', icon: 'moon-waning-crescent' },
];

const TurfDetailScreen = ({ route, navigation }) => {
  const { id } = route.params;
  const dispatch = useDispatch();
  const { user, isAuthenticated } = useSelector((state) => state.auth);
  const { selectedTurf, isLoading } = useSelector((state) => state.turf);
  const favourites = user?.favourites?.map(f => typeof f === 'string' ? f : f._id || f) || [];
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [reviews, setReviews] = useState([]);
  const [userReview, setUserReview] = useState(null);
  const [loadingReviews, setLoadingReviews] = useState(true);

  const [ratingModalVisible, setRatingModalVisible] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    dispatch(fetchTurfById(id));
    fetchReviews();
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    return () => dispatch(clearSelectedTurf());
  }, [id, dispatch]);

  const fetchReviews = async () => {
    try {
      setLoadingReviews(true);
      const res = await api.get(`/reviews/${id}`);
      const fetchedReviews = res.data.data.reviews || [];
      setReviews(fetchedReviews);
      if (user) {
        const existing = fetchedReviews.find(r => r.user?._id === user._id);
        if (existing) setUserReview(existing);
      }
    } catch (e) {
      console.log('Failed to fetch reviews', e);
    } finally {
      setLoadingReviews(false);
    }
  };

  const submitRating = async () => {
    setErrorMsg('');
    if (rating === 0) { setErrorMsg('Please select at least 1 star.'); return; }
    setSubmittingRating(true);
    try {
      if (userReview) {
        await api.put(`/reviews/${userReview._id}`, { rating, comment });
      } else {
        await api.post('/reviews', { turfId: id, rating, comment });
      }
      setRatingModalVisible(false);
      fetchReviews();
      dispatch(fetchTurfById(id));
    } catch (e) {
      setErrorMsg(e.response?.data?.message || 'Failed to submit rating.');
    } finally {
      setSubmittingRating(false);
    }
  };

  if (isLoading || !selectedTurf) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading turf details...</Text>
      </View>
    );
  }

  const isFav = favourites.includes(selectedTurf._id);
  const prices = selectedTurf.pricing ? [
    selectedTurf.pricing.weekdayDay,
    selectedTurf.pricing.weekdayNight,
    selectedTurf.pricing.weekendDay,
    selectedTurf.pricing.weekendNight,
  ].filter(p => p > 0) : [];
  const minPrice = prices.length ? Math.min(...prices) : 0;

  const getImageUrl = (path) => {
    if (!path) return 'https://via.placeholder.com/600x400';
    if (path.startsWith('http')) return path;
    const baseUrl = api.defaults.baseURL.replace('/api', '');
    return `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
  };

  const allImages = [selectedTurf.coverImage, ...(selectedTurf.gallery || [])].filter(Boolean);

  const handleScroll = (event) => {
    const slideSize = event.nativeEvent.layoutMeasurement.width;
    const index = Math.round(event.nativeEvent.contentOffset.x / slideSize);
    setCurrentImageIndex(index);
  };

  const trustScore = selectedTurf.owner?.trustScore;
  const getTrustColor = (score) => {
    if (score >= 80) return Colors.success;
    if (score >= 50) return Colors.warning;
    return Colors.error;
  };

  return (
    <View style={styles.container}>
      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        style={{ opacity: fadeAnim }}
      >
        {/* ── Image Gallery ── */}
        <View style={styles.coverContainer}>
          <KeyboardAwareScrollView enableOnAndroid={true} extraScrollHeight={20} keyboardShouldPersistTaps="handled"
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
          >
            {allImages.map((img, i) => (
              <Image
                key={i}
                source={{ uri: getImageUrl(img) }}
                style={{ width: SCREEN_WIDTH, height: 300 }}
                resizeMode="cover"
              />
            ))}
          </KeyboardAwareScrollView>

          {/* Gradient overlay */}
          <LinearGradient
            colors={['rgba(0,0,0,0.55)', 'transparent', 'rgba(1,21,40,0.98)']}
            style={styles.coverGradient}
          >

            {/* Pagination dots */}
            {allImages.length > 1 && (
              <View style={styles.paginationContainer}>
                {allImages.map((_, i) => (
                  <View
                    key={i}
                    style={[styles.dot, i === currentImageIndex && styles.dotActive]}
                  />
                ))}
                <View style={styles.paginationBadge}>
                  <Icon name="image-multiple" size={11} color="#FFF" />
                  <Text style={styles.paginationText}>{currentImageIndex + 1} / {allImages.length}</Text>
                </View>
              </View>
            )}
          </LinearGradient>
        </View>

        {/* ── Main Content ── */}
        <View style={styles.content}>

          {/* Title + rating */}
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={2}>{selectedTurf.name}</Text>
            <View style={styles.ratingBadge}>
              <Icon name="star" size={15} color="#000" />
              <Text style={styles.ratingText}>
                {selectedTurf.rating > 0 ? selectedTurf.rating.toFixed(1) : 'New'}
              </Text>
            </View>
          </View>

          {/* Location */}
          <View style={styles.locationRow}>
            <Icon name="map-marker-outline" size={15} color={Colors.primary} />
            <Text style={styles.locationText} numberOfLines={2}>
              {selectedTurf.address}, {selectedTurf.city}
            </Text>
          </View>

          {/* Owner trust badges */}
          {selectedTurf.owner && (
            <View style={styles.badgesRow}>
              {selectedTurf.owner.isVerifiedOwner && (
                <View style={styles.verifiedBadge}>
                  <Icon name="check-decagram" size={14} color={Colors.success} />
                  <Text style={styles.verifiedText}>Verified Owner</Text>
                </View>
              )}
              {trustScore !== undefined && (
                <View style={[styles.trustBadge, { borderColor: getTrustColor(trustScore) + '50', backgroundColor: getTrustColor(trustScore) + '15' }]}>
                  <Icon name="shield-star" size={14} color={getTrustColor(trustScore)} />
                  <Text style={[styles.trustText, { color: getTrustColor(trustScore) }]}>
                    Trust {trustScore}/100
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Quick info cards */}
          <View style={styles.infoCardsRow}>
            <View style={styles.infoCard}>
              <Icon name="ruler-square" size={20} color={Colors.primary} />
              <Text style={styles.infoCardLabel}>Size</Text>
              <Text style={styles.infoCardValue}>{selectedTurf.size || '—'}</Text>
            </View>
            <View style={styles.infoCard}>
              <Icon name="soccer-field" size={20} color={Colors.primary} />
              <Text style={styles.infoCardLabel}>Type</Text>
              <Text style={styles.infoCardValue}>{selectedTurf.type || '—'}</Text>
            </View>
            <View style={styles.infoCard}>
              <Icon name="clock-outline" size={20} color={Colors.primary} />
              <Text style={styles.infoCardLabel}>Hours</Text>
              <Text style={styles.infoCardValue} numberOfLines={1}>
                {selectedTurf.operatingHours?.openTime || '00:00'} – {selectedTurf.operatingHours?.closeTime || '23:59'}
              </Text>
            </View>
          </View>

          {/* About */}
          {selectedTurf.description ? (
            <>
              <View style={styles.sectionHeader}>
                <Icon name="information-outline" size={18} color={Colors.primary} />
                <Text style={styles.sectionTitle}>About</Text>
              </View>
              <Text style={styles.description}>{selectedTurf.description}</Text>
            </>
          ) : null}

          {/* Amenities */}
          <View style={styles.sectionHeader}>
            <Icon name="star-circle-outline" size={18} color={Colors.primary} />
            <Text style={styles.sectionTitle}>Amenities</Text>
          </View>
          <View style={styles.amenitiesGrid}>
            {Object.entries(selectedTurf.amenities || {}).map(([key, value]) => {
              if (!value) return null;
              const a = AMENITY_ICONS[key];
              if (!a) return null;
              return (
                <View key={key} style={styles.amenityBadge}>
                  <View style={styles.amenityIconBg}>
                    <Icon name={a.icon} size={16} color={Colors.primary} />
                  </View>
                  <Text style={styles.amenityText}>{a.label}</Text>
                </View>
              );
            })}
          </View>

          {/* Pricing */}
          <View style={styles.sectionHeader}>
            <Icon name="currency-inr" size={18} color={Colors.primary} />
            <Text style={styles.sectionTitle}>Pricing</Text>
          </View>
          <View style={styles.pricingGrid}>
            {PRICING_ROWS.map((row) => {
              const val = selectedTurf.pricing?.[row.key];
              if (!val) return null;
              return (
                <View key={row.key} style={styles.priceCard}>
                  <Icon name={row.icon} size={16} color={Colors.textSecondary} />
                  <Text style={styles.priceDayLabel}>{row.label}</Text>
                  <Text style={styles.priceSubLabel}>{row.sub}</Text>
                  <Text style={styles.priceValue}>₹{val}</Text>
                </View>
              );
            })}
          </View>

          {/* Reviews */}
          <View style={[styles.sectionHeader, { marginTop: Spacing.xl }]}>
            <Icon name="star-outline" size={18} color={Colors.primary} />
            <Text style={styles.sectionTitle}>Reviews</Text>
            <TouchableOpacity
              style={styles.writeReviewBtn}
              onPress={() => {
                if (!isAuthenticated) {
                  navigation.navigate('AuthModal', { screen: 'Login' });
                  return;
                }
                setRating(userReview ? userReview.rating : 0);
                setComment(userReview ? userReview.comment : '');
                setErrorMsg('');
                setRatingModalVisible(true);
              }}
            >
              <Icon name={userReview ? 'pencil' : 'plus'} size={14} color={Colors.primary} />
              <Text style={styles.writeReviewText}>{userReview ? 'Edit' : 'Write Review'}</Text>
            </TouchableOpacity>
          </View>

          {loadingReviews ? (
            <ActivityIndicator size="small" color={Colors.primary} style={{ marginTop: 20 }} />
          ) : reviews.length === 0 ? (
            <View style={styles.emptyReviews}>
              <View style={styles.emptyReviewsIconBg}>
                <Icon name="message-text-outline" size={28} color={Colors.primary} />
              </View>
              <Text style={styles.emptyReviewsTitle}>No reviews yet</Text>
              <Text style={styles.emptyReviewsText}>Be the first to share your experience!</Text>
            </View>
          ) : (
            <>
              {reviews.slice(0, 3).map((rev) => (
                <View key={rev._id} style={styles.reviewCard}>
                  <View style={styles.reviewHeader}>
                    <Image source={{ uri: getImageUrl(rev.user?.photo) }} style={styles.reviewAvatar} />
                    <View style={styles.reviewMeta}>
                      <Text style={styles.reviewerName}>{rev.user?.name || 'User'}</Text>
                      <View style={styles.starsRow}>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Icon
                            key={star}
                            name={star <= rev.rating ? 'star' : 'star-outline'}
                            size={13}
                            color={star <= rev.rating ? '#FFC107' : Colors.textTertiary}
                          />
                        ))}
                      </View>
                    </View>
                    <View style={styles.reviewRatingBadge}>
                      <Text style={styles.reviewRatingText}>{rev.rating}.0</Text>
                    </View>
                  </View>
                  {rev.comment ? (
                    <Text style={styles.reviewComment}>{rev.comment}</Text>
                  ) : null}
                </View>
              ))}
              {reviews.length > 3 && (
                <TouchableOpacity
                  style={styles.seeAllBtn}
                  onPress={() => Alert.alert('Coming Soon', 'Full review list coming soon!')}
                >
                  <Text style={styles.seeAllText}>See All {reviews.length} Reviews</Text>
                  <Icon name="chevron-right" size={16} color={Colors.primary} />
                </TouchableOpacity>
              )}
            </>
          )}

          <View style={{ height: Spacing['2xl'] }} />
        </View>
      </Animated.ScrollView>

      {/* ── Fixed top nav overlay (back + fav) ── */}
      <View style={styles.topBar} pointerEvents="box-none">
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
          <Icon name="arrow-left" size={22} color="#FFF" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={async () => {
            if (!isAuthenticated) {
              navigation.navigate('AuthModal', { screen: 'Login' });
            } else {
              dispatch(toggleUserFavourite(selectedTurf._id));
              try { 
                const res = await api.post(`/users/favourites/${selectedTurf._id}`); 
                const backendStatus = res.data?.data?.isFavourite;
                if (backendStatus !== undefined) {
                  dispatch(setUserFavouriteStatus({ id: selectedTurf._id, isFavourite: backendStatus }));
                }
                showCustomAlert('Success', res.data?.message || 'Updated favourites');
              } catch (e) {
                dispatch(toggleUserFavourite(selectedTurf._id));
                showCustomAlert('Error', 'Failed to update favourites');
              }
            }
          }}
          style={[styles.iconBtn, isFav && styles.iconBtnFav]}
        >
          <Icon name={isFav ? 'heart' : 'heart-outline'} size={22} color={isFav ? '#FF4757' : '#FFF'} />
        </TouchableOpacity>
      </View>

      {/* ── Rating Modal ── */}
      <Modal visible={ratingModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.sheetHandle} />

            <View style={styles.modalHeader}>
              <View style={styles.modalTitleBlock}>
                <Text style={styles.modalTitle}>
                  {userReview ? 'Edit Your Review' : 'Rate Your Experience'}
                </Text>
                <Text style={styles.modalSubtitle}>{selectedTurf.name}</Text>
              </View>
              <TouchableOpacity onPress={() => setRatingModalVisible(false)} style={styles.modalCloseBtn}>
                <Icon name="close" size={20} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {/* Stars */}
            <View style={styles.starsContainer}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity key={star} onPress={() => setRating(star)} activeOpacity={0.7}>
                  <Icon
                    name={star <= rating ? 'star' : 'star-outline'}
                    size={46}
                    color={star <= rating ? '#FFC107' : Colors.textTertiary}
                  />
                </TouchableOpacity>
              ))}
            </View>
            {rating > 0 && (
              <Text style={styles.ratingLabel}>
                {['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent!'][rating]}
              </Text>
            )}

            <TextInput
              style={styles.commentInput}
              placeholder="Share your experience (optional)..."
              placeholderTextColor={Colors.textTertiary}
              multiline
              numberOfLines={4}
              value={comment}
              onChangeText={setComment}
            />

            {errorMsg ? (
              <View style={styles.errorRow}>
                <Icon name="alert-circle-outline" size={14} color={Colors.error} />
                <Text style={styles.errorMsg}>{errorMsg}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[styles.submitBtn, rating === 0 && { opacity: 0.4 }]}
              onPress={submitRating}
              disabled={rating === 0 || submittingRating}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={Colors.primaryGradient}
                style={styles.submitBtnGrad}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                {submittingRating ? (
                  <ActivityIndicator color="#000" size="small" />
                ) : (
                  <>
                    <Icon name="send" size={16} color="#000" />
                    <Text style={styles.submitBtnText}>{userReview ? 'Update Review' : 'Submit Review'}</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Bottom booking bar ── */}
      <View style={styles.bottomBar}>
        <View style={styles.priceBlock}>
          <Text style={styles.priceLabel}>Starting from</Text>
          <View style={styles.priceRow}>
            <Text style={styles.price}>₹{minPrice}</Text>
            <Text style={styles.priceUnit}>/hr</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.bookBtn}
          onPress={() => {
            if (!isAuthenticated) {
              navigation.navigate('AuthModal', { screen: 'Login' });
            } else {
              navigation.navigate('SlotPicker', { turf: selectedTurf });
            }
          }}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={Colors.primaryGradient}
            style={styles.bookBtnGrad}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Icon name="calendar-check" size={18} color="#000" />
            <Text style={styles.bookBtnText}>Book Slots</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { color: Colors.textSecondary, fontFamily: Typography.fontFamily.medium, fontSize: Typography.fontSize.sm },
  scroll: { paddingBottom: 90 },

  /* ── Image section ── */
  coverContainer: { height: 300, width: '100%' },
  coverGradient: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'space-between' },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingTop: 56,
    zIndex: 10,
  },
  iconBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center',
  },
  iconBtnFav: { backgroundColor: 'rgba(255,71,87,0.25)' },
  paginationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingBottom: 14,
  },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.4)' },
  dotActive: { width: 18, backgroundColor: Colors.primary },
  paginationBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: BorderRadius.full,
    position: 'absolute', right: 14, bottom: 14,
  },
  paginationText: { color: '#FFF', fontFamily: Typography.fontFamily.bold, fontSize: 11 },

  /* ── Content ── */
  content: { padding: Spacing.xl, marginTop: -20 },

  titleRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: Spacing.sm, gap: 8,
  },
  title: {
    fontSize: Typography.fontSize['2xl'],
    fontFamily: Typography.fontFamily.extraBold,
    color: Colors.textPrimary,
    flex: 1,
    lineHeight: 32,
  },
  ratingBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: BorderRadius.full, gap: 4,
    ...Shadows.glow,
  },
  ratingText: { color: '#000', fontFamily: Typography.fontFamily.bold, fontSize: 13 },

  locationRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 5, marginBottom: Spacing.base },
  locationText: { color: Colors.textSecondary, fontFamily: Typography.fontFamily.medium, fontSize: Typography.fontSize.sm, flex: 1 },

  badgesRow: { flexDirection: 'row', gap: 8, marginBottom: Spacing.xl, flexWrap: 'wrap' },
  verifiedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.successLight,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: BorderRadius.full,
    borderWidth: 1, borderColor: Colors.success + '40',
  },
  verifiedText: { color: Colors.success, fontSize: 12, fontFamily: Typography.fontFamily.bold },
  trustBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: BorderRadius.full, borderWidth: 1,
  },
  trustText: { fontSize: 12, fontFamily: Typography.fontFamily.bold },

  /* ── Info cards ── */
  infoCardsRow: { flexDirection: 'row', gap: 10, marginBottom: Spacing.xl },
  infoCard: {
    flex: 1, alignItems: 'center',
    backgroundColor: Colors.backgroundElevated,
    borderRadius: BorderRadius.lg,
    paddingVertical: 14, paddingHorizontal: 8,
    borderWidth: 1, borderColor: Colors.border, gap: 4,
  },
  infoCardLabel: { color: Colors.textTertiary, fontSize: 10, fontFamily: Typography.fontFamily.medium },
  infoCardValue: { color: Colors.textPrimary, fontSize: 12, fontFamily: Typography.fontFamily.bold, textAlign: 'center' },

  /* ── Sections ── */
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginBottom: Spacing.base, marginTop: Spacing.xl,
  },
  sectionTitle: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.textPrimary,
    flex: 1,
  },
  description: {
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    lineHeight: 22,
  },

  /* ── Amenities ── */
  amenitiesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  amenityBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.backgroundElevated,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    paddingVertical: 9, paddingHorizontal: 12,
  },
  amenityIconBg: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: Colors.primaryAlpha10,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.primaryAlpha20,
  },
  amenityText: { color: Colors.textPrimary, fontSize: 12, fontFamily: Typography.fontFamily.semiBold },

  /* ── Pricing ── */
  pricingGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  priceCard: {
    width: (SCREEN_WIDTH - Spacing.xl * 2 - 10) / 2,
    backgroundColor: Colors.backgroundElevated,
    borderRadius: BorderRadius.lg,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.base, gap: 2,
  },
  priceDayLabel: { color: Colors.textPrimary, fontFamily: Typography.fontFamily.bold, fontSize: 13, marginTop: 4 },
  priceSubLabel: { color: Colors.textTertiary, fontFamily: Typography.fontFamily.medium, fontSize: 11 },
  priceValue: { color: Colors.primary, fontFamily: Typography.fontFamily.extraBold, fontSize: Typography.fontSize.xl, marginTop: 4 },

  /* ── Write review ── */
  writeReviewBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.primaryAlpha10,
    borderWidth: 1, borderColor: Colors.primaryAlpha30,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: BorderRadius.full,
  },
  writeReviewText: { color: Colors.primary, fontFamily: Typography.fontFamily.bold, fontSize: 12 },

  /* ── Reviews ── */
  emptyReviews: { alignItems: 'center', paddingVertical: Spacing.xl, gap: 8 },
  emptyReviewsIconBg: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: Colors.primaryAlpha10,
    borderWidth: 1, borderColor: Colors.primaryAlpha20,
    alignItems: 'center', justifyContent: 'center',
  },
  emptyReviewsTitle: { color: Colors.textPrimary, fontFamily: Typography.fontFamily.bold, fontSize: Typography.fontSize.base },
  emptyReviewsText: { color: Colors.textTertiary, fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.sm },
  reviewCard: {
    backgroundColor: Colors.backgroundElevated,
    borderRadius: BorderRadius.lg,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.base, marginBottom: Spacing.sm,
    ...Shadows.sm,
  },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  reviewAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.border },
  reviewMeta: { flex: 1 },
  reviewerName: { color: Colors.textPrimary, fontFamily: Typography.fontFamily.bold, fontSize: 13 },
  starsRow: { flexDirection: 'row', gap: 2, marginTop: 3 },
  reviewRatingBadge: {
    backgroundColor: Colors.primaryAlpha10,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: 6, paddingVertical: 3,
    borderWidth: 1, borderColor: Colors.primaryAlpha20,
  },
  reviewRatingText: { color: Colors.primary, fontFamily: Typography.fontFamily.bold, fontSize: 12 },
  reviewComment: {
    color: Colors.textSecondary, fontFamily: Typography.fontFamily.regular,
    fontSize: 13, marginTop: Spacing.sm, lineHeight: 19,
  },
  seeAllBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, paddingVertical: Spacing.base,
  },
  seeAllText: { color: Colors.primary, fontFamily: Typography.fontFamily.bold, fontSize: 14 },

  /* ── Rating modal ── */
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: Colors.backgroundElevated,
    borderTopLeftRadius: BorderRadius['2xl'],
    borderTopRightRadius: BorderRadius['2xl'],
    padding: Spacing.xl,
    paddingBottom: 40,
    borderTopWidth: 1, borderColor: Colors.border,
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: Spacing.base },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.xl },
  modalTitleBlock: { flex: 1 },
  modalTitle: { fontSize: Typography.fontSize.xl, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary },
  modalSubtitle: { fontSize: Typography.fontSize.sm, fontFamily: Typography.fontFamily.regular, color: Colors.textSecondary, marginTop: 2 },
  modalCloseBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.surfaceVariant, alignItems: 'center', justifyContent: 'center' },
  starsContainer: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 8 },
  ratingLabel: { textAlign: 'center', color: Colors.primary, fontFamily: Typography.fontFamily.bold, fontSize: Typography.fontSize.md, marginBottom: Spacing.xl },
  commentInput: {
    backgroundColor: Colors.background,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.regular,
    height: 100, textAlignVertical: 'top',
    marginBottom: Spacing.base,
  },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.base },
  errorMsg: { color: Colors.error, fontFamily: Typography.fontFamily.medium, fontSize: 13 },
  submitBtn: { borderRadius: BorderRadius.lg, overflow: 'hidden' },
  submitBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 },
  submitBtnText: { color: '#000', fontFamily: Typography.fontFamily.bold, fontSize: 15 },

  /* ── Bottom bar ── */
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.backgroundElevated,
    borderTopWidth: 1, borderTopColor: Colors.border,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.base, paddingBottom: 28,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    ...Shadows.md,
  },
  priceBlock: { gap: 2 },
  priceLabel: { color: Colors.textSecondary, fontSize: 11, fontFamily: Typography.fontFamily.medium },
  priceRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  price: { color: Colors.textPrimary, fontSize: 26, fontFamily: Typography.fontFamily.extraBold, lineHeight: 30 },
  priceUnit: { color: Colors.textSecondary, fontSize: 12, fontFamily: Typography.fontFamily.medium, marginBottom: 2 },
  bookBtn: { borderRadius: BorderRadius.lg, overflow: 'hidden', ...Shadows.glow },
  bookBtnGrad: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 13, paddingHorizontal: 22 },
  bookBtnText: { color: '#000', fontFamily: Typography.fontFamily.bold, fontSize: 15 },
});

export default TurfDetailScreen;
