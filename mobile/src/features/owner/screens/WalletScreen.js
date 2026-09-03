import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Modal, TextInput, ScrollView, KeyboardAvoidingView, Platform, StatusBar } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Svg, { Circle } from 'react-native-svg';
import axios from 'axios';
import api from '../../../api/axios';
import { Typography, Spacing, BorderRadius } from '../../../theme/theme';
import { useTheme } from '../../../theme/ThemeContext';
import { showCustomAlert } from '../../../components/CustomAlert';
import moment from 'moment';

const DonutTimer = ({ createdAt, colors }) => {
  const [timeLeft, setTimeLeft] = useState(0);
  const totalDuration = 48 * 60 * 60 * 1000; // 48 hours

  useEffect(() => {
    const calculateTimeLeft = () => {
      const expiresAt = new Date(createdAt).getTime() + totalDuration;
      const now = new Date().getTime();
      return Math.max(0, expiresAt - now);
    };

    setTimeLeft(calculateTimeLeft());
    const interval = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000); // update every second

    return () => clearInterval(interval);
  }, [createdAt]);

  const percentage = Math.max(0, (timeLeft / totalDuration) * 100);
  const radius = 8;
  const strokeWidth = 2.5;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const hoursLeft = Math.floor(timeLeft / (1000 * 60 * 60));
  const minsLeft = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
  const secsLeft = Math.floor((timeLeft % (1000 * 60)) / 1000);

  let color = colors.primary;
  if (hoursLeft < 8) color = colors.error;
  else if (hoursLeft < 24) color = '#FF9800';

  if (timeLeft <= 0) return <Text style={{ color: colors.error, fontSize: 10, fontWeight: 'bold' }}>EXPIRED</Text>;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
      <View style={{ transform: [{ rotate: '-90deg' }] }}>
        <Svg width={20} height={20}>
          <Circle
            stroke={colors.border}
            fill="none"
            cx={10} cy={10} r={radius}
            strokeWidth={strokeWidth}
          />
          <Circle
            stroke={color}
            fill="none"
            cx={10} cy={10} r={radius}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </Svg>
      </View>
      <Text style={{ color: color, fontSize: 11, fontWeight: '600' }}>
        {hoursLeft}h {minsLeft}m {secsLeft}s
      </Text>
    </View>
  );
};

const WalletScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark, shadows } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark, shadows), [colors, isDark, shadows]);

  const [wallet, setWallet] = useState({ balance: 0, pendingWithdrawal: 0, totalEarned: 0 });
  const [transactions, setTransactions] = useState([]);
  const [activeTab, setActiveTab] = useState('All');
  const tabs = ['All', 'Bookings', 'Withdrawals'];
  const [bankDetails, setBankDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Withdrawal State
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [submittingWithdraw, setSubmittingWithdraw] = useState(false);

  // Bank Details State
  const [showBankModal, setShowBankModal] = useState(false);
  const [submittingBank, setSubmittingBank] = useState(false);
  const [bankForm, setBankForm] = useState({
    accountHolder: '',
    accountNumber: '',
    reAccountNumber: '',
    ifsc: '',
    bankName: ''
  });
  const [showAccountNumber, setShowAccountNumber] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [])
  );

  const fetchData = async () => {
    setLoading(true);
    try {
      const [walletRes, txRes, bankRes] = await Promise.all([
        api.get('/wallet/me').catch(() => ({ data: { data: null } })),
        api.get('/wallet/transactions').catch(() => ({ data: { data: [] } })),
        api.get('/wallet/bank-details').catch(() => ({ data: { data: null } }))
      ]);

      const rawWallet = walletRes.data?.data || { balance: 0, pendingWithdrawal: 0, totalEarned: 0 };
      const rawTx = Array.isArray(txRes.data?.data)
        ? txRes.data.data
        : (Array.isArray(txRes.data?.data?.transactions) ? txRes.data.data.transactions : []);
      const rawBank = bankRes.data?.data || null;

      setWallet(rawWallet);
      setTransactions(rawTx);
      setBankDetails(rawBank);
    } catch (e) {
      console.log('Failed to fetch wallet data', e);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleIfscChange = async (text) => {
    const uppercaseText = text.toUpperCase();
    setBankForm(prev => ({ ...prev, ifsc: uppercaseText }));

    if (uppercaseText.length === 11) {
      try {
        const response = await axios.get(`https://ifsc.razorpay.com/${uppercaseText}`);
        if (response.data && response.data.BANK) {
          setBankForm(prev => ({ ...prev, bankName: response.data.BANK }));
        }
      } catch (err) {
        setBankForm(prev => ({ ...prev, bankName: '' }));
      }
    } else {
      setBankForm(prev => ({ ...prev, bankName: '' }));
    }
  };

  const handleSaveBankDetails = async () => {
    if (!bankForm.accountHolder.trim() || !bankForm.accountNumber.trim() || !bankForm.ifsc.trim()) {
      showCustomAlert('Error', 'Please fill in all required bank details.');
      return;
    }

    if (bankForm.accountNumber !== bankForm.reAccountNumber) {
      showCustomAlert('Error', 'Account numbers do not match.');
      return;
    }

    setSubmittingBank(true);
    try {
      await api.post('/wallet/bank-details', {
        accountHolder: bankForm.accountHolder,
        accountNumber: bankForm.accountNumber,
        ifsc: bankForm.ifsc,
        bankName: bankForm.bankName
      });
      showCustomAlert('Success', 'Bank details saved successfully!');
      setShowBankModal(false);
      fetchData();
    } catch (e) {
      showCustomAlert('Error', e.response?.data?.message || 'Failed to save bank details.');
    } finally {
      setSubmittingBank(false);
    }
  };

  const handleWithdrawalRequest = async () => {
    const amt = parseFloat(withdrawAmount);
    if (isNaN(amt) || amt <= 0) {
      showCustomAlert('Error', 'Please enter a valid withdrawal amount.');
      return;
    }
    if (amt > wallet.balance) {
      showCustomAlert('Error', 'Amount exceeds available balance.');
      return;
    }
    if (!bankDetails) {
      showCustomAlert('Error', 'Please add bank details before requesting a withdrawal.');
      return;
    }

    setSubmittingWithdraw(true);
    try {
      await api.post('/wallet/withdraw', { amount: amt });
      showCustomAlert('Success', 'Withdrawal request submitted successfully!');
      setShowWithdrawModal(false);
      setWithdrawAmount('');
      fetchData();
    } catch (e) {
      showCustomAlert('Error', e.response?.data?.message || 'Failed to submit withdrawal request.');
    } finally {
      setSubmittingWithdraw(false);
    }
  };

  const filteredTransactions = (Array.isArray(transactions) ? transactions : []).filter(t => {
    if (activeTab === 'Bookings') return t.type === 'credit';
    if (activeTab === 'Withdrawals') return t.type === 'debit' || t.type === 'withdrawal';
    return true;
  });

  const renderTransaction = ({ item }) => {
    const isCredit = item.type === 'credit';

    return (
      <View style={styles.paymentRow}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={styles.paymentTurf}>{item.description || (isCredit ? 'Booking Credit' : 'Withdrawal')}</Text>
          <Text style={styles.paymentDate}>{moment(item.createdAt).format('DD MMM YYYY, hh:mm A')}</Text>
          {item.status === 'pending' && item.createdAt && (
            <DonutTimer createdAt={item.createdAt} colors={colors} />
          )}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.paymentAmount, { color: isCredit ? '#4CAF50' : colors.error }]}>
            {isCredit ? '+' : '-'}₹{item.amount.toLocaleString()}
          </Text>
          <Text style={[
            styles.paymentStatus,
            {
              color: item.status === 'completed' ? '#4CAF50'
                : item.status === 'pending' ? '#FF9800'
                  : colors.error
            }
          ]}>
            {item.status?.toUpperCase() || 'COMPLETED'}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.surface} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <Icon name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Wallet</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Available Balance</Text>
          <Text style={styles.balanceValue}>₹{(wallet.balance || 0).toLocaleString()}</Text>

          <View style={styles.balanceRow}>
            <View style={{ alignItems: 'center' }}>
              <Text style={styles.subLabel}>Pending Withdrawal</Text>
              <Text style={styles.subValue}>₹{(wallet.pendingWithdrawal || 0).toLocaleString()}</Text>
            </View>
            <View style={{ width: 1, backgroundColor: colors.border }} />
            <View style={{ alignItems: 'center' }}>
              <Text style={styles.subLabel}>Total Earned</Text>
              <Text style={styles.subValue}>₹{(wallet.totalEarned || 0).toLocaleString()}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.withdrawBtn,
              (wallet.balance <= 0 || !bankDetails) && styles.withdrawBtnDisabled
            ]}
            onPress={() => {
              if (!bankDetails) {
                showCustomAlert('Bank Account Required', 'Please add your bank details below before requesting a withdrawal.');
              } else if (wallet.balance <= 0) {
                showCustomAlert('Insufficient Balance', 'You do not have available balance to withdraw.');
              } else {
                setShowWithdrawModal(true);
              }
            }}
            disabled={wallet.balance <= 0 || !bankDetails}
            activeOpacity={0.8}
          >
            <Text style={styles.withdrawBtnText}>Withdraw Funds</Text>
          </TouchableOpacity>
        </View>

        {/* Bank Details Section */}
        <View style={styles.bankCard}>
          <View style={styles.bankHeader}>
            <Text style={styles.bankTitle}>Bank Details for Payout</Text>
            {bankDetails && (
              <TouchableOpacity onPress={() => {
                setBankForm({
                  accountHolder: bankDetails.accountHolder || '',
                  accountNumber: bankDetails.accountNumber || '',
                  reAccountNumber: bankDetails.accountNumber || '',
                  ifsc: bankDetails.ifsc || '',
                  bankName: bankDetails.bankName || ''
                });
                setShowBankModal(true);
              }} activeOpacity={0.7}>
                <Icon name="pencil" size={20} color={isDark ? colors.primary : colors.primaryDark} />
              </TouchableOpacity>
            )}
          </View>

          {bankDetails ? (
            <View style={styles.bankInfo}>
              <Text style={styles.bankText}>Holder: {bankDetails.accountHolder}</Text>
              <Text style={styles.bankText}>Bank: {bankDetails.bankName || 'N/A'}</Text>
              <Text style={styles.bankText}>Account: •••• •••• {bankDetails.accountNumber?.slice(-4)}</Text>
              <Text style={styles.bankText}>IFSC: {bankDetails.ifsc}</Text>
            </View>
          ) : (
            <View style={styles.addBankContainer}>
              <Text style={styles.noBankText}>No bank details added yet for receiving payouts.</Text>
              <TouchableOpacity style={styles.addBankBtn} onPress={() => {
                setBankForm({ accountHolder: '', accountNumber: '', reAccountNumber: '', ifsc: '', bankName: '' });
                setShowBankModal(true);
              }} activeOpacity={0.8}>
                <Text style={styles.addBankBtnText}>+ Add Bank Details</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Transactions Section */}
        <Text style={styles.sectionTitle}>Transaction History</Text>
        
        {/* Tabs */}
        <View style={styles.tabsWrapper}>
          <View style={styles.tabsContainer}>
            {tabs.map((tab) => {
              const isActive = activeTab === tab;
              return (
                <TouchableOpacity
                  key={tab}
                  style={[styles.tabBtn, isActive && styles.tabBtnActive]}
                  onPress={() => setActiveTab(tab)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                    {tab}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 20 }} />
        ) : filteredTransactions.length === 0 ? (
          <Text style={styles.emptyText}>No {activeTab.toLowerCase()} transactions found.</Text>
        ) : (
          filteredTransactions.map((item) => (
            <React.Fragment key={item._id}>
              {renderTransaction({ item })}
            </React.Fragment>
          ))
        )}
      </ScrollView>

      {/* Withdraw Modal */}
      <Modal visible={showWithdrawModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Withdraw Funds</Text>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Available: ₹{wallet.balance.toLocaleString()}</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                placeholder="Enter amount to withdraw"
                placeholderTextColor={colors.textTertiary}
                value={withdrawAmount}
                onChangeText={setWithdrawAmount}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowWithdrawModal(false)} activeOpacity={0.7}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.submitBtn} 
                onPress={handleWithdrawalRequest}
                disabled={submittingWithdraw}
                activeOpacity={0.85}
              >
                {submittingWithdraw ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={styles.submitBtnText}>Confirm Withdrawal</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add/Edit Bank Details Modal */}
      <Modal visible={showBankModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <KeyboardAwareScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>
                {bankDetails ? 'Edit Bank Details' : 'Add Bank Details'}
              </Text>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Account Holder Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter Account Holder Name"
                  placeholderTextColor={colors.textTertiary}
                  value={bankForm.accountHolder}
                  onChangeText={(text) => setBankForm({ ...bankForm, accountHolder: text })}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>IFSC Code</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter IFSC Code"
                  placeholderTextColor={colors.textTertiary}
                  value={bankForm.ifsc}
                  onChangeText={handleIfscChange}
                  autoCapitalize="characters"
                />
                {bankForm.bankName ? (
                  <Text style={styles.bankNameHint}>{bankForm.bankName}</Text>
                ) : null}
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Account Number</Text>
                <View style={{ justifyContent: 'center' }}>
                  <TextInput
                    style={[styles.input, { paddingRight: 45 }]}
                    keyboardType="number-pad"
                    placeholder="Enter Account Number"
                    placeholderTextColor={colors.textTertiary}
                    value={bankForm.accountNumber}
                    onChangeText={(text) => setBankForm({ ...bankForm, accountNumber: text.replace(/[^0-9]/g, '') })}
                    secureTextEntry={!showAccountNumber}
                  />
                  <TouchableOpacity 
                    style={{ position: 'absolute', right: 15 }} 
                    onPress={() => setShowAccountNumber(!showAccountNumber)}
                    activeOpacity={0.7}
                  >
                    <Icon name={showAccountNumber ? "eye-off" : "eye"} size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Re-enter Account Number</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="number-pad"
                  placeholder="Re-enter Account Number"
                  placeholderTextColor={colors.textTertiary}
                  value={bankForm.reAccountNumber}
                  onChangeText={(text) => setBankForm({ ...bankForm, reAccountNumber: text.replace(/[^0-9]/g, '') })}
                />
                {bankForm.accountNumber && bankForm.reAccountNumber && bankForm.accountNumber !== bankForm.reAccountNumber && (
                  <Text style={styles.errorHint}>Account numbers do not match</Text>
                )}
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowBankModal(false)} activeOpacity={0.7}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.submitBtn} 
                  onPress={handleSaveBankDetails}
                  disabled={submittingBank}
                  activeOpacity={0.85}
                >
                  {submittingBank ? (
                    <ActivityIndicator color="#000" />
                  ) : (
                    <Text style={styles.submitBtnText}>Save Details</Text>
                  )}
                </TouchableOpacity>
              </View>
            </KeyboardAwareScrollView>
          </View>
        </View>
      </Modal>

    </View>
  );
};

