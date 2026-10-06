import type {
  FocusRow,
  HistoryQuery,
  LinkTarget,
  LinkTotal,
  Session,
  SessionRecord,
} from './entities';
import type { PomodoroSettings } from './settings';
import type { TimerState } from './timer';

export interface SessionRepository {
  insert(record: SessionRecord): Promise<void>;
  get(id: string): Promise<SessionRecord | null>;
  list(query: HistoryQuery, limit: number): Promise<Session[]>;
  updateDetails(
    id: string,
    details: Pick<SessionRecord, 'note' | 'taskId' | 'habitId' | 'tagIds'>,
  ): Promise<void>;
  delete(id: string): Promise<void>;
  /** Focus sessions that started in [from, to), for statistics. */
  listFocus(from: number, to: number): Promise<FocusRow[]>;
  /** Focus time per linked task and habit in [from, to), longest first. */
  linkTotals(from: number, to: number, limit: number): Promise<LinkTotal[]>;
}

/** Keeps the timer across app restarts. */
export interface TimerStore {
  read(): TimerState;
  write(state: TimerState): void;
}

export interface SettingsStore {
  read(): PomodoroSettings;
  write(settings: PomodoroSettings): void;
}

/** Tasks and habits a session can be linked to. */
export interface LinkTargets {
  tasks(): Promise<LinkTarget[]>;
  habits(): Promise<LinkTarget[]>;
}

interface AlertBoundary {
  at: number;
  title: string;
  body: string;
}

interface LiveStatus {
  title: string;
  body: string;
  paused: boolean;
}

/** What should be on the notification shade for the running timer. */
export interface AlertPlan {
  /** Alerts for the moments a phase ends, in time order. */
  boundaries: AlertBoundary[];
  /** The ongoing notification with timer controls. */
  live: LiveStatus;
  /** Ring through the alarm channel. */
  exact: boolean;
}

export type AlertOutcome = 'none' | 'scheduled' | 'blocked';

/** Puts the plan on the notification shade, replacing whatever the previous plan left there. */
export interface PhaseAlerts {
  /** Null clears everything. */
  sync(plan: AlertPlan | null): Promise<AlertOutcome>;
}
