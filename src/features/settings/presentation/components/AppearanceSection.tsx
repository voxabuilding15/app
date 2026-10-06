import { SegmentedControl, Text } from '@/components';
import { APP_NAME } from '@/constants/app';
import { useTranslator } from '@/i18n';
import { useTheme, type ThemePreference } from '@/theme';

import { SettingsSection } from './SettingsSection';

export function AppearanceSection() {
  const { t } = useTranslator();
  const { preference, setPreference } = useTheme();
  const options: readonly { value: ThemePreference; label: string }[] = [
    { value: 'system', label: t('System') },
    { value: 'light', label: t('Light') },
    { value: 'dark', label: t('Dark') },
  ];

  return (
    <SettingsSection title={t('Appearance')}>
      <Text tone="muted">{t('Choose how {app} looks.', { app: APP_NAME })}</Text>
      <SegmentedControl options={options} value={preference} onChange={setPreference} />
    </SettingsSection>
  );
}
