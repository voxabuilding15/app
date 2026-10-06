import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';

import { useOnAppForeground } from '@/hooks';

import type { AchievementState } from '../domain/usecases';

import { UnlockOverlay } from './components/UnlockOverlay';
import { useAchievementsModule } from './module';
import { ACHIEVEMENTS_KEY, useAchievementState, useSetAchievementState } from './queries';

/** The parts of the app whose changes can earn something. */
const WATCHED_ROOTS: ReadonlySet<unknown> = new Set([
  'tasks',
  'habits',
  'pomodoro',
  'notes',
  'calendar',
  'finance',
]);
const RECHECK_DELAY_MS = 1_200;

/**
 * Headless watcher that looks for new achievements at start-up, when the app comes back, and a
 * moment after anything is saved elsewhere in the app, then shows what was unlocked.
 */
export function AchievementsBridge() {
  const { achievements } = useAchievementsModule();
  const client = useQueryClient();
  const router = useRouter();
  const setState = useSetAchievementState();
  const state = useAchievementState().data;
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);

  const check = useCallback(() => {
    achievements
      .sync()
      .then(setState)
      .catch(() => undefined);
  }, [achievements, setState]);

  useOnAppForeground(check);

  useEffect(() => {
    const unsubscribe = client.getQueryCache().subscribe((event) => {
      const root = event.query.queryKey[0];
      const changed =
        event.type === 'updated' && event.action.type === 'invalidate' && WATCHED_ROOTS.has(root);
      if (!changed) {
        return;
      }
      if (pending.current !== null) {
        clearTimeout(pending.current);
      }
      pending.current = setTimeout(() => {
        pending.current = null;
        check();
      }, RECHECK_DELAY_MS);
    });
    return () => {
      unsubscribe();
      if (pending.current !== null) {
        clearTimeout(pending.current);
      }
    };
  }, [client, check]);

  const next = state?.unseen[0];
  const dismiss = useCallback(
    (keys: readonly string[]) => {
      client.setQueryData<AchievementState>(ACHIEVEMENTS_KEY, (current) =>
        current === undefined
          ? current
          : { ...current, unseen: current.unseen.filter((unlock) => !keys.includes(unlock.key)) },
      );
      void achievements.markSeen(keys).catch(() => undefined);
    },
    [client, achievements],
  );

  if (next === undefined) {
    return null;
  }
  return (
    <UnlockOverlay
      unlock={next}
      remaining={(state?.unseen.length ?? 1) - 1}
      onDismiss={() => dismiss([next.key])}
      onViewAll={() => {
        dismiss((state?.unseen ?? []).map((unlock) => unlock.key));
        router.navigate('/achievements');
      }}
    />
  );
}
