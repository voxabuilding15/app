import { useState } from 'react';
import { View } from 'react-native';

import type { LockController } from '@/hooks/useLockController';
import { useTranslator } from '@/i18n';
import { spacing } from '@/theme';

import { Button } from './Button';
import { Card } from './Card';
import { Chip } from './Chip';
import { ChipGroup } from './ChipGroup';
import { LockGate } from './LockGate';
import { PinSheet } from './PinSheet';
import { Text } from './Text';

export interface LockSettingsCopy {
  /** Heading of the card, e.g. "How locked notes open". */
  title: string;
  description: string;
  /** Fine print under the card. */
  footnote: string;
  /** Shown after switching to the phone's own lock. */
  deviceDone: string;
  /** Names what is locked, for the unlock screen: "Your notes". */
  subject: string;
  /** What a forgotten PIN would lock out: "locked notes". */
  protects: string;
}

/** Choose how something is unlocked: the phone's own lock, a PIN, or nothing. */
export function LockSettingsPanel({
  lock,
  copy,
}: {
  lock: LockController;
  copy: LockSettingsCopy;
}) {
  const { t } = useTranslator();
  const [pinOpen, setPinOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (lock.method !== 'none' && !lock.unlocked) {
    return <LockGate method={lock.method} unlock={lock.unlock} subject={copy.subject} />;
  }

  const run = async (action: () => Promise<{ ok: boolean; error?: string }>, done: string) => {
    const result = await action();
    setMessage(result.ok ? done : t(result.error ?? 'Something went wrong.'));
  };

  return (
    <>
      <Card style={{ gap: spacing.md }}>
        <Text variant="titleMedium" accessibilityRole="header">
          {copy.title}
        </Text>
        <Text tone="muted">{copy.description}</Text>
        <ChipGroup title={t('Unlock with')}>
          <Chip
            label={t('Fingerprint, face or screen lock')}
            selected={lock.method === 'device'}
            onPress={() => void run(lock.useDeviceAuth, copy.deviceDone)}
          />
          <Chip
            label={t('PIN')}
            selected={lock.method === 'pin'}
            onPress={() => setPinOpen(true)}
          />
          <Chip
            label={t('Off')}
            selected={lock.method === 'none'}
            onPress={() => void run(async () => lock.turnOff(), t('Locking is off'))}
          />
        </ChipGroup>
        {message ? (
          <View accessibilityLiveRegion="polite">
            <Text variant="bodyMedium">{message}</Text>
          </View>
        ) : null}
      </Card>
      <Text variant="labelSmall" tone="muted">
        {copy.footnote}
      </Text>
      {lock.method !== 'none' ? (
        <Button label={t('Lock now')} icon="lock" variant="tonal" onPress={lock.lockNow} />
      ) : null}
      {pinOpen ? (
        <PinSheet
          protects={copy.protects}
          onSave={async (pin) => {
            const result = await lock.usePin(pin);
            if (result.ok) {
              setPinOpen(false);
              setMessage(t('Your PIN is set'));
              return null;
            }
            return t(result.error);
          }}
          onClose={() => setPinOpen(false)}
        />
      ) : null}
    </>
  );
}
