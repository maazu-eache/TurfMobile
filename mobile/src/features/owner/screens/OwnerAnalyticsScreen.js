import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Dimensions, Animated, ActivityIndicator, StatusBar,
  RefreshControl, Platform, Modal
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Typography, Spacing, BorderRadius } from '../../../theme/theme';
import { useTheme } from '../../../theme/ThemeContext';
import { fetchOwnerAnalytics } from '../ownerSlice';
import { useDispatch, useSelector } from 'react-redux';

const { width: SCREEN_W } = Dimensions.get('window');
const H_PAD = 16;
const KPI_GAP = 8;
const KPI_W = Math.floor((SCREEN_W - H_PAD * 2 - KPI_GAP * 2) / 3);

const fmtK = (num) => {
  if (num === undefined || num === null) return '₹0';
  if (num >= 100000) return `₹${(num / 100000).toFixed(1)}L`;
  if (num >= 1000) return `₹${(num / 1000).toFixed(1)}k`;
  return `₹${num}`;
};

const fmtHours = (num) => {
  if (num === undefined || num === null || isNaN(num)) return '0h';
  const rounded = Math.round(num * 2) / 2;
  if (rounded % 1 === 0) return `${Math.round(rounded)}h`;
  return `${rounded}h`;
};

const formatDateIN = (d) => {
  if (!d) return '';
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
};

const Divider = ({ colors }) => (
  <View style={{ height: 1, backgroundColor: colors.borderLight, marginVertical: 12 }} />
);

const SectionLabel = ({ label, icon, colors, isDark }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 14 }}>
    <Icon name={icon} size={15} color={isDark ? '#FFD400' : colors.primaryDark} />
    <Text style={{ fontSize: 13, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary, letterSpacing: 0.2 }}>
      {label}
    </Text>
  </View>
);

const Bar = ({ pct, color, height = 4, colors }) => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: Math.min(pct / 100, 1),
      duration: 700,
      useNativeDriver: false,
    }).start();
  }, [pct]);

  const barColor = color || colors.primary;

  return (
    <View style={{ backgroundColor: colors.surfaceVariant, borderRadius: 4, overflow: 'hidden', height }}>
      <Animated.View
        style={{
          height: '100%',
          borderRadius: 4,
          backgroundColor: barColor,
          width: anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] })
        }}
      />
    </View>
  );
};

const StatRow = ({ label, value, sub, accent, colors, isDark }) => (
  <View style={{
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  }}>
    <Text style={{ fontSize: 13, fontFamily: Typography.fontFamily.medium, color: colors.textSecondary }}>{label}</Text>
    <View style={{ alignItems: 'flex-end' }}>
      <Text style={[{ fontSize: 13, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary }, accent && { color: isDark ? '#FFD400' : colors.primaryDark }]}>
        {value}
      </Text>
      {sub ? <Text style={{ fontSize: 10, fontFamily: Typography.fontFamily.medium, color: colors.textTertiary, marginTop: 2, textAlign: 'right' }}>{sub}</Text> : null}
    </View>
  </View>
);

const Card = ({ children, style, colors, shadows, isDark }) => (
  <View style={[
    {
      backgroundColor: colors.surface,
      borderRadius: BorderRadius.xl,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      ...(isDark ? {} : shadows.sm)
    },
    style
  ]}>
    {children}
  </View>
);

const SkeletonRect = ({ width, height, style, colors }) => {
  const pulseAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        })
      ])
    ).start();
  }, [pulseAnim]);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          backgroundColor: colors.surfaceVariant,
          borderRadius: 8,
          opacity: pulseAnim,
        },
        style
      ]}
    />
  );
};

