import React, { useState, useCallback, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, ScrollView, Dimensions, StatusBar, Platform } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
import { useDispatch, useSelector } from 'react-redux';
import { fetchMyBookings } from '../bookingSlice';
import { useTheme, Typography, Spacing, BorderRadius } from '../../../theme/theme';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useFocusEffect } from '@react-navigation/native';
import { formatISTDateFull, formatISTTime } from '../../../utils/dateFormatter';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const createStyles = (colors, shadows, isDark) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.surface },
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    ...(isDark ? {} : shadows.xs),
  },
  headerTitle: { fontSize: Typography.fontSize['2xl'], fontFamily: Typography.fontFamily.bold, color: colors.textPrimary },

  // Horizontal scrolling tab bar
  tabsWrapper: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
    borderBottomColor: colors.primary,
  },
  tabText: { color: colors.textSecondary, fontFamily: Typography.fontFamily.medium, fontSize: 15 },
  tabTextActive: { color: isDark ? colors.primary : colors.primaryDark, fontFamily: Typography.fontFamily.bold },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl, marginTop: 60 },
  listContainer: { padding: Spacing.lg, paddingBottom: 100 },
  
  card: { 
    backgroundColor: colors.surface, 
    borderRadius: BorderRadius.lg, 
    marginBottom: Spacing.lg, 
    borderWidth: 1, 
    borderColor: colors.border,
    ...(isDark ? {} : shadows.sm),
  },
  cardContent: { padding: Spacing.lg },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xs },
  turfName: { fontSize: 18, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary, flex: 1, marginRight: 8 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1 },
  statusText: { fontSize: 10, fontFamily: Typography.fontFamily.bold },
  address: { fontSize: 13, color: colors.textSecondary, fontFamily: Typography.fontFamily.medium, marginBottom: Spacing.md },
  
  detailsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.md },
  detailText: { fontSize: 14, color: colors.textPrimary, fontFamily: Typography.fontFamily.medium },
  
  slotsRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: Spacing.lg },
  slotsList: { flexDirection: 'row', flexWrap: 'wrap', marginLeft: Spacing.sm, flex: 1, gap: 6 },
  slotPill: { 
    backgroundColor: isDark ? colors.backgroundElevated : colors.surfaceVariant, 
    paddingHorizontal: 8, 
    paddingVertical: 4, 
    borderRadius: BorderRadius.sm, 
    color: colors.textPrimary, 
    fontFamily: Typography.fontFamily.medium, 
    fontSize: 12, 
    borderWidth: 1, 
    borderColor: colors.border 
  },

  footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: Spacing.md },
  amountLabel: { fontSize: 12, color: colors.textSecondary, fontFamily: Typography.fontFamily.medium },
  amountValue: { fontSize: 18, color: isDark ? colors.primary : colors.primaryDark, fontFamily: Typography.fontFamily.bold },
  cardReportBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: isDark ? colors.backgroundElevated : colors.surfaceVariant, 
    paddingHorizontal: 12, 
    paddingVertical: 6, 
    borderRadius: 16, 
    borderWidth: 1, 
    borderColor: colors.border, 
    gap: 4 
  },
  cardReportText: { fontSize: 12, color: isDark ? colors.primary : colors.primaryDark, fontFamily: Typography.fontFamily.bold },
  
  emptyTitle: { fontSize: 18, color: colors.textPrimary, fontFamily: Typography.fontFamily.bold, marginTop: Spacing.md },
  emptySub: { fontSize: 14, color: colors.textSecondary, fontFamily: Typography.fontFamily.medium, marginTop: Spacing.xs, textAlign: 'center' },
});

