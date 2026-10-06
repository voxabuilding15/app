import type { DateKey } from '@/core';

/** What can be counted across the app. */
export type CounterId =
  'tasks' | 'checkIns' | 'focusSessions' | 'focusMinutes' | 'notes' | 'events' | 'transactions';

export type Counters = Record<CounterId, number>;

export const EMPTY_COUNTERS: Counters = {
  tasks: 0,
  checkIns: 0,
  focusSessions: 0,
  focusMinutes: 0,
  notes: 0,
  events: 0,
  transactions: 0,
};

/** Everything the app has recorded, for badges and milestones. */
export interface Lifetime extends Counters {
  /** Minutes of the longest focus session. */
  longestFocusMinutes: number;
}

/** Counters for one stretch of days, plus how many of them had something done. */
export interface PeriodCounts extends Counters {
  activeDays: number;
}

export type UnlockKind = 'badge' | 'milestone' | 'streak' | 'challenge';

export interface Unlock {
  key: string;
  kind: UnlockKind;
  /** The badge or challenge id the key stands for. */
  ref: string;
  xp: number;
  unlockedAt: number;
  seen: boolean;
}

export type { DateKey };
