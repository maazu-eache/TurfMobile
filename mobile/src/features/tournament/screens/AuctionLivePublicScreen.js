import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Animated,
  Image,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors, Spacing, Typography } from '../../../theme/theme';
import auctionService from '../../../services/auctionService';
import { getImageUrl } from '../../../api/axios';

const { width } = Dimensions.get('window');

const AuctionLivePublicScreen = ({ route, navigation }) => {
  const { auctionId } = route.params || {};

  const [liveState, setLiveState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedTeams, setExpandedTeams] = useState({});
  const [lastSold, setLastSold] = useState(null); // { player, team, price }

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(fadeAnim, { toValue: 0.2, duration: 700, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
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
      loadLiveState();

      const unsubscribe = auctionService.onAuctionUpdate((updatedState) => {
        slideAnim.setValue(20);
        opacityAnim.setValue(0);
        Animated.parallel([
          Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.timing(opacityAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        ]).start();
        // Detect sold event: previous had a currentPlayer, new state doesn't
        setLiveState(prev => {
          if (prev?.auction?.currentPlayer && !updatedState?.auction?.currentPlayer) {
            // A player just got sold/unsold — check history for sold event
            const lastHistory = updatedState?.history?.[0];
            if (lastHistory?.eventType === 'player_sold') {
              // Find the player from teams squads (newly added)
              const reg = prev.auction.currentPlayer;
              const winTeamId = lastHistory?.team;
              const winTeam = (updatedState.teams || []).find(t => t._id?.toString() === winTeamId?.toString());
              setLastSold({
                player: reg,
                team: winTeam,
                price: lastHistory?.amount || 0,
              });
            }
          }
          if (updatedState?.auction?.currentPlayer) {
            // New player opened — clear sold card
            setLastSold(null);
          }
          return updatedState;
        });
      });

      return () => {
        unsubscribe();
        auctionService.leaveAuctionRoom(auctionId);
      };
    }
  }, [auctionId]);

  const loadLiveState = async () => {
    try {
      const res = await auctionService.getLiveState(auctionId);
      setLiveState(res.data);
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]).start();
    } catch (err) {
      console.log('Error loading public live state:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleTeam = (teamId) => {
    setExpandedTeams(prev => ({ ...prev, [teamId]: !prev[teamId] }));
  };

  const currentPlayer = liveState?.auction?.currentPlayer;
  const currentHighestTeam = liveState?.auction?.currentHighestTeam;
  const currentBid = liveState?.auction?.currentHighestBid || 0;
  const teams = liveState?.teams || [];

  const currentSetId = liveState?.auction?.currentSet?._id || liveState?.auction?.currentSet;
  const currentSet = liveState?.sets?.find(s => s._id === currentSetId);
  const setName = currentSet?.setName || 'Auction';
  const auctionedCount = currentSet?.auctionedCount || 0;
  const totalPlayersCount = currentSet?.totalPlayersCount || 0;
  const progressPercent = totalPlayersCount > 0 ? (auctionedCount / totalPlayersCount) * 100 : 0;
  const auctionName = liveState?.auction?.tournament?.name || 'Live Auction';
  const sortedTeams = [...teams].sort((a, b) => (b.purseSpent || 0) - (a.purseSpent || 0));

  // Global star player (highest bid across all teams, excluding Retained)
  let starPlayer = null;
  let starPrice = 0;
  let starTeamName = '';
  teams.forEach(t => {
    (t.players || []).forEach(p => {
      const price = typeof p.soldPrice === 'number' ? p.soldPrice : 0;
      if (price > starPrice) { starPrice = price; starPlayer = p; starTeamName = t.name; }
    });
  });

  const formatPrice = (price) => {
    if (price === 'Retained' || price === null || price === undefined) return 'Retained';
    if (typeof price === 'number') return `${price} Pts`;
    return String(price);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Connecting to live auction...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>{auctionName}</Text>
          {currentSet && (
            <Text style={styles.headerSub}>{setName} · {auctionedCount}/{totalPlayersCount} Players</Text>
          )}
        </View>
        {liveState?.auction?.status === 'completed' ? (
          <View style={[styles.livePill, { borderColor: Colors.textTertiary, backgroundColor: Colors.surface }]}>
            <Icon name="check-circle" size={12} color={Colors.textTertiary} />
            <Text style={[styles.livePillText, { color: Colors.textTertiary, marginLeft: 4 }]}>CLOSED</Text>
          </View>
        ) : (
          <Animated.View style={[styles.livePill, { opacity: fadeAnim }]}>
            <View style={styles.liveDot} />
            <Text style={styles.livePillText}>LIVE</Text>
          </Animated.View>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Set Progress */}
        {currentSet && (
          <View style={styles.progressStrip}>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
            </View>
            <Text style={styles.progressLabel}>{setName} Progress: {auctionedCount}/{totalPlayersCount} Players ({Math.round(progressPercent)}%)</Text>
          </View>
        )}

        {/* Current Player Photo Banner */}
        
          {liveState?.auction?.status === 'completed' ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
              <Icon name="check-decagram" size={80} color={Colors.primary} />
              <Text style={{ fontFamily: Typography.fontFamily.bold, fontSize: 26, color: Colors.textPrimary, marginTop: 20 }}>Auction Completed</Text>
              <Text style={{ fontFamily: Typography.fontFamily.regular, fontSize: 16, color: Colors.textTertiary, marginTop: 10, textAlign: 'center', lineHeight: 24 }}>
                The auction has been closed by the organiser. You can view all squad details below.
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
                <Icon name="cricket" size={12} color={Colors.primary} />
                <Text style={styles.soldRoleText}>{lastSold.player?.role}</Text>
              </View>
              <View style={styles.soldDivider} />
              <View style={styles.soldTeamPriceRow}>
                <View style={styles.soldTeamBox}>
                  {lastSold.team?.logo ? (
                    <Image source={{ uri: getImageUrl(lastSold.team.logo) }} style={styles.soldTeamLogo} />
                  ) : (
                    <View style={[styles.soldTeamLogo, { backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center' }]}>
                      <Icon name="shield-crown" size={20} color={Colors.primary} />
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
<Animated.View style={[styles.playerCard, { opacity: opacityAnim, transform: [{ translateY: slideAnim }] }]}>
          {(currentPlayer?.photo || currentPlayer?.player?.photo) ? (
            <Image source={{ uri: getImageUrl(currentPlayer.photo || currentPlayer.player?.photo) }} style={styles.photoImg} />
          ) : (
            <View style={styles.photoPlaceholder}>
              <Icon name="account-star" size={90} color={Colors.textTertiary} />
              {!currentPlayer && <Text style={styles.waitingText}>Waiting for next player...</Text>}
            </View>
          )}
          {currentPlayer && (
            <View style={styles.photoBadgeRow}>
              <View style={styles.roleBadge}>
                <Icon name="cricket" size={12} color={Colors.primary} />
                <Text style={styles.roleText}>{currentPlayer.role}</Text>
              </View>
            </View>
          )}
          <View style={styles.photoOverlay}>
            {currentPlayer ? (
              <>
                <View style={{ flex: 1 }}>
                  <Text style={styles.playerName} numberOfLines={1}>{currentPlayer.fullName}</Text>
                  <Text style={styles.basePriceLabel}>
                    Base: <Text style={styles.basePriceVal}>{currentPlayer.basePrice || liveState?.auction?.defaultBasePrice || 0} Pts</Text>
                  </Text>
                  {currentHighestTeam && (
                    <View style={styles.leadingRow}>
                      <Icon name="trophy" size={12} color="#FFD700" />
                      <Text style={styles.leadingLabel}>{currentHighestTeam.shortName || currentHighestTeam.name}</Text>
                    </View>
                  )}
                </View>
                <View style={styles.bidPill}>
                  <Text style={styles.bidPillLabel}>CURRENT BID</Text>
                  <Animated.Text style={[styles.bidPillVal, { transform: [{ scale: currentBid > 0 ? pulseAnim : 1 }] }]}>
                    {currentBid}
                  </Animated.Text>
                  <Text style={styles.bidPillUnit}>Pts</Text>
                </View>
              </>
            ) : (
              <Text style={styles.waitingText}>Waiting for next player...</Text>
            )}
          </View>
        </Animated.View>
        )}

        {/* Star Player Banner */}
        {starPlayer && starPrice > 0 && (
          <View style={styles.starBanner}>
            <View style={styles.starBannerHeader}>
              <Icon name="star-circle" size={16} color="#FFD700" />
              <Text style={styles.starBannerTitle}>
                {liveState?.auction?.status === 'completed' ? 'Highest Bid in the auction' : 'Highest Bid till now'}
              </Text>
            </View>
            <View style={styles.starBannerBody}>
              {(starPlayer.photo || starPlayer.player?.photo) ? (
                <Image source={{ uri: getImageUrl(starPlayer.photo || starPlayer.player?.photo) }} style={styles.starAvatar} />
              ) : (
                <View style={[styles.starAvatar, { backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center' }]}>
                  <Icon name="account" size={20} color="#FFD700" />
                </View>
              )}
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.starName}>{starPlayer.fullName}</Text>
                <Text style={styles.starTeam}>{starTeamName}</Text>
                <Text style={styles.starRole}>{starPlayer.role}</Text>
              </View>
              <View style={styles.starPricePill}>
                <Icon name="trophy" size={12} color="#FFD700" />
                <Text style={styles.starPriceText}>{starPrice} Pts</Text>
              </View>
            </View>
          </View>
        )}

        {/* Teams & Squad Section */}
        <View style={styles.sectionHeader}>
          <Icon name="shield-half-full" size={18} color={Colors.primary} />
          <Text style={styles.sectionTitle}>Teams & Squad</Text>
        </View>

        {sortedTeams.length === 0 ? (
          <View style={styles.emptyBox}>
            <Icon name="account-group-outline" size={40} color={Colors.textTertiary} />
            <Text style={styles.emptyText}>No teams registered yet.</Text>
          </View>
        ) : (
          sortedTeams.map((t, index) => {
            const totalPurse = t.auctionPurse || 0;
            const spent = t.purseSpent || 0;
            const remaining = t.purseRemaining ?? (totalPurse - spent);
            const spentPct = totalPurse > 0 ? Math.min((spent / totalPurse) * 100, 100) : 0;
            const isLeading = currentHighestTeam?._id === t._id;
            const squad = t.players || [];
            const isExpanded = !!expandedTeams[t._id];

            // Find top player in this team
            let topPrice = 0;
            squad.forEach(p => {
              const price = typeof p.soldPrice === 'number' ? p.soldPrice : 0;
              if (price > topPrice) topPrice = price;
            });

            return (
              <View key={t._id} style={[styles.teamCard, isLeading && styles.teamCardLeading]}>
                {/* Tappable Team Header */}
                <TouchableOpacity
                  style={styles.teamCardHeader}
                  onPress={() => toggleTeam(t._id)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.teamRank}>#{index + 1}</Text>
                  {t.logo ? (
                    <Image source={{ uri: getImageUrl(t.logo) }} style={styles.teamLogo} />
                  ) : (
                    <View style={styles.teamLogoPlaceholder}>
                      <Icon name="shield-crown-outline" size={22} color={isLeading ? '#FFD700' : Colors.primary} />
                    </View>
                  )}
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <View style={styles.teamNameRow}>
                      <Text style={styles.teamName} numberOfLines={1}>{t.name}</Text>
                      {isLeading && (
                        <View style={styles.leadingBadge}>
                          <Icon name="trophy" size={9} color="#FFD700" />
                          <Text style={styles.leadingText}>LEADING</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.teamOwnerText}>Captain: {t.owner?.name || 'N/A'}</Text>
                    <View style={styles.purseMiniRow}>
                      <Text style={styles.teamSquadCount}>{squad.length} players</Text>
                      <View style={[styles.miniBarBg, { flex: 1, marginHorizontal: 8 }]}>
                        <View style={[styles.miniBarFill, { width: `${spentPct}%` }]} />
                      </View>
                    </View>
                  </View>
                  <View style={styles.teamPurseWrap}>
                    <Text style={[styles.teamPurseRemaining, isLeading && { color: '#FFD700' }]}>{remaining}</Text>
                    <Text style={styles.teamPurseLabel}>Pts left</Text>
                  </View>
                  <Icon
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={Colors.textTertiary}
                    style={{ marginLeft: 6 }}
                  />
                </TouchableOpacity>

                {/* Expandable Squad */}
                {isExpanded && (
                  <View style={styles.squadSection}>
                    {squad.length === 0 ? (
                      <Text style={styles.noPlayersText}>No players bought yet.</Text>
                    ) : (
                      squad.map((p, idx) => {
                        const price = p.soldPrice;
                        const isRetained = price === 'Retained' || (typeof price === 'number' && price === 0 && p.soldAt == null);
                        const isTop = typeof price === 'number' && price === topPrice && topPrice > 0;
                        return (
                          <View key={`${p._id || 'squad'}-${idx}`} style={styles.squadPlayerRow}>
                            <Text style={styles.squadIdx}>{idx + 1}</Text>
                            {(p.photo || p.player?.photo) ? (
                              <Image source={{ uri: getImageUrl(p.photo || p.player?.photo) }} style={styles.squadPlayerAvatar} />
                            ) : (
                              <View style={styles.squadPlayerAvatarPlaceholder}>
                                <Icon name="account" size={14} color={Colors.textTertiary} />
                              </View>
                            )}
                            <View style={{ flex: 1, marginLeft: 8 }}>
                              <Text style={styles.squadPlayerName} numberOfLines={1}>{p.fullName || 'Unknown'}</Text>
                              <Text style={styles.squadPlayerRole}>{p.role || '—'}</Text>
                            </View>
                            <View style={[styles.pricePill, isRetained && styles.pricePillRetained]}>
                              {isRetained && <Icon name="bookmark" size={10} color="#60a5fa" style={{ marginRight: 3 }} />}
                              <Text style={[styles.priceText, isRetained && { color: '#60a5fa' }]}>
                                {isRetained ? 'Retained' : `${price} Pts`}
                              </Text>
                            </View>
                          </View>
                        );
                      })
                    )}
                  </View>
                )}
              </View>
            );
          })
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loadingBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: Colors.textSecondary, marginTop: 12, fontFamily: Typography.fontFamily.regular, fontSize: 14 },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.md,
    backgroundColor: Colors.backgroundElevated,
    borderBottomWidth: 1, borderBottomColor: Colors.border, gap: Spacing.sm,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  headerTitle: { fontFamily: Typography.fontFamily.bold, fontSize: 15, color: Colors.textPrimary },
  headerSub: { fontFamily: Typography.fontFamily.regular, fontSize: 11, color: Colors.textTertiary, marginTop: 1 },
  livePill: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(239,68,68,0.15)', borderWidth: 1, borderColor: '#EF4444',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#EF4444', marginRight: 5 },
  livePillText: { color: '#EF4444', fontSize: 11, fontFamily: Typography.fontFamily.bold, letterSpacing: 1 },

  progressStrip: { paddingHorizontal: Spacing.base, paddingTop: Spacing.md, paddingBottom: Spacing.xs },
  progressBarBg: { height: 5, borderRadius: 3, backgroundColor: Colors.surface, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 3, backgroundColor: Colors.primary },
  progressLabel: { marginTop: 4, fontSize: 11, color: Colors.textTertiary, textAlign: 'right' },
  content: { paddingBottom: 20 },

  // SOLD Stamp Card
  soldStampCard: {
    marginHorizontal: Spacing.base, marginVertical: Spacing.md,
    backgroundColor: Colors.backgroundElevated,
    borderRadius: 20, padding: 16, alignItems: 'center',
    borderWidth: 1.5, borderColor: '#16a34a',
    shadowColor: '#16a34a', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 8,
  },
  soldPhotoWrap: {
    width: 120, height: 120, borderRadius: 60, overflow: 'hidden',
    marginBottom: 10, borderWidth: 3, borderColor: '#16a34a', position: 'relative',
  },
  soldPlayerPhoto: { width: '100%', height: '100%', resizeMode: 'cover' },
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
    color: '#22c55e', fontSize: 26, fontFamily: Typography.fontFamily.bold,
    letterSpacing: 5,
    textShadowColor: '#000', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 4,
  },
  soldPlayerName: {
    fontSize: 18, fontFamily: Typography.fontFamily.bold,
    color: Colors.textPrimary, marginBottom: 4, textAlign: 'center',
  },
  soldRolePill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.surface, borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: Colors.border, marginBottom: 10,
  },
  soldRoleText: { color: Colors.primary, fontSize: 12, fontFamily: Typography.fontFamily.bold },
  soldDivider: { width: '100%', height: 1, backgroundColor: Colors.border, marginVertical: 10 },
  soldTeamPriceRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', width: '100%', paddingHorizontal: 4,
  },
  soldTeamBox: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  soldTeamLogo: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: Colors.primary },
  soldTeamLabel: {
    color: Colors.textTertiary, fontSize: 9, fontFamily: Typography.fontFamily.bold, letterSpacing: 1, marginBottom: 2,
  },
  soldTeamName: { color: Colors.textPrimary, fontSize: 14, fontFamily: Typography.fontFamily.bold, maxWidth: 110 },
  soldPriceBox: {
    alignItems: 'flex-end', backgroundColor: 'rgba(22,163,74,0.12)',
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: '#16a34a',
  },
  soldPriceLabel: { color: '#16a34a', fontSize: 8, fontFamily: Typography.fontFamily.bold, letterSpacing: 1 },
  soldPriceValue: { color: '#22c55e', fontSize: 26, fontFamily: Typography.fontFamily.bold, lineHeight: 28 },
  soldPriceUnit: { color: '#16a34a', fontSize: 10, fontFamily: Typography.fontFamily.bold },

  // Player banner
  playerCard: {
    marginHorizontal: Spacing.base, marginVertical: Spacing.md,
    borderRadius: 20, overflow: 'hidden', height: 220,
    backgroundColor: '#1a1a2e',
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 8,
  },
  photoImg: { width: '100%', height: '100%', resizeMode: 'cover', position: 'absolute', top: 0, left: 0 },
  photoPlaceholder: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a2e' },
  waitingText: { color: 'rgba(255,255,255,0.4)', marginTop: 8, fontSize: 13 },
  photoBadgeRow: { position: 'absolute', top: 12, left: 12 },
  photoOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.80)',
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: 14, paddingVertical: 12, gap: 10,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)',
  },
  playerName: {
    fontFamily: Typography.fontFamily.bold, fontSize: 20, color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },
  roleBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: Colors.primary,
  },
  roleText: { fontFamily: Typography.fontFamily.bold, fontSize: 12, color: Colors.primary },
  basePriceLabel: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 3 },
  basePriceVal: { fontFamily: Typography.fontFamily.bold, color: 'rgba(255,255,255,0.9)' },
  leadingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  leadingLabel: { color: '#FFD700', fontSize: 12, fontFamily: Typography.fontFamily.semiBold },
  bidPill: {
    alignItems: 'center', backgroundColor: Colors.primary,
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, minWidth: 72,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.5, shadowRadius: 6, elevation: 6,
  },
  bidPillLabel: { color: '#000', fontSize: 8, fontFamily: Typography.fontFamily.bold, letterSpacing: 1, opacity: 0.7 },
  bidPillVal: { color: '#000', fontSize: 24, fontFamily: Typography.fontFamily.bold, lineHeight: 26 },
  bidPillUnit: { color: '#000', fontSize: 10, opacity: 0.7 },

  // Star Player Banner
  starBanner: {
    marginHorizontal: Spacing.base, marginBottom: Spacing.md,
    backgroundColor: '#1a1500', borderRadius: 14, padding: 12,
    borderWidth: 1.5, borderColor: '#FFD700',
  },
  starBannerHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  starBannerTitle: { color: '#FFD700', fontSize: 12, fontFamily: Typography.fontFamily.bold, letterSpacing: 0.5 },
  starBannerBody: { flexDirection: 'row', alignItems: 'center' },
  starAvatar: { width: 42, height: 42, borderRadius: 21, borderWidth: 1.5, borderColor: '#FFD700' },
  starName: { color: Colors.textPrimary, fontSize: 15, fontFamily: Typography.fontFamily.bold },
  starTeam: { color: Colors.textTertiary, fontSize: 11, marginTop: 1 },
  starRole: { color: Colors.textTertiary, fontSize: 11 },
  starPricePill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(255,215,0,0.18)', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(255,215,0,0.5)',
  },
  starPriceText: { color: '#FFD700', fontSize: 14, fontFamily: Typography.fontFamily.bold },

  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: Spacing.base, paddingTop: Spacing.xs, paddingBottom: Spacing.sm,
  },
  sectionTitle: { fontFamily: Typography.fontFamily.bold, fontSize: 16, color: Colors.textPrimary },
  emptyBox: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  emptyText: { color: Colors.textTertiary, fontSize: 14 },

  // Team Card
  teamCard: {
    marginHorizontal: Spacing.base, marginBottom: Spacing.sm,
    backgroundColor: Colors.backgroundElevated,
    borderRadius: 16, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden',
  },
  teamCardLeading: { borderColor: '#FFD700', backgroundColor: 'rgba(255,215,0,0.04)' },
  teamCardHeader: {
    flexDirection: 'row', alignItems: 'center', padding: Spacing.md,
  },
  teamRank: { fontFamily: Typography.fontFamily.bold, fontSize: 12, color: Colors.textTertiary, width: 26 },
  teamLogo: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surface },
  teamLogoPlaceholder: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  teamNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  teamName: { fontFamily: Typography.fontFamily.bold, fontSize: 14, color: Colors.textPrimary, flex: 1 },
  teamOwnerText: { fontFamily: Typography.fontFamily.regular, fontSize: 11, color: Colors.textTertiary, marginBottom: 3 },
  leadingBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(255,215,0,0.2)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
  },
  leadingText: { fontFamily: Typography.fontFamily.bold, fontSize: 9, color: '#FFD700', letterSpacing: 0.5 },
  purseMiniRow: { flexDirection: 'row', alignItems: 'center' },
  teamSquadCount: { color: Colors.textTertiary, fontSize: 10 },
  miniBarBg: { height: 3, borderRadius: 2, backgroundColor: Colors.surface, overflow: 'hidden' },
  miniBarFill: { height: '100%', borderRadius: 2, backgroundColor: Colors.primary },
  teamPurseWrap: { alignItems: 'flex-end', marginLeft: 4 },
  teamPurseRemaining: { fontFamily: Typography.fontFamily.bold, fontSize: 16, color: Colors.primary },
  teamPurseLabel: { fontSize: 10, color: Colors.textTertiary, marginTop: 1 },

  // Squad list inside team card
  squadSection: {
    borderTopWidth: 1, borderTopColor: Colors.border,
    paddingHorizontal: Spacing.md, paddingTop: 8, paddingBottom: 10,
    backgroundColor: Colors.background,
  },
  noPlayersText: { color: Colors.textTertiary, fontSize: 12, fontStyle: 'italic', paddingVertical: 8 },
  squadPlayerRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  squadPlayerRowTop: { backgroundColor: 'rgba(255,215,0,0.04)' },
  squadIdx: { color: Colors.textTertiary, fontSize: 11, width: 20 },
  squadPlayerAvatar: { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, borderColor: Colors.border },
  squadPlayerAvatarPlaceholder: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: Colors.border,
  },
  squadPlayerName: { color: Colors.textPrimary, fontSize: 13, fontFamily: Typography.fontFamily.semiBold },
  squadPlayerRole: { color: Colors.textTertiary, fontSize: 10, marginTop: 1 },
  pricePill: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: 6,
    paddingHorizontal: 7, paddingVertical: 3,
    borderWidth: 1, borderColor: Colors.border,
  },
  pricePillTop: { backgroundColor: 'rgba(255,215,0,0.15)', borderColor: 'rgba(255,215,0,0.4)' },
  pricePillRetained: { backgroundColor: 'rgba(96,165,250,0.15)', borderColor: 'rgba(96,165,250,0.4)' },
  priceText: { color: Colors.textSecondary, fontSize: 11, fontFamily: Typography.fontFamily.bold },
});

export default AuctionLivePublicScreen;
