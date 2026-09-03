import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, Modal, Animated, Dimensions, ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LocationAutocomplete from '../../../components/LocationAutocomplete';
import { useTheme, Typography, Spacing, BorderRadius } from '../../../theme/theme';
import { fetchGlobalLeaderboard } from '../playerSlice';
import { getImageUrl } from '../../../api/axios';

const { width, height } = Dimensions.get('window');

// ─── ScoreVerse Design Tokens ─────────────────────────────────────────────────
const getTokens = (colors, isDark) => ({
  black: "#000000",
  dark: isDark ? "#111111" : colors.surface,
  darkCard: colors.surface,
  darkGlass: isDark ? "rgba(22,22,22,0.85)" : "rgba(255,255,255,0.95)",
  white: colors.textPrimary,
  yellow: colors.primary,
  yellowDim: isDark ? "rgba(255,212,0,0.15)" : colors.primaryAlpha10,
  yellowGlow: colors.primaryAlpha20,
  border: colors.border,
  borderYellow: isDark ? "rgba(255,212,0,0.25)" : colors.primaryAlpha30,
  textPrimary: colors.textPrimary,
  textSecondary: colors.textSecondary,
  textTertiary: colors.textTertiary,
});

const TABS = ['Batters', 'Bowlers', 'Fielders'];
const BALL_TYPES = ['Tennis', 'Leather', 'Other'];

// ─── Stat helpers ─────────────────────────────────────────────────────────────
const getStats = (player, ballType) => {
  if (!player) return { batting: {}, bowling: {}, fielding: {} };
  const byBall = player.statsByBallType?.[ballType];
  return {
    batting:  byBall?.batting  || player.batting  || {},
    bowling:  byBall?.bowling  || player.bowling  || {},
    fielding: byBall?.fielding || player.fielding || {},
  };
};

const getMainStat = (player, tab, ballType, statFilter) => {
  const s = getStats(player, ballType);
  const f = statFilter?.toLowerCase() || '';

  if (tab === 'Batters') {
    if (f === 'matches') return player.career?.matches || 0;
    if (f === 'highscore' || f === 'high score') return s.batting?.highestScore || 0;
    if (f === 'avg' || f === 'average') return fmt(player.calculatedAvg);
    return s.batting?.runs ?? 0;
  }
  if (tab === 'Bowlers') {
    if (f === 'matches') return player.career?.matches || 0;
    if (f === 'maidens') return s.bowling?.maidens || 0;
    if (f === 'best') return `${s.bowling?.bestWickets || 0}/${s.bowling?.bestRuns === 999 ? 0 : (s.bowling?.bestRuns || 0)}`;
    if (f === 'eco' || f === 'economy') return fmt(player.calculatedEco);
    return s.bowling?.wickets ?? 0;
  }
  if (tab === 'Fielders') {
    if (f === 'stumpings') return s.fielding?.stumpings || 0;
    if (f === 'run outs') return s.fielding?.runOuts || 0;
    return s.fielding?.catches ?? 0;
  }
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

const statLabel = (tab, statFilter) => {
  const f = statFilter?.toLowerCase() || '';
  if (f === 'average' || f === 'avg') return 'Avg';
  if (f === 'high score' || f === 'highscore') return 'Highest';
  if (f === 'matches') return 'Matches';
  
  if (f === 'economy' || f === 'eco') return 'Econ';
  if (f === 'maidens') return 'Maidens';
  if (f === 'best') return 'Best Bowl';
  
  if (f === 'stumpings') return 'Stumps';
  if (f === 'run outs') return 'Run Outs';
  
  return tab === 'Batters' ? 'Runs' : tab === 'Bowlers' ? 'Wkts' : 'Catches';
};

const GlobalLeaderboardScreen = () => {
  const { colors, shadows, isDark } = useTheme();
  const S = useMemo(() => getTokens(colors, isDark), [colors, isDark]);
  const styles = useMemo(() => createStyles(colors, shadows, isDark, S), [colors, shadows, isDark, S]);

// ─── Avatar ───────────────────────────────────────────────────────────────────
const Avatar = ({ uri, name, size = 48, isChampion = false }) => {
  const { colors, isDark } = useTheme();
  const S = useMemo(() => getTokens(colors, isDark), [colors, isDark]);
  const [imgError, setImgError] = useState(false);
  const initial = (name || '?')[0].toUpperCase();

  if (uri && !imgError) {
    return (
      <View style={{
        width: size, height: size, borderRadius: size / 2, overflow: 'hidden',
        borderWidth: isChampion ? 2.5 : 1.5,
        borderColor: isChampion ? S.yellow : S.border,
      }}>
        <Image source={{ uri }} style={{ width: size, height: size }} onError={() => setImgError(true)} />
      </View>
    );
  }
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: isChampion ? S.yellowDim : 'rgba(255,255,255,0.06)',
      justifyContent: 'center', alignItems: 'center',
      borderWidth: isChampion ? 2.5 : 1.5,
      borderColor: isChampion ? S.yellow : S.border,
    }}>
      <Text style={{
        fontSize: size * 0.38,
        fontFamily: Typography.fontFamily.bold,
        color: isChampion ? S.yellow : S.white,
      }}>{initial}</Text>
    </View>
  );
};

