import { addDaysToKey, toDateKey, type Clock, type DateKey } from '@/core';

import { streaks as dayStreaks, type Streaks } from '../../pomodoro/domain/stats';

import { ALL_ACHIEVEMENTS, type AchievementDef } from './catalog';
import {
  challengesFor,
  periodEnd,
  periodStart,
  type Challenge,
  type ChallengePeriod,
} from './challenges';
import type { Counters, Lifetime, PeriodCounts, Unlock } from './entities';
import { levelForXp, type LevelProgress } from './levels';
import type { AchievementSource, UnlockRepository } from './ports';

/** XP for the things done, before any rewards. */
const XP_PER = {
  tasks: 10,
  checkIns: 5,
  focusSessions: 20,
  notes: 3,
  events: 2,
  transactions: 1,
} as const;
/** One XP for every five minutes of focus. */
const MINUTES_PER_XP = 5;

export function activityXp(lifetime: Lifetime): number {
  return (
    lifetime.tasks * XP_PER.tasks +
    lifetime.checkIns * XP_PER.checkIns +
    lifetime.focusSessions * XP_PER.focusSessions +
    lifetime.notes * XP_PER.notes +
    lifetime.events * XP_PER.events +
    lifetime.transactions * XP_PER.transactions +
    Math.floor(lifetime.focusMinutes / MINUTES_PER_XP)
  );
}

export interface AchievementView {
  def: AchievementDef;
  unlocked: boolean;
  unlockedAt: number | null;
  /** How far along a measurable one is; null for the rest. */
  progress: { current: number; target: number } | null;
}

export interface AchievementState {
  xp: number;
  level: LevelProgress;
  streak: Streaks;
  achievements: AchievementView[];
  challenges: Record<ChallengePeriod, Challenge[]>;
  lifetime: Lifetime;
  /** Unlocked at some point and not yet shown to the person, oldest first. */
  unseen: Unlock[];
  /** Unlocked by this very call. */
  fresh: Unlock[];
}

interface AchievementUseCaseDeps {
  source: AchievementSource;
  unlocks: UnlockRepository;
  clock: Clock;
}

const MAX_ROUNDS = 4;

function toPeriodCounts(
  counts: Counters,
  days: readonly DateKey[],
  from: DateKey,
  to: DateKey,
): PeriodCounts {
  return { ...counts, activeDays: days.filter((day) => day >= from && day <= to).length };
}

function progressOf(
  def: AchievementDef,
  lifetime: Lifetime,
  streak: Streaks,
): AchievementView['progress'] {
  if (def.counter !== undefined && def.target !== undefined) {
    return { current: Math.min(lifetime[def.counter], def.target), target: def.target };
  }
  if (def.group === 'streak' && def.target !== undefined) {
    return { current: Math.min(streak.longest, def.target), target: def.target };
  }
  return null;
}

export function createAchievementUseCases({ source, unlocks, clock }: AchievementUseCaseDeps) {
  // Several things can ask for a check at once (start-up, a screen opening, a change elsewhere).
  let queue: Promise<unknown> = Promise.resolve();
  const serial = <T>(task: () => Promise<T>): Promise<T> => {
    const run = queue.then(task, task);
    queue = run.catch(() => undefined);
    return run;
  };

  async function evaluate(): Promise<AchievementState> {
    const now = clock.now();
    const today = toDateKey(now);
    const [lifetime, days, stored, peak] = await Promise.all([
      source.lifetime(),
      source.activeDays(),
      unlocks.all(),
      unlocks.peakXp(),
    ]);
    const streak = dayStreaks(new Set(days), today);

    // Challenges of this week and month, and of the ones just before in case the app was not
    // opened when they were finished.
    const periods = (['week', 'month'] as const).flatMap((period) => {
      const current = periodStart(period, today);
      const before = periodStart(period, addDaysToKey(current, -1));
      return [
        { period, start: current, current: true },
        { period, start: before, current: false },
      ];
    });
    const challenges = await Promise.all(
      periods.map(async ({ period, start, current }) => {
        const end = periodEnd(period, start);
        const counts = toPeriodCounts(await source.between(start, end), days, start, end);
        return { period, current, list: challengesFor(period, start, counts) };
      }),
    );

    const have = new Map(stored.map((unlock) => [unlock.key, unlock]));
    const fresh: Unlock[] = [];
    const unlock = (key: string, kind: Unlock['kind'], ref: string, xp: number) => {
      if (!have.has(key)) {
        const added: Unlock = { key, kind, ref, xp, unlockedAt: now, seen: false };
        have.set(key, added);
        fresh.push(added);
        return true;
      }
      return false;
    };

    const rewards = () => [...have.values()].reduce((total, entry) => total + entry.xp, 0);
    const base = activityXp(lifetime);

    // Level badges depend on XP, and unlocking gives XP, so settle it round by round.
    for (let round = 0; round < MAX_ROUNDS; round += 1) {
      const level = levelForXp(Math.max(peak, base + rewards())).level;
      let changed = false;
      for (const def of ALL_ACHIEVEMENTS) {
        const key = `${def.group}:${def.id}`;
        const reached =
          def.test !== undefined
            ? def.test(lifetime, { level })
            : def.group === 'streak'
              ? streak.longest >= (def.target ?? Infinity)
              : def.counter !== undefined && lifetime[def.counter] >= (def.target ?? Infinity);
        if (reached && unlock(key, def.group === 'streak' ? 'streak' : def.group, def.id, def.xp)) {
          changed = true;
        }
      }
      for (const { list } of challenges) {
        for (const challenge of list) {
          if (challenge.done && unlock(challenge.key, 'challenge', challenge.key, challenge.xp)) {
            changed = true;
          }
        }
      }
      if (!changed) {
        break;
      }
    }

    const xp = Math.max(peak, base + rewards());
    if (fresh.length > 0) {
      await unlocks.insertMissing(fresh);
    }
    if (xp > peak) {
      await unlocks.raisePeakXp(xp);
    }

    const achievements = ALL_ACHIEVEMENTS.map((def): AchievementView => {
      const stored = have.get(`${def.group}:${def.id}`);
      return {
        def,
        unlocked: stored !== undefined,
        unlockedAt: stored?.unlockedAt ?? null,
        progress: progressOf(def, lifetime, streak),
      };
    });

    return {
      xp,
      level: levelForXp(xp),
      streak,
      achievements,
      challenges: {
        week: challenges.find((entry) => entry.period === 'week' && entry.current)?.list ?? [],
        month: challenges.find((entry) => entry.period === 'month' && entry.current)?.list ?? [],
      },
      lifetime,
      unseen: [...have.values()]
        .filter((entry) => !entry.seen)
        .sort((a, b) => a.unlockedAt - b.unlockedAt),
      fresh,
    };
  }

  return {
    /** Looks at everything done so far, unlocks what has been earned and returns the state. */
    sync(): Promise<AchievementState> {
      return serial(evaluate);
    },

    markSeen(keys: readonly string[]): Promise<void> {
      return serial(() => unlocks.markSeen(keys));
    },
  };
}

export type AchievementUseCases = ReturnType<typeof createAchievementUseCases>;
