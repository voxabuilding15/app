import { ScrollView, View } from 'react-native';

import { Chip, Input, SegmentedControl } from '@/components';
import { spacing } from '@/theme';

import type { TaskFilter, TaskScope, TaskSort } from '../../domain/filters';
import { sortLabel } from '../options';

const SCOPE_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Done' },
  { value: 'archived', label: 'Archived' },
] as const satisfies readonly { value: TaskScope; label: string }[];

interface ListControlsProps {
  filter: TaskFilter;
  sort: TaskSort;
  searchOpen: boolean;
  searchText: string;
  activeFilterCount: number;
  isFiltering: boolean;
  onScope: (scope: TaskScope) => void;
  onSearchText: (text: string) => void;
  onOpenFilter: () => void;
  onOpenSort: () => void;
  onClear: () => void;
}

export function ListControls({
  filter,
  sort,
  searchOpen,
  searchText,
  activeFilterCount,
  isFiltering,
  onScope,
  onSearchText,
  onOpenFilter,
  onOpenSort,
  onClear,
}: ListControlsProps) {
  return (
    <View style={{ gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}>
      <SegmentedControl options={SCOPE_OPTIONS} value={filter.scope} onChange={onScope} />
      {searchOpen ? (
        <Input
          label="Search tasks"
          value={searchText}
          onChangeText={onSearchText}
          placeholder="Title, notes or subtasks"
          autoFocus
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
        />
      ) : null}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.xs }}
        keyboardShouldPersistTaps="handled"
      >
        <Chip
          icon="filter-list"
          label={activeFilterCount > 0 ? `Filter (${activeFilterCount})` : 'Filter'}
          selected={activeFilterCount > 0}
          onPress={onOpenFilter}
        />
        <Chip
          icon={sort.direction === 'asc' ? 'arrow-upward' : 'arrow-downward'}
          label={sortLabel(sort.field)}
          accessibilityLabel={`Sort by ${sortLabel(sort.field)}, ${sort.direction === 'asc' ? 'ascending' : 'descending'}`}
          onPress={onOpenSort}
        />
        {isFiltering ? <Chip icon="clear" label="Clear" onPress={onClear} /> : null}
      </ScrollView>
    </View>
  );
}
