import { View } from 'react-native';

import { Text } from '@/components/ui';
import { radius, spacing, useTheme, withAlpha } from '@/theme';

export interface BarDatum {
  label: string;
  value: number;
  /** Emphasises one bar, e.g. the current period. */
  highlight?: boolean;
  /** Spoken description of this bar; defaults to "label: value". */
  description?: string;
}

interface BarChartProps {
  data: readonly BarDatum[];
  color?: string;
  height?: number;
  /** Value that fills the full height. Defaults to the largest value (or the goal). */
  max?: number;
  /** Draws a reference line at this value, such as a target. */
  goal?: number;
  /** Spoken summary of the whole chart. */
  label: string;
}

const LABEL_HEIGHT = 18;

/** Simple responsive bar chart built from views, so it needs no native charting library. */
export function BarChart({ data, color, height = 120, max, goal, label }: BarChartProps) {
  const { colors } = useTheme();
  const barColor = color ?? colors.primary;
  const ceiling = Math.max(1, max ?? 0, goal ?? 0, ...data.map((datum) => datum.value));
  const plotHeight = height - LABEL_HEIGHT;

  return (
    <View accessible accessibilityLabel={`${label}. ${data.map(describe).join(', ')}`}>
      <View style={{ height, flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm }}>
        {goal !== undefined ? (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: LABEL_HEIGHT + (goal / ceiling) * plotHeight,
              borderTopWidth: 1,
              borderStyle: 'dashed',
              borderColor: colors.outline,
            }}
          />
        ) : null}
        {data.map((datum, index) => (
          <View key={`${datum.label}-${index}`} style={{ flex: 1, alignItems: 'center' }}>
            <View style={{ height: plotHeight, width: '100%', justifyContent: 'flex-end' }}>
              <View
                style={{
                  height: Math.max(datum.value > 0 ? 4 : 2, (datum.value / ceiling) * plotHeight),
                  borderTopLeftRadius: radius.md / 2,
                  borderTopRightRadius: radius.md / 2,
                  backgroundColor:
                    datum.value === 0
                      ? colors.outlineVariant
                      : datum.highlight
                        ? barColor
                        : withAlpha(barColor, 0.55),
                }}
              />
            </View>
            <Text
              variant="labelSmall"
              tone="muted"
              numberOfLines={1}
              style={{ height: LABEL_HEIGHT, lineHeight: LABEL_HEIGHT }}
            >
              {datum.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function describe(datum: BarDatum): string {
  return datum.description ?? `${datum.label}: ${datum.value}`;
}
