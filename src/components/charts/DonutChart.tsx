import type { PropsWithChildren } from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { useTheme } from '@/theme';

interface DonutSlice {
  key: string;
  value: number;
  color: string;
}

interface DonutChartProps extends PropsWithChildren {
  slices: readonly DonutSlice[];
  size?: number;
  strokeWidth?: number;
  /** Spoken description, e.g. "Spending by category: Food 40%, Rent 35%". */
  label: string;
}

/** Ring split into proportional slices, with optional content in the middle. */
export function DonutChart({
  slices,
  size = 160,
  strokeWidth = 22,
  label,
  children,
}: DonutChartProps) {
  const { colors } = useTheme();
  const total = slices.reduce((sum, slice) => sum + Math.max(0, slice.value), 0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const lengths = slices.map((slice) =>
    total === 0 ? 0 : (Math.max(0, slice.value) / total) * circumference,
  );
  // Each arc starts where the previous one ended.
  const arcs = slices.map((slice, index) => ({
    slice,
    length: lengths[index] ?? 0,
    offset: lengths.slice(0, index).reduce((sum, length) => sum + length, 0),
  }));

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
    >
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.outlineVariant}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {arcs.map(({ slice, length, offset }) =>
          length > 0 ? (
            <Circle
              key={slice.key}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={slice.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${length} ${circumference - length}`}
              strokeDashoffset={-offset}
              fill="none"
              rotation={-90}
              originX={size / 2}
              originY={size / 2}
            />
          ) : null,
        )}
      </Svg>
      {children}
    </View>
  );
}
