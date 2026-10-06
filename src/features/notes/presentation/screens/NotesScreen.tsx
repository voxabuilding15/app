import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Button,
  EmptyState,
  IconButton,
  ListControls,
  ResponsiveList,
  ScreenToolbar,
  SortSheet,
  Text,
} from '@/components';
import { useNow } from '@/hooks';
import { spacing, useTheme } from '@/theme';
import { useTranslator } from '@/i18n';

import type { NoteSummary } from '../../domain/entities';
import { NO_FOLDER } from '../../domain/filters';
import { NoteCard } from '../components/NoteCard';
import { NoteFilterSheet } from '../components/NoteFilterSheet';
import { SCOPES, SORT_FIELDS, sortLabel } from '../options';
import { useNoteListViewModel, type NoteListViewModel } from '../view-models/useNoteListViewModel';

const TWO_COLUMNS_FROM = 600;
const THREE_COLUMNS_FROM = 1000;

function columnsFor(width: number): number {
  return width >= THREE_COLUMNS_FROM ? 3 : width >= TWO_COLUMNS_FROM ? 2 : 1;
}

function EmptyNotes({ vm, onAdd }: { vm: NoteListViewModel; onAdd: () => void }) {
  const { t } = useTranslator();
  if (vm.isFiltering) {
    return (
      <EmptyState
        icon="search-off"
        title={t('No matching notes')}
        message={t('Nothing matches your search and filters.')}
        actionLabel={t('Clear search and filters')}
        onAction={vm.clearFilters}
      />
    );
  }
  switch (vm.filter.scope) {
    case 'favorites':
      return (
        <EmptyState
          icon="star-border"
          title={t('No favorites yet')}
          message={t('Star a note to find it here quickly.')}
        />
      );
    case 'archived':
      return (
        <EmptyState
          icon="inventory-2"
          title={t('Nothing archived')}
          message={t("Archive notes you want out of the way but don't want to delete.")}
        />
      );
    case 'trash':
      return (
        <EmptyState
          icon="delete-outline"
          title={t('The trash is empty')}
          message={t('Deleted notes stay here for 30 days before they are removed for good.')}
        />
      );
    default:
      return (
        <EmptyState
          icon="sticky-note-2"
          title={t('No notes yet')}
          message={t(
            'Write a note, make a checklist, or attach an image, a PDF or a voice recording.',
          )}
          actionLabel={t('Add note')}
          onAction={onAdd}
        />
      );
  }
}

/** The notes list: scopes, search, filters, sorting, and quick actions on every note. */
export function NotesScreen() {
  const { t } = useTranslator();
  const vm = useNoteListViewModel();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const now = useNow();
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);

  const { scope } = vm.filter;
  const { togglePinned, toggleFavorite, trash, archive, unarchive, restore, deleteForever } = vm;

  const openNew = useCallback(() => {
    const folderId = vm.filter.folderId;
    router.push({
      pathname: '/notes/new',
      params: folderId === null || folderId === NO_FOLDER ? {} : { folderId },
    });
  }, [router, vm.filter.folderId]);
  const open = useCallback(
    (note: NoteSummary) => router.push({ pathname: '/notes/[id]', params: { id: note.id } }),
    [router],
  );

  const renderNote = useCallback(
    (note: NoteSummary) => (
      <NoteCard
        note={note}
        now={now}
        scope={scope}
        onPress={open}
        onPin={(item) => void togglePinned(item)}
        onFavorite={(item) => void toggleFavorite(item)}
        onArchive={(item) => void archive(item.id)}
        onUnarchive={(item) => void unarchive(item)}
        onTrash={(item) => void trash(item.id)}
        onRestore={(item) => void restore(item)}
        onDeleteForever={deleteForever}
      />
    ),
    [
      now,
      scope,
      open,
      togglePinned,
      toggleFavorite,
      archive,
      unarchive,
      trash,
      restore,
      deleteForever,
    ],
  );

  return (
    <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: colors.background }}>
      <ScreenToolbar title={t('Notes')}>
        <IconButton
          icon="folder"
          label={t('Manage folders')}
          onPress={() => router.push('/notes/folders')}
        />
        <IconButton
          icon="label"
          label={t('Manage tags')}
          onPress={() => router.push('/notes/tags')}
        />
        <IconButton
          icon="lock"
          label={t('Lock settings')}
          onPress={() => router.push('/notes/lock')}
        />
      </ScreenToolbar>
      <ListControls
        scopes={SCOPES}
        scope={scope}
        onScope={vm.setScope}
        searchOpen={vm.searchOpen}
        onToggleSearch={vm.toggleSearch}
        searchText={vm.searchText}
        onSearchText={vm.setSearchText}
        searchLabel={t('Search notes')}
        searchPlaceholder={t('Title, text or tag')}
        activeFilterCount={vm.activeFilterCount}
        isFiltering={vm.isFiltering}
        onOpenFilter={() => setFilterOpen(true)}
        sortLabel={sortLabel(vm.sort.field)}
        sortAscending={vm.sort.direction === 'asc'}
        onOpenSort={() => setSortOpen(true)}
        onClear={vm.clearFilters}
      />
      <ResponsiveList
        data={vm.notes}
        keyExtractor={(note) => note.id}
        renderItem={renderNote}
        extraData={scope}
        columnsFor={columnsFor}
        loadingLabel={t('Loading notes')}
        errorTitle={t("Couldn't load notes")}
        isLoading={vm.isLoading}
        isError={vm.isError}
        onRetry={() => void vm.refetch()}
        empty={<EmptyNotes vm={vm} onAdd={openNew} />}
        header={
          scope === 'trash' && vm.notes.length > 0 ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <Text variant="bodyMedium" tone="muted" style={{ flex: 1 }}>
                {t('Notes in the trash are deleted for good after 30 days.')}
              </Text>
              <Button label={t('Empty trash')} variant="outlined" onPress={vm.emptyTrash} />
            </View>
          ) : null
        }
        isRefreshing={vm.isRefreshing}
        onRefresh={() => void vm.refetch()}
        onEndReached={vm.loadMore}
        fab={scope === 'trash' ? undefined : { label: t('Add note'), onPress: openNew }}
        notice={vm.notice}
        onDismissNotice={vm.dismissNotice}
      />

      <NoteFilterSheet
        visible={filterOpen}
        filter={vm.filter}
        folders={vm.folders}
        tags={vm.tags}
        onChange={vm.updateFilter}
        onReset={vm.clearFilters}
        onClose={() => setFilterOpen(false)}
      />
      <SortSheet
        visible={sortOpen}
        title={t('Sort notes')}
        fields={SORT_FIELDS.map((value) => ({ value, label: sortLabel(value) }))}
        sort={vm.sort}
        onChange={vm.changeSort}
        onClose={() => setSortOpen(false)}
      />
    </View>
  );
}
