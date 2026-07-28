import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, Modal, Animated, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import LocationAutocomplete from '../../../components/LocationAutocomplete';
import { Colors, Typography, Spacing, BorderRadius } from '../../../theme/theme';
import { fetchGlobalLeaderboard } from '../playerSlice';
import { getImageUrl } from '../../../api/axios';
import SkeletonPlaceholder from 'react-native-skeleton-placeholder';

const { width } = Dimensions.get('window');

const TABS = ['Batters', 'Bowlers', 'Fielders'];
// No "All" — default is Tennis
const BALL_TYPES = ['Tennis', 'Leather', 'Other'];

const ACCENT  = '#9abc2f';
const GOLD    = '#FFD700';
const SILVER  = '#C0C0C0';
const BRONZE  = '#CD7F32';
const BG_DEEP = '#050F1C';
const BG_CARD = 'rgba(255,255,255,0.06)';

const medalColor = (rank) => rank === 1 ? GOLD : rank === 2 ? SILVER : BRONZE;
const gradForRank = (rank) =>
  rank === 1 ? ['#FFE259', '#FFA751'] :
  rank === 2 ? ['#BDC3C7', '#909498'] :
               ['#C97B2F', '#8B4513'];

// ─── Stats helpers (reads from statsByBallType first, falls back to top-level) ─
const getStats = (player, ballType) => {
  if (!player) return { batting: {}, bowling: {}, fielding: {} };
  const byBall = player.statsByBallType?.[ballType];
  return {
    batting:  byBall?.batting  || player.batting  || {},
    bowling:  byBall?.bowling  || player.bowling  || {},
    fielding: byBall?.fielding || player.fielding || {},
  };
};

const getMainStat = (player, tab, ballType) => {
  const s = getStats(player, ballType);
  if (tab === 'Batters')  return s.batting.runs    ?? 0;
  if (tab === 'Bowlers')  return s.bowling.wickets ?? 0;
  if (tab === 'Fielders') return s.fielding.catches ?? 0;
  return 0;
};

const fmt = (n, decimals = 1) => {
  if (!n || isNaN(n)) return '0';
  if (!isFinite(n)) return '∞';
  return Number.isInteger(n) ? String(n) : n.toFixed(decimals);
};

const getSubStats = (player, tab, ballType) => {
  const s = getStats(player, ballType);
  if (tab === 'Batters') {
    const dismissals = (s.batting.innings ?? 0) - (s.batting.notOuts ?? 0);
    const avg = dismissals > 0 ? (s.batting.runs ?? 0) / dismissals : Infinity;
    const sr  = (s.batting.balls ?? 0) > 0 ? ((s.batting.runs ?? 0) / (s.batting.balls ?? 0)) * 100 : 0;
    return [
      { label: 'M',    value: s.batting.innings      ?? 0 },
      { label: 'Avg',  value: fmt(avg) },
      { label: 'SR',   value: fmt(sr) },
      { label: 'Best', value: s.batting.highestScore ?? 0 },
    ];
  }
  if (tab === 'Bowlers') {
    const bowlBalls = s.bowling.balls ?? 0;
    const bowlRuns  = s.bowling.runs ?? 0;
    const econ  = bowlBalls > 0 ? (bowlRuns / bowlBalls) * 6 : 0;
    const bowlAvg = (s.bowling.wickets ?? 0) > 0 ? bowlRuns / (s.bowling.wickets ?? 0) : 0;
    const best  = `${s.bowling.bestWickets ?? 0}/${s.bowling.bestRuns === 999 ? 0 : (s.bowling.bestRuns ?? 0)}`;
    return [
      { label: 'M',    value: s.bowling.innings ?? 0 },
      { label: 'Avg',  value: fmt(bowlAvg) },
      { label: 'Econ', value: fmt(econ) },
      { label: 'Best', value: best },
    ];
  }
  return [
    { label: 'M',  value: s.fielding.matches   ?? 0 },
    { label: 'RO', value: s.fielding.runOuts    ?? 0 },
    { label: 'St', value: s.fielding.stumpings  ?? 0 },
  ];
};

