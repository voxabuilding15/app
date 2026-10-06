import { Stack } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button, Card, Chip, Screen, Text, WRAP_ROW } from '@/components';
import { spacing } from '@/theme';

import { LockGate } from '../components/LockGate';
import { PinSheet } from '../components/PinSheet';
import { useLock } from '../view-models/useLock';

const METHOD_LABEL = {
  none: 'Off',
  device: 'Fingerprint, face or screen lock',
  pin: 'PIN',
} as const;

/** Choose how locked notes are opened. */
export function LockSettingsScreen() {
  const lock = useLock();
  const [pinOpen, setPinOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (lock.method !== 'none' && !lock.unlocked) {
    return (
      <>
        <Stack.Screen options={{ title: 'Lock settings' }} />
        <Screen>
          <LockGate method={lock.method} unlock={lock.unlock} subject="Your notes" />
        </Screen>
      </>
    );
  }

  const run = async (action: () => Promise<{ ok: boolean; error?: string }>, done: string) => {
    const result = await action();
    setMessage(result.ok ? done : (result.error ?? 'Something went wrong.'));
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Lock settings' }} />
      <Screen>
        <Card style={{ gap: spacing.md }}>
          <Text variant="titleMedium" accessibilityRole="header">
            How locked notes open
          </Text>
          <Text tone="muted">
            Mark a note as locked in its settings. Locked notes hide their text in lists and search,
            and ask to be unlocked before opening. They lock again after 5 minutes or when you leave
            the app.
          </Text>
          <View style={WRAP_ROW}>
            <Chip
              label={METHOD_LABEL.device}
              selected={lock.method === 'device'}
              onPress={() => void run(lock.useDeviceAuth, 'Notes now use your phone’s lock')}
            />
            <Chip
              label={METHOD_LABEL.pin}
              selected={lock.method === 'pin'}
              onPress={() => setPinOpen(true)}
            />
            <Chip
              label={METHOD_LABEL.none}
              selected={lock.method === 'none'}
              onPress={() => void run(async () => lock.turnOff(), 'Locking is off')}
            />
          </View>
          {message ? (
            <View accessibilityLiveRegion="polite">
              <Text variant="bodyMedium">{message}</Text>
            </View>
          ) : null}
        </Card>
        <Text variant="labelSmall" tone="muted">
          Locking keeps notes private from anyone using your phone, but the text is stored on the
          device without encryption. Use your phone’s own encryption for full protection.
        </Text>
        {lock.method !== 'none' ? (
          <Button label="Lock now" icon="lock" variant="tonal" onPress={lock.lockNow} />
        ) : null}
      </Screen>
      {pinOpen ? (
        <PinSheet
          onSave={async (pin) => {
            const result = await lock.usePin(pin);
            if (result.ok) {
              setPinOpen(false);
              setMessage('Your PIN is set');
              return null;
            }
            return result.error;
          }}
          onClose={() => setPinOpen(false)}
        />
      ) : null}
    </>
  );
}
