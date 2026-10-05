import { useState } from 'react';
import { View } from 'react-native';

import { Button, Input, PressableScale, Sheet, Text } from '@/components';
import { ACCENT_COLORS, MIN_TOUCH_TARGET, spacing, useTheme } from '@/theme';

import { NAME_MAX_LENGTH } from '../../domain/validation';

interface NameColorSheetProps {
  title: string;
  initialName: string;
  initialColor: string;
  /** Resolves to an error message to show, or null once saved. */
  onSave: (name: string, color: string) => Promise<string | null>;
  onClose: () => void;
}

/** Mount only while open so each opening starts from fresh state. */
export function NameColorSheet({
  title,
  initialName,
  initialColor,
  onSave,
  onClose,
}: NameColorSheetProps) {
  const { colors } = useTheme();
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
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {ACCENT_COLORS.map((option, index) => {
            const selected = option === color;
            return (
              <PressableScale
                key={option}
                accessibilityRole="radio"
                accessibilityLabel={`Color ${index + 1} of ${ACCENT_COLORS.length}`}
                accessibilityState={{ selected }}
                haptic="selection"
                onPress={() => setColor(option)}
                style={{ width: MIN_TOUCH_TARGET, height: MIN_TOUCH_TARGET }}
              >
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: option,
                      borderWidth: selected ? 3 : 0,
                      borderColor: colors.onSurface,
                    }}
                  />
                </View>
              </PressableScale>
            );
          })}
        </View>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.md }}>
        <Button label="Cancel" variant="outlined" onPress={onClose} />
        <Button label="Save" loading={busy} onPress={() => void submit()} />
      </View>
    </Sheet>
  );
}
