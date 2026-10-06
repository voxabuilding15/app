import { Card, ProgressBar, Text } from '@/components';
import { spacing } from '@/theme';

import { goalFraction } from '../../domain/stats';
import { formatFocusTime } from '../format';
import { useOverview, usePomodoroSettings } from '../queries';

/** Today's focus time against the daily goal, under the timer. */
export function TodayGoal() {
  const settings = usePomodoroSettings();
  const { data } = useOverview(settings);
  if (data === undefined) {
    return null;
  }

  const seconds = data.today.focusSeconds;
  const fraction = goalFraction(seconds, settings.dailyGoalMinutes);
  const text =
    fraction === null
      ? `Today: ${formatFocusTime(seconds)}`
      : `Today: ${formatFocusTime(seconds)} of ${formatFocusTime(settings.dailyGoalMinutes * 60)}`;

  return (
    <Card style={{ gap: spacing.sm }}>
      <Text variant="labelLarge">{text}</Text>
      {fraction === null ? null : (
        <ProgressBar
          progress={fraction}
          label={`Daily goal ${Math.round(fraction * 100)} percent`}
        />
      )}
    </Card>
  );
}
