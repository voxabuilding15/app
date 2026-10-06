import { MINUTE_MS } from '@/core';

import type { PomodoroSettings } from './settings';

export type TimerKind = 'focus' | 'short_break' | 'long_break';
export type SessionOutcome = 'completed' | 'stopped' | 'skipped';

/** What a session is about: set before or during a focus session and saved with it. */
export interface SessionLinks {
  taskId: string | null;
  habitId: string | null;
  tagIds: string[];
  note: string;
}

export const NO_LINKS: SessionLinks = { taskId: null, habitId: null, tagIds: [], note: '' };

/**
 * The timer is stored as absolute times, never as a countdown, so it keeps running correctly
 * while the app is in the background or closed: the time left is always `endsAt - now`.
 */
export type TimerState =
  | { status: 'idle'; kind: TimerKind; cycle: number; links: SessionLinks }
  | {
      status: 'running';
      kind: TimerKind;
      cycle: number;
      startedAt: number;
      endsAt: number;
      durationMs: number;
      pauses: number;
      links: SessionLinks;
    }
  | {
      status: 'paused';
      kind: TimerKind;
      cycle: number;
      startedAt: number;
      remainingMs: number;
      durationMs: number;
      pauses: number;
      links: SessionLinks;
    };

export const IDLE_STATE: TimerState = { status: 'idle', kind: 'focus', cycle: 0, links: NO_LINKS };

/** A finished (or abandoned) phase, ready to be saved to the history. */
export interface SessionEntry {
  kind: TimerKind;
  plannedSeconds: number;
  durationSeconds: number;
  startedAt: number;
  endedAt: number;
  outcome: SessionOutcome;
  pauses: number;
  deepFocus: number | null;
  links: SessionLinks;
}

/** Focus sessions shorter than this are not worth keeping when stopped or skipped. */
const MIN_RECORDED_SECONDS = 60;
/** Safety limit on how many phases a single catch-up may chain through. */
const MAX_CATCH_UP_PHASES = 48;

function phaseDurationMs(kind: TimerKind, settings: PomodoroSettings): number {
  const minutes =
    kind === 'focus'
      ? settings.focusMinutes
      : kind === 'short_break'
        ? settings.shortBreakMinutes
        : settings.longBreakMinutes;
  return minutes * MINUTE_MS;
}

export function remainingMs(state: TimerState, now: number, settings: PomodoroSettings): number {
  switch (state.status) {
    case 'running':
      return Math.max(0, state.endsAt - now);
    case 'paused':
      return state.remainingMs;
    default:
      return phaseDurationMs(state.kind, settings);
  }
}

export function isActive(
  state: TimerState,
): state is Extract<TimerState, { status: 'running' | 'paused' }> {
  return state.status !== 'idle';
}

/**
 * Which phase follows. Finishing focus leads to a short break, or to a long one after every
 * `sessionsUntilLongBreak` completed focus sessions; breaks lead back to focus. A skipped focus
 * session does not count towards the long break.
 */
export function nextPhase(
  kind: TimerKind,
  cycle: number,
  outcome: SessionOutcome,
  settings: PomodoroSettings,
): { kind: TimerKind; cycle: number } {
  if (kind === 'focus') {
    if (outcome === 'stopped') {
      return { kind: 'focus', cycle };
    }
    if (outcome === 'skipped') {
      return { kind: 'short_break', cycle };
    }
    const done = cycle + 1;
    return done >= settings.sessionsUntilLongBreak
      ? { kind: 'long_break', cycle: done }
      : { kind: 'short_break', cycle: done };
  }
  return { kind: 'focus', cycle: kind === 'long_break' ? 0 : cycle };
}

export function startPhase(
  state: TimerState,
  kind: TimerKind,
  at: number,
  settings: PomodoroSettings,
): TimerState {
  const durationMs = phaseDurationMs(kind, settings);
  return {
    status: 'running',
    kind,
    // Starting a different phase by hand keeps the cycle, except that a fresh long break restarts it.
    cycle: state.cycle,
    startedAt: at,
    endsAt: at + durationMs,
    durationMs,
    pauses: 0,
    links: state.links,
  };
}

export function pauseTimer(state: TimerState, now: number): TimerState {
  if (state.status !== 'running') {
    return state;
  }
  const { endsAt, ...rest } = state;
  return {
    ...rest,
    status: 'paused',
    remainingMs: Math.max(0, endsAt - now),
    pauses: state.pauses + 1,
  };
}

export function resumeTimer(state: TimerState, now: number): TimerState {
  if (state.status !== 'paused') {
    return state;
  }
  const { remainingMs: left, ...rest } = state;
  return { ...rest, status: 'running', endsAt: now + left };
}

