import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import { api } from './api';

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Splitify',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#5B5BD6',
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return null;
  }

  // Use Expo push token (backed by FCM on Android, APNs on iOS via Expo's infrastructure)
  // For direct Firebase integration: use Notifications.getDevicePushTokenAsync()
  // and configure google-services.json in the project
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;

  console.log('[Push] projectId:', projectId);

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    console.log('[Push] Expo token:', tokenData.data);
    return tokenData.data;
  } catch (e) {
    console.warn('[Push] getExpoPushTokenAsync failed:', e);
    try {
      const deviceToken = await Notifications.getDevicePushTokenAsync();
      console.log('[Push] Device token (raw FCM):', deviceToken.data);
      return deviceToken.data;
    } catch (e2) {
      console.warn('[Push] getDevicePushTokenAsync failed:', e2);
      return null;
    }
  }
}

function navigateFromNotification(data: Record<string, string> | undefined) {
  if (!data?.relatedEntityId) return;
  if (data.type === 'GROUP_ADDED') {
    router.push(`/group/${data.relatedEntityId}` as any);
  } else if (data.type === 'PAYMENT_REQUESTED' || data.type === 'PAYMENT_RECEIVED') {
    router.push(`/receipt/${data.relatedEntityId}` as any);
  }
}

export function usePushNotifications() {
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  async function registerToken() {
    if (Platform.OS === 'web') return;
    try {
      const token = await registerForPushNotificationsAsync();
      if (token) {
        await api.users.updatePushToken(token);
      }
    } catch (e) {
      console.warn('Push token registration failed:', e);
    }
  }

  useEffect(() => {
    if (Platform.OS === 'web') return;
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data as Record<string, string> | undefined;
      navigateFromNotification(data);
    });

    return () => {
      responseListener.current?.remove();
    };
  }, []);

  return { registerToken };
}
