import { useState, useCallback } from 'react';
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
import { Colors } from '@/constants/Colors';
import { CATEGORY_CONFIG } from '@/constants/categories';
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
  const nextDate = new Date(item.nextRunAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const catCfg = CATEGORY_CONFIG[item.category] ?? CATEGORY_CONFIG.OTHER;

  return (
    <View style={styles.card}>
      <View style={styles.cardInner}>
        <View style={[styles.iconBox, { backgroundColor: item.active ? catCfg.bgColor : Colors.divider }]}>
          <Ionicons name={catCfg.icon as any} size={20} color={item.active ? catCfg.color : Colors.textMuted} />
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
              <Ionicons name="people-outline" size={11} color={Colors.textMuted} />
              <Text style={styles.cardGroup}>{item.groupName}</Text>
            </View>
          )}
        </View>

        <View style={styles.cardRight}>
          <Text style={styles.cardAmount}>
            {item.currency} {Number(item.amount).toFixed(2)}
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
                color={item.active ? Colors.primary : Colors.textMuted}
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
              <Ionicons name="trash-outline" size={13} color={Colors.error} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

export default function RecurringScreen() {
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
        <ActivityIndicator size="large" color={Colors.primary} />
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
            colors={[Colors.primary]}
          />
        }
        ListHeaderComponent={
          <View style={styles.headingRow}>
            <View>
              <Text style={styles.heading}>Recurring</Text>
              <Text style={styles.subheading}>Scheduled expense splits</Text>
            </View>
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => router.push('/recurring/new' as any)}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="repeat-outline" size={56} color={Colors.textSecondary} />
            <Text style={styles.emptyTitle}>No recurring expenses</Text>
            <Text style={styles.emptyHint}>Tap + to schedule a recurring split</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },

  headingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  heading: { fontSize: 24, fontWeight: '800', color: Colors.text },
  subheading: { fontSize: 14, color: Colors.textSecondary, marginTop: 2 },
  addBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 20,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },

  list: { padding: 20, gap: 10 },
  emptyContainer: { padding: 20 },
  empty: { alignItems: 'center', gap: 10, paddingTop: 64 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: Colors.text },
  emptyHint: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center' },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
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
  cardTitle: { fontSize: 15, fontWeight: '600', color: Colors.text, flexShrink: 1 },
  pausedBadge: {
    backgroundColor: Colors.divider,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  pausedBadgeText: { fontSize: 10, fontWeight: '700', color: Colors.textMuted },
  cardSub: { fontSize: 12, color: Colors.textSecondary },
  groupRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 },
  cardGroup: { fontSize: 11, color: Colors.textMuted },

  cardRight: { alignItems: 'flex-end', gap: 6 },
  cardAmount: { fontSize: 14, fontWeight: '700', color: Colors.text },
  actions: { flexDirection: 'row', gap: 6 },
  iconBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnPrimary: { backgroundColor: Colors.primaryLight },
  iconBtnMuted: { backgroundColor: Colors.divider },
  iconBtnDanger: { backgroundColor: Colors.errorLight },
});
