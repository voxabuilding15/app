import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import type { LockChangeResult, LockMethod, LockUseCases, UnlockResult } from '@/core';
import { useTranslator } from '@/i18n';

export interface LockStatus {
  method: LockMethod;
  unlocked: boolean;
}

/** How something is locked and whether it is open right now, refreshed whenever `key` is invalidated. */
function useLockStatus(lock: LockUseCases, key: readonly unknown[]): LockStatus {
  const { data } = useQuery({
    queryKey: key,
    queryFn: (): LockStatus => ({ method: lock.method(), unlocked: lock.isUnlocked() }),
    initialData: () => ({ method: lock.method(), unlocked: lock.isUnlocked() }),
    staleTime: 0,
  });
  return data;
}

/** The lock state and the actions that change it, keeping every screen that shows it in sync. */
export function useLockController(lock: LockUseCases, key: readonly unknown[]) {
  const client = useQueryClient();
  const status = useLockStatus(lock, key);
  const refresh = useCallback(() => client.invalidateQueries({ queryKey: key }), [client, key]);

  const unlock = useCallback(
    async (pin?: string): Promise<UnlockResult> => {
      const result = await lock.unlock(pin);
      await refresh();
      return result;
    },
    [lock, refresh],
  );

  const change = useCallback(
    async (
      action: () => Promise<LockChangeResult> | LockChangeResult,
    ): Promise<LockChangeResult> => {
      const result = await action();
      await refresh();
      return result;
    },
    [refresh],
  );

  return {
    ...status,
    unlock,
    lockNow: useCallback(() => {
      lock.lockNow();
      void refresh();
    }, [lock, refresh]),
    useDeviceAuth: useCallback(() => change(() => lock.useDeviceAuth()), [change, lock]),
    usePin: useCallback((pin: string) => change(() => lock.usePin(pin)), [change, lock]),
    turnOff: useCallback(() => change(() => lock.turnOff()), [change, lock]),
  };
}

export type LockController = ReturnType<typeof useLockController>;

/** What a PIN pad should say after an attempt. */
export function useUnlockPrompt(unlock: (pin?: string) => Promise<UnlockResult>) {
  const { t, tn } = useTranslator();
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
            `${t('Wrong PIN.')} ${tn(result.attemptsLeft, '{count} try left.', '{count} tries left.')}`,
          );
          break;
        case 'locked-out':
          setMessage(
            t('Too many attempts. Try again in {seconds} seconds.', {
              seconds: Math.ceil(result.retryInMs / 1000),
            }),
          );
          break;
        case 'unavailable':
          setMessage(t('Fingerprint, face or screen lock is not set up on this phone.'));
          break;
        default:
          setMessage(t('Authentication was cancelled.'));
      }
      return false;
    },
    [unlock, t, tn],
  );

  return { message, busy, attempt };
}
