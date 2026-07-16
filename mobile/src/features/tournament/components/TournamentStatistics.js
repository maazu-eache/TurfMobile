import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ImageBackground, TouchableOpacity } from 'react-native';
import Svg, { Line } from 'react-native-svg';
import { Colors, Typography, Spacing, BorderRadius } from '../../../theme/theme';

const GROUND_TYPES = ['Open Ground', 'Indoor', 'Box Cricket', 'Other'];

const TournamentStatistics = ({ tournament }) => {
  const selectedGround = tournament?.groundType || 'Open Ground';
  
  if (!tournament?.statistics) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No statistics data yet.</Text>
      </View>
    );
  }

  const { totalRuns, totalWickets, totalSixes, totalFours, highestTeamScore, highestChase, wagonWheel } = tournament.statistics;

  const currentWagonData = wagonWheel?.[selectedGround] || [];

  const renderWagonWheel = () => {
    // Determine the background image and dimensions
    const isRectangular = selectedGround === 'Indoor' || selectedGround === 'Box Cricket';
    const width = isRectangular ? 260 : 300;
    const height = isRectangular ? 400 : 300;
    const centerX = width / 2;
    const centerY = height / 2;

    const bgImage = isRectangular 
      ? require('../../../turf.png') 
      : require('../../../ground.png');
    
    // SVG Dimensions
    const size = 300;
    const center = size / 2;

    return (
      <View style={styles.wagonWheelContainer}>
        <Text style={styles.wagonTitle}>Wagon Wheel ({selectedGround})</Text>
        
        <View style={styles.wagonWheelWrapper}>
          <ImageBackground source={bgImage} style={{ width, height, alignSelf: 'center', justifyContent: 'center' }} imageStyle={{ borderRadius: isRectangular ? 10 : height / 2, resizeMode: 'cover' }}>
            <Text style={[styles.regionText, { top: 20, alignSelf: 'center' }]}>BEHIND</Text>
            <Text style={[styles.regionText, { bottom: 20, alignSelf: 'center' }]}>STRAIGHT</Text>
            <Text style={[styles.regionText, { left: 15, top: centerY - 10 }]}>OFF</Text>
            <Text style={[styles.regionText, { right: 15, top: centerY - 10 }]}>LEG</Text>

            <Svg width={width} height={height}>
              {currentWagonData.map((shot, index) => {
                const radians = shot.angle * (Math.PI / 180);
                
                const startX = centerX;
                const startY = isRectangular ? centerY - 55 : centerY - 25;

                // Calculate distance to boundary
                let maxLength = 0;
                const dx = Math.cos(radians);
                const dy = Math.sin(radians);
                
                if (isRectangular) {
                  const marginX = 2; // tiny margin to keep inside border
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
                if (shot.runs === 6) { color = '#e74c3c'; length = maxLength; } // Red for 6s (hits the edge)
                else if (shot.runs === 4) { color = '#2ecc71'; length = maxLength; } // Green for 4s (also hits edge)
                else if (shot.runs > 0) { color = '#f1c40f'; length = maxLength * 0.45; } // Yellow for singles
                else { color = '#95a5a6'; length = maxLength * 0.25; } // Gray for dots

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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Total Runs</Text>
          <Text style={styles.statValue}>{totalRuns || 0}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Total Wickets</Text>
          <Text style={styles.statValue}>{totalWickets || 0}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Total 4s</Text>
          <Text style={styles.statValue}>{totalFours || 0}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Total 6s</Text>
          <Text style={styles.statValue}>{totalSixes || 0}</Text>
        </View>
      </View>

      <View style={styles.highlightsContainer}>
        {highestTeamScore && highestTeamScore.score && (
          <View style={styles.highlightCard}>
            <Text style={styles.highlightTitle}>Highest Team Score</Text>
            <Text style={styles.highlightScore}>{highestTeamScore.score}</Text>
            <Text style={styles.highlightTeam}>{highestTeamScore.team?.name || 'Unknown'}</Text>
          </View>
        )}
        {highestChase && highestChase.target > 0 && (
          <View style={styles.highlightCard}>
            <Text style={styles.highlightTitle}>Highest Successful Chase</Text>
            <Text style={styles.highlightScore}>{highestChase.target}</Text>
            <Text style={styles.highlightTeam}>{highestChase.team?.name || 'Unknown'} (in {highestChase.overs} Ov)</Text>
          </View>
        )}
      </View>

      {renderWagonWheel()}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  emptyContainer: {
    padding: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.medium,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  statCard: {
    width: '48%',
    backgroundColor: Colors.backgroundElevated,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
    alignItems: 'center',
  },
  statLabel: {
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.medium,
    fontSize: 12,
    marginBottom: 4,
  },
  statValue: {
    color: Colors.primary,
    fontFamily: Typography.fontFamily.bold,
    fontSize: 24,
  },
  highlightsContainer: {
    marginBottom: Spacing.xl,
  },
  highlightCard: {
    backgroundColor: Colors.backgroundElevated,
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    alignItems: 'center',
    borderLeftWidth: 4,
    borderLeftColor: Colors.secondary,
  },
  highlightTitle: {
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.medium,
    fontSize: 14,
    marginBottom: 8,
  },
  highlightScore: {
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.bold,
    fontSize: 28,
  },
  highlightTeam: {
    color: Colors.textTertiary,
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: 14,
    marginTop: 4,
  },
  wagonWheelContainer: {
    backgroundColor: Colors.backgroundElevated,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  wagonTitle: {
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.bold,
    fontSize: 16,
    marginBottom: Spacing.md,
  },
  wagonWheelWrapper: {
    marginVertical: Spacing.md,
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
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.medium,
    fontSize: 12,
  }
});

export default TournamentStatistics;
