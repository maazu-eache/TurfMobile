import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import ContributionBar from './ContributionBar';
import { Colors, Typography } from '../../../theme/theme';

const PartnershipCard = ({ partnership }) => {
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
          <Icon name="plus-circle-outline" size={12} color={Colors.textSecondary} />
          <Text style={styles.extrasText}>
            Extras: <Text style={styles.extrasBold}>{extras} Runs</Text>
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    width: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    justify: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    width: '100%',
  },
  wicketLeft: {
    flex: 1,
  },
  wicketText: {
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.bold,
    fontSize: 15,
  },
  runsRight: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justify: 'flex-end',
    gap: 8,
  },
  runsVal: {
    color: Colors.primary,
    fontFamily: Typography.fontFamily.bold,
    fontSize: 15,
  },
  runsUnit: {
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.medium,
    fontSize: 12,
  },
  rrText: {
    color: Colors.textTertiary,
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
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  extrasText: {
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.regular,
    fontSize: 11,
  },
  extrasBold: {
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.bold,
  },
});

export default PartnershipCard;