// ─── Ambient Background Particle ─────────────────────────────────────────────
const Particle = ({ delay, x, size, duration }) => {
  const { colors, isDark } = useTheme();
  const S = useMemo(() => getTokens(colors, isDark), [colors, isDark]);
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, { toValue: 1, duration, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: duration * 0.6, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: x,
        top: height * 0.12,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: S.yellow,
        opacity: anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0.12, 0] }),
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [0, -80] }) }],
      }}
    />
  );
};

// ─── Podium Column ────────────────────────────────────────────────────────────
const PodiumColumn = ({ player, rank, tab, ballType, statFilter, navigation, floatAnim }) => {
  const { colors, isDark } = useTheme();
  const S = useMemo(() => getTokens(colors, isDark), [colors, isDark]);
  if (!player) return <View style={{ width: (width - 32) / 3 }} />;

  const isFirst  = rank === 1;
  const avatarSz = isFirst ? 80 : 64;
  const uri      = getImageUrl(player.photo || player.userId?.profilePicture);
  const podiumH  = isFirst ? 90 : rank === 2 ? 66 : 50;

  const rankLabel   = rank === 1 ? '1st' : rank === 2 ? '2nd' : '3rd';
  const rankNumSize = isFirst ? 44 : 32;

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => navigation.navigate('PlayerDetail', { id: player._id })}
      style={{ alignItems: 'center', flex: 1, paddingHorizontal: 4 }}
    >
      {/* Trophy for champion */}
      {isFirst && (
        <View style={{ marginBottom: 4 }}>
          <Icon name="trophy" size={22} color={S.yellow} />
        </View>
      )}

      {/* Avatar */}
      <Animated.View style={isFirst ? {
        transform: [{ translateY: floatAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) }],
      } : {}}>
        <Avatar uri={uri} name={player.name} size={avatarSz} isChampion={isFirst} />
      </Animated.View>

      {/* Rank badge */}
      <View style={{
        backgroundColor: isFirst ? S.yellow : 'rgba(255,255,255,0.1)',
        borderRadius: 10,
        paddingHorizontal: 8,
        paddingVertical: 2,
        marginTop: 6,
        marginBottom: 4,
      }}>
        <Text style={{
          fontFamily: Typography.fontFamily.bold,
          fontSize: 10,
          color: isFirst ? S.black : S.textSecondary,
          letterSpacing: 0.5,
        }}>{rankLabel}</Text>
      </View>

      {/* Name */}
      <Text style={{
        fontFamily: Typography.fontFamily.semiBold,
        fontSize: isFirst ? 13 : 12,
        color: S.white,
        textAlign: 'center',
        marginBottom: 2,
      }} numberOfLines={1}>{player.name}</Text>

      {/* Stat */}
      <Text style={{
        fontFamily: Typography.fontFamily.extraBold,
        fontSize: isFirst ? 22 : 18,
        color: isFirst ? S.yellow : S.white,
      }}>{getMainStat(player, tab, ballType, statFilter)}</Text>

      <Text style={{
        fontFamily: Typography.fontFamily.regular,
        fontSize: 10,
        color: S.textSecondary,
      }}>{statLabel(tab, statFilter)}</Text>

      {/* Podium base */}
      <View style={{
        width: '100%',
        height: podiumH,
        marginTop: 10,
        backgroundColor: isFirst 
          ? (isDark ? 'rgba(255,212,0,0.14)' : 'rgba(255,204,0,0.18)')
          : (isDark ? 'rgba(255,255,255,0.05)' : colors.surfaceVariant),
        borderRadius: 8,
        borderTopWidth: 2,
        borderTopColor: isFirst ? S.yellow : (isDark ? 'rgba(255,255,255,0.12)' : colors.border),
        borderLeftWidth: 1,
        borderRightWidth: 1,
        borderLeftColor: isDark ? S.border : colors.border,
        borderRightColor: isDark ? S.border : colors.border,
        justifyContent: 'center',
        alignItems: 'center',
      }}>
        <Text style={{
          fontFamily: Typography.fontFamily.bold,
          fontSize: isFirst ? 20 : 16,
          color: isFirst ? S.yellow : (isDark ? 'rgba(255,255,255,0.3)' : colors.textTertiary),
        }}>{rank}</Text>
      </View>
    </TouchableOpacity>
  );
};

