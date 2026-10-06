import { createStatsSources } from '@/features/statistics/data/create-sources';
import { createExportUseCases } from '@/features/statistics/domain/export-usecases';
import { createStatsUseCases } from '@/features/statistics/domain/usecases';

import { createSeeder } from '../support/seed';
import { MemoryFiles } from '../support/memory-files';
import { createTestDatabase } from '../tasks/test-database';

export const at = (y: number, m: number, d: number, h = 12, min = 0) =>
  new Date(y, m - 1, d, h, min).getTime();

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getString: (key: string) => values.get(key),
    setString: (key: string, value: string) => void values.set(key, value),
    remove: (key: string) => void values.delete(key),
  };
}

/** The statistics use cases over a fresh in-memory database seeded through plain SQL. */
export function createStats(start = at(2026, 10, 15, 18)) {
  const state = { now: start };
  const clock = { now: () => state.now };
  const db = createTestDatabase();
  const storage = memoryStorage();
  const files = new MemoryFiles();
  const sources = createStatsSources({
    clock,
    db,
    storage,
    files,
    categories: () => {
      throw new Error('not used');
    },
    notifications: undefined as never,
    authenticator: undefined as never,
  });
  const seed = createSeeder(db, () => state.now);

  return {
    db,
    state,
    storage,
    files,
    stats: createStatsUseCases({ sources, clock }),
    exports: createExportUseCases({ files, clock }),

    ...seed,
  };
}

export type StatsFixture = ReturnType<typeof createStats>;
