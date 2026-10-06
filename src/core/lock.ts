import { constantTimeEquals, stretchedHash } from './hash';
import type { Clock, KeyValueStorage } from './ports';

export type LockMethod = 'none' | 'device' | 'pin';

export interface LockConfig {
  method: LockMethod;
  pinHash: string | null;
  pinSalt: string | null;
}

const NO_LOCK: LockConfig = { method: 'none', pinHash: null, pinSalt: null };

/** Device authentication: fingerprint, face or the screen-lock PIN, pattern or password. */
export interface Authenticator {
  isAvailable(): Promise<boolean>;
  authenticate(reason: string): Promise<boolean>;
}

interface LockStore {
  read(): LockConfig;
  write(config: LockConfig): void;
}

const METHODS: readonly LockMethod[] = ['none', 'device', 'pin'];

/** Remembers how something is locked in the app's key-value storage, under `key`. */
export class StorageLockStore implements LockStore {
  constructor(
    private readonly storage: KeyValueStorage,
    private readonly key: string,
  ) {}

  read(): LockConfig {
    const raw = this.storage.getString(this.key);
    if (raw === undefined) {
      return NO_LOCK;
    }
    try {
      const data = JSON.parse(raw) as Partial<LockConfig>;
      if (!METHODS.includes(data.method as LockMethod)) {
        return NO_LOCK;
      }
      // A PIN lock without its hash could never be opened, so treat it as unlocked-by-device.
      if (
        data.method === 'pin' &&
        (typeof data.pinHash !== 'string' || typeof data.pinSalt !== 'string')
      ) {
        return NO_LOCK;
      }
      return {
        method: data.method as LockMethod,
        pinHash: data.pinHash ?? null,
        pinSalt: data.pinSalt ?? null,
      };
    } catch {
      return NO_LOCK;
    }
  }

  write(config: LockConfig): void {
    if (config.method === 'none') {
      this.storage.remove(this.key);
    } else {
      this.storage.setString(this.key, JSON.stringify(config));
    }
  }
}

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
  /** What is being locked, as it appears in messages: "notes" or "app". */
  subject?: string;
  /** How long it stays open after unlocking; `Infinity` keeps it open until `lockNow`. */
  unlockWindowMs?: number;
}

export function validatePin(pin: string): string | null {
  if (!/^\d+$/.test(pin)) {
    return 'Use digits only';
  }
  return pin.length < PIN_MIN_LENGTH || pin.length > PIN_MAX_LENGTH
    ? `Use ${PIN_MIN_LENGTH} to ${PIN_MAX_LENGTH} digits`
    : null;
}

export function createLockUseCases({
  store,
  authenticator,
  clock,
  newSalt,
  subject = 'notes',
  unlockWindowMs = UNLOCK_WINDOW_MS,
}: LockUseCaseDeps) {
  let unlockedUntil = 0;
  let failures = 0;
  let lockedOutUntil = 0;

  const method = () => store.read().method;
  const isUnlocked = () => method() === 'none' || clock.now() < unlockedUntil;
  const openFor = () => {
    unlockedUntil = clock.now() + unlockWindowMs;
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
        if (!(await authenticator.authenticate(`Unlock your ${subject}`))) {
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
        return { ok: false, error: `Unlock your ${subject} first.` };
      }
      if (!(await authenticator.isAvailable())) {
        return {
          ok: false,
          error:
            'Set up a fingerprint, face or screen lock in your phone settings first, or use a PIN.',
        };
      }
      if (!(await authenticator.authenticate(`Confirm to protect your ${subject}`))) {
        return { ok: false, error: 'Authentication was cancelled.' };
      }
      store.write({ method: 'device', pinHash: null, pinSalt: null });
      openFor();
      return { ok: true };
    },

    async usePin(pin: string): Promise<LockChangeResult> {
      if (method() !== 'none' && !isUnlocked()) {
        return { ok: false, error: `Unlock your ${subject} first.` };
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

    /**
     * Removes the lock without asking, for when it can no longer be satisfied (the phone's own
     * lock was removed). Callers must make clear that this is what they are doing.
     */
    reset(): void {
      store.write(NO_LOCK);
      unlockedUntil = 0;
      failures = 0;
    },

    /** Turns locking off. Notes marked as locked simply open normally afterwards. */
    turnOff(): LockChangeResult {
      if (method() !== 'none' && !isUnlocked()) {
        return { ok: false, error: `Unlock your ${subject} first.` };
      }
      store.write(NO_LOCK);
      unlockedUntil = 0;
      return { ok: true };
    },
  };
}

export type LockUseCases = ReturnType<typeof createLockUseCases>;
