import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, FlatList, Animated, Dimensions, Modal, TouchableWithoutFeedback, RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useDispatch, useSelector } from 'react-redux';
import { fetchTurfs } from '../../turf/turfSlice';
import { fetchMyPlayer, followPlayer } from '../../player/playerSlice';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../../theme/theme';
import SkeletonPlaceholder from 'react-native-skeleton-placeholder';
import api, { getImageUrl } from '../../../api/axios';
import NotificationBell from '../../../components/NotificationBell';

const { width: SW, height: SH } = Dimensions.get('window');
const SIDEBAR_WIDTH = SW * 0.80;
const TURF_CARD_W = SW * 0.66;
const TURF_CARD_H = 230;

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

const CRICKET_ACTIONS = [
  { icon: 'cricket', label: 'Score Match', gradient: ['#0d2a10', '#163d1a'], tab: 'My Cricket', params: { screen: 'MyCricketMain', params: { tab: 'Matches' } } },
  { icon: 'trophy-outline', label: 'Tournaments', gradient: ['#1a2a0d', '#243d10'], tab: 'My Cricket', params: { screen: 'MyCricketMain', params: { tab: 'Tournaments' } } },
  { icon: 'account-group-outline', label: 'My Teams', gradient: ['#0d1e30', '#0d2a45'], tab: 'My Cricket', params: { screen: 'MyCricketMain', params: { tab: 'Teams' } } },
  { icon: 'plus-circle-outline', label: 'New Match', gradient: ['#1a1a0d', '#2a280d'], tab: 'My Cricket', params: { screen: 'MatchSetup' } },
];

// ── Animated Pulse for Live Dot ─────────────────────────────────────────────
const PulseDot = () => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.6, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <View style={styles.pulseDotWrap}>
      <Animated.View style={[styles.pulseDotOuter, { transform: [{ scale: pulseAnim }] }]} />
      <View style={styles.pulseDotInner} />
    </View>
  );
};

