import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Animated, Dimensions, TextInput,
  StatusBar, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme, Typography, Spacing, BorderRadius } from '../../../theme/theme';
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
    const nrrBest = ((rf + score) / (of_ + maxOvers)) - ((ra + 0) / (oa + maxOvers));
    const nrrWorst = ((rf + score) / (of_ + maxOvers)) - ((ra + score - 1) / (oa + maxOvers));
    return { best: nrrBest, worst: nrrWorst };
  } else {
    const nrr = ((rf + score + 1) / (of_ + maxOvers)) - ((ra + score) / (oa + maxOvers));
    return { chase: nrr };
  }
};

const QualificationCalculatorScreen = ({ route, navigation }) => {
  const { colors, shadows, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, shadows, isDark), [colors, shadows, isDark]);

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

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', width: size, height: size }}>
      {/* Background ring */}
      <View style={{
        width: size, height: size, borderRadius: size / 2,
        borderWidth: 6, borderColor: 'rgba(255,255,255,0.06)',
        position: 'absolute'
      }} />
      {/* Progress ring via rotation trick */}
      <View style={{
        width: size - 4, height: size - 4, borderRadius: (size - 4) / 2,
        borderWidth: 6,
        borderColor: 'transparent',
        borderTopColor: colors.primary,
        transform: [{ rotate: `${(probability / 100) * 360}deg` }],
        position: 'absolute',
      }} />
      <Text style={{ color: colors.textPrimary, fontFamily: Typography.fontFamily.extraBold, fontSize: 22 }}>
        {probability}%
      </Text>
      <Text style={{ color: colors.textSecondary, fontFamily: Typography.fontFamily.medium, fontSize: 10, textAlign: 'center' }}>
        Chance
      </Text>
    </View>
  );
};

const StatusBadge = ({ statusCode, status }) => {
  const iconName = {
    Q: 'check-circle', CQ: 'info', TBD: 'help-circle', NRR: 'trending-up', E: 'x-circle'
  }[statusCode] || 'minus-circle';

  return (
    <View style={styles.statusBadge}>
      <Icon name={iconName} size={14} color={colors.primary} style={{ marginRight: 6 }} />
      <Text style={[styles.statusText, { color: colors.textPrimary }]}>{status}</Text>
    </View>
  );
};

