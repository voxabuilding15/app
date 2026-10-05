import { View } from 'react-native';

import { Button, Chip, ChipGroup, Sheet } from '@/components';
import { NO_CATEGORY, type Category } from '@/core';
import { spacing } from '@/theme';

import type { CalendarFilter, ItemKind } from '../../domain/filters';

const KIND_OPTIONS: readonly { kind: ItemKind; label: string }[] = [
  { kind: 'event', label: 'Events' },
  { kind: 'task', label: 'Tasks' },
  { kind: 'habit', label: 'Habits' },
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
  return (
    <Sheet visible={visible} title="Filter calendar" onClose={onClose}>
      <ChipGroup title="Show">
        {KIND_OPTIONS.map((option) => (
          <Chip
            key={option.kind}
            label={option.label}
            selected={filter.kinds[option.kind]}
            onPress={() => onToggleKind(option.kind)}
          />
        ))}
      </ChipGroup>
      <ChipGroup title="Event category">
        <Chip label="All" selected={filter.categoryId === null} onPress={() => onCategory(null)} />
        <Chip
          label="No category"
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
        <Button label="Reset" variant="outlined" onPress={onReset} />
        <Button label="Done" onPress={onClose} />
      </View>
    </Sheet>
  );
}
