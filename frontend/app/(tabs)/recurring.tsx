import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/lib/api';
import { useTheme, type ColorPalette } from '@/context/ThemeContext';
import { useCategoryConfig } from '@/constants/categories';
import type { RecurringExpenseDto, RecurrenceFrequency } from '@/types';

const FREQ_LABEL: Record<RecurrenceFrequency, string> = {
  DAILY: 'Daily',
  WEEKLY: 'Weekly',
  MONTHLY: 'Monthly',
  YEARLY: 'Yearly',
};

function RecurringCard({
  item,
  onToggle,
  onDelete,
}: {
  item: RecurringExpenseDto;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const catConfig = useCategoryConfig();
  const nextDate = new Date(item.nextRunAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const catCfg = catConfig[item.category] ?? catConfig.OTHER;

  return (
    <View style={styles.card}>
      <View style={styles.cardInner}>
        <View style={[styles.iconBox, { backgroundColor: item.active ? catCfg.bgColor : colors.divider }]}>
          <Ionicons name={catCfg.icon as any} size={20} color={item.active ? catCfg.color : colors.textMuted} />
        </View>

        <View style={styles.cardBody}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
            {!item.active && (
              <View style={styles.pausedBadge}>
                <Text style={styles.pausedBadgeText}>Paused</Text>
              </View>
            )}
          </View>
          <Text style={styles.cardSub}>
            {FREQ_LABEL[item.frequency]} · Next: {nextDate}
          </Text>
          {item.groupName && (
            <View style={styles.groupRow}>
              <Ionicons name="people-outline" size={11} color={colors.textMuted} />
              <Text style={styles.cardGroup}>{item.groupName}</Text>
            </View>
          )}
        </View>

        <View style={styles.cardRight}>
          <Text style={styles.cardAmount}>
            {item.currency} {Number(item.totalAmount).toFixed(2)}
          </Text>
          <View style={styles.actions}>
            <TouchableOpacity
              onPress={onToggle}
              style={[styles.iconBtn, item.active ? styles.iconBtnPrimary : styles.iconBtnMuted]}
              hitSlop={6}
            >
              <Ionicons
                name={item.active ? 'pause' : 'play'}
                size={13}
                color={item.active ? colors.primary : colors.textMuted}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() =>
                Alert.alert(
                  'Delete recurring expense',
                  `Delete "${item.title}"?\nAlready created receipts won't be affected.`,
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: onDelete },
                  ]
                )
              }
              style={[styles.iconBtn, styles.iconBtnDanger]}
              hitSlop={6}
            >
              <Ionicons name="trash-outline" size={13} color={colors.error} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

export default function RecurringScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [items, setItems] = useState<RecurringExpenseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await api.recurring.list();
      setItems(data);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleToggle = async (id: string) => {
    try {
      const updated = await api.recurring.toggle(id);
      setItems(prev => prev.map(x => (x.id === id ? updated : x)));
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.recurring.delete(id);
      setItems(prev => prev.filter(x => x.id !== id));
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={x => x.id}
        renderItem={({ item }) => (
          <RecurringCard
            item={item}
            onToggle={() => handleToggle(item.id)}
            onDelete={() => handleDelete(item.id)}
          />
        )}
        contentContainerStyle={items.length === 0 ? styles.emptyContainer : styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(true); }}
            colors={[colors.primary]}
          />
        }
        ListHeaderComponent={
          <View style={styles.headingRow}>
            <View>
              <Text style={styles.heading}>Recurring</Text>
              <Text style={styles.subheading}>Scheduled expense splits</Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="repeat-outline" size={56} color={colors.textSecondary} />
            <Text style={styles.emptyTitle}>No recurring expenses</Text>
            <Text style={styles.emptyHint}>Tap + to schedule a recurring split</Text>
          </View>
        }
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/recurring/new' as any)}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={18} color="#fff" />
        <Text style={styles.fabText}>New Recurring</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const getStyles = (c: ColorPalette) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: c.background },

  headingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  heading: { fontSize: 24, fontWeight: '800', color: c.text },
  subheading: { fontSize: 14, color: c.textSecondary, marginTop: 2 },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    backgroundColor: c.primary,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    shadowColor: c.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  fabText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  list: { padding: 20, gap: 10, paddingBottom: 90 },
  emptyContainer: { padding: 20 },
  empty: { alignItems: 'center', gap: 10, paddingTop: 64 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: c.text },
  emptyHint: { fontSize: 13, color: c.textSecondary, textAlign: 'center' },

  card: {
    backgroundColor: c.surface,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: c.border,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  cardInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1, gap: 3 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: c.text, flexShrink: 1 },
  pausedBadge: {
    backgroundColor: c.divider,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  pausedBadgeText: { fontSize: 10, fontWeight: '700', color: c.textMuted },
  cardSub: { fontSize: 12, color: c.textSecondary },
  groupRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 },
  cardGroup: { fontSize: 11, color: c.textMuted },

  cardRight: { alignItems: 'flex-end', gap: 6 },
  cardAmount: { fontSize: 14, fontWeight: '700', color: c.text },
  actions: { flexDirection: 'row', gap: 6 },
  iconBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnPrimary: { backgroundColor: c.primaryLight },
  iconBtnMuted: { backgroundColor: c.divider },
  iconBtnDanger: { backgroundColor: c.errorLight },
});
