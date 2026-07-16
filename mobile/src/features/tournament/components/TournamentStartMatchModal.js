import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, BorderRadius } from '../../../theme/theme';
import Icon from 'react-native-vector-icons/Feather';
import { useNavigation } from '@react-navigation/native';

const STAGE_OPTIONS = [
  'League Match',
  'Super Six',
  'Super Knockout',
  'Knockout',
  'Pre Quarter Final',
  'Quarter Final',
  'Semi Final',
  'Third Position',
  'Round of 16',
  'Final',
  'Qualifier 1',
  'Qualifier 2',
  'Eliminator',
  'Practice Match'
];

const TournamentStartMatchModal = ({ visible, onClose, tournament }) => {
  const navigation = useNavigation();

  const handleSelectStage = (stage) => {
    onClose();
    navigation.navigate('MatchSetup', {
      tournamentId: tournament._id,
      tournamentDetails: tournament,
      stage: stage
    });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.backBtn}>
            <Icon name="arrow-left" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Select Match Stage</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.subText}>
            Choose the stage for this match. You will be redirected to the full Match Setup screen to select teams and scoring details.
          </Text>

          <View style={styles.cardsContainer}>
            {STAGE_OPTIONS.map((stage) => (
              <TouchableOpacity
                key={stage}
                style={styles.card}
                onPress={() => handleSelectStage(stage)}
              >
                <Text style={styles.cardText}>{stage}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  backBtn: { padding: 4, marginRight: Spacing.sm },
  headerTitle: { fontSize: 18, fontFamily: Typography.fontFamily.semiBold, color: Colors.textPrimary },
  scrollContent: { padding: Spacing.lg },
  subText: { 
    color: Colors.textSecondary, 
    fontSize: 14, 
    fontFamily: Typography.fontFamily.regular, 
    marginBottom: Spacing.lg, 
    lineHeight: 20 
  },
  cardsContainer: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    justifyContent: 'space-between' 
  },
  card: {
    width: '48%',
    backgroundColor: Colors.surface,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center'
  },
  cardText: {
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.medium,
    fontSize: 15,
    textAlign: 'center'
  }
});

export default TournamentStartMatchModal;
