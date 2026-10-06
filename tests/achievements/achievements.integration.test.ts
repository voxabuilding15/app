import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import { periodStart } from '@/features/achievements/domain/challenges';

import { at, createAchievements, type AchievementsFixture } from './setup';

let a: AchievementsFixture;
beforeEach(() => {
  a = createAchievements(at(2026, 10, 15, 18));
});

const keys = (unlocks: { key: string }[]) => unlocks.map((unlock) => unlock.key).sort();
const view = async (id: string) =>
  (await a.achievements.sync()).achievements.find((item) => item.def.id === id);

describe('an empty app', () => {
  it('starts at level 1 with nothing earned and this week and month challenges set', async () => {
    const state = await a.achievements.sync();
    assert.deepEqual(
      [state.xp, state.level.level, state.fresh.length, state.unseen.length],
      [0, 1, 0, 0],
    );
    assert.deepEqual(state.streak, { current: 0, longest: 0 });
    assert.deepEqual([state.challenges.week.length, state.challenges.month.length], [3, 2]);
    assert.ok(
      state.challenges.week.every((challenge) => challenge.progress === 0 && !challenge.done),
    );
    assert.ok(state.achievements.every((item) => !item.unlocked));
    assert.equal(state.challenges.week[0]?.periodKey, '2026-10-12');
    assert.equal(state.challenges.month[0]?.periodKey, '2026-10-01');
  });
});

describe('badges and xp', () => {
  it('unlocks the first-step badge once, with its reward on top of the XP for the work', async () => {
    a.completeTasks(1, 15);
    const state = await a.achievements.sync();
    assert.deepEqual(keys(state.fresh), ['badge:first-task']);
    // 10 XP for the task and 20 for the badge.
    assert.equal(state.xp, 30);
    assert.equal(state.unseen.length, 1);

    const again = await a.achievements.sync();
    assert.equal(again.fresh.length, 0);
    assert.equal(again.xp, 30);
    assert.equal(again.unseen.length, 1);
  });

  it('remembers what has been shown', async () => {
    a.completeTasks(1, 15);
    await a.achievements.sync();
    await a.achievements.markSeen(['badge:first-task']);
    assert.equal((await a.achievements.sync()).unseen.length, 0);
    assert.equal((await a.unlocks.all())[0]?.seen, true);
  });

  it('counts each kind of work and leaves out what was deleted', async () => {
    a.seed.addTask('gone', { completedAt: at(2026, 10, 15, 9), deleted: true });
    a.seed.addNote('trashed', at(2026, 10, 15), at(2026, 10, 15), { deleted: true });
    const state = await a.achievements.sync();
    assert.deepEqual([state.lifetime.tasks, state.lifetime.notes], [0, 0]);

    a.seed.addNote('kept', at(2026, 10, 15));
    a.seed.addEvent('e', at(2026, 10, 16, 9), at(2026, 10, 16, 10));
    a.seed.addTransaction('expense', 100, at(2026, 10, 15));
    a.seed.addHabit('Read', '2026-10-01', [
      { date: '2026-10-14', count: 2 },
      { date: '2026-10-13', status: 'skipped' },
    ]);
    await a.seed.addFocus(at(2026, 10, 15, 9), 95);
    await a.seed.addFocus(at(2026, 10, 15, 11), 20, { outcome: 'stopped' });
    const after = await a.achievements.sync();
    assert.deepEqual(after.lifetime, {
      tasks: 0,
      checkIns: 2,
      focusSessions: 1,
      focusMinutes: 95,
      longestFocusMinutes: 95,
      notes: 1,
      events: 1,
      transactions: 1,
    });
    assert.ok(keys(after.fresh).includes('badge:marathon'));
    assert.ok(keys(after.fresh).includes('badge:first-focus'));
    assert.ok(!keys(after.fresh).includes('badge:first-task'));
  });

  it('unlocks the all-rounder once every area has been used', async () => {
    a.completeTasks(1, 15);
    a.seed.addNote('n', at(2026, 10, 15));
    a.seed.addEvent('e', at(2026, 10, 16, 9), at(2026, 10, 16, 10));
    a.seed.addTransaction('income', 100, at(2026, 10, 15));
    a.seed.addHabit('h', '2026-10-01', [{ date: '2026-10-15' }]);
    assert.equal((await view('all-rounder'))?.unlocked, false);
    await a.seed.addFocus(at(2026, 10, 15, 9), 25);
    assert.equal((await view('all-rounder'))?.unlocked, true);
  });

  it('shows how far a milestone has come', async () => {
    a.completeTasks(4, 15);
    const tasks = await view('tasks-bronze');
    assert.deepEqual([tasks?.unlocked, tasks?.progress], [false, { current: 4, target: 10 }]);
    a.completeTasks(10, 14);
    const done = await view('tasks-bronze');
    assert.deepEqual([done?.unlocked, done?.progress], [true, { current: 10, target: 10 }]);
    assert.equal((await view('tasks-silver'))?.progress?.current, 14);
  });

  it('unlocks levels as XP grows, settling level badges that follow from the rewards', async () => {
    for (let day = 1; day <= 14; day += 1) {
      a.completeTasks(10, day);
    }
    const state = await a.achievements.sync();
    assert.ok(state.xp >= 1000, `xp ${state.xp}`);
    assert.ok(state.level.level >= 5);
    assert.ok(state.achievements.find((item) => item.def.id === 'level-5')?.unlocked);
    // The reward XP is part of the total, and nothing is earned twice.
    const stored = await a.unlocks.all();
    assert.equal(new Set(stored.map((entry) => entry.key)).size, stored.length);
    assert.equal(
      state.xp,
      state.lifetime.tasks * 10 + stored.reduce((sum, entry) => sum + entry.xp, 0),
    );
  });

  it('never takes XP or badges away when data is deleted', async () => {
    a.completeTasks(10, 15);
    const before = await a.achievements.sync();
    a.db.runSync('UPDATE tasks SET deleted_at = 1');
    const after = await a.achievements.sync();
    assert.equal(after.lifetime.tasks, 0);
    assert.equal(after.xp, before.xp);
    assert.equal(after.level.level, before.level.level);
    assert.equal((await view('first-task'))?.unlocked, true);
    assert.equal((await view('tasks-bronze'))?.unlocked, true);
  });

  it('records one unlock when several checks run at once', async () => {
    a.completeTasks(1, 15);
    const results = await Promise.all([
      a.achievements.sync(),
      a.achievements.sync(),
      a.achievements.sync(),
    ]);
    assert.equal(
      results.reduce((total, state) => total + state.fresh.length, 0),
      1,
    );
    assert.equal((await a.unlocks.all()).length, 1);
  });
});

