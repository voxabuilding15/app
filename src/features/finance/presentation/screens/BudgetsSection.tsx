import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { View } from 'react-native';

import { Card, EmptyState, Icon, Text, ResponsiveList } from '@/components';
import { spacing, useTheme } from '@/theme';
import { useTranslator } from '@/i18n';

import type { BudgetProgress } from '../../domain/entities';
import { BudgetCard } from '../components/BudgetCard';
import { useCurrency } from '../queries';
import { useBudgetsViewModel } from '../view-models/useBudgetsViewModel';

/** Weekly, monthly and custom budgets with how much of each is spent. */
export function BudgetsSection() {
  const { t } = useTranslator();
  const router = useRouter();
  const { colors } = useTheme();
  const currency = useCurrency();
  const vm = useBudgetsViewModel();
  const { remove } = vm;

  const openNew = useCallback(() => router.push('/finance/budget/new'), [router]);
  const handlePress = useCallback(
    (item: BudgetProgress) =>
      router.push({ pathname: '/finance/budget/[id]', params: { id: item.budget.id } }),
    [router],
  );
  const handleDelete = useCallback((item: BudgetProgress) => void remove(item.budget.id), [remove]);

  return (
    <ResponsiveList
      data={vm.budgets}
      keyExtractor={(item) => item.budget.id}
      renderItem={(item) => (
        <BudgetCard
          progress={item}
          currency={currency}
          onPress={handlePress}
          onDelete={handleDelete}
        />
      )}
      extraData={currency}
      loadingLabel={t('Loading budgets')}
      errorTitle={t("Couldn't load budgets")}
      isLoading={vm.isLoading}
      isError={vm.isError}
      onRetry={() => void vm.refetch()}
      empty={
        <EmptyState
          icon="savings"
          title={t('No budgets yet')}
          message={t('Set a weekly, monthly or custom limit and see how much you have left.')}
          actionLabel={t('Add budget')}
          onAction={openNew}
        />
      }
      header={
        vm.overCount > 0 ? (
          <Card
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
              backgroundColor: colors.errorContainer,
            }}
          >
            <View
              accessible
              accessibilityRole="alert"
              style={{ flexDirection: 'row', gap: spacing.md, flex: 1 }}
            >
              <Icon name="warning" color={colors.onErrorContainer} />
              <Text style={{ flex: 1, color: colors.onErrorContainer }}>
                {vm.overCount === 1
                  ? t('1 budget is over its limit')
                  : t('{overCount} budgets are over their limit', { overCount: vm.overCount })}
              </Text>
            </View>
          </Card>
        ) : null
      }
      isRefreshing={vm.isRefreshing}
      onRefresh={() => void vm.refetch()}
      fab={{ label: t('Add budget'), onPress: openNew }}
      notice={vm.notice}
      onDismissNotice={vm.dismissNotice}
    />
  );
}
