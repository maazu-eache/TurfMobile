import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, Modal, Platform, StatusBar } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useDispatch, useSelector } from 'react-redux';
import { logout, setCurrentRole } from '../../auth/authSlice';
import { useTheme, Typography, Spacing, BorderRadius } from '../../../theme/theme';
import { showCustomAlert } from '../../../components/CustomAlert';
import { reset } from '../../../navigation/navigationRef';
import api, { getImageUrl } from '../../../api/axios';

const ProfileScreen = ({ navigation }) => {
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();
  const safeTop = Math.max(insets?.top || 0, Platform.OS === 'ios' ? 44 : 0);
  const { user, currentRole } = useSelector((state) => state.auth);

  // Determine active mode & owner capabilities
  const hasOwnerRole = user?.roles?.includes('owner') || user?.role === 'owner';
  const isOwner = currentRole === 'owner' || (!currentRole && user?.role === 'owner');

  const [loggingOut, setLoggingOut] = useState(false);
  const [moreExpanded, setMoreExpanded] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      StatusBar.setBarStyle(isDark ? 'light-content' : 'dark-content', true);
    }, [isDark])
  );
  const [appearanceModalVisible, setAppearanceModalVisible] = useState(false);
  const { colors, shadows, isDark, themeMode, setThemeMode } = useTheme();

  const handleLogout = () => {
    showCustomAlert(
      "Confirm Logout",
      "Are you sure you want to sign out?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Logout", 
          style: "destructive",
          onPress: async () => {
            setLoggingOut(true);
            await dispatch(logout());
            setLoggingOut(false);
            reset('Customer', { screen: 'Home' });
          }
        }
      ]
    );
  };

  const styles = useMemo(() => createStyles(colors, shadows, isDark), [colors, shadows, isDark]);

  const renderOption = (icon, title, subtitle, onPress, destructive = false, isLoading = false, isSub = false) => (
    <TouchableOpacity 
      style={[styles.optionRow, isSub && styles.subOptionRow]} 
      onPress={onPress} 
      disabled={isLoading}
      activeOpacity={0.7}
    >
      <View style={[
        styles.iconBox, 
        destructive && { backgroundColor: colors.errorLight },
        isSub && styles.subIconBox
      ]}>
        {isLoading ? (
          <ActivityIndicator size="small" color={destructive ? colors.error : colors.primary} />
        ) : (
          <Icon name={icon} size={isSub ? 19 : 22} color={destructive ? colors.error : colors.primary} />
        )}
      </View>
      <View style={styles.optionTextContainer}>
        <Text style={[styles.optionTitle, destructive && { color: colors.error }, isSub && { fontSize: 15 }]}>{title}</Text>
        {subtitle && <Text style={styles.optionSubtitle}>{subtitle}</Text>}
      </View>
      {isLoading ? null : (
        <Icon 
          name="chevron-right" 
          size={isSub ? 20 : 24} 
          color={destructive ? colors.error : colors.textTertiary} 
        />
      )}
    </TouchableOpacity>
  );

  return (
    <View style={[styles.safeArea, { paddingTop: safeTop }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Profile Card */}
          <View style={styles.profileCard}>
            <View style={[styles.avatar, user?.photo && { backgroundColor: 'transparent' }]}>
              {user?.photo ? (
                <Image source={{ uri: getImageUrl(user.photo) }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarText}>{user?.name?.charAt(0)?.toUpperCase() || 'U'}</Text>
              )}
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.name} numberOfLines={1} ellipsizeMode="tail">
                {user?.name?.split(' ')[0] || 'User Name'}
              </Text>
              <Text style={styles.email}>{user?.email || 'user@example.com'}</Text>
              {isOwner && (
                <View style={styles.roleBadge}>
                  <Icon name="shield-star" size={14} color={colors.textOnPrimary} />
                  <Text style={styles.roleText}>Turf Owner</Text>
                </View>
              )}
            </View>
            <TouchableOpacity 
              style={styles.editBtn} 
              onPress={() => navigation.navigate('EditProfile')}
              activeOpacity={0.8}
            >
              <Icon name="pencil" size={18} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Switch Mode for Owners */}
          {/* {hasOwnerRole && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Account Mode</Text>
              {isOwner ? (
                renderOption(
                  'swap-horizontal-bold',
                  'Switch to Player Mode',
                  'Browse turfs, book slots & view cricket stats',
                  () => dispatch(setCurrentRole('customer'))
                )
              ) : (
                renderOption(
                  'swap-horizontal-bold',
                  'Switch to Turf Owner Dashboard',
                  'Manage your turfs, slots, bookings & payouts',
                  () => dispatch(setCurrentRole('owner'))
                )
              )}
            </View>
          )} */}
          {/* Sections */}
          {!isOwner && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Player Profile</Text>
              {renderOption('cricket', 'My Cricket Profile', 'View your career and matches', () => navigation.navigate('PlayerProfile'))}
              {renderOption('account-group', 'My Teams', 'Manage your teams', () => navigation.navigate('TeamList'))}
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account</Text>
            {renderOption(
              isOwner ? 'bank-transfer' : 'wallet', 
              isOwner ? 'Settlements & Payouts' : 'Wallet & Payments', 
              isOwner ? 'My Wallet' : 'Manage balance and methods', 
              () => isOwner ? navigation.navigate('Dashboard', { screen: 'Wallet' }) : navigation.navigate('Wallet')
            )}
            {isOwner && renderOption('account-group', 'My Customers', 'View your unified customer list', () => navigation.navigate('Dashboard', { screen: 'OwnerCustomers' }))}
            {renderOption('calendar-clock', 'Booking History', 'View past and upcoming bookings', () => navigation.navigate('Bookings'))}
            {!isOwner && renderOption('heart', 'Favourites', 'View your favourite turfs', () => navigation.navigate('Favourites'))}
            {renderOption('theme-light-dark', 'App Appearance', themeMode === 'dark' ? 'Dark Theme' : themeMode === 'light' ? 'Light Theme' : 'System Default', () => setAppearanceModalVisible(true))}
            {renderOption('lock-reset', 'Change Password', 'Update your password', () => navigation.navigate('ChangePassword'))}
            {renderOption('bell', 'Notifications', 'Manage alert preferences', () => navigation.navigate('Notifications'))}
            {!isOwner && renderOption('shield-lock-outline', 'Blocked Users', 'Manage blocked accounts', () => navigation.navigate('BlockedUsers'))}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Other</Text>
            
            {/* ── More Expandable Option Row ── */}
            <TouchableOpacity 
              style={styles.optionRow} 
              onPress={() => setMoreExpanded(prev => !prev)}
              activeOpacity={0.7}
            >
              <View style={styles.iconBox}>
                <Icon name="dots-horizontal-circle-outline" size={22} color={colors.primary} />
              </View>
              <View style={styles.optionTextContainer}>
                <Text style={styles.optionTitle}>More</Text>
                <Text style={styles.optionSubtitle}>Support tickets & account actions</Text>
              </View>
              <Icon 
                name={moreExpanded ? "chevron-up" : "chevron-down"} 
                size={24} 
                color={colors.textTertiary} 
              />
            </TouchableOpacity>

            {/* Sub-options indented seamlessly when expanded */}
            {moreExpanded && (
              <View style={styles.subOptionsBlock}>
                {renderOption(
                  'ticket-confirmation-outline', 
                  'Raise a Ticket / Contact Us', 
                  'Get help, report an issue or contact support', 
                  () => navigation.navigate('CreateTicketScreen'),
                  false,
                  false,
                  true
                )}
                {renderOption(
                  'delete-forever', 
                  'Delete Account', 
                  'Permanently delete your account and data', 
                  () => setDeleteModalVisible(true), 
                  true,
                  false,
                  true
                )}
              </View>
            )}

            {renderOption('headset', 'Help & Support', 'Get help with your bookings', () => navigation.navigate('TicketListScreen'))}
            {renderOption('shield-check', 'Privacy Policy', 'Your data and privacy rights', () => navigation.navigate('PrivacyPolicy'))}
            {renderOption('logout', 'Logout', 'Sign out of your account', handleLogout, true, loggingOut)}
          </View>

          {/* Powered by Banner */}
          <View style={styles.poweredByContainer}>
            <Text style={styles.poweredByText}>POWERED BY</Text>
            <Image 
              source={require('../../../../Banner.png')} 
              style={styles.poweredByBanner} 
              resizeMode="contain" 
            />
          </View>
        </ScrollView>
      </View>

      {/* App Appearance Modal */}
      <Modal
        visible={appearanceModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAppearanceModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>App Appearance</Text>
              <TouchableOpacity onPress={() => setAppearanceModalVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Icon name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <View style={styles.themeOptionsList}>
              {[
                { key: 'dark', label: 'Dark Theme', desc: 'Always use dark appearance', icon: 'weather-night' },
                { key: 'light', label: 'Light Theme', desc: 'Always use light appearance', icon: 'white-balance-sunny' },
                { key: 'system', label: 'System Default', desc: 'Match your device system settings', icon: 'cellphone-cog' },
              ].map((opt) => {
                const isSelected = themeMode === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[
                      styles.themeOptionCard,
                      isSelected && styles.themeOptionCardActive,
                    ]}
                    onPress={() => {
                      setThemeMode(opt.key);
                      setAppearanceModalVisible(false);
                    }}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.themeOptionIcon, isSelected && styles.themeOptionIconActive]}>
                      <Icon name={opt.icon} size={22} color={isSelected ? colors.background : colors.textPrimary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.themeOptionTitle, isSelected && styles.themeOptionTitleActive]}>
                        {opt.label}
                      </Text>
                      <Text style={styles.themeOptionDesc}>{opt.desc}</Text>
                    </View>
                    <View style={[styles.radioCircle, isSelected && styles.radioCircleActive]}>
                      {isSelected && <View style={styles.radioDot} />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Account Modal */}
      <Modal 
        visible={deleteModalVisible} 
        transparent 
        animationType="fade" 
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Delete Account</Text>
              <TouchableOpacity onPress={() => setDeleteModalVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Icon name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.modalWarning}>
                ⚠️ WARNING: THIS ACTION CANNOT BE RESTORED OR UNDONE!
              </Text>
              <Text style={styles.modalDescription}>
                Are you absolutely sure you want to delete your account? All your details, score stats, wallets, and transaction history will be permanently erased.
              </Text>
            </View>
            <TouchableOpacity 
              style={styles.deleteButton}
              onPress={async () => {
                setDeletingAccount(true);
                try {
                  await api.delete('/users/delete-account');
                  setDeleteModalVisible(false);
                  setDeletingAccount(false);
                  showCustomAlert(
                    "Account Deleted", 
                    "Your account has been permanently deleted.", 
                    [{
                      text: "OK",
                      onPress: async () => {
                        await dispatch(logout());
                        reset('Customer');
                      }
                    }]
                  );
                } catch (err) {
                  setDeletingAccount(false);
                  showCustomAlert("Error", err.response?.data?.message || "Failed to delete account");
                }
              }}
              disabled={deletingAccount}
              activeOpacity={0.8}
            >
              {deletingAccount ? (
                <ActivityIndicator size="small" color={colors.error} />
              ) : (
                <>
                  <Icon name="delete-forever" size={22} color={colors.error} style={{ marginRight: 8 }} />
                  <Text style={styles.deleteButtonText}>Delete My Account</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const createStyles = (colors, shadows, isDark) => StyleSheet.create({
  safeArea: { 
    flex: 1, 
    backgroundColor: isDark ? colors.backgroundElevated : colors.background,
  },
  container: { 
    flex: 1, 
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
    backgroundColor: isDark ? colors.backgroundElevated : colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { 
    fontSize: Typography.fontSize['2xl'], 
    fontFamily: Typography.fontFamily.bold, 
    color: colors.textPrimary,
  },
  content: { 
    padding: Spacing.xl, 
    paddingBottom: 100,
  },
  profileCard: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: colors.surface, 
    padding: Spacing.lg, 
    borderRadius: BorderRadius.xl, 
    marginBottom: Spacing['2xl'], 
    borderWidth: 1, 
    borderColor: colors.border,
    ...(isDark ? {} : shadows.sm),
  },
  avatar: { 
    width: 64, 
    height: 64, 
    borderRadius: 32, 
    backgroundColor: colors.primaryAlpha20, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginRight: Spacing.md, 
    borderWidth: 1.5, 
    borderColor: colors.primary,
  },
  avatarImage: { 
    width: '100%', 
    height: '100%', 
    borderRadius: 30,
  },
  avatarText: { 
    color: colors.primary, 
    fontFamily: Typography.fontFamily.bold, 
    fontSize: 28,
  },
  profileInfo: { 
    flex: 1,
  },
  name: { 
    color: colors.textPrimary, 
    fontFamily: Typography.fontFamily.bold, 
    fontSize: 18, 
    marginBottom: 2,
  },
  email: { 
    color: colors.textSecondary, 
    fontFamily: Typography.fontFamily.medium, 
    fontSize: 13, 
    marginBottom: 6,
  },
  roleBadge: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: colors.primary, 
    alignSelf: 'flex-start', 
    paddingHorizontal: 8, 
    paddingVertical: 4, 
    borderRadius: 12, 
    gap: 4,
  },
  roleText: { 
    color: colors.textOnPrimary, 
    fontFamily: Typography.fontFamily.bold, 
    fontSize: 10, 
    textTransform: 'uppercase',
  },
  editBtn: { 
    padding: 8, 
    backgroundColor: isDark ? colors.surfaceVariant : colors.surfaceVariant, 
    borderRadius: 20,
    borderWidth: isDark ? 0 : 1,
    borderColor: colors.border,
  },
  section: { 
    marginBottom: Spacing['2xl'],
  },
  sectionTitle: { 
    color: colors.textTertiary, 
    fontFamily: Typography.fontFamily.bold, 
    fontSize: 13, 
    textTransform: 'uppercase', 
    letterSpacing: 1, 
    marginBottom: Spacing.md,
  },
  optionRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: Spacing.md, 
    borderBottomWidth: 1, 
    borderBottomColor: colors.border,
  },
  iconBox: { 
    width: 40, 
    height: 40, 
    borderRadius: 20, 
    backgroundColor: colors.surfaceVariant, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginRight: Spacing.md,
    borderWidth: isDark ? 0 : 1,
    borderColor: colors.borderLight,
  },
  optionTextContainer: { 
    flex: 1,
  },
  optionTitle: { 
    color: colors.textPrimary, 
    fontFamily: Typography.fontFamily.bold, 
    fontSize: 16, 
    marginBottom: 2,
  },
  optionSubtitle: { 
    color: colors.textSecondary, 
    fontFamily: Typography.fontFamily.medium, 
    fontSize: 12,
  },
  modalOverlay: { 
    flex: 1, 
    backgroundColor: colors.blackAlpha50, 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 20,
  },
  modalContent: { 
    backgroundColor: colors.backgroundModal, 
    width: '100%', 
    borderRadius: 16, 
    padding: 20, 
    borderWidth: 1, 
    borderColor: colors.border,
    ...shadows.lg,
  },
  modalHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 20,
  },
  modalTitle: { 
    color: colors.textPrimary, 
    fontFamily: Typography.fontFamily.bold, 
    fontSize: 18,
  },
  modalBody: { 
    marginBottom: 20,
  },
  modalWarning: { 
    color: colors.error, 
    fontFamily: Typography.fontFamily.bold, 
    fontSize: 14, 
    marginBottom: 12, 
    lineHeight: 20,
  },
  modalDescription: { 
    color: colors.textSecondary, 
    fontFamily: Typography.fontFamily.regular, 
    fontSize: 14, 
    marginBottom: 12, 
    lineHeight: 20,
  },
  deleteButton: { 
    backgroundColor: colors.errorLight, 
    paddingVertical: 14, 
    borderRadius: 12, 
    flexDirection: 'row', 
    justifyContent: 'center', 
    alignItems: 'center',
    borderWidth: 1,
    borderColor: isDark ? 'transparent' : 'rgba(244, 67, 54, 0.2)',
  },
  deleteButtonText: { 
    color: colors.error, 
    fontFamily: Typography.fontFamily.bold, 
    fontSize: 16,
  },
  
  /* ── App Appearance Options ── */
  themeOptionsList: {
    gap: 12,
    marginBottom: 8,
  },
  themeOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: 12,
  },
  themeOptionCardActive: {
    borderColor: colors.primary,
    backgroundColor: isDark ? 'rgba(255, 204, 0, 0.08)' : '#FFFBEA',
  },
  themeOptionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.surfaceVariant,
    justifyContent: 'center',
    alignItems: 'center',
  },
  themeOptionIconActive: {
    backgroundColor: colors.primary,
  },
  themeOptionTitle: {
    fontSize: 15,
    fontFamily: Typography.fontFamily.bold,
    color: colors.textPrimary,
  },
  themeOptionTitleActive: {
    color: colors.textPrimary,
  },
  themeOptionDesc: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.regular,
    color: colors.textSecondary,
    marginTop: 2,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.textTertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioCircleActive: {
    borderColor: colors.primary,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  
  // ── More sub-options ──
  subOptionsBlock: {
    paddingLeft: 18,
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.02)' : colors.surfaceVariant,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    borderRadius: isDark ? 0 : BorderRadius.md,
  },
  subOptionRow: {
    borderBottomWidth: 0,
    paddingVertical: 12,
  },
  subIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  
  // ── Powered by Banner ──
  poweredByContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing['2xl'],
    marginBottom: Spacing.xl,
    paddingVertical: Spacing.sm,
  },
  poweredByText: {
    fontSize: 10,
    fontFamily: Typography.fontFamily.semiBold,
    color: colors.textTertiary,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  poweredByBanner: {
    width: 160,
    height: 50,
  },
});

export default ProfileScreen;