const HomeScreen = ({ navigation }) => {
  const dispatch = useDispatch();
  const { turfs, isLoading } = useSelector(s => s.turf);
  const { user, isAuthenticated } = useSelector(s => s.auth);
  const { myProfile } = useSelector(s => s.player || {});
  const [platformSettings, setPlatformSettings] = useState(null);
  const [dashboardStats, setDashboardStats] = useState({ bookings: 0, matches: 0, turfsNear: 0 });
  const [nearPlayers, setNearPlayers] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const sidebarAnim = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;
  const scrollY = useRef(new Animated.Value(0)).current;

  const authGuard = (cb) => (!isAuthenticated ? navigation.navigate('AuthModal', { screen: 'Login' }) : cb());

  useEffect(() => {
    if (!isAuthenticated) dispatch(fetchTurfs({ limit: 8, sort: '-rating' }));
    fetchPlatformSettings();
  }, [dispatch, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchDashboardStats();
    if (!myProfile && user) dispatch(fetchMyPlayer());
    const city = myProfile?.city || myProfile?.location || user?.city || '';
    const lat = myProfile?.locationObj?.latitude || user?.latitude;
    const lng = myProfile?.locationObj?.longitude || user?.longitude;
    fetchNearPlayers(city, lat, lng);
    const tp = { limit: 8 };
    if (lat && lng) { tp.lat = lat; tp.lng = lng; }
    else if (city) { tp.city = city; }
    else { tp.sort = '-rating'; }
    dispatch(fetchTurfs(tp));
  }, [dispatch, isAuthenticated, user, myProfile]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      if (!isAuthenticated) {
        dispatch(fetchTurfs({ limit: 8, sort: '-rating' }));
      } else {
        await fetchDashboardStats();
        if (!myProfile && user) dispatch(fetchMyPlayer());
        const city = myProfile?.city || myProfile?.location || user?.city || '';
        const lat = myProfile?.locationObj?.latitude || user?.latitude;
        const lng = myProfile?.locationObj?.longitude || user?.longitude;
        await fetchNearPlayers(city, lat, lng);
        const tp = { limit: 8 };
        if (lat && lng) { tp.lat = lat; tp.lng = lng; }
        else if (city) { tp.city = city; }
        else { tp.sort = '-rating'; }
        dispatch(fetchTurfs(tp));
      }
      await fetchPlatformSettings();
    } catch (e) {}
    setRefreshing(false);
  };

  const openSidebar = () => {
    setSidebarOpen(true);
    Animated.parallel([
      Animated.spring(sidebarAnim, { toValue: 0, tension: 70, friction: 12, useNativeDriver: true }),
      Animated.timing(overlayAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();
  };
  const closeSidebar = () => {
    Animated.parallel([
      Animated.timing(sidebarAnim, { toValue: -SIDEBAR_WIDTH, duration: 210, useNativeDriver: true }),
      Animated.timing(overlayAnim, { toValue: 0, duration: 210, useNativeDriver: true }),
    ]).start(() => setSidebarOpen(false));
  };
  const handleSidebarNav = (item) => {
    closeSidebar();
    setTimeout(() => {
      if (!isAuthenticated) { navigation.navigate('AuthModal', { screen: 'Login' }); return; }
      if (item.screen) navigation.navigate(item.screen);
      else if (item.params) navigation.navigate(item.tab, item.params);
      else navigation.navigate(item.tab);
    }, 240);
  };

  const fetchNearPlayers = async (city, lat, lng) => {
    try {
      const params = { limit: 10 };
      if (lat && lng) { params.lat = lat; params.lng = lng; }
      else if (city) { params.city = city; }
      const res = await api.get('/players', { params });
      if (res.data.data) setNearPlayers(res.data.data.filter(p => (p.userId?._id || p.userId) !== user?._id));
    } catch (_) {}
  };
  const fetchPlatformSettings = async () => {
    try { const r = await api.get('/admin/public-settings'); if (r.data.data) setPlatformSettings(r.data.data); } catch (_) {}
  };
  const fetchDashboardStats = async () => {
    try { const r = await api.get('/users/dashboard-stats'); if (r.data.data) setDashboardStats(r.data.data); } catch (_) {}
  };

  // Animated derived values
  const headerBg = scrollY.interpolate({ inputRange: [0, 90], outputRange: ['rgba(1,21,40,0)', 'rgba(1,21,40,0.98)'], extrapolate: 'clamp' });
  const headerBorder = scrollY.interpolate({ inputRange: [60, 100], outputRange: ['rgba(255,255,255,0)', 'rgba(255,255,255,0.08)'], extrapolate: 'clamp' });
  const heroParallax = scrollY.interpolate({ inputRange: [0, 200], outputRange: [0, -50], extrapolate: 'clamp' });

  /* ─── Turf Card ─────────────────────────────────────────────────────────── */
  const renderTurfCard = ({ item, index }) => (
    <TouchableOpacity
      style={styles.turfCard}
      onPress={() => navigation.navigate('TurfDetail', { id: item._id })}
      activeOpacity={0.9}
    >
      <Image source={{ uri: getImageUrl(item.coverImage) || 'https://via.placeholder.com/300x200?text=Turf' }} style={styles.turfImage} />

      {/* Badges */}
      <View style={styles.turfTopRow}>
        <View style={{ flex: 1 }}>
          {(item.isVerified || item.owner?.isVerifiedOwner) && (
            <View style={styles.verifiedBadge}>
              <Icon name="check-decagram" size={9} color="#FFF" />
              <Text style={styles.verifiedText}>Verified</Text>
            </View>
          )}
        </View>
        <View style={styles.ratingPill}>
          <Icon name="star" size={9} color={Colors.primary} />
          <Text style={styles.ratingPillText}>{item.rating > 0 ? item.rating.toFixed(1) : 'New'}</Text>
        </View>
      </View>

      {/* Bottom overlay */}
      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.25)', 'rgba(0,0,0,0.88)']} style={styles.turfOverlay}>
        <Text style={styles.turfName} numberOfLines={1}>{item.name}</Text>
        <View style={styles.turfMeta}>
          <Icon name="map-marker" size={11} color="rgba(255,255,255,0.6)" />
          <Text style={styles.turfMetaText} numberOfLines={1}>{item.city}</Text>
          {item.sports?.length > 0 && (
            <View style={styles.turfSportBadge}>
              <Text style={styles.turfSportText}>{item.sports[0]}</Text>
            </View>
          )}
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );

  /* ─── Player Card ───────────────────────────────────────────────────────── */
  const renderPlayerCard = ({ item }) => {
    const isFollowing = myProfile?.following?.includes(item._id) || false;
    const photo = item.photo || item.userId?.photo;
    const runs = item.career?.batting?.runs || item.batting?.runs || 0;
    const wickets = item.career?.bowling?.wickets || item.bowling?.wickets || 0;
    const avg = item.career?.batting?.average || item.batting?.average || 0;

    return (
      <TouchableOpacity style={styles.playerCard} onPress={() => navigation.navigate('PlayerDetail', { id: item._id })} activeOpacity={0.9}>
        {/* Avatar */}
        <View style={styles.playerAvatarWrap}>
          {photo
            ? <Image source={{ uri: getImageUrl(photo) || 'https://via.placeholder.com/150' }} style={styles.playerAvatar} />
            : (
              <LinearGradient colors={['#1a3a5c', '#0d2040']} style={styles.playerAvatar}>
                <Icon name="account" size={26} color="rgba(255,255,255,0.45)" />
              </LinearGradient>
            )}
          <View style={styles.rolePill}>
            <Text style={styles.rolePillText}>{(item.playingRole || 'PLR').substring(0, 3).toUpperCase()}</Text>
          </View>
        </View>

        <Text style={styles.playerName} numberOfLines={1}>{item.name}</Text>
        {item.city && (
          <View style={styles.playerLocRow}>
            <Icon name="map-marker" size={9} color={Colors.primary} />
            <Text style={styles.playerLocText} numberOfLines={1}>{item.city}</Text>
          </View>
        )}

        {/* Stats */}
        <View style={styles.playerStats}>
          {[{ v: runs, l: 'Runs' }, { v: wickets, l: 'Wkts' }, { v: avg > 0 ? Number(avg).toFixed(1) : '—', l: 'Avg' }].map((s, i) => (
            <React.Fragment key={i}>
              {i > 0 && <View style={styles.playerStatDiv} />}
              <View style={styles.playerStatCell}>
                <Text style={styles.playerStatVal}>{s.v}</Text>
                <Text style={styles.playerStatLbl}>{s.l}</Text>
              </View>
            </React.Fragment>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.followBtn, isFollowing && styles.followingBtn]}
          onPress={() => authGuard(() => dispatch(followPlayer(item._id)))}
          activeOpacity={0.8}
        >
          <Icon name={isFollowing ? 'check' : 'plus'} size={10} color={isFollowing ? Colors.primary : '#000'} />
          <Text style={[styles.followBtnText, isFollowing && styles.followingBtnText]}>
            {isFollowing ? 'Following' : 'Follow'}
          </Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  /* ─── Main JSX ──────────────────────────────────────────────────────────── */
  return (
    <View style={styles.root}>

      {/* ════ SIDEBAR ════════════════════════════════════════════════════════ */}
      {sidebarOpen && (
        <Modal transparent visible animationType="none">
          <TouchableWithoutFeedback onPress={closeSidebar}>
            <Animated.View style={[StyleSheet.absoluteFill, styles.sidebarOverlay, { opacity: overlayAnim }]} />
          </TouchableWithoutFeedback>

          <Animated.View style={[styles.sidebar, { transform: [{ translateX: sidebarAnim }] }]}>
            <LinearGradient colors={['#01111f', '#071c2d', '#011528']} style={styles.sidebarBody}>
              <SafeAreaView edges={['top']}>
                {/* ── Profile ── */}
                <View style={styles.sidebarProfile}>
                  <View>
                    <LinearGradient colors={Colors.gradients?.primary || ['#9abc2f', '#6d8e1f']} style={styles.sidebarAvatar}>
                      {(myProfile?.photo || user?.photo)
                        ? <Image source={{ uri: getImageUrl(myProfile?.photo || user?.photo) || 'https://via.placeholder.com/150' }} style={StyleSheet.absoluteFill} borderRadius={28} />
                        : <Text style={styles.sidebarAvatarTxt}>{user?.name?.charAt(0)?.toUpperCase() || 'U'}</Text>}
                    </LinearGradient>
                    <View style={styles.sidebarOnline} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sidebarName} numberOfLines={1}>{user?.name || 'Cricketer'}</Text>
                    <View style={styles.sidebarCityRow}>
                      <Icon name="map-marker-outline" size={11} color={Colors.primary} />
                      <Text style={styles.sidebarCityTxt} numberOfLines={1}>
                        {myProfile?.locationObj?.name || myProfile?.city || user?.city || 'Set your location'}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity onPress={closeSidebar} style={styles.sidebarCloseBtn}>
                    <Icon name="close" size={17} color={Colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                {/* ── Mini Stats ── */}
                <View style={styles.sidebarStats}>
                  {[
                    { k: 'bookings', l: 'Bookings', ic: 'calendar-check', c: Colors.primary },
                    { k: 'matches', l: 'Matches', ic: 'cricket', c: '#2196F3' },
                    { k: 'turfsNear', l: 'Near Me', ic: 'map-marker-radius', c: '#FF8F00' },
                  ].map((s, i) => (
                    <View key={i} style={[styles.sidebarStatCell, i < 2 && { borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.07)' }]}>
                      <Icon name={s.ic} size={14} color={s.c} />
                      <Text style={[styles.sidebarStatVal, { color: s.c }]}>{dashboardStats[s.k] > 99 ? '99+' : dashboardStats[s.k] || 0}</Text>
                      <Text style={styles.sidebarStatLbl}>{s.l}</Text>
                    </View>
                  ))}
                </View>
              </SafeAreaView>

              <View style={styles.sidebarDivider} />

              {/* ── Nav Sections ── */}
              <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
                {SIDEBAR_SECTIONS.map((section, si) => (
                  <View key={si} style={styles.sidebarSection}>
                    <Text style={styles.sidebarSectionTitle}>{section.title.toUpperCase()}</Text>
                    {section.items.map((item, ii) => (
                      <TouchableOpacity key={ii} style={styles.sidebarItem} onPress={() => handleSidebarNav(item)} activeOpacity={0.7}>
                        <View style={styles.sidebarItemIcon}>
                          <Icon name={item.icon} size={16} color={Colors.primary} />
                        </View>
                        <Text style={styles.sidebarItemLabel}>{item.label}</Text>
                        <Icon name="chevron-right" size={14} color={Colors.textTertiary} />
                      </TouchableOpacity>
                    ))}
                  </View>
                ))}
                <View style={{ height: 24 }} />
              </ScrollView>

              <View style={styles.sidebarFooter}>
                <Icon name="leaf" size={12} color={Colors.primary} />
                <Text style={styles.sidebarFooterTxt}>SportVerse v1.0</Text>
              </View>
            </LinearGradient>
          </Animated.View>
        </Modal>
      )}

      {/* ════ FLOATING HEADER ════════════════════════════════════════════════ */}
      <Animated.View style={[styles.header, { backgroundColor: headerBg, borderBottomColor: headerBorder }]}>
        <SafeAreaView edges={['top']}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={openSidebar} style={styles.menuBtn} activeOpacity={0.7}>
              <Icon name="menu" size={22} color={Colors.textPrimary} />
            </TouchableOpacity>

            <View style={{ flex: 1, paddingLeft: 4 }}>
              <Text style={styles.headerGreeting}>Hey, {user?.name?.split(' ')[0] || 'Cricketer'} 👋</Text>
              <Text style={styles.headerSub}>Ready for a match today?</Text>
            </View>

            <View style={styles.headerActions}>
              <NotificationBell onPress={() => authGuard(() => navigation.navigate('Notifications'))} />
              <TouchableOpacity onPress={() => authGuard(() => navigation.navigate('Profile'))} activeOpacity={0.85}>
                <LinearGradient colors={Colors.gradients?.primary || ['#9abc2f', '#6d8e1f']} style={styles.headerAvatar}>
                  {(myProfile?.photo || user?.photo)
                    ? <Image source={{ uri: getImageUrl(myProfile?.photo || user?.photo) || 'https://via.placeholder.com/150' }} style={StyleSheet.absoluteFill} borderRadius={19} />
                    : <Text style={styles.headerAvatarTxt}>{user?.name?.charAt(0)?.toUpperCase() || 'U'}</Text>}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </Animated.View>

      {/* ════ MAIN CONTENT ══════════════════════════════════════════════════ */}
      <Animated.ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
      >

        {/* ── HERO ── */}
        <Animated.View style={{ transform: [{ translateY: heroParallax }] }}>
          <LinearGradient
            colors={['#000e1c', '#011528', '#0a1e32', '#011528']}
            style={styles.hero}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          >
            {/* Decorative glow orbs */}
            <View style={[styles.glowOrb, { top: -40, right: -40, width: 200, height: 200, backgroundColor: 'rgba(154,188,47,0.05)' }]} />
            <View style={[styles.glowOrb, { bottom: 20, left: -60, width: 180, height: 180, backgroundColor: 'rgba(33,150,243,0.04)' }]} />

            <SafeAreaView edges={['top']}>
              <View style={{ height: 68 }} />
            </SafeAreaView>

            {platformSettings?.bannerUrl ? (
              <View style={styles.bannerWrap}>
                <Image
                  source={{ uri: getImageUrl(platformSettings.bannerUrl) }}
                  style={styles.bannerImg}
                  resizeMode="cover"
                  fadeDuration={300}
                  onError={(e) => {
                    console.log('⚡ [HomeScreen] Banner image load error:', e.nativeEvent?.error, 'URI:', getImageUrl(platformSettings.bannerUrl));
                  }}
                />
              </View>
            ) : null}

            {/* Fallback Hero Header Content (Displayed when no banner or when text header is expected) */}
            {!platformSettings?.bannerUrl && (
              <View style={styles.heroContent}>
                <View style={styles.heroBadge}>
                  <PulseDot />
                  <Text style={styles.heroBadgeTxt}>LIVE MATCHES TODAY</Text>
                </View>
                <Text style={styles.heroTitle}>Find & Book{'\n'}Your Perfect Turf</Text>
                <Text style={styles.heroSub}>Discover top-rated cricket turfs near you</Text>
                <TouchableOpacity onPress={() => navigation.navigate('Search')} activeOpacity={0.85} style={{ alignSelf: 'flex-start' }}>
                  <LinearGradient colors={['#9abc2f', '#799622']} style={styles.heroCTA} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                    <Icon name="magnify" size={16} color="#000" />
                    <Text style={styles.heroCTATxt}>Explore Turfs</Text>
                    <Icon name="arrow-right" size={15} color="#000" />
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}
          </LinearGradient>
        </Animated.View>

        {/* ── STATS (authenticated) ── */}
        {isAuthenticated && (
          <View style={styles.statsRow}>
            {[
              { k: 'bookings', l: 'Bookings', ic: 'calendar-check', c: Colors.primary },
              { k: 'matches', l: 'Matches', ic: 'cricket', c: '#2196F3' },
              { k: 'turfsNear', l: 'Turfs Near', ic: 'map-marker-radius', c: '#FF8F00' },
            ].map((s, i) => (
              <View key={i} style={styles.statCard}>
                <View style={[styles.statIcon, { backgroundColor: s.c + '1A' }]}>
                  <Icon name={s.ic} size={15} color={s.c} />
                </View>
                <Text style={[styles.statVal, { color: s.c }]}>{dashboardStats[s.k] > 99 ? '99+' : dashboardStats[s.k] || 0}</Text>
                <Text style={styles.statLabel}>{s.l}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ── BOOK A TURF ── */}
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <View>
              <Text style={styles.sectionTitle}>Book a Turf</Text>
              <Text style={styles.sectionSub}>{user?.city || myProfile?.city ? `Top picks in ${user?.city || myProfile?.city}` : 'Best turfs near you'}</Text>
            </View>
          </View>

          {/* Hero CTA card */}
          <TouchableOpacity
            onPress={() => navigation.navigate('Search', { screen: 'SearchMain', params: { tab: 'turfs' } })}
            activeOpacity={0.88} style={styles.bookHeroWrap}
          >
            <LinearGradient colors={['#071e0d', '#0d2a10', '#112d14']} style={styles.bookHero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              {/* Shimmer accent line */}
              <View style={styles.bookHeroAccent} />
              <View style={{ flex: 1, gap: 8 }}>
                <View style={styles.instantBadge}>
                  <Icon name="lightning-bolt" size={10} color="#000" />
                  <Text style={styles.instantTxt}>INSTANT BOOKING</Text>
                </View>
                <Text style={styles.bookHeroTitle}>Find & Reserve{'\n'}Your Turf Now</Text>
                <Text style={styles.bookHeroSub}>Browse 50+ turfs · Filter by time & sport</Text>
                <View style={styles.bookHeroCTA}>
                  <Text style={styles.bookHeroCTATxt}>Browse Turfs</Text>
                  <Icon name="arrow-right" size={13} color={Colors.primary} />
                </View>
              </View>
              <View style={styles.bookHeroIconCol}>
                <Icon name="calendar-search" size={58} color={Colors.primary} style={{ opacity: 0.8 }} />
              </View>
            </LinearGradient>
          </TouchableOpacity>

          {/* Quick action chips */}
          <View style={styles.chipRow}>
            {[
              { ic: 'calendar-check-outline', l: 'My Bookings', fn: () => authGuard(() => navigation.navigate('Bookings', { screen: 'BookingHistory' })) },
              { ic: 'heart-outline', l: 'Saved Turfs', fn: () => authGuard(() => navigation.navigate('Profile', { screen: 'Favourites' })) },
              { ic: 'map-marker-radius-outline', l: 'Near Me', fn: () => navigation.navigate('Search', { screen: 'SearchMain', params: { tab: 'turfs' } }) },
            ].map((c, i) => (
              <TouchableOpacity key={i} style={styles.chip} onPress={c.fn} activeOpacity={0.78}>
                <Icon name={c.ic} size={18} color={Colors.primary} />
                <Text style={styles.chipLabel}>{c.l}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── CRICKET ACTIONS GRID ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cricket Hub</Text>
          <Text style={[styles.sectionSub, { marginBottom: 14 }]}>Your quick access to all cricket features</Text>
          <View style={styles.cricketGrid}>
            {CRICKET_ACTIONS.map((a, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => authGuard(() => navigation.navigate(a.tab, a.params))}
                activeOpacity={0.85}
                style={styles.cricketCard}
              >
                <LinearGradient colors={a.gradient} style={styles.cricketCardInner} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                  <View style={styles.cricketIconWrap}>
                    <Icon name={a.icon} size={24} color={Colors.primary} />
                  </View>
                  <Text style={styles.cricketCardLabel}>{a.label}</Text>
                  <Icon name="arrow-top-right" size={13} color={Colors.primary} style={{ opacity: 0.6, alignSelf: 'flex-end' }} />
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── LIVE MATCHES BANNER ── */}
        <View style={styles.section}>
          <TouchableOpacity onPress={() => navigation.navigate('My Cricket', { screen: 'MyCricketMain' })} activeOpacity={0.88}>
            <View style={styles.liveBanner}>
              {/* Red left accent */}
              <View style={styles.liveBannerAccent} />
              <LinearGradient
                colors={['rgba(244,67,54,0.07)', 'transparent']}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
              />
              <View style={{ flex: 1, gap: 6 }}>
                <View style={styles.livePill}>
                  <PulseDot />
                  <Text style={styles.livePillTxt}>LIVE NOW</Text>
                </View>
                <Text style={styles.liveBannerTitle}>Watch Live Matches</Text>
                <Text style={styles.liveBannerSub}>Catch the action from local turfs near you</Text>
              </View>
              <View style={styles.liveArrow}>
                <Icon name="arrow-right" size={20} color={Colors.primary} />
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* ── PLAYERS NEAR YOU ── */}
        {isAuthenticated && nearPlayers?.length > 0 && (
          <View style={{ marginBottom: Spacing['2xl'] }}>
            <View style={styles.sectionHead}>
              <View>
                <Text style={styles.sectionTitle}>Players Near You</Text>
                <Text style={styles.sectionSub}>
                  {user?.city || myProfile?.city ? `Cricketers in ${user?.city || myProfile?.city}` : 'Based on your location'}
                </Text>
              </View>
              <TouchableOpacity style={styles.seeAll} onPress={() => navigation.navigate('Search', { screen: 'SearchMain', params: { tab: 'players' } })}>
                <Text style={styles.seeAllTxt}>See All</Text>
                <Icon name="chevron-right" size={14} color={Colors.primary} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={nearPlayers}
              keyExtractor={it => it._id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: Spacing.xl, gap: 12 }}
              renderItem={renderPlayerCard}
            />
          </View>
        )}

        {/* ── TOP RATED TURFS ── */}
        <View style={{ marginBottom: Spacing['2xl'] }}>
          <View style={styles.sectionHead}>
            <View>
              <Text style={styles.sectionTitle}>Top Rated Turfs</Text>
              <Text style={styles.sectionSub}>Highest rated near you</Text>
            </View>
            <TouchableOpacity style={styles.seeAll} onPress={() => navigation.navigate('Search')}>
              <Text style={styles.seeAllTxt}>See All</Text>
              <Icon name="chevron-right" size={14} color={Colors.primary} />
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <SkeletonPlaceholder backgroundColor={Colors.backgroundElevated} highlightColor={Colors.surfaceVariant}>
              <View style={{ flexDirection: 'row', gap: 14, paddingHorizontal: Spacing.xl }}>
                {[1, 2].map(k => <View key={k} style={{ width: TURF_CARD_W, height: TURF_CARD_H, borderRadius: 20 }} />)}
              </View>
            </SkeletonPlaceholder>
          ) : (
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={turfs}
              keyExtractor={it => it._id}
              renderItem={renderTurfCard}
              contentContainerStyle={{ paddingHorizontal: Spacing.xl, gap: 14 }}
            />
          )}
        </View>

        {/* ── EXPLORE CTA ── */}
        <View style={styles.section}>
          <TouchableOpacity onPress={() => navigation.navigate('Search')} activeOpacity={0.85}>
            <LinearGradient colors={['rgba(154,188,47,0.08)', 'rgba(154,188,47,0.03)']} style={styles.exploreCTA} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <View style={styles.exploreIcon}>
                <Icon name="map-search-outline" size={24} color={Colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.exploreTxt}>Explore All Turfs</Text>
                <Text style={styles.exploreSub}>Filter by location, sport & price</Text>
              </View>
              <View style={styles.exploreArrow}>
                <Icon name="arrow-right" size={16} color={Colors.primary} />
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </View>

      </Animated.ScrollView>
    </View>
  );
};

/* ─── Styles ────────────────────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { paddingBottom: 120 },

  // Glow orb (decorative, no performance impact on RN)
  glowOrb: { position: 'absolute', borderRadius: 999 },

  /* ──── Sidebar ──── */
  sidebarOverlay: { backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 10 },
  sidebar: { position: 'absolute', top: 0, left: 0, bottom: 0, width: SIDEBAR_WIDTH, zIndex: 20 },
  sidebarBody: { flex: 1, paddingBottom: 24 },

  sidebarProfile: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 22, paddingTop: 6, paddingBottom: 16 },
  sidebarAvatar: { width: 54, height: 54, borderRadius: 27, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  sidebarAvatarTxt: { color: '#000', fontFamily: Typography.fontFamily.bold, fontSize: 21 },
  sidebarOnline: { position: 'absolute', bottom: 1, right: 1, width: 12, height: 12, borderRadius: 6, backgroundColor: Colors.success, borderWidth: 2, borderColor: '#011528' },
  sidebarName: { color: Colors.textPrimary, fontFamily: Typography.fontFamily.bold, fontSize: 15 },
  sidebarCityRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 },
  sidebarCityTxt: { color: Colors.textSecondary, fontFamily: Typography.fontFamily.regular, fontSize: 11 },
  sidebarCloseBtn: { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.06)' },

  sidebarStats: { flexDirection: 'row', marginHorizontal: 18, borderRadius: 14, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', marginBottom: 14 },
  sidebarStatCell: { flex: 1, alignItems: 'center', paddingVertical: 12, gap: 4 },
  sidebarStatVal: { fontSize: 17, fontFamily: Typography.fontFamily.bold },
  sidebarStatLbl: { fontSize: 9, color: Colors.textSecondary, fontFamily: Typography.fontFamily.medium },

  sidebarDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.07)', marginHorizontal: 18, marginBottom: 10 },
  sidebarSection: { paddingHorizontal: 18, marginTop: 16 },
  sidebarSectionTitle: { fontSize: 9, color: Colors.textTertiary, fontFamily: Typography.fontFamily.bold, letterSpacing: 1.5, marginBottom: 6, marginLeft: 4 },
  sidebarItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 10, borderRadius: 12 },
  sidebarItemIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(154,188,47,0.08)' },
  sidebarItemLabel: { flex: 1, fontSize: 14, fontFamily: Typography.fontFamily.medium, color: Colors.textPrimary },

  sidebarFooter: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 22, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)', marginHorizontal: 18 },
  sidebarFooterTxt: { fontSize: 11, color: Colors.textTertiary, fontFamily: Typography.fontFamily.regular },

  /* ──── Header ──── */
  header: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100, borderBottomWidth: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 10, gap: 10 },
  menuBtn: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  headerGreeting: { fontSize: 15, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary },
  headerSub: { fontSize: 11, fontFamily: Typography.fontFamily.regular, color: Colors.textSecondary, marginTop: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerAvatar: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  headerAvatarTxt: { color: '#000', fontFamily: Typography.fontFamily.bold, fontSize: 15 },

  /* ──── Hero ──── */
  hero: { paddingBottom: 28, overflow: 'hidden' },
  heroContent: { paddingHorizontal: Spacing.xl, paddingTop: 12, paddingBottom: 8 },
  heroBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(244,67,54,0.12)', alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(244,67,54,0.25)' },
  heroBadgeTxt: { color: Colors.error, fontSize: 10, fontFamily: Typography.fontFamily.bold, letterSpacing: 1 },
  heroTitle: { fontSize: 32, fontFamily: Typography.fontFamily.extraBold, color: Colors.textPrimary, lineHeight: 38, marginBottom: 8 },
  heroSub: { fontSize: 13, color: Colors.textSecondary, fontFamily: Typography.fontFamily.regular, marginBottom: 22 },
  heroCTA: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 22, paddingVertical: 13, borderRadius: 999 },
  heroCTATxt: { color: '#000', fontFamily: Typography.fontFamily.bold, fontSize: 14 },
  bannerWrap: { marginHorizontal: Spacing.lg, borderRadius: BorderRadius.xl, overflow: 'hidden', marginBottom: 12, marginTop: 4, elevation: 4 },
  bannerImg: { width: '100%', height: Math.min(180, SW * 0.42), borderRadius: BorderRadius.xl },

  /* Pulse dot */
  pulseDotWrap: { width: 14, height: 14, justifyContent: 'center', alignItems: 'center' },
  pulseDotOuter: { position: 'absolute', width: 12, height: 12, borderRadius: 6, backgroundColor: 'rgba(244,67,54,0.3)' },
  pulseDotInner: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.error },

  /* ──── Stats Row ──── */
  statsRow: { flexDirection: 'row', marginHorizontal: Spacing.xl, gap: 10, marginTop: -14, marginBottom: 28, zIndex: 2 },
  statCard: { flex: 1, backgroundColor: Colors.backgroundElevated, borderRadius: 14, padding: 13, alignItems: 'center', gap: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', ...Shadows.sm },
  statIcon: { width: 32, height: 32, borderRadius: 9, justifyContent: 'center', alignItems: 'center', marginBottom: 2 },
  statVal: { fontSize: 18, fontFamily: Typography.fontFamily.extraBold },
  statLabel: { fontSize: 9, fontFamily: Typography.fontFamily.medium, color: Colors.textSecondary, textAlign: 'center' },

  /* ──── Sections ──── */
  section: { paddingHorizontal: Spacing.xl, marginBottom: Spacing['2xl'] },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: Spacing.xl, marginBottom: 14 },
  sectionTitle: { fontSize: 19, color: Colors.textPrimary, fontFamily: Typography.fontFamily.bold, marginBottom: 2 },
  sectionSub: { fontSize: 12, color: Colors.textSecondary, fontFamily: Typography.fontFamily.regular },
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingTop: 4 },
  seeAllTxt: { color: Colors.primary, fontFamily: Typography.fontFamily.semiBold, fontSize: 12 },

  /* Book a Turf */
  bookHeroWrap: { borderRadius: 20, overflow: 'hidden', marginBottom: 14, ...Shadows.md },
  bookHero: { flexDirection: 'row', alignItems: 'center', padding: 20, gap: 12, borderWidth: 1, borderColor: 'rgba(154,188,47,0.14)' },
  bookHeroAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 2, backgroundColor: Colors.primary, opacity: 0.5 },
  instantBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: Colors.primary, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 7 },
  instantTxt: { color: '#000', fontSize: 9, fontFamily: Typography.fontFamily.bold, letterSpacing: 0.7 },
  bookHeroTitle: { fontSize: 20, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary, lineHeight: 26 },
  bookHeroSub: { fontSize: 11, color: Colors.textSecondary },
  bookHeroCTA: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  bookHeroCTATxt: { color: Colors.primary, fontSize: 12, fontFamily: Typography.fontFamily.semiBold },
  bookHeroIconCol: {},

  /* Quick chips */
  chipRow: { flexDirection: 'row', gap: 10 },
  chip: { flex: 1, paddingVertical: 14, alignItems: 'center', gap: 7, borderRadius: 14, backgroundColor: Colors.backgroundElevated, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  chipLabel: { fontSize: 10, color: Colors.textSecondary, fontFamily: Typography.fontFamily.semiBold, textAlign: 'center' },

  /* Cricket Grid */
  cricketGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cricketCard: { width: (SW - Spacing.xl * 2 - 10) / 2, borderRadius: 16, overflow: 'hidden', ...Shadows.sm },
  cricketCardInner: { padding: 16, gap: 10, borderWidth: 1, borderColor: 'rgba(154,188,47,0.1)', borderRadius: 16 },
  cricketIconWrap: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(154,188,47,0.1)' },
  cricketCardLabel: { fontSize: 13, fontFamily: Typography.fontFamily.semiBold, color: Colors.textPrimary, lineHeight: 17 },

  /* Live Banner */
  liveBanner: { borderRadius: 18, padding: 18, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)', backgroundColor: Colors.backgroundElevated, overflow: 'hidden', gap: 12 },
  liveBannerAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, backgroundColor: Colors.error },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: 'rgba(244,67,54,0.12)', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(244,67,54,0.22)' },
  livePillTxt: { color: Colors.error, fontSize: 9, fontFamily: Typography.fontFamily.bold, letterSpacing: 1 },
  liveBannerTitle: { fontSize: 16, color: Colors.textPrimary, fontFamily: Typography.fontFamily.bold },
  liveBannerSub: { fontSize: 11, color: Colors.textSecondary },
  liveArrow: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(154,188,47,0.09)', borderWidth: 1, borderColor: 'rgba(154,188,47,0.18)' },

  /* Turf Cards */
  turfCard: { width: TURF_CARD_W, height: TURF_CARD_H, borderRadius: 20, overflow: 'hidden', ...Shadows.md },
  turfImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  turfTopRow: { position: 'absolute', top: 12, left: 12, right: 12, flexDirection: 'row', alignItems: 'flex-start' },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#1565C0', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, alignSelf: 'flex-start' },
  verifiedText: { color: '#FFF', fontSize: 9, fontFamily: Typography.fontFamily.bold },
  ratingPill: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(154,188,47,0.3)' },
  ratingPillText: { color: Colors.primary, fontSize: 10, fontFamily: Typography.fontFamily.bold },
  turfOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 14, gap: 4 },
  turfName: { fontSize: 15, color: '#FFF', fontFamily: Typography.fontFamily.bold },
  turfMeta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  turfMetaText: { fontSize: 11, color: 'rgba(255,255,255,0.65)', fontFamily: Typography.fontFamily.medium, flex: 1 },
  turfSportBadge: { backgroundColor: 'rgba(154,188,47,0.2)', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  turfSportText: { color: Colors.primary, fontSize: 9, fontFamily: Typography.fontFamily.bold },

  /* Player Cards */
  playerCard: { backgroundColor: Colors.backgroundCard, borderRadius: 16, padding: 14, alignItems: 'center', width: 148, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  playerAvatarWrap: { position: 'relative', marginBottom: 10 },
  playerAvatar: { width: 62, height: 62, borderRadius: 31, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  rolePill: { position: 'absolute', bottom: -5, left: '50%', transform: [{ translateX: -18 }], backgroundColor: Colors.primary, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, minWidth: 36, alignItems: 'center' },
  rolePillText: { color: '#000', fontSize: 8, fontFamily: Typography.fontFamily.bold, letterSpacing: 0.5 },
  playerName: { fontSize: 13, fontFamily: Typography.fontFamily.semiBold, color: Colors.textPrimary, textAlign: 'center', marginBottom: 3 },
  playerLocRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 10 },
  playerLocText: { fontSize: 10, color: Colors.textSecondary },
  playerStats: { flexDirection: 'row', width: '100%', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 8, paddingVertical: 8, marginBottom: 10 },
  playerStatCell: { flex: 1, alignItems: 'center' },
  playerStatVal: { fontSize: 13, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary },
  playerStatLbl: { fontSize: 9, color: Colors.textTertiary, marginTop: 1 },
  playerStatDiv: { width: 1, height: 22, backgroundColor: 'rgba(255,255,255,0.08)' },
  followBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 7, borderRadius: 10, backgroundColor: Colors.primary, width: '100%' },
  followingBtn: { backgroundColor: 'rgba(154,188,47,0.1)', borderWidth: 1, borderColor: Colors.primary },
  followBtnText: { fontSize: 11, fontFamily: Typography.fontFamily.semiBold, color: '#000' },
  followingBtnText: { color: Colors.primary },

  /* Explore CTA */
  exploreCTA: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(154,188,47,0.18)' },
  exploreIcon: { width: 46, height: 46, borderRadius: 13, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(154,188,47,0.1)' },
  exploreTxt: { fontSize: 14, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary, marginBottom: 2 },
  exploreSub: { fontSize: 11, color: Colors.textSecondary },
  exploreArrow: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(154,188,47,0.1)' },
});

export default HomeScreen;
