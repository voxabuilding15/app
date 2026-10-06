import type { Clock } from '@/core';

import { buildAlertPlan } from './alerts';
import type { SessionRecord } from './entities';
import type {
  AlertOutcome,
  PhaseAlerts,
  SessionRepository,
  SettingsStore,
  TimerStore,
} from './ports';
import {
  normalizeSettings,
  validateSettings,
  type PomodoroSettings,
  type SettingsErrors,
} from './settings';
import {
  finishPhase,
  isActive,
  nextPhase,
  pauseTimer,
  reconcile,
  resumeTimer,
  startPhase,
  wantsAutoStart,
  type SessionEntry,
  type SessionLinks,
  type TimerKind,
  type TimerState,
} from './timer';

export interface TimerResult {
  state: TimerState;
  /** Phases that ran out on their own since the last call. */
  completed: TimerKind[];
  /** History entries written by this call. */
  saved: number;
  alerts: AlertOutcome;
}

interface TimerUseCaseDeps {
  timers: TimerStore;
  settings: SettingsStore;
  sessions: SessionRepository;
  alerts: PhaseAlerts;
  clock: Clock;
}

export type SaveSettingsResult = { ok: true } | { ok: false; errors: SettingsErrors };

function toRecord(entry: SessionEntry): SessionRecord {
  return {
    // Derived from when the phase started, so saving the same phase twice cannot duplicate it.
    id: `${entry.startedAt.toString(36)}-${entry.kind}`,
    kind: entry.kind,
    plannedSeconds: entry.plannedSeconds,
    durationSeconds: entry.durationSeconds,
    startedAt: entry.startedAt,
    endedAt: entry.endedAt,
    outcome: entry.outcome,
    pauses: entry.pauses,
    deepFocus: entry.deepFocus,
    note: entry.links.note.trim(),
    taskId: entry.links.taskId,
    habitId: entry.links.habitId,
    tagIds: [...new Set(entry.links.tagIds)],
  };
}

export function createTimerUseCases({
  timers,
  settings: settingsStore,
  sessions,
  alerts,
  clock,
}: TimerUseCaseDeps) {
  // Actions can arrive together (a tick, a notification button and a tap), so they run one by one.
  let queue: Promise<unknown> = Promise.resolve();
  const serial = <T>(task: () => Promise<T>): Promise<T> => {
    const run = queue.then(task, task);
    queue = run.catch(() => undefined);
    return run;
  };

  /**
   * Catches the stored timer up with the clock, lets `change` act on it, saves any finished phases
   * and puts the right alerts on the shade.
   */
  function act(
    change: (
      state: TimerState,
      now: number,
      settings: PomodoroSettings,
    ) => { state: TimerState; entries?: SessionEntry[] },
    options: { refreshAlerts?: boolean } = {},
  ): Promise<TimerResult> {
    return serial(async () => {
      const now = clock.now();
      const settings = settingsStore.read();
      const stored = timers.read();
      const caught = reconcile(stored, now, settings);
      const changed = change(caught.state, now, settings);
      const entries = [...caught.entries, ...(changed.entries ?? [])];

      for (const entry of entries) {
        await sessions.insert(toRecord(entry));
      }
      const different = JSON.stringify(changed.state) !== JSON.stringify(stored);
      if (different) {
        timers.write(changed.state);
      }
      const alertOutcome =
        different || entries.length > 0 || options.refreshAlerts
          ? await alerts
              .sync(buildAlertPlan(changed.state, settings))
              .catch((): AlertOutcome => 'none')
          : 'none';
      return {
        state: changed.state,
        completed: caught.completed,
        saved: entries.length,
        alerts: alertOutcome,
      };
    });
  }

  /** The state after the clock has moved on, ready for any action to build on. */
  const advance = (
    finished: { next: { kind: TimerKind; cycle: number } },
    from: TimerState,
  ): TimerState => ({
    status: 'idle',
    kind: finished.next.kind,
    cycle: finished.next.cycle,
    links: from.kind === 'focus' ? { ...from.links, note: '' } : from.links,
  });

  return {
    /** The stored timer, as last saved (see `sync` to bring it up to date). */
    peek(): TimerState {
      return timers.read();
    },

    /** Applies any phase ends that happened while the app was closed or in the background. */
    sync(refreshAlerts = false): Promise<TimerResult> {
      return act((state) => ({ state }), { refreshAlerts });
    },

    /** Starts the waiting phase, or a chosen one. Does nothing while a phase is running. */
    start(kind?: TimerKind): Promise<TimerResult> {
      return act((state, now, settings) =>
        isActive(state)
          ? { state }
          : { state: startPhase(state, kind ?? state.kind, now, settings) },
      );
    },

    /** Chooses which phase is waiting to start. Does nothing while one is running. */
    select(kind: TimerKind): Promise<TimerResult> {
      return act((state) => (isActive(state) ? { state } : { state: { ...state, kind } }));
    },

    pause(): Promise<TimerResult> {
      return act((state, now) => ({ state: pauseTimer(state, now) }));
    },

    resume(): Promise<TimerResult> {
      return act((state, now) => ({ state: resumeTimer(state, now) }));
    },

    /** Moves on to the next phase now; a skipped focus session is saved as skipped. */
    skip(): Promise<TimerResult> {
      return act((state, now, settings) => {
        if (!isActive(state)) {
          const next = nextPhase(state.kind, state.cycle, 'skipped', settings);
          return { state: { ...state, kind: next.kind, cycle: next.cycle } };
        }
        const finished = finishPhase(state, now, 'skipped', settings);
        const resting = advance(finished, state);
        return {
          state: wantsAutoStart(state.kind, settings)
            ? startPhase(resting, finished.next.kind, now, settings)
            : resting,
          entries: finished.entry ? [finished.entry] : [],
        };
      });
    },

    /** Abandons the running phase, keeping the time already spent, and returns to a fresh start. */
    stop(): Promise<TimerResult> {
      return act((state, now, settings) => {
        if (!isActive(state)) {
          return { state };
        }
        const finished = finishPhase(state, now, 'stopped', settings);
        return { state: advance(finished, state), entries: finished.entry ? [finished.entry] : [] };
      });
    },

    /** Changes what the current or next focus session is about. */
    setLinks(changes: Partial<SessionLinks>): Promise<TimerResult> {
      return act((state) => ({ state: { ...state, links: { ...state.links, ...changes } } }));
    },

    settings(): PomodoroSettings {
      return settingsStore.read();
    },

    /** Saves new settings. A running phase keeps the length it started with. */
    async saveSettings(next: PomodoroSettings): Promise<SaveSettingsResult> {
      const errors = validateSettings(next);
      if (Object.keys(errors).length > 0) {
        return { ok: false, errors };
      }
      settingsStore.write(normalizeSettings(next));
      await refreshAfterSettings();
      return { ok: true };
    },
  };

  async function refreshAfterSettings(): Promise<void> {
    await act((state) => ({ state }), { refreshAlerts: true });
  }
}

export type TimerUseCases = ReturnType<typeof createTimerUseCases>;
