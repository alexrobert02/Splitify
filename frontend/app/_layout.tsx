import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '@/context/AuthContext';
import { NotificationProvider } from '@/context/NotificationContext';

export default function RootLayout() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="receipt/scan" options={{ presentation: 'modal', headerShown: false }} />
          <Stack.Screen name="receipt/review" options={{ headerShown: false }} />
          <Stack.Screen name="receipt/[id]" />
          <Stack.Screen name="group/[id]" />
        </Stack>
      </NotificationProvider>
    </AuthProvider>
  );
}
