import { useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { Alert, AppState, View } from 'react-native';

import { Button, LockGate } from '@/components';
import { useLockController } from '@/hooks';
import { useTranslator } from '@/i18n';
import { spacing, useTheme } from '@/theme';

import { useBackupModule } from '../../../backup/presentation/module';
import { useQueryClient } from '@tanstack/react-query';
import { useSettingsModule } from '../module';

export const APP_LOCK_QUERY_KEY = ['settings', 'app-lock'] as const;

/**
 * Covers the app until it is unlocked, when an app lock is set. The app underneath keeps running
 * (timers, notifications) but is hidden from the screen and from screen readers.
 */
export function AppLockGate({ children }: PropsWithChildren) {
  const { appLock, security } = useSettingsModule();
  const { backups } = useBackupModule();
  const lock = useLockController(appLock, APP_LOCK_QUERY_KEY);
  const { t } = useTranslator();
  const { colors } = useTheme();
  const client = useQueryClient();
  const leftAt = useRef<number | null>(null);
  const [cannotUnlock, setCannotUnlock] = useState(false);
  const locked = lock.method !== 'none' && !lock.unlocked;

  const { lockNow, unlock } = lock;
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      const delay = security.read().lockDelaySeconds;
      if (state === 'background') {
        leftAt.current = Date.now();
        if (delay === 0) {
          lockNow();
        }
      } else if (state === 'active') {
        const away = leftAt.current === null ? 0 : Date.now() - leftAt.current;
        leftAt.current = null;
        if (delay > 0 && away >= delay * 1000) {
          lockNow();
        }
      }
    });
    return () => subscription.remove();
  }, [security, lockNow]);

  // A device lock asks straight away; a PIN waits for the person to type it.
  const method = lock.method;
  useEffect(() => {
    if (locked && method === 'device') {
      void unlock().then((result) =>
        setCannotUnlock(!result.ok && result.reason === 'unavailable'),
      );
    }
  }, [locked, method, unlock]);

  const guarded = async (pin?: string) => {
    const result = await unlock(pin);
    setCannotUnlock(!result.ok && result.reason === 'unavailable');
    return result;
  };

  const reset = () =>
    Alert.alert(
      t('Erase everything and reset?'),
      t(
        'This deletes all data in FocusFlow on this device, including backups, and removes the app lock. It cannot be undone.',
      ),
      [
        { text: t('Cancel'), style: 'cancel' },
        {
          text: t('Erase and reset'),
          style: 'destructive',
          onPress: () => {
            // The lock goes only once the data has: nobody gets in by resetting.
            void backups
              .eraseEverything({ keepSafetyCopy: false })
              .then(() => {
                appLock.reset();
                return client.invalidateQueries();
              })
              .catch(() => undefined);
          },
        },
      ],
    );

  return (
    <View style={{ flex: 1 }}>
      <View
        style={{ flex: 1 }}
        importantForAccessibility={locked ? 'no-hide-descendants' : 'auto'}
        accessibilityElementsHidden={locked}
      >
        {children}
      </View>
      {locked && lock.method !== 'none' ? (
        <View
          accessibilityViewIsModal
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            backgroundColor: colors.background,
            alignItems: 'center',
            justifyContent: 'center',
            padding: spacing.xl,
            gap: spacing.lg,
          }}
        >
          <LockGate method={lock.method} unlock={guarded} subject={t('FocusFlow')} />
          {cannotUnlock ? (
            <Button
              label={t('Turn off app lock')}
              variant="tonal"
              onPress={() => {
                appLock.reset();
                void lock.unlock();
              }}
            />
          ) : null}
          {lock.method === 'pin' ? (
            <Button label={t('Forgot your PIN?')} variant="text" onPress={reset} />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
