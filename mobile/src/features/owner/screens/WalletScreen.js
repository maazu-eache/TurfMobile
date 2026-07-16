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

const WalletScreen = ({ navigation }) => {
  const [wallet, setWallet] = useState({ balance: 0, pendingWithdrawal: 0, totalEarned: 0 });
  const [withdrawals, setWithdrawals] = useState([]);
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

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [])
  );

  const fetchData = async () => {
    setLoading(true);
    try {
      const [dashRes, withdrawRes] = await Promise.all([
        api.get('/owners/dashboard'),
        api.get('/owners/wallet/withdrawals')
      ]);
      if (dashRes.data?.data?.wallet) {
        setWallet(dashRes.data.data.wallet);
      }
      if (dashRes.data?.data?.owner?.bankDetails) {
        setBankDetails(dashRes.data.data.owner.bankDetails);
      }
      if (withdrawRes.data?.data) {
        setWithdrawals(withdrawRes.data.data);
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
      await api.post('/owners/wallet/withdraw', { amount });
      showCustomAlert('Success', 'Withdrawal request submitted successfully.');
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
      await api.put('/owners/wallet/bank-details', {
        accountHolder,
        accountNumber,
        ifsc,
        bankName
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
      showCustomAlert('Bank Details Required', 'Please add your bank details before requesting a withdrawal.');
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

  const handleWithdrawalClick = (item) => {
    if (item.status === 'processed') {
      const settleTime = item.processedAt ? moment(item.processedAt).format('MMM Do YYYY, h:mm a') : 'N/A';
      showCustomAlert('Settlement Details', `Reference No (UTR): ${item.transactionRef || 'N/A'}\nSettled At: ${settleTime}`);
    } else if (item.status === 'rejected') {
      showCustomAlert('Withdrawal Rejected', `Reason: ${item.remarks || 'No reason provided'}`);
    }
  };

  const renderWithdrawal = ({ item }) => (
    <TouchableOpacity 
      style={styles.paymentRow} 
      activeOpacity={item.status === 'pending' ? 1 : 0.7}
      onPress={() => handleWithdrawalClick(item)}
    >
      <View>
        <Text style={styles.paymentTurf}>{item.turf?.name || 'Wallet Withdrawal'}</Text>
        <Text style={styles.paymentDate}>{moment(item.createdAt).format('MMM Do YYYY, h:mm a')}</Text>
        {item.status === 'pending' && <DonutTimer createdAt={item.createdAt} />}
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={styles.paymentAmount}>₹{item.amount}</Text>
        <Text style={[styles.paymentStatus, { 
          color: item.status === 'processed' ? Colors.primary : 
                 item.status === 'rejected' ? Colors.error : '#FF9800' 
        }]}>
          {item.status.toUpperCase()}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
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
            <Text style={styles.balanceLabel}>Available Balance</Text>
            <Text style={styles.balanceValue}>₹{wallet.balance.toLocaleString()}</Text>
            <View style={styles.balanceRow}>
              <View>
                <Text style={styles.subLabel}>Pending Withdrawal</Text>
                <Text style={styles.subValue}>₹{wallet.pendingWithdrawal.toLocaleString()}</Text>
              </View>
              <View>
                <Text style={styles.subLabel}>Total Earned</Text>
                <Text style={[styles.subValue, { color: Colors.primary }]}>₹{wallet.totalEarned.toLocaleString()}</Text>
              </View>
            </View>

            <TouchableOpacity 
              style={[styles.withdrawBtn, (wallet.balance <= 0 || !bankDetails?.accountNumber) && styles.withdrawBtnDisabled]}
              onPress={openWithdrawModal}
              disabled={wallet.balance <= 0 || !bankDetails?.accountNumber}
            >
              <Text style={styles.withdrawBtnText}>Request Withdrawal</Text>
            </TouchableOpacity>
          </View>

          {/* Bank Details Section */}
          <View style={styles.bankCard}>
            <View style={styles.bankHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Icon name="bank" size={20} color={Colors.primary} style={{ marginRight: 8 }} />
                <Text style={styles.bankTitle}>Bank Details</Text>
              </View>
              {bankDetails && (
                <TouchableOpacity onPress={openBankModal}>
                  <Icon name="pencil" size={20} color={Colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>

            {bankDetails && bankDetails.accountNumber ? (
              <View style={styles.bankInfo}>
                <Text style={styles.bankText}>Bank: <Text style={{ color: Colors.textPrimary }}>{bankDetails.bankName}</Text></Text>
                <Text style={styles.bankText}>A/C No: <Text style={{ color: Colors.textPrimary }}>XXXXXX{bankDetails.accountNumber.slice(-4)}</Text></Text>
                <Text style={styles.bankText}>IFSC: <Text style={{ color: Colors.textPrimary }}>{bankDetails.ifsc}</Text></Text>
              </View>
            ) : (
              <View style={styles.addBankContainer}>
                <Text style={styles.noBankText}>No bank details added.</Text>
                <TouchableOpacity style={styles.addBankBtn} onPress={openBankModal}>
                  <Text style={styles.addBankBtnText}>+ Add Bank Details</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <Text style={styles.sectionTitle}>Withdrawal History</Text>
          <FlatList
            data={withdrawals}
            keyExtractor={item => item._id}
            renderItem={renderWithdrawal}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 100 }}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No withdrawal requests yet.</Text>
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
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  placeholder="Enter Account Number"
                  placeholderTextColor={Colors.textTertiary}
                  value={bankForm.accountNumber}
                  onChangeText={(text) => setBankForm({ ...bankForm, accountNumber: text })}
                  secureTextEntry={true}
                />
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
    paddingHorizontal: Spacing.lg, paddingTop: 60, paddingBottom: Spacing.md,
    backgroundColor: Colors.backgroundCard, flexDirection: 'row', alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: Colors.border
  },
  backBtn: { padding: 8, marginRight: 8 },
  headerTitle: { fontSize: 20, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary },
  content: { flex: 1, padding: Spacing.lg },
  
  balanceCard: { backgroundColor: Colors.backgroundCard, borderRadius: BorderRadius.lg, padding: Spacing.xl, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  balanceLabel: { fontSize: 14, color: Colors.textSecondary, fontFamily: Typography.fontFamily.medium, marginBottom: 8 },
  balanceValue: { fontSize: 36, color: Colors.textPrimary, fontFamily: Typography.fontFamily.extraBold, marginBottom: Spacing.lg },
  balanceRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: Spacing.lg },
  subLabel: { fontSize: 12, color: Colors.textSecondary, fontFamily: Typography.fontFamily.medium },
  subValue: { fontSize: 16, color: Colors.textPrimary, fontFamily: Typography.fontFamily.bold, marginTop: 4 },
  
  withdrawBtn: { backgroundColor: Colors.primary, paddingVertical: 14, paddingHorizontal: 24, borderRadius: BorderRadius.md, width: '100%', alignItems: 'center' },
  withdrawBtnDisabled: { backgroundColor: Colors.surfaceVariant },
  withdrawBtnText: { color: Colors.background, fontFamily: Typography.fontFamily.bold, fontSize: 16 },

  bankCard: { backgroundColor: Colors.backgroundCard, borderRadius: BorderRadius.lg, padding: Spacing.lg, marginBottom: Spacing.xl, borderWidth: 1, borderColor: Colors.border },
  bankHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  bankTitle: { fontSize: 16, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary },
  bankInfo: { marginTop: Spacing.xs },
  bankText: { fontSize: 14, fontFamily: Typography.fontFamily.medium, color: Colors.textSecondary, marginBottom: 4 },
  
  addBankContainer: { alignItems: 'center', marginTop: Spacing.sm },
  noBankText: { fontSize: 14, color: Colors.textTertiary, fontFamily: Typography.fontFamily.medium, marginBottom: Spacing.sm },
  addBankBtn: { backgroundColor: Colors.surface, paddingVertical: 10, paddingHorizontal: 20, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border },
  addBankBtnText: { color: Colors.primary, fontFamily: Typography.fontFamily.bold, fontSize: 14 },

  sectionTitle: { fontSize: 18, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary, marginBottom: Spacing.md },
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
