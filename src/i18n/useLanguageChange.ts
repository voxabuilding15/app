import { useCallback } from 'react';
import { Alert } from 'react-native';

import { applyDirection, directionMatches } from './direction';
import { currentLanguageChoice } from './bootstrap';
import { LANGUAGE_INFO, type Language } from './languages';
import { currentTranslator } from './translate';
import { useTranslator } from './useTranslator';

/**
 * Switches the language. The words change at once; when the new language reads the other way
 * (Arabic), the layout needs a restart, which is offered first so nothing is lost by surprise.
 */
export function useLanguageChange(): (language: Language) => void {
  const { setPreference } = useTranslator();

  return useCallback(
    (language: Language) => {
      setPreference(language);
      // The words have already changed, so the question is asked in the new language.
      const { t } = currentTranslator();
      const wantRtl = LANGUAGE_INFO[currentLanguageChoice()].rtl;
      if (directionMatches(wantRtl)) {
        return;
      }
      Alert.alert(
        t('Restart to change direction'),
        t(
          'This language is read in the other direction, so FocusFlow restarts to mirror the layout.',
        ),
        [
          { text: t('Later'), style: 'cancel' },
          {
            text: t('Restart now'),
            onPress: () => {
              void applyDirection(wantRtl).then((result) => {
                if (result === 'manual') {
                  Alert.alert(
                    t('Reopen FocusFlow'),
                    t('Close the app and open it again to finish changing the layout direction.'),
                  );
                }
              });
            },
          },
        ],
      );
    },
    [setPreference],
  );
}
