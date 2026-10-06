import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import {
  LOCKOUT_MS,
  MAX_PIN_ATTEMPTS,
  UNLOCK_WINDOW_MS,
  validatePin,
} from '@/features/notes/domain/lock';
import { StorageLockStore } from '@/features/notes/data/storage-adapters';
import {
  WIDGET_NOTE_LIMIT,
  WIDGET_SNAPSHOT_KEY,
  noteLink,
  type WidgetSnapshot,
} from '@/features/notes/domain/widget';

import { at, createNotes, draft, memoryStorage, mustSave, type Notes } from './setup';

let n: Notes;
beforeEach(() => {
  n = createNotes(at(2026, 10, 15));
});

describe('pin validation', () => {
  it('needs 4 to 8 digits', () => {
    assert.equal(validatePin('1234'), null);
    assert.equal(validatePin('12345678'), null);
    assert.equal(validatePin('123'), 'Use 4 to 8 digits');
    assert.equal(validatePin('123456789'), 'Use 4 to 8 digits');
    assert.equal(validatePin('12a4'), 'Use digits only');
    assert.equal(validatePin(''), 'Use digits only');
  });
});

describe('locking with the device', () => {
  it('turns on after the device confirms, and unlocks through it', async () => {
    assert.equal(n.lock.method(), 'none');
    assert.equal(n.lock.isUnlocked(), true, 'without a lock everything is open');
    assert.deepEqual(await n.lock.useDeviceAuth(), { ok: true });
    assert.equal(n.lock.method(), 'device');
    assert.equal(n.lock.isUnlocked(), true, 'just confirmed');
    n.lock.lockNow();
    assert.equal(n.lock.isUnlocked(), false);
    assert.deepEqual(await n.lock.unlock(), { ok: true });
    assert.equal(n.lock.isUnlocked(), true);
    assert.ok(n.authenticator.prompts.length >= 2);
  });

  it('explains when the device has nothing set up, or the person cancels', async () => {
    n.authenticator.available = false;
    const unavailable = await n.lock.useDeviceAuth();
    assert.equal(unavailable.ok, false);
    assert.match(unavailable.ok ? '' : unavailable.error, /fingerprint, face or screen lock/);
    n.authenticator.available = true;
    n.authenticator.accepts = false;
    assert.deepEqual(await n.lock.useDeviceAuth(), {
      ok: false,
      error: 'Authentication was cancelled.',
    });
    assert.equal(n.lock.method(), 'none');

    n.authenticator.accepts = true;
    await n.lock.useDeviceAuth();
    n.lock.lockNow();
    n.authenticator.accepts = false;
    assert.deepEqual(await n.lock.unlock(), { ok: false, reason: 'cancelled' });
    n.authenticator.available = false;
    assert.deepEqual(await n.lock.unlock(), { ok: false, reason: 'unavailable' });
    assert.equal(n.lock.isUnlocked(), false);
  });
});

describe('locking with a PIN', () => {
  async function withPin(pin = '2468') {
    assert.deepEqual(await n.lock.usePin(pin), { ok: true });
    n.lock.lockNow();
  }

  it('never stores the PIN itself', async () => {
    await withPin('2468');
    const stored = n.storage.getString('notes.lock') ?? '';
    assert.ok(!stored.includes('2468'));
    const config = JSON.parse(stored) as { method: string; pinHash: string; pinSalt: string };
    assert.equal(config.method, 'pin');
    assert.match(config.pinHash, /^[0-9a-f]{64}$/);
    assert.ok(config.pinSalt.length > 0);
  });

  it('opens with the right PIN and counts down wrong attempts', async () => {
    await withPin();
    assert.deepEqual(await n.lock.unlock('0000'), {
      ok: false,
      reason: 'wrong-pin',
      attemptsLeft: MAX_PIN_ATTEMPTS - 1,
    });
    assert.deepEqual(await n.lock.unlock(), {
      ok: false,
      reason: 'wrong-pin',
      attemptsLeft: MAX_PIN_ATTEMPTS - 2,
    });
    assert.equal(n.lock.isUnlocked(), false);
    assert.deepEqual(await n.lock.unlock('2468'), { ok: true });
    assert.equal(n.lock.isUnlocked(), true);
    n.lock.lockNow();
    assert.deepEqual(
      await n.lock.unlock('0000'),
      { ok: false, reason: 'wrong-pin', attemptsLeft: MAX_PIN_ATTEMPTS - 1 },
      'a success resets the count',
    );
  });

  it('locks out after too many wrong attempts, then allows another go', async () => {
    await withPin();
    for (let attempt = 1; attempt < MAX_PIN_ATTEMPTS; attempt += 1) {
      await n.lock.unlock('0000');
    }
    assert.deepEqual(await n.lock.unlock('0000'), {
      ok: false,
      reason: 'locked-out',
      retryInMs: LOCKOUT_MS,
    });
    n.state.now += 10_000;
    assert.deepEqual(
      await n.lock.unlock('2468'),
      { ok: false, reason: 'locked-out', retryInMs: LOCKOUT_MS - 10_000 },
      'even the right PIN waits',
    );
    n.state.now += LOCKOUT_MS;
    assert.deepEqual(await n.lock.unlock('2468'), { ok: true });
  });

  it('relocks after the unlock window', async () => {
    await withPin();
    await n.lock.unlock('2468');
    n.state.now += UNLOCK_WINDOW_MS - 1;
    assert.equal(n.lock.isUnlocked(), true);
    n.state.now += 1;
    assert.equal(n.lock.isUnlocked(), false);
  });

  it('rejects weak or malformed PINs', async () => {
    assert.deepEqual(await n.lock.usePin('12'), { ok: false, error: 'Use 4 to 8 digits' });
    assert.deepEqual(await n.lock.usePin('abcd'), { ok: false, error: 'Use digits only' });
    assert.equal(n.lock.method(), 'none');
  });

  it('needs the notes unlocked to change or remove the lock', async () => {
    await withPin();
    assert.deepEqual(await n.lock.usePin('1357'), { ok: false, error: 'Unlock your notes first.' });
    assert.deepEqual(await n.lock.useDeviceAuth(), {
      ok: false,
      error: 'Unlock your notes first.',
    });
    assert.deepEqual(n.lock.turnOff(), { ok: false, error: 'Unlock your notes first.' });
    await n.lock.unlock('2468');
    assert.deepEqual(await n.lock.usePin('1357'), { ok: true });
    n.lock.lockNow();
    assert.deepEqual(await n.lock.unlock('2468'), {
      ok: false,
      reason: 'wrong-pin',
      attemptsLeft: 4,
    });
    assert.deepEqual(await n.lock.unlock('1357'), { ok: true });
    assert.deepEqual(n.lock.turnOff(), { ok: true });
    assert.equal(n.lock.method(), 'none');
    assert.equal(n.storage.getString('notes.lock'), undefined);
    assert.equal(n.lock.isUnlocked(), true);
    assert.deepEqual(await n.lock.unlock(), { ok: true });
  });
});

