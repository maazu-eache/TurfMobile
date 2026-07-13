import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors, Typography, Spacing, BorderRadius } from '../../../theme/theme';
import api from '../../../api/axios';

const FavouritesScreen = ({ navigation }) => {
  const [favourites, setFavourites] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchFavourites();
  }, []);

  const fetchFavourites = async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/users/favourites');
      setFavourites(res.data.data || []);
    } catch (e) {
      console.log('Failed to fetch favourites', e);
    } finally {
      setIsLoading(false);
    }
  };

  const getImageUrl = (path) => {
    if (!path) return 'https://via.placeholder.com/600x400';
    if (path.startsWith('http')) return path;
    const baseUrl = api.defaults.baseURL.replace('/api', '');
    return `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
  };

  const renderTurf = ({ item }) => (
    <TouchableOpacity 
      style={styles.card} 
      activeOpacity={0.9} 
      onPress={() => navigation.navigate('TurfDetail', { id: item._id })}
    >
      <Image source={{ uri: getImageUrl(item.coverImage) }} style={styles.cardImage} />
      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={styles.cardGradient}>
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>{item.name}</Text>
          <View style={styles.cardInfoRow}>
            <Text style={styles.cardLocation}><Icon name="map-marker" size={14} /> {item.city}</Text>
            <View style={styles.ratingBadge}>
              <Icon name="star" size={12} color="#000" />
              <Text style={styles.ratingText}>{item.rating > 0 ? item.rating.toFixed(1) : 'New'}</Text>
            </View>
          </View>
        </View>
      </LinearGradient>
      <TouchableOpacity 
        style={styles.heartBtn}
        onPress={async () => {
          // Remove from list locally for immediate feedback
          setFavourites(prev => prev.filter(t => t._id !== item._id));
          try {
            await api.post(`/users/favourites/${item._id}`);
          } catch (e) {
            console.log('Failed to toggle favourite');
            fetchFavourites(); // Refetch if failed
          }
        }}
      >
        <Icon name="heart" size={20} color={Colors.error} />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Favourites</Text>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : favourites.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Icon name="heart-broken" size={60} color={Colors.border} />
          <Text style={styles.emptyTitle}>No Favourites Yet</Text>
          <Text style={styles.emptyDesc}>Turfs you mark as favourite will appear here.</Text>
          <TouchableOpacity style={styles.exploreBtn} onPress={() => navigation.navigate('Home')}>
            <Text style={styles.exploreBtnText}>Explore Turfs</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={favourites}
          keyExtractor={(item) => item._id}
          renderItem={renderTurf}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', padding: Spacing.xl, paddingTop: 60, backgroundColor: Colors.backgroundElevated, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn: { padding: 4, marginRight: Spacing.md },
  headerTitle: { fontSize: Typography.fontSize.xl, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContainer: { padding: Spacing.xl, paddingBottom: 100 },
  card: { height: 200, borderRadius: BorderRadius.xl, overflow: 'hidden', marginBottom: Spacing.xl, backgroundColor: Colors.surface, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
  cardImage: { width: '100%', height: '100%' },
  cardGradient: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '60%', justifyContent: 'flex-end', padding: Spacing.lg },
  cardContent: { gap: 6 },
  cardTitle: { color: '#FFF', fontSize: Typography.fontSize.xl, fontFamily: Typography.fontFamily.bold },
  cardInfoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardLocation: { color: 'rgba(255,255,255,0.8)', fontSize: Typography.fontSize.sm, fontFamily: Typography.fontFamily.medium },
  ratingBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.accent, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, gap: 4 },
  ratingText: { color: '#000', fontSize: 12, fontFamily: Typography.fontFamily.bold },
  heartBtn: { position: 'absolute', top: 12, right: 12, backgroundColor: 'rgba(0,0,0,0.4)', padding: 8, borderRadius: 20 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing['2xl'] },
  emptyTitle: { color: Colors.textPrimary, fontFamily: Typography.fontFamily.bold, fontSize: Typography.fontSize.xl, marginTop: Spacing.lg, marginBottom: 8 },
  emptyDesc: { color: Colors.textSecondary, fontFamily: Typography.fontFamily.medium, fontSize: Typography.fontSize.md, textAlign: 'center', marginBottom: Spacing.xl },
  exploreBtn: { backgroundColor: Colors.primary, paddingHorizontal: Spacing.xl, paddingVertical: 12, borderRadius: BorderRadius.full },
  exploreBtnText: { color: '#000', fontFamily: Typography.fontFamily.bold, fontSize: Typography.fontSize.md },
});

export default FavouritesScreen;
