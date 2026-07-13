/**
 * RoughTurf Design System — Dark Theme (Default)
 * Premium dark theme with cricket-inspired green accent palette.
 */

export const Colors = {
  // Primary — Vibrant Turf Green (from Logo)
  primary: '#9abc2f',
  primaryDark: '#799622',
  primaryLight: '#b5d454',
  primaryGradient: ['#9abc2f', '#799622'],

  // Secondary — Midnight Navy (from Logo)
  secondary: '#011528',
  secondaryDark: '#000A15',

  // Accent — Vibrant Turf Green
  accent: '#9abc2f',
  accentLight: '#b5d454',

  // Backgrounds - Midnight Navy Theme
  background: '#011528',
  backgroundCard: '#000A15',
  backgroundElevated: '#0A1F35',
  backgroundModal: '#000A15',
  surface: '#011528',
  surfaceVariant: '#0A1F35',

  // Text
  textPrimary: '#FFFFFF',
  textSecondary: '#A0AAB5',
  textTertiary: '#718096',
  textDisabled: '#4A5568',
  textOnPrimary: '#FFFFFF',

  // Borders
  border: 'rgba(255, 255, 255, 0.15)',
  borderLight: 'rgba(255, 255, 255, 0.05)',

  // Status
  success: '#2ED573',
  successLight: 'rgba(46, 213, 115, 0.15)',
  warning: '#FF8F00',
  warningLight: 'rgba(255, 143, 0, 0.15)',
  error: '#F44336',
  errorLight: 'rgba(244, 67, 54, 0.15)',
  info: '#2196F3',
  infoLight: 'rgba(33, 150, 243, 0.15)',

  // Scoring colors
  dot: '#8A95A5',
  single: '#111418',
  two: '#64B5F6',
  three: '#29B6F6',
  four: '#4CAF50',
  six: '#FFD600',
  wide: '#FF8F00',
  noball: '#FF5252',
  wicket: '#F44336',

  // Gradient presets
  gradients: {
    primary: ['#9abc2f', '#799622'],
    secondary: ['#011528', '#1A2C3D'],
    gold: ['#FFD600', '#FF8F00'],
    dark: ['#011528', '#000A15'], // Navy gradient for dark areas
    card: ['#000A15', '#011528'],
    danger: ['#F44336', '#D32F2F'],
    header: ['#011528', 'rgba(1,21,40,0)'],
  },

  // Transparent variants
  primaryAlpha10: 'rgba(154,188,47,0.10)',
  primaryAlpha20: 'rgba(154,188,47,0.20)',
  primaryAlpha30: 'rgba(154,188,47,0.30)',
  whiteAlpha10: 'rgba(255,255,255,0.10)',
  whiteAlpha20: 'rgba(255,255,255,0.20)',
  blackAlpha50: 'rgba(0,0,0,0.50)',
  blackAlpha80: 'rgba(0,0,0,0.80)',
};

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

export const BorderRadius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  '2xl': 28,
  full: 999,
};

export const Shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
  },
  glow: {
    shadowColor: '#9abc2f',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
};

// React Native Paper theme
export const darkTheme = {
  dark: true,
  colors: {
    primary: Colors.primary,
    secondary: Colors.secondary,
    background: Colors.background,
    surface: Colors.surface,
    surfaceVariant: Colors.surfaceVariant,
    onSurface: Colors.textPrimary,
    onBackground: Colors.textPrimary,
    error: Colors.error,
    text: Colors.textPrimary,
    placeholder: Colors.textTertiary,
    border: Colors.border,
    notification: Colors.primary,
    card: Colors.backgroundCard,
  },
  fonts: {
    regular: { fontFamily: 'Outfit-Regular' },
    medium: { fontFamily: 'Outfit-Medium' },
    bold: { fontFamily: 'Outfit-Bold' },
    heavy: { fontFamily: 'Outfit-ExtraBold' },
  },
};

export const lightTheme = {
  ...darkTheme,
  dark: false,
  colors: {
    ...darkTheme.colors,
    background: '#F5F7FA',
    surface: '#FFFFFF',
    card: '#FFFFFF',
    text: '#0D1117',
    onBackground: '#0D1117',
    onSurface: '#0D1117',
    border: '#E5E9EF',
    surfaceVariant: '#F0F3F8',
  },
};
