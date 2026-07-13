import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  ScrollView, Image, ActivityIndicator, TextInput, Modal,
  Animated, ToastAndroid, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { useDispatch, useSelector } from 'react-redux';
import { fetchMyTeams, fetchOpponentTeams, fetchFollowingTeams, toggleFollowTeam, joinTeam } from '../teamSlice';
import { Colors, Typography, Spacing, Shadows, BorderRadius } from '../../../theme/theme';
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
  const { myTeams, opponentTeams, followingTeams = [], isLoading, opponentsLoading, followingLoading } = useSelector((s) => s.team);
  const [activeSection, setActiveSection] = useState('my');

  useEffect(() => {
    dispatch(fetchMyTeams());
    dispatch(fetchOpponentTeams());
    dispatch(fetchFollowingTeams());
  }, [dispatch]);

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
              <LinearGradient colors={[Colors.primaryAlpha20, Colors.primaryAlpha10]} style={styles.logoFallback}>
                <Icon name="shield" size={28} color={Colors.primary} />
              </LinearGradient>
            )
          }
        </View>

        {/* Info */}
        <View style={styles.teamInfo}>
          <Text style={styles.teamName} numberOfLines={1}>{item.name}</Text>
          {item.city && (
            <View style={styles.cityRow}>
              <Icon name="map-marker-outline" size={11} color={Colors.textTertiary} />
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

        {/* Follow + Chevron */}
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={[styles.followBtn, item.isFollowing && styles.followBtnActive]}
            onPress={() => handleFollow(item._id)}
          >
            <Icon name={item.isFollowing ? 'bell' : 'bell-outline'} size={16} color={item.isFollowing ? '#000' : Colors.primary} />
          </TouchableOpacity>
          <Icon name="chevron-right" size={20} color={Colors.textTertiary} style={{ marginTop: 8 }} />
        </View>
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
              <LinearGradient colors={['rgba(244,67,54,0.12)', 'rgba(244,67,54,0.05)']} style={styles.logoFallback}>
                <Icon name="shield-sword" size={28} color={Colors.error} />
              </LinearGradient>
            )
          }
        </View>

        {/* Info */}
        <View style={styles.teamInfo}>
          <Text style={styles.teamName} numberOfLines={1}>{item.name}</Text>
          {item.city && (
            <View style={styles.cityRow}>
              <Icon name="map-marker-outline" size={11} color={Colors.textTertiary} />
              <Text style={styles.cityText}>{item.city}</Text>
            </View>
          )}
          {/* Head-to-head */}
          <View style={styles.h2hRow}>
            <Text style={styles.h2hLabel}>H2H:</Text>
            <View style={styles.h2hBadge}>
              <Text style={[styles.h2hNum, { color: Colors.success }]}>{h2h.wins}W</Text>
              <Text style={styles.h2hDash}> · </Text>
              <Text style={[styles.h2hNum, { color: Colors.error }]}>{h2h.losses}L</Text>
            </View>
          </View>
        </View>

        {/* Follow button */}
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={[styles.followBtn, item.isFollowing && styles.followBtnActive]}
            onPress={() => handleFollow(item._id)}
          >
            <Icon name={item.isFollowing ? 'bell' : 'bell-outline'} size={16} color={item.isFollowing ? '#000' : Colors.primary} />
          </TouchableOpacity>
          <Icon name="chevron-right" size={20} color={Colors.textTertiary} style={{ marginTop: 8 }} />
        </View>
      </TouchableOpacity>
    );
  };

  const currentData = activeSection === 'my' ? myTeams : activeSection === 'opponents' ? opponentTeams : followingTeams;
  const currentLoading = activeSection === 'my' ? isLoading : activeSection === 'opponents' ? opponentsLoading : followingLoading;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* ── Header ── */}
      <LinearGradient colors={['#0A1F35', Colors.background]} style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Icon name="arrow-left" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerLabel}>CRICKET</Text>
            <Text style={styles.headerTitle}>Teams</Text>
          </View>
          <TouchableOpacity
            style={styles.headerAddBtn}
            onPress={() => navigation.navigate('TeamCreate')}
          >
            <LinearGradient colors={Colors.primaryGradient} style={styles.addBtnGrad}>
              <Icon name="plus" size={18} color="#000" />
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Stats summary */}
        <View style={styles.summaryRow}>
          <SummaryCard icon="shield-account" value={myTeams.length} label="My Teams" />
          <View style={styles.summaryDivider} />
          <SummaryCard icon="sword-cross" value={opponentTeams.length} label="Opponents Faced" />
          <View style={styles.summaryDivider} />
          <SummaryCard
            icon="trophy"
            value={myTeams.reduce((sum, t) => sum + (t.stats?.wins || 0), 0)}
            label="Total Wins"
            primary
          />
        </View>

        {/* Section Tabs */}
        <View style={styles.sectionTabBar}>
          {SECTION_TABS.map(tab => (
            <TouchableOpacity
              key={tab.id}
              style={[styles.sectionTab, activeSection === tab.id && styles.sectionTabActive]}
              onPress={() => setActiveSection(tab.id)}
              activeOpacity={0.8}
            >
              <Icon name={tab.icon} size={14} color={activeSection === tab.id ? '#000' : Colors.textSecondary} />
              <Text style={[styles.sectionTabText, activeSection === tab.id && styles.sectionTabTextActive]}>
                {tab.label}
              </Text>
              {activeSection === tab.id && (
                <View style={styles.sectionTabCount}>
                  <Text style={styles.sectionTabCountText}>
                    {tab.id === 'my' ? myTeams.length : tab.id === 'opponents' ? opponentTeams.length : followingTeams.length}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </LinearGradient>

      {/* ── List ── */}
      {currentLoading && currentData.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={currentData}
          keyExtractor={item => item._id}
          renderItem={activeSection === 'opponents' ? renderOpponentTeam : renderMyTeam}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <LinearGradient colors={[Colors.primaryAlpha10, 'transparent']} style={styles.emptyCircle}>
                <Icon
                  name={activeSection === 'my' ? 'shield-account' : activeSection === 'opponents' ? 'sword-cross' : 'account-group'}
                  size={50}
                  color={Colors.primaryAlpha20}
                />
              </LinearGradient>
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
                >
                  <LinearGradient colors={Colors.primaryGradient} style={styles.emptyCreateBtnInner}>
                    <Icon name="plus" size={16} color="#000" />
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

const StatBadge = ({ icon, label, primary, danger }) => (
  <View style={[
    styles.statBadge,
    primary && styles.statBadgePrimary,
    danger && styles.statBadgeDanger,
  ]}>
    <Icon name={icon} size={10} color={primary ? Colors.primary : danger ? Colors.error : Colors.textTertiary} />
    <Text style={[
      styles.statBadgeText,
      primary && { color: Colors.primary },
      danger && { color: Colors.error },
    ]}>{label}</Text>
  </View>
);

const SummaryCard = ({ icon, value, label, primary }) => (
  <View style={styles.summaryCard}>
    <Icon name={icon} size={16} color={primary ? Colors.primary : Colors.textSecondary} />
    <Text style={[styles.summaryValue, primary && { color: Colors.primary }]}>{value}</Text>
    <Text style={styles.summaryLabel}>{label}</Text>
  </View>
);

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0A1F35' },

  header: {
    backgroundColor: '#0A1F35',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 0,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
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
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerLabel: {
    color: Colors.primary,
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  headerTitle: {
    color: '#fff',
    fontFamily: Typography.fontFamily.bold,
    fontSize: 20,
    marginTop: 1,
  },
  headerAddBtn: { width: 38 },
  addBtnGrad: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },

  summaryRow: {
    flexDirection: 'row',
    backgroundColor: Colors.backgroundCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    marginBottom: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  summaryCard: { flex: 1, alignItems: 'center', gap: 3 },
  summaryDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.08)', alignSelf: 'stretch' },
  summaryValue: { color: '#fff', fontFamily: Typography.fontFamily.bold, fontSize: 20 },
  summaryLabel: { color: Colors.textTertiary, fontFamily: Typography.fontFamily.regular, fontSize: 10 },

  sectionTabBar: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 10,
  },
  sectionTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: Colors.backgroundCard,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  sectionTabActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  sectionTabText: { color: Colors.textSecondary, fontFamily: Typography.fontFamily.semiBold, fontSize: 13 },
  sectionTabTextActive: { color: '#000', fontFamily: Typography.fontFamily.bold, fontSize: 13 },
  sectionTabCount: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
    minWidth: 20,
    alignItems: 'center',
  },
  sectionTabCountText: { color: '#000', fontFamily: Typography.fontFamily.bold, fontSize: 10 },

  listContent: {
    padding: 14,
    paddingBottom: 24,
    gap: 12,
    backgroundColor: Colors.background,
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
    borderColor: Colors.primaryAlpha30,
    backgroundColor: Colors.primaryAlpha10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  joinBtnText: { color: Colors.primary, fontFamily: Typography.fontFamily.semiBold, fontSize: 12 },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },

  // Team card
  teamCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    ...Shadows.sm,
  },
  logoWrap: { marginRight: 12 },
  logo: { width: 54, height: 54, borderRadius: 27, borderWidth: 2, borderColor: Colors.primaryAlpha30 },
  logoFallback: {
    width: 54, height: 54, borderRadius: 27,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.primaryAlpha30,
  },
  teamInfo: { flex: 1 },
  teamName: { color: '#fff', fontFamily: Typography.fontFamily.bold, fontSize: 15, marginBottom: 3 },
  cityRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 6 },
  cityText: { color: Colors.textTertiary, fontFamily: Typography.fontFamily.regular, fontSize: 11 },
  statsRow: { flexDirection: 'row', gap: 5, flexWrap: 'wrap' },

  statBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: Colors.backgroundElevated, borderRadius: 6,
    paddingHorizontal: 7, paddingVertical: 3,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  statBadgePrimary: { borderColor: Colors.primaryAlpha30, backgroundColor: Colors.primaryAlpha10 },
  statBadgeDanger: { borderColor: 'rgba(244,67,54,0.3)', backgroundColor: 'rgba(244,67,54,0.08)' },
  statBadgeText: { color: Colors.textTertiary, fontFamily: Typography.fontFamily.medium, fontSize: 10 },

  cardActions: { alignItems: 'center', gap: 4 },
  followBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: Colors.primaryAlpha10,
    borderWidth: 1, borderColor: Colors.primaryAlpha30,
    alignItems: 'center', justifyContent: 'center',
  },
  followBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },

  h2hRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  h2hLabel: { color: Colors.textTertiary, fontFamily: Typography.fontFamily.medium, fontSize: 11 },
  h2hBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.backgroundElevated, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  h2hNum: { fontFamily: Typography.fontFamily.bold, fontSize: 11 },
  h2hDash: { color: Colors.textTertiary, fontSize: 11 },

  // Empty
  emptyWrap: { alignItems: 'center', paddingTop: 70, paddingHorizontal: 32 },
  emptyCircle: {
    width: 84, height: 84, borderRadius: 42,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 18, borderWidth: 1, borderColor: Colors.primaryAlpha30,
  },
  emptyTitle: { color: '#fff', fontFamily: Typography.fontFamily.bold, fontSize: 18, marginBottom: 6 },
  emptySub: { color: Colors.textSecondary, fontFamily: Typography.fontFamily.regular, fontSize: 13, textAlign: 'center', lineHeight: 20 },
  emptyCreateBtn: { marginTop: 24, borderRadius: 12, overflow: 'hidden' },
  emptyCreateBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 24, paddingVertical: 13 },
  emptyCreateText: { color: '#000', fontFamily: Typography.fontFamily.bold, fontSize: 14 },

  // Join Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: Colors.backgroundCard,
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 20, paddingTop: 12,
  },
  modalHandle: { width: 38, height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  modalTitle: { color: '#fff', fontFamily: Typography.fontFamily.bold, fontSize: 18 },
  modalSub: { color: Colors.textSecondary, fontFamily: Typography.fontFamily.regular, fontSize: 13, marginBottom: 16 },
  codeInputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.background, borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 14, height: 52, marginBottom: 14,
  },
  codeInput: { flex: 1, color: '#fff', fontFamily: Typography.fontFamily.bold, fontSize: 16, letterSpacing: 2 },
  joinSubmitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 52, borderRadius: 12 },
  joinSubmitText: { color: '#000', fontFamily: Typography.fontFamily.bold, fontSize: 15 },
});

export default TeamListScreen;
