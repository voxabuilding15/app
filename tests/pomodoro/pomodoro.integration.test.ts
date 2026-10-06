import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import { DEFAULT_SETTINGS } from '@/features/pomodoro/domain/settings';
import { createTimerUseCases } from '@/features/pomodoro/domain/timer-usecases';

import { MINUTE, at, createPomodoro, type Pomodoro } from './setup';

let p: Pomodoro;
beforeEach(() => {
  p = createPomodoro(at(2026, 10, 15, 9));
});

const all = () => p.sessions.list({ scope: 'all', search: '' });

describe('running a focus session', () => {
  it('starts, completes at its end time and saves one history entry', async () => {
    const started = await p.timer.start();
    assert.equal(started.state.status, 'running');
    assert.equal(started.alerts, 'scheduled');
    assert.equal(p.alerts.last?.boundaries[0].at, p.state.now + 25 * MINUTE);

    p.advance(26);
    const result = await p.timer.sync();
    assert.deepEqual(result.completed, ['focus']);
    assert.equal(result.saved, 1);
    assert.deepEqual([result.state.status, result.state.kind], ['idle', 'short_break']);

    const [entry] = await all();
    assert.deepEqual(
      [entry.kind, entry.outcome, entry.durationSeconds, entry.deepFocus],
      ['focus', 'completed', 1500, 100],
    );
    assert.equal(entry.endedAt - entry.startedAt, 25 * MINUTE);
    assert.equal(p.alerts.last, null);
  });

  it('does nothing when started while already running', async () => {
    await p.timer.start();
    const before = p.timer.peek();
    p.advance(3);
    await p.timer.start('long_break');
    assert.deepEqual(p.timer.peek(), before);
  });

  it('can start a break directly', async () => {
    const result = await p.timer.start('long_break');
    assert.equal(result.state.kind, 'long_break');
    assert.equal(result.state.status === 'running' && result.state.durationMs, 15 * MINUTE);
  });

  it('pauses and resumes without losing time', async () => {
    await p.timer.start();
    p.advance(10);
    const paused = await p.timer.pause();
    assert.equal(paused.state.status === 'paused' && paused.state.remainingMs, 15 * MINUTE);
    assert.deepEqual(p.alerts.last?.boundaries, []);
    assert.equal(p.alerts.last?.live.paused, true);

    p.advance(120);
    await p.timer.sync();
    assert.equal((await all()).length, 0);

    const resumed = await p.timer.resume();
    assert.equal(
      resumed.state.status === 'running' && resumed.state.endsAt,
      p.state.now + 15 * MINUTE,
    );
    p.advance(15);
    await p.timer.sync();
    const [entry] = await all();
    assert.deepEqual([entry.pauses, entry.deepFocus, entry.durationSeconds], [1, 90, 1500]);
  });

  it('stops early keeping the time spent, and returns to a fresh focus', async () => {
    await p.timer.start();
    p.advance(7);
    const stopped = await p.timer.stop();
    assert.deepEqual([stopped.state.status, stopped.state.kind], ['idle', 'focus']);
    const [entry] = await all();
    assert.deepEqual([entry.outcome, entry.durationSeconds, entry.deepFocus], ['stopped', 420, 28]);
  });

  it('does not keep a session stopped within the first minute', async () => {
    await p.timer.start();
    p.advance(0, 30);
    await p.timer.stop();
    assert.equal((await all()).length, 0);
  });

  it('skips to the next phase, saving a skipped focus session', async () => {
    await p.timer.start();
    p.advance(5);
    const skipped = await p.timer.skip();
    assert.deepEqual([skipped.state.status, skipped.state.kind], ['idle', 'short_break']);
    assert.equal((await all())[0].outcome, 'skipped');
    // Skipping a phase that is not running just moves on.
    const again = await p.timer.skip();
    assert.deepEqual([again.state.status, again.state.kind], ['idle', 'focus']);
    assert.equal(again.saved, 0);
  });

  it('takes a long break after the configured number of sessions', async () => {
    await p.timer.saveSettings({ ...DEFAULT_SETTINGS, sessionsUntilLongBreak: 2 });
    for (let round = 0; round < 2; round += 1) {
      await p.timer.start();
      p.advance(25);
      await p.timer.sync();
      assert.equal(p.timer.peek().kind, round === 0 ? 'short_break' : 'long_break');
      await p.timer.start();
      p.advance(15);
      await p.timer.sync();
    }
    assert.deepEqual([p.timer.peek().kind, p.timer.peek().cycle], ['focus', 0]);
  });
});

