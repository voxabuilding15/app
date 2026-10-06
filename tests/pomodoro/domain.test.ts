import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildAlertPlan, formatCountdown } from '@/features/pomodoro/domain/alerts';
import {
  DEFAULT_SETTINGS,
  normalizeSettings,
  validateSettings,
  type PomodoroSettings,
} from '@/features/pomodoro/domain/settings';
import {
  buckets,
  goalFraction,
  heatLevel,
  streaks,
  sumDays,
  totalsByDay,
} from '@/features/pomodoro/domain/stats';
import {
  IDLE_STATE,
  deepFocusScore,
  finishPhase,
  nextPhase,
  pauseTimer,
  reconcile,
  remainingMs,
  resumeTimer,
  startPhase,
  type TimerState,
} from '@/features/pomodoro/domain/timer';
import { parseTimerState } from '@/features/pomodoro/domain/timer-codec';

import { MINUTE, at } from './setup';

const settings = (overrides: Partial<PomodoroSettings> = {}): PomodoroSettings => ({
  ...DEFAULT_SETTINGS,
  ...overrides,
});
const T0 = at(2026, 10, 15, 9);

describe('phase order', () => {
  it('takes a long break after the configured number of completed focus sessions', () => {
    const s = settings({ sessionsUntilLongBreak: 3 });
    assert.deepEqual(nextPhase('focus', 0, 'completed', s), { kind: 'short_break', cycle: 1 });
    assert.deepEqual(nextPhase('focus', 1, 'completed', s), { kind: 'short_break', cycle: 2 });
    assert.deepEqual(nextPhase('focus', 2, 'completed', s), { kind: 'long_break', cycle: 3 });
    assert.deepEqual(nextPhase('long_break', 3, 'completed', s), { kind: 'focus', cycle: 0 });
    assert.deepEqual(nextPhase('short_break', 1, 'skipped', s), { kind: 'focus', cycle: 1 });
  });

  it('does not count a skipped or stopped focus session towards the long break', () => {
    const s = settings();
    assert.deepEqual(nextPhase('focus', 2, 'skipped', s), { kind: 'short_break', cycle: 2 });
    assert.deepEqual(nextPhase('focus', 2, 'stopped', s), { kind: 'focus', cycle: 2 });
  });
});

describe('running, pausing and resuming', () => {
  const running = startPhase(IDLE_STATE, 'focus', T0, settings());

  it('stores absolute times so the time left only depends on the clock', () => {
    assert.equal(running.status, 'running');
    assert.equal(remainingMs(running, T0 + 10 * MINUTE, settings()), 15 * MINUTE);
    assert.equal(remainingMs(running, T0 + 99 * MINUTE, settings()), 0);
    assert.equal(remainingMs(IDLE_STATE, T0, settings({ focusMinutes: 40 })), 40 * MINUTE);
  });

  it('freezes the time left while paused and counts the pause', () => {
    const paused = pauseTimer(running, T0 + 10 * MINUTE);
    assert.equal(paused.status, 'paused');
    assert.equal(remainingMs(paused, T0 + 500 * MINUTE, settings()), 15 * MINUTE);
    const resumed = resumeTimer(paused, T0 + 60 * MINUTE);
    assert.equal(resumed.status, 'running');
    assert.equal(resumed.status === 'running' && resumed.endsAt, T0 + 75 * MINUTE);
    assert.equal(resumed.status === 'running' && resumed.pauses, 1);
  });

  it('ignores pause and resume in the wrong state', () => {
    assert.equal(pauseTimer(IDLE_STATE, T0), IDLE_STATE);
    assert.equal(resumeTimer(running, T0), running);
  });
});

