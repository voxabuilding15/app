import { View } from 'react-native';

import { Button, Chip, ChipGroup, Sheet } from '@/components';
import { NO_CATEGORY, type Category } from '@/core';
import { spacing } from '@/theme';
import { useTranslator } from '@/i18n';

import type { HabitFilter } from '../../domain/filters';
import { PERIOD_OPTIONS, STATUS_OPTIONS } from '../options';

interface HabitFilterSheetProps {
  visible: boolean;
  selection: Omit<HabitFilter, 'search'>;
  categories: readonly Category[];
  onChange: (changes: Partial<Omit<HabitFilter, 'search'>>) => void;
  onReset: () => void;
  onClose: () => void;
}

export function HabitFilterSheet({
  visible,
  selection,
  categories,
  onChange,
  onReset,
  onClose,
}: HabitFilterSheetProps) {
  const { t } = useTranslator();
  return (
    <Sheet visible={visible} title={t('Filter habits')} onClose={onClose}>
      <ChipGroup title={t('Frequency')}>
        <Chip
          label={t('Any')}
          selected={selection.period === null}
          onPress={() => onChange({ period: null })}
        />
        {PERIOD_OPTIONS.map((option) => (
          <Chip
            key={option.value}
            label={t(option.label)}
            selected={selection.period === option.value}
            onPress={() => onChange({ period: option.value })}
          />
        ))}
      </ChipGroup>
      <ChipGroup title={t('Status')}>
        {STATUS_OPTIONS.map((option) => (
          <Chip
            key={option.value}
            label={t(option.label)}
            selected={selection.status === option.value}
            onPress={() => onChange({ status: option.value })}
          />
        ))}
      </ChipGroup>
      <ChipGroup title={t('Category')}>
        <Chip
          label={t('Any')}
          selected={selection.categoryId === null}
          onPress={() => onChange({ categoryId: null })}
        />
        <Chip
          label={t('No category')}
          selected={selection.categoryId === NO_CATEGORY}
          onPress={() => onChange({ categoryId: NO_CATEGORY })}
        />
        {categories.map((category) => (
          <Chip
            key={category.id}
            label={category.name}
            dotColor={category.color}
            selected={selection.categoryId === category.id}
            onPress={() => onChange({ categoryId: category.id })}
          />
        ))}
      </ChipGroup>
      <View style={{ flexDirection: 'row', gap: spacing.md, justifyContent: 'flex-end' }}>
        <Button label={t('Reset')} variant="outlined" onPress={onReset} />
        <Button label={t('Done')} onPress={onClose} />
      </View>
    </Sheet>
  );
}
