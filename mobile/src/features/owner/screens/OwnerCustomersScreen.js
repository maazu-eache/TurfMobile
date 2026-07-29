import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, ActivityIndicator, Platform, StatusBar } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import api from '../../../api/axios';
import { Colors, Typography, Spacing } from '../../../theme/theme';

const OwnerCustomersScreen = ({ navigation }) => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
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

  const filteredCustomers = customers.filter(c => {
    const q = searchQuery.toLowerCase();
    return (c.name || '').toLowerCase().includes(q) || (c.phone || '').includes(q) || (c.email || '').toLowerCase().includes(q);
  });

  const renderCustomerItem = ({ item }) => (
    <View style={styles.customerCard}>
      <View style={styles.customerAvatar}>
        <Text style={styles.avatarText}>
          {item.name ? item.name.charAt(0).toUpperCase() : '?'}
        </Text>
      </View>
      <View style={styles.customerInfo}>
        <Text style={styles.customerName}>{item.name}</Text>
        <View style={styles.contactRow}>
          {!!item.phone && (
            <View style={styles.contactItem}>
              <Icon name="phone" size={12} color={Colors.textTertiary} />
              <Text style={styles.contactText}>{item.phone}</Text>
            </View>
          )}
          {!!item.email && (
            <View style={styles.contactItem}>
              <Icon name="email" size={12} color={Colors.textTertiary} />
              <Text style={styles.contactText}>{item.email}</Text>
            </View>
          )}
        </View>
      </View>
      <View style={styles.statsContainer}>
        <View style={styles.revenueBox}>
          <Text style={styles.revenueLabel}>Revenue</Text>
          <Text style={styles.revenueValue}>₹{item.totalRevenue.toLocaleString()}</Text>
        </View>
        <View style={styles.bookingsBox}>
          <Text style={styles.bookingsText}>{item.totalBookings} Booking{item.totalBookings > 1 ? 's' : ''}</Text>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Customers</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Icon name="magnify" size={20} color={Colors.textTertiary} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, phone, or email..."
          placeholderTextColor={Colors.textTertiary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearBtn}>
            <Icon name="close-circle" size={18} color={Colors.textTertiary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredCustomers}
          keyExtractor={(item, index) => `${item.phone || item.email || item.name}-${index}`}
          renderItem={renderCustomerItem}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={() => (
            <View style={styles.emptyContainer}>
              <Icon name="account-search" size={48} color={Colors.border} />
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
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
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.textPrimary,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    margin: Spacing.md,
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 46,
    color: Colors.textPrimary,
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
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  customerAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.primaryAlpha20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 20,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.primary,
  },
  customerInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: 16,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  contactText: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginLeft: 4,
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
    color: Colors.textTertiary,
    fontFamily: Typography.fontFamily.medium,
    textTransform: 'uppercase',
  },
  revenueValue: {
    fontSize: 16,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.primary,
  },
  bookingsBox: {
    backgroundColor: Colors.surfaceVariant,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  bookingsText: {
    fontSize: 10,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.textSecondary,
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
    color: Colors.textTertiary,
    fontFamily: Typography.fontFamily.medium,
    textAlign: 'center',
  },
});

export default OwnerCustomersScreen;
