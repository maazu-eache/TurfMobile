import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Modal,
  Animated,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { fetchOwnerAnalytics } from '../ownerSlice';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../../theme/theme';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from '../../../components/SolidGradient';
import { showCustomAlert } from '../../../components/CustomAlert';

const { width: W } = Dimensions.get('window');
const CHART_H = 140;

// ── Helpers ───────────────────────────────────────────────────────────────────
const toISO = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};

const fmtDisplay = (iso) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${parseInt(d)} ${MONTHS[parseInt(m) - 1]} ${y}`;
};

const fmtK = (n) => {
  if (!n) return '₹0';
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}k`;
  return `₹${n}`;
};

const RANGES = [
  { id: 'today', label: 'Today', icon: 'calendar-today' },
  { id: 'week', label: 'Week', icon: 'calendar-week' },
  { id: 'month', label: 'Month', icon: 'calendar-month' },
  { id: 'year', label: 'Year', icon: 'calendar' },
  { id: 'overall', label: 'All', icon: 'infinity' },
  { id: 'custom', label: 'Custom', icon: 'calendar-range' },
];

const SPORTS = [
  { id: 'all', label: 'All Sports' },
  { id: 'cricket', label: 'Cricket' },
  { id: 'football', label: 'Football' },
  { id: 'badminton', label: 'Badminton' },
];

// ── Reusable Component: Section Header ────────────────────────────────────────
const SectionHeader = ({ icon, title, sub }) => (
  <View style={ss.sectionHdr}>
    <View style={ss.sectionIconBg}>
      <Icon name={icon} size={15} color={Colors.primary} />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={ss.sectionTitle}>{title}</Text>
      {sub && <Text style={ss.sectionSub}>{sub}</Text>}
    </View>
  </View>
);

// ── Reusable Component: KPI Card ─────────────────────────────────────────────
const KPICard = ({ label, value, sub, icon, trend, trendUp, accent = Colors.primary }) => (
  <View style={ss.kpiCard}>
    <View style={ss.kpiHeader}>
      <View style={[ss.kpiIcon, { backgroundColor: accent + '1A' }]}>
        <Icon name={icon} size={18} color={accent} />
      </View>
      {trend !== undefined && (
        <View style={[ss.kpiTrend, { backgroundColor: trendUp ? Colors.successLight : Colors.errorLight }]}>
          <Icon name={trendUp ? 'trending-up' : 'trending-down'} size={10} color={trendUp ? Colors.success : Colors.error} />
          <Text style={[ss.kpiTrendTxt, { color: trendUp ? Colors.success : Colors.error }]}>{trend}</Text>
        </View>
      )}
    </View>
    <Text style={ss.kpiValue}>{value}</Text>
    <Text style={ss.kpiLabel}>{label}</Text>
    {sub && <Text style={ss.kpiSub}>{sub}</Text>}
  </View>
);

// ── Reusable Component: Progress Bar ──────────────────────────────────────────
const ProgressBar = ({ pct, color = Colors.primary, height = 6 }) => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: pct / 100, duration: 850, useNativeDriver: false }).start();
  }, [pct]);
  const w = anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  return (
    <View style={[ss.progressTrack, { height }]}>
      <Animated.View style={[ss.progressFill, { width: w, backgroundColor: color, borderRadius: height }]} />
    </View>
  );
};

// ── Donut Progress Ring ───────────────────────────────────────────────────────
const DonutProgress = ({ pct, color = Colors.primary, size = 90, label, sub }) => {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', width: size, height: size }}>
      <View style={{
        width: size, height: size, borderRadius: size / 2,
        borderWidth: 8, borderColor: Colors.backgroundElevated,
        position: 'absolute'
      }} />
      <View style={{
        width: size, height: size, borderRadius: size / 2,
        borderWidth: 8, borderColor: 'transparent',
        borderTopColor: color,
        borderRightColor: pct > 25 ? color : 'transparent',
        borderBottomColor: pct > 50 ? color : 'transparent',
        borderLeftColor: pct > 75 ? color : 'transparent',
        transform: [{ rotate: '-45deg' }],
        position: 'absolute'
      }} />
      <View style={{ alignItems: 'center' }}>
        <Text style={ss.donutVal}>{pct}%</Text>
        <Text style={ss.donutLbl}>{label}</Text>
      </View>
    </View>
  );
};

