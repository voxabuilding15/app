import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';

import { useTheme } from '@/theme';

export type IconName = ComponentProps<typeof MaterialIcons>['name'];

export interface IconProps {
  name: IconName;
  size?: number;
  color?: ColorValue;
}

export function Icon({ name, size = 24, color }: IconProps) {
  const { colors } = useTheme();
  return (
    <MaterialIcons
      name={name}
      size={size}
      color={color ?? colors.onSurfaceVariant}
      accessible={false}
      importantForAccessibility="no"
    />
  );
}
