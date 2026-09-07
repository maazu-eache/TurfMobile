import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, StatusBar, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme, Typography, Spacing, BorderRadius } from '../../../theme/theme';
import api from '../../../api/axios';
import { formatISTDateTime } from '../../../utils/dateFormatter';
import { showCustomAlert } from '../../../components/CustomAlert';
import { useSelector } from 'react-redux';

const createStyles = (colors, shadows, isDark) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.surface },
  container: { flex: 1, backgroundColor: colors.background },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    ...(isDark ? {} : shadows.xs),
  },
  backButton: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: isDark ? colors.background : colors.surfaceVariant,
    justifyContent: 'center', alignItems: 'center',
    marginRight: Spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerTitle: {
    fontSize: Typography.fontSize.xl,
    fontFamily: Typography.fontFamily.bold,
    color: colors.textPrimary,
  },
  list: { padding: Spacing.md },
  notificationCard: {
    flexDirection: 'row',
    padding: Spacing.md,
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    ...(isDark ? {} : shadows.xs),
  },
  unreadCard: {
    backgroundColor: colors.primaryAlpha10,
    borderColor: colors.primaryAlpha30,
  },
  iconContainer: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: isDark ? colors.backgroundElevated : colors.surfaceVariant,
    justifyContent: 'center', alignItems: 'center',
    marginRight: Spacing.md,
  },
  textContainer: { flex: 1 },
  title: {
    fontSize: Typography.fontSize.md,
    fontFamily: Typography.fontFamily.semiBold,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  unreadTitle: { color: colors.textPrimary, fontFamily: Typography.fontFamily.bold },
  body: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.regular,
    color: colors.textSecondary,
    marginBottom: 4,
    lineHeight: 18,
  },
  time: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.regular,
    color: colors.textTertiary,
  },
  unreadDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: colors.primary,
    marginLeft: Spacing.sm,
  },
  emptyText: {
    textAlign: 'center',
    color: colors.textTertiary,
    marginTop: Spacing['3xl'],
    fontFamily: Typography.fontFamily.medium,
  }
});

const NotificationsScreen = ({ navigation }) => {
  const { user } = useSelector((state) => state.auth);
  const isOwner = user?.role === 'owner';
  const isAdmin = user?.role === 'admin';
  const insets = useSafeAreaInsets();
  const safeTop = Math.max(insets?.top || 0, Platform.OS === 'ios' ? 44 : 0);
  const { colors, shadows, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, shadows, isDark), [colors, shadows, isDark]);

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await api.get('/notifications');
      const fetchedNotifications = res.data.data.notifications || [];
      
      const hasUnread = fetchedNotifications.some(n => !n.isRead);
      if (hasUnread) {
        setNotifications(fetchedNotifications.map(n => ({ ...n, isRead: true })));
        api.put('/notifications/read-all').catch(err => {
          console.log('Error auto-marking notifications as read:', err);
        });
      } else {
        setNotifications(fetchedNotifications);
      }
    } catch (err) {
      console.log('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id, data, type) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
      
      if (!data) return;
      if (isAdmin) return;

      try {
        if (isOwner) {
          if (['booking_confirmed', 'upcoming_booking', 'new_booking', 'screenshot_uploaded', 'booking_status'].includes(type) || data.bookingId) {
            navigation.navigate('Bookings');
          } else if (type === 'turf_favourited' || data.turfId) {
            navigation.navigate('TurfList');
          } else if (['payment_verified', 'payment_received', 'withdrawal_request'].includes(type)) {
            navigation.navigate('Wallet');
          } else if (['match_started', 'match_completed', 'match_update'].includes(type) || data.matchId) {
            navigation.navigate('OwnerDashboard');
          }
        } else {
          if (['booking_confirmed', 'upcoming_booking', 'new_booking', 'screenshot_uploaded', 'booking_status'].includes(type) || data.bookingId) {
            navigation.navigate('Bookings', { screen: 'BookingHistory', params: { turfId: data.turfId } });
          } else if (type === 'turf_favourited' || data.turfId) {
            navigation.navigate('Home', { screen: 'TurfDetail', params: { id: data.turfId } });
          } else if (['match_started', 'match_completed', 'match_update'].includes(type) || data.matchId) {
            navigation.navigate('My Cricket', { screen: 'MatchSummary', params: { matchId: data.matchId } });
          } else if (['auction_invite', 'auction_started'].includes(type)) {
            navigation.navigate('My Cricket', { screen: 'TournamentList' });
          } else if (['new_follower'].includes(type) || (type === 'general' && data.type === 'player' && data.id)) {
            navigation.navigate('Profile', { screen: 'PlayerProfile', params: { playerId: data.id } });
          } else if (['payment_verified', 'payment_received', 'withdrawal_request'].includes(type)) {
            navigation.navigate('Profile', { screen: 'Wallet' });
          }
        }
      } catch (navErr) {
        console.log('Navigation payload error handled gracefully:', navErr);
      }
    } catch (err) {
      console.log('Error marking as read', err);
    }
  };

  const markAllAsRead = () => {
    showCustomAlert(
      'Mark All as Read',
      'Are you sure you want to mark all notifications as read?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Confirm', 
          onPress: async () => {
            try {
              await api.put('/notifications/read-all');
              setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
            } catch (err) {
              console.log('Error marking all as read', err);
            }
          }
        }
      ]
    );
  };

  const clearAll = () => {
    showCustomAlert(
      'Clear All Notifications',
      'Are you sure you want to delete all notifications? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete('/notifications/clear-all');
              setNotifications([]);
            } catch (err) {
              console.log('Error clearing notifications', err);
            }
          }
        }
      ]
    );
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity 
      style={[styles.notificationCard, !item.isRead && styles.unreadCard]}
      onPress={() => markAsRead(item._id, item.data, item.type)}
      activeOpacity={0.75}
    >
      <View style={styles.iconContainer}>
        <Icon name={item.isRead ? "bell-outline" : "bell-ring"} size={24} color={item.isRead ? colors.textTertiary : colors.primary} />
      </View>
      <View style={styles.textContainer}>
        <Text style={[styles.title, !item.isRead && styles.unreadTitle]}>{item.title}</Text>
        <Text style={styles.body}>{item.body}</Text>
        <Text style={styles.time}>{formatISTDateTime(item.createdAt)}</Text>
      </View>
      {!item.isRead && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loader}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.safeArea, { paddingTop: safeTop }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.surface} />
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.7}>
              <Icon name="arrow-left" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Notifications ({notifications.length})</Text>
          </View>
          {notifications.length > 0 && (
            <View style={{ flexDirection: 'row', gap: Spacing.md }}>
              <TouchableOpacity onPress={markAllAsRead} activeOpacity={0.7}>
                <Icon name="check-all" size={24} color={isDark ? colors.primary : colors.primaryDark} />
              </TouchableOpacity>
              <TouchableOpacity onPress={clearAll} activeOpacity={0.7}>
                <Icon name="trash-can-outline" size={24} color={colors.error} />
              </TouchableOpacity>
            </View>
          )}
        </View>

        <FlatList
          data={notifications}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No notifications yet.</Text>
          }
        />
      </View>
    </View>
  );
};

export default NotificationsScreen;
