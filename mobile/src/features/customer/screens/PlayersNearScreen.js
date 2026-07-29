import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Animated, Easing, Dimensions, Image, TextInput,
  FlatList, StatusBar, RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useDispatch, useSelector } from 'react-redux';
import { followPlayer } from '../../player/playerSlice';
import api, { getImageUrl } from '../../../api/axios';
import { Colors, Typography } from '../../../theme/theme';

const { width: SW, height: SH } = Dimensions.get('window');
const RADAR_SIZE = SW * 0.82;
const RADAR_R = RADAR_SIZE / 2;

const MARKER_POSITIONS = [
  { angle: 25,  r: 0.28 },
  { angle: 80,  r: 0.45 },
  { angle: 135, r: 0.30 },
  { angle: 195, r: 0.48 },
  { angle: 250, r: 0.22 },
  { angle: 305, r: 0.40 },
  { angle: 345, r: 0.55 },
  { angle: 50,  r: 0.58 },
  { angle: 160, r: 0.60 },
  { angle: 220, r: 0.35 },
];

function polarToXY(angle, radius) {
  const rad = (angle * Math.PI) / 180;
  return {
    x: RADAR_R + radius * RADAR_R * Math.cos(rad),
    y: RADAR_R + radius * RADAR_R * Math.sin(rad),
  };
}

const FILTERS = ['All', 'Most Runs', 'Most Wickets', 'Highest Average', 'Following', 'Newest'];

const RadarMarker = ({ player, position, isScanned, isSelected, onPress }) => {
  const scaleAnim  = useRef(new Animated.Value(1)).current;
  const glowAnim   = useRef(new Animated.Value(0)).current;
  const floatAnim  = useRef(new Animated.Value(0)).current;
  const rippleAnim = useRef(new Animated.Value(0)).current;
  const rippleOp   = useRef(new Animated.Value(0)).current;

  const photo = player?.photo || player?.userId?.photo;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: 1, duration: 2400 + Math.random() * 800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: 0, duration: 2400 + Math.random() * 800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();
  }, []);

  useEffect(() => {
    if (isScanned) {
      rippleAnim.setValue(0);
      rippleOp.setValue(0.9);
      Animated.parallel([
        Animated.timing(rippleAnim, { toValue: 1, duration: 700, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(rippleOp,   { toValue: 0, duration: 700, useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(glowAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
          Animated.timing(glowAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
        ]),
      ]).start();
    }
  }, [isScanned]);

  useEffect(() => {
    Animated.spring(scaleAnim, { toValue: isSelected ? 1.3 : 1, useNativeDriver: true, damping: 10, stiffness: 160 }).start();
  }, [isSelected]);

  const translateY = floatAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -6] });
  const rippleScale = rippleAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 2.8] });

  return (
    <Animated.View style={[styles.markerWrap, { left: position.x - 24, top: position.y - 24, transform: [{ translateY }, { scale: scaleAnim }] }]}>
      <Animated.View style={[styles.markerRipple, { transform: [{ scale: rippleScale }], opacity: rippleOp }]} />
      {isSelected && <View style={styles.markerSelectedHalo} />}
      <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
        <View style={[styles.markerAvatar, isSelected && styles.markerAvatarSelected]}>
          {photo ? (
            <Image source={{ uri: getImageUrl(photo) }} style={styles.markerImg} />
          ) : (
            <View style={styles.markerImgFallback}>
              <Icon name="account" size={18} color="rgba(255,255,255,0.5)" />
            </View>
          )}
        </View>
        <View style={styles.markerOnlineDot} />
      </TouchableOpacity>
    </Animated.View>
  );
};

const StatChip = ({ label, value }) => (
  <View style={styles.statChip}>
    <Text style={styles.statChipVal}>{value}</Text>
    <Text style={styles.statChipLbl}>{label}</Text>
  </View>
);

const MetricCard = ({ icon, label, value }) => (
  <View style={styles.metricCard}>
    <Icon name={icon} size={18} color="#FFD400" style={{ marginBottom: 4 }} />
    <Text style={styles.metricVal}>{value}</Text>
    <Text style={styles.metricLbl}>{label}</Text>
  </View>
);

