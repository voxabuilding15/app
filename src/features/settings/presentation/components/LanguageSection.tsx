import { View } from 'react-native';

import { Chip, Text, WRAP_ROW } from '@/components';
import { LANGUAGE_CODES, LANGUAGE_INFO, useLanguageChange, useTranslator } from '@/i18n';

import { SettingsSection } from './SettingsSection';

export function LanguageSection() {
  const { t, preference, language } = useTranslator();
  const change = useLanguageChange();

  return (
    <SettingsSection title={t('Language')}>
      <Text tone="muted">{t('Choose the language of the app. System follows your phone.')}</Text>
      <View style={WRAP_ROW}>
        <Chip
          label={`${t('System')} (${LANGUAGE_INFO[language].native})`}
          selected={preference === 'system'}
          onPress={() => change('system')}
        />
        {LANGUAGE_CODES.map((code) => (
          <Chip
            key={code}
            label={LANGUAGE_INFO[code].native}
            selected={preference === code}
            onPress={() => change(code)}
          />
        ))}
      </View>
    </SettingsSection>
  );
}
