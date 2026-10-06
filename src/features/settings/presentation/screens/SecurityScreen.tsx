import { Stack } from 'expo-router';

import { Card, LockSettingsPanel, Screen, SegmentedControl, Text } from '@/components';
import { useLockController } from '@/hooks';
import { useTranslator } from '@/i18n';
import { spacing } from '@/theme';
import { useState } from 'react';

import { LOCK_DELAYS, type LockDelay } from '../../domain/security';
import { APP_LOCK_QUERY_KEY } from '../components/AppLockGate';
import { useSettingsModule } from '../module';

export function SecurityScreen() {
  const { appLock, security } = useSettingsModule();
  const lock = useLockController(appLock, APP_LOCK_QUERY_KEY);
  const { t } = useTranslator();
  const [delay, setDelay] = useState<LockDelay>(() => security.read().lockDelaySeconds);

  const labels: Record<LockDelay, string> = {
    0: t('Immediately'),
    60: t('After 1 minute'),
    300: t('After 5 minutes'),
  };

  return (
    <>
      <Stack.Screen options={{ title: t('Security') }} />
      <Screen>
        <LockSettingsPanel
          lock={lock}
          copy={{
            title: t('App lock'),
            description: t(
              'Ask for your fingerprint, face, screen lock or a PIN before FocusFlow opens.',
            ),
            footnote: t(
              'If you forget your PIN you can still get back in, but only by erasing all data in the app. Backups kept on the device are erased too. The lock keeps other people out of the app; the data itself is not encrypted.',
            ),
            deviceDone: t('The app now uses your phone’s lock'),
            subject: t('FocusFlow'),
            protects: t('FocusFlow'),
          }}
        />
        {lock.method !== 'none' && lock.unlocked ? (
          <Card style={{ gap: spacing.md }}>
            <Text variant="titleMedium" accessibilityRole="header">
              {t('Lock when I leave the app')}
            </Text>
            <SegmentedControl
              options={LOCK_DELAYS.map((value) => ({ value: String(value), label: labels[value] }))}
              value={String(delay)}
              onChange={(value) => {
                const next = Number(value) as LockDelay;
                security.write({ lockDelaySeconds: next });
                setDelay(next);
              }}
            />
          </Card>
        ) : null}
      </Screen>
    </>
  );
}
