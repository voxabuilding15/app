import { addDaysToKey, daysBetweenKeys, type Database, type DateKey } from '@/core';
import { SqliteHabitRepository } from '@/features/habits/data/sqlite-habit-repository';
import { createEvaluator } from '@/features/habits/domain/progress';
import { isScheduledOn } from '@/features/habits/domain/schedule';

import { dayBounds, type HabitDayStatus, type HabitItem } from '../domain/items';
import type { HabitAgendaSource } from '../domain/ports';

/**
 * Presents active habits as all-day items. Daily habits appear on their scheduled days; weekly and
 * monthly habits appear only on days with something logged.
 */
export class SqliteHabitAgendaSource implements HabitAgendaSource {
  private readonly habits: SqliteHabitRepository;

  constructor(db: Database) {
    this.habits = new SqliteHabitRepository(db);
  }

  async between(from: DateKey, to: DateKey, today: DateKey): Promise<HabitItem[]> {
    const items: HabitItem[] = [];
    const length = daysBetweenKeys(from, to) + 1;

    for (const entry of await this.habits.list('active')) {
      const { habit } = entry;
      if (habit.paused) {
        continue;
      }
      const evaluator = createEvaluator(habit, entry, today);
      const history = evaluator.heatmap(from, to);
      const goal = habit.period === 'daily' ? habit.goalCount : 1;

      for (let i = 0; i < length; i += 1) {
        const date = addDaysToKey(from, i);
        const day = history[i];
        let status: HabitDayStatus | null = null;

        if (date > today) {
          status =
            habit.period === 'daily' && date >= habit.startDate && isScheduledOn(habit, date)
              ? 'pending'
              : null;
        } else if (
          day?.status === 'done' ||
          day?.status === 'partial' ||
          day?.status === 'skipped'
        ) {
          status = day.status;
        } else if (day?.status === 'none' && habit.period === 'daily') {
          status = date === today ? 'pending' : 'missed';
        }
        if (status === null) {
          continue;
        }
        const { start, end } = dayBounds(date);
        items.push({
          kind: 'habit',
          key: `habit:${habit.id}:${date}`,
          habitId: habit.id,
          title: habit.name,
          icon: habit.icon,
          color: habit.color,
          date,
          status,
          count: day?.count ?? 0,
          goal,
          start,
          end,
          allDay: true,
        });
      }
    }
    return items;
  }
}
