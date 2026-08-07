import React, { useEffect, useState, useRef } from 'react';
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
  Animated,
  StatusBar,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from '../../../components/SolidGradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useDispatch, useSelector } from 'react-redux';
import { fetchTurfById, clearSelectedTurf } from '../turfSlice';
import { toggleUserFavourite, setUserFavouriteStatus } from '../../auth/authSlice';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../../theme/theme';
import api, { getImageUrl } from '../../../api/axios';
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
  { key: 'weekdayDay', label: 'Weekday Day', icon: 'white-balance-sunny' },
  { key: 'weekdayNight', label: 'Weekday Night', icon: 'moon-waning-crescent' },
  { key: 'weekendDay', label: 'Weekend Day', icon: 'white-balance-sunny' },
  { key: 'weekendNight', label: 'Weekend Night', icon: 'moon-waning-crescent' },
];

const getMinPrice = (pricing) => {
  if (!pricing) return 0;
  const prices = [
    pricing.weekdayDay,
    pricing.weekdayNight,
    pricing.weekendDay,
    pricing.weekendNight,
  ].filter(p => p > 0);
  return prices.length ? Math.min(...prices) : 0;
};

// Removed hardcoded CARD_HEIGHTS to use dynamic measurement for a flawless Apple Wallet stack

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
  const [similarTurfs, setSimilarTurfs] = useState([]);

  const [ratingModalVisible, setRatingModalVisible] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [cardLayouts, setCardLayouts] = useState({});
  const [selectedImage, setSelectedImage] = useState(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scrollY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    dispatch(fetchTurfById(id));
    fetchReviews();
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    return () => dispatch(clearSelectedTurf());
  }, [id, dispatch]);

  useEffect(() => {
    if (selectedTurf) {
      fetchSimilarTurfs();
    }
  }, [selectedTurf]);

  const fetchReviews = async () => {
    try {
      setLoadingReviews(true);
      const res = await api.get(`/reviews/${id}`);
      const fetchedReviews = res.data.data.reviews || [];
      setReviews(fetchedReviews);
      if (user) {
        const existing = fetchedReviews.find(r => r.user?._id === user?._id);
        if (existing) setUserReview(existing);
      }
    } catch (e) {
      console.log('Failed to fetch reviews', e);
    } finally {
      setLoadingReviews(false);
    }
  };

  const fetchSimilarTurfs = async () => {
    try {
      const res = await api.get('/turfs', { params: { city: selectedTurf.city, limit: 5 } });
      if (res.data.data) {
        setSimilarTurfs(res.data.data.filter(t => t._id !== selectedTurf._id));
      }
    } catch (e) {
      console.log('Failed to fetch similar turfs', e);
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

  const allImages = [selectedTurf.coverImage, ...(selectedTurf.gallery || [])].filter(Boolean);

  const handleScroll = (event) => {
    const slideSize = event.nativeEvent.layoutMeasurement.width;
    const index = Math.round(event.nativeEvent.contentOffset.x / slideSize);
    setCurrentImageIndex(index);
  };

  const trustScore = selectedTurf.owner?.trustScore || selectedTurf.ownerInfo?.trustScore;
  const isVerified = selectedTurf.isVerified || selectedTurf.owner?.isVerifiedOwner || selectedTurf.ownerInfo?.isVerifiedOwner;

  const getTrustColor = (score) => {
    if (score >= 80) return Colors.success;
    if (score >= 50) return Colors.warning;
    return Colors.error;
  };

  // Parallax calculations for Hero Carousel
  const imageTranslateY = scrollY.interpolate({
    inputRange: [0, 300],
    outputRange: [0, 100],
    extrapolate: 'clamp',
  });

  const imageScale = scrollY.interpolate({
    inputRange: [-100, 0],
    outputRange: [1.2, 1],
    extrapolateRight: 'clamp',
  });

  // Apple Wallet Dynamic Stack Engine
  const getCardAnimation = (index) => {
    // The Info Card (index 0) scrolls normally
    if (index === 0) return { zIndex: 10 };

    const layout = cardLayouts[index];
    if (!layout) return { zIndex: 20 + index }; // Native render before measurement

    // Stacking offset gap
    const TOP_INSET = 100;
    const STACK_GAP = 24;
    const targetY = TOP_INSET + (index - 1) * STACK_GAP;
    
    // threshold is when the top of the card reaches the target stack position
    const threshold = Math.max(0, layout.y - targetY);

    const translateY = scrollY.interpolate({
      inputRange: [-1, 0, threshold, threshold + 1],
      outputRange: [0, 0, 0, 1],
      extrapolateLeft: 'clamp',
    });

    const nextLayout = cardLayouts[index + 1];
    let scale = 1;
    let opacity = 1;

    if (nextLayout) {
      // When the NEXT card hits its threshold, we begin compressing THIS card
      const nextTargetY = TOP_INSET + index * STACK_GAP;
      const nextThreshold = Math.max(0, nextLayout.y - nextTargetY);

      scale = scrollY.interpolate({
        inputRange: [nextThreshold - 60, nextThreshold + 180],
        outputRange: [1, 0.92],
        extrapolate: 'clamp',
      });

      opacity = scrollY.interpolate({
        inputRange: [nextThreshold, nextThreshold + 250],
        outputRange: [1, 0.65],
        extrapolate: 'clamp',
      });
    }

    return {
      transform: [{ translateY }, { scale }],
      opacity,
      zIndex: 20 + index, // Next cards always slide OVER previous ones
    };
  };

  const renderQuickInfo = () => (
    <View style={styles.grid2x3}>
      <View style={styles.gridItem}>
        <Icon name="soccer" size={18} color="#FFCC00" style={styles.gridIcon} />
        <Text style={styles.gridLabel}>Sport</Text>
        <Text style={styles.gridValue}>{selectedTurf.sports?.[0] || 'Multi-sport'}</Text>
      </View>

      <View style={styles.gridItem}>
        <Icon name="account-group" size={18} color="#FFCC00" style={styles.gridIcon} />
        <Text style={styles.gridLabel}>Capacity</Text>
        <Text style={styles.gridValue}>{selectedTurf.size || '8v8'}</Text>
      </View>

      <View style={styles.gridItem}>
        <Icon name="soccer-field" size={18} color="#FFCC00" style={styles.gridIcon} />
        <Text style={styles.gridLabel}>Format</Text>
        <Text style={styles.gridValue}>{selectedTurf.type || 'Outdoor'}</Text>
      </View>

      <View style={styles.gridItem}>
        <Icon name="clock-outline" size={18} color="#FFCC00" style={styles.gridIcon} />
        <Text style={styles.gridLabel}>Operating Hours</Text>
        <Text style={styles.gridValue} numberOfLines={1}>
          {selectedTurf.operatingHours?.openTime || '00:00'} - {selectedTurf.operatingHours?.closeTime || '23:59'}
        </Text>
      </View>

      <View style={styles.gridItem}>
        <Icon name="ruler-square" size={18} color="#FFCC00" style={styles.gridIcon} />
        <Text style={styles.gridLabel}>Ground Size</Text>
        <Text style={styles.gridValue}>{selectedTurf.size || 'Standard'}</Text>
      </View>

      <View style={styles.gridItem}>
        <Icon name="lightbulb-on" size={18} color="#FFCC00" style={styles.gridIcon} />
        <Text style={styles.gridLabel}>Floodlights</Text>
        <Text style={styles.gridValue}>{selectedTurf.amenities?.floodLights ? 'Yes' : 'No'}</Text>
      </View>
    </View>
  );

  const renderAbout = () => (
    <View style={styles.aboutContainer}>
      <Text style={styles.aboutText}>
        {selectedTurf.description || 'Experience state-of-the-art turf facilities designed for professional training and recreational play. Book your preferred slot now.'}
      </Text>
    </View>
  );

  const renderPricing = () => (
    <View style={styles.pricingStack}>
      {PRICING_ROWS.map((row) => {
        const val = selectedTurf.pricing?.[row.key];
        if (!val) return null;
        return (
          <View key={row.key} style={styles.pricingCardRow}>
            <View style={styles.pricingLabelBlock}>
              <Icon name={row.icon} size={14} color="rgba(255,255,255,0.6)" style={{ marginRight: 6 }} />
              <Text style={styles.pricingDayLabel}>{row.label}</Text>
            </View>
            <View style={styles.pricingDivider} />
            <Text style={styles.pricingAmount}>₹{val}/hr</Text>
          </View>
        );
      })}
    </View>
  );

  const renderAmenities = () => (
    <View style={styles.amenitiesGrid}>
      {Object.entries(selectedTurf.amenities || {}).map(([key, value]) => {
        if (!value) return null;
        const a = AMENITY_ICONS[key];
        if (!a) return null;
        return (
          <View key={key} style={styles.amenityChip}>
            <Icon name={a.icon} size={14} color="#FFCC00" style={{ marginRight: 6 }} />
            <Text style={styles.amenityText}>{a.label}</Text>
          </View>
        );
      })}
    </View>
  );

  const renderGallery = () => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.galleryScroll}>
      {allImages.map((img, i) => (
        <TouchableOpacity key={i} activeOpacity={0.8} onPress={() => setSelectedImage(img)}>
          <Image source={{ uri: getImageUrl(img) }} style={styles.galleryImage} />
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const renderReviews = () => (
    <>
      <View style={styles.reviewsOverview}>
        <View style={styles.overviewScoreBlock}>
          <Text style={styles.overviewScore}>{selectedTurf.rating > 0 ? selectedTurf.rating.toFixed(1) : 'New'}</Text>
          <View style={styles.overviewStars}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Icon
                key={star}
                name={star <= Math.round(selectedTurf.rating || 0) ? 'star' : 'star-outline'}
                size={14}
                color="#FFCC00"
              />
            ))}
          </View>
          <Text style={styles.overviewCount}>{reviews.length} reviews</Text>
        </View>

        {reviews[0]?.comment ? (
          <>
            <View style={styles.overviewDivider} />
            <View style={styles.topReviewQuote}>
              <Icon name="format-quote-open" size={24} color="#FFCC00" style={{ opacity: 0.3 }} />
              <Text style={styles.quoteText} numberOfLines={3}>
                {reviews[0].comment}
              </Text>
              <Text style={styles.quoteAuthor}>- {reviews[0].user?.name || 'Anonymous player'}</Text>
            </View>
          </>
        ) : null}
      </View>

      <View style={styles.reviewList}>
        {reviews.slice(0, 2).map((rev) => (
          <View key={rev._id} style={styles.reviewCard}>
            <View style={styles.reviewCardHeader}>
              <Image source={{ uri: getImageUrl(rev.user?.photo) }} style={styles.reviewerAvatar} />
              <View style={styles.reviewerInfo}>
                <Text style={styles.reviewerName}>{rev.user?.name || 'User'}</Text>
                <View style={styles.starsRow}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Icon
                      key={star}
                      name={star <= rev.rating ? 'star' : 'star-outline'}
                      size={10}
                      color="#FFCC00"
                    />
                  ))}
                </View>
              </View>
              <Text style={styles.reviewDate}>Verified Player</Text>
            </View>
            {rev.comment ? (
              <Text style={styles.reviewText}>{rev.comment}</Text>
            ) : null}
          </View>
        ))}
      </View>
    </>
  );

  const renderSimilar = () => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.similarScroll}>
      {similarTurfs.map((item) => (
        <TouchableOpacity
          key={item._id}
          style={styles.similarCard}
          onPress={() => navigation.push('TurfDetail', { id: item._id })}
        >
          <Image source={{ uri: getImageUrl(item.coverImage) }} style={styles.similarCardImg} />
          <View style={styles.similarCardContent}>
            <Text style={styles.similarCardName} numberOfLines={1}>{item.name}</Text>
            <View style={styles.similarCardMetaRow}>
              <Icon name="star" size={10} color="#FFCC00" />
              <Text style={styles.similarCardMetaText}>{item.rating > 0 ? item.rating.toFixed(1) : 'New'}</Text>
              <Text style={styles.similarCardMetaDot}>•</Text>
              <Text style={styles.similarCardMetaText}>{item.city}</Text>
            </View>
            <Text style={styles.similarCardPrice}>₹{getMinPrice(item.pricing)}/hr</Text>
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const cards = [
    {
      key: 'quickInfo',
      renderHeader: () => (
        <View style={styles.cardHeader}>
          <Icon name="information-outline" size={16} color="#FFCC00" />
          <Text style={styles.cardHeaderTitle}>Quick Information</Text>
        </View>
      ),
      renderContent: () => renderQuickInfo(),
    },
    {
      key: 'about',
      renderHeader: () => (
        <View style={styles.cardHeader}>
          <Icon name="card-text-outline" size={16} color="#FFCC00" />
          <Text style={styles.cardHeaderTitle}>About</Text>
        </View>
      ),
      renderContent: () => renderAbout(),
    },
    {
      key: 'pricing',
      renderHeader: () => (
        <View style={styles.cardHeader}>
          <Icon name="currency-inr" size={16} color="#FFCC00" />
          <Text style={styles.cardHeaderTitle}>Pricing Slots</Text>
        </View>
      ),
      renderContent: () => renderPricing(),
    },
    {
      key: 'amenities',
      renderHeader: () => (
        <View style={styles.cardHeader}>
          <Icon name="star-circle-outline" size={16} color="#FFCC00" />
          <Text style={styles.cardHeaderTitle}>Amenities Offered</Text>
        </View>
      ),
      renderContent: () => renderAmenities(),
    },
    {
      key: 'gallery',
      show: allImages.length > 0,
      renderHeader: () => (
        <View style={styles.cardHeader}>
          <Icon name="image-multiple" size={16} color="#FFCC00" />
          <Text style={styles.cardHeaderTitle}>Gallery</Text>
        </View>
      ),
      renderContent: () => renderGallery(),
    },
    {
      key: 'reviews',
      renderHeader: () => (
        <View style={styles.reviewsHeadingRow}>
          <View style={styles.cardHeader}>
            <Icon name="message-draw" size={16} color="#FFCC00" />
            <Text style={styles.cardHeaderTitle}>Ratings & Reviews</Text>
          </View>
          <TouchableOpacity
            style={styles.writeReviewBtnGold}
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
            <Icon name={userReview ? 'pencil' : 'plus'} size={12} color="#000" />
            <Text style={styles.writeReviewTextGold}>{userReview ? 'Edit' : 'Rate'}</Text>
          </TouchableOpacity>
        </View>
      ),
      renderContent: () => renderReviews(),
    },
    {
      key: 'similar',
      show: similarTurfs.length > 0,
      renderHeader: () => (
        <View style={styles.cardHeader}>
          <Icon name="layers-outline" size={16} color="#FFCC00" />
          <Text style={styles.cardHeaderTitle}>Similar Grounds Near You</Text>
        </View>
      ),
      renderContent: () => renderSimilar(),
    },
  ].filter(c => c.show !== false);

  const mockDistance = '1.5 km';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        style={{ opacity: fadeAnim }}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
      >
        {/* ── 0: Image Gallery Carousel ── */}
        <Animated.View style={[styles.coverContainer, { transform: [{ translateY: imageTranslateY }, { scale: imageScale }] }]}>
          <ScrollView
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
                style={{ width: SCREEN_WIDTH, height: 340 }}
                resizeMode="cover"
              />
            ))}
          </ScrollView>

          {/* Bottom Gradient overlay */}
          <LinearGradient
            colors={['rgba(0,0,0,0.45)', 'transparent', 'rgba(0,0,0,0.98)']}
            style={styles.coverGradient}
          />

          {/* Floating Badge */}
          <View style={styles.heroFloatingBadge}>
            <Icon name="star" size={10} color="#000" />
            <Text style={styles.heroFloatingBadgeText}>TOP RATED</Text>
          </View>

          {/* Pagination dots */}
          {allImages.length > 1 && (
            <View style={styles.paginationContainer}>
              <View style={styles.paginationBadge}>
                <Icon name="image-multiple" size={11} color="#FFF" style={{ marginRight: 4 }} />
                <Text style={styles.paginationText}>{currentImageIndex + 1} / {allImages.length}</Text>
              </View>
            </View>
          )}
        </Animated.View>

        {/* ── 1: Floating Information Card (Overlaps Carousel by 40px) ── */}
        <Animated.View style={[styles.infoCardContainer, getCardAnimation(0)]}>
          <View style={styles.glassHeader}>
            <Text style={styles.glassTitle} numberOfLines={2}>{selectedTurf.name}</Text>
            <View style={styles.ratingBadgeGold}>
              <Icon name="star" size={12} color="#000" />
              <Text style={styles.ratingTextGold}>
                {selectedTurf.rating > 0 ? selectedTurf.rating.toFixed(1) : 'New'}
              </Text>
            </View>
          </View>

          <View style={styles.locationRow}>
            <Icon name="map-marker-outline" size={14} color="#FFCC00" />
            <Text style={styles.locationText} numberOfLines={2}>
              {selectedTurf.address}, {selectedTurf.city}
            </Text>
          </View>

          <View style={styles.badgesRow}>
            {isVerified && (
              <View style={styles.verifiedBadgeCompact}>
                <Icon name="check-decagram" size={12} color="#2ED573" />
                <Text style={styles.verifiedTextCompact}>Verified Owner</Text>
              </View>
            )}
            {trustScore !== undefined && (
              <View style={[styles.trustBadgeCompact, { borderColor: getTrustColor(trustScore) + '40' }]}>
                <Icon name="shield-star" size={12} color={getTrustColor(trustScore)} />
                <Text style={[styles.trustTextCompact, { color: getTrustColor(trustScore) }]}>
                  Trust {trustScore}/100
                </Text>
              </View>
            )}
            {selectedTurf.type && (
              <View style={styles.typeBadgeCompact}>
                <Icon name="soccer-field" size={12} color="#FFCC00" />
                <Text style={styles.typeTextCompact}>{selectedTurf.type}</Text>
              </View>
            )}
          </View>

          <View style={styles.glassBottom}>
            <View style={styles.priceContainer}>
              <Text style={styles.priceLabel}>Starting from</Text>
              <Text style={styles.priceValue}>₹{minPrice}<Text style={styles.priceUnit}>/hr</Text></Text>
            </View>
          </View>
        </Animated.View>

        {/* ── 2+: Dynamic Card Sections (Sticking Pile Animations) ── */}
        {cards.map((card, index) => {
          const stackIndex = index + 1; // Info Card is 0
          const animStyle = getCardAnimation(stackIndex);
          return (
            <Animated.View 
              key={card.key} 
              onLayout={(e) => {
                const { y, height } = e.nativeEvent.layout;
                setCardLayouts((prev) => {
                  // Only update if dimensions meaningfully changed to prevent jitter
                  if (!prev[stackIndex] || Math.abs(prev[stackIndex].y - y) > 5) {
                    return { ...prev, [stackIndex]: { y, height } };
                  }
                  return prev;
                });
              }}
              style={[styles.stackCard, animStyle]}
            >
              {card.renderHeader()}
              {card.renderContent()}
            </Animated.View>
          );
        })}

        <View style={{ height: 280 }} />
      </Animated.ScrollView>

      {/* ── Fixed Top bar (Floating Glass Header) ── */}
      <SafeAreaView style={styles.floatingTopBar} edges={['top']} pointerEvents="box-none">
        <View style={styles.topBarInner}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.floatingIconBtn}>
            <Icon name="arrow-left" size={20} color="#FFF" />
          </TouchableOpacity>
          
          <View style={styles.topBarRight}>
            <TouchableOpacity 
              onPress={async () => {
                try {
                  await Share.share({
                    message: `Check out ${selectedTurf?.name} on Scoreverse! \n\nhttps://scoreverse.in/turf/${selectedTurf?._id}`,
                  });
                } catch (error) {
                  console.error(error.message);
                }
              }}
              style={styles.floatingIconBtn}
            >
              <Icon name="share-variant" size={20} color="#FFF" />
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
                  } catch (e) {
                    dispatch(toggleUserFavourite(selectedTurf._id));
                  }
                }
              }}
              style={[styles.floatingIconBtn, isFav && styles.floatingIconBtnFav]}
            >
              <Icon name={isFav ? 'heart' : 'heart-outline'} size={20} color={isFav ? '#FF4757' : '#FFF'} />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      {/* ── Floating Sticky Bottom Booking Card ── */}
      <View style={styles.bottomStickyBar}>
        <View style={styles.bottomPriceBlock}>
          <Text style={styles.bottomPriceLabel}>Starting from</Text>
          <View style={styles.bottomPriceRow}>
            <Text style={styles.bottomPriceValue}>₹{minPrice}</Text>
            <Text style={styles.bottomPriceUnit}>/hr</Text>
          </View>
        </View>
        
        <TouchableOpacity
          style={styles.bookingPillBtn}
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
            colors={['#FFD400', '#FFB700']}
            style={styles.bookingPillBtnGrad}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Icon name="calendar-check" size={16} color="#000" style={{ marginRight: 6 }} />
            <Text style={styles.bookingBtnText}>Book Slots</Text>
          </LinearGradient>
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
                colors={['#FFD400', '#FFB700']}
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

      {/* ── Full Screen Image Modal ── */}
      <Modal visible={!!selectedImage} transparent animationType="fade" onRequestClose={() => setSelectedImage(null)}>
        <View style={styles.fullScreenImageContainer}>
          <TouchableOpacity style={styles.fullScreenCloseBtn} onPress={() => setSelectedImage(null)}>
            <Icon name="close" size={28} color="#FFF" />
          </TouchableOpacity>
          {selectedImage && (
            <Image
              source={{ uri: getImageUrl(selectedImage) }}
              style={styles.fullScreenImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { color: Colors.textSecondary, fontFamily: Typography.fontFamily.medium, fontSize: Typography.fontSize.sm },
  scroll: { paddingBottom: 120 },

  /* ── Full Screen Image Modal ── */
  fullScreenImageContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  fullScreenCloseBtn: { position: 'absolute', top: 50, right: 20, zIndex: 10, padding: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 20 },
  fullScreenImage: { width: '100%', height: '100%' },

  /* ── Image Gallery Carousel ── */
  coverContainer: { height: 340, width: '100%', borderBottomLeftRadius: 30, borderBottomRightRadius: 30, overflow: 'hidden' },
  coverGradient: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  paginationContainer: {
    position: 'absolute', right: 16, bottom: 50,
  },
  paginationBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: BorderRadius.full,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  paginationText: { color: '#FFF', fontFamily: Typography.fontFamily.bold, fontSize: 11 },
  heroFloatingBadge: {
    position: 'absolute', left: 16, bottom: 50,
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFD400',
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 8,
  },
  heroFloatingBadgeText: { color: '#000', fontSize: 8, fontFamily: Typography.fontFamily.bold, marginLeft: 3 },

  /* ── CARD 0: Floating Information Card (Overlaps Carousel by 40px) ── */
  infoCardContainer: {
    marginTop: -40,
    marginHorizontal: 16,
    borderRadius: 24,
    padding: 18,
    backgroundColor: '#161616',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 10,
    zIndex: 10,
  },
  glassHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 6, gap: 10,
  },
  glassTitle: {
    fontSize: 18,
    fontFamily: Typography.fontFamily.extraBold,
    color: '#FFF',
    flex: 1,
    lineHeight: 24,
  },
  ratingBadgeGold: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFCC00',
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 6, gap: 3,
  },
  ratingTextGold: { color: '#000', fontFamily: Typography.fontFamily.bold, fontSize: 11 },

  locationRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 5, marginBottom: 12 },
  locationText: { color: 'rgba(255,255,255,0.65)', fontFamily: Typography.fontFamily.medium, fontSize: 12, flex: 1 },

  badgesRow: { flexDirection: 'row', gap: 6, marginBottom: 16, flexWrap: 'wrap' },
  verifiedBadgeCompact: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(46, 213, 115, 0.1)',
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 0.5, borderColor: 'rgba(46, 213, 115, 0.3)',
  },
  verifiedTextCompact: { color: '#2ED573', fontSize: 10, fontFamily: Typography.fontFamily.bold },
  trustBadgeCompact: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 6, borderWidth: 0.5,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  trustTextCompact: { fontSize: 10, fontFamily: Typography.fontFamily.bold },
  typeBadgeCompact: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,204,0,0.1)',
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 0.5, borderColor: 'rgba(255,204,0,0.3)',
  },
  typeTextCompact: { color: '#FFCC00', fontSize: 10, fontFamily: Typography.fontFamily.bold },

  glassBottom: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.06)', paddingTop: 12,
  },
  priceContainer: { flexDirection: 'column' },
  priceLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 9, fontFamily: Typography.fontFamily.medium, textTransform: 'uppercase' },
  priceValue: { color: '#FFF', fontFamily: Typography.fontFamily.bold, fontSize: 16 },
  priceUnit: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontFamily: Typography.fontFamily.medium },

  /* ── Card Stack Morphism (Standard stack card) ── */
  stackCard: {
    marginHorizontal: 16,
    borderRadius: 22,
    padding: 18,
    backgroundColor: '#161616',
    borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.06)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
    marginTop: 16, // Beautiful spacing between cards naturally
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  cardHeaderTitle: { color: '#FFF', fontSize: 14, fontFamily: Typography.fontFamily.bold, marginLeft: 8 },

  /* ── CARD 1: Quick Information Grid (2x3 Grid) ── */
  grid2x3: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  gridItem: {
    width: '48.5%',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.04)',
  },
  gridIcon: { marginBottom: 6 },
  gridLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 9, fontFamily: Typography.fontFamily.medium },
  gridValue: { color: '#FFF', fontSize: 11, fontFamily: Typography.fontFamily.bold, marginTop: 2 },

  /* ── CARD 2: About ── */
  aboutContainer: {
    paddingVertical: 2,
  },
  aboutText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    lineHeight: 18,
    fontFamily: Typography.fontFamily.regular,
  },

  /* ── CARD 3: Pricing Stack ── */
  pricingStack: { gap: 10 },
  pricingCardRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: 12, borderRadius: 12,
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.04)',
  },
  pricingLabelBlock: { flexDirection: 'row', alignItems: 'center', width: 120 },
  pricingDayLabel: { color: '#FFF', fontSize: 12, fontFamily: Typography.fontFamily.bold },
  pricingDivider: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginHorizontal: 12 },
  pricingAmount: { color: '#FFCC00', fontSize: 14, fontFamily: Typography.fontFamily.extraBold },

  /* ── CARD 4: Amenities Offered ── */
  amenitiesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  amenityChip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,204,0,0.08)',
    borderWidth: 0.5, borderColor: 'rgba(255,204,0,0.18)',
    borderRadius: 10,
    paddingVertical: 8, paddingHorizontal: 12,
  },
  amenityText: { color: '#FFF', fontSize: 12, fontFamily: Typography.fontFamily.semiBold },

  /* ── CARD 5: Gallery Card ── */
  galleryScroll: { gap: 10 },
  galleryImage: { width: 130, height: 90, borderRadius: 12 },

  /* ── CARD 6: Reviews Card ── */
  reviewsHeadingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  writeReviewBtnGold: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#FFCC00',
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 6,
  },
  writeReviewTextGold: { color: '#000', fontFamily: Typography.fontFamily.bold, fontSize: 11 },
  reviewsOverview: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 14, padding: 12, marginBottom: 14,
  },
  overviewScoreBlock: { alignItems: 'center', width: 100 },
  overviewScore: { color: '#FFF', fontSize: 26, fontFamily: Typography.fontFamily.extraBold },
  overviewStars: { flexDirection: 'row', gap: 2, marginVertical: 4 },
  overviewCount: { color: 'rgba(255,255,255,0.4)', fontSize: 10, fontFamily: Typography.fontFamily.medium },
  overviewDivider: { width: 1, height: 50, backgroundColor: 'rgba(255,255,255,0.08)' },
  topReviewQuote: { flex: 1, paddingLeft: 14 },
  quoteText: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontFamily: Typography.fontFamily.medium, fontStyle: 'italic', lineHeight: 15 },
  quoteAuthor: { color: '#FFCC00', fontSize: 9, fontFamily: Typography.fontFamily.bold, marginTop: 4 },
  emptyReviewsLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 12, fontFamily: Typography.fontFamily.medium, textAlign: 'center', marginVertical: 10 },
  reviewList: { gap: 10, marginTop: 10 },
  reviewCard: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 12, padding: 12,
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.04)',
  },
  reviewCardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  reviewerAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.1)' },
  reviewerInfo: { flex: 1, marginLeft: 8 },
  reviewerName: { color: '#FFF', fontSize: 11, fontFamily: Typography.fontFamily.bold },
  starsRow: { flexDirection: 'row', gap: 2, marginTop: 2 },
  reviewDate: { color: 'rgba(255,255,255,0.3)', fontSize: 9, fontFamily: Typography.fontFamily.medium },
  reviewText: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontFamily: Typography.fontFamily.regular, lineHeight: 16 },

  /* ── CARD 7: Similar Turfs ── */
  similarScroll: { gap: 10 },
  similarCard: {
    width: 140,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12, overflow: 'hidden',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.04)',
  },
  similarCardImg: { width: '100%', height: 80, resizeMode: 'cover' },
  similarCardContent: { padding: 8, gap: 2 },
  similarCardName: { color: '#FFF', fontSize: 11, fontFamily: Typography.fontFamily.bold },
  similarCardMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  similarCardMetaText: { color: 'rgba(255,255,255,0.4)', fontSize: 9, fontFamily: Typography.fontFamily.medium },
  similarCardMetaDot: { color: 'rgba(255,255,255,0.2)', fontSize: 8 },
  similarCardPrice: { color: '#FFCC00', fontSize: 10, fontFamily: Typography.fontFamily.extraBold, marginTop: 4 },

  /* ── Floating Header Nav ── */
  floatingTopBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    zIndex: 100, // Top navigation floats above the stack
  },
  topBarInner: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 10,
  },
  topBarRight: { flexDirection: 'row', gap: 10 },
  floatingIconBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)',
  },
  floatingIconBtnFav: { backgroundColor: 'rgba(255,71,87,0.2)' },

  /* ── Bottom Sticky Booking Bar ── */
  bottomStickyBar: {
    position: 'absolute', bottom: 16, left: 16, right: 16,
    height: 72, borderRadius: 36,
    backgroundColor: 'rgba(22,22,22,0.95)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 10,
    zIndex: 200, // Bottom bar stays on top of everything
  },
  bottomPriceBlock: { flexDirection: 'column' },
  bottomPriceLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 9, fontFamily: Typography.fontFamily.medium, textTransform: 'uppercase' },
  bottomPriceRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 1 },
  bottomPriceValue: { color: '#FFF', fontSize: 18, fontFamily: Typography.fontFamily.bold },
  bottomPriceUnit: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontFamily: Typography.fontFamily.medium, marginLeft: 2 },
  bookingPillBtn: { borderRadius: 20, overflow: 'hidden', shadowColor: '#FFD400', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 4 },
  bookingPillBtnGrad: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 20 },
  bookingBtnText: { color: '#000', fontFamily: Typography.fontFamily.bold, fontSize: 13 },

  /* ── Rating modal ── */
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#161616',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    paddingBottom: 40,
    borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.1)', alignSelf: 'center', marginBottom: 12 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  modalTitleBlock: { flex: 1 },
  modalTitle: { fontSize: 18, fontFamily: Typography.fontFamily.bold, color: '#FFF' },
  modalSubtitle: { fontSize: 12, fontFamily: Typography.fontFamily.regular, color: Colors.textSecondary, marginTop: 2 },
  modalCloseBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center' },
  starsContainer: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 8 },
  ratingLabel: { textAlign: 'center', color: '#FFCC00', fontFamily: Typography.fontFamily.bold, fontSize: 14, marginBottom: 16 },
  commentInput: {
    backgroundColor: '#000',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: 12,
    color: '#FFF',
    fontFamily: Typography.fontFamily.regular,
    height: 100, textAlignVertical: 'top',
    marginBottom: 16,
  },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  errorMsg: { color: Colors.error, fontFamily: Typography.fontFamily.medium, fontSize: 12 },
  submitBtn: { borderRadius: 12, overflow: 'hidden' },
  submitBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12 },
  submitBtnText: { color: '#000', fontFamily: Typography.fontFamily.bold, fontSize: 14 },
});

export default TurfDetailScreen;