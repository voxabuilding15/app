import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  EmptyState,
  FAB,
  IconButton,
  ListControls,
  ScreenToolbar,
  Snackbar,
  SortSheet,
} from '@/components';
import { spacing, useTheme } from '@/theme';

import type { HabitSummary } from '../../domain/progress';
import { HabitFilterSheet } from '../components/HabitFilterSheet';
import { HabitRow } from '../components/HabitRow';
import { TodayOverview } from '../components/TodayOverview';
import { SCOPES, SORT_FIELDS, sortLabel } from '../options';
import {
  useHabitListViewModel,
  type HabitListViewModel,
} from '../view-models/useHabitListViewModel';

const TWO_COLUMN_MIN_WIDTH = 900;
const LIST_MAX_WIDTH = 1100;
const FAB_CLEARANCE = 88;

function Separator() {
  return <View style={{ height: spacing.sm }} />;
}

function ListEmpty({ vm, onAdd }: { vm: HabitListViewModel; onAdd: () => void }) {
  const { colors } = useTheme();

  if (vm.isLoading) {
    return (
      <View style={{ paddingVertical: spacing.xxl }}>
        <ActivityIndicator
          size="large"
          color={colors.primary}
          accessibilityLabel="Loading habits"
        />
      </View>
    );
  }
  if (vm.isError) {
    return (
      <EmptyState
        icon="error-outline"
        title="Couldn't load habits"
        message="Your habits are safe on this device. Try loading the list again."
        actionLabel="Try again"
        onAction={() => void vm.refetch()}
      />
    );
  }
  if (vm.isFiltering) {
    return (
      <EmptyState
        icon="search-off"
        title="No matching habits"
        message="Nothing matches your search and filters."
        actionLabel="Clear search and filters"
        onAction={vm.clearFilters}
      />
    );
  }
  if (vm.scope === 'archived') {
    return (
      <EmptyState
        icon="inventory-2"
        title="No archived habits"
        message="Archive habits you want to stop tracking without losing their history."
      />
    );
  }
  return (
    <EmptyState
      icon="local-fire-department"
      title="No habits yet"
      message="Build a routine: add a habit, set a goal and watch your streak grow."
      actionLabel="Add habit"
      onAction={onAdd}
    />
  );
}

export function HabitListScreen() {
  const vm = useHabitListViewModel();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);

  const columns = width >= TWO_COLUMN_MIN_WIDTH ? 2 : 1;
  const { adjust, toggleToday, skipToday, archive, restore, confirmDelete } = vm;

  const openNew = useCallback(() => router.push('/habits/new'), [router]);
  const openCategories = useCallback(() => router.push('/habits/categories'), [router]);
  const openHabit = useCallback(
    (summary: HabitSummary) =>
      router.push({ pathname: '/habits/[id]', params: { id: summary.habit.id } }),
    [router],
  );

  const renderItem = useCallback(
    ({ item }: { item: HabitSummary }) => (
      <View style={{ flex: 1, maxWidth: columns > 1 ? '50%' : undefined }}>
        <HabitRow
          summary={item}
          onPress={openHabit}
          onAdjust={(summary, delta) => void adjust(summary, delta)}
          onToggle={(summary) => void toggleToday(summary)}
          onSkip={(summary) => void skipToday(summary)}
          onArchive={(summary) => void archive(summary)}
          onRestore={(summary) => void restore(summary)}
          onDelete={confirmDelete}
        />
      </View>
    ),
    [columns, openHabit, adjust, toggleToday, skipToday, archive, restore, confirmDelete],
  );

  const { overview } = vm;

  return (
    <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: colors.background }}>
      <ScreenToolbar title="Habits">
        <IconButton
          icon={vm.searchOpen ? 'close' : 'search'}
          label={vm.searchOpen ? 'Close search' : 'Search habits'}
          onPress={vm.toggleSearch}
        />
        <IconButton icon="folder" label="Manage habit categories" onPress={openCategories} />
      </ScreenToolbar>
      <ListControls
        scopes={SCOPES}
        scope={vm.scope}
        onScope={vm.setScope}
        searchOpen={vm.searchOpen}
        searchText={vm.searchText}
        onSearchText={vm.setSearchText}
        searchLabel="Search habits"
        searchPlaceholder="Name or notes"
        activeFilterCount={vm.activeFilterCount}
        isFiltering={vm.isFiltering}
        onOpenFilter={() => setFilterOpen(true)}
        sortLabel={sortLabel(vm.sort.field)}
        sortAscending={vm.sort.direction === 'asc'}
        onOpenSort={() => setSortOpen(true)}
        onClear={vm.clearFilters}
      />

      <FlatList
        key={columns}
        data={vm.habits as HabitSummary[]}
        keyExtractor={(summary) => summary.habit.id}
        renderItem={renderItem}
        numColumns={columns}
        columnWrapperStyle={columns > 1 ? { gap: spacing.sm } : undefined}
        ItemSeparatorComponent={Separator}
        ListHeaderComponent={
          overview && !vm.isFiltering ? (
            <View style={{ marginBottom: spacing.md }}>
              <TodayOverview due={overview.due} done={overview.done} />
            </View>
          ) : null
        }
        ListEmptyComponent={<ListEmpty vm={vm} onAdd={openNew} />}
        contentContainerStyle={{
          width: '100%',
          maxWidth: LIST_MAX_WIDTH,
          alignSelf: 'center',
          padding: spacing.lg,
          paddingBottom: FAB_CLEARANCE + spacing.lg,
        }}
        refreshing={vm.isRefreshing}
        onRefresh={() => void vm.refetch()}
        initialNumToRender={10}
        maxToRenderPerBatch={8}
        windowSize={7}
        removeClippedSubviews
        keyboardShouldPersistTaps="handled"
      />

      <FAB icon="add" label="Add habit" onPress={openNew} />
      {vm.notice ? (
        <Snackbar message={vm.notice} onDismiss={vm.dismissNotice} bottomOffset={FAB_CLEARANCE} />
      ) : null}

      <HabitFilterSheet
        visible={filterOpen}
        selection={vm.selection}
        categories={vm.categories}
        onChange={vm.setSelection}
        onReset={vm.clearFilters}
        onClose={() => setFilterOpen(false)}
      />
      <SortSheet
        visible={sortOpen}
        title="Sort habits"
        fields={SORT_FIELDS}
        sort={vm.sort}
        onChange={vm.setSort}
        onClose={() => setSortOpen(false)}
      />
    </View>
  );
}
