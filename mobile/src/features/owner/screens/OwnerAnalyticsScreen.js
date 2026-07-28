import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Dimensions, Modal, Platform,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { fetchOwnerAnalytics } from '../ownerSlice';
import { Colors, Typography, Spacing, BorderRadius } from '../../../theme/theme';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from '../../../components/SolidGradient';
import api from '../../../api/axios';
import { showCustomAlert } from '../../../components/CustomAlert';

const { width: screenWidth } = Dimensions.get('window');

// ── Helpers ──────────────────────────────────────────────────────────────────
const toISO = (d) => {
  const y  = d.getFullYear();
  const m  = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};

const fmtDisplay = (iso) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${parseInt(d)} ${MONTHS[parseInt(m) - 1]} ${y}`;
};

const RANGES = [
  { id: 'overall', label: 'Overall' },
  { id: 'custom',  label: 'Custom Date' },
];

// ── Summary Stat Card ─────────────────────────────────────────────────────────
const StatCard = ({ icon, label, value, sub, accent }) => (
  <View style={[styles.statCard, { borderLeftColor: accent }]}>
    <View style={[styles.statIconBg, { backgroundColor: accent + '22' }]}>
      <Icon name={icon} size={16} color={accent} />
    </View>
    <Text style={styles.statVal}>{value}</Text>
    <Text style={styles.statLbl}>{label}</Text>
    {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
  </View>
);

// ── Per-day Breakdown Row ─────────────────────────────────────────────────────
const DayRow = ({ label, onR, offR, onB, offB, isTop }) => {
  const total   = onR + offR;
  const totalB  = onB + offB;
  const fmtK    = (n) => n >= 1000 ? `₹${(n / 1000).toFixed(1)}k` : `₹${n}`;
  return (
    <View style={[styles.dayRow, isTop && styles.dayRowTop]}>
      <View style={styles.dayLabelCol}>
        {isTop && <Icon name="star" size={9} color={Colors.primary} style={{ marginBottom: 2 }} />}
        <Text style={[styles.dayLabel, isTop && { color: Colors.primary }]} numberOfLines={1}>{label}</Text>
      </View>
      <View style={styles.dayRevCol}>
        <Text style={styles.dayTotal}>{fmtK(total)}</Text>
        {total > 0 && (
          <View style={{ flexDirection: 'row', gap: 4, marginTop: 2 }}>
            <View style={[styles.dot, { backgroundColor: Colors.primary }]} />
            <Text style={styles.daySub}>{fmtK(onR)}</Text>
            <View style={[styles.dot, { backgroundColor: '#FF9800' }]} />
            <Text style={styles.daySub}>{fmtK(offR)}</Text>
          </View>
        )}
      </View>
      <Text style={styles.dayBookings}>{totalB > 0 ? `${totalB} bkg` : '–'}</Text>
    </View>
  );
};

// ── Simple bar chart ──────────────────────────────────────────────────────────
const BarChart = ({ onlineData, offlineData, labels, topIdx }) => {
  const combined = labels.map((_, i) => onlineData[i] + offlineData[i]);
  const maxVal   = Math.max(...combined, 1);
  const barW     = Math.max(6, (screenWidth - Spacing.xl * 4) / labels.length - 4);

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 80, gap: 3 }}>
        {labels.map((_, i) => {
          const onH  = Math.max(onlineData[i]  > 0 ? 4 : 0, (onlineData[i]  / maxVal) * 72);
          const offH = Math.max(offlineData[i] > 0 ? 4 : 0, (offlineData[i] / maxVal) * 72);
          const isTop = i === topIdx && combined[i] > 0;
          return (
            <View key={i} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end' }}>
              {isTop && <View style={styles.topDot} />}
              <View style={{ flexDirection: 'row', gap: 2, alignItems: 'flex-end' }}>
                <View style={{ width: barW / 2, height: onH,  backgroundColor: Colors.primary, borderRadius: 3, opacity: isTop ? 1 : 0.7 }} />
                <View style={{ width: barW / 2, height: offH, backgroundColor: '#FF9800',      borderRadius: 3, opacity: isTop ? 1 : 0.7 }} />
              </View>
            </View>
          );
        })}
      </View>
      {/* X axis labels – sparse */}
      <View style={{ flexDirection: 'row', marginTop: 5, gap: 3 }}>
        {labels.map((lbl, i) => {
          const show = labels.length <= 7 || i === 0 || i === Math.floor(labels.length / 2) || i === labels.length - 1;
          return (
            <Text key={i} style={[styles.axisLbl, { flex: 1, opacity: show ? 1 : 0 }]} numberOfLines={1}>
              {show ? lbl : ''}
            </Text>
          );
        })}
      </View>
    </View>
  );
};

// ── Simple date picker (number spinner) ───────────────────────────────────────
const SimpleDatePicker = ({ value, onConfirm, onCancel }) => {
  const today = new Date();
  const parsed = value ? new Date(value + 'T00:00:00') : today;
  const [year,  setYear]  = useState(parsed.getFullYear());
  const [month, setMonth] = useState(parsed.getMonth() + 1); // 1-based
  const [day,   setDay]   = useState(parsed.getDate());

  const MONTHS_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];
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
    const iso = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    onConfirm(iso);
  };

  const Spinner = ({ label, value: val, onUp, onDown }) => (
    <View style={spStyles.spinnerCol}>
      <TouchableOpacity onPress={onUp} style={spStyles.arrow}><Icon name="chevron-up" size={22} color={Colors.primary} /></TouchableOpacity>
      <Text style={spStyles.val}>{String(val).padStart(2,'0')}</Text>
      <TouchableOpacity onPress={onDown} style={spStyles.arrow}><Icon name="chevron-down" size={22} color={Colors.primary} /></TouchableOpacity>
      <Text style={spStyles.lbl}>{label}</Text>
    </View>
  );

  return (
    <View style={spStyles.container}>
      <Text style={spStyles.title}>Select Date</Text>
      <View style={spStyles.row}>
        <Spinner label="Day"   value={safeDay} onUp={() => adj(setDay,  1, 1, daysInMonth)} onDown={() => adj(setDay,  -1, 1, daysInMonth)} />
        <Spinner label="Month" value={month}   onUp={() => adj(setMonth,1, 1, 12)}           onDown={() => adj(setMonth,-1, 1, 12)} />
        <Spinner label="Year"  value={year}    onUp={() => adj(setYear, 1, 2020, today.getFullYear())} onDown={() => adj(setYear,-1, 2020, today.getFullYear())} />
      </View>
      <Text style={spStyles.preview}>{MONTHS_FULL[month-1]} {safeDay}, {year}</Text>
      <View style={spStyles.btnRow}>
        <TouchableOpacity style={spStyles.cancelBtn} onPress={onCancel}><Text style={spStyles.cancelTxt}>Cancel</Text></TouchableOpacity>
        <TouchableOpacity style={spStyles.confirmBtn} onPress={confirm}><Text style={spStyles.confirmTxt}>Confirm</Text></TouchableOpacity>
      </View>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
const OwnerAnalyticsScreen = () => {
  const dispatch = useDispatch();
  const { analytics, isLoading } = useSelector((state) => state.owner);
  const [range, setRange] = useState('overall');

  const today = toISO(new Date());
  const [customStart, setCustomStart] = useState(today);
  const [customEnd,   setCustomEnd]   = useState(today);
  const [pickingDate, setPickingDate] = useState(null); // 'start' | 'end' | null
  const [customApplied, setCustomApplied] = useState(false);

  const loadData = useCallback((r, cs, ce) => {
    const params = { range: r };
    if (r === 'custom') {
      if (!cs || !ce) return;
      params.startDate = cs;
      params.endDate   = ce;
    }
    dispatch(fetchOwnerAnalytics(params));
  }, [dispatch]);

  // Initial load
  React.useEffect(() => { loadData('overall'); }, []);

  const handleRangeSelect = (id) => {
    setRange(id);
    if (id !== 'custom') {
      setCustomApplied(false);
      loadData(id);
    }
  };

  const handleApplyCustom = () => {
    if (customStart > customEnd) {
      showCustomAlert('Invalid Range', 'Start date cannot be after end date.');
      return;
    }
    setCustomApplied(true);
    loadData('custom', customStart, customEnd);
  };

  const hasData = analytics && analytics.labels && analytics.labels.length > 0;
  const onlineRev  = hasData ? analytics.revenueData.online  : [];
  const offlineRev = hasData ? analytics.revenueData.offline : [];
  const onlineB    = hasData ? analytics.bookingsData.online  : [];
  const offlineB   = hasData ? analytics.bookingsData.offline : [];
  const labels     = hasData ? analytics.labels : [];

  const totalOn  = onlineRev.reduce((s, v) => s + v, 0);
  const totalOff = offlineRev.reduce((s, v) => s + v, 0);
  const totalRev = totalOn + totalOff;
  const totalBks = [...onlineB, ...offlineB].reduce((s, v) => s + v, 0);
  const onPct    = totalRev > 0 ? Math.round((totalOn / totalRev) * 100) : 0;

  const perDay   = labels.map((_, i) => onlineRev[i] + offlineRev[i]);
  const topIdx   = perDay.indexOf(Math.max(...perDay, 0));

  const fmtK = (n) => n >= 1000 ? `₹${(n / 1000).toFixed(1)}k` : `₹${n}`;

  return (
    <View style={styles.container}>
      {/* ── Header ─────────────────────────────────────── */}
      <LinearGradient colors={[Colors.backgroundCard, Colors.background]} style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Analytics</Text>
          {hasData && analytics.meta && (
            <Text style={styles.headerMeta}>
              {fmtDisplay(analytics.meta.startDate?.slice(0, 10))} – {fmtDisplay(analytics.meta.endDate?.slice(0, 10))}
            </Text>
          )}
        </View>

        {/* Range pills */}
        <View style={styles.pillRow}>
          {RANGES.map(({ id, label }) => {
            const active = range === id;
            return (
              <TouchableOpacity
                key={id}
                style={[styles.pill, active && styles.pillActive]}
                onPress={() => handleRangeSelect(id)}
                activeOpacity={0.75}
              >
                {active && <LinearGradient colors={Colors.gradients.primary} style={StyleSheet.absoluteFill} borderRadius={BorderRadius.full} />}
                <Text style={[styles.pillTxt, active && styles.pillTxtActive]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Custom date range pickers */}
        {range === 'custom' && (
          <View style={styles.customRow}>
            <TouchableOpacity style={styles.datePickBtn} onPress={() => setPickingDate('start')}>
              <Icon name="calendar-start" size={14} color={Colors.primary} />
              <Text style={styles.datePickTxt}>{fmtDisplay(customStart)}</Text>
            </TouchableOpacity>
            <Icon name="arrow-right" size={14} color={Colors.textTertiary} />
            <TouchableOpacity style={styles.datePickBtn} onPress={() => setPickingDate('end')}>
              <Icon name="calendar-end" size={14} color={Colors.primary} />
              <Text style={styles.datePickTxt}>{fmtDisplay(customEnd)}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.applyBtn} onPress={handleApplyCustom}>
              <Text style={styles.applyTxt}>Apply</Text>
            </TouchableOpacity>
          </View>
        )}
      </LinearGradient>

      {/* ── Date picker modal ────────────────────────── */}
      <Modal visible={!!pickingDate} transparent animationType="fade">
        <View style={styles.modalOverlay}>
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

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={() => loadData(range, customStart, customEnd)} tintColor={Colors.primary} />}
      >
        {/* ── Summary Stats ──────────────────────────── */}
        <View style={styles.statsGrid}>
          <StatCard icon="cash-multiple"        label="Total Revenue"  value={fmtK(totalRev)}           accent={Colors.primary} />
          <StatCard icon="ticket-confirmation"  label="Bookings"       value={String(totalBks)}          accent="#5B8DEF" />
          <StatCard icon="wifi"                 label="Online"         value={fmtK(totalOn)}  sub={`${onPct}%`}         accent={Colors.primary} />
          <StatCard icon="storefront-outline"   label="Offline"        value={fmtK(totalOff)} sub={`${100 - onPct}%`}   accent="#FF9800" />
        </View>

        {/* ── Empty state ────────────────────────────── */}
        {!hasData && (
          <View style={styles.empty}>
            <View style={styles.emptyIconBg}><Icon name="chart-bar" size={36} color={Colors.primary} /></View>
            <Text style={styles.emptyTitle}>No data for this period</Text>
            <Text style={styles.emptySub}>Try a different range or make your first booking!</Text>
          </View>
        )}

        {hasData && (
          <>
            {/* ── Insights ───────────────────────────── */}
            {analytics.insights?.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHdr}>
                  <Icon name="lightbulb-on" size={15} color={Colors.primary} />
                  <Text style={styles.sectionTitle}>Insights</Text>
                </View>
                {analytics.insights.map((ins, idx) => {
                  const parts = ins.split('**');
                  return (
                    <View key={idx} style={styles.insightRow}>
                      <View style={styles.insightBullet} />
                      <Text style={styles.insightTxt}>
                        {parts.map((p, i) => i % 2 !== 0 ? <Text key={i} style={styles.insightBold}>{p}</Text> : p)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}

            {/* ── Bar Chart ──────────────────────────── */}
            <View style={styles.section}>
              <View style={styles.sectionHdr}>
                <Icon name="trending-up" size={15} color={Colors.primary} />
                <Text style={styles.sectionTitle}>Revenue Chart</Text>
                <View style={{ flex: 1 }} />
                <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: Colors.primary }]} /><Text style={styles.legendTxt}>Online</Text></View>
                <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#FF9800' }]} /><Text style={styles.legendTxt}>Offline</Text></View>
              </View>
              <View style={styles.chartCard}>
                <BarChart onlineData={onlineRev} offlineData={offlineRev} labels={labels} topIdx={topIdx} />
              </View>
            </View>

            {/* ── Day-by-day Breakdown ───────────────── */}
            <View style={styles.section}>
              <View style={styles.sectionHdr}>
                <Icon name="format-list-bulleted" size={15} color={Colors.primary} />
                <Text style={styles.sectionTitle}>Day-by-Day Breakdown</Text>
              </View>
              <View style={styles.tableCard}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHdrTxt, { flex: 1 }]}>Date</Text>
                  <Text style={[styles.tableHdrTxt, { flex: 2 }]}>Revenue</Text>
                  <Text style={[styles.tableHdrTxt, { textAlign: 'right' }]}>Bookings</Text>
                </View>
                {labels.map((lbl, i) => (
                  <DayRow
                    key={i}
                    label={lbl}
                    onR={onlineRev[i]}  offR={offlineRev[i]}
                    onB={onlineB[i]}    offB={offlineB[i]}
                    isTop={i === topIdx && perDay[i] > 0}
                  />
                ))}
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  header: { paddingTop: 60, paddingHorizontal: Spacing.xl, paddingBottom: Spacing.md },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: Spacing.md },
  headerTitle: { fontSize: Typography.fontSize['2xl'], fontFamily: Typography.fontFamily.extraBold, color: Colors.textPrimary },
  headerMeta: { fontSize: Typography.fontSize.xs, fontFamily: Typography.fontFamily.regular, color: Colors.textTertiary },

  pillRow: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.sm },
  pill: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 10, borderRadius: BorderRadius.full,
    backgroundColor: Colors.surfaceVariant, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden',
  },
  pillActive: { borderColor: Colors.primary },
  pillTxt: { fontFamily: Typography.fontFamily.bold, fontSize: 13, color: Colors.textSecondary },
  pillTxtActive: { color: '#fff' },

  customRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: Spacing.sm, flexWrap: 'wrap' },
  datePickBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.surfaceVariant, borderRadius: BorderRadius.md,
    paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderColor: Colors.border, flex: 1,
  },
  datePickTxt: { fontSize: Typography.fontSize.xs, fontFamily: Typography.fontFamily.medium, color: Colors.textPrimary },
  applyBtn: {
    backgroundColor: Colors.primary, borderRadius: BorderRadius.md,
    paddingHorizontal: 14, paddingVertical: 7,
  },
  applyTxt: { color: '#fff', fontFamily: Typography.fontFamily.bold, fontSize: Typography.fontSize.sm },

  scroll: { paddingTop: Spacing.lg, paddingBottom: 110 },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: Spacing.xl, gap: 10, marginBottom: Spacing.xl },
  statCard: {
    width: (screenWidth - Spacing.xl * 2 - 10) / 2,
    backgroundColor: Colors.backgroundCard, borderRadius: BorderRadius.xl,
    padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, borderLeftWidth: 3,
  },
  statIconBg: { width: 30, height: 30, borderRadius: 9, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  statVal: { fontSize: Typography.fontSize.xl, fontFamily: Typography.fontFamily.extraBold, color: Colors.textPrimary },
  statLbl: { fontSize: Typography.fontSize.xs, fontFamily: Typography.fontFamily.medium, color: Colors.textSecondary, marginTop: 2 },
  statSub: { fontSize: Typography.fontSize.xs, fontFamily: Typography.fontFamily.regular, color: Colors.textTertiary, marginTop: 1 },

  empty: { marginTop: 60, alignItems: 'center', paddingHorizontal: Spacing.xl },
  emptyIconBg: { width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.primaryAlpha10, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.lg },
  emptyTitle: { fontSize: Typography.fontSize.lg, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary, marginBottom: 8 },
  emptySub: { fontSize: Typography.fontSize.base, fontFamily: Typography.fontFamily.regular, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },

  section: { paddingHorizontal: Spacing.xl, marginBottom: Spacing['2xl'] },
  sectionHdr: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: Spacing.md },
  sectionTitle: { fontSize: Typography.fontSize.md, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 8 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendTxt: { fontSize: 10, fontFamily: Typography.fontFamily.medium, color: Colors.textSecondary },

  chartCard: { backgroundColor: Colors.backgroundCard, borderRadius: BorderRadius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border },
  topDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.primary, marginBottom: 3 },
  axisLbl: { fontSize: 9, fontFamily: Typography.fontFamily.regular, color: Colors.textTertiary, textAlign: 'center' },

  insightRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  insightBullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.primary, marginTop: 7 },
  insightTxt: { flex: 1, fontSize: Typography.fontSize.sm, fontFamily: Typography.fontFamily.regular, color: Colors.textSecondary, lineHeight: 20 },
  insightBold: { fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary },

  tableCard: { backgroundColor: Colors.backgroundCard, borderRadius: BorderRadius.xl, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  tableHeader: { flexDirection: 'row', paddingHorizontal: Spacing.md, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.surfaceVariant },
  tableHdrTxt: { fontSize: Typography.fontSize.xs, fontFamily: Typography.fontFamily.bold, color: Colors.textTertiary, textTransform: 'uppercase' },

  dayRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  dayRowTop: { backgroundColor: Colors.primaryAlpha10 },
  dayLabelCol: { flex: 1, alignItems: 'flex-start' },
  dayLabel: { fontSize: Typography.fontSize.sm, fontFamily: Typography.fontFamily.medium, color: Colors.textSecondary },
  dayRevCol: { flex: 2 },
  dayTotal: { fontSize: Typography.fontSize.base, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary },
  daySub: { fontSize: 10, fontFamily: Typography.fontFamily.regular, color: Colors.textTertiary },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 3 },
  dayBookings: { fontSize: Typography.fontSize.sm, fontFamily: Typography.fontFamily.bold, color: Colors.textSecondary, minWidth: 50, textAlign: 'right' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
});

const spStyles = StyleSheet.create({
  container: { backgroundColor: Colors.backgroundCard, borderRadius: BorderRadius.xl, padding: Spacing.xl, width: '100%' },
  title: { fontSize: Typography.fontSize.lg, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary, textAlign: 'center', marginBottom: Spacing.lg },
  row: { flexDirection: 'row', justifyContent: 'space-around' },
  spinnerCol: { alignItems: 'center', gap: 6 },
  arrow: { padding: 8 },
  val: { fontSize: Typography.fontSize['2xl'], fontFamily: Typography.fontFamily.extraBold, color: Colors.textPrimary, minWidth: 50, textAlign: 'center' },
  lbl: { fontSize: Typography.fontSize.xs, fontFamily: Typography.fontFamily.medium, color: Colors.textTertiary },
  preview: { textAlign: 'center', color: Colors.primary, fontFamily: Typography.fontFamily.medium, fontSize: Typography.fontSize.base, marginTop: Spacing.lg },
  btnRow: { flexDirection: 'row', gap: 12, marginTop: Spacing.xl },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: BorderRadius.md, backgroundColor: Colors.surfaceVariant, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  cancelTxt: { color: Colors.textPrimary, fontFamily: Typography.fontFamily.bold, fontSize: Typography.fontSize.sm },
  confirmBtn: { flex: 1, paddingVertical: 12, borderRadius: BorderRadius.md, backgroundColor: Colors.primary, alignItems: 'center' },
  confirmTxt: { color: '#fff', fontFamily: Typography.fontFamily.bold, fontSize: Typography.fontSize.sm },
});

export default OwnerAnalyticsScreen;
