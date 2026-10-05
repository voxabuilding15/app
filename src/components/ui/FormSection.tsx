import type { PropsWithChildren } from 'react';
import { View } from 'react-native';

import { spacing } from '@/theme';

import { Card } from './Card';
import { Text } from './Text';

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
