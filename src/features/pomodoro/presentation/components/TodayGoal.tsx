import { Card, ProgressBar, Text } from '@/components';
import { spacing } from '@/theme';

import { goalFraction } from '../../domain/stats';
import { formatFocusTime } from '../format';
import { useOverview, usePomodoroSettings } from '../queries';
import { useTranslator } from '@/i18n';

/** Today's focus time against the daily goal, under the timer. */
export function TodayGoal() {
  const { t } = useTranslator();
  const settings = usePomodoroSettings();
  const { data } = useOverview(settings);
  if (data === undefined) {
    return null;
  }

  const seconds = data.today.focusSeconds;
  const fraction = goalFraction(seconds, settings.dailyGoalMinutes);
  const text =
    fraction === null
      ? t('Today: {focusTime}', { focusTime: formatFocusTime(seconds) })
      : t('Today: {focusTime} of {goal}', {
          focusTime: formatFocusTime(seconds),
          goal: formatFocusTime(settings.dailyGoalMinutes * 60),
        });

  return (
    <Card style={{ gap: spacing.sm }}>
      <Text variant="labelLarge">{text}</Text>
      {fraction === null ? null : (
        <ProgressBar
          progress={fraction}
          label={t('Daily goal {percent} percent', { percent: Math.round(fraction * 100) })}
        />
      )}
    </Card>
  );
}
