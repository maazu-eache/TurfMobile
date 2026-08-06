import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from '../../../components/SolidGradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useDispatch, useSelector } from 'react-redux';
import { logout } from '../../auth/authSlice';
import { Colors, Typography, Spacing, BorderRadius } from '../../../theme/theme';
import { showCustomAlert } from '../../../components/CustomAlert';
import { navigate, reset } from '../../../navigation/navigationRef';
import api, { getImageUrl } from '../../../api/axios';

const ProfileScreen = ({ navigation }) => {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  
  // Determine role based on permissions or selection (here derived from user object if available)
  const isOwner = user?.roles?.includes('owner');

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
            if (!isOwner) {
              navigation.navigate('Home');
            }
            await dispatch(logout());
          }
        }
      ]
    );
  };



  const renderOption = (icon, title, subtitle, onPress, destructive = false) => (
    <TouchableOpacity style={styles.optionRow} onPress={onPress}>
      <View style={[styles.iconBox, destructive && {backgroundColor: 'rgba(244,67,54,0.1)'}]}>
        <Icon name={icon} size={22} color={destructive ? Colors.error : Colors.primary} />
      </View>
      <View style={styles.optionTextContainer}>
        <Text style={[styles.optionTitle, destructive && {color: Colors.error}]}>{title}</Text>
        {subtitle && <Text style={styles.optionSubtitle}>{subtitle}</Text>}
      </View>
      <Icon name="chevron-right" size={24} color={destructive ? Colors.error : Colors.textSecondary} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Profile Card */}
          <View style={styles.profileCard}>
            <View style={[styles.avatar, user?.photo && { backgroundColor: 'transparent' }]}>
              {user?.photo ? (
                <Image source={{ uri: getImageUrl(user.photo) }} style={{ width: '100%', height: '100%', borderRadius: 30 }} />
              ) : (
                <Text style={styles.avatarText}>{user?.name?.charAt(0)?.toUpperCase() || 'U'}</Text>
              )}
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.name}>{user?.name || 'User Name'}</Text>
              <Text style={styles.email}>{user?.email || 'user@example.com'}</Text>
              {isOwner && (
                <View style={styles.roleBadge}>
                  <Icon name="shield-star" size={14} color="#000" />
                  <Text style={styles.roleText}>Turf Owner</Text>
                </View>
              )}
            </View>
            <TouchableOpacity style={styles.editBtn} onPress={() => navigation.navigate('EditProfile')}>
              <Icon name="pencil" size={20} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Sections */}
          {!isOwner && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Player Profile</Text>
              {renderOption('cricket', 'Cricket Stats', 'View your career and matches', () => navigation.navigate('PlayerProfile'))}
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
            {renderOption('lock-reset', 'Change Password', 'Update your password', () => navigation.navigate('ChangePassword'))}
            {renderOption('bell', 'Notifications', 'Manage alert preferences', () => navigation.navigate('Notifications'))}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Other</Text>
            {renderOption('headset', 'Help & Support', 'Get help with your bookings', () => navigation.navigate('TicketListScreen'))}
            {renderOption('shield-check', 'Privacy Policy', 'Your data and privacy rights', () => navigation.navigate('PrivacyPolicy'))}
            {renderOption('logout', 'Logout', 'Sign out of your account', handleLogout, true)}
          </View>
          
          <Text style={styles.version}>Version 1.0.0</Text>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.backgroundElevated },
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
    backgroundColor: Colors.backgroundElevated,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: { fontSize: Typography.fontSize['2xl'], fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary },
  content: { padding: Spacing.xl, paddingBottom: 100 },
  profileCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, padding: Spacing.lg, borderRadius: BorderRadius.xl, marginBottom: Spacing['2xl'], borderWidth: 1, borderColor: Colors.border },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.primaryAlpha20, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md, borderWidth: 1, borderColor: Colors.primary },
  avatarText: { color: Colors.primary, fontFamily: Typography.fontFamily.bold, fontSize: 28 },
  profileInfo: { flex: 1 },
  name: { color: Colors.textPrimary, fontFamily: Typography.fontFamily.bold, fontSize: 18, marginBottom: 2 },
  email: { color: Colors.textSecondary, fontFamily: Typography.fontFamily.medium, fontSize: 13, marginBottom: 6 },
  roleBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.primary, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, gap: 4 },
  roleText: { color: '#000', fontFamily: Typography.fontFamily.bold, fontSize: 10, textTransform: 'uppercase' },
  editBtn: { padding: 8, backgroundColor: Colors.surfaceVariant, borderRadius: 20 },
  section: { marginBottom: Spacing['2xl'] },
  sectionTitle: { color: Colors.textSecondary, fontFamily: Typography.fontFamily.bold, fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.md },
  optionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  iconBox: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surfaceVariant, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md },
  optionTextContainer: { flex: 1 },
  optionTitle: { color: Colors.textPrimary, fontFamily: Typography.fontFamily.bold, fontSize: 16, marginBottom: 2 },
  optionSubtitle: { color: Colors.textSecondary, fontFamily: Typography.fontFamily.medium, fontSize: 12 },
  version: { textAlign: 'center', color: Colors.textTertiary, fontFamily: Typography.fontFamily.regular, fontSize: 12, marginVertical: Spacing.xl },
});

export default ProfileScreen;
