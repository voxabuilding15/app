import { hasWeekday, weekdayOfKey, type DateKey } from '@/core';

import type { Habit, HabitPeriod } from './entities';

export const ALL_WEEKDAYS = 0b1111111;

export type FrequencyPreset = 'daily' | 'weekly' | 'monthly' | 'custom';

export const FREQUENCY_PRESETS: readonly FrequencyPreset[] = [
  'daily',
  'weekly',
  'monthly',
  'custom',
];

type Frequency = Pick<Habit, 'period' | 'weekdays'>;

/** Custom frequency is a daily habit scheduled on only some weekdays. */
export function presetOf({ period, weekdays }: Frequency): FrequencyPreset {
  if (period === 'daily') {
    return weekdays === ALL_WEEKDAYS ? 'daily' : 'custom';
  }
  return period;
}

export function frequencyForPreset(
  preset: FrequencyPreset,
  current: Frequency,
): { period: HabitPeriod; weekdays: number } {
  switch (preset) {
    case 'weekly':
      return { period: 'weekly', weekdays: ALL_WEEKDAYS };
    case 'monthly':
      return { period: 'monthly', weekdays: ALL_WEEKDAYS };
    case 'custom':
      // Start from a sensible default (weekdays) rather than an invalid empty selection.
      return {
        period: 'daily',
        weekdays: presetOf(current) === 'custom' ? current.weekdays : 0b0111110,
      };
    default:
      return { period: 'daily', weekdays: ALL_WEEKDAYS };
  }
}

/** Whether the habit is expected on this day. Weekly and monthly habits can be done any day. */
export function isScheduledOn(habit: Frequency, day: DateKey): boolean {
  return habit.period !== 'daily' || hasWeekday(habit.weekdays, weekdayOfKey(day));
}

/** JS weekdays (Sunday = 0) on which a reminder should fire. */
export function reminderWeekdays(habit: Frequency): number[] {
  const all = [0, 1, 2, 3, 4, 5, 6];
  return habit.period === 'daily' ? all.filter((day) => hasWeekday(habit.weekdays, day)) : all;
}
