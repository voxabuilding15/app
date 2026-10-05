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
import { useNow } from '@/hooks';
import { spacing, useTheme } from '@/theme';

import type { Task } from '../../domain/entities';
import type { TaskScope } from '../../domain/filters';
import { FilterSheet } from '../components/FilterSheet';
import { ProgressSummary } from '../components/ProgressSummary';
import { SelectionBar } from '../components/SelectionBar';
import { TaskRow } from '../components/TaskRow';
import { SORT_FIELDS, sortLabel } from '../options';
import { useTaxonomy } from '../queries';
import { useTaskListViewModel, type TaskListViewModel } from '../view-models/useTaskListViewModel';

const SCOPES = [
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Done' },
  { value: 'archived', label: 'Archived' },
] as const satisfies readonly { value: TaskScope; label: string }[];

const TWO_COLUMN_MIN_WIDTH = 900;
const LIST_MAX_WIDTH = 1100;
const FAB_CLEARANCE = 88;

function Separator() {
  return <View style={{ height: spacing.sm }} />;
}

function ListEmpty({ vm, onAdd }: { vm: TaskListViewModel; onAdd: () => void }) {
  const { colors } = useTheme();

  if (vm.isLoading) {
    return (
      <View style={{ paddingVertical: spacing.xxl }}>
        <ActivityIndicator size="large" color={colors.primary} accessibilityLabel="Loading tasks" />
      </View>
    );
  }
  if (vm.isError) {
    return (
      <EmptyState
        icon="error-outline"
        title="Couldn't load tasks"
        message="Your tasks are safe on this device. Try loading the list again."
        actionLabel="Try again"
        onAction={() => void vm.refetch()}
      />
    );
  }
  if (vm.isFiltering) {
    return (
      <EmptyState
        icon="search-off"
        title="No matching tasks"
        message="Nothing matches your search and filters."
        actionLabel="Clear search and filters"
        onAction={vm.clearFilters}
      />
    );
  }
  switch (vm.filter.scope) {
    case 'completed':
      return (
        <EmptyState
          icon="task-alt"
          title="Nothing completed yet"
          message="Tasks you finish will be listed here."
        />
      );
    case 'archived':
      return (
        <EmptyState
          icon="inventory-2"
          title="No archived tasks"
          message="Archive tasks you want out of the way but don't want to delete."
        />
      );
    default:
      return (
        <EmptyState
          icon="check-circle"
          title="No tasks yet"
          message="Add your first task with a due date, reminder or subtasks."
          actionLabel="Add task"
          onAction={onAdd}
        />
      );
  }
}

