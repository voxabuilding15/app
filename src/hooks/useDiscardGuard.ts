import { useNavigation } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { useTranslator } from '@/i18n';

/**
 * Asks before leaving a form with unsaved changes. Returns a function to call right before an
 * intentional exit (after saving, deleting, ...) so the prompt is skipped.
 */
export function useDiscardGuard(isDirty: boolean, isBusy: boolean): () => void {
  const { t } = useTranslator();
  const navigation = useNavigation();
  const leaving = useRef(false);

  useEffect(() => {
    return navigation.addListener('beforeRemove', (event) => {
      if (!isDirty || isBusy || leaving.current) {
        return;
      }
      event.preventDefault();
      Alert.alert(t('Discard changes?'), t('Your changes have not been saved.'), [
        { text: t('Keep editing'), style: 'cancel' },
        {
          text: t('Discard'),
          style: 'destructive',
          onPress: () => {
            leaving.current = true;
            navigation.dispatch(event.data.action);
          },
        },
      ]);
    });
  }, [navigation, isDirty, isBusy, t]);

  return useCallback(() => {
    leaving.current = true;
  }, []);
}
