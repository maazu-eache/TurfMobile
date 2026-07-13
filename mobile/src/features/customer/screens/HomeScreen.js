import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, FlatList, Animated, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useDispatch, useSelector } from 'react-redux';
import { fetchTurfs } from '../../turf/turfSlice';
import { fetchMyPlayer, followPlayer } from '../../player/playerSlice';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../../theme/theme';
import SkeletonPlaceholder from 'react-native-skeleton-placeholder';
import api from '../../../api/axios';
import NotificationBell from '../../../components/NotificationBell';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const QUICK_ACTIONS = [
  { icon: 'calendar-search', label: 'Book Turf', gradient: ['#9abc2f', '#6d8e1f'], screen: 'Search', params: { screen: 'SearchMain', params: { tab: 'turfs' } } },
  { icon: 'cricket', label: 'Score Match', gradient: ['#2196F3', '#1565C0'], screen: 'My Cricket', params: { screen: 'MyCricketMain', params: { tab: 'Matches' } } },
  { icon: 'trophy', label: 'Tournaments', gradient: ['#FFD600', '#F57F17'], screen: 'My Cricket', params: { screen: 'MyCricketMain', params: { tab: 'Tournaments' } } },
  { icon: 'heart', label: 'Favourites', gradient: ['#F44336', '#C62828'], screen: 'Profile', params: { screen: 'Favourites' } },
];

const STATS_CONFIG = [
  { key: 'bookings', label: 'Bookings', icon: 'calendar-check', color: Colors.primary },
  { key: 'matches', label: 'Matches', icon: 'cricket', color: '#2196F3' },
  { key: 'turfsNear', label: 'Turfs Near', icon: 'map-marker-radius', color: '#FF8F00' },
];

