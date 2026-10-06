import { View } from 'react-native';

import { ACCENT_COLORS, MIN_TOUCH_TARGET, useTheme } from '@/theme';

import { PressableScale } from './PressableScale';
import { useTranslator } from '@/i18n';

interface ColorSwatchesProps {
  value: string;
  onChange: (color: string) => void;
}

const SWATCH_SIZE = 32;

/** Radio group of the shared accent palette with 48dp touch targets. */
export function ColorSwatches({ value, onChange }: ColorSwatchesProps) {
  const { t } = useTranslator();
  const { colors } = useTheme();

  return (
    <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {ACCENT_COLORS.map((option, index) => {
        const selected = option === value;
        return (
          <PressableScale
            key={option}
            accessibilityRole="radio"
            accessibilityLabel={t('Color {number} of {total}', {
              number: index + 1,
              total: ACCENT_COLORS.length,
            })}
            accessibilityState={{ selected }}
            haptic="selection"
            onPress={() => onChange(option)}
            style={{ width: MIN_TOUCH_TARGET, height: MIN_TOUCH_TARGET }}
          >
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <View
                style={{
                  width: SWATCH_SIZE,
                  height: SWATCH_SIZE,
                  borderRadius: SWATCH_SIZE / 2,
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
  );
}
