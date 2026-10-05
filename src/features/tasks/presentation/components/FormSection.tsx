import type { PropsWithChildren } from 'react';
import { View } from 'react-native';

import { Card, Text } from '@/components';
import { spacing } from '@/theme';

interface FormSectionProps extends PropsWithChildren {
  title: string;
  error?: string;
}

/** Titled card used to group related fields on the task form. */
export function FormSection({ title, error, children }: FormSectionProps) {
  return (
    <Card style={{ gap: spacing.md }}>
      <Text variant="titleMedium" accessibilityRole="header">
        {title}
      </Text>
      {children}
      {error ? (
        <View accessibilityLiveRegion="polite">
          <Text variant="labelSmall" tone="error">
            {error}
          </Text>
        </View>
      ) : null}
    </Card>
  );
}

export const WRAP_ROW = {
  flexDirection: 'row',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: spacing.sm,
} as const;
