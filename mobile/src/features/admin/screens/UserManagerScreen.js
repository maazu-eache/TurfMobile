import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, TextInput
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import api from '../../../api/axios';
import { Colors, Typography, Spacing, BorderRadius } from '../../../theme/theme';
import { showCustomAlert } from '../../../components/CustomAlert';

const roleColor = (role) => {
  switch (role) {
    case 'admin':    return '#FF4757';
    case 'owner':    return '#5B8DEF';
    case 'player':   return Colors.primary;
    default:         return Colors.textTertiary;
  }
};

const UserManagerScreen = ({ navigation }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await api.get('/admin/users?limit=200');
      setUsers(res.data?.data?.items || res.data?.data || []);
    } catch (err) {
      showCustomAlert('Error', err.response?.data?.message || 'Failed to fetch users');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleToggleActive = (user) => {
    const isSuspended = user.isDeleted || user.isSuspended || user.isDeactivated;
    const action = isSuspended ? 'Reactivate' : 'Suspend';
    const endpoint = isSuspended
      ? `/admin/users/${user._id}/reactivate`
      : `/admin/users/${user._id}/suspend`;

    showCustomAlert(
      `${action} Account`,
      `Are you sure you want to ${action.toLowerCase()} the account of "${user.name || user.email}"?\n\nThe user's data and match history will remain intact.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: action,
          style: isSuspended ? 'default' : 'destructive',
          onPress: async () => {
            setActionLoadingId(user._id);
            try {
              await api.put(endpoint);
              showCustomAlert('Done', `User "${user.name}" has been ${action.toLowerCase()}d.`);
              fetchData();
            } catch (err) {
              showCustomAlert('Error', err.response?.data?.message || `Failed to ${action.toLowerCase()} user`);
            } finally {
              setActionLoadingId(null);
            }
          }
        }
      ]
    );
  };

  const filtered = users.filter(u => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      (u.name  && u.name.toLowerCase().includes(q)) ||
      (u.email && u.email.toLowerCase().includes(q)) ||
      (u.mobile && u.mobile.toLowerCase().includes(q))
    );
  });

  const renderUserCard = ({ item }) => {
    const isSuspended = item.isDeleted || item.isSuspended || item.isDeactivated;
    const joined = item.createdAt
      ? new Date(item.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
      : 'N/A';
    const isLoading = actionLoadingId === item._id;

    return (
      <View style={[styles.card, isSuspended && styles.cardSuspended]}>
        {/* Avatar + info */}
        <View style={styles.cardLeft}>
          <View style={[styles.avatar, { backgroundColor: roleColor(item.role) + '20' }]}>
            <Text style={[styles.avatarText, { color: roleColor(item.role) }]}>
              {(item.name || item.email || '?').charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.nameRow}>
              <Text style={[styles.userName, isSuspended && styles.userNameSuspended]} numberOfLines={1}>
                {item.name || 'Unknown User'}
              </Text>
              <View style={[styles.rolePill, { backgroundColor: roleColor(item.role) + '18', borderColor: roleColor(item.role) + '40' }]}>
                <Text style={[styles.roleText, { color: roleColor(item.role) }]}>
                  {(item.role || 'user').toUpperCase()}
                </Text>
              </View>
            </View>
            <Text style={styles.userEmail} numberOfLines={1}>{item.email || item.mobile || '—'}</Text>
            <View style={styles.metaRow}>
              <Icon name="calendar-outline" size={10} color={Colors.textTertiary} />
              <Text style={styles.metaText}>Joined {joined}</Text>
              {isSuspended && (
                <>
                  <View style={styles.metaDot} />
                  <Icon name="account-off-outline" size={10} color={Colors.error} />
                  <Text style={[styles.metaText, { color: Colors.error }]}>Suspended</Text>
                </>
              )}
            </View>
          </View>
        </View>

        {/* Action */}
        <TouchableOpacity
          style={[styles.actionBtn, isSuspended ? styles.actionBtnActivate : styles.actionBtnSuspend]}
          onPress={() => handleToggleActive(item)}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={isSuspended ? Colors.success : Colors.error} />
          ) : (
            <Icon
              name={isSuspended ? 'account-check-outline' : 'account-off-outline'}
              size={18}
              color={isSuspended ? Colors.success : Colors.error}
            />
          )}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Icon name="arrow-left" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>User Management</Text>
            <Text style={styles.headerSubtitle}>View and manage platform accounts</Text>
          </View>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{users.length}</Text>
          </View>
        </View>

        {/* Search */}
        <View style={styles.searchBox}>
          <Icon name="magnify" size={18} color={Colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, email or mobile..."
            placeholderTextColor={Colors.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Icon name="close-circle" size={16} color={Colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>

        {/* List */}
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={item => item._id}
            renderItem={renderUserCard}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.primary} />}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Icon name="account-search-outline" size={52} color={Colors.textTertiary} />
                <Text style={styles.emptyTitle}>No Users Found</Text>
                <Text style={styles.emptySubtitle}>
                  {searchQuery ? `No results for "${searchQuery}"` : 'No users have registered yet.'}
                </Text>
              </View>
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.backgroundElevated },
  container: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    backgroundColor: Colors.backgroundElevated,
    borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 12,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontFamily: Typography.fontFamily.extraBold, color: Colors.textPrimary },
  headerSubtitle: { fontSize: 11, fontFamily: Typography.fontFamily.medium, color: Colors.textSecondary, marginTop: 1 },
  countBadge: {
    backgroundColor: Colors.primaryAlpha20,
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: Colors.primaryAlpha30,
  },
  countBadgeText: { fontSize: 13, fontFamily: Typography.fontFamily.extraBold, color: Colors.primary },

  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing.lg, marginVertical: Spacing.md,
    paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border,
  },
  searchInput: { flex: 1, fontSize: 13, color: Colors.textPrimary, fontFamily: Typography.fontFamily.medium, padding: 0 },

  listContent: { paddingHorizontal: Spacing.lg, paddingBottom: 60 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg, padding: Spacing.md,
    marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border,
  },
  cardSuspended: {
    borderColor: 'rgba(244,67,54,0.2)',
    backgroundColor: 'rgba(244,67,54,0.03)',
  },
  cardLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },

  avatar: {
    width: 42, height: 42, borderRadius: 13,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 17, fontFamily: Typography.fontFamily.extraBold },

  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  userName: { fontSize: 14, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary, flexShrink: 1 },
  userNameSuspended: { color: Colors.textTertiary, textDecorationLine: 'line-through' },
  rolePill: {
    paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 6, borderWidth: 1,
  },
  roleText: { fontSize: 8, fontFamily: Typography.fontFamily.bold, letterSpacing: 0.5 },

  userEmail: { fontSize: 11, color: Colors.textSecondary, fontFamily: Typography.fontFamily.regular },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  metaDot: { width: 2, height: 2, borderRadius: 1, backgroundColor: Colors.textTertiary },
  metaText: { fontSize: 10, fontFamily: Typography.fontFamily.medium, color: Colors.textTertiary },

  actionBtn: {
    width: 38, height: 38, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },
  actionBtnSuspend: { backgroundColor: 'rgba(244,67,54,0.1)' },
  actionBtnActivate: { backgroundColor: 'rgba(46,213,115,0.1)' },

  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 10 },
  emptyTitle: { fontSize: 17, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary },
  emptySubtitle: { fontSize: 12, fontFamily: Typography.fontFamily.medium, color: Colors.textSecondary, textAlign: 'center' },
});

export default UserManagerScreen;
