import React, { useMemo, useState, useEffect, useRef } from 'react';
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
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors, Spacing, Typography, useTheme } from '../../../theme/theme';
import auctionService from '../../../services/auctionService';
import api, { getImageUrl } from '../../../api/axios';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { launchImageLibrary } from 'react-native-image-picker';

const AuctionLiveOrganiserScreen = ({ route, navigation }) => {
  const { colors, shadows, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const safeTop = Math.max(insets?.top || 0, Platform.OS === 'ios' ? 44 : 0);
  const safeBottom = Math.max(insets?.bottom || 0, Platform.OS === 'ios' ? 24 : 0);
  const styles = useMemo(() => createStyles(colors, shadows, isDark), [colors, shadows, isDark]);
  const { auctionId } = route.params || {};

  const initialIncrements = route.params?.initialIncrements && route.params.initialIncrements.length > 0
    ? route.params.initialIncrements
    : [50, 100, 200, 500];
  const initialActive = route.params?.initialActiveIncrement || initialIncrements[0] || 100;

  const [bidPoints, setBidPoints] = useState(initialIncrements);
  const [activePoint, setActivePoint] = useState(initialActive);
  const [showPointsModal, setShowPointsModal] = useState(false);
  const [modalPoints, setModalPoints] = useState(initialIncrements);
  const [modalCustomPoint, setModalCustomPoint] = useState('');
  const [showQuickCustomInput, setShowQuickCustomInput] = useState(false);
  const [quickCustomPoint, setQuickCustomPoint] = useState('');
  const [showManualBidRow, setShowManualBidRow] = useState(false);
  const [showDetailedStats, setShowDetailedStats] = useState(false);

  const [liveState, setLiveState] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState(null);
  const [soldPopup, setSoldPopup] = useState(false);
  const [soldData, setSoldData] = useState(null);
  const [manualBid, setManualBid] = useState('');
  const [activeTab, setActiveTab] = useState('auction');
  const [expandedTeams, setExpandedTeams] = useState({});

  // ── Unsold Set Builder & Add Player Modal States ──
  const [showUnsoldModal, setShowUnsoldModal] = useState(false);
  const [unsoldPlayersList, setUnsoldPlayersList] = useState([]);
  const [selectedUnsoldIds, setSelectedUnsoldIds] = useState(new Set());
  const [loadingUnsoldList, setLoadingUnsoldList] = useState(false);
  const [unsoldSearchQuery, setUnsoldSearchQuery] = useState('');

  // Add New Player Modal
  const [showAddPlayerModal, setShowAddPlayerModal] = useState(false);
  const [newPlayerForm, setNewPlayerForm] = useState({
    fullName: '',
    mobileNumber: '',
    role: 'All Rounder',
    battingStyle: 'Right Handed',
    bowlingStyle: 'Right Arm Medium',
    basePrice: '',
    photo: null,
  });
  const [submittingNewPlayer, setSubmittingNewPlayer] = useState(false);
  const [lookingUpNewPlayer, setLookingUpNewPlayer] = useState(false);
  const [lookupNewPlayerMessage, setLookupNewPlayerMessage] = useState('');
  const [lookupSuccess, setLookupSuccess] = useState(false);

  const handleOpenAddPlayerModal = () => {
    setNewPlayerForm({
      fullName: '',
      mobileNumber: '',
      role: 'All Rounder',
      battingStyle: 'Right Handed',
      bowlingStyle: 'Right Arm Medium',
      basePrice: String(liveState?.auction?.defaultBasePrice || 100),
      photo: null,
    });
    setLookupNewPlayerMessage('');
    setLookupSuccess(false);
    setShowAddPlayerModal(true);
  };

  useEffect(() => {
    let isMounted = true;
    const cleanPhone = (newPlayerForm.mobileNumber || '').replace(/\D/g, '');
    if (cleanPhone.length === 10) {
      setLookingUpNewPlayer(true);
      setLookupNewPlayerMessage('');
      const doLookup = async () => {
        try {
          const res = await api.get(`/users/lookup/${cleanPhone}`);
          if (res.data?.data?.user && isMounted) {
            const u = res.data.data.user;
            const rawPhoto = u.avatar || u.photo;
            const photoUrl = rawPhoto ? getImageUrl(rawPhoto) : null;
            const userRole = u.playingRole || u.role;
            const mapBattingStyle = (style) => {
              if (style === 'Right Hand') return 'Right Handed';
              if (style === 'Left Hand') return 'Left Handed';
              return style;
            };
            const mappedBatting = mapBattingStyle(u.battingStyle);
            setNewPlayerForm((f) => ({
              ...f,
              fullName: u.name || f.fullName,
              role: userRole && ['All Rounder', 'Batsman', 'Bowler', 'Wicket Keeper'].includes(userRole) ? userRole : f.role,
              battingStyle: mappedBatting && ['Right Handed', 'Left Handed'].includes(mappedBatting) ? mappedBatting : f.battingStyle,
              bowlingStyle: u.bowlingStyle || f.bowlingStyle,
              photo: photoUrl ? { uri: photoUrl, isRemoteUrl: true } : f.photo,
              foundUser: u,
            }));
            setLookupSuccess(true);
            setLookupNewPlayerMessage('Player account found! Details pre-filled.');
          } else if (isMounted) {
            setLookupSuccess(false);
            setLookupNewPlayerMessage('No account found for this number. Enter details manually.');
          }
        } catch (e) {
          if (isMounted) {
            setLookupSuccess(false);
            setLookupNewPlayerMessage('No account found for this number. Enter details manually.');
          }
        } finally {
          if (isMounted) setLookingUpNewPlayer(false);
        }
      };

      const timer = setTimeout(doLookup, 350);
      return () => {
        isMounted = false;
        clearTimeout(timer);
      };
    } else {
      setLookupNewPlayerMessage('');
      setLookupSuccess(false);
    }
  }, [newPlayerForm.mobileNumber]);

  
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
  const soldCardAnim = useRef(new Animated.Value(0)).current;
  const soldStampScale = useRef(new Animated.Value(0)).current;
  const soldStampRotate = useRef(new Animated.Value(0)).current;
  const soldShimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Blinking LIVE badge
    Animated.loop(
      Animated.sequence([
        Animated.timing(fadeAnim, { toValue: 0.3, duration: 700, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    ).start();

    // Shimmer loop for decorative elements
    Animated.loop(
      Animated.sequence([
        Animated.timing(soldShimmerAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(soldShimmerAnim, { toValue: 0, duration: 1200, useNativeDriver: true }),
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
        // SOLD always goes to the actual current highest bidder, NOT the manually selected team.
        // selectedTeamId is only for placing bids, not for marking sold.
        const winningTeam = liveState?.auction?.currentHighestTeam?._id || selectedTeamId;
        const finalPrice = liveState?.auction?.currentHighestBid || 0;
        
        const winningTeamObj = teams.find(t => t._id === winningTeam) || currentHighestTeam;
        setSoldData({ player: currentPlayer, team: winningTeamObj, price: finalPrice });

        // Reset & animate sold card in
        soldCardAnim.setValue(0);
        soldStampScale.setValue(0);
        soldStampRotate.setValue(0);

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

        // Animate: card slides up, then stamp pops in
        Animated.parallel([
          Animated.spring(soldCardAnim, {
            toValue: 1,
            tension: 65,
            friction: 8,
            useNativeDriver: true,
          }),
        ]).start(() => {
          // After card settles, pop the stamp
          Animated.spring(soldStampScale, {
            toValue: 1,
            tension: 120,
            friction: 5,
            useNativeDriver: true,
          }).start();
          Animated.spring(soldStampRotate, {
            toValue: 1,
            tension: 80,
            friction: 8,
            useNativeDriver: true,
          }).start();
        });

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

  const handleOpenUnsoldModal = async () => {
    setShowUnsoldModal(true);
    setLoadingUnsoldList(true);
    try {
      const res = await auctionService.getRegistrations(auctionId);
      const allRegs = res.data || [];
      const eligible = allRegs.filter(
        (p) => p.approvalStatus === 'approved' && !p.soldToTeam && (p.soldStatus === 'unsold' || p.soldStatus === 'skipped' || p.soldStatus === 'available')
      );
      setUnsoldPlayersList(eligible);
      setSelectedUnsoldIds(new Set(eligible.map((p) => p._id)));
    } catch (err) {
      showCustomAlert('Error', 'Failed to fetch unsold players.');
    } finally {
      setLoadingUnsoldList(false);
    }
  };

  const handleTogglePlayerSelection = (playerId) => {
    setSelectedUnsoldIds((prev) => {
      const next = new Set(prev);
      if (next.has(playerId)) {
        next.delete(playerId);
      } else {
        next.add(playerId);
      }
      return next;
    });
  };

  const handleSelectAllUnsold = () => {
    if (selectedUnsoldIds.size === unsoldPlayersList.length) {
      setSelectedUnsoldIds(new Set());
    } else {
      setSelectedUnsoldIds(new Set(unsoldPlayersList.map((p) => p._id)));
    }
  };

  const handleCreateSelectedUnsoldSet = async () => {
    if (selectedUnsoldIds.size === 0) {
      showCustomAlert('Select Players', 'Please select at least one player for the new set.');
      return;
    }
    setLoading(true);
    try {
      const res = await auctionService.generateUnsoldSet(auctionId, Array.from(selectedUnsoldIds));
      setLiveState(res.data);
      setShowUnsoldModal(false);
      showCustomAlert('Success', `New set created with ${selectedUnsoldIds.size} player${selectedUnsoldIds.size > 1 ? 's' : ''}!`);
    } catch (err) {
      showCustomAlert('Error', err.response?.data?.message || 'Failed to generate unsold set');
    } finally {
      setLoading(false);
    }
  };

  const handlePickNewPlayerPhoto = () => {
    launchImageLibrary({ mediaType: 'photo', quality: 0.8 }, (response) => {
      if (response.didCancel) return;
      if (response.errorCode) {
        showCustomAlert('Error', response.errorMessage || 'Failed to pick image');
        return;
      }
      if (response.assets && response.assets.length > 0) {
        setNewPlayerForm((prev) => ({ ...prev, photo: response.assets[0] }));
      }
    });
  };

  const handleSaveNewPlayer = async () => {
    const cleanPhone = (newPlayerForm.mobileNumber || '').replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length < 10) {
      showCustomAlert('Validation', 'Please enter a valid 10-digit mobile number.');
      return;
    }
    if (!newPlayerForm.fullName.trim()) {
      showCustomAlert('Validation', 'Please enter player full name.');
      return;
    }

    setSubmittingNewPlayer(true);
    try {
      const formData = new FormData();
      formData.append('fullName', newPlayerForm.fullName.trim());
      formData.append('mobileNumber', cleanPhone);
      formData.append('role', newPlayerForm.role);
      formData.append('battingStyle', newPlayerForm.battingStyle);
      formData.append('bowlingStyle', newPlayerForm.bowlingStyle);

      const bPrice = newPlayerForm.basePrice ? Number(newPlayerForm.basePrice) : (liveState?.auction?.defaultBasePrice || 100);
      formData.append('basePrice', bPrice);

      if (newPlayerForm.photo) {
        if (newPlayerForm.photo.isRemoteUrl) {
          formData.append('photo', newPlayerForm.photo.uri);
        } else if (newPlayerForm.photo.uri) {
          formData.append('photo', {
            uri: newPlayerForm.photo.uri,
            type: newPlayerForm.photo.type || 'image/jpeg',
            name: newPlayerForm.photo.fileName || `player_${Date.now()}.jpg`,
          });
        }
      } else {
        formData.append('photo', `https://ui-avatars.com/api/?name=${encodeURIComponent(newPlayerForm.fullName.trim())}&background=9ABC2F&color=fff`);
      }

      const res = await auctionService.manualRegisterPlayer(auctionId, formData);
      const createdReg = res.data;

      if (createdReg) {
        setUnsoldPlayersList((prev) => [createdReg, ...prev]);
        setSelectedUnsoldIds((prev) => new Set([...prev, createdReg._id]));
      }

      showCustomAlert('Success', `${newPlayerForm.fullName.trim()} added and selected for the auction!`);
      setShowAddPlayerModal(false);
      setNewPlayerForm({
        fullName: '',
        mobileNumber: '',
        role: 'All Rounder',
        battingStyle: 'Right Handed',
        bowlingStyle: 'Right Arm Medium',
        basePrice: '',
        photo: null,
      });
      setLookupNewPlayerMessage('');
      setLookupSuccess(false);
    } catch (err) {
      showCustomAlert('Error', err.response?.data?.message || 'Failed to add player');
    } finally {
      setSubmittingNewPlayer(false);
    }
  };

  const handleGenerateUnsoldSet = () => {
    handleOpenUnsoldModal();
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

  const PRESET_POINTS = [20, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000];

  useEffect(() => {
    if (liveState?.auction?.bidIncrements && liveState.auction.bidIncrements.length > 0) {
      if (!route.params?.initialIncrements) {
        setBidPoints(liveState.auction.bidIncrements);
        if (!activePoint) setActivePoint(liveState.auction.bidIncrements[0]);
      }
    }
  }, [liveState?.auction?.bidIncrements]);

  const handleApplyQuickCustom = () => {
    const val = Number(quickCustomPoint.trim());
    if (!val || isNaN(val) || val <= 0) {
      showCustomAlert('Invalid Value', 'Please enter a valid positive point amount.');
      return;
    }
    if (!bidPoints.includes(val)) {
      const next = [...bidPoints, val].sort((a, b) => a - b);
      setBidPoints(next);
      auctionService.updateBidIncrements(auctionId, next).catch(() => {});
    }
    setActivePoint(val);
    setQuickCustomPoint('');
    setShowQuickCustomInput(false);
  };

  const handleToggleModalPoint = (val) => {
    setModalPoints(prev => {
      let next;
      if (prev.includes(val)) {
        if (prev.length <= 1) {
          showCustomAlert('At Least One', 'You must keep at least one bid point option.');
          return prev;
        }
        next = prev.filter(p => p !== val);
      } else {
        next = [...prev, val].sort((a, b) => a - b);
      }
      return next;
    });
  };

  const handleAddModalCustomPoint = () => {
    const val = Number(modalCustomPoint.trim());
    if (!val || isNaN(val) || val <= 0) {
      showCustomAlert('Invalid Value', 'Please enter a valid positive point amount.');
      return;
    }
    if (modalPoints.includes(val)) {
      showCustomAlert('Already Added', 'This point amount is already in the list.');
      return;
    }
    const next = [...modalPoints, val].sort((a, b) => a - b);
    setModalPoints(next);
    setModalCustomPoint('');
  };

  const handleRemoveModalPoint = (val) => {
    if (modalPoints.length <= 1) {
      showCustomAlert('At Least One', 'You must keep at least one bid point option.');
      return;
    }
    const next = modalPoints.filter(p => p !== val);
    setModalPoints(next);
  };

  const handleSaveModalPoints = async () => {
    if (!modalPoints || modalPoints.length === 0) {
      showCustomAlert('Select Points', 'Please select at least one point value.');
      return;
    }
    setBidPoints(modalPoints);
    if (!modalPoints.includes(activePoint)) {
      setActivePoint(modalPoints[0]);
    }
    setShowPointsModal(false);
    try {
      await auctionService.updateBidIncrements(auctionId, modalPoints);
    } catch (e) {
      console.log('Error saving bid increments:', e);
    }
  };

  const handleTeamBid = async (team, targetBidAmount, isBasePrice = false) => {
    if (!currentPlayer) {
      showCustomAlert('No Player', 'No player is currently on the auction block.');
      return;
    }
    if (team._id === currentHighestTeam?._id) {
      showCustomAlert('Already Leading', `${team.name} already holds the highest bid!`);
      return;
    }
    const purseTotal = liveState?.auction?.teamPurse || team.auctionPurse || 0;
    const purseRemaining = team.purseRemaining ?? purseTotal;
    if (targetBidAmount > purseRemaining) {
      showCustomAlert(
        'Purse Limit',
        `${team.name} has only ${purseRemaining} Pts remaining. This bid requires ${targetBidAmount} Pts.`
      );
      return;
    }

    // Optimistic Update
    const prevLiveState = liveState;
    setLiveState({
      ...liveState,
      auction: {
        ...liveState.auction,
        currentHighestBid: targetBidAmount,
        currentHighestTeam: team
      }
    });
    setSelectedTeamId(team._id);

    try {
      const res = await auctionService.updateBid(auctionId, team._id, targetBidAmount);
      setLiveState(res.data);
    } catch (err) {
      setLiveState(prevLiveState);
      showCustomAlert('Bid Error', err.response?.data?.message || 'Failed to update bid');
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
    <View style={[styles.container, { paddingBottom: Math.max(safeBottom, 8) }]}>
      
      <Modal
        visible={customAlert.visible}
        transparent
        animationType="fade"
      >
        <View style={styles.alertOverlay}>
          <View style={styles.alertBox}>
            <View style={styles.alertHeader}>
              <Icon name="alert-circle" size={24} color={colors.primary} />
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
              <Icon name="help-circle" size={24} color={confirmAlert.isDestructive ? '#dc2626' : colors.primary} />
              <Text style={styles.alertTitle}>{confirmAlert.title}</Text>
            </View>
            <Text style={styles.alertMessage}>{confirmAlert.message}</Text>
            
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
              <TouchableOpacity 
                style={[styles.alertBtn, { flex: 1, backgroundColor: 'transparent', borderColor: colors.border }]} 
                onPress={() => setConfirmAlert({ ...confirmAlert, visible: false })}
              >
                <Text style={[styles.alertBtnText, { color: colors.textSecondary }]}>CANCEL</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.alertBtn, { flex: 1, backgroundColor: confirmAlert.isDestructive ? 'rgba(220, 38, 38, 0.15)' : colors.primaryAlpha20, borderColor: confirmAlert.isDestructive ? '#dc2626' : colors.primary }]} 
                onPress={() => {
                  setConfirmAlert({ ...confirmAlert, visible: false });
                  if (confirmAlert.onConfirm) confirmAlert.onConfirm();
                }}
              >
                <Text style={[styles.alertBtnText, { color: confirmAlert.isDestructive ? '#dc2626' : colors.primary }]}>{confirmAlert.confirmText.toUpperCase()}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Points Configuration Modal ── */}
      <Modal
        visible={showPointsModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPointsModal(false)}
      >
        <View style={styles.alertOverlay}>
          <View style={styles.pointsModalBox}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Icon name="tune" size={20} color={colors.primary} style={{ marginRight: 8 }} />
                <Text style={styles.pointsModalTitle}>Auction Bid Points</Text>
              </View>
              <TouchableOpacity onPress={() => setShowPointsModal(false)} style={{ padding: 4 }}>
                <Icon name="close" size={20} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>

            <KeyboardAwareScrollView
              enableOnAndroid={true}
              extraScrollHeight={20}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Active Points list */}
              <Text style={styles.modalSectionSub}>Active Points in Auction ({modalPoints.length})</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                {modalPoints.map(pt => (
                  <View key={pt} style={styles.modalPointBadge}>
                    <Text style={styles.modalPointBadgeText}>+{pt}</Text>
                    <TouchableOpacity onPress={() => handleRemoveModalPoint(pt)} style={{ marginLeft: 4 }}>
                      <Icon name="close-circle" size={15} color={colors.textTertiary} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>

              {/* Quick Presets */}
              <Text style={styles.modalSectionSub}>Toggle Presets</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                {PRESET_POINTS.map(pt => {
                  const isSelected = modalPoints.includes(pt);
                  return (
                    <TouchableOpacity
                      key={pt}
                      style={[styles.presetPointPill, isSelected && styles.presetPointPillActive]}
                      onPress={() => handleToggleModalPoint(pt)}
                    >
                      {isSelected && <Icon name="check" size={11} color="#000" style={{ marginRight: 3 }} />}
                      <Text style={[styles.presetPointPillText, isSelected && styles.presetPointPillTextActive]}>
                        +{pt}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Add Custom Point */}
              <Text style={styles.modalSectionSub}>Add Custom Point</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
                <TextInput
                  style={styles.modalCustomInput}
                  placeholder="e.g. 750, 1500"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="numeric"
                  value={modalCustomPoint}
                  onChangeText={setModalCustomPoint}
                  onSubmitEditing={handleAddModalCustomPoint}
                />
                <TouchableOpacity style={styles.modalCustomAddBtn} onPress={handleAddModalCustomPoint}>
                  <Text style={styles.modalCustomAddBtnText}>+ ADD</Text>
                </TouchableOpacity>
              </View>

              {/* Save Button */}
              <TouchableOpacity style={styles.modalSaveBtn} onPress={handleSaveModalPoints}>
                <Text style={styles.modalSaveBtnText}>SAVE & APPLY POINTS</Text>
              </TouchableOpacity>
            </KeyboardAwareScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Unsold & Custom Re-Auction Set Modal ── */}
      <Modal
        visible={showUnsoldModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowUnsoldModal(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdropTap}
            activeOpacity={1}
            onPress={() => setShowUnsoldModal(false)}
          />
          <View style={styles.unsoldModalContainer}>
            {/* Sheet Handle */}
            <View style={styles.modalSheetHandleWrap}>
              <View style={styles.modalSheetHandle} />
            </View>

            {/* Header */}
            <View style={styles.unsoldModalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.unsoldModalTitle}>Build Re-Auction Set</Text>
                <Text style={styles.unsoldModalSub}>
                  Select players to include in this set or add new players.
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setShowUnsoldModal(false)}
              >
                <Icon name="close" size={20} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {/* Quick Actions Bar */}
            <View style={styles.unsoldActionsRow}>
              <TouchableOpacity
                style={styles.addNewPlayerTriggerBtn}
                onPress={handleOpenAddPlayerModal}
              >
                <Icon name="account-plus" size={16} color={colors.background} style={{ marginRight: 6 }} />
                <Text style={styles.addNewPlayerTriggerText}>+ Add New Player</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.selectAllBtn}
                onPress={handleSelectAllUnsold}
              >
                <Icon
                  name={selectedUnsoldIds.size === unsoldPlayersList.length && unsoldPlayersList.length > 0 ? "checkbox-marked" : "checkbox-multiple-marked-outline"}
                  size={16}
                  color={colors.primary}
                  style={{ marginRight: 5 }}
                />
                <Text style={styles.selectAllBtnText}>
                  {selectedUnsoldIds.size === unsoldPlayersList.length && unsoldPlayersList.length > 0 ? 'Deselect All' : 'Select All'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Search Input */}
            <View style={styles.unsoldSearchBox}>
              <Icon name="magnify" size={18} color={colors.textTertiary} style={{ marginRight: 8 }} />
              <TextInput
                style={styles.unsoldSearchInput}
                placeholder="Search player name, mobile, role..."
                placeholderTextColor={colors.textTertiary}
                value={unsoldSearchQuery}
                onChangeText={setUnsoldSearchQuery}
              />
              {unsoldSearchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setUnsoldSearchQuery('')}>
                  <Icon name="close-circle" size={16} color={colors.textTertiary} />
                </TouchableOpacity>
              )}
            </View>

            {/* Selection Counter Bar */}
            <View style={styles.unsoldCountRow}>
              <Text style={styles.unsoldCountText}>
                <Text style={{ color: colors.primary, fontFamily: Typography.fontFamily.bold }}>
                  {selectedUnsoldIds.size}
                </Text> of {unsoldPlayersList.length} players selected for next set
              </Text>
            </View>

            {/* Players List */}
            {loadingUnsoldList ? (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40 }}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={{ color: colors.textSecondary, marginTop: 12, fontSize: 13 }}>
                  Fetching unsold players...
                </Text>
              </View>
            ) : (
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingBottom: 16 }}
                showsVerticalScrollIndicator={true}
                keyboardShouldPersistTaps="handled"
              >
                {unsoldPlayersList
                  .filter((p) => {
                    if (!unsoldSearchQuery.trim()) return true;
                    const q = unsoldSearchQuery.toLowerCase();
                    const name = (p.user?.fullName || p.fullName || '').toLowerCase();
                    const mobile = (p.user?.mobileNumber || p.mobileNumber || '').toLowerCase();
                    const role = (p.role || '').toLowerCase();
                    return name.includes(q) || mobile.includes(q) || role.includes(q);
                  })
                  .map((player) => {
                    const isSelected = selectedUnsoldIds.has(player._id);
                    const name = player.user?.fullName || player.fullName || 'Player';
                    const photo = player.user?.profilePhoto || player.photo;
                    const role = player.role || 'Player';
                    const basePrice = player.basePrice || liveState?.auction?.defaultBasePrice || 100;
                    const status = player.soldStatus || 'unsold';

                    return (
                      <TouchableOpacity
                        key={player._id}
                        style={[styles.unsoldPlayerRow, isSelected && styles.unsoldPlayerRowSelected]}
                        activeOpacity={0.7}
                        onPress={() => handleTogglePlayerSelection(player._id)}
                      >
                        <View style={{ marginRight: 12 }}>
                          <Icon
                            name={isSelected ? "checkbox-marked" : "checkbox-blank-outline"}
                            size={22}
                            color={isSelected ? colors.primary : colors.textTertiary}
                          />
                        </View>

                        {photo ? (
                          <Image source={{ uri: photo }} style={styles.unsoldPlayerAvatar} />
                        ) : (
                          <View style={styles.unsoldPlayerAvatarPlaceholder}>
                            <Text style={styles.unsoldPlayerInitials}>
                              {name.slice(0, 2).toUpperCase()}
                            </Text>
                          </View>
                        )}

                        <View style={{ flex: 1, marginLeft: 10 }}>
                          <Text style={styles.unsoldPlayerName} numberOfLines={1}>{name}</Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
                            <Text style={styles.unsoldPlayerMeta}>{role.toUpperCase()}</Text>
                            <View style={[styles.unsoldStatusChip, status === 'skipped' ? { backgroundColor: 'rgba(234, 179, 8, 0.15)' } : null]}>
                              <Text style={[styles.unsoldStatusChipText, status === 'skipped' ? { color: '#EAB308' } : null]}>
                                {status.toUpperCase()}
                              </Text>
                            </View>
                          </View>
                        </View>

                        <View style={{ alignItems: 'flex-end', marginLeft: 8 }}>
                          <Text style={styles.unsoldPlayerBasePrice}>{basePrice} pts</Text>
                          <Text style={{ fontSize: 10, color: colors.textTertiary }}>Base Price</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}

                {unsoldPlayersList.length === 0 && (
                  <View style={styles.emptyUnsoldBox}>
                    <Icon name="account-search-outline" size={44} color={colors.textTertiary} />
                    <Text style={styles.emptyUnsoldTitle}>No Unsold Players</Text>
                    <Text style={styles.emptyUnsoldSub}>
                      All registered players have been auctioned or no unsold players exist.
                    </Text>
                    <TouchableOpacity
                      style={styles.emptyAddBtn}
                      onPress={handleOpenAddPlayerModal}
                    >
                      <Icon name="account-plus" size={16} color={colors.background} style={{ marginRight: 6 }} />
                      <Text style={styles.emptyAddBtnText}>+ Add New Player to Auction</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </ScrollView>
            )}

            {/* Bottom Create Button */}
            <View style={[styles.unsoldBottomBar, { paddingBottom: Math.max(safeBottom, 16) + 8 }]}>
              <TouchableOpacity
                style={[
                  styles.createUnsoldSetBtn,
                  (selectedUnsoldIds.size === 0 || loading) && { opacity: 0.5 }
                ]}
                disabled={selectedUnsoldIds.size === 0 || loading}
                onPress={handleCreateSelectedUnsoldSet}
              >
                {loading ? (
                  <ActivityIndicator color={colors.background} size="small" />
                ) : (
                  <>
                    <Icon name="play-circle" size={20} color={colors.background} style={{ marginRight: 8 }} />
                    <Text style={styles.createUnsoldSetBtnText}>
                      CREATE SET WITH {selectedUnsoldIds.size} PLAYER{selectedUnsoldIds.size === 1 ? '' : 'S'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Add New Player Modal ── */}
      <Modal
        visible={showAddPlayerModal}
        transparent
        animationType="fade"
        onRequestClose={() => !submittingNewPlayer && setShowAddPlayerModal(false)}
      >
        <View style={styles.centerModalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdropTap}
            activeOpacity={1}
            onPress={() => !submittingNewPlayer && setShowAddPlayerModal(false)}
          />
          <View style={styles.addPlayerModalContainer}>
            <View style={styles.unsoldModalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.unsoldModalTitle}>Add New Player</Text>
                <Text style={styles.unsoldModalSub}>
                  Register a new player directly into this tournament auction.
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                disabled={submittingNewPlayer}
                onPress={() => setShowAddPlayerModal(false)}
              >
                <Icon name="close" size={20} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <KeyboardAwareScrollView
              style={{ maxHeight: 440 }}
              enableOnAndroid={true}
              extraScrollHeight={25}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* 1. Mobile Number (FIRST) */}
              <Text style={styles.addPlayerFieldLabel}>Player Mobile Number *</Text>
              <View style={{ position: 'relative', justifyContent: 'center', marginBottom: 2 }}>
                <TextInput
                  style={[styles.addPlayerInput, { marginBottom: 0, paddingRight: 40 }]}
                  placeholder="Enter 10-digit mobile number"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="phone-pad"
                  maxLength={10}
                  value={newPlayerForm.mobileNumber}
                  onChangeText={(val) => setNewPlayerForm((p) => ({ ...p, mobileNumber: val }))}
                />
                <View style={styles.phoneLookupIndicator}>
                  {lookingUpNewPlayer ? (
                    <ActivityIndicator color={colors.primary} size="small" />
                  ) : lookupSuccess ? (
                    <Icon name="check-circle" color={colors.primary} size={22} />
                  ) : newPlayerForm.mobileNumber?.length === 10 ? (
                    <Icon name="account-search-outline" color={colors.textTertiary} size={22} />
                  ) : null}
                </View>
              </View>

              {lookupNewPlayerMessage ? (
                <View style={styles.phoneLookupMsg}>
                  <Icon
                    name={lookupSuccess ? "check-decagram" : "information-outline"}
                    size={14}
                    color={lookupSuccess ? colors.primary : colors.textTertiary}
                  />
                  <Text
                    style={[
                      styles.phoneLookupMsgText,
                      { color: lookupSuccess ? colors.primary : colors.textTertiary }
                    ]}
                  >
                    {lookupNewPlayerMessage}
                  </Text>
                </View>
              ) : (
                <View style={{ marginBottom: 10 }} />
              )}

              {/* 2. Photo & Full Name */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <TouchableOpacity
                  style={styles.newPlayerPhotoPicker}
                  onPress={handlePickNewPlayerPhoto}
                >
                  {newPlayerForm.photo?.uri ? (
                    <Image source={{ uri: newPlayerForm.photo.uri }} style={styles.newPlayerPhotoPreview} />
                  ) : (
                    <View style={styles.newPlayerPhotoPlaceholder}>
                      <Icon name="camera-plus" size={20} color={colors.primary} />
                      <Text style={{ fontSize: 9, color: colors.textSecondary, marginTop: 2 }}>Photo</Text>
                    </View>
                  )}
                </TouchableOpacity>

                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.addPlayerFieldLabel}>Full Name *</Text>
                  <TextInput
                    style={[styles.addPlayerInput, { marginBottom: 0 }]}
                    placeholder="e.g. Virat Kohli"
                    placeholderTextColor={colors.textTertiary}
                    value={newPlayerForm.fullName}
                    onChangeText={(val) => setNewPlayerForm((p) => ({ ...p, fullName: val }))}
                  />
                </View>
              </View>

              {/* 3. Playing Role */}
              <Text style={styles.addPlayerFieldLabel}>Playing Role</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                {['All Rounder', 'Batsman', 'Bowler', 'Wicket Keeper'].map((role) => (
                  <TouchableOpacity
                    key={role}
                    style={[styles.roleSelectChip, newPlayerForm.role === role && styles.roleSelectChipActive]}
                    onPress={() => setNewPlayerForm((p) => ({ ...p, role }))}
                  >
                    <Text style={[styles.roleSelectChipText, newPlayerForm.role === role && styles.roleSelectChipTextActive]}>
                      {role}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* 4. Batting Style */}
              <Text style={styles.addPlayerFieldLabel}>Batting Style</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                {['Right Handed', 'Left Handed'].map((style) => (
                  <TouchableOpacity
                    key={style}
                    style={[styles.roleSelectChip, newPlayerForm.battingStyle === style && styles.roleSelectChipActive]}
                    onPress={() => setNewPlayerForm((p) => ({ ...p, battingStyle: style }))}
                  >
                    <Text style={[styles.roleSelectChipText, newPlayerForm.battingStyle === style && styles.roleSelectChipTextActive]}>
                      {style}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* 5. Bowling Style */}
              <Text style={styles.addPlayerFieldLabel}>Bowling Style</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                {['Right Arm Medium', 'Right Arm Fast', 'Right Arm Spin', 'Left Arm Fast', 'Left Arm Spin', 'None'].map((bStyle) => (
                  <TouchableOpacity
                    key={bStyle}
                    style={[styles.roleSelectChip, newPlayerForm.bowlingStyle === bStyle && styles.roleSelectChipActive]}
                    onPress={() => setNewPlayerForm((p) => ({ ...p, bowlingStyle: bStyle }))}
                  >
                    <Text style={[styles.roleSelectChipText, newPlayerForm.bowlingStyle === bStyle && styles.roleSelectChipTextActive]}>
                      {bStyle}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* 6. Base Points */}
              <Text style={styles.addPlayerFieldLabel}>Base Points (pts)</Text>
              <TextInput
                style={styles.addPlayerInput}
                placeholder={String(liveState?.auction?.defaultBasePrice || 100)}
                placeholderTextColor={colors.textTertiary}
                keyboardType="numeric"
                value={newPlayerForm.basePrice}
                onChangeText={(val) => setNewPlayerForm((p) => ({ ...p, basePrice: val }))}
              />
            </KeyboardAwareScrollView>

            {/* Save & Select Button */}
            <View style={{ paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.border }}>
              <TouchableOpacity
                style={[styles.saveNewPlayerBtn, submittingNewPlayer && { opacity: 0.6 }]}
                disabled={submittingNewPlayer}
                onPress={handleSaveNewPlayer}
              >
                {submittingNewPlayer ? (
                  <ActivityIndicator color={colors.background} size="small" />
                ) : (
                  <>
                    <Icon name="check-bold" size={18} color={colors.background} style={{ marginRight: 6 }} />
                    <Text style={styles.saveNewPlayerBtnText}>SAVE & SELECT FOR AUCTION</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Header ── */}

      <View style={[styles.header, { paddingTop: safeTop + 6 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Auction Control</Text>
          {currentSetObj && (
            <Text style={styles.headerSub}>{currentSetObj.setName} · {setProgress} Players</Text>
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
              <Icon name="check-decagram" size={80} color={colors.primary} />
              <Text style={{ fontFamily: Typography.fontFamily.bold, fontSize: 26, color: colors.textPrimary, marginTop: 20 }}>Auction Completed</Text>
              <Text style={{ fontFamily: Typography.fontFamily.regular, fontSize: 16, color: colors.textTertiary, marginTop: 10, textAlign: 'center', lineHeight: 24 }}>
                This auction has been successfully closed.
              </Text>
            </View>
          ) : (
            <>
              {/* ── SOLD POPUP ── */}
              {soldPopup && soldData ? (
                <Animated.View
                  style={[
                    styles.soldCard,
                    {
                      opacity: soldCardAnim,
                      transform: [{
                        translateY: soldCardAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [40, 0],
                        })
                      }]
                    }
                  ]}
                >
                  {/* Glowing top accent line */}
                  <View style={styles.soldTopAccent} />

                  {/* Decorative shimmer orbs */}
                  <Animated.View style={[styles.soldOrb1, { opacity: soldShimmerAnim }]} />
                  <Animated.View style={[styles.soldOrb2, { opacity: soldShimmerAnim.interpolate({ inputRange: [0,1], outputRange: [1,0] }) }]} />

                  {/* Player Photo with Stamp Overlay */}
                  <View style={styles.soldPhotoWrap}>
                    {soldData.player?.photo ? (
                      <Image source={{ uri: getImageUrl(soldData.player.photo) }} style={styles.soldPlayerPhoto} />
                    ) : (
                      <View style={[styles.soldPlayerPhoto, { backgroundColor: '#111', justifyContent: 'center', alignItems: 'center' }]}>
                        <Icon name="account" size={50} color="#444" />
                      </View>
                    )}
                    {/* SOLD Stamp */}
                    <Animated.View
                      style={[
                        styles.stampWrap,
                        {
                          transform: [
                            {
                              scale: soldStampScale
                            },
                            {
                              rotate: soldStampRotate.interpolate({
                                inputRange: [0, 1],
                                outputRange: ['0deg', '-22deg'],
                              })
                            }
                          ]
                        }
                      ]}
                      pointerEvents="none"
                    >
                      <View style={styles.stampInner}>
                        <Text style={styles.stampText}>SOLD</Text>
                      </View>
                    </Animated.View>
                  </View>

                  {/* Player Name */}
                  <Text style={styles.soldPlayerName} numberOfLines={1}>{soldData.player?.fullName}</Text>

                  {/* Role pill */}
                  <View style={styles.soldRolePill}>
                    <Icon name="cricket" size={11} color={colors.primary} />
                    <Text style={styles.soldRoleText}>{soldData.player?.role}</Text>
                    {soldData.player?.battingStyle ? (
                      <Text style={styles.soldStyleText}> · {soldData.player.battingStyle}</Text>
                    ) : null}
                  </View>

                  {/* Divider */}
                  <View style={styles.soldDivider} />

                  {/* Team + Price Row */}
                  <View style={styles.soldTeamPriceRow}>
                    <View style={styles.soldTeamBox}>
                      {soldData.team?.logo ? (
                        <Image source={{ uri: getImageUrl(soldData.team.logo) }} style={styles.soldTeamLogo} />
                      ) : (
                        <View style={[styles.soldTeamLogo, { backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center' }]}>
                          <Icon name="shield-crown" size={18} color={colors.primary} />
                        </View>
                      )}
                      <View style={{ marginLeft: 10 }}>
                        <Text style={styles.soldTeamLabel}>SOLD TO</Text>
                        <Text style={styles.soldTeamName} numberOfLines={1}>{soldData.team?.name || soldData.team?.shortName}</Text>
                      </View>
                    </View>
                    <View style={styles.soldPriceBox}>
                      <Text style={styles.soldPriceLabel}>FINAL PRICE</Text>
                      <Text style={styles.soldPriceValue}>{soldData.price}</Text>
                      <Text style={styles.soldPriceUnit}>Pts</Text>
                    </View>
                  </View>

                  <TouchableOpacity style={styles.primaryBtn} onPress={handleNextPlayer}>
                    {loading ? <ActivityIndicator color={colors.background} /> : (
                      <><Icon name="skip-next" size={18} color={colors.background} />
                        <Text style={styles.primaryBtnText}>NEXT PLAYER</Text></>
                    )}
                  </TouchableOpacity>
                </Animated.View>
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
                        <ActivityIndicator size="small" color={colors.primary} />
                      ) : (
                        <Icon name="play-circle-outline" size={32} color={colors.primary} />
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
                      <Icon name="check-all" size={36} color={colors.primary} />
                    </View>
                    <Text style={styles.allSetsCompleteTitle}>All Sets Completed!</Text>
                    <Text style={styles.allSetsCompleteSub}>
                      {totalUnsold > 0
                        ? `${totalUnsold} unsold player${totalUnsold > 1 ? 's' : ''} can be re-auctioned.`
                        : 'All players have been auctioned. You can now close the auction.'}
                    </Text>

                    <TouchableOpacity
                      style={styles.unsoldSetBtn}
                      onPress={handleOpenUnsoldModal}
                      disabled={loading}
                    >
                      {loading ? <ActivityIndicator color={colors.background} size="small" /> : (
                        <>
                          <Icon name="account-reactivate" size={18} color={colors.background} style={{ marginRight: 8 }} />
                          <Text style={styles.unsoldSetBtnText}>
                            {totalUnsold > 0
                              ? `SELECT UNSOLD / ADD PLAYERS (${totalUnsold})`
                              : '+ ADD PLAYERS & CREATE NEW SET'}
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.closeAuctionBtn, { marginTop: 10 }]}
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
                  <ActivityIndicator size="large" color={colors.primary} style={{ marginBottom: 16 }} />
                  <Text style={{ fontFamily: Typography.fontFamily.bold, fontSize: 20, color: colors.textPrimary, marginBottom: 8, textAlign: 'center' }}>Loading Next Player...</Text>
                  <Text style={{ fontFamily: Typography.fontFamily.regular, fontSize: 14, color: colors.textSecondary, marginBottom: 24, textAlign: 'center' }}>
                    Please wait while we fetch the player details.
                  </Text>
                </>
              ) : (
                <>
                  <Icon name="account-clock-outline" size={64} color={colors.primary} style={{ marginBottom: 16 }} />
                  <Text style={{ fontFamily: Typography.fontFamily.bold, fontSize: 20, color: colors.textPrimary, marginBottom: 8, textAlign: 'center' }}>Ready for Next Player</Text>
                  <Text style={{ fontFamily: Typography.fontFamily.regular, fontSize: 14, color: colors.textSecondary, marginBottom: 24, textAlign: 'center' }}>
                    Tap below to bring up the next player.
                  </Text>
                  <TouchableOpacity style={[styles.primaryBtn, { width: '100%' }]} onPress={handleNextPlayer}>
                    <Icon name="skip-next" size={18} color={colors.background} />
                    <Text style={styles.primaryBtnText}>FETCH NEXT PLAYER</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>

          ) : (
            /* ── MAIN AUCTION VIEW — premium full-screen flex layout ── */
            <View style={{ flex: 1 }}>

              {/* ── BLOCK 1: Compact Player Card ── */}
              <View style={styles.compactPlayerCard}>
                {/* Photo Thumbnail */}
                <View style={styles.compactPhotoWrap}>
                  {currentPlayer?.photo ? (
                    <Image source={{ uri: getImageUrl(currentPlayer.photo) }} style={styles.compactAvatarImage} />
                  ) : (
                    <View style={styles.compactAvatarPlaceholder}>
                      <Icon name="account" size={30} color={colors.textTertiary} />
                    </View>
                  )}
                  <View style={styles.compactLiveBadge}>
                    <View style={styles.compactLiveDot} />
                    <Text style={styles.compactLiveText}>LIVE</Text>
                  </View>
                </View>

                {/* Player Info (Name, Role, Base, Leading) */}
                <View style={styles.compactPlayerInfo}>
                  <Text style={styles.compactPlayerName} numberOfLines={1}>
                    {currentPlayer?.fullName}
                  </Text>
                  <View style={styles.compactMetaRow}>
                    <View style={styles.compactRolePill}>
                      <Text style={styles.compactRolePillText} numberOfLines={1}>
                        {currentPlayer?.role || 'Player'}
                      </Text>
                    </View>
                    <Text style={styles.compactBasePrice}>
                      Base: {currentPlayer?.basePrice || liveState?.auction?.defaultBasePrice || 0} Pts
                    </Text>
                  </View>
                  {currentHighestTeam ? (
                    <View style={styles.compactLeadingRow}>
                      <Icon name="crown" size={12} color="#FFD700" />
                      <Text style={styles.compactLeadingText} numberOfLines={1}>
                        {currentHighestTeam.shortName || currentHighestTeam.name} ({liveState?.auction?.currentHighestBid || 0} Pts)
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.compactNoBidsText}>No bids yet · Tap team to open</Text>
                  )}
                </View>

                {/* Current Bid Display */}
                <View style={styles.compactBidBox}>
                  <Text style={styles.compactBidLabel}>CURRENT BID</Text>
                  <Text style={styles.compactBidVal} numberOfLines={1}>
                    {liveState?.auction?.currentHighestBid || 0}
                  </Text>
                  <Text style={styles.compactBidUnit}>Points</Text>
                </View>
              </View>

              {/* ── COMPACT STATS & SET STRIP (Tap to expand full stats) ── */}
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
                  {currentSetObj && (
                    <View style={styles.compactSetPill}>
                      <Text style={styles.compactSetPillText} numberOfLines={1}>
                        {currentSetObj.setName} ({setProgress})
                      </Text>
                    </View>
                  )}
                  <Icon
                    name={showDetailedStats ? 'chevron-up' : 'chevron-down'}
                    size={15}
                    color={colors.textTertiary}
                    style={{ marginLeft: 4 }}
                  />
                </View>
              </TouchableOpacity>

              {/* Expanded Detailed Stats & Set Progress (Only visible if expanded) */}
              {showDetailedStats && (
                <View style={{ marginBottom: 6 }}>
                  {/* Detailed Stats Card */}
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

                  {/* Set Progress Block */}
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
                                  : <Text style={[styles.setDotText, isActive && { color: colors.primary }]}>{idx + 1}</Text>
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
                </View>
              )}

              {/* ── POINT INCREMENT STRIP (Select point once, tap teams to bid instantly) ── */}
              <View style={styles.pointsConfigBlock}>
                <View style={styles.pointsConfigHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Icon name="lightning-bolt" size={15} color={colors.primary} style={{ marginRight: 4 }} />
                    <Text style={styles.sectionLabelSmall}>BID STEP:</Text>
                    <View style={styles.activePointBadge}>
                      <Text style={styles.activePointBadgeText}>+{activePoint} Pts</Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                    {hasBid && (
                      <TouchableOpacity
                        style={styles.undoBidHeaderBtn}
                        onPress={handleUndoBid}
                      >
                        <Icon name="undo" size={13} color="#EF4444" style={{ marginRight: 2 }} />
                        <Text style={styles.undoBidHeaderText}>Undo</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={styles.configurePointsBtn}
                      onPress={() => {
                        setModalPoints(bidPoints);
                        setModalCustomPoint('');
                        setShowPointsModal(true);
                      }}
                    >
                      <Icon name="tune" size={13} color={colors.primary} style={{ marginRight: 2 }} />
                      <Text style={styles.configurePointsBtnText}>Points</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Point increment chips strip */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pointsScrollContent}>
                  {bidPoints.map((pt) => {
                    const isSelected = activePoint === pt;
                    return (
                      <TouchableOpacity
                        key={pt}
                        style={[styles.pointPill, isSelected && styles.pointPillActive]}
                        onPress={() => setActivePoint(pt)}
                      >
                        {isSelected && <Icon name="check" size={11} color="#000" style={{ marginRight: 3 }} />}
                        <Text style={[styles.pointPillText, isSelected && styles.pointPillTextActive]}>
                          +{pt}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}

                  {showQuickCustomInput ? (
                    <View style={styles.inlineCustomBox}>
                      <TextInput
                        style={styles.inlineCustomInput}
                        placeholder="Pts"
                        placeholderTextColor={colors.textTertiary}
                        keyboardType="numeric"
                        value={quickCustomPoint}
                        onChangeText={setQuickCustomPoint}
                        autoFocus
                        onSubmitEditing={handleApplyQuickCustom}
                      />
                      <TouchableOpacity style={styles.inlineCustomAddBtn} onPress={handleApplyQuickCustom}>
                        <Icon name="check" size={14} color="#000" />
                      </TouchableOpacity>
                      <TouchableOpacity style={{ padding: 4 }} onPress={() => setShowQuickCustomInput(false)}>
                        <Icon name="close" size={12} color={colors.textTertiary} />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.pointPillCustom}
                      onPress={() => setShowQuickCustomInput(true)}
                    >
                      <Icon name="plus" size={13} color={colors.primary} />
                      <Text style={styles.pointPillCustomText}>Custom</Text>
                    </TouchableOpacity>
                  )}
                </ScrollView>
              </View>

              {/* ── RAPID 1-TAP TEAM BIDDING ── */}
              <View style={{ flex: 1, minHeight: 0, marginTop: 2 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                  <Text style={styles.sectionLabel}>
                    {!hasBid ? 'TAP TEAM TO OPEN AT BASE PRICE' : `TAP TEAM TO BID +${activePoint} PTS`}
                  </Text>
                  <Text style={styles.nextBidHint}>
                    Next: {!hasBid ? `${currentPlayer?.basePrice || liveState?.auction?.defaultBasePrice || 0} Pts` : `${(liveState?.auction?.currentHighestBid || 0) + Number(activePoint)} Pts`}
                  </Text>
                </View>

                <ScrollView contentContainerStyle={styles.teamGrid} showsVerticalScrollIndicator={false}>
                  {teams.map((t) => {
                    const isHighest = t._id === currentHighestTeam?._id;
                    const purseTotal = liveState?.auction?.teamPurse || t.auctionPurse || 1;
                    const purseLeft = t.purseRemaining ?? purseTotal;
                    const nextBidAmount = !hasBid
                      ? (currentPlayer?.basePrice || liveState?.auction?.defaultBasePrice || 0)
                      : (liveState?.auction?.currentHighestBid || 0) + Number(activePoint);
                    const canAfford = purseLeft >= nextBidAmount;

                    return (
                      <TouchableOpacity
                        key={t._id}
                        style={[
                          styles.teamCard,
                          isHighest && styles.teamCardHighest,
                          !isHighest && !canAfford && { opacity: 0.45 },
                        ]}
                        onPress={() => {
                          if (isHighest) {
                            showCustomAlert('Already Leading', `${t.name} holds the current highest bid.`);
                            return;
                          }
                          if (!canAfford) {
                            showCustomAlert('Insufficient Purse', `${t.name} has only ${purseLeft} Pts remaining. Required: ${nextBidAmount} Pts.`);
                            return;
                          }
                          handleTeamBid(t, nextBidAmount, !hasBid);
                        }}
                        disabled={isHighest}
                        activeOpacity={0.7}
                      >
                        {/* Header: Logo, Name, Purse (Centered for 4-in-a-row) */}
                        <View style={styles.teamCardHeader}>
                          {t.logo ? (
                            <Image source={{ uri: getImageUrl(t.logo) }} style={styles.teamLogoSmall} />
                          ) : (
                            <View style={[styles.teamLogoSmallPlaceholder, isHighest && { backgroundColor: '#FFD70022', borderColor: '#FFD700' }]}>
                              <Icon name="shield-crown" size={12} color={isHighest ? '#FFD700' : colors.textTertiary} />
                            </View>
                          )}
                          {isHighest && (
                            <View style={styles.leadingBadgeIcon}>
                              <Icon name="crown" size={10} color="#FFD700" />
                            </View>
                          )}
                          <Text style={[styles.teamCardName, isHighest && { color: '#FFD700' }]} numberOfLines={1}>
                            {t.shortName || t.name}
                          </Text>
                          <Text style={[styles.teamCardPurse, isHighest && { color: '#FFD700' }]} numberOfLines={1}>
                            {purseLeft >= 1000 ? `${Math.round(purseLeft / 1000)}k` : purseLeft} Pts
                          </Text>
                        </View>

                        {/* Action Badge */}
                        <View style={[
                          styles.teamActionBadge,
                          isHighest && styles.teamActionBadgeHighest,
                          !isHighest && !canAfford && styles.teamActionBadgeDisabled,
                        ]}>
                          {isHighest ? (
                            <Text style={styles.teamActionBadgeTextHighest} numberOfLines={1}>
                              👑 LEADING
                            </Text>
                          ) : !hasBid ? (
                            <Text style={styles.teamActionBadgeText} numberOfLines={1}>
                              OPEN {nextBidAmount}
                            </Text>
                          ) : (
                            <Text style={styles.teamActionBadgeText} numberOfLines={1}>
                              +{activePoint} ({nextBidAmount})
                            </Text>
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Collapsible Manual Jump Bid Bar */}
              <View style={styles.manualBidMiniBar}>
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 }}
                  onPress={() => setShowManualBidRow(!showManualBidRow)}
                >
                  <Text style={{ fontSize: 11, fontFamily: Typography.fontFamily.medium, color: colors.textTertiary }}>
                    {showManualBidRow ? '▼ Hide Manual Jump Bid' : '▶ Direct Jump / Custom Bid Amount'}
                  </Text>
                  {selectedTeamId && (
                    <Text style={{ fontSize: 11, color: colors.primary }}>
                      Selected: {teams.find(t => t._id === selectedTeamId)?.shortName || 'None'}
                    </Text>
                  )}
                </TouchableOpacity>

                {showManualBidRow && (
                  <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                    <TextInput
                      style={styles.manualInput}
                      placeholder="Jump amount (e.g. 5000)"
                      placeholderTextColor={colors.textTertiary}
                      keyboardType="numeric"
                      value={manualBid}
                      onChangeText={setManualBid}
                      returnKeyType="done"
                      onSubmitEditing={handleManualBid}
                    />
                    <TouchableOpacity style={[styles.bidBtn, { paddingHorizontal: 16 }]} onPress={handleManualBid}>
                      <Text style={styles.bidBtnText}>PLACE JUMP BID</Text>
                    </TouchableOpacity>
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

          {teams.length === 0 ? (
            <Text style={{ color: colors.textSecondary, textAlign: 'center', marginTop: 20 }}>No teams found.</Text>
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
                        <Icon name="shield-crown-outline" size={26} color={colors.primary} />
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
                      color={colors.textTertiary}
                    />
                  </TouchableOpacity>

                  {/* Purse info */}
                  <View style={styles.purseRow}>
                    <View style={styles.purseBox}>
                      <Text style={styles.purseLabel}>Total</Text>
                      <Text style={styles.purseVal}>{t.auctionPurse} Pts</Text>
                    </View>
                    <View style={[styles.purseBox, { borderLeftWidth: 1, borderLeftColor: colors.border }]}>
                      <Text style={styles.purseLabel}>Remaining</Text>
                      <Text style={[styles.purseVal, { color: colors.primary }]}>{t.purseRemaining} Pts</Text>
                    </View>
                    <View style={[styles.purseBox, { borderLeftWidth: 1, borderLeftColor: colors.border }]}>
                      <Text style={styles.purseLabel}>Spent</Text>
                      <Text style={[styles.purseVal, { color: '#EF4444' }]}>{(t.auctionPurse || 0) - (t.purseRemaining || 0)} Pts</Text>
                    </View>
                  </View>

                  {/* Squad list — expandable */}
                  {isExpanded && (
                    <View style={styles.squadSection}>
                      <View style={styles.squadSectionHeader}>
                        <Icon name="account-group" size={13} color={colors.textTertiary} />
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
                                  <Icon name="account" size={14} color={colors.textTertiary} />
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
    </View>
  );
};

const createStyles = (colors, shadows, isDark) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  // Custom Alert Modal
  alertOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  alertBox: {
    backgroundColor: colors.surface,
    width: '100%',
    borderRadius: 16,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
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
    color: colors.textPrimary,
  },
  alertMessage: {
    fontSize: 15,
    fontFamily: Typography.fontFamily.regular,
    color: colors.textSecondary,
    marginBottom: Spacing.xl,
    lineHeight: 22,
  },
  alertBtn: {
    backgroundColor: colors.primaryAlpha20,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  alertBtnText: {
    color: colors.primary,
    fontSize: 15,
    fontFamily: Typography.fontFamily.bold,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: Typography.fontFamily.bold,
    color: colors.textPrimary,
  },
  headerSub: {
    fontSize: 11,
    fontFamily: Typography.fontFamily.regular,
    color: colors.textTertiary,
    marginTop: 1,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryAlpha20,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginRight: 5,
  },
  liveBadgeText: {
    color: colors.primary,
    fontSize: 11,
    fontFamily: Typography.fontFamily.bold,
    fontWeight: '700',
    letterSpacing: 1,
  },

  // Tabs
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: {
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: 14,
    color: colors.textTertiary,
  },
  tabTextActive: {
    color: colors.primary,
  },

  // Teams Tab
  teamsTabContainer: {
    paddingBottom: Spacing.xxl,
  },
  // Star Player Banner styles
  starBanner: {
    borderRadius: 14, padding: 12, marginBottom: Spacing.md,
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

  teamDetailsCard: {
    backgroundColor: colors.surface,
    marginHorizontal: Spacing.md, marginBottom: Spacing.md,
    borderRadius: 16, borderWidth: 1, borderColor: colors.border,
    overflow: 'hidden',
  },
  teamDetailsHeader: {
    flexDirection: 'row', alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  teamDetailsLogo: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: colors.background,
  },
  teamLogoCircle: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: colors.background,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: colors.primary,
  },
  teamDetailsName: { fontFamily: Typography.fontFamily.bold, fontSize: 17, color: colors.textPrimary },
  teamOwnerText: { fontFamily: Typography.fontFamily.regular, fontSize: 11, color: colors.textTertiary, marginTop: 1, marginBottom: 2 },
  teamDetailsSub: { color: colors.textTertiary, fontSize: 11, marginTop: 2 },
  purseRow: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  purseBox: { flex: 1, alignItems: 'center', paddingVertical: 6 },
  purseLabel: { fontFamily: Typography.fontFamily.semiBold, fontSize: 11, color: colors.textTertiary, marginBottom: 3 },
  purseVal: { fontFamily: Typography.fontFamily.bold, fontSize: 14, color: colors.textPrimary },
  squadSection: {
    borderTopWidth: 1, borderTopColor: colors.border,
    backgroundColor: colors.background,
    paddingBottom: 8,
  },
  squadSectionHeader: {

    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: 6,
  },
  squadTitle: { fontFamily: Typography.fontFamily.bold, fontSize: 13, color: colors.textTertiary, letterSpacing: 0.5 },
  squadRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  squadRowTop: { backgroundColor: 'rgba(255,215,0,0.04)' },
  squadPlayerIdx: { color: colors.textTertiary, fontSize: 11, width: 18 },
  squadPlayerAvatar: { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, borderColor: colors.border },
  squadPlayerAvatarPlaceholder: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: colors.border,
  },
  squadPlayerName: { fontFamily: Typography.fontFamily.semiBold, fontSize: 13, color: colors.textPrimary },
  squadPlayerRole: { fontFamily: Typography.fontFamily.regular, fontSize: 11, color: colors.textTertiary, marginTop: 1 },
  squadPricePill: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface, borderRadius: 6,
    paddingHorizontal: 7, paddingVertical: 3,
    borderWidth: 1, borderColor: colors.border,
  },
  squadPricePillRetained: { backgroundColor: 'rgba(96,165,250,0.15)', borderColor: 'rgba(96,165,250,0.4)' },
  squadPriceText: { color: colors.textSecondary, fontSize: 11, fontFamily: Typography.fontFamily.bold },
  noPlayersText: { fontFamily: Typography.fontFamily.regular, fontSize: 13, color: colors.textTertiary, fontStyle: 'italic', padding: Spacing.lg },

  // Content (only used by teams tab now)
  content: { padding: 12, paddingBottom: 20 },

  // Sold Card
  soldCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: Spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primaryAlpha30,
    marginTop: Spacing.md,
  },
  // Sold Card — Stamp UI
  soldCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.primary,
    marginTop: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
    overflow: 'hidden',
  },
  soldTopAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: colors.primary,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  soldOrb1: {
    position: 'absolute',
    top: -30,
    right: -30,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 204, 0, 0.06)',
  },
  soldOrb2: {
    position: 'absolute',
    bottom: 60,
    left: -40,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 204, 0, 0.05)',
  },
  soldPhotoWrap: {
    width: 110,
    height: 110,
    borderRadius: 55,
    overflow: 'hidden',
    marginBottom: 12,
    backgroundColor: '#0a0f1d',
    borderWidth: 2.5,
    borderColor: colors.primary,
    position: 'relative',
  },
  soldPlayerPhoto: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
    backgroundColor: '#0a0f1d',
  },
  stampWrap: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stampInner: {
    borderWidth: 2.5,
    borderColor: colors.primary,
    borderRadius: 5,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  stampText: {
    color: colors.primary,
    fontSize: 18,
    fontFamily: Typography.fontFamily.bold,
    letterSpacing: 5,
    textShadowColor: 'rgba(255,204,0,0.6)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  soldPlayerName: {
    fontSize: 20,
    fontFamily: Typography.fontFamily.bold,
    color: colors.textPrimary,
    marginBottom: 4,
    textAlign: 'center',
  },
  soldRolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.surface,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  soldRoleText: { color: colors.primary, fontSize: 12, fontFamily: Typography.fontFamily.bold },
  soldStyleText: { color: colors.textTertiary, fontSize: 11 },
  soldDivider: {
    width: '100%',
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 12,
  },
  soldTeamPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 4,
    marginBottom: 16,
  },
  soldTeamBox: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  soldTeamLogo: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  soldTeamLabel: {
    color: colors.textTertiary,
    fontSize: 9,
    fontFamily: Typography.fontFamily.bold,
    letterSpacing: 1,
    marginBottom: 2,
  },
  soldTeamName: {
    color: colors.textPrimary,
    fontSize: 15,
    fontFamily: Typography.fontFamily.bold,
    maxWidth: 120,
  },
  soldPriceBox: {
    alignItems: 'flex-end',
    backgroundColor: 'rgba(255, 204, 0, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  soldPriceLabel: {
    color: colors.textTertiary,
    fontSize: 8,
    fontFamily: Typography.fontFamily.bold,
    letterSpacing: 1,
  },
  soldPriceValue: {
    color: colors.primary,
    fontSize: 26,
    fontFamily: Typography.fontFamily.bold,
    lineHeight: 28,
  },
  soldPriceUnit: {
    color: colors.textTertiary,
    fontSize: 10,
    fontFamily: Typography.fontFamily.bold,
  },

  // Set Selector
  sectionTitle: {
    fontSize: 17,
    fontFamily: Typography.fontFamily.bold,
    color: colors.textPrimary,
    marginBottom: 4,
    marginTop: Spacing.md,
  },
  sectionSubtitle: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.regular,
    color: colors.textTertiary,
    marginBottom: Spacing.lg,
  },
  setCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: Spacing.base,
    borderRadius: 14,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  setCardLeft: { flex: 1 },
  setCardName: { fontSize: 15, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary },
  setCardSub: { fontSize: 12, color: colors.textTertiary, marginTop: 2 },
  setCardRight: { marginLeft: Spacing.md },
  emptyBox: { alignItems: 'center', paddingVertical: Spacing['2xl'] },
  emptyText: { color: colors.textSecondary, marginTop: Spacing.sm, fontFamily: Typography.fontFamily.medium },

  // ── Compact Player Card & Stats Bar ──
  compactPlayerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 6,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  compactPhotoWrap: {
    width: 95,
    height: 95,
    borderRadius: 10,
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

  // ── Compact Stats Bar ──
  compactStatsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: colors.borderLight,
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
  compactSetPill: {
    backgroundColor: colors.backgroundElevated,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 0.5,
    borderColor: colors.border,
  },
  compactSetPillText: {
    fontSize: 9.5,
    fontFamily: Typography.fontFamily.semiBold,
    color: colors.textSecondary,
  },

  // ── Player Card: Large Photo Banner (Fallback/Detailed) ──
  playerBidCard: {
    borderRadius: 18,
    marginBottom: 10,
    overflow: 'hidden',
    height: 220,
    backgroundColor: '#0a0f1d',
    position: 'relative',
    // Shadow
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
    backgroundColor: '#0a0f1d',
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
    borderColor: colors.primary,
  },
  photoLiveText: {
    color: colors.primary,
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
    borderColor: colors.primary,
  },
  rolePillText: { color: colors.primary, fontSize: 11, fontFamily: Typography.fontFamily.bold },
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
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 72,
    shadowColor: colors.primary,
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

  // ── Ball-type Player Stats Card ──
  statsCardContainer: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
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

  // ── Progress Block ──
  progressBlock: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressLabel: {
    color: colors.textPrimary,
    fontSize: 12,
    fontFamily: Typography.fontFamily.bold,
  },
  progressCount: {
    color: colors.primary,
    fontSize: 11,
    fontFamily: Typography.fontFamily.semiBold,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: colors.surface,
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 4,
  },
  progressBarFill: {
    height: 6,
    backgroundColor: colors.primary,
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
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  setDotActive: {
    backgroundColor: colors.primaryAlpha20,
    borderColor: colors.primary,
    borderWidth: 2,
  },
  setDotDone: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  setDotText: {
    color: colors.textTertiary,
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
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 15,
    shadowColor: colors.primary,
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
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 8,
    height: 42,
    color: colors.textPrimary,
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

  // ── Points Configuration Block & Pills ──
  pointsConfigBlock: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginBottom: 3,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  pointsConfigHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  sectionLabelSmall: {
    color: colors.textTertiary,
    fontSize: 9.5,
    fontFamily: Typography.fontFamily.bold,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  activePointBadge: {
    backgroundColor: colors.primaryAlpha20 || 'rgba(74,222,128,0.18)',
    borderRadius: 10,
    paddingVertical: 2,
    paddingHorizontal: 7,
    marginLeft: 6,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  activePointBadgeText: {
    fontSize: 10,
    fontFamily: Typography.fontFamily.bold,
    color: colors.primary,
  },
  undoBidHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderRadius: 8,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  undoBidHeaderText: {
    fontSize: 10,
    fontFamily: Typography.fontFamily.bold,
    color: '#EF4444',
  },
  configurePointsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundElevated,
    borderRadius: 8,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  configurePointsBtnText: {
    fontSize: 10,
    fontFamily: Typography.fontFamily.semiBold,
    color: colors.primary,
  },
  pointsScrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pointPill: {
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: 12,
    backgroundColor: colors.backgroundElevated,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pointPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  pointPillText: {
    fontSize: 11,
    fontFamily: Typography.fontFamily.semiBold,
    color: colors.textSecondary,
  },
  pointPillTextActive: {
    color: '#000000',
    fontFamily: Typography.fontFamily.bold,
  },
  pointPillCustom: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: colors.backgroundElevated,
    borderWidth: 1,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  pointPillCustomText: {
    fontSize: 10,
    fontFamily: Typography.fontFamily.semiBold,
    color: colors.primary,
  },
  inlineCustomBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundElevated,
    borderRadius: 14,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: colors.primary,
    gap: 4,
  },
  inlineCustomInput: {
    width: 48,
    paddingVertical: 2,
    paddingHorizontal: 4,
    fontSize: 12,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  inlineCustomAddBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    padding: 3,
  },
  nextBidHint: {
    fontSize: 10,
    fontFamily: Typography.fontFamily.semiBold,
    color: colors.primary,
  },

  // ── Points Modal Styles ──
  pointsModalBox: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 18,
    width: '90%',
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  pointsModalTitle: {
    fontSize: 16,
    fontFamily: Typography.fontFamily.bold,
    color: colors.textPrimary,
  },
  modalSectionSub: {
    fontSize: 11,
    fontFamily: Typography.fontFamily.bold,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  modalPointBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 16,
    backgroundColor: colors.primaryAlpha20 || 'rgba(74,222,128,0.15)',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  modalPointBadgeText: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.bold,
    color: colors.primary,
  },
  presetPointPill: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: colors.backgroundElevated,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
  },
  presetPointPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  presetPointPillText: {
    fontSize: 11,
    fontFamily: Typography.fontFamily.semiBold,
    color: colors.textSecondary,
  },
  presetPointPillTextActive: {
    color: '#000000',
    fontFamily: Typography.fontFamily.bold,
  },
  modalCustomInput: {
    flex: 1,
    backgroundColor: colors.backgroundElevated,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalCustomAddBtn: {
    backgroundColor: colors.primaryAlpha20 || 'rgba(74,222,128,0.2)',
    paddingHorizontal: 14,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  modalCustomAddBtnText: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.bold,
    color: colors.primary,
  },
  modalSaveBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    height: 46,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalSaveBtnText: {
    fontSize: 14,
    fontFamily: Typography.fontFamily.bold,
    color: '#000',
  },

  // ── Section Label ──
  sectionLabel: {
    color: colors.textTertiary,
    fontSize: 9.5,
    fontFamily: Typography.fontFamily.semiBold,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 2,
  },

  // ── Team Grid ──
  // ── Team Grid (4 in a row) ──
  teamGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    justifyContent: 'flex-start',
    paddingBottom: 4,
  },
  teamCard: {
    width: '23.8%',
    backgroundColor: colors.surface,
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 66,
  },
  teamCardHighest: {
    borderColor: '#FFD700',
    backgroundColor: 'rgba(255, 215, 0, 0.08)',
  },
  teamCardHeader: {
    alignItems: 'center',
    width: '100%',
    marginBottom: 2,
    position: 'relative',
  },
  teamLogoSmall: {
    width: 22,
    height: 22,
    borderRadius: 11,
    marginBottom: 2,
  },
  teamLogoSmallPlaceholder: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.surfaceVariant,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  teamCardName: {
    fontSize: 9.5,
    fontFamily: Typography.fontFamily.bold,
    color: colors.textPrimary,
    textAlign: 'center',
    width: '100%',
  },
  teamCardPurse: {
    fontSize: 8,
    fontFamily: Typography.fontFamily.medium,
    color: colors.textTertiary,
    textAlign: 'center',
    width: '100%',
  },
  leadingBadgeIcon: {
    position: 'absolute',
    top: -2,
    right: 0,
  },
  teamActionBadge: {
    backgroundColor: colors.primaryAlpha20 || 'rgba(74, 222, 128, 0.15)',
    borderRadius: 5,
    paddingVertical: 2.5,
    paddingHorizontal: 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.primary,
    width: '100%',
    marginTop: 2,
  },
  teamActionBadgeHighest: {
    backgroundColor: 'rgba(255, 215, 0, 0.18)',
    borderColor: '#FFD700',
  },
  teamActionBadgeDisabled: {
    backgroundColor: colors.backgroundElevated,
    borderColor: colors.border,
  },
  teamActionBadgeText: {
    fontSize: 8.5,
    fontFamily: Typography.fontFamily.bold,
    color: colors.primary,
    textAlign: 'center',
  },
  teamActionBadgeTextHighest: {
    fontSize: 8,
    fontFamily: Typography.fontFamily.bold,
    color: '#FFD700',
    textAlign: 'center',
  },
  manualBidMiniBar: {
    marginTop: 3,
    paddingHorizontal: 2,
  },

  // Legacy teamChip preserved for safety
  teamChip: {
    width: '22.5%',
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 4,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    position: 'relative',
  },
  teamChipSelected: {
    borderColor: colors.primary,
    backgroundColor: 'transparent',
  },
  teamChipHighest: {
    borderColor: '#FFD700',
    backgroundColor: 'rgba(255, 215, 0, 0.08)',
  },
  teamLogo: { width: 28, height: 28, borderRadius: 14 },
  teamLogoPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  teamChipName: {
    color: colors.textSecondary,
    fontSize: 11,
    fontFamily: Typography.fontFamily.semiBold,
    marginTop: 5,
    textAlign: 'center',
  },
  teamChipNameActive: { color: colors.primary, fontFamily: Typography.fontFamily.bold },
  teamChipPurse: {
    color: colors.textTertiary,
    fontSize: 9,
    marginTop: 1,
    textAlign: 'center',
  },
  purseMiniBar: {
    width: '80%',
    height: 3,
    backgroundColor: colors.surface,
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 4,
  },
  purseMiniBarFill: {
    height: 3,
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  leadingCrown: {
    position: 'absolute',
    top: 4,
    right: 4,
  },
  leadingBadge: { position: 'absolute', top: 4, right: 4 },
  leadingBadgeText: { color: colors.primary, fontSize: 8 },


  // ── Action Buttons (SOLD=green / UNSOLD=red / SKIP=indigo) ──
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
    marginBottom: 2,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    borderRadius: 10,
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
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
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
    color: colors.textPrimary,
    fontFamily: Typography.fontFamily.bold,
    fontSize: 18,
    marginBottom: 6,
  },
  allSetsCompleteSub: {
    color: colors.textTertiary,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 18,
  },
  unsoldSetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    width: '100%',
  },
  unsoldSetBtnText: {
    color: colors.background,
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
    backgroundColor: colors.primary,
    width: '100%',
    height: 50,
    borderRadius: 12,
    marginTop: Spacing.sm,
  },
  primaryBtnText: { color: colors.background, fontFamily: Typography.fontFamily.bold, fontSize: 15 },

  // Unsold & Re-auction modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  centerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.md,
  },
  modalBackdropTap: {
    ...StyleSheet.absoluteFillObject,
  },
  modalSheetHandleWrap: {
    alignItems: 'center',
    marginBottom: 10,
    paddingTop: 4,
  },
  modalSheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  modalCloseBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  unsoldModalContainer: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: 0,
    height: '85%',
    width: '100%',
    borderWidth: 1,
    borderColor: colors.border,
    zIndex: 1,
    elevation: 20,
  },
  unsoldBottomBar: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  unsoldModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  unsoldModalTitle: {
    color: colors.textPrimary,
    fontFamily: Typography.fontFamily.bold,
    fontSize: 18,
  },
  unsoldModalSub: {
    color: colors.textTertiary,
    fontSize: 12,
    marginTop: 2,
  },
  unsoldActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  addNewPlayerTriggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  addNewPlayerTriggerText: {
    color: colors.background,
    fontFamily: Typography.fontFamily.bold,
    fontSize: 12,
  },
  selectAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(154, 188, 47, 0.1)',
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  selectAllBtnText: {
    color: colors.primary,
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: 12,
  },
  unsoldSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 40,
    marginBottom: 8,
  },
  unsoldSearchInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 13,
    paddingVertical: 0,
  },
  unsoldCountRow: {
    marginBottom: 8,
  },
  unsoldCountText: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  unsoldPlayerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
  },
  unsoldPlayerRowSelected: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(154, 188, 47, 0.08)',
  },
  unsoldPlayerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
  },
  unsoldPlayerAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  unsoldPlayerInitials: {
    color: colors.primary,
    fontFamily: Typography.fontFamily.bold,
    fontSize: 14,
  },
  unsoldPlayerName: {
    color: colors.textPrimary,
    fontFamily: Typography.fontFamily.bold,
    fontSize: 14,
  },
  unsoldPlayerMeta: {
    color: colors.textTertiary,
    fontSize: 11,
    fontFamily: Typography.fontFamily.semiBold,
  },
  unsoldStatusChip: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    marginLeft: 6,
  },
  unsoldStatusChipText: {
    color: '#EF4444',
    fontSize: 9,
    fontFamily: Typography.fontFamily.bold,
  },
  unsoldPlayerBasePrice: {
    color: colors.primary,
    fontFamily: Typography.fontFamily.bold,
    fontSize: 13,
  },
  emptyUnsoldBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  emptyUnsoldTitle: {
    color: colors.textPrimary,
    fontFamily: Typography.fontFamily.bold,
    fontSize: 16,
    marginTop: 10,
  },
  emptyUnsoldSub: {
    color: colors.textTertiary,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  emptyAddBtnText: {
    color: colors.background,
    fontFamily: Typography.fontFamily.bold,
    fontSize: 13,
  },
  createUnsoldSetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    height: 48,
    borderRadius: 12,
  },
  createUnsoldSetBtnText: {
    color: colors.background,
    fontFamily: Typography.fontFamily.bold,
    fontSize: 14,
  },

  // Add new player modal styles
  addPlayerModalContainer: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: Spacing.lg,
    maxHeight: '85%',
    width: '92%',
    maxWidth: 420,
    borderWidth: 1,
    borderColor: colors.border,
    zIndex: 1,
    elevation: 20,
  },
  newPlayerPhotoPicker: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: colors.background,
  },
  phoneLookupIndicator: {
    position: 'absolute',
    right: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phoneLookupMsg: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 4,
  },
  phoneLookupMsgText: {
    fontSize: 12,
    marginLeft: 4,
  },
  newPlayerPhotoPreview: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  newPlayerPhotoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPlayerFieldLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontFamily: Typography.fontFamily.medium,
    marginBottom: 6,
  },
  addPlayerInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
    color: colors.textPrimary,
    fontSize: 14,
    marginBottom: 12,
  },
  roleSelectChip: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  roleSelectChipActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(154, 188, 47, 0.15)',
  },
  roleSelectChipText: {
    color: colors.textTertiary,
    fontSize: 12,
    fontFamily: Typography.fontFamily.medium,
  },
  roleSelectChipTextActive: {
    color: colors.primary,
    fontFamily: Typography.fontFamily.bold,
  },
  saveNewPlayerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    height: 48,
    borderRadius: 12,
  },
  saveNewPlayerBtnText: {
    color: colors.background,
    fontFamily: Typography.fontFamily.bold,
    fontSize: 14,
  },
});

export default AuctionLiveOrganiserScreen;
