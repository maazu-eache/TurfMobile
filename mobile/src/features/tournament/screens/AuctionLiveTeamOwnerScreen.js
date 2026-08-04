import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
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

const AuctionLiveTeamOwnerScreen = ({ route, navigation }) => {
  const { auctionId } = route.params || {};

  const [ownerData, setOwnerData] = useState(null);
  const [liveState, setLiveState] = useState(null);
  const [squadExpanded, setSquadExpanded] = useState(true);
  const [lastSold, setLastSold] = useState(null); // { player, team, price }

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
              const reg = prev.auction.currentPlayer;
              const winTeamId = lastHistory?.team;
              const winTeam = (updatedState.teams || []).find(t => t._id?.toString() === winTeamId?.toString());
              setLastSold({ player: reg, team: winTeam, price: lastHistory?.amount || 0 });
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

  const loadAll = () => { loadOwnerData(); loadLiveState(); };

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
  const squad = myTeamLive?.players || ownerData?.squad || [];

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
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{team?.name || 'My Team'}</Text>
          {currentSet && (
            <Text style={styles.headerSub}>{setName} · {auctionedCount}/{totalPlayersCount} Players</Text>
          )}
        </View>
        {liveState?.auction?.status === 'completed' ? (
          <View style={[styles.liveBadge, { borderColor: Colors.textTertiary }]}>
            <Icon name="check-circle" size={12} color={Colors.textTertiary} />
            <Text style={[styles.liveBadgeText, { color: Colors.textTertiary, marginLeft: 4 }]}>CLOSED</Text>
          </View>
        ) : (
          <Animated.View style={[styles.liveBadge, { opacity: fadeAnim }]}>
            <View style={styles.liveDot} />
            <Text style={styles.liveBadgeText}>LIVE</Text>
          </Animated.View>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

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
                  <Icon name="shield-crown" size={26} color={Colors.primary} />
                </View>
              )}
              <View style={{ marginLeft: 10 }}>
                <Text style={styles.teamName}>{team?.name || 'Loading...'}</Text>
                <Text style={styles.teamSub}>Captain: {myTeamLive?.owner?.name || team?.owner?.name || 'N/A'}</Text>
              </View>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.purseLabel}>Purse Left</Text>
              <Text style={styles.purseValue}>{isAuctionStarted ? `${purseRemaining} Pts` : 'Yet to announce'}</Text>
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
            <View style={[styles.gridBox, { borderLeftWidth: 1, borderLeftColor: Colors.border }]}>
              <Text style={styles.gridVal}>{Math.max(0, (ownerData?.maxSquadSize || 20) - squad.length)}</Text>
              <Text style={styles.gridLabel}>Slots Left</Text>
            </View>
          </View>
        </View>

        {/* Current Auction Player */}
        <Text style={styles.sectionTitle}>Current Auction</Text>
        
        {liveState?.auction?.status === 'completed' ? (
          <View style={{ justifyContent: 'center', alignItems: 'center', paddingVertical: 40, backgroundColor: Colors.surface, borderRadius: 20, marginBottom: 16 }}>
            <Icon name="check-decagram" size={64} color={Colors.primary} />
            <Text style={{ fontFamily: Typography.fontFamily.bold, fontSize: 22, color: Colors.textPrimary, marginTop: 16 }}>Auction Completed</Text>
            <Text style={{ fontFamily: Typography.fontFamily.regular, fontSize: 14, color: Colors.textTertiary, marginTop: 8, textAlign: 'center', paddingHorizontal: 20 }}>
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
          <Animated.View style={[styles.photoCard, { opacity: opacityAnim, transform: [{ translateY: slideAnim }] }]}>
            {currentPlayer?.photo ? (
              <Image source={{ uri: getImageUrl(currentPlayer.photo) }} style={styles.photoImg} />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Icon name="account-circle" size={90} color={Colors.textTertiary} />
                <Text style={{ color: Colors.textTertiary, marginTop: 6, fontSize: 13 }}>
                  {currentPlayer ? '' : 'No player in auction'}
                </Text>
              </View>
            )}
            {currentPlayer && (
              <View style={styles.photoBadgeRow}>
                <View style={styles.rolePill}>
                  <Icon name="cricket" size={11} color={Colors.primary} />
                  <Text style={styles.rolePillText}>{currentPlayer.role}</Text>
                </View>
              </View>
            )}
            <View style={styles.photoOverlay}>
              {currentPlayer ? (
                <>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.photoPlayerName} numberOfLines={1}>{currentPlayer.fullName}</Text>
                    <Text style={styles.photoBase}>Base {currentPlayer.basePrice || 0} Pts</Text>
                    {currentHighestTeam && (
                      <View style={styles.leadingRow}>
                        <Icon name="trophy" size={12} color="#FFD700" />
                        <Text style={styles.photoLeading}>{currentHighestTeam.shortName || currentHighestTeam.name}</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.bidPill}>
                    <Text style={styles.bidPillLabel}>BID</Text>
                    <Animated.Text style={[styles.bidPillVal, { transform: [{ scale: currentBid > 0 ? pulseAnim : 1 }] }]}>
                      {currentBid}
                    </Animated.Text>
                    <Text style={styles.bidPillUnit}>Pts</Text>
                  </View>
                </>
              ) : (
                <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>Waiting for next player...</Text>
              )}
            </View>
          </Animated.View>
        )}
        

        {/* Auction Star Player */}
        {starPlayer && starPrice > 0 && (
          <View style={styles.starBanner}>
            <View style={styles.starBannerHeader}>
              <Icon name="star-circle" size={16} color="#FFD700" />
              <Text style={styles.starBannerTitle}>
                {liveState?.auction?.status === 'completed' ? 'Highest Bid in the auction' : 'Highest Bid till now'}
              </Text>
            </View>
            <View style={styles.starBannerBody}>
              {starPlayer.photo ? (
                <Image source={{ uri: getImageUrl(starPlayer.photo) }} style={styles.starAvatar} />
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

        {/* My Squad — Tap to expand/collapse */}
        <TouchableOpacity
          style={styles.squadHeader}
          onPress={() => setSquadExpanded(prev => !prev)}
          activeOpacity={0.7}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name="account-group" size={18} color={Colors.primary} />
            <Text style={styles.sectionTitle}>My Squad ({squad.length})</Text>
          </View>
          <Icon name={squadExpanded ? 'chevron-up' : 'chevron-down'} size={20} color={Colors.textTertiary} />
        </TouchableOpacity>

        {squadExpanded && (
          squad.length === 0 ? (
            <View style={styles.emptyCard}>
              <Icon name="account-group-outline" size={36} color={Colors.textTertiary} />
              <Text style={styles.emptyText}>No players purchased yet.</Text>
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
                      <Icon name="account" size={18} color={Colors.textSecondary} />
                    </View>
                  )}
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.squadName}>{item.fullName || 'Unknown'}</Text>
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
          )
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
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
  headerTitle: { fontSize: 16, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary },
  headerSub: { fontSize: 11, fontFamily: Typography.fontFamily.regular, color: Colors.textTertiary, marginTop: 1 },
  liveBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(239,68,68,0.15)', borderWidth: 1, borderColor: '#EF4444',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#EF4444', marginRight: 5 },
  liveBadgeText: { color: '#EF4444', fontSize: 11, fontFamily: Typography.fontFamily.bold, letterSpacing: 1 },

  content: { padding: Spacing.base, paddingBottom: 20 },
  progressStrip: { marginBottom: Spacing.md },
  progressBarBg: { height: 5, borderRadius: 3, backgroundColor: Colors.surface, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 3, backgroundColor: Colors.primary },
  progressLabel: { marginTop: 4, fontSize: 11, color: Colors.textTertiary, textAlign: 'right' },

  // SOLD Stamp Card
  soldStampCard: {
    backgroundColor: Colors.backgroundElevated,
    borderRadius: 20, padding: 16, alignItems: 'center', marginBottom: 16,
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
    color: '#22c55e', fontSize: 24, fontFamily: Typography.fontFamily.bold,
    letterSpacing: 4,
    textShadowColor: '#000', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 4,
  },
  soldPlayerName: {
    fontSize: 17, fontFamily: Typography.fontFamily.bold,
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
  soldTeamLogo: { width: 42, height: 42, borderRadius: 21, borderWidth: 2, borderColor: Colors.primary },
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
  soldPriceValue: { color: '#22c55e', fontSize: 24, fontFamily: Typography.fontFamily.bold, lineHeight: 26 },
  soldPriceUnit: { color: '#16a34a', fontSize: 10, fontFamily: Typography.fontFamily.bold },

  purseCard: {
    backgroundColor: Colors.backgroundElevated, borderRadius: 18, padding: Spacing.lg,
    borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.lg,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 4,
  },
  purseTop: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md },
  teamLogoImg: { width: 44, height: 44, borderRadius: 22 },
  teamLogoPlaceholder: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: Colors.primary,
  },
  teamName: { fontSize: 17, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary },
  teamSub: { fontSize: 11, color: Colors.textTertiary, marginTop: 1 },
  purseLabel: { fontSize: 11, color: Colors.textTertiary },
  purseValue: { fontSize: 22, fontFamily: Typography.fontFamily.bold, color: '#FFD700' },
  purseBg: { height: 5, borderRadius: 3, backgroundColor: Colors.surface, overflow: 'hidden', marginBottom: 4 },
  purseFill: { height: '100%', borderRadius: 3, backgroundColor: '#EF4444' },
  purseSub: { fontSize: 10, color: Colors.textTertiary, textAlign: 'right', marginBottom: Spacing.md },
  statGrid: { flexDirection: 'row' },
  gridBox: { flex: 1, backgroundColor: Colors.surface, padding: Spacing.md, borderRadius: 12, alignItems: 'center' },
  gridVal: { fontSize: 20, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary },
  gridLabel: { fontSize: 11, color: Colors.textTertiary, marginTop: 2 },

  sectionTitle: { fontSize: 15, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary, marginBottom: Spacing.sm },

  photoCard: {
    borderRadius: 18, overflow: 'hidden', height: 200,
    backgroundColor: '#1a1a2e', marginBottom: Spacing.lg,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8,
  },
  photoImg: { width: '100%', height: '100%', resizeMode: 'cover', position: 'absolute', top: 0, left: 0 },
  photoPlaceholder: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a2e' },
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
    borderWidth: 1, borderColor: Colors.primary,
  },
  rolePillText: { color: Colors.primary, fontSize: 11, fontFamily: Typography.fontFamily.bold },
  photoBase: { color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 2 },
  leadingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  photoLeading: { color: '#FFD700', fontSize: 12, fontFamily: Typography.fontFamily.semiBold },
  bidPill: {
    alignItems: 'center', backgroundColor: Colors.primary,
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, minWidth: 68,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.5, shadowRadius: 6, elevation: 6,
  },
  bidPillLabel: { color: '#000', fontSize: 8, fontFamily: Typography.fontFamily.bold, letterSpacing: 1, opacity: 0.7 },
  bidPillVal: { color: '#000', fontSize: 22, fontFamily: Typography.fontFamily.bold, lineHeight: 24 },
  bidPillUnit: { color: '#000', fontSize: 10, opacity: 0.7 },

  // Star Banner
  starBanner: {
    borderRadius: 14, padding: 12, marginBottom: Spacing.lg,
    backgroundColor: '#1a1500', borderWidth: 1.5, borderColor: '#FFD700',
  },
  starBannerHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  starBannerTitle: { color: '#FFD700', fontSize: 12, fontFamily: Typography.fontFamily.bold },
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

  // Squad header (tappable)
  squadHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: Spacing.sm, paddingVertical: 4,
  },
  emptyCard: {
    backgroundColor: Colors.backgroundElevated, padding: Spacing.xl, borderRadius: 14,
    alignItems: 'center', gap: 8, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.lg,
  },
  emptyText: { color: Colors.textTertiary, fontSize: 13 },
  squadRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.backgroundElevated, padding: Spacing.md, borderRadius: 14,
    marginBottom: Spacing.xs, borderWidth: 1, borderColor: Colors.border,
  },
  squadRowTop: { borderColor: 'rgba(255,215,0,0.5)', backgroundColor: 'rgba(255,215,0,0.04)' },
  squadNum: { color: Colors.textTertiary, fontSize: 13, width: 22, fontFamily: Typography.fontFamily.semiBold },
  squadAvatar: { width: 38, height: 38, borderRadius: 19, borderWidth: 1.5, borderColor: Colors.border },
  squadAvatarPlaceholder: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: Colors.border,
  },
  squadName: { fontSize: 14, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary },
  squadRole: { fontSize: 11, color: Colors.textTertiary, marginTop: 1 },
  soldPricePill: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,215,0,0.12)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, borderColor: 'rgba(255,215,0,0.35)',
  },
  soldPricePillRetained: { backgroundColor: 'rgba(96,165,250,0.15)', borderColor: 'rgba(96,165,250,0.4)' },
  soldPriceText: { color: '#FFD700', fontSize: 13, fontFamily: Typography.fontFamily.bold },
});

export default AuctionLiveTeamOwnerScreen;