// ─── List Row (rank 4+) ────────────────────────────────────────────────────────
const ListRow = ({ item, rank, tab, ballType, statFilter, navigation, entryAnim }) => {
  const { colors, shadows, isDark } = useTheme();
  const S = useMemo(() => getTokens(colors, isDark), [colors, isDark]);
  const styles = useMemo(() => createStyles(colors, shadows, isDark, S), [colors, shadows, isDark, S]);
  const mainStat = getMainStat(item, tab, ballType);
  const subs     = getSubStats(item, tab, ballType);
  const uri      = getImageUrl(item.photo || item.userId?.profilePicture);

  return (
    <Animated.View style={{
      opacity: entryAnim,
      transform: [{ translateY: entryAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
      marginBottom: 10,
    }}>
      <TouchableOpacity
        activeOpacity={0.82}
        style={styles.listCard}
        onPress={() => navigation.navigate('PlayerDetail', { id: item._id })}
      >
        {/* Rank */}
        <View style={styles.rankBubble}>
          <Text style={styles.rankBubbleText}>{rank}</Text>
        </View>

        {/* Avatar */}
        <Avatar uri={uri} name={item.name} size={46} />

        {/* Info */}
        <View style={styles.listInfo}>
          <Text style={styles.listName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.listRole}>{item.playingRole || 'Cricketer'}</Text>
          <View style={styles.subStatsRow}>
            {subs.map((s, i) => (
              <View key={i} style={styles.subStatChip}>
                <Text style={styles.subStatVal}>{s.value}</Text>
                <Text style={styles.subStatLbl}>{s.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Main Stat */}
        <View style={styles.listStatBlock}>
          <Text style={styles.listStatValue}>{mainStat}</Text>
          <Text style={styles.listStatLabel}>{statLabel(tab)}</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ─── Podium Skeleton ─────────────────────────────────────────────────────────
const PodiumSkeleton = () => {
  const shimmer = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(shimmer, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(shimmer, { toValue: 0, duration: 800, useNativeDriver: true }),
    ])).start();
  }, []);
  const bg = shimmer.interpolate({ inputRange: [0, 1], outputRange: ['rgba(255,255,255,0.04)', 'rgba(255,255,255,0.11)'] });

  const cols = [
    { sz: 64, numW: 22, nameW: 56, statW: 36, baseH: 66 },
    { sz: 80, numW: 30, nameW: 72, statW: 44, baseH: 90 },
    { sz: 64, numW: 22, nameW: 56, statW: 36, baseH: 50 },
  ];
  // order: 2nd, 1st, 3rd
  const order = [cols[1], cols[0], cols[2]];

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginBottom: 28, paddingHorizontal: 8, gap: 8 }}>
      {order.map((col, i) => (
        <View key={i} style={{ flex: 1, alignItems: 'center' }}>
          {/* Big rank number */}
          <Animated.View style={{ width: col.numW, height: col.numW, borderRadius: 4, backgroundColor: bg, marginBottom: 6 }} />
          {/* Avatar circle */}
          <Animated.View style={{ width: col.sz, height: col.sz, borderRadius: col.sz / 2, backgroundColor: bg, marginBottom: 8 }} />
          {/* Badge pill */}
          <Animated.View style={{ width: 32, height: 14, borderRadius: 6, backgroundColor: bg, marginBottom: 6 }} />
          {/* Name */}
          <Animated.View style={{ width: col.nameW, height: 12, borderRadius: 4, backgroundColor: bg, marginBottom: 6 }} />
          {/* Stat */}
          <Animated.View style={{ width: col.statW, height: 20, borderRadius: 4, backgroundColor: bg, marginBottom: 10 }} />
          {/* Podium base */}
          <Animated.View style={{ width: '100%', height: col.baseH, borderRadius: 8, backgroundColor: bg }} />
        </View>
      ))}
    </View>
  );
};

// ─── Skeleton Row ────────────────────────────────────────────────────────────

