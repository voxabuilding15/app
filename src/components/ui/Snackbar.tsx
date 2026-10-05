import { useEffect } from 'react';
import { View } from 'react-native';

import { CONTENT_MAX_WIDTH, radius, spacing, useTheme } from '@/theme';

import { Button } from './Button';
import { Text } from './Text';

export interface SnackbarProps {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss: () => void;
  durationMs?: number;
  /** Distance from the bottom edge, e.g. to clear a floating action button. */
  bottomOffset?: number;
}

const DEFAULT_DURATION_MS = 6_000;

export function Snackbar({
  message,
  actionLabel,
  onAction,
  onDismiss,
  durationMs = DEFAULT_DURATION_MS,
  bottomOffset = spacing.lg,
}: SnackbarProps) {
  const { colors } = useTheme();

  useEffect(() => {
    const timer = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(timer);
  }, [message, durationMs, onDismiss]);

  return (
    <View
      accessibilityLiveRegion="polite"
      style={{
        position: 'absolute',
        left: spacing.lg,
        right: spacing.lg,
        bottom: bottomOffset,
        maxWidth: CONTENT_MAX_WIDTH,
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.md,
        paddingLeft: spacing.lg,
        paddingRight: spacing.sm,
        minHeight: 56,
        borderRadius: radius.md,
        backgroundColor: colors.onSurface,
        elevation: 6,
      }}
    >
      <Text style={{ flex: 1, color: colors.surface }}>{message}</Text>
      {actionLabel && onAction ? (
        <View style={{ borderRadius: radius.full, backgroundColor: colors.surface }}>
          <Button label={actionLabel} variant="text" onPress={onAction} />
        </View>
      ) : null}
    </View>
  );
}
