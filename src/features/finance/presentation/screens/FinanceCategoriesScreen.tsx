import { Stack } from 'expo-router';
import { View } from 'react-native';

import { CategoryManager, SegmentedControl } from '@/components';
import { spacing } from '@/theme';
import { useTranslator } from '@/i18n';

import { useFinanceCategoriesViewModel } from '../view-models/useFinanceCategoriesViewModel';
import { msg } from '@/i18n/msg';

const TABS = [
  { value: 'expense', label: msg('Expense') },
  { value: 'income', label: msg('Income') },
] as const;

export function FinanceCategoriesScreen() {
  const { t } = useTranslator();
  const { tab, setTab, refetch, ...vm } = useFinanceCategoriesViewModel();

  return (
    <>
      <Stack.Screen options={{ title: t('Categories') }} />
      <View style={{ flex: 1 }}>
        <View style={{ padding: spacing.lg, paddingBottom: 0 }}>
          <SegmentedControl options={TABS} value={tab} onChange={setTab} />
        </View>
        <CategoryManager
          {...vm}
          onRetry={() => void refetch()}
          emptyMessage={
            tab === 'expense'
              ? t('Categories like Groceries or Rent show where your money goes.')
              : t('Categories like Salary or Gifts show where your money comes from.')
          }
        />
      </View>
    </>
  );
}
