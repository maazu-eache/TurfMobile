import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Switch,
  Image,
  Dimensions,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { Colors, Typography, Spacing, Shadows, BorderRadius } from '../../../theme/theme';
import { showCustomAlert } from '../../../components/CustomAlert';
import LocationAutocomplete from '../../../components/LocationAutocomplete';
import api from '../../../api/axios';
import { clearLiveState } from '../matchSlice';

const IMG_TENNIS  = require('../../../../Tennis.jpeg');
const IMG_LEATHER = require('../../../../Leather.jpeg');
const IMG_OTHER   = require('../../../../Others.jpeg');

const MATCH_FORMATS = ['LIMITED OVERS', 'BOX CRICKET', 'PAIR CRICKET'];
const PITCH_TYPES = ['ROUGH', 'CEMENT', 'TURF', 'ASTROTURF', 'MATTING'];
const GROUND_TYPES = ['Open Ground', 'Indoor', 'Box Cricket', 'Other'];

const MatchEditScreen = ({ navigation, route }) => {
  const dispatch = useDispatch();
  const { matchData, matchId } = route.params || {};

  const [format, setFormat] = useState('LIMITED OVERS');
  const [overs, setOvers] = useState('5');
  const [wickets, setWickets] = useState('10');
  const [bowlerQuota, setBowlerQuota] = useState('1');
  const [city, setCity] = useState('');
  const [cityObj, setCityObj] = useState(null);
  const [ground, setGround] = useState('');
  const [ballType, setBallType] = useState('Tennis');
  const [pitchType, setPitchType] = useState('TURF');
  const [groundType, setGroundType] = useState('Open Ground');
  const [wagonWheel, setWagonWheel] = useState(true);

  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (matchData) {
      if (matchData.format) setFormat(matchData.format);
      if (matchData.overs !== undefined) setOvers(String(matchData.overs));
      if (matchData.wickets !== undefined) setWickets(String(matchData.wickets));
      if (matchData.bowlerQuota !== undefined) setBowlerQuota(String(matchData.bowlerQuota));
      if (matchData.city) setCity(matchData.city);
      if (matchData.ground) setGround(matchData.ground);
      if (matchData.ballType) setBallType(matchData.ballType);
      if (matchData.pitchType) setPitchType(matchData.pitchType);
      if (matchData.groundType) setGroundType(matchData.groundType);
      if (matchData.wagonWheelEnabled !== undefined) setWagonWheel(matchData.wagonWheelEnabled);
    }
  }, [matchData]);

  useEffect(() => {
    const o = parseInt(overs, 10);
    if (!isNaN(o) && o > 0) {
      setBowlerQuota(Math.ceil(o / 5).toString());
    }
  }, [overs]);

  const handleUpdate = async () => {
    if (!overs || parseInt(overs, 10) <= 0) return showCustomAlert('Error', 'Valid overs required');
    if (!wickets || parseInt(wickets, 10) <= 0) return showCustomAlert('Error', 'Valid wickets required');
    if (!city?.trim() || !ground?.trim() || !groundType?.trim() || !pitchType?.trim()) {
      return showCustomAlert('Error', 'City, Ground Name, Ground Type, and Pitch Type are required.');
    }

    try {
      setIsSaving(true);
      
      // Call the endpoint. The original logic used playing-xi to update details, but since we are not passing playingXIA/B,
      // it might wipe them out or we should pass the existing ones.
      // Wait, let's extract them from matchData to preserve them.
      
      const normalizeIdArr = (arr) => (arr || []).map((item) => (typeof item === 'object' && item !== null ? String(item._id) : String(item)));
      
      const playingXIA = matchData?.playingXI?.teamA ? normalizeIdArr(matchData.playingXI.teamA) : [];
      const playingXIB = matchData?.playingXI?.teamB ? normalizeIdArr(matchData.playingXI.teamB) : [];
      
      const captainA = matchData?.captain?.teamA ? (typeof matchData.captain.teamA === 'object' ? String(matchData.captain.teamA._id) : String(matchData.captain.teamA)) : null;
      const captainB = matchData?.captain?.teamB ? (typeof matchData.captain.teamB === 'object' ? String(matchData.captain.teamB._id) : String(matchData.captain.teamB)) : null;
      
      const wkA = matchData?.wicketKeeper?.teamA ? (typeof matchData.wicketKeeper.teamA === 'object' ? String(matchData.wicketKeeper.teamA._id) : String(matchData.wicketKeeper.teamA)) : null;
      const wkB = matchData?.wicketKeeper?.teamB ? (typeof matchData.wicketKeeper.teamB === 'object' ? String(matchData.wicketKeeper.teamB._id) : String(matchData.wicketKeeper.teamB)) : null;

      const payload = {
        teamA: playingXIA,
        teamB: playingXIB,
        captain: { teamA: captainA, teamB: captainB },
        wicketKeeper: { teamA: wkA, teamB: wkB },
        overs: parseInt(overs, 10),
        wickets: parseInt(wickets, 10),
        bowlerQuota: parseInt(bowlerQuota, 10) || Math.ceil(parseInt(overs, 10) / 5),
        format,
        ballType,
        pitchType,
        groundType,
        wagonWheelEnabled: wagonWheel,
        city,
        ground,
      };

      if (matchData?.scheduledAt) {
        payload.scheduledAt = matchData.scheduledAt;
      }

      await api.post(`/matches/${matchId}/playing-xi`, payload);
      dispatch(clearLiveState());
      navigation.goBack();
    } catch (err) {
      showCustomAlert('Error', err.response?.data?.message || 'Failed to update match details');
    } finally {
      setIsSaving(false);
    }
  };

  const renderChip = (label, isSelected, onPress) => (
    <TouchableOpacity
      key={label}
      style={[styles.chip, isSelected && styles.chipSelected]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const ballOptions = [
    { label: 'Tennis',  value: 'Tennis',  img: IMG_TENNIS  },
    { label: 'Leather', value: 'Leather', img: IMG_LEATHER },
    { label: 'Other',   value: 'Other',   img: IMG_OTHER   },
  ];

  const renderBallOption = ({ label, value, img }) => {
    const isSelected = ballType === value;
    return (
      <TouchableOpacity
        key={value}
        style={styles.ballOption}
        onPress={() => setBallType(value)}
        activeOpacity={0.8}
      >
        <View style={[styles.ballRing, isSelected && styles.ballRingSelected]}>
          <View style={styles.ballCircle}>
            <Image source={img} style={styles.ballImage} resizeMode="cover" />
          </View>
          {isSelected && (
            <View style={styles.ballCheckedBadge}>
              <Icon name="check-circle" size={18} color={Colors.primary} />
            </View>
          )}
        </View>
        <Text style={[styles.ballLabel, isSelected && styles.ballLabelSelected]}>{label}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="chevron-left" size={28} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Match Details</Text>
        <View style={{ width: 28 }} />
      </View>

      <KeyboardAwareScrollView
        enableOnAndroid={true}
        extraScrollHeight={20}
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.formContainer}>
          <View style={styles.inputGroup}>
            <Text style={styles.fieldLabel}>Match Type</Text>
            <View style={styles.chipsContainer}>
              {MATCH_FORMATS.map((f) => renderChip(f, format === f, () => setFormat(f)))}
            </View>
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.fieldLabel}>No. of Overs*</Text>
              <TextInput
                style={styles.underlineInput}
                keyboardType="numeric"
                value={overs}
                onChangeText={setOvers}
                maxLength={2}
                placeholder="5"
                placeholderTextColor={Colors.textTertiary}
              />
            </View>
            <View style={[styles.inputGroup, { flex: 1, marginHorizontal: 8 }]}>
              <Text style={styles.fieldLabel}>Wickets*</Text>
              <TextInput
                style={styles.underlineInput}
                keyboardType="numeric"
                value={wickets}
                onChangeText={setWickets}
                maxLength={2}
                placeholder="10"
                placeholderTextColor={Colors.textTertiary}
              />
            </View>
            <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.fieldLabel}>Overs/bowler</Text>
              <TextInput
                style={styles.underlineInput}
                keyboardType="numeric"
                value={bowlerQuota}
                onChangeText={setBowlerQuota}
                maxLength={2}
                placeholder="1"
                placeholderTextColor={Colors.textTertiary}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.fieldLabel}>City / Town*</Text>
            <LocationAutocomplete
              placeholder="Search city..."
              onSelect={(val, obj) => {
                setCity(val);
                setCityObj(obj);
              }}
              defaultValue={city}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.fieldLabel}>Ground*</Text>
            <TextInput
              style={styles.underlineInput}
              value={ground}
              onChangeText={setGround}
              placeholder="e.g. Shivaji Park Ground"
              placeholderTextColor={Colors.textTertiary}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.fieldLabel}>Ball Type</Text>
            <View style={styles.ballOptionsContainer}>
              {ballOptions.map(renderBallOption)}
            </View>
          </View>

          <View style={styles.toggleRow}>
            <View>
              <Text style={styles.toggleTitle}>Wagon Wheel</Text>
              <Text style={styles.toggleSubtitle}>Show Wagon Wheel for 1s, 2s and 3s</Text>
            </View>
            <Switch
              value={wagonWheel}
              onValueChange={setWagonWheel}
              trackColor={{ false: '#4A5568', true: Colors.primary }}
              thumbColor={wagonWheel ? '#FFF' : '#A0AAB5'}
            />
          </View>

          <View style={[styles.inputGroup, { marginTop: Spacing.md }]}>
            <Text style={styles.fieldLabel}>Ground Type</Text>
            <View style={styles.chipsContainer}>
              {GROUND_TYPES.map((g) => renderChip(g, groundType === g, () => setGroundType(g)))}
            </View>
          </View>

          <View style={[styles.inputGroup, { marginTop: Spacing.md }]}>
            <Text style={styles.fieldLabel}>Pitch Type</Text>
            <View style={styles.chipsContainer}>
              {PITCH_TYPES.map((p) => renderChip(p, pitchType === p, () => setPitchType(p)))}
            </View>
          </View>
        </View>
      </KeyboardAwareScrollView>

      <View style={styles.stickyBottomBar}>
        <TouchableOpacity style={styles.nextBtn} onPress={handleUpdate} disabled={isSaving}>
          {isSaving ? (
            <ActivityIndicator color={Colors.background} size="small" />
          ) : (
            <Text style={styles.nextBtnText}>Update Match Details</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { padding: 4 },
  headerTitle: { color: Colors.textPrimary, fontSize: 18, fontFamily: Typography.fontFamily.semiBold },
  content: { padding: Spacing.lg, paddingBottom: 100 },
  formContainer: { backgroundColor: Colors.surface, borderRadius: BorderRadius.md, padding: Spacing.lg, marginBottom: Spacing.lg },
  inputGroup: { marginBottom: Spacing.xl },
  fieldLabel: { color: Colors.textSecondary, fontSize: 13, fontFamily: Typography.fontFamily.semiBold, textTransform: 'uppercase', marginBottom: Spacing.sm },
  underlineInput: {
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    color: Colors.textPrimary, fontSize: 16, fontFamily: Typography.fontFamily.semiBold,
    paddingVertical: 8,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  chipsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: {
    paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20,
    backgroundColor: '#1E232B', borderWidth: 1, borderColor: Colors.border,
  },
  chipSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { color: Colors.textSecondary, fontSize: 13, fontFamily: Typography.fontFamily.semiBold },
  chipTextSelected: { color: Colors.background, fontFamily: Typography.fontFamily.bold },
  ballOptionsContainer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  ballOption: { alignItems: 'center', width: '30%' },
  ballRing: {
    width: 60, height: 60, borderRadius: 30,
    borderWidth: 2, borderColor: 'transparent',
    alignItems: 'center', justifyContent: 'center',
  },
  ballRingSelected: { borderColor: Colors.primary },
  ballCircle: {
    width: 50, height: 50, borderRadius: 25,
    overflow: 'hidden', backgroundColor: '#333',
  },
  ballImage: { width: '100%', height: '100%' },
  ballCheckedBadge: {
    position: 'absolute', top: -2, right: -4,
    backgroundColor: Colors.background, borderRadius: 10,
    width: 20, height: 20, alignItems: 'center', justifyContent: 'center',
  },
  ballLabel: { color: Colors.textSecondary, fontSize: 13, fontFamily: Typography.fontFamily.semiBold, marginTop: 6 },
  ballLabelSelected: { color: Colors.primary, fontFamily: Typography.fontFamily.bold },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xl, paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border },
  toggleTitle: { color: Colors.textPrimary, fontSize: 15, fontFamily: Typography.fontFamily.semiBold, marginBottom: 2 },
  toggleSubtitle: { color: Colors.textTertiary, fontSize: 12, fontFamily: Typography.fontFamily.regular },
  stickyBottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: Spacing.lg, backgroundColor: Colors.background,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  nextBtn: {
    backgroundColor: Colors.primary, borderRadius: BorderRadius.md,
    paddingVertical: 14, alignItems: 'center', flex: 1,
  },
  nextBtnText: { color: Colors.background, fontSize: 16, fontFamily: Typography.fontFamily.bold },
});

export default MatchEditScreen;
