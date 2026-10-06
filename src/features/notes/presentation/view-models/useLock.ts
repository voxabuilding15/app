import { useCallback, useState } from 'react';

import { useNotesModule } from '../module';
import { useInvalidateNotes, useLockStatus } from '../queries';

import type { LockChangeResult, UnlockResult } from '../../domain/lock';

/** Reads the lock state and exposes the actions that change it, keeping every screen in sync. */
export function useLock() {
  const { lock } = useNotesModule();
  const status = useLockStatus();
  const invalidate = useInvalidateNotes();

  const unlock = useCallback(
    async (pin?: string): Promise<UnlockResult> => {
      const result = await lock.unlock(pin);
      await invalidate();
      return result;
    },
    [lock, invalidate],
  );

  const change = useCallback(
    async (
      action: () => Promise<LockChangeResult> | LockChangeResult,
    ): Promise<LockChangeResult> => {
      const result = await action();
      await invalidate();
      return result;
    },
    [invalidate],
  );

  return {
    ...status,
    unlock,
    lockNow: useCallback(() => {
      lock.lockNow();
      void invalidate();
    }, [lock, invalidate]),
    useDeviceAuth: useCallback(() => change(() => lock.useDeviceAuth()), [change, lock]),
    usePin: useCallback((pin: string) => change(() => lock.usePin(pin)), [change, lock]),
    turnOff: useCallback(() => change(() => lock.turnOff()), [change, lock]),
  };
}

/** What a PIN pad should say after an attempt. */
export function useUnlockPrompt(unlock: (pin?: string) => Promise<UnlockResult>) {
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const attempt = useCallback(
    async (pin?: string) => {
      setBusy(true);
      const result = await unlock(pin);
      setBusy(false);
      if (result.ok) {
        setMessage(null);
        return true;
      }
      switch (result.reason) {
        case 'wrong-pin':
          setMessage(
            `Wrong PIN. ${result.attemptsLeft} ${result.attemptsLeft === 1 ? 'try' : 'tries'} left.`,
          );
          break;
        case 'locked-out':
          setMessage(
            `Too many attempts. Try again in ${Math.ceil(result.retryInMs / 1000)} seconds.`,
          );
          break;
        case 'unavailable':
          setMessage('Fingerprint, face or screen lock is not set up on this phone.');
          break;
        default:
          setMessage('Authentication was cancelled.');
      }
      return false;
    },
    [unlock],
  );

  return { message, busy, attempt };
}
