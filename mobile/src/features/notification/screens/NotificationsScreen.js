import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors, Typography, Spacing, BorderRadius } from '../../../theme/theme';
import api from '../../../api/axios';
import { formatISTDateTime } from '../../../utils/dateFormatter';
import { showCustomAlert } from '../../../components/CustomAlert';

const NotificationsScreen = ({ navigation }) => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await api.get('/notifications');
      setNotifications(res.data.data.notifications || []);
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
      
      if (!data) return; // if no data, don't navigate

      // Turf/Booking related
      if (['booking_confirmed', 'upcoming_booking', 'new_booking', 'screenshot_uploaded', 'booking_status'].includes(type) || (type === 'general' && data.bookingId)) {
         navigation.navigate('Bookings', { screen: 'BookingHistory', params: { turfId: data.turfId } });
      } else if (type === 'turf_favourited' || data.turfId) {
         navigation.navigate('Home', { screen: 'TurfDetail', params: { turfId: data.turfId } });
      } 
      // Cricket/Match related
      else if (['match_started', 'match_completed', 'match_update'].includes(type) || data.matchId) {
         navigation.navigate('My Cricket', { screen: 'MatchSummary', params: { matchId: data.matchId } });
      } else if (['auction_invite', 'auction_started'].includes(type)) {
         navigation.navigate('My Cricket', { screen: 'TournamentList' });
      } 
      // Player related (New Follower)
      else if (['new_follower'].includes(type) || (type === 'general' && data.type === 'player' && data.id)) {
         navigation.navigate('Profile', { screen: 'PlayerProfile', params: { playerId: data.id } });
      }
      // Finance related
      else if (['payment_verified', 'payment_received', 'withdrawal_request'].includes(type)) {
         navigation.navigate('Profile', { screen: 'Wallet' });
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
    >
      <View style={styles.iconContainer}>
        <Icon name={item.isRead ? "bell-outline" : "bell-ring"} size={24} color={item.isRead ? Colors.textTertiary : Colors.primary} />
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
    return <View style={styles.loader}><ActivityIndicator size="large" color={Colors.primary} /></View>;
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Icon name="arrow-left" size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notifications</Text>
        </View>
        {notifications.length > 0 && (
          <View style={{ flexDirection: 'row', gap: Spacing.md }}>
            <TouchableOpacity onPress={markAllAsRead}>
              <Icon name="check-all" size={24} color={Colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={clearAll}>
              <Icon name="trash-can-outline" size={24} color={Colors.error} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item._id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No notifications yet.</Text>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.xl,
    paddingTop: Spacing['3xl'],
    backgroundColor: Colors.backgroundElevated,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.surface,
    justifyContent: 'center', alignItems: 'center',
    marginRight: Spacing.md,
  },
  headerTitle: {
    fontSize: Typography.fontSize.xl,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.textPrimary,
  },
  list: { padding: Spacing.md },
  notificationCard: {
    flexDirection: 'row',
    padding: Spacing.md,
    backgroundColor: Colors.backgroundElevated,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
    alignItems: 'center',
  },
  unreadCard: {
    backgroundColor: 'rgba(57, 255, 20, 0.05)',
    borderColor: Colors.primaryAlpha30,
    borderWidth: 1,
  },
  iconContainer: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.surface,
    justifyContent: 'center', alignItems: 'center',
    marginRight: Spacing.md,
  },
  textContainer: { flex: 1 },
  title: {
    fontSize: Typography.fontSize.md,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  unreadTitle: { color: Colors.textPrimary, fontFamily: Typography.fontFamily.bold },
  body: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  time: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.textTertiary,
  },
  unreadDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: Colors.primary,
    marginLeft: Spacing.sm,
  },
  emptyText: {
    textAlign: 'center',
    color: Colors.textTertiary,
    marginTop: Spacing['3xl'],
    fontFamily: Typography.fontFamily.medium,
  }
});

export default NotificationsScreen;
