import { Alert } from 'react-native';

import type { EditScope } from '../domain/usecases';
import { currentTranslator } from '@/i18n/translate';

/** Asks whether a change to a recurring event applies to one occurrence or the whole series. */
export function askScope(title: string, message: string): Promise<EditScope | null> {
  const { t } = currentTranslator();
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: t('Cancel'), style: 'cancel', onPress: () => resolve(null) },
        { text: t('This event'), onPress: () => resolve('this') },
        { text: t('All events'), onPress: () => resolve('all') },
      ],
      { cancelable: true, onDismiss: () => resolve(null) },
    );
  });
}
