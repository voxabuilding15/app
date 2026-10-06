import { createId, toDateKey, type CategoryRepository, type Clock } from '@/core';

import { budgetCovers, budgetDays, budgetProgress, budgetTimeRange } from './budgets';
import type { Budget, BudgetProgress } from './entities';
import type { BudgetRepository, TransactionRepository } from './ports';
import { hasErrors, validateBudget, type BudgetDraft, type BudgetErrors } from './validation';
import { currentTranslator } from '@/i18n/translate';

export type SaveBudgetResult = { ok: true; id: string } | { ok: false; errors: BudgetErrors };

/** A budget that an expense has pushed past its limit. */
export interface OverBudget {
  name: string;
  overByMinor: number;
}

interface BudgetUseCaseDeps {
  budgets: BudgetRepository;
  transactions: TransactionRepository;
  /** The expense categories budgets can be limited to. */
  categories: CategoryRepository;
  clock: Clock;
}

const STATE_ORDER = { over: 0, warning: 1, ok: 2 } as const;
const PHASE_ORDER = { active: 0, upcoming: 1, ended: 2 } as const;

export function createBudgetUseCases({
  budgets,
  transactions,
  categories,
  clock,
}: BudgetUseCaseDeps) {
  const { t } = currentTranslator();
  return {
    /** Every budget with its progress for the period that covers today. */
    async list(): Promise<BudgetProgress[]> {
      const today = toDateKey(clock.now());
      const [all, expenseCategories] = await Promise.all([budgets.list(), categories.list()]);
      const progress: BudgetProgress[] = [];
      for (const budget of all) {
        const range = budgetTimeRange(budgetDays(budget, today));
        const spent = await transactions.expenseTotal(range, budget.categoryIds);
        progress.push(budgetProgress(budget, expenseCategories, spent, today));
      }
      return progress.sort(
        (a, b) =>
          PHASE_ORDER[a.phase] - PHASE_ORDER[b.phase] ||
          STATE_ORDER[a.state] - STATE_ORDER[b.state] ||
          a.budget.name.localeCompare(b.budget.name),
      );
    },

    get(id: string): Promise<Budget | null> {
      return budgets.get(id);
    },

    async save(draft: BudgetDraft, id: string | null): Promise<SaveBudgetResult> {
      const errors = validateBudget(draft);
      const name = draft.name.trim();
      if (!errors.name) {
        const all = await budgets.list();
        if (
          all.some((other) => other.id !== id && other.name.toLowerCase() === name.toLowerCase())
        ) {
          errors.name = t('This name is already in use');
        }
      }
      if (hasErrors(errors) || draft.amountMinor === null) {
        return { ok: false, errors };
      }

      const now = clock.now();
      const existing = id === null ? null : await budgets.get(id);
      if (id !== null && existing === null) {
        throw new Error(t('This budget no longer exists.'));
      }
      const custom = draft.period === 'custom';
      const budget: Budget = {
        id: existing?.id ?? createId(),
        name,
        period: draft.period,
        amountMinor: draft.amountMinor,
        startDate: custom ? draft.startDate : null,
        endDate: custom ? draft.endDate : null,
        categoryIds: [...new Set(draft.categoryIds)],
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      if (existing === null) {
        await budgets.insert(budget);
      } else {
        await budgets.update(budget);
      }
      return { ok: true, id: budget.id };
    },

    /** Deletes a budget and returns it so the deletion can be undone. */
    async remove(id: string): Promise<Budget> {
      const budget = await budgets.get(id);
      if (budget === null) {
        throw new Error(t('This budget no longer exists.'));
      }
      await budgets.delete(id);
      return budget;
    },

    restore(budget: Budget): Promise<void> {
      return budgets.insert(budget);
    },

    /**
     * Budgets that an expense in `categoryId` on `occurredAt` counts towards and that are now past
     * their limit for the period containing that moment.
     */
    async overspentBy(categoryId: string | null, occurredAt: number): Promise<OverBudget[]> {
      const day = toDateKey(occurredAt);
      const over: OverBudget[] = [];
      for (const budget of await budgets.list()) {
        if (!budgetCovers(budget, categoryId)) {
          continue;
        }
        const days = budgetDays(budget, day);
        if (day < days.from || day > days.to) {
          continue;
        }
        const spent = await transactions.expenseTotal(budgetTimeRange(days), budget.categoryIds);
        if (spent > budget.amountMinor) {
          over.push({ name: budget.name, overByMinor: spent - budget.amountMinor });
        }
      }
      return over;
    },
  };
}

export type BudgetUseCases = ReturnType<typeof createBudgetUseCases>;
