import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { launchImageLibrary } from 'react-native-image-picker';
import { useSelector, useDispatch } from 'react-redux';
import { useTheme, Typography, Spacing, BorderRadius } from '../../../theme/theme';
import api, { getImageUrl } from '../../../api/axios';
import { updateUser } from '../../auth/authSlice';
import { showCustomAlert } from '../../../components/CustomAlert';
import ImageCropperModal from '../../../components/ImageCropperModal';

const EditProfileScreen = ({ navigation }) => {
  const { user } = useSelector((state) => state.auth);
  const dispatch = useDispatch();
  const { colors, shadows, isDark } = useTheme();

  const [name, setName] = useState(user?.name || '');
  const [photo, setPhoto] = useState(user?.photo ? { uri: getImageUrl(user.photo) } : null);
  const [isLoading, setIsLoading] = useState(false);
  const [cropModalVisible, setCropModalVisible] = useState(false);
  const [tempImageUri, setTempImageUri] = useState('');

  const styles = useMemo(() => createStyles(colors, shadows, isDark), [colors, shadows, isDark]);

  const handlePickImage = async () => {
    const result = await launchImageLibrary({
      mediaType: 'photo',
      quality: 0.8,
    });

    if (result.assets && result.assets.length > 0) {
      const selected = result.assets[0];
      if (selected.fileSize && selected.fileSize > 3 * 1024 * 1024) {
        showCustomAlert('File Too Large', 'Please select an image smaller than 3MB.');
        return;
      }
      setTempImageUri(selected.uri);
      setCropModalVisible(true);
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
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <Icon name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <View style={styles.backBtn} />
      </View>

      <KeyboardAwareScrollView style={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={handlePickImage} style={styles.avatarWrapper} activeOpacity={0.8}>
            {photo ? (
              <Image source={{ uri: photo.uri }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>{name.charAt(0).toUpperCase() || 'U'}</Text>
              </View>
            )}
            <View style={styles.editIconBadge}>
              <Icon name="camera" size={16} color={colors.textOnPrimary} />
            </View>
          </TouchableOpacity>
          <Text style={styles.maxSizeText}>Max 3 MB</Text>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Full Name</Text>
          <View style={styles.inputContainer}>
            <Icon name="account" size={20} color={colors.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Enter your name"
              placeholderTextColor={colors.textTertiary}
            />
          </View>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Phone Number</Text>
          <View style={[styles.inputContainer, styles.inputDisabled]}>
            <Icon name="phone" size={20} color={colors.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: colors.textSecondary }]}
              value={user?.mobile || 'Not provided'}
              editable={false}
            />
          </View>
          <Text style={styles.helpText}>Phone number cannot be changed.</Text>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Email Address</Text>
          <View style={[styles.inputContainer, styles.inputDisabled]}>
            <Icon name="email" size={20} color={colors.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: colors.textSecondary }]}
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
          activeOpacity={0.8}
        >
          {isLoading ? (
            <ActivityIndicator color={colors.textOnPrimary} />
          ) : (
            <Text style={styles.saveBtnText}>Save Changes</Text>
          )}
        </TouchableOpacity>
      </KeyboardAwareScrollView>

      <ImageCropperModal
        visible={cropModalVisible}
        imageUri={tempImageUri}
        onClose={() => setCropModalVisible(false)}
        onCrop={(croppedUri) => {
          setPhoto({
            uri: croppedUri,
            fileName: 'profile.jpg',
            type: 'image/jpeg'
          });
          setCropModalVisible(false);
        }}
      />
    </SafeAreaView>
  );
};

const createStyles = (colors, shadows, isDark) => StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: isDark ? colors.surface : colors.background,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    height: 60,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { 
    padding: Spacing.xs, 
    width: 40,
  },
  headerTitle: { 
    color: colors.textPrimary, 
    fontSize: 18, 
    fontFamily: Typography.fontFamily.semiBold,
  },
  content: { 
    padding: Spacing.lg,
  },
  avatarSection: { 
    alignItems: 'center', 
    marginBottom: Spacing.xl,
  },
  avatarWrapper: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.surfaceVariant,
    borderWidth: 2,
    borderColor: colors.primary,
    position: 'relative',
    ...(isDark ? {} : shadows.sm),
  },
  avatar: { 
    width: '100%', 
    height: '100%', 
    borderRadius: 50,
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 50,
    backgroundColor: colors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { 
    fontSize: 36, 
    color: colors.primary, 
    fontFamily: Typography.fontFamily.bold,
  },
  editIconBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: colors.primary,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.background,
  },
  maxSizeText: { 
    color: colors.textSecondary, 
    fontSize: 12, 
    textAlign: 'center', 
    marginTop: 8,
    fontFamily: Typography.fontFamily.medium,
  },
  formGroup: { 
    marginBottom: Spacing.lg,
  },
  label: { 
    color: colors.textSecondary, 
    fontSize: 13, 
    fontFamily: Typography.fontFamily.medium, 
    marginBottom: Spacing.xs,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.sm,
    ...(isDark ? {} : shadows.sm),
  },
  inputDisabled: { 
    backgroundColor: colors.surfaceVariant, 
    borderColor: colors.borderLight,
    opacity: 0.85,
  },
  inputIcon: { 
    marginRight: Spacing.sm,
  },
  input: {
    flex: 1,
    height: 48,
    color: colors.textPrimary,
    fontFamily: Typography.fontFamily.regular,
    fontSize: 15,
  },
  helpText: { 
    color: colors.textTertiary, 
    fontSize: 11, 
    marginTop: Spacing.xs,
    fontFamily: Typography.fontFamily.regular,
  },
  saveBtn: {
    backgroundColor: colors.primary,
    height: 50,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.lg,
    ...(isDark ? {} : shadows.sm),
  },
  saveBtnText: { 
    color: colors.textOnPrimary, 
    fontSize: 16, 
    fontFamily: Typography.fontFamily.bold,
  },
});

export default EditProfileScreen;
