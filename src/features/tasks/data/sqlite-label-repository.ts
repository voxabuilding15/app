import type { Category, CategoryRepository, Database } from '@/core';

/** Labels are named, colored tags that apply across categories. */
export class SqliteLabelRepository implements CategoryRepository {
  constructor(private readonly db: Database) {}

  async list(): Promise<Category[]> {
    return this.db.getAllSync<Category>(
      'SELECT id, name, color FROM labels ORDER BY name COLLATE NOCASE',
    );
  }

  async save(label: Category): Promise<void> {
    this.db.runSync(
      `INSERT INTO labels (id, name, color) VALUES (?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, color = excluded.color`,
      [label.id, label.name, label.color],
    );
  }

  async delete(id: string): Promise<void> {
    this.db.runSync('DELETE FROM labels WHERE id = ?', [id]);
  }
}
