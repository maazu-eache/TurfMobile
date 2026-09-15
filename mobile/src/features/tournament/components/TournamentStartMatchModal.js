import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, Typography, Spacing, BorderRadius } from '../../../theme/theme';
import Icon from 'react-native-vector-icons/Feather';
import MaterialIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';

// ─────────────────────────────────────────────────────────
// Stage configuration with icons, grouped by category
// ─────────────────────────────────────────────────────────
const STAGE_GROUPS = [
  {
    label: 'Group Stage',
    stages: [
      { key: 'League Match',    icon: 'trophy-outline' },
      { key: 'Super Six',       icon: 'numeric-6-circle-outline' },
      { key: 'Practice Match',  icon: 'cricket' },
    ],
  },
  {
    label: 'Knockout Rounds',
    stages: [
      { key: 'Round of 16',       icon: 'format-list-numbered' },
      { key: 'Pre Quarter Final', icon: 'tournament' },
      { key: 'Quarter Final',     icon: 'podium-bronze' },
      { key: 'Semi Final',        icon: 'podium-silver' },
      { key: 'Final',             icon: 'podium-gold' },
    ],
  },
  {
    label: 'Special Stages',
    stages: [
      { key: 'Super Knockout', icon: 'lightning-bolt' },
      { key: 'Knockout',       icon: 'sword-cross' },
      { key: 'Qualifier 1',    icon: 'medal-outline' },
      { key: 'Qualifier 2',    icon: 'medal' },
      { key: 'Eliminator',     icon: 'skull-outline' },
      { key: 'Third Position', icon: 'podium' },
    ],
  },
];

// ─────────────────────────────────────────────────────────
// Single card component with press feedback
// ─────────────────────────────────────────────────────────
const StageCard = ({ stage, onPress, colors, shadows, isDark }) => {
  const [pressed, setPressed] = useState(false);

  return (
    <Pressable
      onPress={() => onPress(stage.key)}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[
        styles.card,
        {
          backgroundColor: pressed
            ? isDark ? '#1A1600' : '#FFFBEA'
            : colors.surface,
          borderColor: pressed ? '#FFCC00' : colors.border,
          ...shadows.sm,
        },
      ]}
    >
      {/* Yellow left accent bar — visible on press */}
      <View style={[styles.cardAccent, { opacity: pressed ? 1 : 0 }]} />

      <View style={styles.cardIcon}>
        <MaterialIcon
          name={stage.icon}
          size={20}
          color={pressed ? '#FFCC00' : colors.textTertiary}
        />
      </View>

      <Text
        style={[
          styles.cardText,
          {
            color: pressed ? '#FFCC00' : colors.textPrimary,
            fontFamily: Typography.fontFamily.medium,
          },
        ]}
        numberOfLines={2}
      >
        {stage.key}
      </Text>

      <Icon
        name="chevron-right"
        size={14}
        color={pressed ? '#FFCC00' : colors.textTertiary}
        style={styles.cardChevron}
      />
    </Pressable>
  );
};

// ─────────────────────────────────────────────────────────
// Main modal component
// ─────────────────────────────────────────────────────────
const TournamentStartMatchModal = ({ visible, onClose, tournament }) => {
  const { colors, shadows, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  const handleSelectStage = (stage) => {
    onClose();
    navigation.navigate('MatchSetup', {
      tournamentId: tournament._id,
      tournamentDetails: tournament,
      stage,
    });
  };

  const headerBg = isDark ? '#0A0A00' : '#FFFDF0';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      {/*
       * Single View fills the entire screen.
       * paddingTop = insets.top pushes the header row below the
       * Dynamic Island / notch / Android status bar — reliably.
       * Using useSafeAreaInsets() is the recommended approach for
       * content inside a Modal (SafeAreaView can misreport insets
       * when nested inside a Modal on some RN versions).
       */}
      <View
        style={[
          styles.outerWrap,
          {
            backgroundColor: headerBg,
            paddingTop: insets.top,
          },
        ]}
      >
        {/* ── Header ── */}
        <View
          style={[
            styles.header,
            {
              borderBottomColor: colors.borderLight,
              backgroundColor: headerBg,
            },
          ]}
        >
          <TouchableOpacity
            onPress={onClose}
            style={[styles.backBtn, { backgroundColor: colors.surfaceVariant }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon name="arrow-left" size={18} color={colors.textPrimary} />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
              Select Match Stage
            </Text>
            <Text style={[styles.headerSub, { color: colors.textSecondary }]}>
              Choose a stage to continue setup
            </Text>
          </View>

          <View style={styles.headerDot} />
        </View>

        {/* ── Scrollable content ── */}
        <View style={[styles.contentArea, { backgroundColor: colors.background }]}>
          <ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: insets.bottom + Spacing.xl },
            ]}
            showsVerticalScrollIndicator={false}
          >
            {/* Info pill */}
            <View
              style={[
                styles.infoPill,
                {
                  backgroundColor: isDark
                    ? 'rgba(255,204,0,0.08)'
                    : 'rgba(255,204,0,0.12)',
                  borderColor: 'rgba(255,204,0,0.3)',
                },
              ]}
            >
              <Icon name="info" size={13} color="#FFCC00" style={{ marginRight: 6 }} />
              <Text
                style={[
                  styles.infoText,
                  { color: isDark ? '#FFCC00' : '#A07800' },
                ]}
              >
                You'll set teams & scoring on the next screen.
              </Text>
            </View>

            {/* Stage groups */}
            {STAGE_GROUPS.map((group) => (
              <View key={group.label} style={styles.section}>
                {/* Section header row */}
                <View style={styles.sectionHeader}>
                  <View style={[styles.sectionDot, { backgroundColor: colors.primary }]} />
                  <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
                    {group.label}
                  </Text>
                  <View style={[styles.sectionLine, { backgroundColor: colors.borderLight }]} />
                </View>

                {/* Cards grid */}
                <View style={styles.cardsGrid}>
                  {group.stages.map((stage) => (
                    <StageCard
                      key={stage.key}
                      stage={stage}
                      onPress={handleSelectStage}
                      colors={colors}
                      shadows={shadows}
                      isDark={isDark}
                    />
                  ))}
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

// ─────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // Layout wrappers
  outerWrap: {
    flex: 1,
  },
  contentArea: {
    flex: 1,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  headerCenter: { flex: 1 },
  headerTitle: {
    fontSize: 17,
    fontFamily: Typography.fontFamily.bold,
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.regular,
    marginTop: 1,
  },
  headerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFCC00',
    marginLeft: Spacing.sm,
  },

  // Scroll
  scrollContent: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.base,
  },

  // Info pill
  infoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: BorderRadius.full,
    paddingVertical: 7,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.lg,
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  infoText: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.medium,
    flexShrink: 1,
  },

  // Section
  section: { marginBottom: Spacing.lg },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    gap: 6,
  },
  sectionDot: { width: 6, height: 6, borderRadius: 3 },
  sectionLabel: {
    fontSize: 11,
    fontFamily: Typography.fontFamily.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  sectionLine: { flex: 1, height: 1 },

  // Cards
  cardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  card: {
    width: '47.5%',
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    paddingVertical: 13,
    paddingHorizontal: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  cardAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: '#FFCC00',
    borderTopLeftRadius: BorderRadius.lg,
    borderBottomLeftRadius: BorderRadius.lg,
  },
  cardIcon: {
    marginRight: 8,
    width: 24,
    alignItems: 'center',
  },
  cardText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 17,
  },
  cardChevron: { marginLeft: 2 },
});

export default TournamentStartMatchModal;
