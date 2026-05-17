import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import { api } from '@/lib/api';
import type { NotificationDto } from '@/types';
import { useAuth } from './AuthContext';

interface NotificationContextType {
  notifications: NotificationDto[];
  unreadCount: number;
  loading: boolean;
  fetchNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  const [notifications, setNotifications] = useState<NotificationDto[]>([]);
  const [loading, setLoading] = useState(false);
  const foregroundListener = useRef<Notifications.EventSubscription | null>(null);
  const tapListener = useRef<Notifications.EventSubscription | null>(null);

  const unreadCount = notifications.filter(n => !n.read).length;

  const fetchNotifications = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await api.notifications.list();
      setNotifications(data);
    } catch {
      // ignore network errors silently
    } finally {
      setLoading(false);
    }
  }, [token]);

  const markAsRead = async (id: string) => {
    await api.notifications.markRead(id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllAsRead = async () => {
    await api.notifications.markAllRead();
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  useEffect(() => {
    if (Platform.OS === 'web') return;
    tapListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data as Record<string, string> | undefined;
      if (data?.notificationId) {
        api.notifications.markRead(data.notificationId)
          .then(() => {
            setNotifications(prev => prev.map(n => n.id === data.notificationId ? { ...n, read: true } : n));
          })
          .catch(() => {});
      }
      if (!data?.relatedEntityId) return;
      if (data.type === 'GROUP_ADDED') {
        router.push(`/group/${data.relatedEntityId}` as any);
      } else if (data.type === 'PAYMENT_REQUESTED' || data.type === 'PAYMENT_RECEIVED') {
        router.push(`/receipt/${data.relatedEntityId}` as any);
      }
    });
    return () => {
      tapListener.current?.remove();
    };
  }, []);

  useEffect(() => {
    if (!token) {
      setNotifications([]);
      return;
    }
    void fetchNotifications();
    if (Platform.OS !== 'web') {
      foregroundListener.current = Notifications.addNotificationReceivedListener(() => {
        void fetchNotifications();
      });
    }
    return () => {
      foregroundListener.current?.remove();
    };
  }, [token, fetchNotifications]);

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, loading, fetchNotifications, markAsRead, markAllAsRead }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used inside NotificationProvider');
  return ctx;
}
