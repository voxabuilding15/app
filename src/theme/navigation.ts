import type { ViewStyle } from 'react-native';

import type { ColorScheme } from './colors';

export function tabBarStyleFor(colors: ColorScheme): ViewStyle {
  return { backgroundColor: colors.surfaceContainer, borderTopColor: colors.outlineVariant };
}
