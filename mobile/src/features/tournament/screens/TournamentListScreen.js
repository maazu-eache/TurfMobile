import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Image, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { useTheme, Typography, Spacing, BorderRadius } from '../../../theme/theme';
import api from '../../../api/axios';
import { useSelector } from 'react-redux';
import LocationAutocomplete from '../../../components/LocationAutocomplete';

const TABS = ['Upcoming', 'Ongoing', 'Completed', 'My Tournaments'];
const TOURNAMENT_FALLBACK = require('../../../assets/images/TournamentFallBack.png');

const TournamentListScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const safeTop = Math.max(insets?.top || 0, Platform.OS === 'ios' ? 44 : 0);
  const safeBottom = Math.max(insets?.bottom || 0, Platform.OS === 'ios' ? 24 : 0);
  const { colors, shadows, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, shadows, isDark), [colors, shadows, isDark]);
  const [activeTab, setActiveTab] = useState('Upcoming');
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const { user } = useSelector(state => state.auth);

  const fetchTournaments = async () => {
    setLoading(true);
    try {
      let statusFilter = '';
      if (activeTab === 'Upcoming') statusFilter = 'registration_open,registration_closed';
      if (activeTab === 'Ongoing') statusFilter = 'ongoing';
      if (activeTab === 'Completed') statusFilter = 'completed';

      let endpoint = `/tournaments?limit=50`;
      if (statusFilter && activeTab !== 'My Tournaments') endpoint += `&status=${statusFilter}`;
      if (search) endpoint += `&search=${search}`;

      const res = await api.get(endpoint);
      let data = res.data.data;

      if (activeTab === 'My Tournaments') {
        data = data.filter(t => 
          t.organizer?._id === user?._id || 
          t.coOrganizers?.some(o => (o._id || o) === user?._id) ||
          t.registeredTeams?.some(rt => rt.team?.captain === user?._id)
        );
      }
      setTournaments(data);
    } catch (e) {
      console.log('Fetch tournaments error', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTournaments();
  }, [activeTab, search]);

  const renderItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.card} 
      onPress={() => navigation.navigate('TournamentDetail', { tournamentId: item._id })}
    >
      <Image 
        source={item.banner ? { uri: item.banner.replace('localhost', '192.168.1.5') } : TOURNAMENT_FALLBACK} 
        style={styles.cardBanner} 
        blurRadius={item.banner ? 0 : 3}
      />
      <View style={styles.cardBody}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{item.name}</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{item.status.replace('_', ' ').toUpperCase()}</Text>
          </View>
        </View>
        <Text style={styles.cardSub}>Organized by {item.organizer?.name}</Text>
        
        <View style={styles.cardDetails}>
          <View style={styles.detailItem}>
            <Icon name="calendar" size={14} color={colors.textSecondary} />
            <Text style={styles.detailText}>{new Date(item.startDate).toLocaleDateString()}</Text>
          </View>
          <View style={styles.detailItem}>
            <Icon name="map-pin" size={14} color={colors.textSecondary} />
            <Text style={styles.detailText}>{item.turf?.name || item.city || 'TBD'}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: safeTop, paddingBottom: Math.max(safeBottom, 8) }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Tournaments</Text>
        <TouchableOpacity style={styles.filterBtn}>
          <Icon name="filter" size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Icon name="search" size={20} color={colors.textSecondary} />
        <LocationAutocomplete 
           variant="none"
           placeholder="Search tournaments..."
           value={search}
           onChangeText={setSearch}
           style={{ flex: 1, marginLeft: 10 }}
        />
      </View>

      {/* Tabs */}
      <View style={styles.tabsWrapper}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={TABS}
          keyExtractor={(item) => item}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={[styles.tabBtn, activeTab === item && styles.tabBtnActive]}
              onPress={() => setActiveTab(item)}
            >
              <Text style={[styles.tabText, activeTab === item && styles.tabTextActive]}>{item}</Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* List */}
      <FlatList
        data={tournaments}
        keyExtractor={item => item._id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchTournaments} />}
        ListEmptyComponent={<Text style={styles.emptyText}>No tournaments found.</Text>}
      />

      {/* FAB */}
      <TouchableOpacity 
        style={styles.fab}
        onPress={() => navigation.navigate('TournamentCreate')}
      >
        <Icon name="plus" size={24} color={colors.textOnPrimary} />
      </TouchableOpacity>
    </View>
  );
};

const createStyles = (colors, shadows, isDark) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.lg },
  headerTitle: { fontSize: 24, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary },
  filterBtn: { padding: Spacing.sm, backgroundColor: colors.surface, borderRadius: BorderRadius.md },
  searchContainer: { flexDirection: 'row', alignItems: 'center', marginHorizontal: Spacing.lg, paddingHorizontal: Spacing.md, height: 50, backgroundColor: colors.surface, borderRadius: BorderRadius.lg, marginBottom: Spacing.md },
  tabsWrapper: { marginBottom: Spacing.md, paddingLeft: Spacing.lg },
  tabBtn: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: 20, backgroundColor: colors.surface, marginRight: Spacing.sm },
  tabBtnActive: { backgroundColor: colors.primary },
  tabText: { color: colors.textSecondary, fontFamily: Typography.fontFamily.medium },
  tabTextActive: { color: colors.textOnPrimary, fontFamily: Typography.fontFamily.bold },
  listContent: { padding: Spacing.lg, paddingBottom: 100 },
  card: { backgroundColor: colors.surface, borderRadius: BorderRadius.lg, marginBottom: Spacing.lg, overflow: 'hidden', elevation: 2 },
  cardBanner: { width: '100%', height: 140, backgroundColor: '#e1e4e8' },
  cardBody: { padding: Spacing.md },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardTitle: { fontSize: 18, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary, flex: 1 },
  badge: { backgroundColor: colors.primaryAlpha10, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, marginLeft: 10 },
  badgeText: { color: isDark ? colors.primary : colors.primaryDark, fontSize: 10, fontFamily: Typography.fontFamily.bold },
  cardSub: { color: colors.textSecondary, fontSize: 13, marginTop: 4, marginBottom: 12 },
  cardDetails: { flexDirection: 'row', alignItems: 'center' },
  detailItem: { flexDirection: 'row', alignItems: 'center', marginRight: Spacing.lg },
  detailText: { color: colors.textSecondary, fontSize: 12, marginLeft: 6 },
  emptyText: { textAlign: 'center', color: colors.textSecondary, marginTop: Spacing.xl },
  fab: { position: 'absolute', bottom: 30, right: 30, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', elevation: 5 },
});

export default TournamentListScreen;
