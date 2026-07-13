import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, Alert, ActivityIndicator, Platform, StatusBar } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors, Typography, Spacing, BorderRadius } from '../../../theme/theme';
import api, { getImageUrl } from '../../../api/axios';
import { fetchOwnerDashboard } from '../ownerSlice';
import { showCustomAlert } from '../../../components/CustomAlert';

const TurfListScreen = ({ navigation }) => {
  const { dashboard, isLoading } = useSelector((state) => state.owner);
  const turfs = dashboard?.owner?.turfs || [];
  const dispatch = useDispatch();
  
  const [requestingDelete, setRequestingDelete] = useState(null);

  useFocusEffect(
    useCallback(() => {
      dispatch(fetchOwnerDashboard());
    }, [dispatch])
  );

  const handleRequestDelete = (turf) => {
    showCustomAlert(
      'Request Deletion',
      `Are you sure you want to request deletion for "${turf.name}"? The admin will review and permanently delete it along with all its bookings and slots.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Request Delete', 
          style: 'destructive',
          onPress: async () => {
            setRequestingDelete(turf._id);
            try {
              await api.post(`/turfs/${turf._id}/request-delete`);
              showCustomAlert('Success', 'Deletion request sent to admin.');
              dispatch(fetchOwnerDashboard());
            } catch (err) {
              const msg = err.response?.data?.message || 'Failed to send deletion request';
              showCustomAlert('Error', msg);
            } finally {
              setRequestingDelete(null);
            }
          }
        }
      ]
    );
  };

  const renderTurfCard = ({ item }) => {
    return (
      <View style={styles.card}>
        <Image 
          source={{ uri: getImageUrl(item.coverImage) }} 
          style={styles.coverImage} 
        />
        <View style={styles.cardContent}>
          <View style={styles.headerRow}>
            <Text style={styles.turfName}>{item.name}</Text>
            <View style={[styles.statusBadge, { backgroundColor: item.status === 'active' ? Colors.successAlpha20 : Colors.surfaceVariant }]}>
              <Text style={[styles.statusText, { color: item.status === 'active' ? Colors.success : Colors.textSecondary }]}>
                {item.status.toUpperCase()}
              </Text>
            </View>
          </View>
          
          <View style={styles.infoRow}>
            <Icon name="map-marker-outline" size={16} color={Colors.textSecondary} />
            <Text style={styles.infoText}>{item.city}</Text>
            <Text style={styles.dot}>•</Text>
            <Icon name="soccer-field" size={16} color={Colors.textSecondary} />
            <Text style={styles.infoText}>{item.type}</Text>
          </View>

          {item.deletionRequested && (
            <View style={styles.deletionRequestedWarning}>
              <Icon name="alert-circle-outline" size={16} color={Colors.error} />
              <Text style={styles.deletionRequestedText}>Deletion Requested</Text>
            </View>
          )}

          <View style={styles.actionsRow}>
            <TouchableOpacity 
              style={styles.actionBtn} 
              onPress={() => navigation.navigate('TurfRegistration', { editTurf: item })}
            >
              <Icon name="pencil-outline" size={18} color={Colors.primary} />
              <Text style={styles.actionText}>Edit</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.actionBtn} 
              onPress={() => navigation.navigate('SlotManager', { turfId: item._id })}
            >
              <Icon name="clock-outline" size={18} color={Colors.primary} />
              <Text style={styles.actionText}>Manage Slots</Text>
            </TouchableOpacity>

            {!item.deletionRequested && (
              <TouchableOpacity 
                style={[styles.actionBtn, styles.deleteBtn]} 
                onPress={() => handleRequestDelete(item)}
                disabled={requestingDelete === item._id}
              >
                {requestingDelete === item._id ? (
                  <ActivityIndicator size="small" color={Colors.error} />
                ) : (
                  <>
                    <Icon name="trash-can-outline" size={18} color={Colors.error} />
                    <Text style={[styles.actionText, { color: Colors.error }]}>Delete</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Turfs</Text>
        <TouchableOpacity onPress={() => navigation.navigate('TurfRegistration')} style={styles.addBtn}>
          <Icon name="plus" size={24} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {isLoading && !turfs.length ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : turfs.length === 0 ? (
        <View style={styles.centerContainer}>
          <Icon name="soccer-field" size={64} color={Colors.textTertiary} />
          <Text style={styles.emptyText}>You haven't added any turfs yet.</Text>
          <TouchableOpacity 
            style={styles.primaryBtn} 
            onPress={() => navigation.navigate('TurfRegistration')}
          >
            <Text style={styles.primaryBtnText}>Add Your First Turf</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={turfs}
          keyExtractor={(item) => item._id}
          renderItem={renderTurfCard}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Platform.OS === 'ios' ? 60 : (StatusBar.currentHeight || 24) + Spacing.md,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: { padding: Spacing.xs },
  headerTitle: { fontFamily: Typography.fontFamily.bold, fontSize: 20, color: Colors.textPrimary },
  addBtn: { padding: Spacing.xs },
  
  listContainer: { padding: Spacing.md },
  
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  coverImage: { width: '100%', height: 180 },
  cardContent: { padding: Spacing.md },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xs },
  turfName: { fontFamily: Typography.fontFamily.bold, fontSize: 18, color: Colors.textPrimary, flex: 1 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 12, fontFamily: Typography.fontFamily.bold },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md },
  infoText: { fontFamily: Typography.fontFamily.regular, fontSize: 14, color: Colors.textSecondary, marginLeft: 4 },
  dot: { color: Colors.textTertiary, marginHorizontal: 8 },
  
  deletionRequestedWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(244, 67, 54, 0.1)',
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.md,
  },
  deletionRequestedText: {
    color: Colors.error,
    fontFamily: Typography.fontFamily.medium,
    fontSize: 12,
    marginLeft: Spacing.xs,
  },

  actionsRow: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceVariant,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
    minWidth: '30%',
  },
  deleteBtn: { backgroundColor: 'rgba(244, 67, 54, 0.1)' },
  actionText: { fontFamily: Typography.fontFamily.medium, fontSize: 13, color: Colors.primary, marginLeft: 6 },
  
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
  emptyText: { fontFamily: Typography.fontFamily.medium, fontSize: 16, color: Colors.textSecondary, marginTop: Spacing.md, textAlign: 'center' },
  primaryBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.xl,
  },
  primaryBtnText: { color: '#000', fontFamily: Typography.fontFamily.bold, fontSize: 16 },
});

export default TurfListScreen;