describe('finishing a phase', () => {
  const running = startPhase(IDLE_STATE, 'focus', T0, settings());

  it('records a completed session in full', () => {
    const { entry, next } = finishPhase(running, T0 + 25 * MINUTE, 'completed', settings());
    assert.equal(entry?.durationSeconds, 1500);
    assert.equal(entry?.plannedSeconds, 1500);
    assert.equal(entry?.deepFocus, 100);
    assert.deepEqual(next, { kind: 'short_break', cycle: 1 });
  });

  it('keeps the time actually spent when stopped, excluding time paused', () => {
    const paused = pauseTimer(running, T0 + 10 * MINUTE);
    const { entry } = finishPhase(paused, T0 + 90 * MINUTE, 'stopped', settings());
    assert.equal(entry?.durationSeconds, 600);
    assert.equal(entry?.outcome, 'stopped');
    assert.equal(entry?.pauses, 1);
  });

  it('drops focus sessions under a minute but never completed ones', () => {
    assert.equal(finishPhase(running, T0 + 59_000, 'stopped', settings()).entry, null);
    assert.equal(
      finishPhase(running, T0 + 60_000, 'skipped', settings())?.entry?.durationSeconds,
      60,
    );
    const brief = startPhase(IDLE_STATE, 'focus', T0, settings({ focusMinutes: 1 }));
    assert.notEqual(finishPhase(brief, T0 + MINUTE, 'completed', settings()).entry, null);
  });

  it('records breaks only when they ran out, without a score or links', () => {
    const rest = startPhase(
      { ...IDLE_STATE, links: { ...IDLE_STATE.links, note: 'x' } },
      'short_break',
      T0,
      settings(),
    );
    assert.equal(finishPhase(rest, T0 + MINUTE, 'skipped', settings()).entry, null);
    const done = finishPhase(rest, T0 + 5 * MINUTE, 'completed', settings()).entry;
    assert.equal(done?.deepFocus, null);
    assert.equal(done?.links.note, '');
  });

  it('scores undisturbed time: kept share, minus 10% per pause, at least half', () => {
    const score = (durationSeconds: number, pauses: number) =>
      deepFocusScore({ kind: 'focus', plannedSeconds: 1500, durationSeconds, pauses });
    assert.equal(score(1500, 0), 100);
    assert.equal(score(750, 0), 50);
    assert.equal(score(1500, 3), 70);
    assert.equal(score(1500, 12), 50);
    assert.equal(score(9999, 0), 100);
    assert.equal(
      deepFocusScore({ kind: 'short_break', plannedSeconds: 300, durationSeconds: 300, pauses: 0 }),
      null,
    );
  });
});

describe('catching up after the app was closed', () => {
  const start = (s: PomodoroSettings) => startPhase(IDLE_STATE, 'focus', T0, s);

  it('does nothing while the phase is still running', () => {
    const result = reconcile(start(settings()), T0 + 24 * MINUTE, settings());
    assert.equal(result.entries.length, 0);
    assert.equal(result.state.status, 'running');
  });

  it('completes the phase at its own end time and waits when auto-start is off', () => {
    const result = reconcile(start(settings()), T0 + 5 * 60 * MINUTE, settings());
    assert.equal(result.entries.length, 1);
    assert.equal(result.entries[0].endedAt, T0 + 25 * MINUTE);
    assert.deepEqual(
      [result.state.status, result.state.kind, result.state.cycle],
      ['idle', 'short_break', 1],
    );
    assert.deepEqual(result.completed, ['focus']);
  });

  it('chains phases from where the previous one ended when auto-start is on', () => {
    const s = settings({ autoStartBreaks: true, autoStartFocus: true });
    const result = reconcile(start(s), T0 + 60 * MINUTE, s);
    // focus 0-25, break 25-30, focus 30-55, break 55-60 (ends exactly now) and a new focus starts.
    assert.deepEqual(result.completed, ['focus', 'short_break', 'focus', 'short_break']);
    assert.equal(result.state.status, 'running');
    assert.equal(result.state.status === 'running' && result.state.startedAt, T0 + 60 * MINUTE);
    assert.equal(result.entries.filter((entry) => entry.kind === 'focus').length, 2);
  });

  it('stops chaining at a break the user must start by hand', () => {
    const s = settings({ autoStartBreaks: false, autoStartFocus: true });
    const result = reconcile(start(s), T0 + 600 * MINUTE, s);
    assert.equal(result.state.status, 'idle');
    assert.equal(result.state.kind, 'short_break');
  });

  it('never runs away on an extremely long absence', () => {
    const s = settings({
      autoStartBreaks: true,
      autoStartFocus: true,
      focusMinutes: 1,
      shortBreakMinutes: 1,
    });
    const result = reconcile(startPhase(IDLE_STATE, 'focus', T0, s), T0 + 1e6 * MINUTE, s);
    assert.ok(result.entries.length <= 48);
  });

  it('leaves paused and idle timers alone', () => {
    const paused = pauseTimer(start(settings()), T0 + MINUTE);
    assert.equal(reconcile(paused, T0 + 1e4 * MINUTE, settings()).state, paused);
    assert.equal(reconcile(IDLE_STATE, T0, settings()).state, IDLE_STATE);
  });
});

