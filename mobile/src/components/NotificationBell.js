import React, { useState, useCallback } from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useFocusEffect } from '@react-navigation/native';
import api from '../api/axios';
import { Colors, Typography } from '../theme/theme';

const NotificationBell = ({ onPress, color = Colors.textPrimary }) => {
  const [unreadCount, setUnreadCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      const fetchUnreadCount = async () => {
        try {
          const res = await api.get('/notifications?limit=1');
          if (isActive) {
            setUnreadCount(res.data.data?.unreadCount || 0);
          }
        } catch (err) {
          console.log('Failed to fetch unread count', err);
        }
      };
      fetchUnreadCount();
      
      return () => {
        isActive = false;
      };
    }, [])
  );

  return (
    <TouchableOpacity onPress={onPress} style={styles.container}>
      <Icon name="bell-outline" size={28} color={color} />
      {unreadCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    padding: 2,
    marginRight: 8
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: Colors.error,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 10,
    fontFamily: Typography.fontFamily.bold,
  },
});

export default NotificationBell;
