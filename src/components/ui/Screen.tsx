import type { PropsWithChildren } from 'react';
import { ScrollView, View, type StyleProp, type ViewStyle } from 'react-native';

import { CONTENT_MAX_WIDTH, spacing, useTheme } from '@/theme';

export interface ScreenProps extends PropsWithChildren {
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}

/** Content is centered and width-capped so it stays readable on tablets and landscape. */
const CONTENT: ViewStyle = {
  gap: spacing.lg,
  padding: spacing.lg,
  width: '100%',
  maxWidth: CONTENT_MAX_WIDTH,
  alignSelf: 'center',
};

export function Screen({ scroll = true, contentStyle, children }: ScreenProps) {
  const { colors } = useTheme();
  const background = { flex: 1, backgroundColor: colors.background } as const;

  if (!scroll) {
    return (
      <View style={background}>
        <View style={[CONTENT, { flex: 1 }, contentStyle]}>{children}</View>
      </View>
    );
  }

  return (
    <ScrollView
      style={background}
      contentContainerStyle={[CONTENT, contentStyle]}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}
