import React, { useEffect, useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  ScrollView, Image, ActivityIndicator, TextInput, Modal,
  Animated, ToastAndroid, Platform, RefreshControl, StatusBar
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from '../../../components/SolidGradient';
import { useDispatch, useSelector } from 'react-redux';
import { fetchMyTeams, fetchOpponentTeams, fetchFollowingTeams, toggleFollowTeam, joinTeam } from '../teamSlice';
import { useTheme, Typography, Spacing, BorderRadius } from '../../../theme/theme';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { getImageUrl } from '../../../api/axios';
import { showCustomAlert } from '../../../components/CustomAlert';

const SECTION_TABS = [
  { id: 'my', label: 'My Teams', icon: 'shield-account' },
  { id: 'opponents', label: 'Opponents', icon: 'sword-cross' },
  { id: 'following', label: 'Following', icon: 'account-group' },
];

const TeamListScreen = ({ navigation }) => {
  const dispatch = useDispatch();
  const { colors, shadows, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, shadows, isDark), [colors, shadows, isDark]);

  const { myTeams, opponentTeams, followingTeams = [], isLoading, opponentsLoading, followingLoading } = useSelector((s) => s.team);
  const [activeSection, setActiveSection] = useState('my');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    dispatch(fetchMyTeams());
    dispatch(fetchOpponentTeams());
    dispatch(fetchFollowingTeams());
  }, [dispatch]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      dispatch(fetchMyTeams()),
      dispatch(fetchOpponentTeams()),
      dispatch(fetchFollowingTeams())
    ]);
    setRefreshing(false);
  };

  const handleFollow = async (teamId) => {
    try {
      const res = await dispatch(toggleFollowTeam(teamId)).unwrap();
      dispatch(fetchFollowingTeams());
      const msg = res.isFollowing ? 'You are now following this team' : 'Unfollowed team';
      if (Platform.OS === 'android') {
        ToastAndroid.show(msg, ToastAndroid.SHORT);
      } else {
        showCustomAlert(res.isFollowing ? 'Following' : 'Unfollowed', msg);
      }
    } catch (e) {
      showCustomAlert('Error', e || 'Failed to update follow status');
    }
  };

  // ── My Team Card ─────────────────────────────────────────────────────────
  const renderMyTeam = ({ item }) => {
    const winPct = item.stats?.matches > 0
      ? ((item.stats.wins / item.stats.matches) * 100).toFixed(0)
      : '—';

    return (
      <TouchableOpacity
        style={styles.teamCard}
        activeOpacity={0.88}
        onPress={() => navigation.navigate('TeamDetail', { id: item._id })}
      >
        {/* Logo */}
        <View style={styles.logoWrap}>
          {item.logo
            ? <Image source={{ uri: getImageUrl(item.logo) }} style={styles.logo} />
            : (
              <LinearGradient colors={[colors.primaryAlpha20, colors.primaryAlpha10]} style={styles.logoFallback}>
                <Text style={styles.logoLetter}>{(item.name || 'T').trim().charAt(0).toUpperCase()}</Text>
              </LinearGradient>
            )
          }
        </View>

        {/* Info */}
        <View style={styles.teamInfo}>
          <Text style={styles.teamName} numberOfLines={1}>{item.name}</Text>
          {item.city && (
            <View style={styles.cityRow}>
              <Icon name="map-marker-outline" size={11} color={colors.textTertiary} />
              <Text style={styles.cityText}>{item.city}</Text>
            </View>
          )}
          <View style={styles.statsRow}>
            <StatBadge icon="cricket" label={`${item.stats?.matches || 0} M`} />
            <StatBadge icon="trophy-outline" label={`${item.stats?.wins || 0} W`} primary />
            <StatBadge icon="close-circle-outline" label={`${item.stats?.losses || 0} L`} danger />
            {winPct !== '—' && <StatBadge icon="percent" label={`${winPct}%`} primary />}
          </View>
        </View>

        {/* Right Arrow */}
        <Icon name="chevron-right" size={20} color={colors.textTertiary} style={{ marginLeft: 8 }} />
      </TouchableOpacity>
    );
  };

  // ── Opponent Team Card ────────────────────────────────────────────────────
  const renderOpponentTeam = ({ item }) => {
    const h2h = item.headToHead || { wins: 0, losses: 0 };

    return (
      <TouchableOpacity
        style={styles.teamCard}
        activeOpacity={0.88}
        onPress={() => navigation.navigate('TeamDetail', { id: item._id })}
      >
        {/* Logo */}
        <View style={styles.logoWrap}>
          {item.logo
            ? <Image source={{ uri: getImageUrl(item.logo) }} style={styles.logo} />
            : (
              <LinearGradient colors={[colors.primaryAlpha20, colors.primaryAlpha10]} style={styles.logoFallback}>
                <Text style={styles.logoLetter}>{(item.name || 'T').trim().charAt(0).toUpperCase()}</Text>
              </LinearGradient>
            )
          }
        </View>

        {/* Info */}
        <View style={styles.teamInfo}>
          <Text style={styles.teamName} numberOfLines={1}>{item.name}</Text>
          {item.city && (
            <View style={styles.cityRow}>
              <Icon name="map-marker-outline" size={11} color={colors.textTertiary} />
              <Text style={styles.cityText}>{item.city}</Text>
            </View>
          )}
          {/* Head-to-head */}
          <View style={styles.h2hRow}>
            <Text style={styles.h2hLabel}>H2H:</Text>
            <View style={styles.h2hBadge}>
              <Text style={[styles.h2hNum, { color: colors.success }]}>{h2h.wins}W</Text>
              <Text style={styles.h2hDash}> · </Text>
              <Text style={[styles.h2hNum, { color: colors.error }]}>{h2h.losses}L</Text>
            </View>
          </View>
        </View>

        {/* Right Arrow */}
        <Icon name="chevron-right" size={20} color={colors.textTertiary} style={{ marginLeft: 8 }} />
      </TouchableOpacity>
    );
  };

  const currentData = activeSection === 'my' ? myTeams : activeSection === 'opponents' ? opponentTeams : followingTeams;
  const currentLoading = activeSection === 'my' ? isLoading : activeSection === 'opponents' ? opponentsLoading : followingLoading;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.surface} />
      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Icon name="arrow-left" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerLabel}>CRICKET</Text>
            <Text style={styles.headerTitle}>Teams</Text>
          </View>
          <TouchableOpacity
            style={styles.headerAddBtn}
            onPress={() => navigation.navigate('TeamCreate')}
            activeOpacity={0.8}
          >
            <LinearGradient colors={colors.primaryGradient} style={styles.addBtnGrad}>
              <Icon name="plus" size={18} color={colors.textOnPrimary} />
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Section Tabs */}
        <View style={styles.sectionTabBar}>
          {SECTION_TABS.map(tab => {
            const isActive = activeSection === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                style={[styles.sectionTab, isActive && styles.sectionTabActive]}
                onPress={() => setActiveSection(tab.id)}
                activeOpacity={0.8}
              >
                <Icon name={tab.icon} size={14} color={isActive ? colors.textOnPrimary : colors.textSecondary} />
                <Text style={[styles.sectionTabText, isActive && styles.sectionTabTextActive]}>
                  {tab.label}
                </Text>
                {isActive && (
                  <View style={styles.sectionTabCount}>
                    <Text style={styles.sectionTabCountText}>
                      {tab.id === 'my' ? myTeams.length : tab.id === 'opponents' ? opponentTeams.length : followingTeams.length}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* ── List ── */}
      {currentLoading && currentData.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={currentData}
          keyExtractor={item => item._id}
          renderItem={activeSection === 'opponents' ? renderOpponentTeam : renderMyTeam}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <View style={styles.emptyCircle}>
                <Icon
                  name={activeSection === 'my' ? 'shield-account' : activeSection === 'opponents' ? 'sword-cross' : 'account-group'}
                  size={46}
                  color={colors.primary}
                />
              </View>
              <Text style={styles.emptyTitle}>
                {activeSection === 'my' ? 'No Teams Yet' : activeSection === 'opponents' ? 'No Opponents Yet' : 'Not following any teams'}
              </Text>
              <Text style={styles.emptySub}>
                {activeSection === 'my'
                  ? 'Create your first team to get started'
                  : activeSection === 'opponents'
                  ? 'Play some matches to see opponent teams here'
                  : 'Follow your favorite teams to track them here'}
              </Text>
              {activeSection === 'my' && (
                <TouchableOpacity
                  style={styles.emptyCreateBtn}
                  onPress={() => navigation.navigate('TeamCreate')}
                  activeOpacity={0.8}
                >
                  <LinearGradient colors={colors.primaryGradient} style={styles.emptyCreateBtnInner}>
                    <Icon name="plus" size={16} color={colors.textOnPrimary} />
                    <Text style={styles.emptyCreateText}>Create Team</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}

    </SafeAreaView>
  );
};

// ── Small helpers ─────────────────────────────────────────────────────────────

const StatBadge = ({ icon, label, primary, danger }) => {
  const { colors, isDark } = useTheme();
  return (
    <View style={[
      badgeStyles.statBadge,
      {
        backgroundColor: primary 
          ? colors.primaryAlpha10 
          : danger 
          ? colors.errorLight 
          : (isDark ? colors.backgroundElevated : colors.surfaceVariant),
        borderColor: primary 
          ? colors.primaryAlpha30 
          : danger 
          ? colors.error 
          : colors.border,
      }
    ]}>
      <Icon 
        name={icon} 
        size={10} 
        color={primary ? (isDark ? colors.primary : colors.primaryDark) : danger ? colors.error : colors.textTertiary} 
      />
      <Text style={[
        badgeStyles.statBadgeText,
        {
          color: primary 
            ? (isDark ? colors.primary : colors.primaryDark) 
            : danger 
            ? colors.error 
            : colors.textSecondary,
        }
      ]}>
        {label}
      </Text>
    </View>
  );
};

const badgeStyles = StyleSheet.create({
  statBadge: {
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 3,
    borderRadius: 6,
    paddingHorizontal: 7, 
    paddingVertical: 3,
    borderWidth: 1,
  },
  statBadgeText: { 
    fontFamily: Typography.fontFamily.medium, 
    fontSize: 10 
  },
});

// ── Styles ────────────────────────────────────────────────────────────────────
const createStyles = (colors, shadows, isDark) => StyleSheet.create({
  safe: { 
    flex: 1, 
    backgroundColor: colors.background 
  },

  header: {
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 0,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    ...(isDark ? {} : shadows.xs),
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : colors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: { 
    flex: 1, 
    alignItems: 'center' 
  },
  headerLabel: {
    color: colors.primary,
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  headerTitle: {
    color: colors.textPrimary,
    fontFamily: Typography.fontFamily.bold,
    fontSize: 20,
    marginTop: 1,
  },
  headerAddBtn: { 
    width: 38 
  },
  addBtnGrad: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },

  summaryRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    ...(isDark ? {} : shadows.sm),
  },
  summaryCard: { 
    flex: 1, 
    alignItems: 'center', 
    gap: 3 
  },
  summaryDivider: { 
    width: 1, 
    backgroundColor: colors.border, 
    alignSelf: 'stretch' 
  },
  summaryValue: { 
    color: colors.textPrimary, 
    fontFamily: Typography.fontFamily.bold, 
    fontSize: 20 
  },
  summaryLabel: { 
    color: colors.textTertiary, 
    fontFamily: Typography.fontFamily.regular, 
    fontSize: 10 
  },

  sectionTabBar: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 10,
  },
  sectionTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: isDark ? colors.backgroundCard : colors.surfaceVariant,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  sectionTabText: { 
    color: colors.textSecondary, 
    fontFamily: Typography.fontFamily.semiBold, 
    fontSize: 12 
  },
  sectionTabTextActive: { 
    color: colors.textOnPrimary, 
    fontFamily: Typography.fontFamily.bold, 
    fontSize: 12 
  },
  sectionTabCount: {
    backgroundColor: 'rgba(0,0,0,0.18)',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
    minWidth: 20,
    alignItems: 'center',
  },
  sectionTabCountText: { 
    color: colors.textOnPrimary, 
    fontFamily: Typography.fontFamily.bold, 
    fontSize: 10 
  },

  listContent: {
    padding: 14,
    paddingBottom: 24,
    gap: 12,
    backgroundColor: colors.background,
    flexGrow: 1,
  },

  listActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 4,
  },
  joinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.primaryAlpha30,
    backgroundColor: colors.primaryAlpha10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  joinBtnText: { 
    color: colors.primary, 
    fontFamily: Typography.fontFamily.semiBold, 
    fontSize: 12 
  },

  center: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    backgroundColor: colors.background 
  },

  // Team card
  teamCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    ...(isDark ? {} : shadows.sm),
  },
  logoWrap: { 
    marginRight: 12 
  },
  logo: { 
    width: 54, 
    height: 54, 
    borderRadius: 27, 
    borderWidth: 2, 
    borderColor: colors.primaryAlpha30 
  },
  logoFallback: {
    width: 54, 
    height: 54, 
    borderRadius: 27,
    alignItems: 'center', 
    justifyContent: 'center',
    borderWidth: 1.5, 
    borderColor: colors.primaryAlpha30,
  },
  logoLetter: {
    color: colors.primary,
    fontFamily: Typography.fontFamily.bold,
    fontSize: 22,
  },
  teamInfo: { 
    flex: 1 
  },
  teamName: { 
    color: colors.textPrimary, 
    fontFamily: Typography.fontFamily.bold, 
    fontSize: 15, 
    marginBottom: 3 
  },
  cityRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 3, 
    marginBottom: 6 
  },
  cityText: { 
    color: colors.textTertiary, 
    fontFamily: Typography.fontFamily.regular, 
    fontSize: 11 
  },
  statsRow: { 
    flexDirection: 'row', 
    gap: 5, 
    flexWrap: 'wrap' 
  },

  cardActions: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginLeft: 8,
  },
  miniActionBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : colors.surfaceVariant,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  miniActionBtnActive: {
    backgroundColor: colors.primaryAlpha10,
    borderColor: colors.primaryAlpha30,
  },

  h2hRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6 
  },
  h2hLabel: { 
    color: colors.textTertiary, 
    fontFamily: Typography.fontFamily.medium, 
    fontSize: 11 
  },
  h2hBadge: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: isDark ? colors.backgroundElevated : colors.surfaceVariant, 
    borderRadius: 6, 
    paddingHorizontal: 8, 
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  h2hNum: { 
    fontFamily: Typography.fontFamily.bold, 
    fontSize: 11 
  },
  h2hDash: { 
    color: colors.textTertiary, 
    fontSize: 11 
  },

  // Empty
  emptyWrap: { 
    alignItems: 'center', 
    paddingTop: 70, 
    paddingHorizontal: 32 
  },
  emptyCircle: {
    width: 84, 
    height: 84, 
    borderRadius: 42,
    alignItems: 'center', 
    justifyContent: 'center',
    marginBottom: 18, 
    borderWidth: 1, 
    borderColor: colors.primaryAlpha30,
    backgroundColor: colors.primaryAlpha10,
  },
  emptyTitle: { 
    color: colors.textPrimary, 
    fontFamily: Typography.fontFamily.bold, 
    fontSize: 18, 
    marginBottom: 6 
  },
  emptySub: { 
    color: colors.textSecondary, 
    fontFamily: Typography.fontFamily.regular, 
    fontSize: 13, 
    textAlign: 'center', 
    lineHeight: 20 
  },
  emptyCreateBtn: { 
    marginTop: 24, 
    borderRadius: 12, 
    overflow: 'hidden',
    ...shadows.md,
  },
  emptyCreateBtnInner: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8, 
    paddingHorizontal: 24, 
    paddingVertical: 13 
  },
  emptyCreateText: { 
    color: colors.textOnPrimary, 
    fontFamily: Typography.fontFamily.bold, 
    fontSize: 14 
  },

  // Join Modal
  modalOverlay: { 
    flex: 1, 
    backgroundColor: colors.blackAlpha50, 
    justifyContent: 'flex-end' 
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 22, 
    borderTopRightRadius: 22,
    borderTopWidth: 1, 
    borderTopColor: colors.border,
    paddingHorizontal: 20, 
    paddingTop: 12,
    ...shadows.lg,
  },
  modalHandle: { 
    width: 38, 
    height: 4, 
    backgroundColor: colors.border, 
    borderRadius: 2, 
    alignSelf: 'center', 
    marginBottom: 16 
  },
  modalHeaderRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 10, 
    marginBottom: 6 
  },
  modalTitle: { 
    color: colors.textPrimary, 
    fontFamily: Typography.fontFamily.bold, 
    fontSize: 18 
  },
  modalSub: { 
    color: colors.textSecondary, 
    fontFamily: Typography.fontFamily.regular, 
    fontSize: 13, 
    marginBottom: 16 
  },
  codeInputWrap: {
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 10,
    backgroundColor: isDark ? colors.background : colors.surfaceVariant, 
    borderRadius: 12,
    borderWidth: 1, 
    borderColor: colors.border,
    paddingHorizontal: 14, 
    height: 52, 
    marginBottom: 14,
  },
  codeInput: { 
    flex: 1, 
    color: colors.textPrimary, 
    fontFamily: Typography.fontFamily.bold, 
    fontSize: 16, 
    letterSpacing: 2 
  },
  joinSubmitBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: 8, 
    height: 52, 
    borderRadius: 12,
    backgroundColor: colors.primary,
  },
  joinSubmitText: { 
    color: colors.textOnPrimary, 
    fontFamily: Typography.fontFamily.bold, 
    fontSize: 15 
  },
});

export default TeamListScreen;
