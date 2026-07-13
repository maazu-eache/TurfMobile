import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  Image,
  Modal,
  ScrollView,
  Animated,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useDispatch, useSelector } from 'react-redux';
import { fetchTurfs, setSearchQuery } from '../../turf/turfSlice';
import { fetchRankings, fetchMyPlayer } from '../../player/playerSlice';
import { fetchMatches } from '../../match/matchSlice';
import { fetchTournaments } from '../../tournament/tournamentSlice';
import { toggleUserFavourite, setUserFavouriteStatus } from '../../auth/authSlice';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../../theme/theme';
import SkeletonPlaceholder from 'react-native-skeleton-placeholder';
import api from '../../../api/axios';
import { showCustomAlert } from '../../../components/CustomAlert';

// Ground (Turfs) is LAST
const TABS = [
  { id: 'players',     label: 'Players',     icon: 'account-multiple' },
  { id: 'matches',     label: 'Matches',     icon: 'cricket' },
  { id: 'tournaments', label: 'Tournaments', icon: 'trophy' },
  { id: 'turfs',       label: 'Ground',      icon: 'soccer-field' },
];

const TURF_QUICK_FILTERS = [
  { id: 'all',      icon: 'soccer-field',        label: 'All',      value: '' },
  { id: 'verified', icon: 'check-decagram',       label: 'Verified', value: 'verified' },
  { id: 'lights',   icon: 'lightbulb-on',         label: 'Floodlit', value: 'floodLights' },
  { id: 'parking',  icon: 'parking',              label: 'Parking',  value: 'parking' },
  { id: 'washroom', icon: 'shower',               label: 'Washroom', value: 'washroom' },
];
const PLAYER_QUICK_FILTERS = [
  { id: 'all',           icon: 'account',   label: 'All',          value: '' },
  { id: 'batsman',       icon: 'cricket',   label: 'Batsman',      value: 'Batsman' },
  { id: 'bowler',        icon: 'baseball',  label: 'Bowler',       value: 'Bowler' },
  { id: 'all_rounder',   icon: 'star',      label: 'All-Rounder',  value: 'All Rounder' },
  { id: 'wicket_keeper', icon: 'handball',  label: 'WK',           value: 'Wicket Keeper' },
];
const MATCH_QUICK_FILTERS = [
  { id: 'all',       icon: 'cricket',              label: 'All',       value: '' },
  { id: 'live',      icon: 'record-circle-outline', label: 'Live',      value: 'in_progress' },
  { id: 'scheduled', icon: 'calendar-clock',        label: 'Scheduled', value: 'scheduled' },
  { id: 'completed', icon: 'check-circle-outline',  label: 'Completed', value: 'completed' },
];
const TOURNAMENT_QUICK_FILTERS = [
  { id: 'all',       icon: 'trophy',             label: 'All',      value: '' },
  { id: 'reg_open',  icon: 'lock-open-outline',   label: 'Reg Open', value: 'registration_open' },
  { id: 'ongoing',   icon: 'play-circle-outline', label: 'Ongoing',  value: 'ongoing' },
  { id: 'completed', icon: 'trophy-outline',      label: 'Finished', value: 'completed' },
];

