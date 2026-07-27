import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  TextInput,
  Animated,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors, Spacing, Typography } from '../../../theme/theme';
import auctionService from '../../../services/auctionService';
import { getImageUrl } from '../../../api/axios';

const AuctionLiveOrganiserScreen = ({ route, navigation }) => {
  const { auctionId } = route.params || {};

  const [liveState, setLiveState] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState(null);
  const [soldPopup, setSoldPopup] = useState(false);
  const [soldData, setSoldData] = useState(null);
  const [manualBid, setManualBid] = useState('');
  const [activeTab, setActiveTab] = useState('auction');
  const [expandedTeams, setExpandedTeams] = useState({});
  
  const toggleTeam = (teamId) =>
    setExpandedTeams(prev => ({ ...prev, [teamId]: !prev[teamId] }));
  
  const [customAlert, setCustomAlert] = useState({ visible: false, title: '', message: '' });
  const [confirmAlert, setConfirmAlert] = useState({ visible: false, title: '', message: '', confirmText: '', isDestructive: false, onConfirm: null });

  const showCustomAlert = (title, message) => {
    setCustomAlert({ visible: true, title, message });
  };

  const showConfirmAlert = (title, message, confirmText, isDestructive, onConfirm) => {
    setConfirmAlert({ visible: true, title, message, confirmText, isDestructive, onConfirm });
  };

  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Blinking LIVE badge
    Animated.loop(
      Animated.sequence([
        Animated.timing(fadeAnim, { toValue: 0.3, duration: 700, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    ).start();

    if (auctionId) {
      auctionService.joinAuctionRoom(auctionId);
      loadLiveState();

      const unsubscribe = auctionService.onAuctionUpdate((updatedState) => {
        setLiveState(updatedState);
      });

      return () => {
        unsubscribe();
        auctionService.leaveAuctionRoom(auctionId);
      };
    }
  }, [auctionId]);

  const loadLiveState = async () => {
    setLoading(true);
    try {
      const res = await auctionService.getLiveState(auctionId);
      setLiveState(res.data);
    } catch (err) {
      console.log('Error loading live auction state:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkSold = () => {
    showConfirmAlert('Sold', 'Are you sure you want to mark this player as SOLD?', 'Yes, Sold', false, async () => {
        if (!selectedTeamId && !liveState?.auction?.currentHighestTeam) {
          showCustomAlert('Winning Team Required', 'Please select the winning team before marking SOLD');
          return;
        }
        const winningTeam = selectedTeamId || liveState?.auction?.currentHighestTeam?._id;
        const finalPrice = liveState?.auction?.currentHighestBid || 0;
        
        const winningTeamObj = teams.find(t => t._id === winningTeam) || currentHighestTeam;
        setSoldData({ player: currentPlayer, team: winningTeamObj, price: finalPrice });

        // Optimistic Update
        const prevLiveState = liveState;
        setLiveState({
          ...liveState,
          auction: {
            ...liveState.auction,
            currentPlayer: null // Immediately remove player from UI
          }
        });
        setSoldPopup(true);

        try {
          const res = await auctionService.markSold(auctionId, winningTeam, finalPrice);
          setLiveState(res.data);
        } catch (err) {
          setLiveState(prevLiveState);
          setSoldPopup(false);
          showCustomAlert('Error', err.response?.data?.message || 'Failed to mark sold');
        }
    });
  };


  const handleMarkUnsold = () => {
    showConfirmAlert('Unsold', 'Are you sure you want to mark this player as UNSOLD?', 'Yes, Unsold', true, async () => {
        // Optimistic Update
        const prevLiveState = liveState;
        setLiveState({
          ...liveState,
          auction: {
            ...liveState.auction,
            currentPlayer: null
          }
        });

        try {
          const res = await auctionService.markUnsold(auctionId);
          setLiveState(res.data);
          showCustomAlert('Unsold', 'Player marked UNSOLD.');
        } catch (err) {
          setLiveState(prevLiveState);
          showCustomAlert('Error', err.response?.data?.message || 'Failed to mark unsold');
        }
    });
  };


  const currentPlayer = liveState?.auction?.currentPlayer;
  const currentHighestTeam = liveState?.auction?.currentHighestTeam;
  const teams = liveState?.teams || [];
  const sets = liveState?.sets || [];
  const hasBid = !!liveState?.auction?.currentHighestTeam;

  const handleNextPlayer = () => {
    showConfirmAlert('Next', 'Are you sure you want to move to the next player?', 'Yes, Next', false, async () => {
        // Optimistic Update
        const prevLiveState = liveState;
        setLoading(true);
        setLiveState({
          ...liveState,
          auction: {
            ...liveState.auction,
            currentPlayer: null,
            currentHighestBid: 0,
            currentHighestTeam: null
          }
        });
        
        try {
          setSoldPopup(false);
          setSoldData(null);
          const res = await auctionService.nextPlayer(auctionId);
          setLiveState(res.data);
        } catch (err) {
          setLiveState(prevLiveState);
          showCustomAlert('Error', err.response?.data?.message || 'Failed to fetch next player');
        } finally {
          setLoading(false);
        }
    });
  };


  
  const handleUndoBid = () => {
    showConfirmAlert('Undo Bid', 'Are you sure you want to undo the previous bid?', 'Yes, Undo', true, async () => {
          try {
            const res = await auctionService.undoBid(auctionId);
            setLiveState(res.data);
          } catch (err) {
            showCustomAlert('Error', err.response?.data?.message || 'Failed to undo bid');
          }
    });
  };

  const handleGenerateUnsoldSet = () => {
    showConfirmAlert('Unsold Players', 'Are you sure you want to create a new set for all unsold players?', 'Yes, Generate', false, async () => {
          setLoading(true);
          try {
            const res = await auctionService.generateUnsoldSet(auctionId);
            setLiveState(res.data);
          } catch (err) {
            showCustomAlert('Error', err.response?.data?.message || 'Failed to generate unsold set');
          } finally {
            setLoading(false);
          }
    });
  };

  const handleCloseAuction = () => {
    showConfirmAlert('Close Auction', 'Are you sure you want to permanently close this auction? This action cannot be undone.', 'Yes, Close', true, async () => {
          setLoading(true);
          try {
            const res = await auctionService.closeAuction(auctionId);
            setLiveState(res.data);
          } catch (err) {
            showCustomAlert('Error', err.response?.data?.message || 'Failed to close auction');
          } finally {
            setLoading(false);
          }
    });
  };

  const [startingSetId, setStartingSetId] = useState(null);

  const handleStartSet = async (setId) => {
    try {
      setStartingSetId(setId);
      setLoading(true);
      const res = await auctionService.startSet(auctionId, setId);
      setLiveState(res.data);
    } catch (err) {
      showCustomAlert('Error', err.response?.data?.message || 'Failed to start set');
    } finally {
      setLoading(false);
      setStartingSetId(null);
    }
  };

  const handleQuickBidIncrement = async (incrementAmount, isBasePrice = false) => {
    if (!selectedTeamId) {
      showCustomAlert('Select Team', 'Please select a team first to place bid!');
      return;
    }
    if (selectedTeamId === currentHighestTeam?._id) {
      showCustomAlert('Invalid Bid', 'This team already holds the highest bid!');
      return;
    }
    const currentBid = liveState?.auction?.currentHighestBid || 0;
    const newBid = isBasePrice ? incrementAmount : currentBid + incrementAmount;
    
    // Optimistic Update
    const prevLiveState = liveState;
    setLiveState({
      ...liveState,
      auction: {
        ...liveState.auction,
        currentHighestBid: newBid,
        currentHighestTeam: teams.find(t => t._id === selectedTeamId) || { _id: selectedTeamId }
      }
    });

    try {
      const res = await auctionService.updateBid(auctionId, selectedTeamId, newBid);
      setLiveState(res.data);
    } catch (err) {
      setLiveState(prevLiveState);
      showCustomAlert('Bid Error', err.response?.data?.message || 'Failed to update bid');
    }
  };

  const handleManualBid = async () => {
    if (!selectedTeamId) {
      showCustomAlert('Select Team', 'Please select a team first to place bid!');
      return;
    }
    if (selectedTeamId === currentHighestTeam?._id) {
      showCustomAlert('Invalid Bid', 'This team already holds the highest bid!');
      return;
    }
    const bidVal = Number(manualBid);
    if (!bidVal || isNaN(bidVal) || bidVal <= 0) {
      showCustomAlert('Invalid Amount', 'Please enter a valid positive bid amount.');
      return;
    }
    const currentBid = liveState?.auction?.currentHighestBid || 0;
    const newBid = currentBid + bidVal;

    // Optimistic Update
    const prevLiveState = liveState;
    setLiveState({
      ...liveState,
      auction: {
        ...liveState.auction,
        currentHighestBid: newBid,
        currentHighestTeam: teams.find(t => t._id === selectedTeamId) || { _id: selectedTeamId }
      }
    });
    setManualBid('');

    try {
      const res = await auctionService.updateBid(auctionId, selectedTeamId, newBid);
      setLiveState(res.data);
    } catch (err) {
      setLiveState(prevLiveState);
      showCustomAlert('Bid Error', err.response?.data?.message || 'Failed to update bid');
    }
  };

  // Derive set info
  const currentSetId = liveState?.auction?.currentSet?._id || liveState?.auction?.currentSet;
  const currentSetObj = sets.find(s => s._id === currentSetId);
  const setProgress = currentSetObj
    ? `${currentSetObj.auctionedCount || 0}/${currentSetObj.totalPlayersCount || 0}`
    : null;

  // Global star player (highest bid across all teams)
  let starPlayer = null;
  let starPrice = 0;
  let starTeamName = '';
  teams.forEach(t => {
    (t.players || []).forEach(p => {
      const price = typeof p.soldPrice === 'number' ? p.soldPrice : 0;
      if (price > starPrice) { starPrice = price; starPlayer = p; starTeamName = t.name; }
    });
  });

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      
      <Modal
        visible={customAlert.visible}
        transparent
        animationType="fade"
      >
        <View style={styles.alertOverlay}>
          <View style={styles.alertBox}>
            <View style={styles.alertHeader}>
              <Icon name="alert-circle" size={24} color={Colors.primary} />
              <Text style={styles.alertTitle}>{customAlert.title}</Text>
            </View>
            <Text style={styles.alertMessage}>{customAlert.message}</Text>
            <TouchableOpacity 
              style={styles.alertBtn} 
              onPress={() => setCustomAlert({ visible: false, title: '', message: '' })}
            >
              <Text style={styles.alertBtnText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Confirmation Modal */}
      <Modal
        visible={confirmAlert.visible}
        transparent
        animationType="fade"
      >
        <View style={styles.alertOverlay}>
          <View style={styles.alertBox}>
            <View style={styles.alertHeader}>
              <Icon name="help-circle" size={24} color={confirmAlert.isDestructive ? '#dc2626' : Colors.primary} />
              <Text style={styles.alertTitle}>{confirmAlert.title}</Text>
            </View>
            <Text style={styles.alertMessage}>{confirmAlert.message}</Text>
            
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
              <TouchableOpacity 
                style={[styles.alertBtn, { flex: 1, backgroundColor: 'transparent', borderColor: Colors.border }]} 
                onPress={() => setConfirmAlert({ ...confirmAlert, visible: false })}
              >
                <Text style={[styles.alertBtnText, { color: Colors.textSecondary }]}>CANCEL</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.alertBtn, { flex: 1, backgroundColor: confirmAlert.isDestructive ? 'rgba(220, 38, 38, 0.15)' : Colors.primaryAlpha20, borderColor: confirmAlert.isDestructive ? '#dc2626' : Colors.primary }]} 
                onPress={() => {
                  setConfirmAlert({ ...confirmAlert, visible: false });
                  if (confirmAlert.onConfirm) confirmAlert.onConfirm();
                }}
              >
                <Text style={[styles.alertBtnText, { color: confirmAlert.isDestructive ? '#dc2626' : Colors.primary }]}>{confirmAlert.confirmText.toUpperCase()}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Auction Control</Text>
          {currentSetObj && (
            <Text style={styles.headerSub}>{currentSetObj.setName} · {setProgress} Players</Text>
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

      {/* ── Tabs ── */}
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tabBtn, activeTab === 'auction' && styles.tabBtnActive]} 
          onPress={() => setActiveTab('auction')}
        >
          <Text style={[styles.tabText, activeTab === 'auction' && styles.tabTextActive]}>Live Auction</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tabBtn, activeTab === 'teams' && styles.tabBtnActive]} 
          onPress={() => setActiveTab('teams')}
        >
          <Text style={[styles.tabText, activeTab === 'teams' && styles.tabTextActive]}>Teams & Squads</Text>
        </TouchableOpacity>
      </View>

      {/* ── AUCTION TAB: flex layout, no scroll, fits screen ── */}
      {activeTab === 'auction' ? (
        <View style={{ flex: 1, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 8 }}>
          
          {liveState?.auction?.status === 'completed' ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
              <Icon name="check-decagram" size={80} color={Colors.primary} />
              <Text style={{ fontFamily: Typography.fontFamily.bold, fontSize: 26, color: Colors.textPrimary, marginTop: 20 }}>Auction Completed</Text>
              <Text style={{ fontFamily: Typography.fontFamily.regular, fontSize: 16, color: Colors.textTertiary, marginTop: 10, textAlign: 'center', lineHeight: 24 }}>
                This auction has been successfully closed.
              </Text>
            </View>
          ) : (
            <>
              {/* ── SOLD POPUP ── */}
              {soldPopup && soldData ? (
            <View style={styles.soldCard}>
              <View style={styles.soldCheckCircle}>
                <Icon name="check-bold" size={36} color={Colors.background} />
              </View>
              <Text style={styles.soldTitle}>SOLD!</Text>
              <Text style={styles.soldPlayerName}>{soldData.player?.fullName}</Text>
              <Text style={styles.soldPlayerRole}>{soldData.player?.role}</Text>
              <View style={styles.soldInfoRow}>
                <View style={styles.soldInfoBox}>
                  <Text style={styles.soldInfoLabel}>Sold To</Text>
                  <Text style={styles.soldInfoVal}>{soldData.team?.name || soldData.team?.shortName}</Text>
                </View>
                <View style={[styles.soldInfoBox, { borderLeftWidth: 1, borderLeftColor: Colors.border }]}>
                  <Text style={styles.soldInfoLabel}>Final Price</Text>
                  <Text style={[styles.soldInfoVal, { color: Colors.primary }]}>{soldData.price} Pts</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.primaryBtn} onPress={handleNextPlayer}>
                {loading ? <ActivityIndicator color={Colors.background} /> : (
                  <><Icon name="skip-next" size={18} color={Colors.background} />
                    <Text style={styles.primaryBtnText}>NEXT PLAYER</Text></>
                )}
              </TouchableOpacity>
            </View>

          ) : !currentPlayer && !liveState?.auction?.currentSet ? (
            /* ── SELECT SET ── */
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.sectionTitle}>Select a Set to Begin</Text>
              <Text style={styles.sectionSubtitle}>Choose which set of players to auction first.</Text>
              {sets.filter(s => s.status !== 'completed').map((set) => {
                const isStarting = startingSetId === set._id;
                return (
                  <TouchableOpacity
                    key={set._id}
                    style={[styles.setCard, isStarting && { opacity: 0.8 }]}
                    onPress={() => handleStartSet(set._id)}
                    disabled={loading || !!startingSetId}
                  >
                    <View style={styles.setCardLeft}>
                      <Text style={styles.setCardName}>{set.setName}</Text>
                      <Text style={styles.setCardSub}>{set.auctionedCount || 0} / {set.totalPlayersCount || 0} Players</Text>
                    </View>
                    <View style={styles.setCardRight}>
                      {isStarting ? (
                        <ActivityIndicator size="small" color={Colors.primary} />
                      ) : (
                        <Icon name="play-circle-outline" size={32} color={Colors.primary} />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
              {sets.filter(s => s.status !== 'completed').length === 0 && (() => {
                const totalUnsold = liveState?.auction?.totalUnsold || 0;
                return (
                  <View style={styles.allSetsCompleteBox}>
                    <View style={styles.allSetsCompleteIcon}>
                      <Icon name="check-all" size={36} color={Colors.primary} />
                    </View>
                    <Text style={styles.allSetsCompleteTitle}>All Sets Completed!</Text>
                    <Text style={styles.allSetsCompleteSub}>
                      {totalUnsold > 0
                        ? `${totalUnsold} unsold player${totalUnsold > 1 ? 's' : ''} can be re-auctioned.`
                        : 'All players have been auctioned. You can now close the auction.'}
                    </Text>

                    {totalUnsold > 0 && (
                      <TouchableOpacity
                        style={styles.unsoldSetBtn}
                        onPress={handleGenerateUnsoldSet}
                        disabled={loading}
                      >
                        {loading ? <ActivityIndicator color={Colors.background} size="small" /> : (
                          <>
                            <Icon name="account-reactivate" size={18} color={Colors.background} style={{ marginRight: 8 }} />
                            <Text style={styles.unsoldSetBtnText}>RE-AUCTION {totalUnsold} UNSOLD PLAYER{totalUnsold > 1 ? 'S' : ''}</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      style={[styles.closeAuctionBtn, totalUnsold > 0 && { marginTop: 10 }]}
                      onPress={handleCloseAuction}
                      disabled={loading}
                    >
                      {loading ? <ActivityIndicator color="#EF4444" size="small" /> : (
                        <>
                          <Icon name="gavel" size={16} color="#EF4444" style={{ marginRight: 8 }} />
                          <Text style={styles.closeAuctionBtnText}>CLOSE AUCTION</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                );
              })()}
            </ScrollView>

          ) : !currentPlayer && liveState?.auction?.currentSet ? (
            /* ── NEXT PLAYER READY STATE ── */
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              {loading ? (
                <>
                  <ActivityIndicator size="large" color={Colors.primary} style={{ marginBottom: 16 }} />
                  <Text style={{ fontFamily: Typography.fontFamily.bold, fontSize: 20, color: Colors.textPrimary, marginBottom: 8, textAlign: 'center' }}>Loading Next Player...</Text>
                  <Text style={{ fontFamily: Typography.fontFamily.regular, fontSize: 14, color: Colors.textSecondary, marginBottom: 24, textAlign: 'center' }}>
                    Please wait while we fetch the player details.
                  </Text>
                </>
              ) : (
                <>
                  <Icon name="account-clock-outline" size={64} color={Colors.primary} style={{ marginBottom: 16 }} />
                  <Text style={{ fontFamily: Typography.fontFamily.bold, fontSize: 20, color: Colors.textPrimary, marginBottom: 8, textAlign: 'center' }}>Ready for Next Player</Text>
                  <Text style={{ fontFamily: Typography.fontFamily.regular, fontSize: 14, color: Colors.textSecondary, marginBottom: 24, textAlign: 'center' }}>
                    Tap below to bring up the next player.
                  </Text>
                  <TouchableOpacity style={[styles.primaryBtn, { width: '100%' }]} onPress={handleNextPlayer}>
                    <Icon name="skip-next" size={18} color={Colors.background} />
                    <Text style={styles.primaryBtnText}>FETCH NEXT PLAYER</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>

          ) : (
            /* ── MAIN AUCTION VIEW — premium full-screen flex layout ── */
            <View style={{ flex: 1 }}>

              {/* ── BLOCK 1: Large Player Photo ── */}
              <View style={styles.playerBidCard}>
                {currentPlayer?.photo ? (
                  <Image source={{ uri: getImageUrl(currentPlayer.photo) }} style={styles.avatarImage} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Icon name="account-circle" size={100} color={Colors.textTertiary} />
                    <Text style={{ color: Colors.textTertiary, fontSize: 13, marginTop: 8 }}>No photo available</Text>
                  </View>
                )}

                {/* Top-right: LIVE tag */}
                <View style={styles.photoLiveBadge}>
                  <View style={styles.liveDot} />
                  <Text style={styles.photoLiveText}>LIVE</Text>
                </View>

                {/* Bottom overlay */}
                <View style={styles.playerCardOverlay}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.playerName} numberOfLines={1}>{currentPlayer?.fullName}</Text>
                    <View style={styles.playerMeta}>
                      <View style={styles.rolePill}>
                        <Text style={styles.rolePillText}>{currentPlayer?.role}</Text>
                      </View>
                      <Text style={styles.basePrice}>
                        Base {currentPlayer?.basePrice || liveState?.auction?.defaultBasePrice || 0} Pts
                      </Text>
                    </View>
                    {currentHighestTeam && (
                      <View style={styles.leadingRow}>
                        <Icon name="trophy" size={12} color="#FFD700" />
                        <Text style={styles.leadingTeamLabel} numberOfLines={1}>
                          Leading: {currentHighestTeam.shortName || currentHighestTeam.name}
                        </Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.bidBubble}>
                    <Text style={styles.bidBubbleLabel}>CURRENT BID</Text>
                    <Text style={styles.bidBubbleVal}>{liveState?.auction?.currentHighestBid || 0}</Text>
                    <Text style={styles.bidBubbleUnit}>Points</Text>
                  </View>
                </View>
              </View>

              {/* ── BLOCK 2: Progress ── */}
              {currentSetObj && (
                <View style={styles.progressBlock}>
                  <View style={styles.progressRow}>
                    <View style={styles.setsStrip}>
                      {sets.map((s, idx) => {
                        const isActive = s._id === currentSetId;
                        const isDone = s.status === 'completed';
                        return (
                          <View key={s._id} style={[
                            styles.setDot,
                            isActive && styles.setDotActive,
                            isDone && styles.setDotDone,
                          ]}>
                            {isDone
                              ? <Icon name="check" size={11} color="#fff" />
                              : <Text style={[styles.setDotText, isActive && { color: Colors.primary }]}>{idx + 1}</Text>
                            }
                          </View>
                        );
                      })}
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text style={styles.progressLabel}>{currentSetObj.setName}</Text>
                        <Text style={styles.progressCount}>{setProgress} players</Text>
                      </View>
                      <View style={styles.progressBarBg}>
                        <View style={[styles.progressBarFill, {
                          width: `${((currentSetObj.auctionedCount || 0) / (currentSetObj.totalPlayersCount || 1)) * 100}%`,
                        }]} />
                      </View>
                    </View>
                  </View>
                </View>
              )}

              {/* ── BLOCK 4: Team Grid (flex:1) ── */}
              <View style={{ flex: 1, marginTop: 8 }}>
                <Text style={styles.sectionLabel}>SELECT TEAM TO BID</Text>
                <ScrollView contentContainerStyle={styles.teamGrid} showsVerticalScrollIndicator={false}>
                  {teams.map((t) => {
                    const isHighest = t._id === currentHighestTeam?._id;
                    const isSelected = selectedTeamId === t._id;
                    const purseTotal = liveState?.auction?.teamPurse || t.auctionPurse || 1;
                    const purseLeft = t.purseRemaining ?? purseTotal;
                    const pct = Math.max(0, Math.min(100, (purseLeft / purseTotal) * 100));
                    return (
                      <TouchableOpacity
                        key={t._id}
                        style={[
                          styles.teamChip,
                          isSelected && styles.teamChipSelected,
                          isHighest && styles.teamChipHighest,
                        ]}
                        onPress={() => {
                          if (isHighest) { showCustomAlert('Already Leading', `${t.name} holds the current highest bid.`); return; }
                          setSelectedTeamId(t._id);
                        }}
                        disabled={isHighest}
                      >
                        {/* Leading crown */}
                        {isHighest && (
                          <View style={styles.leadingCrown}>
                            <Icon name="crown" size={10} color="#FFD700" />
                          </View>
                        )}
                        {t.logo ? (
                          <Image source={{ uri: getImageUrl(t.logo) }} style={styles.teamLogo} />
                        ) : (
                          <View style={[
                            styles.teamLogoPlaceholder,
                            isSelected && { backgroundColor: Colors.primaryAlpha20, borderColor: Colors.primary },
                            isHighest && { backgroundColor: '#FFD70022', borderColor: '#FFD700' },
                          ]}>
                            <Icon name="shield-crown" size={20}
                              color={isHighest ? '#FFD700' : isSelected ? Colors.primary : Colors.textTertiary} />
                          </View>
                        )}
                        <Text style={[
                          styles.teamChipName,
                          isSelected && styles.teamChipNameActive,
                          isHighest && { color: '#FFD700' },
                        ]} numberOfLines={1}>
                          {t.shortName || t.name}
                        </Text>
                        {/* Purse mini-bar */}
                        <View style={styles.purseMiniBar}>
                          <View style={[styles.purseMiniBarFill, { width: `${pct}%` }]} />
                        </View>
                        <Text style={[styles.teamChipPurse, isHighest && { color: '#FFD700' }]}>
                          {purseLeft} Pts
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* ── BLOCK 3: Bid Controls ── */}
              <View style={styles.bidControlsBlock}>
                {!currentHighestTeam ? (
                  <TouchableOpacity
                    style={styles.firstBidBtn}
                    onPress={() => handleQuickBidIncrement(
                      currentPlayer?.basePrice || liveState?.auction?.defaultBasePrice || 0, true
                    )}
                  >
                    <Icon name="gavel" size={18} color="#000" style={{ marginRight: 8 }} />
                    <Text style={styles.firstBidBtnText}>
                     Open at Base Price ({currentPlayer?.basePrice || liveState?.auction?.defaultBasePrice || 0} Pts)
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <View style={{ gap: 8 }}>
                    <View style={styles.bidControlsRow}>
                      {[50, 100, 200, 500].map((inc) => (
                        <TouchableOpacity key={inc} style={styles.incBtn} onPress={() => handleQuickBidIncrement(inc, false)}>
                          <Text style={styles.incBtnText}>+{inc}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <TextInput
                        style={styles.manualInput}
                        placeholder="Custom amount"
                        placeholderTextColor={Colors.textTertiary}
                        keyboardType="numeric"
                        value={manualBid}
                        onChangeText={setManualBid}
                        returnKeyType="done"
                        onSubmitEditing={handleManualBid}
                      />
                      <TouchableOpacity style={[styles.bidBtn, { paddingHorizontal: 20 }]} onPress={handleManualBid}>
                        <Text style={styles.bidBtnText}>BID</Text>
                      </TouchableOpacity>
                      {currentHighestTeam && (
                        <TouchableOpacity style={[styles.bidBtn, { backgroundColor: '#EF4444', borderColor: '#EF4444', paddingHorizontal: 12 }]} onPress={handleUndoBid}>
                          <Icon name="undo" size={20} color="#fff" />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                )}
              </View>

              {/* ── BLOCK 5: Action Buttons ── */}
              <View style={styles.actionRow}>
                <TouchableOpacity style={[styles.actionBtn, styles.actionBtnSold, !hasBid && { opacity: 0.4 }]} onPress={handleMarkSold} disabled={!hasBid}>
                  <Icon name="gavel" size={18} color="#fff" />
                  <Text style={styles.actionBtnText}>SOLD</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, styles.actionBtnUnsold, hasBid && { opacity: 0.4 }]} onPress={handleMarkUnsold} disabled={hasBid}>
                  <Icon name="close-circle" size={18} color="#fff" />
                  <Text style={styles.actionBtnText}>UNSOLD</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, styles.actionBtnNext, hasBid && { opacity: 0.4 }]} onPress={handleNextPlayer} disabled={hasBid}>
                  <Icon name="skip-next" size={18} color="#fff" />
                  <Text style={styles.actionBtnText}>SKIP</Text>
                </TouchableOpacity>
              </View>

            </View>
          )}
          </>
        )}
        </View>

      ) : activeTab === 'teams' ? (
        <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
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

          {teams.length === 0 ? (
            <Text style={{ color: Colors.textSecondary, textAlign: 'center', marginTop: 20 }}>No teams found.</Text>
          ) : (
            teams.map((t) => {
              const squadPlayers = t.players || [];
              let teamTopPrice = 0;
              squadPlayers.forEach(p => {
                const price = typeof p.soldPrice === 'number' ? p.soldPrice : 0;
                if (price > teamTopPrice) teamTopPrice = price;
              });
              const isExpanded = !!expandedTeams[t._id];
              return (
                <View key={t._id} style={styles.teamDetailsCard}>
                  {/* Tappable team header */}
                  <TouchableOpacity
                    style={styles.teamDetailsHeader}
                    onPress={() => toggleTeam(t._id)}
                    activeOpacity={0.7}
                  >
                    {t.logo ? (
                      <Image source={{ uri: getImageUrl(t.logo) }} style={styles.teamDetailsLogo} />
                    ) : (
                      <View style={styles.teamLogoCircle}>
                        <Icon name="shield-crown-outline" size={26} color={Colors.primary} />
                      </View>
                    )}
                    <View style={{ flex: 1, marginLeft: Spacing.md }}>
                      <Text style={styles.teamDetailsName}>{t.name}</Text>
                      <Text style={styles.teamOwnerText}>Captain: {t.owner?.name || 'N/A'}</Text>
                      <Text style={styles.teamDetailsSub}>{squadPlayers.length} players bought</Text>
                    </View>
                    <Icon
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={18}
                      color={Colors.textTertiary}
                    />
                  </TouchableOpacity>

                  {/* Purse info */}
                  <View style={styles.purseRow}>
                    <View style={styles.purseBox}>
                      <Text style={styles.purseLabel}>Total</Text>
                      <Text style={styles.purseVal}>{t.auctionPurse} Pts</Text>
                    </View>
                    <View style={[styles.purseBox, { borderLeftWidth: 1, borderLeftColor: Colors.border }]}>
                      <Text style={styles.purseLabel}>Remaining</Text>
                      <Text style={[styles.purseVal, { color: Colors.primary }]}>{t.purseRemaining} Pts</Text>
                    </View>
                    <View style={[styles.purseBox, { borderLeftWidth: 1, borderLeftColor: Colors.border }]}>
                      <Text style={styles.purseLabel}>Spent</Text>
                      <Text style={[styles.purseVal, { color: '#EF4444' }]}>{(t.auctionPurse || 0) - (t.purseRemaining || 0)} Pts</Text>
                    </View>
                  </View>

                  {/* Squad list — expandable */}
                  {isExpanded && (
                    <View style={styles.squadSection}>
                      <View style={styles.squadSectionHeader}>
                        <Icon name="account-group" size={13} color={Colors.textTertiary} />
                        <Text style={styles.squadTitle}>Squad ({squadPlayers.length})</Text>
                      </View>
                      {squadPlayers.length > 0 ? (
                        squadPlayers.map((p, idx) => {
                          const price = p.soldPrice;
                          const isRetained = price === 'Retained' || (typeof price === 'number' && price === 0 && !p.soldAt);
                          const isTop = typeof price === 'number' && price === teamTopPrice && teamTopPrice > 0;
                          return (
                            <View key={`${p._id || 'squad'}-${idx}`} style={styles.squadRow}>
                              <Text style={styles.squadPlayerIdx}>{idx + 1}</Text>
                              {p.photo ? (
                                <Image source={{ uri: getImageUrl(p.photo) }} style={styles.squadPlayerAvatar} />
                              ) : (
                                <View style={styles.squadPlayerAvatarPlaceholder}>
                                  <Icon name="account" size={14} color={Colors.textTertiary} />
                                </View>
                              )}
                              <View style={{ flex: 1, marginLeft: 8 }}>
                                <Text style={styles.squadPlayerName}>{p.fullName || 'Unknown'}</Text>
                                <Text style={styles.squadPlayerRole}>{p.role || 'Player'}</Text>
                              </View>
                              <View style={[styles.squadPricePill, isRetained && styles.squadPricePillRetained]}>
                                {isRetained && <Icon name="bookmark" size={9} color="#60a5fa" style={{ marginRight: 3 }} />}
                                <Text style={[styles.squadPriceText, isRetained && { color: '#60a5fa' }]}>
                                  {isRetained ? 'Retained' : `${price} Pts`}
                                </Text>
                              </View>
                            </View>
                          );
                        })
                      ) : (
                        <Text style={styles.noPlayersText}>No players bought yet.</Text>
                      )}
                    </View>
                  )}
                </View>
              );
            })
          )}
        </ScrollView>
      ) : null}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  // Custom Alert Modal
  alertOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  alertBox: {
    backgroundColor: Colors.backgroundElevated,
    width: '100%',
    borderRadius: 16,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  alertTitle: {
    fontSize: 18,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.textPrimary,
  },
  alertMessage: {
    fontSize: 15,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.textSecondary,
    marginBottom: Spacing.xl,
    lineHeight: 22,
  },
  alertBtn: {
    backgroundColor: Colors.primaryAlpha20,
    borderWidth: 1,
    borderColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  alertBtnText: {
    color: Colors.primary,
    fontSize: 15,
    fontFamily: Typography.fontFamily.bold,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.backgroundElevated,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.textPrimary,
  },
  headerSub: {
    fontSize: 11,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.textTertiary,
    marginTop: 1,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryAlpha20,
    borderWidth: 1,
    borderColor: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primary,
    marginRight: 5,
  },
  liveBadgeText: {
    color: Colors.primary,
    fontSize: 11,
    fontFamily: Typography.fontFamily.bold,
    fontWeight: '700',
    letterSpacing: 1,
  },

  // Tabs
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.backgroundElevated,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: {
    borderBottomColor: Colors.primary,
  },
  tabText: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: 14,
    color: Colors.textTertiary,
  },
  tabTextActive: {
    color: Colors.primary,
  },

  // Teams Tab
  teamsTabContainer: {
    paddingBottom: Spacing.xxl,
  },
  // Star Player Banner styles
  starBanner: {
    borderRadius: 14, padding: 12, marginBottom: Spacing.md,
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

  teamDetailsCard: {
    backgroundColor: Colors.backgroundElevated,
    marginHorizontal: Spacing.md, marginBottom: Spacing.md,
    borderRadius: 16, borderWidth: 1, borderColor: Colors.border,
    overflow: 'hidden',
  },
  teamDetailsHeader: {
    flexDirection: 'row', alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  teamDetailsLogo: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: Colors.background,
  },
  teamLogoCircle: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: Colors.background,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: Colors.primary,
  },
  teamDetailsName: { fontFamily: Typography.fontFamily.bold, fontSize: 17, color: Colors.textPrimary },
  teamOwnerText: { fontFamily: Typography.fontFamily.regular, fontSize: 11, color: Colors.textTertiary, marginTop: 1, marginBottom: 2 },
  teamDetailsSub: { color: Colors.textTertiary, fontSize: 11, marginTop: 2 },
  purseRow: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  purseBox: { flex: 1, alignItems: 'center', paddingVertical: 6 },
  purseLabel: { fontFamily: Typography.fontFamily.semiBold, fontSize: 11, color: Colors.textTertiary, marginBottom: 3 },
  purseVal: { fontFamily: Typography.fontFamily.bold, fontSize: 14, color: Colors.textPrimary },
  squadSection: {
    borderTopWidth: 1, borderTopColor: Colors.border,
    backgroundColor: Colors.background,
    paddingBottom: 8,
  },
  squadSectionHeader: {

    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: 6,
  },
  squadTitle: { fontFamily: Typography.fontFamily.bold, fontSize: 13, color: Colors.textTertiary, letterSpacing: 0.5 },
  squadRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  squadRowTop: { backgroundColor: 'rgba(255,215,0,0.04)' },
  squadPlayerIdx: { color: Colors.textTertiary, fontSize: 11, width: 18 },
  squadPlayerAvatar: { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, borderColor: Colors.border },
  squadPlayerAvatarPlaceholder: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: Colors.border,
  },
  squadPlayerName: { fontFamily: Typography.fontFamily.semiBold, fontSize: 13, color: Colors.textPrimary },
  squadPlayerRole: { fontFamily: Typography.fontFamily.regular, fontSize: 11, color: Colors.textTertiary, marginTop: 1 },
  squadPricePill: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: 6,
    paddingHorizontal: 7, paddingVertical: 3,
    borderWidth: 1, borderColor: Colors.border,
  },
  squadPricePillRetained: { backgroundColor: 'rgba(96,165,250,0.15)', borderColor: 'rgba(96,165,250,0.4)' },
  squadPriceText: { color: Colors.textSecondary, fontSize: 11, fontFamily: Typography.fontFamily.bold },
  noPlayersText: { fontFamily: Typography.fontFamily.regular, fontSize: 13, color: Colors.textTertiary, fontStyle: 'italic', padding: Spacing.lg },

  // Content (only used by teams tab now)
  content: { padding: 12, paddingBottom: 20 },

  // Sold Card
  soldCard: {
    backgroundColor: Colors.backgroundElevated,
    borderRadius: 20,
    padding: Spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.primaryAlpha30,
    marginTop: Spacing.md,
  },
  soldCheckCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  soldTitle: {
    fontSize: 28,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.primary,
    letterSpacing: 2,
  },
  soldPlayerName: {
    fontSize: 20,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.textPrimary,
    marginTop: 4,
  },
  soldPlayerRole: {
    color: Colors.textSecondary,
    fontSize: 13,
    marginBottom: Spacing.lg,
  },
  soldInfoRow: {
    flexDirection: 'row',
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  soldInfoBox: { flex: 1, padding: Spacing.md, alignItems: 'center' },
  soldInfoLabel: { color: Colors.textTertiary, fontSize: 11, marginBottom: 4 },
  soldInfoVal: { color: Colors.textPrimary, fontSize: 16, fontFamily: Typography.fontFamily.bold },

  // Set Selector
  sectionTitle: {
    fontSize: 17,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.textPrimary,
    marginBottom: 4,
    marginTop: Spacing.md,
  },
  sectionSubtitle: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.textTertiary,
    marginBottom: Spacing.lg,
  },
  setCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundElevated,
    padding: Spacing.base,
    borderRadius: 14,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  setCardLeft: { flex: 1 },
  setCardName: { fontSize: 15, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary },
  setCardSub: { fontSize: 12, color: Colors.textTertiary, marginTop: 2 },
  setCardRight: { marginLeft: Spacing.md },
  emptyBox: { alignItems: 'center', paddingVertical: Spacing['2xl'] },
  emptyText: { color: Colors.textSecondary, marginTop: Spacing.sm, fontFamily: Typography.fontFamily.medium },

  // ── Player Card: Large Photo Banner ──
  playerBidCard: {
    borderRadius: 18,
    marginBottom: 10,
    overflow: 'hidden',
    height: 220,
    backgroundColor: '#1a1a2e',
    position: 'relative',
    // Shadow
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
    position: 'absolute',
    top: 0,
    left: 0,
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
  },
  // LIVE badge on photo
  photoLiveBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  photoLiveText: {
    color: Colors.primary,
    fontSize: 11,
    fontFamily: Typography.fontFamily.bold,
    letterSpacing: 1,
    marginLeft: 4,
  },
  // Dark gradient overlay at bottom of photo
  playerCardOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    // Simulate gradient with multiple layers
    backgroundColor: 'rgba(0,0,0,0.78)',
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  playerName: {
    fontSize: 20,
    fontFamily: Typography.fontFamily.bold,
    color: '#ffffff',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  playerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  rolePill: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  rolePillText: { color: Colors.primary, fontSize: 11, fontFamily: Typography.fontFamily.bold },
  basePrice: { color: 'rgba(255,255,255,0.65)', fontSize: 11 },
  leadingTeamLabel: {
    color: '#FFD700',
    fontSize: 12,
    fontFamily: Typography.fontFamily.semiBold,
    marginTop: 4,
    marginLeft: 4,
  },
  leadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  bidBubble: {
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 72,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 6,
  },
  bidBubbleLabel: {
    color: '#000',
    fontSize: 8,
    fontFamily: Typography.fontFamily.bold,
    letterSpacing: 1,
    opacity: 0.7,
  },
  bidBubbleVal: {
    color: '#000',
    fontSize: 24,
    fontFamily: Typography.fontFamily.bold,
    lineHeight: 26,
  },
  bidBubbleUnit: { color: '#000', fontSize: 10, opacity: 0.7 },

  // ── Progress Block ──
  progressBlock: {
    backgroundColor: Colors.backgroundElevated,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressLabel: {
    color: Colors.textPrimary,
    fontSize: 12,
    fontFamily: Typography.fontFamily.bold,
  },
  progressCount: {
    color: Colors.primary,
    fontSize: 11,
    fontFamily: Typography.fontFamily.semiBold,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: Colors.surface,
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 4,
  },
  progressBarFill: {
    height: 6,
    backgroundColor: Colors.primary,
    borderRadius: 3,
  },
  // Set dots strip
  setsStrip: {
    flexDirection: 'row',
    gap: 5,
  },
  setDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  setDotActive: {
    backgroundColor: Colors.primaryAlpha20,
    borderColor: Colors.primary,
    borderWidth: 2,
  },
  setDotDone: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  setDotText: {
    color: Colors.textTertiary,
    fontSize: 11,
    fontFamily: Typography.fontFamily.bold,
  },

  // ── Bid Controls Block ──
  bidControlsBlock: {
    marginBottom: 8,
  },
  firstBidBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 15,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 5,
  },
  firstBidBtnText: {
    color: '#000',
    fontSize: 15,
    fontFamily: Typography.fontFamily.bold,
  },
  bidControlsRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  incBtn: {
    flex: 1,
    backgroundColor: '#1e3a5f',
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a5298',
  },
  incBtnText: { color: '#5bc8ff', fontSize: 13, fontFamily: Typography.fontFamily.bold },
  manualInput: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 8,
    height: 42,
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.regular,
    fontSize: 13,
    textAlign: 'center',
  },
  bidBtn: {
    backgroundColor: '#2a5298',
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bidBtnText: { color: '#5bc8ff', fontFamily: Typography.fontFamily.bold, fontSize: 13 },

  // ── Section Label ──
  sectionLabel: {
    color: Colors.textTertiary,
    fontSize: 10,
    fontFamily: Typography.fontFamily.semiBold,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 6,
  },

  // ── Team Grid ──
  teamGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  teamChip: {
    width: '22.5%',
    backgroundColor: Colors.backgroundElevated,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 4,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
    position: 'relative',
  },
  teamChipSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryAlpha10,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
  },
  teamChipHighest: {
    borderColor: '#FFD700',
    backgroundColor: '#2a2200',
  },
  teamLogo: { width: 28, height: 28, borderRadius: 14 },
  teamLogoPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  teamChipName: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontFamily: Typography.fontFamily.semiBold,
    marginTop: 5,
    textAlign: 'center',
  },
  teamChipNameActive: { color: Colors.primary, fontFamily: Typography.fontFamily.bold },
  teamChipPurse: {
    color: Colors.textTertiary,
    fontSize: 9,
    marginTop: 1,
    textAlign: 'center',
  },
  purseMiniBar: {
    width: '80%',
    height: 3,
    backgroundColor: Colors.surface,
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 4,
  },
  purseMiniBarFill: {
    height: 3,
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },
  leadingCrown: {
    position: 'absolute',
    top: 4,
    right: 4,
  },
  leadingBadge: { position: 'absolute', top: 4, right: 4 },
  leadingBadgeText: { color: Colors.primary, fontSize: 8 },

  // ── Action Buttons (SOLD=green / UNSOLD=red / SKIP=indigo) ──
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 14,
    borderRadius: 14,
  },
  actionBtnSold: {
    backgroundColor: '#16a34a',  // green
    shadowColor: '#16a34a',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
    elevation: 5,
  },
  actionBtnUnsold: {
    backgroundColor: '#dc2626',  // red
    shadowColor: '#dc2626',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
    elevation: 5,
  },
  actionBtnNext: {
    backgroundColor: '#4f46e5',  // indigo
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
    elevation: 5,
  },
  actionBtnText: { color: '#ffffff', fontSize: 13, fontFamily: Typography.fontFamily.bold },

  allSetsCompleteBox: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    marginTop: 20,
    backgroundColor: Colors.backgroundElevated,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  allSetsCompleteIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(154, 188, 47, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  allSetsCompleteTitle: {
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.bold,
    fontSize: 18,
    marginBottom: 6,
  },
  allSetsCompleteSub: {
    color: Colors.textTertiary,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 18,
  },
  unsoldSetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    width: '100%',
  },
  unsoldSetBtnText: {
    color: Colors.background,
    fontFamily: Typography.fontFamily.bold,
    fontSize: 14,
  },
  closeAuctionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    width: '100%',
  },
  closeAuctionBtnText: {
    color: '#EF4444',
    fontFamily: Typography.fontFamily.bold,
    fontSize: 14,
  },

  // Primary button (Sold popup)
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    width: '100%',
    height: 50,
    borderRadius: 12,
    marginTop: Spacing.sm,
  },
  primaryBtnText: { color: Colors.background, fontFamily: Typography.fontFamily.bold, fontSize: 15 },
});

export default AuctionLiveOrganiserScreen;
