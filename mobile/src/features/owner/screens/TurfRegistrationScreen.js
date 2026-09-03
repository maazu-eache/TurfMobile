import React, { useState, useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LocationAutocomplete from '../../../components/LocationAutocomplete';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  Image, KeyboardAvoidingView, Platform, ActivityIndicator, Modal, StatusBar
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { launchImageLibrary } from 'react-native-image-picker';
import { useForm, Controller } from 'react-hook-form';
import { Typography, Spacing, BorderRadius } from '../../../theme/theme';
import { useTheme } from '../../../theme/ThemeContext';
import { createTurf, updateTurf } from '../../turf/turfSlice';
import api, { getImageUrl } from '../../../api/axios';
import { showCustomAlert } from '../../../components/CustomAlert';
import CustomTimePicker from '../../../components/CustomTimePicker';
import DateTimePicker from '@react-native-community/datetimepicker';
import moment from 'moment';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

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
  const { colors, isDark, shadows } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark, shadows), [colors, isDark, shadows]);

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
      bookingMode: editTurf?.bookingMode || '60_min',
      specialDays: editTurf?.specialDays || [],
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
  const [showOccasionModal, setShowOccasionModal] = useState(false);
  const [tempOccasionDate, setTempOccasionDate] = useState('');
  const [occasionName, setOccasionName] = useState('');
  const [calendarMonth, setCalendarMonth] = useState(moment().startOf('month'));
  const [showSpecialDaysModal, setShowSpecialDaysModal] = useState(false);
  const [showSpecialDayDetailModal, setShowSpecialDayDetailModal] = useState(false);
  const [selectedSpecialDayDetail, setSelectedSpecialDayDetail] = useState(null);
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
      formData.append('bookingMode', data.bookingMode);
      formData.append('specialDays', JSON.stringify(data.specialDays || []));

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
            placeholderTextColor={colors.textTertiary}
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
          <Icon name="arrow-left" size={28} color={colors.textPrimary} />
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
                <Icon name="camera-plus" size={40} color={isDark ? colors.primary : colors.primaryDark} />
                <Text style={styles.uploadText}>Upload Cover Image *</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.galleryUpload} onPress={pickGalleryImages}>
            <Icon name="image-multiple" size={24} color={isDark ? colors.primary : colors.primaryDark} />
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
                    placeholderTextColor={colors.textSecondary}
                    value={customSize1}
                    onChangeText={(val) => {
                      setCustomSize1(val);
                      setValue('size', `${val} v ${customSize2}`);
                    }}
                    keyboardType="numeric"
                  />
                  <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: 'bold' }}>v</Text>
                  <TextInput
                    style={[styles.input, { flex: 1, textAlign: 'center' }]}
                    placeholder="e.g. 50"
                    placeholderTextColor={colors.textSecondary}
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
            <Icon name="map-marker-outline" size={20} color={isDark ? colors.primary : colors.primaryDark} />
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
                  <Icon name="road" size={18} color={colors.textTertiary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.inputField}
                    placeholder="e.g. 24 Main Road, Koramangala"
                    placeholderTextColor={colors.textTertiary}
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
                      <Icon name="map" size={18} color={colors.textTertiary} style={styles.inputIcon} />
                      <TextInput
                        style={styles.inputField}
                        placeholder="State"
                        placeholderTextColor={colors.textTertiary}
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
                      <Icon name="numeric" size={18} color={colors.textTertiary} style={styles.inputIcon} />
                      <TextInput
                        style={styles.inputField}
                        placeholder="e.g. 560001"
                        placeholderTextColor={colors.textTertiary}
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
                  <Icon name="google-maps" size={18} color={colors.textTertiary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.inputField}
                    placeholder="Paste Google Maps link"
                    placeholderTextColor={colors.textSecondary}
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
                <Text style={{ color: watch('openTime') ? colors.textPrimary : colors.textSecondary, textAlign: 'center' }}>
                  {watch('openTime') ? formatTime12Hour(watch('openTime')) : 'Select Time'}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={styles.label}>Close Time</Text>
              <TouchableOpacity style={[styles.input, { justifyContent: 'center' }]} onPress={() => setShowCloseTimePicker(true)}>
                <Text style={{ color: watch('closeTime') ? colors.textPrimary : colors.textSecondary, textAlign: 'center' }}>
                  {watch('closeTime') ? formatTime12Hour(watch('closeTime')) : 'Select Time'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          
          <View style={[styles.rowInputs, { marginTop: Spacing.sm }]}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.label}>Lights Provided</Text>
              <TouchableOpacity style={[styles.input, { justifyContent: 'center' }]} onPress={() => setShowNightTimePicker(true)}>
                <Text style={{ color: watch('nightStartTime') ? colors.textPrimary : colors.textSecondary, textAlign: 'center' }}>
                  {watch('nightStartTime') ? formatTime12Hour(watch('nightStartTime')) : 'Select Time'}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={styles.label}>Lights Offed</Text>
              <TouchableOpacity style={[styles.input, { justifyContent: 'center' }]} onPress={() => setShowNightEndTimePicker(true)}>
                <Text style={{ color: watch('nightEndTime') ? colors.textPrimary : colors.textSecondary, textAlign: 'center' }}>
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

          {/* Booking Mode */}
          <View style={{ marginTop: Spacing.md, paddingHorizontal: Spacing.sm }}>
            <Text style={styles.label}>Supported Booking Mode</Text>
            <View style={styles.bookingModeGrid}>
              {[
                { id: '60_min', title: '1 Hour', subtitle: '60 Mins Only', icon: 'clock-outline', defaultTag: true },
                { id: '30_min', title: '30 Mins', subtitle: '30 Mins Only', icon: 'timer-sand' },
                { id: 'both', title: 'Both Modes', subtitle: '30m & 1 Hour', icon: 'star-circle-outline' },
              ].map(mode => {
                const isSelected = watch('bookingMode') === mode.id;
                return (
                  <TouchableOpacity
                    key={mode.id}
                    activeOpacity={0.85}
                    style={[
                      styles.bookingModeCard,
                      isSelected && styles.bookingModeCardActive
                    ]}
                    onPress={() => setValue('bookingMode', mode.id)}
                  >
                    {mode.defaultTag && (
                      <View style={styles.defaultModeBadge}>
                        <Text style={styles.defaultModeBadgeText}>DEFAULT</Text>
                      </View>
                    )}
                    <Icon
                      name={mode.icon}
                      size={20}
                      color={isSelected ? '#FFD400' : 'rgba(255,255,255,0.4)'}
                      style={{ marginBottom: 6, marginTop: mode.defaultTag ? 2 : 0 }}
                    />
                    <Text style={[styles.bookingModeTitle, isSelected && styles.bookingModeTitleActive]}>
                      {mode.title}
                    </Text>
                    <Text style={[styles.bookingModeSub, isSelected && styles.bookingModeSubActive]}>
                      {mode.subtitle}
                    </Text>

                    <View style={[styles.bookingModeRadio, isSelected && styles.bookingModeRadioActive]}>
                      {isSelected && <View style={styles.bookingModeRadioInner} />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Special Days Trigger Button */}
          <View style={{ marginTop: Spacing.md, paddingHorizontal: Spacing.sm }}>
            <Text style={styles.label}>Special Days (Always Weekend Price)</Text>
            <TouchableOpacity
              style={styles.specialDaysTriggerBtn}
              activeOpacity={0.8}
              onPress={() => setShowSpecialDaysModal(true)}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <View style={styles.specialDaysIconWrap}>
                  <Icon name="calendar-star" size={22} color="#FFD400" />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.specialDaysTriggerTitle}>Manage Special Days</Text>
                  <Text style={styles.specialDaysTriggerSubtitle}>
                    {watch('specialDays')?.length > 0
                      ? `${watch('specialDays').length} date(s) marked for weekend pricing`
                      : 'Tap to select festival & holiday dates'}
                  </Text>
                </View>
              </View>
              <Icon name="chevron-right" size={20} color="rgba(255,255,255,0.4)" />
            </TouchableOpacity>
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
                  <Icon name={amenity.icon} size={24} color={isActive ? isDark ? colors.primary : colors.primaryDark : colors.textTertiary} />
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
      
      {/* DatePicker modal removed since we select inline in calendar */}

      {showOccasionModal && (
        <Modal visible={showOccasionModal} transparent={true} animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Add Special Occasion</Text>
              <Text style={styles.modalLabel}>Selected Date</Text>
              <Text style={styles.modalValue}>
                {moment(tempOccasionDate, 'YYYY-MM-DD').format('dddd, MMMM DD, YYYY')}
              </Text>
              
              <Text style={[styles.modalLabel, { marginTop: 12 }]}>Occasion Name</Text>
              <TextInput
                style={styles.modalTextInput}
                placeholder="e.g. Diwali, Independence Day"
                placeholderTextColor="rgba(255,255,255,0.4)"
                value={occasionName}
                onChangeText={setOccasionName}
              />
              
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.modalBtnCancel]}
                  onPress={() => {
                    setShowOccasionModal(false);
                    setOccasionName('');
                  }}
                >
                  <Text style={styles.modalBtnCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.modalBtnConfirm]}
                  onPress={() => {
                    const current = watch('specialDays') || [];
                    if (!current.some(d => d.date === tempOccasionDate)) {
                      setValue('specialDays', [
                        ...current,
                        { date: tempOccasionDate, occasion: occasionName.trim() || 'Special Day' }
                      ]);
                    }
                    setShowOccasionModal(false);
                    setOccasionName('');
                  }}
                >
                  <Text style={styles.modalBtnConfirmText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Special Days Calendar Modal */}
      {showSpecialDaysModal && (
        <Modal visible={showSpecialDaysModal} transparent={true} animationType="fade">
          <View style={styles.specialModalOverlay}>
            <View style={styles.specialModalCard}>
              <View style={styles.specialModalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.specialModalTitle}>Special Days Calendar</Text>
                  <Text style={styles.specialModalSubtitle}>
                    Tap a date to add, or tap a yellow date to view/remove.
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setShowSpecialDaysModal(false)}
                  style={styles.specialModalCloseBtn}
                >
                  <Icon name="close" size={18} color="#FFF" />
                </TouchableOpacity>
              </View>

              {/* Month Switcher */}
              <View style={styles.regCalendarHeader}>
                <TouchableOpacity onPress={() => setCalendarMonth(moment(calendarMonth).subtract(1, 'month'))}>
                  <Icon name="chevron-left" size={22} color="#FFF" />
                </TouchableOpacity>
                <Text style={styles.regCalendarTitle}>{calendarMonth.format('MMMM YYYY')}</Text>
                <TouchableOpacity onPress={() => setCalendarMonth(moment(calendarMonth).add(1, 'month'))}>
                  <Icon name="chevron-right" size={22} color="#FFF" />
                </TouchableOpacity>
              </View>

              {/* Grid */}
              <View style={styles.regCalendarGrid}>
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                  <Text key={i} style={styles.regDayOfWeek}>{d}</Text>
                ))}
                {(() => {
                  const startDay = moment(calendarMonth).startOf('month').day();
                  const daysInMonth = moment(calendarMonth).daysInMonth();
                  const grid = [];

                  for (let i = 0; i < startDay; i++) {
                    grid.push(<View key={`empty-${i}`} style={styles.regCalDay} />);
                  }

                  const specialDaysList = watch('specialDays') || [];

                  for (let i = 1; i <= daysInMonth; i++) {
                    const d = moment(calendarMonth).date(i);
                    const dStr = d.format('YYYY-MM-DD');
                    const isPast = d.isBefore(moment(), 'day');
                    const specDay = specialDaysList.find(sd => sd.date === dStr);
                    const isSpecial = !!specDay;

                    grid.push(
                      <TouchableOpacity
                        key={`day-${i}`}
                        style={[
                          styles.regCalDay,
                          isSpecial && styles.regCalDaySpecial
                        ]}
                        disabled={isPast}
                        onPress={() => {
                          if (isSpecial) {
                            setSelectedSpecialDayDetail(specDay);
                            setShowSpecialDayDetailModal(true);
                          } else {
                            setTempOccasionDate(dStr);
                            setOccasionName('');
                            setShowOccasionModal(true);
                          }
                        }}
                      >
                        <Text style={[
                          styles.regCalDayText,
                          isPast && { color: 'rgba(255,255,255,0.25)' },
                          isSpecial && { color: '#000', fontFamily: Typography.fontFamily.bold }
                        ]}>
                          {i}
                        </Text>
                        {isSpecial && (
                          <Text numberOfLines={1} style={styles.regCalDayOccasion}>
                            {specDay.occasion}
                          </Text>
                        )}
                      </TouchableOpacity>
                    );
                  }
                  return grid;
                })()}
              </View>

              <TouchableOpacity
                style={styles.specialModalDoneBtn}
                onPress={() => setShowSpecialDaysModal(false)}
              >
                <Text style={styles.specialModalDoneBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* Special Day Detail & Remove Modal */}
      {showSpecialDayDetailModal && selectedSpecialDayDetail && (
        <Modal visible={showSpecialDayDetailModal} transparent={true} animationType="fade">
          <View style={styles.specialModalOverlay}>
            <View style={[styles.specialModalCard, { width: '88%', padding: 20 }]}>
              <View style={{ alignItems: 'center', marginBottom: 16 }}>
                <View style={styles.specialDayDetailIconWrap}>
                  <Icon name="calendar-star" size={26} color="#FFD400" />
                </View>
                <Text style={styles.specialDayDetailDate}>
                  {moment(selectedSpecialDayDetail.date, 'YYYY-MM-DD').format('dddd, DD MMMM YYYY')}
                </Text>
                <View style={styles.specialDayDetailBadge}>
                  <Text style={styles.specialDayDetailBadgeText}>
                    Occasion: {selectedSpecialDayDetail.occasion}
                  </Text>
                </View>
                <Text style={styles.specialDayDetailDesc}>
                  Weekend pricing will be applied automatically on this day.
                </Text>
              </View>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity
                  style={styles.specialDayDetailCancelBtn}
                  onPress={() => {
                    setShowSpecialDayDetailModal(false);
                    setSelectedSpecialDayDetail(null);
                  }}
                >
                  <Text style={styles.specialDayDetailCancelText}>Close</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.specialDayDetailRemoveBtn}
                  onPress={() => {
                    const current = watch('specialDays') || [];
                    setValue('specialDays', current.filter(sd => sd.date !== selectedSpecialDayDetail.date));
                    setShowSpecialDayDetailModal(false);
                    setSelectedSpecialDayDetail(null);
                    showCustomAlert('Removed', 'Special day removed successfully.');
                  }}
                >
                  <Icon name="trash-can-outline" size={16} color="#FFF" style={{ marginRight: 6 }} />
                  <Text style={styles.specialDayDetailRemoveText}>Remove</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
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

const createStyles = (colors, isDark, shadows) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', 
    paddingHorizontal: Spacing.xl, paddingBottom: Spacing.lg,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border
  },
  backButton: { width: 40, height: 40, justifyContent: 'center' },
  
  // Header Title & Status Badge
  headerTitleWrap: { alignItems: 'center' },
  headerTitle: { fontSize: 18, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary },
  statusBadge: { 
    flexDirection: 'row', alignItems: 'center', gap: 5, 
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, marginTop: 2 
  },
  statusBadgeCreate: { backgroundColor: 'rgba(76, 175, 80, 0.15)', borderWidth: 1, borderColor: isDark ? '#4CAF50' : '#2E7D32' },
  statusBadgeEdit: { backgroundColor: 'rgba(255, 204, 0, 0.15)', borderWidth: 1, borderColor: isDark ? colors.primary : colors.primaryDark },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusDotCreate: { backgroundColor: isDark ? '#4CAF50' : '#2E7D32' },
  statusDotEdit: { backgroundColor: isDark ? colors.primary : colors.primaryDark },
  statusBadgeText: { fontSize: 10, fontFamily: Typography.fontFamily.bold },
  statusBadgeTextCreate: { color: isDark ? '#4CAF50' : '#2E7D32' },
  statusBadgeTextEdit: { color: isDark ? colors.primary : colors.primaryDark },

  // Scroll & Sections
  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.lg, paddingBottom: 100 },
  sectionTitle: { fontSize: 16, fontFamily: Typography.fontFamily.bold, color: colors.textPrimary, marginTop: Spacing.md, marginBottom: Spacing.sm },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: Spacing.md, marginBottom: Spacing.sm },
  
  // Mode Banner
  modeBanner: { 
    flexDirection: 'row', alignItems: 'center', gap: 8, 
    padding: Spacing.md, borderRadius: BorderRadius.lg, marginBottom: Spacing.md, borderWidth: 1 
  },
  modeBannerCreate: { backgroundColor: 'rgba(76, 175, 80, 0.08)', borderColor: 'rgba(76, 175, 80, 0.3)' },
  modeBannerEdit: { backgroundColor: 'rgba(255, 204, 0, 0.08)', borderColor: 'rgba(255, 204, 0, 0.3)' },
  modeBannerText: { fontSize: 13, fontFamily: Typography.fontFamily.medium, flex: 1 },
  modeBannerTextCreate: { color: isDark ? '#4CAF50' : '#2E7D32' },
  modeBannerTextEdit: { color: isDark ? colors.primary : colors.primaryDark },

  // Inputs & Groups
  inputGroup: { marginBottom: Spacing.md },
  input: { 
    backgroundColor: colors.surfaceVariant, borderRadius: BorderRadius.lg, 
    borderWidth: 1, borderColor: colors.border, paddingHorizontal: Spacing.lg, 
    height: 52, color: colors.textPrimary, fontFamily: Typography.fontFamily.medium 
  },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surfaceVariant, borderRadius: BorderRadius.lg,
    borderWidth: 1, borderColor: colors.border, height: 52, paddingHorizontal: Spacing.md,
  },
  inputWrapperError: { borderColor: colors.error },
  inputIcon: { marginRight: 8 },

  /* ── Special Day Occasion Modal Styles ── */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    backgroundColor: colors.surfaceVariant,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: Typography.fontFamily.bold,
    color: colors.textPrimary,
    marginBottom: 16,
    textAlign: 'center',
  },
  modalLabel: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.bold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  modalValue: {
    fontSize: 14,
    fontFamily: Typography.fontFamily.medium,
    color: '#FFD400',
  },
  modalTextInput: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.textPrimary,
    fontFamily: Typography.fontFamily.regular,
    fontSize: 14,
    marginTop: 6,
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnCancel: {
    backgroundColor: colors.surfaceVariant,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalBtnCancelText: {
    color: colors.textPrimary,
    fontFamily: Typography.fontFamily.bold,
    fontSize: 14,
  },
  modalBtnConfirm: {
    backgroundColor: '#FFD400',
  },
  modalBtnConfirmText: {
    color: '#000',
    fontFamily: Typography.fontFamily.bold,
    fontSize: 14,
  },
  inputField: {
    flex: 1, color: colors.textPrimary, fontFamily: Typography.fontFamily.medium, fontSize: 14, padding: 0,
  },
  textArea: { height: 100, textAlignVertical: 'top', paddingTop: Spacing.md },
  inputError: { borderColor: colors.error },
  errorText: { color: colors.error, fontSize: 12, marginTop: 4, marginLeft: 4 },
  row: { marginBottom: Spacing.sm },
  rowInputs: { flexDirection: 'row', marginBottom: Spacing.sm },
  label: { color: colors.textSecondary, fontFamily: Typography.fontFamily.medium, fontSize: 13, marginBottom: 6 },
  
  // Chips
  chipScroll: { flexDirection: 'row' },
  chip: { 
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, 
    backgroundColor: colors.surfaceVariant, borderWidth: 1, borderColor: colors.border, marginRight: 8 
  },
  chipActive: { backgroundColor: isDark ? 'rgba(255, 204, 0, 0.15)' : '#FFF9DB', borderColor: isDark ? colors.primary : colors.primaryDark },
  chipText: { color: colors.textSecondary, fontFamily: Typography.fontFamily.medium },
  chipTextActive: { color: isDark ? colors.primary : colors.primaryDark, fontFamily: Typography.fontFamily.bold },

  // Media
  coverUpload: { 
    height: 180, backgroundColor: colors.surfaceVariant, borderRadius: BorderRadius.xl, 
    borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed', 
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden' 
  },
  coverImagePreview: { width: '100%', height: '100%' },
  uploadPlaceholder: { alignItems: 'center' },
  uploadText: { color: isDark ? colors.primary : colors.primaryDark, marginTop: 8, fontFamily: Typography.fontFamily.medium },
  galleryUpload: { 
    marginTop: Spacing.md, padding: Spacing.md, backgroundColor: colors.surfaceVariant, 
    borderRadius: BorderRadius.lg, alignItems: 'center', borderWidth: 1, borderColor: colors.border,
    flexDirection: 'row', justifyContent: 'center', gap: 8
  },
  galleryText: { color: isDark ? colors.primary : colors.primaryDark, fontFamily: Typography.fontFamily.bold },
  galleryScroll: { marginTop: Spacing.md, flexDirection: 'row' },
  galleryImageWrapper: { width: 100, height: 100, marginRight: Spacing.md, borderRadius: BorderRadius.md, overflow: 'hidden', position: 'relative' },
  galleryImage: { width: '100%', height: '100%' },
  removeImageBtn: { position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12, padding: 4 },

  // Amenities
  amenitiesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' },
  amenityCard: { 
    width: '48%', backgroundColor: colors.surfaceVariant, padding: Spacing.md, 
    borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: colors.border, 
    flexDirection: 'row', alignItems: 'center', gap: 10 
  },
  amenityCardActive: { backgroundColor: isDark ? 'rgba(255, 204, 0, 0.15)' : '#FFF9DB', borderColor: isDark ? colors.primary : colors.primaryDark },
  amenityText: { color: colors.textTertiary, fontFamily: Typography.fontFamily.medium, fontSize: 13, flex: 1 },
  amenityTextActive: { color: isDark ? colors.primary : colors.primaryDark, fontFamily: Typography.fontFamily.bold },

  // Submit
  submitButton: { 
    backgroundColor: isDark ? colors.primary : colors.primaryDark, paddingVertical: 16, borderRadius: BorderRadius.lg, 
    alignItems: 'center', marginTop: Spacing['2xl'] 
  },
  submitButtonDisabled: { opacity: 0.7 },
  submitButtonText: { color: '#000', fontSize: 16, fontFamily: Typography.fontFamily.bold },
  bottomButtonContainer: {
    padding: Spacing.md,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },

  // Loading Overlay
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  loadingCard: {
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    width: '80%',
  },
  loadingTitle: {
    color: colors.textPrimary,
    fontFamily: Typography.fontFamily.bold,
    fontSize: 16,
    marginTop: Spacing.md,
    textAlign: 'center',
  },
  loadingSubtitle: {
    color: colors.textSecondary,
    fontFamily: Typography.fontFamily.regular,
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  helperText: {
    color: colors.textTertiary,
    fontSize: 11,
    marginTop: 6,
    marginLeft: 4,
    fontFamily: Typography.fontFamily.medium,
  },

  /* ── Special Days Styles ── */
  specialDaysTriggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceVariant,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginTop: 6,
  },
  specialDaysIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 212, 0, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  specialDaysTriggerTitle: {
    fontSize: 14,
    fontFamily: Typography.fontFamily.bold,
    color: colors.textPrimary,
  },
  specialDaysTriggerSubtitle: {
    fontSize: 11,
    fontFamily: Typography.fontFamily.medium,
    color: colors.textSecondary,
    marginTop: 2,
  },
  specialModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  specialModalCard: {
    width: '100%',
    backgroundColor: colors.surfaceVariant,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
  },
  specialModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
    marginBottom: 12,
  },
  specialModalTitle: {
    fontSize: 16,
    fontFamily: Typography.fontFamily.bold,
    color: colors.textPrimary,
  },
  specialModalSubtitle: {
    fontSize: 11,
    fontFamily: Typography.fontFamily.medium,
    color: colors.textSecondary,
    marginTop: 2,
  },
  specialModalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#222',
    alignItems: 'center',
    justifyContent: 'center',
  },
  specialModalDoneBtn: {
    backgroundColor: '#FFD400',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 14,
  },
  specialModalDoneBtnText: {
    color: '#000',
    fontSize: 13,
    fontFamily: Typography.fontFamily.bold,
  },
  specialDayDetailIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255, 212, 0, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  specialDayDetailDate: {
    fontSize: 15,
    fontFamily: Typography.fontFamily.bold,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  specialDayDetailBadge: {
    backgroundColor: 'rgba(255, 212, 0, 0.15)',
    borderWidth: 1,
    borderColor: '#FFD400',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginTop: 8,
  },
  specialDayDetailBadgeText: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.bold,
    color: '#FFD400',
  },
  specialDayDetailDesc: {
    fontSize: 11,
    fontFamily: Typography.fontFamily.medium,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },
  specialDayDetailCancelBtn: {
    flex: 1,
    backgroundColor: '#222',
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  specialDayDetailCancelText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontFamily: Typography.fontFamily.medium,
  },
  specialDayDetailRemoveBtn: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#FF4757',
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  specialDayDetailRemoveText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontFamily: Typography.fontFamily.bold,
  },

  /* ── Calendar Grid Styles ── */
  regCalendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    paddingHorizontal: 8,
  },
  regCalendarTitle: {
    color: colors.textPrimary,
    fontFamily: Typography.fontFamily.bold,
    fontSize: 14,
  },
  regCalendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  regDayOfWeek: {
    width: '14.28%',
    textAlign: 'center',
    color: colors.textTertiary,
    fontSize: 12,
    fontFamily: Typography.fontFamily.bold,
    marginBottom: 10,
  },
  regCalDay: {
    width: '14.28%',
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    marginBottom: 4,
    position: 'relative',
    paddingTop: 4,
  },
  regCalDaySpecial: {
    backgroundColor: '#FFD400',
  },
  regCalDayText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontFamily: Typography.fontFamily.medium,
  },
  regCalDayOccasion: {
    color: '#000',
    fontSize: 7,
    fontFamily: Typography.fontFamily.bold,
    marginTop: 2,
    textAlign: 'center',
    paddingHorizontal: 2,
    width: '100%',
  },
  /* ── Booking Mode Cards ── */
  bookingModeGrid: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  bookingModeCard: {
    flex: 1,
    backgroundColor: colors.surfaceVariant,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingVertical: 12,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  bookingModeCardActive: {
    borderColor: '#FFD400',
    backgroundColor: 'rgba(255, 212, 0, 0.08)',
  },
  defaultModeBadge: {
    position: 'absolute',
    top: -7,
    backgroundColor: '#FFD400',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  defaultModeBadgeText: {
    color: '#000',
    fontSize: 7,
    fontFamily: Typography.fontFamily.bold,
    letterSpacing: 0.5,
  },
  bookingModeTitle: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.bold,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  bookingModeTitleActive: {
    color: '#FFD400',
  },
  bookingModeSub: {
    fontSize: 8,
    fontFamily: Typography.fontFamily.medium,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: 2,
    marginBottom: 8,
  },
  bookingModeSubActive: {
    color: 'rgba(255,212,0,0.8)',
  },
  bookingModeRadio: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookingModeRadioActive: {
    borderColor: '#FFD400',
  },
  bookingModeRadioInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFD400',
  },
});

export default TurfRegistrationScreen;
