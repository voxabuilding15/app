import { Button, Card, SectionHeader, Text } from '@/components';
import type { PermissionState } from '@/core';
import { useNotificationPermission } from '@/hooks';
import { spacing } from '@/theme';

const STATUS_LABEL: Record<PermissionState, string> = {
  granted: 'Notifications are allowed',
  denied: 'Notifications are blocked in system settings',
  undetermined: 'Notifications have not been allowed yet',
};

export function NotificationsSection() {
  const { state, request } = useNotificationPermission();

  return (
    <>
      <SectionHeader title="Notifications" />
      <Card style={{ gap: spacing.md }}>
        <Text>{STATUS_LABEL[state]}</Text>
        {state !== 'granted' ? (
          <Button
            label={state === 'denied' ? 'Open system settings' : 'Allow notifications'}
            variant="tonal"
            onPress={() => void request()}
          />
        ) : null}
      </Card>
    </>
  );
}
