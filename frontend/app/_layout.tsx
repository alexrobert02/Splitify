import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '@/context/AuthContext';
import { NotificationProvider } from '@/context/NotificationContext';
import { Colors } from '@/constants/Colors';

export default function RootLayout() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.background } }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="receipt/scan" options={{ presentation: 'modal', headerShown: false }} />
          <Stack.Screen name="receipt/review" options={{ headerShown: false }} />
          <Stack.Screen name="receipt/[id]" />
        </Stack>
      </NotificationProvider>
    </AuthProvider>
  );
}