export function TaskListScreen() {
  const vm = useTaskListViewModel();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const taxonomy = useTaxonomy();
  const now = useNow();
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);

  const columns = width >= TWO_COLUMN_MIN_WIDTH ? 2 : 1;
  const {
    selecting,
    selection,
    toggleSelected,
    startSelecting,
    toggleComplete,
    archive,
    restore,
    remove,
  } = vm;

  const openNew = useCallback(() => router.push('/tasks/new'), [router]);
  const openManage = useCallback(() => router.push('/tasks/manage'), [router]);

  const handlePress = useCallback(
    (task: Task) => {
      if (selecting) {
        toggleSelected(task.id);
      } else {
        router.push({ pathname: '/tasks/[id]', params: { id: task.id } });
      }
    },
    [selecting, toggleSelected, router],
  );
  const handleLongPress = useCallback(
    (task: Task) => (selecting ? toggleSelected(task.id) : startSelecting(task.id)),
    [selecting, toggleSelected, startSelecting],
  );
  const handleArchive = useCallback((task: Task) => void archive([task.id]), [archive]);
  const handleRestore = useCallback((task: Task) => void restore([task.id]), [restore]);
  const handleDelete = useCallback((task: Task) => void remove([task.id]), [remove]);
  const handleToggle = useCallback((task: Task) => void toggleComplete(task), [toggleComplete]);

  const renderItem = useCallback(
    ({ item }: { item: Task }) => (
      <View style={{ flex: 1, maxWidth: columns > 1 ? '50%' : undefined }}>
        <TaskRow
          task={item}
          now={now}
          selected={selection.has(item.id)}
          selecting={selecting}
          onPress={handlePress}
          onLongPress={handleLongPress}
          onToggleComplete={handleToggle}
          onArchive={handleArchive}
          onRestore={handleRestore}
          onDelete={handleDelete}
        />
      </View>
    ),
    [
      columns,
      now,
      selection,
      selecting,
      handlePress,
      handleLongPress,
      handleToggle,
      handleArchive,
      handleRestore,
      handleDelete,
    ],
  );

  const showProgress = vm.filter.scope === 'active' && !vm.isFiltering && vm.stats !== undefined;

  return (
    <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: colors.background }}>
      {selecting ? (
        <SelectionBar
          count={selection.size}
          scope={vm.filter.scope}
          onClose={vm.clearSelection}
          onSelectAll={vm.selectAll}
          onArchive={() => void vm.archiveSelected()}
          onRestore={() => void vm.restoreSelected()}
          onDelete={() => void vm.removeSelected()}
        />
      ) : (
        <ScreenToolbar title="Tasks">
          <IconButton
            icon={vm.searchOpen ? 'close' : 'search'}
            label={vm.searchOpen ? 'Close search' : 'Search tasks'}
            onPress={vm.toggleSearch}
          />
          <IconButton icon="checklist" label="Select tasks" onPress={() => startSelecting()} />
          <IconButton icon="label" label="Manage categories and labels" onPress={openManage} />
        </ScreenToolbar>
      )}
      <ListControls
        scopes={SCOPES}
        scope={vm.filter.scope}
        onScope={vm.setScope}
        searchOpen={vm.searchOpen}
        searchText={vm.searchText}
        onSearchText={vm.setSearchText}
        searchLabel="Search tasks"
        searchPlaceholder="Title, notes or subtasks"
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
        data={vm.tasks as Task[]}
        keyExtractor={(task) => task.id}
        renderItem={renderItem}
        numColumns={columns}
        columnWrapperStyle={columns > 1 ? { gap: spacing.sm } : undefined}
        ItemSeparatorComponent={Separator}
        extraData={selection}
        ListHeaderComponent={
          showProgress && vm.stats ? (
            <View style={{ marginBottom: spacing.md }}>
              <ProgressSummary
                stats={vm.stats}
                onShowOverdue={() => vm.updateFilter({ due: 'overdue' })}
              />
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
        onEndReached={vm.loadMore}
        onEndReachedThreshold={0.6}
        initialNumToRender={12}
        maxToRenderPerBatch={10}
        windowSize={7}
        removeClippedSubviews
        keyboardShouldPersistTaps="handled"
      />

      {selecting ? null : <FAB icon="add" label="Add task" onPress={openNew} />}
      {vm.notice ? (
        <Snackbar
          message={vm.notice.message}
          actionLabel={vm.notice.actionLabel}
          onAction={vm.notice.onAction}
          onDismiss={vm.dismissNotice}
          bottomOffset={selecting ? spacing.lg : FAB_CLEARANCE}
        />
      ) : null}

      <FilterSheet
        visible={filterOpen}
        filter={vm.filter}
        categories={taxonomy.data?.categories ?? []}
        labels={taxonomy.data?.labels ?? []}
        onChange={vm.updateFilter}
        onReset={vm.clearFilters}
        onClose={() => setFilterOpen(false)}
      />
      <SortSheet
        visible={sortOpen}
        title="Sort tasks"
        fields={SORT_FIELDS[vm.filter.scope].map((value) => ({ value, label: sortLabel(value) }))}
        sort={vm.sort}
        onChange={vm.changeSort}
        onClose={() => setSortOpen(false)}
      />
    </View>
  );
}