describe('closing and killing the app', () => {
  it('recovers a timer that is still running', async () => {
    await p.timer.start();
    p.advance(10);
    const reopened = p.reopen();
    const state = reopened.peek();
    assert.equal(state.status, 'running');
    const synced = await reopened.sync();
    assert.equal(synced.saved, 0);
    assert.equal(synced.state.status === 'running' && synced.state.endsAt, at(2026, 10, 15, 9, 25));
  });

  it('records phases that ended while the app was dead, at their real end times', async () => {
    await p.timer.saveSettings({
      ...DEFAULT_SETTINGS,
      autoStartBreaks: true,
      autoStartFocus: true,
    });
    await p.timer.start();
    p.advance(70);
    const result = await p.reopen().sync();
    assert.deepEqual(result.completed, ['focus', 'short_break', 'focus', 'short_break']);
    assert.equal(result.saved, 4);
    assert.equal(result.state.status, 'running');
    const history = (await all()).reverse();
    assert.equal(history[0].endedAt, at(2026, 10, 15, 9, 25));
    assert.equal(history[1].startedAt, at(2026, 10, 15, 9, 25));
    assert.equal(history[3].endedAt, at(2026, 10, 15, 10, 0));
  });

  it('saves a session only once when the app syncs repeatedly', async () => {
    await p.timer.start();
    p.advance(30);
    await Promise.all([p.timer.sync(), p.timer.sync(), p.timer.sync(), p.timer.sync()]);
    assert.equal((await all()).length, 1);
  });

  it('lets only one of two simultaneous stops save the session', async () => {
    const slow = {
      ...p.repository,
      insert: async (record: Parameters<typeof p.repository.insert>[0]) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return p.repository.insert(record);
      },
    } as typeof p.repository;
    const timer = createTimerUseCases({
      timers: p.timerStore,
      settings: p.settingsStore,
      sessions: slow,
      alerts: p.alerts,
      clock: { now: () => p.state.now },
    });
    await timer.start();
    p.advance(10);
    const results = await Promise.all([timer.stop(), timer.stop()]);
    assert.deepEqual(results.map((result) => result.saved).sort(), [0, 1]);
  });

  it('treats a damaged stored timer as idle', async () => {
    p.storage.setString('pomodoro.timer', '{nope');
    assert.equal(p.reopen().peek().status, 'idle');
    assert.equal((await p.reopen().start()).state.status, 'running');
  });

  it('applies actions that arrive together one after another', async () => {
    await p.timer.start();
    p.advance(5);
    const [first, second] = await Promise.all([p.timer.pause(), p.timer.pause()]);
    assert.equal(first.state.status, 'paused');
    assert.equal(second.state.status === 'paused' && second.state.pauses, 1);
    assert.equal(p.timer.peek().status, 'paused');
  });
});

describe('notifications', () => {
  it('keeps the timer in place when notifications fail', async () => {
    p.alerts.fail = true;
    const result = await p.timer.start();
    assert.equal(result.state.status, 'running');
    assert.equal(result.alerts, 'none');
  });

  it('reports blocked notifications', async () => {
    p.alerts.outcome = 'blocked';
    assert.equal((await p.timer.start()).alerts, 'blocked');
  });

  it('refreshes the alerts when settings change while running', async () => {
    await p.timer.start();
    const before = p.alerts.plans.length;
    await p.timer.saveSettings({ ...DEFAULT_SETTINGS, exactAlarm: true, autoStartBreaks: true });
    assert.equal(p.alerts.plans.length, before + 1);
    assert.equal(p.alerts.last?.exact, true);
    assert.ok((p.alerts.last?.boundaries.length ?? 0) > 1);
  });

  it('keeps the length a running phase started with when durations change', async () => {
    await p.timer.start();
    await p.timer.saveSettings({ ...DEFAULT_SETTINGS, focusMinutes: 50 });
    const state = p.timer.peek();
    assert.equal(state.status === 'running' && state.durationMs, 25 * MINUTE);
    p.advance(26);
    await p.timer.sync();
    await p.timer.skip();
    assert.equal(
      (await p.timer.start()).state.status === 'running' && p.timer.peek().kind,
      'focus',
    );
    assert.equal(
      p.timer.peek().status === 'running' && (p.timer.peek() as { durationMs: number }).durationMs,
      50 * MINUTE,
    );
  });
});

