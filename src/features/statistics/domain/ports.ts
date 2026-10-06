import type { CategoryTotal, FlowTotals } from '../../finance/domain/entities';
import type { TimeRange } from '../../finance/domain/filters';
import type { EventEntry } from '../../calendar/domain/entities';
import type { HabitEntry } from '../../habits/domain/entities';
import type { FocusRow } from '../../pomodoro/domain/entities';

import type { TimeSpan } from './range';

export interface DueTask {
  dueAt: number;
  completed: boolean;
}

/** What the report needs to know about tasks, always for the instants in `span`. */
export interface TaskSource {
  completedAt(span: TimeSpan): Promise<number[]>;
  createdAt(span: TimeSpan): Promise<number[]>;
  dueIn(span: TimeSpan): Promise<DueTask[]>;
}

interface HabitSource {
  entries(): Promise<HabitEntry[]>;
}

interface EventSource {
  listInRange(from: number, to: number): Promise<EventEntry[]>;
}

interface FocusSource {
  listFocus(from: number, to: number): Promise<FocusRow[]>;
}

interface MoneySource {
  flow(range: TimeRange): Promise<FlowTotals>;
  categoryTotals(type: 'income' | 'expense', range: TimeRange): Promise<CategoryTotal[]>;
  currency(): string;
}

export interface NoteSource {
  createdAt(span: TimeSpan): Promise<number[]>;
  updatedAt(span: TimeSpan): Promise<number[]>;
  /** Notes that are not archived or in the trash. */
  activeCount(): Promise<number>;
}

export interface StatsSources {
  tasks: TaskSource;
  habits: HabitSource;
  events: EventSource;
  focus: FocusSource;
  money: MoneySource;
  notes: NoteSource;
}
