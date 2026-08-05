import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, ScrollView } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { fetchMyBookings } from '../bookingSlice';
import { Colors, Typography, Spacing, BorderRadius } from '../../../theme/theme';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useFocusEffect } from '@react-navigation/native';
import { formatISTDateFull, formatISTTime } from '../../../utils/dateFormatter';
import { SafeAreaView } from 'react-native-safe-area-context';

const BookingHistoryScreen = ({ navigation }) => {
  const dispatch = useDispatch();
  const { bookings, isLoading } = useSelector((state) => state.booking);
  
  const [activeTab, setActiveTab] = useState('Upcoming');
  const tabs = ['Upcoming', 'Completed', 'Cancelled', 'Requested Cancel'];

  const onRefresh = useCallback(() => {
    dispatch(fetchMyBookings({ limit: 100 }));
  }, [dispatch]);

  useFocusEffect(
    useCallback(() => {
      onRefresh(); 
    }, [onRefresh])
  );

  const getStatusColor = (status) => {
    switch (status) {
      case 'confirmed': return Colors.success;
      case 'pending': return Colors.warning;
      case 'cancelled': return Colors.error;
      case 'completed': return '#2196F3';
      default: return Colors.textSecondary;
    }
  };

  const filteredBookings = bookings.filter(b => {
    if (activeTab === 'Upcoming') return b.status === 'confirmed' || b.status === 'pending';
    if (activeTab === 'Completed') return b.status === 'completed';
    if (activeTab === 'Cancelled') return b.status === 'cancelled';
    if (activeTab === 'Requested Cancel') return b.status === 'cancellation_requested' || b.status === 'pending_refund';
    return true;
  });

  const renderItem = ({ item }) => {
    const turf = item.turf || {};
    const slots = item.slotsSnapshot || [];
    const dateStr = slots[0]?.date ? formatISTDateFull(slots[0].date) : 'Unknown Date';

    return (
      <TouchableOpacity 
        style={styles.card}
        activeOpacity={0.85}
        onPress={() => navigation.navigate('BookingDetail', { bookingId: item._id })}
      >
        <View style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <Text style={styles.turfName} numberOfLines={1}>{turf.name || 'Turf Name'}</Text>
            <View style={[styles.statusBadge, { borderColor: getStatusColor(item.status) }]}>
              <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                {item.status.toUpperCase()}
              </Text>
            </View>
          </View>
          
          <Text style={styles.address} numberOfLines={1}>
            <Icon name="map-marker" size={14} color={Colors.textSecondary} /> {turf.address || 'Address not available'}
          </Text>

          <View style={styles.detailsRow}>
            <Icon name="calendar" size={16} color={Colors.primary} />
            <Text style={styles.detailText}>{dateStr}</Text>
          </View>

          <View style={styles.slotsRow}>
            <Icon name="clock-outline" size={16} color={Colors.primary} style={{marginTop: 2}} />
            <View style={styles.slotsList}>
              {slots.map((slot, idx) => (
                <Text key={idx} style={styles.slotPill}>
                  {formatISTTime(slot.startTime)} – {formatISTTime(slot.endTime)}
                </Text>
              ))}
            </View>
          </View>

          <View style={styles.footerRow}>
            <View>
              <Text style={styles.amountLabel}>Total Paid</Text>
              <Text style={styles.amountValue}>₹{item.finalAmount}</Text>
            </View>
            <TouchableOpacity 
              style={styles.cardReportBtn}
              onPress={(e) => {
                e.stopPropagation();
                navigation.navigate('CreateTicketScreen', { bookingId: item.bookingRef });
              }}
            >
              <Icon name="alert-circle-outline" size={16} color={Colors.primary} />
              <Text style={styles.cardReportText}>Report Issue</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Bookings</Text>
        </View>

        {/* Tabs */}
        <View style={styles.tabsWrapper}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsContainer}>
            {tabs.map(tab => (
              <TouchableOpacity
                key={tab}
                style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
                onPress={() => setActiveTab(tab)}
                activeOpacity={0.8}
              >
                <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <FlatList
          data={filteredBookings}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={onRefresh} tintColor={Colors.primary} />}
          ListEmptyComponent={
            !isLoading && (
              <View style={styles.center}>
                <Icon name="ticket-confirmation-outline" size={64} color={Colors.textTertiary} />
                <Text style={styles.emptyTitle}>No {activeTab} Bookings</Text>
                <Text style={styles.emptySub}>You don't have any {activeTab.toLowerCase()} bookings at the moment.</Text>
              </View>
            )
          }
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.backgroundElevated },
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
    backgroundColor: Colors.backgroundElevated,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: { fontSize: Typography.fontSize['2xl'], fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary },

  // Horizontal scrolling tab bar
  tabsWrapper: {
    backgroundColor: Colors.backgroundElevated,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.sm,
  },
  tabBtn: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: {
    borderBottomColor: Colors.primary,
  },
  tabText: { color: Colors.textSecondary, fontFamily: Typography.fontFamily.medium, fontSize: 15 },
  tabTextActive: { color: Colors.primary, fontFamily: Typography.fontFamily.bold },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl, marginTop: 60 },
  listContainer: { padding: Spacing.lg, paddingBottom: 100 },
  
  card: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, marginBottom: Spacing.lg, borderWidth: 1, borderColor: Colors.border },
  cardContent: { padding: Spacing.lg },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xs },
  turfName: { fontSize: 18, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary, flex: 1, marginRight: 8 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1 },
  statusText: { fontSize: 10, fontFamily: Typography.fontFamily.bold },
  address: { fontSize: 13, color: Colors.textSecondary, fontFamily: Typography.fontFamily.medium, marginBottom: Spacing.md },
  
  detailsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.md },
  detailText: { fontSize: 14, color: Colors.textPrimary, fontFamily: Typography.fontFamily.medium },
  
  slotsRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: Spacing.lg },
  slotsList: { flexDirection: 'row', flexWrap: 'wrap', marginLeft: Spacing.sm, flex: 1, gap: 6 },
  slotPill: { backgroundColor: Colors.backgroundElevated, paddingHorizontal: 8, paddingVertical: 4, borderRadius: BorderRadius.sm, color: Colors.textPrimary, fontFamily: Typography.fontFamily.medium, fontSize: 12, borderWidth: 1, borderColor: Colors.border },

  footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.md },
  amountLabel: { fontSize: 12, color: Colors.textSecondary, fontFamily: Typography.fontFamily.medium },
  amountValue: { fontSize: 18, color: Colors.primary, fontFamily: Typography.fontFamily.bold },
  cardReportBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.backgroundElevated, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, gap: 4 },
  cardReportText: { fontSize: 12, color: Colors.primary, fontFamily: Typography.fontFamily.bold },
  
  emptyTitle: { fontSize: 18, color: Colors.textPrimary, fontFamily: Typography.fontFamily.bold, marginTop: Spacing.md },
  emptySub: { fontSize: 14, color: Colors.textSecondary, fontFamily: Typography.fontFamily.medium, marginTop: Spacing.xs, textAlign: 'center' },
});

export default BookingHistoryScreen;
