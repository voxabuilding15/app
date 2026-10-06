import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert } from 'react-native';

import { pickDate } from '@/components';
import {
  addDaysToKey,
  dateKeyToNoon,
  parseMoney,
  toAmountText,
  toDateKey,
  type DateKey,
} from '@/core';
import { useDiscardGuard, useNow } from '@/hooks';
import { useTranslator } from '@/i18n';

import type { Budget, BudgetPeriod } from '../../domain/entities';
import type { BudgetDraft, BudgetErrors } from '../../domain/validation';
import { useFinanceModule } from '../module';
import { useBudget, useCurrency, useFinanceCategories, useInvalidateFinance } from '../queries';

import { useCategoryCreator } from './useCategoryCreator';
import { INVALID_AMOUNT } from './useMovementForm';

const DEFAULT_CUSTOM_DAYS = 30;

function draftFromBudget(budget: Budget): BudgetDraft {
  return {
    name: budget.name,
    period: budget.period,
    amountMinor: budget.amountMinor,
    startDate: budget.startDate,
    endDate: budget.endDate,
    categoryIds: budget.categoryIds,
  };
}

export type BudgetLoadState =
  | { phase: 'loading' }
  | { phase: 'notFound' }
  | { phase: 'failed'; retry: () => void }
  | { phase: 'ready'; initial: BudgetDraft };

/** Loads the budget to edit, or builds the starting draft for a new one. */
export function useBudgetLoader(budgetId: string | null): BudgetLoadState {
  const query = useBudget(budgetId);
  const initial = useMemo<BudgetDraft | null>(
    () =>
      budgetId === null
        ? {
            name: '',
            period: 'monthly',
            amountMinor: null,
            startDate: null,
            endDate: null,
            categoryIds: [],
          }
        : query.data
          ? draftFromBudget(query.data)
          : null,
    [budgetId, query.data],
  );

  if (budgetId === null) {
    return initial === null ? { phase: 'loading' } : { phase: 'ready', initial };
  }
  if (query.isPending) {
    return { phase: 'loading' };
  }
  if (query.isError) {
    return { phase: 'failed', retry: () => void query.refetch() };
  }
  return initial === null ? { phase: 'notFound' } : { phase: 'ready', initial };
}

/** Editing state for one budget. `budgetId` null creates a new one. */
export function useBudgetFormViewModel(budgetId: string | null, initial: BudgetDraft) {
  const { t } = useTranslator();
  const router = useRouter();
  const { budgets } = useFinanceModule();
  const invalidate = useInvalidateFinance();
  const currency = useCurrency();
  const categories = useFinanceCategories('expense');
  const today = toDateKey(useNow());

  const [draft, setDraft] = useState(initial);
  const [amountText, setAmountTextState] = useState(
    initial.amountMinor === null ? '' : toAmountText(initial.amountMinor, currency),
  );
  const [errors, setErrors] = useState<BudgetErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [baseline] = useState(() => JSON.stringify(initial));
  const isDirty = useMemo(() => JSON.stringify(draft) !== baseline, [draft, baseline]);
  const allowLeaving = useDiscardGuard(isDirty, saving);

  const update = useCallback(
    (changes: Partial<BudgetDraft>, clears: readonly (keyof BudgetErrors)[] = []) => {
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

  const finish = useCallback(() => {
    allowLeaving();
    router.back();
  }, [allowLeaving, router]);

  const setAmountText = useCallback(
    (text: string) => {
      setAmountTextState(text);
      update({ amountMinor: parseMoney(text, currency) }, ['amount']);
    },
    [currency, update],
  );

  const setPeriod = useCallback(
    (period: BudgetPeriod) => {
      update(
        period === 'custom'
          ? {
              period,
              startDate: draft.startDate ?? today,
              endDate: draft.endDate ?? addDaysToKey(today, DEFAULT_CUSTOM_DAYS - 1),
            }
          : { period },
        ['dates'],
      );
    },
    [draft.startDate, draft.endDate, today, update],
  );

  const pickDay = useCallback(
    async (which: 'start' | 'end') => {
      const current = (which === 'start' ? draft.startDate : draft.endDate) ?? today;
      const picked = await pickDate(new Date(dateKeyToNoon(current)));
      if (picked !== null) {
        const key: DateKey = toDateKey(picked.getTime());
        update(which === 'start' ? { startDate: key } : { endDate: key }, ['dates']);
      }
    },
    [draft.startDate, draft.endDate, today, update],
  );

  const toggleCategory = useCallback(
    (id: string) =>
      update({
        categoryIds: draft.categoryIds.includes(id)
          ? draft.categoryIds.filter((existing) => existing !== id)
          : [...draft.categoryIds, id],
      }),
    [draft.categoryIds, update],
  );

  const createExpenseCategory = useCategoryCreator('expense');
  const createCategory = useCallback(
    async (name: string, color: string): Promise<string | null> => {
      const created = await createExpenseCategory(name, color);
      if ('error' in created) {
        return created.error;
      }
      update({ categoryIds: [...draft.categoryIds, created.id] });
      return null;
    },
    [createExpenseCategory, update, draft.categoryIds],
  );

  const save = useCallback(async () => {
    if (saving) {
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const result = await budgets.save(draft, budgetId);
      if (!result.ok) {
        setErrors(result.errors);
        return;
      }
      await invalidate();
      finish();
    } catch {
      setSaveError(t("Couldn't save the budget. Please try again."));
    } finally {
      setSaving(false);
    }
  }, [saving, budgets, draft, budgetId, invalidate, finish, t]);

  const remove = useCallback(async () => {
    if (budgetId === null) {
      return;
    }
    try {
      await budgets.remove(budgetId);
      await invalidate();
      finish();
    } catch {
      setSaveError(t("Couldn't delete the budget. Please try again."));
    }
  }, [budgetId, budgets, invalidate, finish, t]);

  const confirmDelete = useCallback(() => {
    Alert.alert(t('Delete this budget?'), t('Your transactions are not affected.'), [
      { text: t('Cancel'), style: 'cancel' },
      { text: t('Delete'), style: 'destructive', onPress: () => void remove() },
    ]);
  }, [remove, t]);

  return {
    isEditing: budgetId !== null,
    currency,
    draft,
    errors,
    amountText,
    amountTextError:
      amountText.trim() !== '' && draft.amountMinor === null ? INVALID_AMOUNT : undefined,
    categories: categories.data ?? [],
    saving,
    saveError,
    today,
    setName: useCallback((name: string) => update({ name }, ['name']), [update]),
    setAmountText,
    setPeriod,
    pickDay,
    toggleCategory,
    clearCategories: useCallback(() => update({ categoryIds: [] }), [update]),
    createCategory,
    save,
    confirmDelete,
  };
}
