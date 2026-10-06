import { constantTimeEquals, stretchedHash, type Clock } from '@/core';

import type { Authenticator, LockStore } from './ports';

export type LockMethod = 'none' | 'device' | 'pin';

export interface LockConfig {
  method: LockMethod;
  pinHash: string | null;
  pinSalt: string | null;
}

export const NO_LOCK: LockConfig = { method: 'none', pinHash: null, pinSalt: null };

export const PIN_MIN_LENGTH = 4;
export const PIN_MAX_LENGTH = 8;
const PIN_ROUNDS = 5_000;
/** Notes stay open for this long after unlocking, or until the app goes to the background. */
export const UNLOCK_WINDOW_MS = 5 * 60_000;
export const MAX_PIN_ATTEMPTS = 5;
export const LOCKOUT_MS = 30_000;

export type UnlockResult =
  | { ok: true }
  | { ok: false; reason: 'wrong-pin'; attemptsLeft: number }
  | { ok: false; reason: 'locked-out'; retryInMs: number }
  | { ok: false; reason: 'cancelled' | 'unavailable' };

export type LockChangeResult = { ok: true } | { ok: false; error: string };

interface LockUseCaseDeps {
  store: LockStore;
  authenticator: Authenticator;
  clock: Clock;
  /** Random text mixed into the PIN hash. */
  newSalt: () => string;
}

export function validatePin(pin: string): string | null {
  if (!/^\d+$/.test(pin)) {
    return 'Use digits only';
  }
  return pin.length < PIN_MIN_LENGTH || pin.length > PIN_MAX_LENGTH
    ? `Use ${PIN_MIN_LENGTH} to ${PIN_MAX_LENGTH} digits`
    : null;
}

export function createLockUseCases({ store, authenticator, clock, newSalt }: LockUseCaseDeps) {
  let unlockedUntil = 0;
  let failures = 0;
  let lockedOutUntil = 0;

  const method = () => store.read().method;
  const isUnlocked = () => method() === 'none' || clock.now() < unlockedUntil;
  const openFor = () => {
    unlockedUntil = clock.now() + UNLOCK_WINDOW_MS;
    failures = 0;
  };

  return {
    method,

    /** True when locked notes can be read right now. */
    isUnlocked,

    /** Locks again immediately, e.g. when the app goes to the background. */
    lockNow(): void {
      unlockedUntil = 0;
    },

    async unlock(pin?: string): Promise<UnlockResult> {
      const config = store.read();
      if (config.method === 'none') {
        return { ok: true };
      }
      if (config.method === 'device') {
        if (!(await authenticator.isAvailable())) {
          return { ok: false, reason: 'unavailable' };
        }
        if (!(await authenticator.authenticate('Unlock your notes'))) {
          return { ok: false, reason: 'cancelled' };
        }
        openFor();
        return { ok: true };
      }

      const now = clock.now();
      if (now < lockedOutUntil) {
        return { ok: false, reason: 'locked-out', retryInMs: lockedOutUntil - now };
      }
      const matches =
        pin !== undefined &&
        config.pinHash !== null &&
        config.pinSalt !== null &&
        constantTimeEquals(stretchedHash(pin, config.pinSalt, PIN_ROUNDS), config.pinHash);
      if (matches) {
        openFor();
        return { ok: true };
      }
      failures += 1;
      if (failures >= MAX_PIN_ATTEMPTS) {
        failures = 0;
        lockedOutUntil = now + LOCKOUT_MS;
        return { ok: false, reason: 'locked-out', retryInMs: LOCKOUT_MS };
      }
      return { ok: false, reason: 'wrong-pin', attemptsLeft: MAX_PIN_ATTEMPTS - failures };
    },

    /** Uses the phone's own fingerprint, face or screen lock. */
    async useDeviceAuth(): Promise<LockChangeResult> {
      if (method() !== 'none' && !isUnlocked()) {
        return { ok: false, error: 'Unlock your notes first.' };
      }
      if (!(await authenticator.isAvailable())) {
        return {
          ok: false,
          error:
            'Set up a fingerprint, face or screen lock in your phone settings first, or use a PIN.',
        };
      }
      if (!(await authenticator.authenticate('Confirm to protect your notes'))) {
        return { ok: false, error: 'Authentication was cancelled.' };
      }
      store.write({ method: 'device', pinHash: null, pinSalt: null });
      openFor();
      return { ok: true };
    },

    async usePin(pin: string): Promise<LockChangeResult> {
      if (method() !== 'none' && !isUnlocked()) {
        return { ok: false, error: 'Unlock your notes first.' };
      }
      const problem = validatePin(pin);
      if (problem !== null) {
        return { ok: false, error: problem };
      }
      const salt = newSalt();
      store.write({ method: 'pin', pinSalt: salt, pinHash: stretchedHash(pin, salt, PIN_ROUNDS) });
      openFor();
      return { ok: true };
    },

    /** Turns locking off. Notes marked as locked simply open normally afterwards. */
    turnOff(): LockChangeResult {
      if (method() !== 'none' && !isUnlocked()) {
        return { ok: false, error: 'Unlock your notes first.' };
      }
      store.write(NO_LOCK);
      unlockedUntil = 0;
      return { ok: true };
    },
  };
}

export type LockUseCases = ReturnType<typeof createLockUseCases>;