const SearchScreen = ({ navigation, route }) => {
  const dispatch = useDispatch();
  const user = useSelector((s) => s.auth?.user);
  const favourites = user?.favourites?.map(f => typeof f === 'string' ? f : f._id || f) || [];

  const { turfs = [], isLoading: turfLoading = false, searchQuery = '' } = useSelector((s) => s.turf || {});
  const { rankings: players = [], isLoading: playerLoading = false, myProfile = null } = useSelector((s) => s.player || {});
  const { matches = [], isLoading: matchLoading = false } = useSelector((s) => s.match || {});
  const { tournaments = [], isLoading: tournamentLoading = false } = useSelector((s) => s.tournament || {});

  const [activeTab, setActiveTab] = useState('players');
  const [isFilterVisible, setFilterVisible] = useState(false);
  const [cityFilter, setCityFilter] = useState('');
  const [minTrustScore, setMinTrustScore] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [sortOrder, setSortOrder] = useState('');
  const [activeTurfFilter, setActiveTurfFilter] = useState('all');
  const [playerRoleFilter, setPlayerRoleFilter] = useState('');
  const [matchStatusFilter, setMatchStatusFilter] = useState('');
  const [tournamentStatusFilter, setTournamentStatusFilter] = useState('');

  const slideAnim = useRef(new Animated.Value(700)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!myProfile && user) dispatch(fetchMyPlayer());
  }, [dispatch, myProfile, user]);

  useEffect(() => {
    if (route?.params?.tab) {
      setActiveTab(route.params.tab);
      navigation.setParams({ tab: undefined });
    }
  }, [route?.params?.tab, navigation]);

  useEffect(() => {
    const city = myProfile?.city || user?.city || '';
    if (city && !cityFilter) setCityFilter(city);
  }, [myProfile, user]);

  useEffect(() => {
    const t = setTimeout(() => {
      const city = cityFilter.trim();
      if (activeTab === 'turfs') {
        const queryParams = { search: searchQuery || undefined, city, minTrustScore, maxPrice, sort: sortOrder };
        if (activeTurfFilter !== 'all') {
          if (activeTurfFilter === 'verified') queryParams.isVerified = 'true';
          else queryParams[activeTurfFilter] = 'true';
        }
        dispatch(fetchTurfs(queryParams));
      } else if (activeTab === 'players') {
        dispatch(fetchRankings({ search: searchQuery, city, role: playerRoleFilter || undefined }));
      } else if (activeTab === 'matches') {
        dispatch(fetchMatches({ search: searchQuery, city, status: matchStatusFilter || undefined }));
      } else {
        dispatch(fetchTournaments({ search: searchQuery, city, status: tournamentStatusFilter || undefined }));
      }
    }, 450);
    return () => clearTimeout(t);
  }, [searchQuery, cityFilter, activeTab, minTrustScore, maxPrice, sortOrder, activeTurfFilter, playerRoleFilter, matchStatusFilter, tournamentStatusFilter, dispatch]);

  const openModal = () => {
    setFilterVisible(true);
    Animated.parallel([
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 150 }),
      Animated.timing(overlayAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();
  };

  const closeModal = () => {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 700, duration: 300, useNativeDriver: true }),
      Animated.timing(overlayAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => setFilterVisible(false));
  };

  const resetFilters = () => {
    setCityFilter(''); setMinTrustScore(''); setMaxPrice(''); setSortOrder('');
    setPlayerRoleFilter(''); setMatchStatusFilter(''); setTournamentStatusFilter('');
    setActiveTurfFilter('all');
  };

  const hasActiveFilters = cityFilter || minTrustScore || maxPrice || sortOrder || playerRoleFilter || matchStatusFilter || tournamentStatusFilter || activeTurfFilter !== 'all';

  const activeLoading = activeTab === 'turfs' ? turfLoading : activeTab === 'players' ? playerLoading : activeTab === 'matches' ? matchLoading : tournamentLoading;
  const activeDataList = activeTab === 'turfs' ? turfs : activeTab === 'players' ? players : activeTab === 'matches' ? matches : tournaments;

  const getMinPrice = (pricing) => {
    if (!pricing) return 0;
    const p = [pricing.weekdayDay, pricing.weekdayNight, pricing.weekendDay, pricing.weekendNight].filter(x => x > 0);
    return p.length ? Math.min(...p) : 0;
  };

  const getImageUrl = (path) => {
    if (!path) return 'https://via.placeholder.com/400x200';
    if (path.startsWith('http')) return path;
    const base = api.defaults.baseURL.replace('/api', '');
    return `${base}${path.startsWith('/') ? '' : '/'}${path}`;
  };

  const getMatchScore = (match) => {
    if (!match.innings?.length) return null;
    return match.innings.map(inn => {
      const team = inn.battingTeam === match.teamA._id || inn.battingTeam?._id === match.teamA._id ? match.teamA : match.teamB;
      return `${team?.shortName || team?.name || 'Team'} ${inn.runs}/${inn.wickets} (${inn.overs})`;
    }).join(' vs ');
  };

  const getQuickFilters = () => activeTab === 'turfs' ? TURF_QUICK_FILTERS : activeTab === 'players' ? PLAYER_QUICK_FILTERS : activeTab === 'matches' ? MATCH_QUICK_FILTERS : TOURNAMENT_QUICK_FILTERS;
  const getActiveQuickFilter = () => activeTab === 'turfs' ? activeTurfFilter : activeTab === 'players' ? (playerRoleFilter || 'all') : activeTab === 'matches' ? (matchStatusFilter || 'all') : (tournamentStatusFilter || 'all');

  const handleQuickFilter = (qf) => {
    if (activeTab === 'turfs') setActiveTurfFilter(qf.id);
    else if (activeTab === 'players') setPlayerRoleFilter(qf.value);
    else if (activeTab === 'matches') setMatchStatusFilter(qf.value);
    else setTournamentStatusFilter(qf.value);
  };

  // ─── Card Renderers ──────────────────────────────────────────────────────

  const renderTurfItem = ({ item }) => {
    const isFav = favourites.includes(item._id);
    const minPrice = getMinPrice(item.pricing);
    const trustScore = item.owner?.trustScore || item.ownerInfo?.trustScore;
    const isVerified = item.isVerified || item.owner?.isVerifiedOwner || item.ownerInfo?.isVerifiedOwner;

    return (
      <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('TurfDetail', { id: item._id })} activeOpacity={0.93}>
        {/* Image */}
        <View style={styles.cardImgWrap}>
          <Image source={{ uri: getImageUrl(item.coverImage) }} style={styles.cardImg} />
          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.9)']} style={styles.cardImgGrad} />

          {/* Top badges */}
          <View style={styles.cardBadgeRow}>
            {isVerified && (
              <View style={styles.badgeVerified}>
                <Icon name="check-decagram" size={10} color="#000" />
                <Text style={styles.badgeText}>Verified</Text>
              </View>
            )}
            {trustScore !== undefined && (
              <View style={[styles.badgeTrust, { backgroundColor: trustScore >= 80 ? '#2ED573' : '#FF9800' }]}>
                <Icon name="shield-star" size={10} color="#000" />
                <Text style={styles.badgeText}>{trustScore}%</Text>
              </View>
            )}
          </View>

          {/* Fav button */}
          <TouchableOpacity
            style={[styles.favBtn, isFav && styles.favBtnActive]}
            onPress={async () => {
              dispatch(toggleUserFavourite(item._id));
              try {
                const res = await api.post(`/users/favourites/${item._id}`);
                const status = res.data?.data?.isFavourite;
                if (status !== undefined) dispatch(setUserFavouriteStatus({ id: item._id, isFavourite: status }));
              } catch {
                dispatch(toggleUserFavourite(item._id));
                showCustomAlert('Error', 'Failed to update favourites');
              }
            }}
          >
            <Icon name={isFav ? 'heart' : 'heart-outline'} size={16} color={isFav ? '#FF4757' : '#fff'} />
          </TouchableOpacity>

          {/* Price tag */}
          <View style={styles.priceTag}>
            <Text style={styles.priceAmount}>₹{minPrice}</Text>
            <Text style={styles.priceUnit}>/hr</Text>
          </View>
        </View>

        {/* Body */}
        <View style={styles.cardBody}>
          <View style={styles.cardRow}>
            <Text style={styles.cardTitle} numberOfLines={1}>{item.name}</Text>
            <View style={styles.ratingPill}>
              <Icon name="star" size={11} color={Colors.primary} />
              <Text style={styles.ratingText}>{item.rating > 0 ? item.rating.toFixed(1) : 'New'}</Text>
            </View>
          </View>
          <View style={styles.cardRow2}>
            <Icon name="map-marker-outline" size={13} color={Colors.primary} />
            <Text style={styles.cardSubText} numberOfLines={1}>{item.city}</Text>
          </View>

          {/* Amenities */}
          {(item.amenities?.floodLights || item.amenities?.parking || item.amenities?.washroom) && (
            <View style={styles.amenitiesWrap}>
              {item.amenities?.floodLights && <AmenityChip icon="lightbulb-on" label="Lights" />}
              {item.amenities?.parking && <AmenityChip icon="parking" label="Parking" />}
              {item.amenities?.washroom && <AmenityChip icon="shower" label="Washroom" />}
            </View>
          )}

          <TouchableOpacity style={styles.bookBtn} onPress={() => navigation.navigate('TurfDetail', { id: item._id })} activeOpacity={0.85}>
            <LinearGradient colors={Colors.primaryGradient} style={styles.bookBtnInner} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <Icon name="calendar-check" size={15} color="#000" />
              <Text style={styles.bookBtnText}>Book Now</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderPlayerItem = ({ item }) => {
    const photo = item.photo || item.userId?.photo;
    return (
      <TouchableOpacity style={styles.playerCard} onPress={() => navigation.navigate('PlayerDetail', { id: item._id })} activeOpacity={0.9}>
        {photo
          ? <Image source={{ uri: getImageUrl(photo) }} style={styles.avatar} />
          : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarLetter}>{item.name?.[0]?.toUpperCase() || '?'}</Text>
            </View>
          )
        }
        <View style={styles.playerMeta}>
          <Text style={styles.playerName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.playerRole} numberOfLines={1}>{item.playingRole || 'Cricket Player'} · {item.city || '—'}</Text>
          <View style={styles.playerStats}>
            <StatChip icon="account-group" label={`${item.followers?.length || 0} Followers`} />
            {item.ranking && <StatChip icon="trophy-outline" label={`Rank #${item.ranking}`} primary />}
          </View>
        </View>
        <Icon name="chevron-right" size={20} color={Colors.textTertiary} />
      </TouchableOpacity>
    );
  };

  const renderMatchItem = ({ item }) => {
    const STATUS = { scheduled: 'Scheduled', toss_done: 'Toss Done', in_progress: 'LIVE', innings_break: 'Break', super_over: 'Super Over', completed: 'Completed', abandoned: 'Abandoned', no_result: 'No Result' };
    const isLive = item.status === 'in_progress' || item.status === 'super_over';
    const isDone = item.status === 'completed';
    const score = getMatchScore(item);

    return (
      <TouchableOpacity
        style={styles.matchCard}
        onPress={() => navigation.navigate(isLive ? 'Spectator' : isDone ? 'Scorecard' : 'MatchSummary', { id: item._id })}
        activeOpacity={0.9}
      >
        {/* Header row */}
        <View style={styles.matchTopRow}>
          <View style={styles.formatPill}>
            <Text style={styles.formatText}>{item.format || 'Custom'} · {item.overs} Overs</Text>
          </View>
          <View style={[styles.statusPill, isLive && styles.statusPillLive, isDone && styles.statusPillDone]}>
            {isLive && <View style={styles.liveDot} />}
            <Text style={[styles.statusText, isLive && styles.statusTextLive, isDone && styles.statusTextDone]}>
              {STATUS[item.status] || item.status}
            </Text>
          </View>
        </View>

        {/* Teams */}
        <View style={styles.teamsRow}>
          <TeamBlock logo={item.teamA?.logo ? getImageUrl(item.teamA.logo) : null} name={item.teamA?.name} />
          <View style={styles.vsBox}><Text style={styles.vsText}>VS</Text></View>
          <TeamBlock logo={item.teamB?.logo ? getImageUrl(item.teamB.logo) : null} name={item.teamB?.name} right />
        </View>

        {/* Score / venue */}
        {score ? (
          <View style={styles.scoreRow}>
            <Icon name="scoreboard-outline" size={13} color={Colors.primary} />
            <Text style={styles.scoreText} numberOfLines={1}>{score}</Text>
          </View>
        ) : item.result?.summary ? (
          <View style={styles.scoreRow}>
            <Text style={styles.resultText} numberOfLines={1}>{item.result.summary}</Text>
          </View>
        ) : (
          <View style={styles.venueRow}>
            <Icon name="map-marker-outline" size={13} color={Colors.textTertiary} />
            <Text style={styles.venueText} numberOfLines={1}>{item.turf?.name || 'RoughTurf Ground'}{item.turf?.city ? ` · ${item.turf.city}` : ''}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderTournamentItem = ({ item }) => {
    const statusLabel = item.status === 'registration_open' ? 'Reg Open' : item.status === 'ongoing' ? 'Ongoing' : 'Finished';
    const statusColor = item.status === 'registration_open' ? Colors.success : item.status === 'ongoing' ? Colors.warning : Colors.textTertiary;

    return (
      <TouchableOpacity style={styles.tCard} onPress={() => navigation.navigate('TournamentDetail', { id: item._id })} activeOpacity={0.92}>
        <View style={styles.tBannerWrap}>
          {item.banner
            ? <Image source={{ uri: getImageUrl(item.banner) }} style={styles.tBanner} />
            : <LinearGradient colors={['#0D2136', '#011528']} style={styles.tBannerFallback}>
                <Icon name="trophy" size={44} color={Colors.primaryAlpha30} />
              </LinearGradient>
          }
          {/* Status pill */}
          <View style={[styles.tStatusPill, { borderColor: statusColor }]}>
            <View style={[styles.tStatusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.tStatusText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
        </View>

        <View style={styles.tBody}>
          <Text style={styles.tName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.tMeta}>{item.format} · {item.overs} Ov · {item.ballType} ball</Text>
          <View style={styles.tFooter}>
            <View style={styles.tInfoRow}>
              <Icon name="gift-outline" size={13} color={Colors.primary} />
              <Text style={styles.tPrize}>₹{item.winningPrize || 0} Prize</Text>
            </View>
            <View style={styles.tInfoRow}>
              <Icon name="map-marker-outline" size={13} color={Colors.textSecondary} />
              <Text style={styles.tVenue} numberOfLines={1}>{item.turf?.name || 'Local Ground'}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderSkeleton = () => (
    <SkeletonPlaceholder backgroundColor={Colors.backgroundElevated} highlightColor={Colors.surfaceVariant}>
      <View style={{ gap: 16, padding: 16 }}>
        {[1, 2].map(i => (
          <View key={i} style={{ borderRadius: 16, overflow: 'hidden' }}>
            <View style={{ width: '100%', height: 170 }} />
            <View style={{ padding: 14, gap: 10 }}>
              <View style={{ width: '55%', height: 18, borderRadius: 6 }} />
              <View style={{ width: '35%', height: 12, borderRadius: 6 }} />
              <View style={{ width: '100%', height: 38, borderRadius: 10, marginTop: 6 }} />
            </View>
          </View>
        ))}
      </View>
    </SkeletonPlaceholder>
  );

  const emptyTabLabel = activeTab === 'turfs' ? 'grounds' : activeTab;
  const emptyIcon = activeTab === 'turfs' ? 'soccer-field' : activeTab === 'players' ? 'account-multiple' : activeTab === 'matches' ? 'cricket' : 'trophy';

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#0A1F35" />

      {/* ── HEADER ── */}
      <View style={styles.header}>
        {/* Title row */}
        <View style={styles.titleRow}>
          <View>
            <Text style={styles.screenLabel}>SEARCH DIRECTORY</Text>
            <Text style={styles.screenTitle}>Find Turf & Cricket</Text>
          </View>
          {cityFilter ? (
            <TouchableOpacity style={styles.cityPill} onPress={() => setCityFilter('')} activeOpacity={0.8}>
              <Icon name="map-marker" size={11} color={Colors.primary} />
              <Text style={styles.cityPillText} numberOfLines={1}>{cityFilter}</Text>
              <Icon name="close" size={9} color={Colors.primary} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Search bar */}
        <View style={styles.searchBar}>
          <Icon name="magnify" size={19} color={Colors.textTertiary} style={{ marginRight: 6 }} />
          <TextInput
            style={styles.searchInput}
            placeholder={`Search ${activeTab === 'turfs' ? 'grounds' : activeTab}…`}
            placeholderTextColor={Colors.textTertiary}
            value={searchQuery}
            onChangeText={t => dispatch(setSearchQuery(t))}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => dispatch(setSearchQuery(''))}>
              <Icon name="close-circle" size={17} color={Colors.textTertiary} />
            </TouchableOpacity>
          )}
          <View style={styles.searchDivider} />
          <TouchableOpacity onPress={openModal} style={styles.filterBtn} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Icon name="tune-variant" size={19} color={hasActiveFilters ? Colors.primary : Colors.textSecondary} />
            {hasActiveFilters && <View style={styles.filterDot} />}
          </TouchableOpacity>
        </View>

        {/* ── MAIN TABS ── */}
        <View style={styles.mainTabContainer}>
          <TouchableOpacity 
            style={[styles.mainTab, (activeTab !== 'turfs') && styles.mainTabActive]}
            onPress={() => setActiveTab('players')}
            activeOpacity={0.8}
          >
            <Icon name="cricket" size={16} color={(activeTab !== 'turfs') ? '#000' : Colors.textSecondary} />
            <Text style={[styles.mainTabText, (activeTab !== 'turfs') && styles.mainTabTextActive]}>Cricket</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.mainTab, activeTab === 'turfs' && styles.mainTabActive]}
            onPress={() => setActiveTab('turfs')}
            activeOpacity={0.8}
          >
            <Icon name="soccer-field" size={16} color={activeTab === 'turfs' ? '#000' : Colors.textSecondary} />
            <Text style={[styles.mainTabText, activeTab === 'turfs' && styles.mainTabTextActive]}>Grounds</Text>
          </TouchableOpacity>
        </View>

        {/* ── SUB TABS (only for cricket) ── */}
        {activeTab !== 'turfs' && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabBarContent}
            style={styles.tabBarScroll}
          >
            {TABS.filter(t => t.id !== 'turfs').map(tab => {
              const active = activeTab === tab.id;
              return (
                <TouchableOpacity
                  key={tab.id}
                  onPress={() => setActiveTab(tab.id)}
                  activeOpacity={0.75}
                  style={[styles.tab, active && styles.tabActive]}
                >
                  <Icon name={tab.icon} size={14} color={active ? '#000' : Colors.textSecondary} />
                  <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* ── QUICK FILTER PILLS ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.quickRow}
        >
          {getQuickFilters().map(qf => {
            const curActive = getActiveQuickFilter();
            const qfActive = curActive === qf.id || (qf.value !== '' && curActive === qf.value);
            return (
              <TouchableOpacity
                key={qf.id}
                style={[styles.qfPill, qfActive && styles.qfPillActive]}
                onPress={() => handleQuickFilter(qf)}
                activeOpacity={0.8}
              >
                <Icon name={qf.icon} size={11} color={qfActive ? '#000' : Colors.textSecondary} />
                <Text style={[styles.qfText, qfActive && styles.qfTextActive]}>{qf.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── CONTENT LIST ── */}
      {activeLoading && activeDataList.length === 0 ? renderSkeleton() : (
        <FlatList
          data={activeDataList}
          keyExtractor={item => item._id}
          renderItem={
            activeTab === 'turfs' ? renderTurfItem :
            activeTab === 'players' ? renderPlayerItem :
            activeTab === 'matches' ? renderMatchItem :
            renderTournamentItem
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <LinearGradient colors={[Colors.primaryAlpha10, 'transparent']} style={styles.emptyCircle}>
                <Icon name={emptyIcon} size={36} color={Colors.primary} />
              </LinearGradient>
              <Text style={styles.emptyTitle}>No {emptyTabLabel} found</Text>
              <Text style={styles.emptySub}>Try adjusting your filters or location</Text>
            </View>
          }
        />
      )}

      {/* ── FILTER MODAL ── */}
      <Modal visible={isFilterVisible} transparent animationType="none" onRequestClose={closeModal}>
        <Animated.View style={[styles.overlay, { opacity: overlayAnim }]}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={closeModal} />
        </Animated.View>

        <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.sheetHandle} />

          <View style={styles.sheetHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={styles.sheetIconBox}>
                <Icon name="tune-variant" size={17} color={Colors.primary} />
              </View>
              <View>
                <Text style={styles.sheetTitle}>Filters</Text>
                <Text style={styles.sheetSub}>Refine your search</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.sheetCloseBtn} onPress={closeModal}>
              <Icon name="close" size={18} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.sheetBody} showsVerticalScrollIndicator={false}>
            <FilterSection icon="map-marker-outline" label="City Location">
              <View style={styles.inputRow}>
                <Icon name="city-variant-outline" size={17} color={Colors.textTertiary} />
                <TextInput style={styles.input} placeholder="e.g. Ambur" placeholderTextColor={Colors.textTertiary} value={cityFilter} onChangeText={setCityFilter} />
                {cityFilter.length > 0 && <TouchableOpacity onPress={() => setCityFilter('')}><Icon name="close-circle-outline" size={17} color={Colors.textTertiary} /></TouchableOpacity>}
              </View>
            </FilterSection>

            {activeTab === 'turfs' && (
              <>
                <FilterSection icon="shield-star-outline" label="Min Trust Score">
                  <View style={styles.inputRow}>
                    <Icon name="shield-star-outline" size={17} color={Colors.textTertiary} />
                    <TextInput style={styles.input} placeholder="e.g. 80" keyboardType="numeric" placeholderTextColor={Colors.textTertiary} value={minTrustScore} onChangeText={setMinTrustScore} />
                  </View>
                </FilterSection>

                <FilterSection icon="currency-inr" label="Max Hourly Price">
                  <View style={styles.inputRow}>
                    <Text style={styles.rupee}>₹</Text>
                    <TextInput style={styles.input} placeholder="e.g. 1500" keyboardType="numeric" placeholderTextColor={Colors.textTertiary} value={maxPrice} onChangeText={setMaxPrice} />
                  </View>
                </FilterSection>

                <FilterSection icon="sort-variant" label="Sort By Price">
                  <View style={styles.sortRow}>
                    <SortChip label="Low → High" icon="arrow-up" active={sortOrder === 'price_asc'} onPress={() => setSortOrder(sortOrder === 'price_asc' ? '' : 'price_asc')} />
                    <SortChip label="High → Low" icon="arrow-down" active={sortOrder === 'price_desc'} onPress={() => setSortOrder(sortOrder === 'price_desc' ? '' : 'price_desc')} />
                  </View>
                </FilterSection>
              </>
            )}

            {activeTab === 'players' && (
              <FilterSection icon="baseball" label="Playing Role">
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
                  {PLAYER_QUICK_FILTERS.map(f => (
                    <TouchableOpacity key={f.id} style={[styles.roleChip, playerRoleFilter === f.value && styles.roleChipActive]} onPress={() => setPlayerRoleFilter(f.value)}>
                      <Text style={[styles.roleChipText, playerRoleFilter === f.value && styles.roleChipTextActive]}>{f.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </FilterSection>
            )}

            {activeTab === 'matches' && (
              <FilterSection icon="scoreboard-outline" label="Match Status">
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
                  {MATCH_QUICK_FILTERS.map(f => (
                    <TouchableOpacity key={f.id} style={[styles.roleChip, matchStatusFilter === f.value && styles.roleChipActive]} onPress={() => setMatchStatusFilter(f.value)}>
                      <Text style={[styles.roleChipText, matchStatusFilter === f.value && styles.roleChipTextActive]}>{f.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </FilterSection>
            )}

            <View style={{ height: 32 }} />
          </ScrollView>

          <View style={styles.sheetFooter}>
            <TouchableOpacity style={styles.resetBtn} onPress={resetFilters}>
              <Icon name="refresh" size={16} color={Colors.textSecondary} />
              <Text style={styles.resetBtnText}>Reset</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.applyBtnWrap} onPress={closeModal}>
              <LinearGradient colors={Colors.primaryGradient} style={styles.applyBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <Icon name="check" size={16} color="#000" />
                <Text style={styles.applyBtnText}>Apply Filters</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Modal>
    </SafeAreaView>
  );
};

// ── Small helper components ──────────────────────────────────────────────────

const AmenityChip = ({ icon, label }) => (
  <View style={styles.amenityChip}>
    <Icon name={icon} size={11} color={Colors.primary} />
    <Text style={styles.amenityChipText}>{label}</Text>
  </View>
);

const StatChip = ({ icon, label, primary }) => (
  <View style={styles.statChip}>
    <Icon name={icon} size={10} color={primary ? Colors.primary : Colors.textSecondary} />
    <Text style={[styles.statChipText, primary && { color: Colors.primary }]}>{label}</Text>
  </View>
);

const TeamBlock = ({ logo, name, right }) => (
  <View style={[styles.teamBlock, right && { alignItems: 'flex-end' }]}>
    {logo
      ? <Image source={{ uri: logo }} style={styles.teamLogo} />
      : <View style={styles.teamLogoFb}><Text style={styles.teamLogoLetter}>{name?.[0]}</Text></View>
    }
    <Text style={styles.teamName} numberOfLines={2}>{name}</Text>
  </View>
);

const FilterSection = ({ icon, label, children }) => (
  <View style={styles.filterSection}>
    <View style={styles.filterLabelRow}>
      <Icon name={icon} size={15} color={Colors.primary} />
      <Text style={styles.filterLabel}>{label}</Text>
    </View>
    {children}
  </View>
);

const SortChip = ({ label, icon, active, onPress }) => (
  <TouchableOpacity style={[styles.sortChip, active && styles.sortChipActive]} onPress={onPress}>
    {active
      ? <LinearGradient colors={Colors.primaryGradient} style={styles.sortChipGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
          <Icon name={icon} size={13} color="#000" />
          <Text style={styles.sortChipTextActive}>{label}</Text>
        </LinearGradient>
      : <>
          <Icon name={icon} size={13} color={Colors.textSecondary} />
          <Text style={styles.sortChipText}>{label}</Text>
        </>
    }
  </TouchableOpacity>
);

// ── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0A1F35' },

  /* Header */
  header: {
    backgroundColor: '#0A1F35',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 0,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  screenLabel: {
    color: Colors.primary,
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  screenTitle: {
    color: '#FFFFFF',
    fontFamily: Typography.fontFamily.bold,
    fontSize: 20,
    marginTop: 1,
  },
  cityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryAlpha10,
    borderWidth: 1,
    borderColor: Colors.primaryAlpha30,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 4,
    maxWidth: 110,
  },
  cityPillText: {
    color: Colors.primary,
    fontFamily: Typography.fontFamily.bold,
    fontSize: 11,
    flexShrink: 1,
  },

  /* Search Bar */
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 46,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontFamily: Typography.fontFamily.medium,
    fontSize: 14,
    height: '100%',
  },
  searchDivider: {
    width: 1,
    height: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginHorizontal: 10,
  },
  filterBtn: {
    position: 'relative',
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterDot: {
    position: 'absolute',
    top: 1,
    right: 0,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: Colors.primary,
    borderWidth: 1.5,
    borderColor: Colors.backgroundCard,
  },

  /* Main Tabs */
  mainTabContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 2,
    marginBottom: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10,
    padding: 4,
  },
  mainTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
  },
  mainTabActive: {
    backgroundColor: Colors.primary,
  },
  mainTabText: {
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: 13,
  },
  mainTabTextActive: {
    color: '#000',
    fontFamily: Typography.fontFamily.bold,
    fontSize: 13,
  },

  /* Tab Bar — horizontal scroll so all 4 always visible */
  tabBarScroll: {
    marginBottom: 8,
  },
  tabBarContent: {
    paddingVertical: 4,
    gap: 8,
    paddingLeft: 16,
    paddingRight: 16,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: Colors.backgroundCard,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  tabActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  tabText: {
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: 12,
  },
  tabTextActive: {
    color: '#000',
    fontFamily: Typography.fontFamily.bold,
    fontSize: 12,
  },

  /* Quick Filters */
  quickRow: {
    paddingBottom: 10,
    paddingTop: 2,
    gap: 8,
    paddingLeft: 16,
    paddingRight: 16,
  },
  qfPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: Colors.backgroundCard,
  },
  qfPillActive: {
    backgroundColor: Colors.primaryAlpha20,
    borderColor: Colors.primary,
  },
  qfText: {
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.medium,
    fontSize: 11,
  },
  qfTextActive: {
    color: Colors.primary,
    fontFamily: Typography.fontFamily.bold,
    fontSize: 11,
  },

  /* List */
  listContent: {
    padding: 14,
    paddingBottom: 20,
    gap: 14,
    backgroundColor: Colors.background,
    flexGrow: 1,
  },

  /* ── Turf Card ── */
  card: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    ...Shadows.sm,
  },
  cardImgWrap: { width: '100%', height: 172, position: 'relative' },
  cardImg: { width: '100%', height: '100%' },
  cardImgGrad: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '70%' },
  cardBadgeRow: { position: 'absolute', top: 12, left: 12, flexDirection: 'row', gap: 6 },
  badgeVerified: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Colors.primary, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  badgeTrust: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  badgeText: { color: '#000', fontFamily: Typography.fontFamily.bold, fontSize: 9, textTransform: 'uppercase' },
  favBtn: { position: 'absolute', top: 10, right: 10, width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  favBtnActive: { backgroundColor: 'rgba(255,71,87,0.2)' },
  priceTag: { position: 'absolute', bottom: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.75)', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4, flexDirection: 'row', alignItems: 'baseline', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  priceAmount: { color: '#FFFFFF', fontFamily: Typography.fontFamily.bold, fontSize: 14 },
  priceUnit: { color: Colors.textSecondary, fontSize: 10, marginLeft: 2 },

  cardBody: { padding: 14 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardRow2: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  cardTitle: { color: '#FFFFFF', fontFamily: Typography.fontFamily.bold, fontSize: 15, flex: 1, marginRight: 8 },
  cardSubText: { color: Colors.textSecondary, fontFamily: Typography.fontFamily.regular, fontSize: 12 },
  ratingPill: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Colors.primaryAlpha10, borderWidth: 1, borderColor: Colors.primaryAlpha30, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  ratingText: { color: Colors.primary, fontFamily: Typography.fontFamily.bold, fontSize: 11 },

  amenitiesWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  amenityChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.backgroundElevated, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  amenityChipText: { color: Colors.textSecondary, fontFamily: Typography.fontFamily.medium, fontSize: 10 },

  bookBtn: { marginTop: 10, borderRadius: 12, overflow: 'hidden' },
  bookBtnInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 11, gap: 6 },
  bookBtnText: { color: '#000', fontFamily: Typography.fontFamily.bold, fontSize: 13 },

  /* ── Player Card ── */
  playerCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.backgroundCard, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 16, padding: 14, gap: 12 },
  avatar: { width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: Colors.primaryAlpha30 },
  avatarFallback: { width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.primaryAlpha10, borderWidth: 1, borderColor: Colors.primaryAlpha30, alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { color: Colors.primary, fontFamily: Typography.fontFamily.bold, fontSize: 20 },
  playerMeta: { flex: 1 },
  playerName: { color: '#FFFFFF', fontFamily: Typography.fontFamily.bold, fontSize: 14 },
  playerRole: { color: Colors.textSecondary, fontFamily: Typography.fontFamily.regular, fontSize: 11, marginTop: 2 },
  playerStats: { flexDirection: 'row', gap: 6, marginTop: 6 },
  statChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.backgroundElevated, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  statChipText: { color: Colors.textSecondary, fontFamily: Typography.fontFamily.medium, fontSize: 10 },

  /* ── Match Card ── */
  matchCard: { backgroundColor: Colors.backgroundCard, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', padding: 14, gap: 10 },
  matchTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  formatPill: { backgroundColor: Colors.backgroundElevated, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  formatText: { color: Colors.textSecondary, fontFamily: Typography.fontFamily.bold, fontSize: 10 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.backgroundElevated, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  statusPillLive: { backgroundColor: Colors.errorLight },
  statusPillDone: { backgroundColor: Colors.primaryAlpha10 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.error },
  statusText: { color: Colors.textSecondary, fontFamily: Typography.fontFamily.bold, fontSize: 10 },
  statusTextLive: { color: Colors.error },
  statusTextDone: { color: Colors.primary },

  teamsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  teamBlock: { alignItems: 'flex-start', width: '38%' },
  teamLogo: { width: 42, height: 42, borderRadius: 21, marginBottom: 5, borderWidth: 1, borderColor: Colors.primaryAlpha30 },
  teamLogoFb: { width: 42, height: 42, borderRadius: 21, backgroundColor: Colors.primaryAlpha10, borderWidth: 1, borderColor: Colors.primaryAlpha30, alignItems: 'center', justifyContent: 'center', marginBottom: 5 },
  teamLogoLetter: { color: Colors.primary, fontFamily: Typography.fontFamily.bold, fontSize: 16 },
  teamName: { color: '#FFFFFF', fontFamily: Typography.fontFamily.bold, fontSize: 12, textAlign: 'left' },
  vsBox: { alignItems: 'center', justifyContent: 'center', width: '24%' },
  vsText: { color: Colors.textTertiary, fontFamily: Typography.fontFamily.bold, fontSize: 13 },

  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.backgroundElevated, borderRadius: 8, paddingVertical: 7, paddingHorizontal: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  scoreText: { color: '#FFFFFF', fontFamily: Typography.fontFamily.bold, fontSize: 11, flex: 1 },
  resultText: { color: Colors.primary, fontFamily: Typography.fontFamily.bold, fontSize: 11 },
  venueRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  venueText: { color: Colors.textSecondary, fontFamily: Typography.fontFamily.regular, fontSize: 11 },

  /* ── Tournament Card ── */
  tCard: { backgroundColor: Colors.backgroundCard, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', overflow: 'hidden', ...Shadows.sm },
  tBannerWrap: { width: '100%', height: 110, backgroundColor: '#0D2136', position: 'relative' },
  tBanner: { width: '100%', height: '100%' },
  tBannerFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tStatusPill: { position: 'absolute', top: 10, right: 10, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4, borderWidth: 1 },
  tStatusDot: { width: 6, height: 6, borderRadius: 3 },
  tStatusText: { fontFamily: Typography.fontFamily.bold, fontSize: 10 },
  tBody: { padding: 14 },
  tName: { color: '#FFFFFF', fontFamily: Typography.fontFamily.bold, fontSize: 15 },
  tMeta: { color: Colors.textSecondary, fontFamily: Typography.fontFamily.regular, fontSize: 11, marginTop: 3 },
  tFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', paddingTop: 8 },
  tInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tPrize: { color: Colors.primary, fontFamily: Typography.fontFamily.bold, fontSize: 12 },
  tVenue: { color: Colors.textSecondary, fontFamily: Typography.fontFamily.regular, fontSize: 11, maxWidth: 130 },

  /* ── Empty State ── */
  emptyWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 72 },
  emptyCircle: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 16, borderWidth: 1, borderColor: Colors.primaryAlpha30 },
  emptyTitle: { color: '#FFFFFF', fontFamily: Typography.fontFamily.bold, fontSize: 16 },
  emptySub: { color: Colors.textSecondary, fontFamily: Typography.fontFamily.regular, fontSize: 13, marginTop: 5, textAlign: 'center' },

  /* ── Modal ── */
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: Colors.backgroundCard, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', paddingBottom: 32, maxHeight: '85%' },
  sheetHandle: { width: 38, height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 6 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)' },
  sheetIconBox: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primaryAlpha10, borderWidth: 1, borderColor: Colors.primaryAlpha30, alignItems: 'center', justifyContent: 'center' },
  sheetTitle: { color: '#FFFFFF', fontFamily: Typography.fontFamily.bold, fontSize: 15 },
  sheetSub: { color: Colors.textSecondary, fontFamily: Typography.fontFamily.medium, fontSize: 11 },
  sheetCloseBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.surfaceVariant, alignItems: 'center', justifyContent: 'center' },
  sheetBody: { paddingHorizontal: 20, paddingTop: 4 },

  filterSection: { marginTop: 14 },
  filterLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  filterLabel: { color: '#FFFFFF', fontFamily: Typography.fontFamily.semiBold, fontSize: 13 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.background, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 12, paddingHorizontal: 14, height: 48 },
  input: { flex: 1, color: '#FFFFFF', fontFamily: Typography.fontFamily.regular, fontSize: 14, height: '100%' },
  rupee: { color: Colors.textTertiary, fontSize: 16, fontFamily: Typography.fontFamily.bold },

  sortRow: { flexDirection: 'row', gap: 10 },
  sortChip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 44, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: Colors.background, overflow: 'hidden' },
  sortChipActive: { borderColor: Colors.primary },
  sortChipGrad: { flex: 1, width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  sortChipText: { color: Colors.textSecondary, fontFamily: Typography.fontFamily.medium, fontSize: 12 },
  sortChipTextActive: { color: '#000', fontFamily: Typography.fontFamily.bold, fontSize: 12 },

  roleChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: Colors.background },
  roleChipActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryAlpha10 },
  roleChipText: { color: Colors.textSecondary, fontFamily: Typography.fontFamily.medium, fontSize: 12 },
  roleChipTextActive: { color: Colors.primary, fontFamily: Typography.fontFamily.bold },

  sheetFooter: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)' },
  resetBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, flex: 0.38, height: 50, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: Colors.background },
  resetBtnText: { color: Colors.textSecondary, fontFamily: Typography.fontFamily.bold, fontSize: 14 },
  applyBtnWrap: { flex: 1, borderRadius: 12, overflow: 'hidden' },
  applyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50 },
  applyBtnText: { color: '#000', fontFamily: Typography.fontFamily.bold, fontSize: 14 },
});

export default SearchScreen;
