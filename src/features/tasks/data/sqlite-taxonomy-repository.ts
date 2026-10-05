import type { Database } from '@/core';

import type { Category, Label } from '../domain/entities';
import type { TaxonomyRepository } from '../domain/ports';

const CATEGORY_ICON = 'folder';

export class SqliteTaxonomyRepository implements TaxonomyRepository {
  constructor(
    private readonly db: Database,
    private readonly now: () => number,
  ) {}

  async listCategories() {
    return this.db.getAllSync<Category>(
      `SELECT id, name, color FROM categories WHERE kind = 'task' ORDER BY name COLLATE NOCASE`,
    );
  }

  async listLabels() {
    return this.db.getAllSync<Label>(
      'SELECT id, name, color FROM labels ORDER BY name COLLATE NOCASE',
    );
  }

  async saveCategory(category: Category) {
    this.db.runSync(
      `INSERT INTO categories (id, kind, name, color, icon, created_at) VALUES (?, 'task', ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, color = excluded.color`,
      [category.id, category.name, category.color, CATEGORY_ICON, this.now()],
    );
  }

  async saveLabel(label: Label) {
    this.db.runSync(
      `INSERT INTO labels (id, name, color) VALUES (?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, color = excluded.color`,
      [label.id, label.name, label.color],
    );
  }

  async deleteCategory(id: string) {
    this.db.runSync(`DELETE FROM categories WHERE id = ? AND kind = 'task'`, [id]);
  }

  async deleteLabel(id: string) {
    this.db.runSync('DELETE FROM labels WHERE id = ?', [id]);
  }
}
