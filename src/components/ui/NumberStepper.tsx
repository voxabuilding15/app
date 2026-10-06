import { View } from 'react-native';

import { spacing } from '@/theme';

import { IconButton } from './IconButton';
import { Text } from './Text';
import { useTranslator } from '@/i18n';

interface NumberStepperProps {
  value: number;
  min?: number;
  max: number;
  onChange: (value: number) => void;
  /** Spoken name of what is being counted, e.g. "Goal per day". */
  label: string;
  /** Shown after the number, e.g. "/ 8". */
  suffix?: string;
}

/** Minus / value / plus control. Also exposes increment and decrement actions to screen readers. */
export function NumberStepper({
  value,
  min = 0,
  max,
  onChange,
  label,
  suffix,
}: NumberStepperProps) {
  const { t } = useTranslator();
  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min, max, now: value }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={({ nativeEvent }) => {
        if (nativeEvent.actionName === 'increment' && value < max) {
          onChange(value + 1);
        } else if (nativeEvent.actionName === 'decrement' && value > min) {
          onChange(value - 1);
        }
      }}
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}
    >
      <IconButton
        icon="remove"
        label={t('Decrease {name}', { name: label })}
        tinted
        disabled={value <= min}
        onPress={() => onChange(value - 1)}
      />
      <Text variant="titleMedium" style={{ minWidth: 40, textAlign: 'center' }}>
        {suffix ? `${value} ${suffix}` : String(value)}
      </Text>
      <IconButton
        icon="add"
        label={t('Increase {name}', { name: label })}
        tinted
        disabled={value >= max}
        onPress={() => onChange(value + 1)}
      />
    </View>
  );
}
