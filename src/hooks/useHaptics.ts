import * as Haptics from 'expo-haptics';
import { useMemo } from 'react';

interface HapticsApi {
  light(): void;
  success(): void;
  warning(): void;
  selection(): void;
}

export function useHaptics(): HapticsApi {
  return useMemo<HapticsApi>(
    () => ({
      light: () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
      success: () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
      warning: () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
      selection: () => void Haptics.selectionAsync(),
    }),
    [],
  );
}
