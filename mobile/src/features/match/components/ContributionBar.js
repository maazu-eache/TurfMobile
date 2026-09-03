import React, { useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useTheme, Colors, Typography } from '../../../theme/theme';

/**
 * ContributionBar
 * Dual-yellow horizontal contribution bar for cricket partnerships.
 * Batter 1 on far left, Batter 2 on far right.
 */
const ContributionBar = ({
  player1Name = 'Batter 1',
  player1Runs = 0,
  player1Balls = 0,
  player2Name = 'Batter 2',
  player2Runs = 0,
  player2Balls = 0,
  totalRuns = 0,
}) => {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const totalPlayerRuns = player1Runs + player2Runs;

  let p1Pct = 0;
  let p2Pct = 0;

  if (totalPlayerRuns > 0) {
    p1Pct = Math.round((player1Runs / totalPlayerRuns) * 100);
    p2Pct = 100 - p1Pct;
  } else if (totalRuns > 0) {
    p1Pct = 50;
    p2Pct = 50;
  }

  const animValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    animValue.setValue(0);
    Animated.timing(animValue, {
      toValue: 1,
      duration: 500,
      useNativeDriver: false,
    }).start();
  }, [player1Runs, player2Runs, totalRuns]);

  const flexP1 = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, Math.max(p1Pct, p2Pct === 0 && p1Pct > 0 ? 100 : 0)],
  });

  const flexP2 = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, Math.max(p2Pct, p1Pct === 0 && p2Pct > 0 ? 100 : 0)],
  });

  return (
    <View style={styles.container}>
      {/* Batters Name & Runs Row */}
      <View style={styles.batterHeaderRow}>
        <View style={styles.batterColLeft}>
          <Text style={styles.playerNameLeft} numberOfLines={1}>
            {player1Name}
          </Text>
          <Text style={styles.runsTextLeft}>
            <Text style={styles.runsBold}>{player1Runs}</Text> ({player1Balls})
          </Text>
        </View>

        <View style={styles.batterColRight}>
          <Text style={styles.playerNameRight} numberOfLines={1}>
            {player2Name}
          </Text>
          <Text style={styles.runsTextRight}>
            <Text style={styles.runsBold}>{player2Runs}</Text> ({player2Balls})
          </Text>
        </View>
      </View>

      {/* Dual Yellow Bar */}
      <View style={styles.barTrack}>
        {totalPlayerRuns > 0 || totalRuns > 0 ? (
          <>
            {p1Pct > 0 && (
              <Animated.View
                style={[
                  styles.barLeft,
                  { flex: flexP1 },
                  p2Pct === 0 && styles.barFull,
                ]}
              />
            )}
            {p2Pct > 0 && (
              <Animated.View
                style={[
                  styles.barRight,
                  { flex: flexP2 },
                  p1Pct === 0 && styles.barFull,
                ]}
              />
            )}
          </>
        ) : (
          <View style={styles.barEmpty} />
        )}
      </View>

      {/* Percentage Row: Left & Right aligned flex boxes */}
      <View style={styles.pctRow}>
        <Text style={styles.pctLeft}>{p1Pct}%</Text>
        <Text style={styles.pctRight}>{p2Pct}%</Text>
      </View>
    </View>
  );
};

const createStyles = (colors, isDark) => StyleSheet.create({
  container: {
    width: '100%',
    marginVertical: 2,
  },
  batterHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
    width: '100%',
  },
  batterColLeft: {
    flex: 1,
    alignItems: 'flex-start',
  },
  batterColRight: {
    flex: 1,
    alignItems: 'flex-end',
  },
  playerNameLeft: {
    color: colors.textPrimary,
    fontFamily: Typography.fontFamily.bold,
    fontSize: 13,
  },
  playerNameRight: {
    color: colors.textPrimary,
    fontFamily: Typography.fontFamily.bold,
    fontSize: 13,
    textAlign: 'right',
  },
  runsTextLeft: {
    color: colors.textSecondary,
    fontFamily: Typography.fontFamily.regular,
    fontSize: 12,
    marginTop: 1,
  },
  runsTextRight: {
    color: colors.textSecondary,
    fontFamily: Typography.fontFamily.regular,
    fontSize: 12,
    textAlign: 'right',
    marginTop: 1,
  },
  runsBold: {
    color: isDark ? Colors.primary : colors.primaryDark,
    fontFamily: Typography.fontFamily.bold,
  },
  barTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: isDark ? '#222222' : colors.surfaceVariant,
    flexDirection: 'row',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    width: '100%',
    marginVertical: 4,
  },
  barLeft: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 4,
  },
  barRight: {
    height: '100%',
    backgroundColor: isDark ? '#856600' : '#E6B800',
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  barFull: {
    borderRadius: 4,
  },
  barEmpty: {
    flex: 1,
    backgroundColor: isDark ? '#222222' : colors.surfaceVariant,
  },
  pctRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginTop: 2,
  },
  pctLeft: {
    flex: 1,
    color: isDark ? Colors.primary : colors.primaryDark,
    fontFamily: Typography.fontFamily.bold,
    fontSize: 11,
    textAlign: 'left',
  },
  pctRight: {
    flex: 1,
    color: isDark ? '#D4AF37' : '#B8860B',
    fontFamily: Typography.fontFamily.bold,
    fontSize: 11,
    textAlign: 'right',
  },
});

export default ContributionBar;
