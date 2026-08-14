import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import React, { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import api, { getImageUrl } from '../../../api/axios';
import { showCustomAlert } from '../../../components/CustomAlert';
import CustomTimePicker from '../../../components/CustomTimePicker';


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

const SIZES = ['Box Cricket', '5v5', '6v6', '7v7', '8v8', '9v9', '11v11'];
const TYPES = ['Indoor with Rooftop', 'Outdoor', 'Indoor without roof'];

const DAYS_OF_WEEK = [
  { id: 1, label: 'Mon' },
  { id: 2, label: 'Tue' },
  { id: 3, label: 'Wed' },
  { id: 4, label: 'Thu' },
  { id: 5, label: 'Fri' },
  { id: 6, label: 'Sat' },
  { id: 0, label: 'Sun' },
];

const formatTime12Hour = (time24) => {
  if (!time24) return '';
  const [hourStr, minute] = time24.split(':');
  let hour = parseInt(hourStr, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12 || 12;
  return `${hour}:${minute} ${ampm}`;
};

const TurfRegistrationScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
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
      latitude: editTurf?.location?.coordinates?.[1]?.toString() || '',
      longitude: editTurf?.location?.coordinates?.[0]?.toString() || '',
      size: editTurf?.size || '5v5', 
      type: editTurf?.type || 'Outdoor', 
      weekdayDayPrice: editTurf?.pricing?.weekdayDay?.toString() || '', 
      weekdayNightPrice: editTurf?.pricing?.weekdayNight?.toString() || '', 
      weekendDayPrice: editTurf?.pricing?.weekendDay?.toString() || '', 
      weekendNightPrice: editTurf?.pricing?.weekendNight?.toString() || '',
      openTime: editTurf?.operatingHours?.openTime || '06:00',
      closeTime: editTurf?.operatingHours?.closeTime || '23:00',
      nightStartTime: editTurf?.operatingHours?.nightStartTime || '17:00',
      nightEndTime: editTurf?.operatingHours?.nightEndTime || '06:00',
      weekendDays: editTurf?.operatingHours?.weekendDays || [0, 6],
      amenities: editTurf?.amenities || {},
      googleMapsUrl: editTurf?.googleMapsUrl || ''
    }
  });

  const [coverImage, setCoverImage] = useState(editTurf?.coverImage ? { uri: editTurf.coverImage } : null);
  const [gallery, setGallery] = useState(editTurf?.gallery ? editTurf.gallery.map(uri => ({ uri })) : []);
  const [removedGallery, setRemovedGallery] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showOpenTimePicker, setShowOpenTimePicker] = useState(false);
  const [showCloseTimePicker, setShowCloseTimePicker] = useState(false);
  const [showNightTimePicker, setShowNightTimePicker] = useState(false);
  const [showNightEndTimePicker, setShowNightEndTimePicker] = useState(false);
  const [customSize1, setCustomSize1] = useState(editTurf && !SIZES.includes(editTurf.size) ? editTurf.size.split('v')[0]?.trim() || '' : '');
  const [customSize2, setCustomSize2] = useState(editTurf && !SIZES.includes(editTurf.size) ? editTurf.size.split('v')[1]?.trim() || '' : '');

  const loadingState = isLoading || isSubmitting;

  const amenitiesState = watch('amenities');

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
        if (result.assets[0].fileSize && result.assets[0].fileSize > 3 * 1024 * 1024) {
          showCustomAlert('File Too Large', 'Please select an image smaller than 3MB.');
          return;
        }
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
        const validAssets = result.assets.filter(asset => !asset.fileSize || asset.fileSize <= 3 * 1024 * 1024);
        if (validAssets.length < result.assets.length) {
          showCustomAlert('Some Files Too Large', 'Images larger than 3MB were skipped.');
        }
        if (validAssets.length > 0) {
          setGallery(prev => [...prev, ...validAssets]);
        }
      }
    } catch (error) {
      showCustomAlert('Error', 'Failed to pick images');
      console.log('Gallery image picker error:', error);
    }
  };

  const removeGalleryImage = (index) => {
    const imgToRemove = gallery[index];
    if (imgToRemove?.uri && typeof imgToRemove.uri === 'string' && !imgToRemove.fileName) {
      setRemovedGallery(prev => [...prev, imgToRemove.uri]);
    }
    setGallery(prev => prev.filter((_, i) => i !== index));
  };

  const toggleAmenity = (id) => {
    setValue('amenities', { ...amenitiesState, [id]: !amenitiesState[id] });
  };

  const toggleWeekendDay = (dayId) => {
    const current = watch('weekendDays') || [];
    if (current.includes(dayId)) {
      setValue('weekendDays', current.filter(id => id !== dayId));
    } else {
      setValue('weekendDays', [...current, dayId]);
    }
  };

  const onSubmit = async (data) => {
    if (!coverImage) return showCustomAlert('Error', 'Please select a cover image for your turf.');
    if (!data.weekendDays || data.weekendDays.length === 0) {
      return showCustomAlert('Validation Error', 'Please select at least one weekend day.');
    }
    
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('name', data.name);
      formData.append('description', data.description);
      formData.append('address', data.address);
      formData.append('city', data.city);
      if (data.latitude !== undefined && data.latitude !== null && data.latitude !== '') {
        formData.append('latitude', data.latitude);
      }
      if (data.longitude !== undefined && data.longitude !== null && data.longitude !== '') {
        formData.append('longitude', data.longitude);
      }
      formData.append('state', data.state);
      formData.append('pincode', data.pincode);
      formData.append('size', data.size);
      formData.append('type', data.type);
      formData.append('weekdayDayPrice', data.weekdayDayPrice || 0);
      formData.append('weekdayNightPrice', data.weekdayNightPrice || 0);
      formData.append('weekendDayPrice', data.weekendDayPrice || 0);
      formData.append('weekendNightPrice', data.weekendNightPrice || 0);
      formData.append('googleMapsUrl', data.googleMapsUrl || '');


      // Operating Hours & Settings
      formData.append('openTime', data.openTime);
      formData.append('closeTime', data.closeTime);
      formData.append('nightStartTime', data.nightStartTime);
      formData.append('nightEndTime', data.nightEndTime);
      formData.append('weekendDays', JSON.stringify(data.weekendDays));

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
    } catch (err) {
      console.log('Error submitting turf form:', err);
      showCustomAlert('Error', `Failed to ${isEditing ? 'update' : 'create'} turf`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const onError = (errors) => {
    const errorFields = Object.keys(errors).map(key => {
      let fieldLabel = key;
      if (key === 'name') fieldLabel = 'Turf Name';
      else if (key === 'address') fieldLabel = 'Street Address';
      else if (key === 'city') fieldLabel = 'City';
      else if (key === 'state') fieldLabel = 'State';
      else if (key === 'location') fieldLabel = 'Map Location';
      else if (key === 'landmark') fieldLabel = 'Landmark';
      else if (key === 'pincode') fieldLabel = 'Pincode';
      else if (key === 'size') fieldLabel = 'Size';
      
      const msg = errors[key]?.message || 'is invalid';
      return `• ${fieldLabel}: ${msg}`;
    }).join('\n');

    showCustomAlert('Validation Error', errorFields || 'Please fill all required fields correctly.');
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
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={28} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEditing ? 'Edit Turf' : 'Add New Turf'}</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : null} style={{ flex: 1 }}>
        <KeyboardAwareScrollView enableOnAndroid={true} extraScrollHeight={20} style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          
          {/* Media Section */}
          <Text style={styles.sectionTitle}>Turf Media (Max 3 MB per image)</Text>
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
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.galleryScroll}>
              {gallery.map((img, index) => (
                <View key={index} style={styles.galleryImageWrapper}>
                  <Image source={{ uri: getImageUrl(img.uri) }} style={styles.galleryImage} />
                  <TouchableOpacity style={styles.removeImageBtn} onPress={() => removeGalleryImage(index)}>
                    <Icon name="close" size={16} color="#FFF" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}

          {/* Basic Info */}
          <Text style={styles.sectionTitle}>Basic Info</Text>
          {renderInput('name', 'Turf Name *', { required: 'Name is required' })}
          {renderInput('description', 'Description', {}, false, true)}
          
          <View style={styles.row}>
            <View style={{ flex: 1, marginTop: Spacing.sm }}>
              <Text style={styles.label}>Size</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                <TouchableOpacity 
                  style={[styles.chip, !SIZES.includes(watch('size')) && styles.chipActive]}
                  onPress={() => {
                    if (SIZES.includes(watch('size'))) setValue('size', ''); 
                  }}
                >
                  <Text style={[styles.chipText, !SIZES.includes(watch('size')) && styles.chipTextActive]}>Other</Text>
                </TouchableOpacity>
                {SIZES.map(s => (
                  <TouchableOpacity 
                    key={s} 
                    style={[styles.chip, watch('size') === s && styles.chipActive]}
                    onPress={() => setValue('size', s)}
                  >
                    <Text style={[styles.chipText, watch('size') === s && styles.chipTextActive]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              {!SIZES.includes(watch('size')) && (
                <View style={[{ marginTop: Spacing.sm, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }]}>
                  <TextInput
                    style={[styles.input, { flex: 1, textAlign: 'center' }]}
                    placeholder="e.g. 50"
                    placeholderTextColor={Colors.textSecondary}
                    value={customSize1}
                    onChangeText={(val) => {
                      setCustomSize1(val);
                      setValue('size', `${val} v ${customSize2}`);
                    }}
                    keyboardType="numeric"
                  />
                  <Text style={{ color: Colors.textPrimary, fontSize: 16, fontWeight: 'bold' }}>v</Text>
                  <TextInput
                    style={[styles.input, { flex: 1, textAlign: 'center' }]}
                    placeholder="e.g. 50"
                    placeholderTextColor={Colors.textSecondary}
                    value={customSize2}
                    onChangeText={(val) => {
                      setCustomSize2(val);
                      setValue('size', `${customSize1} v ${val}`);
                    }}
                    keyboardType="numeric"
                  />
                </View>
              )}
            </View>
          </View>

          <View style={styles.row}>
            <View style={{ flex: 1, marginTop: Spacing.sm }}>
              <Text style={styles.label}>Type</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                {TYPES.map(t => (
                  <TouchableOpacity 
                    key={t} 
                    style={[styles.chip, watch('type') === t && styles.chipActive]}
                    onPress={() => setValue('type', t)}
                  >
                    <Text style={[styles.chipText, watch('type') === t && styles.chipTextActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
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
                      onChange(loc ? loc.name : '');
                      if (loc) {
                        setValue('latitude', String(loc.latitude));
                        setValue('longitude', String(loc.longitude));
                        if (loc.state) setValue('state', loc.state);
                      } else {
                        setValue('latitude', '');
                        setValue('longitude', '');
                        setValue('state', '');
                      }
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

          {/* Google Maps Location */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Google Maps Location</Text>
            <Controller
              control={control}
              name="googleMapsUrl"
              rules={{
                validate: (value) => {
                  if (!value) return true; // Optional field
                  const isGMap = value.includes('google.com') || value.includes('goo.gl');
                  const isUnsafe = value.startsWith('javascript:') || value.startsWith('data:') || value.startsWith('file:');
                  if (!isGMap || isUnsafe) {
                    return 'Please enter a valid Google Maps location link.';
                  }
                  return true;
                }
              }}
              render={({ field: { onChange, onBlur, value } }) => (
                <View style={styles.inputWrapper}>
                  <Icon name="google-maps" size={18} color={Colors.textTertiary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.inputField}
                    placeholder="Paste Google Maps link"
                    placeholderTextColor={Colors.textSecondary}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    value={value}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              )}
            />
            {errors.googleMapsUrl && <Text style={styles.errorText}>{errors.googleMapsUrl.message}</Text>}
            <Text style={styles.helperText}>
              Open Google Maps → find your turf → Share → Copy link → paste it here.
            </Text>
          </View>

          {/* Operating Hours */}
          <Text style={styles.sectionTitle}>Operating Hours & Pricing Rules</Text>
          <View style={styles.rowInputs}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.label}>Open Time</Text>
              <TouchableOpacity style={[styles.input, { justifyContent: 'center' }]} onPress={() => setShowOpenTimePicker(true)}>
                <Text style={{ color: watch('openTime') ? Colors.textPrimary : Colors.textSecondary, textAlign: 'center' }}>
                  {watch('openTime') ? formatTime12Hour(watch('openTime')) : 'Select Time'}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={styles.label}>Close Time</Text>
              <TouchableOpacity style={[styles.input, { justifyContent: 'center' }]} onPress={() => setShowCloseTimePicker(true)}>
                <Text style={{ color: watch('closeTime') ? Colors.textPrimary : Colors.textSecondary, textAlign: 'center' }}>
                  {watch('closeTime') ? formatTime12Hour(watch('closeTime')) : 'Select Time'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          
          <View style={[styles.rowInputs, { marginTop: Spacing.sm }]}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.label}>Lights Provided</Text>
              <TouchableOpacity style={[styles.input, { justifyContent: 'center' }]} onPress={() => setShowNightTimePicker(true)}>
                <Text style={{ color: watch('nightStartTime') ? Colors.textPrimary : Colors.textSecondary, textAlign: 'center' }}>
                  {watch('nightStartTime') ? formatTime12Hour(watch('nightStartTime')) : 'Select Time'}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={styles.label}>Lights Offed</Text>
              <TouchableOpacity style={[styles.input, { justifyContent: 'center' }]} onPress={() => setShowNightEndTimePicker(true)}>
                <Text style={{ color: watch('nightEndTime') ? Colors.textPrimary : Colors.textSecondary, textAlign: 'center' }}>
                  {watch('nightEndTime') ? formatTime12Hour(watch('nightEndTime')) : 'Select Time'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={{ marginTop: Spacing.md, paddingHorizontal: Spacing.sm }}>
            <Text style={styles.label}>Select Weekend Days</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 }}>
              {DAYS_OF_WEEK.map(day => (
                <TouchableOpacity
                  key={day.id}
                  style={[styles.chip, (watch('weekendDays') || []).includes(day.id) && styles.chipActive]}
                  onPress={() => toggleWeekendDay(day.id)}
                >
                  <Text style={[styles.chipText, (watch('weekendDays') || []).includes(day.id) && styles.chipTextActive]}>
                    {day.label}
                  </Text>
                </TouchableOpacity>
              ))}
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

        </KeyboardAwareScrollView>

        <View style={styles.bottomButtonContainer}>
          <TouchableOpacity 
            style={[styles.submitButton, loadingState && styles.submitButtonDisabled, { marginTop: 0 }]} 
            onPress={handleSubmit(onSubmit, onError)}
            disabled={loadingState}
          >
            {loadingState ? (
              <ActivityIndicator color="#000" size="small" />
            ) : (
              <Text style={styles.submitButtonText}>{isEditing ? 'Update Turf' : 'Register Turf'}</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
      
      {showOpenTimePicker && (
        <CustomTimePicker
          visible={showOpenTimePicker}
          title="Select Open Time"
          initialTime={watch('openTime')}
          onClose={() => setShowOpenTimePicker(false)}
          onSelect={(time) => setValue('openTime', time)}
        />
      )}
      
      {showCloseTimePicker && (
        <CustomTimePicker
          visible={showCloseTimePicker}
          title="Select Close Time"
          initialTime={watch('closeTime')}
          onClose={() => setShowCloseTimePicker(false)}
          onSelect={(time) => setValue('closeTime', time)}
        />
      )}
      
      {showNightTimePicker && (
        <CustomTimePicker
          visible={showNightTimePicker}
          title="Select Lights Provided Time"
          initialTime={watch('nightStartTime')}
          onClose={() => setShowNightTimePicker(false)}
          onSelect={(time) => setValue('nightStartTime', time)}
        />
      )}
      
      {showNightEndTimePicker && (
        <CustomTimePicker
          visible={showNightEndTimePicker}
          title="Select Lights Offed Time"
          initialTime={watch('nightEndTime')}
          onClose={() => setShowNightEndTimePicker(false)}
          onSelect={(time) => setValue('nightEndTime', time)}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', 
    paddingHorizontal: Spacing.xl, paddingBottom: Spacing.lg,
    backgroundColor: Colors.backgroundCard, borderBottomWidth: 1, borderBottomColor: Colors.border
  },
  backButton: { width: 40, height: 40, justifyContent: 'center' },
  
  // Header Title & Status Badge
  headerTitleWrap: { alignItems: 'center' },
  headerTitle: { fontSize: 18, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary },
  statusBadge: { 
    flexDirection: 'row', alignItems: 'center', gap: 5, 
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, marginTop: 2 
  },
  statusBadgeCreate: { backgroundColor: 'rgba(76, 175, 80, 0.15)', borderWidth: 1, borderColor: Colors.success },
  statusBadgeEdit: { backgroundColor: 'rgba(255, 204, 0, 0.15)', borderWidth: 1, borderColor: Colors.primary },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusDotCreate: { backgroundColor: Colors.success },
  statusDotEdit: { backgroundColor: Colors.primary },
  statusBadgeText: { fontSize: 10, fontFamily: Typography.fontFamily.bold },
  statusBadgeTextCreate: { color: Colors.success },
  statusBadgeTextEdit: { color: Colors.primary },

  // Scroll & Sections
  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.lg, paddingBottom: 100 },
  sectionTitle: { fontSize: 16, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary, marginTop: Spacing.md, marginBottom: Spacing.sm },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: Spacing.md, marginBottom: Spacing.sm },
  
  // Mode Banner
  modeBanner: { 
    flexDirection: 'row', alignItems: 'center', gap: 8, 
    padding: Spacing.md, borderRadius: BorderRadius.lg, marginBottom: Spacing.md, borderWidth: 1 
  },
  modeBannerCreate: { backgroundColor: 'rgba(76, 175, 80, 0.08)', borderColor: 'rgba(76, 175, 80, 0.3)' },
  modeBannerEdit: { backgroundColor: 'rgba(255, 204, 0, 0.08)', borderColor: 'rgba(255, 204, 0, 0.3)' },
  modeBannerText: { fontSize: 13, fontFamily: Typography.fontFamily.medium, flex: 1 },
  modeBannerTextCreate: { color: Colors.success },
  modeBannerTextEdit: { color: Colors.primary },

  // Inputs & Groups
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
    flex: 1, color: Colors.textPrimary, fontFamily: Typography.fontFamily.medium, fontSize: 14, padding: 0,
  },
  textArea: { height: 100, textAlignVertical: 'top', paddingTop: Spacing.md },
  inputError: { borderColor: Colors.error },
  errorText: { color: Colors.error, fontSize: 12, marginTop: 4, marginLeft: 4 },
  row: { marginBottom: Spacing.sm },
  rowInputs: { flexDirection: 'row', marginBottom: Spacing.sm },
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
  submitButtonText: { color: '#000', fontSize: 16, fontFamily: Typography.fontFamily.bold },
  bottomButtonContainer: {
    padding: Spacing.md,
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },

  // Loading Overlay
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justify: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  loadingCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    width: '80%',
  },
  loadingTitle: {
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.bold,
    fontSize: 16,
    marginTop: Spacing.md,
    textAlign: 'center',
  },
  loadingSubtitle: {
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.regular,
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  helperText: {
    color: Colors.textTertiary,
    fontSize: 11,
    marginTop: 6,
    marginLeft: 4,
    fontFamily: Typography.fontFamily.medium,
  },
});

export default TurfRegistrationScreen;
