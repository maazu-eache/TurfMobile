import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Image, ActivityIndicator, KeyboardAvoidingView, Platform, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { launchImageLibrary } from 'react-native-image-picker';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import api from '../../../api/axios';
import { useTheme, Typography, Spacing, BorderRadius } from '../../../theme/theme';
import { useSelector } from 'react-redux';

const createStyles = (colors, shadows, isDark) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.surface },
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    ...(isDark ? {} : shadows.xs),
  },
  backBtn: {
    padding: 8,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: Typography.fontSize.xl,
    fontFamily: Typography.fontFamily.bold,
    color: colors.textPrimary,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  label: {
    color: colors.textPrimary,
    fontFamily: Typography.fontFamily.medium,
    fontSize: 14,
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: isDark ? colors.background : colors.surfaceVariant,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    color: colors.textPrimary,
    fontFamily: Typography.fontFamily.regular,
    fontSize: 15,
  },
  textArea: {
    minHeight: 120,
  },
  categoryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : colors.surfaceVariant,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryText: {
    color: colors.textSecondary,
    fontFamily: Typography.fontFamily.medium,
    fontSize: 13,
  },
  categoryTextActive: {
    color: colors.textOnPrimary,
    fontFamily: Typography.fontFamily.bold,
  },
  imageUploadBtn: {
    height: 150,
    backgroundColor: isDark ? colors.background : colors.surfaceVariant,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  uploadPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadText: {
    color: colors.textSecondary,
    fontFamily: Typography.fontFamily.medium,
    marginTop: 8,
  },
  removeImageBtn: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  removeImageText: {
    color: colors.error,
    fontFamily: Typography.fontFamily.medium,
    fontSize: 12,
  },
  submitBtn: {
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 32,
    ...shadows.md,
  },
  submitBtnDisabled: {
    opacity: 0.7,
  },
  submitBtnText: {
    color: colors.textOnPrimary,
    fontFamily: Typography.fontFamily.bold,
    fontSize: 16,
  },
  errorText: {
    color: colors.error,
    fontFamily: Typography.fontFamily.medium,
    marginBottom: 16,
    backgroundColor: colors.errorLight,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.error,
  },
});

