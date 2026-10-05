import { ScrollView, View } from 'react-native';

import { spacing } from '@/theme';

import { Chip } from './Chip';
import { Input } from './Input';
import { SegmentedControl } from './SegmentedControl';

interface ScopeOption<S extends string> {
  value: S;
  label: string;
}

interface ListControlsProps<S extends string> {
  scopes: readonly ScopeOption<S>[];
  scope: S;
  onScope: (scope: S) => void;
  searchOpen: boolean;
  searchText: string;
  onSearchText: (text: string) => void;
  searchLabel: string;
  searchPlaceholder: string;
  activeFilterCount: number;
  isFiltering: boolean;
  onOpenFilter: () => void;
  /** Sorting chip; omit all three when the list has no sort order. */
  sortLabel?: string;
  sortAscending?: boolean;
  onOpenSort?: () => void;
  onClear: () => void;
}

/** Scope tabs, optional search box and a chip row for filter, sort and clear. */
export function ListControls<S extends string>({
  scopes,
  scope,
  onScope,
  searchOpen,
  searchText,
  onSearchText,
  searchLabel,
  searchPlaceholder,
  activeFilterCount,
  isFiltering,
  onOpenFilter,
  sortLabel,
  sortAscending = true,
  onOpenSort,
  onClear,
}: ListControlsProps<S>) {
  return (
    <View style={{ gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}>
      <SegmentedControl options={scopes} value={scope} onChange={onScope} />
      {searchOpen ? (
        <Input
          label={searchLabel}
          value={searchText}
          onChangeText={onSearchText}
          placeholder={searchPlaceholder}
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
        {sortLabel !== undefined && onOpenSort !== undefined ? (
          <Chip
            icon={sortAscending ? 'arrow-upward' : 'arrow-downward'}
            label={sortLabel}
            accessibilityLabel={`Sort by ${sortLabel}, ${sortAscending ? 'ascending' : 'descending'}`}
            onPress={onOpenSort}
          />
        ) : null}
        {isFiltering ? <Chip icon="clear" label="Clear" onPress={onClear} /> : null}
      </ScrollView>
    </View>
  );
}
