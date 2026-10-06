import { View } from 'react-native';

import { Button, Chip, ChipGroup, Sheet } from '@/components';
import { NO_CATEGORY, type Category } from '@/core';
import { spacing } from '@/theme';
import { useTranslator } from '@/i18n';

import type { CalendarFilter, ItemKind } from '../../domain/filters';
import { msg } from '@/i18n/msg';

const KIND_OPTIONS: readonly { kind: ItemKind; label: string }[] = [
  { kind: 'event', label: msg('Events') },
  { kind: 'task', label: msg('Tasks') },
  { kind: 'habit', label: msg('Habits') },
];

interface CalendarFilterSheetProps {
  visible: boolean;
  filter: CalendarFilter;
  categories: readonly Category[];
  onToggleKind: (kind: ItemKind) => void;
  onCategory: (categoryId: string | null) => void;
  onReset: () => void;
  onClose: () => void;
}

export function CalendarFilterSheet({
  visible,
  filter,
  categories,
  onToggleKind,
  onCategory,
  onReset,
  onClose,
}: CalendarFilterSheetProps) {
  const { t } = useTranslator();
  return (
    <Sheet visible={visible} title={t('Filter calendar')} onClose={onClose}>
      <ChipGroup title={t('Show')}>
        {KIND_OPTIONS.map((option) => (
          <Chip
            key={option.kind}
            label={t(option.label)}
            selected={filter.kinds[option.kind]}
            onPress={() => onToggleKind(option.kind)}
          />
        ))}
      </ChipGroup>
      <ChipGroup title={t('Event category')}>
        <Chip
          label={t('All')}
          selected={filter.categoryId === null}
          onPress={() => onCategory(null)}
        />
        <Chip
          label={t('No category')}
          selected={filter.categoryId === NO_CATEGORY}
          onPress={() => onCategory(NO_CATEGORY)}
        />
        {categories.map((category) => (
          <Chip
            key={category.id}
            label={category.name}
            dotColor={category.color}
            selected={filter.categoryId === category.id}
            onPress={() => onCategory(category.id)}
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
