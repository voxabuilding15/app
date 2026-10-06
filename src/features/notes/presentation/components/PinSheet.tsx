import { useState } from 'react';
import { View } from 'react-native';

import { Button, Input, Sheet, Text } from '@/components';
import { spacing } from '@/theme';

import { PIN_MAX_LENGTH, PIN_MIN_LENGTH } from '../../domain/lock';

interface PinSheetProps {
  /** Resolves to an error message, or null once the PIN is saved. */
  onSave: (pin: string) => Promise<string | null>;
  onClose: () => void;
}

/** Sheet to choose a PIN, typed twice. Mount only while open so state starts fresh. */
export function PinSheet({ onSave, onClose }: PinSheetProps) {
  const [pin, setPin] = useState('');
  const [again, setAgain] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (pin !== again) {
      setError('The two PINs do not match');
      return;
    }
    setBusy(true);
    setError(await onSave(pin));
    setBusy(false);
  };

  return (
    <Sheet visible title="Choose a PIN" onClose={onClose}>
      <Text variant="bodyMedium" tone="muted">
        {`Use ${PIN_MIN_LENGTH} to ${PIN_MAX_LENGTH} digits. If you forget it, locked notes cannot be opened, so pick something you will remember.`}
      </Text>
      <Input
        label="New PIN"
        value={pin}
        onChangeText={(text) => {
          setPin(text);
          setError(null);
        }}
        secureTextEntry
        keyboardType="number-pad"
        maxLength={PIN_MAX_LENGTH}
        autoFocus
      />
      <Input
        label="Repeat PIN"
        value={again}
        onChangeText={(text) => {
          setAgain(text);
          setError(null);
        }}
        secureTextEntry
        keyboardType="number-pad"
        maxLength={PIN_MAX_LENGTH}
        error={error ?? undefined}
        onSubmitEditing={() => void submit()}
      />
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.md }}>
        <Button label="Cancel" variant="outlined" onPress={onClose} />
        <Button label="Save PIN" loading={busy} onPress={() => void submit()} />
      </View>
    </Sheet>
  );
}