const PlayerCard = ({ player, isHighlighted, onPress, onFollowPress, isFollowing, index }) => {
  const cardAnim  = useRef(new Animated.Value(0)).current;
  const pressAnim = useRef(new Animated.Value(1)).current;
  const photo   = player?.photo || player?.userId?.photo;
  const runs    = player?.career?.batting?.runs    || player?.batting?.runs    || 0;
  const wickets = player?.career?.bowling?.wickets || player?.bowling?.wickets || 0;
  const avg     = player?.career?.batting?.average || player?.batting?.average || 0;

  useEffect(() => {
    Animated.timing(cardAnim, { toValue: 1, duration: 420, delay: index * 60, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, []);

  const handlePressIn  = () => Animated.spring(pressAnim, { toValue: 0.97, useNativeDriver: true }).start();
  const handlePressOut = () => Animated.spring(pressAnim, { toValue: 1, useNativeDriver: true, damping: 8 }).start();
  const translateY     = cardAnim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] });

  return (
    <Animated.View style={[styles.playerCard, isHighlighted && styles.playerCardHighlighted, { opacity: cardAnim, transform: [{ translateY }, { scale: pressAnim }] }]}>
      <TouchableOpacity onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut} activeOpacity={1} style={styles.playerCardInner}>
        <View style={styles.playerAvatarWrap}>
          {photo ? (
            <Image source={{ uri: getImageUrl(photo) }} style={styles.playerAvatarImg} />
          ) : (
            <View style={styles.playerAvatarFallback}>
              <Icon name="account" size={22} color="rgba(255,255,255,0.35)" />
            </View>
          )}
          <View style={styles.playerOnlineDot} />
        </View>
        <View style={styles.playerCardBody}>
          <Text style={styles.playerName} numberOfLines={1}>{player?.name || 'Player'}</Text>
          <View style={styles.statsRow}>
            <StatChip label="Runs"    value={runs} />
            <StatChip label="Wickets" value={wickets} />
            <StatChip label="Average" value={avg > 0 ? Number(avg).toFixed(1) : '—'} />
          </View>
        </View>
        <TouchableOpacity onPress={onFollowPress} activeOpacity={0.8} style={[styles.followBtn, isFollowing && styles.followingBtn]}>
          <Text style={[styles.followBtnText, isFollowing && styles.followingBtnText]}>{isFollowing ? 'Following' : 'Follow'}</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
};

