import { useState } from 'react';

import { SwitchRow, Text } from '@/components';
import { useTranslator } from '@/i18n';

import { useSettingsModule } from '../module';

import { SettingsSection } from './SettingsSection';

export function PrivacySection() {
  const { t } = useTranslator();
  const { privacy } = useSettingsModule();
  const [hide, setHide] = useState(() => privacy.read().hideNotificationDetails);

  return (
    <SettingsSection title={t('Privacy')}>
      <Text tone="muted">
        {t(
          'Your data stays on this device. FocusFlow has no account, no ads and sends nothing to anyone.',
        )}
      </Text>
      <SwitchRow
        title={t('Hide notification details')}
        subtitle={t(
          'Notifications only say that something needs attention, so nothing private shows on the lock screen. Reminders already scheduled change the next time you save them.',
        )}
        value={hide}
        onChange={(value) => {
          privacy.write({ hideNotificationDetails: value });
          setHide(value);
        }}
      />
    </SettingsSection>
  );
}