describe('lock storage', () => {
  it('falls back to no lock when the stored value is damaged', () => {
    for (const raw of [
      'garbage',
      '{"method":"banana"}',
      '{"method":"pin"}',
      '{"method":"pin","pinHash":"a"}',
      '[]',
    ]) {
      const storage = memoryStorage();
      storage.setString('notes.lock', raw);
      assert.equal(new StorageLockStore(storage).read().method, 'none', raw);
    }
    const storage = memoryStorage();
    storage.setString('notes.lock', '{"method":"device"}');
    assert.deepEqual(new StorageLockStore(storage).read(), {
      method: 'device',
      pinHash: null,
      pinSalt: null,
    });
  });
});

describe('locked notes', () => {
  it('flag and unflag notes, and the flag survives edits', async () => {
    const { id } = await mustSave(n.notes.save(draft({ locked: true }), null));
    assert.equal((await n.notes.get(id))?.locked, true);
    await mustSave(n.notes.save(draft({ title: 'Renamed', locked: true }), id));
    assert.equal((await n.notes.get(id))?.locked, true);
    await n.notes.setLocked(id, false);
    assert.equal((await n.notes.get(id))?.locked, false);
  });
});

describe('widget snapshot', () => {
  const read = () =>
    JSON.parse(n.storage.getString(WIDGET_SNAPSHOT_KEY) ?? 'null') as WidgetSnapshot | null;
  const add = async (title: string, overrides: Parameters<typeof draft>[0] = {}) => {
    n.state.now += 60_000;
    return (
      await mustSave(n.notes.save(draft({ title, body: `${title} text`, ...overrides }), null))
    ).id;
  };
  const settle = () => new Promise((resolve) => setTimeout(resolve, 5));

  it('lists pinned notes first, then the newest, with a deep link', async () => {
    const old = await add('Old');
    await add('New');
    await n.notes.setPinned(old, true);
    const snapshot = await n.widgets.snapshot();
    assert.deepEqual(
      snapshot.notes.map((note) => note.title),
      ['Old', 'New'],
    );
    assert.equal(snapshot.version, 1);
    assert.equal(snapshot.updatedAt, n.state.now);
    assert.equal(snapshot.notes[0]?.link, `focusflow://notes/${old}`);
    assert.equal(noteLink('x'), 'focusflow://notes/x');
    assert.deepEqual([snapshot.notes[0]?.pinned, snapshot.notes[1]?.pinned], [true, false]);
  });

  it('hides locked text, names untitled notes and leaves out archived and trashed ones', async () => {
    await add('Secret', { locked: true, body: 'private words' });
    await add('', { body: 'plain' });
    const archived = await add('Archived');
    const trashed = await add('Trashed');
    await n.notes.archive([archived]);
    await n.notes.trash([trashed]);
    const { notes } = await n.widgets.snapshot();
    assert.deepEqual(
      notes.map((note) => [note.title, note.excerpt, note.locked]),
      [
        ['Untitled', 'plain', false],
        ['Secret', '', true],
      ],
    );
  });

  it('is capped, and refreshed whenever the notes change', async () => {
    for (let index = 0; index < WIDGET_NOTE_LIMIT + 3; index += 1) {
      await add(`Note ${index}`);
    }
    await settle();
    assert.equal(read()?.notes.length, WIDGET_NOTE_LIMIT);
    assert.equal(read()?.notes[0]?.title, `Note ${WIDGET_NOTE_LIMIT + 2}`);

    const [first] = read()?.notes ?? [];
    await n.notes.setPinned(first!.id, false);
    await n.notes.trash([first!.id]);
    await settle();
    assert.notEqual(read()?.notes[0]?.title, `Note ${WIDGET_NOTE_LIMIT + 2}`);
  });
});
