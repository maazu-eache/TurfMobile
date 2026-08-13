import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Animated, ActivityIndicator, StatusBar, RefreshControl, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Colors, Typography, Spacing, BorderRadius } from '../../../theme/theme';
import { fetchOwnerAnalytics } from '../ownerSlice';
import { useDispatch, useSelector } from 'react-redux';
import { Modal } from 'react-native';

const { width: W } = Dimensions.get('window');

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

const SectionHeader = ({ icon, title, sub }) => (
  <View style={ss.sectionHeader}>
    <View style={ss.sectionIconWrap}>
      <Icon name={icon} size={20} color={Colors.primary} />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={ss.sectionTitle}>{title}</Text>
      {sub && <Text style={ss.sectionSub}>{sub}</Text>}
    </View>
  </View>
);

const ProgressBar60FPS = ({ pct, color, height = 12 }) => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(anim, {
      toValue: pct / 100,
      useNativeDriver: true,
      bounciness: 4
    }).start();
  }, [pct]);

  return (
    <View style={[ss.progressTrack, { height }]}>
      <Animated.View style={[
        StyleSheet.absoluteFill,
        { backgroundColor: color, transform: [{ scaleX: anim }, { translateX: -W / 2 }], transformOrigin: 'left' }
      ]} />
    </View>
  );
};

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

  useEffect(() => {
    fetchAnalytics();
  }, [dispatch, dateRange, selectedTurfId, customStart, customEnd]);

  const onRefresh = () => {
    fetchAnalytics();
  };

  const handleTurfSelect = (id) => {
    setSelectedTurfId(id);
    setTurfModalVisible(false);
  };

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

  const selectedTurfName = selectedTurfId === 'all' ? 'All Turfs' : ((turfs || []).find(t => t._id === selectedTurfId)?.name || 'Turf');

  // Chart max calc
  let maxChartVal = 100;
  if (revenueTrend && revenueTrend.length > 0) {
    maxChartVal = Math.max(...revenueTrend.map(d => d.onlineRev + d.offlineRev), 100);
  }

  return (
    <View style={ss.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.backgroundCard} />

      {/* ── Header ────────────────────────────────────────── */}
      <View style={[ss.header, { paddingTop: insets.top + 8 }]}>
        <View style={ss.headerRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.8}>
              <Icon name="arrow-left" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={ss.headerTitle}>Analytics</Text>
          </View>
          <TouchableOpacity style={ss.turfSelectorBtn} onPress={() => setTurfModalVisible(true)}>
            <Text style={ss.turfSelectorTxt} numberOfLines={1}>{selectedTurfName}</Text>
            <Icon name="chevron-down" size={16} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Date Filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={ss.dateFilterScroll}>
          {['today', 'week', 'month', 'year', 'all', 'custom'].map(r => (
            <TouchableOpacity key={r} style={[ss.dateFilterBtn, dateRange === r && ss.dateFilterBtnActive]} onPress={() => setDateRange(r)}>
              <Text style={[ss.dateFilterTxt, dateRange === r && ss.dateFilterTxtActive]}>
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        {dateRange === 'custom' && (
          <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: Spacing.xl, paddingBottom: 16, alignItems: 'center' }}>
            <TouchableOpacity style={[ss.dateFilterBtn, { flex: 1, alignItems: 'center' }]} onPress={() => setShowPicker('start')}>
              <Text style={ss.dateFilterTxt}>{formatDateIN(customStart)}</Text>
            </TouchableOpacity>
            <Text style={{ color: Colors.textSecondary }}>to</Text>
            <TouchableOpacity style={[ss.dateFilterBtn, { flex: 1, alignItems: 'center' }]} onPress={() => setShowPicker('end')}>
              <Text style={ss.dateFilterTxt}>{formatDateIN(customEnd)}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {isLoading && !hasData ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <ScrollView 
          contentContainerStyle={{ padding: Spacing.xl, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={onRefresh} tintColor={Colors.primary} />}
        >
          
          {/* 1. KPIs */}
          <View style={ss.kpiGrid}>
            <View style={ss.kpiCard}>
              <Icon name="cash-multiple" size={20} color={Colors.primary} style={ss.kpiIcon} />
              <Text style={ss.kpiVal}>{fmtK(kpis.totalRevenue || 0)}</Text>
              <Text style={ss.kpiLabel}>Total Revenue</Text>
            </View>
            <View style={ss.kpiCard}>
              <Icon name="calendar-check" size={20} color={Colors.info} style={ss.kpiIcon} />
              <Text style={ss.kpiVal}>{kpis.totalBookings || 0}</Text>
              <Text style={ss.kpiLabel}>Total Bookings</Text>
            </View>
            <View style={ss.kpiCard}>
              <Icon name="cellphone-link" size={20} color={Colors.success} style={ss.kpiIcon} />
              <Text style={ss.kpiVal}>{kpis.onlineBookings || 0}</Text>
              <Text style={ss.kpiLabel}>Online Bookings</Text>
            </View>
            <View style={ss.kpiCard}>
              <Icon name="store-outline" size={20} color={Colors.warning} style={ss.kpiIcon} />
              <Text style={ss.kpiVal}>{kpis.offlineBookings || 0}</Text>
              <Text style={ss.kpiLabel}>Offline Bookings</Text>
            </View>
            <View style={ss.kpiCard}>
              <Icon name="clock-outline" size={20} color={Colors.textSecondary} style={ss.kpiIcon} />
              <Text style={ss.kpiVal}>{kpis.hoursBooked || 0}h</Text>
              <Text style={ss.kpiLabel}>Hours Booked</Text>
            </View>
            <View style={ss.kpiCard}>
              <Icon name="percent" size={20} color={Colors.primary} style={ss.kpiIcon} />
              <Text style={ss.kpiVal}>{kpis.occupancyRate || 0}%</Text>
              <Text style={ss.kpiLabel}>Occupancy Rate</Text>
            </View>
          </View>

          {(!kpis.totalBookings && !kpis.totalRevenue) ? (
            <View style={{ marginTop: 60, alignItems: 'center' }}>
              <Icon name="chart-box-outline" size={48} color={Colors.textTertiary} />
              <Text style={{ marginTop: 12, fontSize: 16, fontFamily: Typography.fontFamily.medium, color: Colors.textSecondary }}>No data found for this period</Text>
            </View>
          ) : (
            <>


          {/* 3. BOOKING SOURCE */}
          <View style={ss.section}>
            <SectionHeader icon="chart-pie" title="Booking Source" sub="Online vs Offline breakdown" />
            <View style={ss.card}>
              <View style={ss.sourceRow}>
                <View style={{ flex: 1 }}>
                  <Text style={ss.sourceLabel}>Online</Text>
                  <Text style={ss.sourceVal}>{bookingSource.online || 0} Bookings</Text>
                  <Text style={[ss.sourcePct, { color: Colors.primary }]}>{bookingSource.onlinePct || 0}%</Text>
                </View>
                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                  <Text style={ss.sourceLabel}>Offline</Text>
                  <Text style={ss.sourceVal}>{bookingSource.offline || 0} Bookings</Text>
                  <Text style={[ss.sourcePct, { color: Colors.warning }]}>{bookingSource.offlinePct || 0}%</Text>
                </View>
              </View>
              <View style={ss.sourceBarWrap}>
                <View style={[ss.sourceBar, { backgroundColor: Colors.primary, flex: parseFloat(bookingSource.onlinePct || 0) || 1 }]} />
                <View style={[ss.sourceBar, { backgroundColor: Colors.warning, flex: parseFloat(bookingSource.offlinePct || 0) || 0 }]} />
              </View>
            </View>
          </View>

          {/* 4 & 5. TURF PERFORMANCE */}
          {turfPerformance.length > 0 && (
            <View style={ss.section}>
              <SectionHeader icon="stadium" title="Turf Performance" sub="Compare revenue and bookings" />
              {turfPerformance.map((t, i) => (
                <View key={i} style={[ss.card, { marginBottom: 12 }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                    <Text style={ss.turfName}>{t.turfName}</Text>
                    <Text style={ss.turfRev}>{fmtK(t.revenue)}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                    <View style={ss.turfStat}><Icon name="calendar-check" size={14} color={Colors.textTertiary}/><Text style={ss.turfStatTxt}>{t.bookings} Bkgs</Text></View>
                    <View style={ss.turfStat}><Icon name="clock-outline" size={14} color={Colors.textTertiary}/><Text style={ss.turfStatTxt}>{t.hours} Hrs</Text></View>
                    <View style={ss.turfStat}><Icon name="cellphone-link" size={14} color={Colors.primary}/><Text style={ss.turfStatTxt}>{t.online} On</Text></View>
                    <View style={ss.turfStat}><Icon name="store-outline" size={14} color={Colors.warning}/><Text style={ss.turfStatTxt}>{t.offline} Off</Text></View>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* 6. PEAK HOURS */}
          <View style={ss.section}>
            <SectionHeader icon="fire" title="Peak Hours" sub="Highest booking demand" />
            <View style={ss.card}>
              <Text style={ss.peakMainTxt}>Peak Day: <Text style={{ color: Colors.primary }}>{peakHours.peakDay}</Text></Text>
              <Text style={ss.peakMainTxt}>Peak Time: <Text style={{ color: Colors.primary }}>{peakHours.peakTime}</Text></Text>
              {peakHours.heatmap && peakHours.heatmap.length > 0 && (
                <View style={{ marginTop: 16 }}>
                  <Text style={ss.listHeader}>Top Time Slots</Text>
                  {peakHours.heatmap.map((h, i) => (
                    <View key={i} style={ss.listItemRow}>
                      <Text style={ss.listItemLabel}>{h.day}, {h.hour}</Text>
                      <Text style={ss.listItemVal}>{h.count} Bkgs</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>

          {/* 7. BOOKING STATUS */}
          <View style={ss.section}>
            <SectionHeader icon="list-status" title="Booking Status" sub="Completed, pending, and cancelled" />
            <View style={ss.card}>
              {bookingStatus.map((s, i) => (
                <View key={i} style={{ marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={ss.statusLabel}>{s.status.replace('_', ' ').toUpperCase()}</Text>
                    <Text style={ss.statusVal}>{s.count} ({s.pct}%)</Text>
                  </View>
                  <ProgressBar60FPS pct={s.pct} color={s.status.includes('cancel') ? Colors.error : (s.status.includes('complete') ? Colors.success : Colors.warning)} height={6} />
                </View>
              ))}
              <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 12 }}>
                <Text style={ss.cancellationTxt}>Overall Cancellation Rate: <Text style={{ color: Colors.error }}>{analytics?.cancellationRate || 0}%</Text></Text>
              </View>
            </View>
          </View>

          {/* 8. PAYMENT BREAKDOWN */}
          <View style={ss.section}>
            <SectionHeader icon="wallet-outline" title="Payment Breakdown" sub="Revenue by payment method" />
            <View style={ss.card}>
              {paymentBreakdown.map((p, i) => (
                <View key={i} style={ss.listItemRow}>
                  <Text style={[ss.listItemLabel, { textTransform: 'capitalize', color: Colors.textSecondary }]}>{p.method}</Text>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={ss.listItemVal}>{fmtK(p.revenue)}</Text>
                    {/* <Text style={ss.listItemSub}>{p.count} {p.count === 1 ? 'txn' : 'txns'} ({p.pct}%)</Text> */}
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* 9. CUSTOMER ANALYTICS */}
          <View style={ss.section}>
            <SectionHeader icon="account-group" title="Customer Analytics" sub="New vs Returning" />
            <View style={[ss.card, { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }]}>
              <View style={{ alignItems: 'center' }}>
                <Text style={ss.custVal}>{customerAnalytics.total || 0}</Text>
                <Text style={ss.custLabel}>Total</Text>
              </View>
              <View style={{ alignItems: 'center' }}>
                <Text style={[ss.custVal, { color: Colors.primary }]}>{customerAnalytics.new || 0}</Text>
                <Text style={ss.custLabel}>New</Text>
              </View>
              <View style={{ alignItems: 'center' }}>
                <Text style={[ss.custVal, { color: Colors.success }]}>{customerAnalytics.returning || 0}</Text>
                <Text style={ss.custLabel}>Returning</Text>
              </View>
              <View style={{ alignItems: 'center' }}>
                <Text style={ss.custVal}>{customerAnalytics.repeatRate || 0}%</Text>
                <Text style={ss.custLabel}>Repeat %</Text>
              </View>
            </View>
            {customerAnalytics.topCustomers && customerAnalytics.topCustomers.length > 0 && (
              <View style={ss.card}>
                <Text style={ss.listHeader}>Top Customers</Text>
                {customerAnalytics.topCustomers.map((c, i) => (
                  <View key={i} style={ss.listItemRow}>
                    <Text style={ss.listItemLabel}>{c.name}</Text>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={ss.listItemVal}>{fmtK(c.spent)}</Text>
                      <Text style={ss.listItemSub}>{c.bookings} bookings</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* 10. UTILIZATION */}
          <View style={ss.section}>
            <SectionHeader icon="chart-donut" title="Utilization" sub="Available vs Booked Hours" />
            <View style={ss.card}>
              <View style={ss.sourceRow}>
                <View style={{ flex: 1 }}>
                  <Text style={ss.sourceLabel}>Booked Hours</Text>
                  <Text style={ss.sourceVal}>{utilization.bookedHours || 0}h</Text>
                  <Text style={[ss.sourcePct, { color: Colors.primary }]}>{utilization.occupancyRate || 0}%</Text>
                </View>
                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                  <Text style={ss.sourceLabel}>Unused Hours</Text>
                  <Text style={ss.sourceVal}>{utilization.unusedHours || 0}h</Text>
                  <Text style={[ss.sourcePct, { color: Colors.textTertiary }]}>{100 - (utilization.occupancyRate || 0)}%</Text>
                </View>
              </View>
              <View style={ss.sourceBarWrap}>
                <View style={[ss.sourceBar, { backgroundColor: Colors.primary, flex: utilization.occupancyRate || 0 }]} />
                <View style={[ss.sourceBar, { backgroundColor: Colors.backgroundElevated, flex: 100 - (utilization.occupancyRate || 0) }]} />
              </View>
            </View>
          </View>

          {/* 11. BUSINESS INSIGHTS */}
          {insights.length > 0 && (
            <View style={ss.section}>
              <SectionHeader icon="lightbulb-on" title="Business Insights" sub="AI Generated summaries" />
              <View style={ss.card}>
                {insights.map((insight, i) => (
                  <View key={i} style={{ flexDirection: 'row', marginBottom: 12, gap: 10 }}>
                    <Icon name="check-circle" size={16} color={Colors.primary} style={{ marginTop: 2 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={ss.insightTxt}>{insight.text || insight}</Text>
                      {insight.action && (
                        <Text style={[ss.insightTxt, { color: Colors.textSecondary, marginTop: 4, fontSize: 13 }]}>
                          <Text style={{ color: Colors.info, fontWeight: 'bold' }}>How to improve: </Text>
                          {insight.action}
                        </Text>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            </View>
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
            const currentShowPicker = showPicker;
            setShowPicker(Platform.OS === 'ios' ? currentShowPicker : null);
            if (selectedDate) {
              if (currentShowPicker === 'start') setCustomStart(selectedDate);
              else setCustomEnd(selectedDate);
            }
          }}
        />
      )}

      {/* Turf Modal */}
      <Modal visible={turfModalVisible} transparent animationType="slide">
        <View style={ss.modalOverlay}>
          <TouchableOpacity style={ss.modalBgClose} onPress={() => setTurfModalVisible(false)} />
          <View style={[ss.bottomSheet, { paddingBottom: Math.max(insets.bottom + 20, 40) }]}>
            <View style={ss.sheetHandle} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={[ss.sheetTitle, { marginBottom: 0 }]}>Select Turf</Text>
              <TouchableOpacity onPress={() => setTurfModalVisible(false)} style={{ padding: 4 }}>
                <Icon name="close" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 300 }}>
              <TouchableOpacity style={ss.sheetItem} onPress={() => handleTurfSelect('all')}>
                <Text style={[ss.sheetItemTxt, selectedTurfId === 'all' && ss.sheetItemTxtActive]}>All Turfs</Text>
                {selectedTurfId === 'all' && <Icon name="check-circle" size={20} color={Colors.primary} />}
              </TouchableOpacity>
              {(turfs || []).map(t => (
                <TouchableOpacity key={t._id} style={ss.sheetItem} onPress={() => handleTurfSelect(t._id)}>
                  <Text style={[ss.sheetItemTxt, selectedTurfId === t._id && ss.sheetItemTxtActive]}>{t.name}</Text>
                  {selectedTurfId === t._id && <Icon name="check-circle" size={20} color={Colors.primary} />}
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

  // Header
  header: { backgroundColor: Colors.backgroundCard, borderBottomWidth: 1, borderBottomColor: Colors.border, zIndex: 10 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingHorizontal: Spacing.xl },
  headerTitle: { fontSize: Typography.fontSize.xl, fontFamily: Typography.fontFamily.extraBold, color: Colors.textPrimary },
  turfSelectorBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.backgroundElevated, paddingHorizontal: 12, paddingVertical: 6, borderRadius: BorderRadius.full, gap: 4, borderWidth: 1, borderColor: Colors.borderLight },
  turfSelectorTxt: { fontSize: 13, fontFamily: Typography.fontFamily.bold, color: Colors.primary, maxWidth: 120 },

  // Date Filter
  dateFilterScroll: { paddingHorizontal: Spacing.xl, paddingBottom: 16, gap: 8 },
  dateFilterBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: BorderRadius.full, backgroundColor: Colors.backgroundElevated, borderWidth: 1, borderColor: Colors.border },
  dateFilterBtnActive: { backgroundColor: Colors.primaryAlpha10, borderColor: Colors.primary },
  dateFilterTxt: { fontSize: 13, fontFamily: Typography.fontFamily.medium, color: Colors.textSecondary },
  dateFilterTxtActive: { color: Colors.primary, fontFamily: Typography.fontFamily.bold },

  // Common Sections
  section: { marginBottom: 32 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  sectionIconWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primaryAlpha10, justifyContent: 'center', alignItems: 'center' },
  sectionTitle: { fontSize: Typography.fontSize.lg, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary },
  sectionSub: { fontSize: 12, fontFamily: Typography.fontFamily.medium, color: Colors.textTertiary, marginTop: 2 },
  card: { backgroundColor: Colors.backgroundCard, borderRadius: BorderRadius.xl, padding: Spacing.xl, borderWidth: 1, borderColor: Colors.border },

  // KPI Grid
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 32 },
  kpiCard: { width: (W - Spacing.xl * 2 - 12) / 2, backgroundColor: Colors.backgroundCard, borderRadius: BorderRadius.lg, padding: 16, borderWidth: 1, borderColor: Colors.border },
  kpiIcon: { marginBottom: 8 },
  kpiVal: { fontSize: Typography.fontSize.xl, fontFamily: Typography.fontFamily.extraBold, color: Colors.textPrimary, marginBottom: 4 },
  kpiLabel: { fontSize: 11, fontFamily: Typography.fontFamily.medium, color: Colors.textSecondary },

  // Progress
  progressTrack: { backgroundColor: Colors.backgroundElevated, borderRadius: 6, overflow: 'hidden' },

  // Chart
  chartRow: { flexDirection: 'row', alignItems: 'flex-end', height: 150, gap: 16, marginTop: 10 },
  chartCol: { alignItems: 'center', width: 40 },
  chartBars: { flex: 1, justifyContent: 'flex-end', width: 12 },
  chartBar: { width: 12, borderRadius: 4 },
  chartLabel: { fontSize: 9, fontFamily: Typography.fontFamily.medium, color: Colors.textTertiary, marginTop: 8 },
  legend: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: Colors.borderLight },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendTxt: { fontSize: 11, fontFamily: Typography.fontFamily.medium, color: Colors.textSecondary },

  // Booking Source
  sourceRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  sourceLabel: { fontSize: 12, fontFamily: Typography.fontFamily.medium, color: Colors.textSecondary, marginBottom: 4 },
  sourceVal: { fontSize: 16, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary, marginBottom: 4 },
  sourcePct: { fontSize: Typography.fontSize.xl, fontFamily: Typography.fontFamily.extraBold },
  sourceBarWrap: { flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden', gap: 2 },
  sourceBar: { height: '100%' },

  // Turf Performance
  turfName: { fontSize: 15, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary },
  turfRev: { fontSize: 15, fontFamily: Typography.fontFamily.extraBold, color: Colors.primary },
  turfStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  turfStatTxt: { fontSize: 12, fontFamily: Typography.fontFamily.medium, color: Colors.textSecondary },

  // Peak Hours
  peakMainTxt: { fontSize: 15, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary, marginBottom: 6 },
  listHeader: { fontSize: 13, fontFamily: Typography.fontFamily.bold, color: Colors.textTertiary, textTransform: 'uppercase', marginBottom: 12, letterSpacing: 0.5 },
  listItemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  listItemLabel: { fontSize: 14, fontFamily: Typography.fontFamily.medium, color: Colors.textPrimary },
  listItemVal: { fontSize: 14, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary },
  listItemSub: { fontSize: 11, fontFamily: Typography.fontFamily.medium, color: Colors.textSecondary, marginTop: 2 },

  // Status
  statusLabel: { fontSize: 12, fontFamily: Typography.fontFamily.bold, color: Colors.textSecondary },
  statusVal: { fontSize: 12, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary },
  cancellationTxt: { fontSize: 13, fontFamily: Typography.fontFamily.bold, color: Colors.textSecondary },

  // Customers
  custVal: { fontSize: 18, fontFamily: Typography.fontFamily.extraBold, color: Colors.textPrimary, marginBottom: 4 },
  custLabel: { fontSize: 11, fontFamily: Typography.fontFamily.medium, color: Colors.textTertiary },

  // Insights
  insightTxt: { fontSize: 13, fontFamily: Typography.fontFamily.medium, color: Colors.textSecondary, flex: 1, lineHeight: 20 },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBgClose: { ...StyleSheet.absoluteFillObject },
  bottomSheet: { backgroundColor: Colors.backgroundCard, borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl, padding: Spacing.xl },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: 16 },
  sheetTitle: { fontSize: Typography.fontSize.lg, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary, marginBottom: 16 },
  sheetItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  sheetItemTxt: { fontSize: 14, fontFamily: Typography.fontFamily.medium, color: Colors.textSecondary },
  sheetItemTxtActive: { color: Colors.primary, fontFamily: Typography.fontFamily.bold },
});

export default OwnerAnalyticsScreen;
