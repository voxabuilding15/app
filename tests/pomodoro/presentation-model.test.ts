import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { addDaysToKey } from '@/core';
import type { HeatDay } from '@/features/pomodoro/domain/stats-usecases';
import {
  formatBucketDescription,
  formatBucketLabel,
  formatClockFace,
  formatFocusTime,
  speakClock,
} from '@/features/pomodoro/presentation/format';
import {
  HEATMAP_ROW_LABELS,
  buildHeatmapModel,
} from '@/features/pomodoro/presentation/heatmap-model';

import { createPomodoro, at } from './setup';

const days = (start: string, count: number): HeatDay[] =>
  Array.from({ length: count }, (_, index) => ({
    date: addDaysToKey(start, index),
    focusSeconds: index === 0 ? 1800 : 0,
    level: index === 0 ? 3 : 0,
  }));

describe('formatting', () => {
  it('writes focus time compactly', () => {
    assert.equal(formatFocusTime(30), '30s');
    assert.equal(formatFocusTime(60), '1m');
    assert.equal(formatFocusTime(2700), '45m');
    assert.equal(formatFocusTime(3600), '1h');
    assert.equal(formatFocusTime(5100), '1h 25m');
  });

  it('writes the clock face and its spoken form', () => {
    assert.equal(formatClockFace(1_500_000), '25:00');
    assert.equal(formatClockFace(3_725_000), '1:02:05');
    assert.equal(formatClockFace(-1), '0:00');
    assert.equal(speakClock(1_445_000), '24 minutes 5 seconds');
    assert.equal(speakClock(60_000), '1 minute');
    assert.equal(speakClock(1000), '1 second');
  });

  it('labels statistics buckets', () => {
    assert.equal(formatBucketLabel('week', '2026-10-12'), '12');
    assert.match(formatBucketDescription('week', '2026-10-12', '2026-10-18'), /^Week of .* to /);
    assert.match(formatBucketDescription('month', '2026-10-01', '2026-10-31'), /2026/);
  });
});

describe('heatmap layout', () => {
  it('starts weeks on Monday and pads the first and last weeks', () => {
    // 2026-10-14 is a Wednesday.
    const model = buildHeatmapModel(days('2026-10-14', 10), 26);
    assert.equal(model.columns.length, 2);
    assert.equal(
      model.columns.every((column) => column.length === 7),
      true,
    );
    assert.deepEqual(
      model.columns[0]?.map((cell) => cell?.key ?? null),
      [null, null, '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18'],
    );
    assert.deepEqual(
      model.columns[1]?.map((cell) => cell?.key ?? null),
      ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', null, null],
    );
    assert.equal(model.columns[0]?.[2]?.level, 3);
    assert.match(model.columns[0]?.[2]?.label ?? '', /30m$/);
    assert.match(model.columns[0]?.[3]?.label ?? '', /no focus$/);
    assert.equal(HEATMAP_ROW_LABELS.length, 7);
  });

  it('labels the first week of each month once and keeps only the newest weeks', () => {
    const model = buildHeatmapModel(days('2026-09-21', 60), 26);
    assert.equal(model.columnLabels.filter((label) => label !== null).length, 3);
    assert.equal(model.columnLabels[0] !== null, true);
    const short = buildHeatmapModel(days('2026-09-21', 60), 3);
    assert.equal(short.columns.length, 3);
    assert.equal(short.columnLabels.length, 3);
    assert.equal(
      short.columns.at(-1)?.some((cell) => cell?.key === '2026-11-19'),
      true,
    );
  });
});

describe('choosing the waiting phase', () => {
  it('changes the phase while idle and leaves a running one alone', async () => {
    const p = createPomodoro(at(2026, 10, 15, 9));
    assert.equal((await p.timer.select('long_break')).state.kind, 'long_break');
    assert.equal(p.reopen().peek().kind, 'long_break');
    await p.timer.start();
    const running = p.timer.peek();
    await p.timer.select('short_break');
    assert.deepEqual(p.timer.peek(), running);
  });
});
