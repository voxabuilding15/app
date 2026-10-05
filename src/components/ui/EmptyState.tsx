import { View } from 'react-native';

import { spacing, useTheme } from '@/theme';

import { Button } from './Button';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export interface EmptyStateProps {
  icon: IconName;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon, title, message, actionLabel, onAction }: EmptyStateProps) {
  const { colors } = useTheme();

  return (
    <View
      style={{
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: spacing.xxl,
        paddingHorizontal: spacing.xl,
      }}
    >
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: 36,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.primaryContainer,
        }}
      >
        <Icon name={icon} size={36} color={colors.onPrimaryContainer} />
      </View>
      <Text variant="titleMedium" style={{ textAlign: 'center' }}>
        {title}
      </Text>
      <Text tone="muted" style={{ textAlign: 'center' }}>
        {message}
      </Text>
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} variant="tonal" />
      ) : null}
    </View>
  );
}
