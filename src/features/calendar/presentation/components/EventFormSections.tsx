import { View } from 'react-native';

import {
  Chip,
  ChipGroup,
  FormSection,
  NumberStepper,
  SwitchRow,
  Text,
  WRAP_ROW,
} from '@/components';
import { toDateKey } from '@/core';
import { spacing } from '@/theme';

import type { EventRecurrence } from '../../domain/entities';
import { MAX_OCCURRENCE_COUNT, type EventDraft } from '../../domain/validation';
import { formatDayShort, formatTime } from '../format';
import type { RepeatEnd } from '../view-models/useEventFormViewModel';

type PickKind = 'startDay' | 'startTime' | 'endDay' | 'endTime';

interface EventTimeSectionProps {
  draft: EventDraft;
  error?: string;
  onAllDay: (allDay: boolean) => void;
  onPick: (kind: PickKind) => void;
}

function TimeRow({
  label,
  dayLabel,
  timeLabel,
  onPickDay,
  onPickTime,
}: {
  label: string;
  dayLabel: string;
  timeLabel: string | null;
  onPickDay: () => void;
  onPickTime: () => void;
}) {
  return (
    <View style={{ gap: spacing.xs }}>
      <Text variant="labelSmall" tone="muted">
        {label}
      </Text>
      <View style={WRAP_ROW}>
        <Chip
          icon="event"
          label={dayLabel}
          selected
          accessibilityLabel={`${label} date ${dayLabel}. Change`}
          onPress={onPickDay}
        />
        {timeLabel !== null ? (
          <Chip
            icon="schedule"
            label={timeLabel}
            selected
            accessibilityLabel={`${label} time ${timeLabel}. Change`}
            onPress={onPickTime}
          />
        ) : null}
      </View>
    </View>
  );
}

export function EventTimeSection({ draft, error, onAllDay, onPick }: EventTimeSectionProps) {
  // An all-day event's stored end is midnight after its last day, so show the last day itself.
  const endMs = draft.allDay ? draft.end - 1 : draft.end;

  return (
    <FormSection title="When" error={error}>
      <SwitchRow title="All day" value={draft.allDay} onChange={onAllDay} />
      <TimeRow
        label="Starts"
        dayLabel={formatDayShort(toDateKey(draft.start))}
        timeLabel={draft.allDay ? null : formatTime(draft.start)}
        onPickDay={() => onPick('startDay')}
        onPickTime={() => onPick('startTime')}
      />
      <TimeRow
        label="Ends"
        dayLabel={formatDayShort(toDateKey(endMs))}
        timeLabel={draft.allDay ? null : formatTime(draft.end)}
        onPickDay={() => onPick('endDay')}
        onPickTime={() => onPick('endTime')}
      />
    </FormSection>
  );
}

interface RepeatEndControlsProps {
  rule: EventRecurrence;
  repeatEnd: RepeatEnd;
  onEnd: (end: RepeatEnd) => void;
  onChooseUntil: () => void;
  onCount: (count: number) => void;
}

/** "Ends: never / on a date / after N times", shown inside the repeat section. */
export function RepeatEndControls({
  rule,
  repeatEnd,
  onEnd,
  onChooseUntil,
  onCount,
}: RepeatEndControlsProps) {
  return (
    <ChipGroup title="Ends">
      <Chip label="Never" selected={repeatEnd === 'never'} onPress={() => onEnd('never')} />
      <Chip label="On a date" selected={repeatEnd === 'until'} onPress={() => onEnd('until')} />
      <Chip
        label="After a number"
        selected={repeatEnd === 'count'}
        onPress={() => onEnd('count')}
      />
      {repeatEnd === 'until' && rule.until ? (
        <Chip
          icon="event"
          label={formatDayShort(rule.until)}
          selected
          accessibilityLabel={`Repeat ends ${formatDayShort(rule.until)}. Change`}
          onPress={onChooseUntil}
        />
      ) : null}
      {repeatEnd === 'count' && rule.count ? (
        <NumberStepper
          label="Number of repeats"
          value={rule.count}
          min={1}
          max={MAX_OCCURRENCE_COUNT}
          suffix="times"
          onChange={onCount}
        />
      ) : null}
    </ChipGroup>
  );
}
