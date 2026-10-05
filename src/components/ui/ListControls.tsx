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
  /** Scope tabs; omit all three for lists with a single scope. */
  scopes?: readonly ScopeOption<S>[];
  scope?: S;
  onScope?: (scope: S) => void;
  searchOpen: boolean;
  /** Adds a chip that opens and closes the search box, for screens without a toolbar button. */
  onToggleSearch?: () => void;
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
  onToggleSearch,
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
      {scopes !== undefined && scope !== undefined && onScope !== undefined ? (
        <SegmentedControl options={scopes} value={scope} onChange={onScope} />
      ) : null}
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
        {onToggleSearch !== undefined ? (
          <Chip
            icon={searchOpen ? 'close' : 'search'}
            label={searchOpen ? 'Close search' : 'Search'}
            selected={searchOpen}
            onPress={onToggleSearch}
          />
        ) : null}
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
