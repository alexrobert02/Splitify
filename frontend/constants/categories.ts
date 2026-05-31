import type { ComponentProps } from 'react';
import type { ReceiptCategory } from '@/types';
import { Ionicons } from '@expo/vector-icons';

type IoniconsName = ComponentProps<typeof Ionicons>['name'];

export const CATEGORY_CONFIG: Record<ReceiptCategory, { label: string; icon: IoniconsName; color: string; bgColor: string }> = {
  GROCERIES:     { label: 'Groceries',    icon: 'basket-outline',              color: '#10B981', bgColor: '#ECFDF5' },
  DINING:        { label: 'Dining',       icon: 'restaurant-outline',          color: '#F97316', bgColor: '#FFF7ED' },
  TRANSPORT:     { label: 'Transport',    icon: 'car-outline',                 color: '#3B82F6', bgColor: '#EFF6FF' },
  ENTERTAINMENT: { label: 'Fun',          icon: 'film-outline',                color: '#A855F7', bgColor: '#FAF5FF' },
  SHOPPING:      { label: 'Shopping',     icon: 'bag-handle-outline',          color: '#EC4899', bgColor: '#FDF2F8' },
  UTILITIES:     { label: 'Utilities',    icon: 'flash-outline',               color: '#F59E0B', bgColor: '#FFFBEB' },
  HEALTH:        { label: 'Health',       icon: 'medkit-outline',              color: '#EF4444', bgColor: '#FEF2F2' },
  OTHER:         { label: 'Other',        icon: 'ellipsis-horizontal-outline', color: '#6B7280', bgColor: '#F9FAFB' },
};
