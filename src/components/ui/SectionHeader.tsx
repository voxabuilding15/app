import { View } from 'react-native';

import { Text } from './Text';

export interface SectionHeaderProps {
  title: string;
}

export function SectionHeader({ title }: SectionHeaderProps) {
  return (
    <View>
      <Text variant="titleMedium" accessibilityRole="header">
        {title}
      </Text>
    </View>
  );
}
