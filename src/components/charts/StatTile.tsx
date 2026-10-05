import { View } from 'react-native';

import { Card, Icon, Text, type IconName } from '@/components/ui';
import { spacing, useTheme } from '@/theme';

interface StatTileProps {
  label: string;
  value: string;
  caption?: string;
  icon?: IconName;
  /** Tints the icon, e.g. with a habit's color. */
  accent?: string;
}

/** A single headline number with a label, for stat grids. */
export function StatTile({ label, value, caption, icon, accent }: StatTileProps) {
  const { colors } = useTheme();

  return (
    <Card style={{ flex: 1, minWidth: 140, gap: spacing.xs }}>
      <View accessible accessibilityLabel={`${label}: ${value}${caption ? `, ${caption}` : ''}`}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          {icon ? <Icon name={icon} size={20} color={accent ?? colors.primary} /> : null}
          <Text variant="labelSmall" tone="muted">
            {label}
          </Text>
        </View>
        <Text variant="headlineSmall">{value}</Text>
        {caption ? (
          <Text variant="labelSmall" tone="muted">
            {caption}
          </Text>
        ) : null}
      </View>
    </Card>
  );
}
