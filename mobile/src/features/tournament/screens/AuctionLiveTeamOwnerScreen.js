import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Image,
  Dimensions,
  Platform,
  TextInput,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors, Spacing, Typography, useTheme } from '../../../theme/theme';
import auctionService from '../../../services/auctionService';
import { getImageUrl } from '../../../api/axios';

const { width } = Dimensions.get('window');

const AuctionLiveTeamOwnerScreen = ({ route, navigation }) => {
  const { colors, shadows, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const safeTop = Math.max(insets?.top || 0, Platform.OS === 'ios' ? 44 : 0);
  const safeBottom = Math.max(insets?.bottom || 0, Platform.OS === 'ios' ? 24 : 0);
  const styles = useMemo(() => createStyles(colors, shadows, isDark), [colors, shadows, isDark]);
  const { auctionId } = route.params || {};

  const [ownerData, setOwnerData] = useState(null);
  const [liveState, setLiveState] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('squad'); // 'squad' | 'players'
  const [showDetailedStats, setShowDetailedStats] = useState(false);
  const [lastSold, setLastSold] = useState(null); // { player, team, price }
  const [playerFilter, setPlayerFilter] = useState('all');
  const [playerSearchQuery, setPlayerSearchQuery] = useState('');
  const [fallbackPlayers, setFallbackPlayers] = useState([]);

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(fadeAnim, { toValue: 0.3, duration: 800, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.06, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    ).start();

    if (auctionId) {
      auctionService.joinAuctionRoom(auctionId);
      loadAll();

      const unsubscribe = auctionService.onAuctionUpdate((updatedState) => {
        slideAnim.setValue(20);
        opacityAnim.setValue(0);
        Animated.parallel([
          Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.timing(opacityAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        ]).start();
        setLiveState(prev => {
          if (prev?.auction?.currentPlayer && !updatedState?.auction?.currentPlayer) {
            const lastHistory = updatedState?.history?.[0];
            if (lastHistory?.eventType === 'player_sold') {
              const reg = prev.auction.currentPlayer || lastHistory?.registration;
              const winTeamObj = typeof lastHistory?.team === 'object' && lastHistory.team 
                ? lastHistory.team 
                : (updatedState.teams || []).find(t => t._id?.toString() === (lastHistory?.team?._id || lastHistory?.team)?.toString());
              setLastSold({ player: reg, team: winTeamObj, price: lastHistory?.amount ?? 0 });
            }
          }
          if (updatedState?.auction?.currentPlayer) {
            setLastSold(null);
          }
          return updatedState;
        });
        loadOwnerData();
      });

      return () => {
        unsubscribe();
        auctionService.leaveAuctionRoom(auctionId);
      };
    }
  }, [auctionId]);

  const loadAll = () => { loadOwnerData(); loadLiveState(); loadFallbackPlayers(); };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.allSettled([
        loadOwnerData(),
        loadLiveState(),
        loadFallbackPlayers(),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  const loadFallbackPlayers = async () => {
    try {
      const regRes = await auctionService.getRegistrations(auctionId);
      if (regRes?.data && Array.isArray(regRes.data)) {
        setFallbackPlayers(regRes.data.map(r => ({
          _id: r._id?.toString(),
          fullName: r.fullName,
          photo: r.photo,
          role: r.role,
          battingStyle: r.battingStyle,
          bowlingStyle: r.bowlingStyle,
          basePrice: r.basePrice || 0,
          soldStatus: r.soldStatus || 'available',
          soldPrice: r.soldPrice || 0,
          soldToTeam: r.soldToTeam ? {
            _id: r.soldToTeam._id,
            name: r.soldToTeam.name,
            shortName: r.soldToTeam.shortName,
            logo: r.soldToTeam.logo,
          } : null,
          soldAt: r.soldAt,
        })));
      }
    } catch (err) { }
  };

  const loadOwnerData = async () => {
    try {
      const res = await auctionService.getOwnerDashboard(auctionId);
      setOwnerData(res.data);
    } catch (err) { console.log('Error loading team owner dashboard:', err); }
  };

  const loadLiveState = async () => {
    try {
      const res = await auctionService.getLiveState(auctionId);
      setLiveState(res.data);
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]).start();
    } catch (err) { console.log('Error loading live state:', err); }
  };

  const allPlayers = (liveState?.players && liveState.players.length > 0)
    ? liveState.players
    : fallbackPlayers;

  const soldCount = allPlayers.filter(p => p.soldStatus === 'sold').length;
  const unsoldCount = allPlayers.filter(p => p.soldStatus === 'unsold').length;
  const skippedCount = allPlayers.filter(p => p.soldStatus === 'skipped').length;
  const liveCount = allPlayers.filter(p => p.soldStatus === 'in_auction').length;
  const upcomingCount = allPlayers.filter(p => !['sold', 'unsold', 'skipped', 'in_auction'].includes(p.soldStatus)).length;

  const filteredAuctionPlayers = useMemo(() => {
    return allPlayers.filter(p => {
      if (playerFilter === 'sold' && p.soldStatus !== 'sold') return false;
      if (playerFilter === 'unsold' && p.soldStatus !== 'unsold') return false;
      if (playerFilter === 'skipped' && p.soldStatus !== 'skipped') return false;
      if (playerFilter === 'in_auction' && p.soldStatus !== 'in_auction') return false;
      if (playerFilter === 'available' && ['sold', 'unsold', 'skipped', 'in_auction'].includes(p.soldStatus)) return false;

      if (playerSearchQuery.trim()) {
        const q = playerSearchQuery.toLowerCase();
        const matchesName = p.fullName?.toLowerCase().includes(q);
        const matchesRole = p.role?.toLowerCase().includes(q);
        const matchesTeam = p.soldToTeam?.name?.toLowerCase().includes(q) || p.soldToTeam?.shortName?.toLowerCase().includes(q);
        if (!matchesName && !matchesRole && !matchesTeam) return false;
      }
      return true;
    });
  }, [allPlayers, playerFilter, playerSearchQuery]);

  const currentPlayer = liveState?.auction?.currentPlayer;
  const currentBid = liveState?.auction?.currentHighestBid || 0;
  const currentHighestTeam = liveState?.auction?.currentHighestTeam;

  const currentSetId = liveState?.auction?.currentSet?._id || liveState?.auction?.currentSet;
  const currentSet = liveState?.sets?.find(s => s._id === currentSetId);
  const setIndex = liveState?.sets?.findIndex(s => s._id === currentSetId);
  const setName = currentSet?.setName || (setIndex >= 0 ? `Set ${setIndex + 1}` : 'Active Set');
  const auctionedCount = currentSet?.auctionedCount || 0;
  const totalPlayersCount = currentSet?.totalPlayersCount || 0;
  const progressPct = totalPlayersCount > 0 ? (auctionedCount / totalPlayersCount) * 100 : 0;

  const team = ownerData?.team;

  // Squad comes from liveState.teams for the owner's team (has soldPrice)
  const allTeams = liveState?.teams || [];
  const myTeamLive = allTeams.find(t => t._id?.toString() === team?._id?.toString());
  const rawSquad = myTeamLive?.players || ownerData?.squad || [];
  const squad = useMemo(() => {
    const seen = new Set();
    return rawSquad.filter((p) => {
      const key = (p.playerId || p._id || p.fullName || '').toString().toLowerCase().trim();
      if (!key) return true;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [rawSquad]);

  const isAuctionStarted = ['in_progress', 'paused', 'completed'].includes(liveState?.auction?.status || ownerData?.status);
  const totalPurse = myTeamLive?.auctionPurse || ownerData?.auctionPurse || liveState?.auction?.teamPurse || 0;
  const purseRemaining = myTeamLive?.purseRemaining ?? ownerData?.purseRemaining ?? totalPurse;
  const purseSpentPct = totalPurse > 0 ? Math.min(((totalPurse - purseRemaining) / totalPurse) * 100, 100) : 0;

  // Star player across all teams (highest bid globally)
  let starPlayer = null;
  let starPrice = 0;
  let starTeamName = '';
  allTeams.forEach(t => {
    (t.players || []).forEach(p => {
      const price = typeof p.soldPrice === 'number' ? p.soldPrice : 0;
      if (price > starPrice) { starPrice = price; starPlayer = p; starTeamName = t.name; }
    });
  });

  // My squad top player
  let myTopPlayer = null;
  let myTopPrice = 0;
  squad.forEach(p => {
    const price = typeof p.soldPrice === 'number' ? p.soldPrice : 0;
    if (price > myTopPrice) { myTopPrice = price; myTopPlayer = p; }
  });

  return (
    <View style={[styles.container, { paddingBottom: Math.max(safeBottom, 8) }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: safeTop + 6 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{team?.name || 'My Team'}</Text>
          {currentSet && (
            <Text style={styles.headerSub}>{setName} · {auctionedCount}/{totalPlayersCount} Players</Text>
          )}
        </View>
        {liveState?.auction?.status === 'completed' ? (
          <View style={[styles.liveBadge, { borderColor: colors.textTertiary }]}>
            <Icon name="check-circle" size={12} color={colors.textTertiary} />
            <Text style={[styles.liveBadgeText, { color: colors.textTertiary, marginLeft: 4 }]}>CLOSED</Text>
          </View>
        ) : (
          <Animated.View style={[styles.liveBadge, { opacity: fadeAnim }]}>
            <View style={styles.liveDot} />
            <Text style={styles.liveBadgeText}>LIVE</Text>
          </Animated.View>
        )}
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >

        {/* Progress Bar */}
        {currentSet && (
          <View style={styles.progressStrip}>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${progressPct}%` }]} />
            </View>
            <Text style={styles.progressLabel}>{setName} Progress: {auctionedCount}/{totalPlayersCount} Players ({Math.round(progressPct)}%)</Text>
          </View>
        )}

        {/* Purse Card */}
        <View style={styles.purseCard}>
          <View style={styles.purseTop}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              {team?.logo ? (
                <Image source={{ uri: getImageUrl(team.logo) }} style={styles.teamLogoImg} />
              ) : (
                <View style={styles.teamLogoPlaceholder}>
                  <Icon name="shield-crown" size={26} color={colors.primary} />
                </View>
              )}
              <View style={{ marginLeft: 10 }}>
                <Text style={styles.teamName}>{team?.name || 'Loading...'}</Text>
                <Text style={styles.teamSub}>Captain: {myTeamLive?.owner?.name || team?.owner?.name || 'N/A'}</Text>
              </View>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.purseLabel}>Purse Left</Text>
              {((ownerData?.auctionPurse || liveState?.auction?.teamPurse || myTeamLive?.auctionPurse || 0) > 0 || isAuctionStarted) ? (
                <Text style={styles.purseValue}>{purseRemaining} Pts</Text>
              ) : (
                <View style={styles.pendingPurseBadge}>
                  <Text style={styles.pendingPurseText}>Yet to announce</Text>
                </View>
              )}
            </View>
          </View>
          <View style={styles.purseBg}>
            <View style={[styles.purseFill, { width: `${purseSpentPct}%` }]} />
          </View>
          <Text style={styles.purseSub}>{Math.round(purseSpentPct)}% spent</Text>
          <View style={styles.statGrid}>
            <View style={styles.gridBox}>
              <Text style={styles.gridVal}>{squad.length}</Text>
              <Text style={styles.gridLabel}>Players Bought</Text>
            </View>
            <View style={[styles.gridBox, { borderLeftWidth: 1, borderLeftColor: colors.border }]}>
              <Text style={styles.gridVal}>{Math.max(0, (ownerData?.maxSquadSize || 20) - squad.length)}</Text>
              <Text style={styles.gridLabel}>Slots Left</Text>
            </View>
          </View>
        </View>

        {/* Current Auction Player */}
        <Text style={styles.sectionTitle}>Current Auction</Text>
        
        {liveState?.auction?.status === 'completed' ? (
          <View style={{ justifyContent: 'center', alignItems: 'center', paddingVertical: 40, backgroundColor: colors.surface, borderRadius: 20, marginBottom: 16 }}>
            <Icon name="check-decagram" size={64} color={colors.primary} />
            <Text style={{ fontFamily: Typography.fontFamily.bold, fontSize: 22, color: colors.textPrimary, marginTop: 16 }}>Auction Completed</Text>
            <Text style={{ fontFamily: Typography.fontFamily.regular, fontSize: 14, color: colors.textTertiary, marginTop: 8, textAlign: 'center', paddingHorizontal: 20 }}>
              The auction has been successfully closed.
            </Text>
          </View>
        ) : lastSold ? (
          /* ── SOLD STAMP CARD ── */
          <View style={styles.soldStampCard}>
            <View style={styles.soldPhotoWrap}>
              {lastSold.player?.photo ? (
                <Image source={{ uri: getImageUrl(lastSold.player.photo) }} style={styles.soldPlayerPhoto} />
              ) : (
                <View style={[styles.soldPlayerPhoto, { backgroundColor: '#1a1a2e', justifyContent: 'center', alignItems: 'center' }]}>
                  <Icon name="account" size={60} color="#555" />
                </View>
              )}
              <View style={styles.stampWrap} pointerEvents="none">
                <View style={styles.stampInner}>
                  <Text style={styles.stampText}>SOLD</Text>
                </View>
              </View>
            </View>
            <Text style={styles.soldPlayerName} numberOfLines={1}>{lastSold.player?.fullName}</Text>
            <View style={styles.soldRolePill}>
              <Icon name="cricket" size={12} color={colors.primary} />
              <Text style={styles.soldRoleText}>{lastSold.player?.role}</Text>
            </View>
            <View style={styles.soldDivider} />
            <View style={styles.soldTeamPriceRow}>
              <View style={styles.soldTeamBox}>
                {lastSold.team?.logo ? (
                  <Image source={{ uri: getImageUrl(lastSold.team.logo) }} style={styles.soldTeamLogo} />
                ) : (
                  <View style={[styles.soldTeamLogo, { backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center' }]}>
                    <Icon name="shield-crown" size={20} color={colors.primary} />
                  </View>
                )}
                <View style={{ marginLeft: 8 }}>
                  <Text style={styles.soldTeamLabel}>SOLD TO</Text>
                  <Text style={styles.soldTeamName} numberOfLines={1}>{lastSold.team?.name || lastSold.team?.shortName || 'Unknown'}</Text>
                </View>
              </View>
              <View style={styles.soldPriceBox}>
                <Text style={styles.soldPriceLabel}>FINAL PRICE</Text>
                <Text style={styles.soldPriceValue}>{lastSold.price}</Text>
                <Text style={styles.soldPriceUnit}>Pts</Text>
              </View>
            </View>
          </View>
        ) : (
          <Animated.View style={[styles.playerHeroCard, { opacity: opacityAnim, transform: [{ translateY: slideAnim }] }]}>
            {/* Large Image Frame */}
            <View style={styles.playerHeroPhotoWrap}>
              {currentPlayer?.photo ? (
                <Image source={{ uri: getImageUrl(currentPlayer.photo) }} style={styles.playerHeroImage} />
              ) : (
                <View style={styles.playerHeroPlaceholder}>
                  <Icon name="account-star" size={54} color={colors.textTertiary} />
                  {!currentPlayer && <Text style={styles.waitingText}>Waiting for next player...</Text>}
                </View>
              )}
              <View style={styles.playerHeroLiveBadge}>
                <View style={styles.compactLiveDot} />
                <Text style={styles.compactLiveText}>LIVE AUCTION</Text>
              </View>
              {currentPlayer?.role && (
                <View style={styles.playerHeroRoleBadge}>
                  <Icon name="cricket" size={11} color={colors.primary} />
                  <Text style={styles.playerHeroRoleText}>{currentPlayer.role}</Text>
                </View>
              )}
            </View>

            {/* Player Details & Bid Row */}
            <View style={styles.playerHeroInfoRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.playerHeroName} numberOfLines={1}>
                  {currentPlayer?.fullName || 'Waiting for next player...'}
                </Text>
                {currentPlayer ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
                    <Text style={styles.playerHeroBasePrice}>
                      Base: <Text style={{ color: colors.textPrimary, fontFamily: Typography.fontFamily.bold }}>{currentPlayer.basePrice || 0} Pts</Text>
                    </Text>
                    {currentHighestTeam ? (
                      <View style={styles.compactLeadingRow}>
                        <Icon name="trophy" size={12} color="#FFD700" />
                        <Text style={styles.compactLeadingText} numberOfLines={1}>
                          Leading: {currentHighestTeam.shortName || currentHighestTeam.name}
                        </Text>
                      </View>
                    ) : (
                      <Text style={styles.compactNoBidsText}>No bids placed yet</Text>
                    )}
                  </View>
                ) : (
                  <Text style={styles.compactNoBidsText}>Auction in progress</Text>
                )}
              </View>

              {/* CURRENT BID Box */}
              <View style={styles.playerHeroBidBox}>
                <Text style={styles.compactBidLabel}>CURRENT BID</Text>
                <Animated.Text style={[styles.playerHeroBidVal, { transform: [{ scale: currentBid > 0 ? pulseAnim : 1 }] }]}>
                  {currentBid}
                </Animated.Text>
                <Text style={styles.compactBidUnit}>Points</Text>
              </View>
            </View>
          </Animated.View>
        )}

        {/* ── PLAYER STATS (Tournament Ball Type: Batting, Bowling, Fielding) ── */}
        {currentPlayer && (
          <TouchableOpacity
            style={styles.compactStatsBar}
            onPress={() => setShowDetailedStats(prev => !prev)}
            activeOpacity={0.7}
          >
            <View style={styles.compactStatsBarLeft}>
              <Icon name="cricket" size={13} color={colors.primary} style={{ marginRight: 4 }} />
              <Text style={styles.compactStatsBarText} numberOfLines={1}>
                {currentPlayer?.playerStats?.ballType || liveState?.tournament?.ballType || 'Tennis'}:{' '}
                <Text style={{ color: colors.textPrimary, fontFamily: Typography.fontFamily.bold }}>
                  {currentPlayer?.playerStats?.batting?.runs ?? 0}R
                </Text>
                {' · '}
                <Text style={{ color: colors.textPrimary, fontFamily: Typography.fontFamily.bold }}>
                  {currentPlayer?.playerStats?.bowling?.wickets ?? 0}W
                </Text>
                {' · '}
                <Text style={{ color: colors.textPrimary, fontFamily: Typography.fontFamily.bold }}>
                  {currentPlayer?.playerStats?.fielding?.catches ?? 0}Ct
                </Text>
              </Text>
            </View>
            <View style={styles.compactStatsBarRight}>
              <Text style={{ fontSize: 9.5, color: colors.textTertiary, fontFamily: Typography.fontFamily.medium }}>
                {currentPlayer?.battingStyle || 'Right Hand'}
              </Text>
              <Icon
                name={showDetailedStats ? 'chevron-up' : 'chevron-down'}
                size={14}
                color={colors.textTertiary}
                style={{ marginLeft: 4 }}
              />
            </View>
          </TouchableOpacity>
        )}

        {/* Detailed Stats if expanded */}
        {currentPlayer && showDetailedStats && (
          <View style={styles.statsCardContainer}>
            <View style={styles.statsCardHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Icon name="baseball" size={13} color={colors.primary} style={{ marginRight: 4 }} />
                <Text style={styles.statsBallTypeTitle}>
                  {currentPlayer?.playerStats?.ballType || liveState?.tournament?.ballType || 'Tennis'} Ball Stats
                </Text>
                <View style={styles.matchesPill}>
                  <Text style={styles.matchesPillText}>
                    {currentPlayer?.playerStats?.matches ?? 0} M
                  </Text>
                </View>
              </View>
              <Text style={styles.playerStylesSummary} numberOfLines={1}>
                {currentPlayer?.battingStyle || 'Right Hand'} · {currentPlayer?.bowlingStyle || 'Right Arm Med'}
              </Text>
            </View>

            <View style={styles.statsMetricsRow}>
              {/* Batting */}
              <View style={styles.metricColumn}>
                <View style={styles.metricColumnHeader}>
                  <Icon name="cricket" size={11} color="#F59E0B" style={{ marginRight: 3 }} />
                  <Text style={[styles.metricColumnTitle, { color: '#F59E0B' }]}>BATTING</Text>
                </View>
                <Text style={styles.metricMainVal}>
                  {currentPlayer?.playerStats?.batting?.runs ?? 0} <Text style={styles.metricUnit}>Runs</Text>
                </Text>
                <Text style={styles.metricSubVal}>
                  Avg {currentPlayer?.playerStats?.batting?.average ?? '0.0'} · SR {currentPlayer?.playerStats?.batting?.strikeRate ?? '0.0'}
                </Text>
                <Text style={styles.metricDetailVal}>
                  HS {currentPlayer?.playerStats?.batting?.highestScore ?? 0} · 4s:{currentPlayer?.playerStats?.batting?.fours ?? 0} · 6s:{currentPlayer?.playerStats?.batting?.sixes ?? 0}
                </Text>
              </View>

              <View style={styles.metricDivider} />

              {/* Bowling */}
              <View style={styles.metricColumn}>
                <View style={styles.metricColumnHeader}>
                  <Icon name="bowling" size={11} color="#3B82F6" style={{ marginRight: 3 }} />
                  <Text style={[styles.metricColumnTitle, { color: '#3B82F6' }]}>BOWLING</Text>
                </View>
                <Text style={styles.metricMainVal}>
                  {currentPlayer?.playerStats?.bowling?.wickets ?? 0} <Text style={styles.metricUnit}>Wkts</Text>
                </Text>
                <Text style={styles.metricSubVal}>
                  Econ {currentPlayer?.playerStats?.bowling?.economy ?? '0.0'} · Avg {currentPlayer?.playerStats?.bowling?.average ?? '0.0'}
                </Text>
                <Text style={styles.metricDetailVal}>
                  Best {currentPlayer?.playerStats?.bowling?.best ?? '-'} · Ov {currentPlayer?.playerStats?.bowling?.overs ?? 0}
                </Text>
              </View>

              <View style={styles.metricDivider} />

              {/* Fielding */}
              <View style={styles.metricColumn}>
                <View style={styles.metricColumnHeader}>
                  <Icon name="hand-back-right" size={11} color="#10B981" style={{ marginRight: 3 }} />
                  <Text style={[styles.metricColumnTitle, { color: '#10B981' }]}>FIELDING</Text>
                </View>
                <Text style={styles.metricMainVal}>
                  {currentPlayer?.playerStats?.fielding?.catches ?? 0} <Text style={styles.metricUnit}>Ct</Text>
                </Text>
                <Text style={styles.metricSubVal}>
                  Run Outs: {currentPlayer?.playerStats?.fielding?.runOuts ?? 0}
                </Text>
                <Text style={styles.metricDetailVal}>
                  Stumpings: {currentPlayer?.playerStats?.fielding?.stumpings ?? 0}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Auction Star Player */}
        {starPlayer && starPrice > 0 && (
          <View style={styles.starBanner}>
            <View style={styles.starBannerHeader}>
              <Icon name="star-circle" size={16} color={isDark ? '#FFD700' : '#D97706'} />
              <Text style={styles.starBannerTitle}>
                {liveState?.auction?.status === 'completed' ? 'Highest Bid in the auction' : 'Highest Bid till now'}
              </Text>
            </View>
            <View style={styles.starBannerBody}>
              {starPlayer.photo ? (
                <Image source={{ uri: getImageUrl(starPlayer.photo) }} style={styles.starAvatar} />
              ) : (
                <View style={[styles.starAvatar, { backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center' }]}>
                  <Icon name="account" size={20} color={isDark ? '#FFD700' : '#D97706'} />
                </View>
              )}
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.starName}>{starPlayer.fullName}</Text>
                <Text style={styles.starTeam}>{starTeamName}</Text>
                <Text style={styles.starRole}>{starPlayer.role}</Text>
              </View>
              <View style={styles.starPricePill}>
                <Icon name="trophy" size={12} color={isDark ? '#FFD700' : '#D97706'} />
                <Text style={styles.starPriceText}>{starPrice} Pts</Text>
              </View>
            </View>
          </View>
        )}

        {/* ── TABS: SQUAD & PLAYER LIST ── */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'squad' && styles.tabButtonActive]}
            onPress={() => setActiveTab('squad')}
            activeOpacity={0.8}
          >
            <Icon
              name="account-group"
              size={16}
              color={activeTab === 'squad' ? colors.primary : colors.textTertiary}
              style={{ marginRight: 6 }}
            />
            <Text style={[styles.tabButtonText, activeTab === 'squad' && styles.tabButtonTextActive]}>
              My Squad
            </Text>
            <View style={[styles.tabBadge, activeTab === 'squad' && styles.tabBadgeActive]}>
              <Text style={[styles.tabBadgeText, activeTab === 'squad' && styles.tabBadgeTextActive]}>
                {squad.length}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'players' && styles.tabButtonActive]}
            onPress={() => setActiveTab('players')}
            activeOpacity={0.8}
          >
            <Icon
              name="format-list-bulleted"
              size={16}
              color={activeTab === 'players' ? colors.primary : colors.textTertiary}
              style={{ marginRight: 6 }}
            />
            <Text style={[styles.tabButtonText, activeTab === 'players' && styles.tabButtonTextActive]}>
              Player List
            </Text>
            <View style={[styles.tabBadge, activeTab === 'players' && styles.tabBadgeActive]}>
              <Text style={[styles.tabBadgeText, activeTab === 'players' && styles.tabBadgeTextActive]}>
                {allPlayers.length}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {activeTab === 'squad' ? (
          /* ── MY SQUAD TAB CONTENT ── */
          <View style={{ marginTop: 6, paddingHorizontal: Spacing.base, paddingBottom: 24 }}>
            {squad.length === 0 ? (
              <View style={styles.emptyCard}>
                <Icon name="account-group-outline" size={40} color={colors.textTertiary} />
                <Text style={styles.emptyText}>No players purchased yet.</Text>
                <Text style={{ fontSize: 11, color: colors.textTertiary, marginTop: 4, textAlign: 'center' }}>
                  Players won by your team in the auction will appear here.
                </Text>
              </View>
            ) : (
              squad.map((item, idx) => {
                const price = item.soldPrice;
                const isRetained = price === 'Retained' || (typeof price === 'number' && price === 0 && !item.soldAt);
                const isTop = typeof price === 'number' && price === myTopPrice && myTopPrice > 0;
                return (
                  <View key={`${item.playerId || 'player'}-${idx}`} style={styles.squadRow}>
                    <Text style={styles.squadNum}>{idx + 1}</Text>
                    {item.photo ? (
                      <Image
                        source={{ uri: getImageUrl(item.photo) }}
                        style={styles.squadAvatar}
                      />
                    ) : (
                      <View style={styles.squadAvatarPlaceholder}>
                        <Icon name="account" size={18} color={colors.textSecondary} />
                      </View>
                    )}
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={styles.squadName}>{item.fullName || 'Unknown'}</Text>
                        {isTop && (
                          <View style={{ marginLeft: 6, backgroundColor: 'rgba(255, 215, 0, 0.15)', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 }}>
                            <Text style={{ fontSize: 8.5, color: '#FFD700', fontFamily: Typography.fontFamily.bold }}>TOP BUY</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.squadRole}>{item.role || '—'}</Text>
                    </View>
                    <View style={[styles.soldPricePill, isRetained && styles.soldPricePillRetained]}>
                      {isRetained && <Icon name="bookmark" size={10} color="#60a5fa" style={{ marginRight: 3 }} />}
                      <Text style={[styles.soldPriceText, isRetained && { color: '#60a5fa' }]}>
                        {isRetained ? 'Retained' : `${price} Pts`}
                      </Text>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        ) : (
          /* ── PLAYER LIST TAB CONTENT ── */
          <View style={{ marginTop: 6, paddingHorizontal: Spacing.base, paddingBottom: 24 }}>
            {/* Search Bar */}
            <View style={styles.playerSearchBox}>
              <Icon name="magnify" size={16} color={colors.textTertiary} style={{ marginRight: 6 }} />
              <TextInput
                style={styles.playerSearchInput}
                placeholder="Search auction players..."
                placeholderTextColor={colors.textTertiary}
                value={playerSearchQuery}
                onChangeText={setPlayerSearchQuery}
              />
              {playerSearchQuery ? (
                <TouchableOpacity onPress={() => setPlayerSearchQuery('')}>
                  <Icon name="close-circle" size={16} color={colors.textTertiary} />
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Status Filter Chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 12 }}
              contentContainerStyle={{ paddingRight: 10 }}
            >
              <TouchableOpacity
                style={[styles.statusFilterChip, playerFilter === 'all' && styles.statusFilterChipActive]}
                onPress={() => setPlayerFilter('all')}
              >
                <Text style={[styles.statusFilterChipText, playerFilter === 'all' && styles.statusFilterChipTextActive]}>
                  All ({allPlayers.length})
                </Text>
              </TouchableOpacity>

              {liveCount > 0 && (
                <TouchableOpacity
                  style={[styles.statusFilterChip, playerFilter === 'in_auction' && { backgroundColor: 'rgba(245, 158, 11, 0.2)', borderColor: '#F59E0B' }]}
                  onPress={() => setPlayerFilter('in_auction')}
                >
                  <Text style={[styles.statusFilterChipText, { color: '#F59E0B' }]}>
                    Live ({liveCount})
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.statusFilterChip, playerFilter === 'available' && styles.statusFilterChipActive]}
                onPress={() => setPlayerFilter('available')}
              >
                <Text style={[styles.statusFilterChipText, playerFilter === 'available' && styles.statusFilterChipTextActive]}>
                  Upcoming ({upcomingCount})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.statusFilterChip, playerFilter === 'sold' && { backgroundColor: 'rgba(16, 185, 129, 0.15)', borderColor: '#10B981' }]}
                onPress={() => setPlayerFilter('sold')}
              >
                <Text style={[styles.statusFilterChipText, { color: '#10B981' }]}>
                  Sold ({soldCount})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.statusFilterChip, playerFilter === 'unsold' && { backgroundColor: 'rgba(239, 68, 68, 0.15)', borderColor: '#EF4444' }]}
                onPress={() => setPlayerFilter('unsold')}
              >
                <Text style={[styles.statusFilterChipText, { color: '#EF4444' }]}>
                  Unsold ({unsoldCount})
                </Text>
              </TouchableOpacity>

              {skippedCount > 0 && (
                <TouchableOpacity
                  style={[styles.statusFilterChip, playerFilter === 'skipped' && { backgroundColor: 'rgba(245, 158, 11, 0.15)', borderColor: '#F59E0B' }]}
                  onPress={() => setPlayerFilter('skipped')}
                >
                  <Text style={[styles.statusFilterChipText, { color: '#F59E0B' }]}>
                    Skipped ({skippedCount})
                  </Text>
                </TouchableOpacity>
              )}
            </ScrollView>

            {/* Player Cards */}
            {filteredAuctionPlayers.length === 0 ? (
              <View style={styles.emptyPlayersBox}>
                <Icon name="account-search-outline" size={32} color={colors.textTertiary} />
                <Text style={styles.emptyPlayersText}>No players match this filter.</Text>
              </View>
            ) : (
              filteredAuctionPlayers.map((item, idx) => {
                const isSold = item.soldStatus === 'sold';
                const isLive = item.soldStatus === 'in_auction';
                const isUnsold = item.soldStatus === 'unsold';
                const isSkipped = item.soldStatus === 'skipped';

                return (
                  <View key={`${item._id || 'player'}-${idx}`} style={[styles.auctionPlayerRow, isLive && styles.auctionPlayerRowLive]}>
                    <Text style={styles.auctionPlayerIdx}>{idx + 1}</Text>
                    {item.photo ? (
                      <Image
                        source={{ uri: getImageUrl(item.photo) }}
                        style={styles.auctionPlayerAvatar}
                      />
                    ) : (
                      <View style={styles.auctionPlayerAvatarPlaceholder}>
                        <Text style={styles.auctionPlayerInitials}>{(item.fullName || 'P').charAt(0).toUpperCase()}</Text>
                      </View>
                    )}
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={styles.auctionPlayerName} numberOfLines={1}>{item.fullName || 'Unknown'}</Text>
                        {isLive && (
                          <View style={styles.livePillSmall}>
                            <View style={styles.liveDotSmall} />
                            <Text style={styles.livePillSmallText}>LIVE</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.auctionPlayerMeta} numberOfLines={1}>
                        {item.role || 'Player'}{item.battingStyle ? ` • ${item.battingStyle}` : ''} • Base {item.basePrice || 0} Pts
                      </Text>
                    </View>

                    {/* Status Badge */}
                    <View style={styles.auctionPlayerStatusWrap}>
                      {isSold ? (
                        <View style={styles.statusSoldBadge}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                            <Icon name="check-circle" size={11} color="#22C55E" />
                            <Text style={styles.statusSoldText}>SOLD • {item.soldPrice} Pts</Text>
                          </View>
                          {item.soldToTeam?.shortName || item.soldToTeam?.name ? (
                            <Text style={styles.statusSoldTeam} numberOfLines={1}>
                              {item.soldToTeam.shortName || item.soldToTeam.name}
                            </Text>
                          ) : null}
                        </View>
                      ) : isLive ? (
                        <View style={styles.statusLiveBadge}>
                          <Icon name="gavel" size={11} color="#FFD700" />
                          <Text style={styles.statusLiveText}>BIDDING</Text>
                        </View>
                      ) : isUnsold ? (
                        <View style={styles.statusUnsoldBadge}>
                          <Icon name="close-circle" size={11} color="#EF4444" />
                          <Text style={styles.statusUnsoldText}>UNSOLD</Text>
                        </View>
                      ) : isSkipped ? (
                        <View style={styles.statusSkippedBadge}>
                          <Icon name="skip-next-circle" size={11} color="#F59E0B" />
                          <Text style={styles.statusSkippedText}>SKIPPED</Text>
                        </View>
                      ) : (
                        <View style={styles.statusAvailableBadge}>
                          <Icon name="clock-outline" size={11} color={colors.textTertiary} />
                          <Text style={styles.statusAvailableText}>UPCOMING</Text>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

const createStyles = (colors, shadows, isDark) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.border, gap: Spacing.sm,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  headerTitle: { fontSize: 16, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary },
  headerSub: { fontSize: 11, fontFamily: Typography.fontFamily.regular, color: colors.textTertiary, marginTop: 1 },
  liveBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(239,68,68,0.15)', borderWidth: 1, borderColor: '#EF4444',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#EF4444', marginRight: 5 },
  liveBadgeText: { color: '#EF4444', fontSize: 11, fontFamily: Typography.fontFamily.bold, letterSpacing: 1 },

  content: { padding: Spacing.base, paddingBottom: 20 },
  progressStrip: { marginBottom: Spacing.md },
  progressBarBg: { height: 5, borderRadius: 3, backgroundColor: colors.surface, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 3, backgroundColor: colors.primary },
  progressLabel: { marginTop: 4, fontSize: 11, color: colors.textTertiary, textAlign: 'right' },

  // ── Tab Container & Buttons ──
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 3,
    marginTop: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 10,
  },
  tabButtonActive: {
    backgroundColor: colors.primaryAlpha20 || 'rgba(74, 222, 128, 0.18)',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  tabButtonText: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.semiBold,
    color: colors.textSecondary,
  },
  tabButtonTextActive: {
    color: colors.primary,
    fontFamily: Typography.fontFamily.bold,
  },
  tabBadge: {
    backgroundColor: colors.backgroundElevated,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginLeft: 6,
  },
  tabBadgeActive: {
    backgroundColor: colors.primary,
  },
  tabBadgeText: {
    fontSize: 10,
    fontFamily: Typography.fontFamily.bold,
    color: colors.textTertiary,
  },
  tabBadgeTextActive: {
    color: '#000',
  },

  // ── Featured Player Hero Card (Big Image) ──
  playerHeroCard: {
    marginBottom: 8,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  playerHeroPhotoWrap: {
    width: '100%',
    height: 180,
    backgroundColor: '#0a0f1d',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playerHeroImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  playerHeroPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0f1d',
  },
  playerHeroLiveBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 0.5,
    borderColor: '#EF4444',
  },
  playerHeroRoleBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 0.5,
    borderColor: colors.primary,
    gap: 4,
  },
  playerHeroRoleText: {
    color: colors.primary,
    fontSize: 10,
    fontFamily: Typography.fontFamily.bold,
  },
  playerHeroInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  playerHeroName: {
    fontSize: 16,
    fontFamily: Typography.fontFamily.bold,
    color: colors.textPrimary,
  },
  playerHeroBasePrice: {
    fontSize: 11,
    fontFamily: Typography.fontFamily.medium,
    color: colors.textTertiary,
  },
  playerHeroBidBox: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    minWidth: 70,
  },
  playerHeroBidVal: {
    color: '#000',
    fontSize: 20,
    fontFamily: Typography.fontFamily.bold,
    lineHeight: 22,
  },

  // ── Compact Player Card & Stats Bar ──
  compactPlayerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 6,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  compactPhotoWrap: {
    width: 62,
    height: 62,
    borderRadius: 8,
    backgroundColor: '#0a0f1d',
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  compactAvatarImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  compactAvatarPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
  },
  compactLiveBadge: {
    position: 'absolute',
    top: 2,
    left: 2,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: 6,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderWidth: 0.5,
    borderColor: colors.primary,
  },
  compactLiveDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.primary,
    marginRight: 3,
  },
  compactLiveText: {
    color: colors.primary,
    fontSize: 7.5,
    fontFamily: Typography.fontFamily.bold,
    letterSpacing: 0.5,
  },
  compactPlayerInfo: {
    flex: 1,
    marginLeft: 8,
    justifyContent: 'center',
  },
  compactPlayerName: {
    fontSize: 14.5,
    fontFamily: Typography.fontFamily.bold,
    color: colors.textPrimary,
  },
  compactMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  compactRolePill: {
    backgroundColor: colors.backgroundElevated,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderWidth: 0.5,
    borderColor: colors.primary,
  },
  compactRolePillText: {
    color: colors.primary,
    fontSize: 9.5,
    fontFamily: Typography.fontFamily.semiBold,
  },
  compactBasePrice: {
    color: colors.textTertiary,
    fontSize: 10,
    fontFamily: Typography.fontFamily.medium,
  },
  compactLeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 3,
  },
  compactLeadingText: {
    color: '#FFD700',
    fontSize: 10,
    fontFamily: Typography.fontFamily.bold,
  },
  compactNoBidsText: {
    color: colors.textTertiary,
    fontSize: 9.5,
    fontFamily: Typography.fontFamily.medium,
    marginTop: 2,
  },
  compactBidBox: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 7,
    minWidth: 62,
    marginLeft: 6,
  },
  compactBidLabel: {
    color: '#000',
    fontSize: 7.5,
    fontFamily: Typography.fontFamily.bold,
    letterSpacing: 0.5,
    opacity: 0.75,
  },
  compactBidVal: {
    color: '#000',
    fontSize: 17,
    fontFamily: Typography.fontFamily.bold,
    lineHeight: 19,
  },
  compactBidUnit: {
    color: '#000',
    fontSize: 8,
    opacity: 0.75,
  },
  compactStatsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  compactStatsBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  compactStatsBarText: {
    fontSize: 10.5,
    fontFamily: Typography.fontFamily.medium,
    color: colors.textSecondary,
  },
  compactStatsBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 6,
  },

  // SOLD Stamp Card
  soldStampCard: {
    backgroundColor: colors.surface,
    borderRadius: 20, padding: 16, alignItems: 'center', marginBottom: 16,
    borderWidth: 1.5, borderColor: '#16a34a',
    shadowColor: '#16a34a', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 8,
  },
  soldPhotoWrap: {
    width: 120, height: 120, borderRadius: 60, overflow: 'hidden',
    backgroundColor: '#0a0f1d',
    marginBottom: 10, borderWidth: 3, borderColor: '#16a34a', position: 'relative',
  },
  soldPlayerPhoto: { width: '100%', height: '100%', resizeMode: 'contain', backgroundColor: '#0a0f1d' },
  stampWrap: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center', alignItems: 'center',
    transform: [{ rotate: '-25deg' }],
  },
  stampInner: {
    borderWidth: 4, borderColor: '#16a34a', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 3,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  stampText: {
    color: '#22c55e', fontSize: 24, fontFamily: Typography.fontFamily.bold,
    letterSpacing: 4,
    textShadowColor: '#000', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 4,
  },
  soldPlayerName: {
    fontSize: 17, fontFamily: Typography.fontFamily.bold,
    color: colors.textPrimary, marginBottom: 4, textAlign: 'center',
  },
  soldRolePill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: colors.surface, borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: colors.border, marginBottom: 10,
  },
  soldRoleText: { color: colors.primary, fontSize: 12, fontFamily: Typography.fontFamily.bold },
  soldDivider: { width: '100%', height: 1, backgroundColor: colors.border, marginVertical: 10 },
  soldTeamPriceRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', width: '100%', paddingHorizontal: 4,
  },
  soldTeamBox: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  soldTeamLogo: { width: 42, height: 42, borderRadius: 21, borderWidth: 2, borderColor: colors.primary },
  soldTeamLabel: {
    color: colors.textTertiary, fontSize: 9, fontFamily: Typography.fontFamily.bold, letterSpacing: 1, marginBottom: 2,
  },
  soldTeamName: { color: colors.textPrimary, fontSize: 14, fontFamily: Typography.fontFamily.bold, maxWidth: 110 },
  soldPriceBox: {
    alignItems: 'flex-end', backgroundColor: 'rgba(22,163,74,0.12)',
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: '#16a34a',
  },
  soldPriceLabel: { color: '#16a34a', fontSize: 8, fontFamily: Typography.fontFamily.bold, letterSpacing: 1 },
  soldPriceValue: { color: '#22c55e', fontSize: 24, fontFamily: Typography.fontFamily.bold, lineHeight: 26 },
  soldPriceUnit: { color: '#16a34a', fontSize: 10, fontFamily: Typography.fontFamily.bold },

  purseCard: {
    backgroundColor: colors.surface, borderRadius: 18, padding: Spacing.lg,
    borderWidth: 1, borderColor: colors.border, marginBottom: Spacing.lg,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 4,
  },
  purseTop: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md },
  teamLogoImg: { width: 44, height: 44, borderRadius: 22 },
  teamLogoPlaceholder: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: colors.primary,
  },
  teamName: { fontSize: 17, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary },
  teamSub: { fontSize: 11, color: colors.textTertiary, marginTop: 1 },
  purseLabel: { fontSize: 11, color: colors.textTertiary },
  purseValue: { fontSize: 22, fontFamily: Typography.fontFamily.bold, color: '#FFD700' },
  pendingPurseBadge: {
    backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
    borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginTop: 3,
    borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
  },
  pendingPurseText: {
    fontSize: 11, fontFamily: Typography.fontFamily.medium, color: colors.textTertiary,
  },
  purseBg: { height: 5, borderRadius: 3, backgroundColor: colors.surface, overflow: 'hidden', marginBottom: 4 },
  purseFill: { height: '100%', borderRadius: 3, backgroundColor: '#EF4444' },
  purseSub: { fontSize: 10, color: colors.textTertiary, textAlign: 'right', marginBottom: Spacing.md },
  statGrid: { flexDirection: 'row' },
  gridBox: { flex: 1, backgroundColor: colors.surface, padding: Spacing.md, borderRadius: 12, alignItems: 'center' },
  gridVal: { fontSize: 20, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary },
  gridLabel: { fontSize: 11, color: colors.textTertiary, marginTop: 2 },

  sectionTitle: { fontSize: 15, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary, marginBottom: Spacing.sm },

  photoCard: {
    borderRadius: 18, overflow: 'hidden', height: 200,
    backgroundColor: '#0a0f1d', marginBottom: 10,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8,
  },
  photoImg: { width: '100%', height: '100%', resizeMode: 'contain', backgroundColor: '#0a0f1d', position: 'absolute', top: 0, left: 0 },
  photoPlaceholder: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0f1d' },

  // ── Ball-type Player Stats Card ──
  statsCardContainer: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  statsCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    marginBottom: 8,
  },
  statsBallTypeTitle: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.bold,
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  matchesPill: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginLeft: 6,
  },
  matchesPillText: {
    fontSize: 10,
    fontFamily: Typography.fontFamily.bold,
    color: colors.textSecondary,
  },
  playerStylesSummary: {
    fontSize: 11,
    color: colors.textTertiary,
    fontFamily: Typography.fontFamily.medium,
    maxWidth: '48%',
  },
  statsMetricsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  metricColumn: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  metricColumnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  metricColumnTitle: {
    fontSize: 10,
    fontFamily: Typography.fontFamily.bold,
    letterSpacing: 0.5,
  },
  metricMainVal: {
    fontSize: 15,
    fontFamily: Typography.fontFamily.bold,
    color: colors.textPrimary,
  },
  metricUnit: {
    fontSize: 10,
    fontFamily: Typography.fontFamily.medium,
    color: colors.textSecondary,
  },
  metricSubVal: {
    fontSize: 10,
    color: colors.textSecondary,
    fontFamily: Typography.fontFamily.medium,
    marginTop: 1,
    textAlign: 'center',
  },
  metricDetailVal: {
    fontSize: 9,
    color: colors.textTertiary,
    marginTop: 1,
    textAlign: 'center',
  },
  metricDivider: {
    width: 1,
    height: '80%',
    backgroundColor: 'rgba(255,255,255,0.07)',
    marginHorizontal: 4,
    alignSelf: 'center',
  },
  photoBadgeRow: { position: 'absolute', top: 12, left: 12 },
  photoOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.75)', flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: 14, paddingVertical: 12, gap: 10,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
  },
  photoPlayerName: { fontSize: 20, fontFamily: Typography.fontFamily.bold, color: '#fff' },
  rolePill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0, 0, 0, 1)', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: colors.primary,
  },
  rolePillText: { color: colors.primary, fontSize: 11, fontFamily: Typography.fontFamily.bold },
  photoBase: { color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 2 },
  leadingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  photoLeading: { color: '#FFD700', fontSize: 12, fontFamily: Typography.fontFamily.semiBold },
  bidPill: {
    alignItems: 'center', backgroundColor: colors.primary,
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, minWidth: 68,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.5, shadowRadius: 6, elevation: 6,
  },
  bidPillLabel: { color: '#000', fontSize: 8, fontFamily: Typography.fontFamily.bold, letterSpacing: 1, opacity: 0.7 },
  bidPillVal: { color: '#000', fontSize: 22, fontFamily: Typography.fontFamily.bold, lineHeight: 24 },
  bidPillUnit: { color: '#000', fontSize: 10, opacity: 0.7 },

  // Star Banner
  starBanner: {
    borderRadius: 14, padding: 12, marginBottom: Spacing.lg,
    backgroundColor: isDark ? 'rgba(255,215,0,0.08)' : 'rgba(217,119,6,0.08)', borderWidth: 1.5, borderColor: isDark ? '#FFD700' : '#D97706',
  },
  starBannerHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  starBannerTitle: { color: isDark ? '#FFD700' : '#B45309', fontSize: 12, fontFamily: Typography.fontFamily.bold },
  starBannerBody: { flexDirection: 'row', alignItems: 'center' },
  starAvatar: { width: 42, height: 42, borderRadius: 21, borderWidth: 1.5, borderColor: isDark ? '#FFD700' : '#D97706' },
  starName: { color: colors.textPrimary, fontSize: 15, fontFamily: Typography.fontFamily.bold },
  starTeam: { color: colors.textTertiary, fontSize: 11, marginTop: 1 },
  starRole: { color: colors.textTertiary, fontSize: 11 },
  starPricePill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: isDark ? 'rgba(255,215,0,0.18)' : 'rgba(217,119,6,0.15)', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: isDark ? 'rgba(255,215,0,0.5)' : 'rgba(217,119,6,0.4)',
  },
  starPriceText: { color: isDark ? '#FFD700' : '#B45309', fontSize: 14, fontFamily: Typography.fontFamily.bold },

  // Squad header (tappable)
  squadHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: Spacing.sm, paddingVertical: 4,
  },
  emptyCard: {
    backgroundColor: colors.surface, padding: Spacing.xl, borderRadius: 14,
    alignItems: 'center', gap: 8, borderWidth: 1, borderColor: colors.border, marginBottom: Spacing.lg,
  },
  emptyText: { color: colors.textTertiary, fontSize: 13 },
  squadRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface, padding: Spacing.md, borderRadius: 14,
    marginBottom: Spacing.xs, borderWidth: 1, borderColor: colors.border,
  },
  squadRowTop: { borderColor: 'rgba(255,215,0,0.5)', backgroundColor: 'rgba(255,215,0,0.04)' },
  squadNum: { color: colors.textTertiary, fontSize: 13, width: 22, fontFamily: Typography.fontFamily.semiBold },
  squadAvatar: { width: 38, height: 38, borderRadius: 19, borderWidth: 1.5, borderColor: colors.border },
  squadAvatarPlaceholder: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: colors.border,
  },
  squadName: { fontSize: 14, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary },
  squadRole: { fontSize: 11, color: colors.textTertiary, marginTop: 1 },
  soldPricePill: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,215,0,0.12)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, borderColor: 'rgba(255,215,0,0.35)',
  },
  soldPricePillRetained: { backgroundColor: 'rgba(96,165,250,0.15)', borderColor: 'rgba(96,165,250,0.4)' },
  soldPriceText: { color: '#FFD700', fontSize: 13, fontFamily: Typography.fontFamily.bold },

  // ── Auction Players Section ──
  auctionPlayersSection: {
    marginTop: Spacing.md,
    marginBottom: Spacing.md,
  },
  playersSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    paddingVertical: 4,
  },
  playerSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 8 : 4,
    marginBottom: 10,
  },
  playerSearchInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 13,
    fontFamily: Typography.fontFamily.medium,
    paddingVertical: 4,
  },
  statusFilterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 6,
  },
  statusFilterChipActive: {
    backgroundColor: `${colors.primary}22`,
    borderColor: colors.primary,
  },
  statusFilterChipText: {
    fontSize: 11,
    fontFamily: Typography.fontFamily.semiBold,
    color: colors.textTertiary,
  },
  statusFilterChipTextActive: {
    color: colors.primary,
    fontFamily: Typography.fontFamily.bold,
  },
  emptyPlayersBox: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: Spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyPlayersText: {
    color: colors.textTertiary,
    fontSize: 13,
    marginTop: 6,
    fontFamily: Typography.fontFamily.medium,
  },
  auctionPlayerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: isDark ? 0.25 : 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  auctionPlayerRowLive: {
    borderColor: colors.primary,
    borderWidth: 1.5,
    backgroundColor: isDark ? `${colors.primary}12` : 'rgba(234, 179, 8, 0.08)',
  },
  auctionPlayerIdx: {
    color: colors.textTertiary,
    fontSize: 12,
    width: 22,
    textAlign: 'center',
    marginRight: 6,
    fontFamily: Typography.fontFamily.semiBold,
  },
  auctionPlayerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    resizeMode: 'contain',
    backgroundColor: '#0a0f1d',
    borderWidth: 1,
    borderColor: colors.border,
  },
  auctionPlayerAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#0a0f1d',
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  auctionPlayerInitials: {
    fontSize: 14,
    fontFamily: Typography.fontFamily.bold,
    color: colors.primary,
  },
  auctionPlayerName: {
    fontSize: 14,
    fontFamily: Typography.fontFamily.bold,
    color: colors.textPrimary,
  },
  livePillSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    borderRadius: 10,
    paddingHorizontal: 5,
    paddingVertical: 1,
    marginLeft: 6,
  },
  liveDotSmall: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#F59E0B',
    marginRight: 3,
  },
  livePillSmallText: {
    fontSize: 9,
    fontFamily: Typography.fontFamily.bold,
    color: '#F59E0B',
    letterSpacing: 0.5,
  },
  auctionPlayerMeta: {
    fontSize: 11,
    color: colors.textTertiary,
    marginTop: 2,
  },
  auctionPlayerStatusWrap: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginLeft: 8,
  },
  statusSoldBadge: {
    alignItems: 'flex-end',
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  statusSoldText: {
    color: '#22C55E',
    fontSize: 10,
    fontFamily: Typography.fontFamily.bold,
  },
  statusSoldTeam: {
    color: colors.textSecondary,
    fontSize: 10,
    fontFamily: Typography.fontFamily.medium,
    marginTop: 1,
    maxWidth: 90,
  },
  statusLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(245, 158, 11, 0.18)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
  },
  statusLiveText: {
    color: '#F59E0B',
    fontSize: 10,
    fontFamily: Typography.fontFamily.bold,
    letterSpacing: 0.5,
  },
  statusUnsoldBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  statusUnsoldText: {
    color: '#EF4444',
    fontSize: 10,
    fontFamily: Typography.fontFamily.bold,
  },
  statusSkippedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  statusSkippedText: {
    color: '#F59E0B',
    fontSize: 10,
    fontFamily: Typography.fontFamily.bold,
  },
  statusAvailableBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statusAvailableText: {
    color: isDark ? colors.textTertiary : colors.textSecondary,
    fontSize: 10,
    fontFamily: Typography.fontFamily.semiBold,
  },
});

export default AuctionLiveTeamOwnerScreen;
