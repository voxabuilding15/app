import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';

import { pickTime, showRemindersBlockedAlert } from '@/components';
import { useDiscardGuard } from '@/hooks';

import type { HabitEntry } from '../../domain/entities';
import { frequencyForPreset, type FrequencyPreset } from '../../domain/schedule';
import {
  emptyHabitDraft,
  type HabitDraft,
  type HabitDraftErrors,
  type HabitDraftField,
} from '../../domain/validation';
import { DEFAULT_HABIT_ICON } from '../icons';
import { useHabitsModule } from '../module';
import { useHabitCategories, useHabitDetail, useInvalidateHabits } from '../queries';
import { useTranslator } from '@/i18n';

const DEFAULT_REMINDER = '09:00';

function toDraft({ habit }: HabitEntry): HabitDraft {
  return {
    name: habit.name,
    notes: habit.notes,
    icon: habit.icon,
    color: habit.color,
    categoryId: habit.category?.id ?? null,
    period: habit.period,
    weekdays: habit.weekdays,
    goalCount: habit.goalCount,
    reminderTime: habit.reminderTime,
  };
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export type HabitLoadState =
  | { phase: 'loading' }
  | { phase: 'notFound' }
  | { phase: 'failed'; retry: () => void }
  | { phase: 'ready'; initial: HabitDraft };

/** Loads the habit to edit, or an empty draft (with the given default color) for a new one. */
export function useHabitLoader(habitId: string | null, defaultColor: string): HabitLoadState {
  const detail = useHabitDetail(habitId);
  const { data, isPending, isError, refetch } = detail;

  const initial = useMemo(
    () => (data ? toDraft(data.entry) : emptyHabitDraft(DEFAULT_HABIT_ICON, defaultColor)),
    [data, defaultColor],
  );

  if (habitId === null) {
    return { phase: 'ready', initial };
  }
  if (isPending) {
    return { phase: 'loading' };
  }
  if (isError) {
    return { phase: 'failed', retry: () => void refetch() };
  }
  return data === null || data === undefined ? { phase: 'notFound' } : { phase: 'ready', initial };
}

/** Editing state for one habit. `habitId` null creates a new habit; `initial` seeds the draft. */
export function useHabitFormViewModel(habitId: string | null, initial: HabitDraft) {
  const { t } = useTranslator();
  const router = useRouter();
  const { habits } = useHabitsModule();
  const invalidate = useInvalidateHabits();
  const categories = useHabitCategories();

  const [draft, setDraft] = useState<HabitDraft>(initial);
  const [baseline] = useState(() => JSON.stringify(initial));
  const [errors, setErrors] = useState<HabitDraftErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const isDirty = useMemo(() => JSON.stringify(draft) !== baseline, [draft, baseline]);
  const allowLeaving = useDiscardGuard(isDirty, saving);

  const update = useCallback(
    (changes: Partial<HabitDraft>, clears: readonly HabitDraftField[] = []) => {
      setDraft((current) => ({ ...current, ...changes }));
      setSaveError(null);
      if (clears.length > 0) {
        setErrors((current) => {
          const next = { ...current };
          clears.forEach((field) => delete next[field]);
          return next;
        });
      }
    },
    [],
  );

  const setPreset = useCallback(
    (preset: FrequencyPreset) => update(frequencyForPreset(preset, draft), ['weekdays']),
    [draft, update],
  );

  const chooseReminderTime = useCallback(async () => {
    const [hour, minute] = (draft.reminderTime ?? DEFAULT_REMINDER).split(':').map(Number);
    const picked = await pickTime(new Date(2000, 0, 1, hour ?? 9, minute ?? 0));
    if (picked !== null) {
      update({ reminderTime: `${pad(picked.getHours())}:${pad(picked.getMinutes())}` }, [
        'reminder',
      ]);
    }
  }, [draft.reminderTime, update]);

  const createCategory = useCallback(
    async (name: string, color: string): Promise<string | null> => {
      try {
        const result = await habits.categories.save({ id: null, name, color });
        if (!result.ok) {
          return result.error;
        }
        await invalidate();
        update({ categoryId: result.id });
        return null;
      } catch {
        return t("Couldn't save. Please try again.");
      }
    },
    [habits, invalidate, update, t],
  );

  const save = useCallback(async () => {
    if (saving) {
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const result = await habits.save(draft, habitId);
      if (!result.ok) {
        setErrors(result.errors);
        return;
      }
      await invalidate();
      if (result.reminder === 'blocked') {
        showRemindersBlockedAlert();
      }
      allowLeaving();
      router.back();
    } catch {
      setSaveError(t("Couldn't save the habit. Please try again."));
    } finally {
      setSaving(false);
    }
  }, [saving, habits, draft, habitId, invalidate, allowLeaving, router, t]);

  return {
    isEditing: habitId !== null,
    draft,
    errors,
    saving,
    saveError,
    categories: categories.data ?? [],
    setName: (name: string) => update({ name }, ['name']),
    setNotes: (notes: string) => update({ notes }, ['notes']),
    setIcon: (icon: string) => update({ icon }),
    setColor: (color: string) => update({ color }),
    setCategory: (categoryId: string | null) => update({ categoryId }),
    setPreset,
    setWeekdays: (weekdays: number) => update({ weekdays }, ['weekdays']),
    setGoal: (goalCount: number) => update({ goalCount }, ['goal']),
    setReminderEnabled: (enabled: boolean) =>
      update({ reminderTime: enabled ? (draft.reminderTime ?? DEFAULT_REMINDER) : null }, [
        'reminder',
      ]),
    chooseReminderTime,
    createCategory,
    save,
  };
}