const DropdownSelector = ({ label, placeholder, options, selectedValue, onSelect, visible, setVisible }) => {
  const selectedOption = options.find(opt => opt.value === selectedValue);

  return (
    <View style={{ marginHorizontal: Spacing.base, marginBottom: Spacing.md }}>
      <TouchableOpacity
        style={styles.dropdownBtn}
        activeOpacity={0.8}
        onPress={() => setVisible(!visible)}
      >
        <Text style={[styles.dropdownBtnText, !selectedOption && { color: colors.textTertiary }]}>
          {selectedOption ? selectedOption.label : placeholder}
        </Text>
        <Icon name={visible ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textSecondary} />
      </TouchableOpacity>

      {visible && (
        <View style={styles.dropdownList}>
          {options.map((opt, idx) => (
            <TouchableOpacity
              key={opt.value || idx}
              style={[
                styles.dropdownItem,
                selectedValue === opt.value && styles.dropdownItemActive,
                idx < options.length - 1 && { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.03)' }
              ]}
              onPress={() => {
                onSelect(opt.value);
                setVisible(false);
              }}
            >
              <Text style={[styles.dropdownItemText, selectedValue === opt.value && { color: colors.primary, fontFamily: Typography.fontFamily.bold }]}>
                {opt.label}
              </Text>
              {selectedValue === opt.value && (
                <Icon name="check" size={14} color={colors.primary} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};

const TeamCard = ({ pt, selected, onPress }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const team = pt.team || {};
  const logoUri = team.logo ? getImageUrl(team.logo) : null;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.96, duration: 80, useNativeDriver: true }),
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
        <View style={styles.teamLogoCircle}>
          {logoUri ? (
            <Text style={{ fontSize: 14 }}>🏏</Text>
          ) : (
            <Text style={{ color: selected ? colors.primary : colors.textSecondary, fontFamily: Typography.fontFamily.bold, fontSize: 10 }}>
              {(team.shortName || team.name || '?').substring(0, 3).toUpperCase()}
            </Text>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.teamCardName, selected && styles.teamCardNameSelected]} numberOfLines={1}>
            {team.name}
          </Text>
          <Text style={styles.teamCardMeta}>
            {pt.points || 0} pts  •  NRR {(pt.netRunRate || 0) >= 0 ? '+' : ''}{(pt.netRunRate || 0).toFixed(3)}
          </Text>
        </View>
        {selected && (
          <Icon name="check" size={14} color={colors.primary} style={{ marginLeft: 4 }} />
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

const ScenarioCard = ({ scenario, index, battingFirst }) => {
  const difficultyLabel = {
    3: 'Easy',
    2: 'Moderate',
    1: 'Hard'
  }[scenario.stars] || 'Normal';

  return (
    <GlassCard style={styles.scenarioCardWrap}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Text style={[styles.scenarioCardLabel, { color: colors.textPrimary }]}>{scenario.label}</Text>
        <View style={styles.difficultyBadge}>
          <Text style={styles.difficultyText}>{difficultyLabel.toUpperCase()}</Text>
        </View>
      </View>
      {battingFirst ? (
        <>
          <View style={styles.scenarioRow}>
            <MCIcon name="cricket" size={16} color={colors.textSecondary} />
            <Text style={styles.scenarioKey}>Your Score</Text>
            <Text style={styles.scenarioVal}>{scenario.yourScore}</Text>
          </View>
          <View style={styles.scenarioRow}>
            <MCIcon name="shield-check" size={16} color={colors.textSecondary} />
            <Text style={styles.scenarioKey}>Restrict To</Text>
            <Text style={styles.scenarioVal}>≤ {scenario.restrictOpponentTo}</Text>
          </View>
          <View style={styles.scenarioRow}>
            <MCIcon name="trending-up" size={16} color={colors.primary} />
            <Text style={styles.scenarioKey}>Win By</Text>
            <Text style={[styles.scenarioVal, { color: colors.primary }]}>{scenario.winMarginRuns} runs</Text>
          </View>
        </>
      ) : (
        <>
          <View style={styles.scenarioRow}>
            <MCIcon name="cricket" size={16} color={colors.textSecondary} />
            <Text style={styles.scenarioKey}>Opponent Score</Text>
            <Text style={styles.scenarioVal}>{scenario.opponentScore}</Text>
          </View>
          <View style={styles.scenarioRow}>
            <MCIcon name="target" size={16} color={colors.textSecondary} />
            <Text style={styles.scenarioKey}>Chase Target</Text>
            <Text style={styles.scenarioVal}>{scenario.chaseTarget}</Text>
          </View>
          <View style={styles.scenarioRow}>
            <MCIcon name="clock-fast" size={16} color={colors.primary} />
            <Text style={styles.scenarioKey}>Within Overs</Text>
            <Text style={[styles.scenarioVal, { color: colors.primary }]}>{scenario.mustChaseWithin}</Text>
          </View>
          <View style={styles.scenarioRow}>
            <MCIcon name="run-fast" size={16} color={colors.textSecondary} />
            <Text style={styles.scenarioKey}>Req. Rate</Text>
            <Text style={styles.scenarioVal}>{scenario.requiredRunRate}</Text>
          </View>
        </>
      )}
      <View style={styles.scenarioNRRRow}>
        <Text style={styles.scenarioNRRLabel}>Projected NRR</Text>
        <Text style={styles.scenarioNRRVal}>
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
      {highlight && <View style={styles.highlightBar} />}
      <Text style={[styles.projTableRank, highlight && { color: colors.primary, fontFamily: Typography.fontFamily.bold }]}>{index + 1}</Text>
      <Text style={[styles.projTableTeam, highlight && { color: colors.primary, fontFamily: Typography.fontFamily.bold }]} numberOfLines={1}>
        {row.shortName || row.teamName}
      </Text>
      <Text style={[styles.projTablePts, highlight && { color: colors.primary, fontFamily: Typography.fontFamily.bold }]}>{row.points}</Text>
      <Text style={[styles.projTableNRR, { color: colors.textPrimary }, highlight && { color: colors.primary, fontFamily: Typography.fontFamily.bold }]}>
        {row.nrr >= 0 ? '+' : ''}{row.nrr.toFixed(3)}
      </Text>
    </View>
  );
};

// ─── Main Screen ─────────────────────────────────────────────────────────────


  const { tournamentId, pointsTable: initialTable, tournamentOvers } = route.params || {};

  const [pointsTable, setPointsTable] = useState(initialTable || []);
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [selectedOpponentId, setSelectedOpponentId] = useState('');
  const [targetRank, setTargetRank] = useState(4);
  const [battingFirst, setBattingFirst] = useState(true);
  const [firstInningsScore, setFirstInningsScore] = useState('');
  const [oversInput, setOversInput] = useState(String(tournamentOvers || '20'));
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [liveNRR, setLiveNRR] = useState(null);
  const [showTeamDropdown, setShowTeamDropdown] = useState(false);
  const [showOpponentDropdown, setShowOpponentDropdown] = useState(false);

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

    const maxOvers = parseFloat(oversInput) || 20;
    const live = computeLiveNRR(teamPt, battingFirst, score, maxOvers);
    setLiveNRR(live);
  }, [firstInningsScore, selectedTeamId, battingFirst, pointsTable, oversInput]);

  const handleCalculate = useCallback(async () => {
    if (!selectedTeamId || !selectedOpponentId || !firstInningsScore || !oversInput) {
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
        overs: parseFloat(oversInput) || 20,
      });

      setResult(res.data.data || res.data);

      Animated.timing(resultsAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();

    } catch (e) {
      console.log('Calculation error', e);
      showCustomAlert('Calculation Failed', e.response?.data?.message || 'Could not compute scenario.');
    } finally {
      setLoading(false);
    }
  }, [selectedTeamId, selectedOpponentId, battingFirst, firstInningsScore, targetRank, oversInput, tournamentId]);

  const targetOptions = [
    { label: '1st', value: 1 },
    { label: '2nd', value: 2 },
    { label: '3rd', value: 3 },
    { label: '4th', value: 4 },
  ];

  const selectedTeamPt = pointsTable.find(pt => {
    const id = pt.team?._id || pt.team;
    return (id?._id || id)?.toString() === selectedTeamId;
  });

  const teamOptions = pointsTable.map(pt => {
    const id = pt.team?._id?.toString() || pt.team?.toString();
    return {
      label: `${pt.team?.name || 'Unknown'} (Pts: ${pt.points || 0} | NRR: ${(pt.netRunRate || 0).toFixed(3)})`,
      value: id,
    };
  });

  const opponentOptions = pointsTable
    .filter(pt => {
      const id = pt.team?._id?.toString() || pt.team?.toString();
      if (id === selectedTeamId) return false;
      if (selectedTeamPt && selectedTeamPt.groupName) {
        return pt.groupName === selectedTeamPt.groupName;
      }
      return true;
    })
    .map(pt => {
      const id = pt.team?._id?.toString() || pt.team?.toString();
      return {
        label: `${pt.team?.name || 'Unknown'} (Pts: ${pt.points || 0} | NRR: ${(pt.netRunRate || 0).toFixed(3)})`,
        value: id,
      };
    });

  const canCalculate = selectedTeamId && selectedOpponentId && firstInningsScore && parseInt(firstInningsScore) > 0 && oversInput && parseFloat(oversInput) > 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Icon name="arrow-left" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>NRR Calculator</Text>
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
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
            <MCIcon name="calculator-variant-outline" size={20} color={colors.primary} />
            <Text style={styles.heroTitle}>  Qualification Scenario</Text>
          </View>
          <Text style={styles.heroSubtitle}>
            Calculate every possible qualification path using official ICC NRR formulas.
          </Text>
          {selectedTeamPt && (
            <View style={styles.heroTeamRow}>
              <View style={styles.heroTeamBadge}>
                <Text style={styles.heroTeamName}>
                  {selectedTeamPt.team?.name || 'Selected Team'}
                </Text>
              </View>
              <View style={styles.heroStatRow}>
                <Text style={styles.heroStat}>
                  {selectedTeamPt.points || 0} pts  •  NRR {(selectedTeamPt.netRunRate || 0) >= 0 ? '+' : ''}{(selectedTeamPt.netRunRate || 0).toFixed(3)}
                </Text>
              </View>
            </View>
          )}
        </Animated.View>

        {/* Section 1: Select Team */}
        <Text style={styles.sectionTitle}>SELECT TEAM</Text>
        <DropdownSelector
          placeholder="Select Team"
          options={teamOptions}
          selectedValue={selectedTeamId}
          onSelect={(val) => {
            setSelectedTeamId(val);
            if (selectedOpponentId === val) setSelectedOpponentId('');
            setResult(null);
          }}
          visible={showTeamDropdown}
          setVisible={setShowTeamDropdown}
        />

        {/* Section 2: Select Opponent */}
        <Text style={styles.sectionTitle}>SELECT OPPONENT</Text>
        <DropdownSelector
          placeholder="Select Opponent"
          options={opponentOptions}
          selectedValue={selectedOpponentId}
          onSelect={(val) => {
            setSelectedOpponentId(val);
            setResult(null);
          }}
          visible={showOpponentDropdown}
          setVisible={setShowOpponentDropdown}
        />

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
            <MCIcon name="cricket" size={22} color={battingFirst ? colors.primary : colors.textSecondary} />
            <Text style={[styles.tossLabel, battingFirst && styles.tossLabelActive]}>Bat First</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tossCard, !battingFirst && styles.tossCardActive]}
            onPress={() => { setBattingFirst(false); setResult(null); setFirstInningsScore(''); setLiveNRR(null); }}
          >
            <MCIcon name="shield-outline" size={22} color={!battingFirst ? colors.primary : colors.textSecondary} />
            <Text style={[styles.tossLabel, !battingFirst && styles.tossLabelActive]}>Bowl First</Text>
          </TouchableOpacity>
        </View>

        {/* Score & Overs Form Row */}
        <View style={styles.formGridRow}>
          {/* Projected Score */}
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitleGrid}>
              {battingFirst ? 'PROJECTED SCORE' : 'OPPONENT SCORE'}
            </Text>
            <GlassCard style={styles.gridInputCard}>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.scoreInput}
                  placeholder={battingFirst ? 'e.g. 180' : 'e.g. 145'}
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="number-pad"
                  value={firstInningsScore}
                  onChangeText={v => { setFirstInningsScore(v); setResult(null); }}
                />
                <Text style={styles.inputUnit}>runs</Text>
              </View>
            </GlassCard>
          </View>

          {/* Match Overs */}
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitleGrid}>MATCH OVERS</Text>
            <GlassCard style={styles.gridInputCard}>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.scoreInput}
                  placeholder="e.g. 20"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="decimal-pad"
                  value={oversInput}
                  onChangeText={v => { setOversInput(v); setResult(null); }}
                />
                <Text style={styles.inputUnit}>overs</Text>
              </View>
            </GlassCard>
          </View>
        </View>

        {/* Live NRR Preview */}
        {liveNRR && (
          <GlassCard style={styles.liveNRRCard}>
            <Text style={styles.liveNRRTitle}>
              <MCIcon name="chart-line" size={14} color={colors.primary} /> LIVE NRR PREVIEW
            </Text>
            <View style={styles.liveNRRRow}>
              <View style={{ alignItems: 'center' }}>
                <Text style={styles.liveNRRLabel}>Current NRR</Text>
                <Text style={[styles.liveNRRValue, { color: colors.textSecondary }]}>
                  {(selectedTeamPt?.netRunRate || 0) >= 0 ? '+' : ''}{(selectedTeamPt?.netRunRate || 0).toFixed(3)}
                </Text>
              </View>
              <View style={{ alignItems: 'center' }}>
                <MCIcon name="arrow-right-bold" size={24} color={colors.primary} />
              </View>
              {battingFirst && liveNRR.best !== undefined ? (
                <View style={{ alignItems: 'center' }}>
                  <Text style={styles.liveNRRLabel}>Projected NRR</Text>
                  <Text style={[styles.liveNRRValue, { color: colors.primary }]}>
                    {liveNRR.best >= 0 ? '+' : ''}{liveNRR.best.toFixed(3)}
                  </Text>
                  <Text style={{ color: colors.textTertiary, fontSize: 10 }}>Best case</Text>
                </View>
              ) : liveNRR.chase !== undefined ? (
                <View style={{ alignItems: 'center' }}>
                  <Text style={styles.liveNRRLabel}>Projected NRR</Text>
                  <Text style={[styles.liveNRRValue, { color: colors.primary }]}>
                    {liveNRR.chase >= 0 ? '+' : ''}{liveNRR.chase.toFixed(3)}
                  </Text>
                  <Text style={{ color: colors.textTertiary, fontSize: 10 }}>If chased now</Text>
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
              <ActivityIndicator color={colors.background} />
            ) : (
              <>
                <MCIcon name="calculator-variant" size={18} color={colors.background} />
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
              <StatusBadge statusCode={result.statusCode} status={result.status} />
              <CircularProgress probability={result.probability || 0} size={90} />
            </View>

            {/* Message */}
            <GlassCard style={styles.messageCard}>
              <MCIcon name="information-outline" size={16} color={colors.primary} />
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
                        <View style={[styles.fixtureBadge, { backgroundColor: colors.primaryAlpha10 }]}>
                          <Text style={{ color: colors.primary, fontSize: 10, fontFamily: Typography.fontFamily.bold }}>
                            {fx.impact}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.fixturePreferRow}>
                        <MCIcon name="thumb-up-outline" size={14} color={colors.primary} />
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
                <View style={styles.cleanTableWrapper}>
                  <View style={styles.cleanTableHeader}>
                    <Text style={[styles.projTableHeaderText, { width: 30, textAlign: 'center' }]}>#</Text>
                    <Text style={[styles.projTableHeaderText, { flex: 2, textAlign: 'left', paddingLeft: 8 }]}>Team</Text>
                    <Text style={[styles.projTableHeaderText, { width: 40, textAlign: 'center' }]}>Pts</Text>
                    <Text style={[styles.projTableHeaderText, { width: 80, textAlign: 'center' }]}>NRR</Text>
                  </View>
                  {result.projectedTable.map((row, i) => (
                    <ProjectedTableRow
                      key={row.teamId || i}
                      row={row}
                      index={i}
                      isSelected={row.teamId === selectedTeamId}
                    />
                  ))}
                </View>
              </>
            )}

            {/* Bottom Actions */}
            <View style={styles.bottomActions}>
              <TouchableOpacity style={styles.bottomBtn} onPress={() => { setResult(null); }}>
                <Icon name="refresh-cw" size={14} color={colors.textSecondary} />
                <Text style={styles.bottomBtnText}>Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.bottomBtn, styles.bottomBtnPrimary]} onPress={handleCalculate}>
                <MCIcon name="calculator-variant" size={14} color={colors.background} />
                <Text style={[styles.bottomBtnText, { color: colors.background }]}>Recalculate</Text>
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

