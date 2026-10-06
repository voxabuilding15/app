import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';
import { currentTranslator } from '@/i18n/translate';

/** Hands a file to another app (a PDF viewer, say) through the system share sheet. */
export async function openFile(uri: string, mimeType: string): Promise<void> {
  const { t } = currentTranslator();
  try {
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, { mimeType, dialogTitle: t('Open with') });
      return;
    }
  } catch {
    // fall through to the message below
  }
  Alert.alert(t("Can't open this file"), t('No app on this phone can open it.'));
}
