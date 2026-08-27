import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Image,
  ActivityIndicator, RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { Colors, Typography, BorderRadius } from '../../../theme/theme';
import api, { getImageUrl } from '../../../api/axios';
import { showCustomAlert } from '../../../components/CustomAlert';

const BlockedUsersScreen = ({ navigation }) => {
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
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Icon name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Blocked Users</Text>
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-back" size={24} color="#FFF" />
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
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon name="shield-checkmark-outline" size={60} color={Colors.textTertiary} style={{ marginBottom: 16 }} />
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
              >
                <Text style={styles.unblockBtnText}>Unblock</Text>
              </TouchableOpacity>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A', // Premium Dark Background
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  backBtn: {
    marginRight: 16,
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Outfit-Bold',
    color: '#FFF',
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
    backgroundColor: '#141414',
    borderRadius: BorderRadius.md || 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#222',
  },
  avatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,204,0,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarFallbackText: {
    fontSize: 16,
    fontFamily: 'Outfit-Bold',
    color: Colors.primary,
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  userName: {
    fontSize: 15,
    fontFamily: 'Outfit-SemiBold',
    color: '#FFF',
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 12,
    fontFamily: 'Outfit-Regular',
    color: Colors.textTertiary || '#888',
  },
  unblockBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  unblockBtnText: {
    fontSize: 13,
    fontFamily: 'Outfit-Medium',
    color: '#FFF',
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
    fontFamily: 'Outfit-Bold',
    color: '#FFF',
    marginBottom: 8,
  },
  emptyDesc: {
    fontSize: 14,
    fontFamily: 'Outfit-Regular',
    color: Colors.textTertiary || '#888',
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default BlockedUsersScreen;
