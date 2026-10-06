import { SqliteAchievementSource } from '@/features/achievements/data/sqlite-source';
import { SqliteUnlockRepository } from '@/features/achievements/data/sqlite-unlocks';
import { createAchievementUseCases } from '@/features/achievements/domain/usecases';

import { createSeeder } from '../support/seed';
import { createTestDatabase } from '../tasks/test-database';

export const at = (y: number, m: number, d: number, h = 12, min = 0) =>
  new Date(y, m - 1, d, h, min).getTime();

/** The achievement use cases over a fresh in-memory database, with a clock the test controls. */
export function createAchievements(start = at(2026, 10, 15, 18)) {
  const state = { now: start };
  const db = createTestDatabase();
  const seed = createSeeder(db, () => state.now);
  const unlocks = new SqliteUnlockRepository(db);
  return {
    db,
    state,
    seed,
    unlocks,
    achievements: createAchievementUseCases({
      source: new SqliteAchievementSource(db),
      unlocks,
      clock: { now: () => state.now },
    }),
    /** Finishes `count` tasks on the given day. */
    completeTasks(count: number, day: number, month = 10) {
      for (let index = 0; index < count; index += 1) {
        seed.addTask(`task ${month}-${day}-${index}`, {
          createdAt: at(2026, month, day, 8),
          completedAt: at(2026, month, day, 9, index % 50),
        });
      }
    },
  };
}

export type AchievementsFixture = ReturnType<typeof createAchievements>;
