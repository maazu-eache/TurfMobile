import React, { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Image, Dimensions, ImageBackground,
} from 'react-native';
import Modal from 'react-native-modal';
import NativeLinearGradient from 'react-native-linear-gradient';
import LinearGradient from '../../../components/SolidGradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useDispatch, useSelector } from 'react-redux';
import { fetchOwnerDashboard } from '../ownerSlice';
import { logout } from '../../auth/authSlice';
import { Colors, Typography, Spacing, BorderRadius } from '../../../theme/theme';
import SkeletonPlaceholder from 'react-native-skeleton-placeholder';
import api from '../../../api/axios';
import { getImageUrl } from '../../../api/axios';
import NotificationBell from '../../../components/NotificationBell';
import { showCustomAlert } from '../../../components/CustomAlert';
import AppUpdateBanner from '../../../components/common/AppUpdateBanner';
import SharePreviewModal from '../../tournament/components/SharePreviewModal';
import { TurfPoster } from '../../tournament/components/PosterTemplates';

const { width: W } = Dimensions.get('window');

// ─── Helpers ──────────────────────────────────────────────────────────────────
const TURF_STATUS = {
  active:       { color: Colors.primary,  bg: Colors.primaryAlpha10, label: 'Active' },
  pending:      { color: Colors.warning,  bg: Colors.warningLight,  label: 'Pending' },
  under_review: { color: Colors.info,     bg: Colors.infoLight,     label: 'Review' },
  inactive:     { color: Colors.textTertiary, bg: Colors.surfaceVariant, label: 'Inactive' },
};

const StatusPill = ({ status }) => {
  const s = TURF_STATUS[status] || TURF_STATUS.inactive;
  return (
    <View style={[styles.statusPill, { backgroundColor: s.bg, borderColor: s.color + '55' }]}>
      <View style={[styles.statusDot, { backgroundColor: s.color }]} />
      <Text style={[styles.statusTxt, { color: s.color }]}>{s.label}</Text>
    </View>
  );
};

const SectionHeader = ({ icon, title, right }) => (
  <View style={styles.secRow}>
    <View style={styles.secIconWrap}>
      <Icon name={icon} size={14} color={Colors.primary} />
    </View>
    <Text style={styles.secTitle}>{title}</Text>
    {right && <View style={{ marginLeft: 'auto' }}>{right}</View>}
  </View>
);

const InfoRow = ({ iconName, iconBg, iconColor, label, value, sub, badge, onPress }) => (
  <TouchableOpacity style={styles.infoRow} onPress={onPress} activeOpacity={0.8}>
    <View style={[styles.infoIconBox, { backgroundColor: iconBg }]}>
      <Icon name={iconName} size={22} color={iconColor} />
    </View>
    <View style={styles.infoText}>
      <Text style={styles.infoLabel}>{label}</Text>
      {value && <Text style={styles.infoValue}>{value}</Text>}
      {badge}
      {sub && <Text style={styles.infoSub}>{sub}</Text>}
    </View>
    <Icon name="chevron-right" size={18} color={Colors.textTertiary} />
  </TouchableOpacity>
);

const StarRow = () => (
  <View style={{ flexDirection: 'row', gap: 2, marginVertical: 3 }}>
    {[1,2,3,4,5].map(i => <Icon key={i} name="star" size={13} color={Colors.primary} />)}
  </View>
);

