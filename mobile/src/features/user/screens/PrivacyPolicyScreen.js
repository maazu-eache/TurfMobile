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
          <Text style={styles.lastUpdated}>Last Updated: August 2026</Text>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>1. Information We Collect</Text>
            <Text style={styles.paragraph}>We collect information you provide directly to us, such as when you create or modify your account, request on-demand services, contact customer support, or otherwise communicate with us. This information may include: name, email, phone number, postal address, profile picture, payment method, and other information you choose to provide.</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>2. How We Use Information</Text>
            <Text style={styles.paragraph}>We use the information we collect about you to provide, maintain, and improve our services, such as to facilitate payments, send receipts, provide products and services you request, develop new features, provide customer support to Users, authenticate users, and send product updates and administrative messages.</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>3. Sharing of Information</Text>
            <Text style={styles.paragraph}>We may share the information we collect about you with vendors, consultants, marketing partners, and other service providers who need access to such information to carry out work on our behalf. We may also share your information to comply with legal processes or protect the rights, property, and safety of RoughTurf, our users, or others.</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>4. Data Security</Text>
            <Text style={styles.paragraph}>We take reasonable measures to help protect information about you from loss, theft, misuse and unauthorized access, disclosure, alteration and destruction.</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>5. Contact Us</Text>
            <Text style={styles.paragraph}>If you have any questions about this Privacy Policy, please contact us at supportatscoreverse@gmail.com.</Text>
          </View>
        </ScrollView>
      </View>
    </View>
  );
};

export default PrivacyPolicyScreen;
