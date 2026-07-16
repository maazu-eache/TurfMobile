import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { launchImageLibrary } from 'react-native-image-picker';
import { useSelector, useDispatch } from 'react-redux';
import { Colors, Typography, Spacing, BorderRadius } from '../../../theme/theme';
import api, { getImageUrl } from '../../../api/axios';
import { updateUser } from '../../auth/authSlice';
import { showCustomAlert } from '../../../components/CustomAlert';

const EditProfileScreen = ({ navigation }) => {
  const { user } = useSelector((state) => state.auth);
  const dispatch = useDispatch();

  const [name, setName] = useState(user?.name || '');
  const [photo, setPhoto] = useState(user?.photo ? { uri: getImageUrl(user.photo) } : null);
  const [isLoading, setIsLoading] = useState(false);

  const handlePickImage = async () => {
    const result = await launchImageLibrary({
      mediaType: 'photo',
      quality: 0.8,
    });

    if (result.assets && result.assets.length > 0) {
      setPhoto(result.assets[0]);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      showCustomAlert('Validation Error', 'Name cannot be empty');
      return;
    }

    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append('name', name.trim());
      
      if (photo && photo.fileName) {
        formData.append('photo', {
          uri: photo.uri,
          type: photo.type || 'image/jpeg',
          name: photo.fileName || 'profile.jpg'
        });
      }

      const res = await api.put('/users/me', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data.success) {
        dispatch(updateUser(res.data.data));
        showCustomAlert('Success', 'Profile updated successfully!');
        navigation.goBack();
      }
    } catch (e) {
      console.log('Update failed', e.response?.data || e);
      showCustomAlert('Update Failed', e.response?.data?.message || 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <View style={styles.backBtn} />
      </View>

      <KeyboardAwareScrollView style={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={handlePickImage} style={styles.avatarWrapper}>
            {photo ? (
              <Image source={{ uri: photo.uri }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>{name.charAt(0).toUpperCase() || 'U'}</Text>
              </View>
            )}
            <View style={styles.editIconBadge}>
              <Icon name="camera" size={16} color="#FFF" />
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Full Name</Text>
          <View style={styles.inputContainer}>
            <Icon name="account" size={20} color={Colors.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Enter your name"
              placeholderTextColor={Colors.textSecondary}
            />
          </View>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Phone Number</Text>
          <View style={[styles.inputContainer, styles.inputDisabled]}>
            <Icon name="phone" size={20} color={Colors.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: Colors.textSecondary }]}
              value={user?.mobile || 'Not provided'}
              editable={false}
            />
          </View>
          <Text style={styles.helpText}>Phone number cannot be changed.</Text>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Email Address</Text>
          <View style={[styles.inputContainer, styles.inputDisabled]}>
            <Icon name="email" size={20} color={Colors.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: Colors.textSecondary }]}
              value={user?.email || ''}
              editable={false}
            />
          </View>
          <Text style={styles.helpText}>Email address cannot be changed.</Text>
        </View>

        <TouchableOpacity 
          style={styles.saveBtn} 
          onPress={handleSave} 
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.saveBtnText}>Save Changes</Text>
          )}
        </TouchableOpacity>
      </KeyboardAwareScrollView>
</SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    backgroundColor: Colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    height: 60,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: { padding: Spacing.xs, width: 40 },
  headerTitle: { color: Colors.textPrimary, fontSize: 18, fontFamily: Typography.fontFamily.semiBold },
  content: { padding: Spacing.lg },
  avatarSection: { alignItems: 'center', marginBottom: Spacing.xl },
  avatarWrapper: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.surface,
    borderWidth: 2,
    borderColor: Colors.primary,
    position: 'relative',
  },
  avatar: { width: '100%', height: '100%', borderRadius: 50 },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 50,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 36, color: Colors.primary, fontFamily: Typography.fontFamily.bold },
  editIconBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: Colors.primary,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.background,
  },
  formGroup: { marginBottom: Spacing.lg },
  label: { color: Colors.textSecondary, fontSize: 13, fontFamily: Typography.fontFamily.medium, marginBottom: Spacing.xs },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.sm,
  },
  inputDisabled: { backgroundColor: '#1A1D24', opacity: 0.7 },
  inputIcon: { marginRight: Spacing.sm },
  input: {
    flex: 1,
    height: 48,
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.regular,
    fontSize: 15,
  },
  helpText: { color: Colors.textSecondary, fontSize: 11, marginTop: Spacing.xs },
  saveBtn: {
    backgroundColor: Colors.primary,
    height: 50,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.lg,
  },
  saveBtnText: { color: '#000', fontSize: 16, fontFamily: Typography.fontFamily.bold },
});

export default EditProfileScreen;
