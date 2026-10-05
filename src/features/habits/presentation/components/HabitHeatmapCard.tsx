import { useMemo, useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';

import { Card, Heatmap, Text, fitHeatmap } from '@/components';
import type { DateKey } from '@/core';
import { spacing, useTheme, withAlpha } from '@/theme';

import type { Habit } from '../../domain/entities';
import type { HabitEvaluator } from '../../domain/progress';
import { HEATMAP_ROW_LABELS, buildHeatmapModel } from '../heatmap-model';

const GAP = 3;
const ROW_LABEL_SPACE = 16 + GAP;
const MAX_WEEKS = 26;

interface HabitHeatmapCardProps {
  habit: Habit;
  evaluator: HabitEvaluator;
  today: DateKey;
  selectedDay: DateKey | null;
  onSelectDay: (day: DateKey) => void;
}

function LegendCell({ fill }: { fill: string }) {
  return <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: fill }} />;
}

const LEVELS = [0, 0.3, 0.5, 0.75, 1] as const;

/** GitHub-style calendar heatmap of the habit's history; tap a day to review or edit it. */
export function HabitHeatmapCard({
  habit,
  evaluator,
  today,
  selectedDay,
  onSelectDay,
}: HabitHeatmapCardProps) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);

  const { columns: weeks, cellSize } = fitHeatmap(width, {
    gap: GAP,
    reserved: ROW_LABEL_SPACE,
    maxColumns: MAX_WEEKS,
    minCell: 12,
    maxCell: 20,
  });
  const model = useMemo(
    () => buildHeatmapModel(evaluator, habit, today, weeks),
    [evaluator, habit, today, weeks],
  );

  return (
    <Card style={{ gap: spacing.md }}>
      <Text variant="titleMedium" accessibilityRole="header">
        History
      </Text>
      <View
        testID="heatmap-container"
        onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
      >
        {width > 0 ? (
          <Heatmap
            columns={model.columns}
            columnLabels={model.columnLabels}
            rowLabels={HEATMAP_ROW_LABELS}
            color={habit.color}
            cellSize={cellSize}
            gap={GAP}
            selectedKey={selectedDay}
            onPressCell={onSelectDay}
            label={`Completion history for the last ${weeks} weeks`}
          />
        ) : null}
      </View>
      <View
        style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm }}
      >
        <Text variant="labelSmall" tone="muted">
          Less
        </Text>
        {LEVELS.map((alpha) => (
          <LegendCell
            key={alpha}
            fill={alpha === 0 ? colors.outlineVariant : withAlpha(habit.color, alpha)}
          />
        ))}
        <Text variant="labelSmall" tone="muted">
          More
        </Text>
        <Text variant="labelSmall" tone="muted">
          · Dashed: skipped or not scheduled · Grey: paused
        </Text>
      </View>
    </Card>
  );
}
