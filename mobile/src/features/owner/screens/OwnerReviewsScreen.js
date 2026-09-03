import React, { useEffect, useState, useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Image, StatusBar } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Typography, Spacing, BorderRadius } from '../../../theme/theme';
import { useTheme } from '../../../theme/ThemeContext';
import api, { getImageUrl } from '../../../api/axios';

const OwnerReviewsScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark, shadows } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark, shadows), [colors, isDark, shadows]);

  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReviews();
  }, []);

  const fetchReviews = async () => {
    try {
      const res = await api.get('/reviews/owner/me');
      setReviews(res.data.data || []);
    } catch (e) {
      console.log('Failed to fetch owner reviews', e);
    } finally {
      setLoading(false);
    }
  };

  const renderReview = ({ item }) => (
    <View style={styles.reviewCard}>
      <View style={styles.reviewHeader}>
        <View style={styles.turfBadge}>
          <Icon name="soccer-field" size={14} color={isDark ? colors.primary : colors.primaryDark} />
          <Text style={styles.turfName}>{item.turf?.name || 'Turf'}</Text>
        </View>
        <View style={styles.ratingBadge}>
          <Icon name="star" size={14} color="#000" />
          <Text style={styles.ratingText}>{item.rating}</Text>
        </View>
      </View>
      
      <View style={styles.userRow}>
        <Image source={{ uri: getImageUrl(item.user?.photo) }} style={styles.avatar} />
        <Text style={styles.userName}>{item.user?.name || 'Customer'}</Text>
      </View>

      {item.comment ? (
        <Text style={styles.commentText}>{item.comment}</Text>
      ) : (
        <Text style={[styles.commentText, { fontStyle: 'italic', color: colors.textTertiary }]}>No comment provided.</Text>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.surface} />

      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <Icon name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Turf Reviews</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={reviews}
          keyExtractor={(item) => item._id}
          renderItem={renderReview}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Icon name="star-off" size={48} color={colors.textTertiary} />
              <Text style={styles.emptyTitle}>No reviews yet</Text>
              <Text style={styles.emptyDesc}>When customers rate your turfs, they will appear here.</Text>
            </View>
          }
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
    padding: Spacing.xl,
    paddingBottom: Spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: Typography.fontSize.xl, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary },
  backBtn: { padding: Spacing.xs },
  listContainer: { padding: Spacing.lg, paddingBottom: 100 },
  reviewCard: { backgroundColor: colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.lg, marginBottom: Spacing.md, borderWidth: 1, borderColor: colors.border, ...shadows.small },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  turfBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? 'rgba(255, 204, 0, 0.15)' : '#FFF9DB', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, gap: 6 },
  turfName: { color: isDark ? colors.primary : colors.primaryDark, fontFamily: Typography.fontFamily.bold, fontSize: 12 },
  ratingBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, gap: 4 },
  ratingText: { color: '#000', fontFamily: Typography.fontFamily.bold, fontSize: 14 },
  userRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surfaceVariant, marginRight: 10 },
  userName: { color: colors.textPrimary, fontFamily: Typography.fontFamily.bold, fontSize: 14 },
  commentText: { color: colors.textSecondary, fontFamily: Typography.fontFamily.regular, fontSize: 14, lineHeight: 20 },
  emptyContainer: { alignItems: 'center', marginTop: 60 },
  emptyTitle: { color: colors.textPrimary, fontFamily: Typography.fontFamily.bold, fontSize: 18, marginTop: Spacing.md },
  emptyDesc: { color: colors.textSecondary, fontFamily: Typography.fontFamily.regular, fontSize: 14, marginTop: Spacing.xs, textAlign: 'center', paddingHorizontal: Spacing.xl },
});

export default OwnerReviewsScreen;
