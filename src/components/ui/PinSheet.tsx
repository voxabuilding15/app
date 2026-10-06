import { useState } from 'react';
import { View } from 'react-native';

import { PIN_MAX_LENGTH, PIN_MIN_LENGTH } from '@/core';
import { useTranslator } from '@/i18n';
import { spacing } from '@/theme';

import { Button } from './Button';
import { Input } from './Input';
import { Sheet } from './Sheet';
import { Text } from './Text';

interface PinSheetProps {
  /** Resolves to an error message, or null once the PIN is saved. */
  onSave: (pin: string) => Promise<string | null>;
  onClose: () => void;
  /** What the PIN protects, already translated and in the plural, e.g. "locked notes". */
  protects: string;
}

/** Sheet to choose a PIN, typed twice. Mount only while open so state starts fresh. */
export function PinSheet({ onSave, onClose, protects }: PinSheetProps) {
  const { t } = useTranslator();
  const [pin, setPin] = useState('');
  const [again, setAgain] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (pin !== again) {
      setError(t('The two PINs do not match'));
      return;
    }
    setBusy(true);
    setError(await onSave(pin));
    setBusy(false);
  };

  return (
    <Sheet visible title={t('Choose a PIN')} onClose={onClose}>
      <Text variant="bodyMedium" tone="muted">
        {t(
          'Use {min} to {max} digits. If you forget it, {what} cannot be opened, so pick something you will remember.',
          { min: PIN_MIN_LENGTH, max: PIN_MAX_LENGTH, what: protects },
        )}
      </Text>
      <Input
        label={t('New PIN')}
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
        label={t('Repeat PIN')}
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
        <Button label={t('Cancel')} variant="outlined" onPress={onClose} />
        <Button label={t('Save PIN')} loading={busy} onPress={() => void submit()} />
      </View>
    </Sheet>
  );
}
