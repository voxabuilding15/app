import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert } from 'react-native';

import { pickDate, pickTime } from '@/components';
import { combineDayAndTime, formatMoney } from '@/core';
import { useDiscardGuard, useNow } from '@/hooks';

import type { OverBudget } from '../../domain/budget-usecases';
import type { TransactionRecord, TransactionType } from '../../domain/entities';
import type { TransactionDraft, TransactionErrors } from '../../domain/validation';
import { useFinanceModule } from '../module';
import { useAccounts, useInvalidateFinance, useTransaction } from '../queries';

import { useCategoryCreator } from './useCategoryCreator';
import { INVALID_AMOUNT, useMovementForm } from './useMovementForm';

export interface NewTransactionDefaults {
  type: TransactionType | null;
  accountId: string | null;
}

function draftFromRecord(record: TransactionRecord): TransactionDraft {
  return {
    type: record.type,
    amountMinor: record.amountMinor,
    accountId: record.accountId,
    toAccountId: record.toAccountId,
    categoryId: record.categoryId,
    note: record.note,
    occurredAt: record.occurredAt,
  };
}

export type TransactionLoadState =
  | { phase: 'loading' }
  | { phase: 'notFound' }
  | { phase: 'failed'; retry: () => void }
  | { phase: 'ready'; initial: TransactionDraft };

/** Loads the transaction to edit, or builds the starting draft for a new one. */
export function useTransactionLoader(
  transactionId: string | null,
  defaults: NewTransactionDefaults,
): TransactionLoadState {
  // The suggested date and time are fixed when the form opens, not recomputed as the clock ticks.
  const [openedAt] = useState(useNow());
  const transaction = useTransaction(transactionId);
  const accounts = useAccounts(false);

  const initial = useMemo<TransactionDraft | null>(() => {
    if (transactionId !== null) {
      return transaction.data ? draftFromRecord(transaction.data) : null;
    }
    const chosen = accounts.data?.find((account) => account.id === defaults.accountId);
    return {
      type: defaults.type ?? 'expense',
      amountMinor: null,
      accountId: (chosen ?? accounts.data?.[0])?.id ?? null,
      toAccountId: null,
      categoryId: null,
      note: '',
      occurredAt: openedAt,
    };
  }, [transactionId, transaction.data, accounts.data, defaults.accountId, defaults.type, openedAt]);

  if (transactionId !== null) {
    if (transaction.isPending) {
      return { phase: 'loading' };
    }
    if (transaction.isError) {
      return { phase: 'failed', retry: () => void transaction.refetch() };
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

function overBudgetMessage(over: readonly OverBudget[], currency: string): string {
  return over
    .map((item) => `${item.name}: over by ${formatMoney(item.overByMinor, currency)}`)
    .join('\n');
}

/** Editing state for one transaction. `transactionId` null creates a new one. */
export function useTransactionFormViewModel(
  transactionId: string | null,
  initial: TransactionDraft,
) {
  const router = useRouter();
  const { transactions } = useFinanceModule();
  const invalidate = useInvalidateFinance();
  const form = useMovementForm(initial);
  const { draft, update, currency } = form;

  const [errors, setErrors] = useState<TransactionErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [baseline] = useState(() => JSON.stringify(initial));
  const isDirty = useMemo(() => JSON.stringify(draft) !== baseline, [draft, baseline]);
  const allowLeaving = useDiscardGuard(isDirty, saving);

  const finish = useCallback(() => {
    allowLeaving();
    router.back();
  }, [allowLeaving, router]);

  const pickDay = useCallback(async () => {
    const picked = await pickDate(new Date(draft.occurredAt));
    if (picked !== null) {
      update({ occurredAt: combineDayAndTime(picked.getTime(), draft.occurredAt) });
      setErrors(({ date: _date, ...rest }) => rest);
    }
  }, [draft.occurredAt, update]);

  const pickClock = useCallback(async () => {
    const picked = await pickTime(new Date(draft.occurredAt));
    if (picked !== null) {
      update({ occurredAt: combineDayAndTime(draft.occurredAt, picked.getTime()) });
    }
  }, [draft.occurredAt, update]);

  const clearError = useCallback((field: keyof TransactionErrors) => {
    setErrors((current) => {
      const { [field]: _removed, ...rest } = current;
      return rest;
    });
    setSaveError(null);
  }, []);

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
      const result = await transactions.save(draft, transactionId);
      if (!result.ok) {
        setErrors(result.errors);
        return;
      }
      await invalidate();
      if (result.overBudgets.length > 0) {
        Alert.alert('Over budget', overBudgetMessage(result.overBudgets, currency));
      }
      finish();
    } catch {
      setSaveError("Couldn't save the transaction. Please try again.");
    } finally {
      setSaving(false);
    }
  }, [saving, transactions, draft, transactionId, invalidate, currency, finish]);

  const remove = useCallback(async () => {
    if (transactionId === null) {
      return;
    }
    try {
      await transactions.remove(transactionId);
      await invalidate();
      finish();
    } catch {
      setSaveError("Couldn't delete the transaction. Please try again.");
    }
  }, [transactionId, transactions, invalidate, finish]);

  const confirmDelete = useCallback(() => {
    Alert.alert('Delete this transaction?', 'Your balances will be updated.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void remove() },
    ]);
  }, [remove]);

  const amountTextError = form.amountTextInvalid ? INVALID_AMOUNT : undefined;

  return {
    ...form,
    isEditing: transactionId !== null,
    errors,
    amountTextError,
    saving,
    saveError,
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
    pickDay,
    pickClock,
    createCategory,
    save,
    confirmDelete,
  };
}
