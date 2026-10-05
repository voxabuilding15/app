import type { PropsWithChildren } from 'react';
import { View } from 'react-native';

import { spacing } from '@/theme';

import { Text } from './Text';

export const WRAP_ROW = {
  flexDirection: 'row',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: spacing.sm,
} as const;

interface ChipGroupProps extends PropsWithChildren {
  title: string;
}

/** A small muted heading above a wrapping row of chips. */
export function ChipGroup({ title, children }: ChipGroupProps) {
  return (
    <View style={{ gap: spacing.sm }}>
      <Text variant="labelLarge" tone="muted" accessibilityRole="header">
        {title}
      </Text>
      <View style={WRAP_ROW}>{children}</View>
    </View>
  );
}