const HomeScreen = ({ navigation }) => {
  const dispatch = useDispatch();
  const { turfs, isLoading } = useSelector((state) => state.turf);
  const { user, isAuthenticated } = useSelector((state) => state.auth);
  const { myProfile } = useSelector((state) => state.player || {});
  const [platformSettings, setPlatformSettings] = useState(null);
  const [dashboardStats, setDashboardStats] = useState({ bookings: 0, matches: 0, turfsNear: 0 });
  const [nearPlayers, setNearPlayers] = useState([]);
  const [nearPlayersLoading, setNearPlayersLoading] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;

  const authGuard = (callback) => {
    if (!isAuthenticated) navigation.navigate('AuthModal', { screen: 'Login' });
    else callback();
  };

  useEffect(() => {
    dispatch(fetchTurfs({ limit: 8, sort: '-rating' }));
    fetchPlatformSettings();
  }, [dispatch]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchDashboardStats();
      if (!myProfile && user) {
        dispatch(fetchMyPlayer());
      }

      const city = myProfile?.city || user?.city || '';
      fetchNearPlayers(city);
    }
  }, [dispatch, isAuthenticated, user, myProfile]);

  const fetchNearPlayers = async (city) => {
    try {
      setNearPlayersLoading(true);
      const res = await api.get('/players', { params: { city, limit: 10 } });
      if (res.data.data) {
        setNearPlayers(res.data.data.filter(p => (p.userId?._id || p.userId) !== user?._id));
      }
    } catch (_) { } finally {
      setNearPlayersLoading(false);
    }
  };

  const fetchPlatformSettings = async () => {
    try {
      const res = await api.get('/admin/public-settings');
      if (res.data.data) setPlatformSettings(res.data.data);
    } catch (_) { }
  };

  const fetchDashboardStats = async () => {
    try {
      const res = await api.get('/users/dashboard-stats');
      if (res.data.data) setDashboardStats(res.data.data);
    } catch (_) { }
  };

  const getImageUrl = (path) => {
    if (!path) return 'https://via.placeholder.com/300x200?text=Turf';
    if (path.startsWith('http')) return path;
    const baseUrl = api.defaults.baseURL.replace('/api', '');
    return `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
  };

  const headerBg = scrollY.interpolate({
    inputRange: [0, 80],
    outputRange: ['rgba(1,21,40,0)', 'rgba(1,21,40,0.98)'],
    extrapolate: 'clamp',
  });

  const navigate = (screen, params) => {
    if (params) navigation.navigate(screen, params);
    else navigation.navigate(screen);
  };

  const renderTurfCard = ({ item }) => (
    <TouchableOpacity
      style={styles.turfCard}
      onPress={() => navigation.navigate('TurfDetail', { id: item._id })}
      activeOpacity={0.9}
    >
      <Image source={{ uri: getImageUrl(item.coverImage) }} style={styles.turfImage} />
      <View style={styles.turfBadgesRow}>
        {(item.isVerified || item.owner?.isVerifiedOwner || item.ownerInfo?.isVerifiedOwner) && (
          <View style={styles.verifiedBadge}>
            <Icon name="check-decagram" size={10} color="#FFF" />
            <Text style={styles.badgeText}>Verified</Text>
          </View>
        )}
        {(item.owner?.trustScore || item.ownerInfo?.trustScore) >= 80 && (
          <View style={[styles.trustBadge, { backgroundColor: Colors.primary }]}>
            <Icon name="shield-star" size={10} color="#000" />
            <Text style={[styles.badgeText, { color: '#000' }]}>
              {item.owner?.trustScore || item.ownerInfo?.trustScore}%
            </Text>
          </View>
        )}
      </View>
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.9)']}
        style={styles.turfGradient}
      >
        <Text style={styles.turfName} numberOfLines={1}>{item.name}</Text>
        <View style={styles.turfMetaRow}>
          <View style={styles.turfMeta}>
            <Icon name="map-marker" size={12} color={Colors.primary} />
            <Text style={styles.turfMetaText}>{item.city}</Text>
          </View>
          <View style={styles.ratingChip}>
            <Icon name="star" size={10} color={Colors.primary} />
            <Text style={styles.ratingChipText}>
              {item.rating > 0 ? item.rating.toFixed(1) : 'New'}
            </Text>
          </View>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );

  const handleFollow = (playerId) => {
    authGuard(() => {
      dispatch(followPlayer(playerId));
    });
  };

  const renderPlayerCard = ({ item }) => {
    const isFollowing = myProfile?.following?.includes(item._id) || false;
    const photo = item.photo || item.userId?.photo;

    return (
      <TouchableOpacity
        style={styles.playerCard}
        onPress={() => navigation.navigate('PlayerDetail', { id: item._id })}
        activeOpacity={0.9}
      >
        <View style={styles.playerAvatarContainer}>
          {photo ? (
            <Image source={{ uri: getImageUrl(photo) }} style={styles.playerAvatar} />
          ) : (
            <View style={styles.playerAvatarPlaceholder}>
              <Icon name="account" size={32} color="#FFF" />
            </View>
          )}
        </View>
        <Text style={styles.playerName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.playerRole} numberOfLines={1}>{item.playingRole || 'Player'}</Text>
        <TouchableOpacity
          style={[styles.followBtn, isFollowing && styles.followingBtn]}
          onPress={() => handleFollow(item._id)}
        >
          <Icon name={isFollowing ? 'check' : 'plus'} size={14} color={isFollowing ? Colors.primary : '#000'} style={{ marginRight: 4 }} />
          <Text style={[styles.followBtnText, isFollowing && styles.followingBtnText]}>
            {isFollowing ? 'Following' : 'Follow'}
          </Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Floating sticky header */}
      <Animated.View style={[styles.stickyHeader, { backgroundColor: headerBg }]}>
        <SafeAreaView edges={['top']}>
          <View style={styles.headerInner}>
            <View style={styles.headerLeft}>
              <Image source={require('../../../../Rough_Turf.png')} style={styles.headerLogo} resizeMode="contain" />
              <View>
                <Text style={styles.greeting}>Hey, {user?.name?.split(' ')[0] || 'Cricketer'} 👋</Text>
                <Text style={styles.subGreeting}>Ready for a match today?</Text>
              </View>
            </View>
            <View style={styles.headerRight}>
              <NotificationBell onPress={() => authGuard(() => navigation.navigate('Notifications'))} />
              <TouchableOpacity onPress={() => authGuard(() => navigation.navigate('Profile'))} activeOpacity={0.8}>
                <LinearGradient colors={Colors.gradients.primary} style={styles.avatarGrad}>
                  <Text style={styles.avatarText}>{user?.name?.charAt(0)?.toUpperCase() || 'U'}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </Animated.View>

      <Animated.ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
        scrollEventThrottle={16}
      >
        {/* Hero Section */}
        <LinearGradient
          colors={['#011528', '#0d2a45', '#011528']}
          style={styles.heroSection}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <SafeAreaView edges={['top']}>
            <View style={{ height: 70 }} />
          </SafeAreaView>

          {/* Platform banner if exists, else default hero content */}
          {platformSettings?.bannerUrl ? (
            <View style={styles.bannerWrapper}>
              <Image
                source={{ uri: getImageUrl(platformSettings.bannerUrl) }}
                style={styles.bannerImage}
                resizeMode="cover"
              />
            </View>
          ) : (
            <View style={styles.heroContent}>
              <View style={styles.heroBadge}>
                <View style={styles.heroLiveDot} />
                <Text style={styles.heroBadgeText}>LIVE MATCHES TODAY</Text>
              </View>
              <Text style={styles.heroTitle}>Find & Book{'\n'}Your Perfect Turf</Text>
              <Text style={styles.heroSub}>Discover top-rated cricket turfs near you</Text>
              <TouchableOpacity
                style={styles.heroBtn}
                onPress={() => navigation.navigate('Search')}
                activeOpacity={0.85}
              >
                <LinearGradient colors={Colors.gradients.primary} style={styles.heroBtnGrad}>
                  <Icon name="magnify" size={18} color="#000" />
                  <Text style={styles.heroBtnText}>Explore Turfs</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}

          {/* Stats row */}
          <View style={styles.statsRow}>
            {STATS_CONFIG.map((stat, i) => (
              <View key={i} style={styles.statCard}>
                <View style={[styles.statIconWrap, { backgroundColor: stat.color + '25' }]}>
                  <Icon name={stat.icon} size={18} color={stat.color} />
                </View>
                <Text style={styles.statValue}>
                  {dashboardStats[stat.key] > 99 ? '99+' : dashboardStats[stat.key] || 0}
                  {stat.key === 'turfsNear' && dashboardStats[stat.key] > 0 ? '+' : ''}
                </Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </View>
            ))}
          </View>
        </LinearGradient>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { paddingHorizontal: Spacing.xl }]}>Quick Actions</Text>
          <View style={styles.quickActionsGrid}>
            {QUICK_ACTIONS.map((action, i) => (
              <TouchableOpacity
                key={i}
                style={styles.actionCard}
                activeOpacity={0.85}
                onPress={() => {
                  let finalParams = action.params;
                  if (finalParams && finalParams.params) {
                    finalParams = {
                      ...finalParams,
                      params: { ...finalParams.params, _ts: Date.now() }
                    };
                  } else if (finalParams) {
                    finalParams = { ...finalParams, _ts: Date.now() };
                  }

                  if (action.label === 'Favourites') {
                    authGuard(() => navigate(action.screen, finalParams));
                  } else if (finalParams) {
                    authGuard(() => navigate(action.screen, finalParams));
                  } else {
                    navigate(action.screen, finalParams);
                  }
                }}
              >
                <LinearGradient colors={action.gradient} style={styles.actionIconCircle}>
                  <Icon name={action.icon} size={26} color="#FFF" />
                </LinearGradient>
                <Text style={styles.actionLabel}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Live Matches Banner */}
        <View style={styles.px}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => navigation.navigate('My Cricket', { screen: 'MyCricketMain' })}
          >
            <LinearGradient
              colors={['#1a0a00', '#2d1500', '#1a0a00']}
              style={styles.liveBanner}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.liveBannerLeft}>
                <View style={styles.livePill}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveLabel}>LIVE</Text>
                </View>
                <Text style={styles.liveBannerTitle}>Watch Live Matches</Text>
                <Text style={styles.liveBannerSub}>Catch the action from local turfs near you</Text>
              </View>
              <View style={styles.liveBannerRight}>
                <LinearGradient colors={['#FF8F00', '#E65100']} style={styles.liveArrowBtn}>
                  <Icon name="arrow-right" size={20} color="#FFF" />
                </LinearGradient>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Players Near You */}
        {isAuthenticated && nearPlayers?.length > 0 && (
          <View style={[styles.section, { marginTop: 20 }]}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Players Near You</Text>
                <Text style={styles.sectionSub}>Connect with cricketers {user?.city || myProfile?.city ? `in ${user?.city || myProfile?.city}` : 'around you'}</Text>
              </View>
              <TouchableOpacity
                style={styles.seeAllBtn}
                onPress={() => navigation.navigate('Search', { screen: 'SearchMain', params: { tab: 'players' } })}
              >
                <Text style={styles.seeAllText}>See All</Text>
                <Icon name="arrow-right" size={14} color={Colors.primary} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={nearPlayers}
              keyExtractor={(item) => item._id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: Spacing.xl, gap: 12 }}
              renderItem={renderPlayerCard}
            />
          </View>
        )}

        {/* Top Rated Turfs */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Top Rated Turfs</Text>
              <Text style={styles.sectionSub}>Highest rated near you</Text>
            </View>
            <TouchableOpacity
              style={styles.seeAllBtn}
              onPress={() => navigation.navigate('Search')}
            >
              <Text style={styles.seeAllText}>See All</Text>
              <Icon name="arrow-right" size={14} color={Colors.primary} />
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <SkeletonPlaceholder backgroundColor={Colors.backgroundElevated} highlightColor={Colors.surfaceVariant}>
              <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: Spacing.xl }}>
                {[1, 2].map(k => (
                  <View key={k} style={{ width: 240, height: 200, borderRadius: 16 }} />
                ))}
              </View>
            </SkeletonPlaceholder>
          ) : (
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={turfs}
              keyExtractor={(item) => item._id}
              renderItem={renderTurfCard}
              contentContainerStyle={styles.turfList}
            />
          )}
        </View>

        {/* Explore All CTA */}
        <View style={styles.px}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => navigation.navigate('Search')}
          >
            <LinearGradient
              colors={['rgba(154,188,47,0.12)', 'rgba(154,188,47,0.06)']}
              style={styles.exploreCta}
            >
              <Icon name="map-search-outline" size={32} color={Colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.exploreTitle}>Explore All Turfs</Text>
                <Text style={styles.exploreSub}>Filter by location, sport & price</Text>
              </View>
              <Icon name="chevron-right" size={24} color={Colors.primary} />
            </LinearGradient>
          </TouchableOpacity>
        </View>

      </Animated.ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { paddingBottom: 100 },

  // Sticky header
  stickyHeader: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    zIndex: 100,
  },
  headerInner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerLogo: { width: 34, height: 34, borderRadius: 8 },
  greeting: {
    fontSize: Typography.fontSize.md,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.textPrimary,
  },
  subGreeting: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.textSecondary,
  },
  avatarGrad: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#000',
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.fontSize.lg,
  },

  // Hero
  heroSection: {
    paddingBottom: Spacing.lg,
  },
  heroContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(244,67,54,0.15)',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(244,67,54,0.3)',
  },
  heroLiveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.error },
  heroBadgeText: { color: Colors.error, fontSize: 10, fontFamily: Typography.fontFamily.bold, letterSpacing: 1 },
  heroTitle: {
    fontSize: Typography.fontSize['3xl'],
    fontFamily: Typography.fontFamily.extraBold,
    color: Colors.textPrimary,
    lineHeight: 36,
    marginBottom: Spacing.sm,
  },
  heroSub: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.textSecondary,
    marginBottom: Spacing.xl,
  },
  heroBtn: {
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
    alignSelf: 'flex-start',
    ...Shadows.glow,
  },
  heroBtnGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: Spacing.xl,
    paddingVertical: 12,
  },
  heroBtnText: {
    color: '#000',
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.fontSize.base,
  },
  bannerWrapper: {
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
  },
  bannerImage: { width: '100%', height: 150 },

  // Stats
  statsRow: {
    flexDirection: 'row',
    marginHorizontal: Spacing.xl,
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.backgroundElevated,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statIconWrap: {
    width: 38,
    height: 38,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  statValue: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.extraBold,
    color: Colors.textPrimary,
  },
  statLabel: {
    fontSize: 10,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.textSecondary,
    textAlign: 'center',
  },

  // Sections
  section: { marginBottom: Spacing['2xl'], marginTop: Spacing.xl },
  px: { paddingHorizontal: Spacing.xl, marginBottom: Spacing['2xl'] },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: Typography.fontSize.xl,
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.bold,
    marginBottom: 4,
  },
  sectionSub: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.regular,
  },
  seeAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  seeAllText: { color: Colors.primary, fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.fontSize.sm },

  // Quick Actions
  quickActionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
  },
  actionCard: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.backgroundElevated,
    borderRadius: BorderRadius.xl,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  actionIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionLabel: {
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: 10,
    textAlign: 'center',
  },

  // Live banner
  liveBanner: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(255,143,0,0.3)',
    ...Shadows.md,
  },
  liveBannerLeft: { flex: 1, gap: 6 },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(244,67,54,0.2)',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(244,67,54,0.4)',
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.error },
  liveLabel: { color: Colors.error, fontSize: 9, fontFamily: Typography.fontFamily.bold, letterSpacing: 1 },
  liveBannerTitle: {
    fontSize: Typography.fontSize.lg,
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.bold,
  },
  liveBannerSub: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.regular,
  },
  liveBannerRight: {},
  liveArrowBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: Spacing.md,
  },

  // Turf Cards
  turfList: { paddingHorizontal: Spacing.xl, gap: Spacing.md },
  turfCard: {
    width: 240,
    height: 200,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    ...Shadows.md,
  },
  turfImage: { width: '100%', height: '100%' },
  turfBadgesRow: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  turfGradient: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: '55%',
    justifyContent: 'flex-end',
    padding: Spacing.md,
  },
  turfName: {
    fontSize: Typography.fontSize.base,
    color: '#FFF',
    fontFamily: Typography.fontFamily.bold,
    marginBottom: 4,
  },
  turfMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  turfMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  turfMetaText: { color: 'rgba(255,255,255,0.8)', fontSize: 10, fontFamily: Typography.fontFamily.medium },
  ratingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(154,188,47,0.25)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(154,188,47,0.4)',
  },
  ratingChipText: { color: Colors.primary, fontSize: 10, fontFamily: Typography.fontFamily.bold },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1565C0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  trustBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 9,
    fontFamily: Typography.fontFamily.bold,
  },

  // Explore CTA
  exploreCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(154,188,47,0.25)',
  },
  exploreTitle: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  exploreSub: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.textSecondary,
  },

  // Player Card Styles
  playerCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.xl,
    padding: 16,
    alignItems: 'center',
    width: 130,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  playerAvatarContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginBottom: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden',
  },
  playerAvatar: {
    width: '100%',
    height: '100%',
  },
  playerAvatarPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerName: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.textPrimary,
    marginBottom: 2,
    textAlign: 'center',
  },
  playerRole: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.textSecondary,
    marginBottom: 12,
    textAlign: 'center',
  },
  followBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.primary,
    width: '100%',
  },
  followingBtn: {
    backgroundColor: 'rgba(154,188,47,0.15)',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  followBtnText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.semiBold,
    color: '#000',
  },
  followingBtnText: {
    color: Colors.primary,
  },
});

export default HomeScreen;
