import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

console.log('📦 [theme.js] Module loaded!');

/**
 * ScoreVerse Design System
 * Dual Theme — Light / Dark
 *
 * Light Mode:
 * - White replaces dark/black surfaces
 * - Yellow remains the primary ScoreVerse brand color
 *
 * Dark Mode:
 * - Existing dark visual language is preserved
 */

export const lightColors = {
  // ============================================================
  // PRIMARY — SCOREVERSE YELLOW
  // ============================================================
  primary: '#FFCC00',
  primaryDark: '#E6B800',
  primaryLight: '#FFD633',
  primaryGradient: ['#FFCC00', '#E6B800'],

  primaryAlpha10: 'rgba(255, 204, 0, 0.10)',
  primaryAlpha20: 'rgba(255, 204, 0, 0.20)',
  primaryAlpha30: 'rgba(255, 204, 0, 0.30)',

  // ============================================================
  // BASE
  // ============================================================
  white: '#FFFFFF',
  black: '#000000',

  // ============================================================
  // SECONDARY
  // ============================================================
  secondary: '#FFFFFF',
  secondaryDark: '#F5F7FA',

  // ============================================================
  // ACCENT
  // ============================================================
  accent: '#FFCC00',
  accentLight: '#FFD633',

  // ============================================================
  // BACKGROUNDS — LIGHT MODE
  // ============================================================
  background: '#FFFFFF',
  backgroundCard: '#FFFFFF',
  backgroundElevated: '#FFFFFF',
  backgroundModal: '#FFFFFF',

  surface: '#FFFFFF',
  surfaceVariant: '#F5F7FA',

  // ============================================================
  // TEXT
  // ============================================================
  textPrimary: '#111111',
  textSecondary: '#5F6368',
  textTertiary: '#7A8491',
  textDisabled: '#A5ADB7',

  // Text on yellow buttons
  textOnPrimary: '#000000',

  // ============================================================
  // BORDERS
  // ============================================================
  border: '#E5E7EB',
  borderLight: '#F0F2F5',

  // ============================================================
  // STATUS
  // ============================================================
  success: '#2ED573',
  successLight: 'rgba(46, 213, 115, 0.12)',

  warning: '#FF8F00',
  warningLight: 'rgba(255, 143, 0, 0.12)',

  error: '#F44336',
  errorLight: 'rgba(244, 67, 54, 0.12)',

  info: '#2196F3',
  infoLight: 'rgba(33, 150, 243, 0.12)',

  // ============================================================
  // CRICKET SCORING COLORS
  // ============================================================
  dot: '#8A95A5',
  // In light mode this dark scoring surface becomes white
  single: '#FFFFFF',
  two: '#64B5F6',
  three: '#29B6F6',
  four: '#4CAF50',
  six: '#FFCC00',
  wide: '#FF8F00',
  noball: '#FF5252',
  wicket: '#F44336',

  // ============================================================
  // GRADIENTS
  // ============================================================
  gradients: {
    primary: ['#FFCC00', '#E6B800'],
    // Dark secondary gradient becomes white in light mode
    secondary: ['#FFFFFF', '#F5F7FA'],
    gold: ['#FFD600', '#FF8F00'],
    // Dark gradient becomes light surface
    dark: ['#FFFFFF', '#F5F7FA'],
    // Card gradient
    card: ['#FFFFFF', '#F8FAFC'],
    danger: ['#F44336', '#D32F2F'],
    // Header gradient for light mode
    header: ['#FFFFFF', 'rgba(255,255,255,0)'],
  },

  // ============================================================
  // TRANSPARENT VARIANTS
  // ============================================================
  whiteAlpha10: 'rgba(255,255,255,0.10)',
  whiteAlpha20: 'rgba(255,255,255,0.20)',
  blackAlpha50: 'rgba(0,0,0,0.50)',
  blackAlpha80: 'rgba(0,0,0,0.80)',
};

