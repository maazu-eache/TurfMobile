import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, TextInput, Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import api from '../../../api/axios';
import { Colors, Typography, Spacing, BorderRadius } from '../../../theme/theme';
import { useTheme } from '../../../theme/ThemeContext';
import { showCustomAlert } from '../../../components/CustomAlert';

const roleColor = (role, colors, isDark) => {
  switch (role) {
    case 'admin':    return '#FF4757';
    case 'owner':    return '#5B8DEF';
    case 'player':   return isDark ? '#FFD400' : colors.primaryDark;
    default:         return colors.textTertiary;
  }
};

const UserManagerScreen = ({ navigation }) => {
  const { colors, isDark, shadows } = useTheme();
  const styles = React.useMemo(() => createStyles(colors, isDark, shadows), [colors, isDark, shadows]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState(null);

  // Role Change Modal state
  const [roleModalUser, setRoleModalUser] = useState(null);
  const [selectedRole, setSelectedRole] = useState('player');
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);

  const openRoleChangeModal = (user) => {
    if (user?.role === 'admin') {
      showCustomAlert('Admin Account', 'Administrator accounts cannot have their role changed.');
      return;
    }
    setRoleModalUser(user);
    setSelectedRole(user?.role === 'owner' ? 'owner' : 'player');
  };

  const handleUpdateRole = async () => {
    if (!roleModalUser || !selectedRole) return;
    if (selectedRole === roleModalUser.role) {
      setRoleModalUser(null);
      return;
    }
    setIsUpdatingRole(true);
    try {
      await api.put(`/admin/users/${roleModalUser._id}/role`, { role: selectedRole });
      showCustomAlert(
        'Role Updated',
        `Role for "${roleModalUser.name || roleModalUser.email}" updated to ${selectedRole.toUpperCase()}.\n\nThe user's active session has been logged out.`
      );
      setRoleModalUser(null);
      fetchData();
    } catch (err) {
      showCustomAlert('Error', err.response?.data?.message || 'Failed to update user role');
    } finally {
      setIsUpdatingRole(false);
    }
  };

  const handleSoftDeleteUser = async (userId, userName) => {
    try {
      await api.delete(`/admin/users/${userId}`);
      showCustomAlert('Soft Deleted', `User "${userName || 'User'}" has been soft-deleted and anonymized.`);
      fetchData();
    } catch (err) {
      showCustomAlert('Error', err.response?.data?.message || 'Failed to soft delete user');
    }
  };

  const handleHardDeleteUser = async (userId, userName) => {
    try {
      await api.delete(`/admin/users/${userId}/hard-delete`);
      showCustomAlert('Permanently Deleted', `User "${userName || 'User'}" and all associated data have been completely removed from the database.`);
      fetchData();
    } catch (err) {
      showCustomAlert('Error', err.response?.data?.message || 'Failed to hard delete user');
    }
  };

  const promptDeleteUser = (user) => {
    if (user?.role === 'admin') {
      showCustomAlert('Admin Account', 'Administrator accounts cannot be deleted.');
      return;
    }

    showCustomAlert(
      'Delete User Account',
      `Choose deletion type for "${user.name || user.email}":\n\n• Soft Delete: Deactivates account, anonymizes name to "Deleted User", and preserves match history.\n\n• Hard Delete: PERMANENTLY purges the user and all associated records completely from MongoDB.`,
      [
        {
          text: 'Soft Delete (Anonymize)',
          style: 'default',
          onPress: () => handleSoftDeleteUser(user._id, user.name)
        },
        {
          text: '🔥 Hard Delete (Remove from DB)',
          style: 'destructive',
          onPress: () => {
            showCustomAlert(
              '⚠️ CONFIRM HARD DELETE',
              `Are you 100% sure you want to PERMANENTLY REMOVE "${user.name || user.email}" from the database?\n\nThis CANNOT be undone. Zero data will remain.`,
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'PERMANENTLY DELETE FROM DB',
                  style: 'destructive',
                  onPress: () => handleHardDeleteUser(user._id, user.name)
                }
              ]
            );
          }
        },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

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

        {/* Actions */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <TouchableOpacity
            style={styles.roleActionBtn}
            onPress={() => openRoleChangeModal(item)}
            activeOpacity={0.7}
          >
            <Icon name="account-convert-outline" size={16} color="#BA68C8" />
          </TouchableOpacity>

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

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: 'rgba(255,71,87,0.1)' }]}
            onPress={() => promptDeleteUser(item)}
            activeOpacity={0.7}
          >
            <Icon name="trash-can-outline" size={18} color={Colors.error} />
          </TouchableOpacity>
        </View>
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

      {/* ── ROLE CHANGE MODAL ── */}
      <Modal visible={!!roleModalUser} transparent animationType="fade" onRequestClose={() => !isUpdatingRole && setRoleModalUser(null)}>
        <View style={styles.roleModalOverlay}>
          <View style={styles.roleModalCard}>
            <View style={styles.roleModalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.roleModalTitle}>Change User Role</Text>
                <Text style={styles.roleModalSubtitle} numberOfLines={1}>
                  {roleModalUser?.name || 'User'} ({roleModalUser?.email || roleModalUser?.mobile || ''})
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setRoleModalUser(null)}
                disabled={isUpdatingRole}
                style={styles.roleModalCloseBtn}
              >
                <Icon name="close" size={20} color={Colors.textTertiary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.roleModalLabel}>Select New Role:</Text>

            <View style={styles.roleOptionList}>
              {[
                { id: 'player', title: 'Player', desc: 'Can join matches, tournaments, auctions and book turfs', icon: 'cricket', color: '#BA68C8' },
                { id: 'owner', title: 'Turf Owner', desc: 'Can register and manage turfs, slots, and bookings', icon: 'briefcase', color: Colors.primary },
              ].map((r) => {
                const isSelected = selectedRole === r.id;
                return (
                  <TouchableOpacity
                    key={r.id}
                    style={[styles.roleOptionCard, isSelected && { borderColor: r.color, backgroundColor: r.color + '15' }]}
                    onPress={() => setSelectedRole(r.id)}
                    activeOpacity={0.8}
                    disabled={isUpdatingRole}
                  >
                    <View style={[styles.roleOptionIconWrap, { backgroundColor: r.color + '25' }]}>
                      <Icon name={r.icon} size={20} color={r.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.roleOptionTitle, isSelected && { color: r.color }]}>{r.title}</Text>
                      <Text style={styles.roleOptionDesc}>{r.desc}</Text>
                    </View>
                    <Icon
                      name={isSelected ? 'radiobox-marked' : 'radiobox-blank'}
                      size={20}
                      color={isSelected ? r.color : Colors.textTertiary}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.roleModalNotice}>
              <Icon name="information-outline" size={15} color="#FF9800" style={{ marginTop: 1 }} />
              <Text style={styles.roleModalNoticeText}>
                Changing the role will automatically invalidate the user's active session, force them to log out, and prompt them to log in again with updated access.
              </Text>
            </View>

            <View style={styles.roleModalActions}>
              <TouchableOpacity
                style={styles.roleModalCancelBtn}
                onPress={() => setRoleModalUser(null)}
                disabled={isUpdatingRole}
              >
                <Text style={styles.roleModalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.roleModalSaveBtn}
                onPress={handleUpdateRole}
                disabled={isUpdatingRole}
              >
                {isUpdatingRole ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <Text style={styles.roleModalSaveText}>Apply & Logout User</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const createStyles = (colors, isDark, shadows) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.border, gap: 12,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontFamily: Typography.fontFamily.extraBold, color: colors.textPrimary },
  headerSubtitle: { fontSize: 11, fontFamily: Typography.fontFamily.medium, color: colors.textSecondary },

  searchBarContainer: {
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.surfaceVariant, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  searchInput: { flex: 1, fontSize: 13, color: colors.textPrimary, fontFamily: Typography.fontFamily.medium, padding: 0 },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: colors.textSecondary, textAlign: 'center', marginTop: Spacing.xl, fontFamily: Typography.fontFamily.medium },
  list: { padding: Spacing.md, paddingBottom: 60 },

  userCard: {
    backgroundColor: colors.surface, borderRadius: BorderRadius.lg,
    borderWidth: 1, borderColor: colors.border, marginBottom: Spacing.sm,
    padding: Spacing.md, gap: 10,
  },
  userHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  userMainInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  avatar: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#FFF', fontSize: 16, fontFamily: Typography.fontFamily.extraBold },
  userName: { fontSize: 14, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary },
  userEmail: { fontSize: 11, color: colors.textSecondary, fontFamily: Typography.fontFamily.regular, marginTop: 1 },

  roleBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
  roleBadgeText: { fontSize: 10, fontFamily: Typography.fontFamily.bold },

  userMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingTop: 4, borderTopWidth: 1, borderTopColor: colors.border },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 11, color: colors.textTertiary, fontFamily: Typography.fontFamily.regular },

  userActions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 8, borderRadius: 8, borderWidth: 1,
  },
  suspendBtn: { backgroundColor: 'rgba(255,152,0,0.1)', borderColor: 'rgba(255,152,0,0.3)' },
  suspendBtnText: { color: '#FF9800', fontSize: 12, fontFamily: Typography.fontFamily.bold },
  reactivateBtn: { backgroundColor: 'rgba(46,213,115,0.1)', borderColor: 'rgba(46,213,115,0.3)' },
  reactivateBtnText: { color: '#2ED573', fontSize: 12, fontFamily: Typography.fontFamily.bold },
  deleteBtn: { backgroundColor: 'rgba(255,71,87,0.1)', borderColor: 'rgba(255,71,87,0.3)' },
  deleteBtnText: { color: '#FF4757', fontSize: 12, fontFamily: Typography.fontFamily.bold },
  roleChangeBtn: { backgroundColor: isDark ? 'rgba(255,212,0,0.12)' : 'rgba(212,160,0,0.12)', borderColor: isDark ? 'rgba(255,212,0,0.3)' : 'rgba(212,160,0,0.3)' },
  roleChangeBtnText: { color: isDark ? '#FFD400' : colors.primaryDark, fontSize: 12, fontFamily: Typography.fontFamily.bold },

  // Role Change Modal Styles
  roleModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  roleModalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  roleModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  roleModalTitle: {
    fontSize: 18,
    fontFamily: Typography.fontFamily.bold,
    color: colors.textPrimary,
  },
  roleModalSubtitle: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.regular,
    color: colors.textTertiary,
    marginTop: 2,
  },
  roleModalCloseBtn: {
    padding: 4,
  },
  roleModalLabel: {
    fontSize: 13,
    fontFamily: Typography.fontFamily.bold,
    color: colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  roleOptionList: {
    gap: 10,
    marginBottom: Spacing.md,
  },
  roleOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: colors.surfaceVariant,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  roleOptionIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  roleOptionTitle: {
    fontSize: 14,
    fontFamily: Typography.fontFamily.bold,
    color: colors.textPrimary,
  },
  roleOptionDesc: {
    fontSize: 11,
    fontFamily: Typography.fontFamily.regular,
    color: colors.textTertiary,
    marginTop: 2,
  },
  roleModalNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(255,152,0,0.1)',
    borderRadius: BorderRadius.md,
    padding: 10,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,152,0,0.25)',
  },
  roleModalNoticeText: {
    flex: 1,
    fontSize: 11,
    fontFamily: Typography.fontFamily.regular,
    color: '#FF9800',
    lineHeight: 16,
  },
  roleModalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  roleModalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: BorderRadius.lg,
    backgroundColor: colors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleModalCancelText: {
    fontSize: 14,
    fontFamily: Typography.fontFamily.bold,
    color: colors.textSecondary,
  },
  roleModalSaveBtn: {
    flex: 1.6,
    paddingVertical: 12,
    borderRadius: BorderRadius.lg,
    backgroundColor: isDark ? '#FFD400' : colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleModalSaveText: {
    fontSize: 14,
    fontFamily: Typography.fontFamily.bold,
    color: isDark ? '#000' : '#FFF',
  },
});

export default UserManagerScreen;
