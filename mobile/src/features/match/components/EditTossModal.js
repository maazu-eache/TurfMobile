import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Image,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme, Typography, Spacing, BorderRadius } from '../../../theme/theme';
import { showCustomAlert } from '../../../components/CustomAlert';
import api, { getImageUrl } from '../../../api/axios';

const IMG_BAT = require('../../../../batting.jpeg');
const IMG_BOWL = require('../../../../bowling.jpeg');

const TeamCard = ({ team, isSelected, onSelect, colors, isDark }) => {
  const logoUrl = team?.logo ? getImageUrl(team.logo) : null;
  const initial = (team?.name || 'T').trim().charAt(0).toUpperCase();

  return (
    <TouchableOpacity
      style={[
        styles.teamCard,
        {
          backgroundColor: isSelected ? `${colors.primary}20` : colors.surfaceVariant,
          borderColor: isSelected ? colors.primary : colors.border,
        },
      ]}
      onPress={onSelect}
      activeOpacity={0.8}
    >
      <View style={styles.teamLogoWrapper}>
        {logoUrl ? (
          <Image source={{ uri: logoUrl }} style={styles.teamLogo} resizeMode="cover" />
        ) : (
          <View style={[styles.teamLogoPlaceholder, { backgroundColor: `${colors.primary}25` }]}>
            <Text style={[styles.teamLogoInitial, { color: colors.primary }]}>{initial}</Text>
          </View>
        )}
        {isSelected && (
          <View style={[styles.checkCircle, { backgroundColor: colors.primary }]}>
            <Icon name="check" size={12} color="#000" />
          </View>
        )}
      </View>
      <Text
        style={[
          styles.teamName,
          { color: isSelected ? colors.textPrimary : colors.textSecondary },
          isSelected && { fontFamily: Typography.fontFamily.bold },
        ]}
        numberOfLines={1}
      >
        {team?.name || 'Team'}
      </Text>
    </TouchableOpacity>
  );
};