export default function CreateTicketScreen({ navigation, route }) {
  const { user, currentRole } = useSelector((state) => state.auth);
  const isOwner = currentRole === 'owner' || (!currentRole && (user?.role === 'owner' || user?.roles?.includes('owner')));
  const { colors, shadows, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, shadows, isDark), [colors, shadows, isDark]);

  const initialBookingId = route.params?.bookingId || '';
  const initialMatchId = route.params?.matchId || '';
  const initialTournamentId = route.params?.tournamentId || '';
  const initialCategory = route.params?.category || 'Booking Dispute';
  
  const [email, setEmail] = useState(user?.email || '');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(initialCategory);
  const [bookingId, setBookingId] = useState(initialBookingId);
  const [matchId, setMatchId] = useState(initialMatchId);
  const [tournamentId, setTournamentId] = useState(initialTournamentId);
  const [imageUri, setImageUri] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const categories = isOwner
    ? ['Booking Dispute', 'Payment Issue', 'Account Issue', 'General']
    : ['Booking Dispute', 'Payment Issue', 'Account Issue', 'Match Dispute', 'Tournament Dispute', 'General'];

  const handleSelectImage = async () => {
    try {
      const result = await launchImageLibrary({ mediaType: 'photo', quality: 0.8 });
      if (result.didCancel) return;
      if (result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        
        // 1MB limit check (1MB = 1048576 bytes)
        if (asset.fileSize > 1048576) {
          setError('Image size must be under 1MB.');
          return;
        }

        setImageUri(asset.uri);
        setImageFile({
          uri: asset.uri,
          type: asset.type || 'image/jpeg',
          name: asset.fileName || 'upload.jpg',
        });
        setError('');
      }
    } catch (err) {
      console.log('Error selecting image:', err);
    }
  };

  const handleSubmit = async () => {
    if (!email || !subject || !description) {
      setError('Contact Email, Subject, and Description are required.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      let attachments = [];
      
      // Upload image first if exists
      if (imageFile) {
        const formData = new FormData();
        formData.append('images', imageFile);
        
        const uploadRes = await api.post('/support/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        
        if (uploadRes.data.success && uploadRes.data.data.urls) {
          attachments = uploadRes.data.data.urls;
        }
      }

      // Create ticket
      const ticketData = {
        email,
        subject,
        description,
        category,
        bookingId: (category === 'Booking Dispute' || (category !== 'Match Dispute' && category !== 'Tournament Dispute')) ? (bookingId || undefined) : undefined,
        matchId: category === 'Match Dispute' ? (matchId || undefined) : undefined,
        tournamentId: category === 'Tournament Dispute' ? (tournamentId || undefined) : undefined,
        attachments
      };

      await api.post('/support', ticketData);
      navigation.goBack();
      
    } catch (err) {
      console.error('Error creating ticket:', err);
      setError(err.response?.data?.message || 'Failed to create ticket. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.surface} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Icon name="arrow-left" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Create Support Ticket</Text>
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Text style={styles.label}>Your Contact Email</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your email address"
            placeholderTextColor={colors.textTertiary}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={styles.label}>Category</Text>
          <View style={styles.categoryContainer}>
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[styles.categoryPill, category === cat && styles.categoryPillActive]}
                onPress={() => setCategory(cat)}
                activeOpacity={0.8}
              >
                <Text style={[styles.categoryText, category === cat && styles.categoryTextActive]}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Subject</Text>
          <TextInput
            style={styles.input}
            placeholder="Brief subject of the issue"
            placeholderTextColor={colors.textTertiary}
            value={subject}
            onChangeText={setSubject}
          />

          { (category === 'Booking Dispute' || (category !== 'Match Dispute' && category !== 'Tournament Dispute')) && (
            <>
              <Text style={styles.label}>Booking ID (Optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter booking reference if applicable"
                placeholderTextColor={colors.textTertiary}
                value={bookingId}
                onChangeText={setBookingId}
                editable={!initialBookingId}
              />
            </>
          )}

          { category === 'Match Dispute' && (
            <>
              <Text style={styles.label}>Match ID (Required)</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter match reference ID"
                placeholderTextColor={colors.textTertiary}
                value={matchId}
                onChangeText={setMatchId}
                editable={!initialMatchId}
              />
            </>
          )}

          { category === 'Tournament Dispute' && (
            <>
              <Text style={styles.label}>Tournament ID (Required)</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter tournament reference ID"
                placeholderTextColor={colors.textTertiary}
                value={tournamentId}
                onChangeText={setTournamentId}
                editable={!initialTournamentId}
              />
            </>
          )}

          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Provide details about the issue..."
            placeholderTextColor={colors.textTertiary}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
          />

          <Text style={styles.label}>Attachment (Optional, Max 1MB)</Text>
          <TouchableOpacity style={styles.imageUploadBtn} onPress={handleSelectImage} activeOpacity={0.8}>
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.previewImage} />
            ) : (
              <View style={styles.uploadPlaceholder}>
                <Icon name="camera-plus" size={32} color={colors.textTertiary} />
                <Text style={styles.uploadText}>Tap to upload image</Text>
              </View>
            )}
          </TouchableOpacity>
          {imageUri && (
            <TouchableOpacity style={styles.removeImageBtn} onPress={() => {setImageUri(null); setImageFile(null);}}>
              <Text style={styles.removeImageText}>Remove Image</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity 
            style={[styles.submitBtn, loading && styles.submitBtnDisabled]} 
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={colors.textOnPrimary} />
            ) : (
              <Text style={styles.submitBtnText}>Submit Ticket</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
