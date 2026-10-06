import { useCallback, useState } from 'react';

import { parseMoney, toAmountText } from '@/core';

import { AccountInUseError, totalBalanceMinor } from '../../domain/account-usecases';
import type { Account, AccountBalance, AccountType } from '../../domain/entities';
import type { AccountErrors } from '../../domain/validation';
import { useFinanceModule } from '../module';
import { useAccounts, useCurrency, useInvalidateFinance } from '../queries';

import { INVALID_AMOUNT } from './useMovementForm';
import { useNotice, useUndoableDelete } from '@/hooks';

export function useAccountsViewModel() {
  const { accounts: useCases } = useFinanceModule();
  const invalidate = useInvalidateFinance();
  const { notice, show, dismiss } = useNotice();

  const [showArchived, setShowArchived] = useState(false);
  /** The account being edited, `null` for a new one, or undefined when the sheet is closed. */
  const [editing, setEditing] = useState<AccountBalance | null | undefined>(undefined);
  const query = useAccounts(showArchived);
  const active = useAccounts(false);

  const explain = useCallback(
    (error: unknown) =>
      error instanceof AccountInUseError
        ? 'This account has transactions. Archive it instead.'
        : null,
    [],
  );
  const remove = useUndoableDelete<Account>({
    noun: 'Account',
    remove: useCases.remove,
    restore: useCases.restore,
    onChanged: invalidate,
    show,
    explain,
  });

  const setArchived = useCallback(
    async (account: AccountBalance, archived: boolean) => {
      try {
        await useCases.setArchived(account.id, archived);
        show({ message: archived ? 'Account archived' : 'Account restored' });
      } catch {
        show({ message: "Couldn't update the account" });
      }
      await invalidate();
    },
    [useCases, show, invalidate],
  );

  return {
    accounts: query.data ?? [],
    totalMinor: totalBalanceMinor(active.data ?? []),
    showArchived,
    setShowArchived,
    isLoading: query.isPending,
    isError: query.isError,
    refetch: query.refetch,
    isRefreshing: query.isRefetching,
    editing,
    startEditing: (account: AccountBalance | null) => setEditing(account),
    stopEditing: () => setEditing(undefined),
    notice,
    dismissNotice: dismiss,
    remove,
    setArchived,
  };
}

/** Form state for the account sheet. Mount it only while the sheet is open. */
export function useAccountEditor(account: AccountBalance | null, onSaved: () => void) {
  const { accounts } = useFinanceModule();
  const invalidate = useInvalidateFinance();
  const currency = useCurrency();

  const [name, setName] = useState(account?.name ?? '');
  const [type, setType] = useState<AccountType>(account?.type ?? 'bank');
  const [color, setColor] = useState(account?.color ?? '#2563EB');
  const [balanceText, setBalanceText] = useState(
    account === null ? '0' : toAmountText(account.initialBalanceMinor, currency),
  );
  const [errors, setErrors] = useState<AccountErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const balance = parseMoney(balanceText, currency, { allowNegative: true });

  const submit = useCallback(async () => {
    if (balance === null) {
      setErrors({ balance: INVALID_AMOUNT });
      return;
    }
    setSaving(true);
    setFailure(null);
    try {
      const result = await accounts.save(
        { name, type, color, initialBalanceMinor: balance },
        account?.id ?? null,
      );
      if (!result.ok) {
        setErrors(result.errors);
        return;
      }
      await invalidate();
      onSaved();
    } catch {
      setFailure("Couldn't save the account. Please try again.");
    } finally {
      setSaving(false);
    }
  }, [accounts, name, type, color, balance, account, invalidate, onSaved]);

  return {
    currency,
    name,
    type,
    color,
    balanceText,
    errors,
    failure,
    saving,
    setName: (text: string) => {
      setName(text);
      setErrors(({ name: _name, ...rest }) => rest);
    },
    setType,
    setColor,
    setBalanceText: (text: string) => {
      setBalanceText(text);
      setErrors(({ balance: _balance, ...rest }) => rest);
    },
    submit,
  };
}
