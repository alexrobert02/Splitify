import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
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
    if (!token) {
      setNotifications([]);
      return;
    }
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30_000);
    if (Platform.OS !== 'web') {
      foregroundListener.current = Notifications.addNotificationReceivedListener(() => {
        fetchNotifications();
      });
    }
    return () => {
      clearInterval(interval);
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