/** How long the phase has really run, not counting time spent paused. */
function elapsedMs(state: TimerState, now: number): number {
  switch (state.status) {
    case 'running':
      return Math.min(state.durationMs, Math.max(0, state.durationMs - (state.endsAt - now)));
    case 'paused':
      return Math.min(state.durationMs, Math.max(0, state.durationMs - state.remainingMs));
    default:
      return 0;
  }
}

/**
 * A 0 to 100 score for how undisturbed a focus session was: how much of the planned time was
 * kept, reduced by 10% for every pause (down to half). Breaks have no score.
 */
export function deepFocusScore(
  entry: Pick<SessionEntry, 'kind' | 'plannedSeconds' | 'durationSeconds' | 'pauses'>,
): number | null {
  if (entry.kind !== 'focus' || entry.plannedSeconds <= 0) {
    return null;
  }
  const kept = Math.min(1, entry.durationSeconds / entry.plannedSeconds);
  const steadiness = Math.max(0.5, 1 - 0.1 * entry.pauses);
  return Math.round(100 * kept * steadiness);
}

/** Whether a phase that just ended is saved to the history. */
export function shouldRecord(
  entry: Pick<SessionEntry, 'kind' | 'outcome' | 'durationSeconds'>,
): boolean {
  if (entry.outcome === 'completed') {
    return true;
  }
  return entry.kind === 'focus' && entry.durationSeconds >= MIN_RECORDED_SECONDS;
}

export interface FinishedPhase {
  /** What to save, or null when the phase was too short to keep. */
  entry: SessionEntry | null;
  /** Where the timer goes next, before any automatic start. */
  next: { kind: TimerKind; cycle: number };
}

/** Ends the running or paused phase at `at` with the given outcome. */
export function finishPhase(
  state: TimerState,
  at: number,
  outcome: SessionOutcome,
  settings: PomodoroSettings,
): FinishedPhase {
  const next = nextPhase(state.kind, state.cycle, outcome, settings);
  if (!isActive(state)) {
    return { entry: null, next };
  }
  const ranMs = outcome === 'completed' ? state.durationMs : elapsedMs(state, at);
  const base = {
    kind: state.kind,
    plannedSeconds: Math.round(state.durationMs / 1000),
    durationSeconds: Math.round(ranMs / 1000),
    startedAt: state.startedAt,
    endedAt: at,
    outcome,
    pauses: state.pauses,
    // The note belongs to the session it was written for; breaks carry no links at all.
    links: state.kind === 'focus' ? state.links : NO_LINKS,
  };
  const entry: SessionEntry = { ...base, deepFocus: deepFocusScore(base) };
  return { entry: shouldRecord(entry) ? entry : null, next };
}

export function wantsAutoStart(finished: TimerKind, settings: PomodoroSettings): boolean {
  return finished === 'focus' ? settings.autoStartBreaks : settings.autoStartFocus;
}

/** The state to rest in after a phase: the next phase waiting, with the focus links kept. */
function idleAfter(state: TimerState, next: { kind: TimerKind; cycle: number }): TimerState {
  return {
    status: 'idle',
    kind: next.kind,
    cycle: next.cycle,
    // A written note is spent once its session is saved.
    links: state.kind === 'focus' ? { ...state.links, note: '' } : state.links,
  };
}

export interface Reconciled {
  state: TimerState;
  entries: SessionEntry[];
  /** Kinds of phases that ran out, in order, e.g. to buzz when one finished while the app was open. */
  completed: TimerKind[];
}

/**
 * Brings the stored timer up to date: every phase whose end time has passed is completed at that
 * time and, when auto-start is on, the next one is started from that moment. This is what makes the
 * timer survive the app being closed or killed.
 */
export function reconcile(state: TimerState, now: number, settings: PomodoroSettings): Reconciled {
  const entries: SessionEntry[] = [];
  const completed: TimerKind[] = [];
  let current = state;

  for (let guard = 0; guard < MAX_CATCH_UP_PHASES; guard += 1) {
    if (current.status !== 'running' || current.endsAt > now) {
      break;
    }
    const at = current.endsAt;
    const { entry, next } = finishPhase(current, at, 'completed', settings);
    if (entry) {
      entries.push(entry);
    }
    completed.push(current.kind);
    const rest = idleAfter(current, next);
    current = wantsAutoStart(current.kind, settings)
      ? startPhase(rest, next.kind, at, settings)
      : rest;
  }
  return { state: current, entries, completed };
}
