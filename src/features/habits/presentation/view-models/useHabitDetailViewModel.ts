import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert } from 'react-native';

import type { DateKey } from '@/core';
import { useOnAppForeground } from '@/hooks';
import { useTranslator } from '@/i18n';

import { createEvaluator } from '../../domain/progress';
import { useHabitsModule } from '../module';
import { useHabitDetail, useInvalidateHabits } from '../queries';

export function useHabitDetailViewModel(habitId: string) {
  const { t } = useTranslator();
  const router = useRouter();
  const { habits } = useHabitsModule();
  const invalidate = useInvalidateHabits();
  const detail = useHabitDetail(habitId);
  const [selectedDay, setSelectedDay] = useState<DateKey | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const data = detail.data ?? null;
  const evaluator = useMemo(
    () => (data ? createEvaluator(data.entry.habit, data.entry, data.today) : null),
    [data],
  );

  useOnAppForeground(() => void invalidate());

  const run = useCallback(
    async (action: () => Promise<unknown>, message = "Couldn't update the habit") => {
      try {
        await action();
      } catch {
        setFailure(message);
      }
      await invalidate();
    },
    [invalidate],
  );

  const confirmDelete = useCallback(() => {
    Alert.alert(
      t('Delete this habit?'),
      t(
        'This permanently deletes the habit and its whole history. Archive it instead to keep the history.',
      ),
      [
        { text: t('Cancel'), style: 'cancel' },
        {
          text: t('Delete'),
          style: 'destructive',
          onPress: () =>
            void run(async () => {
              await habits.remove(habitId);
              router.back();
            }, t("Couldn't delete the habit")),
        },
      ],
    );
  }, [run, habits, habitId, router, t]);

  return {
    isLoading: detail.isPending,
    isError: detail.isError,
    notFound: detail.isSuccess && data === null,
    retry: () => void detail.refetch(),
    data,
    evaluator,
    selectedDay,
    selectDay: setSelectedDay,
    failure,
    dismissFailure: useCallback(() => setFailure(null), []),
    adjustDay: (day: DateKey, delta: number) => run(() => habits.adjust(habitId, day, delta)),
    setDayCount: (day: DateKey, count: number) => run(() => habits.setCount(habitId, day, count)),
    skipDay: (day: DateKey, skipped: boolean) => run(() => habits.skip(habitId, day, skipped)),
    pause: () => run(() => habits.pause(habitId), t("Couldn't pause the habit")),
    resume: () => run(() => habits.resume(habitId), t("Couldn't resume the habit")),
    archive: () =>
      run(async () => {
        await habits.archive(habitId);
        router.back();
      }, t("Couldn't archive the habit")),
    restore: () => run(() => habits.restore(habitId), t("Couldn't restore the habit")),
    confirmDelete,
  };
}
