import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Modal, TextInput, ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import LinearGradient from '../../../components/SolidGradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import api from '../../../api/axios';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, BorderRadius } from '../../../theme/theme';
import { showCustomAlert } from '../../../components/CustomAlert';
import moment from 'moment';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

const AdminSettlementsScreen = ({ navigation }) => {
  const [tab, setTab] = useState('requests');
  const [requests, setRequests] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedReq, setSelectedReq] = useState(null);
  const [actionType, setActionType] = useState(null);
  const [transactionRef, setTransactionRef] = useState('');
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [tab])
  );

  const fetchData = async () => {
    setLoading(true);
    try {
      if (tab === 'requests') {
        const res = await api.get('/admin/settlements');
        setRequests(res.data?.data || []);
      } else {
        const res = await api.get('/admin/owner-wallets');
        setWallets(res.data?.data || []);
      }
    } catch (err) {
      showCustomAlert('Error', 'Failed to fetch data.');
    } finally {
      setLoading(false);
    }
  };

  const handleProcessAction = async () => {
    if (!actionType || !selectedReq) return;
    if (actionType === 'processed' && !transactionRef.trim()) {
      showCustomAlert('Error', 'Transaction reference is required for successful settlements.');
      return;
    }
    setSubmitting(true);
    try {
      await api.put(`/admin/settlements/${selectedReq._id}/process`, {
        status: actionType,
        transactionRef,
        remarks,
      });
      showCustomAlert('Success', `Withdrawal ${actionType} successfully.`);
      setSelectedReq(null);
      setActionType(null);
      setTransactionRef('');
      setRemarks('');
      fetchData();
    } catch (err) {
      showCustomAlert('Error', err.response?.data?.message || 'Action failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (status) => {
    if (status === 'pending') return { bg: 'rgba(255,152,0,0.15)', text: '#FF9800', icon: 'clock-outline' };
    if (status === 'processed') return { bg: 'rgba(46,213,115,0.15)', text: '#2ED573', icon: 'check-circle-outline' };
    return { bg: 'rgba(255,71,87,0.15)', text: '#FF4757', icon: 'close-circle-outline' };
  };

  const getOwnerDisplayName = (item) => {
    return item.owner?.businessName || item.owner?.userId?.name || item.user?.name || item.userName || 'Organizer / Owner';
  };

  const getOwnerContact = (item) => {
    return item.owner?.userId?.email || item.user?.email || item.user?.mobile || item.owner?.userId?.phone || '';
  };

  const renderRequest = ({ item, index }) => {
    const statusStyle = getStatusColor(item.status);
    const ownerName = getOwnerDisplayName(item);
    const ownerContact = getOwnerContact(item);
    const initials = ownerName.charAt(0).toUpperCase();

    return (
      <View style={styles.card}>
        {/* Card Header */}
        <View style={styles.cardHeader}>
          <View style={styles.avatarWrap}>
            <LinearGradient colors={['#1a4a1a', '#0f2b0f']} style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </LinearGradient>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.ownerName}>{ownerName}</Text>
            {ownerContact ? (
              <Text style={styles.ownerEmail} numberOfLines={1}>{ownerContact}</Text>
            ) : null}
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
            <Icon name={statusStyle.icon} size={11} color={statusStyle.text} />
            <Text style={[styles.statusText, { color: statusStyle.text }]}>
              {item.status.toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Amount */}
        <View style={styles.amountRow}>
          <View>
            <Text style={styles.amountLabel}>Withdrawal Amount</Text>
            <Text style={styles.amountValue}>₹{item.amount?.toLocaleString()}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.amountLabel}>Requested On</Text>
            <Text style={styles.dateValue}>{moment(item.createdAt).format('DD MMM YYYY')}</Text>
            <Text style={styles.timeValue}>{moment(item.createdAt).format('hh:mm A')}</Text>
          </View>
        </View>

        {/* Turf tag */}
        {item.turf?.name && (
          <View style={styles.turfTag}>
            <Icon name="soccer-field" size={12} color={Colors.textTertiary} />
            <Text style={styles.turfTagText}>{item.turf.name}</Text>
          </View>
        )}

        {/* Completed info */}
        {item.status !== 'pending' && (
          <View style={[styles.metaRow, { backgroundColor: statusStyle.bg }]}>
            <Icon name={item.status === 'processed' ? 'receipt' : 'information-outline'} size={13} color={statusStyle.text} />
            <Text style={[styles.metaText, { color: statusStyle.text }]}>
              {item.status === 'processed' ? `Ref: ${item.transactionRef}` : `Reason: ${item.remarks || 'No reason provided'}`}
            </Text>
          </View>
        )}

        {/* Action Buttons */}
        {item.status === 'pending' && (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.rejectBtn}
              onPress={() => { setSelectedReq(item); setActionType('rejected'); }}
              activeOpacity={0.8}
            >
              <Icon name="close" size={16} color="#FF4757" />
              <Text style={styles.rejectBtnText}>Reject</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.processBtn}
              onPress={() => { setSelectedReq(item); setActionType('processed'); }}
              activeOpacity={0.8}
            >
              <LinearGradient colors={[Colors.primary, '#2a6f1a']} style={styles.processBtnGrad}>
                <Icon name="check" size={16} color="#fff" />
                <Text style={styles.processBtnText}>Process</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderWallet = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.avatarWrap}>
          <LinearGradient colors={['#1a2a4a', '#0a1528']} style={styles.avatar}>
            <Text style={styles.avatarText}>{(item.businessName || 'O').charAt(0).toUpperCase()}</Text>
          </LinearGradient>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.ownerName}>{item.businessName || 'Business'}</Text>
          <Text style={styles.ownerEmail}>{item.ownerName}{item.email ? ` · ${item.email}` : ''}</Text>
        </View>
      </View>
      <View style={styles.divider} />
      <View style={styles.walletGrid}>
        <View style={styles.walletStat}>
          <View style={[styles.walletIconBg, { backgroundColor: Colors.primaryAlpha20 }]}>
            <Icon name="wallet" size={16} color={Colors.primary} />
          </View>
          <Text style={styles.walletStatLabel}>Available</Text>
          <Text style={[styles.walletStatValue, { color: Colors.primary }]}>
            ₹{(item.wallet?.balance || 0).toLocaleString()}
          </Text>
        </View>
        <View style={styles.walletStatDivider} />
        <View style={styles.walletStat}>
          <View style={[styles.walletIconBg, { backgroundColor: 'rgba(255,152,0,0.15)' }]}>
            <Icon name="clock-outline" size={16} color="#FF9800" />
          </View>
          <Text style={styles.walletStatLabel}>Pending</Text>
          <Text style={[styles.walletStatValue, { color: '#FF9800' }]}>
            ₹{(item.wallet?.pendingWithdrawal || 0).toLocaleString()}
          </Text>
        </View>
        <View style={styles.walletStatDivider} />
        <View style={styles.walletStat}>
          <View style={[styles.walletIconBg, { backgroundColor: 'rgba(46,213,115,0.15)' }]}>
            <Icon name="trending-up" size={16} color="#2ED573" />
          </View>
          <Text style={styles.walletStatLabel}>Total Earned</Text>
          <Text style={[styles.walletStatValue, { color: '#2ED573' }]}>
            ₹{(item.wallet?.totalEarned || 0).toLocaleString()}
          </Text>
        </View>
      </View>
    </View>
  );

  const pendingCount = requests.filter(r => r.status === 'pending').length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.backgroundElevated }} edges={['top']}>
      <View style={styles.container}>
        {/* Header */}
        <LinearGradient colors={[Colors.backgroundCard, Colors.background]} style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Icon name="arrow-left" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Settlements</Text>
            <Text style={styles.headerSub}>Manage withdrawals & wallets</Text>
          </View>
          {pendingCount > 0 && (
            <View style={styles.pendingBadge}>
              <Text style={styles.pendingBadgeText}>{pendingCount} pending</Text>
            </View>
          )}
        </LinearGradient>

      {/* Tabs */}
      <View style={styles.tabs}>
        {[
          { key: 'requests', label: 'Withdrawals', icon: 'bank-transfer-out' },
          { key: 'turf', label: 'Turf Owners', icon: 'stadium-variant' },
          { key: 'organizer', label: 'Organizers', icon: 'account-tie-hat' },
        ].map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, tab === t.key && styles.activeTab]}
            onPress={() => setTab(t.key)}
            activeOpacity={0.8}
          >
            <Icon name={t.icon} size={16} color={tab === t.key ? Colors.primary : Colors.textTertiary} />
            <Text style={[styles.tabText, tab === t.key && styles.activeTabText]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      ) : (
        <FlatList
          data={tab === 'requests' ? requests : (tab === 'turf' ? wallets.filter(w => w.businessName !== 'Tournament Organizer') : wallets.filter(w => w.businessName === 'Tournament Organizer'))}
          keyExtractor={item => item._id}
          renderItem={tab === 'requests' ? renderRequest : renderWallet}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Icon name={tab === 'requests' ? 'bank-transfer-out' : 'wallet-outline'} size={48} color={Colors.textTertiary} />
              <Text style={styles.emptyTitle}>Nothing here yet</Text>
              <Text style={styles.emptySubtitle}>
                {tab === 'requests' ? 'No withdrawal requests found.' : `No ${tab === 'turf' ? 'Turf Owner' : 'Organizer'} wallets found.`}
              </Text>
            </View>
          }
        />
      )}

      {/* Action Modal */}
      <Modal visible={!!selectedReq} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <KeyboardAwareScrollView keyboardShouldPersistTaps="handled" bounces={false}>
              <View style={styles.modalHandle} />
              <View style={styles.modalHeader}>
                <View style={[styles.modalIconBg, { backgroundColor: actionType === 'processed' ? Colors.primaryAlpha20 : 'rgba(255,71,87,0.15)' }]}>
                  <Icon
                    name={actionType === 'processed' ? 'check-circle' : 'close-circle'}
                    size={24}
                    color={actionType === 'processed' ? Colors.primary : '#FF4757'}
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.modalTitle}>
                    {actionType === 'processed' ? 'Process Withdrawal' : 'Reject Withdrawal'}
                  </Text>
                  {selectedReq && (
                    <Text style={styles.modalSubtitle}>
                      ₹{selectedReq.amount?.toLocaleString()} · {getOwnerDisplayName(selectedReq)}
                    </Text>
                  )}
                </View>
                <TouchableOpacity onPress={() => setSelectedReq(null)} style={styles.modalCloseBtn}>
                  <Icon name="close" size={20} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {selectedReq?.bankDetailsSnapshot && (
                <View style={styles.bankDetailsBox}>
                  <Text style={styles.bankDetailTitle}>Transfer Funds To:</Text>
                  <Text style={styles.bankDetailText}>Bank: <Text style={styles.bankDetailHighlight}>{selectedReq.bankDetailsSnapshot.bankName}</Text></Text>
                  <Text style={styles.bankDetailText}>A/C Name: <Text style={styles.bankDetailHighlight}>{selectedReq.bankDetailsSnapshot.accountHolder}</Text></Text>
                  <Text style={styles.bankDetailText}>A/C No: <Text style={styles.bankDetailHighlight}>{selectedReq.bankDetailsSnapshot.accountNumber}</Text></Text>
                  <Text style={styles.bankDetailText}>IFSC: <Text style={styles.bankDetailHighlight}>{selectedReq.bankDetailsSnapshot.ifsc}</Text></Text>
                </View>
              )}

              <Text style={styles.inputLabel}>
                {actionType === 'processed' ? 'Transaction Reference (UTR) *' : 'Reason for Rejection'}
              </Text>
              <TextInput
                style={styles.input}
                placeholder={actionType === 'processed' ? 'Enter UTR / Ref No.' : 'Enter reason (optional)'}
                placeholderTextColor={Colors.textTertiary}
                value={actionType === 'processed' ? transactionRef : remarks}
                onChangeText={actionType === 'processed' ? setTransactionRef : setRemarks}
              />

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setSelectedReq(null)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.submitBtn, { backgroundColor: actionType === 'processed' ? Colors.primary : '#FF4757' }]}
                  onPress={handleProcessAction}
                  disabled={submitting}
                  activeOpacity={0.85}
                >
                  {submitting ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.submitBtnText}>
                      {actionType === 'processed' ? 'Confirm & Process' : 'Reject'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </KeyboardAwareScrollView>
          </View>
        </View>
      </Modal>
    </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  header: {
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: Spacing.md,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  headerTitle: { fontSize: 20, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary },
  headerSub: { fontSize: 12, fontFamily: Typography.fontFamily.regular, color: Colors.textTertiary, marginTop: 1 },
  pendingBadge: {
    backgroundColor: 'rgba(255,152,0,0.15)', borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(255,152,0,0.3)',
  },
  pendingBadgeText: { fontSize: 12, fontFamily: Typography.fontFamily.bold, color: '#FF9800' },

  tabs: {
    flexDirection: 'row', backgroundColor: Colors.backgroundCard,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14 },
  activeTab: { borderBottomWidth: 2, borderBottomColor: Colors.primary },
  tabText: { fontSize: 13, fontFamily: Typography.fontFamily.medium, color: Colors.textTertiary },
  activeTabText: { color: Colors.primary, fontFamily: Typography.fontFamily.bold },

  list: { padding: Spacing.md, paddingBottom: 100 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { color: Colors.textSecondary, fontFamily: Typography.fontFamily.medium },
  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyTitle: { fontSize: 18, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary },
  emptySubtitle: { fontSize: 14, fontFamily: Typography.fontFamily.regular, color: Colors.textSecondary },

  card: {
    backgroundColor: Colors.backgroundCard, borderRadius: BorderRadius.xl,
    marginBottom: 12, borderWidth: 1, borderColor: Colors.border,
    overflow: 'hidden',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, gap: 12 },
  avatarWrap: { borderRadius: 24, overflow: 'hidden' },
  avatar: { width: 46, height: 46, borderRadius: 23, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 18, fontFamily: Typography.fontFamily.extraBold, color: '#fff' },
  ownerName: { fontSize: 15, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary },
  ownerEmail: { fontSize: 12, fontFamily: Typography.fontFamily.regular, color: Colors.textTertiary, marginTop: 2 },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10,
  },
  statusText: { fontSize: 10, fontFamily: Typography.fontFamily.bold },

  divider: { height: 1, backgroundColor: Colors.border, marginHorizontal: Spacing.md },

  amountRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: Spacing.md },
  amountLabel: { fontSize: 11, fontFamily: Typography.fontFamily.medium, color: Colors.textTertiary, textTransform: 'uppercase' },
  amountValue: { fontSize: 26, fontFamily: Typography.fontFamily.extraBold, color: Colors.textPrimary, marginTop: 2 },
  dateValue: { fontSize: 13, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary, textAlign: 'right' },
  timeValue: { fontSize: 11, fontFamily: Typography.fontFamily.regular, color: Colors.textTertiary, marginTop: 2, textAlign: 'right' },

  turfTag: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginHorizontal: Spacing.md, marginBottom: Spacing.sm,
    backgroundColor: Colors.backgroundElevated, paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 8, alignSelf: 'flex-start',
  },
  turfTagText: { fontSize: 12, fontFamily: Typography.fontFamily.medium, color: Colors.textSecondary },

  metaRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: Spacing.md, marginBottom: Spacing.md,
    paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8,
  },
  metaText: { fontSize: 12, fontFamily: Typography.fontFamily.medium, flex: 1 },

  actionRow: { flexDirection: 'row', gap: 10, padding: Spacing.md, paddingTop: 0 },
  rejectBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1.5, borderColor: '#FF4757', borderRadius: BorderRadius.md, paddingVertical: 11,
  },
  rejectBtnText: { color: '#FF4757', fontFamily: Typography.fontFamily.bold, fontSize: 14 },
  processBtn: { flex: 2, borderRadius: BorderRadius.md, overflow: 'hidden' },
  processBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11 },
  processBtnText: { color: '#fff', fontFamily: Typography.fontFamily.bold, fontSize: 14 },

  // Wallet card
  walletGrid: { flexDirection: 'row', padding: Spacing.md, gap: 0 },
  walletStat: { flex: 1, alignItems: 'center', gap: 6 },
  walletStatDivider: { width: 1, backgroundColor: Colors.border },
  walletIconBg: { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  walletStatLabel: { fontSize: 10, fontFamily: Typography.fontFamily.medium, color: Colors.textTertiary, textTransform: 'uppercase' },
  walletStatValue: { fontSize: 16, fontFamily: Typography.fontFamily.extraBold },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center' },
  modalContent: {
    width: '90%', maxWidth: 400,
    backgroundColor: Colors.backgroundCard,
    borderRadius: 20,
    padding: Spacing.lg,
  },
  modalHandle: { width: 38, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: Spacing.lg },
  modalHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.lg },
  modalIconBg: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  modalTitle: { fontSize: 17, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary },
  modalSubtitle: { fontSize: 12, fontFamily: Typography.fontFamily.medium, color: Colors.textSecondary, marginTop: 2 },
  modalCloseBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center' },
  
  bankDetailsBox: {
    backgroundColor: Colors.surface, padding: Spacing.md, borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.lg
  },
  bankDetailTitle: { fontSize: 12, fontFamily: Typography.fontFamily.bold, color: Colors.textSecondary, marginBottom: 8, textTransform: 'uppercase' },
  bankDetailText: { fontSize: 14, fontFamily: Typography.fontFamily.medium, color: Colors.textSecondary, marginBottom: 4 },
  bankDetailHighlight: { color: Colors.textPrimary, fontFamily: Typography.fontFamily.bold },

  inputLabel: { fontSize: 13, color: Colors.textSecondary, fontFamily: Typography.fontFamily.medium, marginBottom: 8 },
  input: {
    height: 50, backgroundColor: Colors.surface, borderRadius: BorderRadius.md,
    paddingHorizontal: 16, color: Colors.textPrimary, borderWidth: 1, borderColor: Colors.border,
    fontSize: 15, fontFamily: Typography.fontFamily.regular, marginBottom: Spacing.xl,
  },
  modalActions: { flexDirection: 'row', gap: 12 },
  cancelBtn: {
    flex: 1, padding: 14, borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceVariant, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  cancelBtnText: { color: Colors.textPrimary, fontFamily: Typography.fontFamily.bold, fontSize: 14 },
  submitBtn: { flex: 2, padding: 14, borderRadius: BorderRadius.md, justifyContent: 'center', alignItems: 'center' },
  submitBtnText: { color: '#fff', fontFamily: Typography.fontFamily.bold, fontSize: 14 },
});

export default AdminSettlementsScreen;
