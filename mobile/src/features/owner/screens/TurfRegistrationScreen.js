import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import React, { useState } from 'react';
import LocationAutocomplete from '../../../components/LocationAutocomplete';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  Image, KeyboardAvoidingView, Platform, ActivityIndicator
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { launchImageLibrary } from 'react-native-image-picker';
import { useForm, Controller } from 'react-hook-form';
import { Colors, Typography, Spacing, BorderRadius } from '../../../theme/theme';
import { createTurf, updateTurf } from '../../turf/turfSlice';
import api from '../../../api/axios';
import { showCustomAlert } from '../../../components/CustomAlert';


const AMENITIES_LIST = [
  { id: 'parking', label: 'Parking', icon: 'car' },
  { id: 'washroom', label: 'Washroom', icon: 'toilet' },
  { id: 'drinkingWater', label: 'Water', icon: 'water' },
  { id: 'floodLights', label: 'Flood Lights', icon: 'stadium-variant' },
  { id: 'seating', label: 'Seating', icon: 'chair-rolling' },
  { id: 'foodAvailable', label: 'Food', icon: 'food' },
  { id: 'changingRoom', label: 'Changing Room', icon: 'tshirt-crew' },
  { id: 'firstAid', label: 'First Aid', icon: 'medical-bag' },
];

const SIZES = ['5v5', '6v6', '7v7', '8v8', '9v9', '11v11', 'Box Cricket'];
const TYPES = ['Indoor', 'Outdoor', 'Both'];

