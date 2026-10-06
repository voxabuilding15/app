import { Stack } from 'expo-router';

import { LockSettingsPanel, Screen } from '@/components';
import { useTranslator } from '@/i18n';

import { useLock } from '../view-models/useLock';

/** Choose how locked notes are opened. */
export function LockSettingsScreen() {
  const lock = useLock();
  const { t } = useTranslator();

  return (
    <>
      <Stack.Screen options={{ title: t('Lock settings') }} />
      <Screen>
        <LockSettingsPanel
          lock={lock}
          copy={{
            title: t('How locked notes open'),
            description: t(
              'Mark a note as locked in its settings. Locked notes hide their text in lists and search, and ask to be unlocked before opening. They lock again after 5 minutes or when you leave the app.',
            ),
            footnote: t(
              'Locking keeps notes private from anyone using your phone, but the text is stored on the device without encryption. Use your phone’s own encryption for full protection.',
            ),
            deviceDone: t('Notes now use your phone’s lock'),
            subject: t('Your notes'),
            protects: t('locked notes'),
          }}
        />
      </Screen>
    </>
  );
}
