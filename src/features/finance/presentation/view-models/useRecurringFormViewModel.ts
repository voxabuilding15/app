import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert } from 'react-native';

import { pickDate } from '@/components';
import {
  MAX_RECURRENCE_INTERVAL,
  addDaysToKey,
  dateKeyToNoon,
  ruleForRecurrencePreset,
  toDateKey,
  type RecurrencePreset,
  type RecurrenceRule,
} from '@/core';
import { useDiscardGuard, useNow } from '@/hooks';
import { useTranslator } from '@/i18n';

import type { RecurringRecord, TransactionType } from '../../domain/entities';
import type { RecurringDraft, RecurringErrors } from '../../domain/validation';
import { useFinanceModule } from '../module';
import { useAccounts, useInvalidateFinance, useRecurring } from '../queries';

import { useCategoryCreator } from './useCategoryCreator';
import { INVALID_AMOUNT, useMovementForm } from './useMovementForm';

const DEFAULT_END_DAYS = 365;

export interface NewRecurringDefaults {
  type: TransactionType | null;
}

function draftFromRecord(record: RecurringRecord): RecurringDraft {
  return {
    type: record.type,
    amountMinor: record.amountMinor,
    accountId: record.accountId,
    toAccountId: record.toAccountId,
    categoryId: record.categoryId,
    note: record.note,
    rule: record.rule,
    startDate: record.startDate,
    endDate: record.endDate,
  };
}

export type RecurringLoadState =
  | { phase: 'loading' }
  | { phase: 'notFound' }
  | { phase: 'failed'; retry: () => void }
  | { phase: 'ready'; initial: RecurringDraft };

/** Loads the rule to edit, or builds the starting draft for a new one. */
export function useRecurringLoader(
  recurringId: string | null,
  defaults: NewRecurringDefaults,
): RecurringLoadState {
  // The suggested start date is fixed when the form opens.
  const [openedAt] = useState(useNow());
  const query = useRecurring(recurringId);
  const accounts = useAccounts(false);

  const initial = useMemo<RecurringDraft | null>(() => {
    if (recurringId !== null) {
      return query.data ? draftFromRecord(query.data) : null;
    }
    return {
      type: defaults.type ?? 'expense',
      amountMinor: null,
      accountId: accounts.data?.[0]?.id ?? null,
      toAccountId: null,
      categoryId: null,
      note: '',
      rule: { unit: 'month', interval: 1, weekdays: 0 },
      startDate: toDateKey(openedAt),
      endDate: null,
    };
  }, [recurringId, query.data, accounts.data, defaults.type, openedAt]);

  if (recurringId !== null) {
    if (query.isPending) {
      return { phase: 'loading' };
    }
    if (query.isError) {
      return { phase: 'failed', retry: () => void query.refetch() };
    }
    return initial === null ? { phase: 'notFound' } : { phase: 'ready', initial };
  }
  if (accounts.isPending) {
    return { phase: 'loading' };
  }
  if (accounts.isError) {
    return { phase: 'failed', retry: () => void accounts.refetch() };
  }
  return initial === null ? { phase: 'loading' } : { phase: 'ready', initial };
}

