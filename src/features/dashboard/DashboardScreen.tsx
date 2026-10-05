import { View } from 'react-native';
import { useRouter } from 'expo-router';

import { Button, Card, Screen, Text } from '@/components';
import type { IconName } from '@/components';
import { spacing } from '@/theme';

function greetingFor(date: Date): string {
  const hour = date.getHours();
  if (hour < 12) {
    return 'Good morning';
  }
  return hour < 18 ? 'Good afternoon' : 'Good evening';
}

interface SummaryCardProps {
  title: string;
  message: string;
}

function SummaryCard({ title, message }: SummaryCardProps) {
  return (
    <Card style={{ gap: spacing.xs }}>
      <Text variant="titleMedium">{title}</Text>
      <Text tone="muted">{message}</Text>
    </Card>
  );
}

interface QuickAction {
  label: string;
  icon: IconName;
  href: '/tasks' | '/habits' | '/finance' | '/pomodoro';
}

const QUICK_ACTIONS: readonly QuickAction[] = [
  { label: 'Add task', icon: 'add-task', href: '/tasks' },
  { label: 'Log habit', icon: 'local-fire-department', href: '/habits' },
  { label: 'Add expense', icon: 'payments', href: '/finance' },
  { label: 'Start focus', icon: 'timer', href: '/pomodoro' },
];

export function DashboardScreen() {
  const router = useRouter();
  const now = new Date();
  const dateLabel = now.toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <Screen>
      <View style={{ gap: spacing.xs }}>
        <Text variant="headlineSmall">{greetingFor(now)}</Text>
        <Text tone="muted">{dateLabel}</Text>
      </View>

      <Card variant="elevated" style={{ gap: spacing.md }}>
        <Text variant="titleMedium">Quick actions</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {QUICK_ACTIONS.map((action) => (
            <Button
              key={action.label}
              label={action.label}
              icon={action.icon}
              variant="tonal"
              onPress={() => router.navigate(action.href)}
            />
          ))}
        </View>
      </Card>

      <SummaryCard title="Today's tasks" message="No tasks are due today." />
      <SummaryCard title="Today's habits" message="No habits scheduled for today." />
      <SummaryCard title="Today's expenses" message="No expenses recorded today." />
      <SummaryCard title="Current budget" message="No monthly budget has been set." />
      <SummaryCard title="Upcoming reminders" message="No reminders are scheduled." />
      <SummaryCard title="Pomodoro" message="No focus sessions completed today." />
      <SummaryCard
        title="Weekly progress"
        message="Progress appears here once you complete tasks and habits."
      />
    </Screen>
  );
}
