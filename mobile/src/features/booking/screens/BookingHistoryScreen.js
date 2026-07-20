import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, ScrollView, RefreshControl } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { fetchMyBookings } from '../bookingSlice';
import { Colors, Typography, Spacing, BorderRadius } from '../../../theme/theme';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useFocusEffect } from '@react-navigation/native';
import { formatISTDateFull, formatISTTime } from '../../../utils/dateFormatter';

const BookingHistoryScreen = ({ navigation }) => {
  const dispatch = useDispatch();
  const { bookings, isLoading } = useSelector((state) => state.booking);
  
  const [activeTab, setActiveTab] = useState('Upcoming');
  const tabs = ['Upcoming', 'Completed', 'Cancelled'];

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
    if (activeTab === 'Upcoming') return b.status === 'confirmed';
    if (activeTab === 'Completed') return b.status === 'completed';
    if (activeTab === 'Cancelled') return b.status === 'cancelled';
    return true;
  });

  const renderItem = ({ item }) => {
    const turf = item.turf || {};
    const slots = item.slotsSnapshot || [];
    const dateStr = slots[0]?.date ? formatISTDateFull(slots[0].date) : 'Unknown Date';

    return (
      <TouchableOpacity 
        style={styles.card}
        onPress={() => navigation.navigate('BookingDetail', { bookingId: item._id })}
      >
        <View style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <Text style={styles.turfName}>{turf.name || 'Turf Name'}</Text>
            <View style={[styles.statusBadge, { borderColor: getStatusColor(item.status) }]}>
              <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                {item.status.toUpperCase()}
              </Text>
            </View>
          </View>
          
          <Text style={styles.address} numberOfLines={1}>
            <Icon name="map-marker" size={14} /> {turf.address || 'Address not available'}
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
                  {formatISTTime(slot.startTime)} - {formatISTTime(slot.endTime)}
                </Text>
              ))}
            </View>
          </View>

          <View style={styles.footerRow}>
            <Text style={styles.amountLabel}>Paid Amount</Text>
            <Text style={styles.amountValue}>₹{item.finalAmount}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Bookings</Text>
      </View>

      <View style={styles.tabsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScroll}>
          {tabs.map(tab => (
            <TouchableOpacity 
              key={tab} 
              style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
              onPress={() => setActiveTab(tab)}
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
              <Icon name="ticket-confirmation-outline" size={60} color={Colors.textTertiary} />
              <Text style={styles.emptyTitle}>No {activeTab} Bookings</Text>
              <Text style={styles.emptySub}>You don't have any {activeTab.toLowerCase()} bookings at the moment.</Text>
            </View>
          )
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { padding: Spacing.xl, paddingTop: 60, backgroundColor: Colors.backgroundElevated, borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerTitle: { fontSize: Typography.fontSize.xl, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary },
  
  tabsContainer: { backgroundColor: Colors.backgroundElevated, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tabsScroll: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  tabBtn: { paddingHorizontal: Spacing.md, paddingVertical: 8, borderRadius: 20, marginRight: Spacing.sm, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.backgroundCard },
  tabBtnActive: { backgroundColor: Colors.primaryAlpha20, borderColor: Colors.primary },
  tabText: { color: Colors.textSecondary, fontFamily: Typography.fontFamily.medium, fontSize: 14 },
  tabTextActive: { color: Colors.primary, fontFamily: Typography.fontFamily.bold },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl, marginTop: 40 },
  listContainer: { padding: Spacing.lg, paddingBottom: 100 },
  
  card: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, marginBottom: Spacing.lg, borderWidth: 1, borderColor: Colors.border },
  cardContent: { padding: Spacing.lg },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xs },
  turfName: { fontSize: 18, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary, flex: 1 },
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
  
  emptyTitle: { fontSize: 18, color: Colors.textPrimary, fontFamily: Typography.fontFamily.bold, marginTop: Spacing.md },
  emptySub: { fontSize: 14, color: Colors.textSecondary, fontFamily: Typography.fontFamily.medium, marginTop: Spacing.xs, textAlign: 'center' },
});

export default BookingHistoryScreen;
