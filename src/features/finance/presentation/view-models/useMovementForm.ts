import { useCallback, useMemo, useState } from 'react';

import { parseMoney, toAmountText, type Category } from '@/core';

import type { AccountBalance, TransactionType } from '../../domain/entities';
import { useAccounts, useCurrency, useFinanceCategories } from '../queries';
import { msg } from '@/i18n/msg';

/** Fields a transaction and a recurring rule have in common. */
export interface MovementFields {
  type: TransactionType;
  amountMinor: number | null;
  accountId: string | null;
  toAccountId: string | null;
  categoryId: string | null;
  note: string;
}

export const INVALID_AMOUNT = msg('Enter a valid amount');

/**
 * Editing state for the money fields shared by transactions and recurring rules: the amount as
 * typed, which accounts can be picked, and the categories that fit the chosen type.
 */
export function useMovementForm<D extends MovementFields>(initial: D) {
  const currency = useCurrency();
  const accountsQuery = useAccounts(true);
  const expenseCategories = useFinanceCategories('expense');
  const incomeCategories = useFinanceCategories('income');

  const [draft, setDraft] = useState<D>(initial);
  const [amountText, setAmountTextState] = useState(
    initial.amountMinor === null ? '' : toAmountText(initial.amountMinor, currency),
  );

  const update = useCallback((changes: Partial<D>) => {
    setDraft((current) => ({ ...current, ...changes }));
  }, []);

  const setAmountText = useCallback(
    (text: string) => {
      setAmountTextState(text);
      update({ amountMinor: parseMoney(text, currency) } as Partial<D>);
    },
    [currency, update],
  );

  const setType = useCallback((type: TransactionType) => {
    setDraft((current) => ({
      ...current,
      type,
      // Expense and income categories are separate lists, and transfers have none.
      categoryId: current.type === type ? current.categoryId : null,
      toAccountId: type === 'transfer' ? current.toAccountId : null,
    }));
  }, []);

  const setAccount = useCallback((accountId: string) => {
    setDraft((current) => ({
      ...current,
      accountId,
      toAccountId: current.toAccountId === accountId ? null : current.toAccountId,
    }));
  }, []);

  const allAccounts = useMemo<readonly AccountBalance[]>(
    () => accountsQuery.data ?? [],
    [accountsQuery.data],
  );
  /** Archived accounts are only offered while the item already uses them. */
  const pickable = useCallback(
    (selectedId: string | null) =>
      allAccounts.filter((account) => account.archivedAt === null || account.id === selectedId),
    [allAccounts],
  );

  const categories: readonly Category[] =
    (draft.type === 'income' ? incomeCategories.data : expenseCategories.data) ?? [];

  return {
    currency,
    draft,
    update,
    amountText,
    setAmountText,
    amountTextInvalid: amountText.trim() !== '' && draft.amountMinor === null,
    setType,
    setAccount,
    setToAccount: useCallback(
      (toAccountId: string | null) => update({ toAccountId } as Partial<D>),
      [update],
    ),
    setCategory: useCallback(
      (categoryId: string | null) => update({ categoryId } as Partial<D>),
      [update],
    ),
    setNote: useCallback((note: string) => update({ note } as Partial<D>), [update]),
    accounts: pickable(draft.accountId),
    destinations: pickable(draft.toAccountId).filter((account) => account.id !== draft.accountId),
    categories,
    isLoadingAccounts: accountsQuery.isPending,
  };
}