describe('settings', () => {
  it('persists valid settings and refuses invalid ones', async () => {
    const saved = await p.timer.saveSettings({
      ...DEFAULT_SETTINGS,
      focusMinutes: 45,
      ambientSound: 'rain',
    });
    assert.deepEqual(saved, { ok: true });
    assert.equal(p.reopen().settings().focusMinutes, 45);
    assert.equal(p.reopen().settings().ambientSound, 'rain');

    const refused = await p.timer.saveSettings({ ...DEFAULT_SETTINGS, focusMinutes: 0 });
    assert.equal(refused.ok, false);
    assert.equal(p.timer.settings().focusMinutes, 45);
  });
});

describe('linking sessions', () => {
  it('saves the task, habit, tags and note chosen for a session', async () => {
    const task = p.addTask('Write report');
    const habit = p.addHabit('Read');
    const tagId = await p.addTag('Deep work');

    await p.timer.setLinks({
      taskId: task,
      habitId: habit,
      tagIds: [tagId, tagId],
      note: ' Chapter 2 ',
    });
    await p.timer.start();
    p.advance(25);
    await p.timer.sync();

    const [entry] = await all();
    assert.deepEqual(entry.task, { id: task, title: 'Write report' });
    assert.deepEqual(entry.habit, { id: habit, title: 'Read' });
    assert.deepEqual(
      entry.tags.map((t) => t.name),
      ['Deep work'],
    );
    assert.equal(entry.note, 'Chapter 2');
    // The note is spent but the links stay for the next session.
    const links = p.timer.peek().links;
    assert.deepEqual([links.taskId, links.habitId, links.note], [task, habit, '']);
  });

  it('does not attach links to breaks', async () => {
    await p.timer.setLinks({ taskId: p.addTask('A'), note: 'hi' });
    await p.timer.start('short_break');
    p.advance(5);
    await p.timer.sync();
    const [entry] = await all();
    assert.deepEqual([entry.task, entry.note], [null, '']);
  });

  it('lets the note and links change while a session runs', async () => {
    await p.timer.start();
    p.advance(5);
    await p.timer.setLinks({ note: 'thinking' });
    p.advance(20);
    await p.timer.sync();
    assert.equal((await all())[0].note, 'thinking');
  });

  it('leaves a deleted or finished task unlinked instead of failing', async () => {
    const gone = p.addTask('Gone', { deleted: true });
    await p.timer.setLinks({ taskId: gone, habitId: 'ghost', tagIds: ['ghost'] });
    await p.timer.start();
    p.advance(25);
    const result = await p.timer.sync();
    assert.equal(result.saved, 1);
    const [entry] = await all();
    assert.deepEqual([entry.task, entry.habit, entry.tags], [null, null, []]);
  });

  it('keeps the entry when its task is deleted for good', async () => {
    const task = p.addTask('Temp');
    await p.timer.setLinks({ taskId: task });
    await p.timer.start();
    p.advance(25);
    await p.timer.sync();
    p.db.runSync('DELETE FROM tasks WHERE id = ?', [task]);
    const [entry] = await all();
    assert.equal(entry.task, null);
  });

  it('offers open tasks and active habits as targets', async () => {
    p.addTask('Open');
    p.addTask('Done', { completed: true });
    p.addTask('Trashed', { deleted: true });
    p.addHabit('Meditate');
    const targets = await p.sessions.linkTargets();
    assert.deepEqual(
      targets.tasks.map((t) => t.title),
      ['Open'],
    );
    assert.deepEqual(
      targets.habits.map((h) => h.title),
      ['Meditate'],
    );
  });
});

