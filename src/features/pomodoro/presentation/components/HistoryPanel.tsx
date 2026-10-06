import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { Button, EmptyState, Input, SegmentedControl, Text } from '@/components';
import { spacing } from '@/theme';

import type { HistoryScope } from '../../domain/entities';
import type { HistoryViewModel } from '../view-models/useHistoryViewModel';

import { SessionRow } from './SessionRow';

const SCOPES: readonly { value: HistoryScope; label: string }[] = [
  { value: 'focus', label: 'Focus' },
  { value: 'breaks', label: 'Breaks' },
  { value: 'all', label: 'All' },
];

/** Past sessions, newest first, with search and undoable delete. */
export function HistoryPanel({ vm }: { vm: HistoryViewModel }) {
  const router = useRouter();

  return (
    <View style={{ gap: spacing.md }}>
      <SegmentedControl options={SCOPES} value={vm.scope} onChange={vm.setScope} />
      <Input
        label="Search history"
        value={vm.search}
        onChangeText={vm.setSearch}
        placeholder="Search notes, tasks, habits and tags"
        returnKeyType="search"
        autoCorrect={false}
      />
      {vm.isError ? (
        <View style={{ gap: spacing.md, alignItems: 'center' }}>
          <Text tone="error">Couldn&apos;t load your history.</Text>
          <Button label="Try again" variant="tonal" onPress={() => void vm.refetch()} />
        </View>
      ) : vm.sessions.length === 0 && !vm.isLoading ? (
        <EmptyState
          icon={vm.isSearching ? 'search-off' : 'history'}
          title={vm.isSearching ? 'No matching sessions' : 'No sessions yet'}
          message={
            vm.isSearching
              ? 'Nothing matches your search.'
              : 'Finished focus sessions and breaks are listed here.'
          }
        />
      ) : (
        vm.sessions.map((session) => (
          <SessionRow
            key={session.id}
            session={session}
            onOpen={(item) =>
              router.push({ pathname: '/pomodoro/session/[id]', params: { id: item.id } })
            }
            onDelete={(item) => void vm.deleteSession(item.id)}
          />
        ))
      )}
    </View>
  );
}
