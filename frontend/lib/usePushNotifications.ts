import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { api } from './api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

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

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    return tokenData.data;
  } catch {
    // Fallback to device push token (raw FCM token) for development builds
    const deviceToken = await Notifications.getDevicePushTokenAsync();
    return deviceToken.data;
  }
}

export function usePushNotifications() {
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  async function registerToken() {
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
    notificationListener.current = Notifications.addNotificationReceivedListener(() => {
      // foreground notification received — context will refresh via polling
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener(() => {
      // user tapped notification — navigate if needed
    });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);

  return { registerToken };
}
