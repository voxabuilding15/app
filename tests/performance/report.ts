import { createTestDatabase } from '../tasks/test-database';

import { LARGE, populate } from './data';
import { buildOperations } from './operations';

const NOW = new Date(2026, 9, 15, 12).getTime();
const RUNS = 5;

const median = (values: number[]) =>
  [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] ?? 0;

async function main() {
  const db = createTestDatabase();
  const loaded = performance.now();
  populate(db, LARGE, NOW);
  const loadMs = performance.now() - loaded;
  const count = (table: string) =>
    db.getFirstSync<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`)?.n ?? 0;
  const rows = ['tasks', 'habit_logs', 'events', 'transactions', 'notes', 'pomodoro_sessions'].map(
    (table) => `${table}: ${count(table).toLocaleString('en')}`,
  );
  const pages = db.getFirstSync<{ page_count: number }>('PRAGMA page_count')?.page_count ?? 0;
  const pageSize = db.getFirstSync<{ page_size: number }>('PRAGMA page_size')?.page_size ?? 0;

  const lines = [
    `Data set: ${rows.join(', ')}; database about ${((pages * pageSize) / 1024 / 1024).toFixed(1)} MB; built in ${Math.round(loadMs)} ms.`,
    '',
    '| Operation | Fastest (ms) | Median (ms) | Slowest (ms) |',
    '| --- | ---: | ---: | ---: |',
  ];
  const operations = buildOperations(db, NOW);
  // The backup steps depend on the one before them, so each runs in order.
  for (const operation of operations) {
    const times: number[] = [];
    for (let run = 0; run < RUNS; run += 1) {
      const started = performance.now();
      await operation.run();
      times.push(performance.now() - started);
    }
    lines.push(
      `| ${operation.name} | ${Math.min(...times).toFixed(1)} | ${median(times).toFixed(1)} | ${Math.max(...times).toFixed(1)} |`,
    );
  }
  process.stdout.write(`${lines.join('\n')}\n`);
}

void main();