describe('history', () => {
  async function run(minutes = 25) {
    await p.timer.start();
    p.advance(minutes);
    await p.timer.sync();
    p.advance(1);
  }

  it('lists newest first and filters by kind', async () => {
    await run();
    await p.timer.start();
    p.advance(5);
    await p.timer.sync();
    await run();
    const everything = await all();
    assert.deepEqual(
      everything.map((s) => s.kind),
      ['focus', 'short_break', 'focus'],
    );
    assert.equal((await p.sessions.list({ scope: 'focus', search: '' })).length, 2);
    assert.equal((await p.sessions.list({ scope: 'breaks', search: '' })).length, 1);
  });

  it('searches notes, tasks, habits and tags without treating wildcards specially', async () => {
    const task = p.addTask('Quarterly plan');
    const tagId = await p.addTag('Writing');
    await p.timer.setLinks({
      taskId: task,
      note: '100% done_ok',
      tagIds: [tagId],
    });
    await run();
    await p.timer.setLinks({ taskId: null, tagIds: [], note: 'other' });
    await p.timer.skip();
    await run();
    const search = async (text: string) =>
      (await p.sessions.list({ scope: 'all', search: text })).map((s) => s.note);
    assert.deepEqual(await search('quarterly'), ['100% done_ok']);
    assert.deepEqual(await search('writing'), ['100% done_ok']);
    assert.deepEqual(await search('100%'), ['100% done_ok']);
    assert.deepEqual(await search('%'), ['100% done_ok']);
    assert.deepEqual(await search('_'), ['100% done_ok']);
    assert.deepEqual(await search('  other '), ['other']);
    assert.deepEqual(await search('nothing'), []);
  });

  it('edits the details of a focus session only', async () => {
    await run();
    await p.timer.start('short_break');
    p.advance(5);
    await p.timer.sync();
    const [rest, focus] = await all();
    const task = p.addTask('Later');
    assert.equal(
      await p.sessions.updateDetails(focus.id, {
        note: '  edited ',
        taskId: task,
        habitId: null,
        tagIds: [],
      }),
      true,
    );
    assert.equal(
      await p.sessions.updateDetails(rest.id, {
        note: 'x',
        taskId: null,
        habitId: null,
        tagIds: [],
      }),
      false,
    );
    assert.equal(
      await p.sessions.updateDetails('ghost', {
        note: 'x',
        taskId: null,
        habitId: null,
        tagIds: [],
      }),
      false,
    );
    const updated = (await all()).find((s) => s.id === focus.id);
    assert.deepEqual([updated?.note, updated?.task?.title], ['edited', 'Later']);
  });

  it('deletes an entry and restores it with its tags', async () => {
    const tagId = await p.addTag('Keep');
    await p.timer.setLinks({ tagIds: [tagId], note: 'precious' });
    await run();
    const [entry] = await all();
    const removed = await p.sessions.remove(entry.id);
    assert.equal((await all()).length, 0);
    assert.equal(await p.sessions.remove(entry.id), null);
    assert.ok(removed);
    await p.sessions.restore(removed);
    const [back] = await all();
    assert.deepEqual([back.id, back.note, back.tags.length], [entry.id, 'precious', 1]);
  });

  it('removes a tag from entries when the tag is deleted', async () => {
    const tagId = await p.addTag('Temp');
    await p.timer.setLinks({ tagIds: [tagId] });
    await run();
    await p.tags.delete(tagId);
    assert.deepEqual((await all())[0].tags, []);
  });
});

