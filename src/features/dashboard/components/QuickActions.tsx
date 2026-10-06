import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { Button, Card, Text, type IconName } from '@/components';
import { useTranslator } from '@/i18n';
import { spacing } from '@/theme';

interface QuickAction {
  label: string;
  icon: IconName;
  href: '/tasks' | '/habits' | '/finance' | '/pomodoro';
}

export function QuickActions() {
  const router = useRouter();
  const { t } = useTranslator();
  const actions: readonly QuickAction[] = [
    { label: t('Add task'), icon: 'add-task', href: '/tasks' },
    { label: t('Log habit'), icon: 'local-fire-department', href: '/habits' },
    { label: t('Add expense'), icon: 'payments', href: '/finance' },
    { label: t('Start focus'), icon: 'timer', href: '/pomodoro' },
  ];

  return (
    <Card variant="elevated" style={{ gap: spacing.md }}>
      <Text variant="titleMedium" accessibilityRole="header">
        {t('Quick actions')}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {actions.map((action) => (
          <Button
            key={action.href}
            label={t(action.label)}
            icon={action.icon}
            variant="tonal"
            onPress={() => router.navigate(action.href)}
          />
        ))}
      </View>
    </Card>
  );
}