const TurfRegistrationScreen = ({ navigation, route }) => {
  const editTurf = route.params?.editTurf;
  const isEditing = !!editTurf;
  const dispatch = useDispatch();
  const { isLoading } = useSelector((state) => state.turf);
  
  const { control, handleSubmit, setValue, watch, formState: { errors } } = useForm({
    defaultValues: {
      name: editTurf?.name || '', 
      description: editTurf?.description || '', 
      address: editTurf?.address || '', 
      city: editTurf?.city || '', 
      state: editTurf?.state || '', 
      pincode: editTurf?.pincode || '',
      size: editTurf?.size || '5v5', 
      type: editTurf?.type || 'Outdoor', 
      weekdayDayPrice: editTurf?.pricing?.weekdayDay?.toString() || '', 
      weekdayNightPrice: editTurf?.pricing?.weekdayNight?.toString() || '', 
      weekendDayPrice: editTurf?.pricing?.weekendDay?.toString() || '', 
      weekendNightPrice: editTurf?.pricing?.weekendNight?.toString() || '',
      amenities: editTurf?.amenities || {}
    }
  });

  const [coverImage, setCoverImage] = useState(editTurf?.coverImage ? { uri: editTurf.coverImage } : null);
  const [gallery, setGallery] = useState(editTurf?.gallery ? editTurf.gallery.map(uri => ({ uri })) : []);
  const [removedGallery, setRemovedGallery] = useState([]);

  const amenitiesState = watch('amenities');

  const getImageUrl = (path) => {
    if (!path) return 'https://via.placeholder.com/600x400';
    if (path.startsWith('http') || path.startsWith('file://') || path.startsWith('content://')) return path;
    const baseUrl = api.defaults.baseURL.replace('/api', '');
    return `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
  };

  const pickCoverImage = async () => {
    try {
      const result = await launchImageLibrary({ mediaType: 'photo', quality: 0.8 });
      if (result.didCancel) {
        return;
      }
      if (result.errorCode) {
        showCustomAlert('Error', result.errorMessage || 'Failed to pick image');
        return;
      }
      if (result.assets && result.assets[0]) {
        setCoverImage(result.assets[0]);
      }
    } catch (error) {
      showCustomAlert('Error', 'An unexpected error occurred while opening the image picker.');
      console.log('Image picker error:', error);
    }
  };

  const pickGalleryImages = async () => {
    try {
      const result = await launchImageLibrary({ mediaType: 'photo', quality: 0.8, selectionLimit: 0 }); // 0 = multiple
      if (result.didCancel) return;
      if (result.errorCode) {
        showCustomAlert('Error', result.errorMessage || 'Failed to pick image');
        return;
      }
      if (result.assets) {
        setGallery(prev => [...prev, ...result.assets]);
      }
    } catch (error) {
      showCustomAlert('Error', 'An unexpected error occurred while opening the image picker.');
      console.log('Gallery picker error:', error);
    }
  };

  const removeGalleryImage = (index) => {
    const img = gallery[index];
    if (!img.fileName && img.uri) {
      // It's an existing image from backend, need to tell backend to remove it
      setRemovedGallery(prev => [...prev, img.uri]);
    }
    setGallery(prev => prev.filter((_, i) => i !== index));
  };

  const toggleAmenity = (id) => {
    setValue('amenities', { ...amenitiesState, [id]: !amenitiesState[id] });
  };

  const onSubmit = async (data) => {
    if (!coverImage) return showCustomAlert('Error', 'Please select a cover image for your turf.');
    
    const formData = new FormData();
    formData.append('name', data.name);
    formData.append('description', data.description);
    formData.append('address', data.address);
    formData.append('city', data.city);
    if (data.latitude) formData.append('latitude', data.latitude);
    if (data.longitude) formData.append('longitude', data.longitude);
    formData.append('state', data.state);
    formData.append('pincode', data.pincode);
    formData.append('size', data.size);
    formData.append('type', data.type);
    formData.append('weekdayDayPrice', data.weekdayDayPrice || 0);
    formData.append('weekdayNightPrice', data.weekdayNightPrice || 0);
    formData.append('weekendDayPrice', data.weekendDayPrice || 0);
    formData.append('weekendNightPrice', data.weekendNightPrice || 0);

    // Backend expects location as [lng, lat]. Defaulting to 0 for now.
    formData.append('longitude', '0');
    formData.append('latitude', '0');

    // Default 24/7 Operating Hours
    formData.append('openTime', '00:00');
    formData.append('closeTime', '23:59');

    // Amenities
    Object.keys(amenitiesState).forEach(key => {
      if (amenitiesState[key]) {
        formData.append(key, 'true');
      }
    });

    // Images
    if (coverImage?.fileName) { // Only append if it's a new file, not an existing URL
      formData.append('coverImage', {
        uri: coverImage.uri,
        type: coverImage.type || 'image/jpeg',
        name: coverImage.fileName || 'cover.jpg'
      });
    }

    gallery.forEach((img, index) => {
      if (img.fileName) { // Only append new files
        formData.append('gallery', {
          uri: img.uri,
          type: img.type || 'image/jpeg',
          name: img.fileName || `gallery_${index}.jpg`
        });
      }
    });

    if (removedGallery.length > 0) {
      formData.append('removeGalleryImages', JSON.stringify(removedGallery));
    }

    let result;
    if (isEditing) {
      result = await dispatch(updateTurf({ id: editTurf._id, formData }));
    } else {
      result = await dispatch(createTurf(formData));
    }

    if (isEditing ? updateTurf.fulfilled.match(result) : createTurf.fulfilled.match(result)) {
      showCustomAlert('Success', `Turf ${isEditing ? 'updated' : 'created'} successfully!`, [
        { text: 'OK', onPress: () => {
          if (navigation.canGoBack()) {
            navigation.goBack();
          } else {
            navigation.navigate('OwnerDashboard');
          }
        }}
      ]);
    } else {
      showCustomAlert('Error', result.payload || `Failed to ${isEditing ? 'update' : 'create'} turf`);
    }
  };

  const onError = (errors) => {
    showCustomAlert('Validation Error', 'Please fill all required fields correctly.');
  };

  const renderInput = (name, placeholder, rules = {}, numeric = false, multiline = false) => (
    <View style={styles.inputGroup}>
      <Controller
        control={control}
        name={name}
        rules={rules}
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            style={[styles.input, multiline && styles.textArea, errors[name] && styles.inputError]}
            placeholder={placeholder}
            placeholderTextColor={Colors.textTertiary}
            onBlur={onBlur}
            onChangeText={onChange}
            value={value}
            keyboardType={numeric ? 'numeric' : 'default'}
            multiline={multiline}
          />
        )}
      />
      {errors[name] && <Text style={styles.errorText}>{errors[name].message || 'Required'}</Text>}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={28} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEditing ? 'Edit Turf' : 'Add New Turf'}</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : null} style={{ flex: 1 }}>
        <KeyboardAwareScrollView enableOnAndroid={true} extraScrollHeight={20} keyboardShouldPersistTaps="handled" style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          
          {/* Media Section */}
          <Text style={styles.sectionTitle}>Turf Media</Text>
          <TouchableOpacity style={styles.coverUpload} onPress={pickCoverImage}>
            {coverImage ? (
              <Image source={{ uri: getImageUrl(coverImage.uri) }} style={styles.coverImagePreview} />
            ) : (
              <View style={styles.uploadPlaceholder}>
                <Icon name="camera-plus" size={40} color={Colors.primary} />
                <Text style={styles.uploadText}>Upload Cover Image *</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.galleryUpload} onPress={pickGalleryImages}>
            <Icon name="image-multiple" size={24} color={Colors.primary} />
            <Text style={styles.galleryText}>+ Add Gallery Images</Text>
          </TouchableOpacity>

          {gallery.length > 0 && (
            <KeyboardAwareScrollView enableOnAndroid={true} extraScrollHeight={20} keyboardShouldPersistTaps="handled" horizontal showsHorizontalScrollIndicator={false} style={styles.galleryScroll}>
              {gallery.map((img, index) => (
                <View key={index} style={styles.galleryImageWrapper}>
                  <Image source={{ uri: getImageUrl(img.uri) }} style={styles.galleryImage} />
                  <TouchableOpacity style={styles.removeImageBtn} onPress={() => removeGalleryImage(index)}>
                    <Icon name="close" size={16} color="#FFF" />
                  </TouchableOpacity>
                </View>
              ))}
            </KeyboardAwareScrollView>
          )}

          {/* Basic Info */}
          <Text style={styles.sectionTitle}>Basic Info</Text>
          {renderInput('name', 'Turf Name *', { required: 'Name is required' })}
          {renderInput('description', 'Description', {}, false, true)}
          
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Size</Text>
              <KeyboardAwareScrollView enableOnAndroid={true} extraScrollHeight={20} keyboardShouldPersistTaps="handled" horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                {SIZES.map(s => (
                  <TouchableOpacity 
                    key={s} 
                    style={[styles.chip, watch('size') === s && styles.chipActive]}
                    onPress={() => setValue('size', s)}
                  >
                    <Text style={[styles.chipText, watch('size') === s && styles.chipTextActive]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </KeyboardAwareScrollView>
            </View>
          </View>

          <View style={styles.row}>
            <View style={{ flex: 1, marginTop: Spacing.sm }}>
              <Text style={styles.label}>Type</Text>
              <KeyboardAwareScrollView enableOnAndroid={true} extraScrollHeight={20} keyboardShouldPersistTaps="handled" horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                {TYPES.map(t => (
                  <TouchableOpacity 
                    key={t} 
                    style={[styles.chip, watch('type') === t && styles.chipActive]}
                    onPress={() => setValue('type', t)}
                  >
                    <Text style={[styles.chipText, watch('type') === t && styles.chipTextActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </KeyboardAwareScrollView>
            </View>
          </View>

          {/* Location */}
          <View style={styles.sectionHeader}>
            <Icon name="map-marker-outline" size={20} color={Colors.primary} />
            <Text style={styles.sectionTitle}>Location</Text>
          </View>

          {/* Street Address */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Street Address *</Text>
            <Controller
              control={control}
              name="address"
              rules={{ required: 'Address is required' }}
              render={({ field: { onChange, onBlur, value } }) => (
                <View style={[styles.inputWrapper, errors.address && styles.inputWrapperError]}>
                  <Icon name="road" size={18} color={Colors.textTertiary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.inputField}
                    placeholder="e.g. 24 Main Road, Koramangala"
                    placeholderTextColor={Colors.textTertiary}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    value={value}
                  />
                </View>
              )}
            />
            {errors.address && <Text style={styles.errorText}>{errors.address.message}</Text>}
          </View>

          {/* City (Location Search) */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>City / Area *</Text>
            <Controller
              control={control}
              name="city"
              rules={{ required: 'City is required' }}
              render={({ field: { onChange, value } }) => (
                <View style={[styles.inputWrapper, errors.city && styles.inputWrapperError]}>
                  <LocationAutocomplete
                    value={value}
                    variant="none"
                    onChangeText={onChange}
                    onSelectLocation={(loc) => {
                      onChange(loc.name);
                      setValue('latitude', String(loc.latitude));
                      setValue('longitude', String(loc.longitude));
                      if (loc.state) setValue('state', loc.state);
                    }}
                    placeholder="Search location..."
                    style={{ flex: 1 }}
                  />
                </View>
              )}
            />
            {errors.city && <Text style={styles.errorText}>{errors.city.message}</Text>}
          </View>

          {/* State + Pincode Row */}
          <View style={styles.rowInputs}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>State *</Text>
                <Controller
                  control={control}
                  name="state"
                  rules={{ required: 'State is required' }}
                  render={({ field: { onChange, onBlur, value } }) => (
                    <View style={[styles.inputWrapper, errors.state && styles.inputWrapperError]}>
                      <Icon name="map" size={18} color={Colors.textTertiary} style={styles.inputIcon} />
                      <TextInput
                        style={styles.inputField}
                        placeholder="State"
                        placeholderTextColor={Colors.textTertiary}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        value={value}
                      />
                    </View>
                  )}
                />
                {errors.state && <Text style={styles.errorText}>{errors.state.message}</Text>}
              </View>
            </View>
            <View style={{ flex: 1, marginLeft: 8 }}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Pincode</Text>
                <Controller
                  control={control}
                  name="pincode"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <View style={styles.inputWrapper}>
                      <Icon name="numeric" size={18} color={Colors.textTertiary} style={styles.inputIcon} />
                      <TextInput
                        style={styles.inputField}
                        placeholder="e.g. 560001"
                        placeholderTextColor={Colors.textTertiary}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        value={value}
                        keyboardType="numeric"
                      />
                    </View>
                  )}
                />
              </View>
            </View>
          </View>

          {/* Detailed Pricing */}
          <Text style={styles.sectionTitle}>Detailed Pricing (₹/hr)</Text>
          <View style={styles.rowInputs}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.label}>Weekday Day</Text>
              {renderInput('weekdayDayPrice', '₹ *', { required: 'Required' }, true)}
            </View>
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={styles.label}>Weekday Night</Text>
              {renderInput('weekdayNightPrice', '₹ *', { required: 'Required' }, true)}
            </View>
          </View>
          <View style={styles.rowInputs}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.label}>Weekend Day</Text>
              {renderInput('weekendDayPrice', '₹ *', { required: 'Required' }, true)}
            </View>
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={styles.label}>Weekend Night</Text>
              {renderInput('weekendNightPrice', '₹ *', { required: 'Required' }, true)}
            </View>
          </View>

          {/* Amenities */}
          <Text style={styles.sectionTitle}>Amenities</Text>
          <View style={styles.amenitiesGrid}>
            {AMENITIES_LIST.map(amenity => {
              const isActive = amenitiesState[amenity.id];
              return (
                <TouchableOpacity 
                  key={amenity.id} 
                  style={[styles.amenityCard, isActive && styles.amenityCardActive]}
                  onPress={() => toggleAmenity(amenity.id)}
                >
                  <Icon name={amenity.icon} size={24} color={isActive ? Colors.primary : Colors.textTertiary} />
                  <Text style={[styles.amenityText, isActive && styles.amenityTextActive]}>{amenity.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity 
            style={[styles.submitButton, isLoading && styles.submitButtonDisabled]} 
            onPress={handleSubmit(onSubmit, onError)}
            disabled={isLoading}
          >
            {isLoading ? <ActivityIndicator color="#000" /> : <Text style={styles.submitButtonText}>{isEditing ? 'Update Turf' : 'Register Turf'}</Text>}
          </TouchableOpacity>

        </KeyboardAwareScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', 
    paddingHorizontal: Spacing.xl, paddingTop: 60, paddingBottom: Spacing.lg,
    backgroundColor: Colors.backgroundCard, borderBottomWidth: 1, borderBottomColor: Colors.border
  },
  backButton: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary },
  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.xl, paddingBottom: 100 },
  sectionTitle: { fontSize: 18, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary, marginTop: Spacing.xl, marginBottom: Spacing.md },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: Spacing.xl, marginBottom: Spacing.md },
  
  // Inputs
  inputGroup: { marginBottom: Spacing.md },
  input: { 
    backgroundColor: Colors.backgroundElevated, borderRadius: BorderRadius.lg, 
    borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.lg, 
    height: 52, color: Colors.textPrimary, fontFamily: Typography.fontFamily.medium 
  },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.backgroundElevated, borderRadius: BorderRadius.lg,
    borderWidth: 1, borderColor: Colors.border, height: 52, paddingHorizontal: Spacing.md,
  },
  inputWrapperError: { borderColor: Colors.error },
  inputIcon: { marginRight: 8 },
  inputField: {
    flex: 1, color: Colors.textPrimary, fontFamily: Typography.fontFamily.medium, fontSize: 14,
  },
  textArea: { height: 100, textAlignVertical: 'top', paddingTop: Spacing.md },
  inputError: { borderColor: Colors.error },
  errorText: { color: Colors.error, fontSize: 12, marginTop: 4, marginLeft: 4 },
  rowInputs: { flexDirection: 'row' },
  label: { color: Colors.textSecondary, fontFamily: Typography.fontFamily.medium, fontSize: 13, marginBottom: 6 },
  
  // Chips
  chipScroll: { flexDirection: 'row' },
  chip: { 
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, 
    backgroundColor: Colors.backgroundElevated, borderWidth: 1, borderColor: Colors.border, marginRight: 8 
  },
  chipActive: { backgroundColor: Colors.primaryAlpha20, borderColor: Colors.primary },
  chipText: { color: Colors.textSecondary, fontFamily: Typography.fontFamily.medium },
  chipTextActive: { color: Colors.primary, fontFamily: Typography.fontFamily.bold },

  // Media
  coverUpload: { 
    height: 180, backgroundColor: Colors.backgroundElevated, borderRadius: BorderRadius.xl, 
    borderWidth: 1, borderColor: Colors.border, borderStyle: 'dashed', 
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden' 
  },
  coverImagePreview: { width: '100%', height: '100%' },
  uploadPlaceholder: { alignItems: 'center' },
  uploadText: { color: Colors.primary, marginTop: 8, fontFamily: Typography.fontFamily.medium },
  galleryUpload: { 
    marginTop: Spacing.md, padding: Spacing.md, backgroundColor: Colors.backgroundElevated, 
    borderRadius: BorderRadius.lg, alignItems: 'center', borderWidth: 1, borderColor: Colors.border,
    flexDirection: 'row', justifyContent: 'center', gap: 8
  },
  galleryText: { color: Colors.primary, fontFamily: Typography.fontFamily.bold },
  galleryScroll: { marginTop: Spacing.md, flexDirection: 'row' },
  galleryImageWrapper: { width: 100, height: 100, marginRight: Spacing.md, borderRadius: BorderRadius.md, overflow: 'hidden', position: 'relative' },
  galleryImage: { width: '100%', height: '100%' },
  removeImageBtn: { position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12, padding: 4 },

  // Amenities
  amenitiesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' },
  amenityCard: { 
    width: '48%', backgroundColor: Colors.backgroundElevated, padding: Spacing.md, 
    borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.border, 
    flexDirection: 'row', alignItems: 'center', gap: 10 
  },
  amenityCardActive: { backgroundColor: Colors.primaryAlpha20, borderColor: Colors.primary },
  amenityText: { color: Colors.textTertiary, fontFamily: Typography.fontFamily.medium, fontSize: 13, flex: 1 },
  amenityTextActive: { color: Colors.primary, fontFamily: Typography.fontFamily.bold },

  // Submit
  submitButton: { 
    backgroundColor: Colors.primary, paddingVertical: 16, borderRadius: BorderRadius.lg, 
    alignItems: 'center', marginTop: Spacing['2xl'] 
  },
  submitButtonDisabled: { opacity: 0.7 },
  submitButtonText: { color: '#000', fontSize: 16, fontFamily: Typography.fontFamily.bold }
});

export default TurfRegistrationScreen;
