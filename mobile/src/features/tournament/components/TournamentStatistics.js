import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, ImageBackground, Image } from 'react-native';
import Svg, { Line } from 'react-native-svg';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme, Typography, Spacing, BorderRadius } from '../../../theme/theme';
import { getImageUrl } from '../../../api/axios';

const TournamentStatistics = ({ tournament }) => {
  const { colors, shadows, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, shadows, isDark), [colors, shadows, isDark]);
  const selectedGround = tournament?.groundType || 'Open Ground';

  if (!tournament?.statistics) {
    return (
      <View style={styles.emptyContainer}>
        <Icon name="chart-box-outline" size={48} color={colors.textTertiary} style={{ marginBottom: 12 }} />
        <Text style={styles.emptyText}>No tournament statistics available yet.</Text>
      </View>
    );
  }

  const stats = tournament.statistics;
  const {
    totalRuns = 0,
    totalWickets = 0,
    totalSixes = 0,
    totalFours = 0,
    totalMatchesPlayed = 0,
    totalBallsBowled = 0,
    tournamentRunRate = 0,
    avgFirstInningsScore = 0,
    avgRunsPerMatch = 0,
    wonBattingFirst = 0,
    wonChasing = 0,
    tiedOrNoResult = 0,
    totalDots = 0,
    dotPercent = 0,
    boundaryRunsPercent = 0,
    totalExtras,
    highestTeamScore,
    highestChase,
    lowestDefended,
    highestIndividualScore,
    bestBowlingFigures,
    fiftiesCount = 0,
    hundredsCount = 0,
    wagonWheel
  } = stats;

  const totalBoundaries = (totalFours || 0) + (totalSixes || 0);
  const boundaryRuns = ((totalFours || 0) * 4) + ((totalSixes || 0) * 6);
  const calculatedBoundaryPercent = boundaryRunsPercent || (totalRuns > 0 ? ((boundaryRuns / totalRuns) * 100).toFixed(1) : '0');
  const totalDecidedMatches = (wonBattingFirst || 0) + (wonChasing || 0) + (tiedOrNoResult || 0);
  const batFirstPercent = totalDecidedMatches > 0 ? Math.round(((wonBattingFirst || 0) / totalDecidedMatches) * 100) : 50;
  const chasePercent = totalDecidedMatches > 0 ? Math.round(((wonChasing || 0) / totalDecidedMatches) * 100) : 50;

  // Resolve batter photo with fallbacks (direct photo, linked userId.photo, or matching leaderboard player)
  const batterPlayerId = (highestIndividualScore?.player?._id || highestIndividualScore?.player)?.toString();
  const matchedBatter = tournament?.leaderboard?.mostRuns?.find(p => (p.player?._id || p.player)?.toString() === batterPlayerId)?.player
    || tournament?.leaderboard?.mvp?.find(p => (p.player?._id || p.player)?.toString() === batterPlayerId)?.player;
  const batterPhoto = highestIndividualScore?.player?.photo
    || highestIndividualScore?.player?.userId?.photo
    || matchedBatter?.photo
    || matchedBatter?.userId?.photo;

  // Resolve bowler photo with fallbacks (direct photo, linked userId.photo, or matching leaderboard player)
  const bowlerPlayerId = (bestBowlingFigures?.player?._id || bestBowlingFigures?.player)?.toString();
  const matchedBowler = tournament?.leaderboard?.mostWickets?.find(p => (p.player?._id || p.player)?.toString() === bowlerPlayerId)?.player
    || tournament?.leaderboard?.mvp?.find(p => (p.player?._id || p.player)?.toString() === bowlerPlayerId)?.player;
  const bowlerPhoto = bestBowlingFigures?.player?.photo
    || bestBowlingFigures?.player?.userId?.photo
    || matchedBowler?.photo
    || matchedBowler?.userId?.photo;

  const currentWagonData = wagonWheel?.[selectedGround] || [];

  const renderWagonWheel = () => {
    const isRectangular = selectedGround === 'Indoor' || selectedGround === 'Box Cricket';
    const width = isRectangular ? 260 : 300;
    const height = isRectangular ? 400 : 300;
    const centerX = width / 2;
    const centerY = height / 2;

    const bgImage = isRectangular 
      ? require('../../../turf.png') 
      : require('../../../ground.png');

    return (
      <View style={styles.sectionContainer}>
        <View style={styles.sectionHeaderRow}>
          <Icon name="compass-outline" size={20} color={colors.primary} />
          <Text style={styles.sectionTitle}>Wagon Wheel ({selectedGround})</Text>
        </View>

        <View style={styles.wagonWheelWrapper}>
          <ImageBackground
            source={bgImage}
            style={{ width, height, alignSelf: 'center', justifyContent: 'center' }}
            imageStyle={{ borderRadius: isRectangular ? 10 : height / 2, resizeMode: 'cover' }}
          >
            <Text style={[styles.regionText, { top: 20, alignSelf: 'center' }]}>BEHIND</Text>
            <Text style={[styles.regionText, { bottom: 20, alignSelf: 'center' }]}>STRAIGHT</Text>
            <Text style={[styles.regionText, { left: 15, top: centerY - 10 }]}>OFF</Text>
            <Text style={[styles.regionText, { right: 15, top: centerY - 10 }]}>LEG</Text>

            <Svg width={width} height={height}>
              {currentWagonData.map((shot, index) => {
                const radians = shot.angle * (Math.PI / 180);
                const startX = centerX;
                const startY = isRectangular ? centerY - 55 : centerY - 25;

                let maxLength = 0;
                const dx = Math.cos(radians);
                const dy = Math.sin(radians);

                if (isRectangular) {
                  const marginX = 2;
                  const marginY = 2;
                  const tMaxX = dx > 0 ? (width - marginX - startX) / dx : dx < 0 ? (marginX - startX) / dx : Infinity;
                  const tMaxY = dy > 0 ? (height - marginY - startY) / dy : dy < 0 ? (marginY - startY) / dy : Infinity;
                  maxLength = Math.min(tMaxX, tMaxY);
                } else {
                  const vx = startX - centerX;
                  const vy = startY - centerY;
                  const r = (width / 2) - 2;
                  const b = (vx * dx + vy * dy);
                  const c = (vx * vx + vy * vy) - (r * r);
                  maxLength = -b + Math.sqrt(b * b - c);
                }

                let length = 50;
                let color = 'rgba(255, 255, 255, 0.5)';
                if (shot.runs === 6) { color = '#e74c3c'; length = maxLength; }
                else if (shot.runs === 4) { color = '#2ecc71'; length = maxLength; }
                else if (shot.runs > 0) { color = '#f1c40f'; length = maxLength * 0.45; }
                else { color = '#95a5a6'; length = maxLength * 0.25; }

                const x2 = startX + length * dx;
                const y2 = startY + length * dy;

                return (
                  <Line
                    key={index}
                    x1={startX}
                    y1={startY}
                    x2={x2}
                    y2={y2}
                    stroke={color}
                    strokeWidth={2.5}
                  />
                );
              })}
            </Svg>
          </ImageBackground>
        </View>

        <View style={styles.legendContainer}>
          <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#e74c3c' }]} /><Text style={styles.legendText}>6s</Text></View>
          <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#2ecc71' }]} /><Text style={styles.legendText}>4s</Text></View>
          <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#f1c40f' }]} /><Text style={styles.legendText}>Singles</Text></View>
          <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#95a5a6' }]} /><Text style={styles.legendText}>Dots</Text></View>
        </View>
      </View>
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      
      {/* ── 1. Primary Summary Grid ── */}
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Icon name="scoreboard-outline" size={20} color={colors.primary} style={{ marginBottom: 4 }} />
          <Text style={styles.statLabel}>Total Runs</Text>
          <Text style={styles.statValue}>{totalRuns || 0}</Text>
        </View>
        <View style={styles.statCard}>
          <Icon name="cricket" size={20} color={colors.primary} style={{ marginBottom: 4 }} />
          <Text style={styles.statLabel}>Total Wickets</Text>
          <Text style={styles.statValue}>{totalWickets || 0}</Text>
        </View>
        <View style={styles.statCard}>
          <Icon name="alpha-f-box-outline" size={20} color="#059669" style={{ marginBottom: 4 }} />
          <Text style={styles.statLabel}>Total 4s</Text>
          <Text style={[styles.statValue, { color: '#059669' }]}>{totalFours || 0}</Text>
        </View>
        <View style={styles.statCard}>
          <Icon name="alpha-s-box-outline" size={20} color="#7C3AED" style={{ marginBottom: 4 }} />
          <Text style={styles.statLabel}>Total 6s</Text>
          <Text style={[styles.statValue, { color: '#7C3AED' }]}>{totalSixes || 0}</Text>
        </View>
        <View style={styles.statCard}>
          <Icon name="trophy-variant-outline" size={20} color={colors.primary} style={{ marginBottom: 4 }} />
          <Text style={styles.statLabel}>Matches Played</Text>
          <Text style={styles.statValue}>{totalMatchesPlayed || 0}</Text>
        </View>
        <View style={styles.statCard}>
          <Icon name="speedometer" size={20} color={colors.primary} style={{ marginBottom: 4 }} />
          <Text style={styles.statLabel}>Tournament RR</Text>
          <Text style={styles.statValue}>{tournamentRunRate ? `${tournamentRunRate}` : '-'}</Text>
        </View>
      </View>

      {/* ── 2. Match Outcome Split (Bat 1st vs Chasing) ── */}
      {totalDecidedMatches > 0 && (
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeaderRow}>
            <Icon name="scale-balance" size={20} color={colors.primary} />
            <Text style={styles.sectionTitle}>Toss & Match Win Analysis</Text>
          </View>
          
          <View style={styles.ratioBarContainer}>
            <View style={[styles.ratioBarPart, { flex: Math.max(1, wonBattingFirst), backgroundColor: '#3B82F6' }]} />
            <View style={[styles.ratioBarPart, { flex: Math.max(1, wonChasing), backgroundColor: '#10B981' }]} />
          </View>

          <View style={styles.ratioLabelsRow}>
            <View style={styles.ratioItem}>
              <View style={[styles.ratioDot, { backgroundColor: '#3B82F6' }]} />
              <Text style={styles.ratioText}>Won Batting 1st: <Text style={{ fontWeight: 'bold', color: colors.textPrimary }}>{wonBattingFirst} ({batFirstPercent}%)</Text></Text>
            </View>
            <View style={styles.ratioItem}>
              <View style={[styles.ratioDot, { backgroundColor: '#10B981' }]} />
              <Text style={styles.ratioText}>Won Chasing: <Text style={{ fontWeight: 'bold', color: colors.textPrimary }}>{wonChasing} ({chasePercent}%)</Text></Text>
            </View>
          </View>
          {tiedOrNoResult > 0 && (
            <Text style={styles.ratioSubText}>Tied / Abandoned: {tiedOrNoResult} matches</Text>
          )}
        </View>
      )}

      {/* ── 3. Tournament Records & Highlights ── */}
      <View style={styles.sectionContainer}>
        <View style={styles.sectionHeaderRow}>
          <Icon name="crown-outline" size={20} color="#EAB308" />
          <Text style={styles.sectionTitle}>Tournament Records (Overall)</Text>
        </View>

        {/* Highest Team Score */}
        {highestTeamScore && highestTeamScore.score && (
          <View style={styles.recordCard}>
            <View style={styles.recordIconBox}>
              <Icon name="fire" size={24} color="#EF4444" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.recordSubtitle}>Highest Team Score</Text>
              <Text style={styles.recordValue}>{highestTeamScore.score}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
                {highestTeamScore.team?.logo && (
                  <Image source={{ uri: getImageUrl(highestTeamScore.team.logo) }} style={styles.teamMiniLogo} />
                )}
                <Text style={styles.recordTeam}>{highestTeamScore.team?.name || 'Team'}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Overall Highest Successful Chase */}
        {highestChase && highestChase.target > 0 && (
          <View style={styles.recordCard}>
            <View style={[styles.recordIconBox, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
              <Icon name="target" size={24} color="#10B981" />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={styles.recordSubtitle}>Highest Successful Chase</Text>
                <View style={styles.overallBadge}>
                  <Text style={styles.overallBadgeText}>Overall Tournament</Text>
                </View>
              </View>
              <Text style={styles.recordValue}>
                {highestChase.target} <Text style={{ fontSize: 16, fontFamily: Typography.fontFamily.medium, color: colors.textSecondary }}>runs</Text>
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
                {highestChase.team?.logo && (
                  <Image source={{ uri: getImageUrl(highestChase.team.logo) }} style={styles.teamMiniLogo} />
                )}
                <Text style={styles.recordTeam}>
                  {highestChase.team?.name || 'Team'}{highestChase.overs ? ` (in ${highestChase.overs} Ov)` : ''}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Lowest Defended Score */}
        {lowestDefended && lowestDefended.score && (
          <View style={styles.recordCard}>
            <View style={[styles.recordIconBox, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
              <Icon name="shield-check" size={24} color="#3B82F6" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.recordSubtitle}>Lowest Total Defended</Text>
              <Text style={styles.recordValue}>{lowestDefended.score}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
                {lowestDefended.team?.logo && (
                  <Image source={{ uri: getImageUrl(lowestDefended.team.logo) }} style={styles.teamMiniLogo} />
                )}
                <Text style={styles.recordTeam}>{lowestDefended.team?.name || 'Team'}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Highest Individual Score */}
        {highestIndividualScore && highestIndividualScore.runs > 0 && (
          <View style={styles.recordCard}>
            <View style={[styles.recordIconBox, { backgroundColor: 'rgba(234, 179, 8, 0.15)' }]}>
              <Icon name="cricket" size={24} color="#EAB308" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.recordSubtitle}>Highest Individual Innings</Text>
              <Text style={styles.recordValue}>
                {highestIndividualScore.runs} <Text style={{ fontSize: 16, fontFamily: Typography.fontFamily.medium, color: colors.textSecondary }}>({highestIndividualScore.balls}b • {highestIndividualScore.fours || 0}x4s, {highestIndividualScore.sixes || 0}x6s)</Text>
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
                {batterPhoto ? (
                  <Image source={{ uri: getImageUrl(batterPhoto) }} style={styles.teamMiniLogo} />
                ) : (
                  <View style={styles.playerAvatarFallback}>
                    <Text style={styles.playerAvatarInitial}>
                      {(highestIndividualScore.player?.name || 'P')[0]?.toUpperCase()}
                    </Text>
                  </View>
                )}
                <Text style={styles.recordTeam}>
                  {highestIndividualScore.player?.name || 'Player'} {highestIndividualScore.team?.name ? `(${highestIndividualScore.team.name})` : ''}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Best Bowling Figures */}
        {bestBowlingFigures && bestBowlingFigures.wickets > 0 && (
          <View style={styles.recordCard}>
            <View style={[styles.recordIconBox, { backgroundColor: 'rgba(124, 58, 237, 0.15)' }]}>
              <Icon name="bowling" size={24} color="#7C3AED" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.recordSubtitle}>Best Bowling Figures</Text>
              <Text style={styles.recordValue}>
                {bestBowlingFigures.wickets}/{bestBowlingFigures.runs} <Text style={{ fontSize: 16, fontFamily: Typography.fontFamily.medium, color: colors.textSecondary }}>({bestBowlingFigures.overs} ov)</Text>
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
                {bowlerPhoto ? (
                  <Image source={{ uri: getImageUrl(bowlerPhoto) }} style={styles.teamMiniLogo} />
                ) : (
                  <View style={styles.playerAvatarFallback}>
                    <Text style={styles.playerAvatarInitial}>
                      {(bestBowlingFigures.player?.name || 'P')[0]?.toUpperCase()}
                    </Text>
                  </View>
                )}
                <Text style={styles.recordTeam}>
                  {bestBowlingFigures.player?.name || 'Player'} {bestBowlingFigures.team?.name ? `(${bestBowlingFigures.team.name})` : ''}
                </Text>
              </View>
            </View>
          </View>
        )}
      </View>

      {/* ── 4. Batting & Inning Averages ── */}
      <View style={styles.sectionContainer}>
        <View style={styles.sectionHeaderRow}>
          <Icon name="chart-bell-curve" size={20} color={colors.primary} />
          <Text style={styles.sectionTitle}>Batting & Match Benchmarks</Text>
        </View>

        <View style={styles.metricsTwoCol}>
          <View style={styles.metricBox}>
            <Text style={styles.metricVal}>{avgFirstInningsScore || '-'}</Text>
            <Text style={styles.metricLbl}>Avg 1st Innings Score</Text>
          </View>
          <View style={styles.metricBox}>
            <Text style={styles.metricVal}>{avgRunsPerMatch || '-'}</Text>
            <Text style={styles.metricLbl}>Avg Runs Per Match</Text>
          </View>
          <View style={styles.metricBox}>
            <Text style={styles.metricVal}>{totalBoundaries}</Text>
            <Text style={styles.metricLbl}>Total Boundaries ({calculatedBoundaryPercent}%)</Text>
          </View>
          <View style={styles.metricBox}>
            <Text style={styles.metricVal}>{fiftiesCount} / {hundredsCount}</Text>
            <Text style={styles.metricLbl}>50s / 100s Scored</Text>
          </View>
        </View>
      </View>

      {/* ── 5. Bowling & Extras Discipline ── */}
      <View style={styles.sectionContainer}>
        <View style={styles.sectionHeaderRow}>
          <Icon name="hand-back-right" size={20} color={colors.primary} />
          <Text style={styles.sectionTitle}>Bowling & Extras Discipline</Text>
        </View>

        <View style={styles.metricsTwoCol}>
          <View style={styles.metricBox}>
            <Text style={styles.metricVal}>{totalDots || 0} ({dotPercent || 0}%)</Text>
            <Text style={styles.metricLbl}>Dot Balls Bowled</Text>
          </View>
          <View style={styles.metricBox}>
            <Text style={styles.metricVal}>
              {totalBallsBowled > 0 ? `${Math.floor(totalBallsBowled / 6)}.${totalBallsBowled % 6}` : '0.0'}
            </Text>
            <Text style={styles.metricLbl}>Total Overs Bowled</Text>
          </View>
        </View>

        {/* Extras Breakdown Chips */}
        {totalExtras && (
          <View style={styles.extrasWrap}>
            <Text style={styles.extrasTitle}>Total Extras Conceded: <Text style={{ color: colors.primary, fontWeight: 'bold' }}>{totalExtras.total || 0}</Text></Text>
            <View style={styles.extrasChipsRow}>
              <View style={styles.extraChip}><Text style={styles.extraChipText}>Wides: {totalExtras.wides || 0}</Text></View>
              <View style={styles.extraChip}><Text style={styles.extraChipText}>No Balls: {totalExtras.noBalls || 0}</Text></View>
              <View style={styles.extraChip}><Text style={styles.extraChipText}>Byes: {totalExtras.byes || 0}</Text></View>
              <View style={styles.extraChip}><Text style={styles.extraChipText}>Leg Byes: {totalExtras.legByes || 0}</Text></View>
            </View>
          </View>
        )}
      </View>

      {/* ── 6. Wagon Wheel ── */}
      {renderWagonWheel()}

    </ScrollView>
  );
};

const createStyles = (colors, shadows, isDark) => StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl + 20,
  },
  emptyContainer: {
    padding: Spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: colors.textSecondary,
    fontFamily: Typography.fontFamily.medium,
    fontSize: 15,
  },

  // ── Grid ──
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: Spacing.lg,
  },
  statCard: {
    flex: 1,
    minWidth: '30%',
    backgroundColor: colors.surface,
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
    ...shadows.sm,
  },
  statLabel: {
    color: colors.textSecondary,
    fontFamily: Typography.fontFamily.medium,
    fontSize: 11,
    marginBottom: 4,
    textAlign: 'center',
  },
  statValue: {
    color: colors.primary,
    fontFamily: Typography.fontFamily.bold,
    fontSize: 22,
    letterSpacing: -0.3,
  },

  // ── Sections ──
  sectionContainer: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
    ...shadows.sm,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: 15,
    fontFamily: Typography.fontFamily.bold,
    color: colors.textPrimary,
  },

  // ── Ratio Bar ──
  ratioBarContainer: {
    height: 10,
    borderRadius: 5,
    flexDirection: 'row',
    overflow: 'hidden',
    marginBottom: 10,
  },
  ratioBarPart: {
    height: '100%',
  },
  ratioLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
  },
  ratioItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ratioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  ratioText: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.medium,
    color: colors.textSecondary,
  },
  ratioSubText: {
    fontSize: 11,
    fontFamily: Typography.fontFamily.regular,
    color: colors.textTertiary,
    marginTop: 6,
    textAlign: 'center',
  },

  // ── Record Cards ──
  recordCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDark ? '#1C1C1E' : '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    gap: 12,
  },
  recordIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordSubtitle: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.medium,
    color: colors.textSecondary,
  },
  recordValue: {
    fontSize: 22,
    fontFamily: Typography.fontFamily.bold,
    color: colors.textPrimary,
    marginTop: 1,
  },
  recordTeam: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.semiBold,
    color: colors.textSecondary,
  },
  teamMiniLogo: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  playerAvatarFallback: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerAvatarInitial: {
    fontSize: 9,
    fontFamily: Typography.fontFamily.bold,
    color: colors.textSecondary,
    lineHeight: 11,
  },
  overallBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  overallBadgeText: {
    fontSize: 10,
    fontFamily: Typography.fontFamily.bold,
    color: '#10B981',
  },

  // ── Metrics 2-Col Grid ──
  metricsTwoCol: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricBox: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: isDark ? '#1C1C1E' : '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
  },
  metricVal: {
    fontSize: 18,
    fontFamily: Typography.fontFamily.bold,
    color: colors.textPrimary,
  },
  metricLbl: {
    fontSize: 11,
    fontFamily: Typography.fontFamily.medium,
    color: colors.textSecondary,
    marginTop: 3,
    textAlign: 'center',
  },

  // ── Extras ──
  extrasWrap: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
  },
  extrasTitle: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.semiBold,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  extrasChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  extraChip: {
    backgroundColor: isDark ? '#262626' : '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  extraChipText: {
    fontSize: 11,
    fontFamily: Typography.fontFamily.medium,
    color: colors.textSecondary,
  },

  // ── Wagon Wheel ──
  wagonWheelWrapper: {
    marginVertical: Spacing.sm,
  },
  regionText: {
    position: 'absolute',
    color: 'rgba(255,255,255,0.7)',
    fontFamily: Typography.fontFamily.bold,
    fontSize: 12,
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: Spacing.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  legendText: {
    color: colors.textSecondary,
    fontFamily: Typography.fontFamily.medium,
    fontSize: 12,
  }
});

export default TournamentStatistics;
