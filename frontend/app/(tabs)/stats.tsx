import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Colors } from '@/constants/Colors';
import type { ReceiptCategory } from '@/types';
import { useCurrencyRates } from '@/lib/useCurrencyRates';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const CATEGORY_CONFIG: Record<ReceiptCategory, { label: string; icon: IoniconsName; color: string; bgColor: string }> = {
  GROCERIES:     { label: 'Groceries',     icon: 'basket-outline',              color: '#10B981', bgColor: '#ECFDF5' },
  DINING:        { label: 'Dining',         icon: 'restaurant-outline',          color: '#F97316', bgColor: '#FFF7ED' },
  TRANSPORT:     { label: 'Transport',      icon: 'car-outline',                 color: '#3B82F6', bgColor: '#EFF6FF' },
  ENTERTAINMENT: { label: 'Entertainment', icon: 'film-outline',                color: '#A855F7', bgColor: '#FAF5FF' },
  SHOPPING:      { label: 'Shopping',       icon: 'bag-handle-outline',          color: '#EC4899', bgColor: '#FDF2F8' },
  UTILITIES:     { label: 'Utilities',      icon: 'flash-outline',               color: '#F59E0B', bgColor: '#FFFBEB' },
  HEALTH:        { label: 'Health',         icon: 'medkit-outline',              color: '#EF4444', bgColor: '#FEF2F2' },
  OTHER:         { label: 'Other',          icon: 'ellipsis-horizontal-outline', color: '#6B7280', bgColor: '#F9FAFB' },
};

type Period = 'day' | 'week' | 'month' | 'year' | 'all';

const PERIODS: { key: Period; label: string }[] = [
  { key: 'day',   label: 'Day' },
  { key: 'week',  label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'year',  label: 'Year' },
  { key: 'all',   label: 'All' },
];

interface DateRange {
  start: Date | null;
  end: Date | null;
  label: string;
}

function getRange(period: Period, offset: number): DateRange {
  if (period === 'all') return { start: null, end: null, label: 'All time' };

  const now = new Date();

  switch (period) {
    case 'day': {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
      return {
        start: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0),
        end:   new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999),
        label: offset === 0
          ? 'Today'
          : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
      };
    }
    case 'week': {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const dow = (today.getDay() + 6) % 7; // 0 = Monday
      const monday = new Date(today);
      monday.setDate(today.getDate() - dow + offset * 7);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);
      const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return {
        start: monday,
        end: sunday,
        label: `${fmt(monday)} – ${fmt(sunday)}`,
      };
    }
    case 'month': {
      const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      return {
        start: new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0),
        end:   new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999),
        label: d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      };
    }
    case 'year': {
      const year = now.getFullYear() + offset;
      return {
        start: new Date(year, 0, 1, 0, 0, 0, 0),
        end:   new Date(year, 11, 31, 23, 59, 59, 999),
        label: String(year),
      };
    }
  }
}

interface PaidEntry {
  category: ReceiptCategory;
  currency: string;
  scannedAt: string;
  amount: number;
}

interface CategoryStat {
  category: ReceiptCategory;
  amount: number;
  count: number;
}

