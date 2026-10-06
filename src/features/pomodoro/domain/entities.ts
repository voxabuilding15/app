import type { Category } from '@/core';

import type { SessionOutcome, TimerKind } from './timer';

/** A history entry as stored. */
export interface SessionRecord {
  id: string;
  kind: TimerKind;
  plannedSeconds: number;
  durationSeconds: number;
  startedAt: number;
  endedAt: number;
  outcome: SessionOutcome;
  pauses: number;
  /** 0 to 100 for focus sessions; null for breaks. */
  deepFocus: number | null;
  note: string;
  taskId: string | null;
  habitId: string | null;
  tagIds: string[];
}

interface LinkRef {
  id: string;
  title: string;
}

/** A history entry as shown, with the names of what it is linked to. */
export interface Session extends Omit<SessionRecord, 'tagIds' | 'taskId' | 'habitId'> {
  task: LinkRef | null;
  habit: LinkRef | null;
  tags: Category[];
}

/** The slice of a focus session that statistics need. */
export interface FocusRow {
  startedAt: number;
  durationSeconds: number;
  plannedSeconds: number;
  outcome: SessionOutcome;
  deepFocus: number | null;
}

export interface LinkTotal {
  kind: 'task' | 'habit';
  id: string;
  title: string;
  seconds: number;
}

/** What a session can be linked to. */
export interface LinkTarget {
  id: string;
  title: string;
}

export type HistoryScope = 'focus' | 'breaks' | 'all';

export interface HistoryQuery {
  scope: HistoryScope;
  search: string;
}
