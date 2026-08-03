import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
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
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from '../../../components/SolidGradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useDispatch, useSelector } from 'react-redux';
import { fetchTurfs, setSearchQuery } from '../../turf/turfSlice';
import { fetchRankings, fetchMyPlayer } from '../../player/playerSlice';
import { fetchMatches } from '../../match/matchSlice';
import { fetchTournaments } from '../../tournament/tournamentSlice';
import { toggleUserFavourite, setUserFavouriteStatus } from '../../auth/authSlice';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../../theme/theme';
import SkeletonPlaceholder from 'react-native-skeleton-placeholder';
import api, { getImageUrl } from '../../../api/axios';
import { showCustomAlert } from '../../../components/CustomAlert';
import LocationAutocomplete from '../../../components/LocationAutocomplete';

// Ground (Turfs) is LAST
const TABS = [
  { id: 'players', label: 'Players', icon: 'account-multiple' },
  { id: 'matches', label: 'Matches', icon: 'cricket' },
  { id: 'tournaments', label: 'Tournaments', icon: 'trophy' },
  { id: 'turfs', label: 'Ground', icon: 'soccer-field' },
];

const PLAYER_QUICK_FILTERS = [
  { id: 'all', icon: 'account', label: 'All', value: '' },
  { id: 'batsman', icon: 'cricket', label: 'Batsman', value: 'Batsman' },
  { id: 'bowler', icon: 'baseball', label: 'Bowler', value: 'Bowler' },
  { id: 'all_rounder', icon: 'star', label: 'All-Rounder', value: 'All Rounder' },
  { id: 'wicket_keeper', icon: 'handball', label: 'WK', value: 'Wicket Keeper' },
];
const MATCH_QUICK_FILTERS = [
  { id: 'all', icon: 'cricket', label: 'All', value: '' },
  { id: 'live', icon: 'record-circle-outline', label: 'Live', value: 'in_progress' },
  { id: 'scheduled', icon: 'calendar-clock', label: 'Scheduled', value: 'scheduled' },
  { id: 'completed', icon: 'check-circle-outline', label: 'Completed', value: 'completed' },
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

  // Location State
  const [selectedLocation, setSelectedLocation] = useState(null);

  const [minTrustScore, setMinTrustScore] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [sortOrder, setSortOrder] = useState('');
  const [playerRoleFilter, setPlayerRoleFilter] = useState('');
  const [matchStatusFilter, setMatchStatusFilter] = useState('');

  const hasInitializedLocation = useRef(false);

  const slideAnim = useRef(new Animated.Value(700)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;

  // Location modal
  const [locationModalVisible, setLocationModalVisible] = useState(false);
  const locationSlideAnim = useRef(new Animated.Value(700)).current;
  const locationOverlayAnim = useRef(new Animated.Value(0)).current;
  const [locQuery, setLocQuery] = useState('');
  const [locResults, setLocResults] = useState([]);
  const [locLoading, setLocLoading] = useState(false);
  const locTimeoutRef = useRef(null);
  const locInputRef = useRef(null);

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
    dispatch(setSearchQuery(''));
  }, [activeTab, dispatch]);

  useEffect(() => {
    // Initial location setup if available
    if (hasInitializedLocation.current) return;
    const city = myProfile?.city || user?.city || '';
    if (city) {
      setSelectedLocation(prev => {
        if (!prev) return { name: city, city: city };
        return prev;
      });
      hasInitializedLocation.current = true;
    }
  }, [myProfile, user]);

  // Reset to page 1 whenever search criteria change (not when page increments)
  const [page, setPage] = useState(1);
  const [isPaginating, setIsPaginating] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const isFirstMount = React.useRef(true);
  const prevFiltersRef = React.useRef('');

  useEffect(() => {
    if (!selectedLocation) return;
    const filterKey = `${searchQuery}|${selectedLocation?.name}|${activeTab}|${minTrustScore}|${maxPrice}|${sortOrder}|${playerRoleFilter}|${matchStatusFilter}`;
    if (prevFiltersRef.current !== filterKey) {
      prevFiltersRef.current = filterKey;
      setPage(1); // Reset page to 1 on any filter change
      setHasMore(true);
    }
  }, [searchQuery, selectedLocation, activeTab, minTrustScore, maxPrice, sortOrder, playerRoleFilter, matchStatusFilter]);

  useEffect(() => {
    if (!selectedLocation) return;
    const t = setTimeout(() => {
      const city = selectedLocation.city || selectedLocation.name || '';
      const lat = selectedLocation.latitude;
      const lng = selectedLocation.longitude;
      const currentPage = page;

      const commonQuery = { search: searchQuery?.trim() || undefined, city, lat, lng, page: currentPage, limit: 10 };

      const handleFetchResult = (res) => {
        const items = res.payload?.data || res.payload || [];
        setHasMore(items.length >= 10);
      };

      if (activeTab === 'turfs') {
        const queryParams = { ...commonQuery, minTrustScore, maxPrice, sort: sortOrder };
        dispatch(fetchTurfs(queryParams)).then(handleFetchResult).finally(() => setIsPaginating(false));
      } else if (activeTab === 'players') {
        dispatch(fetchRankings({ ...commonQuery, role: playerRoleFilter || undefined })).then(handleFetchResult).finally(() => setIsPaginating(false));
      } else if (activeTab === 'matches') {
        dispatch(fetchMatches({ ...commonQuery, status: matchStatusFilter || undefined })).then(handleFetchResult).finally(() => setIsPaginating(false));
      } else {
        dispatch(fetchTournaments(commonQuery)).then(handleFetchResult).finally(() => setIsPaginating(false));
      }
    }, 400);
    return () => clearTimeout(t);
  }, [searchQuery, selectedLocation, activeTab, minTrustScore, maxPrice, sortOrder, playerRoleFilter, matchStatusFilter, page, dispatch]);

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

  const openLocationModal = () => {
    setLocQuery('');
    setLocResults([]);
    setLocationModalVisible(true);
    Animated.parallel([
      Animated.spring(locationSlideAnim, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 150 }),
      Animated.timing(locationOverlayAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start(() => {
      setTimeout(() => locInputRef.current?.focus(), 100);
    });
  };

  const closeLocationModal = () => {
    Animated.parallel([
      Animated.timing(locationSlideAnim, { toValue: 700, duration: 300, useNativeDriver: true }),
      Animated.timing(locationOverlayAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => setLocationModalVisible(false));
  };

  const fetchLocSuggestions = async (text) => {
    if (!text || text.length < 2) { setLocResults([]); return; }
    setLocLoading(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&q=${encodeURIComponent(text)}&limit=7`,
        { headers: { 'User-Agent': 'ScoreVerseApp/1.0', 'Accept-Language': 'en-US,en;q=0.9' } }
      );
      const data = await res.json();
      setLocResults(Array.isArray(data) ? data : []);
    } catch (e) {
      setLocResults([]);
    } finally {
      setLocLoading(false);
    }
  };

  const handleLocQueryChange = (text) => {
    setLocQuery(text);
    clearTimeout(locTimeoutRef.current);
    locTimeoutRef.current = setTimeout(() => fetchLocSuggestions(text), 350);
  };

  const handleLocationSelect = (item) => {
    const locName = item.display_name.split(',')[0];
    setSelectedLocation({
      name: locName,
      fullName: item.display_name,
      city: item.address?.city || item.address?.town || item.address?.county || locName,
      latitude: parseFloat(item.lat),
      longitude: parseFloat(item.lon),
      state: item.address?.state || '',
    });
    closeLocationModal();
  };

  const resetFilters = () => {
    setMinTrustScore(''); setMaxPrice(''); setSortOrder('');
    setPlayerRoleFilter(''); setMatchStatusFilter('');
  };

  const hasActiveFilters = minTrustScore || maxPrice || sortOrder || playerRoleFilter || matchStatusFilter;

  const activeLoading = activeTab === 'turfs' ? turfLoading : activeTab === 'players' ? playerLoading : activeTab === 'matches' ? matchLoading : tournamentLoading;
  const activeDataList = activeTab === 'turfs' ? turfs : activeTab === 'players' ? players : activeTab === 'matches' ? matches : tournaments;

  const getMinPrice = (pricing) => {
    if (!pricing) return 0;
    const p = [pricing.weekdayDay, pricing.weekdayNight, pricing.weekendDay, pricing.weekendNight].filter(x => x > 0);
    return p.length ? Math.min(...p) : 0;
  };

  // getImageUrl imported from api/axios — handles both relative and absolute stored paths

  const getMatchScore = (match) => {
    if (match.teamAScore && match.teamBScore) {
      const teamAStr = `${match.teamA?.shortName || match.teamA?.name} ${match.teamAScore.runs}/${match.teamAScore.wickets} (${match.teamAScore.overs})`;
      const teamBStr = `${match.teamB?.shortName || match.teamB?.name} ${match.teamBScore.runs}/${match.teamBScore.wickets} (${match.teamBScore.overs})`;
      if (match.teamAScore.runs === 0 && match.teamAScore.wickets === 0 && match.teamBScore.runs === 0 && match.teamBScore.wickets === 0) return null;
      return `${teamAStr} vs ${teamBStr}`;
    }

    if (!match.innings?.length) return null;
    return match.innings.map(inn => {
      if (typeof inn === 'string') return null;
      const team = inn.battingTeam === match.teamA._id || inn.battingTeam?._id === match.teamA._id ? match.teamA : match.teamB;
      const overs = Math.floor((inn.totalBalls || 0) / 6) + '.' + ((inn.totalBalls || 0) % 6);
      return `${team?.shortName || team?.name || 'Team'} ${inn.totalRuns || 0}/${inn.totalWickets || 0} (${overs})`;
    }).filter(Boolean).join(' vs ');
  };

  // ─── Card Renderers ────────────────
  const renderTurfItem = ({ item }) => {
    const isFav = favourites.includes(item._id);
    const minPrice = getMinPrice(item.pricing);
    const trustScore = item.owner?.trustScore || item.ownerInfo?.trustScore;
    const isVerified = item.isVerified || item.owner?.isVerifiedOwner || item.ownerInfo?.isVerifiedOwner;

    return (
      <TouchableOpacity style={styles.listCard} onPress={() => navigation.navigate('TurfDetail', { id: item._id })} activeOpacity={0.9}>
        <View style={styles.listCardImgWrap}>
          <Image source={{ uri: getImageUrl(item.coverImage) }} style={styles.listCardImg} />
          <TouchableOpacity
            style={[styles.favBtnCompact, isFav && styles.favBtnActiveCompact]}
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
            <Icon name={isFav ? 'heart' : 'heart-outline'} size={14} color={isFav ? '#FF4757' : '#fff'} />
          </TouchableOpacity>
        </View>

        <View style={styles.listCardBody}>
          <View style={styles.listCardRow}>
            <Text style={styles.listCardTitle} numberOfLines={1}>{item.name}</Text>
            {isVerified && (
              <View style={styles.badgeVerifiedCompact}>
                <Icon name="check-decagram" size={10} color="#000" />
              </View>
            )}
          </View>

          <View style={styles.listCardMetaRow}>
            <Icon name="map-marker" size={12} color={Colors.textTertiary} />
            <Text style={styles.listCardMeta} numberOfLines={1}>{item.city}</Text>
            <Text style={styles.listCardDot}>•</Text>
            <Icon name="star" size={12} color={Colors.primary} />
            <Text style={styles.listCardMeta}>{item.rating > 0 ? item.rating.toFixed(1) : 'New'}</Text>
          </View>

          <View style={styles.listCardBottom}>
            <View style={styles.priceTagCompact}>
              <Text style={styles.priceAmountCompact}>₹{minPrice}</Text>
              <Text style={styles.priceUnitCompact}>/hr</Text>
            </View>
            {trustScore !== undefined && (
              <View style={[styles.badgeTrustCompact, { backgroundColor: trustScore >= 80 ? '#2ED573' : '#FF9800' }]}>
                <Icon name="shield-star" size={10} color="#000" />
                <Text style={styles.badgeTextCompact}>{trustScore}%</Text>
              </View>
            )}
          </View>
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
          <Text style={styles.playerRole} numberOfLines={1}>{item.playingRole || 'Cricket Player'} · {item.city || item.location || item.locationObj?.name || '—'}</Text>
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
    const STATUS = { scheduled: 'Scheduled', toss_done: 'Toss Done', in_progress: 'LIVE', innings_break: 'Innings Break', super_over: 'Super Over', completed: 'Completed', abandoned: 'Abandoned', no_result: 'No Result' };
    const isLive = ['in_progress', 'toss_done', 'innings_break', 'super_over'].includes(item.status);
    const isDone = ['completed', 'abandoned', 'no_result'].includes(item.status);
    const isScheduled = item.status === 'scheduled';

    const venue = item.turf
      ? `${item.turf.name}${item.turf.city ? `, ${item.turf.city}` : ''}`
      : `${item.ground || 'Ground'}${item.city ? `, ${item.city}` : ''}`;

    const handlePress = () => {
      navigation.navigate('MatchSummary', { matchId: item._id });
    };

    return (
      <TouchableOpacity style={styles.matchCard} onPress={handlePress} activeOpacity={0.88}>
        {/* Card Header: Format & Status */}
        <View style={styles.matchCardHeader}>
          <Text style={styles.matchFormat}>{item.tournament ? item.tournament.name : 'Individual Match'} • {item.format?.toUpperCase() || 'CUSTOM'} ({item.overs || 10} Ov)</Text>
          <View style={[
            styles.matchStatusBadge,
            isLive && styles.matchStatusLive,
            isDone && styles.matchStatusDone,
          ]}>
            {isLive && <View style={styles.liveDot} />}
            <Text style={[styles.matchStatusText, isLive && styles.matchStatusTextLive]}>
              {STATUS[item.status] || item.status}
            </Text>
          </View>
        </View>

        {/* Teams & Score Section */}
        <View style={styles.matchBodyRow}>
          {/* Team A */}
          <View style={styles.matchTeamSide}>
            {item.teamA?.logo ? (
              <Image source={{ uri: getImageUrl(item.teamA.logo) }} style={styles.matchTeamLogo} />
            ) : (
              <View style={styles.matchTeamLogoFallback}>
                <Text style={styles.matchTeamLogoLetter}>{item.teamA?.name?.[0]?.toUpperCase() || 'A'}</Text>
              </View>
            )}
            <Text style={styles.matchTeamName} numberOfLines={1}>{item.teamA?.name || 'Team A'}</Text>
          </View>

          {/* Scores or VS */}
          <View style={styles.matchCenterBox}>
            {item.teamAScore || item.teamBScore ? (
              <View style={styles.scoreBox}>
                <Text style={styles.scoreTextMain}>
                  {item.teamAScore?.runs || 0}/{item.teamAScore?.wickets || 0}
                </Text>
                <Text style={{ color: Colors.primary, fontFamily: Typography.fontFamily.bold, fontSize: 14, }}>VS</Text>
                <Text style={styles.scoreTextMain}>
                  {item.teamBScore?.runs || 0}/{item.teamBScore?.wickets || 0}
                </Text>
              </View>
            ) : (
              <View style={styles.vsBadge}>
                <Text style={{ color: Colors.primary, fontFamily: Typography.fontFamily.bold, fontSize: 14, }}>VS</Text>
              </View>
            )}
          </View>

          {/* Team B */}
          <View style={[styles.matchTeamSide, { alignItems: 'flex-end' }]}>
            {item.teamB?.logo ? (
              <Image source={{ uri: getImageUrl(item.teamB.logo) }} style={styles.matchTeamLogo} />
            ) : (
              <View style={styles.matchTeamLogoFallback}>
                <Text style={styles.matchTeamLogoLetter}>{item.teamB?.name?.[0]?.toUpperCase() || 'B'}</Text>
              </View>
            )}
            <Text style={[styles.matchTeamName, { textAlign: 'right' }]} numberOfLines={1}>{item.teamB?.name || 'Team B'}</Text>
          </View>
        </View>

        {/* Match Result / Status Note */}
        {item.result?.summary ? (
          <Text style={styles.matchSummarySub} numberOfLines={1}>{item.result.summary}</Text>
        ) : null}

        {/* Venue footer */}
        <View style={styles.matchVenueRow}>
          <Icon name="map-marker" size={12} color={Colors.textTertiary} />
          <Text style={styles.matchVenueText} numberOfLines={1}>{venue}</Text>
        </View>
      </TouchableOpacity>
    );
  };


  const renderTournamentItem = ({ item }) => {
    const statusLabel = item.status === 'draft' ? 'Upcoming' :
      item.status === 'registration_open' ? 'Reg Open' :
        item.status === 'registration_closed' ? 'Reg Closed' :
          item.status === 'ongoing' ? 'Ongoing' :
            item.status === 'completed' ? 'Finished' :
              item.status === 'cancelled' ? 'Cancelled' : 'Upcoming';
    const statusColor = item.status === 'draft' ? Colors.warning :
      item.status === 'registration_open' ? Colors.success :
        item.status === 'registration_closed' ? Colors.error :
          item.status === 'ongoing' ? Colors.warning :
            item.status === 'completed' ? Colors.textTertiary :
              item.status === 'cancelled' ? Colors.error : Colors.textSecondary;

    return (
      <TouchableOpacity style={styles.tCard} onPress={() => navigation.navigate('TournamentDetail', { tournamentId: item._id })} activeOpacity={0.92}>
        <View style={styles.tBannerWrap}>
          {item.banner
            ? <Image source={{ uri: getImageUrl(item.banner) }} style={styles.tBanner} />
            : <LinearGradient colors={['#0D2136', '#000000']} style={styles.tBannerFallback}>
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
              <Icon name="account-group-outline" size={13} color={Colors.textSecondary} />
              <Text style={styles.tVenue}>{item.teamCount || item.teams?.length || 0} Teams</Text>
            </View>
            <View style={styles.tInfoRow}>
              <Icon name="map-marker-outline" size={13} color={Colors.textSecondary} />
              <Text style={styles.tVenue} numberOfLines={1}>
                {item.city || item.turf?.city || item.turf?.name || 'Local Ground'}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderSkeleton = () => (
    <SkeletonPlaceholder backgroundColor={Colors.backgroundElevated} highlightColor={Colors.surfaceVariant}>
      <View style={{ gap: 14, padding: 16 }}>
        {activeTab === 'turfs' ? (
          [1, 2, 3, 4, 5, 6].map(i => (
            <View key={i} style={{ flexDirection: 'row', borderRadius: 16, padding: 10, gap: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
              <View style={{ width: 90, height: 90, borderRadius: 12 }} />
              <View style={{ flex: 1, justifyContent: 'center', gap: 12 }}>
                <View style={{ width: '70%', height: 16, borderRadius: 4 }} />
                <View style={{ width: '50%', height: 12, borderRadius: 4 }} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ width: '30%', height: 14, borderRadius: 4 }} />
                  <View style={{ width: '20%', height: 12, borderRadius: 4 }} />
                </View>
              </View>
            </View>
          ))
        ) : (
          [1, 2].map(i => (
            <View key={i} style={{ borderRadius: 16, overflow: 'hidden', marginBottom: 16 }}>
              <View style={{ width: '100%', height: 170 }} />
              <View style={{ padding: 14, gap: 10 }}>
                <View style={{ width: '55%', height: 18, borderRadius: 6 }} />
                <View style={{ width: '35%', height: 12, borderRadius: 6 }} />
                <View style={{ width: '100%', height: 38, borderRadius: 10, marginTop: 6 }} />
              </View>
            </View>
          ))
        )}
      </View>
    </SkeletonPlaceholder>
  );

  const emptyTabLabel = activeTab === 'turfs' ? 'grounds' : activeTab;
  const emptyIcon = activeTab === 'turfs' ? 'soccer-field' : activeTab === 'players' ? 'account-multiple' : activeTab === 'matches' ? 'cricket' : 'trophy';

  // ─── Render ──────────────────────────────────────────────────────────────
  const handleLoadMore = () => {
    if (!activeLoading && !isPaginating && hasMore && activeDataList.length >= 10) {
      setIsPaginating(true);
      setPage(p => p + 1);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      {/* ── HEADER ── */}
      <View style={styles.header}>
        {/* Title row — title left, location button right */}
        <View style={styles.titleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.screenLabel}>SEARCH DIRECTORY</Text>
            <Text style={styles.screenTitle}>Find Turf & Cricket</Text>
          </View>
          {/* Location button — top right */}
          <TouchableOpacity style={styles.locationBtn} onPress={openLocationModal} activeOpacity={0.8}>
            <Icon name="map-marker" size={13} color={Colors.primary} />
            <Text style={styles.locationBtnText} numberOfLines={1}>
              {selectedLocation ? (selectedLocation.city || selectedLocation.name || '').split(',')[0] : 'City'}
            </Text>
            <Icon name="chevron-down" size={13} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Search bar — only when location selected */}
        {selectedLocation && (
          <View style={styles.searchRow}>
            <View style={styles.searchBar}>
              <Icon name="magnify" size={18} color={Colors.textTertiary} />
              <TextInput
                style={styles.searchInput}
                placeholder={`Search ${activeTab === 'turfs' ? 'grounds' : activeTab}…`}
                placeholderTextColor={Colors.textTertiary}
                value={searchQuery}
                onChangeText={t => dispatch(setSearchQuery(t))}
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="search"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => dispatch(setSearchQuery(''))} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                  <Icon name="close-circle" size={16} color={Colors.textTertiary} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}


        {/* ── MAIN TABS: Cricket | Grounds ── */}
        <View style={styles.mainTabContainer}>
          <TouchableOpacity
            style={[styles.mainTab, activeTab !== 'turfs' && styles.mainTabActive]}
            onPress={() => setActiveTab('players')}
            activeOpacity={0.85}
          >
            {activeTab !== 'turfs'
              ? <LinearGradient colors={Colors.primaryGradient} style={styles.mainTabGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <Icon name="cricket" size={14} color="#000" />
                <Text style={styles.mainTabTextActive}>Cricket</Text>
              </LinearGradient>
              : <View style={styles.mainTabGrad}>
                <Icon name="cricket" size={14} color={Colors.textTertiary} />
                <Text style={styles.mainTabText}>Cricket</Text>
              </View>
            }
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.mainTab, activeTab === 'turfs' && styles.mainTabActive]}
            onPress={() => setActiveTab('turfs')}
            activeOpacity={0.85}
          >
            {activeTab === 'turfs'
              ? <LinearGradient colors={Colors.primaryGradient} style={styles.mainTabGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <Icon name="soccer-field" size={14} color="#000" />
                <Text style={styles.mainTabTextActive}>Grounds</Text>
              </LinearGradient>
              : <View style={styles.mainTabGrad}>
                <Icon name="soccer-field" size={14} color={Colors.textTertiary} />
                <Text style={styles.mainTabText}>Grounds</Text>
              </View>
            }
          </TouchableOpacity>
        </View>

        {/* ── SUB TABS — cricket sub-types ── */}
        {activeTab !== 'turfs' && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabBarContent}
            style={styles.tabBarScroll}
            keyboardShouldPersistTaps="always"
            decelerationRate="fast"
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
                  {active
                    ? <LinearGradient colors={Colors.primaryGradient} style={styles.tabInner} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                      <Icon name={tab.icon} size={12} color="#000" />
                      <Text style={styles.tabTextActive}>{tab.label}</Text>
                    </LinearGradient>
                    : <View style={styles.tabInner}>
                      <Icon name={tab.icon} size={12} color={Colors.textTertiary} />
                      <Text style={styles.tabText}>{tab.label}</Text>
                    </View>
                  }
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* ── CONTENT LIST ── */}
      {selectedLocation ? (
        (activeLoading && page === 1) ? (
          <View style={styles.loadingWrap}>
            <SkeletonPlaceholder backgroundColor={Colors.backgroundElevated} highlightColor={Colors.surfaceVariant}>
              <SkeletonPlaceholder.Item paddingHorizontal={20}>
                {[...Array(5)].map((_, i) => (
                  <SkeletonPlaceholder.Item key={i} width="100%" height={120} borderRadius={16} marginBottom={16} />
                ))}
              </SkeletonPlaceholder.Item>
            </SkeletonPlaceholder>
          </View>
        ) : (
          <FlatList
            data={activeDataList}
            keyExtractor={item => item._id || item.id}
            renderItem={activeTab === 'turfs' ? renderTurfItem : activeTab === 'players' ? renderPlayerItem : activeTab === 'matches' ? renderMatchItem : renderTournamentItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.5}
            ListFooterComponent={
              isPaginating ? (
                <View style={styles.paginationLoader}>
                  <ActivityIndicator size="small" color={Colors.primary} />
                  <Text style={styles.paginationLoaderText}>Loading more…</Text>
                </View>
              ) : null
            }
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Icon name="magnify" size={48} color={Colors.textTertiary} />
                <Text style={styles.emptyText}>
                  {searchQuery ? `No ${emptyTabLabel} exists with "${searchQuery}"` : `No ${emptyTabLabel} found in ${selectedLocation?.name || 'this location'}`}
                </Text>
                <Text style={styles.emptySub}>Try adjusting your search criteria</Text>
              </View>
            }
          />
        )
      ) : (
        <View style={styles.locationPromptWrap}>
          <Icon name="map-marker-radius-outline" size={54} color={Colors.primary} />
          <Text style={styles.locationPromptTitle}>Where do you play?</Text>
          <Text style={styles.locationPromptSub}>Tap the <Text style={{ color: Colors.primary, fontFamily: Typography.fontFamily.bold }}>city pill ↗</Text> at the top right to set your location and discover players, grounds, matches & tournaments nearby.</Text>
        </View>
      )}

      {/* ── LOCATION MODAL ── */}
      <Modal visible={locationModalVisible} transparent animationType="none" onRequestClose={closeLocationModal}>
        <Animated.View style={[styles.overlay, { opacity: locationOverlayAnim }]}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={closeLocationModal} />
        </Animated.View>
        <Animated.View style={[styles.locationSheet, { transform: [{ translateY: locationSlideAnim }] }]}>
          <View style={styles.sheetHandle} />
          {/* Header */}
          <View style={styles.locationSheetHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={styles.sheetIconBox}>
                <Icon name="map-marker-outline" size={17} color={Colors.primary} />
              </View>
              <View>
                <Text style={styles.sheetTitle}>Set Location</Text>
                <Text style={styles.sheetSub}>Search your city or area</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.sheetCloseBtn} onPress={closeLocationModal}>
              <Icon name="close" size={18} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Inline search input */}
          <View style={styles.locationSheetBody}>
            <View style={styles.locSearchRow}>
              <Icon name="magnify" size={18} color={Colors.textTertiary} />
              <TextInput
                ref={locInputRef}
                style={styles.locSearchInput}
                value={locQuery}
                onChangeText={handleLocQueryChange}
                placeholder="Search city, area..."
                placeholderTextColor={Colors.textTertiary}
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="search"
              />
              {locLoading
                ? <ActivityIndicator size="small" color={Colors.primary} />
                : locQuery.length > 0 && (
                  <TouchableOpacity onPress={() => { setLocQuery(''); setLocResults([]); }}>
                    <Icon name="close-circle" size={16} color={Colors.textTertiary} />
                  </TouchableOpacity>
                )
              }
            </View>

            {/* Currently selected location chip */}
            {selectedLocation && locQuery.length === 0 && (
              <View style={styles.selectedLocRow}>
                <Icon name="map-marker-check" size={15} color={Colors.primary} />
                <Text style={styles.selectedLocText} numberOfLines={1}>
                  {selectedLocation.city || selectedLocation.name}
                </Text>
                <TouchableOpacity onPress={() => setSelectedLocation(null)}>
                  <Icon name="close" size={14} color={Colors.textTertiary} />
                </TouchableOpacity>
              </View>
            )}

            {/* Inline results list */}
            {locResults.length > 0 && (
              <View style={styles.locResultsContainer}>
                {locResults.map((item, idx) => {
                  const city = item.display_name.split(',')[0];
                  const sub = item.display_name.split(',').slice(1, 3).join(',').trim();
                  return (
                    <TouchableOpacity
                      key={item.place_id || idx}
                      style={[styles.locResultItem, idx < locResults.length - 1 && styles.locResultBorder]}
                      onPress={() => handleLocationSelect(item)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.locResultIcon}>
                        <Icon name="map-marker" size={14} color={Colors.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.locResultTitle} numberOfLines={1}>{city}</Text>
                        {sub ? <Text style={styles.locResultSub} numberOfLines={1}>{sub}</Text> : null}
                      </View>
                      <Icon name="chevron-right" size={14} color={Colors.textTertiary} />
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {locQuery.length >= 2 && !locLoading && locResults.length === 0 && (
              <View style={styles.locEmptyWrap}>
                <Icon name="map-search-outline" size={32} color={Colors.textTertiary} />
                <Text style={styles.locEmptyText}>No locations found</Text>
              </View>
            )}
          </View>
        </Animated.View>
      </Modal>


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

          <KeyboardAwareScrollView enableOnAndroid={true} extraScrollHeight={20} keyboardShouldPersistTaps="handled" style={styles.sheetBody} showsVerticalScrollIndicator={false}>


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
                    <TextInput
                      style={styles.filterInput}
                      value={maxPrice}
                      onChangeText={setMaxPrice}
                      placeholder="Max per hr (e.g. 1500)"
                      placeholderTextColor={Colors.textTertiary}
                      keyboardType="numeric"
                    />
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
                <KeyboardAwareScrollView enableOnAndroid={true} extraScrollHeight={20} keyboardShouldPersistTaps="handled" horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
                  {PLAYER_QUICK_FILTERS.map(f => (
                    <TouchableOpacity key={f.id} style={[styles.roleChip, playerRoleFilter === f.value && styles.roleChipActive]} onPress={() => setPlayerRoleFilter(f.value)}>
                      <Text style={[styles.roleChipText, playerRoleFilter === f.value && styles.roleChipTextActive]}>{f.label}</Text>
                    </TouchableOpacity>
                  ))}
                </KeyboardAwareScrollView>
              </FilterSection>
            )}

            {activeTab === 'matches' && (
              <FilterSection icon="scoreboard-outline" label="Match Status">
                <KeyboardAwareScrollView enableOnAndroid={true} extraScrollHeight={20} keyboardShouldPersistTaps="handled" horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
                  {MATCH_QUICK_FILTERS.map(f => (
                    <TouchableOpacity key={f.id} style={[styles.roleChip, matchStatusFilter === f.value && styles.roleChipActive]} onPress={() => setMatchStatusFilter(f.value)}>
                      <Text style={[styles.roleChipText, matchStatusFilter === f.value && styles.roleChipTextActive]}>{f.label}</Text>
                    </TouchableOpacity>
                  ))}
                </KeyboardAwareScrollView>
              </FilterSection>
            )}

            <View style={{ height: 32 }} />
          </KeyboardAwareScrollView>

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
  safe: { flex: 1, backgroundColor: Colors.background },

  header: {
    backgroundColor: Colors.background,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    marginTop: 6,
    marginBottom: 10,
    gap: 10,
  },
  screenLabel: {
    color: Colors.primary,
    fontFamily: Typography.fontFamily.bold,
    fontSize: 9,
    letterSpacing: 2.5,
    marginBottom: 1,
    opacity: 0.9,
  },
  screenTitle: {
    color: '#FFFFFF',
    fontFamily: Typography.fontFamily.bold,
    fontSize: 20,
    letterSpacing: -0.3,
  },

  /* Location button — top right */
  locationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,212,0,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,212,0,0.3)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 4,
    maxWidth: 120,
  },
  locationBtnText: {
    color: Colors.primary,
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: 12,
    flex: 1,
  },

  /* Location modal sheet */
  locationSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.backgroundCard,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 24,
    zIndex: 1000,
  },
  locationSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 16,
  },
  locationSheetBody: {
    paddingHorizontal: 20,
    gap: 14,
    zIndex: 999,
    elevation: 999,
  },
  selectedLocRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,212,0,0.08)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,212,0,0.2)',
  },
  selectedLocText: {
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.medium,
    fontSize: 13,
    flex: 1,
  },

  /* Inline location search */
  locSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundElevated,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
    gap: 10,
  },
  locSearchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontFamily: Typography.fontFamily.regular,
    fontSize: 14,
    height: '100%',
    padding: 0,
  },
  locResultsContainer: {
    backgroundColor: Colors.backgroundElevated,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  locResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 10,
  },
  locResultBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  locResultIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,212,0,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locResultTitle: {
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: 13,
  },
  locResultSub: {
    color: Colors.textTertiary,
    fontFamily: Typography.fontFamily.regular,
    fontSize: 11,
    marginTop: 1,
  },
  locEmptyWrap: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  locEmptyText: {
    color: Colors.textTertiary,
    fontFamily: Typography.fontFamily.medium,
    fontSize: 13,
  },

  /* Search Row */
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 10,
    gap: 8,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontFamily: Typography.fontFamily.regular,
    fontSize: 13,
    height: '100%',
  },
  filterIconBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterIconBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterDot: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#000',
  },

  /* Main Tabs: Cricket / Grounds */
  mainTabContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 10,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  mainTab: {
    flex: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  mainTabActive: {},
  mainTabGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
  },
  mainTabText: {
    color: Colors.textTertiary,
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: 13,
  },
  mainTabTextActive: {
    color: '#000',
    fontFamily: Typography.fontFamily.bold,
    fontSize: 13,
  },

  /* Sub-tab pill bar */
  tabBarScroll: {
    marginBottom: 4,
  },
  tabBarContent: {
    paddingVertical: 2,
    gap: 6,
    paddingLeft: 16,
    paddingRight: 16,
  },
  tab: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  tabActive: {
    borderColor: Colors.primary,
    backgroundColor: 'transparent',
  },
  tabInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 13,
    paddingVertical: 7,
  },
  tabText: {
    color: Colors.textTertiary,
    fontFamily: Typography.fontFamily.medium,
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
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.05)',
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
    paddingBottom: 90,
    gap: 14,
    backgroundColor: Colors.background,
    flexGrow: 1,
  },

  /* ── Turf List Compact Card ── */
  listCard: {
    flexDirection: 'row',
    backgroundColor: Colors.backgroundCard,
    borderRadius: 16,
    padding: 10,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    ...Shadows.sm,
  },
  listCardImgWrap: { width: 90, height: 90, borderRadius: 12, overflow: 'hidden' },
  listCardImg: { width: '100%', height: '100%' },
  favBtnCompact: { position: 'absolute', top: 6, right: 6, width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  favBtnActiveCompact: { backgroundColor: 'rgba(255,71,87,0.2)' },
  listCardBody: { flex: 1, justifyContent: 'center' },
  listCardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  listCardTitle: { color: '#FFFFFF', fontFamily: Typography.fontFamily.bold, fontSize: 15, flex: 1, marginRight: 8 },
  badgeVerifiedCompact: { backgroundColor: Colors.primary, borderRadius: 10, padding: 3 },
  listCardMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 12 },
  listCardMeta: { color: Colors.textSecondary, fontFamily: Typography.fontFamily.medium, fontSize: 11 },
  listCardDot: { color: Colors.textTertiary, fontSize: 10 },
  listCardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  priceTagCompact: { flexDirection: 'row', alignItems: 'baseline' },
  priceAmountCompact: { color: '#FFFFFF', fontFamily: Typography.fontFamily.bold, fontSize: 14 },
  priceUnitCompact: { color: Colors.textSecondary, fontSize: 10, marginLeft: 2 },
  badgeTrustCompact: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  badgeTextCompact: { color: '#000', fontFamily: Typography.fontFamily.bold, fontSize: 9 },

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
  matchCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 10,
    marginBottom: 10,
    ...Shadows.sm,
  },
  matchCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  matchFormat: {
    color: Colors.textTertiary,
    fontFamily: Typography.fontFamily.medium,
    fontSize: 11,
    flex: 1,
    marginRight: 8,
  },
  matchStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  matchStatusLive: {
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderColor: 'rgba(239,68,68,0.4)',
  },
  matchStatusDone: {
    backgroundColor: Colors.primaryAlpha10,
    borderColor: Colors.primaryAlpha30,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#EF4444' },
  matchStatusText: {
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.bold,
    fontSize: 10,
  },
  matchStatusTextLive: { color: '#EF4444' },

  matchBodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  matchTeamSide: {
    flex: 1,
    alignItems: 'flex-start',
    gap: 6,
  },
  matchTeamLogo: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: Colors.primaryAlpha30,
  },
  matchTeamLogoFallback: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.primaryAlpha10,
    borderWidth: 1,
    borderColor: Colors.primaryAlpha30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  matchTeamLogoLetter: {
    color: Colors.primary,
    fontFamily: Typography.fontFamily.bold,
    fontSize: 14,
  },
  matchTeamName: {
    color: '#FFFFFF',
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: 12,
    lineHeight: 15,
  },
  matchCenterBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  scoreBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreTextMain: {
    color: Colors.primary,
    fontFamily: Typography.fontFamily.bold,
    fontSize: 13,
  },
  vsBadgeText: {
    color: Colors.primary,
    fontFamily: Typography.fontFamily.bold,
    fontSize: 9,
    lineHeight: 13,
  },
  matchVenueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    paddingTop: 8,
  },
  matchVenueText: {
    color: Colors.textTertiary,
    fontFamily: Typography.fontFamily.regular,
    fontSize: 11,
    flex: 1,
  },

  /* ── Pagination Loader ── */
  paginationLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  paginationLoaderText: {
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.medium,
    fontSize: 13,
  },


  /* ── Tournament Card ── */
  tCard: { backgroundColor: Colors.backgroundCard, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', overflow: 'hidden', ...Shadows.sm },
  tBannerWrap: { width: '100%', height: 110, backgroundColor: Colors.backgroundElevated, position: 'relative' },
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
  emptyWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 72, paddingHorizontal: 32 },
  emptyCircle: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 16, borderWidth: 1, borderColor: Colors.primaryAlpha30 },
  emptyTitle: { color: '#FFFFFF', fontFamily: Typography.fontFamily.bold, fontSize: 16 },
  emptyText: { color: '#FFFFFF', fontFamily: Typography.fontFamily.bold, fontSize: 16, marginTop: 12 },
  emptySub: { color: Colors.textSecondary, fontFamily: Typography.fontFamily.regular, fontSize: 13, marginTop: 6, textAlign: 'center', lineHeight: 19 },

  /* ── Location Prompt ── */
  locationPromptWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, paddingTop: 20 },
  locationPromptTitle: { color: '#FFFFFF', fontFamily: Typography.fontFamily.bold, fontSize: 18, marginTop: 16, textAlign: 'center' },
  locationPromptSub: { color: Colors.textSecondary, fontFamily: Typography.fontFamily.regular, fontSize: 13, marginTop: 8, textAlign: 'center', lineHeight: 20 },

  /* ── Loading Wrap ── */
  loadingWrap: { flex: 1, backgroundColor: Colors.background },

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
