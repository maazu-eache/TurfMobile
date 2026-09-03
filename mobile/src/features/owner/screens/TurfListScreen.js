import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator, Platform, StatusBar } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Typography, Spacing, BorderRadius } from '../../../theme/theme';
import { useTheme } from '../../../theme/ThemeContext';
import api, { getImageUrl } from '../../../api/axios';
import { fetchOwnerDashboard } from '../ownerSlice';
import { showCustomAlert } from '../../../components/CustomAlert';

const TurfListScreen = ({ navigation }) => {
  const { colors, isDark, shadows } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark, shadows), [colors, isDark, shadows]);

  const { dashboard, isLoading } = useSelector((state) => state.owner);
  const turfs = dashboard?.owner?.turfs || [];
  const dispatch = useDispatch();
  
  const [deletingTurf, setDeletingTurf] = useState(null);

  useFocusEffect(
    useCallback(() => {
      dispatch(fetchOwnerDashboard());
    }, [dispatch])
  );

  const handleDelete = (turf) => {
    showCustomAlert(
      'Delete Turf',
      `Are you sure you want to permanently delete "${turf.name}"? This will instantly remove all its availability slots and past bookings. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete Turf', 
          style: 'destructive',
          onPress: async () => {
            setDeletingTurf(turf._id);
            try {
              await api.delete(`/turfs/${turf._id}`);
              showCustomAlert('Success', 'Turf deleted successfully.');
              dispatch(fetchOwnerDashboard());
            } catch (err) {
              const msg = err.response?.data?.message || 'Failed to delete turf';
              showCustomAlert('Error', msg);
            } finally {
              setDeletingTurf(null);
            }
          }
        }
      ]
    );
  };

  const renderTurfCard = ({ item }) => {
    return (
      <View style={styles.card}>
        <View style={styles.cardTopRow}>
          <Image 
            source={{ uri: getImageUrl(item.coverImage) }} 
            style={styles.coverImage} 
          />
          <View style={styles.cardInfo}>
            <View style={styles.headerRow}>
              <Text style={styles.turfName}>{item.name}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: item.status === 'active' ? (isDark ? 'rgba(76, 175, 80, 0.2)' : '#E8F5E9') : colors.surfaceVariant, alignSelf: 'flex-start' }]}>
              <Text style={[styles.statusText, { color: item.status === 'active' ? (isDark ? '#4CAF50' : '#2E7D32') : colors.textSecondary }]}>
                {item.status.toUpperCase()}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Icon name="map-marker-outline" size={14} color={colors.textSecondary} />
              <Text style={styles.infoText} numberOfLines={1}>{item.city}</Text>
            </View>
            <View style={styles.infoRow}>
              <Icon name="soccer-field" size={14} color={colors.textSecondary} />
              <Text style={styles.infoText} numberOfLines={1}>{item.type}</Text>
            </View>
          </View>
        </View>

        {item.deletionRequested && (
          <View style={styles.deletionRequestedWarning}>
            <Icon name="alert-circle-outline" size={16} color={colors.error} />
            <Text style={styles.deletionRequestedText}>Deletion Requested</Text>
          </View>
        )}

        <View style={styles.actionsRow}>
          <TouchableOpacity 
            style={styles.actionBtn} 
            onPress={() => navigation.navigate('SlotManager', { turfId: item._id })}
            activeOpacity={0.8}
          >
            <Icon name="clock-outline" size={16} color={isDark ? colors.primary : colors.primaryDark} />
            <Text style={styles.actionText}>Manage Slots</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionBtn, styles.iconBtn]} 
            onPress={() => navigation.navigate('TurfRegistration', { editTurf: item })}
            activeOpacity={0.8}
          >
            <Icon name="pencil-outline" size={18} color={isDark ? colors.primary : colors.primaryDark} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionBtn, styles.iconBtn, styles.deleteBtn]} 
            onPress={() => handleDelete(item)}
            disabled={deletingTurf === item._id}
            activeOpacity={0.8}
          >
            {deletingTurf === item._id ? (
              <ActivityIndicator size="small" color={colors.error} />
            ) : (
              <Icon name="trash-can-outline" size={18} color={colors.error} />
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.surface} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <Icon name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Turfs</Text>
        <TouchableOpacity onPress={() => navigation.navigate('TurfRegistration')} style={styles.addBtn} activeOpacity={0.7}>
          <Icon name="plus" size={24} color={isDark ? colors.primary : colors.primaryDark} />
        </TouchableOpacity>
      </View>

      {isLoading && !turfs.length ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : turfs.length === 0 ? (
        <View style={styles.centerContainer}>
          <Icon name="soccer-field" size={64} color={colors.textTertiary} />
          <Text style={styles.emptyText}>You haven't added any turfs yet.</Text>
          <TouchableOpacity 
            style={styles.primaryBtn} 
            onPress={() => navigation.navigate('TurfRegistration')}
            activeOpacity={0.85}
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

const createStyles = (colors, isDark, shadows) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Platform.OS === 'ios' ? 60 : (StatusBar.currentHeight || 24) + Spacing.md,
    paddingBottom: Spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { padding: Spacing.xs },
  headerTitle: { fontFamily: Typography.fontFamily.bold, fontSize: 20, color: colors.textPrimary },
  addBtn: { padding: Spacing.xs },
  
  listContainer: { padding: Spacing.md },
  
  card: {
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    padding: Spacing.sm,
    ...shadows.small,
  },
  cardTopRow: { flexDirection: 'row', marginBottom: Spacing.sm },
  coverImage: { width: 80, height: 80, borderRadius: BorderRadius.md, marginRight: Spacing.sm },
  cardInfo: { flex: 1, justifyContent: 'center' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 2 },
  turfName: { fontFamily: Typography.fontFamily.bold, fontSize: 15, color: colors.textPrimary, flex: 1 },
  statusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, marginBottom: 4 },
  statusText: { fontSize: 9, fontFamily: Typography.fontFamily.bold },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 0 },
  infoText: { fontFamily: Typography.fontFamily.regular, fontSize: 12, color: colors.textSecondary, marginLeft: 4 },
  
  deletionRequestedWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDark ? 'rgba(239, 68, 68, 0.12)' : '#FEE2E2',
    padding: Spacing.xs,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.sm,
  },
  deletionRequestedText: {
    color: colors.error,
    fontFamily: Typography.fontFamily.medium,
    fontSize: 11,
    marginLeft: Spacing.xs,
  },

  actionsRow: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceVariant,
    paddingVertical: 8,
    borderRadius: BorderRadius.md,
  },
  iconBtn: {
    flex: 0,
    width: 36,
    height: 36,
    paddingVertical: 0,
  },
  deleteBtn: { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.12)' : '#FEE2E2' },
  actionText: { fontFamily: Typography.fontFamily.medium, fontSize: 13, color: isDark ? colors.primary : colors.primaryDark, marginLeft: 6 },
  
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
  emptyText: { fontFamily: Typography.fontFamily.medium, fontSize: 16, color: colors.textSecondary, marginTop: Spacing.md, textAlign: 'center' },
  primaryBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.xl,
  },
  primaryBtnText: { color: '#000', fontFamily: Typography.fontFamily.bold, fontSize: 16 },
});

export default TurfListScreen;
