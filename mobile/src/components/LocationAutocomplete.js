import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Modal, FlatList,
  Keyboard
} from 'react-native';
import { Colors, Typography, BorderRadius } from '../theme/theme';
import Icon from 'react-native-vector-icons/Ionicons';

const LocationAutocomplete = ({
  value,
  onChangeText,
  onSelectLocation,
  placeholder = 'Search location...',
  style,
  variant = 'standard',   // 'standard' | 'outlined'
  error,
  icon = 'location-outline',
}) => {
  const [query, setQuery] = useState(value ?? '');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [dropdownLayout, setDropdownLayout] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [isLocSelected, setIsLocSelected] = useState(!!value);

  const timeoutRef = useRef(null);
  const inputRef = useRef(null);

  // Sync controlled value
  React.useEffect(() => {
    if (value !== undefined && value !== query) {
      setQuery(value);
      setIsLocSelected(true);
    }
  }, [value]);

  const fetchLocations = async (searchQuery) => {
    if (!searchQuery || searchQuery.length < 3) {
      setResults([]);
      setDropdownVisible(false);
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&q=${encodeURIComponent(searchQuery)}&limit=6`,
        { headers: { 'User-Agent': 'ScoreVerseApp/1.0', 'Accept-Language': 'en-US,en;q=0.9' } }
      );
      const data = await res.json();
      setResults(data);
      if (data.length > 0) setDropdownVisible(true);
    } catch (e) {
      console.log('LocationAutocomplete fetch error', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTextChange = (text) => {
    setQuery(text);
    setIsLocSelected(false);
    onChangeText?.(text);
    if (text === '') {
      onSelectLocation?.(null);
      setResults([]);
      setDropdownVisible(false);
      return;
    }
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => fetchLocations(text), 300);
  };

  const handleSelect = (item) => {
    const locName = item.display_name.split(',')[0];
    setQuery(locName);
    setIsLocSelected(true);
    setDropdownVisible(false);
    Keyboard.dismiss();
    onSelectLocation?.({
      name: locName,
      fullName: item.display_name,
      latitude: parseFloat(item.lat),
      longitude: parseFloat(item.lon),
      state: item.address?.state || '',
    });
  };

  const handleBlurOrSubmit = async () => {
    if (isLocSelected) return;
    const searchQuery = query.trim();
    if (searchQuery.length < 3) return;

    setIsLoading(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&q=${encodeURIComponent(searchQuery)}&limit=1`,
        { headers: { 'User-Agent': 'ScoreVerseApp/1.0', 'Accept-Language': 'en-US,en;q=0.9' } }
      );
      const data = await res.json();
      if (data && data.length > 0) {
        handleSelect(data[0]);
      }
    } catch (e) {
      console.log('LocationAutocomplete autocomplete fetch error', e);
    } finally {
      setIsLoading(false);
    }
  };

  const measureInput = () => {
    if (inputRef.current) {
      inputRef.current.measureInWindow((x, y, width, height) => {
        setDropdownLayout({ x, y, width, height });
      });
    }
  };

  const isOutlined = variant === 'outlined';
  const isNone = variant === 'none';

  return (
    <View style={style} ref={inputRef} collapsable={false}>
      <TouchableOpacity
        activeOpacity={1}
        style={[
          isOutlined ? styles.containerOutlined : isNone ? styles.containerNone : styles.containerStandard,
          isOutlined && error ? styles.containerError : null,
        ]}
        onPress={() => inputRef.current && inputRef.current.focus?.()}
      >
        <Icon
          name={icon}
          size={isOutlined ? 18 : isNone ? 18 : 20}
          color={Colors.textTertiary}
          style={isOutlined ? styles.iconOutlined : isNone ? styles.iconNone : styles.iconStandard}
        />
        <TextInput
          style={isOutlined ? styles.inputOutlined : isNone ? styles.inputNone : styles.inputStandard}
          value={query}
          onChangeText={handleTextChange}
          placeholder={placeholder}
          placeholderTextColor={Colors.textTertiary}
          onFocus={() => {
            measureInput();
            if (results.length > 0) setDropdownVisible(true);
          }}
          onBlur={handleBlurOrSubmit}
          onSubmitEditing={handleBlurOrSubmit}
        />
        {isLoading && <ActivityIndicator size="small" color={Colors.primary} style={{ marginLeft: 8 }} />}
      </TouchableOpacity>

      {/* Dropdown rendered in a transparent Modal so it floats above all content */}
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
                top: dropdownLayout.y + dropdownLayout.height + 2,
                left: dropdownLayout.x,
                width: dropdownLayout.width,
              },
            ]}
          >
            <FlatList
              data={results}
              keyExtractor={(item) => String(item.place_id)}
              keyboardShouldPersistTaps="handled"
              style={{ maxHeight: 220 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.dropdownItem}
                  onPress={() => handleSelect(item)}
                  activeOpacity={0.75}
                >
                  <Icon name="location" size={15} color={Colors.primary} style={{ marginTop: 2, marginRight: 8 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemTitle} numberOfLines={1}>
                      {item.display_name.split(',')[0]}
                    </Text>
                    <Text style={styles.itemSub} numberOfLines={1}>
                      {item.display_name}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
            />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  /* ── Standard (underline) variant ─────────────────────────────── */
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

  /* ── Outlined variant ──────────────────────────────────────────── */
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

  /* ── Floating dropdown (inside Modal) ─────────────────────────── */
  dropdown: {
    position: 'absolute',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 20,
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
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
});

export default LocationAutocomplete;
