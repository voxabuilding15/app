import { View } from 'react-native';

import { useTheme } from '@/theme';

export function Divider() {
  const { colors } = useTheme();
  return (
    <View accessibilityRole="none" style={{ height: 1, backgroundColor: colors.outlineVariant }} />
  );
}
