import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Animated,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors, Typography, BorderRadius } from '../../../theme/theme';
import api from '../../../api/axios';
import { showCustomAlert } from '../../../components/CustomAlert';

// ─── Sub-components ──────────────────────────────────────────────────────────

const SummaryStatCard = ({ icon, label, value, color, bg }) => (
  <View style={[styles.statCard, { backgroundColor: bg }]}>
    <View style={[styles.statIconBox, { backgroundColor: color + '22' }]}>
      <Icon name={icon} size={20} color={color} />
    </View>
    <Text style={[styles.statValue, { color }]}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const PlayerCard = ({ item, index }) => {
  const isOnline = item.registrationType === 'online';
  return (
    <View style={styles.playerCard}>
      <View style={styles.playerCardLeft}>
        <View style={[styles.avatar, { backgroundColor: isOnline ? Colors.primary + '33' : Colors.primary + '33' }]}>
          <Text style={[styles.avatarText, { color: isOnline ? Colors.primary : Colors.primary }]}>
            {item.fullName.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.playerInfo}>
          <Text style={styles.playerName} numberOfLines={1}>{item.fullName}</Text>
          <View style={styles.playerMeta}>
            <View style={[styles.rolePill, { backgroundColor: Colors.primary + '22' }]}>
              <Text style={[styles.rolePillText, { color: Colors.primary }]}>{item.role}</Text>
            </View>
            {item.receiptId && (
              <Text style={styles.receiptText}>{item.receiptId}</Text>
            )}
          </View>
        </View>
      </View>
      <View style={styles.playerCardRight}>
        <Text style={styles.playerFee}>₹{(item.registrationFee || 0).toLocaleString()}</Text>
        {item.platformFee > 0 && (
          <Text style={styles.playerDeduction}>- ₹{(item.platformFee || 0).toLocaleString()} fee</Text>
        )}
        <View style={styles.paidBadge}>
          <Icon name="check-circle" size={10} color="#059669" />
          <Text style={styles.paidText}>Paid</Text>
        </View>
      </View>
    </View>
  );
};

const SectionHeader = ({ icon, title, count, color, bg }) => (
  <View style={[styles.sectionHeader, { backgroundColor: bg }]}>
    <View style={styles.sectionHeaderLeft}>
      <View style={[styles.sectionIconBox, { backgroundColor: color + '33' }]}>
        <Icon name={icon} size={16} color={color} />
      </View>
      <Text style={[styles.sectionTitle, { color }]}>{title}</Text>
    </View>
    <View style={[styles.sectionCountBadge, { backgroundColor: color + '22' }]}>
      <Text style={[styles.sectionCount, { color }]}>{count} players</Text>
    </View>
  </View>
);

// ─── Main Component ───────────────────────────────────────────────────────────

const AuctionFinanceTab = ({ auctionId, navigation }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [financeData, setFinanceData] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'online' | 'offline'
  const [isUnauthorized, setIsUnauthorized] = useState(false);
  const scaleAnim = useState(new Animated.Value(0))[0];

  useEffect(() => {
    loadFinanceData();
  }, [auctionId]);

  const animateIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 6,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };

  const loadFinanceData = async (isRefresh = false) => {
    if (!auctionId || auctionId === 'undefined') {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setIsUnauthorized(false);
      const res = await api.get(`/auctions/${auctionId}/finance`);
      if (res.data.success) {
        setFinanceData(res.data.data);
        animateIn();
      } else {
        showCustomAlert('Error', res.data.message || 'Failed to load finance data');
      }
    } catch (error) {
      if (error?.response?.status === 403 || error?.response?.status === 401 || error?.response?.data?.message === 'Unauthorized') {
        setIsUnauthorized(true);
      } else {
        showCustomAlert('Error', error?.response?.data?.message || 'Failed to load finance data');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fmt = (amount) => `₹${Number(amount || 0).toLocaleString()}`;

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loaderText}>Loading Finance...</Text>
      </View>
    );
  }

  if (isUnauthorized) {
    return (
      <View style={[styles.emptyContainer, { paddingHorizontal: 24, paddingVertical: 40 }]}>
        <Icon name="shield-lock-outline" size={56} color={Colors.primary} />
        <Text style={[styles.emptyTitle, { textAlign: 'center', lineHeight: 22 }]}>Only organisers will handle this section</Text>
      </View>
    );
  }

  if (!financeData) {
    return (
      <View style={styles.emptyContainer}>
        <Icon name="alert-circle-outline" size={56} color={Colors.textTertiary} />
        <Text style={styles.emptyTitle}>No Finance Data</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => loadFinanceData()}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { summary, registrations } = financeData;
  const onlinePlayers = registrations.filter(r => r.registrationType === 'online');
  const offlinePlayers = registrations.filter(r => r.registrationType === 'offline' || !r.registrationType);

  const onlineTotal = onlinePlayers.reduce((s, r) => s + (r.registrationFee || 0), 0);
  const offlineTotal = offlinePlayers.reduce((s, r) => s + (r.registrationFee || 0), 0);

  const filteredPlayers =
    activeFilter === 'online' ? onlinePlayers
    : activeFilter === 'offline' ? offlinePlayers
    : registrations;

  const renderHeader = () => (
    <View>
      {/* ── Hero Balance Card ── */}
      <Animated.View style={[styles.heroCard, { transform: [{ scale: scaleAnim }] }]}>
        <View style={styles.heroTop}>
          <View style={styles.heroIcon}>
            <Icon name="wallet" size={24} color={Colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroLabel}>Available Wallet Balance</Text>
            <Text style={styles.heroBalance}>{fmt(summary.walletBalance)}</Text>
          </View>
          <TouchableOpacity
            style={styles.withdrawBtn}
            onPress={() => navigation.navigate('Profile', { screen: 'Wallet' })}
          >
            <Icon name="bank-transfer-out" size={16} color={Colors.secondary} />
            <Text style={styles.withdrawBtnText}>Withdraw</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.heroDivider} />

        {/* Stat Row */}
        <View style={styles.heroStats}>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>{fmt(summary.totalCollected)}</Text>
            <Text style={styles.heroStatLabel}>Gross Collected</Text>
          </View>
          <View style={styles.heroStatDivider} />
          <View style={styles.heroStat}>
            <Text style={[styles.heroStatValue, { color: '#EF4444' }]}>-{fmt(summary.totalPlatformFee)}</Text>
            <Text style={styles.heroStatLabel}>Platform Fee (10%)</Text>
          </View>
          <View style={styles.heroStatDivider} />
          <View style={styles.heroStat}>
            <Text style={[styles.heroStatValue, { color: '#10B981' }]}>{fmt(summary.totalNetEarnings)}</Text>
            <Text style={styles.heroStatLabel}>Net Earnings</Text>
          </View>
        </View>
      </Animated.View>

      {/* ── Registration Type Summary ── */}
      <View style={styles.typeSummaryRow}>
        <View style={[styles.typeSummaryCard, { borderColor: Colors.primary + '66' }]}>
          <View style={[styles.typeSummaryIcon, { backgroundColor: Colors.primary + '22' }]}>
            <Icon name="wifi" size={18} color={Colors.primary} />
          </View>
          <Text style={styles.typeSummaryCount}>{onlinePlayers.length}</Text>
          <Text style={styles.typeSummaryLabel}>Online</Text>
          <Text style={[styles.typeSummaryAmt, { color: Colors.primary }]}>{fmt(onlineTotal)}</Text>
        </View>

        <View style={styles.typeSummaryVs}>
          <Text style={styles.vsText}>+</Text>
        </View>

        <View style={[styles.typeSummaryCard, { borderColor: Colors.primary + '66' }]}>
          <View style={[styles.typeSummaryIcon, { backgroundColor: Colors.primary + '22' }]}>
            <Icon name="pencil-plus" size={18} color={Colors.primary} />
          </View>
          <Text style={styles.typeSummaryCount}>{offlinePlayers.length}</Text>
          <Text style={styles.typeSummaryLabel}>Offline</Text>
          <Text style={[styles.typeSummaryAmt, { color: Colors.primary }]}>{fmt(offlineTotal)}</Text>
        </View>
      </View>

      {/* ── Filter Pills ── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
        {[
          { id: 'all', label: `All (${registrations.length})`, icon: 'account-group' },
          { id: 'online', label: `Online (${onlinePlayers.length})`, icon: 'wifi' },
          { id: 'offline', label: `Offline (${offlinePlayers.length})`, icon: 'pencil-plus' },
        ].map(f => (
          <TouchableOpacity
            key={f.id}
            style={[styles.filterPill, activeFilter === f.id && styles.filterPillActive]}
            onPress={() => setActiveFilter(f.id)}
          >
            <Icon name={f.icon} size={13} color={activeFilter === f.id ? Colors.secondary : Colors.textSecondary} />
            <Text style={[styles.filterPillText, activeFilter === f.id && styles.filterPillTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── Section header ── */}
      {activeFilter === 'all' && onlinePlayers.length > 0 && offlinePlayers.length > 0 ? (
        <SectionHeader
          icon="wifi"
          title="Online Registrations"
          count={onlinePlayers.length}
          color={Colors.primary}
          bg={Colors.primary + '11'}
        />
      ) : activeFilter === 'online' ? (
        <SectionHeader
          icon="wifi"
          title="Online Registrations"
          count={onlinePlayers.length}
          color={Colors.primary}
          bg={Colors.primary + '11'}
        />
      ) : activeFilter === 'offline' ? (
        <SectionHeader
          icon="pencil-plus"
          title="Offline Registrations"
          count={offlinePlayers.length}
          color={Colors.primary}
          bg={Colors.primary + '11'}
        />
      ) : null}
    </View>
  );

  const renderFooter = () => {
    if (activeFilter === 'all' && offlinePlayers.length > 0) {
      return (
        <View>
          {onlinePlayers.length > 0 && offlinePlayers.length > 0 && (
            <SectionHeader
              icon="pencil-plus"
              title="Offline Registrations"
              count={offlinePlayers.length}
              color={Colors.primary}
              bg={Colors.primary + '11'}
            />
          )}
          {offlinePlayers.map((item, i) => (
            <PlayerCard key={item._id || i} item={item} index={i} />
          ))}
          <View style={styles.listEnd}>
            <View style={styles.listEndLine} />
            <Icon name="check-all" size={16} color={Colors.textTertiary} />
            <View style={styles.listEndLine} />
          </View>
        </View>
      );
    }
    return (
      <View style={styles.listEnd}>
        <View style={styles.listEndLine} />
        <Icon name="check-all" size={16} color={Colors.textTertiary} />
        <View style={styles.listEndLine} />
      </View>
    );
  };

  // For 'all' mode we show only online players via FlatList, offline rendered in footer
  const listData =
    activeFilter === 'all' ? onlinePlayers
    : filteredPlayers;

  return (
    <FlatList
      data={listData}
      keyExtractor={(item, i) => item._id || String(i)}
      renderItem={({ item, index }) => <PlayerCard item={item} index={index} />}
      ListHeaderComponent={renderHeader}
      ListFooterComponent={renderFooter}
      ListEmptyComponent={() =>
        activeFilter !== 'all' ? (
          <View style={styles.emptySection}>
            <Icon name={activeFilter === 'online' ? 'wifi-off' : 'pencil-off'} size={40} color={Colors.textTertiary} />
            <Text style={styles.emptySectionText}>
              No {activeFilter} registrations yet.
            </Text>
          </View>
        ) : null
      }
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => loadFinanceData(true)} tintColor={Colors.primary} />
      }
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
    />
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  loaderText: {
    marginTop: 12,
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.medium,
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    gap: 12,
  },
  emptyTitle: {
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: 16,
  },
  retryBtn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
  },
  retryText: {
    color: Colors.secondary,
    fontFamily: Typography.fontFamily.bold,
    fontSize: 14,
  },

  // ── Hero Card ──
  heroCard: {
    margin: 16,
    marginBottom: 12,
    backgroundColor: Colors.backgroundCard,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.primary + '33',
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: Colors.primary + '22',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroLabel: {
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.medium,
    fontSize: 12,
    marginBottom: 2,
  },
  heroBalance: {
    color: Colors.primary,
    fontFamily: Typography.fontFamily.bold,
    fontSize: 28,
    letterSpacing: -0.5,
  },
  withdrawBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
  },
  withdrawBtnText: {
    color: Colors.secondary,
    fontFamily: Typography.fontFamily.bold,
    fontSize: 13,
  },
  heroDivider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginVertical: 16,
  },
  heroStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  heroStat: {
    flex: 1,
    alignItems: 'center',
  },
  heroStatValue: {
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.bold,
    fontSize: 15,
    marginBottom: 3,
  },
  heroStatLabel: {
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.medium,
    fontSize: 10,
    textAlign: 'center',
  },
  heroStatDivider: {
    width: 1,
    height: 32,
    backgroundColor: Colors.border,
    alignSelf: 'center',
  },

  // ── Type Summary ──
  typeSummaryRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 12,
    alignItems: 'center',
    gap: 8,
  },
  typeSummaryCard: {
    flex: 1,
    backgroundColor: Colors.backgroundCard,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    alignItems: 'center',
    gap: 4,
  },
  typeSummaryIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  typeSummaryCount: {
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.bold,
    fontSize: 22,
  },
  typeSummaryLabel: {
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.medium,
    fontSize: 11,
  },
  typeSummaryAmt: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: 14,
    marginTop: 2,
  },
  typeSummaryVs: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.backgroundElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  vsText: {
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.bold,
    fontSize: 16,
  },

  // ── Filter Pills ──
  filterRow: {
    flexGrow: 0,
    marginBottom: 12,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.backgroundElevated,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterPillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterPillText: {
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: 12,
  },
  filterPillTextActive: {
    color: Colors.secondary,
  },

  // ── Section Header ──
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginBottom: 10,
    marginTop: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionIconBox: {
    width: 30,
    height: 30,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: 14,
  },
  sectionCountBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  sectionCount: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: 12,
  },

  // ── Player Card ──
  listContent: {
    paddingBottom: 30,
  },
  playerCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  playerCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontFamily: Typography.fontFamily.bold,
  },
  playerInfo: {
    flex: 1,
    gap: 5,
  },
  playerName: {
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: 15,
  },
  playerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  rolePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  rolePillText: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: 10,
  },
  receiptText: {
    color: Colors.textTertiary,
    fontFamily: Typography.fontFamily.medium,
    fontSize: 10,
  },
  playerCardRight: {
    alignItems: 'flex-end',
    gap: 3,
  },
  playerFee: {
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.bold,
    fontSize: 16,
  },
  playerDeduction: {
    color: '#EF4444',
    fontFamily: Typography.fontFamily.medium,
    fontSize: 11,
  },
  paidBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#059669' + '22',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 2,
  },
  paidText: {
    color: '#059669',
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: 10,
  },

  // ── Empty / Footer ──
  emptySection: {
    alignItems: 'center',
    padding: 32,
    gap: 10,
  },
  emptySectionText: {
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.medium,
    fontSize: 14,
  },
  listEnd: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 24,
    marginTop: 16,
    marginBottom: 8,
    gap: 8,
  },
  listEndLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },

  // ── Stat cards (unused now but kept) ──
  statCard: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    gap: 4,
  },
  statIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statValue: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: 16,
  },
  statLabel: {
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.medium,
    fontSize: 10,
    textAlign: 'center',
  },
});

export default AuctionFinanceTab;
