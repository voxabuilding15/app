import { View } from 'react-native';

import { Text } from '@/components/ui';
import { spacing } from '@/theme';

interface LegendItem {
  label: string;
  color: string;
}

interface ChartLegendProps {
  items: readonly LegendItem[];
}

/** Color key shown under a chart with more than one series. */
export function ChartLegend({ items }: ChartLegendProps) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}
    >
      {items.map((item) => (
        <View
          key={item.label}
          style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}
        >
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: item.color }} />
          <Text variant="labelSmall" tone="muted">
            {item.label}
          </Text>
        </View>
      ))}
    </View>
  );
}
