import { DrawerContentScrollView, type DrawerContentComponentProps } from 'expo-router/drawer';
import { Image, View } from 'react-native';

import { Text } from '@/components';
import { APP_NAME } from '@/constants/app';
import { radius, spacing, useTheme } from '@/theme';

import { DrawerItem } from './DrawerItem';
import { DRAWER_ITEMS, HOME_ITEM } from './routes';

const LOGO = require('../../assets/images/logo.png');
const LOGO_SIZE = 48;
const MENU: readonly (typeof HOME_ITEM)[] = [HOME_ITEM, ...DRAWER_ITEMS];

export function DrawerContent({ state, navigation }: DrawerContentComponentProps) {
  const { colors } = useTheme();
  const activeName = state.routes[state.index]?.name;

  return (
    <DrawerContentScrollView
      style={{ backgroundColor: colors.surface }}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
    >
      <View
        accessibilityRole="header"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          paddingBottom: spacing.lg,
        }}
      >
        <Image
          source={LOGO}
          accessibilityIgnoresInvertColors
          style={{ width: LOGO_SIZE, height: LOGO_SIZE, borderRadius: radius.md }}
        />
        <Text variant="titleLarge">{APP_NAME}</Text>
      </View>
      {MENU.map((item) => (
        <DrawerItem
          key={item.name}
          item={item}
          active={activeName === item.name}
          onPress={navigation.navigate}
        />
      ))}
    </DrawerContentScrollView>
  );
}