const createStyles = (colors, shadows, isDark) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.base, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  headerBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontFamily: Typography.fontFamily.bold, fontSize: 17, color: colors.textPrimary },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: { paddingTop: Spacing.base },

  // Hero Card
  heroCard: {
    marginHorizontal: Spacing.base, marginBottom: Spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1, borderColor: colors.border,
  },
  heroTitle: { fontFamily: Typography.fontFamily.bold, fontSize: 16, color: colors.textPrimary },
  heroSubtitle: { fontFamily: Typography.fontFamily.medium, fontSize: 12, color: colors.textSecondary, lineHeight: 18, marginTop: 4 },
  heroTeamRow: { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroTeamBadge: { backgroundColor: colors.primaryAlpha10, paddingHorizontal: 10, paddingVertical: 4, borderRadius: BorderRadius.sm, borderWidth: 1, borderColor: colors.primary },
  heroTeamName: { color: colors.primary, fontFamily: Typography.fontFamily.bold, fontSize: 12 },
  heroStatRow: { flexDirection: 'row', alignItems: 'center' },
  heroStat: { color: colors.textSecondary, fontFamily: Typography.fontFamily.medium, fontSize: 12 },

  // Glass card
  glassCard: {
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  glassCardGlow: { borderColor: colors.primary },

  // Section
  sectionTitle: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: 11,
    color: colors.textTertiary,
    letterSpacing: 1,
    marginHorizontal: Spacing.base,
    marginBottom: 8,
    marginTop: Spacing.md,
  },
  sectionTitleGrid: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: 11,
    color: colors.textTertiary,
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: Spacing.md,
  },

  // Team cards
  teamScroll: { marginBottom: 4 },
  teamCard: {
    width: 220,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  teamCardSelected: { borderColor: colors.primary, backgroundColor: colors.primaryAlpha10 },
  teamLogoCircle: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.surface,
    justifyContent: 'center', alignItems: 'center',
    marginRight: 10,
    borderWidth: 1, borderColor: colors.border,
  },
  teamCardName: { fontFamily: Typography.fontFamily.bold, fontSize: 13, color: colors.textPrimary },
  teamCardNameSelected: { color: colors.primary },
  teamCardMeta: { fontFamily: Typography.fontFamily.medium, fontSize: 11, color: colors.textSecondary, marginTop: 2 },

  // Segment Control
  segmentCard: { marginHorizontal: Spacing.base },
  segmentRow: { flexDirection: 'row', gap: 8 },
  segmentBtn: {
    flex: 1, paddingVertical: 10, borderRadius: BorderRadius.md,
    backgroundColor: colors.surface,
    alignItems: 'center', borderWidth: 1, borderColor: colors.border,
  },
  segmentBtnActive: { backgroundColor: colors.background, borderColor: colors.primary, borderWidth: 1.5 },
  segmentBtnText: { fontFamily: Typography.fontFamily.semiBold, fontSize: 12, color: colors.textSecondary },
  segmentBtnTextActive: { color: colors.primary, fontFamily: Typography.fontFamily.bold },

  // Toss cards
  tossRow: { flexDirection: 'row', gap: 12, marginHorizontal: Spacing.base },
  tossCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tossCardActive: { borderColor: colors.primary, backgroundColor: colors.primaryAlpha10 },
  tossLabel: { fontFamily: Typography.fontFamily.bold, fontSize: 14, color: colors.textSecondary },
  tossLabelActive: { color: colors.primary },

  // Form Grid
  formGridRow: { flexDirection: 'row', gap: 12, marginHorizontal: Spacing.base },
  gridInputCard: { padding: Spacing.sm },

  // Input
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  scoreInput: {
    flex: 1, fontFamily: Typography.fontFamily.bold, fontSize: 16,
    color: colors.textPrimary,
    paddingVertical: 4,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  inputUnit: { fontFamily: Typography.fontFamily.medium, fontSize: 12, color: colors.textTertiary },

  // Live NRR
  liveNRRCard: { marginHorizontal: Spacing.base, marginTop: Spacing.md },
  liveNRRTitle: { fontFamily: Typography.fontFamily.bold, fontSize: 11, color: colors.primary, letterSpacing: 1, marginBottom: 10 },
  liveNRRRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  liveNRRLabel: { fontFamily: Typography.fontFamily.medium, fontSize: 11, color: colors.textTertiary, marginBottom: 4 },
  liveNRRValue: { fontFamily: Typography.fontFamily.extraBold, fontSize: 20 },

  // Calculate Button
  calcBtn: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: BorderRadius.md,
    justifyContent: 'center', alignItems: 'center',
  },
  calcBtnDisabled: { backgroundColor: colors.surface, opacity: 0.5 },
  calcBtnText: { fontFamily: Typography.fontFamily.bold, fontSize: 15, color: colors.background },

  // Results
  resultHeaderRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginHorizontal: Spacing.base, marginTop: Spacing.xl, marginBottom: Spacing.md
  },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, paddingHorizontal: 16,
    borderRadius: BorderRadius.full, borderWidth: 1,
    backgroundColor: colors.primaryAlpha10, borderColor: colors.primary,
  },
  statusText: { fontFamily: Typography.fontFamily.bold, fontSize: 15 },

  messageCard: { marginHorizontal: Spacing.base, flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginBottom: Spacing.md },
  messageText: { flex: 1, fontFamily: Typography.fontFamily.medium, fontSize: 13, color: colors.textPrimary, lineHeight: 18 },

  statChip: {
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.md,
    paddingVertical: 12, paddingHorizontal: 16,
    borderWidth: 1, borderColor: colors.border,
    minWidth: 100, alignItems: 'center',
  },
  statChipAccent: { borderColor: colors.primary, backgroundColor: colors.primaryAlpha10 },
  statChipLabel: { fontFamily: Typography.fontFamily.medium, fontSize: 10, color: colors.textSecondary, marginBottom: 4 },
  statChipValue: { fontFamily: Typography.fontFamily.bold, fontSize: 14, color: colors.textPrimary },
  statChipValueAccent: { color: colors.primary },

  scenarioCardWrap: { width: 220, padding: Spacing.md },
  scenarioCardLabel: { fontFamily: Typography.fontFamily.bold, fontSize: 14 },
  scenarioRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 6 },
  scenarioKey: { flex: 1, fontFamily: Typography.fontFamily.medium, fontSize: 12, color: colors.textSecondary },
  scenarioVal: { fontFamily: Typography.fontFamily.bold, fontSize: 13, color: colors.textPrimary },
  scenarioNRRRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  scenarioNRRLabel: {
    color: colors.textSecondary,
    fontFamily: Typography.fontFamily.medium,
    fontSize: 12,
  },
  scenarioNRRVal: {
    color: colors.primary,
    fontFamily: Typography.fontFamily.bold,
    fontSize: 14,
  },
  difficultyBadge: {
    backgroundColor: colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  difficultyText: {
    fontSize: 9,
    fontFamily: Typography.fontFamily.bold,
    color: colors.textSecondary,
  },

  fixtureCard: { marginBottom: 8, padding: Spacing.md },
  fixtureMatchup: { fontFamily: Typography.fontFamily.bold, fontSize: 13, color: colors.textPrimary },
  fixtureBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: BorderRadius.sm },
  fixturePreferRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  fixturePrefer: { fontFamily: Typography.fontFamily.medium, fontSize: 12, color: colors.textSecondary },

  cleanTableWrapper: {
    marginHorizontal: Spacing.base,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: BorderRadius.md,
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
  cleanTableHeader: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  projTableHeaderText: { fontFamily: Typography.fontFamily.bold, fontSize: 11, color: colors.textSecondary },
  projTableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    backgroundColor: colors.background,
    position: 'relative',
  },
  projTableRowHighlight: {
    backgroundColor: colors.primaryAlpha10,
  },
  highlightBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: colors.primary,
  },
  projTableRank: {
    width: 30,
    textAlign: 'center',
    fontFamily: Typography.fontFamily.medium,
    fontSize: 12,
    color: colors.textSecondary,
  },
  projTableTeam: {
    flex: 2,
    paddingLeft: 8,
    fontFamily: Typography.fontFamily.medium,
    fontSize: 12,
    color: colors.textPrimary,
  },
  projTablePts: {
    width: 40,
    textAlign: 'center',
    fontFamily: Typography.fontFamily.medium,
    fontSize: 12,
    color: colors.textPrimary,
  },
  projTableNRR: {
    width: 80,
    textAlign: 'center',
    fontFamily: Typography.fontFamily.medium,
    fontSize: 12,
  },

  bottomActions: { flexDirection: 'row', gap: 12, marginHorizontal: Spacing.base, marginTop: Spacing.lg },
  bottomBtn: {
    flex: 1, flexDirection: 'row', gap: 6,
    backgroundColor: colors.surface,
    paddingVertical: 12, borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: colors.border,
    justifyContent: 'center', alignItems: 'center',
  },
  bottomBtnPrimary: { backgroundColor: colors.primary, borderColor: colors.primary },
  bottomBtnText: { fontFamily: Typography.fontFamily.bold, fontSize: 13, color: colors.textPrimary },

  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyText: { color: colors.textTertiary, fontFamily: Typography.fontFamily.regular, textAlign: 'center' },

  dropdownBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  dropdownBtnText: {
    fontSize: 14,
    fontFamily: Typography.fontFamily.medium,
    color: colors.textPrimary,
  },
  dropdownList: {
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: Spacing.xs,
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  dropdownItemActive: {
    backgroundColor: colors.primaryAlpha10,
  },
  dropdownItemText: {
    fontSize: 14,
    fontFamily: Typography.fontFamily.medium,
    color: colors.textSecondary,
  },
});

export default QualificationCalculatorScreen;
