import { View } from 'react-native';

import { Button, Chip, Sheet, Text } from '@/components';
import { spacing } from '@/theme';

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

const WRAP = { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm } as const;

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: spacing.sm }}>
      <Text variant="labelLarge" tone="muted" accessibilityRole="header">
        {title}
      </Text>
      <View style={WRAP}>{children}</View>
    </View>
  );
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
  return (
    <Sheet visible={visible} title="Filter tasks" onClose={onClose}>
      <Group title="Priority">
        {PRIORITY_OPTIONS.map((option) => (
          <Chip
            key={option.value}
            label={option.label}
            selected={filter.priorities.includes(option.value)}
            onPress={() =>
              onChange({ priorities: toggle<Priority>(filter.priorities, option.value) })
            }
          />
        ))}
      </Group>
      <Group title="Due">
        {DUE_OPTIONS.map((option) => (
          <Chip
            key={option.value}
            label={option.label}
            selected={filter.due === option.value}
            onPress={() => onChange({ due: option.value })}
          />
        ))}
      </Group>
      <Group title="Category">
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
      </Group>
      {labels.length > 0 ? (
        <Group title="Labels (any of)">
          {labels.map((label) => (
            <Chip
              key={label.id}
              label={label.name}
              dotColor={label.color}
              selected={filter.labelIds.includes(label.id)}
              onPress={() => onChange({ labelIds: toggle(filter.labelIds, label.id) })}
            />
          ))}
        </Group>
      ) : null}
      <View style={{ flexDirection: 'row', gap: spacing.md, justifyContent: 'flex-end' }}>
        <Button label="Reset" variant="outlined" onPress={onReset} />
        <Button label="Done" onPress={onClose} />
      </View>
    </Sheet>
  );
}
