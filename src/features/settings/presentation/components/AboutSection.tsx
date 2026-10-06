import { Divider, ListItem } from '@/components';
import { APP_NAME, APP_VERSION } from '@/constants/app';
import { useTranslator } from '@/i18n';

import { useUsage } from '../queries';

import { SettingsSection } from './SettingsSection';

export function AboutSection() {
  const { t } = useTranslator();
  const { data } = useUsage();

  return (
    <SettingsSection title={t('About')}>
      <ListItem
        title={APP_NAME}
        subtitle={t('Version {version}', { version: APP_VERSION })}
        icon="info"
      />
      <Divider />
      <ListItem
        title={t('Offline storage')}
        subtitle={t('All data stays on this device (database v{version})', {
          version: data?.schemaVersion ?? '–',
        })}
        icon="lock"
      />
      <Divider />
      <ListItem
        title={t('Works without internet')}
        subtitle={t('Nothing in the app needs a connection.')}
        icon="cloud-off"
      />
    </SettingsSection>
  );
}
