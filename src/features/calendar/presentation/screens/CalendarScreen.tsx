import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState, FAB, IconButton, ListControls, ScreenToolbar, Snackbar } from '@/components';
import type { DateKey } from '@/core';
import { useTheme } from '@/theme';

import type { CalendarItem } from '../../domain/items';
import { weekDays, type CalendarView } from '../../domain/views';
import { AgendaList } from '../components/AgendaList';
import { CalendarFilterSheet } from '../components/CalendarFilterSheet';
import { DayAgendaPanel } from '../components/DayAgendaPanel';
import { MonthGrid } from '../components/MonthGrid';
import { PeriodNavigator } from '../components/PeriodNavigator';
import { TimelineGrid } from '../components/TimelineGrid';
import { periodTitle } from '../format';
import { useInvalidateCalendar } from '../queries';
import { useCalendarViewModel } from '../view-models/useCalendarViewModel';

const VIEWS = [
  { value: 'month', label: 'Month' },
  { value: 'week', label: 'Week' },
  { value: 'day', label: 'Day' },
  { value: 'agenda', label: 'Agenda' },
] as const satisfies readonly { value: CalendarView; label: string }[];

/** Month grid switches to dots below this width, and gains a side panel above the next one. */
const COMPACT_MONTH_WIDTH = 600;
const SIDE_PANEL_MIN_WIDTH = 800;

export function CalendarScreen() {
  const vm = useCalendarViewModel();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const invalidate = useInvalidateCalendar();
  const { width: windowWidth } = useWindowDimensions();
  const [bodyWidth, setBodyWidth] = useState(windowWidth);
  const [filterOpen, setFilterOpen] = useState(false);

  // Tasks and habits change on other screens, so refresh whenever this one is shown.
  useFocusEffect(
    useCallback(() => {
      void invalidate();
    }, [invalidate]),
  );

  const openItem = useCallback(
    (item: CalendarItem) => {
      if (item.kind === 'event') {
        router.push({
          pathname: '/calendar/event/[id]',
          params: { id: item.eventId, occurrence: item.occurrenceDate },
        });
      } else if (item.kind === 'task') {
        router.push({ pathname: '/tasks/[id]', params: { id: item.taskId } });
      } else {
        router.push({ pathname: '/habits/[id]', params: { id: item.habitId } });
      }
    },
    [router],
  );

  const addEvent = useCallback(
    (day: DateKey) => router.push({ pathname: '/calendar/event/new', params: { day } }),
    [router],
  );

  const { view, anchor, today } = vm;
  const compactMonth = bodyWidth < COMPACT_MONTH_WIDTH;
  const sidePanel = bodyWidth >= SIDE_PANEL_MIN_WIDTH;

  const dayPanel = (
    <DayAgendaPanel
      day={anchor}
      today={today}
      items={vm.dayItems}
      onPressItem={openItem}
      onAdd={() => addEvent(anchor)}
    />
  );

  const renderBody = () => {
    if (vm.isSearching) {
      return (
        <AgendaList
          items={vm.searchResults}
          today={today}
          onPressItem={openItem}
          onPressDay={vm.openDay}
          emptyComponent={
            vm.isSearchLoading ? (
              <ActivityIndicator color={colors.primary} accessibilityLabel="Searching" />
            ) : (
              <EmptyState
                icon="search-off"
                title="No matches"
                message="Nothing in the next year (or the last month) matches your search and filters."
              />
            )
          }
        />
      );
    }
    if (vm.isLoading) {
      return (
        <ActivityIndicator
          style={{ marginTop: 48 }}
          color={colors.primary}
          accessibilityLabel="Loading calendar"
        />
      );
    }
    if (vm.isError) {
      return (
        <EmptyState
          icon="error-outline"
          title="Couldn't load the calendar"
          message="Your data is safe on this device. Try again."
          actionLabel="Try again"
          onAction={() => void vm.refetch()}
        />
      );
    }

    switch (view) {
      case 'month':
        return sidePanel ? (
          <View style={{ flex: 1, flexDirection: 'row' }}>
            <View style={{ flex: 3 }}>
              <MonthGrid
                anchor={anchor}
                today={today}
                items={vm.items}
                compact={false}
                onSelectDay={vm.selectDay}
              />
            </View>
            <ScrollView style={{ flex: 2 }}>{dayPanel}</ScrollView>
          </View>
        ) : (
          <ScrollView>
            <MonthGrid
              anchor={anchor}
              today={today}
              items={vm.items}
              compact={compactMonth}
              onSelectDay={vm.selectDay}
            />
            {dayPanel}
          </ScrollView>
        );
      case 'week':
      case 'day':
        return (
          <TimelineGrid
            days={view === 'week' ? weekDays(anchor) : [anchor]}
            items={vm.items}
            today={today}
            now={vm.now}
            width={bodyWidth}
            onPressItem={openItem}
            onPressDay={view === 'week' ? vm.openDay : undefined}
            onMoveEvent={vm.moveEvent}
          />
        );
      default:
        return (
          <AgendaList
            items={vm.items}
            today={today}
            onPressItem={openItem}
            onPressDay={vm.openDay}
            emptyComponent={
              <EmptyState
                icon="event-available"
                title="Nothing planned"
                message="Events, tasks with due dates and your habits will show up here."
                actionLabel="Add event"
                onAction={() => addEvent(anchor)}
              />
            }
          />
        );
    }
  };

  return (
    <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: colors.background }}>
      <ScreenToolbar title="Calendar">
        <IconButton
          icon={vm.searchOpen ? 'close' : 'search'}
          label={vm.searchOpen ? 'Close search' : 'Search the calendar'}
          onPress={vm.toggleSearch}
        />
        <IconButton
          icon="palette"
          label="Manage event categories"
          onPress={() => router.push('/calendar/categories')}
        />
      </ScreenToolbar>
      <ListControls
        scopes={VIEWS}
        scope={view}
        onScope={vm.setView}
        searchOpen={vm.searchOpen}
        searchText={vm.searchText}
        onSearchText={vm.setSearchText}
        searchLabel="Search the calendar"
        searchPlaceholder="Events, tasks and habits"
        activeFilterCount={vm.activeFilterCount}
        isFiltering={vm.isFiltering}
        onOpenFilter={() => setFilterOpen(true)}
        onClear={vm.resetFilters}
      />
      {vm.isSearching ? null : (
        <PeriodNavigator
          title={periodTitle(view, anchor)}
          view={view}
          onPrevious={vm.goPrevious}
          onNext={vm.goNext}
          onToday={vm.goToday}
        />
      )}

      <View
        testID="calendar-body"
        style={{ flex: 1 }}
        onLayout={(event: LayoutChangeEvent) => setBodyWidth(event.nativeEvent.layout.width)}
      >
        {renderBody()}
      </View>

      <FAB icon="add" label="Add event" onPress={() => addEvent(anchor)} />
      {vm.notice ? (
        <Snackbar message={vm.notice} onDismiss={vm.dismissNotice} bottomOffset={88} />
      ) : null}

      <CalendarFilterSheet
        visible={filterOpen}
        filter={vm.filter}
        categories={vm.categories}
        onToggleKind={vm.toggleKind}
        onCategory={vm.setCategoryId}
        onReset={vm.resetFilters}
        onClose={() => setFilterOpen(false)}
      />
    </View>
  );
}
