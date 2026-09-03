import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, ActivityIndicator, Platform, StatusBar, Image, RefreshControl } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import api, { getImageUrl } from '../../../api/axios';
import { Typography, Spacing } from '../../../theme/theme';
import { useTheme } from '../../../theme/ThemeContext';

const OwnerCustomersScreen = ({ navigation }) => {
  const { colors, isDark, shadows } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark, shadows), [colors, isDark, shadows]);

  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const res = await api.get('/bookings/owner/customers?limit=100');
      if (res.data.data) {
        setCustomers(res.data.data);
      }
    } catch (err) {
      console.error('Error fetching owner customers:', err);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    try {
      setRefreshing(true);
      const res = await api.get('/bookings/owner/customers?limit=100');
      if (res.data.data) {
        setCustomers(res.data.data);
      }
    } catch (err) {
      console.error('Error refreshing owner customers:', err);
    } finally {
      setRefreshing(false);
    }
  };

  const filteredCustomers = customers.filter(c => {
    const q = searchQuery.toLowerCase();
    return (c.name || '').toLowerCase().includes(q) || (c.phone || '').includes(q) || (c.email || '').toLowerCase().includes(q);
  });

  const renderCustomerItem = ({ item }) => (
    <View style={styles.customerCard}>
      <View style={styles.customerAvatar}>
        {item.photo ? (
          <Image
            source={{ uri: getImageUrl(item.photo) }}
            style={styles.avatarImage}
            resizeMode="cover"
          />
        ) : (
          <Text style={styles.avatarText}>
            {item.name ? item.name.charAt(0).toUpperCase() : '?'}
          </Text>
        )}
      </View>
      <View style={styles.customerInfo}>
        <Text style={styles.customerName}>{item.name}</Text>
        <View style={styles.contactRow}>
          {!!item.phone && (
            <View style={styles.contactItem}>
              <Icon name="phone" size={12} color={colors.textTertiary} />
              <Text style={styles.contactText} numberOfLines={1} ellipsizeMode="tail">{item.phone}</Text>
            </View>
          )}
          {!!item.email && (
            <View style={styles.contactItem}>
              <Icon name="email" size={12} color={colors.textTertiary} />
              <Text style={styles.contactText} numberOfLines={1} ellipsizeMode="tail">{item.email}</Text>
            </View>
          )}
        </View>
      </View>
      <View style={styles.statsContainer}>
        <View style={styles.revenueBox}>
          <Text style={styles.revenueLabel}>Revenue</Text>
          <Text style={styles.revenueValue}>₹{item.totalRevenue.toLocaleString()}</Text>
        </View>
        <Text style={styles.bookingsText}>
          {item.totalBookings} Booking{item.totalBookings > 1 ? 's' : ''}
          {item.totalSlots ? ` (${item.totalSlots} Slot${item.totalSlots > 1 ? 's' : ''})` : ''}
        </Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.surface} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <Icon name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Customers</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Icon name="magnify" size={20} color={colors.textTertiary} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, phone, or email..."
          placeholderTextColor={colors.textTertiary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearBtn} activeOpacity={0.7}>
            <Icon name="close-circle" size={18} color={colors.textTertiary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredCustomers}
          keyExtractor={(item, index) => `${item.phone || item.email || item.name}-${index}`}
          renderItem={renderCustomerItem}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={() => (
            <View style={styles.emptyContainer}>
              <Icon name="account-search" size={48} color={colors.border} />
              <Text style={styles.emptyText}>
                {searchQuery ? 'No customers found matching your search.' : 'No customers found yet.'}
              </Text>
            </View>
          )}
        />
      )}
    </View>
  );
};

const createStyles = (colors, isDark, shadows) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
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
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceVariant,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: Typography.fontFamily.bold,
    color: colors.textPrimary,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    margin: Spacing.md,
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 46,
    color: colors.textPrimary,
    fontFamily: Typography.fontFamily.regular,
  },
  clearBtn: {
    padding: 4,
  },
  listContainer: {
    padding: Spacing.md,
    paddingTop: 0,
    paddingBottom: 40,
  },
  customerCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.small,
  },
  customerAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: isDark ? 'rgba(255, 204, 0, 0.15)' : '#FFF9DB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 20,
    fontFamily: Typography.fontFamily.bold,
    color: isDark ? colors.primary : colors.primaryDark,
  },
  avatarImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  customerInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: 16,
    fontFamily: Typography.fontFamily.semiBold,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  contactRow: {
    gap: 4,
    marginTop: 4,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  contactText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginLeft: 4,
    flexShrink: 1,
  },
  statsContainer: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  revenueBox: {
    alignItems: 'flex-end',
    marginBottom: 6,
  },
  revenueLabel: {
    fontSize: 10,
    color: colors.textTertiary,
    fontFamily: Typography.fontFamily.medium,
    textTransform: 'uppercase',
  },
  revenueValue: {
    fontSize: 16,
    fontFamily: Typography.fontFamily.bold,
    color: isDark ? colors.primary : colors.primaryDark,
  },
  bookingsBox: {
    backgroundColor: colors.surfaceVariant,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  bookingsText: {
    fontSize: 10,
    fontFamily: Typography.fontFamily.medium,
    color: colors.textSecondary,
  },
  loaderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    padding: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    color: colors.textTertiary,
    fontFamily: Typography.fontFamily.medium,
    textAlign: 'center',
  },
});

export default OwnerCustomersScreen;