describe('settings', () => {
  it('accepts the defaults and rejects values outside the allowed ranges', () => {
    assert.deepEqual(validateSettings(DEFAULT_SETTINGS), {});
    const errors = validateSettings(
      settings({
        focusMinutes: 0,
        shortBreakMinutes: 1.5,
        sessionsUntilLongBreak: 1,
        dailyGoalMinutes: 721,
      }),
    );
    assert.deepEqual(Object.keys(errors).sort(), [
      'dailyGoalMinutes',
      'focusMinutes',
      'sessionsUntilLongBreak',
      'shortBreakMinutes',
    ]);
    assert.deepEqual(validateSettings(settings({ weeklyGoalMinutes: 0 })), {});
  });

  it('replaces damaged stored values with defaults and keeps valid ones', () => {
    const result = normalizeSettings({
      focusMinutes: 50,
      shortBreakMinutes: 'x',
      longBreakMinutes: 9999,
      vibrate: false,
      tickSound: 'yes',
      ambientSound: 'rain',
    });
    assert.equal(result.focusMinutes, 50);
    assert.equal(result.shortBreakMinutes, DEFAULT_SETTINGS.shortBreakMinutes);
    assert.equal(result.longBreakMinutes, DEFAULT_SETTINGS.longBreakMinutes);
    assert.equal(result.vibrate, false);
    assert.equal(result.tickSound, DEFAULT_SETTINGS.tickSound);
    assert.equal(result.ambientSound, 'rain');
    assert.deepEqual(normalizeSettings(null), DEFAULT_SETTINGS);
    assert.equal(normalizeSettings({ ambientSound: 'thunder' }).ambientSound, 'none');
  });
});

describe('stored timer', () => {
  const running = startPhase(IDLE_STATE, 'focus', T0, settings());

  it('round-trips every state', () => {
    for (const state of [IDLE_STATE, running, pauseTimer(running, T0 + MINUTE)]) {
      assert.deepEqual(parseTimerState(JSON.stringify(state)), state);
    }
  });

  it('falls back to idle for anything unreadable', () => {
    for (const bad of [
      undefined,
      '',
      '{',
      '[]',
      '{"status":"running","kind":"focus","cycle":0}',
      '{"status":"running","kind":"nap","cycle":0,"startedAt":1,"endsAt":2,"durationMs":1}',
      '{"status":"paused","kind":"focus","cycle":0,"startedAt":1,"durationMs":1,"remainingMs":-5}',
      '{"status":"weird","kind":"focus","cycle":0,"startedAt":1,"durationMs":1}',
    ]) {
      assert.deepEqual(parseTimerState(bad), IDLE_STATE);
    }
  });

  it('cleans up damaged links', () => {
    const state = parseTimerState(
      JSON.stringify({
        status: 'idle',
        kind: 'focus',
        cycle: 1,
        links: { taskId: 3, tagIds: ['a', 4], note: 5 },
      }),
    ) as TimerState;
    assert.deepEqual(state.links, { taskId: null, habitId: null, tagIds: ['a'], note: '' });
  });
});

describe('alert plans', () => {
  it('has nothing to show while idle', () => {
    assert.equal(buildAlertPlan(IDLE_STATE, settings()), null);
  });

  it('shows the running timer and one alert for its end', () => {
    const plan = buildAlertPlan(startPhase(IDLE_STATE, 'focus', T0, settings()), settings());
    assert.equal(plan?.live.paused, false);
    assert.deepEqual(
      plan?.boundaries.map((b) => b.at),
      [T0 + 25 * MINUTE],
    );
    assert.equal(plan?.boundaries[0].title, 'Focus finished');
    assert.equal(plan?.exact, false);
  });

  it('schedules the whole auto-start chain, bounded', () => {
    const s = settings({ autoStartBreaks: true, autoStartFocus: true, exactAlarm: true });
    const plan = buildAlertPlan(startPhase(IDLE_STATE, 'focus', T0, s), s);
    assert.deepEqual(
      plan?.boundaries.map((b) => b.at),
      [T0 + 25 * MINUTE, T0 + 30 * MINUTE, T0 + 55 * MINUTE, T0 + 60 * MINUTE],
    );
    assert.match(plan?.boundaries[0].body ?? '', /Short break has started/);
    assert.equal(plan?.exact, true);
  });

  it('has no end alert while paused but shows the time left', () => {
    const paused = pauseTimer(startPhase(IDLE_STATE, 'focus', T0, settings()), T0 + 5 * MINUTE);
    const plan = buildAlertPlan(paused, settings());
    assert.deepEqual(plan?.boundaries, []);
    assert.equal(plan?.live.paused, true);
    assert.match(plan?.live.body ?? '', /^20:00 left$/);
  });

  it('formats countdowns', () => {
    assert.equal(formatCountdown(1_445_000), '24:05');
    assert.equal(formatCountdown(1), '0:01');
    assert.equal(formatCountdown(-5), '0:00');
  });
});

