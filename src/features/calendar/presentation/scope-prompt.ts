import { Alert } from 'react-native';

import type { EditScope } from '../domain/usecases';

/** Asks whether a change to a recurring event applies to one occurrence or the whole series. */
export function askScope(title: string, message: string): Promise<EditScope | null> {
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
        { text: 'This event', onPress: () => resolve('this') },
        { text: 'All events', onPress: () => resolve('all') },
      ],
      { cancelable: true, onDismiss: () => resolve(null) },
    );
  });
}
