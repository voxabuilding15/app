import { useCallback, useEffect, useState } from 'react';
import { Linking } from 'react-native';

import {
  Button,
  Card,
  Divider,
  ListItem,
  Screen,
  SectionHeader,
  SegmentedControl,
  Text,
} from '@/components';
import { APP_NAME, APP_VERSION } from '@/constants/app';
import { useContainer } from '@/core/di/container';
import { getSchemaVersion } from '@/database';
import type { PermissionState } from '@/services/notifications';
import { spacing, useTheme, type ThemePreference } from '@/theme';

const THEME_OPTIONS = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
] as const satisfies readonly { value: ThemePreference; label: string }[];

const PERMISSION_LABEL: Record<PermissionState, string> = {
  granted: 'Notifications are allowed',
  denied: 'Notifications are blocked in system settings',
  undetermined: 'Notifications have not been allowed yet',
};

export function SettingsScreen() {
  const { preference, setPreference } = useTheme();
  const { notifications, db } = useContainer();
  const [permission, setPermission] = useState<PermissionState>('undetermined');

  useEffect(() => {
    void notifications.getPermissionState().then(setPermission);
  }, [notifications]);

  const handlePermission = useCallback(async () => {
    if (permission === 'denied') {
      await Linking.openSettings();
      return;
    }
    setPermission(await notifications.requestPermission());
  }, [notifications, permission]);

  return (
    <Screen>
      <SectionHeader title="Appearance" />
      <Card style={{ gap: spacing.md }}>
        <Text tone="muted">Choose how {APP_NAME} looks.</Text>
        <SegmentedControl options={THEME_OPTIONS} value={preference} onChange={setPreference} />
      </Card>

      <SectionHeader title="Notifications" />
      <Card style={{ gap: spacing.md }}>
        <Text>{PERMISSION_LABEL[permission]}</Text>
        {permission !== 'granted' ? (
          <Button
            label={permission === 'denied' ? 'Open system settings' : 'Allow notifications'}
            variant="tonal"
            onPress={() => void handlePermission()}
          />
        ) : null}
      </Card>

      <SectionHeader title="About" />
      <Card>
        <ListItem title={APP_NAME} subtitle={`Version ${APP_VERSION}`} icon="info" />
        <Divider />
        <ListItem
          title="Offline storage"
          subtitle={`All data stays on this device (database v${getSchemaVersion(db)})`}
          icon="lock"
        />
      </Card>
    </Screen>
  );
}
