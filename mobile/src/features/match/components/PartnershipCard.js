import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import ContributionBar from './ContributionBar';
import { useTheme, Colors, Typography } from '../../../theme/theme';

const PartnershipCard = ({ partnership }) => {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const {
    wicketNumber = 1,
    totalRuns = 0,
    totalBalls = 0,
    runRate = '0.00',
    player1 = { name: 'Batter 1', runs: 0, balls: 0 },
    player2 = { name: 'Batter 2', runs: 0, balls: 0 },
    extras = 0,
  } = partnership;

  const suffix = ['st', 'nd', 'rd'][((wicketNumber + 90) % 100 - 10) % 10 - 1] || 'th';
  const wicketLabel = `${wicketNumber}${suffix} Wicket`;

  return (
    <View style={styles.cardContainer}>
      {/* Header Row: Wicket (Left), Runs & Run Rate (Right) */}
      <View style={styles.headerRow}>
        <View style={styles.wicketLeft}>
          <Text style={styles.wicketText}>{wicketLabel}</Text>
        </View>

        <View style={styles.runsRight}>
          <Text style={styles.runsVal}>
            {totalRuns} <Text style={styles.runsUnit}>Runs ({totalBalls})</Text>
          </Text>
          <Text style={styles.rrText}>RR {runRate}</Text>
        </View>
      </View>

      {/* Contribution Bar & Batters */}
      <View style={styles.contributionWrap}>
        <ContributionBar
          player1Name={player1.name}
          player1Runs={player1.runs}
          player1Balls={player1.balls}
          player2Name={player2.name}
          player2Runs={player2.runs}
          player2Balls={player2.balls}
          totalRuns={totalRuns}
        />
      </View>

      {/* Extras Pill */}
      {extras > 0 && (
        <View style={styles.extrasRow}>
          <Icon name="plus-circle-outline" size={12} color={colors.textSecondary} />
          <Text style={styles.extrasText}>
            Extras: <Text style={styles.extrasBold}>{extras} Runs</Text>
          </Text>
        </View>
      )}
    </View>
  );
};

const createStyles = (colors, isDark) => StyleSheet.create({
  cardContainer: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: isDark ? 0.25 : 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    width: '100%',
  },
  wicketLeft: {
    flex: 1,
  },
  wicketText: {
    color: colors.textPrimary,
    fontFamily: Typography.fontFamily.bold,
    fontSize: 15,
  },
  runsRight: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'flex-end',
    gap: 8,
  },
  runsVal: {
    color: isDark ? Colors.primary : colors.primaryDark,
    fontFamily: Typography.fontFamily.bold,
    fontSize: 15,
  },
  runsUnit: {
    color: colors.textSecondary,
    fontFamily: Typography.fontFamily.medium,
    fontSize: 12,
  },
  rrText: {
    color: colors.textTertiary,
    fontFamily: Typography.fontFamily.regular,
    fontSize: 11,
  },
  contributionWrap: {
    marginVertical: 2,
  },
  extrasRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : colors.surfaceVariant,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  extrasText: {
    color: colors.textSecondary,
    fontFamily: Typography.fontFamily.regular,
    fontSize: 11,
  },
  extrasBold: {
    color: colors.textPrimary,
    fontFamily: Typography.fontFamily.bold,
  },
});

export default PartnershipCard;