const statLabel = (tab) =>
  tab === 'Batters' ? 'Runs' : tab === 'Bowlers' ? 'Wkts' : 'Catches';

// ─── Avatar with letter fallback ─────────────────────────────────────────────
const Avatar = ({ uri, name, size = 48, borderColor }) => {
  const [imgError, setImgError] = useState(false);
  const initial = (name || '?')[0].toUpperCase();
  const bgColors = ['#2ECC71', '#3498DB', '#9B59B6', '#E67E22', '#E74C3C', '#1ABC9C'];
  const bg = bgColors[initial.charCodeAt(0) % bgColors.length];

  const wrapper = {
    width: size, height: size, borderRadius: size / 2,
    overflow: 'hidden',
    borderWidth: borderColor ? 2 : 0,
    borderColor: borderColor || 'transparent',
  };

  if (uri && !imgError) {
    return (
      <View style={wrapper}>
        <Image
          source={{ uri }}
          style={{ width: size, height: size }}
          onError={() => setImgError(true)}
        />
      </View>
    );
  }
  return (
    <View style={[wrapper, { backgroundColor: bg, justifyContent: 'center', alignItems: 'center' }]}>
      <Text style={{ fontSize: size * 0.4, fontFamily: Typography.fontFamily.bold, color: '#fff' }}>
        {initial}
      </Text>
    </View>
  );
};

// ─── Podium Card ─────────────────────────────────────────────────────────────
const PodiumCard = ({ player, rank, tab, ballType, navigation }) => {
  if (!player) return <View style={{ width: width / 3.2 }} />;
  const isFirst = rank === 1;
  const size    = isFirst ? 84 : 66;
  const color   = medalColor(rank);
  const uri     = getImageUrl(player.photo || player.userId?.profilePicture);

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => navigation.navigate('PlayerDetail', { id: player._id })}
      style={[styles.podiumCard, isFirst && styles.podiumCardFirst]}
    >
      {isFirst && (
        <Icon name="crown" size={26} color={GOLD} style={{ marginBottom: 4 }} />
      )}

      <LinearGradient
        colors={gradForRank(rank)}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ width: size, height: size, borderRadius: size / 2, justifyContent: 'center', alignItems: 'center' }}
      >
        <Avatar uri={uri} name={player.name} size={size - 6} />
      </LinearGradient>

      <View style={[styles.podiumBadge, { backgroundColor: color }]}>
        <Text style={styles.podiumBadgeText}>{rank}</Text>
      </View>

      <Text style={styles.podiumName} numberOfLines={1}>{player.name}</Text>
      <Text style={[styles.podiumStat, { color }]}>{getMainStat(player, tab, ballType)}</Text>
      <Text style={styles.podiumStatLabel}>{statLabel(tab)}</Text>
    </TouchableOpacity>
  );
};

