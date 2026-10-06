import { View } from 'react-native';

import { Button, Card, ProgressRing, SegmentedControl, Text } from '@/components';
import { spacing, useTheme } from '@/theme';

import type { TimerKind } from '../../domain/timer';
import { KIND_LABEL, formatClockFace, speakClock } from '../format';
import { useCountdown } from '../use-countdown';
import type { TimerViewModel } from '../view-models/useTimerViewModel';

const RING_SIZE = 248;
const PHASES = (['focus', 'short_break', 'long_break'] as const).map((value) => ({
  value,
  label: KIND_LABEL[value],
}));

interface TimerCardProps {
  vm: TimerViewModel;
}

/** The countdown with its phase picker and the start, pause, resume, skip and stop controls. */
export function TimerCard({ vm }: TimerCardProps) {
  const { colors } = useTheme();
  const { state } = vm;
  const { remaining, progress, position } = useCountdown(state);
  const kind = state.kind;
  const accent = kind === 'focus' ? colors.primary : colors.success;
  const description = `${KIND_LABEL[kind]}, ${speakClock(remaining)} left${
    state.status === 'paused' ? ', paused' : ''
  }`;

  return (
    <Card style={{ alignItems: 'center', gap: spacing.xl }}>
      {state.status === 'idle' ? (
        <View style={{ alignSelf: 'stretch' }}>
          <SegmentedControl
            options={PHASES}
            value={kind}
            onChange={(next: TimerKind) => void vm.select(next)}
          />
        </View>
      ) : (
        <Text variant="titleMedium" tone="muted" accessibilityRole="header">
          {KIND_LABEL[kind]}
          {state.status === 'paused' ? ' · Paused' : ''}
        </Text>
      )}

      <ProgressRing
        progress={progress}
        size={RING_SIZE}
        strokeWidth={14}
        color={accent}
        label={description}
      >
        <Text
          variant="headlineSmall"
          style={{ fontSize: 56, lineHeight: 64, fontVariant: ['tabular-nums'] }}
        >
          {formatClockFace(remaining)}
        </Text>
        <Text variant="bodyMedium" tone="muted">
          {position}
        </Text>
      </ProgressRing>

      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: spacing.md,
        }}
      >
        {state.status === 'idle' ? (
          <Button
            label={kind === 'focus' ? 'Start focus' : 'Start break'}
            icon="play-arrow"
            onPress={() => void vm.start()}
          />
        ) : (
          <>
            {state.status === 'running' ? (
              <Button label="Pause" icon="pause" onPress={() => void vm.pause()} />
            ) : (
              <Button label="Resume" icon="play-arrow" onPress={() => void vm.resume()} />
            )}
            <Button label="Skip" icon="skip-next" variant="tonal" onPress={() => void vm.skip()} />
            <Button label="Stop" icon="stop" variant="outlined" onPress={() => void vm.stop()} />
          </>
        )}
      </View>
    </Card>
  );
}
