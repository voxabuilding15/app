import { View } from 'react-native';

import { MIN_TOUCH_TARGET, radius, useTheme } from '@/theme';

import { PressableScale } from './PressableScale';
import { Text } from './Text';

interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedControlProps<T extends string> {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

const SEGMENT_HEIGHT = MIN_TOUCH_TARGET;

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  const { colors } = useTheme();

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
            haptic="selection"
            pressedScale={0.99}
            onPress={() => onChange(option.value)}
            style={{
              flex: 1,
              backgroundColor: selected ? colors.secondaryContainer : 'transparent',
            }}
          >
            <View
              style={{ height: SEGMENT_HEIGHT, alignItems: 'center', justifyContent: 'center' }}
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