const BookingHistoryScreen = ({ navigation }) => {
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();
  const safeTop = Math.max(insets?.top || 0, Platform.OS === 'ios' ? 44 : 0);
  const { colors, shadows, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, shadows, isDark), [colors, shadows, isDark]);

  const { bookings, isLoading } = useSelector((state) => state.booking);
  
  const [activeTab, setActiveTab] = useState('Upcoming');
  const tabs = ['Upcoming', 'Completed', 'Cancelled', 'Requested Cancel'];
  const flatListRef = useRef(null);

  const handleTabPress = (index) => {
    setActiveTab(tabs[index]);
    flatListRef.current?.scrollToIndex({ index, animated: true });
  };

  const onMomentumScrollEnd = (e) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    if (tabs[index] && tabs[index] !== activeTab) {
      setActiveTab(tabs[index]);
    }
  };

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
      case 'confirmed': return colors.success;
      case 'pending': return colors.warning;
      case 'cancelled': return colors.error;
      case 'completed': return '#2196F3';
      default: return colors.textSecondary;
    }
  };

  const getFilteredBookings = (tab) => {
    return bookings.filter(b => {
      if (tab === 'Upcoming') return b.status === 'confirmed' || b.status === 'pending';
      if (tab === 'Completed') return b.status === 'completed';
      if (tab === 'Cancelled') return b.status === 'cancelled';
      if (tab === 'Requested Cancel') return b.status === 'cancellation_requested' || b.status === 'pending_refund';
      return true;
    });
  };

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
            <View style={[styles.statusBadge, { borderColor: getStatusColor(item.status), backgroundColor: getStatusColor(item.status) + '15' }]}>
              <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                {item.status.toUpperCase()}
              </Text>
            </View>
          </View>
          
          <Text style={styles.address} numberOfLines={1}>
            <Icon name="map-marker" size={14} color={colors.textSecondary} /> {turf.address || 'Address not available'}
          </Text>

          <View style={styles.detailsRow}>
            <Icon name="calendar" size={16} color={colors.primary} />
            <Text style={styles.detailText}>{dateStr}</Text>
          </View>

          <View style={styles.slotsRow}>
            <Icon name="clock-outline" size={16} color={colors.primary} style={{marginTop: 2}} />
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
              activeOpacity={0.7}
            >
              <Icon name="alert-circle-outline" size={16} color={colors.primary} />
              <Text style={styles.cardReportText}>Report Issue</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.safeArea, { paddingTop: safeTop }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.surface} />
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Bookings</Text>
        </View>

        {/* Tabs */}
        <View style={styles.tabsWrapper}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsContainer}>
            {tabs.map((tab, index) => (
              <TouchableOpacity
                key={tab}
                style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
                onPress={() => handleTabPress(index)}
                activeOpacity={0.8}
              >
                <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <FlatList
          ref={flatListRef}
          data={tabs}
          keyExtractor={(item) => item}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onMomentumScrollEnd}
          initialNumToRender={1}
          maxToRenderPerBatch={1}
          windowSize={3}
          getItemLayout={(data, index) => ({
            length: SCREEN_WIDTH,
            offset: SCREEN_WIDTH * index,
            index,
          })}
          onScrollToIndexFailed={(info) => {
            const wait = new Promise(resolve => setTimeout(resolve, 50));
            wait.then(() => {
              flatListRef.current?.scrollToIndex({ index: info.index, animated: true });
            });
          }}
          renderItem={({ item: tab }) => (
            <View style={{ width: SCREEN_WIDTH }}>
              <FlatList
                data={getFilteredBookings(tab)}
                keyExtractor={(item) => item._id}
                renderItem={renderItem}
                contentContainerStyle={styles.listContainer}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={isLoading} onRefresh={onRefresh} tintColor={colors.primary} />}
                ListEmptyComponent={
                  !isLoading && (
                    <View style={styles.center}>
                      <Icon name="ticket-confirmation-outline" size={64} color={colors.textTertiary} />
                      <Text style={styles.emptyTitle}>No {tab} Bookings</Text>
                      <Text style={styles.emptySub}>You don't have any {tab.toLowerCase()} bookings at the moment.</Text>
                    </View>
                  )
                }
              />
            </View>
          )}
        />
      </View>
    </View>
  );
};

export default BookingHistoryScreen;
