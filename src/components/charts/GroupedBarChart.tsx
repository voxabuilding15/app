import { View } from 'react-native';

import { Text } from '@/components/ui';
import { radius, spacing, useTheme, withAlpha } from '@/theme';

import { ChartLegend } from './ChartLegend';

interface BarSeries {
  name: string;
  color: string;
  /** Color for values below zero; defaults to the series color. */
  negativeColor?: string;
}

interface BarGroup {
  label: string;
  /** One value per series, in the same order. */
  values: readonly number[];
  /** Emphasises the group, e.g. the current period (see `dimOthers`). */
  highlight?: boolean;
  /** Spoken description of this group; defaults to "label: values". */
  description?: string;
}

interface GroupedBarChartProps {
  data: readonly BarGroup[];
  series: readonly BarSeries[];
  height?: number;
  /** Value that fills the full height above the axis. Defaults to the largest value (or the goal). */
  max?: number;
  /** Draws a reference line at this value, such as a target. */
  goal?: number;
  /** Fades the bars of groups that are not highlighted. */
  dimOthers?: boolean;
  /** Names each series under the chart; shown automatically when there is more than one. */
  showLegend?: boolean;
  /** Spoken summary of the whole chart. */
  label: string;
}

const LABEL_HEIGHT = 18;
const BAR_GAP = 2;

/**
 * Responsive bar chart built from views, so it needs no native charting library. Groups hold one
 * bar per series; values below zero hang under the axis, so it also draws gains and losses.
 */
export function GroupedBarChart({
  data,
  series,
  height = 120,
  max,
  goal,
  dimOthers = false,
  showLegend,
  label,
}: GroupedBarChartProps) {
  const { colors } = useTheme();
  const values = data.flatMap((group) => group.values);
  const ceiling = Math.max(1, max ?? 0, goal ?? 0, ...values);
  const floor = Math.max(0, ...values.map((value) => -value));
  const plotHeight = height - LABEL_HEIGHT;
  const scale = plotHeight / (ceiling + floor);
  const positiveHeight = ceiling * scale;
  const negativeHeight = floor * scale;

  const legend = showLegend ?? series.length > 1;

  return (
    <View style={{ gap: spacing.sm }}>
      <View accessible accessibilityLabel={`${label}. ${data.map(describe).join(', ')}`}>
        <View style={{ height, flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm }}>
          {goal !== undefined ? (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: LABEL_HEIGHT + negativeHeight + goal * scale,
                borderTopWidth: 1,
                borderStyle: 'dashed',
                borderColor: colors.outline,
              }}
            />
          ) : null}
          {data.map((group, index) => (
            <View key={`${group.label}-${index}`} style={{ flex: 1, alignItems: 'center' }}>
              <View style={{ height: plotHeight, width: '100%' }}>
                <View
                  style={{
                    height: positiveHeight,
                    flexDirection: 'row',
                    alignItems: 'flex-end',
                    gap: BAR_GAP,
                  }}
                >
                  {series.map((item, seriesIndex) => (
                    <Bar
                      key={item.name}
                      value={group.values[seriesIndex] ?? 0}
                      scale={scale}
                      color={item.color}
                      faded={dimOthers && !group.highlight}
                      placement="above"
                    />
                  ))}
                </View>
                {negativeHeight > 0 ? (
                  <View
                    style={{
                      height: negativeHeight,
                      flexDirection: 'row',
                      alignItems: 'flex-start',
                      gap: BAR_GAP,
                    }}
                  >
                    {series.map((item, seriesIndex) => (
                      <Bar
                        key={item.name}
                        value={group.values[seriesIndex] ?? 0}
                        scale={scale}
                        color={item.negativeColor ?? item.color}
                        faded={dimOthers && !group.highlight}
                        placement="below"
                      />
                    ))}
                  </View>
                ) : null}
              </View>
              <Text
                variant="labelSmall"
                tone="muted"
                numberOfLines={1}
                style={{ height: LABEL_HEIGHT, lineHeight: LABEL_HEIGHT }}
              >
                {group.label}
              </Text>
            </View>
          ))}
        </View>
      </View>
      {legend ? (
        <ChartLegend items={series.map((item) => ({ label: item.name, color: item.color }))} />
      ) : null}
    </View>
  );
}

interface BarProps {
  value: number;
  scale: number;
  color: string;
  faded: boolean;
  /** Which side of the axis this slot draws; the other side leaves an empty slot. */
  placement: 'above' | 'below';
}

function Bar({ value, scale, color, faded, placement }: BarProps) {
  const { colors } = useTheme();
  const belongs = placement === 'above' ? value >= 0 : value < 0;
  if (!belongs) {
    return <View style={{ flex: 1 }} />;
  }
  // A zero value still draws a hairline on the axis, so empty periods are visible.
  const barHeight = Math.max(value === 0 ? 2 : 4, Math.abs(value) * scale);
  const rounded = radius.md / 2;
  return (
    <View
      style={{
        flex: 1,
        height: barHeight,
        borderTopLeftRadius: placement === 'above' ? rounded : 0,
        borderTopRightRadius: placement === 'above' ? rounded : 0,
        borderBottomLeftRadius: placement === 'below' ? rounded : 0,
        borderBottomRightRadius: placement === 'below' ? rounded : 0,
        backgroundColor:
          value === 0 ? colors.outlineVariant : faded ? withAlpha(color, 0.55) : color,
      }}
    />
  );
}

function describe(group: BarGroup): string {
  return group.description ?? `${group.label}: ${group.values.join(', ')}`;
}