// ─── List Row (rank 4+) ───────────────────────────────────────────────────────
const ListRow = ({ item, rank, tab, ballType, navigation, anim }) => {
  const mainStat = getMainStat(item, tab, ballType);
  const subs     = getSubStats(item, tab, ballType);
  const uri      = getImageUrl(item.photo || item.userId?.profilePicture);

  return (
    <Animated.View style={{ opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }] }}>
      <TouchableOpacity
        activeOpacity={0.82}
        style={styles.listCard}
        onPress={() => navigation.navigate('PlayerDetail', { id: item._id })}
      >
        <Text style={styles.listRankNum}>{rank}</Text>

        <Avatar uri={uri} name={item.name} size={48} />

        <View style={styles.listInfo}>
          <Text style={styles.listName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.listRole}>{item.playingRole || 'Cricketer'}</Text>
          <View style={styles.subStatsRow}>
            {subs.map((s, i) => (
              <View key={i} style={styles.subStatBox}>
                <Text style={styles.subStatVal}>{s.value}</Text>
                <Text style={styles.subStatLbl}>{s.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.listMainStat}>
          <Text style={styles.listMainVal}>{mainStat}</Text>
          <Text style={styles.listMainLbl}>{statLabel(tab)}</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────
const CardSkeleton = () => (
  <SkeletonPlaceholder backgroundColor="#15273B" highlightColor="#1E354C">
    <SkeletonPlaceholder.Item flexDirection="row" alignItems="center" marginHorizontal={16} marginBottom={10} borderRadius={16} padding={14}>
      <SkeletonPlaceholder.Item width={28} height={20} borderRadius={4} />
      <SkeletonPlaceholder.Item width={48} height={48} borderRadius={24} marginLeft={12} />
      <SkeletonPlaceholder.Item flex={1} marginLeft={12}>
        <SkeletonPlaceholder.Item width={130} height={15} borderRadius={4} />
        <SkeletonPlaceholder.Item width={80} height={11} borderRadius={4} marginTop={8} />
        <SkeletonPlaceholder.Item flexDirection="row" marginTop={8}>
          {[70, 55, 65, 50].map((w, i) => (
            <SkeletonPlaceholder.Item key={i} width={w} height={24} borderRadius={6} marginRight={6} />
          ))}
        </SkeletonPlaceholder.Item>
      </SkeletonPlaceholder.Item>
      <SkeletonPlaceholder.Item width={44} height={28} borderRadius={6} />
    </SkeletonPlaceholder.Item>
  </SkeletonPlaceholder>
);

// ─── Main Screen ──────────────────────────────────────────────────────────────
const GlobalLeaderboardScreen = () => {
  const [activeTab,       setActiveTab]       = useState('Batters');
  const [activeBallType,  setActiveBallType]  = useState('Tennis');
  const [selectedCity,    setSelectedCity]    = useState(null);
  const [showModal,       setShowModal]       = useState(false);

  const dispatch   = useDispatch();
  const navigation = useNavigation();
  const { globalLeaderboard, isLoading } = useSelector(s => s.player);
  const { myProfile }                    = useSelector(s => s.player);

  const fadeAnim     = useRef(new Animated.Value(0)).current;
  const tabSlideAnim = useRef(new Animated.Value(0)).current;

  // Init city from profile once
  useEffect(() => {
    const city = myProfile?.city || myProfile?.location;
    if (city && !selectedCity) setSelectedCity(city);
  }, [myProfile]);

  // Animate tab indicator
  useEffect(() => {
    Animated.spring(tabSlideAnim, {
      toValue: TABS.indexOf(activeTab) * (width / TABS.length),
      useNativeDriver: true, tension: 80, friction: 12,
    }).start();
  }, [activeTab]);

  // Fetch
  useEffect(() => {
    if (!selectedCity) return;
    fadeAnim.setValue(0);
    dispatch(fetchGlobalLeaderboard({
      category: activeTab.toLowerCase(),
      ballType: activeBallType,
      city:     selectedCity,
      limit:    50,
    })).then(() => {
      Animated.spring(fadeAnim, { toValue: 1, useNativeDriver: true, tension: 60, friction: 10 }).start();
    });
  }, [activeTab, activeBallType, selectedCity, dispatch]);

  const currentData =
    activeTab === 'Batters'  ? (globalLeaderboard.batters  || []) :
    activeTab === 'Bowlers'  ? (globalLeaderboard.bowlers  || []) :
                               (globalLeaderboard.fielders || []);

  const top3 = currentData.slice(0, 3);
  const rest = currentData.slice(3);

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <LinearGradient colors={[BG_DEEP, '#0B1D30', '#0F2027']} style={StyleSheet.absoluteFillObject} />

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Icon name="arrow-left" size={22} color="#fff" />
        </TouchableOpacity>

        <View style={styles.headerTitleBlock}>
          <Text style={styles.headerTitle}>Leaderboard</Text>
          {selectedCity ? <Text style={styles.headerCity}>{selectedCity}</Text> : null}
        </View>

        <TouchableOpacity onPress={() => setShowModal(true)} style={styles.changeCityBtn}>
          <Icon name="map-marker-outline" size={15} color={ACCENT} />
          <Text style={styles.changeCityText}>{selectedCity ? 'Change' : 'Set City'}</Text>
        </TouchableOpacity>
      </View>

      {/* ── Category Tabs ── */}
      <View style={styles.tabsWrapper}>
        {TABS.map(tab => (
          <TouchableOpacity key={tab} style={styles.tab} onPress={() => setActiveTab(tab)}>
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
          </TouchableOpacity>
        ))}
        <Animated.View style={[styles.tabIndicator, { width: width / TABS.length, transform: [{ translateX: tabSlideAnim }] }]} />
      </View>

      {/* ── Ball Type Tabs (segmented control style) ── */}
      <View style={styles.ballTypeBar}>
        {BALL_TYPES.map(bt => (
          <TouchableOpacity
            key={bt}
            style={[styles.ballTypeBtn, activeBallType === bt && styles.ballTypeBtnActive]}
            onPress={() => setActiveBallType(bt)}
          >
            <Text style={[styles.ballTypeBtnText, activeBallType === bt && styles.ballTypeBtnTextActive]}>
              {bt}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── No City ── */}
      {!selectedCity ? (
        <View style={styles.emptyState}>
          <Icon name="map-search-outline" size={72} color={ACCENT} style={{ opacity: 0.6 }} />
          <Text style={styles.emptyTitle}>Select Your City</Text>
          <Text style={styles.emptySub}>Find top cricketers near you.</Text>
          <TouchableOpacity onPress={() => setShowModal(true)}>
            <LinearGradient colors={[ACCENT, Colors.primaryDark]} style={styles.cityBtn}>
              <Text style={styles.cityBtnText}>Choose City</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

      ) : isLoading ? (
        <View style={{ flex: 1, paddingTop: 16 }}>
          {[1, 2, 3, 4, 5].map(i => <CardSkeleton key={i} />)}
        </View>

      ) : (
        <FlatList
          data={rest}
          keyExtractor={i => i._id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            top3.length > 0 ? (
              <Animated.View style={[styles.podiumRow, {
                opacity: fadeAnim,
                transform: [{ scale: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }],
              }]}>
                <LinearGradient
                  colors={['transparent', Colors.primaryAlpha10, 'transparent']}
                  start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
                  style={styles.podiumGlow}
                />
                <PodiumCard player={top3[1]} rank={2} tab={activeTab} ballType={activeBallType} navigation={navigation} />
                <PodiumCard player={top3[0]} rank={1} tab={activeTab} ballType={activeBallType} navigation={navigation} />
                <PodiumCard player={top3[2]} rank={3} tab={activeTab} ballType={activeBallType} navigation={navigation} />
              </Animated.View>
            ) : null
          }
          ListEmptyComponent={
            currentData.length === 0 ? (
              <View style={styles.noData}>
                <Icon name="trophy-broken" size={56} color="rgba(255,255,255,0.12)" />
                <Text style={styles.noDataText}>No players ranked in {selectedCity} yet</Text>
              </View>
            ) : null
          }
          renderItem={({ item, index }) => (
            <ListRow
              item={item}
              rank={index + 4}
              tab={activeTab}
              ballType={activeBallType}
              navigation={navigation}
              anim={fadeAnim}
            />
          )}
        />
      )}

      {/* ── Location Modal ── */}
      <Modal visible={showModal} animationType="slide" transparent={false} onRequestClose={() => setShowModal(false)}>
        <SafeAreaView style={styles.modalRoot} edges={['top', 'left', 'right', 'bottom']}>
          <LinearGradient colors={[BG_DEEP, '#0B1D30']} style={StyleSheet.absoluteFillObject} />

          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowModal(false)} style={styles.modalCloseBtn}>
              <Icon name="arrow-left" size={22} color="#fff" />
            </TouchableOpacity>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.modalTitle}>Search City</Text>
              <Text style={styles.modalSubtitle}>Find leaderboard rankings near you</Text>
            </View>
          </View>

          {/* Popular Cities */}
          <View style={styles.popularSection}>
            <Text style={styles.popularLabel}>POPULAR</Text>
            <View style={styles.popularRow}>
              {['Chennai', 'Ambur', 'Vellore', 'Coimbatore', 'Bangalore'].map(city => (
                <TouchableOpacity
                  key={city}
                  style={styles.popularChip}
                  onPress={() => { setSelectedCity(city); setShowModal(false); }}
                >
                  <Icon name="map-marker-outline" size={13} color={ACCENT} />
                  <Text style={styles.popularChipText}>{city}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>OR SEARCH</Text>
            <View style={styles.divider} />
          </View>

          {/* Search Input */}
          <View style={styles.modalSearchBox}>
            <LocationAutocomplete
              variant="outlined"
              placeholder="Type a city or town..."
              onSelectLocation={(loc) => {
                const city = loc.name || loc.fullName?.split(',')[0] || null;
                if (city) setSelectedCity(city);
                setShowModal(false);
              }}
            />
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG_DEEP },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitleBlock: { flex: 1 },
  headerTitle: {
    fontSize: 20,
    fontFamily: Typography.fontFamily.bold,
    color: '#fff',
    lineHeight: 24,
  },
  headerCity: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.medium,
    color: ACCENT,
  },
  changeCityBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primaryAlpha10,
    borderWidth: 1,
    borderColor: Colors.primaryAlpha30,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  changeCityText: {
    fontSize: 13,
    fontFamily: Typography.fontFamily.semiBold,
    color: ACCENT,
  },

  // Category Tabs
  tabsWrapper: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    marginHorizontal: 16,
    position: 'relative',
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  tabText: { fontSize: 14, fontFamily: Typography.fontFamily.medium, color: 'rgba(255,255,255,0.4)' },
  tabTextActive: { color: '#fff', fontFamily: Typography.fontFamily.bold },
  tabIndicator: {
    position: 'absolute', bottom: 0, height: 3,
    borderRadius: 2, backgroundColor: ACCENT,
  },

  // Ball Type Segmented Control
  ballTypeBar: {
    flexDirection: 'row',
    margin: 16,
    marginBottom: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  ballTypeBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 10,
  },
  ballTypeBtnActive: {
    backgroundColor: ACCENT,
  },
  ballTypeBtnText: {
    fontSize: 13,
    fontFamily: Typography.fontFamily.medium,
    color: 'rgba(255,255,255,0.5)',
  },
  ballTypeBtnTextActive: {
    color: '#fff',
    fontFamily: Typography.fontFamily.bold,
  },

  // Podium
  podiumRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingTop: 24,
    paddingBottom: 16,
    position: 'relative',
  },
  podiumGlow: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 80,
  },
  podiumCard: {
    alignItems: 'center',
    width: width / 3.2,
    paddingHorizontal: 4,
  },
  podiumCardFirst: { marginTop: -36, zIndex: 10 },
  podiumBadge: {
    width: 22, height: 22, borderRadius: 11,
    justifyContent: 'center', alignItems: 'center',
    marginTop: -10, marginBottom: 6,
    borderWidth: 2, borderColor: BG_DEEP,
  },
  podiumBadgeText: { fontSize: 11, fontFamily: Typography.fontFamily.bold, color: '#111' },
  podiumName: {
    fontSize: 13, fontFamily: Typography.fontFamily.bold,
    color: '#fff', textAlign: 'center', marginBottom: 2,
  },
  podiumStat: {
    fontSize: 18, fontFamily: Typography.fontFamily.extraBold, textAlign: 'center',
  },
  podiumStatLabel: {
    fontSize: 10, fontFamily: Typography.fontFamily.medium,
    color: 'rgba(255,255,255,0.5)',
  },

  // List
  listContent: { paddingHorizontal: 16, paddingBottom: 32 },
  listCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BG_CARD,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    padding: 14,
    marginBottom: 10,
    gap: 12,
  },
  listRankNum: {
    width: 26,
    fontSize: 16,
    fontFamily: Typography.fontFamily.bold,
    color: 'rgba(255,255,255,0.35)',
    textAlign: 'center',
  },
  listInfo: { flex: 1 },
  listName: {
    fontSize: 15, fontFamily: Typography.fontFamily.semiBold,
    color: '#fff', marginBottom: 2,
  },
  listRole: {
    fontSize: 11, fontFamily: Typography.fontFamily.regular,
    color: 'rgba(255,255,255,0.4)', marginBottom: 8,
  },
  subStatsRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  subStatBox: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 4,
    alignItems: 'center', minWidth: 44,
  },
  subStatVal: { fontSize: 12, fontFamily: Typography.fontFamily.bold, color: '#fff' },
  subStatLbl: { fontSize: 9, fontFamily: Typography.fontFamily.regular, color: 'rgba(255,255,255,0.4)' },

  listMainStat: { alignItems: 'flex-end' },
  listMainVal: { fontSize: 22, fontFamily: Typography.fontFamily.extraBold, color: ACCENT },
  listMainLbl: { fontSize: 10, fontFamily: Typography.fontFamily.medium, color: 'rgba(255,255,255,0.4)' },

  // Empty states
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyTitle: { fontSize: 22, fontFamily: Typography.fontFamily.bold, color: '#fff', marginTop: 16, marginBottom: 6 },
  emptySub:   { fontSize: 14, fontFamily: Typography.fontFamily.regular, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginBottom: 28 },
  cityBtn:    { paddingHorizontal: 32, paddingVertical: 14, borderRadius: 28 },
  cityBtnText: { fontSize: 16, fontFamily: Typography.fontFamily.bold, color: '#fff' },

  noData: { alignItems: 'center', paddingTop: 48 },
  noDataText: { marginTop: 14, fontSize: 14, fontFamily: Typography.fontFamily.medium, color: 'rgba(255,255,255,0.35)', textAlign: 'center' },

  // Modal (full-screen)
  modalRoot: { flex: 1, backgroundColor: BG_DEEP },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
  },
  modalCloseBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center', alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20, fontFamily: Typography.fontFamily.bold, color: '#fff',
  },
  modalSubtitle: {
    fontSize: 12, fontFamily: Typography.fontFamily.regular, color: 'rgba(255,255,255,0.45)',
    marginTop: 2,
  },

  // Popular cities
  popularSection: { paddingHorizontal: 16, marginBottom: 24 },
  popularLabel: {
    fontSize: 11, fontFamily: Typography.fontFamily.bold,
    color: 'rgba(255,255,255,0.3)', letterSpacing: 1.2, marginBottom: 12,
  },
  popularRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  popularChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  popularChipText: {
    fontSize: 14, fontFamily: Typography.fontFamily.medium, color: '#fff',
  },

  // Divider
  dividerRow: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginBottom: 20,
  },
  divider: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.1)' },
  dividerText: {
    fontSize: 11, fontFamily: Typography.fontFamily.bold,
    color: 'rgba(255,255,255,0.3)', marginHorizontal: 12, letterSpacing: 1,
  },

  // Search box
  modalSearchBox: { paddingHorizontal: 16 },
});

export default GlobalLeaderboardScreen;
