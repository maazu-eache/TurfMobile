import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors, Typography, Spacing } from '../../../theme/theme';

const HelpSupportScreen = ({ navigation }) => {
  const supportEmail = 'maazibrahimoo0@gmail.com';
  const supportPhone = '+91 8428676150';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Icon name="arrow-left" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Help & Support</Text>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Contact Us</Text>
            
            <TouchableOpacity 
              style={styles.contactCard} 
              onPress={() => Linking.openURL(`mailto:${supportEmail}`)}
            >
              <View style={styles.iconBox}>
                <Icon name="email-outline" size={24} color={Colors.primary} />
              </View>
              <View style={styles.contactInfo}>
                <Text style={styles.contactLabel}>Email Support</Text>
                <Text style={styles.contactValue}>{supportEmail}</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.contactCard} 
              onPress={() => Linking.openURL(`tel:${supportPhone}`)}
            >
              <View style={styles.iconBox}>
                <Icon name="phone-outline" size={24} color={Colors.primary} />
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
              <Text style={styles.faqQuestion}>How do I cancel a booking?</Text>
              <Text style={styles.faqAnswer}>You can cancel an upcoming booking from the 'My Bookings' tab up to 24 hours before the slot time for a full refund.</Text>
            </View>
            
            <View style={styles.faqCard}>
              <Text style={styles.faqQuestion}>How are refunds processed?</Text>
              <Text style={styles.faqAnswer}>Refunds are processed back to your wallet or original payment method within 3-5 business days of cancellation.</Text>
            </View>

            <View style={styles.faqCard}>
              <Text style={styles.faqQuestion}>How do I add teammates to my match?</Text>
              <Text style={styles.faqAnswer}>Go to 'My Cricket' {'->'} 'Teams' and create a new team, or edit an existing one to add members.</Text>
            </View>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.backgroundElevated },
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
    backgroundColor: Colors.backgroundElevated,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: { padding: 4, marginRight: Spacing.md },
  headerTitle: { fontSize: Typography.fontSize['2xl'], fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary },
  content: { padding: Spacing.xl, paddingBottom: 100 },
  section: { marginBottom: Spacing.xl },
  sectionTitle: { color: Colors.textSecondary, fontFamily: Typography.fontFamily.bold, fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.lg },
  
  contactCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, padding: Spacing.lg, borderRadius: 12, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  iconBox: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.surfaceVariant, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md },
  contactInfo: { flex: 1 },
  contactLabel: { color: Colors.textSecondary, fontFamily: Typography.fontFamily.medium, fontSize: 13, marginBottom: 2 },
  contactValue: { color: Colors.textPrimary, fontFamily: Typography.fontFamily.bold, fontSize: 16 },

  faqCard: { backgroundColor: Colors.surface, padding: Spacing.lg, borderRadius: 12, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  faqQuestion: { color: Colors.textPrimary, fontFamily: Typography.fontFamily.bold, fontSize: 16, marginBottom: 8 },
  faqAnswer: { color: Colors.textSecondary, fontFamily: Typography.fontFamily.regular, fontSize: 14, lineHeight: 22 },
});

export default HelpSupportScreen;
