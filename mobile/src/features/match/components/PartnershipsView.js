import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import PartnershipCard from './PartnershipCard';
import { useTheme, Colors, Typography } from '../../../theme/theme';

const PartnershipsView = ({ match, scorecards = [], commentary = [], refreshControl }) => {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const [partnershipFilter, setPartnershipFilter] = useState('ALL');

  const teamAName = match?.teamA?.name || 'Team A';
  const teamBName = match?.teamB?.name || 'Team B';

  const parsedInningsPartnerships = useMemo(() => {
    if (!match || !match.innings) return [];

    let filteredScorecards = [...scorecards];
    if (partnershipFilter === 'A') {
      filteredScorecards = filteredScorecards.filter(
        sc => (sc.battingTeam?._id || sc.battingTeam)?.toString() === (match.teamA?._id || match.teamA)?.toString()
      );
    } else if (partnershipFilter === 'B') {
      filteredScorecards = filteredScorecards.filter(
        sc => (sc.battingTeam?._id || sc.battingTeam)?.toString() === (match.teamB?._id || match.teamB)?.toString()
      );
    }

    const result = [];

    filteredScorecards.forEach((sc) => {
      const inn = match.innings?.find(i => i.inningsNumber === sc.inningsNumber);
      if (!inn) return;

      const teamIdStr = (sc.battingTeam?._id || sc.battingTeam)?.toString();
      const teamAIdStr = (match.teamA?._id || match.teamA)?.toString();
      const teamBIdStr = (match.teamB?._id || match.teamB)?.toString();

      const teamName = sc.battingTeam?.name ||
        (teamIdStr && teamIdStr === teamAIdStr ? match.teamA?.name : null) ||
        (teamIdStr && teamIdStr === teamBIdStr ? match.teamB?.name : null) ||
        'Team';

      const rawOvers = sc.total?.overs ?? inn.overs;
      const safeOvers = (rawOvers !== undefined && rawOvers !== null && String(rawOvers).length <= 6 && !isNaN(parseFloat(String(rawOvers)))) 
        ? String(rawOvers) 
        : '0.0';

      const runsVal = sc.total?.runs ?? inn.totalRuns ?? 0;
      const wktVal = sc.total?.wickets ?? inn.totalWickets ?? 0;

      const rawPartnerships = inn.partnerships || [];
      if (rawPartnerships.length === 0) return;

      // Group commentary balls into chronological partnership buckets by wicket events
      const innBalls = commentary ? commentary.filter(b => {
        const ballInnId = (b.innings?._id || b.innings)?.toString();
        return ballInnId === inn._id?.toString();
      }).sort((a, b) => {
        const overDiff = (a.overNumber || 0) - (b.overNumber || 0);
        if (overDiff !== 0) return overDiff;
        return (a.ballNumber || 0) - (b.ballNumber || 0);
      }) : [];

      const partnershipBallBuckets = [];
      let currentBucket = [];

      innBalls.forEach(b => {
        currentBucket.push(b);
        if (b.isWicket && !['retired_hurt'].includes(b.wicketType)) {
          partnershipBallBuckets.push(currentBucket);
          currentBucket = [];
        }
      });
      if (currentBucket.length > 0) {
        partnershipBallBuckets.push(currentBucket);
      }

      const processedList = rawPartnerships.map((p, idx) => {
        const p1Id = (p.batsman1?._id || p.batsman1)?.toString();
        const p2Id = (p.batsman2?._id || p.batsman2)?.toString();

        const p1Name = p.batsman1?.name ||
          sc.batting?.find(b => (b.player?._id || b.player)?.toString() === p1Id)?.player?.name ||
          'Batter 1';

        const p2Name = p.batsman2?.name ||
          sc.batting?.find(b => (b.player?._id || b.player)?.toString() === p2Id)?.player?.name ||
          'Batter 2';

        const wicketNum = p.wicket || (idx + 1);
        let totalRuns = p.runs || 0;
        let totalBalls = p.balls || 0;

        const isLiveMatch = match.status === 'live' || match.status === 'in_progress';
        const isLastInnings = sc.inningsNumber === match.currentInnings;
        const isLastPartnership = idx === rawPartnerships.length - 1;
        const isCurrent = isLiveMatch && isLastInnings && isLastPartnership;

        let p1Runs = 0;
        let p1Balls = 0;
        let p2Runs = 0;
        let p2Balls = 0;
        let extras = p.extras || 0;

        const bucket = partnershipBallBuckets[idx] || [];

        if (bucket.length > 0) {
          let calcExtras = 0;
          bucket.forEach(b => {
            const bBatsmanId = (b.batsman?._id || b.batsman)?.toString();
            const bRuns = b.batsmanRuns || 0;

            if (bBatsmanId === p1Id) {
              p1Runs += bRuns;
              if (!b.isWide) p1Balls += 1;
            } else if (bBatsmanId === p2Id) {
              p2Runs += bRuns;
              if (!b.isWide) p2Balls += 1;
            }

            if (b.extraRuns > 0) calcExtras += b.extraRuns;
          });

          if (calcExtras > 0) extras = calcExtras;
        }

        // Ensure consistency between sum of individual runs & total partnership runs
        const currentSum = p1Runs + p2Runs + extras;

        if (currentSum !== totalRuns && totalRuns > 0 && currentSum > 0) {
          const batterSum = p1Runs + p2Runs;
          if (batterSum > 0) {
            const availableForBatters = Math.max(0, totalRuns - extras);
            p1Runs = Math.round((p1Runs / batterSum) * availableForBatters);
            p2Runs = availableForBatters - p1Runs;
          } else {
            p1Runs = Math.max(0, totalRuns - extras);
            p2Runs = 0;
          }
        } else if (currentSum === 0 && totalRuns > 0) {
          if (p.batsman1Runs !== undefined && p.batsman2Runs !== undefined) {
            p1Runs = p.batsman1Runs;
            p1Balls = p.batsman1Balls || Math.ceil(totalBalls / 2);
            p2Runs = p.batsman2Runs;
            p2Balls = p.batsman2Balls || Math.floor(totalBalls / 2);
          } else {
            p1Runs = Math.ceil(totalRuns / 2);
            p1Balls = Math.ceil(totalBalls / 2);
            p2Runs = Math.floor(totalRuns / 2);
            p2Balls = Math.floor(totalBalls / 2);
          }
        }

        // Calculate accurate total partnership balls
        const totalFacedBalls = p1Balls + p2Balls;
        if (totalBalls === 0 || Math.abs(totalBalls - totalFacedBalls) > 2) {
          totalBalls = totalFacedBalls;
        }

        const runRate = totalBalls > 0 ? ((totalRuns / totalBalls) * 6).toFixed(2) : '0.00';

        return {
          id: p._id || `${sc.inningsNumber}-${idx}`,
          wicketNumber: wicketNum,
          totalRuns,
          totalBalls,
          runRate,
          isCurrent,
          player1: {
            name: p1Name,
            runs: p1Runs,
            balls: p1Balls,
          },
          player2: {
            name: p2Name,
            runs: p2Runs,
            balls: p2Balls,
          },
          extras,
        };
      });

      result.push({
        inningsNumber: sc.inningsNumber,
        teamName,
        totalScore: `${runsVal}/${wktVal}`,
        totalOvers: safeOvers,
        partnerships: processedList,
      });
    });

    return result;
  }, [match, scorecards, commentary, partnershipFilter]);

  const tabs = [
    { key: 'ALL', label: 'All' },
    { key: 'A', label: teamAName },
    { key: 'B', label: teamBName },
  ];

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={refreshControl}
    >
      {/* Team Filter Pills */}
      <View style={styles.filterRow}>
        {tabs.map((tab) => {
          const isActive = partnershipFilter === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.filterBtn, isActive && styles.filterBtnActive]}
              onPress={() => setPartnershipFilter(tab.key)}
              activeOpacity={0.75}
            >
              <Text
                style={[styles.filterText, isActive && styles.filterTextActive]}
                numberOfLines={1}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Innings & Ultra-Clean Partnerships List */}
      {parsedInningsPartnerships.map((innGroup, innIdx) => (
        <View key={innIdx} style={styles.inningsSection}>
          <View style={styles.inningsHeader}>
            <View style={styles.teamTitleWrap}>
              <View style={styles.teamIndicator} />
              <Text style={styles.teamTitle}>{innGroup.teamName}</Text>
              <Text style={styles.teamScore}>
                {innGroup.totalScore} ({innGroup.totalOvers} Ov)
              </Text>
            </View>
          </View>

          {innGroup.partnerships.map((partnership) => (
            <PartnershipCard key={partnership.id} partnership={partnership} />
          ))}
        </View>
      ))}

      {/* Empty State */}
      {parsedInningsPartnerships.length === 0 && (
        <View style={styles.emptyContainer}>
          <Icon name="handshake-outline" size={36} color={colors.textTertiary} />
          <Text style={styles.emptyTitle}>No Partnerships Available</Text>
          <Text style={styles.emptySub}>
            Partnership statistics will appear here as the match progresses.
          </Text>
        </View>
      )}
    </ScrollView>
  );
};

