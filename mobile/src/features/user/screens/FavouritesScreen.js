import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme, Typography, Spacing, BorderRadius } from '../../../theme/theme';
import api, { getImageUrl } from '../../../api/axios';
import SkeletonPlaceholder from 'react-native-skeleton-placeholder';

const createStyles = (colors, shadows, isDark) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.surface },
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    ...(isDark ? {} : shadows.xs),
  },
  backBtn: { padding: 4, marginRight: Spacing.md },
  headerTitle: { fontSize: Typography.fontSize['2xl'], fontFamily: Typography.fontFamily.bold, color: colors.textPrimary },
  
  listContainer: { padding: Spacing.xl, paddingBottom: 100, gap: 14 },
  
  listCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 10,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    ...(isDark ? {} : shadows.sm),
  },
  listCardImgWrap: { width: 90, height: 90, borderRadius: 12, overflow: 'hidden' },
  listCardImg: { width: '100%', height: '100%' },
  favBtnCompact: { position: 'absolute', top: 6, right: 6, width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,71,87,0.2)', alignItems: 'center', justifyContent: 'center' },
  listCardBody: { flex: 1, justifyContent: 'center' },
  listCardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  listCardTitle: { color: colors.textPrimary, fontFamily: Typography.fontFamily.bold, fontSize: 15, flex: 1, marginRight: 8 },
  badgeVerifiedCompact: { backgroundColor: colors.primary, borderRadius: 10, padding: 3 },
  listCardMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 12 },
  listCardMeta: { color: colors.textSecondary, fontFamily: Typography.fontFamily.medium, fontSize: 11 },
  listCardDot: { color: colors.textTertiary, fontSize: 10 },
  listCardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  priceTagCompact: { flexDirection: 'row', alignItems: 'baseline' },
  priceAmountCompact: { color: colors.textPrimary, fontFamily: Typography.fontFamily.bold, fontSize: 14 },
  priceUnitCompact: { color: colors.textSecondary, fontSize: 10, marginLeft: 2 },
  badgeTrustCompact: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  badgeTextCompact: { color: colors.textOnPrimary, fontFamily: Typography.fontFamily.bold, fontSize: 9 },

  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing['2xl'] },
  emptyTitle: { color: colors.textPrimary, fontFamily: Typography.fontFamily.bold, fontSize: Typography.fontSize.xl, marginTop: Spacing.lg, marginBottom: 8 },
  emptyDesc: { color: colors.textSecondary, fontFamily: Typography.fontFamily.medium, fontSize: Typography.fontSize.md, textAlign: 'center', marginBottom: Spacing.xl },
  exploreBtn: { backgroundColor: colors.primary, paddingHorizontal: Spacing.xl, paddingVertical: 12, borderRadius: 100, ...shadows.md },
  exploreBtnText: { color: colors.textOnPrimary, fontFamily: Typography.fontFamily.bold, fontSize: Typography.fontSize.md },
});

