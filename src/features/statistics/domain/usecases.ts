import { toDateKey, type Clock, type DateKey } from '@/core';

import { rankCategories, type CategorySlice } from '../../finance/domain/stats';

import type { StatsSources } from './ports';
import {
  bucketsFor,
  periodRange,
  previousRange,
  toSpan,
  type DayRange,
  type StatsPeriod,
} from './range';
import {
  computeSlice,
  metricsFor,
  seriesFor,
  type Facts,
  type Metric,
  type SeriesPoint,
  type Slice,
} from './report';

const TOP_CATEGORIES = 5;

export interface FinanceFigures {
  incomeMinor: number;
  expenseMinor: number;
  netMinor: number;
  /** Share of income that was not spent; null without income. */
  savingsRate: number | null;
  topCategories: CategorySlice[];
}

export interface StatsReport {
  period: StatsPeriod;
  anchor: DateKey;
  range: DayRange;
  previousRange: DayRange;
  generatedAt: number;
  currency: string;
  current: Slice;
  previous: Slice;
  finance: FinanceFigures;
  previousFinance: FinanceFigures;
  series: Partial<Record<Metric, SeriesPoint[]>>;
  /** Spending per bucket, in minor units. */
  spending: SeriesPoint[];
  totals: { activeNotes: number };
}

interface StatsUseCaseDeps {
  sources: StatsSources;
  clock: Clock;
}

export function createStatsUseCases({ sources, clock }: StatsUseCaseDeps) {
  async function financeFor(range: DayRange, withCategories: boolean): Promise<FinanceFigures> {
    const span = toSpan(range);
    const [flow, categories] = await Promise.all([
      sources.money.flow(span),
      withCategories ? sources.money.categoryTotals('expense', span) : Promise.resolve([]),
    ]);
    const net = flow.incomeMinor - flow.expenseMinor;
    return {
      incomeMinor: flow.incomeMinor,
      expenseMinor: flow.expenseMinor,
      netMinor: net,
      savingsRate: flow.incomeMinor > 0 ? net / flow.incomeMinor : null,
      topCategories: rankCategories(categories, TOP_CATEGORIES),
    };
  }

  return {
    /** Figures for the day, week, month or year containing `anchor`, and the period before it. */
    async report(period: StatsPeriod, anchor: DateKey): Promise<StatsReport> {
      const now = clock.now();
      const range = periodRange(period, anchor);
      const before = previousRange(period, anchor);
      const span = { from: toSpan(before).from, to: toSpan(range).to };

      const [
        tasksCompleted,
        tasksCreated,
        tasksDue,
        habits,
        events,
        focus,
        notesCreated,
        notesUpdated,
        activeNotes,
      ] = await Promise.all([
        sources.tasks.completedAt(span),
        sources.tasks.createdAt(span),
        sources.tasks.dueIn(span),
        sources.habits.entries(),
        sources.events.listInRange(span.from, span.to),
        sources.focus.listFocus(span.from, span.to),
        sources.notes.createdAt(span),
        sources.notes.updatedAt(span),
        sources.notes.activeCount(),
      ]);

      const facts: Facts = {
        now,
        today: toDateKey(now),
        tasksCompleted,
        tasksCreated,
        tasksDue,
        habits,
        events,
        focus,
        notesCreated,
        notesUpdated,
      };

      const series: StatsReport['series'] = {};
      for (const metric of metricsFor(period)) {
        series[metric] = seriesFor(metric, period, anchor, facts);
      }
      const spending: SeriesPoint[] = [];
      for (const bucket of bucketsFor(period, anchor)) {
        spending.push({ bucket, value: (await sources.money.flow(bucket.span)).expenseMinor });
      }

      const [finance, previousFinance] = await Promise.all([
        financeFor(range, true),
        financeFor(before, false),
      ]);

      return {
        period,
        anchor,
        range,
        previousRange: before,
        generatedAt: now,
        currency: sources.money.currency(),
        current: computeSlice(facts, range),
        previous: computeSlice(facts, before),
        finance,
        previousFinance,
        series,
        spending,
        totals: { activeNotes },
      };
    },
  };
}

export type StatsUseCases = ReturnType<typeof createStatsUseCases>;
