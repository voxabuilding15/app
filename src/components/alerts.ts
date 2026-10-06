import { Alert } from 'react-native';
import { currentTranslator } from '@/i18n/translate';

/** Tells the user a reminder was saved but cannot fire because notifications are turned off. */
export function showRemindersBlockedAlert(): void {
  const { t } = currentTranslator();
  Alert.alert(
    t('Reminder will not fire'),
    t(
      'It was saved, but notifications are turned off. Allow them in Settings to receive reminders.',
    ),
  );
}
