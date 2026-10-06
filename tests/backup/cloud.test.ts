import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  CloudUnavailableError,
  UnavailableCloudProvider,
  createCloudUseCases,
  type CloudBackupProvider,
  type RemoteBackup,
} from '@/features/backup/domain/cloud';

import { createBackups } from './setup';

/** A provider that keeps backups in memory, to prove the seam works end to end. */
class MemoryCloud implements CloudBackupProvider {
  readonly id = 'google-drive' as const;
  readonly name = 'Memory drive';
  signedIn = false;
  stored = new Map<string, { meta: RemoteBackup; content: string }>();
  async status() {
    return this.signedIn ? ('ready' as const) : ('signed-out' as const);
  }
  async signIn() {
    this.signedIn = true;
  }
  async signOut() {
    this.signedIn = false;
  }
  async upload(name: string, content: string) {
    const meta = {
      id: `id-${this.stored.size + 1}`,
      name,
      sizeBytes: content.length,
      modifiedAt: 1,
    };
    this.stored.set(meta.id, { meta, content });
    return meta;
  }
  async list() {
    return [...this.stored.values()].map((entry) => entry.meta);
  }
  async download(id: string) {
    const entry = this.stored.get(id);
    if (entry === undefined) {
      throw new Error('missing');
    }
    return entry.content;
  }
  async remove(id: string) {
    this.stored.delete(id);
  }
}

describe('cloud backup architecture', () => {
  it('lists Google Drive as not available yet and refuses to act', async () => {
    const cloud = createCloudUseCases([
      new UnavailableCloudProvider('google-drive', 'Google Drive'),
    ]);
    assert.deepEqual(await cloud.providers(), [
      { id: 'google-drive', name: 'Google Drive', status: 'unavailable' },
    ]);
    for (const attempt of [
      () => cloud.signIn('google-drive'),
      () => cloud.signOut('google-drive'),
      () => cloud.upload('google-drive', 'a.json', '{}'),
      () => cloud.list('google-drive'),
      () => cloud.download('google-drive', 'x'),
      () => cloud.remove('google-drive', 'x'),
    ]) {
      await assert.rejects(attempt, CloudUnavailableError);
    }
    assert.throws(() => cloud.signIn('other' as never), CloudUnavailableError);
  });

  it('reports a provider that fails to answer as unavailable', async () => {
    const broken: CloudBackupProvider = Object.assign(new MemoryCloud(), {
      status: async () => {
        throw new Error('offline');
      },
    });
    assert.equal((await createCloudUseCases([broken]).providers())[0]?.status, 'unavailable');
  });

  it('carries a backup out to a provider and back, through the same checks and restore as local ones', async () => {
    const source = createBackups();
    await source.seedEverything();
    const provider = new MemoryCloud();
    const cloud = createCloudUseCases([provider]);

    assert.equal((await cloud.providers())[0]?.status, 'signed-out');
    await cloud.signIn('google-drive');
    assert.equal((await cloud.providers())[0]?.status, 'ready');

    const { file } = await source.backups.create('manual', false);
    const uploaded = await cloud.upload(
      'google-drive',
      file.name,
      await source.files.readText('documents', file.path),
    );
    assert.deepEqual(
      (await cloud.list('google-drive')).map((entry) => entry.id),
      [uploaded.id],
    );

    const target = createBackups();
    const inspected = target.backups.inspect(await cloud.download('google-drive', uploaded.id));
    assert.ok(inspected.ok);
    await target.backups.restore(inspected.backup, { mode: 'replace', policy: 'keep-local' });
    assert.deepEqual(await target.store.readAll(), await source.store.readAll());

    await cloud.remove('google-drive', uploaded.id);
    assert.equal((await cloud.list('google-drive')).length, 0);
    await cloud.signOut('google-drive');
  });
});
