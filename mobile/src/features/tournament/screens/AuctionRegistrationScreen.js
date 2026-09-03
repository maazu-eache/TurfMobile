import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Modal,
  Share,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { launchImageLibrary } from 'react-native-image-picker';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import moment from 'moment';
import { Colors, Spacing, Typography, useTheme } from '../../../theme/theme';
import auctionService from '../../../services/auctionService';
import { useSelector } from 'react-redux';
import RazorpayCheckout from 'react-native-razorpay';
import { RAZORPAY_KEY } from '@env';
import { showCustomAlert } from '../../../components/CustomAlert';
import api from '../../../api/axios';
import ImageCropperModal from '../../../components/ImageCropperModal';

const ROLES = [
  { label: 'All Rounder', icon: 'cricket' },
  { label: 'Batsman', icon: 'baseball-bat' },
  { label: 'Bowler', icon: 'circle-outline' },
  { label: 'Wicket Keeper', icon: 'shield-outline' },
];
const BATTING_STYLES = ['Right Handed', 'Left Handed'];
const BOWLING_STYLES = [
  'Right Arm Fast',
  'Right Arm Medium',
  'Right Arm Off Break',
  'Left Arm Fast',
  'Left Arm Medium',
  'Left Arm Chinaman',
  'N/A',
];

