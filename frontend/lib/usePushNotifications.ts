import { useCallback } from 'react';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { api } from './api';

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: false,
      shouldSetBadge: true,
      shouldShowBanner: false,
      shouldShowList: false,
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

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    return tokenData.data;
  } catch {
    try {
      const deviceToken = await Notifications.getDevicePushTokenAsync();
      return deviceToken.data;
    } catch {
      return null;
    }
  }
}

export function usePushNotifications() {
  const registerToken = useCallback(async () => {
    if (Platform.OS === 'web') return;
    try {
      const token = await registerForPushNotificationsAsync();
      if (token) {
        await api.users.updatePushToken(token);
      }
    } catch {
      // registration failure is non-fatal
    }
  }, []);

  const unregisterToken = useCallback(async () => {
    if (Platform.OS === 'web') return;
    try {
      const token = await registerForPushNotificationsAsync();
      if (token) {
        await api.users.clearPushToken(token);
      }
    } catch {
      // non-fatal
    }
  }, []);

  return { registerToken, unregisterToken };
}
