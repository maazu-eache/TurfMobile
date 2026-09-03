import React, { useState, useCallback } from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useFocusEffect } from '@react-navigation/native';
import api from '../api/axios';
import { useTheme, Typography } from '../theme/theme';

const NotificationBell = ({ onPress, color, size = 26 }) => {
  const { colors } = useTheme();
  const [unreadCount, setUnreadCount] = useState(0);

  const iconColor = color || colors.textPrimary;

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
    <TouchableOpacity onPress={onPress} style={styles.container} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
      <Icon name="bell-outline" size={size} color={iconColor} />
      {unreadCount > 0 && (
        <View style={[styles.badge, { backgroundColor: colors.error, borderColor: colors.surface }]}>
          <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontFamily: Typography.fontFamily.bold,
    lineHeight: 12,
  },
});

export default NotificationBell;
