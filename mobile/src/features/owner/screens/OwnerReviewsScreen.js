import React, { useEffect, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors, Typography, Spacing, BorderRadius } from '../../../theme/theme';
import api, { getImageUrl } from '../../../api/axios';

const OwnerReviewsScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
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
          <Icon name="soccer-field" size={14} color={Colors.primary} />
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
        <Text style={[styles.commentText, { fontStyle: 'italic', color: Colors.textTertiary }]}>No comment provided.</Text>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Turf Reviews</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={reviews}
          keyExtractor={(item) => item._id}
          renderItem={renderReview}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Icon name="star-off" size={48} color={Colors.textTertiary} />
              <Text style={styles.emptyTitle}>No reviews yet</Text>
              <Text style={styles.emptyDesc}>When customers rate your turfs, they will appear here.</Text>
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.xl, paddingBottom: Spacing.md },
  headerTitle: { fontSize: Typography.fontSize.xl, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary },
  backBtn: { padding: Spacing.xs },
  listContainer: { padding: Spacing.lg, paddingBottom: 100 },
  reviewCard: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.lg, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  turfBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.primaryAlpha20, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, gap: 6 },
  turfName: { color: Colors.primary, fontFamily: Typography.fontFamily.bold, fontSize: 12 },
  ratingBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.accent, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, gap: 4 },
  ratingText: { color: '#000', fontFamily: Typography.fontFamily.bold, fontSize: 14 },
  userRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.border, marginRight: 10 },
  userName: { color: Colors.textPrimary, fontFamily: Typography.fontFamily.bold, fontSize: 14 },
  commentText: { color: Colors.textSecondary, fontFamily: Typography.fontFamily.regular, fontSize: 14, lineHeight: 20 },
  emptyContainer: { alignItems: 'center', marginTop: 60 },
  emptyTitle: { color: Colors.textPrimary, fontFamily: Typography.fontFamily.bold, fontSize: 18, marginTop: Spacing.md },
  emptyDesc: { color: Colors.textSecondary, fontFamily: Typography.fontFamily.regular, fontSize: 14, marginTop: Spacing.xs, textAlign: 'center', paddingHorizontal: Spacing.xl },
});

export default OwnerReviewsScreen;
