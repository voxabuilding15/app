import { Alert } from 'react-native';

/** Tells the user a reminder was saved but cannot fire because notifications are turned off. */
export function showRemindersBlockedAlert(): void {
  Alert.alert(
    'Reminder will not fire',
    'It was saved, but notifications are turned off. Allow them in Settings to receive reminders.',
  );
}
