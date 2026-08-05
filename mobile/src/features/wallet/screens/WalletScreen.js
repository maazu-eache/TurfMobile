import React, { useState, useCallback, useEffect } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Modal, TextInput, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Svg, { Circle } from 'react-native-svg';
import axios from 'axios';
import api from '../../../api/axios';
import { Colors, Typography, Spacing, BorderRadius } from '../../../theme/theme';
import { showCustomAlert } from '../../../components/CustomAlert';
import moment from 'moment';

const DonutTimer = ({ createdAt }) => {
  const [timeLeft, setTimeLeft] = useState(0);
  const totalDuration = 24 * 60 * 60 * 1000; // 24 hours

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

  let color = Colors.primary;
  if (hoursLeft < 4) color = Colors.error;
  else if (hoursLeft < 12) color = '#FF9800';

  if (timeLeft <= 0) return <Text style={{ color: Colors.error, fontSize: 10, fontWeight: 'bold' }}>EXPIRED</Text>;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
      <View style={{ transform: [{ rotate: '-90deg' }] }}>
        <Svg width={20} height={20}>
          <Circle
            stroke="rgba(255,255,255,0.1)"
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

import { useSafeAreaInsets } from 'react-native-safe-area-context';

const WalletScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [wallet, setWallet] = useState({ balance: 0, pendingWithdrawal: 0, totalEarned: 0 });
  const [transactions, setTransactions] = useState([]);
  const [activeTab, setActiveTab] = useState('All');
  const tabs = ['All', 'Registrations', 'Withdrawals'];
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
      const [walletRes, userRes] = await Promise.all([
        api.get('/users/wallet'),
        api.get('/users/me')
      ]);
      if (walletRes.data?.data?.wallet) {
        setWallet(walletRes.data.data.wallet);
      }
      if (walletRes.data?.data?.transactions) {
        setTransactions(walletRes.data.data.transactions);
      }
      if (userRes.data?.data?.bankDetails) {
        setBankDetails(userRes.data.data.bankDetails);
      }
    } catch (err) {
      console.error('Failed to fetch wallet data', err);
    } finally {
      setLoading(false);
    }
  };

  const handleWithdrawRequest = async () => {
    const amount = Number(withdrawAmount);
    if (!amount || amount <= 0 || amount > wallet.balance) {
      showCustomAlert('Invalid Amount', 'Please enter a valid amount within your balance.');
      return;
    }

    setSubmittingWithdraw(true);
    try {
      await api.post('/users/wallet/withdraw', { amount });
      showCustomAlert('Success', 'Withdrawal request submitted successfully');
      setShowWithdrawModal(false);
      setWithdrawAmount('');
      fetchData();
    } catch (err) {
      showCustomAlert('Error', err.response?.data?.message || 'Failed to submit request.');
    } finally {
      setSubmittingWithdraw(false);
    }
  };

  const fetchBankName = async (ifscCode) => {
    if (ifscCode.length >= 11) {
      try {
        const res = await axios.get(`https://ifsc.razorpay.com/${ifscCode}`);
        if (res.data && res.data.BANK) {
          setBankForm(prev => ({ ...prev, bankName: res.data.BANK }));
        }
      } catch (err) {
        setBankForm(prev => ({ ...prev, bankName: 'Unknown Bank (Please verify IFSC)' }));
      }
    } else {
      setBankForm(prev => ({ ...prev, bankName: '' }));
    }
  };

  const handleIfscChange = (text) => {
    const upperText = text.toUpperCase();
    setBankForm(prev => ({ ...prev, ifsc: upperText }));
    fetchBankName(upperText);
  };

  const handleSaveBankDetails = async () => {
    const { accountHolder, accountNumber, reAccountNumber, ifsc, bankName } = bankForm;
    if (!accountHolder || !accountNumber || !reAccountNumber || !ifsc || !bankName) {
      showCustomAlert('Error', 'Please fill all required fields correctly.');
      return;
    }
    if (accountNumber !== reAccountNumber) {
      showCustomAlert('Error', 'Account numbers do not match.');
      return;
    }

    setSubmittingBank(true);
    try {
      await api.put('/users/wallet/bank', {
        accountHolder: bankForm.accountHolder,
        accountNumber: bankForm.accountNumber,
        ifsc: bankForm.ifsc,
        bankName: bankForm.bankName
      });
      showCustomAlert('Success', 'Bank details updated successfully.');
      setShowBankModal(false);
      fetchData();
    } catch (err) {
      showCustomAlert('Error', err.response?.data?.message || 'Failed to update bank details.');
    } finally {
      setSubmittingBank(false);
    }
  };

  const openWithdrawModal = () => {
    if (!bankDetails || !bankDetails.accountNumber) {
      showCustomAlert('Bank Details Required', 'Please add your bank account details below to request a withdrawal.');
      return;
    }
    if (wallet.balance <= 0) {
      showCustomAlert('Insufficient Balance', 'You do not have available balance to request a withdrawal.');
      return;
    }
    setWithdrawAmount(wallet.balance.toString());
    setShowWithdrawModal(true);
  };

  const openBankModal = () => {
    if (bankDetails) {
      setBankForm({
        accountHolder: bankDetails.accountHolder || '',
        accountNumber: bankDetails.accountNumber || '',
        reAccountNumber: bankDetails.accountNumber || '',
        ifsc: bankDetails.ifsc || '',
        bankName: bankDetails.bankName || ''
      });
    } else {
      setBankForm({
        accountHolder: '',
        accountNumber: '',
        reAccountNumber: '',
        ifsc: '',
        bankName: ''
      });
    }
    setShowBankModal(true);
  };

  const filteredTransactions = transactions.filter(t => {
    if (activeTab === 'All') return true;
    if (activeTab === 'Registrations') return t.category === 'auction_registration';
    if (activeTab === 'Withdrawals') return t.category === 'withdrawal' || t.category === 'booking_refund';
    return true;
  });

  const handleTransactionClick = (item) => {
    const isCredit = item.type === 'credit';
    showCustomAlert(
      'Transaction Details',
      `Amount: ₹${item.amount}\nType: ${isCredit ? 'Credit (+)' : 'Debit (-)'}\nDescription: ${item.description || 'N/A'}\nDate: ${moment(item.createdAt).format('DD MMM YYYY, hh:mm A')}`
    );
  };

  const renderTransaction = ({ item }) => {
    const isCredit = item.type === 'credit';
    const amountColor = isCredit ? Colors.success : Colors.error;
    const sign = isCredit ? '+' : '-';
    let title = 'Transaction';
    let subCategoryText = '';

    if (item.category === 'booking_payment') {
      title = 'Booking Payment';
    } else if (item.category === 'auction_registration') {
      const playerName = item.description 
        ? item.description.replace(/Online player registration:\s*|Credit for auction registration:\s*/gi, '').trim() 
        : '';
      title = playerName ? `Player Reg: ${playerName}` : 'Auction Registration';
      subCategoryText = 'Player Reg • ';
    } else if (item.category === 'withdrawal') {
      title = 'Wallet Withdrawal';
    } else if (item.category === 'booking_refund') {
      title = 'Booking Refund';
    }

    return (
      <TouchableOpacity 
        style={styles.paymentRow} 
        activeOpacity={0.7}
        onPress={() => handleTransactionClick(item)}
      >
        <View style={{ flex: 1, paddingRight: 10 }}>
          <Text style={styles.paymentTurf} numberOfLines={1}>{title}</Text>
          <Text style={styles.paymentDate}>{subCategoryText}{moment(item.createdAt).format('MMM Do YYYY, h:mm a')}</Text>
        </View>
        <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
          <Text style={[styles.paymentAmount, { color: amountColor }]}>{sign}₹{item.amount}</Text>
          {item.category === 'withdrawal' ? (
            item.status === 'pending' ? (
              <DonutTimer createdAt={item.createdAt} />
            ) : isCredit ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                <Icon name="close-circle-outline" size={14} color={Colors.error} style={{ marginRight: 2 }} />
                <Text style={[styles.paymentStatus, { color: Colors.error, marginTop: 0 }]}>REJECTED</Text>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                <Icon name="check-circle-outline" size={14} color={Colors.success} style={{ marginRight: 2 }} />
                <Text style={[styles.paymentStatus, { color: Colors.success, marginTop: 0 }]}>PROCESSED</Text>
              </View>
            )
          ) : (
            <Text style={[styles.paymentStatus, { color: amountColor }]}>
              {isCredit ? 'CREDIT' : 'DEBIT'}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top || 16 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Wallet</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 50 }} />
      ) : (
        <View style={styles.content}>
          <View style={styles.balanceCard}>
            <View style={styles.balanceHeader}>
              <Icon name="wallet-outline" size={20} color={Colors.primary} style={{ marginRight: 6 }} />
              <Text style={styles.balanceLabel}>Available Balance</Text>
            </View>
            <Text style={styles.balanceValue}>₹{wallet.balance.toLocaleString()}</Text>
            
            <View style={styles.balanceRow}>
              <View style={styles.balanceStatBox}>
                <Text style={styles.subLabel}>Pending Withdrawal</Text>
                <Text style={styles.subValue}>₹{wallet.pendingWithdrawal.toLocaleString()}</Text>
              </View>
              <View style={styles.balanceStatDivider} />
              <View style={styles.balanceStatBox}>
                <Text style={styles.subLabel}>Total Earned</Text>
                <Text style={[styles.subValue, { color: Colors.primary }]}>₹{wallet.totalEarned.toLocaleString()}</Text>
              </View>
            </View>

            <TouchableOpacity 
              style={[styles.withdrawBtn, wallet.balance <= 0 && styles.withdrawBtnDisabled]}
              onPress={openWithdrawModal}
              disabled={wallet.balance <= 0}
            >
              <Text style={[styles.withdrawBtnText, wallet.balance <= 0 && { color: Colors.textSecondary }]}>Request Withdrawal</Text>
            </TouchableOpacity>

            {(!bankDetails || !bankDetails.accountNumber) && (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10 }}>
                <Icon name="information-outline" size={15} color={Colors.primary} />
                <Text style={{ color: Colors.primary, fontSize: 12, fontFamily: Typography.fontFamily.medium }}>
                  Please add your bank account details below to request a withdrawal.
                </Text>
              </View>
            )}
          </View>

          {/* Bank Details Section (Hidden behind button) */}
          <View style={{ marginBottom: Spacing.xl }}>
            <TouchableOpacity 
              style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.backgroundCard, padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border }}
              onPress={openBankModal}
            >
              <Icon name="bank" size={20} color={Colors.primary} style={{ marginRight: 8 }} />
              <Text style={{ fontSize: 16, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary }}>
                {bankDetails && bankDetails.accountNumber ? 'Manage Bank Details' : 'Add Bank Details'}
              </Text>
              <Icon name="chevron-right" size={20} color={Colors.textSecondary} style={{ marginLeft: 'auto' }} />
            </TouchableOpacity>
          </View>

          <View style={styles.tabsWrapper}>
            <View style={styles.tabsContainer}>
              {tabs.map(tab => (
                <TouchableOpacity
                  key={tab}
                  style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
                  onPress={() => setActiveTab(tab)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <FlatList
            data={filteredTransactions}
            keyExtractor={item => item._id}
            renderItem={renderTransaction}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 100 }}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No transactions found.</Text>
            }
          />
        </View>
      )}

      {/* Withdraw Modal */}
      <Modal visible={showWithdrawModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Request Withdrawal</Text>
            
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Amount to Withdraw (Max: ₹{wallet.balance})</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                placeholder="Enter amount"
                placeholderTextColor={Colors.textTertiary}
                value={withdrawAmount}
                onChangeText={(text) => {
                  const val = Number(text);
                  if (val > wallet.balance) {
                    setWithdrawAmount(wallet.balance.toString());
                  } else {
                    setWithdrawAmount(text);
                  }
                }}
              />
              <Text style={{ fontSize: 11, color: Colors.textTertiary, marginTop: 6, lineHeight: 16 }}>
                <Icon name="information-outline" size={12} /> Action will be taken within 24 hours. Exceeding this, the request will be automatically rejected and refunded.
              </Text>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowWithdrawModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.submitBtn} 
                onPress={handleWithdrawRequest}
                disabled={submittingWithdraw}
              >
                {submittingWithdraw ? (
                  <ActivityIndicator color={Colors.background} />
                ) : (
                  <Text style={styles.submitBtnText}>Submit Request</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Bank Details Modal */}
      <Modal visible={showBankModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Update Bank Details</Text>
            
            <KeyboardAwareScrollView enableOnAndroid={true} extraScrollHeight={20} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Account Holder Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter full name on account"
                  placeholderTextColor={Colors.textTertiary}
                  value={bankForm.accountHolder}
                  onChangeText={(text) => setBankForm({ ...bankForm, accountHolder: text })}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>IFSC Code</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter IFSC Code"
                  placeholderTextColor={Colors.textTertiary}
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
                    keyboardType="numeric"
                    placeholder="Enter Account Number"
                    placeholderTextColor={Colors.textTertiary}
                    value={bankForm.accountNumber}
                    onChangeText={(text) => setBankForm({ ...bankForm, accountNumber: text })}
                    secureTextEntry={!showAccountNumber}
                  />
                  <TouchableOpacity 
                    style={{ position: 'absolute', right: 15 }} 
                    onPress={() => setShowAccountNumber(!showAccountNumber)}
                  >
                    <Icon name={showAccountNumber ? "eye-off" : "eye"} size={20} color={Colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Re-enter Account Number</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  placeholder="Re-enter Account Number"
                  placeholderTextColor={Colors.textTertiary}
                  value={bankForm.reAccountNumber}
                  onChangeText={(text) => setBankForm({ ...bankForm, reAccountNumber: text })}
                />
                {bankForm.accountNumber && bankForm.reAccountNumber && bankForm.accountNumber !== bankForm.reAccountNumber && (
                  <Text style={styles.errorHint}>Account numbers do not match</Text>
                )}
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowBankModal(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.submitBtn} 
                  onPress={handleSaveBankDetails}
                  disabled={submittingBank}
                >
                  {submittingBank ? (
                    <ActivityIndicator color={Colors.background} />
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { 
    paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md,
    backgroundColor: Colors.backgroundCard, flexDirection: 'row', alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: Colors.border
  },
  backBtn: { padding: 8, marginRight: 8 },
  headerTitle: { fontSize: 20, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary },
  content: { flex: 1, padding: Spacing.lg },
  
  balanceCard: { 
    borderRadius: 20, 
    padding: Spacing.xl, 
    marginBottom: Spacing.xl, 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    alignItems: 'center',
  },
  balanceHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  balanceLabel: { fontSize: 13, color: Colors.textSecondary, fontFamily: Typography.fontFamily.medium, letterSpacing: 0.5, textTransform: 'uppercase' },
  balanceValue: { 
    fontSize: 44, 
    color: Colors.textPrimary, 
    fontFamily: Typography.fontFamily.extraBold, 
    marginBottom: Spacing.lg,
  },
  balanceRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: Spacing.xl, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 12, padding: 12 },
  balanceStatBox: { flex: 1, alignItems: 'center' },
  balanceStatDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.1)', height: '80%', alignSelf: 'center' },
  subLabel: { fontSize: 11, color: Colors.textTertiary, fontFamily: Typography.fontFamily.medium, marginBottom: 4 },
  subValue: { fontSize: 16, color: Colors.textPrimary, fontFamily: Typography.fontFamily.bold },
  
  withdrawBtn: { 
    backgroundColor: Colors.primary, 
    paddingVertical: 16, 
    paddingHorizontal: 24, 
    borderRadius: 12, 
    width: '100%', 
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  withdrawBtnDisabled: { backgroundColor: 'rgba(255,255,255,0.05)', shadowOpacity: 0, elevation: 0, borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1 },
  withdrawBtnText: { color: '#000', fontFamily: Typography.fontFamily.bold, fontSize: 16, letterSpacing: 0.5 },

  bankCard: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16, padding: Spacing.lg, marginBottom: Spacing.xl, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  bankHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  bankTitle: { fontSize: 16, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary },
  bankInfo: { marginTop: Spacing.xs, backgroundColor: 'rgba(0,0,0,0.2)', padding: 12, borderRadius: 8 },
  bankText: { fontSize: 14, fontFamily: Typography.fontFamily.medium, color: Colors.textSecondary, marginBottom: 4 },
  
  addBankContainer: { alignItems: 'center', marginTop: Spacing.md, paddingVertical: Spacing.md, backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 12 },
  noBankText: { fontSize: 13, color: Colors.textTertiary, fontFamily: Typography.fontFamily.medium, marginBottom: Spacing.md },
  addBankBtn: { backgroundColor: 'rgba(215,255,0,0.1)', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(215,255,0,0.3)' },
  addBankBtnText: { color: Colors.primary, fontFamily: Typography.fontFamily.bold, fontSize: 13 },

  sectionTitle: { fontSize: 18, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary, marginBottom: Spacing.md },
  
  tabsWrapper: {
    backgroundColor: Colors.backgroundElevated,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
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
    borderBottomColor: Colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.textSecondary,
  },
  tabTextActive: {
    fontFamily: Typography.fontFamily.bold,
    color: Colors.primary,
  },

  emptyText: { textAlign: 'center', marginVertical: 20, color: Colors.textSecondary, fontFamily: Typography.fontFamily.medium },
  
  paymentRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  paymentTurf: { fontSize: 14, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary },
  paymentDate: { fontSize: 12, fontFamily: Typography.fontFamily.medium, color: Colors.textSecondary, marginTop: 4 },
  paymentAmount: { fontSize: 16, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary },
  paymentStatus: { fontSize: 10, fontFamily: Typography.fontFamily.bold, marginTop: 4 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: Colors.backgroundCard, borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl, padding: Spacing.xl, maxHeight: '80%' },
  modalTitle: { fontSize: 20, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary, marginBottom: Spacing.lg },
  
  inputContainer: { marginBottom: Spacing.md },
  inputLabel: { fontSize: 14, color: Colors.textSecondary, fontFamily: Typography.fontFamily.medium, marginBottom: 8 },
  input: { height: 50, backgroundColor: Colors.surface, borderRadius: BorderRadius.md, paddingHorizontal: 16, color: Colors.textPrimary, borderWidth: 1, borderColor: Colors.border, fontSize: 16 },
  
  bankNameHint: { fontSize: 12, color: Colors.primary, fontFamily: Typography.fontFamily.medium, marginTop: 4, marginLeft: 4 },
  errorHint: { fontSize: 12, color: Colors.error, fontFamily: Typography.fontFamily.medium, marginTop: 4, marginLeft: 4 },

  modalActions: { flexDirection: 'row', gap: 12, marginTop: Spacing.lg },
  cancelBtn: { flex: 1, padding: 14, borderRadius: BorderRadius.md, backgroundColor: Colors.surfaceVariant, alignItems: 'center' },
  cancelBtnText: { color: Colors.textPrimary, fontFamily: Typography.fontFamily.bold, fontSize: 14 },
  submitBtn: { flex: 2, padding: 14, borderRadius: BorderRadius.md, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  submitBtnText: { color: Colors.background, fontFamily: Typography.fontFamily.bold, fontSize: 14 },
});

export default WalletScreen;
