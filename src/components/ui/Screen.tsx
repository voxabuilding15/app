import type { PropsWithChildren } from 'react';
import { ScrollView, View, type StyleProp, type ViewStyle } from 'react-native';

import { CONTENT_MAX_WIDTH, spacing, useTheme } from '@/theme';

export interface ScreenProps extends PropsWithChildren {
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  /** Overrides the default readable content width, e.g. for two-column tablet layouts. */
  maxWidth?: number;
}

/** Content is centered and width-capped so it stays readable on tablets and landscape. */
const CONTENT: ViewStyle = {
  gap: spacing.lg,
  padding: spacing.lg,
  width: '100%',
  alignSelf: 'center',
};

export function Screen({
  scroll = true,
  contentStyle,
  maxWidth = CONTENT_MAX_WIDTH,
  children,
}: ScreenProps) {
  const { colors } = useTheme();
  const background = { flex: 1, backgroundColor: colors.background } as const;
  const content = [CONTENT, { maxWidth }, contentStyle];

  if (!scroll) {
    return (
      <View style={background}>
        <View style={[content, { flex: 1 }]}>{children}</View>
      </View>
    );
  }

  return (
    <ScrollView
      style={background}
      contentContainerStyle={content}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}
