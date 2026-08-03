import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useDispatch, useSelector } from 'react-redux';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { fetchMyTeams, fetchOpponentTeams, fetchFollowingTeams, searchGlobalTeams } from '../../team/teamSlice';
import { Colors, Typography, Spacing, BorderRadius } from '../../../theme/theme';
import { getImageUrl } from '../../../api/axios';
import AddTeamModal from '../../tournament/components/AddTeamModal';

const MatchTeamSelectionScreen = ({ navigation, route }) => {
  const dispatch = useDispatch();
  const { selectingFor, teamA, teamB, tournamentDetails, activeTab: initialActiveTab, onSelectTeam, matchStage } = route.params;
  
  const { myTeams, opponentTeams, followingTeams, globalSearchTeams, isLoading: isTeamLoading, searchLoading } = useSelector((state) => state.team);

  const [activeTeamTab, setActiveTeamTab] = useState(initialActiveTab || 'My Teams');
  const [teamSearchQuery, setTeamSearchQuery] = useState('');
  const [showAddTeamModal, setShowAddTeamModal] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      dispatch(fetchMyTeams());
      dispatch(fetchOpponentTeams());
      dispatch(fetchFollowingTeams());
    }, [dispatch])
  );

  React.useEffect(() => {
    if (activeTeamTab === 'Search' && teamSearchQuery.trim().length >= 2) {
      const delayDebounceFn = setTimeout(() => {
        dispatch(searchGlobalTeams(teamSearchQuery));
      }, 500);
      return () => clearTimeout(delayDebounceFn);
    }
  }, [teamSearchQuery, activeTeamTab, dispatch]);

  const getFilteredTeams = () => {
    let list = [];
    if (tournamentDetails) {
      const hasGroups = tournamentDetails.groups && tournamentDetails.groups.length > 0;
      const getGroupName = (teamId) => {
        if (!hasGroups) return 'Unassigned';
        for (const g of tournamentDetails.groups) {
          if (g.teams.some(t => t.toString() === teamId.toString())) return g.name;
        }
        return 'Unassigned';
      };

      list = (tournamentDetails.registeredTeams || []).map(rt => ({
        ...rt.team,
        tournamentGroupName: getGroupName(rt.team._id)
      }));

      // Only show grouped teams if groups exist
      if (hasGroups) {
        list = list.filter(team => team.tournamentGroupName !== 'Unassigned');
      }
    } else {
      if (activeTeamTab === 'My Teams') list = myTeams || [];
      else if (activeTeamTab === 'Opponents') list = opponentTeams || [];
      else if (activeTeamTab === 'Following') list = followingTeams || [];
      else if (activeTeamTab === 'Search') list = globalSearchTeams || [];
    }
    
    const uniqueMap = {};
    let uniqueList = [];
    list.forEach(t => {
      if (t && t._id && !uniqueMap[t._id]) {
        if (selectingFor === 'A' && teamB && t._id === teamB._id) return;
        if (selectingFor === 'B' && teamA && t._id === teamA._id) return;
        
        uniqueMap[t._id] = true;
        uniqueList.push(t);
      }
    });

    if (activeTeamTab !== 'Search' && teamSearchQuery.trim()) {
      uniqueList = uniqueList.filter(t => t?.name?.toLowerCase().includes(teamSearchQuery.toLowerCase()));
    }

    if (tournamentDetails) {
      const isKnockout = matchStage && !['League Match', 'Group Stage', 'Practice Match'].includes(matchStage);
      const isThirdPlaceMatch = matchStage && (matchStage.toLowerCase().includes('third') || matchStage.toLowerCase().includes('3rd') || matchStage.toLowerCase().includes('3rd position') || matchStage.toLowerCase().includes('third position'));

      if (isKnockout && !isThirdPlaceMatch) {
        // Find teams eliminated in previous knockouts
        const eliminationStages = ['Super Knockout', 'Knockout', 'Pre Quarter Final', 'Quarter Final', 'Semi Final', 'Round of 16', 'Eliminator', 'Qualifier 2'];
        const eliminatedIds = new Set();
        
        if (tournamentDetails.matches) {
          tournamentDetails.matches.forEach(m => {
            if (m.status === 'completed' && eliminationStages.includes(m.stage) && m.result?.winner) {
              const winnerId = m.result.winner._id ? m.result.winner._id.toString() : m.result.winner.toString();
              const teamAId = m.teamA?._id ? m.teamA._id.toString() : m.teamA?.toString();
              const teamBId = m.teamB?._id ? m.teamB._id.toString() : m.teamB?.toString();
              
              if (teamAId && teamAId !== winnerId) eliminatedIds.add(teamAId);
              if (teamBId && teamBId !== winnerId) eliminatedIds.add(teamBId);
            }
          });
        }
        
        // Filter out eliminated teams
        uniqueList = uniqueList.filter(t => !eliminatedIds.has(t._id.toString()));

        // Attach points table info
        uniqueList.forEach(t => {
          const ptEntry = tournamentDetails.pointsTable?.find(pt => pt.team?._id === t._id);
          t.points = ptEntry ? ptEntry.points : -1;
          t.netRunRate = ptEntry ? ptEntry.netRunRate : -999;
        });

        uniqueList.sort((a, b) => {
          // Sort by group name first
          const groupCompare = a.tournamentGroupName.localeCompare(b.tournamentGroupName);
          if (groupCompare !== 0) return groupCompare;
          // Within same group, sort by points descending
          if (b.points !== a.points) return b.points - a.points;
          // If points are equal, sort by NRR descending
          return b.netRunRate - a.netRunRate;
        });
      } else {
        uniqueList.sort((a, b) => a.tournamentGroupName.localeCompare(b.tournamentGroupName));
      }
    }

    return uniqueList;
  };

  const filteredTeams = getFilteredTeams();



  const handleSelectTeam = (team) => {
    if (onSelectTeam) onSelectTeam(team);
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {`Select Team ${selectingFor}`}
        </Text>
      </View>

      <View style={styles.container}>
        <View style={styles.teamListContainer}>
            {/* Tabs for My Teams, Opponents, Following */}
            {!tournamentDetails ? (
              <View style={styles.tabsRow}>
                {['My Teams', 'Opponents', 'Following', 'Search'].map(tab => (
                  <TouchableOpacity 
                    key={tab} 
                    style={[styles.tabBtn, activeTeamTab === tab && styles.tabBtnActive]}
                    onPress={() => setActiveTeamTab(tab)}
                  >
                    <Text style={[styles.tabBtnText, activeTeamTab === tab && styles.tabBtnTextActive]}>
                      {tab}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View style={[styles.tabsRow, { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm }]}>
                <Text style={{ color: Colors.primary, fontFamily: Typography.fontFamily.bold, fontSize: 16 }}>Tournament Teams</Text>
              </View>
            )}

            <View style={styles.searchBarWrapper}>
              <Icon name="magnify" size={20} color={Colors.textTertiary} style={styles.searchIcon} />
              <TextInput
                style={styles.searchBarInput}
                placeholder={activeTeamTab === 'Search' ? "Search by name, city, captain mobile..." : "Search teams..."}
                placeholderTextColor={Colors.textTertiary}
                value={teamSearchQuery}
                onChangeText={setTeamSearchQuery}
              />
            </View>

            {!tournamentDetails ? (
              <TouchableOpacity style={styles.addInlineBtn} onPress={() => navigation.navigate('TeamCreate')}>
                <Icon name="plus-circle" size={20} color={Colors.primary} />
                <Text style={styles.addInlineBtnText}>Create New Team</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.addInlineBtn} onPress={() => setShowAddTeamModal(true)}>
                <Icon name="plus-circle" size={20} color={Colors.primary} />
                <Text style={styles.addInlineBtnText}>Add Team to Tournament</Text>
              </TouchableOpacity>
            )}
            {activeTeamTab === 'Search' && searchLoading ? (
              <ActivityIndicator color={Colors.primary} style={{ marginTop: 20 }} />
            ) : (
              <FlatList
                data={filteredTeams}
              keyExtractor={(item) => item._id}
              showsVerticalScrollIndicator={false}
              renderItem={({ item, index }) => {
                const isFirstInGroup = tournamentDetails && (index === 0 || filteredTeams[index - 1].tournamentGroupName !== item.tournamentGroupName);
                return (
                  <View>
                    {isFirstInGroup && (
                      <View style={{ backgroundColor: Colors.surface, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, marginTop: index === 0 ? 0 : Spacing.md }}>
                        <Text style={{ color: Colors.textSecondary, fontFamily: Typography.fontFamily.bold, fontSize: 13 }}>{item.tournamentGroupName}</Text>
                      </View>
                    )}
                    <TouchableOpacity style={styles.teamItemRow} onPress={() => handleSelectTeam(item)}>
                      <View style={styles.teamAvatar}>
                        {item.logo ? (
                          <Image source={{ uri: getImageUrl(item.logo) }} style={styles.teamAvatarImg} />
                        ) : (
                          <Text style={styles.teamAvatarInitial}>
                            {item.name ? item.name.substring(0, 1).toUpperCase() : 'T'}
                          </Text>
                        )}
                      </View>
                      <View style={styles.teamItemInfo}>
                        <Text style={styles.teamItemName}>{item.name}</Text>
                        {item.city && <Text style={styles.teamItemCity}>{item.city}</Text>}
                      </View>
                      {item.points !== undefined && (
                        <View style={styles.pointsBadge}>
                          <Text style={styles.pointsText}>{item.points} PTS</Text>
                          <Text style={styles.nrrText}>NRR: {item.netRunRate ? item.netRunRate.toFixed(2) : '0.00'}</Text>
                        </View>
                      )}
                      <Icon name="chevron-right" size={20} color={Colors.textTertiary} />
                    </TouchableOpacity>
                  </View>
                );
              }}
              ListEmptyComponent={
                <View style={styles.emptyList}>
                  <Icon name="alert-circle-outline" size={40} color={Colors.textTertiary} />
                  <Text style={styles.emptyListText}>No teams found.</Text>
                </View>
              }
            />
          )}
          </View>
      </View>
      
      {showAddTeamModal && tournamentDetails && (
        <AddTeamModal
          visible={showAddTeamModal}
          onClose={() => setShowAddTeamModal(false)}
          tournamentId={tournamentDetails._id}
          registeredTeams={tournamentDetails.registeredTeams}
          onRefresh={() => {
            setShowAddTeamModal(false);
          }}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.textPrimary,
  },
  container: {
    flex: 1,
    padding: Spacing.base,
  },
  teamListContainer: {
    flex: 1,
  },
  tabsRow: {
    flexDirection: 'row',
    marginBottom: Spacing.md,
    backgroundColor: '#000000',
    borderRadius: BorderRadius.md,
    padding: 4,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: BorderRadius.sm,
  },
  tabBtnActive: {
    backgroundColor: Colors.primary,
  },
  tabBtnText: {
    fontSize: 13,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.textSecondary,
  },
  tabBtnTextActive: {
    color: Colors.background || '#000000',
    fontFamily: Typography.fontFamily.bold,
  },
  searchBarWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#000000',
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.base,
    height: 48,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchIcon: {
    marginRight: Spacing.sm,
  },
  searchBarInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 14,
    fontFamily: Typography.fontFamily.regular,
  },
  addInlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
    backgroundColor: 'rgba(46, 213, 115, 0.05)',
  },
  addInlineBtnText: {
    color: Colors.primary,
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: 14,
    marginLeft: 8,
  },
  teamItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  teamAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  teamAvatarImg: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  teamAvatarInitial: {
    color: Colors.primary,
    fontSize: 20,
    fontFamily: Typography.fontFamily.bold,
  },
  teamItemInfo: {
    flex: 1,
  },
  teamItemName: {
    fontSize: 16,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.textPrimary,
  },
  teamItemCity: {
    fontSize: 13,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  emptyList: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyListText: {
    color: Colors.textTertiary,
    fontFamily: Typography.fontFamily.medium,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },

});

export default MatchTeamSelectionScreen;