describe('statistics', () => {
  /**
   * Saves a focus session of `minutes` on the given day: run to the end, or stopped after
   * `stopAfter` minutes.
   */
  async function session(day: number, hour: number, minutes: number, stopAfter?: number) {
    p.state.now = at(2026, 10, day, hour);
    await p.timer.saveSettings({ ...DEFAULT_SETTINGS, focusMinutes: minutes });
    await p.timer.start();
    if (stopAfter === undefined) {
      p.advance(minutes);
      await p.timer.sync();
      await p.timer.skip();
    } else {
      p.advance(stopAfter);
      await p.timer.stop();
    }
  }

  it('is empty with no history', async () => {
    const overview = await p.stats.overview(DEFAULT_SETTINGS);
    assert.equal(overview.today.focusSeconds, 0);
    assert.deepEqual(overview.streak, { current: 0, longest: 0 });
    assert.equal(overview.deepFocus, null);
    assert.equal(overview.heatmap.length, 182);
    assert.equal(overview.heatmap.at(-1)?.date, '2026-10-15');
    assert.equal(overview.series.day.length, 14);
    assert.equal(overview.series.week.length, 12);
    assert.equal(overview.series.month.length, 12);
    assert.deepEqual(overview.links, []);
  });

  it('leaves breaks out of every total', async () => {
    p.state.now = at(2026, 10, 15, 9);
    await p.timer.start('short_break');
    p.advance(5);
    await p.timer.sync();
    p.advance(0, 1);
    await p.timer.start('long_break');
    p.advance(15);
    await p.timer.sync();
    assert.equal((await all()).length, 2);
    const overview = await p.stats.overview(DEFAULT_SETTINGS);
    assert.equal(overview.today.focusSeconds, 0);
    assert.equal(overview.today.completed, 0);
    assert.deepEqual(overview.streak, { current: 0, longest: 0 });
    assert.equal(overview.deepFocus, null);
  });

  it('totals the day, week and month against their goals', async () => {
    await session(5, 9, 30); // earlier this month
    await session(12, 9, 30); // Monday of this week
    await session(14, 9, 20);
    await session(15, 9, 25);
    await session(15, 14, 25, 20);
    p.state.now = at(2026, 10, 15, 20);
    const settings = {
      ...DEFAULT_SETTINGS,
      dailyGoalMinutes: 100,
      weeklyGoalMinutes: 200,
      monthlyGoalMinutes: 0,
    };
    const overview = await p.stats.overview(settings);
    assert.equal(overview.today.focusSeconds, 45 * 60);
    assert.equal(overview.today.completed, 1);
    assert.equal(overview.today.fraction, 0.45);
    assert.equal(overview.week.focusSeconds, 95 * 60);
    assert.equal(overview.week.fraction, 95 / 200);
    assert.equal(overview.month.focusSeconds, 125 * 60);
    assert.equal(overview.month.fraction, null);
  });

  it('computes streaks from completed days, ignoring stopped-only days', async () => {
    await session(11, 9, 25);
    await session(12, 9, 25);
    await session(13, 9, 25, 20);
    await session(14, 9, 25);
    await session(15, 9, 25);
    p.state.now = at(2026, 10, 15, 20);
    const { streak } = await p.stats.overview(DEFAULT_SETTINGS);
    assert.deepEqual(streak, { current: 2, longest: 2 });
    p.state.now = at(2026, 10, 17, 8);
    assert.deepEqual((await p.stats.overview(DEFAULT_SETTINGS)).streak.current, 0);
  });

  it('builds the series and heatmap per local day', async () => {
    await session(15, 9, 50);
    await session(14, 23, 25);
    p.state.now = at(2026, 10, 15, 20);
    const overview = await p.stats.overview({ ...DEFAULT_SETTINGS, dailyGoalMinutes: 100 });
    assert.equal(overview.series.day.at(-1)?.focusSeconds, 50 * 60);
    assert.equal(overview.series.day.at(-2)?.focusSeconds, 25 * 60);
    assert.equal(overview.series.week.at(-1)?.focusSeconds, 75 * 60);
    assert.equal(overview.series.month.at(-1)?.completed, 2);
    assert.equal(overview.heatmap.at(-1)?.level, 3);
    assert.equal(overview.heatmap.at(-2)?.level, 2);
    assert.equal(overview.heatmap.at(-3)?.level, 0);
  });

  it('weights the deep focus score by session length', async () => {
    await session(14, 9, 60);
    await session(15, 9, 30, 15); // stopped halfway: a score of 50 over 15 minutes
    p.state.now = at(2026, 10, 15, 20);
    const overview = await p.stats.overview(DEFAULT_SETTINGS);
    assert.equal(overview.deepFocus, 90);
  });

  it('shows where focus time went, by task and habit', async () => {
    const task = p.addTask('Report');
    const habit = p.addHabit('Study');
    await p.timer.setLinks({ taskId: task });
    await session(14, 9, 30);
    await p.timer.setLinks({ taskId: null, habitId: habit });
    await session(15, 9, 45);
    await p.timer.setLinks({ habitId: null });
    await session(15, 11, 25);
    p.state.now = at(2026, 10, 15, 20);
    const { links } = await p.stats.overview(DEFAULT_SETTINGS);
    assert.deepEqual(
      links.map((l) => [l.kind, l.title, l.seconds]),
      [
        ['habit', 'Study', 45 * 60],
        ['task', 'Report', 30 * 60],
      ],
    );
  });
});
