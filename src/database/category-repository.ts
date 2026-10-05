import type { Category, CategoryKind, CategoryRepository, Database } from '@/core';

const DEFAULT_ICON = 'folder';

/** Categories for one feature, stored in the shared `categories` table and scoped by `kind`. */
export class SqliteCategoryRepository implements CategoryRepository {
  constructor(
    private readonly db: Database,
    private readonly kind: CategoryKind,
    private readonly now: () => number,
  ) {}

  async list(): Promise<Category[]> {
    return this.db.getAllSync<Category>(
      'SELECT id, name, color FROM categories WHERE kind = ? ORDER BY name COLLATE NOCASE',
      [this.kind],
    );
  }

  async save(category: Category): Promise<void> {
    this.db.runSync(
      `INSERT INTO categories (id, kind, name, color, icon, created_at) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, color = excluded.color`,
      [category.id, this.kind, category.name, category.color, DEFAULT_ICON, this.now()],
    );
  }

  async delete(id: string): Promise<void> {
    this.db.runSync('DELETE FROM categories WHERE id = ? AND kind = ?', [id, this.kind]);
  }
}
