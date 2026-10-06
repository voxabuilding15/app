import { addDaysToKey, dateKeyToNoon, hasWeekday, type DateKey } from '@/core';
import { WEEKDAY_DISPLAY_ORDER } from '@/components';
import { appLocale, weekdayName } from '@/i18n/formatting';

import type { Habit, HabitPeriod } from '../domain/entities';
import type { HabitSummary, UnitProgress, UnitState } from '../domain/progress';
import { ALL_WEEKDAYS } from '../domain/schedule';
import { msg } from '@/i18n/msg';
import { currentTranslator } from '@/i18n/translate';
import { translatedLabels } from '@/i18n/labels';

const PERIOD_PHRASE: Record<HabitPeriod, string> = translatedLabels({
  daily: msg('{done} of {goal} today'),
  weekly: msg('{done} of {goal} this week'),
  monthly: msg('{done} of {goal} this month'),
});

const GOAL_PER: Record<HabitPeriod, string> = translatedLabels({
  daily: msg('Goal per day'),
  weekly: msg('Goal per week'),
  monthly: msg('Goal per month'),
});

/** The label of the goal field: "Goal per day", "Goal per week" or "Goal per month". */
export function goalPerLabel(period: HabitPeriod): string {
  return currentTranslator().t(GOAL_PER[period]);
}

/** "Every day", "Mon, Wed, Fri", "Weekly" or "Monthly". */
export function describeFrequency(habit: Pick<Habit, 'period' | 'weekdays'>): string {
  const { t } = currentTranslator();
  if (habit.period === 'weekly') {
    return t('Weekly');
  }
  if (habit.period === 'monthly') {
    return t('Monthly');
  }
  if (habit.weekdays === ALL_WEEKDAYS) {
    return t('Every day');
  }
  return WEEKDAY_DISPLAY_ORDER.filter((day) => hasWeekday(habit.weekdays, day))
    .map((day) => weekdayName(day))
    .join(', ');
}

/** "3 times a week" or "Once a day". */
export function describeGoal(habit: Pick<Habit, 'period' | 'goalCount'>): string {
  const { t, tn } = currentTranslator();
  const { goalCount } = habit;
  if (goalCount === 1) {
    return t(
      { daily: msg('Once a day'), weekly: msg('Once a week'), monthly: msg('Once a month') }[
        habit.period
      ],
    );
  }
  switch (habit.period) {
    case 'daily':
      return tn(goalCount, '{count} time a day', '{count} times a day');
    case 'weekly':
      return tn(goalCount, '{count} time a week', '{count} times a week');
    default:
      return tn(goalCount, '{count} time a month', '{count} times a month');
  }
}

/** "2 of 3 today". */
export function describeProgress(
  progress: Pick<UnitProgress, 'done' | 'goal'>,
  period: HabitPeriod,
) {
  return currentTranslator().t(PERIOD_PHRASE[period], { done: progress.done, goal: progress.goal });
}

export function describeStreak(streak: number, period: HabitPeriod): string {
  const { tn } = currentTranslator();
  switch (period) {
    case 'daily':
      return tn(streak, '{count} day', '{count} days');
    case 'weekly':
      return tn(streak, '{count} week', '{count} weeks');
    default:
      return tn(streak, '{count} month', '{count} months');
  }
}

const STATE_LABEL: Record<UnitState, string> = translatedLabels({
  satisfied: msg('Done'),
  missed: msg('Missed'),
  excused: msg('Skipped'),
  pending: msg('To do'),
  off: msg('Not scheduled'),
});

export function describeState(state: UnitState): string {
  return STATE_LABEL[state];
}

/** Compact time such as "8:30 AM" from an HH:MM string, in the device's format. */
export function formatReminderTime(time: string): string {
  const [hour, minute] = time.split(':').map(Number);
  return new Date(2000, 0, 1, hour ?? 0, minute ?? 0).toLocaleTimeString(appLocale(), {
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** "Mon 5 Oct" for a day key. */
export function formatDay(key: DateKey): string {
  return new Date(dateKeyToNoon(key)).toLocaleDateString(appLocale(), {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

/** "Today", "Yesterday" or the formatted day. */
export function formatRelativeDay(key: DateKey, today: DateKey): string {
  const { t } = currentTranslator();
  if (key === today) {
    return t('Today');
  }
  return key === addDaysToKey(today, -1) ? t('Yesterday') : formatDay(key);
}

export function shortMonth(key: DateKey): string {
  return new Date(dateKeyToNoon(key)).toLocaleDateString(appLocale(), { month: 'short' });
}

/** Accessible one-sentence summary of a habit for screen readers. */
export function describeHabit(summary: HabitSummary): string {
  const { t } = currentTranslator();
  const { habit, current, streak } = summary;
  const parts = [habit.name, describeProgress(current, habit.period)];
  if (habit.paused) {
    parts.push(t('paused'));
  }
  if (summary.skippedToday) {
    parts.push(t('skipped today'));
  }
  if (streak > 0) {
    parts.push(t('{streak} streak', { streak: describeStreak(streak, habit.period) }));
  }
  if (habit.category) {
    parts.push(t('category {name}', { name: habit.category.name }));
  }
  return parts.join(', ');
}
