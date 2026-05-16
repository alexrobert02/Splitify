import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useNotifications } from '@/context/NotificationContext';
import type { NotificationDto, NotificationType } from '@/types';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

type IconConfig = { name: React.ComponentProps<typeof Ionicons>['name']; color: string; bg: string };

function notificationIcon(type: NotificationType): IconConfig {
  switch (type) {
    case 'GROUP_ADDED':
      return { name: 'people', color: Colors.primary, bg: Colors.primaryLight };
    case 'PAYMENT_REQUESTED':
      return { name: 'cash', color: Colors.warning, bg: Colors.warningLight };
    case 'PAYMENT_RECEIVED':
      return { name: 'checkmark-circle', color: Colors.success, bg: Colors.successLight };
    default:
      return { name: 'notifications', color: Colors.textSecondary, bg: Colors.divider };
  }
}

function NotificationCard({ item, onPress }: { item: NotificationDto; onPress: () => void }) {
  const icon = notificationIcon(item.type);
  return (
    <TouchableOpacity
      style={[styles.card, !item.read && styles.cardUnread]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.iconBox, { backgroundColor: icon.bg }]}>
        <Ionicons name={icon.name} size={22} color={icon.color} />
      </View>
      <View style={styles.cardInfo}>
        <View style={styles.cardRow}>
          <Text style={[styles.cardTitle, !item.read && styles.cardTitleUnread]} numberOfLines={1}>
            {item.title}
          </Text>
          {!item.read && <View style={styles.newDot} />}
        </View>
        <Text style={styles.cardBody} numberOfLines={2}>{item.body}</Text>
        <Text style={styles.cardTime}>{timeAgo(item.createdAt)}</Text>
      </View>
    </TouchableOpacity>
  );
}

type ListItem =
  | { kind: 'header'; label: string }
  | { kind: 'item'; data: NotificationDto };

export default function NotificationsScreen() {
  const { notifications, unreadCount, loading, fetchNotifications, markAsRead, markAllAsRead } =
    useNotifications();

  const items: ListItem[] = useMemo(() => {
    const unread = notifications.filter(n => !n.read);
    const read = notifications.filter(n => n.read);
    const result: ListItem[] = [];
    if (unread.length > 0) {
      result.push({ kind: 'header', label: 'New' });
      unread.forEach(n => result.push({ kind: 'item', data: n }));
    }
    if (read.length > 0) {
      result.push({ kind: 'header', label: 'Earlier' });
      read.forEach(n => result.push({ kind: 'item', data: n }));
    }
    return result;
  }, [notifications]);

  const handlePress = useCallback(
    async (item: NotificationDto) => {
      if (!item.read) await markAsRead(item.id);
      if (!item.relatedEntityId) return;
      if (item.type === 'GROUP_ADDED') {
        router.push(`/group/${item.relatedEntityId}` as any);
      } else if (item.type === 'PAYMENT_REQUESTED' || item.type === 'PAYMENT_RECEIVED') {
        router.push(`/receipt/${item.relatedEntityId}` as any);
      }
    },
    [markAsRead]
  );

  if (loading && notifications.length === 0) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.headerRow}>
        <Text style={styles.heading}>Notifications</Text>
        {unreadCount > 0 && (
          <TouchableOpacity style={styles.markAllBtn} onPress={markAllAsRead} activeOpacity={0.7}>
            <Ionicons name="checkmark-done" size={16} color="#fff" />
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) =>
          item.kind === 'header' ? `header-${item.label}` : item.data.id
        }
        contentContainerStyle={notifications.length === 0 ? styles.emptyContainer : styles.list}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={fetchNotifications}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
        renderItem={({ item }) => {
          if (item.kind === 'header') {
            return <Text style={styles.sectionLabel}>{item.label}</Text>;
          }
          return <NotificationCard item={item.data} onPress={() => handlePress(item.data)} />;
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="notifications-off-outline" size={64} color={Colors.border} />
            <Text style={styles.emptyTitle}>No notifications yet</Text>
            <Text style={styles.emptySub}>
              You&#39;ll be notified when someone adds you to a group or requests a payment.
            </Text>
          </View>
        }
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
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  heading: { fontSize: 24, fontWeight: '800', color: Colors.text },
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  markAllText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  list: { paddingHorizontal: 20, paddingBottom: 40 },
  emptyContainer: { flex: 1 },

  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 16,
    marginBottom: 8,
  },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardUnread: {
    backgroundColor: '#F0F0FF',
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  cardInfo: { flex: 1 },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 3,
  },
  cardTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  cardTitleUnread: { fontWeight: '800' },
  newDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
    flexShrink: 0,
  },
  cardBody: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginBottom: 6,
  },
  cardTime: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '500',
  },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.textSecondary },
  emptySub: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', paddingHorizontal: 20 },
});
