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

const MatchTeamSelectionScreen = ({ navigation, route }) => {
  const dispatch = useDispatch();
  const { selectingFor, teamA, teamB, activeTab: initialActiveTab, onSelectTeam } = route.params;
  
  const { myTeams, opponentTeams, followingTeams, globalSearchTeams, isLoading: isTeamLoading, searchLoading } = useSelector((state) => state.team);

  const [activeTeamTab, setActiveTeamTab] = useState(initialActiveTab || 'My Teams');
  const [teamSearchQuery, setTeamSearchQuery] = useState('');

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
    if (activeTeamTab === 'My Teams') list = myTeams || [];
    else if (activeTeamTab === 'Opponents') list = opponentTeams || [];
    else if (activeTeamTab === 'Following') list = followingTeams || [];
    else if (activeTeamTab === 'Search') list = globalSearchTeams || [];
    
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
    return uniqueList;
  };



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

            <TouchableOpacity style={styles.addInlineBtn} onPress={() => navigation.navigate('TeamCreate')}>
              <Icon name="plus-circle" size={20} color={Colors.primary} />
              <Text style={styles.addInlineBtnText}>Create New Team</Text>
            </TouchableOpacity>
            {activeTeamTab === 'Search' && searchLoading ? (
              <ActivityIndicator color={Colors.primary} style={{ marginTop: 20 }} />
            ) : (
              <FlatList
                data={getFilteredTeams()}
              keyExtractor={(item) => item._id}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
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
                  <Icon name="chevron-right" size={20} color={Colors.textTertiary} />
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.emptyList}>
                  <Icon name="alert-circle-outline" size={40} color={Colors.textTertiary} />
                  <Text style={styles.emptyListText}>No teams found matching search.</Text>
                </View>
              }
            />
          )}
          </View>
      </View>
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
    backgroundColor: '#000A15',
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
    color: Colors.background || '#011528',
    fontFamily: Typography.fontFamily.bold,
  },
  searchBarWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#000A15',
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
    backgroundColor: '#000A15',
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
