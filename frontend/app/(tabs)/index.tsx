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
import { useAuth } from '@/context/AuthContext';
import { Colors } from '@/constants/Colors';
import type { ReceiptDto } from '@/types';

function ReceiptCard({ receipt, onDelete }: { receipt: ReceiptDto; onDelete: () => void }) {
  const date = new Date(receipt.scannedAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const confirmDelete = () => {
    Alert.alert('Delete receipt', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: onDelete },
    ]);
  };

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/receipt/${receipt.id}` as any)}
      activeOpacity={0.7}
    >
      <View style={styles.cardLeft}>
        <View style={[styles.iconBox, { backgroundColor: Colors.primaryLight }]}>
          <Ionicons name="receipt" size={22} color={Colors.primary} />
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {receipt.title || 'Untitled receipt'}
          </Text>
          <Text style={styles.cardSub}>{date}</Text>
          {receipt.groupName && (
            <Text style={styles.groupTag}>
              <Ionicons name="people" size={11} /> {receipt.groupName}
            </Text>
          )}
        </View>
      </View>
      <View style={styles.cardRight}>
        <Text style={styles.amount}>
          {receipt.currency ?? 'RON'} {Number(receipt.totalAmount).toFixed(2)}
        </Text>
        <TouchableOpacity onPress={confirmDelete} hitSlop={8}>
          <Ionicons name="trash-outline" size={18} color={Colors.error} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

export default function ReceiptsScreen() {
  const { user } = useAuth();
  const [receipts, setReceipts] = useState<ReceiptDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const data = await api.receipts.list();
      setReceipts(data.sort((a, b) => new Date(b.scannedAt).getTime() - new Date(a.scannedAt).getTime()));
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { void load(); }, []));

  const handleDelete = async (id: string) => {
    try {
      await api.receipts.delete(id);
      setReceipts(prev => prev.filter(r => r.id !== id));
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
    <SafeAreaView style={styles.safe}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.greeting}>Hello, {user?.name?.split(' ')[0]} 👋</Text>
          <Text style={styles.heading}>Your Receipts</Text>
        </View>
        <TouchableOpacity
          style={styles.scanBtn}
          onPress={() => router.push('/receipt/scan' as any)}
        >
          <Ionicons name="camera" size={20} color="#fff" />
          <Text style={styles.scanBtnText}>Scan</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={receipts}
        keyExtractor={r => r.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor={Colors.primary} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="receipt-outline" size={64} color={Colors.border} />
            <Text style={styles.emptyTitle}>No receipts yet</Text>
            <Text style={styles.emptySub}>Tap Scan to upload your first receipt</Text>
          </View>
        }
        renderItem={({ item }) => (
          <ReceiptCard receipt={item} onDelete={() => handleDelete(item.id)} />
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  greeting: { fontSize: 14, color: Colors.textSecondary, marginBottom: 2 },
  heading: { fontSize: 24, fontWeight: '800', color: Colors.text },
  scanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 6,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  scanBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  list: { padding: 20, gap: 12, paddingBottom: 40 },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: Colors.text },
  cardSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  groupTag: { fontSize: 11, color: Colors.primary, marginTop: 3, fontWeight: '600' },
  cardRight: { alignItems: 'flex-end', gap: 6 },
  amount: { fontSize: 15, fontWeight: '700', color: Colors.text },
  empty: { alignItems: 'center', paddingTop: 80, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.textSecondary },
  emptySub: { fontSize: 14, color: Colors.textMuted, textAlign: 'center' },
});
