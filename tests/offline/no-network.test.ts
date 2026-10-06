import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const root = process.cwd();

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      return sources(path);
    }
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

/** Source without comments, so a link in documentation does not count. */
function code(path: string): string {
  return readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const files = sources(join(root, 'src'));

describe('the app never goes online', () => {
  it('reads every source file', () => {
    assert.ok(files.length > 300, `${files.length} files`);
  });

  it('uses no network API in its code', () => {
    const found: string[] = [];
    for (const file of files) {
      const text = code(file);
      for (const pattern of [
        /\bfetch\s*\(/,
        /XMLHttpRequest/,
        /\bWebSocket\b/,
        /sendBeacon/,
        /https?:\/\//,
        /getExpoPushTokenAsync|getDevicePushTokenAsync/,
      ]) {
        if (pattern.test(text)) {
          found.push(`${file.replace(root, '')}: ${pattern}`);
        }
      }
    }
    assert.deepEqual(found, []);
  });

  it('depends on no networking, analytics or crash-reporting library', () => {
    const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
      dependencies: Record<string, string>;
    };
    const names = Object.keys(manifest.dependencies);
    const online = names.filter((name) =>
      /axios|firebase|sentry|analytics|amplitude|mixpanel|segment|socket|apollo|graphql|ky$|got$|superagent|expo-updates|expo-ads|google-mobile-ads|@react-native-firebase/.test(
        name,
      ),
    );
    assert.deepEqual(online, []);
  });

  it('asks for no permission that only makes sense online', () => {
    const config = JSON.parse(readFileSync(join(root, 'app.json'), 'utf8')) as {
      expo: { android: { permissions: string[] } };
    };
    const online = config.expo.android.permissions.filter((permission) =>
      /ACCESS_NETWORK_STATE|ACCESS_WIFI_STATE|CHANGE_NETWORK_STATE|ACCESS_FINE_LOCATION|ACCESS_COARSE_LOCATION|BLUETOOTH/.test(
        permission,
      ),
    );
    assert.deepEqual(online, []);
  });
});
