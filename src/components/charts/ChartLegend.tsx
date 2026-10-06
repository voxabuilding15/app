import { View } from 'react-native';

import { Text } from '@/components/ui';
import { spacing } from '@/theme';
import { useTranslator } from '@/i18n';

interface LegendItem {
  label: string;
  color: string;
}

interface ChartLegendProps {
  items: readonly LegendItem[];
}

/** Color key shown under a chart with more than one series. */
export function ChartLegend({ items }: ChartLegendProps) {
  const { t } = useTranslator();
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
            {t(item.label)}
          </Text>
        </View>
      ))}
    </View>
  );
}
