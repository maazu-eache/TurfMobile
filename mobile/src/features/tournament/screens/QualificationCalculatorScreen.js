import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Animated, Dimensions, TextInput,
  StatusBar, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../../theme/theme';
import api, { getImageUrl } from '../../../api/axios';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Local NRR preview (on-device, instant) ──────────────────────────────────
const computeLiveNRR = (pt, battingFirst, score, maxOvers) => {
  if (!pt || !score || score <= 0) return null;
  const rf = pt.runsFor || 0;
  const of_ = pt.oversFor || 0;
  const ra = pt.runsAgainst || 0;
  const oa = pt.oversAgainst || 0;

  if (battingFirst) {
    // Restrict to score-1 (worst winning margin)
    const nrrBest = ((rf + score) / (of_ + maxOvers)) - ((ra + 0) / (oa + maxOvers));
    const nrrWorst = ((rf + score) / (of_ + maxOvers)) - ((ra + score - 1) / (oa + maxOvers));
    return { best: nrrBest, worst: nrrWorst };
  } else {
    // If we are bowling first and they scored 'score', assume we chase it in maxOvers for worst case scenario preview
    const nrr = ((rf + score + 1) / (of_ + maxOvers)) - ((ra + score) / (oa + maxOvers));
    return { chase: nrr };
  }
};

// ─── Sub-components ──────────────────────────────────────────────────────────

const GlassCard = ({ children, style, glowing }) => (
  <View style={[styles.glassCard, glowing && styles.glassCardGlow, style]}>
    {children}
  </View>
);

const StatChip = ({ label, value, accent }) => (
  <View style={[styles.statChip, accent && styles.statChipAccent]}>
    <Text style={styles.statChipLabel}>{label}</Text>
    <Text style={[styles.statChipValue, accent && styles.statChipValueAccent]}>{value}</Text>
  </View>
);

const CircularProgress = ({ probability, size = 120 }) => {
  const animVal = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animVal, {
      toValue: probability / 100,
      duration: 1200,
      useNativeDriver: false,
    }).start();
  }, [probability]);

  const color = probability > 70 ? Colors.success : probability > 40 ? Colors.warning : Colors.error;

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', width: size, height: size }}>
      {/* Background ring */}
      <View style={{
        width: size, height: size, borderRadius: size / 2,
        borderWidth: 8, borderColor: 'rgba(255,255,255,0.08)',
        position: 'absolute'
      }} />
      {/* Progress ring via rotation trick */}
      <View style={{
        width: size - 4, height: size - 4, borderRadius: (size - 4) / 2,
        borderWidth: 8,
        borderColor: 'transparent',
        borderTopColor: color,
        transform: [{ rotate: `${(probability / 100) * 360}deg` }],
        position: 'absolute',
      }} />
      <Text style={{ color, fontFamily: Typography.fontFamily.extraBold, fontSize: 26 }}>
        {probability}%
      </Text>
      <Text style={{ color: Colors.textSecondary, fontFamily: Typography.fontFamily.medium, fontSize: 10, textAlign: 'center' }}>
        Probability
      </Text>
    </View>
  );
};

const AnimatedNumber = ({ value, prefix = '', suffix = '', style }) => {
  const animVal = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = useState('0');

  useEffect(() => {
    const target = parseFloat(value) || 0;
    animVal.setValue(0);
    Animated.timing(animVal, {
      toValue: target,
      duration: 800,
      useNativeDriver: false,
    }).start();
    const listener = animVal.addListener(({ value: v }) => {
      setDisplay(Number.isInteger(target) ? Math.round(v).toString() : v.toFixed(3));
    });
    return () => animVal.removeListener(listener);
  }, [value]);

  return <Text style={style}>{prefix}{display}{suffix}</Text>;
};

const StatusBadge = ({ statusCode, status, color }) => {
  const emoji = {
    Q: '🟢', CQ: '🟡', TBD: '🟠', NRR: '🔵', E: '🔴'
  }[statusCode] || '⚪';

  return (
    <View style={[styles.statusBadge, { backgroundColor: color + '22', borderColor: color }]}>
      <Text style={styles.statusEmoji}>{emoji}</Text>
      <Text style={[styles.statusText, { color }]}>{status}</Text>
    </View>
  );
};