const createStyles = (colors, isDark) => StyleSheet.create({
  container: {
    padding: 12,
    paddingBottom: 30,
    backgroundColor: colors.background,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  filterBtn: {
    flex: 1,
    backgroundColor: colors.surface,
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: isDark ? 0.2 : 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  filterBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterText: {
    color: colors.textSecondary,
    fontFamily: Typography.fontFamily.medium,
    fontSize: 12,
  },
  filterTextActive: {
    color: '#000000',
    fontFamily: Typography.fontFamily.bold,
  },
  inningsSection: {
    marginBottom: 14,
  },
  inningsHeader: {
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  teamTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  teamIndicator: {
    width: 3,
    height: 14,
    borderRadius: 2,
    backgroundColor: Colors.primary,
  },
  teamTitle: {
    color: colors.textPrimary,
    fontFamily: Typography.fontFamily.bold,
    fontSize: 15,
  },
  teamScore: {
    color: colors.textSecondary,
    fontFamily: Typography.fontFamily.medium,
    fontSize: 13,
    marginLeft: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontFamily: Typography.fontFamily.bold,
    fontSize: 15,
    marginTop: 10,
  },
  emptySub: {
    color: colors.textSecondary,
    fontFamily: Typography.fontFamily.regular,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
});

export default PartnershipsView;