const SkeletonRow = () => {
  const { colors, shadows, isDark } = useTheme();
  const S = useMemo(() => getTokens(colors, isDark), [colors, isDark]);
  const styles = useMemo(() => createStyles(colors, shadows, isDark, S), [colors, shadows, isDark, S]);
  const shimmer = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(shimmer, { toValue: 1, duration: 900, useNativeDriver: true }),
      Animated.timing(shimmer, { toValue: 0, duration: 900, useNativeDriver: true }),
    ])).start();
  }, []);
  const bg = shimmer.interpolate({ inputRange: [0, 1], outputRange: ['rgba(255,255,255,0.04)', 'rgba(255,255,255,0.09)'] });
  return (
    <View style={[styles.listCard, { marginBottom: 10 }]}>
      <Animated.View style={{ width: 28, height: 16, borderRadius: 4, backgroundColor: bg }} />
      <Animated.View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: bg }} />
      <View style={{ flex: 1, gap: 8 }}>
        <Animated.View style={{ width: 120, height: 14, borderRadius: 4, backgroundColor: bg }} />
        <Animated.View style={{ width: 80, height: 10, borderRadius: 4, backgroundColor: bg }} />
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {[1,2,3,4].map(i => (
            <Animated.View key={i} style={{ width: 48, height: 26, borderRadius: 8, backgroundColor: bg }} />
          ))}
        </View>
      </View>
      <Animated.View style={{ width: 40, height: 28, borderRadius: 6, backgroundColor: bg }} />
    </View>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────

  const [activeTab,         setActiveTab]         = useState('Batters');
  const [activeBallType,    setActiveBallType]    = useState('Tennis');
  const [selectedCity,      setSelectedCity]      = useState(null);
  const [showModal,         setShowModal]         = useState(false);
  const [statFilter,        setStatFilter]        = useState('all');
  // Filter sheet state
  const [showFilterModal,   setShowFilterModal]   = useState(false);
  const [pendingTab,        setPendingTab]        = useState('Batters');
  const [pendingBallType,   setPendingBallType]   = useState('Tennis');
  const [pendingStatFilter, setPendingStatFilter] = useState('all');

  const dispatch   = useDispatch();
  const navigation = useNavigation();
  const insets     = useSafeAreaInsets();
  const { globalLeaderboard, isLoading } = useSelector(s => s.player);
  const { myProfile }                    = useSelector(s => s.player);
  const myRank = globalLeaderboard.myRank;

  // FlatList ref for scroll-to-my-rank
  const flatListRef = useRef(null);

  // Animations
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  const entryAnim = useRef(new Animated.Value(0)).current;
  const myRankBarAnim = useRef(new Animated.Value(0)).current;

  // Champion float loop
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(floatAnim, { toValue: 1, duration: 2200, useNativeDriver: true }),
      Animated.timing(floatAnim, { toValue: 0, duration: 2200, useNativeDriver: true }),
    ])).start();
  }, []);

  // Init city from profile
  useEffect(() => {
    const city = myProfile?.city || myProfile?.location;
    if (city && !selectedCity) setSelectedCity(city);
  }, [myProfile]);

  // Reset pending stat filter when category changes in the sheet
  useEffect(() => {
    setPendingStatFilter('all');
  }, [pendingTab]);

  // Open filter sheet: seed pending values from active
  const openFilterSheet = () => {
    setPendingTab(activeTab);
    setPendingBallType(activeBallType);
    setPendingStatFilter(statFilter);
    setShowFilterModal(true);
  };

  const applyFilter = () => {
    setActiveTab(pendingTab);
    setActiveBallType(pendingBallType);
    setStatFilter(pendingStatFilter);
    setShowFilterModal(false);
  };

  // Fetch on change
  useEffect(() => {
    if (!selectedCity) return;
    fadeAnim.setValue(0);
    entryAnim.setValue(0);
    myRankBarAnim.setValue(0);
    dispatch(fetchGlobalLeaderboard({
      category: activeTab.toLowerCase(),
      ballType: activeBallType,
      city:     selectedCity,
      limit:    50,
      statFilter: statFilter,
    })).then(() => {
      Animated.parallel([
        Animated.spring(fadeAnim,  { toValue: 1, useNativeDriver: true, tension: 60, friction: 10 }),
        Animated.spring(entryAnim, { toValue: 1, useNativeDriver: true, tension: 50, friction: 12, delay: 200 }),
        Animated.spring(myRankBarAnim, { toValue: 1, useNativeDriver: true, tension: 60, friction: 12, delay: 400 }),
      ]).start();
    });
  }, [activeTab, activeBallType, selectedCity, statFilter, dispatch]);

  const scrollToMyRank = () => {
    if (!myRank || !flatListRef.current) return;
    const rank = myRank.rank;
    if (rank <= 3) {
      // Top 3 are in the header, scroll to top
      flatListRef.current.scrollToOffset({ offset: 0, animated: true });
    } else {
      // rank 4+ are in the FlatList data (rest), index = rank - 4
      const index = rank - 4;
      try {
        flatListRef.current.scrollToIndex({ index, animated: true, viewPosition: 0.3 });
      } catch (e) {
        flatListRef.current.scrollToOffset({ offset: index * 110, animated: true });
      }
    }
  };

  const currentData =
    activeTab === 'Batters'  ? (globalLeaderboard.batters  || []) :
    activeTab === 'Bowlers'  ? (globalLeaderboard.bowlers  || []) :
                               (globalLeaderboard.fielders || []);

  const top3 = currentData.slice(0, 3);
  const rest = currentData.slice(3);

  // Active filter summary label shown in the header sub-line
  const filterSummary = `${activeTab} • ${activeBallType} • ${statFilter.charAt(0).toUpperCase() + statFilter.slice(1)}`;

  // ─── List Header (Podium) ────────────────────────────────────────────────
  const renderHeader = () => (
    <View>
      {/* Podium */}
      {top3.length > 0 && (
        <Animated.View style={[styles.podiumRow, {
          opacity: fadeAnim,
          transform: [{ scale: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }],
        }]}>
          <PodiumColumn
            player={top3[1]} rank={2}
            tab={activeTab} ballType={activeBallType} statFilter={statFilter}
            navigation={navigation} floatAnim={floatAnim}
          />
          <PodiumColumn
            player={top3[0]} rank={1}
            tab={activeTab} ballType={activeBallType} statFilter={statFilter}
            navigation={navigation} floatAnim={floatAnim}
          />
          <PodiumColumn
            player={top3[2]} rank={3}
            tab={activeTab} ballType={activeBallType} statFilter={statFilter}
            navigation={navigation} floatAnim={floatAnim}
          />
        </Animated.View>
      )}

      {/* Divider before list */}
      {rest.length > 0 && (
        <View style={styles.rankingHeaderRow}>
          <View style={styles.rankingDivider} />
          <Text style={styles.rankingHeaderLabel}>RANKINGS</Text>
          <View style={styles.rankingDivider} />
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.root}>
      {/* Ambient particles */}
      <Particle delay={0}    x={width * 0.1} size={6}  duration={3000} />
      <Particle delay={600}  x={width * 0.5} size={4}  duration={3800} />
      <Particle delay={1200} x={width * 0.8} size={5}  duration={3200} />
      <Particle delay={400}  x={width * 0.3} size={3}  duration={4100} />
      <Particle delay={900}  x={width * 0.7} size={4}  duration={3500} />

      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        {/* ── Header ── */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
            <Icon name="arrow-left" size={20} color={S.white} />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Leaderboard</Text>
            {selectedCity ? (
              <View style={styles.locationRow}>
                <Icon name="map-marker" size={11} color={S.yellow} />
                <Text style={styles.headerCity}>{selectedCity}</Text>
              </View>
            ) : null}
          </View>

          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <TouchableOpacity onPress={() => setShowModal(true)} style={styles.changeCityBtn}>
              <Icon name="swap-horizontal" size={14} color={S.yellow} />
              <Text style={styles.changeCityText}>{selectedCity ? 'Change' : 'Set City'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={openFilterSheet} style={[styles.iconBtn, { backgroundColor: 'rgba(255,212,0,0.12)', borderWidth: 1, borderColor: S.borderYellow, borderRadius: 10 }]}>
              <Icon name="tune-variant" size={18} color={S.yellow} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Active Filter Status Bar ── */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 10, gap: 6 }}>
          <Icon name="filter-variant" size={13} color={S.textSecondary} />
          {[activeTab, activeBallType, statFilter === 'all' ? 'All' : statFilter.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')].map((label, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              {i > 0 && <Text style={{ color: S.textTertiary, fontSize: 10 }}>›</Text>}
              <View style={{ backgroundColor: i === 0 ? 'rgba(255,212,0,0.12)' : 'rgba(255,255,255,0.06)', borderRadius: 5, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: i === 0 ? S.borderYellow : 'rgba(255,255,255,0.08)' }}>
                <Text style={{ fontFamily: Typography.fontFamily.semiBold, fontSize: 11, color: i === 0 ? S.yellow : S.textSecondary }}>{label}</Text>
              </View>
            </View>
          ))}
        </View>


        {!selectedCity ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <Icon name="map-search-outline" size={48} color={S.yellow} />
            </View>
            <Text style={styles.emptyTitle}>Select Your City</Text>
            <Text style={styles.emptySub}>Find top cricketers ranked near you.</Text>
            <TouchableOpacity onPress={() => setShowModal(true)} style={styles.emptyBtn}>
              <Icon name="map-marker-outline" size={16} color={S.black} />
              <Text style={styles.emptyBtnText}>Choose City</Text>
            </TouchableOpacity>
          </View>
        ) : isLoading ? (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 24 }} showsVerticalScrollIndicator={false}>
            <PodiumSkeleton />
            {[1,2,3,4].map(i => <SkeletonRow key={i} />)}
          </ScrollView>
        ) : (
          <FlatList
            ref={flatListRef}
            data={rest}
            keyExtractor={i => i._id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.listContent, myRank && { paddingBottom: 90 + insets.bottom + 24 }]}
            ListHeaderComponent={renderHeader}
            onScrollToIndexFailed={info => {
              // Fallback: scroll to approximate offset
              flatListRef.current?.scrollToOffset({ offset: info.index * 110, animated: true });
            }}
            ListEmptyComponent={
              currentData.length === 0 ? (
                <View style={styles.noData}>
                  <Icon name="trophy-broken" size={52} color="rgba(255,255,255,0.08)" />
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
                statFilter={statFilter}
                navigation={navigation}
                entryAnim={entryAnim}
              />
            )}
          />
        )}
      </SafeAreaView>

      {/* ── My Rank Fixed Bottom Bar ── */}
      {myRank && selectedCity && !isLoading && (
        <Animated.View
          style={[
            styles.myRankBar,
            { paddingBottom: insets.bottom + 12 },
            { opacity: myRankBarAnim, transform: [{ translateY: myRankBarAnim.interpolate({ inputRange: [0, 1], outputRange: [80, 0] }) }] },
          ]}
        >
          <TouchableOpacity style={styles.myRankInner} onPress={scrollToMyRank} activeOpacity={0.85}>
            {/* Rank badge */}
            <View style={[
              styles.myRankBadge,
              myRank.rank <= 3 && { backgroundColor: myRank.rank === 1 ? S.yellow : myRank.rank === 2 ? '#C0C0C0' : '#CD7F32' },
            ]}>
              <Text style={[styles.myRankBadgeText, myRank.rank <= 3 && { color: S.black }]}>
                #{myRank.rank}
              </Text>
            </View>

            {/* Avatar */}
            <Avatar
              uri={getImageUrl(myRank.player?.photo || myRank.player?.userId?.profilePicture)}
              name={myRank.player?.name || myProfile?.name}
              size={36}
            />

            {/* Info */}
            <View style={{ flex: 1 }}>
              <Text style={styles.myRankName} numberOfLines={1}>
                {myRank.player?.name || myProfile?.name || 'You'}
              </Text>
              <Text style={styles.myRankSub}>
                {statLabel(activeTab, statFilter)}: {getMainStat(myRank.player, activeTab, activeBallType, statFilter)}
              </Text>
            </View>

            {/* Scroll hint */}
            {/* <View style={styles.myRankScrollHint}>
              <Icon name="target" size={14} color={S.yellow} />
              <Text style={styles.myRankScrollText}>Locate</Text>
            </View> */}
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* ── Location Modal ── */}
      <Modal visible={showModal} animationType="slide" transparent={false} onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalRoot}>
          <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right', 'bottom']}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowModal(false)} style={styles.iconBtn}>
                <Icon name="arrow-left" size={20} color={S.white} />
              </TouchableOpacity>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.modalTitle}>Select City</Text>
                <Text style={styles.modalSub}>Find leaderboard rankings near you</Text>
              </View>
            </View>

            {/* Popular Cities */}
            {/* <View style={styles.popularSection}>
              <Text style={styles.popularLabel}>POPULAR CITIES</Text>
              <View style={styles.popularRow}>
                {['Chennai', 'Ambur', 'Vellore', 'Coimbatore', 'Bangalore'].map(city => (
                  <TouchableOpacity
                    key={city}
                    style={styles.popularChip}
                    onPress={() => { setSelectedCity(city); setShowModal(false); }}
                  >
                    <Icon name="map-marker-outline" size={12} color={S.yellow} />
                    <Text style={styles.popularChipText}>{city}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.dividerRow}>
              <View style={styles.divider} />
              <Text style={styles.dividerLabel}>OR SEARCH</Text>
              <View style={styles.divider} />
            </View> */}

            <View style={{ paddingHorizontal: 16 }}>
              <LocationAutocomplete
                variant="outlined"
                placeholder="Type a city or town..."
                onSelectLocation={(loc) => {
                  const city = loc ? (loc.name || loc.fullName?.split(',')[0] || null) : null;
                  if (city) setSelectedCity(city);
                  else setSelectedCity(null);
                  setShowModal(false);
                }}
              />
            </View>
          </SafeAreaView>
        </View>
      </Modal>

      {/* ── Filter Bottom Sheet Modal ── */}
      <Modal
        visible={showFilterModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFilterModal(false)}
      >
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowFilterModal(false)} />
          <View style={{
            backgroundColor: isDark ? '#161616' : colors.surface,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingHorizontal: 24,
            paddingTop: 16,
            paddingBottom: 36,
            borderTopWidth: 1,
            borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : colors.border,
            maxHeight: '82%',
          }}>
            {/* Handle bar */}
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : colors.border, alignSelf: 'center', marginBottom: 20 }} />

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* ─ Category ─ */}
              <Text style={{ fontFamily: Typography.fontFamily.bold, fontSize: 15, color: colors.textPrimary, marginBottom: 14 }}>Category</Text>
              {TABS.map(tab => (
                <TouchableOpacity key={tab} onPress={() => setPendingTab(tab)}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.borderLight }}>
                  <View style={{
                    width: 20, height: 20, borderRadius: 10,
                    borderWidth: 2, borderColor: pendingTab === tab ? S.yellow : (isDark ? 'rgba(255,255,255,0.25)' : colors.border),
                    alignItems: 'center', justifyContent: 'center', marginRight: 14,
                  }}>
                    {pendingTab === tab && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: S.yellow }} />}
                  </View>
                  <Text style={{ fontFamily: Typography.fontFamily.semiBold, fontSize: 14, color: pendingTab === tab ? colors.textPrimary : colors.textSecondary }}>{tab}</Text>
                </TouchableOpacity>
              ))}

              {/* ─ Ball Type ─ */}
              <Text style={{ fontFamily: Typography.fontFamily.bold, fontSize: 15, color: colors.textPrimary, marginTop: 24, marginBottom: 14 }}>Ball Type</Text>
              {BALL_TYPES.map(bt => (
                <TouchableOpacity key={bt} onPress={() => setPendingBallType(bt)}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.borderLight }}>
                  <View style={{
                    width: 20, height: 20, borderRadius: 10,
                    borderWidth: 2, borderColor: pendingBallType === bt ? S.yellow : (isDark ? 'rgba(255,255,255,0.25)' : colors.border),
                    alignItems: 'center', justifyContent: 'center', marginRight: 14,
                  }}>
                    {pendingBallType === bt && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: S.yellow }} />}
                  </View>
                  <Text style={{ fontFamily: Typography.fontFamily.semiBold, fontSize: 14, color: pendingBallType === bt ? colors.textPrimary : colors.textSecondary }}>{bt}</Text>
                </TouchableOpacity>
              ))}

              {/* ─ Sort By ─ */}
              <Text style={{ fontFamily: Typography.fontFamily.bold, fontSize: 15, color: colors.textPrimary, marginTop: 24, marginBottom: 14 }}>Sort By</Text>
              {['all', ...(pendingTab === 'Batters' ? ['runs', 'average', 'high score', 'matches'] :
                pendingTab === 'Bowlers' ? ['wickets', 'economy', 'maidens', 'best', 'matches'] :
                ['catches', 'stumpings', 'run outs'])
              ].map(f => (
                <TouchableOpacity key={f} onPress={() => setPendingStatFilter(f)}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.borderLight }}>
                  <View style={{
                    width: 20, height: 20, borderRadius: 10,
                    borderWidth: 2, borderColor: pendingStatFilter === f ? S.yellow : (isDark ? 'rgba(255,255,255,0.25)' : colors.border),
                    alignItems: 'center', justifyContent: 'center', marginRight: 14,
                  }}>
                    {pendingStatFilter === f && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: S.yellow }} />}
                  </View>
                  <Text style={{ fontFamily: Typography.fontFamily.semiBold, fontSize: 14, color: pendingStatFilter === f ? colors.textPrimary : colors.textSecondary, textTransform: 'capitalize' }}>{f === 'all' ? 'All (Default)' : f}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Apply Button (Fixed at bottom) */}
            <TouchableOpacity
              onPress={applyFilter}
              style={{ marginTop: 20, backgroundColor: S.yellow, borderRadius: 14, paddingVertical: 16, alignItems: 'center' }}
            >
              <Text style={{ fontFamily: Typography.fontFamily.bold, fontSize: 15, color: S.black }}>Apply Filter</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────