const AuctionRegistrationScreen = ({ route, navigation }) => {
  const { colors, shadows, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, shadows, isDark), [colors, shadows, isDark]);
  const { tournamentId } = route.params || {};

  const [step, setStep] = useState('form');
  const [loading, setLoading] = useState(false);
  const [auction, setAuction] = useState(null);
  const [myRegistration, setMyRegistration] = useState(null);
  const [platformFeePercent, setPlatformFeePercent] = useState(10);
  const { user } = useSelector(state => state.auth);
  const { myProfile } = useSelector(state => state.player);

  const mapBattingStyle = (style) => {
    if (style === 'Right Hand') return 'Right Handed';
    if (style === 'Left Hand') return 'Left Handed';
    return style || 'Right Handed';
  };

  const [fullName, setFullName] = useState(user?.name || '');
  const [role, setRole] = useState(myProfile?.playingRole || user?.playerProfile?.playingRole || 'All Rounder');
  const [battingStyle, setBattingStyle] = useState(mapBattingStyle(myProfile?.battingStyle) || mapBattingStyle(user?.playerProfile?.battingStyle));
  const [bowlingStyle, setBowlingStyle] = useState(myProfile?.bowlingStyle || user?.playerProfile?.bowlingStyle || 'Right Arm Medium');
  const [photo, setPhoto] = useState(null);
  const [agreed, setAgreed] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [cropModalVisible, setCropModalVisible] = useState(false);
  const [tempImageUri, setTempImageUri] = useState('');

  const isRegistrationClosed = auction?.registrationEndDate
    ? moment().isAfter(moment.utc(auction.registrationEndDate).endOf('day'))
    : false;

  const formatEndDate = (dateStr) => {
    if (!dateStr) return 'No deadline';
    return moment.utc(dateStr).format('D MMM YYYY');
  };

  useEffect(() => {
    fetchAuctionData();
    api.get('/admin/public-settings').then(res => {
      if (res.data?.data?.auctionPlatformFeePercent !== undefined) {
        setPlatformFeePercent(res.data.data.auctionPlatformFeePercent);
      }
    }).catch(console.error);
  }, [tournamentId]);

  const fetchAuctionData = async () => {
    setLoading(true);
    try {
      if (tournamentId) {
        const res = await auctionService.getAuctionDetails(tournamentId);
        if (res.data?.exists) {
          setAuction(res.data);
          if (res.data._id) {
            try {
              const regRes = await auctionService.getMyRegistration(res.data._id);
              if (regRes.data) {
                setMyRegistration(regRes.data);
                setStep('my_reg');
              }
            } catch (e) {}
          }
        }
      }
    } catch (err) {
      console.log('Error fetching auction:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePickPhoto = () => {
    launchImageLibrary({ mediaType: 'photo', quality: 0.8 }, (response) => {
      if (response.didCancel) return;
      if (response.errorMessage) {
        showCustomAlert('Error', response.errorMessage);
        return;
      }
      if (response.assets && response.assets.length > 0) {
        const selected = response.assets[0];
        if (selected.fileSize && selected.fileSize > 3 * 1024 * 1024) {
          showCustomAlert('File Too Large', 'Please select an image smaller than 3MB.');
          return;
        }
        setTempImageUri(selected.uri);
        setCropModalVisible(true);
      }
    });
  };

  const handleProceedToPay = async () => {
    if (!fullName.trim()) {
      showCustomAlert('Error', 'Please enter your full name');
      return;
    }
    if (!photo && !user?.avatar) {
      showCustomAlert('Error', 'Please upload a player photo');
      return;
    }
    if (photo && photo.fileSize > 3 * 1024 * 1024) {
      showCustomAlert('Error', 'Photo size must be less than 3MB');
      return;
    }
    if (!agreed) {
      showCustomAlert('Error', 'You must agree to the terms');
      return;
    }
    setLoading(true);
    const totalAmount = auction?.registrationFee || 0;
    const options = {
      description: `Registration for ${auction?.tournament?.name || 'Tournament'}`,
      image: 'https://i.imgur.com/3g7nmJC.png',
      currency: 'INR',
      key: RAZORPAY_KEY,
      amount: totalAmount * 100,
      name: 'ScoreVerse',
      prefill: {
        email: user?.email || '',
        contact: user?.mobile || '',
        name: fullName,
      },
      theme: { color: colors.primary },
    };
    RazorpayCheckout.open(options).then(async (data) => {
      try {
        const formData = new FormData();
        formData.append('fullName', fullName);
        formData.append('role', role);
        formData.append('battingStyle', battingStyle);
        formData.append('bowlingStyle', bowlingStyle);
        formData.append('paymentId', data.razorpay_payment_id);
        
        if (photo?.uri) {
          formData.append('photo', {
            uri: photo.uri,
            type: photo.type || 'image/jpeg',
            name: photo.fileName || 'photo.jpg',
          });
        }

        const res = await auctionService.registerPlayer(auction._id, formData);
        if (res.data) {
          setMyRegistration(res.data);
          setStep('success');
        }
      } catch (err) {
        showCustomAlert('Error', err.response?.data?.message || 'Failed to complete registration');
      } finally {
        setLoading(false);
      }
    }).catch((error) => {
      setLoading(false);
      if (error.code !== 0) {
        showCustomAlert('Payment Failed', error.description || 'Payment was unsuccessful');
      }
    });
  };

  const handleShare = async () => {
    try {
      const link = `https://www.scoreverse.in/tournament/${tournamentId}/register`;
      await Share.share({
        message: `Register for ${auction?.tournament?.name || 'the tournament'} on ScoreVerse!\nJoin here: ${link}`,
        title: 'Share Tournament',
      });
    } catch (error) {
      console.log('Error sharing:', error);
    }
  };

  if (loading && !auction) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading auction details...</Text>
      </SafeAreaView>
    );
  }

  const entryFee = auction?.registrationFee || 0;
  const platformFee = Math.round(entryFee * (platformFeePercent / 100));
  const baseFee = entryFee - platformFee;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Icon name="arrow-left" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Player Registration</Text>
        <TouchableOpacity onPress={handleShare} style={styles.headerBtn}>
          <Icon name="share-variant-outline" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* ── FORM STEP ── */}
      {step === 'form' && (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Tournament Info Card */}
          <View style={styles.tournamentCard}>
            <View style={styles.tournamentCardTop}>
              <View style={styles.auctionBadge}>
                <Icon name="gavel" size={12} color={colors.primary} />
                <Text style={styles.auctionBadgeText}>AUCTION</Text>
              </View>
              <TouchableOpacity onPress={handleShare} style={styles.shareBtn}>
                <Icon name="share-variant-outline" size={16} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.tournamentName} numberOfLines={2}>
              {auction?.tournament?.name || 'Tournament Auction'}
            </Text>
            <View style={styles.infoStrip}>
              <View style={styles.infoStripItem}>
                <Icon name="currency-inr" size={14} color={colors.textTertiary} />
                <View>
                  <Text style={styles.infoStripLabel}>Entry Fee</Text>
                  <Text style={styles.infoStripValue}>₹{entryFee}</Text>
                </View>
              </View>
              <View style={styles.infoStripDivider} />
              <View style={styles.infoStripItem}>
                <Icon
                  name={isRegistrationClosed ? 'lock' : 'calendar-clock'}
                  size={14}
                  color={isRegistrationClosed ? colors.error : colors.textTertiary}
                />
                <View>
                  <Text style={styles.infoStripLabel}>
                    {isRegistrationClosed ? 'Ended On' : 'Closes On'}
                  </Text>
                  <Text style={[styles.infoStripValue, isRegistrationClosed && { color: colors.error }]}>
                    {formatEndDate(auction?.registrationEndDate)}
                  </Text>
                </View>
              </View>
            </View>
            {isRegistrationClosed && (
              <View style={styles.closedPill}>
                <Icon name="lock-outline" size={13} color={colors.error} />
                <Text style={styles.closedPillText}>Registration Closed</Text>
              </View>
            )}
          </View>

          {isRegistrationClosed ? (
            /* Closed State */
            <View style={styles.closedCard}>
              <View style={styles.closedIconRing}>
                <Icon name="lock-outline" size={36} color={colors.error} />
              </View>
              <Text style={styles.closedTitle}>Registration Closed</Text>
              <Text style={styles.closedSub}>
                The registration window ended on{'\n'}{formatEndDate(auction?.registrationEndDate)}.
              </Text>
              <Text style={styles.closedHint}>You can still watch the live auction stream.</Text>
            </View>
          ) : (
            <>
              {/* Fee Breakdown
              <View style={styles.feeCard}>
                <View style={styles.feeCardRow}>
                  <View style={styles.feeCardItem}>
                    <Text style={styles.feeCardLabel}>Base Entry Fee</Text>
                    <Text style={styles.feeCardAmount}>₹{baseFee}</Text>
                  </View>
                  <View style={styles.feeCardSep} />
                  <View style={styles.feeCardItem}>
                    <Text style={styles.feeCardLabel}>Platform Fee ({platformFeePercent}%)</Text>
                    <Text style={styles.feeCardAmount}>₹{platformFee}</Text>
                  </View>
                  <View style={styles.feeCardSep} />
                  <View style={styles.feeCardItem}>
                    <Text style={styles.feeCardLabel}>Total Payable</Text>
                    <Text style={[styles.feeCardAmount, styles.feeCardTotal]}>₹{entryFee}</Text>
                  </View>
                </View>
              </View> */}

              {/* Form Card */}
              <View style={styles.formCard}>
                <Text style={styles.formCardTitle}>Your Details</Text>

                {/* Player Photo */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>PLAYER PHOTO *</Text>
                  <View style={{ alignItems: 'flex-start', marginTop: 8 }}>
                    <TouchableOpacity onPress={handlePickPhoto} style={styles.photoBox}>
                      {photo || user?.avatar ? (
                        <Image source={photo ? { uri: photo.uri } : { uri: user.avatar }} style={styles.photoImg} />
                      ) : (
                        <View style={{ alignItems: 'center', justifyContent: 'center', flex: 1 }}>
                          <Icon name="camera-plus" size={28} color={colors.primary} />
                          <Text style={{ color: colors.textSecondary, fontSize: 10, marginTop: 4 }}>Add Photo</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  </View>
                  <Text style={{ color: colors.primary, fontSize: 12, marginTop: 6, fontFamily: Typography.fontFamily.medium }}>
                    Note: Maximum image size allowed is under 3 MB.
                  </Text>
                </View>

                {/* Full Name */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>FULL NAME</Text>
                  <View style={styles.inputWrapper}>
                    <Icon name="account-outline" size={18} color={colors.textTertiary} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      value={fullName}
                      onChangeText={setFullName}
                      placeholder="Enter your full name"
                      placeholderTextColor={colors.textTertiary}
                    />
                  </View>
                </View>

                {/* Mobile */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>MOBILE NUMBER</Text>
                  <View style={[styles.inputWrapper, styles.inputWrapperReadonly]}>
                    <Icon name="phone-outline" size={18} color={colors.textTertiary} style={styles.inputIcon} />
                    <Text style={styles.readonlyText}>{user?.mobile || 'Not available'}</Text>
                    <View style={styles.verifiedPill}>
                      <Icon name="shield-check" size={12} color={colors.success} />
                      <Text style={styles.verifiedText}> Verified</Text>
                    </View>
                  </View>
                </View>

                {/* Divider */}
                <View style={styles.sectionDivider}>
                  <View style={styles.sectionDividerLine} />
                  <Text style={styles.sectionDividerText}>Playing Profile</Text>
                  <View style={styles.sectionDividerLine} />
                </View>

                {/* Role */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>PLAYING ROLE</Text>
                  <View style={styles.roleGrid}>
                    {ROLES.map((r) => {
                      const active = role === r.label;
                      return (
                        <TouchableOpacity
                          key={r.label}
                          style={[styles.roleCard, active && styles.roleCardActive]}
                          onPress={() => setRole(r.label)}
                        >
                          <Icon
                            name={r.icon}
                            size={20}
                            color={active ? colors.primary : colors.textTertiary}
                          />
                          <Text style={[styles.roleCardText, active && styles.roleCardTextActive]}>
                            {r.label}
                          </Text>
                          {active && (
                            <View style={styles.roleCardCheck}>
                              <Icon name="check-circle" size={14} color={colors.primary} />
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Batting Style */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>BATTING STYLE</Text>
                  <View style={styles.chipRow}>
                    {BATTING_STYLES.map((b) => {
                      const active = battingStyle === b;
                      return (
                        <TouchableOpacity
                          key={b}
                          style={[styles.chip, active && styles.chipActive]}
                          onPress={() => setBattingStyle(b)}
                        >
                          <Icon
                            name={b === 'Right Handed' ? 'hand-pointing-right' : 'hand-pointing-left'}
                            size={15}
                            color={active ? colors.white : colors.textSecondary}
                          />
                          <Text style={[styles.chipText, active && styles.chipTextActive]}> {b}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Bowling Style */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>BOWLING STYLE</Text>
                  <View style={styles.chipWrap}>
                    {BOWLING_STYLES.map((bs) => {
                      const active = bowlingStyle === bs;
                      return (
                        <TouchableOpacity
                          key={bs}
                          style={[styles.chip, active && styles.chipActive]}
                          onPress={() => setBowlingStyle(bs)}
                        >
                          <Text style={[styles.chipText, active && styles.chipTextActive]}>{bs}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Terms */}
                <TouchableOpacity
                  style={[styles.termsRow, agreed && styles.termsRowAgreed]}
                  onPress={() => setShowTermsModal(true)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.termsCheckbox, agreed && styles.termsCheckboxAgreed]}>
                    {agreed
                      ? <Icon name="check" size={14} color={colors.white} />
                      : null}
                  </View>
                  <Text style={styles.termsText}>
                    I have read and agree to the{' '}
                    <Text style={styles.termsLink}>Terms & Conditions</Text>
                  </Text>
                  <Icon name="chevron-right" size={18} color={colors.textTertiary} />
                </TouchableOpacity>
              </View>

              {/* Pay Button */}
              <TouchableOpacity
                style={[styles.payBtn, (!agreed || loading) && styles.payBtnDisabled]}
                onPress={handleProceedToPay}
                disabled={!agreed || loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <View style={styles.payBtnInner}>
                    <ActivityIndicator color="#000" />
                    <Text style={[styles.payBtnText, { marginLeft: 8 }]}>PROCESSING...</Text>
                  </View>
                ) : (
                  <View style={styles.payBtnInner}>
                    <Icon name="lock" size={18} color={agreed ? '#000' : colors.textTertiary} />
                    <Text style={[styles.payBtnText, !agreed && { color: colors.textTertiary }]}>
                      {`  PAY ₹${entryFee} SECURELY`}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
              <Text style={styles.payNote}>Powered by Razorpay · 100% Secure</Text>
            </>
          )}
        </ScrollView>
      )}

      {/* ── SUCCESS STEP ── */}
      {step === 'success' && (
        <ScrollView
          contentContainerStyle={styles.successScreen}
          showsVerticalScrollIndicator={false}
        >
          {/* Celebration Header */}
          <View style={styles.celebrationHeader}>
            {/* Decorative dots */}
            <View style={[styles.confettiDot, { top: 20, left: 30, backgroundColor: colors.primary }]} />
            <View style={[styles.confettiDot, { top: 40, right: 50, backgroundColor: colors.warning, width: 8, height: 8 }]} />
            <View style={[styles.confettiDot, { top: 10, right: 30, backgroundColor: colors.success }]} />
            <View style={[styles.confettiDot, { top: 60, left: 60, backgroundColor: colors.error, width: 6, height: 6 }]} />

            {/* Icon */}
            <View style={styles.successOuterRing}>
              <View style={styles.successInnerRing}>
                <View style={styles.successCircle}>
                  <Icon name="check-bold" size={36} color={colors.white} />
                </View>
              </View>
            </View>

            <Text style={styles.successEmoji}>🎉</Text>
            <Text style={styles.successTitle}>You're In!</Text>
            <Text style={styles.successSub}>
              Congratulations! You've successfully{'\n'}registered for
            </Text>
            <View style={styles.successTournamentBadge}>
              <Icon name="trophy" size={14} color={colors.primary} />
              <Text style={styles.successTournamentName}>
                {auction?.tournament?.name || 'the auction'}
              </Text>
            </View>
          </View>

          {/* Receipt Card */}
          <View style={styles.receiptCard}>
            {/* Top stripe */}
            <View style={styles.receiptStripe}>
              <Icon name="receipt" size={16} color={colors.white} />
              <Text style={styles.receiptStripeText}>Payment Receipt</Text>
              <View style={styles.receiptStripePill}>
                <View style={styles.receiptStripeDot} />
                <Text style={styles.receiptStripeStatus}>CONFIRMED</Text>
              </View>
            </View>

            <View style={styles.receiptBody}>
              {/* Amount */}
              <View style={styles.receiptAmountRow}>
                <View>
                  <Text style={styles.receiptAmountLabel}>Amount Paid</Text>
                  <Text style={styles.receiptAmountValue}>
                    ₹{myRegistration?.registrationFee ?? entryFee}
                  </Text>
                </View>
                <View style={styles.receiptAmountIcon}>
                  <Icon name="check-circle" size={28} color={colors.success} />
                </View>
              </View>

              <View style={styles.receiptDividerDashed} />

              {/* Detail rows */}
              {[
                { label: 'Tournament', value: auction?.tournament?.name || '—', icon: 'trophy-outline' },
                { label: 'Player', value: fullName || myRegistration?.fullName || '—', icon: 'account-outline' },
                { label: 'Role', value: role || myRegistration?.role || '—', icon: 'cricket' },
                { label: 'Receipt ID', value: myRegistration?.receiptId || '—', icon: 'identifier', mono: true },
              ].map((item, idx) => (
                <View key={idx} style={styles.receiptDetailRow}>
                  <View style={styles.receiptDetailIcon}>
                    <Icon name={item.icon} size={14} color={colors.textTertiary} />
                  </View>
                  <Text style={styles.receiptDetailLabel}>{item.label}</Text>
                  <Text
                    style={[styles.receiptDetailValue, item.mono && styles.receiptDetailMono]}
                    numberOfLines={1}
                  >
                    {item.value}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* Next Steps */}
          <View style={styles.nextStepsCard}>
            <Text style={styles.nextStepsTitle}>What's Next?</Text>
            {[
              { icon: 'gavel', text: 'Wait for the auction to go live' },
              { icon: 'account-group', text: 'Teams will bid for your player profile' },
              { icon: 'trophy-outline', text: 'Get picked and represent your team!' },
            ].map((s, i) => (
              <View key={i} style={styles.nextStep}>
                <View style={styles.nextStepIcon}>
                  <Icon name={s.icon} size={16} color={colors.primary} />
                </View>
                <Text style={styles.nextStepText}>{s.text}</Text>
              </View>
            ))}
          </View>

          {/* CTA */}
          <TouchableOpacity
            style={styles.payBtn}
            onPress={() => setStep('my_reg')}
            activeOpacity={0.85}
          >
            <Icon name="card-account-details-outline" size={20} color={colors.white} />
            <Text style={[styles.payBtnText, { marginLeft: 8 }]}>VIEW MY REGISTRATION</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.shareFullBtn} onPress={handleShare}>
            <Icon name="share-variant-outline" size={16} color={colors.primary} />
            <Text style={styles.shareFullBtnText}>Share with friends</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* ── MY REGISTRATION STEP ── */}
      {step === 'my_reg' && (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Registered Banner */}
          <View style={styles.registeredBanner}>
            <View style={styles.registeredIconWrap}>
              <Icon name="trophy-outline" size={28} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.registeredBannerTitle}>You're Registered!</Text>
              <Text style={styles.registeredBannerSub}>
                {auction?.tournament?.name || 'Tournament Auction'}
              </Text>
            </View>
            <View style={styles.registeredDot} />
          </View>

          {/* Detail Card */}
          <View style={styles.detailCard}>
            <Text style={styles.detailCardTitle}>Registration Details</Text>

            {[
              { icon: 'account', label: 'Full Name', value: myRegistration?.fullName || '—' },
              { icon: 'cricket', label: 'Playing Role', value: myRegistration?.role || '—' },
              { icon: 'baseball-bat', label: 'Batting Style', value: myRegistration?.battingStyle || '—' },
              { icon: 'circle-outline', label: 'Bowling Style', value: myRegistration?.bowlingStyle || '—' },
            ].map((item, idx) => (
              <View key={idx} style={[styles.detailRow, idx > 0 && styles.detailRowBorder]}>
                <View style={styles.detailIconWrap}>
                  <Icon name={item.icon} size={16} color={colors.primary} />
                </View>
                <Text style={styles.detailLabel}>{item.label}</Text>
                <Text style={styles.detailValue}>{item.value}</Text>
              </View>
            ))}

            <View style={styles.detailSep} />

            {/* Payment Info */}
            <View style={styles.paymentInfo}>
              <View style={styles.paymentInfoRow}>
                <Text style={styles.paymentInfoLabel}>Entry Fee</Text>
                <Text style={styles.paymentInfoAmount}>
                  ₹{myRegistration?.registrationFee !== undefined
                    ? myRegistration.registrationFee
                    : entryFee}
                </Text>
              </View>
              <View style={styles.paymentInfoRow}>
                <Text style={styles.paymentInfoLabel}>Payment Status</Text>
                <View style={styles.paidPill}>
                  <Icon name="check-circle" size={13} color={colors.success} />
                  <Text style={styles.paidPillText}> Paid</Text>
                </View>
              </View>
              <View style={styles.paymentInfoRow}>
                <Text style={styles.paymentInfoLabel}>Receipt ID</Text>
                <Text style={styles.paymentInfoReceipt}>{myRegistration?.receiptId || '—'}</Text>
              </View>
            </View>
          </View>

          {/* Share */}
          <TouchableOpacity style={styles.shareFullBtn} onPress={handleShare}>
            <Icon name="share-variant-outline" size={18} color={colors.primary} />
            <Text style={styles.shareFullBtnText}>Share with friends</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* Terms Modal */}
      <Modal visible={showTermsModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Terms & Conditions</Text>
            <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
              {[
                'Player registration is final. Entry fees are non-refundable unless the tournament is cancelled by the organizer.',
                'By registering, you agree to follow all rules and regulations set by the tournament organizers.',
                'The platform is not responsible for any disputes between players and organizers.',
                'Any unsporting behavior may lead to immediate disqualification without refund.',
                'Your profile details shared here will be visible to the tournament organizer.',
              ].map((t, i) => (
                <View key={i} style={styles.termItem}>
                  <Text style={styles.termNumber}>{i + 1}.</Text>
                  <Text style={styles.termText}>{t}</Text>
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.agreeBtn}
              onPress={() => {
                setAgreed(true);
                setShowTermsModal(false);
              }}
            >
              <Icon name="check-circle-outline" size={18} color={colors.white} />
              <Text style={styles.agreeBtnText}> I AGREE & CONTINUE</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.declineBtn}
              onPress={() => setShowTermsModal(false)}
            >
              <Text style={styles.declineBtnText}>Decline</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ImageCropperModal
        visible={cropModalVisible}
        imageUri={tempImageUri}
        onClose={() => setCropModalVisible(false)}
        onCrop={(croppedUri) => {
          setPhoto({
            uri: croppedUri,
            fileName: 'auction_profile.jpg',
            type: 'image/jpeg'
          });
          setCropModalVisible(false);
        }}
      />
    </SafeAreaView>
  );
};

const createStyles = (colors, shadows, isDark) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingScreen: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  loadingText: { color: colors.textSecondary, marginTop: 12, fontSize: 14 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary },

  scrollContent: { padding: 16, paddingBottom: 32 },

  // Tournament Card
  tournamentCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tournamentCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  auctionBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: `${colors.primary}22`, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, gap: 4 },
  auctionBadgeText: { color: colors.primary, fontSize: 10, fontFamily: Typography.fontFamily.bold, letterSpacing: 1 },
  shareBtn: { padding: 6 },
  tournamentName: { fontSize: 20, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary, marginBottom: 14 },
  infoStrip: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 14, overflow: 'hidden' },
  infoStripItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 },
  infoStripDivider: { width: 1, backgroundColor: colors.border, marginVertical: 10 },
  infoStripLabel: { color: colors.textTertiary, fontSize: 11 },
  infoStripValue: { color: colors.textPrimary, fontSize: 15, fontFamily: Typography.fontFamily.bold },
  closedPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, marginTop: 10, alignSelf: 'flex-start', gap: 4 },
  closedPillText: { color: colors.error, fontSize: 12, fontFamily: Typography.fontFamily.bold },

  // Fee Card
  feeCard: {
    backgroundColor: colors.primary,
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
  },
  feeCardRow: { flexDirection: 'row', alignItems: 'center' },
  feeCardItem: { flex: 1, alignItems: 'center' },
  feeCardSep: { width: 1, height: 36, backgroundColor: 'rgba(255,255,255,0.25)' },
  feeCardLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 11, marginBottom: 3 },
  feeCardAmount: { color: colors.white, fontSize: 17, fontFamily: Typography.fontFamily.bold },
  feeCardTotal: { fontSize: 22 },

  // Form Card
  formCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 14,
  },
  formCardTitle: { fontSize: 15, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary, marginBottom: 16 },

  fieldGroup: { marginBottom: 16 },
  fieldLabel: { fontSize: 10, fontFamily: Typography.fontFamily.bold, color: colors.textTertiary, letterSpacing: 1.2, marginBottom: 8 },

  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    height: 50,
  },
  inputWrapperReadonly: { backgroundColor: `${colors.surface}cc` },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, color: colors.textPrimary, fontSize: 15 },
  readonlyText: { flex: 1, color: colors.textPrimary, fontSize: 15 },
  verifiedPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(34,197,94,0.12)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  verifiedText: { color: colors.success, fontSize: 11, fontFamily: Typography.fontFamily.bold },

  sectionDivider: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, marginTop: 4 },
  sectionDividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  sectionDividerText: { color: colors.textTertiary, fontSize: 11, fontFamily: Typography.fontFamily.bold, marginHorizontal: 10, letterSpacing: 0.8 },

  // Role cards
  roleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    position: 'relative',
  },
  roleCardActive: { borderColor: colors.primary, backgroundColor: `${colors.primary}15` },
  roleCardText: { color: colors.textSecondary, fontSize: 13 },
  roleCardTextActive: { color: colors.primary, fontFamily: Typography.fontFamily.bold },
  roleCardCheck: { position: 'absolute', top: -5, right: -5 },

  // Chips
  chipRow: { flexDirection: 'row', gap: 8 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.textSecondary, fontSize: 13 },
  chipTextActive: { color: colors.white, fontFamily: Typography.fontFamily.bold },

  // Terms
  termsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 4,
    gap: 10,
  },
  termsRowAgreed: { borderColor: colors.primary, backgroundColor: `${colors.primary}10` },
  termsCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  termsCheckboxAgreed: { backgroundColor: colors.primary, borderColor: colors.primary },
  termsText: { flex: 1, color: colors.textSecondary, fontSize: 13 },
  termsLink: { color: colors.primary, fontFamily: Typography.fontFamily.bold, textDecorationLine: 'underline' },

  // Pay Button
  payBtn: {
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    ...Platform.select({
      ios: { shadowColor: colors.primary, shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 5 } },
      android: { elevation: 6 },
    }),
  },
  payBtnDisabled: { backgroundColor: colors.surface, elevation: 0, shadowOpacity: 0 },
  payBtnInner: { flexDirection: 'row', alignItems: 'center' },
  payBtnText: { color: '#000', fontSize: 16, fontFamily: Typography.fontFamily.bold, letterSpacing: 0.5 },
  payNote: { textAlign: 'center', color: colors.textTertiary, fontSize: 12, marginBottom: 4 },

  // Closed card
  closedCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.25)',
    marginBottom: 16,
  },
  closedIconRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 2,
    borderColor: 'rgba(239,68,68,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  closedTitle: { fontSize: 20, fontFamily: Typography.fontFamily.bold, color: colors.error, marginBottom: 8 },
  closedSub: { color: colors.textSecondary, fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 8 },
  closedHint: { color: colors.textTertiary, fontSize: 13, textAlign: 'center' },

  // Success Screen
  successScreen: { flexGrow: 1, padding: 20, paddingBottom: 36 },

  // Celebration Header
  celebrationHeader: {
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 24,
    position: 'relative',
  },
  confettiDot: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    opacity: 0.6,
  },
  successOuterRing: {
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(34,197,94,0.08)',
    borderWidth: 2,
    borderColor: 'rgba(34,197,94,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  successInnerRing: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(34,197,94,0.15)',
    borderWidth: 2,
    borderColor: 'rgba(34,197,94,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  successCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.success,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: { shadowColor: colors.success, shadowOpacity: 0.5, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } },
      android: { elevation: 8 },
    }),
  },
  successEmoji: { fontSize: 32, marginVertical: 10 },
  successTitle: { fontSize: 30, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary, marginBottom: 6 },
  successSub: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 10 },
  successTournamentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: `${colors.primary}18`,
    borderWidth: 1,
    borderColor: `${colors.primary}30`,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  successTournamentName: { color: colors.primary, fontSize: 13, fontFamily: Typography.fontFamily.bold },

  // Receipt Card
  receiptCard: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: 14,
  },
  receiptStripe: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  receiptStripeText: { flex: 1, color: colors.white, fontSize: 14, fontFamily: Typography.fontFamily.bold },
  receiptStripePill: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3, gap: 5 },
  receiptStripeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success },
  receiptStripeStatus: { color: colors.white, fontSize: 10, fontFamily: Typography.fontFamily.bold, letterSpacing: 0.8 },
  receiptBody: { padding: 16 },
  receiptAmountRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  receiptAmountLabel: { color: colors.textTertiary, fontSize: 12, marginBottom: 4 },
  receiptAmountValue: { fontSize: 32, fontFamily: Typography.fontFamily.bold, color: colors.success },
  receiptAmountIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(34,197,94,0.12)', justifyContent: 'center', alignItems: 'center' },
  receiptDividerDashed: { height: 1, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed', marginBottom: 14 },
  receiptDetailRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 10 },
  receiptDetailIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center' },
  receiptDetailLabel: { flex: 1, color: colors.textSecondary, fontSize: 13 },
  receiptDetailValue: { color: colors.textPrimary, fontSize: 13, fontFamily: Typography.fontFamily.bold, maxWidth: '50%', textAlign: 'right' },
  receiptDetailMono: { fontFamily: 'monospace', color: colors.textTertiary, fontSize: 12 },

  // Next Steps
  nextStepsCard: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
  },
  nextStepsTitle: { fontSize: 14, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary, marginBottom: 12 },
  nextStep: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  nextStepIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: `${colors.primary}15`, justifyContent: 'center', alignItems: 'center' },
  nextStepText: { color: colors.textSecondary, fontSize: 13, flex: 1 },

  paidPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(34,197,94,0.12)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  paidPillText: { color: colors.success, fontSize: 13, fontFamily: Typography.fontFamily.bold },

  // My Registration
  registeredBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${colors.primary}18`,
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: `${colors.primary}30`,
    gap: 12,
  },
  registeredIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: `${colors.primary}20`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  registeredBannerTitle: { fontSize: 16, fontFamily: Typography.fontFamily.bold, color: colors.primary },
  registeredBannerSub: { color: colors.textSecondary, fontSize: 13, marginTop: 2 },
  registeredDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.success },

  detailCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 14,
  },
  detailCardTitle: { fontSize: 15, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary, marginBottom: 14 },
  detailRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
  detailRowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  detailIconWrap: { width: 32, height: 32, borderRadius: 16, backgroundColor: `${colors.primary}15`, justifyContent: 'center', alignItems: 'center' },
  detailLabel: { flex: 1, color: colors.textSecondary, fontSize: 14 },
  detailValue: { color: colors.textPrimary, fontSize: 14, fontFamily: Typography.fontFamily.bold, maxWidth: '50%', textAlign: 'right' },
  detailSep: { height: 1, backgroundColor: colors.border, marginVertical: 8 },

  paymentInfo: { gap: 2 },
  paymentInfoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  paymentInfoLabel: { color: colors.textSecondary, fontSize: 14 },
  paymentInfoAmount: { fontSize: 20, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary },
  paymentInfoReceipt: { color: colors.textTertiary, fontSize: 12, maxWidth: '60%', textAlign: 'right' },

  shareFullBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}10`,
    marginBottom: 8,
  },
  shareFullBtnText: { color: colors.primary, fontSize: 15, fontFamily: Typography.fontFamily.bold },

  photoBox: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: `${colors.primary}15`,
    borderWidth: 1,
    borderColor: `${colors.primary}30`,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  photoImg: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 36,
  },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary, marginBottom: 16 },
  termItem: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  termNumber: { color: colors.primary, fontFamily: Typography.fontFamily.bold, fontSize: 14, marginTop: 1 },
  termText: { flex: 1, color: colors.textSecondary, fontSize: 14, lineHeight: 22 },
  agreeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: 14,
    backgroundColor: colors.primary,
    marginTop: 20,
    marginBottom: 10,
  },
  agreeBtnText: { color: colors.white, fontSize: 15, fontFamily: Typography.fontFamily.bold },
  declineBtn: { alignItems: 'center', paddingVertical: 8 },
  declineBtnText: { color: colors.textTertiary, fontSize: 14 },
});

export default AuctionRegistrationScreen;