const AnalyticsSkeleton = ({ colors, ss }) => {
  return (
    <View style={{ flex: 1 }}>
      {/* KPI Grid Skeleton */}
      <View style={ss.kpiGrid}>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <View key={i} style={[ss.kpiCard, { marginRight: i % 3 === 0 ? 0 : KPI_GAP, marginBottom: KPI_GAP }]}>
            <View style={{ height: 60, padding: 10, justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <SkeletonRect width={14} height={14} colors={colors} />
                <SkeletonRect width={60} height={10} colors={colors} />
              </View>
              <SkeletonRect width={50} height={20} colors={colors} style={{ marginTop: 8 }} />
            </View>
          </View>
        ))}
      </View>

      {/* Chart Placeholder Skeleton */}
      <View style={[ss.card, { marginBottom: 12, padding: 15 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 15 }}>
          <SkeletonRect width={16} height={16} colors={colors} />
          <SkeletonRect width={100} height={12} colors={colors} />
        </View>
        <SkeletonRect width="100%" height={150} colors={colors} />
      </View>

      {/* Booking Source Skeleton */}
      <View style={[ss.card, { marginBottom: 12, padding: 15 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 15 }}>
          <SkeletonRect width={16} height={16} colors={colors} />
          <SkeletonRect width={120} height={12} colors={colors} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
          <SkeletonRect width={80} height={80} colors={colors} style={{ borderRadius: 40 }} />
          <View style={{ flex: 1, gap: 10 }}>
            <SkeletonRect width="80%" height={10} colors={colors} />
            <SkeletonRect width="60%" height={10} colors={colors} />
          </View>
        </View>
      </View>

      {/* Top Customers Skeleton */}
      <View style={[ss.card, { marginBottom: 12, padding: 15 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 15 }}>
          <SkeletonRect width={16} height={16} colors={colors} />
          <SkeletonRect width={110} height={12} colors={colors} />
        </View>
        <View style={{ gap: 12 }}>
          {[1, 2, 3].map((i) => (
            <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5 }}>
              <View style={{ gap: 6 }}>
                <SkeletonRect width={70} height={12} colors={colors} />
                <SkeletonRect width={90} height={8} colors={colors} />
              </View>
              <SkeletonRect width={40} height={14} colors={colors} />
            </View>
          ))}
        </View>
      </View>
    </View>
  );
};

const OwnerAnalyticsScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();
  const { colors, isDark, shadows } = useTheme();
  const ss = useMemo(() => createStyles(colors, isDark, shadows), [colors, isDark, shadows]);

  const { analytics, isLoading, dashboard } = useSelector(state => state.owner);
  const turfs = dashboard?.owner?.turfs || [];

  const [dateRange, setDateRange] = useState('month');
  const [selectedTurfId, setSelectedTurfId] = useState('all');
  const [turfModalVisible, setTurfModalVisible] = useState(false);
  const [customStart, setCustomStart] = useState(new Date(new Date().setDate(new Date().getDate() - 7)));
  const [customEnd, setCustomEnd] = useState(new Date());
  const [showPicker, setShowPicker] = useState(null);

  const fetchAnalytics = () => {
    let params = { range: dateRange, turfId: selectedTurfId };
    if (dateRange === 'custom') {
      params.startDate = customStart.toISOString().split('T')[0];
      params.endDate = customEnd.toISOString().split('T')[0];
    }
    dispatch(fetchOwnerAnalytics(params));
  };

  useEffect(() => { fetchAnalytics(); }, [dispatch, dateRange, selectedTurfId, customStart, customEnd]);
  const onRefresh = () => fetchAnalytics();
  const handleTurfSelect = (id) => { setSelectedTurfId(id); setTurfModalVisible(false); };

  const hasData = analytics && Object.keys(analytics).length > 0;
  const kpis = analytics?.kpis || {};
  const bookingSource = analytics?.bookingSource || {};
  const turfPerformance = analytics?.turfPerformance || [];
  const bookingStatus = analytics?.bookingStatus || [];
  const paymentBreakdown = analytics?.paymentBreakdown || [];
  const customerAnalytics = analytics?.customerAnalytics || {};
  const insights = analytics?.insights || [];

  const selectedTurfName = selectedTurfId === 'all'
    ? 'All Turfs'
    : ((turfs || []).find(t => t._id === selectedTurfId)?.name || 'Turf');

  const FILTER_LABELS = { today: 'Today', week: 'Week', month: 'Month', year: 'Year', all: 'All', custom: 'Custom' };

  return (
    <View style={ss.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <View style={[ss.header, { paddingTop: insets.top + 12 }]}>
        <View style={ss.headerInner}>
          <View>
            <Text style={ss.headerTitle}>Analytics</Text>
            <Text style={ss.headerSub}>Performance overview</Text>
          </View>
          {turfs && turfs.length > 1 ? (
            <TouchableOpacity style={ss.turfBtn} onPress={() => setTurfModalVisible(true)}>
              <Text style={ss.turfBtnTxt} numberOfLines={1}>{selectedTurfName}</Text>
              <Icon name="chevron-down" size={14} color={isDark ? '#FFD400' : colors.primaryDark} />
            </TouchableOpacity>
          ) : (
            <Text style={ss.turfStaticName} numberOfLines={1}>
              {turfs && turfs[0] ? turfs[0].name : ''}
            </Text>
          )}
        </View>

        <View style={ss.filterRow}>
          {Object.entries(FILTER_LABELS).map(([key, label]) => (
            <TouchableOpacity
              key={key}
              style={[ss.filterBtn, dateRange === key && ss.filterBtnActive]}
              onPress={() => setDateRange(key)}
            >
              <Text style={[ss.filterTxt, dateRange === key && ss.filterTxtActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {dateRange === 'custom' && (
          <View style={ss.customDateRow}>
            <TouchableOpacity style={ss.customDateBtn} onPress={() => setShowPicker('start')}>
              <Icon name="calendar" size={13} color={colors.textTertiary} />
              <Text style={ss.customDateTxt}>{formatDateIN(customStart)}</Text>
            </TouchableOpacity>
            <Text style={ss.customDateSep}>→</Text>
            <TouchableOpacity style={ss.customDateBtn} onPress={() => setShowPicker('end')}>
              <Icon name="calendar" size={13} color={colors.textTertiary} />
              <Text style={ss.customDateTxt}>{formatDateIN(customEnd)}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      {isLoading && !hasData ? (
        <ScrollView
          contentContainerStyle={ss.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <AnalyticsSkeleton colors={colors} ss={ss} />
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={ss.scrollContent}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={onRefresh} tintColor={colors.primary} />}
          showsVerticalScrollIndicator={false}
        >
          {/* ── KPI Grid ─────────────────────────────────────────────────── */}
          <View style={ss.kpiGrid}>
            {[
              { label: 'Revenue', value: fmtK(kpis.totalRevenue || 0), icon: 'cash-multiple' },
              { label: 'Bookings', value: String(kpis.totalBookings || 0), icon: 'calendar-check' },
              { label: 'Online', value: String(kpis.onlineBookings || 0), icon: 'cellphone-link' },
              { label: 'Offline', value: String(kpis.offlineBookings || 0), icon: 'store-outline' },
              { label: 'Hours', value: fmtHours(kpis.hoursBooked), icon: 'clock-outline' },
              { label: 'Occupancy', value: `${kpis.occupancyRate || 0}%`, icon: 'percent' },
            ].map((kpi, i) => (
              <View key={i} style={[ss.kpiCard, { marginRight: i % 3 === 2 ? 0 : KPI_GAP, marginBottom: KPI_GAP }]}>
                <View style={ss.kpiTop}>
                  <Icon name={kpi.icon} size={14} color={isDark ? '#FFD400' : colors.primaryDark} />
                  <Text style={ss.kpiLabel}>{kpi.label}</Text>
                </View>
                <Text style={ss.kpiVal}>{kpi.value}</Text>
              </View>
            ))}
          </View>

          {(!kpis.totalBookings && !kpis.totalRevenue) ? (
            <View style={ss.emptyState}>
              <Icon name="chart-box-outline" size={40} color={colors.textTertiary} />
              <Text style={ss.emptyTxt}>No data for this period</Text>
            </View>
          ) : (
            <>
              {/* ── Booking Source ─────────────────────────────────────── */}
              <Card colors={colors} shadows={shadows} isDark={isDark} style={{ marginBottom: 12 }}>
                <SectionLabel label="Booking Source" icon="chart-pie" colors={colors} isDark={isDark} />
                <View style={ss.splitRow}>
                  <View>
                    <Text style={ss.splitLabel}>Online</Text>
                    <Text style={ss.splitVal}>{bookingSource.online || 0}</Text>
                    <Text style={ss.splitPct}>{bookingSource.onlinePct || 0}%</Text>
                  </View>
                  <View style={ss.splitCenter}>
                    <Bar pct={bookingSource.onlinePct || 0} height={6} colors={colors} color={isDark ? '#FFD400' : colors.primaryDark} />
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={ss.splitLabel}>Offline</Text>
                    <Text style={ss.splitVal}>{bookingSource.offline || 0}</Text>
                    <Text style={ss.splitPct}>{bookingSource.offlinePct || 0}%</Text>
                  </View>
                </View>
              </Card>

              {/* ── Customer Analytics ─────────────────────────────────── */}
              <Card colors={colors} shadows={shadows} isDark={isDark} style={{ marginBottom: 12 }}>
                <SectionLabel label="Customers" icon="account-group" colors={colors} isDark={isDark} />
                <View style={ss.custGrid}>
                  {[
                    { label: 'Total', val: customerAnalytics.total || 0 },
                    { label: 'New', val: customerAnalytics.new || 0 },
                    { label: 'Returning', val: customerAnalytics.returning || 0 },
                    { label: 'Repeat %', val: `${customerAnalytics.repeatRate || 0}%` },
                  ].map((c, i) => (
                    <View key={i} style={ss.custCell}>
                      <Text style={ss.custVal}>{c.val}</Text>
                      <Text style={ss.custLabel}>{c.label}</Text>
                    </View>
                  ))}
                </View>
                {customerAnalytics.topCustomers && customerAnalytics.topCustomers.length > 0 && (
                  <>
                    <Divider colors={colors} />
                    <Text style={ss.subHeader}>Top Customers</Text>
                    {customerAnalytics.topCustomers.map((c, i) => (
                      <StatRow key={i} label={c.name} value={fmtK(c.spent)} sub={`${c.bookings} booking${c.bookings > 1 ? 's' : ''}${c.slots ? ` (${c.slots} slot${c.slots > 1 ? 's' : ''})` : ''}`} accent colors={colors} isDark={isDark} />
                    ))}
                  </>
                )}
              </Card>

              {/* ── Turf Performance ───────────────────────────────────── */}
              {turfPerformance.length > 0 && (
                <Card colors={colors} shadows={shadows} isDark={isDark} style={{ marginBottom: 12 }}>
                  <SectionLabel label="Turf Performance" icon="stadium" colors={colors} isDark={isDark} />
                  {turfPerformance.map((t, i) => (
                    <View key={i}>
                      {i > 0 && <Divider colors={colors} />}
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 }}>
                        <Text style={ss.turfName}>{t.turfName}</Text>
                        <Text style={ss.turfRev}>{fmtK(t.revenue)}</Text>
                      </View>
                      <View style={ss.turfStats}>
                        {[
                          { icon: 'cellphone-link', label: `${t.online}(slots) online` },
                          { icon: 'store-outline', label: `${t.offline}(slots) offline` },
                        ].map((s, j) => (
                          <View key={j} style={ss.turfStatItem}>
                            <Icon name={s.icon} size={12} color={colors.textTertiary} />
                            <Text style={ss.turfStatTxt}>{s.label}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  ))}
                </Card>
              )}

              {/* ── Booking Status ─────────────────────────────────────── */}
              <Card colors={colors} shadows={shadows} isDark={isDark} style={{ marginBottom: 12 }}>
                <SectionLabel label="Booking Status" icon="list-status" colors={colors} isDark={isDark} />
                {bookingStatus.map((s, i) => (
                  <View key={i} style={{ marginBottom: 14 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                      <Text style={ss.statusLabel}>{s.status.replace(/_/g, ' ')}</Text>
                      <Text style={ss.statusVal}>{s.count} · {s.pct}%</Text>
                    </View>
                    <Bar
                      pct={s.pct}
                      colors={colors}
                      color={s.status.includes('cancel') ? colors.error : s.status.includes('complete') ? (isDark ? '#FFD400' : colors.primaryDark) : colors.textTertiary}
                      height={4}
                    />
                  </View>
                ))}
                <Divider colors={colors} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: 4 }}>
                  <Text style={ss.statusLabel}>Cancellation Rate</Text>
                  <Text style={[ss.statusVal, { color: colors.error }]}>{analytics?.cancellationRate || 0}%</Text>
                </View>
              </Card>

              {/* ── Payment Breakdown ──────────────────────────────────── */}
              {paymentBreakdown.length > 0 && (
                <Card colors={colors} shadows={shadows} isDark={isDark} style={{ marginBottom: 12 }}>
                  <SectionLabel label="Payment Breakdown" icon="wallet-outline" colors={colors} isDark={isDark} />
                  {paymentBreakdown.map((p, i) => (
                    <StatRow key={i} label={p.method} value={fmtK(p.revenue)} colors={colors} isDark={isDark} />
                  ))}
                </Card>
              )}

              {/* ── AI Business Insights ───────────────────────────────── */}
              {insights.length > 0 && (
                <Card colors={colors} shadows={shadows} isDark={isDark} style={{ marginBottom: 12 }}>
                  <View style={ss.insightHeader}>
                    <View style={ss.insightIconWrap}>
                      <Icon name="robot-outline" size={16} color={isDark ? '#FFD400' : colors.primaryDark} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={ss.sectionLabelTxt}>AI Business Insights</Text>
                      <Text style={ss.insightSub}>Personalised for your turf</Text>
                    </View>
                  </View>
                  {insights.map((insight, i) => (
                    <View key={i} style={ss.insightItem}>
                      <View style={ss.insightDot} />
                      <View style={{ flex: 1 }}>
                        <Text style={ss.insightTxt}>{insight.text || insight}</Text>
                        {insight.action && (
                          <Text style={ss.insightAction}>{insight.action}</Text>
                        )}
                      </View>
                    </View>
                  ))}
                </Card>
              )}
            </>
          )}
        </ScrollView>
      )}

      {showPicker && (
        <DateTimePicker
          value={showPicker === 'start' ? customStart : customEnd}
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            const current = showPicker;
            setShowPicker(Platform.OS === 'ios' ? current : null);
            if (selectedDate) {
              if (current === 'start') setCustomStart(selectedDate);
              else setCustomEnd(selectedDate);
            }
          }}
        />
      )}

      <Modal visible={turfModalVisible} transparent animationType="slide">
        <View style={ss.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={() => setTurfModalVisible(false)} />
          <View style={[ss.bottomSheet, { paddingBottom: Math.max(insets.bottom + 20, 40) }]}>
            <View style={ss.sheetHandle} />
            <View style={ss.sheetTitleRow}>
              <Text style={ss.sheetTitle}>Select Turf</Text>
              <TouchableOpacity onPress={() => setTurfModalVisible(false)}>
                <Icon name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 300 }}>
              <TouchableOpacity style={ss.sheetItem} onPress={() => handleTurfSelect('all')}>
                <Text style={[ss.sheetItemTxt, selectedTurfId === 'all' && ss.sheetItemTxtActive]}>All Turfs</Text>
                {selectedTurfId === 'all' && <Icon name="check" size={18} color={isDark ? '#FFD400' : colors.primaryDark} />}
              </TouchableOpacity>
              {(turfs || []).map(t => (
                <TouchableOpacity key={t._id} style={ss.sheetItem} onPress={() => handleTurfSelect(t._id)}>
                  <Text style={[ss.sheetItemTxt, selectedTurfId === t._id && ss.sheetItemTxtActive]}>{t.name}</Text>
                  {selectedTurfId === t._id && <Icon name="check" size={18} color={isDark ? '#FFD400' : colors.primaryDark} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const createStyles = (colors, isDark, shadows) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  header: {
    backgroundColor: colors.surface,
    paddingHorizontal: H_PAD,
    paddingBottom: 0,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerInner: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 16,
  },
  headerTitle: {
    fontSize: 26, fontFamily: Typography.fontFamily.extraBold,
    color: colors.textPrimary, letterSpacing: -0.5,
  },
  headerSub: {
    fontSize: 12, fontFamily: Typography.fontFamily.medium,
    color: colors.textTertiary, marginTop: 2,
  },
  turfBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderBottomWidth: 1.5, borderBottomColor: isDark ? '#FFD400' : colors.primaryDark,
    paddingBottom: 2,
  },
  turfBtnTxt: {
    fontSize: 13, fontFamily: Typography.fontFamily.bold,
    color: isDark ? '#FFD400' : colors.primaryDark,
  },
  turfStaticName: {
    fontSize: 13, fontFamily: Typography.fontFamily.bold,
    color: isDark ? '#FFD400' : colors.primaryDark, marginTop: 6,
  },

  filterRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginTop: 4,
  },
  filterBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 10,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
    marginBottom: -1,
  },
  filterBtnActive: { borderBottomColor: isDark ? '#FFD400' : colors.primaryDark },
  filterTxt: { fontSize: 12, fontFamily: Typography.fontFamily.medium, color: colors.textTertiary },
  filterTxtActive: { color: isDark ? '#FFD400' : colors.primaryDark, fontFamily: Typography.fontFamily.bold },

  customDateRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10, paddingBottom: 10 },
  customDateBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    paddingVertical: 8,
  },
  customDateTxt: { fontSize: 12, fontFamily: Typography.fontFamily.medium, color: colors.textSecondary },
  customDateSep: { fontSize: 14, color: colors.textTertiary },

  scrollContent: { padding: H_PAD, paddingBottom: 110 },
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 10 },
  emptyTxt: { fontSize: 14, fontFamily: Typography.fontFamily.medium, color: colors.textTertiary },

  card: {
    backgroundColor: colors.surface, borderRadius: BorderRadius.xl,
    padding: 16, borderWidth: 1, borderColor: colors.border,
    ...(isDark ? {} : shadows.sm)
  },

  sectionLabelTxt: { fontSize: 13, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary, letterSpacing: 0.2 },

  subHeader: {
    fontSize: 10, fontFamily: Typography.fontFamily.bold, color: colors.textTertiary,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10,
  },

  kpiGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    marginBottom: 12,
  },
  kpiCard: {
    width: KPI_W, backgroundColor: colors.surface,
    borderRadius: BorderRadius.lg, padding: 12,
    borderWidth: 1, borderColor: colors.border,
    ...(isDark ? {} : shadows.sm)
  },
  kpiTop: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 },
  kpiVal: { fontSize: 16, fontFamily: Typography.fontFamily.extraBold, color: colors.textPrimary },
  kpiLabel: { fontSize: 10, fontFamily: Typography.fontFamily.medium, color: colors.textTertiary },

  splitRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  splitCenter: { flex: 1 },
  splitLabel: { fontSize: 11, fontFamily: Typography.fontFamily.medium, color: colors.textTertiary, marginBottom: 2 },
  splitVal: { fontSize: 18, fontFamily: Typography.fontFamily.extraBold, color: colors.textPrimary },
  splitPct: { fontSize: 12, fontFamily: Typography.fontFamily.bold, color: isDark ? '#FFD400' : colors.primaryDark, marginTop: 2 },

  custGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  custCell: { alignItems: 'center', flex: 1 },
  custVal: { fontSize: 20, fontFamily: Typography.fontFamily.extraBold, color: colors.textPrimary, marginBottom: 3 },
  custLabel: { fontSize: 10, fontFamily: Typography.fontFamily.medium, color: colors.textTertiary },

  turfName: { fontSize: 14, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary },
  turfRev: { fontSize: 14, fontFamily: Typography.fontFamily.extraBold, color: isDark ? '#FFD400' : colors.primaryDark },
  turfStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingBottom: 4 },
  turfStatItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  turfStatTxt: { fontSize: 11, fontFamily: Typography.fontFamily.medium, color: colors.textTertiary },

  statusLabel: { fontSize: 12, fontFamily: Typography.fontFamily.medium, color: colors.textSecondary, textTransform: 'capitalize' },
  statusVal: { fontSize: 12, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary },

  insightHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  insightIconWrap: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: isDark ? 'rgba(255,204,0,0.15)' : '#FFF9DB', justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: isDark ? 'rgba(255,204,0,0.3)' : '#FFE066',
  },
  insightSub: { fontSize: 11, fontFamily: Typography.fontFamily.medium, color: colors.textTertiary, marginTop: 1 },
  insightItem: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  insightDot: {
    width: 5, height: 5, borderRadius: 3,
    backgroundColor: isDark ? '#FFD400' : colors.primaryDark, marginTop: 7, flexShrink: 0,
  },
  insightTxt: { fontSize: 13, fontFamily: Typography.fontFamily.medium, color: colors.textSecondary, lineHeight: 20 },
  insightAction: {
    fontSize: 12, fontFamily: Typography.fontFamily.medium, color: isDark ? '#FFD400' : colors.primaryDark,
    lineHeight: 18, marginTop: 4, fontStyle: 'italic',
  },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  bottomSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl,
    padding: 20,
  },
  sheetHandle: { width: 36, height: 3, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 18 },
  sheetTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sheetTitle: { fontSize: 16, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary },
  sheetItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  sheetItemTxt: { fontSize: 14, fontFamily: Typography.fontFamily.medium, color: colors.textSecondary },
  sheetItemTxtActive: { color: isDark ? '#FFD400' : colors.primaryDark, fontFamily: Typography.fontFamily.bold },
});

export default OwnerAnalyticsScreen;
