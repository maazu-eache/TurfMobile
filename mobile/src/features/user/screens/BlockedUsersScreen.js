import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Image,
  ActivityIndicator, RefreshControl, StatusBar
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme, Typography, BorderRadius, Spacing } from '../../../theme/theme';
import api, { getImageUrl } from '../../../api/axios';
import { showCustomAlert } from '../../../components/CustomAlert';

const createStyles = (colors, shadows, isDark) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    ...(isDark ? {} : shadows.xs),
  },
  backBtn: {
    marginRight: 16,
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: Typography.fontFamily.bold,
    color: colors.textPrimary,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
    flexGrow: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.md,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    ...(isDark ? {} : shadows.xs),
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: isDark ? colors.backgroundElevated : colors.surfaceVariant,
  },
  avatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryAlpha10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primaryAlpha30,
  },
  avatarFallbackText: {
    fontSize: 16,
    fontFamily: Typography.fontFamily.bold,
    color: colors.primary,
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  userName: {
    fontSize: 15,
    fontFamily: Typography.fontFamily.semiBold,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.regular,
    color: colors.textTertiary,
  },
  unblockBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : colors.surfaceVariant,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  unblockBtnText: {
    fontSize: 13,
    fontFamily: Typography.fontFamily.medium,
    color: colors.textPrimary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 80,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: Typography.fontFamily.bold,
    color: colors.textPrimary,
    marginBottom: 8,
  },
  emptyDesc: {
    fontSize: 14,
    fontFamily: Typography.fontFamily.regular,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});

const BlockedUsersScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const safeTop = Math.max(insets?.top || 0, Platform.OS === 'ios' ? 44 : 0);
  const { colors, shadows, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, shadows, isDark), [colors, shadows, isDark]);

  const [blockedUsers, setBlockedUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchBlockedUsers = async () => {
    try {
      const res = await api.get('/users/blocked');
      if (res.data && res.data.success) {
        setBlockedUsers(res.data.data || []);
      }
    } catch (err) {
      console.error('Error fetching blocked users:', err.message);
      showCustomAlert('Error', 'Failed to fetch blocked users list.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchBlockedUsers();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchBlockedUsers();
  };

  const handleUnblock = (userId, userName) => {
    showCustomAlert(
      'Unblock User',
      `Are you sure you want to unblock ${userName}? They will be able to search for you and join your teams/matches again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          style: 'default',
          onPress: async () => {
            try {
              const res = await api.post(`/users/unblock/${userId}`);
              if (res.data && res.data.success) {
                setBlockedUsers(prev => prev.filter(u => u._id !== userId));
                showCustomAlert('Success', `${userName} has been unblocked.`);
              }
            } catch (err) {
              showCustomAlert('Error', err.response?.data?.message || 'Failed to unblock user.');
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: safeTop }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.surface} />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
            <Icon name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Blocked Users</Text>
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: safeTop }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.surface} />
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <Icon name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Blocked Users</Text>
      </View>

      <FlatList
        data={blockedUsers}
        keyExtractor={item => item._id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon name="shield-checkmark-outline" size={60} color={colors.textTertiary} style={{ marginBottom: 16 }} />
            <Text style={styles.emptyTitle}>No Blocked Users</Text>
            <Text style={styles.emptyDesc}>Users you block will appear here. You can block users directly from their profiles.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const avatarUrl = item.photo ? getImageUrl(item.photo) : null;
          return (
            <View style={styles.row}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarFallbackText}>
                    {(item.name || '?').charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.userInfo}>
                <Text style={styles.userName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.userEmail} numberOfLines={1}>{item.email || 'Cricket Player'}</Text>
              </View>
              <TouchableOpacity
                style={styles.unblockBtn}
                onPress={() => handleUnblock(item._id, item.name)}
                activeOpacity={0.8}
              >
                <Text style={styles.unblockBtnText}>Unblock</Text>
              </TouchableOpacity>
            </View>
          );
        }}
      />
    </View>
  );
};

export default BlockedUsersScreen;
