import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, ActivityIndicator, Modal, FlatList, Dimensions, Image, ImageBackground, StatusBar, Animated as RNAnimated, Easing, Alert, RefreshControl, Share, TextInput, BackHandler, Pressable, Linking, Platform } from 'react-native';
import LinearGradient from '../../../components/SolidGradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { fetchLiveState, setLiveState, addMatchScorer, updateLiveViewers } from '../matchSlice';
import api, { BASE_URL, getImageUrl } from '../../../api/axios';
import socketService from '../../../services/socketService';
import { WebView } from 'react-native-webview';
import { useTheme, Typography, BorderRadius, Spacing } from '../../../theme/theme';
import moment from 'moment';
import { getPlayerTags } from '../../../utils/playerTags';
import ConfettiCannon from 'react-native-confetti-cannon';
import SkeletonPlaceholder from 'react-native-skeleton-placeholder';
import { showCustomAlert } from '../../../components/CustomAlert';
import SharePreviewModal from '../../tournament/components/SharePreviewModal';
import { MatchSummaryPoster, MotmPoster, AiReportPoster } from '../../tournament/components/PosterTemplates';
import PartnershipsView from '../components/PartnershipsView';
import Tts from 'react-native-tts';
import Video from 'react-native-video';

const SCREEN_WIDTH = Dimensions.get('window').width;
const FALLBACK_BATTER = require('../../../../Batter.png');
const FALLBACK_BOWLER = require('../../../../Bowl.png');
const FALLBACK_FOTM = require('../../../../FOTM.png');
const FALLBACK_POTM = require('../../../../POTM.png');

const AutoScrollingText = ({ text, style }) => {
  const scrollRef = useRef(null);
  const [contentWidth, setContentWidth] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    if (contentWidth <= containerWidth || containerWidth === 0) return;

    const maxScroll = contentWidth - containerWidth + 16;
    let isMounted = true;
    let currentX = 0;
    let state = 0; // 0: pause at start, 1: scrolling right, 2: pause at end, 3: resetting
    let pauseTimer = null;

    // Start after 1.5s initial pause
    pauseTimer = setTimeout(() => {
      if (!isMounted) return;
      state = 1;
    }, 1500);

    const interval = setInterval(() => {
      if (!isMounted) return;

      if (state === 1) {
        currentX += 1.2;
        if (currentX >= maxScroll) {
          state = 2; // Pause at end
          pauseTimer = setTimeout(() => {
            if (!isMounted) return;
            // Smoothly reset back
            scrollRef.current?.scrollTo({ x: 0, animated: true });
            state = 0; // Pause at start
            currentX = 0;
            pauseTimer = setTimeout(() => {
              if (!isMounted) return;
              state = 1; // Start scrolling again
            }, 1500);
          }, 1800);
        } else {
          scrollRef.current?.scrollTo({ x: currentX, animated: false });
        }
      }
    }, 30);

    return () => {
      isMounted = false;
      clearInterval(interval);
      if (pauseTimer) clearTimeout(pauseTimer);
    };
  }, [contentWidth, containerWidth, text]);

  return (
    <View 
      style={{ flex: 1, overflow: 'hidden', height: 26, justifyContent: 'center' }}
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
    >
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        onContentSizeChange={(w) => setContentWidth(w)}
        contentContainerStyle={{ alignItems: 'center' }}
      >
        <Text style={[style, { flexShrink: 0 }]} numberOfLines={1}>
          {text}
        </Text>
      </ScrollView>
    </View>
  );
};

