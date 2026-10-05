import { View } from 'react-native';

import { Button, Chip, SegmentedControl, Sheet, Text } from '@/components';
import { spacing } from '@/theme';

import type { SortDirection, TaskScope, TaskSort } from '../../domain/filters';
import { SORT_FIELDS, sortLabel } from '../options';

const DIRECTIONS = [
  { value: 'asc', label: 'Ascending' },
  { value: 'desc', label: 'Descending' },
] as const satisfies readonly { value: SortDirection; label: string }[];

interface SortSheetProps {
  visible: boolean;
  scope: TaskScope;
  sort: TaskSort;
  onChange: (sort: TaskSort) => void;
  onClose: () => void;
}

export function SortSheet({ visible, scope, sort, onChange, onClose }: SortSheetProps) {
  return (
    <Sheet visible={visible} title="Sort tasks" onClose={onClose}>
      <View style={{ gap: spacing.sm }}>
        <Text variant="labelLarge" tone="muted" accessibilityRole="header">
          Sort by
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {SORT_FIELDS[scope].map((field) => (
            <Chip
              key={field}
              label={sortLabel(field)}
              selected={sort.field === field}
              onPress={() => onChange({ ...sort, field })}
            />
          ))}
        </View>
      </View>
      <SegmentedControl
        options={DIRECTIONS}
        value={sort.direction}
        onChange={(direction) => onChange({ ...sort, direction })}
      />
      <Button label="Done" onPress={onClose} />
    </Sheet>
  );
}
