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
import { useTheme, type ColorPalette } from '@/context/ThemeContext';
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

function notificationIcon(type: NotificationType, c: ColorPalette): IconConfig {
  switch (type) {
    case 'GROUP_ADDED':
      return { name: 'people', color: c.primary, bg: c.primaryLight };
    case 'PAYMENT_REQUESTED':
      return { name: 'cash', color: c.warning, bg: c.warningLight };
    case 'PAYMENT_RECEIVED':
      return { name: 'checkmark-circle', color: c.success, bg: c.successLight };
    default:
      return { name: 'notifications', color: c.textSecondary, bg: c.divider };
  }
}

function NotificationCard({ item, onPress }: { item: NotificationDto; onPress: () => void }) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const icon = notificationIcon(item.type, colors);
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
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
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
        <ActivityIndicator size="large" color={colors.primary} />
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
            tintColor={colors.primary}
            colors={[colors.primary]}
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
            <Ionicons name="notifications-off-outline" size={64} color={colors.border} />
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

const getStyles = (c: ColorPalette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: c.background },

  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  heading: { fontSize: 24, fontWeight: '800', color: c.text },
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: c.primary,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: c.primary,
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
    color: c.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 16,
    marginBottom: 8,
  },

  card: {
    backgroundColor: c.surface,
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
    backgroundColor: c.primaryLight,
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
    color: c.text,
  },
  cardTitleUnread: { fontWeight: '800' },
  newDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: c.primary,
    flexShrink: 0,
  },
  cardBody: {
    fontSize: 13,
    color: c.textSecondary,
    lineHeight: 18,
    marginBottom: 6,
  },
  cardTime: {
    fontSize: 12,
    color: c.textMuted,
    fontWeight: '500',
  },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: c.textSecondary },
  emptySub: { fontSize: 14, color: c.textMuted, textAlign: 'center', paddingHorizontal: 20 },
});
