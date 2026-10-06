import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createTestDatabase } from '../tasks/test-database';

import { LARGE, populate } from './data';
import { buildOperations } from './operations';

const NOW = new Date(2026, 9, 15, 12).getTime();

describe('speed with two years of heavy use', () => {
  const db = createTestDatabase();
  populate(db, LARGE, NOW);

  // Run in order: the backup steps depend on the one before.
  for (const operation of buildOperations(db, NOW)) {
    it(`${operation.name} takes under ${operation.limitMs} ms`, async () => {
      const started = performance.now();
      await operation.run();
      const took = performance.now() - started;
      assert.ok(took < operation.limitMs, `${operation.name} took ${Math.round(took)} ms`);
    });
  }
});