/** Editing state for one recurring transaction. `recurringId` null creates a new rule. */
export function useRecurringFormViewModel(recurringId: string | null, initial: RecurringDraft) {
  const { t } = useTranslator();
  const router = useRouter();
  const { recurring } = useFinanceModule();
  const invalidate = useInvalidateFinance();
  const form = useMovementForm(initial);
  const { draft, update } = form;
  const today = toDateKey(useNow());

  const [errors, setErrors] = useState<RecurringErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [baseline] = useState(() => JSON.stringify(initial));
  const isDirty = useMemo(() => JSON.stringify(draft) !== baseline, [draft, baseline]);
  const allowLeaving = useDiscardGuard(isDirty, saving);

  const finish = useCallback(() => {
    allowLeaving();
    router.back();
  }, [allowLeaving, router]);

  const clearError = useCallback((...fields: (keyof RecurringErrors)[]) => {
    setErrors((current) => {
      const next = { ...current };
      fields.forEach((field) => delete next[field]);
      return next;
    });
    setSaveError(null);
  }, []);

  const setRepeatPreset = useCallback(
    (preset: RecurrencePreset) => {
      update({ rule: ruleForRecurrencePreset(preset, draft.rule) ?? draft.rule });
      clearError('repeat');
    },
    [draft.rule, update, clearError],
  );

  const changeRepeat = useCallback(
    (changes: Partial<RecurrenceRule>) => {
      const next = { ...draft.rule, ...changes };
      next.interval = Math.min(
        MAX_RECURRENCE_INTERVAL,
        Math.max(1, Math.round(next.interval) || 1),
      );
      if (next.unit !== 'week') {
        next.weekdays = 0;
      }
      update({ rule: next });
      clearError('repeat');
    },
    [draft.rule, update, clearError],
  );

  const pickStart = useCallback(async () => {
    const picked = await pickDate(new Date(dateKeyToNoon(draft.startDate)));
    if (picked !== null) {
      update({ startDate: toDateKey(picked.getTime()) });
      clearError('dates');
    }
  }, [draft.startDate, update, clearError]);

  const pickEnd = useCallback(async () => {
    const picked = await pickDate(new Date(dateKeyToNoon(draft.endDate ?? draft.startDate)));
    if (picked !== null) {
      update({ endDate: toDateKey(picked.getTime()) });
      clearError('dates');
    }
  }, [draft.endDate, draft.startDate, update, clearError]);

  const setEnds = useCallback(
    (ends: 'never' | 'date') => {
      update({
        endDate: ends === 'never' ? null : addDaysToKey(draft.startDate, DEFAULT_END_DAYS),
      });
      clearError('dates');
    },
    [draft.startDate, update, clearError],
  );

  const createCategoryOfType = useCategoryCreator(draft.type === 'income' ? 'income' : 'expense');
  const createCategory = useCallback(
    async (name: string, color: string): Promise<string | null> => {
      const created = await createCategoryOfType(name, color);
      if ('error' in created) {
        return created.error;
      }
      form.setCategory(created.id);
      return null;
    },
    [createCategoryOfType, form],
  );

  const save = useCallback(async () => {
    if (saving) {
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const result = await recurring.save(draft, recurringId);
      if (!result.ok) {
        setErrors(result.errors);
        return;
      }
      await invalidate();
      finish();
    } catch {
      setSaveError(t("Couldn't save. Please try again."));
    } finally {
      setSaving(false);
    }
  }, [saving, recurring, draft, recurringId, invalidate, finish, t]);

  const remove = useCallback(async () => {
    if (recurringId === null) {
      return;
    }
    try {
      await recurring.remove(recurringId);
      await invalidate();
      finish();
    } catch {
      setSaveError(t("Couldn't delete. Please try again."));
    }
  }, [recurringId, recurring, invalidate, finish, t]);

  const confirmDelete = useCallback(() => {
    Alert.alert(
      t('Delete this recurring transaction?'),
      t('Transactions it already added are kept.'),
      [
        { text: t('Cancel'), style: 'cancel' },
        { text: t('Delete'), style: 'destructive', onPress: () => void remove() },
      ],
    );
  }, [remove, t]);

  return {
    ...form,
    isEditing: recurringId !== null,
    today,
    errors,
    amountTextError: form.amountTextInvalid ? INVALID_AMOUNT : undefined,
    saving,
    saveError,
    backfills: draft.startDate < today,
    setType: useCallback(
      (type: TransactionType) => {
        form.setType(type);
        clearError('toAccount');
      },
      [form, clearError],
    ),
    setAmountText: useCallback(
      (text: string) => {
        form.setAmountText(text);
        clearError('amount');
      },
      [form, clearError],
    ),
    setAccount: useCallback(
      (id: string) => {
        form.setAccount(id);
        clearError('account');
      },
      [form, clearError],
    ),
    setToAccount: useCallback(
      (id: string | null) => {
        form.setToAccount(id);
        clearError('toAccount');
      },
      [form, clearError],
    ),
    setRepeatPreset,
    changeRepeat,
    pickStart,
    pickEnd,
    setEnds,
    createCategory,
    save,
    confirmDelete,
  };
}
