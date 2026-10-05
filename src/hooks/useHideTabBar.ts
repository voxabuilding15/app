import { useNavigation } from 'expo-router';
import { useEffect } from 'react';

import { tabBarStyleFor, useTheme } from '@/theme';

/** Hides the bottom tab bar while the calling screen is mounted (e.g. full-screen forms). */
export function useHideTabBar(): void {
  const navigation = useNavigation();
  const { colors } = useTheme();

  useEffect(() => {
    const tabs = navigation.getParent();
    tabs?.setOptions({ tabBarStyle: { display: 'none' } });
    return () => tabs?.setOptions({ tabBarStyle: tabBarStyleFor(colors) });
  }, [navigation, colors]);
}
