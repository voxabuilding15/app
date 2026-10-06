import { dateKeyToNoon, formatMoney, toAmountText } from '@/core';

import type { StatsReport } from './usecases';

/** The words a report needs: translated text and the locale to format dates in. */
export interface Words {
  t: (text: string, vars?: Record<string, string | number>) => string;
  locale: string;
}

type Unit = 'count' | 'percent' | 'score' | 'hours' | 'minutes' | 'money';

interface SummaryRow {
  label: string;
  unit: Unit;
  /** Number for spreadsheets; money is in major units. Null when there is nothing to report. */
  raw: number | null;
  previousRaw: number | null;
  display: string;
  previousDisplay: string;
}

export interface SummarySection {
  title: string;
  rows: SummaryRow[];
}

const DASH = '–';

/** "1h 25m", "45m" or "0m". */
export function formatMinutes(minutes: number): string {
  const rounded = Math.round(minutes);
  const hours = Math.floor(rounded / 60);
  if (hours === 0) {
    return `${rounded}m`;
  }
  return rounded % 60 === 0 ? `${hours}h` : `${hours}h ${rounded % 60}m`;
}

export function weekdayName(weekday: number, locale: string): string {
  // 2023-01-01 was a Sunday, so `weekday` days later is that weekday.
  return new Date(dateKeyToNoon(`2023-01-0${weekday + 1}`)).toLocaleDateString(locale, {
    weekday: 'long',
  });
}

function row(
  label: string,
  unit: Unit,
  raw: number | null,
  previousRaw: number | null,
  show: (value: number) => string,
  rawOf: (value: number) => number = (value) => value,
): SummaryRow {
  return {
    label,
    unit,
    raw: raw === null ? null : rawOf(raw),
    previousRaw: previousRaw === null ? null : rawOf(previousRaw),
    display: raw === null ? DASH : show(raw),
    previousDisplay: previousRaw === null ? DASH : show(previousRaw),
  };
}

/** The headline figures of a report as labelled rows, shared by the screen and the exports. */
export function summarize(report: StatsReport, { t, locale }: Words): SummarySection[] {
  const { current: now, previous: before, finance, previousFinance, currency } = report;
  const count = (value: number) => String(value);
  const percent = (value: number) => `${Math.round(value * 100)}%`;
  const score = (value: number) => String(value);
  const money = (value: number) => formatMoney(value, currency);
  const majorUnits = (value: number) => Number(toAmountText(value, currency, true));

  return [
    {
      title: t('Scores'),
      rows: [
        row(
          t('Productivity score'),
          'score',
          now.scores.productivity,
          before.scores.productivity,
          score,
        ),
        row(t('Focus score'), 'score', now.scores.focus, before.scores.focus, score),
        row(
          t('Habit consistency'),
          'percent',
          now.scores.habits,
          before.scores.habits,
          (v) => `${v}%`,
        ),
        row(
          t('Task completion rate'),
          'percent',
          now.scores.tasks,
          before.scores.tasks,
          (v) => `${v}%`,
        ),
      ],
    },
    {
      title: t('Tasks'),
      rows: [
        row(t('Completed'), 'count', now.tasks.completed, before.tasks.completed, count),
        row(t('Created'), 'count', now.tasks.created, before.tasks.created, count),
        row(t('Overdue'), 'count', now.tasks.overdue, before.tasks.overdue, count),
      ],
    },
    {
      title: t('Habits'),
      rows: [
        row(t('Check-ins'), 'count', now.habits.completions, before.habits.completions, count),
        row(t('Goals met'), 'count', now.habits.met, before.habits.met, count),
        row(t('Goals missed'), 'count', now.habits.missed, before.habits.missed, count),
      ],
    },
    {
      title: t('Focus'),
      rows: [
        row(
          t('Focus time'),
          'minutes',
          now.focus.seconds / 60,
          before.focus.seconds / 60,
          formatMinutes,
        ),
        row(t('Sessions'), 'count', now.focus.sessions, before.focus.sessions, count),
        row(
          t('Completed sessions'),
          'count',
          now.focus.completedSessions,
          before.focus.completedSessions,
          count,
        ),
      ],
    },
    {
      title: t('Calendar'),
      rows: [
        row(t('Events'), 'count', now.calendar.events, before.calendar.events, count),
        row(
          t('Scheduled time'),
          'hours',
          now.calendar.hours,
          before.calendar.hours,
          (v) => formatMinutes(v * 60),
          (v) => Math.round(v * 100) / 100,
        ),
        row(
          t('Days with events'),
          'count',
          now.calendar.daysWithEvents,
          before.calendar.daysWithEvents,
          count,
        ),
        row(
          t('Calendar usage'),
          'percent',
          now.calendar.usage,
          before.calendar.usage,
          percent,
          (v) => Math.round(v * 100),
        ),
        {
          label: t('Busiest weekday'),
          unit: 'count',
          raw: now.calendar.busiestWeekday,
          previousRaw: before.calendar.busiestWeekday,
          display:
            now.calendar.busiestWeekday === null
              ? DASH
              : weekdayName(now.calendar.busiestWeekday, locale),
          previousDisplay:
            before.calendar.busiestWeekday === null
              ? DASH
              : weekdayName(before.calendar.busiestWeekday, locale),
        },
      ],
    },
    {
      title: t('Finance'),
      rows: [
        row(
          t('Income'),
          'money',
          finance.incomeMinor,
          previousFinance.incomeMinor,
          money,
          majorUnits,
        ),
        row(
          t('Spending'),
          'money',
          finance.expenseMinor,
          previousFinance.expenseMinor,
          money,
          majorUnits,
        ),
        row(t('Net'), 'money', finance.netMinor, previousFinance.netMinor, money, majorUnits),
        row(
          t('Savings rate'),
          'percent',
          finance.savingsRate,
          previousFinance.savingsRate,
          percent,
          (v) => Math.round(v * 100),
        ),
      ],
    },
    {
      title: t('Notes'),
      rows: [
        row(t('Created'), 'count', now.notes.created, before.notes.created, count),
        row(t('Edited'), 'count', now.notes.updated, before.notes.updated, count),
        row(t('Active notes'), 'count', report.totals.activeNotes, null, count),
      ],
    },
  ];
}
