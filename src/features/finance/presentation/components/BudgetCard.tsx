import { memo } from 'react';
import { Pressable, View } from 'react-native';

import { Icon, ProgressBar, SwipeableRow, Text, type SwipeAction } from '@/components';
import { formatMoney } from '@/core';
import { radius, spacing, useTheme } from '@/theme';
import { useTranslator } from '@/i18n';

import type { BudgetProgress } from '../../domain/entities';
import { BUDGET_PERIOD_LABEL, describeBudget, formatDayRange } from '../format';

export interface BudgetCardProps {
  progress: BudgetProgress;
  currency: string;
  onPress: (progress: BudgetProgress) => void;
  onDelete: (progress: BudgetProgress) => void;
}

function BudgetCardComponent({ progress, currency, onPress, onDelete }: BudgetCardProps) {
  const { t } = useTranslator();
  const { colors } = useTheme();
  const { budget, spentMinor, remainingMinor, fraction, state, phase } = progress;

  const barColor =
    state === 'over' ? colors.error : state === 'warning' ? colors.warning : colors.primary;
  const rightActions: SwipeAction[] = [
    {
      label: t('Delete'),
      icon: 'delete',
      background: colors.error,
      foreground: colors.surface,
      onPress: () => onDelete(progress),
    },
  ];

  const standing =
    remainingMinor < 0
      ? t('Over by {money}', { money: formatMoney(-remainingMinor, currency) })
      : t('{money} left', { money: formatMoney(remainingMinor, currency) });
  const phaseNote = phase === 'upcoming' ? t('Not started') : phase === 'ended' ? t('Ended') : null;

  return (
    <View style={{ borderRadius: radius.lg, overflow: 'hidden' }}>
      <SwipeableRow rightActions={rightActions}>
        <Pressable
          accessible
          accessibilityRole="button"
          accessibilityLabel={describeBudget(progress, currency)}
          accessibilityActions={[{ name: 'delete', label: t('Delete') }]}
          onAccessibilityAction={() => onDelete(progress)}
          onPress={() => onPress(progress)}
          android_ripple={{ color: colors.outlineVariant }}
          style={{
            gap: spacing.sm,
            padding: spacing.lg,
            backgroundColor: colors.surfaceContainer,
            opacity: phase === 'active' ? 1 : 0.7,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            {state === 'over' ? <Icon name="warning" size={20} color={colors.error} /> : null}
            <Text variant="titleMedium" numberOfLines={1} style={{ flex: 1 }}>
              {budget.name}
            </Text>
            <Text variant="labelSmall" tone="muted">
              {[BUDGET_PERIOD_LABEL[budget.period], phaseNote].filter(Boolean).join(' · ')}
            </Text>
          </View>
          <ProgressBar
            progress={fraction}
            color={barColor}
            height={10}
            label={t('{round}% of the budget spent', { round: Math.round(fraction * 100) })}
          />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }}>
            <Text variant="bodyMedium">
              {`${formatMoney(spentMinor, currency)} of ${formatMoney(budget.amountMinor, currency)}`}
            </Text>
            <Text
              variant="labelLarge"
              style={{ color: state === 'over' ? colors.error : colors.onSurface }}
            >
              {standing}
            </Text>
          </View>
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: spacing.md,
            }}
          >
            <Text variant="labelSmall" tone="muted">
              {formatDayRange(progress.from, progress.to)}
            </Text>
            {progress.categories.length === 0 ? (
              <Text variant="labelSmall" tone="muted">
                {t('All spending')}
              </Text>
            ) : (
              progress.categories.map((category) => (
                <View
                  key={category.id}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}
                >
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: category.color,
                    }}
                  />
                  <Text variant="labelSmall" tone="muted">
                    {category.name}
                  </Text>
                </View>
              ))
            )}
          </View>
        </Pressable>
      </SwipeableRow>
    </View>
  );
}

export const BudgetCard = memo(BudgetCardComponent);
