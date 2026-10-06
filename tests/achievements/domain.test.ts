import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ALL_ACHIEVEMENTS,
  BADGES,
  MILESTONES,
  STREAK_BADGES,
} from '@/features/achievements/domain/catalog';
import {
  CHALLENGE_TEMPLATES,
  challengesFor,
  periodEnd,
  periodStart,
  templatesFor,
} from '@/features/achievements/domain/challenges';
import { EMPTY_COUNTERS } from '@/features/achievements/domain/entities';
import { activityXp } from '@/features/achievements/domain/usecases';
import {
  MAX_LEVEL,
  levelForXp,
  levelTitle,
  xpForLevel,
} from '@/features/achievements/domain/levels';

describe('levels', () => {
  it('needs more XP for every level', () => {
    assert.deepEqual([1, 2, 3, 4, 5, 10].map(xpForLevel), [0, 100, 300, 600, 1000, 4500]);
  });

  it('finds the level and the progress inside it', () => {
    assert.deepEqual(levelForXp(0), { level: 1, into: 0, span: 100, fraction: 0 });
    assert.deepEqual(levelForXp(99), { level: 1, into: 99, span: 100, fraction: 0.99 });
    assert.deepEqual(levelForXp(100), { level: 2, into: 0, span: 200, fraction: 0 });
    assert.deepEqual(levelForXp(450), { level: 3, into: 150, span: 300, fraction: 0.5 });
    assert.equal(levelForXp(-5).level, 1);
    assert.equal(levelForXp(12.9).into, 12);
  });

  it('stops at the top level', () => {
    const top = levelForXp(xpForLevel(MAX_LEVEL) + 5_000_000);
    assert.deepEqual([top.level, top.span, top.fraction], [MAX_LEVEL, 0, 1]);
  });

  it('names ranks of levels', () => {
    assert.deepEqual([1, 4, 5, 9, 10, 20, 49, 50, 99].map(levelTitle), [
      'Beginner',
      'Beginner',
      'Apprentice',
      'Apprentice',
      'Achiever',
      'Expert',
      'Master',
      'Legend',
      'Legend',
    ]);
  });
});

describe('xp for activity', () => {
  it('rewards what was done, with a little for every five minutes of focus', () => {
    assert.equal(activityXp({ ...EMPTY_COUNTERS, longestFocusMinutes: 0 }), 0);
    assert.equal(
      activityXp({
        tasks: 2,
        checkIns: 3,
        focusSessions: 1,
        focusMinutes: 27,
        notes: 4,
        events: 5,
        transactions: 6,
        longestFocusMinutes: 27,
      }),
      20 + 15 + 20 + 12 + 10 + 6 + 5,
    );
  });
});

describe('catalog', () => {
  it('has unique ids and keys within every group', () => {
    const keys = ALL_ACHIEVEMENTS.map((def) => `${def.group}:${def.id}`);
    assert.equal(new Set(keys).size, keys.length);
    assert.equal(BADGES.length, 11);
    assert.equal(MILESTONES.length, 28);
    assert.equal(STREAK_BADGES.length, 7);
  });

  it('gives bigger rewards for bigger milestones and longer streaks', () => {
    for (const counter of new Set(MILESTONES.map((def) => def.counter))) {
      const line = MILESTONES.filter((def) => def.counter === counter);
      assert.deepEqual(
        line.map((def) => def.tier),
        ['bronze', 'silver', 'gold', 'platinum'],
      );
      assert.deepEqual(
        line.map((def) => def.target),
        [...line.map((def) => def.target)].sort((a, b) => (a ?? 0) - (b ?? 0)),
      );
      assert.ok(line.every((def, index) => index === 0 || def.xp > (line[index - 1]?.xp ?? 0)));
    }
    const xp = STREAK_BADGES.map((def) => def.xp);
    assert.deepEqual(
      xp,
      [...xp].sort((a, b) => a - b),
    );
  });

  it('shows focus milestones in hours', () => {
    assert.deepEqual(
      MILESTONES.filter((def) => def.counter === 'focusMinutes').map((def) => def.count),
      [5, 25, 100, 500],
    );
  });
});

describe('challenges', () => {
  it('finds the first and last day of a week and of a month', () => {
    assert.equal(periodStart('week', '2026-10-15'), '2026-10-12');
    assert.equal(periodEnd('week', '2026-10-12'), '2026-10-18');
    assert.equal(periodStart('month', '2026-10-15'), '2026-10-01');
    assert.equal(periodEnd('month', '2026-10-01'), '2026-10-31');
    assert.equal(periodEnd('month', '2028-02-01'), '2028-02-29');
    assert.equal(periodEnd('month', '2026-02-01'), '2026-02-28');
  });

  it('picks the same distinct challenges for a period every time, and varies them', () => {
    const week = templatesFor('week', '2026-10-12');
    assert.equal(week.length, 3);
    assert.equal(new Set(week.map((template) => template.id)).size, 3);
    assert.deepEqual(week, templatesFor('week', '2026-10-12'));
    assert.equal(templatesFor('month', '2026-10-01').length, 2);
    const seen = new Set<string>();
    for (let day = 1; day <= 28; day += 7) {
      templatesFor('week', `2026-10-${String(day).padStart(2, '0')}`).forEach((t) =>
        seen.add(t.id),
      );
    }
    for (let month = 1; month <= 12; month += 1) {
      templatesFor('week', `2026-${String(month).padStart(2, '0')}-01`).forEach((t) =>
        seen.add(t.id),
      );
    }
    assert.ok(seen.size > 4, 'challenges rotate');
  });

  it('measures progress against the target and rewards more for a month', () => {
    const counts = { ...EMPTY_COUNTERS, activeDays: 0 };
    for (const template of CHALLENGE_TEMPLATES) {
      assert.ok(template.month > template.week);
    }
    const [first] = challengesFor('week', '2026-10-12', counts);
    assert.deepEqual([first?.progress, first?.done], [0, false]);
    const filled = challengesFor('week', '2026-10-12', {
      tasks: 99,
      checkIns: 99,
      focusSessions: 99,
      focusMinutes: 999,
      notes: 99,
      events: 99,
      transactions: 99,
      activeDays: 7,
    });
    assert.ok(filled.every((challenge) => challenge.done));
    assert.deepEqual(
      filled.map((c) => c.xp),
      [60, 60, 60],
    );
    assert.deepEqual(
      challengesFor('month', '2026-10-01', counts).map((c) => c.xp),
      [200, 200],
    );
    assert.match(filled[0]?.key ?? '', /^challenge:week:2026-10-12:/);
  });
});
