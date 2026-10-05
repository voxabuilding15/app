import { memo, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { Icon, SwipeableRow, Text, type IconName, type SwipeAction } from '@/components';
import { radius, spacing, useTheme, withAlpha } from '@/theme';

interface RowAction {
  name: string;
  label: string;
  run: () => void;
}

export interface MoneyRowProps {
  icon: IconName;
  /** Color of the icon badge. */
  accent: string;
  title: string;
  subtitle?: string;
  /** Shown on the right, e.g. "-$5.00". */
  amountText: string;
  amountColor?: string;
  /** Spoken description of the whole row. */
  label: string;
  /** Muted when the item is archived, paused or finished. */
  dimmed?: boolean;
  /** Revealed by swiping right. */
  leftActions?: readonly SwipeAction[];
  /** Revealed by swiping left. */
  rightActions?: readonly SwipeAction[];
  /** The same operations for screen readers, which cannot swipe. */
  accessibilityActions?: readonly RowAction[];
  onPress: () => void;
  children?: ReactNode;
}

const BADGE = 40;

/** Row for money things: icon badge, title and subtitle, amount, with swipe actions. */
function MoneyRowComponent({
  icon,
  accent,
  title,
  subtitle,
  amountText,
  amountColor,
  label,
  dimmed = false,
  leftActions,
  rightActions,
  accessibilityActions = [],
  onPress,
  children,
}: MoneyRowProps) {
  const { colors } = useTheme();

  return (
    <View style={{ borderRadius: radius.md, overflow: 'hidden' }}>
      <SwipeableRow leftActions={leftActions} rightActions={rightActions}>
        <Pressable
          accessible
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityActions={accessibilityActions.map(({ name, label: actionLabel }) => ({
            name,
            label: actionLabel,
          }))}
          onAccessibilityAction={({ nativeEvent }) =>
            accessibilityActions.find((action) => action.name === nativeEvent.actionName)?.run()
          }
          onPress={onPress}
          android_ripple={{ color: colors.outlineVariant }}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
            minHeight: 64,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
            opacity: dimmed ? 0.65 : 1,
            backgroundColor: colors.surfaceContainer,
          }}
        >
          <View
            style={{
              width: BADGE,
              height: BADGE,
              borderRadius: BADGE / 2,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: withAlpha(accent, 0.18),
            }}
          >
            <Icon name={icon} size={22} color={accent} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="bodyLarge" numberOfLines={1}>
              {title}
            </Text>
            {subtitle ? (
              <Text variant="labelSmall" tone="muted" numberOfLines={2}>
                {subtitle}
              </Text>
            ) : null}
            {children}
          </View>
          <Text
            variant="titleMedium"
            numberOfLines={1}
            style={{ color: amountColor ?? colors.onSurface }}
          >
            {amountText}
          </Text>
        </Pressable>
      </SwipeableRow>
    </View>
  );
}

export const MoneyRow = memo(MoneyRowComponent);
