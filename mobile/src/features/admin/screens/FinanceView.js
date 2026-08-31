import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  ActivityIndicator, ScrollView, Alert
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import api from '../../../api/axios';
import { Colors, Typography } from '../../../theme/theme';

// Full currency — used in list cards, modals
const formatCurrency = (val) => `\u20b9${(val || 0).toLocaleString('en-IN')}`;

// Compact currency — used in small tiles to prevent layout collapse
// ₹1.2Cr  ₹5.4L  ₹12.3K  ₹850
const formatCurrencyShort = (val) => {
  const n = val || 0;
  if (n >= 1_00_00_000) return `\u20b9${(n / 1_00_00_000).toFixed(1)}Cr`;
  if (n >= 1_00_000)    return `\u20b9${(n / 1_00_000).toFixed(1)}L`;
  if (n >= 1_000)       return `\u20b9${(n / 1_000).toFixed(1)}K`;
  return `\u20b9${n.toLocaleString('en-IN')}`;
};

const formatDate = (val) => val ? new Date(val).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A';
const formatTime = (val) => val ? new Date(val).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '';

const TABS = [
  { id: 'summary', label: 'Overview', icon: 'view-dashboard-outline' },
  { id: 'incoming', label: 'Incoming', icon: 'arrow-down-circle-outline' },
  { id: 'outgoing', label: 'Outgoing', icon: 'arrow-up-circle-outline' },
  { id: 'pending_refunds', label: 'Refunds', icon: 'cash-refund' },
  { id: 'pending_withdrawals', label: 'Withdrawals', icon: 'bank-transfer-out' },
  { id: 'ledger', label: 'Ledger', icon: 'book-open-outline' },
  { id: 'platform', label: 'Platform', icon: 'wallet-membership' },
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
  const [platformLedger, setPlatformLedger] = useState([]);
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
      } else if (activeTab === 'platform') {
        const res = await api.get('/admin/finance/platform?limit=200');
        setPlatformLedger(res.data.data || []);
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

  // ── Summary ────────────────────────────────────────────
  const renderSummary = () => {
    if (!summaryData) return <EmptyState icon="chart-line" message="Could not load summary data." />;
    const d = summaryData;

    const platformTiles = [
      { label: "Today",  value: d.todayPlatformRevenue,  icon: 'weather-sunny' },
      { label: "Week",   value: d.weekPlatformRevenue,   icon: 'calendar-week' },
      { label: "Month",  value: d.monthPlatformRevenue,  icon: 'calendar-month-outline' },
      { label: "Year",   value: d.yearPlatformRevenue,   icon: 'calendar-blank-outline' },
    ];

    const revenueTiles = [
      { label: "Today",  value: d.todayCollection,  icon: 'weather-sunny' },
      { label: "Week",   value: d.weekCollection,   icon: 'calendar-week' },
      { label: "Month",  value: d.monthCollection,  icon: 'calendar-month-outline' },
      { label: "Year",   value: d.yearCollection,   icon: 'calendar-blank-outline' },
    ];

    return (
      <ScrollView contentContainerStyle={styles.summaryContent}>

        {/* ── Platform Revenue Section ──────────────────────────────── */}
        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIconWrap}>
              <Icon name="wallet-membership" size={16} color={Colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>Platform Revenue</Text>
              <Text style={styles.sectionSub}>Platform commission earned</Text>
            </View>
            <View style={styles.sectionTotal}>
              <Text style={styles.sectionTotalLabel}>All-time</Text>
              <Text style={styles.sectionTotalValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{formatCurrencyShort(d.totalPlatformRevenue)}</Text>
            </View>
          </View>

          <View style={styles.tilesRow}>
            {platformTiles.map((t, i) => (
              <View key={i} style={[styles.tile, i === 0 && styles.tileHighlight]}>
                <Icon name={t.icon} size={13} color={i === 0 ? Colors.primary : Colors.textTertiary} />
                <Text
                  style={[styles.tileValue, i === 0 && styles.tileValueHighlight]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.6}
                >
                  {formatCurrencyShort(t.value)}
                </Text>
                <Text style={[styles.tileLabel, i === 0 && { color: Colors.primary }]}>{t.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Total Revenue Section ─────────────────────────────────── */}
        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIconWrap, { backgroundColor: 'rgba(46,213,115,0.12)' }]}>
              <Icon name="trending-up" size={16} color={Colors.success} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>Total Revenue</Text>
              <Text style={styles.sectionSub}>Gross collections</Text>
            </View>
            <View style={styles.sectionTotal}>
              <Text style={styles.sectionTotalLabel}>All-time</Text>
              <Text style={[styles.sectionTotalValue, { color: Colors.success }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{formatCurrencyShort(d.totalIncoming)}</Text>
            </View>
          </View>

          <View style={styles.tilesRow}>
            {revenueTiles.map((t, i) => (
              <View key={i} style={[styles.tile, i === 0 && styles.tileHighlightGreen]}>
                <Icon name={t.icon} size={13} color={i === 0 ? Colors.success : Colors.textTertiary} />
                <Text
                  style={[styles.tileValue, i === 0 && { color: Colors.success }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.6}
                >
                  {formatCurrencyShort(t.value)}
                </Text>
                <Text style={[styles.tileLabel, i === 0 && { color: Colors.success }]}>{t.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Cashflow Strip ────────────────────────────────────────── */}
        <View style={styles.cashflowStrip}>
          <View style={styles.cashflowItem}>
            <Icon name="arrow-down-circle" size={18} color={Colors.success} />
            <View style={{ flex: 1 }}>
              <Text
                style={styles.cashflowValue}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.6}
              >
                {formatCurrencyShort(d.totalIncoming)}
              </Text>
              <Text style={styles.cashflowLabel}>Total Incoming</Text>
            </View>
          </View>
          <View style={styles.cashflowDivider} />
          <View style={styles.cashflowItem}>
            <Icon name="arrow-up-circle" size={18} color={Colors.error} />
            <View>
              <Text style={[styles.cashflowValue, { color: Colors.error }]}>{formatCurrency(d.totalOutgoing)}</Text>
              <Text style={styles.cashflowLabel}>Total Outgoing</Text>
            </View>
          </View>
        </View>

      </ScrollView>
    );
  };

  // ── Incoming payments ────────────────────────────────────────────
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
      <InfoRow icon="store-outline" label="Turf" value={item.booking?.turf?.name || item.owner?.businessName || 'N/A'} />
      <InfoRow icon="credit-card-outline" label="Method" value={item.method || 'Online'} />
    </View>
  );

  // ── Platform Revenue Row ──────────────────────────────────────────
  const renderPlatformItem = ({ item }) => {
    const isCommission = item.type === 'booking_commission';
    const title = isCommission ? 'Booking Commission' : 'Cancellation Platform Fee';
    const iconName = isCommission ? 'cash-multiple' : 'cash-refund';
    
    return (
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <View style={[styles.cardIconWrap, { backgroundColor: isCommission ? 'rgba(255, 212, 0, 0.1)' : 'rgba(46, 213, 115, 0.1)' }]}>
            <Icon name={iconName} size={18} color={isCommission ? Colors.primary : Colors.success} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle} numberOfLines={1}>{title}</Text>
            <Text style={styles.cardSubtitle}>Ref: {item.bookingRef || 'N/A'} · {formatDate(item.createdAt)}</Text>
          </View>
          <Text style={[styles.cardAmount, { color: Colors.success }]}>+{formatCurrency(item.amount)}</Text>
        </View>
        <View style={styles.divider} />
        <InfoRow icon="account-outline" label="Customer" value={item.customerName || 'Unknown'} />
      </View>
    );
  };

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
    const bank = item.bankDetailsSnapshot || item.owner?.bankDetails || item.user?.bankDetails || {};
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
        {bank.accountHolder ? <InfoRow icon="account-circle-outline" label="Holder" value={bank.accountHolder} /> : null}
        <InfoRow icon="bank-outline" label="Bank" value={bank.bankName || 'N/A'} />
        <InfoRow icon="card-account-details-outline" label="Account" value={bank.accountNumber || 'N/A'} />
        {bank.ifsc ? <InfoRow icon="barcode-scan" label="IFSC" value={bank.ifsc} /> : null}
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

          {activeTab === 'platform' && (
            <FlatList
              data={platformLedger}
              renderItem={renderPlatformItem}
              keyExtractor={item => item._id}
              contentContainerStyle={styles.list}
              ListEmptyComponent={<EmptyState icon="wallet-membership" message="No platform revenue recorded yet." />}
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

      {!!processingId && (
        <View style={styles.overlayLoader}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.overlayText}>Processing transaction...</Text>
        </View>
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
  summaryContent: { padding: 16, gap: 14, paddingBottom: 32 },

  // Section block (wraps header + tiles)
  sectionBlock: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  sectionIconWrap: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: 'rgba(255,204,0,0.12)',
    justifyContent: 'center', alignItems: 'center',
  },
  sectionTitle: { fontSize: 14, fontFamily: 'Outfit-Bold', color: Colors.textPrimary },
  sectionSub: { fontSize: 11, fontFamily: 'Outfit-Regular', color: Colors.textTertiary, marginTop: 1 },
  sectionTotal: { alignItems: 'flex-end' },
  sectionTotalLabel: { fontSize: 9, fontFamily: 'Outfit-Bold', color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionTotalValue: { fontSize: 15, fontFamily: 'Outfit-ExtraBold', color: Colors.primary, marginTop: 2 },

  // 4-tile row inside a section
  tilesRow: { flexDirection: 'row' },
  tile: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    gap: 4,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
  },
  tileHighlight: {
    backgroundColor: 'rgba(255,204,0,0.06)',
  },
  tileHighlightGreen: {
    backgroundColor: 'rgba(46,213,115,0.06)',
  },
  tileValue: {
    fontSize: 13,
    fontFamily: 'Outfit-ExtraBold',
    color: Colors.textPrimary,
  },
  tileValueHighlight: { color: Colors.primary },
  tileLabel: {
    fontSize: 9,
    fontFamily: 'Outfit-Bold',
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },

  // Cashflow strip
  cashflowStrip: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  cashflowItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
  },
  cashflowDivider: { width: 1, backgroundColor: Colors.border },
  cashflowValue: {
    fontSize: 14,
    fontFamily: 'Outfit-ExtraBold',
    color: Colors.success,
  },
  cashflowLabel: {
    fontSize: 10,
    fontFamily: 'Outfit-Medium',
    color: Colors.textTertiary,
    marginTop: 2,
  },


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

  overlayLoader: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
    gap: 12
  },
  overlayText: {
    color: '#ffffff',
    fontSize: 15,
    fontFamily: 'Outfit-Bold',
  },
});

export default FinanceView;
