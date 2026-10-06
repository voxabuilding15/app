import { GroupedBarChart } from './GroupedBarChart';
import { useTheme } from '@/theme';

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
  onSelect?: (index: number) => void;
  selectedIndex?: number | null;
}

/** A single-series bar chart with one emphasised bar; see `GroupedBarChart` for more series. */
export function BarChart({
  data,
  color,
  height,
  max,
  goal,
  label,
  onSelect,
  selectedIndex,
}: BarChartProps) {
  const { colors } = useTheme();
  return (
    <GroupedBarChart
      label={label}
      onSelect={onSelect}
      selectedIndex={selectedIndex}
      height={height}
      max={max}
      goal={goal}
      dimOthers
      series={[{ name: label, color: color ?? colors.primary }]}
      data={data.map((datum) => ({
        label: datum.label,
        values: [datum.value],
        highlight: datum.highlight,
        description: datum.description ?? `${datum.label}: ${datum.value}`,
      }))}
    />
  );
}
