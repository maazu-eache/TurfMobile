import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Dimensions, Animated, ActivityIndicator, StatusBar,
  RefreshControl, Platform, Modal
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Colors, Typography, Spacing, BorderRadius } from '../../../theme/theme';
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

const formatDateIN = (d) => {
  if (!d) return '';
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
};

const Divider = () => <View style={ss.divider} />;

const SectionLabel = ({ label, icon }) => (
  <View style={ss.sectionLabel}>
    <Icon name={icon} size={14} color={Colors.primary} />
    <Text style={ss.sectionLabelTxt}>{label}</Text>
  </View>
);

const Bar = ({ pct, color = Colors.primary, height = 4 }) => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: Math.min(pct / 100, 1),
      duration: 700,
      useNativeDriver: false,
    }).start();
  }, [pct]);
  return (
    <View style={[ss.barTrack, { height }]}>
      <Animated.View
        style={[ss.barFill, {
          backgroundColor: color,
          width: anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] })
        }]}
      />
    </View>
  );
};

const StatRow = ({ label, value, sub, accent }) => (
  <View style={ss.statRow}>
    <Text style={ss.statLabel}>{label}</Text>
    <View style={{ alignItems: 'flex-end' }}>
      <Text style={[ss.statValue, accent && { color: Colors.primary }]}>{value}</Text>
      {sub ? <Text style={ss.statSub}>{sub}</Text> : null}
    </View>
  </View>
);

const Card = ({ children, style }) => (
  <View style={[ss.card, style]}>{children}</View>
);

const OwnerAnalyticsScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();
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
  const revenueTrend = analytics?.revenueTrend || [];
  const bookingSource = analytics?.bookingSource || {};
  const turfPerformance = analytics?.turfPerformance || [];
  const peakHours = analytics?.peakHours || {};
  const bookingStatus = analytics?.bookingStatus || [];
  const paymentBreakdown = analytics?.paymentBreakdown || [];
  const customerAnalytics = analytics?.customerAnalytics || {};
  const utilization = analytics?.utilization || {};
  const insights = analytics?.insights || [];

  const selectedTurfName = selectedTurfId === 'all'
    ? 'All Turfs'
    : ((turfs || []).find(t => t._id === selectedTurfId)?.name || 'Turf');

  const FILTER_LABELS = { today: 'Today', week: 'Week', month: 'Month', year: 'Year', all: 'All', custom: 'Custom' };

  return (
    <View style={ss.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

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
              <Icon name="chevron-down" size={14} color={Colors.primary} />
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
              <Icon name="calendar" size={13} color={Colors.textTertiary} />
              <Text style={ss.customDateTxt}>{formatDateIN(customStart)}</Text>
            </TouchableOpacity>
            <Text style={ss.customDateSep}>→</Text>
            <TouchableOpacity style={ss.customDateBtn} onPress={() => setShowPicker('end')}>
              <Icon name="calendar" size={13} color={Colors.textTertiary} />
              <Text style={ss.customDateTxt}>{formatDateIN(customEnd)}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      {isLoading && !hasData ? (
        <View style={ss.loadingWrap}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={ss.loadingTxt}>Loading analytics…</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={ss.scrollContent}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={onRefresh} tintColor={Colors.primary} />}
          showsVerticalScrollIndicator={false}
        >
          {/* ── KPI Grid ─────────────────────────────────────────────────── */}
          <View style={ss.kpiGrid}>
            {[
              { label: 'Revenue', value: fmtK(kpis.totalRevenue || 0), icon: 'cash-multiple' },
              { label: 'Bookings', value: String(kpis.totalBookings || 0), icon: 'calendar-check' },
              { label: 'Online', value: String(kpis.onlineBookings || 0), icon: 'cellphone-link' },
              { label: 'Offline', value: String(kpis.offlineBookings || 0), icon: 'store-outline' },
              { label: 'Hours', value: `${kpis.hoursBooked || 0}h`, icon: 'clock-outline' },
              { label: 'Occupancy', value: `${kpis.occupancyRate || 0}%`, icon: 'percent' },
            ].map((kpi, i) => (
              <View key={i} style={[ss.kpiCard, { marginRight: i % 3 === 2 ? 0 : KPI_GAP, marginBottom: KPI_GAP }]}>
                <View style={ss.kpiTop}>
                  <Icon name={kpi.icon} size={13} color={Colors.primary} />
                  <Text style={ss.kpiLabel}>{kpi.label}</Text>
                </View>
                <Text style={ss.kpiVal}>{kpi.value}</Text>
              </View>
            ))}
          </View>

          {(!kpis.totalBookings && !kpis.totalRevenue) ? (
            <View style={ss.emptyState}>
              <Icon name="chart-box-outline" size={40} color={Colors.textTertiary} />
              <Text style={ss.emptyTxt}>No data for this period</Text>
            </View>
          ) : (
            <>
              {/* ── Booking Source ─────────────────────────────────────── */}
              <Card style={{ marginBottom: 12 }}>
                <SectionLabel label="Booking Source" icon="chart-pie" />
                <View style={ss.splitRow}>
                  <View>
                    <Text style={ss.splitLabel}>Online</Text>
                    <Text style={ss.splitVal}>{bookingSource.online || 0}</Text>
                    <Text style={ss.splitPct}>{bookingSource.onlinePct || 0}%</Text>
                  </View>
                  <View style={ss.splitCenter}>
                    <Bar pct={bookingSource.onlinePct || 0} height={6} />
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={ss.splitLabel}>Offline</Text>
                    <Text style={ss.splitVal}>{bookingSource.offline || 0}</Text>
                    <Text style={ss.splitPct}>{bookingSource.offlinePct || 0}%</Text>
                  </View>
                </View>
              </Card>

              {/* ── Utilization ────────────────────────────────────────── */}
              <Card style={{ marginBottom: 12 }}>
                <SectionLabel label="Utilization" icon="chart-donut" />
                <View style={ss.splitRow}>
                  <View>
                    <Text style={ss.splitLabel}>Booked</Text>
                    <Text style={ss.splitVal}>{utilization.bookedHours || 0}h</Text>
                    <Text style={ss.splitPct}>{utilization.occupancyRate || 0}%</Text>
                  </View>
                  <View style={ss.splitCenter}>
                    <Bar pct={utilization.occupancyRate || 0} height={6} />
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={ss.splitLabel}>Unused</Text>
                    <Text style={ss.splitVal}>{utilization.unusedHours || 0}h</Text>
                    <Text style={ss.splitPct}>{100 - (utilization.occupancyRate || 0)}%</Text>
                  </View>
                </View>
              </Card>

              {/* ── Customer Analytics ─────────────────────────────────── */}
              <Card style={{ marginBottom: 12 }}>
                <SectionLabel label="Customers" icon="account-group" />
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
                    <Divider />
                    <Text style={ss.subHeader}>Top Customers</Text>
                    {customerAnalytics.topCustomers.map((c, i) => (
                      <StatRow key={i} label={c.name} value={fmtK(c.spent)} sub={`${c.bookings} bookings`} accent />
                    ))}
                  </>
                )}
              </Card>

              {/* ── Turf Performance ───────────────────────────────────── */}
              {turfPerformance.length > 0 && (
                <Card style={{ marginBottom: 12 }}>
                  <SectionLabel label="Turf Performance" icon="stadium" />
                  {turfPerformance.map((t, i) => (
                    <View key={i}>
                      {i > 0 && <Divider />}
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 }}>
                        <Text style={ss.turfName}>{t.turfName}</Text>
                        <Text style={ss.turfRev}>{fmtK(t.revenue)}</Text>
                      </View>
                      <View style={ss.turfStats}>
                        {[
                          { icon: 'calendar-check', label: `${t.bookings} bookings` },
                          { icon: 'clock-outline', label: `${t.hours}h` },
                          { icon: 'cellphone-link', label: `${t.online} online` },
                          { icon: 'store-outline', label: `${t.offline} offline` },
                        ].map((s, j) => (
                          <View key={j} style={ss.turfStatItem}>
                            <Icon name={s.icon} size={11} color={Colors.textTertiary} />
                            <Text style={ss.turfStatTxt}>{s.label}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  ))}
                </Card>
              )}

              {/* ── Peak Hours ─────────────────────────────────────────── */}
              <Card style={{ marginBottom: 12 }}>
                <SectionLabel label="Peak Hours" icon="fire" />
                <View style={ss.peakRow}>
                  <View style={ss.peakItem}>
                    <Icon name="calendar-week" size={18} color={Colors.primary} />
                    <View style={{ marginLeft: 10 }}>
                      <Text style={ss.peakLabel}>Peak Day</Text>
                      <Text style={ss.peakVal}>{peakHours.peakDay || '—'}</Text>
                    </View>
                  </View>
                  <View style={ss.peakItem}>
                    <Icon name="clock-time-four" size={18} color={Colors.primary} />
                    <View style={{ marginLeft: 10 }}>
                      <Text style={ss.peakLabel}>Peak Time</Text>
                      <Text style={ss.peakVal}>{peakHours.peakTime || '—'}</Text>
                    </View>
                  </View>
                </View>
                {peakHours.heatmap && peakHours.heatmap.length > 0 && (
                  <>
                    <Divider />
                    <Text style={ss.subHeader}>Top Slots</Text>
                    {peakHours.heatmap.map((h, i) => (
                      <StatRow key={i} label={`${h.day}, ${h.hour}`} value={`${h.count} bkgs`} />
                    ))}
                  </>
                )}
              </Card>

              {/* ── Booking Status ─────────────────────────────────────── */}
              <Card style={{ marginBottom: 12 }}>
                <SectionLabel label="Booking Status" icon="list-status" />
                {bookingStatus.map((s, i) => (
                  <View key={i} style={{ marginBottom: 14 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                      <Text style={ss.statusLabel}>{s.status.replace(/_/g, ' ')}</Text>
                      <Text style={ss.statusVal}>{s.count} · {s.pct}%</Text>
                    </View>
                    <Bar
                      pct={s.pct}
                      color={s.status.includes('cancel') ? Colors.error : s.status.includes('complete') ? Colors.primary : Colors.textTertiary}
                      height={3}
                    />
                  </View>
                ))}
                <Divider />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: 4 }}>
                  <Text style={ss.statusLabel}>Cancellation Rate</Text>
                  <Text style={[ss.statusVal, { color: Colors.error }]}>{analytics?.cancellationRate || 0}%</Text>
                </View>
              </Card>

              {/* ── Payment Breakdown ──────────────────────────────────── */}
              {paymentBreakdown.length > 0 && (
                <Card style={{ marginBottom: 12 }}>
                  <SectionLabel label="Payment Breakdown" icon="wallet-outline" />
                  {paymentBreakdown.map((p, i) => (
                    <StatRow key={i} label={p.method} value={fmtK(p.revenue)} sub={`${p.count} txn${p.count !== 1 ? 's' : ''}`} />
                  ))}
                </Card>
              )}

              {/* ── AI Business Insights ───────────────────────────────── */}
              {insights.length > 0 && (
                <Card style={{ marginBottom: 12 }}>
                  <View style={ss.insightHeader}>
                    <View style={ss.insightIconWrap}>
                      <Icon name="robot-outline" size={16} color={Colors.primary} />
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
                <Icon name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 300 }}>
              <TouchableOpacity style={ss.sheetItem} onPress={() => handleTurfSelect('all')}>
                <Text style={[ss.sheetItemTxt, selectedTurfId === 'all' && ss.sheetItemTxtActive]}>All Turfs</Text>
                {selectedTurfId === 'all' && <Icon name="check" size={18} color={Colors.primary} />}
              </TouchableOpacity>
              {(turfs || []).map(t => (
                <TouchableOpacity key={t._id} style={ss.sheetItem} onPress={() => handleTurfSelect(t._id)}>
                  <Text style={[ss.sheetItemTxt, selectedTurfId === t._id && ss.sheetItemTxtActive]}>{t.name}</Text>
                  {selectedTurfId === t._id && <Icon name="check" size={18} color={Colors.primary} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const ss = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  header: {
    backgroundColor: Colors.background,
    paddingHorizontal: H_PAD,
    paddingBottom: 0,
  },
  headerInner: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 16,
  },
  headerTitle: {
    fontSize: 26, fontFamily: Typography.fontFamily.extraBold,
    color: Colors.textPrimary, letterSpacing: -0.5,
  },
  headerSub: {
    fontSize: 12, fontFamily: Typography.fontFamily.medium,
    color: Colors.textTertiary, marginTop: 2,
  },
  turfBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderBottomWidth: 1.5, borderBottomColor: Colors.primary,
    paddingBottom: 2,
  },
  turfBtnTxt: {
    fontSize: 13, fontFamily: Typography.fontFamily.bold,
    color: Colors.primary,
  },
  turfStaticName: {
    fontSize: 13, fontFamily: Typography.fontFamily.bold,
    color: Colors.primary, marginTop: 6,
  },

  filterRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    marginTop: 4,
  },
  filterBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 10,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
    marginBottom: -1,
  },
  filterBtnActive: { borderBottomColor: Colors.primary },
  filterTxt: { fontSize: 11, fontFamily: Typography.fontFamily.medium, color: Colors.textTertiary },
  filterTxtActive: { color: Colors.primary, fontFamily: Typography.fontFamily.bold },

  customDateRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10, paddingBottom: 10 },
  customDateBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    paddingVertical: 8,
  },
  customDateTxt: { fontSize: 12, fontFamily: Typography.fontFamily.medium, color: Colors.textSecondary },
  customDateSep: { fontSize: 14, color: Colors.textTertiary },

  scrollContent: { padding: H_PAD, paddingBottom: 110 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingTxt: { fontSize: 13, fontFamily: Typography.fontFamily.medium, color: Colors.textSecondary },
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 10 },
  emptyTxt: { fontSize: 14, fontFamily: Typography.fontFamily.medium, color: Colors.textTertiary },

  card: {
    backgroundColor: Colors.backgroundCard, borderRadius: BorderRadius.xl,
    padding: 16, borderWidth: 1, borderColor: Colors.border,
  },

  divider: { height: 1, backgroundColor: Colors.borderLight, marginVertical: 12 },

  sectionLabel: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 14 },
  sectionLabelTxt: { fontSize: 13, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary, letterSpacing: 0.2 },

  subHeader: {
    fontSize: 10, fontFamily: Typography.fontFamily.bold, color: Colors.textTertiary,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10,
  },

  kpiGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    marginBottom: 12,
  },
  kpiCard: {
    width: KPI_W, backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.lg, padding: 12,
    borderWidth: 1, borderColor: Colors.border,
  },
  kpiTop: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 },
  kpiVal: { fontSize: 16, fontFamily: Typography.fontFamily.extraBold, color: Colors.textPrimary },
  kpiLabel: { fontSize: 10, fontFamily: Typography.fontFamily.medium, color: Colors.textTertiary },

  splitRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  splitCenter: { flex: 1 },
  splitLabel: { fontSize: 11, fontFamily: Typography.fontFamily.medium, color: Colors.textTertiary, marginBottom: 2 },
  splitVal: { fontSize: 18, fontFamily: Typography.fontFamily.extraBold, color: Colors.textPrimary },
  splitPct: { fontSize: 12, fontFamily: Typography.fontFamily.bold, color: Colors.primary, marginTop: 2 },

  barTrack: { backgroundColor: Colors.backgroundElevated, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },

  statRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  statLabel: { fontSize: 13, fontFamily: Typography.fontFamily.medium, color: Colors.textSecondary },
  statValue: { fontSize: 13, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary },
  statSub: { fontSize: 10, fontFamily: Typography.fontFamily.medium, color: Colors.textTertiary, marginTop: 2, textAlign: 'right' },

  custGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  custCell: { alignItems: 'center', flex: 1 },
  custVal: { fontSize: 20, fontFamily: Typography.fontFamily.extraBold, color: Colors.textPrimary, marginBottom: 3 },
  custLabel: { fontSize: 10, fontFamily: Typography.fontFamily.medium, color: Colors.textTertiary },

  turfName: { fontSize: 14, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary },
  turfRev: { fontSize: 14, fontFamily: Typography.fontFamily.extraBold, color: Colors.primary },
  turfStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingBottom: 4 },
  turfStatItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  turfStatTxt: { fontSize: 11, fontFamily: Typography.fontFamily.medium, color: Colors.textTertiary },

  peakRow: { flexDirection: 'row', gap: 10 },
  peakItem: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.backgroundElevated, borderRadius: BorderRadius.md, padding: 12,
  },
  peakLabel: { fontSize: 10, fontFamily: Typography.fontFamily.medium, color: Colors.textTertiary },
  peakVal: { fontSize: 14, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary, marginTop: 2 },

  statusLabel: { fontSize: 12, fontFamily: Typography.fontFamily.medium, color: Colors.textSecondary, textTransform: 'capitalize' },
  statusVal: { fontSize: 12, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary },

  insightHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  insightIconWrap: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: Colors.primaryAlpha10, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: Colors.primaryAlpha30,
  },
  insightSub: { fontSize: 11, fontFamily: Typography.fontFamily.medium, color: Colors.textTertiary, marginTop: 1 },
  insightItem: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  insightDot: {
    width: 5, height: 5, borderRadius: 3,
    backgroundColor: Colors.primary, marginTop: 7, flexShrink: 0,
  },
  insightTxt: { fontSize: 13, fontFamily: Typography.fontFamily.medium, color: Colors.textSecondary, lineHeight: 20 },
  insightAction: {
    fontSize: 12, fontFamily: Typography.fontFamily.medium, color: Colors.textTertiary,
    lineHeight: 18, marginTop: 4, fontStyle: 'italic',
  },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  bottomSheet: {
    backgroundColor: Colors.backgroundCard,
    borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl,
    padding: 20,
  },
  sheetHandle: { width: 36, height: 3, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: 18 },
  sheetTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sheetTitle: { fontSize: 16, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary },
  sheetItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  sheetItemTxt: { fontSize: 14, fontFamily: Typography.fontFamily.medium, color: Colors.textSecondary },
  sheetItemTxtActive: { color: Colors.primary, fontFamily: Typography.fontFamily.bold },
});

export default OwnerAnalyticsScreen;
