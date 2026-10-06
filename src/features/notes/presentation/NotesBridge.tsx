import { useRouter } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { AppState } from 'react-native';

import type { NotificationResponse } from '@/core';
import { useNotificationResponses } from '@/hooks';

import { useNotesModule } from './module';
import { useInvalidateNotes } from './queries';

/**
 * Headless component that opens a note when its reminder is tapped, keeps the trash and the
 * widget snapshot tidy at start-up, and locks notes again when the app goes to the background.
 */
export function NotesBridge() {
  const { notes, lock, widgets } = useNotesModule();
  const invalidate = useInvalidateNotes();
  const router = useRouter();

  useNotificationResponses('notes', async (response: NotificationResponse) => {
    const { noteId } = response.data;
    if (typeof noteId === 'string' && response.actionId === 'default') {
      router.push({ pathname: '/notes/[id]', params: { id: noteId } });
    }
  });

  const tidy = useCallback(() => {
    notes
      .purgeExpired()
      .then(() => widgets.publish())
      .catch(() => undefined)
      .finally(() => void invalidate());
  }, [notes, widgets, invalidate]);
  useEffect(tidy, [tidy]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background') {
        lock.lockNow();
        void invalidate();
      }
    });
    return () => subscription.remove();
  }, [lock, invalidate]);

  return null;
}