// ─────────────────────────────────────────────────────────────────────────────
const OwnerDashboardScreen = ({ navigation }) => {
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();
  const [isSidebarVisible, setSidebarVisible] = useState(false);
  const { dashboard, isLoading } = useSelector((s) => s.owner);
  const { user } = useSelector((s) => s.auth);
  const [revenueTab, setRevenueTab] = useState('revenue');
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [selectedShareTurf, setSelectedShareTurf] = useState(null);

  useFocusEffect(
    useCallback(() => {
      dispatch(fetchOwnerDashboard());
    }, [dispatch])
  );

  const onRefresh = () => dispatch(fetchOwnerDashboard());

  
  const handleDeleteAccount = () => {
    setSidebarVisible(false);
    setTimeout(() => {
      showCustomAlert(
        "Delete Account",
        "⚠️ WARNING: THIS ACTION CANNOT BE RESTORED OR UNDONE!\n\nAre you absolutely sure you want to delete your account? All your turfs, slots, and transaction history will be permanently erased. You cannot delete your account if you have upcoming bookings.",
        [
          { text: "Cancel", style: "cancel" },
          { 
            text: "Delete My Account", 
            style: "destructive",
            onPress: async () => {
              try {
                await api.delete('/users/delete-account');
                showCustomAlert(
                  "Account Deleted", 
                  "Your account has been permanently deleted.", 
                  [{ text: "OK", onPress: () => dispatch(logout()) }]
                );
              } catch (err) {
                showCustomAlert("Error", err.response?.data?.message || "Failed to delete account");
              }
            }
          }
        ]
      );
    }, 300);
  };

  const handleLogout = () => {
    setSidebarVisible(false);
    setTimeout(() => {
      showCustomAlert('Confirm Logout', 'Are you sure you want to log out?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', onPress: () => dispatch(logout()), style: 'destructive' },
      ]);
    }, 300);
  };

  // ── Skeleton ──────────────────────────────────────────────────────────────
  if (isLoading && !dashboard) {
    return (
      <View style={styles.root}>
        <SkeletonPlaceholder backgroundColor="#111" highlightColor="#1c1c1c">
          <View style={{ padding: 20, gap: 14 }}>
            <View style={{ height: 90, borderRadius: 20 }} />
            <View style={{ height: 150, borderRadius: 20 }} />
            <View style={{ height: 160, borderRadius: 20 }} />
            <View style={{ height: 80, borderRadius: 20 }} />
            <View style={{ height: 80, borderRadius: 20 }} />
          </View>
        </SkeletonPlaceholder>
      </View>
    );
  }

  const s = dashboard?.stats || {};
  const turfs = dashboard?.owner?.turfs || [];

  const isRevenue = revenueTab === 'revenue';
  const totalAmount = isRevenue ? (s.todayTotalRevenue || 0) : (s.todayTotalCollectedRevenue || 0);
  const onlineAmt = isRevenue ? (s.todayOnlineRevenue || 0) : (s.todayCollectedOnlineRevenue || 0);
  const offlineAmt = isRevenue ? (s.todayOfflineRevenue || 0) : (s.todayCollectedOfflineRevenue || 0);

  return (
    <View style={styles.root}>

      {/* ══ HEADER ══ */}
      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => setSidebarVisible(true)} style={styles.menuBtn}>
            <Icon name="menu" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.headerName} numberOfLines={1}>{user?.name?.split(' ')[0] || 'Owner'}</Text>
              {dashboard?.owner?.isVerifiedOwner && (
                <Icon name="check-decagram" size={16} color={Colors.success} />
              )}
            </View>
            {dashboard?.owner?.trustScore !== undefined && (
              <View style={styles.trustRow}>
                <Icon
                  name="shield-check" size={12}
                  color={
                    dashboard.owner.trustScore >= 80 ? Colors.success
                    : dashboard.owner.trustScore >= 50 ? Colors.warning
                    : Colors.error
                  }
                />
                <Text style={styles.trustTxt}>
                  Trust Score: <Text style={styles.trustVal}>{dashboard.owner.trustScore}/100</Text>
                </Text>
              </View>
            )}
          </View>
        </View>
        <View style={styles.headerRight}>
          <NotificationBell onPress={() => navigation.navigate('Notifications')} />
          <TouchableOpacity style={styles.avatarBtn} onPress={() => navigation.navigate('Profile')}>
            <Icon name="store" size={19} color={Colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >

        <AppUpdateBanner />

        {/* KYC alert */}
        {dashboard?.kycStatus === 'pending' && (
          <TouchableOpacity style={styles.kycAlert} onPress={() => navigation.navigate('KYCUpload')}>
            <View style={styles.kycIconBox}><Icon name="shield-alert" size={18} color={Colors.error} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.kycTitle}>KYC Verification Required</Text>
              <Text style={styles.kycDesc}>Upload documents to unlock payouts</Text>
            </View>
            <Icon name="chevron-right" size={18} color={Colors.error} />
          </TouchableOpacity>
        )}

        {/* ══ SECTION 1 — MY TURFS ══ */}
        <SectionHeader
          icon="map-marker"
          title="My Turfs"
          right={
            <TouchableOpacity onPress={() => navigation.navigate('TurfList')}>
              <Text style={styles.seeAll}>See All</Text>
            </TouchableOpacity>
          }
        />

        {turfs.length === 0 ? (
          <TouchableOpacity
            style={styles.emptyCard}
            onPress={() => navigation.navigate('TurfRegistration')}
            activeOpacity={0.85}
          >
            <View style={styles.emptyIconWrap}>
              <Icon name="map-marker-plus-outline" size={32} color={Colors.primary} />
            </View>
            <View style={styles.emptyTextWrap}>
              <Text style={styles.emptyTitle}>Register Your First Turf</Text>
              <Text style={styles.emptyDesc}>List your turf and start receiving online &amp; offline bookings</Text>
            </View>
            <View style={styles.emptyArrow}>
              <Icon name="arrow-right" size={18} color={Colors.primary} />
            </View>
          </TouchableOpacity>
        ) : (
          <>
            {turfs.slice(0, 3).map((turf) => {
              const coverImg = turf.coverImage
                ? { uri: getImageUrl(turf.coverImage) }
                : null;
              const statusColor = TURF_STATUS[turf.status]?.color || Colors.textTertiary;
              return (
                <TouchableOpacity
                  key={turf._id}
                  style={styles.turfCard}
                  onPress={() => navigation.navigate('TurfRegistration', { editTurf: turf })}
                  activeOpacity={0.88}
                >
                  {/* Left — image thumbnail */}
                  <View style={styles.turfThumbWrap}>
                    {coverImg ? (
                      <Image source={coverImg} style={styles.turfThumb} />
                    ) : (
                      <View style={styles.turfThumbPlaceholder}>
                        <Icon name="image-off-outline" size={26} color="rgba(255,255,255,0.2)" />
                      </View>
                    )}
                    {/* Right-edge fade */}
                    <NativeLinearGradient
                      colors={['transparent', Colors.backgroundCard]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.turfThumbFade}
                    />
                    {/* Status dot on thumbnail */}
                    <View style={[styles.turfThumbStatus, { backgroundColor: statusColor }]} />
                  </View>

                  {/* Right — content */}
                  <View style={styles.turfContent}>
                    {/* Top row: name + status pill */}
                    <View style={styles.turfContentTopRow}>
                      <Text
                        style={styles.turfContentName}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {turf.name}
                      </Text>
                      <View style={[styles.turfStatusPill, { backgroundColor: statusColor + '22', borderColor: statusColor + '55' }]}>
                        <View style={[styles.turfStatusDot, { backgroundColor: statusColor }]} />
                        <Text style={[styles.turfStatusTxt, { color: statusColor }]} numberOfLines={1}>{TURF_STATUS[turf.status]?.label || 'Inactive'}</Text>
                      </View>
                    </View>

                    {/* Meta row */}
                    <View style={styles.turfContentMeta}>
                      <Icon name="map-marker" size={11} color={Colors.textTertiary} />
                      <Text style={styles.turfContentMetaTxt}>{turf.city}</Text>
                      {turf.type ? (
                        <>
                          <View style={styles.turfContentDot} />
                          <Text style={styles.turfContentMetaTxt}>{turf.type}</Text>
                        </>
                      ) : null}
                      {turf.size ? (
                        <>
                          <View style={styles.turfContentDot} />
                          <Icon name="resize" size={11} color={Colors.textTertiary} />
                          <Text style={styles.turfContentMetaTxt}>{turf.size}</Text>
                        </>
                      ) : null}
                    </View>

                    {/* Rating + pending */}
                    <View style={styles.turfContentRatingRow}>
                      <Icon name="star" size={11} color={Colors.primary} />
                      <Text style={styles.turfContentRatingTxt}>
                        {turf.rating > 0 ? turf.rating.toFixed(1) : 'New'}
                      </Text>
                      {turf.pendingActionsCount > 0 && (
                        <View style={styles.turfPendingBadge}>
                          <Icon name="alert" size={9} color={Colors.warning} />
                          <Text style={styles.turfPendingTxt}>{turf.pendingActionsCount} pending</Text>
                        </View>
                      )}
                    </View>

                    {/* Action buttons */}
                    <View style={styles.turfActionRow}>
                      <TouchableOpacity
                        style={styles.turfActionBtn}
                        onPress={() => navigation.navigate('SlotManager', { turfId: turf._id })}
                        activeOpacity={0.8}
                      >
                        <Icon name="clock-edit-outline" size={13} color="#000000" />
                        <Text style={styles.turfActionBtnTxt}>Slots</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.turfActionBtnOutline}
                        onPress={() => {
                          setSelectedShareTurf(turf);
                          setShareModalVisible(true);
                        }}
                        activeOpacity={0.8}
                      >
                        <Icon name="share-variant" size={13} color={Colors.primary} />
                        <Text style={styles.turfActionBtnOutlineTxt}>Share</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.turfActionBtnIcon}
                        onPress={() => navigation.navigate('TurfRegistration', { editTurf: turf })}
                        activeOpacity={0.8}
                      >
                        <Icon name="pencil" size={13} color="rgba(255,255,255,0.6)" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}

            {/* Add another turf — solid professional button */}
            <TouchableOpacity
              style={styles.addTurfBtn}
              onPress={() => navigation.navigate('TurfRegistration')}
              activeOpacity={0.8}
            >
              <Icon name="plus" size={18} color={Colors.primary} />
              <Text style={styles.addTurfBtnTxt}>Add Another Turf</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ══ SECTION 2 — REVENUE & INCOME ══ */}
        <SectionHeader icon="chart-bar" title="Revenue & Income" />

        <View style={styles.revenueCard}>
          <View style={styles.revTabBar}>
            {[
              { key: 'revenue', label: 'Game Revenue', icon: 'currency-inr' },
              { key: 'income',  label: 'Cash Inflow',  icon: 'cash-fast' },
            ].map((tab) => {
              const active = revenueTab === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  style={[styles.revTab, active && styles.revTabActive]}
                  onPress={() => setRevenueTab(tab.key)}
                  activeOpacity={0.75}
                >
                  <Icon name={tab.icon} size={13} color={active ? Colors.primary : Colors.textTertiary} />
                  <Text style={[styles.revTabTxt, active && styles.revTabTxtActive]}>{tab.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.revAmountWrap}>
            <Text style={styles.revLabel}>{isRevenue ? "TODAY'S GAME REVENUE" : 'CASH COLLECTED TODAY'}</Text>
            <Text style={styles.revAmount}>&#8377;{totalAmount.toLocaleString()}</Text>
          </View>

          <View style={styles.revDivider} />

          <View style={styles.revChipsRow}>
            {[
              { label: 'ONLINE',   value: `\u20b9${onlineAmt.toLocaleString()}`,  color: Colors.primary },
              { label: 'OFFLINE',  value: `\u20b9${offlineAmt.toLocaleString()}`, color: '#FF9800' },
              { label: 'BOOKINGS',    value: `${s.todayTotalBookings || 0} (${s.todayTotalSlots || 0} Slots)`,      color: '#5B8DEF' },
            ].map((chip, i) => (
              <React.Fragment key={chip.label}>
                {i > 0 && <View style={styles.revChipSep} />}
                <View style={styles.revChip}>
                  <View style={[styles.revChipDot, { backgroundColor: chip.color }]} />
                  <View>
                    <Text style={styles.revChipLabel}>{chip.label}</Text>
                    <Text style={styles.revChipVal}>{chip.value}</Text>
                  </View>
                </View>
              </React.Fragment>
            ))}
          </View>

          <View style={styles.revDivider} />

          <View style={styles.revMonthRow}>
            <Icon name="calendar-month-outline" size={13} color={Colors.textTertiary} />
            <Text style={styles.revMonthTxt} numberOfLines={2}>
              {'This month: '}
              <Text style={styles.revMonthVal}>&#8377;{(s.monthTotalRevenue || 0).toLocaleString()}</Text>
              {'  \u00b7  '}
              <Text style={{ color: Colors.primary }}>{s.monthOnlineBookings || 0} online ({s.monthOnlineSlots || 0} slots)</Text>
              {'  \u00b7  '}
              <Text style={{ color: '#FF9800' }}>{s.monthOfflineBookings || 0} offline ({s.monthOfflineSlots || 0} slots)</Text>
            </Text>
          </View>
        </View>

        {/* ══ SECTION 3 — WALLET ══ */}
        <SectionHeader icon="wallet" title="Wallet" />
        <InfoRow
          iconName="wallet"
          iconBg="rgba(255,204,0,0.12)"
          iconColor={Colors.primary}
          label="Available Balance"
          value={`\u20b9${(dashboard?.wallet?.balance || 0).toLocaleString()}`}
          sub="Tap to withdraw or view history"
          onPress={() => navigation.navigate('Wallet')}
        />

        {/* ══ SECTION 4 — REVIEWS ══ */}
        <SectionHeader icon="star-circle" title="Reviews" />
        <InfoRow
          iconName="star"
          iconBg="rgba(255,193,7,0.12)"
          iconColor="#FFC107"
          label="Customer Reviews"
          value={null}
          badge={<StarRow />}
          sub="View and respond to feedback"
          onPress={() => navigation.navigate('OwnerReviews')}
        />

        {/* ══ SECTION 5 — CUSTOMERS ══ */}
        <SectionHeader icon="account-group" title="Customers" />
        <InfoRow
          iconName="account-group"
          iconBg="rgba(91,141,239,0.12)"
          iconColor="#5B8DEF"
          label="Your Customers"
          value={s.totalCustomers != null ? String(s.totalCustomers) : '\u2014'}
          sub="All-time booking customers"
          onPress={() => navigation.navigate('OwnerCustomers')}
        />

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ══ SIDEBAR ══ */}
      <Modal
        isVisible={isSidebarVisible}
        onBackdropPress={() => setSidebarVisible(false)}
        onSwipeComplete={() => setSidebarVisible(false)}
        swipeDirection="left"
        animationIn="slideInLeft"
        animationOut="slideOutLeft"
        style={{ margin: 0, justifyContent: 'flex-start' }}
      >
        <View style={[styles.sidebar, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.sidebarHead}>
            <Image source={require('../../../../SportVerse.png')} style={styles.sidebarLogo} resizeMode="contain" />
            <TouchableOpacity onPress={() => setSidebarVisible(false)} style={styles.sidebarCloseBtn}>
              <Icon name="close" size={20} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <Text style={styles.sidebarSection}>NAVIGATION</Text>

          <ScrollView style={{ paddingHorizontal: 20 }} showsVerticalScrollIndicator={false}>
            {[
              { icon: 'plus-box-outline',       label: 'Add Turf',     route: 'TurfRegistration' },
              { icon: 'clock-edit-outline',     label: 'Manage Slots', route: 'SlotManager' },
              { icon: 'ticket-confirmation',    label: 'Bookings',     route: 'Bookings' },
              { icon: 'account-group',          label: 'Customers',    route: 'OwnerCustomers' },
              { icon: 'wallet',                 label: 'My Wallet',    route: 'Wallet' },
              { icon: 'star-circle',            label: 'Reviews',      route: 'OwnerReviews' },
            ].map(({ icon, label, route }) => (
              <TouchableOpacity
                key={label}
                style={styles.sidebarItem}
                onPress={() => { setSidebarVisible(false); route && navigation.navigate(route); }}
                activeOpacity={0.7}
              >
                <View style={styles.sidebarIconBox}>
                  <Icon name={icon} size={19} color={Colors.primary} />
                </View>
                <Text style={styles.sidebarItemTxt}>{label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.sidebarFooter}>
            
            <TouchableOpacity style={[styles.sidebarItem, { marginHorizontal: 0 }]} onPress={handleDeleteAccount}>
              <View style={[styles.sidebarIconBox, { backgroundColor: 'rgba(239,68,68,0.12)' }]}>
                <Icon name="account-remove" size={19} color="#EF4444" />
              </View>
              <Text style={[styles.sidebarItemTxt, { color: Colors.error }]}>Delete Account</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.sidebarItem, { marginHorizontal: 0 }]} onPress={handleLogout}>
              <View style={[styles.sidebarIconBox, { backgroundColor: 'rgba(239,68,68,0.12)' }]}>
                <Icon name="logout" size={19} color="#EF4444" />
              </View>
              <Text style={[styles.sidebarItemTxt, { color: Colors.error }]}>Logout</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <SharePreviewModal
        visible={shareModalVisible}
        onClose={() => setShareModalVisible(false)}
        title={selectedShareTurf?.name}
        shareUrl={`https://scoreverse.in/turf/${selectedShareTurf?._id}`}
      >
        {selectedShareTurf ? <TurfPoster turf={selectedShareTurf} /> : <View />}
      </SharePreviewModal>
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.background },
  scroll: { paddingBottom: 40 },

  // Header
  header: {
    paddingHorizontal: 20, paddingBottom: 16,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  headerLeft:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  menuBtn:     { width: 38, height: 38, borderRadius: 10, backgroundColor: Colors.backgroundElevated, justifyContent: 'center', alignItems: 'center' },
  headerName:  { fontSize: 22, fontFamily: Typography.fontFamily.extraBold, color: Colors.textPrimary },
  trustRow:    { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  trustTxt:    { fontSize: 11, color: 'rgba(255,255,255,0.5)' },
  trustVal:    { fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary },
  avatarBtn:   { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primaryAlpha10, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.primaryAlpha30 },

  // KYC
  kycAlert:   { marginHorizontal: 16, marginTop: 12, marginBottom: 4, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.errorLight, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: Colors.error + '44' },
  kycIconBox: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.errorLight, justifyContent: 'center', alignItems: 'center' },
  kycTitle:   { fontSize: 13, fontFamily: Typography.fontFamily.bold, color: Colors.error },
  kycDesc:    { fontSize: 11, color: Colors.textSecondary, marginTop: 1 },

  // Section header
  secRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, marginTop: 24, marginBottom: 10 },
  secIconWrap:{ width: 24, height: 24, borderRadius: 7, backgroundColor: 'rgba(255,204,0,0.12)', justifyContent: 'center', alignItems: 'center' },
  secTitle:   { fontSize: 13, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary, letterSpacing: 0.3 },
  seeAll:     { fontSize: 12, fontFamily: Typography.fontFamily.semiBold, color: Colors.primary },

  // Turf cards — horizontal image-left layout
  turfCard: {
    marginHorizontal: 16, marginBottom: 10,
    backgroundColor: Colors.backgroundCard,
    borderRadius: 16, overflow: 'hidden',
    flexDirection: 'row',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    elevation: 4,
    minHeight: 124,
  },

  // Left image column
  turfThumbWrap: {
    width: 106,
    flexShrink: 0,
    position: 'relative',
    alignSelf: 'stretch',
  },
  turfThumb: {
    position: 'absolute',
    top: 0, left: 0, bottom: 0, right: 0,
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  turfThumbPlaceholder: {
    position: 'absolute',
    top: 0, left: 0, bottom: 0, right: 0,
    width: '100%',
    height: '100%',
    backgroundColor: '#1C1C1C',
    justifyContent: 'center', alignItems: 'center',
  },
  turfThumbFade: {
    position: 'absolute',
    top: 0, right: 0, bottom: 0,
    width: 32,
  },
  turfThumbStatus: {
    position: 'absolute',
    top: 8, left: 8,
    width: 8, height: 8, borderRadius: 4,
    borderWidth: 1.5, borderColor: Colors.backgroundCard,
  },

  // Right content column
  turfContent: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 12,
    paddingLeft: 10,
  },
  turfContentTopRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 8, marginBottom: 4,
  },
  turfContentName: {
    flex: 1,
    fontSize: 14, fontFamily: Typography.fontFamily.extraBold,
    color: Colors.textPrimary, letterSpacing: -0.2,
  },
  turfContentMeta: {
    flexDirection: 'row', alignItems: 'center',
    gap: 4, flexWrap: 'wrap', marginBottom: 3,
  },
  turfContentMetaTxt: {
    fontSize: 10, color: Colors.textTertiary,
    fontFamily: Typography.fontFamily.medium,
  },
  turfContentDot: {
    width: 3, height: 3, borderRadius: 2,
    backgroundColor: Colors.textTertiary,
  },
  turfContentRatingRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 4, marginBottom: 8,
  },
  turfContentRatingTxt: {
    fontSize: 11, fontFamily: Typography.fontFamily.semiBold, color: Colors.primary,
  },

  turfStatusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: 20, borderWidth: 1,
    flexShrink: 0,
    maxWidth: 80,
  },
  turfStatusDot: { width: 5, height: 5, borderRadius: 3 },
  turfStatusTxt: { fontSize: 9, fontFamily: Typography.fontFamily.bold, letterSpacing: 0.2 },

  turfPendingBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(245,158,11,0.15)',
    paddingHorizontal: 5, paddingVertical: 2, borderRadius: 8,
    borderWidth: 1, borderColor: 'rgba(245,158,11,0.3)',
  },
  turfPendingTxt: { fontSize: 8, color: Colors.warning, fontFamily: Typography.fontFamily.bold },

  turfActionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 10,
  },
  turfActionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    backgroundColor: Colors.primary,
    paddingVertical: 7, borderRadius: 10,
  },
  turfActionBtnTxt: {
    fontSize: 11, fontFamily: Typography.fontFamily.bold, color: '#000000',
  },
  turfActionBtnOutline: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    backgroundColor: 'transparent',
    paddingVertical: 7, borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(255,204,0,0.4)',
  },
  turfActionBtnOutlineTxt: {
    fontSize: 11, fontFamily: Typography.fontFamily.bold, color: Colors.primary,
  },
  turfActionBtnIcon: {
    width: 30, height: 30, borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.07)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },

  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, borderWidth: 1 },
  statusDot:  { width: 5, height: 5, borderRadius: 3 },
  statusTxt:  { fontSize: 10, fontFamily: Typography.fontFamily.bold },
  dot:        { width: 3, height: 3, borderRadius: 2, backgroundColor: Colors.textTertiary },

  // Add Another Turf button (solid)
  addTurfBtn: {
    marginHorizontal: 16, marginTop: 4, marginBottom: 4,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14,
    backgroundColor: Colors.backgroundElevated,
    borderRadius: 14, borderWidth: 1, borderColor: Colors.primaryAlpha20,
  },
  addTurfBtnTxt: { fontSize: 13, fontFamily: Typography.fontFamily.semiBold, color: Colors.primary },

  // Revenue card
  revenueCard: {
    marginHorizontal: 16, backgroundColor: Colors.backgroundCard,
    borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', overflow: 'hidden',
  },
  revTabBar:    { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  revTab:       { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14 },
  revTabActive: { borderBottomWidth: 2, borderBottomColor: Colors.primary },
  revTabTxt:       { fontSize: 12, fontFamily: Typography.fontFamily.semiBold, color: Colors.textTertiary },
  revTabTxtActive: { color: Colors.primary },

  revAmountWrap: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 14 },
  revLabel:      { fontSize: 10, fontFamily: Typography.fontFamily.bold, color: Colors.textSecondary, marginBottom: 4, letterSpacing: 1 },
  revAmount:     { fontSize: 38, fontFamily: Typography.fontFamily.extraBold, color: Colors.textPrimary, letterSpacing: -1 },
  revDivider:    { height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginHorizontal: 20 },

  revChipsRow: { flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 16 },
  revChip:     { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9 },
  revChipSep:  { width: 1, height: 34, backgroundColor: 'rgba(255,255,255,0.07)' },
  revChipDot:  { width: 8, height: 8, borderRadius: 4 },
  revChipLabel:{ fontSize: 9, fontFamily: Typography.fontFamily.bold, color: Colors.textTertiary, letterSpacing: 0.7 },
  revChipVal:  { fontSize: 15, fontFamily: Typography.fontFamily.extraBold, color: Colors.textPrimary, marginTop: 3 },

  revMonthRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 7, paddingHorizontal: 20, paddingVertical: 12 },
  revMonthTxt: { fontSize: 11, color: Colors.textSecondary, flex: 1 },
  revMonthVal: { fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary },

  // Info rows
  infoRow: {
    marginHorizontal: 16, marginBottom: 8,
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.backgroundCard, borderRadius: 16, padding: 16, gap: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  infoIconBox: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  infoText:    { flex: 1 },
  infoLabel:   { fontSize: 11, color: Colors.textSecondary, marginBottom: 2 },
  infoValue:   { fontSize: 22, fontFamily: Typography.fontFamily.extraBold, color: Colors.textPrimary },
  infoSub:     { fontSize: 11, color: Colors.textTertiary, marginTop: 2 },

  // Empty state — professional horizontal CTA card
  emptyCard: {
    marginHorizontal: 16,
    backgroundColor: Colors.backgroundElevated, borderRadius: 16,
    padding: 20, flexDirection: 'row', alignItems: 'center', gap: 16,
    borderWidth: 1, borderColor: Colors.borderLight,
  },
  emptyIconWrap: {
    width: 52, height: 52, borderRadius: 14,
    backgroundColor: Colors.primaryAlpha10,
    justifyContent: 'center', alignItems: 'center',
    flexShrink: 0,
    borderWidth: 1, borderColor: Colors.primaryAlpha20,
  },
  emptyTextWrap: { flex: 1 },
  emptyTitle:    { fontSize: 15, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary, marginBottom: 4 },
  emptyDesc:     { fontSize: 11, color: Colors.textSecondary, lineHeight: 16 },
  emptyArrow:    { width: 32, height: 32, borderRadius: 10, backgroundColor: Colors.primaryAlpha10, justifyContent: 'center', alignItems: 'center' },

  // Sidebar
  sidebar:         { width: W * 0.78, backgroundColor: Colors.backgroundCard, flex: 1, borderTopRightRadius: 28, borderBottomRightRadius: 28, elevation: 20 },
  sidebarHead:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 20 },
  sidebarLogo:     { width: 72, height: 72 },
  sidebarCloseBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: Colors.backgroundElevated, justifyContent: 'center', alignItems: 'center' },
  sidebarSection:  { fontSize: 10, fontFamily: Typography.fontFamily.bold, color: Colors.textTertiary, letterSpacing: 1.5, paddingHorizontal: 20, marginBottom: 8 },
  sidebarItem:     { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 11, borderRadius: 12, marginBottom: 2 },
  sidebarIconBox:  { width: 38, height: 38, borderRadius: 11, backgroundColor: 'rgba(255,204,0,0.1)', justifyContent: 'center', alignItems: 'center' },
  sidebarItemTxt:  { fontSize: 15, fontFamily: Typography.fontFamily.medium, color: Colors.textPrimary },
  sidebarFooter:   { paddingHorizontal: 20, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', paddingTop: 16 },
});

export default OwnerDashboardScreen;
