import { addDaysToKey, dateKeyToNoon, hasWeekday, type DateKey } from '@/core';
import { WEEKDAY_DISPLAY_ORDER, WEEKDAY_LABELS } from '@/components';

import type { Habit, HabitPeriod } from '../domain/entities';
import type { HabitSummary, UnitProgress, UnitState } from '../domain/progress';
import { ALL_WEEKDAYS } from '../domain/schedule';

const PERIOD_NOUN: Record<HabitPeriod, string> = { daily: 'day', weekly: 'week', monthly: 'month' };
const PERIOD_PHRASE: Record<HabitPeriod, string> = {
  daily: 'today',
  weekly: 'this week',
  monthly: 'this month',
};

export function periodNoun(period: HabitPeriod, count = 1): string {
  return count === 1 ? PERIOD_NOUN[period] : `${PERIOD_NOUN[period]}s`;
}

/** "Every day", "Mon, Wed, Fri", "Weekly" or "Monthly". */
export function describeFrequency(habit: Pick<Habit, 'period' | 'weekdays'>): string {
  if (habit.period === 'weekly') {
    return 'Weekly';
  }
  if (habit.period === 'monthly') {
    return 'Monthly';
  }
  if (habit.weekdays === ALL_WEEKDAYS) {
    return 'Every day';
  }
  return WEEKDAY_DISPLAY_ORDER.filter((day) => hasWeekday(habit.weekdays, day))
    .map((day) => WEEKDAY_LABELS[day])
    .join(', ');
}

/** "3 times per week" or "Once per day". */
export function describeGoal(habit: Pick<Habit, 'period' | 'goalCount'>): string {
  const unit = PERIOD_NOUN[habit.period];
  return habit.goalCount === 1 ? `Once per ${unit}` : `${habit.goalCount} times per ${unit}`;
}

/** "2 of 3 today". */
export function describeProgress(
  progress: Pick<UnitProgress, 'done' | 'goal'>,
  period: HabitPeriod,
) {
  return `${progress.done} of ${progress.goal} ${PERIOD_PHRASE[period]}`;
}

export function describeStreak(streak: number, period: HabitPeriod): string {
  return `${streak} ${periodNoun(period, streak)}`;
}

const STATE_LABEL: Record<UnitState, string> = {
  satisfied: 'Done',
  missed: 'Missed',
  excused: 'Skipped',
  pending: 'To do',
  off: 'Not scheduled',
};

export function describeState(state: UnitState): string {
  return STATE_LABEL[state];
}

/** Compact time such as "8:30 AM" from an HH:MM string, in the device's format. */
export function formatReminderTime(time: string): string {
  const [hour, minute] = time.split(':').map(Number);
  return new Date(2000, 0, 1, hour ?? 0, minute ?? 0).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** "Mon 5 Oct" for a day key. */
export function formatDay(key: DateKey): string {
  return new Date(dateKeyToNoon(key)).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

/** "Today", "Yesterday" or the formatted day. */
export function formatRelativeDay(key: DateKey, today: DateKey): string {
  if (key === today) {
    return 'Today';
  }
  return key === addDaysToKey(today, -1) ? 'Yesterday' : formatDay(key);
}

export function shortMonth(key: DateKey): string {
  return new Date(dateKeyToNoon(key)).toLocaleDateString(undefined, { month: 'short' });
}

/** Accessible one-sentence summary of a habit for screen readers. */
export function describeHabit(summary: HabitSummary): string {
  const { habit, current, streak } = summary;
  const parts = [habit.name, describeProgress(current, habit.period)];
  if (habit.paused) {
    parts.push('paused');
  }
  if (summary.skippedToday) {
    parts.push('skipped today');
  }
  if (streak > 0) {
    parts.push(`${describeStreak(streak, habit.period)} streak`);
  }
  if (habit.category) {
    parts.push(`category ${habit.category.name}`);
  }
  return parts.join(', ');
}
