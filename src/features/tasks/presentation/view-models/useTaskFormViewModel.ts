import { useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';

import { addDays, combineDayAndTime, startOfDay } from '../../domain/dates';
import type { DueDate, Priority, RepeatRule, TaskDetail } from '../../domain/entities';
import { isValidReminderOffset } from '../../domain/reminder';
import { MAX_REPEAT_INTERVAL, ruleForPreset, type RepeatPreset } from '../../domain/repeat';
import {
  emptyDraft,
  hasErrors,
  type DraftErrors,
  type DraftField,
  type TaskDraft,
} from '../../domain/validation';
import { useTasksModule } from '../module';
import { pickDate, pickTime } from '../platform-pickers';
import { useInvalidateTasks, useTaskDetail, useTaxonomy } from '../queries';

const DEFAULT_TIME_HOUR = 9;

function toDraft(task: TaskDetail): TaskDraft {
  return {
    title: task.title,
    notes: task.notes,
    priority: task.priority,
    categoryId: task.category?.id ?? null,
    labelIds: task.labels.map((label) => label.id),
    due: task.due,
    reminderOffsetMinutes: task.reminderOffsetMinutes,
    isAlarm: task.isAlarm,
    repeat: task.repeat,
    subtasks: task.subtasks.map((subtask) => ({ ...subtask })),
  };
}

export type QuickDate = 'today' | 'tomorrow' | 'nextWeek';

function quickDateValue(kind: QuickDate, now: number): number {
  const today = startOfDay(now);
  switch (kind) {
    case 'today':
      return today;
    case 'tomorrow':
      return addDays(today, 1);
    default:
      return addDays(today, 7);
  }
}

export type TaskStatus = 'active' | 'completed' | 'archived';

export type TaskLoadState =
  | { phase: 'loading' }
  | { phase: 'notFound' }
  | { phase: 'failed'; retry: () => void }
  | { phase: 'ready'; initial: TaskDraft; status: TaskStatus | null };

/** Loads the task to edit (or an empty draft for a new task) so the form body can start from it. */
export function useTaskLoader(taskId: string | null): TaskLoadState {
  const detail = useTaskDetail(taskId);
  const { data, isPending, isError, refetch } = detail;

  const initial = useMemo(() => (data ? toDraft(data) : emptyDraft()), [data]);

  if (taskId === null) {
    return { phase: 'ready', initial, status: null };
  }
  if (isPending) {
    return { phase: 'loading' };
  }
  if (isError) {
    return { phase: 'failed', retry: () => void refetch() };
  }
  if (data === null || data === undefined) {
    return { phase: 'notFound' };
  }
  const status =
    data.archivedAt !== null ? 'archived' : data.completedAt !== null ? 'completed' : 'active';
  return { phase: 'ready', initial, status };
}

/** Editing state for one task. `taskId` null creates a new task; `initial` seeds the draft. */
export function useTaskFormViewModel(taskId: string | null, initial: TaskDraft) {
  const router = useRouter();
  const navigation = useNavigation();
  const { tasks: useCases, taxonomy: taxonomyCases } = useTasksModule();
  const invalidate = useInvalidateTasks();
  const taxonomy = useTaxonomy();

  const [draft, setDraft] = useState<TaskDraft>(initial);
  const [baseline] = useState(() => JSON.stringify(initial));
  const [errors, setErrors] = useState<DraftErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const leaving = useRef(false);

  const isDirty = useMemo(() => JSON.stringify(draft) !== baseline, [draft, baseline]);

  useEffect(() => {
    return navigation.addListener('beforeRemove', (event) => {
      if (!isDirty || saving || leaving.current) {
        return;
      }
      event.preventDefault();
      Alert.alert('Discard changes?', 'Your changes to this task have not been saved.', [
        { text: 'Keep editing', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            leaving.current = true;
            navigation.dispatch(event.data.action);
          },
        },
      ]);
    });
  }, [navigation, isDirty, saving]);

  const update = useCallback((changes: Partial<TaskDraft>, clears: readonly DraftField[] = []) => {
    setDraft((current) => ({ ...current, ...changes }));
    setSaveError(null);
    if (clears.length > 0) {
      setErrors((current) => {
        const next = { ...current };
        clears.forEach((field) => delete next[field]);
        return next;
      });
    }
  }, []);

  const setTitle = useCallback((title: string) => update({ title }, ['title']), [update]);
  const setNotes = useCallback((notes: string) => update({ notes }, ['notes']), [update]);
  const setPriority = useCallback((priority: Priority) => update({ priority }), [update]);
  const setCategory = useCallback((categoryId: string | null) => update({ categoryId }), [update]);

  const toggleLabel = useCallback((labelId: string) => {
    setDraft((current) => ({
      ...current,
      labelIds: current.labelIds.includes(labelId)
        ? current.labelIds.filter((id) => id !== labelId)
        : [...current.labelIds, labelId],
    }));
  }, []);

  const clearDue = useCallback(
    () =>
      update({ due: null, reminderOffsetMinutes: null, isAlarm: false, repeat: null }, [
        'due',
        'reminder',
        'repeat',
      ]),
    [update],
  );

  const setDueDay = useCallback(
    (day: number) => {
      const due: DueDate = draft.due?.hasTime
        ? { at: combineDayAndTime(day, draft.due.at), hasTime: true }
        : { at: startOfDay(day), hasTime: false };
      update({ due }, ['due', 'reminder', 'repeat']);
    },
    [draft.due, update],
  );

  const setQuickDate = useCallback(
    (kind: QuickDate) => setDueDay(quickDateValue(kind, Date.now())),
    [setDueDay],
  );

  const chooseDate = useCallback(async () => {
    const picked = await pickDate(new Date(draft.due?.at ?? Date.now()));
    if (picked !== null) {
      setDueDay(picked.getTime());
    }
  }, [draft.due, setDueDay]);

  const applyTime = useCallback(
    (time: Date | null) => {
      if (draft.due === null) {
        return;
      }
      const hasTime = time !== null;
      const at = hasTime
        ? combineDayAndTime(draft.due.at, time.getTime())
        : startOfDay(draft.due.at);
      const offset = draft.reminderOffsetMinutes;
      update(
        {
          due: { at, hasTime },
          // Offsets differ between timed and all-day tasks; fall back to "at the due moment".
          reminderOffsetMinutes:
            offset !== null && !isValidReminderOffset(offset, hasTime) ? 0 : offset,
        },
        ['reminder'],
      );
    },
    [draft.due, draft.reminderOffsetMinutes, update],
  );

  const chooseTime = useCallback(async () => {
    if (draft.due === null) {
      return;
    }
    const initial = draft.due.hasTime
      ? new Date(draft.due.at)
      : new Date(new Date(draft.due.at).setHours(DEFAULT_TIME_HOUR, 0, 0, 0));
    const picked = await pickTime(initial);
    if (picked !== null) {
      applyTime(picked);
    }
  }, [draft.due, applyTime]);

  const clearTime = useCallback(() => applyTime(null), [applyTime]);

  const setReminderOffset = useCallback(
    (offset: number | null) =>
      update(
        offset === null
          ? { reminderOffsetMinutes: null, isAlarm: false }
          : { reminderOffsetMinutes: offset },
        ['reminder'],
      ),
    [update],
  );

  const setAlarm = useCallback((isAlarm: boolean) => update({ isAlarm }), [update]);

  const setRepeatPreset = useCallback(
    (preset: RepeatPreset) => update({ repeat: ruleForPreset(preset, draft.repeat) }, ['repeat']),
    [draft.repeat, update],
  );

  const changeRepeat = useCallback(
    (changes: Partial<RepeatRule>) => {
      if (draft.repeat === null) {
        return;
      }
      const next = { ...draft.repeat, ...changes };
      next.interval = Math.min(MAX_REPEAT_INTERVAL, Math.max(1, Math.round(next.interval) || 1));
      if (next.unit !== 'week') {
        next.weekdays = 0;
      }
      update({ repeat: next }, ['repeat']);
    },
    [draft.repeat, update],
  );

  const addSubtask = useCallback(
    (title: string) => {
      const trimmed = title.trim();
      if (trimmed === '') {
        return;
      }
      update({ subtasks: [...draft.subtasks, { id: null, title: trimmed, completed: false }] }, [
        'subtasks',
      ]);
    },
    [draft.subtasks, update],
  );

  const renameSubtask = useCallback(
    (index: number, title: string) =>
      update({ subtasks: draft.subtasks.map((s, i) => (i === index ? { ...s, title } : s)) }, [
        'subtasks',
      ]),
    [draft.subtasks, update],
  );

  const toggleSubtask = useCallback(
    (index: number) =>
      update({
        subtasks: draft.subtasks.map((s, i) =>
          i === index ? { ...s, completed: !s.completed } : s,
        ),
      }),
    [draft.subtasks, update],
  );

  const removeSubtask = useCallback(
    (index: number) =>
      update({ subtasks: draft.subtasks.filter((_, i) => i !== index) }, ['subtasks']),
    [draft.subtasks, update],
  );

  /** Creates a category or label inline and selects it. Returns an error message, or null. */
  const createTaxonomy = useCallback(
    async (kind: 'category' | 'label', name: string, color: string): Promise<string | null> => {
      try {
        const input = { id: null, name, color };
        const result =
          kind === 'category'
            ? await taxonomyCases.saveCategory(input)
            : await taxonomyCases.saveLabel(input);
        if (!result.ok) {
          return result.error;
        }
        await invalidate();
        setDraft((current) =>
          kind === 'category'
            ? { ...current, categoryId: result.id }
            : { ...current, labelIds: [...current.labelIds, result.id] },
        );
        return null;
      } catch {
        return "Couldn't save. Please try again.";
      }
    },
    [taxonomyCases, invalidate],
  );

  const finish = useCallback(() => {
    leaving.current = true;
    router.back();
  }, [router]);

  const save = useCallback(async () => {
    if (saving) {
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const result = await useCases.save(draft, taskId);
      if (!result.ok) {
        setErrors(result.errors);
        return;
      }
      await invalidate();
      if (result.reminder === 'blocked') {
        Alert.alert(
          'Reminder will not fire',
          'The task was saved, but notifications are turned off. Allow them in Settings to receive reminders.',
        );
      } else if (result.reminder === 'past') {
        Alert.alert(
          'Reminder time has passed',
          'The task was saved without a notification because its reminder time is already in the past.',
        );
      }
      finish();
    } catch {
      setSaveError("Couldn't save the task. Please try again.");
    } finally {
      setSaving(false);
    }
  }, [saving, useCases, draft, taskId, invalidate, finish]);

  const changeStatus = useCallback(
    async (action: 'archive' | 'restore' | 'delete') => {
      if (taskId === null) {
        return;
      }
      try {
        if (action === 'archive') {
          await useCases.archive([taskId]);
        } else if (action === 'restore') {
          await useCases.restore([taskId]);
        } else {
          await useCases.remove([taskId]);
          await useCases.purge([taskId]);
        }
        await invalidate();
        finish();
      } catch {
        setSaveError("Couldn't update the task. Please try again.");
      }
    },
    [taskId, useCases, invalidate, finish],
  );

  const confirmDelete = useCallback(() => {
    Alert.alert('Delete this task?', 'This permanently removes the task and its subtasks.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void changeStatus('delete') },
    ]);
  }, [changeStatus]);

  return {
    isEditing: taskId !== null,
    draft,
    errors,
    hasErrors: hasErrors(errors),
    saving,
    saveError,
    categories: taxonomy.data?.categories ?? [],
    labels: taxonomy.data?.labels ?? [],
    setTitle,
    setNotes,
    setPriority,
    setCategory,
    toggleLabel,
    setQuickDate,
    chooseDate,
    chooseTime,
    clearTime,
    clearDue,
    setReminderOffset,
    setAlarm,
    setRepeatPreset,
    changeRepeat,
    addSubtask,
    renameSubtask,
    toggleSubtask,
    removeSubtask,
    createTaxonomy,
    save,
    archive: () => changeStatus('archive'),
    restore: () => changeStatus('restore'),
    confirmDelete,
  };
}