// ── Simple Date Spinner ───────────────────────────────────────────────────────
const SimpleDatePicker = ({ value, onConfirm, onCancel }) => {
  const today = new Date();
  const parsed = value ? new Date(value + 'T00:00:00') : today;
  const [year, setYear] = useState(parsed.getFullYear());
  const [month, setMonth] = useState(parsed.getMonth() + 1);
  const [day, setDay] = useState(parsed.getDate());

  const MONTHS_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const daysInMonth = new Date(year, month, 0).getDate();
  const safeDay = Math.min(day, daysInMonth);

  const adj = (setter, val, min, max) => setter(v => {
    let n = v + val;
    if (n < min) n = max;
    if (n > max) n = min;
    return n;
  });

  const confirm = () => {
    const d = Math.min(safeDay, new Date(year, month, 0).getDate());
    onConfirm(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  };

  const Spinner = ({ label, value: val, onUp, onDown }) => (
    <View style={ss.spinnerCol}>
      <TouchableOpacity onPress={onUp} style={ss.arrow}><Icon name="chevron-up" size={24} color={Colors.primary} /></TouchableOpacity>
      <Text style={ss.spinnerVal}>{String(val).padStart(2, '0')}</Text>
      <TouchableOpacity onPress={onDown} style={ss.arrow}><Icon name="chevron-down" size={24} color={Colors.primary} /></TouchableOpacity>
      <Text style={ss.spinnerLbl}>{label}</Text>
    </View>
  );

  return (
    <View style={ss.datePicker}>
      <Text style={ss.datePickerTitle}>Select Date</Text>
      <View style={ss.spinnerRow}>
        <Spinner label="Day" value={safeDay} onUp={() => adj(setDay, 1, 1, daysInMonth)} onDown={() => adj(setDay, -1, 1, daysInMonth)} />
        <Spinner label="Month" value={month} onUp={() => adj(setMonth, 1, 1, 12)} onDown={() => adj(setMonth, -1, 1, 12)} />
        <Spinner label="Year" value={year} onUp={() => adj(setYear, 1, 2020, today.getFullYear())} onDown={() => adj(setYear, -1, 2020, today.getFullYear())} />
      </View>
      <Text style={ss.datePickerPreview}>{MONTHS_FULL[month - 1]} {safeDay}, {year}</Text>
      <View style={ss.datePickerBtnRow}>
        <TouchableOpacity style={ss.datePickerCancel} onPress={onCancel}><Text style={ss.datePickerCancelTxt}>Cancel</Text></TouchableOpacity>
        <TouchableOpacity style={ss.datePickerConfirm} onPress={confirm}><Text style={ss.datePickerConfirmTxt}>Confirm</Text></TouchableOpacity>
      </View>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────
const OwnerAnalyticsScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();
  const { analytics, isLoading } = useSelector((s) => s.owner);

  const [range, setRange] = useState('overall');
  const [sportFilter, setSportFilter] = useState('all');
  const [courtFilter, setCourtFilter] = useState('all');

  const today = toISO(new Date());
  const [customStart, setCustomStart] = useState(today);
  const [customEnd, setCustomEnd] = useState(today);
  const [pickingDate, setPickingDate] = useState(null);

  const loadData = useCallback((r, cs, ce) => {
    const params = { range: r };
    if (r === 'custom') {
      if (!cs || !ce) return;
      params.startDate = cs;
      params.endDate = ce;
    }
    dispatch(fetchOwnerAnalytics(params));
  }, [dispatch]);

  useEffect(() => {
    loadData('overall');
  }, []);

  const handleRangeSelect = (id) => {
    setRange(id);
    if (id !== 'custom') {
      loadData(id);
    }
  };

  const handleApplyCustom = () => {
    if (customStart > customEnd) {
      showCustomAlert('Invalid Range', 'Start date cannot be after end date.');
      return;
    }
    loadData('custom', customStart, customEnd);
  };

  // ── Derived Data ───────────────────────────────────────────────────────────
  const hasData = analytics?.labels?.length > 0;
  const onlineRev = hasData ? analytics.revenueData.online : [];
  const offlineRev = hasData ? analytics.revenueData.offline : [];
  const onlineB = hasData ? analytics.bookingsData.online : [];
  const offlineB = hasData ? analytics.bookingsData.offline : [];
  const labels = hasData ? analytics.labels : [];

  const totalOn = onlineRev.reduce((s, v) => s + v, 0);
  const totalOff = offlineRev.reduce((s, v) => s + v, 0);
  const totalRev = totalOn + totalOff;
  const totalBks = [...onlineB, ...offlineB].reduce((s, v) => s + v, 0);
  const onPct = totalRev > 0 ? Math.round((totalOn / totalRev) * 100) : 0;
  const avgBookingValue = totalBks > 0 ? Math.round(totalRev / totalBks) : 0;

  const perDay = labels.map((_, i) => onlineRev[i] + offlineRev[i]);
  const topIdx = perDay.indexOf(Math.max(...perDay, 0));

  // Bind live MongoDB analytics calculations from backend
  const overallOccupancy = hasData && analytics.occupancy ? analytics.occupancy.overall : 0;
  const weekdayOccupancy = hasData && analytics.occupancy ? analytics.occupancy.weekday : 0;
  const weekendOccupancy = hasData && analytics.occupancy ? analytics.occupancy.weekend : 0;

  const peakHours = hasData && analytics.peakHours ? analytics.peakHours : [];
  const turfPerformance = hasData && analytics.turfPerformance ? analytics.turfPerformance : [];
  const loyalty = hasData && analytics.customerLoyalty ? analytics.customerLoyalty : { newCount: 0, returningCount: 0, repeatRate: 0 };
  const payments = hasData && analytics.payments ? analytics.payments : { upiPct: 0, cashPct: 0 };
  const risk = hasData && analytics.risk ? analytics.risk : { cancellationRate: '0.0', avgLeadTimeHours: 0 };
  const dailyLogs = hasData && analytics.dailyLogs ? analytics.dailyLogs : [];

  let topLogIdx = 0;
  if (dailyLogs.length > 0) {
    dailyLogs.forEach((log, i) => {
      if ((log.onlineRev + log.offlineRev) > (dailyLogs[topLogIdx].onlineRev + dailyLogs[topLogIdx].offlineRev)) {
        topLogIdx = i;
      }
    });
  }



  return (
    <View style={ss.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.backgroundCard} />

      {/* ── Sticky Top Filter Bar ────────────────────────────────────────── */}
      <View style={[ss.header, { paddingTop: insets.top + 8 }]}>
        <View style={ss.headerRow}>
          <Text style={ss.headerTitle}>Business Analytics</Text>
          {isLoading && <View style={ss.loadingIndicator} />}
        </View>

        {/* Date Ranges Tabs */}
        <View style={ss.tabContainer}>
          {RANGES.map(({ id, label }) => {
            const active = range === id;
            return (
              <TouchableOpacity
                key={id}
                style={[ss.tabButton, active && ss.tabButtonActive]}
                onPress={() => handleRangeSelect(id)}
                activeOpacity={0.8}
              >
                <Text style={[ss.tabText, active && ss.tabTextActive]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Custom date selectors */}
        {range === 'custom' && (
          <View style={ss.customRangeRow}>
            <TouchableOpacity style={ss.datePill} onPress={() => setPickingDate('start')}>
              <Icon name="calendar-start" size={14} color={Colors.primary} />
              <Text style={ss.datePillTxt}>{fmtDisplay(customStart)}</Text>
            </TouchableOpacity>
            <Icon name="arrow-right" size={14} color={Colors.textTertiary} />
            <TouchableOpacity style={ss.datePill} onPress={() => setPickingDate('end')}>
              <Icon name="calendar-end" size={14} color={Colors.primary} />
              <Text style={ss.datePillTxt}>{fmtDisplay(customEnd)}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={ss.applyBtn} onPress={handleApplyCustom}>
              <Text style={ss.applyTxt}>Apply</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* ── Custom Date Picker Modal ──────────────────────────────────────── */}
      <Modal visible={!!pickingDate} transparent animationType="fade">
        <View style={ss.modalOverlay}>
          <SimpleDatePicker
            value={pickingDate === 'start' ? customStart : customEnd}
            onConfirm={(iso) => {
              if (pickingDate === 'start') setCustomStart(iso);
              else setCustomEnd(iso);
              setPickingDate(null);
            }}
            onCancel={() => setPickingDate(null)}
          />
        </View>
      </Modal>

      {/* ── Scroll Content ────────────────────────────────────────────────── */}
      <ScrollView contentContainerStyle={ss.scroll} showsVerticalScrollIndicator={false}>
        {!hasData ? (
          <View style={ss.emptyState}>
            <View style={ss.emptyIconBg}>
              <Icon name="chart-bell-curve-cumulative" size={48} color={Colors.primary} />
            </View>
            <Text style={ss.emptyTitle}>No Insights Available</Text>
            <Text style={ss.emptySub}>We couldn't find any transaction history for the selected date range. Try selecting another filter or checking back later.</Text>
          </View>
        ) : (
          <>
            {/* ── Business Overview KPIs ────────────────────────────────────── */}
            <View style={ss.kpiStrip}>
              <KPICard label="Total Revenue" value={fmtK(totalRev)} trend="+18.4%" trendUp={true} icon="cash-multiple" accent={Colors.primary} />
              <KPICard label="Average Booking Value" value={fmtK(avgBookingValue)} trend="+2.1%" trendUp={true} icon="calculator" accent="#2196F3" />
              <KPICard label="Total Bookings Made" value={String(totalBks)} trend="-4.5%" trendUp={false} icon="ticket-confirmation" accent="#A78BFA" />
            </View>



            {/* ── Revenue Performance & Forecast ────────────────────────────── */}
            <View style={ss.section}>
              <SectionHeader icon="trending-up" title="Revenue & Forecast" sub="Revenue and 30-day growth projection" />
              <View style={ss.card}>
                {/* Revenue breakdown summary */}
                <View style={ss.revBreakdown}>
                  <View style={ss.revCol}>
                    <Text style={ss.revVal}>{fmtK(totalRev)}</Text>
                    <Text style={ss.revLbl}>Total Revenue</Text>
                  </View>
                  <View style={ss.divider} />
                  <View style={ss.revCol}>
                    <Text style={[ss.revVal, { color: '#2196F3' }]}>{fmtK(Math.round(totalRev * 1.15))}</Text>
                    <Text style={ss.revLbl}>Forecast (30 Days)</Text>
                  </View>
                </View>

                {/* Graph Visualization */}
                <View style={ss.chartContainer}>
                  <View style={ss.chartBars}>
                    {labels.map((_, i) => {
                      const total = onlineRev[i] + offlineRev[i];
                      const maxVal = Math.max(...perDay, 1);
                      const barH = Math.max(4, (total / maxVal) * 90);
                      const isTop = i === topIdx;
                      return (
                        <View key={i} style={ss.barCol}>
                          <View style={[ss.barFilled, { height: barH, backgroundColor: isTop ? Colors.primary : Colors.primary + '55' }]} />
                        </View>
                      );
                    })}
                  </View>
                  <View style={ss.xAxis}>
                    {labels.map((lbl, i) => {
                      const show = labels.length <= 7 || i === 0 || i === Math.floor(labels.length / 2) || i === labels.length - 1;
                      return <Text key={i} style={[ss.axisText, { opacity: show ? 0.7 : 0 }]}>{show ? lbl : ''}</Text>;
                    })}
                  </View>
                </View>
              </View>
            </View>

            {/* ── Occupancy & Peak Slot Analysis ───────────────────────────── */}
            <View style={ss.section}>
              <SectionHeader icon="clock-outline" title="Occupancy & Slot Utilisation" sub="Busiest hours and weekday vs weekend metrics" />
              <View style={ss.card}>
                <View style={ss.occupancyRow}>
                  <DonutProgress pct={overallOccupancy} color={Colors.primary} label="Occupancy" />
                  <View style={{ flex: 1, gap: 10 }}>
                    <View style={ss.slotDetail}>
                      <Text style={ss.slotText}>Weekday Occupancy</Text>
                      <Text style={ss.slotVal}>{weekdayOccupancy}%</Text>
                    </View>
                    <ProgressBar pct={weekdayOccupancy} color={Colors.primary} />

                    <View style={ss.slotDetail}>
                      <Text style={ss.slotText}>Weekend Occupancy</Text>
                      <Text style={ss.slotVal}>{weekendOccupancy}%</Text>
                    </View>
                    <ProgressBar pct={weekendOccupancy} color={Colors.success} />
                  </View>
                </View>
              </View>
            </View>

            {/* ── Sport & Court-wise Split ──────────────────────────────────── */}
            <View style={ss.section}>
              <SectionHeader icon="shape" title="Product Performance" sub="Court bookings and revenue split" />
              <View style={ss.card}>
                <View style={{ gap: 12 }}>
                  {turfPerformance.map((tp, idx) => {
                    const sharePct = totalRev > 0 ? Math.round((tp.revenue / totalRev) * 100) : 0;
                    const colors = [Colors.primary, '#2196F3', '#A78BFA', Colors.success, Colors.warning];
                    const color = colors[idx % colors.length];
                    return (
                      <View key={idx} style={ss.progressItem}>
                        <View style={ss.progressInfo}>
                          <Text style={ss.progressLabel}>{tp.name} ({tp.bookings} bkgs)</Text>
                          <Text style={ss.progressVal}>{fmtK(tp.revenue)} ({sharePct}%)</Text>
                        </View>
                        <ProgressBar pct={sharePct} color={color} />
                      </View>
                    );
                  })}
                  {turfPerformance.length === 0 && (
                    <Text style={{ color: Colors.textTertiary, fontSize: 12, textAlign: 'center' }}>No court performance logs available.</Text>
                  )}
                </View>
              </View>
            </View>

            {/* ── Customer Retention & Growth ───────────────────────────────── */}
            <View style={ss.section}>
              <SectionHeader icon="account-group" title="Customer Loyalty" sub="Retention rate, new acquisitions and average spends" />
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={[ss.card, { flex: 1, alignItems: 'center', padding: 16 }]}>
                  <View style={[ss.roundIcon, { backgroundColor: Colors.primaryAlpha10 }]}><Icon name="account-multiple-plus" size={20} color={Colors.primary} /></View>
                  <Text style={ss.cardHeading}>{loyalty.newCount}</Text>
                  <Text style={ss.cardSubHeading}>New customer bookings</Text>
                </View>

                <View style={[ss.card, { flex: 1, alignItems: 'center', padding: 16 }]}>
                  <View style={[ss.roundIcon, { backgroundColor: 'rgba(76,175,80,0.1)' }]}><Icon name="account-convert" size={20} color={Colors.success} /></View>
                  <Text style={[ss.cardHeading, { color: Colors.success }]}>{loyalty.returningCount}</Text>
                  <Text style={ss.cardSubHeading}>Returning customer bookings</Text>
                </View>
              </View>
              <View style={[ss.card, { marginTop: 12 }]}>
                <View style={ss.slotDetail}>
                  <Text style={ss.slotText}>Repeat Customer Share</Text>
                  <Text style={ss.slotVal}>{loyalty.repeatRate}%</Text>
                </View>
                <ProgressBar pct={loyalty.repeatRate} color={Colors.primary} height={8} />
                <Text style={[ss.slotText, { marginTop: 8, color: Colors.textTertiary, fontSize: 10 }]}>Average Spend per Booking: {fmtK(avgBookingValue)}</Text>
              </View>
            </View>

            {/* ── Payments & Cancellation Risk ─────────────────────────────── */}
            <View style={ss.section}>
              <SectionHeader icon="shield-alert" title="Payment Risks & Cancellations" sub="Cancellations and average slot booking lead times" />
              <View style={ss.card}>
                <View style={ss.riskRow}>
                  <View style={ss.riskItem}>
                    <Text style={ss.riskLabel}>Cancellation Rate</Text>
                    <Text style={[ss.riskVal, { color: Colors.error }]}>{risk.cancellationRate}%</Text>
                  </View>
                  <View style={ss.divider} />
                  <View style={ss.riskItem}>
                    <Text style={ss.riskLabel}>Average Lead Time</Text>
                    <Text style={ss.riskVal}>{risk.avgLeadTimeHours} Hrs</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* ── Daily Breakdown Table ─────────────────────────────────────── */}
            <View style={ss.section}>
              <SectionHeader icon="file-table" title="Day-by-Day Breakdown" sub="Daily performance audit logs" />
              <View style={ss.table}>
                <View style={ss.tableHeader}>
                  <Text style={[ss.tableHdrText, { flex: 1.2 }]}>Date</Text>
                  <Text style={[ss.tableHdrText, { flex: 2, textAlign: 'center' }]}>Revenue</Text>
                  <Text style={[ss.tableHdrText, { flex: 1, textAlign: 'right' }]}>Bookings</Text>
                </View>
                {dailyLogs.length === 0 && <Text style={{ padding: 16, textAlign: 'center', color: Colors.textTertiary }}>No recent activity.</Text>}
                {dailyLogs.map((log, i) => {
                  const total = log.onlineRev + log.offlineRev;
                  const bookingsCount = log.onlineBkgs + log.offlineBkgs;
                  const isTop = i === topLogIdx && total > 0;
                  return (
                    <View key={i} style={[ss.tableRow, isTop && ss.tableRowActive, i === dailyLogs.length - 1 && { borderBottomWidth: 0 }]}>
                      <View style={{ flex: 1.2, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        {isTop && <Icon name="crown" size={10} color={Colors.primary} />}
                        <Text style={[ss.tableRowLabel, isTop && { color: Colors.primary }]} numberOfLines={1}>{log.label}</Text>
                      </View>
                      <View style={{ flex: 2, alignItems: 'center' }}>
                        <Text style={ss.tableRowVal}>{fmtK(total)}</Text>
                        {total > 0 && (
                          <Text style={ss.tableRowSubVal}>
                            <Text style={{ color: Colors.primary }}>{fmtK(log.onlineRev)}</Text>
                            {'  |  '}
                            <Text style={{ color: Colors.warning }}>{fmtK(log.offlineRev)}</Text>
                          </Text>
                        )}
                      </View>
                      <Text style={[ss.tableRowBookings, { flex: 1 }]}>{bookingsCount || '—'}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
const ss = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  // Sticky Filter Bar
  header: {
    backgroundColor: Colors.backgroundCard,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    zIndex: 10,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  headerTitle: { fontSize: Typography.fontSize.xl, fontFamily: Typography.fontFamily.extraBold, color: Colors.textPrimary },
  loadingIndicator: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.primary },
  tabContainer: {
    flexDirection: 'row',
    marginTop: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabButtonActive: {
    borderBottomColor: Colors.primary,
  },
  tabText: {
    fontSize: 13,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.textTertiary,
  },
  tabTextActive: {
    color: Colors.primary,
    fontFamily: Typography.fontFamily.bold,
  },

  customRangeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  datePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.backgroundElevated,
    borderRadius: BorderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  datePillTxt: { fontSize: 12, fontFamily: Typography.fontFamily.medium, color: Colors.textPrimary },
  applyBtn: { backgroundColor: Colors.primary, borderRadius: BorderRadius.md, paddingHorizontal: 16, paddingVertical: 8 },
  applyTxt: { color: '#000', fontFamily: Typography.fontFamily.bold, fontSize: 12 },

  // Scroll Container
  scroll: { paddingTop: Spacing.xl, paddingBottom: 60 },

  // KPI Cards horizontal strip
  kpiStrip: { flexDirection: 'row', gap: 12, paddingHorizontal: Spacing.xl, marginBottom: Spacing.xl },
  kpiCard: {
    flex: 1,
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 110,
    justifyContent: 'center',
  },
  kpiHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  kpiIcon: { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  kpiValue: { fontSize: Typography.fontSize.lg, fontFamily: Typography.fontFamily.extraBold, color: Colors.textPrimary },
  kpiLabel: { fontSize: 10, fontFamily: Typography.fontFamily.medium, color: Colors.textSecondary, marginTop: 2 },
  kpiSub: { fontSize: 9, fontFamily: Typography.fontFamily.regular, color: Colors.textTertiary, marginTop: 2 },
  kpiTrend: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 6, paddingVertical: 2, borderRadius: BorderRadius.sm },
  kpiTrendTxt: { fontSize: 8, fontFamily: Typography.fontFamily.bold },

  // Section Headers
  section: { paddingHorizontal: Spacing.xl, marginBottom: Spacing.xl },
  sectionHdr: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: Spacing.md },
  sectionIconBg: { width: 28, height: 28, borderRadius: 8, backgroundColor: Colors.primaryAlpha10, justifyContent: 'center', alignItems: 'center' },
  sectionTitle: { fontSize: Typography.fontSize.md, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary },
  sectionSub: { fontSize: 11, fontFamily: Typography.fontFamily.regular, color: Colors.textTertiary },

  // Common Card Wrapper
  card: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  // AI Insights
  insightRow: { flexDirection: 'row', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  insightBullet: { width: 6, height: 6, borderRadius: 3, marginTop: 6 },
  insightText: { flex: 1, fontSize: 12, fontFamily: Typography.fontFamily.regular, color: Colors.textSecondary, lineHeight: 18 },

  // Revenue Details
  revBreakdown: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  revCol: { flex: 1, alignItems: 'center' },
  revVal: { fontSize: Typography.fontSize.md, fontFamily: Typography.fontFamily.extraBold, color: Colors.textPrimary },
  revLbl: { fontSize: 9, fontFamily: Typography.fontFamily.medium, color: Colors.textTertiary, marginTop: 2 },
  divider: { width: 1, height: 32, backgroundColor: Colors.border },

  // Charts
  chartContainer: { marginTop: 12 },
  chartBars: { flexDirection: 'row', alignItems: 'flex-end', height: 90, gap: 5 },
  barCol: { flex: 1, alignItems: 'center' },
  barFilled: { width: '80%', borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  xAxis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  axisText: { fontSize: 9, fontFamily: Typography.fontFamily.regular, color: Colors.textTertiary },

  // Occupancy details
  occupancyRow: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  donutVal: { fontSize: 18, fontFamily: Typography.fontFamily.extraBold, color: Colors.textPrimary },
  donutLbl: { fontSize: 9, fontFamily: Typography.fontFamily.medium, color: Colors.textTertiary },
  slotDetail: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  slotText: { fontSize: 11, fontFamily: Typography.fontFamily.medium, color: Colors.textSecondary },
  slotVal: { fontSize: 11, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary },

  // Retentions
  roundIcon: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  cardHeading: { fontSize: Typography.fontSize.lg, fontFamily: Typography.fontFamily.extraBold, color: Colors.textPrimary },
  cardSubHeading: { fontSize: 10, fontFamily: Typography.fontFamily.medium, color: Colors.textTertiary, marginTop: 2, textAlign: 'center' },

  // Product Split
  progressItem: { marginBottom: 12 },
  progressInfo: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressLabel: { fontSize: 11, fontFamily: Typography.fontFamily.medium, color: Colors.textSecondary },
  progressVal: { fontSize: 11, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary },
  progressTrack: { backgroundColor: Colors.backgroundElevated, borderRadius: 6, overflow: 'hidden' },
  progressFill: { height: '100%' },

  // Risks
  riskRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  riskItem: { flex: 1, alignItems: 'center' },
  riskLabel: { fontSize: 9, fontFamily: Typography.fontFamily.medium, color: Colors.textTertiary },
  riskVal: { fontSize: 14, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary, marginTop: 4 },

  // Table
  table: { backgroundColor: Colors.backgroundCard, borderRadius: BorderRadius.xl, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  tableHeader: { flexDirection: 'row', paddingHorizontal: Spacing.md, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.backgroundElevated },
  tableHdrText: { fontSize: 10, fontFamily: Typography.fontFamily.bold, color: Colors.textTertiary, textTransform: 'uppercase' },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  tableRowActive: { backgroundColor: Colors.primaryAlpha10 },
  tableRowLabel: { fontSize: 11, fontFamily: Typography.fontFamily.medium, color: Colors.textSecondary },
  tableRowVal: { fontSize: 12, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary },
  tableRowSubVal: { fontSize: 8, fontFamily: Typography.fontFamily.regular, color: Colors.textTertiary, marginTop: 1 },
  tableRowBookings: { fontSize: 11, fontFamily: Typography.fontFamily.bold, color: Colors.textSecondary, textAlign: 'right' },

  // Empty State
  emptyState: { paddingHorizontal: Spacing.xl, alignItems: 'center', marginTop: 80 },
  emptyIconBg: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.primaryAlpha10, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 16, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary, marginBottom: 8 },
  emptySub: { fontSize: 13, fontFamily: Typography.fontFamily.regular, color: Colors.textSecondary, textAlign: 'center', lineHeight: 18 },

  // Modals / Datepickers
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  datePicker: { backgroundColor: Colors.backgroundCard, borderRadius: BorderRadius.xl, padding: Spacing.xl, width: '100%', borderWidth: 1, borderColor: Colors.border },
  datePickerTitle: { fontSize: Typography.fontSize.md, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary, textAlign: 'center', marginBottom: 12 },
  spinnerRow: { flexDirection: 'row', justifyContent: 'space-around' },
  spinnerCol: { alignItems: 'center' },
  spinnerVal: { fontSize: 22, fontFamily: Typography.fontFamily.extraBold, color: Colors.textPrimary, minWidth: 50, textAlign: 'center' },
  spinnerLbl: { fontSize: 10, fontFamily: Typography.fontFamily.medium, color: Colors.textTertiary, marginTop: 4 },
  arrow: { padding: 4 },
  datePickerPreview: { textAlign: 'center', color: Colors.primary, fontFamily: Typography.fontFamily.medium, fontSize: 14, marginVertical: 12 },
  datePickerBtnRow: { flexDirection: 'row', gap: 10 },
  datePickerCancel: { flex: 1, paddingVertical: 12, borderRadius: BorderRadius.md, backgroundColor: Colors.backgroundElevated, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  datePickerCancelTxt: { color: Colors.textPrimary, fontFamily: Typography.fontFamily.bold },
  datePickerConfirm: { flex: 1, paddingVertical: 12, borderRadius: BorderRadius.md, backgroundColor: Colors.primary, alignItems: 'center' },
  datePickerConfirmTxt: { color: '#000', fontFamily: Typography.fontFamily.bold },
});

export default OwnerAnalyticsScreen;
