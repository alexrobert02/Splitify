import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export type ColorSchemePreference = 'light' | 'dark' | 'system';

export const lightColors = {
  primary: '#5B5BD6',
  primaryDark: '#4747C2',
  primaryLight: '#EEEEFF',
  background: '#F8F9FC',
  surface: '#FFFFFF',
  text: '#1C1C2E',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  border: '#E5E7EB',
  divider: '#F3F4F6',
  success: '#10B981',
  successLight: '#ECFDF5',
  error: '#EF4444',
  errorLight: '#FEF2F2',
  warning: '#F59E0B',
  warningLight: '#FFFBEB',
  money: '#10B981',
  tabBarBg: '#FFFFFF',
  tabBarActive: '#5B5BD6',
  tabBarInactive: '#9CA3AF',
  shadow: 'rgba(0,0,0,0.08)',
  overlay: 'rgba(0,0,0,0.4)',
};

export type ColorPalette = typeof lightColors;

export const darkColors: ColorPalette = {
  primary: '#7B7BFF',
  primaryDark: '#6666E8',
  primaryLight: '#1E1E3F',
  background: '#0C0E1A',
  surface: '#161929',
  text: '#E8E8FF',
  textSecondary: '#8A8FA8',
  textMuted: '#565A78',
  border: '#252840',
  divider: '#1C1F35',
  success: '#34D399',
  successLight: '#0A2E20',
  error: '#F87171',
  errorLight: '#3B0F0F',
  warning: '#FCD34D',
  warningLight: '#2D1D00',
  money: '#34D399',
  tabBarBg: '#161929',
  tabBarActive: '#7B7BFF',
  tabBarInactive: '#565A78',
  shadow: 'rgba(0,0,0,0.4)',
  overlay: 'rgba(0,0,0,0.7)',
};

const STORAGE_KEY = 'theme_preference';

interface ThemeContextValue {
  colors: ColorPalette;
  isDark: boolean;
  colorScheme: ColorSchemePreference;
  setColorScheme: (scheme: ColorSchemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  colors: lightColors,
  isDark: false,
  colorScheme: 'system',
  setColorScheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreference] = useState<ColorSchemePreference>('system');

  useEffect(() => {
    SecureStore.getItemAsync(STORAGE_KEY).then((value) => {
      if (value === 'light' || value === 'dark' || value === 'system') {
        setPreference(value);
      }
    });
  }, []);

  const handleSetColorScheme = (scheme: ColorSchemePreference) => {
    setPreference(scheme);
    SecureStore.setItemAsync(STORAGE_KEY, scheme);
  };

  const isDark = preference === 'system' ? systemScheme === 'dark' : preference === 'dark';
  const colors = isDark ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ colors, isDark, colorScheme: preference, setColorScheme: handleSetColorScheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
