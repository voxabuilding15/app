import { View } from 'react-native';

import { Icon, PressableScale, Text } from '@/components';
import { radius, spacing, useTheme } from '@/theme';

import type { NavItem } from './routes';

interface DrawerItemProps {
  item: NavItem;
  active: boolean;
  onPress: (name: string) => void;
}

export function DrawerItem({ item, active, onPress }: DrawerItemProps) {
  const { colors } = useTheme();
  const color = active ? colors.onSecondaryContainer : colors.onSurfaceVariant;

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={item.title}
      accessibilityState={{ selected: active }}
      pressedScale={0.99}
      onPress={() => onPress(item.name)}
      style={{
        borderRadius: radius.full,
        backgroundColor: active ? colors.secondaryContainer : 'transparent',
      }}
    >
      <View
        style={{
          minHeight: 56,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.lg,
          paddingHorizontal: spacing.lg,
        }}
      >
        <Icon name={item.icon} color={color} />
        <Text variant="labelLarge" style={{ color }}>
          {item.title}
        </Text>
      </View>
    </PressableScale>
  );
}