const createStyles = (colors, shadows, isDark, S) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, },

  // ── My Rank Fixed Bottom Bar ─────────────────────────────────────────────
  myRankBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: isDark ? 'rgba(18,18,18,0.97)' : colors.surface,
    borderTopWidth: 1,
    borderTopColor: isDark ? 'rgba(255,212,0,0.2)' : colors.border,
    paddingTop: 12,
    paddingHorizontal: 16,
    ...(isDark ? {} : shadows.lg),
  },
  myRankInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: isDark ? 'rgba(255,212,0,0.08)' : colors.primaryAlpha10,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,212,0,0.25)' : colors.primaryAlpha30,
  },
  myRankBadge: {
    minWidth: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : colors.surfaceVariant,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.15)' : colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  myRankBadgeText: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: 14,
    color: isDark ? S.yellow : colors.primaryDark,
  },
  myRankName: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: 14,
    color: colors.textPrimary,
  },
  myRankSub: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  myRankScrollHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,212,0,0.12)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,212,0,0.25)',
  },
  myRankScrollText: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: 11,
    color: S.yellow,
  },

  // ── Header ──────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  iconBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1, borderColor: S.border,
    justifyContent: 'center', alignItems: 'center',
  },
  headerCenter: { flex: 1 },
  headerTitle: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: 18,
    color: S.white,
    lineHeight: 22,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 1,
  },
  headerCity: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: 11,
    color: S.yellow,
  },
  changeCityBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: S.yellowDim,
    borderWidth: 1,
    borderColor: S.borderYellow,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  changeCityText: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: 12,
    color: S.yellow,
  },

  // ── Category Tabs ────────────────────────────────────────────────────────
  tabsContainer: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  tabsTrack: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: S.border,
    padding: 3,
    position: 'relative',
  },
  tabPill: {
    position: 'absolute',
    top: 3,
    left: 3,
    height: '100%',
    backgroundColor: S.yellow,
    borderRadius: 11,
  },
  tabItem: {
    paddingVertical: 9,
    alignItems: 'center',
    zIndex: 1,
  },
  tabText: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: 13,
    color: S.textSecondary,
  },
  tabTextActive: {
    color: S.black,
    fontFamily: Typography.fontFamily.bold,
  },

  // ── Ball Type Tabs ───────────────────────────────────────────────────────
  ballTypeContainer: {
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  ballTypeTrack: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: S.border,
    padding: 3,
    position: 'relative',
  },
  ballTypePill: {
    position: 'absolute',
    top: 3,
    left: 3,
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  ballTypeItem: {
    paddingVertical: 7,
    alignItems: 'center',
    zIndex: 1,
  },
  ballTypeText: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: 12,
    color: S.textTertiary,
  },
  ballTypeTextActive: {
    color: S.white,
    fontFamily: Typography.fontFamily.semiBold,
  },

  // ── Podium ───────────────────────────────────────────────────────────────
  podiumGlowBg: {
    position: 'absolute',
    top: 0,
    left: width * 0.1,
    right: width * 0.1,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(255,212,0,0.05)',
    // Simulate radial glow
    shadowColor: S.yellow,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 60,
  },
  podiumRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 4,
    position: 'relative',
  },

  // ── Rankings separator ────────────────────────────────────────────────────
  rankingHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 20,
    marginBottom: 12,
    gap: 10,
  },
  rankingDivider: {
    flex: 1,
    height: 1,
    backgroundColor: S.border,
  },
  rankingHeaderLabel: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: 10,
    color: S.textTertiary,
    letterSpacing: 2,
  },

  // ── List ─────────────────────────────────────────────────────────────────
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  listCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, ...(isDark ? {} : shadows.xs),
    borderRadius: 18,
    borderWidth: 1,
    borderColor: S.border,
    padding: 14,
    gap: 12,
    // Glass shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  rankBubble: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: S.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankBubbleText: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: 12,
    color: S.textSecondary,
  },
  listInfo: { flex: 1 },
  listName: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: 14,
    color: S.white,
    marginBottom: 2,
  },
  listRole: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: 11,
    color: S.textSecondary,
    marginBottom: 8,
  },
  subStatsRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  subStatChip: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: S.border,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignItems: 'center',
    minWidth: 40,
  },
  subStatVal: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: 11,
    color: S.white,
  },
  subStatLbl: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: 9,
    color: S.textSecondary,
  },
  listStatBlock: { alignItems: 'flex-end' },
  listStatValue: {
    fontFamily: Typography.fontFamily.extraBold,
    fontSize: 22,
    color: S.yellow,
  },
  listStatLabel: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: 10,
    color: S.textSecondary,
  },

  // ── Empty States ──────────────────────────────────────────────────────────
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyIconWrap: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: S.yellowDim,
    borderWidth: 1,
    borderColor: S.borderYellow,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: 22,
    color: S.white,
    marginBottom: 8,
  },
  emptySub: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: 14,
    color: S.textSecondary,
    textAlign: 'center',
    marginBottom: 28,
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: S.yellow,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 28,
  },
  emptyBtnText: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: 15,
    color: S.black,
  },
  noData: {
    alignItems: 'center',
    paddingTop: 40,
  },
  noDataText: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: 14,
    color: S.textSecondary,
    textAlign: 'center',
    marginTop: 12,
  },

  // ── Modal ─────────────────────────────────────────────────────────────────
  modalRoot: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
  },
  modalTitle: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: 20,
    color: colors.textPrimary,
  },
  modalSub: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: 12,
    color: S.textSecondary,
    marginTop: 2,
  },
  popularSection: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  popularLabel: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: 10,
    color: S.textTertiary,
    letterSpacing: 2,
    marginBottom: 14,
  },
  popularRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  popularChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: S.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  popularChipText: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: 13,
    color: S.white,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 20,
    gap: 12,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: S.border,
  },
  dividerLabel: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: 10,
    color: S.textTertiary,
    letterSpacing: 1.5,
  },
});

export default GlobalLeaderboardScreen;