describe('statistics helpers', () => {
  it('builds day, week (Monday first) and month buckets, oldest first', () => {
    assert.deepEqual(buckets('day', '2026-10-15', 3), [
      { from: '2026-10-13', to: '2026-10-13' },
      { from: '2026-10-14', to: '2026-10-14' },
      { from: '2026-10-15', to: '2026-10-15' },
    ]);
    assert.deepEqual(buckets('week', '2026-10-15', 2), [
      { from: '2026-10-05', to: '2026-10-11' },
      { from: '2026-10-12', to: '2026-10-18' },
    ]);
    assert.deepEqual(buckets('month', '2026-01-20', 2), [
      { from: '2025-12-01', to: '2025-12-31' },
      { from: '2026-01-01', to: '2026-01-31' },
    ]);
  });

  it('sums focus time, completed sessions and a time-weighted deep focus score', () => {
    const rows = [
      {
        startedAt: T0,
        durationSeconds: 1500,
        plannedSeconds: 1500,
        outcome: 'completed' as const,
        deepFocus: 100,
      },
      {
        startedAt: T0 + 3600_000,
        durationSeconds: 500,
        plannedSeconds: 1500,
        outcome: 'stopped' as const,
        deepFocus: 20,
      },
      {
        startedAt: T0 + 86_400_000,
        durationSeconds: 60,
        plannedSeconds: 60,
        outcome: 'completed' as const,
        deepFocus: null,
      },
    ];
    const days = totalsByDay(rows);
    assert.equal(days.size, 2);
    assert.deepEqual(sumDays(days, '2026-10-15', '2026-10-15'), {
      focusSeconds: 2000,
      completed: 1,
      deepFocus: 80,
    });
    assert.equal(sumDays(days, '2026-10-16', '2026-10-16').deepFocus, null);
    assert.equal(sumDays(days, '2026-10-01', '2026-10-31').focusSeconds, 2060);
    assert.equal(sumDays(days, '2026-09-01', '2026-09-30').focusSeconds, 0);
  });

  it('measures goals, and turns them off at zero', () => {
    assert.equal(goalFraction(3000, 100), 0.5);
    assert.equal(goalFraction(9000, 100), 1.5);
    assert.equal(goalFraction(3000, 0), null);
  });

  it('keeps a streak alive through today until a whole day is missed', () => {
    const days = new Set(['2026-10-10', '2026-10-11', '2026-10-13', '2026-10-14']);
    assert.deepEqual(streaks(days, '2026-10-14'), { current: 2, longest: 2 });
    assert.deepEqual(streaks(days, '2026-10-15'), { current: 2, longest: 2 });
    assert.deepEqual(streaks(days, '2026-10-16'), { current: 0, longest: 2 });
    assert.deepEqual(streaks(new Set(), '2026-10-16'), { current: 0, longest: 0 });
    assert.deepEqual(streaks(new Set(['2026-10-31', '2026-11-01', '2026-11-02']), '2026-11-02'), {
      current: 3,
      longest: 3,
    });
  });

  it('grades heat relative to the daily goal', () => {
    assert.equal(heatLevel(0, 100), 0);
    assert.deepEqual(
      [600, 2400, 5000, 6000].map((s) => heatLevel(s, 100)),
      [1, 2, 3, 4],
    );
    assert.equal(heatLevel(6000, 0), 4);
    assert.equal(heatLevel(2400, 0), 2);
  });
});
