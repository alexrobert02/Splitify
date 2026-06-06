import { useMemo } from 'react';
import type { ComponentProps } from 'react';
import type { ReceiptCategory } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';

type IoniconsName = ComponentProps<typeof Ionicons>['name'];

export const CATEGORY_CONFIG: Record<ReceiptCategory, { label: string; icon: IoniconsName; color: string; darkColor: string; bgColor: string; darkBgColor: string }> = {
  GROCERIES:     { label: 'Groceries',    icon: 'basket-outline',              color: '#10B981', darkColor: '#34D399', bgColor: '#ECFDF5', darkBgColor: '#0A2518' },
  DINING:        { label: 'Dining',       icon: 'restaurant-outline',          color: '#F97316', darkColor: '#FB923C', bgColor: '#FFF7ED', darkBgColor: '#261508' },
  TRANSPORT:     { label: 'Transport',    icon: 'car-outline',                 color: '#3B82F6', darkColor: '#60A5FA', bgColor: '#EFF6FF', darkBgColor: '#0A1835' },
  ENTERTAINMENT: { label: 'Fun',          icon: 'film-outline',                color: '#A855F7', darkColor: '#C084FC', bgColor: '#FAF5FF', darkBgColor: '#1C0B32' },
  SHOPPING:      { label: 'Shopping',     icon: 'bag-handle-outline',          color: '#EC4899', darkColor: '#F472B6', bgColor: '#FDF2F8', darkBgColor: '#280A1E' },
  UTILITIES:     { label: 'Utilities',    icon: 'flash-outline',               color: '#F59E0B', darkColor: '#FCD34D', bgColor: '#FFFBEB', darkBgColor: '#261A04' },
  HEALTH:        { label: 'Health',       icon: 'medkit-outline',              color: '#EF4444', darkColor: '#F87171', bgColor: '#FEF2F2', darkBgColor: '#280808' },
  OTHER:         { label: 'Other',        icon: 'ellipsis-horizontal-outline', color: '#6B7280', darkColor: '#9CA3AF', bgColor: '#F9FAFB', darkBgColor: '#1C1E26' },
};

export type ResolvedCategory = { label: string; icon: IoniconsName; color: string; bgColor: string };

export function useCategoryConfig(): Record<ReceiptCategory, ResolvedCategory> {
  const { isDark } = useTheme();
  return useMemo(
    () =>
      Object.fromEntries(
        Object.entries(CATEGORY_CONFIG).map(([k, v]) => [
          k,
          { label: v.label, icon: v.icon, color: isDark ? v.darkColor : v.color, bgColor: isDark ? v.darkBgColor : v.bgColor },
        ])
      ) as Record<ReceiptCategory, ResolvedCategory>,
    [isDark]
  );
}
