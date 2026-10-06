import { addDaysToKey, startOfWeekKey, type DateKey } from '@/core';

import type { CounterId, PeriodCounts } from './entities';

export type ChallengePeriod = 'week' | 'month';

export type ChallengeCounter = CounterId | 'activeDays';

export interface ChallengeTemplate {
  id: string;
  /** English text with `{count}`; the screens translate it. */
  title: string;
  counter: ChallengeCounter;
  week: number;
  month: number;
}

/** A challenge is measured by one counter over the week or month. */
export const CHALLENGE_TEMPLATES: readonly ChallengeTemplate[] = [
  { id: 'tasks', title: 'Complete {count} tasks', counter: 'tasks', week: 10, month: 40 },
  {
    id: 'focus',
    title: 'Focus for {count} minutes',
    counter: 'focusMinutes',
    week: 180,
    month: 720,
  },
  {
    id: 'habits',
    title: 'Check in {count} times on your habits',
    counter: 'checkIns',
    week: 15,
    month: 60,
  },
  { id: 'active', title: 'Be active on {count} days', counter: 'activeDays', week: 5, month: 20 },
  { id: 'notes', title: 'Write {count} notes', counter: 'notes', week: 3, month: 10 },
  {
    id: 'money',
    title: 'Record {count} transactions',
    counter: 'transactions',
    week: 5,
    month: 20,
  },
  { id: 'events', title: 'Schedule {count} events', counter: 'events', week: 4, month: 15 },
  {
    id: 'sessions',
    title: 'Finish {count} focus sessions',
    counter: 'focusSessions',
    week: 5,
    month: 20,
  },
];

const PICKS: Record<ChallengePeriod, number> = { week: 3, month: 2 };
export const CHALLENGE_XP: Record<ChallengePeriod, number> = { week: 60, month: 200 };

export interface Challenge {
  key: string;
  period: ChallengePeriod;
  /** First day of the week or month this challenge belongs to. */
  periodKey: DateKey;
  template: ChallengeTemplate;
  target: number;
  progress: number;
  done: boolean;
  xp: number;
}

/** Same text always gives the same number, so a period always has the same challenges. */
function hash(text: string): number {
  let value = 5381;
  for (let index = 0; index < text.length; index += 1) {
    value = ((value << 5) + value + text.charCodeAt(index)) | 0;
  }
  return value >>> 0;
}

/** The first day of the week (Monday) or month that contains `day`. */
export function periodStart(period: ChallengePeriod, day: DateKey): DateKey {
  return period === 'week' ? startOfWeekKey(day) : `${day.slice(0, 7)}-01`;
}

/** The last day of that week or month. */
export function periodEnd(period: ChallengePeriod, start: DateKey): DateKey {
  if (period === 'week') {
    return addDaysToKey(start, 6);
  }
  const [year, month] = start.split('-').map(Number) as [number, number];
  const last = new Date(year, month, 0).getDate();
  return `${start.slice(0, 7)}-${String(last).padStart(2, '0')}`;
}

/** Which templates are in play for the week or month that starts on `start`. */
export function templatesFor(period: ChallengePeriod, start: DateKey): ChallengeTemplate[] {
  return [...CHALLENGE_TEMPLATES]
    .sort(
      (a, b) =>
        hash(`${period}:${start}:${a.id}`) - hash(`${period}:${start}:${b.id}`) ||
        a.id.localeCompare(b.id),
    )
    .slice(0, PICKS[period]);
}

export function challengesFor(
  period: ChallengePeriod,
  start: DateKey,
  counts: PeriodCounts,
): Challenge[] {
  return templatesFor(period, start).map((template) => {
    const target = template[period];
    const progress = counts[template.counter];
    return {
      key: `challenge:${period}:${start}:${template.id}`,
      period,
      periodKey: start,
      template,
      target,
      progress,
      done: progress >= target,
      xp: CHALLENGE_XP[period],
    };
  });
}