const FavouritesScreen = ({ navigation }) => {
  const { colors, shadows, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, shadows, isDark), [colors, shadows, isDark]);

  const [favourites, setFavourites] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isPaginating, setIsPaginating] = useState(false);

  useEffect(() => {
    fetchFavourites(1);
  }, []);

  const fetchFavourites = async (pageNum = 1) => {
    try {
      if (pageNum === 1) setIsLoading(true);
      else setIsPaginating(true);
      
      const res = await api.get(`/users/favourites?page=${pageNum}&limit=10`);
      const newItems = res.data.data || [];
      
      if (pageNum === 1) {
        setFavourites(newItems);
      } else {
        setFavourites(prev => [...prev, ...newItems]);
      }
      setHasMore(newItems.length >= 10);
    } catch (e) {
      console.log('Failed to fetch favourites', e);
    } finally {
      setIsLoading(false);
      setIsPaginating(false);
    }
  };

  const handleLoadMore = () => {
    if (!isLoading && !isPaginating && hasMore && favourites.length >= 10) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchFavourites(nextPage);
    }
  };

  const getMinPrice = (pricing) => {
    if (!pricing) return 0;
    const p = [pricing.weekdayDay, pricing.weekdayNight, pricing.weekendDay, pricing.weekendNight].filter(x => x > 0);
    return p.length ? Math.min(...p) : 0;
  };

  const renderTurf = ({ item }) => {
    const minPrice = getMinPrice(item.pricing);
    const trustScore = item.owner?.trustScore || item.ownerInfo?.trustScore;
    const isVerified = item.isVerified || item.owner?.isVerifiedOwner || item.ownerInfo?.isVerifiedOwner;

    return (
      <TouchableOpacity 
        style={styles.listCard} 
        activeOpacity={0.9} 
        onPress={() => navigation.navigate('TurfDetail', { id: item._id })}
      >
        <View style={styles.listCardImgWrap}>
          <Image source={{ uri: getImageUrl(item.coverImage) }} style={styles.listCardImg} />
          <TouchableOpacity 
            style={styles.favBtnCompact}
            onPress={async () => {
              // Optimistic UI removal
              setFavourites(prev => prev.filter(t => t._id !== item._id));
              try {
                await api.post(`/users/favourites/${item._id}`);
              } catch (e) {
                console.log('Failed to toggle favourite');
                fetchFavourites(1);
              }
            }}
          >
            <Icon name="heart" size={14} color="#FF4757" />
          </TouchableOpacity>
        </View>

        <View style={styles.listCardBody}>
          <View style={styles.listCardRow}>
            <Text style={styles.listCardTitle} numberOfLines={1}>{item.name}</Text>
            {isVerified && (
              <View style={styles.badgeVerifiedCompact}>
                <Icon name="check-decagram" size={10} color={colors.textOnPrimary} />
              </View>
            )}
          </View>

          <View style={styles.listCardMetaRow}>
            <Icon name="map-marker" size={12} color={colors.textTertiary} />
            <Text style={styles.listCardMeta} numberOfLines={1}>{item.city || item.locationObj?.name || 'Local'}</Text>
            <Text style={styles.listCardDot}>•</Text>
            <Icon name="star" size={12} color={colors.primary} />
            <Text style={styles.listCardMeta}>{item.rating > 0 ? item.rating.toFixed(1) : 'New'}</Text>
          </View>

          <View style={styles.listCardBottom}>
            <View style={styles.priceTagCompact}>
              <Text style={styles.priceAmountCompact}>₹{minPrice}</Text>
              <Text style={styles.priceUnitCompact}>/hr</Text>
            </View>
            {trustScore !== undefined && (
              <View style={[styles.badgeTrustCompact, { backgroundColor: trustScore >= 80 ? '#2ED573' : colors.warning }]}>
                <Icon name="shield-star" size={10} color="#000" />
                <Text style={styles.badgeTextCompact}>{trustScore}% Trust</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderSkeleton = () => (
    <SkeletonPlaceholder 
      backgroundColor={isDark ? colors.backgroundElevated : colors.surfaceVariant} 
      highlightColor={isDark ? colors.surfaceVariant : colors.surface}
    >
      <View style={{ gap: 14 }}>
        {[1, 2, 3, 4, 5, 6].map(i => (
          <View key={i} style={{ flexDirection: 'row', borderRadius: 16, padding: 10, gap: 12, borderWidth: 1, borderColor: colors.border }}>
            <View style={{ width: 90, height: 90, borderRadius: 12 }} />
            <View style={{ flex: 1, justifyContent: 'center', gap: 12 }}>
              <View style={{ width: '70%', height: 16, borderRadius: 4 }} />
              <View style={{ width: '50%', height: 12, borderRadius: 4 }} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                 <View style={{ width: '30%', height: 14, borderRadius: 4 }} />
                 <View style={{ width: '20%', height: 12, borderRadius: 4 }} />
              </View>
            </View>
          </View>
        ))}
      </View>
    </SkeletonPlaceholder>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.surface} />
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Icon name="arrow-left" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Favourites</Text>
        </View>

        {isLoading ? (
          <View style={styles.listContainer}>
            {renderSkeleton()}
          </View>
        ) : favourites.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Icon name="heart-broken" size={60} color={colors.border} />
            <Text style={styles.emptyTitle}>No Favourites Yet</Text>
            <Text style={styles.emptyDesc}>Turfs you mark as favourite will appear here.</Text>
            <TouchableOpacity style={styles.exploreBtn} onPress={() => navigation.navigate('Home')} activeOpacity={0.85}>
              <Text style={styles.exploreBtnText}>Explore Turfs</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={favourites}
            keyExtractor={(item, idx) => item._id + idx}
            renderItem={renderTurf}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.5}
            ListFooterComponent={isPaginating && <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 20 }} />}
          />
        )}
      </View>
    </SafeAreaView>
  );
};

export default FavouritesScreen;
