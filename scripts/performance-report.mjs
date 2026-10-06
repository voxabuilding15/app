// Runs the heavy-use data set through the operations people wait for and prints a Markdown table.
// Usage: node scripts/performance-report.mjs > table.md
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';

import { build } from 'esbuild';

const root = resolve(import.meta.dirname, '..');
const outFile = join(root, 'node_modules', '.cache', 'focusflow-tests', 'performance-report.mjs');

await build({
  entryPoints: [join(root, 'tests', 'performance', 'report.ts')],
  outfile: outFile,
  bundle: true,
  platform: 'node',
  format: 'esm',
  alias: { '@': join(root, 'src') },
  external: ['node:*'],
  logLevel: 'warning',
});

const result = spawnSync(process.execPath, ['--no-warnings', outFile], {
  stdio: 'inherit',
  env: { ...process.env, TZ: 'UTC' },
});
process.exit(result.status ?? 1);
