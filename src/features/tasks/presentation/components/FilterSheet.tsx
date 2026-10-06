import { View } from 'react-native';

import { Button, Chip, ChipGroup, Sheet } from '@/components';
import { spacing } from '@/theme';
import { useTranslator } from '@/i18n';

import type { Category, Label, Priority } from '../../domain/entities';
import { NO_CATEGORY, type TaskFilter } from '../../domain/filters';
import { DUE_OPTIONS, PRIORITY_OPTIONS } from '../options';

interface FilterSheetProps {
  visible: boolean;
  filter: TaskFilter;
  categories: readonly Category[];
  labels: readonly Label[];
  onChange: (changes: Partial<Omit<TaskFilter, 'scope' | 'search'>>) => void;
  onReset: () => void;
  onClose: () => void;
}

function toggle<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

export function FilterSheet({
  visible,
  filter,
  categories,
  labels,
  onChange,
  onReset,
  onClose,
}: FilterSheetProps) {
  const { t } = useTranslator();
  return (
    <Sheet visible={visible} title={t('Filter tasks')} onClose={onClose}>
      <ChipGroup title={t('Priority')}>
        {PRIORITY_OPTIONS.map((option) => (
          <Chip
            key={option.value}
            label={t(option.label)}
            selected={filter.priorities.includes(option.value)}
            onPress={() =>
              onChange({ priorities: toggle<Priority>(filter.priorities, option.value) })
            }
          />
        ))}
      </ChipGroup>
      <ChipGroup title={t('Due')}>
        {DUE_OPTIONS.map((option) => (
          <Chip
            key={option.value}
            label={t(option.label)}
            selected={filter.due === option.value}
            onPress={() => onChange({ due: option.value })}
          />
        ))}
      </ChipGroup>
      <ChipGroup title={t('Category')}>
        <Chip
          label={t('Any')}
          selected={filter.categoryId === null}
          onPress={() => onChange({ categoryId: null })}
        />
        <Chip
          label={t('No category')}
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
      {labels.length > 0 ? (
        <ChipGroup title={t('Labels (any of)')}>
          {labels.map((label) => (
            <Chip
              key={label.id}
              label={label.name}
              dotColor={label.color}
              selected={filter.labelIds.includes(label.id)}
              onPress={() => onChange({ labelIds: toggle(filter.labelIds, label.id) })}
            />
          ))}
        </ChipGroup>
      ) : null}
      <View style={{ flexDirection: 'row', gap: spacing.md, justifyContent: 'flex-end' }}>
        <Button label={t('Reset')} variant="outlined" onPress={onReset} />
        <Button label={t('Done')} onPress={onClose} />
      </View>
    </Sheet>
  );
}
