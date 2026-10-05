import { Stack } from 'expo-router';
import { View } from 'react-native';

import { CategoryManager, SegmentedControl } from '@/components';
import { spacing } from '@/theme';

import { useFinanceCategoriesViewModel } from '../view-models/useFinanceCategoriesViewModel';

const TABS = [
  { value: 'expense', label: 'Expense' },
  { value: 'income', label: 'Income' },
] as const;

export function FinanceCategoriesScreen() {
  const { tab, setTab, refetch, ...vm } = useFinanceCategoriesViewModel();

  return (
    <>
      <Stack.Screen options={{ title: 'Categories' }} />
      <View style={{ flex: 1 }}>
        <View style={{ padding: spacing.lg, paddingBottom: 0 }}>
          <SegmentedControl options={TABS} value={tab} onChange={setTab} />
        </View>
        <CategoryManager
          {...vm}
          onRetry={() => void refetch()}
          emptyMessage={
            tab === 'expense'
              ? 'Categories like Groceries or Rent show where your money goes.'
              : 'Categories like Salary or Gifts show where your money comes from.'
          }
        />
      </View>
    </>
  );
}
