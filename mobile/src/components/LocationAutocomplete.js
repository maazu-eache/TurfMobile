import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Modal, FlatList,
  Keyboard, Animated,
} from 'react-native';
import { Colors, Typography, BorderRadius } from '../theme/theme';
import Icon from 'react-native-vector-icons/Ionicons';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import api from '../api/axios';

/**
 * LocationAutocomplete
 *
 * Enforces that the user must select a city from the dropdown.
 * If the typed text has no results, a guidance banner tells the user
 * to try a broader/well-known city name (e.g. "Chennai" instead of "Saidapet").
 *
 * Props
 * ─────
 *  value            – controlled text value
 *  onChangeText     – called on every keystroke (raw text)
 *  onSelectLocation – called with { name, fullName, latitude, longitude, state }
 *                     OR null when cleared
 *  placeholder      – input placeholder text
 *  style            – outer View style override
 *  variant          – 'standard' | 'outlined' | 'none'
 *  error            – show error border (outlined only)
 *  icon             – Ionicons icon name for the left icon
 */
const LocationAutocomplete = ({
  value,
  onChangeText,
  onSelectLocation,
  placeholder = 'Search city or area...',
  style,
  variant = 'standard',
  error,
  icon = 'location-outline',
}) => {
  const [query, setQuery] = useState(value ?? '');
  const [results, setResults] = useState([]);
  const [searched, setSearched] = useState(false); // true after at least one fetch
  const [isLoading, setIsLoading] = useState(false);
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [dropdownLayout, setDropdownLayout] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [isLocSelected, setIsLocSelected] = useState(!!value);
  const [showGuidance, setShowGuidance] = useState(false);
  const [rejectedQuery, setRejectedQuery] = useState('');

  const shakeAnim = useRef(new Animated.Value(0)).current;
  const timeoutRef = useRef(null);
  const inputRef = useRef(null);
  const wrapperRef = useRef(null);

  // Sync externally controlled value
  React.useEffect(() => {
    if (value !== undefined && value !== query) {
      setQuery(value);
      setIsLocSelected(!!value);
      setShowGuidance(false);
    }
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchLocations = useCallback(async (searchQuery) => {
    if (!searchQuery || searchQuery.length < 2) {
      setResults([]);
      setDropdownVisible(false);
      setSearched(false);
      setShowGuidance(false);
      return;
    }
    setIsLoading(true);
    try {
      const res = await api.get(`/location/search?q=${encodeURIComponent(searchQuery)}`);
      const data = res.data;
      setResults(data);
      setSearched(true);
      if (data.length > 0) {
        setDropdownVisible(true);
        setShowGuidance(false);
      } else {
        setDropdownVisible(false);
        setRejectedQuery(searchQuery);
        setShowGuidance(true); // show "no results" guidance banner
      }
    } catch (e) {
      console.log('LocationAutocomplete fetch error', e);
      setShowGuidance(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleTextChange = (text) => {
    setQuery(text);
    setIsLocSelected(false);
    setShowGuidance(false);
    onChangeText?.(text);
    if (text === '') {
      onSelectLocation?.(null);
      setResults([]);
      setDropdownVisible(false);
      setSearched(false);
      return;
    }
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => fetchLocations(text), 350);
  };

  const handleSelect = (item) => {
    const name = item.name;
    setQuery(name);
    setIsLocSelected(true);
    setShowGuidance(false);
    setDropdownVisible(false);
    Keyboard.dismiss();
    onSelectLocation?.({
      name: item.name,
      fullName: `${item.name}, ${item.state}`,
      latitude: parseFloat(item.latitude),
      longitude: parseFloat(item.longitude),
      state: item.state || '',
    });
  };

  /** Shake the input to signal invalid freeform text */
  const triggerShake = () => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  /**
   * On blur / submit: if user left freeform text without selecting from
   * the dropdown, reset the field and show guidance.
   */
  const handleBlurOrSubmit = async () => {
    if (isLocSelected) return; // already committed a valid selection — fine

    const searchQuery = query.trim();
    if (!searchQuery) return; // empty — fine

    // Try to auto-select the first result if available
    if (results.length > 0) {
      handleSelect(results[0]);
      return;
    }

    // One more attempt to resolve via API
    setIsLoading(true);
    try {
      const res = await api.get(`/location/search?q=${encodeURIComponent(searchQuery)}`);
      const data = res.data;
      if (data && data.length > 0) {
        handleSelect(data[0]);
        return;
      }
    } catch (e) {
      // ignore
    } finally {
      setIsLoading(false);
    }

    // Still no match → reject freeform text, shake & show guidance
    setRejectedQuery(searchQuery);
    triggerShake();
    setShowGuidance(true);
    // Clear the freeform value so the parent doesn't receive an unvalidated city
    setQuery('');
    setIsLocSelected(false);
    onChangeText?.('');
    onSelectLocation?.(null);
  };

  const measureInput = () => {
    if (wrapperRef.current) {
      wrapperRef.current.measureInWindow((x, y, width, height) => {
        setDropdownLayout({ x, y, width, height });
      });
    }
  };

  const isOutlined = variant === 'outlined';
  const isNone = variant === 'none';

  const containerStyle = isOutlined
    ? [styles.containerOutlined, error && styles.containerError, !isLocSelected && query.length > 0 && styles.containerWarning]
    : isNone
    ? styles.containerNone
    : styles.containerStandard;

  return (
    <View style={style}>
      {/* Input row */}
      <Animated.View
        ref={wrapperRef}
        collapsable={false}
        style={{ transform: [{ translateX: shakeAnim }] }}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={containerStyle}
          onPress={() => inputRef.current?.focus?.()}
        >
          <Icon
            name={icon}
            size={isOutlined ? 18 : isNone ? 18 : 20}
            color={isLocSelected ? Colors.primary : Colors.textTertiary}
            style={isOutlined ? styles.iconOutlined : isNone ? styles.iconNone : styles.iconStandard}
          />
          <TextInput
            ref={inputRef}
            style={isOutlined ? styles.inputOutlined : isNone ? styles.inputNone : styles.inputStandard}
            value={query}
            onChangeText={handleTextChange}
            placeholder={placeholder}
            placeholderTextColor={Colors.textTertiary}
            onFocus={() => {
              measureInput();
              if (results.length > 0 && !isLocSelected) setDropdownVisible(true);
            }}
            onBlur={handleBlurOrSubmit}
            onSubmitEditing={handleBlurOrSubmit}
            returnKeyType="search"
          />
          {isLoading
            ? <ActivityIndicator size="small" color={Colors.primary} style={{ marginLeft: 8 }} />
            : isLocSelected
            ? (
              <TouchableOpacity
                onPress={() => {
                  setQuery('');
                  setIsLocSelected(false);
                  setResults([]);
                  setSearched(false);
                  setShowGuidance(false);
                  onChangeText?.('');
                  onSelectLocation?.(null);
                  inputRef.current?.focus?.();
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Icon name="close-circle" size={18} color={Colors.textTertiary} style={{ marginLeft: 8 }} />
              </TouchableOpacity>
            )
            : null
          }
        </TouchableOpacity>
      </Animated.View>

      {/* ── No-results guidance banner ── */}
      {showGuidance && !isLocSelected && (
        <View style={styles.guidanceBanner}>
          <MCIcon name="map-marker-question-outline" size={18} color={Colors.warning} style={{ marginRight: 8, flexShrink: 0 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.guidanceTitle}>
              Area not found in our city list
            </Text>
            <Text style={styles.guidanceBody}>
              Localities and neighbourhoods aren't listed directly. Try entering the{' '}
              <Text style={styles.guidanceHighlight}>well-known city name</Text> instead of "{rejectedQuery}" — for example, type{' '}
              <Text style={styles.guidanceHighlight}>"Chennai"</Text> or <Text style={styles.guidanceHighlight}>"Mumbai"</Text>.
            </Text>
          </View>
        </View>
      )}

      {/* ── Floating dropdown ── */}
      <Modal
        visible={dropdownVisible && results.length > 0}
        transparent
        animationType="none"
        onRequestClose={() => setDropdownVisible(false)}
      >
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={() => setDropdownVisible(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={[
              styles.dropdown,
              {
                top: dropdownLayout.y + dropdownLayout.height + 4,
                left: dropdownLayout.x,
                width: dropdownLayout.width,
              },
            ]}
          >
            <FlatList
              data={results}
              keyExtractor={(item) => String(item._id)}
              keyboardShouldPersistTaps="handled"
              style={{ maxHeight: 240 }}
              renderItem={({ item, index }) => (
                <TouchableOpacity
                  style={[
                    styles.dropdownItem,
                    index === results.length - 1 && { borderBottomWidth: 0 },
                  ]}
                  onPress={() => handleSelect(item)}
                  activeOpacity={0.7}
                >
                  <Icon
                    name="location-outline"
                    size={15}
                    color={Colors.primary}
                    style={{ marginTop: 2, marginRight: 10, flexShrink: 0 }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemTitle} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.itemSub} numberOfLines={1}>
                      {item.name}, {item.state}
                    </Text>
                  </View>
                  <Icon name="chevron-forward-outline" size={14} color={Colors.textTertiary} />
                </TouchableOpacity>
              )}
              ListHeaderComponent={
                <View style={styles.dropdownHeader}>
                  <Text style={styles.dropdownHeaderText}>Select a city</Text>
                </View>
              }
            />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  /* ── Standard (underline) variant ─────────────────────────── */
  containerStandard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: 8,
  },
  iconStandard: { marginRight: 8 },
  inputStandard: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 16,
    fontFamily: Typography.fontFamily.regular,
    padding: 0,
  },

  /* ── Outlined variant ──────────────────────────────────────── */
  containerOutlined: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  containerError: { borderColor: Colors.error },
  containerWarning: { borderColor: Colors.warning },
  iconOutlined: { marginRight: 10 },
  inputOutlined: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 15,
    fontFamily: Typography.fontFamily.medium,
    padding: 0,
  },

  /* ── None variant ──────────────────────────────────────────── */
  containerNone: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconNone: { marginRight: 8 },
  inputNone: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 14,
    fontFamily: Typography.fontFamily.medium,
    padding: 0,
  },

  /* ── Floating dropdown ─────────────────────────────────────── */
  dropdown: {
    position: 'absolute',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 24,
    overflow: 'hidden',
  },
  dropdownHeader: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.backgroundElevated,
  },
  dropdownHeaderText: {
    color: Colors.textTertiary,
    fontSize: 11,
    fontFamily: Typography.fontFamily.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  itemTitle: {
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: 14,
  },
  itemSub: {
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.regular,
    fontSize: 12,
    marginTop: 2,
  },

  /* ── No-results guidance banner ────────────────────────────── */
  guidanceBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255, 143, 0, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255, 143, 0, 0.30)',
    borderRadius: BorderRadius.md,
    padding: 12,
    marginTop: 8,
  },
  guidanceTitle: {
    color: Colors.warning,
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: 13,
    marginBottom: 4,
  },
  guidanceBody: {
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.regular,
    fontSize: 12,
    lineHeight: 18,
  },
  guidanceHighlight: {
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.semiBold,
  },
});

export default LocationAutocomplete;
