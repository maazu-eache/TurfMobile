import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme, Typography, Spacing } from '../../../theme/theme';

const createStyles = (colors, shadows, isDark) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.surface },
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    ...(isDark ? {} : shadows.xs),
  },
  backBtn: { padding: 4, marginRight: Spacing.md },
  headerTitle: { fontSize: Typography.fontSize['2xl'], fontFamily: Typography.fontFamily.bold, color: colors.textPrimary },
  content: { padding: Spacing.xl, paddingBottom: 100 },
  lastUpdated: { color: colors.textSecondary, fontFamily: Typography.fontFamily.medium, fontSize: 13, marginBottom: Spacing.xl },
  section: { marginBottom: Spacing.xl },
  sectionTitle: { color: colors.textPrimary, fontFamily: Typography.fontFamily.bold, fontSize: 18, marginBottom: Spacing.sm },
  paragraph: { color: colors.textSecondary, fontFamily: Typography.fontFamily.regular, fontSize: 15, lineHeight: 24 },
});

const PrivacyPolicyScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const safeTop = Math.max(insets?.top || 0, Platform.OS === 'ios' ? 44 : 0);
  const { colors, shadows, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, shadows, isDark), [colors, shadows, isDark]);

  return (
    <View style={[styles.safeArea, { paddingTop: safeTop }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.surface} />
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Icon name="arrow-left" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Privacy Policy</Text>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.lastUpdated}>Last Updated: March 2026</Text>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>1. Information We Collect</Text>
            <Text style={styles.paragraph}>We collect information you provide directly to us, such as your name, email address, phone number, profile pictures, and player/team statistics. We also collect precise location data (to display nearby sports turfs and arenas) and access camera/photo library (to scan QR codes and upload team avatars).</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>2. How We Use Information</Text>
            <Text style={styles.paragraph}>We use the collected information to facilitate turf slot bookings, manage tournament registrations, display live cricket scorecards, authenticate users, process payments, and deliver push notifications about booking statuses and match updates.</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>3. Third-Party Services</Text>
            <Text style={styles.paragraph}>We do not sell your personal data. We share necessary data with trusted service providers who assist in operating the platform, including secure payment gateways (Razorpay), authentication services (Google Sign-In), and push notification infrastructure (Firebase).</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>4. Data Security</Text>
            <Text style={styles.paragraph}>We implement industry-standard technical and organizational security measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction.</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>5. Account & Data Deletion (Your Rights)</Text>
            <Text style={styles.paragraph}>You have the right to request the permanent deletion of your account and associated personal data at any time. You can delete your account directly inside the app by going to Profile Settings - Delete Account, or by emailing our privacy team at supportatscoreverse@gmail.com. Upon deletion, your personal details, wallet records, and profile statistics are permanently removed.</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>6. Contact Us</Text>
            <Text style={styles.paragraph}>If you have any questions, concerns, or inquiries regarding this Privacy Policy, please contact us at supportatscoreverse@gmail.com.</Text>
          </View>
        </ScrollView>
      </View>
    </View>
  );
};

export default PrivacyPolicyScreen;
