import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, FlatList, Animated, Dimensions, Modal, TouchableWithoutFeedback, RefreshControl
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from '../../../components/SolidGradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useDispatch, useSelector } from 'react-redux';
import { fetchTurfs } from '../../turf/turfSlice';
import { fetchMyPlayer, followPlayer } from '../../player/playerSlice';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../../theme/theme';
import SkeletonPlaceholder from 'react-native-skeleton-placeholder';
import api, { getImageUrl } from '../../../api/axios';
import NotificationBell from '../../../components/NotificationBell';
import PlayerProfileCard from '../../../components/PlayerProfileCard';
import { toggleUserFavourite, setUserFavouriteStatus } from '../../auth/authSlice';
import { PremiumTurfCarousel } from '../components/PremiumTurfCarousel';

const { width: SW, height: SH } = Dimensions.get('window');
const SIDEBAR_WIDTH = SW * 0.80;
const PREMIUM_CARD_W = SW * 0.74;
const PREMIUM_CARD_H = 320;
const OVERLAP_AMOUNT = 40;
const SPACING = PREMIUM_CARD_W - OVERLAP_AMOUNT;

const SIDEBAR_SECTIONS = [
  {
    title: 'Cricket',
    items: [
      { icon: 'cricket', label: 'Score a Match', tab: 'My Cricket', params: { screen: 'MyCricketMain', params: { tab: 'Matches' } } },
      { icon: 'trophy-outline', label: 'Tournaments', tab: 'My Cricket', params: { screen: 'MyCricketMain', params: { tab: 'Tournaments' } } },
      { icon: 'account-group-outline', label: 'My Teams', tab: 'My Cricket', params: { screen: 'MyCricketMain', params: { tab: 'Teams' } } },
      { icon: 'poll', label: 'Leaderboard', tab: 'Home', params: { screen: 'GlobalLeaderboard' } },
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
  { icon: 'cricket', label: 'Score Match', gradient: ['#111111', '#1A1A1A'], tab: 'My Cricket', params: { screen: 'MyCricketMain', params: { tab: 'Matches' } } },
  { icon: 'trophy-outline', label: 'Tournaments', gradient: ['#1A1A1A', '#242424'], tab: 'My Cricket', params: { screen: 'MyCricketMain', params: { tab: 'Tournaments' } } },
  { icon: 'account-group-outline', label: 'My Teams', gradient: ['#111111', '#161616'], tab: 'My Cricket', params: { screen: 'MyCricketMain', params: { tab: 'Teams' } } },
  { icon: 'plus-circle-outline', label: 'New Match', gradient: ['#161616', '#1A1A1A'], tab: 'My Cricket', params: { screen: 'MatchSetup' } },
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
  const scrollX = useRef(new Animated.Value(0)).current;

  const authGuard = (cb) => (!isAuthenticated ? navigation.navigate('AuthModal', { screen: 'Login' }) : cb());
  
  const displayCity = myProfile?.locationObj?.name || myProfile?.city || myProfile?.location || user?.city || '';
  const favourites = user?.favourites?.map(f => typeof f === 'string' ? f : f._id || f) || [];

  const handleToggleFavorite = async (turfId) => {
    dispatch(toggleUserFavourite(turfId));
    try {
      const res = await api.post(`/users/favourites/${turfId}`);
      const status = res.data?.data?.isFavourite;
      if (status !== undefined) dispatch(setUserFavouriteStatus({ id: turfId, isFavourite: status }));
    } catch {
      dispatch(toggleUserFavourite(turfId));
      showCustomAlert('Error', 'Failed to update favourites');
    }
  };

  useEffect(() => {
    if (!isAuthenticated) dispatch(fetchTurfs({ limit: 8, sort: '-rating' }));
    fetchPlatformSettings();
  }, [dispatch, isAuthenticated]);

  useFocusEffect(
    React.useCallback(() => {
      if (!isAuthenticated) return;
      fetchDashboardStats();
      if (!myProfile && user) dispatch(fetchMyPlayer());
      const city = myProfile?.locationObj?.name || myProfile?.city || myProfile?.location || user?.city || '';
      const lat = myProfile?.locationObj?.latitude || user?.latitude;
      const lng = myProfile?.locationObj?.longitude || user?.longitude;
      fetchNearPlayers(city, lat, lng);
      const tp = { limit: 8, sort: '-rating' };
      if (lat && lng) { tp.lat = lat; tp.lng = lng; tp.radius = 50; }
      else if (city) { tp.city = city; }
      dispatch(fetchTurfs(tp));
    }, [dispatch, isAuthenticated, user?._id, user?.city, user?.latitude, user?.longitude, myProfile])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      if (!isAuthenticated) {
        dispatch(fetchTurfs({ limit: 8, sort: '-rating' }));
      } else {
        await fetchDashboardStats();
        if (!myProfile && user) dispatch(fetchMyPlayer());
        const city = myProfile?.locationObj?.name || myProfile?.city || myProfile?.location || user?.city || '';
        const lat = myProfile?.locationObj?.latitude || user?.latitude;
        const lng = myProfile?.locationObj?.longitude || user?.longitude;
        await fetchNearPlayers(city, lat, lng);
        const tp = { limit: 8, sort: '-rating' };
        if (lat && lng) { tp.lat = lat; tp.lng = lng; tp.radius = 50; }
        else if (city) { tp.city = city; }
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
      if (item.tab === 'Home') {
        // For screens within the current HomeStack, use push to ensure it always navigates
        if (item.params?.screen) {
          navigation.push(item.params.screen, item.params.params);
        } else if (item.screen) {
          navigation.push(item.screen);
        } else {
          navigation.navigate(item.tab);
        }
      } else {
        // For other tabs, use navigate to properly switch stacks
        if (item.params) {
          navigation.navigate(item.tab, item.params);
        } else if (item.screen) {
          navigation.navigate(item.screen);
        } else {
          navigation.navigate(item.tab);
        }
      }
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

  const headerBg = scrollY.interpolate({ inputRange: [0, 90], outputRange: ['rgba(0,0,0,0)', 'rgba(0,0,0,0.98)'], extrapolate: 'clamp' });
  const headerBorder = scrollY.interpolate({ inputRange: [60, 100], outputRange: ['rgba(255,255,255,0)', 'rgba(255,255,255,0.08)'], extrapolate: 'clamp' });
  const heroParallax = scrollY.interpolate({ inputRange: [0, 200], outputRange: [0, -50], extrapolate: 'clamp' });
  const MOCK_PLAYERS = [
    { _id: 'm1', image: 'https://i.pinimg.com/736x/8f/c9/77/8fc977e23fa2c30ec75e7a9b0c2e4cc0.jpg', playerName: 'Virat Kohli', role: 'Right Hand Batsman', team: 'Royal Challengers Bengaluru', country: 'India', isCaptain: false, matches: 252, runs: 7971, backgroundColor: '#FFCC00' },
    { _id: 'm2', image: 'https://i.pinimg.com/736x/d6/00/f8/d600f8981504958ce1ba59df182df586.jpg', playerName: 'Rohit Sharma', role: 'Right Hand Batsman', team: 'Mumbai Indians', country: 'India', isCaptain: true, matches: 257, runs: 6628, backgroundColor: '#FFCC00' },
    { _id: 'm3', image: 'https://i.pinimg.com/736x/91/9f/c6/919fc6374f67c06ebf1cf5938dcb9282.jpg', playerName: 'Jasprit Bumrah', role: 'Right Arm Fast', team: 'Mumbai Indians', country: 'India', isCaptain: false, matches: 133, runs: 69, backgroundColor: '#FFCC00' },
    { _id: 'm4', image: 'https://i.pinimg.com/736x/a2/33/c2/a233c2ab5cfbc9d1ebf435015e1281ce.jpg', playerName: 'MS Dhoni', role: 'Wicket Keeper', team: 'Chennai Super Kings', country: 'India', isCaptain: false, matches: 264, runs: 5243, backgroundColor: '#FFCC00' },
    { _id: 'm5', image: 'https://i.pinimg.com/736x/af/b1/7a/afb17af880f074d0e6598f82245b74c5.jpg', playerName: 'KL Rahul', role: 'Right Hand Batsman', team: 'Lucknow Super Giants', country: 'India', isCaptain: true, matches: 132, runs: 4683, backgroundColor: '#FFCC00' },
    { _id: 'm6', image: 'https://i.pinimg.com/736x/6b/af/2d/6baf2dcab14282e4480e0c03dbb7c02b.jpg', playerName: 'Hardik Pandya', role: 'All Rounder', team: 'Mumbai Indians', country: 'India', isCaptain: true, matches: 137, runs: 2525, backgroundColor: '#FFCC00' },
    { _id: 'm7', image: 'https://i.pinimg.com/736x/ee/75/a3/ee75a31b4ab4b60e6e88e7343e8bb435.jpg', playerName: 'Shubman Gill', role: 'Right Hand Batsman', team: 'Gujarat Titans', country: 'India', isCaptain: true, matches: 103, runs: 3216, backgroundColor: '#FFCC00' },
    { _id: 'm8', image: 'https://i.pinimg.com/736x/b2/d4/07/b2d407fcf8f0d9b4c09264c781ab1d92.jpg', playerName: 'Suryakumar Yadav', role: 'Right Hand Batsman', team: 'Mumbai Indians', country: 'India', isCaptain: false, matches: 150, runs: 3594, backgroundColor: '#FFCC00' },
    { _id: 'm9', image: 'https://i.pinimg.com/736x/32/db/38/32db38883cc065e1ebfffaad3c4ed7b8.jpg', playerName: 'Mohammed Shami', role: 'Right Arm Fast', team: 'Gujarat Titans', country: 'India', isCaptain: false, matches: 110, runs: 75, backgroundColor: '#FFCC00' },
    { _id: 'm10', image: 'https://i.pinimg.com/736x/f0/6d/27/f06d27a4d5e751249b6b772cb52ed492.jpg', playerName: 'Ravindra Jadeja', role: 'All Rounder', team: 'Chennai Super Kings', country: 'India', isCaptain: false, matches: 240, runs: 2959, backgroundColor: '#FFCC00' }
  ];

  /* ─── Player Card ───────────────────────────────────────────────────────── */
  const renderPlayerCard = ({ item }) => {
    // If it's a mock player, render it directly
    if (item._id && item._id.toString().startsWith('m')) {
      return (
        <PlayerProfileCard
          {...item}
          onPress={() => {}}
        />
      );
    }

    // Map database user to PlayerProfileCard props
    const photo = item.photo || item.userId?.photo;
    const runs = item.career?.batting?.runs || item.batting?.runs || 0;
    const matches = item.career?.matches || item.matches || 0;

    return (
      <PlayerProfileCard
        image={photo ? getImageUrl(photo) : require('../../../../SportVerse.png')}
        playerName={item.name || item.userId?.name || 'Player'}
        role={item.playingRole || 'Cricketer'}
        team={item.location || item.city || item.userId?.city || 'India'}
        // country={item.country || 'India'}
        // isCaptain={item.isCaptain || false}
        matches={matches}
        runs={runs}
        backgroundColor="#ffcc00ed"
        onPress={() => navigation.navigate('PlayerDetail', { id: item._id })}
      />
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
            <LinearGradient colors={['#000000', '#0A0A0A', '#000000']} style={styles.sidebarBody}>
              <SafeAreaView edges={['top']}>
                {/* ── Profile ── */}
                <View style={styles.sidebarProfile}>
                  <View>
                    <LinearGradient colors={Colors.gradients?.primary || ['#FFCC00', '#E6B800']} style={styles.sidebarAvatar}>
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
                <Text style={styles.sidebarFooterTxt}>ScoreVerse v1.0</Text>
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
              <Text style={styles.headerGreeting} numberOfLines={1} ellipsizeMode="tail">Hey, {user?.name?.split(' ')[0] || 'Cricketer'}</Text>
            </View>

            <View style={styles.headerActions}>
              <NotificationBell onPress={() => authGuard(() => navigation.navigate('Notifications'))} />
              <TouchableOpacity onPress={() => authGuard(() => navigation.navigate('Profile'))} activeOpacity={0.85}>
                <LinearGradient colors={Colors.gradients?.primary || ['#FFCC00', '#E6B800']} style={styles.headerAvatar}>
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
            colors={['#000000', '#000000', '#050505', '#000000']}
            style={styles.hero}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          >
            {/* Decorative glow orbs */}
            <View style={[styles.glowOrb, { top: -40, right: -40, width: 200, height: 200, backgroundColor: 'rgba(255,204,0,0.05)' }]} />
            <View style={[styles.glowOrb, { bottom: 20, left: -60, width: 180, height: 180, backgroundColor: 'rgba(255,204,0,0.04)' }]} />

            <SafeAreaView edges={['top']}>
              <View style={{ height: 68 }} />
            </SafeAreaView>

            <View style={[styles.bannerWrap, { width: SW * 0.88, aspectRatio: 1983 / 793, alignSelf: 'center' }]}>
              <Image
                source={require('../../../../Banner.png')}
                style={{ width: '100%', height: '100%' }}
                resizeMode="cover"
                fadeDuration={300}
              />
            </View>
          </LinearGradient>
        </Animated.View>

        {/* ── STATS (authenticated) ── */}
        {/* {isAuthenticated && (
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
        )} */}

        {/* ── BOOK A TURF ── */}
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <View>
              <Text style={styles.sectionTitle}>Book a Turf</Text>
              <Text style={[styles.sectionSub, { marginLeft: -0.5 }]}>{displayCity ? `Top picks in ${displayCity.trim()}` : 'Best turfs near you'}</Text>
            </View>
          </View>

          {/* Hero CTA card */}
          <TouchableOpacity
            onPress={() => navigation.navigate('Search', { screen: 'SearchMain', params: { tab: 'turfs' } })}
            activeOpacity={0.88} style={styles.bookHeroWrap}
          >
            <LinearGradient colors={['#050505', '#0A0A0A', '#0F0F0F']} style={styles.bookHero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              {/* Shimmer accent line */}
              <View style={styles.bookHeroAccent} />
              <View style={{ flex: 1, gap: 8 }}>
                {/* <View style={styles.instantBadge}>
                  <Icon name="lightning-bolt" size={10} color="#000" />
                  <Text style={styles.instantTxt}>INSTANT BOOKING</Text>
                </View> */}
                <Text style={styles.bookHeroTitle}>Find & Reserve{'\n'}Your Turf Now</Text>
                <Text style={styles.bookHeroSub}>Browse 50+ turfs · Filter by time & sport</Text>
                <View style={styles.bookHeroCTA}>
                  <Text style={styles.bookHeroCTATxt}>Browse Turfs</Text>
                  <Icon name="arrow-right" size={13} color={Colors.primary} />
                </View>
              </View>
              <View style={styles.bookHeroIconCol}>
                <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(154,188,47,0.1)', justifyContent: 'center', alignItems: 'center' }}>
                  <Icon name="calendar-search" size={34} color={Colors.primary} />
                  
                  {/* Floating icons for enhancement */}
                  <View style={{ position: 'absolute', top: -4, right: -4, backgroundColor: Colors.backgroundElevated, borderRadius: 14, padding: 5, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
                     <Icon name="map-marker-radius" size={14} color={Colors.primary} />
                  </View>
                  <View style={{ position: 'absolute', bottom: -2, left: -2, backgroundColor: Colors.backgroundElevated, borderRadius: 14, padding: 5, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
                     <Icon name="soccer" size={14} color={Colors.primary} />
                  </View>
                </View>
              </View>
            </LinearGradient>
          </TouchableOpacity>

          {/* Quick action chips */}
          <View style={styles.chipRow}>
            {[
              { ic: 'calendar-check', l: 'My Bookings', fn: () => authGuard(() => navigation.navigate('Bookings', { screen: 'BookingHistory' })) },
              { ic: 'heart', l: 'Saved Turfs', fn: () => authGuard(() => navigation.navigate('Profile', { screen: 'Favourites' })) },
              { ic: 'map-marker-radius', l: 'Near Me', fn: () => navigation.navigate('Search', { screen: 'SearchMain', params: { tab: 'turfs' } }) },
            ].map((c, i) => (
              <TouchableOpacity key={i} style={styles.chip} onPress={c.fn} activeOpacity={0.78}>
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(154,188,47,0.15)', justifyContent: 'center', alignItems: 'center', marginBottom: 2 }}>
                  <Icon name={c.ic} size={18} color={Colors.primary} />
                </View>
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
                    <Icon name={a.icon} size={18} color={Colors.primary} />
                  </View>
                  <Text style={styles.cricketCardLabel} numberOfLines={1}>{a.label}</Text>
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
                colors={['rgba(255,204,0,0.07)', 'transparent']}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
              />
              <View style={{ flex: 1, gap: 6 }}>
                <View style={styles.livePill}>
                  <PulseDot />
                  <Text style={styles.livePillTxt}>LIVE</Text>
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
        {isAuthenticated && (
          <View style={{ marginBottom: Spacing['2xl'] }}>
            <View style={styles.sectionHead}>
              <View>
                <Text style={styles.sectionTitle}>Players Near You</Text>
                <Text style={styles.sectionSub}>{displayCity ? `Cricketers in ${displayCity.trim()}` : 'Based on your location'}</Text>
              </View>
              <TouchableOpacity style={styles.seeAll} onPress={() => navigation.navigate('Search', { screen: 'SearchMain', params: { tab: 'players' } })}>
                <Text style={styles.seeAllTxt}>See All</Text>
                <Icon name="chevron-right" size={14} color={Colors.primary} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={nearPlayers?.length > 0 ? nearPlayers : MOCK_PLAYERS}
              keyExtractor={it => it._id || it.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: Spacing.xl, gap: 16 }}
              snapToInterval={260 + 16}
              snapToAlignment="start"
              decelerationRate="fast"
              pagingEnabled={false}
              initialNumToRender={4}
              maxToRenderPerBatch={4}
              windowSize={5}
              removeClippedSubviews={false}
              renderItem={renderPlayerCard}
            />
          </View>
        )}

        {/* ── TOP RATED TURFS ── */}
        <View style={{ marginBottom: Spacing['2xl'] }}>
          <View style={styles.sectionHead}>
            <View>
              <Text style={styles.sectionTitle}>Top Rated Grounds</Text>
              <Text style={styles.sectionSub}>
                {displayCity ? `Highest rated turfs in ${displayCity.trim()}` : 'Highest rated near you'}
              </Text>
            </View>
            <TouchableOpacity style={styles.seeAll} onPress={() => navigation.navigate('Search')}>
              <Text style={styles.seeAllTxt}>See All</Text>
              <Icon name="chevron-right" size={14} color={Colors.primary} />
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <SkeletonPlaceholder backgroundColor={Colors.backgroundElevated} highlightColor={Colors.surfaceVariant}>
              <View style={{ flexDirection: 'row', gap: 14, paddingHorizontal: (SW - PREMIUM_CARD_W) / 2 }}>
                {[1, 2].map(k => <View key={k} style={{ width: PREMIUM_CARD_W, height: PREMIUM_CARD_H, borderRadius: 24 }} />)}
              </View>
            </SkeletonPlaceholder>
          ) : (
            <PremiumTurfCarousel 
              data={turfs} 
              onTurfPress={(id) => navigation.navigate('TurfDetail', { id })} 
              onFavoriteToggle={handleToggleFavorite} 
              favourites={favourites} 
            />
          )}
        </View>

        {/* ── EXPLORE CTA ── */}
        <View style={styles.section}>
          <TouchableOpacity onPress={() => navigation.navigate('Search')} activeOpacity={0.85}>
            <LinearGradient colors={['rgba(255,204,0,0.08)', 'rgba(255,204,0,0.03)']} style={styles.exploreCTA} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <View style={styles.exploreIcon}>
                <Icon name="map-search-outline" size={24} color={Colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.exploreTxt}>Explore All Grounds</Text>
                <Text style={styles.exploreSub}>Filter by location & price</Text>
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
  sidebarOnline: { position: 'absolute', bottom: 1, right: 1, width: 12, height: 12, borderRadius: 6, backgroundColor: Colors.success, borderWidth: 2, borderColor: '#000000' },
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
  headerGreeting: { fontSize: 20, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary },
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
  bannerWrap: { marginHorizontal: Spacing.lg, borderRadius: BorderRadius.xl, overflow: 'hidden', marginBottom: 0, marginTop: 4, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, borderWidth: 1, borderColor: Colors.border },
  bannerImg: { width: '100%', height: '100%', borderRadius: BorderRadius.xl },

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
  bookHeroWrap: {overflow: 'hidden', marginBottom: 14, ...Shadows.md },
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
  cricketCardInner: { flexDirection: 'row', alignItems: 'center', padding: 12, paddingHorizontal: 14, gap: 10, borderWidth: 1, borderColor: 'rgba(154,188,47,0.1)', borderRadius: 16 },
  cricketIconWrap: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(154,188,47,0.1)' },
  cricketCardLabel: { flex: 1, fontSize: 13, fontFamily: Typography.fontFamily.semiBold, color: Colors.textPrimary },

  /* Live Banner */
  liveBanner: { borderRadius: 18, padding: 18, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)', backgroundColor: Colors.backgroundElevated, overflow: 'hidden', gap: 12 },
  liveBannerAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, backgroundColor: Colors.primary },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: 'rgba(255,204,0,0.12)', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,204,0,0.22)' },
  livePillTxt: { color: Colors.primary, fontSize: 9, fontFamily: Typography.fontFamily.bold, letterSpacing: 1 },
  liveBannerTitle: { fontSize: 16, color: Colors.textPrimary, fontFamily: Typography.fontFamily.bold },
  liveBannerSub: { fontSize: 11, color: Colors.textSecondary },
  liveArrow: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,204,0,0.09)', borderWidth: 1, borderColor: 'rgba(255,204,0,0.18)' },

  /* Premium Turf Cards Stack */
  premiumCardContainer: {
    width: SPACING,
    height: PREMIUM_CARD_H,
    justifyContent: 'center',
    alignItems: 'center',
  },
  premiumCard: {
    width: PREMIUM_CARD_W,
    height: PREMIUM_CARD_H,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
  },
  premiumCardImage: {
    position: 'absolute',
    left: -25,
    top: 0,
    bottom: 0,
    width: PREMIUM_CARD_W + 50,
    height: '100%',
    resizeMode: 'cover',
  },
  premiumTopRow: {
    position: 'absolute',
    top: 14,
    left: 14,
    right: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  statusBadgeCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  statusDotGreen: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2ED573',
    marginRight: 5,
  },
  statusTextCompact: {
    color: '#FFFFFF',
    fontSize: 8,
    fontFamily: Typography.fontFamily.bold,
    letterSpacing: 0.5,
  },
  topRatedBadgeCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFCC00',
  },
  topRatedTextCompact: {
    color: '#FFCC00',
    fontSize: 8,
    fontFamily: Typography.fontFamily.bold,
    letterSpacing: 0.5,
  },
  glassOverlay: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    borderRadius: 18,
    padding: 12,
    backgroundColor: 'rgba(17, 17, 17, 0.82)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  glassHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  glassTitle: {
    color: '#FFFFFF',
    fontFamily: Typography.fontFamily.bold,
    fontSize: 15,
    flex: 1,
    marginRight: 8,
  },
  ratingBadgeGold: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFCC00',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 2,
  },
  ratingTextGold: {
    color: '#000000',
    fontSize: 10,
    fontFamily: Typography.fontFamily.bold,
  },
  glassLocation: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontFamily: Typography.fontFamily.medium,
    fontSize: 10,
    marginBottom: 10,
  },
  glassFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  priceContainer: {
    flexDirection: 'column',
  },
  priceLabel: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 8,
    fontFamily: Typography.fontFamily.medium,
    textTransform: 'uppercase',
  },
  priceValue: {
    color: '#FFFFFF',
    fontFamily: Typography.fontFamily.bold,
    fontSize: 14,
  },
  priceUnit: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 10,
    fontFamily: Typography.fontFamily.medium,
  },
  sportsIconRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  sportIconCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255, 204, 0, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 204, 0, 0.2)',
  },
  bookNowBtnCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFCC00',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 2,
  },
  bookNowTextCompact: {
    color: '#000000',
    fontFamily: Typography.fontFamily.bold,
    fontSize: 11,
  },

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

const TurfCardImage = ({ item, imageTranslateX }) => {
  const [imgError, setImgError] = useState(false);
  const uri = getImageUrl(item.coverImage);
  const fallback = 'https://via.placeholder.com/400x300?text=Turf';

  return (
    <Animated.Image
      source={{ uri: (imgError || !uri) ? fallback : uri }}
      onError={() => setImgError(true)}
      style={[
        styles.premiumCardImage,
        { transform: [{ translateX: imageTranslateX }] }
      ]}
    />
  );
};

export default HomeScreen;
