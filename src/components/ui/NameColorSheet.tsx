import { useState } from 'react';
import { View } from 'react-native';

import { NAME_MAX_LENGTH } from '@/core';
import { spacing } from '@/theme';

import { Button } from './Button';
import { ColorSwatches } from './ColorSwatches';
import { Input } from './Input';
import { Sheet } from './Sheet';
import { Text } from './Text';

interface NameColorSheetProps {
  title: string;
  initialName: string;
  initialColor: string;
  /** Resolves to an error message to show, or null once saved. */
  onSave: (name: string, color: string) => Promise<string | null>;
  onClose: () => void;
}

/** Sheet to create or edit a named, colored item. Mount only while open so state starts fresh. */
export function NameColorSheet({
  title,
  initialName,
  initialColor,
  onSave,
  onClose,
}: NameColorSheetProps) {
  const [name, setName] = useState(initialName);
  const [color, setColor] = useState(initialColor);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(await onSave(name, color));
    setBusy(false);
  };

  return (
    <Sheet visible title={title} onClose={onClose}>
      <Input
        label="Name"
        value={name}
        onChangeText={(text) => {
          setName(text);
          setError(null);
        }}
        error={error ?? undefined}
        maxLength={NAME_MAX_LENGTH}
        autoFocus
        returnKeyType="done"
        onSubmitEditing={() => void submit()}
      />
      <View style={{ gap: spacing.sm }}>
        <Text variant="labelSmall" tone="muted">
          Color
        </Text>
        <ColorSwatches value={color} onChange={setColor} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.md }}>
        <Button label="Cancel" variant="outlined" onPress={onClose} />
        <Button label="Save" loading={busy} onPress={() => void submit()} />
      </View>
    </Sheet>
  );
}
