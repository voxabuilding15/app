import { readPrivacy } from '@/core';
import { currentTranslator } from '@/i18n';
import { kvStorage } from '@/services/storage';

interface Visible {
  title: string;
  body: string;
}

/**
 * With "hide notification details" on, a notification only says that something needs attention,
 * so nothing private shows on the lock screen. Notifications already scheduled keep their text
 * until the item behind them is next saved.
 */
export function withPrivacy<T extends Visible>(input: T): T {
  const { t } = currentTranslator();
  if (!readPrivacy(kvStorage).hideNotificationDetails) {
    return input;
  }
  return {
    ...input,
    title: 'FocusFlow',
    body: currentTranslator().t(t('Open the app to see details')),
  };
}
