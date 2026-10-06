import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createAchievements } from './setup';

const unlock = (key: string, seen = false) => ({
  key,
  kind: 'badge' as const,
  ref: key,
  xp: 20,
  unlockedAt: 5,
  seen,
});

describe('unlock repository', () => {
  it('stores each unlock once and keeps what is already there', async () => {
    const { unlocks } = createAchievements();
    await unlocks.insertMissing([unlock('a'), unlock('b')]);
    await unlocks.insertMissing([{ ...unlock('a'), xp: 999, seen: true }, unlock('c')]);
    const all = await unlocks.all();
    assert.deepEqual(
      all.map((entry) => entry.key),
      ['a', 'b', 'c'],
    );
    assert.deepEqual(
      all.map((entry) => [entry.xp, entry.seen]),
      [
        [20, false],
        [20, false],
        [20, false],
      ],
    );
  });

  it('marks unlocks as seen, leaving the rest', async () => {
    const { unlocks } = createAchievements();
    await unlocks.insertMissing([unlock('a'), unlock('b')]);
    await unlocks.markSeen(['a', 'missing']);
    assert.deepEqual(
      (await unlocks.all()).map((entry) => entry.seen),
      [true, false],
    );
  });

  it('only ever raises the peak XP', async () => {
    const { unlocks } = createAchievements();
    assert.equal(await unlocks.peakXp(), 0);
    await unlocks.raisePeakXp(150.9);
    await unlocks.raisePeakXp(40);
    assert.equal(await unlocks.peakXp(), 150);
  });

  it('reads the unseen ones through the partial index', async () => {
    const { db } = createAchievements();
    const plan = db
      .getAllSync<{ detail: string }>(
        'EXPLAIN QUERY PLAN SELECT key FROM achievement_unlocks WHERE seen = 0 ORDER BY unlocked_at',
      )
      .map((row) => row.detail)
      .join(' | ');
    assert.match(plan, /idx_achievement_unseen/);
  });
});
