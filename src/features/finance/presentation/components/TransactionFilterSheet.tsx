import { View } from 'react-native';

import { Button, Chip, ChipGroup, Sheet } from '@/components';
import type { Category } from '@/core';
import { spacing } from '@/theme';

import type { AccountBalance, TransactionType } from '../../domain/entities';
import { NO_CATEGORY, type TransactionFilter } from '../../domain/filters';
import { RANGE_OPTIONS, TYPE_OPTIONS } from '../options';

interface TransactionFilterSheetProps {
  visible: boolean;
  filter: TransactionFilter;
  accounts: readonly AccountBalance[];
  categories: readonly Category[];
  onChange: (changes: Partial<Omit<TransactionFilter, 'search'>>) => void;
  onReset: () => void;
  onClose: () => void;
}

function toggle<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

export function TransactionFilterSheet({
  visible,
  filter,
  accounts,
  categories,
  onChange,
  onReset,
  onClose,
}: TransactionFilterSheetProps) {
  return (
    <Sheet visible={visible} title="Filter transactions" onClose={onClose}>
      <ChipGroup title="Type">
        {TYPE_OPTIONS.map((option) => (
          <Chip
            key={option.value}
            label={option.label}
            selected={filter.types.includes(option.value)}
            onPress={() => onChange({ types: toggle<TransactionType>(filter.types, option.value) })}
          />
        ))}
      </ChipGroup>
      <ChipGroup title="Date">
        {RANGE_OPTIONS.map((option) => (
          <Chip
            key={option.value}
            label={option.label}
            selected={filter.range === option.value}
            onPress={() => onChange({ range: option.value })}
          />
        ))}
      </ChipGroup>
      <ChipGroup title="Account">
        <Chip
          label="Any"
          selected={filter.accountId === null}
          onPress={() => onChange({ accountId: null })}
        />
        {accounts.map((account) => (
          <Chip
            key={account.id}
            label={account.name}
            dotColor={account.color}
            selected={filter.accountId === account.id}
            onPress={() => onChange({ accountId: account.id })}
          />
        ))}
      </ChipGroup>
      <ChipGroup title="Category">
        <Chip
          label="Any"
          selected={filter.categoryId === null}
          onPress={() => onChange({ categoryId: null })}
        />
        <Chip
          label="No category"
          selected={filter.categoryId === NO_CATEGORY}
          onPress={() => onChange({ categoryId: NO_CATEGORY })}
        />
        {categories.map((category) => (
          <Chip
            key={category.id}
            label={category.name}
            dotColor={category.color}
            selected={filter.categoryId === category.id}
            onPress={() => onChange({ categoryId: category.id })}
          />
        ))}
      </ChipGroup>
      <View style={{ flexDirection: 'row', gap: spacing.md, justifyContent: 'flex-end' }}>
        <Button label="Reset" variant="outlined" onPress={onReset} />
        <Button label="Done" onPress={onClose} />
      </View>
    </Sheet>
  );
}