// ================================================================
// DARK COLORS
// ================================================================
export const darkColors = {
  // ============================================================
  // PRIMARY
  // ============================================================
  primary: '#FFCC00',
  primaryDark: '#E6B800',
  primaryLight: '#FFD633',
  primaryGradient: ['#FFCC00', '#E6B800'],

  primaryAlpha10: 'rgba(255, 204, 0, 0.10)',
  primaryAlpha20: 'rgba(255, 204, 0, 0.20)',
  primaryAlpha30: 'rgba(255, 204, 0, 0.30)',

  // ============================================================
  // BASE
  // ============================================================
  white: '#FFFFFF',
  black: '#000000',

  // ============================================================
  // SECONDARY
  // ============================================================
  secondary: '#000000',
  secondaryDark: '#111111',

  // ============================================================
  // ACCENT
  // ============================================================
  accent: '#FFCC00',
  accentLight: '#FFD633',

  // ============================================================
  // BACKGROUNDS
  // ============================================================
  background: '#000000',
  backgroundCard: '#111111',
  backgroundElevated: '#161616',
  backgroundModal: '#1A1A1A',

  surface: '#161616',
  surfaceVariant: '#1A1A1A',

  // ============================================================
  // TEXT
  // ============================================================
  textPrimary: '#FFFFFF',
  textSecondary: '#A0AAB5',
  textTertiary: '#718096',
  textDisabled: '#4A5568',
  textOnPrimary: '#000000',

  // ============================================================
  // BORDERS
  // ============================================================
  border: 'rgba(255, 255, 255, 0.15)',
  borderLight: 'rgba(255, 255, 255, 0.05)',

  // ============================================================
  // STATUS
  // ============================================================
  success: '#2ED573',
  successLight: 'rgba(46, 213, 115, 0.15)',

  warning: '#FF8F00',
  warningLight: 'rgba(255, 143, 0, 0.15)',

  error: '#F44336',
  errorLight: 'rgba(244, 67, 54, 0.15)',

  info: '#2196F3',
  infoLight: 'rgba(33, 150, 243, 0.15)',

  // ============================================================
  // CRICKET SCORING
  // ============================================================
  dot: '#8A95A5',
  single: '#111418',
  two: '#64B5F6',
  three: '#29B6F6',
  four: '#4CAF50',
  six: '#FFCC00',
  wide: '#FF8F00',
  noball: '#FF5252',
  wicket: '#F44336',

  // ============================================================
  // GRADIENTS
  // ============================================================
  gradients: {
    primary: ['#FFCC00', '#E6B800'],
    secondary: ['#000000', '#111111'],
    gold: ['#FFD600', '#FF8F00'],
    dark: ['#000000', '#111111'],
    card: ['#0A0A0A', '#000000'],
    danger: ['#F44336', '#D32F2F'],
    header: ['#000000', 'rgba(26,26,26,0)'],
  },

  // ============================================================
  // TRANSPARENT VARIANTS
  // ============================================================
  whiteAlpha10: 'rgba(255,255,255,0.10)',
  whiteAlpha20: 'rgba(255,255,255,0.20)',
  blackAlpha50: 'rgba(0,0,0,0.50)',
  blackAlpha80: 'rgba(0,0,0,0.80)',
};

// ================================================================
// BACKWARD COMPATIBILITY
// ================================================================
export const Colors = darkColors;

// ================================================================
// TYPOGRAPHY
// ================================================================
export const Typography = {
  fontFamily: {
    regular: 'Outfit-Regular',
    medium: 'Outfit-Medium',
    semiBold: 'Outfit-SemiBold',
    bold: 'Outfit-Bold',
    extraBold: 'Outfit-ExtraBold',
  },

  fontSize: {
    xs: 10,
    sm: 12,
    base: 14,
    md: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 28,
    '4xl': 32,
    '5xl': 40,
  },

  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.7,
  },
};

// ================================================================
// SPACING
// ================================================================
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 40,
  '4xl': 48,
  '5xl': 64,
};

// ================================================================
// BORDER RADIUS
// ================================================================
export const BorderRadius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  '2xl': 28,
  full: 999,
};

// ================================================================
// SHADOWS — LIGHT MODE
// ================================================================
export const lightShadows = {
  sm: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },

  md: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },

  lg: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.10,
    shadowRadius: 14,
    elevation: 8,
  },

  glow: {
    shadowColor: '#FFCC00',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.30,
    shadowRadius: 10,
    elevation: 6,
  },
};