const MvpPlayerRow = ({ player, idx, isPom, isTop, item }) => {
  const { colors, shadows, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, shadows, isDark), [colors, shadows, isDark]);
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={{ borderBottomWidth: 0.5, borderBottomColor: colors.border, paddingVertical: 12 }}>
      <TouchableOpacity
        onPress={() => setExpanded(!expanded)}
        style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 }}
        activeOpacity={0.7}
      >
        <Text style={{ width: 28, fontSize: 13, fontWeight: 'bold', color: colors.textSecondary, textAlign: 'center' }}>{idx + 1}</Text>

        <View style={styles.avatarPlaceholderSm}>
          {player.photo ? (
            <Image source={{ uri: getImageUrl(player.photo) }} style={{ width: '100%', height: '100%', borderRadius: 18 }} />
          ) : (
            <Text style={styles.avatarTextSm}>{player.name?.charAt(0).toUpperCase()}</Text>
          )}
        </View>

        <View style={{ flex: 1, marginLeft: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
            <Text style={{ color: colors.textPrimary, fontWeight: 'bold', fontSize: 14 }}>{player.name}</Text>
            {isPom && (
              <View style={{ backgroundColor: '#eab308', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 }}>
                <Text style={{ color: '#000', fontSize: 9, fontWeight: 'bold' }}>POM</Text>
              </View>
            )}
            {isTop && !isPom && (
              <View style={{ backgroundColor: colors.primaryAlpha20, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 }}>
                <Text style={{ color: colors.primary, fontSize: 9, fontWeight: 'bold' }}>TOP MVP</Text>
              </View>
            )}
          </View>
          <Text style={{ color: colors.textTertiary, fontSize: 11, marginTop: 2 }}>{player.playingRole || 'Player'}</Text>
        </View>

        <View style={{ alignItems: 'flex-end', marginRight: 8 }}>
          <Text style={{ color: colors.primary, fontWeight: 'bold', fontSize: 16 }}>{item.totalMvp.toFixed(2)}</Text>
          <Text style={{ color: colors.textTertiary, fontSize: 9 }}>PTS</Text>
        </View>

        <Icon name={expanded ? "chevron-up" : "chevron-down"} size={20} color={colors.textTertiary} />
      </TouchableOpacity>

      {expanded && (
        <View style={{ marginTop: 12, marginLeft: 38, marginRight: 8, backgroundColor: 'rgba(255, 255, 255, 0.05)', padding: 12, borderRadius: 8, gap: 8 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>🏏 Batting MVP</Text>
            <Text style={{ color: colors.textPrimary, fontWeight: 'bold', fontSize: 12 }}>{item.battingMvp.toFixed(2)}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>🥎 Bowling MVP</Text>
            <Text style={{ color: colors.textPrimary, fontWeight: 'bold', fontSize: 12 }}>{item.bowlingMvp.toFixed(2)}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>🧤 Fielding MVP</Text>
            <Text style={{ color: colors.textPrimary, fontWeight: 'bold', fontSize: 12 }}>{item.fieldingMvp.toFixed(2)}</Text>
          </View>
        </View>
      )}
    </View>
  );
};

const AnalysisDropdown = ({ value, options, onSelect, placeholder }) => {
  const { colors, shadows, isDark } = useTheme();
  const [visible, setVisible] = useState(false);
  const selectedOpt = options.find(o => o.value === value) || options.find(o => o.value?._id && value?._id && o.value._id === value._id);

  return (
    <View style={{ flex: 1, marginHorizontal: 4 }}>
      <TouchableOpacity
        style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderLight, borderRadius: 8, padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
        onPress={() => setVisible(true)}
      >
        <Text style={{ color: selectedOpt ? colors.textPrimary : colors.textSecondary, fontFamily: Typography.fontFamily.regular, fontSize: 13 }} numberOfLines={1}>
          {selectedOpt ? selectedOpt.label : placeholder}
        </Text>
        <Icon name="chevron-down" size={20} color={colors.textSecondary} />
      </TouchableOpacity>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }} activeOpacity={1} onPress={() => setVisible(false)}>
          <View style={{ backgroundColor: colors.surface, width: '100%', borderRadius: 12, padding: 16, maxHeight: 300 }}>
            <ScrollView>
              {options.map((opt, idx) => {
                const isSelected = value === opt.value || (value?._id && opt.value?._id && value._id === opt.value._id);
                return (
                  <TouchableOpacity key={idx} style={{ paddingVertical: 12, borderBottomWidth: idx < options.length - 1 ? 1 : 0, borderBottomColor: colors.borderLight }} onPress={() => { onSelect(opt.value); setVisible(false); }}>
                    <Text style={{ color: isSelected ? colors.primary : colors.textPrimary, fontFamily: isSelected ? Typography.fontFamily.bold : Typography.fontFamily.regular, fontSize: 16 }}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const MatchSummaryScreen = ({ navigation, route }) => {
  const { colors, shadows, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, shadows, isDark), [colors, shadows, isDark]);
  const matchIdRaw = route.params?.matchId || route.params?.id || route.params?.match?._id || route.params?.match;
  const cleanMatchId = socketService.cleanId(matchIdRaw);
  const matchId = cleanMatchId;

  const dispatch = useDispatch();
  const currentUser = useSelector((state) => state.auth.user);

  const [activeAudioUrl, setActiveAudioUrl] = useState(null);

  const safeTtsStop = useCallback(() => {
    if (Platform.OS !== 'ios') {
      try {
        Tts.stop();
      } catch (e) { }
    }
  }, []);

  // Initialize TTS configuration and cleanup on unmount
  useEffect(() => {
    Tts.setDefaultLanguage('en-IN').catch(() => {
      Tts.setDefaultLanguage('en-US').catch(() => { });
    });
    Tts.voices().then(voices => {
      const enVoices = voices.filter(v => v.language.startsWith('en'));
      console.log("🎤 Available English voices:", JSON.stringify(enVoices, null, 2));
    }).catch(err => {
      console.error("Failed to fetch voices:", err);
    });
    return () => {
      safeTtsStop();
    };
  }, [safeTtsStop]);

  const handleVoiceSpeak = useCallback(async (ball) => {
    if (!ball.commentary) return;

    if (ball.audioUrl) {
      console.log("🎙️ Streaming commentary from Cloudinary URL:", ball.audioUrl);
      safeTtsStop();
      setActiveAudioUrl(ball.audioUrl);
      return;
    }

    try {
      safeTtsStop();
      setActiveAudioUrl(null); // Stop any playing network audio

      const isShastri = /Shastri/i.test(ball.commentary);
      const cleanText = ball.commentary.replace(/^(Shastri|Bhogle):\s*/i, '');

      console.log(`🔊 Speaking [${isShastri ? 'Shastri' : 'Bhogle'}]: "${cleanText}"`);

      // Query voices dynamically to select a male Indian English voice
      const voices = await Tts.voices();
      const enInVoices = voices.filter(v => (v.language === 'en-IN' || v.language === 'eng-IND') && !v.notInstalled);

      let voiceToUse = null;
      if (isShastri) {
        // Shastri: Look for 'ene' (male Google TTS voice) or 'ahp' (male) or fallback to first en-IN
        voiceToUse = enInVoices.find(v => v.id.includes('ene')) || enInVoices.find(v => v.id.includes('ahp')) || enInVoices[0];
        Tts.setDefaultPitch(1.0).catch(() => {}); // Use natural pitch to avoid robotic distortion
        Tts.setDefaultRate(0.5).catch(() => {});  // Standard conversational rate
      } else {
        // Bhogle: Look for 'ene' or another en-IN voice
        voiceToUse = enInVoices.find(v => v.id.includes('ene')) || enInVoices[0];
        Tts.setDefaultPitch(1.0).catch(() => {}); // Use natural pitch to avoid robotic distortion
        Tts.setDefaultRate(0.5).catch(() => {});  // Standard conversational rate
      }

      if (voiceToUse) {
        console.log(`🎤 Setting voice to: ${voiceToUse.id}`);
        await Tts.setDefaultVoice(voiceToUse.id);
      }

      Tts.speak(cleanText);
    } catch (e) {
      console.error("Tts.speak failed:", e);
    }
  }, []);

  // Register Match View (Deduplicated via Backend)
  useEffect(() => {
    let isMounted = true;
    const registerView = async () => {
      if (!cleanMatchId) return;
      try {
        // Use authenticated user ID if logged in, otherwise use a persistent anonymous ID
        let viewerId = currentUser?._id;
        if (!viewerId) {
          viewerId = await AsyncStorage.getItem('scoreverse_viewer_id');
          if (!viewerId) {
            viewerId = 'anon_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
            await AsyncStorage.setItem('scoreverse_viewer_id', viewerId);
          }
        }

        // Only registers a view if it passes backend deduplication
        await api.post(`/matches/${cleanMatchId}/view`, { viewerId });
      } catch (err) {
        console.log('Error registering match view:', err.message);
      }
    };
    registerView();
    return () => { isMounted = false; };
  }, [cleanMatchId, currentUser?._id]);
  const insets = useSafeAreaInsets();
  const safeTop = Math.max(insets?.top || 0, Platform.OS === 'ios' ? 44 : 0);
  const safeBottom = Math.max(insets?.bottom || 0, Platform.OS === 'ios' ? 24 : 0);
  const reduxLiveState = useSelector((state) => state.match.liveState);
  const [matchData, setMatchData] = useState(null);
  const matchDataRef = useRef(null);
  const [matchNotFound, setMatchNotFound] = useState(false);
  const liveState = matchData || (reduxLiveState && String(reduxLiveState.match?._id || reduxLiveState.matchId || '').trim() === String(cleanMatchId).trim() ? reduxLiveState : null);

  useEffect(() => {
    matchDataRef.current = matchData;
  }, [matchData]);

  const [activeTab, setActiveTab] = useState('Summary');

  const [selectedPlayerPreview, setSelectedPlayerPreview] = useState(null);
  const [playerPreviewStats, setPlayerPreviewStats] = useState(null);
  const [playerPreviewLoading, setPlayerPreviewLoading] = useState(false);
  const [selectedTagDefinition, setSelectedTagDefinition] = useState(null);
  const [expandedInnings, setExpandedInnings] = useState({});
  const flatListRef = useRef(null);
  const msOverTimelineScrollRef = useRef(null);
  const headerScrollRef = useRef(null);

  const dynamicTabs = useMemo(() => {
    const tabs = ['Info', 'Summary'];
    if (matchData?.status === 'completed' || route.params?.match?.status === 'completed') {
      if (aiReportLoading && !aiReport) {
        tabs.push('AI Report (Generating...)');
      } else {
        tabs.push('AI Report');
      }
    }
    tabs.push('Scorecard', 'Comms', 'Squads', 'Analysis', 'Partnerships', 'Leaderboard');
    return tabs;
  }, [matchData?.status, route.params?.match?.status, aiReportLoading, aiReport]);

  const handleTabPress = (tab) => {
    setActiveTab(tab);
    const index = dynamicTabs.indexOf(tab);
    if (index !== -1 && flatListRef.current) {
      flatListRef.current.scrollToIndex({ index, animated: true });
    }
    if (index !== -1 && headerScrollRef.current) {
      headerScrollRef.current.scrollTo({ x: Math.max(0, index * 90 - 40), animated: true });
    }
  };

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems && viewableItems.length > 0) {
      const newTab = viewableItems[0].item;
      setActiveTab(newTab);
      // Optional: scroll the header to keep the active tab visible
      // Not strictly necessary, but good UX
    }
  }).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;

  const toggleInnings = (index, currentIsExpanded) => {
    setExpandedInnings(prev => ({ ...prev, [index]: !currentIsExpanded }));
  };

  // Fetch overall career stats when a player preview opens
  useEffect(() => {
    if (!selectedPlayerPreview?._id) {
      setPlayerPreviewStats(null);
      return;
    }
    let cancelled = false;
    setPlayerPreviewStats(null);
    setPlayerPreviewLoading(true);
    api.get(`/players/${selectedPlayerPreview._id}`)
      .then(res => {
        if (!cancelled) {
          const p = res.data?.data || res.data;
          setPlayerPreviewStats(p || null);
          // Merge full details so we get the photo and user fields populated for the preview pro pic
          setSelectedPlayerPreview(prev => {
            if (!prev) return null;
            return {
              ...prev,
              photo: p?.photo || prev.photo,
              userId: p?.userId || prev.userId,
            };
          });
        }
      })
      .catch(() => { })
      .finally(() => { if (!cancelled) setPlayerPreviewLoading(false); });
    return () => { cancelled = true; };
  }, [selectedPlayerPreview?._id]);

  const [commentary, setCommentary] = useState([]);
  const [loadingCommentary, setLoadingCommentary] = useState(false);
  const [scorecards, setScorecards] = useState([]);
  const [loadingScorecards, setLoadingScorecards] = useState(false);
  const [leaderboardFilter, setLeaderboardFilter] = useState('Batting');
  const [leaderboardTab, setLeaderboardTab] = useState('MVP');
  const [commentaryFilter, setCommentaryFilter] = useState('ALL');
  const [analysisFilter, setAnalysisFilter] = useState('ALL');
  const [partnershipFilter, setPartnershipFilter] = useState('ALL');
  const [declareResultModalVisible, setDeclareResultModalVisible] = useState(false);
  const [declareConfirmation, setDeclareConfirmation] = useState(null);
  const [selectedAnalysisBatter, setSelectedAnalysisBatter] = useState(null);
  const [selectedBatterDot, setSelectedBatterDot] = useState(null);
  const [expandedBalls, setExpandedBalls] = useState({});

  const [aiReport, setAiReport] = useState(null);
  const [aiReportLoading, setAiReportLoading] = useState(false);
  const [aiReportError, setAiReportError] = useState(false);
  const [progressMsgIdx, setProgressMsgIdx] = useState(0);

  const [aiReportSubTab, setAiReportSubTab] = useState('individual');
  const [aiPlayerReport, setAiPlayerReport] = useState(null);
  const [aiPlayerReportLoading, setAiPlayerReportLoading] = useState(false);
  const [aiPlayerReportError, setAiPlayerReportError] = useState(false);

  const userPlayed = useMemo(() => {
    if (!currentUser || !scorecards || scorecards.length === 0) return false;
    return scorecards.some(sc => {
      const isBatter = sc.batting?.some(b => {
        const playerObj = b.player;
        if (!playerObj) return false;
        const pUserId = playerObj.userId?._id || playerObj.userId || playerObj._id;
        return pUserId?.toString() === currentUser._id?.toString();
      });
      const isBowler = sc.bowling?.some(b => {
        const playerObj = b.player;
        if (!playerObj) return false;
        const pUserId = playerObj.userId?._id || playerObj.userId || playerObj._id;
        return pUserId?.toString() === currentUser._id?.toString();
      });
      return isBatter || isBowler;
    });
  }, [currentUser, scorecards]);

  const resolvedMvp = useMemo(() => {
    const match = liveState?.match;
    if (!match || !match.playerOfMatch) return null;

    if (typeof match.playerOfMatch === 'object' && match.playerOfMatch.name) {
      return match.playerOfMatch;
    }

    const mvpId = String(match.playerOfMatch);
    const allXI = [...(match.playingXI?.teamA || []), ...(match.playingXI?.teamB || [])];
    let mvpObj = allXI.find(p => String(p._id || p) === mvpId);

    if (!mvpObj && scorecards?.length > 0) {
      const scorecardPlayers = scorecards.flatMap(sc => [
        ...(sc.batting || []).map(b => b.player),
        ...(sc.bowling || []).map(b => b.player)
      ]).filter(Boolean);
      mvpObj = scorecardPlayers.find(p => String(p._id || p) === mvpId);
    }
    return mvpObj;
  }, [liveState?.match, scorecards]);

  const progressMessages = [
    "Analyzing batting performances...",
    "Reviewing bowling statistics...",
    "Identifying key moments...",
    "Writing professional report..."
  ];

  useEffect(() => {
    let interval;
    if (activeTab.startsWith('AI Report') && aiReportLoading && !aiReport) {
      interval = setInterval(() => {
        setProgressMsgIdx(prev => (prev + 1) % progressMessages.length);
      }, 1500);
    }
    return () => clearInterval(interval);
  }, [activeTab, aiReportLoading, aiReport]);

  const handleBackPress = useCallback(() => {
    const state = navigation.getState();
    if (state && state.routes) {
      const routes = state.routes;
      if (routes.length >= 2) {
        const prevRoute = routes[routes.length - 2];
        if (prevRoute.name === 'LiveScorer' || prevRoute.name === 'MatchPlayerSelection') {
          navigation.navigate('My Cricket', { screen: 'MyCricketMain' });
          return true;
        }
      }
    }

    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('My Cricket', { screen: 'MyCricketMain' });
    }
    return true;
  }, [navigation]);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
    return () => backHandler.remove();
  }, [handleBackPress]);



  const toggleBallExpand = (ballId) => {
    setExpandedBalls(prev => ({ ...prev, [ballId]: !prev[ballId] }));
  };

  const [refreshing, setRefreshing] = useState(false);
  const [activePosterType, setActivePosterType] = useState(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showAddScorerModal, setShowAddScorerModal] = useState(false);
  const [showDeclareResultModal, setShowDeclareResultModal] = useState(false);
  const [showAbandonModal, setShowAbandonModal] = useState(false);
  const [newScorerMobile, setNewScorerMobile] = useState('');
  const [scorerSearchResult, setScorerSearchResult] = useState(null);
  const [isScorerSearching, setIsScorerSearching] = useState(false);
  const [abandonReason, setAbandonReason] = useState('');
  const [resultType, setResultType] = useState('walkover');
  const [winnerTeamId, setWinnerTeamId] = useState(null);

  const fetchScorecards = useCallback(async (silent = false) => {
    if (!cleanMatchId) return;
    if (!silent) setLoadingScorecards(true);
    try {
      const res = await api.get(`/matches/${cleanMatchId}/scorecard`);
      setScorecards(Array.isArray(res.data?.data) ? res.data.data : res.data?.data?.scorecards || []);
    } catch (e) {
      console.log('Error fetching scorecards', e);
    } finally {
      if (!silent) setLoadingScorecards(false);
    }
  }, [cleanMatchId]);

  const fetchAiReport = useCallback(async () => {
    if (!cleanMatchId) return;
    setAiReportLoading(true);
    setAiReportError(false);
    try {
      const res = await api.get(`/matches/${cleanMatchId}/ai-report`);
      if (res.data?.data) {
        if (res.data.data.generationStatus === 'completed') {
          setAiReport(res.data.data);
          setAiReportLoading(false);
        } else if (res.data.data.generationStatus === 'generating') {
          setAiReport(null);
          setAiReportLoading(true);
        } else {
          setAiReport(null);
          setAiReportLoading(false);
          setAiReportError(true);
        }
      } else {
        setAiReport(null);
        setAiReportLoading(false);
      }
    } catch (e) {
      console.log('Error fetching AI Report', e);
      setAiReportLoading(false);
      setAiReportError(true);
    }
  }, [cleanMatchId]);

  const fetchAiPlayerReport = useCallback(async () => {
    if (!cleanMatchId || !currentUser?._id) return;
    setAiPlayerReportLoading(true);
    setAiPlayerReportError(false);
    try {
      const res = await api.get(`/matches/${cleanMatchId}/ai-report/player/${currentUser._id}`);
      if (res.data?.data) {
        setAiPlayerReport(res.data.data);
      } else {
        setAiPlayerReport(null);
      }
    } catch (e) {
      console.log('Error fetching AI Player Report', e);
      setAiPlayerReportError(true);
    } finally {
      setAiPlayerReportLoading(false);
    }
  }, [cleanMatchId, currentUser?._id]);

  const handleShare = () => {
    setActivePosterType('summary');
  };


  const fetchCommentary = useCallback(async (silent = false) => {
    if (!cleanMatchId) return;
    if (!silent) setLoadingCommentary(true);
    try {
      const res = await api.get(`/matches/${cleanMatchId}/commentary`);
      setCommentary(Array.isArray(res.data?.data) ? res.data.data : res.data?.data?.commentary || []);
    } catch (e) {
      console.log('Error fetching commentary', e);
    } finally {
      if (!silent) setLoadingCommentary(false);
    }
  }, [cleanMatchId]);

  const fetchLocalLiveState = useCallback(async () => {
    if (!cleanMatchId) return;
    try {
      const res = await api.get(`/matches/${cleanMatchId}/live`);
      if (res.data?.data) {
        setMatchNotFound(false);
        setMatchData(res.data.data);
        dispatch(setLiveState(res.data.data));
      }
    } catch (e) {
      console.log('Error fetching match live state:', e);
      if (e.response?.status === 404 || e.message?.includes('not found') || e.response?.data?.message?.includes('not found')) {
        setMatchNotFound(true);
      }
    }
  }, [cleanMatchId, dispatch]);

  const onRefresh = async () => {
    if (!cleanMatchId) return;
    setRefreshing(true);
    try {
      const promises = [
        fetchLocalLiveState(),
        fetchCommentary(),
        fetchScorecards(),
      ];
      if (activeTab.startsWith('AI Report')) {
        promises.push(fetchAiReport());
        if (userPlayed) {
          promises.push(fetchAiPlayerReport());
        }
      }
      await Promise.all(promises);
    } catch (e) {
      console.log('Error refreshing match summary:', e);
    } finally {
      setRefreshing(false);
    }
  };

  const getRefreshControl = () => (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      colors={[colors.primary]}
      tintColor={colors.primary}
    />
  );

  const getWinnerTeamName = (matchObj, resultObj) => {
    const currentMatch = matchObj || match;
    const currentResult = resultObj || currentMatch?.result;
    if (!currentMatch) return 'TEAM';
    const winner = currentResult?.winner;
    if (!winner) return 'TEAM';
    if (typeof winner === 'object' && winner.name) return winner.name;

    const winnerIdStr = String(winner._id || winner);
    const teamAIdStr = String(currentMatch.teamA?._id || currentMatch.teamA);
    const teamBIdStr = String(currentMatch.teamB?._id || currentMatch.teamB);

    if (winnerIdStr === teamAIdStr) return currentMatch.teamA?.name || 'Team A';
    if (winnerIdStr === teamBIdStr) return currentMatch.teamB?.name || 'Team B';

    return 'TEAM';
  };

  const [celebration, setCelebration] = useState(null);
  const celebrationAnim = React.useRef(new RNAnimated.Value(0)).current;
  const lastBallRef = React.useRef(null);

  const triggerCelebration = (type, text, color) => {
    setCelebration({ type, text, color });
    celebrationAnim.setValue(0);
    RNAnimated.spring(celebrationAnim, {
      toValue: 1,
      friction: 4,
      tension: 60,
      useNativeDriver: true,
    }).start();

    setTimeout(() => {
      RNAnimated.timing(celebrationAnim, {
        toValue: 0,
        duration: 300,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start(() => setCelebration(null));
    }, 2800);
  };

  const getOversTotalBalls = (oversStr) => {
    if (!oversStr) return 0;
    const parts = String(oversStr).split('.');
    const overs = parseInt(parts[0], 10) || 0;
    const balls = parseInt(parts[1], 10) || 0;
    return (overs * 6) + balls;
  };

  const isStateNewer = (currentState, newState) => {
    if (!currentState) return true;
    if (newState.isUndo || newState.isDbUpdate) return true;
    if (newState.match?.status && currentState.match?.status && newState.match.status !== currentState.match.status) return true;
    if (newState.isMatchComplete && !currentState.isMatchComplete) return true;
    const currentInnings = currentState.inningsNumber || 1;
    const newInnings = newState.inningsNumber || 1;
    if (newInnings > currentInnings) return true;
    if (newInnings < currentInnings) return false;

    const currentOvers = currentState.score?.overs || '0.0';
    const newOvers = newState.score?.overs || '0.0';

    const currentBalls = getOversTotalBalls(currentOvers);
    const newBalls = getOversTotalBalls(newOvers);

    if (newBalls > currentBalls) return true;
    if (newBalls < currentBalls) return false;

    const currentRuns = currentState.score?.runs || 0;
    const newRuns = newState.score?.runs || 0;
    if (newRuns > currentRuns) return true;

    const currentWickets = currentState.score?.wickets || 0;
    const newWickets = newState.score?.wickets || 0;
    if (newWickets > currentWickets) return true;

    if (newState.ballEvent && !currentState.ballEvent) return true;

    // Check player changes (striker, nonStriker, bowler, needsBowler, status)
    const extractId = (p) => typeof p === 'object' && p !== null ? String(p._id || p.id || '') : String(p || '');
    if (newState.striker !== undefined && extractId(newState.striker) !== extractId(currentState.striker)) return true;
    if (newState.nonStriker !== undefined && extractId(newState.nonStriker) !== extractId(currentState.nonStriker)) return true;
    if (newState.bowler !== undefined && extractId(newState.bowler) !== extractId(currentState.bowler)) return true;
    if (newState.needsBowler !== undefined && newState.needsBowler !== currentState.needsBowler) return true;
    if (newState.status !== undefined && newState.status !== currentState.status) return true;

    return false;
  };

  useEffect(() => {
    if (!cleanMatchId) return;

    socketService.remoteLog('MatchSummaryScreen', `Joined Match Room: match_${cleanMatchId}`);
    socketService.joinMatch(cleanMatchId, currentUser?._id || currentUser?.id);

    const handleScoreUpdate = (data) => {
      const updateMatchId = socketService.cleanId(data?.match?._id || data?.matchId || data);
      const activeCleanId = socketService.cleanId(cleanMatchId);
      if (activeCleanId && updateMatchId && activeCleanId !== updateMatchId) {
        socketService.remoteLog('MatchSummaryScreen', `Ignored update for different match. Expected: ${activeCleanId}, Received: ${updateMatchId}`);
        return; // Ignore updates for other matches
      }

      let prev = matchDataRef.current;
      let isNew = false;

      if (!prev) {
        isNew = true;
      } else if (!isStateNewer(prev, data)) {
        socketService.remoteLog('MatchSummaryScreen', `Ignored stale update | Current: ${prev.score?.overs} (${prev.score?.runs}/${prev.score?.wickets}), Received: ${data?.score?.overs} (${data?.score?.runs}/${data?.score?.wickets})`);
        return;
      } else {
        isNew = true;
      }

      if (!isNew) return;

      const mergedData = data?.isDelta && prev ? {
        ...prev,
        ...data,
        match: prev.match ? {
          ...prev.match,
          ...(data.match || {}),
          activeScorerId: data.activeScorerId !== undefined ? data.activeScorerId : prev.match.activeScorerId,
          scorers: data.scorers !== undefined ? data.scorers : prev.match.scorers,
          status: data.status !== undefined ? data.status : prev.match.status,
        } : data.match,
        score: data.score || prev.score,
        striker: data.striker !== undefined ? data.striker : prev.striker,
        strikerStats: data.strikerStats !== undefined ? data.strikerStats : prev.strikerStats,
        nonStriker: data.nonStriker !== undefined ? data.nonStriker : prev.nonStriker,
        nonStrikerStats: data.nonStrikerStats !== undefined ? data.nonStrikerStats : prev.nonStrikerStats,
        bowler: data.bowler !== undefined ? data.bowler : prev.bowler,
        bowlerStats: data.bowlerStats !== undefined ? data.bowlerStats : prev.bowlerStats,
        needsBowler: data.needsBowler !== undefined ? data.needsBowler : prev.needsBowler,
        isWicket: data.isWicket !== undefined ? data.isWicket : prev.isWicket,
        fallOfWickets: data.fallOfWickets !== undefined ? data.fallOfWickets : prev.fallOfWickets,
        isInningsComplete: data.isInningsComplete !== undefined ? data.isInningsComplete : prev.isInningsComplete,
        isMatchComplete: data.isMatchComplete !== undefined ? data.isMatchComplete : prev.isMatchComplete,
        inningsNumber: data.inningsNumber !== undefined ? data.inningsNumber : prev.inningsNumber,
        result: data.result !== undefined ? data.result : prev.result,
        currentOverBalls: data.currentOverBalls || prev.currentOverBalls,
        recentCommentary: (() => {
          if (!data.recentCommentary || data.recentCommentary.length === 0) {
            return prev.recentCommentary;
          }
          const merged = [...data.recentCommentary, ...(prev.recentCommentary || [])];
          const seen = new Set();
          return merged.filter(ball => {
            if (!ball) return false;
            const key = ball._id || `${ball.overNumber}-${ball.ballNumber}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          }).slice(0, 10);
        })(),
      } : data;

      matchDataRef.current = mergedData;
      setMatchData(mergedData);

      const runs = data?.score?.runs ?? data?.teamAScore?.runs ?? 0;
      const wickets = data?.score?.wickets ?? data?.teamAScore?.wickets ?? 0;
      const overs = data?.score?.overs ?? data?.teamAScore?.overs ?? '0.0';

      socketService.remoteLog('MatchSummaryScreen', `Live Update Received | Score: ${runs}/${wickets} (${overs} Ov)`, { matchId: updateMatchId });
      dispatch(setLiveState(data));
      socketService.remoteLog('MatchSummaryScreen', 'State & UI Updated via setMatchData');

      // Real-time synchronization for sub-tabs
      if (data?.fullCommentary) {
        setCommentary(data.fullCommentary);
      } else if (data?.recentCommentary?.length > 0) {
        setCommentary(prev => {
          const merged = [...data.recentCommentary];
          prev.forEach(p => {
            if (!merged.find(m => m._id === p._id)) {
              merged.push(p);
            }
          });
          return merged;
        });
      }
      if (data?.scorecards) {
        setScorecards(data.scorecards);
      } else {
        fetchScorecards(true);
      }

      // Trigger Celebration Logic (Instantly using ballEvent)
      if (data?.ballEvent) {
        const latestBall = data.ballEvent;
        const ballId = latestBall._id || latestBall.timestamp || JSON.stringify(latestBall);
        if (ballId !== lastBallRef.current) {
          lastBallRef.current = ballId;

          if (latestBall.isWicket || latestBall.wicketType) {
            triggerCelebration('wicket', 'W', colors.error);
          } else if (latestBall.batsmanRuns === 6) {
            triggerCelebration('six', '6', colors.primary);
          } else if (latestBall.batsmanRuns === 4) {
            triggerCelebration('four', '4', colors.primary);
          }
        }
      } else if (data?.recentCommentary?.length > 0) {
        const latestBall = data.recentCommentary[0];
        if (latestBall._id && latestBall._id !== lastBallRef.current) {
          lastBallRef.current = latestBall._id;

          if (latestBall.isWicket) {
            triggerCelebration('wicket', 'W', colors.error);
          } else if (latestBall.batsmanRuns === 6) {
            triggerCelebration('six', '6', colors.primary);
          } else if (latestBall.batsmanRuns === 4) {
            triggerCelebration('four', '4', colors.primary);
          }
        }
      }
    };

    const handleScorerAssigned = (data) => {
      const updateMatchId = socketService.cleanId(data?.matchId);
      const activeCleanId = socketService.cleanId(cleanMatchId);
      if (activeCleanId && updateMatchId && activeCleanId !== updateMatchId) {
        return;
      }
      socketService.remoteLog('MatchSummaryScreen', `Scorer reassignment received. New active scorer: ${data.activeScorerId}`);
      setMatchData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          match: {
            ...prev.match,
            activeScorerId: data.activeScorerId,
            scorers: data.scorers || prev.match.scorers
          }
        };
      });
      dispatch(setLiveState({
        isDelta: true,
        matchId: cleanMatchId,
        match: {
          activeScorerId: data.activeScorerId,
          scorers: data.scorers
        }
      }));
    };

    const unsubscribeScore = socketService.onScoreUpdate(handleScoreUpdate);
    const unsubscribeScorer = socketService.on('scorer_assigned', handleScorerAssigned);
    const unsubscribeViewer = socketService.on('viewer_update', (data) => {
      dispatch(updateLiveViewers(data));
    });
    fetchLocalLiveState();

    const unsubscribeFocus = navigation.addListener('focus', () => {
      console.log(`⚡ [Frontend Viewer] Reconnected & Resubscribed | Room Rejoined: match_${cleanMatchId}`);
      socketService.joinMatch(cleanMatchId);
      fetchLocalLiveState();
      fetchCommentary();
      fetchScorecards();
    });

    return () => {
      unsubscribeFocus();
      unsubscribeScore();
      unsubscribeScorer();
      unsubscribeViewer();
      socketService.leaveMatch(cleanMatchId);
    };
  }, [dispatch, cleanMatchId, navigation, fetchCommentary, fetchScorecards, fetchLocalLiveState]);

  useEffect(() => {
    if (!cleanMatchId) return;
    if (activeTab === 'Comms' || activeTab === 'Analysis') {
      fetchCommentary();
    }
    if (activeTab === 'Scorecard' || activeTab === 'Analysis' || activeTab === 'Partnerships') {
      fetchScorecards();
    }
    if (activeTab.startsWith('AI Report')) {
      fetchAiReport();
      if (userPlayed) {
        fetchAiPlayerReport();
      }
    }
  }, [activeTab, cleanMatchId, fetchCommentary, fetchScorecards, fetchAiReport, userPlayed, fetchAiPlayerReport]);

  useEffect(() => {
    let interval;
    if (activeTab === 'AI Report' && aiReportLoading && !aiReport) {
      interval = setInterval(() => {
        fetchAiReport();
      }, 3000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeTab, aiReportLoading, aiReport, fetchAiReport]);

  const isMatchComplete = liveState?.match?.status === 'completed';
  const isAwardCalculationPending = isMatchComplete && (!liveState?.match?.playerOfMatch || !liveState?.match?.result);

  useEffect(() => {
    let interval;
    if (isAwardCalculationPending) {
      interval = setInterval(() => {
        fetchLocalLiveState();
        fetchScorecards(true);
      }, 3000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isAwardCalculationPending, fetchLocalLiveState, fetchScorecards]);

  const handleSearchScorer = async (mob) => {
    if (!mob || mob.length < 10) {
      setScorerSearchResult(null);
      return;
    }
    setIsScorerSearching(true);
    setScorerSearchResult(null);
    try {
      const res = await api.get(`/users/lookup/${mob}`);
      setScorerSearchResult(res.data?.data || null);
    } catch (e) {
      setScorerSearchResult({ exists: false });
    } finally {
      setIsScorerSearching(false);
    }
  };

  useEffect(() => {
    if (newScorerMobile.length === 10) {
      handleSearchScorer(newScorerMobile);
    } else {
      setScorerSearchResult(null);
    }
  }, [newScorerMobile]);

  const isCurrentMatchLoaded = liveState && String(liveState.match?._id || liveState.matchId || '').trim() === String(cleanMatchId).trim();

  if (matchNotFound) {
    return (
      <View style={[styles.centerContainer, { paddingTop: safeTop }]}>
        <Text style={styles.errorText}>Match data not found</Text>
        <TouchableOpacity onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('My Cricket', { screen: 'MyCricketMain' })} style={{ marginTop: 20 }}>
          <Text style={{ color: colors.primary }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!isCurrentMatchLoaded || !liveState?.match) {
    socketService.remoteLog('MatchSummaryScreen', `Loading condition met: isCurrentMatchLoaded=${isCurrentMatchLoaded}, cleanMatchId=${cleanMatchId}, liveStateMatchId=${liveState?.match?._id || liveState?.matchId}`);
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background, paddingTop: safeTop }]}>
        <ActivityIndicator size="large" color={colors.primary} style={{ marginBottom: 16 }} />
        <Text style={{ color: colors.textPrimary, fontFamily: Typography.fontFamily.semiBold, fontSize: 18 }}>
          Loading Match Summary...
        </Text>
        <Text style={{ color: colors.textSecondary, fontFamily: Typography.fontFamily.medium, fontSize: 14, marginTop: 8 }}>
          Fetching statistics and details
        </Text>
      </View>
    );
  }

  const { match, score, striker, strikerStats, nonStriker, nonStrikerStats, bowler, previousBowler, bowlerStats } = liveState;

  const teamA = match.teamA?.name || 'Team A';
  const teamB = match.teamB?.name || 'Team B';
  const dateStr = match.scheduledAt ? moment(match.scheduledAt).format('DD MMM YYYY, hh:mm A') : moment(match.createdAt).format('DD MMM YYYY, hh:mm A');
  const formatStr = `${match.format} • ${match.overs} Overs`;

  const creatorId = typeof match.creator === 'object' ? match.creator?._id : match.creator;
  const isCreator = String(creatorId) === String(currentUser?._id);
  // match.organizerId is the permanent match manager — always retains gear/change-scorer access
  const matchOrganizerId = typeof match.organizerId === 'object' ? match.organizerId?._id : match.organizerId;
  const isMatchOrganizer = String(matchOrganizerId) === String(currentUser?._id);
  const tournamentOrganizerId = match.tournament?.organizer?._id || match.tournament?.organizer;
  const isTournamentOrganizer = String(tournamentOrganizerId) === String(currentUser?._id);
  const isTournamentCoOrganizer = match.tournament?.coOrganizers?.some(s => String(s?._id || s) === String(currentUser?._id));
  const isTournamentScorer = match.tournament?.scorers?.some(s => String(s?._id || s) === String(currentUser?._id));

  const isScorer = isCreator || isMatchOrganizer || isTournamentOrganizer || isTournamentCoOrganizer || isTournamentScorer || match.scorers?.some(s => {
    const sId = s && typeof s === 'object' ? (s.userId ? (s.userId._id || s.userId) : s._id) : s;
    return String(sId) === String(currentUser?._id);
  });

  const activeScorerId =
    (typeof match.activeScorerId === 'object' ? match.activeScorerId?._id : match.activeScorerId) ||
    creatorId ||
    (typeof match.organizerId === 'object' ? match.organizerId?._id : match.organizerId);
  const isActiveScorer = String(activeScorerId) === String(currentUser?._id);

  const runs = score?.runs || 0;
  const wickets = score?.wickets || 0;
  const overs = score?.overs || '0.0';

  const getTossWinnerName = () => {
    if (!match.toss?.winner) return '';
    if (match.toss.winner === match.teamA?._id) return match.teamA?.name;
    if (match.toss.winner === match.teamB?._id) return match.teamB?.name;
    return match.toss.winner.name || 'A Team';
  };

  const getShotPosition = (angle, isIndoor) => {
    if (angle === null || angle === undefined) return '';

    // Rotate angle by 180 degrees to match the inverted UI where DOWN is STRAIGHT
    let adjustedAngle = angle + 180;
    if (adjustedAngle > 180) adjustedAngle -= 360;

    if (isIndoor) {
      if (adjustedAngle >= -135 && adjustedAngle < -45) return 'V (Straight)';
      if ((adjustedAngle >= -180 && adjustedAngle < -135) || (adjustedAngle >= 135 && adjustedAngle <= 180)) return 'Leg Side';
      if (adjustedAngle >= -45 && adjustedAngle < 45) return 'Off Side';
      if (adjustedAngle >= 45 && adjustedAngle < 135) return 'Behind Wickets';
      return '';
    } else {
      // More precise Open Ground positions
      if (adjustedAngle >= -105 && adjustedAngle < -75) return 'Straight Down the Ground';
      if (adjustedAngle >= -75 && adjustedAngle < -30) return 'Long Off / Extra Cover';
      if (adjustedAngle >= -30 && adjustedAngle < 15) return 'Point / Cover';
      if (adjustedAngle >= 15 && adjustedAngle < 50) return 'Backward Point / Short Third Man';
      if (adjustedAngle >= 50 && adjustedAngle < 80) return 'Third Man';
      if (adjustedAngle >= 80 && adjustedAngle < 100) return 'Fine Leg / Behind Wickets';
      if (adjustedAngle >= 100 && adjustedAngle < 135) return 'Deep Fine Leg / Backward Square Leg';
      if (adjustedAngle >= 135 && adjustedAngle < 165) return 'Square Leg';
      if ((adjustedAngle >= 165 && adjustedAngle <= 180) || (adjustedAngle >= -180 && adjustedAngle < -165)) return 'Mid Wicket';
      if (adjustedAngle >= -165 && adjustedAngle < -135) return 'Cow Corner / Deep Mid Wicket';
      if (adjustedAngle >= -135 && adjustedAngle < -105) return 'Long On / Mid On';
      return '';
    }
  };

  const confirmDeclareResult = (resultType, teamId, teamName) => {
    let title = '';
    let message = '';

    if (resultType === 'walkover') {
      title = 'Confirm Walkover';
      message = `Are you sure you want to declare a walkover to ${teamName}? They will be awarded 2 points.`;
    } else if (resultType === 'tie') {
      title = 'Confirm Match Drawn';
      message = 'Are you sure you want to declare this match as drawn? Both teams will receive 1 point.';
    } else if (resultType === 'abandoned') {
      title = 'Confirm Abandon Match';
      message = 'Are you sure you want to abandon this match? Both teams will receive 1 point.';
    }

    setDeclareConfirmation({ visible: true, title, message, resultType, teamId });
  };

  const executeDeclareResult = () => {
    if (declareConfirmation) {
      handleDeclareResult(declareConfirmation.resultType, declareConfirmation.teamId);
      setDeclareConfirmation(null);
    }
  };

  const handleDeclareResult = async (resultType, winnerTeamId = null) => {
    try {
      setDeclareResultModalVisible(false);
      const res = await api.put(`/matches/${matchId}/declare-result`, { resultType, winnerTeamId });
      if (res.data.success) {
        showCustomAlert('Success', 'Match result has been declared.');
        onRefresh();
      }
    } catch (e) {
      console.log('Error declaring result', e);
      showCustomAlert('Error', e.response?.data?.message || 'Failed to declare result');
    }
  };

  const handleShareReport = () => {
    setActivePosterType('aiReport');
  };

  const handleCopyReport = async () => {
    if (!aiReport) return;
    try {
      const Clipboard = require('@react-native-clipboard/clipboard').default;
      Clipboard.setString(aiReport.summary);
      showCustomAlert('Success', 'Match report copied to clipboard!');
    } catch (e) {
      // Fallback
      try {
        await Share.share({ message: aiReport.summary });
      } catch (err) { }
    }
  };

  const renderAIReport = () => {
    const renderSubTabs = () => {
      if (!userPlayed) return null;
      return (
        <View style={{ flexDirection: 'row', width: '100%', marginBottom: 20, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <TouchableOpacity
            onPress={() => setAiReportSubTab('individual')}
            style={{
              flex: 1,
              paddingVertical: 12,
              alignItems: 'center',
              borderBottomWidth: 2,
              borderBottomColor: aiReportSubTab === 'individual' ? colors.primary : 'transparent'
            }}
          >
            <Text style={{
              color: aiReportSubTab === 'individual' ? colors.primary : colors.textSecondary,
              fontFamily: Typography.fontFamily.semiBold,
              fontSize: Typography.fontSize.sm
            }}>
              My Report
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setAiReportSubTab('team')}
            style={{
              flex: 1,
              paddingVertical: 12,
              alignItems: 'center',
              borderBottomWidth: 2,
              borderBottomColor: aiReportSubTab === 'team' ? colors.primary : 'transparent'
            }}
          >
            <Text style={{
              color: aiReportSubTab === 'team' ? colors.primary : colors.textSecondary,
              fontFamily: Typography.fontFamily.semiBold,
              fontSize: Typography.fontSize.sm
            }}>
              Team Report
            </Text>
          </TouchableOpacity>
        </View>
      );
    };

    if (userPlayed && aiReportSubTab === 'individual') {
      if (aiPlayerReportLoading && !aiPlayerReport) {
        return (
          <ScrollView
            contentContainerStyle={{ paddingBottom: 120, paddingTop: 16, paddingHorizontal: 16 }}
            style={{ backgroundColor: colors.background }}
            refreshControl={getRefreshControl()}
            showsVerticalScrollIndicator={false}
          >
            {renderSubTabs()}
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', minHeight: 200, padding: 32 }}>
              <ActivityIndicator size="small" color={colors.primary} style={{ marginBottom: 12 }} />
              <Text style={{ color: colors.textSecondary, fontFamily: Typography.fontFamily.medium, fontSize: Typography.fontSize.sm }}>
                Analyzing your match performance...
              </Text>
            </View>
          </ScrollView>
        );
      }

      if (aiPlayerReportError || (!aiPlayerReport && !aiPlayerReportLoading)) {
        return (
          <ScrollView
            contentContainerStyle={{ paddingBottom: 120, paddingTop: 16, paddingHorizontal: 16 }}
            style={{ backgroundColor: colors.background }}
            refreshControl={getRefreshControl()}
            showsVerticalScrollIndicator={false}
          >
            {renderSubTabs()}
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', minHeight: 250, padding: 32 }}>
              <Icon name="alert-circle-outline" size={32} color={colors.textSecondary} style={{ marginBottom: 16 }} />
              <Text style={{ color: colors.textPrimary, fontSize: Typography.fontSize.base, fontFamily: Typography.fontFamily.medium, textAlign: 'center', marginBottom: 8 }}>
                Individual Report Unavailable
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: Typography.fontSize.sm, fontFamily: Typography.fontFamily.regular, textAlign: 'center', marginBottom: 24 }}>
                We couldn't generate your coaching analysis at this time.
              </Text>
              <TouchableOpacity
                style={{ paddingHorizontal: 20, paddingVertical: 10, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: colors.border }}
                onPress={fetchAiPlayerReport}
              >
                <Text style={{ color: colors.textPrimary, fontFamily: Typography.fontFamily.medium, fontSize: Typography.fontSize.sm }}>
                  Retry
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        );
      }

      return (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 120, paddingTop: 16, paddingHorizontal: 16 }}
          style={{ backgroundColor: colors.background }}
          refreshControl={getRefreshControl()}
          showsVerticalScrollIndicator={false}
        >
          {renderSubTabs()}
          <View style={{ marginBottom: 24 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 6 }}>
              <Icon name="brain" size={14} color={colors.textSecondary} />
              <Text style={{ color: colors.textSecondary, fontSize: Typography.fontSize.xs, fontFamily: Typography.fontFamily.medium, textTransform: 'uppercase', letterSpacing: 1 }}>
                My Coaching Analysis
              </Text>
            </View>
            <Text style={{ color: colors.textPrimary, fontSize: Typography.fontSize['3xl'], fontFamily: Typography.fontFamily.bold, marginBottom: 4 }}>
              {currentUser.name}
            </Text>
          </View>

          <View style={{ padding: 18, backgroundColor: colors.surface, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: colors.border, marginBottom: 24 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <View>
                <Text style={{ color: colors.textTertiary, fontSize: Typography.fontSize.xs, fontFamily: Typography.fontFamily.bold, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  COACH RATING
                </Text>
                <Text style={{ color: colors.primary, fontSize: Typography.fontSize['3xl'], fontFamily: Typography.fontFamily.extraBold }}>
                  {aiPlayerReport.rating || 'N/A'}
                </Text>
              </View>
              <View style={{ backgroundColor: 'rgba(255,204,0,0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 }}>
                <Text style={{ color: colors.primary, fontSize: Typography.fontSize.xs, fontFamily: Typography.fontFamily.semiBold }}>
                  Personal Scorecard
                </Text>
              </View>
            </View>

            <Text style={{ color: colors.textPrimary, fontSize: Typography.fontSize.base, fontFamily: Typography.fontFamily.bold, marginBottom: 16, lineHeight: 22, fontStyle: 'italic' }}>
              "{aiPlayerReport.verdict}"
            </Text>

            <View style={{ height: 1, backgroundColor: colors.borderLight, marginVertical: 16 }} />

            {/* Batting Analysis */}
            {aiPlayerReport.battingAnalysis && aiPlayerReport.battingAnalysis !== 'Did not bat' && (
              <View style={{ marginBottom: 20 }}>
                <Text style={{ color: colors.textTertiary, fontSize: Typography.fontSize.xs, fontFamily: Typography.fontFamily.bold, textTransform: 'uppercase', marginBottom: 6 }}>
                  Batting Performance
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: Typography.fontSize.base, fontFamily: Typography.fontFamily.regular, lineHeight: 24 }}>
                  {aiPlayerReport.battingAnalysis}
                </Text>
              </View>
            )}

            {/* Bowling Analysis */}
            {aiPlayerReport.bowlingAnalysis && aiPlayerReport.bowlingAnalysis !== 'Did not bowl' && (
              <View style={{ marginBottom: 20 }}>
                <Text style={{ color: colors.textTertiary, fontSize: Typography.fontSize.xs, fontFamily: Typography.fontFamily.bold, textTransform: 'uppercase', marginBottom: 6 }}>
                  Bowling Performance
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: Typography.fontSize.base, fontFamily: Typography.fontFamily.regular, lineHeight: 24 }}>
                  {aiPlayerReport.bowlingAnalysis}
                </Text>
              </View>
            )}

            {/* Key Coaching Areas Divider */}
            {((aiPlayerReport.strengths && aiPlayerReport.strengths.length > 0) ||
              (aiPlayerReport.drawbacks && aiPlayerReport.drawbacks.length > 0) ||
              (aiPlayerReport.improvementSteps && aiPlayerReport.improvementSteps.length > 0)) && (
                <View style={{ height: 1, backgroundColor: colors.borderLight, marginVertical: 16 }} />
              )}

            {/* Key Strengths */}
            {aiPlayerReport.strengths && aiPlayerReport.strengths.length > 0 && (
              <View style={{ marginBottom: 20 }}>
                <Text style={{ color: '#4CAF50', fontSize: Typography.fontSize.xs, fontFamily: Typography.fontFamily.bold, textTransform: 'uppercase', marginBottom: 8, letterSpacing: 0.5 }}>
                  Key Strengths
                </Text>
                <View style={{ gap: 8 }}>
                  {aiPlayerReport.strengths.map((str, idx) => (
                    <View key={idx} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                      <Icon name="check-circle" size={16} color="#4CAF50" style={{ marginTop: 2 }} />
                      <Text style={{ color: colors.textSecondary, fontSize: Typography.fontSize.sm, fontFamily: Typography.fontFamily.medium, flex: 1, lineHeight: 20 }}>
                        {str}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Areas of Improvement (Drawbacks) */}
            {aiPlayerReport.drawbacks && aiPlayerReport.drawbacks.length > 0 && (
              <View style={{ marginBottom: 20 }}>
                <Text style={{ color: '#FF9800', fontSize: Typography.fontSize.xs, fontFamily: Typography.fontFamily.bold, textTransform: 'uppercase', marginBottom: 8, letterSpacing: 0.5 }}>
                  Areas to Improve
                </Text>
                <View style={{ gap: 8 }}>
                  {aiPlayerReport.drawbacks.map((dr, idx) => (
                    <View key={idx} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                      <Icon name="alert-circle" size={16} color="#FF9800" style={{ marginTop: 2 }} />
                      <Text style={{ color: colors.textSecondary, fontSize: Typography.fontSize.sm, fontFamily: Typography.fontFamily.medium, flex: 1, lineHeight: 20 }}>
                        {dr}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* How to Improve (Action Plan) */}
            {aiPlayerReport.improvementSteps && aiPlayerReport.improvementSteps.length > 0 && (
              <View style={{ marginBottom: 20 }}>
                <Text style={{ color: colors.primary, fontSize: Typography.fontSize.xs, fontFamily: Typography.fontFamily.bold, textTransform: 'uppercase', marginBottom: 8, letterSpacing: 0.5 }}>
                  Actionable Coach Advice
                </Text>
                <View style={{ gap: 8 }}>
                  {aiPlayerReport.improvementSteps.map((step, idx) => (
                    <View key={idx} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                      <Icon name="play-circle" size={16} color={colors.primary} style={{ marginTop: 2 }} />
                      <Text style={{ color: colors.textSecondary, fontSize: Typography.fontSize.sm, fontFamily: Typography.fontFamily.medium, flex: 1, lineHeight: 20 }}>
                        {step}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            <View style={{ height: 1, backgroundColor: colors.borderLight, marginVertical: 16 }} />

            {/* Key Takeaway */}
            {aiPlayerReport.keyTakeaway && (
              <View>
                <Text style={{ color: colors.textTertiary, fontSize: Typography.fontSize.xs, fontFamily: Typography.fontFamily.bold, textTransform: 'uppercase', marginBottom: 8 }}>
                  Coach Takeaway
                </Text>
                <View style={{ padding: 14, backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: BorderRadius.sm, borderWidth: 1, borderColor: colors.borderLight }}>
                  <Text style={{ color: colors.textSecondary, fontSize: Typography.fontSize.base, fontFamily: Typography.fontFamily.regular, lineHeight: 24, fontStyle: 'italic' }}>
                    {aiPlayerReport.keyTakeaway}
                  </Text>
                </View>
              </View>
            )}
          </View>
        </ScrollView>
      );
    }

    if (aiReportLoading && !aiReport) {
      return (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 120, paddingTop: 16, paddingHorizontal: 16 }}
          style={{ backgroundColor: colors.background }}
          refreshControl={getRefreshControl()}
          showsVerticalScrollIndicator={false}
        >
          {renderSubTabs()}
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', minHeight: 200, padding: 32 }}>
            <ActivityIndicator size="small" color={colors.primary} style={{ marginBottom: 16 }} />
            <Text style={{ color: colors.textPrimary, fontSize: Typography.fontSize.lg, fontFamily: Typography.fontFamily.semiBold, marginBottom: 8, textAlign: 'center' }}>
              Analyzing Match Data
            </Text>
            <Text style={{ color: colors.textTertiary, fontSize: Typography.fontSize.sm, fontFamily: Typography.fontFamily.regular, textAlign: 'center' }}>
              {progressMessages[progressMsgIdx]}
            </Text>
          </View>
        </ScrollView>
      );
    }

    if (aiReportError || (!aiReport && !aiReportLoading)) {
      return (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 120, paddingTop: 16, paddingHorizontal: 16 }}
          style={{ backgroundColor: colors.background }}
          refreshControl={getRefreshControl()}
          showsVerticalScrollIndicator={false}
        >
          {renderSubTabs()}
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', minHeight: 250, padding: 32 }}>
            <Icon name="alert-circle-outline" size={32} color={colors.textSecondary} style={{ marginBottom: 16 }} />
            <Text style={{ color: colors.textPrimary, fontSize: Typography.fontSize.base, fontFamily: Typography.fontFamily.medium, textAlign: 'center', marginBottom: 8 }}>
              Report Unavailable
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: Typography.fontSize.sm, fontFamily: Typography.fontFamily.regular, textAlign: 'center', marginBottom: 24 }}>
              We couldn't generate the match report at this time.
            </Text>
            <TouchableOpacity
              style={{ paddingHorizontal: 20, paddingVertical: 10, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: colors.border }}
              onPress={fetchAiReport}
            >
              <Text style={{ color: colors.textPrimary, fontFamily: Typography.fontFamily.medium, fontSize: Typography.fontSize.sm }}>
                Retry
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      );
    }

    return (
      <ScrollView
        contentContainerStyle={{ paddingBottom: 120, paddingTop: 16, paddingHorizontal: 16 }}
        style={{ backgroundColor: colors.background }}
        refreshControl={getRefreshControl()}
        showsVerticalScrollIndicator={false}
      >
        {renderSubTabs()}
        {/* ── Header Area ── */}
        <View style={{ marginBottom: 24 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 6 }}>
            <Icon name="brain" size={14} color={colors.textSecondary} />
            <Text style={{
              color: colors.textSecondary,
              fontSize: Typography.fontSize.xs,
              fontFamily: Typography.fontFamily.medium,
              textTransform: 'uppercase',
              letterSpacing: 1,
            }}>
              AI Match Analysis
            </Text>
          </View>
          <Text style={{
            color: colors.textPrimary,
            fontSize: Typography.fontSize['3xl'],
            fontFamily: Typography.fontFamily.bold,
            marginBottom: 4,
          }}>
            {teamA} vs {teamB}
          </Text>
          <Text style={{
            color: colors.textTertiary,
            fontSize: Typography.fontSize.sm,
            fontFamily: Typography.fontFamily.regular,
          }}>
            Generated {aiReport.generatedAt ? moment(aiReport.generatedAt).format('DD MMM YYYY, h:mm A') : 'recently'}
          </Text>
        </View>

        {/* ── Action Buttons ── */}
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 32 }}>
          <TouchableOpacity
            style={{
              flex: 1,
              borderWidth: 1,
              borderColor: colors.border,
              paddingVertical: 12,
              borderRadius: BorderRadius.md,
              flexDirection: 'row',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 8,
              backgroundColor: colors.surface,
            }}
            onPress={handleCopyReport}
          >
            <Icon name="content-copy" size={16} color={colors.textPrimary} />
            <Text style={{
              color: colors.textPrimary,
              fontFamily: Typography.fontFamily.medium,
              fontSize: Typography.fontSize.sm,
            }}>
              Copy Text
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{
              flex: 1,
              backgroundColor: colors.primary,
              paddingVertical: 12,
              borderRadius: BorderRadius.md,
              flexDirection: 'row',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 8,
            }}
            onPress={handleShareReport}
          >
            <Icon name="share-variant" size={16} color="#000" />
            <Text style={{
              color: '#000',
              fontFamily: Typography.fontFamily.medium,
              fontSize: Typography.fontSize.sm,
            }}>
              Share Report
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Headlines ── */}
        {aiReport.headline && aiReport.headline.length > 0 && (
          <View style={{ marginBottom: 32 }}>
            <Text style={{
              color: colors.textPrimary,
              fontSize: Typography.fontSize.md,
              fontFamily: Typography.fontFamily.semiBold,
              marginBottom: 16,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}>
              Key Highlights
            </Text>
            <View style={{ gap: 12 }}>
              {aiReport.headline.map((hl, idx) => (
                <View key={idx} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                  <View style={{ width: 4, height: '100%', backgroundColor: colors.primary, borderRadius: 2 }} />
                  <Text style={{
                    color: colors.textSecondary,
                    fontSize: Typography.fontSize.base,
                    fontFamily: Typography.fontFamily.regular,
                    flex: 1,
                    lineHeight: 24,
                  }}>
                    {hl}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={{ height: 1, backgroundColor: colors.borderLight, marginBottom: 32 }} />

        {/* ── Match Report Summary ── */}
        <View style={{ marginBottom: 32 }}>
          <Text style={{
            color: colors.textPrimary,
            fontSize: Typography.fontSize.md,
            fontFamily: Typography.fontFamily.semiBold,
            marginBottom: 16,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}>
            Match Summary
          </Text>
          <Text style={{
            color: colors.textSecondary,
            fontSize: Typography.fontSize.base,
            fontFamily: Typography.fontFamily.regular,
            lineHeight: 26,
          }}>
            {aiReport.summary}
          </Text>
        </View>

        {/* ── Player Spotlight ── */}
        {aiReport.playerSpotlight && (
          <>
            <View style={{ height: 1, backgroundColor: colors.borderLight, marginBottom: 32 }} />
            <View style={{ marginBottom: 32 }}>
              <Text style={{
                color: colors.textPrimary,
                fontSize: Typography.fontSize.md,
                fontFamily: Typography.fontFamily.semiBold,
                marginBottom: 16,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}>
                Player Spotlight
              </Text>
              <Text style={{
                color: colors.textSecondary,
                fontSize: Typography.fontSize.base,
                fontFamily: Typography.fontFamily.regular,
                lineHeight: 26,
              }}>
                {aiReport.playerSpotlight}
              </Text>
            </View>
          </>
        )}

        {/* ── Key Moments ── */}
        {aiReport.keyMoments && aiReport.keyMoments.length > 0 && (
          <>
            <View style={{ height: 1, backgroundColor: colors.borderLight, marginBottom: 32 }} />
            <View style={{ marginBottom: 32 }}>
              <Text style={{
                color: colors.textPrimary,
                fontSize: Typography.fontSize.md,
                fontFamily: Typography.fontFamily.semiBold,
                marginBottom: 16,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}>
                Critical Moments
              </Text>
              <View style={{ gap: 16 }}>
                {aiReport.keyMoments.map((moment, idx) => (
                  <View key={idx} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 16 }}>
                    <Text style={{
                      color: colors.textTertiary,
                      fontSize: Typography.fontSize.sm,
                      fontFamily: Typography.fontFamily.semiBold,
                      marginTop: 2,
                    }}>
                      {String(idx + 1).padStart(2, '0')}
                    </Text>
                    <Text style={{
                      color: colors.textSecondary,
                      fontSize: Typography.fontSize.base,
                      fontFamily: Typography.fontFamily.regular,
                      flex: 1,
                      lineHeight: 24,
                    }}>
                      {moment}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </>
        )}

        {/* ── Match Awards ── */}
        {aiReport.awards && aiReport.awards.length > 0 && (
          <>
            <View style={{ height: 1, backgroundColor: colors.borderLight, marginBottom: 32 }} />
            <View style={{ marginBottom: 32 }}>
              <Text style={{
                color: colors.textPrimary,
                fontSize: Typography.fontSize.md,
                fontFamily: Typography.fontFamily.semiBold,
                marginBottom: 16,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}>
                Top Performers
              </Text>
              <View style={{ gap: 20 }}>
                {aiReport.awards.map((award, idx) => (
                  <View key={idx}>
                    <Text style={{
                      color: colors.textPrimary,
                      fontSize: Typography.fontSize.sm,
                      fontFamily: Typography.fontFamily.semiBold,
                      marginBottom: 4,
                    }}>
                      {award.title} • {award.winner}
                    </Text>
                    <Text style={{
                      color: colors.textSecondary,
                      fontSize: Typography.fontSize.sm,
                      fontFamily: Typography.fontFamily.regular,
                      lineHeight: 22,
                    }}>
                      {award.description}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </>
        )}

        {/* ── Fun Facts & Insights ── */}
        {aiReport.funFacts && aiReport.funFacts.length > 0 && (
          <>
            <View style={{ height: 1, backgroundColor: colors.borderLight, marginBottom: 32 }} />
            <View style={{ marginBottom: 32 }}>
              <Text style={{
                color: colors.textPrimary,
                fontSize: Typography.fontSize.md,
                fontFamily: Typography.fontFamily.semiBold,
                marginBottom: 16,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}>
                Analysis Insights
              </Text>
              <View style={{ gap: 12 }}>
                {aiReport.funFacts.map((fact, idx) => (
                  <View key={idx} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                    <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: colors.textTertiary, marginTop: 10 }} />
                    <Text style={{
                      color: colors.textSecondary,
                      fontSize: Typography.fontSize.base,
                      fontFamily: Typography.fontFamily.regular,
                      flex: 1,
                      lineHeight: 24,
                    }}>
                      {fact}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </>
        )}

        {/* Bottom disclaimer */}
        <View style={{ marginTop: 16, flexDirection: 'row', gap: 8, padding: 16, backgroundColor: colors.surface, borderRadius: BorderRadius.md }}>
          <Icon name="information-outline" size={16} color={colors.textTertiary} />
          <Text style={{
            color: colors.textTertiary,
            fontSize: Typography.fontSize.sm,
            fontFamily: Typography.fontFamily.regular,
            flex: 1,
            lineHeight: 20,
          }}>
            This match summary is generated automatically by artificial intelligence using the scorecard data. It may not reflect exact real-world events.
          </Text>
        </View>
      </ScrollView>
    );
  };

  const handleContinue = async () => {
    if (match.status === 'scheduled') {
      navigation.navigate('My Cricket', { screen: 'MatchSetup', params: { matchId: match._id, matchData: match, tournamentDetails: match.tournament } });
    } else if (match.status === 'toss_done') {
      try {
        await api.post(`/matches/${match._id}/start-innings`, { inningsNumber: 1 });
      } catch (e) { } // ignore if already started
      navigation.navigate('My Cricket', { screen: 'LiveScorer', params: { matchId: match._id } });
    } else {
      navigation.navigate('My Cricket', { screen: 'LiveScorer', params: { matchId: match._id } });
    }
  };

  const renderTabHeader = () => {
    return (
      <ScrollView ref={headerScrollRef} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsRow}>
        {dynamicTabs.map(tab => (
          <TouchableOpacity
            key={tab}
            onPress={() => handleTabPress(tab)}
            style={[styles.tabItem, activeTab === tab && styles.tabItemActive]}
            activeOpacity={0.75}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  };

  const renderMatchDetails = () => {
    const formatTimeOnly = (dateVal) => {
      if (!dateVal) return '--:--';
      const d = new Date(dateVal);
      return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    };

    const m = liveState?.match || match;
    const innList = m.innings || [];

    // Innings times
    const inn1Start = innList[0]?.createdAt ? formatTimeOnly(innList[0].createdAt) : '--:--';
    const inn1End = innList[0]?.status === 'completed' && innList[0]?.updatedAt ? formatTimeOnly(innList[0].updatedAt) : (innList[0] ? 'In Progress' : '--:--');

    const inn2Start = innList[1]?.createdAt ? formatTimeOnly(innList[1].createdAt) : '--:--';
    const inn2End = innList[1]?.status === 'completed' && innList[1]?.updatedAt ? formatTimeOnly(innList[1].updatedAt) : (innList[1] ? 'In Progress' : '--:--');

    // Super Over Innings (Innings 3 and 4)
    const superOverInn1 = innList.find(i => i.inningsNumber === 3);
    const superOverInn2 = innList.find(i => i.inningsNumber === 4);

    const superInn1Start = superOverInn1?.createdAt ? formatTimeOnly(superOverInn1.createdAt) : '--:--';
    const superInn1End = superOverInn1?.status === 'completed' && superOverInn1?.updatedAt ? formatTimeOnly(superOverInn1.updatedAt) : (superOverInn1 ? 'In Progress' : '--:--');

    const superInn2Start = superOverInn2?.createdAt ? formatTimeOnly(superOverInn2.createdAt) : '--:--';
    const superInn2End = superOverInn2?.status === 'completed' && superOverInn2?.updatedAt ? formatTimeOnly(superOverInn2.updatedAt) : (superOverInn2 ? 'In Progress' : '--:--');

    // Scorer transfer history
    const history = m.scorerHistory || [];

    // ── INNINGS TIMINGS ──
    const hasAnyInnings = innList.length > 0;

    return (
      <ScrollView contentContainerStyle={styles.content} refreshControl={getRefreshControl()}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Match Info</Text>
          <View style={styles.infoRow}><Text style={styles.infoLabel}>Match</Text><Text style={styles.infoValue}>{teamA} vs {teamB}</Text></View>
          {m.tournament && m.tournament.name && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Tournament</Text>
              <TouchableOpacity onPress={() => navigation.navigate('TournamentDetail', { tournamentId: m.tournament._id })}>
                <Text style={[styles.infoValue, { color: colors.primary }]}>
                  {m.tournament.name}
                </Text>
              </TouchableOpacity>
            </View>
          )}
          <View style={styles.infoRow}><Text style={styles.infoLabel}>Date</Text><Text style={styles.infoValue}>{dateStr}</Text></View>
          <View style={styles.infoRow}><Text style={styles.infoLabel}>Format</Text><Text style={styles.infoValue}>{formatStr}</Text></View>
          <View style={styles.infoRow}><Text style={styles.infoLabel}>Ball Type</Text><Text style={styles.infoValue}>{m.ballType}</Text></View>
          <View style={styles.infoRow}><Text style={styles.infoLabel}>Pitch Type</Text><Text style={styles.infoValue}>{m.pitchType}</Text></View>
        </View>

        {/* ── TOSS DETAILS ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Toss Details</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Toss Winner</Text>
            <Text style={styles.infoValue}>
              {m.toss?.winner ? (m.toss.winner.name || getTossWinnerName()) : 'Not Done'}
            </Text>
          </View>
          {m.toss?.winner && (
            <>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Decision</Text>
                <Text style={[styles.infoValue, { textTransform: 'capitalize' }]}>{m.toss.choice === 'bat' ? 'Batting First' : 'Bowling First'}</Text>
              </View>
              {m.tossDoneAt && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Toss Time</Text>
                  <Text style={styles.infoValue}>{formatTimeOnly(m.tossDoneAt)}</Text>
                </View>
              )}
            </>
          )}
        </View>

        {/* ── SCORER DETAILS ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Match Scorer</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Active Scorer</Text>
            <Text style={[styles.infoValue, { color: colors.primary, fontFamily: Typography.fontFamily.bold }]}>
              {m.activeScorerId?.name || 'Creator'}
            </Text>
          </View>
          {history.length > 1 && (
            <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: colors.borderLight, paddingTop: 10 }}>
              <Text style={[styles.infoLabel, { marginBottom: 6, fontSize: 11, fontFamily: Typography.fontFamily.bold, color: colors.primary }]}>Scoring Transfer History</Text>
              {history.map((h, i) => (
                <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
                  <Text style={{ color: colors.textSecondary, fontSize: 12, fontFamily: Typography.fontFamily.medium }}>
                    {i === 0 ? '🏆 Initial Scorer' : `➡️ Transferred to ${h.name}`}
                  </Text>
                  <Text style={{ color: colors.textTertiary, fontSize: 11, fontFamily: Typography.fontFamily.regular }}>
                    {formatTimeOnly(h.changedAt)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* ── INNINGS TIMINGS (Only display if at least one innings has started) ── */}
        {hasAnyInnings && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Innings Timings</Text>
            {innList[0] && (
              <View style={styles.timelineRow}>
                <View style={styles.timelinePoint}>
                  <Text style={styles.timelineLabel}>1st Innings</Text>
                  <Text style={styles.timelineTime}>Start: {inn1Start}  |  End: {inn1End}</Text>
                </View>
              </View>
            )}
            {innList[1] && (
              <View style={styles.timelineRow}>
                <View style={styles.timelinePoint}>
                  <Text style={styles.timelineLabel}>2nd Innings</Text>
                  <Text style={styles.timelineTime}>Start: {inn2Start}  |  End: {inn2End}</Text>
                </View>
              </View>
            )}

            {/* Super Over Timings (Only if Super Over was played) */}
            {(superOverInn1 || superOverInn2) && (
              <View style={{ marginTop: 14, borderTopWidth: 1, borderTopColor: colors.borderLight, paddingTop: 12 }}>
                <Text style={[styles.sectionTitle, { color: colors.primary, fontSize: 12 }]}>Super Over Timings</Text>
                {superOverInn1 && (
                  <View style={styles.timelineRow}>
                    <View style={styles.timelinePoint}>
                      <Text style={[styles.timelineLabel, { color: colors.primary }]}>Super Over - 1st Innings</Text>
                      <Text style={styles.timelineTime}>Start: {superInn1Start}  |  End: {superInn1End}</Text>
                    </View>
                  </View>
                )}
                {superOverInn2 && (
                  <View style={styles.timelineRow}>
                    <View style={styles.timelinePoint}>
                      <Text style={[styles.timelineLabel, { color: colors.primary }]}>Super Over - 2nd Innings</Text>
                      <Text style={styles.timelineTime}>Start: {superInn2Start}  |  End: {superInn2End}</Text>
                    </View>
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Venue</Text>
          <View style={styles.infoRow}><Text style={styles.infoLabel}>Ground</Text><Text style={styles.infoValue}>{m.venue?.name || m.ground || 'N/A'}</Text></View>
          <View style={styles.infoRow}><Text style={styles.infoLabel}>City</Text><Text style={styles.infoValue}>{m.venue?.city || m.city || 'N/A'}</Text></View>
        </View>
      </ScrollView>
    );
  };

  const renderSummary = () => {
    if (match.status === 'abandoned') {
      return (
        <ScrollView contentContainerStyle={styles.content} refreshControl={getRefreshControl()}>
          <View style={[styles.section, { alignItems: 'center', paddingVertical: 48 }]}>
            <Icon name="alert-circle" size={56} color={colors.error || '#D32F2F'} style={{ marginBottom: 16 }} />
            <Text style={{ color: colors.error || '#D32F2F', fontFamily: Typography.fontFamily.bold, fontSize: 20, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 1 }}>
              Match Abandoned
            </Text>
            <Text style={{ color: colors.textPrimary, fontFamily: Typography.fontFamily.semiBold, fontSize: 16, textAlign: 'center', marginTop: 12 }}>
              {teamA} vs {teamB}
            </Text>
          </View>
        </ScrollView>
      );
    }

    if (loadingScorecards) {
      return (
        <ScrollView contentContainerStyle={styles.content}>
          <SkeletonPlaceholder backgroundColor={colors.backgroundElevated} highlightColor={colors.surfaceVariant}>
            {/* Header Section (Scores & Result) */}
            <View style={[styles.section, { paddingBottom: 16, paddingTop: 16 }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  {/* Team 1 Score */}
                  <View style={{ marginBottom: 12 }}>
                    <View style={{ width: 100, height: 16, borderRadius: 4, marginBottom: 8 }} />
                    <View style={{ width: 140, height: 26, borderRadius: 6 }} />
                  </View>
                  {/* Team 2 Score */}
                  <View style={{ marginBottom: 12 }}>
                    <View style={{ width: 100, height: 16, borderRadius: 4, marginBottom: 8 }} />
                    <View style={{ width: 140, height: 26, borderRadius: 6 }} />
                  </View>
                </View>
                {/* Result Label */}
                <View style={{ width: 50, height: 24, borderRadius: 12, marginLeft: 16 }} />
              </View>

              {/* Match Summary text */}
              <View style={{ width: '80%', height: 16, borderRadius: 4, marginTop: 8 }} />

              {/* Views Row */}
              <View style={{ flexDirection: 'row', marginTop: 12, borderTopWidth: 0.5, borderTopColor: colors.border, paddingTop: 12, gap: 12 }}>
                <View style={{ width: 60, height: 14, borderRadius: 4 }} />
                <View style={{ width: 80, height: 14, borderRadius: 4 }} />
              </View>

              {/* Leaderboard Button */}
              <View style={{ width: '100%', height: 44, borderRadius: 8, marginTop: 16 }} />
            </View>

            {/* Heroes of the Match Section */}
            <View style={{ paddingHorizontal: Spacing.md, marginBottom: 14 }}>
              <View style={{ width: 150, height: 18, borderRadius: 4, marginBottom: 16 }} />

              {/* MVP Big Card */}
              <View style={{ width: '100%', height: 200, borderRadius: 16, marginBottom: 16 }} />

              {/* Other Heroes (2 Col) */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <View style={{ width: '48.5%', height: 120, borderRadius: 16 }} />
                <View style={{ width: '48.5%', height: 120, borderRadius: 16 }} />
              </View>
            </View>
          </SkeletonPlaceholder>
        </ScrollView>
      );
    }

    const getPlayerPhotoUrl = (p) => {
      if (!p) return null;
      const photo = p.photo || p.user?.photo || p.userId?.photo || p.avatar || p.profileImage || p.image || p.user?.avatar || p.profilePic;
      if (photo) return getImageUrl(photo);
      return null;
    };

    const isTeamABatting = match.battingTeam?.toString() === match.teamA?._id?.toString() || liveState?.battingTeam?.toString() === match.teamA?._id?.toString();
    const currentBattingName = isTeamABatting ? teamA : teamB;

    // Calculate best performers
    let bestBatter = null;
    let bestBowler = null;
    let mvp = null;
    let topBatters = [];
    let topBowlers = [];
    let fighterOfTheMatch = null;
    let fighterStats = null;

    if (match.status === 'completed' && scorecards?.length > 0) {
      const allBatters = scorecards.flatMap(sc => {
        const tName = sc.battingTeam?.name || (sc.battingTeam === match.teamA?._id ? match.teamA?.name : match.teamB?.name);
        return sc.batting.map(b => ({ ...b, teamName: tName }));
      }).filter(b => b.player);

      if (allBatters.length > 0) {
        topBatters = [...allBatters].sort((a, b) => b.runs - a.runs).slice(0, 2);
        bestBatter = topBatters[0];
      }

      const allBowlers = scorecards.flatMap(sc => {
        const tName = sc.bowlingTeam?.name || (sc.bowlingTeam === match.teamA?._id ? match.teamA?.name : match.teamB?.name);
        return sc.bowling.map(b => ({ ...b, teamName: tName }));
      }).filter(b => b.player);

      if (allBowlers.length > 0) {
        topBowlers = [...allBowlers].sort((a, b) => {
          if (b.wickets !== a.wickets) return b.wickets - a.wickets;
          return a.economy - b.economy;
        }).slice(0, 2);
        bestBowler = topBowlers[0];
      }

      if (match.result?.winner) {
        const losingTeamId = match.result.winner === match.teamA?._id ? match.teamB?._id : match.teamA?._id;
        const losingTeamName = match.result.winner === match.teamA?._id ? match.teamB?.name : match.teamA?.name;

        const losingBatters = scorecards.find(sc => sc.battingTeam?._id === losingTeamId || sc.battingTeam === losingTeamId)?.batting?.filter(b => b.player) || [];
        const losingBowlers = scorecards.find(sc => sc.bowlingTeam?._id === losingTeamId || sc.bowlingTeam === losingTeamId)?.bowling?.filter(b => b.player) || [];

        const bestLosingBatter = losingBatters.length > 0 ? [...losingBatters].sort((a, b) => b.runs - a.runs)[0] : null;
        const bestLosingBowler = losingBowlers.length > 0 ? [...losingBowlers].sort((a, b) => {
          if (b.wickets !== a.wickets) return b.wickets - a.wickets;
          return a.economy - b.economy;
        })[0] : null;

        if (bestLosingBatter && bestLosingBowler) {
          if (bestLosingBowler.wickets >= 3) {
            fighterOfTheMatch = bestLosingBowler.player;
            fighterStats = { type: 'bowler', data: bestLosingBowler, teamName: losingTeamName };
          } else {
            fighterOfTheMatch = bestLosingBatter.player;
            fighterStats = { type: 'batter', data: bestLosingBatter, teamName: losingTeamName };
          }
        } else if (bestLosingBatter) {
          fighterOfTheMatch = bestLosingBatter.player;
          fighterStats = { type: 'batter', data: bestLosingBatter, teamName: losingTeamName };
        } else if (bestLosingBowler) {
          fighterOfTheMatch = bestLosingBowler.player;
          fighterStats = { type: 'bowler', data: bestLosingBowler, teamName: losingTeamName };
        }
      }

      if (match.playerOfMatch) {
        if (typeof match.playerOfMatch === 'object' && match.playerOfMatch.name) {
          mvp = match.playerOfMatch;
        } else {
          const mvpId = String(typeof match.playerOfMatch === 'object' ? match.playerOfMatch._id : match.playerOfMatch);
          const allXI = [...(match.playingXI?.teamA || []), ...(match.playingXI?.teamB || [])];
          mvp = allXI.find(p => String(p._id || p) === mvpId);

          if (!mvp) {
            const scorecardPlayers = scorecards.flatMap(sc => [
              ...(sc.batting || []).map(b => b.player),
              ...(sc.bowling || []).map(b => b.player)
            ]).filter(Boolean);
            mvp = scorecardPlayers.find(p => String(p._id || p) === mvpId);
          }
        }
      }

      if (!mvp) {
        // Fallback: Pick highest performer from winning team
        if (match.result?.winner) {
          const winningTeamId = String(match.result.winner._id || match.result.winner);
          const winningBatters = scorecards.find(sc => String(sc.battingTeam?._id || sc.battingTeam) === winningTeamId)?.batting?.filter(b => b.player) || [];
          const winningBowlers = scorecards.find(sc => String(sc.bowlingTeam?._id || sc.bowlingTeam) === winningTeamId)?.bowling?.filter(b => b.player) || [];

          const topWinningBatter = winningBatters.length > 0 ? [...winningBatters].sort((a, b) => b.runs - a.runs)[0] : null;
          const topWinningBowler = winningBowlers.length > 0 ? [...winningBowlers].sort((a, b) => b.wickets - a.wickets)[0] : null;

          if (topWinningBowler && topWinningBowler.wickets >= 2) {
            mvp = topWinningBowler.player;
          } else if (topWinningBatter) {
            mvp = topWinningBatter.player;
          }
        }
        if (!mvp) {
          mvp = bestBatter?.player || bestBowler?.player;
        }
      }
    }

    const renderPerformerCard = (title, titleIcon, accentColor, player, statsText, subText, isNotOut = false, fallbackImage = FALLBACK_BATTER) => {
      return (
        <TouchableOpacity
          activeOpacity={0.82}
          onPress={() => setSelectedPlayerPreview(player)}
          style={{
            width: '48.5%',
            marginBottom: 10,
            borderRadius: 16,
            overflow: 'hidden',
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            elevation: 6,
            shadowColor: accentColor,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.2,
            shadowRadius: 8,
          }}
        >
          <View style={{ height: 160, backgroundColor: colors.backgroundElevated, overflow: 'hidden' }}>
            {getPlayerPhotoUrl(player) ? (
              <Image source={{ uri: getPlayerPhotoUrl(player) }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
            ) : (
              <Image source={fallbackImage} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
            )}
          </View>
          <View style={{ padding: 10, paddingTop: 7 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 }}>
              <Icon name={titleIcon} size={10} color={accentColor} />
              <Text style={{ color: accentColor, fontFamily: Typography.fontFamily.bold, fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.8 }}>{title}</Text>
            </View>
            <Text style={{ color: colors.textPrimary, fontFamily: Typography.fontFamily.bold, fontSize: 13 }} numberOfLines={1}>
              {player?.name}{isNotOut ? ' *' : ''}
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 10, marginTop: 1 }} numberOfLines={1}>{subText}</Text>
            <View style={{ height: 1, backgroundColor: `${accentColor}28`, marginVertical: 6 }} />
            <Text style={{ color: accentColor, fontFamily: Typography.fontFamily.bold, fontSize: 14 }}>{statsText}</Text>
          </View>
        </TouchableOpacity>
      );
    };

    return (
      <ScrollView contentContainerStyle={styles.content} refreshControl={getRefreshControl()}>
        {/* Live Broadcast / Replay / Start Telecast section removed */}

        {match.status === 'completed' ? (
          <View>
            {/* Header Section (Scores & Result) */}
            <View style={[styles.section, { paddingBottom: 16, paddingTop: 16 }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  {(!scorecards || scorecards.length === 0) ? (
                    <>
                      <View style={{ marginBottom: 12 }}>
                        <Text style={{ color: colors.textSecondary, fontFamily: Typography.fontFamily.semiBold, fontSize: 14, marginBottom: 4 }}>
                          {match.teamA?.name || 'Team A'}
                        </Text>
                        <Text style={{ color: colors.textPrimary, fontFamily: Typography.fontFamily.bold, fontSize: 22 }}>
                          0/0 <Text style={{ color: colors.textSecondary, fontSize: 14, fontWeight: 'normal' }}>(0.0 Ov)</Text>
                        </Text>
                      </View>
                      <View style={{ marginBottom: 12 }}>
                        <Text style={{ color: colors.textSecondary, fontFamily: Typography.fontFamily.semiBold, fontSize: 14, marginBottom: 4 }}>
                          {match.teamB?.name || 'Team B'}
                        </Text>
                        <Text style={{ color: colors.textPrimary, fontFamily: Typography.fontFamily.bold, fontSize: 22 }}>
                          0/0 <Text style={{ color: colors.textSecondary, fontSize: 14, fontWeight: 'normal' }}>(0.0 Ov)</Text>
                        </Text>
                      </View>
                    </>
                  ) : scorecards.map((sc, idx) => {
                    const teamName = sc.battingTeam?.name || (sc.battingTeam === match.teamA?._id ? match.teamA?.name : match.teamB?.name);
                    return (
                      <View key={idx} style={{ marginBottom: 12 }}>
                        <Text style={{ color: colors.textSecondary, fontFamily: Typography.fontFamily.semiBold, fontSize: 14, marginBottom: 4 }}>
                          {teamName}{sc.inningsNumber >= 3 ? ' (Super Over)' : ''}
                        </Text>
                        <Text style={{ color: colors.textPrimary, fontFamily: Typography.fontFamily.bold, fontSize: 22 }}>
                          {sc.total?.runs || 0}/{sc.total?.wickets || 0} <Text style={{ color: colors.textSecondary, fontSize: 14, fontWeight: 'normal' }}>({sc.total?.overs || '0.0'} Ov)</Text>
                        </Text>
                      </View>
                    );
                  })}
                </View>

                <View style={{ alignItems: 'flex-end', marginLeft: 16 }}>
                  <View style={{ backgroundColor: colors.surfaceDark, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    {(match?.isSuperOver || match?.status === 'super_over' || liveState?.isSuperOver) && (
                      <View style={{ backgroundColor: '#7B1FA2', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 3 }}>
                        <Text style={{ color: '#FFD54F', fontSize: 8, fontWeight: 'bold' }}>SUPER OVER</Text>
                      </View>
                    )}
                    <Text style={{ color: '#FFF', fontSize: 12, fontWeight: 'bold' }}>Result</Text>
                  </View>
                </View>
              </View>

              {match.result?.summary && (
                <Text style={{ color: colors.primary, fontFamily: Typography.fontFamily.bold, fontSize: 14, marginTop: 8 }}>
                  {match.result.summary}
                </Text>
              )}

              {/* Views Row */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, borderTopWidth: 0.5, borderTopColor: colors.border, paddingTop: 8, gap: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Icon name="eye-outline" size={14} color={colors.textTertiary} />
                  <Text style={{ color: colors.textSecondary, fontSize: 11 }}>{liveState?.views || match?.views || 0} Views</Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', marginTop: 16 }}>
                <TouchableOpacity
                  style={{ flex: 1, backgroundColor: colors.primaryAlpha20, paddingVertical: 12, borderRadius: 8, alignItems: 'center' }}
                  onPress={() => handleTabPress('Leaderboard')}
                >
                  <Text style={{ color: colors.primary, fontFamily: Typography.fontFamily.semiBold, fontSize: 14 }}>Leaderboard</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* ══════════ HEROES OF THE MATCH ══════════ */}
            {(bestBatter || bestBowler || mvp) && (
              <View style={{ marginBottom: 8 }}>
                {/* Section header */}
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, marginBottom: 14, gap: 8 }}>
                  <LinearGradient colors={[colors.warning, '#FF5722']} style={{ width: 3, height: 18, borderRadius: 2 }} />
                  <Text style={{ color: colors.textPrimary, fontFamily: Typography.fontFamily.bold, fontSize: 15, letterSpacing: 0.2 }}>Heroes of the Match</Text>
                  <Icon name="trophy" size={15} color={colors.warning} style={{ marginLeft: 2 }} />
                </View>

                {/* ── PLAYER OF THE MATCH ── Cinematic big card */}
                {mvp && (() => {
                  let mvpBattingStats = null;
                  let mvpBowlingStats = null;
                  if (scorecards?.length > 0) {
                    const mvpIdStr = String(mvp._id || mvp.id || mvp);
                    const allBatting = scorecards.flatMap(sc => sc.batting || []);
                    const allBowling = scorecards.flatMap(sc => sc.bowling || []);
                    mvpBattingStats = allBatting.find(b => String(b.player?._id || b.player?.id || b.player) === mvpIdStr);
                    mvpBowlingStats = allBowling.find(b => String(b.player?._id || b.player?.id || b.player) === mvpIdStr);
                  }
                  if (!mvpBattingStats && bestBatter && String(bestBatter.player?._id || bestBatter.player) === String(mvp._id || mvp)) {
                    mvpBattingStats = bestBatter;
                  }
                  if (!mvpBowlingStats && bestBowler && String(bestBowler.player?._id || bestBowler.player) === String(mvp._id || mvp)) {
                    mvpBowlingStats = bestBowler;
                  }

                  const mvpPhoto = getPlayerPhotoUrl(mvp);
                  return (
                    <TouchableOpacity
                      onPress={() => setSelectedPlayerPreview(mvp)}
                      activeOpacity={0.92}
                      style={{
                        marginHorizontal: Spacing.md,
                        marginBottom: 12,
                        borderRadius: 22,
                        overflow: 'hidden',
                        elevation: 10,
                        shadowColor: colors.warning,
                        shadowOffset: { width: 0, height: 6 },
                        shadowOpacity: 0.35,
                        shadowRadius: 14,
                      }}
                    >
                      <View style={{ height: 310, backgroundColor: colors.backgroundElevated }}>
                        {mvpPhoto ? (
                          <Image source={{ uri: mvpPhoto }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                        ) : (
                          <Image source={FALLBACK_POTM} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                        )}
                        {/* Gold badge strip at top */}
                        <LinearGradient colors={['rgba(0,0,0,0.75)', 'transparent']} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 }}>
                          <LinearGradient colors={[colors.warning, '#FF9800']} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, paddingVertical: 5, borderRadius: 20 }}>
                            <Icon name="star" size={11} color="#000" />
                            <Text style={{ color: '#000', fontFamily: Typography.fontFamily.bold, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 }}>Player of the Match</Text>
                          </LinearGradient>
                          <TouchableOpacity
                            onPress={(e) => {
                              e.stopPropagation();
                              setActivePosterType('motm');
                            }}
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: 16,
                              backgroundColor: 'rgba(0,0,0,0.5)',
                              justifyContent: 'center',
                              alignItems: 'center',
                            }}
                          >
                            <Icon name="share-variant" size={15} color="#FFF" />
                          </TouchableOpacity>
                        </LinearGradient>

                        {/* Bottom info overlay (light soft gradient) */}
                        <LinearGradient
                          colors={['transparent', 'rgba(0,0,0,0.45)', 'rgba(0,0,0,0.85)', 'rgba(0,0,0,0.98)']}
                          locations={[0, 0.28, 0.65, 1]}
                          style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 230, justifyContent: 'flex-end', padding: 18 }}
                          pointerEvents="box-none"
                        >
                          <Text style={{ color: '#FFF', fontFamily: Typography.fontFamily.bold, fontSize: 28, lineHeight: 32, letterSpacing: -0.3, textShadowColor: 'rgba(0, 0, 0, 1)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6 }}>{mvp.name}</Text>
                          <Text style={{ color: 'rgba(255,255,255,0.75)', fontFamily: Typography.fontFamily.medium, fontSize: 12, marginTop: 2, marginBottom: 14, textShadowColor: 'rgba(0, 0, 0, 1)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 }}>
                            {mvp.team?.name || (mvp._id && match.playingXI?.teamA?.some(p => p._id === mvp._id) ? match.teamA?.name : match.teamB?.name) || ''}
                          </Text>
                          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                            {mvpBattingStats && (mvpBattingStats.runs > 0 || mvpBattingStats.balls > 0) && (
                              <View style={{ backgroundColor: 'rgba(0,0,0,0.85)', borderWidth: 1, borderColor: `${colors.primary}88`, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8 }}>
                                <Text style={{ color: colors.primary, fontFamily: Typography.fontFamily.bold, fontSize: 16 }}>
                                  {mvpBattingStats.runs}<Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>({mvpBattingStats.balls})</Text>
                                </Text>
                                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10, marginTop: 1 }}>
                                  {mvpBattingStats.fours || 0}×4s · {mvpBattingStats.sixes || 0}×6s
                                </Text>
                              </View>
                            )}
                            {mvpBowlingStats && (mvpBowlingStats.overs > 0 || mvpBowlingStats.wickets > 0) && (
                              <View style={{ backgroundColor: 'rgba(0,0,0,0.85)', borderWidth: 1, borderColor: `${colors.info}88`, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8 }}>
                                <Text style={{ color: colors.info, fontFamily: Typography.fontFamily.bold, fontSize: 16 }}>
                                  {mvpBowlingStats.wickets}<Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>/{mvpBowlingStats.runs}</Text>
                                </Text>
                                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10, marginTop: 1 }}>
                                  {mvpBowlingStats.overs} ov
                                </Text>
                              </View>
                            )}
                          </View>
                        </LinearGradient>
                      </View>
                    </TouchableOpacity>
                  );
                })()}

                {/* ── FIGHTER OF THE MATCH ── Landscape banner */}
                {fighterOfTheMatch && fighterOfTheMatch._id !== mvp?._id && (
                  <TouchableOpacity
                    onPress={() => setSelectedPlayerPreview(fighterOfTheMatch)}
                    activeOpacity={0.85}
                    style={{
                      marginHorizontal: Spacing.md,
                      marginBottom: 12,
                      borderRadius: 18,
                      overflow: 'hidden',
                      elevation: 6,
                      shadowColor: '#FF4081',
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.25,
                      shadowRadius: 10,
                      flexDirection: 'row',
                      backgroundColor: colors.surface,
                      borderWidth: 1,
                      borderColor: isDark ? 'rgba(255,64,129,0.30)' : colors.border,
                      height: 120,
                    }}
                  >
                    <View style={{ width: 120, height: '100%', backgroundColor: colors.backgroundElevated }}>
                      {getPlayerPhotoUrl(fighterOfTheMatch) ? (
                        <Image source={{ uri: getPlayerPhotoUrl(fighterOfTheMatch) }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                      ) : (
                        <Image source={FALLBACK_FOTM} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                      )}
                      <LinearGradient colors={['transparent', colors.surface]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 44 }} />
                    </View>
                    <View style={{ flex: 1, paddingHorizontal: 14, paddingVertical: 12, justifyContent: 'space-between' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                        <Icon name="lightning-bolt" size={12} color="#FF4081" />
                        <Text style={{ color: '#FF4081', fontFamily: Typography.fontFamily.bold, fontSize: 9, textTransform: 'uppercase', letterSpacing: 1.2 }}>Fighter of the Match</Text>
                      </View>
                      <View>
                        <Text style={{ color: colors.textPrimary, fontFamily: Typography.fontFamily.bold, fontSize: 18, letterSpacing: -0.2 }} numberOfLines={1}>{fighterOfTheMatch?.name}</Text>
                        <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 1 }} numberOfLines={1}>{fighterStats?.teamName}</Text>
                      </View>
                      <View style={{ alignSelf: 'flex-start', backgroundColor: 'rgba(255,64,129,0.10)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(255,64,129,0.28)' }}>
                        <Text style={{ color: '#FF4081', fontFamily: Typography.fontFamily.bold, fontSize: 13 }}>
                          {fighterStats?.type === 'batter' ? `${fighterStats.data.runs}(${fighterStats.data.balls})` : `${fighterStats?.data.wickets}/${fighterStats?.data.runs}`}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                )}

                {/* ── TOP PERFORMERS ── 2-col grid */}
                {(topBatters.length > 0 || topBowlers.length > 0) && (
                  <View style={{ paddingHorizontal: Spacing.md }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10, marginTop: 4 }}>
                      <Icon name="chart-bar" size={12} color={colors.textSecondary} />
                      <Text style={{ color: colors.textSecondary, fontFamily: Typography.fontFamily.semiBold, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 }}>Top Performers</Text>
                    </View>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                      {topBatters.map((batter, index) => (
                        <React.Fragment key={`batter-${index}`}>
                          {renderPerformerCard('Top Batter', 'cricket', colors.primary, batter.player, `${batter.runs}(${batter.balls})`, batter.teamName, batter.isNotOut, FALLBACK_BATTER)}
                        </React.Fragment>
                      ))}
                      {topBowlers.map((bowler, index) => (
                        <React.Fragment key={`bowler-${index}`}>
                          {renderPerformerCard('Top Bowler', 'bowling', colors.info, bowler.player, `${bowler.wickets}/${bowler.runs}`, bowler.teamName, false, FALLBACK_BOWLER)}
                        </React.Fragment>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            )}
          </View>
        ) : (
          <>
            {/* Score Card */}
            <View style={styles.section}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                <Text style={{ fontSize: 16, fontFamily: Typography.fontFamily.semiBold }}>
                  <Text style={{ color: (match.status === 'scheduled' || match.status === 'toss_done' || isTeamABatting) ? colors.textPrimary : colors.textSecondary }}>{match?.teamA?.name}</Text>
                  <Text style={{ color: colors.textSecondary }}> vs </Text>
                  <Text style={{ color: (match.status === 'scheduled' || match.status === 'toss_done' || !isTeamABatting) ? colors.textPrimary : colors.textSecondary }}>{match?.teamB?.name}</Text>
                </Text>
                {(match?.isSuperOver || match?.status === 'super_over' || liveState?.isSuperOver) && (
                  <View style={{ marginLeft: 8, backgroundColor: colors.error, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                    <Text style={{ color: '#FFF', fontSize: 10, fontWeight: 'bold' }}>SUPER OVER</Text>
                  </View>
                )}
              </View>
              {match.status !== 'scheduled' && match.status !== 'toss_done' && (
                <>
                  <View style={styles.mainScoreRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                      <Text style={styles.scoreNumber}>{runs}/{wickets}</Text>
                      <Text style={styles.oversNumber}>({overs} Ov)</Text>
                    </View>
                    <View style={{ flex: 1 }} />
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.crrText}>CRR: {score?.runRate || '0.00'}</Text>
                      {liveState?.inningsNumber % 2 === 0 && !!liveState?.requiredRunRate && (
                        <Text style={[styles.crrText, { marginTop: 2 }]}>RRR: {liveState.requiredRunRate}</Text>
                      )}
                    </View>
                  </View>
                </>
              )}

              {(liveState?.inningsNumber === 2 || liveState?.inningsNumber === 4) && liveState?.target && (
                <View style={{ marginTop: 8, padding: 8, backgroundColor: colors.primaryAlpha20, borderRadius: 6 }}>
                  <Text style={{ color: colors.primary, fontWeight: 'bold' }}>
                    Target: {liveState.target}
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
                    {liveState.toWin <= 0 ? 'Target Reached' : `${currentBattingName} needs ${liveState.toWin} runs in ${liveState.ballsRemaining} balls`}
                  </Text>
                  {liveState.dlsParScore !== undefined && liveState.dlsParScore !== null && liveState.dlsParScore > 0 && (() => {
                    const isAhead = runs > liveState.dlsParScore;
                    const isBehind = runs < liveState.dlsParScore;
                    const bowlingTeamName = isTeamABatting ? match?.teamB?.name : match?.teamA?.name;
                    const safeTeam = isAhead ? currentBattingName : (isBehind ? bowlingTeamName : 'None');

                    return (
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, backgroundColor: isAhead ? 'rgba(34,197,94,0.12)' : isBehind ? 'rgba(239,68,68,0.12)' : 'rgba(148,163,184,0.12)', paddingHorizontal: 8, paddingVertical: 6, borderRadius: 4, alignSelf: 'flex-start' }}>
                        <Text style={{ color: colors.textTertiary, fontSize: 11, fontFamily: Typography.fontFamily.medium }}>DLS Par: </Text>
                        <Text style={{ color: colors.textPrimary, fontSize: 12, fontFamily: Typography.fontFamily.bold }}>{liveState.dlsParScore}</Text>
                        <Text style={{ fontSize: 11, fontFamily: Typography.fontFamily.semiBold, color: isAhead ? '#22c55e' : isBehind ? '#ef4444' : colors.textSecondary }}>
                          {isAhead ? `  ✓ Ahead (${safeTeam} is safe)` : isBehind ? `  ✗ Behind (${safeTeam} is safe)` : '  = On Par'}
                        </Text>
                      </View>
                    );
                  })()}
                </View>
              )}

              {/* Views & Live Viewers Row */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, borderTopWidth: 0.5, borderTopColor: colors.border, paddingTop: 8, gap: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Icon name="eye-outline" size={14} color={colors.textTertiary} />
                  <Text style={{ color: colors.textSecondary, fontSize: 11 }}>{liveState?.views || match?.views || 0} Views</Text>
                </View>
                {match?.status === 'in_progress' && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#ff4d4d' }} />
                    <Text style={{ color: '#ff4d4d', fontSize: 11, fontWeight: 'bold' }}>{liveState?.liveViewers || 0} Live Viewers</Text>
                  </View>
                )}
              </View>

              {match.toss?.winner && (
                <Text style={[styles.tossTextPrimary, { marginTop: 12 }]}>Toss: {getTossWinnerName()} opt to {match.toss.choice}</Text>
              )}

              {liveState?.currentOverBalls?.length > 0 && (
                <View style={styles.msOverTimeline}>
                  <Text style={styles.msOverTimelineLabel}>This Over:</Text>
                  <ScrollView
                    ref={msOverTimelineScrollRef}
                    horizontal
                    nestedScrollEnabled={true}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingRight: 16 }}
                    onContentSizeChange={() => {
                      msOverTimelineScrollRef.current?.scrollToEnd({ animated: true });
                    }}
                  >
                    {liveState.currentOverBalls.map((ball, i) => {
                      const isWicket = ball.type === 'wicket' || ball.display === 'W';
                      const isFour = ball.display ? String(ball.display).includes('4') : ball.runs === 4;
                      const isSix = ball.display ? String(ball.display).includes('6') : ball.runs === 6;
                      const isZero = ball.runs === 0 && !isWicket;
                      const isExtra = ball.display && (ball.display.includes('Wd') || ball.display.includes('Nb') || ball.display.includes('Lb') || ball.display.includes('B'));
                      return (
                        <View key={i} style={[
                          styles.msBallCircle,
                          { marginRight: 7 },
                          isWicket && { backgroundColor: colors.error, borderColor: colors.error },
                          isFour && { backgroundColor: '#4CAF50', borderColor: '#4CAF50' },
                          isSix && { backgroundColor: colors.primary, borderColor: colors.primary },
                          isZero && { backgroundColor: colors.backgroundElevated, borderColor: colors.border },
                          isExtra && { backgroundColor: colors.backgroundElevated, borderColor: colors.primary },
                        ]}>
                          <Text style={[
                            styles.msBallText,
                            (isWicket || isFour) && { color: '#FFF' },
                            isSix && { color: '#000' },
                            isZero && { color: colors.textSecondary },
                            isExtra && { color: colors.primary }
                          ]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{ball.display}</Text>
                        </View>
                      );
                    })}
                  </ScrollView>
                </View>
              )}
              {/* {match.activeScorerId && (
                <Text style={{ color: colors.textSecondary, fontSize: 13, fontFamily: Typography.fontFamily.bold, marginTop: 8 }}>
                  🏏 Scoring handled by: <Text style={{ color: colors.primary }}>{typeof match.activeScorerId === 'object' ? match.activeScorerId.name : 'Active Scorer'}</Text>
                </Text>
              )} */}
              {match.status === 'scheduled' && (
                <Text style={styles.yetToStartText}>Match Yet To Start</Text>
              )}
            </View>

            {/* Conditional Rendering of Batters/Bowlers or Break Info */}
            {(match.status === 'scheduled' || match.status === 'toss_done') ? (
              <View style={[styles.section, { alignItems: 'center', paddingVertical: 40 }]}>
                <Icon name="cricket" size={48} color={colors.primary} style={{ marginBottom: 16 }} />
                <Text style={{ color: colors.textPrimary, fontFamily: Typography.fontFamily.bold, fontSize: 18, textAlign: 'center' }}>
                  Welcome to an exciting contest!
                </Text>
                <Text style={{ color: colors.textSecondary, fontFamily: Typography.fontFamily.medium, fontSize: 14, textAlign: 'center', marginTop: 8 }}>
                  The pitch looks great for a game of cricket. Stay tuned as the action unfolds!
                </Text>
              </View>
            ) : match.status === 'innings_break' ? (
              <View style={styles.inningsBreakCard}>
                <LinearGradient
                  colors={['rgba(255,143,0,0.18)', 'rgba(255,143,0,0.06)']}
                  style={styles.inningsBreakGradient}
                >
                  <View style={styles.inningsBreakIconRow}>
                    <View style={styles.inningsBreakIconWrap}>
                      <Icon name="timer-sand" size={28} color={colors.warning} />
                    </View>
                    <View style={styles.inningsBreakBadge}>
                      <Text style={styles.inningsBreakBadgeText}>INNINGS BREAK</Text>
                    </View>
                  </View>
                  <Text style={styles.inningsBreakTitle}>1st Innings Complete</Text>
                  {liveState?.target && currentBattingName ? (
                    <View style={styles.targetChaseRow}>
                      <View style={styles.targetBox}>
                        <Text style={styles.targetBoxLabel}>TARGET</Text>
                        <Text style={styles.targetBoxValue}>{liveState.target}</Text>
                      </View>
                      <View style={styles.targetChaseInfo}>
                        <Text style={styles.targetChaseTeam}>{currentBattingName}</Text>
                        <Text style={styles.targetChaseDesc}>{liveState.toWin <= 0 ? 'Target Reached' : `needs ${liveState.toWin} runs in ${liveState.ballsRemaining} balls`}</Text>
                        <Text style={styles.targetChaseRRR}>
                          Required RR: <Text style={{ color: colors.warning, fontFamily: Typography.fontFamily.bold }}>{liveState.toWin <= 0 ? '--' : (liveState.requiredRunRate || '--')}</Text>
                        </Text>
                      </View>
                    </View>
                  ) : (
                    <Text style={styles.inningsBreakSub}>2nd innings about to begin</Text>
                  )}
                </LinearGradient>
              </View>
            ) : (
              <>
                {/* Batters Table */}
                <View style={styles.section}>
                  <View style={styles.tableHeaderRow}>
                    <Text style={[styles.tableHeaderText, { flex: 3 }]}>Batters</Text>
                    <Text style={styles.tableHeaderText}>R</Text>
                    <Text style={styles.tableHeaderText}>B</Text>
                    <Text style={styles.tableHeaderText}>4s</Text>
                    <Text style={styles.tableHeaderText}>6s</Text>
                    <Text style={[styles.tableHeaderText, { flex: 1.5, textAlign: 'right' }]}>SR</Text>
                  </View>

                  <TouchableOpacity style={styles.tableRow} onPress={() => striker && setSelectedPlayerPreview(striker)}>
                    <View style={{ flex: 3, flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={styles.playerNameActive}>{striker?.name || 'Striker'} {striker ? '*' : ''}</Text>
                    </View>
                    <Text style={styles.tableRowText}>{strikerStats?.runs || 0}</Text>
                    <Text style={styles.tableRowText}>{strikerStats?.balls || 0}</Text>
                    <Text style={styles.tableRowText}>{strikerStats?.fours || 0}</Text>
                    <Text style={styles.tableRowText}>{strikerStats?.sixes || 0}</Text>
                    <Text style={[styles.tableRowText, { flex: 1.5, textAlign: 'right' }]}>{strikerStats?.strikeRate || '0.00'}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.tableRow} onPress={() => nonStriker && setSelectedPlayerPreview(nonStriker)}>
                    <View style={{ flex: 3 }}>
                      <Text style={styles.playerNameNormal}>{nonStriker?.name || 'Non-Striker'}</Text>
                    </View>
                    <Text style={styles.tableRowText}>{nonStrikerStats?.runs || 0}</Text>
                    <Text style={styles.tableRowText}>{nonStrikerStats?.balls || 0}</Text>
                    <Text style={styles.tableRowText}>{nonStrikerStats?.fours || 0}</Text>
                    <Text style={styles.tableRowText}>{nonStrikerStats?.sixes || 0}</Text>
                    <Text style={[styles.tableRowText, { flex: 1.5, textAlign: 'right' }]}>{nonStrikerStats?.strikeRate || '0.00'}</Text>
                  </TouchableOpacity>

                  <View style={styles.partnershipRow}>
                    <Text style={styles.partnershipText}>Partnership: {strikerStats?.runs + nonStrikerStats?.runs || 0}({strikerStats?.balls + nonStrikerStats?.balls || 0})</Text>
                  </View>
                </View>

                {/* Bowlers Table */}
                <View style={styles.section}>
                  <View style={styles.tableHeaderRow}>
                    <Text style={[styles.tableHeaderText, { flex: 3 }]}>Bowlers</Text>
                    <Text style={styles.tableHeaderText}>O</Text>
                    <Text style={styles.tableHeaderText}>M</Text>
                    <Text style={styles.tableHeaderText}>R</Text>
                    <Text style={styles.tableHeaderText}>W</Text>
                    <Text style={[styles.tableHeaderText, { flex: 1.5, textAlign: 'right' }]}>ER</Text>
                  </View>

                  <TouchableOpacity style={styles.tableRow} onPress={() => (bowler || previousBowler) && setSelectedPlayerPreview(bowler || previousBowler)}>
                    <View style={{ flex: 3, flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={styles.playerNameActive}>{(bowler || previousBowler)?.name || 'Bowler'}</Text>
                    </View>
                    <Text style={styles.tableRowText}>{bowlerStats ? `${bowlerStats.overs}.${bowlerStats.balls || 0}` : '0.0'}</Text>
                    <Text style={styles.tableRowText}>{bowlerStats?.maidens || 0}</Text>
                    <Text style={styles.tableRowText}>{bowlerStats?.runs || 0}</Text>
                    <Text style={styles.tableRowText}>{bowlerStats?.wickets || 0}</Text>
                    <Text style={[styles.tableRowText, { flex: 1.5, textAlign: 'right' }]}>{bowlerStats?.economy || '0.00'}</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* Recent Commentary section at the bottom of the summary */}
            {liveState?.recentCommentary?.length > 0 && (
              <View style={[styles.section, { paddingBottom: 16, marginTop: 12 }]}>
                <Text style={[styles.sectionTitle, { marginBottom: 12 }]}>Recent Commentary</Text>
                {liveState.recentCommentary.slice(0, 3).map((ball, index) => {
                  let display = `${ball.batsmanRuns}`;
                  let bgColor = colors.borderLight;
                  let textColor = colors.textPrimary;

                  if (ball.isWicket) {
                    display = 'W';
                    bgColor = colors.error;
                    textColor = '#FFF';
                  } else if (ball.isWide) display = `${ball.totalRuns}Wd`;
                  else if (ball.isNoBall) display = `${ball.totalRuns}Nb`;
                  else if (ball.isLegBye) display = `${ball.totalRuns}Lb`;
                  else if (ball.isBye) display = `${ball.totalRuns}B`;
                  else if (ball.batsmanRuns === 4) {
                    bgColor = '#4CAF50';
                    textColor = '#FFF';
                  } else if (ball.batsmanRuns === 6) {
                    bgColor = colors.primary;
                    textColor = '#000000';
                  }

                  let text = ball.commentary ? ball.commentary.replace(/^(Shastri|Bhogle):\s*/i, '') : `${ball.batsmanRuns} run(s)`;
                  if (!ball.commentary) {
                    if (ball.isWicket) text = ball.wicket?.type ? ball.wicket.type.replace('_', ' ') : 'Wicket!';
                    else if (ball.isWide) text = `${ball.totalRuns} Wide(s)`;
                    else if (ball.isNoBall) text = `${ball.totalRuns} No Ball(s)`;
                    else if (ball.batsmanRuns === 4) text = 'Four runs!';
                    else if (ball.batsmanRuns === 6) text = 'Six runs!';
                    else if (ball.batsmanRuns === 0) text = 'Dot ball';
                  }

                  const bowlerName = ball.bowler?.name || 'Bowler';
                  const batsmanName = ball.batsman?.name || 'Batsman';

                  return (
                    <View key={`${ball._id || 'commentary'}-${index}`} style={{ flexDirection: 'row', marginBottom: 12, alignItems: 'flex-start' }}>
                      <View style={{ width: 40 }}>
                        <Text style={{ fontFamily: Typography.fontFamily.semiBold, color: colors.textSecondary, fontSize: 13, marginTop: 6 }}>{ball.overNumber - 1}.{ball.ballNumber}</Text>
                      </View>
                      <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: bgColor, justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                        <Text style={{ fontFamily: Typography.fontFamily.bold, color: textColor, fontSize: 12 }}>{display}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        {!ball.isAICommentary && (
                          <Text style={{ fontFamily: Typography.fontFamily.semiBold, color: colors.textPrimary, fontSize: 14 }}>
                            {bowlerName} to {batsmanName}
                          </Text>
                        )}
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                          <Text style={{ flex: 1, fontFamily: Typography.fontFamily.regular, color: colors.textPrimary, fontSize: 13, marginTop: ball.isAICommentary ? 4 : 2, lineHeight: 18 }}>{text}</Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

          </>
        )}
      </ScrollView>
    );
  };

  const renderPlayerStats = (player, role) => {
    if (!player) return null;
    const bType = match.ballType || 'Tennis';

    let baseStats = player;
    const pidStr = player._id?.toString() || player.toString();
    if (match.status === 'completed' && match.playerStatsSnapshot?.[pidStr]) {
      baseStats = match.playerStatsSnapshot[pidStr];
    }

    let statsObj = baseStats.statsByBallType?.[bType] || baseStats;

    if (role === 'Bat') {
      const batStats = statsObj.batting || {};
      const avg = (batStats.runs || 0) / Math.max(1, ((batStats.innings || 0) - (batStats.notOuts || 0)));
      const sr = batStats.balls ? (((batStats.runs || 0) / batStats.balls) * 100) : 0;
      return (
        <View style={{ flexDirection: 'row', backgroundColor: colors.surface, padding: 8, marginVertical: 6, marginHorizontal: 16, borderRadius: 8, borderWidth: 1, borderColor: colors.borderLight }}>
          <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primaryAlpha20, justifyContent: 'center', alignItems: 'center', marginRight: 12, overflow: 'hidden' }}>
            {(player.photo || player.userId?.photo) ? (
              <Image source={{ uri: getImageUrl(player.photo || player.userId?.photo) }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
            ) : (
              <Text style={{ color: colors.primary, fontWeight: 'bold' }}>{player.name?.charAt(0).toUpperCase()}</Text>
            )}
          </View>
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <Text style={{ fontSize: 12, fontWeight: 'bold', color: colors.textPrimary }}>{player.name}</Text>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
              <Text style={{ fontSize: 10, color: colors.textSecondary }}>M: <Text style={{ color: colors.textPrimary, fontWeight: 'bold' }}>{Math.max(statsObj.career?.matches || 0, 1)}</Text></Text>
              <Text style={{ fontSize: 10, color: colors.textSecondary }}>R: <Text style={{ color: colors.textPrimary, fontWeight: 'bold' }}>{batStats.runs || 0}</Text></Text>
              <Text style={{ fontSize: 10, color: colors.textSecondary }}>Avg: <Text style={{ color: colors.textPrimary, fontWeight: 'bold' }}>{avg.toFixed(1)}</Text></Text>
              <Text style={{ fontSize: 10, color: colors.textSecondary }}>SR: <Text style={{ color: colors.textPrimary, fontWeight: 'bold' }}>{sr.toFixed(1)}</Text></Text>
            </View>
          </View>
        </View>
      );
    } else {
      const bowlStats = statsObj.bowling || {};
      const econ = bowlStats.overs ? ((bowlStats.runs || 0) / bowlStats.overs) : 0;
      return (
        <View style={{ flexDirection: 'row', backgroundColor: colors.surface, padding: 8, marginVertical: 6, marginHorizontal: 16, borderRadius: 8, borderWidth: 1, borderColor: colors.borderLight }}>
          <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primaryAlpha20, justifyContent: 'center', alignItems: 'center', marginRight: 12, overflow: 'hidden' }}>
            {(player.photo || player.userId?.photo) ? (
              <Image source={{ uri: getImageUrl(player.photo || player.userId?.photo) }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
            ) : (
              <Text style={{ color: colors.primary, fontWeight: 'bold' }}>{player.name?.charAt(0).toUpperCase()}</Text>
            )}
          </View>
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <Text style={{ fontSize: 12, fontWeight: 'bold', color: colors.textPrimary }}>{player.name}</Text>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
              <Text style={{ fontSize: 10, color: colors.textSecondary }}>M: <Text style={{ color: colors.textPrimary, fontWeight: 'bold' }}>{Math.max(statsObj.career?.matches || 0, 1)}</Text></Text>
              <Text style={{ fontSize: 10, color: colors.textSecondary }}>W: <Text style={{ color: colors.textPrimary, fontWeight: 'bold' }}>{bowlStats.wickets || 0}</Text></Text>
              <Text style={{ fontSize: 10, color: colors.textSecondary }}>Econ: <Text style={{ color: colors.textPrimary, fontWeight: 'bold' }}>{econ.toFixed(1)}</Text></Text>
            </View>
          </View>
        </View>
      );
    }
  };

  const renderCommentary = () => {
    if (loadingCommentary) {
      return <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 50 }} />;
    }

    if (match.status === 'scheduled' || match.status === 'toss_done') {
      return (
        <View style={styles.centerContainer}>
          <Text style={[styles.sectionTitle, { fontSize: 20, textAlign: 'center', marginBottom: 12 }]}>Waiting for the action to begin...</Text>
          <Text style={[styles.emptyText, { fontStyle: 'italic', textAlign: 'center', paddingHorizontal: 32 }]}>
            "Cricket is a pressure game, and when it comes to an India-Pakistan match the pressure is doubled."
          </Text>
        </View>
      );
    }

    if (commentary.length === 0) {
      return <Text style={styles.emptyText}>No commentary available yet.</Text>;
    }

    let filteredCommentary = commentary;
    if (commentaryFilter !== 'ALL' && match.innings?.length > 0) {
      if (['INNINGS_1', 'INNINGS_2'].includes(commentaryFilter) || commentaryFilter.startsWith('SO_')) {
        let targetInningsNums = [];
        if (commentaryFilter === 'INNINGS_1') targetInningsNums = [1];
        else if (commentaryFilter === 'INNINGS_2') targetInningsNums = [2];
        else if (commentaryFilter.startsWith('SO_')) {
          const soIndex = parseInt(commentaryFilter.split('_')[1], 10);
          targetInningsNums = [2 + (soIndex * 2) - 1, 2 + (soIndex * 2)];
        }
        const targetInningsIds = match.innings
          .filter(i => targetInningsNums.includes(i.inningsNumber))
          .map(i => i._id.toString());
        if (targetInningsIds.length > 0) {
          filteredCommentary = commentary.filter(c => {
            const cInnId = (c.innings?._id || c.innings).toString();
            return targetInningsIds.includes(cInnId);
          });
        } else {
          filteredCommentary = [];
        }
      } else {
        if (commentaryFilter === 'Boundaries') {
          filteredCommentary = commentary.filter(c => c.batsmanRuns === 4 || c.batsmanRuns === 6);
        } else if (commentaryFilter === 'Wickets') {
          filteredCommentary = commentary.filter(c => c.isWicket);
        } else if (commentaryFilter === 'Extras') {
          filteredCommentary = commentary.filter(c => c.isWide || c.isNoBall || c.isLegBye || c.isBye);
        }
      }
    }

    const showOverSummary = ['ALL', 'INNINGS_1', 'INNINGS_2'].includes(commentaryFilter) || commentaryFilter.startsWith('SO_');
    const timelineData = [];
    let currentOverNumber = null;
    let currentInningsId = null;
    let overBalls = [];
    let overRuns = 0;
    let overWickets = 0;
    let cumulativeInningsRuns = 0;
    let cumulativeInningsWickets = 0;

    const runningBatsmenStats = {}; // batsmanId -> { name, runs, balls }
    const runningBowlersStats = {}; // bowlerId -> { name, balls, runs, wickets, maidens, overRuns, overWickets }
    let lastStrikerId = null;
    let lastNonStrikerId = null;

    const buildSnapshots = (ballsList) => {
      const lastBall = ballsList[ballsList.length - 1];
      const bId = lastBall ? String(lastBall.bowler?._id || lastBall.bowler || '') : '';
      
      let bowlerSnapshot = null;
      if (bId && runningBowlersStats[bId]) {
        const bStats = runningBowlersStats[bId];
        const legalBallsCount = ballsList.filter(b => !b.isWide && !b.isNoBall).length;
        const isMaiden = bStats.overRuns === 0 && legalBallsCount === 6;
        if (isMaiden) {
          bStats.maidens += 1;
        }
        bowlerSnapshot = {
          name: bStats.name,
          overs: `${Math.floor(bStats.balls / 6)}.${bStats.balls % 6}`,
          maidens: bStats.maidens,
          runs: bStats.runs,
          wickets: bStats.wickets
        };
      }

      const battersSnapshot = [];
      if (lastStrikerId && runningBatsmenStats[lastStrikerId]) {
        battersSnapshot.push({
          name: runningBatsmenStats[lastStrikerId].name,
          runs: runningBatsmenStats[lastStrikerId].runs,
          balls: runningBatsmenStats[lastStrikerId].balls
        });
      }
      if (lastNonStrikerId && runningBatsmenStats[lastNonStrikerId] && lastNonStrikerId !== lastStrikerId) {
        battersSnapshot.push({
          name: runningBatsmenStats[lastNonStrikerId].name,
          runs: runningBatsmenStats[lastNonStrikerId].runs,
          balls: runningBatsmenStats[lastNonStrikerId].balls
        });
      }
      return { bowlerSnapshot, battersSnapshot };
    };

    // Clone and reverse commentary so we iterate chronologically from first ball to last ball
    const chronologicalComms = [...filteredCommentary].reverse();

    let currentBowlerId = null;
    let activeBattersList = new Set();
    let isFirstBallOfInnings = true;

    chronologicalComms.forEach((item, index) => {
      const itemInningsId = (item.innings?._id || item.innings).toString();
      const bowlerId = item.bowler?._id || item.bowler;
      const batsmanId = item.batsman?._id || item.batsman;
      const nonStrikerId = item.nonStriker?._id || item.nonStriker;

      // If we transition to a new over OR a new innings, close the previous over
      if (currentOverNumber !== null && (currentOverNumber !== item.overNumber || currentInningsId !== itemInningsId)) {
        if (showOverSummary) {
          const { bowlerSnapshot, battersSnapshot } = buildSnapshots(overBalls);
          timelineData.push({
            type: 'overSummary',
            id: `over-${currentOverNumber}-${currentInningsId}-${index}`,
            overNumber: currentOverNumber,
            runs: overRuns,
            wickets: overWickets,
            balls: [...overBalls],
            bowler: overBalls[overBalls.length - 1]?.bowler,
            bowlerSnapshot,
            battersSnapshot,
            score: overBalls[overBalls.length - 1]?.score || {
              runs: cumulativeInningsRuns,
              wickets: cumulativeInningsWickets,
              bowlerOvers: overBalls[overBalls.length - 1]?.score?.bowlerOvers
            }
          });
        }
        overBalls = [];
        overRuns = 0;
        overWickets = 0;
      }

      // Check for Start of Innings Openers
      if (isFirstBallOfInnings || currentInningsId !== itemInningsId) {
        cumulativeInningsRuns = 0;
        cumulativeInningsWickets = 0;
        isFirstBallOfInnings = false;
        activeBattersList.clear();
        if (item.batsman) activeBattersList.add(batsmanId.toString());
        if (item.nonStriker) activeBattersList.add(nonStrikerId.toString());

        timelineData.push({
          type: 'infoEvent',
          id: `openers-${itemInningsId}-${index}`,
          text: `Opening Batters: ${item.batsman?.name || 'Batter'} & ${item.nonStriker?.name || 'Batter'} are in the middle.`,
          icon: 'cricket'
        });
      }

      // Check if bowler changed (new spell / bowling change)
      if (bowlerId && bowlerId.toString() !== currentBowlerId) {
        currentBowlerId = bowlerId.toString();
        timelineData.push({
          type: 'infoEvent',
          id: `bowlerchange-${bowlerId}-${index}`,
          text: `${item.bowler?.name || 'Bowler'} comes into the attack.`,
          icon: 'bowling'
        });
      }

      // Check if any new batter has entered (not in our current active batters list)
      if (batsmanId && !activeBattersList.has(batsmanId.toString())) {
        activeBattersList.add(batsmanId.toString());
        timelineData.push({
          type: 'infoEvent',
          id: `batterentry-${batsmanId}-${index}`,
          text: `New Batter: ${item.batsman?.name || 'Batter'} comes to the crease.`,
          icon: 'account'
        });
      }
      if (nonStrikerId && !activeBattersList.has(nonStrikerId.toString())) {
        activeBattersList.add(nonStrikerId.toString());
        timelineData.push({
          type: 'infoEvent',
          id: `batterentry-${nonStrikerId}-${index}`,
          text: `New Batter: ${item.nonStriker?.name || 'Batter'} comes to the crease.`,
          icon: 'account'
        });
      }

      // Clean active batters list when a wicket falls
      if (item.isWicket && item.wicket?.player) {
        activeBattersList.delete(item.wicket.player.toString());
      } else if (item.isWicket && item.dismissedBatsmanId) {
        activeBattersList.delete(item.dismissedBatsmanId.toString());
      }

      // Realtime chronological stats logging
      const bIdStr = bowlerId ? bowlerId.toString() : '';
      const batIdStr = batsmanId ? batsmanId.toString() : '';
      const nsIdStr = nonStrikerId ? nonStrikerId.toString() : '';

      if (bIdStr) {
        if (!runningBowlersStats[bIdStr]) {
          runningBowlersStats[bIdStr] = {
            name: item.bowler?.name || 'Bowler',
            balls: 0,
            runs: 0,
            wickets: 0,
            maidens: 0,
            overRuns: 0,
            overWickets: 0
          };
        }
        if (overBalls.length === 0) {
          runningBowlersStats[bIdStr].overRuns = 0;
          runningBowlersStats[bIdStr].overWickets = 0;
        }
      }

      if (batIdStr) {
        if (!runningBatsmenStats[batIdStr]) {
          runningBatsmenStats[batIdStr] = {
            name: item.batsman?.name || 'Batter',
            runs: 0,
            balls: 0
          };
        }
        if (!item.isWide) {
          runningBatsmenStats[batIdStr].balls += 1;
        }
        runningBatsmenStats[batIdStr].runs += item.batsmanRuns || 0;
        lastStrikerId = batIdStr;
      }

      if (nsIdStr) {
        if (!runningBatsmenStats[nsIdStr]) {
          runningBatsmenStats[nsIdStr] = {
            name: item.nonStriker?.name || 'Batter',
            runs: 0,
            balls: 0
          };
        }
        lastNonStrikerId = nsIdStr;
      }

      if (bIdStr) {
        const runsConceded = (item.totalRuns || 0) - ((item.isBye || item.isLegBye) ? (item.extraRuns || 0) : 0);
        runningBowlersStats[bIdStr].runs += runsConceded;
        runningBowlersStats[bIdStr].overRuns += runsConceded;

        if (!item.isWide && !item.isNoBall) {
          runningBowlersStats[bIdStr].balls += 1;
        }

        const isBowlerWicket = item.isWicket && item.wicket && ['bowled', 'caught', 'caught_behind', 'caught_and_bowled', 'lbw', 'stumped', 'hit_wicket'].includes(item.wicket.type);
        if (isBowlerWicket) {
          runningBowlersStats[bIdStr].wickets += 1;
          runningBowlersStats[bIdStr].overWickets += 1;
        }
      }

      if (item.isWicket) {
        const dismissedId = item.wicket?.dismissedBatsman || item.dismissedBatsmanId || batsmanId;
        const dismissedIdStr = dismissedId ? dismissedId.toString() : '';
        if (dismissedIdStr) {
          if (lastStrikerId === dismissedIdStr) lastStrikerId = null;
          if (lastNonStrikerId === dismissedIdStr) lastNonStrikerId = null;
        }
      }

      currentOverNumber = item.overNumber;
      currentInningsId = itemInningsId;

      timelineData.push({
        type: 'ball',
        id: item._id || `ball-${index}`,
        data: item
      });

      overBalls.push(item);
      overRuns += item.totalRuns || 0;
      cumulativeInningsRuns += item.totalRuns || 0;
      if (item.isWicket) {
        overWickets += 1;
        cumulativeInningsWickets += 1;
      }
    });

    // Output final over summary (only if over has ended, or innings has ended)
    if (currentOverNumber !== null && showOverSummary && overBalls.length > 0) {
      const inningsIndex = match.innings?.findIndex(inn => String(inn._id || inn) === String(currentInningsId));
      const inningsNum = inningsIndex !== -1 ? (inningsIndex + 1) : match.currentInnings;
      const legalBallsInOver = overBalls.filter(b => !b.isWide && !b.isNoBall).length;
      const isCurrentInningsActive = (match?.currentInnings === inningsNum) && (match?.status !== 'completed');
      const isOverEnded = legalBallsInOver >= 6 || !isCurrentInningsActive;

      if (isOverEnded) {
        const { bowlerSnapshot, battersSnapshot } = buildSnapshots(overBalls);
        timelineData.push({
          type: 'overSummary',
          id: `over-${currentOverNumber}-${currentInningsId}-final`,
          overNumber: currentOverNumber,
          runs: overRuns,
          wickets: overWickets,
          balls: [...overBalls],
          bowler: overBalls[overBalls.length - 1]?.bowler,
          bowlerSnapshot,
          battersSnapshot,
          score: overBalls[overBalls.length - 1]?.score || {
            runs: cumulativeInningsRuns,
            wickets: cumulativeInningsWickets,
            bowlerOvers: overBalls[overBalls.length - 1]?.score?.bowlerOvers
          }
        });
      }
    }

    // Now reverse the final timelineData so that the newest elements appear at the top
    timelineData.reverse();

    const renderLiveHeader = () => {
      if (match.status !== 'live' && match.status !== 'in_progress') return null;

      let crr = '0.00';
      let rrr = '0.00';
      if (liveState?.score) {
        const oversArr = String(liveState.score.overs).split('.');
        const totalBalls = parseInt(oversArr[0] || '0') * 6 + parseInt(oversArr[1] || '0');
        crr = totalBalls > 0 ? ((liveState.score.runs / totalBalls) * 6).toFixed(2) : '0.00';

        if (liveState.match?.innings?.length > 1) {
          const target = liveState.match.target;
          if (target && target > liveState.score.runs) {
            const maxBalls = liveState.match.overs * 6;
            const ballsLeft = maxBalls - totalBalls;
            if (ballsLeft > 0) {
              rrr = (((target - liveState.score.runs) / ballsLeft) * 6).toFixed(2);
            }
          }
        }
      }

      return (
        <View style={{ backgroundColor: isDark ? colors.surfaceDark : colors.surfaceVariant, padding: 12, borderBottomWidth: 1, borderBottomColor: colors.borderLight, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.error, elevation: 4, shadowColor: colors.error, shadowOpacity: 0.8, shadowRadius: 6 }} />
              <Text style={{ color: colors.textPrimary, fontFamily: Typography.fontFamily.bold, fontSize: 18 }}>
                {liveState?.score?.runs || 0}/{liveState?.score?.wickets || 0}
              </Text>
              <Text style={{ color: colors.textSecondary, fontFamily: Typography.fontFamily.semiBold, fontSize: 14 }}>
                ({liveState?.score?.overs || '0.0'})
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ color: colors.textSecondary, fontSize: 10 }}>CRR</Text>
              <Text style={{ color: colors.textPrimary, fontFamily: Typography.fontFamily.semiBold, fontSize: 13 }}>{crr}</Text>
            </View>
            {rrr !== '0.00' && (
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ color: colors.textSecondary, fontSize: 10 }}>RRR</Text>
                <Text style={{ color: colors.textPrimary, fontFamily: Typography.fontFamily.semiBold, fontSize: 13 }}>{rrr}</Text>
              </View>
            )}
          </View>
        </View>
      );
    };

    const renderFilterChips = () => {
      const filters = ['ALL', 'INNINGS_1', 'INNINGS_2', 'Boundaries', 'Wickets', 'Extras'];
      return (
        <View style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.borderLight }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
            {filters.map(filter => {
              let label = filter;
              if (filter === 'INNINGS_1') label = '1st Innings';
              if (filter === 'INNINGS_2') label = '2nd Innings';
              if (filter === 'ALL') label = 'All Balls';

              if (filter === 'INNINGS_1' && (!match.innings || !match.innings.find(i => i.inningsNumber === 1))) return null;
              if (filter === 'INNINGS_2' && (!match.innings || !match.innings.find(i => i.inningsNumber === 2))) return null;

              const isSelected = commentaryFilter === filter;
              return (
                <TouchableOpacity
                  key={filter}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 6,
                    borderRadius: 20,
                    backgroundColor: isSelected ? colors.primary : colors.surface,
                    borderWidth: 1,
                    borderColor: isSelected ? colors.primary : colors.borderLight
                  }}
                  onPress={() => setCommentaryFilter(filter)}
                >
                  <Text style={{ color: isSelected ? '#000' : colors.textSecondary, fontFamily: Typography.fontFamily.semiBold, fontSize: 12 }}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      );
    }

    const renderBallEvent = (ball) => {
      let outcome = `${ball.batsmanRuns}`;
      let bgColor = colors.surfaceVariant;
      let borderColor = colors.borderLight;
      let textColor = colors.textPrimary;
      let glow = null;

      if (ball.isWicket) {
        outcome = 'W';
        bgColor = colors.error;
        borderColor = colors.error;
        textColor = '#FFF';
        glow = colors.error;
      } else if (ball.isWide) { outcome = `${ball.totalRuns}Wd`; }
      else if (ball.isNoBall) { outcome = `${ball.totalRuns}Nb`; }
      else if (ball.isLegBye) { outcome = `${ball.totalRuns}Lb`; }
      else if (ball.isBye) { outcome = `${ball.totalRuns}B`; }
      else if (ball.batsmanRuns === 4) {
        outcome = '4';
        bgColor = colors.primary;
        borderColor = colors.primary;
        textColor = '#000';
        glow = colors.primary;
      } else if (ball.batsmanRuns === 6) {
        outcome = '6';
        bgColor = colors.primary;
        borderColor = colors.primary;
        textColor = '#000';
        glow = colors.primary;
      } else if (ball.batsmanRuns > 0) {
        // default colors.surfaceVariant
      } else {
        bgColor = colors.surface;
      }

      const isExpanded = expandedBalls[ball._id];

      let text = `${ball.batsmanRuns} run(s)`;
      let title = '';
      if (ball.isWicket) {
        const getFirstName = (name) => name ? name.split(' ')[0] : '';
        const bowlerName = getFirstName(ball.bowler?.name);
        const fielderName = ball.wicket?.fielder ? getFirstName(ball.wicket.fielder.name) : '';
        const wType = ball.wicket?.type;
        if (wType === 'caught' || wType === 'caught_behind' || wType === 'caught_and_bowled') {
          const cBy = wType === 'caught_and_bowled' ? bowlerName : (fielderName || 'Sub');
          text = `c ${cBy} b ${bowlerName}`;
        } else if (wType === 'bowled') text = `b ${bowlerName}`;
        else if (wType === 'stumped') text = `st ${fielderName || 'WK'} b ${bowlerName}`;
        else if (wType === 'run_out') text = `run out (${fielderName})`;
        else if (wType === 'lbw') text = `lbw b ${bowlerName}`;
        else if (wType === 'hit_wicket') text = `hit wicket b ${bowlerName}`;
        else text = wType ? wType.replace('_', ' ') : 'Wicket!';
        title = 'OUT!';
      }
      else if (ball.isWide) { text = `${ball.totalRuns} Wide(s)`; title = 'WIDE'; }
      else if (ball.isNoBall) { text = `${ball.totalRuns} No Ball(s)`; title = 'NO BALL'; }
      else if (ball.isLegBye) { text = `${ball.totalRuns} Leg Bye(s)`; title = 'LEG BYE'; }
      else if (ball.isBye) { text = `${ball.totalRuns} Bye(s)`; title = 'BYE'; }
      else if (ball.batsmanRuns === 4) { text = 'Four runs!'; title = 'FOUR'; }
      else if (ball.batsmanRuns === 6) { text = 'Six runs!'; title = 'SIX'; }
      else if (ball.batsmanRuns === 0) { text = 'Dot ball'; title = 'DOT'; }
      else { title = `${ball.batsmanRuns} RUNS`; }

      const isIndoor = match.pitchType === 'Box Cricket' || match.groundType === 'Box Cricket' || match.groundType === 'Indoor';
      const shotPos = ball.wagonWheel && ball.wagonWheel.angle !== undefined ? getShotPosition(ball.wagonWheel.angle, isIndoor) : '';
      const textWithPos = shotPos && (ball.batsmanRuns > 0 || ball.isBoundary || ball.isSix) ? `${text} towards ${shotPos}` : text;
      const speed = ball.speed ? `${ball.speed} km/h` : null;

      return (
        <View style={{ flexDirection: 'row', paddingRight: 16 }}>
          <View style={{ width: 60, alignItems: 'center' }}>
            <View style={{ width: 2, flex: 1, backgroundColor: colors.borderLight }} />
            <View style={{
              position: 'absolute', top: 20,
              minWidth: 36, height: 36, borderRadius: 18,
              paddingHorizontal: 5,
              backgroundColor: bgColor, borderWidth: 2, borderColor: borderColor,
              justifyContent: 'center', alignItems: 'center',
              ...(glow ? { elevation: 8, shadowColor: glow, shadowOpacity: 0.8, shadowRadius: 6 } : {})
            }}>
              <Text style={{ color: textColor, fontFamily: Typography.fontFamily.bold, fontSize: 11 }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{outcome}</Text>
            </View>
          </View>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => toggleBallExpand(ball._id)}
            style={{
              flex: 1, marginVertical: 12, borderRadius: 20,
              backgroundColor: isExpanded ? colors.backgroundElevated : colors.surface,
              borderWidth: 1, borderColor: isExpanded ? colors.primary : colors.borderLight,
              padding: 16,
              ...(isExpanded ? { elevation: 4, shadowColor: colors.primary, shadowOpacity: 0.2, shadowRadius: 8 } : {})
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontFamily: Typography.fontFamily.bold, color: colors.textSecondary, fontSize: 12 }}>
                  {ball.overNumber - 1}.{ball.ballNumber}
                </Text>
                {ball.isAICommentary && (ball.batsmanRuns === 4 || ball.batsmanRuns === 6 || ball.isWicket) && (
                  <View style={{ backgroundColor: colors.primaryAlpha20, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 0.5, borderColor: colors.primary }}>
                    <Text style={{ color: colors.primary, fontSize: 8, fontFamily: Typography.fontFamily.bold, letterSpacing: 0.5 }}>AI LIVE</Text>
                  </View>
                )}
              </View>
              <Text style={{ fontFamily: Typography.fontFamily.semiBold, color: isExpanded ? colors.primary : colors.textSecondary, fontSize: 10, letterSpacing: 0.5 }}>
                {title}
              </Text>
            </View>

            {ball.isAICommentary ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, gap: 8 }}>
                <Text style={{ flex: 1, fontFamily: Typography.fontFamily.regular, color: colors.textPrimary, fontSize: 14, lineHeight: 22 }}>
                  {ball.commentary.replace(/^(Shastri|Bhogle):\s*/i, '')}
                </Text>
              </View>
            ) : (
              <Text style={{ fontFamily: Typography.fontFamily.regular, color: colors.textPrimary, fontSize: 14, marginTop: 8, lineHeight: 22 }}>
                <Text
                  style={{ fontFamily: Typography.fontFamily.bold, color: colors.textPrimary }}
                  onPress={() => {
                    const bowlerId = ball.bowler?._id || ball.bowler;
                    if (bowlerId) navigation.navigate('PlayerDetail', { id: bowlerId.toString() });
                  }}
                >
                  {ball.bowler?.name || 'Bowler'}
                </Text>
                {' to '}
                <Text
                  style={{ fontFamily: Typography.fontFamily.bold, color: colors.textPrimary }}
                  onPress={() => {
                    const batsmanId = ball.batsman?._id || ball.batsman;
                    if (batsmanId) navigation.navigate('PlayerDetail', { id: batsmanId.toString() });
                  }}
                >
                  {ball.batsman?.name || 'Batter'}
                </Text>
                {`, ${textWithPos}`}
              </Text>
            )}

            {isExpanded && (
              <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.borderLight }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  {speed && (
                    <View>
                      <Text style={{ color: colors.textSecondary, fontSize: 10, fontFamily: Typography.fontFamily.semiBold }}>SPEED</Text>
                      <Text style={{ color: colors.textPrimary, fontSize: 13, fontFamily: Typography.fontFamily.bold }}>{speed}</Text>
                    </View>
                  )}
                  {shotPos ? (
                    <View>
                      <Text style={{ color: colors.textSecondary, fontSize: 10, fontFamily: Typography.fontFamily.semiBold }}>SHOT</Text>
                      <Text style={{ color: colors.textPrimary, fontSize: 13, fontFamily: Typography.fontFamily.bold }}>{shotPos}</Text>
                    </View>
                  ) : null}
                  <View>
                    <Text style={{ color: colors.textSecondary, fontSize: 10, fontFamily: Typography.fontFamily.semiBold }}>TIME</Text>
                    <Text style={{ color: colors.textPrimary, fontSize: 13, fontFamily: Typography.fontFamily.bold }}>
                      {moment(ball.createdAt).format('h:mm A')}
                    </Text>
                  </View>
                </View>

                {ball.score && (
                  <View style={{ flexDirection: 'row', marginTop: 12, backgroundColor: isDark ? colors.surfaceDark : colors.surfaceVariant, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: colors.border }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.textSecondary, fontSize: 10 }}>Batter</Text>
                      <Text style={{ color: colors.textPrimary, fontSize: 12, fontFamily: Typography.fontFamily.bold }}>
                        {ball.batsman?.name?.split(' ')[0]} {ball.score.strikerRuns}({ball.score.strikerBalls})
                      </Text>
                    </View>
                    <View style={{ flex: 1, alignItems: 'flex-end' }}>
                      <Text style={{ color: colors.textSecondary, fontSize: 10 }}>Bowler</Text>
                      <Text style={{ color: colors.textPrimary, fontSize: 12, fontFamily: Typography.fontFamily.bold }}>
                        {ball.bowler?.name?.split(' ')[0]} {ball.score.bowlerWickets}/{ball.score.bowlerRuns}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            )}
          </TouchableOpacity>
        </View>
      );
    };

    const renderOverSummary = (summary) => {
      const sequence = [...summary.balls].map((b, i) => {
        let outcome = `${b.batsmanRuns}`;
        if (b.isWicket) outcome = 'W';
        else if (b.isWide) outcome = `${b.totalRuns}wd`;
        else if (b.isNoBall) outcome = `${b.totalRuns}nb`;
        else if (b.isLegBye) outcome = `${b.totalRuns}lb`;
        else if (b.isBye) outcome = `${b.totalRuns}b`;
        else if (b.batsmanRuns === 0) outcome = '0';

        let clr = colors.textSecondary;
        if (b.isWicket) clr = colors.error;
        else if (b.batsmanRuns === 4 || b.batsmanRuns === 6) clr = colors.primary;
        else if (b.batsmanRuns > 0) clr = colors.textPrimary;

        return (
          <Text key={i} style={{ color: clr, fontFamily: Typography.fontFamily.bold, fontSize: 14 }}>
            {outcome}
          </Text>
        );
      });

      const sequenceWithDots = sequence.reduce((acc, curr, idx) => {
        if (idx === 0) return [curr];
        return [...acc, <View key={`sep-${idx}`} style={{ width: 8 }} />, curr];
      }, []);

      return (
        <View style={{ flexDirection: 'row', paddingRight: 16 }}>
          <View style={{ width: 60, alignItems: 'center' }}>
            <View style={{ width: 2, flex: 1, backgroundColor: colors.borderLight }} />
          </View>
          <View style={{ flex: 1, marginVertical: 12, backgroundColor: colors.surfaceVariant, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.borderLight }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ fontFamily: Typography.fontFamily.bold, color: colors.textPrimary, fontSize: 14 }}>
                END OF OVER {summary.overNumber}
              </Text>
              <Text style={{ fontFamily: Typography.fontFamily.bold, color: colors.textPrimary, fontSize: 14 }}>
                {summary.runs} Runs {summary.wickets > 0 && <Text style={{ color: colors.error }}> | {summary.wickets} Wkts</Text>}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', backgroundColor: colors.surface, padding: 12, borderRadius: 12, alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ color: colors.textSecondary, fontFamily: Typography.fontFamily.medium, fontSize: 12, marginRight: 8 }}>Over:</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', flex: 1 }}>
                {sequenceWithDots}
              </View>
            </View>

            {summary.score && (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ color: colors.textSecondary, fontFamily: Typography.fontFamily.semiBold, fontSize: 12 }}>
                  Score: <Text style={{ color: colors.primary, fontFamily: Typography.fontFamily.bold, fontSize: 14 }}>{summary.score.runs}-{summary.score.wickets}</Text>
                </Text>
                {summary.bowler && !summary.bowlerSnapshot && summary.score.bowlerOvers !== undefined && (
                  <Text style={{ color: colors.textSecondary, fontFamily: Typography.fontFamily.medium, fontSize: 12 }}>
                    {summary.bowler.name}: {summary.score.bowlerOvers} Ov
                  </Text>
                )}
              </View>
            )}

            {/* Batters and Bowlers snapshot locked to the end of this over */}
            {((summary.battersSnapshot && summary.battersSnapshot.length > 0) || summary.bowlerSnapshot) && (
              <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: colors.borderLight, paddingTop: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  {/* Batters */}
                  <View style={{ flex: 1.1, paddingRight: 8 }}>
                    <Text style={{ fontFamily: Typography.fontFamily.bold, color: colors.textTertiary, fontSize: 9, letterSpacing: 0.5, marginBottom: 6 }}>BATTING</Text>
                    {summary.battersSnapshot.map((bat, idx) => (
                      <View key={idx} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text style={{ fontFamily: Typography.fontFamily.medium, color: colors.textPrimary, fontSize: 12, flex: 1, marginRight: 4 }} numberOfLines={1}>
                          {bat.name}
                        </Text>
                        <Text style={{ fontFamily: Typography.fontFamily.semiBold, color: colors.textSecondary, fontSize: 12 }}>
                          {bat.runs} <Text style={{ fontFamily: Typography.fontFamily.regular, fontSize: 10 }}>({bat.balls})</Text>
                        </Text>
                      </View>
                    ))}
                  </View>

                  <View style={{ width: 1, backgroundColor: colors.borderLight, marginHorizontal: 8 }} />

                  {/* Bowler */}
                  <View style={{ flex: 1, paddingLeft: 8 }}>
                    <Text style={{ fontFamily: Typography.fontFamily.bold, color: colors.textTertiary, fontSize: 9, letterSpacing: 0.5, marginBottom: 6 }}>BOWLING</Text>
                    {summary.bowlerSnapshot ? (
                      <View>
                        <Text style={{ fontFamily: Typography.fontFamily.medium, color: colors.textPrimary, fontSize: 12, marginBottom: 2 }} numberOfLines={1}>
                          {summary.bowlerSnapshot.name}
                        </Text>
                        <Text style={{ fontFamily: Typography.fontFamily.semiBold, color: colors.textSecondary, fontSize: 12 }}>
                          {summary.bowlerSnapshot.wickets}-{summary.bowlerSnapshot.runs} <Text style={{ fontFamily: Typography.fontFamily.regular, fontSize: 10 }}>({summary.bowlerSnapshot.overs} ov, {summary.bowlerSnapshot.maidens}m)</Text>
                        </Text>
                      </View>
                    ) : (
                      <Text style={{ color: colors.textTertiary, fontSize: 12, fontStyle: 'italic' }}>No bowler data</Text>
                    )}
                  </View>
                </View>
              </View>
            )}
          </View>
        </View>
      );
    };

    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {renderFilterChips()}

        <FlatList
          data={timelineData}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 180 }}
          refreshControl={getRefreshControl()}
          renderItem={({ item }) => {
            if (item.type === 'overSummary') {
              return renderOverSummary(item);
            }
            if (item.type === 'infoEvent') {
              return (
                <View style={{ flexDirection: 'row', paddingRight: 16 }}>
                  <View style={{ width: 60, alignItems: 'center' }}>
                    <View style={{ width: 2, flex: 1, backgroundColor: colors.borderLight }} />
                    <View style={{
                      position: 'absolute', top: 12, width: 24, height: 24, borderRadius: 12,
                      backgroundColor: 'rgba(255, 212, 0, 0.1)', borderWidth: 1, borderColor: 'rgba(255, 212, 0, 0.25)',
                      justifyContent: 'center', alignItems: 'center'
                    }}>
                      <Icon name={item.icon === 'bowling' ? 'bowling' : item.icon === 'cricket' ? 'cricket' : 'account'} size={12} color={colors.primary} />
                    </View>
                  </View>
                  <View style={{ flex: 1, marginVertical: 6, backgroundColor: colors.surface, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: colors.borderLight, justifyContent: 'center' }}>
                    <Text style={{ fontFamily: Typography.fontFamily.medium, color: colors.textSecondary, fontSize: 12 }}>
                      {item.text}
                    </Text>
                  </View>
                </View>
              );
            }
            return renderBallEvent(item.data);
          }}
          ListEmptyComponent={
            <View style={{ padding: 32, alignItems: 'center' }}>
              <Text style={{ color: colors.textSecondary }}>No events found for this filter.</Text>
            </View>
          }
        />
      </View>
    );
  };

  const getCaptainIdA = () => {
    const cA = match.captain?.teamA || match.teamA?.captain;
    if (cA) return typeof cA === 'object' ? (cA._id || cA.id)?.toString() : cA.toString();
    const capMember = match.teamA?.players?.find(m => m.role === 'captain');
    if (capMember?.player) return (capMember.player._id || capMember.player.id || capMember.player)?.toString();
    return null;
  };

  const getCaptainIdB = () => {
    const cB = match.captain?.teamB || match.teamB?.captain;
    if (cB) return typeof cB === 'object' ? (cB._id || cB.id)?.toString() : cB.toString();
    const capMember = match.teamB?.players?.find(m => m.role === 'captain');
    if (capMember?.player) return (capMember.player._id || capMember.player.id || capMember.player)?.toString();
    return null;
  };

  const isCaptainPlayerA = (p) => {
    if (!p) return false;
    const pId = (p._id || p.id)?.toString();
    const capId = getCaptainIdA();
    return p.role === 'captain' || p.isCaptain || (capId && pId === capId);
  };

  const isCaptainPlayerB = (p) => {
    if (!p) return false;
    const pId = (p._id || p.id)?.toString();
    const capId = getCaptainIdB();
    return p.role === 'captain' || p.isCaptain || (capId && pId === capId);
  };

  const renderSquads = () => {
    const rawTeamAXI = match.playingXI?.teamA || [];
    const rawTeamBXI = match.playingXI?.teamB || [];

    const teamAXI = [...rawTeamAXI].sort((a, b) => {
      const isCapA = isCaptainPlayerA(a) ? 1 : 0;
      const isCapB = isCaptainPlayerA(b) ? 1 : 0;
      return isCapB - isCapA;
    });

    const teamBXI = [...rawTeamBXI].sort((a, b) => {
      const isCapA = isCaptainPlayerB(a) ? 1 : 0;
      const isCapB = isCaptainPlayerB(b) ? 1 : 0;
      return isCapB - isCapA;
    });

    const maxLength = Math.max(teamAXI.length, teamBXI.length);
    const rows = [];
    for (let i = 0; i < maxLength; i++) {
      rows.push({
        playerA: teamAXI[i] || null,
        playerB: teamBXI[i] || null,
      });
    }

    return (
      <ScrollView contentContainerStyle={[styles.content, { paddingHorizontal: 0 }]} refreshControl={getRefreshControl()}>

        {/* Team Headers */}
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.borderLight }}>

          {/* Team A Header */}
          <TouchableOpacity
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', paddingHorizontal: 16 }}
            onPress={() => match.teamA?._id && navigation.navigate('TeamDetail', { id: match.teamA._id })}
          >
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.borderLight, justifyContent: 'center', alignItems: 'center', marginRight: 8, overflow: 'hidden' }}>
              {(match.teamA?.logo || match.teamA?.logoUrl) ? (
                <Image source={{ uri: getImageUrl(match.teamA?.logo || match.teamA?.logoUrl) }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
              ) : (
                <Text style={{ fontFamily: Typography.fontFamily.bold, color: colors.textSecondary, fontSize: 16 }}>{match.teamA?.name?.charAt(0) || 'A'}</Text>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: Typography.fontFamily.bold, color: colors.textPrimary, fontSize: 12 }} numberOfLines={2}>{match.teamA?.name}</Text>
            </View>
          </TouchableOpacity>

          <View style={{ width: 1, height: 30, backgroundColor: colors.borderLight }} />

          {/* Team B Header */}
          <TouchableOpacity
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', paddingHorizontal: 16 }}
            onPress={() => match.teamB?._id && navigation.navigate('TeamDetail', { id: match.teamB._id })}
          >
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <Text style={{ fontFamily: Typography.fontFamily.bold, color: colors.textPrimary, fontSize: 12, textAlign: 'right' }} numberOfLines={2}>{match.teamB?.name}</Text>
            </View>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.borderLight, justifyContent: 'center', alignItems: 'center', marginLeft: 8, overflow: 'hidden' }}>
              {(match.teamB?.logo || match.teamB?.logoUrl) ? (
                <Image source={{ uri: getImageUrl(match.teamB?.logo || match.teamB?.logoUrl) }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
              ) : (
                <Text style={{ fontFamily: Typography.fontFamily.bold, color: colors.textSecondary, fontSize: 16 }}>{match.teamB?.name?.charAt(0) || 'B'}</Text>
              )}
            </View>
          </TouchableOpacity>

        </View>

        {/* Sub Header */}
        <View style={{ backgroundColor: '#F0F0F0', paddingVertical: 4, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.borderLight }}>
          <Text style={{ fontSize: 10, fontFamily: Typography.fontFamily.bold, color: colors.textSecondary }}>Playing Squad</Text>
        </View>

        {/* Squad Rows */}
        <View style={{ backgroundColor: colors.surface, paddingBottom: 24 }}>
          {rows.length === 0 ? <Text style={[styles.emptyText, { marginTop: 24 }]}>Not announced</Text> : rows.map((row, idx) => (
            <View key={`row-${idx}`} style={{ flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' }}>

              {/* Player A */}
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 }}>
                {row.playerA ? (
                  <TouchableOpacity style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }} onPress={() => navigation.navigate('PlayerDetail', { id: row.playerA._id })}>
                    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.borderLight, justifyContent: 'center', alignItems: 'center', marginRight: 10, overflow: 'hidden' }}>
                      {(row.playerA.photo || row.playerA.userId?.photo) ? (
                        <Image source={{ uri: getImageUrl(row.playerA.photo || row.playerA.userId?.photo) }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                      ) : (
                        <Text style={{ fontFamily: Typography.fontFamily.bold, color: colors.textSecondary, fontSize: 16 }}>{row.playerA.name?.charAt(0).toUpperCase()}</Text>
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={{ fontFamily: Typography.fontFamily.bold, color: colors.textPrimary, fontSize: 13 }} numberOfLines={1}>{row.playerA.name}</Text>
                        {isCaptainPlayerA(row.playerA) && (
                          <View style={{ backgroundColor: colors.primary, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1, marginLeft: 5 }}>
                            <Text style={{ fontSize: 9, fontFamily: Typography.fontFamily.bold, color: '#000000' }}>C</Text>
                          </View>
                        )}
                      </View>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 2, marginTop: 2 }}>
                        {getPlayerTags(row.playerA).map((tag, tIdx) => (
                          <TouchableOpacity key={tIdx} onPress={() => setSelectedTagDefinition(tag)}>
                            <Text style={{ fontFamily: Typography.fontFamily.semiBold, color: tag.type === 'batting' ? '#F39C12' : '#8E44AD', fontSize: 10 }}>
                              {tag.name}{tIdx < getPlayerTags(row.playerA).length - 1 ? <Text style={{ color: colors.textTertiary }}> •</Text> : ''}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  </TouchableOpacity>
                ) : <View style={{ flex: 1 }} />}
              </View>

              <View style={{ width: 1, backgroundColor: '#F5F5F5' }} />

              {/* Player B */}
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 }}>
                {row.playerB ? (
                  <TouchableOpacity style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' }} onPress={() => navigation.navigate('PlayerDetail', { id: row.playerB._id })}>
                    <View style={{ flex: 1, alignItems: 'flex-end' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' }}>
                        {isCaptainPlayerB(row.playerB) && (
                          <View style={{ backgroundColor: colors.primary, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1, marginRight: 5 }}>
                            <Text style={{ fontSize: 9, fontFamily: Typography.fontFamily.bold, color: '#000000' }}>C</Text>
                          </View>
                        )}
                        <Text style={{ fontFamily: Typography.fontFamily.bold, color: colors.textPrimary, fontSize: 13, textAlign: 'right' }} numberOfLines={1}>{row.playerB.name}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 2, marginTop: 2 }}>
                        {getPlayerTags(row.playerB).map((tag, tIdx) => (
                          <TouchableOpacity key={tIdx} onPress={() => setSelectedTagDefinition(tag)}>
                            <Text style={{ fontFamily: Typography.fontFamily.semiBold, color: tag.type === 'batting' ? '#F39C12' : '#8E44AD', fontSize: 10, textAlign: 'right' }}>
                              {tag.name}{tIdx < getPlayerTags(row.playerB).length - 1 ? <Text style={{ color: colors.textTertiary }}> •</Text> : ''}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.borderLight, justifyContent: 'center', alignItems: 'center', marginLeft: 10, overflow: 'hidden' }}>
                      {(row.playerB.photo || row.playerB.userId?.photo) ? (
                        <Image source={{ uri: getImageUrl(row.playerB.photo || row.playerB.userId?.photo) }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                      ) : (
                        <Text style={{ fontFamily: Typography.fontFamily.bold, color: colors.textSecondary, fontSize: 16 }}>{row.playerB.name?.charAt(0).toUpperCase()}</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                ) : <View style={{ flex: 1 }} />}
              </View>

            </View>
          ))}
        </View>

      </ScrollView>
    );
  };

  const getDismissalText = (b) => {
    if (!b.dismissal) return '';
    const type = b.dismissal.type;
    const bowlerName = (b.dismissal.bowler?.name || 'Bowler').split(' ')[0];
    const fielderName = (b.dismissal.fielder?.name || 'Fielder').split(' ')[0];

    switch (type) {
      case 'bowled':
        return `b ${bowlerName}`;
      case 'caught':
      case 'caught_behind':
        return `c ${fielderName} b ${bowlerName}`;
      case 'stumped':
        return `st ${fielderName} b ${bowlerName}`;
      case 'lbw':
        return `lbw b ${bowlerName}`;
      case 'run_out':
        return `run out (${fielderName})`;
      case 'hit_wicket':
        return `hw b ${bowlerName}`;
      case 'caught_and_bowled':
        return `c & b ${bowlerName}`;
      default:
        return type.replace('_', ' ');
    }
  };

  const renderScorecard = () => {
    if (loadingScorecards) {
      return <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 50 }} />;
    }
    let displayScorecards = [...(scorecards || [])];

    if (match.toss && match.toss.winner && displayScorecards.length < 2) {
      const winnerId = match.toss.winner._id || match.toss.winner;
      const isWinnerTeamA = winnerId === (match.teamA?._id || match.teamA);

      let team1Batting = false;
      if ((isWinnerTeamA && match.toss.choice === 'bat') || (!isWinnerTeamA && match.toss.choice === 'bowl')) {
        team1Batting = true;
      }

      const firstBattingTeam = team1Batting ? match.teamA : match.teamB;
      const secondBattingTeam = team1Batting ? match.teamB : match.teamA;
      const firstBowlingTeam = team1Batting ? match.teamB : match.teamA;
      const secondBowlingTeam = team1Batting ? match.teamA : match.teamB;

      if (displayScorecards.length === 0) {
        displayScorecards.push({
          inningsNumber: 1, battingTeam: firstBattingTeam, bowlingTeam: firstBowlingTeam,
          batting: [], bowling: [], total: { runs: 0, wickets: 0, overs: '0.0' }, extras: {}
        });
      }
      if (displayScorecards.length === 1) {
        displayScorecards.push({
          inningsNumber: 2, battingTeam: secondBattingTeam, bowlingTeam: secondBowlingTeam,
          batting: [], bowling: [], total: { runs: 0, wickets: 0, overs: '0.0' }, extras: {}
        });
      }
    }

    if (liveState && displayScorecards.length > 0) {
      const currentInningsIdx = liveState.inningsNumber ? liveState.inningsNumber - 1 : 0;
      if (displayScorecards[currentInningsIdx]) {
        const sc = displayScorecards[currentInningsIdx];
        if (liveState.striker && !sc.batting.find(b => (b.player?._id || b.player)?.toString() === liveState.striker._id?.toString())) {
          sc.batting.push({ player: liveState.striker, runs: 0, balls: 0, fours: 0, sixes: 0, strikeRate: 0, isNotOut: true });
        }
        if (liveState.nonStriker && !sc.batting.find(b => (b.player?._id || b.player)?.toString() === liveState.nonStriker._id?.toString())) {
          sc.batting.push({ player: liveState.nonStriker, runs: 0, balls: 0, fours: 0, sixes: 0, strikeRate: 0, isNotOut: true });
        }
        if (liveState.bowler && !sc.bowling.find(b => (b.player?._id || b.player)?.toString() === liveState.bowler._id?.toString())) {
          sc.bowling.push({ player: liveState.bowler, overs: 0, balls: 0, maidens: 0, runs: 0, wickets: 0, economy: 0 });
        }
      }
    }

    if (!displayScorecards || displayScorecards.length === 0) {
      return <Text style={styles.emptyText}>Scorecard not available yet.</Text>;
    }

    let activeInningsIdx = 0;
    if (liveState?.inningsNumber) {
      activeInningsIdx = liveState.inningsNumber - 1;
    } else if (match?.currentInnings) {
      activeInningsIdx = match.currentInnings - 1;
    } else if (match?.liveState?.inningsNumber) {
      activeInningsIdx = match.liveState.inningsNumber - 1;
    } else if (displayScorecards.length > 1) {
      const secondInningsStarted = (displayScorecards[1].batting && displayScorecards[1].batting.length > 0) ||
        (displayScorecards[1].total && (displayScorecards[1].total.runs > 0 || displayScorecards[1].total.wickets > 0 || displayScorecards[1].total.overs !== '0.0'));
      if (secondInningsStarted) {
        activeInningsIdx = 1;
      }
    }
    activeInningsIdx = Math.max(0, Math.min(activeInningsIdx, displayScorecards.length - 1));

    return (
      <ScrollView contentContainerStyle={styles.content} refreshControl={getRefreshControl()}>
        {displayScorecards.map((sc, index) => {
          const battingTeamName = sc.battingTeam?.name || (sc.battingTeam === match.teamA?._id ? match.teamA?.name : match.teamB?.name);
          const isLiveInnings = (match?.status !== 'completed') && (index === activeInningsIdx);
          const defaultExpanded = (match?.status === 'completed') ? true : (index === activeInningsIdx);
          const isExpanded = expandedInnings[index] !== undefined ? expandedInnings[index] : defaultExpanded;

          return (
            <View key={index} style={{ marginBottom: 24 }}>
              <TouchableOpacity
                onPress={() => toggleInnings(index, isExpanded)}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 12,
                  backgroundColor: isDark ? (isLiveInnings ? 'rgba(255,204,0,0.08)' : colors.surfaceVariant) : colors.surfaceVariant,
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  borderRadius: BorderRadius.lg,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderLeftWidth: isLiveInnings ? 4 : 1,
                  borderLeftColor: isLiveInnings ? colors.primary : colors.border,
                  ...shadows.sm
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ color: colors.textPrimary, fontFamily: Typography.fontFamily.bold, fontWeight: '800', fontSize: 14, textTransform: 'uppercase' }}>
                    {battingTeamName} {sc.inningsNumber >= 3 ? '(Super Over)' : ''}
                  </Text>
                  {isLiveInnings && (
                    <View style={{ backgroundColor: colors.error, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 8 }}>
                      <Text style={{ color: '#FFF', fontSize: 10, fontFamily: Typography.fontFamily.bold }}>LIVE</Text>
                    </View>
                  )}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ color: colors.textPrimary, fontFamily: Typography.fontFamily.semiBold, fontSize: 13 }}>
                    {sc.batting.length > 0 ? (
                      <>{sc.total?.runs || 0}/{sc.total?.wickets || 0} <Text style={{ fontSize: 11, color: colors.textSecondary }}>({sc.total?.overs || '0.0'})</Text></>
                    ) : (
                      <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Yet to bat</Text>
                    )}
                  </Text>
                  <Icon name={isExpanded ? "chevron-up" : "chevron-down"} size={22} color={colors.textSecondary} />
                </View>
              </TouchableOpacity>

              {isExpanded && (
                <View>
                  <View style={[styles.section, { marginBottom: 8 }]}>
                    {/* Batting Scorecard */}
                    {sc.batting.length > 0 ? (
                      <>
                        <View style={styles.tableHeaderRow}>
                          <Text style={[styles.tableHeaderText, { flex: 3, textAlign: 'left' }]}>Batters</Text>
                          <Text style={styles.tableHeaderText}>R</Text>
                          <Text style={styles.tableHeaderText}>B</Text>
                          <Text style={styles.tableHeaderText}>4s</Text>
                          <Text style={styles.tableHeaderText}>6s</Text>
                          <Text style={[styles.tableHeaderText, { flex: 1.5, textAlign: 'right' }]}>SR</Text>
                        </View>
                        {sc.batting.map((b, idx) => (
                          <View key={idx} style={styles.tableRow}>
                            <View style={{ flex: 3 }}>
                              <TouchableOpacity onPress={() => b.player && setSelectedPlayerPreview(b.player)} activeOpacity={0.7}>
                                <Text style={b.isNotOut ? styles.playerNameActive : styles.playerNameClickable} numberOfLines={1}>
                                  {b.player?.name || 'Player'}{b.isNotOut ? ' *' : ''}
                                </Text>
                              </TouchableOpacity>
                              {!b.isNotOut && b.dismissal && (
                                <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 1 }} numberOfLines={1}>{getDismissalText(b)}</Text>
                              )}
                            </View>
                            <Text style={styles.tableRowText}>{b.runs}</Text>
                            <Text style={styles.tableRowText}>{b.balls}</Text>
                            <Text style={styles.tableRowText}>{b.fours}</Text>
                            <Text style={styles.tableRowText}>{b.sixes}</Text>
                            <Text style={[styles.tableRowText, { flex: 1.5, textAlign: 'right' }]}>{b.strikeRate}</Text>
                          </View>
                        ))}

                        {/* Extras Details */}
                        <View style={[styles.tableRow, { borderBottomWidth: 0, marginTop: 8 }]}>
                          <Text style={{ flex: 3, color: colors.textSecondary }}>Extras</Text>
                          <Text style={{ flex: 4, color: colors.textSecondary, fontSize: 12 }}>
                            (W {sc.extras?.wides || 0}, NB {sc.extras?.noBalls || 0}, B {sc.extras?.byes || 0}, LB {sc.extras?.legByes || 0}, P {sc.extras?.penalties || 0})
                          </Text>
                          <Text style={{ flex: 1, textAlign: 'right', fontWeight: 'bold', color: colors.textPrimary }}>
                            {(sc.extras?.wides || 0) + (sc.extras?.noBalls || 0) + (sc.extras?.byes || 0) + (sc.extras?.legByes || 0) + (sc.extras?.penalties || 0)}
                          </Text>
                        </View>
                        <View style={[styles.tableRow, { borderBottomWidth: 0 }]}>
                          <Text style={{ flex: 3, color: colors.textSecondary, fontWeight: 'bold' }}>Total</Text>
                          <Text style={{ flex: 2, textAlign: 'right', fontWeight: 'bold', color: colors.textPrimary }}>
                            {sc.total?.runs || 0}/{sc.total?.wickets || 0} ({sc.total?.overs || '0.0'} Ov)
                          </Text>
                        </View>

                        {/* Did Not Bat */}
                        {(() => {
                          const battingTeamIdStr = (sc.battingTeam?._id || sc.battingTeam)?.toString();
                          const teamAIdStr = (match.teamA?._id || match.teamA)?.toString();
                          const playingXI = battingTeamIdStr === teamAIdStr ? match.playingXI?.teamA : match.playingXI?.teamB;
                          if (!playingXI) return null;
                          const battedIds = sc.batting.map(b => b.player?._id?.toString() || b.player?.toString());
                          const dnb = playingXI.filter(p => !battedIds.includes(p._id?.toString()));
                          if (dnb.length === 0) return null;
                          return (
                            <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.borderLight }}>
                              <Text style={{ color: colors.textTertiary, fontSize: 10, fontFamily: Typography.fontFamily.bold, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 }}>Did Not Bat</Text>
                              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                                {dnb.map((p, idx) => (
                                  <TouchableOpacity
                                    key={idx}
                                    onPress={() => setSelectedPlayerPreview(p)}
                                    activeOpacity={0.7}
                                    style={styles.dnbChip}
                                  >
                                    <Text style={styles.dnbChipText}>{p.name}</Text>
                                    {idx < dnb.length - 1 && <Text style={styles.dnbComma}>,</Text>}
                                  </TouchableOpacity>
                                ))}
                              </View>
                            </View>
                          );
                        })()}

                        {/* Fall of Wickets */}
                        {(() => {
                          const inn = match.innings?.find(i => i.inningsNumber === sc.inningsNumber);
                          if (!inn || !inn.fallOfWickets || inn.fallOfWickets.length === 0) return null;
                          return (
                            <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.borderLight }}>
                              <Text style={{ color: colors.textSecondary, fontSize: 12, fontFamily: Typography.fontFamily.bold, marginBottom: 4 }}>Fall of Wickets</Text>
                              <Text style={{ color: colors.textPrimary, fontSize: 13, lineHeight: 20 }}>
                                {inn.fallOfWickets.map(fow => {
                                  const playerName = fow.batsman?.name || sc.batting.find(b => (b.player?._id || b.player)?.toString() === (fow.batsman?._id || fow.batsman)?.toString())?.player?.name || 'Player';
                                  return `${fow.runs}-${fow.wicket} (${playerName}, ${fow.over} Ov)`;
                                }).join(', ')}
                              </Text>
                            </View>
                          );
                        })()}

                      </>
                    ) : (
                      <View style={{ paddingVertical: 12 }}>
                        <Text style={{ color: colors.textSecondary, fontFamily: Typography.fontFamily.medium, fontSize: 14, marginBottom: 8 }}>Yet to bat</Text>
                        {(() => {
                          const battingTeamIdStr = (sc.battingTeam?._id || sc.battingTeam)?.toString();
                          const teamAIdStr = (match.teamA?._id || match.teamA)?.toString();
                          const playingXI = battingTeamIdStr === teamAIdStr ? match.playingXI?.teamA : match.playingXI?.teamB;
                          if (!playingXI) return null;
                          return (
                            <View style={{ marginTop: 4 }}>
                              {playingXI.map((p, idx) => (
                                <TouchableOpacity key={idx} onPress={() => setSelectedPlayerPreview(p)} style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' }}>
                                  <Text style={styles.playerNameNormal}>{p.name}</Text>
                                </TouchableOpacity>
                              ))}
                            </View>
                          );
                        })()}
                      </View>
                    )}
                  </View>

                  {/* Bowling Scorecard */}
                  {sc.bowling.length > 0 && (
                    <View style={styles.section}>
                      <View style={styles.tableHeaderRow}>
                        <Text style={[styles.tableHeaderText, { flex: 3, textAlign: 'left' }]}>Bowlers</Text>
                        <Text style={styles.tableHeaderText}>O</Text>
                        <Text style={styles.tableHeaderText}>M</Text>
                        <Text style={styles.tableHeaderText}>R</Text>
                        <Text style={styles.tableHeaderText}>W</Text>
                        <Text style={[styles.tableHeaderText, { flex: 1.5, textAlign: 'right' }]}>ER</Text>
                      </View>
                      {sc.bowling.map((b, idx) => (
                        <View key={idx} style={styles.tableRow}>
                          <View style={{ flex: 3 }}>
                            <TouchableOpacity onPress={() => b.player && setSelectedPlayerPreview(b.player)} activeOpacity={0.7}>
                              <Text style={styles.playerNameClickable} numberOfLines={1}>{b.player?.name || 'Player'}</Text>
                            </TouchableOpacity>
                          </View>
                          <Text style={styles.tableRowText}>{b.overs}.{b.balls}</Text>
                          <Text style={styles.tableRowText}>{b.maidens}</Text>
                          <Text style={styles.tableRowText}>{b.runs}</Text>
                          <Text style={b.wickets > 0 ? [styles.tableRowText, { color: colors.primary, fontFamily: Typography.fontFamily.bold }] : styles.tableRowText}>{b.wickets}</Text>
                          <Text style={[styles.tableRowText, { flex: 1.5, textAlign: 'right' }]}>{b.economy}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    );
  };
  const renderPartnerships = () => {
    return (
      <PartnershipsView
        match={match}
        scorecards={scorecards}
        commentary={commentary}
        refreshControl={getRefreshControl()}
      />
    );
  };

  const renderAnalysis = () => {
    if (loadingCommentary || loadingScorecards) {
      return <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 50 }} />;
    }
    if (!commentary || commentary.length === 0) {
      return <Text style={styles.emptyText}>Not enough data for analysis yet.</Text>;
    }

    const isIndoor = match.pitchType === 'Box Cricket' || match.groundType === 'Box Cricket' || match.groundType === 'Indoor';
    const bgImage = isIndoor ? require('../../../turf.png') : require('../../../ground.png');

    let targetTeamId = null;
    if (analysisFilter === 'A') targetTeamId = match.teamA?._id;
    if (analysisFilter === 'B') targetTeamId = match.teamB?._id;

    const analysisBalls = commentary.filter(ball => {
      if (analysisFilter === 'ALL') return true;
      const ballInningsId = (ball.innings?._id || ball.innings).toString();
      const inn = match.innings?.find(i => i._id.toString() === ballInningsId);
      if (inn) {
        const batTeamId = (inn.battingTeam?._id || inn.battingTeam).toString();
        return batTeamId === targetTeamId?.toString();
      }
      return false;
    });

    const finalBalls = selectedAnalysisBatter
      ? analysisBalls.filter(b => (b.batsman?._id || b.batsman).toString() === selectedAnalysisBatter._id.toString())
      : analysisBalls;

    let totalRuns = 0;
    let dotBalls = 0;
    let fours = 0;
    let sixes = 0;
    let extras = 0;
    const wagonWheelPoints = [];

    const zoneDist = { OFF: 0, LEG: 0, STRAIGHT: 0, BEHIND: 0 };
    const overStatsMap = {};

    finalBalls.forEach(ball => {
      totalRuns += ball.totalRuns || 0;
      if (ball.extraRuns > 0 && (ball.isWide || ball.isNoBall || ball.isBye || ball.isLegBye)) {
        extras += ball.extraRuns;
      } else {
        const runs = ball.batsmanRuns || 0;
        if (runs === 0 && !ball.isWicket) dotBalls++;
        if (runs === 4 || ball.isBoundary) fours++;
        if (runs === 6 || ball.isSix) sixes++;
      }
      if (ball.batsmanRuns === 0 && ball.extraRuns === 0 && !ball.isWicket) dotBalls++;
      if (ball.batsmanRuns === 4 || ball.isBoundary) fours++;
      if (ball.batsmanRuns === 6 || ball.isSix) sixes++;

      const oNum = ball.overNumber;
      if (oNum !== undefined) {
        if (!overStatsMap[oNum]) overStatsMap[oNum] = { runs: 0, wickets: 0, legalBalls: 0 };
        overStatsMap[oNum].runs += ball.totalRuns || 0;
        if (!ball.isWide && !ball.isNoBall) overStatsMap[oNum].legalBalls += 1;
        if (ball.isWicket) overStatsMap[oNum].wickets += 1;
      }

      if (ball.wagonWheel && ball.wagonWheel.angle !== undefined) {
        wagonWheelPoints.push({ ...ball.wagonWheel, runs: ball.batsmanRuns || 0, batsmanRuns: ball.batsmanRuns || 0 });
        const angle = ball.wagonWheel.angle;
        const runs = ball.totalRuns || 0;
        if (angle >= -135 && angle < -45) zoneDist.BEHIND += runs;
        else if (angle >= -45 && angle < 45) zoneDist.LEG += runs;
        else if (angle >= 45 && angle < 135) zoneDist.STRAIGHT += runs;
        else zoneDist.OFF += runs;
      }
    });

    // Deduplicate fours/sixes count (above loop was double-counting)
    fours = 0; sixes = 0; dotBalls = 0;
    finalBalls.forEach(ball => {
      if (ball.batsmanRuns === 4 || ball.isBoundary) fours++;
      if (ball.batsmanRuns === 6 || ball.isSix) sixes++;
      if (ball.batsmanRuns === 0 && ball.extraRuns === 0 && !ball.isWicket && !ball.isWide && !ball.isNoBall) dotBalls++;
    });

    const totalValidBalls = finalBalls.filter(b => !b.isWide && !b.isNoBall).length;

    // ─── Team-split overs data ───────────────────────────────────────────
    const teamAId = String(match.teamA?._id || match.teamA || '');
    const teamBId = String(match.teamB?._id || match.teamB || '');
    const teamAOvers = {};
    const teamBOvers = {};

    analysisBalls.forEach(ball => {
      const oNum = ball.overNumber;
      if (oNum === undefined) return;
      const ballInningsId = String(ball.innings?._id || ball.innings || '');
      let isTeamABatting = false;
      const inningsIndex = match.innings?.findIndex(inn => String(inn._id || inn) === ballInningsId);
      if (inningsIndex !== -1 && inningsIndex !== undefined) {
        const inningsObj = match.innings[inningsIndex];
        const battingTeamId = String(inningsObj?.battingTeam?._id || inningsObj?.battingTeam || '');
        isTeamABatting = battingTeamId === teamAId;
      } else {
        const batsmanId = String(ball.batsman?._id || ball.batsman || '');
        const teamAXI = match.playingXI?.teamA || [];
        isTeamABatting = teamAXI.some(p => String(p._id || p) === batsmanId);
      }

      if (isTeamABatting) {
        if (!teamAOvers[oNum]) teamAOvers[oNum] = { runs: 0, wickets: 0, legalBalls: 0 };
        teamAOvers[oNum].runs += ball.totalRuns || 0;
        if (!ball.isWide && !ball.isNoBall) teamAOvers[oNum].legalBalls += 1;
        if (ball.isWicket) teamAOvers[oNum].wickets += 1;
      } else {
        if (!teamBOvers[oNum]) teamBOvers[oNum] = { runs: 0, wickets: 0, legalBalls: 0 };
        teamBOvers[oNum].runs += ball.totalRuns || 0;
        if (!ball.isWide && !ball.isNoBall) teamBOvers[oNum].legalBalls += 1;
        if (ball.isWicket) teamBOvers[oNum].wickets += 1;
      }
    });

    const allOversUnion = Array.from(new Set([
      ...Object.keys(teamAOvers).map(Number),
      ...Object.keys(teamBOvers).map(Number)
    ])).sort((a, b) => a - b);

    // ─── Wagon wheel helper ──────────────────────────────────────────────
    const getScaledLineLength = (point, currentW, currentH, currentCY_ACTUAL, currentCY, isTurfMatch) => {
      const angle = point.angle;
      let runs = point.runs !== undefined ? point.runs : (point.batsmanRuns || 0);
      if (point.color === '#E53935' || point.color?.toLowerCase() === 'red') runs = 6;
      else if (point.color === '#4CAF50' || point.color?.toLowerCase() === 'green') runs = 4;

      const rad = angle * (Math.PI / 180);
      const dx = Math.cos(rad);
      const dy = Math.sin(rad);

      const startX = currentW / 2;
      const startY = currentCY_ACTUAL;

      let maxDistToBoundary = currentW / 2;

      if (isTurfMatch) {
        const marginX = 2;
        const marginY = 2;
        const tMaxX = dx > 0 ? (currentW - marginX - startX) / dx : dx < 0 ? (marginX - startX) / dx : Infinity;
        const tMaxY = dy > 0 ? (currentH - marginY - startY) / dy : dy < 0 ? (marginY - startY) / dy : Infinity;
        maxDistToBoundary = Math.min(tMaxX, tMaxY);
      } else {
        const vx = startX - (currentW / 2);
        const vy = startY - currentCY;
        const r = (currentW / 2) - 2;
        const b = (vx * dx + vy * dy);
        const c = (vx * vx + vy * vy) - (r * r);
        const disc = b * b - c;
        if (disc >= 0) {
          maxDistToBoundary = -b + Math.sqrt(disc);
        } else {
          maxDistToBoundary = r;
        }
      }

      // 6s and 4s go all the way to the boundary edge/rope
      if (runs >= 6) return maxDistToBoundary * 0.98;
      if (runs === 4 || runs === 5) return maxDistToBoundary * 0.96;
      if (runs === 3) return maxDistToBoundary * 0.78;
      if (runs === 2) return maxDistToBoundary * 0.58;
      if (runs === 1) return maxDistToBoundary * 0.38;
      return maxDistToBoundary * 0.22;
    };

    const battersMap = {};
    analysisBalls.forEach(b => {
      if (b.batsman && b.batsman._id) battersMap[b.batsman._id] = b.batsman;
    });
    const battersList = Object.values(battersMap);

    // ─── RUN RATE / MOMENTUM DATA ───────────────────────────────────────
    // Use ALL balls (not finalBalls) for momentum since it's team-level
    const hasTeamA = Object.keys(teamAOvers).length > 0;
    const hasTeamB = Object.keys(teamBOvers).length > 0;
    const bothTeams = hasTeamA && hasTeamB && analysisFilter === 'ALL';

    // Build momentum series
    const momentumOvers = allOversUnion.length > 0 ? allOversUnion : Object.keys(overStatsMap).map(Number).sort((a, b) => a - b);
    const teamARunRates = momentumOvers.map(o => {
      const d = teamAOvers[o];
      if (!d) return null;
      const lb = d.legalBalls || 6;
      return parseFloat(((d.runs / lb) * 6).toFixed(2));
    });
    const teamBRunRates = momentumOvers.map(o => {
      const d = teamBOvers[o];
      if (!d) return null;
      const lb = d.legalBalls || 6;
      return parseFloat(((d.runs / lb) * 6).toFixed(2));
    });

    // Single team momentum (when filter is A or B)
    const singleOversList = Object.keys(overStatsMap).map(Number).sort((a, b) => a - b);
    const singleRunRates = singleOversList.map(o => {
      const d = overStatsMap[o];
      const lb = d.legalBalls || 6;
      return parseFloat(((d.runs / lb) * 6).toFixed(2));
    });

    const activeOvers = bothTeams ? momentumOvers : singleOversList;
    const activeARunRates = bothTeams ? teamARunRates : singleRunRates;
    const activeBRunRates = bothTeams ? teamBRunRates : [];

    const allRRValues = [...activeARunRates.filter(v => v !== null), ...activeBRunRates.filter(v => v !== null)];
    const maxRR = Math.max(...allRRValues, 1);

    // Powerplay runs (overs 1–6)
    const ppRunsA = Object.entries(teamAOvers).filter(([o]) => Number(o) <= 6).reduce((s, [, d]) => s + d.runs, 0);
    const ppRunsB = Object.entries(teamBOvers).filter(([o]) => Number(o) <= 6).reduce((s, [, d]) => s + d.runs, 0);
    const ppRunsSingle = Object.entries(overStatsMap).filter(([o]) => Number(o) <= 6).reduce((s, [, d]) => s + d.runs, 0);
    const ppRuns = bothTeams ? ppRunsA + ppRunsB : ppRunsSingle;

    // Highest and lowest scoring over
    const activeOverRunsA = activeOvers.map((o, i) => ({ over: o, runs: bothTeams ? (teamAOvers[o]?.runs || null) : (overStatsMap[o]?.runs || 0) })).filter(x => x.runs !== null);
    const highestOver = activeOverRunsA.reduce((best, x) => x.runs > (best?.runs || -1) ? x : best, null);
    const lowestOver = activeOverRunsA.filter(x => x.runs >= 0).reduce((worst, x) => x.runs < (worst?.runs ?? 999) ? x : worst, null);

    // Current RR: total runs / total legal overs
    const totalLegalBalls = finalBalls.filter(b => !b.isWide && !b.isNoBall).length;
    const totalOversDecimal = Math.floor(totalLegalBalls / 6) + (totalLegalBalls % 6) / 10;
    const currentRR = totalLegalBalls > 0 ? ((totalRuns / totalLegalBalls) * 6).toFixed(2) : '0.00';

    // Chart dimensions
    const Y_AXIS_W = 30;
    const CHART_W = SCREEN_WIDTH - 64 - Y_AXIS_W;
    const CHART_H = 100;
    const momentumPoints = activeOvers.length;

    // ─── BOWLING ECONOMY DATA ────────────────────────────────────────────
    const bowlingDataRaw = {};
    if (scorecards && scorecards.length > 0) {
      scorecards.forEach(sc => {
        sc.bowling?.forEach(b => {
          if (!b.player) return;
          const pid = b.player._id?.toString();
          if (!bowlingDataRaw[pid]) bowlingDataRaw[pid] = {
            id: pid, name: b.player.name, photo: b.player.photo || b.player.userId?.photo,
            overs: 0, balls: 0, maidens: 0, runs: 0, wickets: 0
          };
          bowlingDataRaw[pid].overs += b.overs || 0;
          bowlingDataRaw[pid].balls += b.balls || 0;
          bowlingDataRaw[pid].maidens += b.maidens || 0;
          bowlingDataRaw[pid].runs += b.runs || 0;
          bowlingDataRaw[pid].wickets += b.wickets || 0;
        });
      });
    }

    const bowlersList = Object.values(bowlingDataRaw)
      .map(b => {
        const totalBalls = (b.overs * 6) + b.balls;
        const totalOvers = totalBalls > 0 ? totalBalls / 6 : 0;
        const economy = totalOvers > 0 ? b.runs / totalOvers : 0;
        const oversStr = `${Math.floor(totalBalls / 6)}.${totalBalls % 6}`;
        const spell = `${Math.floor(totalBalls / 6)}-${b.maidens}-${b.runs}-${b.wickets}`;
        return { ...b, totalBalls, totalOvers, economy, oversStr, spell };
      })
      .filter(b => b.totalBalls > 0)
      .sort((a, b) => a.economy - b.economy);

    const bestEconomy = bowlersList[0];
    const mostWickets = [...bowlersList].sort((a, b) => b.wickets - a.wickets)[0];
    const bestSpell = [...bowlersList].sort((a, b) => b.wickets - a.wickets || a.economy - b.economy)[0];
    const maxEconomy = Math.max(...bowlersList.map(b => b.economy), 1);

    // ─── BATTING IMPACT (SCATTER) DATA ──────────────────────────────────
    const battingImpactData = {};
    if (scorecards && scorecards.length > 0) {
      scorecards.forEach(sc => {
        sc.batting?.forEach(b => {
          if (!b.player || b.balls === 0) return;
          // Apply team filter
          if (analysisFilter !== 'ALL') {
            const battingTeamId = String(sc.battingTeam?._id || sc.battingTeam || '');
            if (analysisFilter === 'A' && battingTeamId !== teamAId) return;
            if (analysisFilter === 'B' && battingTeamId !== teamBId) return;
          }
          const pid = b.player._id?.toString();
          if (!battingImpactData[pid]) battingImpactData[pid] = {
            id: pid, name: b.player.name, photo: b.player.photo || b.player.userId?.photo,
            runs: 0, balls: 0, fours: 0, sixes: 0
          };
          battingImpactData[pid].runs += b.runs || 0;
          battingImpactData[pid].balls += b.balls || 0;
          battingImpactData[pid].fours += b.fours || 0;
          battingImpactData[pid].sixes += b.sixes || 0;
        });
      });
    }

    const scatterBatters = Object.values(battingImpactData)
      .filter(b => b.balls > 0)
      .map(b => ({ ...b, sr: parseFloat(((b.runs / b.balls) * 100).toFixed(1)) }));

    const maxRuns = Math.max(...scatterBatters.map(b => b.runs), 1);
    const maxSR = Math.max(...scatterBatters.map(b => b.sr), 1);
    const minSR = Math.min(...scatterBatters.map(b => b.sr), 0);

    const SCATTER_W = SCREEN_WIDTH - 64;
    const SCATTER_H = 160;
    const SCATTER_PAD_L = 36;
    const SCATTER_PAD_B = 28;
    const SCATTER_INNER_W = SCATTER_W - SCATTER_PAD_L - 8;
    const SCATTER_INNER_H = SCATTER_H - SCATTER_PAD_B - 8;

    // ─── JSX ────────────────────────────────────────────────────────────
    return (
      <ScrollView contentContainerStyle={styles.content} refreshControl={getRefreshControl()}>

        {/* ── Dropdown Filters ── */}
        <View style={{ flexDirection: 'row', marginBottom: 16, marginHorizontal: -4 }}>
          <AnalysisDropdown
            value={analysisFilter}
            options={[
              { label: 'All Teams', value: 'ALL' },
              { label: match.teamA?.shortName || match.teamA?.name || 'Team A', value: 'A' },
              { label: match.teamB?.shortName || match.teamB?.name || 'Team B', value: 'B' }
            ]}
            onSelect={(val) => { setAnalysisFilter(val); setSelectedAnalysisBatter(null); }}
            placeholder="Select Team"
          />
          <AnalysisDropdown
            value={selectedAnalysisBatter}
            options={[
              { label: 'All Batters', value: null },
              ...battersList.map(b => ({ label: b.name, value: b }))
            ]}
            onSelect={(val) => setSelectedAnalysisBatter(val)}
            placeholder="Select Batter"
          />
        </View>

        {/* ── Quick Stats Row ── */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
          {[
            { label: 'RUNS', value: totalRuns },
            { label: 'BOUNDARIES', value: `${fours}×4  ${sixes}×6` },
            { label: 'DOT %', value: totalValidBalls > 0 ? `${Math.round((dotBalls / totalValidBalls) * 100)}%` : '—' },
            { label: 'EXTRAS', value: extras },
          ].map((stat, i) => (
            <View key={i} style={{
              flex: 1, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1,
              borderColor: colors.borderLight, paddingVertical: 10, alignItems: 'center'
            }}>
              <Text style={{ color: colors.textSecondary, fontSize: 9, letterSpacing: 0.8, fontFamily: Typography.fontFamily.semiBold, textTransform: 'uppercase', marginBottom: 4 }}>{stat.label}</Text>
              <Text style={{ color: colors.textPrimary, fontSize: 14, fontFamily: Typography.fontFamily.bold }}>{stat.value}</Text>
            </View>
          ))}
        </View>

        {/* ══════════════════════════════════════════════════════════════════
            1. WAGON WHEEL
        ══════════════════════════════════════════════════════════════════ */}
        <View style={[styles.section, { alignItems: 'center', paddingVertical: 24 }]}>
          <View style={{ alignSelf: 'flex-start', marginBottom: 6, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ color: isDark ? '#FFD400' : colors.primaryDark, fontSize: 10, letterSpacing: 1, fontFamily: Typography.fontFamily.bold, textTransform: 'uppercase' }}>SHOT CHART</Text>
          </View>
          <Text style={[styles.sectionTitle, { marginBottom: 20, alignSelf: 'flex-start' }]}>Wagon Wheel</Text>
          {(() => {
            const W = isIndoor ? 200 : 240;
            const H = isIndoor ? 300 : 240;
            const CX = W / 2;
            const CY = H / 2;
            const CY_ACTUAL = CY - (isIndoor ? 50 : 32);
            const padX = 35;
            const padY = 10;
            return (
              <View style={{ width: W + padX * 2, height: H + padY * 2, justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
                <View style={{ width: W, height: H, borderRadius: isIndoor ? 16 : W / 2, overflow: 'hidden', backgroundColor: '#4CAF50' }}>
                  <ImageBackground source={bgImage} style={{ width: W, height: H }} resizeMode="cover">
                    <View style={{ position: 'absolute', left: CX - 3, top: CY_ACTUAL - 3, width: 6, height: 6, borderRadius: 3, backgroundColor: 'red' }} />
                    {wagonWheelPoints.map((point, idx) => {
                      let shotColor = point.color;
                      if (point.runs === 6 || point.batsmanRuns === 6) shotColor = '#E53935';
                      else if (point.runs === 4 || point.batsmanRuns === 4) shotColor = '#4CAF50';
                      else if (point.runs === 3 || point.batsmanRuns === 3) shotColor = '#FFD700';
                      else if (point.runs === 1 || point.runs === 2 || point.batsmanRuns === 1 || point.batsmanRuns === 2) shotColor = '#FFFFFF';
                      if (!shotColor) shotColor = '#FFFFFF';
                      const lineLength = getScaledLineLength(point, W, H, CY_ACTUAL, CY, isIndoor);
                      return (
                        <View key={idx} style={{
                          position: 'absolute', left: CX - lineLength, top: CY_ACTUAL - 1,
                          width: lineLength * 2, height: 1.5, justifyContent: 'center', alignItems: 'flex-end',
                          transform: [{ rotate: `${point.angle}deg` }]
                        }}>
                          <View style={{ width: lineLength, height: 1.5, backgroundColor: shotColor }} />
                        </View>
                      );
                    })}
                  </ImageBackground>
                </View>
                <Text style={{ position: 'absolute', left: 4, top: CY_ACTUAL + padY - 8, color: colors.textSecondary, fontSize: 12, fontFamily: Typography.fontFamily.bold }}>OFF</Text>
                <Text style={{ position: 'absolute', right: 4, top: CY_ACTUAL + padY - 8, color: colors.textSecondary, fontSize: 12, fontFamily: Typography.fontFamily.bold }}>LEG</Text>
              </View>
            );
          })()}
          {/* Legend */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 16, marginTop: 14, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.borderLight }}>
            {[['#E53935', '6s'], ['#4CAF50', '4s'], ['#FFD700', '3s'], ['#FFFFFF', '1s & 2s']].map(([col, lbl]) => (
              <View key={lbl} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 14, height: 2.5, backgroundColor: col, borderRadius: 1 }} />
                <Text style={{ color: colors.textSecondary, fontSize: 11, fontFamily: Typography.fontFamily.semiBold }}>{lbl}</Text>
              </View>
            ))}
          </View>
          {wagonWheelPoints.length === 0 && (
            <Text style={{ color: colors.textSecondary, marginTop: 16, fontStyle: 'italic', fontSize: 12 }}>No wagon wheel data recorded.</Text>
          )}
        </View>

        {/* ══════════════════════════════════════════════════════════════════
            2. RUN RATE / MOMENTUM
        ══════════════════════════════════════════════════════════════════ */}
        <View style={[styles.section, { padding: 20, marginBottom: 0 }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <View>
              <Text style={{ color: isDark ? '#FFD400' : colors.primaryDark, fontSize: 10, letterSpacing: 1, fontFamily: Typography.fontFamily.bold, textTransform: 'uppercase', marginBottom: 4 }}>MOMENTUM</Text>
              <Text style={styles.sectionTitle}>Run Rate / Over</Text>
            </View>
            {bothTeams && (
              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary }} />
                  <Text style={{ color: colors.textSecondary, fontSize: 10, fontFamily: Typography.fontFamily.semiBold }}>
                    {match.teamA?.shortName || 'A'}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: isDark ? '#FFFFFF' : '#333333' }} />
                  <Text style={{ color: colors.textSecondary, fontSize: 10, fontFamily: Typography.fontFamily.semiBold }}>
                    {match.teamB?.shortName || 'B'}
                  </Text>
                </View>
              </View>
            )}
          </View>

          {activeOvers.length > 0 ? (
            <View>
              {/* Line chart using custom SVG-like View layout with Y-axis */}
              <View style={{ height: CHART_H + 24, flexDirection: 'row', position: 'relative' }}>
                {/* Y-axis Labels */}
                <View style={{ width: Y_AXIS_W, height: CHART_H, justifyContent: 'space-between', alignItems: 'flex-end', paddingRight: 8 }}>
                  {[1, 0.75, 0.5, 0.25, 0].map((frac, idx) => (
                    <Text key={idx} style={{ color: colors.textSecondary, fontSize: 8, fontFamily: Typography.fontFamily.medium, lineHeight: 10 }}>
                      {Math.round(maxRR * frac)}
                    </Text>
                  ))}
                </View>

                {/* Chart Area */}
                <View style={{ width: CHART_W, height: CHART_H + 24, position: 'relative' }}>
                  {/* Horizontal grid lines */}
                  {[0, 0.25, 0.5, 0.75, 1].map((frac, i) => (
                    <View key={i} style={{
                      position: 'absolute', left: 0, right: 0,
                      top: CHART_H * (1 - frac),
                      height: 1, backgroundColor: colors.border
                    }} />
                  ))}

                  {/* Team A line (or single team) */}
                  {activeARunRates.map((rr, i) => {
                    if (rr === null || i === 0) return null;
                    const prevRR = activeARunRates[i - 1];
                    if (prevRR === null) return null;
                    const x1 = ((i - 1) / Math.max(activeOvers.length - 1, 1)) * CHART_W;
                    const x2 = (i / Math.max(activeOvers.length - 1, 1)) * CHART_W;
                    const y1 = CHART_H - (prevRR / maxRR) * CHART_H;
                    const y2 = CHART_H - (rr / maxRR) * CHART_H;
                    const length = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
                    const angle = Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);
                    return (
                      <View key={`a-${i}`} style={{
                        position: 'absolute', left: x1, top: y1,
                        width: length, height: 2.5, backgroundColor: colors.primary,
                        borderRadius: 1, opacity: 0.95,
                        transform: [{ rotate: `${angle}deg` }],
                        transformOrigin: '0% 50%'
                      }} />
                    );
                  })}

                  {/* Team B line */}
                  {bothTeams && activeBRunRates.map((rr, i) => {
                    if (rr === null || i === 0) return null;
                    const prevRR = activeBRunRates[i - 1];
                    if (prevRR === null) return null;
                    const x1 = ((i - 1) / Math.max(activeOvers.length - 1, 1)) * CHART_W;
                    const x2 = (i / Math.max(activeOvers.length - 1, 1)) * CHART_W;
                    const y1 = CHART_H - (prevRR / maxRR) * CHART_H;
                    const y2 = CHART_H - (rr / maxRR) * CHART_H;
                    const length = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
                    const angle = Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);
                    return (
                      <View key={`b-${i}`} style={{
                        position: 'absolute', left: x1, top: y1,
                        width: length, height: 2, backgroundColor: isDark ? '#FFFFFF' : '#333333',
                        borderRadius: 1, opacity: 0.85,
                        transform: [{ rotate: `${angle}deg` }],
                        transformOrigin: '0% 50%'
                      }} />
                    );
                  })}

                  {/* Data points for Team A */}
                  {activeARunRates.map((rr, i) => {
                    if (rr === null) return null;
                    const x = (i / Math.max(activeOvers.length - 1, 1)) * CHART_W;
                    const y = CHART_H - (rr / maxRR) * CHART_H;
                    const isLatest = i === activeARunRates.filter(v => v !== null).length - 1;
                    const isHighest = highestOver && activeOvers[i] === highestOver.over;
                    return (
                      <View key={`apt-${i}`} style={{
                        position: 'absolute', left: x - 4, top: y - 4,
                        width: 8, height: 8, borderRadius: 4,
                        backgroundColor: colors.primary,
                        borderWidth: isLatest || isHighest ? 2 : 0,
                        borderColor: isHighest ? '#E53935' : '#000000',
                        zIndex: 2
                      }} />
                    );
                  })}

                  {/* Data points for Team B */}
                  {bothTeams && activeBRunRates.map((rr, i) => {
                    if (rr === null) return null;
                    const x = (i / Math.max(activeOvers.length - 1, 1)) * CHART_W;
                    const y = CHART_H - (rr / maxRR) * CHART_H;
                    const isLatest = i === activeBRunRates.filter(v => v !== null).length - 1;
                    return (
                      <View key={`bpt-${i}`} style={{
                        position: 'absolute', left: x - 4, top: y - 4,
                        width: 8, height: 8, borderRadius: 4,
                        backgroundColor: isDark ? '#FFFFFF' : '#333333',
                        borderWidth: isLatest ? 2 : 0,
                        borderColor: colors.primary,
                        zIndex: 2
                      }} />
                    );
                  })}

                  {/* Over labels on x-axis */}
                  {activeOvers.map((o, i) => {
                    const x = (i / Math.max(activeOvers.length - 1, 1)) * CHART_W;
                    if (activeOvers.length > 12 && i % 3 !== 0) return null;
                    if (activeOvers.length > 6 && activeOvers.length <= 12 && i % 2 !== 0) return null;
                    return (
                      <Text key={`xl-${i}`} style={{
                        position: 'absolute', top: CHART_H + 6, left: x - 20,
                        width: 40, textAlign: 'center',
                        color: colors.textSecondary, fontSize: 9, fontFamily: Typography.fontFamily.medium
                      }}>Ov {o}</Text>
                    );
                  })}
                </View>
              </View>

              {/* Insight row */}
              <View style={{
                flexDirection: 'row', marginTop: 20, paddingTop: 16,
                borderTopWidth: 1, borderTopColor: colors.borderLight, gap: 4
              }}>
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={{ color: colors.textSecondary, fontSize: 9, letterSpacing: 0.5, textTransform: 'uppercase', fontFamily: Typography.fontFamily.semiBold, marginBottom: 4 }}>HIGHEST OVER</Text>
                  <Text style={{ color: colors.textPrimary, fontSize: 18, fontFamily: Typography.fontFamily.bold, lineHeight: 20 }}>
                    {highestOver ? highestOver.runs : '—'}
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 10, marginTop: 2 }}>
                    {highestOver ? `Over ${highestOver.over}` : ''}
                  </Text>
                </View>
                <View style={{ width: 1, backgroundColor: colors.borderLight }} />
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={{ color: colors.textSecondary, fontSize: 9, letterSpacing: 0.5, textTransform: 'uppercase', fontFamily: Typography.fontFamily.semiBold, marginBottom: 4 }}>CURR. RR</Text>
                  <Text style={{ color: isDark ? '#FFD400' : colors.primaryDark, fontSize: 18, fontFamily: Typography.fontFamily.bold, lineHeight: 20 }}>{currentRR}</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 10, marginTop: 2 }}>per over</Text>
                </View>
              </View>
            </View>
          ) : (
            <Text style={{ color: colors.textSecondary, fontSize: 12, fontStyle: 'italic' }}>Not enough over data yet.</Text>
          )}
        </View>

        {/* ══════════════════════════════════════════════════════════════════
            3. BOWLING ECONOMY
        ══════════════════════════════════════════════════════════════════ */}
        <View style={[styles.section, { padding: 20, marginTop: 12, marginBottom: 0 }]}>
          <View style={{ marginBottom: 16 }}>
            <Text style={{ color: isDark ? '#FFD400' : colors.primaryDark, fontSize: 10, letterSpacing: 1, fontFamily: Typography.fontFamily.bold, textTransform: 'uppercase', marginBottom: 4 }}>BOWLING</Text>
            <Text style={styles.sectionTitle}>Bowling Economy</Text>
          </View>

          {bowlersList.length > 0 ? (
            <View>
              {bowlersList.map((bowler, idx) => {
                const barWidth = Math.max((bowler.economy / maxEconomy) * 100, 4);
                const isBest = bestEconomy && bowler.id === bestEconomy.id;
                return (
                  <View key={bowler.id} style={{
                    marginBottom: 14, paddingBottom: 14,
                    borderBottomWidth: idx < bowlersList.length - 1 ? 1 : 0,
                    borderBottomColor: colors.borderLight
                  }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                      {/* Avatar */}
                      <View style={{
                        width: 32, height: 32, borderRadius: 16, marginRight: 10,
                        backgroundColor: isBest ? 'rgba(255,204,0,0.15)' : colors.surfaceVariant,
                        borderWidth: isBest ? 1.5 : 0, borderColor: colors.primary,
                        justifyContent: 'center', alignItems: 'center'
                      }}>
                        {bowler.photo ? (
                          <Image source={{ uri: getImageUrl(bowler.photo) }} style={{ width: 32, height: 32, borderRadius: 16 }} />
                        ) : (
                          <Text style={{ color: isBest ? (isDark ? '#FFD400' : colors.primaryDark) : colors.textSecondary, fontSize: 13, fontFamily: Typography.fontFamily.bold }}>
                            {bowler.name?.charAt(0).toUpperCase()}
                          </Text>
                        )}
                      </View>
                      {/* Name and stats */}
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={{ color: colors.textPrimary, fontSize: 13, fontFamily: Typography.fontFamily.semiBold }}>{bowler.name}</Text>
                          {isBest && (
                            <View style={{ backgroundColor: 'rgba(255,204,0,0.15)', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 }}>
                              <Text style={{ color: isDark ? '#FFD400' : colors.primaryDark, fontSize: 8, fontFamily: Typography.fontFamily.bold, letterSpacing: 0.5 }}>BEST</Text>
                            </View>
                          )}
                        </View>
                        <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 1 }}>
                          {bowler.oversStr} ov  ·  {bowler.wickets} wkt{bowler.wickets !== 1 ? 's' : ''}  ·  {bowler.maidens}M
                        </Text>
                      </View>
                      {/* Economy */}
                      <Text style={{
                        color: isBest ? (isDark ? '#FFD400' : colors.primaryDark) : colors.textPrimary,
                        fontSize: 16, fontFamily: Typography.fontFamily.bold
                      }}>
                        {bowler.economy.toFixed(2)}
                      </Text>
                    </View>
                    {/* Economy bar */}
                    <View style={{ height: 6, backgroundColor: colors.borderLight, borderRadius: 3, overflow: 'hidden' }}>
                      <View style={{
                        width: `${barWidth}%`, height: '100%', borderRadius: 3,
                        backgroundColor: isBest ? colors.primary : colors.primaryAlpha30
                      }} />
                    </View>
                  </View>
                );
              })}

              {/* Summary row */}
              <View style={{
                flexDirection: 'row', marginTop: 4, paddingTop: 14,
                borderTopWidth: 1, borderTopColor: colors.borderLight, gap: 4
              }}>
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={{ color: colors.textSecondary, fontSize: 9, letterSpacing: 0.5, textTransform: 'uppercase', fontFamily: Typography.fontFamily.semiBold, marginBottom: 4 }}>BEST ECONOMY</Text>
                  <Text style={{ color: isDark ? '#FFD400' : colors.primaryDark, fontSize: 14, fontFamily: Typography.fontFamily.bold }}>{bestEconomy?.economy.toFixed(2) || '—'}</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 10, marginTop: 2 }} numberOfLines={1}>{bestEconomy?.name || ''}</Text>
                </View>
                <View style={{ width: 1, backgroundColor: colors.borderLight }} />
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={{ color: colors.textSecondary, fontSize: 9, letterSpacing: 0.5, textTransform: 'uppercase', fontFamily: Typography.fontFamily.semiBold, marginBottom: 4 }}>MOST WICKETS</Text>
                  <Text style={{ color: colors.primary, fontSize: 14, fontFamily: Typography.fontFamily.bold }}>{mostWickets?.wickets || '—'}</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 10, marginTop: 2 }} numberOfLines={1}>{mostWickets?.name || ''}</Text>
                </View>
                <View style={{ width: 1, backgroundColor: colors.borderLight }} />
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={{ color: colors.textSecondary, fontSize: 9, letterSpacing: 0.5, textTransform: 'uppercase', fontFamily: Typography.fontFamily.semiBold, marginBottom: 4 }}>BEST SPELL</Text>
                  <Text style={{ color: colors.textPrimary, fontSize: 13, fontFamily: Typography.fontFamily.bold }}>{bestSpell?.spell || '—'}</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 10, marginTop: 2 }} numberOfLines={1}>{bestSpell?.name || ''}</Text>
                </View>
              </View>
            </View>
          ) : (
            <Text style={{ color: colors.textSecondary, fontSize: 12, fontStyle: 'italic' }}>No bowling data available yet.</Text>
          )}
        </View>

        {/* ══════════════════════════════════════════════════════════════════
            4. BATTING IMPACT (Quadrant Scatter + Interactive Spotlight)
        ══════════════════════════════════════════════════════════════════ */}
        <View style={[styles.section, { padding: 20, marginTop: 12, marginBottom: 0 }]}>
          <View style={{ marginBottom: 16 }}>
            <Text style={{ color: isDark ? '#FFD400' : colors.primaryDark, fontSize: 10, letterSpacing: 1, fontFamily: Typography.fontFamily.bold, textTransform: 'uppercase', marginBottom: 4 }}>BATTING</Text>
            <Text style={styles.sectionTitle}>Batting Impact</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 2 }}>Runs vs Strike Rate · Tap any dot or player to inspect</Text>
          </View>

          {scatterBatters.length > 0 ? (() => {
            const getBatterTier = (b) => {
              if (b.runs >= 20 && b.sr >= 130) {
                return { name: 'High Impact', emoji: '🚀', color: '#FFB300', bg: isDark ? 'rgba(255,179,0,0.15)' : '#FFF8E1' };
              }
              if (b.sr >= 140) {
                return { name: 'Quick Fire', emoji: '⚡', color: '#FFD633', bg: isDark ? 'rgba(255,214,51,0.15)' : '#FFFDE7' };
              }
              if (b.runs >= 20) {
                return { name: 'Anchor', emoji: '⚓', color: '#2ED573', bg: isDark ? 'rgba(46,213,115,0.15)' : '#E8F5E9' };
              }
              return { name: 'Builder', emoji: '🛡️', color: colors.textSecondary, bg: isDark ? 'rgba(255,255,255,0.06)' : colors.surfaceVariant };
            };

            const activeBatter = selectedBatterDot || scatterBatters.sort((a, b) => (b.runs * b.sr) - (a.runs * a.sr))[0];
            const activeTier = activeBatter ? getBatterTier(activeBatter) : null;

            return (
              <View>
                {/* Zone Legend */}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12, paddingHorizontal: 2 }}>
                  {[
                    { label: 'High Impact', emoji: '🚀', color: '#FFB300' },
                    { label: 'Quick Fire', emoji: '⚡', color: '#FFD633' },
                    { label: 'Anchor', emoji: '⚓', color: '#2ED573' },
                    { label: 'Builder', emoji: '🛡️', color: colors.textSecondary },
                  ].map(z => (
                    <View key={z.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : colors.surfaceVariant, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: colors.border }}>
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: z.color }} />
                      <Text style={{ color: colors.textSecondary, fontSize: 10, fontFamily: Typography.fontFamily.semiBold }}>{z.emoji} {z.label}</Text>
                    </View>
                  ))}
                </View>

                {/* Scatter Chart Area */}
                <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
                  {/* Y-axis label */}
                  <View style={{ width: SCATTER_PAD_L, justifyContent: 'center', alignItems: 'center', height: SCATTER_H }}>
                    <Text style={{
                      color: colors.textSecondary, fontSize: 9,
                      fontFamily: Typography.fontFamily.bold,
                      letterSpacing: 0.5,
                      transform: [{ rotate: '-90deg' }],
                      width: SCATTER_H - 10, textAlign: 'center'
                    }}>STRIKE RATE ↗</Text>
                  </View>

                  <View style={{ flex: 1 }}>
                    <View style={{
                      height: SCATTER_H, 
                      position: 'relative', 
                      backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : colors.surfaceVariant, 
                      borderRadius: 14, 
                      borderWidth: 1,
                      borderColor: colors.border,
                      overflow: 'hidden'
                    }}>
                      {/* Subtle Zone Quadrant Dividers */}
                      <View style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: 1, backgroundColor: colors.border, opacity: 0.7 }} />
                      <View style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', width: 1, backgroundColor: colors.border, opacity: 0.7 }} />

                      {/* Quadrant Corner Hint Badges */}
                      <Text style={{ position: 'absolute', top: 6, right: 8, fontSize: 8, color: colors.textTertiary, fontFamily: Typography.fontFamily.bold }}>HIGH IMPACT 🚀</Text>
                      <Text style={{ position: 'absolute', top: 6, left: 8, fontSize: 8, color: colors.textTertiary, fontFamily: Typography.fontFamily.bold }}>QUICK FIRE ⚡</Text>
                      <Text style={{ position: 'absolute', bottom: 6, right: 8, fontSize: 8, color: colors.textTertiary, fontFamily: Typography.fontFamily.bold }}>ANCHOR ⚓</Text>

                      {/* Interactive Dots */}
                      {scatterBatters.map((batter) => {
                        const xFrac = maxRuns > 0 ? batter.runs / maxRuns : 0;
                        const yFrac = maxSR > 0 ? batter.sr / maxSR : 0;
                        const x = Math.max(12, Math.min(xFrac * SCATTER_INNER_W, SCATTER_INNER_W - 12));
                        const y = Math.max(12, Math.min(SCATTER_INNER_H * (1 - yFrac) + 4, SCATTER_INNER_H - 12));
                        const isSelected = activeBatter?.id === batter.id;
                        const tier = getBatterTier(batter);

                        return (
                          <TouchableOpacity
                            key={batter.id}
                            style={{
                              position: 'absolute', left: x - 13, top: y - 13,
                              width: 26, height: 26,
                              justifyContent: 'center', alignItems: 'center', zIndex: isSelected ? 10 : 3
                            }}
                            onPress={() => setSelectedBatterDot(batter)}
                            activeOpacity={0.8}
                          >
                            {isSelected && (
                              <View style={{
                                position: 'absolute',
                                width: 22, height: 22, borderRadius: 11,
                                backgroundColor: 'rgba(255,204,0,0.3)',
                                borderWidth: 1.5, borderColor: colors.primary
                              }} />
                            )}
                            <View style={{
                              width: isSelected ? 14 : 10, height: isSelected ? 14 : 10,
                              borderRadius: isSelected ? 7 : 5,
                              backgroundColor: tier.color,
                              borderWidth: 1.5,
                              borderColor: isSelected ? '#000000' : '#FFFFFF',
                            }} />
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    {/* X-axis */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, paddingHorizontal: 6 }}>
                      <Text style={{ color: colors.textSecondary, fontSize: 9, fontFamily: Typography.fontFamily.medium }}>0</Text>
                      <Text style={{ color: colors.textSecondary, fontSize: 9, fontFamily: Typography.fontFamily.medium }}>{Math.round(maxRuns / 2)}</Text>
                      <Text style={{ color: colors.textSecondary, fontSize: 9, fontFamily: Typography.fontFamily.medium }}>{maxRuns}</Text>
                    </View>
                    <Text style={{ color: colors.textSecondary, fontSize: 9, fontFamily: Typography.fontFamily.bold, textAlign: 'center', marginTop: 2, letterSpacing: 0.5 }}>RUNS →</Text>
                  </View>
                </View>

                {/* ── Active Batter Spotlight Card ── */}
                {activeBatter && activeTier && (
                  <View style={{
                    marginTop: 14,
                    backgroundColor: colors.surface,
                    borderRadius: 16,
                    padding: 14,
                    borderWidth: 1.5,
                    borderColor: colors.border,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: isDark ? 0.25 : 0.05,
                    shadowRadius: 6,
                    elevation: 2,
                  }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                        <View style={{
                          width: 36, height: 36, borderRadius: 18,
                          backgroundColor: isDark ? 'rgba(255,204,0,0.15)' : '#FFF8E1',
                          justifyContent: 'center', alignItems: 'center',
                          borderWidth: 1, borderColor: colors.primary
                        }}>
                          {activeBatter.photo ? (
                            <Image source={{ uri: getImageUrl(activeBatter.photo) }} style={{ width: 36, height: 36, borderRadius: 18 }} />
                          ) : (
                            <Text style={{ color: isDark ? '#FFD400' : colors.primaryDark, fontSize: 14, fontFamily: Typography.fontFamily.bold }}>
                              {activeBatter.name?.charAt(0).toUpperCase()}
                            </Text>
                          )}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: colors.textPrimary, fontSize: 14, fontFamily: Typography.fontFamily.bold }} numberOfLines={1}>
                            {activeBatter.name}
                          </Text>
                          <Text style={{ color: colors.textSecondary, fontSize: 11, fontFamily: Typography.fontFamily.regular }}>
                            Batting Performance
                          </Text>
                        </View>
                      </View>

                      {/* Tier Badge */}
                      <View style={{ backgroundColor: activeTier.bg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: activeTier.color }}>
                        <Text style={{ color: activeTier.color, fontSize: 11, fontFamily: Typography.fontFamily.bold }}>
                          {activeTier.emoji} {activeTier.name}
                        </Text>
                      </View>
                    </View>

                    {/* Stat Grid */}
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <View style={{ flex: 1, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : colors.surfaceVariant, borderRadius: 10, paddingVertical: 8, alignItems: 'center', borderWidth: 1, borderColor: colors.border }}>
                        <Text style={{ color: colors.textSecondary, fontSize: 9, fontFamily: Typography.fontFamily.semiBold }}>RUNS</Text>
                        <Text style={{ color: colors.textPrimary, fontSize: 14, fontFamily: Typography.fontFamily.bold, marginTop: 2 }}>{activeBatter.runs}</Text>
                      </View>
                      <View style={{ flex: 1, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : colors.surfaceVariant, borderRadius: 10, paddingVertical: 8, alignItems: 'center', borderWidth: 1, borderColor: colors.border }}>
                        <Text style={{ color: colors.textSecondary, fontSize: 9, fontFamily: Typography.fontFamily.semiBold }}>BALLS</Text>
                        <Text style={{ color: colors.textPrimary, fontSize: 14, fontFamily: Typography.fontFamily.bold, marginTop: 2 }}>{activeBatter.balls}</Text>
                      </View>
                      <View style={{ flex: 1, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : colors.surfaceVariant, borderRadius: 10, paddingVertical: 8, alignItems: 'center', borderWidth: 1, borderColor: colors.border }}>
                        <Text style={{ color: colors.textSecondary, fontSize: 9, fontFamily: Typography.fontFamily.semiBold }}>SR</Text>
                        <Text style={{ color: isDark ? '#FFD400' : colors.primaryDark, fontSize: 14, fontFamily: Typography.fontFamily.bold, marginTop: 2 }}>{activeBatter.sr.toFixed(1)}</Text>
                      </View>
                      <View style={{ flex: 1.2, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : colors.surfaceVariant, borderRadius: 10, paddingVertical: 8, alignItems: 'center', borderWidth: 1, borderColor: colors.border }}>
                        <Text style={{ color: colors.textSecondary, fontSize: 9, fontFamily: Typography.fontFamily.semiBold }}>BOUNDARIES</Text>
                        <Text style={{ color: colors.textPrimary, fontSize: 12, fontFamily: Typography.fontFamily.bold, marginTop: 3 }}>
                          {activeBatter.fours}×4 · {activeBatter.sixes}×6
                        </Text>
                      </View>
                    </View>
                  </View>
                )}

                {/* ── Batter Selector Pills ── */}
                <View style={{ marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.borderLight }}>
                  <Text style={{ color: colors.textSecondary, fontSize: 9, letterSpacing: 0.8, fontFamily: Typography.fontFamily.bold, textTransform: 'uppercase', marginBottom: 8 }}>ALL BATTERS IN MATCH</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {scatterBatters.sort((a, b) => b.runs - a.runs).map(b => {
                      const isSelected = activeBatter?.id === b.id;
                      const tier = getBatterTier(b);
                      return (
                        <TouchableOpacity
                          key={b.id}
                          onPress={() => setSelectedBatterDot(b)}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 5,
                            paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16,
                            backgroundColor: isSelected ? (isDark ? 'rgba(255,204,0,0.15)' : '#FFFBEA') : colors.surface,
                            borderWidth: 1,
                            borderColor: isSelected ? colors.primary : colors.border
                          }}
                          activeOpacity={0.75}
                        >
                          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: tier.color }} />
                          <Text style={{
                            color: isSelected ? colors.textPrimary : colors.textSecondary,
                            fontSize: 11, fontFamily: isSelected ? Typography.fontFamily.bold : Typography.fontFamily.medium
                          }}>
                            {b.name.split(' ')[0]} · {b.runs}({b.balls})
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </View>
            );
          })() : (
            <Text style={{ color: colors.textSecondary, fontSize: 12, fontStyle: 'italic' }}>No batting data available yet.</Text>
          )}
        </View>

        {/* Bottom padding */}
        <View style={{ height: 24 }} />
      </ScrollView>
    );
  };


  const renderLeaderboard = () => {
    if (loadingScorecards) {
      return <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 50 }} />;
    }
    if (!scorecards || scorecards.length === 0) {
      return <Text style={styles.emptyText}>No scorecard data yet.</Text>;
    }

    // ── Build player stat maps ──────────────────────────────────────────────
    const battersMap = {};  // pid → batter stats
    const bowlersMap = {};  // pid → bowler stats
    const fieldersMap = {};  // pid → fielding stats

    scorecards.forEach(sc => {
      const battingTeamName = sc.battingTeam?.name || (sc.battingTeam === match.teamA?._id ? match.teamA?.name : match.teamB?.name);
      const bowlingTeamName = sc.bowlingTeam?.name || (sc.bowlingTeam === match.teamA?._id ? match.teamA?.name : match.teamB?.name);

      sc.batting.forEach(b => {
        if (!b.player) return;
        const pid = b.player._id?.toString();
        if (!battersMap[pid]) battersMap[pid] = {
          id: pid, name: b.player.name, photo: b.player.photo || b.player.userId?.photo,
          teamName: battingTeamName, runs: 0, balls: 0, fours: 0, sixes: 0, isNotOut: false,
        };
        battersMap[pid].runs += b.runs || 0;
        battersMap[pid].balls += b.balls || 0;
        battersMap[pid].fours += b.fours || 0;
        battersMap[pid].sixes += b.sixes || 0;
        if (b.isNotOut) battersMap[pid].isNotOut = true;

        // fielder from dismissal
        if (b.dismissal?.fielder) {
          const fid = (b.dismissal.fielder._id || b.dismissal.fielder)?.toString();
          const fname = b.dismissal.fielder.name || 'Fielder';
          if (!fieldersMap[fid]) fieldersMap[fid] = {
            id: fid, name: fname, photo: null,
            teamName: bowlingTeamName, catches: 0, stumpings: 0, runOuts: 0,
          };
          const dtype = b.dismissal.type;
          if (dtype === 'caught' || dtype === 'caught_behind' || dtype === 'caught_and_bowled') fieldersMap[fid].catches += 1;
          else if (dtype === 'stumped') fieldersMap[fid].stumpings += 1;
          else if (dtype === 'run_out') fieldersMap[fid].runOuts += 1;
        }
      });

      sc.bowling.forEach(b => {
        if (!b.player) return;
        const pid = b.player._id?.toString();
        if (!bowlersMap[pid]) bowlersMap[pid] = {
          id: pid, name: b.player.name, photo: b.player.photo || b.player.userId?.photo,
          teamName: bowlingTeamName,
          overs: 0, balls: 0, maidens: 0, runs: 0, wickets: 0,
        };
        bowlersMap[pid].overs += b.overs || 0;
        bowlersMap[pid].balls += b.balls || 0;
        bowlersMap[pid].maidens += b.maidens || 0;
        bowlersMap[pid].runs += b.runs || 0;
        bowlersMap[pid].wickets += b.wickets || 0;
      });
    });

    const batters = Object.values(battersMap).sort((a, b) => b.runs - a.runs);
    const bowlers = Object.values(bowlersMap).sort((a, b) => b.wickets - a.wickets || a.runs - b.runs);
    const fielders = Object.values(fieldersMap).sort((a, b) =>
      (b.catches + b.stumpings + b.runOuts) - (a.catches + a.stumpings + a.runOuts)
    ).filter(f => (f.catches + f.stumpings + f.runOuts) > 0);

    // MVP: combine all players
    const allMap = {};
    [...batters, ...bowlers, ...fielders].forEach(p => {
      if (!allMap[p.id]) allMap[p.id] = {
        ...p, mvpRuns: 0, mvpFours: 0, mvpSixes: 0,
        mvpWickets: 0, mvpCatches: 0, mvpStumpings: 0, mvpRunOuts: 0,
      };
    });
    batters.forEach(p => { allMap[p.id].mvpRuns = p.runs; allMap[p.id].mvpFours = p.fours; allMap[p.id].mvpSixes = p.sixes; });
    bowlers.forEach(p => { allMap[p.id].mvpWickets = p.wickets; });
    fielders.forEach(p => { allMap[p.id].mvpCatches = p.catches; allMap[p.id].mvpStumpings = p.stumpings; allMap[p.id].mvpRunOuts = p.runOuts; });
    const mvpList = Object.values(allMap).map(p => {
      let points = 0;
      if (match?.mvpBreakdown) {
        const pid = String(p.id || p._id);
        if (typeof match.mvpBreakdown.get === 'function') {
          const breakdown = match.mvpBreakdown.get(pid);
          if (breakdown) points = breakdown.totalMvp || 0;
        } else if (match.mvpBreakdown[pid]) {
          points = match.mvpBreakdown[pid].totalMvp || match.mvpBreakdown[pid].total || 0;
        }
      }
      if (!points) {
        points = parseFloat(((
          (p.mvpRuns * 1) + (p.mvpSixes * 2) + (p.mvpFours * 0.5) +
          (p.mvpWickets * 20) + (p.mvpCatches * 10) + (p.mvpStumpings * 12) + (p.mvpRunOuts * 8)
        ) / 10).toFixed(3));
      }
      return {
        ...p,
        points: points.toFixed(3),
      };
    }).filter(p => parseFloat(p.points) > 0).sort((a, b) => parseFloat(b.points) - parseFloat(a.points));

    // ── Top awards ──────────────────────────────────────────────────────────
    const topBatter = batters[0];
    const topBowler = bowlers[0];
    const topFielder = fielders[0];
    const topMVP = mvpList[0];

    const renderAwardCard = (icon, iconColor, label, player, stat, statLabel) => {
      if (!player) return null;
      return (
        <TouchableOpacity
          style={styles.awardCard}
          onPress={() => setSelectedPlayerPreview({ _id: player.id, name: player.name })}
          activeOpacity={0.8}
        >
          <View style={[styles.awardIconWrap, { backgroundColor: iconColor + '22' }]}>
            <Icon name={icon} size={20} color={iconColor} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.awardLabel}>{label}</Text>
            <Text style={styles.awardPlayerName} numberOfLines={1}>{player.name}</Text>
            <Text style={styles.awardTeam} numberOfLines={1}>{player.teamName}</Text>
          </View>
          <View style={styles.awardStatBox}>
            <Text style={[styles.awardStatValue, { color: iconColor }]}>{stat}</Text>
            <Text style={styles.awardStatLabel}>{statLabel}</Text>
          </View>
        </TouchableOpacity>
      );
    };

    // ── Avatar helper ───────────────────────────────────────────────────────
    const PlayerAvatar = ({ player }) => (
      <View style={styles.lbAvatar}>
        {player.photo ? (
          <Image source={{ uri: getImageUrl(player.photo) }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        ) : (
          <Text style={styles.lbAvatarText}>{player.name.charAt(0).toUpperCase()}</Text>
        )}
      </View>
    );

    // ── Render tabs content ─────────────────────────────────────────────────
    const renderBattingTab = () => (
      <View style={styles.section}>
        <View style={[styles.tableHeaderRow, { marginBottom: 0 }]}>
          <Text style={[styles.tableHeaderText, { flex: 3, textAlign: 'left' }]}>Batter</Text>
          <Text style={styles.tableHeaderText}>Runs</Text>
          <Text style={[styles.tableHeaderText, { flex: 1.5, textAlign: 'right' }]}>Points</Text>
        </View>
        {batters.length === 0 ? (
          <Text style={styles.emptyText}>No batting data</Text>
        ) : batters.map((p, idx) => {
          const pts = ((p.runs * 1 + p.sixes * 2 + p.fours * 0.5) / 10).toFixed(3);
          return (
            <TouchableOpacity
              key={'batting_' + idx}
              style={[styles.lbSimpleRow, idx === batters.length - 1 && { borderBottomWidth: 0 }]}
              onPress={() => setSelectedPlayerPreview({ _id: p.id, name: p.name })}
              activeOpacity={0.7}
            >
              <Text style={styles.lbRankSm}>{String(idx + 1)}</Text>
              <Text style={styles.lbSimpleName} numberOfLines={1}>
                {p.name + (p.isNotOut ? ' *' : '')}
              </Text>
              <Text style={styles.lbSimpleStat}>{String(p.runs)}</Text>
              <Text style={styles.lbSimplePoints}>{pts}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );

    const renderBowlingTab = () => (
      <View style={styles.section}>
        <View style={[styles.tableHeaderRow, { marginBottom: 0 }]}>
          <Text style={[styles.tableHeaderText, { flex: 3, textAlign: 'left' }]}>Bowler</Text>
          <Text style={styles.tableHeaderText}>Wkts</Text>
          <Text style={[styles.tableHeaderText, { flex: 1.5, textAlign: 'right' }]}>Points</Text>
        </View>
        {bowlers.length === 0 ? (
          <Text style={styles.emptyText}>No bowling data</Text>
        ) : bowlers.map((p, idx) => {
          const pts = ((p.wickets * 20) / 10).toFixed(3);
          return (
            <TouchableOpacity
              key={'bowling_' + idx}
              style={[styles.lbSimpleRow, idx === bowlers.length - 1 && { borderBottomWidth: 0 }]}
              onPress={() => setSelectedPlayerPreview({ _id: p.id, name: p.name })}
              activeOpacity={0.7}
            >
              <Text style={styles.lbRankSm}>{String(idx + 1)}</Text>
              <Text style={styles.lbSimpleName} numberOfLines={1}>{p.name}</Text>
              <Text style={[styles.lbSimpleStat, p.wickets > 0 && { color: colors.primary, fontFamily: Typography.fontFamily.bold }]}>
                {String(p.wickets)}
              </Text>
              <Text style={styles.lbSimplePoints}>{pts}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );

    const renderFieldingTab = () => (
      <View style={styles.section}>
        <View style={[styles.tableHeaderRow, { marginBottom: 0 }]}>
          <Text style={[styles.tableHeaderText, { flex: 3, textAlign: 'left' }]}>Fielder</Text>
          <Text style={styles.tableHeaderText}>Ct</Text>
          <Text style={[styles.tableHeaderText, { flex: 1.5, textAlign: 'right' }]}>Points</Text>
        </View>
        {fielders.length === 0 ? (
          <Text style={styles.emptyText}>No fielding dismissals recorded</Text>
        ) : fielders.map((p, idx) => {
          const pts = ((p.catches * 10 + p.stumpings * 12 + p.runOuts * 8) / 10).toFixed(3);
          return (
            <TouchableOpacity
              key={'fielding_' + idx}
              style={[styles.lbSimpleRow, idx === fielders.length - 1 && { borderBottomWidth: 0 }]}
              onPress={() => setSelectedPlayerPreview({ _id: p.id, name: p.name })}
              activeOpacity={0.7}
            >
              <Text style={styles.lbRankSm}>{String(idx + 1)}</Text>
              <Text style={styles.lbSimpleName} numberOfLines={1}>{p.name}</Text>
              <Text style={styles.lbSimpleStat}>{String(p.catches)}</Text>
              <Text style={styles.lbSimplePoints}>{pts}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );

    const renderMVPTab = () => (
      <View style={styles.section}>
        <View style={[styles.tableHeaderRow, { marginBottom: 0 }]}>
          <Text style={[styles.tableHeaderText, { flex: 0.4 }]}>#</Text>
          <Text style={[styles.tableHeaderText, { flex: 3, textAlign: 'left' }]}>Player</Text>
          <Text style={[styles.tableHeaderText, { flex: 1.5, textAlign: 'right' }]}>Points</Text>
        </View>
        {mvpList.length === 0 ? (
          <Text style={styles.emptyText}>No data available</Text>
        ) : mvpList.map((p, idx) => (
          <TouchableOpacity
            key={'mvp_' + idx}
            style={[styles.lbSimpleRow, idx === mvpList.length - 1 && { borderBottomWidth: 0 }]}
            onPress={() => setSelectedPlayerPreview({ _id: p.id, name: p.name })}
            activeOpacity={0.7}
          >
            <Text style={[
              styles.lbRankSm,
              { flex: 0.4 },
              idx < 3 && { color: ['#FFD700', '#C0C0C0', '#CD7F32'][idx], fontFamily: Typography.fontFamily.bold },
            ]}>{String(idx + 1)}</Text>
            <Text style={[styles.lbSimpleName, { flex: 3 }]} numberOfLines={1}>{p.name}</Text>
            <Text style={styles.lbSimplePoints}>{p.points}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );

    return (
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 32 }]} refreshControl={getRefreshControl()}>

        {/* Awards strip */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🏆 Match Awards</Text>
          {renderAwardCard('cricket', colors.primary, 'Top Batter', topBatter, topBatter ? `${topBatter.runs}(${topBatter.balls})` : '--', 'Runs')}
          {renderAwardCard('bowling', colors.info || '#2196F3', 'Top Bowler', topBowler, topBowler ? `${topBowler.wickets}/${topBowler.runs}` : '--', 'Wkts')}
          {renderAwardCard('hand-extended', colors.success, 'Top Fielder', topFielder, topFielder ? `${topFielder.catches + topFielder.stumpings + topFielder.runOuts}` : '--', 'Dismissals')}
          {renderAwardCard('star-circle', '#FFD700', 'MVP', topMVP, topMVP ? topMVP.points : '--', 'Points')}
        </View>

        {/* Sub-tab bar */}
        <View style={styles.lbFilterRow}>
          {['Batting', 'Bowling', 'Fielding', 'MVP'].map(tab => (
            <TouchableOpacity
              key={tab}
              style={[styles.lbFilterBtn, leaderboardFilter === tab && styles.lbFilterBtnActive]}
              onPress={() => setLeaderboardFilter(tab)}
            >
              <Text style={[styles.lbFilterText, leaderboardFilter === tab && styles.lbFilterTextActive]}>{tab}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab content */}
        {leaderboardFilter === 'Batting' && renderBattingTab()}
        {leaderboardFilter === 'Bowling' && renderBowlingTab()}
        {leaderboardFilter === 'Fielding' && renderFieldingTab()}
        {leaderboardFilter === 'MVP' && renderMVPTab()}

      </ScrollView>
    );
  };

  // const renderMvp = () => {
  //   const mvpData = match?.mvpBreakdown || {};
  //   const teamA_players = match?.playingXI?.teamA || [];
  //   const teamB_players = match?.playingXI?.teamB || [];
  //   const allPlayers = [...teamA_players, ...teamB_players];

  //   const playersWithMvp = allPlayers.map(p => {
  //     const pid = p._id || p;
  //     let stats = { battingMvp: 0, bowlingMvp: 0, fieldingMvp: 0, totalMvp: 0 };
  //     if (match?.mvpBreakdown) {
  //       if (typeof match.mvpBreakdown.get === 'function') {
  //         const breakdown = match.mvpBreakdown.get(String(pid));
  //         if (breakdown) stats = breakdown;
  //       } else if (match.mvpBreakdown[String(pid)]) {
  //         stats = match.mvpBreakdown[String(pid)];
  //       }
  //     }
  //     return {
  //       player: p,
  //       ...stats
  //     };
  //   }).sort((a, b) => b.totalMvp - a.totalMvp);

  //   return (
  //     <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 32 }]} refreshControl={getRefreshControl()}>
  //       <View style={styles.section}>
  //         <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
  //           <Text style={styles.sectionTitle}>🏆 MVP Leaderboard</Text>
  //           {match?.playerOfMatch && (
  //             <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#eab308', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, gap: 4 }}>
  //               <Icon name="trophy" size={14} color="#000" />
  //               <Text style={{ color: '#000', fontSize: 11, fontWeight: 'bold' }}>POM Awarded</Text>
  //             </View>
  //           )}
  //         </View>

  //         {playersWithMvp.length === 0 ? (
  //           <Text style={styles.emptyText}>No MVP data available yet.</Text>
  //         ) : (
  //           playersWithMvp.map((item, idx) => {
  //             const p = item.player;
  //             const isPom = match?.playerOfMatch && String(match.playerOfMatch._id || match.playerOfMatch) === String(p._id);
  //             const isTop = idx === 0;

  //             return (
  //               <MvpPlayerRow
  //                 key={p._id || idx}
  //                 player={p}
  //                 idx={idx}
  //                 isPom={isPom}
  //                 isTop={isTop}
  //                 item={item}
  //               />
  //             );
  //           })
  //         )}
  //       </View>
  //     </ScrollView>
  //   );
  // };

  const executeAddScorer = async () => {
    if (!newScorerMobile) {
      showCustomAlert('Error', 'Please enter a mobile number');
      return;
    }
    if (scorerSearchResult?.user?._id && String(scorerSearchResult.user._id) === String(activeScorerId)) {
      showCustomAlert('Alert', 'He is already the active scorer');
      return;
    }
    const res = await dispatch(addMatchScorer({ matchId: cleanMatchId, mobile: newScorerMobile }));
    if (addMatchScorer.fulfilled.match(res)) {
      showCustomAlert('Success', 'Scorer added successfully');
      setShowAddScorerModal(false);
      setNewScorerMobile('');
      setScorerSearchResult(null);
      dispatch(fetchLiveState(cleanMatchId));
    } else {
      showCustomAlert('Error', res.payload || 'Failed to add scorer');
    }
  };



  const submitMatchResult = async () => {
    if (resultType === 'walkover' && !winnerTeamId) {
      showCustomAlert('Error', 'Please select a winning team');
      return;
    }
    try {
      await api.put(`/matches/${cleanMatchId}/declare-result`, {
        resultType,
        winnerTeamId: resultType === 'walkover' ? winnerTeamId : undefined
      });
      showCustomAlert('Success', 'Match result declared successfully');
      setShowDeclareResultModal(false);
      onRefresh();
    } catch (error) {
      showCustomAlert('Error', error.response?.data?.message || 'Failed to declare result');
    }
  };

  const executeAbandonMatch = async () => {
    if (!abandonReason) {
      showCustomAlert('Error', 'Please enter a reason for abandoning the match');
      return;
    }
    try {
      await api.put(`/matches/${cleanMatchId}/abandon`, { reason: abandonReason });
      showCustomAlert('Success', 'Match abandoned successfully');
      setShowAbandonModal(false);
      onRefresh();
    } catch (error) {
      showCustomAlert('Error', error.response?.data?.message || 'Failed to abandon match');
    }
  };


  return (
    <View style={[styles.container, { paddingTop: safeTop }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent={false} />

      {/* ── Modern Header ── */}
      <LinearGradient
        colors={colors.primaryGradient || ['#FFCC00', '#E6B800']}
        style={styles.headerPrimary}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      >
        <View style={styles.headerTop}>
          <TouchableOpacity style={styles.headerBackBtn} onPress={handleBackPress} activeOpacity={0.7}>
            <Icon name="arrow-left" size={20} color="#111827" />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <View style={styles.headerTitleRow}>
              {/* Status Badge at START */}
              {match.status === 'in_progress' ? (
                <View style={styles.statusBadgeLive}>
                  <View style={styles.liveDot} />
                  <Text style={styles.statusBadgeText}>LIVE</Text>
                </View>
              ) : (match.status === 'super_over' || match.isSuperOver || liveState?.isSuperOver) ? (
                <View style={[styles.statusBadgeLive, { backgroundColor: '#7B1FA2', borderWidth: 1, borderColor: '#FFD54F', paddingHorizontal: 7 }]}>
                  <Icon name="flash" size={10} color="#FFD54F" style={{ marginRight: 2 }} />
                  <Text style={[styles.statusBadgeText, { color: '#FFD54F', fontWeight: 'bold' }]}>SUPER OVER</Text>
                </View>
              ) : match.status === 'completed' ? (
                <View style={styles.statusBadgeCompleted}>
                  <Icon name="check-circle" size={10} color="#fff" style={{ marginRight: 3 }} />
                  <Text style={styles.statusBadgeText}>Completed</Text>
                </View>
              ) : null}

              {/* Scrolling Team Name */}
              <AutoScrollingText
                text={`${match.teamA?.shortName || match.teamA?.name || 'Team A'} vs ${match.teamB?.shortName || match.teamB?.name || 'Team B'}`}
                style={styles.headerTeamVs}
              />
            </View>

            {match.status === 'scheduled' && match.scheduledAt ? (
              <Text style={styles.headerVsText} numberOfLines={1}>
                {new Date(match.scheduledAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })} • {match.tournament?.name || 'Match'}
              </Text>
            ) : null}
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {isActiveScorer && match.status !== 'completed' && match.status !== 'abandoned' && match.status !== 'no_result' && (
              <TouchableOpacity style={{ padding: 8 }} onPress={() => setShowSettingsModal(true)}>
                <Icon name="cog" size={20} color="#111827" />
              </TouchableOpacity>
            )}
            <TouchableOpacity style={{ padding: 8 }} onPress={() => navigation.navigate('CreateTicketScreen', { matchId: match._id, category: 'Match Dispute' })}>
              <Icon name="alert-circle-outline" size={20} color="#111827" />
            </TouchableOpacity>
            <TouchableOpacity style={{ padding: 8 }} onPress={handleShare}>
              <Icon name="share-variant" size={20} color="#111827" />
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>

      {/* Tab Bar (Underline style on clean surface background like TournamentDetailScreen) */}
      <View style={styles.tabBarWrapper}>
        {renderTabHeader()}
      </View>

      {/* Content */}
      <View style={styles.tabContentContainer}>
        <FlatList
          ref={flatListRef}
          data={dynamicTabs}
          keyExtractor={(item) => item}
          horizontal
          pagingEnabled
          scrollEnabled={false}
          initialScrollIndex={1}
          showsHorizontalScrollIndicator={false}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          getItemLayout={(data, index) => (
            { length: SCREEN_WIDTH, offset: SCREEN_WIDTH * index, index }
          )}
          onScrollToIndexFailed={(info) => {
            const wait = new Promise(resolve => setTimeout(resolve, 50));
            wait.then(() => {
              flatListRef.current?.scrollToIndex({ index: info.index, animated: true });
            });
          }}
          initialNumToRender={2}
          windowSize={3}
          renderItem={({ item }) => (
            <View style={{ width: SCREEN_WIDTH }}>
              {item === 'Info' && renderMatchDetails()}
              {item === 'Summary' && renderSummary()}
              {item.startsWith('AI Report') && renderAIReport()}
              {item === 'Scorecard' && renderScorecard()}
              {item === 'Comms' && renderCommentary()}
              {item === 'Squads' && renderSquads()}
              {item === 'Analysis' && renderAnalysis()}
              {item === 'Partnerships' && renderPartnerships()}
              {item === 'Leaderboard' && renderLeaderboard()}
            </View>
          )}
        />
      </View>

      {/* Floating Action Bar */}
      {isActiveScorer && match.status !== 'completed' && match.status !== 'abandoned' && match.status !== 'no_result' && (
        <View style={{
          position: 'absolute',
          bottom: Math.max(safeBottom, 16),
          left: 16,
          right: 16,
          backgroundColor: isDark ? 'rgba(28, 28, 30, 0.95)' : colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 24,
          padding: 12,
          borderWidth: 1,
          borderColor: colors.border,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.5,
          shadowRadius: 16,
          elevation: 20,
          zIndex: 999,
        }}>
          <TouchableOpacity
            style={{
              backgroundColor: colors.primary,
              borderRadius: 16,
              paddingVertical: 14,
              flexDirection: 'row',
              justifyContent: 'center',
              alignItems: 'center',
              shadowColor: colors.primary,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.4,
              shadowRadius: 8,
              elevation: 6
            }}
            onPress={handleContinue}
            activeOpacity={0.85}
          >
            <Icon
              name={match.status === 'scheduled' ? 'cricket' : 'play-circle'}
              size={20}
              color="#000"
              style={{ marginRight: 8 }}
            />
            <Text style={{ color: '#000', fontFamily: Typography.fontFamily.bold, fontSize: 16 }}>
              {match.status === 'scheduled' ? 'Start Match' : 'Continue Scoring'}
            </Text>
          </TouchableOpacity>
          {match.status === 'scheduled' && (
            <TouchableOpacity
              style={{ marginTop: 12, paddingVertical: 8, alignItems: 'center' }}
              onPress={() => setDeclareResultModalVisible(true)}
            >
              <Text style={{ color: isDark ? colors.primary : colors.textPrimary, fontFamily: Typography.fontFamily.semiBold }}>Declare Result (Walkover / Abandon)</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Declare Result Modal */}
      <Modal visible={declareResultModalVisible} transparent animationType="slide" onRequestClose={() => setDeclareResultModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { padding: 0 }]}>
            <View style={{ padding: 20, borderBottomWidth: 1, borderBottomColor: colors.borderLight }}>
              <Text style={{ fontSize: 18, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary, textAlign: 'center' }}>Declare Result</Text>
            </View>
            <ScrollView style={{ maxHeight: 300, width: '100%' }}>
              <TouchableOpacity style={styles.declareResultOption} onPress={() => confirmDeclareResult('walkover', match.teamA?._id, match.teamA?.name)}>
                <Icon name="flag-checkered" size={20} color={colors.textSecondary} style={{ marginRight: 10 }} />
                <Text style={styles.declareResultOptionText}>Walkover to {match.teamA?.name}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.declareResultOption} onPress={() => confirmDeclareResult('walkover', match.teamB?._id, match.teamB?.name)}>
                <Icon name="flag-checkered" size={20} color={colors.textSecondary} style={{ marginRight: 10 }} />
                <Text style={styles.declareResultOptionText}>Walkover to {match.teamB?.name}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.declareResultOption} onPress={() => confirmDeclareResult('tie')}>
                <Icon name="handshake-outline" size={20} color={colors.textSecondary} style={{ marginRight: 10 }} />
                <Text style={styles.declareResultOptionText}>Match Drawn (Tie)</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.declareResultOption, { borderBottomWidth: 0 }]} onPress={() => confirmDeclareResult('abandoned')}>
                <Icon name="close-octagon-outline" size={20} color={colors.textSecondary} style={{ marginRight: 10 }} />
                <Text style={styles.declareResultOptionText}>Abandon Match</Text>
              </TouchableOpacity>
            </ScrollView>
            <View style={{ padding: 16, width: '100%', borderTopWidth: 1, borderTopColor: colors.borderLight }}>
              <TouchableOpacity
                style={{ paddingVertical: 12, borderRadius: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, justifyContent: 'center', alignItems: 'center' }}
                onPress={() => setDeclareResultModalVisible(false)}
              >
                <Text style={{ color: colors.textSecondary, fontFamily: Typography.fontFamily.bold, fontSize: 16 }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Confirmation Modal */}
      <Modal visible={!!declareConfirmation?.visible} transparent animationType="fade" onRequestClose={() => setDeclareConfirmation(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { padding: 24 }]}>
            <Text style={{ fontSize: 20, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary, marginBottom: 12, textAlign: 'center' }}>
              {declareConfirmation?.title}
            </Text>
            <Text style={{ fontSize: 16, fontFamily: Typography.fontFamily.regular, color: colors.textSecondary, textAlign: 'center', marginBottom: 24, lineHeight: 22 }}>
              {declareConfirmation?.message}
            </Text>
            <View style={{ flexDirection: 'row', width: '100%', gap: 12 }}>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: 14, borderRadius: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, justifyContent: 'center', alignItems: 'center' }}
                onPress={() => setDeclareConfirmation(null)}
              >
                <Text style={{ color: colors.textSecondary, fontFamily: Typography.fontFamily.bold, fontSize: 16 }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: 14, borderRadius: 8, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' }}
                onPress={executeDeclareResult}
              >
                <Text style={{ color: colors.background, fontFamily: Typography.fontFamily.bold, fontSize: 16 }}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Match Settings Modal (Bottom Sheet) ── */}
      <Modal visible={showSettingsModal} animationType="slide" transparent>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowSettingsModal(false)}>
          <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' }}>
            <TouchableOpacity activeOpacity={1}>
              <View style={{
                backgroundColor: colors.surfaceVariant,
                borderTopLeftRadius: 24, borderTopRightRadius: 24,
                paddingBottom: 32, overflow: 'hidden',
                borderTopWidth: 1, borderColor: colors.border,
              }}>
                {/* Handle + Header */}
                <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 8 }}>
                  <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 16 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: `${colors.primary}22`, alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name="cog" size={16} color={colors.primary} />
                    </View>
                    <Text style={{ fontSize: 18, color: colors.textPrimary, fontFamily: Typography.fontFamily.bold }}>Match Settings</Text>
                  </View>
                  <TouchableOpacity
                    style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}
                    onPress={() => setShowSettingsModal(false)}
                  >
                    <Icon name="close" size={16} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                {/* Divider */}
                <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: 20, marginBottom: 16 }} />

                {/* Options */}
                <View style={{ paddingHorizontal: 16, gap: 10 }}>
                  {/* {isActiveScorer && (
                    <TouchableOpacity
                      style={{
                        flexDirection: 'row', alignItems: 'center',
                        backgroundColor: colors.surface, borderRadius: 14,
                        padding: 16, borderWidth: 1, borderColor: colors.border,
                      }}
                      activeOpacity={0.7}
                      onPress={() => {
                        setShowSettingsModal(false);
                        navigation.navigate('MatchSetup', { matchId: cleanMatchId, matchData: match });
                      }}
                    >
                      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: `${colors.primary}18`, alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                        <Icon name="pencil" size={20} color={colors.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.textPrimary, fontSize: 16, fontFamily: Typography.fontFamily.semiBold }}>Edit Match Details</Text>
                        <Text style={{ color: colors.textTertiary, fontSize: 12, fontFamily: Typography.fontFamily.regular, marginTop: 2 }}>Edit overs, wickets, ground, location, etc</Text>
                      </View>
                      <Icon name="chevron-right" size={18} color={colors.textTertiary} />
                    </TouchableOpacity>
                  )} */}
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row', alignItems: 'center',
                      backgroundColor: colors.surface, borderRadius: 14,
                      padding: 16, borderWidth: 1, borderColor: colors.border,
                    }}
                    activeOpacity={0.7}
                    onPress={() => { setShowSettingsModal(false); setShowAddScorerModal(true); }}
                  >
                    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: `${colors.primary}18`, alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                      <Icon name="account-switch" size={20} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.textPrimary, fontSize: 16, fontFamily: Typography.fontFamily.semiBold }}>Change Scorer</Text>
                      <Text style={{ color: colors.textTertiary, fontSize: 12, fontFamily: Typography.fontFamily.regular, marginTop: 2 }}>Assign someone to score this match</Text>
                    </View>
                    <Icon name="chevron-right" size={18} color={colors.textTertiary} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={{
                      flexDirection: 'row', alignItems: 'center',
                      backgroundColor: colors.surface, borderRadius: 14,
                      padding: 16, borderWidth: 1, borderColor: colors.border,
                    }}
                    activeOpacity={0.7}
                    onPress={() => { setShowSettingsModal(false); setShowDeclareResultModal(true); }}
                  >
                    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#D4AF3718', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                      <Icon name="trophy" size={20} color="#D4AF37" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.textPrimary, fontSize: 16, fontFamily: Typography.fontFamily.semiBold }}>Declare Result</Text>
                      <Text style={{ color: colors.textTertiary, fontSize: 12, fontFamily: Typography.fontFamily.regular, marginTop: 2 }}>Declare winner, tie or walkover</Text>
                    </View>
                    <Icon name="chevron-right" size={18} color={colors.textTertiary} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={{
                      flexDirection: 'row', alignItems: 'center',
                      backgroundColor: `${colors.error}0D`, borderRadius: 14,
                      padding: 16, borderWidth: 1, borderColor: `${colors.error}30`,
                    }}
                    activeOpacity={0.7}
                    onPress={() => { setShowSettingsModal(false); setShowAbandonModal(true); }}
                  >
                    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: `${colors.error}20`, alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                      <Icon name="cancel" size={20} color={colors.error} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.error, fontSize: 16, fontFamily: Typography.fontFamily.semiBold }}>Abandon Match</Text>
                      <Text style={{ color: `${colors.error}88`, fontSize: 12, fontFamily: Typography.fontFamily.regular, marginTop: 2 }}>Cancel match due to unforeseen reasons</Text>
                    </View>
                    <Icon name="chevron-right" size={18} color={`${colors.error}60`} />
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Add Scorer Modal ── */}
      <Modal visible={showAddScorerModal} animationType="fade" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <View style={{
            backgroundColor: colors.surfaceVariant, borderRadius: 20,
            width: '100%', padding: 24,
            borderWidth: 1, borderColor: colors.border,
          }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
              <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: `${colors.primary}18`, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                <Icon name="account-switch" size={18} color={colors.primary} />
              </View>
              <Text style={{ flex: 1, fontSize: 18, color: colors.textPrimary, fontFamily: Typography.fontFamily.bold }}>Change Scorer</Text>
              <TouchableOpacity
                style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}
                onPress={() => setShowAddScorerModal(false)}
              >
                <Icon name="close" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Current active scorer */}
            {(() => {
              const aScorer = match.activeScorerId;
              const aName = typeof aScorer === 'object'
                ? (aScorer?.name || aScorer?.mobile)
                : (match.scorers?.find(s => String(s.userId?._id || s.userId) === String(aScorer))?.userId?.name ||
                  match.scorers?.find(s => String(s.userId?._id || s.userId) === String(aScorer))?.userId?.mobile);
              const displayName = aName || (typeof match.organizerId === 'object' ? match.organizerId?.name : null) || 'Not Assigned';
              return (
                <View style={{ marginBottom: 18 }}>
                  <Text style={{ color: colors.textSecondary, marginBottom: 10, fontSize: 12, fontFamily: Typography.fontFamily.semiBold, letterSpacing: 0.8, textTransform: 'uppercase' }}>Current Scorer</Text>
                  <View style={{
                    flexDirection: 'row', alignItems: 'center', gap: 6,
                    backgroundColor: `${colors.primary}14`,
                    paddingHorizontal: 12, paddingVertical: 7,
                    borderRadius: 20, borderWidth: 1, borderColor: `${colors.primary}30`,
                    alignSelf: 'flex-start',
                  }}>
                    <Icon name="account-check" size={13} color={colors.primary} />
                    <Text style={{ color: colors.primary, fontSize: 13, fontFamily: Typography.fontFamily.medium }}>{displayName}</Text>
                  </View>
                </View>
              );
            })()}

            {/* Divider */}
            <View style={{ height: 1, backgroundColor: colors.border, marginBottom: 16 }} />

            {/* Input */}
            <Text style={{ color: colors.textSecondary, marginBottom: 8, fontSize: 12, fontFamily: Typography.fontFamily.semiBold, letterSpacing: 0.8, textTransform: 'uppercase' }}>Mobile Number</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, marginBottom: 20 }}>
              <Icon name="phone" size={18} color={colors.textTertiary} style={{ marginRight: 10 }} />
              <TextInput
                style={{ flex: 1, padding: 12, color: colors.textPrimary, fontSize: 16, fontFamily: Typography.fontFamily.medium }}
                placeholder="10-digit mobile number"
                placeholderTextColor={colors.textTertiary}
                keyboardType="numeric"
                maxLength={10}
                value={newScorerMobile}
                onChangeText={setNewScorerMobile}
              />
              {isScorerSearching && <ActivityIndicator color={colors.primary} size="small" style={{ marginLeft: 10 }} />}
              {newScorerMobile.length === 10 && !isScorerSearching && scorerSearchResult?.exists && (
                <Icon name="check-circle" size={18} color="#4CAF50" style={{ marginLeft: 10 }} />
              )}
            </View>

            {scorerSearchResult && scorerSearchResult.exists && (
              <View style={{ marginTop: -8, marginBottom: 20, backgroundColor: colors.surfaceVariant, padding: 12, borderRadius: 12, flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: `${colors.primary}18`, justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                  <Text style={{ color: colors.primary, fontFamily: Typography.fontFamily.bold, fontSize: 16 }}>
                    {(scorerSearchResult.user?.name || 'U').charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.textPrimary, fontFamily: Typography.fontFamily.semiBold, fontSize: 15 }}>
                    {scorerSearchResult.user?.name || 'Registered User'}
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Registered User</Text>
                </View>
              </View>
            )}

            {scorerSearchResult && !scorerSearchResult.exists && !isScorerSearching && (
              <Text style={{ color: colors.error, fontSize: 13, marginTop: -8, marginBottom: 20, textAlign: 'center', fontFamily: Typography.fontFamily.medium }}>
                User not found. Please enter a registered user's number.
              </Text>
            )}

            {/* CTA */}
            <TouchableOpacity
              style={{
                backgroundColor: colors.primary, paddingVertical: 15,
                borderRadius: 12, alignItems: 'center', flexDirection: 'row',
                justifyContent: 'center', gap: 8,
                opacity: (scorerSearchResult && scorerSearchResult.exists) ? 1 : 0.5
              }}
              onPress={executeAddScorer}
              activeOpacity={0.8}
              disabled={!scorerSearchResult?.exists}
            >
              <Icon name="account-switch" size={18} color={colors.background} />
              <Text style={{ color: colors.background, fontFamily: Typography.fontFamily.bold, fontSize: 15 }}>Change Scorer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>



      {/* ── Declare Result Modal ── */}
      <Modal visible={showDeclareResultModal} animationType="fade" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <View style={{
            backgroundColor: colors.surfaceVariant, borderRadius: 20,
            width: '100%', padding: 24,
            borderWidth: 1, borderColor: colors.border,
          }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
              <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#D4AF3718', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                <Icon name="trophy" size={18} color="#D4AF37" />
              </View>
              <Text style={{ flex: 1, fontSize: 18, color: colors.textPrimary, fontFamily: Typography.fontFamily.bold }}>Declare Result</Text>
              <TouchableOpacity
                style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}
                onPress={() => setShowDeclareResultModal(false)}
              >
                <Icon name="close" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Result type toggle */}
            <Text style={{ color: colors.textSecondary, marginBottom: 10, fontSize: 12, fontFamily: Typography.fontFamily.semiBold, letterSpacing: 0.8, textTransform: 'uppercase' }}>Result Type</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
              <TouchableOpacity
                style={{
                  flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center',
                  borderWidth: 1.5,
                  borderColor: resultType === 'walkover' ? colors.primary : colors.border,
                  backgroundColor: resultType === 'walkover' ? `${colors.primary}18` : colors.surface,
                }}
                onPress={() => setResultType('walkover')}
                activeOpacity={0.7}
              >
                {resultType === 'walkover' && <Icon name="check-circle" size={14} color={colors.primary} style={{ marginBottom: 4 }} />}
                <Text style={{ color: resultType === 'walkover' ? colors.primary : colors.textSecondary, fontFamily: Typography.fontFamily.bold, fontSize: 13 }}>🏆 Winner</Text>
                <Text style={{ color: resultType === 'walkover' ? `${colors.primary}99` : colors.textTertiary, fontFamily: Typography.fontFamily.regular, fontSize: 11, marginTop: 2 }}>Walkover</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center',
                  borderWidth: 1.5,
                  borderColor: resultType === 'tie' ? colors.primary : colors.border,
                  backgroundColor: resultType === 'tie' ? `${colors.primary}18` : colors.surface,
                }}
                onPress={() => { setResultType('tie'); setWinnerTeamId(null); }}
                activeOpacity={0.7}
              >
                {resultType === 'tie' && <Icon name="check-circle" size={14} color={colors.primary} style={{ marginBottom: 4 }} />}
                <Text style={{ color: resultType === 'tie' ? colors.primary : colors.textSecondary, fontFamily: Typography.fontFamily.bold, fontSize: 13 }}>🤝 Tie</Text>
                <Text style={{ color: resultType === 'tie' ? `${colors.primary}99` : colors.textTertiary, fontFamily: Typography.fontFamily.regular, fontSize: 11, marginTop: 2 }}>Draw</Text>
              </TouchableOpacity>
            </View>

            {/* Team selector */}
            {resultType === 'walkover' && (
              <View style={{ marginBottom: 20 }}>
                <Text style={{ color: colors.textSecondary, marginBottom: 10, fontSize: 12, fontFamily: Typography.fontFamily.semiBold, letterSpacing: 0.8, textTransform: 'uppercase' }}>Select Winning Team</Text>
                <View style={{ gap: 10 }}>
                  {[{ team: match.teamA, id: match.teamA?._id }, { team: match.teamB, id: match.teamB?._id }].map(({ team, id }) => {
                    const selected = winnerTeamId === id;
                    return (
                      <TouchableOpacity
                        key={id}
                        style={{
                          flexDirection: 'row', alignItems: 'center',
                          paddingVertical: 14, paddingHorizontal: 16,
                          borderRadius: 12, borderWidth: 1.5,
                          borderColor: selected ? colors.primary : colors.border,
                          backgroundColor: selected ? `${colors.primary}14` : colors.surface,
                        }}
                        onPress={() => setWinnerTeamId(id)}
                        activeOpacity={0.7}
                      >
                        <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: selected ? `${colors.primary}30` : colors.background, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                          <Text style={{ fontSize: 15, fontFamily: Typography.fontFamily.bold, color: selected ? colors.primary : colors.textSecondary }}>{team?.shortName?.charAt(0) || team?.name?.charAt(0) || '?'}</Text>
                        </View>
                        <Text style={{ flex: 1, color: selected ? colors.primary : colors.textPrimary, fontFamily: selected ? Typography.fontFamily.bold : Typography.fontFamily.medium, fontSize: 15 }}>{team?.name}</Text>
                        {selected && <Icon name="check-circle" size={20} color={colors.primary} />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Divider */}
            <View style={{ height: 1, backgroundColor: colors.border, marginBottom: 16 }} />

            {/* CTA */}
            <TouchableOpacity
              style={{
                backgroundColor: colors.primary, paddingVertical: 15,
                borderRadius: 12, alignItems: 'center', flexDirection: 'row',
                justifyContent: 'center', gap: 8,
              }}
              onPress={submitMatchResult}
              activeOpacity={0.8}
            >
              <Icon name="check" size={18} color={colors.background} />
              <Text style={{ color: colors.background, fontFamily: Typography.fontFamily.bold, fontSize: 15 }}>Confirm Result</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Abandon Match Modal ── */}
      <Modal visible={showAbandonModal} animationType="fade" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <View style={{
            backgroundColor: colors.surfaceVariant, borderRadius: 20,
            width: '100%', padding: 24,
            borderWidth: 1, borderColor: `${colors.error}30`,
          }}>
            {/* Warning icon */}
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: `${colors.error}18`, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                <Icon name="alert" size={26} color={colors.error} />
              </View>
              <Text style={{ fontSize: 18, color: colors.error, fontFamily: Typography.fontFamily.bold }}>Abandon Match</Text>
              <Text style={{ fontSize: 13, color: colors.textTertiary, fontFamily: Typography.fontFamily.regular, marginTop: 4, textAlign: 'center' }}>This action cannot be undone</Text>
            </View>

            {/* Divider */}
            <View style={{ height: 1, backgroundColor: `${colors.error}25`, marginBottom: 16 }} />

            {/* Input */}
            <Text style={{ color: colors.textSecondary, marginBottom: 8, fontSize: 12, fontFamily: Typography.fontFamily.semiBold, letterSpacing: 0.8, textTransform: 'uppercase' }}>Reason</Text>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', backgroundColor: colors.surface, borderWidth: 1.5, borderColor: `${colors.error}40`, borderRadius: 12, paddingHorizontal: 14, paddingTop: 4, marginBottom: 20 }}>
              <Icon name="text" size={16} color={colors.textTertiary} style={{ marginTop: 14, marginRight: 10 }} />
              <TextInput
                style={{ flex: 1, paddingVertical: 12, color: colors.textPrimary, fontSize: 15, fontFamily: Typography.fontFamily.medium }}
                placeholder="e.g. Rain, Bad Light, Player Injury"
                placeholderTextColor={colors.textTertiary}
                value={abandonReason}
                onChangeText={setAbandonReason}
                multiline
              />
            </View>

            {/* Buttons row */}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
                onPress={() => setShowAbandonModal(false)}
                activeOpacity={0.7}
              >
                <Text style={{ color: colors.textPrimary, fontFamily: Typography.fontFamily.semiBold, fontSize: 15 }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1.5, paddingVertical: 14, borderRadius: 12, alignItems: 'center', backgroundColor: colors.error, flexDirection: 'row', justifyContent: 'center', gap: 8 }}
                onPress={executeAbandonMatch}
                activeOpacity={0.8}
              >
                <Icon name="cancel" size={16} color="#fff" />
                <Text style={{ color: '#fff', fontFamily: Typography.fontFamily.bold, fontSize: 15 }}>Abandon</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Player Preview Modal — Premium Style */}
      {selectedPlayerPreview && (
        <Modal
          visible
          transparent
          animationType="fade"
          statusBarTranslucent
          onRequestClose={() => setSelectedPlayerPreview(null)}
        >
          <Pressable style={styles.ppModalOverlay} onPress={() => setSelectedPlayerPreview(null)}>
            <Pressable style={styles.ppCard} onPress={() => { }}>
              {/* Full-width cover image */}
              <View style={styles.ppCoverContainer}>
                {(selectedPlayerPreview.photo || selectedPlayerPreview.userId?.photo) ? (
                  <Image
                    source={{ uri: getImageUrl(selectedPlayerPreview.photo || selectedPlayerPreview.userId?.photo) }}
                    style={styles.ppCoverImage}
                    resizeMode="cover"
                  />
                ) : (
                  <Image
                    source={selectedPlayerPreview.playingRole === 'Bowler' ? FALLBACK_BOWLER : FALLBACK_BATTER}
                    style={styles.ppCoverImage}
                    resizeMode="cover"
                  />
                )}
                {/* Black gradient with name */}
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.72)', 'rgba(0,0,0,0.97)']}
                  style={styles.ppGradient}
                >
                  <Text style={styles.ppName}>{selectedPlayerPreview.name}</Text>
                  {selectedPlayerPreview.team?.name ? (
                    <Text style={styles.ppTeam}>{selectedPlayerPreview.team.name}</Text>
                  ) : null}
                </LinearGradient>
                {/* Close X */}
                <TouchableOpacity style={styles.ppClose} onPress={() => setSelectedPlayerPreview(null)}>
                  <Icon name="close" size={18} color="#fff" />
                </TouchableOpacity>
              </View>

              {/* Overall Career Stats Row */}
              <View style={styles.ppStatsRow}>
                {playerPreviewLoading ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  [{
                    label: 'Matches',
                    value: playerPreviewStats?.career?.matches ?? '-',
                    icon: 'cricket'
                  }, {
                    label: 'Runs',
                    value: playerPreviewStats?.batting?.runs ?? '-',
                    icon: 'run'
                  }, {
                    label: 'Wickets',
                    value: playerPreviewStats?.bowling?.wickets ?? '-',
                    icon: 'bowling'
                  }].map((s, i) => (
                    <View key={i} style={styles.ppStatPill}>
                      <Text style={styles.ppStatValue}>{s.value}</Text>
                      <Text style={styles.ppStatLabel}>{s.label}</Text>
                    </View>
                  ))
                )}
              </View>

              {/* View Profile Button */}
              <TouchableOpacity
                style={styles.ppViewBtn}
                activeOpacity={0.85}
                onPress={() => {
                  const pId = selectedPlayerPreview._id;
                  setSelectedPlayerPreview(null);
                  if (pId) navigation.navigate('PlayerDetail', { id: pId });
                }}
              >
                <Icon name="account-arrow-right" size={18} color="#000" style={{ marginRight: 6 }} />
                <Text style={styles.ppViewBtnText}>View Full Profile</Text>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {/* Share Preview Modal */}
      <SharePreviewModal
        visible={!!activePosterType}
        onClose={() => setActivePosterType(null)}
        title={
          activePosterType === 'motm'
            ? 'Player of the Match'
            : activePosterType === 'aiReport'
              ? 'AI Match Report'
              : `${liveState?.match?.teamA?.name || 'Team A'} vs ${liveState?.match?.teamB?.name || 'Team B'}`
        }
        shareUrl={`https://www.scoreverse.in/match/${cleanMatchId}`}
      >
        {activePosterType === 'summary' && <MatchSummaryPoster liveState={liveState} />}
        {activePosterType === 'motm' && <MotmPoster liveState={liveState} mvp={resolvedMvp} />}
        {activePosterType === 'aiReport' && <AiReportPoster liveState={liveState} aiReport={aiReport} />}
      </SharePreviewModal>

      {/* Tag Definition Modal */}
      <Modal visible={!!selectedTagDefinition} transparent={true} animationType="fade" onRequestClose={() => setSelectedTagDefinition(null)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setSelectedTagDefinition(null)}>
          <View style={[styles.modalContent, { width: '70%', alignItems: 'center' }]}>
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primaryAlpha20, justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
              <Icon name="tag" size={24} color={colors.primary} />
            </View>
            <Text style={{ fontSize: 18, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary, marginBottom: 8, textAlign: 'center' }}>{selectedTagDefinition?.name}</Text>
            <Text style={{ fontSize: 14, fontFamily: Typography.fontFamily.regular, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 }}>
              {selectedTagDefinition?.desc}
            </Text>
            <TouchableOpacity style={{ marginTop: 24, paddingVertical: 10, paddingHorizontal: 24, backgroundColor: colors.primary, borderRadius: BorderRadius.md }} onPress={() => setSelectedTagDefinition(null)}>
              <Text style={{ color: colors.background, fontFamily: Typography.fontFamily.bold }}>Got It</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Celebration Overlay */}
      {celebration && (
        <View style={[StyleSheet.absoluteFill, { zIndex: 9999, elevation: 999 }]} pointerEvents="none">
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
            <RNAnimated.Text style={{
              fontSize: celebration.type === 'won' ? 44 : 140,
              fontFamily: Typography.fontFamily.bold,
              color: celebration.color,
              textAlign: 'center',
              textShadowColor: 'rgba(0,0,0,0.8)',
              textShadowOffset: { width: 0, height: 6 },
              textShadowRadius: 15,
              transform: [{ scale: celebrationAnim }],
              paddingHorizontal: 20,
            }}>
              {celebration.text}
            </RNAnimated.Text>

            {celebration.type === 'won' && (
              <ConfettiCannon count={150} origin={{ x: SCREEN_WIDTH / 2, y: -20 }} fadeOut={true} fallSpeed={2500} colors={['#FFD700', '#FF8C00', '#FF1493', '#00BFFF', '#32CD32']} />
            )}
            {(celebration.type === 'six' || celebration.type === 'four') && (
              <ConfettiCannon count={80} origin={{ x: SCREEN_WIDTH / 2, y: -20 }} fadeOut={true} fallSpeed={3000} colors={['#FFF', celebration.color, '#FFD700']} />
            )}
          </View>
        </View>
      )}
      {activeAudioUrl && (
        <Video
          source={{ uri: activeAudioUrl }}
          paused={false}
          playInBackground={true}
          ignoreSilentSwitch="ignore"
          audioOnly={true}
          style={{ width: 0, height: 0, position: 'absolute' }}
          onEnd={() => {
            console.log("🎙️ Commentary playback finished");
            setActiveAudioUrl(null);
          }}
          onError={(e) => {
            console.error("❌ Cloudinary Audio playback error:", e);
            setActiveAudioUrl(null);
          }}
        />
      )}

    </View>
  );
};

const createStyles = (colors, shadows, isDark) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  errorText: { color: colors.textSecondary, fontFamily: Typography.fontFamily.medium, fontSize: 16 },

  // ── Header ──────────────────────────────────────────────────────────────────
  headerPrimary: {
    paddingBottom: 4,
    ...shadows.sm,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  headerBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 8,
    overflow: 'hidden',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    overflow: 'hidden',
    width: '100%',
  },
  headerTeamVs: {
    fontSize: 15,
    fontFamily: Typography.fontFamily.bold,
    color: '#111827',
    letterSpacing: 0.3,
  },
  headerVsText: {
    fontFamily: Typography.fontFamily.medium,
    color: 'rgba(17,24,39,0.75)',
    fontSize: 11,
    marginTop: 1,
  },

  // Status badges
  statusBadgeLive: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D32F2F',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 99,
    gap: 3.5,
  },
  statusBadgeCompleted: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.30)',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 99,
    gap: 3.5,
  },
  statusBadgeBreak: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warning,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 99,
    marginTop: 4,
    gap: 4,
  },
  statusBadgeText: {
    fontSize: 10,
    fontFamily: Typography.fontFamily.bold,
    color: '#fff',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FF5252',
  },

  // ── Tab Bar (matches TournamentDetailScreen) ─────────────────────────────────
  tabBarWrapper: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tabsRow: {
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  tabItem: {
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderBottomWidth: 2.5,
    borderBottomColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabItemActive: {
    borderBottomColor: colors.primary,
  },
  tabText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontFamily: Typography.fontFamily.medium,
    letterSpacing: 0.2,
  },
  tabTextActive: {
    color: isDark ? colors.primary : colors.primaryDark,
    fontFamily: Typography.fontFamily.bold,
    fontSize: 13,
  },

  // ── Content ──────────────────────────────────────────────────────────────────
  tabContentContainer: { flex: 1, backgroundColor: colors.background },
  content: { padding: Spacing.base, paddingBottom: 100 },

  section: {
    backgroundColor: colors.surfaceVariant,
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  sectionTitle: {
    color: colors.primary,
    fontFamily: Typography.fontFamily.bold,
    fontSize: 11,
    marginBottom: 14,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },

  infoRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    alignItems: 'center',
  },
  infoLabel: { flex: 1, color: colors.textSecondary, fontFamily: Typography.fontFamily.medium, fontSize: 13 },
  infoValue: { flex: 2, color: colors.textPrimary, fontFamily: Typography.fontFamily.semiBold, fontSize: 13, textAlign: 'right' },

  battingTeamName: { color: colors.textSecondary, fontFamily: Typography.fontFamily.bold, fontSize: 14, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 },
  mainScoreRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 12 },
  scoreNumber: { color: colors.textPrimary, fontFamily: Typography.fontFamily.bold, fontSize: 38 },
  oversNumber: { color: colors.textTertiary, fontFamily: Typography.fontFamily.medium, fontSize: 16, marginLeft: 10 },
  crrText: { color: colors.textSecondary, fontFamily: Typography.fontFamily.semiBold, fontSize: 13 },
  tossTextPrimary: { color: colors.primary, fontFamily: Typography.fontFamily.medium, fontSize: 13 },
  yetToStartText: { color: colors.warning, fontFamily: Typography.fontFamily.bold, fontSize: 14, marginTop: 8 },

  // Over Timeline (matches Live Scorer style)
  msOverTimeline: {
    marginTop: 14,
  },
  msOverTimelineLabel: {
    color: colors.textTertiary,
    marginBottom: 8,
    fontFamily: Typography.fontFamily.bold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  msBallCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.backgroundElevated,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  msBallText: {
    color: colors.textPrimary,
    fontFamily: Typography.fontFamily.bold,
    fontSize: 13,
  },

  tableHeaderRow: { flexDirection: 'row', paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.borderLight, marginBottom: 4 },
  tableHeaderText: { flex: 1, color: colors.textTertiary, fontSize: 11, fontFamily: Typography.fontFamily.bold, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.5 },
  tableRow: { flexDirection: 'row', paddingVertical: 12, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  playerNameActive: { color: colors.primary, fontSize: 14, fontFamily: Typography.fontFamily.semiBold },
  playerNameNormal: { color: colors.textPrimary, fontSize: 14, fontFamily: Typography.fontFamily.medium },
  playerNameClickable: {
    color: colors.textPrimary,
    fontSize: 14,
    fontFamily: Typography.fontFamily.medium,
    // textDecorationLine: 'underline',
    textDecorationColor: 'rgba(255,255,255,0.2)',
  },
  tableRowText: { flex: 1, color: colors.textSecondary, fontSize: 13, fontFamily: Typography.fontFamily.semiBold, textAlign: 'center' },

  // Did Not Bat chips
  dnbChip: { flexDirection: 'row', alignItems: 'center' },
  dnbChipText: { color: colors.textSecondary, fontSize: 13, fontFamily: Typography.fontFamily.medium, textDecorationColor: 'rgba(255,255,255,0.15)' },
  dnbComma: { color: colors.textTertiary, fontSize: 13, marginRight: 4, marginLeft: 1 },

  // Innings Break Card
  inningsBreakCard: { borderRadius: BorderRadius.lg, overflow: 'hidden', marginBottom: 12, borderWidth: 1, borderColor: colors.warning + '50' },
  inningsBreakGradient: { padding: 20 },
  inningsBreakIconRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  inningsBreakIconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,143,0,0.15)', justifyContent: 'center', alignItems: 'center' },
  inningsBreakBadge: { backgroundColor: colors.warning, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 99 },
  inningsBreakBadgeText: { color: '#fff', fontSize: 10, fontFamily: Typography.fontFamily.bold, letterSpacing: 1, textTransform: 'uppercase' },
  inningsBreakTitle: { color: colors.textPrimary, fontFamily: Typography.fontFamily.bold, fontSize: 16, marginBottom: 12 },
  inningsBreakSub: { color: colors.textSecondary, fontFamily: Typography.fontFamily.medium, fontSize: 13, marginTop: 4 },
  targetChaseRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 4 },
  targetBox: { backgroundColor: colors.warning, borderRadius: BorderRadius.md, paddingHorizontal: 16, paddingVertical: 10, alignItems: 'center', minWidth: 70 },
  targetBoxLabel: { color: 'rgba(0,0,0,0.7)', fontSize: 9, fontFamily: Typography.fontFamily.bold, letterSpacing: 1, textTransform: 'uppercase' },
  targetBoxValue: { color: colors.textOnPrimary, fontSize: 26, fontFamily: Typography.fontFamily.bold, lineHeight: 30 },
  targetChaseInfo: { flex: 1 },
  targetChaseTeam: { color: colors.textPrimary, fontFamily: Typography.fontFamily.bold, fontSize: 14, marginBottom: 2 },
  targetChaseDesc: { color: colors.textSecondary, fontFamily: Typography.fontFamily.medium, fontSize: 12, marginBottom: 2 },
  targetChaseRRR: { color: colors.textTertiary, fontFamily: Typography.fontFamily.medium, fontSize: 12 },

  // Leaderboard
  awardCard: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.borderLight, gap: 12 },
  awardIconWrap: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  awardLabel: { fontSize: 10, fontFamily: Typography.fontFamily.bold, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 },
  awardPlayerName: { fontSize: 14, fontFamily: Typography.fontFamily.semiBold, color: colors.textPrimary },
  awardTeam: { fontSize: 11, fontFamily: Typography.fontFamily.regular, color: colors.textTertiary, marginTop: 1 },
  awardStatBox: { alignItems: 'flex-end' },
  awardStatValue: { fontSize: 18, fontFamily: Typography.fontFamily.bold, color: colors.primary },
  awardStatLabel: { fontSize: 10, color: colors.textTertiary, fontFamily: Typography.fontFamily.regular, marginTop: 1 },

  lbFilterRow: { flexDirection: 'row', marginBottom: 12, backgroundColor: colors.surfaceVariant, borderRadius: BorderRadius.md, padding: 3, borderWidth: 1, borderColor: colors.border },
  lbFilterBtn: { flex: 1, paddingVertical: 7, alignItems: 'center', borderRadius: BorderRadius.sm },
  lbFilterBtnActive: { backgroundColor: colors.primary },
  lbFilterText: { fontSize: 12, fontFamily: Typography.fontFamily.semiBold, color: colors.textSecondary },
  lbFilterTextActive: { color: colors.textOnPrimary, fontFamily: Typography.fontFamily.bold },

  lbRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.borderLight, gap: 10 },
  lbRank: { width: 24, fontSize: 14, fontFamily: Typography.fontFamily.bold, color: colors.textTertiary, textAlign: 'center' },
  lbRankSm: { width: 18, fontSize: 11, fontFamily: Typography.fontFamily.medium, color: colors.textTertiary, textAlign: 'center' },
  lbSimpleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.borderLight, gap: 8 },
  lbSimpleName: { flex: 3, fontSize: 14, fontFamily: Typography.fontFamily.medium, color: colors.primary, textDecorationColor: 'rgba(255,255,255,0.15)' },
  lbSimpleStat: { width: 40, fontSize: 14, fontFamily: Typography.fontFamily.semiBold, color: colors.textSecondary, textAlign: 'center' },
  lbSimplePoints: { flex: 1.5, fontSize: 14, fontFamily: Typography.fontFamily.bold, color: colors.primary, textAlign: 'right' },
  lbAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center', overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  lbAvatarText: { color: colors.textSecondary, fontFamily: Typography.fontFamily.bold, fontSize: 16 },
  lbName: { fontSize: 13, fontFamily: Typography.fontFamily.semiBold, color: colors.textPrimary },
  lbTeam: { fontSize: 11, fontFamily: Typography.fontFamily.regular, color: colors.textTertiary, marginTop: 1 },
  lbPoints: { fontSize: 16, fontFamily: Typography.fontFamily.bold, color: colors.primary },
  lbPointsLabel: { fontSize: 10, color: colors.textTertiary, fontFamily: Typography.fontFamily.regular, textAlign: 'right' },

  partnershipRow: { paddingTop: 10, marginTop: 2 },
  partnershipText: { color: colors.textTertiary, fontSize: 12, fontFamily: Typography.fontFamily.medium },

  commentaryItem: { flexDirection: 'row', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  commentaryBadge: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: colors.border, justifyContent: 'center', alignItems: 'center', marginRight: 12, backgroundColor: colors.surfaceVariant },
  commentaryBadgeText: { color: colors.textPrimary, fontSize: 14, fontFamily: Typography.fontFamily.bold },
  commentaryOver: { color: colors.textTertiary, fontSize: 12, fontFamily: Typography.fontFamily.medium, marginBottom: 2 },
  commentaryDesc: { color: colors.textSecondary, fontSize: 14, fontFamily: Typography.fontFamily.regular },
  commentaryAction: { color: colors.textPrimary, fontFamily: Typography.fontFamily.bold },

  squadPlayerName: { color: colors.textPrimary, fontSize: 14, fontFamily: Typography.fontFamily.medium, paddingVertical: 6 },
  emptyText: { color: colors.textTertiary, fontFamily: Typography.fontFamily.medium, fontSize: 14, textAlign: 'center', marginTop: 20 },

  // ── Footer ───────────────────────────────────────────────────────────────────
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: colors.surfaceVariant,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  continueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: BorderRadius.lg,
    backgroundColor: colors.primary,
    ...shadows.glow,
  },
  continueBtnText: {
    color: colors.textOnPrimary,
    fontFamily: Typography.fontFamily.bold,
    fontSize: 16,
    letterSpacing: 0.3,
  },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: BorderRadius.md, backgroundColor: colors.surfaceVariant, justifyContent: 'center', alignItems: 'center' },
  cancelBtnText: { color: colors.textPrimary, fontFamily: Typography.fontFamily.bold, fontSize: 16 },
  spectatorBtn: { flex: 2, paddingVertical: 14, borderRadius: BorderRadius.md, backgroundColor: colors.secondary, justifyContent: 'center', alignItems: 'center' },
  spectatorBtnText: { color: '#FFF', fontFamily: Typography.fontFamily.bold, fontSize: 16 },

  // ── Modals ───────────────────────────────────────────────────────────────────
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: colors.surfaceVariant, borderRadius: BorderRadius.xl, padding: 24, width: '80%', alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  declareResultOption: { flexDirection: 'row', justifyContent: 'flex-start', paddingVertical: 16, paddingHorizontal: 24, borderBottomWidth: 1, borderBottomColor: colors.borderLight, alignItems: 'center', width: '100%' },
  declareResultOptionText: { fontSize: 16, fontFamily: Typography.fontFamily.medium, color: colors.textPrimary },
  modalAvatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center', marginBottom: 16, borderWidth: 2, borderColor: colors.primary },
  modalAvatarText: { color: colors.primary, fontSize: 32, fontFamily: Typography.fontFamily.bold },
  modalPlayerName: { color: colors.textPrimary, fontSize: 20, fontFamily: Typography.fontFamily.bold, marginBottom: 24, textAlign: 'center' },
  modalActions: { flexDirection: 'row', width: '100%', gap: 12 },
  modalBtnCancel: { flex: 1, paddingVertical: 13, borderRadius: BorderRadius.md, backgroundColor: colors.surface, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  modalBtnTextCancel: { color: colors.textPrimary, fontFamily: Typography.fontFamily.semiBold, fontSize: 14 },
  modalBtnView: { flex: 1, paddingVertical: 13, borderRadius: BorderRadius.md, backgroundColor: colors.primary, alignItems: 'center' },
  modalBtnTextView: { color: colors.textOnPrimary, fontFamily: Typography.fontFamily.bold, fontSize: 14 },

  // ── Premium Player Preview Modal ─────────────────────────────────────────────
  ppModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  ppCard: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
  },
  ppCoverContainer: {
    width: '100%',
    height: 280,
    backgroundColor: '#1a1a1a',
    position: 'relative',
  },
  ppCoverImage: {
    width: '100%',
    height: '100%',
  },
  ppCoverFallback: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
  },
  ppCoverFallbackLetter: {
    fontSize: 80,
    fontFamily: Typography.fontFamily.bold,
    color: colors.primary,
    opacity: 0.4,
  },
  ppGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '65%',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 3,
  },
  ppName: {
    fontSize: 26,
    fontFamily: Typography.fontFamily.bold,
    color: '#fff',
    letterSpacing: 0.4,
  },
  ppTeam: {
    fontSize: 13,
    fontFamily: Typography.fontFamily.medium,
    color: 'rgba(255,255,255,0.6)',
  },
  ppClose: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ppViewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    marginHorizontal: 16,
    marginVertical: 16,
    borderRadius: 12,
    paddingVertical: 14,
  },
  ppViewBtnText: {
    fontSize: 15,
    fontFamily: Typography.fontFamily.bold,
    color: '#000',
    letterSpacing: 0.3,
  },
  ppStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    backgroundColor: isDark ? colors.backgroundElevated : colors.surfaceVariant,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  ppStatPill: {
    flex: 1,
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: colors.border,
    paddingVertical: 4,
  },
  ppStatValue: {
    fontSize: 22,
    fontFamily: Typography.fontFamily.bold,
    color: colors.primary,
  },
  ppStatLabel: {
    fontSize: 11,
    fontFamily: Typography.fontFamily.medium,
    color: colors.textSecondary,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  // ── Innings Timings Timeline Styles ──
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  timelinePoint: {
    flex: 1,
  },
  timelineLabel: {
    fontSize: 13,
    fontFamily: Typography.fontFamily.bold,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  timelineTime: {
    fontSize: 14,
    fontFamily: Typography.fontFamily.semiBold,
    color: colors.textPrimary,
  },
});

export default MatchSummaryScreen;
