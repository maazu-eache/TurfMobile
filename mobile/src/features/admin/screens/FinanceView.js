import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  ActivityIndicator, ScrollView, Alert
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import api from '../../../api/axios';
import { Colors, Typography } from '../../../theme/theme';

const formatCurrency = (val) => `₹${(val || 0).toLocaleString('en-IN')}`;
const formatDate = (val) => val ? new Date(val).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A';
const formatTime = (val) => val ? new Date(val).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '';

const TABS = [
  { id: 'summary', label: 'Overview', icon: 'view-dashboard-outline' },
  { id: 'incoming', label: 'Incoming', icon: 'arrow-down-circle-outline' },
  { id: 'outgoing', label: 'Outgoing', icon: 'arrow-up-circle-outline' },
  { id: 'pending_refunds', label: 'Refunds', icon: 'cash-refund' },
  { id: 'pending_withdrawals', label: 'Withdrawals', icon: 'bank-transfer-out' },
  { id: 'ledger', label: 'Ledger', icon: 'book-open-outline' },
  { id: 'audit', label: 'Audit', icon: 'shield-check-outline' },
];

// ── Small info row ──────────────────────────────────────────────────
const InfoRow = ({ icon, label, value, valueColor }) => (
  <View style={styles.infoRow}>
    <Icon name={icon} size={13} color={Colors.textTertiary} />
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={[styles.infoValue, valueColor && { color: valueColor }]}>{value}</Text>
  </View>
);

// ── Empty state ────────────────────────────────────────────────────
const EmptyState = ({ icon, message }) => (
  <View style={styles.emptyContainer}>
    <View style={styles.emptyIconRing}>
      <Icon name={icon} size={32} color={Colors.textTertiary} />
    </View>
    <Text style={styles.emptyTitle}>Nothing here</Text>
    <Text style={styles.emptyText}>{message}</Text>
  </View>
);