// ─── Category Row ─────────────────────────────────────────────────────────────
function CategoryRow({ stat, maxAmount, currency }: { stat: CategoryStat; maxAmount: number; currency: string }) {
  const config = CATEGORY_CONFIG[stat.category];
  const barWidth = maxAmount > 0 ? (stat.amount / maxAmount) * 100 : 0;

  return (
    <View style={styles.catRow}>
      <View style={[styles.catIconBox, { backgroundColor: config.bgColor }]}>
        <Ionicons name={config.icon} size={18} color={config.color} />
      </View>
      <View style={styles.catInfo}>
        <View style={styles.catHeader}>
          <Text style={styles.catLabel}>{config.label}</Text>
          <Text style={[styles.catAmount, { color: config.color }]}>
            {currency} {stat.amount.toFixed(2)}
          </Text>
        </View>
        <View style={styles.catBarTrack}>
          <View style={[styles.catBarFill, { width: `${barWidth}%` as any, backgroundColor: config.color }]} />
        </View>
        <Text style={styles.catCount}>{stat.count} receipt{stat.count !== 1 ? 's' : ''}</Text>
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function StatsScreen() {
  const { user } = useAuth();
  const preferredCurrency = user?.preferredCurrency ?? 'RON';
  const { convert, loading: ratesLoading } = useCurrencyRates(preferredCurrency);
  const [entries, setEntries] = useState<PaidEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<Period>('month');
  const [offset, setOffset] = useState(0);

  const load = async () => {
    if (!user) return;
    try {
      const receipts = await api.receipts.list();
      const finalized = receipts.filter(r => r.finalized);

      const summaries = await Promise.all(
        finalized.map(r => api.receipts.summary(r.id).catch(() => null))
      );

      const result: PaidEntry[] = [];
      summaries.forEach((summary, i) => {
        if (!summary) return;
        const receipt = finalized[i];
        const participant = summary.participants.find(p => p.userId === user.id && p.paid);
        if (!participant) return;
        result.push({
          category: receipt.category,
          currency: receipt.currency,
          scannedAt: receipt.scannedAt,
          amount: Number(participant.totalOwed),
        });
      });

      setEntries(result);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => {
    setLoading(true);
    void load();
  }, []));

  const handlePeriodChange = (p: Period) => {
    setPeriod(p);
    setOffset(0);
  };

  const range = useMemo(() => getRange(period, offset), [period, offset]);

  const { total, byCategory, isMixed } = useMemo(() => {
    const filtered = entries.filter(e => {
      const d = new Date(e.scannedAt);
      if (range.start && d < range.start) return false;
      if (range.end && d > range.end) return false;
      return true;
    });

    const currencies = new Set(filtered.map(e => e.currency));
    const mixed = currencies.size > 1 || (currencies.size === 1 && !currencies.has(preferredCurrency));

    const catMap = new Map<ReceiptCategory, { amount: number; count: number }>();
    filtered.forEach(e => {
      const converted = convert(e.amount, e.currency);
      const prev = catMap.get(e.category) ?? { amount: 0, count: 0 };
      catMap.set(e.category, { amount: prev.amount + converted, count: prev.count + 1 });
    });

    const byCategory: CategoryStat[] = [];
    catMap.forEach((v, category) => byCategory.push({ category, ...v }));
    byCategory.sort((a, b) => b.amount - a.amount);

    return {
      total: byCategory.reduce((s, c) => s + c.amount, 0),
      byCategory,
      isMixed: mixed,
    };
  }, [entries, range, convert, preferredCurrency]);

  if (loading || ratesLoading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </SafeAreaView>
    );
  }

  const receiptCount = byCategory.reduce((s, c) => s + c.count, 0);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); void load(); }}
            tintColor={Colors.primary}
          />
        }
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.heading}>Statistics</Text>
            <Text style={styles.subheading}>Your paid breakdown</Text>
          </View>
          <View style={[styles.headerIcon, { backgroundColor: Colors.primaryLight }]}>
            <Ionicons name="bar-chart" size={22} color={Colors.primary} />
          </View>
        </View>

        {/* Period filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {PERIODS.map(p => (
            <TouchableOpacity
              key={p.key}
              style={[styles.filterChip, period === p.key && styles.filterChipActive]}
              onPress={() => handlePeriodChange(p.key)}
              activeOpacity={0.7}
            >
              <Text style={[styles.filterChipText, period === p.key && styles.filterChipTextActive]}>
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Period navigator */}
        {period !== 'all' && (
          <View style={styles.navigator}>
            <TouchableOpacity
              style={styles.navBtn}
              onPress={() => setOffset(o => o - 1)}
              activeOpacity={0.6}
            >
              <Ionicons name="chevron-back" size={20} color={Colors.primary} />
            </TouchableOpacity>

            <Text style={styles.navLabel}>{range.label}</Text>

            <TouchableOpacity
              style={[styles.navBtn, offset === 0 && styles.navBtnDisabled]}
              onPress={() => setOffset(o => Math.min(o + 1, 0))}
              disabled={offset === 0}
              activeOpacity={0.6}
            >
              <Ionicons
                name="chevron-forward"
                size={20}
                color={offset === 0 ? Colors.border : Colors.primary}
              />
            </TouchableOpacity>
          </View>
        )}

        {/* Total paid card */}
        <View style={styles.totalCard}>
          <View style={[styles.totalIconBox, { backgroundColor: Colors.successLight }]}>
            <Ionicons name="checkmark-circle" size={22} color={Colors.success} />
          </View>
          <View>
            <Text style={styles.totalLabel}>Total Paid</Text>
            <Text style={styles.totalAmount}>{preferredCurrency} {total.toFixed(2)}</Text>
            <Text style={styles.totalSub}>
              {receiptCount} receipt{receiptCount !== 1 ? 's' : ''}
              {isMixed ? ' · converted' : ''}
            </Text>
          </View>
        </View>

        {/* Category breakdown */}
        {byCategory.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="pie-chart-outline" size={64} color={Colors.border} />
            <Text style={styles.emptyTitle}>No data for this period</Text>
            <Text style={styles.emptySub}>Try a different time range or scan some receipts</Text>
          </View>
        ) : (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>By Category</Text>
            {byCategory.map(cat => (
              <CategoryRow
                key={cat.category}
                stat={cat}
                maxAmount={byCategory[0].amount}
                currency={preferredCurrency}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  scroll: { padding: 20, paddingBottom: 40 },

  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  heading: { fontSize: 24, fontWeight: '800', color: Colors.text },
  subheading: { fontSize: 14, color: Colors.textSecondary, marginTop: 2 },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Period chips
  filterRow: { gap: 8, paddingBottom: 12 },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterChipText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  filterChipTextActive: { color: '#fff' },

  // Period navigator
  navigator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    paddingHorizontal: 6,
    paddingVertical: 6,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.primaryLight,
  },
  navBtnDisabled: { backgroundColor: Colors.divider },
  navLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    flex: 1,
    textAlign: 'center',
  },

  // Total card
  totalCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 14,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  totalIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  totalLabel: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary, marginBottom: 2 },
  totalAmount: { fontSize: 22, fontWeight: '800', color: Colors.text },
  totalSub: { fontSize: 12, color: Colors.textMuted, marginTop: 1 },

  // Category section
  section: { gap: 10 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: Colors.text, marginBottom: 2 },

  catRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  catIconBox: {
    width: 42,
    height: 42,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  catInfo: { flex: 1 },
  catHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  catLabel: { fontSize: 14, fontWeight: '700', color: Colors.text },
  catAmount: { fontSize: 14, fontWeight: '700' },
  catBarTrack: {
    height: 6,
    backgroundColor: Colors.border,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 5,
  },
  catBarFill: { height: '100%', borderRadius: 3 },
  catCount: { fontSize: 11, color: Colors.textMuted },

  // Empty state
  empty: { alignItems: 'center', paddingTop: 48, gap: 10 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: Colors.textSecondary },
  emptySub: { fontSize: 13, color: Colors.textMuted, textAlign: 'center', paddingHorizontal: 32 },
});
