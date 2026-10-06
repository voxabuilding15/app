import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { readPrivacy, writePrivacy } from '@/core';
import { SqliteDataUsage } from '@/features/settings/data/sqlite-usage';
import {
  FEEDBACK_MAX_LENGTH,
  composeFeedback,
  validateFeedback,
} from '@/features/settings/domain/feedback';
import {
  DEFAULT_SECURITY,
  LOCK_DELAYS,
  SecuritySettingsStore,
} from '@/features/settings/domain/security';

import { at, createBackups } from '../backup/setup';
import { createTestDatabase } from '../tasks/test-database';

import { memoryStorage } from './storage';

describe('security settings', () => {
  it('defaults to locking after a minute and keeps the delay that was chosen', () => {
    const storage = memoryStorage();
    const store = new SecuritySettingsStore(storage);
    assert.deepEqual(store.read(), DEFAULT_SECURITY);
    for (const delay of LOCK_DELAYS) {
      store.write({ lockDelaySeconds: delay });
      assert.equal(store.read().lockDelaySeconds, delay);
    }
  });

  it('ignores damaged or unknown values', () => {
    const storage = memoryStorage();
    const store = new SecuritySettingsStore(storage);
    storage.setString('security.settings', '{bad');
    assert.deepEqual(store.read(), DEFAULT_SECURITY);
    storage.setString('security.settings', '{"lockDelaySeconds":7}');
    assert.deepEqual(store.read(), DEFAULT_SECURITY);
  });
});

describe('privacy settings', () => {
  it('stores the choice and treats anything unreadable as off', () => {
    const storage = memoryStorage();
    assert.deepEqual(readPrivacy(storage), { hideNotificationDetails: false });
    writePrivacy(storage, { hideNotificationDetails: true });
    assert.equal(readPrivacy(storage).hideNotificationDetails, true);
    storage.setString('settings.privacy', '{nope');
    assert.equal(readPrivacy(storage).hideNotificationDetails, false);
    storage.setString('settings.privacy', '{"hideNotificationDetails":"yes"}');
    assert.equal(readPrivacy(storage).hideNotificationDetails, false);
  });
});

describe('feedback', () => {
  const diagnostics = {
    appVersion: '1.2.3',
    schemaVersion: 9,
    platform: 'android 14',
    language: 'fr',
  };

  it('needs a message that is not blank or too long', () => {
    assert.equal(validateFeedback('   '), 'empty');
    assert.equal(validateFeedback('x'), null);
    assert.equal(validateFeedback('x'.repeat(FEEDBACK_MAX_LENGTH)), null);
    assert.equal(validateFeedback('x'.repeat(FEEDBACK_MAX_LENGTH + 1)), 'too-long');
  });

  it('composes a message with technical details but nothing of the person’s data', () => {
    const { subject, body } = composeFeedback('bug', '  It crashed  ', diagnostics, true);
    assert.equal(subject, 'FocusFlow 1.2.3 – Problem report');
    assert.equal(
      body,
      'It crashed\n\n---\nApp version: 1.2.3\nDatabase version: 9\nPlatform: android 14\nLanguage: fr',
    );
    assert.equal(composeFeedback('idea', 'Nice', diagnostics, false).body, 'Nice');
    assert.match(composeFeedback('other', 'x', diagnostics, false).subject, /Feedback$/);
    assert.match(composeFeedback('idea', 'x', diagnostics, false).subject, /Idea$/);
  });
});

describe('data usage', () => {
  it('counts what is stored, without the trash, and reports the database size', async () => {
    const empty = await new SqliteDataUsage(createTestDatabase()).read();
    assert.deepEqual(
      [
        empty.tasks,
        empty.habits,
        empty.events,
        empty.transactions,
        empty.notes,
        empty.focusSessions,
        empty.attachments,
      ],
      [0, 0, 0, 0, 0, 0, 0],
    );
    const a = createBackups(at(2026, 10, 15));
    await a.seedEverything();
    a.seed.addTask('gone', { createdAt: 1, deleted: true });
    a.seed.addNote('trash', 1, 1, { deleted: true });
    const usage = await new SqliteDataUsage(a.db).read();
    assert.deepEqual(
      [
        usage.tasks,
        usage.habits,
        usage.events,
        usage.transactions,
        usage.notes,
        usage.focusSessions,
      ],
      [1, 1, 1, 2, 1, 1],
    );
    assert.ok(usage.databaseBytes > 0);
    assert.ok(usage.schemaVersion >= 9);
  });
});

describe('erasing everything', () => {
  async function filled() {
    const a = createBackups(at(2026, 10, 15));
    const { note } = await a.seedEverything();
    await a.addAttachment(note, 'notes/n1/a.png', 'A');
    a.storage.setString('finance.currency', 'EUR');
    a.storage.setString('theme-preference', '{"state":{"preference":"dark"}}');
    a.storage.setString('language-preference', '{"state":{"preference":"fr"}}');
    a.storage.setString('notes.lock', '{"method":"device"}');
    a.storage.setString('security.applock', '{"method":"pin"}');
    a.storage.setString('pomodoro.timer', '{}');
    await a.backups.create('manual', false);
    return a;
  }

  it('wipes every row but leaves the XP record in place, and clears settings except theme and language', async () => {
    const a = await filled();
    await a.backups.eraseEverything({ keepSafetyCopy: true });
    for (const table of [
      'tasks',
      'habits',
      'habit_logs',
      'events',
      'transactions',
      'accounts',
      'categories',
      'notes',
      'folders',
      'note_attachments',
      'pomodoro_sessions',
      'achievement_unlocks',
    ]) {
      assert.equal(a.count(table), 0, table);
    }
    assert.equal(a.count('achievement_state'), 1);
    assert.equal(a.storage.getString('finance.currency'), undefined);
    assert.equal(a.storage.getString('notes.lock'), undefined);
    assert.equal(a.storage.getString('security.applock'), undefined);
    assert.equal(a.storage.getString('pomodoro.timer'), undefined);
    assert.ok(a.storage.getString('theme-preference'));
    assert.ok(a.storage.getString('language-preference'));
    assert.equal(await a.files.exists('documents', 'notes/n1/a.png'), false);
    assert.equal(a.cancelled.count, 1);
  });

  it('keeps a safety copy that can bring everything back', async () => {
    const a = await filled();
    const { safetyCopy } = await a.backups.eraseEverything({ keepSafetyCopy: true });
    assert.ok(safetyCopy);
    const restored = a.backups.inspect(await a.files.readText('documents', safetyCopy.path));
    assert.ok(restored.ok);
    await a.backups.restore(restored.backup, { mode: 'replace', policy: 'keep-local' });
    assert.equal(a.count('tasks'), 1);
    assert.equal(a.count('notes'), 1);
  });

  it('leaves no backup behind when asked not to keep one', async () => {
    const a = await filled();
    const { safetyCopy } = await a.backups.eraseEverything({ keepSafetyCopy: false });
    assert.equal(safetyCopy, null);
    assert.equal((await a.backups.list()).length, 0);
  });
});
