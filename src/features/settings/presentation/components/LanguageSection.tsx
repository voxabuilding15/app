import { Chip, Text, WRAP_ROW } from '@/components';
import { LANGUAGES, useTranslator } from '@/i18n';
import { View } from 'react-native';

import { SettingsSection } from './SettingsSection';

export function LanguageSection() {
  const { t, preference, setPreference } = useTranslator();

  return (
    <SettingsSection title={t('Language')}>
      <Text tone="muted">{t('Choose the language of the app. System follows your phone.')}</Text>
      <View style={WRAP_ROW}>
        {LANGUAGES.map((language) => (
          <Chip
            key={language.value}
            label={language.value === 'system' ? t('System') : language.native}
            selected={preference === language.value}
            onPress={() => setPreference(language.value)}
          />
        ))}
      </View>
      <Text variant="labelSmall" tone="muted">
        {t(
          'Settings, statistics, achievements and backups are translated. Other screens are still in English.',
        )}
      </Text>
    </SettingsSection>
  );
}
