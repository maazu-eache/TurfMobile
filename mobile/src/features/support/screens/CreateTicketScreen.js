import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { launchImageLibrary } from 'react-native-image-picker';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import api from '../../../api/axios';
import { Colors, Typography, Spacing } from '../../../theme/theme';

import { useSelector } from 'react-redux';

export default function CreateTicketScreen({ navigation, route }) {
  const { user } = useSelector((state) => state.auth);
  const initialBookingId = route.params?.bookingId || '';
  
  const [email, setEmail] = useState(user?.email || '');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Booking Dispute');
  const [bookingId, setBookingId] = useState(initialBookingId);
  const [imageUri, setImageUri] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const categories = ['Booking Dispute', 'Payment Issue', 'Account Issue', 'General'];

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
        bookingId: bookingId || undefined,
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
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Icon name="arrow-left" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Create Support Ticket</Text>
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Text style={styles.label}>Your Contact Email</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your email address"
            placeholderTextColor={Colors.textSecondary}
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
              >
                <Text style={[styles.categoryText, category === cat && styles.categoryTextActive]}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Subject</Text>
          <TextInput
            style={styles.input}
            placeholder="Brief subject of the issue"
            placeholderTextColor={Colors.textSecondary}
            value={subject}
            onChangeText={setSubject}
          />

          <Text style={styles.label}>Booking ID (Optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter booking reference if applicable"
            placeholderTextColor={Colors.textSecondary}
            value={bookingId}
            onChangeText={setBookingId}
            editable={!initialBookingId}
          />

          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Provide details about the issue..."
            placeholderTextColor={Colors.textSecondary}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
          />

          <Text style={styles.label}>Attachment (Optional, Max 1MB)</Text>
          <TouchableOpacity style={styles.imageUploadBtn} onPress={handleSelectImage}>
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.previewImage} />
            ) : (
              <View style={styles.uploadPlaceholder}>
                <Icon name="camera-plus" size={32} color={Colors.textSecondary} />
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
          >
            {loading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.submitBtnText}>Submit Ticket</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.backgroundElevated,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: {
    padding: 8,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: Typography.fontSize.xl,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.textPrimary,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  label: {
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.medium,
    fontSize: 14,
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: Colors.backgroundCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 12,
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.regular,
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
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.backgroundCard,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  categoryPillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  categoryText: {
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.medium,
    fontSize: 12,
  },
  categoryTextActive: {
    color: '#000',
  },
  imageUploadBtn: {
    height: 150,
    backgroundColor: Colors.backgroundCard,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
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
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.medium,
    marginTop: 8,
  },
  removeImageBtn: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  removeImageText: {
    color: Colors.error,
    fontFamily: Typography.fontFamily.medium,
    fontSize: 12,
  },
  submitBtn: {
    backgroundColor: Colors.primary,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 32,
  },
  submitBtnDisabled: {
    opacity: 0.7,
  },
  submitBtnText: {
    color: '#000',
    fontFamily: Typography.fontFamily.bold,
    fontSize: 16,
  },
  errorText: {
    color: Colors.error,
    fontFamily: Typography.fontFamily.medium,
    marginBottom: 16,
    backgroundColor: 'rgba(255, 87, 34, 0.1)',
    padding: 12,
    borderRadius: 8,
  },
});
