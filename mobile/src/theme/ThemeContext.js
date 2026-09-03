import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { useColorScheme, Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  lightColors,
  darkColors,
  lightShadows,
  darkShadows,
  lightTheme,
  darkTheme,
  Typography,
  Spacing,
  BorderRadius,
} from './theme';

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

export default ThemeContext;
