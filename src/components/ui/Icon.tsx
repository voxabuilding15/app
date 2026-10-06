import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { ComponentProps } from 'react';
import { I18nManager, type ColorValue } from 'react-native';

import { useTheme } from '@/theme';

export type IconName = ComponentProps<typeof MaterialIcons>['name'];

export interface IconProps {
  name: IconName;
  size?: number;
  color?: ColorValue;
}

/**
 * Icons that point somewhere or show a direction of text, which flip when the layout reads right
 * to left. Media controls (play, skip) and symmetrical icons are left alone.
 */
const MIRRORED_IN_RTL: ReadonlySet<string> = new Set([
  'arrow-back',
  'arrow-forward',
  'arrow-back-ios',
  'arrow-forward-ios',
  'chevron-left',
  'chevron-right',
  'navigate-before',
  'navigate-next',
  'keyboard-arrow-left',
  'keyboard-arrow-right',
  'first-page',
  'last-page',
  'undo',
  'redo',
  'reply',
  'send',
  'logout',
  'format-list-bulleted',
  'format-list-numbered',
  'format-quote',
  'format-indent-increase',
  'format-indent-decrease',
  'trending-up',
  'trending-down',
]);

export function Icon({ name, size = 24, color }: IconProps) {
  const { colors } = useTheme();
  return (
    <MaterialIcons
      name={name}
      size={size}
      color={color ?? colors.onSurfaceVariant}
      style={
        I18nManager.isRTL && MIRRORED_IN_RTL.has(name) ? { transform: [{ scaleX: -1 }] } : undefined
      }
      accessible={false}
      importantForAccessibility="no"
    />
  );
}
