import React, { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Image, Dimensions
} from 'react-native';
import Modal from 'react-native-modal';
import LinearGradient from '../../../components/SolidGradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useDispatch, useSelector } from 'react-redux';
import { fetchOwnerDashboard } from '../ownerSlice';
import { logout } from '../../auth/authSlice';
import { Colors, Typography, Spacing, BorderRadius } from '../../../theme/theme';
import SkeletonPlaceholder from 'react-native-skeleton-placeholder';
import { formatISTDate } from '../../../utils/dateFormatter';
import api, { getImageUrl } from '../../../api/axios';
import NotificationBell from '../../../components/NotificationBell';
import { showCustomAlert } from '../../../components/CustomAlert';

const { width: W } = Dimensions.get('window');

// ── Reusable small metric tile ───────────────────────────────────────────────
const MetricTile = ({ label, value, sub, accent, icon, onPress }) => {
  const containerStyle = [styles.tile, { borderTopColor: accent, borderTopWidth: 3 }];
  const innerContent = (
    <>
      <Icon name={icon} size={18} color={accent} style={{ marginBottom: 6 }} />
      <Text style={styles.tileVal}>{value}</Text>
      <Text style={styles.tileLbl}>{label}</Text>
      {sub && <Text style={styles.tileSub}>{sub}</Text>}
    </>
  );

  if (onPress) {
    return <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={containerStyle}>{innerContent}</TouchableOpacity>;
  }
  return <View style={containerStyle}>{innerContent}</View>;
};