const FinanceView = () => {
  const [activeTab, setActiveTab] = useState('summary');
  const [loading, setLoading] = useState(true);
  const [summaryData, setSummaryData] = useState(null);
  const [incoming, setIncoming] = useState([]);
  const [outgoingRefunds, setOutgoingRefunds] = useState([]);
  const [outgoingWithdrawals, setOutgoingWithdrawals] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [processingId, setProcessingId] = useState(null);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [activeTab])
  );

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'summary') {
        const res = await api.get('/admin/finance/summary');
        setSummaryData(res.data.data);
      } else if (activeTab === 'incoming') {
        const res = await api.get('/admin/finance/incoming?limit=100');
        setIncoming(res.data.data || []);
      } else if (activeTab === 'outgoing') {
        const [refRes, withRes] = await Promise.all([
          api.get('/admin/finance/outgoing/refunds?status=processed&limit=100'),
          api.get('/admin/finance/outgoing/withdrawals?status=processed&limit=100')
        ]);
        setOutgoingRefunds(refRes.data.data || []);
        setOutgoingWithdrawals(withRes.data.data || []);
      } else if (activeTab === 'pending_refunds') {
        const res = await api.get('/admin/finance/outgoing/refunds?status=pending&limit=100');
        setOutgoingRefunds(res.data.data || []);
      } else if (activeTab === 'pending_withdrawals') {
        const res = await api.get('/admin/finance/outgoing/withdrawals?status=pending&limit=100');
        setOutgoingWithdrawals(res.data.data || []);
      } else if (activeTab === 'ledger') {
        const res = await api.get('/admin/finance/transactions?limit=200');
        setLedger(res.data.data || []);
      } else if (activeTab === 'audit') {
        const res = await api.get('/admin/finance/audit?limit=200');
        setAuditLogs(res.data.data || []);
      }
    } catch (err) {
      console.log('Finance fetch error', err?.response?.data || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleProcessRefund = (id, amount, userName) => {
    Alert.alert(
      'Process Refund',
      `Are you sure you want to refund ${formatCurrency(amount)} to ${userName || 'this user'}? This will trigger a Razorpay refund.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Process Refund', style: 'destructive',
          onPress: async () => {
            setProcessingId(id);
            try {
              await api.post(`/admin/refunds/${id}/process`);
              fetchData();
            } catch (err) {
              Alert.alert('Error', err?.response?.data?.message || 'Failed to process refund');
            } finally {
              setProcessingId(null);
            }
          }
        }
      ]
    );
  };

  const handleProcessWithdrawal = (id, amount, name, status) => {
    const action = status === 'processed' ? 'approve' : 'reject';
    Alert.alert(
      `${action === 'approve' ? 'Approve' : 'Reject'} Withdrawal`,
      `Are you sure you want to ${action} the withdrawal of ${formatCurrency(amount)} for ${name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: action === 'approve' ? 'Approve' : 'Reject',
          style: action === 'approve' ? 'default' : 'destructive',
          onPress: async () => {
            setProcessingId(id);
            try {
              await api.put(`/admin/settlements/${id}/process`, { status, transactionRef: `ADMIN_FINANCE_${Date.now()}` });
              fetchData();
            } catch (err) {
              Alert.alert('Error', err?.response?.data?.message || 'Failed to update withdrawal');
            } finally {
              setProcessingId(null);
            }
          }
        }
      ]
    );
  };

  // ── Tab Bar ────────────────────────────────────────────────────────
  const renderTabBar = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.tabBar}
      contentContainerStyle={styles.tabBarContent}
    >
      {TABS.map(tab => {
        const isActive = activeTab === tab.id;
        return (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, isActive && styles.tabActive]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Icon name={tab.icon} size={16} color={isActive ? Colors.primary : Colors.textTertiary} />
            <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );

  // ── Summary ────────────────────────────────────────────────────────
  const renderSummary = () => {
    if (!summaryData) return <EmptyState icon="chart-line" message="Could not load summary data." />;
    const cards = [
      { label: "Today's Collection", value: summaryData.todayCollection, icon: 'calendar-today', color: Colors.primary },
      { label: 'Month Collection', value: summaryData.monthCollection, icon: 'calendar-month', color: Colors.info },
      { label: 'Total Incoming', value: summaryData.totalIncoming, icon: 'arrow-down-circle', color: Colors.success },
      { label: 'Total Outgoing', value: summaryData.totalOutgoing, icon: 'arrow-up-circle', color: Colors.error },
      { label: 'Platform Revenue', value: summaryData.totalPlatformRevenue, icon: 'chart-bar', color: Colors.warning },
      { label: 'Pending Refunds', value: summaryData.pendingRefundAmount, icon: 'cash-refund', color: Colors.error },
      { label: 'Pending Withdrawals', value: summaryData.pendingWithdrawalAmount, icon: 'bank-transfer-out', color: Colors.error },
      { label: 'Customer Refunds', value: summaryData.totalCustomerRefunds, icon: 'account-arrow-left', color: Colors.textSecondary },
      { label: 'Owner Withdrawals', value: summaryData.totalOwnerWithdrawals, icon: 'store-outline', color: Colors.textSecondary },
    ];

    return (
      <ScrollView contentContainerStyle={styles.summaryContent}>
        {/* Hero card */}
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <Icon name="finance" size={22} color={Colors.primary} />
            <Text style={styles.heroLabel}>Year Collection</Text>
          </View>
          <Text style={styles.heroValue}>{formatCurrency(summaryData.yearCollection)}</Text>
          <Text style={styles.heroSub}>Total revenue collected this year</Text>
        </View>

        {/* Metric grid */}
        <View style={styles.metricGrid}>
          {cards.map((c, i) => (
            <View key={i} style={styles.metricCard}>
              <View style={[styles.metricIconBg, { backgroundColor: c.color + '18' }]}>
                <Icon name={c.icon} size={18} color={c.color} />
              </View>
              <Text style={styles.metricValue} numberOfLines={1}>{formatCurrency(c.value)}</Text>
              <Text style={styles.metricLabel}>{c.label}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    );
  };

  // ── Incoming payments ──────────────────────────────────────────────
  const renderIncomingItem = ({ item }) => (
    <View style={[styles.card, styles.cardGreenAccent]}>
      <View style={styles.cardHeaderRow}>
        <View style={styles.cardIconWrap}>
          <Icon name="arrow-down-circle" size={18} color={Colors.success} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {item.booking?.bookingRef || 'Direct Payment'}
          </Text>
          <Text style={styles.cardSubtitle}>{formatDate(item.createdAt)} · {formatTime(item.createdAt)}</Text>
        </View>
        <Text style={[styles.cardAmount, { color: Colors.success }]}>+{formatCurrency(item.amount)}</Text>
      </View>
      <View style={styles.divider} />
      <InfoRow icon="account-outline" label="User" value={item.user?.name || 'Unknown'} />
      <InfoRow icon="store-outline" label="Turf" value={item.owner?.businessName || 'N/A'} />
      <InfoRow icon="credit-card-outline" label="Method" value={item.method || 'Online'} />
    </View>
  );

  // ── Outgoing (combined) ────────────────────────────────────────────
  const renderOutgoingItem = ({ item }) => {
    const isRefund = !!item.refundAmount;
    const amount = isRefund ? item.refundAmount : item.amount;
    const title = isRefund
      ? (item.booking?.bookingRef || 'Refund')
      : (item.owner?.businessName || item.user?.name || 'Withdrawal');
    const sub = isRefund ? 'Customer Refund' : 'Owner Withdrawal';

    return (
      <View style={[styles.card, styles.cardRedAccent]}>
        <View style={styles.cardHeaderRow}>
          <View style={[styles.cardIconWrap, { backgroundColor: Colors.errorLight }]}>
            <Icon name={isRefund ? 'cash-refund' : 'bank-transfer-out'} size={18} color={Colors.error} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle} numberOfLines={1}>{title}</Text>
            <Text style={styles.cardSubtitle}>{sub} · {formatDate(item.processedAt || item.createdAt)}</Text>
          </View>
          <Text style={[styles.cardAmount, { color: Colors.error }]}>-{formatCurrency(amount)}</Text>
        </View>
        <View style={styles.divider} />
        <InfoRow icon="shield-check-outline" label="Status" value={item.status} valueColor={Colors.success} />
      </View>
    );
  };

  // ── Pending Refund ────────────────────────────────────────────────
  const renderPendingRefund = ({ item }) => {
    const isProcessing = processingId === item._id;
    return (
      <View style={[styles.card, styles.cardOrangeAccent]}>
        <View style={styles.pendingBadge}>
          <Text style={styles.pendingBadgeText}>PENDING REFUND</Text>
        </View>
        <View style={styles.cardHeaderRow}>
          <View style={[styles.cardIconWrap, { backgroundColor: Colors.warningLight }]}>
            <Icon name="cash-refund" size={18} color={Colors.warning} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              Booking: {item.booking?.bookingRef || 'N/A'}
            </Text>
            <Text style={styles.cardSubtitle}>{formatDate(item.createdAt)}</Text>
          </View>
          <Text style={[styles.cardAmount, { color: Colors.warning }]}>{formatCurrency(item.refundAmount)}</Text>
        </View>
        <View style={styles.divider} />
        <InfoRow icon="account-outline" label="Customer" value={item.user?.name || 'Unknown'} />
        <InfoRow icon="identifier" label="Razorpay ID" value={item.razorpayPaymentId || 'N/A'} />
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: Colors.success }, isProcessing && styles.actionBtnDisabled]}
          onPress={() => handleProcessRefund(item._id, item.refundAmount, item.user?.name)}
          disabled={isProcessing}
        >
          {isProcessing
            ? <ActivityIndicator size="small" color="#000" />
            : <>
                <Icon name="check-circle-outline" size={16} color="#000" />
                <Text style={styles.actionBtnText}>Process Refund · {formatCurrency(item.refundAmount)}</Text>
              </>
          }
        </TouchableOpacity>
      </View>
    );
  };

  // ── Pending Withdrawal ────────────────────────────────────────────
  const renderPendingWithdrawal = ({ item }) => {
    const isProcessing = processingId === item._id;
    const name = item.owner?.businessName || item.user?.name || 'Unknown';
    return (
      <View style={[styles.card, styles.cardOrangeAccent]}>
        <View style={styles.pendingBadge}>
          <Text style={styles.pendingBadgeText}>PENDING WITHDRAWAL</Text>
        </View>
        <View style={styles.cardHeaderRow}>
          <View style={[styles.cardIconWrap, { backgroundColor: Colors.warningLight }]}>
            <Icon name="bank-transfer-out" size={18} color={Colors.warning} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle} numberOfLines={1}>{name}</Text>
            <Text style={styles.cardSubtitle}>{formatDate(item.requestedAt || item.createdAt)}</Text>
          </View>
          <Text style={[styles.cardAmount, { color: Colors.warning }]}>{formatCurrency(item.amount)}</Text>
        </View>
        <View style={styles.divider} />
        <InfoRow icon="bank-outline" label="Bank" value={item.bankName || 'N/A'} />
        <InfoRow icon="card-account-details-outline" label="Account" value={item.accountNumber ? `••••${item.accountNumber.slice(-4)}` : 'N/A'} />
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBtn, { flex: 1, backgroundColor: Colors.success }, isProcessing && styles.actionBtnDisabled]}
            onPress={() => handleProcessWithdrawal(item._id, item.amount, name, 'processed')}
            disabled={isProcessing}
          >
            {isProcessing ? <ActivityIndicator size="small" color="#000" /> :
              <><Icon name="check-circle-outline" size={15} color="#000" /><Text style={styles.actionBtnText}>Approve</Text></>
            }
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { flex: 1, backgroundColor: Colors.errorLight, borderWidth: 1, borderColor: Colors.error }, isProcessing && styles.actionBtnDisabled]}
            onPress={() => handleProcessWithdrawal(item._id, item.amount, name, 'rejected')}
            disabled={isProcessing}
          >
            <Icon name="close-circle-outline" size={15} color={Colors.error} />
            <Text style={[styles.actionBtnText, { color: Colors.error }]}>Reject</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // ── Ledger Transaction ────────────────────────────────────────────
  const renderTransactionItem = ({ item }) => {
    const isIn = item.direction === 'incoming';
    return (
      <View style={styles.ledgerRow}>
        <View style={[styles.ledgerDot, { backgroundColor: isIn ? Colors.success : Colors.error }]} />
        <View style={{ flex: 1 }}>
          <Text style={styles.ledgerTitle}>{(item.category || '').replace(/_/g, ' ')}</Text>
          <Text style={styles.ledgerSub}>{item.user?.name || item.description || 'N/A'}</Text>
          <Text style={styles.cardSubtitle}>{formatDate(item.createdAt)}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.ledgerAmount, { color: isIn ? Colors.success : Colors.error }]}>
            {isIn ? '+' : '-'}{formatCurrency(item.amount)}
          </Text>
          <View style={[styles.statusPill, { backgroundColor: Colors.surface }]}>
            <Text style={[styles.statusPillText, { color: item.status === 'completed' ? Colors.success : Colors.warning }]}>
              {item.status}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  // ── Audit Log ────────────────────────────────────────────────────
  const renderAuditLog = ({ item }) => {
    const actionIcon = item.action?.includes('refund') ? 'cash-refund' : 'bank-transfer-out';
    return (
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <View style={[styles.cardIconWrap, { backgroundColor: Colors.infoLight }]}>
            <Icon name={actionIcon} size={16} color={Colors.info} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{(item.action || '').replace(/_/g, ' ').toUpperCase()}</Text>
            <Text style={styles.cardSubtitle}>{formatDate(item.createdAt)} · {formatTime(item.createdAt)}</Text>
          </View>
          <View style={styles.statusPill}>
            <Text style={styles.statusPillText}>{item.newStatus}</Text>
          </View>
        </View>
        <View style={styles.divider} />
        <InfoRow icon="shield-account-outline" label="Admin" value={item.adminId?.name || 'System'} />
        <InfoRow icon="swap-horizontal" label="Change" value={`${item.previousStatus || '?'} → ${item.newStatus || '?'}`} />
        {item.bookingId?.bookingRef && <InfoRow icon="ticket-outline" label="Booking" value={item.bookingId.bookingRef} />}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {renderTabBar()}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading financial data…</Text>
        </View>
      ) : (
        <>
          {activeTab === 'summary' && renderSummary()}

          {activeTab === 'ledger' && (
            <FlatList
              data={ledger}
              renderItem={renderTransactionItem}
              keyExtractor={item => item._id}
              contentContainerStyle={styles.list}
              ListEmptyComponent={<EmptyState icon="book-open-outline" message="No transactions in the ledger yet." />}
            />
          )}

          {activeTab === 'audit' && (
            <FlatList
              data={auditLogs}
              renderItem={renderAuditLog}
              keyExtractor={item => item._id}
              contentContainerStyle={styles.list}
              ListEmptyComponent={<EmptyState icon="shield-check-outline" message="No audit logs recorded yet." />}
            />
          )}

          {activeTab === 'pending_refunds' && (
            <FlatList
              data={outgoingRefunds}
              renderItem={renderPendingRefund}
              keyExtractor={item => item._id}
              contentContainerStyle={styles.list}
              ListEmptyComponent={<EmptyState icon="cash-refund" message="All caught up! No pending refunds." />}
            />
          )}

          {activeTab === 'pending_withdrawals' && (
            <FlatList
              data={outgoingWithdrawals}
              renderItem={renderPendingWithdrawal}
              keyExtractor={item => item._id}
              contentContainerStyle={styles.list}
              ListEmptyComponent={<EmptyState icon="bank-transfer-out" message="No pending withdrawal requests." />}
            />
          )}

          {activeTab === 'incoming' && (
            <FlatList
              data={incoming}
              renderItem={renderIncomingItem}
              keyExtractor={item => item._id}
              contentContainerStyle={styles.list}
              ListEmptyComponent={<EmptyState icon="arrow-down-circle-outline" message="No incoming payments recorded." />}
            />
          )}

          {activeTab === 'outgoing' && (
            <FlatList
              data={[...outgoingRefunds, ...outgoingWithdrawals].sort(
                (a, b) => new Date(b.processedAt || b.createdAt) - new Date(a.processedAt || a.createdAt)
              )}
              renderItem={renderOutgoingItem}
              keyExtractor={item => item._id}
              contentContainerStyle={styles.list}
              ListEmptyComponent={<EmptyState icon="arrow-up-circle-outline" message="No outgoing payments found." />}
            />
          )}
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  // ── Tab bar ──────────────────────────────────────────────────────
  tabBar: {
    maxHeight: 56, minHeight: 56,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  tabBarContent: {
    paddingHorizontal: 12, gap: 8, alignItems: 'center',
  },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 12, paddingHorizontal: 16,
    borderBottomWidth: 3, borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: Colors.primary,
  },
  tabLabel: {
    fontSize: 13, fontFamily: 'Outfit-Bold', color: Colors.textTertiary,
  },
  tabLabelActive: {
    color: Colors.primary,
  },

  // ── Loading ──────────────────────────────────────────────────────
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { color: Colors.textSecondary, fontSize: 14, fontFamily: 'Outfit-Regular' },

  // ── Summary ──────────────────────────────────────────────────────
  summaryContent: { padding: 16, gap: 16 },
  heroCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.primaryAlpha30,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  heroLabel: { color: Colors.primary, fontSize: 13, fontFamily: 'Outfit-Bold' },
  heroValue: { color: Colors.textPrimary, fontSize: 34, fontFamily: 'Outfit-ExtraBold', letterSpacing: -0.5 },
  heroSub: { color: Colors.textTertiary, fontSize: 12, fontFamily: 'Outfit-Regular', marginTop: 4 },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metricCard: {
    width: '47.5%',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
  },
  metricIconBg: {
    width: 36, height: 36, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },
  metricValue: { color: Colors.textPrimary, fontSize: 17, fontFamily: 'Outfit-ExtraBold' },
  metricLabel: { color: Colors.textTertiary, fontSize: 11, fontFamily: 'Outfit-Medium' },

  // ── List / Cards ─────────────────────────────────────────────────
  list: { padding: 16, gap: 12 },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  cardGreenAccent: { borderLeftWidth: 3, borderLeftColor: Colors.success },
  cardRedAccent: { borderLeftWidth: 3, borderLeftColor: Colors.error },
  cardOrangeAccent: { borderLeftWidth: 3, borderLeftColor: Colors.warning },

  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardIconWrap: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: 'rgba(46,213,115,0.12)',
    justifyContent: 'center', alignItems: 'center',
  },
  cardTitle: { color: Colors.textPrimary, fontSize: 14, fontFamily: 'Outfit-Bold', flex: 1 },
  cardSubtitle: { color: Colors.textTertiary, fontSize: 11, fontFamily: 'Outfit-Regular', marginTop: 2 },
  cardAmount: { fontSize: 16, fontFamily: 'Outfit-ExtraBold' },

  divider: { height: 1, backgroundColor: Colors.borderLight, marginVertical: 12 },

  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  infoLabel: { color: Colors.textTertiary, fontSize: 12, fontFamily: 'Outfit-Regular', width: 70 },
  infoValue: { color: Colors.textSecondary, fontSize: 12, fontFamily: 'Outfit-Medium', flex: 1 },

  pendingBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.warningLight,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 6, marginBottom: 12,
  },
  pendingBadgeText: { color: Colors.warning, fontSize: 9, fontFamily: 'Outfit-Bold', letterSpacing: 0.8 },

  actionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 11, borderRadius: 10,
    marginTop: 12,
  },
  actionBtnDisabled: { opacity: 0.5 },
  actionBtnText: { color: Colors.background, fontSize: 13, fontFamily: 'Outfit-Bold' },
  actionRow: { flexDirection: 'row', gap: 10 },

  // ── Ledger rows ──────────────────────────────────────────────────
  ledgerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: Colors.border,
  },
  ledgerDot: { width: 8, height: 8, borderRadius: 4 },
  ledgerTitle: { color: Colors.textPrimary, fontSize: 13, fontFamily: 'Outfit-Bold', textTransform: 'capitalize' },
  ledgerSub: { color: Colors.textSecondary, fontSize: 12, fontFamily: 'Outfit-Regular', marginTop: 1 },
  ledgerAmount: { fontSize: 15, fontFamily: 'Outfit-ExtraBold' },

  statusPill: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 6, borderWidth: 1, borderColor: Colors.border,
    marginTop: 4,
  },
  statusPillText: {
    color: Colors.success, fontSize: 10,
    fontFamily: 'Outfit-Bold', textTransform: 'capitalize',
  },

  // ── Empty state ──────────────────────────────────────────────────
  emptyContainer: { flex: 1, alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyIconRing: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.border,
    justifyContent: 'center', alignItems: 'center',
  },
  emptyTitle: { color: Colors.textPrimary, fontSize: 16, fontFamily: 'Outfit-Bold' },
  emptyText: { color: Colors.textTertiary, fontSize: 13, fontFamily: 'Outfit-Regular', textAlign: 'center', paddingHorizontal: 32 },
});

export default FinanceView;
