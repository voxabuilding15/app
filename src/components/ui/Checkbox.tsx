import { View } from 'react-native';

import { MIN_TOUCH_TARGET, useTheme } from '@/theme';

import { Icon } from './Icon';
import { PressableScale } from './PressableScale';

const BOX_SIZE = 24;

export interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}

/** Round checkbox with a 48dp touch target around a 24dp visual. */
export function Checkbox({ checked, onChange, label, disabled }: CheckboxProps) {
  const { colors } = useTheme();

  return (
    <PressableScale
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked, disabled: disabled ?? false }}
      disabled={disabled}
      haptic="light"
      pressedScale={0.9}
      onPress={() => onChange(!checked)}
      style={{ width: MIN_TOUCH_TARGET, height: MIN_TOUCH_TARGET }}
    >
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <View
          style={{
            width: BOX_SIZE,
            height: BOX_SIZE,
            borderRadius: BOX_SIZE / 2,
            borderWidth: 2,
            borderColor: checked ? colors.primary : colors.outline,
            backgroundColor: checked ? colors.primary : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {checked ? <Icon name="check" size={16} color={colors.onPrimary} /> : null}
        </View>
      </View>
    </PressableScale>
  );
}