// ── Status badge ─────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const map = {
    active:        { color: Colors.primary,  bg: Colors.primaryAlpha20,   label: 'Active' },
    pending:       { color: '#FF9800',        bg: 'rgba(255,152,0,0.15)',  label: 'Pending' },
    under_review:  { color: '#5B8DEF',        bg: 'rgba(91,141,239,0.15)', label: 'Under Review' },
    inactive:      { color: Colors.textTertiary, bg: Colors.surfaceVariant, label: 'Inactive' },
  };
  const s = map[status] || map.inactive;
  return (
    <View style={[styles.badge, { backgroundColor: s.bg }]}>
      <Text style={[styles.badgeTxt, { color: s.color }]}>{s.label}</Text>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
const OwnerDashboardScreen = ({ navigation }) => {
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();
  const [isSidebarVisible, setSidebarVisible] = useState(false);
  const { dashboard, isLoading } = useSelector((state) => state.owner);
  const { user } = useSelector((state) => state.auth);
  const [platformSettings, setPlatformSettings] = useState(null);

  useFocusEffect(
    useCallback(() => {
      dispatch(fetchOwnerDashboard());
      fetchPlatformSettings();
    }, [dispatch])
  );

  const fetchPlatformSettings = async () => {
    try {
      const res = await api.get('/admin/public-settings');
      if (res.data.data) setPlatformSettings(res.data.data);
    } catch {}
  };

  const onRefresh = () => {
    dispatch(fetchOwnerDashboard());
    fetchPlatformSettings();
  };

  // ── Skeleton ──────────────────────────────────────────────────────────────
  if (isLoading && !dashboard) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={[Colors.backgroundCard, Colors.background]} style={styles.headerGrad} />
        <SkeletonPlaceholder backgroundColor={Colors.backgroundElevated} highlightColor={Colors.surfaceVariant}>
          <View style={{ padding: Spacing.xl, gap: 16 }}>
            <View style={{ height: 80, borderRadius: 20 }} />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              {[1,2,3,4].map(i => <View key={i} style={{ flex: 1, height: 90, borderRadius: 16 }} />)}
            </View>
            <View style={{ height: 120, borderRadius: 20 }} />
            <View style={{ height: 120, borderRadius: 20 }} />
          </View>
        </SkeletonPlaceholder>
      </View>
    );
  }

  const s = dashboard?.stats || {};
  const turfs = dashboard?.owner?.turfs || [];
  const recentBookings = dashboard?.recentBookings || [];

  // Greeting based on time
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const handleLogout = () => {
    setSidebarVisible(false);
    setTimeout(() => {
      showCustomAlert(
        "Confirm Logout",
        "Are you sure you want to log out of your account?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Logout", onPress: () => dispatch(logout()), style: "destructive" }
        ]
      );
    }, 300); // slight delay to allow modal to close smoothly
  };

  return (
    <View style={styles.container}>
      {/* ── Hero Header ─────────────────────────────── */}
      <LinearGradient colors={[Colors.backgroundCard, Colors.background]} style={[styles.hero, { paddingTop: insets.top + 16, zIndex: 10 }]}>
        <View style={styles.heroTop}>
          <View style={styles.heroLeft}>
            <TouchableOpacity onPress={() => setSidebarVisible(true)} style={{ marginRight: 8 }}>
              <Icon name="menu" size={28} color={Colors.textPrimary} />
            </TouchableOpacity>
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={styles.heroName} numberOfLines={1} ellipsizeMode="tail">{user?.name?.split(' ')[0] || 'Owner'}</Text>
                {dashboard?.owner?.isVerifiedOwner && (
                  <Icon name="check-decagram" size={18} color={Colors.success} style={{ marginLeft: 6 }} />
                )}
              </View>
              {dashboard?.owner?.trustScore !== undefined && (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                  <Icon name="shield-check" size={14} color={dashboard.owner.trustScore >= 80 ? Colors.success : dashboard.owner.trustScore >= 50 ? Colors.warning : Colors.error} />
                  <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, marginLeft: 4 }}>
                    Trust Score: <Text style={{ fontWeight: 'bold', color: '#FFF' }}>{dashboard.owner.trustScore}/100</Text>
                  </Text>
                </View>
              )}
            </View>
          </View>
          <View style={styles.heroRight}>
            <NotificationBell onPress={() => navigation.navigate('Notifications')} />
            <TouchableOpacity onPress={() => navigation.navigate('Profile')} style={styles.avatarBtn}>
              <Icon name="store" size={20} color={Colors.primary} />
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >

        {/* ── Platform Banner ──────────────────────────── */}
        <View style={styles.bannerWrap}>
          <Image source={require('../../../../Banner.png')} style={styles.banner} resizeMode="cover" />
        </View>

        {/* ── Alert Banners ────────────────────────────── */}
        {dashboard?.kycStatus === 'pending' && (
          <TouchableOpacity style={styles.alertCard} onPress={() => navigation.navigate('KYCUpload')} activeOpacity={0.85}>
            <View style={[styles.alertIconBox, { backgroundColor: Colors.errorLight }]}>
              <Icon name="shield-alert" size={20} color={Colors.error} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.alertTitle, { color: Colors.error }]}>KYC Verification Required</Text>
              <Text style={styles.alertDesc}>Upload your documents to unlock payouts.</Text>
            </View>
            <Icon name="chevron-right" size={20} color={Colors.error} />
          </TouchableOpacity>
        )}

        {/* ── Today's Stats ────────────────────────────── */}
        <View style={styles.sectionRow}>
          <Icon name="calendar-today" size={16} color={Colors.primary} />
          <Text style={styles.sectionTitle}>Today's Overview</Text>
        </View>

        {/* Big Revenue Hero Card */}
        <LinearGradient colors={['#111', '#050505']} style={styles.revenueHero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <View style={styles.revenueHeroLeft}>
            <Text style={styles.revenueLabel}>Revenue from Today's Games</Text>
            <Text style={styles.revenueAmount}>₹{(s.todayTotalRevenue || 0).toLocaleString()}</Text>
            <View style={styles.revenueSplit}>
              <View style={styles.revenueSplitItem}>
                <View style={[styles.splitDot, { backgroundColor: Colors.primary }]} />
                <Text style={styles.splitLbl}>Online</Text>
                <Text style={styles.splitVal}>₹{(s.todayOnlineRevenue || 0).toLocaleString()}</Text>
              </View>
              <View style={styles.revenueSplitDivider} />
              <View style={styles.revenueSplitItem}>
                <View style={[styles.splitDot, { backgroundColor: '#FF9800' }]} />
                <Text style={styles.splitLbl}>Offline</Text>
                <Text style={styles.splitVal}>₹{(s.todayOfflineRevenue || 0).toLocaleString()}</Text>
              </View>
            </View>
          </View>
          <View style={styles.revenueHeroRight}>
            <View style={styles.revenueBigIcon}>
              <Icon name="currency-inr" size={32} color={Colors.primary} />
            </View>
          </View>
        </LinearGradient>

        {/* Big Collected Revenue Hero Card */}
        <LinearGradient colors={['#111', '#050505']} style={[styles.revenueHero, { marginTop: 12 }]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <View style={styles.revenueHeroLeft}>
            <Text style={styles.revenueLabel}>Cash Inflow Today</Text>
            <Text style={styles.revenueAmount}>₹{(s.todayTotalCollectedRevenue || 0).toLocaleString()}</Text>
            <View style={styles.revenueSplit}>
              <View style={styles.revenueSplitItem}>
                <View style={[styles.splitDot, { backgroundColor: Colors.primary }]} />
                <Text style={styles.splitLbl}>Online</Text>
                <Text style={styles.splitVal}>₹{(s.todayCollectedOnlineRevenue || 0).toLocaleString()}</Text>
              </View>
              <View style={styles.revenueSplitDivider} />
              <View style={styles.revenueSplitItem}>
                <View style={[styles.splitDot, { backgroundColor: '#FF9800' }]} />
                <Text style={styles.splitLbl}>Offline</Text>
                <Text style={styles.splitVal}>₹{(s.todayCollectedOfflineRevenue || 0).toLocaleString()}</Text>
              </View>
            </View>
          </View>
          <View style={styles.revenueHeroRight}>
            <View style={[styles.revenueBigIcon, { backgroundColor: Colors.primaryAlpha10 }]}>
              <Icon name="cash-fast" size={32} color={Colors.primary} />
            </View>
          </View>
        </LinearGradient>

        {/* 3 mini tiles - bookings */}
        <View style={styles.tilesRow}>
          <MetricTile
            icon="calendar-check"
            label="Bookings"
            value={s.todayTotalBookings || 0}
            sub={`${s.todayOnlineBookings || 0} online · ${s.todayOfflineBookings || 0} offline`}
            accent={Colors.primary}
          />
          <MetricTile
            icon="map-marker-multiple"
            label="Turfs"
            value={s.activeTurfs || 0}
            sub="managed"
            accent={Colors.primary}
          />
          <MetricTile
            icon="wallet"
            label="Wallet Balance"
            value={`₹${(dashboard?.wallet?.balance || 0).toLocaleString()}`}
            sub="Available to withdraw"
            accent={Colors.primary}
            onPress={() => navigation.navigate('Wallet')}
          />
        </View>

        {/* ── Monthly Stats ────────────────────────────── */}
        <View style={styles.sectionRow}>
          <Icon name="calendar-month" size={16} color={Colors.primary} />
          <Text style={styles.sectionTitle}>This Month</Text>
        </View>

        <View style={styles.monthGrid}>
          <View style={styles.monthCard}>
            <View style={styles.monthCardTop}>
              <View style={[styles.monthIconBg, { backgroundColor: Colors.primaryAlpha20 }]}>
                <Icon name="currency-inr" size={20} color={Colors.primary} />
              </View>
              <Text style={styles.monthVal}>₹{(s.monthTotalRevenue || 0).toLocaleString()}</Text>
            </View>
            <Text style={styles.monthLbl}>Monthly Revenue</Text>
            <View style={styles.monthSplit}>
              <Text style={[styles.monthSplitTxt, { color: Colors.primary }]}>
                ↑ ₹{(s.monthOnlineRevenue || 0).toLocaleString()} online
              </Text>
              <Text style={[styles.monthSplitTxt, { color: '#FF9800' }]}>
                + ₹{(s.monthOfflineRevenue || 0).toLocaleString()} offline
              </Text>
            </View>
          </View>

          <View style={styles.monthCard}>
            <View style={styles.monthCardTop}>
              <View style={[styles.monthIconBg, { backgroundColor: Colors.primaryAlpha10 }]}>
                <Icon name="ticket-confirmation" size={20} color={Colors.primary} />
              </View>
              <Text style={styles.monthVal}>{s.monthTotalBookings || 0}</Text>
            </View>
            <Text style={styles.monthLbl}>Monthly Bookings</Text>
            <View style={styles.monthSplit}>
              <Text style={[styles.monthSplitTxt, { color: Colors.primary }]}>
                {s.monthOnlineBookings || 0} online
              </Text>
              <Text style={[styles.monthSplitTxt, { color: '#FF9800' }]}>
                {s.monthOfflineBookings || 0} offline
              </Text>
            </View>
          </View>
        </View>

        {/* ── Quick Actions ────────────────────────────── */}
        <View style={styles.sectionRow}>
          <Icon name="lightning-bolt" size={16} color="#FFD600" />
          <Text style={styles.sectionTitle}>Quick Actions</Text>
        </View>

        <View style={styles.actionsRow}>
          {[
            { icon: 'plus-box-multiple', label: 'Add Turf',       color: Colors.primary, bg: Colors.primaryAlpha20, route: 'TurfRegistration' },
            { icon: 'clock-edit-outline', label: 'Manage Slots',  color: Colors.primary, bg: Colors.primaryAlpha20, route: 'SlotManager' },
            { icon: 'account-group',     label: 'Customers',      color: Colors.primary, bg: Colors.primaryAlpha20, route: 'OwnerCustomers' },
            { icon: 'wallet',            label: 'My Wallet',      color: Colors.primary, bg: Colors.primaryAlpha20, route: 'Wallet' },
            { icon: 'star-circle',       label: 'Reviews',        color: Colors.primary, bg: Colors.primaryAlpha20, route: 'OwnerReviews' },
          ].map(({ icon, label, color, bg, route }) => (
            <TouchableOpacity key={route} style={styles.actionBtn} onPress={() => navigation.navigate(route)} activeOpacity={0.75}>
              <View style={[styles.actionIconBg, { backgroundColor: bg }]}>
                <Icon name={icon} size={22} color={color} />
              </View>
              <Text style={styles.actionLbl} numberOfLines={1}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── My Turfs ─────────────────────────────────── */}
        <View style={[styles.sectionRow, { marginTop: 20 }]}>
          <Icon name="map-marker" size={16} color={Colors.primary} />
          <Text style={styles.sectionTitle}>My Turfs</Text>
          <View style={{ flex: 1 }} />
          <TouchableOpacity onPress={() => navigation.navigate('TurfList')}>
            <Text style={styles.seeAll}>See All</Text>
          </TouchableOpacity>
        </View>

        {turfs.length === 0 ? (
          <View style={styles.emptyCard}>
            <Icon name="map-marker-off" size={32} color={Colors.textTertiary} />
            <Text style={styles.emptyTxt}>No turfs added yet</Text>
            <TouchableOpacity style={styles.addTurfBtn} onPress={() => navigation.navigate('TurfRegistration')}>
              <Text style={styles.addTurfTxt}>+ Add Your First Turf</Text>
            </TouchableOpacity>
          </View>
        ) : (
          turfs.slice(0, 3).map((turf) => (
            <TouchableOpacity
              key={turf._id}
              style={styles.turfCard}
              onPress={() => navigation.navigate('TurfRegistration', { editTurf: turf })}
              activeOpacity={0.8}
            >
              <View style={[styles.turfAccent, { backgroundColor: turf.status === 'active' ? Colors.primary : '#FF9800' }]} />
              <View style={styles.turfBody}>
                <View style={styles.turfRow}>
                  <Text style={styles.turfName} numberOfLines={1}>{turf.name}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 8, backgroundColor: '#FFF9E6', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 }}>
                    <Icon name="star" size={14} color="#FFC107" />
                    <Text style={{ fontSize: 12, fontWeight: 'bold', marginLeft: 4, color: '#333' }}>
                      {turf.rating > 0 ? turf.rating.toFixed(1) : 'New'}
                    </Text>
                  </View>
                  <StatusBadge status={turf.status} />
                </View>
                <Text style={styles.turfMeta}>
                  <Icon name="map-marker-outline" size={12} color={Colors.textTertiary} /> {turf.city}
                  {'  '}
                  <Icon name="tag-outline" size={12} color={Colors.textTertiary} /> {turf.type}
                  {turf.pendingActionsCount > 0 && (
                    <Text style={{ color: Colors.warning }}>{'  '}⚠ {turf.pendingActionsCount} action{turf.pendingActionsCount > 1 ? 's' : ''}</Text>
                  )}
                </Text>
              </View>
              <Icon name="chevron-right" size={18} color={Colors.textTertiary} />
            </TouchableOpacity>
          ))
        )}

        {/* ── Recent Bookings ──────────────────────────── */}
        {/* <View style={[styles.sectionRow, { marginTop: Spacing.sm }]}>
          <Icon name="history" size={16} color={Colors.primary} />
          <Text style={styles.sectionTitle}>Recent Bookings</Text>
          <View style={{ flex: 1 }} />
          <TouchableOpacity onPress={() => navigation.navigate('Bookings')}>
            <Text style={styles.seeAll}>See All</Text>
          </TouchableOpacity>
        </View> */}

        {/* {recentBookings.length === 0 ? (
          <View style={styles.emptyCard}>
            <Icon name="calendar-blank" size={32} color={Colors.textTertiary} />
            <Text style={styles.emptyTxt}>No recent bookings</Text>
          </View>
        ) : (
          recentBookings.map((b) => {
            const statusColor = b.status === 'confirmed' ? Colors.primary : b.status === 'completed' ? '#2ED573' : '#FF9800';
            return (
              <View key={b._id} style={styles.bookingCard}>
                <View style={[styles.bookingAvatar, { backgroundColor: statusColor + '22' }]}>
                  <Text style={[styles.bookingAvatarTxt, { color: statusColor }]}>
                    {(b.user?.name || 'C').charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.bookingUser}>{b.user?.name || 'Customer'}</Text>
                  <Text style={styles.bookingMeta}>{b.turf?.name}  ·  {formatISTDate(b.date)}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.bookingAmt}>₹{b.totalAmount}</Text>
                  <View style={[styles.badge, { backgroundColor: statusColor + '22', marginTop: 4 }]}>
                    <Text style={[styles.badgeTxt, { color: statusColor }]}>{b.status?.toUpperCase()}</Text>
                  </View>
                </View>
              </View>
            );
          })
        )} */}

        <View style={{ height: Spacing['2xl'] }} />
      </ScrollView>

      {/* ── Sidebar Modal ────────────────────────────────────── */}
      <Modal
        isVisible={isSidebarVisible}
        onBackdropPress={() => setSidebarVisible(false)}
        onSwipeComplete={() => setSidebarVisible(false)}
        swipeDirection="left"
        animationIn="slideInLeft"
        animationOut="slideOutLeft"
        style={{ margin: 0, justifyContent: 'flex-start' }}
      >
        <View style={[styles.sidebar, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.sidebarHeader}>
            <Image source={require('../../../../SportVerse.png')} style={styles.sidebarLogo} resizeMode="contain" />
            <TouchableOpacity onPress={() => setSidebarVisible(false)}>
              <Icon name="close" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.sidebarContent}>
            <Text style={styles.sidebarSectionTitle}>Quick Actions</Text>
            
            <TouchableOpacity style={styles.sidebarItem} onPress={() => { setSidebarVisible(false); navigation.navigate('TurfRegistration'); }}>
              <View style={[styles.sidebarIconBox, { backgroundColor: Colors.primaryAlpha10 }]}>
                <Icon name="plus-box" size={20} color={Colors.primary} />
              </View>
              <Text style={styles.sidebarItemText}>Add Turf</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.sidebarItem} onPress={() => { setSidebarVisible(false); navigation.navigate('SlotManager'); }}>
              <View style={[styles.sidebarIconBox, { backgroundColor: Colors.primaryAlpha10 }]}>
                <Icon name="clock-edit-outline" size={20} color={Colors.primary} />
              </View>
              <Text style={styles.sidebarItemText}>Manage Slots</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.sidebarItem} onPress={() => { setSidebarVisible(false); navigation.navigate('OwnerCustomers'); }}>
              <View style={[styles.sidebarIconBox, { backgroundColor: Colors.primaryAlpha10 }]}>
                <Icon name="account-group" size={20} color={Colors.primary} />
              </View>
              <Text style={styles.sidebarItemText}>Customers</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.sidebarItem} onPress={() => { setSidebarVisible(false); navigation.navigate('Wallet'); }}>
              <View style={[styles.sidebarIconBox, { backgroundColor: Colors.primaryAlpha10 }]}>
                <Icon name="wallet" size={20} color={Colors.primary} />
              </View>
              <Text style={styles.sidebarItemText}>My Wallet</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.sidebarItem} onPress={() => { setSidebarVisible(false); navigation.navigate('OwnerReviews'); }}>
              <View style={[styles.sidebarIconBox, { backgroundColor: Colors.primaryAlpha10 }]}>
                <Icon name="star-circle" size={20} color={Colors.primary} />
              </View>
              <Text style={styles.sidebarItemText}>Reviews</Text>
            </TouchableOpacity>

          </ScrollView>

          <View style={{ paddingHorizontal: Spacing.xl, marginTop: 'auto', paddingBottom: 20 }}>
            <TouchableOpacity style={styles.sidebarItem} onPress={handleLogout}>
              <View style={[styles.sidebarIconBox, { backgroundColor: '#d6303122' }]}>
                <Icon name="logout" size={20} color="#d63031" />
              </View>
              <Text style={[styles.sidebarItemText, { color: '#d63031' }]}>Logout</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { paddingBottom: 100 },

  // Hero
  hero: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xl },
  heroGrad: { height: 120 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  heroRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logo: { width: 36, height: 36 },
  heroGreet: { fontSize: Typography.fontSize.sm, fontFamily: Typography.fontFamily.regular, color: Colors.textSecondary },
  heroName: { fontSize: Typography.fontSize['2xl'], fontFamily: Typography.fontFamily.extraBold, color: Colors.textPrimary },
  avatarBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primaryAlpha10, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.primaryAlpha30 },

  // Banner
  bannerWrap: { marginTop: 16, marginHorizontal: Spacing.xl, marginBottom: Spacing.lg, borderRadius: BorderRadius.xl, overflow: 'hidden', borderWidth: 1, borderColor: Colors.border },
  banner: { width: '100%', height: 130 },

  // Alerts
  alertCard: {
    marginHorizontal: Spacing.xl, marginBottom: 10,
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.lg, padding: Spacing.md,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1, borderColor: Colors.border,
  },
  alertIconBox: { width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  alertTitle: { fontSize: Typography.fontSize.sm, fontFamily: Typography.fontFamily.bold },
  alertDesc: { fontSize: Typography.fontSize.xs, fontFamily: Typography.fontFamily.regular, color: Colors.textTertiary, marginTop: 2 },

  // Section header
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: Spacing.xl, marginBottom: Spacing.md, marginTop: Spacing.xl },
  sectionTitle: { fontSize: Typography.fontSize.md, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary },
  seeAll: { fontSize: Typography.fontSize.sm, fontFamily: Typography.fontFamily.medium, color: Colors.primary },

  // Revenue hero card
  revenueHero: {
    marginHorizontal: Spacing.xl, borderRadius: BorderRadius.xl,
    padding: Spacing.xl, flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: Colors.primaryAlpha30,
  },
  revenueHeroLeft: { flex: 1 },
  revenueHeroRight: {},
  revenueLabel: { fontSize: Typography.fontSize.sm, fontFamily: Typography.fontFamily.medium, color: 'rgba(255,255,255,0.6)', marginBottom: 4 },
  revenueAmount: { fontSize: 36, fontFamily: Typography.fontFamily.extraBold, color: '#fff', marginBottom: Spacing.md },
  revenueSplit: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  revenueSplitItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  revenueSplitDivider: { width: 1, height: 20, backgroundColor: 'rgba(255,255,255,0.15)' },
  splitDot: { width: 8, height: 8, borderRadius: 4 },
  splitLbl: { fontSize: Typography.fontSize.xs, color: 'rgba(255,255,255,0.55)', fontFamily: Typography.fontFamily.regular },
  splitVal: { fontSize: Typography.fontSize.sm, color: '#fff', fontFamily: Typography.fontFamily.bold },
  revenueBigIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(154,188,47,0.2)', justifyContent: 'center', alignItems: 'center' },

  // Mini metric tiles
  tilesRow: { flexDirection: 'row', paddingHorizontal: Spacing.xl, gap: 10, marginTop: Spacing.md },
  tile: {
    flex: 1, backgroundColor: Colors.backgroundCard, borderRadius: BorderRadius.lg,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.border,
  },
  tileVal: { fontSize: Typography.fontSize.xl, fontFamily: Typography.fontFamily.extraBold, color: Colors.textPrimary },
  tileLbl: { fontSize: 10, fontFamily: Typography.fontFamily.medium, color: Colors.textSecondary, marginTop: 2 },
  tileSub: { fontSize: 9, fontFamily: Typography.fontFamily.regular, color: Colors.textTertiary, marginTop: 2 },

  // Monthly grid
  monthGrid: { flexDirection: 'row', paddingHorizontal: Spacing.xl, gap: 12 },
  monthCard: {
    flex: 1, backgroundColor: Colors.backgroundCard, borderRadius: BorderRadius.xl,
    padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border,
  },
  monthCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  monthIconBg: { width: 34, height: 34, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
  monthVal: { fontSize: Typography.fontSize.xl, fontFamily: Typography.fontFamily.extraBold, color: Colors.textPrimary },
  monthLbl: { fontSize: Typography.fontSize.xs, fontFamily: Typography.fontFamily.medium, color: Colors.textSecondary, marginBottom: 6 },
  monthSplit: { gap: 3 },
  monthSplitTxt: { fontSize: 10, fontFamily: Typography.fontFamily.medium },

  // Quick actions
  actionsRow: { flexDirection: 'row', paddingHorizontal: Spacing.xl, gap: 10 },
  actionBtn: { flex: 1, alignItems: 'center', gap: 8 },
  actionIconBg: { width: 52, height: 52, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  actionLbl: { fontSize: 10, fontFamily: Typography.fontFamily.medium, color: Colors.textSecondary, textAlign: 'center' },

  // Turf cards
  turfCard: {
    marginHorizontal: Spacing.xl, marginBottom: 10,
    backgroundColor: Colors.backgroundCard, borderRadius: BorderRadius.lg,
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border, overflow: 'hidden',
  },
  turfAccent: { width: 4, alignSelf: 'stretch' },
  turfBody: { flex: 1, padding: Spacing.md },
  turfRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  turfName: { fontSize: Typography.fontSize.md, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary, flex: 1, marginRight: 8 },
  turfMeta: { fontSize: Typography.fontSize.xs, fontFamily: Typography.fontFamily.regular, color: Colors.textTertiary },

  // Badge
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  badgeTxt: { fontSize: 10, fontFamily: Typography.fontFamily.bold },

  // Booking cards
  bookingCard: {
    marginHorizontal: Spacing.xl, marginBottom: 10,
    backgroundColor: Colors.backgroundCard, borderRadius: BorderRadius.lg,
    padding: Spacing.md, flexDirection: 'row', alignItems: 'center',
    gap: 12, borderWidth: 1, borderColor: Colors.border,
  },
  bookingAvatar: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center' },
  bookingAvatarTxt: { fontSize: Typography.fontSize.lg, fontFamily: Typography.fontFamily.extraBold },
  bookingUser: { fontSize: Typography.fontSize.sm, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary },
  bookingMeta: { fontSize: Typography.fontSize.xs, fontFamily: Typography.fontFamily.regular, color: Colors.textTertiary, marginTop: 2 },
  bookingAmt: { fontSize: Typography.fontSize.md, fontFamily: Typography.fontFamily.extraBold, color: Colors.textPrimary },

  // Empty
  emptyCard: { marginHorizontal: Spacing.xl, backgroundColor: Colors.backgroundCard, borderRadius: BorderRadius.xl, padding: Spacing['2xl'], alignItems: 'center', gap: 8, borderWidth: 1, borderColor: Colors.border },
  emptyTxt: { fontSize: Typography.fontSize.sm, fontFamily: Typography.fontFamily.medium, color: Colors.textSecondary },
  addTurfBtn: { marginTop: 8, backgroundColor: Colors.primaryAlpha20, paddingHorizontal: 20, paddingVertical: 10, borderRadius: BorderRadius.full, borderWidth: 1, borderColor: Colors.primaryAlpha30 },
  addTurfTxt: { color: Colors.primary, fontFamily: Typography.fontFamily.bold, fontSize: Typography.fontSize.sm },

  // Sidebar
  sidebar: { width: 280, backgroundColor: Colors.backgroundCard, flex: 1, borderTopRightRadius: 24, borderBottomRightRadius: 24, elevation: 10, shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 20 },
  sidebarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.xl, marginBottom: Spacing.xl },
  sidebarLogo: { width: 80, height: 80 },
  sidebarContent: { paddingHorizontal: Spacing.xl },
  sidebarSectionTitle: { fontSize: Typography.fontSize.sm, fontFamily: Typography.fontFamily.bold, color: Colors.textSecondary, marginBottom: Spacing.md, textTransform: 'uppercase', letterSpacing: 1 },
  sidebarItem: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  sidebarIconBox: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  sidebarItemText: { fontSize: Typography.fontSize.md, fontFamily: Typography.fontFamily.medium, color: Colors.textPrimary },
});

export default OwnerDashboardScreen;
