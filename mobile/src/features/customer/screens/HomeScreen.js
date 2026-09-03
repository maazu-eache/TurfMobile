import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useTheme } from '../../../theme/ThemeContext';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, FlatList, Animated, Dimensions, Modal, TouchableWithoutFeedback, RefreshControl
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
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
import AppUpdateBanner from '../../../components/common/AppUpdateBanner';
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

const HomeScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors, shadows, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, shadows, isDark, insets), [colors, shadows, isDark, insets]);

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


  const dispatch = useDispatch();
  const { turfs, isLoading } = useSelector(s => s.turf);
  const { user, isAuthenticated } = useSelector(s => s.auth);
  const { myProfile } = useSelector(s => s.player || {});
  const [platformSettings, setPlatformSettings] = useState(null);
  const [dashboardStats, setDashboardStats] = useState({ bookings: 0, matches: 0, turfsNear: 0 });
  const [nearPlayers, setNearPlayers] = useState([]);
  const [liveMatches, setLiveMatches] = useState([]);
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

  const fetchLiveMatches = async (city, lat, lng) => {
    try {
      if (isAuthenticated) {
        const nearbyParams = { filterType: 'nearby', status: 'live', limit: 10 };
        if (lat && lng) {
          nearbyParams.lat = lat;
          nearbyParams.lng = lng;
        } else if (city) {
          nearbyParams.city = city;
        }

        const [nearbyRes, networkRes] = await Promise.allSettled([
          api.get('/matches/my-matches', { params: nearbyParams }),
          api.get('/matches/my-matches', { params: { filterType: 'network', status: 'live', limit: 10 } }),
        ]);

        const nearbyList = nearbyRes.status === 'fulfilled' ? (nearbyRes.value?.data?.data || []) : [];
        const networkList = networkRes.status === 'fulfilled' ? (networkRes.value?.data?.data || []) : [];

        // Deduplicate matches by _id
        const combined = [...nearbyList, ...networkList];
        const uniqueMatches = [];
        const seenIds = new Set();
        combined.forEach(m => {
          const id = m?._id || m?.id;
          if (id && !seenIds.has(String(id))) {
            seenIds.add(String(id));
            uniqueMatches.push(m);
          }
        });

        setLiveMatches(uniqueMatches);
      } else {
        const params = { status: 'in_progress', limit: 10 };
        if (lat && lng) {
          params.lat = lat;
          params.lng = lng;
        } else if (city) {
          params.city = city;
        }
        const res = await api.get('/matches', { params });
        const list = res.data?.data || [];
        setLiveMatches(list);
      }
    } catch (err) {
      console.log('Error fetching live matches for banner:', err?.message);
    }
  };

  useEffect(() => {
    const city = myProfile?.locationObj?.name || myProfile?.city || myProfile?.location || user?.city || '';
    const lat = myProfile?.locationObj?.latitude || user?.latitude;
    const lng = myProfile?.locationObj?.longitude || user?.longitude;
    if (!isAuthenticated) {
      dispatch(fetchTurfs({ limit: 8, sort: '-rating' }));
    }
    fetchPlatformSettings();
    fetchLiveMatches(city, lat, lng);
  }, [dispatch, isAuthenticated, user?.city, user?.latitude, user?.longitude, myProfile]);

  useFocusEffect(
    React.useCallback(() => {
      const city = myProfile?.locationObj?.name || myProfile?.city || myProfile?.location || user?.city || '';
      const lat = myProfile?.locationObj?.latitude || user?.latitude;
      const lng = myProfile?.locationObj?.longitude || user?.longitude;

      fetchLiveMatches(city, lat, lng);

      if (!isAuthenticated) return;
      fetchDashboardStats();
      if (!myProfile && user) dispatch(fetchMyPlayer());
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
      const city = myProfile?.locationObj?.name || myProfile?.city || myProfile?.location || user?.city || '';
      const lat = myProfile?.locationObj?.latitude || user?.latitude;
      const lng = myProfile?.locationObj?.longitude || user?.longitude;

      const livePromise = fetchLiveMatches(city, lat, lng);

      if (!isAuthenticated) {
        dispatch(fetchTurfs({ limit: 8, sort: '-rating' }));
      } else {
        await fetchDashboardStats();
        if (!myProfile && user) dispatch(fetchMyPlayer());
        await fetchNearPlayers(city, lat, lng);
        const tp = { limit: 8, sort: '-rating' };
        if (lat && lng) { tp.lat = lat; tp.lng = lng; tp.radius = 50; }
        else if (city) { tp.city = city; }
        dispatch(fetchTurfs(tp));
      }
      await Promise.allSettled([fetchPlatformSettings(), livePromise]);
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

  const headerBg = scrollY.interpolate({ inputRange: [0, 90], outputRange: isDark ? ['rgba(0,0,0,0)', 'rgba(0,0,0,0.98)'] : ['rgba(255,255,255,0)', 'rgba(255,255,255,0.98)'], extrapolate: 'clamp' });
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
        team={item.locationObj?.name || item.location || item.city || item.userId?.city || 'India'}
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
            <LinearGradient colors={isDark ? ['#000000', '#0A0A0A', '#000000'] : [colors.surface, colors.background, colors.surface]} style={styles.sidebarBody}>
              <SafeAreaView edges={['top']}>
                {/* ── Profile ── */}
                <View style={styles.sidebarProfile}>
                  <View>
                    <LinearGradient colors={Colors.gradients?.primary || ['#FFCC00', '#E6B800']} style={styles.sidebarAvatar}>
                      {(myProfile?.photo || user?.photo)
                        ? <Image source={{ uri: getImageUrl(myProfile?.photo || user?.photo) || 'https://via.placeholder.com/150' }} style={StyleSheet.absoluteFill} borderRadius={28} />
                        : user?.name
                          ? <Text style={styles.sidebarAvatarTxt}>{user.name.charAt(0).toUpperCase()}</Text>
                          : <Icon name="account" size={28} color="#000" />
                      }
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
                    <Icon name="close" size={17} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                {/* ── Mini Stats ── */}
                <View style={styles.sidebarStats}>
                  {[
                    { k: 'bookings', l: 'Bookings', ic: 'calendar-check', c: Colors.primary },
                    { k: 'matches', l: 'Matches', ic: 'cricket', c: '#2196F3' },
                    { k: 'turfsNear', l: 'Near Me', ic: 'map-marker-radius', c: '#FF8F00' },
                  ].map((s, i) => (
                    <View key={i} style={[styles.sidebarStatCell, i < 2 && { borderRightWidth: 1, borderRightColor: colors.borderLight }]}>
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
                        <Icon name="chevron-right" size={14} color={colors.textTertiary} />
                      </TouchableOpacity>
                    ))}
                  </View>
                ))}
                <View style={{ height: 24 }} />
              </ScrollView>

              {/* <View style={styles.sidebarFooter}>
                <Icon name="leaf" size={12} color={Colors.primary} />
                <Text style={styles.sidebarFooterTxt}>ScoreVerse v1.0</Text>
              </View> */}
            </LinearGradient>
          </Animated.View>
        </Modal>
      )}

      {/* ════ FLOATING HEADER ════════════════════════════════════════════════ */}
      <Animated.View style={[styles.header, { backgroundColor: headerBg, borderBottomColor: headerBorder }]}>
        <SafeAreaView edges={['top']}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={openSidebar} style={styles.menuBtn} activeOpacity={0.7}>
              <Icon name="menu" size={22} color={colors.textPrimary} />
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
                    : user?.name
                      ? <Text style={styles.headerAvatarTxt}>{user.name.charAt(0).toUpperCase()}</Text>
                      : <Icon name="account" size={20} color="#000" />
                  }
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

        {/* ── TOP SEARCH & LOCATION BAR ── */}
        <View style={styles.topSearchSection}>
          <TouchableOpacity
            style={styles.searchBarCard}
            onPress={() => navigation.navigate('Search')}
            activeOpacity={0.88}
          >
            <View style={styles.searchBarLeft}>
              <View style={styles.searchIconBubble}>
                <Icon name="magnify" size={18} color={Colors.primary} />
              </View>
              <Text style={styles.searchBarPlaceholder}>Search turfs, matches, tournaments...</Text>
            </View>
            <View style={styles.locationChip}>
              <Icon name="map-marker" size={12} color={isDark ? Colors.primary : '#8A6D00'} />
              <Text style={styles.locationChipText} numberOfLines={1}>{displayCity ? displayCity.trim() : 'Location'}</Text>
            </View>
          </TouchableOpacity>
        </View>

        <AppUpdateBanner />

        {/* ── SECTION 1: CRICKET HUB ── */}
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <View style={styles.sectionTitleRow}>
              <View style={styles.sectionBadge}>
                <Icon name="cricket" size={16} color={Colors.primary} />
              </View>
              <View>
                <Text style={styles.sectionTitle}>Cricket Hub</Text>
                <Text style={styles.sectionSub}>Quick access to matches, scoring & teams</Text>
              </View>
            </View>
          </View>
          <View style={styles.cricketGrid}>
            {CRICKET_ACTIONS.map((a, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => authGuard(() => navigation.navigate(a.tab, a.params))}
                activeOpacity={0.85}
                style={styles.cricketCard}
              >
                <View style={styles.cricketCardInner}>
                  <View style={styles.cricketIconWrap}>
                    <Icon name={a.icon} size={20} color={Colors.primary} />
                  </View>
                  <Text style={styles.cricketCardLabel} numberOfLines={1}>{a.label}</Text>
                  <Icon name="chevron-right" size={14} color={colors.textTertiary} />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── SECTION 2: TOP RATED GROUNDS ── */}
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <View style={styles.sectionTitleRow}>
              <View style={styles.sectionBadge}>
                <Icon name="trophy-outline" size={16} color={Colors.primary} />
              </View>
              <View>
                <Text style={styles.sectionTitle}>Top Rated Grounds</Text>
                <Text style={styles.sectionSub}>
                  {displayCity ? `Highest rated turfs in ${displayCity.trim()}` : 'Highest rated near you'}
                </Text>
              </View>
            </View>
            <TouchableOpacity style={styles.seeAll} onPress={() => navigation.navigate('Search')}>
              <Text style={styles.seeAllTxt}>See All</Text>
              <Icon name="chevron-right" size={14} color={isDark ? Colors.primary : colors.primaryDark} />
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <SkeletonPlaceholder backgroundColor={isDark ? colors.backgroundElevated : colors.surfaceVariant} highlightColor={colors.surfaceVariant}>
              <View style={{ flexDirection: 'row', gap: 14 }}>
                {[1, 2].map(k => <View key={k} style={{ width: PREMIUM_CARD_W, height: PREMIUM_CARD_H, borderRadius: 24 }} />)}
              </View>
            </SkeletonPlaceholder>
          ) : !turfs || turfs.length === 0 ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconBubble}>
                <Icon name="map-marker-off-outline" size={22} color={isDark ? Colors.primary : colors.primaryDark} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.emptyTitle}>No Turfs in {displayCity ? displayCity.trim() : 'Your Area'}</Text>
                <Text style={styles.emptySub}>
                  Browse all available turfs and grounds across other cities.
                </Text>
                <TouchableOpacity
                  style={styles.emptyActionBtn}
                  onPress={() => navigation.navigate('Search', { screen: 'SearchMain', params: { tab: 'turfs' } })}
                  activeOpacity={0.8}
                >
                  <Text style={styles.emptyActionText}>Explore Turfs</Text>
                  {/* <Icon name="arrow-right" size={12} color={isDark ? Colors.primary : colors.primaryDark} /> */}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={{ marginHorizontal: -16 }}>
              <PremiumTurfCarousel 
                data={turfs} 
                onTurfPress={(id) => navigation.navigate('TurfDetail', { id })} 
                onFavoriteToggle={handleToggleFavorite} 
                favourites={favourites} 
              />
            </View>
          )}
        </View>

        {/* ── SECTION 3: BOOK A TURF ── */}
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <View style={styles.sectionTitleRow}>
              <View style={styles.sectionBadge}>
                <Icon name="calendar-check-outline" size={16} color={Colors.primary} />
              </View>
              <View>
                <Text style={styles.sectionTitle}>Book a Turf</Text>
                <Text style={styles.sectionSub}>{displayCity ? `Top picks in ${displayCity.trim()}` : 'Best turfs near you'}</Text>
              </View>
            </View>
          </View>

          {/* Hero CTA card */}
          <TouchableOpacity
            onPress={() => navigation.navigate('Search', { screen: 'SearchMain', params: { tab: 'turfs' } })}
            activeOpacity={0.88}
            style={styles.bookHeroWrap}
          >
            <LinearGradient
              colors={isDark ? ['#050505', '#0A0A0A', '#0F0F0F'] : [colors.surface, colors.surfaceVariant, colors.surface]}
              style={styles.bookHero}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.bookHeroAccent} />
              <View style={{ flex: 1, gap: 8 }}>
                <Text style={styles.bookHeroTitle}>Find & Reserve{'\n'}Your Turf Now</Text>
                <View style={styles.bookHeroCTA}>
                  <Text style={styles.bookHeroCTATxt}>Browse Turfs</Text>
                  <Icon name="arrow-right" size={13} color={Colors.primary} />
                </View>
              </View>
              <View style={styles.bookHeroIconCol}>
                <View style={{ width: 68, height: 68, borderRadius: 34, backgroundColor: isDark ? 'rgba(255,204,0,0.1)' : '#FFF9D6', justifyContent: 'center', alignItems: 'center' }}>
                  <Icon name="calendar-search" size={32} color={Colors.primary} />
                  <View style={{ position: 'absolute', top: -4, right: -4, backgroundColor: colors.surface, borderRadius: 12, padding: 4, borderWidth: 1, borderColor: colors.border }}>
                     <Icon name="map-marker-radius" size={12} color={Colors.primary} />
                  </View>
                  <View style={{ position: 'absolute', bottom: -2, left: -2, backgroundColor: colors.surface, borderRadius: 12, padding: 4, borderWidth: 1, borderColor: colors.border }}>
                     <Icon name="soccer" size={12} color={Colors.primary} />
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
                <View style={styles.chipIconBubble}>
                  <Icon name={c.ic} size={18} color={Colors.primary} />
                </View>
                <Text style={styles.chipLabel} numberOfLines={1}>{c.l}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── SECTION 4: PLAYERS NEAR YOU ── */}
        {isAuthenticated && (
          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <View style={styles.sectionTitleRow}>
                <View style={styles.sectionBadge}>
                  <Icon name="account-group-outline" size={16} color={Colors.primary} />
                </View>
                <View>
                  <Text style={styles.sectionTitle}>Players Near You</Text>
                  <Text style={styles.sectionSub}>{displayCity ? `Cricketers in ${displayCity.trim()}` : 'Based on your location'}</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.seeAll} onPress={() => navigation.navigate('Search', { screen: 'SearchMain', params: { tab: 'players' } })}>
                <Text style={styles.seeAllTxt}>See All</Text>
                <Icon name="chevron-right" size={14} color={isDark ? Colors.primary : colors.primaryDark} />
              </TouchableOpacity>
            </View>

            {(!nearPlayers || nearPlayers.length === 0) ? (
              <View style={styles.emptyCard}>
                <View style={styles.emptyIconBubble}>
                  <Icon name="account-search-outline" size={22} color={isDark ? Colors.primary : colors.primaryDark} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.emptyTitle}>No Players in {displayCity ? displayCity.trim() : 'Your Area'}</Text>
                  <Text style={styles.emptySub}>
                    Connect with players or search the global cricket community.
                  </Text>
                  <TouchableOpacity
                    style={styles.emptyActionBtn}
                    onPress={() => navigation.navigate('Search', { screen: 'SearchMain', params: { tab: 'players' } })}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.emptyActionText}>Explore Players</Text>
                    {/* <Icon name="arrow-right" size={12} color={isDark ? Colors.primary : colors.primaryDark} /> */}
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={{ marginHorizontal: -16 }}>
                <FlatList
                  data={nearPlayers}
                  keyExtractor={it => it._id || it.id}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: 16, gap: 14 }}
                  snapToInterval={260 + 14}
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
          </View>
        )}

        {/* ── LIVE MATCHES BANNER (Displayed only when nearby/network has live matches) ── */}
        {liveMatches?.length > 0 && (
          <View style={styles.section}>
            <TouchableOpacity
              onPress={() => navigation.navigate('My Cricket', { screen: 'MyCricketMain', params: { tab: 'Matches' } })}
              activeOpacity={0.88}
            >
              <View style={styles.liveBanner}>
                {/* Red left accent */}
                <View style={styles.liveBannerAccent} />
                <LinearGradient
                  colors={['rgba(255,204,0,0.07)', 'transparent']}
                  style={StyleSheet.absoluteFill}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                />
                <View style={{ flex: 1, gap: 6 }}>
                  <View style={styles.livePill}>
                    <PulseDot />
                    <Text style={styles.livePillTxt}>LIVE ({liveMatches.length})</Text>
                  </View>
                  <Text style={styles.liveBannerTitle}>
                    {liveMatches.length === 1 && liveMatches[0]?.teamA?.name && liveMatches[0]?.teamB?.name
                      ? `${liveMatches[0].teamA.name} vs ${liveMatches[0].teamB.name}`
                      : 'Watch Live Matches'}
                  </Text>
                  <Text style={styles.liveBannerSub}>
                    {liveMatches.length === 1
                      ? 'Live match in progress — Tap to watch'
                      : `${liveMatches.length} live matches running in your area & network`}
                  </Text>
                </View>
                <View style={styles.liveArrow}>
                  <Icon name="arrow-right" size={20} color={Colors.primary} />
                </View>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* ── EXPLORE CTA ── */}
        {/* <View style={styles.section}>
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
        </View> */}

      </Animated.ScrollView>
    </View>
  );
};

