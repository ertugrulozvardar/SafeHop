import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { colors } from '../theme';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerTintColor: colors.brand,
          headerTitleStyle: { color: colors.text, fontWeight: '700' },
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.card },
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'SafeHop' }} />
        <Stack.Screen name="city/[id]" options={{ title: '' }} />
        <Stack.Screen name="route/[id]" options={{ title: 'Safest route' }} />
        <Stack.Screen name="about" options={{ title: 'About the data' }} />
      </Stack>
    </>
  );
}
