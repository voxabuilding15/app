import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';

/** Hands a file to another app (a PDF viewer, say) through the system share sheet. */
export async function openFile(uri: string, mimeType: string): Promise<void> {
  try {
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, { mimeType, dialogTitle: 'Open with' });
      return;
    }
  } catch {
    // fall through to the message below
  }
  Alert.alert("Can't open this file", 'No app on this phone can open it.');
}