const TeamCard = ({ pt, selected, onPress }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const team = pt.team || {};
  const logoUri = team.logo ? getImageUrl(team.logo) : null;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.94, duration: 80, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start(() => onPress());
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={[styles.teamCard, selected && styles.teamCardSelected]}
        onPress={handlePress}
        activeOpacity={0.85}
      >
        <View style={styles.teamCardLogoWrap}>
          {logoUri ? (
            <View style={styles.teamLogoCircle}>
              <Text style={{ fontSize: 16 }}>🏏</Text>
            </View>
          ) : (
            <View style={styles.teamLogoCircle}>
              <Text style={{ color: Colors.primary, fontFamily: Typography.fontFamily.extraBold, fontSize: 11 }}>
                {(team.shortName || team.name || '?').substring(0, 3).toUpperCase()}
              </Text>
            </View>
          )}
          {selected && (
            <View style={styles.teamCardCheck}>
              <Icon name="check" size={10} color={Colors.background} />
            </View>
          )}
        </View>
        <Text style={[styles.teamCardName, selected && styles.teamCardNameSelected]} numberOfLines={1}>
          {team.shortName || (team.name || '').substring(0, 6)}
        </Text>
        <Text style={styles.teamCardPts}>{pt.points || 0} pts</Text>
        <Text style={[styles.teamCardNRR, { color: (pt.netRunRate || 0) >= 0 ? Colors.success : Colors.error }]}>
          {(pt.netRunRate || 0) >= 0 ? '+' : ''}{(pt.netRunRate || 0).toFixed(3)}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

const ScenarioCard = ({ scenario, index, battingFirst }) => {
  const stars = '⭐'.repeat(scenario.stars);
  const difficultyColor = scenario.stars === 3 ? Colors.success : scenario.stars === 2 ? Colors.warning : Colors.error;

  return (
    <GlassCard style={styles.scenarioCardWrap}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Text style={[styles.scenarioCardLabel, { color: difficultyColor }]}>{scenario.label}</Text>
        <Text style={{ fontSize: 14 }}>{stars}</Text>
      </View>
      {battingFirst ? (
        <>
          <View style={styles.scenarioRow}>
            <MCIcon name="cricket" size={16} color={Colors.primary} />
            <Text style={styles.scenarioKey}>Your Score</Text>
            <Text style={styles.scenarioVal}>{scenario.yourScore}</Text>
          </View>
          <View style={styles.scenarioRow}>
            <MCIcon name="shield-check" size={16} color='#60a5fa' />
            <Text style={styles.scenarioKey}>Restrict To</Text>
            <Text style={[styles.scenarioVal, { color: '#60a5fa' }]}>≤ {scenario.restrictOpponentTo}</Text>
          </View>
          <View style={styles.scenarioRow}>
            <MCIcon name="trending-up" size={16} color={Colors.success} />
            <Text style={styles.scenarioKey}>Win By</Text>
            <Text style={[styles.scenarioVal, { color: Colors.success }]}>{scenario.winMarginRuns} runs</Text>
          </View>
        </>
      ) : (
        <>
          <View style={styles.scenarioRow}>
            <MCIcon name="cricket" size={16} color={Colors.textSecondary} />
            <Text style={styles.scenarioKey}>Opponent Score</Text>
            <Text style={styles.scenarioVal}>{scenario.opponentScore}</Text>
          </View>
          <View style={styles.scenarioRow}>
            <MCIcon name="target" size={16} color={Colors.primary} />
            <Text style={styles.scenarioKey}>Chase Target</Text>
            <Text style={[styles.scenarioVal, { color: Colors.primary }]}>{scenario.chaseTarget}</Text>
          </View>
          <View style={styles.scenarioRow}>
            <MCIcon name="clock-fast" size={16} color={Colors.success} />
            <Text style={styles.scenarioKey}>Within Overs</Text>
            <Text style={[styles.scenarioVal, { color: Colors.success }]}>{scenario.mustChaseWithin}</Text>
          </View>
          <View style={styles.scenarioRow}>
            <MCIcon name="run-fast" size={16} color={Colors.warning} />
            <Text style={styles.scenarioKey}>Req. Rate</Text>
            <Text style={[styles.scenarioVal, { color: Colors.warning }]}>{scenario.requiredRunRate}</Text>
          </View>
        </>
      )}
      <View style={[styles.scenarioNRRRow, { backgroundColor: difficultyColor + '18' }]}>
        <Text style={{ color: Colors.textSecondary, fontFamily: Typography.fontFamily.medium, fontSize: 12 }}>Projected NRR</Text>
        <Text style={{ color: difficultyColor, fontFamily: Typography.fontFamily.extraBold, fontSize: 14 }}>
          {scenario.projectedNRR >= 0 ? '+' : ''}{scenario.projectedNRR.toFixed(3)}
        </Text>
      </View>
    </GlassCard>
  );
};

const ProjectedTableRow = ({ row, isSelected, index }) => {
  const highlight = isSelected;
  return (
    <View style={[styles.projTableRow, highlight && styles.projTableRowHighlight]}>
      <Text style={[styles.projTableRank, highlight && { color: Colors.primary }]}>{index + 1}</Text>
      <Text style={[styles.projTableTeam, highlight && { color: Colors.primary, fontFamily: Typography.fontFamily.bold }]} numberOfLines={1}>
        {row.shortName || row.teamName}
      </Text>
      <Text style={styles.projTablePts}>{row.points}</Text>
      <Text style={[styles.projTableNRR, { color: row.nrr >= 0 ? Colors.success : Colors.error }]}>
        {row.nrr >= 0 ? '+' : ''}{row.nrr.toFixed(3)}
      </Text>
    </View>
  );
};

// ─── Main Screen ─────────────────────────────────────────────────────────────

const QualificationCalculatorScreen = ({ route, navigation }) => {
  const { tournamentId, pointsTable: initialTable, tournamentOvers } = route.params || {};

  const [pointsTable, setPointsTable] = useState(initialTable || []);
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [selectedOpponentId, setSelectedOpponentId] = useState('');
  const [targetRank, setTargetRank] = useState(4);
  const [battingFirst, setBattingFirst] = useState(true);
  const [firstInningsScore, setFirstInningsScore] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [liveNRR, setLiveNRR] = useState(null);

  // Animation refs
  const resultsAnim = useRef(new Animated.Value(0)).current;
  const heroAnim = useRef(new Animated.Value(0)).current;
  const btnScale = useRef(new Animated.Value(1)).current;
  const scoreRef = useRef(firstInningsScore);

  useEffect(() => {
    Animated.timing(heroAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, []);

  // Live NRR preview on score change
  useEffect(() => {
    scoreRef.current = firstInningsScore;
    const score = parseInt(firstInningsScore, 10);
    if (!score || score <= 0 || !selectedTeamId) { setLiveNRR(null); return; }

    const teamPt = pointsTable.find(pt => {
      const id = pt.team?._id || pt.team;
      return (id?._id || id)?.toString() === selectedTeamId;
    });
    if (!teamPt) return;

    const maxOvers = tournamentOvers || 20;
    const live = computeLiveNRR(teamPt, battingFirst, score, maxOvers);
    setLiveNRR(live);
  }, [firstInningsScore, selectedTeamId, battingFirst, pointsTable, tournamentOvers]);

  const handleCalculate = useCallback(async () => {
    if (!selectedTeamId || !selectedOpponentId || !firstInningsScore) {
      return;
    }

    Animated.sequence([
      Animated.timing(btnScale, { toValue: 0.95, duration: 100, useNativeDriver: true }),
      Animated.timing(btnScale, { toValue: 1, duration: 150, useNativeDriver: true }),
    ]).start();

    setLoading(true);
    setResult(null);
    resultsAnim.setValue(0);

    try {
      const res = await api.post(`/tournaments/${tournamentId}/scenario-calculator`, {
        teamId: selectedTeamId,
        opponentId: selectedOpponentId,
        battingFirst,
        firstInningsScore: parseInt(firstInningsScore, 10),
        targetRank,
      });

      setResult(res.data.data || res.data);

      Animated.timing(resultsAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();
    } catch (e) {
      console.error('[QualCalc] Error:', e?.response?.data || e.message);
    } finally {
      setLoading(false);
    }
  }, [selectedTeamId, selectedOpponentId, battingFirst, firstInningsScore, targetRank, tournamentId]);

  const targetOptions = [
    { label: '1st', value: 1 },
    { label: 'Top 2', value: 2 },
    { label: 'Top 4', value: 4 },
    { label: 'Top 8', value: 8 },
  ];

  const selectedTeamPt = pointsTable.find(pt => {
    const id = pt.team?._id || pt.team;
    return (id?._id || id)?.toString() === selectedTeamId;
  });

  const canCalculate = selectedTeamId && selectedOpponentId && firstInningsScore && parseInt(firstInningsScore) > 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Icon name="arrow-left" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Qual. Calculator</Text>
        <View style={{ width: 40, height: 40 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Hero Card */}
        <Animated.View style={[styles.heroCard, {
          opacity: heroAnim,
          transform: [{ translateY: heroAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }]
        }]}>
          <View style={styles.heroGradientOverlay} />
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <MCIcon name="calculator-variant-outline" size={22} color={Colors.primary} />
            <Text style={styles.heroTitle}>  Qualification Scenario</Text>
          </View>
          <Text style={styles.heroSubtitle}>
            Calculate every possible qualification path using official ICC NRR formulas.
          </Text>
          {selectedTeamPt && (
            <View style={styles.heroTeamRow}>
              <View style={styles.heroTeamBadge}>
                <Text style={styles.heroTeamName}>
                  {selectedTeamPt.team?.shortName || selectedTeamPt.team?.name || 'Team'}
                </Text>
              </View>
              <View style={styles.heroStatRow}>
                <Text style={styles.heroStat}>
                  {selectedTeamPt.points || 0} pts
                </Text>
                <Text style={styles.heroStatDivider}> · </Text>
                <Text style={[styles.heroStat, { color: (selectedTeamPt.netRunRate || 0) >= 0 ? Colors.success : Colors.error }]}>
                  NRR {(selectedTeamPt.netRunRate || 0) >= 0 ? '+' : ''}{(selectedTeamPt.netRunRate || 0).toFixed(3)}
                </Text>
              </View>
            </View>
          )}
        </Animated.View>

        {/* Section 1: Select Team */}
        <Text style={styles.sectionTitle}>SELECT TEAM</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.teamScroll} contentContainerStyle={{ paddingHorizontal: Spacing.base }}>
          {pointsTable.map((pt, i) => {
            const id = pt.team?._id?.toString() || pt.team?.toString();
            return (
              <TeamCard
                key={id || i}
                pt={pt}
                selected={selectedTeamId === id}
                onPress={() => {
                  setSelectedTeamId(id);
                  if (selectedOpponentId === id) setSelectedOpponentId('');
                  setResult(null);
                }}
              />
            );
          })}
        </ScrollView>

        {/* Section 2: Select Opponent */}
        <Text style={styles.sectionTitle}>SELECT OPPONENT</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.teamScroll} contentContainerStyle={{ paddingHorizontal: Spacing.base }}>
          {pointsTable.filter(pt => {
            const id = pt.team?._id?.toString() || pt.team?.toString();
            if (id === selectedTeamId) return false;
            
            // If groups exist, only allow opponents from the SAME group
            if (selectedTeamPt && selectedTeamPt.groupName) {
              return pt.groupName === selectedTeamPt.groupName;
            }
            return true;
          }).map((pt, i) => {
            const id = pt.team?._id?.toString() || pt.team?.toString();
            return (
              <TeamCard
                key={id || i}
                pt={pt}
                selected={selectedOpponentId === id}
                onPress={() => { setSelectedOpponentId(id); setResult(null); }}
              />
            );
          })}
        </ScrollView>

        {/* Section 3: Target Position */}
        <Text style={styles.sectionTitle}>TARGET POSITION</Text>
        <GlassCard style={styles.segmentCard}>
          <View style={styles.segmentRow}>
            {targetOptions.map(opt => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.segmentBtn, targetRank === opt.value && styles.segmentBtnActive]}
                onPress={() => { setTargetRank(opt.value); setResult(null); }}
              >
                <Text style={[styles.segmentBtnText, targetRank === opt.value && styles.segmentBtnTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </GlassCard>

        {/* Section 4: Bat / Bowl First */}
        <Text style={styles.sectionTitle}>TOSS CHOICE</Text>
        <View style={styles.tossRow}>
          <TouchableOpacity
            style={[styles.tossCard, battingFirst && styles.tossCardActive]}
            onPress={() => { setBattingFirst(true); setResult(null); setFirstInningsScore(''); setLiveNRR(null); }}
          >
            {battingFirst && <View style={styles.tossCardGlow} />}
            <MCIcon name="cricket" size={28} color={battingFirst ? Colors.primary : Colors.textSecondary} />
            <Text style={[styles.tossLabel, battingFirst && styles.tossLabelActive]}>Bat First</Text>
            <Text style={styles.tossSubLabel}>Set the target</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tossCard, !battingFirst && styles.tossCardActive]}
            onPress={() => { setBattingFirst(false); setResult(null); setFirstInningsScore(''); setLiveNRR(null); }}
          >
            {!battingFirst && <View style={styles.tossCardGlow} />}
            <MCIcon name="shield-outline" size={28} color={!battingFirst ? Colors.primary : Colors.textSecondary} />
            <Text style={[styles.tossLabel, !battingFirst && styles.tossLabelActive]}>Bowl First</Text>
            <Text style={styles.tossSubLabel}>Chase the target</Text>
          </TouchableOpacity>
        </View>

        {/* Score Input */}
        <Text style={styles.sectionTitle}>
          {battingFirst ? 'YOUR PROJECTED SCORE' : 'OPPONENT FIRST INNINGS SCORE'}
        </Text>
        <GlassCard style={styles.inputCard}>
          <View style={styles.inputRow}>
            <MCIcon name="cricket" size={20} color={Colors.primary} />
            <TextInput
              style={styles.scoreInput}
              placeholder={battingFirst ? 'e.g. 180' : 'e.g. 145'}
              placeholderTextColor={Colors.textTertiary}
              keyboardType="number-pad"
              value={firstInningsScore}
              onChangeText={v => { setFirstInningsScore(v); setResult(null); }}
            />
            <Text style={styles.inputUnit}>runs</Text>
          </View>
        </GlassCard>

        {/* Live NRR Preview */}
        {liveNRR && (
          <GlassCard style={styles.liveNRRCard}>
            <Text style={styles.liveNRRTitle}>
              <MCIcon name="chart-line" size={14} color={Colors.primary} /> LIVE NRR PREVIEW
            </Text>
            <View style={styles.liveNRRRow}>
              <View style={{ alignItems: 'center' }}>
                <Text style={styles.liveNRRLabel}>Current NRR</Text>
                <Text style={[styles.liveNRRValue, { color: Colors.textSecondary }]}>
                  {(selectedTeamPt?.netRunRate || 0) >= 0 ? '+' : ''}{(selectedTeamPt?.netRunRate || 0).toFixed(3)}
                </Text>
              </View>
              <View style={{ alignItems: 'center' }}>
                <MCIcon name="arrow-right-bold" size={24} color={Colors.primary} />
              </View>
              {battingFirst && liveNRR.best !== undefined ? (
                <View style={{ alignItems: 'center' }}>
                  <Text style={styles.liveNRRLabel}>Projected NRR</Text>
                  <Text style={[styles.liveNRRValue, { color: liveNRR.best >= 0 ? Colors.success : Colors.error }]}>
                    {liveNRR.best >= 0 ? '+' : ''}{liveNRR.best.toFixed(3)}
                  </Text>
                  <Text style={{ color: Colors.textTertiary, fontSize: 10 }}>Best case</Text>
                </View>
              ) : liveNRR.chase !== undefined ? (
                <View style={{ alignItems: 'center' }}>
                  <Text style={styles.liveNRRLabel}>Projected NRR</Text>
                  <Text style={[styles.liveNRRValue, { color: liveNRR.chase >= 0 ? Colors.success : Colors.error }]}>
                    {liveNRR.chase >= 0 ? '+' : ''}{liveNRR.chase.toFixed(3)}
                  </Text>
                  <Text style={{ color: Colors.textTertiary, fontSize: 10 }}>If chased now</Text>
                </View>
              ) : null}
            </View>
          </GlassCard>
        )}

        {/* Calculate Button */}
        <Animated.View style={[{ transform: [{ scale: btnScale }], marginHorizontal: Spacing.base, marginTop: Spacing.lg }]}>
          <TouchableOpacity
            style={[styles.calcBtn, !canCalculate && styles.calcBtnDisabled]}
            onPress={handleCalculate}
            disabled={!canCalculate || loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={Colors.background} />
            ) : (
              <>
                <MCIcon name="calculator-variant" size={18} color={Colors.background} />
                <Text style={styles.calcBtnText}>  Calculate Scenario</Text>
              </>
            )}
          </TouchableOpacity>
        </Animated.View>

        {/* ── Results ── */}
        {result && (
          <Animated.View style={[{ opacity: resultsAnim, transform: [{ translateY: resultsAnim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }] }]}>

            {/* Status Badge */}
            <View style={styles.resultHeaderRow}>
              <StatusBadge statusCode={result.statusCode} status={result.status} color={result.statusColor || Colors.warning} />
              <CircularProgress probability={result.probability || 0} size={90} />
            </View>

            {/* Message */}
            <GlassCard style={styles.messageCard}>
              <MCIcon name="information-outline" size={16} color={Colors.primary} />
              <Text style={styles.messageText}>{result.message}</Text>
            </GlassCard>

            {/* Summary Stats */}
            <Text style={styles.sectionTitle}>SUMMARY</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: Spacing.base, gap: 8 }}>
              <StatChip label="Current NRR" value={`${(result.currentNRR || 0) >= 0 ? '+' : ''}${(result.currentNRR || 0).toFixed(3)}`} />
              <StatChip label="Projected NRR" value={`${(result.projectedNRR || 0) >= 0 ? '+' : ''}${(result.projectedNRR || 0).toFixed(3)}`} accent />
              <StatChip label="Target Rank" value={`#${result.targetRank}`} />
              <StatChip label="Probability" value={`${result.probability}%`} accent />
            </ScrollView>

            {/* Scenarios */}
            {result.scenarios && result.scenarios.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>SCENARIOS</Text>
                <FlatList
                  data={result.scenarios}
                  keyExtractor={(_, i) => i.toString()}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: Spacing.base, gap: 12 }}
                  renderItem={({ item, index }) => (
                    <ScenarioCard scenario={item} index={index} battingFirst={result.battingFirst} />
                  )}
                />
              </>
            )}

            {/* Fixture Impact */}
            {result.fixtureImpact && result.fixtureImpact.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>FIXTURE IMPACT</Text>
                <View style={{ paddingHorizontal: Spacing.base }}>
                  {result.fixtureImpact.map((fx, i) => (
                    <GlassCard key={i} style={styles.fixtureCard}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={styles.fixtureMatchup}>{fx.teamAName} vs {fx.teamBName}</Text>
                        <View style={[styles.fixtureBadge, { backgroundColor: fx.impact === 'Critical' ? Colors.error + '22' : Colors.warning + '22' }]}>
                          <Text style={{ color: fx.impact === 'Critical' ? Colors.error : Colors.warning, fontSize: 10, fontFamily: Typography.fontFamily.bold }}>
                            {fx.impact}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.fixturePreferRow}>
                        <MCIcon name="thumb-up-outline" size={14} color={Colors.success} />
                        <Text style={styles.fixturePrefer}>{fx.preferredResult}</Text>
                      </View>
                    </GlassCard>
                  ))}
                </View>
              </>
            )}

            {/* Projected Points Table */}
            {result.projectedTable && result.projectedTable.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>PROJECTED TABLE</Text>
                <GlassCard style={{ marginHorizontal: Spacing.base }}>
                  <View style={styles.projTableHeader}>
                    <Text style={styles.projTableHeaderText}>#</Text>
                    <Text style={[styles.projTableHeaderText, { flex: 2, textAlign: 'left' }]}>Team</Text>
                    <Text style={styles.projTableHeaderText}>Pts</Text>
                    <Text style={styles.projTableHeaderText}>NRR</Text>
                  </View>
                  {result.projectedTable.map((row, i) => (
                    <ProjectedTableRow
                      key={row.teamId || i}
                      row={row}
                      index={i}
                      isSelected={row.teamId === selectedTeamId}
                    />
                  ))}
                </GlassCard>
              </>
            )}

            {/* Bottom Actions */}
            <View style={styles.bottomActions}>
              <TouchableOpacity style={styles.bottomBtn} onPress={() => { setResult(null); }}>
                <Icon name="refresh-cw" size={14} color={Colors.textSecondary} />
                <Text style={styles.bottomBtnText}>Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.bottomBtn, styles.bottomBtnPrimary]} onPress={handleCalculate}>
                <MCIcon name="calculator-variant" size={14} color={Colors.background} />
                <Text style={[styles.bottomBtnText, { color: Colors.background }]}>Recalculate</Text>
              </TouchableOpacity>
            </View>

          </Animated.View>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.base, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  headerBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontFamily: Typography.fontFamily.bold, fontSize: 17, color: Colors.textPrimary },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: { paddingTop: Spacing.base },

  // Hero Card
  heroCard: {
    marginHorizontal: Spacing.base, marginBottom: Spacing.lg,
    backgroundColor: Colors.backgroundElevated,
    borderRadius: BorderRadius['2xl'],
    padding: Spacing.lg,
    borderWidth: 1, borderColor: Colors.border,
    overflow: 'hidden',
    ...Shadows.md,
  },
  heroGradientOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: Colors.primaryAlpha10,
    borderRadius: BorderRadius['2xl'],
  },
  heroTitle: { fontFamily: Typography.fontFamily.bold, fontSize: 18, color: Colors.textPrimary },
  heroSubtitle: { fontFamily: Typography.fontFamily.medium, fontSize: 13, color: Colors.textSecondary, lineHeight: 20, marginTop: 4 },
  heroTeamRow: { marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  heroTeamBadge: { backgroundColor: Colors.primaryAlpha20, paddingHorizontal: 10, paddingVertical: 4, borderRadius: BorderRadius.full },
  heroTeamName: { color: Colors.primary, fontFamily: Typography.fontFamily.bold, fontSize: 13 },
  heroStatRow: { flexDirection: 'row', alignItems: 'center' },
  heroStat: { color: Colors.textSecondary, fontFamily: Typography.fontFamily.medium, fontSize: 13 },
  heroStatDivider: { color: Colors.textTertiary },

  // Glass card
  glassCard: {
    backgroundColor: Colors.backgroundElevated,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.sm,
  },
  glassCardGlow: { borderColor: Colors.primary, ...Shadows.glow },

  // Section
  sectionTitle: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: 11,
    color: Colors.textTertiary,
    letterSpacing: 1.5,
    marginHorizontal: Spacing.base,
    marginBottom: 10,
    marginTop: Spacing.lg,
  },

  // Team cards
  teamScroll: { marginBottom: 4 },
  teamCard: {
    width: 90, alignItems: 'center', padding: 10,
    backgroundColor: Colors.backgroundElevated,
    borderRadius: BorderRadius.xl,
    marginRight: 10,
    borderWidth: 1, borderColor: Colors.border,
  },
  teamCardSelected: { borderColor: Colors.primary, backgroundColor: Colors.primaryAlpha10 },
  teamCardLogoWrap: { position: 'relative', marginBottom: 6 },
  teamLogoCircle: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: Colors.surface,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  teamCardCheck: {
    position: 'absolute', bottom: -2, right: -2,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: Colors.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  teamCardName: { fontFamily: Typography.fontFamily.semiBold, fontSize: 11, color: Colors.textSecondary, textAlign: 'center' },
  teamCardNameSelected: { color: Colors.primary },
  teamCardPts: { fontFamily: Typography.fontFamily.bold, fontSize: 13, color: Colors.textPrimary, marginTop: 2 },
  teamCardNRR: { fontFamily: Typography.fontFamily.medium, fontSize: 10, marginTop: 1 },

  // Segment Control
  segmentCard: { marginHorizontal: Spacing.base },
  segmentRow: { flexDirection: 'row', gap: 8 },
  segmentBtn: {
    flex: 1, paddingVertical: 10, borderRadius: BorderRadius.lg,
    backgroundColor: Colors.surface,
    alignItems: 'center', borderWidth: 1, borderColor: Colors.border,
  },
  segmentBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  segmentBtnText: { fontFamily: Typography.fontFamily.semiBold, fontSize: 12, color: Colors.textSecondary },
  segmentBtnTextActive: { color: Colors.background },

  // Toss cards
  tossRow: { flexDirection: 'row', gap: 12, marginHorizontal: Spacing.base },
  tossCard: {
    flex: 1, alignItems: 'center', padding: Spacing.lg,
    backgroundColor: Colors.backgroundElevated,
    borderRadius: BorderRadius.xl,
    borderWidth: 1, borderColor: Colors.border,
    overflow: 'hidden',
  },
  tossCardActive: { borderColor: Colors.primary, ...Shadows.glow },
  tossCardGlow: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: Colors.primaryAlpha10,
  },
  tossLabel: { fontFamily: Typography.fontFamily.bold, fontSize: 15, color: Colors.textSecondary, marginTop: 8 },
  tossLabelActive: { color: Colors.primary },
  tossSubLabel: { fontFamily: Typography.fontFamily.medium, fontSize: 11, color: Colors.textTertiary, marginTop: 2 },

  // Input
  inputCard: { marginHorizontal: Spacing.base },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  scoreInput: {
    flex: 1, fontFamily: Typography.fontFamily.bold, fontSize: 20,
    color: Colors.textPrimary,
    paddingVertical: 4,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  inputUnit: { fontFamily: Typography.fontFamily.medium, fontSize: 13, color: Colors.textTertiary },

  // Live NRR
  liveNRRCard: { marginHorizontal: Spacing.base, marginTop: Spacing.md },
  liveNRRTitle: { fontFamily: Typography.fontFamily.bold, fontSize: 11, color: Colors.primary, letterSpacing: 1, marginBottom: 10 },
  liveNRRRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  liveNRRLabel: { fontFamily: Typography.fontFamily.medium, fontSize: 11, color: Colors.textTertiary, marginBottom: 4 },
  liveNRRValue: { fontFamily: Typography.fontFamily.extraBold, fontSize: 20 },

  // Calculate Button
  calcBtn: {
    flexDirection: 'row',
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: BorderRadius.xl,
    justifyContent: 'center', alignItems: 'center',
    ...Shadows.glow,
  },
  calcBtnDisabled: { backgroundColor: Colors.surface, ...Shadows.sm },
  calcBtnText: { fontFamily: Typography.fontFamily.extraBold, fontSize: 15, color: Colors.background },

  // Results
  resultHeaderRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginHorizontal: Spacing.base, marginTop: Spacing.xl,
  },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: BorderRadius.full, borderWidth: 1,
  },
  statusEmoji: { fontSize: 18 },
  statusText: { fontFamily: Typography.fontFamily.bold, fontSize: 16 },

  // Message card
  messageCard: { marginHorizontal: Spacing.base, marginTop: Spacing.md, flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  messageText: { flex: 1, fontFamily: Typography.fontFamily.semiBold, fontSize: 14, color: Colors.textPrimary, lineHeight: 20 },

  // Stat chips
  statChip: {
    paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', minWidth: 90,
  },
  statChipAccent: { borderColor: Colors.primary, backgroundColor: Colors.primaryAlpha10 },
  statChipLabel: { fontFamily: Typography.fontFamily.medium, fontSize: 10, color: Colors.textTertiary, marginBottom: 3 },
  statChipValue: { fontFamily: Typography.fontFamily.extraBold, fontSize: 16, color: Colors.textPrimary },
  statChipValueAccent: { color: Colors.primary },

  // Scenario card
  scenarioCardWrap: { width: SCREEN_WIDTH * 0.65, marginRight: 0 },
  scenarioCardLabel: { fontFamily: Typography.fontFamily.bold, fontSize: 14 },
  scenarioRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  scenarioKey: { flex: 1, fontFamily: Typography.fontFamily.medium, fontSize: 13, color: Colors.textSecondary },
  scenarioVal: { fontFamily: Typography.fontFamily.extraBold, fontSize: 15, color: Colors.textPrimary },
  scenarioNRRRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 8, borderRadius: BorderRadius.md, marginTop: 6 },

  // Fixture cards
  fixtureCard: { marginBottom: 10 },
  fixtureMatchup: { fontFamily: Typography.fontFamily.bold, fontSize: 14, color: Colors.textPrimary, flex: 1 },
  fixtureBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: BorderRadius.full },
  fixturePreferRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  fixturePrefer: { fontFamily: Typography.fontFamily.medium, fontSize: 12, color: Colors.success },

  // Projected table
  projTableHeader: { flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Colors.borderLight, marginBottom: 4 },
  projTableHeaderText: { flex: 1, textAlign: 'center', fontFamily: Typography.fontFamily.bold, fontSize: 10, color: Colors.textTertiary, letterSpacing: 0.5 },
  projTableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderRadius: BorderRadius.md },
  projTableRowHighlight: { backgroundColor: Colors.primaryAlpha10 },
  projTableRank: { flex: 1, textAlign: 'center', fontFamily: Typography.fontFamily.bold, fontSize: 13, color: Colors.textSecondary },
  projTableTeam: { flex: 2, fontFamily: Typography.fontFamily.semiBold, fontSize: 13, color: Colors.textPrimary },
  projTablePts: { flex: 1, textAlign: 'center', fontFamily: Typography.fontFamily.extraBold, fontSize: 13, color: Colors.textPrimary },
  projTableNRR: { flex: 1, textAlign: 'center', fontFamily: Typography.fontFamily.semiBold, fontSize: 12 },

  // Bottom actions
  bottomActions: { flexDirection: 'row', gap: 12, marginHorizontal: Spacing.base, marginTop: Spacing.xl },
  bottomBtn: {
    flex: 1, flexDirection: 'row', gap: 6, justifyContent: 'center', alignItems: 'center',
    paddingVertical: 13, borderRadius: BorderRadius.xl,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
  },
  bottomBtnPrimary: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  bottomBtnText: { fontFamily: Typography.fontFamily.bold, fontSize: 14, color: Colors.textSecondary },
});

export default QualificationCalculatorScreen;
