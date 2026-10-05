import { View } from 'react-native';

import { MIN_TOUCH_TARGET, radius, useTheme } from '@/theme';

import { Icon, type IconName } from './Icon';
import { PressableScale } from './PressableScale';

interface IconPickerProps {
  icons: readonly IconName[];
  value: IconName;
  onChange: (icon: IconName) => void;
  /** Tints the selected icon, e.g. with the item's chosen color. */
  accent: string;
}

/** Radio grid of icons with 48dp touch targets. */
export function IconPicker({ icons, value, onChange, accent }: IconPickerProps) {
  const { colors } = useTheme();

  return (
    <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {icons.map((icon) => {
        const selected = icon === value;
        return (
          <PressableScale
            key={icon}
            accessibilityRole="radio"
            accessibilityLabel={icon.replace(/-/g, ' ')}
            accessibilityState={{ selected }}
            haptic="selection"
            onPress={() => onChange(icon)}
            style={{ width: MIN_TOUCH_TARGET, height: MIN_TOUCH_TARGET }}
          >
            <View
              style={{
                flex: 1,
                margin: 2,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: radius.md,
                backgroundColor: selected ? accent : 'transparent',
              }}
            >
              <Icon name={icon} color={selected ? colors.surface : colors.onSurfaceVariant} />
            </View>
          </PressableScale>
        );
      })}
    </View>
  );
}
