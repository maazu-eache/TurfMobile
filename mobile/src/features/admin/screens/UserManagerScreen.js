import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, TextInput, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import api from '../../../api/axios';
import { Colors, Typography, Spacing, BorderRadius } from '../../../theme/theme';
import { showCustomAlert } from '../../../components/CustomAlert';

const UserManagerScreen = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState('requests'); // 'requests' | 'all'
  const [deletionRequests, setDeletionRequests] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [requestsRes, usersRes] = await Promise.all([
        api.get('/admin/deletion-requests'),
        api.get('/admin/users?limit=100')
      ]);

      setDeletionRequests(requestsRes.data?.data || []);
      setUsers(usersRes.data?.data?.items || usersRes.data?.data || []);
    } catch (err) {
      showCustomAlert('Error', err.response?.data?.message || 'Failed to fetch user management data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleHardDelete = (user) => {
    showCustomAlert(
      "CONFIRM PERMANENT DELETION",
      `⚠️ WARNING: THIS ACTION CANNOT BE RESTORED OR UNDONE!\n\nAre you sure you want to PERMANENTLY delete user "${user.name}" (${user.email || user.mobile})?\n\nThis will purge ALL bookings, wallet balance, stats, player profile, owner turfs, slots, and team captaincy. ZERO data will remain.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "DELETE",
          style: "destructive",
          onPress: async () => {
            try {
              setActionLoadingId(user._id);
              await api.delete(`/admin/users/${user._id}/hard-delete`);
              showCustomAlert("Success", `User "${user.name}" and all associated data have been permanently deleted.`);
              fetchData();
            } catch (err) {
              showCustomAlert("Error", err.response?.data?.message || "Failed to delete user");
            } finally {
              setActionLoadingId(null);
            }
          }
        }
      ]
    );
  };

  const handleRejectDeletion = (user) => {
    showCustomAlert(
      "Reject Deletion Request",
      `Are you sure you want to reject the deletion request for "${user.name}"?\n\nThe user will be sent a push notification and email, allowing them to log back in.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reject Request",
          onPress: async () => {
            try {
              setActionLoadingId(user._id);
              await api.post(`/admin/users/${user._id}/reject-deletion`, { reason: 'Admin rejected account deletion request' });
              showCustomAlert("Success", `Deletion request rejected. Notification sent to ${user.name}.`);
              fetchData();
            } catch (err) {
              showCustomAlert("Error", err.response?.data?.message || "Failed to reject request");
            } finally {
              setActionLoadingId(null);
            }
          }
        }
      ]
    );
  };

  const filteredUsers = users.filter(u => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      (u.name && u.name.toLowerCase().includes(q)) ||
      (u.email && u.email.toLowerCase().includes(q)) ||
      (u.mobile && u.mobile.toLowerCase().includes(q))
    );
  });

  const renderRequestCard = ({ item }) => (
    <View style={styles.requestCard}>
      <View style={styles.cardHeader}>
        <View style={styles.userInfoBlock}>
          <Text style={styles.userName}>{item.name || 'Unknown User'}</Text>
          <Text style={styles.userSubText}>{item.email || item.mobile}</Text>
        </View>
        <View style={styles.roleBadge}>
          <Text style={styles.roleBadgeText}>{item.role?.toUpperCase() || 'USER'}</Text>
        </View>
      </View>

      <View style={styles.reasonBlock}>
        <Text style={styles.reasonLabel}>Reason for deletion:</Text>
        <Text style={styles.reasonText}>"{item.deletionReason || 'User requested account deletion'}"</Text>
        <Text style={styles.dateText}>
          Requested: {item.deletionRequestedAt ? new Date(item.deletionRequestedAt).toLocaleString() : 'Recently'}
        </Text>
      </View>

      <View style={styles.cardActions}>
        <TouchableOpacity
          style={[styles.btn, styles.rejectBtn]}
          onPress={() => handleRejectDeletion(item)}
          disabled={actionLoadingId === item._id}
        >
          {actionLoadingId === item._id ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <>
              <Icon name="close-circle-outline" size={18} color="#FFF" />
              <Text style={styles.btnText}>Reject</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, styles.deleteBtn]}
          onPress={() => handleHardDelete(item)}
          disabled={actionLoadingId === item._id}
        >
          {actionLoadingId === item._id ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <>
              <Icon name="trash-can-outline" size={18} color="#FFF" />
              <Text style={styles.btnText}>Approve & Delete</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderUserCard = ({ item }) => (
    <View style={styles.userCard}>
      <View style={styles.userInfoBlock}>
        <Text style={styles.userName}>{item.name || 'User'}</Text>
        <Text style={styles.userSubText}>{item.email || item.mobile}</Text>
        <Text style={styles.userRoleText}>Role: {item.role}</Text>
      </View>
      <TouchableOpacity
        style={styles.smallDeleteBtn}
        onPress={() => handleHardDelete(item)}
        disabled={actionLoadingId === item._id}
      >
        <Icon name="trash-can-outline" size={20} color={Colors.error} />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Icon name="arrow-left" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>User Management</Text>
            <Text style={styles.headerSubtitle}>Account Deletion Requests & Purge</Text>
          </View>
        </View>

        {/* Tab Toggle */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'requests' && styles.activeTab]}
            onPress={() => setActiveTab('requests')}
          >
            <Text style={[styles.tabText, activeTab === 'requests' && styles.activeTabText]}>
              Deletion Requests ({deletionRequests.length})
            </Text>
            {deletionRequests.length > 0 && <View style={styles.redDot} />}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'all' && styles.activeTab]}
            onPress={() => setActiveTab('all')}
          >
            <Text style={[styles.tabText, activeTab === 'all' && styles.activeTabText]}>
              All Users ({users.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Body */}
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : activeTab === 'requests' ? (
          <FlatList
            data={deletionRequests}
            keyExtractor={item => item._id}
            renderItem={renderRequestCard}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.primary} />}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Icon name="shield-check-outline" size={60} color={Colors.success} />
                <Text style={styles.emptyTitle}>No Pending Requests</Text>
                <Text style={styles.emptySubtitle}>There are currently no account deletion requests pending admin action.</Text>
              </View>
            }
          />
        ) : (
          <View style={{ flex: 1 }}>
            <View style={styles.searchBox}>
              <Icon name="magnify" size={20} color={Colors.textTertiary} style={{ marginRight: 8 }} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search users by name, email, or mobile..."
                placeholderTextColor={Colors.textTertiary}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
            <FlatList
              data={filteredUsers}
              keyExtractor={item => item._id}
              renderItem={renderUserCard}
              contentContainerStyle={styles.listContent}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.primary} />}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyTitle}>No Users Found</Text>
                </View>
              }
            />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.backgroundElevated },
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.backgroundElevated,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: { marginRight: Spacing.md, padding: 4 },
  headerTitle: { fontSize: 20, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary },
  headerSubtitle: { fontSize: 12, fontFamily: Typography.fontFamily.medium, color: Colors.textSecondary },
  
  tabContainer: { flexDirection: 'row', backgroundColor: Colors.surface, padding: 4, margin: Spacing.lg, borderRadius: BorderRadius.md },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: BorderRadius.sm, flexDirection: 'row', justifyContent: 'center' },
  activeTab: { backgroundColor: Colors.surfaceVariant },
  tabText: { fontSize: 13, fontFamily: Typography.fontFamily.medium, color: Colors.textSecondary },
  activeTabText: { color: Colors.primary, fontFamily: Typography.fontFamily.bold },
  redDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.error, marginLeft: 6 },

  listContent: { padding: Spacing.lg, paddingBottom: 60 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  requestCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(244,67,54,0.3)',
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  userInfoBlock: { flex: 1, marginRight: 8 },
  userName: { fontSize: 18, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary },
  userSubText: { fontSize: 13, fontFamily: Typography.fontFamily.medium, color: Colors.textSecondary },
  roleBadge: { backgroundColor: 'rgba(255,152,0,0.15)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  roleBadgeText: { color: '#FF9800', fontFamily: Typography.fontFamily.bold, fontSize: 10 },

  reasonBlock: { backgroundColor: 'rgba(244,67,54,0.08)', padding: 12, borderRadius: 8, marginBottom: 16 },
  reasonLabel: { fontSize: 11, color: Colors.textSecondary, fontFamily: Typography.fontFamily.medium },
  reasonText: { fontSize: 14, color: Colors.error, fontFamily: Typography.fontFamily.bold, marginVertical: 4 },
  dateText: { fontSize: 11, color: Colors.textTertiary, fontFamily: Typography.fontFamily.regular },

  cardActions: { flexDirection: 'row', gap: 12 },
  btn: { flex: 1, paddingVertical: 12, borderRadius: BorderRadius.md, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
  rejectBtn: { backgroundColor: '#3A3A3C' },
  deleteBtn: { backgroundColor: Colors.error },
  btnText: { color: '#FFF', fontFamily: Typography.fontFamily.bold, fontSize: 13 },

  userCard: {
    flexDirection: 'row',
    justify: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  userRoleText: { fontSize: 12, color: Colors.primary, fontFamily: Typography.fontFamily.medium, marginTop: 2 },
  smallDeleteBtn: { padding: 8, backgroundColor: 'rgba(244,67,54,0.1)', borderRadius: 8 },

  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: { flex: 1, height: 44, color: Colors.textPrimary, fontFamily: Typography.fontFamily.medium, fontSize: 14 },

  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingTop: 60, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 18, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary, marginTop: 16, marginBottom: 8 },
  emptySubtitle: { fontSize: 13, fontFamily: Typography.fontFamily.medium, color: Colors.textSecondary, textAlign: 'center' },
});

export default UserManagerScreen;
