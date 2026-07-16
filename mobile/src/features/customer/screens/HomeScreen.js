import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, FlatList, Animated, Dimensions, Modal, TouchableWithoutFeedback,
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

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SIDEBAR_WIDTH = SCREEN_WIDTH * 0.72;

// ── Sidebar menu items ────────────────────────────────────────────────────────
const SIDEBAR_SECTIONS = [
  {
    title: 'Cricket',
    items: [
      { icon: 'cricket', label: 'Score a Match', tab: 'My Cricket', params: { screen: 'MyCricketMain', params: { tab: 'Matches' } } },
      { icon: 'trophy-outline', label: 'Tournaments', tab: 'My Cricket', params: { screen: 'MyCricketMain', params: { tab: 'Tournaments' } } },
      { icon: 'account-group-outline', label: 'My Teams', tab: 'My Cricket', params: { screen: 'MyCricketMain', params: { tab: 'Teams' } } },
      { icon: 'poll', label: 'Leaderboard', tab: 'Search', params: { screen: 'SearchMain', params: { tab: 'players' } } },
    ],
  },
  {
    title: 'Turf',
    items: [
      { icon: 'calendar-search', label: 'Book Turf', tab: 'Search', params: { screen: 'SearchMain', params: { tab: 'turfs' } } },
      { icon: 'calendar-check-outline', label: 'My Bookings', tab: 'Bookings', params: { screen: 'BookingHistory' } },
      { icon: 'heart-outline', label: 'Favourites', tab: 'Profile', params: { screen: 'Favourites' } },
    ],
  },
  {
    title: 'Account',
    items: [
      { icon: 'account-edit-outline', label: 'Edit Profile', tab: 'Profile', params: { screen: 'ProfileMain' } },
      { icon: 'wallet-outline', label: 'Wallet', tab: 'Profile', params: { screen: 'Wallet' } },
      { icon: 'bell-outline', label: 'Notifications', tab: 'Home', params: null, screen: 'Notifications' },
    ],
  },
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const sidebarAnim = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;
  const scrollY = useRef(new Animated.Value(0)).current;

  const authGuard = (callback) => {
    if (!isAuthenticated) navigation.navigate('AuthModal', { screen: 'Login' });
    else callback();
  };

  useEffect(() => {
    if (!isAuthenticated) {
      dispatch(fetchTurfs({ limit: 8, sort: '-rating' }));
    }
    fetchPlatformSettings();
  }, [dispatch, isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchDashboardStats();
      if (!myProfile && user) dispatch(fetchMyPlayer());
      
      const city = myProfile?.city || myProfile?.location || user?.city || '';
      const lat = myProfile?.locationObj?.latitude || myProfile?.latitude || user?.latitude;
      const lng = myProfile?.locationObj?.longitude || myProfile?.longitude || user?.longitude;
      
      fetchNearPlayers(city, lat, lng);
      
      const turfParams = { limit: 8 };
      if (lat && lng) {
        turfParams.lat = lat;
        turfParams.lng = lng;
      } else if (city) {
        turfParams.city = city;
      } else {
        turfParams.sort = '-rating';
      }
      
      // Dispatch fetchTurfs here since we might have location now
      dispatch(fetchTurfs(turfParams));
    }
  }, [dispatch, isAuthenticated, user, myProfile]);

  const openSidebar = () => {
    setSidebarOpen(true);
    Animated.parallel([
      Animated.timing(sidebarAnim, { toValue: 0, duration: 280, useNativeDriver: true }),
      Animated.timing(overlayAnim, { toValue: 1, duration: 280, useNativeDriver: true }),
    ]).start();
  };

  const closeSidebar = () => {
    Animated.parallel([
      Animated.timing(sidebarAnim, { toValue: -SIDEBAR_WIDTH, duration: 240, useNativeDriver: true }),
      Animated.timing(overlayAnim, { toValue: 0, duration: 240, useNativeDriver: true }),
    ]).start(() => setSidebarOpen(false));
  };

  const handleSidebarNav = (item) => {
    closeSidebar();
    setTimeout(() => {
      if (!isAuthenticated) {
        navigation.navigate('AuthModal', { screen: 'Login' });
        return;
      }
      if (item.screen) {
        navigation.navigate(item.screen);
      } else if (item.params) {
        navigation.navigate(item.tab, item.params);
      } else {
        navigation.navigate(item.tab);
      }
    }, 280);
  };

  const fetchNearPlayers = async (city, lat, lng) => {
    try {
      setNearPlayersLoading(true);
      const params = { limit: 10 };
      if (lat && lng) {
        params.lat = lat;
        params.lng = lng;
      } else if (city) {
        params.city = city;
      }
      const res = await api.get('/players', { params });
      if (res.data.data) {
        setNearPlayers(res.data.data.filter(p => (p.userId?._id || p.userId) !== user?._id));
      }
    } catch (_) { } finally { setNearPlayersLoading(false); }
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
      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.9)']} style={styles.turfGradient}>
        <Text style={styles.turfName} numberOfLines={1}>{item.name}</Text>
        <View style={styles.turfMetaRow}>
          <View style={styles.turfMeta}>
            <Icon name="map-marker" size={12} color={Colors.primary} />
            <Text style={styles.turfMetaText}>{item.city}</Text>
          </View>
          <View style={styles.ratingChip}>
            <Icon name="star" size={10} color={Colors.primary} />
            <Text style={styles.ratingChipText}>{item.rating > 0 ? item.rating.toFixed(1) : 'New'}</Text>
          </View>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );

  const handleFollow = (playerId) => {
    authGuard(() => dispatch(followPlayer(playerId)));
  };

  const renderPlayerCard = ({ item }) => {
    const isFollowing = myProfile?.following?.includes(item._id) || false;
    const photo = item.photo || item.userId?.photo;
    const runs = item.career?.batting?.runs || item.batting?.runs || 0;
    const wickets = item.career?.bowling?.wickets || item.bowling?.wickets || 0;
    const avg = item.career?.batting?.average || item.batting?.average || 0;

    return (
      <TouchableOpacity
        style={styles.playerCard}
        onPress={() => navigation.navigate('PlayerDetail', { id: item._id })}
        activeOpacity={0.9}
      >
        {/* Avatar */}
        <View style={styles.playerAvatarWrap}>
          {photo ? (
            <Image source={{ uri: getImageUrl(photo) }} style={styles.playerAvatar} />
          ) : (
            <LinearGradient colors={['#1a3a5c', '#0d2040']} style={styles.playerAvatarPlaceholder}>
              <Icon name="account" size={30} color="rgba(255,255,255,0.6)" />
            </LinearGradient>
          )}
          <View style={styles.playerRoleBadge}>
            <Text style={styles.playerRoleBadgeText} numberOfLines={1}>
              {(item.playingRole || 'Player').substring(0, 3).toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Name & location */}
        <Text style={styles.playerName} numberOfLines={1}>{item.name}</Text>
        {item.city && (
          <View style={styles.playerLocRow}>
            <Icon name="map-marker" size={10} color={Colors.primary} />
            <Text style={styles.playerLocText} numberOfLines={1}>{item.city}</Text>
          </View>
        )}

        {/* Mini stat strip */}
        <View style={styles.playerStatsRow}>
          <View style={styles.playerStat}>
            <Text style={styles.playerStatVal}>{runs}</Text>
            <Text style={styles.playerStatLbl}>Runs</Text>
          </View>
          <View style={styles.playerStatDivider} />
          <View style={styles.playerStat}>
            <Text style={styles.playerStatVal}>{wickets}</Text>
            <Text style={styles.playerStatLbl}>Wkts</Text>
          </View>
          <View style={styles.playerStatDivider} />
          <View style={styles.playerStat}>
            <Text style={styles.playerStatVal}>{avg > 0 ? Number(avg).toFixed(1) : '—'}</Text>
            <Text style={styles.playerStatLbl}>Avg</Text>
          </View>
        </View>

        {/* Follow */}
        <TouchableOpacity
          style={[styles.followBtn, isFollowing && styles.followingBtn]}
          onPress={() => handleFollow(item._id)}
        >
          <Icon name={isFollowing ? 'check' : 'plus'} size={12} color={isFollowing ? Colors.primary : '#000'} style={{ marginRight: 3 }} />
          <Text style={[styles.followBtnText, isFollowing && styles.followingBtnText]}>
            {isFollowing ? 'Following' : 'Follow'}
          </Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>

      {/* ── SIDEBAR ──────────────────────────────────────────────────────────── */}
      {sidebarOpen && (
        <Modal transparent visible animationType="none">
          {/* Overlay */}
          <TouchableWithoutFeedback onPress={closeSidebar}>
            <Animated.View style={[styles.sidebarOverlay, { opacity: overlayAnim }]} />
          </TouchableWithoutFeedback>

          {/* Drawer */}
          <Animated.View style={[styles.sidebar, { transform: [{ translateX: sidebarAnim }] }]}>
            <LinearGradient colors={['#011528', '#0a1f35', '#011528']} style={styles.sidebarInner}>
              {/* Profile header */}
              <SafeAreaView edges={['top']}>
                <View style={styles.sidebarProfile}>
                  <LinearGradient colors={Colors.gradients?.primary || ['#9abc2f', '#6d8e1f']} style={styles.sidebarAvatar}>
                    {(myProfile?.photo || user?.photo) ? (
                      <Image source={{ uri: getImageUrl(myProfile?.photo || user?.photo) }} style={styles.sidebarAvatar} />
                    ) : (
                      <Text style={styles.sidebarAvatarText}>{user?.name?.charAt(0)?.toUpperCase() || 'U'}</Text>
                    )}
                  </LinearGradient>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sidebarName} numberOfLines={1}>{user?.name || 'Cricketer'}</Text>
                    <Text style={styles.sidebarCity} numberOfLines={1}>
                      {myProfile?.locationObj?.name || myProfile?.location || myProfile?.city || user?.city || 'Set your location'}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={closeSidebar} style={styles.sidebarClose}>
                    <Icon name="close" size={20} color={Colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              </SafeAreaView>

              {/* Stats mini-bar */}
              <View style={styles.sidebarStatsRow}>
                {STATS_CONFIG.map((s, i) => (
                  <View key={i} style={styles.sidebarStat}>
                    <Text style={[styles.sidebarStatVal, { color: s.color }]}>
                      {dashboardStats[s.key] > 99 ? '99+' : dashboardStats[s.key] || 0}
                      {s.key === 'turfsNear' && dashboardStats[s.key] > 0 ? '+' : ''}
                    </Text>
                    <Text style={styles.sidebarStatLbl}>{s.label}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.sidebarDivider} />

              {/* Sections */}
              <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
                {SIDEBAR_SECTIONS.map((section, si) => (
                  <View key={si} style={styles.sidebarSection}>
                    <Text style={styles.sidebarSectionTitle}>{section.title.toUpperCase()}</Text>
                    {section.items.map((item, ii) => (
                      <TouchableOpacity
                        key={ii}
                        style={styles.sidebarItem}
                        onPress={() => handleSidebarNav(item)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.sidebarItemIcon}>
                          <Icon name={item.icon} size={18} color={Colors.primary} />
                        </View>
                        <Text style={styles.sidebarItemLabel}>{item.label}</Text>
                        <Icon name="chevron-right" size={16} color={Colors.textTertiary} style={{ marginLeft: 'auto' }} />
                      </TouchableOpacity>
                    ))}
                  </View>
                ))}
              </ScrollView>

              {/* Footer */}
              <View style={styles.sidebarFooter}>
                <Text style={styles.sidebarFooterText}>RoughTurf v1.0</Text>
              </View>
            </LinearGradient>
          </Animated.View>
        </Modal>
      )}

      {/* ── FLOATING STICKY HEADER ───────────────────────────────────────────── */}
      <Animated.View style={[styles.stickyHeader, { backgroundColor: headerBg }]}>
        <SafeAreaView edges={['top']}>
          <View style={styles.headerInner}>
            <View style={styles.headerLeft}>
              <TouchableOpacity onPress={openSidebar} style={styles.hamburgerBtn}>
                <Icon name="menu" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
              <View>
                <Text style={styles.greeting}>Hey, {user?.name?.split(' ')[0] || 'Cricketer'} 👋</Text>
                <Text style={styles.subGreeting}>Ready for a match today?</Text>
              </View>
            </View>
            <View style={styles.headerRight}>
              <NotificationBell onPress={() => authGuard(() => navigation.navigate('Notifications'))} />
              <TouchableOpacity onPress={() => authGuard(() => navigation.navigate('Profile'))} activeOpacity={0.8}>
                <LinearGradient colors={Colors.gradients?.primary || ['#9abc2f', '#6d8e1f']} style={styles.avatarGrad}>
                  {(myProfile?.photo || user?.photo) ? (
                    <Image source={{ uri: getImageUrl(myProfile?.photo || user?.photo) }} style={styles.avatarGrad} />
                  ) : (
                    <Text style={styles.avatarText}>{user?.name?.charAt(0)?.toUpperCase() || 'U'}</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </Animated.View>

      {/* ── MAIN SCROLL ─────────────────────────────────────────────────────── */}
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

          {platformSettings?.bannerUrl ? (
            <View style={styles.bannerWrapper}>
              <Image source={{ uri: getImageUrl(platformSettings.bannerUrl) }} style={styles.bannerImage} resizeMode="cover" />
            </View>
          ) : (
            <View style={styles.heroContent}>
              <View style={styles.heroBadge}>
                <View style={styles.heroLiveDot} />
                <Text style={styles.heroBadgeText}>LIVE MATCHES TODAY</Text>
              </View>
              <Text style={styles.heroTitle}>Find & Book{'\n'}Your Perfect Turf</Text>
              <Text style={styles.heroSub}>Discover top-rated cricket turfs near you</Text>
              <TouchableOpacity style={styles.heroBtn} onPress={() => navigation.navigate('Search')} activeOpacity={0.85}>
                <LinearGradient colors={Colors.gradients?.primary || ['#9abc2f', '#6d8e1f']} style={styles.heroBtnGrad}>
                  <Icon name="magnify" size={18} color="#000" />
                  <Text style={styles.heroBtnText}>Explore Turfs</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}

          {/* Stats row */}
          {/* <View style={styles.statsRow}>
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
          </View> */}
        </LinearGradient>

        {/* ── BOOK A TURF (Primary Feature) ──────────────────────────────────── */}
        <View style={[styles.px, { marginTop: 20 }]}>
          <Text style={styles.sectionTitle}>Book a Turf</Text>
          <Text style={[styles.sectionSub, { marginBottom: 14 }]}>
            {user?.city || myProfile?.city ? `Top picks in ${user?.city || myProfile?.city}` : 'Top rated turfs near you'}
          </Text>

          {/* Primary CTA card */}
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => navigation.navigate('Search', { screen: 'SearchMain', params: { tab: 'turfs' } })}
          >
            <LinearGradient
              colors={['#0d2a10', '#1a4d1e', '#0d2a10']}
              style={styles.bookTurfHero}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            >
              <View style={{ flex: 1 }}>
                <View style={styles.bookTurfBadge}>
                  <Icon name="lightning-bolt" size={11} color="#000" />
                  <Text style={styles.bookTurfBadgeText}>INSTANT BOOKING</Text>
                </View>
                <Text style={styles.bookTurfTitle}>Find & Reserve{'\n'}Your Turf Now</Text>
                <Text style={styles.bookTurfSub}>Browse 50+ turfs · Filter by time & sport</Text>
              </View>
              <View style={styles.bookTurfIconWrap}>
                <Icon name="calendar-search" size={46} color={Colors.primary} style={{ opacity: 0.9 }} />
              </View>
            </LinearGradient>
          </TouchableOpacity>

          {/* Quick booking actions */}
          <View style={styles.bookingQuickRow}>
            {[
              { icon: 'calendar-check-outline', label: 'My Bookings', onPress: () => authGuard(() => navigation.navigate('Bookings', { screen: 'BookingHistory' })) },
              { icon: 'heart-outline', label: 'Saved Turfs', onPress: () => authGuard(() => navigation.navigate('Profile', { screen: 'Favourites' })) },
              { icon: 'map-marker-radius-outline', label: 'Near Me', onPress: () => navigation.navigate('Search', { screen: 'SearchMain', params: { tab: 'turfs' } }) },
            ].map((q, i) => (
              <TouchableOpacity key={i} style={styles.bookingQuickCard} onPress={q.onPress} activeOpacity={0.8}>
                <View style={styles.bookingQuickInner}>
                  <Icon name={q.icon} size={22} color={Colors.primary} />
                  <Text style={styles.bookingQuickLabel}>{q.label}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── CRICKET QUICK ACTIONS ────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { paddingHorizontal: Spacing.xl }]}>Cricket Actions</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cricketActionsScroll}>
            {[
              { icon: 'cricket', label: 'Score\nMatch', tab: 'My Cricket', params: { screen: 'MyCricketMain', params: { tab: 'Matches' } } },
              { icon: 'trophy-outline', label: 'Tourna-\nments', tab: 'My Cricket', params: { screen: 'MyCricketMain', params: { tab: 'Tournaments' } } },
              { icon: 'account-group-outline', label: 'My\nTeams', tab: 'My Cricket', params: { screen: 'MyCricketMain', params: { tab: 'Teams' } } },
              { icon: 'plus-circle-outline', label: 'Start\nMatch', tab: 'My Cricket', params: { screen: 'MatchSetup' } },
            ].map((a, i) => (
              <TouchableOpacity
                key={i}
                style={styles.cricketActionCard}
                onPress={() => authGuard(() => navigation.navigate(a.tab, a.params))}
                activeOpacity={0.85}
              >
                <View style={styles.cricketActionIcon}>
                  <Icon name={a.icon} size={28} color={Colors.primary} />
                </View>
                <Text style={styles.cricketActionLabel}>{a.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* ── LIVE MATCHES BANNER ─────────────────────────────────────────── */}
        <View style={styles.px}>
          <TouchableOpacity activeOpacity={0.9} onPress={() => navigation.navigate('My Cricket', { screen: 'MyCricketMain' })}>
            <View style={styles.liveBanner}>
              <View style={styles.liveBannerLeft}>
                <View style={styles.livePill}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveLabel}>LIVE</Text>
                </View>
                <Text style={styles.liveBannerTitle}>Watch Live Matches</Text>
                <Text style={styles.liveBannerSub}>Catch the action from local turfs near you</Text>
              </View>
              <View style={styles.liveArrowBtn}>
                <Icon name="arrow-right" size={20} color={Colors.primary} />
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* ── PLAYERS NEAR YOU ────────────────────────────────────────────── */}
        {isAuthenticated && nearPlayers?.length > 0 && (
          <View style={[styles.section, { marginTop: 8 }]}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Players Near You</Text>
                <Text style={styles.sectionSub}>
                  {user?.city || myProfile?.city ? `Cricketers in ${user?.city || myProfile?.city}` : 'Based on your location'}
                </Text>
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

        {/* ── TOP RATED TURFS ─────────────────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Top Rated Turfs</Text>
              <Text style={styles.sectionSub}>Highest rated near you</Text>
            </View>
            <TouchableOpacity style={styles.seeAllBtn} onPress={() => navigation.navigate('Search')}>
              <Text style={styles.seeAllText}>See All</Text>
              <Icon name="arrow-right" size={14} color={Colors.primary} />
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <SkeletonPlaceholder backgroundColor={Colors.backgroundElevated} highlightColor={Colors.surfaceVariant}>
              <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: Spacing.xl }}>
                {[1, 2].map(k => <View key={k} style={{ width: 240, height: 200, borderRadius: 16 }} />)}
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

        {/* ── EXPLORE CTA ─────────────────────────────────────────────────── */}
        <View style={styles.px}>
          <TouchableOpacity activeOpacity={0.85} onPress={() => navigation.navigate('Search')}>
            <LinearGradient colors={['rgba(154,188,47,0.12)', 'rgba(154,188,47,0.06)']} style={styles.exploreCta}>
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

  // ── Sidebar ──────────────────────────────────────────────────────────────
  sidebarOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    zIndex: 10,
  },
  sidebar: {
    position: 'absolute',
    top: 0, left: 0, bottom: 0,
    width: SIDEBAR_WIDTH,
    zIndex: 20,
  },
  sidebarInner: { flex: 1, paddingBottom: 20 },
  sidebarProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingTop: 8,
  },
  sidebarAvatar: {
    width: 50, height: 50, borderRadius: 25,
    justifyContent: 'center', alignItems: 'center',
  },
  sidebarAvatarText: { color: '#000', fontFamily: Typography.fontFamily.bold, fontSize: 20 },
  sidebarName: {
    color: Colors.textPrimary, fontFamily: Typography.fontFamily.bold, fontSize: 15,
  },
  sidebarCity: {
    color: Colors.textSecondary, fontFamily: Typography.fontFamily.regular, fontSize: 12, marginTop: 2,
  },
  sidebarClose: { padding: 6 },
  sidebarStatsRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    paddingVertical: 10,
  },
  sidebarStat: { flex: 1, alignItems: 'center' },
  sidebarStatVal: { fontSize: 18, fontFamily: Typography.fontFamily.bold },
  sidebarStatLbl: { fontSize: 10, color: Colors.textSecondary, fontFamily: Typography.fontFamily.medium, marginTop: 2 },
  sidebarDivider: { height: 1, backgroundColor: Colors.border, marginHorizontal: 16, marginBottom: 8 },
  sidebarSection: { paddingHorizontal: 16, marginTop: 12 },
  sidebarSectionTitle: {
    fontSize: 9, color: Colors.textTertiary, fontFamily: Typography.fontFamily.bold,
    letterSpacing: 1.2, marginBottom: 6, marginLeft: 4,
  },
  sidebarItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 11, paddingHorizontal: 10,
    borderRadius: 10,
  },
  sidebarItemIcon: {
    width: 36, height: 36, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(154,188,47,0.08)',
  },
  sidebarItemLabel: {
    fontSize: 14, fontFamily: Typography.fontFamily.medium, color: Colors.textPrimary, flex: 1,
  },
  sidebarFooter: { paddingHorizontal: 20, paddingTop: 12 },
  sidebarFooterText: { fontSize: 11, color: Colors.textTertiary, fontFamily: Typography.fontFamily.regular },

  // ── Sticky header ────────────────────────────────────────────────────────
  stickyHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100 },
  headerInner: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.sm,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  hamburgerBtn: { padding: 4 },
  greeting: { fontSize: Typography.fontSize.md, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary },
  subGreeting: { fontSize: Typography.fontSize.xs, fontFamily: Typography.fontFamily.regular, color: Colors.textSecondary },
  avatarGrad: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#000', fontFamily: Typography.fontFamily.bold, fontSize: Typography.fontSize.lg },

  // ── Hero ─────────────────────────────────────────────────────────────────
  heroSection: { paddingBottom: Spacing.lg },
  heroContent: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.md, paddingBottom: Spacing.xl },
  heroBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(244,67,54,0.15)', alignSelf: 'flex-start',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: BorderRadius.full,
    marginBottom: Spacing.md, borderWidth: 1, borderColor: 'rgba(244,67,54,0.3)',
  },
  heroLiveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.error },
  heroBadgeText: { color: Colors.error, fontSize: 10, fontFamily: Typography.fontFamily.bold, letterSpacing: 1 },
  heroTitle: {
    fontSize: Typography.fontSize['3xl'], fontFamily: Typography.fontFamily.extraBold,
    color: Colors.textPrimary, lineHeight: 36, marginBottom: Spacing.sm,
  },
  heroSub: { fontSize: Typography.fontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.xl },
  heroBtn: { borderRadius: BorderRadius.full, overflow: 'hidden', alignSelf: 'flex-start', ...Shadows.glow },
  heroBtnGrad: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: Spacing.xl, paddingVertical: 12 },
  heroBtnText: { color: '#000', fontFamily: Typography.fontFamily.bold, fontSize: Typography.fontSize.base },
  bannerWrapper: { marginHorizontal: Spacing.xl, marginBottom: Spacing.lg, borderRadius: BorderRadius.xl, overflow: 'hidden' },
  bannerImage: { width: '100%', height: 150 },

  // Stats
  statsRow: { flexDirection: 'row', marginHorizontal: Spacing.xl, gap: Spacing.sm, marginTop: Spacing.sm },
  statCard: {
    flex: 1, backgroundColor: Colors.backgroundElevated, borderRadius: BorderRadius.lg,
    padding: Spacing.md, alignItems: 'center', gap: 4, borderWidth: 1, borderColor: Colors.border,
  },
  statIconWrap: { width: 38, height: 38, borderRadius: BorderRadius.md, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  statValue: { fontSize: Typography.fontSize.lg, fontFamily: Typography.fontFamily.extraBold, color: Colors.textPrimary },
  statLabel: { fontSize: 10, fontFamily: Typography.fontFamily.medium, color: Colors.textSecondary, textAlign: 'center' },

  // Sections
  section: { marginBottom: Spacing['2xl'], marginTop: Spacing.xl },
  px: { paddingHorizontal: Spacing.xl, marginBottom: Spacing['2xl'] },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.xl, marginBottom: Spacing.lg,
  },
  sectionTitle: { fontSize: Typography.fontSize.xl, color: Colors.textPrimary, fontFamily: Typography.fontFamily.bold, marginBottom: 4 },
  sectionSub: { fontSize: Typography.fontSize.xs, color: Colors.textSecondary, fontFamily: Typography.fontFamily.regular },
  seeAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  seeAllText: { color: Colors.primary, fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.fontSize.sm },

  // ── Book Turf Hero ────────────────────────────────────────────────────────
  bookTurfHero: {
    borderRadius: 18, padding: 20, flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(154,188,47,0.2)', marginBottom: 12,
  },
  bookTurfBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
    backgroundColor: Colors.primary, paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 6, marginBottom: 10,
  },
  bookTurfBadgeText: { color: '#000', fontSize: 9, fontFamily: Typography.fontFamily.bold, letterSpacing: 0.8 },
  bookTurfTitle: {
    fontSize: 20, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary,
    lineHeight: 26, marginBottom: 6,
  },
  bookTurfSub: { fontSize: 12, color: Colors.textSecondary, fontFamily: Typography.fontFamily.regular },
  bookTurfIconWrap: { paddingLeft: 12 },
  bookingQuickRow: { flexDirection: 'row', gap: 10 },
  bookingQuickCard: { flex: 1, borderRadius: 14, overflow: 'hidden' },
  bookingQuickInner: {
    padding: 14, alignItems: 'center', gap: 6,
    backgroundColor: Colors.backgroundElevated,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: 14,
  },
  bookingQuickLabel: { fontSize: 11, color: Colors.textSecondary, fontFamily: Typography.fontFamily.semiBold, textAlign: 'center' },

  // ── Cricket Actions ────────────────────────────────────────────────────────
  cricketActionsScroll: { paddingHorizontal: Spacing.xl, gap: 12, paddingTop: 8, paddingBottom: 4 },
  cricketActionCard: {
    alignItems: 'center', gap: 8, width: 80,
    backgroundColor: Colors.backgroundElevated, borderRadius: 16, padding: 12,
    borderWidth: 1, borderColor: Colors.border,
  },
  cricketActionIcon: { width: 54, height: 54, borderRadius: 15, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(154,188,47,0.08)' },
  cricketActionLabel: { color: Colors.textSecondary, fontFamily: Typography.fontFamily.semiBold, fontSize: 10, textAlign: 'center', lineHeight: 14 },

  // Live banner
  liveBanner: {
    borderRadius: BorderRadius.xl, padding: Spacing.lg,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.backgroundElevated,
  },
  liveBannerLeft: { flex: 1, gap: 6 },
  livePill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(244,67,54,0.12)', alignSelf: 'flex-start',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: BorderRadius.full,
    borderWidth: 1, borderColor: 'rgba(244,67,54,0.25)',
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.error },
  liveLabel: { color: Colors.error, fontSize: 9, fontFamily: Typography.fontFamily.bold, letterSpacing: 1 },
  liveBannerTitle: { fontSize: Typography.fontSize.lg, color: Colors.textPrimary, fontFamily: Typography.fontFamily.bold },
  liveBannerSub: { fontSize: Typography.fontSize.sm, color: Colors.textSecondary },
  liveArrowBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginLeft: Spacing.md, backgroundColor: 'rgba(154,188,47,0.1)', borderWidth: 1, borderColor: 'rgba(154,188,47,0.2)' },

  // Turf Cards
  turfList: { paddingHorizontal: Spacing.xl, gap: Spacing.md },
  turfCard: { width: 240, height: 200, borderRadius: BorderRadius.xl, overflow: 'hidden', ...Shadows.md },
  turfImage: { width: '100%', height: '100%' },
  turfBadgesRow: { position: 'absolute', top: 10, left: 10, right: 10, flexDirection: 'row', justifyContent: 'space-between', gap: 6 },
  turfGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '55%', justifyContent: 'flex-end', padding: Spacing.md },
  turfName: { fontSize: Typography.fontSize.base, color: '#FFF', fontFamily: Typography.fontFamily.bold, marginBottom: 4 },
  turfMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  turfMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  turfMetaText: { color: 'rgba(255,255,255,0.8)', fontSize: 10, fontFamily: Typography.fontFamily.medium },
  ratingChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(154,188,47,0.25)', paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: BorderRadius.full, borderWidth: 1, borderColor: 'rgba(154,188,47,0.4)',
  },
  ratingChipText: { color: Colors.primary, fontSize: 10, fontFamily: Typography.fontFamily.bold },
  verifiedBadge: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#1565C0',
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: BorderRadius.full, gap: 4,
  },
  trustBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: BorderRadius.full, gap: 4 },
  badgeText: { color: '#FFF', fontSize: 9, fontFamily: Typography.fontFamily.bold },

  // Explore CTA
  exploreCta: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    padding: Spacing.lg, borderRadius: BorderRadius.xl,
    borderWidth: 1, borderColor: 'rgba(154,188,47,0.25)',
  },
  exploreTitle: { fontSize: Typography.fontSize.base, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary, marginBottom: 2 },
  exploreSub: { fontSize: Typography.fontSize.xs, fontFamily: Typography.fontFamily.regular, color: Colors.textSecondary },

  // ── Player Cards (enhanced) ─────────────────────────────────────────────
  playerCard: {
    backgroundColor: Colors.backgroundCard, borderRadius: 16,
    padding: 14, alignItems: 'center', width: 148,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  playerAvatarWrap: { position: 'relative', marginBottom: 10 },
  playerAvatar: { width: 64, height: 64, borderRadius: 32 },
  playerAvatarPlaceholder: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  playerRoleBadge: {
    position: 'absolute', bottom: -4, left: '50%', transform: [{ translateX: -18 }],
    backgroundColor: Colors.primary, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, minWidth: 36, alignItems: 'center',
  },
  playerRoleBadgeText: { color: '#000', fontSize: 8, fontFamily: Typography.fontFamily.bold, letterSpacing: 0.5 },
  playerName: { fontSize: 13, fontFamily: Typography.fontFamily.semiBold, color: Colors.textPrimary, textAlign: 'center', marginBottom: 3 },
  playerLocRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginBottom: 10 },
  playerLocText: { fontSize: 10, color: Colors.textSecondary, fontFamily: Typography.fontFamily.regular },
  playerStatsRow: {
    flexDirection: 'row', alignItems: 'center', width: '100%',
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 8,
    paddingVertical: 6, marginBottom: 10,
  },
  playerStat: { flex: 1, alignItems: 'center' },
  playerStatVal: { fontSize: 13, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary },
  playerStatLbl: { fontSize: 9, color: Colors.textTertiary, fontFamily: Typography.fontFamily.regular, marginTop: 1 },
  playerStatDivider: { width: 1, height: 20, backgroundColor: 'rgba(255,255,255,0.1)' },
  followBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 6, paddingHorizontal: 12, borderRadius: BorderRadius.lg,
    backgroundColor: Colors.primary, width: '100%',
  },
  followingBtn: { backgroundColor: 'rgba(154,188,47,0.15)', borderWidth: 1, borderColor: Colors.primary },
  followBtnText: { fontSize: Typography.fontSize.xs, fontFamily: Typography.fontFamily.semiBold, color: '#000' },
  followingBtnText: { color: Colors.primary },
});

export default HomeScreen;