const createStyles = (colors, isDark, shadows) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { 
    paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md,
    backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: colors.border
  },
  backBtn: { padding: 8, marginRight: 8 },
  headerTitle: { fontSize: 20, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary },
  content: { flex: 1, padding: Spacing.lg },
  
  balanceCard: { backgroundColor: colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.xl, marginBottom: Spacing.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center', ...shadows.small },
  balanceLabel: { fontSize: 14, color: colors.textSecondary, fontFamily: Typography.fontFamily.medium, marginBottom: 8 },
  balanceValue: { fontSize: 36, color: colors.textPrimary, fontFamily: Typography.fontFamily.extraBold, marginBottom: Spacing.lg },
  balanceRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: Spacing.lg },
  subLabel: { fontSize: 12, color: colors.textSecondary, fontFamily: Typography.fontFamily.medium },
  subValue: { fontSize: 16, color: colors.textPrimary, fontFamily: Typography.fontFamily.bold, marginTop: 4 },
  
  withdrawBtn: { backgroundColor: colors.primary, paddingVertical: 14, paddingHorizontal: 24, borderRadius: BorderRadius.md, width: '100%', alignItems: 'center' },
  withdrawBtnDisabled: { backgroundColor: colors.surfaceVariant },
  withdrawBtnText: { color: '#000', fontFamily: Typography.fontFamily.bold, fontSize: 16 },

  bankCard: { backgroundColor: colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.lg, marginBottom: Spacing.xl, borderWidth: 1, borderColor: colors.border, ...shadows.small },
  bankHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  bankTitle: { fontSize: 16, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary },
  bankInfo: { marginTop: Spacing.xs },
  bankText: { fontSize: 14, fontFamily: Typography.fontFamily.medium, color: colors.textSecondary, marginBottom: 4 },
  
  addBankContainer: { alignItems: 'center', marginTop: Spacing.sm },
  noBankText: { fontSize: 14, color: colors.textTertiary, fontFamily: Typography.fontFamily.medium, marginBottom: Spacing.sm },
  addBankBtn: { backgroundColor: colors.surfaceVariant, paddingVertical: 10, paddingHorizontal: 20, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: colors.border },
  addBankBtnText: { color: isDark ? colors.primary : colors.primaryDark, fontFamily: Typography.fontFamily.bold, fontSize: 14 },

  sectionTitle: { fontSize: 18, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary, marginBottom: Spacing.md },
  
  tabsWrapper: {
    backgroundColor: colors.surfaceVariant,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  tabsContainer: {
    flexDirection: 'row',
    width: '100%',
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: {
    borderBottomColor: isDark ? colors.primary : colors.primaryDark,
  },
  tabText: {
    fontSize: 14,
    fontFamily: Typography.fontFamily.medium,
    color: colors.textSecondary,
  },
  tabTextActive: {
    fontFamily: Typography.fontFamily.bold,
    color: isDark ? colors.primary : colors.primaryDark,
  },

  emptyText: { textAlign: 'center', marginVertical: 20, color: colors.textSecondary, fontFamily: Typography.fontFamily.medium },
  
  paymentRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  paymentTurf: { fontSize: 14, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary },
  paymentDate: { fontSize: 12, fontFamily: Typography.fontFamily.medium, color: colors.textSecondary, marginTop: 4 },
  paymentAmount: { fontSize: 16, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary },
  paymentStatus: { fontSize: 8.5, fontFamily: Typography.fontFamily.bold, letterSpacing: 0.5, marginTop: 3 },

  modalOverlay: { flex: 1, backgroundColor: isDark ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.surface, borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl, padding: Spacing.xl, maxHeight: '80%' },
  modalTitle: { fontSize: 20, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary, marginBottom: Spacing.lg },
  
  inputContainer: { marginBottom: Spacing.md },
  inputLabel: { fontSize: 14, color: colors.textSecondary, fontFamily: Typography.fontFamily.medium, marginBottom: 8 },
  input: { height: 50, backgroundColor: colors.surfaceVariant, borderRadius: BorderRadius.md, paddingHorizontal: 16, color: colors.textPrimary, borderWidth: 1, borderColor: colors.border, fontSize: 16 },
  
  bankNameHint: { fontSize: 12, color: isDark ? colors.primary : colors.primaryDark, fontFamily: Typography.fontFamily.medium, marginTop: 4, marginLeft: 4 },
  errorHint: { fontSize: 12, color: colors.error, fontFamily: Typography.fontFamily.medium, marginTop: 4, marginLeft: 4 },

  modalActions: { flexDirection: 'row', gap: 12, marginTop: Spacing.lg },
  cancelBtn: { flex: 1, padding: 14, borderRadius: BorderRadius.md, backgroundColor: colors.surfaceVariant, alignItems: 'center' },
  cancelBtnText: { color: colors.textPrimary, fontFamily: Typography.fontFamily.bold, fontSize: 14 },
  submitBtn: { flex: 2, padding: 14, borderRadius: BorderRadius.md, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
  submitBtnText: { color: '#000', fontFamily: Typography.fontFamily.bold, fontSize: 14 },
});

export default WalletScreen;
