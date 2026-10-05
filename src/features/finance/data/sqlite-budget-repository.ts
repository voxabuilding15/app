import type { Database } from '@/core';

import type { Budget } from '../domain/entities';
import type { BudgetRepository } from '../domain/ports';

import { toBudget, type BudgetRow } from './mappers';

const COLUMNS = 'id, name, period, amount_minor, start_date, end_date, created_at, updated_at';

export class SqliteBudgetRepository implements BudgetRepository {
  constructor(private readonly db: Database) {}

  async list(): Promise<Budget[]> {
    const rows = this.db.getAllSync<BudgetRow>(
      `SELECT ${COLUMNS} FROM budgets ORDER BY created_at, rowid`,
    );
    const links = this.db.getAllSync<{ budget_id: string; category_id: string }>(
      'SELECT budget_id, category_id FROM budget_categories ORDER BY category_id',
    );
    const byBudget = new Map<string, string[]>();
    for (const link of links) {
      byBudget.set(link.budget_id, [...(byBudget.get(link.budget_id) ?? []), link.category_id]);
    }
    return rows.map((row) => toBudget(row, byBudget.get(row.id) ?? []));
  }

  async get(id: string): Promise<Budget | null> {
    const row = this.db.getFirstSync<BudgetRow>(`SELECT ${COLUMNS} FROM budgets WHERE id = ?`, [
      id,
    ]);
    if (row === null) {
      return null;
    }
    const links = this.db.getAllSync<{ category_id: string }>(
      'SELECT category_id FROM budget_categories WHERE budget_id = ? ORDER BY category_id',
      [id],
    );
    return toBudget(
      row,
      links.map((link) => link.category_id),
    );
  }

  async insert(budget: Budget): Promise<void> {
    this.db.withTransactionSync(() => {
      this.db.runSync(`INSERT INTO budgets (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
        budget.id,
        budget.name,
        budget.period,
        budget.amountMinor,
        budget.startDate,
        budget.endDate,
        budget.createdAt,
        budget.updatedAt,
      ]);
      this.setCategories(budget);
    });
  }

  async update(budget: Budget): Promise<void> {
    this.db.withTransactionSync(() => {
      this.db.runSync(
        `UPDATE budgets SET name = ?, period = ?, amount_minor = ?, start_date = ?, end_date = ?,
           updated_at = ? WHERE id = ?`,
        [
          budget.name,
          budget.period,
          budget.amountMinor,
          budget.startDate,
          budget.endDate,
          budget.updatedAt,
          budget.id,
        ],
      );
      this.db.runSync('DELETE FROM budget_categories WHERE budget_id = ?', [budget.id]);
      this.setCategories(budget);
    });
  }

  async delete(id: string): Promise<void> {
    this.db.runSync('DELETE FROM budgets WHERE id = ?', [id]);
  }

  private setCategories(budget: Budget): void {
    for (const categoryId of budget.categoryIds) {
      this.db.runSync('INSERT INTO budget_categories (budget_id, category_id) VALUES (?, ?)', [
        budget.id,
        categoryId,
      ]);
    }
  }
}
