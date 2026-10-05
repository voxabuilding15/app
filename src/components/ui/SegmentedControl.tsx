import { View } from 'react-native';

import { useHaptics } from '@/hooks';
import { MIN_TOUCH_TARGET, radius, useTheme } from '@/theme';

import { PressableScale } from './PressableScale';
import { Text } from './Text';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedControlProps<T extends string> {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  const { colors } = useTheme();
  const haptics = useHaptics();

  return (
    <View
      accessibilityRole="radiogroup"
      style={{
        flexDirection: 'row',
        borderRadius: radius.full,
        borderWidth: 1,
        borderColor: colors.outline,
        overflow: 'hidden',
      }}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <PressableScale
            key={option.value}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ selected }}
            pressedScale={0.99}
            onPress={() => {
              haptics.selection();
              onChange(option.value);
            }}
            style={{
              flex: 1,
              minHeight: MIN_TOUCH_TARGET - 8,
              backgroundColor: selected ? colors.secondaryContainer : 'transparent',
            }}
          >
            <View
              style={{
                minHeight: MIN_TOUCH_TARGET - 8,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text
                variant="labelLarge"
                style={{ color: selected ? colors.onSecondaryContainer : colors.onSurface }}
              >
                {option.label}
              </Text>
            </View>
          </PressableScale>
        );
      })}
    </View>
  );
}