const PlayersNearScreen = ({ navigation }) => {
  const dispatch   = useDispatch();
  const { user, isAuthenticated } = useSelector(s => s.auth);
  const { myProfile } = useSelector(s => s.player || {});

  const [players,       setPlayers]       = useState([]);
  const [filtered,      setFiltered]      = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);
  const [search,        setSearch]        = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [activeFilter,  setActiveFilter]  = useState('All');
  const [selectedIdx,   setSelectedIdx]   = useState(null);
  const [scannedIdx,    setScannedIdx]    = useState(null);

  const listRef         = useRef(null);
  const radarAnim       = useRef(new Animated.Value(0)).current;
  const screenAnim      = useRef(new Animated.Value(0)).current;
  const searchBorderAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(screenAnim, { toValue: 1, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    fetchPlayers();
    Animated.loop(Animated.timing(radarAnim, { toValue: 1, duration: 3000, easing: Easing.linear, useNativeDriver: true })).start();
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      const currentBeamAngle = ((Date.now() / 3000) % 1) * 360;
      const positions = MARKER_POSITIONS.slice(0, Math.min(filtered.length, MARKER_POSITIONS.length));
      const hit = positions.findIndex(p => Math.abs((p.angle - currentBeamAngle + 360) % 360) < 30);
      if (hit !== -1) setScannedIdx(hit);
    }, 300);
    return () => clearInterval(id);
  }, [filtered.length]);

  const fetchPlayers = async () => {
    try {
      const city = myProfile?.locationObj?.name || myProfile?.city || user?.city || '';
      const lat  = myProfile?.locationObj?.latitude  || user?.latitude;
      const lng  = myProfile?.locationObj?.longitude || user?.longitude;
      const params = { limit: 30 };
      if (lat && lng) { params.lat = lat; params.lng = lng; }
      else if (city)  { params.city = city; }
      const res = await api.get('/players', { params });
      if (res.data.data) {
        const list = res.data.data.filter(p => (p.userId?._id || p.userId) !== user?._id);
        setPlayers(list);
        setFiltered(list);
      }
    } catch (_) {} finally { setLoading(false); }
  };

  const onRefresh = async () => { setRefreshing(true); await fetchPlayers(); setRefreshing(false); };

  useEffect(() => {
    let list = [...players];
    if (search.trim()) list = list.filter(p => p.name?.toLowerCase().includes(search.toLowerCase()));
    switch (activeFilter) {
      case 'Most Runs':       list.sort((a, b) => (b.career?.batting?.runs || 0) - (a.career?.batting?.runs || 0)); break;
      case 'Most Wickets':    list.sort((a, b) => (b.career?.bowling?.wickets || 0) - (a.career?.bowling?.wickets || 0)); break;
      case 'Highest Average': list.sort((a, b) => (b.career?.batting?.average || 0) - (a.career?.batting?.average || 0)); break;
      case 'Following':       list = list.filter(p => myProfile?.following?.includes(p._id)); break;
      case 'Newest':          list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); break;
    }
    setFiltered(list);
  }, [search, activeFilter, players]);

  const handleMarkerPress = (idx) => {
    setSelectedIdx(idx === selectedIdx ? null : idx);
    try { if (listRef.current && idx < filtered.length) listRef.current.scrollToIndex({ index: idx, animated: true, viewPosition: 0.3 }); } catch (_) {}
  };

  const handleCardPress = (idx) => {
    setSelectedIdx(idx);
    const player = filtered[idx];
    if (player) navigation.navigate('PlayerDetail', { id: player._id });
  };

  const handleFollow = (playerId) => {
    if (!isAuthenticated) { navigation.navigate('AuthModal', { screen: 'Login' }); return; }
    dispatch(followPlayer(playerId));
  };

  const beamRotate = radarAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const searchBorderColor = searchBorderAnim.interpolate({ inputRange: [0, 1], outputRange: ['rgba(255,255,255,0.08)', 'rgba(255,212,0,0.6)'] });
  const handleSearchFocus = () => { setSearchFocused(true);  Animated.timing(searchBorderAnim, { toValue: 1, duration: 250, useNativeDriver: false }).start(); };
  const handleSearchBlur  = () => { setSearchFocused(false); Animated.timing(searchBorderAnim, { toValue: 0, duration: 250, useNativeDriver: false }).start(); };

  const followingCount = players.filter(p => myProfile?.following?.includes(p._id)).length;
  const onlineCount    = Math.max(1, Math.floor(players.length * 0.15));

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <View style={styles.glowOrb1} />
      <View style={styles.glowOrb2} />
      <View style={styles.particle1} />
      <View style={styles.particle2} />
      <View style={styles.particle3} />

      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
            <Icon name="arrow-left" size={20} color="#FFF" />
          </TouchableOpacity>
          <View style={{ flex: 1, marginHorizontal: 12 }}>
            <Text style={styles.headerTitle}>Players Near Me</Text>
            <Text style={styles.headerSub}>Discover nearby cricket players</Text>
          </View>
          <TouchableOpacity style={styles.headerBtn}>
            <Icon name="tune-variant" size={20} color="#FFD400" />
          </TouchableOpacity>
        </View>

        <Animated.ScrollView
          style={{ opacity: screenAnim }}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFD400" />}
        >
          {/* Search */}
          <Animated.View style={[styles.searchBar, { borderColor: searchBorderColor }]}>
            <Icon name="magnify" size={18} color={searchFocused ? '#FFD400' : 'rgba(255,255,255,0.4)'} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search Players"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={search}
              onChangeText={setSearch}
              onFocus={handleSearchFocus}
              onBlur={handleSearchBlur}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Icon name="close-circle" size={16} color="rgba(255,255,255,0.4)" />
              </TouchableOpacity>
            )}
          </Animated.View>

          {/* Radar */}
          <View style={styles.radarContainer}>
            <View style={styles.radarGlass}>
              {[0.25, 0.45, 0.65, 0.85].map((r, i) => (
                <View key={i} style={[styles.radarRing, { width: RADAR_SIZE * r, height: RADAR_SIZE * r, borderRadius: (RADAR_SIZE * r) / 2, opacity: 0.18 + i * 0.06 }]} />
              ))}
              <View style={[styles.crossHair, { width: RADAR_SIZE * 0.88, height: 1 }]} />
              <View style={[styles.crossHair, { width: 1, height: RADAR_SIZE * 0.88 }]} />
              <View style={styles.radarCenter} />
              <View style={styles.radarCenterCore} />
              <Animated.View style={[styles.radarBeamWrap, { transform: [{ rotate: beamRotate }] }]}>
                <View style={styles.radarBeam} />
              </Animated.View>
              {MARKER_POSITIONS.slice(0, Math.min(filtered.length, MARKER_POSITIONS.length)).map((pos, idx) => {
                const xy = polarToXY(pos.angle, pos.r);
                return (
                  <RadarMarker
                    key={idx}
                    player={filtered[idx]}
                    position={xy}
                    isScanned={scannedIdx === idx}
                    isSelected={selectedIdx === idx}
                    onPress={() => handleMarkerPress(idx)}
                  />
                );
              })}
            </View>
            <Text style={styles.radarLabel}>SCANNING NEARBY PLAYERS</Text>
          </View>

          {/* Metrics */}
          <View style={styles.metricsRow}>
            <MetricCard icon="account-group"    label="Nearby Players" value={players.length} />
            <MetricCard icon="account-heart"    label="Following"      value={followingCount} />
            <MetricCard icon="circle"           label="Online Now"     value={onlineCount} />
          </View>

          {/* Filters */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersRow}>
            {FILTERS.map(f => (
              <TouchableOpacity key={f} onPress={() => setActiveFilter(f)} style={[styles.filterChip, activeFilter === f && styles.filterChipActive]} activeOpacity={0.8}>
                <Text style={[styles.filterChipText, activeFilter === f && styles.filterChipTextActive]}>{f}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Player list */}
          {loading ? (
            <View style={styles.loadingWrap}>
              {[0, 1, 2].map(i => <View key={i} style={styles.skeletonCard} />)}
            </View>
          ) : filtered.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Icon name="account-search" size={44} color="rgba(255,212,0,0.2)" />
              <Text style={styles.emptyText}>No players found</Text>
            </View>
          ) : (
            <FlatList
              ref={listRef}
              data={filtered}
              keyExtractor={it => it._id}
              scrollEnabled={false}
              contentContainerStyle={{ gap: 12, paddingBottom: 24 }}
              renderItem={({ item, index }) => {
                const isFollowing = myProfile?.following?.includes(item._id) || false;
                return (
                  <PlayerCard
                    player={item}
                    index={index}
                    isHighlighted={selectedIdx === index}
                    isFollowing={isFollowing}
                    onPress={() => handleCardPress(index)}
                    onFollowPress={() => handleFollow(item._id)}
                  />
                );
              }}
            />
          )}
        </Animated.ScrollView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  content: { paddingBottom: 120 },
  glowOrb1: { position: 'absolute', width: SW * 1.1, height: SW * 1.1, borderRadius: SW * 0.55, top: -SW * 0.3, left: -SW * 0.05, backgroundColor: 'rgba(255,212,0,0.045)' },
  glowOrb2: { position: 'absolute', width: SW * 0.7, height: SW * 0.7, borderRadius: SW * 0.35, top: SH * 0.45, right: -SW * 0.2, backgroundColor: 'rgba(255,212,0,0.025)' },
  particle1: { position: 'absolute', width: 3, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,212,0,0.15)', top: SH * 0.22, left: SW * 0.15 },
  particle2: { position: 'absolute', width: 2, height: 2, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.08)', top: SH * 0.55, right: SW * 0.12 },
  particle3: { position: 'absolute', width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,212,0,0.1)', top: SH * 0.72, left: SW * 0.65 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)', backgroundColor: 'rgba(0,0,0,0.6)' },
  headerBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontFamily: Typography.fontFamily.bold, color: '#FFFFFF', letterSpacing: 0.2 },
  headerSub: { fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: Typography.fontFamily.regular, marginTop: 1 },
  searchBar: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 16, marginBottom: 8, backgroundColor: 'rgba(23,23,23,0.85)', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1, gap: 10 },
  searchInput: { flex: 1, color: '#FFFFFF', fontFamily: Typography.fontFamily.regular, fontSize: 14, padding: 0 },
  radarContainer: { alignItems: 'center', marginTop: 10, marginBottom: 8 },
  radarGlass: { width: RADAR_SIZE, height: RADAR_SIZE, borderRadius: RADAR_R, backgroundColor: 'rgba(10,10,10,0.6)', borderWidth: 1.5, borderColor: 'rgba(255,212,0,0.12)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  radarRing: { position: 'absolute', borderWidth: 1, borderColor: 'rgba(255,212,0,0.4)' },
  crossHair: { position: 'absolute', backgroundColor: 'rgba(255,212,0,0.06)' },
  radarCenter: { position: 'absolute', width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,212,0,0.08)', borderWidth: 1, borderColor: 'rgba(255,212,0,0.3)' },
  radarCenterCore: { position: 'absolute', width: 10, height: 10, borderRadius: 5, backgroundColor: '#FFD400', opacity: 0.7 },
  radarBeamWrap: { position: 'absolute', width: RADAR_SIZE, height: RADAR_SIZE, alignItems: 'center', justifyContent: 'center' },
  radarBeam: { position: 'absolute', top: RADAR_R - 1, left: RADAR_R, width: RADAR_R * 0.85, height: 2, borderRadius: 1, backgroundColor: 'rgba(255,212,0,0.4)' },
  radarLabel: { marginTop: 10, fontSize: 10, letterSpacing: 2.5, color: 'rgba(255,212,0,0.4)', fontFamily: Typography.fontFamily.semiBold },
  markerWrap: { position: 'absolute', width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  markerRipple: { position: 'absolute', width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: 'rgba(255,212,0,0.5)' },
  markerSelectedHalo: { position: 'absolute', width: 58, height: 58, borderRadius: 29, borderWidth: 1.5, borderColor: 'rgba(255,212,0,0.35)', backgroundColor: 'rgba(255,212,0,0.06)' },
  markerAvatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: 'rgba(255,212,0,0.5)', overflow: 'hidden' },
  markerAvatarSelected: { borderColor: '#FFD400', borderWidth: 2.5 },
  markerImg: { width: '100%', height: '100%' },
  markerImgFallback: { flex: 1, backgroundColor: '#171717', alignItems: 'center', justifyContent: 'center' },
  markerOnlineDot: { position: 'absolute', bottom: 1, right: 1, width: 10, height: 10, borderRadius: 5, backgroundColor: '#FFD400', borderWidth: 1.5, borderColor: '#000' },
  metricsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginTop: 4, marginBottom: 12 },
  metricCard: { flex: 1, backgroundColor: 'rgba(23,23,23,0.8)', borderRadius: 16, paddingVertical: 14, paddingHorizontal: 10, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,212,0,0.1)' },
  metricVal: { fontSize: 20, fontFamily: Typography.fontFamily.bold, color: '#FFFFFF' },
  metricLbl: { fontSize: 9, color: 'rgba(255,255,255,0.35)', fontFamily: Typography.fontFamily.regular, marginTop: 2, textAlign: 'center' },
  filtersRow: { paddingHorizontal: 16, gap: 8, paddingBottom: 12, paddingTop: 2 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 22, backgroundColor: 'rgba(23,23,23,0.85)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  filterChipActive: { backgroundColor: '#FFD400', borderColor: '#FFD400' },
  filterChipText: { fontSize: 12, fontFamily: Typography.fontFamily.semiBold, color: 'rgba(255,255,255,0.6)' },
  filterChipTextActive: { color: '#000000' },
  playerCard: { marginHorizontal: 16, borderRadius: 20, backgroundColor: 'rgba(17,17,17,0.9)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  playerCardHighlighted: { borderColor: 'rgba(255,212,0,0.5)' },
  playerCardInner: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  playerAvatarWrap: { position: 'relative', width: 56, height: 56 },
  playerAvatarImg: { width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: 'rgba(255,212,0,0.4)' },
  playerAvatarFallback: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#171717', borderWidth: 2, borderColor: 'rgba(255,212,0,0.2)', alignItems: 'center', justifyContent: 'center' },
  playerOnlineDot: { position: 'absolute', bottom: 1, right: 1, width: 12, height: 12, borderRadius: 6, backgroundColor: '#FFD400', borderWidth: 2, borderColor: '#000' },
  playerCardBody: { flex: 1 },
  playerName: { fontSize: 14, fontFamily: Typography.fontFamily.semiBold, color: '#FFFFFF', marginBottom: 8 },
  statsRow: { flexDirection: 'row', gap: 6 },
  statChip: { backgroundColor: 'rgba(255,212,0,0.07)', borderWidth: 1, borderColor: 'rgba(255,212,0,0.12)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 5, alignItems: 'center' },
  statChipVal: { fontSize: 11, fontFamily: Typography.fontFamily.bold, color: '#FFFFFF' },
  statChipLbl: { fontSize: 9, color: 'rgba(255,255,255,0.35)', fontFamily: Typography.fontFamily.regular, marginTop: 1 },
  followBtn: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 24, backgroundColor: '#FFD400' },
  followingBtn: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#FFD400' },
  followBtnText: { fontSize: 12, fontFamily: Typography.fontFamily.bold, color: '#000000' },
  followingBtnText: { color: '#FFFFFF' },
  loadingWrap: { paddingHorizontal: 16, gap: 12 },
  skeletonCard: { height: 90, borderRadius: 20, backgroundColor: 'rgba(23,23,23,0.7)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  emptyWrap: { alignItems: 'center', paddingTop: 50, gap: 12 },
  emptyText: { fontSize: 14, color: 'rgba(255,255,255,0.25)', fontFamily: Typography.fontFamily.regular },
});

export default PlayersNearScreen;
