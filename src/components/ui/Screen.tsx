import { ScrollView, View, type StyleProp, type ViewStyle } from 'react-native';
import type { PropsWithChildren } from 'react';

import { useIsTablet } from '@/hooks';
import { spacing, useTheme } from '@/theme';

export interface ScreenProps extends PropsWithChildren {
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}

const TABLET_MAX_WIDTH = 720;

export function Screen({ scroll = true, contentStyle, children }: ScreenProps) {
  const { colors } = useTheme();
  const isTablet = useIsTablet();

  const inner: ViewStyle = {
    gap: spacing.lg,
    padding: spacing.lg,
    width: '100%',
    maxWidth: isTablet ? TABLET_MAX_WIDTH : undefined,
    alignSelf: 'center',
  };

  if (!scroll) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={[inner, { flex: 1 }, contentStyle]}>{children}</View>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[inner, contentStyle]}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}
