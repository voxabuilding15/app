import { View } from 'react-native';

import { Screen, Text } from '@/components';
import { spacing } from '@/theme';

import { QuickActions } from './components/QuickActions';
import { SummaryCard } from './components/SummaryCard';

const SUMMARIES = [
  { title: "Today's tasks", message: 'No tasks are due today.' },
  { title: "Today's habits", message: 'No habits scheduled for today.' },
  { title: "Today's expenses", message: 'No expenses recorded today.' },
  { title: 'Current budget', message: 'No monthly budget has been set.' },
  { title: 'Upcoming reminders', message: 'No reminders are scheduled.' },
  { title: 'Pomodoro', message: 'No focus sessions completed today.' },
  {
    title: 'Weekly progress',
    message: 'Progress appears here once you complete tasks and habits.',
  },
] as const;

function greetingFor(date: Date): string {
  const hour = date.getHours();
  if (hour < 12) {
    return 'Good morning';
  }
  return hour < 18 ? 'Good afternoon' : 'Good evening';
}

export function DashboardScreen() {
  const now = new Date();
  const dateLabel = now.toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <Screen>
      <View style={{ gap: spacing.xs }}>
        <Text variant="headlineSmall" accessibilityRole="header">
          {greetingFor(now)}
        </Text>
        <Text tone="muted">{dateLabel}</Text>
      </View>
      <QuickActions />
      {SUMMARIES.map((summary) => (
        <SummaryCard key={summary.title} title={summary.title} message={summary.message} />
      ))}
    </Screen>
  );
}
