import { View } from 'react-native';

import { Text } from '@/components/ui';
import { PressableScale } from '@/components/ui/PressableScale';
import { useTheme, withAlpha } from '@/theme';

export interface HeatmapCell {
  key: string;
  /** 0 (empty) to 4 (strongest). */
  level: 0 | 1 | 2 | 3 | 4;
  variant?: 'default' | 'skipped' | 'paused' | 'off';
  /** Spoken description, e.g. "Mon 5 Oct: 2 of 3". */
  label: string;
}

interface HeatmapProps {
  /** One entry per column (usually a week); `null` leaves a blank cell. */
  columns: readonly (readonly (HeatmapCell | null)[])[];
  /** Optional short labels above columns, e.g. month names at the month's first column. */
  columnLabels?: readonly (string | null)[];
  /** Optional labels for rows, e.g. weekday initials. */
  rowLabels?: readonly string[];
  color: string;
  cellSize: number;
  gap?: number;
  selectedKey?: string | null;
  onPressCell?: (key: string) => void;
  /** Spoken summary of the whole heatmap. */
  label: string;
}

const LEVEL_ALPHA = [0, 0.3, 0.5, 0.75, 1] as const;
const ROW_LABEL_WIDTH = 16;

/** Calendar-style heatmap: a grid of cells whose intensity shows how much was done each day. */
export function Heatmap({
  columns,
  columnLabels,
  rowLabels,
  color,
  cellSize,
  gap = 3,
  selectedKey,
  onPressCell,
  label,
}: HeatmapProps) {
  const { colors } = useTheme();

  const renderCell = (cell: HeatmapCell | null, index: number) => {
    if (cell === null) {
      return <View key={`blank-${index}`} style={{ width: cellSize, height: cellSize }} />;
    }
    const selected = cell.key === selectedKey;
    const filled = cell.level > 0;
    const visual = (
      <View
        style={{
          width: cellSize,
          height: cellSize,
          borderRadius: Math.max(2, cellSize / 5),
          backgroundColor: filled
            ? withAlpha(color, LEVEL_ALPHA[cell.level])
            : cell.variant === 'paused'
              ? colors.outlineVariant
              : cell.variant === 'off'
                ? 'transparent'
                : withAlpha(colors.outlineVariant, 0.45),
          borderWidth: selected || cell.variant === 'skipped' || cell.variant === 'off' ? 1.5 : 0,
          borderStyle: cell.variant === 'skipped' || cell.variant === 'off' ? 'dashed' : 'solid',
          borderColor: selected ? colors.onSurface : colors.outline,
        }}
      />
    );

    if (!onPressCell) {
      return (
        <View key={cell.key} accessible accessibilityLabel={cell.label}>
          {visual}
        </View>
      );
    }
    return (
      <PressableScale
        key={cell.key}
        accessibilityRole="button"
        accessibilityLabel={cell.label}
        accessibilityState={{ selected }}
        pressedScale={0.85}
        hitSlop={Math.max(0, (36 - cellSize) / 2)}
        onPress={() => onPressCell(cell.key)}
      >
        {visual}
      </PressableScale>
    );
  };

  return (
    <View accessibilityLabel={label} style={{ flexDirection: 'row', gap }}>
      {rowLabels ? (
        <View style={{ width: ROW_LABEL_WIDTH, gap, paddingTop: columnLabels ? 16 : 0 }}>
          {rowLabels.map((rowLabel, index) => (
            <View
              key={`${rowLabel}-${index}`}
              style={{ height: cellSize, justifyContent: 'center' }}
            >
              <Text variant="labelSmall" tone="muted" style={{ fontSize: 10, lineHeight: 12 }}>
                {rowLabel}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
      {columns.map((column, columnIndex) => (
        <View key={columnIndex} style={{ gap }}>
          {columnLabels ? (
            <View style={{ height: 16, width: cellSize }}>
              <Text
                variant="labelSmall"
                tone="muted"
                numberOfLines={1}
                style={{ fontSize: 10, lineHeight: 12, width: cellSize * 4 }}
              >
                {columnLabels[columnIndex] ?? ''}
              </Text>
            </View>
          ) : null}
          {column.map(renderCell)}
        </View>
      ))}
    </View>
  );
}

/** How many columns of `cellSize` fit in `width`, and the cell size that fills it, for responsive grids. */
export function fitHeatmap(
  width: number,
  options: {
    minCell?: number;
    maxCell?: number;
    gap?: number;
    reserved?: number;
    maxColumns: number;
  },
): { columns: number; cellSize: number } {
  const { minCell = 12, maxCell = 20, gap = 3, reserved = 0, maxColumns } = options;
  const usable = Math.max(0, width - reserved);
  const columns = Math.max(1, Math.min(maxColumns, Math.floor((usable + gap) / (minCell + gap))));
  const cellSize = Math.min(maxCell, Math.floor((usable - gap * (columns - 1)) / columns));
  return { columns, cellSize: Math.max(minCell, cellSize) };
}
