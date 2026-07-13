import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors, Typography, Spacing, BorderRadius } from '../../../theme/theme';
import api from '../../../api/axios';
import { showCustomAlert } from '../../../components/CustomAlert';

const AddPlayerScreen = ({ route, navigation }) => {
  const { teamId, onPlayerAdded, roster = [], oppositionRoster = [], squad = [] } = route.params || {};

  const [mobile, setMobile] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  
  const [searchResult, setSearchResult] = useState(null);
  const [isSearching, setIsSearching] = useState(false);

  const nonSquadPlayers = roster.filter(p => !squad.some(s => s._id === p._id));

  const handleSearchPlayer = async (mobArg) => {
    const searchMob = typeof mobArg === 'string' && mobArg.length === 10 ? mobArg : mobile;
    if (!searchMob || searchMob.length < 10) {
      return showCustomAlert('Error', 'Please enter a valid 10-digit mobile number');
    }
    setIsSearching(true);
    setSearchResult(null);
    try {
      const res = await api.get(`/players/lookup/${searchMob}`);
      setSearchResult(res.data.data);
      if (res.data.data.exists) {
        setName(res.data.data.player.name || '');
      }
    } catch (e) {
      showCustomAlert('Error', 'Failed to search player');
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddPlayer = async () => {
    if (!mobile || mobile.length < 10) {
      showCustomAlert('Error', 'Please enter a valid 10-digit mobile number.');
      return;
    }

    if (!searchResult?.exists && !name.trim()) {
      showCustomAlert('Error', 'Please enter the player\'s name.');
      return;
    }

    if (searchResult?.exists && searchResult.player) {
      if (oppositionRoster.some(p => p._id === searchResult.player._id)) {
        showCustomAlert('Error', 'Player is already present in the opposition team.');
        return;
      }
      
      const existingPlayer = roster.find(p => p._id === searchResult.player._id);
      if (existingPlayer) {
        if (onPlayerAdded) onPlayerAdded(existingPlayer);
        navigation.goBack();
        return;
      }
    }

    setLoading(true);
    try {
      const payload = {
        mobile,
        role: 'player'
      };
      if (!searchResult?.exists) {
        payload.name = name.trim();
      }

      const res = await api.post(`/teams/${teamId}/players`, payload);
      const newPlayer = res.data.data.player;
      
      showCustomAlert('Success', 'Player added successfully', [
        { text: 'OK', onPress: () => {
          if (onPlayerAdded) {
            onPlayerAdded(newPlayer);
          }
          navigation.goBack();
        }}
      ]);
    } catch (e) {
      showCustomAlert('Error', e.response?.data?.message || 'Failed to add player');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="chevron-left" size={28} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Player</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Mobile Number</Text>
        <View style={styles.inputContainer}>
          <Icon name="phone-outline" size={20} color={Colors.textTertiary} style={{ marginRight: Spacing.sm }} />
          <TextInput
            style={styles.textInputStyle}
            placeholder="10-digit mobile number"
            placeholderTextColor={Colors.textTertiary}
            keyboardType="phone-pad"
            value={mobile}
            onChangeText={(val) => {
              if (val === mobile) return;
              setMobile(val);
              setSearchResult(null);
              if (val.length === 10) {
                handleSearchPlayer(val);
              }
            }}
            maxLength={10}
            editable={!searchResult?.exists}
          />
          {isSearching && (
            <View style={{ paddingHorizontal: Spacing.md }}>
              <ActivityIndicator color={Colors.primary} size="small" />
            </View>
          )}
        </View>

        {searchResult && searchResult.exists && (
          <View style={styles.foundPlayerCard}>
            <View style={styles.foundHeader}>
              <Icon name="check-decagram" size={16} color={Colors.accent} style={{ marginRight: 6 }} />
              <Text style={styles.foundText}>Player Found!</Text>
            </View>
            <View style={styles.profileRow}>
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>{searchResult.player.name.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.selectedPlayerName}>{searchResult.player.name}</Text>
                <Text style={styles.playerSubtext}>Registered User</Text>
              </View>
            </View>
          </View>
        )}

        {searchResult && !searchResult.exists && (
          <View style={{ marginTop: Spacing.lg }}>
            <Text style={styles.label}>Player Name</Text>
            <View style={styles.singleInputContainer}>
              <Icon name="account-outline" size={20} color={Colors.textTertiary} style={{ marginRight: Spacing.sm }} />
              <TextInput
                style={styles.textInputStyle}
                placeholder="Full Name"
                placeholderTextColor={Colors.textTertiary}
                value={name}
                onChangeText={setName}
                autoFocus
              />
            </View>
            <Text style={styles.helperText}>
              User not registered. Enter name to add as a temporary player.
            </Text>
          </View>
        )}

        {(!searchResult && !mobile) && (
          <View style={{ marginTop: Spacing.xl }}>
            <Text style={styles.label}>Players in Team (Not in Playing XI)</Text>
            {nonSquadPlayers.length > 0 ? (
              nonSquadPlayers.map((p, idx) => (
                <TouchableOpacity
                  key={p._id + '_' + idx}
                  style={styles.rosterPlayerCard}
                  onPress={() => {
                    if (onPlayerAdded) onPlayerAdded(p);
                    navigation.goBack();
                  }}
                >
                  <View style={styles.avatarPlaceholderSm}>
                    <Text style={styles.avatarTextSm}>{p.name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalListText}>{p.name}</Text>
                  </View>
                  <Icon name="plus-circle-outline" size={20} color={Colors.primary} />
                </TouchableOpacity>
              ))
            ) : (
              <Text style={styles.helperText}>No one in the team to select.</Text>
            )}
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity 
          style={[styles.addBtn, (!searchResult && !mobile) && { opacity: 0.5 }]} 
          onPress={handleAddPlayer} 
          disabled={loading || (!searchResult && !mobile)}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.addBtnText}>Add Player</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1, 
    borderBottomColor: Colors.borderLight 
  },
  backBtn: { padding: 4 },
  headerTitle: { fontFamily: Typography.fontFamily.semiBold, fontSize: 18, color: Colors.textPrimary },
  content: { padding: Spacing.base },
  label: { 
    fontFamily: Typography.fontFamily.bold, 
    fontSize: 12, 
    color: Colors.textSecondary, 
    marginBottom: Spacing.xs, 
    marginTop: Spacing.base,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceVariant,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingLeft: Spacing.sm,
    height: 52,
    overflow: 'hidden',
  },
  singleInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceVariant,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.sm,
    height: 52,
  },
  textInputStyle: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 15,
    fontFamily: Typography.fontFamily.regular,
    paddingVertical: 0,
  },
  fetchBtn: { 
    backgroundColor: Colors.accent, 
    flexDirection: 'row',
    height: '100%',
    paddingHorizontal: Spacing.lg, 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  fetchBtnText: { color: '#fff', fontFamily: Typography.fontFamily.bold, fontSize: 14 },
  helperText: { fontFamily: Typography.fontFamily.regular, fontSize: 12, color: Colors.textTertiary, marginTop: Spacing.sm, fontStyle: 'italic' },
  footer: {
    padding: Spacing.base,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    backgroundColor: Colors.surface,
  },
  addBtn: { backgroundColor: Colors.primary, padding: 16, borderRadius: BorderRadius.md, alignItems: 'center' },
  addBtnText: { fontFamily: Typography.fontFamily.bold, fontSize: 16, color: '#FFF' },
  foundPlayerCard: { 
    backgroundColor: Colors.primaryAlpha10, 
    padding: Spacing.base, 
    borderRadius: BorderRadius.md, 
    marginTop: Spacing.lg, 
    borderWidth: 1, 
    borderColor: Colors.primaryAlpha20 
  },
  foundHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  foundText: { color: Colors.primary, fontFamily: Typography.fontFamily.bold, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarPlaceholder: { 
    width: 44, 
    height: 44, 
    borderRadius: 22, 
    backgroundColor: Colors.primaryAlpha20, 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginRight: Spacing.base 
  },
  avatarText: {
    color: Colors.primary,
    fontFamily: Typography.fontFamily.bold,
    fontSize: 18,
  },
  selectedPlayerName: { fontFamily: Typography.fontFamily.semiBold, fontSize: 16, color: Colors.textPrimary },
  playerSubtext: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  rosterPlayerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  avatarPlaceholderSm: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  avatarTextSm: {
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.bold,
    fontSize: 14,
  },
  modalListText: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: 14,
    color: Colors.textPrimary,
  }
});

export default AddPlayerScreen;
