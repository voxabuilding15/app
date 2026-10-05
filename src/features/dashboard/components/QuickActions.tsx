import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { Button, Card, Text, type IconName } from '@/components';
import { spacing } from '@/theme';

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

export function QuickActions() {
  const router = useRouter();

  return (
    <Card variant="elevated" style={{ gap: spacing.md }}>
      <Text variant="titleMedium" accessibilityRole="header">
        Quick actions
      </Text>
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
  );
}
