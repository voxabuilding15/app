// Bundles tests/**/*.test.ts with esbuild (resolving the "@/" alias) and runs them with Node's
// built-in test runner under several time zones, since the domain logic is calendar-sensitive.
import { spawnSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { build } from 'esbuild';

const root = resolve(import.meta.dirname, '..');
const outDir = join(root, 'node_modules', '.cache', 'focusflow-tests');

function collect(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      return collect(path);
    }
    return name.endsWith('.test.ts') ? [path] : [];
  });
}

const entries = collect(join(root, 'tests'));
await build({
  entryPoints: entries,
  outdir: outDir,
  outbase: join(root, 'tests'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  outExtension: { '.js': '.mjs' },
  alias: { '@': join(root, 'src') },
  external: ['node:*'],
  logLevel: 'warning',
});

let failed = false;
for (const tz of ['UTC', 'America/New_York', 'Asia/Kolkata']) {
  process.stdout.write(`\n=== TZ=${tz} ===\n`);
  const result = spawnSync(
    process.execPath,
    ['--no-warnings', '--test', join(outDir, '**', '*.test.mjs')],
    { stdio: 'inherit', env: { ...process.env, TZ: tz } },
  );
  failed ||= result.status !== 0;
}
process.exit(failed ? 1 : 0);