// ================================================================
// SHADOWS — DARK MODE
// ================================================================
export const darkShadows = {
  sm: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },

  md: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },

  lg: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
  },

  glow: {
    shadowColor: '#FFCC00',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
};

// Backward compatibility
export const Shadows = darkShadows;

// ================================================================
// REACT NATIVE PAPER / NAVIGATION THEMES
// ================================================================
export const darkTheme = {
  dark: true,
  colors: {
    primary: darkColors.primary,
    secondary: darkColors.secondary,
    background: darkColors.background,
    surface: darkColors.surface,
    surfaceVariant: darkColors.surfaceVariant,
    onSurface: darkColors.textPrimary,
    onBackground: darkColors.textPrimary,
    error: darkColors.error,
    text: darkColors.textPrimary,
    placeholder: darkColors.textTertiary,
    border: darkColors.border,
    notification: darkColors.primary,
    card: darkColors.backgroundCard,
  },
  fonts: {
    regular: {
      fontFamily: 'Outfit-Regular',
    },
    medium: {
      fontFamily: 'Outfit-Medium',
    },
    bold: {
      fontFamily: 'Outfit-Bold',
    },
    heavy: {
      fontFamily: 'Outfit-ExtraBold',
    },
  },
};

export const lightTheme = {
  dark: false,
  colors: {
    primary: lightColors.primary,
    secondary: lightColors.secondary,
    background: lightColors.background,
    surface: lightColors.surface,
    surfaceVariant: lightColors.surfaceVariant,
    onSurface: lightColors.textPrimary,
    onBackground: lightColors.textPrimary,
    error: lightColors.error,
    text: lightColors.textPrimary,
    placeholder: lightColors.textTertiary,
    border: lightColors.border,
    notification: lightColors.primary,
    card: lightColors.backgroundCard,
  },
  fonts: {
    regular: {
      fontFamily: 'Outfit-Regular',
    },
    medium: {
      fontFamily: 'Outfit-Medium',
    },
    bold: {
      fontFamily: 'Outfit-Bold',
    },
    heavy: {
      fontFamily: 'Outfit-ExtraBold',
    },
  },
};

// ================================================================
// THEME CONTEXT & HOOK
// ================================================================

const THEME_STORAGE_KEY = '@scoreverse_theme_mode';

export const ThemeContext = createContext({
  isDark: false,
  themeMode: 'system',
  colors: lightColors,
  shadows: lightShadows,
  theme: lightTheme,
  typography: Typography,
  spacing: Spacing,
  borderRadius: BorderRadius,
  setThemeMode: () => {},
  toggleTheme: () => {},
});

export const ThemeProvider = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState('system');
  console.log('🎨 [ThemeProvider] RENDERING... systemColorScheme:', systemColorScheme, 'themeMode:', themeMode);

  useEffect(() => {
    const loadStoredTheme = async () => {
      try {
        const stored = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (stored && ['system', 'light', 'dark'].includes(stored)) {
          setThemeModeState(stored);
        }
      } catch (err) {
        console.warn('Failed to load theme preference:', err);
      }
    };
    loadStoredTheme();
  }, []);

  const setThemeMode = useCallback(async (mode) => {
    try {
      setThemeModeState(mode);
      await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch (err) {
      console.warn('Failed to save theme preference:', err);
    }
  }, []);

  const isDark = useMemo(() => {
    if (themeMode === 'system') {
      return systemColorScheme === 'dark';
    }
    return themeMode === 'dark';
  }, [themeMode, systemColorScheme]);

  const toggleTheme = useCallback(() => {
    setThemeMode(isDark ? 'light' : 'dark');
  }, [isDark, setThemeMode]);

  const colors = isDark ? darkColors : lightColors;
  const shadows = isDark ? darkShadows : lightShadows;
  const theme = isDark ? darkTheme : lightTheme;

  const value = useMemo(
    () => ({
      isDark,
      themeMode,
      colors,
      shadows,
      theme,
      typography: Typography,
      spacing: Spacing,
      borderRadius: BorderRadius,
      setThemeMode,
      toggleTheme,
    }),
    [isDark, themeMode, colors, shadows, theme, setThemeMode, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