/* ─── Styles ────────────────────────────────────────────────────────────────── */
const createStyles = (colors, shadows, isDark, insets) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingBottom: 120 },

  // Glow orb (decorative, no performance impact on RN)
  glowOrb: { position: 'absolute', borderRadius: 999 },

  /* ──── Sidebar ──── */
  sidebarOverlay: { backgroundColor: 'rgba(0,0,0,0.65)', zIndex: 10 },
  sidebar: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: SIDEBAR_WIDTH,
    zIndex: 20,
    backgroundColor: colors.surface,
    borderTopRightRadius: 24,
    borderBottomRightRadius: 24,
    borderRightWidth: 1,
    borderRightColor: isDark ? 'rgba(255,255,255,0.08)' : colors.border,
    shadowColor: '#000000',
    shadowOffset: { width: 10, height: 0 },
    shadowOpacity: isDark ? 0.6 : 0.25,
    shadowRadius: 20,
    elevation: 25,
  },
  sidebarBody: {
    flex: 1,
    paddingBottom: 24,
    borderTopRightRadius: 24,
    borderBottomRightRadius: 24,
    overflow: 'hidden',
  },

  sidebarProfile: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 22, paddingTop: 6, paddingBottom: 16 },
  sidebarAvatar: { width: 54, height: 54, borderRadius: 27, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  sidebarAvatarTxt: { color: '#000', fontFamily: Typography.fontFamily.bold, fontSize: 21 },
  sidebarOnline: { position: 'absolute', bottom: 1, right: 1, width: 12, height: 12, borderRadius: 6, backgroundColor: Colors.success, borderWidth: 2, borderColor: '#000000' },
  sidebarName: { color: colors.textPrimary, fontFamily: Typography.fontFamily.bold, fontSize: 15 },
  sidebarCityRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 },
  sidebarCityTxt: { color: colors.textSecondary, fontFamily: Typography.fontFamily.medium, fontSize: 11 },
  sidebarCloseBtn: { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center', backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.surfaceVariant },

  sidebarStats: { flexDirection: 'row', marginHorizontal: 18, borderRadius: 14, overflow: 'hidden', backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : colors.surfaceVariant, borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.07)' : colors.border, marginBottom: 14 },
  sidebarStatCell: { flex: 1, alignItems: 'center', paddingVertical: 12, gap: 4 },
  sidebarStatVal: { fontSize: 17, fontFamily: Typography.fontFamily.bold },
  sidebarStatLbl: { fontSize: 9, color: colors.textSecondary, fontFamily: Typography.fontFamily.medium },

  sidebarDivider: { height: 1, backgroundColor: colors.border, marginHorizontal: 18, marginBottom: 10 },
  sidebarSection: { paddingHorizontal: 18, marginTop: 16 },
  sidebarSectionTitle: { fontSize: 9, color: colors.textTertiary, fontFamily: Typography.fontFamily.bold, letterSpacing: 1.5, marginBottom: 6, marginLeft: 4 },
  sidebarItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 10, borderRadius: 12 },
  sidebarItemIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', backgroundColor: isDark ? 'rgba(255,204,0,0.1)' : '#FFF9D6' },
  sidebarItemLabel: { flex: 1, fontSize: 14, fontFamily: Typography.fontFamily.medium, color: colors.textPrimary },

  sidebarFooter: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 22, paddingTop: 12, borderTopWidth: 1, borderTopColor: isDark ? 'rgba(255,255,255,0.07)' : colors.border, marginHorizontal: 18 },
  sidebarFooterTxt: { fontSize: 11, color: colors.textTertiary, fontFamily: Typography.fontFamily.regular },

  /* ──── Header ──── */
  header: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100, borderBottomWidth: 1, borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : colors.border, backgroundColor: isDark ? 'transparent' : colors.background },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 10, gap: 10 },
  menuBtn: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  headerGreeting: { fontSize: 20, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary },
  headerSub: { fontSize: 11, fontFamily: Typography.fontFamily.regular, color: colors.textSecondary, marginTop: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerAvatar: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  headerAvatarTxt: { color: '#000', fontFamily: Typography.fontFamily.bold, fontSize: 15 },

  /* ──── Hero ──── */
  hero: { paddingBottom: 28, overflow: 'hidden' },
  heroContent: { paddingHorizontal: Spacing.xl, paddingTop: 12, paddingBottom: 8 },
  heroBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(244,67,54,0.12)', alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(244,67,54,0.25)' },
  heroBadgeTxt: { color: Colors.error, fontSize: 10, fontFamily: Typography.fontFamily.bold, letterSpacing: 1 },
  heroTitle: { fontSize: 32, fontFamily: Typography.fontFamily.extraBold, color: colors.textPrimary, lineHeight: 38, marginBottom: 8 },
  heroSub: { fontSize: 13, color: colors.textSecondary, fontFamily: Typography.fontFamily.regular, marginBottom: 22 },
  heroCTA: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 22, paddingVertical: 13, borderRadius: 999 },
  heroCTATxt: { color: '#000', fontFamily: Typography.fontFamily.bold, fontSize: 14 },
  bannerWrap: { marginHorizontal: Spacing.lg, borderRadius: BorderRadius.xl, overflow: 'hidden', marginBottom: 0, marginTop: 4, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, borderWidth: 1, borderColor: colors.border },
  bannerImg: { width: '100%', height: '100%', borderRadius: BorderRadius.xl },

  /* Pulse dot */
  pulseDotWrap: { width: 14, height: 14, justifyContent: 'center', alignItems: 'center' },
  pulseDotOuter: { position: 'absolute', width: 12, height: 12, borderRadius: 6, backgroundColor: 'rgba(244,67,54,0.3)' },
  pulseDotInner: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.error },

  /* ──── Stats Row ──── */
  statsRow: { flexDirection: 'row', marginHorizontal: Spacing.xl, gap: 10, marginTop: -14, marginBottom: 28, zIndex: 2 },
  statCard: { flex: 1, backgroundColor: isDark ? colors.backgroundElevated : colors.surfaceVariant, borderRadius: 14, padding: 13, alignItems: 'center', gap: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', ...Shadows.sm },
  statIcon: { width: 32, height: 32, borderRadius: 9, justifyContent: 'center', alignItems: 'center', marginBottom: 2 },
  statVal: { fontSize: 18, fontFamily: Typography.fontFamily.extraBold },
  statLabel: { fontSize: 9, fontFamily: Typography.fontFamily.medium, color: colors.textSecondary, textAlign: 'center' },

  
  /* ── Top Search Section ── */
  topSearchSection: {
    paddingTop: (insets?.top || 20) + 74,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  searchBarCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: isDark ? 0.2 : 0.05,
    shadowRadius: 6,
    elevation: 3,
  },
  searchBarLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  searchIconBubble: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: isDark ? "rgba(255,204,0,0.12)" : "#FFF9D6",
    justifyContent: "center",
    alignItems: "center",
  },
  searchBarPlaceholder: {
    color: colors.textTertiary,
    fontFamily: Typography.fontFamily.medium,
    fontSize: 13,
    flex: 1,
  },
  locationChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: isDark ? "rgba(255,204,0,0.12)" : "#FFF9D6",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: isDark ? "rgba(255,204,0,0.25)" : "#FFEAA7",
  },
  locationChipText: {
    color: isDark ? Colors.primary : "#8A6D00",
    fontFamily: Typography.fontFamily.bold,
    fontSize: 11,
    maxWidth: 90,
  },

  /* ──── Consistent Section Layout ──── */
  section: {
    paddingHorizontal: 16,
    marginBottom: 28,
  },
  sectionHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  sectionBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: isDark ? "rgba(255,204,0,0.12)" : "#FFF9D6",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: isDark ? "rgba(255,204,0,0.2)" : "#FFEAA7",
  },
  sectionTitle: {
    fontSize: 17,
    color: colors.textPrimary,
    fontFamily: Typography.fontFamily.bold,
  },
  sectionSub: {
    fontSize: 12,
    color: colors.textSecondary,
    fontFamily: Typography.fontFamily.medium,
    marginTop: 1,
  },
  seeAll: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingVertical: 4,
  },
  seeAllTxt: {
    color: isDark ? Colors.primary : colors.primaryDark,
    fontFamily: Typography.fontFamily.bold,
    fontSize: 12,
  },

  /* Cricket Grid */
  cricketGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 12 },
  cricketCard: { width: "48%", borderRadius: 16, overflow: "hidden", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: isDark ? 0.2 : 0.05, shadowRadius: 4, elevation: 2 },
  cricketCardInner: { flexDirection: "row", alignItems: "center", padding: 12, paddingHorizontal: 12, gap: 8, borderRadius: 16 },
  cricketIconWrap: { width: 34, height: 34, borderRadius: 10, justifyContent: "center", alignItems: "center", backgroundColor: isDark ? "rgba(255,204,0,0.12)" : "#FFF9D6" },
  cricketCardLabel: { flex: 1, fontSize: 13, fontFamily: Typography.fontFamily.semiBold, color: colors.textPrimary },

  /* Book a Turf */
  bookHeroWrap: { overflow: "hidden", marginBottom: 12, borderRadius: 20, borderWidth: 1, borderColor: colors.border, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: isDark ? 0.3 : 0.08, shadowRadius: 8, elevation: 4 },
  bookHero: { flexDirection: "row", alignItems: "center", padding: 18, gap: 12 },
  bookHeroAccent: { position: "absolute", top: 0, left: 0, right: 0, height: 2, backgroundColor: Colors.primary, opacity: 0.5 },
  bookHeroTitle: { fontSize: 18, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary, lineHeight: 24 },
  bookHeroCTA: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 },
  bookHeroCTATxt: { color: isDark ? Colors.primary : colors.primaryDark, fontSize: 12, fontFamily: Typography.fontFamily.semiBold },
  bookHeroIconCol: {},

  /* Quick action chips */
  chipRow: { flexDirection: "row", gap: 10, width: "100%" },
  chip: { flex: 1, paddingVertical: 12, paddingHorizontal: 6, alignItems: "center", gap: 6, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: isDark ? 0.2 : 0.04, shadowRadius: 4, elevation: 2 },
  chipIconBubble: { width: 34, height: 34, borderRadius: 12, backgroundColor: isDark ? "rgba(154,188,47,0.15)" : "#FFF9D6", justifyContent: "center", alignItems: "center" },
  chipLabel: { fontSize: 11, color: colors.textPrimary, fontFamily: Typography.fontFamily.bold, textAlign: "center" },

  /* ──── Empty Card Fallback ──── */
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 18,
    flexDirection: "row",
    alignItems: "flex-start",
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: isDark ? 0.25 : 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  emptyIconBubble: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: isDark ? "rgba(255, 204, 0, 0.12)" : "#FFF9D6",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
    borderWidth: 1,
    borderColor: isDark ? "rgba(255, 204, 0, 0.25)" : "#FFEAA7",
  },
  emptyTitle: {
    fontSize: 15,
    fontFamily: Typography.fontFamily.bold,
    color: colors.textPrimary,
    marginBottom: 3,
  },
  emptySub: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.medium,
    color: colors.textSecondary,
    lineHeight: 17,
  },
  emptyActionBtn: {
    marginTop: 10,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  emptyActionText: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.bold,
    color: "#000000",
  },

  /* Live Banner */
  liveBanner: { borderRadius: 18, padding: 18, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)', backgroundColor: isDark ? colors.backgroundElevated : colors.surfaceVariant, overflow: 'hidden', gap: 12 },
  liveBannerAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, backgroundColor: Colors.primary },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: 'rgba(255,204,0,0.12)', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,204,0,0.22)' },
  livePillTxt: { color: Colors.primary, fontSize: 9, fontFamily: Typography.fontFamily.bold, letterSpacing: 1 },
  liveBannerTitle: { fontSize: 16, color: colors.textPrimary, fontFamily: Typography.fontFamily.bold },
  liveBannerSub: { fontSize: 11, color: colors.textSecondary },
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
  playerCard: { backgroundColor: colors.surface, borderRadius: 16, padding: 14, alignItems: 'center', width: 148, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  playerAvatarWrap: { position: 'relative', marginBottom: 10 },
  playerAvatar: { width: 62, height: 62, borderRadius: 31, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  rolePill: { position: 'absolute', bottom: -5, left: '50%', transform: [{ translateX: -18 }], backgroundColor: Colors.primary, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, minWidth: 36, alignItems: 'center' },
  rolePillText: { color: '#000', fontSize: 8, fontFamily: Typography.fontFamily.bold, letterSpacing: 0.5 },
  playerName: { fontSize: 13, fontFamily: Typography.fontFamily.semiBold, color: colors.textPrimary, textAlign: 'center', marginBottom: 3 },
  playerLocRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 10 },
  playerLocText: { fontSize: 10, color: colors.textSecondary },
  playerStats: { flexDirection: 'row', width: '100%', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 8, paddingVertical: 8, marginBottom: 10 },
  playerStatCell: { flex: 1, alignItems: 'center' },
  playerStatVal: { fontSize: 13, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary },
  playerStatLbl: { fontSize: 9, color: colors.textTertiary, marginTop: 1 },
  playerStatDiv: { width: 1, height: 22, backgroundColor: 'rgba(255,255,255,0.08)' },
  followBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 7, borderRadius: 10, backgroundColor: Colors.primary, width: '100%' },
  followingBtn: { backgroundColor: 'rgba(154,188,47,0.1)', borderWidth: 1, borderColor: Colors.primary },
  followBtnText: { fontSize: 11, fontFamily: Typography.fontFamily.semiBold, color: '#000' },
  followingBtnText: { color: Colors.primary },

  /* Explore CTA */
  exploreCTA: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(154,188,47,0.18)' },
  exploreIcon: { width: 46, height: 46, borderRadius: 13, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(154,188,47,0.1)' },
  exploreTxt: { fontSize: 14, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary, marginBottom: 2 },
  exploreSub: { fontSize: 11, color: colors.textSecondary },
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
