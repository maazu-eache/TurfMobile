import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme, Typography, Spacing, BorderRadius } from '../../../theme/theme';

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
  section: { marginBottom: Spacing.xl },
  sectionTitle: { color: colors.textSecondary, fontFamily: Typography.fontFamily.bold, fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.lg },

  contactCard: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: colors.surface, 
    padding: Spacing.lg, 
    borderRadius: 12, 
    marginBottom: Spacing.md, 
    borderWidth: 1, 
    borderColor: colors.border,
    ...(isDark ? {} : shadows.xs),
  },
  iconBox: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primaryAlpha10, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md },
  contactInfo: { flex: 1 },
  contactLabel: { color: colors.textTertiary, fontFamily: Typography.fontFamily.medium, fontSize: 13, marginBottom: 2 },
  contactValue: { color: colors.textPrimary, fontFamily: Typography.fontFamily.bold, fontSize: 16 },

  faqCard: { 
    backgroundColor: colors.surface, 
    padding: Spacing.lg, 
    borderRadius: 12, 
    marginBottom: Spacing.md, 
    borderWidth: 1, 
    borderColor: colors.border,
    ...(isDark ? {} : shadows.xs),
  },
  faqQuestion: { color: colors.textPrimary, fontFamily: Typography.fontFamily.bold, fontSize: 16, marginBottom: 8 },
  faqAnswer: { color: colors.textSecondary, fontFamily: Typography.fontFamily.regular, fontSize: 14, lineHeight: 22 },
});

const HelpSupportScreen = ({ navigation }) => {
  const { colors, shadows, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, shadows, isDark), [colors, shadows, isDark]);

  const supportEmail = 'supportatscoreverse@gmail.com';
  const supportPhone = '+91 8428676150';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.surface} />
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Icon name="arrow-left" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Help & Support</Text>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Contact Us</Text>

            <TouchableOpacity
              style={styles.contactCard}
              onPress={() => Linking.openURL(`mailto:${supportEmail}`)}
              activeOpacity={0.7}
            >
              <View style={styles.iconBox}>
                <Icon name="email-outline" size={24} color={colors.primary} />
              </View>
              <View style={styles.contactInfo}>
                <Text style={styles.contactLabel}>Email Support</Text>
                <Text style={styles.contactValue}>{supportEmail}</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.contactCard}
              onPress={() => Linking.openURL(`tel:${supportPhone}`)}
              activeOpacity={0.7}
            >
              <View style={styles.iconBox}>
                <Icon name="phone-outline" size={24} color={colors.primary} />
              </View>
              <View style={styles.contactInfo}>
                <Text style={styles.contactLabel}>Phone Support</Text>
                <Text style={styles.contactValue}>{supportPhone}</Text>
              </View>
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>

            <View style={styles.faqCard}>
              <Text style={styles.faqQuestion}>How do I register a new turf?</Text>
              <Text style={styles.faqAnswer}>You can easily register a new turf from your Dashboard by navigating to 'My Turfs' and clicking the '+' icon.</Text>
            </View>

            <View style={styles.faqCard}>
              <Text style={styles.faqQuestion}>How can I manage slot pricing?</Text>
              <Text style={styles.faqAnswer}>Go to 'My Turfs', select 'Manage Slots' for your turf, and you can edit time slots, pricing, and availability in real-time.</Text>
            </View>

            <View style={styles.faqCard}>
              <Text style={styles.faqQuestion}>Where can I see my earnings?</Text>
              <Text style={styles.faqAnswer}>Your detailed earnings, including day-by-day breakdowns and future forecasts, can be found in the Analytics tab.</Text>
            </View>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

export default HelpSupportScreen;
