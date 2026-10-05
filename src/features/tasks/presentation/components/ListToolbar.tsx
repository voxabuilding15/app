import { DrawerToggleButton } from 'expo-router/drawer';
import { View } from 'react-native';

import { IconButton, Text } from '@/components';
import { useIsTablet } from '@/hooks';
import { spacing, useTheme } from '@/theme';

interface ListToolbarProps {
  searchOpen: boolean;
  onToggleSearch: () => void;
  onSelect: () => void;
  onManage: () => void;
}

export function ListToolbar({ searchOpen, onToggleSearch, onSelect, onManage }: ListToolbarProps) {
  const { colors } = useTheme();
  const isTablet = useIsTablet();

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm }}>
      {isTablet ? (
        <View style={{ width: spacing.md }} />
      ) : (
        <DrawerToggleButton tintColor={colors.onSurface} />
      )}
      <Text variant="titleLarge" accessibilityRole="header" style={{ flex: 1 }}>
        Tasks
      </Text>
      <IconButton
        icon={searchOpen ? 'close' : 'search'}
        label={searchOpen ? 'Close search' : 'Search tasks'}
        onPress={onToggleSearch}
      />
      <IconButton icon="checklist" label="Select tasks" onPress={onSelect} />
      <IconButton icon="label" label="Manage categories and labels" onPress={onManage} />
    </View>
  );
}
