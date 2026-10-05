import { Stack } from 'expo-router';

import { useTheme } from '@/theme';

/**
 * Themed native stack shared by feature tabs. The `index` route draws its own toolbar; every other
 * route (forms, details) uses the native header.
 */
export function FeatureStack() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: { color: colors.onSurface },
        headerTintColor: colors.onSurface,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
    </Stack>
  );
}
