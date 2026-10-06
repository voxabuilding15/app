// Checks the production settings that are easy to get wrong before a Play Store upload.
// Usage: npm run verify:release
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = (path) => readFileSync(join(root, path), 'utf8');
const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok, detail });

const app = JSON.parse(read('app.json')).expo;
const android = app.android ?? {};

check('app name is set', typeof app.name === 'string' && app.name.length > 0, app.name);
check('version is semver', /^\d+\.\d+\.\d+$/.test(app.version), app.version);
check(
  'version matches src/constants/app.ts',
  read('src/constants/app.ts').includes(`APP_VERSION = '${app.version}'`),
);
check(
  'android.package is a valid application id',
  /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(android.package ?? ''),
  android.package,
);
check(
  'android.versionCode is a positive integer',
  Number.isInteger(android.versionCode) && android.versionCode >= 1,
  String(android.versionCode),
);
check('Auto Backup is off (notes stay on the device)', android.allowBackup === false);
check('no cleartext traffic', android.usesCleartextTraffic !== true);
check(
  'release signing plugin is installed',
  (app.plugins ?? []).includes('./plugins/with-release-signing'),
);

const pngSize = (path) => {
  const buffer = readFileSync(join(root, path));
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
};
for (const [label, path, size] of [
  ['icon', app.icon, 1024],
  ['adaptive icon foreground', android.adaptiveIcon?.foregroundImage, 1024],
  ['adaptive icon monochrome', android.adaptiveIcon?.monochromeImage, 1024],
]) {
  const exists = typeof path === 'string' && existsSync(join(root, path));
  const dims = exists ? pngSize(path) : null;
  check(
    `${label} is ${size}x${size}`,
    dims?.width === size && dims?.height === size,
    path ?? 'missing',
  );
}

const ALLOWED = new Set([
  'android.permission.POST_NOTIFICATIONS',
  'android.permission.SCHEDULE_EXACT_ALARM',
  'android.permission.RECEIVE_BOOT_COMPLETED',
  'android.permission.VIBRATE',
]);
const extra = (android.permissions ?? []).filter((permission) => !ALLOWED.has(permission));
check('only the reviewed permissions are declared', extra.length === 0, extra.join(', '));
for (const blocked of ['READ_EXTERNAL_STORAGE', 'WRITE_EXTERNAL_STORAGE', 'SYSTEM_ALERT_WINDOW']) {
  check(
    `${blocked} is blocked`,
    (android.blockedPermissions ?? []).includes(`android.permission.${blocked}`),
  );
}

const eas = existsSync(join(root, 'eas.json')) ? JSON.parse(read('eas.json')) : {};
check(
  'eas.json builds an app bundle for production',
  eas.build?.production?.android?.buildType === 'app-bundle',
);

const tracked = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' }).split('\n');
const secrets = tracked.filter((file) => /\.(jks|keystore|p12|pem|key)$|(^|\/)\.env/.test(file));
check('no keystores or env files are committed', secrets.length === 0, secrets.join(', '));

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
const sources = walk(join(root, 'src'));
const insecure = sources.filter((file) =>
  /['"`]http:\/\/(?!localhost)/.test(readFileSync(file, 'utf8')),
);
check('no plain http URLs in the source', insecure.length === 0, insecure.join(', '));
const networking = sources.filter((file) =>
  /\bfetch\(|XMLHttpRequest|WebSocket\(/.test(readFileSync(file, 'utf8')),
);
check(
  'the app makes no network requests (offline-first)',
  networking.length === 0,
  networking.join(', '),
);

for (const doc of ['docs/RELEASE.md', 'docs/PLAY_CONSOLE.md', 'docs/PRIVACY_POLICY.md']) {
  check(`${doc} exists`, existsSync(join(root, doc)));
}

let failed = 0;
for (const { name, ok, detail } of results) {
  failed += ok ? 0 : 1;
  process.stdout.write(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}\n`);
}
process.stdout.write(`\n${results.length - failed}/${results.length} checks passed\n`);
process.exit(failed === 0 ? 0 : 1);
