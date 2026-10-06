import type { DateKey } from '@/core';

import type { Counters, Lifetime, Unlock } from './entities';

export interface AchievementSource {
  lifetime(): Promise<Lifetime>;
  /** Local days on which a task was finished, a habit checked in or a focus session completed. */
  activeDays(): Promise<DateKey[]>;
  /** What was done on the days from `from` to `to`, both included. */
  between(from: DateKey, to: DateKey): Promise<Counters>;
}

export interface UnlockRepository {
  all(): Promise<Unlock[]>;
  /** Adds unlocks that are not stored yet; existing ones are left as they are. */
  insertMissing(unlocks: readonly Unlock[]): Promise<void>;
  markSeen(keys: readonly string[]): Promise<void>;
  /** The most XP the person has ever had, so deleting data never takes levels away. */
  peakXp(): Promise<number>;
  raisePeakXp(xp: number): Promise<void>;
}