const DecisionCard = ({ type, label, isSelected, onSelect, img, colors }) => {
  return (
    <TouchableOpacity
      style={[
        styles.decisionCard,
        {
          backgroundColor: isSelected ? `${colors.primary}20` : colors.surfaceVariant,
          borderColor: isSelected ? colors.primary : colors.border,
        },
      ]}
      onPress={onSelect}
      activeOpacity={0.8}
    >
      <View style={[styles.decisionImgWrapper, isSelected && { borderColor: colors.primary }]}>
        <Image source={img} style={styles.decisionImg} resizeMode="cover" />
        {isSelected && (
          <View style={[styles.checkCircleDecision, { backgroundColor: colors.primary }]}>
            <Icon name="check" size={13} color="#000" />
          </View>
        )}
      </View>
      <Text
        style={[
          styles.decisionLabel,
          { color: isSelected ? colors.primary : colors.textPrimary },
          isSelected && { fontFamily: Typography.fontFamily.bold },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
};

const EditTossModal = ({ visible, onClose, match, onTossChanged }) => {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const safeBottom = Math.max(insets?.bottom || 0, Platform.OS === 'ios' ? 24 : 16);

  const teamA = match?.teamA;
  const teamB = match?.teamB;

  const teamAId = String(teamA?._id || teamA?.id || teamA || '');
  const teamBId = String(teamB?._id || teamB?.id || teamB || '');

  const [selectedWinnerId, setSelectedWinnerId] = useState(teamAId);
  const [selectedChoice, setSelectedChoice] = useState('bat');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible && match) {
      const currentWinnerId = String(match.toss?.winner?._id || match.toss?.winner || teamAId);
      const currentChoice = match.toss?.choice || 'bat';
      setSelectedWinnerId(currentWinnerId);
      setSelectedChoice(currentChoice);
    }
  }, [visible, match, teamAId]);

  const winnerTeam = selectedWinnerId === teamAId ? teamA : teamB;
  const bowlingTeam = selectedChoice === 'bat'
    ? (selectedWinnerId === teamAId ? teamB : teamA)
    : (selectedWinnerId === teamAId ? teamA : teamB);
  const battingTeam = selectedChoice === 'bat'
    ? (selectedWinnerId === teamAId ? teamA : teamB)
    : (selectedWinnerId === teamAId ? teamB : teamA);

  const handleConfirmChange = () => {
    if (!selectedWinnerId || !selectedChoice) {
      showCustomAlert('Error', 'Please select both toss winner and their decision.');
      return;
    }

    showCustomAlert(
      'Change Toss?',
      `Changing the toss will set ${battingTeam?.name || 'Batting Team'} to bat first and reset the opening batters and bowler. Do you want to proceed?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm & Change',
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            try {
              const matchId = match?._id || match?.id;
              const res = await api.put(`/matches/${matchId}/toss`, {
                winner: selectedWinnerId,
                choice: selectedChoice,
              });

              showCustomAlert(
                'Toss Updated',
                `${winnerTeam?.name || 'Toss winner'} elected to ${selectedChoice} first. Opening batters and bowler have been reset.`
              );

              if (onTossChanged) {
                onTossChanged(res.data?.data);
              }
              onClose();
            } catch (err) {
              console.log('Error updating toss:', err);
              showCustomAlert('Error', err.response?.data?.message || 'Failed to update toss details');
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBg}>
        <View style={[styles.modalContainer, { paddingBottom: safeBottom + 16, backgroundColor: colors.background }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={[styles.iconCircle, { backgroundColor: `${colors.primary}20` }]}>
                <Icon name="hand-coin" size={20} color={colors.primary} />
              </View>
              <View>
                <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Edit Toss Details</Text>
                <Text style={[styles.headerSub, { color: colors.textSecondary }]}>Available before first ball is bowled</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: colors.surfaceVariant }]}>
              <Icon name="close" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            {/* 1. Who won the toss? */}
            <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Who won the toss?</Text>
              <View style={styles.teamRow}>
                <TeamCard
                  team={teamA}
                  isSelected={selectedWinnerId === teamAId}
                  onSelect={() => setSelectedWinnerId(teamAId)}
                  colors={colors}
                  isDark={isDark}
                />
                <View style={styles.vsBadge}>
                  <Text style={[styles.vsText, { color: colors.textTertiary }]}>VS</Text>
                </View>
                <TeamCard
                  team={teamB}
                  isSelected={selectedWinnerId === teamBId}
                  onSelect={() => setSelectedWinnerId(teamBId)}
                  colors={colors}
                  isDark={isDark}
                />
              </View>
            </View>

            {/* 2. Toss Decision */}
            <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Elected to?</Text>
              <View style={styles.decisionRow}>
                <DecisionCard
                  type="bat"
                  label="BAT FIRST"
                  isSelected={selectedChoice === 'bat'}
                  onSelect={() => setSelectedChoice('bat')}
                  img={IMG_BAT}
                  colors={colors}
                />
                <DecisionCard
                  type="bowl"
                  label="BOWL FIRST"
                  isSelected={selectedChoice === 'bowl'}
                  onSelect={() => setSelectedChoice('bowl')}
                  img={IMG_BOWL}
                  colors={colors}
                />
              </View>
            </View>

            {/* 3. Summary Callout */}
            <View style={[styles.summaryCallout, { backgroundColor: `${colors.primary}15`, borderColor: `${colors.primary}40` }]}>
              <Icon name="information-outline" size={20} color={colors.primary} style={{ marginTop: 1 }} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.summaryTitle, { color: colors.textPrimary }]}>
                  {winnerTeam?.name || 'Winner'} won the toss and elected to {selectedChoice === 'bat' ? 'Bat' : 'Bowl'} first.
                </Text>
                <Text style={[styles.summaryDesc, { color: colors.textSecondary }]}>
                  {battingTeam?.name || 'Batting Team'} will bat in the 1st innings. Selected batters & bowler will be reset.
                </Text>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.cancelBtn, { borderColor: colors.border, backgroundColor: colors.surfaceVariant }]}
                onPress={onClose}
                disabled={saving}
              >
                <Text style={[styles.cancelBtnText, { color: colors.textSecondary }]} numberOfLines={1}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: colors.primary }]}
                onPress={handleConfirmChange}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Icon name="check" size={18} color="#000" />
                    <Text style={styles.saveBtnText} numberOfLines={1} adjustsFontSizeToFit={true} minimumFontScale={0.85}>
                      Update Toss
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '88%',
    borderTopWidth: 1,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: Typography.fontFamily.bold,
  },
  headerSub: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.regular,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 16,
  },
  content: {
    padding: 18,
    gap: 14,
  },
  sectionCard: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  teamCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
  },
  teamLogoWrapper: {
    position: 'relative',
    marginBottom: 8,
  },
  teamLogo: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  teamLogoPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  teamLogoInitial: {
    fontSize: 22,
    fontFamily: Typography.fontFamily.bold,
  },
  checkCircle: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  teamName: {
    fontSize: 13,
    fontFamily: Typography.fontFamily.medium,
    textAlign: 'center',
  },
  vsBadge: {
    paddingHorizontal: 4,
  },
  vsText: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.bold,
  },
  decisionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  decisionCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
  },
  decisionImgWrapper: {
    width: 60,
    height: 60,
    borderRadius: 30,
    overflow: 'hidden',
    marginBottom: 8,
    position: 'relative',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  decisionImg: {
    width: '100%',
    height: '100%',
  },
  checkCircleDecision: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  decisionLabel: {
    fontSize: 13,
    fontFamily: Typography.fontFamily.semiBold,
  },
  summaryCallout: {
    flexDirection: 'row',
    gap: 10,
    padding: 12,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  summaryTitle: {
    fontSize: 13,
    fontFamily: Typography.fontFamily.bold,
    lineHeight: 18,
  },
  summaryDesc: {
    fontSize: 11,
    fontFamily: Typography.fontFamily.regular,
    marginTop: 2,
    lineHeight: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontFamily: Typography.fontFamily.semiBold,
  },
  saveBtn: {
    flex: 2,
    paddingVertical: 13,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    fontSize: 14,
    fontFamily: Typography.fontFamily.bold,
    color: '#000000',
  },
});

export default EditTossModal;