describe('daily streak rewards', () => {
  it('counts days in a row with something done and rewards the milestones', async () => {
    a.completeTasks(1, 13);
    a.completeTasks(1, 14);
    let state = await a.achievements.sync();
    assert.deepEqual(state.streak, { current: 2, longest: 2 });
    assert.ok(!keys(state.fresh).includes('streak:streak-3'));

    a.completeTasks(1, 15);
    state = await a.achievements.sync();
    assert.deepEqual(state.streak, { current: 3, longest: 3 });
    assert.ok(keys(state.fresh).includes('streak:streak-3'));
    assert.equal(
      state.achievements.find((item) => item.def.id === 'streak-7')?.progress?.current,
      3,
    );
  });

  it('counts habit check-ins and focus sessions as activity, and keeps a reward after a break', async () => {
    a.seed.addHabit('h', '2026-10-01', [{ date: '2026-10-10' }, { date: '2026-10-11' }]);
    await a.seed.addFocus(at(2026, 10, 12, 9), 25);
    let state = await a.achievements.sync();
    assert.equal(state.streak.longest, 3);
    assert.ok((await a.unlocks.all()).some((entry) => entry.ref === 'streak-3'));

    a.state.now = at(2026, 10, 20);
    state = await a.achievements.sync();
    assert.deepEqual(state.streak, { current: 0, longest: 3 });
    assert.equal(state.achievements.find((item) => item.def.id === 'streak-3')?.unlocked, true);
  });
});

