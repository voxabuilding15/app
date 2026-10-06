import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button, EmptyState, Input, SegmentedControl, Text } from '@/components';
import { spacing } from '@/theme';
import { useTranslator } from '@/i18n';

import type { HistoryScope } from '../../domain/entities';
import type { HistoryViewModel } from '../view-models/useHistoryViewModel';

import { SessionRow } from './SessionRow';
import { msg } from '@/i18n/msg';

const SCOPES: readonly { value: HistoryScope; label: string }[] = [
  { value: 'focus', label: msg('Focus') },
  { value: 'breaks', label: msg('Breaks') },
  { value: 'all', label: msg('All') },
];

/** Sessions drawn at first; the rest is one tap away, so a long history opens quickly. */
const PAGE_SIZE = 30;

/** Past sessions, newest first, with search and undoable delete. */
export function HistoryPanel({ vm }: { vm: HistoryViewModel }) {
  const { t } = useTranslator();
  const router = useRouter();
  const [shown, setShown] = useState(PAGE_SIZE);

  return (
    <View style={{ gap: spacing.md }}>
      <SegmentedControl options={SCOPES} value={vm.scope} onChange={vm.setScope} />
      <Input
        label={t('Search history')}
        value={vm.search}
        onChangeText={vm.setSearch}
        placeholder={t('Search notes, tasks, habits and tags')}
        returnKeyType="search"
        autoCorrect={false}
      />
      {vm.isError ? (
        <View style={{ gap: spacing.md, alignItems: 'center' }}>
          <Text tone="error">{t("Couldn't load your history.")}</Text>
          <Button label={t('Try again')} variant="tonal" onPress={() => void vm.refetch()} />
        </View>
      ) : vm.sessions.length === 0 && !vm.isLoading ? (
        <EmptyState
          icon={vm.isSearching ? 'search-off' : 'history'}
          title={vm.isSearching ? t('No matching sessions') : t('No sessions yet')}
          message={
            vm.isSearching
              ? t('Nothing matches your search.')
              : t('Finished focus sessions and breaks are listed here.')
          }
        />
      ) : (
        vm.sessions
          .slice(0, shown)
          .map((session) => (
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
      {vm.sessions.length > shown ? (
        <Button
          label={t('Show {min} more', { min: Math.min(PAGE_SIZE, vm.sessions.length - shown) })}
          variant="text"
          onPress={() => setShown((count) => count + PAGE_SIZE)}
        />
      ) : null}
    </View>
  );
}
