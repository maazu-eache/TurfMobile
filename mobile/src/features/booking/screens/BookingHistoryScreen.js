import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
  Dimensions,
  StatusBar,
  Platform,
} from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
import { useDispatch, useSelector } from 'react-redux';
import { fetchMyBookings } from '../bookingSlice';
import { useTheme, Typography } from '../../../theme/theme';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useFocusEffect } from '@react-navigation/native';
import { formatISTDateFull, formatISTTime } from '../../../utils/dateFormatter';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const TABS = [
  { id: 'Upcoming', label: 'Upcoming', icon: 'calendar-clock' },
  { id: 'Completed', label: 'Completed', icon: 'check-circle-outline' },
  { id: 'Cancelled', label: 'Cancelled', icon: 'close-circle-outline' },
  { id: 'Requested Cancel', label: 'Refunds', icon: 'history' },
];

const BookingHistoryScreen = ({ navigation }) => {
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();
  const safeTop = Math.max(insets?.top || 0, Platform.OS === 'ios' ? 44 : 0);
  const { colors, isDark } = useTheme();

  const { bookings = [], isLoading } = useSelector((state) => state.booking);
  
  const [activeTab, setActiveTab] = useState('Upcoming');
  const flatListRef = useRef(null);

  const handleTabPress = (index) => {
    setActiveTab(TABS[index].id);
    flatListRef.current?.scrollToIndex({ index, animated: true });
  };

  const onMomentumScrollEnd = (e) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    if (TABS[index] && TABS[index].id !== activeTab) {
      setActiveTab(TABS[index].id);
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

  const getStatusConfig = (status) => {
    switch (status) {
      case 'confirmed':
        return { color: colors.success || '#22C55E', label: 'Confirmed', icon: 'check-circle' };
      case 'pending':
        return { color: colors.warning || '#F59E0B', label: 'Pending', icon: 'clock-outline' };
      case 'cancelled':
        return { color: colors.error || '#EF4444', label: 'Cancelled', icon: 'close-circle' };
      case 'completed':
        return { color: '#3B82F6', label: 'Completed', icon: 'checkbox-marked-circle' };
      case 'cancellation_requested':
      case 'pending_refund':
        return { color: '#8B5CF6', label: 'Refund Requested', icon: 'alert-circle' };
      default:
        return { color: colors.textSecondary, label: (status || '').toUpperCase(), icon: 'information' };
    }
  };

  const getFilteredBookings = (tabId) => {
    return bookings.filter(b => {
      if (tabId === 'Upcoming') return b.status === 'confirmed' || b.status === 'pending';
      if (tabId === 'Completed') return b.status === 'completed';
      if (tabId === 'Cancelled') return b.status === 'cancelled';
      if (tabId === 'Requested Cancel') return b.status === 'cancellation_requested' || b.status === 'pending_refund';
      return true;
    });
  };

  const getTabCount = (tabId) => {
    return getFilteredBookings(tabId).length;
  };

  const renderItem = ({ item }) => {
    const turf = item.turf || {};
    const slots = item.slotsSnapshot || [];
    const dateStr = slots[0]?.date ? formatISTDateFull(slots[0].date) : 'Unknown Date';
    const statusCfg = getStatusConfig(item.status);

    return (
      <TouchableOpacity 
        style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
        activeOpacity={0.9}
        onPress={() => navigation.navigate('BookingDetail', { bookingId: item._id })}
      >
        {/* Card Top Accent Line */}
        <View style={[styles.cardAccentBar, { backgroundColor: statusCfg.color }]} />

        <View style={styles.cardContent}>
          {/* Header Row: Turf Name & Status Pill */}
          <View style={styles.cardHeader}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={[styles.turfName, { color: colors.textPrimary }]} numberOfLines={1}>
                {turf.name || 'Turf Venue'}
              </Text>
              {item.bookingRef ? (
                <Text style={[styles.refText, { color: colors.textTertiary }]}>
                  Ref: #{item.bookingRef}
                </Text>
              ) : null}
            </View>

            <View style={[styles.statusBadge, { borderColor: `${statusCfg.color}40`, backgroundColor: `${statusCfg.color}15` }]}>
              <Icon name={statusCfg.icon} size={12} color={statusCfg.color} style={{ marginRight: 4 }} />
              <Text style={[styles.statusText, { color: statusCfg.color }]}>
                {statusCfg.label}
              </Text>
            </View>
          </View>
          
          {/* Address Row */}
          <View style={styles.addressRow}>
            <Icon name="map-marker-outline" size={15} color={colors.primary} style={{ marginRight: 4 }} />
            <Text style={[styles.addressText, { color: colors.textSecondary }]} numberOfLines={1}>
              {turf.address || turf.city || 'Address not available'}
            </Text>
          </View>

          {/* Schedule Info Box */}
          <View style={[styles.scheduleBox, { backgroundColor: isDark ? colors.background : colors.surfaceVariant, borderColor: colors.border }]}>
            <View style={styles.scheduleRow}>
              <Icon name="calendar-month-outline" size={16} color={colors.primary} style={{ marginRight: 8 }} />
              <Text style={[styles.scheduleDate, { color: colors.textPrimary }]}>{dateStr}</Text>
            </View>

            <View style={styles.slotsRow}>
              <Icon name="clock-outline" size={16} color={colors.primary} style={{ marginRight: 8, marginTop: 3 }} />
              <View style={styles.slotsList}>
                {slots.map((slot, idx) => (
                  <View key={idx} style={[styles.slotPill, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Text style={[styles.slotPillText, { color: colors.textPrimary }]}>
                      {formatISTTime(slot.startTime)} – {formatISTTime(slot.endTime)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </View>

          {/* Footer Row: Amount & Actions */}
          <View style={[styles.footerRow, { borderTopColor: colors.border }]}>
            <View>
              <Text style={[styles.amountLabel, { color: colors.textSecondary }]}>Total Paid</Text>
              <Text style={[styles.amountValue, { color: colors.primary }]}>₹{item.finalAmount}</Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <TouchableOpacity 
                style={[styles.cardReportBtn, { borderColor: colors.border, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : colors.surfaceVariant }]}
                onPress={(e) => {
                  e.stopPropagation();
                  navigation.navigate('CreateTicketScreen', { bookingId: item.bookingRef });
                }}
                activeOpacity={0.75}
              >
                <Icon name="alert-circle-outline" size={15} color={colors.primary} />
                <Text style={[styles.cardReportText, { color: colors.primary }]}>Support</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.detailsBtn, { backgroundColor: colors.primary }]}
                onPress={() => navigation.navigate('BookingDetail', { bookingId: item._id })}
                activeOpacity={0.8}
              >
                <Text style={styles.detailsBtnText}>Details</Text>
                <Icon name="chevron-right" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.safeArea, { paddingTop: safeTop, backgroundColor: colors.surface }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.surface} />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header Bar */}
        <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <View>
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>My Bookings</Text>
            <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
              {bookings.length} total booking{bookings.length !== 1 ? 's' : ''}
            </Text>
          </View>
          <TouchableOpacity 
            style={[styles.headerIconBtn, { backgroundColor: isDark ? colors.background : colors.surfaceVariant }]} 
            onPress={onRefresh}
            activeOpacity={0.7}
          >
            <Icon name="refresh" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Tab Pills Bar */}
        <View style={[styles.tabsWrapper, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsContainer}>
            {TABS.map((tab, index) => {
              const isActive = activeTab === tab.id;
              const count = getTabCount(tab.id);
              return (
                <TouchableOpacity
                  key={tab.id}
                  style={[
                    styles.tabBtn,
                    isActive && [styles.tabBtnActive, { borderBottomColor: colors.primary }],
                  ]}
                  onPress={() => handleTabPress(index)}
                  activeOpacity={0.8}
                >
                  <Icon
                    name={tab.icon}
                    size={16}
                    color={isActive ? colors.primary : colors.textSecondary}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={[styles.tabText, { color: colors.textSecondary }, isActive && [styles.tabTextActive, { color: colors.primary }]]}>
                    {tab.label}
                  </Text>
                  {count > 0 && (
                    <View style={[styles.tabBadge, { backgroundColor: isActive ? colors.primary : colors.border }]}>
                      <Text style={[styles.tabBadgeText, { color: isActive ? '#FFFFFF' : colors.textSecondary }]}>
                        {count}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Horizontal Swipe Pages */}
        <FlatList
          ref={flatListRef}
          data={TABS}
          keyExtractor={(item) => item.id}
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
          renderItem={({ item: tabObj }) => {
            const filteredData = getFilteredBookings(tabObj.id);
            return (
              <View style={{ width: SCREEN_WIDTH }}>
                <FlatList
                  data={filteredData}
                  keyExtractor={(item) => item._id}
                  renderItem={renderItem}
                  contentContainerStyle={styles.listContainer}
                  showsVerticalScrollIndicator={false}
                  refreshControl={<RefreshControl refreshing={isLoading} onRefresh={onRefresh} tintColor={colors.primary} />}
                  ListEmptyComponent={
                    !isLoading && (
                      <View style={styles.emptyContainer}>
                        <View style={[styles.emptyIconCircle, { backgroundColor: isDark ? colors.backgroundElevated || 'rgba(255,255,255,0.08)' : colors.surfaceVariant }]}>
                          <Icon name={tabObj.icon} size={44} color={colors.primary} />
                        </View>
                        <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No {tabObj.label} Bookings</Text>
                        <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
                          You don't have any {tabObj.label.toLowerCase()} turf bookings right now.
                        </Text>
                        <TouchableOpacity
                          style={[styles.emptyCtaBtn, { backgroundColor: colors.primary }]}
                          onPress={() => navigation.navigate('Search', { screen: 'SearchMain' })}
                          activeOpacity={0.85}
                        >
                          <Icon name="magnify" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                          <Text style={styles.emptyCtaText}>Explore & Book Turfs</Text>
                        </TouchableOpacity>
                      </View>
                    )
                  }
                />
              </View>
            );
          }}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: Typography.fontFamily.bold,
  },
  headerSubtitle: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.regular,
    marginTop: 2,
  },
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabsWrapper: {
    borderBottomWidth: 1,
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 8,
  },
  tabBtn: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: {
    borderBottomColor: '#FFCC00',
  },
  tabText: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: 14,
  },
  tabTextActive: {
    fontFamily: Typography.fontFamily.bold,
  },
  tabBadge: {
    marginLeft: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  tabBadgeText: {
    fontSize: 10,
    fontFamily: Typography.fontFamily.bold,
  },
  listContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  card: {
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  cardAccentBar: {
    height: 4,
    width: '100%',
  },
  cardContent: {
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  turfName: {
    fontSize: 17,
    fontFamily: Typography.fontFamily.bold,
  },
  refText: {
    fontSize: 11,
    fontFamily: Typography.fontFamily.regular,
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 11,
    fontFamily: Typography.fontFamily.bold,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  addressText: {
    fontSize: 13,
    fontFamily: Typography.fontFamily.medium,
  },
  scheduleBox: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  scheduleDate: {
    fontSize: 14,
    fontFamily: Typography.fontFamily.semiBold,
  },
  slotsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  slotsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    flex: 1,
    gap: 6,
  },
  slotPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  slotPillText: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.medium,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: 12,
  },
  amountLabel: {
    fontSize: 11,
    fontFamily: Typography.fontFamily.regular,
  },
  amountValue: {
    fontSize: 18,
    fontFamily: Typography.fontFamily.bold,
  },
  cardReportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    gap: 4,
  },
  cardReportText: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.semiBold,
  },
  detailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    gap: 2,
  },
  detailsBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: Typography.fontFamily.bold,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    marginTop: 40,
  },
  emptyIconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: Typography.fontFamily.bold,
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 13,
    fontFamily: Typography.fontFamily.regular,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 24,
  },
  emptyCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
  },
  emptyCtaText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: Typography.fontFamily.bold,
  },
});

export default BookingHistoryScreen;
