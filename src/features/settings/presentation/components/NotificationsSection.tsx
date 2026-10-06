import { useState } from 'react';
import { Linking } from 'react-native';

import { Button, Text } from '@/components';
import { useContainer, type PermissionState } from '@/core';
import { useNotificationPermission } from '@/hooks';
import { useTranslator } from '@/i18n';

import { SettingsSection } from './SettingsSection';

export function NotificationsSection() {
  const { t } = useTranslator();
  const { notifications } = useContainer();
  const { state, request } = useNotificationPermission();
  const [sent, setSent] = useState(false);

  const status: Record<PermissionState, string> = {
    granted: t('Notifications are allowed'),
    denied: t('Notifications are blocked in system settings'),
    undetermined: t('Notifications have not been allowed yet'),
  };

  const sendTest = async () => {
    await notifications.present({
      title: t('FocusFlow'),
      body: t('Notifications are working'),
      channelId: 'default',
    });
    setSent(true);
  };

  return (
    <SettingsSection title={t('Notifications')}>
      <Text>{status[state]}</Text>
      {state !== 'granted' ? (
        <Button
          label={state === 'denied' ? t('Open system settings') : t('Allow notifications')}
          variant="tonal"
          onPress={() => void request()}
        />
      ) : (
        <Button
          label={t('Send a test notification')}
          variant="tonal"
          icon="notifications"
          onPress={() => void sendTest()}
        />
      )}
      {sent ? (
        <Text variant="labelSmall" tone="muted" accessibilityLiveRegion="polite">
          {t('Test notification sent')}
        </Text>
      ) : null}
      <Text variant="labelSmall" tone="muted">
        {t(
          'Each part of the app has its own notification category. You can turn them on or off, and choose sounds, in your phone’s settings.',
        )}
      </Text>
      <Button
        label={t('Manage categories in system settings')}
        variant="text"
        onPress={() => void Linking.openSettings()}
      />
    </SettingsSection>
  );
}