describe('weekly and monthly challenges', () => {
  it('unlocks a challenge when its target is reached, once, with its reward', async () => {
    const state = await a.achievements.sync();
    const challenge = state.challenges.week[0];
    assert.ok(challenge !== undefined);
    const { counter } = challenge.template;
    const target = challenge.target;
    // The week runs from Monday the 12th; do just what this challenge asks, spread over the week.
    for (let index = 0; index < target; index += 1) {
      const day = 12 + (index % 4);
      switch (counter) {
        case 'tasks':
          a.completeTasks(1, day);
          break;
        case 'checkIns':
          a.seed.addHabit(`h${index}`, '2026-01-01', [{ date: `2026-10-${day}` }]);
          break;
        case 'focusMinutes':
          await a.seed.addFocus(at(2026, 10, day, 8 + (index % 8)), 1);
          break;
        case 'focusSessions':
          await a.seed.addFocus(at(2026, 10, day, 8 + (index % 8)), 25);
          break;
        case 'notes':
          a.seed.addNote(`n${index}`, at(2026, 10, day));
          break;
        case 'events':
          a.seed.addEvent(`e${index}`, at(2026, 10, day, 9), at(2026, 10, day, 10));
          break;
        case 'transactions':
          a.seed.addTransaction('expense', 100, at(2026, 10, day));
          break;
        default:
          a.completeTasks(1, 12 + index);
      }
    }
    const after = await a.achievements.sync();
    const progress = after.challenges.week.find((item) => item.key === challenge.key);
    assert.deepEqual([progress?.progress, progress?.done], [target, true]);
    assert.ok(keys(after.fresh).includes(challenge.key));
    assert.ok(after.xp >= challenge.xp);
    assert.equal((await a.achievements.sync()).fresh.length, 0);
  });

  it('still rewards last week’s challenge when the app is opened a few days later', async () => {
    a.state.now = at(2026, 10, 18, 20);
    const mondayWeek = periodStart('week', '2026-10-18');
    assert.equal(mondayWeek, '2026-10-12');
    for (const day of [12, 13, 14, 15, 16, 17, 18]) {
      a.completeTasks(8, day);
      a.seed.addNote(`n${day}`, at(2026, 10, day));
      a.seed.addNote(`m${day}`, at(2026, 10, day, 13));
      a.seed.addTransaction('expense', 100, at(2026, 10, day));
      a.seed.addEvent(`e${day}`, at(2026, 10, day, 9), at(2026, 10, day, 10));
      await a.seed.addFocus(at(2026, 10, day, 9), 30);
      a.seed.addHabit(`h${day}`, '2026-01-01', [{ date: `2026-10-${day}`, count: 3 }]);
    }
    await a.achievements.sync();
    const earnedBefore = (await a.unlocks.all()).filter((entry) => entry.kind === 'challenge');
    assert.ok(earnedBefore.length >= 3);

    // A new week begins; nothing is lost, and the new week's challenges start empty.
    a.state.now = at(2026, 10, 21, 8);
    const state = await a.achievements.sync();
    assert.equal(state.challenges.week[0]?.periodKey, '2026-10-19');
    assert.ok(
      state.challenges.week.every((challenge) =>
        challenge.progress === 0 || challenge.template.counter === 'activeDays'
          ? true
          : challenge.progress === 0,
      ),
    );
    const earnedAfter = (await a.unlocks.all()).filter((entry) => entry.kind === 'challenge');
    assert.ok(earnedAfter.length >= earnedBefore.length);
  });

  it('catches the previous week up when it was finished while the app was closed', async () => {
    // Set up the data for the week of the 5th while "now" is still in it, but only sync a week later.
    a.state.now = at(2026, 10, 12, 8);
    for (const day of [5, 6, 7, 8, 9, 10, 11]) {
      a.completeTasks(8, day);
      a.seed.addNote(`n${day}`, at(2026, 10, day));
      a.seed.addNote(`m${day}`, at(2026, 10, day, 13));
      a.seed.addTransaction('expense', 100, at(2026, 10, day));
      a.seed.addEvent(`e${day}`, at(2026, 10, day, 9), at(2026, 10, day, 10));
      await a.seed.addFocus(at(2026, 10, day, 9), 30);
      a.seed.addHabit(`h${day}`, '2026-01-01', [
        { date: `2026-10-${String(day).padStart(2, '0')}`, count: 3 },
      ]);
    }
    const state = await a.achievements.sync();
    const previous = (await a.unlocks.all()).filter((entry) =>
      entry.key.startsWith('challenge:week:2026-10-05:'),
    );
    assert.equal(previous.length, 3);
    assert.ok(state.challenges.week.every((challenge) => challenge.periodKey === '2026-10-12'));
  });
});
